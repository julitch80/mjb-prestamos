import { describe, expect, it } from 'vitest';
import {
  VENTANA_SUSTENTACION, areasPendientes, diasVentana, enVentana, fechaValida, limiteAgenda,
  pendientesPorDia, resumenProgramadas, textoEntre, textoVentana,
} from './ventanaSustentacion';

describe('ventana de sustentación', () => {
  it('textos', () => {
    expect(textoVentana()).toBe('24 al 27 de noviembre');
    expect(textoEntre()).toBe('Entre el 24 y el 27 de noviembre');
  });
  it('días hábiles y pertenencia', () => {
    expect(diasVentana()).toEqual(['2026-11-24', '2026-11-25', '2026-11-26', '2026-11-27']);
    expect(enVentana('2026-11-23')).toBe(false);
    expect(enVentana('2026-11-27')).toBe(true);
    expect(enVentana('2026-11-28')).toBe(false);
  });
  it('límite de la agenda', () => {
    expect(limiteAgenda('2026-11-20')).toBe('2026-11-27');
    expect(limiteAgenda('2026-12-04')).toBe('2026-12-04');
  });
  it('pendientes por día', () => {
    const s = [{ asignatura: 'Física', fecha: null }, { asignatura: 'Español', fecha: '2026-11-25' }];
    expect(areasPendientes(s)).toEqual(['Física']);
    const m = pendientesPorDia(s);
    expect(Object.keys(m)).toHaveLength(4);
    expect(m['2026-11-24']).toEqual(['Física']);
    expect(pendientesPorDia([{ asignatura: 'Física', fecha: '2026-11-24' }])).toEqual({});
  });
  it('resumen y validación', () => {
    expect(resumenProgramadas(['2026-11-24', null, undefined]).texto).toBe('Sustentaciones: 1 de 3 programadas');
    expect(fechaValida('')).toBe(true);
    expect(fechaValida('2026-11-20')).toBe(false);
    expect(VENTANA_SUSTENTACION.desde).toBe('2026-11-24');
  });
});
