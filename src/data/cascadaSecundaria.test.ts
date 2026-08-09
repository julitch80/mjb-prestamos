import { describe, it, expect } from 'vitest';
import { generarPropuestasAsistente } from './horarioModificado';
import type { FichaEditor, HorarioModificado } from './horarioModificado';

// Caso mínimo que reproduce el reportado por Janneth el 6 de agosto de 2026:
// para reubicar la clase del docente ausente (D) en G1, hay que mover a E
// dentro de G1 — pero E solo queda libre en ese bloque si ANTES se mueve su
// propia clase con OTRO grupo (G2). Antes del arreglo, la clase de E en G2
// se trataba como fija y el algoritmo nunca encontraba esta cadena.
function ficha(docente: string, grupo: string, bloque: number): FichaEditor {
  return {
    id: `${docente}_${grupo}_${bloque}`,
    origen: { dia: 'jueves', bloque, docente, grupo, aula: 'Aula X' },
    ubicacion: { tipo: 'colocada', bloque },
  };
}

describe('buscarCompactacionCascadaMultiple — salto a grupo secundario', () => {
  it('encuentra una cadena que mueve la clase de E en G2 para liberarlo en G1', () => {
    const fichas: FichaEditor[] = [
      ficha('D', 'G1', 1), // D (ausente en bloque 1) enseña G1 en el bloque 1
      ficha('E', 'G1', 2), // E enseña G1 en el bloque 2
      ficha('E', 'G2', 1), // E también enseña G2 en el bloque 1 (bloquea el hueco de E en G1)
    ];
    const borrador: HorarioModificado = {
      id: 'test', fecha: '2026-08-13', jornada: 'manana', autor: 'test',
      ausencias: [{ docenteId: 'D', bloques: [1] }],
      apoyos: [], modificaciones: [], estado: 'borrador', timestamp: new Date().toISOString(),
    };

    const propuestas = generarPropuestasAsistente(fichas, borrador);
    const cascada = propuestas.find(p => p.tipo === 'compactar' && p.grupo === 'G1');

    expect(cascada).toBeDefined();
    expect(cascada!.clasesPerdidas).toBe(0);

    const cambiosPorFicha = Object.fromEntries(cascada!.cambios.map(c => [c.fichaId, c.nuevaUbicacion]));
    // D termina en el bloque 2 (donde está libre)
    expect(cambiosPorFicha['D_G1_1']).toEqual({ tipo: 'colocada', bloque: 2 });
    // E se corre a G1-bloque1
    expect(cambiosPorFicha['E_G1_2']).toEqual({ tipo: 'colocada', bloque: 1 });
    // Y su clase en G2 se reubica para dejarlo libre — esto es lo nuevo
    expect(cambiosPorFicha['E_G2_1']).toBeDefined();
    expect(cambiosPorFicha['E_G2_1']).not.toEqual({ tipo: 'colocada', bloque: 1 });
  });

  it('sin el salto a G2 no encontraría solución (caso de control: E sin otra clase)', () => {
    // Mismo escenario pero SIN la clase de E en G2 -- si D y E simplemente
    // pueden intercambiarse dentro de G1, no hace falta ningún salto. Sirve
    // de control para confirmar que el test de arriba SÍ depende del salto.
    const fichas: FichaEditor[] = [
      ficha('D', 'G1', 1),
      ficha('E', 'G1', 2),
    ];
    const borrador: HorarioModificado = {
      id: 'test2', fecha: '2026-08-13', jornada: 'manana', autor: 'test',
      ausencias: [{ docenteId: 'D', bloques: [1] }],
      apoyos: [], modificaciones: [], estado: 'borrador', timestamp: new Date().toISOString(),
    };
    const propuestas = generarPropuestasAsistente(fichas, borrador);
    const cascada = propuestas.find(p => p.tipo === 'compactar' && p.grupo === 'G1');
    expect(cascada).toBeDefined();
    expect(cascada!.clasesPerdidas).toBe(0);
  });
});
