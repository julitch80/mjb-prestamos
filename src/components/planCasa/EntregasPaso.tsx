// Entregas que llegaron desde la agenda pública: lista por paso (más reciente arriba) y botón
// «Abrir» (la función verifica el rol y devuelve el archivo; nunca una URL permanente).
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { FileText, Image as Imagen, Link2, Mic } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { EntregaPlan, GuiaPlan, PasoGuia } from '../../data/planCasa/tipos';
import { abrirEntrega, cargarEntrega, escucharEntregas } from '../../data/planCasa/entregasCliente';
import { cajaGirada, girar, rotacionValida } from '../../data/planCasa/rotacion';
import { formatoTamano } from '../../data/planCasa/entregas';
import { llavePaso } from '../../data/planCasa/checklist';

export function useEntregas(planId: string, guiaId: string): { entregas: EntregaPlan[]; error: string } {
  const [entregas, setEntregas] = useState<EntregaPlan[]>([]);
  const [error, setError] = useState('');
  useEffect(() => escucharEntregas(planId, guiaId, e => { setEntregas(e); setError(''); }, e => setError(e.message)), [planId, guiaId]);
  return { entregas, error };
}

/**
 * Pasos con entregas reales en las guías dadas: llavePaso(guiaId, pasoId) → ms de la más reciente.
 * Sirve para contar como «por revisar» un paso con entregas aunque su estado siga en «pendiente».
 */
export function useConEntregas(planId: string, guiaIds: string[]): Record<string, number> {
  const [porGuia, setPorGuia] = useState<Record<string, Record<string, number>>>({});
  const clave = guiaIds.join('|');
  useEffect(() => {
    const bajas = clave.split('|').filter(Boolean).map(gid => escucharEntregas(planId, gid, es => {
      const m: Record<string, number> = {};
      for (const e of es) m[llavePaso(gid, e.pasoId)] = Math.max(m[llavePaso(gid, e.pasoId)] ?? 0, e.creadoEn);
      setPorGuia(prev => ({ ...prev, [gid]: m }));
    }));
    return () => bajas.forEach(b => b());
  }, [planId, clave]);
  return useMemo(() => Object.assign({}, ...Object.values(porGuia)) as Record<string, number>, [porGuia]);
}

const fecha = (ms: number) => new Date(ms).toLocaleString('es-CO', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
const ICONO = { foto: Imagen, audio: Mic, pdf: FileText, documento: FileText, enlace: Link2 } as const;


const claveGiro = (id: string) => `pae-giro:${id}`;
const leerGiro = (id: string): number => { try { return rotacionValida(localStorage.getItem(claveGiro(id))); } catch { return 0; } };
const guardarGiro = (id: string, g: number) => { try { if (g) localStorage.setItem(claveGiro(id), String(g)); else localStorage.removeItem(claveGiro(id)); } catch { /* sin almacenamiento */ } };

/**
 * Visor de la foto de una entrega dentro de la app, con «Girar ↺ / ↻» (90°). El giro es solo de
 * pantalla (CSS transform): el archivo original no se toca. Se recuerda por entrega en este navegador.
 */
export function VisorFoto({ planId, entrega, onCerrar }: { planId: string; entrega: EntregaPlan; onCerrar: () => void }) {
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  const [giro, setGiro] = useState(() => leerGiro(entrega.id));
  const [nat, setNat] = useState<{ w: number; h: number } | null>(null);
  const [area, setArea] = useState({ w: 320, h: 420 });
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let vivo = true; let blob = '';
    cargarEntrega(planId, entrega.id)
      .then(r => { if (!vivo) { if (r.esBlob) URL.revokeObjectURL(r.url); return; } if (r.esBlob) blob = r.url; setUrl(r.url); })
      .catch(e => { if (vivo) setError((e as Error).message); });
    return () => { vivo = false; if (blob) URL.revokeObjectURL(blob); };
  }, [planId, entrega.id]);

  useEffect(() => {
    const medir = () => setArea({ w: Math.max(200, (ref.current?.clientWidth ?? 320) - 8), h: Math.max(200, window.innerHeight * 0.65) });
    medir();
    window.addEventListener('resize', medir);
    return () => window.removeEventListener('resize', medir);
  }, []);

  function mover(pasos: 1 | -1) { const n = girar(giro, pasos); setGiro(n); guardarGiro(entrega.id, n); }
  const caja = nat ? cajaGirada(nat.w, nat.h, giro, area.w, area.h) : null;
  const clase = 'min-h-[40px] px-4 rounded-full bg-elevated text-strong text-sm font-medium';

  return (
    <div role="dialog" aria-modal="true" aria-label="Foto de la entrega" className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-2" onClick={onCerrar}>
      <div ref={ref} onClick={e => e.stopPropagation()} className="w-full max-w-2xl max-h-full overflow-auto rounded-2xl border border-line bg-card p-3 space-y-2">
        <p className="text-xs text-soft truncate">{entrega.nombre} · {fecha(entrega.creadoEn)}</p>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => mover(-1)} className={clase} aria-label="Girar a la izquierda">Girar ↺</button>
          <button type="button" onClick={() => mover(1)} className={clase} aria-label="Girar a la derecha">Girar ↻</button>
          <button type="button" onClick={onCerrar} className={cn(clase, 'ml-auto')}>Cerrar</button>
        </div>
        {error && <p className="text-xs text-red-500">{error}</p>}
        {!url && !error && <p className="text-xs text-soft">Cargando la foto…</p>}
        {url && (
          <div className="relative mx-auto" style={caja ? { width: caja.cajaAncho, height: caja.cajaAlto } : { minHeight: 120 }}>
            <img src={url} alt={`Foto entregada: ${entrega.nombre}`} draggable={false}
              onLoad={e => setNat({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
              style={caja
                ? { position: 'absolute', left: '50%', top: '50%', width: caja.imgAncho, height: caja.imgAlto, maxWidth: 'none', transform: `translate(-50%, -50%) rotate(${giro}deg)` }
                : { maxWidth: '100%', maxHeight: '65vh' }} />
          </div>
        )}
      </div>
    </div>
  );
}

export function ListaEntregas({ planId, entregas }: { planId: string; entregas: EntregaPlan[] }) {
  const [abriendo, setAbriendo] = useState('');
  const [error, setError] = useState('');
  const [viendo, setViendo] = useState<EntregaPlan | null>(null);
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
              {e.tipo === 'foto' && (
                <button onClick={() => setViendo(e)} className="min-h-[40px] px-3 rounded-full bg-elevated text-strong font-medium">Ver</button>
              )}
              <button onClick={() => abrir(e.id)} disabled={abriendo === e.id}
                className="min-h-[40px] px-3 rounded-full bg-accent text-strong font-medium disabled:opacity-50">
                {abriendo === e.id ? 'Abriendo…' : 'Abrir'}
              </button>
            </li>
          );
        })}
      </ul>
      {error && <p className="text-[11px] text-red-500">{error}</p>}
      {viendo && <VisorFoto planId={planId} entrega={viendo} onCerrar={() => setViendo(null)} />}
    </div>
  );
}

