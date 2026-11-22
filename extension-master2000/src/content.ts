// Script de contenido: boton flotante + panel (shadow DOM) en el panel del Master 2000.
import {
  leerExcelMJB, leerHojaOptativa, elegirHojaPorMatriculas, calcularCambios, edicionesDe, aplicarCambiosXlsx,
  type FilaPlanilla, type HojaOptativa, type ResultadoCruce, type EstadoEstudiante,
} from './core/centros'
import { subirHoja, descargarPlanilla, ErrorMaster } from './red'
import { filasComoModelo, clasificarConSubidas, filasParaRegistrar, type RespuestaApp } from './core/v2'
import { mensajeDeError, type ErrorNube, type RespuestaMensaje } from './nube'

declare const chrome: any // @types/chrome no está instalado; solo se usa runtime.sendMessage

/** Error de la nube con su texto ya en lenguaje sencillo. */
class ErrorMJB extends Error {
  constructor(public detalle: ErrorNube) { super(mensajeDeError(detalle)) }
}

/** Pide una función de MJB al service worker (allí vive la identidad de Chrome). */
function llamarNube<T>(nombre: string, data: unknown): Promise<T> {
  return new Promise((resolver, rechazar) => {
    try {
      chrome.runtime.sendMessage({ tipo: 'mjb-llamar', nombre, data }, (r: RespuestaMensaje | undefined) => {
        if (chrome.runtime.lastError || !r) {
          rechazar(new ErrorMJB({ status: 'SIN_SESION', message: chrome.runtime.lastError?.message ?? 'El servicio de la extensión no respondió.' }))
        } else if (r.ok) resolver(r.result as T)
        else rechazar(new ErrorMJB(r.error))
      })
    } catch (x) {
      rechazar(new ErrorMJB({ status: 'SIN_SESION', message: (x as Error).message }))
    }
  })
}

const CSS = `
:host { all: initial; }
* { box-sizing: border-box; font-family: system-ui, Segoe UI, sans-serif; }
.fab { position: fixed; right: 20px; bottom: 20px; z-index: 2147483000; background: #1d4ed8; color: #fff; border: 0;
  border-radius: 999px; padding: 12px 18px; font-size: 14px; cursor: pointer; box-shadow: 0 4px 14px rgba(0,0,0,.35); }
.fab:hover { background: #1e40af; }
.panel { position: fixed; right: 20px; bottom: 70px; z-index: 2147483000; width: min(760px, calc(100vw - 40px));
  max-height: calc(100vh - 100px); overflow: auto; background: #fff; color: #111; border-radius: 10px;
  box-shadow: 0 10px 40px rgba(0,0,0,.45); padding: 16px; font-size: 13px; }
h2 { margin: 0 0 10px; font-size: 16px; }
h3 { margin: 14px 0 6px; font-size: 13px; }
label { display: block; margin: 6px 0 2px; font-weight: 600; }
select, input[type=file] { width: 100%; padding: 4px; }
button.p { background: #15803d; color: #fff; border: 0; border-radius: 6px; padding: 8px 14px; cursor: pointer; font-size: 13px; }
button.p:disabled { background: #9ca3af; cursor: not-allowed; }
button.s { background: #e5e7eb; border: 0; border-radius: 6px; padding: 6px 10px; cursor: pointer; }
.err { background: #fee2e2; color: #991b1b; padding: 8px; border-radius: 6px; margin: 8px 0; }
.ok { background: #dcfce7; color: #166534; padding: 8px; border-radius: 6px; margin: 8px 0; }
.info { background: #eff6ff; color: #1e3a8a; padding: 8px; border-radius: 6px; margin: 8px 0; }
table { border-collapse: collapse; width: 100%; margin-top: 6px; }
th, td { border-bottom: 1px solid #e5e7eb; padding: 4px 6px; text-align: left; vertical-align: top; }
tr.nuevo td { background: #dcfce7; } tr.igual td { background: #f3f4f6; }
tr.conflicto td { background: #fef3c7; } tr.actualizado-app td { background: #dbeafe; } tr.sin-dato td { background: #fff; color: #6b7280; }
tr.no-se-digita td { background: #f9fafb; color: #9ca3af; }
tr.codigo-invalido td { background: #fee2e2; color: #991b1b; }
.cerrar { float: right; }
small { color: #6b7280; }
`

