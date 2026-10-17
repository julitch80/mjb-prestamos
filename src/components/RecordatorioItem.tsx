import { getAsignatura } from '../data/asignacionAcademica';
import type { FechaISO, Tarea } from '../data/tareas/tipos';
import { cuentaRegresiva, iconoRecordatorio } from '../data/tareas/recordatorios';
import DetalleTarea from './DetalleTarea';

/**
 * Recordatorio en la agenda del estudiante: otro color (ámbar) y su ícono, aparte de
 * las tareas. No se marca como hecho, no tiene momentos ni «¿cuándo la vas a hacer?».
 * Con `hoy` muestra la cuenta regresiva («mañana», «en 3 días») — es el bloque «Lo que viene».
 */
export default function RecordatorioItem({ t, hoy, mostrarFecha = false, abierto = false }: {
  t: Tarea; hoy?: FechaISO; mostrarFecha?: boolean; abierto?: boolean;
}) {
  const asignatura = getAsignatura(t.asignaturaId)?.nombre ?? t.asignaturaId;
  return (
    <div className="rounded-xl border border-warning bg-warning-soft text-warning-soft-fg px-3 py-2.5">
      <div className="flex items-start gap-2">
        <span className="text-base leading-none mt-0.5" aria-hidden>{iconoRecordatorio(t)}</span>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold break-words">{t.titulo}</div>
          <div className="text-[11px] opacity-80">
            {asignatura}
            {mostrarFecha && ` · ${t.fechaEntrega.slice(8)}/${t.fechaEntrega.slice(5, 7)}`}
          </div>
        </div>
        {hoy && (
          <span className="text-[11px] font-bold whitespace-nowrap">{cuentaRegresiva(t.fechaEntrega, hoy)}</span>
        )}
      </div>
      <DetalleTarea t={t} abiertoInicial={abierto} />
    </div>
  );
}
