import { useEffect, useState } from 'react';
import { useAppStore } from '../data/store';
import { firebaseConfigurado, functions, db } from '../lib/firebase';
import { httpsCallable } from 'firebase/functions';
import { collection, getDocs } from 'firebase/firestore';
import {
  listarUsuarios,
  crearDocente,
  cambiarRol,
  setActivo,
  type UsuarioFirestore,
  type RolUsuario,
} from '../data/adminUsers';

type CambioReemplazo = { campo: string; de?: string; a: string; valor?: string; usuario?: string };
type ResultadoReemplazo = { dryRun: boolean; slot: string; changes: CambioReemplazo[] };

type LogAuditoria = {
  id: string;
  action?: string;
  executedBy?: string;
  executedAt?: { toDate?: () => Date } | null;
  outgoingEmail?: string;
  incomingEmail?: string;
  dryRun?: boolean;
  status?: string;
  errorMessage?: string | null;
};

const ROLES: RolUsuario[] = ['docente', 'coordinador', 'superusuario'];

const ROL_LABEL: Record<RolUsuario, string> = {
  docente: 'Docente',
  coordinador: 'Coordinador',
  superusuario: 'Superusuario',
};

type Mensaje = { tipo: 'ok' | 'error'; texto: string };

export default function PanelSuperusuario() {
  const { userId, nombre } = useAppStore();
  const [usuarios, setUsuarios] = useState<UsuarioFirestore[]>([]);
  const [cargando, setCargando] = useState(true);
  const [mensaje, setMensaje] = useState<Mensaje | null>(null);

  // Formulario de alta
  const [correo, setCorreo] = useState('');
  const [nombreNuevo, setNombreNuevo] = useState('');
  const [rolNuevo, setRolNuevo] = useState<RolUsuario>('docente');
  const [slotNuevo, setSlotNuevo] = useState('');
  const [creando, setCreando] = useState(false);

  // Reemplazo de docente
  const [salienteEmail, setSalienteEmail] = useState('');
  const [entranteEmail, setEntranteEmail] = useState('');
  const [previa, setPrevia] = useState<ResultadoReemplazo | null>(null);
  const [previendo, setPreviendo] = useState(false);
  const [ejecutando, setEjecutando] = useState(false);
  const [mensajeReemplazo, setMensajeReemplazo] = useState<Mensaje | null>(null);

  // Auditoría
  const [logs, setLogs] = useState<LogAuditoria[] | null>(null);
  const [cargandoLogs, setCargandoLogs] = useState(false);

  // Identidad del superusuario actual (para anti-auto-modificación).
  // En modo google el id del store es el correo cuando no hay usuario interno.
  const yoEmail = (userId ?? '').toLowerCase();
  const creadoPor = yoEmail || nombre || 'superusuario';

  async function recargar() {
    setCargando(true);
    try {
      const lista = await listarUsuarios();
      setUsuarios(lista);
    } catch (e) {
      setMensaje({ tipo: 'error', texto: (e as Error).message });
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    if (firebaseConfigurado) recargar();
    else setCargando(false);
  }, []);

  async function handleCrear(e: React.FormEvent) {
    e.preventDefault();
    setMensaje(null);
    setCreando(true);
    try {
      await crearDocente(correo, nombreNuevo, rolNuevo, creadoPor, slotNuevo.trim() || null);
      setMensaje({ tipo: 'ok', texto: 'Usuario creado correctamente.' });
      setCorreo('');
      setNombreNuevo('');
      setRolNuevo('docente');
      setSlotNuevo('');
      await recargar();
    } catch (e) {
      setMensaje({ tipo: 'error', texto: (e as Error).message });
    } finally {
      setCreando(false);
    }
  }

  async function handleRol(u: UsuarioFirestore, role: RolUsuario) {
    setMensaje(null);
    try {
      await cambiarRol(u.email, role);
      await recargar();
    } catch (e) {
      setMensaje({ tipo: 'error', texto: (e as Error).message });
    }
  }

  async function handleActivo(u: UsuarioFirestore, active: boolean) {
    setMensaje(null);
    try {
      await setActivo(u.email, active);
      await recargar();
    } catch (e) {
      setMensaje({ tipo: 'error', texto: (e as Error).message });
    }
  }

  // ── Reemplazo de docente (Etapa 5) ──────────────────────────────────
  const salientes = usuarios.filter((u) => u.active && u.slotId);
  const entrantes = usuarios.filter((u) => u.active && !u.slotId && u.email !== salienteEmail);

  async function handlePrevisualizar() {
    setMensajeReemplazo(null);
    setPrevia(null);
    if (!functions) {
      setMensajeReemplazo({ tipo: 'error', texto: 'Firebase Functions no está configurado.' });
      return;
    }
    setPreviendo(true);
    try {
      const call = httpsCallable(functions, 'replaceTeacher');
      const res = await call({ outgoingEmail: salienteEmail, incomingEmail: entranteEmail, dryRun: true });
      setPrevia(res.data as ResultadoReemplazo);
    } catch (e) {
      setMensajeReemplazo({ tipo: 'error', texto: (e as Error).message });
    } finally {
      setPreviendo(false);
    }
  }

  async function handleEjecutarReemplazo() {
    if (!functions || !previa) return;
    const ok = window.confirm(
      `¿Confirmas reemplazar a ${salienteEmail} por ${entranteEmail}? Esta acción no se puede deshacer desde el panel.`,
    );
    if (!ok) return;
    setMensajeReemplazo(null);
    setEjecutando(true);
    try {
      const call = httpsCallable(functions, 'replaceTeacher');
      await call({ outgoingEmail: salienteEmail, incomingEmail: entranteEmail, dryRun: false });
      setMensajeReemplazo({ tipo: 'ok', texto: 'Reemplazo ejecutado correctamente.' });
      setPrevia(null);
      setSalienteEmail('');
      setEntranteEmail('');
      await recargar();
    } catch (e) {
      setMensajeReemplazo({ tipo: 'error', texto: (e as Error).message });
    } finally {
      setEjecutando(false);
    }
  }

  // ── Auditoría (solo lectura) ────────────────────────────────────────
  async function cargarAuditoria() {
    if (!db) return;
    setCargandoLogs(true);
    try {
      const snap = await getDocs(collection(db, 'auditLogs'));
      const lista: LogAuditoria[] = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<LogAuditoria, 'id'>) }));
      lista.sort((a, b) => {
        const ta = a.executedAt?.toDate?.()?.getTime() ?? 0;
        const tb = b.executedAt?.toDate?.()?.getTime() ?? 0;
        return tb - ta;
      });
      setLogs(lista.slice(0, 50));
    } catch (e) {
      setMensajeReemplazo({ tipo: 'error', texto: (e as Error).message });
    } finally {
      setCargandoLogs(false);
    }
  }

  if (!firebaseConfigurado) {
    return (
      <div className="max-w-md mx-auto">
        <div className="rounded-xl bg-info-soft text-info-soft-fg text-sm px-4 py-4 leading-snug">
          Disponible solo con autenticación Google activa.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-strong text-lg font-semibold">Gestión de usuarios</h2>
        <p className="text-muted text-xs mt-1">
          Alta de docentes, cambio de rol y activación en Firestore.
        </p>
      </div>

      {mensaje && (
        <div
          className={
            'rounded-lg text-xs px-3 py-2 ' +
            (mensaje.tipo === 'ok'
              ? 'bg-success-soft text-success-soft-fg'
              : 'bg-danger-soft text-danger-soft-fg')
          }
        >
          {mensaje.texto}
        </div>
      )}

      {/* ── Formulario de alta ─────────────────────────────────────── */}
      <form onSubmit={handleCrear} className="bg-card rounded-xl p-5 space-y-3 max-w-xl">
        <h3 className="text-strong font-semibold">Nuevo usuario</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <input
            type="email"
            placeholder="correo@iemanueljbetancur.edu.co"
            value={correo}
            onChange={(e) => setCorreo(e.target.value)}
            className="w-full px-3 py-2 rounded-lg bg-elevated border border-line text-strong text-sm placeholder:text-muted focus:outline-none focus:border-line-strong"
          />
          <input
            type="text"
            placeholder="Nombre completo"
            value={nombreNuevo}
            onChange={(e) => setNombreNuevo(e.target.value)}
            className="w-full px-3 py-2 rounded-lg bg-elevated border border-line text-strong text-sm placeholder:text-muted focus:outline-none focus:border-line-strong"
          />
        </div>
        <div className="flex items-center gap-3">
          <select
            value={rolNuevo}
            onChange={(e) => setRolNuevo(e.target.value as RolUsuario)}
            className="px-3 py-2 rounded-lg bg-elevated border border-line text-strong text-sm focus:outline-none focus:border-line-strong"
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {ROL_LABEL[r]}
              </option>
            ))}
          </select>
          <button
            type="submit"
            disabled={creando || !correo || !nombreNuevo}
            className="px-5 py-2 rounded-lg bg-accent text-strong text-sm font-medium hover:opacity-90 transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {creando ? 'Creando…' : 'Crear'}
          </button>
        </div>
        <div>
          <input
            type="text"
            placeholder="Puesto (id interno) — opcional"
            value={slotNuevo}
            onChange={(e) => setSlotNuevo(e.target.value)}
            className="w-full px-3 py-2 rounded-lg bg-elevated border border-line text-strong text-sm placeholder:text-muted focus:outline-none focus:border-line-strong"
          />
          <p className="text-muted text-xs mt-1">
            Dejar vacío si es un docente nuevo sin puesto en el horario.
          </p>
        </div>
      </form>

      {/* Nota de seguridad */}
      <div className="rounded-lg bg-elevated text-muted text-xs px-3 py-2 leading-snug max-w-xl">
        El superusuario no puede cambiarse el propio rol ni desactivarse (regla de seguridad).
      </div>

      {/* ── Tabla de usuarios ──────────────────────────────────────── */}
      {cargando ? (
        <div className="text-center py-10 text-soft">Cargando…</div>
      ) : usuarios.length === 0 ? (
        <div className="text-center py-10 text-muted">No hay usuarios registrados.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="text-left text-muted border-b border-line">
                <th className="py-2 pr-4 font-medium">Nombre</th>
                <th className="py-2 pr-4 font-medium">Correo</th>
                <th className="py-2 pr-4 font-medium">Rol</th>
                <th className="py-2 pr-4 font-medium">Estado</th>
              </tr>
            </thead>
            <tbody>
              {usuarios.map((u) => {
                const esYo = u.email.toLowerCase() === yoEmail;
                return (
                  <tr key={u.email} className="border-b border-line/60">
                    <td className="py-2 pr-4 text-strong">{u.displayName}</td>
                    <td className="py-2 pr-4 text-soft">{u.email}</td>
                    <td className="py-2 pr-4">
                      <select
                        value={u.role}
                        disabled={esYo}
                        onChange={(e) => handleRol(u, e.target.value as RolUsuario)}
                        className="px-2 py-1 rounded-md bg-elevated border border-line text-strong text-xs focus:outline-none focus:border-line-strong disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        {ROLES.map((r) => (
                          <option key={r} value={r}>
                            {ROL_LABEL[r]}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="py-2 pr-4">
                      <div className="flex items-center gap-2">
                        <span
                          className={
                            'text-xs rounded-full px-2 py-0.5 ' +
                            (u.active
                              ? 'bg-success-soft text-success-soft-fg'
                              : 'bg-danger-soft text-danger-soft-fg')
                          }
                        >
                          {u.active ? 'Activo' : 'Inactivo'}
                        </span>
                        <button
                          onClick={() => handleActivo(u, !u.active)}
                          disabled={esYo}
                          className="text-xs px-2 py-1 rounded-md bg-elevated text-soft hover:text-strong transition disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          {u.active ? 'Desactivar' : 'Activar'}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Reemplazar docente ─────────────────────────────────────── */}
      <div className="bg-card rounded-xl p-5 space-y-3 max-w-xl">
        <h3 className="text-strong font-semibold">Reemplazar docente</h3>
        <p className="text-muted text-xs leading-snug">
          Mueve el puesto (horario, aulas, grupos) de un docente saliente a
          uno entrante. El entrante debe existir y estar activo, y no puede
          ocupar ya otro puesto.
        </p>

        {mensajeReemplazo && (
          <div
            className={
              'rounded-lg text-xs px-3 py-2 ' +
              (mensajeReemplazo.tipo === 'ok'
                ? 'bg-success-soft text-success-soft-fg'
                : 'bg-danger-soft text-danger-soft-fg')
            }
          >
            {mensajeReemplazo.texto}
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="text-muted text-xs">Saliente</label>
            <select
              value={salienteEmail}
              onChange={(e) => { setSalienteEmail(e.target.value); setPrevia(null); }}
              className="w-full px-3 py-2 rounded-lg bg-elevated border border-line text-strong text-sm focus:outline-none focus:border-line-strong"
            >
              <option value="">Seleccionar…</option>
              {salientes.map((u) => (
                <option key={u.email} value={u.email}>
                  {u.displayName} ({u.slotId})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-muted text-xs">Entrante</label>
            <select
              value={entranteEmail}
              onChange={(e) => { setEntranteEmail(e.target.value); setPrevia(null); }}
              className="w-full px-3 py-2 rounded-lg bg-elevated border border-line text-strong text-sm focus:outline-none focus:border-line-strong"
            >
              <option value="">Seleccionar…</option>
              {entrantes.map((u) => (
                <option key={u.email} value={u.email}>
                  {u.displayName}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handlePrevisualizar}
            disabled={previendo || !salienteEmail || !entranteEmail}
            className="px-4 py-2 rounded-lg bg-elevated text-strong text-sm font-medium hover:opacity-90 transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {previendo ? 'Previsualizando…' : 'Previsualizar'}
          </button>
          <button
            type="button"
            onClick={handleEjecutarReemplazo}
            disabled={!previa || ejecutando}
            className="px-4 py-2 rounded-lg bg-danger-soft text-danger-soft-fg text-sm font-medium hover:opacity-90 transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {ejecutando ? 'Ejecutando…' : 'Ejecutar reemplazo'}
          </button>
        </div>

        {previa && (
          <div className="rounded-lg bg-elevated text-xs px-3 py-2 space-y-1">
            <p className="text-strong font-medium">Puesto: {previa.slot}</p>
            {previa.changes.map((c, i) => (
              <p key={i} className="text-soft">
                {c.usuario
                  ? `${c.campo} de ${c.usuario} → ${String(c.a)}`
                  : `${c.campo}: ${c.de} → ${c.a}${c.valor ? ` (${c.valor})` : ''}`}
              </p>
            ))}
          </div>
        )}
      </div>

      {/* ── Auditoría ───────────────────────────────────────────────── */}
      <div className="bg-card rounded-xl p-5 space-y-3 max-w-2xl">
        <div className="flex items-center justify-between">
          <h3 className="text-strong font-semibold">Auditoría</h3>
          <button
            type="button"
            onClick={cargarAuditoria}
            disabled={cargandoLogs}
            className="text-xs px-3 py-1.5 rounded-md bg-elevated text-soft hover:text-strong transition disabled:opacity-40"
          >
            {cargandoLogs ? 'Cargando…' : 'Ver auditoría'}
          </button>
        </div>
        {logs && (
          logs.length === 0 ? (
            <p className="text-muted text-xs">Sin registros.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="text-left text-muted border-b border-line">
                    <th className="py-2 pr-3 font-medium">Fecha</th>
                    <th className="py-2 pr-3 font-medium">Ejecutado por</th>
                    <th className="py-2 pr-3 font-medium">Saliente → Entrante</th>
                    <th className="py-2 pr-3 font-medium">Dry run</th>
                    <th className="py-2 pr-3 font-medium">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((l) => (
                    <tr key={l.id} className="border-b border-line/60">
                      <td className="py-2 pr-3 text-soft">
                        {l.executedAt?.toDate?.()?.toLocaleString('es-CO') ?? '—'}
                      </td>
                      <td className="py-2 pr-3 text-soft">{l.executedBy}</td>
                      <td className="py-2 pr-3 text-soft">
                        {l.outgoingEmail} → {l.incomingEmail}
                      </td>
                      <td className="py-2 pr-3 text-soft">{l.dryRun ? 'Sí' : 'No'}</td>
                      <td className="py-2 pr-3">
                        <span
                          className={
                            'text-xs rounded-full px-2 py-0.5 ' +
                            (l.status === 'ok'
                              ? 'bg-success-soft text-success-soft-fg'
                              : 'bg-danger-soft text-danger-soft-fg')
                          }
                        >
                          {l.status ?? '—'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}
      </div>
    </div>
  );
}