type Props = Record<string, unknown>
function h(tag: string, props: Props = {}, ...hijos: (Node | string | null)[]): HTMLElement {
  const el = document.createElement(tag)
  for (const [k, v] of Object.entries(props)) {
    if (k === 'class') el.className = String(v)
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v as EventListener)
    else if (v !== false && v !== undefined) (el as unknown as Record<string, unknown>)[k] = v
  }
  for (const c of hijos) if (c !== null) el.append(typeof c === 'string' ? document.createTextNode(c) : c)
  return el
}

interface Estado {
  periodo: number
  mjbNombre: string
  mjb: FilaPlanilla[] | null
  planillaNombre: string
  planilla: Uint8Array | null
  optativas: HojaOptativa[]
  hoja: HojaOptativa | null
  cruce: ResultadoCruce | null
  usarMJB: Set<string>
  error: string
  aviso: string
  subiendo: boolean
  resultado: { ok: boolean; mensaje: string } | null
  // V2
  app: RespuestaApp | null
  grupo: string
  sede: string
  grupos: string[]
  sedes: string[]
  registro: { ok: boolean; mensaje: string } | null
}

const e: Estado = {
  periodo: 3, mjbNombre: '', mjb: null, planillaNombre: '', planilla: null, optativas: [], hoja: null,
  cruce: null, usarMJB: new Set(), error: '', aviso: '', subiendo: false, resultado: null,
  app: null, grupo: '', sede: '', grupos: [], sedes: [], registro: null,
}

let cuerpo: HTMLElement

const ETIQUETA: Record<EstadoEstudiante, string> = {
  nuevo: 'nuevo', igual: 'igual', conflicto: 'distinto', 'sin-dato': 'sin dato en MJB', 'no-se-digita': 'no se digita', 'codigo-invalido': 'código no válido (no es 600)', 'actualizado-app': 'actualizado en la app',
}

function recalcular() {
  e.cruce = null
  e.usarMJB = new Set()
  e.resultado = null
  e.registro = null
  if (!e.mjb || !e.planilla) return
  const porCodigo = e.app?.codigoGrupoMaster ? e.optativas.find((o) => o.grupo === e.app!.codigoGrupoMaster) : undefined
  e.hoja = e.optativas.length === 1 ? e.optativas[0] : (e.hoja && e.optativas.includes(e.hoja) ? e.hoja : porCodigo ?? elegirHojaPorMatriculas(e.optativas, e.mjb))
  e.cruce = e.hoja ? cruzar(e.mjb, e.hoja) : null
}

/** Cruce por matrícula y, en V2, clasificación frente a la última subida registrada en la app. */
function cruzar(mjb: FilaPlanilla[], hoja: HojaOptativa): ResultadoCruce {
  const c = calcularCambios(mjb, hoja)
  if (!e.app) return c
  // Una subida registrada de otro periodo no sirve de referencia para este.
  const otro = e.app.ultimaSubida?.periodo != null && e.app.ultimaSubida.periodo !== e.periodo
  return clasificarConSubidas(c, hoja, e.app.filas, otro)
}

async function leerArchivo(f: File): Promise<Uint8Array> {
  return new Uint8Array(await f.arrayBuffer())
}

async function alElegirMJB(f: File | undefined) {
  e.error = ''
  e.mjb = null
  e.app = null
  e.mjbNombre = ''
  if (f) {
    try {
      e.mjb = leerExcelMJB(await leerArchivo(f))
      e.mjbNombre = f.name
    } catch (x) {
      e.error = `No se pudo leer el Excel de MJB: ${(x as Error).message}`
    }
  }
  recalcular()
  pintar()
}

