import { describe, expect, it } from 'vitest';
import { construirAvanceDocentes } from './avanceDocentes';
import { construirInformeHTML, construirResumenTexto, resumenAvance } from './informeAvance';
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
    const html = construirInformeHTML(datos(), new Date(2026, 9, 29));
    expect(html.indexOf('Caro')).toBeLessThan(html.indexOf('Beto'));
    expect(html).toContain('29/10/2026');
    expect(html).toContain('Samuel 10.1');
    expect(html).toContain('Al día:');
  });
  it('no incluye motivo ni apellidos', () => {
    const html = construirInformeHTML(datos());
    const txt = construirResumenTexto(datos());
    for (const s of [html, txt]) { expect(s).not.toContain('secreto'); expect(s).not.toContain('Pérez'); }
    expect(txt).toContain('Caro');
  });
});
