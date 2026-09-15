// Pantalla «Historial» (tarea 8): las publicaciones de la jornada, de más
// reciente a más antigua, con la matriz de solo lectura al tocar una.

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { USUARIOS } from '../../data/maestros';
import type { Distribucion, JornadaAcomp, Publicacion } from '../../data/acompanamientos/tipos';
import { DIAS } from '../../data/acompanamientos/tipos';
import { historial, publicacionVigente } from '../../data/acompanamientos/vigente';
import { fechaLegibleAcomp } from '../../data/acompanamientos/textos';

interface Props {
  jornada: JornadaAcomp;
  publicaciones: Publicacion[];
  /** Si viene, se ofrece cancelar las publicaciones programadas que aún no rigen. */
  onCancelar?: (pub: Publicacion) => Promise<void>;
}

const DIA_LABEL: Record<string, string> = {
  lunes: 'Lunes', martes: 'Martes', miercoles: 'Miércoles', jueves: 'Jueves', viernes: 'Viernes',
};

function fechaHoyLocal(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function MatrizSoloLectura({ distribucion }: { distribucion: Distribucion }) {
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

export default function HistorialAcompanamientos({ jornada, publicaciones, onCancelar }: Props) {
  const [seleccionada, setSeleccionada] = useState<string | null>(null);
  const [confirmando, setConfirmando] = useState<string | null>(null);
  const [cancelando, setCancelando] = useState(false);
  const [errorCancelar, setErrorCancelar] = useState<string | null>(null);
  const lista = historial(publicaciones, jornada).slice().reverse(); // más reciente primero
  const hoy = fechaHoyLocal();
  const vigenteId = publicacionVigente(publicaciones, jornada, hoy).id;

  return (
    <div className="space-y-2">
      {lista.map((pub) => {
        const esVigente = pub.id === vigenteId;
        const cancelada = !!pub.canceladaPor;
        const esFutura = pub.vigenteDesde > hoy && !cancelada;
        return (
          <div key={pub.id} className="rounded-xl border border-line bg-card overflow-hidden">
            <button
              onClick={() => setSeleccionada(seleccionada === pub.id ? null : pub.id)}
              className="w-full text-left px-4 py-3 flex items-center justify-between gap-2 hover:bg-hover transition"
            >
              <div>
                {pub.esInicial ? (
                  <p className="text-strong text-sm font-semibold">
                    Distribución inicial <span className="text-muted font-normal">· la que estaba en el programa</span>
                  </p>
                ) : (
                  <p className="text-strong text-sm font-semibold">
                    Rige desde el {fechaLegibleAcomp(pub.vigenteDesde)}
                    <span className="text-muted font-normal"> · publicada por {pub.publicadoPorNombre}{' '}
                      {pub.publicadoEn ? `el ${fechaLegibleAcomp(new Date(pub.publicadoEn).toISOString().slice(0, 10))}` : ''}
                    </span>
                  </p>
                )}
                <div className="flex gap-2 mt-1">
                  {esVigente && (
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-success-soft-fg bg-success-soft border border-success rounded-full px-2 py-0.5">
                      rige hoy
                    </span>
                  )}
                  {cancelada && (
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-danger-soft-fg bg-danger-soft border border-danger rounded-full px-2 py-0.5">
                      cancelada por {pub.canceladaPorNombre || pub.canceladaPor}
                    </span>
                  )}
                  {esFutura && (
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-info-soft-fg bg-info-soft border border-info rounded-full px-2 py-0.5">
                      programada
                    </span>
                  )}
                </div>
              </div>
              <span className={cn('text-muted transition-transform', seleccionada === pub.id && 'rotate-180')}>⌄</span>
            </button>
            {seleccionada === pub.id && (
              <div className="px-4 pb-4 space-y-2">
                {esFutura && onCancelar && (
                  confirmando === pub.id ? (
                    <div className="rounded-lg border border-danger bg-danger-soft px-3 py-2 space-y-2">
                      <p className="text-danger-soft-fg text-xs">
                        ¿Cancelar la publicación que iba a regir desde el {fechaLegibleAcomp(pub.vigenteDesde)}? No se borra: queda en el historial como cancelada y nunca rige.
                      </p>
                      {errorCancelar && <p className="text-danger-soft-fg text-xs font-semibold">No se pudo cancelar: {errorCancelar}</p>}
                      <div className="flex gap-2">
                        <button onClick={() => { setConfirmando(null); setErrorCancelar(null); }} className="rounded-lg border border-line px-3 py-1.5 text-xs text-soft hover:bg-hover transition">No</button>
                        <button
                          disabled={cancelando}
                          onClick={async () => {
                            setCancelando(true); setErrorCancelar(null);
                            try { await onCancelar(pub); setConfirmando(null); }
                            catch (e) { setErrorCancelar(e instanceof Error ? e.message : 'error desconocido'); }
                            finally { setCancelando(false); }
                          }}
                          className="rounded-lg bg-danger text-white px-3 py-1.5 text-xs font-semibold hover:opacity-90 transition disabled:opacity-60"
                        >
                          {cancelando ? 'Cancelando…' : 'Sí, cancelarla'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex justify-end">
                      <button onClick={() => setConfirmando(pub.id)} className="rounded-lg border border-danger px-3 py-1.5 text-xs font-semibold text-danger-soft-fg hover:bg-danger-soft transition">
                        Cancelar esta publicación
                      </button>
                    </div>
                  )
                )}
                <MatrizSoloLectura distribucion={pub} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
