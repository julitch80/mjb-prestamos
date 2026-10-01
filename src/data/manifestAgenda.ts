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

import { detectarPlataforma, yaInstalada } from './installPrompt';

// iPhone: si la página declara un manifiesto, «Agregar a inicio» usa el start_url del
// manifiesto (no la URL actual) y el grupo del QR se pierde → el ícono abría la app
// completa con login. Por eso en iOS NO se declara manifiesto en la agenda: Safari guarda
// la URL actual, que es la entrada estática public/agenda/index.html con ?g=<grupo>
// (el hash `#/agenda/…` no es fiable en iOS).

const CLAVE_GRUPO = 'mjb:agenda:ultimoGrupo';

export function esRutaAgenda(hash: string = typeof location !== 'undefined' ? location.hash : ''): boolean {
  return /^#\/agenda(\/|$)/.test(hash);
}

export function usarManifiestoDeAgenda(): void {
  if (typeof document === 'undefined' || !esRutaAgenda()) return;
  if (detectarPlataforma() === 'ios') {
    document.querySelector('link[rel="manifest"]')?.remove();
    document.title = 'Agenda MJB';
    return;
  }
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

/**
 * iPhone en Safari (no instalada): deja la barra en `<base>agenda/?g=<grupo>` para que
 * «Agregar a inicio» guarde esa URL. Recargar ahí pasa por public/agenda/index.html,
 * que redirige de vuelta a la agenda.
 */
export function fijarUrlParaIOS(grupo: string): void {
  if (typeof window === 'undefined' || detectarPlataforma() !== 'ios' || yaInstalada()) return;
  try {
    window.history.replaceState(null, '', `${import.meta.env.BASE_URL}agenda/?g=${encodeURIComponent(grupo)}`);
  } catch { /* nada */ }
}

export function grupoRecordado(): string | null {
  try { return localStorage.getItem(CLAVE_GRUPO); } catch { return null; }
}
