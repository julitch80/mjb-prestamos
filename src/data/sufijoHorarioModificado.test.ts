import { describe, it, expect } from 'vitest';
import {
  agregarSufijoHorarioModificado,
  parseHorarioModificadoDeNotificacion,
} from './horarioModificado';

describe('agregarSufijoHorarioModificado / parseHorarioModificadoDeNotificacion', () => {
  it('agrega y luego extrae fecha+jornada sin alterar el texto visible', () => {
    const mensaje = 'Tu horario del Jueves 13 ago 2026 cambió: Bloque 2 fue cancelado.';
    const conSufijo = agregarSufijoHorarioModificado(mensaje, '2026-08-13', 'manana');
    const { mensajeLimpio, ref } = parseHorarioModificadoDeNotificacion(conSufijo);
    expect(mensajeLimpio).toBe(mensaje);
    expect(ref).toEqual({ fecha: '2026-08-13', jornada: 'manana' });
  });

  it('funciona con jornada tarde', () => {
    const conSufijo = agregarSufijoHorarioModificado('Mensaje x', '2026-09-01', 'tarde');
    const { ref } = parseHorarioModificadoDeNotificacion(conSufijo);
    expect(ref).toEqual({ fecha: '2026-09-01', jornada: 'tarde' });
  });

  it('mensajes sin sufijo devuelven ref null y el texto intacto', () => {
    const mensaje = 'Notificación normal sin sufijo';
    const { mensajeLimpio, ref } = parseHorarioModificadoDeNotificacion(mensaje);
    expect(mensajeLimpio).toBe(mensaje);
    expect(ref).toBeNull();
  });

  it('un mensaje de acompañante concatenado (frase + frase) sigue parseando el sufijo final', () => {
    const base = agregarSufijoHorarioModificado('Bloque 2 movido.', '2026-08-13', 'manana');
    // simula EditorHorarioMode.tsx concatenando la frase de acompañante ANTES del sufijo
    // (el sufijo siempre se agrega al final, tras la concatenación)
    const mensajeFinal = `${base.replace(/\n\[\[horario:.*\]\]$/, '')} Acompañas al grupo 9.1.`;
    const conSufijo = agregarSufijoHorarioModificado(mensajeFinal, '2026-08-13', 'manana');
    const { mensajeLimpio, ref } = parseHorarioModificadoDeNotificacion(conSufijo);
    expect(mensajeLimpio).toBe('Bloque 2 movido. Acompañas al grupo 9.1.');
    expect(ref).toEqual({ fecha: '2026-08-13', jornada: 'manana' });
  });

  it('no confunde un mensaje que contenga texto similar al patrón sin ser el sufijo real', () => {
    const mensaje = 'Revisa [[horario:2026-08-13:manana]] en el aviso de rectoría';
    // no está al final del string -> no matchea
    const { ref } = parseHorarioModificadoDeNotificacion(mensaje);
    expect(ref).toBeNull();
  });
});
