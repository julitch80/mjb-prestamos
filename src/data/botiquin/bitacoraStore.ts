// Pequeño store compartido (sessionStorage) de la bitácora, para que las herramientas
// de medición puedan «Añadir a la bitácora». Nada sale del dispositivo.
import { useSyncExternalStore } from 'react';
import { crearEvento, quitarUltimo } from './bitacora';
import type { EventoBitacora, TipoEvento } from './bitacora';

export interface EstadoBitacora { inicio: number | null; eventos: EventoBitacora[] }

const CLAVE = 'mjb_botiquin_bitacora';
const VACIO: EstadoBitacora = { inicio: null, eventos: [] };

function leer(): EstadoBitacora {
  try {
    const v = sessionStorage.getItem(CLAVE);
    return v ? (JSON.parse(v) as EstadoBitacora) : VACIO;
  } catch { return VACIO; }
}

let estado: EstadoBitacora = leer();
const oyentes = new Set<() => void>();

function poner(e: EstadoBitacora) {
  estado = e;
  try { sessionStorage.setItem(CLAVE, JSON.stringify(e)); } catch { /* sin sessionStorage */ }
  oyentes.forEach(f => f());
}

export const bitacora = {
  get: () => estado,
  subscribe: (f: () => void) => { oyentes.add(f); return () => { oyentes.delete(f); }; },
  empezar: () => poner({ inicio: Date.now(), eventos: [] }),
  registrar: (tipo: TipoEvento, detalle?: string) => {
    if (estado.inicio === null) return;
    poner({ ...estado, eventos: [...estado.eventos, crearEvento(tipo, Date.now(), detalle)] });
  },
  deshacer: () => poner({ ...estado, eventos: quitarUltimo(estado.eventos) }),
  reiniciar: () => poner(VACIO),
};

export function useBitacora(): EstadoBitacora {
  return useSyncExternalStore(bitacora.subscribe, bitacora.get);
}
