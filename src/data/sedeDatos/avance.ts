import type { Entrada, RespuestaTema, Tema } from './tipos';

export const entradaVacia = (): Entrada => ({ texto: '', refs: [], audios: [] });
export const respuestaVacia = (): RespuestaTema => ({ estado: 'pendiente', entrada: entradaVacia(), preguntas: {} });

export function entradaTieneContenido(e?: Entrada): boolean {
  return !!e && (e.texto.trim() !== '' || e.refs.length > 0 || e.audios.length > 0);
}

/** Una pregunta cuenta como respondida si tiene opción/texto elegido o una nota propia. */
export function preguntasSinResponder(tema: Tema, r?: RespuestaTema): string[] {
  return tema.preguntas
    .filter(p => {
      const x = r?.preguntas?.[p.id];
      return !x || (x.valor.trim() === '' && !entradaTieneContenido(x.entrada));
    })
    .map(p => p.id);
}

export function tieneContenido(tema: Tema, r?: RespuestaTema): boolean {
  if (!r) return false;
  const sin = preguntasSinResponder(tema, r);
  return entradaTieneContenido(r.entrada) || tema.preguntas.some(p => !sin.includes(p.id));
}

/** ¿El tema está resuelto? bien = confirmado (y sus preguntas contestadas); corregir/respondido = hay algo escrito. */
export function estaCompleto(tema: Tema, r?: RespuestaTema): boolean {
  if (!r) return false;
  if (r.estado === 'bien') return tema.modo === 'confirmar' && preguntasSinResponder(tema, r).length === 0;
  if (r.estado === 'corregir' || r.estado === 'respondido') return tieneContenido(tema, r);
  return false;
}

export interface Avance { hechos: number; total: number; despues: number; abiertos: string[] }
export function calcularAvance(temas: Tema[], respuestas: Record<string, RespuestaTema>): Avance {
  const abiertos: string[] = [];
  let hechos = 0;
  let despues = 0;
  for (const t of temas) {
    if (estaCompleto(t, respuestas[t.id])) hechos++;
    else {
      abiertos.push(t.id);
      if (respuestas[t.id]?.estado === 'despues') despues++;
    }
  }
  return { hechos, total: temas.length, despues, abiertos };
}
