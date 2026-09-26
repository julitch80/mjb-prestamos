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
import type { AlertConfig, LateArrival, NivelLlegada, Session } from './types';
import type { BloqueHorario } from '../../data/maestros';

export const ALERT_CONFIG_POR_DEFECTO: AlertConfig = {
  faltasConsecutivas: 3,
  porcentajeFaltasPeriodo: 20,
  llegadasTardeUmbral: 3,
  diasSinAsistir: 3,
  toleranciaMinutos: 10,
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

// ---------------------------------------------------------------------------
//  Niveles de llegada tarde (Julián, 2026-09-25)
// ---------------------------------------------------------------------------

/**
 * Cuanto pesa una llegada de 2º nivel (despues de la primera hora) frente a una de 1º
 * (espero en el hall). Opcion A de Julián: «una de segundo nivel sin justificar cuenta
 * como dos». Se escogio por facil de explicar a familias y estudiantes: un solo numero,
 * un solo semaforo.
 */
export const PESO_SEGUNDO_NIVEL = 2;

/** Los registros anteriores a los niveles no traen el campo: son 1º nivel. */
export function nivelDeLlegada(l: Pick<LateArrival, 'nivel'>): NivelLlegada {
  return l.nivel === 2 ? 2 : 1;
}

/**
 * El nivel de un registro INDIVIDUAL (no de la lista del hall): 2º si ya termino la
 * primera hora de la jornada del estudiante. Quien llega antes y se registra uno a uno
 * (en vez de esperar en el hall) es de 1º nivel.
 *
 * La lista del hall NO pasa por aqui: coordinacion la pasa justo al terminar la primera
 * hora, a la misma hora en que llegaria uno de 2º nivel, y por la hora sola no se
 * distinguirian. Lo que los distingue es el camino.
 */
export function nivelDeRegistroIndividual(bloques: BloqueHorario[], hhmm: string): NivelLlegada {
  return bloques.length > 0 && hhmm >= bloques[0].fin ? 2 : 1;
}

/** 'HH:mm' + minutos, para mostrar la hora de tolerancia (6:00 + 10 → 06:10). */
export function sumarMinutos(hhmm: string, minutos: number): string {
  const [h, m] = hhmm.split(':').map(Number);
  const total = h * 60 + m + minutos;
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

/**
 * Con que modo abre la pantalla. Entre la tolerancia (6:10) y un rato despues de que
 * termina la primera hora (6:55 + 20), lo que hace coordinacion es pasar la lista del
 * hall; el resto del dia, recibir uno a uno a los que trae el vigilante. Es solo el
 * punto de partida: la coordinadora cambia de modo con un toque.
 */
export function modoSugerido(
  jornadas: BloqueHorario[][],
  hhmm: string,
  toleranciaMinutos: number,
): 'hall' | 'individual' {
  for (const bloques of jornadas) {
    if (bloques.length === 0) continue;
    const desde = sumarMinutos(bloques[0].inicio, toleranciaMinutos);
    const hasta = sumarMinutos(bloques[0].fin, 20);
    if (hhmm >= desde && hhmm < hasta) return 'hall';
  }
  return 'individual';
}

export interface CuentaLlegadas {
  /** Llegadas tarde sin justificar. */
  llegadas: number;
  /** De ellas, cuantas de 2º nivel. */
  segundoNivel: number;
  /** Lo que mide el semaforo: las de 1º valen 1 y las de 2º, `PESO_SEGUNDO_NIVEL`. */
  puntos: number;
}

export const CUENTA_VACIA: CuentaLlegadas = { llegadas: 0, segundoNivel: 0, puntos: 0 };

/**
 * Cuenta por estudiante de las llegadas que alertan, con su peso.
 *
 * Sin opciones: las sin justificar, todas las que lleguen (asi la usa quien ya trae un
 * año). Con opciones (2026-09-25): solo las del lapso `desde..hasta`, y las pendientes de
 * verificacion cuentan tambien si llevan `diasVencePendiente` dias sin resolverse.
 */
export function cuentaLlegadasPorEstudiante(
  llegadas: LateArrival[],
  opciones?: { hoy: string; diasVencePendiente: number; desde: string; hasta: string },
): Record<string, CuentaLlegadas> {
  const r: Record<string, CuentaLlegadas> = {};
  const queCuentan = opciones
    ? llegadas.filter(
        (l) =>
          l.fecha >= opciones.desde &&
          l.fecha <= opciones.hasta &&
          (l.estado === 'sin_justificar' ||
            (l.estado === 'pendiente_verificacion' &&
              diasCorridos(l.fecha, opciones.hoy) >= opciones.diasVencePendiente)),
      )
    : llegadasQueAlertan(llegadas);
  for (const l of queCuentan) {
    const c = r[l.studentId] ?? { ...CUENTA_VACIA };
    const segundo = nivelDeLlegada(l) === 2;
    c.llegadas += 1;
    if (segundo) c.segundoNivel += 1;
    c.puntos += segundo ? PESO_SEGUNDO_NIVEL : 1;
    r[l.studentId] = c;
  }
  return r;
}

function diasCorridos(desde: string, hasta: string): number {
  return Math.round((Date.parse(`${hasta}T12:00:00`) - Date.parse(`${desde}T12:00:00`)) / 86_400_000);
}

/** «4 llegadas tarde sin justificar (1 de 2º nivel, cuenta doble)». */
export function describirCuenta(c: CuentaLlegadas): string {
  const base = `${c.llegadas} llegada${c.llegadas === 1 ? '' : 's'} tarde sin justificar`;
  if (c.segundoNivel === 0) return base;
  return `${base} (${c.segundoNivel} de 2º nivel, cuenta${c.segundoNivel === 1 ? '' : 'n'} doble)`;
}

/**
 * Escalamiento de color por llegadas tarde SIN JUSTIFICAR acumuladas en el año escolar,
 * medido en PUNTOS: las de 2º nivel valen doble (ver `PESO_SEGUNDO_NIVEL`).
 *
 * `config.llegadasTardeUmbral` es la PRIMERA alerta (amarillo). La siguiente es
 * naranja, y de dos mas en adelante, rojo — igual que pidio Julian para 3/4/5, pero
 * generalizado: si el umbral institucional sube a 4, la escala pasa a 4/5/6+ sin tocar
 * este codigo.
 *
 * Acepta un numero (puntos, todos de 1º nivel) o la cuenta completa; con la cuenta, el
 * mensaje dice cuantas llegadas fueron y cuantas de 2º nivel, porque «5 puntos» no le
 * dice nada a nadie.
 */
export function pasoLlegadasTarde(
  cuenta: number | CuentaLlegadas,
  config: AlertConfig,
): PasoLlegadaTarde | null {
  const c = typeof cuenta === 'number' ? { llegadas: cuenta, segundoNivel: 0, puntos: cuenta } : cuenta;
  const u = config.llegadasTardeUmbral;
  const p = c.puntos;
  if (p < u) return null;
  const texto = describirCuenta(c);
  if (p === u) return { color: 'amarillo', mensaje: `${texto} en el año.` };
  if (p === u + 1) return { color: 'naranja', mensaje: `${texto}: reincide.` };
  return { color: 'rojo', mensaje: `${texto}: reincidencia grave.` };
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
