// Lógica pura de «Simulacros» (docs/simulacros/PLAN.md). Sin imports de firebase.

export type Jornada = 'manana' | 'tarde';
export type Editores = Record<Jornada, string[]>;

export const EDITORES_DEFAULT: Editores = {
  manana: ['julian', 'coord_manana'],
  tarde: ['coord_tarde', 'hugo'],
};

export interface PerfilEditor {
  role?: string;
  slotId?: string | null;
  active?: boolean;
  soloLectura?: boolean;
}

export const esJornada = (j: unknown): j is Jornada => j === 'manana' || j === 'tarde';

/** El superusuario edita todo; los demás solo si su slotId está en los editores de esa jornada. */
export function puedeEditar(perfil: PerfilEditor | null | undefined, editores: Partial<Editores> | null | undefined, jornada: Jornada): boolean {
  if (!perfil || perfil.active !== true || perfil.soloLectura === true) return false;
  if (perfil.role === 'superusuario') return true;
  const lista = editores?.[jornada];
  return !!perfil.slotId && Array.isArray(lista) && lista.includes(perfil.slotId);
}

/** Puede cambiar el estado: superusuario o editor de cualquiera de las dos jornadas. */
export function puedeCambiarEstado(perfil: PerfilEditor | null | undefined, editores: Partial<Editores> | null | undefined): boolean {
  return puedeEditar(perfil, editores, 'manana') || puedeEditar(perfil, editores, 'tarde');
}

export const RE_HORA = /^([01]\d|2[0-3]):[0-5]\d$/;
export function fechaValida(f: unknown): f is string {
  if (typeof f !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(f)) return false;
  const d = new Date(`${f}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === f;
}
export const horaValida = (h: unknown): h is string => typeof h === 'string' && RE_HORA.test(h);
export const puestoIdValido = (p: unknown): p is string => typeof p === 'string' && /^[a-z0-9_]{1,60}$/.test(p);
export const ESTADOS = ['borrador', 'publicado', 'ejecutado', 'archivado'] as const;
export type Estado = (typeof ESTADOS)[number];
export const estadoValido = (e: unknown): e is Estado => typeof e === 'string' && (ESTADOS as readonly string[]).includes(e);
export const idSimulacroValido = (s: unknown): s is string => typeof s === 'string' && /^[a-z0-9_-]{1,60}$/.test(s);

/** Texto de las notificaciones de reasignación. */
export function textoAsignacion(puesto: string, jornada: Jornada, asignado: boolean): { titulo: string; cuerpo: string } {
  const j = jornada === 'manana' ? 'mañana' : 'tarde';
  return asignado
    ? { titulo: 'Simulacro: nuevo rol', cuerpo: `Te asignaron ${puesto} (${j})` }
    : { titulo: 'Simulacro: cambio de rol', cuerpo: `Ya no tienes el rol ${puesto} (${j})` };
}
