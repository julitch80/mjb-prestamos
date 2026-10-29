// Cuadernillo imprimible de la guía para el estudiante SIN tecnología: todo en papel.
// Lógica pura (HTML). Sin QR, sin enlaces, sin mención de aplicaciones. Solo el primer nombre.
import { esc } from '../simulacros/imprimirGuion';
import { abrirImprimibleUAI } from './imprimibleUAI';
import { subpasos } from './subpasos';
import { MODALIDADES_SUSTENTACION } from './tipos';
import type { FechaISO, Guia, GuiaPlan, PasoGuia, PlanCasa } from './tipos';

export type PlanParaGuia = Pick<PlanCasa, 'nombres' | 'grupo' | 'desde' | 'hasta'> & Partial<Pick<PlanCasa, 'topeDiario' | 'ritmo'>>;

const fecha = (f: FechaISO | null | undefined) => {
  if (!f) return '';
  const [y, m, d] = f.split('-');
  return `${d}/${m}/${y}`;
};

// Escudo con URL absoluta: el cuadernillo se abre en una ventana nueva sin la base de la app.
const BASE_URL = (import.meta as unknown as { env?: { BASE_URL?: string } }).env?.BASE_URL ?? '/';
const ESCUDO = () => (typeof location !== 'undefined' ? location.origin : '') + `${BASE_URL}mjb_escudo.png`;

/** Franja institucional: escudo + nombre del colegio (va en la portada y al abrir cada guía). */
const membrete = () => `<div class="membrete"><img src="${ESCUDO()}" alt=""><div><b>Institución Educativa Manuel J. Betancur</b><br><span>San Antonio de Prado · Medellín · Plan Académico Especial</span></div></div>`;

const CSS = `
@page { size: letter portrait; margin: 1.6cm; }
* { box-sizing: border-box; }
body { font-family: Arial, Helvetica, sans-serif; color: #111; font-size: 15px; line-height: 1.5; margin: 0; }
h1 { font-size: 24px; margin: 0 0 4px; }
h2 { font-size: 20px; margin: 0 0 8px; color: #1e3a5f; border-bottom: 2px solid #c9a227; padding-bottom: 3px; }
h3 { font-size: 17px; margin: 16px 0 4px; }
p { margin: 4px 0; }
.enc { border: 2px solid #1e3a5f; border-radius: 6px; padding: 8px 12px; margin-bottom: 12px; }
.producto { border: 1.5px dashed #111; border-radius: 6px; padding: 8px 12px; margin: 8px 0 12px; }
.guia { page-break-before: always; }
.portada { text-align: center; padding-top: 2.5cm; }
.portada .escudo { width: 5cm; height: auto; margin-bottom: 0.8cm; }
.portada h1 { color: #1e3a5f; }
.membrete { display: flex; align-items: center; gap: 10px; border-bottom: 3px solid #1e3a5f; padding-bottom: 6px; margin-bottom: 10px; font-size: 13px; }
.membrete img { width: 1.4cm; height: auto; }
.membrete span { color: #444; font-size: 11px; }
img { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.portada h1 { font-size: 34px; }
.portada p { font-size: 20px; }
.entregas, .uso { page-break-before: always; }
.tabla { width: 100%; border-collapse: collapse; margin: 6px 0 12px; }
.tabla th, .tabla td { border: 1.5px solid #111; padding: 5px 8px; text-align: left; vertical-align: top; }
.tabla th { background: #e8e8e8; }
.semana { page-break-before: always; }
.semana.primera { page-break-before: auto; }
.paso { margin-bottom: 14px; page-break-inside: avoid; }
.paso ol { margin: 4px 0 6px 22px; padding: 0; }
.paso li { margin-bottom: 4px; }
.contenido { white-space: pre-line; }
.lectura { border-left: 3px solid #999; padding-left: 8px; }
.lineas { border: 1.5px solid #111; border-radius: 4px; margin: 6px 0 4px;
  background-image: repeating-linear-gradient(to bottom, transparent 0, transparent calc(0.95cm - 1px), #888 calc(0.95cm - 1px), #888 0.95cm); }
.etq { font-size: 12px; color: #444; }
.chequeo { list-style: none; padding: 0; margin: 4px 0 0; }
.chequeo li { margin-bottom: 3px; }
.entrega { border: 2px solid #111; border-radius: 6px; padding: 8px 12px; margin-top: 10px; background: #f3f3f3; page-break-inside: avoid; }
.sust { page-break-before: always; }
.preg { margin-bottom: 10px; page-break-inside: avoid; }
`;

