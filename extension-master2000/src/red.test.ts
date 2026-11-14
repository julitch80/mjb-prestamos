import { describe, it, expect } from 'vitest'
import { subirHoja, MSG_SESION, URL_SUBIDA } from './red'

const HOJAS = [
  'Planilla_100100_001-cne_3', 'Planilla_100100_013-fis_3', 'Planilla_100200_001-cne_3', 'Planilla_100200_013-fis_3',
  'Planilla_100300_001-cne_3', 'Planilla_100300_013-fis_3', 'Planilla_100400_001-cne_3', 'Planilla_100400_013-fis_3',
  'Planilla_110100_013-fis_3', 'Planilla_110100_901-com_3', 'Planilla_110200_013-fis_3', 'Planilla_110200_100-opt_3',
  'Planilla_110300_013-fis_3', 'Worksheet',
]
const json = (o: unknown) => new Response(JSON.stringify(o), { status: 200 })
const params = {
  xlsx: new Uint8Array([1, 2, 3]),
  nombreArchivo: 'planilla.xlsx',
  nombreHoja: 'Planilla_110200_100-opt_3',
  indiceHojaXlsx: 11,
}

function simulado(respuestas: Response[]) {
  const llamadas: { url: string; init?: RequestInit }[] = []
  const fn = async (url: string, init?: RequestInit) => {
    llamadas.push({ url, init })
    return respuestas.shift()!
  }
  return { fn, llamadas }
}

describe('subirHoja', () => {
  it('pide iniciar y luego SOLO el indice 11 de la optativa', async () => {
    const s = simulado([
      json({ ok: true, mensaje: '', total: 14, hojas: HOJAS, token: 'a'.repeat(32) }),
      json({ ok: true, mensaje: 'Almacenados los datos del grupo "110200" y la materia "100" en el período "3".' }),
    ])
    const r = await subirHoja(s.fn, params)
    expect(s.llamadas.length).toBe(2)
    expect(s.llamadas.every((c) => c.url === URL_SUBIDA && c.init?.credentials === 'include')).toBe(true)
    const fd = s.llamadas[0].init!.body as FormData
    expect(fd.get('accion_pensum')).toBe('iniciar')
    expect((fd.get('archivo_actual') as File).name).toBe('planilla.xlsx')
    const b = s.llamadas[1].init!.body as URLSearchParams
    expect(b.get('accion_pensum')).toBe('hoja')
    expect(b.get('indice_hoja')).toBe('11')
    expect(b.get('token_pensum')).toBe('a'.repeat(32))
    expect(r.ok).toBe(true)
    expect(r.mensaje).toContain('Almacenados los datos del grupo "110200"')
    expect(r.indiceUsado).toBe(11)
  })

  it('sin token: error claro y no pide la hoja', async () => {
    const s = simulado([json({ ok: true, total: 14, hojas: HOJAS })])
    await expect(subirHoja(s.fn, params)).rejects.toThrow(/token/)
    expect(s.llamadas.length).toBe(1)
  })

  it('respuesta no JSON: sesion vencida y se detiene', async () => {
    const s = simulado([new Response('<html>login</html>', { status: 200 })])
    await expect(subirHoja(s.fn, params)).rejects.toThrow(MSG_SESION)
    expect(s.llamadas.length).toBe(1)
  })

  it('hoja ausente de la lista: no guarda nada', async () => {
    const s = simulado([json({ ok: true, hojas: ['otra'], token: 'x' })])
    await expect(subirHoja(s.fn, params)).rejects.toThrow(/no está en la lista/)
    expect(s.llamadas.length).toBe(1)
  })
})

import { descargarPlanilla, documentoDesdeIndex, rutaDescargaDesdeGenerar } from './red'

describe('descargarPlanilla (tarea 2)', () => {
  const GENERAR = `<script>var Comilla= "'";parent.showLightbox_loader('<input type="button" onClick="javascript:MensajeDescarga();document.location.href='+Comilla+'../../../../Temporal/Exportados/205001009797/71373907/EXCEL/PLANILLA_EXEL_71373907_2026_P3_C00_14 Nov 2026 09 11 31.xlsx'+Comilla+';hideLightbox_loader2();" value="Descargar">')</script>`
  it('extrae documento y ruta', () => {
    expect(documentoDesdeIndex("var vDocentes = '71373907|MEDINA|00|00';")).toBe('71373907')
    expect(documentoDesdeIndex('<table><tr id="71373907" onclick="x"><td>MEDINA</td></tr>')).toBe('71373907')
    expect(rutaDescargaDesdeGenerar(GENERAR)).toBe('/Temporal/Exportados/205001009797/71373907/EXCEL/PLANILLA_EXEL_71373907_2026_P3_C00_14 Nov 2026 09 11 31.xlsx')
  })
  it('hace las tres peticiones y devuelve el xlsx', async () => {
    const urls: string[] = []
    const f = async (u: string) => {
      urls.push(u)
      if (u.includes('index.php')) return new Response("var vDocentes = '71373907|MEDINA  TAMAYO , JULIAN  DAVID|00|00';")
      if (u.includes('GenerarExcelNumericoPensum')) return new Response(GENERAR)
      return new Response(new Uint8Array([0x50, 0x4b, 3, 4, 0]))
    }
    const r = await descargarPlanilla(f, 3)
    expect(urls[1]).toContain('periodo=3&NroDocumento=71373907&ciclo=00')
    expect(urls[2]).toBe('/Temporal/Exportados/205001009797/71373907/EXCEL/PLANILLA_EXEL_71373907_2026_P3_C00_14%20Nov%202026%2009%2011%2031.xlsx')
    expect(r.nombre).toBe('PLANILLA_EXEL_71373907_2026_P3_C00_14 Nov 2026 09 11 31.xlsx')
  })
  it('sesión vencida: error claro', async () => {
    await expect(descargarPlanilla(async () => new Response('<html>login</html>'), 3)).rejects.toThrow(/venció/)
  })
})
