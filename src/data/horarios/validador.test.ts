/**
 * La misma batería que prueba el validador del motor, corriendo aquí.
 *
 * Es a propósito: si las dos mitades no juzgan igual, un horario podría salir
 * aprobado de un lado y rechazado del otro, y el coordinador no sabría a cuál
 * creer. Cada prueba parte de un horario correcto, le siembra UN error y exige
 * que el validador encuentre exactamente eso —el recuento completo, no solo lo
 * buscado—, de modo que si algún día empieza a inventar violaciones de más, se
 * nota aquí.
 */

import { describe, expect, it } from 'vitest';

import type { ClaseGenerada, Dia, EntradaGenerador } from './tipos';
import type { Destino } from './validador';
import { avisos, duras, puedeColocar, validar } from './validador';

// --------------------------------------------------------------------------
// El mismo colegio de juguete del motor: 2 días, 3 bloques, 2 grupos, 2 docentes.
// --------------------------------------------------------------------------

const ENTRADA = {
  version: '1.0',
  colegio: 'Colegio de prueba',
  anio: 2026,
  alcance: { sede: 'central', sede_nombre: 'Sede Central', jornada: 'manana' },
  config: {
    dias: ['lunes', 'martes'],
    bloques_por_jornada: { manana: 3, tarde: 3 },
    centro_interes: { manana: { dia: 'martes', bloque: 3 } },
    contrajornada_media_tecnica: [],
  },
  asignaturas: [{ id: 'mat', nombre: 'Matemáticas', exigente: true }],
  docentes: [
    { id: 'uriel', nombre: 'Uriel', jornada: 'manana', aula_fija: 'Aula 10', no_disponible: [] },
    // Marta no tiene aula propia, y el lunes a tercera hora no está.
    {
      id: 'marta', nombre: 'Marta', jornada: 'manana',
      no_disponible: [{ jornada: 'manana', dia: 'lunes', bloques: [3] }],
    },
  ],
  grupos: [{ id: '9.1', jornada: 'manana' }, { id: '9.2', jornada: 'manana' }],
  aulas: [
    { id: 'Aula 10', tipo: 'normal', compartida: true },
    { id: 'Aula 11', tipo: 'normal', compartida: false },
    // Aula vacía, para sembrar "aula equivocada" sin provocar de paso un choque.
    { id: 'Aula 12', tipo: 'normal', compartida: false },
    { id: 'Patio', tipo: 'deportivo', compartida: true, exclusiva: false },
  ],
  asignacion: [
    { docente: 'uriel', asignatura: 'mat', grupo: '9.1', horas: 3 },
    { docente: 'uriel', asignatura: 'mat', grupo: '9.2', horas: 2 },
    { docente: 'marta', asignatura: 'mat', grupo: '9.1', horas: 2 },
    { docente: 'marta', asignatura: 'mat', grupo: '9.2', horas: 2 },
  ],
  fijadas: [],
  pesos: { bloques_dobles: 10, exigentes_temprano: 3, mixtos_concentrados: 5 },
  limite_segundos: 60,
} as unknown as EntradaGenerador;

const clase = (
  dia: string, bloque: number, docente: string, grado: string, aula: string,
) => ({ dia, bloque, docente, grado, aula, jornada: 'manana' } as unknown as ClaseGenerada);

const HORARIO_CORRECTO: ClaseGenerada[] = [
  clase('lunes', 1, 'uriel', '9.1', 'Aula 10'),
  clase('lunes', 2, 'uriel', '9.1', 'Aula 10'),
  clase('lunes', 3, 'uriel', '9.1', 'Aula 10'),
  clase('martes', 1, 'uriel', '9.2', 'Aula 10'),
  clase('martes', 2, 'uriel', '9.2', 'Aula 10'),
  clase('lunes', 1, 'marta', '9.2', 'Aula 11'),
  clase('lunes', 2, 'marta', '9.2', 'Aula 11'),
  clase('martes', 1, 'marta', '9.1', 'Aula 11'),
  clase('martes', 2, 'marta', '9.1', 'Aula 11'),
];

