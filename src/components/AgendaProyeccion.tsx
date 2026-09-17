import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import QRCode from 'qrcode';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import { getAsignatura } from '../data/asignacionAcademica';
import type { FechaISO, Tarea } from '../data/tareas/tipos';
import type { Ancla } from '../data/tareas/habitos';
import { lunesDe } from '../data/tareas/calendario';

/**
 * Modo proyección: el director lo muestra al frente del salón.
 *
 * NO ES SOLO UNA LISTA (Julián, 16-09-2026). Proyectar la agenda sirve para que
 * cada estudiante DECIDA A QUÉ HORA DEL DÍA hace cada tarea, y eso hay que
 * explicarlo: a un estudiante de sexto y a un profesor que apenas se adapta al
 * módulo. Por eso es una presentación corta de cuatro pantallas:
 *
 *   1. Portada: qué vamos a hacer.
 *   2. Por qué miramos la agenda juntos (tres ideas).
 *   3. Un ejemplo con una tarea inventada y los momentos reales del grupo.
 *   4. Las tareas del grupo (esta semana y la próxima) + el QR para elegir en el celular.
 *
 * Aquí NO se muestran momentos elegidos ni casillas de nadie: lo que cada
 * estudiante decide es suyo y no se expone frente al grupo.
 *
 * Se monta en <body> con un portal: dentro de la aplicación, un `position:
 * fixed` bajo un ancestro con transform (las transiciones entre vistas) deja de
 * cubrir la pantalla.
 */
export default function AgendaProyeccion({ grupo, dias, tareasDelDia, anclas, urlAgenda, onCerrar }: {
  grupo: string;
  /** Días hábiles desde hoy hasta el viernes de la próxima semana. */
  dias: FechaISO[];
  tareasDelDia: (f: FechaISO) => { b: { momentos: number }; t: Tarea }[];
  /** Los momentos del día que ofrece este grupo (los del director o los de su jornada). */
  anclas: Ancla[];
  /** Dirección pública de la agenda del grupo, para el QR. */
  urlAgenda: string;
  onCerrar: () => void;
}) {
  const [paso, setPaso] = useState(0);
  const [qr, setQr] = useState<string | null>(null);
  const TOTAL = 4;

  useEffect(() => {
    QRCode.toDataURL(urlAgenda, { width: 360, margin: 1 }).then(setQr).catch(() => setQr(null));
  }, [urlAgenda]);

  // Flechas del teclado o del control del video beam para pasar de pantalla.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') setPaso(p => Math.min(TOTAL - 1, p + 1));
      if (e.key === 'ArrowLeft' || e.key === 'PageUp') setPaso(p => Math.max(0, p - 1));
      if (e.key === 'Escape') onCerrar();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCerrar]);

  const hayTareas = dias.some(f => tareasDelDia(f).length > 0);

  return createPortal(
    <div className="fixed inset-0 z-50 flex flex-col bg-[#0b1220] text-white">
      {/* Barra superior */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-white/10 shrink-0">
        <span className="text-lg font-semibold text-white/80">Agenda de {grupo}</span>
        <div className="flex items-center gap-2">
          {Array.from({ length: TOTAL }, (_, i) => (
            <button
              key={i}
              onClick={() => setPaso(i)}
              aria-label={`Pantalla ${i + 1}`}
              className={`h-2.5 rounded-full transition-all ${i === paso ? 'w-8 bg-amber-300' : 'w-2.5 bg-white/30'}`}
            />
          ))}
        </div>
        <button
          onClick={onCerrar}
          className="flex items-center gap-1.5 rounded-full border border-white/30 bg-black/40 px-4 py-2 text-sm font-medium"
        >
          <X size={16} /> Cerrar
        </button>
      </div>

      {/* Contenido */}
      <div className="flex-1 overflow-auto">
        <div className="mx-auto max-w-5xl px-8 py-10">
          {paso === 0 && <Portada grupo={grupo} />}
          {paso === 1 && <PorQue />}
          {paso === 2 && <Ejemplo anclas={anclas} />}
          {paso === 3 && (
            <SusTareas grupo={grupo} dias={dias} tareasDelDia={tareasDelDia} hayTareas={hayTareas} qr={qr} />
          )}
        </div>
      </div>

      {/* Navegación */}
      <div className="flex items-center justify-between px-6 py-4 border-t border-white/10 shrink-0">
        <button
          onClick={() => setPaso(p => Math.max(0, p - 1))}
          disabled={paso === 0}
          className="flex items-center gap-1 rounded-full px-5 py-3 text-lg font-medium text-white/80 disabled:opacity-0"
        >
          <ChevronLeft size={22} /> Atrás
        </button>
        {paso < TOTAL - 1 ? (
          <div className="flex items-center gap-4">
            <button onClick={() => setPaso(TOTAL - 1)} className="text-sm text-white/50 underline">
              Ir directo a las tareas
            </button>
            <button
              onClick={() => setPaso(p => p + 1)}
              className="flex items-center gap-1 rounded-full bg-amber-300 px-6 py-3 text-lg font-bold text-[#0b1220]"
            >
              Siguiente <ChevronRight size={22} />
            </button>
          </div>
        ) : (
          <span className="text-sm text-white/50">Usa las flechas del teclado para pasar de pantalla</span>
        )}
      </div>
    </div>,
    document.body,
  );
}

