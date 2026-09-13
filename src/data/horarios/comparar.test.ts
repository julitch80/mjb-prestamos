import { describe, expect, it } from 'vitest';

import {
  compararHorarios, docentesConVariosDiasLlenos, franjasCambiadas, movidasPorDocente,
} from './comparar';
import type { ClaseGenerada } from './tipos';

const clase = (
  dia: string, bloque: number, docente: string, grado: string, asignatura?: string,
) => ({
  dia, bloque, docente, grado, asignatura, aula: 'Aula 1', jornada: 'manana',
} as unknown as ClaseGenerada);

const BASE: ClaseGenerada[] = [
  clase('lunes', 1, 'uriel', '9.1', 'mat'),
  clase('lunes', 2, 'uriel', '9.1', 'mat'),
  clase('martes', 1, 'marta', '9.2', 'leng'),
];

describe('comparar horarios', () => {
  it('dos horarios iguales no tienen cambios', () => {
    const r = compararHorarios(BASE, BASE.map(c => ({ ...c })));
    expect(r.movidas).toEqual([]);
    expect(r.quitadas).toEqual([]);
    expect(r.agregadas).toEqual([]);
    expect(r.intactas).toBe(3);
  });

  it('el orden de la lista no cuenta como cambio', () => {
    const r = compararHorarios(BASE, [...BASE].reverse().map(c => ({ ...c })));
    expect(r.movidas).toEqual([]);
    expect(r.intactas).toBe(3);
  });

  it('una clase movida se reporta con su origen y su destino', () => {
    const despues = BASE.map(c => ({ ...c }));
    despues[2] = clase('viernes', 4, 'marta', '9.2', 'leng');
    const r = compararHorarios(BASE, despues);
    expect(r.movidas).toHaveLength(1);
    expect(r.movidas[0]).toMatchObject({
      docente: 'marta',
      grupo: '9.2',
      de: { dia: 'martes', bloque: 1 },
      a: { dia: 'viernes', bloque: 4 },
    });
    expect(r.intactas).toBe(2);
  });

  it('mover una hora de una materia de varias no arrastra a las demás', () => {
    // Uriel tiene dos horas con 9.1: solo se mueve una.
    const despues = BASE.map(c => ({ ...c }));
    despues[1] = clase('jueves', 5, 'uriel', '9.1', 'mat');
    const r = compararHorarios(BASE, despues);
    expect(r.movidas).toHaveLength(1);
    expect(r.movidas[0].de).toEqual({ dia: 'lunes', bloque: 2 });
    expect(r.intactas).toBe(2);
  });

  it('devolver una clase a su sitio deja de contar como cambio', () => {
    // Es la razón de comparar el resultado en vez de registrar acciones.
    const movido = BASE.map(c => ({ ...c }));
    movido[0] = clase('viernes', 6, 'uriel', '9.1', 'mat');
    const devuelto = movido.map(c => ({ ...c }));
    devuelto[0] = clase('lunes', 1, 'uriel', '9.1', 'mat');
    expect(compararHorarios(BASE, devuelto).movidas).toEqual([]);
  });

  it('distingue lo que desapareció de lo que apareció', () => {
    const despues = [...BASE.slice(0, 2), clase('lunes', 3, 'hugo', '9.3', 'soc')];
    const r = compararHorarios(BASE, despues);
    expect(r.quitadas.map(c => c.docente)).toEqual(['marta']);
    expect(r.agregadas.map(c => c.docente)).toEqual(['hugo']);
    expect(r.movidas).toEqual([]);
  });

  it('dos docentes distintos con el mismo grupo no se confunden', () => {
    const antes = [
      clase('lunes', 1, 'uriel', '9.1', 'mat'),
      clase('lunes', 2, 'marta', '9.1', 'mat'),
    ];
    const despues = [
      clase('lunes', 1, 'uriel', '9.1', 'mat'),
      clase('martes', 2, 'marta', '9.1', 'mat'),
    ];
    const r = compararHorarios(antes, despues);
    expect(r.movidas).toHaveLength(1);
    expect(r.movidas[0].docente).toBe('marta');
  });

  it('señala la franja nueva de cada clase movida', () => {
    const despues = BASE.map(c => ({ ...c }));
    despues[2] = clase('viernes', 4, 'marta', '9.2', 'leng');
    const marcadas = franjasCambiadas(BASE, despues);
    expect(marcadas.size).toBe(1);
    expect([...marcadas][0]).toContain('viernes');
  });

  it('agrupa los movimientos por docente, de quien más cambió a quien menos', () => {
    // Doscientas líneas sueltas no sirven; «a Uriel le cambiaron dos» sí.
    const despues = [
      clase('martes', 5, 'uriel', '9.1', 'mat'),
      clase('martes', 6, 'uriel', '9.1', 'mat'),
      clase('viernes', 1, 'marta', '9.2', 'leng'),
    ];
    const grupos = movidasPorDocente(compararHorarios(BASE, despues).movidas);
    expect(grupos.map(([d, l]) => [d, l.length])).toEqual([['uriel', 2], ['marta', 1]]);
  });
});

describe('docentes con más de un día lleno', () => {
  const bloques = { manana: 2, tarde: 2 };

  it('cuenta un día como lleno si tiene tantas clases como bloques', () => {
    // Misma definición que el motor: si no coincidieran, la pantalla y la
    // consola darían números distintos y no se sabría cuál creer.
    const h = [
      clase('lunes', 1, 'uriel', '9.1', 'mat'), clase('lunes', 2, 'uriel', '9.2', 'mat'),
      clase('martes', 1, 'uriel', '9.1', 'mat'), clase('martes', 2, 'uriel', '9.2', 'mat'),
      clase('lunes', 1, 'marta', '9.3', 'leng'), clase('lunes', 2, 'marta', '9.4', 'leng'),
    ];
    expect(docentesConVariosDiasLlenos(h, bloques)).toEqual([{ docente: 'uriel', dias: 2 }]);
  });

  it('un solo día lleno se considera aceptable y no se lista', () => {
    const h = [clase('lunes', 1, 'marta', '9.3', 'leng'), clase('lunes', 2, 'marta', '9.4', 'leng')];
    expect(docentesConVariosDiasLlenos(h, bloques)).toEqual([]);
  });
});
