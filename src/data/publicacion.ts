// ── Publicaciones web (Google Site del colegio) ─────────────────────────────
//
// Toda modificación de horario o jornada acortada que el coordinador guarda
// crea automáticamente una "publicación pendiente". El coordinador puede
// revisarla, editarla y aprobar antes de que el sistema la publique en el
// Google Site institucional vía Apps Script.

/** URL pública del Google Site del colegio donde aparecen los avisos. */
export const URL_SITE_HORARIOS = 'https://sites.google.com/iemanueljbetancur.edu.co/horarios';

import {
  formatearFechaLegible,
  generarResumenDifusion,
} from './horarioModificado';
import type {
  HorarioModificado,
  FichaEditor,
  JornadaReducida,
} from './horarioModificado';

export type EstadoPublicacion =
  | 'pendiente_revision'
  | 'aprobada_publicada'
  | 'descartada';

export type TipoFuentePublicacion = 'modificacion' | 'jornada_reducida';

export interface PublicacionPendiente {
  id: string;
  timestampCreacion: string;
  autor: string;                       // userId del coordinador
  tipo: TipoFuentePublicacion;
  refId: string;                       // id del HorarioModificado o JornadaReducida
  fecha: string;                       // fecha del aviso (YYYY-MM-DD)
  jornada: 'manana' | 'tarde';
  titulo: string;
  htmlOriginal: string;                // HTML generado automáticamente
  htmlEditado?: string;                // HTML modificado por el coordinador
  estado: EstadoPublicacion;
  timestampPublicacion?: string;       // cuándo se publicó (si aplica)
}

export function generarIdPublicacion(): string {
  return `pub_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

/** HTML final efectivo: el editado si existe, sino el original. */
export function htmlEfectivo(p: PublicacionPendiente): string {
  return p.htmlEditado ?? p.htmlOriginal;
}

// ── Generadores de publicaciones ────────────────────────────────────────────

export function generarPublicacionDeModificacion(
  hm: HorarioModificado,
  fichas: FichaEditor[],
  usuarios: Array<{ id: string; nombre: string; nombreCorto: string; correo: string }>,
  autorId: string,
): PublicacionPendiente {
  const resumen = generarResumenDifusion(hm, fichas, usuarios);
  return {
    id: generarIdPublicacion(),
    timestampCreacion: new Date().toISOString(),
    autor: autorId,
    tipo: 'modificacion',
    refId: hm.id,
    fecha: hm.fecha,
    jornada: hm.jornada,
    titulo: `Modificación de horario — ${formatearFechaLegible(hm.fecha)}`,
    htmlOriginal: resumen.html,
    estado: 'pendiente_revision',
  };
}

export function generarPublicacionDeJornadaReducida(
  jr: JornadaReducida,
  autorId: string,
): PublicacionPendiente {
  return {
    id: generarIdPublicacion(),
    timestampCreacion: new Date().toISOString(),
    autor: autorId,
    tipo: 'jornada_reducida',
    refId: jr.id,
    fecha: jr.fecha,
    jornada: jr.jornada,
    titulo: `Jornada acortada — ${formatearFechaLegible(jr.fecha)}`,
    htmlOriginal: generarHtmlJornadaReducida(jr),
    estado: 'pendiente_revision',
  };
}

function generarHtmlJornadaReducida(jr: JornadaReducida): string {
  const fechaLegible = formatearFechaLegible(jr.fecha);
  const jornadaTxt = jr.jornada === 'manana' ? 'mañana' : 'tarde';
  const partes: string[] = [];
  partes.push(`<div style="font-family:Arial,sans-serif;max-width:600px;color:#1f2937">`);
  partes.push(`<h2 style="margin:0 0 4px 0;color:#b45309">I.E. Manuel J. Betancur — Jornada acortada</h2>`);
  partes.push(`<p style="margin:0 0 16px 0;color:#475569"><strong>${fechaLegible}</strong> · Jornada ${jornadaTxt}</p>`);
  partes.push(`<p style="margin:0 0 4px 0"><strong>Motivo:</strong> ${jr.motivo}</p>`);
  partes.push(`<p style="margin:0 0 16px 0"><strong>Hora de salida:</strong> ${jr.horaFin}</p>`);
  partes.push(`<h3 style="margin:8px 0 6px 0;color:#1f2937">Bloques del día</h3>`);
  partes.push(`<table style="width:100%;border-collapse:collapse;font-size:13px">`);
  partes.push(`<thead><tr style="background:#fef3c7">`);
  partes.push(`<th style="text-align:left;padding:6px 8px;border:1px solid #fcd34d">Hora</th>`);
  partes.push(`<th style="text-align:left;padding:6px 8px;border:1px solid #fcd34d">Horario</th>`);
  partes.push(`</tr></thead><tbody>`);
  jr.bloques.forEach(b => {
    partes.push(`<tr>`);
    partes.push(`<td style="padding:6px 8px;border:1px solid #fcd34d">${b.id}.ª hora</td>`);
    partes.push(`<td style="padding:6px 8px;border:1px solid #fcd34d">${b.inicio} – ${b.fin}</td>`);
    partes.push(`</tr>`);
  });
  partes.push(`</tbody></table>`);
  partes.push(`<p style="margin-top:20px;font-size:11px;color:#94a3b8">Generado por MJB Préstamos</p>`);
  partes.push(`</div>`);
  return partes.join('\n');
}

// ── Filtros útiles ───────────────────────────────────────────────────────────

export function publicacionesPendientesDeRevisar(
  publicaciones: PublicacionPendiente[],
): PublicacionPendiente[] {
  return publicaciones
    .filter(p => p.estado === 'pendiente_revision')
    .sort((a, b) => a.timestampCreacion.localeCompare(b.timestampCreacion));
}
