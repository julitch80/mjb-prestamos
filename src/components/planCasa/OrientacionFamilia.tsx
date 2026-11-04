// Orientación a las familias dentro de la agenda pública: hora de estudio, sugerencias,
// pildorita del día, temporizador de un momento y «¿cómo me fue hoy?».
// Todo se guarda solo en este dispositivo (ver data/planCasa/orientacionFamilia.ts).
import { useCallback, useEffect, useRef, useState } from 'react';
import { Lightbulb, AlarmClock, X, Play, Pause, RotateCcw } from 'lucide-react';
import {
  CARITAS, GRUPOS_SUGERENCIA, SEGUNDOS_MOMENTO, SEGUNDOS_PAUSA, SUGERENCIAS, conDia, conHabitual, formatearHora,
  formatoReloj, guardarCarita, guardarHorario, horaDeDia, horaValida, leerCaritas, leerHorario, pildoraDelDia,
  podarHorario, rangoEstudio, type Carita, type HorarioEstudio,
} from '../../data/planCasa/orientacionFamilia';
import type { FechaISO } from '../../data/planCasa/tipos';

/** Horario de estudio guardado por token. `hoy` sirve para podar ajustes de días pasados. */
export function useHorarioEstudio(clave: string, hoy: FechaISO) {
  const [horario, setHorario] = useState<HorarioEstudio>(() => podarHorario(leerHorario(clave), hoy));
  const cambiar = useCallback((fn: (h: HorarioEstudio) => HorarioEstudio) => {
    setHorario(prev => { const nuevo = fn(prev); guardarHorario(clave, nuevo); return nuevo; });
  }, [clave]);
  return {
    horario,
    horaDe: (f: FechaISO) => horaDeDia(horario, f),
    fijarHabitual: (h: string | null) => cambiar(x => conHabitual(x, h)),
    fijarDia: (f: FechaISO, h: string | null | undefined) => cambiar(x => conDia(x, f, h)),
  };
}

type Horario = ReturnType<typeof useHorarioEstudio>;

const boton = 'min-h-[44px] px-4 rounded-xl border text-base font-semibold';
const botonSuave = `${boton} bg-card border-line text-strong`;
const botonAccent = `${boton} bg-accent/20 border-accent/60 text-strong`;