/** Recuento por tipo, como el `tipos()` de las pruebas del motor. */
function tipos(horario: ClaseGenerada[]): Record<string, number> {
  const cuenta: Record<string, number> = {};
  for (const v of validar(ENTRADA, horario)) cuenta[v.tipo] = (cuenta[v.tipo] ?? 0) + 1;
  return cuenta;
}

/**
 * Copia el horario correcto y modifica una clase (índice -> campos).
 *
 * Los valores van sin tipar a propósito. Parte de lo que hay que sembrar aquí
 * —un bloque 9, un día "sabado"— son cosas que el tipo de `ClaseGenerada`
 * prohíbe, y es justo el motivo de que el validador exista: los horarios llegan
 * en un archivo JSON, donde nadie ha comprobado nada. Tipar esto estrictamente
 * dejaría sin probar los casos que más importan.
 */
function sembrar(cambios: Record<number, Record<string, unknown>>): ClaseGenerada[] {
  const h = HORARIO_CORRECTO.map(c => ({ ...c }));
  for (const [i, campos] of Object.entries(cambios)) Object.assign(h[Number(i)], campos);
  return h;
}

describe('validador de horarios', () => {
  it('un horario correcto no tiene ninguna violación', () => {
    expect(tipos(HORARIO_CORRECTO)).toEqual({});
  });

  it('el choque de aula avisa pero no invalida', () => {
    // Es la regla del colegio: dos clases en un salón se miran y a veces se
    // aceptan. Si contara como grave, un horario que allí dan por bueno saldría
    // marcado como inválido.
    const h = sembrar({ 7: { aula: 'Aula 10' } });
    expect(tipos(h)).toEqual({ choque_aula: 1 });
    expect(duras(validar(ENTRADA, h))).toEqual([]);
    expect(avisos(validar(ENTRADA, h))).toHaveLength(1);
  });

  it('dos clases en el Patio no son ni aviso', () => {
    expect(tipos(sembrar({ 0: { aula: 'Patio' }, 5: { aula: 'Patio' } })))
      .toEqual({ aula_incorrecta: 1 });
  });

  it('un aula ocupada se detecta aunque no esté marcada como compartida', () => {
    expect(tipos(sembrar({ 0: { aula: 'Aula 11' } })))
      .toEqual({ aula_incorrecta: 1, choque_aula: 1 });
  });

  it('detecta el aula equivocada', () => {
    expect(tipos(sembrar({ 0: { aula: 'Aula 12' } }))).toEqual({ aula_incorrecta: 1 });
  });

  it('detecta a un docente en una franja donde no está', () => {
    expect(tipos(sembrar({ 6: { bloque: 3 } }))).toEqual({ no_disponible: 1 });
  });

  it('detecta una clase en la franja del Centro de Interés', () => {
    expect(tipos(sembrar({ 4: { bloque: 3 } }))).toEqual({ franja_reservada: 1 });
  });

  it('detecta un bloque fuera de la rejilla', () => {
    expect(tipos(sembrar({ 0: { bloque: 9 } }))).toEqual({ fuera_de_rejilla: 1 });
  });

  it('detecta un día fuera de la rejilla', () => {
    expect(tipos(sembrar({ 0: { dia: 'sabado' } }))).toEqual({ fuera_de_rejilla: 1 });
  });

  it('detecta que faltan horas', () => {
    expect(tipos(HORARIO_CORRECTO.slice(1))).toEqual({ cobertura: 1 });
  });

  it('detecta que sobran horas', () => {
    // La hora de más cae en la franja del Centro de Interés: son dos problemas
    // distintos y el validador debe cantar los dos.
    const h = [...HORARIO_CORRECTO, clase('martes', 3, 'marta', '9.2', 'Aula 11')];
    expect(tipos(h)).toEqual({ cobertura: 1, franja_reservada: 1 });
  });

  it('detecta un docente en dos sitios a la vez', () => {
    // Cambiarle el docente a una clase de Marta deja a Uriel duplicado y de paso
    // descuadra las horas de los dos. Las tres cosas son ciertas.
    expect(tipos(sembrar({ 6: { docente: 'uriel' } })))
      .toEqual({ choque_docente: 1, cobertura: 2, aula_incorrecta: 1 });
  });

  it('detecta un grupo con dos clases a la vez', () => {
    expect(tipos(sembrar({ 5: { grado: '9.1' } })))
      .toEqual({ choque_grupo: 1, cobertura: 2 });
  });

  it('quitar cualquier clase se nota', () => {
    for (let i = 0; i < HORARIO_CORRECTO.length; i++) {
      const h = HORARIO_CORRECTO.filter((_, j) => j !== i);
      expect(tipos(h).cobertura, `al quitar la clase ${i}`).toBe(1);
    }
  });
});

