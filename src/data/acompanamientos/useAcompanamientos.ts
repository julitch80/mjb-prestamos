/**
 * Hook `useAcompanamientos(jornada, fecha)` → distribución vigente, próxima
 * publicación (para el aviso «Cambia desde…») y el historial crudo.
 *
 * UNA sola suscripción de Firestore por jornada, compartida entre todos los
 * componentes que la usen (la pestaña Horario y la tarjeta de Inicio la piden
 * a la vez). El caché vive a nivel de módulo, con un contador de suscriptores:
 * el primer componente que pide una jornada abre la suscripción, el último que
 * se desmonta la cierra. `useSyncExternalStore` es lo que permite que varios
 * componentes lean el mismo estado sin que cada uno abra la suya.
 */

import { useCallback, useSyncExternalStore } from 'react';
import { suscribirPublicaciones } from './almacen';
import type { FechaISO, JornadaAcomp, Publicacion } from './tipos';
import { proximaPublicacion, publicacionVigente } from './vigente';

interface Snapshot {
  publicaciones: Publicacion[];
  cargando: boolean;
}

interface EntradaCache {
  /** Objeto de solo lectura que entrega `getSnapshot`. Se REEMPLAZA (no se
   * muta) en cada actualización: `useSyncExternalStore` detecta cambios por
   * referencia, y mutar en el sitio dejaría la misma referencia y ningún
   * componente se enteraría de la actualización. */
  snapshot: Snapshot;
  suscriptores: number;
  desuscribir: () => void;
  listeners: Set<() => void>;
}

const cache = new Map<JornadaAcomp, EntradaCache>();

function obtenerEntrada(jornada: JornadaAcomp): EntradaCache {
  let entrada = cache.get(jornada);
  if (!entrada) {
    entrada = {
      snapshot: { publicaciones: [], cargando: true },
      suscriptores: 0,
      desuscribir: () => {},
      listeners: new Set(),
    };
    cache.set(jornada, entrada);
  }
  return entrada;
}

function actualizar(entrada: EntradaCache, publicaciones: Publicacion[], cargando: boolean) {
  entrada.snapshot = { publicaciones, cargando };
  entrada.listeners.forEach((l) => l());
}

function suscribir(jornada: JornadaAcomp, listener: () => void): () => void {
  const entrada = obtenerEntrada(jornada);
  entrada.listeners.add(listener);

  if (entrada.suscriptores === 0) {
    entrada.desuscribir = suscribirPublicaciones(
      jornada,
      (publicaciones) => actualizar(entrada, publicaciones, false),
      () => {
        // Falló la suscripción (permiso, sin red): quedan sin publicaciones,
        // así que `publicacionVigente` cae de vuelta a la inicial.
        actualizar(entrada, [], false);
      },
    );
  }
  entrada.suscriptores += 1;

  return () => {
    entrada.suscriptores -= 1;
    entrada.listeners.delete(listener);
    if (entrada.suscriptores <= 0) {
      entrada.desuscribir();
      cache.delete(jornada);
    }
  };
}

function snapshot(jornada: JornadaAcomp): Snapshot {
  return obtenerEntrada(jornada).snapshot;
}

export interface EstadoAcompanamientos {
  vigente: Publicacion;
  proxima: Publicacion | null;
  publicaciones: Publicacion[];
  cargando: boolean;
}

export function useAcompanamientos(jornada: JornadaAcomp, fecha: FechaISO): EstadoAcompanamientos {
  const sub = useCallback((listener: () => void) => suscribir(jornada, listener), [jornada]);
  const get = useCallback(() => snapshot(jornada), [jornada]);
  const entrada = useSyncExternalStore(sub, get, get);

  return {
    vigente: publicacionVigente(entrada.publicaciones, jornada, fecha),
    proxima: proximaPublicacion(entrada.publicaciones, jornada, fecha),
    publicaciones: entrada.publicaciones,
    cargando: entrada.cargando,
  };
}
