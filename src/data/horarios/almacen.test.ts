/**
 * Pruebas del guardado de horarios en el navegador.
 *
 * Lo que se comprueba sobre todo es que el horario siga estando al recargar la
 * página, y que un navegador que se niegue a guardar no tumbe la pantalla: en
 * ventana privada o con la cuota llena, `localStorage` lanza excepción.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  borrarTodo, borrarVersion, guardarVersion, horarioActivo,
  idVersionActiva, listarVersiones, obtenerVersion,
} from './almacen';
import salidaReal from './fixtures/salida-motor.json';
import type { SalidaGenerador } from './tipos';

const salida = salidaReal as unknown as SalidaGenerador;

/**
 * Las pruebas de esta app corren en Node, donde no existe `localStorage`. En vez
 * de añadir jsdom como dependencia --que cargaría un navegador entero en una app
 * en producción solo para esto-- se imita lo poco que se usa.
 */
function crearAlmacenFalso() {
  const datos = new Map<string, string>();
  return {
    getItem: (k: string) => (datos.has(k) ? datos.get(k)! : null),
    setItem: (k: string, v: string) => { datos.set(k, String(v)); },
    removeItem: (k: string) => { datos.delete(k); },
    clear: () => { datos.clear(); },
    key: (i: number) => [...datos.keys()][i] ?? null,
    get length() { return datos.size; },
  };
}

describe('almacén de horarios', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.stubGlobal('localStorage', crearAlmacenFalso());
  });

  it('guarda un horario y lo devuelve entero', () => {
    const r = guardarVersion(salida, 'Primera prueba');
    expect(r.ok).toBe(true);
    expect(obtenerVersion(r.id!)).toEqual(salida);
  });

  it('el horario sigue ahí al recargar la página', () => {
    guardarVersion(salida, 'Sobrevive');
    // Recargar equivale a volver a leer localStorage desde cero: es justo lo que
    // hace `horarioActivo`, que no guarda nada en memoria entre llamadas.
    const recuperado = horarioActivo();
    expect(recuperado?.horario).toHaveLength(salida.horario.length);
    expect(recuperado).toEqual(salida);
  });

  it('la versión recién guardada queda como la activa', () => {
    const r = guardarVersion(salida, 'Nueva');
    expect(idVersionActiva()).toBe(r.id);
    expect(listarVersiones().find(v => v.activa)?.id).toBe(r.id);
  });

  it('resume cada versión sin arrastrar todas las clases', () => {
    guardarVersion(salida, 'Con nombre');
    const [v] = listarVersiones();
    expect(v.nombre).toBe('Con nombre');
    expect(v.clases).toBe(salida.horario.length);
    expect(v.estado).toBe(salida.estado);
    expect(v).not.toHaveProperty('salida');
  });

  it('pone un nombre por defecto si se deja en blanco', () => {
    guardarVersion(salida, '   ');
    expect(listarVersiones()[0].nombre).toBe('Horario generado');
  });

  it('lista las versiones de la más nueva a la más vieja', () => {
    const a = guardarVersion(salida, 'Vieja');
    const b = guardarVersion(salida, 'Nueva');
    const ids = listarVersiones().map(v => v.id);
    expect(ids.indexOf(b.id!)).toBeLessThan(ids.indexOf(a.id!));
  });

  it('no guarda más de diez versiones', () => {
    for (let i = 0; i < 14; i++) guardarVersion(salida, `v${i}`);
    expect(listarVersiones()).toHaveLength(10);
  });

  it('al hacer sitio descarta las más viejas, nunca la activa', () => {
    const vieja = guardarVersion(salida, 'la primera de todas');
    for (let i = 0; i < 14; i++) guardarVersion(salida, `relleno ${i}`);
    // La vieja se descarta: es lo esperado, y se puede recuperar del archivo.
    expect(obtenerVersion(vieja.id!)).toBeNull();
    // La activa es siempre la última guardada, que encabeza la lista.
    expect(horarioActivo()).not.toBeNull();
    expect(listarVersiones()[0].activa).toBe(true);
  });

  it('al borrar la activa, activa otra en su lugar', () => {
    guardarVersion(salida, 'A');
    const b = guardarVersion(salida, 'B');
    borrarVersion(b.id!);
    expect(obtenerVersion(b.id!)).toBeNull();
    expect(idVersionActiva()).not.toBe(b.id);
    expect(horarioActivo()).not.toBeNull();
  });

  it('sin nada guardado no hay horario activo', () => {
    borrarTodo();
    expect(horarioActivo()).toBeNull();
    expect(listarVersiones()).toEqual([]);
  });

  it('avisa en vez de romperse si el navegador no deja guardar', () => {
    vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new Error('cuota llena');
    });
    const r = guardarVersion(salida, 'No cabe');
    expect(r.ok).toBe(false);
    expect(r.mensaje).toContain('no dejó guardar');
  });

  it('aguanta que el navegador tampoco deje leer', () => {
    vi.spyOn(localStorage, 'getItem').mockImplementation(() => {
      throw new Error('bloqueado');
    });
    expect(listarVersiones()).toEqual([]);
    expect(horarioActivo()).toBeNull();
  });

  it('aguanta que lo guardado esté corrupto', () => {
    localStorage.setItem('mjb.horarios.versiones', '{esto no es json}');
    expect(listarVersiones()).toEqual([]);
  });
});
