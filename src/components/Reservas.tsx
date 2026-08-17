import { useState } from 'react';
import { cn } from '@/lib/utils';
import DisponibilidadGrid from './DisponibilidadGrid';
import MiHistorial from './MiHistorial';

// Reservas reúne en una sola pantalla lo que antes eran dos entradas del menú
// de inicio: la cuadrícula para pedir un espacio y el listado de lo que uno ya
// pidió. Pedido de Julián el 17 de agosto de 2026 — «Mis reservas» estorbaba
// en el menú principal, y su sitio natural es dentro de Reservas.
//
// La rectora NO llega aquí (su rol no incluye 'disponibilidad'), así que
// conserva «Mis reservas» como entrada suelta del menú. Ver NAV_ITEMS.

type Pestana = 'reservar' | 'mias';

export default function Reservas() {
  const [pestana, setPestana] = useState<Pestana>('reservar');

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-1.5 flex-wrap">
        <button
          onClick={() => setPestana('reservar')}
          className={cn(
            'px-3 py-1.5 rounded-full text-xs font-medium border transition-all',
            pestana === 'reservar'
              ? 'bg-accent-soft border-accent text-accent'
              : 'border-line text-muted hover:text-soft hover:bg-elevated'
          )}
        >
          🗓️ Reservar
        </button>
        <button
          onClick={() => setPestana('mias')}
          className={cn(
            'px-3 py-1.5 rounded-full text-xs font-medium border transition-all',
            pestana === 'mias'
              ? 'bg-accent-soft border-accent text-accent'
              : 'border-line text-muted hover:text-soft hover:bg-elevated'
          )}
        >
          📋 Mis reservas
        </button>
      </div>

      {pestana === 'reservar' ? <DisponibilidadGrid /> : <MiHistorial />}
    </div>
  );
}
