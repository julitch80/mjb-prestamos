import { describe, it, expect } from 'vitest';
import { crearEvento, formatearBitacora, formatearMmSs, formatearTranscurrido, ordenar, quitarUltimo } from './bitacora';
import { estadoConvulsion, textoDuracion, UMBRAL_CONVULSION_S } from './convulsion';
import { clasificarRespiraciones, rpmPorConteo, formatearRegistroResp } from './respiraciones';
import { progreso, segundosRestantes, terminado, DURACION_AGUA_FRIA_S } from './quemaduras';
import { enlaceMapas, formatearCoordenada, mensajeErrorUbicacion, textoParaDictar } from './ubicacion';

describe('bitacora', () => {
  it('formatea tiempos', () => {
    expect(formatearMmSs(0)).toBe('00:00');
    expect(formatearMmSs(205)).toBe('03:25');
    expect(formatearMmSs(3725)).toBe('1:02:05');
    expect(formatearTranscurrido(1000, 206000)).toBe('+03:25');
  });
  it('ordena, deshace y copia', () => {
    const t0 = new Date(2026, 9, 1, 10, 0, 0).getTime();
    const ev = [crearEvento('llame123', t0 + 60000), crearEvento('accidente', t0), crearEvento('traslado', t0 + 600000, ' Clínica X ')];
    expect(ordenar(ev).map(e => e.tipo)).toEqual(['accidente', 'llame123', 'traslado']);
    expect(quitarUltimo(ev)).toHaveLength(2);
    const txt = formatearBitacora(t0, ev);
    expect(txt).toContain('hora 0: 10:00:00');
    expect(txt).toContain('10:01:00 (+01:00) Llamé al 123');
    expect(txt).toContain('Se lo llevaron: Clínica X');
    expect(formatearBitacora(null, [])).toContain('sin iniciar');
  });
});

describe('convulsion', () => {
  it('estados y umbral', () => {
    expect(estadoConvulsion(false, 0)).toBe('quieto');
    expect(estadoConvulsion(true, UMBRAL_CONVULSION_S - 1)).toBe('en_curso');
    expect(estadoConvulsion(true, UMBRAL_CONVULSION_S)).toBe('alerta');
    expect(textoDuracion(125)).toBe('2 min 5 s');
    expect(textoDuracion(40)).toBe('40 s');
  });
});

describe('respiraciones', () => {
  it('calcula por minuto', () => {
    expect(rpmPorConteo(10, 30)).toBe(20);
    expect(rpmPorConteo(5, 0)).toBe(0);
  });
  it('clasifica según rangos', () => {
    expect(clasificarRespiraciones(20, '6-11')).toBe('normal');
    expect(clasificarRespiraciones(15, '6-11')).toBe('vigilar');
    expect(clasificarRespiraciones(11, '6-11')).toBe('alerta');
    expect(clasificarRespiraciones(31, '6-11')).toBe('alerta');
    expect(clasificarRespiraciones(30, '6-11')).toBe('vigilar');
    expect(clasificarRespiraciones(12, '12-17')).toBe('normal');
    expect(clasificarRespiraciones(9, 'adulto')).toBe('alerta');
    expect(clasificarRespiraciones(10, 'adulto')).toBe('vigilar');
    expect(clasificarRespiraciones(26, '12-17')).toBe('alerta');
    expect(formatearRegistroResp([{ hora: '10:00', rpm: 16, edad: 'adulto', semaforo: 'normal' }])).toContain('16 resp/min');
  });
});

describe('quemaduras', () => {
  it('cuenta regresiva', () => {
    expect(DURACION_AGUA_FRIA_S).toBe(1200);
    expect(segundosRestantes(1200, 0)).toBe(1200);
    expect(segundosRestantes(1200, 1500)).toBe(1199);
    expect(segundosRestantes(1200, 2_000_000)).toBe(0);
    expect(terminado(1200, 1_200_000)).toBe(true);
    expect(terminado(1200, 1_199_000)).toBe(false);
    expect(progreso(1200, 600_000)).toBeCloseTo(0.5);
  });
});

describe('ubicacion', () => {
  const p = { lat: 6.18123456, lng: -75.65987654, precisionM: 12.4 };
  it('formatea y enlaza', () => {
    expect(formatearCoordenada(p.lat)).toBe('6.18123');
    expect(enlaceMapas(p)).toBe('https://maps.google.com/?q=6.18123,-75.65988');
    expect(textoParaDictar(p)).toContain('12 metros');
    expect(mensajeErrorUbicacion(1)).toContain('denegado');
  });
});
