// Carta para la familia: entrega del Plan de Apoyo Académico Especial en papel membreteado.
// Lógica pura (construye el HTML). NUNCA incluye motivo, diagnóstico ni datos de salud:
// solo nombre, grupo, periodo, enlace y QR. También la planilla de entrega (firmas de recibido).
import { esc } from '../simulacros/imprimirGuion';
import { rutaEscudo, abrirImprimibleGuia } from './imprimibleGuia';
import { jornadaDePlan } from './avanceDocentes';
import { textoEntre } from './ventanaSustentacion';
import type { FechaISO, PlanCasa } from './tipos';

/** Campos mínimos del plan que usa la carta (sin motivo ni ajustes). */
export type PlanParaCarta = Pick<PlanCasa, 'nombres' | 'apellidos' | 'grupo' | 'desde' | 'hasta'> & { sinTecnologia?: boolean };

export interface EntradaCarta {
  plan: PlanParaCarta;
  /** Enlace público de la agenda (urlPublica(token)). */
  url: string;
  /** QR ya generado como data URL; si falta, solo se imprime el enlace. */
  qr?: string;
  /** Datos del acudiente de la ficha del estudiante (asistenciaStudents); opcionales. */
  acudiente?: string;
  parentesco?: string;
}

/** Coordinación de cada jornada: firma única de la carta y de la planilla. */
export const COORDINADORES: Record<'manana' | 'tarde', { nombre: string; cargo: string }> = {
  manana: { nombre: 'Janneth Astrid Ocampo Carvajal', cargo: 'Coordinadora' },
  tarde: { nombre: 'Juan Diego Salazar Rendón', cargo: 'Coordinador' },
};

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

function fechaLarga(f: FechaISO | Date): string {
  if (f instanceof Date) return `${f.getDate()} de ${MESES[f.getMonth()]} de ${f.getFullYear()}`;
  const [y, m, d] = f.split('-').map(Number);
  return `${d} de ${MESES[m - 1]} de ${y}`;
}

function nombreCompleto(p: { nombres: string; apellidos: string }): string {
  return `${p.nombres} ${p.apellidos}`.replace(/\s+/g, ' ').trim();
}

const PIE = `<div class="pie">FORMAMOS PARA LA VIDA, LA CIENCIA Y LA CULTURA<br>www.iemanueljbetancur.edu.co · ie.manueljbetancur@medellin.gov.co · Cel. 300 452 1901<br>Carrera 81 Nº 43 Sur 38 San Antonio de Prado – Medellín</div>`;

const CSS = `
@page { size: letter; margin: 0; }
* { box-sizing: border-box; }
body { font-family: Arial, Helvetica, sans-serif; color: #1a1a1a; font-size: 14px; line-height: 1.5; margin: 0; }
.carta { width: 21.59cm; height: 27.94cm; padding: 1.2cm 1.8cm 0; position: relative; page-break-after: always; overflow: hidden; }
.carta:last-child { page-break-after: auto; }
.enc { display: flex; align-items: center; gap: 12px; border-bottom: 2px solid #1e5631; padding-bottom: 8px; margin-bottom: 12px; }
.enc img { width: 62px; height: 62px; object-fit: contain; }
.enc b { font-size: 15px; color: #1e5631; }
.enc span { color: #555; font-size: 10.5px; }
h1 { font-size: 20px; text-align: center; margin: 18px 0 14px; color: #1e5631; }
h2 { font-size: 15px; margin: 14px 0 6px; color: #1e5631; }
p { margin: 4px 0; }
ol { margin: 2px 0 2px 18px; padding: 0; }
li { margin: 2px 0; }
.cols { display: flex; gap: 14px; }
.cols > div { flex: 1; }
.qr { text-align: center; margin-top: 6px; }
.qr img { width: 5.2cm; height: 5.2cm; }
.url { word-break: break-all; font-family: Consolas, monospace; font-size: 10px; background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 4px; padding: 3px 6px; margin-top: 3px; }
.nota { border: 1px solid #1e5631; border-radius: 4px; padding: 8px 11px; margin: 12px 0; background: #eef4fb; }
.firma { width: 8cm; margin: 0.9cm auto 0; border-top: 1px solid #333; padding-top: 4px; text-align: center; }
.pie { position: absolute; left: 0; right: 0; bottom: 0; background: #1e5631; color: #fff; text-align: center; font-size: 9px; padding: 6px 1cm; line-height: 1.35; }
@media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
`;

