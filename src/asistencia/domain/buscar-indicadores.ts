/**
 * Buscar indicadores de los centros de interes por TEMA, no por la palabra literal
 * (Julian, 2026-11-09). Logica pura: la pantalla solo pinta lo que sale de aqui.
 *
 * Como decide:
 *  1. Se normaliza lo escrito: sin tildes, sin mayusculas, y cada palabra por su RAIZ (las
 *     cinco primeras letras), para que «emoción», «emociones» y «emocional» sean lo mismo.
 *  2. Se buscan los TEMAS cuyas expresiones aparecen en lo escrito («inteligencia
 *     artificial» -> tecnologia). Una expresion de varias palabras cuenta solo si estan
 *     todas, en cualquier orden.
 *  3. Puntaje de cada indicador: tema directo 10, tema cercano 3, y 4 por cada palabra de
 *     la busqueda que aparezca en su texto. Asi siempre sale algo util, y lo de arriba es
 *     lo mas parecido.
 *
 * Un numero de tres digitos busca ese codigo, sea 6xx, 7xx u 8xx.
 */
import { INDICADORES_CI, type IndicadorCI } from './indicadores-ci';
import { TEMAS, TEMAS_DE_INDICADOR, type Tema } from './temas-ci';

const VACIAS = new Set([
  'de', 'la', 'el', 'los', 'las', 'en', 'y', 'o', 'a', 'con', 'para', 'por', 'del', 'un',
  'una', 'que', 'su', 'sus', 'se', 'al', 'como', 'mi', 'me', 'lo', 'le', 'es', 'sobre',
]);

export function normalizar(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9ñ]+/g, ' ')
    .trim();
}

/** Las raices de un texto, sin palabras vacias. */
export function raices(s: string): string[] {
  return normalizar(s)
    .split(' ')
    .filter((w) => w.length >= 2 && !VACIAS.has(w))
    .map((w) => w.slice(0, 5));
}

const RAICES_DE_TEXTO = new Map(INDICADORES_CI.map((i) => [i.codigo, new Set(raices(i.texto))]));
const RAICES_DE_EXPRESION = Object.fromEntries(
  (Object.keys(TEMAS) as Tema[]).map((t) => [t, TEMAS[t].expresiones.map(raices).filter((r) => r.length > 0)]),
) as Record<Tema, string[][]>;

/** Los temas que nombra lo escrito. */
export function temasDeBusqueda(busqueda: string): Tema[] {
  const enBusqueda = new Set(raices(busqueda));
  return (Object.keys(TEMAS) as Tema[]).filter((t) =>
    RAICES_DE_EXPRESION[t].some((expresion) => expresion.every((r) => enBusqueda.has(r))),
  );
}

export interface ResultadoBusqueda {
  indicador: IndicadorCI;
  puntaje: number;
  /** 'directo': coincide en un tema o en el texto. 'cercano': solo por un tema vecino. */
  tipo: 'directo' | 'cercano';
}

export function buscarIndicadores(busqueda: string): ResultadoBusqueda[] {
  const q = busqueda.trim();
  if (!q) return INDICADORES_CI.map((indicador) => ({ indicador, puntaje: 0, tipo: 'directo' as const }));

  // Un codigo: 612, 712 u 812 son el mismo indicador.
  if (/^\d{3}$/.test(q)) {
    const base = 600 + (Number(q) % 100);
    return INDICADORES_CI.filter((i) => i.codigo === base).map((indicador) => ({ indicador, puntaje: 100, tipo: 'directo' as const }));
  }

  const directos = new Set(temasDeBusqueda(q));
  const cercanos = new Set([...directos].flatMap((t) => TEMAS[t].cercanos).filter((t) => !directos.has(t)));
  const palabras = [...new Set(raices(q))];

  const resultados: ResultadoBusqueda[] = [];
  for (const indicador of INDICADORES_CI) {
    const temas = TEMAS_DE_INDICADOR[indicador.codigo] ?? [];
    const enTema = temas.filter((t) => directos.has(t)).length;
    const enCercano = temas.filter((t) => cercanos.has(t)).length;
    const texto = RAICES_DE_TEXTO.get(indicador.codigo)!;
    const enTexto = palabras.filter((p) => texto.has(p)).length;
    // La palabra literal pesa mas que un tema cercano: si el docente escribe «yoga», el
    // indicador que dice yoga va antes que los de cuerpo en general.
    const puntaje = enTema * 10 + enCercano * 3 + enTexto * 4;
    if (puntaje === 0) continue;
    resultados.push({ indicador, puntaje, tipo: enTema > 0 || enTexto > 0 ? 'directo' : 'cercano' });
  }
  return resultados.sort((a, b) => b.puntaje - a.puntaje || a.indicador.codigo - b.indicador.codigo);
}
