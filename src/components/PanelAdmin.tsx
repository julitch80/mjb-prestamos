import { useEffect, useState } from 'react';
import { useAppStore } from '../data/store';
import { getReservas, actualizarReserva, cambiarPin, listarInformesContencion, listarRemisionesSeguro } from '../data/api';
import type { Reserva, InformeContencion, RemisionSeguro } from '../data/api';
import { MODO_LOCAL } from '../data/config';
import VistaHorario from './VistaHorario';

type Pestaña = 'pendientes' | 'hoy' | 'historial' | 'informes' | 'horario' | 'config';

export default function PanelAdmin() {
  const { reservas, setReservas, temaOscuro, toggleTema, actualizarReserva: actualizarStore, userId } = useAppStore();
  const [pestaña, setPestaña] = useState<Pestaña>('pendientes');
  const [cargando, setCargando] = useState(false);

  const hoy = new Date().toISOString().split('T')[0];

  useEffect(() => {
    setCargando(true);
    getReservas()
      .then(setReservas)
      .catch(() => {})
      .finally(() => setCargando(false));
  }, [setReservas]);

  // Filtrar por jornada del coordinador
  const reservasJornada = reservas;

  const pendientes = reservasJornada.filter(r => r.estado === 'pendiente');
  const deHoy = reservasJornada.filter(r => r.fecha === hoy && r.estado === 'aprobada');

  async function handleDecision(r: Reserva, estado: 'aprobada' | 'rechazada') {
    try {
      await actualizarReserva(r.id, estado);
      actualizarStore(r.id, { estado });
    } catch {
      // silencioso
    }
  }

  const [informes, setInformes] = useState<InformeContencion[]>([]);
  const [remisiones, setRemisiones] = useState<RemisionSeguro[]>([]);
  const [subPestañaInformes, setSubPestañaInformes] = useState<'contencion' | 'seguro'>('contencion');
  const [cargandoInformes, setCargandoInformes] = useState(false);

  useEffect(() => {
    if (pestaña !== 'informes') return;
    setCargandoInformes(true);
    Promise.all([listarInformesContencion(), listarRemisionesSeguro()])
      .then(([i, r]) => { setInformes(i); setRemisiones(r); })
      .catch(() => {})
      .finally(() => setCargandoInformes(false));
  }, [pestaña]);

  const pestañas: { id: Pestaña; label: string; badge?: number }[] = [
    { id: 'pendientes', label: 'Pendientes', badge: pendientes.length },
    { id: 'hoy',        label: 'Hoy',        badge: deHoy.length },
    { id: 'historial',  label: 'Historial' },
    { id: 'informes',   label: 'Informes' },
    { id: 'horario',    label: 'Horario del J' },
    { id: 'config',     label: 'Configuración' },
  ];

  return (
    <div className="space-y-4">
      {/* Pestañas */}
      <div className="flex gap-1 overflow-x-auto pb-1">
        {pestañas.map(p => (
          <button
            key={p.id}
            onClick={() => setPestaña(p.id)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition ${
              pestaña === p.id
                ? 'bg-accent text-strong'
                : 'bg-elevated text-soft hover:text-strong hover:bg-gray-700'
            }`}
          >
            {p.label}
            {p.badge !== undefined && p.badge > 0 && (
              <span className="bg-danger text-strong text-xs rounded-full px-1.5 py-0.5 min-w-[1.25rem] text-center">
                {p.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {cargando && <div className="text-center py-8 text-soft">Cargando...</div>}

      {/* Pendientes */}
      {pestaña === 'pendientes' && !cargando && (
        <div className="space-y-3">
          {pendientes.length === 0 ? (
            <div className="text-center py-12 text-muted">No hay solicitudes pendientes.</div>
          ) : (
            pendientes.map(r => (
              <ReservaCard key={r.id} reserva={r} onDecision={handleDecision} />
            ))
          )}
        </div>
      )}

      {/* Hoy */}
      {pestaña === 'hoy' && !cargando && (
        <div className="space-y-3">
          {deHoy.length === 0 ? (
            <div className="text-center py-12 text-muted">Sin reservas aprobadas para hoy.</div>
          ) : (
            deHoy.map(r => (
              <ReservaCard key={r.id} reserva={r} />
            ))
          )}
        </div>
      )}

      {/* Historial */}
      {pestaña === 'historial' && !cargando && (
        <div className="space-y-3">
          {reservasJornada.length === 0 ? (
            <div className="text-center py-12 text-muted">Sin historial.</div>
          ) : (
            reservasJornada.map(r => (
              <ReservaCard key={r.id} reserva={r} />
            ))
          )}
        </div>
      )}

      {/* Informes */}
      {pestaña === 'informes' && (
        <div className="space-y-3">
          <div className="flex gap-1">
            {(['contencion', 'seguro'] as const).map(t => (
              <button
                key={t}
                onClick={() => setSubPestañaInformes(t)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition ${
                  subPestañaInformes === t ? 'bg-hover text-strong border border-line-strong' : 'border border-line text-muted hover:bg-elevated'
                }`}
              >
                {t === 'contencion' ? 'Contención emocional' : 'Remisiones al seguro'}
              </button>
            ))}
          </div>

          {cargandoInformes && <div className="text-center py-8 text-soft">Cargando…</div>}

          {!cargandoInformes && subPestañaInformes === 'contencion' && (
            informes.length === 0 ? (
              <div className="text-center py-12 text-muted">Sin informes de contención emocional.</div>
            ) : (
              [...informes].reverse().map(i => (
                <div key={i.id} className="bg-card rounded-xl p-4 space-y-1 border border-line">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-strong text-sm">{i.estudianteNombre}</span>
                    <span className="text-xs text-muted">{i.fecha}</span>
                  </div>
                  <p className="text-xs text-muted">Grado {i.grado} · Director: {i.director || '—'} · Docente: {i.docenteNombre}</p>
                  <p className="text-sm text-soft">{i.descripcion}</p>
                  <p className="text-xs text-accent">Ruta: {i.rutaTipo === 'externa' ? 'Atención externa' : i.rutaDetalle}</p>
                </div>
              ))
            )
          )}

          {!cargandoInformes && subPestañaInformes === 'seguro' && (
            remisiones.length === 0 ? (
              <div className="text-center py-12 text-muted">Sin remisiones al seguro estudiantil.</div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {[...remisiones].reverse().map(r => (
                  <a
                    key={r.id}
                    href={r.fotoUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="bg-card rounded-xl p-2 border border-line hover:border-line-strong transition space-y-1 block"
                  >
                    <div className="aspect-[3/4] rounded-lg overflow-hidden bg-elevated">
                      <img src={r.fotoUrl} alt={`Remisión de ${r.estudianteNombre}`} className="w-full h-full object-cover" />
                    </div>
                    <p className="text-xs font-semibold text-strong truncate">{r.estudianteNombre}</p>
                    <p className="text-[11px] text-muted">{r.grado} · {r.fecha}</p>
                  </a>
                ))}
              </div>
            )
          )}
        </div>
      )}

      {/* Horario */}
      {pestaña === 'horario' && <VistaHorario />}

      {/* Configuración */}
      {pestaña === 'config' && (
        <div className="space-y-4 max-w-sm">
          <div className="bg-card rounded-xl p-6 space-y-4">
            <h3 className="text-strong font-semibold">Configuración</h3>
            <div className="flex items-center justify-between">
              <span className="text-soft text-sm">Tema de la interfaz</span>
              <button
                onClick={toggleTema}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-elevated text-soft hover:bg-gray-700 text-sm transition"
              >
                {temaOscuro ? '🌙 Oscuro' : '☀️ Claro'}
              </button>
            </div>
          </div>

          <CambioPin userId={userId} />
        </div>
      )}
    </div>
  );
}

