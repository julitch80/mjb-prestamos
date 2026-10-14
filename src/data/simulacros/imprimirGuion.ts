// Documento imprimible del guion de un rol (función pura: devuelve el HTML, no imprime).
// Sin teléfonos (repositorio público).
import {
  accionesDelPaso, asignacionDe, avisosDeJornada, cronograma, fechaLarga, horaDePaso, nombreDeSlot,
  puestosDeJornada, JORNADA_NOMBRE,
} from './logica';
import type { SimulacroDoc } from './logica';
import { FASES_ROTULO, ROLES_DOCENTE } from './plantillaSismo2026';
import type { JornadaId, Paso, Puesto, RolClave, RolInfo, Ruta } from './plantillaSismo2026';

export interface PlantillaImprimible {
  ROLES: RolInfo[];
  MISION: Record<RolClave, string>;
  PASOS: Paso[];
  ANTES_BASE: string[];
  ANTES_EX: Partial<Record<RolClave, string[]>>;
  RUTAS: Ruta[];
  PUESTOS: Puesto[];
}

export interface OpcionesImprimir {
  preparacion: boolean;
  rutas: boolean;
  encargados: boolean;
}

export const OPCIONES_IMPRIMIR_DEFECTO: OpcionesImprimir = { preparacion: true, rutas: true, encargados: false };

