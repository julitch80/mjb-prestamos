import { describe, expect, it } from 'vitest';
import { diasSobreTope, esDiaDePlan, protegerPasosPasados, repartirPasos } from './logica';
import { planificarDosificacion } from './dosificar';
import { fusionarReacomodos } from './completarPlan';
import type { AsignaturaPlan, Guia, GuiaPlan, PasoGuia } from './tipos';

const paso = (id: string, momentos = 1, fecha: string | null = null, semana = 1): PasoGuia => ({
  id, titulo: id, instrucciones: '', momentos, evidencia: 'foto', evidenciaDetalle: '', semana, fecha,
});
const ent = (a: string, fecha: string, momentos = 1) => paso(`ent-${a}`, momentos, fecha);

describe('diasSobreTope', () => {
  it('cuenta días cuya suma supera el tope', () => {
    const r = diasSobreTope([paso('a', 3, '2026-11-03'), paso('b', 2, '2026-11-03'), paso('c', 1, '2026-11-04'), paso('d', 4, null)], 4);
    expect(r).toEqual([{ fecha: '2026-11-03', carga: 5 }]);
  });
});

describe('repartirPasos: entregas con fecha sugerida', () => {
  const guias = () => ['mat', 'esp', 'cie'].map(a => ({ guiaId: a, pasos: [ent(a, '2026-11-05')] }));
  it('tres entregas sugeridas el mismo día quedan en días distintos sin pasar el tope', () => {
    const r = repartirPasos(guias(), '2026-11-02', '2026-11-13', 1, '2026-11-01');
    const fechas = r.asignaturas.map(a => a.pasos[0].fecha!);
    expect(new Set(fechas).size).toBe(3);
    expect(diasSobreTope(r.asignaturas.flatMap(a => a.pasos), 1)).toEqual([]);
    fechas.forEach(f => expect(esDiaDePlan(f)).toBe(true));
    // la más cercana a la sugerida se queda en ella
    expect(fechas).toContain('2026-11-05');
  });
  it('con tope alto igual prefiere un día sin otra entrega', () => {
    const r = repartirPasos(guias(), '2026-11-02', '2026-11-13', 4, '2026-11-01');
    expect(new Set(r.asignaturas.map(a => a.pasos[0].fecha)).size).toBe(3);
  });
  it('reporta reacomodos {guiaId, pasoId, asignaturaId, sugerida, final}', () => {
    const r = repartirPasos(guias(), '2026-11-02', '2026-11-13', 1, '2026-11-01');
    expect(r.reacomodos.length).toBe(2);
    for (const x of r.reacomodos) {
      expect(x.sugerida).toBe('2026-11-05'); expect(x.final).not.toBe('2026-11-05');
      expect(x.pasoId).toBe(`ent-${x.guiaId}`); expect(x.asignaturaId).toBe(x.guiaId);
    }
  });
  it('una entrega ya cumplida (hasta hoy) no se mueve', () => {
    const r = repartirPasos([{ guiaId: 'a', pasos: [ent('a', '2026-11-02')] }, { guiaId: 'b', pasos: [ent('b', '2026-11-02')] }],
      '2026-11-02', '2026-11-13', 1, '2026-11-03');
    expect(r.asignaturas.map(a => a.pasos[0].fecha)).toEqual(['2026-11-02', '2026-11-02']);
    expect(r.reacomodos).toEqual([]);
  });
  it('conserva el orden de la guía: la entrega no va antes de los pasos que la preparan si hay cupo', () => {
    const r = repartirPasos([{ guiaId: 'a', pasos: [paso('p1', 1, null, 1), paso('p2', 1, null, 1), ent('a', '2026-11-03')] }],
      '2026-11-02', '2026-11-13', 1, '2026-11-01');
    const f = r.asignaturas[0].pasos.map(p => p.fecha!);
    expect(f[2] >= f[1]).toBe(true);
  });
  it('los pasos que no son entrega conservan su fecha fija', () => {
    const r = repartirPasos([{ guiaId: 'a', pasos: [paso('x', 4, '2026-11-04')] }], '2026-11-02', '2026-11-13', 4, '2026-11-01');
    expect(r.asignaturas[0].pasos[0].fecha).toBe('2026-11-04');
  });
  it('protegerPasosPasados sigue restaurando lo ya ocurrido', () => {
    const prev = [ent('a', '2026-11-03')];
    const nuevo = [{ ...ent('a', '2026-11-03'), fecha: '2026-11-09' }];
    expect(protegerPasosPasados(nuevo, prev, '2026-11-05').pasos[0].fecha).toBe('2026-11-03');
  });
});

describe('fusionarReacomodos', () => {
  it('conserva la sugerida original y descarta lo que ya no aplica', () => {
    const previos = [{ pasoId: 'ent-a', asignaturaId: 'a', sugerida: '2026-11-05', final: '2026-11-06', en: 7 }];
    const f = fusionarReacomodos(previos, [{ guiaId: 'g', pasoId: 'ent-a', asignaturaId: 'a', sugerida: '2026-11-06', final: '2026-11-09' }], [], 9);
    expect(f).toEqual([{ pasoId: 'ent-a', asignaturaId: 'a', sugerida: '2026-11-05', final: '2026-11-09', en: 9 }]);
    expect(fusionarReacomodos(previos, [], [{ ...paso('ent-a'), fecha: '2026-11-10' }], 9)).toEqual([]);
  });
});

describe('planificarDosificacion (plan ya publicado)', () => {
  const plan = { desde: '2026-11-02', hasta: '2026-11-20', topeDiario: 1, ritmo: 'diario' as const };
  const guia: Guia = { productoFinal: '', criteriosEvaluacion: [], pasos: [], sustentacion: { modalidad: 'virtual', fecha: null, hora: null, lugarOEnlace: '', preguntasGuia: [] } };
  const gp = (a: string, i: number): GuiaPlan => ({
    id: a, asignaturaIds: [a], eje: a, responsableCorreo: 'r@x', docentesCorreos: ['r@x'], vistosBuenos: {},
    aprobada: { ...guia, pasos: [paso('p1', 1, `2026-11-0${2 + i}`), ent(a, '2026-11-10')] }, seguimiento: {}, sustentacionEstado: 'sin_citar', actualizadoEn: 1,
  });
  const asig = (a: string): AsignaturaPlan => ({ asignaturaId: a, docenteId: a, docenteCorreo: a + '@x', criteriosPromocion: 'c', entregable: 'algo', fechaEntrega: '2026-11-10', actualizadoEn: 1 });
  it('baja a cero los días sobre el tope y es idempotente', () => {
    const gs = ['mat', 'esp', 'cie'].map(gp);
    const asigs = ['mat', 'esp', 'cie'].map(asig);
    const nombre = (id: string) => id;
    const r1 = planificarDosificacion(plan, asigs, gs, nombre, '2026-11-01');
    expect(r1.sobreAntes).toBeGreaterThan(0);
    expect(r1.sobreDespues).toBe(0);
    expect(r1.reacomodadas).toBe(2);
    const r2 = planificarDosificacion(plan, asigs, r1.guias, nombre, '2026-11-01');
    expect(r2.cambios).toEqual([]);
    expect(r2.guias).toEqual(r1.guias);
  });
});