/** Tratamiento según el parentesco registrado (no se deduce del nombre). */
export function tratamiento(parentesco: string): string {
  const p = parentesco.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  if (/\b(madre|mama|abuela|tia|hermana|madrastra|prima|madrina)\b/.test(p)) return 'Señora';
  if (/\b(padre|papa|abuelo|tio|hermano|padrastro|primo|padrino)\b/.test(p)) return 'Señor';
  return 'Señor(a)';
}

/** La carta cuenta el plan desde el día en que se entrega a la familia, si es posterior al inicio. */
export function inicioCarta(desde: FechaISO, hoy: Date): FechaISO {
  const h = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`;
  return (h > desde ? h : desde) as FechaISO;
}

function paginaCarta(e: EntradaCarta, hoy: Date): string {
  const { plan, url, qr } = e;
  const nombre = nombreCompleto(plan);
  const primero = esc(plan.nombres.trim().split(/\s+/)[0] ?? '');
  const coord = COORDINADORES[jornadaDePlan(plan.grupo)];
  const acu = (e.acudiente ?? '').replace(/\s+/g, ' ').trim();
  const par = (e.parentesco ?? '').replace(/\s+/g, ' ').trim().toLowerCase();
  const destinatario = acu
    ? `${tratamiento(par)} ${esc(acu)}`
    : `Señores padres de familia / acudientes de ${esc(nombre)}`;
  const sinTec = plan.sinTecnologia
    ? `<div class="nota"><b>Importante:</b> además del enlace, ${primero} recibirá el <b>cuadernillo impreso</b> con las guías, para trabajar y entregar en papel.</div>`
    : '';
  return `<section class="carta">
<div class="enc"><img src="${esc(rutaEscudo())}" alt=""><div><b>Institución Educativa Manuel J. Betancur</b><br><span>Plan Académico Especial</span></div></div>
<p style="text-align:right">Medellín, ${esc(fechaLarga(hoy))}</p>
<p><b>${destinatario}</b><br>Estudiante: ${esc(nombre)}, grado ${esc(plan.grupo)}</p>
<h1>Entrega del Plan de Apoyo Académico Especial</h1>
<p>Reciban un cordial saludo. Con mucho gusto les entregamos el plan de apoyo académico que el colegio preparó para acompañar a ${esc(nombre)} del <b>${esc(fechaLarga(inicioCarta(plan.desde, hoy)))}</b> al <b>${esc(fechaLarga(plan.hasta))}</b>. Es una ruta de trabajo sencilla, organizada por días, para que el estudiante avance con tranquilidad y con su ayuda. ${esc(textoEntre().replace('Entre el', 'Las sustentaciones de las guías serán entre el'))}; la fecha y hora exactas aparecerán en la agenda.</p>
<p>En la <b>agenda</b> encontrarán: las <b>guías</b> de cada asignatura, <b>qué hacer cada día</b>, las <b>fechas de entrega</b> y los <b>comentarios de los docentes</b> sobre el trabajo realizado.</p>
<div class="cols">
<div>
<h2>Cómo abrir la agenda en el celular</h2>
<ol>
<li>Abra la <b>cámara</b> del celular.</li>
<li>Apunte al <b>código QR</b> de esta carta.</li>
<li>Toque el <b>enlace</b> que aparece en pantalla.</li>
<li>Para tenerla a mano, guárdela en la pantalla de inicio: <b>Android:</b> «⋮ → Agregar a pantalla de inicio». <b>iPhone:</b> «Compartir → Agregar a inicio».</li>
</ol>
<h2>Cómo abrirla en el computador</h2>
<ol>
<li>Escriba en el navegador la <b>dirección</b> impresa debajo del QR.</li>
<li>Guárdela en <b>favoritos</b> para volver fácilmente.</li>
</ol>
</div>
<div class="qr">
${qr ? `<img src="${esc(qr)}" alt="Código QR de la agenda">` : ''}
<div class="url">${esc(url)}</div>
</div>
</div>
<div class="nota">El enlace <b>no pide contraseña</b>: es personal de ${esc(nombre)}. Por favor <b>no lo comparta</b> con otras personas.</div>
${sinTec}
<p>Gracias por su apoyo y compromiso. Si tienen dudas, pueden acercarse al colegio.</p>
<p>Atentamente,</p>
<div class="firma"><b>${esc(coord.nombre)}</b><br>${esc(coord.cargo)}</div>
${PIE}
</section>`;
}

/** Arma el documento con una carta por página. Devuelve '' si no hay entradas. */
export function construirHtmlCartas(entradas: EntradaCarta[], hoy: Date = new Date()): string {
  if (entradas.length === 0) return '';
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Entrega del Plan de Apoyo Académico Especial</title><style>${CSS}</style></head><body>${entradas.map(e => paginaCarta(e, hoy)).join('')}</body></html>`;
}

