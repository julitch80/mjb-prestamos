import { useEffect, useMemo, useState } from 'react';
import { getAsignatura } from '../data/asignacionAcademica';
import { leerResumenesAlerta, recalcularResumenAlerta } from './datos';
import {
  asignaturasDeResumen,
  filasDeResumen,
  totalesDe,
  type FilaGrupo,
  type PuntoPeriodo,
  type ResumenJornada,
  type Totales,
} from './domain/analisis-alerta';
import { GraficoEvolucion, GraficoGrupos } from './GraficosAlerta';
import type { Jornada, Sede } from './domain/types';

const NOMBRE_SEDE: Record<Sede, string> = { central: 'Sede central', gustavo_rodas: 'Gustavo Rodas', la_finquita: 'La Finquita' };
const NOMBRE_JORNADA: Record<string, string> = { manana: 'Mañana', tarde: 'Tarde' };

/**
 * Panorama de la alerta academica para las DIRECTIVAS (Julian, 2026-10-24): por jornada y por
 * sede, ademas del grupo a grupo. Sale del resumen SIN NOMBRES que mantiene el servidor
 * (`asistenciaAlertaResumen`): no abre las planillas de nadie.
 */
export default function PanoramaAlerta({ sede: sedeInicial, jornadaLimitada = null }: { sede: Sede; jornadaLimitada?: Jornada | null }) {
  const anio = new Date().getFullYear();
  const [resumenes, setResumenes] = useState<ResumenJornada[] | null>(null);
  const [sede, setSede] = useState<Sede>(sedeInicial);
  const [periodo, setPeriodo] = useState<number | null>(null);
  const [actualizando, setActualizando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  function cargar() {
    void leerResumenesAlerta(anio).then((rs) => {
      setResumenes(rs);
      setPeriodo((p) => p ?? (rs.length ? Math.max(...rs.map((r) => r.periodo)) : null));
    }).catch(() => setResumenes([]));
  }
  useEffect(cargar, [anio]); // eslint-disable-line react-hooks/exhaustive-deps

  const periodos = useMemo(() => [...new Set((resumenes ?? []).map((r) => r.periodo))].sort((a, b) => a - b), [resumenes]);
  const delPeriodo = (resumenes ?? []).filter((r) => r.periodo === periodo);
  const jornadas = (['manana', 'tarde'] as const).filter((j) => !jornadaLimitada || j === jornadaLimitada);
  const deJornada = (j: string, rs = delPeriodo) => rs.find((r) => r.sede === sede && r.jornada === j) ?? null;
  const totalDe = (rs: ResumenJornada[]) => totalesDe(rs.flatMap((r) => Object.values(r.grupos)));
  const sedes = (Object.keys(NOMBRE_SEDE) as Sede[]).filter((s) => delPeriodo.some((r) => r.sede === s));

  async function actualizar() {
    if (periodo === null) return;
    setActualizando(true);
    setAviso(null);
    try {
      for (const j of jornadas) await recalcularResumenAlerta({ sede, jornada: j, anio, periodo });
      cargar();
      setAviso('Panorama actualizado.');
    } catch (e) {
      setAviso(e instanceof Error ? e.message : 'No se pudo actualizar.');
    } finally {
      setActualizando(false);
    }
  }

  if (resumenes === null) return <p className="p-3 text-sm text-muted">Cargando el panorama…</p>;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-2">
        <h3 className="flex-1 text-base font-semibold text-strong">Panorama de la alerta académica · {anio}</h3>
        <label className="flex flex-col gap-1 text-xs text-muted">Sede
          <select value={sede} onChange={(e) => setSede(e.target.value as Sede)} className="min-h-[40px] rounded-lg border border-line bg-elevated px-2 text-sm text-strong">
            {(Object.keys(NOMBRE_SEDE) as Sede[]).map((s) => <option key={s} value={s}>{NOMBRE_SEDE[s]}</option>)}
          </select>
        </label>
        {periodos.length > 0 && (
          <label className="flex flex-col gap-1 text-xs text-muted">Periodo
            <select value={periodo ?? ''} onChange={(e) => setPeriodo(+e.target.value)} className="min-h-[40px] rounded-lg border border-line bg-elevated px-2 text-sm text-strong">
              {periodos.map((p) => <option key={p} value={p}>Periodo {p}</option>)}
            </select>
          </label>
        )}
        <button type="button" disabled={actualizando || periodo === null} onClick={() => void actualizar()} className="min-h-[40px] rounded-lg border border-line px-3 text-sm font-semibold text-strong disabled:opacity-50">
          {actualizando ? 'Actualizando…' : 'Actualizar'}
        </button>
      </div>
      {aviso && <p className="text-xs text-muted">{aviso}</p>}

      {periodos.length === 0 ? (
        <p className="rounded-xl bg-elevated px-3 py-2 text-sm text-soft">
          Todavía no hay resumen de ninguna alerta. Se arma solo a medida que los docentes marcan; para un periodo ya marcado, elija el periodo y toque «Actualizar».
        </p>
      ) : (
        <>
          {/* Por jornada */}
          <section className="grid gap-3 sm:grid-cols-2">
            {jornadas.map((j) => {
              const r = deJornada(j);
              return <TarjetaTotales key={j} titulo={`Jornada de la ${NOMBRE_JORNADA[j].toLowerCase()} · ${NOMBRE_SEDE[sede]}`} t={r ? totalDe([r]) : null} />;
            })}
          </section>

          {/* Por sede */}
          {sedes.length > 1 && (
            <section className="rounded-2xl border border-line bg-card p-4">
              <h4 className="mb-3 text-sm font-semibold text-strong">Comparación por sede · periodo {periodo}</h4>
              <GraficoGrupos
                filas={sedes
                  .map((s): FilaGrupo => ({ grado: NOMBRE_SEDE[s], porcentajeSinAlerta: totalDe(delPeriodo.filter((r) => r.sede === s)).porcentajeSinAlerta, propio: s === sede }))
                  .sort((a, b) => b.porcentajeSinAlerta - a.porcentajeSinAlerta)}
                promedio={totalDe(delPeriodo).porcentajeSinAlerta}
                etiquetaPropio="Sede elegida"
              />
              <p className="mt-1 text-xs text-muted">La línea punteada es el colegio completo.</p>
            </section>
          )}

          {/* Cada jornada: grupos, asignaturas y evolucion */}
          {jornadas.map((j) => {
            const r = deJornada(j);
            if (!r) return null;
            const t = totalDe([r]);
            const asignaturas = asignaturasDeResumen(Object.values(r.grupos)).slice(0, 8);
            const max = Math.max(1, ...asignaturas.map((a) => a.n));
            const evolucion: PuntoPeriodo[] = periodos.map((p) => {
              const x = deJornada(j, (resumenes ?? []).filter((y) => y.periodo === p));
              return { periodo: p, grupo: x ? totalDe([x]).porcentajeSinAlerta : null, jornada: null };
            });
            return (
              <section key={j} className="flex flex-col gap-3 rounded-2xl border border-line bg-card p-4">
                <h4 className="text-sm font-semibold text-strong">Jornada de la {NOMBRE_JORNADA[j].toLowerCase()} · grupo a grupo</h4>
                <GraficoGrupos filas={filasDeResumen(r, null)} promedio={t.porcentajeSinAlerta} etiquetaPropio={null} />
                {asignaturas.length > 0 && (
                  <div>
                    <h5 className="mb-2 text-sm font-semibold text-strong">Asignaturas con más estudiantes en alerta</h5>
                    <ul className="flex flex-col gap-1">
                      {asignaturas.map((a) => (
                        <li key={a.subjectId} className="flex items-center gap-2 text-sm">
                          <span className="w-36 shrink-0 truncate text-soft">{getAsignatura(a.subjectId)?.nombre ?? a.subjectId}</span>
                          <span className="relative h-4 flex-1"><span className="absolute inset-y-0 left-0 rounded-r bg-accent" style={{ width: `${(a.n / max) * 100}%` }} /></span>
                          <span className="w-10 shrink-0 text-right font-bold tabular-nums text-strong">{a.n}</span>
                        </li>
                      ))}
                    </ul>
                    <p className="mt-2 text-xs text-muted">Número de estudiantes en alerta en cada asignatura, sumando los grupos.</p>
                  </div>
                )}
                {evolucion.length > 1 && (
                  <div>
                    <h5 className="mb-2 text-sm font-semibold text-strong">De un periodo a otro</h5>
                    <GraficoEvolucion puntos={evolucion} />
                  </div>
                )}
              </section>
            );
          })}
        </>
      )}
    </div>
  );
}

function TarjetaTotales({ titulo, t }: { titulo: string; t: Totales | null }) {
  return (
    <div className="rounded-2xl border border-line bg-card p-4">
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
