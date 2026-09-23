// La agenda pública del estudiante se instala como SU PROPIA aplicación («Agenda MJB»),
// no como la aplicación del colegio con inicio de sesión (Julián, 23-sep-2026): un
// estudiante que la instalaba desde el QR caía en la pantalla de login y no podía entrar.
//
// Cómo: si la página abre en `#/agenda…`, se cambia el <link rel="manifest"> por
// public/agenda.webmanifest ANTES de que el navegador decida si ofrece instalar. Ese
// manifiesto arranca en `#/agenda` (sin grupo) y la agenda recuerda el último grupo
// abierto en este teléfono, así un solo manifiesto sirve para todos los grupos.
// Tiene otro `id`, así que convive con la aplicación del docente si el mismo teléfono
// tiene las dos.

const CLAVE_GRUPO = 'mjb:agenda:ultimoGrupo';

export function esRutaAgenda(hash: string = typeof location !== 'undefined' ? location.hash : ''): boolean {
  return /^#\/agenda(\/|$)/.test(hash);
}

export function usarManifiestoDeAgenda(): void {
  if (typeof document === 'undefined' || !esRutaAgenda()) return;
  const href = `${import.meta.env.BASE_URL}agenda.webmanifest`;
  let link = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
  if (!link) {
    link = document.createElement('link');
    link.rel = 'manifest';
    document.head.appendChild(link);
  }
  link.href = href;
  document.title = 'Agenda MJB';
  let apple = document.querySelector<HTMLMetaElement>('meta[name="apple-mobile-web-app-title"]');
  if (!apple) {
    apple = document.createElement('meta');
    apple.name = 'apple-mobile-web-app-title';
    document.head.appendChild(apple);
  }
  apple.content = 'Agenda MJB';
}

export function recordarGrupo(grupo: string): void {
  try { localStorage.setItem(CLAVE_GRUPO, grupo); } catch { /* sin almacenamiento: no pasa nada */ }
}

export function grupoRecordado(): string | null {
  try { return localStorage.getItem(CLAVE_GRUPO); } catch { return null; }
}
