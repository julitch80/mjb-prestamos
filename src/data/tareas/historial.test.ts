import { describe, it, expect } from 'vitest';
import type { Tarea } from './tipos';
import { estadoHistorial, tareasPropias, gruposDelHistorial, filtrarHistorial, agruparPorMes, precargaDesde } from './historial';

const base = (o: Partial<Tarea>): Tarea => ({
  id: 'x', grupo: '9.1', asignaturaId: 'fis', docenteId: 'julian', titulo: 'T', momentos: 2,
  fechaAsignacion: '2026-09-01', fechaEntrega: '2026-09-10', estado: 'activa', ...o,
});

describe('historial', () => {
  it('estado', () => {
    expect(estadoHistorial(base({}), '2026-09-10')).toBe('vigente');
    expect(estadoHistorial(base({}), '2026-09-11')).toBe('vencida');
    expect(estadoHistorial(base({ estado: 'cancelada' }), '2026-01-01')).toBe('cancelada');
  });
  it('solo propias', () => {
    const r = tareasPropias([base({ id: 'a' }), base({ id: 'b', docenteId: 'otro' })], 'julian');
    expect(r.map(t => t.id)).toEqual(['a']);
  });
  it('grupos con historia ajena a la asignación', () => {
    expect(gruposDelHistorial([base({ grupo: '8º1' }), base({ grupo: '9.1' })], ['9.1', '9.2'])).toEqual(['9.1', '9.2', '8º1']);
  });
  it('filtra por grupo y título sin tildes, orden reciente', () => {
    const ts = [
      base({ id: '1', titulo: 'Cinemática', fechaEntrega: '2026-05-01' }),
      base({ id: '2', titulo: 'Cinematica II', fechaEntrega: '2026-08-01' }),
      base({ id: '3', titulo: 'Cinemática', grupo: '9.2', fechaEntrega: '2026-09-01' }),
      base({ id: '4', titulo: 'Otra', fechaEntrega: '2026-07-01' }),
    ];
    expect(filtrarHistorial(ts, '9.1', '').map(t => t.id)).toEqual(['2', '4', '1']);
    expect(filtrarHistorial(ts, '9.1', 'CINEMATICA').map(t => t.id)).toEqual(['2', '1']);
  });
  it('desempata por fechaAsignacion', () => {
    const ts = [base({ id: 'a', fechaAsignacion: '2026-09-01' }), base({ id: 'b', fechaAsignacion: '2026-09-03' })];
    expect(filtrarHistorial(ts, '9.1', '').map(t => t.id)).toEqual(['b', 'a']);
  });
  it('agrupa por mes', () => {
    const g = agruparPorMes([base({ id: '1', fechaEntrega: '2026-09-20' }), base({ id: '2', fechaEntrega: '2026-09-02' }), base({ id: '3', fechaEntrega: '2026-08-30' })]);
    expect(g.map(m => [m.mes, m.tareas.length])).toEqual([['2026-09', 2], ['2026-08', 1]]);
  });
  it('precarga: recordatorio sin fechas, copia enlaces', () => {
    const p = precargaDesde(base({ tipo: 'recordatorio', tipoRecordatorio: 'materiales', momentos: 0, enlaces: [{ url: 'https://a.co' }], adjuntoUrl: 'u', adjuntoNombre: 'n' }), '9.2');
    expect(p).toMatchObject({ tipo: 'recordatorio', tipoRecordatorio: 'materiales', grupo: '9.2', momentos: 1, adjuntoUrl: 'u' });
    expect(p).not.toHaveProperty('fechaEntrega');
  });
});
