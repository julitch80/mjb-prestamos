// Acceso a Google Classroom como una persona del dominio, SIN archivo de clave:
// misma mecánica que functions-calendario (delegación de dominio; la cuenta firma el
// JWT con la API IAM Credentials y lo canjea por un token de la persona).
// La delegación debe autorizar estos alcances en la consola de Workspace (paso de Julián).

import { GoogleAuth } from 'google-auth-library';
import { API_CLASSROOM } from './logica';

const PROYECTO = 'mjb-prestamos';
// Misma cuenta de servicio que usa `calendario`.
export const CUENTA_SERVICIO = `calendario-tareas@${PROYECTO}.iam.gserviceaccount.com`;

export const ALCANCE_CURSOS = 'https://www.googleapis.com/auth/classroom.courses.readonly';
export const ALCANCE_TAREAS = 'https://www.googleapis.com/auth/classroom.coursework.students';
export const ALCANCE_PUSH = 'https://www.googleapis.com/auth/classroom.push-notifications';

const auth = new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/cloud-platform'] });

export async function tokenComo(correo: string, alcances: string[]): Promise<string> {
  const cliente = await auth.getClient();
  const ahora = Math.floor(Date.now() / 1000);
  const payload = { iss: CUENTA_SERVICIO, sub: correo, scope: alcances.join(' '),
    aud: 'https://oauth2.googleapis.com/token', iat: ahora, exp: ahora + 3600 };
  const firmado = await cliente.request<{ signedJwt: string }>({
    url: `https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/${CUENTA_SERVICIO}:signJwt`,
    method: 'POST',
    data: { payload: JSON.stringify(payload) },
  });
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: firmado.data.signedJwt,
    }),
  });
  const cuerpo = await res.json() as { access_token?: string; error?: string; error_description?: string };
  if (!res.ok || !cuerpo.access_token) {
    // unauthorized_client = la delegación de dominio no autoriza este alcance.
    throw new Error(`token ${res.status}: ${cuerpo.error ?? ''} ${cuerpo.error_description ?? ''}`.trim());
  }
  return cuerpo.access_token;
}

export class ErrorApi extends Error {
  constructor(public estado: number, mensaje: string) { super(mensaje); }
}

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function api<T>(token: string, metodo: string, ruta: string, cuerpo?: unknown): Promise<T> {
  for (let intento = 0; ; intento++) {
    const res = await fetch(API_CLASSROOM + ruta, {
      method: metodo,
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
    });
    if (res.ok) return (res.status === 204 ? undefined : await res.json()) as T;
    // 403 por cuota de velocidad y 429/5xx: se reintenta con espera; lo demás, no.
    const texto = await res.text();
    const porCuota = res.status === 429 || res.status >= 500 || (res.status === 403 && /rateLimit|quota/i.test(texto));
    if (porCuota && intento < 3) { await esperar(1000 * 2 ** intento); continue; }
    throw new ErrorApi(res.status, `${metodo} ${ruta.split('?')[0]} ${res.status}: ${texto.slice(0, 200)}`);
  }
}
