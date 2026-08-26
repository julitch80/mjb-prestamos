/**
 * Programas — centros de interes. Logica pura, sin Firestore.
 * Contrato: `docs/modelo-centros-interes.md`.
 *
 * Un centro de interes no es un evento: se repite un semestre entero, su autoridad
 * cuelga de una coordinacion que manda sobre los veintiun centros a la vez, y obliga a
 * una regla que el evento no tiene (un estudiante, un solo centro).
 *
 * REGLA DE ORO heredada de stats.ts y de eventos.ts: el universo son las SESIONES
 * REGISTRADAS, jamas el calendario ni el rango `desde`/`hasta` del programa. Un
 * miercoles del semestre en el que nadie paso lista NO existe para el calculo. Contar el
 * rango convertiria en ausencia lo que solo fue un dia sin registro.
 *
 * La estadistica NO se reimplementa aqui: se delega en `estadisticaEvento` de
 * eventos.ts, que ya resuelve el caso "un estudiante en una lista fija de sesiones", que
 * es exactamente lo que es un centro de interes.
 */

import { estadisticaEvento, type EventStats } from './eventos';
import { jornadaDeGrado } from './ids';
import type { MarkCode } from './marks';
import type {
  EventSession,
  GrupoPrograma,
  Jornada,
  Programa,
  SesionPrograma,
  Sede,
  Student,
} from './types';

// ---------------------------------------------------------------------------
//  Slugs — el id es la RUTA, y la ruta la lee un humano
// ---------------------------------------------------------------------------

/**
 * Los nombres reales traen comillas, dos puntos, tildes y mayusculas sostenidas:
 * `Élite Digital: El Código Invisible del Siglo XXI`,
 * `"AL PING AL PONG: TENIS DE MESA"`, `Música en el 'J'`.
 *
 * Las comillas se BORRAN en vez de convertirse en separador. Si se trataran como un
 * caracter mas, `Música en el 'J'` daria `musica-en-el-j-` y `"Tenis"` daria `-tenis-`:
 * guiones colgando que no significan nada. Lo que aporta el nombre es la letra, no la
 * comilla que la rodea.
 */