const CANAL_DEFECTO = 'En físico al docente, o por medio del acudiente en coordinación con el docente';

/** Caja con renglones: unos 3 por momento de trabajo (entre 3 y 12). */
const lineasCaja = (momentos: number) => {
  const n = Math.max(3, Math.min(12, (Math.round(momentos) || 1) * 3));
  return `<div class="lineas" style="height:${(n * 0.95).toFixed(2)}cm"></div>`;
};

function textoPaso(p: PasoGuia): string {
  const subs = subpasos(p.instrucciones);
  const cuerpo = subs.length > 1
    ? `<ol>${subs.map(s => `<li>${esc(s)}</li>`).join('')}</ol>`
    : `<p class="contenido">${esc(subs[0] ?? p.instrucciones)}</p>`;
  return `<div class="paso">
    <h3>${esc(p.titulo)}</h3>
    ${p.lectura ? `<p class="etq">Lectura de este paso:</p><p class="contenido lectura">${esc(p.lectura)}</p>` : ''}
    ${cuerpo}
    <p class="etq">Escribe tu respuesta aquí (usa tu cuaderno si necesitas más espacio):</p>
    ${lineasCaja(p.momentos)}
  </div>`;
}

type Nombres = Record<string, { asignatura: string; docente: string }>;

const tituloGuia = (g: GuiaPlan, nombres: Nombres) => {
  const areas = g.asignaturaIds.map(id => nombres[id]?.asignatura ?? id);
  const hayPregunta = g.eje.trim() && !g.asignaturaIds.includes(g.eje) && !areas.includes(g.eje);
  return { areas, texto: hayPregunta ? `${g.eje} (${areas.join(' · ')})` : areas.join(' · ') };
};

/** (Guías integradas) «Tu entrega incluye: ☐ parte (Asignatura)». */
const listaComponentes = (e: PasoGuia | undefined, nombres: Nombres) => (e?.componentes?.length
  ? `<p><b>Tu entrega incluye:</b></p><ul class="chequeo">${e.componentes.map(c => `<li>☐ ${esc(c.parte)} (${esc(nombres[c.asignaturaId]?.asignatura ?? c.asignatura ?? c.asignaturaId)})</li>`).join('')}</ul>` : '');

function seccionGuia(g: GuiaPlan, guia: Guia, nombres: Nombres): string {
  const t = tituloGuia(g, nombres);
  const semanas = [...new Set(guia.pasos.map(p => p.semana))].sort((a, b) => a - b);
  const bloqueSemana = (n: number, i: number) => {
    const pasos = guia.pasos.filter(p => p.semana === n);
    const entrega = pasos.find(p => p.esEntregaParcial) ?? pasos[pasos.length - 1];
    return `<div class="semana${i === 0 ? ' primera' : ''}">
      <h2>Semana ${esc(n)}</h2>
      ${pasos.map(textoPaso).join('')}
      ${entrega ? `<div class="entrega">
        <p><b>Entrega de la semana:</b> ${esc(entrega.evidenciaDetalle || entrega.titulo)}</p>
        ${listaComponentes(entrega, nombres)}
        <p><b>Cómo entregarla:</b> en papel (hoja o cuaderno). ${esc(entrega.canalEntrega || CANAL_DEFECTO)}.</p>
      </div>` : ''}
    </div>`;
  };
  return `<section class="guia">
  ${membrete()}<div class="enc"><h1>${esc(t.texto)}</h1></div>
  <h3>Lo que vas a construir</h3>
  <div class="producto">${esc(guia.productoFinal)}</div>
  ${semanas.map(bloqueSemana).join('')}
</section>`;
}

type Aprobada = { g: GuiaPlan; guia: Guia };

