import { useEffect, useMemo, useState } from 'react';
import ExcelJS from 'exceljs';
import { Upload } from 'lucide-react';
import {
  ArchivoInscritosNoReconocido,
  cruzarInscritos,
  ETIQUETA_SERVICIO,
  leerArchivoInscritos,
  resumirInscritos,
  type FilaInscrito,
  type HojaInscritos,
  type HojaOmitidaInscritos,
  type MotivoNoUbicado,
} from './domain/parse-inscritos-restaurante';
import { guardarInscritosRestaurante, leerEstudiantesDeSede } from './datos';
import { nombreCompleto } from './domain/nombres';
import type { Sede, ServicioRestaurante, Student } from './domain/types';

/**
 * Carga de la lista OFICIAL de inscritos al restaurante / vaso de leche.
 *
 * El molde es `ImportarCentros.tsx` y la regla es la misma, que es la que de verdad
 * importa: **vista previa obligatoria, y no se escribe nada hasta que la persona
 * aprueba**. El reparto de trabajo tambien:
 *   - `domain/parse-inscritos-restaurante.ts` convierte las hojas en filas y las cruza
 *     contra la matricula (logica pura, con pruebas);
 *   - esta pantalla solo lee el archivo, pregunta, enseña y, al final, escribe.
 *
 * ESTA LISTA NO RESTRINGE A NADIE. No decide quien puede pasar por la fila del refrigerio
 * —la comida que sobra se le da a quien este ahi— y por eso aqui no hay ningun control de
 * cupo. Existe unicamente para poder CONTRASTAR despues, en el reporte, quien uso el
 * servicio y quien no.
 *
 * REIMPORTAR LA MISMA LISTA ACTUALIZA, NO DUPLICA: el `inscritoId` es determinista
 * (`{anio}_{sede}_{studentId}`) y `guardarInscritosRestaurante` escribe con `setDoc`.
 * Corregir dos filas del Excel y volver a cargarlo es una operacion segura.
 *
 * `exceljs` entra aqui con un `import` normal —la pantalla no sirve para nada sin el—, asi
 * que este componente tiene que cablearse con `lazy()` desde `index.tsx`, igual que
 * `Importar` y `DireccionGrupo`. De otro modo arrastraria un mega al paquete inicial de
 * todo el modulo.
 */

const SEDES: { valor: Sede; etiqueta: string }[] = [
  { valor: 'central', etiqueta: 'Central' },
  { valor: 'gustavo_rodas', etiqueta: 'Gustavo Rodas' },
  { valor: 'la_finquita', etiqueta: 'La Finquita' },
];

