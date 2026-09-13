import { describe, expect, it } from 'vitest';
import { fechaLegibleAcomp, textoCambiaDesde, textoCargaDesigual } from './textos';
import { distribucionInicial } from './inicial';
import type { Distribucion } from './tipos';
import { docentesDeLaJornada } from './disponibilidad';

describe('fechaLegibleAcomp', () => {
  it('2026-09-21 es lunes 21 de septiembre', () => {
    expect(fechaLegibleAcomp('2026-09-21')).toBe('lunes 21 de septiembre');
  });

  it('2026-10-01 es jueves 1 de octubre', () => {
    expect(fechaLegibleAcomp('2026-10-01')).toBe('jueves 1 de octubre');
  });
});

describe('textoCambiaDesde', () => {
  it('arma el aviso con la fecha futura correcta', () => {
    expect(textoCambiaDesde('2026-09-21')).toBe('Cambia desde el lunes 21 de septiembre');
  });
});

describe('textoCargaDesigual', () => {
  it('sin asignaciones no hay diferencia que avisar', () => {
    const dist = distribucionInicial('manana');
    const sinAsignaciones: Distribucion = { ...dist, asignaciones: [] };
    expect(textoCargaDesigual(sinAsignaciones)).toBeNull();
  });

  it('arma una frase legible, sin jerga, cuando un docente queda muy por encima de otro', () => {
    const docentes = docentesDeLaJornada('manana');
    // Toma dos docentes cualquiera de mañana (ninguno mixto en la práctica de
    // maestros.ts) y les da una diferencia grande a propósito.
    const [a, b] = docentes;
    const dist: Distribucion = {
      jornada: 'manana',
      zonas: [{ id: 'z1', nombre: 'Zona 1', cupo: 1 }],
      asignaciones: [
        { zonaId: 'z1', dia: 'lunes', docenteId: a.id, candado: false },
        { zonaId: 'z1', dia: 'martes', docenteId: a.id, candado: false },
        { zonaId: 'z1', dia: 'miercoles', docenteId: a.id, candado: false },
      ],
    };
    void b;
    const texto = textoCargaDesigual(dist);
    expect(texto).not.toBeNull();
    expect(texto).toContain(a.nombreCorto);
    expect(texto).not.toContain('normalizada');
    expect(texto).toContain('acompañamiento');
  });
});
