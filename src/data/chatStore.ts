// Store de Zustand para el chat interno (Etapa 4).
// Solo hace algo si AUTH_MODE === 'google' y Firebase está configurado; en
// modo pin todas las acciones son no-op y no se adjunta ningún listener.
import { create } from 'zustand';
import { auth, esperarAuth, firebaseConfigurado } from '../lib/firebase';
import { AUTH_MODE } from './authStore';
import {
  cargarReadStates,
  contarLecturasDe,
  crearGrupo,
  enviarMensaje,
  escucharCanales,
  escucharLecturas,
  escucharMensajes,
  escucharReacciones,
  fijarMensaje,
  marcarLecturaCanal,
  marcarLeido,
  ponerReaccion,
  puedePublicarEn,
  quitarReaccion,
  reenviarMensaje,
  soltarFijado,
  type Canal,
  type EmojiReaccion,
  type Lectura,
  type Mensaje,
  type Reaccion,
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
  /** B1 — lecturas del canal activo (channels/{c}/lecturas), correo -> hasta. */
  lecturasCanalActivo: Lectura[];
  /** C2 — reacciones de los mensajes actualmente "abiertos" (con detalle
   * visible). Solo se escuchan bajo demanda, ver comentario en abrirReacciones. */
  reaccionesPorMensaje: Record<string, Reaccion[]>;

  initChat: (miRol: string, miSede?: string, miJornada?: string) => void;
  abrirCanal: (channelId: string) => void;
  cerrarChat: () => void;
  enviar: (texto: string, adjunto?: Mensaje['adjunto'], respondeA?: Mensaje['respondeA']) => Promise<void>;
  reenviar: (destinoChannelId: string, mensaje: Mensaje, canalOrigenNombre: string) => Promise<void>;
  marcarLeidoLocal: (channelId: string) => void;
  noLeidos: (canal: Canal) => boolean;
  crearGrupoStore: (nombre: string, miembros: string[]) => Promise<string>;
  // A1 — fijados.
  fijar: (channelId: string, mensaje: Mensaje) => Promise<void>;
  soltarFijadoStore: (channelId: string) => Promise<void>;
  // A3 — canal de avisos.
  puedoPublicarEn: (canal: Canal, miRol: string) => boolean;
  // C2 — reacciones bajo demanda.
  abrirReacciones: (messageId: string) => void;
  cerrarReacciones: (messageId: string) => void;
  reaccionar: (messageId: string, emoji: EmojiReaccion) => Promise<void>;
  quitarMiReaccion: (messageId: string) => Promise<void>;
  // B1 — leído por.
  contarLeidoPor: (mensaje: Mensaje) => number;
}

const DIRECTIVOS = ['coordinador', 'rectora', 'superusuario'];

