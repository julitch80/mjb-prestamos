import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useAppStore } from '../data/store';
import { getReservas } from '../data/api';
import type { Reserva } from '../data/api';
import { RECURSOS, BLOQUES_MANANA, BLOQUES_TARDE, horaOrdinal, getUsuario } from '../data/maestros';
import type { Recurso } from '../data/maestros';
import { horarioBase } from '../data/horarioBase';
import { cn } from '@/lib/utils';
import { useDevice } from '../hooks/useDevice';
import { nombreSolicitante } from '../data/formatoReserva';
import PanelConfirmacion from './PanelConfirmacion';
import PopupRectora from './PopupRectora';
import ModalDesplazamientoRectora from './ModalDesplazamientoRectora';

type CeldaEstado = 'libre' | 'clase' | 'ocupado' | 'propio' | 'rectoria';
type TabDisp = 'aulas' | 'espacios' | 'equipos';

const DIAS_SEMANA_MAP = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
const MESES_CORTO = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

function diaDeSemana(fecha: string): string {
  return DIAS_SEMANA_MAP[new Date(fecha + 'T12:00:00').getDay()];
}

function tieneClaseRegular(recurso: Recurso, fecha: string, bloqueId: number): boolean {
  if (recurso.tipo === 'equipo') return false;
  const dia = diaDeSemana(fecha);
  const nombre = recurso.nombreHorario ?? recurso.nombre;
  return horarioBase.some(e => e.aula === nombre && e.dia === dia && e.bloque === bloqueId);
}

// Devuelve la reserva activa (si la hay) en ese recurso/fecha/bloque, o la
// entrada de horario base si es una clase regular sin reserva asociada.
// Usado por la rectora para mostrar quién ocupa el espacio antes de
// desplazarlo (ModalDesplazamientoRectora).
function getOcupante(
  recurso: Recurso,
  fecha: string,
  bloqueId: number,
  reservas: Reserva[]
): { tipo: 'reserva'; reserva: Reserva } | { tipo: 'clase'; descripcion: string } | null {
  const reserva = reservas.find(
    r => r.recurso === recurso.id && r.fecha === fecha && r.bloque === bloqueId
      && r.estado !== 'cancelada' && r.estado !== 'rechazada'
  );
  if (reserva) return { tipo: 'reserva', reserva };

  if (recurso.tipo !== 'equipo') {
    const dia = diaDeSemana(fecha);
    const nombre = recurso.nombreHorario ?? recurso.nombre;
    const entrada = horarioBase.find(e => e.aula === nombre && e.dia === dia && e.bloque === bloqueId);
    if (entrada) {
      const docente = getUsuario(entrada.docente)?.nombre ?? entrada.docente;
      return { tipo: 'clase', descripcion: `${docente} · Grado ${entrada.grado}` };
    }
  }
  return null;
}

function getEstado(
  recurso: Recurso,
  fecha: string,
  bloqueId: number,
  userId: string,
  reservas: Reserva[]
): CeldaEstado {
  const reserva = reservas.find(
    r => r.recurso === recurso.id && r.fecha === fecha && r.bloque === bloqueId
      && r.estado !== 'cancelada' && r.estado !== 'rechazada'
  );
  if (reserva?.solicitante === 'rectora') return 'rectoria';
  if (reserva?.solicitante === userId)    return 'propio';
  if (reserva)                            return 'ocupado';
  if (tieneClaseRegular(recurso, fecha, bloqueId)) return 'clase';
  return 'libre';
}

