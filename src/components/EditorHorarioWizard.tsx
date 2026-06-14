import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useAppStore } from '../data/store';
import {
  USUARIOS,
  BLOQUES_MANANA,
  BLOQUES_TARDE,
  horaOrdinal,
  getDocentes,
} from '../data/maestros';
import { horarioBase } from '../data/horarioBase';
import {
  fechaHoyLocal,
  diaDeSemana,
  formatearFechaLegible,
  generarIdHorarioMod,
  generarIdApoyo,
  TIPO_APOYO_LABEL,
} from '../data/horarioModificado';
import type {
  AusenciaDocente,
  ApoyoDisponible,
  HorarioModificado,
  TipoApoyo,
} from '../data/horarioModificado';
import { cn } from '@/lib/utils';

interface Props {
  open: boolean;
  jornada: 'manana' | 'tarde';
  onClose: () => void;
  onCompletar: (hm: HorarioModificado) => void;
}

type Paso = 1 | 2 | 3 | 4;

const NOMBRE_DIA: Record<string, string> = {
  lunes: 'lunes', martes: 'martes', miercoles: 'miércoles',
  jueves: 'jueves', viernes: 'viernes', sabado: 'sábado', domingo: 'domingo',
};

export default function EditorHorarioWizard({ open, jornada, onClose, onCompletar }: Props) {
  const { userId, horariosModificados, agregarHorarioModificado, actualizarHorarioModificado } = useAppStore();

  const [paso, setPaso]         = useState<Paso>(1);
  const [fecha, setFecha]       = useState(fechaHoyLocal());
  const [seleccionados, setSeleccionados] = useState<string[]>([]);    // docenteIds ausentes
  const [bloquesPorDocente, setBloquesPorDocente] = useState<Record<string, number[]>>({});
  const [apoyos, setApoyos]     = useState<ApoyoDisponible[]>([]);
  const [buscar, setBuscar]     = useState('');

  const docentesJornada = getDocentes(jornada);
  const bloques         = jornada === 'tarde' ? BLOQUES_TARDE : BLOQUES_MANANA;
  const dia             = diaDeSemana(fecha);
  const esDiaLectivo    = dia !== 'sabado' && dia !== 'domingo';

  // Reset al abrir
  function resetAndClose() {
    setPaso(1);
    setFecha(fechaHoyLocal());
    setSeleccionados([]);
    setBloquesPorDocente({});
    setApoyos([]);
    setBuscar('');
    onClose();
  }

  // Filtro del buscador (insensible a tildes)
  const docentesFiltrados = useMemo(() => {
    const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    const q = norm(buscar.trim());
    if (!q) return docentesJornada;
    return docentesJornada.filter(d => norm(d.nombre).includes(q) || norm(d.nombreCorto).includes(q));
  }, [docentesJornada, buscar]);

  function toggleDocente(id: string) {
    setSeleccionados(prev => {
      const yaEsta = prev.includes(id);
      if (yaEsta) {
        // al deseleccionar, limpiamos sus bloques
        setBloquesPorDocente(b => {
          const rest = { ...b };
          delete rest[id];
          return rest;
        });
        return prev.filter(x => x !== id);
      }
      // al seleccionar, marcar por defecto TODOS sus bloques del día
      const bloquesDelDia = horarioBase
        .filter(e => e.docente === id && e.dia === dia && e.jornada === jornada)
        .map(e => e.bloque);
      setBloquesPorDocente(b => ({ ...b, [id]: bloquesDelDia }));
      return [...prev, id];
    });
  }

  function toggleBloqueDocente(docenteId: string, bloqueId: number) {
    setBloquesPorDocente(prev => {
      const actual = prev[docenteId] ?? [];
      const nuevos = actual.includes(bloqueId)
        ? actual.filter(b => b !== bloqueId)
        : [...actual, bloqueId].sort((a, b) => a - b);
      return { ...prev, [docenteId]: nuevos };
    });
  }

  function agregarApoyo() {
    setApoyos(prev => [...prev, {
      id: generarIdApoyo(),
      tipo: 'PTA',
      nombre: '',
      bloques: [],
    }]);
  }

  function actualizarApoyo(id: string, cambios: Partial<ApoyoDisponible>) {
    setApoyos(prev => prev.map(a => a.id === id ? { ...a, ...cambios } : a));
  }

  function quitarApoyo(id: string) {
    setApoyos(prev => prev.filter(a => a.id !== id));
  }

  function toggleBloqueApoyo(apoyoId: string, bloqueId: number) {
    setApoyos(prev => prev.map(a => {
      if (a.id !== apoyoId) return a;
      const yaEsta = a.bloques.includes(bloqueId);
      return {
        ...a,
        bloques: yaEsta
          ? a.bloques.filter(b => b !== bloqueId)
          : [...a.bloques, bloqueId].sort((x, y) => x - y),
      };
    }));
  }

  function finalizar() {
    if (!userId) return;
    const ausencias: AusenciaDocente[] = seleccionados.map(id => ({
      docenteId: id,
      bloques: bloquesPorDocente[id] ?? [],
    }));

    // ¿Ya existe un borrador para esta fecha+jornada+autor?
    const existente = horariosModificados.find(h =>
      h.fecha === fecha && h.jornada === jornada && h.estado === 'borrador' && h.autor === userId
    );

    const apoyosLimpios = apoyos.filter(a => a.nombre.trim() && a.bloques.length > 0);

    if (existente) {
      actualizarHorarioModificado(existente.id, {
        ausencias,
        apoyos: apoyosLimpios,
        timestamp: new Date().toISOString(),
      });
      onCompletar({ ...existente, ausencias, apoyos: apoyosLimpios });
    } else {
      const nuevo: HorarioModificado = {
        id:        generarIdHorarioMod(),
        fecha,
        jornada,
        autor:     userId,
        ausencias,
        apoyos:    apoyosLimpios,
        modificaciones: [],
        estado:    'borrador',
        timestamp: new Date().toISOString(),
      };
      agregarHorarioModificado(nuevo);
      onCompletar(nuevo);
    }
    resetAndClose();
  }

  // Validaciones por paso
  const puedeAvanzar =
    paso === 1 ? esDiaLectivo :
    paso === 2 ? seleccionados.length > 0 :
    paso === 3 ? seleccionados.every(id => (bloquesPorDocente[id]?.length ?? 0) > 0) :
    true;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-3 sm:p-6"
          onClick={resetAndClose}
        >
          <motion.div
            initial={{ y: 30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 30, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 320, damping: 30 }}
            className="w-full max-w-2xl bg-card border border-line rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-6 pt-5 pb-4 border-b border-line flex items-center justify-between">
              <div>
                <h2 className="text-strong font-semibold text-base">Editar horario del día</h2>
                <p className="text-xs text-muted mt-0.5">
                  Jornada {jornada === 'manana' ? 'mañana' : 'tarde'} · Paso {paso} de 4
                </p>
              </div>
              <button
                onClick={resetAndClose}
                className="text-muted hover:text-strong transition text-lg leading-none p-1"
                aria-label="Cerrar"
              >✕</button>
            </div>

            {/* Stepper visual */}
            <div className="px-6 py-3 border-b border-line flex gap-1.5">
              {[1, 2, 3, 4].map(p => (
                <div
                  key={p}
                  className={cn(
                    'h-1 flex-1 rounded-full transition-all',
                    p < paso ? 'bg-blue-500' : p === paso ? 'bg-blue-400' : 'bg-hover'
                  )}
                />
              ))}
            </div>

            {/* Contenido del paso */}
            <div className="flex-1 overflow-y-auto px-6 py-5">
              <AnimatePresence mode="wait">
                {paso === 1 && (
                  <motion.div key="p1" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} className="space-y-4">
                    <div>
                      <h3 className="text-strong text-sm font-semibold mb-1">¿Para qué fecha es la modificación?</h3>
                      <p className="text-xs text-muted">El horario base vuelve automáticamente al día siguiente.</p>
                    </div>
                    <input
                      type="date"
                      value={fecha}
                      min={fechaHoyLocal()}
                      onChange={e => setFecha(e.target.value)}
                      className="w-full bg-card text-strong rounded-xl px-3 py-2.5 text-sm border border-line focus:outline-none focus:border-blue-500 transition"
                    />
                    <div className="bg-elevated border border-line rounded-xl px-4 py-3">
                      <div className="text-xs text-muted">Fecha seleccionada</div>
                      <div className="text-strong text-sm font-medium mt-0.5">{formatearFechaLegible(fecha)}</div>
                    </div>
                    {!esDiaLectivo && (
                      <div className="bg-yellow-900/20 border border-yellow-700/40 rounded-xl px-4 py-3 text-xs text-yellow-300">
                        ⚠ El {NOMBRE_DIA[dia]} no es un día lectivo. Elige una fecha entre lunes y viernes.
                      </div>
                    )}
                  </motion.div>
                )}

                {paso === 2 && (
                  <motion.div key="p2" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} className="space-y-4">
                    <div>
                      <h3 className="text-strong text-sm font-semibold mb-1">¿Qué docentes no estarán?</h3>
                      <p className="text-xs text-muted">Selecciona uno o varios. Puedes buscar por nombre.</p>
                    </div>
                    <input
                      type="text"
                      placeholder="Buscar docente..."
                      value={buscar}
                      onChange={e => setBuscar(e.target.value)}
                      className="w-full bg-card text-strong rounded-xl px-3 py-2.5 text-sm border border-line focus:outline-none focus:border-blue-500 transition"
                    />
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-72 overflow-y-auto pr-1">
                      {docentesFiltrados.map(d => {
                        const activo = seleccionados.includes(d.id);
                        return (
                          <button
                            key={d.id}
                            onClick={() => toggleDocente(d.id)}
                            className={cn(
                              'flex items-center gap-2 p-2.5 rounded-xl border text-left transition-all',
                              activo ? 'border-current' : 'border-line hover:border-line-strong'
                            )}
                            style={{
                              color: activo ? d.color : '#cbd5e1',
                              backgroundColor: activo ? `${d.color}22` : 'transparent',
                            }}
                          >
                            <span className={cn(
                              'w-4 h-4 rounded border-2 flex items-center justify-center text-[10px] flex-shrink-0',
                              activo ? '' : 'border-gray-600'
                            )} style={{ borderColor: activo ? d.color : undefined, backgroundColor: activo ? d.color : undefined }}>
                              {activo && <span className="text-gray-950">✓</span>}
                            </span>
                            <span className="text-xs font-bold truncate">{d.nombreCorto}</span>
                          </button>
                        );
                      })}
                    </div>
                    {seleccionados.length > 0 && (
                      <div className="text-xs text-soft">
                        Seleccionados: <span className="text-strong font-semibold">{seleccionados.length}</span>
                      </div>
                    )}
                  </motion.div>
                )}

                {paso === 3 && (
                  <motion.div key="p3" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} className="space-y-4">
                    <div>
                      <h3 className="text-strong text-sm font-semibold mb-1">¿Qué bloques se ven afectados?</h3>
                      <p className="text-xs text-muted">
                        Por defecto se marcan todos los bloques que el docente tenía el {NOMBRE_DIA[dia]}.
                        Quita el chulito si solo falta una parte del día.
                      </p>
                    </div>
                    <div className="space-y-3">
                      {seleccionados.map(id => {
                        const doc = USUARIOS.find(u => u.id === id)!;
                        const bloquesDelDia = horarioBase
                          .filter(e => e.docente === id && e.dia === dia && e.jornada === jornada)
                          .map(e => ({ bloque: e.bloque, grado: e.grado, aula: e.aula }))
                          .sort((a, b) => a.bloque - b.bloque);
                        const seleccionDoc = bloquesPorDocente[id] ?? [];
                        return (
                          <div key={id} className="bg-elevated border border-line rounded-2xl p-4">
                            <div className="flex items-center justify-between mb-3">
                              <div className="font-semibold text-sm" style={{ color: doc.color }}>{doc.nombre}</div>
                              <button
                                onClick={() => {
                                  const todos = bloquesDelDia.map(b => b.bloque);
                                  setBloquesPorDocente(prev => ({
                                    ...prev,
                                    [id]: seleccionDoc.length === todos.length ? [] : todos,
                                  }));
                                }}
                                className="text-[11px] text-blue-400 hover:text-blue-300 transition"
                              >
                                {seleccionDoc.length === bloquesDelDia.length ? 'Quitar todos' : 'Marcar todos'}
                              </button>
                            </div>
                            {bloquesDelDia.length === 0 ? (
                              <div className="text-xs text-muted italic py-2">
                                No tiene clases registradas el {NOMBRE_DIA[dia]} en esta jornada.
                              </div>
                            ) : (
                              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                {bloquesDelDia.map(b => {
                                  const activo  = seleccionDoc.includes(b.bloque);
                                  const bloque  = bloques.find(x => x.id === b.bloque);
                                  const gradoStr = b.grado.includes('/') ? b.grado.split('/')[0] : b.grado;
                                  return (
                                    <button
                                      key={b.bloque}
                                      onClick={() => toggleBloqueDocente(id, b.bloque)}
                                      className={cn(
                                        'flex items-start gap-2 p-2.5 rounded-xl border text-left transition-all',
                                        activo
                                          ? 'bg-red-900/25 border-red-700/50 text-red-200'
                                          : 'bg-elevated/60 border-line text-soft hover:border-line-strong'
                                      )}
                                    >
                                      <span className={cn(
                                        'w-4 h-4 rounded border-2 flex items-center justify-center text-[10px] flex-shrink-0 mt-0.5',
                                        activo ? 'bg-red-500 border-red-500 text-strong' : 'border-gray-600'
                                      )}>
                                        {activo && '✓'}
                                      </span>
                                      <div className="min-w-0">
                                        <div className="text-[11px] font-bold">{horaOrdinal(b.bloque)} hora</div>
                                        <div className="text-[10px] opacity-70">{bloque?.inicio} – {bloque?.fin}</div>
                                        <div className="text-[10px] mt-0.5">{gradoStr} · {b.aula}</div>
                                      </div>
                                    </button>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </motion.div>
                )}

                {paso === 4 && (
                  <motion.div key="p4" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} className="space-y-4">
                    <div>
                      <h3 className="text-strong text-sm font-semibold mb-1">¿Hay apoyos disponibles?</h3>
                      <p className="text-xs text-muted">
                        Opcional. Registra apoyos (PTA, UAI, docente de apoyo) o talleres
                        para usarlos al reorganizar. Puedes saltar este paso.
                      </p>
                    </div>

                    {apoyos.length === 0 && (
                      <div className="text-center py-6 text-muted text-sm border border-dashed border-line rounded-2xl">
                        Sin apoyos registrados
                      </div>
                    )}

                    <div className="space-y-3">
                      {apoyos.map(ap => (
                        <div key={ap.id} className="bg-elevated border border-line rounded-2xl p-4 space-y-3">
                          <div className="flex items-start gap-2">
                            <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-2">
                              <select
                                value={ap.tipo}
                                onChange={e => actualizarApoyo(ap.id, { tipo: e.target.value as TipoApoyo })}
                                className="bg-card text-strong text-xs rounded-lg px-2 py-2 border border-line focus:outline-none focus:border-blue-500"
                              >
                                {(Object.keys(TIPO_APOYO_LABEL) as TipoApoyo[]).map(t => (
                                  <option key={t} value={t}>{TIPO_APOYO_LABEL[t]}</option>
                                ))}
                              </select>
                              <input
                                type="text"
                                placeholder="Nombre o descripción"
                                value={ap.nombre}
                                onChange={e => actualizarApoyo(ap.id, { nombre: e.target.value })}
                                className="bg-card text-strong text-xs rounded-lg px-2 py-2 border border-line focus:outline-none focus:border-blue-500"
                              />
                            </div>
                            <button
                              onClick={() => quitarApoyo(ap.id)}
                              className="text-red-400 hover:text-red-300 text-sm leading-none px-2"
                              aria-label="Quitar apoyo"
                            >🗑</button>
                          </div>
                          <div>
                            <div className="text-[10px] text-muted mb-1.5">Disponible en:</div>
                            <div className="flex flex-wrap gap-1.5">
                              {bloques.map(b => {
                                const activo = ap.bloques.includes(b.id);
                                return (
                                  <button
                                    key={b.id}
                                    onClick={() => toggleBloqueApoyo(ap.id, b.id)}
                                    className={cn(
                                      'px-2.5 py-1 rounded-lg text-[10px] font-semibold border transition',
                                      activo
                                        ? 'bg-green-900/30 border-green-600/50 text-green-200'
                                        : 'bg-elevated/60 border-line text-muted hover:border-line-strong'
                                    )}
                                  >
                                    {horaOrdinal(b.id)}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    <button
                      onClick={agregarApoyo}
                      className="w-full py-2.5 rounded-xl border border-dashed border-line-strong text-soft hover:text-strong hover:border-white/30 text-sm transition"
                    >
                      + Agregar apoyo
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Footer con botones */}
            <div className="px-6 py-4 border-t border-line flex items-center justify-between gap-3 bg-card/80">
              <button
                onClick={() => paso > 1 ? setPaso((paso - 1) as Paso) : resetAndClose()}
                className="px-4 py-2.5 rounded-xl bg-elevated text-soft hover:bg-hover text-sm transition font-medium"
              >
                {paso === 1 ? 'Cancelar' : '← Atrás'}
              </button>
              <button
                onClick={() => paso < 4 ? setPaso((paso + 1) as Paso) : finalizar()}
                disabled={!puedeAvanzar}
                className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-strong font-semibold text-sm transition"
              >
                {paso < 4 ? 'Continuar →' : 'Crear borrador'}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
