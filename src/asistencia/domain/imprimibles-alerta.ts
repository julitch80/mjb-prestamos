/**
 * Imprimibles de la alerta academica — HTML puro, 4 por hoja carta (Julian, 2026-10-02).
 *
 *  - INFORME INDIVIDUAL: las asignaturas en alerta de un estudiante, con la firma del
 *    director de grupo. Se entrega EN PERSONA el dia de la entrega; no va a la casa.
 *  - CITACION: al acudiente de quien tiene dos o mas. Motivo GENERICO, sin asignaturas.
 *
 * Es una funcion pura que devuelve el documento completo: la usa la app (ventana de
 * impresion → imprimir o «Guardar como PDF») y tambien el ejemplo ficticio para revisar el
 * formato sin datos reales. Todo texto que viene de datos pasa por `esc`.
 */

export interface DatosInstitucion {
  /** URL del escudo oficial (recortado del membrete). */
  escudoUrl: string;
  sede: string;
}

export interface InformeAlerta {
  estudiante: string;
  grado: string;
  periodo: number;
  anio: number;
  director: string;
  /** Nombres completos de las asignaturas en alerta. */
  asignaturas: string[];
  /** 'DD/MM/AAAA' */
  fechaExpedicion: string;
}

export interface CitacionAlerta {
  estudiante: string;
  grado: string;
  director: string;
  /** Ya legible: «jueves 22 de octubre de 2026». */
  fecha: string;
  /** Ya legible: «7:22 a. m.». */
  hora: string;
  /** En reunion general con otros acudientes. */
  general: boolean;
  motivo: string;
}

const esc = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

/** 'YYYY-MM-DD' → «jueves 22 de octubre de 2026». */
export function fechaLarga(iso: string): string {
  const [a, m, d] = iso.split('-').map(Number);
  const f = new Date(a, m - 1, d);
  return `${DIAS[f.getDay()]} ${d} de ${MESES[m - 1]} de ${a}`;
}

