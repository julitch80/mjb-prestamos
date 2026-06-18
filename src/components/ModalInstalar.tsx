import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  detectarPlataforma,
  puedeInstalarNativo,
  instalarNativo,
  suscribir,
  yaInstalada,
  type Plataforma,
} from '../data/installPrompt';

interface Props {
  open: boolean;
  onClose: () => void;
}

const TABS: { id: Plataforma; label: string }[] = [
  { id: 'android', label: '🤖 Android' },
  { id: 'ios',     label: '🍎 iPhone/iPad' },
  { id: 'pc',      label: '💻 Computador' },
];

export default function ModalInstalar({ open, onClose }: Props) {
  const [plataforma, setPlataforma] = useState<Plataforma>(detectarPlataforma);
  // Fuerza re-render cuando cambia la disponibilidad del botón nativo
  const [, setTick] = useState(0);

  useEffect(() => {
    const unsub = suscribir(() => setTick(t => t + 1));
    return unsub;
  }, []);

  if (!open) return null;

  const instalada = yaInstalada();
  const nativo = puedeInstalarNativo();

  async function handleInstalar() {
    const resultado = await instalarNativo();
    if (resultado === 'accepted') onClose();
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
          onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
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
              <h3 className="text-strong font-semibold">📲 Instalar la app</h3>
              <button
                onClick={onClose}
                className="text-muted hover:text-strong transition text-lg leading-none"
              >
                ✕
              </button>
            </div>

            {/* Cuerpo */}
            <div className="px-6 py-5 space-y-5">
              {instalada ? (
                /* Ya está instalada */
                <div className="text-center py-4 space-y-3">
                  <p className="text-4xl">🎉</p>
                  <p className="text-strong font-semibold">¡Ya tienes la app instalada en este dispositivo!</p>
                  <p className="text-sm text-muted">Puedes abrirla directamente desde tu pantalla de inicio.</p>
                </div>
              ) : (
                <>
                  {/* Selector de plataforma */}
                  <div className="flex gap-1.5 p-1 bg-elevated rounded-xl border border-line">
                    {TABS.map(tab => (
                      <button
                        key={tab.id}
                        onClick={() => setPlataforma(tab.id)}
                        className={`flex-1 py-2 px-1 rounded-lg text-xs font-medium transition-all ${
                          plataforma === tab.id
                            ? 'bg-accent text-strong shadow-sm'
                            : 'text-muted hover:text-soft'
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>

                  {/* Instrucciones según plataforma */}
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={plataforma}
                      initial={{ opacity: 0, x: 10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -10 }}
                      transition={{ duration: 0.18 }}
                    >
                      {(plataforma === 'android' || plataforma === 'pc') && (
                        <div className="space-y-3">
                          {nativo ? (
                            <button
                              onClick={handleInstalar}
                              className="w-full py-3 rounded-xl bg-accent hover:bg-accent/85 text-strong font-semibold text-sm transition"
                            >
                              ⬇️ Instalar ahora
                            </button>
                          ) : (
                            <div className="rounded-xl bg-elevated border border-line px-4 py-3 text-sm text-soft">
                              {plataforma === 'android'
                                ? <>Abre el menú <span className="font-semibold">⋮</span> de Chrome y toca <span className="font-semibold">"Instalar app"</span> (o <span className="font-semibold">"Agregar a pantalla de inicio"</span>).</>
                                : <>Haz clic en el ícono de instalar <span className="font-semibold">⊕</span> en la barra de direcciones, o menú <span className="font-semibold">⋮</span> → <span className="font-semibold">"Instalar MJB Préstamos"</span>.</>
                              }
                            </div>
                          )}
                        </div>
                      )}

                      {plataforma === 'ios' && (
                        <div className="space-y-3">
                          <div className="rounded-xl bg-elevated border border-line px-4 py-3 space-y-2">
                            <ol className="text-sm text-soft space-y-2 list-none">
                              <li className="flex gap-2"><span className="text-accent font-bold flex-shrink-0">1.</span> Abre esta página en <span className="font-semibold text-strong">Safari</span> (no Chrome ni otro navegador).</li>
                              <li className="flex gap-2"><span className="text-accent font-bold flex-shrink-0">2.</span> Toca el botón <span className="font-semibold text-strong">Compartir</span> — el cuadro con flecha hacia arriba (⬆) en la barra inferior.</li>
                              <li className="flex gap-2"><span className="text-accent font-bold flex-shrink-0">3.</span> Desliza hacia abajo y toca <span className="font-semibold text-strong">"Agregar a inicio"</span>.</li>
                              <li className="flex gap-2"><span className="text-accent font-bold flex-shrink-0">4.</span> Toca <span className="font-semibold text-strong">"Agregar"</span> en la esquina superior derecha.</li>
                            </ol>
                          </div>
                          <p className="text-xs text-muted px-1">
                            ℹ️ En iPhone y iPad la instalación solo funciona desde Safari.
                          </p>
                        </div>
                      )}
                    </motion.div>
                  </AnimatePresence>

                  {/* QR — siempre visible */}
                  <div className="rounded-xl bg-elevated border border-line px-4 py-4 flex flex-col sm:flex-row items-center gap-4">
                    <img
                      src={`${import.meta.env.BASE_URL}qr-instalar.svg`}
                      alt="QR para abrir MJB Préstamos"
                      width={160}
                      height={160}
                      className="flex-shrink-0 rounded-lg"
                    />
                    <div className="space-y-1.5 text-center sm:text-left">
                      <p className="text-sm text-soft">
                        ¿Estás en el computador? Escanea este código con la cámara de tu celular para abrir la app e instalarla allí.
                      </p>
                      <a
                        href="https://julitch80.github.io/mjb-prestamos/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-accent hover:underline break-all"
                      >
                        julitch80.github.io/mjb-prestamos/
                      </a>
                    </div>
                  </div>
                </>
              )}

              {/* Botón cerrar */}
              <button
                onClick={onClose}
                className="w-full py-3 rounded-xl bg-elevated text-soft hover:bg-hover text-sm transition font-medium"
              >
                Cerrar
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
