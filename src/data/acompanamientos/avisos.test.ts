import { describe, expect, it } from 'vitest';
import { avisosDeCambio } from './avisos';
import { distribucionInicial } from './inicial';
import type { Distribucion, Publicacion } from './tipos';

describe('avisosDeCambio', () => {
  it('detecta exactamente los docentes cuyo conjunto (día, zona) cambió', () => {
    const base = distribucionInicial('manana');
    const zonas = [
      { id: 'kioscos', nombre: 'Kioscos', cupo: 1 },
      { id: 'banos', nombre: 'Baños', cupo: 1 },
    ];
    const anterior: Publicacion = {
      ...base,
      zonas,
      asignaciones: [
        { zonaId: 'kioscos', dia: 'martes', docenteId: 'julian', candado: false },
        { zonaId: 'banos', dia: 'lunes', docenteId: 'carlos', candado: false },
        { zonaId: 'kioscos', dia: 'lunes', docenteId: 'doris', candado: false },
      ],
    };
    const nueva: Distribucion = {
      jornada: 'manana',
      zonas,
      asignaciones: [
        { zonaId: 'banos', dia: 'miercoles', docenteId: 'julian', candado: false }, // cambia
        { zonaId: 'banos', dia: 'lunes', docenteId: 'carlos', candado: false }, // igual
        { zonaId: 'kioscos', dia: 'lunes', docenteId: 'doris', candado: false }, // igual
      ],
    };

    const avisos = avisosDeCambio(anterior, nueva, '2026-09-21');
    expect(avisos).toHaveLength(1);
    expect(avisos[0].docenteId).toBe('julian');
    expect(avisos[0].mensaje).toContain('lunes 21 de septiembre');
    expect(avisos[0].mensaje).toContain('Martes · Kioscos');
    expect(avisos[0].mensaje).toContain('Miércoles · Baños');
  });

  it('un docente que pasa de 0 a 1 y otro de 1 a 0 generan cada uno su aviso con "ninguno"', () => {
    const base = distribucionInicial('manana');
    const zonas = [{ id: 'kioscos', nombre: 'Kioscos', cupo: 1 }];
    const anterior: Publicacion = {
      ...base,
      zonas,
      asignaciones: [{ zonaId: 'kioscos', dia: 'lunes', docenteId: 'doris', candado: false }],
    };
    const nueva: Distribucion = {
      jornada: 'manana',
      zonas,
      asignaciones: [{ zonaId: 'kioscos', dia: 'lunes', docenteId: 'julian', candado: false }],
    };

    const avisos = avisosDeCambio(anterior, nueva, '2026-09-21');
    expect(avisos).toHaveLength(2);

    const deDoris = avisos.find((a) => a.docenteId === 'doris')!;
    expect(deDoris.mensaje).toContain('Ahora: ninguno');

    const deJulian = avisos.find((a) => a.docenteId === 'julian')!;
    expect(deJulian.mensaje).toContain('Antes: ninguno');
  });
});
