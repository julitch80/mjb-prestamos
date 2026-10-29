import { describe, expect, it } from 'vitest';
import { seleccionarVencidas } from './limpieza';

describe('seleccionarVencidas', () => {
  it('solo las vencidas, sin fecha nunca, y respeta el límite', () => {
    const e = [{ borrarDespuesDe: 5 }, { borrarDespuesDe: 10 }, { borrarDespuesDe: 20 }, {}, { borrarDespuesDe: NaN }];
    expect(seleccionarVencidas(e, 10)).toEqual([{ borrarDespuesDe: 5 }]);
    expect(seleccionarVencidas(e, 100, 2)).toHaveLength(2);
  });
});
