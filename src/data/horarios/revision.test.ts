/**
 * Pruebas de la revisión de datos.
 *
 * Se comprueban contra los datos reales del colegio y contra los números que ya
 * da el motor: si las dos mitades no dijeran lo mismo, el coordinador vería un
 * aviso en la pantalla y otro distinto en la consola, y no sabría a cuál creer.
 */

import { describe, expect, it } from 'vitest';

import { construirEntrada } from './contrato';
import { revisar } from './revision';
import type { EntradaGenerador } from './tipos';

const manana = construirEntrada({ sede: 'central', jornada: 'manana', anio: 2026 });
const tarde = construirEntrada({ sede: 'central', jornada: 'tarde', anio: 2026 });

/** Copia profunda, para poder estropear los datos sin afectar a otras pruebas. */
const copia = (e: EntradaGenerador) => JSON.parse(JSON.stringify(e)) as EntradaGenerador;

describe('revisión de datos', () => {
  it('la jornada de la mañana cuadra', () => {
    expect(revisar(manana).cuadra).toBe(true);
  });

  it('la de la tarde no cuadra: a los diez grupos les sobra una hora', () => {
    // Es el problema real de 2026: con la franja del Centro de Interés
    // reservada, los grupos de tarde piden 30 horas donde caben 29. El motor
    // llega al mismo número; esta prueba lo fija para que no se pierda.
    const r = revisar(tarde);
    expect(r.cuadra).toBe(false);
    const deGrupo = r.graves.filter(a => a.ambito === 'grupo');
    expect(deGrupo).toHaveLength(10);
    expect(deGrupo.every(a => a.mensaje.includes('sobran 1'))).toBe(true);
  });

  it('no da por sobrecargado a quien baja a la tarde un día que no es el del CI', () => {
    // Yoguis baja a la tarde solo los miércoles: seis horas libres y seis
    // asignadas. El Centro de Interés de la tarde es el martes, que para él ya
    // está bloqueado. La cuenta vieja se lo restaba otra vez y lo daba por
    // sobrecargado sin estarlo. Lo descubrió Julián mirando la pantalla.
    const deDocente = revisar(tarde).avisos.filter(a => a.ambito === 'docente');
    expect(deDocente.map(a => a.quien)).toEqual([]);
  });

  it('nombra al grupo concreto, no dice "hay un problema"', () => {
    const r = revisar(tarde);
    expect(r.graves.map(a => a.quien)).toContain('6º1');
  });

  it('nombra al docente sobrecargado antes de generar', () => {
    // Es la comprobación de la tarea 9.3. Se le quita disponibilidad a una
    // persona hasta que no le quepan sus horas.
    const rota = copia(manana);
    const quien = rota.docentes.find(d => d.no_disponible.length === 0)!;
    quien.no_disponible = rota.config.dias.slice(0, 4).map(dia => ({
      jornada: 'manana' as const,
      dia,
      bloques: Array.from({ length: rota.config.bloques_por_jornada.manana }, (_, i) => i + 1),
    }));

    const r = revisar(rota);
    const suyo = r.graves.find(a => a.ambito === 'docente' && a.quien === quien.id);
    expect(suyo).toBeDefined();
    expect(suyo!.mensaje).toContain(quien.nombre);
    expect(suyo!.mensaje).toContain('bloques disponibles');
  });

  it('avisa de la media técnica que el motor no puede ver', () => {
    // Es el hueco conocido: esas horas ocurren, no están en la asignación, y sin
    // declararlas el horario puede salir pareciendo válido sin serlo.
    const todos = [...revisar(manana).leves, ...revisar(tarde).leves];
    const deDatos = todos.filter(a => a.ambito === 'datos').map(a => a.quien);
    expect(deDatos).toContain('felipe');
    expect(deDatos).toContain('valentina');
  });

  it('deja de avisar de la media técnica en cuanto se declaran sus horas', () => {
    const arreglada = copia(manana);
    for (const d of arreglada.docentes) {
      d.no_disponible = [{ jornada: 'manana', dia: arreglada.config.dias[0], bloques: [1] }];
    }
    const deDatos = revisar(arreglada).leves.filter(a => a.ambito === 'datos');
    expect(deDatos).toEqual([]);
  });

  it('un grupo con horas de sobra es aviso leve, no grave', () => {
    // Quedarse corto no impide generar: deja huecos, que el coordinador puede
    // querer. Pasarse sí lo impide, porque no cabe.
    const floja = copia(manana);
    floja.asignacion = floja.asignacion.filter((_, i) => i > 0);
    const r = revisar(floja);
    expect(r.leves.some(a => a.ambito === 'grupo')).toBe(true);
    expect(r.graves.filter(a => a.ambito === 'grupo')).toEqual([]);
  });

  it('quitar la franja del Centro de Interés hace que la tarde cuadre', () => {
    // Confirma que el problema de la tarde es exactamente esa hora, y no otra
    // cosa: es la información que hay que llevarle a coordinación.
    const sinCI = copia(tarde);
    sinCI.config.centro_interes = {};
    expect(revisar(sinCI).cuadra).toBe(true);
  });
});
