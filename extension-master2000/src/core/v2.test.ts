import { describe, it, expect } from 'vitest'
import { calcularCambios, edicionesDe, CAMPOS, type HojaOptativa, type NombreCampo } from './centros'
import type { Valor } from './xlsx'
import {
  filasComoModelo, clasificarConSubidas, filasParaRegistrar, contenidoDeFilaMaster, type FilaApp, type ContenidoApp,
} from './v2'

const cods = (...c: number[]) => Array.from({ length: 10 }, (_, i) => c[i] ?? 0)

function filaApp(p: Partial<FilaApp> & { matricula: string }): FilaApp {
  return {
    studentId: `s-${p.matricula}`, ord: 1, nombre: `EST ${p.matricula}`, val: 3, codigos: cods(601, 602), f: 1, fj: null,
    observaciones: '', seDigita: true, motivo: '', subido: null, estadoApp: 'sin_subir', ...p,
  }
}
const subido = (c: Partial<ContenidoApp> = {}) => ({ val: 3, codigos: cods(601, 602), f: 1, fj: null, observaciones: '', subidoEn: 1, ...c })

function valoresMaster(c: Partial<ContenidoApp> | null): Record<NombreCampo, Valor> {
  const v = {} as Record<NombreCampo, Valor>
  for (const k of CAMPOS) v[k.nombre] = null
  if (!c) return v
  const full = { val: 3, codigos: cods(601, 602), f: 1, fj: null, observaciones: '', ...c }
  v.Val = full.val || null
  full.codigos.forEach((x, i) => { v[`COD${i + 1}` as NombreCampo] = x || null })
  v.F = full.f; v.FJ = full.fj; v.Observaciones = full.observaciones || null
  return v
}
const hojaCon = (m: Record<string, Partial<ContenidoApp> | null>): HojaOptativa => ({
  nombre: 'Planilla_110200_100-opt_3', indice: 11, grupo: '110200', materia: '100', periodo: '3',
  filas: Object.entries(m).map(([mat, c], i) => ({ fila: i + 2, matricula: mat, nombre: `EST ${mat}`, estado: '', valores: valoresMaster(c) })),
})
const cruzar = (app: FilaApp[], hoja: HojaOptativa, ignorar = false) =>
  clasificarConSubidas(calcularCambios(filasComoModelo(app), hoja), hoja, app, ignorar)
const estado = (r: ReturnType<typeof cruzar>, m: string) => r.estudiantes.find((e) => e.matricula === m)!.estado

describe('filasComoModelo (callable -> modelo de leerExcelMJB)', () => {
  it('mapea val, códigos, faltas y observaciones; 0 = vacío; omite sin matrícula; el motivo interno nunca va', () => {
    const m = filasComoModelo([
      filaApp({ matricula: '100', val: 4, codigos: cods(601, 0, 603), f: 2, fj: 0, observaciones: 'ok' }),
      filaApp({ matricula: '', nombre: 'SIN' }),
      filaApp({ matricula: '200', seDigita: false, val: 0, codigos: cods(), motivo: 'sin centro' }),
    ])
    expect(m.map((x) => x.matricula)).toEqual(['100', '200'])
    expect(m[0].valores).toMatchObject({ Val: 4, COD1: 601, COD2: null, COD3: 603, COD4: null, F: 2, FJ: 0, Observaciones: 'ok' })
    expect(m[1].valores.Val).toBeNull()
    expect(m[1].valores.Observaciones).toBeNull()
  })
})

