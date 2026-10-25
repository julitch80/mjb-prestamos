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

export const CATEGORIAS: { id: CategoriaCal; label: string; color: string; simbolo: string }[] = [
  { id: 'periodo', label: 'Periodos', color: '#3b82f6', simbolo: '●' },
  { id: 'receso', label: 'Recesos', color: '#10b981', simbolo: '▲' },
  { id: 'vacaciones_docentes', label: 'Vacaciones docentes', color: '#14b8a6', simbolo: '◆' },
  { id: 'desarrollo_institucional', label: 'Desarrollo institucional', color: '#8b5cf6', simbolo: '■' },
  { id: 'entrega_docente', label: 'Entregas y cierres', color: '#ef4444', simbolo: '✕' },
  { id: 'reunion', label: 'Reuniones y comisiones', color: '#f59e0b', simbolo: '◐' },
  { id: 'institucional', label: 'Institucional', color: '#ec4899', simbolo: '★' },
];
export const colorCategoria = (c: CategoriaCal) => CATEGORIAS.find(x => x.id === c)?.color ?? '#94a3b8';

export const simboloCategoria = (c: CategoriaCal) => CATEGORIAS.find(x => x.id === c)?.simbolo ?? '•';
