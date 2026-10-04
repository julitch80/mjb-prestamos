// Lógica pura del codebase `classroom` (sin red ni Firebase): testeable aparte.

export const API_CLASSROOM = 'https://classroom.googleapis.com/v1';

export interface CursoCrudo { id?: string; name?: string; section?: string }
export interface CursoResumen { id: string; nombre: string; seccion: string }

/** Ruta de la lista de cursos activos donde la persona es profesora. */
export function urlCursosDelDocente(pageSize = 50): string {
  const q = new URLSearchParams({ teacherId: 'me', courseStates: 'ACTIVE', pageSize: String(pageSize) });
  return `/courses?${q.toString()}`;
}

/** Deja solo id, nombre y sección (nada más sale hacia el cliente). */
export function mapearCursos(crudos: CursoCrudo[] | undefined): CursoResumen[] {
  return (crudos ?? [])
    .filter((c) => !!c.id)
    .map((c) => ({ id: String(c.id), nombre: c.name ?? '', seccion: c.section ?? '' }));
}

/** Clasifica el fallo al pedir el token de delegación de dominio. */
export function clasificarErrorToken(mensaje: string): 'sin-autorizacion' | 'otro' {
  return /unauthorized_client|access_denied|\b403\b|invalid_grant/i.test(mensaje) ? 'sin-autorizacion' : 'otro';
}
