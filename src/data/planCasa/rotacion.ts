// Giro de fotos en pantalla (solo presentación: nunca se modifica el archivo). Lógica pura.

/** Suma un giro de 90° (+1 = horario ↻, -1 = antihorario ↺) y deja el resultado en 0, 90, 180 o 270. */
export function girar(actual: number, pasos: 1 | -1): number {
  return ((((actual + 90 * pasos) % 360) + 360) % 360);
}

/** Lee un valor guardado y lo normaliza a 0/90/180/270 (cualquier otra cosa → 0). */
export function rotacionValida(v: unknown): number {
  const n = Number(v);
  return n === 90 || n === 180 || n === 270 ? n : 0;
}

export interface CajaGirada {
  /** Tamaño del contenedor (ya con la imagen girada dentro, sin recortes). */
  cajaAncho: number; cajaAlto: number;
  /** Tamaño de la imagen ANTES de girar (se centra y se gira con transform). */
  imgAncho: number; imgAlto: number;
}

/** Ajusta la imagen girada para que quepa en anchoMax × altoMax; nunca la agranda más de su tamaño natural. */
export function cajaGirada(natAncho: number, natAlto: number, grados: number, anchoMax: number, altoMax: number): CajaGirada {
  const de_lado = grados === 90 || grados === 270;
  const vAncho = de_lado ? natAlto : natAncho;
  const vAlto = de_lado ? natAncho : natAlto;
  const s = Math.min(anchoMax / vAncho, altoMax / vAlto, 1);
  return { cajaAncho: vAncho * s, cajaAlto: vAlto * s, imgAncho: natAncho * s, imgAlto: natAlto * s };
}
