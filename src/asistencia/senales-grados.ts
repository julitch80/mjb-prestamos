/**
 * Senales del Lector de grados (pedido de Julian, 26-nov): color, sonido y vibracion para
 * que el portero sepa el resultado sin leer la pantalla.
 *
 *  verde   = invitacion con todos los cupos libres, o graduando que puede registrar llegada;
 *  naranja = invitacion que ya uso algun cupo pero le queda;
 *  rojo    = sin cupos, invalida, anulada, evento cerrado, ya llego, no es graduando.
 *
 * El sonido sale de Web Audio (sin archivos). iOS solo deja sonar un AudioContext creado o
 * reanudado dentro de un toque: por eso `prepararAudio()` se llama al tocar «Abrir la camara».
 * El color nunca va solo: el texto grande del resultado se mantiene.
 */

export type NivelSenal = 'verde' | 'naranja' | 'rojo';

export function nivelDeLectura(
  res:
    | { tipo: 'rojo' }
    | { tipo: 'invitacion'; inv: { cupos: number; restantes: number; anulada?: boolean } }
    | { tipo: 'graduando'; g: { llego: boolean } },
): NivelSenal {
  if (res.tipo === 'rojo') return 'rojo';
  if (res.tipo === 'graduando') return res.g.llego ? 'rojo' : 'verde';
  if (res.inv.anulada || res.inv.restantes <= 0) return 'rojo';
  return res.inv.restantes >= res.inv.cupos ? 'verde' : 'naranja';
}

const CLAVE_SONIDO = 'mjb-grados-sonido';

export function sonidoActivo(): boolean {
  try {
    return localStorage.getItem(CLAVE_SONIDO) !== 'no';
  } catch {
    return true;
  }
}

export function guardarSonido(activo: boolean): void {
  try {
    localStorage.setItem(CLAVE_SONIDO, activo ? 'si' : 'no');
  } catch {
    /* sin almacenamiento: se queda el valor de esta pantalla */
  }
}

let ctx: AudioContext | null = null;

/** Llamar DENTRO de un toque: crea o reanuda el audio (exigencia de iOS). */
export function prepararAudio(): void {
  try {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    if (!ctx) ctx = new AC();
    if (ctx.state === 'suspended') void ctx.resume();
    // Un sonido mudo dentro del gesto termina de desbloquear Safari.
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    g.gain.value = 0;
    o.connect(g).connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + 0.01);
  } catch {
    ctx = null;
  }
}

/** [frecuencia Hz, inicio s, duracion s] */
const TONOS: Record<NivelSenal, [number, number, number][]> = {
  verde: [[1320, 0, 0.15]],
  naranja: [
    [660, 0, 0.16],
    [880, 0.22, 0.16],
  ],
  rojo: [
    [220, 0, 0.28],
    [220, 0.38, 0.28],
    [220, 0.76, 0.28],
  ],
};

const VIBRACION: Record<NivelSenal, number[]> = {
  verde: [80],
  naranja: [80, 80, 80],
  rojo: [600],
};

export function emitirSenal(nivel: NivelSenal, conSonido: boolean): void {
  try {
    navigator.vibrate?.(VIBRACION[nivel]);
  } catch {
    /* sin vibracion */
  }
  if (!conSonido || !ctx) return;
  try {
    if (ctx.state === 'suspended') void ctx.resume();
    const t0 = ctx.currentTime + 0.02;
    for (const [f, ini, dur] of TONOS[nivel]) {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = nivel === 'rojo' ? 'square' : 'sine';
      o.frequency.value = f;
      // Subida y bajada cortas: sin ellas el tono hace «clic».
      g.gain.setValueAtTime(0, t0 + ini);
      g.gain.linearRampToValueAtTime(nivel === 'rojo' ? 0.25 : 0.4, t0 + ini + 0.01);
      g.gain.setValueAtTime(nivel === 'rojo' ? 0.25 : 0.4, t0 + ini + dur - 0.02);
      g.gain.linearRampToValueAtTime(0, t0 + ini + dur);
      o.connect(g).connect(ctx.destination);
      o.start(t0 + ini);
      o.stop(t0 + ini + dur + 0.01);
    }
  } catch {
    /* sin audio: queda el color y la vibracion */
  }
}
