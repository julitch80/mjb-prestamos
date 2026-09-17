import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PILDORAS_AUTONOMIA, PILDORAS_COMUN, PILDORAS_FAMILIA, coleccionDeGrupo, gradoDeGrupo, siguientePildora } from './pildoras';

describe('píldoras de estudio personal', () => {
  beforeEach(() => {
    const almacen: Record<string, string> = {};
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => almacen[k] ?? null,
      setItem: (k: string, v: string) => { almacen[k] = v; },
      removeItem: (k: string) => { delete almacen[k]; },
    });
  });

  it('trae las 58 del documento aprobado', () => {
    expect(PILDORAS_COMUN).toHaveLength(26);
    expect(PILDORAS_FAMILIA).toHaveLength(12);
    expect(PILDORAS_AUTONOMIA).toHaveLength(20);
  });

  it('reconoce el grado en las dos notaciones', () => {
    expect(gradoDeGrupo('6º1')).toBe(6);
    expect(gradoDeGrupo('10.2')).toBe(10);
  });

  it('6º y 7º ven comunes y familia; 8º en adelante, comunes y autonomía', () => {
    const sexto = coleccionDeGrupo('6º2').map((p) => p.id);
    expect(sexto).toHaveLength(38);
    expect(sexto.some((id) => id.startsWith('F'))).toBe(true);
    expect(sexto.some((id) => id.startsWith('A'))).toBe(false);
    const octavo = coleccionDeGrupo('8º1').map((p) => p.id);
    expect(octavo).toHaveLength(46);
    expect(octavo.some((id) => id.startsWith('F'))).toBe(false);
  });

  it('recorre toda la colección sin repetir y vuelve a empezar', () => {
    const vistas = Array.from({ length: 46 }, () => siguientePildora('11.2').id);
    expect(new Set(vistas).size).toBe(46);
    expect(siguientePildora('11.2').id).toBe(vistas[0]);
  });
});
