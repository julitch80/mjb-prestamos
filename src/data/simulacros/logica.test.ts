import { describe, it, expect } from 'vitest';
import {
  horaDePaso, cronograma, requiereAviso123, esFechaNacional, horaReportePrevio, miRol, docentesDeJornada, personasDeJornada,
  resumenPendientes, accionesDelPaso, pasosAhora, fechaLarga, puestosDeJornada,
  avisosDeJornada, jornadasDeAvisoPermitidas, puedeTocarAviso,
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
    expect(a).toHaveLength(17);
    expect(a[6].hora).toBe('10:00 a. m.');
    expect(b[6].hora).toBe('11:30 a. m.');
    expect(b[0].hora).toBe('10:30 a. m.');
    expect(a[15].duracion).toBe('30 a 40 min');
  });
});

describe('requiereAviso123', () => {
  const nac = { fecha: '2026-10-21', hora: '10:00' };
  it('no avisa si la fecha coincide, cambie o no la hora', () => {
    expect(requiereAviso123({ fecha: '2026-10-21', hora: '10:00' }, nac)).toBe(false);
    expect(requiereAviso123({ fecha: '2026-10-21', hora: '16:00' }, nac)).toBe(false);
    expect(requiereAviso123({ fecha: '2026-10-21', hora: '11:30' }, nac)).toBe(false);
  });
  it('avisa solo si cambia la fecha', () => {
    expect(requiereAviso123({ fecha: '2026-10-22', hora: '10:00' }, nac)).toBe(true);
    expect(esFechaNacional({ fecha: '2026-10-21', hora: '11:30' }, nac)).toBe(true);
    expect(esFechaNacional({ fecha: '2026-10-22', hora: '10:00' }, nac)).toBe(false);
  });
  it('hora del reporte previo: 30 min antes', () => {
    expect(horaReportePrevio('10:00')).toBe('9:30 a. m.');
    expect(horaReportePrevio('16:00')).toBe('3:30 p. m.');
  });
  it('se apaga con «Ya llamé»', () => {
    expect(requiereAviso123({ fecha: '2026-10-21', hora: '11:30', llamada123: { hecho: true } }, nac)).toBe(false);
    expect(requiereAviso123({ fecha: '2026-10-22', hora: '10:00', llamada123: { hecho: true } }, nac)).toBe(false);
  });
});

describe('alineación oficial', () => {
  it('guion con aviso previo (-30) y reporte final, en orden', () => {
    const t = PASOS.map(p => p.t);
    expect(t.some(x => x.startsWith('Aviso previo'))).toBe(true);
    expect(PASOS[PASOS.length - 1].t).toMatch(/^Reporte final/);
    const a = PASOS.map(p => p.a);
    expect([...a].sort((x, y) => x - y)).toEqual(a);
  });
  it('rol Observación y puestos', () => {
    expect(ROLES.some(r => r.k === 'obs')).toBe(true);
    expect(MISION.obs).toMatch(/sin calificar/);
    expect(PUESTOS.find(p => p.id === 'observador_1')?.rol).toBe('obs');
    expect(PUESTOS.find(p => p.id === 'equipo_evaluador_invitado_externo')?.rol).toBe('obs');
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
  it('tiene 17 pasos, 12 roles con misión y puestos con ids seguros', () => {
    expect(PASOS).toHaveLength(17);
    expect(ROLES).toHaveLength(12);
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
    const p = PASOS[7];
    expect(accionesDelPaso(p, 'docente').own).toHaveLength(0);
    expect(accionesDelPaso(p, 'pa').own.length).toBeGreaterThan(0);
    expect(accionesDelPaso(p, 'pa').base).toEqual(p.doc);
    expect(accionesDelPaso(p, 'coord').base).toEqual([]);
  });
  it('pasosAhora solo el día del simulacro', () => {
    const j = { fecha: '2026-10-21', hora: '10:00' };
    expect(pasosAhora(PASOS, j, new Date(2026, 9, 20, 10, 0))).toEqual([]);
    expect(pasosAhora(PASOS, j, new Date(2026, 9, 21, 10, 0))).toContain(6);
  });
  it('fecha larga', () => {
    expect(fechaLarga('2026-10-21')).toBe('Miércoles 21 de octubre');
  });
});

describe('avisos', () => {
  const avisos = {
    a: { texto: 'a', jornada: 'manana' as const, tipo: 'info' as const, cuando: '2026-10-12T10:00:00Z' },
    b: { texto: 'b', jornada: 'ambas' as const, tipo: 'info' as const, cuando: '2026-10-13T10:00:00Z' },
    c: { texto: 'c', jornada: 'tarde' as const, tipo: 'importante' as const, cuando: '2026-10-14T10:00:00Z' },
    d: { texto: 'd', jornada: 'manana' as const, tipo: 'importante' as const, cuando: '2026-10-11T10:00:00Z' },
  };
  it('filtra por jornada, importantes primero y más nuevos arriba', () => {
    expect(avisosDeJornada(avisos, 'manana').map(a => a.id)).toEqual(['d', 'b', 'a']);
    expect(avisosDeJornada(avisos, 'tarde').map(a => a.id)).toEqual(['c', 'b']);
    expect(avisosDeJornada(undefined, 'tarde')).toEqual([]);
  });
  it('jornadas permitidas', () => {
    expect(jornadasDeAvisoPermitidas(['manana'], false)).toEqual(['manana', 'ambas']);
    expect(jornadasDeAvisoPermitidas([], false)).toEqual([]);
    expect(jornadasDeAvisoPermitidas([], true)).toEqual(['manana', 'tarde', 'ambas']);
  });
  it('quién puede tocar un aviso', () => {
    expect(puedeTocarAviso({ jornada: 'manana', porSlot: 'x' }, ['manana'], false, 'julian')).toBe(true);
    expect(puedeTocarAviso({ jornada: 'tarde', porSlot: 'julian' }, ['manana'], false, 'julian')).toBe(false);
    expect(puedeTocarAviso({ jornada: 'ambas', porSlot: 'otro' }, ['manana'], false, 'julian')).toBe(false);
    expect(puedeTocarAviso({ jornada: 'ambas', porSlot: 'julian' }, ['manana'], false, 'julian')).toBe(true);
    expect(puedeTocarAviso({ jornada: 'ambas', porSlot: 'otro' }, [], true, null)).toBe(true);
  });
});
