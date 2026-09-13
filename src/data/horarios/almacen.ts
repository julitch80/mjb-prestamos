/**
 * Guarda los horarios generados en el navegador del coordinador.
 *
 * No van al servidor todavía, y es a propósito: la app está a mitad de la
 * migración a Firebase y enganchar este módulo a una migración inconclusa sería
 * heredar problemas ajenos. Mientras tanto, cada horario que se carga queda como
 * una versión fechada que se puede recuperar, comparar o exportar a archivo.
 *
 * Nada de esto toca el horario vigente del colegio: son borradores para revisar.
 */

import type { Jornada, SalidaGenerador } from './tipos';

const CLAVE = 'mjb.horarios.versiones';
const CLAVE_ACTIVA = 'mjb.horarios.activa';

/** Más de esto no cabe cómodamente en el navegador, y tampoco hace falta. */
const MAXIMO_VERSIONES = 10;

export interface VersionHorario {
  id: string;
  nombre: string;
  guardadaEn: string;
  salida: SalidaGenerador;
}

/** Lo que se muestra en la lista, sin arrastrar las 590 clases de cada versión. */
export interface ResumenVersion {
  id: string;
  nombre: string;
  guardadaEn: string;
  clases: number;
  estado: SalidaGenerador['estado'];
  cobertura: number;
  /** Qué jornadas cubre. Un borrador es de una jornada, no del colegio entero. */
  jornadas: Jornada[];
  activa: boolean;
}

/**
 * El navegador puede negarse a guardar (ventana privada, cuota llena, permisos).
 * Nunca debe tumbar la pantalla por eso: se devuelve el fallo y se sigue.
 */
function leerCrudo(): VersionHorario[] {
  try {
    const texto = localStorage.getItem(CLAVE);
    return texto ? (JSON.parse(texto) as VersionHorario[]) : [];
  } catch {
    return [];
  }
}

function escribirCrudo(versiones: VersionHorario[]): boolean {
  try {
    localStorage.setItem(CLAVE, JSON.stringify(versiones));
    return true;
  } catch {
    return false;
  }
}

export function listarVersiones(): ResumenVersion[] {
  const activa = idVersionActiva();
  return leerCrudo()
    .map(v => ({
      id: v.id,
      nombre: v.nombre,
      guardadaEn: v.guardadaEn,
      clases: v.salida.horario.length,
      estado: v.salida.estado,
      jornadas: [...new Set(v.salida.horario.map(c => c.jornada))].sort() as Jornada[],
      cobertura: v.salida.metricas?.cobertura_pct ?? 0,
      activa: v.id === activa,
    }))
    .sort((a, b) => b.guardadaEn.localeCompare(a.guardadaEn));
}

export function obtenerVersion(id: string): SalidaGenerador | null {
  return leerCrudo().find(v => v.id === id)?.salida ?? null;
}

export function idVersionActiva(): string | null {
  try {
    return localStorage.getItem(CLAVE_ACTIVA);
  } catch {
    return null;
  }
}

export function horarioActivo(): SalidaGenerador | null {
  const id = idVersionActiva();
  return id ? obtenerVersion(id) : null;
}

export function activar(id: string | null): void {
  try {
    if (id) localStorage.setItem(CLAVE_ACTIVA, id);
    else localStorage.removeItem(CLAVE_ACTIVA);
  } catch {
    /* si el navegador no deja guardar, la versión simplemente no queda marcada */
  }
}

export interface ResultadoGuardado {
  ok: boolean;
  id?: string;
  mensaje?: string;
}

export function guardarVersion(salida: SalidaGenerador, nombre: string): ResultadoGuardado {
  const version: VersionHorario = {
    // La marca de tiempo sola no basta: dos versiones guardadas en el mismo
    // milisegundo compartirian identificador y una pisaria a la otra.
    id: `h${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`,
    nombre: nombre.trim() || 'Horario generado',
    guardadaEn: new Date().toISOString(),
    salida,
  };

  // Se conservan las diez más recientes y las demás se descartan. La recién
  // guardada queda siempre la primera, así que la activa nunca se pierde por
  // este recorte. Las que salen se pueden recuperar del archivo del motor.
  const versiones = [version, ...leerCrudo()].slice(0, MAXIMO_VERSIONES);

  if (!escribirCrudo(versiones)) {
    return {
      ok: false,
      mensaje: 'El navegador no dejó guardar la versión. Puede que esté en modo privado '
        + 'o sin espacio. El horario se ve igual, pero no seguirá aquí al recargar.',
    };
  }
  activar(version.id);
  return { ok: true, id: version.id };
}

export function borrarVersion(id: string): void {
  const versiones = leerCrudo().filter(v => v.id !== id);
  escribirCrudo(versiones);
  if (idVersionActiva() === id) activar(versiones[0]?.id ?? null);
}

/** Solo para las pruebas y para empezar de cero. */
export function borrarTodo(): void {
  try {
    localStorage.removeItem(CLAVE);
    localStorage.removeItem(CLAVE_ACTIVA);
  } catch {
    /* nada que hacer */
  }
}
