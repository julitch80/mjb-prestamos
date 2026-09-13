/**
 * Arma el archivo que el motor necesita y lee el que devuelve.
 *
 * El horario NO se construye de una vez para todo el colegio: se hace de una
 * sede y una jornada a la vez. Son problemas independientes —ocurren a horas
 * distintas, los grupos son disjuntos y nadie puede chocar consigo mismo entre
 * una y otra— así que partirlo no pierde nada, hace cada problema más pequeño y
 * permite que cada coordinador trabaje el suyo.
 */

import { ASIGNACION_2026, ASIGNATURAS } from '../asignacionAcademica';
import { horarioBase } from '../horarioBase';
import {
  AULA_GRUPO_TARDE, BLOQUE_CI, MIXTOS_TARDE, SEDES, USUARIOS,
} from '../maestros';
import { leerConfiguracion, type ConfiguracionAnio } from './configuracion';
import {
  DIAS,
  type Alcance, type AulaGenerador, type ClaseFijada, type Dia, type DocenteGenerador,
  type EntradaGenerador, type GrupoGenerador, type Jornada, type Lectura,
  type SalidaGenerador,
} from './tipos';

/** Espacios escasos: dos clases no pueden usarlos a la vez. */
const COMPARTIDAS_CONOCIDAS = new Set(['Lab. Ciencias', 'Sala Informática', 'Patio', 'Auditorio']);

/** Existen, pero no son salones de clase ordinaria. */
const NO_APTAS_PARA_CLASE = new Set(['Auditorio']);

/**
 * Espacios donde dos clases a la vez no estorban.
 *
 * El Patio es el caso real: dos grupos de educación física comparten cancha sin
 * problema. Marcarlo evita que el motor se prohíba horarios que el colegio da
 * por buenos, y que el validador avise de un choque que allí no existe.
 */
const NO_SE_DISPUTAN = new Set(['Patio']);

/** Un aula es "del docente" solo si la usa de forma consistente. */
const UMBRAL_AULA_FIJA = 0.9;

/** Con muy pocas clases el porcentaje engaña (Edgar sale 100% en el Auditorio). */
const MINIMO_CLASES_PARA_AULA_FIJA = 5;

const esCI = (id: string) => id === 'ci';
const esMediaTecnica = (id: string) => id.startsWith('mt_');
const jornadaDeGrupo = (grupo: string): Jornada => (grupo.includes('º') ? 'tarde' : 'manana');

export interface OpcionesEntrada {
  /** Qué sede y qué jornada se va a construir. Nunca las dos a la vez. */
  sede: string;
  jornada: Jornada;
  anio?: number;
  exigentes?: Set<string>;
  fijadas?: ClaseFijada[];
  /** `null` = ese año no hay Centro de Interés en esta jornada. */
  centroInteres?: { dia: Dia; bloque: number } | null;
  limiteSegundos?: number;
}

/**
 * Si una sede tiene asignación académica cargada.
 *
 * Los datos actuales no llevan marca de sede porque hasta ahora solo existía la
 * Central. Se asume que todo lo que hay es de ella; el día que se carguen las
 * otras habrá que añadir el campo y cambiar esta función, no el resto.
 */
export function hayDatosDeSede(sede: string): boolean {
  return sede === 'central';
}

/**
 * Las sedes del colegio y si se puede generar en ellas.
 *
 * Hoy solo la Central tiene datos: la asignación cubre bachillerato (9º a 11º en
 * la mañana, 6º a 8º en la tarde). Las dos de primaria están declaradas y vacías,
 * y la pantalla debe decirlo en vez de dejar generar un horario de la nada.
 */
export function sedesParaGenerar() {
  return SEDES.map(s => ({
    id: s.id,
    nombre: s.nombre,
    jornadas: s.jornadas as Jornada[],
    tieneDatos: s.configurada === true && hayDatosDeSede(s.id),
  }));
}

/** Cuántas clases de mañana da cada docente en cada aula, según el horario vigente. */
function usoDeAulasEnLaManana(): Record<string, Record<string, number>> {
  const uso: Record<string, Record<string, number>> = {};
  for (const e of horarioBase) {
    if (e.jornada !== 'manana') continue;
    (uso[e.docente] ??= {})[e.aula] = ((uso[e.docente] ?? {})[e.aula] ?? 0) + 1;
  }
  return uso;
}

