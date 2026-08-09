import { describe, it, expect } from 'vitest';
import { recalcularBloquesAcortados } from './horarioModificado';
import type { BloqueRecalculado } from './horarioModificado';

function minutos(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

function duracion(b: BloqueRecalculado): number {
  return minutos(b.fin) - minutos(b.inicio);
}

function esError(r: unknown): r is { error: string } {
  return typeof r === 'object' && r !== null && 'error' in r;
}

describe('recalcularBloquesAcortados — múltiplos de 5', () => {
  it('caso de Julián: reparto no exacto da 4 bloques de una duración y 2 de otra, ambas múltiplos de 5, diferencia de 5 min', () => {
    // Jornada mañana, 6 bloques, descansos institucionales: 20 (tras bloque 2) + 10 (tras bloque 4) = 30.
    // Con horaInicio 06:00 y horaFin 11:50 -> totalMin = 350, minutosClases = 320.
    // Reparto viejo: 320/6 = 53.33 -> 53 base, sobrante 2 -> 54,54,53,53,53,53 (no múltiplos de 5).
    // Reparto nuevo: floor(320/5)*5=320, unidades=64, base=10, sobrante=4 -> 11,11,11,11,10,10 *5 = 55,55,55,55,50,50.
    // Mismo patrón que pidió Julián: 4 bloques de una duración y 2 de otra, diferencia de 5 min.
    const r = recalcularBloquesAcortados('manana', '11:50', '06:00', 6);
    expect(esError(r)).toBe(false);
    const bloques = r as BloqueRecalculado[];
    expect(bloques).toHaveLength(6);

    const duraciones = bloques.map(duracion);
    duraciones.forEach(d => expect(d % 5).toBe(0));

    const distintas = Array.from(new Set(duraciones)).sort((a, b) => a - b);
    expect(distintas).toHaveLength(2);
    expect(distintas[1] - distintas[0]).toBe(5);

    const mayor = distintas[1];
    const cantidadMayor = duraciones.filter(d => d === mayor).length;
    expect(cantidadMayor).toBe(4); // sobrante calculado arriba: unidadesSobrantes=4 con este rango
  });

  it('reparto exacto en múltiplos de 5 sin sobrante: todos los bloques con la misma duración', () => {
    // 4 bloques, sin descansos (usamos array vacío explícito), 240 min de clase -> 60 c/u.
    const r = recalcularBloquesAcortados('manana', '10:00', '06:00', 4, []);
    expect(esError(r)).toBe(false);
    const bloques = r as BloqueRecalculado[];
    expect(bloques).toHaveLength(4);
    const duraciones = bloques.map(duracion);
    duraciones.forEach(d => {
      expect(d % 5).toBe(0);
      expect(d).toBe(60);
    });
  });

  it('cada bloque devuelto tiene duración múltiplo de 5, para numBloques 1..6 y varios rangos horarios', () => {
    const rangos: Array<[string, string, string]> = [
      ['manana', '06:00', '11:50'],
      ['manana', '06:00', '10:07'], // minutos no múltiplos de 5 en el total, para forzar el recorte
      ['tarde', '12:15', '17:58'],
    ];
    for (const [jornada, inicio, fin] of rangos) {
      for (let n = 1; n <= 6; n++) {
        const r = recalcularBloquesAcortados(jornada as 'manana' | 'tarde', fin, inicio, n);
        if (esError(r)) {
          // Jornada demasiado corta para este n es un resultado válido; solo lo saltamos.
          continue;
        }
        r.forEach(b => {
          expect(duracion(b) % 5).toBe(0);
        });
      }
    }
  });

  it('jornada demasiado corta sigue devolviendo error como antes', () => {
    // 6 bloques en una jornada de solo 30 minutos: imposible incluso con la validación vieja.
    const r = recalcularBloquesAcortados('manana', '06:30', '06:00', 6);
    expect(esError(r)).toBe(true);
  });
});
