import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  buscarEstudiantes,
  leerEstudiantesDeSede,
  leerMisGruposDePrograma,
  leerSesionesPrograma,
} from './datos';
import Avatar from './Avatar';
import {
  coberturaPrograma,
  estadisticaPrograma,
  type ConteoCobertura,
  type EstadisticaProgramaTotal,
} from './domain/programas';
import { nombreCompleto } from './domain/nombres';
import { jornadaDeGrado } from './domain/ids';
import type { Hoja } from './domain/exports';
import type { GrupoPrograma, Jornada, SesionPrograma, Student } from './domain/types';
import { Download, Search } from 'lucide-react';

/**
 * Panel de coordinacion de un programa — la pantalla de Yuri.
 *
 * Tres preguntas, en el orden en que ella las hace:
 *   1. ¿A quien me falta por inscribir? (cobertura, y sobre todo LA LISTA de los que no
 *      estan en ninguno: es su lista de trabajo, la que se lleva en la mano al salon)
 *   2. ¿Como va la asistencia de cada centro?
 *   3. ¿Y este muchacho en particular, donde esta y como va?
 *
 * REGLA DE ORO, y por eso el numero de sesiones va SIEMPRE al lado de cada porcentaje:
 * el denominador son las SESIONES REGISTRADAS, jamas el calendario. Un 92% sobre tres
 * sesiones registradas de las doce del semestre no dice lo mismo que un 92% sobre doce, y
 * sin el numero al lado las dos cifras se leen igual.
 *
 * `exceljs` pesa cerca de un mega y solo hace falta si alguien pulsa "Descargar": se
 * carga con `import()` dentro del propio manejador, no arriba. Es el mismo motivo por el
 * que `Importar` y `DireccionGrupo` van con `lazy()` desde index.tsx — solo que aqui el
 * peso se puede aislar sin depender de como se cablee el componente.
 */
export default function PanelPrograma({
  programaId,
  sede,
  jornada,
}: {
  programaId: string;
  sede: string;
  /**
   * Jornada del programa, si declara una. Decide el DENOMINADOR de la cobertura: contra
   * los 364 de la tarde, no contra los 688 de la sede. Sin esto la cifra mete en el
   * "sin centro de interes" a los de la otra jornada, que si tienen — paso en produccion.
   */
  jornada?: Jornada;
}) {
  const [grupos, setGrupos] = useState<GrupoPrograma[]>([]);
  const [matriculados, setMatriculados] = useState<Student[]>([]);
  const [sesionesPorGrupo, setSesionesPorGrupo] = useState<Record<string, SesionPrograma[]>>({});
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    void (async () => {
      try {
        const [gs, ms] = await Promise.all([
          leerMisGruposDePrograma(programaId),
          leerEstudiantesDeSede(sede),
        ]);
        if (!vivo) return;
        setGrupos(gs);
        setMatriculados(ms);

        // Las sesiones se piden por grupo porque cuelgan de su ruta. En paralelo: son
        // veintiuna consultas pequenas y en serie la pantalla tardaria veintiun viajes.
        const listas = await Promise.all(
          gs.map(async (g) => [g.grupoId, await leerSesionesPrograma(programaId, g.grupoId)] as const),
        );
        if (!vivo) return;
        setSesionesPorGrupo(Object.fromEntries(listas));
      } catch (e) {
        if (vivo) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (vivo) setCargando(false);
      }
    })();
    return () => {
      vivo = false;
    };
  }, [programaId, sede]);

  const cobertura = useMemo(
    () => coberturaPrograma(matriculados, grupos, jornada),
    [matriculados, grupos, jornada],
  );

  const estadistica = useMemo(
    () =>
      estadisticaPrograma(
        grupos.map((g) => ({ grupo: g, sesiones: sesionesPorGrupo[g.grupoId] ?? [] })),
      ),
    [grupos, sesionesPorGrupo],
  );

  if (cargando) {
    return <p className="p-3 text-sm text-muted">Cargando el panel del programa…</p>;
  }

  return (
    <div className="space-y-4">
      {error && (
        <p className="rounded-lg border border-danger-soft bg-danger-soft p-2 text-sm text-danger-soft-fg">
          {error}
        </p>
      )}

      <Cobertura cobertura={cobertura} />
      <AsistenciaPorCentro estadistica={estadistica} grupos={grupos} />
      <BuscadorDelPanel
        sede={sede}
        grupos={grupos}
        estadistica={estadistica}
        sesionesPorGrupo={sesionesPorGrupo}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
//  1. Cobertura — y la lista de los que faltan
// ---------------------------------------------------------------------------

function Barra({ c }: { c: ConteoCobertura }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-elevated">
      <div
        className="h-full rounded-full bg-accent"
        style={{ width: `${Math.min(100, c.porcentaje)}%` }}
      />
    </div>
  );
}

