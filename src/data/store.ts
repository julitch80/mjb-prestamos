import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Notificacion, Reserva } from './api';
import type { HorarioModificado, JornadaReducida } from './horarioModificado';
import type { PublicacionPendiente } from './publicacion';
import { esDirectivo, sedeDeUsuario, type SedeId } from './maestros';
import { pushModificacion, pushJornada, pushBorrado } from './syncEditor';

export type VistaActual =
  | 'disponibilidad'
  | 'historial'
  | 'admin'
  | 'rectora'
  | 'horario'
  | 'asignacion'
  | 'tareas'
  | 'editor'
  | 'asistente'
  | 'admin_users'
  | 'chat'
  | 'agenda'
  | 'riesgo'
  | 'asistentes';

interface AppState {
  // Auth
  userId: string | null;
  nombre: string | null;
  rol: string | null;
  jornada: string | null;

  // Sede activa (Fase A — arquitectura multi-sede). Default 'central'.
  sedeActual: SedeId;

  // Navegación — en Zustand para persistir entre re-renders
  vistaActual: VistaActual;

  // Tema
  temaOscuro: boolean;

  // Notificaciones
  notificaciones: Notificacion[];
  notifCargadas: boolean;

  // Reservas (caché local)
  reservas: Reserva[];

  // Horarios modificados (ediciones temporales del coordinador)
  horariosModificados: HorarioModificado[];

  // Jornadas reducidas (acortar día por acto cívico)
  jornadasReducidas: JornadaReducida[];

  // Publicaciones para el Google Site del colegio (con aprobación del coord)
  publicacionesPendientes: PublicacionPendiente[];

  // Acciones auth
  setUsuario: (userId: string, nombre: string, rol: string, jornada: string) => void;
  cerrarSesion: () => void;

  // Acciones sede
  setSedeActual: (sede: SedeId) => void;

  // Acciones navegación
  setVistaActual: (vista: VistaActual) => void;

  // Acciones tema
  toggleTema: () => void;

  // Acciones notificaciones
  setNotificaciones: (notifs: Notificacion[]) => void;
  marcarNotifLeida: (id: string) => void;
  marcarTodasLeidas: () => void;

  // Acciones reservas
  setReservas: (reservas: Reserva[]) => void;
  agregarReserva: (reserva: Reserva) => void;
  actualizarReserva: (id: string, cambios: Partial<Reserva>) => void;

  // Acciones horarios modificados
  agregarHorarioModificado: (hm: HorarioModificado) => void;
  actualizarHorarioModificado: (id: string, cambios: Partial<HorarioModificado>) => void;
  eliminarHorarioModificado: (id: string) => void;

  // Acciones jornadas reducidas
  agregarJornadaReducida: (jr: JornadaReducida) => void;
  eliminarJornadaReducida: (id: string) => void;

  // Fusión con lo publicado en el backend (llamado por el polling en App.tsx)
  mergeSync: (modificaciones: HorarioModificado[], jornadas: JornadaReducida[]) => void;

  // Acciones publicaciones pendientes
  agregarPublicacionPendiente: (p: PublicacionPendiente) => void;
  actualizarPublicacionPendiente: (id: string, cambios: Partial<PublicacionPendiente>) => void;
  eliminarPublicacionPendiente: (id: string) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      // Estado inicial
      userId: null,
      nombre: null,
      rol: null,
      jornada: null,
      sedeActual: 'central',
      vistaActual: 'disponibilidad',
      temaOscuro: true,
      notificaciones: [],
      notifCargadas: false,
      reservas: [],
      horariosModificados: [],
      jornadasReducidas: [],
      publicacionesPendientes: [],

      // Auth
      setUsuario: (userId, nombre, rol, jornada) =>
        set((s) => ({
          userId,
          nombre,
          rol,
          jornada,
          vistaActual: 'disponibilidad',
          // Docentes quedan fijos en su propia sede; directivos eligen con el
          // selector (SelectorSede), así que no se les toca aquí.
          sedeActual: esDirectivo(rol) ? s.sedeActual : sedeDeUsuario(userId),
        })),

      setSedeActual: (sede) => set({ sedeActual: sede }),

