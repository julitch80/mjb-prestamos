// Informe ejecutivo del avance docente del Plan Académico Especial (para rectora y coordinadores).
// Lógica pura: construye el HTML imprimible y el texto corto para WhatsApp.
// Solo nombre de pila + grupo: nunca motivo, salud ni apellidos.
import { esc } from '../simulacros/imprimirGuion';
import type { DocenteAvance, FilaAsignaturaAvance } from './avanceDocentes';

export interface ResumenAvance {
  planesActivos: number;
  docentes: number;
  alDia: number;
  conPendientes: number;
  listas: number;
  total: number;
  porcentaje: number;
  criteriosPendientes: number;
  criteriosPorIA: number;
  entregablesSinFecha: number;
  vistosBuenosFaltantes: number;
  preguntasFaltantes: number;
  guiasSinGenerar: number;
  guiasSinAprobar: number;
}

export interface FilaInforme {
  docente: string;
  planes: string;
  listas: number;
  total: number;
  porcentaje: number;
  faltas: string[];
}

const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : 100);

/** dd/mm/aaaa */
export function fechaDMA(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`;
}

/** Frases cortas de lo que le falta a una fila (asignatura de un plan). */
function faltasDeFila(f: FilaAsignaturaAvance, quien: string): string[] {
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
    faltas: d.planes.flatMap(p => p.filas.flatMap(f => faltasDeFila(f, `${p.nombre} ${p.grupo}`))),
  })).sort((a, b) => (b.total - b.listas) - (a.total - a.listas) || a.docente.localeCompare(b.docente, 'es'));
}

export function resumenAvance(docentes: DocenteAvance[]): ResumenAvance {
  const filas = docentes.flatMap(d => d.planes.flatMap(p => p.filas));
  const listas = docentes.reduce((s, d) => s + d.listas, 0);
  const total = docentes.reduce((s, d) => s + d.total, 0);
  const alDia = docentes.filter(d => d.total - d.listas === 0).length;
  return {
    planesActivos: new Set(docentes.flatMap(d => d.planes.map(p => p.planId))).size,
    docentes: docentes.length, alDia, conPendientes: docentes.length - alDia,
    listas, total, porcentaje: pct(listas, total),
    criteriosPendientes: filas.filter(f => !f.criteriosListos && !f.criteriosPorIA).length,
    criteriosPorIA: filas.filter(f => f.criteriosPorIA).length,
    entregablesSinFecha: filas.filter(f => !f.entregableListo).length,
    vistosBuenosFaltantes: filas.filter(f => f.estadoGuia !== 'sin_generar' && !f.vistoBueno).length,
    preguntasFaltantes: filas.filter(f => f.esLider && !f.ejeListo).length,
    guiasSinGenerar: filas.filter(f => f.estadoGuia === 'sin_generar').length,
    guiasSinAprobar: filas.filter(f => f.estadoGuia === 'propuesta').length,
  };
}

// Escudo con URL absoluta: el informe se abre en una ventana nueva sin la base de la app.
const BASE_URL = (import.meta as unknown as { env?: { BASE_URL?: string } }).env?.BASE_URL ?? '/';
const ESCUDO = () => (typeof location !== 'undefined' ? location.origin : '') + `${BASE_URL}mjb_escudo.png`;

const membrete = () => `<div class="membrete"><img src="${ESCUDO()}" alt=""><div><b>Institución Educativa Manuel J. Betancur</b><br><span>San Antonio de Prado · Medellín · Plan Académico Especial</span></div></div>`;

const CSS = `
@page { size: letter portrait; margin: 1.6cm; }
* { box-sizing: border-box; }
body { font-family: Arial, Helvetica, sans-serif; color: #111; font-size: 12px; line-height: 1.4; margin: 0; }
h1 { font-size: 19px; margin: 0 0 4px; color: #1e3a5f; border-bottom: 2px solid #c9a227; padding-bottom: 3px; }
h2 { font-size: 14px; margin: 14px 0 6px; color: #1e3a5f; border-bottom: 2px solid #c9a227; padding-bottom: 2px; }
p { margin: 3px 0; }
.membrete { display: flex; align-items: center; gap: 10px; border-bottom: 3px solid #1e3a5f; padding-bottom: 6px; margin-bottom: 10px; font-size: 13px; }
.membrete img { width: 1.4cm; height: auto; }
.membrete span { color: #444; font-size: 11px; }
img { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.sub { color: #444; margin-bottom: 8px; }
.cifras { display: flex; flex-wrap: wrap; gap: 8px; margin: 6px 0; }
.cifra { border: 1.5px solid #1e3a5f; border-radius: 6px; padding: 5px 10px; min-width: 110px; }
.cifra b { display: block; font-size: 18px; color: #1e3a5f; }
table { width: 100%; border-collapse: collapse; margin: 4px 0 8px; }
tr { page-break-inside: avoid; }
th, td { border: 1px solid #555; padding: 4px 6px; vertical-align: top; text-align: left; }
th { background: #e8e8e8; }
.pie { margin-top: 10px; font-size: 10px; color: #555; }
`;

export function construirInformeHTML(docentes: DocenteAvance[], fecha: Date = new Date()): string {
  const r = resumenAvance(docentes);
  const filas = filasInforme(docentes);
  const pend = filas.filter(f => f.total - f.listas > 0);
  const alDia = filas.filter(f => f.total - f.listas === 0).map(f => f.docente);
  const cifra = (n: number | string, t: string) => `<div class="cifra"><b>${n}</b>${esc(t)}</div>`;
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Informe ejecutivo · Avance docente</title><style>${CSS}</style></head><body>
${membrete()}
<h1>Informe ejecutivo · Avance docente del Plan Académico Especial</h1>
<p class="sub">Generado el ${fechaDMA(fecha)} · ${r.planesActivos} ${r.planesActivos === 1 ? 'plan activo' : 'planes activos'}</p>
<h2>Resumen general</h2>
<div class="cifras">
${cifra(r.alDia, 'docentes al día')}${cifra(r.conPendientes, 'docentes con pendientes')}${cifra(`${r.porcentaje}%`, 'de las tareas hechas')}
</div>
<p>${r.listas} de ${r.total} tareas listas.</p>
<div class="cifras">
${cifra(r.criteriosPendientes, 'criterios pendientes')}${cifra(r.criteriosPorIA, 'criterios por IA sin revisar')}${cifra(r.entregablesSinFecha, 'entregables sin fecha')}${cifra(r.vistosBuenosFaltantes, 'vistos buenos faltantes')}${cifra(r.preguntasFaltantes, 'preguntas orientadoras faltantes')}${cifra(r.guiasSinGenerar, 'guías sin generar')}${cifra(r.guiasSinAprobar, 'guías sin aprobar')}
</div>
<h2>Avance por docente</h2>
${pend.length === 0 ? '<p>Todos los docentes están al día.</p>' : `<table>
<tr><th>Docente</th><th>Planes</th><th>Avance</th><th>Qué le falta</th></tr>
${pend.map(f => `<tr><td>${esc(f.docente)}</td><td>${esc(f.planes)}</td><td>${f.listas}/${f.total} (${f.porcentaje}%)</td><td>${esc(f.faltas.join('; '))}</td></tr>`).join('\n')}
</table>`}
${alDia.length ? `<p><b>Al día:</b> ${esc(alDia.join(', '))}.</p>` : ''}
<p class="pie">Informe interno de seguimiento. Incluye únicamente nombre de pila y grupo de los estudiantes.</p>
</body></html>`;
}

/** Versión corta para pegar en WhatsApp. */
export function construirResumenTexto(docentes: DocenteAvance[], fecha: Date = new Date()): string {
  const r = resumenAvance(docentes);
  const filas = filasInforme(docentes);
  const pend = filas.filter(f => f.total - f.listas > 0);
  const alDia = filas.filter(f => f.total - f.listas === 0).map(f => f.docente);
  const sueltos = ([
    [r.criteriosPendientes, 'criterios pendientes'], [r.criteriosPorIA, 'criterios por IA sin revisar'],
    [r.entregablesSinFecha, 'entregables sin fecha'], [r.vistosBuenosFaltantes, 'vistos buenos faltantes'],
    [r.preguntasFaltantes, 'preguntas orientadoras faltantes'], [r.guiasSinGenerar, 'guías sin generar'],
    [r.guiasSinAprobar, 'guías sin aprobar'],
  ] as [number, string][]).filter(([n]) => n > 0).map(([n, t]) => `${n} ${t}`);
  const lineas = [
    `*Avance docente · Plan Académico Especial* (${fechaDMA(fecha)})`,
    `${r.planesActivos} ${r.planesActivos === 1 ? 'plan activo' : 'planes activos'} · ${r.alDia} docentes al día, ${r.conPendientes} con pendientes · ${r.porcentaje}% de tareas hechas (${r.listas}/${r.total}).`,
    ...(sueltos.length ? [`Pendientes: ${sueltos.join('; ')}.`] : []),
    ...(pend.length ? ['', ...pend.map(f => `• ${f.docente} (${f.listas}/${f.total}): ${f.faltas.join('; ')}`)] : []),
    ...(alDia.length ? ['', `Al día: ${alDia.join(', ')}.`] : []),
  ];
  return lineas.join('\n');
}
