import { describe, it, expect } from 'vitest'
import { crearClienteNube, mensajeDeError, urlCallable, URL_SIGNIN } from './nube'

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status })

function montar(respuestas: (url: string, init?: RequestInit) => Response) {
  const llamadas: { url: string; init?: RequestInit }[] = []
  const quitados: string[] = []
  let n = 0
  const cliente = crearClienteNube({
    fetchFn: async (url, init) => { llamadas.push({ url, init }); return respuestas(url, init) },
    tokenGoogle: async () => `google-${++n}`,
    quitarTokenGoogle: async (t) => { quitados.push(t) },
    ahora: () => 1_000,
  })
  return { cliente, llamadas, quitados }
}

describe('cliente de la nube', () => {
  it('inicia sesión con el token de Google y llama la callable con {data} y Bearer', async () => {
    const { cliente, llamadas } = montar((url) =>
      url === URL_SIGNIN ? json(200, { idToken: 'ID1', expiresIn: '3600' }) : json(200, { result: { hola: 1 } }))
    expect(await cliente.llamar('ciParaMaster', { periodo: 3 })).toEqual({ ok: true, result: { hola: 1 } })
    expect(llamadas[0].url).toBe(URL_SIGNIN)
    expect(String(llamadas[0].init?.body)).toContain('access_token=google-1&providerId=google.com')
    expect(llamadas[1].url).toBe(urlCallable('ciParaMaster'))
    expect((llamadas[1].init?.headers as Record<string, string>).Authorization).toBe('Bearer ID1')
    expect(JSON.parse(String(llamadas[1].init?.body))).toEqual({ data: { periodo: 3 } })
    await cliente.llamar('ciParaMaster', {})
    expect(llamadas.filter((l) => l.url === URL_SIGNIN).length).toBe(1)
  })

  it('token de Google revocado: lo quita de la caché y reintenta una vez', async () => {
    let intento = 0
    const { cliente, quitados } = montar((url) =>
      url === URL_SIGNIN ? (++intento === 1 ? json(400, { error: {} }) : json(200, { idToken: 'ID2' })) : json(200, { result: 1 }))
    expect(await cliente.llamar('ciParaMaster', {})).toEqual({ ok: true, result: 1 })
    expect(quitados).toEqual(['google-1'])
  })

  it('devuelve el error de la callable con su motivo', async () => {
    const { cliente } = montar((url) =>
      url === URL_SIGNIN
        ? json(200, { idToken: 'X' })
        : json(400, { error: { status: 'FAILED_PRECONDITION', message: 'm', details: { motivo: 'varios_grupos', grados: ['9.1', '9.2'] } } }))
    const r = await cliente.llamar('ciParaMaster', {})
    expect(r).toMatchObject({ ok: false, error: { status: 'FAILED_PRECONDITION', details: { motivo: 'varios_grupos', grados: ['9.1', '9.2'] } } })
    if (!r.ok) expect(mensajeDeError(r.error)).toMatch(/más de un grupo/)
  })

  it('mensajes claros para los motivos conocidos', () => {
    expect(mensajeDeError({ status: 'FAILED_PRECONDITION', message: '', details: { motivo: 'sin_direccion' } })).toMatch(/no es director/)
    expect(mensajeDeError({ status: 'PERMISSION_DENIED', message: '' })).toMatch(/no le permite/)
    expect(mensajeDeError({ status: 'RED', message: '' })).toMatch(/conexión/)
  })
})
