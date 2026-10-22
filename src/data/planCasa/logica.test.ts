import { describe, expect, it } from 'vitest';
import {
  agendaDelDia, aPublico, docentesDelGrupo, esDiaDePlan, guiasIniciales, nuevoToken, progresoAsignatura, progresoGuia,
  proximasEntregas, repartirPasos, resumenTablero, semanasDelPeriodo,
} from './logica';
import { addDias } from '../tareas/calendario';
import type { AsignaturaPlan, Guia, GuiaPlan, PasoGuia, PlanCasa } from './tipos';

// semana 0 = sin restricción de semana (datos antiguos).
const paso = (id: string, momentos = 1, fecha: string | null = null, semana = 0): PasoGuia => ({
  id, titulo: `T${id}`, instrucciones: '', momentos, evidencia: 'foto', evidenciaDetalle: '', fecha, semana,
});
const guia = (pasos: PasoGuia[]): Guia => ({
  productoFinal: 'x', criteriosEvaluacion: [], pasos,
  sustentacion: { modalidad: 'virtual', fecha: null, hora: null, lugarOEnlace: '', preguntasGuia: [] },
});
const plan: PlanCasa = {
  id: 'p', studentId: 's', nombres: 'Ana María', apellidos: 'Pérez Gómez', grupo: '8º1',
  desde: '2026-10-26', hasta: '2026-11-13', ajustes: ['Lecturas cortas'], topeDiario: 4, ritmo: 'diario', modalidad: 'por_asignatura', docentesCorreos: [],
  estado: 'activo', tokenPublico: 't', creadoPor: 'a', creadoEn: 1, actualizadoEn: 1,
};
describe('repartirPasos', () => {
  it('respeta el tope diario sumando materias, el orden y no usa fines de semana', () => {
    const mk = (n: number, pre: string) => Array.from({ length: n }, (_, i) => paso(`${pre}${i}`, 2));
    const r = repartirPasos([{ guiaId: 'mat', pasos: mk(4, 'm') }, { guiaId: 'esp', pasos: mk(4, 'e') }],
      '2026-10-26', '2026-11-13', 4, '2026-10-21');
    expect(r.avisos).toEqual([]);
    const porDia = new Map<string, number>();
    for (const a of r.asignaturas) for (const p of a.pasos) {
      expect(p.fecha).not.toBeNull();
      const dow = new Date(p.fecha! + 'T00:00:00').getDay();
      expect(dow).not.toBe(0); expect(dow).not.toBe(6);
      porDia.set(p.fecha!, (porDia.get(p.fecha!) ?? 0) + p.momentos);
    }
    for (const v of porDia.values()) expect(v).toBeLessThanOrEqual(4);
    for (const a of r.asignaturas) {
      const f = a.pasos.map(p => p.fecha!);
      expect([...f].sort()).toEqual(f);
    }
    const primer = r.asignaturas.map(a => a.pasos[0].fecha);
    expect(primer[0]).toBe(primer[1]);
  });
  it('no asigna antes del día siguiente a hoy ni en festivos', () => {
    const r = repartirPasos([{ guiaId: 'a', pasos: [paso('1', 1)] }], '2026-10-01', '2026-11-30', 4, '2026-10-21');
    expect(r.asignaturas[0].pasos[0].fecha).toBe('2026-10-22');
    const r2 = repartirPasos([{ guiaId: 'a', pasos: [paso('1', 1)] }], '2026-10-12', '2026-10-30', 4, '2026-10-01');
    expect(r2.asignaturas[0].pasos[0].fecha).not.toBe('2026-10-12');
  });
  it('reserva fechas fijadas por el docente', () => {
    const r = repartirPasos([
      { guiaId: 'a', pasos: [paso('1', 4, '2026-10-27')] },
      { guiaId: 'b', pasos: [paso('2', 1)] },
    ], '2026-10-26', '2026-11-13', 4, '2026-10-21');
    expect(r.asignaturas[0].pasos[0].fecha).toBe('2026-10-27');
    expect(r.asignaturas[1].pasos[0].fecha).toBe('2026-10-26');
  });
  it('avisa si no cabe', () => {
    const r = repartirPasos([{ guiaId: 'a', pasos: [paso('1', 4), paso('2', 4), paso('3', 4)] }],
      '2026-10-26', '2026-10-27', 4, '2026-10-21');
    expect(r.avisos.length).toBe(1);
    expect(r.asignaturas[0].pasos[2].fecha).toBeNull();
  });
});

describe('ritmo y semanas', () => {
  const lun = (f: string) => addDias(f, -((new Date(f + 'T00:00:00').getDay() + 6) % 7));
  it('semanasDelPeriodo cuenta semanas lunes-domingo', () => {
    expect(semanasDelPeriodo('2026-10-26', '2026-11-13')).toBe(3);
    expect(semanasDelPeriodo('2026-10-28', '2026-10-30')).toBe(1);
    expect(semanasDelPeriodo('2026-10-30', '2026-11-02')).toBe(2);
  });
  it('dia_por_medio usa solo un día hábil de cada dos', () => {
    const desde = '2026-11-02', hasta = '2026-11-27';
    const habiles: string[] = [];
    for (let f = desde; f <= hasta; f = addDias(f, 1)) if (esDiaDePlan(f)) habiles.push(f);
    const r = repartirPasos([{ guiaId: 'a', pasos: Array.from({ length: 6 }, (_, i) => paso('x' + i, 3)) }], desde, hasta, 3, '2026-10-21', 'dia_por_medio');
    expect(r.avisos).toEqual([]);
    const usados = r.asignaturas[0].pasos.map(p => habiles.indexOf(p.fecha!));
    expect(usados.every(i => i >= 0 && i % 2 === 0)).toBe(true);
    expect(new Set(usados).size).toBe(6);
  });
  it('un paso de la semana k cae dentro de la semana k', () => {
    const desde = '2026-10-26', hasta = '2026-11-13';
    const r = repartirPasos([{ guiaId: 'a', pasos: [paso('1', 1, null, 1), paso('2', 1, null, 2), paso('3', 1, null, 3)] }], desde, hasta, 4, '2026-10-21');
    expect(r.avisos).toEqual([]);
    const f = r.asignaturas[0].pasos.map(p => p.fecha!);
    expect(lun(f[0])).toBe('2026-10-26');
    expect(lun(f[1])).toBe('2026-11-02');
    expect(lun(f[2])).toBe('2026-11-09');
  });
  it('avisa si el paso no cabe en su semana y lo coloca después', () => {
    const r = repartirPasos([{ guiaId: 'a', pasos: [paso('1', 4, '2026-10-27', 1), paso('2', 4, null, 1), paso('3', 4, null, 1), paso('4', 4, null, 1), paso('5', 4, null, 1), paso('6', 4, null, 1)] }],
      '2026-10-26', '2026-11-13', 4, '2026-10-21');
    expect(r.avisos.some(a => a.includes('su semana'))).toBe(true);
    expect(r.asignaturas[0].pasos.every(p => p.fecha)).toBe(true);
  });
});