// ── 1. Portada ────────────────────────────────────────────────────────────────

function Portada({ grupo }: { grupo: string }) {
  return (
    <div className="text-center space-y-8 pt-10">
      <p className="text-7xl">📅</p>
      <h1 className="text-6xl font-bold">Agenda de {grupo}</h1>
      <p className="text-3xl text-white/80 leading-snug max-w-3xl mx-auto">
        Vamos a mirar <b className="text-amber-300">qué tareas vienen</b> y a decidir{' '}
        <b className="text-amber-300">cuándo va a hacer cada uno la suya</b>.
      </p>
    </div>
  );
}

// ── 2. Por qué ────────────────────────────────────────────────────────────────

function PorQue() {
  const ideas = [
    {
      icono: '🗓️',
      titulo: 'Las tareas ya vienen repartidas',
      texto: 'Los profesores se ponen de acuerdo para que no les caigan todas el mismo día.',
    },
    {
      icono: '⏱️',
      titulo: 'Cada tarea es cortica',
      texto: 'Se mide en momentos de 25 minutos. Un momento es más o menos lo que dura un capítulo de una serie.',
    },
    {
      icono: '🧠',
      titulo: 'Tú decides a qué hora la haces',
      texto: 'Si eliges desde hoy el momento del día, no se te olvida ni te coge la noche.',
    },
  ];
  return (
    <div className="space-y-10">
      <h2 className="text-5xl font-bold text-center">¿Por qué la miramos juntos?</h2>
      <div className="grid gap-6 md:grid-cols-3">
        {ideas.map(i => (
          <div key={i.titulo} className="rounded-3xl bg-white/5 border border-white/10 p-6 space-y-3">
            <p className="text-6xl">{i.icono}</p>
            <p className="text-2xl font-bold text-amber-300 leading-tight">{i.titulo}</p>
            <p className="text-xl text-white/85 leading-snug">{i.texto}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── 3. Ejemplo ────────────────────────────────────────────────────────────────

function Ejemplo({ anclas }: { anclas: Ancla[] }) {
  // Se elige el segundo momento del grupo (o el primero si solo hay uno): así el
  // ejemplo usa las palabras reales que el estudiante verá en su celular.
  const elegida = anclas[1] ?? anclas[0];
  return (
    <div className="space-y-8">
      <h2 className="text-5xl font-bold text-center">Un ejemplo</h2>
      <div className="grid gap-8 md:grid-cols-2 items-center">
        {/* El celular del estudiante */}
        <div className="mx-auto w-full max-w-sm rounded-[2.5rem] border-4 border-white/20 bg-[#141a2a] p-5 space-y-4">
          <div className="rounded-2xl bg-white/5 border border-white/10 p-4 space-y-1">
            <p className="text-sm uppercase tracking-wider text-white/50">Lunes</p>
            <p className="text-2xl font-bold">Ciencias</p>
            <p className="text-lg text-white/80">Dibujar las partes de la planta</p>
            <p className="text-base text-white/50">1 momento · 25 min</p>
          </div>
          <p className="text-xl font-semibold">¿Cuándo la vas a hacer?</p>
          <div className="space-y-2">
            {anclas.map(a => (
              <div
                key={a.id}
                className={`rounded-xl border px-4 py-3 text-lg ${
                  a.id === elegida?.id ? 'border-amber-300 bg-amber-300/15 font-bold' : 'border-white/15 text-white/70'
                }`}
              >
                {a.label} {a.id === elegida?.id && '✓'}
              </div>
            ))}
          </div>
        </div>

        {/* La historia */}
        <div className="space-y-6 text-2xl leading-snug">
          <p>
            <b className="text-amber-300">Sara</b> ve que el lunes tiene una tarea de Ciencias que dura{' '}
            <b>25 minutos</b>.
          </p>
          {elegida && (
            <p>
              Piensa en su tarde y toca <b className="text-amber-300">«{elegida.label}»</b>, porque a esa hora
              está tranquila en la casa.
            </p>
          )}
          <p>
            El lunes, a esa hora, se sienta 25 minutos y la hace. Cuando termina, la <b>tacha</b> en su celular.
          </p>
          <p className="text-xl text-white/60">
            Si ninguna opción le sirve, puede escribir la suya en <b>«Otro»</b>. Lo que elige lo ve solo ella.
          </p>
        </div>
      </div>
    </div>
  );
}

// ── 4. Sus tareas ─────────────────────────────────────────────────────────────

function SusTareas({ grupo, dias, tareasDelDia, hayTareas, qr }: {
  grupo: string;
  dias: FechaISO[];
  tareasDelDia: (f: FechaISO) => { b: { momentos: number }; t: Tarea }[];
  hayTareas: boolean;
  qr: string | null;
}) {
  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_auto] items-start">
      <div className="space-y-6">
        <h2 className="text-5xl font-bold">Las tareas de {grupo}</h2>

        {!hayTareas && (
          <p className="text-3xl text-white/70 pt-6">
            Ni esta semana ni la próxima hay tareas programadas. 🎉
          </p>
        )}

        {dias.map((f, i) => {
          const items = tareasDelDia(f);
          const semanaDe = lunesDe(f);
          const primeraConTareas = dias.findIndex(d => lunesDe(d) === semanaDe && tareasDelDia(d).length > 0);
          const titulo = i === primeraConTareas
            ? (semanaDe === lunesDe(dias[0]) ? 'Esta semana' : 'Próxima semana')
            : null;
          if (items.length === 0) return null;
          return (
            <div key={f} className="space-y-2">
              {titulo && <p className="text-base font-semibold uppercase tracking-widest text-amber-300 pt-2">{titulo}</p>}
              <h3 className="text-2xl font-bold border-b border-white/20 pb-1">{diaLargo(f)}</h3>
              {items.map(({ b, t }, j) => (
                <div key={j} className="flex flex-wrap items-baseline justify-between gap-x-4 text-2xl leading-snug">
                  <span>
                    <b>{getAsignatura(t.asignaturaId)?.nombre ?? t.asignaturaId}</b> — {t.titulo}
                    <span className="text-white/60 text-xl"> ({b.momentos * 25} min)</span>
                  </span>
                  <span className="text-lg text-amber-300/90">🕓 ¿Cuándo la vas a hacer?</span>
                </div>
              ))}
            </div>
          );
        })}
      </div>

      {/* Lo que hace cada estudiante ahora */}
      <div className="rounded-3xl bg-white p-6 text-[#0b1220] space-y-4 lg:w-80 lg:sticky lg:top-0">
        <p className="text-2xl font-bold leading-tight">Ahora, en tu celular:</p>
        <ol className="space-y-2 text-lg leading-snug list-decimal pl-6">
          <li>Escanea este código.</li>
          <li>Toca cada tarea.</li>
          <li>Elige <b>cuándo la vas a hacer</b>.</li>
        </ol>
        {qr && <img src={qr} alt={`Código QR de la agenda de ${grupo}`} className="w-full rounded-xl" />}
        <p className="text-sm text-[#0b1220]/60">Si no tienes celular, anótalo en tu cuaderno.</p>
      </div>
    </div>
  );
}

function diaLargo(f: FechaISO): string {
  const [y, m, d] = f.split('-').map(Number);
  const fecha = new Date(y, m - 1, d);
  const dias = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  const meses = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  return `${dias[fecha.getDay()]} ${d} de ${meses[m - 1]}`;
}
