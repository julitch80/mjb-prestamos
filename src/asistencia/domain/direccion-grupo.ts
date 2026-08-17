/**
 * Direccion de grupo — logica pura del cuaderno paralelo del director. Ver la nota
 * larga al final de `domain/types.ts` para el modelo de datos y por que existe.
 *
 * NO es asistencia: no reusa `marks.ts` ni `stats.ts`. Las columnas las define el
 * director, y lo unico que este archivo protege es que el cuaderno siga siendo legible
 * (nombres cortos, sin colisiones) y que los totales no mientan sobre lo que nadie
 * registro todavia.
 */

import type { ColumnaDireccion, DireccionGrupo, OpcionColumna, TipoColumna, ValorCelda } from './types';

const NOMBRE_MAX = 24;

/**
 * Valida antes de crear una columna. Devuelve el motivo del rechazo en espanol claro
 * —lo lee un docente, no un log—, o null si esta bien.
 */
export function validarColumna(
  nombre: string,
  tipo: TipoColumna,
  opciones: OpcionColumna[],
  existentes: ColumnaDireccion[],
): string | null {
  const nombreLimpio = nombre.trim();
  if (!nombreLimpio) return 'El nombre de la columna es obligatorio.';
  if (nombreLimpio.length > NOMBRE_MAX) {
    return `El nombre no puede tener mas de ${NOMBRE_MAX} caracteres: es una cabecera de tabla, no una frase.`;
  }

  const yaExiste = existentes.some(
    (c) => c.nombre.trim().toLowerCase() === nombreLimpio.toLowerCase(),
  );
  if (yaExiste) return 'Ya existe una columna con ese nombre en este año.';

  if (tipo === 'icono') {
    if (opciones.length < 2) {
      return 'Una columna de iconos necesita al menos dos opciones: con una sola no hay nada que distinguir.';
    }
    if (opciones.some((o) => !o.etiqueta.trim())) {
      return 'Todas las opciones necesitan una etiqueta.';
    }
    const etiquetas = opciones.map((o) => o.etiqueta.trim().toLowerCase());
    if (new Set(etiquetas).size !== etiquetas.length) {
      return 'Hay opciones repetidas: cada opcion necesita una etiqueta distinta.';
    }
  } else if (opciones.length > 0) {
    return 'Este tipo de columna no lleva opciones.';
  }

  return null;
}

export interface TotalColumna {
  columnaId: string;
  /** Frase corta ya redactada, lista para pintar bajo la cabecera. */
  texto: string;
  /** Cuantos estudiantes NO tienen valor en esa columna. */
  sinAsignar: number;
}

/** Miles con punto, formato colombiano. Se calcula a mano: no depender de Intl con
 * locale 'es-CO', que no todos los runtimes traen completo. */
function formatMilesCO(n: number): string {
  const negativo = n < 0;
  const entero = Math.round(Math.abs(n));
  const conPuntos = String(entero).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return negativo ? `-${conPuntos}` : conPuntos;
}

/**
 * Total de una columna. Esto es lo que convierte el cuaderno en una respuesta:
 * "¿como va la cuota?", "¿como va el aseo?".
 *
 * Una casilla SIN VALOR no cuenta como cero ni como "no" — la misma distincion que en
 * asistencia entre "sin registrar" y "ausencia". Por eso `sinAsignar` se calcula sobre
 * la AUSENCIA de la clave en el mapa, nunca sobre un valor por defecto.
 */
export function totalDeColumna(
  columna: ColumnaDireccion,
  valores: Record<string, Record<string, ValorCelda>>,
  studentIds: string[],
): TotalColumna {
  const celdas = studentIds.map((id) => valores[id]?.[columna.columnaId]);
  const sinAsignar = celdas.filter((v) => v === undefined).length;

  if (columna.tipo === 'numero') {
    const suma = celdas.reduce((acc: number, v) => acc + (typeof v === 'number' ? v : 0), 0);
    const texto =
      sinAsignar > 0
        ? `$${formatMilesCO(suma)} · faltan ${sinAsignar}`
        : `$${formatMilesCO(suma)}`;
    return { columnaId: columna.columnaId, texto, sinAsignar };
  }

  if (columna.tipo === 'puntos') {
    const total = celdas.reduce((acc: number, v) => acc + (typeof v === 'number' ? v : 0), 0);
    const signo = total >= 0 ? '+' : '';
    return { columnaId: columna.columnaId, texto: `${signo}${total} en total`, sinAsignar };
  }

  if (columna.tipo === 'casilla') {
    const marcados = celdas.filter((v) => v === true).length;
    return {
      columnaId: columna.columnaId,
      texto: `${marcados} de ${studentIds.length}`,
      sinAsignar,
    };
  }

  // icono: conteo por opcion, en el orden declarado de la paleta.
  const conteo = new Map(columna.opciones.map((o) => [o.opcionId, 0]));
  for (const v of celdas) {
    if (typeof v === 'string' && conteo.has(v)) {
      conteo.set(v, (conteo.get(v) ?? 0) + 1);
    }
  }
  const partes = columna.opciones.map((o) => `${o.etiqueta}: ${conteo.get(o.opcionId) ?? 0}`);
  partes.push(`sin asignar: ${sinAsignar}`);
  return { columnaId: columna.columnaId, texto: partes.join(' · '), sinAsignar };
}

/**
 * Suma o resta un punto. Sin valor previo se parte de cero — un punto que nadie ha
 * tocado todavia no es distinto de "en cero", a diferencia de las demas columnas: aqui
 * lo que importa es el acumulado, no si alguien ya lo abrio.
 */
export function ajustarPuntos(actual: ValorCelda | undefined, delta: 1 | -1): number {
  const base = typeof actual === 'number' ? actual : 0;
  return base + delta;
}

/**
 * Reordena una columna un puesto en la direccion pedida. Devuelve el arreglo completo
 * con `orden` recalculado 0..n-1 para que no queden huecos ni empates tras varios
 * movimientos.
 */
export function moverColumna(
  columnas: ColumnaDireccion[],
  columnaId: string,
  delta: 1 | -1,
): ColumnaDireccion[] {
  const ordenadas = [...columnas].sort((a, b) => a.orden - b.orden);
  const idx = ordenadas.findIndex((c) => c.columnaId === columnaId);
  if (idx === -1) return columnas;

  const destino = idx + delta;
  // Ya esta en el extremo: no hay a donde moverla, se devuelve tal cual.
  if (destino < 0 || destino >= ordenadas.length) return columnas;

  [ordenadas[idx], ordenadas[destino]] = [ordenadas[destino], ordenadas[idx]];
  return ordenadas.map((c, i) => ({ ...c, orden: i }));
}

/**
 * Quita una columna Y sus valores. Si solo se borrara la columna, cada estudiante se
 * quedaria con una entrada huerfana en `valores` ocupando el documento para siempre —
 * nadie la vuelve a leer, pero tampoco se va.
 */
export function quitarColumna(
  direccion: DireccionGrupo,
  columnaId: string,
): { columnas: ColumnaDireccion[]; valores: DireccionGrupo['valores'] } {
  const columnas = direccion.columnas.filter((c) => c.columnaId !== columnaId);
  const valores: DireccionGrupo['valores'] = {};
  for (const [studentId, porColumna] of Object.entries(direccion.valores)) {
    const resto = { ...porColumna };
    delete resto[columnaId];
    valores[studentId] = resto;
  }
  return { columnas, valores };
}