// Decide si la celda se puede tocar y, si no, por qué (en celular no hay tooltip).
function analizarCelda(
  recurso: Recurso, fecha: string, bloqueId: number, indiceDia: number,
  userId: string, reservas: Reserva[], rol: string | null
): { estado: CeldaEstado; puede: boolean; motivo: string } {
  const estado = getEstado(recurso, fecha, bloqueId, userId, reservas);
  const puedeRol = rol === 'rectora'
    ? (estado === 'libre' || estado === 'clase' || estado === 'ocupado')
    : (estado === 'libre' || estado === 'propio');
  const pasada = fecha < fechaHoy() && rol !== 'rectora';
  if (indiceDia >= 5 && rol === 'docente') {
    return { estado, puede: false, motivo: 'Los sábados los docentes no pueden reservar.' };
  }
  if (pasada && estado === 'libre') {
    return { estado, puede: false, motivo: 'Esa hora ya pasó: no se puede reservar.' };
  }
  if (puedeRol) return { estado, puede: true, motivo: '' };
  const ocupante = getOcupante(recurso, fecha, bloqueId, reservas);
  let motivo = 'No se puede reservar este espacio.';
  if (estado === 'clase') {
    motivo = `Clase regular${ocupante?.tipo === 'clase' ? ` (${ocupante.descripcion})` : ''}: el espacio está en uso.`;
  } else if (estado === 'ocupado' && ocupante?.tipo === 'reserva') {
    const { solicitante, estado: est } = ocupante.reserva;
    motivo = `Ya reservado por ${nombreSolicitante(solicitante)}${est === 'pendiente' ? ' (pendiente de aprobación)' : ''}.`;
  } else if (estado === 'rectoria') {
    motivo = 'Asignado por Rectoría para ese momento.';
  }
  return { estado, puede: false, motivo };
}

const ESTADO_ESTILOS: Record<CeldaEstado, string> = {
  libre:    'bg-success-soft border-success cursor-pointer hover:bg-success/25',
  clase:    'bg-elevated/60 border-line cursor-default',
  ocupado:  'bg-danger-soft border-danger cursor-not-allowed',
  propio:   'bg-info-soft border-accent cursor-pointer hover:bg-info/15',
  rectoria: 'bg-warning-soft border-warning cursor-default',
};

const ESTADO_ICONO: Record<CeldaEstado, string> = {
  libre: '', clase: '·', ocupado: '✕', propio: '●', rectoria: '★',
};

function toLocalDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function fechaHoy(): string {
  return toLocalDate(new Date());
}

function formatFecha(f: string): string {
  const [, m, d] = f.split('-');
  return `${parseInt(d)} ${MESES_CORTO[parseInt(m) - 1]}`;
}

const DIAS_NOMBRES = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

// ── Leyenda ──────────────────────────────────────────────────────────────────

function Leyenda() {
  const items: { estado: CeldaEstado; label: string }[] = [
    { estado: 'libre',    label: 'Libre' },
    { estado: 'clase',    label: 'Clase regular' },
    { estado: 'ocupado',  label: 'Reservado' },
    { estado: 'propio',   label: 'Tuyo' },
    { estado: 'rectoria', label: 'Rectoría' },
  ];
  return (
    <div className="flex flex-wrap items-center gap-3 text-xs text-muted">
      {items.map(({ estado, label }) => (
        <span key={estado} className="flex items-center gap-1.5">
          <span className={cn('w-3.5 h-3.5 rounded border flex items-center justify-center text-[8px]', ESTADO_ESTILOS[estado])}>
            {ESTADO_ICONO[estado]}
          </span>
          {label}
        </span>
      ))}
    </div>
  );
}

// ── Grid de recursos ─────────────────────────────────────────────────────────

