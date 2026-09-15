/**
 * El borrador de acompañamientos: vive en el navegador de quien edita
 * (PRD.md § Datos: «no viaja entre equipos»), separado por jornada.
 *
 * Lectura y escritura de localStorage SIEMPRE envueltas en try/catch, igual
 * que `src/data/tareas/habitos.ts`: en navegación privada o con datos de
 * sitio bloqueados el acceso lanza excepción, y el editor debe seguir
 * funcionando (solo que sin persistencia) en vez de romperse.
 */

import type { Distribucion, JornadaAcomp } from './tipos';
import { metasDesdeCargaActual } from './metas';

export interface Borrador {
  distribucion: Distribucion;
  /** Id de la publicación vigente sobre la que se armó este borrador. */
  basadoEn: string;
  /** Milisegundos (Date.now()) de la última vez que se guardó. */
  guardadoEn: number;
}

function clave(jornada: JornadaAcomp): string {
  return `mjb:acompanamientos:borrador:${jornada}`;
}

/** Lee el borrador guardado de esa jornada, o null si no hay ninguno o falla el acceso. */
export function leerBorrador(jornada: JornadaAcomp): Borrador | null {
  try {
    const raw = localStorage.getItem(clave(jornada));
    if (!raw) return null;
    const b = JSON.parse(raw) as Borrador;
    // JSON válido no es borrador válido: uno de otra versión rompería el editor.
    const d = b?.distribucion;
    if (!d || d.jornada !== jornada || !Array.isArray(d.zonas) || !Array.isArray(d.asignaciones)) return null;
    return b;
  } catch {
    return null;
  }
}

/** Guarda el borrador de esa jornada. Si falla, el borrador simplemente no persiste. */
export function guardarBorrador(jornada: JornadaAcomp, borrador: Borrador): void {
  try {
    localStorage.setItem(clave(jornada), JSON.stringify(borrador));
  } catch {
    // Sin almacenamiento disponible: se sigue editando en memoria, sin persistir.
  }
}

/** Borra el borrador guardado de esa jornada (botón «Descartar borrador»). */
export function descartarBorrador(jornada: JornadaAcomp): void {
  try {
    localStorage.removeItem(clave(jornada));
  } catch {
    // Nada que hacer: si no se pudo leer tampoco había nada persistido.
  }
}

/**
 * Construye el borrador de arranque a partir de la publicación vigente (copia,
 * no referencia). Si la vigente ya trae metas, se copian tal cual; si no
 * (publicación anterior a esta funcionalidad), arrancan en la carga actual de
 * cada profesor (`metasDesdeCargaActual`).
 */
export function borradorDesdeVigente(vigente: Distribucion, idVigente: string): Borrador {
  const distribucion: Distribucion = {
    jornada: vigente.jornada,
    zonas: vigente.zonas.map((z) => ({ ...z })),
    asignaciones: vigente.asignaciones.map((a) => ({ ...a })),
  };
  distribucion.metas = vigente.metas ? { ...vigente.metas } : metasDesdeCargaActual(distribucion);
  return {
    distribucion,
    basadoEn: idVigente,
    guardadoEn: Date.now(),
  };
}
