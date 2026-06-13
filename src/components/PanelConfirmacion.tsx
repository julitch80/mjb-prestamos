import { useState } from 'react';
import { useAppStore } from '../data/store';
import { crearReserva } from '../data/api';
import { RECURSOS, BLOQUES_MANANA, BLOQUES_TARDE, PROPOSITOS, horaOrdinal } from '../data/maestros';
import { cn } from '@/lib/utils';

const EQUIPOS_LISTA = [
  'Computadores', 'Video beam', 'Parlante', 'Emisora', 'TV interactivo', 'Impresora 3D',
];

interface Props {
  recursoId: string;
  fecha: string;
  bloqueId: number;
  onCerrar: () => void;
}

// Traduce mensajes de error del backend (Apps Script) al español
function traducirError(msg: string): string {
  if (!msg) return 'No se pudo crear la reserva';
  const m = msg.toLowerCase();
  if (m.includes('acción') && m.includes('desconocida')) return 'Error de comunicación con el servidor. Intenta de nuevo.';
  if (m.includes('unknown') || m.includes('accion get desconocida')) return 'Error de comunicación con el servidor. Intenta de nuevo.';
  if (m.includes('no autorizado') || m.includes('unauthorized')) return 'No tienes permiso para realizar esta acción.';
  if (m.includes('ya existe') || m.includes('already')) return 'Este espacio ya está reservado para ese horario.';
  if (m.includes('timeout') || m.includes('time out')) return 'El servidor tardó demasiado. Revisa tu conexión.';
  if (m.includes('network') || m.includes('fetch')) return 'Error de red. Verifica tu conexión a internet.';
  return msg; // devolver el mensaje original si no se reconoce
}

export default function PanelConfirmacion({ recursoId, fecha, bloqueId, onCerrar }: Props) {
  const { userId, jornada, agregarReserva } = useAppStore();
  const [proposito, setProposito]           = useState('');
  const [equiposSel, setEquiposSel]         = useState<string[]>([]);
  const [otroEquipo, setOtroEquipo]         = useState('');
  const [cargando, setCargando]             = useState(false);
  const [error, setError]                   = useState('');

  function toggleEquipo(eq: string) {
    setEquiposSel(prev => prev.includes(eq) ? prev.filter(x => x !== eq) : [...prev, eq]);
  }

  const equiposStr = [
    ...equiposSel,
    ...(equiposSel.includes('__otro__') && otroEquipo ? [`Otro: ${otroEquipo}`] : []),
  ].filter(x => x !== '__otro__').join(', ');

  const recurso = RECURSOS.find(r => r.id === recursoId);
  const bloques = jornada === 'tarde' ? BLOQUES_TARDE : BLOQUES_MANANA;
  const bloque  = bloques.find(b => b.id === bloqueId);

  // Formatear fecha legible
  const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  const [anio, mes, dia] = fecha.split('-');
  const fechaLegible = `${parseInt(dia)} ${MESES[parseInt(mes) - 1]} ${anio}`;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!userId || !proposito) return;
    setCargando(true);
    setError('');
    try {
      const res = await crearReserva({
        recurso: recursoId,
        fecha,
        bloque: bloqueId,
        solicitante: userId,
        proposito,
        equipos: equiposStr || undefined,
      });
      if (res.ok && res.id) {
        agregarReserva({
          id: res.id,
          recurso: recursoId,
          fecha,
          bloque: bloqueId,
          solicitante: userId,
          proposito,
          equipos: equiposStr || undefined,
          estado: 'pendiente',
          timestamp: new Date().toISOString(),
        });
        onCerrar();
      } else {
        setError(traducirError(res.error ?? ''));
      }
    } catch {
      setError('Error de conexión. Verifica tu internet.');
    } finally {
      setCargando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-md bg-gray-900/95 rounded-2xl border border-white/10 shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-white/8">
          <h3 className="text-white font-semibold">Solicitar reserva</h3>
          <button
            onClick={onCerrar}
            className="text-gray-500 hover:text-white transition text-lg leading-none"
          >
            ✕
          </button>
        </div>

        {/* Resumen */}
        <div className="px-6 py-4 bg-white/3 border-b border-white/6 text-sm space-y-2">
          <div className="flex justify-between">
            <span className="text-gray-500">Espacio</span>
            <span className="text-white font-semibold">{recurso?.nombre}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Fecha</span>
            <span className="text-white">{fechaLegible}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">{horaOrdinal(bloqueId)} hora</span>
            <span className="text-white">{bloque?.inicio} – {bloque?.fin}</span>
          </div>
        </div>

        {/* Formulario */}
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1.5">Propósito *</label>
            <select
              value={proposito}
              onChange={e => setProposito(e.target.value)}
              required
              className="w-full bg-gray-800 text-white rounded-xl px-3 py-2.5 text-sm border border-white/10 focus:outline-none focus:border-blue-500 transition"
            >
              <option value="">Seleccionar...</option>
              {PROPOSITOS.map(p => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1.5">Equipos adicionales</label>
            <div className="grid grid-cols-2 gap-1.5">
              {EQUIPOS_LISTA.map(eq => (
                <button
                  key={eq}
                  type="button"
                  onClick={() => toggleEquipo(eq)}
                  className={cn(
                    'flex items-center gap-2 px-3 py-2 rounded-xl border text-xs text-left transition-all',
                    equiposSel.includes(eq)
                      ? 'bg-blue-600/20 border-blue-500/60 text-blue-300'
                      : 'bg-white/4 border-white/10 text-gray-400 hover:border-white/20 hover:text-gray-300'
                  )}
                >
                  <span className={cn(
                    'w-3.5 h-3.5 rounded border flex-shrink-0 flex items-center justify-center text-[9px]',
                    equiposSel.includes(eq) ? 'bg-blue-500 border-blue-500 text-white' : 'border-gray-600'
                  )}>
                    {equiposSel.includes(eq) && '✓'}
                  </span>
                  {eq}
                </button>
              ))}
              <button
                type="button"
                onClick={() => toggleEquipo('__otro__')}
                className={cn(
                  'flex items-center gap-2 px-3 py-2 rounded-xl border text-xs text-left transition-all',
                  equiposSel.includes('__otro__')
                    ? 'bg-blue-600/20 border-blue-500/60 text-blue-300'
                    : 'bg-white/4 border-white/10 text-gray-400 hover:border-white/20 hover:text-gray-300'
                )}
              >
                <span className={cn(
                  'w-3.5 h-3.5 rounded border flex-shrink-0 flex items-center justify-center text-[9px]',
                  equiposSel.includes('__otro__') ? 'bg-blue-500 border-blue-500 text-white' : 'border-gray-600'
                )}>
                  {equiposSel.includes('__otro__') && '✓'}
                </span>
                Otro
              </button>
            </div>
            {equiposSel.includes('__otro__') && (
              <input
                type="text"
                placeholder="Especifica el equipo..."
                value={otroEquipo}
                onChange={e => setOtroEquipo(e.target.value)}
                className="mt-2 w-full bg-gray-800 text-white rounded-xl px-3 py-2 text-sm border border-white/10 focus:outline-none focus:border-blue-500 transition"
              />
            )}
          </div>

          {error && (
            <p className="text-red-400 text-xs bg-red-900/20 border border-red-800/40 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onCerrar}
              className="flex-1 py-3 rounded-xl bg-white/6 text-gray-300 hover:bg-white/10 text-sm transition font-medium"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={cargando || !proposito}
              className="flex-1 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white font-semibold text-sm transition"
            >
              {cargando ? 'Enviando...' : 'Solicitar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
