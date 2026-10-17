// Pestaña «Académico»: Calendario (por defecto) | Asignación.
import { useState } from 'react';
import { CalendarDays, GraduationCap } from 'lucide-react';
import AsignacionAcademica from '../AsignacionAcademica';
import CalendarioAcademico from './CalendarioAcademico';
import { cn } from '@/lib/utils';

export default function PanelAcademico() {
  const [sub, setSub] = useState<'calendario' | 'asignacion'>('calendario');
  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {([['calendario', 'Calendario', CalendarDays], ['asignacion', 'Asignación', GraduationCap]] as const).map(([id, label, Icono]) => (
          <button key={id} onClick={() => setSub(id)} aria-pressed={sub === id}
            className={cn('flex items-center gap-1.5 text-sm font-medium px-4 py-2 rounded-full transition',
              sub === id ? 'bg-accent text-strong' : 'bg-elevated text-soft hover:text-strong')}>
            <Icono size={15} />{label}
          </button>
        ))}
      </div>
      {sub === 'calendario' ? <CalendarioAcademico /> : <AsignacionAcademica />}
    </div>
  );
}
