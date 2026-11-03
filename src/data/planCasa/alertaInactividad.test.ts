import { describe, expect, it } from 'vitest';
import {
  agruparPorDestinatario, cuerpoAlertaInactividad, destinatariosAlerta, planesAAlertar, type PlanParaAlerta,
} from './alertaInactividad';

const dia = (iso: string) => Date.parse(`${iso}T15:00:00Z`); // 10:00 en Bogotá
const plan = (extra: Partial<PlanParaAlerta> = {}): PlanParaAlerta => ({
  id: 'p1', nombres: 'Samuel Andrés', grupo: '8º1', desde: '2026-10-20', hasta: '2026-11-30', estado: 'activo',
  ultimaEntregaMs: null, ...extra,
});
const HOY = '2026-11-02';
const AHORA = dia(HOY);

describe('planesAAlertar', () => {
  it('alerta con 7+ días desde `desde` si nunca entregó', () => {
    const r = planesAAlertar([plan()], HOY, AHORA);
    expect(r).toEqual([{ planId: 'p1', primerNombre: 'Samuel', grupo: '8º1', jornada: 'tarde', dias: 13 }]);
  });
  it('no alerta con menos de 7 días', () => {
    expect(planesAAlertar([plan({ ultimaEntregaMs: dia('2026-10-30') })], HOY, AHORA)).toEqual([]);
    expect(planesAAlertar([plan({ ultimaEntregaMs: dia('2026-10-27') })], HOY, AHORA)).toEqual([]); // 6 días
  });
  it('alerta exactamente a los 7 días', () => {
    expect(planesAAlertar([plan({ ultimaEntregaMs: dia('2026-10-26') })], HOY, AHORA).length).toBe(1);
  });
  it('excluye cerrados, en espera y fuera de rango', () => {
    expect(planesAAlertar([plan({ estado: 'cerrado' })], HOY, AHORA)).toEqual([]);
    expect(planesAAlertar([plan({ enEspera: { hasta: '2026-11-10' } })], HOY, AHORA)).toEqual([]);
    expect(planesAAlertar([plan({ desde: '2026-11-05' })], HOY, AHORA)).toEqual([]);
    expect(planesAAlertar([plan({ hasta: '2026-11-01' })], HOY, AHORA)).toEqual([]);
  });
  it('no repite si la alerta es posterior a la última entrega y tiene menos de 7 días', () => {
    const p = plan({ ultimaEntregaMs: dia('2026-10-20'), alertaInactividad: { en: dia('2026-10-30'), dias: 10 } });
    expect(planesAAlertar([p], HOY, AHORA)).toEqual([]);
  });
  it('repite a los 7 días de la última alerta', () => {
    const p = plan({ ultimaEntregaMs: dia('2026-10-20'), alertaInactividad: { en: dia('2026-10-26'), dias: 7 } });
    expect(planesAAlertar([p], HOY, AHORA).length).toBe(1);
  });
  it('alerta de nuevo si hubo una entrega posterior a la última alerta', () => {
    const p = plan({ ultimaEntregaMs: dia('2026-10-22'), alertaInactividad: { en: dia('2026-10-21'), dias: 7 } });
    expect(planesAAlertar([p], HOY, AHORA).length).toBe(1);
  });
  it('usa el día de Bogotá, no el UTC (23:30 Bogotá es el día siguiente en UTC)', () => {
    const tarde = Date.parse('2026-10-27T04:30:00Z'); // 26-oct 23:30 en Bogotá
    expect(planesAAlertar([plan({ ultimaEntregaMs: tarde })], HOY, AHORA)[0].dias).toBe(7);
  });
});

describe('destinatarios y cuerpo', () => {
  const coords = [
    { correo: 'Janneth@x.co', jornada: 'manana' }, { correo: 'juan@x.co', jornada: 'tarde' }, { correo: 'amb@x.co', jornada: 'ambas' },
  ];
  it('equipo + coordinadores de la jornada, sin repetidos', () => {
    expect(destinatariosAlerta('tarde', ['Alex@x.co', 'juan@x.co'], coords)).toEqual(['alex@x.co', 'juan@x.co', 'amb@x.co']);
    expect(destinatariosAlerta('manana', ['alex@x.co'], coords)).toEqual(['alex@x.co', 'janneth@x.co', 'amb@x.co']);
  });
  it('agrupa por destinatario', () => {
    const a = [
      { planId: '1', primerNombre: 'Ana', grupo: '9.1', jornada: 'manana' as const, dias: 8 },
      { planId: '2', primerNombre: 'Beto', grupo: '6º1', jornada: 'tarde' as const, dias: 9 },
    ];
    const m = agruparPorDestinatario(a, ['alex@x.co'], coords);
    expect(m.get('alex@x.co')?.length).toBe(2);
    expect(m.get('janneth@x.co')?.map(x => x.planId)).toEqual(['1']);
    expect(m.get('juan@x.co')?.map(x => x.planId)).toEqual(['2']);
  });
  it('texto del push', () => {
    expect(cuerpoAlertaInactividad({ primerNombre: 'Samuel', grupo: '8º1', dias: 9 }))
      .toBe('Samuel (8º1) lleva 9 días sin entregar en su plan. Por favor contacten a la familia.');
  });
});
