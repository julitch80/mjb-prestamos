// Lógica pura para mostrar la descripción de una tarea sin HTML crudo:
// parte el texto en trozos de texto y enlaces http(s) (React los pinta como nodos).

export type TrozoTexto = { tipo: 'texto'; valor: string } | { tipo: 'enlace'; valor: string; href: string };

const RE_URL = /https?:\/\/[^\s<>"']+/gi;

/** Solo http/https; evita javascript:, data:, etc. */
export function esUrlSegura(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === 'https:' || u.protocol === 'http:';
  } catch {
    return false;
  }
}

export function partirEnlaces(texto: string): TrozoTexto[] {
  const out: TrozoTexto[] = [];
  let ultimo = 0;
  for (const m of texto.matchAll(RE_URL)) {
    const inicio = m.index ?? 0;
    // La puntuación final no forma parte del enlace.
    const crudo = m[0];
    const limpio = crudo.replace(/[.,;:!?)\]]+$/, '');
    if (inicio > ultimo) out.push({ tipo: 'texto', valor: texto.slice(ultimo, inicio) });
    if (esUrlSegura(limpio)) out.push({ tipo: 'enlace', valor: limpio, href: limpio });
    else out.push({ tipo: 'texto', valor: limpio });
    const resto = crudo.slice(limpio.length);
    if (resto) out.push({ tipo: 'texto', valor: resto });
    ultimo = inicio + crudo.length;
  }
  if (ultimo < texto.length) out.push({ tipo: 'texto', valor: texto.slice(ultimo) });
  return out;
}
