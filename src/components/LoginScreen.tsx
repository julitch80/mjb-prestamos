import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Search, Lock, ArrowLeft, Mail, ChevronRight } from 'lucide-react';
import { useAppStore } from '../data/store';
import { recuperarPin } from '../data/api';
import { USUARIOS } from '../data/maestros';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { MODO_LOCAL } from '../data/config';
import ModalInstalar from './ModalInstalar';

const normalizar = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

const ROL_LABEL: Record<string, string> = {
  rectora:     'Rectora',
  coordinador: 'Coordinador',
  docente:     'Docente',
};

export default function LoginScreen() {
  const setUsuario = useAppStore((s) => s.setUsuario);

  const [busqueda, setBusqueda]               = useState('');
  const [usuarioSeleccionado, setUsuarioSel]  = useState<string | null>(null);
  const [pin, setPin]                         = useState('');
  const [cargando, setCargando]               = useState(false);
  const [error, setError]                     = useState('');
  const [modoRecup, setModoRecup]             = useState(false);
  const [correoRecup, setCorreoRecup]         = useState('');
  const [mensajeRecup, setMensajeRecup]       = useState('');
  const [instalarOpen, setInstalarOpen]       = useState(false);
  const pinRef = useRef<HTMLInputElement>(null);

  const usuariosFiltrados = busqueda.length >= 2
    ? USUARIOS.filter(u =>
        normalizar(u.nombre).includes(normalizar(busqueda)) ||
        normalizar(u.nombreCorto).includes(normalizar(busqueda))
      )
    : [];

  const usuarioActual = USUARIOS.find(u => u.id === usuarioSeleccionado);

  function seleccionarUsuario(id: string) {
    setUsuarioSel(id);
    setBusqueda('');
    setError('');
    setTimeout(() => pinRef.current?.focus(), 150);
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!usuarioSeleccionado) return;
    setCargando(true);
    setError('');

    if (MODO_LOCAL) {
      const u = USUARIOS.find(u => u.id === usuarioSeleccionado);
      if (u && (u.pin === '' || u.pin === pin || pin === '')) {
        setUsuario(u.id, u.nombre, u.rol, u.jornada === 'ambas' ? 'manana' : u.jornada);
      } else if (u) {
        setError('PIN incorrecto');
      }
      setCargando(false);
      return;
    }

    try {
      const { login } = await import('../data/api');
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
      setMensajeRecup(res.ok
        ? 'Se envió un PIN temporal a tu correo institucional.'
        : (res.error ?? 'Correo no encontrado.')
      );
    } catch {
      setMensajeRecup('Error de conexión.');
    } finally {
      setCargando(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-app px-4 relative overflow-hidden">

      {/* Fondo con gradiente animado — sutil en claro, intenso en oscuro */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full bg-info/15 dark:bg-blue-900/20 blur-[120px]" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] rounded-full bg-green-400/10 dark:bg-green-900/15 blur-[120px]" />
        <div className="absolute top-[40%] left-[60%] w-[300px] h-[300px] rounded-full bg-red-400/8 dark:bg-red-900/10 blur-[80px]" />
      </div>

      <AnimatePresence mode="wait">
        {modoRecup ? (
          /* ── Recuperación de PIN ── */
          <motion.div
            key="recup"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -24 }}
            transition={{ duration: 0.3 }}
            className="w-full max-w-sm relative z-10"
          >
            <div className="rounded-2xl border border-line bg-card backdrop-blur-xl shadow-2xl p-8">
              <button
                onClick={() => { setModoRecup(false); setMensajeRecup(''); }}
                className="flex items-center gap-1.5 text-xs text-muted hover:text-soft transition mb-6"
              >
                <ArrowLeft size={14} /> Volver al inicio de sesión
              </button>

              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-accent/20 border border-accent/30 flex items-center justify-center">
                  <Mail size={18} className="text-info" />
                </div>
                <div>
                  <h2 className="text-strong font-semibold">Recuperar PIN</h2>
                  <p className="text-xs text-muted">Te enviaremos un PIN temporal</p>
                </div>
              </div>

              {mensajeRecup ? (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="rounded-xl bg-success/15 border border-green-500/30 p-4 text-sm text-success-soft-fg"
                >
                  {mensajeRecup}
                </motion.div>
              ) : (
                <form onSubmit={handleRecuperacion} className="space-y-4">
                  <Input
                    type="email"
                    placeholder="Correo institucional"
                    value={correoRecup}
                    onChange={e => setCorreoRecup(e.target.value)}
                    required
                    autoFocus
                  />
                  <Button type="submit" disabled={cargando} className="w-full" size="lg">
                    {cargando ? 'Enviando...' : 'Enviar PIN temporal'}
                  </Button>
                </form>
              )}
            </div>
          </motion.div>
        ) : (
          /* ── Login principal ── */
          <motion.div
            key="login"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -24 }}
            transition={{ duration: 0.35 }}
            className="w-full max-w-sm relative z-10"
          >
            {/* Escudo */}
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="flex flex-col items-center mb-8"
            >
              <div className="relative">
                <div className="absolute inset-0 rounded-full bg-accent/20 blur-2xl scale-150" />
                <img
                  src="/mjb-prestamos/mjb_escudo.png"
                  alt="Escudo MJB"
                  className="relative w-36 h-36 object-contain drop-shadow-2xl"
                  style={{ mixBlendMode: 'lighten' }}
                />
              </div>
              <h1 className="mt-4 text-xl font-bold text-strong tracking-wide text-center">
                I.E. Manuel J. Betancur
              </h1>
              <p className="text-sm text-muted mt-1">Sistema de préstamo de recursos</p>
            </motion.div>

            {/* Card principal */}
            <div className="rounded-2xl border border-line bg-card backdrop-blur-xl shadow-2xl overflow-hidden">
              <AnimatePresence mode="wait">
                {!usuarioSeleccionado ? (
                  /* Paso 1: buscar usuario */
                  <motion.div
                    key="buscar"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    transition={{ duration: 0.25 }}
                    className="p-6"
                  >
                    <p className="text-xs text-muted uppercase tracking-widest mb-3 font-medium">
                      ¿Quién eres?
                    </p>

                    <div className="relative">
                      <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
                      <Input
                        type="text"
                        placeholder="Escribe tu nombre..."
                        value={busqueda}
                        onChange={e => setBusqueda(e.target.value)}
                        className="pl-10"
                        autoFocus
                      />
                    </div>

                    <AnimatePresence>
                      {usuariosFiltrados.length > 0 && (
                        <motion.ul
                          initial={{ opacity: 0, y: -8 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -8 }}
                          className="mt-2 rounded-xl border border-line bg-card/80 backdrop-blur overflow-hidden divide-y divide-line"
                        >
                          {usuariosFiltrados.map((u, i) => (
                            <motion.li
                              key={u.id}
                              initial={{ opacity: 0, x: -10 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: i * 0.04 }}
                            >
                              <button
                                onClick={() => seleccionarUsuario(u.id)}
                                className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-elevated transition-colors group"
                              >
                                <span
                                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                                  style={{ backgroundColor: u.color }}
                                />
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm text-strong font-medium truncate">{u.nombre}</p>
                                  <p className="text-xs text-muted">{ROL_LABEL[u.rol]}</p>
                                </div>
                                <ChevronRight size={14} className="text-muted group-hover:text-soft transition flex-shrink-0" />
                              </button>
                            </motion.li>
                          ))}
                        </motion.ul>
                      )}
                      {busqueda.length >= 2 && usuariosFiltrados.length === 0 && (
                        <motion.p
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className="mt-3 text-xs text-muted text-center"
                        >
                          No se encontró ningún usuario
                        </motion.p>
                      )}
                    </AnimatePresence>
                  </motion.div>
                ) : (
                  /* Paso 2: ingresar PIN */
                  <motion.div
                    key="pin"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.25 }}
                    className="p-6"
                  >
                    {/* Usuario seleccionado */}
                    <div className="flex items-center gap-3 mb-6 p-3 rounded-xl bg-card border border-line">
                      <span
                        className="w-3 h-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: usuarioActual?.color }}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-strong font-medium truncate">{usuarioActual?.nombre}</p>
                        <p className="text-xs text-muted">{ROL_LABEL[usuarioActual?.rol ?? '']}</p>
                      </div>
                      <button
                        onClick={() => { setUsuarioSel(null); setPin(''); setError(''); }}
                        className="text-xs text-muted hover:text-soft transition flex-shrink-0"
                      >
                        Cambiar
                      </button>
                    </div>

                    <form onSubmit={handleLogin} className="space-y-4">
                      <div className="relative">
                        <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
                        <Input
                          ref={pinRef}
                          type="password"
                          inputMode="numeric"
                          placeholder="PIN"
                          value={pin}
                          onChange={e => setPin(e.target.value)}
                          maxLength={8}
                          className="pl-10 tracking-widest text-center text-lg font-mono"
                        />
                      </div>

                      <AnimatePresence>
                        {error && (
                          <motion.p
                            initial={{ opacity: 0, y: -4 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0 }}
                            className="text-danger text-xs text-center"
                          >
                            {error}
                          </motion.p>
                        )}
                      </AnimatePresence>

                      <Button
                        type="submit"
                        disabled={cargando || (!pin && !MODO_LOCAL)}
                        className="w-full"
                        size="lg"
                      >
                        {cargando ? (
                          <span className="flex items-center gap-2">
                            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            Verificando...
                          </span>
                        ) : 'Entrar'}
                      </Button>
                    </form>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Footer */}
              <div className="px-6 pb-5 text-center space-y-2">
                <button
                  onClick={() => setModoRecup(true)}
                  className="text-xs text-muted hover:text-soft transition block w-full"
                >
                  ¿Olvidaste tu PIN?
                </button>
                <button
                  onClick={() => setInstalarOpen(true)}
                  className="text-xs text-muted hover:text-soft transition block w-full"
                >
                  📲 ¿Cómo instalar la app?
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <ModalInstalar open={instalarOpen} onClose={() => setInstalarOpen(false)} />
    </div>
  );
}
