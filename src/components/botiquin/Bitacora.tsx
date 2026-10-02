import { useCallback, useState } from 'react';
import { cn } from '@/lib/utils';
import { useDictado } from '../../hooks/useDictado';
import {
  BOTONES_EVENTO, etiquetaEvento, formatearBitacora, formatearHora, formatearMmSs, formatearTranscurrido, ordenar,
} from '../../data/botiquin/bitacora';
import type { TipoEvento } from '../../data/botiquin/bitacora';
import { bitacora, useBitacora } from '../../data/botiquin/bitacoraStore';
import { BOTON, BOTON_ACENTO, BOTON_NEUTRO, useAhora, useCopiar, useWakeLock } from './compartido';

/** Bitácora de la emergencia: solo en memoria / sessionStorage; nada se envía a un servidor. */
export function Bitacora() {
  const { inicio, eventos } = useBitacora();
  const activa = inicio !== null;
  const ahora = useAhora(activa, 500);
  const { copiado, copiar } = useCopiar();
  const [pidiendo, setPidiendo] = useState<TipoEvento | null>(null);
  const [texto, setTexto] = useState('');
  const [nota, setNota] = useState('');
  const [anuncio, setAnuncio] = useState('');
  useWakeLock(activa);

  const alDictar = useCallback((t: string) => setNota(n => (n ? `${n} ${t}` : t)), []);
  const dictado = useDictado(alDictar);

  const registrar = (tipo: TipoEvento, detalle?: string) => {
    bitacora.registrar(tipo, detalle);
    if (typeof navigator.vibrate === 'function') navigator.vibrate(30);
    setAnuncio(`Registrado: ${etiquetaEvento(tipo)}`);
  };

  if (!activa) {
    return (
      <div className="flex flex-col gap-3">
        <button type="button" onClick={bitacora.empezar} className={cn(BOTON, 'min-h-[72px] w-full border-danger bg-danger text-white text-xl')}>
          Empezar
        </button>
        <p className="text-[11px] text-muted">Fija la hora 0. Los datos quedan solo en este dispositivo y se borran al cerrar la pestaña.</p>
      </div>
    );
  }

  const lista = ordenar(eventos);

  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-xl border-2 border-danger bg-danger-soft px-4 py-3 flex items-center justify-between gap-3">
        <div>
          <p className="text-xs text-danger-soft-fg">Hora 0: {formatearHora(inicio)}</p>
          <p className="text-4xl font-bold tabular-nums text-danger-soft-fg" aria-hidden="true">{formatearMmSs((ahora - inicio) / 1000)}</p>
        </div>
        <span className="sr-only" role="timer">Tiempo transcurrido {formatearMmSs((ahora - inicio) / 1000)}</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {BOTONES_EVENTO.map(b => (
          <button
            key={b.tipo}
            type="button"
            onClick={() => (b.pideTexto ? (setPidiendo(b.tipo), setTexto('')) : registrar(b.tipo))}
            className={cn(BOTON_NEUTRO, 'min-h-[64px] text-left')}
          >
            {b.etiqueta}
          </button>
        ))}
      </div>

      {pidiendo && (
        <div className="rounded-xl border border-line bg-card p-3 flex flex-col gap-2">
          <label htmlFor="bit-destino" className="text-sm font-bold text-strong">{BOTONES_EVENTO.find(b => b.tipo === pidiendo)?.pideTexto}</label>
          <input
            id="bit-destino"
            value={texto}
            onChange={e => setTexto(e.target.value)}
            autoFocus
            className="min-h-[56px] rounded-xl border-2 border-line bg-elevated text-strong px-3 text-base"
          />
          <div className="flex gap-2">
            <button type="button" onClick={() => { registrar(pidiendo, texto); setPidiendo(null); }} className={cn(BOTON_ACENTO, 'flex-1')}>Registrar</button>
            <button type="button" onClick={() => setPidiendo(null)} className={BOTON_NEUTRO}>Cancelar</button>
          </div>
        </div>
      )}

      <div className="rounded-xl border border-line bg-card p-3 flex flex-col gap-2">
        <label htmlFor="bit-nota" className="text-sm font-bold text-strong">Nota</label>
        <textarea
          id="bit-nota"
          value={nota}
          onChange={e => setNota(e.target.value)}
          rows={2}
          className="rounded-xl border-2 border-line bg-elevated text-strong px-3 py-2 text-base"
        />
        <div className="flex gap-2">
          <button
            type="button"
            disabled={!nota.trim()}
            onClick={() => { registrar('nota', nota); setNota(''); }}
            className={cn(BOTON_ACENTO, 'flex-1 disabled:opacity-50')}
          >
            Guardar nota
          </button>
          {dictado.disponible && (
            <button
              type="button"
              aria-pressed={dictado.grabando}
              onClick={dictado.grabando ? dictado.detener : dictado.iniciar}
              className={cn(BOTON_NEUTRO, dictado.grabando && 'border-danger')}
            >
              {dictado.grabando ? 'Detener' : '🎤 Dictar'}
            </button>
          )}
        </div>
      </div>

      <span className="sr-only" role="status" aria-live="polite">{anuncio}</span>

      <div className="border-t border-line pt-3 flex flex-col gap-2">
        <p className="text-xs font-bold text-strong">Línea de tiempo</p>
        {lista.length === 0 ? (
          <p className="text-xs text-muted">Aún no hay eventos.</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {lista.map((e, i) => (
              <li key={i} className="text-sm text-soft flex flex-wrap gap-x-2">
                <span className="tabular-nums font-bold text-strong">{formatearTranscurrido(inicio, e.t)}</span>
                <span className="tabular-nums text-muted">{formatearHora(e.t)}</span>
                <span>{etiquetaEvento(e.tipo)}{e.detalle ? `: ${e.detalle}` : ''}</span>
              </li>
            ))}
          </ul>
        )}
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => copiar(formatearBitacora(inicio, eventos))} className={cn(BOTON_ACENTO, 'flex-1')}>
            {copiado ? 'Copiado' : 'Copiar bitácora'}
          </button>
          <button type="button" disabled={eventos.length === 0} onClick={bitacora.deshacer} className={cn(BOTON_NEUTRO, 'disabled:opacity-50')}>Deshacer último</button>
          <button
            type="button"
            onClick={() => { if (window.confirm('¿Borrar la bitácora? Copie antes si la necesita.')) bitacora.reiniciar(); }}
            className={BOTON_NEUTRO}
          >
            Terminar y borrar
          </button>
        </div>
        <p className="text-[11px] text-muted">Solo queda en este dispositivo; se borra al cerrar la pestaña. No se envía a ningún servidor.</p>
      </div>
    </div>
  );
}
