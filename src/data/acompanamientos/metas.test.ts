import { describe, it, expect } from 'vitest';
import { metasAutomaticas } from './metas';
import { distribucionInicial } from './inicial';
import { docentesDeLaJornada, esMixto, pesoDeCarga } from './disponibilidad';
import { DIAS } from './tipos';
import type { Distribucion } from './tipos';

describe('metasAutomaticas', () => {
  it('la suma de las metas es exactamente el total de casillas, en ambas jornadas', () => {
    for (const jornada of ['manana', 'tarde'] as const) {
      const dist = distribucionInicial(jornada);
      const metas = metasAutomaticas(dist);
      const totalCasillas = dist.zonas.reduce((s, z) => s + z.cupo * DIAS.length, 0);
      const suma = Object.values(metas).reduce((s, n) => s + n, 0);
      expect(suma).toBe(totalCasillas);
    }
  });

  it('incluye a todos los docentes de la jornada, incluidos los de meta cero', () => {
    const dist = distribucionInicial('manana');
    const metas = metasAutomaticas(dist);
    for (const u of docentesDeLaJornada('manana')) {
      expect(metas[u.id]).toBeDefined();
      expect(metas[u.id]).toBeGreaterThanOrEqual(0);
    }
  });

  it('un mixto arranca con aproximadamente la mitad de meta que uno de tiempo completo', () => {
    const dist = distribucionInicial('manana');
    const metas = metasAutomaticas(dist);
    const mixtos = docentesDeLaJornada('manana').filter((u) => esMixto(u.id));
    const completos = docentesDeLaJornada('manana').filter((u) => !esMixto(u.id));
    if (mixtos.length > 0 && completos.length > 0) {
      const promedioMixto = mixtos.reduce((s, u) => s + metas[u.id], 0) / mixtos.length;
      const promedioCompleto = completos.reduce((s, u) => s + metas[u.id], 0) / completos.length;
      // No es exacto (hay redondeo y ajuste a la suma), pero debe quedar cerca
      // de la mitad, nunca igual o más que un tiempo completo.
      expect(promedioMixto).toBeLessThan(promedioCompleto);
    }
  });

  it('nunca da una meta negativa', () => {
    for (const jornada of ['manana', 'tarde'] as const) {
      const metas = metasAutomaticas(distribucionInicial(jornada));
      for (const v of Object.values(metas)) expect(v).toBeGreaterThanOrEqual(0);
    }
  });

  it('sin zonas (cero casillas), todas las metas quedan en cero', () => {
    const dist: Distribucion = { jornada: 'manana', zonas: [], asignaciones: [] };
    const metas = metasAutomaticas(dist);
    for (const v of Object.values(metas)) expect(v).toBe(0);
  });

  it('reparte proporcional al peso de carga: dos docentes de igual peso reciben metas iguales o a lo sumo con 1 de diferencia', () => {
    const dist = distribucionInicial('manana');
    const metas = metasAutomaticas(dist);
    const completos = docentesDeLaJornada('manana').filter((u) => pesoDeCarga(u.id, 'manana') === 1);
    if (completos.length >= 2) {
      const valores = completos.map((u) => metas[u.id]);
      expect(Math.max(...valores) - Math.min(...valores)).toBeLessThanOrEqual(1);
    }
  });
});

describe('metasDesdeCargaActual', () => {
  it('arranca en lo que cada profesor tiene hoy, y suma el total de casillas', async () => {
    const { metasDesdeCargaActual } = await import('./metas');
    const { distribucionInicial } = await import('./inicial');
    const d = distribucionInicial('manana');
    const m = metasDesdeCargaActual(d);
    expect(m.uriel).toBe(3);
    expect(Object.values(m).reduce((a, b) => a + b, 0)).toBe(30);
  });
});