// ── Formulario de cambio de PIN ────────────────────────────────────────────────

function CambioPin({ userId }: { userId: string | null }) {
  const [pinActual, setPinActual] = useState('');
  const [pinNuevo, setPinNuevo]   = useState('');
  const [pinConfirm, setPinConfirm] = useState('');
  const [cargando, setCargando]   = useState(false);
  const [mensaje, setMensaje]     = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null);

  const soloDigitos = (s: string) => s.replace(/\D/g, '').slice(0, 6);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMensaje(null);

    if (!/^\d{4,6}$/.test(pinNuevo)) {
      setMensaje({ tipo: 'error', texto: 'El PIN nuevo debe tener de 4 a 6 dígitos.' });
      return;
    }
    if (pinNuevo !== pinConfirm) {
      setMensaje({ tipo: 'error', texto: 'El PIN nuevo y su confirmación no coinciden.' });
      return;
    }
    if (!userId) {
      setMensaje({ tipo: 'error', texto: 'No se pudo identificar al usuario.' });
      return;
    }

    setCargando(true);
    try {
      const res = await cambiarPin(userId, pinActual, pinNuevo);
      if (res.ok) {
        setMensaje({ tipo: 'ok', texto: 'PIN actualizado correctamente.' });
        setPinActual(''); setPinNuevo(''); setPinConfirm('');
      } else {
        setMensaje({ tipo: 'error', texto: res.error ?? 'No se pudo cambiar el PIN.' });
      }
    } catch {
      setMensaje({ tipo: 'error', texto: 'Error de comunicación con el servidor.' });
    } finally {
      setCargando(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-card rounded-xl p-6 space-y-3">
      <div>
        <h3 className="text-strong font-semibold">Cambiar PIN</h3>
        <p className="text-muted text-xs mt-1">
          Actualiza tu PIN de acceso de 4 a 6 dígitos.
        </p>
      </div>

      {MODO_LOCAL && (
        <div className="rounded-lg bg-info-soft text-info-soft-fg text-xs px-3 py-2 leading-snug">
          El inicio de sesión está en modo de prueba (PIN general).
          El cambio de PIN individual quedará activo cuando se habilite
          el acceso con PIN personal.
        </div>
      )}

      <div className="space-y-2">
        <input
          type="password"
          inputMode="numeric"
          autoComplete="current-password"
          placeholder="PIN actual"
          value={pinActual}
          onChange={e => setPinActual(soloDigitos(e.target.value))}
          className="w-full px-3 py-2 rounded-lg bg-elevated border border-line text-strong text-sm tracking-widest placeholder:text-muted focus:outline-none focus:border-line-strong"
        />
        <input
          type="password"
          inputMode="numeric"
          autoComplete="new-password"
          placeholder="PIN nuevo (4-6 dígitos)"
          value={pinNuevo}
          onChange={e => setPinNuevo(soloDigitos(e.target.value))}
          className="w-full px-3 py-2 rounded-lg bg-elevated border border-line text-strong text-sm tracking-widest placeholder:text-muted focus:outline-none focus:border-line-strong"
        />
        <input
          type="password"
          inputMode="numeric"
          autoComplete="new-password"
          placeholder="Confirmar PIN nuevo"
          value={pinConfirm}
          onChange={e => setPinConfirm(soloDigitos(e.target.value))}
          className="w-full px-3 py-2 rounded-lg bg-elevated border border-line text-strong text-sm tracking-widest placeholder:text-muted focus:outline-none focus:border-line-strong"
        />
      </div>

      {mensaje && (
        <div
          className={
            'rounded-lg text-xs px-3 py-2 ' +
            (mensaje.tipo === 'ok'
              ? 'bg-success-soft text-success-soft-fg'
              : 'bg-danger-soft text-danger-soft-fg')
          }
        >
          {mensaje.texto}
        </div>
      )}

      <button
        type="submit"
        disabled={cargando || !pinNuevo || !pinConfirm}
        className="w-full py-2 rounded-lg bg-info-soft text-info-soft-fg text-sm font-medium hover:opacity-90 transition disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {cargando ? 'Guardando…' : 'Cambiar PIN'}
      </button>
    </form>
  );
}

