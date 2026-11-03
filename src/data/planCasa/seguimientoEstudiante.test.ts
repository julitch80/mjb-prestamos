import { describe, expect, it } from 'vitest';
import {
  filtrarSeguimientos, guiasVisibles, nombreCorto, puedeRegistrarLlamada, resumenSeguimientos, seguimientoDePlan,
  textoUltimaEntrega, veAmbasJornadas, veHistorialLlamadas, type QuienVe,
} from './seguimientoEstudiante';
import type { GuiaPlan, PasoGuia } from './tipos';

const ms = (iso: string) => Date.parse(`${iso}T15:00:00Z`);
const paso = (id: string, semana: number, fecha: string | null): PasoGuia => ({
  id, titulo: `Paso ${id}`, instrucciones: '', momentos: 1, evidencia: 'foto', evidenciaDetalle: '', semana, fecha,
});
const guia = (id: string, pasos: PasoGuia[], seg: GuiaPlan['seguimiento'] = {}, extra: Partial<GuiaPlan> = {}): GuiaPlan => ({
  id, asignaturaIds: [id], eje: id, responsableCorreo: '', docentesCorreos: [], vistosBuenos: {}, seguimiento: seg,
  sustentacionEstado: 'sin_citar', actualizadoEn: 0,
  aprobada: { productoFinal: '', criteriosEvaluacion: [], pasos, sustentacion: { modalidad: 'presencial', fecha: null, hora: null, lugarOEnlace: '', preguntasGuia: [] } },
  ...extra,
});
const plan = { id: 'p1', nombres: 'Samuel Andrés', apellidos: 'Pérez Gil', grupo: '8º1', desde: '2026-10-20', hasta: '2026-11-30', estado: 'activo' as const };
const HOY = '2026-11-02';

