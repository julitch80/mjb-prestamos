/**
 * Imprimible del «Resumen del periodo» de permanencia — HTML puro, hoja carta vertical.
 *
 * Mismo encabezado y misma ventana que los imprimibles de la alerta académica
 * (`imprimibles-alerta.ts`): escudo, nombre de la institución y el rango en el título. A
 * diferencia de las tarjetas de 4 por hoja, este documento CRECE: la lista de estudiantes y
 * la tabla por grado pueden ocupar varias hojas, y el navegador corta donde haga falta.
 */

import { documento, encabezado, esc, type DatosInstitucion } from './imprimibles-alerta';
import { ESTADO_CASO_ETIQUETA, GESTION_ETIQUETA, NIVEL_ETIQUETA } from './permanencia';
import { DECISION_ETIQUETA, desglose, textoRango, type ResumenPeriodo } from './resumen-permanencia';
import { TIPO_SEGUIMIENTO_ETIQUETA } from './seguimiento-caso';

const CSS_RP = `
.hoja.rp { display: block; height: auto; min-height: 279.4mm; overflow: visible; padding: 12mm 14mm 12mm; }
.hoja.rp::before, .hoja.rp::after { display: none; }
.rp h2 { font-size: 10pt; margin: 5mm 0 1.5mm; color: #b3122a; text-transform: uppercase; letter-spacing: .03em; }
.rp .cifras { display: grid; grid-template-columns: repeat(3, 1fr); gap: 2mm; margin-top: 3mm; }
.rp .cifra { border: 0.3mm solid #ccc; border-radius: 2mm; padding: 2mm 3mm; }
.rp .cifra b { display: block; font-size: 15pt; }
.rp .cifra span { font-size: 8pt; color: #444; }
.rp .des { margin: 1mm 0 0; padding-left: 5mm; font-size: 8.6pt; line-height: 1.45; }
.rp table { width: 100%; border-collapse: collapse; font-size: 8.6pt; }
.rp th { text-align: left; font-size: 7.8pt; color: #444; border-bottom: 0.4mm solid #111; padding: 1mm 1.5mm; }
.rp td { border-bottom: 0.2mm solid #ccc; padding: 1mm 1.5mm; }
.rp td.n, .rp th.n { text-align: right; font-variant-numeric: tabular-nums; }
.rp tr { break-inside: avoid; }
.rp .nota { font-size: 7.6pt; color: #555; margin: 1.5mm 0 0; }
.rp .aviso { font-size: 8pt; margin: 2mm 0 0; padding: 1.5mm 2.5mm; border-left: 1mm solid #b7791f; background: #fbf4e6; }
@media print { .hoja.rp { min-height: 0; padding: 12mm 14mm; } }
`;

function lista(pares: [string, number][]): string {
  if (pares.length === 0) return '';
  return `<ul class="des">${pares.map(([k, n]) => `<li>${esc(k)}: <b>${n}</b></li>`).join('')}</ul>`;
}

function cifra(n: number, etiqueta: string): string {
  return `<div class="cifra"><b>${n}</b><span>${esc(etiqueta)}</span></div>`;
}

export function htmlResumenPermanencia(inst: DatosInstitucion, r: ResumenPeriodo, alcance: string): string {
  const rango = textoRango(r.rango);
  const titulo = `Resumen de permanencia · ${rango}`;
  const i = r.inasistencias;
  const c = r.casos;
  const s = r.seguimientos;

  const top = i.top.length
    ? `<table><thead><tr><th class="n">N.º</th><th>Estudiante</th><th>Grado</th><th class="n">Inasistencias</th><th>Última</th></tr></thead><tbody>${i.top
        .map(
          (f, n) =>
            `<tr><td class="n">${n + 1}</td><td>${esc(f.nombre || '(ficha no activa)')}</td><td>${esc(f.grado)}</td><td class="n">${f.inasistencias}</td><td>${esc(f.ultima)}</td></tr>`,
        )
        .join('')}</tbody></table>`
    : '<p class="nota">Nadie registra inasistencias en el rango.</p>';

  const grados = `<table><thead><tr><th>Grado</th><th class="n">Días con censo</th><th class="n">Inasistencias</th><th class="n">Estudiantes con inasistencias</th><th class="n">Casos abiertos</th></tr></thead><tbody>${r.porGrado
    .map(
      (f) =>
        `<tr><td>${esc(f.grado)}</td><td class="n">${f.diasConCenso || '—'}</td><td class="n">${f.inasistencias}</td><td class="n">${f.estudiantesConInasistencia}</td><td class="n">${f.casosAbiertos}</td></tr>`,
    )
    .join('')}</tbody></table>`;

  const cuerpo = `<style>${CSS_RP}</style><section class="hoja rp">
    ${encabezado(inst, `Resumen de permanencia · ${rango}`, `Sede ${inst.sede} · ${alcance}`)}

    <h2>Inasistencias (censo de la tercera hora)</h2>
    <div class="cifras">
      ${cifra(i.total, 'inasistencias (estudiante-día)')}
      ${cifra(i.estudiantes, 'estudiantes con al menos una')}
      ${cifra(i.diasConCenso, 'días con censo')}
    </div>
    ${i.primerCenso ? `<p class="nota">Primer día con censo en el rango: ${esc(i.primerCenso)}. La ausencia autorizada no cuenta.</p>` : '<p class="aviso">No hay censo de la tercera hora en este rango.</p>'}
    ${i.gruposSinCenso.length ? `<p class="aviso">Sin ningún censo en el rango: ${esc(i.gruposSinCenso.join(', '))}. No significa que no haya faltado nadie.</p>` : ''}

    <h2>Casos de permanencia</h2>
    <div class="cifras">
      ${cifra(c.abiertosEnRango, 'abiertos en el rango')}
      ${cifra(c.cerradosEnRango, 'cerrados en el rango')}
      ${cifra(c.abiertosAlFinal, 'seguían abiertos al final')}
    </div>
    ${lista(desglose(c.abiertosEnRangoPorNivel, NIVEL_ETIQUETA).map(([k, n]) => [`Abiertos en el rango · ${k}`, n]))}
    ${lista(desglose(c.cerradosEnRangoPorEstado, ESTADO_CASO_ETIQUETA))}
    ${lista(desglose(c.abiertosAlFinalPorEstado, ESTADO_CASO_ETIQUETA).map(([k, n]) => [`Al final · ${k}`, n]))}

    <h2>Seguimientos registrados (${s.total})</h2>
    ${lista(desglose(s.porTipo, TIPO_SEGUIMIENTO_ETIQUETA))}
    ${lista(desglose(s.porDecision, DECISION_ETIQUETA))}
    ${s.gestiones > 0 ? `<p class="nota">Además, ${s.gestiones} gestión(es) marcadas en los casos:</p>${lista(desglose(s.gestionesPorTipo, GESTION_ETIQUETA))}` : ''}

    <h2>Estudiantes con más inasistencias</h2>
    ${top}
    ${i.lista.length > i.top.length ? `<p class="nota">Se muestran ${i.top.length} de ${i.lista.length}. La lista completa está en el Excel.</p>` : ''}

    <h2>Por grado</h2>
    ${grados}
  </section>`;

  return documento(titulo, cuerpo, alcance);
}
