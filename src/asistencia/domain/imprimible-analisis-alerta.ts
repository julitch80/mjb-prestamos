/**
 * Imprimible del analisis de la alerta de un grupo (2026-10-24): una hoja carta para
 * proyectar o repartir en el salon. CON nombres (para el director) o SIN nombres (para el
 * grupo): sin nombres solo van graficos de conjunto y las asignaturas con un solo
 * estudiante se agrupan en «Otras» (`agruparParaSalon`).
 */

import { documento, encabezado, esc, type DatosInstitucion } from './imprimibles-alerta';
import { agruparParaSalon, frases, type AnalisisGrupo, type Barra, type FilaGrupo, type PuntoPeriodo } from './analisis-alerta';

const AZUL = '#2563eb';
const AMBAR = '#b7791f';
const GRIS = '#9aa3ad';

const CSS_AN = `
.hoja.an { display: block; height: auto; min-height: 279.4mm; overflow: visible; padding: 12mm 14mm; }
.hoja.an::before, .hoja.an::after { display: none; }
.an h2 { font-size: 10pt; margin: 5mm 0 1.5mm; color: #111; }
.an .heroe { display: flex; align-items: baseline; gap: 4mm; margin: 4mm 0 1mm; }
.an .heroe b { font-size: 34pt; line-height: 1; color: ${AZUL}; }
.an .heroe span { font-size: 11pt; }
.an .cifras { display: grid; grid-template-columns: repeat(4, 1fr); gap: 2mm; margin-top: 3mm; }
.an .cifra { border: 0.3mm solid #ccc; border-radius: 2mm; padding: 2mm 3mm; }
.an .cifra b { display: block; font-size: 15pt; }
.an .cifra span { font-size: 8pt; color: #444; }
.an .barras { display: grid; grid-template-columns: 42mm 1fr 10mm; gap: 1.6mm 2mm; align-items: center; font-size: 9pt; }
.an .barra { height: 5mm; border-radius: 0 1mm 1mm 0; }
.an .num { font-weight: 700; font-variant-numeric: tabular-nums; }
.an .quienes { grid-column: 2 / 4; font-size: 7.6pt; color: #444; margin: -1mm 0 1mm; }
.an .ley { font-size: 7.8pt; color: #444; margin: 1.5mm 0 0; }
.an .ley i { display: inline-block; width: 3mm; height: 3mm; border-radius: 0.6mm; vertical-align: -0.4mm; margin: 0 1mm 0 2mm; }
.an ul.fr { margin: 1mm 0 0; padding-left: 5mm; font-size: 9.4pt; line-height: 1.5; }
.an .nota { font-size: 7.6pt; color: #555; margin: 1.5mm 0 0; }
.an .aviso { font-size: 8pt; margin: 2mm 0 0; padding: 1.5mm 2.5mm; border-left: 1mm solid ${AMBAR}; background: #fbf4e6; }
.an .barras > * { break-inside: avoid; }
.an .evo { display: flex; align-items: flex-end; gap: 6mm; height: 42mm; padding: 0 2mm; border-bottom: 0.3mm solid #999; }
.an .evo .col { flex: 1; max-width: 22mm; height: 100%; position: relative; display: flex; flex-direction: column; justify-content: flex-end; align-items: center; }
.an .evo .val { font-size: 8.6pt; font-weight: 700; margin-bottom: 0.8mm; }
.an .evo .bar { width: 100%; border-radius: 1mm 1mm 0 0; display: flex; justify-content: center; align-items: flex-end; }
.an .evo .bar b { color: #fff; font-size: 9pt; padding-bottom: 1.5mm; }
.an .evo .prom { position: absolute; left: -1.5mm; right: -1.5mm; border-top: 0.6mm dashed #111; }
.an .evo-x { display: flex; gap: 6mm; padding: 0 2mm; font-size: 8pt; color: #444; }
.an .evo-x span { flex: 1; max-width: 22mm; text-align: center; }
.an .gr { display: grid; grid-template-columns: 14mm 1fr 12mm; gap: 1mm 2mm; align-items: center; font-size: 8.6pt; }
.an .gr .pista { position: relative; height: 3.6mm; }
.an .gr .pista .prom { position: absolute; top: -0.6mm; bottom: -0.6mm; border-left: 0.5mm dashed #111; }
.an h2 { break-after: avoid; }
.an .gr .b { height: 3.6mm; border-radius: 0 1mm 1mm 0; }
.an .gr .propio { font-weight: 700; }
.an .ley i.linea { width: 5mm; height: 0; border-top: 0.6mm dashed #111; border-radius: 0; vertical-align: 0.6mm; }
@media print { .hoja.an { min-height: 0; } }
`;

