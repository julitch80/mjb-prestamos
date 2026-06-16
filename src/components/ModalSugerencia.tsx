import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useAppStore } from '../data/store';
import { crearSugerencia } from '../data/api';

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function ModalSugerencia({ open, onClose }: Props) {
  const { userId, nombre } = useAppStore();
  const [texto, setTexto]   = useState('');
  const [cargando, setCargando] = useState(false);
  const [mensaje, setMensaje]   = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null);

  if (!open) return null;

  async function handleEnviar() {
    if (texto.trim().length < 5) {
      setMensaje({ tipo: 'error', texto: 'Escribe un poco más para entender tu sugerencia.' });
      return;
    }
    setCargando(true);
    setMensaje(null);
    try {
      const res = await crearSugerencia(userId || nombre || 'anónimo', texto.trim());
      if (res.ok) {
        setMensaje({ tipo: 'ok', texto: '¡Gracias! Tu sugerencia quedó registrada.' });
        setTexto('');
        setTimeout(onClose, 1500);
      } else {
        setMensaje({ tipo: 'error', texto: res.error ?? 'No se pudo enviar la sugerencia.' });
      }
    } catch {
      setMensaje({ tipo: 'error', texto: 'Error de comunicación con el servidor.' });
    } finally {
      setCargando(false);
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/45 dark:bg-black/75 backdrop-blur-sm p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <motion.div
            className="w-full max-w-md bg-card rounded-2xl border border-line shadow-2xl overflow-hidden"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-line">
              <h3 className="text-strong font-semibold">💡 Enviar sugerencia</h3>
              <button
                onClick={onClose}
                className="text-muted hover:text-strong transition text-lg leading-none"
              >
                ✕
              </button>
            </div>

            {/* Cuerpo */}
            <div className="px-6 py-5 space-y-4">
              <p className="text-sm text-muted">
                Cuéntanos qué mejorarías de la app. Lo leeremos cuando podamos — no es soporte urgente.
              </p>

              <textarea
                rows={4}
                placeholder="Escribe tu sugerencia…"
                value={texto}
                onChange={e => setTexto(e.target.value)}
                disabled={cargando}
                className="w-full bg-elevated text-strong rounded-xl px-3 py-2.5 text-sm border border-line focus:outline-none focus:border-accent transition resize-none placeholder:text-muted disabled:opacity-60"
              />

              {mensaje && (
                <p className={
                  mensaje.tipo === 'ok'
                    ? 'text-success text-xs bg-success-soft border border-success rounded-lg px-3 py-2'
                    : 'text-danger text-xs bg-danger-soft border border-danger rounded-lg px-3 py-2'
                }>
                  {mensaje.texto}
                </p>
              )}

              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 py-3 rounded-xl bg-elevated text-soft hover:bg-hover text-sm transition font-medium"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleEnviar}
                  disabled={cargando || texto.trim().length === 0}
                  className="flex-1 py-3 rounded-xl bg-accent hover:bg-accent/85 disabled:opacity-40 text-strong font-semibold text-sm transition"
                >
                  {cargando ? 'Enviando...' : 'Enviar'}
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
