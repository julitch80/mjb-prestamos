import { useEffect, useMemo, useState } from 'react';
import { getAsignatura } from '../data/asignacionAcademica';
import { convocatoriasAlerta, leerResumenesAlerta, recalcularResumenAlerta } from './datos';
import {
  asignaturasPorNivel,
  filasDeResumen,
  NOMBRE_NIVEL,
  totalesDe,
  type FilaGrupo,
  type PuntoPeriodo,
  type ResumenJornada,
  type Totales,
} from './domain/analisis-alerta';
import { GraficoEvolucion, GraficoGrupos } from './GraficosAlerta';
import SelectorVista, { useVistaRecordada } from '../components/SelectorVista';
import { asignaturasDelGrado } from './horarioDelDia';
import type { Jornada, Sede } from './domain/types';

const SEDES: Sede[] = ['central', 'gustavo_rodas', 'la_finquita'];
const JORNADAS: Jornada[] = ['manana', 'tarde'];
const NOMBRE_SEDE: Record<Sede, string> = { central: 'Sede central', gustavo_rodas: 'Gustavo Rodas', la_finquita: 'La Finquita' };
const NOMBRE_JORNADA: Record<Jornada, string> = { manana: 'mañana', tarde: 'tarde' };
const PERIODOS = [1, 2, 3, 4];

type Alcance = 'jornada' | 'sede' | 'colegio';

/**
 * Panorama de la alerta academica para las DIRECTIVAS (Julian, 2026-10-24): de una jornada,
 * de toda la sede o de todas las sedes. Sale del resumen SIN NOMBRES que mantiene el servidor
 * (`asistenciaAlertaResumen`): no abre las planillas de nadie. «Actualizar» rehace el resumen
 * de lo que se esta viendo (para los periodos marcados antes de que existiera).
 */
