/**
 * Pruebas de la configuración del año.
 *
 * Lo que más importa aquí es que un navegador que no deje guardar, o una
 * configuración vieja a la que le falte un campo, no dejen al generador sin
 * datos: preferimos volver a los valores de la app antes que producir una
 * semana sin días.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  configuracionPorDefecto, guardarConfiguracion, hayConfiguracionPropia,
  leerConfiguracion, materiasConfigurables, restablecerConfiguracion,
} from './configuracion';
import { construirEntrada } from './contrato';
import type { Dia } from './tipos';

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

describe('configuración del año', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.stubGlobal('localStorage', crearAlmacenFalso());
  });

  it('sin nada guardado devuelve lo que dicen los datos de la app', () => {
    expect(leerConfiguracion()).toEqual(configuracionPorDefecto());
    expect(hayConfiguracionPropia()).toBe(false);
  });

  it('guarda y recupera lo que el coordinador cambió', () => {
    const c = configuracionPorDefecto();
    c.centroInteres.manana = { dia: 'jueves', bloque: 2 };
    expect(guardarConfiguracion(c).ok).toBe(true);
    expect(leerConfiguracion().centroInteres.manana).toEqual({ dia: 'jueves', bloque: 2 });
    expect(hayConfiguracionPropia()).toBe(true);
  });

  it('una jornada puede quedarse sin Centro de Interés', () => {
    const c = configuracionPorDefecto();
    c.centroInteres.tarde = null;
    guardarConfiguracion(c);
    expect(leerConfiguracion().centroInteres.tarde).toBeNull();
  });

  it('restablecer vuelve a los datos de la app', () => {
    const c = configuracionPorDefecto();
    c.diasLectivos = ['lunes'] as Dia[];
    guardarConfiguracion(c);
    restablecerConfiguracion();
    expect(leerConfiguracion()).toEqual(configuracionPorDefecto());
    expect(hayConfiguracionPropia()).toBe(false);
  });

  it('a una configuración vieja le completa lo que le falte', () => {
    // Una guardada antes de que existiera un campo no puede dejar al generador
    // sin él: se rellena con lo que traen los datos de la app.
    localStorage.setItem('mjb.horarios.configuracion',
      JSON.stringify({ centroInteres: { manana: { dia: 'viernes', bloque: 1 } } }));
    const c = leerConfiguracion();
    expect(c.centroInteres.manana).toEqual({ dia: 'viernes', bloque: 1 });
    expect(c.diasLectivos).toEqual(configuracionPorDefecto().diasLectivos);
    expect(c.bloques).toEqual(configuracionPorDefecto().bloques);
    expect(c.exigentes.length).toBeGreaterThan(0);
  });

  it('una lista de días vacía se ignora en vez de dejar la semana sin días', () => {
    localStorage.setItem('mjb.horarios.configuracion', JSON.stringify({ diasLectivos: [] }));
    expect(leerConfiguracion().diasLectivos).toEqual(configuracionPorDefecto().diasLectivos);
  });

  it('aguanta que lo guardado esté corrupto', () => {
    localStorage.setItem('mjb.horarios.configuracion', '{esto no es json}');
    expect(leerConfiguracion()).toEqual(configuracionPorDefecto());
  });

  it('avisa en vez de romperse si el navegador no deja guardar', () => {
    vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new Error('cuota llena');
    });
    const r = guardarConfiguracion(configuracionPorDefecto());
    expect(r.ok).toBe(false);
    expect(r.mensaje).toContain('no dejó guardar');
  });

  it('no ofrece configurar el Centro de Interés ni la media técnica como materias', () => {
    const ids = materiasConfigurables().map(m => m.id);
    expect(ids).not.toContain('ci');
    expect(ids.some(id => id.startsWith('mt_'))).toBe(false);
  });
});

describe('la configuración llega al archivo del motor', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.stubGlobal('localStorage', crearAlmacenFalso());
  });

  it('cambiar la franja del Centro de Interés cambia lo que se le pide al motor', () => {
    // Es la comprobación de la tarea 9.1: si esto no pasara, la pantalla de
    // configuración sería decorativa.
    const antes = construirEntrada({ sede: 'central', jornada: 'manana', anio: 2026 });

    const c = configuracionPorDefecto();
    c.centroInteres.manana = { dia: 'viernes', bloque: 3 };
    guardarConfiguracion(c);

    const despues = construirEntrada({ sede: 'central', jornada: 'manana', anio: 2026 });
    expect(despues.config.centro_interes.manana).toEqual({ dia: 'viernes', bloque: 3 });
    expect(despues.config.centro_interes).not.toEqual(antes.config.centro_interes);
  });

  it('quitar el Centro de Interés deja la jornada sin franja reservada', () => {
    const c = configuracionPorDefecto();
    c.centroInteres.manana = null;
    guardarConfiguracion(c);
    const entrada = construirEntrada({ sede: 'central', jornada: 'manana', anio: 2026 });
    expect(entrada.config.centro_interes).toEqual({});
  });

  it('los días y los bloques configurados son los que recibe el motor', () => {
    const c = configuracionPorDefecto();
    c.diasLectivos = ['lunes', 'martes', 'miercoles'] as Dia[];
    c.bloques = { manana: 5, tarde: 5 };
    guardarConfiguracion(c);
    const entrada = construirEntrada({ sede: 'central', jornada: 'manana', anio: 2026 });
    expect(entrada.config.dias).toEqual(['lunes', 'martes', 'miercoles']);
    expect(entrada.config.bloques_por_jornada.manana).toBe(5);
  });

  it('las materias exigentes configuradas son las que van marcadas', () => {
    const c = configuracionPorDefecto();
    c.exigentes = ['sociales'];
    guardarConfiguracion(c);
    const entrada = construirEntrada({ sede: 'central', jornada: 'manana', anio: 2026 });
    const marcadas = entrada.asignaturas.filter(a => a.exigente).map(a => a.id);
    expect(marcadas).toEqual(['sociales']);
  });

  it('una hora marcada a mano llega al motor como no disponible', () => {
    // Es la comprobación de la tarea 9.2: si el motor no recibiera esto, marcar
    // en la pantalla no serviría de nada y el horario podría poner clase justo
    // donde el docente no está.
    const antes = construirEntrada({ sede: 'central', jornada: 'manana', anio: 2026 });
    const alguien = antes.docentes[0].id;

    const c = configuracionPorDefecto();
    c.noDisponible = {
      [alguien]: [{ jornada: 'manana', dia: 'viernes' as Dia, bloques: [1, 2] }],
    };
    guardarConfiguracion(c);

    const despues = construirEntrada({ sede: 'central', jornada: 'manana', anio: 2026 });
    const ficha = despues.docentes.find(d => d.id === alguien)!;
    const viernes = ficha.no_disponible.filter(f => f.dia === 'viernes');
    expect(viernes.some(f => f.bloques.includes(1) && f.bloques.includes(2))).toBe(true);
  });

  it('lo marcado se SUMA a lo que la app ya deducía, no lo reemplaza', () => {
    // Un docente mixto ya tiene días bloqueados porque baja a la tarde. Si al
    // marcarle una hora se perdieran esos, el horario saldría con él dando
    // clase en dos jornadas a la vez.
    const base = construirEntrada({ sede: 'central', jornada: 'manana', anio: 2026 });
    const mixto = base.docentes.find(d => d.no_disponible.length > 0);
    if (!mixto) return;                       // sin mixtos no hay nada que comprobar
    const antes = mixto.no_disponible.length;

    const c = configuracionPorDefecto();
    c.noDisponible = {
      [mixto.id]: [{ jornada: 'manana', dia: 'viernes' as Dia, bloques: [4] }],
    };
    guardarConfiguracion(c);

    const despues = construirEntrada({ sede: 'central', jornada: 'manana', anio: 2026 });
    const ficha = despues.docentes.find(d => d.id === mixto.id)!;
    expect(ficha.no_disponible.length).toBe(antes + 1);
  });

  it('no se cuela una hora fuera de la rejilla', () => {
    // Si la semana se acorta a 5 bloques, una marca en el 6.º ya no existe y no
    // debe viajar al motor: el validador la cantaría como fuera de la rejilla.
    const c = configuracionPorDefecto();
    c.bloques = { manana: 5, tarde: 5 };
    c.noDisponible = {
      [construirEntrada({ sede: 'central', jornada: 'manana', anio: 2026 }).docentes[0].id]:
        [{ jornada: 'manana', dia: 'lunes' as Dia, bloques: [5, 6] }],
    };
    guardarConfiguracion(c);
    const entrada = construirEntrada({ sede: 'central', jornada: 'manana', anio: 2026 });
    const todas = entrada.docentes.flatMap(d => d.no_disponible).flatMap(f => f.bloques);
    expect(todas.every(b => b <= 5)).toBe(true);
  });

  it('lo que pida quien llama manda sobre lo configurado', () => {
    // Sirve para preguntarle al motor «¿y si no hubiera Centro de Interés?»
    // sin tener que cambiar la configuración del colegio.
    const c = configuracionPorDefecto();
    c.centroInteres.manana = { dia: 'jueves', bloque: 2 };
    guardarConfiguracion(c);
    const entrada = construirEntrada({
      sede: 'central', jornada: 'manana', anio: 2026, centroInteres: null,
    });
    expect(entrada.config.centro_interes).toEqual({});
  });
});
