import { compararGrupos, horaOrdinal } from './maestros';

// ── Tipos ─────────────────────────────────────────────────────────────────────

export interface AusenciaDocente {
  docenteId: string;
  bloques: number[]; // lista de bloques afectados (todos los bloques del día si está completamente ausente)
  // ¿El docente estará en el colegio ese día (permiso parcial, comisión en la sede, etc.)?
  // undefined se trata como true (comportamiento histórico: el docente ausente se
  // considera disponible/libre en sus horas fuera de los bloques declarados ausentes).
  // Solo cuando es explícitamente false el docente se excluye por completo del día
  // como posible supervisor/apoyo.
  presenteEnColegio?: boolean;
}

export type TipoApoyo = 'PTA' | 'UAI' | 'docente_apoyo' | 'taller' | 'otro';

export interface ApoyoDisponible {
  id: string;
  tipo: TipoApoyo;
  nombre: string;        // nombre del apoyo (persona o descripción del taller)
  bloques: number[];     // bloques en los que está disponible
}

export interface ModificacionBloque {
  bloqueOriginal: number;
  bloqueNuevo: number | null; // null = eliminado/cancelado
  docenteOriginal: string;
  docenteNuevo?: string;       // si se sustituye por otro docente o apoyo
  grupo: string;
  aula: string;
  apoyoId?: string;            // si se cubrió con un apoyo
  esTaller?: boolean;          // queda con actividad/taller en ese bloque
  supervisorId?: string;       // docente libre que supervisa el taller
}

export type EstadoHorarioMod = 'borrador' | 'guardado';

// Un ACOMPAÑANTE no es una reubicación: su horario no cambia, simplemente
// va con su grupo a una actividad fuera del aula. Por eso el sistema no
// generaba ningún aviso para él (no hay bloques alterados que detectar) —
// este es justo el caso que originó el módulo: ver docs/modulo-dia-escolar.md.
export interface Acompanante {
  docenteId: string;
  grupo: string;        // el grupo al que acompaña
  bloques: number[];    // en qué bloques
  nota?: string;        // p. ej. "Actividad con los onces"
}

export interface HorarioModificado {
  id: string;
  fecha: string;                       // YYYY-MM-DD
  jornada: 'manana' | 'tarde';
  autor: string;                       // userId del coordinador que crea el borrador
  ausencias: AusenciaDocente[];
  apoyos: ApoyoDisponible[];
  modificaciones: ModificacionBloque[]; // se completa en la fase del editor
  estado: EstadoHorarioMod;
  timestamp: string;
  // OPCIONAL: modificaciones guardadas antes de este cambio no lo tienen.
  // Tratar `undefined` como lista vacía en todas partes — nunca asumir que existe.
  acompanantes?: Acompanante[];
}

// ── Constantes ────────────────────────────────────────────────────────────────

