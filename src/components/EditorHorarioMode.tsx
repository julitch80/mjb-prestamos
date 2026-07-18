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
import { enviarCorreoMasivo } from '../data/api';
import type { ResultadoCorreoMasivo } from '../data/api';
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
  compararGrupos,
} from '../data/maestros';
import { horarioBase } from '../data/horarioBase';
import {
  crearFichasIniciales,
  fichasAModificaciones,
  formatearFechaLegible,
  diaDeSemana,
  esFichaAusenteAhora,
  docentesLibresEn,
  generarPropuestasAsistente,
  generarResumenDifusion,
  configurarResolverNombreDocente,
  TIPO_APOYO_LABEL,
} from '../data/horarioModificado';
import type {
  HorarioModificado,
  FichaEditor,
  PropuestaAsistente,
  NivelPropuesta,
  ResumenDifusion,
} from '../data/horarioModificado';
import { generarPublicacionDeModificacion } from '../data/publicacion';
import type { PublicacionPendiente } from '../data/publicacion';
import ModalRevisarPublicacion from './ModalRevisarPublicacion';

configurarResolverNombreDocente(id =>
  USUARIOS.find(u => u.id === id)?.nombreCorto ?? id
);
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

/**
 * Detecta colisiones de aula: dos fichas activas (colocada o taller, no
 * eliminadas/pendientes) del mismo bloque que quedaron con la misma aula.
 * Ignora aula vacía y 'Patio' (Educación Física no usa aula física).
 * No bloquea nada — solo informa para que el coordinador revise.
 */
