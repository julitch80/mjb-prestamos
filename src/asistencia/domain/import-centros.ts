/**
 * Cruce de la lista de centros de interes contra la matricula. Logica pura: no escribe
 * nada, devuelve lo resuelto y lo que hay que revisar.
 *
 * LAS TRES REGLAS DE ORO (salieron de cruzar los dos archivos REALES el 2026-08-24,
 * `docs/modelo-centros-interes.md`):
 *
 *  1. **El grado del archivo NO manda; manda la matricula.** En la hoja "Capturando
 *     paisajes" 16 de 28 grados estaban mal, sin patron. El grado del archivo se
 *     conserva como evidencia y se muestra, pero nunca decide ni se guarda.
 *  2. **Si no aparece en el grado que dice el archivo, se busca en TODO el colegio.**
 *     Tres de los treinta fallos de la manana eran cambios de grupo reales, no errores
 *     de nombre; una busqueda acotada al grado los habria perdido en silencio, que es la
 *     peor forma de perderlos.
 *  3. **El grado solo desempata homonimos**, y ni siquiera siempre (por 1). Por eso
 *     desempata la SUGERENCIA, no la decision: cuando hay varios candidatos el caso va a
 *     la bandeja igual, con la propuesta ya marcada.
 *
 * Y la cuarta, que es la razon de existir de la bandeja: lo que no cruza NO se descarta.
 *
 * Se REUTILIZA `normalizeName` de import-matching.ts (misma normalizacion que el resto
 * del modulo) y `nombresDePila` de nombres.ts (Master2000 repite los apellidos dentro de
 * la columna NOMBRES; sin recortarlos, cada nombre traeria el apellido dos veces y las
 * puntuaciones saldrian infladas).
 *
 * OJO con la diferencia respecto de `planImport`: alli la regla dura es JAMAS emparejar
 * por nombre, porque hay documento de identidad y el nombre solo sirve para sospechar.
 * Aqui NO hay documento —la lista de centros de interes viene escrita a mano, con nombre
 * y grado y nada mas—, asi que el nombre es lo unico que hay. Por eso todo lo que no sea
 * una coincidencia limpia y unica termina en un pendiente que revisa una persona.
 */

import { normalizeName } from './import-matching';
import { jornadaDeGrado } from './ids';
import { jornadaDeNumeroDeGrado } from './grados';
import { nombresDePila } from './nombres';
import { slugGrupo } from './programas';
import type { CandidatoPendiente, Jornada, PendientePrograma, Student } from './types';

/** Fila de la lista de centros de interes, tal como viene de la hoja. */
export interface FilaCentro {
  /** Nombre del centro de interes (normalmente, el nombre de la hoja). */
  centro: string;
  /** El grado que dice el archivo. NO se cree (regla 1); se conserva como evidencia. */
  grupoArchivo: string;
  nombres: string;
  apellidos: string;
}

export interface ResueltoCentro {
  grupoId: string;
  centro: string;
  studentId: string;
  /** El nombre tal cual venia en el archivo, sin sanear: es la evidencia. */
  nombreArchivo: string;
  grupoArchivo: string;
  /** El grado de la MATRICULA, literal. Es el que vale. */
  gradoMatricula: string;
  /** true = el archivo decia otro grado. Solo se informa; no cambia nada. */
  gradoDistinto: boolean;
  /**
   * true = el archivo lo situaba ademas en la OTRA jornada. Se marca aparte porque un
   * salto de jornada casi nunca es un traslado: es que la fila se copio de otra hoja.
   * Igual se resuelve —manda la matricula— pero la coordinadora tiene que verlo.
   */
  jornadaDistinta: boolean;
  /** true = el nombre coincidia literalmente; false = se corrigio ortografia. */
  exacto: boolean;
  /**
   * true = este estudiante quedo inscrito ademas en OTRO centro del mismo programa, y
   * `exclusivo` no lo permite. Se inscribe en LOS DOS de todas formas, marcado, hasta
   * que la coordinadora decida. Decision de Julian, 2026-08-24:
   *
   *   "los 4 duplicados los voy a cargar en los dos centros, marcados en rojo, en vez
   *    de escoger uno al azar o dejarlos afuera. Asi el estudiante aparece en la
   *    planilla de ambos profesores mientras se decide, y ninguno de los dos se queda
   *    sin poder llamarlo a lista la proxima semana."
   *
   * Quedarse con la primera aparicion y descartar la segunda es escoger al azar: el
   * orden de las hojas del Excel no es un criterio.
   */
  enConflicto: boolean;
}

