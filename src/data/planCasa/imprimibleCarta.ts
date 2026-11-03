// Carta para la familia: entrega del Plan de Apoyo Académico Especial en papel membreteado.
// Lógica pura (construye el HTML). NUNCA incluye motivo, diagnóstico ni datos de salud:
// solo nombre, grupo, periodo, enlace y QR.
import { esc } from '../simulacros/imprimirGuion';
import { rutaEscudo, abrirImprimibleGuia } from './imprimibleGuia';
import type { FechaISO, PlanCasa } from './tipos';

/** Campos mínimos del plan que usa la carta (sin motivo ni ajustes). */
export type PlanParaCarta = Pick<PlanCasa, 'nombres' | 'apellidos' | 'grupo' | 'desde' | 'hasta'> & { sinTecnologia?: boolean };

export interface EntradaCarta {
  plan: PlanParaCarta;
  /** Enlace público de la agenda (urlPublica(token)). */
  url: string;
  /** QR ya generado como data URL; si falta, solo se imprime el enlace. */
  qr?: string;
}

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

function fechaLarga(f: FechaISO | Date): string {
  if (f instanceof Date) return `${f.getDate()} de ${MESES[f.getMonth()]} de ${f.getFullYear()}`;
  const [y, m, d] = f.split('-').map(Number);
  return `${d} de ${MESES[m - 1]} de ${y}`;
}

const CSS = `
@page { size: letter; margin: 0; }
* { box-sizing: border-box; }
body { font-family: Arial, Helvetica, sans-serif; color: #1a1a1a; font-size: 13px; line-height: 1.5; margin: 0; }
.carta { width: 21.59cm; height: 27.94cm; padding: 1.2cm 1.8cm 0; position: relative; page-break-after: always; overflow: hidden; }
.carta:last-child { page-break-after: auto; }
.enc { display: flex; align-items: center; gap: 12px; border-bottom: 2px solid #1d4e89; padding-bottom: 8px; margin-bottom: 12px; }
.enc img { width: 62px; height: 62px; object-fit: contain; }
.enc b { font-size: 15px; color: #1d4e89; }
.enc span { color: #555; font-size: 10.5px; }
h1 { font-size: 18px; text-align: center; margin: 14px 0 14px; color: #1d4e89; }
h2 { font-size: 14px; margin: 14px 0 5px; color: #1d4e89; }
p { margin: 3px 0; }
ol { margin: 2px 0 2px 18px; padding: 0; }
li { margin: 1px 0; }
.cols { display: flex; gap: 14px; }
.cols > div { flex: 1; }
.qr { text-align: center; margin-top: 6px; }
.qr img { width: 4.6cm; height: 4.6cm; }
.url { word-break: break-all; font-family: Consolas, monospace; font-size: 10px; background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 4px; padding: 3px 6px; margin-top: 3px; }
.nota { border: 1px solid #1d4e89; border-radius: 4px; padding: 5px 8px; margin: 8px 0; background: #eef4fb; }
.firmas { display: flex; gap: 30px; margin-top: 56px; text-align: center; }
.firmas div { flex: 1; border-top: 1px solid #333; padding-top: 3px; }
.desprendible { position: absolute; left: 1.8cm; right: 1.8cm; bottom: 2.3cm; border-top: 1.5px dashed #666; padding-top: 5px; font-size: 10.5px; }
.pie { position: absolute; left: 0; right: 0; bottom: 0; background: #1d4e89; color: #fff; text-align: center; font-size: 9px; padding: 6px 1cm; line-height: 1.35; }
@media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
`;

function paginaCarta(e: EntradaCarta, hoy: Date): string {
  const { plan, url, qr } = e;
  const nombre = `${plan.nombres} ${plan.apellidos}`.replace(/\s+/g, ' ').trim();
  const primero = esc(plan.nombres.trim().split(/\s+/)[0] ?? '');
  const sinTec = plan.sinTecnologia
    ? `<div class="nota"><b>Importante:</b> además del enlace, ${primero} recibirá el <b>cuadernillo impreso</b> con las guías, para trabajar y entregar en papel.</div>`
    : '';
  return `<section class="carta">
<div class="enc"><img src="${esc(rutaEscudo())}" alt=""><div><b>Institución Educativa Manuel J. Betancur</b><br><span>Plan Académico Especial</span></div></div>
<p style="text-align:right">Medellín, ${esc(fechaLarga(hoy))}</p>
<p><b>Señores padres de familia / acudientes de ${esc(nombre)}</b><br>Grado ${esc(plan.grupo)}</p>
<h1>Entrega del Plan de Apoyo Académico Especial</h1>
<p>Reciban un cordial saludo. Con mucho gusto les entregamos el plan de apoyo académico que el colegio preparó para acompañar a ${primero} del <b>${esc(fechaLarga(plan.desde))}</b> al <b>${esc(fechaLarga(plan.hasta))}</b>. Es una ruta de trabajo sencilla, organizada por días, para que el estudiante avance con tranquilidad y con su ayuda.</p>
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
<div class="nota">El enlace <b>no pide contraseña</b>: es personal de ${primero}. Por favor <b>no lo comparta</b> con otras personas.</div>
${sinTec}
<p>Gracias por su apoyo y compromiso. Si tienen dudas, pueden acercarse al colegio.</p>
<p>Atentamente,</p>
<div class="firmas"><div>Coordinación académica</div><div>Equipo de apoyo (UAI y Orientación)</div></div>
<div class="desprendible">✂ <b>Recibí</b> la carta y el enlace del plan de ${esc(nombre)} (${esc(plan.grupo)}).<br><br>Nombre: ______________________________ Firma: ______________________ Fecha: ____________</div>
<div class="pie">FORMAMOS PARA LA VIDA, LA CIENCIA Y LA CULTURA<br>www.iemanueljbetancur.edu.co · ie.manueljbetancur@medellin.gov.co · Tel 2861722 sede principal<br>Carrera 81 Nº 43 Sur 38 San Antonio de Prado – Medellín</div>
</section>`;
}

/** Arma el documento con una carta por página. Devuelve '' si no hay entradas. */
export function construirHtmlCartas(entradas: EntradaCarta[], hoy: Date = new Date()): string {
  if (entradas.length === 0) return '';
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Entrega del Plan de Apoyo Académico Especial</title><style>${CSS}</style></head><body>${entradas.map(e => paginaCarta(e, hoy)).join('')}</body></html>`;
}

/** Abre las cartas en ventana nueva lista para imprimir. */
export function abrirCartas(html: string): void { abrirImprimibleGuia(html); }
