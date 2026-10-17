import { describe, expect, it } from 'vitest';
import { SEMILLA_2026 } from './semilla2026';
import {
  alertasDocente, buscar, cambioReciente, escalonDe, estadoActual, eventosDelDia, eventosParaGrado11,
  filtrarPorCategoria, pasados, pendientesPorMes, proximos, textoCuentaRegresiva, textoFecha,
} from './logica';

const E = SEMILLA_2026;

describe('semilla', () => {
  it('ids únicos y fechas válidas', () => {
    expect(new Set(E.map(e => e.id)).size).toBe(E.length);
    for (const e of E) {
      expect(e.desde).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      if (e.hasta) expect(e.hasta >= e.desde).toBe(true);
    }
  });
  it('la tabla de periodos trae los planes de apoyo duplicados de P3 y grado 11', () => {
    expect(E.filter(e => e.id.startsWith('p3_planes_apoyo'))).toHaveLength(2);
    expect(E.filter(e => e.id.startsWith('g11_planes_apoyo'))).toHaveLength(2);
    expect(E.find(e => e.id === 'p3_cierre_sistema')?.desde).toBe('2026-12-04');
  });
});

describe('estadoActual', () => {
  it('16-oct: tercer periodo, semana lectiva 7 de 14 (el receso de octubre no cuenta)', () => {
    const s = estadoActual(E, '2026-10-16');
    expect(s.periodo?.id).toBe('periodo_3');
    expect(s.semanaN).toBe(7);
    expect(s.totalSemanas).toBe(14);
    expect(s.enReceso).toBe(false);
  });
  it('19-oct es la semana 8 (coincide con la agenda)', () => {
    expect(estadoActual(E, '2026-10-19').semanaN).toBe(8);
  });
  it('días lectivos restantes: 16-oct → 4-dic sin festivos 2-nov, 16-nov ni 8-dic', () => {
    // 16-oct..4-dic: 50 días hábiles lun-vie; menos festivos 2-nov y 16-nov
    expect(estadoActual(E, '2026-10-16').diasLectivosRestantes).toBe(34);
  });
  it('durante el receso se marca enReceso', () => {
    expect(estadoActual(E, '2026-10-07').enReceso).toBe(true);
  });
  it('fuera de periodo no hay periodo', () => {
    expect(estadoActual(E, '2026-12-20').periodo).toBeNull();
  });
});

describe('listados', () => {
  it('próximos: el primero es el carrusel de media técnica o algo del 16–23 oct, con cuenta regresiva', () => {
    const p = proximos(E, '2026-10-16', 6);
    expect(p).toHaveLength(6);
    expect(p[0].evento.id).toBe('semana_convivencia'); // en curso hasta el 16
    expect(p[0].enCurso).toBe(true);
    const alerta = proximos(E, '2026-10-16', 20).find(x => x.evento.id === 'alerta_p3');
    expect(alerta?.dias).toBe(12);
    expect(textoCuentaRegresiva(12)).toBe('en 12 días');
  });
  it('pendientes por mes, con «sin fecha» al final', () => {
    const g = pendientesPorMes(E, '2026-10-16');
    expect(g[0].mes).toBe('2026-10');
    expect(g[g.length - 1].mes).toBe('sin_fecha');
    expect(g.find(x => x.mes === 'sin_fecha')?.eventos.map(e => e.id)).toContain('foro_corregimental');
  });
  it('pasados excluye por definir / no se realiza y va del más reciente al más viejo', () => {
    const p = pasados(E, '2026-10-16');
    expect(p.find(e => e.id === 'foro_corregimental' || e.id === 'semana_ed_vial')).toBeUndefined();
    expect(p[0].desde >= p[p.length - 1].desde).toBe(true);
  });
  it('buscar ignora tildes y mayúsculas', () => {
    expect(buscar(E, 'ANTIOQUENIDAD').map(e => e.id)).toContain('antioquenidad');
    expect(buscar(E, 'evaluacion').length).toBeGreaterThan(0);
    expect(buscar(E, 'zzzz')).toHaveLength(0);
  });
  it('filtra por categoría', () => {
    const r = filtrarPorCategoria(E, ['receso']);
    expect(r.every(e => e.categoria === 'receso')).toBe(true);
    expect(filtrarPorCategoria(E, [])).toHaveLength(E.length);
  });
  it('grado 11 solo para quien enseña 11', () => {
    expect(eventosParaGrado11(E, false).some(e => e.aplicaA === 'grado11')).toBe(false);
    expect(eventosParaGrado11(E, true).some(e => e.aplicaA === 'grado11')).toBe(true);
  });
  it('eventos del día incluye rangos', () => {
    expect(eventosDelDia(E, '2026-10-14').map(e => e.id)).toContain('semana_convivencia');
  });
});

describe('alertas docentes', () => {
  it('escalones', () => {
    expect(escalonDe(0)).toBe(0);
    expect(escalonDe(2)).toBe(2);
    expect(escalonDe(1)).toBe(2);
    expect(escalonDe(7)).toBe(7);
    expect(escalonDe(8)).toBeNull();
    expect(escalonDe(-1)).toBeNull();
  });
  it('21-oct: alerta académica a 7 días; 28-oct: hoy', () => {
    const a = alertasDocente(E, '2026-10-21').find(x => x.evento.id === 'alerta_p3');
    expect(a?.escalon).toBe(7);
    expect(alertasDocente(E, '2026-10-26').find(x => x.evento.id === 'alerta_p3')?.escalon).toBe(2);
    expect(alertasDocente(E, '2026-10-28').find(x => x.evento.id === 'alerta_p3')?.escalon).toBe(0);
    expect(alertasDocente(E, '2026-10-16').find(x => x.evento.id === 'alerta_p3')).toBeUndefined();
  });
  it('no alerta eventos por definir ni que no se realizan', () => {
    const base = { titulo: 't', desde: '2026-10-20', categoria: 'institucional' as const, alertaDocente: true };
    expect(alertasDocente([{ ...base, id: 'a', porDefinir: true }, { ...base, id: 'b', noSeRealiza: true }], '2026-10-19')).toHaveLength(0);
  });
});

describe('cambios y textos', () => {
  it('cambio reciente dentro de 10 días', () => {
    const e = { ...E[0], cambio: { antes: { desde: '2026-10-01' }, cuando: '2026-10-10T12:00:00Z' } };
    expect(cambioReciente(e, '2026-10-16')).toBe(true);
    expect(cambioReciente(e, '2026-10-25')).toBe(false);
    expect(cambioReciente(E[0], '2026-10-16')).toBe(false);
  });
  it('textoFecha', () => {
    expect(textoFecha({ desde: '2026-10-12', hasta: '2026-10-16' })).toBe('12 oct – 16 oct');
    expect(textoFecha({ desde: '2026-10-12', porDefinir: true })).toBe('Por definir');
  });
});
