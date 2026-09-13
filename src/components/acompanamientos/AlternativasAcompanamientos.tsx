// Pantalla «Generar alternativas» (tarea 6.4): pide al generador unas cuantas
// propuestas completas y deja usar la que convenga como nuevo borrador.

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { USUARIOS } from '../../data/maestros';
import type { Distribucion, Publicacion } from '../../data/acompanamientos/tipos';
import { DIAS } from '../../data/acompanamientos/tipos';
import { generarAlternativas, type Alternativa } from '../../data/acompanamientos/generador';

interface Props {
  borrador: Distribucion;
  vigente: Publicacion;
  onUsar: (d: Distribucion) => void;
}

const DIA_LABEL: Record<string, string> = {
  lunes: 'Lunes', martes: 'Martes', miercoles: 'Miércoles', jueves: 'Jueves', viernes: 'Viernes',
};

function huboCambiosFrenteAVigente(borrador: Distribucion, vigente: Publicacion): boolean {
  const clave = (d: Distribucion) =>
    new Set(d.asignaciones.map((a) => `${a.zonaId}|${a.dia}|${a.docenteId}`));
  const a = clave(borrador);
  const b = clave(vigente);
  if (a.size !== b.size) return true;
  for (const k of a) if (!b.has(k)) return true;
  return false;
}

/** Vista compacta de solo lectura de una distribución (matriz zonas × días). */
function MatrizCompacta({ distribucion }: { distribucion: Distribucion }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-line">
      <table className="text-[11px] border-collapse w-full" style={{ minWidth: 420 }}>
        <thead>
          <tr className="border-b border-line">
            <th className="text-left px-2 py-1.5 text-muted font-medium">Zona</th>
            {DIAS.map((dia) => (
              <th key={dia} className="text-center px-1 py-1.5 text-soft font-semibold min-w-[70px]">
                {DIA_LABEL[dia]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {distribucion.zonas.map((zona) => (
            <tr key={zona.id} className="border-b border-line/50">
              <td className="px-2 py-1 font-semibold text-strong whitespace-nowrap">{zona.nombre}</td>
              {DIAS.map((dia) => {
                const asignados = distribucion.asignaciones.filter((a) => a.zonaId === zona.id && a.dia === dia);
                return (
                  <td key={dia} className="px-1 py-1">
                    <div className="flex flex-wrap gap-0.5 justify-center">
                      {asignados.length === 0 ? (
                        <span className="text-muted opacity-50">—</span>
                      ) : (
                        asignados.map((a) => {
                          const u = USUARIOS.find((x) => x.id === a.docenteId);
                          return (
                            <span
                              key={a.docenteId}
                              className="rounded px-1 py-0.5 font-bold"
                              style={{ color: u?.color ?? '#94a3b8', backgroundColor: `${u?.color ?? '#94a3b8'}18` }}
                            >
                              {u?.nombreCorto ?? a.docenteId}
                            </span>
                          );
                        })
                      )}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function AlternativasAcompanamientos({ borrador, vigente, onUsar }: Props) {
  const [alternativas, setAlternativas] = useState<Alternativa[] | null>(null);
  const [generando, setGenerando] = useState(false);
  const [confirmarUso, setConfirmarUso] = useState<number | null>(null);

  const candados = borrador.asignaciones.filter((a) => a.candado).length;

  function generar() {
    setGenerando(true);
    setAlternativas(null);
    // setTimeout para que la pantalla alcance a pintar "Buscando…" antes del cómputo.
    setTimeout(() => {
      const resultado = generarAlternativas(borrador, { cantidad: 3, referencia: vigente, semilla: Date.now() % 100000 });
      setAlternativas(resultado);
      setGenerando(false);
    }, 30);
  }

  function usar(alt: Alternativa) {
    if (huboCambiosFrenteAVigente(borrador, vigente)) {
      setConfirmarUso(alternativas!.indexOf(alt));
      return;
    }
    onUsar(alt.distribucion);
  }

  function confirmarYUsar(idx: number) {
    onUsar(alternativas![idx].distribucion);
    setConfirmarUso(null);
  }

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-line bg-elevated/40 px-4 py-3 space-y-2">
        <p className="text-soft text-xs">
          Rehacen todo menos lo que tiene candado ({candados} asignación{candados === 1 ? '' : 'es'} fija{candados === 1 ? '' : 's'}).
        </p>
        <button
          onClick={generar}
          disabled={generando}
          className="rounded-lg bg-accent text-accent-fg px-3 py-2 text-sm font-semibold hover:opacity-90 transition disabled:opacity-60"
        >
          {generando ? 'Buscando…' : 'Generar alternativas'}
        </button>
      </div>

      {alternativas && (
        <div className="space-y-3">
          {alternativas.map((alt, i) => (
            <div key={i} className="rounded-xl border border-line bg-card p-3 space-y-2">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <p className="text-strong text-sm font-semibold">Propuesta {i + 1}/{alternativas.length}</p>
                <button
                  onClick={() => usar(alt)}
                  className="rounded-lg bg-accent text-accent-fg px-3 py-1.5 text-xs font-semibold hover:opacity-90 transition"
                >
                  Usar esta propuesta
                </button>
              </div>

              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-soft">
                <span>Cambian {alt.metricas.profesoresQueCambian} profesor{alt.metricas.profesoresQueCambian === 1 ? '' : 'es'} frente a la distribución vigente</span>
                <span>
                  Diferencia de carga:{' '}
                  {alt.metricas.diferenciaCarga === 0 ? 'todos quedan parejos' : alt.metricas.diferenciaCarga.toFixed(1)}
                </span>
                <span>
                  Días cargados:{' '}
                  {alt.metricas.diasCargados === 0 ? 'ninguno en día de 5-6 clases' : alt.metricas.diasCargados}
                </span>
              </div>

              {alt.metricas.faltantes.length > 0 && (
                <div className="rounded-lg bg-warning-soft border border-warning px-3 py-2 space-y-1">
                  {alt.metricas.faltantes.map((f, j) => (
                    <p key={j} className="text-warning-soft-fg text-xs">
                      {DIA_LABEL[f.dia]} · {borrador.zonas.find((z) => z.id === f.zonaId)?.nombre ?? f.zonaId}: {f.motivo}
                    </p>
                  ))}
                </div>
              )}

              <MatrizCompacta distribucion={alt.distribucion} />

              {confirmarUso === i && (
                <div className="rounded-lg bg-warning-soft border border-warning px-3 py-2 space-y-2">
                  <p className="text-warning-soft-fg text-xs">Tu borrador actual se reemplaza por esta propuesta.</p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => confirmarYUsar(i)}
                      className="rounded-lg bg-warning-soft-fg/90 text-white px-3 py-1.5 text-xs font-semibold hover:opacity-90 transition"
                    >
                      Confirmar
                    </button>
                    <button
                      onClick={() => setConfirmarUso(null)}
                      className={cn('rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-soft hover:bg-hover transition')}
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
