// Operaciones del chat interno sobre Firestore (Etapa 4 — Fase 3 del manual).
// Firebase-only y NO-DESTRUCTIVO: todas las funciones son no-op / seguras si
// `db` o `auth.currentUser` son null (modo pin / Firebase no configurado).
// La IDENTIDAD del chat es SIEMPRE auth.currentUser.email en minúsculas (NO el
// userId del store, que puede ser un id interno como 'julian').
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { useAppStore } from './store';

export type Canal = {
  id: string;
  name?: string;
  type: 'general' | 'rol' | 'directo' | 'segmento' | 'grupo';
  allowedRoles?: string[];
  members?: string[];
  sede?: string | null;
  jornada?: string | null;
  lastMessageAt?: any;
  lastMessagePreview?: string;
  lastMessageBy?: string;
  /** A1 — mensaje fijado del canal. Vive aquí (no en el mensaje) porque es
   * propiedad del canal: pintarlo no exige buscar el mensaje entre los
   * cargados. `null` para soltarlo. */
  fijado?: {
    messageId: string;
    text: string;
    autorNombre: string;
    fijadoPor: string;
    fijadoEn: any;
  } | null;
  /** A3 — canal de avisos: si es true, solo publican coordinador/rectora/
   * superusuario. Ausente se trata como false. */
  soloLectura?: boolean;
};

/**
 * Ids de los canales `segmento` a los que el usuario actual queda
 * suscrito automáticamente, dados su sede y jornada (o todos si es
 * directivo). Los ids son deterministas: seg__{sede}[__{jornada}].
 */
export function segmentosDe(sede: string, jornada: string, esDirectivoFlag: boolean): string[] {
  const SEDES = ['central', 'gustavo_rodas', 'la_finquita'];
  if (esDirectivoFlag) {
    const todos: string[] = [];
    for (const s of SEDES) {
      todos.push(`seg__${s}`, `seg__${s}__manana`, `seg__${s}__tarde`);
    }
    return todos;
  }
  const s = SEDES.includes(sede) ? sede : 'central';
  const ids = [`seg__${s}`];
  if (jornada === 'ambas') {
    ids.push(`seg__${s}__manana`, `seg__${s}__tarde`);
  } else if (jornada === 'tarde') {
    ids.push(`seg__${s}__tarde`);
  } else {
    ids.push(`seg__${s}__manana`);
  }
  return ids;
}

export type Mensaje = {
  id: string;
  authorEmail: string;
  authorName: string;
  text: string;
  createdAt: any;
  deleted: boolean;
  editedAt?: any;
  adjunto?: {
    tipo: 'imagen' | 'audio' | 'archivo';
    url: string;
    nombre: string;
    bytes: number;
    duracionSeg?: number;
  };
  /** D1 — copia (no referencia) del mensaje citado. Se guarda copia porque el
   * original puede estar borrado o fuera de los 50 mensajes cargados; el id
   * se conserva solo para saltar al original cuando sí está a la vista. */
  respondeA?: {
    id: string;
    autorNombre: string;
    extracto: string; // <= 120 caracteres
  };
  /** D2 — marca de reenvío. Nombres, no ids: es una etiqueta para el lector,
   * no un enlace (reenviar saca contenido de su contexto original). */
  reenviadoDe?: {
    canalNombre: string;
    autorNombre: string;
  };
};

/** C2 — lista cerrada de emojis de reacción. Cerrada a propósito (evita que
 * el chat institucional se convierta en otra cosa, y hay que poder validarla
 * en las reglas de Firestore). La interfaz debe usar esta constante en vez
 * de duplicar la lista. */
export const EMOJIS_REACCION = ['👍', '✅', '❤️', '😄', '🎉', '👀'] as const;
export type EmojiReaccion = (typeof EMOJIS_REACCION)[number];

export type Reaccion = {
  correo: string; // id del documento
  emoji: string;
  en: any;
};

/** Email del usuario actual (identidad del chat), en minúsculas. */
export function miEmail(): string {
  return auth?.currentUser?.email?.toLowerCase() ?? '';
}

/** Nombre visible del autor: preferimos el nombre del store, luego displayName. */
function miNombre(): string {
  const nombre = useAppStore.getState().nombre;
  return nombre || auth?.currentUser?.displayName || miEmail();
}

