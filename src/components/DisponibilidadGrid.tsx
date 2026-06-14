import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useAppStore } from '../data/store';
import { getReservas } from '../data/api';
import type { Reserva } from '../data/api';
import { RECURSOS, BLOQUES_MANANA, BLOQUES_TARDE, horaOrdinal } from '../data/maestros';
import type { Recurso } from '../data/maestros';
import { horarioBase } from '../data/horarioBase';
import { cn } from '@/lib/utils';
import PanelConfirmacion from './PanelConfirmacion';

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

const ESTADO_ESTILOS: Record<CeldaEstado, string> = {
  libre:    'bg-green-900/30 border-green-700/50 cursor-pointer hover:bg-green-700/50',
  clase:    'bg-gray-800/50 border-gray-600/30 cursor-default',
  ocupado:  'bg-red-900/30 border-red-700/50 cursor-not-allowed',
  propio:   'bg-blue-900/40 border-blue-500/60 cursor-pointer hover:bg-blue-800/50',
  rectoria: 'bg-yellow-900/40 border-yellow-600/60 cursor-default',
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
  onSeleccionar,
}: {
  recursos: Recurso[];
  fechas: string[];
  bloques: ReturnType<typeof BLOQUES_MANANA.filter>;
  userId: string;
  reservas: Reserva[];
  rol: string | null;
  onSeleccionar: (recursoId: string, fecha: string, bloqueId: number) => void;
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
                  f === hoy ? 'text-blue-400' : 'text-soft',
                  fi >= 5 ? 'text-muted' : '' // sábado/domingo más tenue
                )}
              >
                <div>{DIAS_NOMBRES[fi]}</div>
                <div className={cn('text-[10px] font-normal', f === hoy ? 'text-blue-500' : 'text-muted')}>
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
                  const estado = getEstado(recurso, fecha, bloque.id, userId, reservas);
                  const puedeReservar = estado === 'libre' || estado === 'propio';
                  // Docentes no pueden reservar en sábado (índice 5+)
                  const bloqueado = fi >= 5 && rol === 'docente';
                  return (
                    <td
                      key={`${fecha}-${bloque.id}`}
                      onClick={() => {
                        if (puedeReservar && !bloqueado) onSeleccionar(recurso.id, fecha, bloque.id);
                      }}
                      className={cn(
                        'p-0.5',
                        bi === 0 && fi > 0 ? 'border-l-[3px] border-line-strong' : ''
                      )}
                      title={`${recurso.nombre} · ${formatFecha(fecha)} · ${horaOrdinal(bloque.id)} hora (${bloque.inicio}–${bloque.fin})`}
                    >
                      <div className={cn(
                        'h-8 rounded border flex items-center justify-center text-[10px] font-medium transition-all',
                        bloqueado ? 'bg-gray-900/30 border-gray-800/30 cursor-not-allowed opacity-40' : ESTADO_ESTILOS[estado]
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

// ── Componente principal ─────────────────────────────────────────────────────

export default function DisponibilidadGrid() {
  const { userId, jornada, rol, reservas, setReservas } = useAppStore();
  const [semanaOffset, setSemanaOffset] = useState(0);
  const [cargando, setCargando]         = useState(false);
  const [tab, setTab]                   = useState<TabDisp>('aulas');
  const [seleccion, setSeleccion]       = useState<{ recursoId: string; fecha: string; bloqueId: number } | null>(null);

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

  return (
    <div className="space-y-4">

      {/* Banner de semana */}
      <div className="flex items-center gap-3 p-3 rounded-2xl border border-line bg-elevated/60">
        <button
          onClick={() => setSemanaOffset(v => v - 1)}
          className="px-3 py-1.5 rounded-xl bg-elevated text-soft hover:bg-hover text-sm transition flex-shrink-0"
        >
          ←
        </button>

        <div className="flex-1 text-center">
          <div className="text-strong font-semibold">
            {formatFecha(semanaInicio)} – {formatFecha(semanaFin)}
            <span className="text-muted font-normal ml-1.5">{anio}</span>
          </div>
          {semanaOffset === 0 && (
            <div className="text-blue-400 text-xs mt-0.5">Esta semana</div>
          )}
          {semanaOffset !== 0 && (
            <div className="text-muted text-xs mt-0.5">
              {semanaOffset > 0 ? `+${semanaOffset}` : semanaOffset} {Math.abs(semanaOffset) === 1 ? 'semana' : 'semanas'}
            </div>
          )}
        </div>

        <button
          onClick={() => setSemanaOffset(0)}
          className="px-3 py-1.5 rounded-xl bg-elevated text-soft hover:bg-hover text-xs transition flex-shrink-0"
        >
          Hoy
        </button>

        <button
          onClick={() => setSemanaOffset(v => v + 1)}
          className="px-3 py-1.5 rounded-xl bg-elevated text-soft hover:bg-hover text-sm transition flex-shrink-0"
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
              'relative px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200',
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
          <GridRecursos
            recursos={recursosActuales}
            fechas={fechas}
            bloques={bloques}
            userId={userId ?? ''}
            reservas={reservas}
            rol={rol}
            onSeleccionar={(recursoId, fecha, bloqueId) =>
              setSeleccion({ recursoId, fecha, bloqueId })
            }
          />
        </motion.div>
      </AnimatePresence>

      {/* Leyenda */}
      <Leyenda />

      {/* Panel de confirmación */}
      {seleccion && (
        <PanelConfirmacion
          recursoId={seleccion.recursoId}
          fecha={seleccion.fecha}
          bloqueId={seleccion.bloqueId}
          onCerrar={() => setSeleccion(null)}
        />
      )}
    </div>
  );
}
