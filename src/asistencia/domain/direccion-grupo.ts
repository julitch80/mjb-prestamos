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

// ---------------------------------------------------------------------------
//  Columnas automaticas — lo que el sistema ya sabe (faltas, llegadas tarde)
// ---------------------------------------------------------------------------
//
// A diferencia de las columnas del director, estas no las crea ni las edita nadie: las
// llena la asistencia ya registrada. Van SIEMPRE al final y son de solo lectura — por
// eso no tienen `columnaId` de verdad ni entran en `DireccionGrupo.columnas`, viven solo
// en memoria del lado de la pantalla (ver DireccionGrupo.tsx).

export interface ColumnaAutomatica {
  id: 'faltas' | 'llegadas_tarde';
  nombre: string;
  /** Valor por estudiante. Ausente = no hay dato, que NO es cero. */
  valores: Record<string, number>;
}

/**
 * Total de una columna automatica. Misma regla que `totalDeColumna`: un estudiante sin
 * dato (por ejemplo, sin ninguna sesion registrada todavia en su grado) no cuenta como
 * "0 faltas" — cuenta en `sinAsignar`, nunca en la suma.
 */
export function totalDeAutomatica(columna: ColumnaAutomatica, studentIds: string[]): TotalColumna {
  const celdas = studentIds.map((id) => columna.valores[id]);
  const sinAsignar = celdas.filter((v) => v === undefined).length;
  const suma = celdas.reduce((acc: number, v) => acc + (typeof v === 'number' ? v : 0), 0);
  const texto = sinAsignar > 0 ? `${suma} en total · sin datos: ${sinAsignar}` : `${suma} en total`;
  return { columnaId: columna.id, texto, sinAsignar };
}

const CLAVE_AUTOMATICAS_OCULTAS = 'asistencia.direccionGrupo.automaticasOcultas';

/**
 * Preferencia de OCULTAR las columnas automaticas. Del dispositivo, no del colegio —
 * mismo patron que `domain/colores.ts`: no todos los directores las quieren siempre a la
 * vista, y guardarlo en Firestore obligaria a tocar permisos por algo que es solo de
 * pantalla.
 */
export function leerAutomaticasOcultas(): boolean {
  try {
    return localStorage.getItem(CLAVE_AUTOMATICAS_OCULTAS) === '1';
  } catch {
    return false;
  }
}

export function guardarAutomaticasOcultas(ocultas: boolean): void {
  try {
    if (ocultas) localStorage.setItem(CLAVE_AUTOMATICAS_OCULTAS, '1');
    else localStorage.removeItem(CLAVE_AUTOMATICAS_OCULTAS);
  } catch {
    // Modo privado o almacen lleno: se pierde la preferencia, no la sesion de trabajo.
  }
}

// ---------------------------------------------------------------------------
//  Guia de color: la clasificacion que se ve en el anillo de la foto (2026-09-07)
// ---------------------------------------------------------------------------
//
// QUE ES. Una guia de colores del director para clasificar a su grupo de un vistazo:
// tres estudiantes en rojo "Refuerzo", el resto en verde "Al dia". Julian la pidio el
// 2026-09-07 para las clasificaciones que hace en la direccion de grupo.
//
// POR QUE ES UNA COLUMNA Y NO UN SISTEMA APARTE. Una columna de tipo `icono` ya ES una
// paleta cerrada de {palabra corta + color} — lo unico que le faltaba era verse en la
// foto. Montar al lado un segundo sistema de "colores del estudiante" habria dado dos
// clasificaciones del mismo grupo, que con el tiempo se contradicen y de las que solo
// una se puede contar. Asi el director escribe "Refuerzo" una vez y el cuaderno le
// responde ademas "Refuerzo: 7 · Al dia: 24 · sin asignar: 2", gratis.
//
// El director NUNCA oye la palabra "columna" para esto: la crea la ficha por el, la
// primera vez que elige un color. Decision de Julian, 2026-09-07 (opcion "la ficha la
// crea sola"), sabiendo que la columna le aparecera tambien en el cuaderno.
//
// QUIEN LO VE. Solo el director: esto vive en su cuaderno, y el cuaderno es suyo y de
// nadie mas (`asisIsDirectorOf`, decision del 2026-08-12). No es un descuido — una
// clasificacion como "Refuerzo" es un juicio del director sobre un menor, y no tiene por
// que llegarle a coordinacion ni a los demas docentes.

/** Id de la columna que la ficha crea sola. Fijo: asi se reconoce entre las del director. */
export const COLUMNA_CLASIFICACION = 'clasificacion';

