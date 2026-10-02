import { useCallback, useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import {
  GRUPOS_EDAD,
  TOQUES_MINIMOS,
  clasificarPulso,
  formatearRegistro,
  lpmPorConteo,
  lpmPorToques,
} from '../data/tomaPulso';
import { AnadirABitacora } from './botiquin/compartido';
import type { GrupoEdad, MedicionPulso, ModoPulso, Semaforo } from '../data/tomaPulso';

type WakeLockLike = { release: () => Promise<void> };
type Fase = 'espera' | 'contando' | 'pidiendo' | 'resultado';

const CLAVE = 'mjb_toma_pulso_registro';
const DURACIONES = [15, 30, 60] as const;

const ESTILO: Record<Semaforo, { caja: string; titulo: string; texto: string }> = {
  normal: { caja: 'border-success bg-success-soft', titulo: 'Normal', texto: 'Dentro de lo esperado en reposo.' },
  vigilar: { caja: 'border-warning bg-warning-soft', titulo: 'Vigilar', texto: 'Fuera de lo habitual. Deje que descanse 5 minutos y vuelva a medir.' },
  alerta: {
    caja: 'border-danger bg-danger-soft',
    titulo: 'Alerta',
    texto: 'Pulso de alerta. Si además está pálido, sudoroso, confundido, con dolor en el pecho, mareo o le falta el aire, llame al 123.',
  },
};
const FG: Record<Semaforo, string> = { normal: 'text-success-soft-fg', vigilar: 'text-warning-soft-fg', alerta: 'text-danger-soft-fg' };

function cargar(): MedicionPulso[] {
  try {
    const v = sessionStorage.getItem(CLAVE);
    return v ? (JSON.parse(v) as MedicionPulso[]) : [];
  } catch { return []; }
}

function horaAhora() {
  return new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: false });
}

