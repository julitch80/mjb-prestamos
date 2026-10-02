import { describe, it, expect } from 'vitest';
import {
  ESTADO_RCP_INICIAL,
  avanzarRcp,
  intervaloSegundos,
  RITMOS_RCP,
  type EstadoRcp,
} from './metronomoRcp';

describe('metronomoRcp', () => {
  it('intervalo por ritmo', () => {
    expect(intervaloSegundos(120)).toBeCloseTo(0.5);
    expect(intervaloSegundos(100)).toBeCloseTo(0.6);
    expect(intervaloSegundos(110)).toBeCloseTo(60 / 110);
    expect(RITMOS_RCP).toEqual([100, 110, 120]);
  });

  it('cuenta 1..30, pausa de respiraciones y reinicia', () => {
    let e: EstadoRcp = ESTADO_RCP_INICIAL;
    e = avanzarRcp(e);
    expect(e.compresion).toBe(1);
    for (let i = 0; i < 29; i++) e = avanzarRcp(e);
    expect(e).toEqual({ compresion: 30, ciclos: 0, respirando: false });
    e = avanzarRcp(e);
    expect(e.respirando).toBe(true);
    e = avanzarRcp(e);
    expect(e).toEqual({ compresion: 1, ciclos: 1, respirando: false });
  });
});
