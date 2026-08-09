import { describe, it, expect } from 'vitest';
import { aplicarModificacionesAlDia } from './horarioModificado';
import type { EntradaHorarioBase, HorarioModificado, ModificacionBloque } from './horarioModificado';

// 2026-08-13 es jueves (mismo día usado en cascadaSecundaria.test.ts).
const FECHA = '2026-08-13';
const JORNADA = 'manana';
const DIA = 'jueves';

function mod(partial: Partial<ModificacionBloque> & Pick<ModificacionBloque, 'docenteOriginal' | 'grupo' | 'bloqueOriginal' | 'bloqueNuevo'>): ModificacionBloque {
  return { aula: '', ...partial };
}

function borrador(modificaciones: ModificacionBloque[]): HorarioModificado {
  return {
    id: 'test', fecha: FECHA, jornada: JORNADA, autor: 'test',
    ausencias: [], apoyos: [], modificaciones,
    estado: 'guardado', timestamp: new Date().toISOString(),
  };
}

describe('aplicarModificacionesAlDia — reasignación de aula al mover de bloque', () => {
  it('regla 1: usa el aula que el docente movido tiene normalmente en el bloque destino', () => {
    const horarioBase: EntradaHorarioBase[] = [
      // D dicta G1 en bloque 1 (aula A1) — se mueve al bloque 2.
      { jornada: JORNADA, dia: DIA, bloque: 1, docente: 'D', grado: 'G1', aula: 'A1' },
      // D también dicta G3 en bloque 2 (aula A3) — esa es su aula "normal" del bloque 2,
      // pero esa clase TAMBIÉN se mueve (a bloque 3), así que queda libre en bloque 2.
      { jornada: JORNADA, dia: DIA, bloque: 2, docente: 'D', grado: 'G3', aula: 'A3' },
      // Otro docente fijo en bloque 2, sin relación con D.
      { jornada: JORNADA, dia: DIA, bloque: 2, docente: 'E', grado: 'G2', aula: 'A2' },
    ];
    const hm = borrador([
      mod({ docenteOriginal: 'D', grupo: 'G1', bloqueOriginal: 1, bloqueNuevo: 2 }),
      mod({ docenteOriginal: 'D', grupo: 'G3', bloqueOriginal: 2, bloqueNuevo: 3 }),
    ]);

    const entradas = aplicarModificacionesAlDia(FECHA, JORNADA, horarioBase, [hm]);

    const movida = entradas.find(e => e.docente === 'D' && e.grado === 'G1');
    expect(movida?.esModificada).toBe(true);
    expect(movida?.aula).toBe('A3'); // aula que D usa normalmente en el bloque 2, ahora libre
  });

  it('regla 3: sin aula propia en el bloque destino, usa cualquier aula libre conocida', () => {
    const horarioBase: EntradaHorarioBase[] = [
      { jornada: JORNADA, dia: DIA, bloque: 1, docente: 'D', grado: 'G1', aula: 'A1' },
      // D no tiene ninguna clase propia en bloque 2 este día.
      { jornada: JORNADA, dia: DIA, bloque: 2, docente: 'E', grado: 'G2', aula: 'A2' },
      { jornada: JORNADA, dia: DIA, bloque: 2, docente: 'G', grado: 'G4', aula: 'A1' },
      // A3 aparece en el universo de aulas de la jornada (otro día) pero queda libre en bloque 2.
      { jornada: JORNADA, dia: 'lunes', bloque: 2, docente: 'F', grado: 'G3', aula: 'A3' },
    ];
    const hm = borrador([
      mod({ docenteOriginal: 'D', grupo: 'G1', bloqueOriginal: 1, bloqueNuevo: 2 }),
    ]);

    const entradas = aplicarModificacionesAlDia(FECHA, JORNADA, horarioBase, [hm]);

    const movida = entradas.find(e => e.docente === 'D' && e.grado === 'G1');
    expect(movida?.esModificada).toBe(true);
    expect(movida?.aula).toBe('A3'); // única aula libre conocida en el bloque 2
    expect(movida?.aula).not.toBe('A2'); // ocupada por E
  });

  it('caso de control: una entrada sin modificar conserva su aula original', () => {
    const horarioBase: EntradaHorarioBase[] = [
      { jornada: JORNADA, dia: DIA, bloque: 1, docente: 'D', grado: 'G1', aula: 'A1' },
      { jornada: JORNADA, dia: DIA, bloque: 2, docente: 'E', grado: 'G2', aula: 'A2' },
    ];
    // Sin modificaciones que afecten a E.
    const hm = borrador([
      mod({ docenteOriginal: 'D', grupo: 'G1', bloqueOriginal: 1, bloqueNuevo: 2 }),
    ]);

    const entradas = aplicarModificacionesAlDia(FECHA, JORNADA, horarioBase, [hm]);

    const sinTocar = entradas.find(e => e.docente === 'E' && e.grado === 'G2');
    expect(sinTocar?.esModificada).toBe(false);
    expect(sinTocar?.aula).toBe('A2'); // aula original, sin recálculo
  });
});
