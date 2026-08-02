// Panel de inicio — primera pantalla al entrar a la app. Resume notificaciones,
// cambios de horario, próxima clase (docentes), agenda institucional del día,
// accesos rápidos por rol y un resumen de chat (solo modo google + Firebase).
import { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { useAppStore } from '../data/store';
import { useChatStore } from '../data/chatStore';
import { AUTH_MODE } from '../data/authStore';
import { firebaseConfigurado } from '../lib/firebase';
import { getSugerencias } from '../data/api';
import {
  BLOQUES_MANANA,
  BLOQUES_TARDE,
  horaOrdinal,
  ACOMPAÑAMIENTOS,
} from '../data/maestros';
import { horarioBase } from '../data/horarioBase';
import {
  modificacionesProximas,
  jornadasReducidasProximas,
  fechaHoyLocal,
  diaDeSemana,
  formatearFechaLegible,
} from '../data/horarioModificado';
import { AGENDA_ACTUAL } from '../data/agendaSemanal';
import {
  neonDe,
  IconoCampana,
  IconoReloj,
  IconoBrujula,
  IconoDespejado,
  IconoGrafico,
  IconoHorario,
  IconoAgenda,
  IconoSugerencias,
} from './IconosNeon';

type NavItem = { id: string; label: string; descripcion: string; roles: string[] };

/** Un aviso del carrusel superior ("Tu día"). */
type Aviso = {
  id: string;
  color: string;
  Icono: (p: { className?: string; style?: React.CSSProperties }) => React.ReactElement;
  titulo: string;
  detalle?: string;
  accion?: { label: string; onClick: () => void };
};

const DIAS_ES: Record<string, string> = {
  lunes: 'lunes', martes: 'martes', miercoles: 'miércoles', jueves: 'jueves', viernes: 'viernes',
  sabado: 'sábado', domingo: 'domingo',
};

const MESES_LARGO = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

function fechaLargaHoy(): string {
  const hoy = fechaHoyLocal();
  const dia = diaDeSemana(hoy);
  const [, m, d] = hoy.split('-');
  return `${DIAS_ES[dia] ?? dia} ${parseInt(d, 10)} de ${MESES_LARGO[parseInt(m, 10) - 1]}`;
}

function saludo(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Buenos días';
  if (h < 19) return 'Buenas tardes';
  return 'Buenas noches';
}

interface PanelInicioProps {
  navItems: NavItem[];
}

export default function PanelInicio({ navItems }: PanelInicioProps) {
  const { nombre, userId, rol, jornada, setVistaActual } = useAppStore();
  const notificaciones = useAppStore((s) => s.notificaciones);
  const horariosModificados = useAppStore((s) => s.horariosModificados);
  const jornadasReducidas = useAppStore((s) => s.jornadasReducidas);

  const notifNoLeidas = notificaciones.filter((n) => !n.leida).length;
  const modsProximas = useMemo(() => modificacionesProximas(horariosModificados, 14), [horariosModificados]);
  const jornadasProximas = useMemo(() => jornadasReducidasProximas(jornadasReducidas, 14), [jornadasReducidas]);
  const hoy = fechaHoyLocal();
  const modHoy = modsProximas.find((m) => m.fecha === hoy);
  const modFuturas = modsProximas.filter((m) => m.fecha !== hoy).slice(0, 2);
  const jornadaHoy = jornadasProximas.find((j) => j.fecha === hoy);

  const esDocente = rol === 'docente';

  // ── Próxima clase de hoy (solo docentes) ────────────────────────────────
  const proximaClase = useMemo(() => {
    if (!esDocente || !userId) return null;
    const diaHoy = diaDeSemana(hoy);
    if (diaHoy === 'sabado' || diaHoy === 'domingo') return null;
    const entradasHoy = horarioBase
      .filter((e) => e.dia === diaHoy && e.docente === userId)
      .sort((a, b) => a.bloque - b.bloque);
    if (entradasHoy.length === 0) return null;

    const ahora = new Date();
    const minsAhora = ahora.getHours() * 60 + ahora.getMinutes();

    for (const entrada of entradasHoy) {
      const bloques = entrada.jornada === 'manana' ? BLOQUES_MANANA : BLOQUES_TARDE;
      const bloque = bloques.find((b) => b.id === entrada.bloque);
      if (!bloque) continue;
      const [hIni, mIni] = bloque.inicio.split(':').map(Number);
      const [hFin, mFin] = bloque.fin.split(':').map(Number);
      const minsIni = hIni * 60 + mIni;
      const minsFin = hFin * 60 + mFin;
      if (minsAhora < minsFin) {
        return {
          enCurso: minsAhora >= minsIni,
          ordinal: horaOrdinal(entrada.bloque),
          hora: bloque.inicio,
          grado: entrada.grado,
          aula: entrada.aula,
        };
      }
    }
    return null; // ya terminó su jornada
  }, [esDocente, userId, hoy]);

  // ── Acompañamiento de hoy ────────────────────────────────────────────────
  const acompanamientoHoy = useMemo(() => {
    if (!esDocente || !userId) return null;
    const diaHoy = diaDeSemana(hoy);
    const jornadaEfectiva = jornada === 'ambas' ? 'manana' : (jornada as 'manana' | 'tarde' | null);
    return (
      ACOMPAÑAMIENTOS.find(
        (a) => a.docente === userId && a.dia === diaHoy && (!jornadaEfectiva || a.jornada === jornadaEfectiva)
      ) ?? null
    );
  }, [esDocente, userId, jornada, hoy]);

  // ── Agenda institucional de hoy ──────────────────────────────────────────
  const agendaHoy = useMemo(() => AGENDA_ACTUAL.dias.find((d) => d.fecha === hoy) ?? null, [hoy]);

  // ── Resumen operativo para coordinador ──────────────────────────────────
  const esCoordinador = rol === 'coordinador';

  // ── Sugerencias pendientes (superusuario) ────────────────────────────────
  const esSuperusuario = rol === 'superusuario';
  const [sugerenciasNuevas, setSugerenciasNuevas] = useState(0);
  useEffect(() => {
    if (!esSuperusuario) return;
    let cancelado = false;
    getSugerencias().then((res) => {
      if (cancelado || !res.ok) return;
      setSugerenciasNuevas(res.items.filter((s) => s.estado === 'nueva').length);
    });
    return () => {
      cancelado = true;
    };
  }, [esSuperusuario]);

  const accesos = navItems.filter((item) => item.id !== 'inicio');

  const nombrePila = nombre?.split(' ')[0] ?? '';

  // ── Avisos del carrusel superior, en orden de urgencia ───────────────────
  const avisos: Aviso[] = [];

  if (notifNoLeidas > 0) {
    avisos.push({
      id: 'notif',
      color: '#38bdf8',
      Icono: IconoCampana,
      titulo: notifNoLeidas === 1 ? '1 notificación nueva' : `${notifNoLeidas} notificaciones nuevas`,
      detalle: 'Toca para revisarlas.',
      accion: { label: 'Ver', onClick: () => setVistaActual('disponibilidad' as never) },
    });
  }

  if (modHoy) {
    avisos.push({
      id: 'mod-hoy',
      color: '#fbbf24',
      Icono: IconoHorario,
      titulo: 'Tu horario cambió hoy',
      detalle: `${formatearFechaLegible(modHoy.fecha)} · ${modHoy.ausencias.length} docente${modHoy.ausencias.length === 1 ? '' : 's'} ausente${modHoy.ausencias.length === 1 ? '' : 's'}`,
      accion: { label: 'Ver detalle', onClick: () => setVistaActual('horario' as never) },
    });
  }

  if (jornadaHoy) {
    avisos.push({
      id: 'jornada-hoy',
      color: '#fb923c',
      Icono: IconoReloj,
      titulo: 'Jornada acortada hoy',
      detalle: `${jornadaHoy.horaInicio}–${jornadaHoy.horaFin} · ${jornadaHoy.motivo}`,
    });
  }

  if (esDocente && proximaClase) {
    avisos.push({
      id: 'clase',
      color: '#34d399',
      Icono: IconoReloj,
      titulo: `${proximaClase.enCurso ? 'Ahora' : 'Siguiente'}: ${proximaClase.ordinal} hora`,
      detalle: `${proximaClase.grado} en ${proximaClase.aula} · desde las ${proximaClase.hora}`,
      accion: { label: 'Mi horario', onClick: () => setVistaActual('horario' as never) },
    });
  }

  if (esDocente && !proximaClase) {
    avisos.push({
      id: 'sin-clases',
      color: '#94a3b8',
      Icono: IconoDespejado,
      titulo: 'No tienes más clases hoy',
      detalle: 'Tu jornada ya terminó.',
    });
  }

  if (esDocente && acompanamientoHoy) {
    avisos.push({
      id: 'acompanamiento',
      color: '#c084fc',
      Icono: IconoBrujula,
      titulo: 'Hoy te toca acompañamiento',
      detalle: acompanamientoHoy.lugar,
    });
  }

  if (esCoordinador && modsProximas.length > 0) {
    avisos.push({
      id: 'coord-mods',
      color: '#f472b6',
      Icono: IconoGrafico,
      titulo: `${modsProximas.length} modificación${modsProximas.length === 1 ? '' : 'es'} de horario`,
      detalle: 'En los próximos 14 días.',
      accion: { label: 'Ver panel', onClick: () => setVistaActual('admin' as never) },
    });
  }

  for (const m of modFuturas) {
    avisos.push({
      id: `mod-${m.id}`,
      color: '#60a5fa',
      Icono: IconoHorario,
      titulo: 'Modificación de horario próxima',
      detalle: `${formatearFechaLegible(m.fecha)} · jornada ${m.jornada}`,
      accion: { label: 'Ver', onClick: () => setVistaActual('horario' as never) },
    });
  }

  if (esSuperusuario && sugerenciasNuevas > 0) {
    avisos.push({
      id: 'sugerencias-nuevas',
      color: '#fde047',
      Icono: IconoSugerencias,
      titulo: sugerenciasNuevas === 1 ? '1 sugerencia nueva' : `${sugerenciasNuevas} sugerencias nuevas`,
      detalle: 'Docentes reportaron algo — revísalo.',
      accion: { label: 'Ver', onClick: () => setVistaActual('sugerencias' as never) },
    });
  }

  if (agendaHoy && (agendaHoy.actividades.length > 0 || agendaHoy.festivo)) {
    const primeras = agendaHoy.actividades
      .slice(0, 2)
      .map((a) => (a.hora ? `${a.hora} — ${a.actividad}` : a.actividad))
      .join(' · ');
    avisos.push({
      id: 'agenda',
      color: '#a3e635',
      Icono: IconoAgenda,
      titulo: 'Agenda institucional de hoy',
      detalle: agendaHoy.festivo || primeras,
      accion: { label: 'Ver', onClick: () => setVistaActual('agenda' as never) },
    });
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* ── Encabezado ─────────────────────────────────────────────────── */}
      <div>
        <h1 className="text-lg font-semibold text-strong">
          {saludo()}{nombrePila ? `, ${nombrePila}` : ''}
        </h1>
        {/* first-letter en vez de capitalize: "martes 28 de julio", no "Martes 28 De Julio" */}
        <p className="text-sm text-muted mt-0.5 first-letter:uppercase">{fechaLargaHoy()}</p>
      </div>

      {/* ── Bloque A: Tu día — banners con scroll lateral ────────────────── */}
      {avisos.length > 0 && (
        <section>
          <h2 className="text-xs font-semibold text-muted uppercase tracking-wide mb-2">Tu día</h2>
          <div className="scroll-lateral flex gap-3 -mx-4 px-4 pb-1 sm:mx-0 sm:px-0">
            {avisos.map((a) => (
              <BannerAviso key={a.id} aviso={a} />
            ))}
          </div>
        </section>
      )}

      {/* ── Bloque B: ¿Qué deseas hacer? — baldosas con scroll lateral ───── */}
      {accesos.length > 0 && (
        <section>
          <h2 className="text-base font-semibold text-strong mb-3">¿Qué deseas hacer?</h2>
          <div className="scroll-lateral flex gap-3 -mx-4 px-4 pb-1 sm:mx-0 sm:px-0">
            {accesos.map((item) => (
              <BaldosaNeon
                key={item.id}
                id={item.id}
                label={item.label}
                onClick={() => setVistaActual(item.id as never)}
              />
            ))}
          </div>
        </section>
      )}


      {/* ── Bloque C: Chat ────────────────────────────────────────────────── */}
      <ChatResumen />
    </div>
  );
}