export interface ResultadoImportCentros {
  resueltos: ResueltoCentro[];
  pendientes: PendientePrograma[];
}

export interface OpcionesImportCentros {
  programaId: string;
  /** `Programa.exclusivo`. Con false, un estudiante puede ir a dos centros. */
  exclusivo?: boolean;
}

// ---------------------------------------------------------------------------
//  Comparacion de nombres
// ---------------------------------------------------------------------------

/**
 * Un candidato debe cubrir esta fraccion del nombre del archivo para considerarse.
 *
 * 0.8 sale de los casos reales: 'ROA MIGUEL ANYER' contra 'Rúa Atehortúa Miguel Anyel'
 * puntua 0.9 (dos de tres palabras a distancia 1), y bajar mas empieza a traer gente que
 * solo comparte el nombre de pila.
 */
const UMBRAL = 0.8;

/**
 * Por debajo del umbral pero por encima de esto, el candidato no se acepta pero SI se
 * adjunta al pendiente. Un `no_encontrado` con tres parecidos a la vista se resuelve a un
 * clic; uno vacio obliga a buscar a mano entre seiscientos ochenta y ocho estudiantes.
 */
const UMBRAL_PISTA = 0.55;

function tokens(s: string): string[] {
  const n = normalizeName(s);
  return n ? n.split(' ') : [];
}

/** Distancia de Levenshtein. Sin dependencias: el modulo no admite npm nuevo. */
function distancia(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let previa = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const actual = [i];
    for (let j = 1; j <= b.length; j++) {
      const costo = a[i - 1] === b[j - 1] ? 0 : 1;
      actual[j] = Math.min(previa[j] + 1, actual[j - 1] + 1, previa[j - 1] + costo);
    }
    previa = actual;
  }
  return previa[b.length];
}

/**
 * Parecido entre DOS palabras sueltas, 0..1.
 *
 * La distancia 1 se tolera desde tres letras porque los fallos reales son de una letra en
 * nombres cortos: IAM/IAN, ROA/RUA. Con el minimo en cuatro letras, los dos se pierden.
 * A cambio, una sola palabra nunca decide nada: la puntuacion final promedia todas.
 */
function parecidoPalabra(a: string, b: string): number {
  if (a === b) return 1;
  const largo = Math.max(a.length, b.length);
  if (largo < 3) return 0;
  const d = distancia(a, b);
  if (d === 1) return 0.85;
  if (d === 2 && largo >= 6) return 0.7;
  // Un apellido escrito entero dentro de otro campo ('RAMIREZ' dentro de
  // 'RAMIREZCARRASQUILLA') se reconoce, pero vale menos que una coincidencia limpia.
  if (largo >= 6 && (a.startsWith(b) || b.startsWith(a))) return 0.8;
  return 0;
}

/**
 * Puntuacion de un estudiante frente al nombre del archivo, 0..1.
 *
 * Son dos medidas y se toma la MEJOR, porque fallan en casos opuestos:
 *
 *  - Cobertura por palabras: cuanto del nombre del archivo aparece en la matricula.
 *    Resuelve el caso normal, donde el archivo trae el nombre incompleto
 *    ('ALVAREZ IAM' por 'Álvarez Sánchez Ian Arley'). Se ignoran las palabras de mas del
 *    lado de la matricula: el archivo casi siempre trae menos, no mas.
 *  - Parecido de la cadena sin espacios. Resuelve el caso en que se perdio un espacio
 *    ('RAMIREZCARRASQUILLA MATIAS'), donde la cobertura por palabras se hunde a 0.5
 *    aunque las letras sean exactamente las mismas.
 */
