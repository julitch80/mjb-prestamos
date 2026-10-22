import { describe, it, expect } from 'vitest';
import { subpasos } from './subpasos';

describe('subpasos', () => {
  it('parte «Paso N.» dentro de un solo párrafo', () => {
    expect(subpasos('Paso 1. Disuelve la sal. Paso 2. Calcula el %. Paso 3. Busca tu recibo.'))
      .toEqual(['Disuelve la sal.', 'Calcula el %.', 'Busca tu recibo.']);
  });
  it('parte por renglones y quita la numeración', () => {
    expect(subpasos('1. Lee el texto.\n2) Subraya 3 ideas.')).toEqual(['Lee el texto.', 'Subraya 3 ideas.']);
  });
  it('sin marcas devuelve un solo sub-paso', () => {
    expect(subpasos('Lee la página 12 y subraya 3 ideas.')).toEqual(['Lee la página 12 y subraya 3 ideas.']);
  });
  it('no confunde cantidades como «5 g» con numeración', () => {
    expect(subpasos('Paso 1. Usa 5 g de sal. Paso 2. Mide 250 mL.')).toEqual(['Usa 5 g de sal.', 'Mide 250 mL.']);
  });
});