function aulaFijaDe(docenteId: string, uso: Record<string, Record<string, number>>): string | null {
  const suyas = uso[docenteId];
  if (!suyas) return null;
  const total = Object.values(suyas).reduce((s, v) => s + v, 0);
  if (total < MINIMO_CLASES_PARA_AULA_FIJA) return null;
  const [mejor, n] = Object.entries(suyas).sort((a, b) => b[1] - a[1])[0];
  return n / total >= UMBRAL_AULA_FIJA ? mejor : null;
}

/**
 * Franjas en que un docente NO puede recibir clase, dentro de la jornada pedida.
 *
 * Los mixtos son el único caso que la app conoce hoy: los días que bajan a la
 * tarde no están en la mañana, y los demás días no están en la tarde.
 */
function noDisponibleDe(
  docenteId: string, jornada: Jornada, cuantosBloques: number, dias: Dia[],
  marcadasAMano: ConfiguracionAnio['noDisponible'],
): DocenteGenerador['no_disponible'] {
  const franjas: DocenteGenerador['no_disponible'] = [];

  // 1. Lo que la app deduce sola: quien baja a la tarde no está arriba esos días.
  const diasTarde = MIXTOS_TARDE[docenteId];
  if (diasTarde) {
    const bloques = Array.from({ length: cuantosBloques }, (_, i) => i + 1);
    const diasBloqueados = jornada === 'manana'
      ? diasTarde                                   // esos días está abajo, en la tarde
      : dias.filter(d => !diasTarde.includes(d));   // los demás días no baja
    franjas.push(...diasBloqueados.map(dia => ({ jornada, dia: dia as Dia, bloques })));
  }

  // 2. Lo que marcó el coordinador. Se SUMA, no sustituye: lo deducido sigue
  //    siendo cierto, y una hora bloqueada de más nunca produce un horario
  //    inválido; una de menos, sí.
  for (const f of marcadasAMano[docenteId] ?? []) {
    if (f.jornada !== jornada || !dias.includes(f.dia)) continue;
    const dentro = f.bloques.filter(b => b >= 1 && b <= cuantosBloques);
    if (dentro.length) franjas.push({ jornada, dia: f.dia, bloques: dentro });
  }

  return franjas;
}

/**
 * Dónde está hoy el Centro de Interés de la mañana.
 *
 * No está declarado en ningún dato maestro: se deduce de dónde caen esas clases
 * en el horario vigente. Es el punto de partida de la configuración.
 */
export function ciMananaDeducida(): { dia: Dia; bloque: number } {
  const clases = horarioBase.filter(
    e => e.jornada === 'manana' && String(e.grado).includes('CI'));
  return { dia: (clases[0]?.dia ?? 'martes') as Dia, bloque: BLOQUE_CI.manana };
}

