// Armado (puro) de las filas del Excel de «Datos de la sede». Una pestaña por tema
// y columnas fijas: sede · tema · estado · texto · archivos · audio · datos prellenados.
import { preguntasSinResponder } from './avance';
import { formatearRef } from './archivos';
import { temasDeSede } from './temas';
import {
  HOJAS_EXCEL, type Entrada, type RespuestaTema, type SedeDatosDoc, type SedeDatosId, type Tema,
} from './tipos';

export const COLUMNAS_TEMA = ['Sede', 'Tema', 'Estado', 'Texto', 'Archivos', 'Audio', 'Datos prellenados confirmados'];
export const COLUMNAS_ARCHIVOS = ['Etiqueta', 'Nombre', 'Enlace', 'Tipo', 'Tamaño (KB)', 'Subido por', 'Fecha'];

export type EstadoExcel = 'bien' | 'corregir' | 'respondido' | 'después' | 'pendiente';

export function estadoExcel(r?: RespuestaTema): EstadoExcel {
  switch (r?.estado) {
    case 'bien': return 'bien';
    case 'corregir': return 'corregir';
    case 'respondido': return 'respondido';
    case 'despues': return 'después';
    default: return 'pendiente';
  }
}

/** Mapa ruta de Storage → URL de descarga (lo arma quien llama, con getDownloadURL). */
export type MapaUrls = Record<string, string>;

function audiosDe(e: Entrada | undefined, urls: MapaUrls): string {
  return (e?.audios ?? []).map(a => urls[a.ruta] ?? a.ruta).join('\n');
}
function refsDe(e: Entrada | undefined): string {
  return (e?.refs ?? []).map(formatearRef).join('; ');
}

function filasDeTema(sede: SedeDatosId, tema: Tema, r: RespuestaTema | undefined, urls: MapaUrls): string[][] {
  const estado = estadoExcel(r);
  const prellenado = estado === 'bien' ? tema.prellenado.map(f => `${f.etiqueta}: ${f.valor}`).join('\n') : '';
  const filas: string[][] = [[
    sede, tema.titulo, estado, r?.entrada.texto ?? '', refsDe(r?.entrada), audiosDe(r?.entrada, urls), prellenado,
  ]];
  // Una fila por pregunta contestada (asistencia, jornada de 3°3...). El estado es el del tema.
  const sin = preguntasSinResponder(tema, r);
  for (const p of tema.preguntas) {
    if (sin.includes(p.id)) continue;
    const x = r!.preguntas[p.id];
    const texto = [x.valor, x.detalle, x.entrada.texto].map(s => s.trim()).filter(Boolean).join(' · ');
    filas.push([sede, `${tema.titulo} › ${p.etiqueta}`, estado, texto, refsDe(x.entrada), audiosDe(x.entrada, urls), '']);
  }
  return filas;
}

/** Pestañas del libro: 7 temas + «Archivos». Cada una con encabezado en la primera fila. */
export function armarFilasExcel(sede: SedeDatosId, doc: SedeDatosDoc | null, urls: MapaUrls = {}): Record<string, string[][]> {
  const temas = temasDeSede(sede);
  const hojas: Record<string, string[][]> = {};
  for (const h of HOJAS_EXCEL) hojas[h] = [COLUMNAS_TEMA];
  for (const t of temas) {
    hojas[t.hoja].push(...filasDeTema(sede, t, doc?.respuestas?.[t.id], urls));
  }
  hojas['Archivos'] = [COLUMNAS_ARCHIVOS, ...(doc?.archivos ?? []).map(a => [
    a.etiqueta, a.nombre, urls[a.ruta] ?? a.ruta, a.tipo, String(Math.round(a.tamano / 1024)), a.subidoPor, a.fecha,
  ])];
  return hojas;
}

/** Rutas de Storage que hay que resolver a URL antes de armar el Excel. */
export function rutasParaEnlaces(doc: SedeDatosDoc | null): string[] {
  if (!doc) return [];
  const rutas = new Set<string>(doc.archivos.map(a => a.ruta));
  const tomar = (e?: Entrada) => (e?.audios ?? []).forEach(a => rutas.add(a.ruta));
  for (const r of Object.values(doc.respuestas ?? {})) {
    tomar(r.entrada);
    Object.values(r.preguntas ?? {}).forEach(p => tomar(p.entrada));
  }
  return [...rutas];
}