function barras(lista: Barra[], conNombres: boolean, nombreDe: (id: string) => string, conNombresDe: (b: Barra) => boolean): string {
  const max = Math.max(1, ...lista.map((b) => b.n));
  return `<div class="barras">${lista.map((b) => `
    <span>${esc(b.etiqueta)}</span>
    <div class="barra" style="width:${b.n ? Math.max(2, (b.n / max) * 100) : 0}%;background:${b.seCita ? AMBAR : AZUL}"></div>
    <span class="num">${b.n}</span>
    ${conNombres && conNombresDe(b) && b.ids.length ? `<p class="quienes">${esc(b.ids.map(nombreDe).join(', '))}</p>` : ''}`).join('')}</div>`;
}

export interface DatosImprimibleAnalisis {
  grado: string;
  periodo: number;
  anio: number;
  director: string;
  analisis: AnalisisGrupo;
  /** Ya redactadas: «8 puntos más que en el periodo 2». */
  comparaciones: string[];
  entrega: { citados: number; vinieron: number; faltaron: number } | null;
  /** Periodos del año (los que haya), con el promedio de la jornada si se conoce. */
  evolucion?: PuntoPeriodo[];
  /** Los grupos de la jornada, para ubicar al propio. */
  grupos?: FilaGrupo[];
  promedioJornada?: number | null;
}

function evolucion(puntos: PuntoPeriodo[]): string {
  const hayJornada = puntos.some((p) => p.jornada !== null);
  return `<div class="evo">${puntos.map((p) => `<div class="col">
      ${p.grupo === null ? '<span class="val" style="color:#999">—</span>'
        : p.grupo >= 15 ? `<div class="bar" style="height:${p.grupo}%;background:${AZUL}"><b>${p.grupo} %</b></div>`
        : `<span class="val">${p.grupo} %</span><div class="bar" style="height:${Math.max(1, p.grupo)}%;background:${AZUL}"></div>`}
      ${p.jornada !== null ? `<div class="prom" style="bottom:${p.jornada}%"></div>` : ''}
    </div>`).join('')}</div>
    <div class="evo-x">${puntos.map((p) => `<span>Periodo ${p.periodo}</span>`).join('')}</div>
    <p class="ley">Altura: % del grupo sin ninguna alerta${hayJornada ? '.<i class="linea"></i>Promedio de la jornada' : '.'}</p>`;
}

function grupos(filas: FilaGrupo[], promedio: number | null | undefined): string {
  return `<div class="gr">${filas.map((g) => `
      <span class="${g.propio ? 'propio' : ''}">${esc(g.grado)}</span>
      <div class="pista"><div class="b" style="width:${Math.max(1, g.porcentajeSinAlerta)}%;background:${g.propio ? AZUL : GRIS}"></div>${promedio != null ? `<div class="prom" style="left:${promedio}%"></div>` : ''}</div>
      <span class="${g.propio ? 'propio' : ''}">${g.porcentajeSinAlerta} %</span>`).join('')}</div>
    <p class="ley">% de cada grupo sin ninguna alerta.<i style="background:${AZUL}"></i>Este grupo${promedio != null ? `<i class="linea"></i>Promedio de la jornada (${promedio} %)` : ''}</p>`;
}

