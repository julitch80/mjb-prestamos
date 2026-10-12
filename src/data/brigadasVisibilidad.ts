import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAppStore } from './store';
import { esDirectivo } from './maestros';

/**
 * Temporal: mientras las brigadas 2026 están «en revisión», además de rectora, coordinadores y
 * superusuario las ven los editores de simulacros (slots de Julián y Hugo).
 */
export const SLOTS_LIDERES_BRIGADAS = ['julian', 'hugo'];

export function esPrivilegiadoBrigadas(rol: string | null, userId: string | null): boolean {
  return esDirectivo(rol) || (!!userId && SLOTS_LIDERES_BRIGADAS.includes(userId));
}

/** Doc `riesgoConfig/visibilidad` { brigadasPublicas }. Ausente o false => restringido. */
export function useBrigadasVisibles() {
  const userId = useAppStore(s => s.userId);
  const rol = useAppStore(s => s.rol);
  const [publicas, setPublicas] = useState(false);
  const [cargando, setCargando] = useState(!!db);

  useEffect(() => {
    if (!db) { setCargando(false); return; }
    return onSnapshot(
      doc(db, 'riesgoConfig', 'visibilidad'),
      (s) => { setPublicas(s.exists() && s.data()?.brigadasPublicas === true); setCargando(false); },
      () => { setPublicas(false); setCargando(false); },
    );
  }, []);

  const privilegiado = esPrivilegiadoBrigadas(rol, userId);
  return { visible: privilegiado || publicas, cargando, publicas, privilegiado };
}
