// Bandeja «Consultas» del panel (equipo y superusuario). Ver consultas.ts.
import { useCallback, useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { ETIQUETA_CONSULTA, type ConsultaPlan } from '../../data/planCasa/consultas';
import { listarConsultas, responderConsulta } from '../../data/planCasa/consultasCliente';
import { CLASE_BOTON, CLASE_INPUT, CajaError, Cargando } from './comun';

const fecha = (ms: number) => new Date(ms).toLocaleString('es-CO', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

/** Consultas visibles para quien llama (el servidor filtra por permiso) + recarga. */
export function useConsultas(activo: boolean) {
  const [lista, setLista] = useState<ConsultaPlan[] | null>(null);
  const [error, setError] = useState('');
  const recargar = useCallback(() => {
    listarConsultas().then(l => { setLista(l); setError(''); }).catch(e => { setError(e.message); setLista([]); });
  }, []);
  useEffect(() => { if (activo) recargar(); }, [activo, recargar]);
  return { lista, error, recargar, pendientes: (lista ?? []).filter(c => c.estado === 'pendiente').length };
}

function Tarjeta({ c, onRespondida }: { c: ConsultaPlan; onRespondida: () => void }) {
  const [texto, setTexto] = useState(c.respuesta ?? '');
  const [editando, setEditando] = useState(c.estado === 'pendiente');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  async function enviar() {
    setGuardando(true); setError('');
    try { await responderConsulta(c.id, texto); setEditando(false); onRespondida(); }
    catch (e) { setError(e instanceof Error ? e.message : 'No se pudo responder.'); }
    setGuardando(false);
  }
  const info = ETIQUETA_CONSULTA[c.tipo];
  return (
    <div className="rounded-2xl border border-line bg-card/60 p-3 space-y-2">
      <p className="text-xs text-muted">
        {info.icono} {info.titulo} · {fecha(c.creada)}{c.primerNombre ? ` · ${c.primerNombre}` : ''}{c.grupo ? ` · ${c.grupo}` : ''}
      </p>
      <p className="text-sm text-strong whitespace-pre-wrap">{c.texto}</p>
      {c.contacto && <p className="text-xs text-soft">Contacto: {c.contacto}</p>}
      {c.estado === 'respondida' && !editando && (
        <div className="rounded-xl bg-success-soft text-success-soft-fg p-2 text-sm">
          <p className="whitespace-pre-wrap">{c.respuesta}</p>
          <p className="text-xs mt-1">{c.respondidaPor} · {c.respondidaEn ? fecha(c.respondidaEn) : ''}</p>
          <button onClick={() => setEditando(true)} className="text-xs underline mt-1">Editar respuesta</button>
        </div>
      )}
      {editando && (
        <div className="space-y-2">
          <textarea value={texto} onChange={e => setTexto(e.target.value)} rows={3} aria-label="Respuesta" placeholder="Escriba la respuesta para la familia" className={cn(CLASE_INPUT, 'py-2')} />
          {error && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p>}
          <button disabled={guardando || !texto.trim()} onClick={enviar} className={CLASE_BOTON}>{guardando ? 'Enviando…' : 'Responder'}</button>
        </div>
      )}
    </div>
  );
}

export function ConsultasPanel({ datos }: { datos: ReturnType<typeof useConsultas> }) {
  const { lista, error, recargar } = datos;
  const [ver, setVer] = useState<'pendiente' | 'respondida'>('pendiente');
  if (!lista) return <Cargando texto="Cargando consultas…" />;
  const visibles = lista.filter(c => c.estado === ver);
  return (
    <div className="space-y-3">
      {error && <CajaError>{error}</CajaError>}
      <div className="flex gap-1">
        {(['pendiente', 'respondida'] as const).map(e => (
          <button key={e} onClick={() => setVer(e)} aria-pressed={ver === e}
            className={cn('text-xs px-3 py-1.5 rounded-full border transition', ver === e ? 'bg-accent/15 border-accent/50 text-strong' : 'border-line text-soft hover:text-strong')}>
            {e === 'pendiente' ? `Pendientes (${lista.filter(c => c.estado === 'pendiente').length})` : `Respondidas (${lista.filter(c => c.estado === 'respondida').length})`}
          </button>
        ))}
        <button onClick={recargar} className="text-xs px-3 py-1.5 rounded-full border border-line text-soft hover:text-strong ml-auto">Actualizar</button>
      </div>
      {visibles.length === 0 && <p className="text-sm text-soft">No hay consultas {ver === 'pendiente' ? 'pendientes' : 'respondidas'}.</p>}
      {visibles.map(c => <Tarjeta key={c.id} c={c} onRespondida={recargar} />)}
    </div>
  );
}
