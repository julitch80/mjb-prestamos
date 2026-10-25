import { describe, it, expect } from 'vitest';
import { agruparMensajes, colorAvatar, etiquetaLista, etiquetaSeparador, iniciales, PALETA_AVATAR } from './chatFormato';

const ahora = new Date(2026, 9, 26, 12, 0);
const msg = (id: string, a: string, f: Date) => ({ id, authorEmail: a, fecha: f });

describe('chatFormato', () => {
  it('color estable y dentro de la paleta', () => {
    expect(colorAvatar('A@x.co')).toBe(colorAvatar('a@x.co'));
    expect(PALETA_AVATAR).toContain(colorAvatar('b@x.co'));
  });
  it('iniciales', () => {
    expect(iniciales('Julián Medina Tamayo')).toBe('JM');
    expect(iniciales('marta')).toBe('MA');
  });
  it('etiquetas de lista', () => {
    expect(etiquetaLista(new Date(2026, 9, 26, 10, 42), ahora)).toBe('10:42');
    expect(etiquetaLista(new Date(2026, 9, 25, 23, 0), ahora)).toBe('Ayer');
    expect(etiquetaLista(new Date(2026, 9, 24, 8, 0), ahora)).toBe('24/10');
  });
  it('separadores', () => {
    expect(etiquetaSeparador(ahora, ahora)).toBe('Hoy');
    expect(etiquetaSeparador(new Date(2026, 9, 25), ahora)).toBe('Ayer');
    expect(etiquetaSeparador(new Date(2026, 9, 20), ahora)).toMatch(/20 de octubre/);
  });
  it('agrupa por autor, 5 min y día', () => {
    const r = agruparMensajes([
      msg('1', 'a', new Date(2026, 9, 25, 23, 58)),
      msg('2', 'a', new Date(2026, 9, 26, 0, 1)), // otro día: separador, nueva racha
      msg('3', 'a', new Date(2026, 9, 26, 0, 3)),
      msg('4', 'b', new Date(2026, 9, 26, 0, 4)),
      msg('5', 'b', new Date(2026, 9, 26, 0, 20)), // >5 min
    ], ahora);
    expect(r.map((x) => x.inicioRacha)).toEqual([true, true, false, true, true]);
    expect(r.map((x) => x.finRacha)).toEqual([true, false, true, true, true]);
    expect(r[1].separador).toBe('Hoy');
    expect(r[2].separador).toBeNull();
  });
});
