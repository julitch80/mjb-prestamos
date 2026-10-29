import { describe, expect, it } from 'vitest';
import { construirAvanceDocentes, filtrarPorJornada, jornadaDePlan } from './avanceDocentes';
import { construirInformeHTML, construirResumenTexto, filasInforme, resumenAvance } from './informeAvance';
import type { AsignaturaPlan, GuiaPlan } from './tipos';

const asig = (id: string, docenteId: string, extra: Partial<AsignaturaPlan> = {}): AsignaturaPlan => ({
  asignaturaId: id, docenteId, docenteCorreo: `${docenteId}@x.co`, criteriosPromocion: '', actualizadoEn: 0, ...extra,
});
const guia = (id: string, ids: string[], extra: Partial<GuiaPlan> = {}): GuiaPlan => ({
  id, asignaturaIds: ids, eje: '', responsableCorreo: '', docentesCorreos: [], vistosBuenos: {},
  seguimiento: {}, sustentacionEstado: 'sin_citar', actualizadoEn: 0, ...extra,
});
const nombres = {
  mat: { asignatura: 'Matemáticas', docente: 'Ana' }, len: { asignatura: 'Lengua', docente: 'Beto' }, fis: { asignatura: 'Física', docente: 'Caro' },
};
const plan = { id: 'p1', nombres: 'Samuel Pérez', grupo: '10.1', estado: 'activo' as const, motivo: 'diagnóstico secreto' };

const datos = () => construirAvanceDocentes([{
  plan, nombres,
  asigs: [
    asig('mat', 'ana', { criteriosPromocion: 'ok', entregable: 'taller', fechaEntrega: '2026-11-10' }),
    asig('len', 'beto', { criteriosPromocion: 'ia', porIA: true }),
    asig('fis', 'caro'),
  ],
  guias: [guia('g', ['fis'], { propuesta: {} as never, responsableCorreo: 'caro@x.co' })],
}]);

describe('informe de avance', () => {
  it('ordena con más pendientes primero y calcula porcentajes', () => {
    const r = resumenAvance(datos());
    expect(r.alDia).toBe(1);
    expect(r.conPendientes).toBe(2);
    expect(r.porcentaje).toBe(Math.round((r.listas / r.total) * 100));
    const html = construirInformeHTML(datos(), new Date(2026, 9, 29), 'manana');
    expect(html.indexOf('Caro')).toBeLessThan(html.indexOf('Beto'));
    expect(html).toContain('29/10/2026');
    expect(html).toContain('Jornada de la mañana');
    expect(html).toContain('al día de 3');
  });
  it('no incluye motivo ni apellidos', () => {
    const html = construirInformeHTML(datos());
    const txt = construirResumenTexto(datos());
    for (const s of [html, txt]) { expect(s).not.toContain('secreto'); expect(s).not.toContain('Pérez'); }
    expect(txt).toContain('Caro');
  });
  it('calcula fracciones por columna y ordena con más pendientes primero', () => {
    const f = filasInforme(datos());
    expect(f.map(x => x.docente)).toEqual(['Caro', 'Beto', 'Ana']);
    const caro = f[0];
    expect(caro.criterios).toEqual({ x: 0, y: 1 });
    expect(caro.entregas).toEqual({ x: 0, y: 1 });
    expect(caro.guias).toEqual({ x: 0, y: 1 }); // visto bueno
    expect(caro.pregunta).toEqual({ x: 0, y: 1 }); // pregunta orientadora (líder)
    expect(ana.pregunta).toEqual({ x: 0, y: 0 }); // no lidera
    const ana = f[2];
    expect(ana.guias).toEqual({ x: 0, y: 0 }); // sin guía: no hay nada que medir
    expect(construirInformeHTML(datos())).toContain('<td class="n">—</td>');
    expect(construirResumenTexto(datos(), new Date(), 'manana')).toContain('Caro: criterios 0/1 · entregas 0/1 · guías 0/2 · 0 %');
  });
  it('filtra por jornada y recalcula totales', () => {
    expect(jornadaDePlan('6º1')).toBe('tarde');
    expect(jornadaDePlan('10.2')).toBe('manana');
    const tarde = { id: 'p2', nombres: 'Lucía Gómez', grupo: '6º1', estado: 'activo' as const };
    const todos = construirAvanceDocentes([
      { plan, nombres, asigs: [asig('mat', 'ana', { criteriosPromocion: 'ok' })], guias: [] },
      { plan: tarde, nombres, asigs: [asig('mat', 'ana'), asig('len', 'beto')], guias: [] },
    ]);
    const m = filtrarPorJornada(todos, 'manana');
    expect(m.map(d => d.docente)).toEqual(['Ana']);
    expect(m[0].planes).toHaveLength(1);
    expect(m[0].total).toBe(2); // criterios + entregable de un solo plan
    expect(filtrarPorJornada(todos, 'tarde').map(d => d.docente).sort()).toEqual(['Ana', 'Beto']);
    expect(filtrarPorJornada(todos, 'todas')).toBe(todos);
    expect(construirInformeHTML(filtrarPorJornada(todos, 'tarde'), new Date(), 'tarde')).toContain('Jornada de la tarde');
  });
});
