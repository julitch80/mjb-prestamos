// Recorte de perspectiva tipo "escáner de documento" (CamScanner) hecho a
// mano con Canvas 2D: sin OpenCV.js (pesaría ~8MB). El usuario ajusta las
// 4 esquinas de la hoja sobre la foto y esto la endereza y recorta como si
// se hubiera escaneado plana.

export interface Punto {
  x: number;
  y: number;
}

/** Las 4 esquinas en orden: superior-izq, superior-der, inferior-der, inferior-izq. */
export type Esquinas = [Punto, Punto, Punto, Punto];

/** Esquinas por defecto: un rectángulo inset al 8% del borde de la imagen. */
export function esquinasPorDefecto(anchoImg: number, altoImg: number): Esquinas {
  const mx = anchoImg * 0.08;
  const my = altoImg * 0.08;
  return [
    { x: mx, y: my },
    { x: anchoImg - mx, y: my },
    { x: anchoImg - mx, y: altoImg - my },
    { x: mx, y: altoImg - my },
  ];
}

/** Resuelve la homografía que manda las 4 esquinas del rectángulo de salida
 * [0,w]x[0,h] a las 4 esquinas marcadas sobre la imagen de origen — mapeo
 * DIRECTO destino→origen, que es justo el que necesita el muestreo. Gauss-Jordan
 * sobre el sistema lineal de 8 incógnitas (h33 se fija en 1). */
function resolverHomografia(destino: Punto[], origen: Punto[]): number[] {
  const A: number[][] = [];
  const B: number[] = [];
  for (let i = 0; i < 4; i++) {
    const { x: X, y: Y } = destino[i];
    const { x, y } = origen[i];
    A.push([X, Y, 1, 0, 0, 0, -X * x, -Y * x]); B.push(x);
    A.push([0, 0, 0, X, Y, 1, -X * y, -Y * y]); B.push(y);
  }
  for (let col = 0; col < 8; col++) {
    let piv = col;
    for (let r = col + 1; r < 8; r++) if (Math.abs(A[r][col]) > Math.abs(A[piv][col])) piv = r;
    [A[col], A[piv]] = [A[piv], A[col]];
    [B[col], B[piv]] = [B[piv], B[col]];
    const d = A[col][col] || 1e-9;
    for (let c = 0; c < 8; c++) A[col][c] /= d;
    B[col] /= d;
    for (let r = 0; r < 8; r++) {
      if (r === col) continue;
      const f = A[r][col];
      for (let c = 0; c < 8; c++) A[r][c] -= f * A[col][c];
      B[r] -= f * B[col];
    }
  }
  return [B[0], B[1], B[2], B[3], B[4], B[5], B[6], B[7], 1];
}

/** Endereza y recorta `img` según las 4 esquinas, devolviendo un canvas del
 * tamaño de salida solicitado (por defecto proporción carta, 850x1100). */
export function recortarDocumento(
  img: HTMLImageElement,
  esquinas: Esquinas,
  anchoSalida = 850,
  altoSalida = 1100,
): HTMLCanvasElement {
  const origen = document.createElement('canvas');
  origen.width = img.naturalWidth;
  origen.height = img.naturalHeight;
  const ctxOrigen = origen.getContext('2d')!;
  ctxOrigen.drawImage(img, 0, 0);
  const datosOrigen = ctxOrigen.getImageData(0, 0, origen.width, origen.height);

  const salida = document.createElement('canvas');
  salida.width = anchoSalida;
  salida.height = altoSalida;
  const ctxSalida = salida.getContext('2d')!;
  const datosSalida = ctxSalida.createImageData(anchoSalida, altoSalida);

  const destino: Punto[] = [
    { x: 0, y: 0 }, { x: anchoSalida, y: 0 },
    { x: anchoSalida, y: altoSalida }, { x: 0, y: altoSalida },
  ];
  const H = resolverHomografia(destino, esquinas);

  for (let y = 0; y < altoSalida; y++) {
    for (let x = 0; x < anchoSalida; x++) {
      const denom = H[6] * x + H[7] * y + 1;
      const sx = Math.round((H[0] * x + H[1] * y + H[2]) / denom);
      const sy = Math.round((H[3] * x + H[4] * y + H[5]) / denom);
      const destIdx = (y * anchoSalida + x) * 4;
      if (sx >= 0 && sx < origen.width && sy >= 0 && sy < origen.height) {
        const srcIdx = (sy * origen.width + sx) * 4;
        datosSalida.data[destIdx] = datosOrigen.data[srcIdx];
        datosSalida.data[destIdx + 1] = datosOrigen.data[srcIdx + 1];
        datosSalida.data[destIdx + 2] = datosOrigen.data[srcIdx + 2];
        datosSalida.data[destIdx + 3] = 255;
      } else {
        datosSalida.data[destIdx + 3] = 0;
      }
    }
  }
  ctxSalida.putImageData(datosSalida, 0, 0);
  return salida;
}

export function canvasABase64(canvas: HTMLCanvasElement, calidad = 0.85): string {
  return canvas.toDataURL('image/jpeg', calidad);
}
