// Pantalla «Editar a mano» (tarea 5): matriz zonas × días con arrastrar y
// soltar. Todo por props, como el resto de src/components/acompanamientos —
// nunca toca el store, Firebase ni Apps Script (ver CLAUDE.md).
//
// Patrón de arrastre calcado de EditorHorarioMode.tsx: PointerSensor +
// TouchSensor con activationConstraint, y `touch-action: none` en las fichas
// arrastrables — sin eso el arrastre no funciona en Android (el navegador se
// queda el gesto como scroll de la página).

import { useState } from 'react';
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
import { cn } from '@/lib/utils';
import { USUARIOS } from '../../data/maestros';
import type { Asignacion, Dia, Distribucion, JornadaAcomp } from '../../data/acompanamientos/tipos';
import { DIAS } from '../../data/acompanamientos/tipos';
import { puedeCubrir, docentesDeLaJornada, esMixto } from '../../data/acompanamientos/disponibilidad';
import { clasesEnDia, DIA_CARGADO } from '../../data/acompanamientos/clases';
import { cargaPorDocente, revisar } from '../../data/acompanamientos/revision';
import { textoCargaDesigual } from '../../data/acompanamientos/textos';

interface Props {
  jornada: JornadaAcomp;
  distribucion: Distribucion;
  onCambiar: (nueva: Distribucion) => void;
}

const DIA_LABEL: Record<Dia, string> = {
  lunes: 'Lunes', martes: 'Martes', miercoles: 'Miércoles', jueves: 'Jueves', viernes: 'Viernes',
};

function nombreCorto(docenteId: string): string {
  return USUARIOS.find((u) => u.id === docenteId)?.nombreCorto ?? docenteId;
}

function claveCasilla(zonaId: string, dia: Dia): string {
  return `${zonaId}__${dia}`;
}

interface Origen {
  zonaId: string;
  dia: Dia;
}

interface ResultadoValidacion {
  ok: boolean;
  motivo?: string;
}

/** Valida si `docenteId` puede quedar en (zonaId, dia), viniendo o no de `origen`. */
export function validarSoltar(
  dist: Distribucion,
  jornada: JornadaAcomp,
  docenteId: string,
  zonaId: string,
  dia: Dia,
  origen: Origen | null,
): ResultadoValidacion {
  const zona = dist.zonas.find((z) => z.id === zonaId);
  if (!zona) return { ok: false, motivo: 'Esa zona ya no existe.' };

  if (!puedeCubrir(docenteId, jornada, dia)) {
    const jornadaLabel = jornada === 'manana' ? 'la mañana' : 'la tarde';
    return { ok: false, motivo: `${nombreCorto(docenteId)} no está en la jornada de ${jornadaLabel} el ${DIA_LABEL[dia].toLowerCase()}` };
  }

  const esMismaCasillaOrigen = (a: Asignacion) =>
    origen !== null && a.zonaId === origen.zonaId && a.dia === origen.dia && a.docenteId === docenteId;

  const otraZonaEseDia = dist.asignaciones.find(
    (a) => a.docenteId === docenteId && a.dia === dia && a.zonaId !== zonaId && !esMismaCasillaOrigen(a),
  );
  if (otraZonaEseDia) {
    const nombreZonaOtra = dist.zonas.find((z) => z.id === otraZonaEseDia.zonaId)?.nombre ?? otraZonaEseDia.zonaId;
    return { ok: false, motivo: `${nombreCorto(docenteId)} ya cubre ${nombreZonaOtra} el ${DIA_LABEL[dia].toLowerCase()}` };
  }

  const enEstaCasilla = dist.asignaciones.filter(
    (a) => a.zonaId === zonaId && a.dia === dia && !esMismaCasillaOrigen(a),
  );
  if (enEstaCasilla.some((a) => a.docenteId === docenteId)) {
    return { ok: false, motivo: `${nombreCorto(docenteId)} ya está en ${zona.nombre} el ${DIA_LABEL[dia].toLowerCase()}` };
  }
  if (enEstaCasilla.length >= zona.cupo) {
    return {
      ok: false,
      motivo: `${zona.nombre} ya tiene su cupo el ${DIA_LABEL[dia].toLowerCase()}: quita a alguien primero`,
    };
  }

  return { ok: true };
}

