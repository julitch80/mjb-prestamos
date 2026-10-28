// Documento imprimible «formato UAI» del plan en casa (propuesta curricular integrada por áreas).
// Lógica pura: construye el HTML; abrirImprimibleUAI lo abre en una ventana lista para imprimir.
// Solo el primer nombre del estudiante: nunca apellidos ni motivo.
import { esc, imprimirHtml } from '../simulacros/imprimirGuion';
import type {
  AsignaturaPlan, FechaISO, Guia, GuiaPlan, PlanCasa, RitmoPlan,
} from './tipos';
import { MODALIDADES_SUSTENTACION } from './tipos';

export type PlanParaUAI = Pick<PlanCasa, 'nombres' | 'grupo' | 'desde' | 'hasta' | 'ajustes' | 'topeDiario'> & { ritmo?: RitmoPlan; sinTecnologia?: boolean };

const fecha = (f: FechaISO | null | undefined) => {
  if (!f) return '';
  const [y, m, d] = f.split('-');
  return `${d}/${m}/${y}`;
};

const CSS = `
@page { size: letter landscape; margin: 1.4cm; }
* { box-sizing: border-box; }
body { font-family: Arial, Helvetica, sans-serif; color: #111; font-size: 11px; line-height: 1.35; margin: 0; }
h1 { font-size: 16px; margin: 0 0 2px; }
h2 { font-size: 13px; margin: 14px 0 4px; }
h3 { font-size: 12px; margin: 10px 0 3px; }
p { margin: 2px 0; }
.sub { color: #444; margin-bottom: 8px; }
.pregunta { border: 1.5px solid #111; border-radius: 4px; padding: 6px 8px; margin: 6px 0 8px; font-size: 12px; }
table { width: 100%; border-collapse: collapse; margin: 4px 0 8px; page-break-inside: auto; }
tr { page-break-inside: avoid; }
th, td { border: 1px solid #555; padding: 4px 6px; vertical-align: top; text-align: left; }
th { background: #e8e8e8; }
td.comp { background: #f3f3f3; font-weight: bold; width: 17%; }
tr.parcial td { background: #fff4cf; font-weight: bold; }
.tag { font-size: 9px; border: 1px solid #111; border-radius: 8px; padding: 0 5px; margin-left: 4px; }
ul { margin: 2px 0 6px 16px; padding: 0; }
.guia { page-break-after: always; }
.guia:last-child { page-break-after: auto; }
.pie { margin-top: 10px; font-size: 9px; color: #555; }
`;

const celda = (t: string | undefined | null) => (t && t.trim() ? esc(t) : '<span style="color:#777">—</span>');

function areasDeGuia(g: GuiaPlan, asigs: AsignaturaPlan[], nombres: Record<string, { asignatura: string; docente: string }>, guia: Guia) {
  return g.asignaturaIds.map((id, i) => {
    const a = asigs.find(x => x.asignaturaId === id);
    const nombre = nombres[id]?.asignatura ?? id;
    const ev = guia.evidenciasAprendizaje ?? [];
    const delGuia = ev.find(e => e.asignatura.trim().toLowerCase() === nombre.trim().toLowerCase())
      ?? (ev.length === g.asignaturaIds.length ? ev[i] : undefined);
    return { nombre, ebcDba: a?.ebcDba ?? '', evidencia: delGuia?.evidencia ?? a?.evidenciaAprendizaje ?? '' };
  });
}

