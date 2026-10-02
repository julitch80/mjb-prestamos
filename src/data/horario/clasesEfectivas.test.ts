import { describe, it, expect } from 'vitest';
import { clasesEfectivas, proximaClaseEfectiva } from './clasesEfectivas';
import type { HorarioModificado, JornadaReducida } from '../horarioModificado';

// 2026-10-06 martes, 2026-10-10 sábado, 2026-10-12 lunes festivo.
const base = [
  { jornada: 'manana', dia: 'martes', bloque: 1, docente: 'ana', grado: '9.1', aula: 'Aula 1' },
  { jornada: 'manana', dia: 'martes', bloque: 2, docente: 'ana', grado: '9.1', aula: 'Aula 1' },
  { jornada: 'manana', dia: 'martes', bloque: 3, docente: 'ana', grado: '10.1', aula: 'Aula 1' },
  { jornada: 'manana', dia: 'martes', bloque: 5, docente: 'luis', grado: '10.2', aula: 'Aula 2' },
  { jornada: 'manana', dia: 'martes', bloque: 6, docente: 'edgar', grado: '11.1/CI', aula: 'Auditorio' },
  { jornada: 'tarde', dia: 'martes', bloque: 1, docente: 'edgar', grado: '8º1', aula: 'A7' },
  { jornada: 'tarde', dia: 'martes', bloque: 4, docente: 'edgar', grado: '6º2', aula: 'A9' },
];

const hm = (extra: Partial<HorarioModificado>): HorarioModificado => ({
  id: 'h1', fecha: '2026-10-06', jornada: 'manana', autor: 'coord', ausencias: [], apoyos: [],
  modificaciones: [], estado: 'guardado', timestamp: '2026-10-05T10:00:00Z', ...extra,
});