describe('seguimientoDePlan', () => {
  it('nombre corto y % de avance solo con entregas del estudiante', () => {
    const g = guia('mat', [paso('p1', 1, '2026-10-23'), paso('p2', 1, '2026-10-30'), paso('p3', 2, '2026-11-10'), paso('p4', 2, null)], {
      p1: { estado: 'revisado', entregadoEn: ms('2026-10-30') },
      p2: { estado: 'revisado' }, // revisado sin entrega: NO cuenta como avance
      p3: { estado: 'entregado' }, // sin entregadoEn: no cuenta
    });
    const s = seguimientoDePlan(plan, [g], HOY);
    expect(s.nombre).toBe('Samuel P.');
    expect(s).toMatchObject({ total: 4, entregados: 1, porcentaje: 25, revisados: 2 });
    expect(s.semanas).toEqual([{ semana: 1, entregados: 1, total: 2 }, { semana: 2, entregados: 0, total: 2 }]);
  });
  it('verde al día: entregó hace menos de 7 días y no tiene pasos vencidos', () => {
    const g = guia('mat', [paso('p1', 1, '2026-10-30'), paso('p2', 2, '2026-11-10')], { p1: { estado: 'entregado', entregadoEn: ms('2026-10-30') } });
    const s = seguimientoDePlan(plan, [g], HOY);
    expect(s.semaforo).toBe('verde');
    expect(s.diasSinAvance).toBe(3);
    expect(textoUltimaEntrega(s, HOY)).toBe('Última entrega: hace 3 días');
  });
  it('amarillo atrasado: paso con fecha pasada sin entrega, pero entregó hace poco', () => {
    const g = guia('mat', [paso('p1', 1, '2026-10-28'), paso('p2', 1, '2026-10-31')], { p2: { estado: 'entregado', entregadoEn: ms('2026-11-01') } });
    const s = seguimientoDePlan(plan, [g], HOY);
    expect(s.semaforo).toBe('amarillo');
    expect(s.vencidos).toEqual([{ guiaId: 'mat', pasoId: 'p1', titulo: 'Paso p1', fecha: '2026-10-28', area: 'mat', diasAtraso: 5 }]);
  });
  it('rojo sin avance: 7+ días desde la última entrega (6 todavía no)', () => {
    const g7 = guia('mat', [paso('p1', 1, '2026-10-26')], { p1: { estado: 'entregado', entregadoEn: ms('2026-10-26') } });
    expect(seguimientoDePlan(plan, [g7], HOY).semaforo).toBe('rojo');
    const g6 = guia('mat', [paso('p1', 1, '2026-10-27')], { p1: { estado: 'entregado', entregadoEn: ms('2026-10-27') } });
    expect(seguimientoDePlan(plan, [g6], HOY).semaforo).toBe('verde');
  });
  it('rojo si nunca entregó y pasaron 7+ días desde `desde`; verde si el plan aún no empieza', () => {
    const g = guia('mat', [paso('p1', 1, null)]);
    const s = seguimientoDePlan(plan, [g], HOY);
    expect(s).toMatchObject({ semaforo: 'rojo', diasSinAvance: 13, ultimaEntrega: null });
    expect(textoUltimaEntrega(s, HOY)).toBe('Sin entregas aún');
    const futuro = seguimientoDePlan({ ...plan, desde: '2026-11-09' }, [g], HOY);
    expect(futuro).toMatchObject({ semaforo: 'verde', diasSinAvance: null });
  });
  it('en espera o plan cerrado nunca son rojo; la alerta solo se muestra en rojo', () => {
    const g = guia('mat', [paso('p1', 1, null)]);
    expect(seguimientoDePlan({ ...plan, enEspera: { hasta: '2026-11-10', por: 'x', en: 1 } }, [g], HOY).semaforo).toBe('verde');
    expect(seguimientoDePlan({ ...plan, estado: 'cerrado' }, [g], HOY).semaforo).toBe('verde');
    const conAlerta = { ...plan, alertaInactividad: { en: 5, dias: 9 } };
    expect(seguimientoDePlan(conAlerta, [g], HOY).alerta).toEqual({ en: 5, dias: 9 });
    const ok = guia('mat', [paso('p1', 1, null)], { p1: { estado: 'entregado', entregadoEn: ms('2026-11-01') } });
    expect(seguimientoDePlan(conAlerta, [ok], HOY).alerta).toBeUndefined();
  });
  it('avance por área y sustentaciones; guías sin aprobar no cuentan', () => {
    const a = guia('mat', [paso('p1', 1, null)], { p1: { estado: 'entregado', entregadoEn: ms('2026-11-01') } }, { sustentacionEstado: 'citada' });
    a.aprobada!.sustentacion.fecha = '2026-11-25';
    const b = guia('len', [paso('p1', 1, null), paso('p2', 1, null)]);
    const sinAprobar: GuiaPlan = { ...guia('cie', []), aprobada: undefined };
    const s = seguimientoDePlan(plan, [a, b, sinAprobar], HOY);
    expect(s.areas.map(x => [x.area, x.entregados, x.total])).toEqual([['mat', 1, 1], ['len', 0, 2]]);
    expect(s.sustentaciones).toEqual([
      { guiaId: 'mat', area: 'mat', fecha: '2026-11-25', estado: 'citada' },
      { guiaId: 'len', area: 'len', fecha: null, estado: 'sin_citar' },
    ]);
  });
});