/** «Tu hora de estudio hoy: 3:00 p. m.» con la forma de cambiarla. */
export function HoraDeEstudio({ h, dia, esHoy, momentos }: { h: Horario; dia: FechaISO; esHoy: boolean; momentos: number }) {
  const hora = h.horaDe(dia);
  const [abierto, setAbierto] = useState(false);
  const [valor, setValor] = useState(hora ?? h.horario.habitual ?? '15:00');
  useEffect(() => { setAbierto(false); setValor(h.horaDe(dia) ?? h.horario.habitual ?? '15:00'); }, [dia]); // eslint-disable-line react-hooks/exhaustive-deps
  const cuando = esHoy ? 'hoy' : 'ese día';
  const propia = Object.prototype.hasOwnProperty.call(h.horario.porDia, dia);

  return (
    <div className="rounded-2xl border border-accent/40 bg-accent/10 p-4 space-y-3">
      <div className="flex items-start gap-3">
        <AlarmClock size={22} className="mt-0.5 flex-shrink-0 text-accent" aria-hidden />
        <div className="flex-1 min-w-0">
          {hora ? (
            <>
              <p className="text-base font-bold text-strong">Tu hora de estudio {cuando}: {formatearHora(hora)}</p>
              <p className="text-sm text-soft">{rangoEstudio(hora, momentos)} · {momentos} {momentos === 1 ? 'momento' : 'momentos'}{propia ? ' · ajustada para este día' : ''}</p>
            </>
          ) : propia ? (
            <p className="text-base font-bold text-strong">{esHoy ? 'Hoy' : 'Ese día'} sin hora fija de estudio</p>
          ) : (
            <>
              <p className="text-base font-bold text-strong">¿A qué hora van a estudiar {cuando}?</p>
              <p className="text-sm text-soft">Elegir una hora, en familia, ayuda a que el momento de estudio llegue sin pelear.</p>
            </>
          )}
        </div>
      </div>
      {!abierto ? (
        <button onClick={() => setAbierto(true)} className={botonAccent}>{hora ? 'Cambiar la hora' : 'Elegir la hora'}</button>
      ) : (
        <div className="space-y-2">
          <label htmlFor="hora-estudio" className="block text-sm font-semibold text-strong">Hora de inicio</label>
          <input id="hora-estudio" type="time" value={valor} onChange={e => setValor(e.target.value)}
            className="min-h-[44px] rounded-lg border border-line bg-card text-strong px-3 text-base" />
          <div className="flex flex-wrap gap-2">
            <button disabled={!horaValida(valor)} onClick={() => { h.fijarHabitual(valor); h.fijarDia(dia, undefined); setAbierto(false); }}
              className={`${botonAccent} disabled:opacity-50`}>Todos los días</button>
            <button disabled={!horaValida(valor)} onClick={() => { h.fijarDia(dia, valor); setAbierto(false); }}
              className={`${botonSuave} disabled:opacity-50`}>Solo {esHoy ? 'hoy' : 'este día'}</button>
            <button onClick={() => { h.fijarDia(dia, null); setAbierto(false); }} className={botonSuave}>Sin hora {esHoy ? 'hoy' : 'ese día'}</button>
            {propia && <button onClick={() => { h.fijarDia(dia, undefined); setAbierto(false); }} className={botonSuave}>Volver a la habitual</button>}
            {h.horario.habitual && <button onClick={() => { h.fijarHabitual(null); setAbierto(false); }} className={botonSuave}>Quitar la hora habitual</button>}
          </div>
          <p className="text-xs text-muted">«Todos los días» fija la hora habitual; «Solo {esHoy ? 'hoy' : 'este día'}» no la cambia. Se guarda en este celular.</p>
        </div>
      )}
    </div>
  );
}

/** Pildorita corta que cambia cada día. */
export function PildoraDelDia({ fecha, clave, abrirSugerencias }: { fecha: FechaISO; clave: string; abrirSugerencias: () => void }) {
  const p = pildoraDelDia(fecha, SUGERENCIAS, clave);
  return (
    <div className="rounded-2xl border border-warning/40 bg-warning/10 p-4 space-y-1">
      <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-warning-soft-fg">
        <Lightbulb size={14} aria-hidden /> Pildorita del día
      </p>
      <p className="text-base font-bold text-strong">{p.titulo}</p>
      <p className="text-base text-soft">{p.texto}</p>
      <button onClick={abrirSugerencias} className="min-h-[44px] text-base font-semibold text-accent underline">Ver más sugerencias</button>
    </div>
  );
}

/** Ventana con todas las sugerencias, agrupadas. */
export function Sugerencias({ onCerrar }: { onCerrar: () => void }) {
  const cierre = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    cierre.current?.focus();
    const f = (e: KeyboardEvent) => { if (e.key === 'Escape') onCerrar(); };
    window.addEventListener('keydown', f);
    return () => window.removeEventListener('keydown', f);
  }, [onCerrar]);
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50" onClick={onCerrar}>
      <div role="dialog" aria-modal="true" aria-label="Sugerencias de estudio" onClick={e => e.stopPropagation()}
        className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl border border-line bg-card p-4 space-y-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 className="text-xl font-bold text-strong">Sugerencias de estudio</h2>
            <p className="text-sm text-soft">Ideas cortas para que la familia y el estudiante trabajen más tranquilos.</p>
          </div>
          <button ref={cierre} onClick={onCerrar} aria-label="Cerrar" className="min-h-[44px] min-w-[44px] rounded-xl border border-line bg-card text-strong flex items-center justify-center">
            <X size={20} />
          </button>
        </div>
        {GRUPOS_SUGERENCIA.map(g => (
          <section key={g.id} className="space-y-2" aria-label={g.titulo}>
            <h3 className="text-base font-bold text-strong">{g.icono} {g.titulo}</h3>
            {SUGERENCIAS.filter(s => s.grupo === g.id).map(s => (
              <div key={s.id} className="rounded-xl border border-accent/40 bg-accent/10 p-3">
                <p className="text-base font-semibold text-strong">{s.titulo}</p>
                <p className="text-base text-soft">{s.texto}</p>
              </div>
            ))}
          </section>
        ))}
        <button onClick={onCerrar} className={`${botonSuave} w-full`}>Cerrar</button>
      </div>
    </div>
  );
}

