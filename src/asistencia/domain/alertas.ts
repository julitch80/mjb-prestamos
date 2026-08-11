/**
 * Alertas de asistencia — umbrales acordados por Julian con la coordinadora el
 * 2026-08-10. Logica pura: decidir SI algo alerta es una regla de negocio, no de
 * pantalla, y se prueba sin Firestore ni navegador.
 *
 * Cuatro alertas, dos autoridades:
 *  - Docente, por asignatura: racha de faltas sin explicar (a) y % de inasistencia sin
 *    explicar sobre el periodo (b).
 *  - Coordinador: llegadas tarde reincidentes con color escalado (a) y dias
 *    consecutivos sin asistir a la institucion (b).
 */

import { findMark, LATE_ARRIVAL_STATES } from './marks';
import { rachaAusenciasConsecutivas, type StatsInput, type StatsResult } from './stats';
import type { AlertConfig, LateArrival, Session } from './types';

export const ALERT_CONFIG_POR_DEFECTO: AlertConfig = {
  faltasConsecutivas: 3,
  porcentajeFaltasPeriodo: 20,
  llegadasTardeUmbral: 3,
  diasSinAsistir: 3,
};

// ---------------------------------------------------------------------------
//  Docente — por asignatura
// ---------------------------------------------------------------------------

/**
 * Alerta al docente: racha de faltas sin explicar en su asignatura. Reusa
 * `rachaAusenciasConsecutivas` (stats.ts, ya probada) — aqui solo se decide el umbral.
 */
export function alertaRacha(
  input: StatsInput,
  config: AlertConfig,
): { activa: boolean; racha: number } {
  const racha = rachaAusenciasConsecutivas(input);
  return { activa: racha >= config.faltasConsecutivas, racha };
}

/**
 * Alerta al docente: % de inasistencia SIN EXPLICAR sobre las sesiones YA ABIERTAS del
 * periodo.
 *
 * DECISION (2026-08-10): el denominador es lo YA ABIERTO, no una proyeccion del horario
 * semanal x semanas del periodo (13/13/14 en el colegio). Julian pidio la proyeccion,
 * pero calcularla bien depende de que el horario cargado sea exacto, y eso no esta
 * validado todavia — un horario con huecos haria que la alerta mienta. Esta es la
 * aproximacion honesta mientras tanto: nunca dispara antes de tiempo, pero puede tardar
 * en disparar si el docente registra con atraso. Subir a la proyeccion real es trabajo
 * futuro, no de hoy.
 */
export function alertaPorcentajePeriodo(
  stats: StatsResult,
  config: AlertConfig,
): { activa: boolean; porcentaje: number } {
  if (stats.sessionsCount === 0) return { activa: false, porcentaje: 0 };
  const porcentaje = Math.round((stats.aMaster2000 / stats.sessionsCount) * 1000) / 10;
  return { activa: porcentaje >= config.porcentajeFaltasPeriodo, porcentaje };
}

// ---------------------------------------------------------------------------
//  Coordinador — llegadas tarde a la institucion
// ---------------------------------------------------------------------------

export type ColorAlerta = 'amarillo' | 'naranja' | 'rojo';

export interface PasoLlegadaTarde {
  color: ColorAlerta;
  mensaje: string;
}

const ESTADOS_QUE_ALERTAN = new Set(
  LATE_ARRIVAL_STATES.filter((s) => s.countsForAlerts).map((s) => s.state),
);

/** Filtra las llegadas tarde que SI cuentan para alertas (ver domain/marks.ts). */
export function llegadasQueAlertan(llegadas: LateArrival[]): LateArrival[] {
  return llegadas.filter((l) => ESTADOS_QUE_ALERTAN.has(l.estado));
}

/**
 * Escalamiento de color por llegadas tarde SIN JUSTIFICAR acumuladas en el año escolar.
 *
 * `config.llegadasTardeUmbral` es la PRIMERA alerta (amarillo). La siguiente es
 * naranja, y de dos mas en adelante, rojo — igual que pidio Julian para 3/4/5, pero
 * generalizado: si el umbral institucional sube a 4, la escala pasa a 4/5/6+ sin tocar
 * este codigo.
 */
export function pasoLlegadasTarde(conteo: number, config: AlertConfig): PasoLlegadaTarde | null {
  const u = config.llegadasTardeUmbral;
  if (conteo < u) return null;
  if (conteo === u) {
    return { color: 'amarillo', mensaje: `${conteo}ª llegada tarde sin justificar en el año.` };
  }
  if (conteo === u + 1) {
    return { color: 'naranja', mensaje: `${conteo}ª llegada tarde sin justificar: reincide.` };
  }
  return { color: 'rojo', mensaje: `${conteo}ª llegada tarde sin justificar: reincidencia grave.` };
}

// ---------------------------------------------------------------------------
//  Coordinador — dias sin asistir a la institucion
// ---------------------------------------------------------------------------

type EstadoDia = 'asistio' | 'ausente_justificado' | 'ausente_sin_explicar';

/**
 * Dias consecutivos sin asistir a la institucion (ninguna sesion de ningun bloque ni
 * asignatura), para la alerta del coordinador.
 *
 * Igual que la racha por asignatura: se cuenta sobre DIAS CON SESIONES REGISTRADAS,
 * nunca sobre el calendario — un dia sin ninguna sesion abierta no informa nada, no
 * suma ni rompe. Si el estudiante asistio a AL MENOS UNA sesion ese dia, el dia cuenta
 * como "asistio" y rompe la racha, aunque haya faltado a las demas: esta alerta es
 * sobre no venir al colegio, no sobre las faltas de una sola clase. Si TODAS las marcas
 * del dia son `ausencia_justificada` (o similar), tambien rompe: alguien ya sabe por
 * que no vino.
 */
export function diasSinAsistirConsecutivos(sesiones: Session[], studentId: string): number {
  const porDia = new Map<string, EstadoDia[]>();
  for (const s of sesiones) {
    const m = s.estudiantes?.[studentId];
    if (!m) continue;
    const def = findMark(m.estado);
    if (!def) continue;
    const lista = porDia.get(s.fecha) ?? [];
    if (!def.isAbsence) lista.push('asistio');
    else if (def.goesToMaster2000) lista.push('ausente_sin_explicar');
    else lista.push('ausente_justificado');
    porDia.set(s.fecha, lista);
  }

  const dias = [...porDia.keys()].sort();
  let racha = 0;
  for (const fecha of dias) {
    const marcas = porDia.get(fecha)!;
    if (marcas.includes('asistio')) racha = 0;
    else if (marcas.every((m) => m === 'ausente_justificado')) racha = 0;
    else racha++;
  }
  return racha;
}

export function activaAlertaDiasSinAsistir(dias: number, config: AlertConfig): boolean {
  return dias >= config.diasSinAsistir;
}