/** Id determinista de un canal directo entre dos correos. */
export function dmChannelId(a: string, b: string): string {
  return `dm__${[a, b].map((x) => x.toLowerCase()).sort().join('__')}`;
}

// ── Listeners de canales ────────────────────────────────────────────────────
// Combina hasta tres (o más, para superusuario) queries en una sola lista.
export function escucharCanales(
  miRol: string,
  onCanales: (canales: Canal[]) => void,
  miSede: string = 'central',
  miJornada: string = 'manana',
  esDirectivoFlag: boolean = false,
  // Los errores de los listeners se reportaban descartándolos en silencio, lo
  // que dejaba la lista de canales vacía sin ninguna pista de por qué. Ahora
  // suben a la interfaz para poder diagnosticar desde el propio teléfono.
  onError?: (detalle: string) => void,
): () => void {
  if (!db) {
    onError?.('Firebase no está configurado en esta compilación.');
    return () => {};
  }
  if (!auth?.currentUser) {
    onError?.('sin-sesion-firebase');
    return () => {};
  }
  const d = db;
  const email = miEmail();

  // Roles cuyos canales de tipo 'rol' puede ver el usuario. El superusuario ve
  // los de todos los roles operativos.
  const roles =
    miRol === 'superusuario'
      ? ['superusuario', 'coordinador', 'docente', 'rectora']
      : [miRol];

  // Mapa acumulador por grupo de query para poder fusionar sin duplicar.
  const buckets: Record<string, Canal[]> = {};
  const emit = () => {
    const vistos = new Map<string, Canal>();
    for (const key of Object.keys(buckets)) {
      for (const c of buckets[key]) vistos.set(c.id, c);
    }
    onCanales(Array.from(vistos.values()));
  };

  const unsubs: Array<() => void> = [];

  const attach = (key: string, q: any) => {
    unsubs.push(
      onSnapshot(
        q,
        (snap: any) => {
          buckets[key] = snap.docs.map((s: any) => ({ id: s.id, ...(s.data() as object) })) as Canal[];
          emit();
        },
        (err: any) => {
          onError?.(`${key}: ${err?.code || err?.message || 'error desconocido'}`);
          buckets[key] = [];
          emit();
        },
      ),
    );
  };

  attach('general', query(collection(d, 'channels'), where('type', '==', 'general')));

  roles.forEach((r) => {
    attach(
      `rol__${r}`,
      query(collection(d, 'channels'), where('type', '==', 'rol'), where('allowedRoles', 'array-contains', r)),
    );
  });

  attach(
    'directo',
    query(collection(d, 'channels'), where('type', '==', 'directo'), where('members', 'array-contains', email)),
  );

  attach(
    'grupo',
    query(collection(d, 'channels'), where('type', '==', 'grupo'), where('members', 'array-contains', email)),
  );

  // Canales de tipo 'segmento': no se consultan por query (evita problemas
  // de provabilidad en las reglas) — el cliente calcula los ids que le
  // corresponden y se suscribe por documento directo.
  segmentosDe(miSede, miJornada, esDirectivoFlag).forEach((segId) => {
    unsubs.push(
      onSnapshot(
        doc(d, 'channels', segId),
        (snap) => {
          buckets[`seg__${segId}`] = snap.exists() ? [{ id: snap.id, ...(snap.data() as object) } as Canal] : [];
          emit();
        },
        (err: any) => {
          onError?.(`${segId}: ${err?.code || err?.message || 'error desconocido'}`);
          buckets[`seg__${segId}`] = [];
          emit();
        },
      ),
    );
  });

  return () => unsubs.forEach((u) => u());
}

// ── Listener de mensajes de un canal ────────────────────────────────────────
export function escucharMensajes(
  channelId: string,
  onMensajes: (mensajes: Mensaje[]) => void,
): () => void {
  if (!db || !auth?.currentUser) return () => {};
  const q = query(
    collection(db, 'channels', channelId, 'messages'),
    orderBy('createdAt', 'desc'),
    limit(50),
  );
  return onSnapshot(
    q,
    (snap) => {
      const msgs = snap.docs.map((s) => ({ id: s.id, ...(s.data() as object) })) as Mensaje[];
      onMensajes(msgs.reverse()); // a orden ascendente (más antiguo arriba)
    },
    () => onMensajes([]),
  );
}

