/**
 * Evasion de clase — logica pura del cruce con el censo de la tercera hora.
 *
 * LA REGLA, dictada por Julian el 2026-09-09:
 *
 *   "La evasion solo tiene sentido a partir de la tercera hora, porque solo hasta ese
 *    momento se sabe que estudiantes faltaron ese dia. Si se sabe quienes faltaron, por
 *    descarte los otros tuvieron que haber llegado al colegio."
 *
 * De ahi sale todo lo demas: no hace falta registrar la entrada de nadie en la puerta.
 * A partir del bloque 4, marcarle falta a alguien que NO figura entre los ausentes del
 * dia significa que llego al colegio y no esta donde debia.
 *
 * ⚠️ LO QUE ESTE MODULO NO PUEDE SABER, y por eso el aviso esta redactado como esta: el
 * que vino, estuvo en tercera hora y DESPUES SE FUE PARA LA CASA se ve identico al que
 * se quedo en el patio. Por eso el texto dice "no aparece entre los ausentes de hoy" —un
 * hecho— y nunca "esta en el colegio" —una deduccion que puede fallar—. Resolver esa
 * diferencia es justo para lo que existe el aviso al coordinador: el sabe si salio con
 * permiso.
 *
 * Sin Firestore y sin React: esto es una regla del colegio, no de pantalla.
 */

import type { MarkCode } from './marks';
import type { CensoDia, Jornada, Sede, Session } from './types';

/**
 * Desde que bloque tiene sentido preguntar por evasion.
 *
 * El censo lo levanta el bloque 3, asi que en 1, 2 y 3 todavia no existe con que cruzar.
 * No es un ajuste fino: en esos bloques la pregunta no se puede responder, y una alerta
 * que dispara sin poder responder es ruido que ensena al docente a ignorarla.
 */
export const EVASION_DESDE_BLOQUE = 4;

/** Las marcas de bloque 3 que significan NO VINO al colegio. */
const NO_VINO: MarkCode[] = ['ausencia', 'ausencia_justificada'];

/**
 * `ausencia_autorizada` va aparte, y no es un detalle.
 *
 * Decision de Julian (2026-09-09): "la ausencia con autorizacion no debe figurar como un
 * caso a reportar en ninguna situacion, ni como evasion, ni como falta, ni nada". Puede
 * ser el que nunca llego porque tenia permiso o el que vino y salio autorizado —son cosas
 * distintas—, pero para este cruce las dos callan la alerta.
 */
const AUTORIZADA: MarkCode = 'ausencia_autorizada';

export function censoDiaId(fecha: string, grado: string): string {
  // El grado va literal: `11.2` y `6º1` son notaciones distintas a proposito (la `º`
  // distingue la jornada) y sanearlas aqui fundiria dos grados en un mismo censo.
  return `${fecha}_${grado}`;
}

export function avisoEvasionId(fecha: string, studentId: string, bloque: number): string {
  // El bloque entra en el id para que dos evasiones del mismo dia en horas distintas sean
  // dos avisos. Y para que DOS docentes que reporten la misma hora escriban el MISMO
  // documento en vez de duplicar el trabajo del coordinador.
  return `${fecha}_${studentId}_b${bloque}`;
}

/**
 * El censo del dia de un grupo, a partir de su sesion de bloque 3.
 *
 * Se calcula aqui —logica pura, probada— y lo ESCRIBE el servidor (`onSesionBloque3` en
 * functions/src/index.ts). El cliente no lo escribe nunca: un censo falso sembraria
 * alertas de evasion sobre estudiantes que ni vinieron.
 */
export function construirCensoDeSesion(sesion: Session): Omit<CensoDia, 'actualizadoEn'> {
  const noVinieron: string[] = [];
  const autorizados: string[] = [];
  let cubiertos = 0;

  for (const [studentId, marca] of Object.entries(sesion.estudiantes ?? {})) {
    cubiertos++;
    const estado = marca?.estado;
    if (estado === AUTORIZADA) autorizados.push(studentId);
    else if (NO_VINO.includes(estado as MarkCode)) noVinieron.push(studentId);
    // Presente, retraso, retraso justificado — y EVASION— significan que SI llego al
    // colegio. Que la evasion cuente como presente no es un descuido: al que ya pillaron
    // evadiendo a tercera hora hay que poder volver a detectarlo a quinta, y meterlo
    // entre los ausentes lo volveria invisible el resto de la jornada.
  }

  return {
    censoId: censoDiaId(sesion.fecha, sesion.grado),
    fecha: sesion.fecha,
    grado: sesion.grado,
    sede: sesion.sede as Sede,
    jornada: sesion.jornada as Jornada,
    noVinieron: noVinieron.sort(),
    autorizados: autorizados.sort(),
    cubiertos,
    cerrada: sesion.closed === true,
    sessionId: sesion.sessionId,
  };
}

/**
 * Un censo SIN NINGUNA MARCA no dice que vinieron todos: dice que nadie paso lista.
 *
 * Es la diferencia entre "no falto nadie" y "no se sabe", y confundirlas es el peor fallo
 * posible aqui: convertiria a todo un grupo de ausentes de verdad en sospechosos de
 * evasion, y el docente aprenderia en dos dias a ignorar el aviso.
 */
export function censoEsFiable(censo: CensoDia | null | undefined): censo is CensoDia {
  return Boolean(censo && censo.cubiertos > 0);
}

export type MotivoSinAviso =
  | 'bloque_temprano'
  | 'marca_no_aplica'
  | 'no_vino'
  | 'autorizado'
  /** Centro de interes sin censo todavia: puede ser antes de la tercera hora. Se calla. */
  | 'sin_censo_en_centro';