export const TIPO_APOYO_LABEL: Record<TipoApoyo, string> = {
  PTA:           'Docente PTA',
  UAI:           'Docente UAI',
  docente_apoyo: 'Docente de apoyo',
  taller:        'Taller dejado por el docente',
  otro:          'Otro',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

export function generarIdHorarioMod(): string {
  return `hm_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function generarIdApoyo(): string {
  return `ap_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

export function generarIdAcompanante(): string {
  return `ac_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

export function fechaHoyLocal(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function diaDeSemana(fecha: string): string {
  const dias = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
  return dias[new Date(fecha + 'T12:00:00').getDay()];
}

const DIAS_LEGIBLE: Record<string, string> = {
  domingo: 'Domingo', lunes: 'Lunes', martes: 'Martes', miercoles: 'Miércoles',
  jueves: 'Jueves',   viernes: 'Viernes', sabado: 'Sábado',
};

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

export function formatearFechaLegible(fecha: string): string {
  const [a, m, d] = fecha.split('-');
  const dia = diaDeSemana(fecha);
  return `${DIAS_LEGIBLE[dia]} ${parseInt(d)} ${MESES[parseInt(m) - 1]} ${a}`;
}

export function obtenerHorariosVigentes(
  horarios: HorarioModificado[],
  fecha: string,
  jornada: 'manana' | 'tarde'
): HorarioModificado[] {
  return horarios.filter(h => h.fecha === fecha && h.jornada === jornada && h.estado === 'guardado');
}

// ── Jornada reducida (acortar día por acto cívico / reunión) ─────────────────

export interface BloqueRecalculado {
  id: number;
  inicio: string; // HH:MM
  fin: string;
  descansoDespues?: number; // minutos de descanso que siguen a este bloque, si hay
}

/**
 * Un descanso configurable de la jornada acortada. `despuesDe` identifica el
 * bloque tras el cual va (1-indexado); `duracion` en minutos.
 */
export interface DescansoConfig {
  despuesDe: number;
  duracion: number;
}

export interface JornadaReducida {
  id: string;
  fecha: string;
  jornada: 'manana' | 'tarde';
  autor: string;
  horaInicio: string;    // hora de inicio de la jornada (HH:MM)
  horaFin: string;       // hora de fin de la jornada (HH:MM)
  motivo: string;        // ej. "Acto cívico", "Reunión de docentes"
  bloques: BloqueRecalculado[];
  numBloques?: number;    // cantidad de horas de clase dictadas (default 6 si no está presente)
  // Descansos aplicados. AUSENTE (undefined) = patrón institucional (comportamiento
  // histórico, obligatorio para no romper jornadas ya guardadas en el backend).
  // Array VACÍO = el coordinador eligió explícitamente que no haya ningún descanso.
  // Estas dos cosas NO son equivalentes: no colapsar una en la otra en ningún punto.
  descansos?: DescansoConfig[];
  timestamp: string;
}

/** Inicio normal de cada jornada. */
export const INICIO_NORMAL = { manana: '06:00', tarde: '12:15' } as const;
export const FIN_NORMAL = { manana: '12:00', tarde: '18:15' } as const;

/** Convierte "HH:MM" a minutos desde medianoche. */
function aMinutos(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

/** Convierte minutos desde medianoche a "HH:MM". */
function aHhmm(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * Patrón institucional de descansos según cuántos bloques se dicten:
 *   n <= 2  → sin descanso
 *   n 3-4   → un descanso de 20 min tras el 2.º bloque
 *   n 5-6   → descanso de 20 min tras el 2.º y de 10 min tras el 4.º
 *
 * Es la fuente única de este patrón: `recalcularBloquesAcortados` lo usa
 * como default cuando no se pasan descansos explícitos, y la interfaz lo usa
 * para precargar el selector de descansos.
 */
export function descansosInstitucionales(numBloques: number): DescansoConfig[] {
  const n = Math.min(6, Math.max(1, Math.round(numBloques)));
  const resultado: DescansoConfig[] = [];
  if (n >= 3) resultado.push({ despuesDe: 2, duracion: 20 });
  if (n >= 5) resultado.push({ despuesDe: 4, duracion: 10 });
  return resultado;
}

/**
 * Recalcula los bloques de una jornada acortada repartiendo el tiempo
 * disponible entre las clases y los descansos.
 *
 * Acepta tanto la hora de inicio como la de fin. Si no se pasa inicio,
 * usa el inicio normal de la jornada (06:00 mañana / 12:15 tarde).
 *
 * Si no se pasa `descansos`, usa el patrón institucional — esto es
 * obligatorio para que las jornadas ya guardadas en producción (sin el
 * campo `descansos`) sigan calculándose exactamente igual que antes.
 */
export function recalcularBloquesAcortados(
  jornada: 'manana' | 'tarde',
  horaFin: string,
  horaInicio?: string,
  numBloques: number = 6,
  descansos?: DescansoConfig[],
): BloqueRecalculado[] | { error: string } {
  const inicioBase = horaInicio && horaInicio.trim() ? horaInicio : INICIO_NORMAL[jornada];
  const inicioMin = aMinutos(inicioBase);
  const finMin = aMinutos(horaFin);
  const totalMin = finMin - inicioMin;
  if (totalMin <= 0) {
    return { error: 'La hora de fin debe ser posterior a la hora de inicio.' };
  }
  const n = Math.min(6, Math.max(1, Math.round(numBloques)));

  // Descansos: patrón institucional si no se pasan explícitos. Se descartan
  // (sin fallar) los que caigan fuera del rango de bloques de esta jornada.
  const descansosFuente = descansos ?? descansosInstitucionales(n);
  const descansosValidos = descansosFuente.filter(d => d.despuesDe >= 1 && d.despuesDe < n);
  const descansoPorBloque = new Map<number, number>();
  descansosValidos.forEach(d => {
    descansoPorBloque.set(d.despuesDe, (descansoPorBloque.get(d.despuesDe) ?? 0) + d.duracion);
  });
  const totalDescansos = descansosValidos.reduce((acc, d) => acc + d.duracion, 0);

  const minutosClases = totalMin - totalDescansos;
  const minMinutos = Math.max(60, n * 10);
  if (minutosClases < minMinutos) {
    return { error: `La jornada es demasiado corta para ${n} clase${n === 1 ? '' : 's'} con los descansos configurados.` };
  }
  // Las duraciones deben ser múltiplos de 5 (el timbre del colegio no admite
  // otra cosa). Se redondea el tiempo disponible hacia abajo al múltiplo de 5
  // más cercano y se reparte en "unidades de 5 minutos" entre los bloques,
  // dando el escalón extra a los primeros -- así una jornada de 6 bloques con
  // 260 min de clase da 4 bloques de 45 y 2 de 40, no una mezcla arbitraria.
  const minutosClases5 = Math.floor(minutosClases / 5) * 5;
  const unidades = minutosClases5 / 5;
  const unidadesBase = Math.floor(unidades / n);
  const unidadesSobrantes = unidades % n;
  if (unidadesBase < 1) {
    return { error: `La jornada es demasiado corta para ${n} clase${n === 1 ? '' : 's'} con los descansos configurados.` };
  }

  const bloques: BloqueRecalculado[] = [];
  let cursor = inicioMin;
  for (let i = 1; i <= n; i++) {
    const dur = (unidadesBase + (i <= unidadesSobrantes ? 1 : 0)) * 5;
    const inicio = cursor;
    const fin = cursor + dur;
    const descansoDespues = descansoPorBloque.get(i);
    bloques.push({
      id: i,
      inicio: aHhmm(inicio),
      fin: aHhmm(fin),
      ...(descansoDespues ? { descansoDespues } : {}),
    });
    cursor = fin;
    if (descansoDespues) cursor += descansoDespues;
  }
  return bloques;
}

export function generarIdJornadaReducida(): string {
  return `jr_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

/** Lista las jornadas reducidas vigentes hoy o en el futuro próximo. */
export function jornadasReducidasProximas(
  jornadas: JornadaReducida[],
  diasAdelante: number = 14,
): JornadaReducida[] {
  const hoy = fechaHoyLocal();
  const limite = new Date(hoy + 'T12:00:00');
  limite.setDate(limite.getDate() + diasAdelante);
  const limiteStr = `${limite.getFullYear()}-${String(limite.getMonth() + 1).padStart(2, '0')}-${String(limite.getDate()).padStart(2, '0')}`;
  return jornadas
    .filter(j => j.fecha >= hoy && j.fecha <= limiteStr)
    .sort((a, b) => a.fecha.localeCompare(b.fecha));
}

// ── Horario efectivo (aplicar modificaciones a un día) ───────────────────────

export interface EntradaEfectiva {
  jornada: string;
  dia: string;
  bloque: number;
  docente: string;
  grado: string;
  aula: string;
  esModificada: boolean;
  esTaller: boolean;
  bloqueOriginal?: number;     // si fue movida, dónde estaba antes
  supervisorId?: string;       // si es taller
}

/**
 * Encuentra el HorarioModificado 'guardado' vigente para una fecha+jornada.
 *
 * CORREGIDO: si el coordinador reabre y vuelve a guardar el mismo día varias
 * veces (cada guardado puede crear un id nuevo en vez de reemplazar uno
 * existente), pueden acumularse varios registros para la misma fecha+jornada
 * en el backend. Antes se tomaba el primero que apareciera en el array
 * (`.find`), que resultaba ser el más VIEJO por el orden de llegada del
 * backend — así que un guardado de prueba temprano seguía "ganando" sobre
 * el guardado real y correcto de después. Ahora se toma el más reciente por
 * `timestamp`. Reportado por Julián el 9 de agosto de 2026: "Mi día" seguía
 * vacío para un docente pese a que el guardado correcto sí llegó al servidor.
 */
function horarioModificadoVigente(
  fecha: string,
  jornada: 'manana' | 'tarde',
  horariosModificados: HorarioModificado[],
): HorarioModificado | undefined {
  const candidatos = horariosModificados.filter(h =>
    h.fecha === fecha && h.jornada === jornada && h.estado === 'guardado'
  );
  if (candidatos.length === 0) return undefined;
  return candidatos.reduce((mas, actual) =>
    actual.timestamp > mas.timestamp ? actual : mas
  );
}

/**
 * Cruza horarioBase con las modificaciones guardadas para una fecha+jornada
 * específicas y devuelve las entradas efectivas del día (clases que sí ocurren),
 * marcando cuáles fueron movidas, cancelaciones y talleres.
 */
export function aplicarModificacionesAlDia(
  fecha: string,
  jornada: 'manana' | 'tarde',
  horarioBase: EntradaHorarioBase[],
  horariosModificados: HorarioModificado[],
): EntradaEfectiva[] {
  const dia = diaDeSemana(fecha);
  const hm = horarioModificadoVigente(fecha, jornada, horariosModificados);

  const entradasBase = horarioBase
    .filter(e => e.jornada === jornada && e.dia === dia)
    .map(e => ({
      ...e,
      grado: e.grado.includes('/') ? e.grado.split('/')[0] : e.grado,
    }));

  if (!hm) {
    return entradasBase.map(e => ({
      jornada: e.jornada,
      dia: e.dia,
      bloque: e.bloque,
      docente: e.docente,
      grado: e.grado,
      aula: e.aula,
      esModificada: false,
      esTaller: false,
    }));
  }

  // Mapa por (docente_grupo_bloqueOriginal) → modificación
  const modPorEntrada = new Map<string, ModificacionBloque>();
  hm.modificaciones.forEach(mod => {
    const key = `${mod.docenteOriginal}_${mod.grupo}_${mod.bloqueOriginal}`;
    modPorEntrada.set(key, mod);
  });

  const resultado: EntradaEfectiva[] = [];

  for (const e of entradasBase) {
    const key = `${e.docente}_${e.grado}_${e.bloque}`;
    const mod = modPorEntrada.get(key);
    if (!mod) {
      // Sin modificación → entrada base tal cual
      resultado.push({
        jornada: e.jornada,
        dia: e.dia,
        bloque: e.bloque,
        docente: e.docente,
        grado: e.grado,
        aula: e.aula,
        esModificada: false,
        esTaller: false,
      });
      continue;
    }
    if (mod.bloqueNuevo === null) continue; // eliminada
    // Movida o convertida en taller
    resultado.push({
      jornada: e.jornada,
      dia: e.dia,
      bloque: mod.bloqueNuevo,
      docente: e.docente,
      grado: e.grado,
      aula: e.aula,
      esModificada: mod.bloqueNuevo !== e.bloque,
      esTaller: mod.esTaller ?? false,
      bloqueOriginal: mod.bloqueNuevo !== e.bloque ? e.bloque : undefined,
      supervisorId: mod.supervisorId,
    });
  }

  reasignarAulasDelDia(resultado, dia, jornada, horarioBase);

  return resultado.sort((a, b) => a.bloque - b.bloque);
}

/**
 * Corrige el aula de las entradas movidas de bloque (esModificada === true):
 * el aula que traían es la del bloque ORIGINAL, no la del bloque nuevo. Regla:
 * 1) preferir el aula que ese mismo docente usa normalmente en ese bloque/día
 *    (buscada en horarioBase, cualquier grupo);
 * 2) si esa aula ya está ocupada en el bloque nuevo, usar cualquier aula libre
 *    conocida de esa jornada;
 * 3) si no hay ninguna libre, conservar el aula original (comportamiento previo).
 * Las entradas sin modificar no se tocan.
 */
function reasignarAulasDelDia(
  resultado: EntradaEfectiva[],
  dia: string,
  jornada: 'manana' | 'tarde',
  horarioBase: EntradaHorarioBase[],
): void {
  const aulasJornada = Array.from(new Set(
    horarioBase.filter(e => e.jornada === jornada).map(e => e.aula)
  )).filter(a => a && a !== 'Patio');

  const porBloque = new Map<number, EntradaEfectiva[]>();
  resultado.forEach(e => {
    (porBloque.get(e.bloque) ?? porBloque.set(e.bloque, []).get(e.bloque)!).push(e);
  });

  porBloque.forEach((entradasBloque, bloque) => {
    const ocupadas = new Set(
      entradasBloque.filter(e => !e.esModificada).map(e => e.aula)
    );

    const movidas = entradasBloque
      .filter(e => e.esModificada)
      .sort((a, b) => a.docente.localeCompare(b.docente));

    for (const entrada of movidas) {
      const preferida = horarioBase.find(e =>
        e.jornada === jornada && e.dia === dia && e.bloque === bloque && e.docente === entrada.docente
      )?.aula;

      let aulaElegida: string | undefined;
      if (preferida && !ocupadas.has(preferida)) {
        aulaElegida = preferida;
      } else {
        aulaElegida = aulasJornada.find(a => !ocupadas.has(a));
      }

      if (aulaElegida) {
        entrada.aula = aulaElegida;
        ocupadas.add(aulaElegida);
      }
      // Si no hay ninguna disponible, se conserva el aula original ya asignada.
    }
  });
}

/** Lista las modificaciones guardadas vigentes hoy o en el futuro próximo. */
export function modificacionesProximas(
  horariosModificados: HorarioModificado[],
  diasAdelante: number = 14,
): HorarioModificado[] {
  const hoy = fechaHoyLocal();
  const limite = new Date(hoy + 'T12:00:00');
  limite.setDate(limite.getDate() + diasAdelante);
  const limiteStr = `${limite.getFullYear()}-${String(limite.getMonth() + 1).padStart(2, '0')}-${String(limite.getDate()).padStart(2, '0')}`;
  return horariosModificados
    .filter(h => h.estado === 'guardado' && h.fecha >= hoy && h.fecha <= limiteStr)
    .sort((a, b) => a.fecha.localeCompare(b.fecha));
}

// ── Editor: fichas y conversión ───────────────────────────────────────────────

export type UbicacionFicha =
  | { tipo: 'colocada'; bloque: number }
  | { tipo: 'pendiente' }
  | { tipo: 'eliminada' }
  | { tipo: 'taller'; bloque: number; supervisorId?: string };

export interface FichaEditor {
  id: string;                  // único: `${docente}_${grupo}_${bloqueOriginal}`
  origen: {
    dia: string;
    bloque: number;
    docente: string;
    grupo: string;
    aula: string;
  };
  ubicacion: UbicacionFicha;
}

export interface EntradaHorarioBase {
  jornada: string;
  dia: string;
  bloque: number;
  docente: string;
  grado: string;
  aula: string;
}

/**
 * Genera las fichas iniciales para el día del borrador.
 * Las clases del docente ausente arrancan en estado 'colocada' (visualmente apagadas)
 * y pueden eliminarse o desplazarse; el resto arranca colocada en su bloque original.
 */
export function crearFichasIniciales(
  borrador: HorarioModificado,
  horarioBase: EntradaHorarioBase[]
): FichaEditor[] {
  const dia = diaDeSemana(borrador.fecha);
  const entradasDelDia = horarioBase.filter(e => e.jornada === borrador.jornada && e.dia === dia);

  return entradasDelDia.map(e => {
    const grado = e.grado.includes('/') ? e.grado.split('/')[0] : e.grado;
    return {
      id: `${e.docente}_${grado}_${e.bloque}`,
      origen: {
        dia,
        bloque: e.bloque,
        docente: e.docente,
        grupo: grado,
        aula: e.aula,
      },
      ubicacion: { tipo: 'colocada' as const, bloque: e.bloque },
    };
  });
}

/**
 * Devuelve true si la ficha está actualmente posicionada en un bloque
 * que coincide con una ausencia declarada para su docente.
 */
export function esFichaAusenteAhora(
  ficha: FichaEditor,
  ausencias: AusenciaDocente[]
): boolean {
  if (ficha.ubicacion.tipo !== 'colocada') return false;
  const aus = ausencias.find(a => a.docenteId === ficha.origen.docente);
  if (!aus) return false;
  return aus.bloques.includes(ficha.ubicacion.bloque);
}

/**
 * Devuelve true si la ficha ES la clase de un docente ausente en su bloque
 * ORIGINAL, sin importar dónde esté ubicada ahora.
 *
 * Distinta de `esFichaAusenteAhora` a propósito: esa solo reconoce la ficha
 * mientras sigue 'colocada'. En cuanto el coordinador arrastra otra cosa a su
 * sitio y la ficha cae a "pendientes", `esFichaAusenteAhora` deja de verla —
 * y el conteo que bloquea el guardado la trataba como un conflicto real sin
 * resolver, cuando en realidad es una clase que se pierde porque el profesor
 * no viene, no algo que haya que reubicar. Reportado por Janneth el 6 de
 * agosto de 2026: "el sistema no debería restringir el guardado por esas
 * clases [del ausente]... esa restricción sí debe permanecer con las clases
 * que se movieron para organizar y se deben volver a reorganizar".
 */
export function esFichaDeAusente(
  ficha: FichaEditor,
  ausencias: AusenciaDocente[]
): boolean {
  const aus = ausencias.find(a => a.docenteId === ficha.origen.docente);
  if (!aus) return false;
  return aus.bloques.includes(ficha.origen.bloque);
}

/**
 * Lista de docentes libres en un (dia, bloque) específico:
 *   - no tienen clase en horarioBase a esa hora
 *   - no están en ausencias declaradas para ese bloque
 */
export function docentesLibresEn(
  dia: string,
  bloque: number,
  jornada: 'manana' | 'tarde',
  horarioBase: EntradaHorarioBase[],
  candidatos: { id: string; nombreCorto: string; color?: string }[],
  ausencias: AusenciaDocente[]
): { id: string; nombreCorto: string; color?: string }[] {
  const ocupados = new Set(
    horarioBase
      .filter(e => e.dia === dia && e.bloque === bloque && e.jornada === jornada)
      .map(e => e.docente)
  );
  // presenteEnColegio undefined ⇒ true (comportamiento histórico: disponible fuera
  // de los bloques declarados ausentes). Solo presenteEnColegio === false excluye
  // al docente del día completo (no está en la sede, no puede supervisar nada).
  const excluidosTodoElDia = new Set(
    ausencias.filter(a => a.presenteEnColegio === false).map(a => a.docenteId)
  );
  const ausentesEnBloque = new Set(
    ausencias
      .filter(a => a.presenteEnColegio !== false && a.bloques.includes(bloque))
      .map(a => a.docenteId)
  );
  return candidatos.filter(d =>
    !ocupados.has(d.id) && !excluidosTodoElDia.has(d.id) && !ausentesEnBloque.has(d.id)
  );
}

/**
 * Convierte las fichas del editor en modificaciones para persistir.
 * Solo se guardan las fichas cuyo estado cambió respecto al origen.
 */
// ── Asistente de alternativas automáticas ────────────────────────────────────

export type TipoPropuesta =
  | 'compactar'           // mover clases del ausente a sus horas libres
  | 'apoyo_taller'        // cubrir el bloque con un apoyo declarado
  | 'entrada_tardia'      // cancelar los primeros bloques afectados
  | 'salida_temprana'     // cancelar los últimos bloques afectados
  | 'mixta_jornada';      // entrada tardía + salida temprana combinadas

export type NivelPropuesta = 1 | 2 | 3;

export interface PropuestaAsistente {
  id: string;
  tipo: TipoPropuesta;
  nivel: NivelPropuesta;
  prioridad: number;       // dentro del nivel, menor = más prioritario
  grupo: string;
  titulo: string;
  descripcion: string;
  // Bloques del grupo que quedan cancelados si se aplica esta propuesta.
  // 0 en compactación pura y en apoyos; > 0 en entrada tardía / salida temprana.
  clasesPerdidas: number;
  // Cambios a aplicar como mapa fichaId → nueva ubicación
  cambios: Array<{ fichaId: string; nuevaUbicacion: UbicacionFicha }>;
}

/**
 * Genera propuestas automáticas para resolver las ausencias del borrador,
 * agrupadas en 3 niveles de prioridad:
 *
 *   Nivel 1 — Reorganizar el día (mínima pérdida de clases)
 *             ▸ compactar: mover clases del ausente a sus horas libres
 *
 *   Nivel 2 — Aprovechar apoyos disponibles (PTA, UAI, docente de apoyo,
 *             taller) registrados en el wizard
 *
 *   Nivel 3 — Modificar entrada o salida del grupo
 *             ▸ mañana → prioriza entrada tardía
 *             ▸ tarde  → prioriza salida temprana
 *
 * Las propuestas NO son excluyentes ni se filtran entre sí: el coordinador
 * decide cuál aplicar.
 */
export function generarPropuestasAsistente(
  fichas: FichaEditor[],
  borrador: HorarioModificado
): PropuestaAsistente[] {
  const propuestas: PropuestaAsistente[] = [];
  const esManana = borrador.jornada === 'manana';
  const bloquesAusentesPorDoc: Record<string, Set<number>> = {};
  borrador.ausencias.forEach(a => {
    bloquesAusentesPorDoc[a.docenteId] = new Set(a.bloques);
  });

  // Agrupar fichas afectadas por grupo
  const fichasPorGrupo: Record<string, FichaEditor[]> = {};
  fichas.forEach(f => {
    if (f.ubicacion.tipo !== 'colocada') return;
    if (!bloquesAusentesPorDoc[f.origen.docente]?.has(f.origen.bloque)) return;
    (fichasPorGrupo[f.origen.grupo] ??= []).push(f);
  });

  // Todas las fichas del grupo colocadas (para detectar contigüidad real)
  const todasPorGrupo: Record<string, FichaEditor[]> = {};
  fichas.forEach(f => {
    if (f.ubicacion.tipo !== 'colocada' && f.ubicacion.tipo !== 'taller') return;
    (todasPorGrupo[f.origen.grupo] ??= []).push(f);
  });

  Object.entries(fichasPorGrupo).forEach(([grupo, fichasAusentes]) => {
    const bloquesAusentes = fichasAusentes
      .map(f => f.ubicacion.tipo === 'colocada' ? f.ubicacion.bloque : 0)
      .filter(b => b > 0)
      .sort((a, b) => a - b);
    if (bloquesAusentes.length === 0) return;

    const bloquesGrupo = (todasPorGrupo[grupo] ?? [])
      .map(f => f.ubicacion.tipo === 'colocada' || f.ubicacion.tipo === 'taller' ? f.ubicacion.bloque : 0)
      .filter(b => b > 0);
    const minGrupo = Math.min(...bloquesGrupo);
    const maxGrupo = Math.max(...bloquesGrupo);

    // ── NIVEL 1: REORGANIZAR CON CASCADAS DE INTERCAMBIO ──────────────────
    // Busca una cadena de movimientos entre los docentes del grupo afectado
    // tal que cada uno termine en una hora donde está disponible y el grupo
    // no pierda ninguna clase. Si la encuentra, propone aplicarla en bloque.
    const cascadas = buscarCompactacionCascadaMultiple(fichas, borrador, grupo, 3);
    cascadas.forEach((cascada, idx) => {
      // Texto descriptivo: agrupar movimientos por docente. Si un movimiento
      // es de un grupo secundario (el salto para liberar al que cubre), se
      // marca explícitamente — el coordinador debe saber que esto también
      // toca a otro grupo, no solo al ausente.
      const porDocente = new Map<string, Array<{ desde: number; hasta: number; grupo: string }>>();
      const gruposSecundarios = new Set<string>();
      cascada.forEach(m => {
        const ficha = fichas.find(f => f.id === m.fichaId)!;
        if (ficha.origen.grupo !== grupo) gruposSecundarios.add(ficha.origen.grupo);
        const arr = porDocente.get(ficha.origen.docente) ?? [];
        arr.push({ desde: m.desdeBloque, hasta: m.hastaBloque, grupo: ficha.origen.grupo });
        porDocente.set(ficha.origen.docente, arr);
      });
      const lineas = Array.from(porDocente.entries()).map(([docId, movs]) => {
        const nombre = USUARIO_NOMBRE_FN ? USUARIO_NOMBRE_FN(docId) : docId;
        const detalle = movs
          .sort((a, b) => a.desde - b.desde)
          .map(m => `${m.desde}.ª → ${m.hasta}.ª${m.grupo !== grupo ? ` (${m.grupo})` : ''}`)
          .join(', ');
        return `${nombre}: ${detalle}`;
      });
      const sufijoOpcion = cascadas.length > 1 ? ` — opción ${idx + 1}` : '';
      const avisoSecundarios = gruposSecundarios.size > 0
        ? ` También reorganiza a ${Array.from(gruposSecundarios).join(', ')} para liberar al docente que cubre.`
        : '';
      propuestas.push({
        id: `cascada_${grupo}_${idx}`,
        tipo: 'compactar',
        nivel: 1,
        prioridad: idx,
        grupo,
        titulo: `Reorganizar el día de ${grupo} (${cascada.length} ${cascada.length === 1 ? 'movimiento' : 'movimientos'})${sufijoOpcion}`,
        descripcion: `El grupo no pierde ninguna clase. Cadena de intercambios: ${lineas.join(' · ')}.${avisoSecundarios}`,
        clasesPerdidas: 0,
        cambios: cascada.map(m => ({
          fichaId: m.fichaId,
          nuevaUbicacion: { tipo: 'colocada' as const, bloque: m.hastaBloque },
        })),
      });
    });

    // ── NIVEL 2: USAR APOYOS DISPONIBLES ──────────────────────────────────
    // Para cada apoyo declarado en el borrador, ver qué bloques ausentes
    // cubre y proponer marcarlos como taller con ese apoyo como supervisor.
    borrador.apoyos.forEach(apoyo => {
      const bloquesCubiertos = bloquesAusentes.filter(b => apoyo.bloques.includes(b));
      if (bloquesCubiertos.length === 0) return;
      const fichasCubiertas = fichasAusentes.filter(f =>
        bloquesCubiertos.includes(f.origen.bloque)
      );
      propuestas.push({
        id: `apoyo_${apoyo.id}_${grupo}`,
        tipo: 'apoyo_taller',
        nivel: 2,
        prioridad: 0,
        grupo,
        titulo: `Cubrir con ${apoyo.nombre} (${apoyo.tipo === 'taller' ? 'taller' : TIPO_APOYO_LABEL[apoyo.tipo]})`,
        descripcion: bloquesCubiertos.length === bloquesAusentes.length
          ? `${grupo}: las clases de ${bloquesCubiertos.map(b => `${b}.ª`).join(', ')} quedan con ${apoyo.nombre}. El grupo cumple jornada completa.`
          : `${grupo}: ${apoyo.nombre} cubre ${bloquesCubiertos.map(b => `${b}.ª`).join(', ')}. Quedan ${bloquesAusentes.length - bloquesCubiertos.length} bloque(s) por resolver.`,
        clasesPerdidas: 0,
        cambios: fichasCubiertas.map(f => ({
          fichaId: f.id,
          nuevaUbicacion: {
            tipo: 'taller' as const,
            bloque: f.origen.bloque,
            // apoyo.id no corresponde a un usuario; lo guardamos como referencia
            // textual via descripción. supervisorId queda undefined a propósito.
          },
        })),
      });
    });

    // ── NIVEL 3: AJUSTES DE JORNADA (entrada tardía / salida temprana / mixta) ──
    // En mañana se prioriza entrada tardía; en tarde, salida temprana.
    // Ofrece TODAS las variantes viables: pura(s) y, si aplica, la combinación
    // mixta que preserva un tramo intermedio limpio entre dos rachas de ausencia.
    const fichasGrupoTodas = todasPorGrupo[grupo] ?? [];
    const alternativasJornada = generarAlternativasJornada(
      fichas, borrador, grupo, fichasGrupoTodas, fichasAusentes,
      bloquesAusentes, minGrupo, maxGrupo, esManana,
    );
    propuestas.push(...alternativasJornada);
  });

  // Ordenar por nivel y luego prioridad
  return propuestas.sort((a, b) => a.nivel - b.nivel || a.prioridad - b.prioridad);
}

/**
 * Genera las variantes de ajuste de jornada (entrada tardía / salida temprana /
 * mixta) para un grupo con bloques ausentes. Intenta reducir la pérdida real
 * reubicando las clases "colaterales" (no causadas por la ausencia) que caen
 * dentro del tramo que se cancela, hacia huecos libres del tramo que se
 * conserva. Devuelve hasta 6 alternativas, ordenadas por menor pérdida y
 * menor número de movimientos.
 */
function generarAlternativasJornada(
  fichas: FichaEditor[],
  borrador: HorarioModificado,
  grupo: string,
  fichasGrupoTodas: FichaEditor[],
  fichasAusentes: FichaEditor[],
  bloquesAusentes: number[],
  minGrupo: number,
  maxGrupo: number,
  esManana: boolean,
): PropuestaAsistente[] {
  if (bloquesAusentes.length === 0) return [];

  const minAusente = bloquesAusentes[0];
  const maxAusente = bloquesAusentes[bloquesAusentes.length - 1];

  const bloquesAusentesPorDoc: Record<string, Set<number>> = {};
  borrador.ausencias.forEach(a => {
    bloquesAusentesPorDoc[a.docenteId] = new Set(a.bloques);
  });
  const esAusenteEnBloque = (docId: string, bloque: number) =>
    bloquesAusentesPorDoc[docId]?.has(bloque) ?? false;

  // Ocupación fija de otros grupos (para no chocar al reubicar colaterales)
  const ocupacionFijaPorDoc: Record<string, Set<number>> = {};
  fichas.forEach(f => {
    if (f.origen.grupo === grupo) return;
    if (f.ubicacion.tipo !== 'colocada' && f.ubicacion.tipo !== 'taller') return;
    (ocupacionFijaPorDoc[f.origen.docente] ??= new Set()).add(f.ubicacion.bloque);
  });

  const bloqueDeFicha = (f: FichaEditor): number =>
    f.ubicacion.tipo === 'colocada' || f.ubicacion.tipo === 'taller' ? f.ubicacion.bloque : -1;

  const ocupadosGrupo = new Set(fichasGrupoTodas.map(bloqueDeFicha));

  /**
   * Intenta vaciar el rango [rangoLo, rangoHi] moviendo las fichas colaterales
   * (no causadas por ausencia) hacia `targets` (bloques del rango que se
   * conserva), en orden de preferencia. Las fichas que sí son la causa de la
   * ausencia no se intentan mover (el docente no está).
   */
  function intentarLiberarRango(
    rangoLo: number,
    rangoHi: number,
    targets: number[],
  ): { movidos: Array<{ ficha: FichaEditor; destino: number }>; irreductibles: FichaEditor[] } {
    const movidos: Array<{ ficha: FichaEditor; destino: number }> = [];
    const irreductibles: FichaEditor[] = [];
    const targetsUsados = new Set<number>();

    const fichasEnRango = fichasGrupoTodas.filter(f => {
      const b = bloqueDeFicha(f);
      return b >= rangoLo && b <= rangoHi;
    });

    for (const f of fichasEnRango) {
      const bAct = bloqueDeFicha(f);
      if (esAusenteEnBloque(f.origen.docente, bAct)) continue; // se cancela de todas formas
      const destino = targets.find(t =>
        !targetsUsados.has(t) &&
        !ocupadosGrupo.has(t) &&
        !esAusenteEnBloque(f.origen.docente, t) &&
        !(ocupacionFijaPorDoc[f.origen.docente]?.has(t))
      );
      if (destino !== undefined) {
        movidos.push({ ficha: f, destino });
        targetsUsados.add(destino);
      } else {
        irreductibles.push(f);
      }
    }
    return { movidos, irreductibles };
  }

  const nombreDoc = (id: string) => (USUARIO_NOMBRE_FN ? USUARIO_NOMBRE_FN(id) : id);

  function describirMovidos(movidos: Array<{ ficha: FichaEditor; destino: number }>): string {
    if (movidos.length === 0) return '';
    const detalle = movidos
      .map(m => `mover ${nombreDoc(m.ficha.origen.docente)} de ${bloqueDeFicha(m.ficha)}.ª a ${m.destino}.ª`)
      .join(' + ');
    return detalle;
  }

  function construirCambios(
    canceladas: FichaEditor[],
    movidos: Array<{ ficha: FichaEditor; destino: number }>,
    irreductibles: FichaEditor[],
  ): Array<{ fichaId: string; nuevaUbicacion: UbicacionFicha }> {
    const cambios: Array<{ fichaId: string; nuevaUbicacion: UbicacionFicha }> = [];
    canceladas.forEach(f => cambios.push({ fichaId: f.id, nuevaUbicacion: { tipo: 'eliminada' } }));
    irreductibles.forEach(f => cambios.push({ fichaId: f.id, nuevaUbicacion: { tipo: 'eliminada' } }));
    movidos.forEach(m => cambios.push({
      fichaId: m.ficha.id,
      nuevaUbicacion: { tipo: 'colocada', bloque: m.destino },
    }));
    return cambios;
  }

  const alternativas: PropuestaAsistente[] = [];

  // ── ENTRADA TARDÍA: vaciar [minGrupo, maxAusente], mover colaterales a (maxAusente, maxGrupo] ──
  {
    const targets: number[] = [];
    for (let b = maxAusente + 1; b <= maxGrupo; b++) targets.push(b);
    const { movidos, irreductibles } = intentarLiberarRango(minGrupo, maxAusente, targets);
    const proximoBloque = maxAusente + 1;
    const perdidas = bloquesAusentes.length + irreductibles.length;
    const detalleMov = describirMovidos(movidos);
    alternativas.push({
      id: `entrada_tardia_${grupo}`,
      tipo: 'entrada_tardia',
      nivel: 3,
      prioridad: esManana ? 0 : 1,
      grupo,
      titulo: `${grupo}: entrada a la ${proximoBloque}.ª hora`,
      descripcion: detalleMov
        ? `${grupo} entra a la ${proximoBloque}.ª hora (pierde ${perdidas} clase${perdidas === 1 ? '' : 's'}). Antes se ${detalleMov}.`
        : `${grupo} entra a la ${proximoBloque}.ª hora (pierde ${perdidas} clase${perdidas === 1 ? '' : 's'}).`,
      clasesPerdidas: perdidas,
      cambios: construirCambios(fichasAusentes, movidos, irreductibles),
    });
  }

  // ── SALIDA TEMPRANA: vaciar [minAusente, maxGrupo], mover colaterales a [minGrupo, minAusente) ──
  {
    const targets: number[] = [];
    for (let b = minAusente - 1; b >= minGrupo; b--) targets.push(b);
    const { movidos, irreductibles } = intentarLiberarRango(minAusente, maxGrupo, targets);
    const perdidas = bloquesAusentes.length + irreductibles.length;
    const detalleMov = describirMovidos(movidos);
    alternativas.push({
      id: `salida_temprana_${grupo}`,
      tipo: 'salida_temprana',
      nivel: 3,
      prioridad: esManana ? 1 : 0,
      grupo,
      titulo: `${grupo}: salida a la ${minAusente}.ª hora`,
      descripcion: detalleMov
        ? `${grupo} sale a la ${minAusente}.ª hora (pierde ${perdidas} clase${perdidas === 1 ? '' : 's'}). Antes se ${detalleMov}.`
        : `${grupo} sale a la ${minAusente}.ª hora (pierde ${perdidas} clase${perdidas === 1 ? '' : 's'}).`,
      clasesPerdidas: perdidas,
      cambios: construirCambios(fichasAusentes, movidos, irreductibles),
    });
  }

  // ── MIXTA: si hay ≥2 rachas de ausencia con un tramo intermedio limpio,
  //           recorta ambos extremos y conserva el tramo del medio.
  const rachas: number[][] = [];
  bloquesAusentes.forEach(b => {
    const ultima = rachas[rachas.length - 1];
    if (ultima && b === ultima[ultima.length - 1] + 1) ultima.push(b);
    else rachas.push([b]);
  });
  if (rachas.length >= 2) {
    const racha1 = rachas[0];
    const rachaN = rachas[rachas.length - 1];
    const cut1 = racha1[racha1.length - 1];   // último bloque de la racha inicial
    const cut2 = rachaN[0];                    // primer bloque de la racha final
    if (cut1 < cut2 - 1) {
      const targetsMedio: number[] = [];
      for (let b = cut1 + 1; b <= cut2 - 1; b++) targetsMedio.push(b);
      const liberoInicio = intentarLiberarRango(minGrupo, cut1, targetsMedio);
      const liberoFin = intentarLiberarRango(cut2, maxGrupo, targetsMedio.filter(
        t => !liberoInicio.movidos.some(m => m.destino === t)
      ));
      const canceladasMixta = fichasAusentes; // todas siguen canceladas: el docente no está
      const irreductiblesMixta = [...liberoInicio.irreductibles, ...liberoFin.irreductibles];
      const movidosMixta = [...liberoInicio.movidos, ...liberoFin.movidos];
      const perdidas = bloquesAusentes.length + irreductiblesMixta.length;
      const proximoBloque = cut1 + 1;
      const detalleMov = describirMovidos(movidosMixta);
      alternativas.push({
        id: `mixta_${grupo}`,
        tipo: 'mixta_jornada',
        nivel: 3,
        prioridad: 0.5,
        grupo,
        titulo: `${grupo}: entra a la ${proximoBloque}.ª y sale a la ${cut2}.ª hora`,
        descripcion: detalleMov
          ? `${grupo} entra a la ${proximoBloque}.ª hora y sale a la ${cut2}.ª hora, conservando ${cut2 - cut1 - 1} clase${cut2 - cut1 - 1 === 1 ? '' : 's'} intermedia(s) (pierde ${perdidas} en total). Antes se ${detalleMov}.`
          : `${grupo} entra a la ${proximoBloque}.ª hora y sale a la ${cut2}.ª hora, conservando ${cut2 - cut1 - 1} clase${cut2 - cut1 - 1 === 1 ? '' : 's'} intermedia(s) (pierde ${perdidas} en total).`,
        clasesPerdidas: perdidas,
        cambios: construirCambios(canceladasMixta, movidosMixta, irreductiblesMixta),
      });
    }
  }

  // Cap y orden: menos pérdida primero, luego menos movimientos.
  return alternativas
    .sort((a, b) => a.clasesPerdidas - b.clasesPerdidas || a.cambios.length - b.cambios.length)
    .slice(0, 6);
}

// Inyectable desde el componente para enriquecer descripciones con nombres
let USUARIO_NOMBRE_FN: ((id: string) => string) | null = null;
export function configurarResolverNombreDocente(fn: (id: string) => string) {
  USUARIO_NOMBRE_FN = fn;
}

// ── Generación de resumen para difundir ─────────────────────────────────────

const HORAS_MANANA = ['06:00', '06:55', '08:10', '09:05', '10:10', '11:05'];
const HORAS_TARDE  = ['12:15', '13:10', '14:25', '15:20', '16:25', '17:20'];

export interface DocenteAfectadoResumen {
  id: string;
  nombre: string;
  nombreCorto: string;
  correo: string;
  motivo: string; // 'ausente' | 'clase movida' | 'supervisor de taller' | 'acompañante'
}

export interface ResumenDifusion {
  html: string;
  texto: string;
  docentesAfectados: DocenteAfectadoResumen[];
}

export function generarResumenDifusion(
  borrador: HorarioModificado,
  fichas: FichaEditor[],
  usuarios: Array<{ id: string; nombre: string; nombreCorto: string; correo: string }>,
): ResumenDifusion {
  const fechaLegible = formatearFechaLegible(borrador.fecha);
  const jornadaTxt = borrador.jornada === 'manana' ? 'mañana' : 'tarde';
  const horas = borrador.jornada === 'manana' ? HORAS_MANANA : HORAS_TARDE;

  // Agrupar fichas (visibles tras edición) por grupo
  const fichasPorGrupo: Record<string, FichaEditor[]> = {};
  fichas.forEach(f => {
    if (f.ubicacion.tipo === 'eliminada' || f.ubicacion.tipo === 'pendiente') return;
    (fichasPorGrupo[f.origen.grupo] ??= []).push(f);
  });

  // Detectar grupos afectados (los que tuvieron al menos una modificación).
  //
  // CORREGIDO — antes solo marcaba un grupo si tenía clase con un docente
  // AUSENTE en ese bloque, así que un grupo movido como efecto secundario
  // (p. ej. correr a 11.2 para poder desplazar a Adolfo y así cubrir a
  // Beatriz) quedaba fuera del resumen aunque su horario del día sí cambió.
  // Reportado por Janneth el 6 de agosto de 2026.
  //
  // El criterio correcto es "¿tuvo algún cambio real?", que ya usa
  // ModalDiaModificado.tsx de la misma forma: a partir de las modificaciones
  // efectivamente guardadas (fichasAModificaciones), no de las ausencias.
  const gruposAfectados = new Set<string>();
  fichasAModificaciones(fichas).forEach(m => gruposAfectados.add(m.grupo));
  const gruposOrdenados = Array.from(gruposAfectados).sort(compararGrupos);

  // ── HTML (mobile-first: lo que ve una familia desde el celular) ───────────
  const htmlPartes: string[] = [];
  htmlPartes.push(`<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#1f2937;padding:16px">`);
  htmlPartes.push(`<h2 style="margin:0 0 6px 0;color:#1e3a8a;font-size:20px;font-weight:800;line-height:1.2">I.E. Manuel J. Betancur — Modificación de horario</h2>`);
  htmlPartes.push(`<p style="margin:0 0 12px 0;color:#1f2937;font-size:17px;font-weight:700">${fechaLegible} · Jornada ${jornadaTxt}</p>`);

  if (gruposOrdenados.length > 0) {
    htmlPartes.push(`<p style="margin:0 0 8px 0;font-size:12px;font-weight:600;color:#1e3a8a;text-transform:uppercase;letter-spacing:.03em">Grupos afectados</p>`);
    htmlPartes.push(`<div style="margin:0 0 16px 0;display:flex;flex-wrap:wrap;gap:6px">`);
    gruposOrdenados.forEach(grupo => {
      htmlPartes.push(`<span style="display:inline-block;padding:4px 10px;border-radius:999px;background:#dbeafe;color:#1e3a8a;font-size:13px;font-weight:700">${grupo}</span>`);
    });
    htmlPartes.push(`</div>`);
  }

  const textoPartes: string[] = [];
  textoPartes.push(`*MJB — Modificación de horario*`);
  textoPartes.push(`${fechaLegible} · Jornada ${jornadaTxt}`);
  textoPartes.push('');

  // Por cada grupo afectado, listar el horario resultante
  gruposOrdenados.forEach(grupo => {
    const colocadas = (fichasPorGrupo[grupo] ?? [])
      .filter(f => f.ubicacion.tipo === 'colocada' || f.ubicacion.tipo === 'taller')
      .sort((a, b) => {
        const ba = a.ubicacion.tipo === 'colocada' || a.ubicacion.tipo === 'taller' ? a.ubicacion.bloque : 0;
        const bb = b.ubicacion.tipo === 'colocada' || b.ubicacion.tipo === 'taller' ? b.ubicacion.bloque : 0;
        return ba - bb;
      });
    const eliminadas = fichas
      .filter(f => f.origen.grupo === grupo && f.ubicacion.tipo === 'eliminada')
      .map(f => f.origen.bloque)
      .sort((a, b) => a - b);

    // ── Aviso de ajuste de jornada (entrada tardía / salida temprana) ─────
    // Se deriva de las modificaciones FINALES (cancelaciones aplicadas), no
    // de la propuesta usada, para cubrir también ediciones manuales equivalentes.
    let avisoJornada: string | null = null;
    if (eliminadas.length > 0) {
      const bloquesGrupoOrigen = fichas
        .filter(f => f.origen.grupo === grupo)
        .map(f => f.origen.bloque);
      const minTotal = Math.min(...bloquesGrupoOrigen);
      const maxTotal = Math.max(...bloquesGrupoOrigen);
      const esPrefijo = eliminadas[0] === minTotal &&
        eliminadas.every((b, i) => b === minTotal + i);
      const esSufijo = !esPrefijo && eliminadas[eliminadas.length - 1] === maxTotal &&
        eliminadas.every((b, i) => b === eliminadas[0] + i);
      if (esPrefijo) {
        const proximoBloque = eliminadas[eliminadas.length - 1] + 1;
        const hora = horas[proximoBloque - 1] ?? '';
        avisoJornada = `📣 El grupo ${grupo} entra a la ${proximoBloque}.ª hora (${hora})`;
      } else if (esSufijo) {
        const primerCancelado = eliminadas[0];
        const hora = horas[primerCancelado - 1] ?? '';
        avisoJornada = `📣 El grupo ${grupo} sale a la ${primerCancelado}.ª hora (${hora})`;
      }
    }

    // HTML — layout apilado (1 bloque = 1 fila de texto, sin tabla ancha)
    htmlPartes.push(`<h3 style="margin:18px 0 8px 0;color:#1f2937;font-size:16px;font-weight:700;border-bottom:1px solid #e5e7eb;padding-bottom:4px">${grupo}</h3>`);
    if (avisoJornada) {
      htmlPartes.push(`<p style="margin:0 0 8px 0;padding:6px 10px;background:#fef3c7;border-left:3px solid #d97706;color:#92400e;font-size:13px;font-weight:600">${avisoJornada}</p>`);
    }

    colocadas.forEach(f => {
      const bloque = f.ubicacion.tipo === 'colocada' || f.ubicacion.tipo === 'taller' ? f.ubicacion.bloque : 0;
      const docente = usuarios.find(u => u.id === f.origen.docente)?.nombreCorto ?? f.origen.docente;
      const hora = horas[bloque - 1] ?? '';
      const esTaller = f.ubicacion.tipo === 'taller';
      const supId = f.ubicacion.tipo === 'taller' ? f.ubicacion.supervisorId : undefined;
      const supervisor = supId ? usuarios.find(u => u.id === supId)?.nombreCorto : undefined;
      const docTexto = esTaller
        ? `Taller dejado por ${docente}${supervisor ? ` · supervisa ${supervisor}` : ''}`
        : docente;
      const movida = bloque !== f.origen.bloque;
      const fondo = esTaller ? '#fef3c7' : movida ? '#dbeafe' : '#f9fafb';
      htmlPartes.push(`<div style="margin:0 0 6px 0;padding:8px 10px;border-radius:8px;background:${fondo};display:flex;flex-wrap:wrap;gap:4px 8px;align-items:baseline;font-size:14px">`);
      htmlPartes.push(`<span style="font-weight:700;color:#1f2937">${bloque}.ª (${hora})</span>`);
      htmlPartes.push(`<span style="color:#1f2937">${docTexto} · ${f.origen.aula}</span>`);
      htmlPartes.push(`</div>`);
    });
    if (eliminadas.length > 0) {
      htmlPartes.push(`<p style="margin:6px 0 0 0;color:#b91c1c;font-size:12px"><strong>Bloques sin clase:</strong> ${eliminadas.map(b => `${b}.ª`).join(', ')}</p>`);
    }

    // Texto
    textoPartes.push(`*${grupo}*`);
    if (avisoJornada) {
      textoPartes.push(avisoJornada);
    }
    colocadas.forEach(f => {
      const bloque = f.ubicacion.tipo === 'colocada' || f.ubicacion.tipo === 'taller' ? f.ubicacion.bloque : 0;
      const docente = usuarios.find(u => u.id === f.origen.docente)?.nombreCorto ?? f.origen.docente;
      const hora = horas[bloque - 1] ?? '';
      const esTaller = f.ubicacion.tipo === 'taller';
      const supId = f.ubicacion.tipo === 'taller' ? f.ubicacion.supervisorId : undefined;
      const supervisor = supId ? usuarios.find(u => u.id === supId)?.nombreCorto : undefined;
      const marca = esTaller ? ' 🟡' : (bloque !== f.origen.bloque ? ' 🔵' : '');
      const docTexto = esTaller
        ? `Taller (${docente})${supervisor ? ` con ${supervisor}` : ''}`
        : docente;
      textoPartes.push(`${bloque}.ª ${hora} — ${docTexto} · ${f.origen.aula}${marca}`);
    });
    if (eliminadas.length > 0) {
      textoPartes.push(`❌ Sin clase: ${eliminadas.map(b => `${b}.ª`).join(', ')}`);
    }
    textoPartes.push('');
  });

  // ── Acompañantes ───────────────────────────────────────────────────────────
  // No son reubicaciones: su horario no cambia, pero van con su grupo a una
  // actividad. Se difunden aparte para que quede constancia de dónde está
  // cada grupo, aunque no haya ningún bloque "movido" que listar arriba.
  const acompanantes = borrador.acompanantes ?? [];
  if (acompanantes.length > 0) {
    htmlPartes.push(`<h3 style="margin:18px 0 8px 0;color:#1f2937;font-size:16px;font-weight:700;border-bottom:1px solid #e5e7eb;padding-bottom:4px">Acompañantes</h3>`);
    htmlPartes.push(`<ul style="margin:0;padding-left:18px;font-size:13px;color:#1f2937">`);
    textoPartes.push('*Acompañantes*');
    acompanantes.forEach(ac => {
      const docente = usuarios.find(u => u.id === ac.docenteId)?.nombreCorto ?? ac.docenteId;
      const horasTxt = joinOrdinales(ac.bloques);
      const plural = ac.bloques.length > 1 ? 's' : '';
      const notaTxt = ac.nota ? ` — ${ac.nota}` : '';
      htmlPartes.push(`<li>👥 ${docente} acompaña al grupo ${ac.grupo} en la ${horasTxt} hora${plural}${notaTxt}</li>`);
      textoPartes.push(`👥 ${docente} acompaña al grupo ${ac.grupo} en la ${horasTxt} hora${plural}${notaTxt}`);
    });
    htmlPartes.push(`</ul>`);
    textoPartes.push('');
  }

  const autorNombre = usuarios.find(u => u.id === borrador.autor)?.nombreCorto;
  const publicadoPor = autorNombre ? `Publicado por ${autorNombre}` : 'Generado por MJB Préstamos';
  const fechaPublicacion = new Date().toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' });
  htmlPartes.push(`<p style="margin-top:20px;font-size:11px;color:#94a3b8">${publicadoPor} · ${fechaPublicacion}</p>`);
  htmlPartes.push(`</div>`);
  textoPartes.push('— MJB Préstamos');

  // ── Docentes afectados ─────────────────────────────────────────────────────
  const docentesAfectadosMap = new Map<string, DocenteAfectadoResumen>();

  // (1) los declarados ausentes
  borrador.ausencias.forEach(a => {
    const u = usuarios.find(x => x.id === a.docenteId);
    if (u && !docentesAfectadosMap.has(u.id)) {
      docentesAfectadosMap.set(u.id, {
        id: u.id, nombre: u.nombre, nombreCorto: u.nombreCorto, correo: u.correo,
        motivo: 'ausente',
      });
    }
  });

  // (2) docentes con alguna clase movida (origen distinto de actual)
  fichas.forEach(f => {
    if (f.ubicacion.tipo === 'colocada' && f.ubicacion.bloque !== f.origen.bloque) {
      const u = usuarios.find(x => x.id === f.origen.docente);
      if (u && !docentesAfectadosMap.has(u.id)) {
        docentesAfectadosMap.set(u.id, {
          id: u.id, nombre: u.nombre, nombreCorto: u.nombreCorto, correo: u.correo,
          motivo: 'clase movida',
        });
      }
    }
  });

  // (3) supervisores de taller
  fichas.forEach(f => {
    const supId = f.ubicacion.tipo === 'taller' ? f.ubicacion.supervisorId : undefined;
    if (supId) {
      const u = usuarios.find(x => x.id === supId);
      if (u && !docentesAfectadosMap.has(u.id)) {
        docentesAfectadosMap.set(u.id, {
          id: u.id, nombre: u.nombre, nombreCorto: u.nombreCorto, correo: u.correo,
          motivo: 'supervisor de taller',
        });
      }
    }
  });

  // (4) acompañantes — no tienen bloques alterados, pero deben enterarse igual
  acompanantes.forEach(ac => {
    const u = usuarios.find(x => x.id === ac.docenteId);
    if (u && !docentesAfectadosMap.has(u.id)) {
      docentesAfectadosMap.set(u.id, {
        id: u.id, nombre: u.nombre, nombreCorto: u.nombreCorto, correo: u.correo,
        motivo: 'acompañante',
      });
    }
  });

  return {
    html: htmlPartes.join('\n'),
    texto: textoPartes.join('\n'),
    docentesAfectados: Array.from(docentesAfectadosMap.values()),
  };
}

interface MovCascada {
  fichaId: string;
  desdeBloque: number;
  hastaBloque: number;
}

/**
 * Busca por backtracking una cadena de movimientos entre los docentes
 * del grupo afectado, tal que las clases del docente ausente queden
 * en sus horas libres (no ausentes) y todas las otras clases del grupo
 * se preserven en bloques donde cada respectivo docente esté disponible.
 *
 * Caso típico: A falta en 5.ª-6.ª con grupo G. A tiene libres 1.ª-2.ª.
 * En 1.ª-2.ª, G está con B. B tiene libres 3.ª-4.ª.
 * En 3.ª-4.ª, G está con C. C tiene libres 5.ª-6.ª.
 * Resultado: B pasa a 3-4, C pasa a 5-6, A pasa a 1-2.
 *
 * Devuelve un arreglo vacío si no encuentra ninguna cadena viable. Tiene cap
 * de profundidad para evitar explosión combinatoria.
 *
 * `buscarCompactacionCascadaMultiple` explora el mismo espacio de estados
 * pero sin detenerse en la primera solución encontrada: continúa el
 * backtracking (con memoización por estado, igual que antes) hasta acumular
 * hasta `maxSoluciones` cadenas DISTINTAS (distintas en el conjunto final de
 * fichaId→bloque), o hasta agotar el árbol de búsqueda / el cap de profundidad.
 *
 * CORREGIDO: antes solo consideraba movibles las fichas del grupo afectado
 * por la ausencia; las clases de esos mismos docentes con OTROS grupos se
 * trataban como fijas, así que si liberar al docente que cubre exigía
 * reubicar también una de esas clases, el algoritmo nunca encontraba la
 * cadena. Caso real: para cubrir a Beatriz moviendo a Adolfo, hubo que
 * mover también la clase de Adolfo con 11-2 en ese mismo bloque — un grupo
 * sin relación directa con la ausencia. Reportado por Janneth el 6 de
 * agosto de 2026. Ahora las clases de los docentes del grupo afectado en
 * OTROS grupos también entran al backtracking como movibles (un solo
 * salto — no se persigue la cadena más allá de ese segundo grupo, para
 * acotar la explosión combinatoria).
 */
function buscarCompactacionCascadaMultiple(
  fichas: FichaEditor[],
  borrador: HorarioModificado,
  grupo: string,
  maxSoluciones: number = 3,
): MovCascada[][] {
  const bloquesAusentesPorDoc: Record<string, Set<number>> = {};
  borrador.ausencias.forEach(a => {
    bloquesAusentesPorDoc[a.docenteId] = new Set(a.bloques);
  });

  // Fichas del grupo afectado cuyas ubicaciones pueden cambiar
  const fichasGrupoPrincipal = fichas.filter(f =>
    f.origen.grupo === grupo &&
    (f.ubicacion.tipo === 'colocada' || f.ubicacion.tipo === 'taller')
  );
  if (fichasGrupoPrincipal.length === 0) return [];

  // Salto único a un grupo secundario: las clases de los docentes del grupo
  // afectado con OTROS grupos también son movibles.
  const docentesGrupo = new Set(fichasGrupoPrincipal.map(f => f.origen.docente));
  const fichasSecundarias = fichas.filter(f =>
    f.origen.grupo !== grupo &&
    docentesGrupo.has(f.origen.docente) &&
    (f.ubicacion.tipo === 'colocada' || f.ubicacion.tipo === 'taller')
  );
  const fichasGrupo = [...fichasGrupoPrincipal, ...fichasSecundarias];

  // Ubicación inicial de cada ficha movible
  const ubicacionInicial: Record<string, number> = {};
  fichasGrupo.forEach(f => {
    ubicacionInicial[f.id] = f.ubicacion.tipo === 'colocada' || f.ubicacion.tipo === 'taller'
      ? f.ubicacion.bloque : 0;
  });

  // Fichas iniciales por mover: aquellas del grupo afectado en bloques
  // ausentes de su docente (el salto a un grupo secundario nunca arranca la
  // búsqueda por sí solo, solo participa como consecuencia de una cadena).
  const iniciales = fichasGrupoPrincipal.filter(f => {
    const b = ubicacionInicial[f.id];
    return bloquesAusentesPorDoc[f.origen.docente]?.has(b);
  });
  if (iniciales.length === 0) return [];

  // Fichas "fijas" (fuera del grupo principal y del secundario de un salto):
  // mapa docente → set de bloques ocupados
  const idsMovibles = new Set(fichasGrupo.map(f => f.id));
  const ocupacionFijaPorDoc: Record<string, Set<number>> = {};
  fichas.forEach(f => {
    if (idsMovibles.has(f.id)) return;
    if (f.ubicacion.tipo !== 'colocada' && f.ubicacion.tipo !== 'taller') return;
    const b = f.ubicacion.bloque;
    (ocupacionFijaPorDoc[f.origen.docente] ??= new Set()).add(b);
  });

  function huecosDocente(docenteId: string, ubicaciones: Record<string, number>): number[] {
    const ocupados = new Set<number>(ocupacionFijaPorDoc[docenteId] ?? []);
    // Solo se pre-excluyen las OTRAS clases del docente en el grupo
    // PRINCIPAL (comportamiento original). Sus clases en el grupo
    // secundario (el salto) NO se excluyen aquí: quedan como huecos
    // "condicionales" que, si se eligen, arrastran esa ficha a porMover vía
    // el chequeo de ocupante de abajo — así el backtracking puede decidir
    // moverla en vez de descartar el bloque de entrada.
    fichasGrupo.forEach(f => {
      if (f.origen.docente !== docenteId || f.origen.grupo !== grupo) return;
      const b = ubicaciones[f.id];
      if (b > 0) ocupados.add(b);
    });
    const ausentes = bloquesAusentesPorDoc[docenteId] ?? new Set();
    const huecos: number[] = [];
    for (let b = 1; b <= 6; b++) {
      if (!ocupados.has(b) && !ausentes.has(b)) huecos.push(b);
    }
    return huecos;
  }

  const visitados = new Set<string>();
  function claveEstado(ub: Record<string, number>, restantes: string[]): string {
    return Object.entries(ub).sort().map(([k, v]) => `${k}:${v}`).join('|') + '#' + restantes.sort().join(',');
  }

  const solucionesEncontradas: Record<string, number>[] = [];

  function intentar(
    ubicaciones: Record<string, number>,
    porMover: FichaEditor[],
    depth: number,
  ): void {
    if (solucionesEncontradas.length >= maxSoluciones) return;
    if (depth > 20) return;
    if (porMover.length === 0) {
      solucionesEncontradas.push(ubicaciones);
      return;
    }

    const key = claveEstado(ubicaciones, porMover.map(f => f.id));
    if (visitados.has(key)) return;
    visitados.add(key);

    const f = porMover[0];
    const resto = porMover.slice(1);
    const huecos = huecosDocente(f.origen.docente, ubicaciones);

    for (const h of huecos) {
      if (solucionesEncontradas.length >= maxSoluciones) return;
      // Si el nuevo bloque es el mismo que el actual, no es un movimiento real
      if (ubicaciones[f.id] === h) continue;

      // ¿Hay otra ficha movible ya en h que entre en conflicto con este
      // movimiento? Dos motivos posibles: es del MISMO grupo que f (un
      // grupo no puede tener dos clases a la vez), o es del MISMO docente
      // que f aunque sea de otro grupo (nadie da dos clases a la vez —
      // este es el caso del salto a un grupo secundario: huecosDocente ya
      // no excluye ese bloque de antemano, así que aquí es donde se
      // detecta y se arrastra esa ficha a la cadena de movimientos).
      const ocupante = fichasGrupo.find(x =>
        x.id !== f.id && ubicaciones[x.id] === h &&
        (x.origen.grupo === f.origen.grupo || x.origen.docente === f.origen.docente)
      );

      const nuevasUbicaciones = { ...ubicaciones, [f.id]: h };
      const nuevoPorMover = ocupante && !resto.includes(ocupante)
        ? [ocupante, ...resto]
        : resto;

      intentar(nuevasUbicaciones, nuevoPorMover, depth + 1);
    }
  }

  intentar(ubicacionInicial, iniciales, 0);
  if (solucionesEncontradas.length === 0) return [];

  const vistos = new Set<string>();
  const resultados: MovCascada[][] = [];
  for (const solucion of solucionesEncontradas) {
    const movimientos: MovCascada[] = [];
    fichasGrupo.forEach(f => {
      const original = ubicacionInicial[f.id];
      const finalB = solucion[f.id];
      if (finalB !== original) {
        movimientos.push({
          fichaId: f.id,
          desdeBloque: original,
          hastaBloque: finalB,
        });
      }
    });
    if (movimientos.length === 0) continue;
    // Deduplicar cadenas equivalentes (mismo conjunto final fichaId→bloque)
    const clave = movimientos.map(m => `${m.fichaId}:${m.hastaBloque}`).sort().join('|');
    if (vistos.has(clave)) continue;
    vistos.add(clave);
    resultados.push(movimientos);
  }
  return resultados;
}

// ── Vista "Horario de los docentes afectados" ────────────────────────────────

export interface BloqueDocenteDia {
  bloque: number;
  estado: 'normal' | 'movida' | 'cancelada' | 'taller' | 'libre';
  grupo?: string;
  aula?: string;
  bloqueOriginal?: number;
  comoSupervisorDe?: string;
}

export interface DocenteDiaEfectivo {
  docenteId: string;
  bloques: BloqueDocenteDia[];
}

/**
 * Para una modificación guardada, calcula el día efectivo de CADA docente
 * involucrado (ausente, con clase movida/cancelada, o supervisando un taller
 * de otro docente), a partir de aplicarModificacionesAlDia. No incluye
 * docentes sin ningún cambio ese día.
 */
export function docentesAfectadosConDia(
  fecha: string,
  jornada: 'manana' | 'tarde',
  horarioBase: EntradaHorarioBase[],
  horariosModificados: HorarioModificado[],
): DocenteDiaEfectivo[] {
  const dia = diaDeSemana(fecha);
  const hm = horarioModificadoVigente(fecha, jornada, horariosModificados);
  if (!hm) return [];

  const entradas = aplicarModificacionesAlDia(fecha, jornada, horarioBase, horariosModificados);

  // Set de docentes relevantes
  const docentesRelevantes = new Set<string>();
  hm.ausencias.forEach(a => docentesRelevantes.add(a.docenteId));
  hm.modificaciones.forEach(m => {
    docentesRelevantes.add(m.docenteOriginal);
    if (m.supervisorId) docentesRelevantes.add(m.supervisorId);
  });

  const entradasBaseDelDia = horarioBase
    .filter(e => e.jornada === jornada && e.dia === dia)
    .map(e => ({ ...e, grado: e.grado.includes('/') ? e.grado.split('/')[0] : e.grado }));

  const ausenciasPorDoc: Record<string, Set<number>> = {};
  hm.ausencias.forEach(a => { ausenciasPorDoc[a.docenteId] = new Set(a.bloques); });

  const resultado: DocenteDiaEfectivo[] = [];

  docentesRelevantes.forEach(docenteId => {
    const bloques: BloqueDocenteDia[] = [];

    for (let b = 1; b <= 6; b++) {
      // 1) ¿Tiene una EntradaEfectiva propia en este bloque?
      const propia = entradas.find(e => e.bloque === b && e.docente === docenteId);
      if (propia) {
        if (propia.esTaller) {
          // El docente original del taller (su clase quedó como taller)
          bloques.push({
            bloque: b,
            estado: 'taller',
            grupo: propia.grado,
            aula: propia.aula,
          });
        } else {
          bloques.push({
            bloque: b,
            estado: propia.esModificada ? 'movida' : 'normal',
            grupo: propia.grado,
            aula: propia.aula,
            bloqueOriginal: propia.esModificada ? propia.bloqueOriginal : undefined,
          });
        }
        continue;
      }

      // 2) ¿Está supervisando el taller de OTRO docente en este bloque?
      const comoSupervisor = entradas.find(e =>
        e.bloque === b && e.esTaller && e.supervisorId === docenteId
      );
      if (comoSupervisor) {
        bloques.push({
          bloque: b,
          estado: 'taller',
          grupo: comoSupervisor.grado,
          aula: comoSupervisor.aula,
          comoSupervisorDe: comoSupervisor.docente,
        });
        continue;
      }

      // 3) ¿Tenía clase base cancelada por ausencia declarada?
      const baseEntrada = entradasBaseDelDia.find(e => e.bloque === b && e.docente === docenteId);
      if (baseEntrada && ausenciasPorDoc[docenteId]?.has(b)) {
        bloques.push({
          bloque: b,
          estado: 'cancelada',
          grupo: baseEntrada.grado,
          aula: baseEntrada.aula,
        });
        continue;
      }

      // 4) Clase base normal sin modificación (no debería llegar aquí si `entradas`
      //    ya la habría cubierto en el paso 1, pero por seguridad la cubrimos)
      if (baseEntrada) {
        bloques.push({
          bloque: b,
          estado: 'normal',
          grupo: baseEntrada.grado,
          aula: baseEntrada.aula,
        });
        continue;
      }

      // 5) Libre
      bloques.push({ bloque: b, estado: 'libre' });
    }

    resultado.push({ docenteId, bloques });
  });

  return resultado;
}

/**
 * Genera el texto del mensaje de notificación personal para un docente,
 * a partir de su día efectivo (docentesAfectadosConDia). Solo menciona los
 * bloques que no son 'normal' ni 'libre'.
 */
export function mensajeNotificacionDocente(
  dia: DocenteDiaEfectivo,
  bloques: Array<{ id: number; inicio: string; fin: string }>,
  fechaLegible: string,
): string {
  const partes: string[] = [];
  dia.bloques.forEach(b => {
    if (b.estado === 'normal' || b.estado === 'libre') return;
    const info = bloques.find(x => x.id === b.bloque);
    const horaTxt = info ? `${info.inicio}–${info.fin}` : '';
    if (b.estado === 'movida') {
      partes.push(`Bloque ${b.bloqueOriginal ?? '?'} (${horaTxt}) se movió al bloque ${b.bloque}.`);
    } else if (b.estado === 'cancelada') {
      partes.push(`Bloque ${b.bloque} (${horaTxt}) fue cancelado.`);
    } else if (b.estado === 'taller') {
      if (b.comoSupervisorDe) {
        const nombre = USUARIO_NOMBRE_FN ? USUARIO_NOMBRE_FN(b.comoSupervisorDe) : b.comoSupervisorDe;
        partes.push(`Bloque ${b.bloque}: cubres un taller de ${nombre} en ${b.grupo ?? ''}.`);
      } else {
        partes.push(`Bloque ${b.bloque}: tu clase quedó como taller.`);
      }
    }
  });
  if (partes.length === 0) {
    return `Tu horario del ${fechaLegible} no tuvo cambios.`;
  }
  return `Tu horario del ${fechaLegible} cambió: ${partes.join(' ')}`;
}

/** Une una lista de ordinales de hora en texto legible: "5.ª", "5.ª y 6.ª", "5.ª, 6.ª y 7.ª". */
function joinOrdinales(bloques: number[]): string {
  const horas = [...bloques].sort((a, b) => a - b).map(horaOrdinal);
  if (horas.length === 1) return horas[0];
  if (horas.length === 2) return `${horas[0]} y ${horas[1]}`;
  return `${horas.slice(0, -1).join(', ')} y ${horas[horas.length - 1]}`;
}

/**
 * Genera el mensaje de notificación para un ACOMPAÑANTE: docente cuyo horario
 * no cambia, pero que va con su grupo a una actividad y por tanto debe
 * enterarse igual que cualquier docente reubicado (ese es el origen de este
 * módulo — ver docs/modulo-dia-escolar.md, situación 1).
 */
export function mensajeNotificacionAcompanante(
  acompanante: Acompanante,
  fechaLegible: string,
): string {
  const horas = joinOrdinales(acompanante.bloques);
  const plural = acompanante.bloques.length > 1 ? 's' : '';
  const base = `El ${fechaLegible} acompañas al grupo ${acompanante.grupo} en la ${horas} hora${plural}. Tu horario no cambia.`;
  return acompanante.nota ? `${base} (${acompanante.nota})` : base;
}

// ── Enlace notificación → "Mi día" (sin tocar el backend) ────────────────────
//
// El backend/Sheets no se puede tocar sin redespliegue manual y no vale la
// pena ampliar el esquema de Notificacion solo para esto. En vez de eso se
// codifica fecha+jornada como un sufijo reconocible dentro del propio
// `mensaje`, que se oculta al mostrar el texto y se recupera con
// `parseHorarioModificadoDeNotificacion`.
const SUFIJO_HORARIO_RE = /\n?\[\[horario:(\d{4}-\d{2}-\d{2}):(manana|tarde)\]\]$/;

export interface HorarioModificadoRef {
  fecha: string;
  jornada: 'manana' | 'tarde';
}

/** Añade el sufijo parseable al mensaje de una notificación `horario_modificado`. */
export function agregarSufijoHorarioModificado(
  mensaje: string,
  fecha: string,
  jornada: 'manana' | 'tarde',
): string {
  return `${mensaje}\n[[horario:${fecha}:${jornada}]]`;
}

/**
 * Extrae fecha+jornada del sufijo (si existe) y devuelve el mensaje sin él.
 * Mensajes sin sufijo (notificaciones antiguas u otros tipos) devuelven
 * `ref: null` y el mensaje intacto.
 */
export function parseHorarioModificadoDeNotificacion(
  mensaje: string,
): { mensajeLimpio: string; ref: HorarioModificadoRef | null } {
  const match = mensaje.match(SUFIJO_HORARIO_RE);
  if (!match) return { mensajeLimpio: mensaje, ref: null };
  return {
    mensajeLimpio: mensaje.slice(0, match.index).trimEnd(),
    ref: { fecha: match[1], jornada: match[2] as 'manana' | 'tarde' },
  };
}

export function fichasAModificaciones(fichas: FichaEditor[]): ModificacionBloque[] {
  const mods: ModificacionBloque[] = [];
  fichas.forEach(f => {
    const original = f.origen.bloque;
    if (f.ubicacion.tipo === 'eliminada') {
      mods.push({
        bloqueOriginal: original,
        bloqueNuevo: null,
        docenteOriginal: f.origen.docente,
        grupo: f.origen.grupo,
        aula: f.origen.aula,
      });
    } else if (f.ubicacion.tipo === 'taller') {
      mods.push({
        bloqueOriginal: original,
        bloqueNuevo: f.ubicacion.bloque,
        docenteOriginal: f.origen.docente,
        grupo: f.origen.grupo,
        aula: f.origen.aula,
        esTaller: true,
        supervisorId: f.ubicacion.supervisorId,
      });
    } else if (f.ubicacion.tipo === 'colocada' && f.ubicacion.bloque !== original) {
      mods.push({
        bloqueOriginal: original,
        bloqueNuevo: f.ubicacion.bloque,
        docenteOriginal: f.origen.docente,
        grupo: f.origen.grupo,
        aula: f.origen.aula,
      });
    }
  });
  return mods;
}

