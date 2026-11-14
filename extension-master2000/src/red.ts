// Capa de red hacia el Master 2000. Recibe fetch por parametro para poder probarla con respuestas simuladas.

export const URL_SUBIDA = '/academicodocente/menu/profesor/Subirpensumexcel/Subirpensumexcel_NumericoConvencional.php'

export type FetchFn = (input: string, init?: RequestInit) => Promise<Response>

export class ErrorMaster extends Error {}

export const MSG_SESION = 'La sesión del Máster venció; vuelva a entrar'

async function leerJson(r: Response): Promise<Record<string, unknown>> {
  const texto = await r.text()
  try {
    const j = JSON.parse(texto)
    if (j && typeof j === 'object') return j as Record<string, unknown>
  } catch {
    /* no era JSON */
  }
  throw new ErrorMaster(MSG_SESION)
}

/** El Máster responde HTML («<strong>…per&iacute;odo…</strong>»): se muestra como texto limpio. */
export function textoPlano(html: string): string {
  const ent: Record<string, string> = { aacute: 'á', eacute: 'é', iacute: 'í', oacute: 'ó', uacute: 'ú', ntilde: 'ñ', Aacute: 'Á', Eacute: 'É', Iacute: 'Í', Oacute: 'Ó', Uacute: 'Ú', Ntilde: 'Ñ', nbsp: ' ', amp: '&', quot: '"', lt: '<', gt: '>' }
  return html.replace(/<[^>]*>/g, ' ').replace(/&(\w+);/g, (m, n) => ent[n] ?? m).replace(/\s+/g, ' ').trim()
}

function nombreDeHoja(h: unknown): string | null {
  if (typeof h === 'string') return h
  if (h && typeof h === 'object') {
    const o = h as Record<string, unknown>
    for (const k of ['nombre', 'name', 'hoja', 'sheet', 'titulo']) if (typeof o[k] === 'string') return o[k] as string
  }
  return null
}

export interface ParamsSubida {
  xlsx: Uint8Array
  nombreArchivo: string // mismo nombre que el original
  nombreHoja: string // hoja optativa
  indiceHojaXlsx: number // posicion en el libro; solo se usa si el Master no devuelve nombres
}

export interface ResultadoSubida {
  ok: boolean
  mensaje: string
  indiceUsado: number
}

/**
 * iniciar + hoja (SOLO la optativa). Lanza ErrorMaster ante cualquier respuesta inesperada.
 * La respuesta de iniciar trae el token en el campo "token" (verificado en el registro de red);
 * se envia despues como token_pensum.
 */
