import { describe, expect, it } from 'vitest';
import { armarAprobacion, completarBloqueado, construirPasos, errorDeBorrador, faltantesPlan, fechaEntregaSugerida } from './completarPlan';
import type { AsignaturaPlan, Guia, GuiaPlan, PasoGuia } from './tipos';

const plan = { modalidad: 'por_asignatura' as const, desde: '2026-11-09', hasta: '2026-11-27', estado: 'activo' as const };
const asig = (id: string, extra: Partial<AsignaturaPlan> = {}): AsignaturaPlan => ({
  asignaturaId: id, docenteId: 'd', docenteCorreo: 'd@x', criteriosPromocion: 'c', ebcDba: 'e', evidenciaAprendizaje: 'v', aportes: 'a',
  entregable: 'x', fechaEntrega: '2026-11-13', actualizadoEn: 1, ...extra,
});
const paso = (id: string, fecha: string | null = null): PasoGuia => ({
  id, titulo: `T${id}`, instrucciones: '', momentos: 1, evidencia: 'foto', evidenciaDetalle: '', fecha, semana: 1,
});
const guiaIA = (extra: Partial<Guia> = {}): Guia => ({
  productoFinal: 'p', criteriosEvaluacion: [], pasos: [paso('a'), paso('b')], sustentacion: { fecha: null, modalidad: 'presencial', hora: null, lugarOEnlace: '', preguntasGuia: [] }, ...extra,
});
const gp = (id: string, extra: Partial<GuiaPlan> = {}): GuiaPlan => ({
  id, asignaturaIds: [id], eje: id, responsableCorreo: '', docentesCorreos: [], vistosBuenos: {}, seguimiento: {}, sustentacionEstado: 'sin_citar', actualizadoEn: 1, ...extra,
});
const nombre = (id: string) => id.toUpperCase();
const etq = (g: { id: string }) => g.id;

describe('faltantesPlan', () => {
  it('plan completo y aprobado: nada que hacer', () => {
    const f = faltantesPlan(plan, [asig('mat')], [gp('mat', { aprobada: guiaIA() })]);
    expect(f.hayQueHacer).toBe(false);
  });
  it('detecta criterios vacíos, entregables sin fecha y guías sin aprobar', () => {
    const f = faltantesPlan(plan, [asig('mat', { criteriosPromocion: ' ' }), asig('len', { fechaEntrega: '' }), asig('art')],
      [gp('mat'), gp('len'), gp('art', { aprobada: guiaIA() })]);
    expect(f.asignaturas).toEqual(['mat']);
    expect(f.entregables).toEqual(['len']);
    expect(f.guias).toEqual(['mat', 'len']);
    expect(f.hayQueHacer).toBe(true);
  });
  it('entregables sin fecha se piden también en guías ya aprobadas (cuentan en el avance)', () => {
    const f = faltantesPlan(plan, [asig('mat', { entregable: '' })], [gp('mat', { aprobada: guiaIA() })]);
    expect(f.entregables).toEqual(['mat']);
  });
  it('criterios vacíos en una guía ya aprobada también cuentan', () => {
    expect(faltantesPlan(plan, [asig('mat', { criteriosPromocion: '' })], [gp('mat', { aprobada: guiaIA() })]).hayQueHacer).toBe(true);
  });
  it('plan cerrado: no ofrece nada', () => {
    expect(faltantesPlan({ ...plan, estado: 'cerrado' }, [asig('mat', { criteriosPromocion: '' })], [gp('mat')]).hayQueHacer).toBe(false);
  });
});