const COMILLAS = /['"`‘’“”«»]/g;

/** Tope de longitud del slug. Firestore admite mucho mas; esto es por legibilidad. */
const LARGO_MAXIMO = 60;

function slugBase(nombre: string): string {
  const limpio = (nombre ?? '')
    .normalize('NFD')
    // Quita los diacriticos. La 'ñ' se descompone en 'n' + tilde, asi que cae aqui sola.
    .replace(/[̀-ͯ]/g, '')
    .replace(COMILLAS, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  if (limpio.length <= LARGO_MAXIMO) return limpio;
  // Corta en frontera de palabra: 'centro-de-interes-de-a' es peor que
  // 'centro-de-interes-de' para alguien que lee la ruta en la consola de Firestore.
  const cortado = limpio.slice(0, LARGO_MAXIMO);
  const ultimo = cortado.lastIndexOf('-');
  return (ultimo > 0 ? cortado.slice(0, ultimo) : cortado).replace(/-+$/g, '');
}

/**
 * Slug ASCII estable a partir de un nombre. `usados` son los slugs ya asignados: si el
 * nuevo choca, se le pone sufijo numerico (`-2`, `-3`).
 *
 * Se colisiona a proposito lo menos posible pero NO se garantiza unicidad global: dos
 * programas de semestres distintos pueden llamarse igual y ahi el sufijo es la respuesta
 * correcta, no un error.
 */
function slugConSufijo(nombre: string, usados: Iterable<string>, campo: string): string {
  const base = slugBase(nombre);
  if (!base) {
    // Un nombre que solo tiene simbolos no puede ser un id: mejor fallar aqui que
    // escribir un documento en una ruta vacia. Mismo criterio que ids.ts.
    throw new Error(`${campo} sin letras ni numeros utilizables: "${nombre}"`);
  }
  const set = new Set(usados);
  if (!set.has(base)) return base;
  for (let n = 2; ; n++) {
    const candidato = `${base}-${n}`;
    if (!set.has(candidato)) return candidato;
  }
}

export function slugPrograma(nombre: string, usados: Iterable<string> = []): string {
  return slugConSufijo(nombre, usados, 'Nombre del programa');
}

export function slugGrupo(nombre: string, usados: Iterable<string> = []): string {
  return slugConSufijo(nombre, usados, 'Nombre del centro de interes');
}

// ---------------------------------------------------------------------------
//  Validacion
// ---------------------------------------------------------------------------

const SEDES: Sede[] = ['central', 'gustavo_rodas', 'la_finquita'];
const JORNADAS: Jornada[] = ['manana', 'tarde'];
const FECHA = /^\d{4}-\d{2}-\d{2}$/;
const CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type BorradorPrograma = Pick<
  Programa,
  'nombre' | 'sede' | 'desde' | 'hasta' | 'coordinadores'
> &
  Partial<Pick<Programa, 'jornada'>>;

/**
 * Devuelve TODOS los problemas, no el primero: quien llena el formulario es la
 * coordinadora, y corregir de a un error por intento es maltratarla.
 *
 * Los mensajes van en espanol claro y CON acentos —los lee una persona, no un log—,
 * igual que `validarRangoEvento` en eventos.ts.
 */
export function validarPrograma(p: BorradorPrograma): string[] {
  const errores: string[] = [];

  if (!(p.nombre ?? '').trim()) errores.push('El programa necesita un nombre.');

  if (!p.desde || !p.hasta) {
    errores.push('Las fechas de inicio y fin del semestre son obligatorias.');
  } else if (!FECHA.test(p.desde) || !FECHA.test(p.hasta)) {
    errores.push('Las fechas deben ir en formato AAAA-MM-DD.');
  } else if (p.hasta < p.desde) {
    errores.push('La fecha de fin no puede ser anterior a la de inicio.');
  }

  const coordinadores = p.coordinadores ?? [];
  if (coordinadores.length === 0) {
    // Sin coordinacion el programa nace huerfano: nadie podria leer sus centros, porque
    // la unica rama de la regla que no mira `resource` es justamente la de coordinacion.
    errores.push('El programa debe tener al menos un coordinador.');
  }
  for (const c of coordinadores) {
    if (!CORREO.test(c)) {
      errores.push(`«${c}» no parece un correo válido.`);
    } else if (c !== c.toLowerCase()) {
      errores.push(`El correo «${c}» debe ir en minúsculas.`);
    }
  }

  if (!SEDES.includes(p.sede)) {
    errores.push(`La sede «${p.sede}» no existe. Debe ser central, gustavo_rodas o la_finquita.`);
  }

  if (p.jornada !== undefined && !JORNADAS.includes(p.jornada)) {
    errores.push(`La jornada «${p.jornada}» no existe. Debe ser mañana o tarde, o dejarse vacía para las dos.`);
  }

  return errores;
}

// ---------------------------------------------------------------------------
//  Exclusividad — la regla que las reglas de Firestore NO pueden verificar
// ---------------------------------------------------------------------------

export interface DuplicadoPrograma {
  studentId: string;
  /** Los grupos donde aparece, en el orden en que llegaron. Siempre dos o mas. */
  grupoIds: string[];
}

/**
 * `exclusivo`: un estudiante, un solo centro por semestre.
 *
 * ESTO VIVE AQUI Y NO EN LAS REGLAS A PROPOSITO. Es una restriccion de unicidad ENTRE
 * documentos, y una regla de Firestore no la puede comprobar sin leer los veintiun
 * grupos del programa: son veintiun `get()` contra un tope de 10 por peticion. Quien
 * busque esta comprobacion en `firestore.rules` y no la encuentre, que no concluya que
 * falta — esta aqui, y los choques quedan como pendientes de tipo `duplicado` para que
 * la coordinadora decida cual centro se queda con el estudiante.
 */
export function detectarDuplicados(
  grupos: Pick<GrupoPrograma, 'grupoId' | 'miembros'>[],
): DuplicadoPrograma[] {
  const porEstudiante = new Map<string, string[]>();
  for (const g of grupos) {
    // Un id repetido DENTRO del mismo grupo no es un choque de exclusividad, es un
    // desorden del propio array: se ignora aqui para no inventar un duplicado falso.
    for (const studentId of new Set(g.miembros ?? [])) {
      const lista = porEstudiante.get(studentId);
      if (lista) lista.push(g.grupoId);
      else porEstudiante.set(studentId, [g.grupoId]);
    }
  }

  const salida: DuplicadoPrograma[] = [];
  for (const [studentId, grupoIds] of porEstudiante) {
    if (grupoIds.length > 1) salida.push({ studentId, grupoIds });
  }
  return salida.sort((a, b) => a.studentId.localeCompare(b.studentId));
}

// ---------------------------------------------------------------------------
//  Cobertura — a quien falta inscribir
// ---------------------------------------------------------------------------

export interface ConteoCobertura {
  total: number;
  inscritos: number;
  sinInscribir: number;
  /** inscritos / total en porcentaje, con un decimal. 0 si no hay matriculados. */
  porcentaje: number;
}

export interface CoberturaPrograma extends ConteoCobertura {
  /** Grado LITERAL como clave ('9.1', '6º1'). Nunca saneado. */
  porGrado: Record<string, ConteoCobertura>;
  porJornada: Record<Jornada, ConteoCobertura>;
  /**
   * Los que no estan en ningun centro. Es LA lista de trabajo de la coordinadora, por
   * eso van los estudiantes completos y no solo los ids: la pantalla necesita el nombre
   * y el grado para poder llamarlos.
   */
  faltantes: Student[];
}

function conteo(total: number, inscritos: number): ConteoCobertura {
  return {
    total,
    inscritos,
    sinInscribir: total - inscritos,
    porcentaje: total === 0 ? 0 : Math.round((inscritos / total) * 1000) / 10,
  };
}

/**
 * Cuantos matriculados estan en algun centro y cuantos no, desglosado por grado y por
 * jornada.
 *
 * Solo cuentan los estudiantes ACTIVOS: un retirado que sigue en la lista de miembros de
 * un centro no puede bajar la cobertura de un grado al que ya no pertenece. Y solo
 * cuentan los grupos ACTIVOS, por lo mismo — un centro dado de baja no inscribe a nadie.
 */
export function coberturaPrograma(
  matriculados: Student[],
  grupos: Pick<GrupoPrograma, 'grupoId' | 'miembros' | 'activo'>[],
  /**
   * Jornada del programa. Cuando el programa declara una, SOLO cuentan los estudiantes de
   * esa jornada.
   *
   * ⚠️ SIN ESTO LA CIFRA MIENTE, y mintio en produccion (2026-08-26). El panel del
   * programa de la TARDE decia "45% con centro de interes · 375 sin centro" — porque
   * metia en el denominador a los 324 de la MAÑANA, que si tienen centro, solo que en el
   * otro programa. Lo correcto para la tarde es 313 de 364 = 86%, y 51 sin centro.
   *
   * Y el numero equivocado no era inofensivo: "375 sin centro" es una lista de estudiantes
   * a los que salir a buscar, y 324 de ellos no habia que buscarlos.
   *
   * Ausente = el programa cubre las dos jornadas y cuentan todos.
   */
  jornada?: Jornada,
): CoberturaPrograma {
  const inscritos = new Set<string>();
  for (const g of grupos) {
    if (!g.activo) continue;
    for (const id of g.miembros ?? []) inscritos.add(id);
  }

  const activos = matriculados.filter(
    (e) => e.activo && (!jornada || jornadaDeGrado(e.gradoActual) === jornada),
  );
  const faltantes: Student[] = [];
  const totalPorGrado = new Map<string, number>();
  const inscritosPorGrado = new Map<string, number>();
  const totalPorJornada = new Map<Jornada, number>();
  const inscritosPorJornada = new Map<Jornada, number>();

  for (const e of activos) {
    const jornada = jornadaDeGrado(e.gradoActual);
    totalPorGrado.set(e.gradoActual, (totalPorGrado.get(e.gradoActual) ?? 0) + 1);
    totalPorJornada.set(jornada, (totalPorJornada.get(jornada) ?? 0) + 1);
    if (inscritos.has(e.studentId)) {
      inscritosPorGrado.set(e.gradoActual, (inscritosPorGrado.get(e.gradoActual) ?? 0) + 1);
      inscritosPorJornada.set(jornada, (inscritosPorJornada.get(jornada) ?? 0) + 1);
    } else {
      faltantes.push(e);
    }
  }

  const porGrado: Record<string, ConteoCobertura> = {};
  for (const [grado, total] of totalPorGrado) {
    porGrado[grado] = conteo(total, inscritosPorGrado.get(grado) ?? 0);
  }

  const porJornada: Record<Jornada, ConteoCobertura> = {
    manana: conteo(totalPorJornada.get('manana') ?? 0, inscritosPorJornada.get('manana') ?? 0),
    tarde: conteo(totalPorJornada.get('tarde') ?? 0, inscritosPorJornada.get('tarde') ?? 0),
  };

  const global = conteo(activos.length, activos.length - faltantes.length);

  return {
    ...global,
    porGrado,
    porJornada,
    // Mismo orden que `resolverIntegrantes` y que `leerGrupo`: apellidos y luego
    // nombres, para que la lista no baile entre pantallas.
    faltantes: faltantes.sort((a, b) =>
      `${a.apellidos} ${a.nombres}`.localeCompare(`${b.apellidos} ${b.nombres}`),
    ),
  };
}

// ---------------------------------------------------------------------------
//  Estadistica — agregada por grupo, reutilizando eventos.ts
// ---------------------------------------------------------------------------

export interface GrupoConSesiones {
  grupo: Pick<GrupoPrograma, 'grupoId' | 'nombre' | 'miembros'>;
  /** SOLO las sesiones que existen en Firestore. Ver la regla de oro del encabezado. */
  sesiones: SesionPrograma[];
}

export interface EstadisticaGrupo {
  grupoId: string;
  nombre: string;
  miembros: number;
  /** Denominador base: sesiones REGISTRADAS del grupo. Se muestra SIEMPRE. */
  sesionesCount: number;
  /** miembros x sesionesCount. El otro denominador que no se puede ocultar. */
  oportunidades: number;
  porMarca: Record<MarkCode, number>;
  ausenciasTotales: number;
  sinRegistrar: number;
  /** ausenciasTotales / oportunidades en porcentaje, con un decimal. */
  tasaInasistencia: number;
  porEstudiante: Record<string, EventStats>;
}

export interface EstadisticaProgramaTotal {
  grupos: EstadisticaGrupo[];
  /** Suma de las sesiones registradas de todos los grupos, no dias de calendario. */
  sesionesCount: number;
  miembros: number;
  oportunidades: number;
  porMarca: Record<MarkCode, number>;
  ausenciasTotales: number;
  sinRegistrar: number;
  tasaInasistencia: number;
}

function marcaVacia(): Record<MarkCode, number> {
  return {
    asistencia: 0,
    ausencia: 0,
    retraso: 0,
    ausencia_justificada: 0,
    retraso_justificado: 0,
    evasion: 0,
    ausencia_autorizada: 0,
  };
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/**
 * `estadisticaEvento` pide `EventSession[]`. Una `SesionPrograma` es identica en forma
 * —asi se diseno a proposito— salvo que su identidad es programa+grupo en vez de evento.
 * Se adapta aqui, en cuatro lineas, en vez de duplicar el motor de conteo.
 */
function comoSesionesDeEvento(sesiones: SesionPrograma[]): EventSession[] {
  return sesiones.map((s) => ({
    eventId: `${s.programaId}/${s.grupoId}`,
    fecha: s.fecha,
    estudiantes: s.estudiantes,
    ultimaEscrituraPor: s.ultimaEscrituraPor,
    ultimaEscrituraEn: s.ultimaEscrituraEn,
  }));
}

/**
 * Agrega el programa completo a partir de sus grupos.
 *
 * El desglose por estudiante sale tal cual de `estadisticaEvento`: en un centro de
 * interes la pertenencia la define `miembros` —foto fija tomada al inscribir—, no la
 * matricula vigente. Preguntar "¿estaba matriculado ese dia?" no aplica; la pregunta es
 * "¿estaba en la lista del centro?", y esa lista ya es la respuesta.
 */
export function estadisticaPrograma(entradas: GrupoConSesiones[]): EstadisticaProgramaTotal {
  const grupos: EstadisticaGrupo[] = entradas.map(({ grupo, sesiones }) => {
    const comoEvento = comoSesionesDeEvento(sesiones);
    const miembros = grupo.miembros ?? [];
    const porMarca = marcaVacia();
    const porEstudiante: Record<string, EventStats> = {};
    let ausenciasTotales = 0;
    let sinRegistrar = 0;

    for (const studentId of miembros) {
      const st = estadisticaEvento(studentId, comoEvento);
      porEstudiante[studentId] = st;
      ausenciasTotales += st.ausenciasTotales;
      sinRegistrar += st.sinRegistrar;
      for (const code of Object.keys(porMarca) as MarkCode[]) {
        porMarca[code] += st.porMarca[code];
      }
    }

    const oportunidades = miembros.length * sesiones.length;
    return {
      grupoId: grupo.grupoId,
      nombre: grupo.nombre,
      miembros: miembros.length,
      sesionesCount: sesiones.length,
      oportunidades,
      porMarca,
      ausenciasTotales,
      sinRegistrar,
      tasaInasistencia: oportunidades === 0 ? 0 : round1((ausenciasTotales / oportunidades) * 100),
      porEstudiante,
    };
  });

  const total = marcaVacia();
  let ausenciasTotales = 0;
  let sinRegistrar = 0;
  let sesionesCount = 0;
  let miembros = 0;
  let oportunidades = 0;
  for (const g of grupos) {
    ausenciasTotales += g.ausenciasTotales;
    sinRegistrar += g.sinRegistrar;
    sesionesCount += g.sesionesCount;
    miembros += g.miembros;
    oportunidades += g.oportunidades;
    for (const code of Object.keys(total) as MarkCode[]) total[code] += g.porMarca[code];
  }

  return {
    grupos,
    sesionesCount,
    miembros,
    oportunidades,
    porMarca: total,
    ausenciasTotales,
    sinRegistrar,
    tasaInasistencia: oportunidades === 0 ? 0 : round1((ausenciasTotales / oportunidades) * 100),
  };
}