/** Temporizador de un momento: 25 minutos de trabajo y 5 de pausa. */
/** Sonido suave de aviso (dos notas). Solo suena si el usuario ya tocó la página (Empezar). */
function campana() {
  try {
    const Ctx = (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext);
    const ctx = new Ctx();
    [523.25, 783.99].forEach((f, k) => {
      const o = ctx.createOscillator(); const g = ctx.createGain();
      o.type = 'sine'; o.frequency.value = f;
      const t = ctx.currentTime + k * 0.35;
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.25, t + 0.03); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
      o.connect(g).connect(ctx.destination); o.start(t); o.stop(t + 1);
    });
    setTimeout(() => ctx.close().catch(() => {}), 2000);
  } catch { /* sin audio */ }
  try { navigator.vibrate?.([300, 150, 300]); } catch { /* sin vibración */ }
}

/** Sugerencias para la pausa de 5 minutos (cuerpo y respiración, con evidencia). */
const PAUSAS = SUGERENCIAS.filter(x => ['r2', 'r6', 'r3', 'b1'].includes(x.id));

/**
 * Temporizador de los momentos del día: «Momento N de T», campana al terminar, ofrece tachar el
 * momento en la lista, arranca solo la pausa de 5 min con una sugerencia y, tras el último
 * momento, felicita sin proponer otra pausa.
 */
export function TemporizadorMomento({ total = 1, hechos = 0, onTachar, extraPausa }: {
  /** Momentos del día y cuántos ya están tachados en la lista. */
  total?: number; hechos?: number;
  /** Tacha el siguiente momento pendiente en la lista de chequeo. */
  onTachar?: () => void;
  /** Lo que se muestra durante la pausa además de la sugerencia (p. ej. la respiración guiada). */
  extraPausa?: React.ReactNode;
}) {
  const [fase, setFase] = useState<'trabajo' | 'pausa' | 'fin'>('trabajo');
  const [segundos, setSegundos] = useState(SEGUNDOS_MOMENTO);
  const [corre, setCorre] = useState(false);
  const [porTachar, setPorTachar] = useState(false);
  const [aviso, setAviso] = useState('');
  const [nPausa, setNPausa] = useState(0);
  const fin = useRef(0);
  const actual = Math.min(total, hechos + 1);

  useEffect(() => {
    if (!corre) return;
    const id = setInterval(() => {
      const resto = Math.round((fin.current - Date.now()) / 1000); // por reloj real: sigue exacto si la pantalla se apaga
      if (resto > 0) { setSegundos(resto); return; }
      campana();
      if (fase === 'trabajo') {
        setPorTachar(!!onTachar && hechos < total);
        if (hechos + 1 >= total) {
          setCorre(false); setFase('fin'); setSegundos(0);
          setAviso('🎉 ¡Terminaste tus momentos de hoy! Revisa tu lista y, si tienes entrega, envíala.');
        } else {
          // La pausa arranca sola.
          setFase('pausa'); setSegundos(SEGUNDOS_PAUSA); fin.current = Date.now() + SEGUNDOS_PAUSA * 1000;
          setNPausa(n => n + 1);
          setAviso('¡Terminó el momento! Ahora 5 minutos de pausa.');
        }
      } else {
        setCorre(false); setFase('trabajo'); setSegundos(SEGUNDOS_MOMENTO);
        setAviso('La pausa terminó. Cuando estés listo, toca «Empezar» para el siguiente momento.');
      }
    }, 500);
    return () => clearInterval(id);
  }, [corre, fase, hechos, total, onTachar]);

  const alternar = () => {
    if (!corre) { fin.current = Date.now() + segundos * 1000; if (fase === 'trabajo') setAviso(''); }
    setCorre(c => !c);
  };
  const reiniciar = () => { setCorre(false); setFase('trabajo'); setSegundos(SEGUNDOS_MOMENTO); setAviso(''); setPorTachar(false); };
  const sugerencia = PAUSAS[nPausa % PAUSAS.length];

  return (
    <div className={`rounded-2xl border p-4 space-y-2 ${fase === 'pausa' ? 'border-sky-500/40 bg-sky-500/10' : fase === 'fin' ? 'border-success/40 bg-success/10' : 'border-line bg-card'}`}>
      <p className="text-sm font-semibold text-strong">
        {fase === 'trabajo' ? `Momento ${actual} de ${total} · 25 min` : fase === 'pausa' ? 'Pausa · 5 min' : 'Momentos de hoy completos'}
      </p>
      {fase !== 'fin' && (
        <div className="flex items-center gap-3">
          <span className="text-3xl font-bold tabular-nums text-strong" role="timer" aria-live="off">{formatoReloj(segundos)}</span>
          <button onClick={alternar} className={`${botonAccent} inline-flex items-center gap-1.5`}>
            {corre ? <><Pause size={16} /> Pausar</> : <><Play size={16} /> {segundos === (fase === 'trabajo' ? SEGUNDOS_MOMENTO : SEGUNDOS_PAUSA) ? 'Empezar' : 'Seguir'}</>}
          </button>
          <button onClick={reiniciar} aria-label="Reiniciar" className={`${botonSuave} px-3`}><RotateCcw size={16} /></button>
        </div>
      )}
      {aviso && <p className="text-sm text-strong" role="status">{aviso}</p>}
      {porTachar && (
        <button onClick={() => { onTachar?.(); setPorTachar(false); }} className={`${botonSuave} w-full`}>☑ Tachar el momento en mi lista</button>
      )}
      {fase === 'pausa' && (
        <div className="space-y-2">
          <p className="text-sm text-soft"><b className="text-strong">{sugerencia.titulo}:</b> {sugerencia.texto}</p>
          {extraPausa}
        </div>
      )}
      {fase === 'fin' && <button onClick={reiniciar} className={`${botonSuave}`}>Otro momento extra</button>}
      {fase === 'trabajo' && <p className="text-xs text-muted">Mantén la pantalla encendida mientras corre. Antes de empezar: materiales listos, celular lejos y agua a la mano.</p>}
    </div>
  );
}