describe('clasesEfectivas', () => {
  it('día normal: horas oficiales del bloque', () => {
    const r = clasesEfectivas('ana', '2026-10-06', { horarioBase: base });
    expect(r.map((c) => [c.bloque, c.grado, c.inicio, c.fin])).toEqual([
      [1, '9.1', '06:00', '06:55'], [2, '9.1', '06:55', '07:50'], [3, '10.1', '08:10', '09:05'],
    ]);
    expect(r[0]).toMatchObject({ aula: 'Aula 1', jornada: 'manana' });
  });

  it('sin slot o fin de semana → []', () => {
    expect(clasesEfectivas(null, '2026-10-06', { horarioBase: base })).toEqual([]);
    expect(clasesEfectivas('ana', '2026-10-10', { horarioBase: base })).toEqual([]);
  });

  it('bloque movido: aparece en el bloque nuevo y marcado', () => {
    const mod = hm({ modificaciones: [{ bloqueOriginal: 3, bloqueNuevo: 4, docenteOriginal: 'ana', grupo: '10.1', aula: 'Aula 1' }] });
    const r = clasesEfectivas('ana', '2026-10-06', { horarioBase: base, horariosModificados: [mod] });
    const c = r.find((x) => x.grado === '10.1')!;
    expect(c.bloque).toBe(4);
    expect(c.inicio).toBe('09:05');
    expect(c.movida).toBe(true);
  });

  it('bloque eliminado (bloqueNuevo null) no aparece', () => {
    const mod = hm({ modificaciones: [{ bloqueOriginal: 3, bloqueNuevo: null, docenteOriginal: 'ana', grupo: '10.1', aula: 'Aula 1' }] });
    const r = clasesEfectivas('ana', '2026-10-06', { horarioBase: base, horariosModificados: [mod] });
    expect(r.map((c) => c.bloque)).toEqual([1, 2]);
  });

  it('docente ausente: sus bloques ausentes no aparecen', () => {
    const mod = hm({ ausencias: [{ docenteId: 'ana', bloques: [1, 2, 3] }] });
    expect(clasesEfectivas('ana', '2026-10-06', { horarioBase: base, horariosModificados: [mod] })).toEqual([]);
    const parcial = hm({ ausencias: [{ docenteId: 'ana', bloques: [1] }] });
    expect(
      clasesEfectivas('ana', '2026-10-06', { horarioBase: base, horariosModificados: [parcial] }).map((c) => c.bloque),
    ).toEqual([2, 3]);
  });

  it('reemplazo: la clase pasa al docente nuevo', () => {
    const mod = hm({
      ausencias: [{ docenteId: 'ana', bloques: [3] }],
      modificaciones: [{ bloqueOriginal: 3, bloqueNuevo: 3, docenteOriginal: 'ana', docenteNuevo: 'luis', grupo: '10.1', aula: 'Aula 1' }],
    });
    const luis = clasesEfectivas('luis', '2026-10-06', { horarioBase: base, horariosModificados: [mod] });
    expect(luis.map((c) => [c.bloque, c.grado])).toEqual([[3, '10.1'], [5, '10.2']]);
    const ana = clasesEfectivas('ana', '2026-10-06', { horarioBase: base, horariosModificados: [mod] });
    expect(ana.map((c) => c.bloque)).toEqual([1, 2]);
  });

  it('borrador no cuenta; de varias versiones gana la más reciente', () => {
    const borrador = hm({ estado: 'borrador', ausencias: [{ docenteId: 'ana', bloques: [1, 2, 3] }] });
    expect(clasesEfectivas('ana', '2026-10-06', { horarioBase: base, horariosModificados: [borrador] })).toHaveLength(3);
    const viejo = hm({ id: 'v', timestamp: '2026-10-01T00:00:00Z', ausencias: [{ docenteId: 'ana', bloques: [1, 2, 3] }] });
    const nuevo = hm({ id: 'n', timestamp: '2026-10-05T12:00:00Z' });
    expect(clasesEfectivas('ana', '2026-10-06', { horarioBase: base, horariosModificados: [viejo, nuevo] })).toHaveLength(3);
  });

  it('jornada reducida: horas distintas y bloques recortados', () => {
    const jr: JornadaReducida = {
      id: 'j', fecha: '2026-10-06', jornada: 'manana', autor: 'c', horaInicio: '06:00', horaFin: '09:00',
      motivo: 'Acto cívico', numBloques: 2, timestamp: 't',
      bloques: [{ id: 1, inicio: '06:00', fin: '06:40' }, { id: 2, inicio: '06:40', fin: '07:20' }],
    };
    const r = clasesEfectivas('ana', '2026-10-06', { horarioBase: base, jornadasReducidas: [jr] });
    expect(r.map((c) => [c.bloque, c.inicio, c.fin])).toEqual([[1, '06:00', '06:40'], [2, '06:40', '07:20']]);
    expect(clasesEfectivas('ana', '2026-10-13', { horarioBase: base, jornadasReducidas: [jr] })[0].fin).toBe('06:55');
  });

  it('festivo → []', () => {
    const lunes = [{ ...base[0], dia: 'lunes' }];
    expect(clasesEfectivas('ana', '2026-10-12', { horarioBase: lunes })).toEqual([]);
    expect(clasesEfectivas('ana', '2026-10-12', { horarioBase: lunes, esDiaSinClases: () => false })).toHaveLength(1);
  });

  it('jornada pedagógica de la agenda (2026-09-02) → []', () => {
    const miercoles = [{ ...base[0], dia: 'miercoles' }];
    expect(clasesEfectivas('ana', '2026-09-02', { horarioBase: miercoles })).toEqual([]);
  });

  it('docente mixto: mañana y tarde, cada una con su franja; CI conservado', () => {
    const r = clasesEfectivas('edgar', '2026-10-06', { horarioBase: base });
    expect(r.map((c) => [c.jornada, c.bloque, c.grado, c.inicio])).toEqual([
      ['manana', 6, '11.1/CI', '11:05'],
      ['tarde', 1, '8º1', '12:15'],
      ['tarde', 4, '6º2', '15:20'],
    ]);
  });

  it('jornada reducida de la mañana no toca la tarde del mixto', () => {
    const jr: JornadaReducida = {
      id: 'j', fecha: '2026-10-06', jornada: 'manana', autor: 'c', horaInicio: '06:00', horaFin: '08:00',
      motivo: 'x', numBloques: 2, timestamp: 't',
      bloques: [{ id: 1, inicio: '06:00', fin: '07:00' }, { id: 2, inicio: '07:00', fin: '08:00' }],
    };
    const r = clasesEfectivas('edgar', '2026-10-06', { horarioBase: base, jornadasReducidas: [jr] });
    expect(r.map((c) => c.jornada)).toEqual(['tarde', 'tarde']);
  });
});

describe('proximaClaseEfectiva', () => {
  const cl = clasesEfectivas('ana', '2026-10-06', { horarioBase: base });
  it('en curso, siguiente y terminada', () => {
    expect(proximaClaseEfectiva(cl, 6 * 60 + 10)).toMatchObject({ bloque: 1, enCurso: true });
    expect(proximaClaseEfectiva(cl, 8 * 60)).toMatchObject({ bloque: 3, enCurso: false });
    expect(proximaClaseEfectiva(cl, 13 * 60)).toBeNull();
  });
});