// ── Ficha arrastrable dentro de una casilla ─────────────────────────────────

function FichaCasilla({
  asignacion,
  jornada,
  onQuitar,
  onAlternarCandado,
}: {
  asignacion: Asignacion;
  jornada: JornadaAcomp;
  onQuitar: () => void;
  onAlternarCandado: () => void;
}) {
  const id = `ficha__${asignacion.zonaId}__${asignacion.dia}__${asignacion.docenteId}`;
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id,
    disabled: asignacion.candado,
  });
  const usuario = USUARIOS.find((u) => u.id === asignacion.docenteId);
  const clases = clasesEnDia(asignacion.docenteId, jornada, asignacion.dia);
  const diaCargado = clases >= DIA_CARGADO;
  const color = usuario?.color ?? '#94a3b8';

  return (
    <div
      ref={setNodeRef}
      {...(asignacion.candado ? {} : listeners)}
      {...attributes}
      style={{
        transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
        borderColor: diaCargado ? '#f59e0b' : color,
        backgroundColor: `${color}18`,
        opacity: isDragging ? 0.4 : 1,
        cursor: asignacion.candado ? 'not-allowed' : isDragging ? 'grabbing' : 'grab',
        touchAction: asignacion.candado ? undefined : 'none',
      }}
      className={cn(
        'relative rounded-md border px-1.5 py-0.5 flex items-center justify-between gap-1 select-none',
        diaCargado && 'border-2',
      )}
      title={diaCargado ? `día cargado: ${clases} clases` : undefined}
    >
      <span className="text-[11px] font-bold" style={{ color }}>
        {usuario?.nombreCorto ?? asignacion.docenteId}
      </span>
      <div className="flex items-center gap-1">
        <button
          onClick={(e) => { e.stopPropagation(); onAlternarCandado(); }}
          onPointerDown={(e) => e.stopPropagation()}
          className="text-[11px] leading-none opacity-80 hover:opacity-100"
          title={asignacion.candado ? 'Quitar candado' : 'Poner candado'}
        >
          {asignacion.candado ? '🔒' : '🔓'}
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onQuitar(); }}
          onPointerDown={(e) => e.stopPropagation()}
          className="text-[11px] leading-none opacity-80 hover:opacity-100 text-danger-soft-fg"
          title="Quitar"
        >
          ✕
        </button>
      </div>
    </div>
  );
}

// ── Casilla droppable ────────────────────────────────────────────────────────

function Casilla({
  zonaId,
  dia,
  cupo,
  asignaciones,
  jornada,
  onQuitar,
  onAlternarCandado,
}: {
  zonaId: string;
  dia: Dia;
  cupo: number;
  asignaciones: Asignacion[];
  jornada: JornadaAcomp;
  onQuitar: (docenteId: string) => void;
  onAlternarCandado: (docenteId: string) => void;
}) {
  const droppableId = `celda__${zonaId}__${dia}`;
  const { setNodeRef, isOver } = useDroppable({ id: droppableId });
  const incompleta = asignaciones.length < cupo;

  return (
    <td className="p-1 align-top">
      <div
        ref={setNodeRef}
        className={cn(
          'min-h-[42px] rounded-lg border p-0.5 flex flex-col gap-0.5 transition-colors',
          incompleta ? 'border-dashed border-line' : 'border-line',
          isOver && 'ring-2 ring-accent bg-accent/10',
        )}
      >
        <div className="text-[9px] text-muted text-right pr-0.5">
          {asignaciones.length}/{cupo}
        </div>
        {asignaciones.map((a) => (
          <FichaCasilla
            key={a.docenteId}
            asignacion={a}
            jornada={jornada}
            onQuitar={() => onQuitar(a.docenteId)}
            onAlternarCandado={() => onAlternarCandado(a.docenteId)}
          />
        ))}
      </div>
    </td>
  );
}

// ── Ficha de la bandeja ──────────────────────────────────────────────────────

