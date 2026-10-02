import { describe, expect, it } from 'vitest';
import {
  faltantesPropuesta,
  leerMensajeManual,
  PREFIJO_ESCENA,
  PROPUESTA_VACIA,
  textoSugerenciaEscena,
  type PropuestaEscena,
} from './propuestaEscena';

const completa: PropuestaEscena = {
  despuesDe: { numero: 12, titulo: 'Cuido lo de todos', grupo: 'Nuestros acuerdos' },
  tema: 'Uso del celular en clase',
  grados: '4º y 5º',
  lugar: 'El salón',
  personajes: 'Samuel y la profe',
  queOcurre: 'Samuel   saca el celular en plena clase y la profe le recuerda el acuerdo.',
  aprendizaje: 'El celular se guarda durante la clase',
};

describe('faltantesPropuesta', () => {
  it('vacía: pide tema, qué pasa y qué aprende', () => {
    expect(faltantesPropuesta({ despuesDe: null, ...PROPUESTA_VACIA })).toHaveLength(3);
  });
  it('completa: no falta nada (grados, lugar y personajes son opcionales)', () => {
    expect(faltantesPropuesta({ ...completa, grados: '', lugar: '', personajes: '' })).toEqual([]);
  });
});

describe('textoSugerenciaEscena', () => {
  it('empieza con el prefijo y dice después de qué lámina va', () => {
    const t = textoSugerenciaEscena(completa);
    expect(t.startsWith(PREFIJO_ESCENA)).toBe(true);
    expect(t).toContain('después de la lámina 12, «Cuido lo de todos» (Nuestros acuerdos)');
    expect(t).toContain('Qué pasa: Samuel saca el celular');
  });
  it('omite los campos opcionales vacíos', () => {
    const t = textoSugerenciaEscena({ ...completa, lugar: '  ' });
    expect(t).not.toContain('Dónde pasa');
  });
});

describe('leerMensajeManual', () => {
  const ok = { tipo: 'mjb-proponer-escena', despuesDe: { numero: 3, titulo: 'Hola', grupo: 'Personajes' } };
  it('acepta la forma exacta', () => {
    expect(leerMensajeManual(ok)).toEqual({ numero: 3, titulo: 'Hola', grupo: 'Personajes' });
  });
  it('rechaza otros mensajes y formas raras', () => {
    expect(leerMensajeManual('mjb-proponer-escena')).toBeNull();
    expect(leerMensajeManual({ tipo: 'otro', despuesDe: ok.despuesDe })).toBeNull();
    expect(leerMensajeManual({ ...ok, despuesDe: { ...ok.despuesDe, numero: '3' } })).toBeNull();
    expect(leerMensajeManual({ ...ok, despuesDe: { ...ok.despuesDe, numero: 2.5 } })).toBeNull();
  });
  it('recorta un título largo', () => {
    const r = leerMensajeManual({ ...ok, despuesDe: { ...ok.despuesDe, titulo: 'x'.repeat(500) } });
    expect(r?.titulo).toHaveLength(120);
  });
});
