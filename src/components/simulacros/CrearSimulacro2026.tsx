import { useState } from 'react';
import { ASIGNACIONES_2026, EDITORES_2026 } from '../../data/simulacros/plantillaSismo2026';
import { simulacroCambiar } from './useSimulacro';

/** Tarjeta del panel del superusuario: crea la ficha del simulacro 2026 (la función del servidor la guarda). */
export default function CrearSimulacro2026() {
  const [confirmando, setConfirmando] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [resultado, setResultado] = useState<{ ok: boolean; t: string } | null>(null);

  async function crear() {
    setOcupado(true); setResultado(null);
    const datos = {
      titulo: 'Simulacro de sismo 2026 · Sede Principal',
      sede: 'principal',
      evento: 'sismo',
      plantilla: 'sismo2026',
      estado: 'borrador',
      nacional: { fecha: '2026-10-21', hora: '10:00' },
      editores: EDITORES_2026,
      jornadas: {
        manana: { fecha: '2026-10-21', hora: '10:00' },
        tarde: { fecha: '2026-10-21', hora: '16:00' },
      },
      asignaciones: ASIGNACIONES_2026,
    };
    const err = await simulacroCambiar('2026-principal', { accion: 'crear', id: '2026-principal', datos });
    setOcupado(false);
    setConfirmando(false);
    setResultado(err
      ? { ok: false, t: err }
      : { ok: true, t: 'Simulacro creado en borrador. Ábrelo en Gestión del riesgo → Simulacros y publícalo cuando esté listo.' });
  }

  return (
    <div className="rounded-xl border border-line bg-card p-3 space-y-2">
      <div>
        <h3 className="text-strong text-sm font-semibold">Simulacros</h3>
        <p className="text-muted text-xs mt-0.5 leading-snug">
          Crea la ficha del simulacro del 21 de octubre con el guion, los encargados y las rutas de la guía. Queda en borrador.
        </p>
      </div>
      {!confirmando ? (
        <button
          type="button"
          onClick={() => { setConfirmando(true); setResultado(null); }}
          className="px-3 py-1.5 rounded-lg bg-accent text-accent-fg text-xs font-semibold"
        >
          Crear simulacro 2026 · Sede Principal
        </button>
      ) : (
        <div className="flex flex-wrap items-center gap-2 bg-warning-soft rounded-lg px-3 py-2">
          <span className="text-warning-soft-fg text-xs">¿Crear la ficha «2026-principal»? Si ya existe, el servidor la rechazará.</span>
          <button type="button" disabled={ocupado} onClick={() => void crear()} className="px-2.5 py-1 rounded-lg bg-accent text-accent-fg text-xs font-semibold disabled:opacity-50">
            {ocupado ? 'Creando…' : 'Sí, crear'}
          </button>
          <button type="button" disabled={ocupado} onClick={() => setConfirmando(false)} className="px-2.5 py-1 rounded-lg border border-line text-soft text-xs">Cancelar</button>
        </div>
      )}
      {resultado && (
        <p role="status" className={`text-xs ${resultado.ok ? 'text-success' : 'text-danger'}`}>{resultado.t}</p>
      )}
    </div>
  );
}
