// Calendario académico 2026: modelo de datos.
export type CategoriaCal =
  | 'periodo' | 'receso' | 'vacaciones_docentes' | 'desarrollo_institucional'
  | 'entrega_docente' | 'reunion' | 'institucional';

export interface CambioCal {
  /** Valores anteriores de las fechas/estado, para mostrarlos tachados. */
  antes: { desde: string; hasta?: string; porDefinir?: boolean; noSeRealiza?: boolean };
  /** ISO de cuando se hizo el cambio. */
  cuando: string;
}

export interface EventoCal {
  id: string;
  titulo: string;
  desde: string;            // 'YYYY-MM-DD'
  hasta?: string;
  porDefinir?: boolean;
  noSeRealiza?: boolean;
  categoria: CategoriaCal;
  aplicaA?: 'todos' | 'grado11';
  alertaDocente: boolean;
  nota?: string;
  cambio?: CambioCal;
}

export const CATEGORIAS: { id: CategoriaCal; label: string; color: string }[] = [
  { id: 'periodo', label: 'Periodos', color: '#3b82f6' },
  { id: 'receso', label: 'Recesos', color: '#10b981' },
  { id: 'vacaciones_docentes', label: 'Vacaciones docentes', color: '#14b8a6' },
  { id: 'desarrollo_institucional', label: 'Desarrollo institucional', color: '#8b5cf6' },
  { id: 'entrega_docente', label: 'Entregas y cierres', color: '#ef4444' },
  { id: 'reunion', label: 'Reuniones y comisiones', color: '#f59e0b' },
  { id: 'institucional', label: 'Institucional', color: '#ec4899' },
];
export const colorCategoria = (c: CategoriaCal) => CATEGORIAS.find(x => x.id === c)?.color ?? '#94a3b8';
