import { describe, expect, it } from 'vitest';
import { distribucionInicial } from './inicial';
import { historial, proximaPublicacion, publicacionVigente } from './vigente';
import type { Publicacion } from './tipos';

function pub(overrides: Partial<Publicacion>): Publicacion {
  return {
    id: 'x',
    jornada: 'manana',
    zonas: [],
    asignaciones: [],
    vigenteDesde: '2026-09-21',
    publicadoPor: 'coord@iemanueljbetancur.edu.co',
    publicadoPorNombre: 'Coordinadora',
    publicadoEn: 1000,
    esInicial: false,
    ...overrides,
  };
}

describe('publicacionVigente', () => {
  it('sin publicaciones, rige la inicial', () => {
    const v = publicacionVigente([], 'manana', '2026-09-13');
    expect(v.esInicial).toBe(true);
    expect(v).toEqual(distribucionInicial('manana'));
  });

  it('una publicacion con fecha pasada rige', () => {
    const p = pub({ id: 'p1', vigenteDesde: '2026-09-01' });
    const v = publicacionVigente([p], 'manana', '2026-09-13');
    expect(v.id).toBe('p1');
  });

  it('una publicacion con fecha futura todavia no rige (sigue la inicial)', () => {
    const p = pub({ id: 'p1', vigenteDesde: '2026-10-01' });
    const v = publicacionVigente([p], 'manana', '2026-09-13');
    expect(v.esInicial).toBe(true);
  });

  it('dos con la misma vigencia: gana la publicada despues (publicadoEn mayor)', () => {
    const p1 = pub({ id: 'p1', vigenteDesde: '2026-09-01', publicadoEn: 1000 });
    const p2 = pub({ id: 'p2', vigenteDesde: '2026-09-01', publicadoEn: 2000 });
    const v = publicacionVigente([p1, p2], 'manana', '2026-09-13');
    expect(v.id).toBe('p2');
  });

  it('publicaciones de la otra jornada se ignoran', () => {
    const p = pub({ id: 'p1', jornada: 'tarde', vigenteDesde: '2026-09-01' });
    const v = publicacionVigente([p], 'manana', '2026-09-13');
    expect(v.esInicial).toBe(true);
  });
});

describe('proximaPublicacion', () => {
  it('devuelve la de menor vigencia futura', () => {
    const p1 = pub({ id: 'p1', vigenteDesde: '2026-10-01' });
    const p2 = pub({ id: 'p2', vigenteDesde: '2026-11-01' });
    const v = proximaPublicacion([p1, p2], 'manana', '2026-09-13');
    expect(v?.id).toBe('p1');
  });

  it('null si no hay ninguna programada', () => {
    const p1 = pub({ id: 'p1', vigenteDesde: '2026-09-01' });
    const v = proximaPublicacion([p1], 'manana', '2026-09-13');
    expect(v).toBeNull();
  });
});

describe('historial', () => {
  it('la inicial primero, luego las reales en orden ascendente', () => {
    const p1 = pub({ id: 'p1', vigenteDesde: '2026-10-01' });
    const p2 = pub({ id: 'p2', vigenteDesde: '2026-09-01' });
    const h = historial([p1, p2], 'manana');
    expect(h.map((p) => p.id)).toEqual(['inicial', 'p2', 'p1']);
  });
});

describe('publicación recién hecha', () => {
  it('con la hora del servidor aún en camino, gana el empate de fecha', () => {
    const vieja = pub({ id: 'vieja', vigenteDesde: '2026-09-14', publicadoEn: 1000 });
    const nueva = pub({ id: 'nueva', vigenteDesde: '2026-09-14', publicadoEn: null });
    expect(publicacionVigente([nueva, vieja], 'manana', '2026-09-15').id).toBe('nueva');
    expect(publicacionVigente([vieja, nueva], 'manana', '2026-09-15').id).toBe('nueva');
  });
});

describe('publicación cancelada', () => {
  it('no rige ni aparece como próxima, pero sigue en el historial', () => {
    const buena = pub({ id: 'buena', vigenteDesde: '2026-09-15', publicadoEn: 2000 });
    const errada = pub({ id: 'errada', vigenteDesde: '2026-11-27', publicadoEn: 1000, canceladaPor: 'x@y' });
    expect(publicacionVigente([buena, errada], 'manana', '2026-11-30').id).toBe('buena');
    expect(proximaPublicacion([buena, errada], 'manana', '2026-09-15')).toBeNull();
    expect(historial([buena, errada], 'manana').map((p) => p.id)).toContain('errada');
  });
});