function puntuacion(tokensArchivo: string[], tokensMatricula: string[]): number {
  if (tokensArchivo.length === 0 || tokensMatricula.length === 0) return 0;

  let suma = 0;
  for (const t of tokensArchivo) {
    let mejor = 0;
    for (const m of tokensMatricula) {
      const p = parecidoPalabra(t, m);
      if (p > mejor) mejor = p;
      if (mejor === 1) break;
    }
    suma += mejor;
  }
  const cobertura = suma / tokensArchivo.length;

  const claveArchivo = tokensArchivo.join('');
  const claveMatricula = tokensMatricula.join('');
  const largo = Math.max(claveArchivo.length, claveMatricula.length);
  const cadena = largo === 0 ? 0 : 1 - distancia(claveArchivo, claveMatricula) / largo;

  return Math.max(cobertura, cadena);
}

// ---------------------------------------------------------------------------
//  Grados: comparar sin sanear
// ---------------------------------------------------------------------------

/**
 * El archivo escribe el grado como se le ocurre a quien lo digito: '8°1' (grado
 * masculino), '8º1' (ordinal), '8-1', '8 1', '10-3'. La matricula lo guarda LITERAL en
 * la notacion de MJB, donde la 'º' es lo que distingue la jornada.
 *
 * Esto extrae el par (grado, grupo) SOLO para comparar. El literal jamas se toca: ni el
 * del archivo, que es evidencia, ni el de la matricula, que es el dato bueno.
 */
function parClave(grado: string): { numeroGrado: number; numeroGrupo: number } | null {
  const m = (grado ?? '').trim().match(/^(\d{1,2})\D*(\d{1,2})$/);
  if (!m) return null;
  return { numeroGrado: Number(m[1]), numeroGrupo: Number(m[2]) };
}

function mismoGrado(gradoArchivo: string, gradoMatricula: string): boolean {
  const a = parClave(gradoArchivo);
  const b = parClave(gradoMatricula);
  if (!a || !b) return false;
  return a.numeroGrado === b.numeroGrado && a.numeroGrupo === b.numeroGrupo;
}

/** Jornada que insinua el grado del archivo, o null si no se puede deducir. */
function jornadaDelArchivo(gradoArchivo: string): Jornada | null {
  const a = parClave(gradoArchivo);
  if (!a) return null;
  try {
    return jornadaDeNumeroDeGrado(a.numeroGrado);
  } catch {
    // Fuera de 6..11 la jornada no se deduce (grados.ts lo dice y falla a proposito).
    // Aqui eso no es un error: significa que no hay nada que avisar.
    return null;
  }
}

// ---------------------------------------------------------------------------
//  El cruce
// ---------------------------------------------------------------------------

interface Puntuado {
  estudiante: Student;
  score: number;
}

function nombreDeArchivo(fila: FilaCentro): string {
  return `${(fila.apellidos ?? '').trim()} ${(fila.nombres ?? '').trim()}`.trim();
}

function comoCandidato(e: Student): CandidatoPendiente {
  return {
    studentId: e.studentId,
    nombre: `${e.apellidos}, ${nombresDePila(e.apellidos, e.nombres)}`,
    grado: e.gradoActual,
  };
}

/**
 * Cruza las filas del archivo contra la matricula.
 *
 * La busqueda recorre SIEMPRE la matricula completa (regla 2). Cuesta un barrido por
 * fila sobre unos setecientos estudiantes: irrelevante frente a perder en silencio a un
 * estudiante que cambio de grupo.
 */
