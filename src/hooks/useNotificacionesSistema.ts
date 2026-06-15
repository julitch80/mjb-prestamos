import { useEffect, useRef, useState } from 'react';
import { useAppStore } from '../data/store';

// Muestra notificaciones del sistema operativo (el "mensajito" en el borde de
// la pantalla) cuando llega un aviso NUEVO mientras la app está abierta.
//
// Usa la Notification API del navegador junto con el sondeo de notificaciones
// que ya hace App.tsx cada 30s. No requiere VAPID, service worker push ni
// cambios en el backend. Solo funciona con la app abierta (o la PWA instalada
// y en segundo plano), que es justo el alcance pedido.

const soportado = typeof window !== 'undefined' && 'Notification' in window;
const ICONO = `${import.meta.env.BASE_URL}mjb_escudo.png`;

export function useNotificacionesSistema() {
  const notificaciones = useAppStore((s) => s.notificaciones);
  const [permiso, setPermiso] = useState<NotificationPermission>(
    soportado ? Notification.permission : 'denied'
  );

  // null = todavía no se ha "sembrado" el conjunto base de esta sesión.
  // Las notificaciones presentes al cargar/activar NO disparan popup; solo
  // las que llegan después, mientras el usuario tiene la app abierta.
  const vistasRef = useRef<Set<string> | null>(null);

  async function solicitarPermiso() {
    if (!soportado) return 'denied' as NotificationPermission;
    try {
      const p = await Notification.requestPermission();
      setPermiso(p);
      return p;
    } catch {
      return Notification.permission;
    }
  }

  useEffect(() => {
    if (!soportado || permiso !== 'granted') return;

    // Primera pasada tras conceder permiso o tras cargar: sembrar las actuales.
    if (vistasRef.current === null) {
      vistasRef.current = new Set(notificaciones.map((n) => n.id));
      return;
    }

    const vistas = vistasRef.current;
    const nuevas = notificaciones.filter((n) => !vistas.has(n.id));
    nuevas.forEach((n) => vistas.add(n.id));

    const nuevasNoLeidas = nuevas.filter((n) => !n.leida);
    if (nuevasNoLeidas.length === 0) return;

    try {
      if (nuevasNoLeidas.length === 1) {
        const n = nuevasNoLeidas[0];
        new Notification('MJB Préstamos', {
          body: n.mensaje,
          icon: ICONO,
          tag: n.id, // evita duplicados del mismo aviso
        });
      } else {
        new Notification('MJB Préstamos', {
          body: `Tienes ${nuevasNoLeidas.length} avisos nuevos en el sistema.`,
          icon: ICONO,
        });
      }
    } catch {
      // si el navegador bloquea la construcción, lo ignoramos en silencio
    }
  }, [notificaciones, permiso]);

  return { permiso, solicitarPermiso, soportado };
}