export function construirEntrada(opciones: OpcionesEntrada): EntradaGenerador {
  const { sede, jornada } = opciones;
  const sedeInfo = SEDES.find(x => x.id === sede);

  // Cómo es la semana este año. Sale de lo que el coordinador haya configurado;
  // si no ha tocado nada, de los datos de la app, y todo funciona como antes.
  const config = leerConfiguracion(ciMananaDeducida());
  const exigentes = opciones.exigentes ?? new Set(config.exigentes);

  const alcance: Alcance = { sede, sede_nombre: sedeInfo?.nombre ?? sede, jornada };

  // Solo lo de esta jornada. El Centro de Interés y la media técnica no se
  // generan: la franja se reserva y las horas de contrajornada se declaran aparte.
  const filasClase = hayDatosDeSede(sede)
    ? ASIGNACION_2026.filter(f => !esCI(f.asignaturaId) && !esMediaTecnica(f.asignaturaId)
      && jornadaDeGrupo(f.grupo) === jornada)
    : [];
  const filasMT = ASIGNACION_2026.filter(f => esMediaTecnica(f.asignaturaId));

  const aulaDeGrupoTarde: Record<string, string> = {};
  for (const [aula, grupo] of Object.entries(AULA_GRUPO_TARDE)) aulaDeGrupoTarde[grupo] = aula;

  const grupos: GrupoGenerador[] = [...new Set(filasClase.map(f => f.grupo))].sort()
    .map(id => {
      const g: GrupoGenerador = { id, jornada };
      if (jornada === 'tarde' && aulaDeGrupoTarde[id]) g.aula_fija = aulaDeGrupoTarde[id];
      return g;
    });

  // Solo las aulas que se usan en esta jornada. Que varias personas pisen un aula
  // genera competencia únicamente en la mañana, donde el aula es del docente: en
  // la tarde es del grupo, y un grupo no puede tener dos clases a la vez.
  const aulasDeGrupoTarde = new Set(Object.keys(AULA_GRUPO_TARDE));
  const docentesPorAula: Record<string, Set<string>> = {};
  for (const e of horarioBase) {
    if (e.jornada === jornada) (docentesPorAula[e.aula] ??= new Set()).add(e.docente);
  }
  const aulas: AulaGenerador[] = Object.keys(docentesPorAula).sort().map(id => ({
    id,
    tipo: id.startsWith('Lab') ? 'laboratorio'
      : id.startsWith('Sala') ? 'informatica'
        : id === 'Patio' ? 'deportivo'
          : id === 'Auditorio' ? 'auditorio' : 'normal',
    apta_para_clase: !NO_APTAS_PARA_CLASE.has(id),
    compartida: jornada === 'manana' && !aulasDeGrupoTarde.has(id)
      && (COMPARTIDAS_CONOCIDAS.has(id) || (docentesPorAula[id]?.size ?? 0) > 1),
    exclusiva: !NO_SE_DISPUTAN.has(id),
  }));

  const uso = usoDeAulasEnLaManana();
  const idsConClase = new Set(filasClase.map(f => f.docenteId));
  const docentes: DocenteGenerador[] = USUARIOS
    .filter(u => u.rol === 'docente' && idsConClase.has(u.id))
    .map(u => {
      const d: DocenteGenerador = {
        id: u.id,
        nombre: u.nombre,
        jornada: u.jornada as DocenteGenerador['jornada'],
        no_disponible: noDisponibleDe(
          u.id, jornada, config.bloques[jornada], config.diasLectivos, config.noDisponible),
      };
      // El aula propia solo aplica en la mañana; en la tarde el aula es del grupo.
      const aula = jornada === 'manana' ? aulaFijaDe(u.id, uso) : null;
      if (aula) d.aula_fija = aula;
      return d;
    });

  // Lo que pida quien llama manda sobre lo configurado: sirve para preguntarle al
  // motor «¿y si este año no hubiera Centro de Interés?» sin cambiar nada.
  const ci = opciones.centroInteres === undefined
    ? config.centroInteres[jornada]
    : opciones.centroInteres;

  const horasClase = filasClase.reduce((s, f) => s + f.horas, 0);

  return {
    version: '1.0',
    colegio: 'I.E. Manuel J. Betancur',
    anio: opciones.anio ?? new Date().getFullYear(),
    alcance,
    notas: `${alcance.sede_nombre}, jornada de la ${jornada}. `
      + `Preparado desde la app el ${new Date().toISOString().slice(0, 10)}: `
      + `${filasClase.length} renglones de clase, ${horasClase} horas. `
      + `Quedan fuera el Centro de Interés (franja reservada) y la media técnica `
      + `(contrajornada, fuera de la rejilla semanal).`,
    config: {
      dias: config.diasLectivos,
      bloques_por_jornada: config.bloques,
      centro_interes: ci ? { [jornada]: ci } : {},
      // Solo la media técnica de docentes de esta jornada: para los demás no es
      // una restricción, es ruido.
      contrajornada_media_tecnica: Object.entries(config.contrajornada)
        .map(([grupo, dias]) => {
          const fila = filasMT.find(f => f.grupo === grupo);
          return {
            grupo,
            dias: dias as Dia[],
            docente: fila?.docenteId ?? '',
            horas: fila?.horas ?? 0,
          };
        })
        .filter(mt => idsConClase.has(mt.docente)),
    },
    asignaturas: ASIGNATURAS
      .filter(a => !esCI(a.id) && !esMediaTecnica(a.id))
      .map(a => ({ id: a.id, nombre: a.nombre, abrev: a.abrev, exigente: exigentes.has(a.id) })),
    docentes,
    grupos,
    aulas,
    asignacion: filasClase.map(f => ({
      docente: f.docenteId,
      asignatura: f.asignaturaId,
      grupo: f.grupo,
      horas: f.horas,
    })),
    fijadas: opciones.fijadas ?? [],
    pesos: {
      bloques_dobles: 10,
      exigentes_temprano: 3,
      mixtos_concentrados: 5,
      dias_llenos: 30,
    },
    limite_segundos: opciones.limiteSegundos ?? 300,
  };
}