// ── Componentes auxiliares ─────────────────────────────────────────────────

/**
 * Banner del carrusel "Tu día": franja de color con el icono a la izquierda
 * y el texto a la derecha. El color viene del propio aviso y tiñe borde,
 * fondo de la franja y resplandor del trazo.
 */
function BannerAviso({ aviso }: { aviso: Aviso }) {
  const { color, Icono, titulo, detalle, accion } = aviso;
  return (
    <div
      className="flex-shrink-0 w-[270px] sm:w-[300px] flex rounded-2xl border overflow-hidden bg-card"
      style={{ borderColor: `${color}44` }}
    >
      <div
        className="w-[78px] flex-shrink-0 flex items-center justify-center"
        style={{ background: `${color}1a` }}
      >
        <Icono
          className="w-9 h-9"
          style={{ color, filter: `drop-shadow(0 0 7px ${color}80)` }}
        />
      </div>
      <div className="flex-1 min-w-0 p-3 flex flex-col justify-center">
        <p className="text-sm font-semibold text-strong leading-snug">{titulo}</p>
        {detalle && <p className="text-xs text-muted mt-1 leading-snug line-clamp-2">{detalle}</p>}
        {accion && (
          <button
            onClick={accion.onClick}
            className="mt-2 self-start text-xs font-semibold hover:underline"
            style={{ color }}
          >
            {accion.label}
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * Baldosa de "¿Qué deseas hacer?": cuadro tintado con el icono de línea
 * resplandeciente y la etiqueta debajo, al estilo de las acciones rápidas
 * de Acrobat.
 */
function BaldosaNeon({ id, label, onClick }: { id: string; label: string; onClick: () => void }) {
  const { Icono, color } = neonDe(id);
  return (
    <motion.button
      whileTap={{ scale: 0.94 }}
      onClick={onClick}
      className="group flex-shrink-0 w-[84px] flex flex-col items-center gap-2 focus:outline-none"
    >
      <div
        className="w-[70px] h-[70px] rounded-2xl border flex items-center justify-center transition-colors"
        style={{ background: `${color}14`, borderColor: `${color}33` }}
      >
        <Icono
          className="w-8 h-8 transition-transform group-hover:scale-110"
          style={{ color, filter: `drop-shadow(0 0 7px ${color}80)` }}
        />
      </div>
      <span className="text-[11px] leading-tight text-center text-soft group-hover:text-strong transition-colors">
        {label}
      </span>
    </motion.button>
  );
}

// ── Chat: resumen de canales recientes + escritura rápida ──────────────────

function ChatResumen() {
  const setVistaActual = useAppStore((s) => s.setVistaActual);
  const disponible = AUTH_MODE === 'google' && firebaseConfigurado;

  if (!disponible) {
    return (
      <section>
        <h2 className="text-xs font-semibold text-muted uppercase tracking-wide mb-2">Chat</h2>
        <div className="rounded-xl bg-card border border-line text-muted text-sm px-4 py-4 leading-snug">
          El chat estará disponible con la autenticación institucional.
        </div>
      </section>
    );
  }

  return <ChatResumenActivo onIrAlChat={() => setVistaActual('chat' as never)} />;
}

function ChatResumenActivo({ onIrAlChat }: { onIrAlChat: () => void }) {
  const { canales, abrirCanal, noLeidos, enviar } = useChatStore();
  const [texto, setTexto] = useState('');
  const [canalDestino, setCanalDestino] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const recientes = useMemo(
    () =>
      [...canales]
        .filter((c) => !!c.lastMessageAt)
        .sort((a, b) => {
          const ta = a.lastMessageAt?.toMillis ? a.lastMessageAt.toMillis() : (a.lastMessageAt?.seconds ?? 0) * 1000;
          const tb = b.lastMessageAt?.toMillis ? b.lastMessageAt.toMillis() : (b.lastMessageAt?.seconds ?? 0) * 1000;
          return tb - ta;
        })
        .slice(0, 3),
    [canales]
  );

  const canalGeneral = canales.find((c) => c.type === 'general');
  const destino = canalDestino ?? canalGeneral?.id ?? canales[0]?.id ?? null;

  function nombreCanal(c: { type: string; name?: string }): string {
    return c.name || (c.type === 'general' ? 'General' : c.type === 'directo' ? 'Directo' : 'Canal');
  }

  async function handleAbrir(id: string) {
    abrirCanal(id);
    onIrAlChat();
  }

  async function handleEnviar() {
    const t = texto.trim();
    if (!t || !destino) return;
    setEnviando(true);
    setError(null);
    try {
      abrirCanal(destino);
      await enviar(t);
      setTexto('');
      onIrAlChat();
    } catch {
      setError('No se pudo enviar el mensaje.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <section>
      <h2 className="text-xs font-semibold text-muted uppercase tracking-wide mb-2">Chat</h2>
      <div className="rounded-xl bg-card border border-line overflow-hidden">
        {recientes.length === 0 ? (
          <div className="px-4 py-4 text-sm text-muted text-center">Sin conversaciones recientes.</div>
        ) : (
          <div className="divide-y divide-line/50">
            {recientes.map((c) => (
              <button
                key={c.id}
                onClick={() => handleAbrir(c.id)}
                className="w-full text-left px-3 py-2.5 hover:bg-hover transition flex items-center gap-2"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-strong truncate">{nombreCanal(c)}</span>
                    {noLeidos(c) && <span className="w-1.5 h-1.5 rounded-full bg-accent flex-shrink-0" />}
                  </div>
                  {c.lastMessagePreview && (
                    <div className="text-xs text-muted truncate mt-0.5">{c.lastMessagePreview}</div>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}

        {canales.length > 0 && (
          <div className="p-3 border-t border-line space-y-2">
            {canales.length > 1 && (
              <select
                value={destino ?? ''}
                onChange={(e) => setCanalDestino(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-lg bg-elevated border border-line text-strong text-xs focus:outline-none"
              >
                {canales.map((c) => (
                  <option key={c.id} value={c.id}>{nombreCanal(c)}</option>
                ))}
              </select>
            )}
            <div className="flex items-end gap-2">
              <input
                type="text"
                value={texto}
                onChange={(e) => setTexto(e.target.value.slice(0, 4000))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') { e.preventDefault(); handleEnviar(); }
                }}
                placeholder="Escribe un mensaje rápido…"
                className="flex-1 px-3 py-2 rounded-lg bg-elevated border border-line text-strong text-sm placeholder:text-muted focus:outline-none focus:border-line-strong"
              />
              <button
                onClick={handleEnviar}
                disabled={!texto.trim() || enviando || !destino}
                className="px-3 py-2 rounded-lg bg-accent text-strong text-sm font-medium hover:opacity-90 transition disabled:opacity-40"
              >
                Enviar
              </button>
            </div>
            {error && <p className="text-xs text-danger">{error}</p>}
          </div>
        )}
      </div>
    </section>
  );
}
