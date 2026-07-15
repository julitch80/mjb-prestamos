// Gestión de usuarios en Firestore (Etapa 3 — Panel de superusuario).
// Firebase-only: todas las funciones lanzan un Error claro si `db` es null
// (modo pin / Firebase no configurado). No se usan en modo pin porque el
// panel solo se monta cuando el rol es 'superusuario' (solo en modo google).
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../lib/firebase';

const DOMAIN = 'iemanueljbetancur.edu.co';

export type RolUsuario = 'docente' | 'coordinador' | 'superusuario';

export interface UsuarioFirestore {
  email: string;
  displayName: string;
  role: RolUsuario;
  active: boolean;
  createdBy?: string;
  replacedBy?: string | null;
  uid?: string | null;
}

function reqDb() {
  if (!db) throw new Error('Firebase no está configurado.');
  return db;
}

export async function listarUsuarios(): Promise<UsuarioFirestore[]> {
  const d = reqDb();
  // Sin orderBy en el query para no depender de un índice; ordenamos en cliente.
  const snap = await getDocs(collection(d, 'users'));
  return snap.docs
    .map((s) => s.data() as UsuarioFirestore)
    .sort((a, b) => (a.displayName || '').localeCompare(b.displayName || '', 'es'));
}

export async function crearDocente(
  email: string,
  displayName: string,
  role: string,
  creadoPor: string,
) {
  const d = reqDb();
  const id = email.toLowerCase().trim();
  if (!id.endsWith('@' + DOMAIN)) throw new Error('Correo fuera del dominio institucional.');
  if (!displayName.trim()) throw new Error('El nombre es obligatorio.');
  if ((await getDoc(doc(d, 'users', id))).exists()) throw new Error('Ese docente ya existe.');
  await setDoc(doc(d, 'users', id), {
    email: id,
    displayName: displayName.trim(),
    role,
    active: true,
    createdAt: serverTimestamp(),
    createdBy: creadoPor,
    uid: null,
    replacedBy: null,
  });
}

export async function cambiarRol(email: string, role: string) {
  await updateDoc(doc(reqDb(), 'users', email.toLowerCase()), { role });
}

export async function setActivo(email: string, active: boolean) {
  await updateDoc(doc(reqDb(), 'users', email.toLowerCase()), { active });
}