function seccionGuia(
  plan: PlanParaUAI, g: GuiaPlan, guia: Guia, asigs: AsignaturaPlan[], nombres: Record<string, { asignatura: string; docente: string }>,
): string {
  const areas = areasDeGuia(g, asigs, nombres, guia);
  const nombresAreas = areas.map(a => a.nombre);
  const esPregunta = g.eje.trim() && !g.asignaturaIds.includes(g.eje) && !nombresAreas.includes(g.eje);
  const modal = MODALIDADES_SUSTENTACION.find(m => m.id === guia.sustentacion.modalidad)?.texto ?? guia.sustentacion.modalidad;
  const s = guia.sustentacion;
  const detalleSust = [s.fecha ? fecha(s.fecha) : '', s.hora ?? '', s.lugarOEnlace].filter(Boolean).join(' · ');

  const filaPasos = guia.pasos.map(p => `<tr class="${p.esEntregaParcial ? 'parcial' : ''}">
    <td>${esc(p.titulo)}${p.esEntregaParcial ? '<span class="tag">Entrega parcial</span>' : ''}</td>
    <td>${celda(p.evidenciaDetalle || p.instrucciones)}</td>
    <td>${p.semana ? `Semana ${esc(p.semana)}` : '—'}${p.fecha ? `<br>${esc(fecha(p.fecha))}` : ''}</td>
    <td>${celda(p.ajusteAplicado)}</td>
    <td>${plan.sinTecnologia ? 'Entrega impresa' : celda(p.canalEntrega || p.evidencia)}</td></tr>`).join('');

  return `<section class="guia">
  <h1>Propuesta curricular integrada por áreas</h1>
  <p class="sub">Plan Académico Especial · ${esc(plan.nombres.trim().split(/\s+/)[0] || '')} · Grupo ${esc(plan.grupo)} · del ${esc(fecha(plan.desde))} al ${esc(fecha(plan.hasta))}</p>

  <h2>Paso 1. Pregunta orientadora / problema del contexto</h2>
  <div class="pregunta">${esPregunta ? esc(g.eje) : '<span style="color:#777">(por definir)</span>'}</div>

  <h2>Pasos 2 y 3. Competencias priorizadas, evidencias y producto integrado</h2>
  <table>
    <tr><th>Componente curricular</th>${nombresAreas.map(n => `<th>${esc(n)}</th>`).join('')}</tr>
    <tr><td class="comp">EBC/DBA priorizado</td>${areas.map(a => `<td>${celda(a.ebcDba)}</td>`).join('')}</tr>
    <tr><td class="comp">Evidencias de aprendizaje</td>${areas.map(a => `<td>${celda(a.evidencia)}</td>`).join('')}</tr>
    <tr><td class="comp">Producto integrado</td><td colspan="${Math.max(1, areas.length)}">${celda(guia.productoFinal)}</td></tr>
  </table>

  <h2>Paso 4. Cronograma de entregas parciales</h2>
  <table>
    <tr><th style="width:22%">Fase / Avance</th><th style="width:28%">Entregable parcial esperado</th><th style="width:10%">Semana</th><th style="width:20%">Ajuste razonable</th><th>Canal / Formato de entrega</th></tr>
    ${filaPasos}
  </table>

  <h3>Ajustes razonables</h3>
  ${plan.ajustes.length ? `<ul>${plan.ajustes.map(a => `<li>${esc(a)}</li>`).join('')}</ul>` : '<p>—</p>'}
  ${plan.sinTecnologia ? '<p><b>Entrega impresa:</b> la guía se entrega en papel; las entregas y la sustentación son en papel, presenciales u orales.</p>' : ''}
  <p>Ritmo de trabajo: ${plan.ritmo === 'dia_por_medio' ? 'día por medio' : 'diario'} · máximo ${esc(plan.topeDiario)} momentos de 25 min por día.</p>
  ${guia.criteriosEvaluacion.length ? `<h3>Criterios de evaluación</h3><ul>${guia.criteriosEvaluacion.map(c => `<li>${esc(c)}</li>`).join('')}</ul>` : ''}

  <h3>Sustentación</h3>
  <p>Modalidad: ${esc(modal)}${detalleSust ? ` · ${esc(detalleSust)}` : ''}</p>
  ${s.preguntasGuia.length ? `<ul>${s.preguntasGuia.map(q => `<li>${esc(q)}</li>`).join('')}</ul>` : ''}
  <p class="pie">I.E. Manuel J. Betancur · Unidad de Atención Integral (UAI). Documento con el primer nombre del estudiante; no contiene apellidos ni motivo.</p>
</section>`;
}

/** HTML completo (una sección por guía con contenido). Devuelve '' si ninguna guía tiene propuesta ni aprobada. */
export function construirHtmlUAI(
  plan: PlanParaUAI, guias: GuiaPlan[], asigs: AsignaturaPlan[], nombres: Record<string, { asignatura: string; docente: string }>,
): string {
  const secciones = guias.flatMap(g => {
    const guia = g.aprobada ?? g.propuesta;
    return guia ? [seccionGuia(plan, g, guia, asigs, nombres)] : [];
  });
  if (!secciones.length) return '';
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Formato UAI - Plan Académico Especial</title><style>${CSS}</style></head><body>${secciones.join('')}</body></html>`;
}

/** Abre el documento en una ventana nueva y lanza la impresión; si el navegador bloquea la ventana, imprime en un marco oculto. */
export function abrirImprimibleUAI(html: string): void {
  if (!html) return;
  const w = window.open('', '_blank');
  if (!w) { imprimirHtml(html); return; }
  w.document.open();
  w.document.write(html);
  w.document.close();
  window.setTimeout(() => { try { w.focus(); w.print(); } catch { /* el usuario puede imprimir a mano */ } }, 300);
}
