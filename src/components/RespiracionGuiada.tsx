import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  MENSAJE_A_LOS_S,
  TECNICAS_RESPIRACION,
  TECNICA_DEFECTO,
  TEXTO_FASE,
  buscarTecnica,
  estadoEn,
} from '../data/respiracionGuiada';
import type { TipoFase } from '../data/respiracionGuiada';

// Colores calmados por fase (nada de rojo). Se usan como relleno translúcido + borde.
const COLOR_FASE: Record<TipoFase, string> = {
  inhala: '56,189,248', // celeste
  inhala2: '45,212,191', // turquesa
  sostén: '167,139,250', // lavanda
  exhala: '52,211,153', // verde menta
};
const FRECUENCIA: Record<TipoFase, number> = { inhala: 330, inhala2: 392, sostén: 262, exhala: 247 };

type WakeLockLike = { release: () => Promise<void> };
const RADIO = 46;
const LARGO = 2 * Math.PI * RADIO;

/** Botón de entrada + pantalla completa con la respiración guiada. */
export function RespiracionGuiada() {
  const [abierta, setAbierta] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setAbierta(true)}
        className="w-full rounded-2xl border border-line bg-elevated px-4 py-4 flex items-center gap-3 text-left hover:brightness-110 transition"
      >
        <span className="text-2xl" aria-hidden="true">🌬️</span>
        <span className="flex flex-col">
          <span className="text-sm font-bold text-strong">Respiración guiada</span>
          <span className="text-xs text-soft">Para respirar junto al estudiante · pantalla completa</span>
        </span>
      </button>
      {abierta && <PantallaRespiracion onCerrar={() => setAbierta(false)} />}
    </>
  );
}

