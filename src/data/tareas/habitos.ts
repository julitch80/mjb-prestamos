// Hábitos de estudio del módulo de Tareas: "¿cuándo la vas a hacer?" y el
// tachado de tareas hechas.
//
// TODO SE GUARDA SOLO EN ESTE DISPOSITIVO (localStorage). La agenda del grupo
// es pública y sin login — no hay cuenta de estudiante ni servidor donde
// guardar esto, y así debe seguir: cualquier cosa que pareciera "seguimiento"
// sería mentira, porque un hermano usando el mismo teléfono la rompe y se
// pierde al borrar datos del navegador. Nadie más que el propio estudiante ve
// lo que marca aquí. No crear un backend para esto.

import type { FechaISO, Tarea } from './tipos';

// ── Anclas: el momento concreto de la tarde en que se hará la tarea ─────────
//
// PROVISIONAL: esta lista la redacta Julián con estudiantes reales antes de
// darla por buena. Lo que hace que la función se use o no es que la frase
// suene a la rutina real del estudiante, no a redacción de adulto. Editar
// aquí, juntas — no repartir texto de anclas por otros archivos.
export interface Ancla {
  id: string;
  label: string;
}

// Mañana: salen a mediodía, así que el almuerzo separa "llegar" de "la tarde".
export const ANCLAS_MANANA: Ancla[] = [
  { id: 'llegar_casa', label: 'Al llegar a la casa' },
  { id: 'despues_almuerzo', label: 'Después de almorzar' },
  { id: 'en_la_tarde', label: 'En la tarde' },
  { id: 'en_la_noche', label: 'En la noche' },
];

// Tarde: entran a mediodía y salen a las 6pm — están EN CLASE después de
// almorzar, por eso esa opción no existe para ellos (sería absurda).
export const ANCLAS_TARDE: Ancla[] = [
  { id: 'antes_de_venir', label: 'En la mañana, antes de venir' },
  { id: 'llegar_casa', label: 'Al llegar a la casa' },
  { id: 'en_la_noche', label: 'En la noche' },
];

export const ANCLA_OTRO = 'otro';
export const ANCLA_OTRO_MAX = 30;

// ── Anclas por grupo (docs/anclas-por-grupo-contrato.md) ────────────────────
//
// El director de grupo puede reemplazar estas anclas por el acuerdo real de
// SU curso ("nosotros dijimos que estudiamos al llegar..."). Se guardan en
// Apps Script (hoja AnclasGrupo) y llegan en `getDatosTareas().anclas`, bajo
// la clave del grupo. Tope validado también en servidor: no confiar solo en
// el cliente.
export const ANCLAS_GRUPO_MAX = 6;
export const ANCLA_LABEL_MAX = 30;

/** Jornada del grupo por su notación: 'º' = tarde (6º1, 7º2), punto = mañana (9.1, 10.2). */
export function jornadaDeGrupo(grupo: string): 'manana' | 'tarde' {
  return grupo.includes('º') ? 'tarde' : 'manana';
}

/** Anclas por defecto de la jornada del grupo — el punto de partida antes de que el director las edite. */
export function anclasPorDefecto(grupo: string): Ancla[] {
  return jornadaDeGrupo(grupo) === 'tarde' ? ANCLAS_TARDE : ANCLAS_MANANA;
}

/**
 * Anclas efectivas de un grupo: las que definió su director si existen, si no
 * las de por defecto de su jornada. `anclasPorGrupo` es lo que llega de
 * `getDatosTareas().anclas` — un backend que todavía no manda esa clave (o
 * que no tiene nada para este grupo) hace que esto se comporte exactamente
 * como antes de este cambio.
 */
export function anclasDeGrupo(grupo: string, anclasPorGrupo?: Record<string, Ancla[]>): Ancla[] {
  const propias = anclasPorGrupo?.[grupo];
  return propias && propias.length > 0 ? propias : anclasPorDefecto(grupo);
}

// ── Almacenamiento por dispositivo ───────────────────────────────────────────

const CLAVE_MOMENTOS = 'mjb_habitos_momentos_v1'; // { [tareaId]: { anclaId, texto? } }
const CLAVE_TACHADAS = 'mjb_habitos_tachadas_v1';  // { [tareaId]: true }

