/**
 * Cómo es la semana del colegio este año.
 *
 * Hasta ahora esto vivía escrito en el código: la franja del Centro de Interés,
 * cuántos bloques tiene cada jornada, qué días van los grupos de media técnica
 * en contrajornada. Funcionaba porque son los datos de 2026 y no cambian dentro
 * del año — pero cambian entre años, y quien los conoce es el coordinador, no
 * quien programa. Con esto los puede cambiar él antes de generar.
 *
 * Se guarda en el navegador, como los borradores. No toca los datos maestros de
 * la app: es una capa encima que solo el generador lee. Si no hay nada guardado,
 * todo funciona exactamente como antes, con los valores deducidos del horario
 * vigente.
 */

import { ASIGNATURAS } from '../asignacionAcademica';
import { BLOQUES_MANANA, BLOQUES_TARDE } from '../maestros';
import { CONTRAJORNADAS_MT } from '../tareas/calendario';
import { DIAS, type Dia, type Franja, type Jornada } from './tipos';

const CLAVE = 'mjb.horarios.configuracion';

/** Materias que conviene poner temprano si nadie dice otra cosa. */
export const EXIGENTES_POR_DEFECTO = ['matematicas', 'fisica', 'quimica', 'lengua'];

export interface ConfiguracionAnio {
  /** Días con clase. Casi siempre los cinco, pero no tiene por qué. */
  diasLectivos: Dia[];
  /** Cuántas horas de clase tiene el día en cada jornada. */
  bloques: Record<Jornada, number>;
  /** Franja reservada al Centro de Interés. `null` = esa jornada no reserva ninguna. */
  centroInteres: Record<Jornada, Franja | null>;
  /** Materias que el motor intentará poner en las primeras horas. */
  exigentes: string[];
  /** Días en que cada grupo de media técnica va en contrajornada. */
  contrajornada: Record<string, Dia[]>;
  /**
   * Horas en que un docente NO puede recibir clase, marcadas a mano.
   *
   * Se SUMAN a las que la app ya deduce sola (quien baja a la tarde no está en
   * la mañana esos días). Aquí van las que solo conoce el coordinador: una
   * comisión, un permiso, y sobre todo las horas de media técnica, que ocurren
   * de verdad aunque no estén en la asignación y hoy el motor no las ve.
   */
  noDisponible: Record<string, Array<{ jornada: Jornada; dia: Dia; bloques: number[] }>>;
}

/**
 * Lo que hay hoy en los datos de la app, que es de donde se parte.
 *
 * La franja del Centro de Interés de la mañana no está escrita en ningún sitio:
 * se deduce de dónde están esas clases en el horario vigente. Por eso el valor
 * por defecto se calcula y no se declara.
 */
export function configuracionPorDefecto(ciManana?: Franja): ConfiguracionAnio {
  return {
    diasLectivos: [...DIAS],
    bloques: { manana: BLOQUES_MANANA.length, tarde: BLOQUES_TARDE.length },
    centroInteres: {
      manana: ciManana ?? { dia: 'martes', bloque: BLOQUES_MANANA.length },
      tarde: { dia: 'martes', bloque: 1 },
    },
    exigentes: [...EXIGENTES_POR_DEFECTO],
    contrajornada: Object.fromEntries(
      Object.entries(CONTRAJORNADAS_MT).map(([g, d]) => [g, [...(d as Dia[])]]),
    ),
    noDisponible: {},
  };
}

function leerCrudo(): Partial<ConfiguracionAnio> | null {
  // El navegador puede negarse a leer (ventana privada, permisos). Nunca debe
  // tumbar la pantalla: se sigue con los valores por defecto.
  try {
    const texto = localStorage.getItem(CLAVE);
    return texto ? (JSON.parse(texto) as Partial<ConfiguracionAnio>) : null;
  } catch {
    return null;
  }
}

/**
 * La configuración vigente: lo guardado por encima de lo que traen los datos.
 *
 * Se mezcla campo a campo en vez de aceptar el objeto guardado tal cual, porque
 * una versión vieja puede no traer un campo que hoy existe. Sin la mezcla, ese
 * campo llegaría vacío al generador y la semana saldría sin días.
 */
export function leerConfiguracion(ciManana?: Franja): ConfiguracionAnio {
  const base = configuracionPorDefecto(ciManana);
  const guardado = leerCrudo();
  if (!guardado) return base;
  return {
    diasLectivos: guardado.diasLectivos?.length ? guardado.diasLectivos : base.diasLectivos,
    bloques: { ...base.bloques, ...(guardado.bloques ?? {}) },
    centroInteres: { ...base.centroInteres, ...(guardado.centroInteres ?? {}) },
    exigentes: guardado.exigentes ?? base.exigentes,
    contrajornada: { ...base.contrajornada, ...(guardado.contrajornada ?? {}) },
    noDisponible: guardado.noDisponible ?? base.noDisponible,
  };
}

export function guardarConfiguracion(config: ConfiguracionAnio): { ok: boolean; mensaje?: string } {
  try {
    localStorage.setItem(CLAVE, JSON.stringify(config));
    return { ok: true };
  } catch {
    return {
      ok: false,
      mensaje: 'El navegador no dejó guardar la configuración. Puede que esté en modo '
        + 'privado o sin espacio. Los cambios se ven ahora, pero no seguirán aquí al '
        + 'recargar la página.',
    };
  }
}

/** Vuelve a lo que dicen los datos de la app. */
export function restablecerConfiguracion(): void {
  try {
    localStorage.removeItem(CLAVE);
  } catch {
    /* si no deja borrar, la configuración guardada simplemente sigue ahí */
  }
}

/** Si hay algo guardado que se aparte de los datos de la app. */
export function hayConfiguracionPropia(): boolean {
  return leerCrudo() !== null;
}

/** Las materias que se pueden marcar como exigentes, sin las que no se generan. */
export function materiasConfigurables(): Array<{ id: string; nombre: string }> {
  return ASIGNATURAS
    .filter(a => a.id !== 'ci' && !a.id.startsWith('mt_'))
    .map(a => ({ id: a.id, nombre: a.nombre }));
}
