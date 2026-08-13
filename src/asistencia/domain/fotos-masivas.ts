/**
 * Emparejamiento de la carga masiva de fotografias.
 *
 * El insumo real (`entrega_parcial`, ver el manual) trae UNA carpeta por grupo con
 * archivos `Apellidos_Nombres.jpg`. La logica de aqui traduce eso a estudiantes SIN
 * salir del grupo de la carpeta: reducir el universo a 30 candidatos en vez de 688 es lo
 * que hace confiable el emparejamiento, no un detalle de rendimiento.
 *
 * Regla dura, igual que en `import-matching.ts`: un homonimo NUNCA se resuelve solo. Una
 * foto en la ficha equivocada es peor que ninguna foto, porque en este sistema la foto
 * ES el control de identidad que impide que un estudiante pase lista por otro.
 */

import { formatGrado, jornadaDeNumeroDeGrado } from './grados';
import { nombresDePila } from './nombres';
import type { Student } from './types';

export interface ArchivoFoto {
  /** Ruta relativa tal cual la da el navegador: '10_1/Araque_Espinosa_Tatiana.jpg'. */
  rutaRelativa: string;
  archivo: File;
}

export type EstadoEmparejamiento = 'emparejado' | 'ambiguo' | 'sin_estudiante';

export interface Emparejamiento {
  archivo: ArchivoFoto;
  grado: string | null;
  estado: EstadoEmparejamiento;
  /** Unico si 'emparejado'; los candidatos si 'ambiguo'; aproximados (o vacio) si
   *  'sin_estudiante' — nunca se dan por buenos, solo sirven para elegir a mano. */
  candidatos: Student[];
}

/**
 * Traduce el nombre de carpeta a la notacion literal del colegio.
 *
 * Acepta separador explicito (`10_1`, `10-1`) o el codigo pegado (`101`, `61`): en ese
 * caso se prueban los cortes posibles y se queda con el primero que produzca un grado
 * valido (6..11) y un grupo mayor que cero. Si ninguno cuadra, `null` — no se adivina.
 */
export function gradoDeCarpeta(carpeta: string): string | null {
  const limpio = (carpeta ?? '').trim();

  const conSeparador = limpio.match(/^(\d{1,2})[_-](\d{1,2})$/);
  if (conSeparador) {
    return intentarFormatear(Number(conSeparador[1]), Number(conSeparador[2]));
  }

  if (/^\d{2,3}$/.test(limpio)) {
    // Sin separador: para dos digitos solo hay un corte posible (uno y uno). Para tres,
    // se prueba primero grado de dos digitos (10, 11 son los unicos de esa longitud en
    // el colegio) antes que grado de uno.
    const cortes = limpio.length === 2 ? [1] : [2, 1];
    for (const corte of cortes) {
      const resultado = intentarFormatear(
        Number(limpio.slice(0, corte)),
        Number(limpio.slice(corte)),
      );
      if (resultado) return resultado;
    }
  }

  return null;
}

function intentarFormatear(numeroGrado: number, numeroGrupo: number): string | null {
  if (numeroGrupo < 1) return null;
  try {
    // formatGrado ya lanza si el grado no esta en 6..11 (jornadaDeNumeroDeGrado).
    jornadaDeNumeroDeGrado(numeroGrado);
    return formatGrado(numeroGrado, numeroGrupo);
  } catch {
    return null;
  }
}

/** Quita acentos, separadores de nombre de archivo y espacios sobrantes; deja MAYUSCULAS. */
function normalizar(texto: string): string {
  return (texto ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[_-]+/g, ' ')
    .replace(/[^A-Z\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function nombreArchivoNormalizado(rutaRelativa: string): string {
  const base = rutaRelativa.split('/').pop() ?? rutaRelativa;
  return normalizar(base.replace(/\.[^.]+$/, ''));
}

/** Mismo orden que trae el archivo: apellidos y despues los nombres de pila (sin la
 *  repeticion de Master2000), para que "Araque_Espinosa_Tatiana" case con el estudiante. */
function nombreEstudianteNormalizado(e: Student): string {
  return normalizar(`${e.apellidos} ${nombresDePila(e.apellidos, e.nombres)}`);
}

/**
 * Empareja cada archivo con, a lo sumo, un estudiante — y solo dentro del grupo que
 * indica su carpeta.
 */
export function emparejarFotos(
  archivos: ArchivoFoto[],
  estudiantesPorGrado: Record<string, Student[]>,
): Emparejamiento[] {
  return archivos.map((archivo) => {
    const carpeta = archivo.rutaRelativa.split('/')[0] ?? '';
    const grado = gradoDeCarpeta(carpeta);

    if (!grado) {
      return { archivo, grado: null, estado: 'sin_estudiante', candidatos: [] };
    }

    const delGrupo = estudiantesPorGrado[grado] ?? [];
    const nombreArchivo = nombreArchivoNormalizado(archivo.rutaRelativa);

    const exactos = delGrupo.filter((e) => nombreEstudianteNormalizado(e) === nombreArchivo);

    if (exactos.length === 1) {
      return { archivo, grado, estado: 'emparejado', candidatos: exactos };
    }
    if (exactos.length > 1) {
      // Dos o mas estudiantes del MISMO grupo con el mismo nombre normalizado: homonimos
      // reales. Nunca se elige uno solo.
      return { archivo, grado, estado: 'ambiguo', candidatos: exactos };
    }

    // Sin coincidencia exacta: se ofrecen candidatos por el primer apellido, solo para
    // que la persona elija a mano. No cuentan como emparejados.
    const primerApellido = nombreArchivo.split(' ')[0] ?? '';
    const aproximados = primerApellido
      ? delGrupo.filter((e) => nombreEstudianteNormalizado(e).startsWith(`${primerApellido} `))
      : [];

    return { archivo, grado, estado: 'sin_estudiante', candidatos: aproximados };
  });
}

/** Estudiantes del grupo que NO tienen archivo de foto emparejado (solo cuenta lo
 *  emparejado de forma unica: un candidato ambiguo o aproximado no cubre a nadie). */
export function sinFoto(
  emparejamientos: Emparejamiento[],
  estudiantesPorGrado: Record<string, Student[]>,
): Student[] {
  const cubiertos = new Set(
    emparejamientos
      .filter((m) => m.estado === 'emparejado')
      .map((m) => m.candidatos[0]?.studentId)
      .filter((id): id is string => Boolean(id)),
  );

  return Object.values(estudiantesPorGrado)
    .flat()
    .filter((e) => !cubiertos.has(e.studentId));
}
