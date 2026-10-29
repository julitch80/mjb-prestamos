// Informe ejecutivo del avance docente del Plan Académico Especial (para rectora y coordinadores).
// Lógica pura: construye el HTML imprimible y el texto corto para WhatsApp.
// Solo nombre de pila + grupo: nunca motivo, salud ni apellidos.
import { esc } from '../simulacros/imprimirGuion';
import type { DocenteAvance, FilaAsignaturaAvance, FiltroJornada } from './avanceDocentes';

/** Fracción hecho / total. */
export interface Fraccion { x: number; y: number }

export interface ResumenAvance {
  planesActivos: number;
  docentes: number;
  alDia: number;
  conPendientes: number;
  listas: number;
  total: number;
  porcentaje: number;
  criterios: Fraccion;
  entregas: Fraccion;
  /** Visto bueno / aprobación de guías, más la pregunta orientadora de quien lidera. */
  guias: Fraccion;
}

export interface FilaInforme {
  docente: string;
  planes: string;
  listas: number;
  total: number;
  porcentaje: number;
  criterios: Fraccion;
  entregas: Fraccion;
  guias: Fraccion;
  faltas: string[];
}

export const ETIQUETA_JORNADA: Record<FiltroJornada, string> = {
  todas: 'Ambas jornadas', manana: 'Jornada de la mañana', tarde: 'Jornada de la tarde',
};

const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : 100);

