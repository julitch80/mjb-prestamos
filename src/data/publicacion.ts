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
  avisoId?: string;                    // id que devuelve el backend al publicar (res.id) — necesario para retirarAviso
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
  const numBloques = jr.numBloques ?? jr.bloques.length ?? 6;
  const partes: string[] = [];
  partes.push(`<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#1f2937;padding:16px">`);
  partes.push(`<h2 style="margin:0 0 6px 0;color:#b45309;font-size:20px;font-weight:800;line-height:1.2">I.E. Manuel J. Betancur — Jornada acortada</h2>`);
  partes.push(`<p style="margin:0 0 12px 0;color:#1f2937;font-size:17px;font-weight:700">${fechaLegible} · Jornada ${jornadaTxt}</p>`);

  // A quién afecta: la jornada completa (no hay grupos individuales aquí).
  partes.push(`<p style="margin:0 0 16px 0;padding:8px 10px;border-radius:8px;background:#fef3c7;color:#92400e;font-size:14px;font-weight:600">Afecta a todos los grupos de la jornada ${jornadaTxt}</p>`);

  partes.push(`<p style="margin:0 0 4px 0;font-size:14px"><strong>Motivo:</strong> ${jr.motivo}</p>`);
  partes.push(`<p style="margin:0 0 16px 0;font-size:14px"><strong>Horario:</strong> entrada ${jr.horaInicio} · salida ${jr.horaFin} · ${numBloques} hora${numBloques === 1 ? '' : 's'} de clase</p>`);

  partes.push(`<h3 style="margin:18px 0 8px 0;color:#1f2937;font-size:16px;font-weight:700;border-bottom:1px solid #e5e7eb;padding-bottom:4px">Bloques del día</h3>`);
  jr.bloques.forEach(b => {
    partes.push(`<div style="margin:0 0 6px 0;padding:8px 10px;border-radius:8px;background:#f9fafb;display:flex;flex-wrap:wrap;gap:4px 8px;align-items:baseline;font-size:14px">`);
    partes.push(`<span style="font-weight:700;color:#1f2937">${b.id}.ª hora</span>`);
    partes.push(`<span style="color:#1f2937">${b.inicio} – ${b.fin}</span>`);
    partes.push(`</div>`);
  });

  const fechaPublicacion = new Date().toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' });
  partes.push(`<p style="margin-top:20px;font-size:11px;color:#94a3b8">Generado por MJB Préstamos · ${fechaPublicacion}</p>`);
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
