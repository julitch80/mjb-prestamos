// Operaciones del chat interno sobre Firestore (Etapa 4 — Fase 3 del manual).
// Firebase-only y NO-DESTRUCTIVO: todas las funciones son no-op / seguras si
// `db` o `auth.currentUser` son null (modo pin / Firebase no configurado).
// La IDENTIDAD del chat es SIEMPRE auth.currentUser.email en minúsculas (NO el
// userId del store, que puede ser un id interno como 'julian').
import {
  addDoc,
  collection,
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
};

/**
 * Ids de los canales `segmento` a los que el usuario actual queda
 * suscrito automáticamente, dados su sede y jornada (o todos si es
 * directivo). Los ids son deterministas: seg__{sede}[__{jornada}].
 */
export function segmentosDe(sede: string, jornada: string, esDirectivoFlag: boolean): string[] {
  const SEDES = ['central', 'gustavo_rojas', 'la_finquita'];
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
): () => void {
  if (!db || !auth?.currentUser) return () => {};
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
        () => {
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
        () => {
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
export async function enviarMensaje(channelId: string, texto: string): Promise<void> {
  if (!db || !auth?.currentUser) return;
  const limpio = texto.slice(0, 4000);
  if (!limpio.trim()) return;
  await addDoc(collection(db, 'channels', channelId, 'messages'), {
    authorEmail: miEmail(),
    authorName: miNombre(),
    text: limpio,
    createdAt: serverTimestamp(),
    deleted: false,
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