export function esc(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function lista(items: string[]): string {
  return `<ul>${items.map(t => `<li>${esc(t)}</li>`).join('')}</ul>`;
}

const CSS = `
@page { size: letter; margin: 1.5cm; }
* { box-sizing: border-box; }
body { font-family: Arial, Helvetica, sans-serif; font-size: 11pt; color: #000; margin: 0; line-height: 1.35; }
h1 { font-size: 17pt; margin: 0 0 4px; }
h2 { font-size: 13pt; margin: 16px 0 6px; border-bottom: 1.5px solid #000; padding-bottom: 2px; }
.meta { margin: 0 0 2px; }
.impreso { font-size: 9pt; color: #333; margin: 4px 0 0; }
.mision { border: 1.5px solid #000; padding: 6px 8px; margin: 10px 0; }
table { width: 100%; border-collapse: collapse; }
th, td { border: 1px solid #000; padding: 4px 6px; vertical-align: top; text-align: left; }
th { background: #ddd; }
tr { page-break-inside: avoid; }
td.hora { white-space: nowrap; font-weight: bold; }
td.fase { font-size: 9.5pt; }
tr.alarma td { background: #eee; border-top: 2.5px solid #000; border-bottom: 2.5px solid #000; }
td.accion { font-weight: bold; }
td.accion ul { font-weight: normal; }
ul { margin: 2px 0; padding-left: 18px; }
ul.chk { list-style: none; padding-left: 0; }
ul.chk li { margin: 3px 0; }
.aviso { border: 1px solid #000; padding: 4px 8px; margin: 4px 0; }
.aviso.imp { border-width: 2.5px; font-weight: bold; }
.ruta { margin: 6px 0; page-break-inside: avoid; }
.pie { margin-top: 18px; padding-top: 6px; border-top: 1px solid #000; font-size: 10pt; text-align: center; }
`;

export function construirHtmlGuion(
  plantilla: PlantillaImprimible,
  sim: SimulacroDoc,
  jornada: JornadaId,
  rol: RolClave,
  opciones: OpcionesImprimir,
  ahora: Date = new Date(),
): string {
  const info = plantilla.ROLES.find(r => r.k === rol);
  const nombreRol = info?.n ?? rol;
  const cfg = sim.jornadas?.[jornada];
  const hora = cfg?.hora ?? (jornada === 'manana' ? '10:00' : '16:00');
  const filas = cronograma(plantilla.PASOS, { hora });
  const impreso = ahora.toLocaleString('es-CO', { dateStyle: 'long', timeStyle: 'short', timeZone: 'America/Bogota' });
  const out: string[] = [];

  out.push(`<h1>Guion del simulacro — ${esc(nombreRol)}</h1>`);
  out.push(`<p class="meta"><b>${esc(sim.titulo)}</b></p>`);
  out.push(`<p class="meta">${esc(sim.sede)} · ${esc(sim.evento)}</p>`);
  out.push(`<p class="meta">Jornada de la ${esc(JORNADA_NOMBRE[jornada].toLowerCase())}: <b>${esc(cfg ? fechaLarga(cfg.fecha) : 'fecha por definir')}</b>, `
    + `alarma (timbre prolongado) a las <b>${esc(horaDePaso(hora, 0))}</b>.</p>`);
  if (cfg?.motivo) out.push(`<p class="meta">Reprogramado. Motivo: ${esc(cfg.motivo)}</p>`);
  out.push(`<p class="impreso">Impreso el ${esc(impreso)}</p>`);

  const mision = plantilla.MISION[rol];
  if (mision) out.push(`<div class="mision"><b>Su misión.</b> ${esc(mision)}</div>`);

  const avisos = avisosDeJornada(sim.avisos, jornada);
  if (avisos.length) {
    out.push('<h2>Avisos vigentes</h2>');
    avisos.forEach(a => out.push(`<div class="aviso${a.tipo === 'importante' ? ' imp' : ''}">${a.tipo === 'importante' ? 'IMPORTANTE: ' : ''}${esc(a.texto)}</div>`));
  }

  out.push('<h2>Cronograma</h2>');
  out.push('<table><thead><tr><th>Hora</th><th>Fase</th><th>Qué pasa / qué se oye</th><th>Qué hace usted</th></tr></thead><tbody>');
  for (const f of filas) {
    const p = f.paso;
    const { own, base } = accionesDelPaso(p, rol);
    const acciones = [...own, ...base];
    const alarma = p.a === 0 || p.a === 1;
    const que = `<b>${esc(p.t)}.</b> ${esc(p.q)}${p.oye ? `<br><i>Se oye: ${esc(p.oye)}</i>` : ''}`;
    out.push(`<tr${alarma ? ' class="alarma"' : ''}><td class="hora">${esc(f.hora)}</td>`
      + `<td class="fase">${esc(FASES_ROTULO[p.f])}</td><td>${que}</td>`
      + `<td class="accion">${acciones.length ? lista(acciones) : '—'}</td></tr>`);
  }
  out.push('</tbody></table>');

  if (opciones.preparacion) {
    const items = ROLES_DOCENTE.includes(rol)
      ? [...(rol === 'docente' ? [] : (plantilla.ANTES_EX[rol] ?? [])), ...plantilla.ANTES_BASE]
      : (plantilla.ANTES_EX[rol] ?? []);
    out.push('<h2>Lista de preparación</h2>');
    out.push(items.length
      ? `<ul class="chk">${items.map(t => `<li>☐ ${esc(t)}</li>`).join('')}</ul>`
      : '<p>Sin tareas de preparación específicas para este rol.</p>');
  }

  if (opciones.rutas) {
    out.push('<h2>Rutas de evacuación</h2>');
    plantilla.RUTAS.forEach(r => out.push(
      `<div class="ruta"><b>${esc(r.t)}</b><br>${esc(r.w)}<br>Orden de salida: ${esc(r.o.join(' → '))}</div>`));
  }

  if (opciones.encargados) {
    out.push('<h2>Encargados</h2>');
    out.push('<table><thead><tr><th>Puesto</th><th>Grupo</th><th>Encargado</th></tr></thead><tbody>');
    for (const p of puestosDeJornada(jornada, plantilla.PUESTOS)) {
      const a = asignacionDe(sim.asignaciones ?? {}, p.id, jornada);
      let quien: string;
      if (!a || (!a.slot && !a.textoLibre)) quien = 'Por asignar';
      else {
        quien = a.slot ? nombreDeSlot(a.slot) : (a.textoLibre ?? '');
        if (a.porConfirmar) quien += ' (por confirmar)';
      }
      out.push(`<tr><td>${esc(p.nombre)}</td><td>${esc(p.grupo)}</td><td>${esc(quien)}</td></tr>`);
    }
    out.push('</tbody></table>');
  }

  out.push('<p class="pie">Ante cualquier cambio, consulte la app MJB o a coordinación.</p>');

  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${esc(`Guion del simulacro — ${nombreRol}`)}</title><style>${CSS}</style></head><body>${out.join('\n')}</body></html>`;
}

function abrirVentana(html: string): void {
  const w = window.open('', '_blank');
  if (!w) return;
  w.document.open();
  w.document.write(html);
  w.document.close();
}

/** Imprime el HTML con un iframe oculto; si falla, lo abre en una ventana nueva. */
export function imprimirHtml(html: string): void {
  try {
    const f = document.createElement('iframe');
    f.setAttribute('aria-hidden', 'true');
    f.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;';
    document.body.appendChild(f);
    const w = f.contentWindow;
    if (!w) throw new Error('sin ventana');
    w.document.open();
    w.document.write(html);
    w.document.close();
    w.addEventListener('afterprint', () => { window.setTimeout(() => f.remove(), 1000); });
    window.setTimeout(() => {
      try { w.focus(); w.print(); } catch { f.remove(); abrirVentana(html); }
    }, 250);
    window.setTimeout(() => f.remove(), 120000);
  } catch {
    abrirVentana(html);
  }
}
