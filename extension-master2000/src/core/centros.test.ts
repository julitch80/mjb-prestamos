import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { unzipSync } from 'fflate'
import ExcelJS from 'exceljs'
import {
  leerExcelMJB, leerHojaOptativa, calcularCambios, edicionesDe, aplicarCambiosXlsx,
  elegirHojaPorMatriculas, type HojaOptativa, type FilaPlanilla,
} from './centros'

const dir = join(__dirname, '..', '..', 'fixtures')
const pPlanilla = join(dir, 'planilla-master-p3.xlsx')
const pCentros = join(dir, 'centros-11-2.xlsx')
const hay = existsSync(pPlanilla) && existsSync(pCentros)
const d = hay ? describe : describe.skip

const u8 = (p: string) => new Uint8Array(readFileSync(p))

/** Copia de la hoja con un Val distinto en el primer estudiante digitable. */
function hojaConValorMaster(h: HojaOptativa, mjb: FilaPlanilla[]): HojaOptativa {
  const dig = mjb.find((f) => typeof f.valores.Val === 'number' && f.valores.Val > 0)!
  return {
    ...h,
    filas: h.filas.map((f) =>
      f.matricula === dig.matricula
        ? { ...f, valores: { ...f.valores, Val: (dig.valores.Val as number) === 5 ? 4 : 5 } }
        : f,
    ),
  }
}

d('cruce con archivos reales de 11.2', () => {
  const planilla = hay ? u8(pPlanilla) : new Uint8Array()
  const mjbCrudo = hay ? leerExcelMJB(u8(pCentros)) : []
  // El Excel real de hoy trae 7xx/8xx (regla vieja). Para las pruebas de cruce se normaliza a 6xx,
  // como quedará tras la corrección del módulo de centros (pedido codigos-ci-solo-600.md).
  const mjb = mjbCrudo.map((f) => ({ ...f, valores: Object.fromEntries(Object.entries(f.valores).map(([k, v]) =>
    [k, /^COD/.test(k) && typeof v === 'number' && v > 0 ? 600 + (v % 100) : v])) as typeof f.valores }))
  const hojas = hay ? leerHojaOptativa(planilla) : []
  const hoja = hojas[0]

  it('lee 33 estudiantes de MJB (ignora notas al pie) y una optativa, indice 11', () => {
    expect(mjb.length).toBe(33)
    expect(hojas.length).toBe(1)
    expect(hoja.nombre).toBe('Planilla_110200_100-opt_3')
    expect(hoja.indice).toBe(11)
    expect(hoja.grupo).toBe('110200')
    expect(elegirHojaPorMatriculas(hojas, mjb)?.nombre).toBe(hoja.nombre)
  })

  it('convierte 7xx/8xx del Excel real a 6xx: 15 a escribir y ningún código fuera de la serie 600', () => {
    if (!hay) return
    const r = calcularCambios(mjbCrudo, leerHojaOptativa(u8(pPlanilla))[0])
    expect(r.resumen.codigoInvalido).toBe(0)
    expect(r.resumen.aEscribir).toBe(15)
    const cods = edicionesDe(r).filter((e) => e.col >= 'F' && e.col <= 'O').map((e) => e.valor)
    expect(cods.length).toBeGreaterThan(0)
    expect(cods.every((v) => typeof v === 'number' && v >= 600 && v <= 699)).toBe(true)
  })

  it('candado: un código fuera de 600-899 no se sube', () => {
    if (!hay) return
    const malo = mjbCrudo.map((f, i) => i === mjbCrudo.findIndex((g) => Number(g.valores.Val) > 0) ? { ...f, valores: { ...f.valores, COD1: 950 } } : f)
    const r = calcularCambios(malo, leerHojaOptativa(u8(pPlanilla))[0])
    expect(r.resumen.codigoInvalido).toBe(1)
  })

  it('15 a escribir, 18 sin centro, 0 soloMJB, 0 soloMaster', () => {
    const r = calcularCambios(mjb, hoja)
    expect(r.resumen.aEscribir).toBe(15)
    expect(r.resumen.sinCentro).toBe(18)
    expect(r.soloMJB.length).toBe(0)
    expect(r.soloMaster.length).toBe(0)
    expect(r.ambiguas.length).toBe(0)
    expect(r.resumen.conflictos).toBe(0)
  })

  it('conflicto simulado conserva el Maestro por defecto y MJB si se elige', () => {
    const r0 = calcularCambios(mjb, hojaConValorMaster(hoja, mjb))
    expect(r0.resumen.conflictos).toBe(1)
    const e = r0.estudiantes.find((x) => x.estado === 'conflicto')!
    expect(edicionesDe(r0).filter((x) => x.fila === e.fila && x.col === 'E').length).toBe(0)
    expect(edicionesDe(r0, new Set([e.matricula])).filter((x) => x.fila === e.fila && x.col === 'E').length).toBe(1)
  })

  it('no escribe nada sobre Val 0 ni su observacion', () => {
    const r = calcularCambios(mjb, hoja)
    const sin = r.estudiantes.filter((e) => e.estado === 'no-se-digita').map((e) => e.fila)
    expect(edicionesDe(r).filter((x) => sin.includes(x.fila)).length).toBe(0)
  })

  it('aplica: demas entradas identicas, relee 15 valoraciones, exceljs abre', async () => {
    const r = calcularCambios(mjb, hoja)
    const salida = aplicarCambiosXlsx(planilla, hoja.nombre, edicionesDe(r))
    const a = unzipSync(planilla)
    const b = unzipSync(salida)
    expect(Object.keys(b).sort()).toEqual(Object.keys(a).sort())
    const cambiadas = Object.keys(a).filter((k) => Buffer.compare(Buffer.from(a[k]), Buffer.from(b[k])) !== 0)
    expect(cambiadas).toEqual(['xl/worksheets/sheet12.xml'])
    const rel = leerHojaOptativa(salida)[0]
    const r2 = calcularCambios(mjb, rel)
    expect(r2.resumen.iguales).toBe(15)
    expect(r2.resumen.aEscribir).toBe(0)
    expect(rel.filas.filter((f) => typeof f.valores.Val === 'number' && f.valores.Val > 0).length).toBe(15)
    const wb = new ExcelJS.Workbook()
    await wb.xlsx.load(Buffer.from(salida))
    expect(wb.worksheets.length).toBe(14)
    expect(wb.getWorksheet(hoja.nombre)!.rowCount).toBeGreaterThan(30)
  })
})

describe('ambiguedad (sin archivos)', () => {
  it('ceros a la izquierda se reportan y no se escriben', () => {
    const vac = { Val: null, COD1: null, COD2: null, COD3: null, COD4: null, COD5: null, COD6: null, COD7: null, COD8: null, COD9: null, COD10: null, F: null, FJ: null, Observaciones: null }
    const mk = (m: string, val: number): FilaPlanilla => ({ fila: 2, matricula: m, nombre: 'X', estado: '', valores: { ...vac, Val: val } })
    const hoja: HojaOptativa = { nombre: 'Planilla_110200_100-opt_3', indice: 0, grupo: '110200', materia: '100', periodo: '3', filas: [mk('0123', 0)] }
    const r = calcularCambios([mk('123', 4)], hoja)
    expect(r.ambiguas.length).toBe(1)
    expect(r.resumen.aEscribir).toBe(0)
  })
})