export type ResultadoEvasion =
  | { aviso: 'posible_evasion' }
  /** Hay que decirlo, no callarlo: sin censo el docente creeria que ya se comprobo. */
  | { aviso: 'sin_censo' }
  | { aviso: 'ninguno'; motivo: MotivoSinAviso };

/**
 * ¿Hay que avisarle al docente que acaba de marcar?
 *
 * SOLO se pregunta al poner `ausencia`. Las demas marcas no entran, cada una por su
 * motivo:
 *   - `ausencia_justificada`: el docente ya sabe por que falto; avisar seria ruido.
 *   - `ausencia_autorizada`:  no se reporta en ninguna situacion (decision de Julian).
 *   - `evasion`:              ya esta dicho, no hay nada que advertir.
 *   - presente / retrasos:    no es una falta.
 */
export function evaluarPosibleEvasion(input: {
  estado: MarkCode;
  bloque: number;
  studentId: string;
  censo: CensoDia | null | undefined;
}): ResultadoEvasion {
  if (input.estado !== 'ausencia') return { aviso: 'ninguno', motivo: 'marca_no_aplica' };
  if (input.bloque < EVASION_DESDE_BLOQUE) {
    return { aviso: 'ninguno', motivo: 'bloque_temprano' };
  }
  if (!censoEsFiable(input.censo)) return { aviso: 'sin_censo' };
  if (input.censo.autorizados.includes(input.studentId)) {
    return { aviso: 'ninguno', motivo: 'autorizado' };
  }
  if (input.censo.noVinieron.includes(input.studentId)) {
    return { aviso: 'ninguno', motivo: 'no_vino' };
  }
  return { aviso: 'posible_evasion' };
}

/**
 * El texto del aviso. Vive aqui y no en la pantalla porque es el MISMO en la planilla de
 * clase y en la de un centro de interes, y porque su redaccion es una decision —afirma un
 * hecho comprobable y no la deduccion que puede fallar—, no una cuestion de estilo.
 */
export function textoAvisoEvasion(nombre: string, grado: string): string {
  // Las palabras son casi las de Julian, y a proposito: dice "no esta entre los
  // reportados como ausentes" —un hecho comprobable— y "deberia estar", que es lo que el
  // colegio espera. NO dice "esta en el colegio", que es la deduccion que falla con el
  // que se fue para la casa despues de tercera hora.
  return (
    `${nombre} no está entre los que se reportaron como ausentes hoy en ${grado}; ` +
    `por lo tanto debería estar en su clase. Advertencia de posible evasión.`
  );
}

export function textoSinCenso(grado: string): string {
  return (
    `No se pasó lista a la tercera hora en ${grado}, así que hoy no hay con qué comprobar ` +
    `si llegó al colegio. La falta queda registrada igual.`
  );
}

/** Los grados de una lista de estudiantes, sin repetir: los censos que hay que pedir. */
export function gradosParaCenso(estudiantes: { gradoActual: string }[]): string[] {
  return [...new Set(estudiantes.map((e) => e.gradoActual))].sort();
}

/**
 * Lo mismo, para la planilla de un CENTRO DE INTERES.
 *
 * Va aparte de `evaluarPosibleEvasion` por una diferencia real del modelo: una sesion de
 * centro de interes tiene FECHA pero NO BLOQUE (ver `SesionPrograma` en types.ts). El
 * centro es en la jornada escolar —Julian, 2026-09-09—, pero la aplicacion no sabe a que
 * hora, asi que aqui no se puede aplicar la regla de "desde el bloque 4".
 *
 * ⚠️ Y POR ESO, SIN CENSO, AQUI SE CALLA. En una clase sabemos el bloque: si a quinta hora
 * no hay censo, eso es un hallazgo que el docente debe conocer. En un centro no sabemos la
 * hora, asi que la ausencia de censo puede significar simplemente que el centro es antes de
 * la tercera hora y todavia no se ha levantado. Avisar ahi seria alarmar sin saber.
 *
 * El resultado practico es que el mecanismo se limita solo: el censo del dia solo existe
 * desde que alguien pasa lista en tercera hora, asi que un centro que ocurra antes nunca
 * dispara una alerta falsa.
 */
export function evaluarPosibleEvasionEnCentro(input: {
  estado: MarkCode;
  studentId: string;
  censo: CensoDia | null | undefined;
}): ResultadoEvasion {
  if (input.estado !== 'ausencia') return { aviso: 'ninguno', motivo: 'marca_no_aplica' };
  if (!censoEsFiable(input.censo)) return { aviso: 'ninguno', motivo: 'sin_censo_en_centro' };
  if (input.censo.autorizados.includes(input.studentId)) {
    return { aviso: 'ninguno', motivo: 'autorizado' };
  }
  if (input.censo.noVinieron.includes(input.studentId)) {
    return { aviso: 'ninguno', motivo: 'no_vino' };
  }
  return { aviso: 'posible_evasion' };
}

/**
 * El "bloque" con el que se guarda un aviso nacido en un centro de interes.
 *
 * CERO significa "no va por bloques", no "bloque cero". Se guarda igual porque el id del
 * aviso lo necesita, y tenerlo en 0 deja una consecuencia util: un estudiante tiene como
 * mucho un centro al dia, asi que sus evasiones de centro no se pueden duplicar. La regla
 * de Firestore admite este 0 SOLO cuando `origen == 'centro'`.
 */
export const BLOQUE_CENTRO = 0;
