import { describe, expect, it } from 'vitest';
import { construirAvanceDocentes } from './avanceDocentes';
import type { AsignaturaPlan, GuiaPlan } from './tipos';

const asig = (id: string, docenteId: string, extra: Partial<AsignaturaPlan> = {}): AsignaturaPlan => ({
  asignaturaId: id, docenteId, docenteCorreo: `${docenteId}@x.co`, criteriosPromocion: '', actualizadoEn: 0, ...extra,
});
const guia = (id: string, ids: string[], extra: Partial<GuiaPlan> = {}): GuiaPlan => ({
  id, asignaturaIds: ids, eje: '', responsableCorreo: '', docentesCorreos: [], vistosBuenos: {},
  seguimiento: {}, sustentacionEstado: 'sin_citar', actualizadoEn: 0, ...extra,
});
const nombres = { mat: { asignatura: 'Matemáticas', docente: 'Ana' }, len: { asignatura: 'Lengua', docente: 'Beto' } };
const plan = { id: 'p1', nombres: 'Samuel Pérez', grupo: '8º1', estado: 'activo' as const };

describe('construirAvanceDocentes', () => {
  it('cuenta tareas y ordena con más pendientes primero', () => {
    const r = construirAvanceDocentes([{
      plan, nombres,
      asigs: [
        asig('mat', 'ana', { criteriosPromocion: 'ok', entregable: 'taller', fechaEntrega: '2026-11-10' }),
        asig('len', 'beto', { criteriosPromocion: 'ia', porIA: true }),
      ],
      guias: [guia('mat', ['mat'], { propuesta: {} as never, vistosBuenos: { 'ana@x.co': true }, responsableCorreo: 'ana@x.co', eje: 'Pregunta' })],
    }]);
    expect(r.map(d => d.docente)).toEqual(['Beto', 'Ana']);
    expect(r[0].listas).toBe(0);
    expect(r[1]).toMatchObject({ listas: 4, total: 4 });
    expect(r[0].planes[0].nombre).toBe('Samuel');
    expect(r[0].planes[0].filas[0].criteriosPorIA).toBe(true);
  });
  it('ignora planes cerrados y el eje solo cuenta al líder', () => {
    const r = construirAvanceDocentes([
      { plan: { ...plan, estado: 'cerrado' }, nombres, asigs: [asig('mat', 'ana')], guias: [] },
      { plan, nombres, asigs: [asig('mat', 'ana')], guias: [guia('mat', ['mat'], { aprobada: {} as never, responsableCorreo: 'otro@x.co' })] },
    ]);
    expect(r).toHaveLength(1);
    const f = r[0].planes[0].filas[0];
    expect(f).toMatchObject({ esLider: false, estadoGuia: 'aprobada', vistoBueno: true, total: 3 });
  });
});