describe('clasificación frente a la última subida', () => {
  it('sin subida previa: como V1 (nuevo / igual)', () => {
    const r = cruzar([filaApp({ matricula: '1' }), filaApp({ matricula: '2' })], hojaCon({ '1': null, '2': {} }))
    expect(estado(r, '1')).toBe('nuevo')
    expect(estado(r, '2')).toBe('igual')
  })

  it('actualizado en la app: M == s y la app cambió -> se escribe por defecto', () => {
    const app = [filaApp({ matricula: '1', val: 4, codigos: cods(601, 603), subido: subido(), estadoApp: 'cambio_en_app' })]
    const r = cruzar(app, hojaCon({ '1': {} }))
    expect(estado(r, '1')).toBe('actualizado-app')
    expect(r.resumen.actualizadosApp).toBe(1)
    expect(r.resumen.conflictos).toBe(0)
    expect(edicionesDe(r).map((e) => [e.col, e.valor])).toEqual([['E', 4], ['G', 603]])
  })

  it('distinto: M != s -> conflicto, no se pisa por defecto; con visto bueno sí', () => {
    const app = [filaApp({ matricula: '1', val: 4, subido: subido(), estadoApp: 'cambio_en_app' })]
    const r = cruzar(app, hojaCon({ '1': { val: 2 } }))
    expect(estado(r, '1')).toBe('conflicto')
    expect(edicionesDe(r)).toEqual([])
    expect(edicionesDe(r, new Set(['1'])).map((e) => [e.col, e.valor])).toEqual([['E', 4]])
  })

  it('distinto también si la app no cambió pero el Máster sí (borraron una casilla)', () => {
    const app = [filaApp({ matricula: '1', subido: subido(), estadoApp: 'igual' })]
    const r = cruzar(app, hojaCon({ '1': { codigos: cods(601) } }))
    expect(estado(r, '1')).toBe('conflicto')
    expect(edicionesDe(r)).toEqual([])
  })

  it('M != s pero M ya coincide con la app: igual', () => {
    const app = [filaApp({ matricula: '1', val: 4, subido: subido(), estadoApp: 'cambio_en_app' })]
    expect(estado(cruzar(app, hojaCon({ '1': { val: 4 } })), '1')).toBe('igual')
  })

  it('subida de otro periodo se ignora (todo como V1)', () => {
    const app = [filaApp({ matricula: '1', val: 4, subido: subido(), estadoApp: 'cambio_en_app' })]
    expect(estado(cruzar(app, hojaCon({ '1': null }), true), '1')).toBe('nuevo')
  })

  it('f=0 en la app y casilla vacía en el Máster cuentan como lo mismo', () => {
    expect(contenidoDeFilaMaster(valoresMaster({ f: null })).f).toBeNull()
    const app = [filaApp({ matricula: '1', f: 0, subido: subido({ f: 0 }), estadoApp: 'igual' })]
    expect(estado(cruzar(app, hojaCon({ '1': { f: null } })), '1')).toBe('igual')
  })
})

describe('qué filas se mandan a ciRegistrarSubida', () => {
  const app = [
    filaApp({ matricula: '1' }),
    filaApp({ matricula: '2' }),
    filaApp({ matricula: '3', val: 4, subido: subido(), estadoApp: 'cambio_en_app' }),
    filaApp({ matricula: '4', val: 4, subido: subido(), estadoApp: 'cambio_en_app' }),
    filaApp({ matricula: '5', seDigita: false, val: 0, codigos: cods() }),
  ]
  const hoja = hojaCon({ '1': null, '2': {}, '3': {}, '4': { val: 2 }, '5': null })
  const r = cruzar(app, hoja)

  it('subidas e «igual»; nunca «distinto» conservado ni los que no se digitan', () => {
    expect(r.estudiantes.map((e) => [e.matricula, e.estado])).toEqual([
      ['1', 'nuevo'], ['2', 'igual'], ['3', 'actualizado-app'], ['4', 'conflicto'], ['5', 'no-se-digita'],
    ])
    const f = filasParaRegistrar(r, app)
    expect(f.map((x) => x.matricula)).toEqual(['1', '2', '3'])
    expect(f[2]).toEqual({ matricula: '3', val: 4, codigos: cods(601, 602), f: 1, fj: null, observaciones: '' })
  })

  it('un «distinto» donde el director eligió usar MJB sí se informa', () => {
    expect(filasParaRegistrar(r, app, new Set(['4'])).map((x) => x.matricula)).toEqual(['1', '2', '3', '4'])
  })

  it('no informa lo que, tras escribir, sigue distinto de la app (el Máster tiene algo extra)', () => {
    const a2 = [filaApp({ matricula: '1', codigos: cods(601) })]
    const r2 = cruzar(a2, hojaCon({ '1': { codigos: cods(601, 650) } }))
    expect(filasParaRegistrar(r2, a2)).toEqual([])
  })
})
