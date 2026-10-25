import { useState } from 'react';
import PopupRectora from './PopupRectora';
import MiHistorial from './MiHistorial';

// Un solo lugar para la rectora: asignación directa + sus reservas (antes también existía «Mis reservas» con la misma consulta).
export default function PanelRectora() {
  const [popupAbierto, setPopupAbierto] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-strong">Panel Rectoría</h2>
        <button
          onClick={() => setPopupAbierto(true)}
          className="px-4 py-2 min-h-[44px] rounded-lg bg-yellow-600 hover:bg-yellow-500 text-strong text-sm font-medium transition"
        >
          + Asignación directa
        </button>
      </div>

      <MiHistorial titulo="Mis asignaciones y reservas" />

      {popupAbierto && <PopupRectora onCerrar={() => setPopupAbierto(false)} />}
    </div>
  );
}
