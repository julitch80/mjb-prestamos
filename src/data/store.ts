import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Notificacion, Reserva } from './api';
import type { HorarioModificado } from './horarioModificado';

export type VistaActual =
  | 'disponibilidad'
  | 'historial'
  | 'admin'
  | 'rectora'
  | 'horario'
  | 'editor'
  | 'asistente';

interface AppState {
  // Auth
  userId: string | null;
  nombre: string | null;
  rol: string | null;
  jornada: string | null;

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

  // Acciones auth
  setUsuario: (userId: string, nombre: string, rol: string, jornada: string) => void;
  cerrarSesion: () => void;

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
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      // Estado inicial
      userId: null,
      nombre: null,
      rol: null,
      jornada: null,
      vistaActual: 'disponibilidad',
      temaOscuro: true,
      notificaciones: [],
      notifCargadas: false,
      reservas: [],
      horariosModificados: [],

      // Auth
      setUsuario: (userId, nombre, rol, jornada) =>
        set({ userId, nombre, rol, jornada, vistaActual: 'disponibilidad' }),

      cerrarSesion: () =>
        set({
          userId: null,
          nombre: null,
          rol: null,
          jornada: null,
          notificaciones: [],
          notifCargadas: false,
          reservas: [],
          vistaActual: 'disponibilidad',
        }),

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
      agregarHorarioModificado: (hm) =>
        set((s) => ({ horariosModificados: [hm, ...s.horariosModificados] })),

      actualizarHorarioModificado: (id, cambios) =>
        set((s) => ({
          horariosModificados: s.horariosModificados.map((h) =>
            h.id === id ? { ...h, ...cambios } : h
          ),
        })),

      eliminarHorarioModificado: (id) =>
        set((s) => ({
          horariosModificados: s.horariosModificados.filter((h) => h.id !== id),
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
        temaOscuro: s.temaOscuro,
        horariosModificados: s.horariosModificados,
      }),
    }
  )
);
