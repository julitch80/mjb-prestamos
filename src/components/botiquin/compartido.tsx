import { useCallback, useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { bitacora, useBitacora } from '../../data/botiquin/bitacoraStore';

type WakeLockLike = { release: () => Promise<void> };

export const BOTON = 'min-h-[56px] rounded-xl border font-bold text-base px-4 transition hover:brightness-110';
export const BOTON_NEUTRO = cn(BOTON, 'border-line bg-card text-strong');
export const BOTON_ACENTO = cn(BOTON, 'border-accent bg-accent text-accent-fg');
export const BOTON_PELIGRO = cn(BOTON, 'border-danger bg-danger text-white');
export const chip = (act: boolean) =>
  cn('min-h-[44px] rounded-full border px-4 text-sm font-semibold transition', act ? 'border-accent bg-accent text-accent-fg' : 'border-line bg-card text-soft');

/** Mantiene la pantalla encendida mientras `activo` sea true. */
export function useWakeLock(activo: boolean) {
  const ref = useRef<WakeLockLike | null>(null);
  useEffect(() => {
    if (!activo) return;
    let cancelado = false;
    (async () => {
      try {
        const wl = (navigator as unknown as { wakeLock?: { request: (t: 'screen') => Promise<WakeLockLike> } }).wakeLock;
        if (wl) {
          const l = await wl.request('screen');
          if (cancelado) l.release().catch(() => {}); else ref.current = l;
        }
      } catch { /* sin Wake Lock */ }
    })();
    return () => {
      cancelado = true;
      ref.current?.release().catch(() => {});
      ref.current = null;
    };
  }, [activo]);
}

/** Pitidos por Web Audio. `iniciar()` debe llamarse desde un gesto del usuario. */
export function useBip() {
  const ctxRef = useRef<AudioContext | null>(null);
  const iniciar = useCallback(async () => {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (AC && !ctxRef.current) ctxRef.current = new AC();
    try { await ctxRef.current?.resume(); } catch { /* sin audio */ }
  }, []);
  const pitar = useCallback((hz: number, dur = 0.25, vol = 0.3) => {
    const ctx = ctxRef.current;
    if (!ctx) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'square';
    osc.frequency.value = hz;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }, []);
  useEffect(() => () => { ctxRef.current?.close().catch(() => {}); }, []);
  return { iniciar, pitar };
}

export function vibrar(patron: number | number[]) {
  try { if (typeof navigator.vibrate === 'function') navigator.vibrate(patron); } catch { /* sin vibración */ }
}

/** Tick de reloj: devuelve Date.now() actualizado cada `ms` mientras `activo`. */
export function useAhora(activo: boolean, ms = 250) {
  const [ahora, setAhora] = useState(() => Date.now());
  useEffect(() => {
    if (!activo) return;
    setAhora(Date.now());
    const id = window.setInterval(() => setAhora(Date.now()), ms);
    return () => window.clearInterval(id);
  }, [activo, ms]);
  return ahora;
}

/** Botón «Añadir a la bitácora»; solo aparece si la bitácora está activa. */
export function AnadirABitacora({ detalle }: { detalle: string }) {
  const { inicio } = useBitacora();
  const [hecho, setHecho] = useState(false);
  useEffect(() => { setHecho(false); }, [detalle]);
  if (inicio === null) return null;
  return (
    <button
      type="button"
      disabled={hecho}
      onClick={() => { bitacora.registrar('medicion', detalle); setHecho(true); }}
      className={cn(BOTON_NEUTRO, 'w-full disabled:opacity-60')}
    >
      {hecho ? 'Añadido a la bitácora' : 'Añadir a la bitácora'}
    </button>
  );
}

export function useCopiar() {
  const [copiado, setCopiado] = useState(false);
  const copiar = useCallback(async (texto: string) => {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(true);
      window.setTimeout(() => setCopiado(false), 2000);
    } catch { /* sin portapapeles */ }
  }, []);
  return { copiado, copiar };
}

export function horaAhora() {
  return new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: false });
}

export function Instrucciones({ items }: { items: string[] }) {
  return (
    <ol className="list-decimal pl-5 flex flex-col gap-1 text-sm text-soft leading-relaxed">
      {items.map((t, i) => <li key={i}>{t}</li>)}
    </ol>
  );
}