function GridRecursos({
  recursos, fechas, bloques, userId, reservas, rol,
  onSeleccionar, onMotivo,
}: {
  recursos: Recurso[];
  fechas: string[];
  bloques: ReturnType<typeof BLOQUES_MANANA.filter>;
  userId: string;
  reservas: Reserva[];
  rol: string | null;
  onSeleccionar: (recursoId: string, fecha: string, bloqueId: number, estado: CeldaEstado) => void;
  onMotivo: (texto: string) => void;
}) {
  const hoy = fechaHoy();
  if (recursos.length === 0) return (
    <div className="text-center py-12 text-muted text-sm rounded-2xl border border-line">
      Sin espacios disponibles en esta categoría.
    </div>
  );

  return (
    <div className="overflow-x-auto rounded-2xl border border-line bg-elevated/40">
      <table className="text-xs border-collapse" style={{ minWidth: 600 }}>
        <thead>
          <tr>
            <th className="sticky left-0 bg-card z-10 text-left px-3 py-2.5 text-muted font-medium border-b border-line w-36" />
            {fechas.map((f, fi) => (
              <th
                key={f}
                colSpan={bloques.length}
                className={cn(
                  'text-center py-2.5 font-semibold border-b border-line',
                  fi > 0 ? 'border-l-[3px] border-line-strong' : '',
                  f === hoy ? 'text-info' : 'text-soft',
                  fi >= 5 ? 'text-muted' : '' // sábado/domingo más tenue
                )}
              >
                <div>{DIAS_NOMBRES[fi]}</div>
                <div className={cn('text-[10px] font-normal', f === hoy ? 'text-info' : 'text-muted')}>
                  {formatFecha(f)}
                </div>
              </th>
            ))}
          </tr>
          <tr className="border-b border-line">
            <th className="sticky left-0 bg-card z-10 text-[10px] text-muted px-3 py-1 font-normal text-left">
              Espacio
            </th>
            {fechas.map((f, fi) =>
              bloques.map((b, bi) => (
                <th
                  key={`${f}-${b.id}`}
                  className={cn(
                    'text-center px-0.5 py-1 font-normal min-w-[44px]',
                    bi === 0 && fi > 0 ? 'border-l-[3px] border-line-strong' : ''
                  )}
                >
                  <div className="text-soft text-[10px]">{horaOrdinal(b.id)}</div>
                  <div className="text-muted opacity-70 text-[9px]">{b.inicio}</div>
                </th>
              ))
            )}
          </tr>
        </thead>
        <tbody>
          {recursos.map((recurso, ri) => (
            <tr key={recurso.id} className={cn('border-b border-line', ri % 2 !== 0 ? 'bg-elevated/40' : '')}>
              <td className="text-soft font-medium px-3 py-2 text-xs sticky left-0 bg-card z-10">
                {recurso.nombre}
              </td>
              {fechas.map((fecha, fi) =>
                bloques.map((bloque, bi) => {
                  // La rectora puede desplazar espacios ocupados/con clase regular
                  // (asignación jerárquica); los demás roles solo libre/propio.
                  const { estado, puede: puedeReservar, motivo } = analizarCelda(recurso, fecha, bloque.id, fi, userId, reservas, rol);
                  // Docentes no pueden reservar en sábado (índice 5+)
                  const bloqueado = fi >= 5 && rol === 'docente';
                  return (
                    <td
                      key={`${fecha}-${bloque.id}`}
                      onClick={() => {
                        if (puedeReservar && !bloqueado) onSeleccionar(recurso.id, fecha, bloque.id, estado);
                        else onMotivo(`${recurso.nombre}, ${horaOrdinal(bloque.id)} hora: ${motivo}`);
                      }}
                      className={cn(
                        'p-0.5',
                        bi === 0 && fi > 0 ? 'border-l-[3px] border-line-strong' : ''
                      )}
                      title={`${recurso.nombre} · ${formatFecha(fecha)} · ${horaOrdinal(bloque.id)} hora (${bloque.inicio}–${bloque.fin})`}
                    >
                      <div className={cn(
                        'h-8 rounded border flex items-center justify-center text-[10px] font-medium transition-all',
                        bloqueado ? 'bg-elevated/40 border-line cursor-not-allowed opacity-40' :
                        (rol === 'rectora' && puedeReservar) ? cn(ESTADO_ESTILOS[estado], 'cursor-pointer hover:brightness-110') :
                        ESTADO_ESTILOS[estado]
                      )}>
                        {!bloqueado && ESTADO_ICONO[estado]}
                      </div>
                    </td>
                  );
                })
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Vista móvil: un día a la vez ────────────────────────────────────────────

function VistaDiaMovil({
  recursos, fechas, bloques, userId, reservas, rol, indiceDia, onCambiarDia,
  onSeleccionar, onMotivo,
}: {
  recursos: Recurso[];
  fechas: string[];
  bloques: typeof BLOQUES_MANANA;
  userId: string;
  reservas: Reserva[];
  rol: string | null;
  indiceDia: number;
  onCambiarDia: (i: number) => void;
  onSeleccionar: (recursoId: string, fecha: string, bloqueId: number, estado: CeldaEstado) => void;
  onMotivo: (texto: string) => void;
}) {
  const hoy = fechaHoy();
  const fecha = fechas[indiceDia];
  return (
    <div className="space-y-3">
      <div className="flex gap-1.5 overflow-x-auto pb-1" role="tablist" aria-label="Día de la semana">
        {fechas.map((f, i) => (
          <button
            key={f}
            role="tab"
            aria-selected={i === indiceDia}
            onClick={() => onCambiarDia(i)}
            className={cn(
              'flex-shrink-0 min-w-[56px] min-h-[44px] px-2 rounded-xl border text-center transition',
              i === indiceDia ? 'bg-accent text-strong border-accent' : 'bg-elevated text-soft border-line',
              f === hoy && i !== indiceDia ? 'border-info text-info' : ''
            )}
          >
            <div className="text-xs font-semibold">{DIAS_NOMBRES[i].slice(0, 3)}</div>
            <div className="text-[11px] opacity-80">{formatFecha(f)}</div>
          </button>
        ))}
      </div>
      {recursos.length === 0 && (
        <div className="text-center py-12 text-muted text-sm rounded-2xl border border-line">
          Sin espacios disponibles en esta categoría.
        </div>
      )}
      {recursos.map(recurso => (
        <div key={recurso.id} className="rounded-2xl border border-line bg-card p-3">
          <p className="text-strong text-sm font-semibold mb-2">{recurso.nombre}</p>
          <div className="grid grid-cols-3 gap-2">
            {bloques.map(bloque => {
              const { estado, puede, motivo } = analizarCelda(recurso, fecha, bloque.id, indiceDia, userId, reservas, rol);
              return (
                <button
                  key={bloque.id}
                  onClick={() => {
                    if (puede) onSeleccionar(recurso.id, fecha, bloque.id, estado);
                    else onMotivo(`${recurso.nombre}, ${horaOrdinal(bloque.id)} hora: ${motivo}`);
                  }}
                  className={cn(
                    'min-h-[44px] rounded-lg border flex flex-col items-center justify-center text-xs font-medium',
                    ESTADO_ESTILOS[estado], !puede && 'opacity-70'
                  )}
                >
                  <span className="text-soft">{horaOrdinal(bloque.id)} {ESTADO_ICONO[estado]}</span>
                  <span className="text-muted text-[11px]">{bloque.inicio}</span>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Componente principal ─────────────────────────────────────────────────────

export default function DisponibilidadGrid() {
  const { userId, jornada, rol, reservas, setReservas } = useAppStore();
  const { isMobile } = useDevice();
  const [semanaOffset, setSemanaOffset] = useState(0);
  const [diaMovil, setDiaMovil]         = useState(() => {
    const d = new Date().getDay(); // lunes=1 ... viernes=5; fin de semana -> lunes
    return d >= 1 && d <= 5 ? d - 1 : 0;
  });
  const [avisoMotivo, setAvisoMotivo]   = useState<string | null>(null);
  const [cargando, setCargando]         = useState(false);
  const [tab, setTab]                   = useState<TabDisp>('aulas');
  const [seleccion, setSeleccion]       = useState<{ recursoId: string; fecha: string; bloqueId: number } | null>(null);
  const [seleccionRectoraLibre, setSeleccionRectoraLibre] = useState<{ recursoId: string; fecha: string; bloqueId: number } | null>(null);
  const [seleccionDesplazamiento, setSeleccionDesplazamiento] = useState<{
    recursoId: string; fecha: string; bloqueId: number;
    ocupante: { tipo: 'reserva'; reserva: Reserva } | { tipo: 'clase'; descripcion: string };
  } | null>(null);

  const jornadaActual = jornada === 'tarde' ? 'tarde' : 'manana';
  const bloques = jornadaActual === 'tarde' ? BLOQUES_TARDE : BLOQUES_MANANA;

  // Coordinadores y rectora ven hasta el sábado
  const numDias = (rol === 'coordinador' || rol === 'rectora') ? 6 : 5;

  const fechas = Array.from({ length: numDias }, (_, i) => {
    const hoy = new Date();
    const lunes = new Date(hoy);
    lunes.setDate(hoy.getDate() - hoy.getDay() + 1 + semanaOffset * 7);
    lunes.setDate(lunes.getDate() + i);
    return toLocalDate(lunes);
  });

  const semanaInicio = fechas[0];
  const semanaFin    = fechas[fechas.length - 1];
  const [anio] = semanaInicio.split('-');

  useEffect(() => {
    setCargando(true);
    getReservas()
      .then(setReservas)
      .catch(() => {})
      .finally(() => setCargando(false));
  }, [semanaOffset, setReservas]);

  const aulasRecursos    = RECURSOS.filter(r => r.tipo === 'aula');
  const espaciosRecursos = RECURSOS.filter(r => r.tipo === 'otro_espacio');
  const equiposRecursos  = RECURSOS.filter(r => r.tipo === 'equipo');

  const recursosActuales =
    tab === 'aulas'    ? aulasRecursos :
    tab === 'espacios' ? espaciosRecursos :
                         equiposRecursos;

  const TAB_LABELS: Record<TabDisp, string> = {
    aulas:    'Aulas',
    espacios: 'Otros espacios',
    equipos:  'Equipos',
  };

  // La selección compartida por la tabla ancha y la vista móvil.
  function alSeleccionar(recursoId: string, fecha: string, bloqueId: number, estado: CeldaEstado) {
    setAvisoMotivo(null);
    if (rol === 'rectora') {
      if (estado === 'clase' || estado === 'ocupado') {
        const recurso = RECURSOS.find(r => r.id === recursoId);
        const ocupante = recurso ? getOcupante(recurso, fecha, bloqueId, reservas) : null;
        if (ocupante) {
          setSeleccionDesplazamiento({ recursoId, fecha, bloqueId, ocupante });
        }
      } else {
        setSeleccionRectoraLibre({ recursoId, fecha, bloqueId });
      }
      return;
    }
    setSeleccion({ recursoId, fecha, bloqueId });
  }

  return (
    <div className="space-y-4">

      {/* Banner de semana */}
      <div className="flex items-center gap-3 p-3 rounded-2xl border border-line bg-elevated/60">
        <button
          onClick={() => setSemanaOffset(v => v - 1)}
          className="px-3 min-h-[44px] min-w-[44px] rounded-xl bg-elevated text-soft hover:bg-hover text-sm transition flex-shrink-0"
        >
          ←
        </button>

        <div className="flex-1 text-center">
          <div className="text-strong font-semibold">
            {formatFecha(semanaInicio)} – {formatFecha(semanaFin)}
            <span className="text-muted font-normal ml-1.5">{anio}</span>
          </div>
          {semanaOffset === 0 && (
            <div className="text-info text-xs mt-0.5">Esta semana</div>
          )}
          {semanaOffset !== 0 && (
            <div className="text-muted text-xs mt-0.5">
              {semanaOffset > 0 ? `+${semanaOffset}` : semanaOffset} {Math.abs(semanaOffset) === 1 ? 'semana' : 'semanas'}
            </div>
          )}
        </div>

        <button
          onClick={() => setSemanaOffset(0)}
          className="px-3 min-h-[44px] rounded-xl bg-elevated text-soft hover:bg-hover text-sm transition flex-shrink-0"
        >
          Hoy
        </button>

        <button
          onClick={() => setSemanaOffset(v => v + 1)}
          className="px-3 min-h-[44px] min-w-[44px] rounded-xl bg-elevated text-soft hover:bg-hover text-sm transition flex-shrink-0"
        >
          →
        </button>
      </div>

      {/* Tabs Aulas / Otros espacios / Equipos */}
      <div className="flex gap-1 p-1 rounded-xl bg-elevated border border-line w-fit">
        {(['aulas', 'espacios', 'equipos'] as TabDisp[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              'relative px-4 py-2 min-h-[44px] rounded-xl text-sm font-medium transition-all duration-200',
              tab === t ? 'text-strong' : 'text-muted hover:text-soft hover:bg-elevated'
            )}
          >
            {tab === t && (
              <motion.span
                layoutId="tab-disp"
                className="absolute inset-0 rounded-xl bg-hover border border-white/15"
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              />
            )}
            <span className="relative z-10">{TAB_LABELS[t]}</span>
          </button>
        ))}
      </div>

      {cargando && (
        <div className="text-center py-4 text-muted text-sm">Cargando reservas...</div>
      )}

      <AnimatePresence mode="wait">
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.2 }}
        >
          {isMobile ? (
            <VistaDiaMovil
              recursos={recursosActuales}
              fechas={fechas}
              bloques={bloques}
              userId={userId ?? ''}
              reservas={reservas}
              rol={rol}
              indiceDia={Math.min(diaMovil, fechas.length - 1)}
              onCambiarDia={i => { setDiaMovil(i); setAvisoMotivo(null); }}
              onSeleccionar={alSeleccionar}
              onMotivo={setAvisoMotivo}
            />
          ) : (
            <GridRecursos
              recursos={recursosActuales}
              fechas={fechas}
              bloques={bloques}
              userId={userId ?? ''}
              reservas={reservas}
              rol={rol}
              onSeleccionar={alSeleccionar}
              onMotivo={setAvisoMotivo}
            />
          )}
        </motion.div>
      </AnimatePresence>

      {/* Por qué no se puede reservar la celda tocada */}
      {avisoMotivo && (
        <div role="status" className="flex items-start justify-between gap-3 rounded-xl border border-line bg-elevated text-soft text-sm p-3">
          <span>{avisoMotivo}</span>
          <button onClick={() => setAvisoMotivo(null)} aria-label="Cerrar aviso" className="min-h-[44px] min-w-[44px] -my-2 -mr-2 text-muted">✕</button>
        </div>
      )}

      {/* Leyenda */}
      <Leyenda />

      {/* Panel de confirmación (docentes/coordinadores) */}
      {seleccion && (
        <PanelConfirmacion
          recursoId={seleccion.recursoId}
          fecha={seleccion.fecha}
          bloqueId={seleccion.bloqueId}
          onCerrar={() => setSeleccion(null)}
        />
      )}

      {/* Rectora — espacio libre: asignación directa inmediata */}
      {seleccionRectoraLibre && (
        <PopupRectora
          recursoIdInicial={seleccionRectoraLibre.recursoId}
          fechaInicial={seleccionRectoraLibre.fecha}
          bloqueIdInicial={seleccionRectoraLibre.bloqueId}
          onCerrar={() => setSeleccionRectoraLibre(null)}
        />
      )}

      {/* Rectora — espacio ocupado: modal de desplazamiento con justificación */}
      {seleccionDesplazamiento && (
        <ModalDesplazamientoRectora
          recursoId={seleccionDesplazamiento.recursoId}
          fecha={seleccionDesplazamiento.fecha}
          bloqueId={seleccionDesplazamiento.bloqueId}
          ocupante={seleccionDesplazamiento.ocupante}
          onCerrar={() => setSeleccionDesplazamiento(null)}
        />
      )}
    </div>
  );
}
