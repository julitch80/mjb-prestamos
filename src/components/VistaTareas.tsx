import { useCallback, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'motion/react';
import { CalendarDays, Camera, Check, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, ClipboardList, CopyPlus, FolderOpen, Gift, ListChecks, Paperclip, HandCoins, Loader2, QrCode, Settings2, Trash2, X } from 'lucide-react';
import AgendaGrupo from './AgendaGrupo';
import ModalReplicarTarea from './ModalReplicarTarea';
import { subirAdjuntoTarea } from '../data/tareas/adjuntos';
import { useAppStore } from '../data/store';
import {
  getDatosTareas, crearTarea, cancelarTarea, crearCesion,
  crearSolicitudCesion, responderSolicitudCesion, guardarCupos, guardarAnclasGrupo,
} from '../data/api';
import { USUARIOS, colorGrado, DIRECTORES_MANANA, DIRECTORES_TARDE } from '../data/maestros';
import { getAsignatura, asignacionDeGrupo } from '../data/asignacionAcademica';
import type { Tarea, Cesion, SolicitudCesion, FechaISO } from '../data/tareas/tipos';
import { anclasPorDefecto, ANCLAS_GRUPO_MAX, ANCLA_LABEL_MAX, type Ancla } from '../data/tareas/habitos';
import {
  addDias, esDiaHabil, esDiaEjecutable, hoyISO, parseFecha, formatFecha, diaSemana, esFestivo,
} from '../data/tareas/calendario';
import { CONFIG_NIVEL, nivelDeGrupo, cupoDeAsignatura, CUPOS_DEFAULT, NIVELES_CUPO, MAX_MOMENTOS_NIVEL } from '../data/tareas/config';
import {
  planificarAgenda, ocupacionPorDia, validarTarea, ventanaValida, cupoDisponible,
  clavePeriodo, fechaLegible,
} from '../data/tareas/motor';
import { diasDeClase, gruposAsignables, todosLosGrupos, esGrupoDeTarde } from '../data/tareas/horario';
import { cn } from '@/lib/utils';

// Director de ese grupo: solo él (o coordinación/rectoría, ya cubiertos por
// `esDirectivo` en cada panel) puede tocar sus anclas — ver
// docs/anclas-por-grupo-contrato.md.
function esDirectorDeGrupo(userId: string | null, grupo: string): boolean {
  return !!userId && (DIRECTORES_MANANA[grupo] === userId || DIRECTORES_TARDE[grupo] === userId);
}

/**
 * Editor de las anclas de "¿cuándo la vas a hacer?" de un grupo. Vive aquí
 * (VistaTareas, dentro de la app, con sesión) y NUNCA en la agenda pública
 * (AgendaGrupo/AgendaPublica), que no tiene login y solo debe leer.
 *
 * Al abrir por primera vez sin anclas guardadas se precarga con las de por
 * defecto de la jornada: partir de una lista vacía es lo que hace que nadie
 * use esto (ver contrato). Reordenar es con flechas arriba/abajo — más
 * simple y más táctil que arrastrar, y no depende de hover.
 */
function EditorAnclas({ grupo, anclasActuales, onCerrar }: {
  grupo: string;
  anclasActuales?: Ancla[];
  onCerrar: () => void;
}) {
  const qc = useQueryClient();
  const [anclas, setAnclas] = useState<Ancla[]>(() =>
    anclasActuales && anclasActuales.length > 0 ? anclasActuales : anclasPorDefecto(grupo)
  );
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function actualizar(i: number, label: string) {
    setAnclas(prev => prev.map((a, idx) => (idx === i ? { ...a, label: label.slice(0, ANCLA_LABEL_MAX) } : a)));
  }
  function quitar(i: number) {
    setAnclas(prev => prev.filter((_, idx) => idx !== i));
  }
  function mover(i: number, dir: -1 | 1) {
    setAnclas(prev => {
      const j = i + dir;
      if (j < 0 || j >= prev.length) return prev;
      const copia = [...prev];
      [copia[i], copia[j]] = [copia[j], copia[i]];
      return copia;
    });
  }
  function agregar() {
    if (anclas.length >= ANCLAS_GRUPO_MAX) return;
    setAnclas(prev => [...prev, { id: `a${Date.now()}`, label: '' }]);
  }

  const hayVacias = anclas.some(a => !a.label.trim());
  const puedeGuardar = anclas.length > 0 && !hayVacias && !guardando;

  async function guardar() {
    if (!puedeGuardar) return;
    setGuardando(true);
    setError(null);
    const limpio = anclas.map(a => ({ id: a.id, label: a.label.trim().slice(0, ANCLA_LABEL_MAX) }));
    const r = await guardarAnclasGrupo(grupo, limpio);
    setGuardando(false);
    if (r.ok) {
      qc.invalidateQueries({ queryKey: ['datosTareas'] });
      onCerrar();
    } else {
      setError(r.error ?? 'No se pudo guardar. Intenta de nuevo.');
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/60 flex items-start justify-center overflow-y-auto p-4"
      onClick={onCerrar}
    >
      <div className="rounded-2xl border border-line bg-card p-4 max-w-sm w-full my-8" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-2 mb-1">
          <ListChecks size={18} className="text-soft" />
          <h3 className="font-bold text-strong">Anclas de <span style={{ color: colorGrado(grupo) }}>{grupo}</span></h3>
          <button onClick={onCerrar} className="ml-auto p-1.5 rounded-lg text-muted hover:text-strong hover:bg-elevated">
            <X size={16} />
          </button>
        </div>
        <p className="text-[11px] text-muted mb-3">
          Esto se decide con el grupo: es lo que los estudiantes verán al elegir cuándo van a hacer
          cada tarea. Que suene a la rutina real del curso, no a redacción de adulto.
        </p>

        <div className="space-y-2">
          {anclas.map((a, i) => (
            <div key={a.id} className="flex items-center gap-1.5">
              <div className="flex flex-col">
                <button onClick={() => mover(i, -1)} disabled={i === 0}
                  aria-label="Subir" className="p-0.5 text-muted hover:text-strong disabled:opacity-20 transition">
                  <ChevronUp size={14} />
                </button>
                <button onClick={() => mover(i, 1)} disabled={i === anclas.length - 1}
                  aria-label="Bajar" className="p-0.5 text-muted hover:text-strong disabled:opacity-20 transition">
                  <ChevronDown size={14} />
                </button>
              </div>
              <input
                value={a.label}
                onChange={e => actualizar(i, e.target.value)}
                maxLength={ANCLA_LABEL_MAX}
                placeholder="Ej: Después de almorzar"
                className="flex-1 min-w-0 px-3 py-2.5 rounded-xl bg-elevated border border-line text-sm text-strong placeholder:text-muted focus:outline-none focus:border-line-strong"
              />
              <span className="text-[10px] text-muted w-8 text-right flex-shrink-0">{a.label.length}/{ANCLA_LABEL_MAX}</span>
              <button
                onClick={() => quitar(i)}
                aria-label="Quitar ancla"
                className="p-2 rounded-lg text-muted hover:text-danger hover:bg-danger-soft transition flex-shrink-0"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
          {anclas.length === 0 && (
            <p className="text-xs text-muted py-2">Sin anclas. Añade al menos una.</p>
          )}
        </div>

        <button
          onClick={agregar}
          disabled={anclas.length >= ANCLAS_GRUPO_MAX}
          className="mt-2 px-3 py-2 rounded-xl text-xs font-medium border border-line text-soft hover:bg-elevated disabled:opacity-40 transition"
        >
          + Añadir ancla
        </button>
        {anclas.length >= ANCLAS_GRUPO_MAX && (
          <p className="text-[11px] text-warning mt-1.5">Máximo {ANCLAS_GRUPO_MAX} anclas — una lista larga deja de ayudar a elegir.</p>
        )}
        {hayVacias && (
          <p className="text-[11px] text-danger mt-1.5">Ninguna ancla puede quedar vacía.</p>
        )}
        {error && (
          <p className="text-[11px] text-danger mt-1.5">{error}</p>
        )}

        <div className="flex items-center gap-3 mt-4">
          <button
            onClick={guardar}
            disabled={!puedeGuardar}
            className="px-4 py-2 rounded-xl text-sm font-semibold border border-line-strong bg-hover text-strong disabled:opacity-40"
          >
            {guardando ? <Loader2 size={14} className="animate-spin inline" /> : 'Guardar'}
          </button>
        </div>
      </div>
    </motion.div>
  );
}

function diaCortoDe(f: FechaISO): string {
  const [y, m, d] = f.split('-').map(Number);
  return ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'][new Date(y, m - 1, d).getDay()];
}

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

// Semanas del mes (solo lunes a viernes) como matriz de fechas ISO o null.
function gridMes(year: number, month: number): (FechaISO | null)[][] {
  const weeks: (FechaISO | null)[][] = [];
  let week: (FechaISO | null)[] = [null, null, null, null, null];
  const ultimo = new Date(year, month + 1, 0).getDate();
  for (let d = 1; d <= ultimo; d++) {
    const date = new Date(year, month, d);
    const dow = date.getDay();
    if (dow === 0 || dow === 6) continue;
    const col = dow - 1;
    if (col === 0 && week.some(x => x !== null)) {
      weeks.push(week);
      week = [null, null, null, null, null];
    }
    week[col] = formatFecha(date);
  }
  if (week.some(x => x !== null)) weeks.push(week);
  return weeks;
}

// Modal reutilizable con la agenda del grupo (día + semana + QR).
// `esImagen` no se manda al backend (solo adjuntoUrl/adjuntoNombre); es un dato
// local para decidir si mostrar la vista previa y el aviso específico de fotos.
type AdjuntoTareaDato = { url: string; nombre: string; esImagen?: boolean };

/**
 * Subida del archivo de una tarea.
 *
 * La advertencia de visibilidad NO es decorativa y por eso está siempre visible,
 * no escondida tras un icono: la agenda del grupo se abre por QR sin contraseña,
 * así que lo que se suba aquí queda al alcance de cualquiera con el enlace. El
 * riesgo real no es técnico, es que alguien publique ahí algo con datos de
 * estudiantes creyendo que es un espacio cerrado.
 */
function AdjuntoTarea({
  adjunto,
  onCambiar,
}: {
  adjunto: AdjuntoTareaDato | null;
  onCambiar: (a: AdjuntoTareaDato | null) => void;
}) {
  const [subiendo, setSubiendo] = useState(false);
  const [pct, setPct] = useState(0);
  const [error, setError] = useState<string | null>(null);
  // Vista previa local (blob URL) del archivo recién elegido, solo para imágenes.
  // Se guarda aparte de `adjunto.url` (la URL final de Storage) porque durante la
  // subida todavía no existe esa URL, y así el docente ve la foto de inmediato.
  const [previaLocal, setPrevia] = useState<string | null>(null);

  async function elegir(ev: React.ChangeEvent<HTMLInputElement>) {
    const file = ev.target.files?.[0];
    // Se limpia el input para que volver a elegir el MISMO archivo dispare el
    // evento otra vez; si no, corregirlo y reintentar parece no hacer nada.
    ev.target.value = '';
    if (!file) return;
    const esImagen = file.type.startsWith('image/');
    setError(null);
    setSubiendo(true);
    setPct(0);
    if (esImagen) setPrevia(URL.createObjectURL(file));
    try {
      const subido = await subirAdjuntoTarea(file, setPct);
      onCambiar({ ...subido, esImagen });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo subir el archivo.');
      setPrevia(null);
    } finally {
      setSubiendo(false);
    }
  }

  function quitar() {
    if (previaLocal) URL.revokeObjectURL(previaLocal);
    setPrevia(null);
    onCambiar(null);
  }

  const esImagen = adjunto?.esImagen ?? false;
  const previa = previaLocal ?? (esImagen ? adjunto?.url : null);

  return (
    <div className="w-full">
      <label className="text-[11px] text-muted block mb-1">
        Archivo adjunto <span className="opacity-70">(opcional, máx. 10 MB)</span>
      </label>
      {adjunto ? (
        <div className="rounded-xl border border-line bg-elevated p-2 space-y-2">
          {previa && (
            <img
              src={previa}
              alt="Vista previa del adjunto"
              className="w-full max-h-48 object-contain rounded-lg bg-surface"
            />
          )}
          <div className="flex items-center gap-2">
            {!previa && <Paperclip size={14} className="text-muted shrink-0" />}
            <span className="text-xs text-strong truncate flex-1">{adjunto.nombre}</span>
            <button
              onClick={quitar}
              className="text-[11px] text-muted hover:text-danger transition shrink-0"
            >
              Quitar
            </button>
          </div>
        </div>
      ) : (
        // Tres formas de conseguir el archivo. "Tomar foto" usa `capture="environment"`
        // (mismo patrón que CapturaEscaner.tsx): en el celular abre la cámara trasera
        // directo, sin pasar por el explorador. En escritorio, capture se ignora y
        // los tres botones abren el mismo selector de archivos — no hace falta
        // detectar el dispositivo. flex-wrap evita que se rompa la fila en pantallas
        // angostas.
        <div className="flex flex-wrap gap-2">
          <label className="inline-flex items-center gap-1.5 cursor-pointer rounded-xl border border-line bg-elevated px-3 py-2.5 text-xs text-soft hover:text-strong transition min-h-[40px]">
            <Camera size={14} />
            Tomar foto
            <input
              type="file"
              hidden
              accept="image/*"
              capture="environment"
              disabled={subiendo}
              onChange={elegir}
            />
          </label>
          <label className="inline-flex items-center gap-1.5 cursor-pointer rounded-xl border border-line bg-elevated px-3 py-2.5 text-xs text-soft hover:text-strong transition min-h-[40px]">
            <FolderOpen size={14} />
            Galería
            <input type="file" hidden accept="image/*" disabled={subiendo} onChange={elegir} />
          </label>
          <label className="inline-flex items-center gap-1.5 cursor-pointer rounded-xl border border-line bg-elevated px-3 py-2.5 text-xs text-soft hover:text-strong transition min-h-[40px]">
            <Paperclip size={14} />
            Archivo
            <input type="file" hidden disabled={subiendo} onChange={elegir} />
          </label>
        </div>
      )}
      {subiendo && <p className="text-[11px] text-muted mt-1">Subiendo… {pct}%</p>}
      {error && <p className="text-[11px] text-danger mt-1">{error}</p>}
      <p className="text-[11px] text-warning mt-1 leading-snug">
        La agenda del grupo se abre con el código QR, sin contraseña. Lo que adjunte aquí lo podrá
        ver <b>cualquiera que tenga ese enlace</b>: no suba nada con datos personales de estudiantes.
      </p>
      {esImagen && (
        // Aviso adicional y más concreto que el general de arriba: una foto del
        // tablero captura lo que haya delante (caras, cuadernos, listas pegadas en
        // la pared), no solo el contenido que el docente quiso compartir.
        <p className="text-[11px] text-warning mt-1 leading-snug">
          Revise la foto antes de guardar: que no aparezca ningún estudiante ni nada con su
          nombre (cuadernos, listas, carteleras). Cualquiera con el enlace del QR podrá verla.
        </p>
      )}
    </div>
  );
}

function ModalAgenda({ grupo, tareas, anclasPorGrupo, onClose }: {
  grupo: string; tareas: Tarea[]; anclasPorGrupo?: Record<string, Ancla[]>; onClose: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/60 flex items-start justify-center overflow-y-auto p-4"
      onClick={onClose}
    >
      <div
        className="rounded-2xl border border-line bg-card p-4 max-w-md w-full my-8"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex justify-end -mt-1 -mr-1 mb-1">
          <button onClick={onClose} className="p-1.5 rounded-lg text-muted hover:text-strong hover:bg-elevated">
            <X size={16} />
          </button>
        </div>
        <AgendaGrupo grupo={grupo} tareas={tareas} mostrarQR anclasPorGrupo={anclasPorGrupo} />
      </div>
    </motion.div>
  );
}

// ── Celda de carga (semáforo compartido docente/coordinador) ──────────────────

function colorCarga(ocupados: number, tope: number): string {
  if (ocupados <= 0) return 'transparent';
  const nivel = ocupados / tope;
  if (nivel < 0.5) return 'rgba(251,146,60,0.25)';
  if (nivel < 1) return 'rgba(251,146,60,0.55)';
  return 'rgba(239,68,68,0.65)';
}

// ── Panel del docente ─────────────────────────────────────────────────────────

function PanelDocente({ tareas, cesiones, solicitudes, cuposOverride, anclasPorGrupo }: {
  tareas: Tarea[]; cesiones: Cesion[]; solicitudes: SolicitudCesion[]; cuposOverride: Record<string, number>;
  anclasPorGrupo: Record<string, Ancla[]>;
}) {
  const { userId } = useAppStore();
  const qc = useQueryClient();
  const hoy = hoyISO();

  const misGrupos = useMemo(() => gruposAsignables(userId!), [userId]);

  const [grupo, setGrupo] = useState(misGrupos[0]?.grupo ?? '');
  const grupoInfo = misGrupos.find(g => g.grupo === grupo);
  const [asignaturaId, setAsignaturaId] = useState(grupoInfo?.asignaturaIds[0] ?? '');
  const [titulo, setTitulo] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [adjunto, setAdjunto] = useState<AdjuntoTareaDato | null>(null);
  const [momentos, setMomentos] = useState(1);
  const [fechaEntrega, setFechaEntrega] = useState<FechaISO | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [aviso, setAviso] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null);
  const [mostrarCesion, setMostrarCesion] = useState(false);
  const [mostrarSolicitud, setMostrarSolicitud] = useState(false);
  const [agendaAbierta, setAgendaAbierta] = useState(false);
  const [replicando, setReplicando] = useState<Tarea | null>(null);
  const [editandoAnclas, setEditandoAnclas] = useState(false);
  const soyDirector = !!grupo && esDirectorDeGrupo(userId, grupo);

  const asignaturaActiva = grupoInfo?.asignaturaIds.includes(asignaturaId)
    ? asignaturaId
    : grupoInfo?.asignaturaIds[0] ?? '';

  const contexto = useMemo(() => ({
    hoy,
    tareas: tareas.filter(t => t.grupo === grupo),
    cesiones: cesiones.filter(c => c.grupo === grupo),
    diasClase: userId ? diasDeClase(userId, grupo) : [],
    cuposOverride,
  }), [hoy, tareas, cesiones, grupo, userId, cuposOverride]);

  const nivel = grupo ? nivelDeGrupo(grupo) : 'basica';
  const config = CONFIG_NIVEL[nivel];

  // Ventana de asignación: depende de HOY y del horario, no de la fecha de entrega
  const ventanaOk = useMemo(
    () => ventanaValida(hoy, contexto.diasClase),
    [hoy, contexto.diasClase],
  );

  // Por que esta cerrada la ventana, en palabras del docente. Sin esto el
  // calendario simplemente desaparecia y no habia forma de saber la razon.
  const avisoVentana = useMemo(() => {
    if (ventanaOk) return null;
    let proxima: FechaISO | null = null;
    for (let i = 1; i <= 21; i++) {
      const f = addDias(hoy, i);
      const d = diaSemana(f);
      if (d === 'sabado' || d === 'domingo') continue;
      if (contexto.diasClase.includes(d) && esDiaHabil(f)) { proxima = f; break; }
    }
    const cuando = proxima
      ? ` La proxima clase con este grupo es el ${fechaLegible(proxima)}; ese dia podras asignar.`
      : '';
    const hoyD = diaSemana(hoy);
    if (esFestivo(hoy)) {
      return { titulo: 'Hoy es festivo', cuerpo: `No hay clase hoy, y el sabado y el domingo tampoco cuentan, asi que la ventana de asignacion esta cerrada para todos los grupos.${cuando}` };
    }
    if (hoyD === 'sabado' || hoyD === 'domingo') {
      return { titulo: 'Hoy es fin de semana', cuerpo: `La ventana de asignacion solo se abre en dias de clase.${cuando}` };
    }
    return { titulo: `Hoy no puedes asignarle tarea a ${grupo}`, cuerpo: `La tarea debe asignarse el dia de la clase o, a mas tardar, dentro de los dos dias siguientes.${cuando}` };
  }, [ventanaOk, hoy, contexto.diasClase, grupo]);

  const tareaPrevia = useCallback((fecha: FechaISO): Tarea => ({
    id: '_previa', grupo, asignaturaId: asignaturaActiva, docenteId: userId ?? '',
    titulo: titulo || '·', momentos, fechaAsignacion: hoy, fechaEntrega: fecha, estado: 'activa',
  }), [grupo, asignaturaActiva, userId, titulo, momentos, hoy]);

  // Estado de un día para el calendario-semáforo
  type EstadoDia = 'ok' | 'parcial' | 'lleno' | 'off';
  const estadoDe = useCallback((fecha: FechaISO): EstadoDia => {
    if (!grupo || !userId || !ventanaOk || fecha <= hoy || !esDiaHabil(fecha)) return 'off';
    const r = validarTarea(tareaPrevia(fecha), contexto);
    if (r.ok) return 'ok';
    if (!r.ok && r.alternativas?.maxMomentosParaFecha) return 'parcial';
    return 'lleno';
  }, [grupo, userId, ventanaOk, hoy, contexto, tareaPrevia]);

  // Mes visible en el calendario
  const [mesVisible, setMesVisible] = useState(() => {
    const d = parseFecha(hoy);
    return { year: d.getFullYear(), month: d.getMonth() };
  });
  const semanas = useMemo(() => gridMes(mesVisible.year, mesVisible.month), [mesVisible]);
  const puedeRetroceder = mesVisible.year > parseFecha(hoy).getFullYear() ||
    (mesVisible.year === parseFecha(hoy).getFullYear() && mesVisible.month > parseFecha(hoy).getMonth());

  // Momentos disponibles de la asignatura en el período de la entrega (o el actual)
  const etiquetaPeriodo = config.periodoCupo === 'quincena' ? 'quincena' : 'semana';
  const cupoInfo = useMemo(() => {
    if (!grupo || !asignaturaActiva) return null;
    const periodo = clavePeriodo(grupo, fechaEntrega ?? hoy);
    const base = cupoDeAsignatura(grupo, asignaturaActiva);
    const disponible = cupoDisponible(contexto, grupo, asignaturaActiva, periodo);
    const esActual = periodo === clavePeriodo(grupo, hoy);
    return { base, disponible, esActual, periodo };
  }, [grupo, asignaturaActiva, fechaEntrega, hoy, contexto]);

  // Vista previa de cómo se repartirán los momentos entre hoy y la entrega
  const distribucion = useMemo(() => {
    if (!grupo || !fechaEntrega || !userId) return [];
    const plan = planificarAgenda([...contexto.tareas, tareaPrevia(fechaEntrega)], grupo, hoy);
    const res: { fecha: FechaISO; momentos: number }[] = [];
    for (const [f, bloques] of Object.entries(plan.porDia)) {
      const b = bloques.find(x => x.tareaId === '_previa');
      if (b) res.push({ fecha: f, momentos: b.momentos });
    }
    return res.sort((a, b) => a.fecha.localeCompare(b.fecha));
  }, [grupo, fechaEntrega, userId, contexto, tareaPrevia, hoy]);

  const validacion = useMemo(() => {
    if (!grupo || !fechaEntrega || !userId) return null;
    return validarTarea({
      id: '_previa', grupo, asignaturaId: asignaturaActiva, docenteId: userId,
      titulo: titulo || '·', momentos, fechaAsignacion: hoy, fechaEntrega, estado: 'activa',
    }, contexto);
  }, [grupo, fechaEntrega, userId, asignaturaActiva, momentos, titulo, contexto, hoy]);

  const puedeGuardar = !!(titulo.trim() && fechaEntrega && validacion?.ok && !guardando);

  async function guardar() {
    if (!puedeGuardar || !userId || !fechaEntrega) return;
    setGuardando(true);
    setAviso(null);
    const r = await crearTarea({
      grupo, asignaturaId: asignaturaActiva, docenteId: userId,
      titulo: titulo.trim(), momentos, fechaAsignacion: hoy, fechaEntrega,
      descripcion: descripcion.trim() || undefined,
      adjuntoUrl: adjunto?.url,
      adjuntoNombre: adjunto?.nombre,
    });
    setGuardando(false);
    if (r.ok) {
      setAviso({ tipo: 'ok', texto: 'Tarea publicada. La agenda del grupo ya se actualizó.' });
      setTitulo(''); setFechaEntrega(null); setMomentos(1);
      setDescripcion(''); setAdjunto(null);
      qc.invalidateQueries({ queryKey: ['datosTareas'] });
    } else {
      setAviso({ tipo: 'error', texto: r.error ?? 'No se pudo guardar la tarea.' });
    }
  }

  const misTareas = tareas
    .filter(t => t.docenteId === userId && t.estado === 'activa' && t.fechaEntrega >= hoy)
    .sort((a, b) => a.fechaEntrega.localeCompare(b.fechaEntrega));

  async function cancelar(id: string) {
    if (!userId) return;
    const r = await cancelarTarea(id, userId);
    if (r.ok) qc.invalidateQueries({ queryKey: ['datosTareas'] });
  }

  if (misGrupos.length === 0) return (
    <div className="rounded-2xl border border-line bg-elevated/40 p-6 text-sm text-muted">
      No tienes asignación académica registrada, así que no puedes asignar tareas.
    </div>
  );

  return (
    <div className="space-y-5">
      {/* ── Formulario ─────────────────────────────────────── */}
      <section className="rounded-2xl border border-line bg-card p-4 space-y-4">
        <div className="flex items-center gap-2">
          <ClipboardList size={18} className="text-soft" />
          <h2 className="font-bold text-strong">Asignar tarea</h2>
          {grupo && (
            <div className="ml-auto flex gap-2">
              {soyDirector && (
                <button
                  onClick={() => setEditandoAnclas(true)}
                  className="px-3 py-1.5 rounded-full text-xs font-medium border border-line text-soft hover:bg-elevated transition-all flex items-center gap-1.5"
                >
                  <ListChecks size={13} /> Anclas de {grupo}
                </button>
              )}
              <button
                onClick={() => setAgendaAbierta(true)}
                className="px-3 py-1.5 rounded-full text-xs font-medium border border-line text-soft hover:bg-elevated transition-all flex items-center gap-1.5"
              >
                <CalendarDays size={13} /> Agenda de {grupo}
              </button>
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-3">
          <div>
            <label className="text-[11px] text-muted block mb-1">Grupo</label>
            <div className="flex flex-wrap gap-1">
              {misGrupos.map(g => (
                <button
                  key={g.grupo}
                  onClick={() => { setGrupo(g.grupo); setFechaEntrega(null); }}
                  className={cn(
                    'px-3 py-1.5 rounded-full text-xs font-bold border transition-all',
                    grupo === g.grupo ? 'bg-hover border-line-strong' : 'border-line text-muted hover:bg-elevated'
                  )}
                  style={grupo === g.grupo ? { color: colorGrado(g.grupo) } : undefined}
                >
                  {g.grupo}
                </button>
              ))}
            </div>
          </div>
          {(grupoInfo?.asignaturaIds.length ?? 0) > 1 && (
            <div>
              <label className="text-[11px] text-muted block mb-1">Asignatura</label>
              <div className="flex flex-wrap gap-1">
                {grupoInfo!.asignaturaIds.map(id => (
                  <button
                    key={id}
                    onClick={() => setAsignaturaId(id)}
                    className={cn(
                      'px-3 py-1.5 rounded-full text-xs border transition-all',
                      asignaturaActiva === id ? 'bg-hover text-strong border-line-strong' : 'border-line text-muted hover:bg-elevated'
                    )}
                  >
                    {getAsignatura(id)?.nombre ?? id}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[220px]">
            <label className="text-[11px] text-muted block mb-1">Título de la tarea</label>
            <input
              value={titulo}
              onChange={e => setTitulo(e.target.value)}
              placeholder="Ej: Taller de ecuaciones, página 34"
              className="w-full px-3 py-2 rounded-xl bg-elevated border border-line text-sm text-strong placeholder:text-muted focus:outline-none focus:border-line-strong"
            />
          </div>
          <div className="w-full">
            <label className="text-[11px] text-muted block mb-1">
              Indicaciones para el estudiante <span className="opacity-70">(opcional)</span>
            </label>
            <textarea
              value={descripcion}
              onChange={e => setDescripcion(e.target.value.slice(0, 500))}
              rows={2}
              placeholder="Qué deben hacer, con qué material, cómo se entrega…"
              className="w-full px-3 py-2 rounded-xl bg-elevated border border-line text-sm text-strong placeholder:text-muted focus:outline-none focus:border-line-strong resize-y"
            />
            <div className="flex items-center justify-between gap-2 mt-1">
              <span className="text-[10px] text-muted">{descripcion.length}/500</span>
            </div>
          </div>
          <AdjuntoTarea adjunto={adjunto} onCambiar={setAdjunto} />
          <div>
            <label className="text-[11px] text-muted block mb-1">
              Momentos ({momentos * config.duracionMomentoMin} min)
            </label>
            <div className="flex gap-1">
              {[1, 2, 3, 4].map(m => (
                <button
                  key={m}
                  onClick={() => setMomentos(m)}
                  className={cn(
                    'w-9 h-9 rounded-xl text-sm font-bold border transition-all',
                    momentos === m ? 'bg-hover text-strong border-line-strong' : 'border-line text-muted hover:bg-elevated'
                  )}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Ventana de asignación cerrada */}
        {avisoVentana && (
          <div className="rounded-xl border border-warning bg-warning-soft px-3 py-3 text-warning-soft-fg">
            <div className="flex items-start gap-2">
              <span className="text-base leading-none mt-0.5">&#9888;</span>
              <div>
                <p className="text-sm font-semibold">{avisoVentana.titulo}</p>
                <p className="text-xs mt-1 opacity-90">{avisoVentana.cuerpo}</p>
              </div>
            </div>
          </div>
        )}

        {/* Momentos disponibles del cupo */}
        {ventanaOk && cupoInfo && (
          <div className="flex items-center justify-between gap-2 rounded-xl border border-line bg-elevated/40 px-3 py-2 text-xs">
            <span className="text-muted">
              {getAsignatura(asignaturaActiva)?.nombre} en{' '}
              <span className="font-bold" style={{ color: colorGrado(grupo) }}>{grupo}</span>
            </span>
            <span className={cn('font-semibold', cupoInfo.disponible <= 0 ? 'text-danger' : 'text-success')}>
              {cupoInfo.disponible} de {cupoInfo.base} momentos ·{' '}
              {cupoInfo.esActual ? `esta ${etiquetaPeriodo}` : `${etiquetaPeriodo} del ${cupoInfo.periodo.slice(8)}/${cupoInfo.periodo.slice(5, 7)}`}
            </span>
          </div>
        )}

        {/* Calendario-semáforo */}
        {ventanaOk && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-[11px] text-muted">
              Fecha de entrega — <span className="text-success">verde</span>: cabe ·{' '}
              <span className="text-warning">ámbar</span>: caben menos ·{' '}
              <span className="text-danger">rojo</span>: no cabe
            </label>
            <div className="flex items-center gap-1">
              <button
                onClick={() => puedeRetroceder && setMesVisible(m => {
                  const d = new Date(m.year, m.month - 1, 1);
                  return { year: d.getFullYear(), month: d.getMonth() };
                })}
                disabled={!puedeRetroceder}
                className="p-1 rounded-lg text-muted hover:text-strong hover:bg-elevated disabled:opacity-30 transition"
              >
                <ChevronLeft size={16} />
              </button>
              <span className="text-xs font-semibold text-strong min-w-[110px] text-center capitalize">
                {MESES[mesVisible.month]} {mesVisible.year}
              </span>
              <button
                onClick={() => setMesVisible(m => {
                  const d = new Date(m.year, m.month + 1, 1);
                  return { year: d.getFullYear(), month: d.getMonth() };
                })}
                className="p-1 rounded-lg text-muted hover:text-strong hover:bg-elevated transition"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
          <div className="grid grid-cols-5 gap-1">
            {['Lun', 'Mar', 'Mié', 'Jue', 'Vie'].map(d => (
              <div key={d} className="text-center text-[10px] text-muted pb-1">{d}</div>
            ))}
            {semanas.flatMap((semana, wi) => semana.map((fecha, di) => {
              if (!fecha) return <div key={`${wi}-${di}`} />;
              const estado = estadoDe(fecha);
              const activa = fechaEntrega === fecha;
              const bg = estado === 'ok' ? 'rgba(34,197,94,0.18)'
                : estado === 'parcial' ? 'rgba(251,146,60,0.5)'
                : estado === 'lleno' ? 'rgba(239,68,68,0.5)' : 'transparent';
              const txt = estado === 'ok' ? 'text-success'
                : estado === 'parcial' ? 'text-warning' : estado === 'lleno' ? 'text-danger' : 'text-muted opacity-40';
              return (
                <button
                  key={fecha}
                  onClick={() => estado !== 'off' && setFechaEntrega(fecha)}
                  disabled={estado === 'off'}
                  className={cn(
                    'h-9 rounded-lg border text-sm font-bold transition-all',
                    activa ? 'border-line-strong ring-1 ring-[var(--color-line-strong)]' : 'border-transparent',
                    estado === 'off' ? 'cursor-not-allowed' : 'hover:border-line-strong',
                    txt,
                  )}
                  style={{ backgroundColor: bg }}
                >
                  {Number(fecha.slice(8))}
                </button>
              );
            }))}
          </div>
        </div>
        )}

        {/* Vista previa del reparto de momentos */}
        {validacion?.ok && distribucion.length > 0 && (
          <div className="rounded-xl border border-line bg-elevated/40 px-3 py-2 text-[11px] text-muted">
            <span className="text-soft font-semibold">Se repartirá así:</span>{' '}
            {distribucion.map(d => `${diaCortoDe(d.fecha)} ${Number(d.fecha.slice(8))} (${d.momentos})`).join(' · ')}
            {' '}— entrega {fechaLegible(fechaEntrega!)}
          </div>
        )}

        {validacion && !validacion.ok && (
          <div className="rounded-xl border border-danger bg-danger-soft px-3 py-2.5 text-xs text-danger-soft-fg">
            {validacion.mensaje}
            {validacion.alternativas?.primeraEntregaViable && (
              <button
                className="ml-2 underline font-semibold"
                onClick={() => setFechaEntrega(validacion.alternativas!.primeraEntregaViable!)}
              >
                usar {fechaLegible(validacion.alternativas.primeraEntregaViable)}
              </button>
            )}
          </div>
        )}
        {aviso && (
          <div className={cn(
            'rounded-xl px-3 py-2.5 text-xs border flex items-center gap-2',
            aviso.tipo === 'ok' ? 'border-success bg-success-soft text-success-soft-fg' : 'border-danger bg-danger-soft text-danger-soft-fg'
          )}>
            {aviso.tipo === 'ok' && <CheckCircle2 size={14} />}
            {aviso.texto}
            <button className="ml-auto" onClick={() => setAviso(null)}><X size={12} /></button>
          </div>
        )}

        <div className="flex items-center gap-3">
          <button
            onClick={guardar}
            disabled={!puedeGuardar}
            className={cn(
              'px-4 py-2 rounded-xl text-sm font-semibold border transition-all',
              puedeGuardar
                ? 'bg-hover text-strong border-line-strong hover:opacity-90'
                : 'border-line text-muted opacity-50 cursor-not-allowed'
            )}
          >
            {guardando ? <Loader2 size={14} className="animate-spin inline" /> : 'Publicar tarea'}
          </button>
          <button
            onClick={() => { setMostrarCesion(v => !v); setMostrarSolicitud(false); }}
            className="px-3 py-2 rounded-xl text-xs text-muted border border-line hover:bg-elevated transition-all flex items-center gap-1.5"
          >
            <Gift size={13} /> Ceder momentos
          </button>
          <button
            onClick={() => { setMostrarSolicitud(v => !v); setMostrarCesion(false); }}
            className="px-3 py-2 rounded-xl text-xs text-muted border border-line hover:bg-elevated transition-all flex items-center gap-1.5"
          >
            <HandCoins size={13} /> Solicitar momentos
          </button>
        </div>

        <AnimatePresence>
          {mostrarCesion && (
            <motion.div
              initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }} className="overflow-hidden"
            >
              <FormCesion grupo={grupo} asignaturaOrigenId={asignaturaActiva} onCerrar={() => setMostrarCesion(false)} />
            </motion.div>
          )}
          {mostrarSolicitud && (
            <motion.div
              initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }} className="overflow-hidden"
            >
              <FormSolicitud misGrupos={misGrupos} onCerrar={() => setMostrarSolicitud(false)} />
            </motion.div>
          )}
        </AnimatePresence>
      </section>

      {/* ── Solicitudes por responder (soy el cedente) ─────── */}
      <SeccionSolicitudes solicitudes={solicitudes} />

      {/* ── Mis tareas ─────────────────────────────────────── */}
      <section className="space-y-2">
        <h3 className="font-bold text-strong text-sm">Mis tareas vigentes</h3>
        {misTareas.length === 0 && (
          <p className="text-xs text-muted">No tienes tareas activas.</p>
        )}
        {misTareas.map(t => (
          <div key={t.id} className="flex items-center gap-3 rounded-xl border border-line bg-elevated/40 px-3 py-2.5 text-sm">
            <span className="font-bold text-xs" style={{ color: colorGrado(t.grupo) }}>{t.grupo}</span>
            <div className="flex-1 min-w-0">
              <div className="text-strong truncate">{t.titulo}</div>
              <div className="text-[11px] text-muted">
                {getAsignatura(t.asignaturaId)?.nombre} · {t.momentos} momento{t.momentos > 1 ? 's' : ''} · entrega {fechaLegible(t.fechaEntrega)}
              </div>
            </div>
            <button
              onClick={() => setReplicando(t)}
              title="Replicar a otros grupos"
              className="p-1.5 rounded-lg text-muted hover:text-strong hover:bg-elevated transition"
            >
              <CopyPlus size={14} />
            </button>
            <button
              onClick={() => cancelar(t.id)}
              title="Cancelar tarea"
              className="p-1.5 rounded-lg text-muted hover:text-danger hover:bg-danger-soft transition"
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </section>

      <AnimatePresence>
        {replicando && (
          <ModalReplicarTarea
            original={replicando}
            tareas={tareas}
            cesiones={cesiones}
            cuposOverride={cuposOverride}
            hoy={hoy}
            onClose={() => setReplicando(null)}
            onCreadas={() => qc.invalidateQueries({ queryKey: ['datosTareas'] })}
          />
        )}
        {agendaAbierta && grupo && (
          <ModalAgenda grupo={grupo} tareas={tareas} anclasPorGrupo={anclasPorGrupo} onClose={() => setAgendaAbierta(false)} />
        )}
        {editandoAnclas && grupo && (
          <EditorAnclas grupo={grupo} anclasActuales={anclasPorGrupo[grupo]} onCerrar={() => setEditandoAnclas(false)} />
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Formulario de cesión ──────────────────────────────────────────────────────

function FormCesion({ grupo, asignaturaOrigenId, onCerrar }: {
  grupo: string; asignaturaOrigenId: string; onCerrar: () => void;
}) {
  const { userId } = useAppStore();
  const qc = useQueryClient();
  const hoy = hoyISO();
  const config = CONFIG_NIVEL[nivelDeGrupo(grupo)];
  const etiqueta = config.periodoCupo === 'quincena' ? 'quincena' : 'semana';

  const destinos = useMemo(() =>
    [...new Set(asignacionDeGrupo(grupo).map(e => e.asignaturaId))]
      .filter(id => id !== asignaturaOrigenId && id !== 'ci'),
    [grupo, asignaturaOrigenId]);

  const [destino, setDestino] = useState('');
  const [momentos, setMomentos] = useState(1);
  const [periodo, setPeriodo] = useState<'actual' | 'siguiente'>('actual');
  const [enviando, setEnviando] = useState(false);
  const [hecho, setHecho] = useState(false);

  async function enviar() {
    if (!destino || !userId) return;
    setEnviando(true);
    const dias = config.periodoCupo === 'quincena' ? 14 : 7;
    const fechaRef = periodo === 'actual' ? hoy : addDias(hoy, dias);
    const r = await crearCesion({
      grupo,
      periodo: clavePeriodo(grupo, fechaRef),
      asignaturaOrigenId,
      asignaturaDestinoId: destino,
      docenteOrigenId: userId,
      momentos,
    });
    setEnviando(false);
    if (r.ok) {
      setHecho(true);
      qc.invalidateQueries({ queryKey: ['datosTareas'] });
      setTimeout(onCerrar, 1500);
    }
  }

  return (
    <div className="mt-3 rounded-xl border border-line bg-elevated/40 p-3 space-y-3">
      <p className="text-[11px] text-muted">
        Cede momentos de <span className="font-semibold text-soft">{getAsignatura(asignaturaOrigenId)?.nombre}</span> en {grupo} a
        otra asignatura. La cesión vence al terminar la {etiqueta}.
      </p>
      <div className="flex flex-wrap gap-2 items-end">
        <div>
          <label className="text-[11px] text-muted block mb-1">Asignatura que recibe</label>
          <select
            value={destino}
            onChange={e => setDestino(e.target.value)}
            className="px-3 py-2 rounded-xl bg-card border border-line text-sm text-strong"
          >
            <option value="">Elegir…</option>
            {destinos.map(id => (
              <option key={id} value={id}>{getAsignatura(id)?.nombre ?? id}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-[11px] text-muted block mb-1">Momentos</label>
          <div className="flex gap-1">
            {[1, 2].map(m => (
              <button key={m} onClick={() => setMomentos(m)}
                className={cn('w-8 h-8 rounded-lg text-sm font-bold border',
                  momentos === m ? 'bg-hover text-strong border-line-strong' : 'border-line text-muted')}>
                {m}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="text-[11px] text-muted block mb-1">Período</label>
          <div className="flex gap-1">
            {(['actual', 'siguiente'] as const).map(p => (
              <button key={p} onClick={() => setPeriodo(p)}
                className={cn('px-3 py-1.5 rounded-lg text-xs border',
                  periodo === p ? 'bg-hover text-strong border-line-strong' : 'border-line text-muted')}>
                {p === 'actual' ? `Esta ${etiqueta}` : `Próxima ${etiqueta}`}
              </button>
            ))}
          </div>
        </div>
        <button
          onClick={enviar}
          disabled={!destino || enviando || hecho}
          className="px-3 py-2 rounded-xl text-xs font-semibold border border-line-strong bg-hover text-strong disabled:opacity-40"
        >
          {hecho ? 'Cesión registrada ✓' : enviando ? '…' : 'Ceder'}
        </button>
      </div>
    </div>
  );
}

// ── Formulario de solicitud de cesión ─────────────────────────────────────────

function FormSolicitud({ misGrupos, onCerrar }: {
  misGrupos: { grupo: string; asignaturaIds: string[] }[]; onCerrar: () => void;
}) {
  const { userId } = useAppStore();
  const qc = useQueryClient();
  const hoy = hoyISO();

  const [grupo, setGrupo] = useState(misGrupos[0]?.grupo ?? '');
  const grupoInfo = misGrupos.find(g => g.grupo === grupo);
  const misAsigs = grupoInfo?.asignaturaIds ?? [];
  const [miAsignatura, setMiAsignatura] = useState(misAsigs[0] ?? '');
  const miAsignaturaActiva = misAsigs.includes(miAsignatura) ? miAsignatura : misAsigs[0] ?? '';

  const config = CONFIG_NIVEL[nivelDeGrupo(grupo)];
  const etiqueta = config.periodoCupo === 'quincena' ? 'quincena' : 'semana';

  // Asignaturas del grupo que puedo pedir (las que NO dicto yo), con su docente
  const donantes = useMemo(() => {
    return asignacionDeGrupo(grupo)
      .filter(e => e.asignaturaId !== 'ci' && e.docenteId !== userId)
      .reduce<{ asignaturaId: string; docenteId: string }[]>((acc, e) => {
        if (!acc.some(a => a.asignaturaId === e.asignaturaId)) {
          acc.push({ asignaturaId: e.asignaturaId, docenteId: e.docenteId });
        }
        return acc;
      }, []);
  }, [grupo, userId]);

  const [donante, setDonante] = useState('');
  const [momentos, setMomentos] = useState(1);
  const [periodo, setPeriodo] = useState<'actual' | 'siguiente'>('actual');
  const [enviando, setEnviando] = useState(false);
  const [hecho, setHecho] = useState(false);

  const donanteSel = donantes.find(d => d.asignaturaId === donante);
  const docenteDonante = USUARIOS.find(u => u.id === donanteSel?.docenteId);

  async function enviar() {
    if (!donante || !donanteSel || !userId || !miAsignaturaActiva) return;
    setEnviando(true);
    const dias = config.periodoCupo === 'quincena' ? 14 : 7;
    const fechaRef = periodo === 'actual' ? hoy : addDias(hoy, dias);
    const nombreSolicitante = USUARIOS.find(u => u.id === userId)?.nombreCorto ?? 'Un docente';
    const mensaje = `${nombreSolicitante} te pide ${momentos} momento(s) de ${getAsignatura(donanteSel.asignaturaId)?.nombre} en ${grupo} para ${getAsignatura(miAsignaturaActiva)?.nombre}.`;
    const r = await crearSolicitudCesion({
      grupo,
      periodo: clavePeriodo(grupo, fechaRef),
      asignaturaCedenteId: donanteSel.asignaturaId,
      asignaturaDestinoId: miAsignaturaActiva,
      docenteCedenteId: donanteSel.docenteId,
      docenteSolicitanteId: userId,
      momentos,
    }, mensaje);
    setEnviando(false);
    if (r.ok) {
      setHecho(true);
      qc.invalidateQueries({ queryKey: ['datosTareas'] });
      setTimeout(onCerrar, 1600);
    }
  }

  return (
    <div className="mt-3 rounded-xl border border-line bg-elevated/40 p-3 space-y-3">
      <p className="text-[11px] text-muted">
        Pide a un compañero que te ceda momentos para tu asignatura en este grupo.
        Le llegará un aviso y, si acepta, el cupo se te suma. Vence al terminar la {etiqueta}.
      </p>
      <div className="flex flex-wrap gap-2 items-end">
        <div>
          <label className="text-[11px] text-muted block mb-1">Grupo</label>
          <select value={grupo} onChange={e => { setGrupo(e.target.value); setDonante(''); }}
            className="px-3 py-2 rounded-xl bg-card border border-line text-sm text-strong">
            {misGrupos.map(g => <option key={g.grupo} value={g.grupo}>{g.grupo}</option>)}
          </select>
        </div>
        {misAsigs.length > 1 && (
          <div>
            <label className="text-[11px] text-muted block mb-1">Para mi asignatura</label>
            <select value={miAsignaturaActiva} onChange={e => setMiAsignatura(e.target.value)}
              className="px-3 py-2 rounded-xl bg-card border border-line text-sm text-strong">
              {misAsigs.map(id => <option key={id} value={id}>{getAsignatura(id)?.nombre ?? id}</option>)}
            </select>
          </div>
        )}
        <div>
          <label className="text-[11px] text-muted block mb-1">Le pido a</label>
          <select value={donante} onChange={e => setDonante(e.target.value)}
            className="px-3 py-2 rounded-xl bg-card border border-line text-sm text-strong">
            <option value="">Elegir asignatura…</option>
            {donantes.map(d => {
              const doc = USUARIOS.find(u => u.id === d.docenteId);
              return (
                <option key={d.asignaturaId} value={d.asignaturaId}>
                  {getAsignatura(d.asignaturaId)?.nombre} · {doc?.nombreCorto ?? d.docenteId}
                </option>
              );
            })}
          </select>
        </div>
        <div>
          <label className="text-[11px] text-muted block mb-1">Momentos</label>
          <div className="flex gap-1">
            {[1, 2].map(m => (
              <button key={m} onClick={() => setMomentos(m)}
                className={cn('w-8 h-8 rounded-lg text-sm font-bold border',
                  momentos === m ? 'bg-hover text-strong border-line-strong' : 'border-line text-muted')}>
                {m}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="text-[11px] text-muted block mb-1">Período</label>
          <div className="flex gap-1">
            {(['actual', 'siguiente'] as const).map(p => (
              <button key={p} onClick={() => setPeriodo(p)}
                className={cn('px-3 py-1.5 rounded-lg text-xs border',
                  periodo === p ? 'bg-hover text-strong border-line-strong' : 'border-line text-muted')}>
                {p === 'actual' ? `Esta ${etiqueta}` : `Próxima ${etiqueta}`}
              </button>
            ))}
          </div>
        </div>
        <button onClick={enviar} disabled={!donante || enviando || hecho}
          className="px-3 py-2 rounded-xl text-xs font-semibold border border-line-strong bg-hover text-strong disabled:opacity-40">
          {hecho ? 'Solicitud enviada ✓' : enviando ? '…' : 'Enviar solicitud'}
        </button>
      </div>
      {donante && docenteDonante && !hecho && (
        <p className="text-[11px] text-muted">
          Se enviará a <span className="font-semibold" style={{ color: docenteDonante.color }}>{docenteDonante.nombreCorto}</span>.
        </p>
      )}
    </div>
  );
}

// ── Solicitudes que debo responder (soy el cedente) + mis solicitudes ─────────

function SeccionSolicitudes({ solicitudes }: { solicitudes: SolicitudCesion[] }) {
  const { userId } = useAppStore();
  const qc = useQueryClient();
  const [procesando, setProcesando] = useState<string | null>(null);

  const porResponder = solicitudes.filter(s => s.docenteCedenteId === userId && s.estado === 'pendiente');
  const misEnviadas = solicitudes.filter(s => s.docenteSolicitanteId === userId && s.estado === 'pendiente');

  async function responder(s: SolicitudCesion, respuesta: 'aceptar' | 'rechazar') {
    if (!userId) return;
    setProcesando(s.id);
    const asigDestino = getAsignatura(s.asignaturaDestinoId)?.nombre;
    const mensaje = respuesta === 'aceptar'
      ? `Se aceptó tu solicitud: ${s.momentos} momento(s) para ${asigDestino} en ${s.grupo}.`
      : `Se rechazó tu solicitud de momentos para ${asigDestino} en ${s.grupo}.`;
    const r = await responderSolicitudCesion(s.id, respuesta, mensaje);
    setProcesando(null);
    if (r.ok) qc.invalidateQueries({ queryKey: ['datosTareas'] });
  }

  if (porResponder.length === 0 && misEnviadas.length === 0) return null;

  return (
    <div className="space-y-3">
      {porResponder.length > 0 && (
        <section className="space-y-2">
          <h3 className="font-bold text-strong text-sm flex items-center gap-1.5">
            <HandCoins size={15} /> Solicitudes por responder
          </h3>
          {porResponder.map(s => {
            const solicitante = USUARIOS.find(u => u.id === s.docenteSolicitanteId);
            return (
              <div key={s.id} className="rounded-xl border border-warning bg-warning-soft/60 px-3 py-2.5 text-sm">
                <div className="text-warning-soft-fg">
                  <span className="font-semibold" style={{ color: solicitante?.color }}>{solicitante?.nombreCorto}</span>
                  {' '}te pide <span className="font-semibold">{s.momentos} momento{s.momentos > 1 ? 's' : ''}</span> de{' '}
                  {getAsignatura(s.asignaturaCedenteId)?.nombre} en{' '}
                  <span className="font-bold" style={{ color: colorGrado(s.grupo) }}>{s.grupo}</span>
                  {' '}para {getAsignatura(s.asignaturaDestinoId)?.nombre}.
                </div>
                <div className="flex gap-2 mt-2">
                  <button
                    onClick={() => responder(s, 'aceptar')}
                    disabled={procesando === s.id}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-success text-success hover:bg-success-soft transition flex items-center gap-1 disabled:opacity-40"
                  >
                    <Check size={12} /> Conceder
                  </button>
                  <button
                    onClick={() => responder(s, 'rechazar')}
                    disabled={procesando === s.id}
                    className="px-3 py-1.5 rounded-lg text-xs border border-line text-muted hover:bg-elevated transition flex items-center gap-1 disabled:opacity-40"
                  >
                    <X size={12} /> Rechazar
                  </button>
                </div>
              </div>
            );
          })}
        </section>
      )}
      {misEnviadas.length > 0 && (
        <section className="space-y-1.5">
          <h3 className="font-bold text-strong text-sm">Mis solicitudes enviadas</h3>
          {misEnviadas.map(s => {
            const cedente = USUARIOS.find(u => u.id === s.docenteCedenteId);
            return (
              <div key={s.id} className="text-[11px] text-muted rounded-xl border border-line bg-elevated/40 px-3 py-2">
                Pediste {s.momentos} momento{s.momentos > 1 ? 's' : ''} de {getAsignatura(s.asignaturaCedenteId)?.nombre} a{' '}
                <span className="font-semibold" style={{ color: cedente?.color }}>{cedente?.nombreCorto}</span>
                {' '}· <span className="text-warning">pendiente</span>
              </div>
            );
          })}
        </section>
      )}
    </div>
  );
}

// ── Panel del coordinador / rectora ───────────────────────────────────────────

function PanelDirectivo({ tareas, cesiones, cuposOverride, anclasPorGrupo }: {
  tareas: Tarea[]; cesiones: Cesion[]; cuposOverride: Record<string, number>;
  anclasPorGrupo: Record<string, Ancla[]>;
}) {
  const { userId, jornada } = useAppStore();
  const qc = useQueryClient();
  const hoy = hoyISO();
  const [filtroJornada, setFiltroJornada] = useState<'manana' | 'tarde'>(
    jornada === 'tarde' ? 'tarde' : 'manana'
  );
  const [agendaGrupo, setAgendaGrupo] = useState<string | null>(null);
  const [cuposAbierto, setCuposAbierto] = useState(false);
  const [anclasGrupo, setAnclasGrupo] = useState<string | null>(null);

  const grupos = useMemo(() =>
    todosLosGrupos().filter(g => esGrupoDeTarde(g) === (filtroJornada === 'tarde')),
    [filtroJornada]);

  // Próximos 10 días hábiles
  const dias = useMemo(() => {
    const res: FechaISO[] = [];
    let f = hoy;
    while (res.length < 10) {
      if (esDiaHabil(f)) res.push(f);
      f = addDias(f, 1);
    }
    return res;
  }, [hoy]);

  const cargaPorGrupo = useMemo(() => {
    const res: Record<string, Record<FechaISO, number>> = {};
    for (const g of grupos) {
      const plan = planificarAgenda(tareas.filter(t => t.grupo === g), g, addDias(hoy, -1));
      res[g] = ocupacionPorDia(plan);
    }
    return res;
  }, [grupos, tareas, hoy]);

  const entregasPorGrupoDia = useMemo(() => {
    const res: Record<string, Set<string>> = {};
    for (const t of tareas) {
      if (t.estado !== 'activa') continue;
      (res[t.grupo] ??= new Set()).add(t.fechaEntrega);
    }
    return res;
  }, [tareas]);


  const activas = tareas
    .filter(t => t.estado === 'activa' && t.fechaEntrega >= hoy && grupos.includes(t.grupo))
    .sort((a, b) => a.fechaEntrega.localeCompare(b.fechaEntrega));

  const cesionesVigentes = cesiones.filter(c =>
    grupos.includes(c.grupo) && c.periodo >= clavePeriodo(grupos[0] ?? '9.1', addDias(hoy, -14)));

  async function cancelarComoDirectivo(id: string) {
    if (!userId) return;
    const r = await cancelarTarea(id, userId, true);
    if (r.ok) qc.invalidateQueries({ queryKey: ['datosTareas'] });
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3 flex-wrap">
        <CalendarDays size={18} className="text-soft" />
        <h2 className="font-bold text-strong">Carga de tareas por grupo</h2>
        <div className="flex gap-2 ml-auto items-center">
          <button
            onClick={() => setCuposAbierto(true)}
            className="px-3 py-1.5 rounded-full text-xs font-medium border border-line text-soft hover:bg-elevated transition-all flex items-center gap-1.5"
          >
            <Settings2 size={13} /> Asignación de momentos
          </button>
          <div className="flex gap-1">
            {(['manana', 'tarde'] as const).map(j => (
              <button key={j} onClick={() => setFiltroJornada(j)}
                className={cn('px-3 py-1.5 rounded-full text-xs font-medium border transition-all',
                  filtroJornada === j ? 'bg-hover text-strong border-line-strong' : 'text-muted border-line hover:bg-elevated')}>
                {j === 'manana' ? 'Mañana' : 'Tarde'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Mapa de calor grupo × día ───────────────────────── */}
      <div className="overflow-x-auto rounded-2xl border border-line bg-elevated/40">
        <table className="text-xs border-collapse w-full">
          <thead>
            <tr className="border-b border-line">
              <th className="text-left px-3 py-2 text-muted font-medium w-20">Grupo</th>
              {dias.map(f => (
                <th key={f} className="text-center px-1 py-2 min-w-[52px]">
                  <div className="text-soft text-[10px]">{diaCortoDe(f)}</div>
                  <div className="text-muted text-[9px]">{f.slice(8)}/{f.slice(5, 7)}</div>
                </th>
              ))}
              <th className="w-10" />
            </tr>
          </thead>
          <tbody>
            {grupos.map((g, ri) => {
              const tope = CONFIG_NIVEL[nivelDeGrupo(g)].topeDiario;
              return (
                <tr key={g} className={cn('border-b border-line', ri % 2 !== 0 ? 'bg-elevated/40' : '')}>
                  <td className="px-3 py-1.5">
                    <button onClick={() => setAgendaGrupo(g)} title={`Ver agenda de ${g}`}
                      className="font-bold hover:underline" style={{ color: colorGrado(g) }}>
                      {g}
                    </button>
                  </td>
                  {dias.map(f => {
                    const ejecutable = esDiaEjecutable(g, f);
                    const n = cargaPorGrupo[g]?.[f] ?? 0;
                    const entrega = entregasPorGrupoDia[g]?.has(f);
                    return (
                      <td key={f} className="p-1 text-center">
                        <div
                          className={cn(
                            'rounded-lg h-8 flex flex-col items-center justify-center text-[10px] font-semibold',
                            !ejecutable ? 'border border-dashed border-line text-muted opacity-50' : 'border border-line'
                          )}
                          style={ejecutable ? { backgroundColor: colorCarga(n, tope) } : undefined}
                          title={!ejecutable ? 'Sin tareas (festivo o contrajornada)' : `${n}/${tope} momentos`}
                        >
                          <span className={n >= tope ? 'text-strong' : 'text-soft'}>
                            {ejecutable ? `${n}/${tope}` : '—'}
                          </span>
                          {entrega && <span className="w-1 h-1 rounded-full bg-emerald-400 mt-0.5" />}
                        </div>
                      </td>
                    );
                  })}
                  <td className="text-center whitespace-nowrap">
                    <button
                      onClick={() => setAnclasGrupo(g)}
                      title={`Editar anclas de ${g}`}
                      className="p-1.5 rounded-lg text-muted hover:text-strong hover:bg-elevated transition"
                    >
                      <ListChecks size={14} />
                    </button>
                    <button
                      onClick={() => setAgendaGrupo(g)}
                      title={`Agenda y QR de ${g}`}
                      className="p-1.5 rounded-lg text-muted hover:text-strong hover:bg-elevated transition"
                    >
                      <QrCode size={14} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-muted">
        Cada celda: momentos agendados / tope diario. El punto verde marca días con entrega.
        Los días punteados no reciben tareas (festivo o contrajornada de media técnica).
      </p>

      {/* ── Tareas activas ─────────────────────────────────── */}
      <section className="space-y-2">
        <h3 className="font-bold text-strong text-sm">Tareas vigentes ({activas.length})</h3>
        {activas.length === 0 && <p className="text-xs text-muted">No hay tareas activas en esta jornada.</p>}
        {activas.map(t => {
          const docente = USUARIOS.find(u => u.id === t.docenteId);
          return (
            <div key={t.id} className="flex items-center gap-3 rounded-xl border border-line bg-elevated/40 px-3 py-2 text-sm">
              <span className="font-bold text-xs w-9" style={{ color: colorGrado(t.grupo) }}>{t.grupo}</span>
              <div className="flex-1 min-w-0">
                <div className="text-strong truncate text-xs">{t.titulo}</div>
                <div className="text-[11px] text-muted">
                  {getAsignatura(t.asignaturaId)?.nombre} · <span style={{ color: docente?.color }}>{docente?.nombreCorto}</span> · {t.momentos}m · entrega {fechaLegible(t.fechaEntrega)}
                </div>
              </div>
              <button
                onClick={() => cancelarComoDirectivo(t.id)}
                title="Cancelar tarea"
                className="p-1.5 rounded-lg text-muted hover:text-danger hover:bg-danger-soft transition"
              >
                <Trash2 size={13} />
              </button>
            </div>
          );
        })}
      </section>

      {/* ── Cesiones ───────────────────────────────────────── */}
      {cesionesVigentes.length > 0 && (
        <section className="space-y-2">
          <h3 className="font-bold text-strong text-sm">Cesiones registradas</h3>
          {cesionesVigentes.map(c => (
            <div key={c.id} className="text-xs text-muted rounded-xl border border-line bg-elevated/40 px-3 py-2">
              <span className="font-bold" style={{ color: colorGrado(c.grupo) }}>{c.grupo}</span>
              {' · '}{getAsignatura(c.asignaturaOrigenId)?.nombre} cede {c.momentos} momento{c.momentos > 1 ? 's' : ''} a {getAsignatura(c.asignaturaDestinoId)?.nombre}
              {' · '}período del {c.periodo}
            </div>
          ))}
        </section>
      )}

      {/* ── Modal agenda del grupo ─────────────────────────── */}
      <AnimatePresence>
        {agendaGrupo && (
          <ModalAgenda grupo={agendaGrupo} tareas={tareas} anclasPorGrupo={anclasPorGrupo} onClose={() => setAgendaGrupo(null)} />
        )}
        {cuposAbierto && (
          <ModalCupos cuposOverride={cuposOverride} onClose={() => setCuposAbierto(false)} />
        )}
        {anclasGrupo && (
          <EditorAnclas grupo={anclasGrupo} anclasActuales={anclasPorGrupo[anclasGrupo]} onCerrar={() => setAnclasGrupo(null)} />
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Editor de asignación de momentos (cupos por nivel) ────────────────────────

// Color categórico por nivel — pares -soft/-soft-fg con contraste garantizado
// en modo claro y oscuro.
const COLOR_NIVEL: Record<string, { bg: string; fg: string }> = {
  basica:   { bg: 'var(--color-accent-soft)',  fg: 'var(--color-accent-soft-fg)' },
  media:    { bg: 'var(--color-purple-soft)',  fg: 'var(--color-purple-soft-fg)' },
  mt:       { bg: 'var(--color-warning-soft)', fg: 'var(--color-warning-soft-fg)' },
  primaria: { bg: 'var(--color-success-soft)', fg: 'var(--color-success-soft-fg)' },
};

function ModalCupos({ cuposOverride, onClose }: {
  cuposOverride: Record<string, number>; onClose: () => void;
}) {
  const qc = useQueryClient();
  const [valores, setValores] = useState<Record<string, number>>(() => {
    const init: Record<string, number> = {};
    for (const { nivel } of NIVELES_CUPO) {
      for (const [asigId, def] of Object.entries(CUPOS_DEFAULT[nivel])) {
        const clave = `${nivel}:${asigId}`;
        init[clave] = clave in cuposOverride ? cuposOverride[clave] : def;
      }
    }
    return init;
  });
  const [guardando, setGuardando] = useState(false);
  const [hecho, setHecho] = useState(false);

  function set(clave: string, v: number) {
    setValores(p => ({ ...p, [clave]: Math.max(0, Math.min(6, v)) }));
  }

  function totalNivel(nivel: string): number {
    return Object.keys(CUPOS_DEFAULT[nivel as keyof typeof CUPOS_DEFAULT])
      .reduce((s, id) => s + (valores[`${nivel}:${id}`] ?? 0), 0);
  }

  const hayExceso = NIVELES_CUPO.some(({ nivel }) => totalNivel(nivel) > MAX_MOMENTOS_NIVEL[nivel]);

  async function guardar() {
    setGuardando(true);
    const lista = Object.entries(valores).map(([clave, momentos]) => {
      const [nivel, asignaturaId] = clave.split(':');
      return { nivel, asignaturaId, momentos };
    });
    const r = await guardarCupos(lista);
    setGuardando(false);
    if (r.ok) {
      setHecho(true);
      qc.invalidateQueries({ queryKey: ['datosTareas'] });
      setTimeout(onClose, 1200);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/60 flex items-start justify-center overflow-y-auto p-4"
      onClick={onClose}
    >
      <div className="rounded-2xl border border-line bg-card p-4 max-w-lg w-full my-8" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-2 mb-1">
          <Settings2 size={18} className="text-soft" />
          <h3 className="font-bold text-strong">Asignación de momentos</h3>
          <button onClick={onClose} className="ml-auto p-1.5 rounded-lg text-muted hover:text-strong hover:bg-elevated">
            <X size={16} />
          </button>
        </div>
        <p className="text-[11px] text-muted mb-3">
          Momentos por semana que cada asignatura puede dejar (por semana de ejecución;
          en media técnica es por quincena). El tope diario del estudiante no cambia.
        </p>

        <div className="space-y-4">
          {NIVELES_CUPO.map(({ nivel, label }) => {
            const config = CONFIG_NIVEL[nivel];
            const asigs = Object.keys(CUPOS_DEFAULT[nivel]);
            const periodo = config.periodoCupo === 'quincena' ? 'quincena' : 'semana';
            const color = COLOR_NIVEL[nivel] ?? COLOR_NIVEL.basica;
            const max = MAX_MOMENTOS_NIVEL[nivel];
            const total = totalNivel(nivel);
            const excede = total > max;
            return (
              <div key={nivel} className="rounded-xl border border-line overflow-hidden">
                <div className="flex items-baseline justify-between px-3 py-2"
                  style={{ background: color.bg, color: color.fg }}>
                  <span className="font-semibold text-sm">{label}</span>
                  <span className="text-[10px] opacity-80">
                    tope {config.topeDiario}/día · estudio {config.estudioMin} min · por {periodo}
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 p-3 bg-elevated/40">
                  {asigs.map(asigId => {
                    const clave = `${nivel}:${asigId}`;
                    return (
                      <div key={clave} className="flex items-center justify-between gap-2 rounded-lg bg-card border border-line px-2.5 py-1.5">
                        <span className="text-xs text-soft truncate">{getAsignatura(asigId)?.nombre ?? asigId}</span>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <button onClick={() => set(clave, valores[clave] - 1)}
                            className="w-6 h-6 rounded-md border border-line text-muted hover:bg-elevated text-sm leading-none">−</button>
                          <span className="w-5 text-center text-sm font-bold text-strong">{valores[clave]}</span>
                          <button onClick={() => set(clave, valores[clave] + 1)}
                            className="w-6 h-6 rounded-md border border-line text-muted hover:bg-elevated text-sm leading-none">+</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className={cn('flex items-center justify-between px-3 py-2 border-t border-line',
                  excede ? 'bg-danger-soft' : 'bg-card')}>
                  <span className={cn('text-xs font-semibold', excede ? 'text-danger' : 'text-soft')}>
                    Momentos asignados: {total} de {max}
                  </span>
                  <span className={cn('text-[10px]', excede ? 'text-danger' : 'text-muted')}>
                    {excede ? `Supera el máximo permitido (${max})` : `máximo ${max} por ${periodo}`}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {hayExceso && (
          <p className="text-xs text-danger mt-3">
            Hay niveles que superan su máximo de momentos. Ajusta los cupos para poder guardar.
          </p>
        )}

        <div className="flex items-center gap-3 mt-4">
          <button onClick={guardar} disabled={guardando || hecho || hayExceso}
            className="px-4 py-2 rounded-xl text-sm font-semibold border border-line-strong bg-hover text-strong disabled:opacity-40">
            {hecho ? 'Guardado ✓' : guardando ? 'Guardando…' : 'Guardar cambios'}
          </button>
          <span className="text-[11px] text-muted">Aplica de inmediato a la validación de nuevas tareas.</span>
        </div>
      </div>
    </motion.div>
  );
}

// ── Vista principal ───────────────────────────────────────────────────────────

export default function VistaTareas() {
  const { rol } = useAppStore();
  const esDirectivo = rol === 'coordinador' || rol === 'rectora';

  const { data, isLoading, isError } = useQuery({
    queryKey: ['datosTareas'],
    queryFn: () => getDatosTareas(),
    refetchInterval: 1000 * 60,
  });

  if (isLoading) return (
    <div className="flex items-center gap-2 text-muted text-sm p-6">
      <Loader2 size={16} className="animate-spin" /> Cargando tareas…
    </div>
  );
  if (isError || !data?.ok) return (
    <div className="rounded-2xl border border-danger bg-danger-soft p-4 text-sm text-danger-soft-fg">
      No se pudieron cargar las tareas. Verifica la conexión (o que el Apps Script tenga la versión con el módulo de tareas).
    </div>
  );

  const cuposOverride: Record<string, number> = {};
  for (const c of data.cupos) cuposOverride[`${c.nivel}:${c.asignaturaId}`] = c.momentos;

  return esDirectivo
    ? <PanelDirectivo tareas={data.tareas} cesiones={data.cesiones} cuposOverride={cuposOverride} anclasPorGrupo={data.anclas} />
    : <PanelDocente tareas={data.tareas} cesiones={data.cesiones} solicitudes={data.solicitudes} cuposOverride={cuposOverride} anclasPorGrupo={data.anclas} />;
}