describe('construirPasos (orden)', () => {
  it('asignaturas, entregables, luego pedido/propuesta/integración por guía y al final las aprobaciones', () => {
    const asigs = [asig('mat', { criteriosPromocion: '', entregable: '' }), asig('len')];
    const guias = [gp('g1', { asignaturaIds: ['mat', 'len'] }), gp('art', { propuesta: guiaIA(), pedido: { tematicas: 't', competencias: 'c' } })];
    const ids = construirPasos({ ...plan, modalidad: 'transversal' }, asigs, guias, nombre, etq).map(p => p.id);
    expect(ids).toEqual([
      'asig-mat', 'ent-mat',
      'ped-g1', 'prop-g1', 'int-g1',
      'int-art', // la propuesta existe pero transversal: falta integrar
      'apr-g1', 'apr-art',
    ]);
  });
  it('por asignatura con propuesta existente: solo aprobar; sin propuesta: pedido + propuesta + aprobar', () => {
    const ids = construirPasos(plan, [asig('mat'), asig('len')], [
      gp('mat', { propuesta: guiaIA() }), gp('len', { pedido: { tematicas: 't', competencias: 'c' } }),
    ], nombre, etq).map(p => p.id);
    expect(ids).toEqual(['prop-len', 'apr-mat', 'apr-len']);
  });
  it('una propuesta ya integrada no se integra otra vez', () => {
    const ids = construirPasos({ ...plan, modalidad: 'transversal' }, [asig('mat')], [gp('g1', { propuesta: guiaIA({ integrada: true }) })], nombre, etq).map(p => p.id);
    expect(ids).toEqual(['apr-g1']);
  });
});

describe('fechaEntregaSugerida', () => {
  it('cae en día hábil dentro del periodo y reparte en orden', () => {
    const f = [0, 1, 2].map(i => fechaEntregaSugerida('2026-11-09', '2026-11-27', i, 3));
    for (const x of f) { expect(x >= '2026-11-09' && x <= '2026-11-27').toBe(true); const d = new Date(`${x}T12:00:00`).getDay(); expect(d === 0 || d === 6).toBe(false); }
    expect([...f].sort()).toEqual(f);
    expect(new Set(f).size).toBe(3);
  });
});

describe('armarAprobacion / errorDeBorrador', () => {
  const p = { desde: '2026-11-09', hasta: '2026-11-27', topeDiario: 3, ritmo: 'diario' as const, cierreEdicion: '2099-01-01' };
  it('arma la aprobada con fechas repartidas e incluye el entregable del docente', () => {
    const r = armarAprobacion({ plan: p, guia: gp('mat'), borrador: guiaIA(), todas: [gp('mat')], propias: [asig('mat')], nombre, hoy: '2026-11-02' });
    expect(r.aprobada.pasos.some(x => x.id === 'ent-mat')).toBe(true);
    expect(r.aprobada.pasos.every(x => !!x.fecha)).toBe(true);
    expect(r.cambio).toBe(true);
  });
  it('rechaza un borrador sin pasos o con títulos vacíos', () => {
    expect(errorDeBorrador(null)).toBeTruthy();
    expect(errorDeBorrador(guiaIA({ pasos: [] }))).toBeTruthy();
    expect(errorDeBorrador(guiaIA({ pasos: [{ ...paso('a'), titulo: ' ' }] }))).toBeTruthy();
    expect(errorDeBorrador(guiaIA())).toBeNull();
  });
});

describe('caso «en espera — ingresó tarde»', () => {
  const enEspera = { hasta: '2026-11-13', por: 'a@b.co', en: 1 };
  it('el botón queda oculto (nada que hacer) mientras esté en espera y vuelve al quitarla', () => {
    const asigs = [asig('mat', { criteriosPromocion: '' })];
    expect(faltantesPlan({ ...plan, enEspera }, asigs, [gp('mat')]).hayQueHacer).toBe(false);
    expect(construirPasos({ ...plan, enEspera }, asigs, [gp('mat')], x => x, g => g.id)).toEqual([]);
    expect(faltantesPlan(plan, asigs, [gp('mat')]).hayQueHacer).toBe(true);
  });
  it('completarBloqueado', () => {
    expect(completarBloqueado({ enEspera })).toBe(true);
    expect(completarBloqueado({})).toBe(false);
  });
});