export default function PanoramaAlerta({ sede: sedeInicial, jornadaLimitada = null }: { sede: Sede; jornadaLimitada?: Jornada | null }) {
  const anio = new Date().getFullYear();
  const [resumenes, setResumenes] = useState<ResumenJornada[] | null>(null);
  const [alcance, setAlcance] = useState<Alcance>(jornadaLimitada ? 'jornada' : 'sede');
  const [sede, setSede] = useState<Sede>(sedeInicial);
  const [jornada, setJornada] = useState<Jornada>(jornadaLimitada ?? 'manana');
  const [periodo, setPeriodo] = useState<number | null>(null);
  const [actualizando, setActualizando] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  // Todas las sedes: la misma cifra por sede en tarjetas (matriz) o en barras (lista) (2026-10-26).
  const [vistaSedes, setVistaSedes] = useVistaRecordada<'matriz' | 'lista'>('panorama-sedes', 'matriz', ['matriz', 'lista']);

  function cargar() {
    return leerResumenesAlerta(anio).then(setResumenes).catch(() => setResumenes([]));
  }
  useEffect(() => { void cargar(); }, [anio]); // eslint-disable-line react-hooks/exhaustive-deps

  // Periodo por defecto: el mas reciente con resumen; si no hay ninguno (fallo real,
  // 2026-10-25: sin resumen no habia periodo y sin periodo no se podia armar el resumen), el
  // mas reciente con alerta abierta en la sede; si tampoco, el 1. El selector sale siempre.
  useEffect(() => {
    if (resumenes === null || periodo !== null) return;
    if (resumenes.length) { setPeriodo(Math.max(...resumenes.map((r) => r.periodo))); return; }
    void Promise.all(JORNADAS.map((j) => convocatoriasAlerta(sedeInicial, j).catch(() => [])))
      .then((cs) => {
        const delAnio = cs.flat().filter((c) => c.anio === anio).map((c) => c.periodo);
        setPeriodo(delAnio.length ? Math.max(...delAnio) : 1);
      });
  }, [resumenes]); // eslint-disable-line react-hooks/exhaustive-deps

  const todos = resumenes ?? [];
  const enAlcance = (r: ResumenJornada) =>
    alcance === 'colegio' || (r.sede === sede && (alcance === 'sede' || r.jornada === jornada));
  const delPeriodo = todos.filter((r) => r.periodo === periodo && enAlcance(r));
  const totalDe = (rs: ResumenJornada[]) => totalesDe(rs.flatMap((r) => Object.values(r.grupos)));
  const conPeriodos = useMemo(() => new Set(todos.map((r) => r.periodo)), [todos]);

  /** Las sedes y jornadas que recorre «Actualizar» segun el alcance. */
  function objetivos(): { sede: Sede; jornada: Jornada }[] {
    if (alcance === 'jornada') return [{ sede, jornada }];
    if (alcance === 'sede') return JORNADAS.map((j) => ({ sede, jornada: j }));
    return SEDES.flatMap((s) => JORNADAS.map((j) => ({ sede: s, jornada: j })));
  }

  async function actualizar() {
    if (periodo === null) return;
    setAviso(null);
    try {
      for (const o of objetivos()) {
        setActualizando(`${NOMBRE_SEDE[o.sede]} · ${NOMBRE_JORNADA[o.jornada]}`);
        await recalcularResumenAlerta({ ...o, anio, periodo });
      }
      await cargar();
      setAviso(`Panorama del periodo ${periodo} actualizado.`);
    } catch (e) {
      setAviso(e instanceof Error ? e.message : 'No se pudo actualizar.');
    } finally {
      setActualizando(null);
    }
  }

  if (resumenes === null) return <p className="p-3 text-sm text-muted">Cargando el panorama…</p>;

  const caja = 'min-h-[40px] rounded-lg border border-line bg-elevated px-2 text-sm text-strong';
  const titulo = alcance === 'colegio' ? 'Todas las sedes'
    : alcance === 'sede' ? `${NOMBRE_SEDE[sede]} · las dos jornadas`
    : `${NOMBRE_SEDE[sede]} · jornada de la ${NOMBRE_JORNADA[jornada]}`;

  // Evolucion por periodo del alcance elegido.
  const evolucion: PuntoPeriodo[] = PERIODOS.filter((p) => conPeriodos.has(p)).map((p) => {
    const rs = todos.filter((r) => r.periodo === p && enAlcance(r));
    return { periodo: p, grupo: rs.length ? totalDe(rs).porcentajeSinAlerta : null, jornada: null };
  });
  // TODAS las asignaturas, tambien las de 0, por nivel (2026-10-25). Un grado de dos sedes no
  // se mezcla: la clave lleva la sede.
  const gruposDelAlcance = Object.fromEntries(delPeriodo.flatMap((r) => Object.entries(r.grupos).map(([g, x]) => [`${g}@${r.sede}`, x])));
  const niveles = asignaturasPorNivel(gruposDelAlcance, (clave) => asignaturasDelGrado(clave.split('@')[0]).map((a) => a.subjectId));
  const sedesConDatos = SEDES.filter((s) => todos.some((r) => r.periodo === periodo && r.sede === s));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-2">
        <div className="inline-flex rounded-xl border border-line p-0.5" role="group" aria-label="Alcance">
          {([['jornada', 'Esta jornada'], ['sede', 'Toda la sede'], ['colegio', 'Todas las sedes']] as const).map(([v, t]) => (
            <button
              key={v}
              type="button"
              aria-pressed={alcance === v}
              onClick={() => setAlcance(v)}
              className={`min-h-[40px] rounded-lg px-3 text-sm font-semibold ${alcance === v ? 'bg-accent text-accent-fg' : 'text-strong'}`}
            >
              {t}
            </button>
          ))}
        </div>
        {alcance !== 'colegio' && (
          <label className="flex flex-col gap-1 text-xs text-muted">Sede
            <select value={sede} onChange={(e) => setSede(e.target.value as Sede)} className={caja}>
              {SEDES.map((s) => <option key={s} value={s}>{NOMBRE_SEDE[s]}</option>)}
            </select>
          </label>
        )}
        {alcance === 'jornada' && (
          <label className="flex flex-col gap-1 text-xs text-muted">Jornada
            <select value={jornada} onChange={(e) => setJornada(e.target.value as Jornada)} className={caja}>
              {JORNADAS.map((j) => <option key={j} value={j}>{NOMBRE_JORNADA[j]}</option>)}
            </select>
          </label>
        )}
        <label className="flex flex-col gap-1 text-xs text-muted">Periodo
          <select value={periodo ?? ''} onChange={(e) => setPeriodo(+e.target.value)} className={caja}>
            {PERIODOS.map((p) => <option key={p} value={p}>Periodo {p}{conPeriodos.has(p) ? '' : ' (sin resumen)'}</option>)}
          </select>
        </label>
        <button
          type="button"
          disabled={actualizando !== null || periodo === null}
          onClick={() => void actualizar()}
          className="min-h-[40px] rounded-lg bg-accent px-3 text-sm font-semibold text-accent-fg disabled:opacity-50"
        >
          {actualizando ? `Actualizando ${actualizando}…` : 'Actualizar'}
        </button>
      </div>
      {aviso && <p className="text-xs text-muted">{aviso}</p>}

      <h3 className="text-base font-semibold text-strong">Panorama de la alerta académica · {titulo} · periodo {periodo} de {anio}</h3>

      {delPeriodo.length === 0 ? (
        <p className="rounded-xl bg-elevated px-3 py-2 text-sm text-soft">
          No hay resumen de este periodo para lo que eligió. Si ya se marcó la alerta, toque «Actualizar»: se arma con lo
          que marcaron los docentes. De ahí en adelante se mantiene solo.
        </p>
      ) : (
        <>
          {alcance === 'colegio' && sedesConDatos.length > 1 && (
            <div className="flex justify-end">
              <SelectorVista valor={vistaSedes} onCambio={setVistaSedes} etiqueta="Ver las sedes:" />
            </div>
          )}
          {/* Tarjetas: por jornada (jornada o sede) o por sede (todas las sedes), y el total. */}
          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {alcance !== 'jornada' && <TarjetaTotales titulo={alcance === 'colegio' ? 'Colegio completo' : `${NOMBRE_SEDE[sede]} (las dos jornadas)`} t={totalDe(delPeriodo)} destacada />}
            {alcance === 'colegio'
              ? (vistaSedes === 'matriz' || sedesConDatos.length < 2) && sedesConDatos.map((s) => <TarjetaTotales key={s} titulo={NOMBRE_SEDE[s]} t={totalDe(delPeriodo.filter((r) => r.sede === s))} />)
              : JORNADAS.filter((j) => alcance === 'sede' || j === jornada).map((j) => {
                  const rs = delPeriodo.filter((r) => r.jornada === j);
                  return <TarjetaTotales key={j} titulo={`Jornada de la ${NOMBRE_JORNADA[j]}`} t={rs.length ? totalDe(rs) : null} />;
                })}
          </section>

          {alcance === 'colegio' && sedesConDatos.length > 1 && vistaSedes === 'lista' && (
            <section className="rounded-2xl border border-line bg-card p-4">
              <h4 className="mb-3 text-sm font-semibold text-strong">Comparación por sede</h4>
              <GraficoGrupos
                filas={sedesConDatos
                  .map((s): FilaGrupo => ({ grado: NOMBRE_SEDE[s], porcentajeSinAlerta: totalDe(delPeriodo.filter((r) => r.sede === s)).porcentajeSinAlerta, propio: false }))
                  .sort((a, b) => b.porcentajeSinAlerta - a.porcentajeSinAlerta)}
                promedio={totalDe(delPeriodo).porcentajeSinAlerta}
                etiquetaPropio={null}
              />
              <p className="mt-1 text-xs text-muted">La línea punteada es el colegio completo.</p>
            </section>
          )}

          {/* Grupo a grupo: una lista por sede y jornada del alcance. */}
          {delPeriodo
            .slice()
            .sort((a, b) => SEDES.indexOf(a.sede as Sede) - SEDES.indexOf(b.sede as Sede) || a.jornada.localeCompare(b.jornada))
            .map((r) => (
              <section key={r.resumenId} className="rounded-2xl border border-line bg-card p-4">
                <h4 className="mb-3 text-sm font-semibold text-strong">
                  Grupo a grupo · {alcance === 'colegio' ? `${NOMBRE_SEDE[r.sede as Sede]} · ` : ''}jornada de la {NOMBRE_JORNADA[r.jornada as Jornada]}
                </h4>
                <GraficoGrupos filas={filasDeResumen(r, null)} promedio={totalDe([r]).porcentajeSinAlerta} etiquetaPropio={null} />
              </section>
            ))}

          {niveles.map((b) => {
            const max = Math.max(1, ...b.asignaturas.map((a) => a.n));
            return (
              <section key={b.nivel} className="rounded-2xl border border-line bg-card p-4">
                <h4 className="text-sm font-semibold text-strong">Estudiantes en alerta por asignatura · {NOMBRE_NIVEL[b.nivel]}</h4>
                <p className="mb-3 text-xs text-muted">{b.estudiantes} estudiantes en el nivel · todas las asignaturas, también las que no tienen a nadie en alerta</p>
                <ul className="flex flex-col gap-1">
                  {b.asignaturas.map((a) => (
                    <li key={a.subjectId} className="flex items-center gap-2 text-sm" title={`${getAsignatura(a.subjectId)?.nombre ?? a.subjectId}: ${a.n} estudiantes (${a.porcentaje} %)`}>
                      <span className="w-40 shrink-0 truncate text-soft">{getAsignatura(a.subjectId)?.nombre ?? a.subjectId}</span>
                      <span className="relative h-4 flex-1"><span className="absolute inset-y-0 left-0 rounded-r bg-accent" style={{ width: a.n ? `${Math.max(1, (a.n / max) * 100)}%` : 0 }} /></span>
                      <span className="w-24 shrink-0 text-right tabular-nums"><b className="text-strong">{a.n}</b> <span className="text-xs text-muted">· {a.porcentaje} %</span></span>
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-xs text-muted">Número de estudiantes en alerta en cada asignatura, sumando los grupos, y qué parte son de los estudiantes que la ven.</p>
              </section>
            );
          })}

          {evolucion.length > 1 && (
            <section className="rounded-2xl border border-line bg-card p-4">
              <h4 className="mb-3 text-sm font-semibold text-strong">De un periodo a otro</h4>
              <GraficoEvolucion puntos={evolucion} />
            </section>
          )}
        </>
      )}
    </div>
  );
}

function TarjetaTotales({ titulo, t, destacada = false }: { titulo: string; t: Totales | null; destacada?: boolean }) {
  return (
    <div className={`rounded-2xl border p-4 ${destacada ? 'border-accent bg-accent-soft' : 'border-line bg-card'}`}>
      <p className="text-sm font-semibold text-strong">{titulo}</p>
      {!t || t.estudiantes === 0 ? (
        <p className="mt-2 text-sm text-muted">Sin datos en este periodo.</p>
      ) : (
        <>
          <p className="mt-2 flex flex-wrap items-baseline gap-x-2">
            <span className="text-4xl font-bold text-accent">{t.porcentajeSinAlerta} %</span>
            <span className="text-sm text-soft">sin ninguna asignatura en alerta</span>
          </p>
          <p className="mt-1 text-xs text-muted">
            {t.grupos} grupos · {t.estudiantes} estudiantes · {t.citados} familias por citar ({t.porcentajeCitados} %)
          </p>
        </>
      )}
    </div>
  );
}