export interface MomentoElegido {
  anclaId: string;
  /** Texto libre cuando anclaId === ANCLA_OTRO. */
  texto?: string;
  /**
   * Copia del texto del ancla en el momento de elegirla.
   *
   * Se guarda por duplicado A PROPOSITO. Las anclas son PROVISIONALES: estan
   * puestas de memoria y hay que ajustarlas con estudiantes reales. El dia que
   * se cambien, quien hubiera elegido una que se renombro o desaparecio veria
   * su eleccion esfumarse sin aviso, porque el id guardado ya no existiria en
   * la lista. Con la copia, la eleccion sobrevive al cambio.
   */
  label?: string;
}

// Lectura y escritura de localStorage SIEMPRE envueltas en try/catch: en
// navegación privada o con datos de sitio bloqueados el acceso lanza
// excepción, y una agenda pública que revienta en blanco es peor que una
// agenda sin estas funciones. Si falla, se comporta como si no hubiera nada
// guardado y la agenda sigue funcionando igual que antes de esta función.
function leerMapa<T>(clave: string): Record<string, T> {
  try {
    const raw = localStorage.getItem(clave);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function escribirMapa<T>(clave: string, mapa: Record<string, T>): void {
  try {
    localStorage.setItem(clave, JSON.stringify(mapa));
  } catch {
    // Sin almacenamiento disponible: la elección simplemente no persiste.
  }
}

export function leerMomentos(): Record<string, MomentoElegido> {
  return leerMapa<MomentoElegido>(CLAVE_MOMENTOS);
}

export function guardarMomento(
  grupo: string,
  tareaId: string,
  momento: MomentoElegido | null,
  anclasPorGrupo?: Record<string, Ancla[]>,
): void {
  const mapa = leerMomentos();
  if (momento) {
    // Se guarda tambien el TEXTO del ancla, no solo su id (ver MomentoElegido):
    // asi la eleccion del estudiante sobrevive a que la lista de anclas cambie.
    const ancla = anclasDeGrupo(grupo, anclasPorGrupo).find(a => a.id === momento.anclaId);
    mapa[tareaId] = ancla ? { ...momento, label: ancla.label } : momento;
  } else {
    delete mapa[tareaId];
  }
  escribirMapa(CLAVE_MOMENTOS, mapa);
}

export function leerTachadas(): Record<string, true> {
  return leerMapa<true>(CLAVE_TACHADAS);
}

export function alternarTachada(tareaId: string): boolean {
  const mapa = leerTachadas();
  const nuevoValor = !mapa[tareaId];
  if (nuevoValor) mapa[tareaId] = true;
  else delete mapa[tareaId];
  escribirMapa(CLAVE_TACHADAS, mapa);
  return nuevoValor;
}

export function etiquetaMomento(
  grupo: string,
  momento: MomentoElegido | undefined,
  anclasPorGrupo?: Record<string, Ancla[]>,
): string | null {
  if (!momento) return null;
  if (momento.anclaId === ANCLA_OTRO) return momento.texto || null;
  const ancla = anclasDeGrupo(grupo, anclasPorGrupo).find(a => a.id === momento.anclaId);
  // La lista manda si el ancla sigue existiendo (asi un cambio de redaccion se
  // ve al instante), pero si ya no esta se recurre a la copia guardada en vez
  // de devolver null: perder la eleccion del estudiante es peor que mostrarle
  // un texto viejo.
  return ancla?.label ?? momento.label ?? null;
}

/** Todas las tareas activas del grupo, para precargar los mapas una sola vez por render. */
export function idsDeTareas(tareas: Tarea[]): string[] {
  return tareas.map(t => t.id);
}

// Clave de "hoy" usada para saber si conviene seguir mostrando lo tachado —
// no se limpia automáticamente: "al día siguiente sigue viéndose lo que
// quedó pendiente" es un requisito explícito, así que las tachadas NO
// expiran solas. Se acumulan; es un mapa de tareaId, no de (tarea, día), y
// las tareas están acotadas en el tiempo (module de Tareas ya las purga).
export type { FechaISO };