/** Abre las cartas en ventana nueva lista para imprimir. */
export function abrirCartas(html: string): void { abrirImprimibleGuia(html); }

// ── Planilla de entrega ───────────────────────────────────────────────────

export interface EntradaPlanilla {
  plan: Pick<PlanCasa, 'nombres' | 'apellidos' | 'grupo'>;
  acudiente?: string;
}

const FILAS_POR_PAGINA = 16;

const CSS_PLANILLA = `
.planilla { width: 21.59cm; height: 27.94cm; padding: 1.2cm 1.2cm 0; position: relative; page-break-after: always; overflow: hidden; }
.planilla:last-child { page-break-after: auto; }
.planilla .enc { margin-bottom: 8px; }
.planilla h1 { margin: 6px 0; font-size: 16px; }
.meta { display: flex; justify-content: space-between; font-size: 11.5px; margin-bottom: 8px; }
table.pl { width: 100%; border-collapse: collapse; table-layout: fixed; font-size: 9.5px; line-height: 1.25; }
table.pl th { background: #eef4fb; color: #1e5631; border: 1px solid #555; padding: 3px 2px; text-align: center; }
table.pl td { border: 1px solid #555; height: 1.05cm; padding: 1px 3px; vertical-align: middle; overflow: hidden; }
table.pl td.c { text-align: center; }
.firma-pl { position: absolute; left: 1.2cm; bottom: 1.9cm; width: 8cm; border-top: 1px solid #333; padding-top: 3px; text-align: center; font-size: 11px; }
`;

function paginasPlanilla(jornada: 'manana' | 'tarde', filas: EntradaPlanilla[], hoy: Date): string {
  const coord = COORDINADORES[jornada];
  const orden = [...filas].sort((a, b) =>
    a.plan.grupo.localeCompare(b.plan.grupo, 'es', { numeric: true }) ||
    a.plan.apellidos.localeCompare(b.plan.apellidos, 'es') || a.plan.nombres.localeCompare(b.plan.nombres, 'es'));
  const trozos: EntradaPlanilla[][] = [];
  for (let i = 0; i < orden.length; i += FILAS_POR_PAGINA) trozos.push(orden.slice(i, i + FILAS_POR_PAGINA));
  return trozos.map((trozo, k) => `<section class="planilla">
<div class="enc"><img src="${esc(rutaEscudo())}" alt=""><div><b>Institución Educativa Manuel J. Betancur</b><br><span>Plan Académico Especial</span></div></div>
<h1>Planilla de entrega de planes académicos especiales</h1>
<div class="meta"><span><b>Jornada:</b> ${jornada === 'manana' ? 'Mañana' : 'Tarde'}</span><span><b>${esc(coord.cargo)}:</b> ${esc(coord.nombre)}</span><span><b>Fecha:</b> ${esc(fechaLarga(hoy))}</span></div>
<table class="pl"><colgroup><col style="width:0.8cm"><col style="width:4.2cm"><col style="width:1.3cm"><col style="width:3cm"><col style="width:3cm"><col style="width:1.9cm"><col style="width:3.2cm"><col style="width:1.8cm"></colgroup>
<thead><tr><th>N.º</th><th>Estudiante</th><th>Grupo</th><th>Acudiente</th><th>Nombre de quien recibe</th><th>Parentesco</th><th>Firma</th><th>Fecha</th></tr></thead>
<tbody>${trozo.map((f, i) => `<tr><td class="c">${k * FILAS_POR_PAGINA + i + 1}</td><td>${esc(nombreCompleto(f.plan))}</td><td class="c">${esc(f.plan.grupo)}</td><td>${esc(f.acudiente ?? '')}</td><td></td><td></td><td></td><td></td></tr>`).join('')}</tbody></table>
${k === trozos.length - 1 ? `<div class="firma-pl"><b>${esc(coord.nombre)}</b><br>${esc(coord.cargo)}</div>` : ''}
${PIE}
</section>`).join('');
}

/** Planilla de firmas de recibido: páginas por jornada (mañana primero), ordenadas por grupo y apellido. */
export function construirHtmlPlanilla(entradas: EntradaPlanilla[], hoy: Date = new Date()): string {
  if (entradas.length === 0) return '';
  const cuerpo = (['manana', 'tarde'] as const)
    .map(j => paginasPlanilla(j, entradas.filter(e => jornadaDePlan(e.plan.grupo) === j), hoy)).join('');
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Planilla de entrega de planes académicos especiales</title><style>${CSS}${CSS_PLANILLA}</style></head><body>${cuerpo}</body></html>`;
}

export function abrirPlanilla(html: string): void { abrirImprimibleGuia(html); }