function detectarColisionesAula(lista: FichaEditor[]): string[] {
  const porBloque: Record<number, string[]> = {};
  lista.forEach(f => {
    if (f.ubicacion.tipo !== 'colocada' && f.ubicacion.tipo !== 'taller') return;
    const aula = f.origen.aula;
    if (!aula || aula === 'Patio') return;
    const bloque = f.ubicacion.bloque;
    (porBloque[bloque] ??= []).push(aula);
  });
  const avisos: string[] = [];
  Object.entries(porBloque).forEach(([bloqueStr, aulas]) => {
    const bloque = Number(bloqueStr);
    const conteo: Record<string, number> = {};
    aulas.forEach(a => { conteo[a] = (conteo[a] ?? 0) + 1; });
    Object.entries(conteo).forEach(([aula, n]) => {
      if (n > 1) {
        avisos.push(`⚠ ${aula} queda con dos clases en el bloque ${bloque} — revisa la asignación de aula.`);
      }
    });
  });
  return avisos;
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
            className="absolute -top-1.5 -left-1.5 w-4 h-4 rounded-full bg-warning hover:bg-warning/85 text-strong text-[9px] font-bold leading-none flex items-center justify-center shadow"
            title="Queda con actividad/taller"
          >
            T
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onEliminar(); }}
            className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-danger hover:bg-danger/85 text-strong text-[10px] font-bold leading-none flex items-center justify-center shadow"
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
            className="absolute -top-1.5 -left-1.5 w-4 h-4 rounded-full bg-gray-600 hover:bg-gray-500 text-strong text-[9px] font-bold leading-none flex items-center justify-center shadow"
            title="Quitar taller"
          >
            ↩
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onEliminar(); }}
            className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-danger hover:bg-danger/85 text-strong text-[10px] font-bold leading-none flex items-center justify-center shadow"
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
              className="absolute -bottom-1.5 left-1 right-1 text-[8px] bg-card text-warning-soft-fg border border-warning rounded px-1 py-0.5"
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
          isOver && !deshabilitada ? 'bg-accent/30 ring-2 ring-accent' : '',
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
          : 'border-line bg-elevated/50',
        isOver && 'ring-2 ring-accent bg-info-soft'
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
          <div className="text-[11px] text-muted italic py-2 px-1">
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
  const { userId, actualizarHorarioModificado, eliminarHorarioModificado, agregarPublicacionPendiente } = useAppStore();
  const [modo, setModo] = useState<ModoEditor>('grupo');
  const [fichas, setFichasRaw] = useState<FichaEditor[]>(() =>
    crearFichasIniciales(borrador, horarioBase as any)
  );
  const [historial, setHistorial] = useState<FichaEditor[][]>([]);
  const MAX_HISTORIAL = 30;

  // Envoltorio de setFichas que empuja un snapshot del estado ANTERIOR
  // a la pila de deshacer antes de aplicar cualquier cambio.
  function setFichas(updater: FichaEditor[] | ((prev: FichaEditor[]) => FichaEditor[])) {
    setFichasRaw(prev => {
      setHistorial(h => {
        const snapshot = prev.map(f => ({ ...f, ubicacion: { ...f.ubicacion } })) as FichaEditor[];
        const next = [...h, snapshot];
        return next.length > MAX_HISTORIAL ? next.slice(next.length - MAX_HISTORIAL) : next;
      });
      return typeof updater === 'function' ? (updater as (p: FichaEditor[]) => FichaEditor[])(prev) : updater;
    });
  }

  function deshacer() {
    setHistorial(h => {
      if (h.length === 0) return h;
      const last = h[h.length - 1];
      setFichasRaw(last);
      return h.slice(0, -1);
    });
  }

  const [confirmDescartar, setConfirmDescartar] = useState(false);
  const [errorMovimiento, setErrorMovimiento] = useState<string | null>(null);
  const [avisoColision, setAvisoColision] = useState<string[] | null>(null);
  const [verTodoElHorario, setVerTodoElHorario] = useState(false);
  const [asistenteAbierto, setAsistenteAbierto] = useState(false);
  const [resumenDifusion, setResumenDifusion] = useState<ResumenDifusion | null>(null);
  const [publicacionPendiente, setPublicacionPendiente] = useState<PublicacionPendiente | null>(null);
  const [revisarPublicacionAbierta, setRevisarPublicacionAbierta] = useState(false);
  const [copiado, setCopiado] = useState<'html' | 'texto' | 'correos' | null>(null);
  const [enviandoCorreo, setEnviandoCorreo] = useState(false);
  const [resultadoCorreo, setResultadoCorreo] = useState<ResultadoCorreoMasivo | null>(null);

  // Auto-dismiss del toast de error tras 5 segundos
  useEffect(() => {
    if (!errorMovimiento) return;
    const t = setTimeout(() => setErrorMovimiento(null), 5000);
    return () => clearTimeout(t);
  }, [errorMovimiento]);

  // Auto-dismiss del aviso de colisión de aula tras 8 segundos
  useEffect(() => {
    if (!avisoColision) return;
    const t = setTimeout(() => setAvisoColision(null), 8000);
    return () => clearTimeout(t);
  }, [avisoColision]);

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
      .sort(compararGrupos);
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
    const idxActiva = fichas.findIndex(f => f.id === active.id);
    if (idxActiva === -1) return;
    const next = [...fichas];

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

    setFichas(next);
    const colisiones = detectarColisionesAula(next);
    setAvisoColision(colisiones.length > 0 ? colisiones : null);
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

  // ── Asistente: propuestas y aplicación ─────────────────────────────────────
  const propuestas = useMemo(
    () => generarPropuestasAsistente(fichas, borrador),
    [fichas, borrador]
  );

  function aplicarPropuesta(p: PropuestaAsistente) {
    const next = fichas.map(f => {
      const cambio = p.cambios.find(c => c.fichaId === f.id);
      return cambio ? { ...f, ubicacion: cambio.nuevaUbicacion } : f;
    });
    setFichas(next);
    const colisiones = detectarColisionesAula(next);
    setAvisoColision(colisiones.length > 0 ? colisiones : null);
    setAsistenteAbierto(false);
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
    // Generar resumen para difundir
    const usuariosMinimos = USUARIOS.map(u => ({
      id: u.id, nombre: u.nombre, nombreCorto: u.nombreCorto, correo: u.correo,
    }));
    const resumen = generarResumenDifusion(
      { ...borrador, modificaciones, estado: 'guardado' },
      fichas,
      usuariosMinimos,
    );
    setResumenDifusion(resumen);

    // Crear publicación pendiente para la web del colegio (requiere aprobación)
    if (userId) {
      const pub = generarPublicacionDeModificacion(
        { ...borrador, modificaciones, estado: 'guardado' },
        fichas,
        usuariosMinimos,
        userId,
      );
      agregarPublicacionPendiente(pub);
      setPublicacionPendiente(pub);
    }
  }

  async function enviarCorreoAhora() {
    if (!resumenDifusion) return;
    setEnviandoCorreo(true);
    setResultadoCorreo(null);
    const destinatarios = resumenDifusion.docentesAfectados
      .map(d => d.correo)
      .filter((c): c is string => !!c && c.includes('@'));
    const cc = ['juancarlosbv@iemanueljbetancur.edu.co', 'uriel.lopez@iemanueljbetancur.edu.co'];
    const asunto = `[MJB] Modificación de horario — ${formatearFechaLegible(borrador.fecha)}`;
    try {
      const res = await enviarCorreoMasivo(destinatarios, asunto, resumenDifusion.html, cc);
      setResultadoCorreo(res);
    } catch {
      setResultadoCorreo({ ok: false, error: 'Error de red. Verifica tu conexión.' });
    } finally {
      setEnviandoCorreo(false);
    }
  }

  async function copiarPortapapeles(texto: string, kind: 'html' | 'texto' | 'correos') {
    try {
      if (kind === 'html' && navigator.clipboard?.write) {
        const blob = new Blob([texto], { type: 'text/html' });
        const blobTxt = new Blob([texto], { type: 'text/plain' });
        await navigator.clipboard.write([
          new ClipboardItem({ 'text/html': blob, 'text/plain': blobTxt }),
        ]);
      } else {
        await navigator.clipboard.writeText(texto);
      }
      setCopiado(kind);
      setTimeout(() => setCopiado(null), 2500);
    } catch {
      // Fallback simple
      const ta = document.createElement('textarea');
      ta.value = texto;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopiado(kind);
      setTimeout(() => setCopiado(null), 2500);
    }
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
        <div className="rounded-2xl border border-info bg-info-soft p-4 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-strong text-sm font-semibold flex items-center gap-2">
                <span className="text-info">✎</span> Editando horario
              </div>
              <div className="text-info-soft-fg text-xs mt-1">
                {formatearFechaLegible(borrador.fecha)} · Jornada {borrador.jornada === 'manana' ? 'mañana' : 'tarde'}
              </div>
              <div className="text-info-soft-fg/70 text-[11px] mt-1">
                Arrastra las pastillas dentro de la misma fila para reorganizar el día.
                Las clases del docente ausente aparecen tachadas — puedes eliminarlas con ✕.
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={deshacer}
                disabled={historial.length === 0}
                className={cn(
                  'px-3 py-2 rounded-xl text-xs transition',
                  historial.length === 0
                    ? 'bg-elevated text-muted cursor-not-allowed opacity-50'
                    : 'bg-elevated hover:bg-hover text-soft'
                )}
                title={historial.length === 0 ? 'No hay cambios para deshacer' : 'Deshacer el último cambio'}
              >
                ↩ Deshacer
              </button>
              <button
                onClick={() => setConfirmDescartar(true)}
                className="px-3 py-2 rounded-xl bg-elevated hover:bg-hover text-soft text-xs transition"
              >
                Descartar
              </button>
              <button
                onClick={guardar}
                disabled={pendientes.length > 0}
                className={cn(
                  'px-4 py-2 rounded-xl text-strong text-xs font-semibold transition shadow-lg',
                  pendientes.length > 0
                    ? 'bg-gray-700 cursor-not-allowed shadow-none'
                    : 'bg-accent hover:bg-accent/85 shadow-accent/30'
                )}
                title={pendientes.length > 0 ? 'Reubica los pendientes antes de guardar' : 'Guardar cambios'}
              >
                Guardar
              </button>
            </div>
          </div>

          {borrador.apoyos.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1 border-t border-info">
              <span className="text-[10px] text-info-soft-fg/70 pt-1">Apoyos disponibles:</span>
              {borrador.apoyos.map(a => (
                <span
                  key={a.id}
                  className="text-[10px] px-2 py-1 rounded-full bg-success-soft border border-success text-success-soft-fg"
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
          <div className="flex gap-1 p-1 rounded-xl bg-elevated border border-line">
            <button
              onClick={() => setModo('grupo')}
              className={cn(
                'px-4 py-2 rounded-xl text-sm font-medium transition',
                modo === 'grupo' ? 'bg-hover text-strong border border-line-strong' : 'text-muted hover:text-soft'
              )}
            >
              Por grupo
            </button>
            <button
              onClick={() => setModo('docente')}
              className={cn(
                'px-4 py-2 rounded-xl text-sm font-medium transition',
                modo === 'docente' ? 'bg-hover text-strong border border-line-strong' : 'text-muted hover:text-soft'
              )}
            >
              Por docente
            </button>
          </div>

          {/* Asistente de alternativas */}
          <button
            onClick={() => setAsistenteAbierto(true)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium border transition',
              propuestas.length > 0
                ? 'bg-purple-soft text-purple-soft-fg border-purple hover:bg-purple-soft'
                : 'bg-elevated text-muted border-line cursor-not-allowed'
            )}
            disabled={propuestas.length === 0}
            title={propuestas.length === 0
              ? 'No hay alternativas automáticas para este caso'
              : `${propuestas.length} propuesta(s) automática(s)`}
          >
            <span className="text-sm leading-none">✨</span>
            Alternativas
            {propuestas.length > 0 && (
              <span className="ml-1 inline-flex items-center justify-center w-4 h-4 rounded-full bg-purple/30 text-[10px] font-bold text-strong">
                {propuestas.length}
              </span>
            )}
          </button>

          {/* Toggle: mostrar solo afectados o todo el horario */}
          <button
            onClick={() => setVerTodoElHorario(v => !v)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium border transition',
              verTodoElHorario
                ? 'bg-white/10 text-gray-200 border-line-strong'
                : 'bg-info-soft text-info-soft-fg border-info'
            )}
            title={verTodoElHorario
              ? 'Mostrando todo el horario del día. Clic para ver solo los afectados.'
              : 'Mostrando solo lo afectado por las ausencias. Clic para ver todo el horario.'}
          >
            <span className="text-sm leading-none">{verTodoElHorario ? '☰' : '◎'}</span>
            {verTodoElHorario ? 'Ver todo el horario' : 'Solo afectados'}
          </button>

          {hayAusenteSinResolver && (
            <div className="text-[11px] text-danger-soft-fg bg-danger-soft border border-danger rounded-lg px-2.5 py-1">
              Quedan clases del ausente sin resolver
            </div>
          )}
        </div>

        {/* Pendientes */}
        <PendientesDroppable fichas={pendientes} modo={modo} onEliminar={eliminarFicha} />

        {/* Tabla editable */}
        <div className="overflow-x-auto rounded-2xl border border-line bg-white/2">
          <table className="text-xs border-collapse w-full" style={{ minWidth: 600 }}>
            <thead>
              <tr className="border-b border-line">
                <th className="sticky left-0 bg-card z-10 text-left px-3 py-2.5 text-muted font-medium w-28">
                  {modo === 'docente' ? 'Docente' : 'Grupo'}
                </th>
                {bloques.map(b => (
                  <th key={b.id} className="text-center px-1 py-2.5 min-w-[80px]">
                    <div className="text-soft font-semibold text-xs">{horaOrdinal(b.id)}</div>
                    <div className="text-muted text-[9px]">{b.inicio}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filas.map((f, ri) => (
                <tr key={f.id} className={cn('border-b border-white/5', ri % 2 !== 0 ? 'bg-elevated/30' : '')}>
                  <td
                    className="sticky left-0 bg-card z-10 px-3"
                    style={{ height: 56 }}
                  >
                    <div className="font-bold text-[11px]" style={{ color: f.color }}>{f.nombre}</div>
                    {f.sub && <div className="text-[9px] text-muted mt-0.5">{f.sub}</div>}
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
                          <div className="h-full rounded-lg border border-dashed border-line flex items-center justify-center">
                            <span className="text-muted opacity-60 text-[10px]">—</span>
                          </div>
                        )}
                      </CeldaDroppable>
                    );
                  })}
                </tr>
              ))}
              {filas.length === 0 && (
                <tr><td colSpan={bloques.length + 1} className="text-center py-8 text-muted text-sm">
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
          <div className="text-[11px] text-muted">
            <button
              onClick={() => setFichas(crearFichasIniciales(borrador, horarioBase as any))}
              className="text-info hover:text-info-soft-fg underline"
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
            className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:max-w-md z-40 bg-red-950/95 backdrop-blur border border-danger rounded-2xl px-4 py-3 text-danger-soft-fg text-sm shadow-2xl"
          >
            <div className="flex items-start gap-3">
              <span className="text-base leading-none mt-0.5">⛔</span>
              <div className="flex-1">{errorMovimiento}</div>
              <button
                onClick={() => setErrorMovimiento(null)}
                className="text-danger-soft-fg hover:text-strong text-sm leading-none p-0.5"
                aria-label="Cerrar"
              >✕</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Aviso no bloqueante de colisión de aula */}
      <AnimatePresence>
        {avisoColision && avisoColision.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:max-w-md z-40 bg-amber-950/95 backdrop-blur border border-warning rounded-2xl px-4 py-3 text-warning-soft-fg text-sm shadow-2xl space-y-1.5"
          >
            <div className="flex items-start gap-3">
              <span className="text-base leading-none mt-0.5">⚠</span>
              <div className="flex-1 space-y-1">
                {avisoColision.map((msg, i) => <div key={i}>{msg}</div>)}
              </div>
              <button
                onClick={() => setAvisoColision(null)}
                className="text-warning-soft-fg hover:text-strong text-sm leading-none p-0.5"
                aria-label="Cerrar"
              >✕</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal de resumen para difundir tras guardar */}
      <AnimatePresence>
        {resumenDifusion && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/45 dark:bg-black/75 backdrop-blur-sm p-3 sm:p-6"
          >
            <motion.div
              initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 30, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 320, damping: 30 }}
              className="w-full max-w-2xl bg-card border border-line rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
            >
              <div className="px-6 pt-5 pb-4 border-b border-line">
                <h2 className="text-strong font-semibold text-base flex items-center gap-2">
                  <span className="text-success">✓</span> Cambios guardados — Listo para difundir
                </h2>
                <p className="text-xs text-muted mt-0.5">
                  Copia el resumen y envíalo por correo, WhatsApp o pégalo en la página web.
                </p>
              </div>

              <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
                {/* Vista previa del HTML */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-semibold text-soft">Vista previa</h3>
                    <div className="flex gap-2">
                      <button
                        onClick={() => copiarPortapapeles(resumenDifusion.html, 'html')}
                        className={cn(
                          'px-3 py-1.5 rounded-lg text-xs font-medium transition',
                          copiado === 'html'
                            ? 'bg-success text-strong'
                            : 'bg-accent hover:bg-accent/85 text-strong'
                        )}
                      >
                        {copiado === 'html' ? '✓ Copiado' : 'Copiar HTML (correo / web)'}
                      </button>
                      <button
                        onClick={() => copiarPortapapeles(resumenDifusion.texto, 'texto')}
                        className={cn(
                          'px-3 py-1.5 rounded-lg text-xs font-medium transition',
                          copiado === 'texto'
                            ? 'bg-success text-strong'
                            : 'bg-success hover:bg-success/85 text-strong'
                        )}
                      >
                        {copiado === 'texto' ? '✓ Copiado' : 'Copiar texto (WhatsApp)'}
                      </button>
                    </div>
                  </div>
                  <div
                    className="bg-white rounded-xl p-4 max-h-72 overflow-y-auto text-gray-900"
                    dangerouslySetInnerHTML={{ __html: resumenDifusion.html }}
                  />
                </div>

                {/* Envío automático de correos */}
                {resumenDifusion.docentesAfectados.length > 0 && (
                  <div className="rounded-xl border border-info bg-info-soft p-3 space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <div className="text-xs text-info-soft-fg">
                        <strong>📧 Envío automático de correos</strong>
                        <div className="opacity-80 mt-0.5">
                          Manda este resumen por correo a los <strong>{resumenDifusion.docentesAfectados.filter(d => d.correo && d.correo.includes('@')).length} docentes afectados</strong> con copia a Juan Carlos Blandón y Uriel López.
                        </div>
                      </div>
                      <button
                        onClick={enviarCorreoAhora}
                        disabled={enviandoCorreo || resultadoCorreo?.ok === true}
                        className={cn(
                          'px-4 py-2 rounded-lg text-xs font-semibold transition flex items-center gap-2 flex-shrink-0',
                          resultadoCorreo?.ok === true
                            ? 'bg-success text-white cursor-default'
                            : enviandoCorreo
                              ? 'bg-info/60 text-white cursor-not-allowed'
                              : 'bg-info hover:bg-info/85 text-white'
                        )}
                      >
                        {enviandoCorreo ? (
                          <>
                            <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            Enviando…
                          </>
                        ) : resultadoCorreo?.ok === true ? (
                          <>✓ Enviado</>
                        ) : (
                          <>Enviar correo a todos →</>
                        )}
                      </button>
                    </div>

                    {resultadoCorreo && (
                      <div className={cn(
                        'text-[11px] rounded-lg border px-2 py-1.5',
                        resultadoCorreo.ok
                          ? 'bg-success-soft border-success text-success-soft-fg'
                          : 'bg-danger-soft border-danger text-danger-soft-fg'
                      )}>
                        {resultadoCorreo.ok ? (
                          <>
                            ✓ {resultadoCorreo.enviados ?? 0} de {resultadoCorreo.total ?? 0} correos enviados correctamente.
                            {resultadoCorreo.fallidos && resultadoCorreo.fallidos.length > 0 && (
                              <div className="mt-1 opacity-80">
                                No se pudo enviar a: {resultadoCorreo.fallidos.map(f => f.correo).join(', ')}
                              </div>
                            )}
                          </>
                        ) : (
                          <>⛔ {resultadoCorreo.error ?? 'No se pudo enviar.'}</>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Docentes afectados */}
                {resumenDifusion.docentesAfectados.length > 0 && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-sm font-semibold text-soft">
                        Docentes afectados ({resumenDifusion.docentesAfectados.length})
                      </h3>
                      <button
                        onClick={() => {
                          const correos = resumenDifusion.docentesAfectados
                            .map(d => d.correo)
                            .filter(Boolean)
                            .join(', ');
                          const cc = ['juancarlosbv@iemanueljbetancur.edu.co', 'uriel.lopez@iemanueljbetancur.edu.co'].join(', ');
                          copiarPortapapeles(correos ? `${correos}, ${cc}` : cc, 'correos');
                        }}
                        className={cn(
                          'px-3 py-1.5 rounded-lg text-xs font-medium transition',
                          copiado === 'correos'
                            ? 'bg-success text-strong'
                            : 'bg-purple hover:bg-purple/85 text-strong'
                        )}
                      >
                        {copiado === 'correos' ? '✓ Copiado' : 'Copiar correos (+ Blandón, Uriel)'}
                      </button>
                    </div>
                    <div className="bg-elevated border border-line rounded-xl divide-y divide-white/8">
                      {resumenDifusion.docentesAfectados.map(d => (
                        <div key={d.id} className="flex items-center gap-3 px-3 py-2 text-xs">
                          <span className="font-semibold text-gray-200 flex-1">{d.nombre}</span>
                          <span className={cn(
                            'px-2 py-0.5 rounded-full text-[10px] font-medium',
                            d.motivo === 'ausente' ? 'bg-danger-soft text-danger-soft-fg' :
                            d.motivo === 'clase movida' ? 'bg-info-soft text-info-soft-fg' :
                            'bg-warning-soft text-warning-soft-fg'
                          )}>
                            {d.motivo}
                          </span>
                          {d.correo && (
                            <span className="text-muted truncate max-w-[200px]">{d.correo}</span>
                          )}
                        </div>
                      ))}
                    </div>
                    <p className="text-[10px] text-muted mt-1.5 italic">
                      El correo de difusión incluye automáticamente a Juan Carlos Blandón y Uriel López.
                    </p>
                  </div>
                )}
              </div>

              <div className="px-6 py-4 border-t border-line bg-card/80 flex justify-end gap-3">
                <button
                  onClick={() => { setResumenDifusion(null); onSalir(); }}
                  className="px-5 py-2.5 rounded-xl bg-accent hover:bg-accent/85 text-accent-fg text-sm font-semibold transition"
                >
                  Cerrar y volver al horario
                </button>
              </div>

              {publicacionPendiente && (
                <div className="px-6 py-3 border-t border-line bg-info-soft text-info-soft-fg text-xs flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-2">
                    <span className="text-base">📄</span>
                    <span>
                      Se generó una <strong>publicación pendiente</strong> para la página del colegio.
                      Revísala antes de aprobarla.
                    </span>
                  </div>
                  <button
                    onClick={() => setRevisarPublicacionAbierta(true)}
                    className="px-3 py-1.5 rounded-xl bg-info hover:bg-info/85 text-white text-xs font-semibold transition flex-shrink-0"
                  >
                    Revisar publicación →
                  </button>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal del asistente de alternativas */}
      <AnimatePresence>
        {asistenteAbierto && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/45 dark:bg-black/75 backdrop-blur-sm p-3 sm:p-6"
            onClick={() => setAsistenteAbierto(false)}
          >
            <motion.div
              initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 30, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 320, damping: 30 }}
              className="w-full max-w-xl bg-card border border-line rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[88vh]"
              onClick={e => e.stopPropagation()}
            >
              <div className="px-6 pt-5 pb-4 border-b border-line flex items-center justify-between">
                <div>
                  <h2 className="text-strong font-semibold text-base flex items-center gap-2">
                    <span className="text-purple">✨</span> Alternativas del sistema
                  </h2>
                  <p className="text-xs text-muted mt-0.5">
                    Propuestas automáticas para resolver las ausencias declaradas.
                  </p>
                </div>
                <button
                  onClick={() => setAsistenteAbierto(false)}
                  className="text-muted hover:text-strong transition text-lg leading-none p-1"
                  aria-label="Cerrar"
                >✕</button>
              </div>

              <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
                {propuestas.length === 0 ? (
                  <div className="text-center py-8 text-muted text-sm">
                    Sin propuestas automáticas para este caso. Sigue editando manualmente.
                  </div>
                ) : ([1, 2, 3] as NivelPropuesta[]).map(nivel => {
                  const grupo = propuestas
                    .filter(p => p.nivel === nivel)
                    .sort((a, b) => a.clasesPerdidas - b.clasesPerdidas || a.prioridad - b.prioridad);
                  if (grupo.length === 0) return null;
                  const tituloNivel = nivel === 1
                    ? 'Nivel 1 · Reorganizar el día'
                    : nivel === 2
                      ? 'Nivel 2 · Aprovechar apoyos disponibles'
                      : 'Nivel 3 · Modificar entrada o salida del grupo';
                  const subtitulo = nivel === 1
                    ? 'Mínima pérdida de clases. El grupo cumple su jornada completa.'
                    : nivel === 2
                      ? 'Cubrir las clases del ausente con talleres o docentes de apoyo registrados.'
                      : borrador.jornada === 'manana'
                        ? 'Última opción. Se prioriza entrada tardía sobre salida temprana en la jornada de la mañana.'
                        : 'Última opción. Se prioriza salida temprana sobre entrada tardía en la jornada de la tarde.';
                  const colorNivel = nivel === 1 ? 'text-success-soft-fg' : nivel === 2 ? 'text-purple-soft-fg' : 'text-warning-soft-fg';
                  return (
                    <div key={nivel} className="space-y-3">
                      <div className="flex items-baseline justify-between gap-3 pb-1 border-b border-line">
                        <h3 className={cn('text-sm font-semibold', colorNivel)}>{tituloNivel}</h3>
                        <span className="text-[11px] text-muted">{grupo.length} opci{grupo.length === 1 ? 'ón' : 'ones'}</span>
                      </div>
                      <p className="text-[11px] text-muted -mt-1">{subtitulo}</p>
                      <div className="space-y-2">
                        {grupo.map(p => {
                          const colorBg = p.tipo === 'compactar' ? 'bg-success-soft border-success'
                            : p.tipo === 'apoyo_taller' ? 'bg-purple-soft border-purple'
                            : p.tipo === 'entrada_tardia' ? 'bg-info-soft border-info'
                            : 'bg-warning-soft border-warning';
                          const colorTexto = p.tipo === 'compactar' ? 'text-success-soft-fg'
                            : p.tipo === 'apoyo_taller' ? 'text-purple-soft-fg'
                            : p.tipo === 'entrada_tardia' ? 'text-info-soft-fg'
                            : 'text-warning-soft-fg';
                          const colorBtn = p.tipo === 'compactar' ? 'bg-success hover:bg-success/85'
                            : p.tipo === 'apoyo_taller' ? 'bg-purple hover:bg-purple/85'
                            : p.tipo === 'entrada_tardia' ? 'bg-accent hover:bg-accent/85'
                            : 'bg-warning hover:bg-warning/85';
                          return (
                            <div key={p.id} className={cn('rounded-2xl border p-4', colorBg)}>
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <div className={cn('font-semibold text-sm', colorTexto)}>{p.titulo}</div>
                                    <span className={cn(
                                      'text-[10px] px-2 py-0.5 rounded-full font-semibold border flex-shrink-0',
                                      p.clasesPerdidas === 0
                                        ? 'bg-success-soft border-success text-success-soft-fg'
                                        : 'bg-warning-soft border-warning text-warning-soft-fg'
                                    )}>
                                      {p.clasesPerdidas === 0
                                        ? 'Sin pérdida de clases'
                                        : `Pierde ${p.clasesPerdidas} clase${p.clasesPerdidas === 1 ? '' : 's'}`}
                                    </span>
                                  </div>
                                  <div className="text-xs text-soft mt-1">{p.descripcion}</div>
                                </div>
                                <button
                                  onClick={() => aplicarPropuesta(p)}
                                  className={cn('px-3 py-2 rounded-xl text-strong text-xs font-semibold transition flex-shrink-0', colorBtn)}
                                >
                                  Aplicar
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="px-6 py-3 border-t border-line bg-card/80 text-[11px] text-muted">
                Las propuestas se ordenan por nivel de prioridad. Puedes aplicar más de una y combinar con ediciones manuales.
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Confirmación de descarte */}
      <AnimatePresence>
        {confirmDescartar && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 dark:bg-black/75 backdrop-blur-sm p-4"
            onClick={() => setConfirmDescartar(false)}
          >
            <motion.div
              initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
              className="w-full max-w-sm bg-card border border-line rounded-2xl p-5 space-y-4"
              onClick={e => e.stopPropagation()}
            >
              <h3 className="text-strong font-semibold">¿Descartar el borrador?</h3>
              <p className="text-soft text-sm">
                Se perderán todos los cambios y se borrará el borrador. Esta acción no se puede deshacer.
              </p>
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => setConfirmDescartar(false)}
                  className="px-3 py-2 rounded-xl bg-elevated hover:bg-hover text-soft text-sm transition"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => { setConfirmDescartar(false); descartar(); }}
                  className="px-4 py-2 rounded-xl bg-danger hover:bg-danger/85 text-strong text-sm font-semibold transition"
                >
                  Descartar
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal de revisión / aprobación / publicación */}
      <ModalRevisarPublicacion
        publicacion={revisarPublicacionAbierta ? publicacionPendiente : null}
        onClose={() => setRevisarPublicacionAbierta(false)}
      />
    </DndContext>
  );
}
