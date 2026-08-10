/**
 * Que se muestra en el panel de estadisticas de un estudiante, y que se calla.
 *
 * Es logica pura a proposito: la decision de "esta cifra merece estar en pantalla" es
 * una regla de negocio, no una cuestion de maquetacion, y se puede probar sin navegador.
 */

import { MARKS, type MarkCode } from './marks';
import type { StatsResult } from './stats';

export interface FilaPanel {
  code: MarkCode;
  label: string;
  valor: number;
}

/**
 * Filas a mostrar, ya depuradas.
 *
 * REGLA (decision de Julian): las marcas en cero no se muestran. Una pantalla con seis
 * ceros y un uno esconde el uno; el docente lee ruido en vez de leer el caso.
 *
 * LA EXCEPCION son las ausencias: se muestran SIEMPRE, aunque esten en cero. "Faltas: 0"
 * es informacion — dice que el estudiante no ha faltado. Si desapareciera junto al resto,
 * el docente no sabria si es que no falto o que la aplicacion no lo calculo.
 */
export function filasDelPanel(stats: StatsResult): FilaPanel[] {
  return MARKS.map((m) => ({
    code: m.code,
    label: m.label,
    valor: stats.porMarca[m.code] ?? 0,
  })).filter((f) => f.valor > 0 || f.code === 'ausencia');
}

/**
 * Texto del denominador. Va SIEMPRE, incluso cuando no hay ninguna falta.
 *
 * Sin el, "3 faltas" no significa nada: no es lo mismo sobre 8 clases que sobre 60. Es la
 * cifra que convierte un numero suelto en un juicio posible, y por eso no se oculta nunca
 * aunque el resto de la pantalla este vacia.
 */
export function textoDenominador(stats: StatsResult): string {
  if (stats.sessionsCount === 0) {
    return 'Sin sesiones registradas todavía: no hay nada que medir.';
  }
  const s = stats.sessionsCount === 1 ? 'sesión registrada' : 'sesiones registradas';
  return `Sobre ${stats.sessionsCount} ${s}`;
}

/**
 * Lo que se pinta en la pastilla de la fila, que es lo unico visible sin abrir nada.
 *
 * Lleva las inasistencias que se transcriben a Master2000 —no el total— porque es la
 * cifra que de verdad le pesa al estudiante: las justificadas no se copian. Y un aviso
 * aparte si hay retrasos o llegadas tarde, que son otro fenomeno y no se pueden sumar
 * con las faltas sin mentir.
 */
export interface ResumenPastilla {
  aMaster2000: number;
  /** Hay algo mas que mirar aunque no haya faltas: retrasos o llegadas tarde. */
  hayAvisos: boolean;
  /** Sin sesiones no se ha medido nada; la pastilla debe decirlo, no mostrar un 0. */
  sinDatos: boolean;
}

export function resumenPastilla(stats: StatsResult, llegadasTarde: number): ResumenPastilla {
  return {
    aMaster2000: stats.aMaster2000,
    hayAvisos: stats.retrasosTotales > 0 || llegadasTarde > 0,
    sinDatos: stats.sessionsCount === 0,
  };
}