function FilaConteo({ etiqueta, c }: { etiqueta: string; c: ConteoCobertura }) {
  return (
    <div className="space-y-1 rounded-lg border border-line p-2">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-semibold text-strong">{etiqueta}</span>
        <span className="text-xs text-muted">
          {c.inscritos}/{c.total} · {c.porcentaje}%
        </span>
      </div>
      <Barra c={c} />
      {c.sinInscribir > 0 && (
        <p className="text-xs text-muted">Faltan {c.sinInscribir} por inscribir.</p>
      )}
    </div>
  );
}

function Cobertura({ cobertura }: { cobertura: ReturnType<typeof coberturaPrograma> }) {
  const [verFaltantes, setVerFaltantes] = useState(false);
  const [descargando, setDescargando] = useState(false);
  const [fallo, setFallo] = useState<string | null>(null);

  // La lista de trabajo va agrupada POR GRUPO, no por orden alfabetico global: a quien
  // hay que inscribir se le busca yendo a su salon, y un listado alfabetico obliga a
  // recorrerlo entero por cada salon.
  const porGrupo = useMemo(() => {
    const mapa = new Map<string, Student[]>();
    for (const e of cobertura.faltantes) {
      const lista = mapa.get(e.gradoActual) ?? [];
      lista.push(e);
      mapa.set(e.gradoActual, lista);
    }
    return [...mapa.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [cobertura.faltantes]);

  const gradosOrdenados = useMemo(
    () => Object.entries(cobertura.porGrado).sort((a, b) => a[0].localeCompare(b[0])),
    [cobertura.porGrado],
  );

  async function descargar() {
    setDescargando(true);
    setFallo(null);
    try {
      const hoja = hojaFaltantes(porGrupo, cobertura);
      // Import dinamico: `exceljs` no entra en el paquete inicial. Ver la cabecera.
      const { default: ExcelJS } = await import('exceljs');
      const wb = new ExcelJS.Workbook();
      // Excel no admite nombres de hoja de mas de 31 caracteres.
      const ws = wb.addWorksheet(hoja.nombre.slice(0, 31));
      ws.addRow(hoja.encabezados);
      for (const fila of hoja.filas) ws.addRow(fila);
      ws.addRow([]);
      for (const nota of hoja.notas) ws.addRow([nota]);

      const buffer = await wb.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${hoja.nombre}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setFallo(e instanceof Error ? e.message : String(e));
    } finally {
      setDescargando(false);
    }
  }

  return (
    <section className="rounded-xl border border-line bg-card p-3">
      <h3 className="text-sm font-semibold text-strong">Cobertura</h3>
      <p className="text-xs text-muted">
        Cuántos matriculados están en algún centro de interés y cuántos no. Solo cuentan
        los estudiantes activos y los centros activos.
      </p>

      <div className="mt-2 rounded-lg border border-accent bg-accent-soft p-2">
        <p className="text-sm text-strong">
          <b>{cobertura.inscritos}</b> de <b>{cobertura.total}</b> matriculados están en un
          centro de interés — <b>{cobertura.porcentaje}%</b>.
        </p>
        <p className="text-xs text-accent-soft-fg">
          Quedan <b>{cobertura.sinInscribir}</b> sin centro.
        </p>
      </div>

      <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
        <FilaConteo etiqueta="Jornada de la mañana" c={cobertura.porJornada.manana} />
        <FilaConteo etiqueta="Jornada de la tarde" c={cobertura.porJornada.tarde} />
      </div>

      <details className="mt-2">
        <summary className="cursor-pointer text-sm text-soft">Ver grado por grado</summary>
        <div className="mt-1.5 grid gap-1.5 sm:grid-cols-2">
          {gradosOrdenados.map(([grado, c]) => (
            <FilaConteo key={grado} etiqueta={grado} c={c} />
          ))}
        </div>
      </details>

      {/* Lo mas util de todo el panel: a estos hay que salir a inscribirlos. */}
      <div className="mt-3 rounded-xl border border-line bg-elevated p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-sm font-semibold text-strong">
              Los que no están en ningún centro ({cobertura.faltantes.length})
            </p>
            <p className="text-xs text-muted">Agrupados por grupo: es a quienes hay que ir a buscar.</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setVerFaltantes((v) => !v)}
              className="rounded-lg border border-line px-3 py-1.5 text-sm text-soft"
            >
              {verFaltantes ? 'Ocultar' : 'Ver la lista'}
            </button>
            <button
              onClick={() => void descargar()}
              disabled={descargando || cobertura.faltantes.length === 0}
              className="flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-accent-fg disabled:opacity-50"
            >
              <Download size={16} aria-hidden />
              {descargando ? 'Generando…' : 'Descargar'}
            </button>
          </div>
        </div>

        {fallo && <p className="mt-2 text-xs text-danger">{fallo}</p>}

        {verFaltantes && (
          <div className="mt-2 space-y-2">
            {porGrupo.length === 0 && (
              <p className="text-sm text-success-soft-fg">
                Ninguno: todos los matriculados están en algún centro.
              </p>
            )}
            {porGrupo.map(([grado, lista]) => (
              <div key={grado} className="rounded-lg border border-line bg-card p-2">
                <p className="text-sm font-semibold text-strong">
                  {grado} <span className="font-normal text-muted">· {lista.length} sin centro</span>
                </p>
                <ul className="mt-1 space-y-0.5">
                  {lista.map((e) => (
                    <li key={e.studentId} className="flex items-center gap-2">
                      <Avatar estudiante={e} tamano={24} />
                      <span className="truncate text-sm text-soft">{nombreCompleto(e)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

/**
 * La hoja de los faltantes. Se arma aqui, con la forma `Hoja` de `domain/exports.ts`,
 * porque es una lista de trabajo de ESTE panel y no una exportacion del registro oficial
 * del colegio — las de `exports.ts` estan ahi para poder probarse sin generar binarios,
 * y esta no transcribe ninguna cifra a Master2000.
 *
 * Ningun documento de identidad, ni en claro ni en hash: son menores y para ir a buscar a
 * alguien a su salon basta con el nombre y el grupo.
 */
function hojaFaltantes(
  porGrupo: [string, Student[]][],
  cobertura: ReturnType<typeof coberturaPrograma>,
): Hoja {
  return {
    nombre: 'Sin centro de interes',
    encabezados: ['Grupo', 'Jornada', 'Estudiante'],
    filas: porGrupo.flatMap(([grado, lista]) =>
      lista.map((e) => [
        grado,
        jornadaDeGrado(grado) === 'manana' ? 'Mañana' : 'Tarde',
        nombreCompleto(e),
      ]),
    ),
    notas: [
      `${cobertura.inscritos} de ${cobertura.total} matriculados activos estan en algun centro (${cobertura.porcentaje}%).`,
      `Esta lista son los ${cobertura.faltantes.length} que no estan en ninguno.`,
      'Solo cuentan estudiantes activos y centros activos.',
    ],
  };
}

// ---------------------------------------------------------------------------
//  2. Asistencia por centro
// ---------------------------------------------------------------------------

function AsistenciaPorCentro({
  estadistica,
  grupos,
}: {
  estadistica: EstadisticaProgramaTotal;
  grupos: GrupoPrograma[];
}) {
  const lider = useCallback(
    (grupoId: string) => grupos.find((g) => g.grupoId === grupoId)?.lider ?? '',
    [grupos],
  );

  const ordenados = [...estadistica.grupos].sort((a, b) => {
    // Primero los que no tienen ni una sesion registrada: son los que hay que ir a
    // reclamar. Ordenar por tasa de inasistencia los escondería abajo con un 0% que
    // parece perfecto y en realidad significa que nadie ha pasado lista nunca.
    if ((a.sesionesCount === 0) !== (b.sesionesCount === 0)) return a.sesionesCount === 0 ? -1 : 1;
    return b.tasaInasistencia - a.tasaInasistencia;
  });

  return (
    <section className="rounded-xl border border-line bg-card p-3">
      <h3 className="text-sm font-semibold text-strong">Asistencia por centro</h3>
      <p className="text-xs text-muted">
        El porcentaje se calcula sobre las sesiones REGISTRADAS, nunca sobre el calendario.
        Por eso el número de sesiones va siempre al lado: sin él, la cifra miente.
      </p>

      <p className="mt-2 rounded-lg border border-line bg-elevated p-2 text-sm text-strong">
        {estadistica.sesionesCount === 0 ? (
          <>Todavía no se ha registrado ninguna sesión en el programa.</>
        ) : (
          <>
            <b>{estadistica.tasaInasistencia}%</b> de inasistencia en todo el programa,
            sobre <b>{estadistica.sesionesCount}</b>{' '}
            {estadistica.sesionesCount === 1 ? 'sesión registrada' : 'sesiones registradas'} y{' '}
            <b>{estadistica.miembros}</b> inscripciones.
          </>
        )}
      </p>

      <ul className="mt-2 space-y-1.5">
        {ordenados.map((g) => (
          <li key={g.grupoId} className="rounded-lg border border-line p-2">
            <div className="flex flex-wrap items-baseline justify-between gap-x-2">
              <span className="text-sm font-semibold text-strong">{g.nombre}</span>
              <span className="text-xs text-muted">
                {g.miembros} inscritos · {lider(g.grupoId)}
              </span>
            </div>
            {g.sesionesCount === 0 ? (
              <p className="mt-0.5 text-sm text-danger-soft-fg">
                Sin ninguna sesión registrada. No hay porcentaje que mostrar — no es un 0%
                de inasistencia, es que nadie ha pasado lista.
              </p>
            ) : (
              <p className="mt-0.5 text-sm text-soft">
                <b className="text-strong">{g.tasaInasistencia}%</b> de inasistencia sobre{' '}
                <b>{g.sesionesCount}</b>{' '}
                {g.sesionesCount === 1 ? 'sesión registrada' : 'sesiones registradas'} ·{' '}
                {g.porMarca.ausencia} ausencias, {g.porMarca.retraso} retrasos,{' '}
                {g.sinRegistrar} casillas sin registrar
              </p>
            )}
          </li>
        ))}
        {ordenados.length === 0 && (
          <li className="text-sm text-muted">Este programa todavía no tiene centros.</li>
        )}
      </ul>
    </section>
  );
}

// ---------------------------------------------------------------------------
//  3. Buscador — ¿dónde está este muchacho y cómo va?
// ---------------------------------------------------------------------------

function BuscadorDelPanel({
  sede,
  grupos,
  estadistica,
  sesionesPorGrupo,
}: {
  sede: string;
  grupos: GrupoPrograma[];
  estadistica: EstadisticaProgramaTotal;
  sesionesPorGrupo: Record<string, SesionPrograma[]>;
}) {
  const [texto, setTexto] = useState('');
  const [resultados, setResultados] = useState<Student[]>([]);
  const [buscando, setBuscando] = useState(false);

  useEffect(() => {
    if (texto.trim().length < 2) {
      setResultados([]);
      return;
    }
    let vivo = true;
    setBuscando(true);
    void buscarEstudiantes(sede, texto)
      .then((lista) => vivo && setResultados(lista))
      .finally(() => vivo && setBuscando(false));
    return () => {
      vivo = false;
    };
  }, [texto, sede]);

  /** En que centros esta. Puede ser mas de uno mientras un `duplicado` siga sin decidir:
   *  la bandeja lo deja a proposito en los dos, asi que aqui tampoco se oculta. */
  function centrosDe(studentId: string): GrupoPrograma[] {
    return grupos.filter((g) => (g.miembros ?? []).includes(studentId));
  }

  return (
    <section className="rounded-xl border border-line bg-card p-3">
      <h3 className="text-sm font-semibold text-strong">Buscar un estudiante</h3>
      <p className="text-xs text-muted">
        Escriba un nombre y le digo en qué centro está, con quién, y cómo va de asistencia.
      </p>

      <div className="mt-2 flex items-center gap-2 rounded-lg border border-line bg-elevated px-2">
        <Search size={16} className="shrink-0 text-muted" aria-hidden />
        <input
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Apellido o nombre"
          className="min-w-0 flex-1 bg-transparent py-2 text-base text-strong outline-none"
        />
      </div>

      {buscando && <p className="mt-1 text-xs text-muted">Buscando…</p>}

      <ul className="mt-2 space-y-1.5">
        {resultados.map((e) => {
          const centros = centrosDe(e.studentId);
          return (
            <li key={e.studentId} className="rounded-lg border border-line p-2">
              <div className="flex items-center gap-2">
                <Avatar estudiante={e} tamano={36} />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-strong">
                    {nombreCompleto(e)}
                  </p>
                  <p className="text-xs text-muted">{e.gradoActual}</p>
                </div>
              </div>

              {centros.length === 0 ? (
                <p className="mt-1 text-sm text-danger-soft-fg">
                  No está en ningún centro de interés.
                </p>
              ) : (
                <ul className="mt-1 space-y-1">
                  {centros.map((g) => {
                    const grupoStats = estadistica.grupos.find((x) => x.grupoId === g.grupoId);
                    const st = grupoStats?.porEstudiante[e.studentId];
                    const sesiones = (sesionesPorGrupo[g.grupoId] ?? []).length;
                    return (
                      <li key={g.grupoId} className="rounded-lg bg-elevated p-2">
                        <p className="text-sm font-semibold text-strong">{g.nombre}</p>
                        <p className="text-xs text-muted">Con {g.lider}</p>
                        {sesiones === 0 || !st ? (
                          <p className="mt-0.5 text-sm text-soft">
                            Sin sesiones registradas todavía en este centro.
                          </p>
                        ) : (
                          <p className="mt-0.5 text-sm text-soft">
                            {st.porMarca.asistencia} asistencias, {st.ausenciasTotales}{' '}
                            ausencias y {st.porMarca.retraso} retrasos sobre{' '}
                            <b>{st.sesionesCount}</b>{' '}
                            {st.sesionesCount === 1
                              ? 'sesión registrada'
                              : 'sesiones registradas'}
                            {st.sinRegistrar > 0 && ` · ${st.sinRegistrar} sin registrar`}
                          </p>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}

              {centros.length > 1 && (
                <p className="mt-1 rounded-lg border border-info-soft bg-info-soft p-2 text-xs text-info-soft-fg">
                  Está en más de un centro. No es un error: mientras no se decida en la
                  bandeja de pendientes, sigue inscrito en los dos para que ninguno de los
                  dos líderes se quede sin poder llamarlo a lista.
                </p>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
