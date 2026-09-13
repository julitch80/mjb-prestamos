/**
 * ¿Cuadran los datos antes de generar?
 *
 * Generar tarda minutos y termina en un archivo. Si la asignación pide más
 * horas de las que caben, ese rato está perdido de antemano y el mensaje del
 * final —«no se pudieron ubicar 10 horas»— llega tarde y explica poco.
 *
 * Esta sección hace la misma cuenta que el motor, pero al instante y antes de
 * empezar, y dice el nombre del grupo o de la persona. El caso real que lo
 * justifica: los grupos de la tarde piden 30 horas donde caben 29, y eso se
 * puede saber sin encender el solver.
 */

import { useMemo } from 'react';
import { AlertTriangle, CheckCircle2, Info } from 'lucide-react';

import { construirEntrada } from '../../data/horarios/contrato';
import { revisar } from '../../data/horarios/revision';
import type { Jornada } from '../../data/horarios/tipos';

const QUE_SIGNIFICA: Record<string, string> = {
  grupo: 'A estos grupos no les cabe lo que se les asignó. El horario no podrá salir '
    + 'completo: hay que quitar horas en la asignación académica, o liberar la franja '
    + 'que está reservada.',
  docente: 'Estas personas tienen más horas asignadas que espacios libres en su semana. '
    + 'Revisa su disponibilidad, o sus horas.',
  aula: 'Se pide ese espacio más veces de las que existe en la semana.',
  datos: 'Falta un dato que el motor no puede adivinar.',
};

const ORDEN: Array<'grupo' | 'docente' | 'aula' | 'datos'> = ['grupo', 'docente', 'aula', 'datos'];

export default function RevisionDatos({ sede, jornada, anio }: {
  sede: string; jornada: Jornada; anio: number;
}) {
  const revision = useMemo(() => {
    try {
      const entrada = construirEntrada({ sede, jornada, anio });
      if (entrada.asignacion.length === 0) return null;
      return { r: revisar(entrada), entrada };
    } catch {
      return null;
    }
  }, [sede, jornada, anio]);

  if (!revision) return null;
  const { r, entrada } = revision;
  const horas = entrada.asignacion.reduce((s, f) => s + f.horas, 0);

  if (r.cuadra && r.leves.length === 0) {
    return (
      <div className="rounded-2xl border border-line bg-card p-4 flex items-start gap-2">
        <CheckCircle2 className="w-4 h-4 text-success flex-shrink-0 mt-0.5" />
        <p className="text-muted text-sm">
          <span className="text-strong font-medium">Los datos cuadran.</span>{' '}
          {entrada.grupos.length} grupos y {entrada.docentes.length} docentes,{' '}
          {horas} horas de clase, y todo cabe en la semana.
        </p>
      </div>
    );
  }

  const porAmbito = (grave: boolean) => ORDEN
    .map(a => ({ ambito: a, lista: (grave ? r.graves : r.leves).filter(x => x.ambito === a) }))
    .filter(g => g.lista.length > 0);

  return (
    <div className="flex flex-col gap-3">
      {r.graves.length > 0 && (
        <div className="rounded-2xl border border-danger-soft bg-danger-soft p-5">
          <div className="flex items-center gap-2 text-danger-soft-fg font-medium mb-1">
            <AlertTriangle className="w-4 h-4" />
            Con estos datos el horario no va a salir completo
          </div>
          <p className="text-danger-soft-fg text-sm opacity-80 mb-3">
            Esto se sabe sumando, sin generar nada. Generar igualmente sirve para ver
            cuánto se acerca, pero lo que falte va a seguir faltando.
          </p>
          {porAmbito(true).map(g => (
            <div key={g.ambito} className="mb-3 last:mb-0">
              <p className="text-danger-soft-fg text-xs opacity-80 mb-1">
                {QUE_SIGNIFICA[g.ambito]}
              </p>
              <ul className="text-danger-soft-fg text-sm list-disc pl-5 space-y-0.5">
                {g.lista.slice(0, 12).map((a, i) => (
                  <li key={i}>
                    <span className="font-medium">{a.quien}</span> — {a.mensaje}
                  </li>
                ))}
                {g.lista.length > 12 && <li>… y {g.lista.length - 12} más.</li>}
              </ul>
            </div>
          ))}
        </div>
      )}

      {r.leves.length > 0 && (
        <div className="rounded-2xl border border-line bg-card p-5">
          <div className="flex items-center gap-2 text-strong text-sm font-medium mb-2">
            <Info className="w-4 h-4 text-muted" />
            Conviene mirarlo, pero no impide generar
          </div>
          <ul className="text-muted text-sm list-disc pl-5 space-y-0.5">
            {r.leves.slice(0, 8).map((a, i) => (
              <li key={i}>{a.mensaje}</li>
            ))}
            {r.leves.length > 8 && <li>… y {r.leves.length - 8} más.</li>}
          </ul>
        </div>
      )}
    </div>
  );
}
