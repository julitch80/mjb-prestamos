import { useEffect, useState } from 'react';
import { useAppStore } from '../data/store';
import { firebaseConfigurado } from '../lib/firebase';
import {
  listarUsuarios,
  crearDocente,
  cambiarRol,
  setActivo,
  type UsuarioFirestore,
  type RolUsuario,
} from '../data/adminUsers';

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
  const [creando, setCreando] = useState(false);

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
      await crearDocente(correo, nombreNuevo, rolNuevo, creadoPor);
      setMensaje({ tipo: 'ok', texto: 'Usuario creado correctamente.' });
      setCorreo('');
      setNombreNuevo('');
      setRolNuevo('docente');
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
    </div>
  );
}
