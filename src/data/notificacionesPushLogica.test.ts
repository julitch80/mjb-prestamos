import { describe, expect, test } from 'vitest';
import {
  categoriaDeTipo,
  debeEnviarse,
  destinatariosDeCanal,
  esHorarioSilencioBogota,
  PREFERENCIAS_DEFAULT,
  type PreferenciasNotif,
} from './notificacionesPushLogica';

describe('categoriaDeTipo', () => {
  test.each([
    ['chat', 'chat'],
    ['rectoria', 'avisos'],
    ['coordinador', 'avisos'],
    ['intercambio', 'avisos'],
    ['horario_modificado', 'horario'],
    ['aprobada', 'reservas'],
    ['rechazada', 'reservas'],
    ['cancelada', 'reservas'],
    ['sugerencia', 'sugerencias'],
  ] as const)('%s -> %s', (tipo, categoria) => {
    expect(categoriaDeTipo(tipo)).toBe(categoria);
  });
});

describe('debeEnviarse', () => {
  test('sin preferencias guardadas, todo encendido por defecto', () => {
    expect(debeEnviarse('chat', null)).toBe(true);
    expect(debeEnviarse('sugerencia', undefined)).toBe(true);
  });
  test('respeta un interruptor apagado', () => {
    const prefs: PreferenciasNotif = { ...PREFERENCIAS_DEFAULT, chat: false };
    expect(debeEnviarse('chat', prefs)).toBe(false);
    expect(debeEnviarse('aprobada', prefs)).toBe(true);
  });
  test('categoría ausente del documento cae al default (true)', () => {
    expect(debeEnviarse('horario_modificado', { chat: false })).toBe(true);
  });
});

describe('esHorarioSilencioBogota — bordes (PRD: 21:00–05:30 America/Bogota)', () => {
  // America/Bogota = UTC-5 todo el año.
  const bogotaAUtc = (h: number, m: number) => new Date(Date.UTC(2026, 8, 23, h + 5, m));

  test('20:59 -> NO es silencio', () => {
    expect(esHorarioSilencioBogota(bogotaAUtc(20, 59))).toBe(false);
  });
  test('21:00 -> SÍ es silencio', () => {
    expect(esHorarioSilencioBogota(bogotaAUtc(21, 0))).toBe(true);
  });
  test('05:29 -> SÍ es silencio', () => {
    expect(esHorarioSilencioBogota(bogotaAUtc(5, 29))).toBe(true);
  });
  test('05:30 -> NO es silencio', () => {
    expect(esHorarioSilencioBogota(bogotaAUtc(5, 30))).toBe(false);
  });
  test('medianoche -> SÍ es silencio', () => {
    expect(esHorarioSilencioBogota(bogotaAUtc(0, 0))).toBe(true);
  });
  test('mediodía -> NO es silencio', () => {
    expect(esHorarioSilencioBogota(bogotaAUtc(12, 0))).toBe(false);
  });
});

describe('destinatariosDeCanal', () => {
  const usuarios = [
    { correo: 'a@x.edu.co', role: 'docente', active: true, sede: 'central', jornada: 'manana' },
    { correo: 'b@x.edu.co', role: 'docente', active: true, sede: 'central', jornada: 'tarde' },
    { correo: 'c@x.edu.co', role: 'coordinador', active: true, sede: 'central', jornada: 'tarde' },
    { correo: 'inactivo@x.edu.co', role: 'docente', active: false, sede: 'central', jornada: 'manana' },
  ];

  test('general: todos los activos menos el autor', () => {
    const dest = destinatariosDeCanal({ type: 'general' }, usuarios, 'a@x.edu.co');
    expect(dest.sort()).toEqual(['b@x.edu.co', 'c@x.edu.co'].sort());
  });

  test('rol: solo el rol permitido o superusuario', () => {
    const dest = destinatariosDeCanal(
      { type: 'rol', allowedRoles: ['coordinador'] }, usuarios, 'x@nadie.co');
    expect(dest).toEqual(['c@x.edu.co']);
  });

  test('directo/grupo: solo los miembros, excluyendo al autor', () => {
    const dest = destinatariosDeCanal(
      { type: 'directo', members: ['a@x.edu.co', 'b@x.edu.co'] }, usuarios, 'a@x.edu.co');
    expect(dest).toEqual(['b@x.edu.co']);
  });

  test('segmento: coordinador/rectora ven todo; docente solo su sede+jornada', () => {
    const dest = destinatariosDeCanal(
      { type: 'segmento', sede: 'central', jornada: 'tarde' }, usuarios, 'z@nadie.co');
    // b (docente tarde central) + c (coordinador, ve todo)
    expect(dest.sort()).toEqual(['b@x.edu.co', 'c@x.edu.co'].sort());
  });

  test('excluye inactivos siempre', () => {
    const dest = destinatariosDeCanal({ type: 'general' }, usuarios, 'nadie@x.co');
    expect(dest).not.toContain('inactivo@x.edu.co');
  });
});
