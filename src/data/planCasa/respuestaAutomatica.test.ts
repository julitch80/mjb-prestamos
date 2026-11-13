import { describe, expect, it } from 'vitest';
import { CIERRE_AUTO, clasificarConsulta, normalizarTexto } from './respuestaAutomatica';

describe('clasificarConsulta', () => {
  it('normaliza tildes y signos', () => expect(normalizarTexto('¿Cómo ENVÍO un vídeo?')).toBe('como envio un video'));
  it('video/audio: responde y cierra con aviso automático', () => {
    const r = clasificarConsulta('tecnica', '¿Como envío un audio o un vídeo?');
    expect(r.auto).toBe(true);
    if (r.auto) { expect(r.tema).toBe('video-audio'); expect(r.respuesta).toContain('Pegar enlace (video)'); expect(r.respuesta.endsWith(CIERRE_AUTO)).toBe(true); }
  });
  it('archivo pesado', () => {
    const r = clasificarConsulta('tecnica', 'El PDF es muy grande y no sube');
    expect(r.auto && r.tema).toBe('archivo-pesado');
  });
  it('memoria insuficiente sin datos sensibles', () => {
    const r = clasificarConsulta('tecnica', 'Al tomar una foto se reinicia la página y dice memoria insuficiente');
    expect(r.auto && r.tema).toBe('memoria');
  });
  it('no carga / enlace no válido', () => {
    expect(clasificarConsulta('tecnica', 'La agenda no carga').auto).toBe(true);
    const r = clasificarConsulta('tecnica', 'dice enlace no válido');
    expect(r.auto && r.tema).toBe('no-carga');
  });
  it('pantalla de inicio', () => {
    const r = clasificarConsulta('tecnica', 'Cómo agrego la agenda a la pantalla de inicio');
    expect(r.auto && r.tema).toBe('pantalla-inicio');
  });
  it('salud va a una persona aunque coincida un tema', () => {
    const r = clasificarConsulta('tecnica', 'Hola soy Thomas, estoy operado de los 2 pies y al tomar una foto se reinicia la página y dice "memoria insuficiente"');
    expect(r.auto).toBe(false);
  });
  it('pedagógica nunca es automática', () => expect(clasificarConsulta('pedagogica', 'cómo envío un video').auto).toBe(false));
  it('dos temas o ninguno van a una persona', () => {
    expect(clasificarConsulta('tecnica', 'como envio un video muy pesado').auto).toBe(false);
    expect(clasificarConsulta('tecnica', 'me gusta el azul').auto).toBe(false);
  });
});
