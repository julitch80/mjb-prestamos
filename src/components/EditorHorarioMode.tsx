import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  DndContext,
  useDraggable,
  useDroppable,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  closestCenter,
} from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';

import { useAppStore } from '../data/store';
import {
  USUARIOS,
  BLOQUES_MANANA,
  BLOQUES_TARDE,
  DIRECTORES_MANANA,
  DIRECTORES_TARDE,
  COLORES_AULA,
  colorGrado,
  horaOrdinal,
  getDocentes,
} from '../data/maestros';
import { horarioBase } from '../data/horarioBase';
import {
  crearFichasIniciales,
  fichasAModificaciones,
  formatearFechaLegible,
  diaDeSemana,
  TIPO_APOYO_LABEL,
} from '../data/horarioModificado';
import type {
  HorarioModificado,
  FichaEditor,
} from '../data/horarioModificado';
import { cn } from '@/lib/utils';

type ModoEditor = 'docente' | 'grupo';

interface Props {
  borrador: HorarioModificado;
  onSalir: () => void;
}

// ── Helpers de UI ────────────────────────────────────────────────────────────

function abrevAula(aula: string): string {
  return aula
    .replace('Aula ', 'A')
    .replace('Lab. Ciencias', 'Lab.')
    .replace('Sala Informática', 'SI')
    .replace('Sala Info.', 'SI');
}

// ── Ficha arrastrable ────────────────────────────────────────────────────────

function FichaArrastrable({
  ficha,
  modo,
  onEliminar,
}: {
  ficha: FichaEditor;
  modo: ModoEditor;
  onEliminar: () => void;
}) {
  const arrastrable = !ficha.esAusente;
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: ficha.id,
    disabled: !arrastrable,
  });

  const docente = USUARIOS.find(u => u.id === ficha.origen.docente);
  const colorBorde =
    modo === 'docente'
      ? (COLORES_AULA[ficha.origen.aula] ?? '#aaa')
      : (docente?.color ?? '#aaa');
  const textoArriba = modo === 'docente'
    ? abrevAula(ficha.origen.aula)
    : (docente?.nombreCorto.split(' ')[0] ?? ficha.origen.docente);
  const textoAbajo  = modo === 'docente'
    ? ficha.origen.grupo
    : abrevAula(ficha.origen.aula);

  const colorArriba = modo === 'docente' ? colorBorde : (docente?.color ?? '#aaa');
  const colorAbajo  = modo === 'docente' ? colorGrado(ficha.origen.grupo) : '#94a3b8';

  return (
    <div
      ref={setNodeRef}
      {...(arrastrable ? listeners : {})}
      {...attributes}
      style={{
        transform: CSS.Translate.toString(transform),
        borderWidth: 1,
        borderColor: colorBorde,
        backgroundColor: ficha.esAusente ? `${colorBorde}10` : `${colorBorde}20`,
        opacity: isDragging ? 0.4 : (ficha.esAusente ? 0.55 : 1),
        cursor: arrastrable ? (isDragging ? 'grabbing' : 'grab') : 'default',
      }}
      className={cn(
        'relative h-full rounded-lg flex flex-col items-center justify-center px-1 gap-0.5 select-none transition-shadow',
        !ficha.esAusente && !isDragging && 'hover:shadow-lg hover:shadow-black/40',
        ficha.esAusente && 'border-dashed'
      )}
    >
      <span
        className={cn('text-[10px] font-bold leading-none', ficha.esAusente && 'line-through')}
        style={{ color: colorArriba }}
      >
        {textoArriba}
      </span>
      <span
        className={cn('text-[9px] leading-none', ficha.esAusente && 'line-through')}
        style={{ color: colorAbajo }}
      >
        {textoAbajo}
      </span>
      {ficha.esAusente && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onEliminar();
          }}
          className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-red-600 hover:bg-red-500 text-white text-[10px] font-bold leading-none flex items-center justify-center shadow"
          title="Eliminar"
        >
          ×
        </button>
      )}
    </div>
  );
}

// ── Celda droppable ──────────────────────────────────────────────────────────

function CeldaDroppable({
  rowId, bloque, children, deshabilitada,
}: {
  rowId: string; bloque: number; children: React.ReactNode; deshabilitada?: boolean;
}) {
  const droppableId = `${rowId}__${bloque}`;
  const { setNodeRef, isOver } = useDroppable({ id: droppableId, disabled: deshabilitada });

  return (
    <td className="p-1" style={{ height: 56 }}>
      <div
        ref={setNodeRef}
        className={cn(
          'h-full rounded-lg transition-colors',
          isOver && !deshabilitada ? 'bg-blue-500/30 ring-2 ring-blue-400' : '',
          deshabilitada ? 'opacity-30' : ''
        )}
      >
        {children}
      </div>
    </td>
  );
}