/** 'HH:MM' → «7:22 a. m.» / «1:05 p. m.». */
export function horaLegible(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number);
  const sufijo = h < 12 ? 'a. m.' : 'p. m.';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${sufijo}`;
}

function encabezado(inst: DatosInstitucion, titulo: string, subtitulo: string): string {
  return `<header class="enc">
    <img src="${esc(inst.escudoUrl)}" alt="">
    <div>
      <p class="ie">INSTITUCIÓN EDUCATIVA MANUEL J. BETANCUR</p>
      <p class="tit">${esc(titulo)}</p>
      <p class="sub">${esc(subtitulo)}</p>
    </div>
  </header>`;
}

function firma(director: string): string {
  return `<div class="firma"><div class="linea"></div><p>${esc(director)}</p><p class="cargo">Director(a) de grupo</p></div>`;
}

function informe(inst: DatosInstitucion, i: InformeAlerta): string {
  const lista = i.asignaturas.map((a) => `<li>${esc(a)}</li>`).join('');
  return `<article class="tarjeta">
    ${encabezado(inst, 'Informe de alerta académica', `Periodo ${i.periodo} · ${i.anio}`)}
    <dl class="datos">
      <dt>Estudiante</dt><dd class="nombre">${esc(i.estudiante)}</dd>
      <dt>Grupo</dt><dd>${esc(i.grado)}</dd>
    </dl>
    <p class="etq">Asignaturas en alerta (${i.asignaturas.length})</p>
    <ul class="asig ${i.asignaturas.length > 6 ? 'dos' : ''}">${lista}</ul>
    <p class="nota">Expedido el ${esc(i.fechaExpedicion)}. Se entrega personalmente al acudiente.</p>
    ${firma(i.director)}
  </article>`;
}

function citacion(inst: DatosInstitucion, c: CitacionAlerta): string {
  return `<article class="tarjeta">
    ${encabezado(inst, 'Citación a acudiente', `Sede ${inst.sede}`)}
    <p class="cuerpo">Señor(a) acudiente de</p>
    <p class="nombre grande">${esc(c.estudiante)}</p>
    <p class="cuerpo">del grupo <b>${esc(c.grado)}</b>: le citamos a la Institución el</p>
    <p class="cuando"><b>${esc(c.fecha)}</b><br>a las <b>${esc(c.hora)}</b>${c.general ? ' · reunión general de acudientes' : ''}</p>
    <p class="cuerpo"><b>Motivo:</b> ${esc(c.motivo)}.</p>
    <p class="cuerpo">Su asistencia es muy importante para acompañar el proceso del estudiante.</p>
    <p class="lic">Su asistencia es <b>obligatoria</b> por requerimiento de la institución. Esta citación sirve como soporte para solicitar la licencia remunerada para obligaciones escolares como acudiente (Código Sustantivo del Trabajo, art. 57, num. 6, lit. f, modificado por la Ley 2466 de 2025).</p>
    ${firma(c.director)}
  </article>`;
}

/** Paginas de 4 tarjetas (2×2) con guias de corte. */
function paginas(tarjetas: string[]): string {
  const hojas: string[] = [];
  for (let i = 0; i < tarjetas.length; i += 4) {
    const grupo = tarjetas.slice(i, i + 4);
    while (grupo.length < 4) grupo.push('<article class="tarjeta vacia"></article>');
    hojas.push(`<section class="hoja">${grupo.join('')}</section>`);
  }
  return hojas.join('');
}

const CSS = `
@page { size: letter; margin: 0; }
* { box-sizing: border-box; }
body { margin: 0; background: #525659; font-family: Arial, Helvetica, sans-serif; color: #111; }
.hoja { width: 215.9mm; height: 279.4mm; margin: 8mm auto; background: #fff; display: grid;
  grid-template-columns: 1fr 1fr; grid-template-rows: 1fr 1fr; page-break-after: always; break-after: page;
  position: relative; overflow: hidden; }
.hoja::before, .hoja::after { content: ''; position: absolute; border: 0 dashed #9a9a9a; }
.hoja::before { left: 50%; top: 0; bottom: 0; border-left-width: 1px; }
.hoja::after { top: 50%; left: 0; right: 0; border-top-width: 1px; }
.tarjeta { padding: 8mm 9mm; display: flex; flex-direction: column; gap: 2.2mm; overflow: hidden; }
.enc { display: flex; gap: 3mm; align-items: center; border-bottom: 0.6mm solid #b3122a; padding-bottom: 2mm; }
.enc img { width: 15mm; height: 15mm; object-fit: contain; }
.enc p { margin: 0; }
.ie { font-size: 7.6pt; font-weight: 700; letter-spacing: .02em; }
.tit { font-size: 11.5pt; font-weight: 700; margin-top: .6mm !important; }
.sub { font-size: 8pt; color: #444; }
.datos { display: grid; grid-template-columns: auto 1fr; gap: .8mm 3mm; margin: 1mm 0 0; font-size: 9pt; }
.datos dt { color: #555; } .datos dd { margin: 0; }
.nombre { font-weight: 700; text-transform: uppercase; }
.nombre.grande { font-size: 11pt; margin: 0; }
.etq { margin: 1mm 0 0; font-size: 8.5pt; font-weight: 700; color: #b3122a; text-transform: uppercase; letter-spacing: .03em; }
.asig { margin: 0; padding-left: 5mm; font-size: 9.5pt; line-height: 1.45; }
.asig.dos { columns: 2; column-gap: 6mm; font-size: 8.8pt; }
.nota { margin: 1.5mm 0 0; font-size: 7.5pt; color: #555; }
/* Licencia laboral (CST 57-6-f, Ley 2466 de 2025): que el acudiente que trabaja pueda pedir el permiso. */
.lic { margin: 0; font-size: 7.4pt; line-height: 1.35; color: #333; border-top: 0.2mm dashed #999; padding-top: 1.5mm; }
.cuerpo { margin: 0; font-size: 9.5pt; line-height: 1.4; }
.cuando { margin: 1mm 0; font-size: 10.5pt; line-height: 1.45; padding: 2mm 3mm; border-left: 1mm solid #1f6f43; background: #f2f6f3; }
.firma { margin-top: auto; text-align: center; font-size: 8.5pt; }
.firma .linea { width: 55mm; margin: 9mm auto 1mm; border-top: 0.3mm solid #111; }
.firma p { margin: 0; } .firma .cargo { color: #555; font-size: 7.5pt; }
.solo-pantalla { max-width: 215.9mm; margin: 8mm auto 0; padding: 10px 14px; border-radius: 10px; background: #fff;
  font-size: 14px; display: flex; gap: 10px; align-items: center; }
.solo-pantalla button { padding: 8px 14px; border: 0; border-radius: 8px; background: #1a4a9a; color: #fff; font-weight: 700; cursor: pointer; }
@media print {
  body { background: #fff; }
  .hoja { margin: 0; }
  .solo-pantalla { display: none; }
  * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
}`;

function documento(titulo: string, cuerpo: string, resumen: string): string {
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${esc(titulo)}</title><style>${CSS}</style></head>
<body>
<div class="solo-pantalla"><b style="flex:1">${esc(titulo)} · ${esc(resumen)}</b>
<button onclick="window.print()">Imprimir o guardar como PDF</button></div>
${cuerpo}
</body></html>`;
}

export function htmlInformes(inst: DatosInstitucion, informes: InformeAlerta[], titulo = 'Informes de alerta académica'): string {
  return documento(titulo, paginas(informes.map((i) => informe(inst, i))), cuantasHojas(informes.length));
}

export function htmlCitaciones(inst: DatosInstitucion, citaciones: CitacionAlerta[], titulo = 'Citaciones a acudientes'): string {
  return documento(titulo, paginas(citaciones.map((c) => citacion(inst, c))), cuantasHojas(citaciones.length));
}

const cuantasHojas = (n: number) => `${n} en ${Math.ceil(n / 4)} hoja(s)`;

/**
 * TODO lo de una jornada en UN solo documento (Julian, 2026-10-03): la impresion la
 * centraliza coordinacion, que manda un solo archivo a biblioteca. Primero las citaciones
 * y despues los informes; cada bloque empieza en hoja nueva para separarlos al recortar.
 */
export function htmlParaImprimir(
  inst: DatosInstitucion,
  citaciones: CitacionAlerta[],
  informes: InformeAlerta[],
  titulo: string,
  planillas: PlanillaFirmas[] = [],
  constancias: { fecha: string; cuantas: number } | null = null,
): string {
  // Orden del archivo: citaciones (se reparten antes), informes y, al final, las planillas
  // de asistencia del dia de entrega, una por grupo.
  const cuerpo = paginas(citaciones.map((c) => citacion(inst, c))) + paginas(informes.map((i) => informe(inst, i)))
    + (planillas.length ? `<style>${CSS_PF}</style>` + planillas.map((p) => planillaFirmas(inst, p)).join('') : '')
    + (constancias && constancias.cuantas > 0
      ? `<style>${CSS_CS}</style>` + paginas(Array.from({ length: Math.ceil(constancias.cuantas / 4) * 4 }, () => constancia(inst, constancias.fecha)))
      : '');
  const nConst = constancias && constancias.cuantas > 0 ? Math.ceil(constancias.cuantas / 4) * 4 : 0;
  const hojas = Math.ceil(citaciones.length / 4) + Math.ceil(informes.length / 4) + planillas.length + nConst / 4;
  return documento(
    titulo,
    cuerpo,
    `${citaciones.length} citaciones, ${informes.length} informes, ${planillas.length} planillas de asistencia y ${nConst} constancias · ${hojas} hoja(s)`,
  );
}

// ── Planilla de firmas del dia de entrega ──────────────────────────────────────

export interface FilaPlanillaFirmas {
  estudiante: string;
  /** Asignaturas en alerta (0 = sin alerta; igual va en la lista: puede venir el acudiente). */
  alertas: number;
  /** Hora de la cita si esta citado (dos o mas alertas), ya legible. */
  horaCita: string | null;
}

export interface PlanillaFirmas {
  grado: string;
  periodo: number;
  anio: number;
  director: string;
  fecha: string;
  filas: FilaPlanillaFirmas[];
}

/**
 * La planilla que firman los acudientes el dia de la entrega (Julian, 2026-10-03): firma del
 * acudiente frente al nombre y su numero de contacto, como hoy, pero SOLO con los citados
 * —«para que tener nombres de estudiantes que no se citaron»—. El ORDEN (alfabetico o por
 * hora de citacion) lo elige coordinacion al descargar: las filas llegan ya ordenadas.
 * La firma en papel sigue siendo la prueba de la presencia del acudiente.
 */
function planillaFirmas(inst: DatosInstitucion, p: PlanillaFirmas): string {
  // Las filas llegan ya ordenadas (lo decide coordinacion); solo las de los citados.
  const citadas = p.filas.filter((f) => f.horaCita);
  const filas = citadas.map((f, i) =>
    `<tr><td class="pf-n">${i + 1}</td><td>${esc(f.estudiante)}</td><td class="pf-m"><span class="pf-cita">${esc(f.horaCita!)}</span> · ${f.alertas} asig.</td><td></td><td></td></tr>`);
  return `<section class="hoja pf">
    ${encabezado(inst, 'Entrega de alerta académica · registro de asistencia', `Grupo ${p.grado} · periodo ${p.periodo} · ${p.anio} · ${p.fecha}`)}
    <p class="pf-res">Director(a) de grupo: <b>${esc(p.director)}</b> · ${citadas.length} acudientes citados</p>
    <table class="pf-t">
      <thead><tr><th class="pf-n">N.º</th><th>Estudiante</th><th class="pf-m">Hora citada</th><th class="pf-f">Firma del acudiente</th><th class="pf-tel">Teléfono de contacto</th></tr></thead>
      <tbody>${filas.join('')}</tbody>
    </table>
    ${firma(p.director)}
  </section>`;
}

const CSS_PF = `
.hoja.pf { display: flex; flex-direction: column; padding: 12mm 12mm 10mm; gap: 2.5mm; }
.hoja.pf::before, .hoja.pf::after { display: none; }
.pf-res { margin: 0; font-size: 8.5pt; color: #333; }
.pf-t { width: 100%; border-collapse: collapse; font-size: 8.6pt; }
.pf-t th { text-align: left; font-size: 7.6pt; color: #444; border-bottom: 0.4mm solid #111; padding: 1mm 1.5mm; }
.pf-t td { border-bottom: 0.2mm solid #bbb; padding: 0 1.5mm; height: 9mm; }
.pf-n { width: 8mm; text-align: right; color: #555; }
.pf-m { width: 36mm; white-space: nowrap; }
.pf-f { width: 50mm; } .pf-tel { width: 34mm; }
.pf-citado td { background: #f7eef0; }
.pf-cita { font-weight: 700; color: #b3122a; font-size: 7.8pt; }
.pf-inf { color: #555; font-size: 7.8pt; }
.hoja.pf .firma .linea { margin-top: 6mm; }
`;

export function htmlPlanillasFirmas(inst: DatosInstitucion, planillas: PlanillaFirmas[], titulo = 'Planillas de asistencia'): string {
  return documento(titulo, `<style>${CSS_PF}</style>` + planillas.map((p) => planillaFirmas(inst, p)).join(''), `${planillas.length} planilla(s)`);
}

// ── Constancia de asistencia (preimpresa, generica) ────────────────────────────

/**
 * Constancia para el empleador del acudiente (Julian, 2026-10-03). Donde se entrega el
 * informe no hay como imprimir, asi que va PREIMPRESA y GENERICA en el archivo unico de
 * coordinacion: ya trae la institucion, el dia de la entrega, el motivo y la licencia
 * laboral; en coordinacion solo se llenan a mano nombre, documento, estudiante y horas, y se
 * firma. No necesita trazabilidad: es un soporte para el acudiente.
 */
function constancia(inst: DatosInstitucion, fecha: string | null, motivo = 'entrega de la alerta académica'): string {
  const linea = (w: string) => `<span class="cs-l" style="width:${w}"></span>`;
  return `<article class="tarjeta">
    ${encabezado(inst, 'Constancia de asistencia', `Sede ${inst.sede}`)}
    <p class="cs">La Institución Educativa Manuel J. Betancur hace constar que el (la) señor(a)
      ${linea('100%')}
      identificado(a) con documento N.º ${linea('38mm')}, acudiente del estudiante
      ${linea('100%')}
      del grupo ${linea('16mm')}, asistió a la institución el ${fecha ? `<b>${esc(fecha)}</b>` : linea('42mm')},
      de ${linea('16mm')} a ${linea('16mm')}, a la <b>${esc(motivo)}</b>, citación de asistencia obligatoria por requerimiento de la institución.</p>
    <p class="lic">Se expide como soporte de la licencia remunerada para obligaciones escolares como acudiente (Código Sustantivo del Trabajo, art. 57, num. 6, lit. f, modificado por la Ley 2466 de 2025).</p>
    <div class="firma"><div class="linea"></div><p>Firma y sello</p><p class="cargo">Coordinación</p></div>
  </article>`;
}

const CSS_CS = `
.cs { margin: 0; font-size: 9pt; line-height: 2.05; }
.cs-l { display: inline-block; border-bottom: 0.25mm solid #333; height: 3.6mm; vertical-align: baseline; }
`;

/** Hojas de constancias en blanco (4 por hoja) con el dia de la entrega ya impreso. */
export function htmlConstancias(inst: DatosInstitucion, fecha: string | null, cuantas: number, titulo = 'Constancias de asistencia'): string {
  const n = Math.max(4, Math.ceil(cuantas / 4) * 4);
  return documento(titulo, `<style>${CSS_CS}</style>` + paginas(Array.from({ length: n }, () => constancia(inst, fecha))), `${n} constancias en ${n / 4} hoja(s)`);
}

// ── Segunda citacion (seguimiento) ────────────────────────────────────────────

export interface CitacionSeguimiento {
  estudiante: string;
  grado: string;
  director: string;
  /** Ya legibles. */
  fechaEntrega: string;
  fecha: string;
  hora: string;
  /** Sin justificacion: lleva el fundamento normativo verificado. */
  conFundamento: boolean;
  fundamento: string;
}

/**
 * La segunda citacion del acudiente que no vino a la entrega (Julian, 2026-10-03): simple si
 * justifico; con el fundamento normativo si no. Siempre con la licencia laboral.
 */
function citacionSeguimiento(inst: DatosInstitucion, c: CitacionSeguimiento): string {
  return `<article class="tarjeta">
    ${encabezado(inst, 'Citación a acudiente · seguimiento', `Sede ${inst.sede}`)}
    <p class="cuerpo">Señor(a) acudiente de</p>
    <p class="nombre grande">${esc(c.estudiante)}</p>
    <p class="cuerpo">del grupo <b>${esc(c.grado)}</b>: como no fue posible su asistencia a la entrega de la alerta académica del ${esc(c.fechaEntrega)}, le citamos con el director de grupo el</p>
    <p class="cuando"><b>${esc(c.fecha)}</b><br>a las <b>${esc(c.hora)}</b></p>
    ${c.conFundamento ? `<p class="lic fund">${esc(c.fundamento)}</p>` : ''}
    <p class="lic">Su asistencia es <b>obligatoria</b> por requerimiento de la institución. Esta citación sirve como soporte para solicitar la licencia remunerada para obligaciones escolares como acudiente (Código Sustantivo del Trabajo, art. 57, num. 6, lit. f, modificado por la Ley 2466 de 2025).</p>
    ${firma(c.director)}
  </article>`;
}

const CSS_FUND = `.lic.fund { color: #111; border-top: 0; padding-top: 0; }`;

/**
 * El archivo de seguimiento de coordinacion: las segundas citaciones de la jornada y
 * constancias con la fecha en blanco (cada cita tiene su propia fecha).
 */
export function htmlSeguimiento(
  inst: DatosInstitucion,
  citaciones: CitacionSeguimiento[],
  constanciasEnBlanco: number,
  titulo = 'Citaciones de seguimiento',
): string {
  const nConst = constanciasEnBlanco > 0 ? Math.ceil(constanciasEnBlanco / 4) * 4 : 0;
  const cuerpo = `<style>${CSS_FUND}${CSS_CS}</style>`
    + paginas(citaciones.map((c) => citacionSeguimiento(inst, c)))
    + (nConst ? paginas(Array.from({ length: nConst }, () => constancia(inst, null, 'citación de seguimiento de la alerta académica'))) : '');
  return documento(titulo, cuerpo, `${citaciones.length} citaciones y ${nConst} constancias · ${Math.ceil(citaciones.length / 4) + nConst / 4} hoja(s)`);
}
