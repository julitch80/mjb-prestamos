import { useState, useRef } from 'react';
import { useAppStore } from '../data/store';
import { login, recuperarPin } from '../data/api';
import { USUARIOS } from '../data/maestros';

export default function LoginScreen() {
  const setUsuario = useAppStore((s) => s.setUsuario);

  const [busqueda, setBusqueda] = useState('');
  const [usuarioSeleccionado, setUsuarioSeleccionado] = useState<string | null>(null);
  const [pin, setPin] = useState('');
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  const [modoRecuperacion, setModoRecuperacion] = useState(false);
  const [correoRecup, setCorreoRecup] = useState('');
  const [mensajeRecup, setMensajeRecup] = useState('');
  const pinRef = useRef<HTMLInputElement>(null);

  const usuariosFiltrados = busqueda.length >= 2
    ? USUARIOS.filter(u =>
        u.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
        u.nombreCorto.toLowerCase().includes(busqueda.toLowerCase())
      )
    : [];

  const usuarioActual = USUARIOS.find(u => u.id === usuarioSeleccionado);

  function seleccionarUsuario(id: string) {
    setUsuarioSeleccionado(id);
    setBusqueda('');
    setError('');
    setTimeout(() => pinRef.current?.focus(), 100);
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!usuarioSeleccionado || !pin) return;
    setCargando(true);
    setError('');
    try {
      const res = await login(usuarioSeleccionado, pin);
      if (res.ok && res.userId && res.nombre && res.rol && res.jornada) {
        setUsuario(res.userId, res.nombre, res.rol, res.jornada);
      } else {
        setError(res.error ?? 'PIN incorrecto');
      }
    } catch {
      setError('Error de conexión. Verifica tu internet.');
    } finally {
      setCargando(false);
    }
  }

  async function handleRecuperacion(e: React.FormEvent) {
    e.preventDefault();
    if (!correoRecup) return;
    setCargando(true);
    try {
      const res = await recuperarPin(correoRecup);
      if (res.ok) {
        setMensajeRecup('Se envió un PIN temporal a tu correo institucional.');
      } else {
        setMensajeRecup(res.error ?? 'Correo no encontrado.');
      }
    } catch {
      setMensajeRecup('Error de conexión.');
    } finally {
      setCargando(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-950 px-4">
      {/* Escudo */}
      <div className="mb-6 flex flex-col items-center">
        <img
          src="/mjb-prestamos/mjb_icon.png"
          alt="Escudo MJB"
          className="w-36 h-36 object-contain drop-shadow-lg"
        />
        <h1 className="mt-3 text-xl font-bold text-white tracking-wide text-center">
          I.E. Manuel J. Betancur
        </h1>
        <p className="text-sm text-gray-400 mt-1">Sistema de préstamo de recursos</p>
      </div>

      {modoRecuperacion ? (
        /* ── Recuperación de PIN ── */
        <div className="w-full max-w-sm bg-gray-900 rounded-2xl p-6 shadow-xl border border-gray-800">
          <h2 className="text-white font-semibold mb-4">Recuperar PIN</h2>
          {mensajeRecup ? (
            <div className="text-green-400 text-sm mb-4">{mensajeRecup}</div>
          ) : (
            <form onSubmit={handleRecuperacion} className="space-y-4">
              <input
                type="email"
                placeholder="Correo institucional"
                value={correoRecup}
                onChange={e => setCorreoRecup(e.target.value)}
                className="w-full bg-gray-800 text-white rounded-lg px-4 py-3 text-sm border border-gray-700 focus:outline-none focus:border-blue-500"
                required
              />
              <button
                type="submit"
                disabled={cargando}
                className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-medium rounded-lg py-3 text-sm transition"
              >
                {cargando ? 'Enviando...' : 'Enviar PIN temporal'}
              </button>
            </form>
          )}
          <button
            onClick={() => { setModoRecuperacion(false); setMensajeRecup(''); }}
            className="mt-4 text-xs text-gray-500 hover:text-gray-300 transition"
          >
            ← Volver al login
          </button>
        </div>
      ) : (
        /* ── Login principal ── */
        <div className="w-full max-w-sm bg-gray-900 rounded-2xl p-6 shadow-xl border border-gray-800">
          {!usuarioSeleccionado ? (
            /* Paso 1: buscar usuario */
            <div>
              <label className="block text-sm text-gray-400 mb-2">¿Quién eres?</label>
              <input
                type="text"
                placeholder="Escribe tu nombre..."
                value={busqueda}
                onChange={e => setBusqueda(e.target.value)}
                className="w-full bg-gray-800 text-white rounded-lg px-4 py-3 text-sm border border-gray-700 focus:outline-none focus:border-blue-500"
                autoFocus
              />
              {usuariosFiltrados.length > 0 && (
                <ul className="mt-2 bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
                  {usuariosFiltrados.map(u => (
                    <li key={u.id}>
                      <button
                        onClick={() => seleccionarUsuario(u.id)}
                        className="w-full text-left px-4 py-3 text-sm text-white hover:bg-gray-700 transition flex items-center gap-3"
                      >
                        <span
                          className="w-2 h-2 rounded-full flex-shrink-0"
                          style={{ backgroundColor: u.color }}
                        />
                        <span>{u.nombre}</span>
                        <span className="ml-auto text-xs text-gray-500 capitalize">{u.rol}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {busqueda.length >= 2 && usuariosFiltrados.length === 0 && (
                <p className="mt-2 text-xs text-gray-500">No se encontró ningún usuario.</p>
              )}
            </div>
          ) : (
            /* Paso 2: ingresar PIN */
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="flex items-center gap-3 mb-2">
                <span
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: usuarioActual?.color }}
                />
                <span className="text-white font-medium text-sm">{usuarioActual?.nombre}</span>
                <button
                  type="button"
                  onClick={() => { setUsuarioSeleccionado(null); setPin(''); setError(''); }}
                  className="ml-auto text-xs text-gray-500 hover:text-gray-300 transition"
                >
                  Cambiar
                </button>
              </div>

              <input
                ref={pinRef}
                type="password"
                inputMode="numeric"
                placeholder="PIN"
                value={pin}
                onChange={e => setPin(e.target.value)}
                maxLength={8}
                className="w-full bg-gray-800 text-white rounded-lg px-4 py-3 text-sm border border-gray-700 focus:outline-none focus:border-blue-500 tracking-widest text-center text-lg"
                required
              />

              {error && (
                <p className="text-red-400 text-xs text-center">{error}</p>
              )}

              <button
                type="submit"
                disabled={cargando || !pin}
                className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold rounded-lg py-3 text-sm transition"
              >
                {cargando ? 'Verificando...' : 'Entrar'}
              </button>
            </form>
          )}

          <div className="mt-4 text-center">
            <button
              onClick={() => setModoRecuperacion(true)}
              className="text-xs text-gray-500 hover:text-gray-300 transition"
            >
              ¿Olvidaste tu PIN?
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
