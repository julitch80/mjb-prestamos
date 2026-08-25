import { useEffect, useMemo, useState } from 'react';
import ExcelJS from 'exceljs';
import {
  aplicarDecisiones,
  ArchivoCentrosNoReconocido,
  grupoIdsPorCentro,
  leerArchivoCentros,
  type DecisionCentro,
  type HojaCentro,
  type HojaOmitida,
} from './domain/parse-centros';
import { cruzarCentros, resumirImportCentros, type ResultadoImportCentros } from './domain/import-centros';
import type { FilaCentro } from './domain/import-centros';
import type { GrupoPrograma, Jornada, Programa, Student } from './domain/types';
import {
  ConflictoError,
  crearGrupoPrograma,
  guardarPendientesPrograma,
  inscribirEnGrupoPrograma,
  leerEstudiantesDeSede,
  leerMisGruposDePrograma,
  leerProgramasVisibles,
} from './datos';
import { DECISIONES_MANANA, DECISIONES_TARDE } from './domain/decisiones-centros-2026-2';

/**
 * Carga de las listas de centros de interes desde el Excel de cada jornada.
 *
 * El molde es `Importar.tsx` y la razon es la misma: **vista previa obligatoria, y nada se
 * escribe hasta que la coordinadora aprueba**. Aqui pesa todavia mas, porque una
 * importacion a ciegas no crea un estudiante de mas: inscribe a seiscientos menores en el
 * centro equivocado durante todo un semestre.
 *
 * El reparto de trabajo es estricto y no se duplica nada:
 *   - `domain/parse-centros.ts` convierte las hojas en filas (y ya sabe que el nombre de
 *     la pestaña miente y que el lider viene enredado en el titulo);
 *   - `domain/import-centros.ts` cruza contra la matricula (y ya sabe que **el grado del
 *     archivo no manda: manda la matricula**);
 *   - esta pantalla solo pregunta, enseña y, al final, escribe.
 *
 * REIMPORTAR EL MISMO ARCHIVO ACTUALIZA, NO DUPLICA. Las tres escrituras son idempotentes
 * por construccion: el `grupoId` sale de `slugGrupo` (deterministico sobre el mismo
 * nombre), la inscripcion va con `arrayUnion`, y el `pendienteId` es centro + nombre del
 * archivo. Corregir dos filas del Excel y volver a cargarlo es una operacion segura, que
 * es justo lo que hara la coordinadora.
 *
 * LO QUE ESTA PANTALLA NO DECIDE: a quien se parece un nombre mal escrito. Eso queda en la
 * bandeja de pendientes con la propuesta ya marcada, y lo cierra una persona.
 */

// ---------------------------------------------------------------------------

interface ConfigCentro {
  /** Nombre del centro. Editable: los titulos reales traen comillas sueltas y erratas. */
  centro: string;
  /**
   * Correo del lider. El archivo ORIGINAL trae el nombre y nunca el correo, asi que hay
   * que pedirlo; el archivo DEPURADO si lo trae en el titulo, y entonces llega relleno.
   * Editable siempre: quien manda es lo que quede en esta casilla, no lo del archivo.
   */
  correoLider: string;
}

interface Previa {
  resultado: ResultadoImportCentros;
  /** centro -> grupoId, calculado sobre las MISMAS filas que vio el cruce. */
  grupoIds: Map<string, string>;
  /** grupoIds que ya existen en el programa: esos no se crean, se les añade gente. */
  existentes: Set<string>;
  aplicadas: { decision: DecisionCentro; filas: number }[];
  sinUsar: DecisionCentro[];
  filasTrasDecisiones: number;
}

interface Hecho {
  gruposCreados: number;
  gruposReutilizados: number;
  inscripciones: number;
  pendientes: number;
}

const CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const ETIQUETA_TIPO: Record<'homonimo' | 'no_encontrado' | 'ortografia' | 'duplicado', string> = {
  homonimo: 'Dos personas posibles',
  no_encontrado: 'No aparece en la matrícula',
  ortografia: 'El nombre no coincide del todo',
  duplicado: 'Está en dos centros a la vez',
};