describe('alcance por rol', () => {
  const g1 = guia('mat', [paso('p1', 1, null)], {}, { docentesCorreos: ['ana@x.co'] });
  const g2 = guia('len', [paso('p1', 1, null)], {}, { docentesCorreos: ['beto@x.co'] });
  const q = (extra: Partial<QuienVe>): QuienVe => ({ rol: 'docente', jornada: null, enEquipo: false, correo: '', ...extra });

  it('equipo, rectora y superusuario ven todas las guías', () => {
    expect(guiasVisibles(q({ enEquipo: true }), plan, [g1, g2])).toHaveLength(2);
    expect(guiasVisibles(q({ rol: 'rectora' }), plan, [g1, g2])).toHaveLength(2);
    expect(guiasVisibles(q({ rol: 'superusuario' }), plan, [g1, g2])).toHaveLength(2);
  });
  it('coordinador: solo su jornada', () => {
    expect(guiasVisibles(q({ rol: 'coordinador', jornada: 'tarde' }), plan, [g1])).toHaveLength(1);
    expect(guiasVisibles(q({ rol: 'coordinador', jornada: 'manana' }), plan, [g1])).toBeNull();
    expect(guiasVisibles(q({ rol: 'coordinador', jornada: 'ambas' }), plan, [g1])).toHaveLength(1);
  });
  it('docente: solo sus guías, y null si no tiene ninguna en el plan', () => {
    expect(guiasVisibles(q({ correo: 'Ana@x.co' }), plan, [g1, g2])?.map(g => g.id)).toEqual(['mat']);
    expect(guiasVisibles(q({ correo: 'otro@x.co' }), plan, [g1, g2])).toBeNull();
    expect(guiasVisibles(q({ correo: '' }), plan, [g1, g2])).toBeNull();
  });
  it('permisos de llamada, historial y filtro de jornada', () => {
    expect(puedeRegistrarLlamada(q({ enEquipo: true }))).toBe(true);
    expect(puedeRegistrarLlamada(q({ rol: 'coordinador' }))).toBe(true);
    expect(puedeRegistrarLlamada(q({ rol: 'rectora' }))).toBe(false);
    expect(puedeRegistrarLlamada(q({}))).toBe(false);
    expect(veHistorialLlamadas(q({ rol: 'rectora' }))).toBe(true);
    expect(veHistorialLlamadas(q({}))).toBe(false);
    expect(veAmbasJornadas(q({ rol: 'coordinador', jornada: 'tarde' }))).toBe(false);
    expect(veAmbasJornadas(q({ rol: 'rectora' }))).toBe(true);
  });
});

describe('agregados y filtros', () => {
  const mk = (id: string, grupo: string, ent: number, venc: boolean, rojo = false) => {
    const pasos = [paso('p1', 1, '2026-12-01'), paso('p2', 1, venc ? '2026-10-25' : null)];
    const seg: GuiaPlan['seguimiento'] = ent ? { p1: { estado: 'entregado', entregadoEn: ms(rojo ? '2026-10-20' : '2026-11-01') } } : {};
    const g = guia('mat', pasos, seg);
    g.aprobada!.sustentacion.fecha = id === 'a' ? '2026-11-25' : null;
    return seguimientoDePlan({ ...plan, id, grupo, nombres: id }, [g], HOY);
  };
  const lista = [mk('a', '9.1', 1, false), mk('b', '6º1', 1, true), mk('c', '6º2', 1, true, true)];
  it('cuenta semáforos y sustentaciones', () => {
    expect(resumenSeguimientos(lista)).toEqual({ alDia: 1, atrasados: 1, sinAvance: 1, sustProgramadas: 1, sustTotal: 3 });
  });
  it('filtra por estado y jornada, rojos primero', () => {
    expect(filtrarSeguimientos(lista, 'todos').map(s => s.planId)).toEqual(['c', 'b', 'a']);
    expect(filtrarSeguimientos(lista, 'sin_avance').map(s => s.planId)).toEqual(['c']);
    expect(filtrarSeguimientos(lista, 'atrasados').map(s => s.planId)).toEqual(['b']);
    expect(filtrarSeguimientos(lista, 'todos', 'manana').map(s => s.planId)).toEqual(['a']);
    expect(filtrarSeguimientos(lista, 'todos', 'tarde').map(s => s.planId)).toEqual(['c', 'b']);
  });
  it('nombreCorto sin apellido', () => { expect(nombreCorto('Ana María', '')).toBe('Ana'); });
});
