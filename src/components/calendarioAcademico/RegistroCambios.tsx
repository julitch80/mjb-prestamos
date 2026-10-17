// Lista del registro de cambios del calendario (calendarioAcademico/2026/cambios).
import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { cargarCambios, type RegistroCambio } from '../../data/calendarioAcademico/persistencia';
import { textoFecha } from '../../data/calendarioAcademico/logica';

const f = (e: RegistroCambio['antes']) => (e ? `${e.titulo}: ${e.porDefinir ? 'por definir' : e.noSeRealiza ? 'no se realiza' : textoFecha(e)}` : '—');

export default function RegistroCambios({ onCerrar }: { onCerrar: () => void }) {
  const [filas, setFilas] = useState<RegistroCambio[] | null>(null);
  const [error, setError] = useState('');
  useEffect(() => { cargarCambios().then(setFilas).catch(e => setError((e as Error).message)); }, []);
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 sm:p-4" role="dialog" aria-modal="true">
      <div className="w-full sm:max-w-lg max-h-[85vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl bg-card border border-line p-4">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-strong font-semibold">Registro de cambios</h2>
          <button onClick={onCerrar} aria-label="Cerrar" className="p-2 -m-2 text-soft hover:text-strong"><X size={18} /></button>
        </div>
        {error && <p className="text-xs rounded-lg bg-danger-soft text-danger-soft-fg px-3 py-2">{error}</p>}
        {!filas && !error && <p className="text-sm text-soft">Cargando…</p>}
        {filas && filas.length === 0 && <p className="text-sm text-soft">Todavía no hay cambios: el calendario está como el documento oficial.</p>}
        <div className="divide-y divide-line">
          {filas?.map(r => (
            <div key={r.id} className="py-2.5 text-sm">
              <p className="text-xs text-muted">{new Date(r.cuando).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' })} · {r.por}</p>
              <p className="text-soft line-through">{f(r.antes)}</p>
              <p className="text-strong">{r.despues ? f(r.despues) : 'Evento borrado'}</p>
              <p className="text-xs text-soft mt-0.5">Motivo: {r.motivo}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
