import { describe, expect, it } from 'vitest';
import {
  TOPE_BYTES, TOPE_DIARIO_ENVIOS, bytesDeBase64, cupoDiario, finAnioLectivo, inicioDiaColombia, mimeEfectivo,
  nombreSeguro, seguimientoTrasEntrega, validarArchivo, validarEnlace,
} from './entregas';

describe('validarArchivo', () => {
  it('acepta fotos, audios y PDF', () => {
    expect(validarArchivo('a.jpg', 'image/jpeg', 100)).toMatchObject({ ok: true, tipo: 'foto' });
    expect(validarArchivo('a.heic', '', 100)).toMatchObject({ ok: true, tipo: 'foto', contentType: 'image/heic' });
    expect(validarArchivo('n.m4a', 'audio/x-m4a', 100)).toMatchObject({ ok: true, tipo: 'audio' });
    expect(validarArchivo('n.ogg', 'audio/ogg; codecs=opus', 100)).toMatchObject({ ok: true, tipo: 'audio' });
    expect(validarArchivo('t.pdf', 'application/octet-stream', 100)).toMatchObject({ ok: true, tipo: 'pdf' });
  });
  it('rechaza videos (con pista del enlace), otros tipos, vacíos y > 10 MB', () => {
    const v = validarArchivo('v.mp4', 'video/mp4', 100);
    expect(v.ok).toBe(false);
    expect(!v.ok && v.error).toMatch(/enlace/);
    expect(validarArchivo('x.exe', 'application/x-msdownload', 100).ok).toBe(false);
    expect(validarArchivo('a.jpg', 'image/jpeg', 0).ok).toBe(false);
    expect(validarArchivo('a.jpg', 'image/jpeg', TOPE_BYTES).ok).toBe(true);
    expect(validarArchivo('a.jpg', 'image/jpeg', TOPE_BYTES + 1).ok).toBe(false);
  });
  it('mimeEfectivo deduce por extensión', () => expect(mimeEfectivo('A.WAV', '')).toBe('audio/wav'));
});

describe('enlaces y nombres', () => {
  it('validarEnlace', () => {
    expect(validarEnlace('https://youtu.be/x').ok).toBe(true);
    expect(validarEnlace('javascript:alert(1)').ok).toBe(false);
    expect(validarEnlace('hola').ok).toBe(false);
  });
  it('nombreSeguro quita tildes y barras', () => {
    expect(nombreSeguro('../Fotó de ñandú.jpg')).toBe('Foto_de_nandu.jpg');
    expect(nombreSeguro('')).toBe('archivo');
  });
  it('bytesDeBase64', () => {
    expect(bytesDeBase64(Buffer.from('hola').toString('base64'))).toBe(4);
    expect(bytesDeBase64(Buffer.from('hol').toString('base64'))).toBe(3);
  });
});

describe('tope diario y fechas', () => {
  it('cupoDiario', () => {
    expect(cupoDiario(TOPE_DIARIO_ENVIOS - 1).ok).toBe(true);
    expect(cupoDiario(TOPE_DIARIO_ENVIOS).ok).toBe(false);
  });
  it('inicioDiaColombia: 28-oct 02:00 UTC es aún 27-oct en Colombia', () => {
    expect(inicioDiaColombia(Date.UTC(2026, 9, 28, 2))).toBe(Date.UTC(2026, 9, 27, 5));
    expect(inicioDiaColombia(Date.UTC(2026, 9, 28, 15))).toBe(Date.UTC(2026, 9, 28, 5));
  });
  it('finAnioLectivo = 31-dic 23:59:59 Colombia', () => {
    expect(finAnioLectivo(Date.UTC(2026, 9, 28))).toBe(Date.UTC(2027, 0, 1, 4, 59, 59));
  });
});

describe('seguimientoTrasEntrega', () => {
  it('pendiente → entregado; conserva observación', () => {
    const s = seguimientoTrasEntrega({ estado: 'pendiente', observacion: 'ok' }, 5);
    expect(s).toEqual({ estado: 'entregado', observacion: 'ok', entregadoEn: 5, actualizadoEn: 5 });
  });
  it('sin seguimiento previo → entregado', () => expect(seguimientoTrasEntrega(undefined, 1).estado).toBe('entregado'));
  it('revisado se conserva', () => expect(seguimientoTrasEntrega({ estado: 'revisado' }, 9).estado).toBe('revisado'));
});
