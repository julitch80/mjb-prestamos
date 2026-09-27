// Reserva automática de espacios a partir de la agenda semanal institucional
// (módulo «Agenda», ver src/components/AgendaSemanal.tsx). Lógica PURA: no
// llama al backend ni a Zustand — recibe los datos y devuelve un plan que el
// componente ejecuta con crearReserva/actualizarReserva (src/data/api.ts).
//
// Decisiones (dadas por Julián, no se re-discuten aquí):
// 1. Choque con algo ya reservado (docente o clase regular) → NO se pisa: se
//    publica igual y se lista el choque para que el humano decida a mano.
// 2. "Durante la jornada" (o cualquier hora no interpretable como rango
//    horario concreto) → reservar los 6 bloques del día. El sistema de
//    reservas ya usa el mismo id de bloque (1..6) para mañana y tarde (ver
//    DisponibilidadGrid: una reserva no distingue jornada, solo bloque), así
//    que "reservar la jornada completa" y "reservar los 6 bloques" son la
//    misma operación sin necesidad de decidir cuál jornada es.
// 3. Lugar no reconocido → no se reserva; se lista para revisión humana.
//    Emparejamiento tolerante a tildes/mayúsculas/abreviaturas.
// 4. Titular = quien publica; motivo "Agenda institucional"; aprobada
//    directamente (como la asignación directa de la rectora); sin notificar.
//
// Idempotencia: cada bloque reservado automáticamente lleva en el campo
// `motivo` de la Reserva una marca `Agenda institucional · agenda:<id>` con
// un id estable de la actividad+bloque (agenda-p<periodo>-s<semana>-<fecha>-
// <índice de actividad en el día>:b<bloque>). Al republicar la misma agenda:
// - si el id ya tiene una reserva activa con esa marca, no se duplica.
// - si una reserva con esa marca (de ESTA agenda) ya no aparece en el plan
//   recalculado (la actividad se quitó o cambió de lugar/bloque), se libera.

import { RECURSOS } from './maestros';
import type { Recurso } from './maestros';
import { BLOQUES_MANANA, BLOQUES_TARDE } from './maestros';
import type { AgendaSemanal, ActividadAgenda } from './agendaSemanal';

// ── Tipos públicos ───────────────────────────────────────────────────────────

export const MARCA_AGENDA = 'Agenda institucional';
const PREFIJO_ID = `${MARCA_AGENDA} · agenda:`;

export interface ReservaExistente {
  id: string;
  recurso: string;
  fecha: string;
  bloque: number;
  motivo?: string;
  estado: 'pendiente' | 'aprobada' | 'rechazada' | 'cancelada';
  solicitante: string;
}

export interface OcupanteClaseRegular {
  recursoId: string;
  fecha: string;
  bloque: number;
  descripcion: string; // ej. "Johana · Grado 9.1"
}

export interface ReservaAAgendarCrear {
  activityKey: string;
  motivo: string; // marca completa a guardar en el campo `motivo`
  recurso: string;
  recursoNombre: string;
  fecha: string;
  bloque: number;
  actividad: string;
}

export interface ReservaAAgendarLiberar {
  reservaId: string;
  recurso: string;
  fecha: string;
  bloque: number;
  motivo: string; // motivo humano para actualizarReserva(..., 'cancelada', motivo)
}

export interface ChoqueAgenda {
  fecha: string;
  dia: string;
  bloque: number;
  recurso: string;
  recursoNombre: string;
  actividad: string;
  ocupante: string; // descripción de quién ya tiene el espacio
}

export interface LugarNoReconocido {
  fecha: string;
  dia: string;
  actividad: string;
  lugar: string;
}

export interface PlanReservasAgenda {
  crear: ReservaAAgendarCrear[];
  liberar: ReservaAAgendarLiberar[];
  choques: ChoqueAgenda[];
  noReconocidos: LugarNoReconocido[];
}

// ── Normalización de texto ───────────────────────────────────────────────────

