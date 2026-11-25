import { describe, it, expect } from 'vitest';
import {
  estaVigente, entradaMenuVisible, hoyBogota, gradosMencionados, entradaEsDeGrado, entradaEsDeDocente,
  pasaFiltros, contarCoincidencias, diaInicial,
} from './logica';
import { PLAN_APOYO, PLAN_APOYO_MANANA, PLAN_APOYO_TARDE } from './planApoyo2026';

describe('vigencia', () => {
  it('incluye ambos extremos y excluye lo de fuera', () => {
    expect(estaVigente('2026-11-23')).toBe(false);
    expect(estaVigente('2026-11-24')).toBe(true);
    expect(estaVigente('2026-11-28')).toBe(true);
    expect(estaVigente('2026-12-01')).toBe(true);
    expect(estaVigente('2026-12-02')).toBe(false);
  });
  it('el parámetro de prueba activa la entrada fuera de fechas', () => {
    expect(entradaMenuVisible('2026-11-16', '')).toBe(false);
    expect(entradaMenuVisible('2026-11-16', '?horarioEspecial=1')).toBe(true);
    expect(entradaMenuVisible('2026-11-16', '?horarioEspecial=0')).toBe(false);
    expect(entradaMenuVisible('2026-11-25', '')).toBe(true);
  });
  it('hoyBogota usa la zona de Bogotá', () => {
    expect(hoyBogota(new Date('2026-12-02T03:00:00Z'))).toBe('2026-12-01'); // 22:00 del 1-dic en Bogotá
  });
});

describe('grados', () => {
  it('extrae grados de textos variados', () => {
    expect([...gradosMencionados('10°3 y 10°4')]).toEqual(['10']);
    expect([...gradosMencionados('6º, 7º y 8º')].sort()).toEqual(['6', '7', '8']);
    expect([...gradosMencionados('9° y 10°1')].sort()).toEqual(['10', '9']);
    expect([...gradosMencionados(null)]).toEqual([]);
  });
  it('11° no cuenta como 1° ni 10°', () => {
    const en = { asignatura: 'X', grados: '11°', docentes: null, nota: null };
    expect(entradaEsDeGrado(en, '11')).toBe(true);
    expect(entradaEsDeGrado(en, '10')).toBe(false);
  });
});

describe('docentes', () => {
  const en = (docentes: string | null) => ({ asignatura: 'X', grados: '7°', docentes, nota: null });
  it('compara sin tildes y mayúsculas', () => {
    expect(entradaEsDeDocente(en('Sara-Mónica Córdoba'), 'monica_c', 'Mónica C.')).toBe(true);
    expect(entradaEsDeDocente(en('Mónica Rave'), 'monica_c', 'Mónica C.')).toBe(false);
    expect(entradaEsDeDocente(en('Mónica Rave'), 'monica_rave', 'Mónica R.')).toBe(true);
    expect(entradaEsDeDocente(en('Javier y Mónica'), 'monica_c', 'Mónica C.')).toBe(true);
    expect(entradaEsDeDocente(en('Javier y Mónica'), 'luis_javier', 'Luis Javier')).toBe(true);
    expect(entradaEsDeDocente(en('Johana – Juan Carlos'), 'yoguis', 'Yoguis')).toBe(true);
    expect(entradaEsDeDocente(en('Johana'), 'johana', 'Johana')).toBe(true);
    expect(entradaEsDeDocente(en(null), 'johana', 'Johana')).toBe(false);
  });
  it('no confunde Johana con Johana R.', () => {
    expect(entradaEsDeDocente(en('Johana'), 'gri_johana_r', 'Johana R.')).toBe(false);
  });
  it('Juan Pablo no es Juan Carlos', () => {
    expect(entradaEsDeDocente(en('Juan Pablo'), 'yoguis', 'Yoguis')).toBe(false);
  });
});

describe('datos transcritos', () => {
  it('cada día trae una lista por franja', () => {
    for (const j of Object.values(PLAN_APOYO)) {
      for (const d of j.dias) expect(d.entradas.length).toBe(j.franjas.length);
    }
  });
  it('mañana 6 días, tarde 5', () => {
    expect(PLAN_APOYO_MANANA.dias.map(d => d.fecha)).toEqual(['2026-11-24', '2026-11-25', '2026-11-26', '2026-11-27', '2026-11-30', '2026-12-01']);
    expect(PLAN_APOYO_TARDE.dias.length).toBe(5);
  });
  it('filtra por grado y por docente', () => {
    const f = { grado: '11' as const, soloMias: false, userId: 'x', nombreCorto: 'X' };
    expect(contarCoincidencias(PLAN_APOYO_MANANA, f)).toBeGreaterThan(10);
    expect(contarCoincidencias(PLAN_APOYO_TARDE, f)).toBe(0);
    const yanet = { grado: null, soloMias: true, userId: 'yanet', nombreCorto: 'Yanet' };
    expect(contarCoincidencias(PLAN_APOYO_TARDE, yanet)).toBeGreaterThan(5);
    expect(contarCoincidencias(PLAN_APOYO_MANANA, { ...yanet, userId: 'julian', nombreCorto: 'Julián' })).toBe(0); // v2 (docx 24-nov): sin Física
    expect(contarCoincidencias(PLAN_APOYO_MANANA, { ...yanet, userId: 'yoguis', nombreCorto: 'Yoguis' })).toBeGreaterThan(0);
    expect(pasaFiltros(PLAN_APOYO_MANANA.dias[0].entradas[0][0], { grado: null, soloMias: false, userId: '', nombreCorto: '' })).toBe(true);
  });
  it('día inicial', () => {
    expect(diaInicial(PLAN_APOYO_MANANA, '2026-11-26')).toBe(2);
    expect(diaInicial(PLAN_APOYO_MANANA, '2026-11-16')).toBe(0);
  });
});
