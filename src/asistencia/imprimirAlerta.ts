/**
 * Puente entre los datos de la alerta y los imprimibles (`domain/imprimibles-alerta.ts`):
 * arma informes y citaciones con nombres reales y abre la ventana de impresion, donde se
 * imprime o se guarda como PDF. Lo usan el director (su grupo) y coordinacion (la jornada).
 */
import { USUARIOS } from '../data/maestros';
import { nombreCompleto } from './domain/nombres';
import { motivoCitacion, type FilaConsolidado } from './domain/alerta-academica';
import { FUNDAMENTO_CITACION } from './domain/seguimiento-alerta';
import {
  fechaLarga,
  horaLegible,
  htmlCitaciones,
  htmlInformes,
  htmlParaImprimir,
  htmlSeguimiento,
  type CitacionSeguimiento,
  type CitacionAlerta,
  type InformeAlerta,
  type PlanillaFirmas,
} from './domain/imprimibles-alerta';
import { asignaturasDelGrado } from './horarioDelDia';
import type { AgendaCitaciones, ConvocatoriaAlerta, Sede, Student } from './domain/types';

// `import.meta.env.BASE_URL` sin depender de los tipos de Vite (ver MosaicoGrupo.tsx).
const BASE_URL = (import.meta as unknown as { env?: { BASE_URL?: string } }).env?.BASE_URL ?? '/';

const NOMBRE_SEDE: Record<Sede, string> = { central: 'Central', gustavo_rodas: 'Gustavo Rodas', la_finquita: 'La Finquita' };

function institucion(sede: Sede) {
  // Escudo OFICIAL recortado del membrete (no `mjb_escudo.png`, que es el logo de la app).
  return { escudoUrl: new URL(`${BASE_URL}escudo-oficial.png`, window.location.href).href, sede: NOMBRE_SEDE[sede] };
}

export function nombreDirector(slotDirector: string | undefined): string {
  return USUARIOS.find((u) => u.id === slotDirector)?.nombre ?? 'Director(a) de grupo';
}

