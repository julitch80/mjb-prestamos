// Store de Zustand para el chat interno (Etapa 4).
// Solo hace algo si AUTH_MODE === 'google' y Firebase está configurado; en
// modo pin todas las acciones son no-op y no se adjunta ningún listener.
import { create } from 'zustand';
import { auth, esperarAuth, firebaseConfigurado } from '../lib/firebase';
import { AUTH_MODE } from './authStore';
import {
  cargarReadStates,
  crearGrupo,
  enviarMensaje,
  escucharCanales,
  escucharMensajes,
  marcarLeido,
  type Canal,
  type Mensaje,
} from './chat';

/** Convierte un Timestamp de Firestore (o valor suelto) a milisegundos. */
function toMs(ts: any): number {
  if (!ts) return 0;
  if (typeof ts.toMillis === 'function') return ts.toMillis();
  if (typeof ts.seconds === 'number') return ts.seconds * 1000;
  if (ts instanceof Date) return ts.getTime();
  return 0;
}

const habilitado = () => AUTH_MODE === 'google' && firebaseConfigurado;

interface ChatState {
  canales: Canal[];
  mensajesPorCanal: Record<string, Mensaje[]>;
  readStates: Record<string, number>; // channelId -> ms de última lectura
  canalActivo: string | null;
  iniciado: boolean;
  /** Diagnóstico visible en la interfaz cuando no llega ningún canal. */
  errorCanales: string | null;
  /** Correo de la sesión de Firebase, o null si no hay ninguna. */
  emailSesion: string | null;

  initChat: (miRol: string, miSede?: string, miJornada?: string) => void;
  abrirCanal: (channelId: string) => void;
  cerrarChat: () => void;
  enviar: (texto: string, adjunto?: Mensaje['adjunto']) => Promise<void>;
  marcarLeidoLocal: (channelId: string) => void;
  noLeidos: (canal: Canal) => boolean;
  crearGrupoStore: (nombre: string, miembros: string[]) => Promise<string>;
}

const DIRECTIVOS = ['coordinador', 'rectora', 'superusuario'];

let unsubCanales: (() => void) | null = null;
let unsubMensajes: (() => void) | null = null;
// Clave del contexto ya inicializado (rol/sede/jornada). Si cambia — p. ej. al
// alternar Docente/Superusuario — hay que rehacer los listeners.
let claveIniciada: string | null = null;

export const useChatStore = create<ChatState>((set, get) => ({
  canales: [],
  mensajesPorCanal: {},
  readStates: {},
  canalActivo: null,
  iniciado: false,
  errorCanales: null,
  emailSesion: null,

  initChat: (miRol, miSede = 'central', miJornada = 'manana') => {
    if (!habilitado()) return;
    const clave = `${miRol}|${miSede}|${miJornada}`;
    if (claveIniciada === clave) return;
    claveIniciada = clave;
    set({ iniciado: true });
    void esperarAuth().then((haySesion) => {
      if (claveIniciada !== clave) return; // el contexto cambió mientras esperábamos
      set({ emailSesion: auth?.currentUser?.email?.toLowerCase() ?? null });
      if (!haySesion) {
        set({ errorCanales: 'sin-sesion-firebase' });
        return;
      }
      set({ errorCanales: null });
      // Estados de lectura iniciales (para badges de no-leídos).
      cargarReadStates()
        .then((raw) => {
          const rs: Record<string, number> = {};
          for (const k of Object.keys(raw)) rs[k] = toMs(raw[k]);
          set({ readStates: rs });
        })
        .catch(() => {});
      // Listener de canales.
      unsubCanales?.();
      unsubCanales = escucharCanales(
        miRol,
        (canales) => {
          canales.sort((a, b) => toMs(b.lastMessageAt) - toMs(a.lastMessageAt));
          set({ canales });
        },
        miSede,
        miJornada,
        DIRECTIVOS.includes(miRol),
        (detalle) => set({ errorCanales: detalle }),
      );
    });
  },

  abrirCanal: (channelId) => {
    if (!habilitado()) return;
    set({ canalActivo: channelId });
    unsubMensajes?.();
    unsubMensajes = escucharMensajes(channelId, (mensajes) => {
      set((s) => ({ mensajesPorCanal: { ...s.mensajesPorCanal, [channelId]: mensajes } }));
    });
    // Marcar leído (local + remoto).
    get().marcarLeidoLocal(channelId);
    marcarLeido(channelId).catch(() => {});
  },

  cerrarChat: () => {
    unsubCanales?.();
    unsubMensajes?.();
    unsubCanales = null;
    unsubMensajes = null;
    claveIniciada = null;
    set({
      canales: [],
      mensajesPorCanal: {},
      readStates: {},
      canalActivo: null,
      iniciado: false,
      errorCanales: null,
      emailSesion: null,
    });
  },

  enviar: async (texto, adjunto) => {
    const id = get().canalActivo;
    if (!id) return;
    await enviarMensaje(id, texto, adjunto);
  },

  marcarLeidoLocal: (channelId) => {
    set((s) => ({ readStates: { ...s.readStates, [channelId]: Date.now() } }));
  },

  noLeidos: (canal) => {
    const last = toMs(canal.lastMessageAt);
    if (!last) return false;
    const leido = get().readStates[canal.id] ?? 0;
    return last > leido && canal.id !== get().canalActivo;
  },

  crearGrupoStore: async (nombre, miembros) => {
    const id = await crearGrupo(nombre, miembros);
    return id;
  },
}));