export function cruzarCentros(
  filas: FilaCentro[],
  matricula: Student[],
  opciones: OpcionesImportCentros,
): ResultadoImportCentros {
  const { programaId } = opciones;
  const exclusivo = opciones.exclusivo ?? true;

  // Solo estudiantes activos: un retirado no se inscribe en un centro nuevo, y dejarlo
  // como candidato solo genera homonimos falsos con quien lo reemplazo.
  const activos = matricula.filter((e) => e.activo);
  const tokensPorEstudiante = new Map<string, string[]>();
  for (const e of activos) {
    tokensPorEstudiante.set(
      e.studentId,
      tokens(`${e.apellidos} ${nombresDePila(e.apellidos, e.nombres)}`),
    );
  }

  // Un grupoId por centro, estable dentro de la importacion. El sufijo numerico de
  // `slugGrupo` resuelve dos centros que slugifican igual.
  const grupoIdPorCentro = new Map<string, string>();
  const slugsUsados = new Set<string>();
  const grupoIdDe = (centro: string): string => {
    const ya = grupoIdPorCentro.get(centro);
    if (ya) return ya;
    const id = slugGrupo(centro, slugsUsados);
    slugsUsados.add(id);
    grupoIdPorCentro.set(centro, id);
    return id;
  };

  const resueltos: ResueltoCentro[] = [];
  const pendientes: PendientePrograma[] = [];
  const idsUsados = new Set<string>();
  /** studentId -> centros donde ya quedo resuelto. Para `exclusivo`. */
  const asignados = new Map<string, string[]>();

  const pendienteId = (base: string): string => {
    // Deterministico: reimportar el mismo archivo debe producir los mismos documentos y
    // no una bandeja duplicada. Si el archivo trae dos veces la misma fila, sufijo.
    let id = base;
    for (let n = 2; idsUsados.has(id); n++) id = `${base}-${n}`;
    idsUsados.add(id);
    return id;
  };

  for (const fila of filas) {
    const grupoId = grupoIdDe(fila.centro);
    const nombreArchivo = nombreDeArchivo(fila);
    const grupoArchivo = (fila.grupoArchivo ?? '').trim();
    const tokensArchivo = tokens(nombreArchivo);
    const baseId = `${grupoId}_${(normalizeName(nombreArchivo) || 'sin-nombre').replace(/\s+/g, '-').toLowerCase()}`;

    const puntuados: Puntuado[] = [];
    for (const e of activos) {
      const score = puntuacion(tokensArchivo, tokensPorEstudiante.get(e.studentId) ?? []);
      if (score >= UMBRAL_PISTA) puntuados.push({ estudiante: e, score });
    }
    puntuados.sort((a, b) => b.score - a.score);

    const candidatos = puntuados.filter((p) => p.score >= UMBRAL);

    if (candidatos.length === 0) {
      pendientes.push({
        programaId,
        pendienteId: pendienteId(baseId),
        tipo: 'no_encontrado',
        nombreArchivo,
        grupoArchivo,
        grupoId,
        // Los parecidos por debajo del umbral van igual: son pistas, no propuestas. Por
        // eso `sugerido` queda en null — el sistema no propone lo que no sostiene.
        candidatos: puntuados.slice(0, 5).map((p) => comoCandidato(p.estudiante)),
        sugerido: null,
        estado: 'pendiente',
      });
      continue;
    }

    if (candidatos.length > 1) {
      // REGLA 3: el grado solo desempata, y ni siquiera siempre. Si exactamente uno de
      // los candidatos esta en el grado que dice el archivo, ese va marcado; si no, el de
      // mejor puntuacion. En ambos casos DECIDE UNA PERSONA.
      const enElGrado = candidatos.filter((p) => mismoGrado(grupoArchivo, p.estudiante.gradoActual));
      const sugerido =
        enElGrado.length === 1 ? enElGrado[0].estudiante.studentId : candidatos[0].estudiante.studentId;
      pendientes.push({
        programaId,
        pendienteId: pendienteId(baseId),
        tipo: 'homonimo',
        nombreArchivo,
        grupoArchivo,
        grupoId,
        candidatos: candidatos.map((p) => comoCandidato(p.estudiante)),
        sugerido,
        estado: 'pendiente',
      });
      continue;
    }

    const elegido = candidatos[0].estudiante;

    let enConflicto = false;

    if (exclusivo) {
      const yaEn = asignados.get(elegido.studentId);
      if (yaEn && !yaEn.includes(grupoId)) {
        // SE INSCRIBE EN LOS DOS, marcado. No se corta aqui.
        //
        // Quedarse con la primera aparicion y descartar esta es escoger al azar, porque
        // el orden de las hojas del Excel no es un criterio de nada. Y dejarlo fuera de
        // las dos lo castiga por un conflicto que no es suyo. Mientras la coordinadora
        // decide, el estudiante aparece en la planilla de LOS DOS lideres y cualquiera de
        // los dos puede llamarlo a lista la proxima semana. Decision de Julian,
        // 2026-08-24. La pantalla lo muestra marcado; el pendiente es el que obliga a
        // cerrar el caso.
        enConflicto = true;
        marcarConflicto(resueltos, elegido.studentId, yaEn);

        // `decision` guardara el grupoId GANADOR, no el studentId: aqui no se duda de
        // quien es la persona, se duda de en cual de los dos centros se queda.
        pendientes.push({
          programaId,
          pendienteId: pendienteId(`duplicado_${elegido.studentId}`),
          tipo: 'duplicado',
          nombreArchivo,
          grupoArchivo,
          grupoId,
          gruposEnConflicto: [...yaEn, grupoId],
          candidatos: [comoCandidato(elegido)],
          sugerido: null,
          estado: 'pendiente',
        });
      }
      asignados.set(elegido.studentId, yaEn ? [...yaEn, grupoId] : [grupoId]);
    }

    const literal = normalizeName(nombreArchivo) === normalizeName(
      `${elegido.apellidos} ${nombresDePila(elegido.apellidos, elegido.nombres)}`,
    );
    const gradoDistinto = grupoArchivo !== '' && !mismoGrado(grupoArchivo, elegido.gradoActual);
    const jArchivo = jornadaDelArchivo(grupoArchivo);
    const jornadaDistinta = jArchivo !== null && jArchivo !== jornadaDeGrado(elegido.gradoActual);

    if (!literal) {
      // Un solo candidato pero el nombre no coincide literalmente: se propone corregido.
      // No se resuelve solo porque son datos de menores y la correccion cambia a QUIEN se
      // le va a marcar la asistencia todo el semestre.
      pendientes.push({
        programaId,
        pendienteId: pendienteId(baseId),
        tipo: 'ortografia',
        nombreArchivo,
        grupoArchivo,
        grupoId,
        candidatos: [comoCandidato(elegido)],
        sugerido: elegido.studentId,
        estado: 'pendiente',
      });
      continue;
    }

    resueltos.push({
      grupoId,
      centro: fila.centro,
      studentId: elegido.studentId,
      nombreArchivo,
      grupoArchivo,
      gradoMatricula: elegido.gradoActual,
      gradoDistinto,
      jornadaDistinta,
      exacto: true,
      enConflicto,
    });
  }

  return { resueltos, pendientes };
}