// ── Slot pendiente (también droppable a "pendientes") ────────────────────────

function PendientesDroppable({
  fichas, modo, onEliminar,
}: {
  fichas: FichaEditor[]; modo: ModoEditor; onEliminar: (id: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: '__pendientes__' });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'rounded-2xl border p-3 transition-colors',
        fichas.length > 0
          ? 'border-orange-500/50 bg-orange-950/30'
          : 'border-white/10 bg-white/3',
        isOver && 'ring-2 ring-blue-400 bg-blue-950/30'
      )}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="text-xs font-semibold text-orange-300 flex items-center gap-2">
          <span className="text-base">⚠</span>
          Pendientes
          <span className="text-orange-400/70 font-normal">
            {fichas.length === 0 ? 'nada por reubicar' : `${fichas.length} por reubicar`}
          </span>
        </div>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {fichas.length === 0 ? (
          <div className="text-[11px] text-gray-600 italic py-2 px-1">
            Las pastillas que entren en conflicto al moverlas aparecerán aquí.
          </div>
        ) : (
          fichas.map(f => (
            <div key={f.id} className="flex-shrink-0 w-20 h-14 relative">
              <FichaArrastrable ficha={f} modo={modo} onEliminar={() => onEliminar(f.id)} />
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ── Componente principal ─────────────────────────────────────────────────────

export default function EditorHorarioMode({ borrador, onSalir }: Props) {
  const { actualizarHorarioModificado, eliminarHorarioModificado } = useAppStore();
  const [modo, setModo] = useState<ModoEditor>('grupo');
  const [fichas, setFichas] = useState<FichaEditor[]>(() =>
    crearFichasIniciales(borrador, horarioBase as any)
  );
  const [confirmDescartar, setConfirmDescartar] = useState(false);

  const dia = diaDeSemana(borrador.fecha);
  const bloques = borrador.jornada === 'tarde' ? BLOQUES_TARDE : BLOQUES_MANANA;
  const directores = borrador.jornada === 'manana' ? DIRECTORES_MANANA : DIRECTORES_TARDE;

  // Sensores: pointer + touch para móvil
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor,   { activationConstraint: { delay: 150, tolerance: 8 } }),
  );

  // ── Estructura derivada: filas (docentes o grupos del día) ─────────────────
  const filas = useMemo(() => {
    if (modo === 'docente') {
      // Solo docentes que tienen al menos una ficha (origen) en el día afectado
      const idsConFicha = new Set(fichas.map(f => f.origen.docente));
      return getDocentes(borrador.jornada)
        .filter(d => idsConFicha.has(d.id))
        .map(d => ({ id: d.id, nombre: d.nombreCorto, color: d.color, sub: '' }));
    }
    // grupo
    const grupos = Array.from(new Set(fichas.map(f => f.origen.grupo))).sort();
    return grupos.map(g => {
      const dir = USUARIOS.find(u => u.id === directores[g]);
      return {
        id: g,
        nombre: g,
        color: colorGrado(g),
        sub: dir?.nombreCorto ?? '',
      };
    });
  }, [modo, fichas, borrador.jornada, directores]);

  // ── Mapa: para cada (fila, bloque) cuál ficha está colocada ────────────────
  const fichasColocadasPorCelda = useMemo(() => {
    const map: Record<string, FichaEditor> = {};
    fichas.forEach(f => {
      if (f.ubicacion.tipo !== 'colocada') return;
      const rowId = modo === 'docente' ? f.origen.docente : f.origen.grupo;
      map[`${rowId}__${f.ubicacion.bloque}`] = f;
    });
    return map;
  }, [fichas, modo]);

  const pendientes = fichas.filter(f => f.ubicacion.tipo === 'pendiente');

  // ── Drag-and-drop handler ──────────────────────────────────────────────────
  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over) return;
    const fichaActiva = fichas.find(f => f.id === active.id);
    if (!fichaActiva || fichaActiva.esAusente) return;

    const overId = String(over.id);

    setFichas(prev => {
      const next = [...prev];
      const idxActiva = next.findIndex(f => f.id === active.id);
      if (idxActiva === -1) return prev;

      if (overId === '__pendientes__') {
        next[idxActiva] = { ...next[idxActiva], ubicacion: { tipo: 'pendiente' } };
        return next;
      }

      const [overRowId, overBloqueStr] = overId.split('__');
      const overBloque = parseInt(overBloqueStr, 10);
      if (!overRowId || isNaN(overBloque)) return prev;

      // Solo permitir drop dentro de la misma fila (mismo docente o mismo grupo)
      const filaActiva = modo === 'docente' ? fichaActiva.origen.docente : fichaActiva.origen.grupo;
      if (overRowId !== filaActiva) return prev;

      // ¿Hay ficha ya colocada en (overRowId, overBloque)?
      const ocupanteIdx = next.findIndex(f =>
        f.id !== active.id &&
        f.ubicacion.tipo === 'colocada' &&
        f.ubicacion.bloque === overBloque &&
        (modo === 'docente' ? f.origen.docente === overRowId : f.origen.grupo === overRowId)
      );
      if (ocupanteIdx !== -1) {
        next[ocupanteIdx] = { ...next[ocupanteIdx], ubicacion: { tipo: 'pendiente' } };
      }

      next[idxActiva] = {
        ...next[idxActiva],
        ubicacion: { tipo: 'colocada', bloque: overBloque },
      };
      return next;
    });
  }

  // ── Acciones de fichas ─────────────────────────────────────────────────────
  function eliminarFicha(id: string) {
    setFichas(prev => prev.map(f =>
      f.id === id ? { ...f, ubicacion: { tipo: 'eliminada' as const } } : f
    ));
  }

  // ── Guardar / descartar ────────────────────────────────────────────────────
  function guardar() {
    if (pendientes.length > 0) return;
    const modificaciones = fichasAModificaciones(fichas);
    actualizarHorarioModificado(borrador.id, {
      modificaciones,
      estado: 'guardado',
      timestamp: new Date().toISOString(),
    });
    onSalir();
  }

  function descartar() {
    eliminarHorarioModificado(borrador.id);
    onSalir();
  }

  const hayAusenteSinResolver = fichas.some(f => f.esAusente && f.ubicacion.tipo !== 'eliminada');

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <div className="space-y-3">
        {/* Banner superior */}
        <div className="rounded-2xl border border-blue-700/40 bg-blue-950/40 p-4 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-white text-sm font-semibold flex items-center gap-2">
                <span className="text-blue-400">✎</span> Editando horario
              </div>
              <div className="text-blue-200 text-xs mt-1">
                {formatearFechaLegible(borrador.fecha)} · Jornada {borrador.jornada === 'manana' ? 'mañana' : 'tarde'}
              </div>
              <div className="text-blue-300/70 text-[11px] mt-1">
                Arrastra las pastillas dentro de la misma fila para reorganizar el día.
                Las clases del docente ausente aparecen tachadas — puedes eliminarlas con ✕.
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={() => setConfirmDescartar(true)}
                className="px-3 py-2 rounded-xl bg-white/6 hover:bg-white/12 text-gray-300 text-xs transition"
              >
                Descartar
              </button>
              <button
                onClick={guardar}
                disabled={pendientes.length > 0}
                className={cn(
                  'px-4 py-2 rounded-xl text-white text-xs font-semibold transition shadow-lg',
                  pendientes.length > 0
                    ? 'bg-gray-700 cursor-not-allowed shadow-none'
                    : 'bg-blue-600 hover:bg-blue-500 shadow-blue-900/30'
                )}
                title={pendientes.length > 0 ? 'Reubica los pendientes antes de guardar' : 'Guardar cambios'}
              >
                Guardar
              </button>
            </div>
          </div>

          {borrador.apoyos.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1 border-t border-blue-800/30">
              <span className="text-[10px] text-blue-300/70 pt-1">Apoyos disponibles:</span>
              {borrador.apoyos.map(a => (
                <span
                  key={a.id}
                  className="text-[10px] px-2 py-1 rounded-full bg-green-900/40 border border-green-700/40 text-green-200"
                  title={a.bloques.map(b => `${horaOrdinal(b)} hora`).join(', ')}
                >
                  {TIPO_APOYO_LABEL[a.tipo]}: {a.nombre} ({a.bloques.length} {a.bloques.length === 1 ? 'hora' : 'horas'})
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Selector modo edición */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex gap-1 p-1 rounded-xl bg-white/4 border border-white/8">
            <button
              onClick={() => setModo('grupo')}
              className={cn(
                'px-4 py-2 rounded-xl text-sm font-medium transition',
                modo === 'grupo' ? 'bg-white/12 text-white border border-white/15' : 'text-gray-500 hover:text-gray-300'
              )}
            >
              Por grupo
            </button>
            <button
              onClick={() => setModo('docente')}
              className={cn(
                'px-4 py-2 rounded-xl text-sm font-medium transition',
                modo === 'docente' ? 'bg-white/12 text-white border border-white/15' : 'text-gray-500 hover:text-gray-300'
              )}
            >
              Por docente
            </button>
          </div>
          {hayAusenteSinResolver && (
            <div className="text-[11px] text-red-300 bg-red-900/30 border border-red-700/40 rounded-lg px-2.5 py-1">
              Quedan clases del ausente sin resolver
            </div>
          )}
        </div>

        {/* Pendientes */}
        <PendientesDroppable fichas={pendientes} modo={modo} onEliminar={eliminarFicha} />

        {/* Tabla editable */}
        <div className="overflow-x-auto rounded-2xl border border-white/8 bg-white/2">
          <table className="text-xs border-collapse w-full" style={{ minWidth: 600 }}>
            <thead>
              <tr className="border-b border-white/8">
                <th className="sticky left-0 bg-gray-950/98 z-10 text-left px-3 py-2.5 text-gray-500 font-medium w-28">
                  {modo === 'docente' ? 'Docente' : 'Grupo'}
                </th>
                {bloques.map(b => (
                  <th key={b.id} className="text-center px-1 py-2.5 min-w-[80px]">
                    <div className="text-gray-300 font-semibold text-xs">{horaOrdinal(b.id)}</div>
                    <div className="text-gray-600 text-[9px]">{b.inicio}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filas.map((f, ri) => (
                <tr key={f.id} className={cn('border-b border-white/5', ri % 2 !== 0 ? 'bg-white/[0.015]' : '')}>
                  <td
                    className="sticky left-0 bg-gray-950/95 z-10 px-3"
                    style={{ height: 56 }}
                  >
                    <div className="font-bold text-[11px]" style={{ color: f.color }}>{f.nombre}</div>
                    {f.sub && <div className="text-[9px] text-gray-600 mt-0.5">{f.sub}</div>}
                  </td>
                  {bloques.map(b => {
                    const ficha = fichasColocadasPorCelda[`${f.id}__${b.id}`];
                    return (
                      <CeldaDroppable key={b.id} rowId={f.id} bloque={b.id}>
                        {ficha ? (
                          <FichaArrastrable
                            ficha={ficha}
                            modo={modo}
                            onEliminar={() => eliminarFicha(ficha.id)}
                          />
                        ) : (
                          <div className="h-full rounded-lg border border-dashed border-white/8 flex items-center justify-center">
                            <span className="text-gray-800 text-[10px]">—</span>
                          </div>
                        )}
                      </CeldaDroppable>
                    );
                  })}
                </tr>
              ))}
              {filas.length === 0 && (
                <tr><td colSpan={bloques.length + 1} className="text-center py-8 text-gray-600 text-sm">
                  No hay {modo === 'docente' ? 'docentes' : 'grupos'} con clases este {dia}.
                </td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Reset */}
        {fichas.some(f => f.ubicacion.tipo === 'pendiente' || (f.ubicacion.tipo === 'colocada' && f.ubicacion.bloque !== f.origen.bloque) || f.ubicacion.tipo === 'eliminada') && (
          <div className="text-[11px] text-gray-500">
            <button
              onClick={() => setFichas(crearFichasIniciales(borrador, horarioBase as any))}
              className="text-blue-400 hover:text-blue-300 underline"
            >
              Restablecer al horario base
            </button>
          </div>
        )}
      </div>

      {/* Confirmación de descarte */}
      <AnimatePresence>
        {confirmDescartar && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
            onClick={() => setConfirmDescartar(false)}
          >
            <motion.div
              initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
              className="w-full max-w-sm bg-gray-950 border border-white/10 rounded-2xl p-5 space-y-4"
              onClick={e => e.stopPropagation()}
            >
              <h3 className="text-white font-semibold">¿Descartar el borrador?</h3>
              <p className="text-gray-400 text-sm">
                Se perderán todos los cambios y se borrará el borrador. Esta acción no se puede deshacer.
              </p>
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => setConfirmDescartar(false)}
                  className="px-3 py-2 rounded-xl bg-white/6 hover:bg-white/12 text-gray-300 text-sm transition"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => { setConfirmDescartar(false); descartar(); }}
                  className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-sm font-semibold transition"
                >
                  Descartar
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </DndContext>
  );
}
