import { useState, useMemo, useEffect } from 'react';
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
  esFichaAusenteAhora,
  docentesLibresEn,
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
  esAusente,
  esTaller,
  docentesLibres,
  onEliminar,
  onMarcarTaller,
  onQuitarTaller,
  onCambiarSupervisor,
}: {
  ficha: FichaEditor;
  modo: ModoEditor;
  esAusente: boolean;
  esTaller: boolean;
  docentesLibres: { id: string; nombreCorto: string; color?: string }[];
  onEliminar: () => void;
  onMarcarTaller: () => void;
  onQuitarTaller: () => void;
  onCambiarSupervisor: (id: string | undefined) => void;
}) {
  // Taller no se arrastra (representa actividad fija); el resto sí
  const arrastrable = !esTaller;
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: ficha.id,
    disabled: !arrastrable,
  });

  const docente = USUARIOS.find(u => u.id === ficha.origen.docente);
  const supervisorId = ficha.ubicacion.tipo === 'taller' ? ficha.ubicacion.supervisorId : undefined;
  const supervisor   = supervisorId ? USUARIOS.find(u => u.id === supervisorId) : undefined;

  const colorBorde = esTaller
    ? '#f59e0b'
    : modo === 'docente'
      ? (COLORES_AULA[ficha.origen.aula] ?? '#aaa')
      : (docente?.color ?? '#aaa');

  const textoArriba = esTaller
    ? 'Taller'
    : (modo === 'docente'
        ? abrevAula(ficha.origen.aula)
        : (docente?.nombreCorto.split(' ')[0] ?? ficha.origen.docente));
  const textoAbajo  = modo === 'docente'
    ? ficha.origen.grupo
    : abrevAula(ficha.origen.aula);

  const colorArriba = esTaller
    ? '#f59e0b'
    : (modo === 'docente' ? colorBorde : (docente?.color ?? '#aaa'));
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
        backgroundColor: esTaller
          ? `${colorBorde}25`
          : esAusente ? `${colorBorde}10` : `${colorBorde}20`,
        opacity: isDragging ? 0.4 : (esAusente ? 0.55 : 1),
        cursor: arrastrable ? (isDragging ? 'grabbing' : 'grab') : 'default',
      }}
      className={cn(
        'relative h-full rounded-lg flex flex-col items-center justify-center px-1 gap-0.5 select-none transition-shadow',
        !esAusente && !esTaller && !isDragging && 'hover:shadow-lg hover:shadow-black/40',
        (esAusente || esTaller) && 'border-dashed'
      )}
      title={esTaller && docentesLibres.length > 0
        ? `Docentes libres a esta hora: ${docentesLibres.map(d => d.nombreCorto).join(', ')}`
        : undefined}
    >
      <span
        className={cn('text-[10px] font-bold leading-none', esAusente && !esTaller && 'line-through')}
        style={{ color: colorArriba }}
      >
        {textoArriba}
      </span>
      <span
        className={cn('text-[9px] leading-none truncate w-full text-center', esAusente && !esTaller && 'line-through')}
        style={{ color: esTaller && supervisor ? supervisor.color : colorAbajo }}
      >
        {esTaller
          ? (supervisor ? `con ${supervisor.nombreCorto}` : ficha.origen.grupo)
          : textoAbajo}
      </span>

      {/* Botones de acción */}
      {esAusente && !esTaller && (
        <>
          <button
            onClick={(e) => { e.stopPropagation(); onMarcarTaller(); }}
            className="absolute -top-1.5 -left-1.5 w-4 h-4 rounded-full bg-amber-600 hover:bg-amber-500 text-white text-[9px] font-bold leading-none flex items-center justify-center shadow"
            title="Queda con actividad/taller"
          >
            T
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onEliminar(); }}
            className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-red-600 hover:bg-red-500 text-white text-[10px] font-bold leading-none flex items-center justify-center shadow"
            title="Eliminar"
          >
            ×
          </button>
        </>
      )}
      {esTaller && (
        <>
          <button
            onClick={(e) => { e.stopPropagation(); onQuitarTaller(); }}
            className="absolute -top-1.5 -left-1.5 w-4 h-4 rounded-full bg-gray-600 hover:bg-gray-500 text-white text-[9px] font-bold leading-none flex items-center justify-center shadow"
            title="Quitar taller"
          >
            ↩
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onEliminar(); }}
            className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-red-600 hover:bg-red-500 text-white text-[10px] font-bold leading-none flex items-center justify-center shadow"
            title="Eliminar"
          >
            ×
          </button>
          {/* Selector compacto de supervisor */}
          {docentesLibres.length > 0 && (
            <select
              value={supervisorId ?? ''}
              onClick={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
              onChange={(e) => onCambiarSupervisor(e.target.value || undefined)}
              className="absolute -bottom-1.5 left-1 right-1 text-[8px] bg-gray-900/95 text-amber-200 border border-amber-700/40 rounded px-1 py-0.5"
              title={`${docentesLibres.length} docente(s) libre(s) a esta hora`}
            >
              <option value="">Asignar apoyo…</option>
              {docentesLibres.map(d => (
                <option key={d.id} value={d.id}>{d.nombreCorto}</option>
              ))}
            </select>
          )}
        </>
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
              <FichaArrastrable
                ficha={f}
                modo={modo}
                esAusente={false}
                esTaller={false}
                docentesLibres={[]}
                onEliminar={() => onEliminar(f.id)}
                onMarcarTaller={() => {}}
                onQuitarTaller={() => {}}
                onCambiarSupervisor={() => {}}
              />
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
  const [errorMovimiento, setErrorMovimiento] = useState<string | null>(null);
  const [verTodoElHorario, setVerTodoElHorario] = useState(false);

  // Auto-dismiss del toast de error tras 5 segundos
  useEffect(() => {
    if (!errorMovimiento) return;
    const t = setTimeout(() => setErrorMovimiento(null), 5000);
    return () => clearTimeout(t);
  }, [errorMovimiento]);

  const dia = diaDeSemana(borrador.fecha);
  const bloques = borrador.jornada === 'tarde' ? BLOQUES_TARDE : BLOQUES_MANANA;
  const directores = borrador.jornada === 'manana' ? DIRECTORES_MANANA : DIRECTORES_TARDE;

  // Sensores: pointer + touch para móvil
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor,   { activationConstraint: { delay: 150, tolerance: 8 } }),
  );

  // ── Grupos y docentes afectados por las ausencias declaradas ───────────────
  // Un grupo está afectado si en alguno de los bloques ausentes del docente,
  // ese docente daba clase a este grupo. Los docentes afectados son aquellos
  // que dan clase a algún grupo afectado durante el día del borrador.
  const { gruposAfectados, docentesAfectados } = useMemo(() => {
    const grupos = new Set<string>();
    borrador.ausencias.forEach(aus => {
      fichas.forEach(f => {
        if (f.origen.docente === aus.docenteId && aus.bloques.includes(f.origen.bloque)) {
          grupos.add(f.origen.grupo);
        }
      });
    });
    const docentes = new Set<string>();
    fichas.forEach(f => {
      if (grupos.has(f.origen.grupo)) docentes.add(f.origen.docente);
    });
    return { gruposAfectados: grupos, docentesAfectados: docentes };
  }, [borrador.ausencias, fichas]);

  // ── Estructura derivada: filas (docentes o grupos del día) ─────────────────
  const filas = useMemo(() => {
    if (modo === 'docente') {
      const idsConFicha = new Set(fichas.map(f => f.origen.docente));
      return getDocentes(borrador.jornada)
        .filter(d => idsConFicha.has(d.id))
        .filter(d => verTodoElHorario || docentesAfectados.has(d.id))
        .map(d => ({ id: d.id, nombre: d.nombreCorto, color: d.color, sub: '' }));
    }
    // grupo
    const grupos = Array.from(new Set(fichas.map(f => f.origen.grupo)))
      .filter(g => verTodoElHorario || gruposAfectados.has(g))
      .sort();
    return grupos.map(g => {
      const dir = USUARIOS.find(u => u.id === directores[g]);
      return {
        id: g,
        nombre: g,
        color: colorGrado(g),
        sub: dir?.nombreCorto ?? '',
      };
    });
  }, [modo, fichas, borrador.jornada, directores, verTodoElHorario, gruposAfectados, docentesAfectados]);

  // ── Mapa: para cada (fila, bloque) cuál ficha está colocada/taller ─────────
  const fichasColocadasPorCelda = useMemo(() => {
    const map: Record<string, FichaEditor> = {};
    fichas.forEach(f => {
      if (f.ubicacion.tipo !== 'colocada' && f.ubicacion.tipo !== 'taller') return;
      const rowId = modo === 'docente' ? f.origen.docente : f.origen.grupo;
      const bloque = f.ubicacion.tipo === 'colocada' ? f.ubicacion.bloque : f.ubicacion.bloque;
      map[`${rowId}__${bloque}`] = f;
    });
    return map;
  }, [fichas, modo]);

  const pendientes = fichas.filter(f => f.ubicacion.tipo === 'pendiente');

  // Lista de docentes candidatos para "libres en" — todos los de la jornada
  const candidatosLibres = useMemo(
    () => getDocentes(borrador.jornada).map(d => ({ id: d.id, nombreCorto: d.nombreCorto, color: d.color })),
    [borrador.jornada]
  );

  // ── Drag-and-drop handler ──────────────────────────────────────────────────
  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over) return;
    const fichaActiva = fichas.find(f => f.id === active.id);
    if (!fichaActiva) return;
    // Las fichas en estado "taller" no se arrastran
    if (fichaActiva.ubicacion.tipo === 'taller') return;

    const overId = String(over.id);

    // Drop en Pendientes — siempre permitido
    if (overId === '__pendientes__') {
      setFichas(prev => prev.map(f =>
        f.id === active.id ? { ...f, ubicacion: { tipo: 'pendiente' as const } } : f
      ));
      return;
    }

    const [overRowId, overBloqueStr] = overId.split('__');
    const overBloque = parseInt(overBloqueStr, 10);
    if (!overRowId || isNaN(overBloque)) return;

    // Restricción 1: solo se permite drop dentro de la misma fila
    const filaActiva = modo === 'docente' ? fichaActiva.origen.docente : fichaActiva.origen.grupo;
    if (overRowId !== filaActiva) return;

    // Helper para extraer el bloque actual de una ficha colocada o en taller
    const bloqueDe = (f: FichaEditor): number | null => {
      if (f.ubicacion.tipo === 'colocada' || f.ubicacion.tipo === 'taller') return f.ubicacion.bloque;
      return null;
    };

    // Restricción 2: conflicto cruzado de DOCENTE
    // El docente de la ficha movida ya tiene clase en este bloque con OTRO grupo
    const conflictoDoc = fichas.find(f =>
      f.id !== active.id &&
      f.origen.docente === fichaActiva.origen.docente &&
      f.origen.grupo !== fichaActiva.origen.grupo &&
      bloqueDe(f) === overBloque
    );
    if (conflictoDoc) {
      const docNombre = USUARIOS.find(u => u.id === fichaActiva.origen.docente)?.nombreCorto ?? 'El docente';
      setErrorMovimiento(
        `${docNombre} a la ${horaOrdinal(overBloque)} hora está con ${conflictoDoc.origen.grupo}. ` +
        `No se puede tener dos grupos al mismo tiempo.`
      );
      return;
    }

    // Restricción 3: conflicto cruzado de GRUPO
    // El grupo de la ficha movida ya tiene clase en este bloque con OTRO docente
    const conflictoGrp = fichas.find(f =>
      f.id !== active.id &&
      f.origen.grupo === fichaActiva.origen.grupo &&
      f.origen.docente !== fichaActiva.origen.docente &&
      bloqueDe(f) === overBloque
    );
    if (conflictoGrp) {
      const docOtro = USUARIOS.find(u => u.id === conflictoGrp.origen.docente)?.nombreCorto ?? 'otro docente';
      setErrorMovimiento(
        `${fichaActiva.origen.grupo} a la ${horaOrdinal(overBloque)} hora ya tiene clase con ${docOtro}. ` +
        `Un grupo no puede tener dos clases al mismo tiempo.`
      );
      return;
    }

    // Movimiento permitido: aplicar
    setFichas(prev => {
      const next = [...prev];
      const idxActiva = next.findIndex(f => f.id === active.id);
      if (idxActiva === -1) return prev;

      // El ocupante en la MISMA fila (mismo docente o mismo grupo en ese bloque) va a pendientes
      const ocupanteIdx = next.findIndex(f =>
        f.id !== active.id &&
        (f.ubicacion.tipo === 'colocada' || f.ubicacion.tipo === 'taller') &&
        bloqueDe(f) === overBloque &&
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

  function marcarTaller(id: string) {
    setFichas(prev => prev.map(f => {
      if (f.id !== id) return f;
      if (f.ubicacion.tipo !== 'colocada') return f;
      return { ...f, ubicacion: { tipo: 'taller' as const, bloque: f.ubicacion.bloque } };
    }));
  }

  function quitarTaller(id: string) {
    setFichas(prev => prev.map(f => {
      if (f.id !== id) return f;
      if (f.ubicacion.tipo !== 'taller') return f;
      return { ...f, ubicacion: { tipo: 'colocada' as const, bloque: f.ubicacion.bloque } };
    }));
  }

  function cambiarSupervisor(id: string, supervisorId: string | undefined) {
    setFichas(prev => prev.map(f => {
      if (f.id !== id) return f;
      if (f.ubicacion.tipo !== 'taller') return f;
      return { ...f, ubicacion: { ...f.ubicacion, supervisorId } };
    }));
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

  const hayAusenteSinResolver = fichas.some(f => esFichaAusenteAhora(f, borrador.ausencias));

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

          {/* Toggle: mostrar solo afectados o todo el horario */}
          <button
            onClick={() => setVerTodoElHorario(v => !v)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium border transition',
              verTodoElHorario
                ? 'bg-white/10 text-gray-200 border-white/15'
                : 'bg-blue-950/40 text-blue-200 border-blue-700/40'
            )}
            title={verTodoElHorario
              ? 'Mostrando todo el horario del día. Clic para ver solo los afectados.'
              : 'Mostrando solo lo afectado por las ausencias. Clic para ver todo el horario.'}
          >
            <span className="text-sm leading-none">{verTodoElHorario ? '☰' : '◎'}</span>
            {verTodoElHorario ? 'Ver todo el horario' : 'Solo afectados'}
          </button>

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
                    const esTaller   = ficha?.ubicacion.tipo === 'taller';
                    const esAusente  = ficha ? esFichaAusenteAhora(ficha, borrador.ausencias) : false;
                    const libres = (esTaller || esAusente)
                      ? docentesLibresEn(dia, b.id, borrador.jornada, horarioBase as any, candidatosLibres, borrador.ausencias)
                          // excluir al propio docente ausente como apoyo
                          .filter(d => d.id !== ficha?.origen.docente)
                      : [];
                    return (
                      <CeldaDroppable key={b.id} rowId={f.id} bloque={b.id}>
                        {ficha ? (
                          <FichaArrastrable
                            ficha={ficha}
                            modo={modo}
                            esAusente={esAusente}
                            esTaller={esTaller}
                            docentesLibres={libres}
                            onEliminar={() => eliminarFicha(ficha.id)}
                            onMarcarTaller={() => marcarTaller(ficha.id)}
                            onQuitarTaller={() => quitarTaller(ficha.id)}
                            onCambiarSupervisor={(supId) => cambiarSupervisor(ficha.id, supId)}
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
                  {!verTodoElHorario && (gruposAfectados.size > 0 || docentesAfectados.size > 0)
                    ? `Sin ${modo === 'docente' ? 'docentes' : 'grupos'} afectados visibles. Activa “Ver todo el horario” para mostrar el resto.`
                    : `No hay ${modo === 'docente' ? 'docentes' : 'grupos'} con clases este ${dia}.`}
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

      {/* Toast de error por conflicto cruzado */}
      <AnimatePresence>
        {errorMovimiento && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:max-w-md z-40 bg-red-950/95 backdrop-blur border border-red-700/60 rounded-2xl px-4 py-3 text-red-100 text-sm shadow-2xl"
          >
            <div className="flex items-start gap-3">
              <span className="text-base leading-none mt-0.5">⛔</span>
              <div className="flex-1">{errorMovimiento}</div>
              <button
                onClick={() => setErrorMovimiento(null)}
                className="text-red-300 hover:text-white text-sm leading-none p-0.5"
                aria-label="Cerrar"
              >✕</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

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