function cargarPlanilla(bytes: Uint8Array, nombre: string) {
  const hojas = leerHojaOptativa(bytes)
  if (!hojas.length) throw new Error('la planilla no tiene hojas optativas (abreviatura "opt")')
  e.planilla = bytes
  e.planillaNombre = nombre
  e.optativas = hojas
}

function limpiarPlanilla() {
  e.error = ''
  e.aviso = ''
  e.planilla = null
  e.planillaNombre = ''
  e.optativas = []
  e.hoja = null
}

async function alElegirPlanilla(f: File | undefined) {
  limpiarPlanilla()
  if (f) {
    try {
      cargarPlanilla(await leerArchivo(f), f.name)
    } catch (x) {
      e.error = `No se pudo leer la planilla del Máster: ${(x as Error).message}`
    }
  }
  recalcular()
  pintar()
}

let descargando = false
async function alDescargar() {
  if (descargando) return
  descargando = true
  limpiarPlanilla()
  try {
    const r = await descargarPlanilla((u, i) => fetch(u, i), e.periodo, (m) => { e.aviso = m; pintar() })
    cargarPlanilla(r.bytes, r.nombre)
    e.aviso = `Planilla descargada del Máster (periodo ${e.periodo}), con las notas que tiene hoy.`
  } catch (x) {
    e.aviso = ''
    e.error = x instanceof ErrorMaster ? x.message : `No se pudo descargar la planilla: ${(x as Error).message}`
  } finally {
    descargando = false
  }
  recalcular()
  pintar()
}

let cargando = false
/** V2: trae los datos de la app, descarga la planilla del Máster y arma la vista previa. */
async function alCargar() {
  if (cargando) return
  cargando = true
  limpiarPlanilla()
  e.mjb = null
  e.app = null
  e.mjbNombre = ''
  e.cruce = null
  e.resultado = null
  e.registro = null
  e.grupos = []
  e.sedes = []
  try {
    e.aviso = 'Pidiendo a MJB los datos del grupo…'
    pintar()
    const pedido: Record<string, unknown> = { periodo: e.periodo }
    if (e.grupo.trim()) pedido.grupo = e.grupo.trim()
    if (e.sede) pedido.sede = e.sede
    const app = await llamarNube<RespuestaApp>('ciParaMaster', pedido)
    if (app.resumen.seDigitan === 0) {
      e.aviso = `En MJB, el grupo ${app.grado} todavía no tiene valoraciones de centros de interés para llevar al Máster. No se subió nada.`
      return
    }
    e.app = app
    e.aviso = `MJB entregó el grupo ${app.grado} (${app.resumen.seDigitan} estudiantes con valoración).`
    pintar()
    const r = await descargarPlanilla((u, i) => fetch(u, i), e.periodo, (m) => { e.aviso = m; pintar() })
    cargarPlanilla(r.bytes, r.nombre)
    e.mjb = filasComoModelo(app.filas)
    e.aviso = `Datos de MJB (grupo ${app.grado}) y planilla del Máster (periodo ${e.periodo}) cargados.`
  } catch (x) {
    e.aviso = ''
    e.app = null
    if (x instanceof ErrorMJB) {
      e.error = x.message
      if (x.detalle.details?.motivo === 'varios_grupos') e.grupos = x.detalle.details.grados ?? []
      if (x.detalle.details?.motivo === 'varias_sedes') e.sedes = x.detalle.details.sedes ?? []
    } else e.error = x instanceof ErrorMaster ? x.message : `No se pudo cargar: ${(x as Error).message}`
  } finally {
    cargando = false
  }
  recalcular()
  pintar()
}