const guiaPlan = (id: string, asigIds: string[], pasos: PasoGuia[], seg: GuiaPlan['seguimiento'] = {}): GuiaPlan => ({
  id, asignaturaIds: asigIds, eje: id, responsableCorreo: 'r@x', docentesCorreos: ['r@x', 's@x'],
  vistosBuenos: { 'r@x': true }, aprobada: guia(pasos), seguimiento: seg, sustentacionEstado: 'sin_citar', actualizadoEn: 1,
});
const asigPlan = (id: string): AsignaturaPlan => ({
  asignaturaId: id, docenteId: 'd_' + id, docenteCorreo: id + '@x', criteriosPromocion: 'c', actualizadoEn: 1,
});

describe('agenda, progreso y guías', () => {
  const nombres = { mat: 'Matemáticas', fis: 'Física', esp: 'Lengua' };
  const pub = aPublico(plan, [guiaPlan('mat', ['mat'], [paso('1', 1, '2026-10-27'), paso('2', 1, '2026-10-29')])],
    nombres, { 'r@x': 'Uriel' }, 5);
  it('aPublico solo trae primer nombre y nada sensible', () => {
    expect(pub.primerNombre).toBe('Ana');
    const txt = JSON.stringify(pub);
    expect(txt).not.toContain('Pérez'); expect(txt).not.toContain('Lecturas cortas');
    expect(pub.pasos[0].asignatura).toBe('Matemáticas');
    expect(pub.pasos[0].docente).toBe('Uriel');
    expect(pub.sustentaciones.length).toBe(1);
  });
  it('etiqueta transversal con eje y asignaturas', () => {
    const p = aPublico({ ...plan, modalidad: 'transversal' }, [{ ...guiaPlan('g1', ['mat', 'fis'], [paso('1')]), eje: 'La energía' }],
      nombres, {});
    expect(p.pasos[0].asignatura).toBe('La energía (Matemáticas · Física)');
  });
  it('agendaDelDia y proximasEntregas', () => {
    expect(agendaDelDia(pub, '2026-10-27').length).toBe(1);
    expect(proximasEntregas(pub, '2026-10-28', 5).map(p => p.id)).toEqual(['2']);
    expect(proximasEntregas(pub, '2026-10-01', 1).map(p => p.id)).toEqual(['1']);
  });
  it('progreso y tablero por guía y por asignatura', () => {
    const g = guiaPlan('g1', ['mat', 'fis'], [paso('1'), paso('2'), paso('3'), paso('4')],
      { 1: { estado: 'entregado' }, 2: { estado: 'revisado' }, 3: { estado: 'pendiente' } });
    expect(progresoGuia(g)).toBe(50);
    expect(progresoAsignatura('fis', [g])).toBe(50);
    expect(progresoAsignatura('esp', [g])).toBe(0);
    const t = resumenTablero(plan, [asigPlan('mat'), asigPlan('esp')], [g], nombres);
    expect(t.porAsignatura[0]).toMatchObject({ nombre: 'Matemáticas', guiaId: 'g1', guiaAprobada: true, progreso: 50 });
    expect(t.porAsignatura[1]).toMatchObject({ guiaId: null, progreso: 0 });
    expect(t.porGuia[0]).toMatchObject({ vistosBuenos: 1, docentes: 2, asignaturas: ['Matemáticas', 'Física'] });
  });
  it('guiasIniciales: una por asignatura solo en por_asignatura', () => {
    const gs = guiasIniciales({ ...plan, modalidad: 'por_asignatura' }, [asigPlan('mat'), asigPlan('esp')]);
    expect(gs.map(g => g.id)).toEqual(['mat', 'esp']);
    expect(gs[0].responsableCorreo).toBe('mat@x');
    expect(guiasIniciales({ ...plan, modalidad: 'transversal' }, [asigPlan('mat')])).toEqual([]);
  });
});

describe('docentes y token', () => {
  it('docentesDelGrupo excluye ci y no repite', () => {
    const d = docentesDelGrupo('8º1');
    expect(d.length).toBeGreaterThan(3);
    expect(d.some(x => x.asignaturaId === 'ci')).toBe(false);
    expect(new Set(d.map(x => x.asignaturaId + x.docenteId)).size).toBe(d.length);
  });
  it('nuevoToken es largo, url-safe y distinto', () => {
    const t = nuevoToken();
    expect(t.length).toBeGreaterThanOrEqual(32);
    expect(t).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(nuevoToken()).not.toBe(t);
  });
});