function FichaBandeja({
  docenteId,
  nombreCorto: nombre,
  color,
  mixto,
  total,
  onHover,
}: {
  docenteId: string;
  nombreCorto: string;
  color: string;
  mixto: boolean;
  total: number;
  onHover: (docenteId: string | null) => void;
}) {
  const id = `bandeja__${docenteId}`;
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id });

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onMouseEnter={() => onHover(docenteId)}
      onMouseLeave={() => onHover(null)}
      onTouchStart={() => onHover(docenteId)}
      onTouchEnd={() => onHover(null)}
      style={{
        transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
        borderColor: color,
        backgroundColor: `${color}15`,
        opacity: isDragging ? 0.4 : 1,
        touchAction: 'none',
      }}
      className="rounded-full border px-2 py-1 flex items-center gap-1.5 select-none cursor-grab"
    >
      <div className="flex items-center gap-1">
        <span className="text-[11px] font-bold" style={{ color }}>{nombre}</span>
        {mixto && (
          <span className="text-[9px] font-semibold uppercase tracking-wide text-muted bg-elevated border border-line rounded-full px-1.5 py-0.5">
            mixto
          </span>
        )}
      </div>
      <span className="text-[10px] text-muted font-semibold">{total}</span>
    </div>
  );
}

// ── Componente principal ─────────────────────────────────────────────────────

