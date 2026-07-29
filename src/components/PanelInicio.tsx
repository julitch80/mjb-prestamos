// Panel de inicio — primera pantalla al entrar a la app. Resume notificaciones,
// cambios de horario, próxima clase (docentes), agenda institucional del día,
// accesos rápidos por rol y un resumen de chat (solo modo google + Firebase).
import { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { useAppStore } from '../data/store';
import { useChatStore } from '../data/chatStore';
import { AUTH_MODE } from '../data/authStore';
import { firebaseConfigurado } from '../lib/firebase';
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
import { cn } from '@/lib/utils';

type NavItem = { id: string; label: string; descripcion: string; roles: string[] };

const EMOJI_NAV: Record<string, string> = {
  disponibilidad: '📅',
  historial: '📋',
  admin: '🗂',
  rectora: '🏛',
  horario: '🗓',
  asignacion: '📚',
  tareas: '✅',
  agenda: '📰',
  riesgo: '🧯',
  asistentes: '🤖',
  admin_users: '👥',
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

  const accesos = navItems.filter((item) => item.id !== 'inicio' && item.id !== 'chat');

  const nombrePila = nombre?.split(' ')[0] ?? '';

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

      {/* ── Bloque A: Tu día ──────────────────────────────────────────── */}
      <section className="space-y-2.5">
        {notifNoLeidas > 0 && (
          <TarjetaInicio bg="bg-info-soft" borde="border-info" texto="text-info-soft-fg">
            <span className="text-base leading-none">🔔</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">
                {notifNoLeidas === 1 ? 'Tienes 1 notificación nueva' : `Tienes ${notifNoLeidas} notificaciones nuevas`}
              </p>
            </div>
            <BotonVer onClick={() => setVistaActual('disponibilidad' as never)} label="Ver" />
          </TarjetaInicio>
        )}

        {modHoy && (
          <TarjetaInicio bg="bg-warning-soft" borde="border-warning" texto="text-warning-soft-fg">
            <span className="text-base leading-none">📅</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">Tu horario cambió hoy</p>
              <p className="text-xs mt-0.5 opacity-90">
                {formatearFechaLegible(modHoy.fecha)} · {modHoy.ausencias.length} docente{modHoy.ausencias.length === 1 ? '' : 's'} ausente{modHoy.ausencias.length === 1 ? '' : 's'}
              </p>
            </div>
            <BotonVer onClick={() => setVistaActual('horario' as never)} label="Ver detalle" />
          </TarjetaInicio>
        )}

        {modFuturas.map((m) => (
          <TarjetaInicio key={m.id} bg="bg-card" borde="border-line" texto="text-strong">
            <span className="text-base leading-none">📅</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">Modificación de horario próxima</p>
              <p className="text-xs mt-0.5 text-muted">{formatearFechaLegible(m.fecha)} · jornada {m.jornada}</p>
            </div>
            <BotonVer onClick={() => setVistaActual('horario' as never)} label="Ver" />
          </TarjetaInicio>
        ))}

        {jornadaHoy && (
          <TarjetaInicio bg="bg-warning-soft" borde="border-warning" texto="text-warning-soft-fg">
            <span className="text-base leading-none">⏰</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">Jornada acortada hoy</p>
              <p className="text-xs mt-0.5 opacity-90">
                {jornadaHoy.horaInicio}–{jornadaHoy.horaFin} · {jornadaHoy.motivo}
              </p>
            </div>
          </TarjetaInicio>
        )}

        {esDocente && proximaClase && (
          <TarjetaInicio bg="bg-success-soft" borde="border-line" texto="text-success-soft-fg">
            <span className="text-base leading-none">🕐</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">
                {proximaClase.enCurso ? 'Ahora' : 'Siguiente'}: {proximaClase.ordinal} hora — {proximaClase.grado} en {proximaClase.aula}
              </p>
              <p className="text-xs mt-0.5 opacity-90">Desde las {proximaClase.hora}</p>
            </div>
          </TarjetaInicio>
        )}

        {esDocente && !proximaClase && (
          <TarjetaInicio bg="bg-card" borde="border-line" texto="text-muted">
            <span className="text-base leading-none">🌤</span>
            <p className="text-sm">No tienes más clases hoy.</p>
          </TarjetaInicio>
        )}

        {esDocente && acompanamientoHoy && (
          <TarjetaInicio bg="bg-card" borde="border-line" texto="text-strong">
            <span className="text-base leading-none">🧭</span>
            <p className="text-sm">Hoy te toca acompañamiento en <strong>{acompanamientoHoy.lugar}</strong>.</p>
          </TarjetaInicio>
        )}

        {esCoordinador && modsProximas.length > 0 && (
          <TarjetaInicio bg="bg-card" borde="border-line" texto="text-strong">
            <span className="text-base leading-none">📊</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">
                {modsProximas.length} modificación{modsProximas.length === 1 ? '' : 'es'} de horario en los próximos 14 días
              </p>
            </div>
            <BotonVer onClick={() => setVistaActual('admin' as never)} label="Ver panel" />
          </TarjetaInicio>
        )}

        {agendaHoy && (agendaHoy.actividades.length > 0 || agendaHoy.festivo) && (
          <TarjetaInicio bg="bg-card" borde="border-line" texto="text-strong">
            <span className="text-base leading-none">📰</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">Agenda institucional de hoy</p>
              {agendaHoy.festivo && <p className="text-xs mt-0.5 text-muted">{agendaHoy.festivo}</p>}
              <ul className="mt-1 space-y-0.5">
                {agendaHoy.actividades.slice(0, 3).map((a, i) => (
                  <li key={i} className="text-xs text-muted truncate">
                    {a.hora ? `${a.hora} — ` : ''}{a.actividad}
                  </li>
                ))}
              </ul>
            </div>
            <BotonVer onClick={() => setVistaActual('agenda' as never)} label="Ver" />
          </TarjetaInicio>
        )}
      </section>

      {/* ── Bloque B: Accesos rápidos ────────────────────────────────────── */}
      {accesos.length > 0 && (
        <section>
          <h2 className="text-xs font-semibold text-muted uppercase tracking-wide mb-2">Accesos rápidos</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            {accesos.map((item) => (
              <motion.button
                key={item.id}
                whileTap={{ scale: 0.97 }}
                onClick={() => setVistaActual(item.id as never)}
                className="flex flex-col items-start gap-1 p-3 rounded-xl bg-card border border-line hover:bg-hover hover:border-line-strong transition text-left"
              >
                <span className="text-xl leading-none">{EMOJI_NAV[item.id] ?? '▫️'}</span>
                <span className="text-sm font-medium text-strong mt-1">{item.label}</span>
                <span className="text-xs text-muted leading-snug">{item.descripcion}</span>
              </motion.button>
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

function TarjetaInicio({
  bg, borde, texto, children,
}: { bg: string; borde: string; texto: string; children: React.ReactNode }) {
  return (
    <div className={cn('flex items-start gap-3 p-3 rounded-xl border', bg, borde, texto)}>
      {children}
    </div>
  );
}

function BotonVer({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className="flex-shrink-0 text-xs font-medium px-2.5 py-1 rounded-lg bg-elevated text-strong hover:opacity-80 transition"
    >
      {label}
    </button>
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