export async function subirHoja(
  fetchFn: FetchFn,
  p: ParamsSubida,
  progreso: (m: string) => void = () => {},
): Promise<ResultadoSubida> {
  progreso('Enviando la planilla al Máster…')
  const fd = new FormData()
  fd.append(
    'archivo_actual',
    new Blob([p.xlsx as BlobPart], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
    p.nombreArchivo,
  )
  fd.append('accion_pensum', 'iniciar')
  const r1 = await fetchFn(URL_SUBIDA, { method: 'POST', body: fd, credentials: 'include' })
  const j1 = await leerJson(r1)
  if (j1.ok !== true) throw new ErrorMaster(`El Máster rechazó la planilla: ${String(j1.mensaje ?? 'sin detalle')}`)
  const tokenRaw = j1.token ?? j1.token_pensum
  const token = typeof tokenRaw === 'string' ? tokenRaw : ''
  if (!token) throw new ErrorMaster('El Máster no devolvió el token de la subida; no se guardó nada.')
  const hojas = Array.isArray(j1.hojas) ? j1.hojas : []
  const nombres = hojas.map(nombreDeHoja)
  let indice: number
  if (nombres.some((n) => n !== null)) {
    indice = nombres.indexOf(p.nombreHoja)
    if (indice < 0) throw new ErrorMaster(`La hoja ${p.nombreHoja} no está en la lista del Máster; no se guardó nada.`)
  } else if (hojas.length > p.indiceHojaXlsx) {
    indice = p.indiceHojaXlsx
  } else {
    throw new ErrorMaster('El Máster no devolvió la lista de hojas; no se guardó nada.')
  }
  progreso('Guardando la hoja optativa…')
  const cuerpo = new URLSearchParams({ accion_pensum: 'hoja', indice_hoja: String(indice), token_pensum: token })
  const r2 = await fetchFn(URL_SUBIDA, {
    method: 'POST',
    body: cuerpo,
    credentials: 'include',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
  })
  const j2 = await leerJson(r2)
  return { ok: j2.ok === true, mensaje: textoPlano(String(j2.mensaje ?? '')), indiceUsado: indice }
}

const URL_GENERAR_INDEX = '/academicodocente/menu/profesor/GenerarPensumExcel/index.php'
const URL_GENERAR = '/academicodocente/menu/profesor/GenerarPensumExcel/GenerarExcelNumericoPensum.php'

/**
 * Documento del docente. La pagina de «Generar planillas excel» lo declara en
 * `var vDocentes = '71373907|MEDINA TAMAYO , JULIAN DAVID|00|00';` (registro 2026-11-14).
 * Si hubiera varios docentes (separados por otro delimitador) se toma el primero; respaldo: <tr id="doc">.
 */
export function documentoDesdeIndex(html: string): string | null {
  const v = html.match(/vDocentes\s*=\s*['"](\d{5,12})\|/)
  if (v) return v[1]
  const m = html.match(/<tr[^>]*\sid=["']?(\d{5,12})/i)
  return m ? m[1] : null
}

/** La respuesta de generar trae el enlace del boton «Descargar»: ../../../../Temporal/Exportados/.../EXCEL/<archivo>.xlsx */
export function rutaDescargaDesdeGenerar(html: string): string | null {
  const m = html.match(/(?:\.\.\/)+(Temporal\/Exportados\/[^'"]+?\.xlsx)/i)
  return m ? '/' + m[1] : null
}

/**
 * Tarea 2: descarga la planilla actual del periodo, como el boton «Generar archivo» + «Descargar».
 * Flujo verificado en el registro de red del 2026-11-14:
 *   GET index.php (documento del docente) -> GET GenerarExcelNumericoPensum.php?periodo&NroDocumento&ciclo=00
 *   -> la respuesta trae la ruta /Temporal/Exportados/<dane>/<doc>/EXCEL/<archivo>.xlsx -> GET de esa ruta.
 */
export async function descargarPlanilla(
  fetchFn: FetchFn,
  periodo: number,
  progreso: (m: string) => void = () => {},
): Promise<{ bytes: Uint8Array; nombre: string }> {
  progreso('Buscando su documento en el Máster…')
  const r0 = await fetchFn(URL_GENERAR_INDEX, { credentials: 'include' })
  const doc = documentoDesdeIndex(await r0.text())
  if (!doc) throw new ErrorMaster(`${MSG_SESION} (no se encontró el docente en «Generar planillas excel»)`)
  progreso('Generando la planilla del periodo…')
  const q = new URLSearchParams({ periodo: String(periodo), NroDocumento: doc, ciclo: '00' })
  const r1 = await fetchFn(`${URL_GENERAR}?${q}`, { credentials: 'include' })
  const ruta = rutaDescargaDesdeGenerar(await r1.text())
  if (!ruta) throw new ErrorMaster('El Máster no generó la planilla; intente de nuevo o descárguela a mano.')
  progreso('Descargando la planilla…')
  const r2 = await fetchFn(encodeURI(ruta), { credentials: 'include' })
  const bytes = new Uint8Array(await r2.arrayBuffer())
  if (!r2.ok || bytes.length < 4 || bytes[0] !== 0x50 || bytes[1] !== 0x4b) {
    throw new ErrorMaster('La planilla descargada no es un Excel válido; intente de nuevo.')
  }
  return { bytes, nombre: ruta.split('/').pop()! }
}
