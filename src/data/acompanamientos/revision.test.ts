import { describe, it, expect } from 'vitest';
import { revisar, cargaPorDocente } from './revision';
import { distribucionInicial } from './inicial';
import type { Distribucion } from './tipos';
import { DIAS } from './tipos';

function tiene(problemas: { tipo: string }[], tipo: string): boolean {
  return problemas.some((p) => p.tipo === tipo);
}

/** Distribución de 1 zona, cupo 1, cubierta los 5 días por Julián (manana, disponible todos los días). */
function baseValida(): Distribucion {
  return {
    jornada: 'manana',
    zonas: [{ id: 'z1', nombre: 'Zona 1', cupo: 1 }],
    asignaciones: DIAS.map((dia) => ({ zonaId: 'z1', dia, docenteId: 'julian', candado: false })),
  };
}

describe('revisar — bloqueos', () => {
  it('dos_zonas_mismo_dia: cumple cuando cada profesor está en una sola zona por día', () => {
    const dist: Distribucion = {
      jornada: 'manana',
      zonas: [
        { id: 'z1', nombre: 'Zona 1', cupo: 1 },
        { id: 'z2', nombre: 'Zona 2', cupo: 1 },
      ],
      asignaciones: [
        ...DIAS.map((dia) => ({ zonaId: 'z1', dia, docenteId: 'julian', candado: false })),
        ...DIAS.map((dia) => ({ zonaId: 'z2', dia, docenteId: 'doris', candado: false })),
      ],
    };
    expect(tiene(revisar(dist).bloqueos, 'dos_zonas_mismo_dia')).toBe(false);
  });

  it('dos_zonas_mismo_dia: rompe cuando el mismo profesor queda en dos zonas el mismo día', () => {
    const dist: Distribucion = {
      jornada: 'manana',
      zonas: [
        { id: 'z1', nombre: 'Zona 1', cupo: 1 },
        { id: 'z2', nombre: 'Zona 2', cupo: 2 },
      ],
      asignaciones: [
        ...DIAS.map((dia) => ({ zonaId: 'z1', dia, docenteId: 'julian', candado: false })),
        ...DIAS.map((dia) => ({ zonaId: 'z2', dia, docenteId: 'doris', candado: false })),
        { zonaId: 'z2', dia: 'lunes', docenteId: 'julian', candado: false }, // también en z1 el lunes
      ],
    };
    expect(tiene(revisar(dist).bloqueos, 'dos_zonas_mismo_dia')).toBe(true);
  });

  it('fuera_de_jornada: cumple cuando todos pueden cubrir su día', () => {
    expect(tiene(revisar(baseValida()).bloqueos, 'fuera_de_jornada')).toBe(false);
  });

  it('fuera_de_jornada: rompe con Edgar en la mañana (es de tarde de tiempo completo)', () => {
    const dist = baseValida();
    dist.asignaciones[0] = { ...dist.asignaciones[0], docenteId: 'edgar' };
    expect(tiene(revisar(dist).bloqueos, 'fuera_de_jornada')).toBe(true);
  });

  it('profesor_desconocido: cumple con ids reales', () => {
    expect(tiene(revisar(baseValida()).bloqueos, 'profesor_desconocido')).toBe(false);
  });

  it('profesor_desconocido: rompe con un id que no existe en USUARIOS', () => {
    const dist = baseValida();
    dist.asignaciones[0] = { ...dist.asignaciones[0], docenteId: 'nadie_existe' };
    expect(tiene(revisar(dist).bloqueos, 'profesor_desconocido')).toBe(true);
  });

  it('casilla_incompleta: cumple cuando la zona tiene su cupo lleno todos los días', () => {
    expect(tiene(revisar(baseValida()).bloqueos, 'casilla_incompleta')).toBe(false);
  });

  it('casilla_incompleta: rompe cuando falta un profesor un día', () => {
    const dist = baseValida();
    dist.asignaciones = dist.asignaciones.filter((a) => a.dia !== 'lunes');
    expect(tiene(revisar(dist).bloqueos, 'casilla_incompleta')).toBe(true);
  });

  it('cupo_excedido: cumple cuando no se pasa del cupo', () => {
    expect(tiene(revisar(baseValida()).bloqueos, 'cupo_excedido')).toBe(false);
  });

  it('cupo_excedido: rompe cuando hay más profesores que el cupo', () => {
    const dist = baseValida();
    dist.asignaciones.push({ zonaId: 'z1', dia: 'lunes', docenteId: 'doris', candado: false });
    expect(tiene(revisar(dist).bloqueos, 'cupo_excedido')).toBe(true);
  });

  it('zona_inexistente: cumple cuando toda asignación apunta a una zona real', () => {
    expect(tiene(revisar(baseValida()).bloqueos, 'zona_inexistente')).toBe(false);
  });

  it('zona_inexistente: rompe cuando una asignación apunta a una zona borrada', () => {
    const dist = baseValida();
    dist.asignaciones.push({ zonaId: 'zona-que-no-existe', dia: 'lunes', docenteId: 'doris', candado: false });
    expect(tiene(revisar(dist).bloqueos, 'zona_inexistente')).toBe(true);
  });

  it('repetido_en_casilla: cumple cuando nadie se repite en la misma casilla', () => {
    expect(tiene(revisar(baseValida()).bloqueos, 'repetido_en_casilla')).toBe(false);
  });

  it('repetido_en_casilla: rompe cuando el mismo profesor aparece dos veces en la misma zona y día', () => {
    const dist = baseValida();
    dist.zonas[0].cupo = 2;
    dist.asignaciones.push({ zonaId: 'z1', dia: 'lunes', docenteId: 'julian', candado: false });
    expect(tiene(revisar(dist).bloqueos, 'repetido_en_casilla')).toBe(true);
  });
});