/** Vuelca una hoja de ExcelJS a texto plano. `cell.text`, nunca `cell.value`. */
function matrizDeHoja(ws: ExcelJS.Worksheet): string[][] {
  const matriz: string[][] = [];
  for (let n = 1; n <= ws.rowCount; n++) {
    const fila: string[] = [];
    ws.getRow(n).eachCell({ includeEmpty: true }, (c, i) => {
      fila[i - 1] = (c.text ?? '').trim();
    });
    matriz.push(fila);
  }
  return matriz;
}

// ---------------------------------------------------------------------------

/**
 * `programaFijo` llega cuando se entra desde dentro de un programa, que es el camino
 * normal: ahi el destino ya esta escogido y volver a preguntarlo confunde. Sin el, la
 * pantalla funciona suelta y ofrece el selector.
 */
export default function ImportarCentros({
  programaFijo,
  onTerminado,
}: {
  programaFijo?: Programa;
  onTerminado?: () => void;
} = {}) {
  const [programas, setProgramas] = useState<Programa[]>([]);
  const [programaId, setProgramaId] = useState(programaFijo?.programaId ?? '');
  const [nombreArchivo, setNombreArchivo] = useState('');
  const [hojas, setHojas] = useState<HojaCentro[]>([]);
  const [omitidas, setOmitidas] = useState<HojaOmitida[]>([]);
  const [config, setConfig] = useState<ConfigCentro[]>([]);
  const [jornada, setJornada] = useState<Jornada>('manana');
  const [previa, setPrevia] = useState<Previa | null>(null);
  const [hecho, setHecho] = useState<Hecho | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    let vivo = true;
    leerProgramasVisibles()
      .then((ps) => {
        if (!vivo) return;
        setProgramas(ps);
        if (programaFijo) setProgramaId(programaFijo.programaId);
        else if (ps.length === 1) setProgramaId(ps[0].programaId);
      })
      .catch(() => {
        if (vivo) setError('No fue posible leer los programas. ¿Tiene permiso de coordinación?');
      });
    return () => {
      vivo = false;
    };
  }, []);

  // `programaFijo` de respaldo: la lista puede tardar en llegar, y sin esto la pantalla
  // parpadearia en "elija el programa" con el programa ya elegido.
  const programa = programas.find((p) => p.programaId === programaId) ?? programaFijo ?? null;

  /**
   * Las filas que se van a cruzar, con el nombre de centro que haya en pantalla (que puede
   * estar corregido a mano). Es lo que hace que editar el nombre cambie tambien el
   * `grupoId`, y no solo el rotulo.
   */
  const filas: FilaCentro[] = useMemo(
    () =>
      hojas.flatMap((h, i) =>
        h.filas.map((f) => ({ ...f, centro: (config[i]?.centro ?? h.centro).trim() })),
      ),
    [hojas, config],
  );

  function limpiarArchivo() {
    setNombreArchivo('');
    setHojas([]);
    setOmitidas([]);
    setConfig([]);
    setPrevia(null);
    setHecho(null);
    setError(null);
  }

  async function elegirArchivo(ev: React.ChangeEvent<HTMLInputElement>) {
    // `ev.target.files` es una referencia VIVA a la lista del input: al limpiar `value` se
    // vacia tambien. Se copia ANTES. (Ya nos costo una tarde en CargaFotos.)
    const elegidos = Array.from(ev.target.files ?? []);
    // Limpiar el valor permite volver a elegir EL MISMO archivo despues de corregirlo.
    ev.target.value = '';
    const f = elegidos[0];
    if (!f) return;

    setError(null);
    setPrevia(null);
    setHecho(null);
    setOcupado(true);
    try {
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(await f.arrayBuffer());
      const leido = leerArchivoCentros(
        wb.worksheets.map((ws) => ({ nombre: ws.name, matriz: matrizDeHoja(ws) })),
      );
      setNombreArchivo(f.name);
      setHojas(leido.hojas);
      setOmitidas(leido.hojasOmitidas);
      // Se rellena con el correo del titulo si venia. Sin esto, un archivo depurado que
      // SI trae los 21 correos obligaria a escribirlos otra vez a mano, uno por uno.
      setConfig(leido.hojas.map((h) => ({ centro: h.centro, correoLider: h.correoLider ?? '' })));
      if (leido.jornadaSugerida) setJornada(leido.jornadaSugerida);
    } catch (e) {
      limpiarArchivo();
      setError(
        e instanceof ArchivoCentrosNoReconocido
          ? e.message
          : `No fue posible leer el archivo: ${(e as Error).message}`,
      );
    } finally {
      setOcupado(false);
    }
  }

  function cambiarConfig(i: number, cambio: Partial<ConfigCentro>) {
    setConfig((c) => c.map((x, j) => (i === j ? { ...x, ...cambio } : x)));
    // Cualquier cambio invalida la vista previa: los ids de los centros dependen del
    // nombre, y enseñar un resumen que ya no corresponde a lo que se va a escribir es
    // exactamente lo que la vista previa existe para evitar.
    setPrevia(null);
  }

  async function previsualizar() {
    if (!programa) return;
    setOcupado(true);
    setError(null);
    try {
      const [matricula, grupos]: [Student[], GrupoPrograma[]] = await Promise.all([
        leerEstudiantesDeSede(programa.sede),
        // Con inactivos: un centro dado de baja EXISTE, y crearlo otra vez rebotaria.
        leerMisGruposDePrograma(programa.programaId, true),
      ]);
      if (matricula.length === 0) {
        setError(
          `No se pudo leer ningún estudiante de la sede «${programa.sede}». Sin matrícula ` +
            'todo el archivo caería en la bandeja como «no aparece en la matrícula».',
        );
        return;
      }

      const dec = aplicarDecisiones(
        filas,
        jornada === 'manana' ? DECISIONES_MANANA : DECISIONES_TARDE,
      );
      setPrevia({
        resultado: cruzarCentros(dec.filas, matricula, {
          programaId: programa.programaId,
          exclusivo: programa.exclusivo,
        }),
        grupoIds: grupoIdsPorCentro(dec.filas),
        existentes: new Set(grupos.map((g) => g.grupoId)),
        aplicadas: dec.aplicadas,
        sinUsar: dec.sinUsar,
        filasTrasDecisiones: dec.filas.length,
      });
    } catch (e) {
      setError(`No fue posible preparar la vista previa: ${(e as Error).message}`);
    } finally {
      setOcupado(false);
    }
  }

  async function confirmar() {
    if (!programa || !previa) return;
    setOcupado(true);
    setError(null);
    try {
      let creados = 0;
      let reutilizados = 0;

      for (const [centro, grupoId] of previa.grupoIds) {
        if (previa.existentes.has(grupoId)) {
          reutilizados += 1;
          continue;
        }
        const correo = correoDe(centro);
        try {
          await crearGrupoPrograma({
            programaId: programa.programaId,
            grupoId,
            nombre: centro,
            lider: correo,
          });
          creados += 1;
        } catch (e) {
          // Otra persona pudo crearlo mientras esta pantalla miraba. No es un fallo: el
          // centro existe, que es lo que se queria, y la inscripcion sigue adelante.
          if (e instanceof ConflictoError) reutilizados += 1;
          else throw e;
        }
      }

      // Una escritura por centro, con `arrayUnion`: reimportar no duplica miembros y no
      // pisa a quien haya inscrito alguien mas desde otra pantalla.
      let inscripciones = 0;
      for (const [grupoId, ids] of porGrupo(previa.resultado).entries()) {
        await inscribirEnGrupoPrograma(programa.programaId, grupoId, ids);
        inscripciones += ids.length;
      }

      const pendientes = await guardarPendientesPrograma(
        programa.programaId,
        previa.resultado.pendientes,
      );

      setHecho({ gruposCreados: creados, gruposReutilizados: reutilizados, inscripciones, pendientes });
      setPrevia(null);
      // Avisa a la pantalla de arriba para que recargue la lista de centros: los que
      // acaban de crearse no existen todavia en su estado.
      onTerminado?.();
    } catch (e) {
      setError(
        `La importación falló: ${(e as Error).message}. Lo que ya se escribió no se ` +
          'deshace, pero volver a cargar el mismo archivo actualiza en vez de duplicar.',
      );
    } finally {
      setOcupado(false);
    }
  }

  /** Correo del lider indicado en pantalla para ese centro. */
  function correoDe(centro: string): string {
    const i = config.findIndex((c) => c.centro.trim() === centro);
    return (config[i]?.correoLider ?? '').trim().toLowerCase();
  }

  // --- lo que falta antes de poder escribir ---------------------------------

  const centrosSinCorreo = previa
    ? [...previa.grupoIds.entries()]
        .filter(([centro, grupoId]) => !previa.existentes.has(grupoId) && !CORREO.test(correoDe(centro)))
        .map(([centro]) => centro)
    : [];

  const resumen = previa ? resumirImportCentros(previa.resultado) : null;
  const inscripcionesPorGrupo = useMemo(
    () => (previa ? porGrupo(previa.resultado) : new Map<string, string[]>()),
    [previa],
  );
  const inscripciones = [...inscripcionesPorGrupo.values()].reduce((n, ids) => n + ids.length, 0);
  const centrosNuevos = previa
    ? [...previa.grupoIds.values()].filter((id) => !previa.existentes.has(id)).length
    : 0;

  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-base font-semibold text-strong">
          Cargar las listas de centros de interés
        </h2>
        <p className="text-xs text-muted">
          Un archivo por jornada, una hoja por centro. El archivo se lee en este navegador y
          no se guarda nada hasta que usted apruebe la vista previa.
        </p>
      </div>

      <div
        className="rounded-xl border border-line bg-card p-3"
        hidden={Boolean(programaFijo)}
      >
        <label className="text-xs text-muted">Programa de destino</label>
        <select
          value={programaId}
          onChange={(ev) => {
            setProgramaId(ev.target.value);
            setPrevia(null);
            setHecho(null);
          }}
          className="mt-1 w-full rounded-lg border border-line bg-elevated px-2 py-2 text-sm"
        >
          <option value="">— elija el programa —</option>
          {programas.map((p) => (
            <option key={p.programaId} value={p.programaId}>
              {p.nombre} ({p.sede})
            </option>
          ))}
        </select>
        {programa && (
          <p className="mt-1 text-xs text-muted">
            Se cruzará contra la matrícula de la sede <b>{programa.sede}</b>.{' '}
            {programa.exclusivo
              ? 'Un estudiante solo puede estar en un centro: quien aparezca en dos quedará marcado y en la bandeja.'
              : 'Este programa permite que un estudiante esté en varios centros.'}
          </p>
        )}
        {programas.length === 0 && (
          <p className="mt-1 text-xs text-muted">
            No hay ningún programa que usted pueda ver. Hay que crearlo antes de cargar las
            listas.
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <label className="cursor-pointer rounded-lg border border-line bg-card px-3 py-2 text-sm text-strong">
          {hojas.length > 0 ? 'Elegir otro archivo…' : 'Seleccionar archivo…'}
          <input type="file" accept=".xlsx,.xls" hidden onChange={elegirArchivo} />
        </label>
        {nombreArchivo && (
          <>
            <span className="text-xs text-muted">{nombreArchivo}</span>
            <button
              onClick={limpiarArchivo}
              className="rounded-lg border border-line px-3 py-2 text-sm text-soft"
            >
              Quitar archivo
            </button>
          </>
        )}
      </div>

      {error && (
        <div className="rounded-xl border border-danger-soft bg-danger-soft p-3 text-sm text-danger-soft-fg">
          {error}
        </div>
      )}

      {hojas.length > 0 && (
        <>
          <div className="rounded-xl border border-line bg-card p-3 text-sm">
            <p className="text-strong">
              {hojas.length} centro(s) · {filas.length} estudiante(s) en el archivo
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <label className="text-xs text-muted">Jornada del archivo</label>
              <select
                value={jornada}
                onChange={(ev) => {
                  setJornada(ev.target.value as Jornada);
                  setPrevia(null);
                }}
                className="rounded-lg border border-line bg-elevated px-2 py-1 text-sm"
              >
                <option value="manana">Mañana</option>
                <option value="tarde">Tarde</option>
              </select>
              <span className="text-xs text-muted">
                Decide qué decisiones ya tomadas se aplican antes de preguntar nada. Se
                propone según los grados del archivo; cámbiela si no es la que dice.
              </span>
            </div>
          </div>

          {omitidas.length > 0 && (
            <div className="rounded-xl border border-warning-soft bg-warning-soft p-3 text-sm text-warning-soft-fg">
              <b>{omitidas.length} hoja(s) del archivo no se pudieron leer.</b>
              <ul className="mt-1 space-y-0.5 text-xs">
                {omitidas.map((o) => (
                  <li key={o.hoja}>
                    <b>{o.hoja}</b>: {o.motivo}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="overflow-x-auto rounded-xl border border-line bg-card">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted">
                  <th className="p-2">Hoja</th>
                  <th className="p-2">Centro de interés</th>
                  <th className="p-2">Líder</th>
                  <th className="p-2">Correo del líder</th>
                  <th className="p-2">Filas</th>
                </tr>
              </thead>
              <tbody>
                {hojas.map((h, i) => (
                  <tr key={h.hoja} className="border-t border-line align-top">
                    <td className="p-2 text-xs text-muted">{h.hoja}</td>
                    <td className="p-2">
                      <input
                        value={config[i]?.centro ?? ''}
                        onChange={(ev) => cambiarConfig(i, { centro: ev.target.value })}
                        className="w-full min-w-48 rounded-lg border border-line bg-elevated px-2 py-1 text-sm text-strong"
                      />
                      {h.avisos.map((a) => (
                        <p key={a} className="mt-1 text-xs text-warning-soft-fg">
                          {a}
                        </p>
                      ))}
                    </td>
                    <td className="p-2 text-xs text-soft">
                      {h.lider || <span className="text-muted">— sin leer —</span>}
                    </td>
                    <td className="p-2">
                      <input
                        type="email"
                        placeholder="correo@iejosemariabernal.edu.co"
                        value={config[i]?.correoLider ?? ''}
                        onChange={(ev) => cambiarConfig(i, { correoLider: ev.target.value })}
                        className="w-full min-w-56 rounded-lg border border-line bg-elevated px-2 py-1 text-sm"
                      />
                    </td>
                    <td className="p-2 text-strong">{h.filas.length}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-muted">
            El archivo trae el <b>nombre</b> del líder, no su correo, y a veces ni eso. El
            correo es lo único con lo que las reglas pueden dejar entrar a alguien a su
            propio centro, así que hay que escribirlo. Los centros que ya existan en el
            programa no lo necesitan.
          </p>

          <div className="flex flex-wrap gap-2">
            <button
              disabled={ocupado || !programa}
              onClick={() => void previsualizar()}
              className="rounded-lg bg-accent px-3 py-2 text-sm font-medium text-accent-fg disabled:opacity-50"
            >
              {ocupado ? 'Trabajando…' : 'Previsualizar (no escribe nada)'}
            </button>
            {previa && centrosSinCorreo.length === 0 && (
              <button
                disabled={ocupado}
                onClick={() => void confirmar()}
                className="rounded-lg border border-line px-3 py-2 text-sm text-strong disabled:opacity-50"
              >
                Confirmar y cargar
              </button>
            )}
          </div>
        </>
      )}

      {previa && resumen && (
        <>
          <div className="rounded-xl border border-info-soft bg-info-soft p-3 text-sm text-info-soft-fg">
            <b>Vista previa — todavía no se ha escrito nada.</b>
            <br />
            Crearía <b>{centrosNuevos}</b> centro(s) · inscribiría <b>{inscripciones}</b>{' '}
            estudiante(s) · <b>{resumen.pendientes}</b> quedan por confirmar.
            {previa.grupoIds.size - centrosNuevos > 0 && (
              <>
                {' '}
                Otros <b>{previa.grupoIds.size - centrosNuevos}</b> centro(s) ya existen: se
                les añade la gente que falte, sin tocar a la que ya estaba.
              </>
            )}
          </div>

          {resumen.pendientes > 0 && (
            <div className="rounded-xl border border-line bg-card p-3 text-sm">
              <p className="font-semibold text-strong">
                {resumen.pendientes} caso(s) para la bandeja de revisión
              </p>
              <p className="mt-1 text-xs text-muted">
                No se descarta ninguno. Cada uno queda con sus candidatos y con la propuesta
                ya marcada, para resolverlo con un clic.
              </p>
              <ul className="mt-2 space-y-0.5 text-xs text-soft">
                {(Object.keys(ETIQUETA_TIPO) as (keyof typeof ETIQUETA_TIPO)[])
                  .filter((t) => resumen.porTipo[t] > 0)
                  .map((t) => (
                    <li key={t}>
                      <b>{resumen.porTipo[t]}</b> · {ETIQUETA_TIPO[t]}
                    </li>
                  ))}
              </ul>
            </div>
          )}

          {(resumen.conGradoDistinto > 0 || resumen.conJornadaDistinta > 0) && (
            <details className="rounded-xl border border-warning-soft bg-warning-soft p-3 text-sm text-warning-soft-fg">
              <summary className="cursor-pointer font-semibold">
                {resumen.conGradoDistinto} estudiante(s) están en otro grado del que dice el
                archivo
                {resumen.conJornadaDistinta > 0 && (
                  <> · {resumen.conJornadaDistinta} incluso en la otra jornada</>
                )}
              </summary>
              <p className="mt-1 text-xs">
                Se inscriben igual: <b>manda la matrícula, no el archivo</b>. Se muestran
                porque un salto de jornada casi nunca es un traslado — suele ser una fila
                copiada de otra hoja — y eso lo tiene que ver una persona.
              </p>
              <ul className="mt-2 space-y-0.5 text-xs">
                {previa.resultado.resueltos
                  .filter((r) => r.gradoDistinto || r.jornadaDistinta)
                  .slice(0, 40)
                  .map((r) => (
                    <li key={`${r.grupoId}-${r.studentId}`}>
                      {r.nombreArchivo} · el archivo decía <b>{r.grupoArchivo || '—'}</b>, la
                      matrícula dice <b>{r.gradoMatricula}</b>
                      {r.jornadaDistinta && <> · otra jornada</>} · {r.centro}
                    </li>
                  ))}
              </ul>
            </details>
          )}

          {resumen.conConflicto > 0 && (
            <div className="rounded-xl border border-danger-soft bg-danger-soft p-3 text-sm text-danger-soft-fg">
              <b>{resumen.conConflicto} inscripción(es) de estudiantes que aparecen en dos centros.</b>{' '}
              Se cargan en los <b>dos</b> a propósito, marcadas, en vez de escoger una al
              azar: así ninguno de los dos líderes se queda sin poder llamarlos a lista
              mientras usted decide. El caso queda en la bandeja como «duplicado».
            </div>
          )}

          <div className="overflow-x-auto rounded-xl border border-line bg-card">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted">
                  <th className="p-2">Centro</th>
                  <th className="p-2">Identificador</th>
                  <th className="p-2">Se crea</th>
                  <th className="p-2">Inscribe</th>
                  <th className="p-2">Por confirmar</th>
                </tr>
              </thead>
              <tbody>
                {[...previa.grupoIds.entries()].map(([centro, grupoId]) => {
                  const nuevo = !previa.existentes.has(grupoId);
                  return (
                    <tr key={grupoId} className="border-t border-line">
                      <td className="p-2 text-strong">{centro}</td>
                      <td className="p-2 text-xs text-muted">{grupoId}</td>
                      <td className="p-2 text-xs">
                        {nuevo ? (
                          CORREO.test(correoDe(centro)) ? (
                            <span className="text-soft">nuevo · {correoDe(centro)}</span>
                          ) : (
                            <span className="text-danger-soft-fg">falta el correo del líder</span>
                          )
                        ) : (
                          <span className="text-muted">ya existe</span>
                        )}
                      </td>
                      <td className="p-2">
                        {(inscripcionesPorGrupo.get(grupoId) ?? []).length}
                      </td>
                      <td className="p-2">
                        {previa.resultado.pendientes.filter((p) => p.grupoId === grupoId).length}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {centrosSinCorreo.length > 0 && (
            <div className="rounded-xl border border-danger-soft bg-danger-soft p-3 text-sm text-danger-soft-fg">
              <b>Falta el correo del líder de {centrosSinCorreo.length} centro(s) nuevo(s):</b>{' '}
              {centrosSinCorreo.join(', ')}. Sin él, el centro se crearía sin nadie que
              pueda abrirlo.
            </div>
          )}

          <details className="rounded-xl border border-line bg-card p-3">
            <summary className="cursor-pointer text-sm font-semibold text-strong">
              Decisiones ya tomadas que se aplicaron: {previa.aplicadas.length}
              {previa.sinUsar.length > 0 && ` · ${previa.sinUsar.length} sin usar`}
            </summary>
            <p className="mt-1 text-xs text-muted">
              Casos que ya se resolvieron una vez y que no se vuelven a preguntar. De{' '}
              {filas.length} filas quedan {previa.filasTrasDecisiones} para cruzar.
            </p>
            <ul className="mt-2 space-y-0.5 text-xs text-soft">
              {previa.aplicadas.map((a) => (
                <li key={a.decision.nombreArchivo}>
                  <b>{a.decision.nombreArchivo}</b> · {a.decision.accion.replace(/_/g, ' ')} ·{' '}
                  {a.decision.motivo}
                </li>
              ))}
            </ul>
            {previa.sinUsar.length > 0 && (
              <>
                <p className="mt-2 text-xs text-warning-soft-fg">
                  Estas decisiones no encontraron su fila en este archivo: o son de la otra
                  jornada, o el nombre no está escrito igual que en el Excel. Sus casos se
                  van a preguntar otra vez en la bandeja. No se aplican «por parecido»: usar
                  la decisión de una persona con otra es peor que volver a preguntar.
                </p>
                <ul className="mt-1 space-y-0.5 text-xs text-soft">
                  {previa.sinUsar.map((d) => (
                    <li key={d.nombreArchivo}>{d.nombreArchivo}</li>
                  ))}
                </ul>
              </>
            )}
          </details>
        </>
      )}

      {hecho && (
        <div className="rounded-xl border border-success-soft bg-success-soft p-3 text-sm text-success-soft-fg">
          <b>Listas cargadas.</b> {hecho.gruposCreados} centro(s) creados,{' '}
          {hecho.gruposReutilizados} ya existían, {hecho.inscripciones} inscripción(es) y{' '}
          {hecho.pendientes} caso(s) en la bandeja de revisión.
          <br />
          Si el archivo tenía errores, corríjalo y vuelva a cargarlo: se actualiza, no se
          duplica.
        </div>
      )}
    </div>
  );
}

/**
 * Inscripciones por centro, sin repetidos.
 *
 * El archivo real trae la misma fila dos veces alguna vez; `arrayUnion` lo resolveria
 * igual, pero entonces el numero que se enseña en la vista previa no seria el numero de
 * personas que se van a inscribir, y esa es toda la utilidad de la vista previa.
 */
function porGrupo(resultado: ResultadoImportCentros): Map<string, string[]> {
  const mapa = new Map<string, Set<string>>();
  for (const r of resultado.resueltos) {
    const ya = mapa.get(r.grupoId);
    if (ya) ya.add(r.studentId);
    else mapa.set(r.grupoId, new Set([r.studentId]));
  }
  return new Map([...mapa].map(([grupoId, ids]) => [grupoId, [...ids]]));
}
