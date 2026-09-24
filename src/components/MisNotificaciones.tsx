// «Mis notificaciones» (Etapa 1 — docs/notificaciones-push/PRD.md). Estado del
// dispositivo (activo/no), interruptores por categoría y notas de contexto
// (silencio nocturno, iPhone). Casos/evasión solo se ven para
// coordinador/rectora/superusuario (son categorías que Etapa 2 activará).
import { useEffect, useState } from 'react';
import { useAppStore } from '../data/store';
import {
  activar, desactivarEsteDispositivo, guardarPreferencias, leerPreferencias, soportado,
} from '../data/notificacionesPush';
import { PREFERENCIAS_DEFAULT, type CategoriaNotificacion, type PreferenciasNotif } from '../data/notificacionesPushLogica';
import { IconoCampana } from './IconosNeon';

const CATEGORIAS: { id: CategoriaNotificacion; label: string; descripcion: string; soloDirectivos?: boolean }[] = [
  { id: 'chat', label: 'Mensajes del chat', descripcion: 'Cuando te escriben en un canal que puedes ver' },
  { id: 'avisos', label: 'Avisos de coordinación y rectoría', descripcion: 'Rectoría, coordinación e intercambios de espacio' },
  { id: 'horario', label: 'Cambios en mi horario', descripcion: 'Cuando tu horario se modifica temporalmente' },
  { id: 'reservas', label: 'Mis reservas', descripcion: 'Aprobada, rechazada o cancelada' },
  { id: 'sugerencias', label: 'Respuesta a mi sugerencia', descripcion: 'Cuando te responden lo que reportaste' },
  { id: 'casos', label: 'Casos de permanencia', descripcion: 'Nuevos, vencidos o remitidos', soloDirectivos: true },
  { id: 'evasion', label: 'Posible evasión', descripcion: 'Alertas de evasión escolar', soloDirectivos: true },
];

export default function MisNotificaciones() {
  const rol = useAppStore(s => s.rol);
  const esDirectivo = rol === 'coordinador' || rol === 'rectora' || rol === 'superusuario';

  const [disponible, setDisponible] = useState(false);
  const [permiso, setPermiso] = useState<NotificationPermission>('default');
  const [cargando, setCargando] = useState(false);
  const [prefs, setPrefs] = useState<PreferenciasNotif>(PREFERENCIAS_DEFAULT);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    void (async () => {
      setDisponible(await soportado());
      setPermiso(typeof Notification !== 'undefined' ? Notification.permission : 'default');
      setPrefs(await leerPreferencias());
    })();
  }, []);

  async function alActivar() {
    setCargando(true);
    try {
      const res = await activar();
      setPermiso(res);
    } finally {
      setCargando(false);
    }
  }

  async function alDesactivar() {
    setCargando(true);
    try {
      await desactivarEsteDispositivo();
      setPermiso('default');
    } finally {
      setCargando(false);
    }
  }

  async function alCambiar(categoria: CategoriaNotificacion, valor: boolean) {
    const nuevas = { ...prefs, [categoria]: valor };
    setPrefs(nuevas);
    setGuardando(true);
    try {
      await guardarPreferencias(nuevas);
    } finally {
      setGuardando(false);
    }
  }

  const esIOS = typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent);
  const activo = permiso === 'granted';

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-strong flex items-center gap-2">
          <IconoCampana className="w-5 h-5" />
          Mis notificaciones
        </h1>
        <p className="text-muted text-xs mt-0.5">Qué te avisa la aplicación en el celular, aunque esté cerrada.</p>
      </div>

      <div className="bg-card rounded-xl p-4 border border-line space-y-3">
        {!disponible ? (
          <p className="text-muted text-sm">
            Este navegador no admite notificaciones push
            {esIOS ? ': en iPhone solo funcionan si agregas la aplicación a la pantalla de inicio (iOS 16.4 o más reciente).' : '.'}
          </p>
        ) : (
          <>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-strong text-sm font-semibold">Este dispositivo</p>
                <p className="text-muted text-xs mt-0.5">
                  {activo ? 'Activo — recibe notificaciones' : permiso === 'denied' ? 'Bloqueado en el navegador' : 'No activo'}
                </p>
              </div>
              {activo ? (
                <button
                  onClick={alDesactivar}
                  disabled={cargando}
                  className="px-3 py-2 rounded-lg bg-elevated text-soft hover:text-strong text-sm font-semibold disabled:opacity-40 whitespace-nowrap"
                >
                  Desactivar aquí
                </button>
              ) : (
                <button
                  onClick={alActivar}
                  disabled={cargando || permiso === 'denied'}
                  className="px-3 py-2 rounded-lg bg-accent text-accent-fg text-sm font-semibold disabled:opacity-40 whitespace-nowrap"
                >
                  Activar
                </button>
              )}
            </div>
            {permiso === 'denied' && (
              <p className="text-muted text-xs">
                Bloqueaste el permiso antes. Actívalo desde los ajustes de notificaciones del navegador para este sitio.
              </p>
            )}
          </>
        )}
      </div>

      <div className="bg-card rounded-xl p-4 border border-line space-y-1">
        <p className="text-strong text-sm font-semibold mb-2">Qué te avisa</p>
        {CATEGORIAS.filter(c => !c.soloDirectivos || esDirectivo).map(c => (
          <label key={c.id} className="flex items-center justify-between gap-3 py-2 border-b border-line last:border-0">
            <span>
              <span className="block text-strong text-sm">{c.label}</span>
              <span className="block text-muted text-xs mt-0.5">{c.descripcion}</span>
            </span>
            <input
              type="checkbox"
              checked={prefs[c.id]}
              disabled={guardando}
              onChange={e => alCambiar(c.id, e.target.checked)}
              className="w-5 h-5 accent-current flex-shrink-0"
            />
          </label>
        ))}
      </div>

      <div className="text-muted text-xs space-y-1 px-1">
        <p>Nada llega entre las 9:00 p. m. y las 5:30 a. m.: lo que ocurra en ese lapso se entrega a las 5:30 a. m.</p>
        <p>En iPhone, solo con la aplicación agregada a la pantalla de inicio (iOS 16.4 o más reciente).</p>
      </div>
    </div>
  );
}
