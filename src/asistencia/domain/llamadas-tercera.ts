/**
 * A quién hay que llamar en la tercera hora (Julián, 2026-10-05).
 *
 * El protocolo: primero salen los mensajes de texto a todas las familias con celular, y
 * despues se llama SOLO a quien tiene un motivo. Antes de esto la lista «No ingresaron»
 * traia a todos con boton de llamar y «Llamar primero» apenas ordenaba; coordinacion no
 * sabia cuantas llamadas le esperaban de verdad.
 *
 * Motivos para llamar, de dos fuentes:
 *  - `prioridadDeLlamada` (caso abierto, factor de riesgo, alerta, dias seguidos, sin celular
 *    o telefono que ya fallo).
 *  - El aviso por mensaje de hoy: no salio, vencio sin respuesta, o la familia pidio hablar
 *    con coordinacion.
 *
 * Nadie desaparece: los que no tienen motivo quedan en `sinMotivo`, que la pantalla muestra
 * plegado. Y si la prioridad no se pudo calcular (fallo la lectura de permanencia), todos van
 * a llamada: es preferible una llamada de mas que una familia sin aviso.
 */
import type { EstadoVisible } from './avisos';
import type { PrioridadLlamada } from './permanencia';

export const MOTIVO_AVISO_LLAMAR: Partial<Record<EstadoVisible, string>> = {
  no_salio: 'El mensaje de texto no salió.',
  vencido: 'El mensaje venció sin respuesta.',
  pide_llamada: 'La familia pidió hablar con coordinación.',
};

export interface FilaConMotivos<F> {
  fila: F;
  motivos: string[];
  /** Para ordenar: mas alto, mas arriba. */
  peso: number;
}

export function repartirLlamadas<F extends { studentId: string }>(input: {
  filas: F[];
  prioridades: Map<string, PrioridadLlamada>;
  /** Estado del aviso por mensaje de HOY, por estudiante (sin aviso: no esta). */
  estadosAviso: Map<string, EstadoVisible>;
  /** La prioridad no se pudo calcular: todos a llamada. */
  sinPrioridad: boolean;
}): { llamar: FilaConMotivos<F>[]; sinMotivo: F[] } {
  const llamar: FilaConMotivos<F>[] = [];
  const sinMotivo: F[] = [];
  for (const fila of input.filas) {
    const pr = input.prioridades.get(fila.studentId);
    const motivos = pr?.llamar ? [...pr.motivos] : [];
    let peso = pr?.peso ?? 0;
    const estado = input.estadosAviso.get(fila.studentId);
    const delAviso = estado ? MOTIVO_AVISO_LLAMAR[estado] : undefined;
    if (delAviso) {
      motivos.push(delAviso);
      peso += 5;
    }
    if (motivos.length > 0) llamar.push({ fila, motivos, peso });
    else if (input.sinPrioridad) llamar.push({ fila, motivos: [], peso: 0 });
    else sinMotivo.push(fila);
  }
  llamar.sort((a, b) => b.peso - a.peso);
  return { llamar, sinMotivo };
}
