import { describe, expect, it, beforeEach, vi } from 'vitest';
import { leerBorrador, guardarBorrador, descartarBorrador, borradorDesdeVigente } from './borrador';
import { distribucionInicial } from './inicial';

// localStorage simulado en memoria — el proyecto de asistencia usa el mismo patrón.
function localStorageSimulado() {
  const mapa = new Map<string, string>();
  return {
    getItem: (k: string) => (mapa.has(k) ? mapa.get(k)! : null),
    setItem: (k: string, v: string) => { mapa.set(k, v); },
    removeItem: (k: string) => { mapa.delete(k); },
    clear: () => mapa.clear(),
    key: () => null,
    length: 0,
  } as Storage;
}

describe('borrador', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', localStorageSimulado());
  });

  it('sin nada guardado, leerBorrador da null', () => {
    expect(leerBorrador('manana')).toBeNull();
  });

  it('guardar y leer devuelve lo mismo', () => {
    const b = borradorDesdeVigente(distribucionInicial('manana'), 'inicial');
    guardarBorrador('manana', b);
    expect(leerBorrador('manana')).toEqual(b);
  });

  it('la mañana y la tarde se guardan por separado', () => {
    const bManana = borradorDesdeVigente(distribucionInicial('manana'), 'inicial');
    const bTarde = borradorDesdeVigente(distribucionInicial('tarde'), 'inicial');
    guardarBorrador('manana', bManana);
    guardarBorrador('tarde', bTarde);
    expect(leerBorrador('manana')?.distribucion.jornada).toBe('manana');
    expect(leerBorrador('tarde')?.distribucion.jornada).toBe('tarde');
  });

  it('descartarBorrador borra lo guardado', () => {
    const b = borradorDesdeVigente(distribucionInicial('manana'), 'inicial');
    guardarBorrador('manana', b);
    descartarBorrador('manana');
    expect(leerBorrador('manana')).toBeNull();
  });

  it('borradorDesdeVigente hace una copia, no una referencia', () => {
    const vigente = distribucionInicial('manana');
    const b = borradorDesdeVigente(vigente, 'inicial');
    b.distribucion.zonas[0].cupo = 99;
    expect(vigente.zonas[0].cupo).not.toBe(99);
  });

  it('si localStorage lanza excepción, leerBorrador cae a null sin romperse', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => { throw new Error('bloqueado'); },
      setItem: () => { throw new Error('bloqueado'); },
      removeItem: () => { throw new Error('bloqueado'); },
    } as unknown as Storage);
    expect(leerBorrador('manana')).toBeNull();
    expect(() => guardarBorrador('manana', borradorDesdeVigente(distribucionInicial('manana'), 'inicial'))).not.toThrow();
    expect(() => descartarBorrador('manana')).not.toThrow();
  });
});

describe('borrador con otra forma', () => {
  it('un borrador JSON válido pero sin asignaciones se ignora', () => {
    const almacen: Record<string, string> = { 'mjb:acompanamientos:borrador:manana': JSON.stringify({ distribucion: { jornada: 'manana', zonas: [] } }) };
    vi.stubGlobal('localStorage', { getItem: (k: string) => almacen[k] ?? null, setItem: () => {}, removeItem: () => {} });
    expect(leerBorrador('manana')).toBeNull();
    vi.unstubAllGlobals();
  });
});
