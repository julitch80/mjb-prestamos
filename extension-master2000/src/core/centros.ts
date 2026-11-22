// Lectura, cruce por matricula y escritura de la hoja optativa. Sin DOM ni red.
import {
  abrirPaquete, cerrarPaquete, leerSharedStrings, listarHojas, leerFilas,
  leerTextoEntrada, escribirTextoEntrada, editarHojaXml,
  type Edicion, type Valor,
} from './xlsx'

/** Campos que se llevan al Maestro, con su columna en la planilla (identica en MJB y Maestro). */
export const CAMPOS = [
  { nombre: 'Val', col: 'E' },
  { nombre: 'COD1', col: 'F' }, { nombre: 'COD2', col: 'G' }, { nombre: 'COD3', col: 'H' },
  { nombre: 'COD4', col: 'I' }, { nombre: 'COD5', col: 'J' }, { nombre: 'COD6', col: 'K' },
  { nombre: 'COD7', col: 'L' }, { nombre: 'COD8', col: 'M' }, { nombre: 'COD9', col: 'N' },
  { nombre: 'COD10', col: 'O' },
  { nombre: 'F', col: 'P' }, { nombre: 'FJ', col: 'Q' },
  { nombre: 'Observaciones', col: 'R' },
] as const

export type NombreCampo = (typeof CAMPOS)[number]['nombre']

export interface FilaPlanilla {
  fila: number // numero de fila en la hoja
  matricula: string // trim
  nombre: string
  estado: string
  valores: Record<NombreCampo, Valor>
}

export interface HojaOptativa {
  nombre: string
  indice: number
  grupo: string // 6 digitos
  materia: string
  periodo: string
  filas: FilaPlanilla[]
}

const norm = (v: Valor | undefined) => (v === null || v === undefined ? '' : String(v).trim())

/** Normaliza un valor a numero, texto o null (vacio, "" o 0 = null). */
export function normalizarValor(v: Valor | undefined): number | string | null {
  if (v === null || v === undefined) return null
  if (typeof v === 'number') return v === 0 ? null : v
  const t = v.trim()
  if (t === '') return null
  if (/^-?\d+([.,]\d+)?$/.test(t)) {
    const n = Number(t.replace(',', '.'))
    return n === 0 ? null : n
  }
  return t
}

function leerTabla(xml: string, sst: string[]): FilaPlanilla[] | null {
  const filas = leerFilas(xml, sst)
  const cab = filas.get(1)
  if (!cab) return null
  const porNombre = new Map<string, string>()
  for (const [col, v] of cab) porNombre.set(norm(v).toLowerCase(), col)
  const colMat = porNombre.get('matricula') ?? porNombre.get('matrícula')
  if (!colMat) return null
  const colNom = porNombre.get('nombre estudiante') ?? 'C'
  const colEst = porNombre.get('estado') ?? 'A'
  const cols = CAMPOS.map((c) => [c.nombre, porNombre.get(c.nombre.toLowerCase()) ?? c.col] as const)
  const out: FilaPlanilla[] = []
  const nums = [...filas.keys()].filter((n) => n > 1).sort((a, b) => a - b)
  for (const n of nums) {
    const f = filas.get(n)!
    const matricula = norm(f.get(colMat))
    if (!matricula) continue // filas de notas al pie, etc.
    const valores = {} as Record<NombreCampo, Valor>
    for (const [nombre, col] of cols) valores[nombre] = f.get(col) ?? null
    out.push({ fila: n, matricula, nombre: norm(f.get(colNom)), estado: norm(f.get(colEst)), valores })
  }
  return out
}

/** Excel exportado por MJB: primera hoja con la cabecera de la planilla. */
export function leerExcelMJB(bytes: Uint8Array): FilaPlanilla[] {
  const p = abrirPaquete(bytes)
  const sst = leerSharedStrings(p)
  for (const h of listarHojas(p)) {
    const t = leerTabla(leerTextoEntrada(p, h.ruta), sst)
    if (t) return t
  }
  throw new Error('El Excel de MJB no tiene la cabecera esperada (Estado, Matricula, Nombre estudiante...).')
}

const RE_NOMBRE_HOJA = /^Planilla_(\d{6})_([^-_]+)-([^_]+)_(\d+)$/

/** Hojas optativas (abrev "opt") de la planilla del Maestro. */
export function leerHojaOptativa(bytes: Uint8Array): HojaOptativa[] {
  const p = abrirPaquete(bytes)
  const sst = leerSharedStrings(p)
  const out: HojaOptativa[] = []
  for (const h of listarHojas(p)) {
    const m = RE_NOMBRE_HOJA.exec(h.nombre)
    if (!m || m[3].toLowerCase() !== 'opt') continue
    const filas = leerTabla(leerTextoEntrada(p, h.ruta), sst)
    if (!filas) continue
    out.push({ nombre: h.nombre, indice: h.indice, grupo: m[1], materia: m[2], periodo: m[4], filas })
  }
  return out
}