export function normalizarTexto(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // quita tildes
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

// ── Emparejamiento de lugar → recurso ────────────────────────────────────────

interface AliasRecurso {
  recursoId: string;
  alias: string[]; // ya normalizados
}

function generarAliasAula(n: number): string[] {
  return [`aula ${n}`, `aula${n}`, `a${n}`, `salon ${n}`, `salon${n}`];
}

// Alias adicionales por recurso, más allá del nombre/nombreHorario propios.
const ALIAS_EXTRA: Record<string, string[]> = {
  sala_info_1: ['sala de informatica', 'sala informatica', 'informatica', 'sistemas', 'sala de sistemas'],
  sala_info_2: ['sala de informatica 2', 'informatica 2'],
  lab_ciencias: ['laboratorio', 'laboratorio de ciencias', 'lab ciencias'],
  lab_innovacion: ['aula de innovacion', 'aula innovacion', 'sala de innovacion', 'innovacion', 'lab innovacion'],
  biblioteca: ['biblioteca'],
  auditorio: ['auditorio'],
  sala_ef: ['sala de educacion fisica', 'educacion fisica'],
};

function construirAlias(recursos: Recurso[]): AliasRecurso[] {
  return recursos.map(r => {
    const alias = new Set<string>();
    alias.add(normalizarTexto(r.nombre));
    if (r.nombreHorario) alias.add(normalizarTexto(r.nombreHorario));
    const m = r.nombre.match(/^Aula (\d+)$/);
    if (m) generarAliasAula(Number(m[1])).forEach(a => alias.add(a));
    (ALIAS_EXTRA[r.id] ?? []).forEach(a => alias.add(normalizarTexto(a)));
    return { recursoId: r.id, alias: [...alias] };
  });
}

/**
 * Empareja el texto de "lugar" de una actividad de agenda con un recurso de
 * la app. Devuelve null si no hay un único recurso reconocible: lugar vacío,
 * texto genérico ("aulas de clase", "todos los espacios"), otra sede
 * ("sede Finca", "sede Gustavo Rodas"), o un sitio externo ("cancha",
 * "biblioteca municipal", "MOVA").
 */
export function emparejarLugar(lugar: string | undefined, recursos: Recurso[] = RECURSOS): string | null {
  if (!lugar) return null;
  const norm = normalizarTexto(lugar);
  if (!norm) return null;

  const alias = construirAlias(recursos);

  // Coincidencia exacta primero (evita que "biblioteca municipal" empareje
  // por contener "biblioteca" — solo cuenta si el texto completo, normalizado,
  // es igual a un alias).
  const exacta = alias.find(a => a.alias.includes(norm));
  if (exacta) return exacta.recursoId;

  // Si el lugar trae varias partes separadas por "y"/"," (ej. "Aula 1 sede GRI
  // y Aula 1 sede La Finca"), no se puede resolver a un único recurso.
  if (/\by\b|,/.test(norm)) return null;

  // Menciona una sede: si es la sede principal, se ignora esa parte y se
  // reintenta el emparejamiento exacto con el resto del texto; si es otra
  // sede (Finca, Gustavo Rodas, GRI...), no es un recurso de esta app.
  if (/\bsede\b/.test(norm)) {
    const SEDE_PRINCIPAL = /sede (principal|ppal|central)/g;
    if (!SEDE_PRINCIPAL.test(norm)) return null;
    const sinSede = norm.replace(SEDE_PRINCIPAL, '').trim().replace(/\s+/g, ' ');
    const exactaSinSede = alias.find(a => a.alias.includes(sinSede));
    return exactaSinSede ? exactaSinSede.recursoId : null;
  }

  return null;
}

// ── Hora de actividad → bloques ──────────────────────────────────────────────

const TODOS_LOS_BLOQUES = [1, 2, 3, 4, 5, 6];

function horaAminutos(h: number, m: number, meridiano: 'am' | 'pm' | 'm' | null): number {
  let hora24 = h % 12;
  if (meridiano === 'pm') hora24 += 12;
  else if (meridiano === 'am') hora24 = h % 12;
  else if (meridiano === 'm') hora24 = h === 12 ? 12 : h; // "12:00 m" = mediodía
  else hora24 = h; // sin meridiano explícito: se asume 24h o se corrige luego
  return hora24 * 60 + m;
}

interface RangoHora {
  inicio: number; // minutos desde 00:00
  fin: number;
}

// Extrae un rango horario de textos como "8:00 am a 12:00 m", "10:10-11:05am",
// "2:25 pm a 4:15 pm", "6:00 am". Devuelve null si no hay un patrón de hora
// reconocible (p. ej. "Durante la jornada", "Por confirmar", "3 últimas horas").
function extraerRangoHora(hora: string): RangoHora | null {
  const texto = hora.toLowerCase();
  const patronHora = /(\d{1,2})(?::(\d{2}))?\s*(am|pm|m\.?)?/g;
  const coincidencias: Array<{ h: number; m: number; mer: 'am' | 'pm' | 'm' | null }> = [];
  let match: RegExpExecArray | null;
  while ((match = patronHora.exec(texto)) !== null) {
    const h = Number(match[1]);
    if (h < 1 || h > 12) continue; // descarta números sueltos (ej. "937", "3.0")
    const m = match[2] ? Number(match[2]) : 0;
    const merRaw = match[3]?.replace('.', '') ?? null;
    const mer = merRaw === 'am' || merRaw === 'pm' || merRaw === 'm' ? merRaw : null;
    coincidencias.push({ h, m, mer });
  }
  if (coincidencias.length === 0) return null;

  // Propaga el meridiano hacia atrás cuando falta (ej. "10:10-11:05am" → la
  // primera hora hereda "am" de la segunda).
  for (let i = coincidencias.length - 2; i >= 0; i--) {
    if (!coincidencias[i].mer && coincidencias[i + 1].mer) {
      coincidencias[i].mer = coincidencias[i + 1].mer;
    }
  }
  // Si ninguna trae meridiano, no se puede ubicar en el día con certeza.
  if (coincidencias.every(c => !c.mer)) return null;
  // Un meridiano faltante que no se pudo heredar de una hora posterior: usa
  // el de la más cercana (delante).
  for (let i = 1; i < coincidencias.length; i++) {
    if (!coincidencias[i].mer) coincidencias[i].mer = coincidencias[i - 1].mer;
  }

  const minutos = coincidencias.map(c => horaAminutos(c.h, c.m, c.mer));
  const inicio = Math.min(...minutos);
  const fin = Math.max(...minutos);
  if (inicio === fin) return { inicio, fin: inicio + 1 }; // hora puntual: 1 min de ventana
  return { inicio, fin };
}

function seSolapan(a: RangoHora, bInicio: number, bFin: number): boolean {
  return a.inicio < bFin && bInicio < a.fin;
}

/**
 * Traduce la hora de una actividad de agenda a la lista de bloques (1..6)
 * que ocupa. Si el texto no tiene una hora concreta interpretable, devuelve
 * los 6 bloques (ver decisión 2 en el encabezado del archivo).
 */
export function horaABloques(hora: string | undefined): number[] {
  if (!hora) return TODOS_LOS_BLOQUES;
  const rango = extraerRangoHora(hora);
  if (!rango) return TODOS_LOS_BLOQUES;

  const bloques = new Set<number>();
  for (const b of [...BLOQUES_MANANA, ...BLOQUES_TARDE]) {
    const [ih, im] = b.inicio.split(':').map(Number);
    const [fh, fm] = b.fin.split(':').map(Number);
    const inicioB = ih * 60 + im;
    const finB = fh * 60 + fm;
    if (seSolapan(rango, inicioB, finB)) bloques.add(b.id);
  }
  if (bloques.size === 0) return TODOS_LOS_BLOQUES; // rango fuera de todo bloque conocido
  return [...bloques].sort((a, b) => a - b);
}

// ── Construcción del plan ────────────────────────────────────────────────────

function idAgenda(agenda: AgendaSemanal): string {
  return `agenda-p${agenda.periodo}-s${agenda.semana}`;
}

function idActividad(agenda: AgendaSemanal, fecha: string, indice: number, bloque: number): string {
  return `${idAgenda(agenda)}-${fecha}-${indice}:b${bloque}`;
}

function marcaDe(activityKey: string): string {
  return `${PREFIJO_ID}${activityKey}`;
}

function activityKeyDeMotivo(motivo: string | undefined): string | null {
  if (!motivo || !motivo.startsWith(PREFIJO_ID)) return null;
  return motivo.slice(PREFIJO_ID.length);
}

export interface OpcionesPlan {
  reservasExistentes: ReservaExistente[];
  ocupantesClaseRegular?: OcupanteClaseRegular[]; // choques por clase regular del horario base
  recursos?: Recurso[];
}

/**
 * Calcula qué reservas hay que crear, cuáles liberar (de esta misma agenda,
 * si ya no corresponden), y qué queda listado como choque o lugar no
 * reconocido. No muta nada — el llamador ejecuta el plan contra el backend.
 */
export function construirPlanReservasAgenda(
  agenda: AgendaSemanal,
  opciones: OpcionesPlan,
): PlanReservasAgenda {
  const recursos = opciones.recursos ?? RECURSOS;
  const recursosPorId = new Map(recursos.map(r => [r.id, r] as const));
  const reservas = opciones.reservasExistentes;
  const ocupantesClase = opciones.ocupantesClaseRegular ?? [];

  const crear: ReservaAAgendarCrear[] = [];
  const choques: ChoqueAgenda[] = [];
  const noReconocidos: LugarNoReconocido[] = [];

  // activityKey → recurso/fecha/bloque vigente en este recálculo. Sirve para
  // decidir qué reservas viejas de esta agenda ya no corresponden (la
  // actividad se quitó, o se movió de lugar/hora) y hay que liberar.
  // Dos actividades de la MISMA agenda que piden el mismo espacio y bloque:
  // la primera se queda con él y la segunda sale como choque.
  const tomadoEnPlan = new Map<string, string>();

  const vigentePorActivityKey = new Map<string, { recurso: string; fecha: string; bloque: number }>();

  for (const dia of agenda.dias) {
    dia.actividades.forEach((act: ActividadAgenda, indice: number) => {
      const recursoId = emparejarLugar(act.lugar, recursos);
      if (!act.lugar) return; // nada que reservar, no se reporta
      if (!recursoId) {
        noReconocidos.push({ fecha: dia.fecha, dia: dia.dia, actividad: act.actividad, lugar: act.lugar });
        return;
      }
      const recurso = recursosPorId.get(recursoId)!;
      const bloques = horaABloques(act.hora);

      for (const bloque of bloques) {
        const activityKey = idActividad(agenda, dia.fecha, indice, bloque);
        vigentePorActivityKey.set(activityKey, { recurso: recursoId, fecha: dia.fecha, bloque });
        const marca = marcaDe(activityKey);

        const yaExiste = reservas.some(
          r => r.estado !== 'cancelada' && r.estado !== 'rechazada' && r.motivo === marca && r.recurso === recursoId
        );
        if (yaExiste) { // idempotencia: no duplicar en una republicación
          tomadoEnPlan.set(`${recursoId}|${dia.fecha}|${bloque}`, act.actividad);
          continue;
        }

        const ocupante = reservas.find(
          r => r.recurso === recursoId && r.fecha === dia.fecha && r.bloque === bloque
            && r.estado !== 'cancelada' && r.estado !== 'rechazada'
            && activityKeyDeMotivo(r.motivo) !== activityKey
        );
        if (ocupante) {
          choques.push({
            fecha: dia.fecha, dia: dia.dia, bloque, recurso: recursoId,
            recursoNombre: recurso.nombre, actividad: act.actividad,
            ocupante: `reservado por ${ocupante.solicitante}`,
          });
          continue;
        }

        const clavePlan = `${recursoId}|${dia.fecha}|${bloque}`;
        const otraActividad = tomadoEnPlan.get(clavePlan);
        if (otraActividad !== undefined && otraActividad !== act.actividad) {
          choques.push({
            fecha: dia.fecha, dia: dia.dia, bloque, recurso: recursoId,
            recursoNombre: recurso.nombre, actividad: act.actividad,
            ocupante: `también lo pide «${otraActividad}» en esta agenda`,
          });
          continue;
        }
        tomadoEnPlan.set(clavePlan, act.actividad);

        const clase = ocupantesClase.find(
          o => o.recursoId === recursoId && o.fecha === dia.fecha && o.bloque === bloque
        );
        if (clase) {
          choques.push({
            fecha: dia.fecha, dia: dia.dia, bloque, recurso: recursoId,
            recursoNombre: recurso.nombre, actividad: act.actividad,
            ocupante: clase.descripcion,
          });
          continue;
        }

        crear.push({
          activityKey, motivo: marca, recurso: recursoId, recursoNombre: recurso.nombre,
          fecha: dia.fecha, bloque, actividad: act.actividad,
        });
      }
    });
  }

  // Reservas ya creadas por ESTA agenda (mismo periodo+semana) cuyo
  // activityKey ya no aparece en el recálculo → se liberan.
  const prefijoEstaAgenda = `${PREFIJO_ID}${idAgenda(agenda)}-`;
  const liberar: ReservaAAgendarLiberar[] = [];
  for (const r of reservas) {
    if (r.estado === 'cancelada' || r.estado === 'rechazada') continue;
    if (!r.motivo || !r.motivo.startsWith(prefijoEstaAgenda)) continue;
    const activityKey = activityKeyDeMotivo(r.motivo);
    if (!activityKey) continue;
    const vigente = vigentePorActivityKey.get(activityKey);
    const siguSiendoValida = vigente
      && vigente.recurso === r.recurso && vigente.fecha === r.fecha && vigente.bloque === r.bloque;
    if (!siguSiendoValida) {
      liberar.push({
        reservaId: r.id, recurso: r.recurso, fecha: r.fecha, bloque: r.bloque,
        motivo: 'La actividad se quitó o cambió de lugar/hora al republicar la agenda',
      });
    }
  }

  return { crear, liberar, choques, noReconocidos };
}