const ETIQUETA_MOTIVO: Record<MotivoNoUbicado, string> = {
  no_encontrado: 'No aparece en la matrícula',
  homonimo: 'Dos personas posibles',
  ortografia: 'El nombre no coincide del todo',
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

export default function ImportarInscritosRestaurante({
  sedeInicial = 'central',
  onTerminado,
}: {
  sedeInicial?: Sede;
  onTerminado?: () => void;
} = {}) {
  const [servicio, setServicio] = useState<ServicioRestaurante>('restaurante');
  const [sede, setSede] = useState<Sede>(sedeInicial);
  const [anio, setAnio] = useState(new Date().getFullYear());

  const [nombreArchivo, setNombreArchivo] = useState('');
  const [hojas, setHojas] = useState<HojaInscritos[]>([]);
  const [omitidas, setOmitidas] = useState<HojaOmitidaInscritos[]>([]);

  /** La matricula de la sede. `null` = todavia no se ha pedido la vista previa. */
  const [matricula, setMatricula] = useState<Student[] | null>(null);
  /** Fila del archivo (por indice) -> studentId que eligio la persona. */
  const [aceptados, setAceptados] = useState<Map<number, string>>(new Map());

  const [hecho, setHecho] = useState<{ inscritos: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const filas: FilaInscrito[] = useMemo(() => hojas.flatMap((h) => h.filas), [hojas]);

  /**
   * La vista previa se RECALCULA en el navegador cada vez que alguien resuelve un caso a
   * mano, sin volver a Firestore. Si hubiera que pedir de nuevo la matricula por cada
   * decision, el titular iria siempre un paso por detras de lo que se ve en pantalla, que
   * es justo lo que la vista previa existe para evitar.
   */
  const previa = useMemo(
    () =>
      matricula ? cruzarInscritos(filas, matricula, { sede, anio, servicio }, aceptados) : null,
    [matricula, filas, sede, anio, servicio, aceptados],
  );
  const resumen = previa ? resumirInscritos(previa) : null;

  /** Nombre de la matricula, para enseñar a quien se va a inscribir de verdad. */
  const nombreDe = useMemo(() => {
    const mapa = new Map<string, string>();
    for (const e of matricula ?? []) mapa.set(e.studentId, `${nombreCompleto(e)} · ${e.gradoActual}`);
    return mapa;
  }, [matricula]);

  // Cambiar de sede invalida la matricula leida: cruzar contra la de otra sede daria un
  // «no aparece en la matricula» para todo el archivo sin ninguna explicacion visible.
  useEffect(() => {
    setMatricula(null);
    setAceptados(new Map());
    setHecho(null);
  }, [sede]);

  function limpiarArchivo() {
    setNombreArchivo('');
    setHojas([]);
    setOmitidas([]);
    setMatricula(null);
    setAceptados(new Map());
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
    setMatricula(null);
    setAceptados(new Map());
    setHecho(null);
    setOcupado(true);
    try {
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(await f.arrayBuffer());
      const leido = leerArchivoInscritos(
        wb.worksheets.map((ws) => ({ nombre: ws.name, matriz: matrizDeHoja(ws) })),
      );
      setNombreArchivo(f.name);
      setHojas(leido.hojas);
      setOmitidas(leido.hojasOmitidas);
    } catch (e) {
      limpiarArchivo();
      setError(
        e instanceof ArchivoInscritosNoReconocido
          ? e.message
          : `No fue posible leer el archivo: ${(e as Error).message}`,
      );
    } finally {
      setOcupado(false);
    }
  }

  async function previsualizar() {
    setOcupado(true);
    setError(null);
    try {
      const ms = await leerEstudiantesDeSede(sede);
      if (ms.length === 0) {
        setError(
          `No se pudo leer ningún estudiante de la sede «${sede}». Sin matrícula, todo el ` +
            'archivo caería como «no aparece en la matrícula».',
        );
        return;
      }
      setMatricula(ms);
    } catch (e) {
      setError(`No fue posible preparar la vista previa: ${(e as Error).message}`);
    } finally {
      setOcupado(false);
    }
  }

  async function confirmar() {
    if (!previa) return;
    setOcupado(true);
    setError(null);
    try {
      await guardarInscritosRestaurante(previa.inscritos);
      setHecho({ inscritos: previa.inscritos.length });
      setMatricula(null);
      setAceptados(new Map());
      onTerminado?.();
    } catch (e) {
      setError(
        `La carga falló: ${(e as Error).message}. Lo que ya se escribió no se deshace, ` +
          'pero volver a cargar el mismo archivo actualiza en vez de duplicar.',
      );
    } finally {
      setOcupado(false);
    }
  }

  function elegirCandidato(indice: number, studentId: string) {
    setAceptados((m) => {
      const copia = new Map(m);
      if (studentId) copia.set(indice, studentId);
      else copia.delete(indice);
      return copia;
    });
  }

  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-base font-semibold text-strong">
          Cargar la lista oficial de inscritos
        </h2>
        <p className="text-xs text-muted">
          Una lista por servicio. El archivo se lee en este navegador y no se guarda nada
          hasta que usted apruebe la vista previa.
        </p>
      </div>

      <div className="rounded-xl border border-info-soft bg-info-soft p-3 text-xs text-info-soft-fg">
        Esta lista <b>no restringe a nadie</b>: no decide quién puede pasar por la fila. La
        comida que sobra se le da a quien esté ahí. Sirve únicamente para poder contrastar
        después, en el reporte, quiénes usaron el servicio y quiénes no.
      </div>

      <div className="grid gap-2 rounded-xl border border-line bg-card p-3 sm:grid-cols-3">
        <div>
          <label className="text-xs text-muted" htmlFor="inscritos-servicio">
            Servicio de esta lista
          </label>
          <select
            id="inscritos-servicio"
            value={servicio}
            onChange={(ev) => {
              setServicio(ev.target.value as ServicioRestaurante);
              setHecho(null);
            }}
            className="mt-1 w-full rounded-lg border border-line bg-elevated px-2 py-2 text-sm text-strong"
          >
            <option value="restaurante">{ETIQUETA_SERVICIO.restaurante}</option>
            <option value="vaso_leche">{ETIQUETA_SERVICIO.vaso_leche}</option>
          </select>
        </div>
        <div>
          <label className="text-xs text-muted" htmlFor="inscritos-sede">
            Sede
          </label>
          <select
            id="inscritos-sede"
            value={sede}
            onChange={(ev) => setSede(ev.target.value as Sede)}
            className="mt-1 w-full rounded-lg border border-line bg-elevated px-2 py-2 text-sm text-strong"
          >
            {SEDES.map((s) => (
              <option key={s.valor} value={s.valor}>
                {s.etiqueta}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs text-muted" htmlFor="inscritos-anio">
            Año
          </label>
          <input
            id="inscritos-anio"
            type="number"
            value={anio}
            onChange={(ev) => {
              setAnio(Number(ev.target.value));
              setHecho(null);
            }}
            className="mt-1 w-full rounded-lg border border-line bg-elevated px-2 py-2 text-sm text-strong"
          />
        </div>
      </div>

      <div className="rounded-xl border border-warning-soft bg-warning-soft p-3 text-xs text-warning-soft-fg">
        <b>Un estudiante tiene una sola inscripción por año y sede.</b> Si alguien aparece en
        las dos listas, la que se cargue después manda y queda registrado en ese servicio.
        No pierde nada: puede pasar por los dos igual, y el reporte lo mostrará aparte, como
        «inscritos que usaron el otro servicio».
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <label className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-line bg-card px-3 py-2 text-sm text-strong">
          <Upload size={16} aria-hidden />
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
              {hojas.length} hoja(s) · {filas.length} fila(s) con nombre en el archivo
            </p>
            <ul className="mt-1 space-y-0.5 text-xs text-muted">
              {hojas.map((h) => (
                <li key={h.hoja}>
                  <b>{h.hoja}</b>: {h.filas.length} fila(s), encabezados en la fila{' '}
                  {h.filaEncabezados + 1}
                  {h.avisos.map((a) => (
                    <span key={a} className="block text-warning-soft-fg">
                      {a}
                    </span>
                  ))}
                </li>
              ))}
            </ul>
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

          <div className="flex flex-wrap gap-2">
            <button
              disabled={ocupado}
              onClick={() => void previsualizar()}
              className="rounded-lg bg-accent px-3 py-2 text-sm font-medium text-accent-fg disabled:opacity-50"
            >
              {ocupado ? 'Trabajando…' : 'Previsualizar (no escribe nada)'}
            </button>
            {previa && previa.inscritos.length > 0 && (
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
            Inscribiría <b>{resumen.inscribiria}</b> estudiante(s) en{' '}
            <b>{ETIQUETA_SERVICIO[servicio]}</b> · <b>{resumen.sinResolver}</b> no se
            pudieron ubicar.
            {resumen.repetidos > 0 && (
              <>
                {' '}
                Otras <b>{resumen.repetidos}</b> fila(s) traían a alguien que ya estaba en la
                lista: se inscribe una sola vez.
              </>
            )}
          </div>

          {previa.noUbicados.length > 0 && (
            <div className="rounded-xl border border-line bg-card p-3 text-sm">
              <p className="font-semibold text-strong">
                {previa.noUbicados.length} fila(s) que el sistema no ubica solo
              </p>
              <p className="mt-1 text-xs text-muted">
                No se descarta ninguna. Cada una viene con los estudiantes que se le
                parecen: elija usted, o déjela sin inscribir y corrija el Excel. La
                propuesta del sistema <b>nunca</b> se aplica sola — inscribir a quien no es
                haría que el reporte le dijera al proveedor una cosa por otra.
              </p>
              <ul className="mt-1 space-y-0.5 text-xs text-soft">
                {(Object.keys(ETIQUETA_MOTIVO) as MotivoNoUbicado[])
                  .filter((m) => resumen.porMotivo[m] > 0)
                  .map((m) => (
                    <li key={m}>
                      <b>{resumen.porMotivo[m]}</b> · {ETIQUETA_MOTIVO[m]}
                    </li>
                  ))}
              </ul>

              <div className="mt-2 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-muted">
                      <th className="p-2">Nombre en el archivo</th>
                      <th className="p-2">Grupo del archivo</th>
                      <th className="p-2">Situación</th>
                      <th className="p-2">A quién corresponde</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previa.noUbicados.map((n) => (
                      <tr key={n.indice} className="border-t border-line align-top">
                        <td className="p-2 text-strong">{n.nombreArchivo}</td>
                        <td className="p-2 text-xs text-muted">{n.grupoArchivo || '—'}</td>
                        <td className="p-2 text-xs text-soft">{ETIQUETA_MOTIVO[n.motivo]}</td>
                        <td className="p-2">
                          {n.candidatos.length === 0 ? (
                            <span className="text-xs text-muted">
                              Ningún parecido. Corrija el nombre en el Excel y vuelva a
                              cargarlo.
                            </span>
                          ) : (
                            <select
                              value={aceptados.get(n.indice) ?? ''}
                              onChange={(ev) => elegirCandidato(n.indice, ev.target.value)}
                              className="w-full min-w-56 rounded-lg border border-line bg-elevated px-2 py-1 text-sm"
                            >
                              <option value="">— no inscribir —</option>
                              {n.candidatos.map((c) => (
                                <option key={c.studentId} value={c.studentId}>
                                  {c.nombre} · {c.grado}
                                  {c.studentId === n.sugerido ? ' (propuesta)' : ''}
                                </option>
                              ))}
                            </select>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <details className="rounded-xl border border-line bg-card p-3">
            <summary className="cursor-pointer text-sm font-semibold text-strong">
              Los {previa.ubicados.length} que sí se ubicaron
            </summary>
            <p className="mt-1 text-xs text-muted">
              Se guarda el grado de la <b>matrícula</b>, nunca el del archivo. Si no
              coinciden se muestra aquí: casi siempre es un traslado que el archivo no
              recogió.
            </p>
            <ul className="mt-2 space-y-0.5 text-xs text-soft">
              {previa.ubicados.slice(0, 200).map((u) => (
                <li key={u.studentId}>
                  {nombreDe.get(u.studentId) ?? u.studentId}
                  {u.gradoDistinto && (
                    <span className="text-warning-soft-fg">
                      {' '}
                      · el archivo decía <b>{u.grupoArchivo || '—'}</b>
                    </span>
                  )}
                </li>
              ))}
              {previa.ubicados.length > 200 && (
                <li className="text-muted">… y {previa.ubicados.length - 200} más.</li>
              )}
            </ul>
          </details>
        </>
      )}

      {hecho && (
        <div className="rounded-xl border border-success-soft bg-success-soft p-3 text-sm text-success-soft-fg">
          <b>Lista cargada.</b> {hecho.inscritos} inscripción(es) en{' '}
          {ETIQUETA_SERVICIO[servicio]}. Si el archivo tenía errores, corríjalo y vuelva a
          cargarlo: se actualiza, no se duplica.
        </div>
      )}
    </div>
  );
}