function PantallaRespiracion({ onCerrar }: { onCerrar: () => void }) {
  const [tecnicaId, setTecnicaId] = useState(TECNICA_DEFECTO);
  const [corriendo, setCorriendo] = useState(false);
  const [sonido, setSonido] = useState(false);
  const [vibrar, setVibrar] = useState(false);
  const [vista, setVista] = useState({ fase: 'inhala' as TipoFase, seg: 4, ciclo: 0 });
  const [mensaje, setMensaje] = useState(false);

  const tecnica = buscarTecnica(tecnicaId);
  const reducido = typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  const circuloRef = useRef<HTMLDivElement | null>(null);
  const anilloRef = useRef<SVGCircleElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const lockRef = useRef<WakeLockLike | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const acumRef = useRef(0); // ms acumulados antes de la última reanudación
  const inicioRef = useRef(0);
  const ultimaRef = useRef({ ciclo: -1, i: -1, seg: -1 });
  const sonidoRef = useRef(sonido);
  const vibrarRef = useRef(vibrar);
  const mensajeRef = useRef(false);
  const tecnicaRef = useRef(tecnicaId);
  sonidoRef.current = sonido;
  vibrarRef.current = vibrar;
  tecnicaRef.current = tecnicaId;

  const pedirLock = useCallback(async () => {
    try {
      const wl = (navigator as unknown as { wakeLock?: { request: (t: 'screen') => Promise<WakeLockLike> } }).wakeLock;
      if (wl && !lockRef.current) lockRef.current = await wl.request('screen');
    } catch { /* sin Wake Lock */ }
  }, []);
  const soltarLock = useCallback(() => {
    lockRef.current?.release().catch(() => {});
    lockRef.current = null;
  }, []);

  const tono = useCallback((tipo: TipoFase) => {
    try {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      if (!ctxRef.current) ctxRef.current = new AC();
      const ctx = ctxRef.current;
      if (ctx.state === 'suspended') void ctx.resume();
      const t = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = FRECUENCIA[tipo];
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.12, t + 0.08);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.7);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.75);
    } catch { /* sin audio */ }
  }, []);

  const parar = useCallback(() => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    soltarLock();
  }, [soltarLock]);

  const bucle = useCallback(() => {
    const t = buscarTecnica(tecnicaRef.current);
    const s = (acumRef.current + (performance.now() - inicioRef.current)) / 1000;
    const e = estadoEn(t, s);
    const u = ultimaRef.current;
    if (e.ciclo !== u.ciclo || e.indiceFase !== u.i || e.segRestantes !== u.seg) {
      const cambioFase = e.ciclo !== u.ciclo || e.indiceFase !== u.i;
      ultimaRef.current = { ciclo: e.ciclo, i: e.indiceFase, seg: e.segRestantes };
      setVista({ fase: e.fase.tipo, seg: e.segRestantes, ciclo: e.ciclo });
      if (cambioFase) {
        if (sonidoRef.current) tono(e.fase.tipo);
        if (vibrarRef.current && typeof navigator.vibrate === 'function') navigator.vibrate(25);
      }
    }
    if (s >= MENSAJE_A_LOS_S && !mensajeRef.current) {
      mensajeRef.current = true;
      setMensaje(true);
    }
    if (circuloRef.current && !reducido) circuloRef.current.style.transform = `scale(${e.escala})`;
    const an = anilloRef.current;
    if (an) {
      const sostener = e.fase.tipo === 'sostén';
      an.style.strokeDashoffset = sostener ? String(LARGO * (1 - e.progreso)) : String(LARGO);
      an.style.opacity = sostener ? '1' : '0';
    }
    rafRef.current = requestAnimationFrame(bucle);
  }, [reducido, tono]);

  const empezar = useCallback(() => {
    inicioRef.current = performance.now();
    setCorriendo(true);
    void pedirLock();
    rafRef.current = requestAnimationFrame(bucle);
  }, [bucle, pedirLock]);

  const pausar = useCallback(() => {
    acumRef.current += performance.now() - inicioRef.current;
    parar();
    setCorriendo(false);
  }, [parar]);

  const reiniciar = useCallback(() => {
    acumRef.current = 0;
    ultimaRef.current = { ciclo: -1, i: -1, seg: -1 };
    mensajeRef.current = false;
    setMensaje(false);
    const e = estadoEn(buscarTecnica(tecnicaRef.current), 0);
    setVista({ fase: e.fase.tipo, seg: e.segRestantes, ciclo: 0 });
    if (circuloRef.current && !reducido) circuloRef.current.style.transform = `scale(${e.escala})`;
    if (anilloRef.current) anilloRef.current.style.opacity = '0';
  }, [reducido]);

  const elegirTecnica = (id: string) => {
    if (id === tecnicaId) return;
    parar();
    tecnicaRef.current = id;
    setTecnicaId(id);
    setCorriendo(false);
    reiniciar();
  };

  // Posición inicial del círculo y limpieza.
  useEffect(() => {
    reiniciar();
    return () => {
      parar();
      ctxRef.current?.close().catch(() => {});
      ctxRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Esc cierra; el Wake Lock se pide de nuevo al volver a la pestaña.
  useEffect(() => {
    const tecla = (ev: KeyboardEvent) => { if (ev.key === 'Escape') onCerrar(); };
    const visible = () => { if (document.visibilityState === 'visible' && rafRef.current !== null) void pedirLock(); };
    window.addEventListener('keydown', tecla);
    document.addEventListener('visibilitychange', visible);
    return () => {
      window.removeEventListener('keydown', tecla);
      document.removeEventListener('visibilitychange', visible);
    };
  }, [onCerrar, pedirLock]);

  const color = COLOR_FASE[vista.fase];
  const inicial = !corriendo && acumRef.current === 0;
  // Anuncio accesible solo por fase (no por segundo).
  const anuncio = corriendo ? TEXTO_FASE[vista.fase] : '';

  // Portal a <body>: bajo un ancestro con transform, `fixed` no cubriría la pantalla.
  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Respiración guiada"
      className="fixed inset-0 z-50 overflow-auto bg-app text-strong flex flex-col"
    >
      <div className="flex items-center justify-between gap-2 px-4 pt-4">
        <p className="text-sm font-semibold text-soft">Respiración guiada · unos 2–5 minutos</p>
        <button
          type="button"
          onClick={onCerrar}
          className="min-h-[44px] flex items-center gap-1.5 rounded-xl border border-line bg-elevated px-4 text-sm font-semibold text-strong"
        >
          <X size={16} /> Cerrar
        </button>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center gap-5 px-4 py-4">
        <p
          className="text-4xl sm:text-5xl font-bold text-center min-h-[1.2em] transition-colors duration-700"
          style={{ color: `rgb(${color})` }}
          aria-hidden="true"
        >
          {inicial ? 'Respira conmigo' : TEXTO_FASE[vista.fase]}
        </p>

        <div className="relative flex items-center justify-center w-[min(72vw,52vh,360px)] aspect-square">
          <div
            ref={circuloRef}
            aria-hidden="true"
            className="absolute inset-0 rounded-full will-change-transform"
            style={{
              background: `rgba(${color},0.28)`,
              border: `4px solid rgba(${color},0.9)`,
              boxShadow: `0 0 60px rgba(${color},0.35)`,
              transition: 'background 0.7s ease, border-color 0.7s ease, box-shadow 0.7s ease',
            }}
          />
          <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full -rotate-90" aria-hidden="true">
            <circle
              ref={anilloRef}
              cx="50" cy="50" r={RADIO} fill="none" strokeWidth="2.5" strokeLinecap="round"
              stroke={`rgb(${color})`}
              strokeDasharray={LARGO}
              style={{ strokeDashoffset: LARGO, opacity: 0 }}
            />
          </svg>
          <span className="relative text-7xl sm:text-8xl font-bold tabular-nums text-strong" aria-hidden="true">
            {inicial ? '' : vista.seg}
          </span>
        </div>

        <div className="h-6 text-center">
          {mensaje ? (
            <p className="text-lg font-semibold text-strong">¿Cómo te sientes? Puedes seguir o parar cuando quieras.</p>
          ) : !inicial ? (
            <p className="text-xs text-muted">Ciclo {vista.ciclo + 1}</p>
          ) : null}
        </div>

        <button
          type="button"
          onClick={corriendo ? pausar : empezar}
          className={cn(
            'w-full max-w-sm min-h-[64px] rounded-2xl text-lg font-bold px-6 py-4 transition hover:brightness-110',
            corriendo ? 'border border-line bg-elevated text-strong' : 'bg-accent text-accent-fg',
          )}
        >
          {corriendo ? 'Pausar' : inicial ? 'Empezar' : 'Seguir'}
        </button>

        <div className="flex flex-wrap justify-center gap-2" role="group" aria-label="Técnica de respiración">
          {TECNICAS_RESPIRACION.map(t => (
            <button
              key={t.id}
              type="button"
              onClick={() => elegirTecnica(t.id)}
              aria-pressed={tecnicaId === t.id}
              className={cn(
                'min-h-[40px] rounded-full border px-4 text-sm font-semibold transition',
                tecnicaId === t.id ? 'border-accent bg-accent text-accent-fg' : 'border-line bg-elevated text-soft',
              )}
            >
              {t.nombre}{t.id === TECNICA_DEFECTO ? ' ★' : ''}
            </button>
          ))}
        </div>
        <p className="text-sm text-soft text-center max-w-md">
          <strong className="text-strong">{tecnica.nombre} {tecnica.patron}.</strong> {tecnica.explicacion}
          {tecnica.id === TECNICA_DEFECTO && ' Recomendada para estudiantes.'}
        </p>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setSonido(s => !s)}
            aria-pressed={sonido}
            className="min-h-[40px] rounded-xl border border-line bg-elevated px-4 text-sm font-semibold text-strong"
          >
            {sonido ? 'Sonido: sí' : 'Sonido: no'}
          </button>
          {typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function' && (
            <button
              type="button"
              onClick={() => setVibrar(v => !v)}
              aria-pressed={vibrar}
              className="min-h-[40px] rounded-xl border border-line bg-elevated px-4 text-sm font-semibold text-strong"
            >
              {vibrar ? 'Vibración: sí' : 'Vibración: no'}
            </button>
          )}
        </div>
      </div>

      <div className="px-4 pb-4 text-center text-[11px] text-muted leading-relaxed">
        <p>Si el estudiante no puede respirar, tiene silbidos, labios morados o se desmaya, no es ansiedad: llame al 123.</p>
        <p>Si se marea, vuelva a respirar normal.</p>
      </div>

      <span className="sr-only" role="status" aria-live="polite">{anuncio}</span>
    </div>,
    document.body,
  );
}
