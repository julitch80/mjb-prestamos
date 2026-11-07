import { describe, expect, it } from 'vitest';
import { MAX_TEXTO_CONSULTA, TOPE_DIARIO_CONSULTAS, cupoConsultas, tiposVisibles, tokenValido, validarConsulta, validarRespuesta } from './consultas';

describe('consultas', () => {
  it('valida tipo, texto y contacto', () => {
    expect(validarConsulta({ tipo: 'x', texto: 'hola' }).ok).toBe(false);
    expect(validarConsulta({ tipo: 'tecnica', texto: '   ' }).ok).toBe(false);
    expect(validarConsulta({ tipo: 'tecnica', texto: 'a'.repeat(MAX_TEXTO_CONSULTA + 1) }).ok).toBe(false);
    expect(validarConsulta({ tipo: 'tecnica', texto: 'a', contacto: 'b'.repeat(200) }).ok).toBe(false);
    expect(validarConsulta({ tipo: 'pedagogica', texto: ' no veo la guía ', contacto: ' 300 ' })).toEqual({ ok: true, tipo: 'pedagogica', texto: 'no veo la guía', contacto: '300' });
    expect(validarConsulta({ tipo: 'pedagogica', texto: 'a'.repeat(MAX_TEXTO_CONSULTA) }).ok).toBe(true);
  });
  it('limita por día', () => {
    expect(cupoConsultas(TOPE_DIARIO_CONSULTAS - 1).ok).toBe(true);
    expect(cupoConsultas(TOPE_DIARIO_CONSULTAS).ok).toBe(false);
  });
  it('permisos por tipo', () => {
    expect(tiposVisibles(true, false)).toEqual(['pedagogica', 'tecnica']);
    expect(tiposVisibles(false, true)).toEqual(['pedagogica']);
    expect(tiposVisibles(false, false)).toEqual([]);
  });
  it('token y respuesta', () => {
    expect(tokenValido('abc')).toBe(false);
    expect(tokenValido('a'.repeat(24))).toBe(true);
    expect(validarRespuesta('  ').ok).toBe(false);
    expect(validarRespuesta('ok').ok).toBe(true);
  });
});
