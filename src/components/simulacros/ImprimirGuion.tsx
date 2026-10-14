import { useState } from 'react';
import {
  ANTES_BASE, ANTES_EX, MISION, PASOS, PUESTOS, ROLES, RUTAS,
} from '../../data/simulacros/plantillaSismo2026';
import type { JornadaId, RolClave } from '../../data/simulacros/plantillaSismo2026';
import { JORNADA_NOMBRE } from '../../data/simulacros/logica';
import {
  OPCIONES_IMPRIMIR_DEFECTO, construirHtmlGuion, imprimirHtml,
} from '../../data/simulacros/imprimirGuion';
import type { OpcionesImprimir } from '../../data/simulacros/imprimirGuion';
import type { SimulacroConId } from './useSimulacro';

const PLANTILLA = { ROLES, MISION, PASOS, ANTES_BASE, ANTES_EX, RUTAS, PUESTOS };

/** Botón «Imprimir guion» + panel para elegir jornada, rol y secciones. */
export default function ImprimirGuion({ sim }: { sim: SimulacroConId }) {
  const [abierto, setAbierto] = useState(false);
  const [jornada, setJornada] = useState<JornadaId>('manana');
  const [rol, setRol] = useState<RolClave>('docente');
  const [op, setOp] = useState<OpcionesImprimir>(OPCIONES_IMPRIMIR_DEFECTO);

  const imprimir = () => imprimirHtml(construirHtmlGuion(PLANTILLA, sim, jornada, rol, op, new Date()));
  const caja = (k: keyof OpcionesImprimir, texto: string) => (
    <label className="flex items-center gap-2 text-sm text-soft">
      <input type="checkbox" checked={op[k]} onChange={e => setOp(o => ({ ...o, [k]: e.target.checked }))} />
      {texto}
    </label>
  );

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={() => setAbierto(v => !v)}
        className="self-start px-3 py-1.5 rounded-full text-xs font-medium border border-line text-soft hover:bg-elevated"
      >
        🖨️ Imprimir guion
      </button>
      {abierto && (
        <div className="rounded-xl border border-line bg-card p-3 flex flex-col gap-3">
          <div className="flex flex-wrap gap-3">
            <label className="flex flex-col gap-1 text-xs text-muted">
              Jornada
              <select value={jornada} onChange={e => setJornada(e.target.value as JornadaId)} className="border border-line rounded-lg bg-card text-strong text-sm px-2 py-1">
                {(['manana', 'tarde'] as JornadaId[]).map(k => <option key={k} value={k}>{JORNADA_NOMBRE[k]}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs text-muted">
              Rol
              <select value={rol} onChange={e => setRol(e.target.value as RolClave)} className="border border-line rounded-lg bg-card text-strong text-sm px-2 py-1">
                {ROLES.map(r => <option key={r.k} value={r.k}>{r.n}</option>)}
              </select>
            </label>
          </div>
          <div className="flex flex-col gap-1">
            {caja('preparacion', 'Incluir lista de preparación')}
            {caja('rutas', 'Incluir rutas de evacuación')}
            {caja('encargados', 'Incluir encargados')}
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={imprimir} className="px-3 py-1.5 rounded-full text-xs font-semibold bg-accent text-white">Imprimir / Guardar PDF</button>
            <button type="button" onClick={() => setAbierto(false)} className="px-3 py-1.5 rounded-full text-xs font-medium border border-line text-soft hover:bg-elevated">Cerrar</button>
          </div>
          <p className="text-muted text-xs">En el cuadro de impresión puede elegir «Guardar como PDF».</p>
        </div>
      )}
    </div>
  );
}