/** Tras guardar en el Máster: le cuenta a la app qué quedó allá. Un fallo aquí no deshace la subida. */
async function registrarEnApp() {
  if (!e.app || !e.cruce) return
  const filas = filasParaRegistrar(e.cruce, e.app.filas, e.usarMJB)
  if (!filas.length) { e.registro = { ok: true, mensaje: 'No había filas que informar a MJB.' }; return }
  try {
    const r = await llamarNube<{ registrados: number; sinEmparejar: string[]; invalidas: number[]; pendientes: number }>('ciRegistrarSubida', {
      grupo: e.app.grado, periodo: e.periodo, sede: e.app.sede, programaId: e.app.programa.programaId, filas,
    })
    const extra = r.sinEmparejar.length + r.invalidas.length
    e.registro = { ok: true, mensaje: `MJB anotó ${r.registrados} estudiante(s) como subidos${extra ? ` (${extra} no se pudieron emparejar)` : ''}.` }
  } catch (x) {
    e.registro = { ok: false, mensaje: `Se guardó en el Máster, pero no se pudo avisar a MJB (${(x as Error).message}). El aviso de cambios en MJB podría seguir apareciendo; vuelva a pulsar «Cargar» y «Subir» más tarde.` }
  }
}

async function subir() {
  if (!e.planilla || !e.hoja || !e.cruce) return
  e.subiendo = true
  e.error = ''
  e.resultado = null
  e.aviso = ''
  pintar()
  try {
    const xlsx = aplicarCambiosXlsx(e.planilla, e.hoja.nombre, edicionesDe(e.cruce, e.usarMJB))
    const r = await subirHoja(
      (u, i) => fetch(u, i),
      { xlsx, nombreArchivo: e.planillaNombre, nombreHoja: e.hoja.nombre, indiceHojaXlsx: e.hoja.indice },
      (m) => {
        e.aviso = m
        pintar()
      },
    )
    e.resultado = { ok: r.ok, mensaje: r.mensaje }
    if (r.ok) await registrarEnApp()
  } catch (x) {
    e.error = x instanceof ErrorMaster ? x.message : `Error inesperado: ${(x as Error).message}`
  }
  e.subiendo = false
  e.aviso = ''
  pintar()
}

function celdaTexto(v: number | string | null): string {
  return v === null ? '—' : String(v)
}

function vistaPrevia(c: ResultadoCruce): HTMLElement {
  const r = c.resumen
  const filas = c.estudiantes.map((s) => {
    const cambios = s.celdas.filter((x) => x.accion === 'escribir' || x.accion === 'conflicto')
    const detalle = cambios.length
      ? cambios.map((x) => `${x.campo}: ${celdaTexto(x.master)} → ${celdaTexto(x.mjb)}`).join(' · ')
      : s.estado === 'no-se-digita' ? 'No se digita' : s.estado === 'codigo-invalido' ? 'No se sube: el Máster solo acepta códigos 600' : ''
    const celdaElegir =
      s.estado === 'conflicto'
        ? h('label', {}, h('input', {
            type: 'checkbox',
            checked: e.usarMJB.has(s.matricula),
            onchange: (ev: Event) => {
              if ((ev.target as HTMLInputElement).checked) e.usarMJB.add(s.matricula)
              else e.usarMJB.delete(s.matricula)
              pintar()
            },
          }), ' usar MJB')
        : null
    return h('tr', { class: s.estado }, h('td', {}, s.matricula), h('td', {}, s.nombre), h('td', {}, ETIQUETA[s.estado]), h('td', {}, detalle, celdaElegir))
  })
  const lista = (t: string, xs: { matricula: string; nombre: string }[], extra?: (x: never) => string) =>
    h('div', {}, h('h3', {}, `${t}: ${xs.length}`), xs.length ? h('small', {}, xs.map((x) => `${x.nombre} (${x.matricula})${extra ? extra(x as never) : ''}`).join('; ')) : null)
  return h('div', {},
    h('div', { class: 'info' },
      `${r.actualizadosApp ? `Actualizados en la app: ${r.actualizadosApp} · ` : ''}A escribir: ${r.aEscribir} estudiantes (${r.celdasAEscribir} celdas nuevas) · Sin centro / no se digita: ${r.sinCentro} · Iguales: ${r.iguales} · Distintos: ${r.conflictos} (por defecto se conserva el Máster)${r.codigoInvalido ? ` · Con códigos que no son de la serie 600 (no se suben): ${r.codigoInvalido}` : ''}`),
    h('table', {}, h('thead', {}, h('tr', {}, h('th', {}, 'Matrícula'), h('th', {}, 'Nombre'), h('th', {}, 'Estado'), h('th', {}, 'Cambio'))), h('tbody', {}, ...filas)),
    lista('Solo en el Máster', c.soloMaster),
    lista('Solo en MJB', c.soloMJB),
    c.ambiguas.length ? lista('Matrículas ambiguas (no se escriben)', c.ambiguas, (x: { motivo: string }) => ` — ${x.motivo}`) : null,
  )
}