// ── Componente tarjeta de reserva ──────────────────────────────────────────────

const ESTADO_CONFIG = {
  pendiente: { label: 'Pendiente', color: 'text-yellow-400' },
  aprobada:  { label: 'Aprobada',  color: 'text-success' },
  rechazada: { label: 'Rechazada', color: 'text-danger' },
  cancelada: { label: 'Cancelada', color: 'text-soft' },
} as const;

function ReservaCard({
  reserva,
  onDecision,
}: {
  reserva: Reserva;
  onDecision?: (r: Reserva, estado: 'aprobada' | 'rechazada') => void;
}) {
  const cfg = ESTADO_CONFIG[reserva.estado];
  return (
    <div className="bg-card border border-gray-800 rounded-xl p-4">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div>
          <p className="text-strong font-medium">{reserva.recurso}</p>
          <p className="text-sm text-soft">{reserva.fecha} · Bloque {reserva.bloque}</p>
          <p className="text-sm text-soft">{reserva.proposito}</p>
          <p className="text-xs text-muted mt-0.5">Solicitante: {reserva.solicitante}</p>
        </div>
        <span className={`text-xs font-medium flex-shrink-0 ${cfg.color}`}>{cfg.label}</span>
      </div>
      {onDecision && reserva.estado === 'pendiente' && (
        <div className="flex gap-2 mt-3">
          <button
            onClick={() => onDecision(reserva, 'rechazada')}
            className="flex-1 py-2 rounded-lg bg-danger-soft hover:bg-red-800/60 text-danger-soft-fg text-sm transition"
          >
            Rechazar
          </button>
          <button
            onClick={() => onDecision(reserva, 'aprobada')}
            className="flex-1 py-2 rounded-lg bg-success-soft hover:bg-green-800/60 text-success-soft-fg text-sm transition"
          >
            Aprobar
          </button>
        </div>
      )}
    </div>
  );
}