// --------------------------------------------------------------------------
// Lectura de lo que devuelve el motor
// --------------------------------------------------------------------------

function falta(obj: unknown, campo: string): boolean {
  return !obj || typeof obj !== 'object' || !(campo in (obj as Record<string, unknown>));
}

/**
 * Lee un `salida.json`.
 *
 * Se comprueba antes de aceptarlo: cargar a medias un horario mal formado sería
 * peor que rechazarlo, porque el error aparecería después y disfrazado.
 */
export function leerSalida(texto: string): Lectura<SalidaGenerador> {
  let crudo: unknown;
  try {
    crudo = JSON.parse(texto);
  } catch (e) {
    return { ok: false, errores: [`El archivo no es un JSON válido: ${(e as Error).message}`] };
  }

  // El error más fácil de cometer aquí es cargar el archivo del paso 1 en vez del
  // que produce el motor: los dos son JSON y acaban en la misma carpeta de
  // descargas. Reconocerlo ahorra buscar cuatro "campos" que nunca tuvo.
  if (!falta(crudo, 'asignacion') && !falta(crudo, 'docentes') && falta(crudo, 'horario')) {
    return {
      ok: false,
      errores: [
        'Este es el archivo de datos del paso 1, no el horario que produce el motor. '
        + 'El que hay que cargar aquí se llama "horario_..." y queda en la carpeta '
        + '"salidas" del proyecto Horarios.',
      ],
    };
  }

  const errores: string[] = [];
  for (const campo of ['version', 'estado', 'horario', 'calidad', 'metricas']) {
    if (falta(crudo, campo)) errores.push(`Falta el campo "${campo}".`);
  }
  if (errores.length) return { ok: false, errores };

  const s = crudo as SalidaGenerador;
  if (!Array.isArray(s.horario)) {
    return { ok: false, errores: ['El campo "horario" debería ser una lista de clases.'] };
  }
  if (!['completo', 'parcial', 'infactible'].includes(s.estado)) {
    errores.push(`Estado desconocido: "${s.estado}".`);
  }

  s.horario.forEach((c, i) => {
    for (const campo of ['dia', 'bloque', 'docente', 'grado', 'aula', 'jornada'] as const) {
      if (c[campo] === undefined) errores.push(`horario[${i}]: falta "${campo}".`);
    }
    if (c.dia !== undefined && !DIAS.includes(c.dia)) {
      errores.push(`horario[${i}]: "${c.dia}" no es un día lectivo.`);
    }
  });

  if (errores.length) return { ok: false, errores: errores.slice(0, 20) };
  return { ok: true, valor: s };
}

/** Qué jornadas cubre un horario cargado. Sirve para avisar de lo que NO cubre. */
export function jornadasDeSalida(salida: SalidaGenerador): Jornada[] {
  return [...new Set(salida.horario.map(c => c.jornada))].sort();
}

/**
 * Nombre con el que se descarga el archivo para el motor.
 *
 * Lleva sede y jornada porque ahora hay varios: sin eso, cuatro archivos en la
 * carpeta de descargas serían indistinguibles y es fácil generar el equivocado.
 */
export function nombreArchivoEntrada(anio: number, sede: string, jornada: Jornada): string {
  return `entrada_horario_${anio}_${sede}_${jornada}.json`;
}