// ── Escritura de mensajes ────────────────────────────────────────────────────
export async function enviarMensaje(
  channelId: string,
  texto: string,
  adjunto?: Mensaje['adjunto'],
  respondeA?: Mensaje['respondeA'],
): Promise<void> {
  if (!db || !auth?.currentUser) return;
  const limpio = texto.slice(0, 4000);
  // Un mensaje necesita texto O adjunto; una nota de voz puede no traer texto.
  if (!limpio.trim() && !adjunto) return;
  await addDoc(collection(db, 'channels', channelId, 'messages'), {
    authorEmail: miEmail(),
    authorName: miNombre(),
    text: limpio,
    createdAt: serverTimestamp(),
    deleted: false,
    ...(adjunto ? { adjunto } : {}),
    ...(respondeA
      ? { respondeA: { id: respondeA.id, autorNombre: respondeA.autorNombre, extracto: respondeA.extracto.slice(0, 120) } }
      : {}),
  });
}

/**
 * D1 — construye la copia `respondeA` a partir del mensaje citado. Vive
 * aparte de `enviarMensaje` para que la interfaz arme el objeto sin
 * duplicar la regla del extracto de 120 caracteres.
 */
export function citarMensaje(mensaje: Mensaje): NonNullable<Mensaje['respondeA']> {
  return {
    id: mensaje.id,
    autorNombre: mensaje.authorName,
    extracto: (mensaje.text || '').slice(0, 120),
  };
}

/**
 * D2 — reenvía un mensaje a otro canal: crea un mensaje NUEVO (autor = quien
 * reenvía) en `destinoChannelId`, con `reenviadoDe` apuntando al canal y
 * autor originales (por nombre, no por id — es una etiqueta, no un enlace).
 * Conserva el adjunto si lo hay. No copia `respondeA` del original: la cita
 * pertenece al hilo de origen, no tiene sentido fuera de él.
 */
export async function reenviarMensaje(
  destinoChannelId: string,
  mensaje: Mensaje,
  canalOrigenNombre: string,
): Promise<void> {
  if (!db || !auth?.currentUser) return;
  await addDoc(collection(db, 'channels', destinoChannelId, 'messages'), {
    authorEmail: miEmail(),
    authorName: miNombre(),
    text: (mensaje.text || '').slice(0, 4000),
    createdAt: serverTimestamp(),
    deleted: false,
    ...(mensaje.adjunto ? { adjunto: mensaje.adjunto } : {}),
    reenviadoDe: {
      canalNombre: canalOrigenNombre,
      autorNombre: mensaje.authorName,
    },
  });
}

export async function editarMensaje(channelId: string, messageId: string, texto: string): Promise<void> {
  if (!db || !auth?.currentUser) return;
  await updateDoc(doc(db, 'channels', channelId, 'messages', messageId), {
    text: texto.slice(0, 4000),
    editedAt: serverTimestamp(),
  });
}

export async function borrarMensaje(channelId: string, messageId: string): Promise<void> {
  if (!db || !auth?.currentUser) return;
  await updateDoc(doc(db, 'channels', channelId, 'messages', messageId), { deleted: true });
}

// ── Canales directos (DM) ────────────────────────────────────────────────────
/** Crea (si no existe) el canal directo determinista y devuelve su id. */
export async function abrirDm(otroEmail: string): Promise<string> {
  const yo = miEmail();
  const otro = otroEmail.toLowerCase();
  const id = dmChannelId(yo, otro);
  if (!db || !auth?.currentUser) return id;
  await setDoc(doc(db, 'channels', id), {
    type: 'directo',
    members: [yo, otro].sort(),
    name: '',
    createdAt: serverTimestamp(),
    createdBy: yo,
  }).catch(() => {}); // ya existe = ok
  return id;
}

// ── Canales para superusuario ────────────────────────────────────────────────
export async function crearCanal(
  name: string,
  type: 'general' | 'rol',
  allowedRoles?: string[],
): Promise<string> {
  if (!db || !auth?.currentUser) throw new Error('Firebase no está configurado.');
  const id = `${type}__${Date.now()}`;
  await setDoc(doc(db, 'channels', id), {
    type,
    name: name.trim(),
    ...(type === 'rol' ? { allowedRoles: allowedRoles ?? [] } : {}),
    createdBy: miEmail(),
    createdAt: serverTimestamp(),
  });
  return id;
}

