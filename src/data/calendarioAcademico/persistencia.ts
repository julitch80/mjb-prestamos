// Lectura en vivo y escritura de calendarioAcademico/2026 (con la semilla como respaldo).
import { useCallback, useEffect, useMemo, useState } from 'react';
import { collection, doc, onSnapshot, orderBy, query, limit, writeBatch, getDocs } from 'firebase/firestore';
import { auth, db } from '../../lib/firebase';
import { AUTH_MODE } from '../authStore';
import { useAppStore } from '../store';
import { SEMILLA_2026 } from './semilla2026';
import type { EventoCal } from './tipos';

export const ANIO = '2026';

const limpio = <T,>(x: T): T => JSON.parse(JSON.stringify(x)) as T;
const miCorreo = () => auth?.currentUser?.email?.toLowerCase() ?? '';

export interface RegistroCambio {
  id: string; por: string; cuando: string; eventoId: string;
  antes: EventoCal | null; despues: EventoCal | null; motivo: string;
}

/** Calendario efectivo: lo de Firestore si existe; si no, la semilla (solo lectura en modo PIN). */
export function useCalendario() {
  const rol = useAppStore(s => s.rol);
  const [eventosFs, setEventosFs] = useState<EventoCal[] | null>(null);
  const conFirebase = AUTH_MODE === 'google' && !!db;

  useEffect(() => {
    if (!conFirebase || !db) return;
    return onSnapshot(doc(db, 'calendarioAcademico', ANIO), snap => {
      const m = snap.exists() ? (snap.data().eventos as Record<string, EventoCal> | undefined) : undefined;
      setEventosFs(m ? Object.values(m) : null);
    }, () => setEventosFs(null));
  }, [conFirebase]);

  const eventos = eventosFs ?? SEMILLA_2026;
  const puedeEditar = conFirebase && (rol === 'coordinador' || rol === 'rectora' || rol === 'superusuario');

  const guardar = useCallback(async (antes: EventoCal | null, despues: EventoCal | null, motivo: string) => {
    if (!db || !puedeEditar) throw new Error('No tienes permiso para editar el calendario.');
    const mapa: Record<string, EventoCal> = {};
    for (const e of eventos) mapa[e.id] = e;
    const ahora = new Date().toISOString();
    if (despues) {
      const cambio = antes && (antes.desde !== despues.desde || antes.hasta !== despues.hasta
        || !!antes.porDefinir !== !!despues.porDefinir || !!antes.noSeRealiza !== !!despues.noSeRealiza)
        ? { antes: { desde: antes.desde, hasta: antes.hasta, porDefinir: antes.porDefinir, noSeRealiza: antes.noSeRealiza }, cuando: ahora }
        : antes?.cambio;
      mapa[despues.id] = { ...despues, cambio };
    } else if (antes) {
      delete mapa[antes.id];
    }
    const id = (despues ?? antes)!.id;
    const lote = writeBatch(db);
    lote.set(doc(db, 'calendarioAcademico', ANIO), { eventos: limpio(mapa), actualizado: ahora, porCorreo: miCorreo() });
    lote.set(doc(collection(db, 'calendarioAcademico', ANIO, 'cambios')), {
      por: miCorreo(), cuando: ahora, eventoId: id, antes: antes ? limpio(antes) : null,
      despues: despues ? limpio(mapa[id]) : null, motivo,
    });
    await lote.commit();
  }, [eventos, puedeEditar]);

  return useMemo(() => ({ eventos, desdeFirestore: eventosFs !== null, puedeEditar, guardar }),
    [eventos, eventosFs, puedeEditar, guardar]);
}

export async function cargarCambios(): Promise<RegistroCambio[]> {
  if (!db) return [];
  const snap = await getDocs(query(collection(db, 'calendarioAcademico', ANIO, 'cambios'), orderBy('cuando', 'desc'), limit(100)));
  return snap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<RegistroCambio, 'id'>) }));
}
