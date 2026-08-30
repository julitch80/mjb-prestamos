// Chat interno tipo Telegram (Etapa 4 — Fase 3 del manual).
// Solo funciona en modo google con Firebase configurado. En modo pin el item de
// navegación 'chat' ni siquiera aparece (filtrado en App.tsx).
import { useEffect, useMemo, useRef, useState } from 'react';
import { Paperclip, Mic, Trash2, Send, FileText, X, Pin, SmilePlus } from 'lucide-react';
import { useAppStore } from '../data/store';
import { useChatStore } from '../data/chatStore';
import { esperarAuth, firebaseConfigurado } from '../lib/firebase';
import { esDirectivo } from '../data/maestros';
import {
  abrirDm,
  borrarMensaje,
  crearCanal,
  editarMensaje,
  EMOJIS_REACCION,
  listarUsuariosParaDm,
  miEmail,
  type Canal,
  type EmojiReaccion,
  type Mensaje,
} from '../data/chat';
import { subirAdjunto, pesoLegible, TAMANO_MAXIMO_BYTES, type AdjuntoSubido } from '../data/adjuntos';
import { crearGrabadora, grabadoraSoportada, type Grabadora } from '../data/audioVoz';

function tsToDate(ts: any): Date | null {
  if (!ts) return null;
  if (typeof ts.toDate === 'function') return ts.toDate();
  if (typeof ts.seconds === 'number') return new Date(ts.seconds * 1000);
  return null;
}

function horaCorta(ts: any): string {
  const d = tsToDate(ts);
  if (!d) return '';
  return d.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
}

function fechaCorta(ts: any): string {
  const d = tsToDate(ts);
  if (!d) return '';
  return d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short' });
}