// ── Canales de grupo (miembros elegidos a dedo) ──────────────────────────────
/** Crea un canal de tipo 'grupo' con los miembros dados (+ el creador). Devuelve su id. */
export async function crearGrupo(nombre: string, miembros: string[]): Promise<string> {
  if (!db || !auth?.currentUser) throw new Error('Firebase no está configurado.');
  const yo = miEmail();
  const members = Array.from(new Set([...miembros.map((m) => m.toLowerCase()), yo]));
  const id = `grp__${Date.now()}`;
  await setDoc(doc(db, 'channels', id), {
    type: 'grupo',
    name: nombre.trim(),
    members,
    createdBy: yo,
    createdAt: serverTimestamp(),
  });
  return id;
}

// ── Directorio de usuarios para iniciar DM ───────────────────────────────────
export async function listarUsuariosParaDm(): Promise<Array<{ email: string; displayName: string }>> {
  if (!db) return [];
  const snap = await getDocs(collection(db, 'users'));
  return snap.docs
    .map((s) => s.data() as { email: string; displayName: string; active?: boolean })
    .filter((u) => u.active !== false && (u.email || '').toLowerCase() !== miEmail())
    .map((u) => ({ email: (u.email || '').toLowerCase(), displayName: u.displayName || u.email }))
    .sort((a, b) => (a.displayName || '').localeCompare(b.displayName || '', 'es'));
}

// ── Estados de lectura (no-leídos) ───────────────────────────────────────────
export async function marcarLeido(channelId: string): Promise<void> {
  if (!db || !auth?.currentUser) return;
  await setDoc(
    doc(db, 'users', miEmail(), 'readStates', channelId),
    { lastReadAt: serverTimestamp() },
    { merge: true },
  ).catch(() => {});
}

export async function cargarReadStates(): Promise<Record<string, any>> {
  if (!db || !auth?.currentUser) return {};
  const snap = await getDocs(collection(db, 'users', miEmail(), 'readStates'));
  const out: Record<string, any> = {};
  snap.docs.forEach((s) => {
    out[s.id] = (s.data() as { lastReadAt?: any }).lastReadAt;
  });
  return out;
}

// ── A1 — Mensajes fijados ────────────────────────────────────────────────────
// Vive en el canal (channels/{id}.fijado), no en el mensaje: el contrato dice
// que así se pinta sin buscar el mensaje entre los cargados. Puede fijar
// coordinador/rectora/superusuario; en 'directo' y 'grupo', cualquier miembro
// — esa distinción de permisos la aplican las reglas de Firestore, no aquí.
export async function fijarMensaje(channelId: string, mensaje: Mensaje): Promise<void> {
  if (!db || !auth?.currentUser) return;
  await updateDoc(doc(db, 'channels', channelId), {
    fijado: {
      messageId: mensaje.id,
      text: (mensaje.text || '').slice(0, 200),
      autorNombre: mensaje.authorName,
      fijadoPor: miEmail(),
      fijadoEn: serverTimestamp(),
    },
  });
}

export async function soltarFijado(channelId: string): Promise<void> {
  if (!db || !auth?.currentUser) return;
  await updateDoc(doc(db, 'channels', channelId), { fijado: null });
}

// ── A3 — Canal de avisos (solo lectura) ──────────────────────────────────────
const ROLES_PUBLICAN_EN_SOLO_LECTURA = ['coordinador', 'rectora', 'superusuario'];

/**
 * true si `miRol` puede publicar en `canal`. `soloLectura` ausente se trata
 * como false (canal normal). La interfaz usa esto para esconder el
 * compositor, no para hacer cumplir el permiso (eso lo hacen las reglas).
 */
export function puedePublicarEn(canal: Canal, miRol: string): boolean {
  if (!canal.soloLectura) return true;
  return ROLES_PUBLICAN_EN_SOLO_LECTURA.includes(miRol);
}