/** Cabe bajo una foto de 44 px sin partirse ni empujar la fila. */
export const ETIQUETA_COLOR_MAX = 16;

/** La columna que pinta el anillo, o null si este cuaderno no tiene guia todavia. */
export function guiaDeColor(d: DireccionGrupo | null): ColumnaDireccion | null {
  if (!d?.columnaColorId) return null;
  return d.columnas.find((c) => c.columnaId === d.columnaColorId) ?? null;
}

/**
 * La opcion (color + palabra) que le toca a un estudiante, o null si no esta clasificado.
 *
 * Devuelve null tambien cuando la casilla guarda un `opcionId` que ya no esta en la
 * guia —puede pasar si se quito ese color y quedo alguna casilla suelta—, en vez de
 * inventar un color o reventar.
 */
export function colorDeEstudiante(
  d: DireccionGrupo | null,
  studentId: string,
): OpcionColumna | null {
  const guia = guiaDeColor(d);
  if (!guia || !d) return null;
  const valor = d.valores?.[studentId]?.[guia.columnaId];
  if (typeof valor !== 'string') return null;
  return guia.opciones.find((o) => o.opcionId === valor) ?? null;
}

/** Mapa studentId -> opcion, para pintar una lista entera sin recorrerla por estudiante. */
export function coloresDelGrupo(d: DireccionGrupo | null): Record<string, OpcionColumna> {
  const guia = guiaDeColor(d);
  if (!guia || !d) return {};
  const mapa: Record<string, OpcionColumna> = {};
  for (const [studentId, celdas] of Object.entries(d.valores ?? {})) {
    const valor = celdas?.[guia.columnaId];
    if (typeof valor !== 'string') continue;
    const opcion = guia.opciones.find((o) => o.opcionId === valor);
    if (opcion) mapa[studentId] = opcion;
  }
  return mapa;
}

/**
 * Valida la palabra de un color. En espanol claro: lo lee un director, no un log.
 *
 * `opcionIdIgnorada` permite renombrar sin que el propio color se acuse de repetido.
 */
export function validarEtiquetaColor(
  etiqueta: string,
  guia: ColumnaDireccion | null,
  opcionIdIgnorada?: string,
): string | null {
  const limpia = etiqueta.trim();
  if (!limpia) return 'Escriba para qué es este color: sin palabra, un color no dice nada.';
  if (limpia.length > ETIQUETA_COLOR_MAX) {
    return `La palabra no puede pasar de ${ETIQUETA_COLOR_MAX} caracteres: va bajo la foto, no es una frase.`;
  }
  const repetida = (guia?.opciones ?? []).some(
    (o) =>
      o.opcionId !== opcionIdIgnorada &&
      o.etiqueta.trim().toLowerCase() === limpia.toLowerCase(),
  );
  if (repetida) return 'Ya hay un color con esa palabra en la guía.';
  return null;
}

/**
 * Nombre libre para la columna de la guia.
 *
 * Si el director ya tiene una columna suya llamada "Clasificación", no se le pisa el
 * nombre: `validarColumna` prohibe dos iguales, y dejar el cuaderno con un nombre
 * repetido lo dejaria en un estado que su propio formulario rechaza.
 */
function nombreLibreDeGuia(columnas: ColumnaDireccion[]): string {
  const usados = new Set(columnas.map((c) => c.nombre.trim().toLowerCase()));
  if (!usados.has('clasificación')) return 'Clasificación';
  for (let i = 2; i < 50; i += 1) {
    const intento = `Clasificación ${i}`;
    if (!usados.has(intento.toLowerCase())) return intento;
  }
  return `Clasificación ${Date.now()}`;
}

export interface CambioGuia {
  /** El arreglo de columnas completo, listo para `guardarColumnas`. */
  columnas: ColumnaDireccion[];
  /** A donde debe apuntar `columnaColorId` del cuaderno. */
  columnaColorId: string;
  /** El valor a escribir en la casilla del estudiante con `marcarCelda`. */
  opcionId: string;
  /** Falso si el color ya estaba en la guia: entonces no hay columnas que guardar. */
  cambioLasColumnas: boolean;
}

/**
 * Deja listo el color `colorId` dentro de la guia y dice que hay que escribir.
 *
 * Crea la columna si el cuaderno no tenia guia, y anade el color si es nuevo. Si el color
 * YA estaba, no se toca nada y se devuelve su opcion tal cual: la palabra no se
 * sobrescribe, porque dos estudiantes comparten color precisamente para compartir
 * significado — cambiarla desde el segundo le cambiaria la clasificacion al primero.
 *
 * Funcion PURA: devuelve lo que habria que guardar, no guarda nada. Quien llama decide
 * si escribe columnas, casilla o las dos.
 */