function hoyLegible(): string {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

/** Nombre de una asignatura del grado (o el id si no esta en la asignacion). */
function nombreAsignatura(grado: string, subjectId: string): string {
  return asignaturasDelGrado(grado).find((a) => a.subjectId === subjectId)?.nombre ?? subjectId;
}

/**
 * Informes SOLO de los citados (dos o mas alertas), en el orden de la lista. Julian,
 * 2026-10-03: con ninguna o una sola asignatura «sigue normal»: ni citacion ni informe.
 */
export function informesDelGrupo(
  grado: string,
  conv: ConvocatoriaAlerta,
  filas: FilaConsolidado[],
  estudiantes: Student[],
  director: string,
): InformeAlerta[] {
  return estudiantes.flatMap((e) => {
    const f = filas.find((x) => x.studentId === e.studentId);
    if (!f || !f.citar) return [];
    return [{
      estudiante: nombreCompleto(e),
      grado,
      periodo: conv.periodo,
      anio: conv.anio,
      director,
      asignaturas: f.enAlerta.map((s) => nombreAsignatura(grado, s)),
      fechaExpedicion: hoyLegible(),
    }];
  });
}

/** Citaciones de la agenda, por hora. Necesita el dia de entrega que puso coordinacion. */
export function citacionesDelGrupo(
  grado: string,
  conv: ConvocatoriaAlerta,
  agenda: AgendaCitaciones,
  estudiantes: Student[],
  director: string,
): CitacionAlerta[] {
  if (!conv.fechaEntrega) return [];
  return Object.entries(agenda.citas)
    .sort(([, a], [, b]) => a.hora.localeCompare(b.hora))
    .flatMap(([id, c]) => {
      const e = estudiantes.find((x) => x.studentId === id);
      if (!e) return [];
      return [{
        estudiante: nombreCompleto(e),
        grado,
        director,
        fecha: fechaLarga(conv.fechaEntrega!),
        hora: horaLegible(c.hora),
        general: c.general,
        motivo: motivoCitacion(conv.periodo),
      }];
    });
}

export type OrdenPlanilla = 'hora' | 'alfabetico';

/**
 * La planilla de asistencia de un grupo: solo los citados de la agenda, en el orden que
 * eligio coordinacion (Julian, 2026-10-03): por hora de citacion o alfabetico.
 */
export function planillaDelGrupo(
  grado: string,
  conv: ConvocatoriaAlerta,
  agenda: AgendaCitaciones,
  filas: FilaConsolidado[],
  estudiantes: Student[],
  director: string,
  orden: OrdenPlanilla,
): PlanillaFirmas | null {
  if (!conv.fechaEntrega) return null;
  const lista = Object.entries(agenda.citas).flatMap(([id, c]) => {
    const e = estudiantes.find((x) => x.studentId === id);
    if (!e) return [];
    return [{ nombre: nombreCompleto(e), hora: c.hora, alertas: filas.find((f) => f.studentId === id)?.total ?? 0 }];
  });
  if (lista.length === 0) return null;
  lista.sort(orden === 'hora'
    ? (a, b) => a.hora.localeCompare(b.hora) || a.nombre.localeCompare(b.nombre, 'es')
    : (a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  return {
    grado, periodo: conv.periodo, anio: conv.anio, director, fecha: fechaLarga(conv.fechaEntrega),
    filas: lista.map((x) => ({ estudiante: x.nombre, alertas: x.alertas, horaCita: horaLegible(x.hora) })),
  };
}

/** Las segundas citaciones de un grupo (las reprogramaciones de la agenda). */
export function citacionesSeguimientoDe(
  grado: string,
  conv: ConvocatoriaAlerta,
  agenda: AgendaCitaciones,
  estudiantes: Student[],
  director: string,
): CitacionSeguimiento[] {
  if (!conv.fechaEntrega) return [];
  return Object.entries(agenda.citas).flatMap(([id, c]) => {
    const r = c.reprogramacion;
    const e = estudiantes.find((x) => x.studentId === id);
    if (!r || !e || c.remision) return [];
    return [{
      estudiante: nombreCompleto(e), grado, director,
      fechaEntrega: fechaLarga(conv.fechaEntrega!), fecha: fechaLarga(r.fecha), hora: horaLegible(r.hora),
      conFundamento: r.conFundamento, fundamento: FUNDAMENTO_CITACION,
    }];
  });
}

export function imprimirSeguimiento(sede: Sede, citaciones: CitacionSeguimiento[], constancias: number, titulo: string): boolean {
  return abrirImpresion(htmlSeguimiento(institucion(sede), citaciones, constancias, titulo));
}

/** Abre el documento en una ventana nueva, lista para imprimir o guardar como PDF. */
export function abrirImpresion(html: string): boolean {
  const w = window.open('', '_blank');
  if (!w) return false; // bloqueador de ventanas emergentes
  w.document.open();
  w.document.write(html);
  w.document.close();
  return true;
}

export function imprimirInformes(sede: Sede, informes: InformeAlerta[], titulo: string): boolean {
  return abrirImpresion(htmlInformes(institucion(sede), informes, titulo));
}

/** Citaciones + informes de toda una jornada en un solo documento (para coordinacion). */
export function imprimirTodo(
  sede: Sede,
  citaciones: CitacionAlerta[],
  informes: InformeAlerta[],
  titulo: string,
  planillas: PlanillaFirmas[] = [],
  constancias: { fecha: string; cuantas: number } | null = null,
): boolean {
  return abrirImpresion(htmlParaImprimir(institucion(sede), citaciones, informes, titulo, planillas, constancias));
}

export function imprimirCitaciones(sede: Sede, citaciones: CitacionAlerta[], titulo: string): boolean {
  return abrirImpresion(htmlCitaciones(institucion(sede), citaciones, titulo));
}
