import { describe, it, expect } from 'vitest';
import { esUrlSegura, partirEnlaces } from './textoEnlaces';

describe('esUrlSegura', () => {
  it('acepta http(s) y rechaza otros esquemas', () => {
    expect(esUrlSegura('https://a.co/x')).toBe(true);
    expect(esUrlSegura('javascript:alert(1)')).toBe(false);
    expect(esUrlSegura('no es url')).toBe(false);
  });
});

describe('partirEnlaces', () => {
  it('sin enlaces devuelve un solo trozo', () => {
    expect(partirEnlaces('hola\nmundo')).toEqual([{ tipo: 'texto', valor: 'hola\nmundo' }]);
  });
  it('extrae enlaces y deja la puntuación final fuera', () => {
    const r = partirEnlaces('Mira https://a.co/x, y listo');
    expect(r).toEqual([
      { tipo: 'texto', valor: 'Mira ' },
      { tipo: 'enlace', valor: 'https://a.co/x', href: 'https://a.co/x' },
      { tipo: 'texto', valor: ',' },
      { tipo: 'texto', valor: ' y listo' },
    ]);
  });
  it('texto vacío', () => {
    expect(partirEnlaces('')).toEqual([]);
  });
});