export function htmlAnalisisAlerta(
  inst: DatosInstitucion,
  d: DatosImprimibleAnalisis,
  conNombres: boolean,
  nombreDe: (studentId: string) => string,
): string {
  const a = d.analisis;
  const titulo = `Análisis de la alerta académica · ${d.grado}`;
  const asignaturas = conNombres ? a.porAsignatura : agruparParaSalon(a.porAsignatura);
  const cifra = (n: number, t: string) => `<div class="cifra"><b>${n}</b><span>${esc(t)}</span></div>`;
  const cuerpo = `<style>${CSS_AN}</style><section class="hoja an">
    ${encabezado(inst, titulo, `Periodo ${d.periodo} de ${d.anio} · Dir. de grupo: ${d.director} · ${conNombres ? 'con nombres' : 'sin nombres'}`)}

    <div class="heroe"><b>${a.porcentajeSinAlerta} %</b><span>del grupo no tiene ninguna asignatura en alerta</span></div>
    ${d.comparaciones.length ? `<p class="nota">${esc(d.comparaciones.join(' · '))}</p>` : ''}
    <div class="cifras">
      ${cifra(a.total, 'estudiantes')}
      ${cifra(a.sinAlerta, 'sin ninguna alerta')}
      ${cifra(a.conAlguna, 'con al menos una')}
      ${cifra(a.citados, 'se cita a la familia')}
    </div>
    ${a.pendientes.length ? `<p class="aviso">Aún faltan por entregar: ${esc(a.pendientes.join(', '))}. Los números pueden subir.</p>` : ''}

    ${d.evolucion && d.evolucion.length > 1 ? `<h2>¿Cómo vamos de un periodo a otro?</h2>${evolucion(d.evolucion)}` : ''}
    ${d.grupos && d.grupos.length > 1 ? `<h2>Comparación con los otros grupos de la jornada</h2>${grupos(d.grupos, d.promedioJornada)}` : ''}

    <h2>¿Cuántas asignaturas en alerta tiene cada estudiante?</h2>
    ${barras(a.distribucion.map((b) => ({ ...b, etiqueta: b.clave === '1' ? '1 asignatura' : `${b.etiqueta} asignaturas` })), conNombres, nombreDe, (b) => b.clave !== '0')}
    <p class="ley">Cada barra es un número de estudiantes.<i style="background:${AMBAR}"></i>Se cita a la familia (2 o más)</p>

    <h2>Asignaturas con estudiantes en alerta</h2>
    ${asignaturas.length ? barras(asignaturas, conNombres, nombreDe, () => true) : '<p class="nota">Ninguna asignatura tiene estudiantes en alerta.</p>'}
    ${!conNombres && asignaturas.some((b) => b.clave === 'otras') ? '<p class="nota">«Otras»: asignaturas con un solo estudiante en alerta, juntas para no señalar a nadie.</p>' : ''}

    ${d.entrega && d.entrega.citados > 0 ? `<h2>La entrega a las familias</h2>
    <div class="cifras">
      ${cifra(d.entrega.citados, 'familias citadas')}
      ${cifra(d.entrega.vinieron, 'vinieron')}
      ${cifra(d.entrega.faltaron, 'faltaron')}
      ${cifra(Math.max(0, d.entrega.citados - d.entrega.vinieron - d.entrega.faltaron), 'sin registrar')}
    </div>` : ''}

    <h2>Para conversar</h2>
    <ul class="fr">${frases(a, !conNombres).map((t) => `<li>${esc(t)}</li>`).join('')}</ul>
  </section>`;
  return documento(titulo, cuerpo, `Periodo ${d.periodo} · ${conNombres ? 'con nombres' : 'sin nombres (para el salón)'}`);
}