export default function Chat() {
  const rol = useAppStore((s) => s.rol) ?? '';
  const esSuper = rol === 'superusuario';
  const puedeCrearGrupo = esDirectivo(rol) || esSuper;

  const {
    canales,
    mensajesPorCanal,
    canalActivo,
    abrirCanal,
    enviar,
    noLeidos,
    crearGrupoStore,
    errorCanales,
    emailSesion,
    puedoPublicarEn,
  } = useChatStore();

  const [directorio, setDirectorio] = useState<Array<{ email: string; displayName: string }>>([]);
  const [pestana, setPestana] = useState<'chats' | 'docentes'>('chats');
  const [buscar, setBuscar] = useState('');
  const [modalDm, setModalDm] = useState(false);
  const [modalCanal, setModalCanal] = useState(false);
  const [modalGrupo, setModalGrupo] = useState(false);
  const [texto, setTexto] = useState('');
  const [archivoPendiente, setArchivoPendiente] = useState<File | null>(null);
  const [subiendoPct, setSubiendoPct] = useState<number | null>(null);
  const [errorAdjunto, setErrorAdjunto] = useState('');
  const [grabando, setGrabando] = useState(false);
  const [segundosGrabados, setSegundosGrabados] = useState(0);
  const finRef = useRef<HTMLDivElement>(null);
  const inputArchivoRef = useRef<HTMLInputElement>(null);
  const grabadoraRef = useRef<Grabadora | null>(null);
  const timerGrabacionRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // A1 — refs de cada burbuja cargada, para poder saltar al mensaje fijado
  // cuando está entre los que ya están en pantalla (los 50 más recientes).
  const msgRefs = useRef<Record<string, HTMLDivElement | null>>({});

  function registrarRefMensaje(id: string, el: HTMLDivElement | null) {
    msgRefs.current[id] = el;
  }

  function saltarAMensaje(id: string) {
    msgRefs.current[id]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  // initChat lo dispara App.tsx, que sí conoce sede y jornada del usuario.
  useEffect(() => {
    if (!firebaseConfigurado) return;
    void esperarAuth().then((haySesion) => {
      if (haySesion) listarUsuariosParaDm().then(setDirectorio).catch(() => {});
    });
  }, [rol]);

  const mensajes = canalActivo ? mensajesPorCanal[canalActivo] ?? [] : [];

  // Autoscroll al fondo cuando llegan mensajes.
  useEffect(() => {
    finRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [mensajes.length, canalActivo]);

  // Mapa email -> displayName para nombrar DMs.
  const dirMap = useMemo(() => {
    const m = new Map<string, string>();
    directorio.forEach((u) => m.set(u.email, u.displayName));
    return m;
  }, [directorio]);

  const yo = miEmail();

  const docentesFiltrados = useMemo(() => {
    const q = buscar.trim().toLowerCase();
    if (!q) return directorio;
    return directorio.filter(
      (u) => u.displayName.toLowerCase().includes(q) || u.email.includes(q)
    );
  }, [directorio, buscar]);

  function nombreCanal(c: Canal): string {
    if (c.type === 'directo') {
      const otro = (c.members ?? []).find((e) => e !== yo) ?? '';
      return dirMap.get(otro) || otro || 'Directo';
    }
    return c.name || (c.type === 'general' ? 'General' : 'Canal');
  }

  const canalActual = canales.find((c) => c.id === canalActivo) ?? null;

  async function handleAbrirDm(email: string) {
    const id = await abrirDm(email);
    setModalDm(false);
    abrirCanal(id);
  }

  async function handleEnviar() {
    const t = texto.trim();
    if (!t && !archivoPendiente) return;
    setErrorAdjunto('');
    if (archivoPendiente && canalActivo) {
      setSubiendoPct(0);
      try {
        const adjunto: AdjuntoSubido = await subirAdjunto(canalActivo, archivoPendiente, setSubiendoPct);
        setTexto('');
        setArchivoPendiente(null);
        await enviar(t, adjunto);
      } catch (e: any) {
        setErrorAdjunto(e?.message || 'No se pudo subir el archivo.');
      } finally {
        setSubiendoPct(null);
      }
      return;
    }
    setTexto('');
    await enviar(t);
  }

  function handleElegirArchivo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setErrorAdjunto('');
    if (file.size > TAMANO_MAXIMO_BYTES) {
      setErrorAdjunto('El archivo supera el límite de 10 MB.');
      return;
    }
    setArchivoPendiente(file);
  }

  async function handleIniciarGrabacion() {
    if (!grabadoraSoportada()) {
      setErrorAdjunto('Este dispositivo no permite grabar notas de voz.');
      return;
    }
    setErrorAdjunto('');
    // Clic para iniciar / clic para detener (no mantener presionado): en
    // móvil, mantener presionado abre el menú contextual del navegador y es
    // una interacción frágil de detectar de forma confiable entre iOS/Android.
    const grabadora = crearGrabadora(() => handleDetenerGrabacion());
    try {
      await grabadora.iniciar();
    } catch (e: any) {
      setErrorAdjunto(e?.message || 'No se pudo acceder al micrófono.');
      return;
    }
    grabadoraRef.current = grabadora;
    setSegundosGrabados(0);
    setGrabando(true);
    timerGrabacionRef.current = setInterval(() => {
      setSegundosGrabados((s) => s + 1);
    }, 1000);
  }

  function pararTimer() {
    if (timerGrabacionRef.current) {
      clearInterval(timerGrabacionRef.current);
      timerGrabacionRef.current = null;
    }
  }

  // La usa tanto el botón de enviar como el corte automático a los 5 minutos.
  async function handleDetenerGrabacion() {
    const grabadora = grabadoraRef.current;
    if (!grabadora) return;
    pararTimer();
    setGrabando(false);
    try {
      const { blob, duracionSeg } = await grabadora.detener();
      grabadoraRef.current = null;
      if (!canalActivo) return;
      setSubiendoPct(0);
      const file = new File([blob], `nota_voz_${Date.now()}.mp3`, { type: 'audio/mpeg' });
      const adjunto = await subirAdjunto(canalActivo, file, setSubiendoPct, duracionSeg);
      await enviar('', adjunto);
    } catch (e: any) {
      setErrorAdjunto(e?.message || 'No se pudo procesar la nota de voz.');
    } finally {
      setSubiendoPct(null);
    }
  }

  function handleCancelarGrabacion() {
    pararTimer();
    grabadoraRef.current?.cancelar();
    grabadoraRef.current = null;
    setGrabando(false);
    setSegundosGrabados(0);
  }

  function mmss(totalSeg: number): string {
    const m = Math.floor(totalSeg / 60);
    const s = totalSeg % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  }

  if (!firebaseConfigurado) {
    return (
      <div className="max-w-md mx-auto">
        <div className="rounded-xl bg-info-soft text-info-soft-fg text-sm px-4 py-4 leading-snug">
          El chat estará disponible con la autenticación Google activada.
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col md:flex-row gap-4 md:h-[70vh]">
      {/* ── Lista de canales ─────────────────────────────────────────── */}
      <aside
        className={
          'md:w-72 flex-shrink-0 bg-card rounded-xl border border-line flex flex-col overflow-hidden ' +
          (canalActivo ? 'hidden md:flex' : 'flex')
        }
      >
        {/* Pestañas: las conversaciones existentes y el directorio de docentes.
            Antes el directorio vivía dentro de un modal y no se encontraba. */}
        <div className="flex border-b border-line">
          <button
            onClick={() => setPestana('chats')}
            className={
              'flex-1 text-sm py-2.5 font-medium transition border-b-2 ' +
              (pestana === 'chats'
                ? 'border-accent text-strong'
                : 'border-transparent text-muted hover:text-soft')
            }
          >
            Conversaciones
          </button>
          <button
            onClick={() => setPestana('docentes')}
            className={
              'flex-1 text-sm py-2.5 font-medium transition border-b-2 ' +
              (pestana === 'docentes'
                ? 'border-accent text-strong'
                : 'border-transparent text-muted hover:text-soft')
            }
          >
            Docentes{directorio.length > 0 ? ` (${directorio.length})` : ''}
          </button>
        </div>

        {pestana === 'docentes' ? (
          <>
            <div className="p-3 border-b border-line">
              <input
                type="search"
                value={buscar}
                onChange={(e) => setBuscar(e.target.value)}
                placeholder="Buscar un docente…"
                className="w-full px-3 py-2 rounded-lg bg-elevated border border-line text-strong text-sm placeholder:text-muted focus:outline-none focus:border-line-strong"
              />
            </div>
            <div className="flex-1 overflow-y-auto">
              {directorio.length === 0 ? (
                <div className="text-center text-muted text-xs py-8 px-3 leading-relaxed">
                  No se pudo cargar el directorio.
                  <br />
                  Verifica que tengas la sesión institucional abierta.
                </div>
              ) : docentesFiltrados.length === 0 ? (
                <div className="text-center text-muted text-xs py-8 px-3">
                  Ningún docente coincide con «{buscar}».
                </div>
              ) : (
                docentesFiltrados.map((u) => (
                  <button
                    key={u.email}
                    onClick={() => handleAbrirDm(u.email)}
                    className="w-full text-left px-3 py-2.5 border-b border-line/50 hover:bg-elevated transition"
                  >
                    <div className="text-sm text-strong truncate">{u.displayName}</div>
                    <div className="text-xs text-muted truncate">{u.email}</div>
                  </button>
                ))
              )}
            </div>
          </>
        ) : (
        <>
        <div className="p-3 border-b border-line space-y-2">
          {puedeCrearGrupo && (
            <button
              onClick={() => setModalGrupo(true)}
              className="w-full text-sm px-3 py-2 rounded-lg bg-elevated text-soft hover:text-strong transition"
            >
              ＋ Nuevo grupo
            </button>
          )}
          {esSuper && (
            <button
              onClick={() => setModalCanal(true)}
              className="w-full text-sm px-3 py-2 rounded-lg bg-elevated text-soft hover:text-strong transition"
            >
              ＋ Nuevo canal
            </button>
          )}
        </div>
        <div className="flex-1 overflow-y-auto">
          {canales.length === 0 ? (
            <div className="text-center text-muted text-xs py-8 px-3 leading-relaxed space-y-3">
              <p>
                No hay conversaciones aún.
                <br />
                Abre la pestaña «Docentes» para escribirle a alguien.
              </p>
              {/* Diagnóstico: sin esto, una lista vacía por falta de sesión o
                  por permisos se ve idéntica a una lista vacía legítima. */}
              <div className="mx-auto max-w-xs text-left rounded-lg border border-line bg-elevated px-3 py-2 space-y-1">
                <p className="text-[10px] uppercase tracking-wide text-muted">Diagnóstico</p>
                <p className="text-[11px] text-soft break-all">
                  Sesión: {emailSesion ?? <span className="text-danger">ninguna</span>}
                </p>
                {errorCanales && (
                  <p className="text-[11px] text-danger break-all">Fallo: {errorCanales}</p>
                )}
                {!errorCanales && emailSesion && (
                  <p className="text-[11px] text-soft">Sin errores: no hay canales visibles.</p>
                )}
              </div>
            </div>
          ) : (
            canales.map((c) => {
              const activo = c.id === canalActivo;
              const nuevo = noLeidos(c);
              return (
                <button
                  key={c.id}
                  onClick={() => abrirCanal(c.id)}
                  className={
                    'w-full text-left px-3 py-2.5 border-b border-line/50 transition ' +
                    (activo ? 'bg-elevated' : 'hover:bg-elevated/60')
                  }
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm text-strong font-medium truncate">
                      {nombreCanal(c)}
                      {c.type === 'grupo' && (
                        <span className="text-xs text-muted font-normal ml-1">
                          ({(c.members ?? []).length})
                        </span>
                      )}
                    </span>
                    {nuevo && <span className="w-2 h-2 rounded-full bg-accent flex-shrink-0" />}
                  </div>
                  {c.lastMessagePreview && (
                    <div className="text-xs text-muted truncate mt-0.5">
                      {c.lastMessagePreview}
                    </div>
                  )}
                </button>
              );
            })
          )}
        </div>
        </>
        )}
      </aside>

      {/* ── Conversación ─────────────────────────────────────────────── */}
      <section
        className={
          'flex-1 bg-card rounded-xl border border-line flex flex-col overflow-hidden ' +
          (canalActivo ? 'flex' : 'hidden md:flex')
        }
      >
        {!canalActivo ? (
          <div className="flex-1 flex items-center justify-center text-muted text-sm">
            Selecciona una conversación.
          </div>
        ) : (
          <>
            <header className="px-4 py-3 border-b border-line flex items-center gap-3">
              <button
                onClick={() => useChatStore.setState({ canalActivo: null })}
                className="md:hidden text-soft hover:text-strong text-sm"
              >
                ←
              </button>
              <span className="text-strong font-semibold text-sm">
                {canalActual ? nombreCanal(canalActual) : ''}
              </span>
            </header>

            {/* A1 — franja del mensaje fijado. Al tocarla, salta al original
                si está entre los ya cargados; si no, no hay nada que hacer
                (no se piden mensajes viejos solo para esto). */}
            {canalActual?.fijado && (
              <button
                onClick={() => saltarAMensaje(canalActual.fijado!.messageId)}
                className="w-full flex items-center gap-2 px-4 py-2 border-b border-line bg-elevated text-left hover:bg-elevated/70 transition"
              >
                <Pin size={14} className="text-accent flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="text-[10px] text-muted">
                    Fijado por {dirMap.get(canalActual.fijado.fijadoPor) || canalActual.fijado.fijadoPor}
                  </div>
                  <div className="text-xs text-strong truncate">
                    {canalActual.fijado.text || `Mensaje de ${canalActual.fijado.autorNombre}`}
                  </div>
                </div>
              </button>
            )}

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {mensajes.map((m) => (
                <Burbuja
                  key={m.id}
                  m={m}
                  propio={m.authorEmail === yo}
                  puedeModerar={esSuper}
                  channelId={canalActivo}
                  canal={canalActual}
                  miRol={rol}
                  registrarRef={registrarRefMensaje}
                />
              ))}
              <div ref={finRef} />
            </div>

            <div className="border-t border-line">
              {canalActual && !puedoPublicarEn(canalActual, rol) ? (
                <div className="px-4 py-3 text-xs text-muted text-center">
                  Solo coordinación y rectoría publican en este canal.
                </div>
              ) : (
              <>

              {errorAdjunto && (
                <div className="mx-3 mt-2 px-3 py-2 rounded-lg bg-danger-soft text-danger text-xs">
                  {errorAdjunto}
                </div>
              )}

              {/* Vista previa del archivo elegido, antes de enviar. */}
              {archivoPendiente && !grabando && (
                <div className="mx-3 mt-2 flex items-center gap-2 px-2 py-2 rounded-lg bg-elevated border border-line">
                  {archivoPendiente.type.startsWith('image/') ? (
                    <img
                      src={URL.createObjectURL(archivoPendiente)}
                      alt=""
                      className="w-10 h-10 rounded object-cover flex-shrink-0"
                    />
                  ) : (
                    <FileText size={20} className="text-muted flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-strong truncate">{archivoPendiente.name}</div>
                    <div className="text-[10px] text-muted">{pesoLegible(archivoPendiente.size)}</div>
                    {subiendoPct !== null && (
                      <div className="mt-1 h-1 rounded-full bg-card overflow-hidden">
                        <div
                          className="h-full bg-accent transition-all"
                          style={{ width: `${subiendoPct}%` }}
                        />
                      </div>
                    )}
                  </div>
                  {subiendoPct === null && (
                    <button
                      onClick={() => setArchivoPendiente(null)}
                      className="text-muted hover:text-strong flex-shrink-0"
                      aria-label="Quitar adjunto"
                    >
                      <X size={16} />
                    </button>
                  )}
                </div>
              )}

              {grabando ? (
                <div className="p-3 flex items-center gap-3">
                  <span className="w-2.5 h-2.5 rounded-full bg-danger animate-pulse flex-shrink-0" />
                  <span className="text-sm text-strong font-medium flex-1">
                    Grabando… {mmss(segundosGrabados)}
                  </span>
                  <button
                    onClick={handleCancelarGrabacion}
                    className="p-2 rounded-lg bg-elevated text-muted hover:text-danger transition"
                    aria-label="Cancelar grabación"
                  >
                    <Trash2 size={18} />
                  </button>
                  <button
                    onClick={() => handleDetenerGrabacion()}
                    className="p-2 rounded-lg bg-accent text-strong hover:opacity-90 transition"
                    aria-label="Enviar nota de voz"
                  >
                    <Send size={18} />
                  </button>
                </div>
              ) : (
                <div className="p-3 flex items-end gap-2">
                  <input
                    ref={inputArchivoRef}
                    type="file"
                    hidden
                    onChange={handleElegirArchivo}
                    accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt"
                  />
                  <button
                    onClick={() => inputArchivoRef.current?.click()}
                    disabled={subiendoPct !== null}
                    className="p-2 rounded-lg text-muted hover:text-strong hover:bg-elevated transition flex-shrink-0 disabled:opacity-40"
                    aria-label="Adjuntar archivo"
                  >
                    <Paperclip size={18} />
                  </button>
                  <button
                    onClick={handleIniciarGrabacion}
                    disabled={subiendoPct !== null}
                    className="p-2 rounded-lg text-muted hover:text-strong hover:bg-elevated transition flex-shrink-0 disabled:opacity-40"
                    aria-label="Grabar nota de voz"
                  >
                    <Mic size={18} />
                  </button>
                  <textarea
                    value={texto}
                    onChange={(e) => setTexto(e.target.value.slice(0, 4000))}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleEnviar();
                      }
                    }}
                    rows={1}
                    placeholder="Escribe un mensaje…"
                    className="flex-1 resize-none px-3 py-2 rounded-lg bg-elevated border border-line text-strong text-sm placeholder:text-muted focus:outline-none focus:border-line-strong max-h-32"
                  />
                  <button
                    onClick={handleEnviar}
                    disabled={(!texto.trim() && !archivoPendiente) || subiendoPct !== null}
                    className="px-4 py-2 rounded-lg bg-accent text-strong text-sm font-medium hover:opacity-90 transition disabled:opacity-40"
                  >
                    Enviar
                  </button>
                </div>
              )}
              </>
              )}
            </div>
          </>
        )}
      </section>

      {/* ── Modal: directorio para DM ────────────────────────────────── */}
      {modalDm && (
        <Modal onClose={() => setModalDm(false)} titulo="Nuevo mensaje directo">
          <div className="max-h-80 overflow-y-auto">
            {directorio.length === 0 ? (
              <div className="text-muted text-sm py-6 text-center">No hay docentes disponibles.</div>
            ) : (
              directorio.map((u) => (
                <button
                  key={u.email}
                  onClick={() => handleAbrirDm(u.email)}
                  className="w-full text-left px-3 py-2 rounded-lg hover:bg-elevated transition"
                >
                  <div className="text-sm text-strong">{u.displayName}</div>
                  <div className="text-xs text-muted">{u.email}</div>
                </button>
              ))
            )}
          </div>
        </Modal>
      )}

      {/* ── Modal: nuevo canal (superusuario) ────────────────────────── */}
      {modalCanal && esSuper && (
        <ModalNuevoCanal
          onClose={() => setModalCanal(false)}
          onCreado={(id) => {
            setModalCanal(false);
            abrirCanal(id);
          }}
        />
      )}

      {/* ── Modal: nuevo grupo (coordinador, rectora, superusuario) ──── */}
      {modalGrupo && puedeCrearGrupo && (
        <ModalNuevoGrupo
          directorio={directorio}
          crearGrupoStore={crearGrupoStore}
          onClose={() => setModalGrupo(false)}
          onCreado={(id) => {
            setModalGrupo(false);
            abrirCanal(id);
          }}
        />
      )}
    </div>
  );
}

// ── Burbuja de mensaje ────────────────────────────────────────────────────
// Roles que pueden fijar en canales que no son 'directo'/'grupo' (ver
// contrato A1). En directo/grupo cualquier miembro puede fijar.
const ROLES_PUEDEN_FIJAR = ['coordinador', 'rectora', 'superusuario'];

function Burbuja({
  m,
  propio,
  puedeModerar,
  channelId,
  canal,
  miRol,
  registrarRef,
}: {
  m: Mensaje;
  propio: boolean;
  puedeModerar: boolean;
  channelId: string;
  canal: Canal | null;
  miRol: string;
  registrarRef: (id: string, el: HTMLDivElement | null) => void;
}) {
  const [editando, setEditando] = useState(false);
  const [valor, setValor] = useState(m.text);
  const [pickerAbierto, setPickerAbierto] = useState(false);
  const yo = miEmail();

  // C2 — reacciones bajo demanda: el listener del store solo se abre
  // mientras la burbuja está de verdad visible en pantalla (IntersectionObserver
  // sobre el propio nodo), y se cierra al salir de vista o desmontar. Con los
  // 50 mensajes cargados sin virtualizar, abrir un listener por mensaje
  // montado sería exactamente lo que el contrato pide evitar.
  const bubbleElRef = useRef<HTMLDivElement>(null);
  const abrirReacciones = useChatStore((s) => s.abrirReacciones);
  const cerrarReacciones = useChatStore((s) => s.cerrarReacciones);
  const reaccionar = useChatStore((s) => s.reaccionar);
  const quitarMiReaccion = useChatStore((s) => s.quitarMiReaccion);
  const reacciones = useChatStore((s) => s.reaccionesPorMensaje[m.id]) ?? [];
  const contarLeidoPor = useChatStore((s) => s.contarLeidoPor);
  const fijar = useChatStore((s) => s.fijar);
  const soltarFijadoStore = useChatStore((s) => s.soltarFijadoStore);

  useEffect(() => {
    const el = bubbleElRef.current;
    if (!el || m.deleted) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) abrirReacciones(m.id);
        else cerrarReacciones(m.id);
      },
      { threshold: 0.15 },
    );
    obs.observe(el);
    return () => {
      obs.disconnect();
      cerrarReacciones(m.id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [m.id, m.deleted]);

  const agrupadas = useMemo(() => {
    const out: Record<string, number> = {};
    reacciones.forEach((r) => { out[r.emoji] = (out[r.emoji] ?? 0) + 1; });
    return out;
  }, [reacciones]);
  const miReaccion = reacciones.find((r) => r.correo === yo)?.emoji;

  const esFijado = canal?.fijado?.messageId === m.id;
  const puedeFijar =
    !!canal &&
    (canal.type === 'directo' || canal.type === 'grupo' || ROLES_PUEDEN_FIJAR.includes(miRol));

  async function handleFijar() {
    if (!canal) return;
    // A1 — fijar sobre un canal que ya tiene un fijado lo REEMPLAZA: hay que
    // advertirlo ANTES de fijar, no después.
    if (canal.fijado && canal.fijado.messageId !== m.id) {
      const ok = window.confirm('Ya hay un mensaje fijado en este canal. ¿Reemplazarlo por este?');
      if (!ok) return;
    }
    await fijar(channelId, m);
  }

  if (m.deleted) {
    return (
      <div className={'flex ' + (propio ? 'justify-end' : 'justify-start')}>
        <div className="text-xs text-muted italic px-3 py-1.5 rounded-lg bg-elevated/50">
          mensaje eliminado
        </div>
      </div>
    );
  }

  return (
    <div
      ref={(el) => {
        bubbleElRef.current = el;
        registrarRef(m.id, el);
      }}
      className={'flex flex-col ' + (propio ? 'items-end' : 'items-start')}
    >
      {esFijado && (
        <div className="flex items-center gap-1 text-[10px] text-accent mb-0.5">
          <Pin size={10} /> fijado
        </div>
      )}
      <div className="relative group max-w-[80%]">
      <div
        className={
          'rounded-2xl px-3 py-2 ' +
          (propio ? 'bg-accent text-strong' : 'bg-elevated text-strong')
        }
      >
        {!propio && (
          <div className="text-xs font-semibold text-info mb-0.5">{m.authorName}</div>
        )}
        {editando ? (
          <div className="space-y-2">
            <textarea
              value={valor}
              onChange={(e) => setValor(e.target.value.slice(0, 4000))}
              rows={2}
              className="w-full resize-none px-2 py-1 rounded bg-card border border-line text-strong text-sm focus:outline-none"
            />
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => { setEditando(false); setValor(m.text); }}
                className="text-xs text-muted hover:text-strong"
              >
                Cancelar
              </button>
              <button
                onClick={async () => { await editarMensaje(channelId, m.id, valor); setEditando(false); }}
                className="text-xs text-info font-medium"
              >
                Guardar
              </button>
            </div>
          </div>
        ) : (
          <>
            {m.adjunto && <AdjuntoVista adjunto={m.adjunto} />}
            {m.text && <div className="text-sm whitespace-pre-wrap break-words">{m.text}</div>}
          </>
        )}
        <div className="flex items-center gap-2 justify-end mt-1">
          {m.editedAt && <span className="text-[10px] text-muted">editado</span>}
          <span className="text-[10px] text-muted">
            {fechaCorta(m.createdAt)} {horaCorta(m.createdAt)}
          </span>
          {(propio || puedeModerar) && !editando && (
            <>
              {propio && (
                <button
                  onClick={() => setEditando(true)}
                  className="text-[10px] text-muted hover:text-strong"
                >
                  editar
                </button>
              )}
              <button
                onClick={() => borrarMensaje(channelId, m.id)}
                className="text-[10px] text-muted hover:text-danger"
              >
                borrar
              </button>
            </>
          )}
          {puedeFijar && !editando && (
            <button
              onClick={() => (esFijado ? soltarFijadoStore(channelId) : handleFijar())}
              className="text-[10px] text-muted hover:text-strong flex items-center gap-0.5"
              aria-label={esFijado ? 'Soltar fijado' : 'Fijar mensaje'}
            >
              <Pin size={10} /> {esFijado ? 'soltar' : 'fijar'}
            </button>
          )}
        </div>

        {/* B1 — leído por: solo en mis propios mensajes. Sin denominador
            fiable fuera de 'directo'/'grupo' — nunca inventar un porcentaje. */}
        {propio && !editando && (() => {
          const n = contarLeidoPor(m);
          if (n <= 0) return null;
          // El denominador tambien excluye al autor: en un directo de dos,
          // el unico que puede leerlo es el otro, y "de 2" sugeriria que falta
          // alguien para siempre.
          const otros =
            canal && (canal.type === 'directo' || canal.type === 'grupo')
              ? (canal.members?.length ?? 0) - 1
              : 0;
          const denom = otros > 0 ? otros : undefined;
          return (
            <div className="text-[10px] text-muted text-right mt-0.5">
              Leído por {n}{denom ? ` de ${denom}` : ''}
            </div>
          );
        })()}
      </div>

      {/* C2 — botón de reacción: siempre táctil, no depende de hover para
          aparecer (móvil primero). El picker se cierra al elegir un emoji. */}
      {!editando && (
        <button
          onClick={() => setPickerAbierto((v) => !v)}
          className={
            'absolute -bottom-2 flex items-center justify-center w-7 h-7 rounded-full bg-card border border-line text-muted hover:text-strong transition ' +
            (propio ? 'left-0 -translate-x-1/2' : 'right-0 translate-x-1/2')
          }
          aria-label="Reaccionar"
        >
          <SmilePlus size={13} />
        </button>
      )}
      {pickerAbierto && (
        <div
          className={
            'absolute z-10 -bottom-11 flex gap-1 bg-card border border-line rounded-full px-2 py-1.5 shadow-lg ' +
            (propio ? 'right-0' : 'left-0')
          }
        >
          {EMOJIS_REACCION.map((e) => (
            <button
              key={e}
              onClick={() => {
                if (miReaccion === e) quitarMiReaccion(m.id);
                else reaccionar(m.id, e as EmojiReaccion);
                setPickerAbierto(false);
              }}
              className={
                'text-base leading-none w-7 h-7 flex items-center justify-center rounded-full transition ' +
                (miReaccion === e ? 'bg-accent/30' : 'hover:bg-elevated')
              }
            >
              {e}
            </button>
          ))}
        </div>
      )}
      </div>

      {/* Recuento de reacciones agregadas, con la propia resaltada. */}
      {Object.keys(agrupadas).length > 0 && (
        <div className={'flex flex-wrap gap-1 mt-1 ' + (propio ? 'justify-end' : 'justify-start')}>
          {Object.entries(agrupadas).map(([emoji, count]) => {
            const esMia = miReaccion === emoji;
            return (
              <button
                key={emoji}
                onClick={() => (esMia ? quitarMiReaccion(m.id) : reaccionar(m.id, emoji as EmojiReaccion))}
                className={
                  'text-xs px-1.5 py-0.5 rounded-full border transition ' +
                  (esMia ? 'bg-accent/30 border-accent text-strong' : 'bg-elevated border-line text-soft hover:text-strong')
                }
              >
                {emoji} {count}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Adjunto de una burbuja ────────────────────────────────────────────────
// Los adjuntos se borran a los 90 días por ciclo de vida del bucket, pero el
// mensaje permanece. Un fallo de carga es esperado (no un error del sistema),
// por eso se muestra un aviso tenue en vez de un ícono roto.
function AdjuntoVista({ adjunto }: { adjunto: NonNullable<Mensaje['adjunto']> }) {
  const [expirado, setExpirado] = useState(false);

  if (expirado) {
    return (
      <div className="text-xs text-muted italic mb-1">
        Adjunto expirado (los archivos se borran a los 90 días).
      </div>
    );
  }

  if (adjunto.tipo === 'imagen') {
    return (
      <a href={adjunto.url} target="_blank" rel="noopener noreferrer" className="block mb-1">
        <img
          src={adjunto.url}
          alt={adjunto.nombre}
          className="max-h-60 rounded-lg"
          onError={() => setExpirado(true)}
        />
      </a>
    );
  }

  if (adjunto.tipo === 'audio') {
    return (
      <div className="mb-1 flex items-center gap-2">
        <audio controls preload="metadata" src={adjunto.url} className="max-w-full" onError={() => setExpirado(true)} />
        {typeof adjunto.duracionSeg === 'number' && (
          <span className="text-[10px] text-muted flex-shrink-0">
            {Math.floor(adjunto.duracionSeg / 60)}:{String(adjunto.duracionSeg % 60).padStart(2, '0')}
          </span>
        )}
      </div>
    );
  }

  // 'archivo'
  return (
    <a
      href={adjunto.url}
      target="_blank"
      rel="noopener noreferrer"
      className="mb-1 flex items-center gap-2 px-2 py-2 rounded-lg bg-card/50 border border-line hover:border-line-strong transition"
      onClick={(e) => {
        // No hay onError en <a>; si el enlace no resuelve, el navegador
        // mostrará su propio error de descarga — es aceptable para archivos.
        void e;
      }}
    >
      <FileText size={18} className="text-muted flex-shrink-0" />
      <div className="min-w-0">
        <div className="text-xs text-strong truncate">{adjunto.nombre}</div>
        <div className="text-[10px] text-muted">{pesoLegible(adjunto.bytes)}</div>
      </div>
    </a>
  );
}

// ── Modal genérico ────────────────────────────────────────────────────────
function Modal({
  titulo,
  onClose,
  children,
}: {
  titulo: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="bg-card rounded-xl border border-line w-full max-w-sm p-4 space-y-3"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-strong font-semibold text-sm">{titulo}</h3>
          <button onClick={onClose} className="text-muted hover:text-strong text-lg leading-none">×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ── Modal: crear canal ────────────────────────────────────────────────────
function ModalNuevoCanal({
  onClose,
  onCreado,
}: {
  onClose: () => void;
  onCreado: (id: string) => void;
}) {
  const [nombre, setNombre] = useState('');
  const [tipo, setTipo] = useState<'general' | 'rol'>('general');
  const [roles, setRoles] = useState<string[]>(['coordinador']);
  const [creando, setCreando] = useState(false);
  const ROLES = ['coordinador', 'docente', 'rectora', 'superusuario'];

  async function crear() {
    if (!nombre.trim()) return;
    setCreando(true);
    try {
      const id = await crearCanal(nombre, tipo, tipo === 'rol' ? roles : undefined);
      onCreado(id);
    } finally {
      setCreando(false);
    }
  }

  return (
    <Modal titulo="Nuevo canal" onClose={onClose}>
      <input
        type="text"
        placeholder="Nombre del canal"
        value={nombre}
        onChange={(e) => setNombre(e.target.value)}
        className="w-full px-3 py-2 rounded-lg bg-elevated border border-line text-strong text-sm placeholder:text-muted focus:outline-none focus:border-line-strong"
      />
      <select
        value={tipo}
        onChange={(e) => setTipo(e.target.value as 'general' | 'rol')}
        className="w-full px-3 py-2 rounded-lg bg-elevated border border-line text-strong text-sm focus:outline-none"
      >
        <option value="general">General (todos)</option>
        <option value="rol">Por rol</option>
      </select>
      {tipo === 'rol' && (
        <div className="flex flex-wrap gap-2">
          {ROLES.map((r) => {
            const on = roles.includes(r);
            return (
              <button
                key={r}
                onClick={() => setRoles((prev) => (on ? prev.filter((x) => x !== r) : [...prev, r]))}
                className={
                  'text-xs px-2.5 py-1 rounded-full border transition ' +
                  (on ? 'bg-accent text-strong border-line-strong' : 'bg-elevated text-muted border-line')
                }
              >
                {r}
              </button>
            );
          })}
        </div>
      )}
      <button
        onClick={crear}
        disabled={creando || !nombre.trim() || (tipo === 'rol' && roles.length === 0)}
        className="w-full px-4 py-2 rounded-lg bg-accent text-strong text-sm font-medium hover:opacity-90 transition disabled:opacity-40"
      >
        {creando ? 'Creando…' : 'Crear canal'}
      </button>
    </Modal>
  );
}

// ── Modal: crear grupo (coordinador, rectora, superusuario) ────────────────
function ModalNuevoGrupo({
  directorio,
  crearGrupoStore,
  onClose,
  onCreado,
}: {
  directorio: Array<{ email: string; displayName: string }>;
  crearGrupoStore: (nombre: string, miembros: string[]) => Promise<string>;
  onClose: () => void;
  onCreado: (id: string) => void;
}) {
  const [nombre, setNombre] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [seleccionados, setSeleccionados] = useState<Set<string>>(new Set());
  const [creando, setCreando] = useState(false);

  const filtrados = directorio.filter((u) => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return true;
    return u.displayName.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
  });

  function toggle(email: string) {
    setSeleccionados((prev) => {
      const next = new Set(prev);
      if (next.has(email)) next.delete(email);
      else next.add(email);
      return next;
    });
  }

  async function crear() {
    if (!nombre.trim() || seleccionados.size === 0) return;
    setCreando(true);
    try {
      const id = await crearGrupoStore(nombre.trim(), Array.from(seleccionados));
      onCreado(id);
    } finally {
      setCreando(false);
    }
  }

  return (
    <Modal titulo="Nuevo grupo" onClose={onClose}>
      <input
        type="text"
        placeholder="Nombre del grupo"
        value={nombre}
        onChange={(e) => setNombre(e.target.value)}
        className="w-full px-3 py-2 rounded-lg bg-elevated border border-line text-strong text-sm placeholder:text-muted focus:outline-none focus:border-line-strong"
      />
      <input
        type="text"
        placeholder="Buscar docente…"
        value={busqueda}
        onChange={(e) => setBusqueda(e.target.value)}
        className="w-full px-3 py-2 rounded-lg bg-elevated border border-line text-strong text-sm placeholder:text-muted focus:outline-none focus:border-line-strong"
      />
      <div className="text-xs text-muted">{seleccionados.size} seleccionado(s)</div>
      <div className="max-h-56 overflow-y-auto rounded-lg border border-line divide-y divide-line/50">
        {filtrados.length === 0 ? (
          <div className="text-muted text-sm py-4 text-center">Sin resultados.</div>
        ) : (
          filtrados.map((u) => {
            const on = seleccionados.has(u.email);
            return (
              <label
                key={u.email}
                className="flex items-center gap-2 px-3 py-2 hover:bg-elevated cursor-pointer transition"
              >
                <input
                  type="checkbox"
                  checked={on}
                  onChange={() => toggle(u.email)}
                  className="accent-current"
                />
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-strong truncate">{u.displayName}</div>
                  <div className="text-xs text-muted truncate">{u.email}</div>
                </div>
              </label>
            );
          })
        )}
      </div>
      <button
        onClick={crear}
        disabled={creando || !nombre.trim() || seleccionados.size === 0}
        className="w-full px-4 py-2 rounded-lg bg-accent text-strong text-sm font-medium hover:opacity-90 transition disabled:opacity-40"
      >
        {creando ? 'Creando…' : 'Crear grupo'}
      </button>
    </Modal>
  );
}
