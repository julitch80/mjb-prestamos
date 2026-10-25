// Colores de aula, docente y rol con variante para modo claro.
//
// DECISION (por qué NO var(--...)): ~40 consumidores concatenan alfa al color
// (`${color}1a`, `${c}40`) y otros lo pasan a hojas imprimibles; con 'var(--x)'
// esas cadenas quedarian invalidas. Por eso la API sigue devolviendo HEX
// (mismo tipo string): el valor oscuro es EXACTAMENTE el de siempre y en modo
// claro el mismo campo devuelve una variante oscurecida (contraste >= 4,5).
// Se logra con un getter que mira la clase `dark` de <html> (la fija useTheme
// durante el render, antes de pintar a los hijos). Los consumidores no cambian.
// Efecto lateral: un objeto copiado con spread congela el color de ese instante.

export const esOscuro = (): boolean =>
  typeof document === 'undefined' || document.documentElement.classList.contains('dark');

const aHsl = (hex: string): [number, number, number] => {
  const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255);
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
  if (!d) return [0, 0, l];
  const s = d / (1 - Math.abs(2 * l - 1));
  const h = mx === r ? ((g - b) / d + 6) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s, l];
};
const deHsl = (h: number, s: number, l: number): string => {
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const v = l - s * Math.min(l, 1 - l) * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(v * 255).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
};
const lum = (hex: string): number => {
  const c = [1, 3, 5].map(i => {
    const v = parseInt(hex.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const contraste = (a: string, b: string): number => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

/** Oscurece conservando el tono hasta 4,5:1 sobre el peor fondo claro (elevated #eef1f6). */
export function variantClaro(hex: string): string {
  if (!/^#[0-9a-f]{6}$/i.test(hex)) return hex;
  const [h, s, l0] = aHsl(hex);
  for (let l = l0; l > 0.05; l -= 0.01) {
    const c = deHsl(h, s, l);
    if (contraste(c, '#eef1f6') >= 4.5) return c;
  }
  return hex;
}

/** Define `obj[prop]` como getter: hex oscuro original (oscuro) o variante (claro). */
export function colorPorTema<T extends object>(obj: T, prop: keyof T & string, oscuro: string, claro?: string): void {
  const c = claro ?? variantClaro(oscuro);
  Object.defineProperty(obj, prop, {
    enumerable: true,
    configurable: true,
    get: () => (esOscuro() ? oscuro : c),
    set: (v: string) => { oscuro = v; claro = undefined; },
  });
}

// Valores del informe docs/revision-visual/0-tokens-contraste.md (>= 4,5 sobre card y elevated).
export const AULA_CLARO: Record<string, string> = {
  'Aula 1': '#1d4ed8', 'Aula 2': '#047857', 'Aula 3': '#b8390a', 'Aula 4': '#6d28d9',
  'Aula 5': '#92400e', 'Aula 6': '#be185d', 'Aula 7': '#0e7490', 'Aula 8': '#b91c1c',
  'Aula 9': '#3f6212', 'Aula 10': '#854d0e', 'Sala Info.': '#475569', 'Lab. Ciencias': '#991b1b',
};
export const ROL_CLARO: Record<string, string> = {
  rectora: '#7a5f00', coordinador: '#b91c1c', docente: '#166534',
};
