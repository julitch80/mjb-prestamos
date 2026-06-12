import { useEffect, useState } from 'react';
import { useAppStore } from '../data/store';
import { getReservas } from '../data/api';
import type { Reserva } from '../data/api';
import { RECURSOS, BLOQUES_MANANA, BLOQUES_TARDE } from '../data/maestros';
import PanelConfirmacion from './PanelConfirmacion';

type CeldaEstado = 'libre' | 'ocupado' | 'propio' | 'clase';

function getEstado(
  recursoId: string,
  fecha: string,
  bloqueId: number,
  userId: string,
  reservas: Reserva[]
): CeldaEstado {
  const reserva = reservas.find(
    r => r.recurso === recursoId && r.fecha === fecha && r.bloque === bloqueId && r.estado !== 'cancelada' && r.estado !== 'rechazada'
  );
  if (!reserva) return 'libre';
  if (reserva.solicitante === userId) return 'propio';
  return 'ocupado';
}

const ESTADO_CLASES: Record<CeldaEstado, string> = {
  libre:   'bg-green-900/40 hover:bg-green-700/60 border-green-800 cursor-pointer',
  ocupado: 'bg-red-900/40 border-red-800 cursor-not-allowed',
  propio:  'bg-blue-900/40 border-blue-700 cursor-pointer',
  clase:   'bg-gray-800/60 border-gray-700 cursor-default',
};

function fechaHoy(): string {
  return new Date().toISOString().split('T')[0];
}

const DIAS_NOMBRES = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'];

export default function DisponibilidadGrid() {
  const { userId, jornada, reservas, setReservas } = useAppStore();
  const [semanaOffset, setSemanaOffset] = useState(0);
  const [cargando, setCargando] = useState(false);
  const [seleccion, setSeleccion] = useState<{ recursoId: string; fecha: string; bloqueId: number } | null>(null);

  const jornadaActual = jornada === 'tarde' ? 'tarde' : 'manana';
  const bloques = jornadaActual === 'tarde' ? BLOQUES_TARDE : BLOQUES_MANANA;
  const recursos = RECURSOS.filter(r => r.jornada === 'ambas' || r.jornada === jornadaActual);

  // Fechas de lunes a viernes de la semana actual + offset
  const fechas = Array.from({ length: 5 }, (_, i) => {
    const hoy = new Date();
    const lunes = new Date(hoy);
    lunes.setDate(hoy.getDate() - hoy.getDay() + 1 + semanaOffset * 7);
    lunes.setDate(lunes.getDate() + i);
    return lunes.toISOString().split('T')[0];
  });

  useEffect(() => {
    setCargando(true);
    getReservas()
      .then(setReservas)
      .catch(() => {})
      .finally(() => setCargando(false));
  }, [semanaOffset, setReservas]);

  return (
    <div className="space-y-4">
      {/* Cabecera y navegación semanal */}
      <div className="flex items-center gap-3">
        <h2 className="text-lg font-semibold text-white flex-1">Disponibilidad</h2>
        <button
          onClick={() => setSemanaOffset(v => v - 1)}
          className="px-3 py-1.5 rounded-lg bg-gray-800 text-gray-300 hover:bg-gray-700 text-sm transition"
        >
          ← Anterior
        </button>
        <button
          onClick={() => setSemanaOffset(0)}
          className="px-3 py-1.5 rounded-lg bg-gray-800 text-gray-300 hover:bg-gray-700 text-sm transition"
        >
          Hoy
        </button>
        <button
          onClick={() => setSemanaOffset(v => v + 1)}
          className="px-3 py-1.5 rounded-lg bg-gray-800 text-gray-300 hover:bg-gray-700 text-sm transition"
        >
          Siguiente →
        </button>
      </div>

      {cargando && (
        <div className="text-center py-4 text-gray-400 text-sm">Cargando...</div>
      )}

      {/* Tabla */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr>
              <th className="text-left text-gray-500 font-medium p-2 w-28">Espacio</th>
              {fechas.map((f, i) => (
                <th key={f} className="text-center text-gray-400 font-medium p-2" colSpan={bloques.length}>
                  <div className="flex flex-col items-center">
                    <span>{DIAS_NOMBRES[i]}</span>
                    <span className={`text-xs ${f === fechaHoy() ? 'text-blue-400 font-bold' : 'text-gray-600'}`}>
                      {f.slice(5)}
                    </span>
                  </div>
                </th>
              ))}
            </tr>
            <tr>
              <th />
              {fechas.map(f =>
                bloques.map(b => (
                  <th key={`${f}-${b.id}`} className="text-center text-xs text-gray-600 font-normal p-1">
                    B{b.id}
                  </th>
                ))
              )}
            </tr>
          </thead>
          <tbody>
            {recursos.map(recurso => (
              <tr key={recurso.id}>
                <td className="text-gray-300 font-medium p-2 text-xs">{recurso.nombre}</td>
                {fechas.map(fecha =>
                  bloques.map(bloque => {
                    const estado = getEstado(recurso.id, fecha, bloque.id, userId ?? '', reservas);
                    return (
                      <td
                        key={`${fecha}-${bloque.id}`}
                        onClick={() => {
                          if (estado === 'libre' || estado === 'propio') {
                            setSeleccion({ recursoId: recurso.id, fecha, bloqueId: bloque.id });
                          }
                        }}
                        className={`p-1 border rounded text-center text-xs m-0.5 transition ${ESTADO_CLASES[estado]}`}
                        title={`${recurso.nombre} · ${fecha} · B${bloque.id} · ${bloque.inicio}–${bloque.fin}`}
                      >
                        {estado === 'propio' ? '●' : ''}
                      </td>
                    );
                  })
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Leyenda */}
      <div className="flex items-center gap-4 text-xs text-gray-500">
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-green-900 border border-green-700 inline-block" /> Libre</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-900 border border-red-700 inline-block" /> Ocupado</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-blue-900 border border-blue-700 inline-block" /> Tuyo</span>
      </div>

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
