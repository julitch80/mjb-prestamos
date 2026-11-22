// V2: datos que entrega la app (callable ciParaMaster) -> mismo modelo que leerExcelMJB, clasificación
// frente a la última subida y filas que se le informan a la app (ciRegistrarSubida). Sin DOM ni red.
import {
  CAMPOS, normalizarValor, resumir, igualCelda,
  type FilaPlanilla, type HojaOptativa, type ResultadoCruce, type EstudianteCruce, type NombreCampo,
} from './centros'
import type { Valor } from './xlsx'

/** Lo que se escribe (o se escribió) en el Máster para un estudiante. */
export interface ContenidoApp {
  val: number
  codigos: number[]
  f: number | null
  fj: number | null
  observaciones: string
}

export interface FilaApp extends ContenidoApp {
  studentId: string
  ord: number
  matricula: string
  nombre: string
  seDigita: boolean
  motivo: string
  subido: (ContenidoApp & { subidoEn: number }) | null
  estadoApp: 'sin_subir' | 'igual' | 'cambio_en_app'
}

export interface RespuestaApp {
  grado: string
  sede: string
  periodo: number | null
  codigoGrupoMaster: string | null
  programa: { programaId: string; nombre: string }
  filas: FilaApp[]
  resumen: { total: number; seDigitan: number; sinMatricula: number; pendientes: number }
  pendientes: { studentId: string; nombre: string; tipo: string }[]
  ultimaSubida: { en: number; por: string; periodo: number | null } | null
}

export interface FilaRegistro {
  matricula: string
  val: number
  codigos: number[]
  f: number | null
  fj: number | null
  observaciones: string
}

const NOMBRES_COD = CAMPOS.filter((c) => /^COD/.test(c.nombre)).map((c) => c.nombre)

/**
 * Filas de la app -> el modelo que produce `leerExcelMJB`. Las filas sin matrícula no se emparejan
 * (se omiten); los que no se digitan llevan Val vacío, como en el Excel.
 */
export function filasComoModelo(filas: FilaApp[]): FilaPlanilla[] {
  const out: FilaPlanilla[] = []
  for (const f of filas) {
    if (!f.matricula) continue
    const valores = {} as Record<NombreCampo, Valor>
    valores.Val = f.seDigita ? f.val : null
    NOMBRES_COD.forEach((n, i) => { valores[n as NombreCampo] = f.seDigita && f.codigos[i] ? f.codigos[i] : null })
    valores.F = f.seDigita ? f.f : null
    valores.FJ = f.seDigita ? f.fj : null
    valores.Observaciones = f.seDigita && f.observaciones ? f.observaciones : null
    out.push({ fila: f.ord, matricula: f.matricula.trim(), nombre: f.nombre, estado: '', valores })
  }
  return out
}

// ------------------------------------------------------------ contenido comparable

/** En la planilla del Máster vacío y 0 son lo mismo: se compara en ese dominio. */
const nf = (v: number | null | undefined) => (v ? v : null)
const txt = (s: string) => s.trim().replace(/\s+/g, ' ')

export function mismoContenido(a: ContenidoApp, b: ContenidoApp): boolean {
  const cods = (c: number[]) => Array.from({ length: 10 }, (_, k) => c[k] || 0).join(',')
  return a.val === b.val && cods(a.codigos) === cods(b.codigos) && nf(a.f) === nf(b.f) && nf(a.fj) === nf(b.fj) && txt(a.observaciones) === txt(b.observaciones)
}

const num = (v: Valor | undefined): number => {
  const n = normalizarValor(v)
  return typeof n === 'number' ? n : 0
}

/** Lo que tiene hoy el Máster en la fila de un estudiante, como contenido comparable. */
export function contenidoDeFilaMaster(valores: Record<NombreCampo, Valor>): ContenidoApp {
  const f = normalizarValor(valores.F)
  const fj = normalizarValor(valores.FJ)
  const obs = normalizarValor(valores.Observaciones)
  return {
    val: num(valores.Val),
    codigos: NOMBRES_COD.map((n) => num(valores[n as NombreCampo])),
    f: typeof f === 'number' ? f : null,
    fj: typeof fj === 'number' ? fj : null,
    observaciones: obs === null ? '' : String(obs),
  }
}