describe('revisar — avisos', () => {
  it('dia_cargado: cumple cuando el día tiene menos de 5 clases (lunes de Julián: 4)', () => {
    const dist = baseValida();
    dist.asignaciones = dist.asignaciones.filter((a) => a.dia === 'lunes');
    expect(tiene(revisar(dist).avisos, 'dia_cargado')).toBe(false);
  });

  it('dia_cargado: rompe con un día de 5+ clases (miércoles de Julián: 6)', () => {
    const dist = baseValida();
    dist.asignaciones = dist.asignaciones.filter((a) => a.dia === 'miercoles');
    dist.asignaciones.push(
      { zonaId: 'z1', dia: 'lunes', docenteId: 'julian', candado: false },
      { zonaId: 'z1', dia: 'martes', docenteId: 'julian', candado: false },
      { zonaId: 'z1', dia: 'jueves', docenteId: 'julian', candado: false },
      { zonaId: 'z1', dia: 'viernes', docenteId: 'julian', candado: false },
    );
    expect(tiene(revisar(dist).avisos, 'dia_cargado')).toBe(true);
  });

  it('carga_desigual: cumple cuando nadie tiene acompañamientos (todos en 0)', () => {
    const dist: Distribucion = { jornada: 'manana', zonas: [{ id: 'z1', nombre: 'Zona 1', cupo: 0 }], asignaciones: [] };
    expect(tiene(revisar(dist).avisos, 'carga_desigual')).toBe(false);
  });

  it('carga_desigual: rompe cuando un profesor tiene mucho más que otro', () => {
    const dist: Distribucion = {
      jornada: 'manana',
      zonas: [{ id: 'z1', nombre: 'Zona 1', cupo: 1 }],
      asignaciones: [
        { zonaId: 'z1', dia: 'lunes', docenteId: 'julian', candado: false },
        { zonaId: 'z1', dia: 'martes', docenteId: 'julian', candado: false },
        { zonaId: 'z1', dia: 'miercoles', docenteId: 'julian', candado: false },
      ],
    };
    // z1 solo tiene cupo 1 y esos 3 días asignados a Julián; el resto de
    // docentes de la jornada queda en 0 -> diferencia normalizada 3 > 1.
    expect(tiene(revisar(dist).avisos, 'carga_desigual')).toBe(true);
  });

  it('mixto_excedido: cumple cuando la mixta no pasa de su meta (Marta con 1 acompañamiento)', () => {
    const dist: Distribucion = {
      jornada: 'manana',
      zonas: [
        { id: 'z1', nombre: 'Zona 1', cupo: 1 },
        { id: 'z2', nombre: 'Zona 2', cupo: 1 },
      ],
      asignaciones: [{ zonaId: 'z1', dia: 'lunes', docenteId: 'marta', candado: false }],
    };
    expect(tiene(revisar(dist).avisos, 'mixto_excedido')).toBe(false);
  });

  it('mixto_excedido: rompe cuando la mixta se pasa de su meta (Marta con varios acompañamientos)', () => {
    const dist: Distribucion = {
      jornada: 'manana',
      zonas: [{ id: 'z1', nombre: 'Zona 1', cupo: 1 }],
      asignaciones: [
        { zonaId: 'z1', dia: 'lunes', docenteId: 'marta', candado: false },
        { zonaId: 'z1', dia: 'miercoles', docenteId: 'marta', candado: false },
        { zonaId: 'z1', dia: 'viernes', docenteId: 'marta', candado: false },
      ],
    };
    expect(tiene(revisar(dist).avisos, 'mixto_excedido')).toBe(true);
  });
});

describe('revisar — distribución inicial real', () => {
  it('distribucionInicial("manana") no tiene ningún bloqueo', () => {
    const { bloqueos } = revisar(distribucionInicial('manana'));
    expect(bloqueos).toEqual([]);
  });

  it('distribucionInicial("tarde") no tiene ningún bloqueo', () => {
    const { bloqueos } = revisar(distribucionInicial('tarde'));
    expect(bloqueos).toEqual([]);
  });
});

describe('cargaPorDocente', () => {
  it('incluye a todos los docentes de la jornada, incluidos los de cero acompañamientos', () => {
    const mapa = cargaPorDocente(distribucionInicial('manana'));
    expect(mapa.size).toBeGreaterThan(0);
    // Julián tiene al menos una asignación en la lista original de maestros.ts.
    expect(mapa.has('julian')).toBe(true);
  });
});
