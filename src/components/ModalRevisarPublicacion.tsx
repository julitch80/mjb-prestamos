import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useAppStore } from '../data/store';
import { publicarAviso } from '../data/api';
import { htmlEfectivo } from '../data/publicacion';
import type { PublicacionPendiente } from '../data/publicacion';
import { formatearFechaLegible } from '../data/horarioModificado';
import { cn } from '@/lib/utils';

interface Props {
  publicacion: PublicacionPendiente | null;
  onClose: () => void;
}

type Pestana = 'previa' | 'editar';

export default function ModalRevisarPublicacion({ publicacion, onClose }: Props) {
  const { actualizarPublicacionPendiente } = useAppStore();
  const [pestana, setPestana] = useState<Pestana>('previa');
  const [htmlBorrador, setHtmlBorrador] = useState('');
  const [publicando, setPublicando] = useState(false);
  const [resultado, setResultado] = useState<{ ok: boolean; mensaje: string; url?: string } | null>(null);
  const [confirmDescartar, setConfirmDescartar] = useState(false);

  useEffect(() => {
    if (publicacion) {
      setHtmlBorrador(htmlEfectivo(publicacion));
      setPestana('previa');
      setResultado(null);
      setConfirmDescartar(false);
    }
  }, [publicacion]);

  if (!publicacion) return <AnimatePresence>{null}</AnimatePresence>;

  const huboEdicion = htmlBorrador !== publicacion.htmlOriginal;

  async function aprobarYPublicar() {
    if (!publicacion) return;
    setPublicando(true);
    setResultado(null);
    try {
      const res = await publicarAviso(
        publicacion.fecha,
        publicacion.jornada,
        publicacion.tipo,
        publicacion.titulo,
        htmlBorrador,
        publicacion.autor,
      );
      if (res.ok) {
        actualizarPublicacionPendiente(publicacion.id, {
          estado: 'aprobada_publicada',
          htmlEditado: huboEdicion ? htmlBorrador : undefined,
          timestampPublicacion: new Date().toISOString(),
        });
        setResultado({
          ok: true,
          mensaje: 'Publicado correctamente en la página del colegio.',
          url: res.url,
        });
      } else {
        setResultado({
          ok: false,
          mensaje: res.error ?? 'No se pudo publicar. Revisa la conexión y vuelve a intentar.',
        });
      }
    } catch {
      setResultado({
        ok: false,
        mensaje: 'Error de red al contactar el servidor. Vuelve a intentar.',
      });
    } finally {
      setPublicando(false);
    }
  }

  function descartar() {
    if (!publicacion) return;
    actualizarPublicacionPendiente(publicacion.id, { estado: 'descartada' });
    onClose();
  }

  function guardarBorradorYCerrar() {
    if (!publicacion) return;
    if (huboEdicion) {
      actualizarPublicacionPendiente(publicacion.id, {
        htmlEditado: htmlBorrador,
      });
    }
    onClose();
  }

  return (
    <AnimatePresence>
      {publicacion && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/45 dark:bg-black/75 backdrop-blur-sm p-3 sm:p-6"
          onClick={guardarBorradorYCerrar}
        >
          <motion.div
            initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 30, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 320, damping: 30 }}
            className="w-full max-w-3xl bg-card border border-line rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-6 pt-5 pb-4 border-b border-line">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="text-strong font-semibold text-base flex items-center gap-2">
                    <span className="text-info">📄</span> Revisar publicación para la web
                  </h2>
                  <p className="text-xs text-muted mt-0.5">
                    {publicacion.titulo} · Jornada {publicacion.jornada === 'manana' ? 'mañana' : 'tarde'}
                  </p>
                </div>
                <button
                  onClick={guardarBorradorYCerrar}
                  className="text-muted hover:text-strong transition text-lg leading-none p-1 flex-shrink-0"
                  aria-label="Cerrar"
                >✕</button>
              </div>

              <div className="mt-3 text-[11px] text-muted bg-info-soft border border-info text-info-soft-fg rounded-lg px-3 py-2">
                <strong>Antes de publicar:</strong> revisa que el contenido sea correcto. Puedes editarlo
                en la pestaña <em>Editar HTML</em>. Una vez aprobada, la publicación queda visible en la
                página del colegio.
              </div>
            </div>

            {/* Pestañas */}
            <div className="px-6 pt-3 border-b border-line flex gap-1">
              {(['previa', 'editar'] as Pestana[]).map(p => (
                <button
                  key={p}
                  onClick={() => setPestana(p)}
                  className={cn(
                    'px-4 py-2 rounded-t-lg text-sm font-medium transition',
                    pestana === p
                      ? 'bg-elevated text-strong border-x border-t border-line'
                      : 'text-muted hover:text-strong'
                  )}
                >
                  {p === 'previa' ? 'Vista previa' : 'Editar HTML'}
                </button>
              ))}
              {huboEdicion && (
                <span className="ml-2 self-center text-[11px] text-warning-soft-fg bg-warning-soft border border-warning rounded-full px-2 py-0.5">
                  con cambios
                </span>
              )}
            </div>

            {/* Contenido */}
            <div className="flex-1 overflow-y-auto px-6 py-5">
              {pestana === 'previa' ? (
                <div
                  className="bg-white rounded-xl border border-line p-4 text-gray-900"
                  dangerouslySetInnerHTML={{ __html: htmlBorrador }}
                />
              ) : (
                <div className="space-y-2">
                  <label className="block text-xs text-soft">
                    HTML que se publicará. Puedes ajustar textos, agregar o quitar contenido.
                  </label>
                  <textarea
                    value={htmlBorrador}
                    onChange={e => setHtmlBorrador(e.target.value)}
                    className="w-full h-72 sm:h-96 bg-elevated border border-line rounded-xl px-3 py-2 text-xs font-mono text-strong focus:outline-none focus:border-info resize-none"
                    spellCheck={false}
                  />
                  <div className="flex justify-between items-center text-[11px] text-muted">
                    <button
                      onClick={() => setHtmlBorrador(publicacion.htmlOriginal)}
                      className="hover:text-info underline"
                    >
                      ↺ Restaurar HTML original generado
                    </button>
                    <span>{htmlBorrador.length} caracteres</span>
                  </div>
                </div>
              )}

              {/* Resultado de la publicación */}
              {resultado && (
                <div className={cn(
                  'mt-4 rounded-xl border px-3 py-2 text-xs',
                  resultado.ok
                    ? 'bg-success-soft border-success text-success-soft-fg'
                    : 'bg-danger-soft border-danger text-danger-soft-fg'
                )}>
                  {resultado.ok ? '✓ ' : '⛔ '}{resultado.mensaje}
                  {resultado.url && (
                    <>
                      {' '}
                      <a href={resultado.url} target="_blank" rel="noopener noreferrer" className="underline">
                        Ver en la web →
                      </a>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-line bg-card flex flex-wrap justify-between gap-2">
              <div className="flex gap-2">
                <button
                  onClick={() => setConfirmDescartar(true)}
                  className="px-3 py-2 rounded-xl bg-elevated hover:bg-hover text-soft text-xs transition"
                >
                  Descartar publicación
                </button>
                <button
                  onClick={guardarBorradorYCerrar}
                  className="px-3 py-2 rounded-xl bg-elevated hover:bg-hover text-soft text-xs transition"
                >
                  Revisar después
                </button>
              </div>

              {resultado?.ok ? (
                <button
                  onClick={onClose}
                  className="px-5 py-2 rounded-xl bg-accent hover:bg-accent/85 text-accent-fg text-sm font-semibold transition"
                >
                  Cerrar
                </button>
              ) : (
                <button
                  onClick={aprobarYPublicar}
                  disabled={publicando}
                  className={cn(
                    'px-5 py-2 rounded-xl text-accent-fg text-sm font-semibold transition flex items-center gap-2',
                    publicando ? 'bg-accent/60 cursor-not-allowed' : 'bg-accent hover:bg-accent/85'
                  )}
                >
                  {publicando ? (
                    <>
                      <span className="w-3 h-3 border-2 border-accent-fg border-t-transparent rounded-full animate-spin" />
                      Publicando…
                    </>
                  ) : (
                    <>✓ Aprobar y publicar</>
                  )}
                </button>
              )}
            </div>
          </motion.div>

          {/* Confirmación de descarte */}
          <AnimatePresence>
            {confirmDescartar && (
              <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
                onClick={() => setConfirmDescartar(false)}
              >
                <motion.div
                  initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
                  className="w-full max-w-sm bg-card border border-line rounded-2xl p-5 space-y-3"
                  onClick={e => e.stopPropagation()}
                >
                  <h3 className="text-strong font-semibold">¿Descartar la publicación?</h3>
                  <p className="text-muted text-sm">
                    El aviso no aparecerá en la página del colegio. Esta acción no afecta el horario
                    modificado, solo cancela su difusión web.
                  </p>
                  <div className="flex gap-2 justify-end">
                    <button
                      onClick={() => setConfirmDescartar(false)}
                      className="px-3 py-2 rounded-xl bg-elevated hover:bg-hover text-soft text-sm transition"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={() => { setConfirmDescartar(false); descartar(); }}
                      className="px-4 py-2 rounded-xl bg-danger hover:bg-danger/85 text-white text-sm font-semibold transition"
                    >
                      Descartar
                    </button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
