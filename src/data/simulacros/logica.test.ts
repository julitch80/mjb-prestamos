import { describe, it, expect } from 'vitest';
import {
  horaDePaso, cronograma, requiereAviso123, miRol, docentesDeJornada, personasDeJornada,
  resumenPendientes, accionesDelPaso, pasosAhora, fechaLarga, puestosDeJornada,
} from './logica';
import { PASOS, PUESTOS, ASIGNACIONES_2026, ROLES, MISION } from './plantillaSismo2026';
import type { Asignaciones } from './plantillaSismo2026';

describe('horaDePaso', () => {
  it('suma minutos relativos a la alarma', () => {
    expect(horaDePaso('10:00', -60)).toBe('9:00 a. m.');
    expect(horaDePaso('10:00', 1)).toBe('10:01 a. m.');
    expect(horaDePaso('16:00', 0)).toBe('4:00 p. m.');
    expect(horaDePaso('11:30', 30)).toBe('12:00 p. m.');
    expect(horaDePaso('00:10', -20)).toBe('11:50 p. m.');
  });
});

describe('cronograma', () => {
  it('recalcula todo al cambiar la hora', () => {
    const a = cronograma(PASOS, { hora: '10:00' });
    const b = cronograma(PASOS, { hora: '11:30' });
    expect(a).toHaveLength(15);
    expect(a[5].hora).toBe('10:00 a. m.');
    expect(b[5].hora).toBe('11:30 a. m.');
    expect(b[0].hora).toBe('10:30 a. m.');
    expect(a[14].duracion).toBe('30 a 40 min');
  });
});

describe('requiereAviso123', () => {
  const nac = { fecha: '2026-10-21', hora: '10:00' };
  it('no avisa si coincide con el nacional', () => {
    expect(requiereAviso123({ fecha: '2026-10-21', hora: '10:00' }, nac)).toBe(false);
  });
  it('avisa si difiere la hora o la fecha', () => {
    expect(requiereAviso123({ fecha: '2026-10-21', hora: '11:30' }, nac)).toBe(true);
    expect(requiereAviso123({ fecha: '2026-10-22', hora: '10:00' }, nac)).toBe(true);
  });
  it('se apaga con «Ya llamé»', () => {
    expect(requiereAviso123({ fecha: '2026-10-21', hora: '11:30', llamada123: { hecho: true } }, nac)).toBe(false);
  });
});

describe('docentes por jornada', () => {
  it('los mixtos salen en ambas jornadas', () => {
    const m = docentesDeJornada('manana').map(u => u.id);
    const t = docentesDeJornada('tarde').map(u => u.id);
    for (const id of ['marta', 'monica_c', 'yoguis', 'edgar']) {
      expect(m).toContain(id);
      expect(t).toContain(id);
    }
    expect(m).toContain('julian');
    expect(t).not.toContain('julian');
    expect(t).toContain('hugo');
    expect(m).not.toContain('hugo');
  });
  it('no incluye docentes de otras sedes', () => {
    expect(docentesDeJornada('manana').some(u => u.id.startsWith('gri_') || u.id.startsWith('fin_'))).toBe(false);
  });
  it('personas incluye coordinadores de su jornada', () => {
    expect(personasDeJornada('manana').map(u => u.id)).toContain('coord_manana');
    expect(personasDeJornada('manana').map(u => u.id)).not.toContain('coord_tarde');
  });
});

describe('miRol', () => {
  it('arma el rol desde las asignaciones', () => {
    const r = miRol(ASIGNACIONES_2026, 'julian', 'manana');
    expect(r.roles).toContain('coord');
    expect(r.roles).toContain('evac');
    expect(r.roles).toContain('pa');
    expect(r.puestos.length).toBeGreaterThan(2);
  });
  it('reasignar quita al anterior y da al nuevo', () => {
    const asig = JSON.parse(JSON.stringify(ASIGNACIONES_2026)) as Asignaciones;
    expect(miRol(asig, 'hugo', 'manana').puestos).toHaveLength(0);
    asig.cronometradores_1.manana = { slot: 'jorge' };
    expect(miRol(asig, 'jorge', 'manana').roles).toContain('crono');
    asig.cronometradores_1.manana = { slot: 'adolfo' };
    expect(miRol(asig, 'jorge', 'manana').roles).not.toContain('crono');
    expect(miRol(asig, 'adolfo', 'manana').roles).toContain('crono');
  });
  it('sin slot no hay rol', () => {
    expect(miRol(ASIGNACIONES_2026, null, 'tarde').roles).toEqual([]);
  });
});

describe('plantilla', () => {
  it('tiene 15 pasos, 11 roles con misión y puestos con ids seguros', () => {
    expect(PASOS).toHaveLength(15);
    expect(ROLES).toHaveLength(11);
    for (const r of ROLES) expect(MISION[r.k]).toBeTruthy();
    for (const p of PUESTOS) expect(p.id).toMatch(/^[a-z0-9_]+$/);
    expect(new Set(PUESTOS.map(p => p.id)).size).toBe(PUESTOS.length);
  });
  it('toda asignación semilla corresponde a un puesto en esa jornada', () => {
    for (const p of PUESTOS) {
      const a = ASIGNACIONES_2026[p.id];
      expect(a).toBeTruthy();
      if (p.jornadas !== 't') expect(a.manana).toBeTruthy();
      if (p.jornadas !== 'm') expect(a.tarde).toBeTruthy();
    }
  });
  it('pendientes de la semilla', () => {
    const m = resumenPendientes(ASIGNACIONES_2026, 'manana');
    expect(m.porConfirmar).toBe(1);
    expect(m.porAsignar).toBeGreaterThan(5);
    expect(puestosDeJornada('tarde').length).toBeGreaterThan(40);
  });
  it('la semilla no incluye teléfonos', () => {
    expect(JSON.stringify(ASIGNACIONES_2026) + JSON.stringify(PASOS)).not.toMatch(/\d{7,}/);
  });
});

describe('acciones y tiempo', () => {
  it('docente de aula solo ve las suyas; brigadista suma las de docente', () => {
    const p = PASOS[6];
    expect(accionesDelPaso(p, 'docente').own).toHaveLength(0);
    expect(accionesDelPaso(p, 'pa').own.length).toBeGreaterThan(0);
    expect(accionesDelPaso(p, 'pa').base).toEqual(p.doc);
    expect(accionesDelPaso(p, 'coord').base).toEqual([]);
  });
  it('pasosAhora solo el día del simulacro', () => {
    const j = { fecha: '2026-10-21', hora: '10:00' };
    expect(pasosAhora(PASOS, j, new Date(2026, 9, 20, 10, 0))).toEqual([]);
    expect(pasosAhora(PASOS, j, new Date(2026, 9, 21, 10, 0))).toContain(5);
  });
  it('fecha larga', () => {
    expect(fechaLarga('2026-10-21')).toBe('Miércoles 21 de octubre');
  });
});