export function asignarColorEnGuia(
  d: DireccionGrupo | null,
  colorId: string,
  etiqueta: string,
): CambioGuia {
  const columnas = d?.columnas ? [...d.columnas] : [];
  const guia = guiaDeColor(d);

  if (guia) {
    const existente = guia.opciones.find((o) => o.colorId === colorId);
    if (existente) {
      return {
        columnas,
        columnaColorId: guia.columnaId,
        opcionId: existente.opcionId,
        cambioLasColumnas: false,
      };
    }
    const opcion: OpcionColumna = {
      opcionId: `op_${colorId}`,
      icono: '',
      etiqueta: etiqueta.trim(),
      colorId,
    };
    return {
      columnas: columnas.map((c) =>
        c.columnaId === guia.columnaId ? { ...c, opciones: [...c.opciones, opcion] } : c,
      ),
      columnaColorId: guia.columnaId,
      opcionId: opcion.opcionId,
      cambioLasColumnas: true,
    };
  }

  // Primera vez: nace la guia. Va al FINAL del cuaderno para no desplazar las columnas
  // que el director ya venia leyendo en un orden.
  const orden = columnas.reduce((max, c) => Math.max(max, c.orden), -1) + 1;
  const opcion: OpcionColumna = {
    opcionId: `op_${colorId}`,
    icono: '',
    etiqueta: etiqueta.trim(),
    colorId,
  };
  const nueva: ColumnaDireccion = {
    columnaId: COLUMNA_CLASIFICACION,
    nombre: nombreLibreDeGuia(columnas),
    tipo: 'icono',
    orden,
    opciones: [opcion],
  };
  return {
    columnas: [...columnas, nueva],
    columnaColorId: COLUMNA_CLASIFICACION,
    opcionId: opcion.opcionId,
    cambioLasColumnas: true,
  };
}

/**
 * Cambia la palabra de un color. Afecta a TODOS los que lo tienen: eso es exactamente lo
 * que significa compartir color, y por eso la ficha avisa a cuantos antes de dejarlo.
 */
export function renombrarColorEnGuia(
  d: DireccionGrupo,
  opcionId: string,
  etiqueta: string,
): ColumnaDireccion[] {
  const guia = guiaDeColor(d);
  if (!guia) return d.columnas;
  return d.columnas.map((c) =>
    c.columnaId === guia.columnaId
      ? {
          ...c,
          opciones: c.opciones.map((o) =>
            o.opcionId === opcionId ? { ...o, etiqueta: etiqueta.trim() } : o,
          ),
        }
      : c,
  );
}

/**
 * Quita un color de la guia Y las casillas que lo usaban, en una sola escritura.
 *
 * Los valores se limpian aqui por el mismo motivo que al borrar una columna: dejarlos
 * huerfanos no se nota —la lista simplemente no pinta anillo— pero el dia que se cree
 * otro color reutilizando ese `opcionId`, media clase amaneceria clasificada sola.
 */
export function quitarColorDeGuia(
  d: DireccionGrupo,
  opcionId: string,
): { columnas: ColumnaDireccion[]; valores: DireccionGrupo['valores'] } {
  const guia = guiaDeColor(d);
  if (!guia) return { columnas: d.columnas, valores: d.valores ?? {} };

  const columnas = d.columnas.map((c) =>
    c.columnaId === guia.columnaId
      ? { ...c, opciones: c.opciones.filter((o) => o.opcionId !== opcionId) }
      : c,
  );

  const valores: DireccionGrupo['valores'] = {};
  for (const [studentId, celdas] of Object.entries(d.valores ?? {})) {
    const copia = { ...celdas };
    if (copia[guia.columnaId] === opcionId) delete copia[guia.columnaId];
    if (Object.keys(copia).length > 0) valores[studentId] = copia;
  }
  return { columnas, valores };
}

/** Cuantos estudiantes comparten un color. Lo usa la ficha para avisar antes de
 * renombrar o quitar: "esta palabra la comparten 7 estudiantes". */
export function cuantosConColor(d: DireccionGrupo | null, opcionId: string): number {
  const guia = guiaDeColor(d);
  if (!guia || !d) return 0;
  return Object.values(d.valores ?? {}).filter((c) => c?.[guia.columnaId] === opcionId).length;
}
