import { CalendarDays, CalendarRange } from 'lucide-react';
import type { OpcionVista } from './SelectorVista';

/** Opciones de tiempo para SelectorVista: siempre en este orden, «Día, Semana». */
export const OPCIONES_DIA_SEMANA: OpcionVista<'dia' | 'semana'>[] = [
  { id: 'dia', label: 'Día', Icono: CalendarDays },
  { id: 'semana', label: 'Semana', Icono: CalendarRange },
];
