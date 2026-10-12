import { useEffect, useState } from 'react';
import { collection, doc, limit, onSnapshot, orderBy, query } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../../lib/firebase';
import type { CambioSimulacro, SimulacroDoc } from '../../data/simulacros/logica';

export type SimulacroConId = SimulacroDoc & { id: string };

/** Lista de simulacros en vivo (las reglas de Firestore deciden qué estados puede leer cada quien). */
export function useListaSimulacros() {
  const [lista, setLista] = useState<SimulacroConId[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!db) { setLista([]); return; }
    return onSnapshot(
      collection(db, 'simulacros'),
      (snap) => {
        setError(null);
        setLista(snap.docs.map(d => ({ id: d.id, ...(d.data() as SimulacroDoc) })));
      },
      (e) => { setError(e.message); setLista([]); },
    );
  }, []);

  return { lista, error };
}

/** Un simulacro en vivo. null = cargando; undefined = no existe. */
export function useSimulacro(id: string | null) {
  const [sim, setSim] = useState<SimulacroConId | null | undefined>(null);

  useEffect(() => {
    setSim(null);
    if (!id || !db) return;
    return onSnapshot(
      doc(db, 'simulacros', id),
      (s) => setSim(s.exists() ? { id: s.id, ...(s.data() as SimulacroDoc) } : undefined),
      () => setSim(undefined),
    );
  }, [id]);

  return sim;
}

/** Últimos cambios (registro). */
export function useCambios(id: string | null, max = 20) {
  const [cambios, setCambios] = useState<CambioSimulacro[]>([]);

  useEffect(() => {
    setCambios([]);
    if (!id || !db) return;
    const q = query(collection(db, 'simulacros', id, 'cambios'), orderBy('cuando', 'desc'), limit(max));
    return onSnapshot(
      q,
      (snap) => setCambios(snap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<CambioSimulacro, 'id'>) }))),
      () => setCambios([]),
    );
  }, [id, max]);

  return cambios;
}

export type AccionSimulacro =
  | { accion: 'crear'; id: string; datos: Record<string, unknown> }
  | { accion: 'hora'; jornada: string; hora: string; fecha: string; motivo?: string }
  | { accion: 'asignar'; jornada: string; puestoId: string; slot: string | null; porConfirmar?: boolean; puestoNombre?: string }
  | { accion: 'llamada123'; jornada: string }
  | { accion: 'avisoGuardar'; avisoId?: string; texto: string; jornada: string; tipo: string }
  | { accion: 'avisoBorrar'; avisoId: string }
  | { accion: 'estado'; estado: string };

/** Llama a la función del servidor. Devuelve null si salió bien o el texto del error. */
export async function simulacroCambiar(simulacroId: string, a: AccionSimulacro): Promise<string | null> {
  if (!functions) return 'Firebase no está configurado en esta instalación.';
  try {
    await httpsCallable(functions, 'simulacroCambiar')({ simulacroId, ...a });
    return null;
  } catch (e) {
    return (e as Error).message || 'No se pudo guardar el cambio.';
  }
}
