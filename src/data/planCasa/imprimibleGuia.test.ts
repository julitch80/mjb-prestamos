import { describe, expect, it } from 'vitest';
import { construirHtmlCuadernillo } from './imprimibleGuia';
import type { Guia, GuiaPlan } from './tipos';

const guia: Guia = {
  productoFinal: 'Cartel <del> agua',
  criteriosEvaluacion: ['a'],
  pasos: [
    { id: 'p1', titulo: 'Leer', instrucciones: '1. Lee el texto\n2. Subraya', momentos: 2, evidencia: 'texto', evidenciaDetalle: 'Resumen', semana: 1, fecha: null },
    { id: 'p2', titulo: 'Resumir', instrucciones: '1. Resume', momentos: 1, evidencia: 'texto', evidenciaDetalle: 'Resumen en el cuaderno', semana: 1, esEntregaParcial: true, canalEntrega: 'En físico al docente', fecha: null },
    { id: 'p3', titulo: 'Cartel', instrucciones: '1. Dibuja', momentos: 1, evidencia: 'documento', evidenciaDetalle: 'Cartel', semana: 2, esEntregaParcial: true, fecha: null },
  ],
  sustentacion: { modalidad: 'presencial', fecha: '2026-11-20', hora: '10:00', lugarOEnlace: 'Coordinación', preguntasGuia: ['¿Por qué llueve?'] },
};
const g = (id: string, a?: Guia, p?: Guia): GuiaPlan => ({
  id, asignaturaIds: ['cn'], eje: 'Ciencias', responsableCorreo: 'r@x', docentesCorreos: [], vistosBuenos: {},
  aprobada: a, propuesta: p, seguimiento: {}, sustentacionEstado: 'sin_citar', actualizadoEn: 1,
});
const plan = { nombres: 'Ana María', grupo: '8º1', desde: '2026-10-26', hasta: '2026-11-13' };
const nombres = { cn: { asignatura: 'Ciencias', docente: 'A' } };

describe('construirHtmlCuadernillo', () => {
  const html = construirHtmlCuadernillo({ ...plan, topeDiario: 3, ritmo: 'dia_por_medio' }, [g('a', guia)], nombres);
  it('portada, cómo usar, semanas, subpasos, entregas y sustentación', () => {
    for (const t of ['Plan Académico Especial', 'Cuadernillo de trabajo', 'Ana', '8º1', '26/10/2026', 'Cómo usar este cuadernillo', 'máximo <b>3 momentos', 'Semana 1', 'Semana 2',
      '<li>Lee el texto</li>', 'Entrega de la semana:', 'Entregas y sustentación', '20/11/2026', '¿Por qué llueve?', 'class="lineas"']) expect(html).toContain(t);
  });
  it('solo primer nombre, escapa HTML, sin QR ni enlaces', () => {
    expect(html).not.toContain('María');
    expect(html).toContain('&lt;del&gt;');
    // El <head> solo trae las fuentes de Google; el contenido no lleva enlaces.
    const cuerpo = html.slice(html.indexOf('<body>'));
    expect(cuerpo).not.toMatch(/https?:|<a |qr|whatsapp/i);
    expect(cuerpo).toContain('escudo-oficial.png');
    expect(cuerpo).toContain('Lo hice');
  });
  it('solo guías aprobadas; vacío si no hay ninguna', () => {
    expect(construirHtmlCuadernillo(plan, [g('b', undefined, guia)], nombres)).toBe('');
    expect(construirHtmlCuadernillo(plan, [g('c')], nombres)).toBe('');
  });
  it('varias guías: un solo documento con una sección por guía y una sola sección final', () => {
    const h = construirHtmlCuadernillo(plan, [g('a', guia), g('b', guia), g('c', undefined, guia)], nombres);
    expect(h.match(/<section class="guia">/g)?.length).toBe(2);
    expect(h.match(/<section class="entregas">/g)?.length).toBe(1);
    expect(h.match(/<!doctype/g)?.length).toBe(1);
  });
  it('entrega integrada: lista de verificación «Tu entrega incluye» por asignatura', () => {
    const gi: Guia = { ...guia, integrada: true, pasos: guia.pasos.map(p => (p.id === 'p2' ? { ...p, componentes: [
      { asignaturaId: 'cn', parte: 'El taller resuelto', queRevisar: 'Procedimiento' }, { asignaturaId: 'eti', parte: 'La reflexión', queRevisar: 'Coherencia' }] } : p)) };
    const h = construirHtmlCuadernillo(plan, [g('a', gi)], { ...nombres, eti: { asignatura: 'Ética', docente: 'B' } });
    for (const t of ['Tu entrega incluye:', '☐ El taller resuelto (Ciencias)', '☐ La reflexión (Ética)']) expect(h).toContain(t);
  });
});
