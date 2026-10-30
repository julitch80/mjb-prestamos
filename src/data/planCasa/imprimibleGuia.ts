// Cuadernillo imprimible de la guía para el estudiante SIN tecnología: todo en papel.
// Lógica pura (HTML). Sin QR, sin enlaces en el contenido, sin mención de aplicaciones. Solo el primer nombre.
// Criterios de diseño: docs/plan-casa-cuadernillo-criterios.md
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
/** Ruta del escudo oficial; `escudoSrc` permite sustituirla (p. ej. por una ruta de archivo en la muestra local). */
export const rutaEscudo = () => (typeof location !== 'undefined' ? location.origin : '') + `${BASE_URL}escudo-oficial.png`;
let escudoSrc: string | null = null;
export const fijarEscudo = (src: string | null) => { escudoSrc = src; };
const ESCUDO = () => escudoSrc ?? rutaEscudo();

/** Franja institucional delgada: escudo + nombre del colegio (al abrir cada guía). */
const membrete = () => `<div class="membrete"><img src="${ESCUDO()}" alt=""><div><b>Institución Educativa Manuel J. Betancur</b><br><span>San Antonio de Prado · Medellín · Plan Académico Especial</span></div></div>`;

const FUENTES = '<link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800&family=Poppins:wght@600;700;800&display=swap" rel="stylesheet">';

const CSS = `
@page { size: letter portrait; margin: 1.8cm 1.8cm 2.1cm;
  @bottom-left { content: "Formamos para la vida, la ciencia y la cultura"; font: 600 8.5pt 'Nunito', Arial, sans-serif; color: #1d6b3a; }
  @bottom-right { content: "Página " counter(page); font: 600 8.5pt 'Nunito', Arial, sans-serif; color: #555; } }
@page :first { @bottom-left { content: ""; } @bottom-right { content: ""; } }
:root { --verde: #1d6b3a; --rojo: #b3122e; --oro: #d4a017; --txt: #1f2937; --verde-t: #eef6f0; --oro-t: #fdf7e3; --rojo-t: #fbeef0; --gris-t: #f4f5f7; }
* { box-sizing: border-box; }
body { font-family: 'Nunito', 'Atkinson Hyperlegible', 'Segoe UI', Arial, sans-serif; color: var(--txt); font-size: 11.5pt; line-height: 1.5; margin: 0; text-align: left;
  -webkit-print-color-adjust: exact; print-color-adjust: exact; }
h1, h2, h3, .rotulo, .num { font-family: 'Poppins', 'Montserrat', 'Segoe UI', Arial, sans-serif; }
h1 { font-size: 22pt; line-height: 1.2; margin: 0; color: var(--verde); }
h2 { font-size: 15pt; margin: 0 0 10px; color: var(--verde); }
h3 { font-size: 12.5pt; margin: 0 0 4px; }
p { margin: 4px 0; max-width: 40em; }
img { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.etq { font-size: 9.5pt; color: #4b5563; margin: 6px 0 2px; }
.contenido { white-space: pre-line; }
.membrete { display: flex; align-items: center; gap: 10px; border-bottom: 3px solid var(--verde); box-shadow: 0 3px 0 -1px var(--oro); padding-bottom: 6px; margin-bottom: 14px; font-size: 10pt; }
.membrete img { width: 1.3cm; height: auto; }
.membrete span { color: #4b5563; font-size: 8.5pt; }
.portada { text-align: center; padding-top: 0.4cm; break-after: page; }
.portada p { max-width: none; }
.portada .escudo { width: 4.2cm; height: auto; margin-bottom: 0.4cm; }
.portada .inst { font: 700 11pt 'Poppins', Arial, sans-serif; color: var(--rojo); letter-spacing: .06em; text-transform: uppercase; }
.portada h1 { font-size: 28pt; margin: 6px 0 2px; }
.portada .sub { font-size: 14pt; color: #4b5563; margin: 0 0 10px; }
.portada .quien { display: inline-block; background: var(--verde); color: #fff; border-radius: 40px; padding: 6px 24px; font: 700 15pt 'Poppins', Arial, sans-serif; margin: 6px 0; }
.portada .fechas { font-weight: 700; margin: 4px 0 10px; }
.bienvenida { background: var(--oro-t); border-left: 5px solid var(--oro); border-radius: 6px; padding: 8px 14px; margin: 10px auto; text-align: left; }
.materias { margin: 8px auto; text-align: left; border-collapse: collapse; width: 100%; }
.materias td { padding: 3px 8px; border-bottom: 1px solid #d1d5db; }
.materias td:last-child { color: #4b5563; text-align: right; }
.uso { background: var(--gris-t); border: 1.5px solid var(--verde); border-radius: 8px; padding: 8px 14px; margin: 10px auto; text-align: left; break-inside: avoid; font-size: 10.5pt; line-height: 1.4; }
.uso h2 { font-size: 12.5pt; margin-bottom: 4px; }
.uso ul { list-style: none; padding: 0; margin: 6px 0 0; display: grid; grid-template-columns: 1fr 1fr; gap: 4px 14px; font-size: 10pt; }
.rotulo { display: inline-block; font-size: 8.5pt; font-weight: 700; letter-spacing: .05em; text-transform: uppercase; border-radius: 4px; padding: 1px 8px; color: #fff; white-space: nowrap; }
.r-explora { background: var(--verde); } .r-aprende { background: #8a6a00; } .r-practica { background: #1f2937; } .r-entrega { background: var(--rojo); }
.guia { break-before: page; }
.enc { border-left: 6px solid var(--oro); padding: 2px 0 2px 12px; margin-bottom: 12px; }
.producto { background: var(--verde-t); border: 1.5px dashed var(--verde); border-radius: 8px; padding: 8px 14px; margin: 4px 0 14px; break-inside: avoid; }
.semana { break-before: page; }
.semana.primera { break-before: auto; }
.semana > h2 { background: var(--verde); color: #fff; border-radius: 6px; padding: 5px 14px; }
.paso { margin-bottom: 14px; padding: 8px 12px 10px; border-radius: 8px; border: 1px solid #e5e7eb; break-inside: avoid; }
.paso:nth-of-type(even) { background: var(--gris-t); }
.paso.parcial { border: 2px solid var(--rojo); background: var(--rojo-t); }
.paso-cab { display: flex; align-items: center; gap: 8px; margin-bottom: 4px; }
.num { background: var(--verde); color: #fff; border-radius: 50%; min-width: 1.8em; height: 1.8em; display: inline-flex; align-items: center; justify-content: center; font-size: 10pt; font-weight: 700; }
.paso-cab h3 { margin: 0; flex: 1; }
.tiempo { font-size: 9pt; color: #4b5563; white-space: nowrap; }
.paso ol { margin: 4px 0 6px 22px; padding: 0; } .paso li { margin-bottom: 4px; padding-left: 2px; }
.lectura { border-left: 4px solid var(--oro); background: #fff; padding: 6px 10px; border-radius: 0 6px 6px 0; }
.lineas { border: 1.5px solid #6b7280; border-radius: 6px; margin: 4px 0; background-color: #fff;
  background-image: repeating-linear-gradient(to bottom, transparent 0, transparent calc(0.95cm - 1px), #9ca3af calc(0.95cm - 1px), #9ca3af 0.95cm); }
.hice { display: flex; justify-content: space-between; font-size: 10pt; margin-top: 6px; color: #374151; }
.chequeo { list-style: none; padding: 0; margin: 4px 0 0; } .chequeo li { margin-bottom: 3px; }
.entrega { border: 2px solid var(--rojo); border-radius: 8px; padding: 0 0 8px; margin-top: 10px; background: #fff; break-inside: avoid; }
.entrega .banda { background: var(--rojo); color: #fff; font: 700 10pt 'Poppins', Arial, sans-serif; padding: 3px 12px; border-radius: 5px 5px 0 0; margin-bottom: 6px; }
.entrega p, .entrega ul { margin-left: 12px; margin-right: 12px; }
.entregas { break-before: page; }
.tabla { width: 100%; border-collapse: collapse; margin: 6px 0 14px; font-size: 10.5pt; }
.tabla th, .tabla td { border: 1px solid #9ca3af; padding: 5px 8px; text-align: left; vertical-align: top; }
.tabla th { background: var(--verde); color: #fff; }
.tabla tr:nth-child(even) td { background: var(--gris-t); }
.preg { margin-bottom: 10px; break-inside: avoid; }
`;

