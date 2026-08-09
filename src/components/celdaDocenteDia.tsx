// Lenguaje visual compartido para mostrar el día efectivo de un docente
// (normal / movida / cancelada / taller / libre). Extraído de
// ModalDiaModificado.tsx para reutilizarlo también en MiDiaModificado.tsx
// sin duplicar los colores y estados por celda.
import { USUARIOS } from '../data/maestros';
import type { BloqueDocenteDia } from '../data/horarioModificado';

export function abrevAula(aula: string): string {
  return aula
    .replace('Aula ', 'A')
    .replace('Lab. Ciencias', 'Lab.')
    .replace('Sala Informática', 'SI')
    .replace('Sala Info.', 'SI');
}

/** Celda de un bloque del día de un docente, coloreada según su estado. */
export function renderCeldaDocenteDia(b: BloqueDocenteDia) {
  if (b.estado === 'libre') {
    return (
      <div className="h-full rounded-lg border border-dashed border-line flex items-center justify-center">
        <span className="text-muted opacity-60 text-[10px]">—</span>
      </div>
    );
  }
  if (b.estado === 'normal') {
    return (
      <div className="h-full rounded-lg border border-line flex flex-col items-center justify-center gap-0.5 px-1">
        <span className="text-[10px] font-bold">{b.grupo}</span>
        <span className="text-[9px] text-muted">{b.aula ? abrevAula(b.aula) : ''}</span>
      </div>
    );
  }
  if (b.estado === 'movida') {
    return (
      <div className="h-full rounded-lg border border-dashed border-info bg-info-soft/40 flex flex-col items-center justify-center gap-0.5 px-1">
        <span className="text-[10px] font-bold text-info-soft-fg">{b.grupo}</span>
        <span className="text-[8px] text-info-soft-fg/80">desde {b.bloqueOriginal}.ª</span>
      </div>
    );
  }
  if (b.estado === 'cancelada') {
    return (
      <div className="h-full rounded-lg border border-dashed border-danger bg-danger-soft/50 flex flex-col items-center justify-center gap-0.5 px-1">
        <span className="text-[10px] font-bold line-through text-danger/80">{b.grupo}</span>
        <span className="text-[9px] text-danger-soft-fg/60">cancelada</span>
      </div>
    );
  }
  // taller
  const supervisorNombre = b.comoSupervisorDe
    ? USUARIOS.find(u => u.id === b.comoSupervisorDe)?.nombreCorto ?? b.comoSupervisorDe
    : undefined;
  return (
    <div className="h-full rounded-lg border border-dashed border-warning bg-warning-soft/40 flex flex-col items-center justify-center gap-0.5 px-1">
      <span className="text-[10px] font-bold text-warning-soft-fg">
        {supervisorNombre ? `Cubres taller de ${supervisorNombre}` : 'Taller'}
      </span>
      <span className="text-[9px] text-warning-soft-fg/80">{b.grupo}</span>
    </div>
  );
}
