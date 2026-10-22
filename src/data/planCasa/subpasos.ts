// Parte las instrucciones de un paso en sub-pasos numerados para mostrarlas una por
// renglón (ajuste «instrucciones de un paso a la vez»). Acepta renglones separados,
// «1.», «1)» o «Paso 1.» dentro del texto. Si no encuentra marcas, devuelve el texto
// entero como un solo sub-paso.
export function subpasos(texto: string): string[] {
  const t = (texto ?? '').trim();
  if (!t) return [];
  const porRenglon = t.split(/\r?\n+/).map(s => s.trim()).filter(Boolean);
  const partes = porRenglon.length > 1
    ? porRenglon
    : /Paso\s+\d+\s*[.:)]/i.test(t)
      ? t.split(/(?=Paso\s+\d+\s*[.:)])/i).map(s => s.trim()).filter(Boolean)
      : t.split(/(?=(?:^|\s)\d+\s*[.)]\s)/).map(s => s.trim()).filter(Boolean);
  return partes.map(s => s.replace(/^(?:Paso\s+\d+\s*[.:)]|\d+\s*[.)])\s*/i, '').trim()).filter(Boolean);
}
