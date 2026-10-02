/**
 * Correcciones sobre una columna entera de la planilla (Julian, 2026-10-01).
 *
 * Dos casos reales: el docente que llena la columna con la marca equivocada («le puse falta
 * a todos») y el que crea una columna por error. «Llenar columna» no sirve para lo primero
 * a proposito —solo toca las casillas vacias, para que un toque accidental no borre el
 * trabajo de media clase—, asi que corregir es otra accion, explicita y con la cifra a la
 * vista. Esta es la logica pura de las dos; la usan la pantalla y la Cloud Function.
 */
import type { MarkCode } from './marks';

export interface PlanCambioColumna {
  /** Sin marca todavia: quedan registradas por primera vez. */
  nuevas: string[];
  /** Con otra marca: es una correccion, y el historial guarda el valor anterior. */
  corregidas: string[];
  /** Ya tenian esa misma marca: no se escriben (escribirlas inflaria el historial). */
  sinCambio: string[];
}

/** Que pasa con cada estudiante si la columna entera pasa a `estado`. */
export function planCambioColumna(
  studentIds: string[],
  marcas: Record<string, { estado?: string } | undefined>,
  estado: MarkCode,
): PlanCambioColumna {
  const plan: PlanCambioColumna = { nuevas: [], corregidas: [], sinCambio: [] };
  for (const id of studentIds) {
    const actual = marcas[id]?.estado;
    if (!actual) plan.nuevas.push(id);
    else if (actual === estado) plan.sinCambio.push(id);
    else plan.corregidas.push(id);
  }
  return plan;
}

/**
 * Lo que hay que escribir para eliminar una columna. Es tedioso a proposito: Julian pidio
 * que no fuera «tan directo» para que nadie la borre por accidente.
 */
export const FRASE_ELIMINAR_COLUMNA = 'eliminar columna';

/** Sin importar mayusculas, tildes ni espacios de mas: lo que se exige es la intencion. */
export function confirmacionEliminarValida(texto: string): boolean {
  const limpio = texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
  return limpio === FRASE_ELIMINAR_COLUMNA;
}

/**
 * Quien puede eliminar una columna (Julian, 2026-10-01): el docente que la creo, mientras
 * no la haya cerrado, y coordinacion en cualquier momento. Sin limite de tiempo por ahora.
 *
 * Para coordinacion esto solo dice «el rol alcanza»: que coordine ESA sede y jornada lo
 * comprueba el servidor contra `asistenciaConfig/autoridadSede` (en la pantalla ya esta
 * implicito: un coordinador solo ve las sesiones que coordina).
 */
export function rolPuedeEliminarSesion(input: {
  rol: string | null;
  correo: string | null;
  sesion: { createdBy?: string; closed?: boolean };
}): boolean {
  if (input.rol === 'coordinador') return true;
  if (input.rol !== 'docente' || !input.correo) return false;
  return input.sesion.createdBy === input.correo && input.sesion.closed !== true;
}
