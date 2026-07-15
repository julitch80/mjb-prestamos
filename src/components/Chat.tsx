// Chat interno tipo Telegram (Etapa 4 — Fase 3 del manual).
// Solo funciona en modo google con Firebase configurado. En modo pin el item de
// navegación 'chat' ni siquiera aparece (filtrado en App.tsx).
import { useEffect, useMemo, useRef, useState } from 'react';
import { useAppStore } from '../data/store';
import { useChatStore } from '../data/chatStore';
import { firebaseConfigurado } from '../lib/firebase';
import {
  abrirDm,
  borrarMensaje,
  crearCanal,
  editarMensaje,
  listarUsuariosParaDm,
  miEmail,
  type Canal,
  type Mensaje,
} from '../data/chat';

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

  const {
    canales,
    mensajesPorCanal,
    canalActivo,
    initChat,
    abrirCanal,
    enviar,
    noLeidos,
  } = useChatStore();

  const [directorio, setDirectorio] = useState<Array<{ email: string; displayName: string }>>([]);
  const [modalDm, setModalDm] = useState(false);
  const [modalCanal, setModalCanal] = useState(false);
  const [texto, setTexto] = useState('');
  const finRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (firebaseConfigurado) {
      initChat(rol);
      listarUsuariosParaDm().then(setDirectorio).catch(() => {});
    }
  }, [rol, initChat]);

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
    if (!t) return;
    setTexto('');
    await enviar(t);
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
        <div className="p-3 border-b border-line space-y-2">
          <button
            onClick={() => setModalDm(true)}
            className="w-full text-sm px-3 py-2 rounded-lg bg-accent text-strong font-medium hover:opacity-90 transition"
          >
            ＋ Nuevo mensaje directo
          </button>
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
            <div className="text-center text-muted text-xs py-8 px-3">
              No hay conversaciones aún.
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

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {mensajes.map((m) => (
                <Burbuja
                  key={m.id}
                  m={m}
                  propio={m.authorEmail === yo}
                  puedeModerar={esSuper}
                  channelId={canalActivo}
                />
              ))}
              <div ref={finRef} />
            </div>

            <div className="p-3 border-t border-line flex items-end gap-2">
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
                disabled={!texto.trim()}
                className="px-4 py-2 rounded-lg bg-accent text-strong text-sm font-medium hover:opacity-90 transition disabled:opacity-40"
              >
                Enviar
              </button>
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
    </div>
  );
}

// ── Burbuja de mensaje ────────────────────────────────────────────────────
function Burbuja({
  m,
  propio,
  puedeModerar,
  channelId,
}: {
  m: Mensaje;
  propio: boolean;
  puedeModerar: boolean;
  channelId: string;
}) {
  const [editando, setEditando] = useState(false);
  const [valor, setValor] = useState(m.text);

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
    <div className={'flex ' + (propio ? 'justify-end' : 'justify-start')}>
      <div
        className={
          'max-w-[80%] rounded-2xl px-3 py-2 ' +
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
          <div className="text-sm whitespace-pre-wrap break-words">{m.text}</div>
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
        </div>
      </div>
    </div>
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
