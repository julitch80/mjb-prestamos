// Primitivas para leer y editar un .xlsx como paquete zip, sin tocar lo que no se edita.
import { unzipSync, zipSync, strFromU8, strToU8 } from 'fflate'

export type Paquete = Record<string, Uint8Array>
export type Valor = number | string | null

export function abrirPaquete(bytes: Uint8Array): Paquete {
  return unzipSync(bytes)
}

export function cerrarPaquete(p: Paquete): Uint8Array {
  return zipSync(p)
}

export function decodificarXml(s: string): string {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&amp;/g, '&')
}

export function escaparXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function textosDe(xml: string): string {
  let out = ''
  const re = /<t(?:\s[^>]*)?>([\s\S]*?)<\/t>|<t\s*\/>/g
  let m: RegExpExecArray | null
  while ((m = re.exec(xml))) out += decodificarXml(m[1] ?? '')
  return out
}

export function leerSharedStrings(p: Paquete): string[] {
  const f = p['xl/sharedStrings.xml']
  if (!f) return []
  const xml = strFromU8(f)
  const out: string[] = []
  const re = /<si\b[^>]*?(?:\/>|>([\s\S]*?)<\/si>)/g
  let m: RegExpExecArray | null
  while ((m = re.exec(xml))) out.push(textosDe(m[1] ?? ''))
  return out
}

export interface InfoHoja {
  nombre: string
  indice: number // posición en workbook.xml (0-based), igual al orden de la lista del Máster
  ruta: string // xl/worksheets/sheetN.xml
}

export function listarHojas(p: Paquete): InfoHoja[] {
  const wb = strFromU8(p['xl/workbook.xml'])
  const rels = strFromU8(p['xl/_rels/workbook.xml.rels'])
  const dest: Record<string, string> = {}
  for (const m of rels.matchAll(/<Relationship\b([^>]*?)\/?>/g)) {
    const id = /\bId="([^"]*)"/.exec(m[1])?.[1]
    const target = /\bTarget="([^"]*)"/.exec(m[1])?.[1]
    if (id && target) dest[id] = target
  }
  const out: InfoHoja[] = []
  let i = 0
  for (const m of wb.matchAll(/<sheet\b([^>]*?)\/?>/g)) {
    const nombre = decodificarXml(/\bname="([^"]*)"/.exec(m[1])?.[1] ?? '')
    const rid = /\br:id="([^"]*)"/.exec(m[1])?.[1] ?? ''
    let t = dest[rid] ?? ''
    t = t.startsWith('/') ? t.slice(1) : 'xl/' + t
    out.push({ nombre, indice: i++, ruta: t })
  }
  return out
}

export interface CeldaLeida {
  col: string
  fila: number
  valor: Valor
}

export function colANum(c: string): number {
  let n = 0
  for (const ch of c) n = n * 26 + (ch.charCodeAt(0) - 64)
  return n
}

const RE_CELDA = /<c r="([A-Z]+)(\d+)"([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g

function valorDeCelda(attrs: string, inner: string | undefined, sst: string[]): Valor {
  if (inner === undefined) return null
  const t = /\bt="([^"]*)"/.exec(attrs)?.[1]
  if (t === 'inlineStr') return textosDe(inner)
  const v = /<v>([\s\S]*?)<\/v>/.exec(inner)?.[1]
  if (v === undefined) return null
  if (t === 's') return sst[parseInt(v, 10)] ?? ''
  if (t === 'str' || t === 'e') return decodificarXml(v)
  if (t === 'b') return v === '1' ? 1 : 0
  const n = Number(v)
  return Number.isNaN(n) ? decodificarXml(v) : n
}

/** Devuelve las filas: Map<numero de fila, Map<columna, valor>>. */
export function leerFilas(xml: string, sst: string[]): Map<number, Map<string, Valor>> {
  const filas = new Map<number, Map<string, Valor>>()
  for (const m of xml.matchAll(/<row\b([^>]*?)(?:\/>|>([\s\S]*?)<\/row>)/g)) {
    const n = Number(/\br="(\d+)"/.exec(m[1])?.[1])
    const celdas = new Map<string, Valor>()
    for (const c of (m[2] ?? '').matchAll(RE_CELDA)) {
      celdas.set(c[1], valorDeCelda(c[3], c[4], sst))
    }
    filas.set(n, celdas)
  }
  return filas
}

export interface Edicion {
  fila: number
  col: string
  valor: number | string
}

function celdaXml(col: string, fila: number, attrsViejos: string, valor: number | string): string {
  const estilo = /\bs="([^"]*)"/.exec(attrsViejos)?.[1]
  const s = estilo !== undefined ? ` s="${estilo}"` : ''
  const ref = `${col}${fila}`
  if (typeof valor === 'number') return `<c r="${ref}"${s}><v>${valor}</v></c>`
  return `<c r="${ref}"${s} t="inlineStr"><is><t xml:space="preserve">${escaparXml(valor)}</t></is></c>`
}

/** Aplica ediciones a un XML de hoja. Solo cambia las celdas indicadas. */
export function editarHojaXml(xml: string, ediciones: Edicion[]): string {
  const porFila = new Map<number, Edicion[]>()
  for (const e of ediciones) {
    if (!porFila.has(e.fila)) porFila.set(e.fila, [])
    porFila.get(e.fila)!.push(e)
  }
  let res = xml
  for (const [fila, eds] of porFila) {
    const reFila = new RegExp(String.raw`<row\b([^>]*?\br="${fila}"[^>]*?)(\/>|>([\s\S]*?)<\/row>)`)
    const m = reFila.exec(res)
    if (!m) throw new Error(`La fila ${fila} no existe en la hoja`)
    let cuerpo = m[3] ?? ''
    for (const e of eds) {
      const reC = new RegExp(String.raw`<c r="${e.col}${fila}"([^>]*?)(?:\/>|>[\s\S]*?<\/c>)`)
      const mc = reC.exec(cuerpo)
      if (mc) {
        cuerpo = cuerpo.slice(0, mc.index) + celdaXml(e.col, fila, mc[1], e.valor) + cuerpo.slice(mc.index + mc[0].length)
      } else {
        // insertar manteniendo el orden de columnas
        const nuevo = celdaXml(e.col, fila, '', e.valor)
        let pos = cuerpo.length
        for (const c of cuerpo.matchAll(RE_CELDA)) {
          if (colANum(c[1]) > colANum(e.col)) {
            pos = c.index!
            break
          }
        }
        cuerpo = cuerpo.slice(0, pos) + nuevo + cuerpo.slice(pos)
      }
    }
    const nueva = `<row${m[1]}>${cuerpo}</row>`
    res = res.slice(0, m.index) + nueva + res.slice(m.index + m[0].length)
  }
  return res
}

export function leerTextoEntrada(p: Paquete, ruta: string): string {
  const f = p[ruta]
  if (!f) throw new Error(`Falta ${ruta} en el archivo`)
  return strFromU8(f)
}

export function escribirTextoEntrada(p: Paquete, ruta: string, xml: string): void {
  p[ruta] = strToU8(xml)
}
