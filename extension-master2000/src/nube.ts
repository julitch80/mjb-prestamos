// Conexión con las funciones de MJB (Firebase). Sin chrome.* ni DOM: todo entra por parámetro para poder probarla.
// El service worker (background.ts) la conecta con chrome.identity; el script de contenido le pide las llamadas por mensaje.

/** Config web PÚBLICA del proyecto Firebase de MJB (la misma que inicializa la app en src/lib/firebase.ts). */
export const FIREBASE = {
  apiKey: 'AIzaSyD4JUcD3MOnKmGQv0xHBxqBCfwwCm5MreQ',
  projectId: 'mjb-prestamos',
  region: 'us-central1',
} as const

export type FetchFn = (input: string, init?: RequestInit) => Promise<Response>

export interface ErrorNube {
  status: string // p. ej. FAILED_PRECONDITION, PERMISSION_DENIED, UNAUTHENTICATED, red
  message: string
  details?: { motivo?: string; grados?: string[]; sedes?: string[] } & Record<string, unknown>
}

export type RespuestaMensaje = { ok: true; result: unknown } | { ok: false; error: ErrorNube }

export interface DepsNube {
  fetchFn: FetchFn
  /** Token de acceso de Google de la cuenta de Chrome (chrome.identity.getAuthToken). */
  tokenGoogle: () => Promise<string>
  /** Quita ese token de la caché de Chrome (revocado o vencido). */
  quitarTokenGoogle: (token: string) => Promise<void>
  ahora?: () => number
}

export function urlCallable(nombre: string): string {
  return `https://${FIREBASE.region}-${FIREBASE.projectId}.cloudfunctions.net/${nombre}`
}

export const URL_SIGNIN = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithIdp?key=${FIREBASE.apiKey}`

class ErrorAuth extends Error {}

/** Cliente: obtiene un idToken de Firebase (signInWithIdp por REST) y llama las callables por HTTP. */
export function crearClienteNube(d: DepsNube) {
  const ahora = d.ahora ?? Date.now
  let idToken: { valor: string; vence: number } | null = null

  async function iniciarSesion(reintento = false): Promise<string> {
    const google = await d.tokenGoogle()
    const r = await d.fetchFn(URL_SIGNIN, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        postBody: `access_token=${encodeURIComponent(google)}&providerId=google.com`,
        requestUri: 'http://localhost',
        returnSecureToken: true,
        returnIdpCredential: true,
      }),
    })
    if (!r.ok) {
      // Token de Google revocado o vencido: se quita de la caché y se reintenta una vez.
      if (!reintento && (r.status === 400 || r.status === 401)) {
        await d.quitarTokenGoogle(google)
        return iniciarSesion(true)
      }
      throw new ErrorAuth(`Firebase rechazó el inicio de sesión (HTTP ${r.status}).`)
    }
    const j = (await r.json()) as { idToken?: string; expiresIn?: string }
    if (!j.idToken) throw new ErrorAuth('Firebase no devolvió credencial.')
    idToken = { valor: j.idToken, vence: ahora() + (Number(j.expiresIn) || 3600) * 1000 - 60_000 }
    return idToken.valor
  }

  async function obtenerIdToken(): Promise<string> {
    if (idToken && idToken.vence > ahora()) return idToken.valor
    return iniciarSesion()
  }

  async function llamar(nombre: string, data: unknown, reintento = false): Promise<RespuestaMensaje> {
    let token: string
    try {
      token = await obtenerIdToken()
    } catch (x) {
      return { ok: false, error: { status: 'SIN_SESION', message: x instanceof Error ? x.message : String(x) } }
    }
    let r: Response
    try {
      r = await d.fetchFn(urlCallable(nombre), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ data }),
      })
    } catch (x) {
      return { ok: false, error: { status: 'RED', message: x instanceof Error ? x.message : String(x) } }
    }
    let cuerpo: { result?: unknown; error?: { status?: string; message?: string; details?: ErrorNube['details'] } } = {}
    try { cuerpo = await r.json() } catch { /* sin JSON */ }
    if (r.ok && cuerpo.result !== undefined) return { ok: true, result: cuerpo.result }
    const status = cuerpo.error?.status ?? `HTTP_${r.status}`
    if (!reintento && (status === 'UNAUTHENTICATED' || r.status === 401)) {
      idToken = null
      return llamar(nombre, data, true)
    }
    return { ok: false, error: { status, message: cuerpo.error?.message ?? `La función respondió HTTP ${r.status}.`, details: cuerpo.error?.details } }
  }

  return { llamar }
}

/** Texto en lenguaje sencillo para cada error de la nube. */
export function mensajeDeError(e: ErrorNube): string {
  const motivo = e.details?.motivo
  if (motivo === 'sin_direccion') return 'Usted no es director de ningún grupo en MJB. Si es de coordinación, escriba el grupo (por ejemplo 11.2) y vuelva a pulsar «Cargar».'
  if (motivo === 'varios_grupos') return 'Usted dirige más de un grupo: elija cuál va a cargar.'
  if (motivo === 'varias_sedes') return 'Ese grupo existe en más de una sede: elija la sede.'
  if (motivo === 'sin_programa') return 'En MJB no hay un programa de centros de interés activo para este grupo.'
  if (motivo === 'grupo_vacio') return 'En MJB no hay estudiantes activos en ese grupo.'
  switch (e.status) {
    case 'PERMISSION_DENIED': return 'MJB no le permite ver este grupo. Solo el director del grupo, la coordinación o el superusuario pueden cargarlo.'
    case 'UNAUTHENTICATED': return 'MJB no reconoció su sesión. Vuelva a pulsar «Cargar»; si sigue igual, revise que Chrome esté abierto con su cuenta institucional.'
    case 'SIN_SESION': return 'No se pudo iniciar sesión con la cuenta de Chrome. Revise que Chrome esté abierto con su cuenta institucional y vuelva a intentarlo.'
    case 'RED': return 'No hay conexión con MJB. Revise su internet e intente de nuevo.'
    case 'INVALID_ARGUMENT': return `MJB no aceptó la petición: ${e.message}`
    default: return `MJB respondió con un error: ${e.message}`
  }
}
