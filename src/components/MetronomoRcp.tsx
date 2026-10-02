import { useCallback, useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import {
  COMPRESIONES_POR_CICLO,
  ESTADO_RCP_INICIAL,
  PAUSA_RESPIRACIONES_S,
  RITMOS_RCP,
  RITMO_RCP_DEFECTO,
  avanzarRcp,
  intervaloSegundos,
} from '../data/metronomoRcp';
import type { EstadoRcp, RitmoRcp } from '../data/metronomoRcp';

interface EventoProgramado {
  t: number; // reloj de AudioContext
  estado: EstadoRcp;
}

const ADELANTO_S = 0.12; // cuánto se programa por adelantado
const PASO_MS = 25;

type WakeLockLike = { release: () => Promise<void> };

/** Metrónomo de compresiones (pauta 30:2 de la ficha «Reanimación»). */
export function MetronomoRcp() {
  const [corriendo, setCorriendo] = useState(false);
  const [ritmo, setRitmo] = useState<RitmoRcp>(RITMO_RCP_DEFECTO);
  const [silencio, setSilencio] = useState(false);
  const [estado, setEstado] = useState<EstadoRcp>(ESTADO_RCP_INICIAL);

  const ctxRef = useRef<AudioContext | null>(null);
  const timerRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const lockRef = useRef<WakeLockLike | null>(null);
  const circuloRef = useRef<HTMLDivElement | null>(null);
  const colaRef = useRef<EventoProgramado[]>([]);
  const logicoRef = useRef<EstadoRcp>(ESTADO_RCP_INICIAL);
  const proximoRef = useRef(0);
  const ultimoLatidoRef = useRef<{ t: number; dur: number } | null>(null);
  const ritmoRef = useRef(ritmo);
  const silencioRef = useRef(silencio);
  ritmoRef.current = ritmo;
  silencioRef.current = silencio;

  const beep = useCallback((ctx: AudioContext, t: number, acento: boolean) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.value = acento ? 1000 : 800;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.4, t + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.08);
  }, []);

  const programar = useCallback(() => {
    const ctx = ctxRef.current;
    if (!ctx) return;
    while (proximoRef.current < ctx.currentTime + ADELANTO_S) {
      const t = proximoRef.current;
      const nuevo = avanzarRcp(logicoRef.current);
      logicoRef.current = nuevo;
      colaRef.current.push({ t, estado: nuevo });
      const intervalo = intervaloSegundos(ritmoRef.current);
      if (!nuevo.respirando && !silencioRef.current) {
        beep(ctx, t, nuevo.compresion === 1);
      }
      proximoRef.current = t + (nuevo.respirando ? PAUSA_RESPIRACIONES_S : intervalo);
    }
  }, [beep]);

  const liberarLock = useCallback(() => {
    lockRef.current?.release().catch(() => {});
    lockRef.current = null;
  }, []);

  const detener = useCallback(() => {
    if (timerRef.current !== null) window.clearInterval(timerRef.current);
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    timerRef.current = null;
    rafRef.current = null;
    colaRef.current = [];
    ultimoLatidoRef.current = null;
    ctxRef.current?.close().catch(() => {});
    ctxRef.current = null;
    liberarLock();
    if (circuloRef.current) circuloRef.current.style.transform = 'scale(1)';
    setCorriendo(false);
    setEstado(ESTADO_RCP_INICIAL);
  }, [liberarLock]);

  const iniciar = useCallback(async () => {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    try { await ctx.resume(); } catch { /* sigue sin audio */ }
    ctxRef.current = ctx;
    logicoRef.current = ESTADO_RCP_INICIAL;
    colaRef.current = [];
    proximoRef.current = ctx.currentTime + 0.1;
    setEstado(ESTADO_RCP_INICIAL);
    setCorriendo(true);

    try {
      const wl = (navigator as unknown as { wakeLock?: { request: (t: 'screen') => Promise<WakeLockLike> } }).wakeLock;
      if (wl) lockRef.current = await wl.request('screen');
    } catch { /* sin Wake Lock */ }

    programar();
    timerRef.current = window.setInterval(programar, PASO_MS);

    const cuadro = () => {
      const c = ctxRef.current;
      if (!c) return;
      const cola = colaRef.current;
      while (cola.length && cola[0].t <= c.currentTime) {
        const ev = cola.shift()!;
        setEstado(ev.estado);
        if (!ev.estado.respirando) {
          ultimoLatidoRef.current = { t: ev.t, dur: intervaloSegundos(ritmoRef.current) };
          if (!silencioRef.current && typeof navigator.vibrate === 'function') navigator.vibrate(30);
        } else {
          ultimoLatidoRef.current = null;
        }
      }
      const el = circuloRef.current;
      const l = ultimoLatidoRef.current;
      if (el) {
        if (l) {
          const fase = Math.min(1, Math.max(0, (c.currentTime - l.t) / l.dur));
          // contracción rápida al compás y regreso suave
          const escala = fase < 0.25 ? 1 - 0.22 * (fase / 0.25) : 0.78 + 0.22 * ((fase - 0.25) / 0.75);
          el.style.transform = `scale(${escala})`;
        } else {
          el.style.transform = 'scale(1)';
        }
      }
      rafRef.current = requestAnimationFrame(cuadro);
    };
    rafRef.current = requestAnimationFrame(cuadro);
  }, [programar]);

  // El wake lock se pierde si la pestaña se oculta: se pide de nuevo al volver.
  useEffect(() => {
    if (!corriendo) return;
    const alVolver = async () => {
      if (document.visibilityState !== 'visible' || lockRef.current) return;
      try {
        const wl = (navigator as unknown as { wakeLock?: { request: (t: 'screen') => Promise<WakeLockLike> } }).wakeLock;
        if (wl) lockRef.current = await wl.request('screen');
      } catch { /* nada */ }
    };
    document.addEventListener('visibilitychange', alVolver);
    return () => document.removeEventListener('visibilitychange', alVolver);
  }, [corriendo]);

  // Limpieza al desmontar.
  useEffect(() => detener, [detener]);

  // Anuncio accesible: solo al iniciar, en cada respiración y al reiniciar ciclo.
  const anuncio = !corriendo
    ? ''
    : estado.respirando
      ? '2 respiraciones'
      : estado.compresion === 1
        ? `Compresiones, ciclo ${estado.ciclos + 1}`
        : '';

  return (
    <div className="rounded-2xl border-2 border-danger bg-elevated px-4 py-4 flex flex-col gap-3 items-center">
      <p className="text-sm font-bold text-strong self-start">Metrónomo de compresiones</p>

      {!corriendo ? (
        <button
          type="button"
          onClick={iniciar}
          className="w-full min-h-[64px] rounded-xl border border-danger bg-danger text-white text-base font-bold px-4 py-4 hover:brightness-110 transition"
        >
          Iniciar ritmo de compresiones
        </button>
      ) : (
        <>
          <div className="relative flex items-center justify-center w-44 h-44">
            <div
              ref={circuloRef}
              className={cn(
                'absolute inset-0 rounded-full border-4 border-danger will-change-transform',
                estado.respirando ? 'bg-info-soft' : 'bg-danger',
              )}
              aria-hidden="true"
            />
            <div className="relative text-center text-white font-bold leading-tight px-2">
              {estado.respirando ? (
                <span className="text-xl text-strong">2 respiraciones</span>
              ) : (
                <>
                  <span className="text-5xl tabular-nums">{estado.compresion}</span>
                  <span className="block text-xs opacity-90">de {COMPRESIONES_POR_CICLO}</span>
                </>
              )}
            </div>
          </div>
          <div className="flex gap-2 w-full">
            <button
              type="button"
              onClick={detener}
              className="flex-1 min-h-[56px] rounded-xl border border-line bg-elevated text-strong text-base font-bold hover:brightness-110 transition"
            >
              Detener
            </button>
            <button
              type="button"
              onClick={() => setSilencio(s => !s)}
              aria-pressed={silencio}
              className="min-h-[56px] rounded-xl border border-line bg-elevated text-strong text-sm font-semibold px-4 hover:brightness-110 transition"
            >
              {silencio ? 'Activar sonido' : 'Silenciar'}
            </button>
          </div>
        </>
      )}

      <div className="flex items-center gap-1.5" role="group" aria-label="Ritmo por minuto">
        <span className="text-[11px] text-muted mr-1">Ritmo</span>
        {RITMOS_RCP.map(r => (
          <button
            key={r}
            type="button"
            onClick={() => setRitmo(r)}
            aria-pressed={ritmo === r}
            className={cn(
              'min-h-[36px] rounded-full border px-3 text-xs font-semibold transition',
              ritmo === r ? 'border-danger bg-danger text-white' : 'border-line bg-elevated text-soft',
            )}
          >
            {r}
          </button>
        ))}
        <span className="text-[11px] text-muted ml-1">por min</span>
      </div>

      <p className="text-xs text-soft leading-relaxed text-center">
        Comprima fuerte y rápido en el centro del pecho. Llame al 123.
      </p>

      <span className="sr-only" role="status" aria-live="polite">{anuncio}</span>
    </div>
  );
}
