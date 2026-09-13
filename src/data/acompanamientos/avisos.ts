/**
 * Avisos de cambio para la vista previa de publicación (tarea 7.2): qué le
 * cambia a cada docente entre la distribución que regía antes de la nueva
 * fecha de vigencia y la que se está por publicar.
 *
 * Función pura — no toca Firestore ni React. `anterior` la calcula quien
 * llama con `publicacionVigente(publicaciones, jornada, vigenteDesde)`: es
 * la distribución que regiría en `vigenteDesde` SIN la nueva publicación.
 */

import { USUARIOS } from '../maestros';
import type { Dia, Distribucion, FechaISO, Publicacion } from './tipos';
import { DIAS } from './tipos';
import { fechaLegibleAcomp } from './textos';

export const DIA_CAPITALIZADO: Record<Dia, string> = {
  lunes: 'Lunes', martes: 'Martes', miercoles: 'Miércoles', jueves: 'Jueves', viernes: 'Viernes',
};

export interface ParDiaZona {
  dia: Dia;
  zona: string;
}

export interface AvisoDocente {
  docenteId: string;
  nombre: string;
  antes: ParDiaZona[];
  despues: ParDiaZona[];
  /** Texto corto para la notificación de la app. */
  mensaje: string;
  /** Correo sencillo con tabla «Tenías / Te queda». */
  html: string;
}

/** Los pares (día, nombre de zona) de un docente en una distribución, en orden de la semana. */
function paresDeDocente(dist: Distribucion, docenteId: string): ParDiaZona[] {
  const pares: ParDiaZona[] = [];
  for (const dia of DIAS) {
    for (const a of dist.asignaciones) {
      if (a.docenteId === docenteId && a.dia === dia) {
        const zona = dist.zonas.find((z) => z.id === a.zonaId)?.nombre ?? a.zonaId;
        pares.push({ dia, zona });
      }
    }
  }
  return pares;
}

function igualesPares(a: ParDiaZona[], b: ParDiaZona[]): boolean {
  if (a.length !== b.length) return false;
  const clave = (p: ParDiaZona) => `${p.dia}|${p.zona}`;
  const setA = new Set(a.map(clave));
  return b.every((p) => setA.has(clave(p)));
}

function textoListado(pares: ParDiaZona[]): string {
  if (pares.length === 0) return 'ninguno';
  return pares.map((p) => `${DIA_CAPITALIZADO[p.dia]} · ${p.zona}`).join('; ');
}

function filasTabla(pares: ParDiaZona[]): string {
  if (pares.length === 0) {
    return '<tr><td colspan="2" style="color:#64748b;padding:4px 8px;">ninguno</td></tr>';
  }
  return pares
    .map(
      (p) =>
        `<tr><td style="padding:4px 8px;border-bottom:1px solid #e2e8f0;">${DIA_CAPITALIZADO[p.dia]}</td><td style="padding:4px 8px;border-bottom:1px solid #e2e8f0;">${p.zona}</td></tr>`,
    )
    .join('');
}

/**
 * Los docentes cuyo conjunto de (día, zona) cambia entre `anterior` y
 * `nueva`, con el mensaje corto y el HTML del correo ya armados.
 */
export function avisosDeCambio(anterior: Publicacion, nueva: Distribucion, vigenteDesde: FechaISO): AvisoDocente[] {
  const idsAnterior = new Set(anterior.asignaciones.map((a) => a.docenteId));
  const idsNueva = new Set(nueva.asignaciones.map((a) => a.docenteId));
  const ids = new Set([...idsAnterior, ...idsNueva]);

  const fechaLegible = fechaLegibleAcomp(vigenteDesde);
  const jornadaLegible = nueva.jornada === 'manana' ? 'mañana' : 'tarde';

  const avisos: AvisoDocente[] = [];
  for (const docenteId of ids) {
    const antes = paresDeDocente(anterior, docenteId);
    const despues = paresDeDocente(nueva, docenteId);
    if (igualesPares(antes, despues)) continue;

    const nombre = USUARIOS.find((u) => u.id === docenteId)?.nombreCorto ?? docenteId;
    const mensaje = `Tus acompañamientos de descanso cambian desde el ${fechaLegible}. Antes: ${textoListado(antes)}. Ahora: ${textoListado(despues)}.`;
    const html = `
      <div style="font-family:sans-serif;color:#0f172a;">
        <p>Hola ${nombre},</p>
        <p>Tus acompañamientos de descanso (jornada de ${jornadaLegible}) cambian desde el <strong>${fechaLegible}</strong>.</p>
        <table style="border-collapse:collapse;margin:12px 0;">
          <thead>
            <tr>
              <th style="text-align:left;padding:4px 8px;border-bottom:2px solid #0f172a;">Tenías</th>
              <th style="text-align:left;padding:4px 8px;border-bottom:2px solid #0f172a;"></th>
            </tr>
          </thead>
          <tbody>${filasTabla(antes)}</tbody>
        </table>
        <table style="border-collapse:collapse;margin:12px 0;">
          <thead>
            <tr>
              <th style="text-align:left;padding:4px 8px;border-bottom:2px solid #0f172a;">Te queda</th>
              <th style="text-align:left;padding:4px 8px;border-bottom:2px solid #0f172a;"></th>
            </tr>
          </thead>
          <tbody>${filasTabla(despues)}</tbody>
        </table>
        <p style="color:#64748b;font-size:12px;">I.E. Manuel J. Betancur — acompañamientos de descanso.</p>
      </div>
    `.trim();

    avisos.push({ docenteId, nombre, antes, despues, mensaje, html });
  }

  return avisos;
}