// ------------------------------------------------------------ clasificación frente a la última subida

/**
 * Con M = lo que hay hoy en el Máster y s = lo que la extensión subió la vez anterior:
 *  - s y M == s y la app cambió           -> `actualizado-app` (se sube por defecto);
 *  - s y M != s y la app tiene algo que cambiaría M -> `conflicto` («distinto»): se conserva M
 *    por defecto y el director decide;
 *  - lo demás queda como lo dejó `calcularCambios` (V1).
 * `ignorarSubidas`: la subida registrada es de otro periodo; no sirve de referencia.
 */
export function clasificarConSubidas(
  cruce: ResultadoCruce,
  hoja: HojaOptativa,
  app: FilaApp[],
  ignorarSubidas = false,
): ResultadoCruce {
  if (ignorarSubidas) return cruce
  const porMat = new Map(app.filter((f) => f.matricula).map((f) => [f.matricula.trim(), f]))
  const filaMaster = new Map(hoja.filas.map((f) => [f.fila, f]))
  const estudiantes: EstudianteCruce[] = cruce.estudiantes.map((est) => {
    const fa = porMat.get(est.matricula)
    const s = fa?.subido
    const fm = filaMaster.get(est.fila)
    if (!fa || !s || !fm || !est.digitable) return est
    const M = contenidoDeFilaMaster(fm.valores)
    if (mismoContenido(M, s)) {
      if (fa.estadoApp !== 'cambio_en_app') return est
      const celdas = est.celdas.map((c) => ({
        ...c,
        accion: c.mjb === null ? ('nada' as const) : igualCelda(c.master, c.mjb) ? ('igual' as const) : ('escribir' as const),
      }))
      if (!celdas.some((c) => c.accion === 'escribir')) return { ...est, celdas }
      return { ...est, celdas, estado: 'actualizado-app' }
    }
    // Alguien cambió el Máster a mano desde la última subida.
    if (!est.celdas.some((c) => c.accion === 'escribir' || c.accion === 'conflicto')) return est
    const celdas = est.celdas.map((c) => (c.accion === 'escribir' ? { ...c, accion: 'conflicto' as const } : c))
    return { ...est, celdas, estado: 'conflicto' }
  })
  return { ...cruce, estudiantes, resumen: resumir(estudiantes) }
}

// ------------------------------------------------------------ qué se le informa a la app

/**
 * Filas que quedaron en el Máster con lo que la extensión escribió (subidas e «igual»), para
 * `ciRegistrarSubida`. Nunca las «distinto» donde se conservó el Máster, ni las que no se digitan,
 * ni las que tras escribir siguen difiriendo de la app (p. ej. el Máster tiene algo extra).
 */
export function filasParaRegistrar(cruce: ResultadoCruce, app: FilaApp[], usarMJB: Set<string> = new Set()): FilaRegistro[] {
  const porMat = new Map(app.filter((f) => f.matricula).map((f) => [f.matricula.trim(), f]))
  const out: FilaRegistro[] = []
  for (const est of cruce.estudiantes) {
    const fa = porMat.get(est.matricula)
    if (!fa || !fa.seDigita || !est.digitable) continue
    const entra =
      est.estado === 'nuevo' || est.estado === 'actualizado-app' || est.estado === 'igual' ||
      (est.estado === 'conflicto' && usarMJB.has(est.matricula))
    if (!entra) continue
    // Lo que quedó en el Máster después de escribir.
    const quedo = {} as Record<NombreCampo, Valor>
    for (const c of est.celdas) {
      const escribe = c.accion === 'escribir' || (c.accion === 'conflicto' && usarMJB.has(est.matricula))
      quedo[c.campo] = escribe ? c.mjb : c.master
    }
    if (!mismoContenido(contenidoDeFilaMaster(quedo), fa)) continue
    out.push({ matricula: est.matricula, val: fa.val, codigos: fa.codigos, f: fa.f, fj: fa.fj, observaciones: fa.observaciones })
  }
  return out
}