/**
 * Resumen de las entregas de la guía agrupadas por paso. En el tablero del equipo solo se ve y se
 * abre. Con las props opcionales (pestaña «Entregas» del docente) cada paso indica quién lo
 * revisa o trae el botón «Revisar», que lleva al bloque de seguimiento de ese paso.
 */
export function EntregasGuiaResumen({ planId, g, abiertoInicial = false, puedeRevisar, quienRevisa, onRevisar, renderPaso }: {
  planId: string; g: GuiaPlan; abiertoInicial?: boolean;
  puedeRevisar?: (p: PasoGuia) => boolean; quienRevisa?: (p: PasoGuia) => string; onRevisar?: (pasoId: string) => void;
  /** Si devuelve un nodo, ese paso se dibuja con él (controles de revisión en línea, con sus entregas); si null, el bloque por defecto. */
  renderPaso?: (p: PasoGuia, n: number, entregas: EntregaPlan[]) => ReactNode | null;
}) {
  const { entregas, error } = useEntregas(planId, g.id);
  const [abierto, setAbierto] = useState(abiertoInicial);
  if (error) return <p className="text-[11px] text-red-500">Entregas: {error}</p>;
  const pasos = g.aprobada?.pasos ?? [];
  const visibles = pasos.filter(p => entregas.some(e => e.pasoId === p.id) || g.seguimiento?.[p.id]?.estado === 'entregado');
  if (!visibles.length) return null;
  return (
    <div className="mt-1">
      <button onClick={() => setAbierto(a => !a)} className="text-[11px] text-accent underline">
        {abierto ? 'Ocultar' : 'Ver'} entregas ({entregas.length})
      </button>
      {abierto && (
        <div className="mt-1 space-y-2">
          {visibles.map(p => {
            const propias = entregas.filter(e => e.pasoId === p.id);
            const dibujo = renderPaso?.(p, pasos.indexOf(p) + 1, propias);
            if (dibujo) return <div key={p.id}>{dibujo}</div>;
            return (
            <div key={p.id}>
              <div className="flex items-center gap-2">
                <p className="flex-1 min-w-0 text-[11px] text-soft">{p.titulo} · {g.seguimiento?.[p.id]?.estado ?? 'pendiente'}
                  {g.seguimiento?.[p.id]?.observacion ? ` · «${g.seguimiento[p.id].observacion}»` : ''}
                  {puedeRevisar && onRevisar && !puedeRevisar(p) && quienRevisa ? ` · Lo revisa ${quienRevisa(p)}` : ''}</p>
                {puedeRevisar && onRevisar && puedeRevisar(p) && (
                  <button type="button" onClick={() => onRevisar(p.id)} className="min-h-[40px] px-4 rounded-full bg-accent text-strong text-sm font-medium flex-shrink-0">Revisar</button>
                )}
              </div>
              <ListaEntregas planId={planId} entregas={propias} />
            </div>);
          })}
        </div>
      )}
    </div>
  );
}