const CANAL_DEFECTO = 'En físico al docente, o por medio del acudiente en coordinación con el docente';

/** Caja con renglones: unos 3 por momento de trabajo (entre 3 y 12). */
const lineasCaja = (momentos: number) => {
  const n = Math.max(3, Math.min(12, (Math.round(momentos) || 1) * 3));
  return `<div class="lineas" style="height:${(n * 0.95).toFixed(2)}cm"></div>`;
};

type Rol = 'explora' | 'aprende' | 'practica' | 'entrega';
const ROLES: Record<Rol, { icono: string; texto: string }> = {
  explora: { icono: '🔎', texto: 'Explora' }, aprende: { icono: '📖', texto: 'Aprende' },
  practica: { icono: '✏️', texto: 'Practica' }, entrega: { icono: '📦', texto: 'Entrega' },
};
/** Rol visual del paso según los datos que ya tiene (no se inventa contenido). */
const rolPaso = (p: PasoGuia, esPrimero: boolean, esEntrega: boolean): Rol =>
  esEntrega ? 'entrega' : p.lectura ? 'aprende' : esPrimero ? 'explora' : 'practica';

function textoPaso(p: PasoGuia, n: number, rol: Rol, esEntrega: boolean): string {
  const subs = subpasos(p.instrucciones);
  const cuerpo = subs.length > 1
    ? `<ol>${subs.map(s => `<li>${esc(s)}</li>`).join('')}</ol>`
    : `<p class="contenido">${esc(subs[0] ?? p.instrucciones)}</p>`;
  const r = ROLES[rol];
  return `<div class="paso${esEntrega ? ' parcial' : ''}">
    <div class="paso-cab"><span class="num">${n}</span><h3>${esc(p.titulo)}</h3><span class="rotulo r-${rol}">${r.icono} ${r.texto}</span><span class="tiempo">⏱ ${esc(p.momentos)} ${p.momentos === 1 ? 'momento' : 'momentos'}</span></div>
    ${p.lectura ? `<p class="etq">Lectura de este paso:</p><p class="contenido lectura">${esc(p.lectura)}</p>` : ''}
    ${cuerpo}
    <p class="etq">Escribe tu respuesta aquí (usa tu cuaderno si necesitas más espacio):</p>
    ${lineasCaja(p.momentos)}
    <div class="hice"><span>☐ Lo hice</span><span>Fecha: ____ / ____ / ________</span></div>
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
      ${pasos.map((p, k) => textoPaso(p, k + 1, rolPaso(p, k === 0, p === entrega), p === entrega)).join('')}
      ${entrega ? `<div class="entrega"><div class="banda">${ROLES.entrega.icono} Qué entregas esta semana</div>
        <p><b>Entrega de la semana:</b> ${esc(entrega.evidenciaDetalle || entrega.titulo)}</p>
        ${listaComponentes(entrega, nombres)}
        <p><b>Cómo entregarla:</b> en papel (hoja o cuaderno). ${esc(entrega.canalEntrega || CANAL_DEFECTO)}.</p>
      </div>` : ''}
    </div>`;
  };
  return `<section class="guia">
  ${membrete()}<div class="enc"><h1>${esc(t.texto)}</h1></div>
  <h3>🎯 Lo que vas a construir</h3>
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
    return `<div class="preg"><h3>🗣️ Sustentación: ${esc(tituloGuia(g, nombres).areas.join(' · '))}</h3>
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
  const materias = items.map(({ g }) => {
    const docentes = [...new Set(g.asignaturaIds.map(id => nombres[id]?.docente).filter(Boolean))].join(', ');
    return `<tr><td><b>${esc(tituloGuia(g, nombres).texto)}</b></td><td>${esc(docentes)}</td></tr>`;
  }).join('');
  const portada = `<section class="portada"><img class="escudo" src="${ESCUDO()}" alt="Escudo MJB"><div class="inst">Institución Educativa Manuel J. Betancur</div><h1>Plan Académico Especial</h1><p class="sub">Cuadernillo de trabajo</p>
    <div class="quien">${primer}</div><p>Grupo ${esc(plan.grupo)}</p>
    <p class="fechas">Del ${esc(fecha(plan.desde))} al ${esc(fecha(plan.hasta))}</p>
    <table class="materias">${materias}</table>
    <div class="bienvenida"><b>¡Hola, ${primer}!</b> Este cuadernillo es tu guía para aprender con calma. Ve paso a paso, a tu ritmo, y celebra cada casilla que marques: cada paso te acerca a tu meta.</div>
    <div class="uso"><h2>Cómo usar este cuadernillo</h2>
    <p>Cada <b>momento</b> es un tiempo de trabajo de 25 minutos. Trabaja máximo <b>${esc(tope)} momentos al día</b>, ${esc(ritmo)}.</p>
    <p>Hay una sección por asignatura. Sigue los pasos en orden, un paso a la vez, y escribe tus respuestas en los espacios con renglones; si necesitas más espacio usa tu cuaderno.</p>
    <p>Cada semana hay una entrega. Las entregas se hacen <b>en papel</b>: en físico al docente, o por medio de tu acudiente en coordinación con el docente. Al final del cuadernillo está la lista de entregas y las preguntas de la sustentación, que es presencial u oral.</p>
    <ul><li><span class="rotulo r-explora">🔎 Explora</span> mira de qué trata</li><li><span class="rotulo r-aprende">📖 Aprende</span> lee con atención</li><li><span class="rotulo r-practica">✏️ Practica</span> haz la actividad</li><li><span class="rotulo r-entrega">📦 Entrega</span> lo que llevas al docente</li><li>☐ Lo hice: marca al terminar</li><li>⏱ Momento: 25 minutos</li></ul></div>
    <p class="etq">San Antonio de Prado · Medellín</p></section>`;
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Cuadernillo - Plan Académico Especial</title>${FUENTES}<style>${CSS}</style></head><body>${portada}${items.map(({ g, guia }) => seccionGuia(g, guia, nombres)).join('')}${seccionEntregas(items, nombres)}</body></html>`;
}

/** Misma mecánica de impresión que el formato UAI (ventana nueva; marco oculto si la bloquean). */
export function abrirImprimibleGuia(html: string): void { abrirImprimibleUAI(html); }