/** Toma de pulso en reposo. Los datos viven solo en memoria / sessionStorage; nunca se envían a un servidor. */
export default function TomaPulso() {
  const [edad, setEdad] = useState<GrupoEdad | null>(null);
  const [modo, setModo] = useState<ModoPulso>('temporizador');
  const [segundos, setSegundos] = useState<number>(15);
  const [fase, setFase] = useState<Fase>('espera');
  const [restante, setRestante] = useState(0);
  const [latidos, setLatidos] = useState('');
  const [lpm, setLpm] = useState<number | null>(null);
  const [toques, setToques] = useState<number[]>([]);
  const [registro, setRegistro] = useState<MedicionPulso[]>(cargar);
  const [copiado, setCopiado] = useState(false);

  const ctxRef = useRef<AudioContext | null>(null);
  const timerRef = useRef<number | null>(null);
  const lockRef = useRef<WakeLockLike | null>(null);

  useEffect(() => {
    try { sessionStorage.setItem(CLAVE, JSON.stringify(registro)); } catch { /* sin sessionStorage */ }
  }, [registro]);

  const liberarLock = useCallback(() => {
    lockRef.current?.release().catch(() => {});
    lockRef.current = null;
  }, []);
  const pedirLock = useCallback(async () => {
    try {
      const wl = (navigator as unknown as { wakeLock?: { request: (t: 'screen') => Promise<WakeLockLike> } }).wakeLock;
      if (wl && !lockRef.current) lockRef.current = await wl.request('screen');
    } catch { /* sin Wake Lock */ }
  }, []);

  const pitar = useCallback((hz: number) => {
    const ctx = ctxRef.current;
    if (!ctx) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = hz;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.2, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
    osc.connect(g).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.3);
  }, []);

  const parar = useCallback(() => {
    if (timerRef.current !== null) window.clearInterval(timerRef.current);
    timerRef.current = null;
    liberarLock();
  }, [liberarLock]);

  useEffect(() => () => {
    parar();
    ctxRef.current?.close().catch(() => {});
  }, [parar]);

  const registrar = useCallback((valor: number, m: ModoPulso, e: GrupoEdad, irr: boolean) => {
    setRegistro(r => [...r, { hora: horaAhora(), lpm: valor, modo: m, edad: e, semaforo: clasificarPulso(valor, e), irregular: irr || undefined }]);
  }, []);

  const empezar = useCallback(async () => {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (AC && !ctxRef.current) ctxRef.current = new AC();
    try { await ctxRef.current?.resume(); } catch { /* sin audio */ }
    void pedirLock();
    const fin = performance.now() + segundos * 1000;
    setRestante(segundos);
    setFase('contando');
    pitar(880);
    if (typeof navigator.vibrate === 'function') navigator.vibrate(150);
    timerRef.current = window.setInterval(() => {
      const r = Math.max(0, Math.ceil((fin - performance.now()) / 1000));
      setRestante(r);
      if (r <= 0) {
        parar();
        pitar(660);
        if (typeof navigator.vibrate === 'function') navigator.vibrate([200, 100, 200]);
        setLatidos('');
        setFase('pidiendo');
      }
    }, 200);
  }, [segundos, pitar, parar, pedirLock]);

  const cancelar = useCallback(() => {
    parar();
    setFase('espera');
  }, [parar]);

  const confirmarConteo = () => {
    const n = parseInt(latidos, 10);
    if (!edad || !Number.isFinite(n) || n <= 0) return;
    const v = lpmPorConteo(n, segundos);
    setLpm(v);
    registrar(v, 'temporizador', edad, false);
    setFase('resultado');
  };

  const tocar = () => {
    if (typeof navigator.vibrate === 'function') navigator.vibrate(20);
    if (toques.length === 0) void pedirLock();
    setToques(t => [...t, performance.now()]);
  };
  const resTocar = lpmPorToques(toques);
  const reiniciarToques = () => { setToques([]); liberarLock(); };

  const nuevaMedicion = () => { setFase('espera'); setLpm(null); setLatidos(''); reiniciarToques(); };
  const cambiarModo = (m: ModoPulso) => { cancelar(); setModo(m); setLpm(null); reiniciarToques(); };

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(formatearRegistro(registro));
      setCopiado(true);
      window.setTimeout(() => setCopiado(false), 2000);
    } catch { /* sin portapapeles */ }
  };

  const boton = 'min-h-[56px] rounded-xl border font-bold text-base px-4 transition hover:brightness-110';
  const chip = (act: boolean) => cn('min-h-[44px] rounded-full border px-4 text-sm font-semibold transition', act ? 'border-accent bg-accent text-accent-fg' : 'border-line bg-card text-soft');

  const valorVivo = modo === 'temporizador' ? (fase === 'resultado' ? lpm : null) : resTocar?.lpm ?? null;
  const irrVivo = modo === 'toques' ? resTocar?.irregular ?? false : false;
  const sem = edad && valorVivo !== null ? clasificarPulso(valorVivo, edad) : null;

  const anuncioCuenta = fase === 'contando' && restante <= 5 ? `${restante}` : '';

  return (
    <div className="rounded-2xl border-2 border-danger bg-elevated px-4 py-4 flex flex-col gap-3">
      <p className="text-sm font-bold text-strong">Toma de pulso</p>
      <p className="text-xs text-soft leading-relaxed">
        Dos dedos (no el pulgar) en la muñeca, del lado del pulgar, o en el cuello al lado de la tráquea. Persona en reposo.
      </p>

      <div role="group" aria-label="Edad del afectado" className="flex flex-wrap gap-2">
        {GRUPOS_EDAD.map(g => (
          <button key={g.id} type="button" aria-pressed={edad === g.id} onClick={() => setEdad(g.id)} className={chip(edad === g.id)}>
            {g.etiqueta}
          </button>
        ))}
      </div>

      {!edad ? (
        <p className="text-xs text-muted">Elija la edad para empezar.</p>
      ) : (
        <>
          <div role="group" aria-label="Modo de medición" className="flex flex-wrap gap-2">
            <button type="button" aria-pressed={modo === 'temporizador'} onClick={() => cambiarModo('temporizador')} className={chip(modo === 'temporizador')}>Contar con temporizador</button>
            <button type="button" aria-pressed={modo === 'toques'} onClick={() => cambiarModo('toques')} className={chip(modo === 'toques')}>Tocar en cada latido</button>
          </div>

          {modo === 'temporizador' && (
            <div className="flex flex-col gap-3">
              {fase === 'espera' && (
                <>
                  <div role="group" aria-label="Duración" className="flex items-center gap-2 flex-wrap">
                    {DURACIONES.map(d => (
                      <button key={d} type="button" aria-pressed={segundos === d} onClick={() => setSegundos(d)} className={chip(segundos === d)}>{d} s</button>
                    ))}
                    <span className="text-[11px] text-muted">60 s si el pulso es irregular</span>
                  </div>
                  <button type="button" onClick={empezar} className={cn(boton, 'min-h-[64px] w-full border-danger bg-danger text-white')}>Empezar</button>
                </>
              )}
              {fase === 'contando' && (
                <>
                  <p className="text-xs text-soft text-center">Cuente los latidos hasta que suene el pitido.</p>
                  <p className="text-center text-7xl font-bold tabular-nums text-strong" aria-hidden="true">{restante}</p>
                  <span className="sr-only" role="status" aria-live="assertive">{anuncioCuenta}</span>
                  <button type="button" onClick={cancelar} className={cn(boton, 'border-line bg-card text-strong')}>Cancelar</button>
                </>
              )}
              {fase === 'pidiendo' && (
                <>
                  <label htmlFor="pulso-latidos" className="text-base font-bold text-strong text-center">¿Cuántos latidos contó?</label>
                  <input
                    id="pulso-latidos"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    autoFocus
                    value={latidos}
                    onChange={e => setLatidos(e.target.value.replace(/\D/g, '').slice(0, 3))}
                    className="w-full min-h-[72px] rounded-xl border-2 border-line bg-card text-strong text-center text-4xl font-bold tabular-nums"
                  />
                  <button type="button" onClick={confirmarConteo} disabled={!latidos} className={cn(boton, 'min-h-[64px] border-accent bg-accent text-accent-fg disabled:opacity-50')}>Calcular</button>
                </>
              )}
              {fase === 'resultado' && (
                <button type="button" onClick={nuevaMedicion} className={cn(boton, 'border-line bg-card text-strong')}>Nueva medición</button>
              )}
            </div>
          )}

          {modo === 'toques' && (
            <div className="flex flex-col gap-3">
              <button
                type="button"
                onClick={tocar}
                className="w-full min-h-[160px] rounded-2xl border-4 border-danger bg-danger text-white text-2xl font-bold active:scale-95 transition-transform select-none touch-manipulation"
              >
                Toque con cada latido
                <span className="block text-sm font-semibold opacity-90 mt-1">{toques.length} toques</span>
              </button>
              {toques.length > 0 && toques.length < TOQUES_MINIMOS && (
                <p className="text-xs text-soft text-center">Siga tocando: faltan {TOQUES_MINIMOS - toques.length} toques como mínimo.</p>
              )}
              {resTocar && edad && (
                <div className="flex gap-2">
                  <button type="button" onClick={() => registrar(resTocar.lpm, 'toques', edad, resTocar.irregular)} className={cn(boton, 'flex-1 border-accent bg-accent text-accent-fg')}>Guardar en el registro</button>
                  <button type="button" onClick={reiniciarToques} className={cn(boton, 'border-line bg-card text-strong')}>Reiniciar</button>
                </div>
              )}
              {!resTocar && toques.length > 0 && (
                <button type="button" onClick={reiniciarToques} className={cn(boton, 'border-line bg-card text-strong')}>Reiniciar</button>
              )}
            </div>
          )}

          <div role="status" aria-live="polite">
            {sem && valorVivo !== null && (
              <div className={cn('rounded-xl border-2 px-4 py-3 flex flex-col gap-2', ESTILO[sem].caja)}>
                <p className={cn('text-4xl font-bold tabular-nums', FG[sem])}>{valorVivo} <span className="text-base">lpm</span></p>
                <p className={cn('text-sm font-bold', FG[sem])}>{ESTILO[sem].titulo}</p>
                <p className={cn('text-sm leading-relaxed', FG[sem])}>{ESTILO[sem].texto}</p>
                {irrVivo && (
                  <p className={cn('text-sm font-semibold', FG[sem])}>Ritmo irregular: cuente 60 s con el temporizador.</p>
                )}
                <AnadirABitacora detalle={`Pulso: ${valorVivo} lpm (${ESTILO[sem].titulo})`} />
                {sem === 'alerta' && (
                  <a href="tel:123" className="min-h-[56px] rounded-xl bg-danger text-white text-base font-bold flex items-center justify-center">Llamar al 123</a>
                )}
              </div>
            )}
          </div>
        </>
      )}

      <p className="text-xs text-soft leading-relaxed">Después de correr o de un susto el pulso sube; mida en reposo.</p>
      <p className="text-xs text-soft leading-relaxed">Si no encuentra el pulso y la persona no responde ni respira normal: inicie reanimación y llame al 123.</p>
      <p className="text-[11px] text-muted">Orientativo; no reemplaza la valoración de salud.</p>

      {registro.length > 0 && (
        <div className="border-t border-line pt-3 flex flex-col gap-2">
          <p className="text-xs font-bold text-strong">Registro de esta sesión</p>
          <ul className="flex flex-col gap-1">
            {registro.map((m, i) => (
              <li key={i} className="text-xs text-soft flex flex-wrap gap-x-2">
                <span className="tabular-nums">{m.hora}</span>
                <span className={cn('font-bold', FG[m.semaforo])}>{m.lpm} lpm</span>
                <span>{m.modo === 'toques' ? 'toques' : 'conteo'}</span>
                <span>{GRUPOS_EDAD.find(g => g.id === m.edad)?.etiqueta}</span>
                <span>{ESTILO[m.semaforo].titulo}{m.irregular ? ' (irregular)' : ''}</span>
              </li>
            ))}
          </ul>
          <div className="flex gap-2">
            <button type="button" onClick={copiar} className={cn(boton, 'flex-1 border-line bg-card text-strong')}>{copiado ? 'Copiado' : 'Copiar registro'}</button>
            <button type="button" onClick={() => setRegistro([])} className={cn(boton, 'border-line bg-card text-strong')}>Borrar registro</button>
          </div>
          <p className="text-[11px] text-muted">Solo queda en este dispositivo y se borra al cerrar la pestaña; no se envía a ningún servidor.</p>
        </div>
      )}
    </div>
  );
}