/** De varias hojas optativas, la que mas matriculas comparte con el Excel de MJB. */
export function elegirHojaPorMatriculas(hojas: HojaOptativa[], mjb: FilaPlanilla[]): HojaOptativa | null {
  const set = new Set(mjb.map((f) => f.matricula))
  let mejor: HojaOptativa | null = null
  let max = 0
  for (const h of hojas) {
    const c = h.filas.filter((f) => set.has(f.matricula)).length
    if (c > max) { max = c; mejor = h }
  }
  return mejor
}

// ---------------------------------------------------------------- cruce

export type AccionCelda = 'escribir' | 'igual' | 'conflicto' | 'nada'
/** `actualizado-app` (V2): el Máster tiene lo que se subió antes y la app cambió después. */
export type EstadoEstudiante = 'nuevo' | 'igual' | 'conflicto' | 'sin-dato' | 'no-se-digita' | 'codigo-invalido' | 'actualizado-app'

/** El Máster solo acepta en la optativa códigos de la serie 600 (Julián, 2026-11-14). 0 = vacío. */
/**
 * Las valoraciones ya hechas pueden traer 7xx (Alto) u 8xx (Superior): mismo indicador, se lleva
 * como 6xx sin que nadie re-valore (Julián, 2026-11-14). Otros valores se dejan igual (y el candado los frena).
 */
export const aCodigo600 = (v: number | string | null) =>
  typeof v === 'number' && v >= 700 && v <= 899 ? 600 + (v % 100) : v

export const codigoValido = (v: number | string | null) => v === null || (typeof v === 'number' && v >= 600 && v <= 699)

export interface CeldaCruce {
  campo: NombreCampo
  col: string
  master: number | string | null
  mjb: number | string | null
  accion: AccionCelda
}

export interface EstudianteCruce {
  matricula: string
  nombre: string
  fila: number // fila en la hoja del Maestro
  digitable: boolean
  estado: EstadoEstudiante
  celdas: CeldaCruce[]
}

export interface ResultadoCruce {
  estudiantes: EstudianteCruce[]
  soloMaster: { matricula: string; nombre: string }[]
  soloMJB: { matricula: string; nombre: string }[]
  /** Matriculas que solo coinciden quitando ceros a la izquierda, o repetidas: no se escriben. */
  ambiguas: { matricula: string; nombre: string; motivo: string }[]
  resumen: Resumen
}

export interface Resumen {
  aEscribir: number; sinCentro: number; iguales: number; conflictos: number; sinDato: number
  codigoInvalido: number; celdasAEscribir: number; actualizadosApp: number
}

export function resumir(estudiantes: EstudianteCruce[]): Resumen {
  return {
    aEscribir: estudiantes.filter((e) => e.estado === 'nuevo' || e.estado === 'conflicto' || e.estado === 'actualizado-app').length,
    sinCentro: estudiantes.filter((e) => e.estado === 'no-se-digita').length,
    iguales: estudiantes.filter((e) => e.estado === 'igual').length,
    conflictos: estudiantes.filter((e) => e.estado === 'conflicto').length,
    sinDato: estudiantes.filter((e) => e.estado === 'sin-dato').length,
    codigoInvalido: estudiantes.filter((e) => e.estado === 'codigo-invalido').length,
    celdasAEscribir: estudiantes.reduce((n, e) => n + e.celdas.filter((c) => c.accion === 'escribir').length, 0),
    actualizadosApp: estudiantes.filter((e) => e.estado === 'actualizado-app').length,
  }
}

export const igualCelda = (a: number | string | null, b: number | string | null) => igualValor(a, b)

const quitaCeros = (s: string) => s.replace(/^0+(?=\d)/, '')

function igualValor(a: number | string | null, b: number | string | null): boolean {
  if (typeof a === 'number' && typeof b === 'number') return a === b
  return String(a).trim() === String(b).trim()
}

