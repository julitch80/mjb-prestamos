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

export default function HistorialAcompanamientos({ jornada, publicaciones }: Props) {
  const [seleccionada, setSeleccionada] = useState<string | null>(null);
  const lista = historial(publicaciones, jornada).slice().reverse(); // más reciente primero
  const hoy = fechaHoyLocal();
  const vigenteId = publicacionVigente(publicaciones, jornada, hoy).id;

  return (
    <div className="space-y-2">
      {lista.map((pub) => {
        const esVigente = pub.id === vigenteId;
        const esFutura = pub.vigenteDesde > hoy;
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
              <div className="px-4 pb-4">
                <MatrizSoloLectura distribucion={pub} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