/** dd/mm/aaaa */
export function fechaDMA(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`;
}

const suma = (a: Fraccion, b: Fraccion): Fraccion => ({ x: a.x + b.x, y: a.y + b.y });
const CERO: Fraccion = { x: 0, y: 0 };
export const fraccionTexto = (f: Fraccion) => `${f.x}/${f.y}`;

/** Fracciones de una fila: la guía cuenta visto bueno (si ya hay guía) y pregunta orientadora (si lidera). */
export function fraccionesFila(f: FilaAsignaturaAvance): { criterios: Fraccion; entregas: Fraccion; guias: Fraccion } {
  const hayGuia = f.estadoGuia !== 'sin_generar';
  return {
    criterios: { x: f.criteriosListos ? 1 : 0, y: 1 },
    entregas: { x: f.entregableListo ? 1 : 0, y: 1 },
    guias: {
      x: (hayGuia && f.vistoBueno ? 1 : 0) + (f.esLider && f.ejeListo ? 1 : 0),
      y: (hayGuia ? 1 : 0) + (f.esLider ? 1 : 0),
    },
  };
}

/** Fracciones acumuladas de un docente. */
export function fraccionesDocente(d: DocenteAvance): { criterios: Fraccion; entregas: Fraccion; guias: Fraccion } {
  let criterios = CERO, entregas = CERO, guias = CERO;
  for (const f of d.planes.flatMap(p => p.filas)) {
    const r = fraccionesFila(f);
    criterios = suma(criterios, r.criterios); entregas = suma(entregas, r.entregas); guias = suma(guias, r.guias);
  }
  return { criterios, entregas, guias };
}

/** Frases cortas de lo que le falta a una fila (asignatura de un plan). */
export function faltasDeFila(f: FilaAsignaturaAvance, quien: string): string[] {
  const r: string[] = [];
  if (f.criteriosPorIA) r.push(`Criterios de ${f.asignatura} por IA sin revisar (${quien})`);
  else if (!f.criteriosListos) r.push(`Criterios de ${f.asignatura} (${quien})`);
  if (!f.entregableListo) r.push(`Entregable de ${f.asignatura} sin fecha (${quien})`);
  if (f.estadoGuia === 'sin_generar') r.push(`Guía sin generar (${quien})`);
  else {
    if (f.estadoGuia === 'propuesta') r.push(`Guía sin aprobar (${quien})`);
    if (!f.vistoBueno) r.push(`Visto bueno de ${f.asignatura} (${quien})`);
  }
  if (f.esLider && !f.ejeListo) r.push(`Pregunta orientadora (${quien})`);
  return r;
}

/** Una fila por docente, con más pendientes primero. */
export function filasInforme(docentes: DocenteAvance[]): FilaInforme[] {
  return docentes.map(d => ({
    docente: d.docente,
    planes: d.planes.map(p => `${p.nombre} ${p.grupo}`).join(', '),
    listas: d.listas, total: d.total, porcentaje: pct(d.listas, d.total),
    ...fraccionesDocente(d),
    faltas: d.planes.flatMap(p => p.filas.flatMap(f => faltasDeFila(f, `${p.nombre} ${p.grupo}`))),
  })).sort((a, b) => (b.total - b.listas) - (a.total - a.listas) || a.docente.localeCompare(b.docente, 'es'));
}

export function resumenAvance(docentes: DocenteAvance[]): ResumenAvance {
  const listas = docentes.reduce((s, d) => s + d.listas, 0);
  const total = docentes.reduce((s, d) => s + d.total, 0);
  const alDia = docentes.filter(d => d.total - d.listas === 0).length;
  const fr = docentes.map(fraccionesDocente);
  return {
    planesActivos: new Set(docentes.flatMap(d => d.planes.map(p => p.planId))).size,
    docentes: docentes.length, alDia, conPendientes: docentes.length - alDia,
    listas, total, porcentaje: pct(listas, total),
    criterios: fr.reduce((s, f) => suma(s, f.criterios), CERO),
    entregas: fr.reduce((s, f) => suma(s, f.entregas), CERO),
    guias: fr.reduce((s, f) => suma(s, f.guias), CERO),
  };
}

/** Clase de color de una barra: verde completo, ámbar parcial, rojo en cero. */
export const claseBarra = (f: Fraccion) => (f.x >= f.y ? 'ok' : f.x === 0 ? 'no' : 'par');

// Escudo con URL absoluta: el informe se abre en una ventana nueva sin la base de la app.
const BASE_URL = (import.meta as unknown as { env?: { BASE_URL?: string } }).env?.BASE_URL ?? '/';
const ESCUDO = () => (typeof location !== 'undefined' ? location.origin : '') + `${BASE_URL}mjb_escudo.png`;

const membrete = () => `<div class="membrete"><img src="${ESCUDO()}" alt=""><div><b>Institución Educativa Manuel J. Betancur</b><br><span>San Antonio de Prado · Medellín · Plan Académico Especial</span></div></div>`;

const CSS = `
@page { size: letter portrait; margin: 1.6cm; }
* { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
body { font-family: Arial, Helvetica, sans-serif; color: #111; font-size: 12px; line-height: 1.4; margin: 0; }
h1 { font-size: 19px; margin: 0 0 4px; color: #1e3a5f; border-bottom: 2px solid #c9a227; padding-bottom: 3px; }
h2 { font-size: 14px; margin: 14px 0 6px; color: #1e3a5f; border-bottom: 2px solid #c9a227; padding-bottom: 2px; }
p { margin: 3px 0; }
.membrete { display: flex; align-items: center; gap: 10px; border-bottom: 3px solid #1e3a5f; padding-bottom: 6px; margin-bottom: 10px; font-size: 13px; }
.membrete img { width: 1.4cm; height: auto; }
.membrete span { color: #444; font-size: 11px; }
.sub { color: #444; margin-bottom: 8px; }
.cifras { display: flex; gap: 8px; margin: 6px 0; }
.cifra { flex: 1; border: 1.5px solid #1e3a5f; border-radius: 6px; padding: 5px 8px; }
.cifra b { display: block; font-size: 17px; color: #1e3a5f; }
.cifra span { font-size: 10.5px; color: #333; }
table { width: 100%; border-collapse: collapse; margin: 4px 0 8px; }
tr { page-break-inside: avoid; }
th, td { border: 1px solid #555; padding: 4px 6px; vertical-align: middle; text-align: left; }
th { background: #e8e8e8; font-size: 11px; }
td.n { width: 17%; }
.barra { height: 5px; background: #ddd; border-radius: 3px; margin-top: 2px; overflow: hidden; }
.barra i { display: block; height: 100%; }
.ok { background: #2e9e5b; } .par { background: #e0a100; } .no { background: #d33a3a; }
.barra:has(i.no) { background: #f3c4c4; }
details { margin: 3px 0; }
summary { cursor: pointer; font-weight: bold; color: #1e3a5f; }
ul { margin: 2px 0 4px; padding-left: 18px; }
li { margin: 1px 0; }
.nota { font-size: 10.5px; color: #444; }
.pie { margin-top: 10px; font-size: 10px; color: #555; }
`;

/** Celda con fracción y barrita; «—» si no hay nada que medir. */
function celda(f: Fraccion): string {
  if (f.y === 0) return '<td class="n">—</td>';
  return `<td class="n">${fraccionTexto(f)}<div class="barra"><i class="${claseBarra(f)}" style="width:${pct(f.x, f.y)}%"></i></div></td>`;
}

function celdaGeneral(porcentaje: number, tiene: boolean): string {
  if (!tiene) return '<td class="n">—</td>';
  const c = porcentaje >= 100 ? 'ok' : porcentaje === 0 ? 'no' : 'par';
  return `<td class="n">${porcentaje} %<div class="barra"><i class="${c}" style="width:${porcentaje}%"></i></div></td>`;
}

export function construirInformeHTML(docentes: DocenteAvance[], fecha: Date = new Date(), jornada: FiltroJornada = 'todas'): string {
  const r = resumenAvance(docentes);
  const filas = filasInforme(docentes);
  const cifra = (n: string, t: string) => `<div class="cifra"><b>${esc(n)}</b><span>${esc(t)}</span></div>`;
  const conDetalle = filas.filter(f => f.total - f.listas > 0 && f.faltas.length > 0);
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Informe ejecutivo · Avance docente</title><style>${CSS}</style></head><body>
${membrete()}
<h1>Informe ejecutivo · Avance docente del Plan Académico Especial</h1>
<p class="sub">${ETIQUETA_JORNADA[jornada]} · Generado el ${fechaDMA(fecha)} · ${r.planesActivos} ${r.planesActivos === 1 ? 'plan activo' : 'planes activos'}</p>
<div class="cifras">
${cifra(fraccionTexto(r.criterios), 'Criterios')}${cifra(fraccionTexto(r.entregas), 'Entregas')}${cifra(fraccionTexto(r.guias), 'Guías')}${cifra(`${r.porcentaje} %`, 'Avance general')}
</div>
<p><b>${r.alDia} docentes al día de ${r.docentes}.</b></p>
<h2>Avance por docente</h2>
${filas.length === 0 ? '<p>No hay docentes con planes activos en esta jornada.</p>' : `<table>
<tr><th>Docente</th><th>Criterios de evaluación</th><th>Entregas: fecha y tipo</th><th>Guías: visto bueno / aprobación</th><th>Avance general</th></tr>
${filas.map(f => `<tr><td>${esc(f.docente)}</td>${celda(f.criterios)}${celda(f.entregas)}${celda(f.guias)}${celdaGeneral(f.porcentaje, f.total > 0)}</tr>`).join('\n')}
</table>`}
${conDetalle.length ? `<h2>Detalle de pendientes</h2>
<p class="nota">En «Guías» se cuenta también la pregunta orientadora de quien lidera la guía.</p>
${conDetalle.map(f => `<details><summary>Ver detalle de ${esc(f.docente)}</summary><ul>${f.faltas.map(x => `<li>${esc(x)}</li>`).join('')}</ul></details>`).join('\n')}` : ''}
<p class="pie">Informe interno de seguimiento. Incluye únicamente nombre de pila y grupo de los estudiantes.</p>
</body></html>`;
}

/** Versión corta para pegar en WhatsApp: una línea por docente. */
export function construirResumenTexto(docentes: DocenteAvance[], fecha: Date = new Date(), jornada: FiltroJornada = 'todas'): string {
  const r = resumenAvance(docentes);
  const filas = filasInforme(docentes);
  return [
    `*Avance docente · Plan Académico Especial* (${fechaDMA(fecha)})`,
    `${ETIQUETA_JORNADA[jornada]} · ${r.alDia} docentes al día de ${r.docentes} · criterios ${fraccionTexto(r.criterios)} · entregas ${fraccionTexto(r.entregas)} · guías ${fraccionTexto(r.guias)} · ${r.porcentaje} %`,
    '',
    ...filas.map(f => `${f.docente}: criterios ${fraccionTexto(f.criterios)} · entregas ${fraccionTexto(f.entregas)} · guías ${fraccionTexto(f.guias)} · ${f.porcentaje} %`),
  ].join('\n');
}