/**
 * Marca como en conflicto las inscripciones YA emitidas del mismo estudiante.
 *
 * Hace falta porque el conflicto solo se descubre al llegar a la SEGUNDA aparicion: para
 * entonces la primera ya esta en `resueltos` sin marcar, y si se quedara asi el lider de
 * ese centro veria al estudiante como si no pasara nada.
 */
function marcarConflicto(
  resueltos: ResueltoCentro[],
  studentId: string,
  gruposPrevios: string[],
): void {
  for (const r of resueltos) {
    if (r.studentId === studentId && gruposPrevios.includes(r.grupoId)) {
      r.enConflicto = true;
    }
  }
}

/** Resumen para la pantalla de previsualizacion. */
export function resumirImportCentros(r: ResultadoImportCentros): {
  resueltos: number;
  pendientes: number;
  porTipo: Record<PendientePrograma['tipo'], number>;
  conGradoDistinto: number;
  conJornadaDistinta: number;
  /** Inscripciones marcadas por estar el estudiante en dos centros a la vez. */
  conConflicto: number;
} {
  const porTipo: Record<PendientePrograma['tipo'], number> = {
    homonimo: 0,
    no_encontrado: 0,
    ortografia: 0,
    duplicado: 0,
  };
  for (const p of r.pendientes) porTipo[p.tipo] += 1;
  return {
    resueltos: r.resueltos.length,
    pendientes: r.pendientes.length,
    porTipo,
    conGradoDistinto: r.resueltos.filter((x) => x.gradoDistinto).length,
    conJornadaDistinta: r.resueltos.filter((x) => x.jornadaDistinta).length,
    conConflicto: r.resueltos.filter((x) => x.enConflicto).length,
  };
}