describe('mover una clase', () => {
  // El día va convertido a mano porque una de las pruebas usa "sabado", que no
  // es un día lectivo: comprobar que se rechaza es justamente lo que se busca.
  const destino = (dia: string, bloque: number): Destino => ({ dia: dia as Dia, bloque });

  it('permite mover a una franja libre', () => {
    const sola = clase('lunes', 1, 'uriel', '9.1', 'Aula 10');
    const r = puedeColocar(ENTRADA, [sola], sola, destino('lunes', 2));
    expect(r.permitido).toBe(true);
    expect(r.avisos).toEqual([]);
  });

  it('dice quién estorba, no "movimiento inválido"', () => {
    // Es la diferencia entre que el coordinador sepa qué hacer y que no.
    // Marta quiere llevar su clase con 9.2 a una hora en que 9.2 está con Uriel.
    const laDeMarta = clase('lunes', 1, 'marta', '9.2', 'Aula 11');
    const horario = [laDeMarta, clase('lunes', 2, 'uriel', '9.2', 'Aula 10')];
    const r = puedeColocar(ENTRADA, horario, laDeMarta, destino('lunes', 2));
    expect(r.permitido).toBe(false);
    expect(r.motivo).toContain('9.2');
    expect(r.motivo).toContain('Uriel');
  });

  it('bloquea si el docente queda en dos sitios a la vez', () => {
    const suya = clase('lunes', 1, 'uriel', '9.1', 'Aula 10');
    const horario = [suya, clase('lunes', 2, 'uriel', '9.2', 'Aula 10')];
    const r = puedeColocar(ENTRADA, horario, suya, destino('lunes', 2));
    expect(r.permitido).toBe(false);
    expect(r.motivo).toContain('Uriel');
    expect(r.motivo).toContain('9.2');
  });

  it('bloquea la franja del Centro de Interés', () => {
    const suya = clase('lunes', 1, 'uriel', '9.1', 'Aula 10');
    const r = puedeColocar(ENTRADA, [suya], suya, destino('martes', 3));
    expect(r.permitido).toBe(false);
    expect(r.motivo).toContain('Centro de Interés');
  });

  it('bloquea una franja donde el docente no está disponible', () => {
    const suya = clase('lunes', 1, 'marta', '9.2', 'Aula 11');
    const r = puedeColocar(ENTRADA, [suya], suya, destino('lunes', 3));
    expect(r.permitido).toBe(false);
    expect(r.motivo).toContain('Marta');
  });

  it('bloquea una franja que no existe en la semana', () => {
    const suya = clase('lunes', 1, 'uriel', '9.1', 'Aula 10');
    expect(puedeColocar(ENTRADA, [suya], suya, destino('sabado', 1)).permitido).toBe(false);
    expect(puedeColocar(ENTRADA, [suya], suya, destino('lunes', 9)).permitido).toBe(false);
  });

  it('el aula ocupada deja pasar el movimiento, pero avisa', () => {
    // La regla del colegio: el salón es aviso, no bloqueo.
    const suya = clase('lunes', 1, 'marta', '9.1', 'Aula 11');
    const horario = [suya, clase('lunes', 2, 'uriel', '9.2', 'Aula 11')];
    const r = puedeColocar(ENTRADA, horario, suya, destino('lunes', 2));
    expect(r.permitido).toBe(true);
    expect(r.avisos).toHaveLength(1);
    expect(r.avisos[0]).toContain('Aula 11');
  });

  it('el Patio no genera ni aviso al moverse', () => {
    const suya = clase('lunes', 1, 'marta', '9.1', 'Patio');
    const horario = [suya, clase('lunes', 2, 'uriel', '9.2', 'Patio')];
    const r = puedeColocar(ENTRADA, horario, suya, destino('lunes', 2));
    expect(r.permitido).toBe(true);
    expect(r.avisos).toEqual([]);
  });
});