      cerrarSesion: () => {
        set({
          userId: null,
          nombre: null,
          rol: null,
          jornada: null,
          notificaciones: [],
          notifCargadas: false,
          reservas: [],
          vistaActual: 'disponibilidad',
        });
        // En modo Google (Etapa 2) también cierra la sesión de Firebase Auth.
        // Import dinámico para evitar ciclo store <-> authStore; no-op en modo pin.
        if ((import.meta.env.VITE_AUTH_MODE as string) === 'google') {
          import('../lib/auth').then(({ cerrarSesionGoogle }) => {
            cerrarSesionGoogle().catch(() => {});
          }).catch(() => {});
        }
      },

      // Navegación
      setVistaActual: (vista) => set({ vistaActual: vista }),

      // Tema
      toggleTema: () => set((s) => ({ temaOscuro: !s.temaOscuro })),

      // Notificaciones
      setNotificaciones: (notificaciones) => set({ notificaciones, notifCargadas: true }),

      marcarNotifLeida: (id) =>
        set((s) => ({
          notificaciones: s.notificaciones.map((n) =>
            n.id === id ? { ...n, leida: true } : n
          ),
        })),

      marcarTodasLeidas: () =>
        set((s) => ({
          notificaciones: s.notificaciones.map((n) => ({ ...n, leida: true })),
        })),

      // Reservas
      setReservas: (reservas) => set({ reservas }),

      agregarReserva: (reserva) =>
        set((s) => ({ reservas: [reserva, ...s.reservas] })),

      actualizarReserva: (id, cambios) =>
        set((s) => ({
          reservas: s.reservas.map((r) => (r.id === id ? { ...r, ...cambios } : r)),
        })),

      // Horarios modificados
      agregarHorarioModificado: (hm) => {
        set((s) => ({ horariosModificados: [hm, ...s.horariosModificados] }));
        pushModificacion(hm);
      },

      actualizarHorarioModificado: (id, cambios) => {
        set((s) => ({
          horariosModificados: s.horariosModificados.map((h) =>
            h.id === id ? { ...h, ...cambios } : h
          ),
        }));
        const actualizado = useAppStore.getState().horariosModificados.find((h) => h.id === id);
        if (actualizado) pushModificacion(actualizado);
      },

      eliminarHorarioModificado: (id) => {
        set((s) => ({
          horariosModificados: s.horariosModificados.filter((h) => h.id !== id),
        }));
        pushBorrado(id);
      },

      // Jornadas reducidas
      agregarJornadaReducida: (jr) => {
        set((s) => ({ jornadasReducidas: [jr, ...s.jornadasReducidas] }));
        pushJornada(jr);
      },

      eliminarJornadaReducida: (id) => {
        set((s) => ({
          jornadasReducidas: s.jornadasReducidas.filter((j) => j.id !== id),
        }));
        pushBorrado(id);
      },

      // Fusión con el backend: el servidor reemplaza los items locales con el
      // mismo id; los borradores locales que no están en el servidor (aún no
      // guardados/publicados) se conservan tal cual.
      mergeSync: (modificaciones, jornadas) =>
        set((s) => {
          const idsServidorHm = new Set(modificaciones.map((h) => h.id));
          const localesSoloBorrador = s.horariosModificados.filter(
            (h) => !idsServidorHm.has(h.id)
          );
          const idsServidorJr = new Set(jornadas.map((j) => j.id));
          const localesJr = s.jornadasReducidas.filter((j) => !idsServidorJr.has(j.id));
          return {
            horariosModificados: [...modificaciones, ...localesSoloBorrador],
            jornadasReducidas: [...jornadas, ...localesJr],
          };
        }),

      // Publicaciones pendientes
      agregarPublicacionPendiente: (p) =>
        set((s) => ({ publicacionesPendientes: [p, ...s.publicacionesPendientes] })),

      actualizarPublicacionPendiente: (id, cambios) =>
        set((s) => ({
          publicacionesPendientes: s.publicacionesPendientes.map((p) =>
            p.id === id ? { ...p, ...cambios } : p
          ),
        })),

      eliminarPublicacionPendiente: (id) =>
        set((s) => ({
          publicacionesPendientes: s.publicacionesPendientes.filter((p) => p.id !== id),
        })),
    }),
    {
      name: 'mjb-app-storage',
      // Solo persistir sesión y tema — las reservas se recargan del servidor
      partialize: (s) => ({
        userId: s.userId,
        nombre: s.nombre,
        rol: s.rol,
        jornada: s.jornada,
        sedeActual: s.sedeActual,
        temaOscuro: s.temaOscuro,
        horariosModificados: s.horariosModificados,
        jornadasReducidas: s.jornadasReducidas,
        publicacionesPendientes: s.publicacionesPendientes,
      }),
    }
  )
);