// ── C2 — Reacciones ──────────────────────────────────────────────────────────
// Decisión de rendimiento: NO se adjunta un listener por mensaje cargado (50
// mensajes = 50 suscripciones permanentes). En su lugar se escucha "bajo
// demanda": la interfaz llama a escucharReacciones() solo para el mensaje
// cuyo detalle/tira de reacciones esté visible en pantalla en un momento
// dado, y se desuscribe al dejar de verlo. Con treinta docentes reaccionando
// de forma esporádica esto es más que suficiente y evita pagar listeners de
// sobra en cada apertura de canal.
export function escucharReacciones(
  channelId: string,
  messageId: string,
  onReacciones: (reacciones: Reaccion[]) => void,
): () => void {
  if (!db || !auth?.currentUser) return () => {};
  const q = collection(db, 'channels', channelId, 'messages', messageId, 'reacciones');
  return onSnapshot(
    q,
    (snap) => {
      const out = snap.docs.map((s) => ({ correo: s.id, ...(s.data() as object) })) as Reaccion[];
      onReacciones(out);
    },
    () => onReacciones([]),
  );
}

/** Pone (o cambia) mi reacción propia. Un documento por persona: `{correo}` == mi correo. */
export async function ponerReaccion(channelId: string, messageId: string, emoji: EmojiReaccion): Promise<void> {
  if (!db || !auth?.currentUser) return;
  await setDoc(doc(db, 'channels', channelId, 'messages', messageId, 'reacciones', miEmail()), {
    emoji,
    en: serverTimestamp(),
  });
}

/** Quita mi reacción propia (borra el documento). */
export async function quitarReaccion(channelId: string, messageId: string): Promise<void> {
  if (!db || !auth?.currentUser) return;
  await deleteDoc(doc(db, 'channels', channelId, 'messages', messageId, 'reacciones', miEmail())).catch(() => {});
}

// ── B1 — "Leído por" (acuse dentro del canal, NO toca readStates) ───────────
// channels/{c}/lecturas/{correo} -> { hasta: <fecha del último mensaje visto> }
// Un documento por persona (no un campo compartido en el mensaje) porque con
// treinta docentes abriendo a la vez un campo compartido se pisa. Esto es
// ADICIONAL a readStates/marcarLeido, que sigue sirviendo a los no-leídos y
// no se toca.
export async function marcarLecturaCanal(channelId: string, hasta: any): Promise<void> {
  if (!db || !auth?.currentUser || !hasta) return;
  await setDoc(
    doc(db, 'channels', channelId, 'lecturas', miEmail()),
    { hasta },
    { merge: true },
  ).catch(() => {});
}

export type Lectura = { correo: string; hasta: any };

/**
 * Escucha las lecturas del canal (para poder mostrar "leído por N" en vivo).
 * Un solo listener por canal abierto — no uno por mensaje — igual que la
 * decisión de reacciones.
 */
export function escucharLecturas(channelId: string, onLecturas: (lecturas: Lectura[]) => void): () => void {
  if (!db || !auth?.currentUser) return () => {};
  const q = collection(db, 'channels', channelId, 'lecturas');
  return onSnapshot(
    q,
    (snap) => {
      const out = snap.docs.map((s) => ({ correo: s.id, ...(s.data() as object) })) as Lectura[];
      onLecturas(out);
    },
    () => onLecturas([]),
  );
}

/**
 * Cuenta cuántas de las `lecturas` dadas cubren `mensaje` (hasta >= createdAt
 * del mensaje). El numerador ("leído por 18"); el denominador ("de 32") NO
 * se calcula aquí — el contrato es explícito en que en canales 'general',
 * 'rol' y 'segmento' no hay lista de miembros de la que sacarlo, así que
 * inventar un porcentaje sería prometer más de lo que es. La interfaz decide
 * si tiene un denominador fiable (p. ej. canal.members.length en 'directo'/
 * 'grupo') y solo entonces lo muestra junto a este numerador.
 */
export function contarLecturasDe(mensaje: Mensaje, lecturas: Lectura[]): number {
  const msgMs = toMillis(mensaje.createdAt);
  if (!msgMs) return 0;
  return lecturas.filter((l) => toMillis(l.hasta) >= msgMs).length;
}

/** Convierte un Timestamp de Firestore (o valor suelto) a milisegundos. */
function toMillis(ts: any): number {
  if (!ts) return 0;
  if (typeof ts.toMillis === 'function') return ts.toMillis();
  if (typeof ts.seconds === 'number') return ts.seconds * 1000;
  if (ts instanceof Date) return ts.getTime();
  return 0;
}
