import type { FilaGrupo, PuntoPeriodo } from './domain/analisis-alerta';

/**
 * Graficos de comparacion de la alerta academica (2026-10-24), los mismos en el analisis del
 * director y en el panorama de las directivas. Barras simples, sin terminos de estadistica;
 * el promedio de la jornada va como linea punteada.
 */

/** Barras verticales por periodo (% sin ninguna alerta) con la linea del promedio de la jornada. */
export function GraficoEvolucion({ puntos, etiquetaJornada = 'Promedio de la jornada' }: { puntos: PuntoPeriodo[]; etiquetaJornada?: string }) {
  const hayJornada = puntos.some((p) => p.jornada !== null);
  return (
    <div>
      <div className="flex h-40 items-end gap-4 border-b border-line-strong px-2">
        {puntos.map((p) => (
          <div key={p.periodo} className="relative flex h-full max-w-24 flex-1 flex-col items-center justify-end" title={`Periodo ${p.periodo}: ${p.grupo ?? '—'} %${p.jornada !== null ? ` · jornada ${p.jornada} %` : ''}`}>
            {p.grupo === null ? (
              <span className="text-sm text-muted">—</span>
            ) : p.grupo >= 15 ? (
              <div className="flex w-full items-end justify-center rounded-t bg-accent pb-1" style={{ height: `${p.grupo}%` }}>
                <b className="text-sm text-accent-fg">{p.grupo} %</b>
              </div>
            ) : (
              <>
                <b className="mb-0.5 text-sm text-strong">{p.grupo} %</b>
                <div className="w-full rounded-t bg-accent" style={{ height: `${Math.max(1, p.grupo)}%` }} />
              </>
            )}
            {p.jornada !== null && <div className="absolute -left-1 -right-1 border-t-2 border-dashed border-strong" style={{ bottom: `${p.jornada}%` }} />}
          </div>
        ))}
      </div>
      <div className="flex gap-4 px-2 pt-1 text-xs text-muted">
        {puntos.map((p) => <span key={p.periodo} className="max-w-24 flex-1 text-center">Periodo {p.periodo}</span>)}
      </div>
      <p className="mt-2 text-xs text-muted">
        Altura: % sin ninguna alerta.
        {hayJornada && <><span className="mx-1 inline-block w-5 border-t-2 border-dashed border-strong align-middle" />{etiquetaJornada}</>}
      </p>
    </div>
  );
}

/** Un grupo (o sede) por renglon, de mejor a peor; el propio en azul, el promedio punteado. */
export function GraficoGrupos({ filas, promedio, etiquetaPropio = 'Este grupo' }: { filas: FilaGrupo[]; promedio: number | null; etiquetaPropio?: string | null }) {
  return (
    <div>
      <ul className="flex flex-col gap-1">
        {filas.map((g) => (
          <li key={g.grado} className="flex items-center gap-2 text-sm" title={`${g.grado}: ${g.porcentajeSinAlerta} % sin ninguna alerta`}>
            <span className={`w-20 shrink-0 truncate ${g.propio ? 'font-bold text-strong' : 'text-soft'}`}>{g.grado}</span>
            <span className="relative h-4 flex-1">
              <span className={`absolute inset-y-0 left-0 rounded-r ${g.propio ? 'bg-accent' : 'bg-line-strong'}`} style={{ width: `${Math.max(1, g.porcentajeSinAlerta)}%` }} />
              {promedio !== null && <span className="absolute -bottom-0.5 -top-0.5 border-l-2 border-dashed border-strong" style={{ left: `${promedio}%` }} />}
            </span>
            <span className={`w-12 shrink-0 text-right tabular-nums ${g.propio ? 'font-bold text-strong' : 'text-soft'}`}>{g.porcentajeSinAlerta} %</span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-muted">
        % sin ninguna alerta.
        {etiquetaPropio && filas.some((g) => g.propio) && <><span className="mx-1 inline-block h-3 w-3 rounded-sm bg-accent align-[-1px]" />{etiquetaPropio}</>}
        {promedio !== null && <><span className="mx-1 inline-block w-5 border-t-2 border-dashed border-strong align-middle" />Promedio ({promedio} %)</>}
      </p>
    </div>
  );
}