export default function EditorManualAcompanamientos({ jornada, distribucion, onCambiar }: Props) {
  const [toast, setToast] = useState<string | null>(null);
  const [hoverDocenteId, setHoverDocenteId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 8 } }),
  );

  const docentes = docentesDeLaJornada(jornada);
  const carga = cargaPorDocente(distribucion);
  const { bloqueos, avisos } = revisar(distribucion);
  // Con metas fijadas por el coordinador manda el aviso meta_distinta, no el reparto parejo.
  const textoCarga = distribucion.metas ? null : textoCargaDesigual(distribucion);

  function mostrarToast(motivo: string) {
    setToast(motivo);
    window.clearTimeout((mostrarToast as unknown as { _t?: number })._t);
    (mostrarToast as unknown as { _t?: number })._t = window.setTimeout(() => setToast(null), 4500);
  }

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over) return;
    const overId = String(over.id);
    if (!overId.startsWith('celda__')) return;
    const resto = overId.slice('celda__'.length);
    const sepIdx = resto.lastIndexOf('__');
    const zonaId = resto.slice(0, sepIdx);
    const dia = resto.slice(sepIdx + 2) as Dia;

    const activeId = String(active.id);
    let docenteId: string;
    let origen: Origen | null = null;
    if (activeId.startsWith('bandeja__')) {
      docenteId = activeId.slice('bandeja__'.length);
    } else if (activeId.startsWith('ficha__')) {
      // ficha__{zonaId}__{dia}__{docenteId} — zonaId y docenteId no llevan '__'.
      const [oZ, oD, oDoc] = activeId.slice('ficha__'.length).split('__');
      docenteId = oDoc;
      origen = { zonaId: oZ, dia: oD as Dia };
    } else {
      return;
    }

    if (origen && origen.zonaId === zonaId && origen.dia === dia) return; // soltó en el mismo sitio

    const resultado = validarSoltar(distribucion, jornada, docenteId, zonaId, dia, origen);
    if (!resultado.ok) {
      mostrarToast(resultado.motivo ?? 'No se pudo mover.');
      return;
    }

    let asignaciones = distribucion.asignaciones;
    if (origen) {
      asignaciones = asignaciones.filter(
        (a) => !(a.zonaId === origen!.zonaId && a.dia === origen!.dia && a.docenteId === docenteId),
      );
    }
    asignaciones = [...asignaciones, { zonaId, dia, docenteId, candado: false }];
    onCambiar({ ...distribucion, asignaciones });
  }

  function quitar(zonaId: string, dia: Dia, docenteId: string) {
    onCambiar({
      ...distribucion,
      asignaciones: distribucion.asignaciones.filter(
        (a) => !(a.zonaId === zonaId && a.dia === dia && a.docenteId === docenteId),
      ),
    });
  }

  function alternarCandado(zonaId: string, dia: Dia, docenteId: string) {
    onCambiar({
      ...distribucion,
      asignaciones: distribucion.asignaciones.map((a) =>
        a.zonaId === zonaId && a.dia === dia && a.docenteId === docenteId ? { ...a, candado: !a.candado } : a,
      ),
    });
  }

  // La bandeja va ARRIBA y en fila (Julián, 16-09-2026): en columna a la izquierda
  // se comía el ancho y la semana no cabía sin desplazarse de lado.
  const bandejaNode = (
    <div className="space-y-1.5">
      <p className="text-[11px] font-semibold text-muted uppercase tracking-wide px-0.5">
        Profesores <span className="font-normal normal-case tracking-normal">· arrastra un nombre hasta una casilla</span>
      </p>
      <div className="flex flex-wrap gap-1.5 max-h-[24vh] overflow-y-auto pr-0.5">
        {docentes.map((u) => (
          <FichaBandeja
            key={u.id}
            docenteId={u.id}
            nombreCorto={u.nombreCorto}
            color={u.color}
            mixto={esMixto(u.id)}
            total={carga.get(u.id)?.total ?? 0}
            onHover={setHoverDocenteId}
          />
        ))}
      </div>
    </div>
  );

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <div className="space-y-3">
        {toast && (
          <div className="rounded-lg bg-danger-soft border border-danger px-3 py-2 text-xs text-danger-soft-fg">
            {toast}
          </div>
        )}

        {(bloqueos.length > 0 || avisos.length > 0) && (
          <div className="rounded-xl border border-line bg-elevated/40 p-3 space-y-1.5">
            {bloqueos.map((b, i) => (
              <p key={`b-${i}`} className="text-danger-soft-fg text-xs">⛔ {b.mensaje}</p>
            ))}
            {avisos
              .filter((a) => a.tipo !== 'carga_desigual')
              .map((a, i) => (
                <p key={`a-${i}`} className="text-warning-soft-fg text-xs">⚠ {a.mensaje}</p>
              ))}
            {textoCarga && <p className="text-warning-soft-fg text-xs">⚠ {textoCarga}</p>}
          </div>
        )}

        {bandejaNode}

        <div className="flex flex-col gap-3">
          <div className="flex-1 min-w-0 overflow-x-auto rounded-xl border border-line">
            <table className="text-[11px] border-collapse w-full" style={{ minWidth: 520 }}>
              <thead>
                <tr className="border-b border-line">
                  <th className="sticky left-0 bg-card z-10 text-left px-2 py-1.5 text-muted font-medium w-24">Zona</th>
                  {DIAS.map((dia) => {
                    const clases = hoverDocenteId ? clasesEnDia(hoverDocenteId, jornada, dia) : null;
                    const puede = hoverDocenteId ? puedeCubrir(hoverDocenteId, jornada, dia) : true;
                    return (
                      <th key={dia} className="text-center px-1 py-1.5 min-w-[84px]">
                        <div className="text-soft font-semibold">{DIA_LABEL[dia]}</div>
                        {hoverDocenteId && (
                          <div className={cn('text-[10px] mt-0.5', !puede ? 'text-muted' : clases !== null && clases >= DIA_CARGADO ? 'text-warning-soft-fg font-semibold' : 'text-muted')}>
                            {!puede ? 'no está' : `${clases} clase${clases === 1 ? '' : 's'}`}
                          </div>
                        )}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {distribucion.zonas.map((zona) => (
                  <tr key={zona.id} className="border-b border-line/50">
                    <td className="sticky left-0 bg-card z-10 px-2 py-1 font-semibold text-strong text-[11px] leading-tight">
                      {zona.nombre}
                    </td>
                    {DIAS.map((dia) => {
                      const asignaciones = distribucion.asignaciones.filter(
                        (a) => a.zonaId === zona.id && a.dia === dia,
                      );
                      return (
                        <Casilla
                          key={claveCasilla(zona.id, dia)}
                          zonaId={zona.id}
                          dia={dia}
                          cupo={zona.cupo}
                          asignaciones={asignaciones}
                          jornada={jornada}
                          onQuitar={(docenteId) => quitar(zona.id, dia, docenteId)}
                          onAlternarCandado={(docenteId) => alternarCandado(zona.id, dia, docenteId)}
                        />
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </DndContext>
  );
}
