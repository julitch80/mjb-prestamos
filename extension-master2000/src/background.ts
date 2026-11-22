// Service worker: la identidad de Chrome (chrome.identity) no existe en los scripts de contenido.
// El script de contenido envía { tipo: 'mjb-llamar', nombre, data } y recibe { ok, result | error }.
import { crearClienteNube, type RespuestaMensaje } from './nube'

declare const chrome: any // @types/chrome no está instalado; solo se usan estas pocas llamadas

const cliente = crearClienteNube({
  fetchFn: (u, i) => fetch(u, i),
  tokenGoogle: async () => {
    const r = await chrome.identity.getAuthToken({ interactive: true })
    const token = typeof r === 'string' ? r : r?.token
    if (!token) throw new Error('Chrome no entregó la credencial de Google.')
    return token as string
  },
  quitarTokenGoogle: (token) => chrome.identity.removeCachedAuthToken({ token }),
})

chrome.runtime.onMessage.addListener((msg: { tipo?: string; nombre?: string; data?: unknown }, _s: unknown, responder: (r: RespuestaMensaje) => void) => {
  if (msg?.tipo !== 'mjb-llamar' || typeof msg.nombre !== 'string') return false
  if (!['ciParaMaster', 'ciRegistrarSubida'].includes(msg.nombre)) {
    responder({ ok: false, error: { status: 'INVALID_ARGUMENT', message: 'Función no permitida.' } })
    return false
  }
  cliente.llamar(msg.nombre, msg.data).then(responder, (x) => responder({ ok: false, error: { status: 'RED', message: String(x) } }))
  return true // respuesta asíncrona
})
