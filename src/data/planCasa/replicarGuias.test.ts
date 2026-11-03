import { describe, expect, it } from 'vitest';
import { emparejarGuias, errorReplicar, guiaParaDestino, trasladarFecha } from './replicarGuias';
import type { Guia, GuiaPlan } from './tipos';

const plan = (id: string, grupo: string, extra = {}) => ({ id, grupo, modalidad: 'por_asignatura' as const, estado: 'activo' as const, desde: '2026-11-04', hasta: '2026-11-27', ...extra });

describe('replicar guías', () => {
  it('exige el mismo grado y modalidad', () => {
    expect(errorReplicar(plan('a', '9.1'), plan('b', '9.3'))).toBeNull();
    expect(errorReplicar(plan('a', '9.1'), plan('b', '10.1'))).toMatch(/mismo grado/);
    expect(errorReplicar(plan('a', '7º1'), plan('b', '7º2'))).toBeNull();
    expect(errorReplicar(plan('a', '7º1'), plan('b', '7º2', { modalidad: 'transversal' }))).toMatch(/modalidad/);
    expect(errorReplicar(plan('a', '9.1'), plan('a', '9.1'))).toMatch(/otro/);
  });
  it('empareja por asignaturas cubiertas', () => {
    const g = (id: string, a: string[]) => ({ id, asignaturaIds: a }) as GuiaPlan;
    const r = emparejarGuias([g('x', ['mat', 'fis']), g('y', ['len'])], [g('p', ['fis', 'mat']), g('q', ['ing'])]);
    expect(r.map(x => [x.o.id, x.d.id])).toEqual([['x', 'p']]);
  });
  it('traslada fechas sin salirse del periodo', () => {
    expect(trasladarFecha('2026-11-10', '2026-11-04', '2026-11-05', '2026-11-27')).toBe('2026-11-11');
    expect(trasladarFecha('2026-11-27', '2026-11-04', '2026-11-10', '2026-11-27')).toBe('2026-11-27');
  });
  it('borra las fechas de los pasos para repartirlas de nuevo', () => {
    const g = { pasos: [{ id: '1', fecha: '2026-11-05' }], sustentacion: { fecha: '2026-11-25' } } as unknown as Guia;
    const r = guiaParaDestino(g, { desde: '2026-11-04', hasta: '2026-11-27' });
    expect(r.pasos[0].fecha).toBeNull();
    expect(r.sustentacion.fecha).toBe('2026-11-25');
  });
});
