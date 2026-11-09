import { describe, it, expect } from 'vitest';
import { cajaGirada, girar, rotacionValida } from './rotacion';

describe('rotación de fotos', () => {
  it('gira de 90 en 90 y da la vuelta', () => {
    expect(girar(0, 1)).toBe(90);
    expect(girar(270, 1)).toBe(0);
    expect(girar(0, -1)).toBe(270);
    expect(girar(90, -1)).toBe(0);
  });
  it('normaliza valores guardados', () => {
    expect(rotacionValida('180')).toBe(180);
    expect(rotacionValida('45')).toBe(0);
    expect(rotacionValida(null)).toBe(0);
  });
  it('de lado, el contenedor intercambia ancho y alto y la foto cabe', () => {
    const c = cajaGirada(400, 200, 90, 300, 300);
    expect(c.cajaAncho).toBeCloseTo(150); expect(c.cajaAlto).toBeCloseTo(300);
    expect(c.imgAncho).toBeCloseTo(300); expect(c.imgAlto).toBeCloseTo(150);
    const n = cajaGirada(400, 200, 180, 300, 300);
    expect(n.cajaAncho).toBeCloseTo(300); expect(n.cajaAlto).toBeCloseTo(150);
  });
  it('no agranda una foto pequeña', () => {
    const c = cajaGirada(100, 50, 0, 800, 800);
    expect(c.cajaAncho).toBe(100);
  });
});
