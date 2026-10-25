import { useEffect, useMemo, useRef, useState } from 'react';
import { leerAgendaCitaciones, leerResumenesAlerta } from './datos';
import { citacionAlertaId, type AsignaturaEsperada, type Consolidado } from './domain/alerta-academica';
import {
  agruparParaSalon,
  analizarGrupo,
  comparar,
  filasDeResumen,
  frases,
  porcentaje,
  totalesDe,
  type Barra,
  type PuntoPeriodo,
  type ResumenJornada,
} from './domain/analisis-alerta';
import { GraficoEvolucion, GraficoGrupos } from './GraficosAlerta';
import { jornadaDeGrado } from './domain/ids';
import { nombreCompleto } from './domain/nombres';
import { imprimirAnalisisAlerta } from './imprimirAlerta';
import type { AgendaCitaciones, ConvocatoriaAlerta, Sede, Student } from './domain/types';

/**
 * «Análisis» de la alerta de un grupo (Julian, 2026-10-24): para el espacio en que el
 * director analiza los resultados con su grupo. En la app, siempre con nombres (tocar una
 * barra dice quienes son). Para presentar o imprimir, elige: con nombres o sin nombres
 * (para el salon); sin nombres solo van graficos de conjunto.
 */
export default function AnalisisAlerta({
  grado,
  sede,
  conv,
  consolidado,
  esperadas,
  estudiantes,
  director,
}: {
  grado: string;
  sede: Sede;
  conv: ConvocatoriaAlerta;
  consolidado: Consolidado;
  esperadas: AsignaturaEsperada[];
  /** Activos del grupo, ya ordenados. */
  estudiantes: Student[];
  director: string;
}) {
  const [conNombres, setConNombres] = useState(true);
  const [abierta, setAbierta] = useState<string | null>(null);
  const [resumenes, setResumenes] = useState<ResumenJornada[]>([]);
  const [agenda, setAgenda] = useState<AgendaCitaciones | null>(null);
  const [error, setError] = useState<string | null>(null);
  const caja = useRef<HTMLDivElement>(null);

  const a = useMemo(() => analizarGrupo(consolidado.filas, esperadas, consolidado.faltantes), [consolidado, esperadas]);
  const nombreDe = (id: string) => {
    const e = estudiantes.find((x) => x.studentId === id);
    return e ? nombreCompleto(e) : '(ya no está en el grupo)';
  };
  // Comparaciones (2026-10-24): del resumen SIN NOMBRES que mantiene el servidor, el mismo que
  // ven las directivas. Los otros grupos de la jornada y los periodos anteriores, solo cuentas.
  useEffect(() => {
    void leerResumenesAlerta(conv.anio).then(setResumenes).catch(() => undefined);
  }, [conv.anio]);
  const jornadaG = jornadaDeGrado(grado);
  const resumenDe = (p: number) => resumenes.find((r) => r.sede === sede && r.jornada === jornadaG && r.periodo === p) ?? null;
  const actual = resumenDe(conv.periodo);
  const promedioJornada = actual ? totalesDe(Object.values(actual.grupos)).porcentajeSinAlerta : null;
  const grupos = actual ? filasDeResumen(actual, grado) : [];
  const evolucion: PuntoPeriodo[] = [...new Set(
    resumenes.filter((r) => r.sede === sede && r.jornada === jornadaG && r.periodo <= conv.periodo).map((r) => r.periodo).concat(conv.periodo),
  )].sort((x, y) => x - y).map((p) => {
    const r = resumenDe(p);
    const g = r?.grupos[grado];
    return {
      periodo: p,
      // El periodo que se analiza, con lo de la pantalla (mismos estudiantes que el número grande).
      grupo: p === conv.periodo ? a.porcentajeSinAlerta : g && g.estudiantes ? porcentaje(g.sinAlerta, g.estudiantes) : null,
      jornada: r ? totalesDe(Object.values(r.grupos)).porcentajeSinAlerta : null,
    };
  });
  const anterior = evolucion.find((p) => p.periodo === conv.periodo - 1)?.grupo ?? null;

  useEffect(() => {
    void leerAgendaCitaciones(citacionAlertaId(conv.anio, conv.periodo, sede, grado)).then(setAgenda).catch(() => undefined);
  }, [conv.anio, conv.periodo, sede, grado]);

  const comparaciones = [
    anterior !== null && `Sin ninguna alerta: ${comparar(a.porcentajeSinAlerta, anterior, `en el periodo ${conv.periodo - 1}`)}`,
    promedioJornada !== null && `${comparar(a.porcentajeSinAlerta, promedioJornada, 'el promedio de la jornada')} (jornada: ${promedioJornada} %)`,
  ].filter((x): x is string => !!x);

  const citas = agenda ? Object.values(agenda.citas) : [];
  const entrega = citas.some((c) => c.asistio === true || c.asistio === false)
    ? { citados: citas.length, vinieron: citas.filter((c) => c.asistio === true).length, faltaron: citas.filter((c) => c.asistio === false).length }
    : null;

  const asignaturas = conNombres ? a.porAsignatura : agruparParaSalon(a.porAsignatura);

  function imprimir() {
    setError(null);
    const ok = imprimirAnalisisAlerta(
      sede,
      { grado, periodo: conv.periodo, anio: conv.anio, director, analisis: a, comparaciones, entrega, evolucion, grupos, promedioJornada },
      conNombres,
      nombreDe,
    );
    if (!ok) setError('El navegador bloqueó la ventana de impresión: permita las ventanas emergentes de la app.');
  }

  if (a.total === 0) return <p className="p-3 text-sm text-muted">El grupo no tiene estudiantes activos.</p>;

  return (
    <div ref={caja} className="flex flex-col gap-4 overflow-auto bg-app p-1 [&:fullscreen]:p-6">
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-xl border border-line p-0.5" role="group" aria-label="Nombres">
          {[true, false].map((v) => (
            <button
              key={String(v)}
              type="button"
              aria-pressed={conNombres === v}
              onClick={() => { setConNombres(v); setAbierta(null); }}
              className={`min-h-[40px] rounded-lg px-3 text-sm font-semibold ${conNombres === v ? 'bg-accent text-accent-fg' : 'text-strong'}`}
            >
              {v ? 'Con nombres' : 'Sin nombres (para el salón)'}
            </button>
          ))}
        </div>
        <span className="flex-1" />
        <button type="button" onClick={() => void caja.current?.requestFullscreen?.().catch(() => undefined)} className="min-h-[40px] rounded-lg border border-line px-3 text-sm font-semibold text-strong">
          Pantalla completa
        </button>
        <button type="button" onClick={imprimir} className="min-h-[40px] rounded-lg border border-line px-3 text-sm font-semibold text-strong">
          Imprimir o guardar PDF
        </button>
      </div>

      <section className="rounded-2xl border border-line bg-card p-4">
        <p className="flex flex-wrap items-baseline gap-x-3">
          <span className="text-5xl font-bold text-accent">{a.porcentajeSinAlerta} %</span>
          <span className="text-base text-strong">del grupo no tiene ninguna asignatura en alerta</span>
        </p>
        {comparaciones.length > 0 && <p className="mt-1 text-sm text-soft">{comparaciones.join(' · ')}</p>}
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            [a.total, 'estudiantes'],
            [a.sinAlerta, 'sin ninguna alerta'],
            [a.conAlguna, 'con al menos una'],
            [a.citados, 'se cita a la familia'],
          ].map(([n, t]) => (
            <div key={t} className="rounded-xl border border-line px-3 py-2">
              <p className="text-2xl font-bold text-strong">{n}</p>
              <p className="text-xs text-muted">{t}</p>
            </div>
          ))}
        </div>
        {a.pendientes.length > 0 && (
          <p className="mt-3 rounded-xl bg-warning-soft px-3 py-2 text-xs text-warning-soft-fg">
            Aún faltan por entregar: {a.pendientes.join(', ')}. Los números pueden subir.
          </p>
        )}
      </section>

      {evolucion.length > 1 && (
        <section className="rounded-2xl border border-line bg-card p-4">
          <h4 className="mb-3 text-sm font-semibold text-strong">¿Cómo vamos de un periodo a otro?</h4>
          <GraficoEvolucion puntos={evolucion} />
        </section>
      )}

      {grupos.length > 1 && (
        <section className="rounded-2xl border border-line bg-card p-4">
          <h4 className="mb-3 text-sm font-semibold text-strong">Comparación con los otros grupos de la jornada</h4>
          <GraficoGrupos filas={grupos} promedio={promedioJornada} />
        </section>
      )}

      <Grafico
        titulo="¿Cuántas asignaturas en alerta tiene cada estudiante?"
        barras={a.distribucion.map((b) => ({ ...b, etiqueta: b.clave === '1' ? '1 asignatura' : `${b.etiqueta} asignaturas` }))}
        conNombres={conNombres}
        nombreDe={nombreDe}
        abierta={abierta}
        onAbrir={setAbierta}
        pie={<><span className="mr-1 inline-block h-3 w-3 rounded-sm bg-warning align-[-1px]" /> Se cita a la familia (2 o más) · cada barra es un número de estudiantes</>}
      />

      <Grafico
        titulo="Asignaturas con estudiantes en alerta"
        barras={asignaturas}
        conNombres={conNombres}
        nombreDe={nombreDe}
        abierta={abierta}
        onAbrir={setAbierta}
        vacio="Ninguna asignatura tiene estudiantes en alerta."
        pie={!conNombres && asignaturas.some((b) => b.clave === 'otras')
          ? '«Otras»: asignaturas con un solo estudiante en alerta, juntas para no señalar a nadie.'
          : a.sinNadieEnAlerta.length ? `Sin nadie en alerta: ${a.sinNadieEnAlerta.join(', ')}.` : undefined}
      />

      {entrega && entrega.citados > 0 && (
        <section className="rounded-2xl border border-line bg-card p-4">
          <h4 className="text-sm font-semibold text-strong">La entrega a las familias</h4>
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              [entrega.citados, 'familias citadas'],
              [entrega.vinieron, 'vinieron'],
              [entrega.faltaron, 'faltaron'],
              [Math.max(0, entrega.citados - entrega.vinieron - entrega.faltaron), 'sin registrar'],
            ].map(([n, t]) => (
              <div key={t} className="rounded-xl border border-line px-3 py-2">
                <p className="text-2xl font-bold text-strong">{n}</p>
                <p className="text-xs text-muted">{t}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="rounded-2xl border border-line bg-card p-4">
        <h4 className="text-sm font-semibold text-strong">Para conversar</h4>
        <ul className="mt-2 list-disc pl-5 text-sm leading-relaxed text-soft">
          {frases(a, !conNombres).map((f) => <li key={f}>{f}</li>)}
        </ul>
      </section>

      {error && <p className="text-sm text-danger">{error}</p>}
    </div>
  );
}

/**
 * Barras horizontales: etiqueta, barra y el numero al final. Con nombres, tocar la barra
 * muestra quienes son; sin nombres no se puede tocar.
 */
function Grafico({
  titulo,
  barras,
  conNombres,
  nombreDe,
  abierta,
  onAbrir,
  pie,
  vacio,
}: {
  titulo: string;
  barras: Barra[];
  conNombres: boolean;
  nombreDe: (id: string) => string;
  abierta: string | null;
  onAbrir: (clave: string | null) => void;
  pie?: React.ReactNode;
  vacio?: string;
}) {
  const max = Math.max(1, ...barras.map((b) => b.n));
  return (
    <section className="rounded-2xl border border-line bg-card p-4">
      <h4 className="text-sm font-semibold text-strong">{titulo}</h4>
      {barras.length === 0 ? (
        <p className="mt-2 text-sm text-muted">{vacio}</p>
      ) : (
        <ul className="mt-3 flex flex-col gap-1.5">
          {barras.map((b) => {
            const clave = `${titulo}|${b.clave}`;
            const tocable = conNombres && b.ids.length > 0;
            const fila = (
              <>
                <span className="w-28 shrink-0 truncate text-left text-sm text-soft sm:w-44">{b.etiqueta}</span>
                <span className="relative h-6 flex-1">
                  <span
                    className={`absolute inset-y-0 left-0 rounded-r ${b.seCita ? 'bg-warning' : 'bg-accent'}`}
                    style={{ width: b.n ? `${Math.max(2, (b.n / max) * 100)}%` : 0 }}
                  />
                </span>
                <span className="w-8 shrink-0 text-right text-sm font-bold tabular-nums text-strong">{b.n}</span>
              </>
            );
            return (
              <li key={b.clave}>
                {tocable ? (
                  <button
                    type="button"
                    onClick={() => onAbrir(abierta === clave ? null : clave)}
                    aria-expanded={abierta === clave}
                    title={`${b.etiqueta}: ${b.n} ${b.n === 1 ? 'estudiante' : 'estudiantes'} · toque para ver quiénes`}
                    className="flex w-full items-center gap-2 rounded-lg px-1 py-0.5 hover:bg-elevated"
                  >
                    {fila}
                  </button>
                ) : (
                  <div className="flex items-center gap-2 px-1 py-0.5" title={`${b.etiqueta}: ${b.n} ${b.n === 1 ? 'estudiante' : 'estudiantes'}`}>{fila}</div>
                )}
                {tocable && abierta === clave && (
                  <p className="ml-1 mt-1 rounded-lg bg-elevated px-3 py-2 text-xs text-soft sm:ml-44">{b.ids.map(nombreDe).join(' · ')}</p>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {pie && <p className="mt-3 text-xs text-muted">{pie}</p>}
    </section>
  );
}