/** «¿Cómo me fue hoy?» con caritas. */
export function ComoMeFue({ clave, fecha }: { clave: string; fecha: FechaISO }) {
  const [caritas, setCaritas] = useState<Record<FechaISO, Carita>>(() => leerCaritas(clave));
  const actual = caritas[fecha];
  const elegir = (c: Carita) => setCaritas(guardarCarita(clave, fecha, actual === c ? null : c));
  return (
    <div className="rounded-2xl border border-line bg-card p-4 space-y-2">
      <p className="text-sm font-semibold text-strong">¿Cómo te fue hoy?</p>
      <div className="grid grid-cols-3 gap-2">
        {CARITAS.map(c => (
          <button key={c.id} onClick={() => elegir(c.id)} aria-pressed={actual === c.id}
            className={`min-h-[64px] rounded-xl border text-center ${actual === c.id ? 'bg-accent/20 border-accent/60 text-strong font-semibold' : 'bg-card border-line text-soft'}`}>
            <div className="text-2xl" aria-hidden>{c.emoji}</div>
            <div className="text-xs">{c.texto}</div>
          </button>
        ))}
      </div>
      {actual === 'dificil' && (
        <p className="text-sm text-soft" role="status">Gracias por contarlo. Un día difícil pasa; mañana se retoma. Si se repite, avísenle a su docente.</p>
      )}
    </div>
  );
}

