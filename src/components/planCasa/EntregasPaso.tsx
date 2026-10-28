// Entregas que llegaron desde la agenda pública: lista por paso (más reciente arriba) y botón
// «Abrir» (la función verifica el rol y devuelve el archivo; nunca una URL permanente).
import { useEffect, useState } from 'react';
import { FileText, Image as Imagen, Link2, Mic } from 'lucide-react';
import type { EntregaPlan, GuiaPlan } from '../../data/planCasa/tipos';
import { abrirEntrega, escucharEntregas } from '../../data/planCasa/entregasCliente';
import { formatoTamano } from '../../data/planCasa/entregas';

export function useEntregas(planId: string, guiaId: string): { entregas: EntregaPlan[]; error: string } {
  const [entregas, setEntregas] = useState<EntregaPlan[]>([]);
  const [error, setError] = useState('');
  useEffect(() => escucharEntregas(planId, guiaId, e => { setEntregas(e); setError(''); }, e => setError(e.message)), [planId, guiaId]);
  return { entregas, error };
}

const fecha = (ms: number) => new Date(ms).toLocaleString('es-CO', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
const ICONO = { foto: Imagen, audio: Mic, pdf: FileText, enlace: Link2 } as const;

export function ListaEntregas({ planId, entregas }: { planId: string; entregas: EntregaPlan[] }) {
  const [abriendo, setAbriendo] = useState('');
  const [error, setError] = useState('');
  if (!entregas.length) return <p className="text-[11px] text-muted">Sin entregas por la agenda.</p>;
  async function abrir(id: string) {
    setError(''); setAbriendo(id);
    try { await abrirEntrega(planId, id); } catch (e) { setError((e as Error).message); } finally { setAbriendo(''); }
  }
  return (
    <div className="space-y-1">
      <ul className="rounded-lg bg-elevated/60 divide-y divide-line">
        {entregas.map((e, i) => {
          const Ic = ICONO[e.tipo] ?? FileText;
          return (
            <li key={e.id} className="flex items-center gap-2 px-2 py-1.5 text-xs">
              <Ic size={14} className="text-soft flex-shrink-0" />
              <span className="flex-1 min-w-0 truncate text-strong">
                {i === 0 && <span className="mr-1 font-semibold text-accent">Última ·</span>}
                {fecha(e.creadoEn)} · {e.tipo === 'enlace' ? (e.url ?? 'enlace') : `${e.nombre} (${formatoTamano(e.tamano)})`}
              </span>
              <button onClick={() => abrir(e.id)} disabled={abriendo === e.id}
                className="min-h-[32px] px-3 rounded-full bg-accent text-strong font-medium disabled:opacity-50">
                {abriendo === e.id ? 'Abriendo…' : 'Abrir'}
              </button>
            </li>
          );
        })}
      </ul>
      {error && <p className="text-[11px] text-red-500">{error}</p>}
    </div>
  );
}

/** Resumen para el tablero del equipo: entregas de la guía agrupadas por paso. */
export function EntregasGuiaResumen({ planId, g }: { planId: string; g: GuiaPlan }) {
  const { entregas, error } = useEntregas(planId, g.id);
  const [abierto, setAbierto] = useState(false);
  if (error) return <p className="text-[11px] text-red-500">Entregas: {error}</p>;
  if (!entregas.length) return null;
  const pasos = g.aprobada?.pasos ?? [];
  return (
    <div className="mt-1">
      <button onClick={() => setAbierto(a => !a)} className="text-[11px] text-accent underline">
        {abierto ? 'Ocultar' : 'Ver'} entregas ({entregas.length})
      </button>
      {abierto && (
        <div className="mt-1 space-y-2">
          {pasos.filter(p => entregas.some(e => e.pasoId === p.id)).map(p => (
            <div key={p.id}>
              <p className="text-[11px] text-soft">{p.titulo} · {g.seguimiento?.[p.id]?.estado ?? 'pendiente'}
                {g.seguimiento?.[p.id]?.observacion ? ` · «${g.seguimiento[p.id].observacion}»` : ''}</p>
              <ListaEntregas planId={planId} entregas={entregas.filter(e => e.pasoId === p.id)} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