let unsubCanales: (() => void) | null = null;
let unsubMensajes: (() => void) | null = null;
// Hasta donde ya acusamos lectura en cada canal, en milisegundos. Evita
// reescribir el mismo acuse en cada snapshot (ver abrirCanal).
const acusadoHasta: Record<string, number> = {};
let unsubLecturas: (() => void) | null = null;
// Un unsub de reacciones por mensaje "abierto" (ver abrirReacciones). No hay
// uno por cada mensaje cargado — solo por los que la interfaz decide mostrar
// con detalle, siguiendo la decisión de rendimiento tomada en chat.ts.
const unsubsReacciones: Record<string, () => void> = {};
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
  lecturasCanalActivo: [],
  reaccionesPorMensaje: {},

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
    set({ canalActivo: channelId, lecturasCanalActivo: [] });
    unsubMensajes?.();
    unsubMensajes = escucharMensajes(channelId, (mensajes) => {
      set((s) => ({ mensajesPorCanal: { ...s.mensajesPorCanal, [channelId]: mensajes } }));
      // B1 — mi acuse de lectura del canal: "hasta" es la fecha del último
      // mensaje visto. Se actualiza mientras el canal sigue abierto y no solo al
      // entrar, porque si no "leído por" se queda congelado para quien deja el
      // chat abierto sin recargar.
      //
      // Pero SOLO cuando de verdad avanza. Este listener salta con cualquier
      // cambio de los 50 mensajes cargados —una edición, un borrado, el eco de
      // lo que uno mismo acaba de enviar—, y sin esta guarda cada uno de esos
      // saltos escribiría un acuse idéntico. Con treinta docentes con el canal
      // abierto, un solo mensaje nuevo serían treinta escrituras que a su vez
      // despiertan el listener de lecturas en los treinta.
      const ultimo = mensajes[mensajes.length - 1];
      const hastaMs = toMs(ultimo?.createdAt);
      if (ultimo && hastaMs > (acusadoHasta[channelId] ?? 0)) {
        acusadoHasta[channelId] = hastaMs;
        marcarLecturaCanal(channelId, ultimo.createdAt).catch(() => {});
      }
    });
    // Listener de lecturas del canal (para "leído por N").
    unsubLecturas?.();
    unsubLecturas = escucharLecturas(channelId, (lecturas) => set({ lecturasCanalActivo: lecturas }));
    // Marcar leído (local + remoto) — readStates, para los no-leídos. No se toca.
    get().marcarLeidoLocal(channelId);
    marcarLeido(channelId).catch(() => {});
  },

  cerrarChat: () => {
    unsubCanales?.();
    unsubMensajes?.();
    unsubLecturas?.();
    Object.values(unsubsReacciones).forEach((u) => u());
    for (const k of Object.keys(unsubsReacciones)) delete unsubsReacciones[k];
    unsubCanales = null;
    unsubMensajes = null;
    unsubLecturas = null;
    claveIniciada = null;
    // Al cerrar sesion cambia quien esta dentro: los acuses del anterior no
    // valen para el siguiente.
    for (const k of Object.keys(acusadoHasta)) delete acusadoHasta[k];
    set({
      canales: [],
      mensajesPorCanal: {},
      readStates: {},
      canalActivo: null,
      iniciado: false,
      errorCanales: null,
      emailSesion: null,
      lecturasCanalActivo: [],
      reaccionesPorMensaje: {},
    });
  },

  enviar: async (texto, adjunto, respondeA) => {
    const id = get().canalActivo;
    if (!id) return;
    await enviarMensaje(id, texto, adjunto, respondeA);
  },

  reenviar: async (destinoChannelId, mensaje, canalOrigenNombre) => {
    await reenviarMensaje(destinoChannelId, mensaje, canalOrigenNombre);
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

  // A1 — fijados.
  fijar: async (channelId, mensaje) => {
    await fijarMensaje(channelId, mensaje);
  },
  soltarFijadoStore: async (channelId) => {
    await soltarFijado(channelId);
  },

  // A3 — canal de avisos: pasa directo a chat.ts, expuesto aquí para que la
  // interfaz no importe de dos sitios distintos.
  puedoPublicarEn: (canal, miRol) => puedePublicarEn(canal, miRol),

  // C2 — reacciones bajo demanda: un listener por mensaje "abierto", no uno
  // por cada mensaje cargado (ver decisión de rendimiento en chat.ts).
  abrirReacciones: (messageId) => {
    if (unsubsReacciones[messageId]) return; // ya escuchando
    const channelId = get().canalActivo;
    if (!channelId) return;
    unsubsReacciones[messageId] = escucharReacciones(channelId, messageId, (reacciones) => {
      set((s) => ({ reaccionesPorMensaje: { ...s.reaccionesPorMensaje, [messageId]: reacciones } }));
    });
  },
  cerrarReacciones: (messageId) => {
    unsubsReacciones[messageId]?.();
    delete unsubsReacciones[messageId];
    set((s) => {
      const copia = { ...s.reaccionesPorMensaje };
      delete copia[messageId];
      return { reaccionesPorMensaje: copia };
    });
  },
  reaccionar: async (messageId, emoji) => {
    const channelId = get().canalActivo;
    if (!channelId) return;
    await ponerReaccion(channelId, messageId, emoji);
  },
  quitarMiReaccion: async (messageId) => {
    const channelId = get().canalActivo;
    if (!channelId) return;
    await quitarReaccion(channelId, messageId);
  },

  // B1 — leído por: numerador sobre las lecturas del canal activo.
  contarLeidoPor: (mensaje) => contarLecturasDe(mensaje, get().lecturasCanalActivo),
}));