/** Botón de la cabecera que abre las sugerencias. */
/** Pasos del manual de la agenda (lo que se le explica a la familia el primer día). */
const PASOS_MANUAL: { icono: string; titulo: string; texto: string }[] = [
  { icono: '📲', titulo: 'Abran la agenda', texto: 'Escaneen el QR de la carta. Para tenerla siempre a mano: en el menú del navegador, «Agregar a la pantalla de inicio».' },
  { icono: '🕒', titulo: 'Elijan la hora de estudio', texto: 'En «Hoy», toquen «Elegir la hora» y decidan juntos a qué hora se estudia. Puede ser la misma todos los días.' },
  { icono: '📅', titulo: 'Miren qué toca', texto: '«Hoy» muestra el trabajo del día; «Semana» y «Mes», lo que viene; «Mis guías», cada guía con su avance; «Entregas», lo que hay que enviar.' },
  { icono: '⏱️', titulo: 'Trabajen por momentos', texto: 'Un momento son 25 minutos de trabajo y 5 de pausa. Toquen «Empezar» en el temporizador: avisa al terminar y arranca la pausa.' },
  { icono: '☑️', titulo: 'Tachen lo que hicieron', texto: 'En cada tarjeta, toquen «Momento 1», «Momento 2»… al terminarlos. La barra verde muestra cuánto falta del día.' },
  { icono: '📸', titulo: 'Entreguen a tiempo', texto: 'Abran «Ver instrucciones»: ahí dice qué entregar y cómo. Tomen la foto o suban el archivo con los botones de entrega.' },
  { icono: '🌬️', titulo: 'Antes de empezar y en la pausa', texto: 'Muévanse un poco o usen la «Respiración guiada». En «Sugerencias de estudio» hay más ideas para acompañar.' },
  { icono: '💬', titulo: 'Pidan ayuda a tiempo', texto: 'Si algo no se entiende o no se alcanza, escriban al docente de la asignatura o a coordinación. Avisar a tiempo siempre ayuda.' },
];

/** «Manual» de la agenda: instructivo breve, siempre a mano. */
export function Manual({ onCerrar, desde, hasta }: { onCerrar: () => void; desde: FechaISO; hasta: FechaISO }) {
  const cierre = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    cierre.current?.focus();
    const f = (e: KeyboardEvent) => { if (e.key === 'Escape') onCerrar(); };
    window.addEventListener('keydown', f);
    return () => window.removeEventListener('keydown', f);
  }, [onCerrar]);
  const corta = (f: FechaISO) => { const [y, m, d] = f.split('-').map(Number); return new Date(y, m - 1, d).toLocaleDateString('es-CO', { day: 'numeric', month: 'long' }); };
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50" onClick={onCerrar}>
      <div role="dialog" aria-modal="true" aria-label="Manual de la agenda" onClick={e => e.stopPropagation()}
        className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl border border-line bg-card p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 className="text-xl font-bold text-strong">Cómo usar esta agenda</h2>
            <p className="text-sm text-soft">Trabajo del {corta(desde)} al {corta(hasta)} · sustentaciones del 24 al 27 de noviembre.</p>
          </div>
          <button ref={cierre} onClick={onCerrar} aria-label="Cerrar" className="min-h-[44px] min-w-[44px] rounded-xl border border-line bg-card text-strong flex items-center justify-center">
            <X size={20} />
          </button>
        </div>
        <ol className="space-y-2">
          {PASOS_MANUAL.map((p, i) => (
            <li key={p.titulo} className="rounded-xl border border-sky-500/30 bg-sky-500/10 p-3 flex gap-3">
              <span className="text-2xl leading-none" aria-hidden>{p.icono}</span>
              <div className="min-w-0">
                <p className="text-base font-semibold text-strong">{i + 1}. {p.titulo}</p>
                <p className="text-sm text-soft">{p.texto}</p>
              </div>
            </li>
          ))}
        </ol>
        <p className="rounded-xl border border-success/40 bg-success/10 p-3 text-sm text-strong">Si cada día cumplen sus momentos a la hora acordada, llegan sin afán a las entregas y a la sustentación.</p>
      </div>
    </div>
  );
}

export function BotonSugerencias({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick}
      className="inline-flex items-center gap-1.5 min-h-[44px] px-4 rounded-full border border-warning/40 bg-warning/10 text-warning-soft-fg text-base font-semibold">
      <Lightbulb size={16} aria-hidden /> Sugerencias de estudio
    </button>
  );
}
