import { describe, expect, it } from 'vitest';
import { ACOMPAÑAMIENTOS } from '../maestros';
import { distribucionInicial, idDeZona } from './inicial';
import { DIAS } from './tipos';

describe('distribución inicial', () => {
  for (const jornada of ['manana', 'tarde'] as const) {
    it(`reproduce exactamente la lista fija de la ${jornada}`, () => {
      const d = distribucionInicial(jornada);
      expect(d.zonas).toHaveLength(6);
      expect(d.asignaciones).toHaveLength(30);
      expect(d.zonas.every((z) => z.cupo === 1)).toBe(true);

      // Cada entrada de la lista fija tiene su asignación, y ninguna sobra.
      const fija = ACOMPAÑAMIENTOS.filter((a) => a.jornada === jornada);
      for (const a of fija) {
        expect(d.asignaciones).toContainEqual(
          expect.objectContaining({ zonaId: idDeZona(a.lugar), dia: a.dia, docenteId: a.docente }),
        );
      }
      // Toda zona tiene su casilla cubierta los cinco días.
      for (const z of d.zonas) {
        for (const dia of DIAS) {
          expect(d.asignaciones.filter((x) => x.zonaId === z.id && x.dia === dia)).toHaveLength(1);
        }
      }
    });
  }

  it('arranca con los cuatro candados de Doris y Margarita en la mañana, y ninguno en la tarde', () => {
    const manana = distribucionInicial('manana').asignaciones.filter((a) => a.candado);
    expect(manana).toHaveLength(4);
    expect(manana.map((a) => `${a.docenteId}:${a.dia}:${a.zonaId}`).sort()).toEqual([
      'doris:lunes:restaurante',
      'doris:viernes:restaurante',
      'margara:jueves:restaurante',
      'margara:miercoles:restaurante',
    ]);
    expect(distribucionInicial('tarde').asignaciones.some((a) => a.candado)).toBe(false);
  });

  it('marca la publicación como inicial y anterior a cualquier fecha real', () => {
    const d = distribucionInicial('tarde');
    expect(d.esInicial).toBe(true);
    expect(d.vigenteDesde < '2026-01-01').toBe(true);
  });
});