function seccionEntregas(items: Aprobada[], nombres: Nombres): string {
  const filas = items.flatMap(({ g, guia }) => {
    const t = tituloGuia(g, nombres).areas.join(' · ');
    const semanas = [...new Set(guia.pasos.map(p => p.semana))].sort((a, b) => a - b);
    return semanas.map(n => {
      const pasos = guia.pasos.filter(p => p.semana === n);
      const e = pasos.find(p => p.esEntregaParcial) ?? pasos[pasos.length - 1];
      return `<tr><td>${esc(t)}</td><td>Semana ${esc(n)}</td><td>${esc(fecha(e.fecha)) || '________'}</td><td>${esc(e.evidenciaDetalle || e.titulo)}${e.componentes?.length ? `<br>${e.componentes.map(c => `☐ ${esc(c.parte)} (${esc(nombres[c.asignaturaId]?.asignatura ?? c.asignatura ?? c.asignaturaId)})`).join('<br>')}` : ''}</td><td>En papel; ${esc(e.canalEntrega || CANAL_DEFECTO)}</td></tr>`;
    });
  }).join('');
  const sust = items.map(({ g, guia }) => {
    const s = guia.sustentacion;
    const modal = MODALIDADES_SUSTENTACION.find(m => m.id === s.modalidad)?.texto ?? s.modalidad;
    return `<div class="preg"><h3>Sustentación: ${esc(tituloGuia(g, nombres).areas.join(' · '))}</h3>
      <p>Modalidad: <b>${esc(modal)}</b> · Fecha: <b>${esc(fecha(s.fecha)) || '________'}</b> · Hora: <b>${esc(s.hora ?? '') || '______'}</b> · Lugar: <b>${esc(s.lugarOEnlace) || '____________'}</b></p>
      ${s.preguntasGuia.map((q, i) => `<div class="preg"><p><b>${i + 1}. ${esc(q)}</b></p>${lineasCaja(1)}</div>`).join('')}</div>`;
  }).join('');
  return `<section class="entregas"><h2>Entregas y sustentación</h2>
  <table class="tabla"><tr><th>Asignatura</th><th>Semana</th><th>Fecha</th><th>Qué entregas</th><th>Cómo</th></tr>${filas}</table>
  ${sust}</section>`;
}

/** Guías con contenido aprobado (las únicas que entran al cuadernillo). */
export const guiasAprobadas = (guias: GuiaPlan[]): GuiaPlan[] => guias.filter(g => g.aprobada && g.aprobada.pasos.length);

/** Un solo cuadernillo con todas las guías aprobadas del plan; '' si no hay ninguna. */
export function construirHtmlCuadernillo(plan: PlanParaGuia, guias: GuiaPlan[], nombres: Nombres): string {
  const items: Aprobada[] = guiasAprobadas(guias).map(g => ({ g, guia: g.aprobada! }));
  if (!items.length) return '';
  const primer = esc(plan.nombres.trim().split(/\s+/)[0] || '');
  const tope = plan.topeDiario ?? 4;
  const ritmo = plan.ritmo === 'dia_por_medio' ? 'un día sí y un día no' : 'todos los días hábiles';
  const portada = `<section class="portada"><img class="escudo" src="${ESCUDO()}" alt="Escudo MJB"><h1>Plan Académico Especial</h1><p class="sub">Cuadernillo de trabajo</p>
    <p><b>${primer}</b></p><p>Grupo ${esc(plan.grupo)}</p>
    <p>Del ${esc(fecha(plan.desde))} al ${esc(fecha(plan.hasta))}</p>
    <p class="etq">Institución Educativa Manuel J. Betancur · San Antonio de Prado</p></section>`;
  const uso = `<section class="uso"><h2>Cómo usar este cuadernillo</h2>
    <p>Cada <b>momento</b> es un tiempo de trabajo de 25 minutos. Trabaja máximo <b>${esc(tope)} momentos al día</b>, ${esc(ritmo)}.</p>
    <p>Hay una sección por asignatura. Sigue los pasos en orden, un paso a la vez, y escribe tus respuestas en los espacios con renglones; si necesitas más espacio usa tu cuaderno.</p>
    <p>Cada semana hay una entrega. Las entregas se hacen <b>en papel</b>: en físico al docente, o por medio de tu acudiente en coordinación con el docente. Al final del cuadernillo está la lista de entregas y las preguntas de la sustentación, que es presencial u oral.</p></section>`;
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Cuadernillo - Plan Académico Especial</title><style>${CSS}</style></head><body>${portada}${uso}${items.map(({ g, guia }) => seccionGuia(g, guia, nombres)).join('')}${seccionEntregas(items, nombres)}</body></html>`;
}

/** Misma mecánica de impresión que el formato UAI (ventana nueva; marco oculto si la bloquean). */
export function abrirImprimibleGuia(html: string): void { abrirImprimibleUAI(html); }