export function calcularCambios(mjb: FilaPlanilla[], hoja: HojaOptativa): ResultadoCruce {
  const ambiguas: ResultadoCruce['ambiguas'] = []
  const contar = (fs: FilaPlanilla[]) => {
    const c = new Map<string, number>()
    for (const f of fs) c.set(f.matricula, (c.get(f.matricula) ?? 0) + 1)
    return c
  }
  const repMjb = contar(mjb)
  const repMaster = contar(hoja.filas)
  const mjbPor = new Map<string, FilaPlanilla>()
  for (const f of mjb) {
    if ((repMjb.get(f.matricula) ?? 0) > 1 && !mjbPor.has(f.matricula)) {
      ambiguas.push({ matricula: f.matricula, nombre: f.nombre, motivo: 'matricula repetida en MJB' })
    }
    mjbPor.set(f.matricula, f)
  }
  const masterSet = new Set(hoja.filas.map((f) => f.matricula))
  const mjbSet = new Set(mjb.map((f) => f.matricula))
  const ceros = new Map<string, string>() // matricula sin ceros -> matricula original en el Maestro
  for (const f of hoja.filas) ceros.set(quitaCeros(f.matricula), f.matricula)

  const estudiantes: EstudianteCruce[] = []
  const soloMaster: ResultadoCruce['soloMaster'] = []
  const repetidasEnMaster = new Set<string>()
  for (const f of hoja.filas) {
    if ((repMaster.get(f.matricula) ?? 0) > 1) {
      if (!repetidasEnMaster.has(f.matricula)) {
        ambiguas.push({ matricula: f.matricula, nombre: f.nombre, motivo: 'matricula repetida en el Maestro' })
        repetidasEnMaster.add(f.matricula)
      }
      continue
    }
    const o = mjbPor.get(f.matricula)
    if (!o) {
      soloMaster.push({ matricula: f.matricula, nombre: f.nombre })
      continue
    }
    if ((repMjb.get(f.matricula) ?? 0) > 1) continue
    const val = normalizarValor(o.valores.Val)
    const mjbValor = (n: NombreCampo) => {
      const v = normalizarValor(o.valores[n])
      return /^COD/.test(n) ? aCodigo600(v) : v
    }
    const invalidos = CAMPOS.filter((c) => /^COD/.test(c.nombre)).map((c) => mjbValor(c.nombre)).filter((v) => !codigoValido(v))
    const digitable = typeof val === 'number' && val > 0 && invalidos.length === 0
    const celdas: CeldaCruce[] = CAMPOS.map((c) => {
      const m = normalizarValor(f.valores[c.nombre])
      const x = mjbValor(c.nombre)
      let accion: AccionCelda = 'nada'
      if (digitable && x !== null) {
        if (m === null) accion = 'escribir'
        else if (igualValor(m, x)) accion = 'igual'
        else accion = 'conflicto'
      }
      return { campo: c.nombre, col: c.col, master: m, mjb: x, accion }
    })
    let estado: EstadoEstudiante
    if (invalidos.length) estado = 'codigo-invalido'
    else if (!digitable) estado = 'no-se-digita'
    else if (celdas.some((c) => c.accion === 'conflicto')) estado = 'conflicto'
    else if (celdas.some((c) => c.accion === 'escribir')) estado = 'nuevo'
    else if (celdas.some((c) => c.accion === 'igual')) estado = 'igual'
    else estado = 'sin-dato'
    estudiantes.push({ matricula: f.matricula, nombre: f.nombre, fila: f.fila, digitable, estado, celdas })
  }
  const soloMJB: ResultadoCruce['soloMJB'] = []
  for (const f of mjb) {
    if (masterSet.has(f.matricula)) continue
    const alt = ceros.get(quitaCeros(f.matricula))
    if (alt !== undefined && !mjbSet.has(alt)) {
      ambiguas.push({ matricula: f.matricula, nombre: f.nombre, motivo: `solo coincide con ${alt} quitando ceros a la izquierda` })
      continue
    }
    soloMJB.push({ matricula: f.matricula, nombre: f.nombre })
  }
  const resumen = resumir(estudiantes)
  return { estudiantes, soloMaster, soloMJB, ambiguas, resumen }
}

/**
 * Ediciones a aplicar. Por defecto: celdas 'escribir'. Los conflictos conservan el Maestro,
 * salvo las matriculas de `usarMJB`, donde se escribe el valor de MJB.
 */
export function edicionesDe(r: ResultadoCruce, usarMJB: Set<string> = new Set()): Edicion[] {
  const out: Edicion[] = []
  for (const e of r.estudiantes) {
    for (const c of e.celdas) {
      const escribe = c.accion === 'escribir' || (c.accion === 'conflicto' && usarMJB.has(e.matricula))
      if (escribe && c.mjb !== null) out.push({ fila: e.fila, col: c.col, valor: c.mjb })
    }
  }
  return out
}

/** Escribe las ediciones solo en la hoja indicada; todas las demas entradas del zip quedan intactas. */
export function aplicarCambiosXlsx(bytes: Uint8Array, nombreHoja: string, ediciones: Edicion[]): Uint8Array {
  const p = abrirPaquete(bytes)
  const h = listarHojas(p).find((x) => x.nombre === nombreHoja)
  if (!h) throw new Error(`No existe la hoja ${nombreHoja}`)
  const xml = leerTextoEntrada(p, h.ruta)
  escribirTextoEntrada(p, h.ruta, editarHojaXml(xml, ediciones))
  return cerrarPaquete(p)
}