function pintar() {
  cuerpo.replaceChildren()
  const selPeriodo = h('select', { onchange: (ev: Event) => { e.periodo = Number((ev.target as HTMLSelectElement).value); pintar() } },
    ...[1, 2, 3, 4].map((p) => h('option', { value: String(p), selected: p === e.periodo }, `Periodo ${p}`)))
  const opcionesGrupo = e.grupos.length
    ? [h('label', {}, 'Su grupo'), h('select', { onchange: (ev: Event) => { e.grupo = (ev.target as HTMLSelectElement).value } },
        h('option', { value: '' }, 'Elija…'), ...e.grupos.map((g) => h('option', { value: g, selected: g === e.grupo }, g)))]
    : []
  const opcionesSede = e.sedes.length
    ? [h('label', {}, 'Sede'), h('select', { onchange: (ev: Event) => { e.sede = (ev.target as HTMLSelectElement).value } },
        h('option', { value: '' }, 'Elija…'), ...e.sedes.map((g) => h('option', { value: g, selected: g === e.sede }, g)))]
    : []
  cuerpo.append(
    h('button', { class: 's cerrar', onclick: () => { cuerpo.style.display = 'none' } }, 'Cerrar'),
    h('h2', {}, 'Llevar centros de interés de MJB al Máster'),
    h('label', {}, 'Periodo'), selPeriodo,
    ...opcionesGrupo, ...opcionesSede,
    h('div', { style: 'margin-top:10px' },
      h('button', { class: 'p', disabled: cargando, onclick: alCargar }, cargando ? 'Cargando…' : 'Cargar'),
      ' ', h('small', {}, 'Trae de MJB los datos de su grupo y la planilla actual del Máster.')),
    h('details', { style: 'margin-top:8px' }, h('summary', {}, 'Coordinación: cargar otro grupo'),
      h('label', {}, 'Grupo (por ejemplo 11.2)'),
      h('input', { type: 'text', value: e.grupo, style: 'width:100%;padding:4px', oninput: (ev: Event) => { e.grupo = (ev.target as HTMLInputElement).value } })),
    h('details', { style: 'margin-top:8px' }, h('summary', {}, 'Respaldo: elegir un Excel de MJB'),
      h('label', {}, 'Excel de MJB (Centros de interés → Exportar Excel)'),
      h('input', { type: 'file', accept: '.xlsx', onchange: (ev: Event) => alElegirMJB((ev.target as HTMLInputElement).files?.[0]) }),
      ...(e.mjb && !e.app ? [h('small', {}, `${e.mjbNombre}: ${e.mjb.length} estudiantes`)] : []),
      h('label', {}, 'Planilla actual del Máster'),
      h('button', { class: 's', disabled: descargando, onclick: alDescargar }, descargando ? 'Descargando…' : `Descargar la planilla del periodo ${e.periodo}`),
      h('details', {}, h('summary', {}, 'O elegir una planilla ya descargada'),
        h('input', { type: 'file', accept: '.xlsx', onchange: (ev: Event) => alElegirPlanilla((ev.target as HTMLInputElement).files?.[0]) })),
      ...(e.planilla ? [h('small', {}, `${e.planillaNombre}: ${e.optativas.length} hoja(s) optativa(s)`)] : [])),
  )
  if (e.app && e.app.resumen.sinMatricula > 0) {
    const sin = e.app.filas.filter((f) => f.seDigita && !f.matricula).map((f) => f.nombre).join('; ')
    cuerpo.append(h('div', { class: 'info' }, `${e.app.resumen.sinMatricula} estudiante(s) con valoración no tienen matrícula en MJB y no se subirán: ${sin}.`))
  }
  if (e.optativas.length > 1 && e.mjb) {
    cuerpo.append(
      h('label', {}, 'Hoja optativa (elegida por coincidencia de matrículas; puede cambiarla)'),
      h('select', { onchange: (ev: Event) => { e.hoja = e.optativas[Number((ev.target as HTMLSelectElement).value)]; e.cruce = e.mjb ? cruzar(e.mjb, e.hoja) : null; e.usarMJB = new Set(); pintar() } },
        ...e.optativas.map((o, i) => h('option', { value: String(i), selected: o === e.hoja }, o.nombre))),
    )
  }
  if (e.mjb && e.planilla && !e.hoja) cuerpo.append(h('div', { class: 'err' }, 'Ninguna hoja optativa de la planilla comparte matrículas con los datos de MJB. Revise que sean del mismo grupo.'))
  if (e.error) cuerpo.append(h('div', { class: 'err' }, e.error))
  if (e.aviso) cuerpo.append(h('div', { class: 'info' }, e.aviso))
  if (e.cruce && e.hoja) {
    const hojaPer = e.hoja.periodo
    cuerpo.append(h('h3', {}, `Vista previa — hoja ${e.hoja.nombre}`))
    if (String(e.periodo) !== hojaPer) cuerpo.append(h('div', { class: 'err' }, `El periodo elegido (${e.periodo}) no coincide con el de la planilla (${hojaPer}).`))
    cuerpo.append(vistaPrevia(e.cruce))
    const hayCambios = edicionesDe(e.cruce, e.usarMJB).length > 0
    const bloqueado = e.subiendo || !hayCambios || e.resultado?.ok === true || String(e.periodo) !== hojaPer
    cuerpo.append(
      h('div', { style: 'margin-top:12px' },
        h('button', { class: 'p', disabled: bloqueado, onclick: subir }, e.subiendo ? 'Subiendo…' : 'Subir al Máster'),
        ' ', h('small', {}, hayCambios ? 'Solo se guarda la hoja optativa; las demás hojas no se vuelven a guardar.' : 'No hay nada nuevo que escribir.')),
    )
  }
  if (e.registro) cuerpo.append(h('div', { class: e.registro.ok ? 'ok' : 'err' }, e.registro.mensaje))
  if (e.resultado) {
    cuerpo.append(h('div', { class: e.resultado.ok ? 'ok' : 'err' }, `${e.hoja?.nombre ?? 'Hoja'}: ${e.resultado.ok ? 'guardado ✓' : 'el Máster respondió con error'} — ${e.resultado.mensaje}`))
  }
}

function montar() {
  if (document.getElementById('mjb-centros-ext')) return
  const host = h('div', { id: 'mjb-centros-ext' })
  const root = host.attachShadow({ mode: 'open' })
  const panel = h('div', { class: 'panel', style: 'display:none' })
  cuerpo = panel
  const fab = h('button', {
    class: 'fab',
    onclick: () => { panel.style.display = panel.style.display === 'none' ? 'block' : 'none' },
  }, 'Llevar centros de interés de MJB')
  root.append(h('style', {}, CSS), fab, panel)
  document.body.append(host)
  pintar()
}

montar()
