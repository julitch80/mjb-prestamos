// Panel «Editar» de acompañamientos (tareas 4.1/4.2): modal a pantalla
// completa en el celular, panel ancho en escritorio — mismo patrón que
// EditorHorarioWizard. Menú de cuatro opciones + Historial (deshabilitado).
// Solo Zonas y Carga por profesor funcionan en esta mitad del trabajo;
// Generar alternativas y Editar a mano quedan «Próximamente» (los construye
// la siguiente tarea, ver TAREAS.md § C).

import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/lib/utils';
import type { Distribucion, JornadaAcomp, Publicacion } from '../../data/acompanamientos/tipos';
import { revisar } from '../../data/acompanamientos/revision';
import type { AvisoDocente } from '../../data/acompanamientos/avisos';
import {
  leerBorrador,
  guardarBorrador,
  descartarBorrador,
  borradorDesdeVigente,
  type Borrador,
} from '../../data/acompanamientos/borrador';
import ZonasEditor from './ZonasEditor';
import CargaPorProfesor from './CargaPorProfesor';
import EditorManualAcompanamientos from './EditorManualAcompanamientos';
import AlternativasAcompanamientos from './AlternativasAcompanamientos';
import HistorialAcompanamientos from './HistorialAcompanamientos';
import PublicarAcompanamientos from './PublicarAcompanamientos';

type Opcion = 'menu' | 'zonas' | 'carga' | 'alternativas' | 'manual' | 'historial' | 'publicar';

interface Props {
  jornada: JornadaAcomp;
  vigente: Publicacion;
  publicaciones: Publicacion[];
  /** `correo` es null cuando no se pudo confirmar la sesión — deshabilita Publicar. */
  usuario: { correo: string | null; nombre: string };
  onPublicar: (dist: Distribucion, vigenteDesde: string, avisos: AvisoDocente[]) => Promise<{ correosFallidos: string[] }>;
  onCancelarPublicacion?: (pub: Publicacion) => Promise<void>;
  onCerrar: () => void;
}

const OPCIONES: Array<{ id: Opcion; label: string; disponible: boolean }> = [
  { id: 'zonas', label: 'Zonas', disponible: true },
  { id: 'carga', label: 'Carga por profesor', disponible: true },
  { id: 'alternativas', label: 'Generar alternativas', disponible: true },
  { id: 'manual', label: 'Editar a mano', disponible: true },
];

export default function PanelEditarAcompanamientos({
  jornada,
  vigente,
  publicaciones,
  usuario,
  onPublicar,
  onCancelarPublicacion,
  onCerrar,
}: Props) {
  const [opcion, setOpcion] = useState<Opcion>('menu');

  const [borrador, setBorrador] = useState<Borrador>(() => {
    const guardado = leerBorrador(jornada);
    return guardado ?? borradorDesdeVigente(vigente, vigente.id);
  });

  // El borrador se armó sobre una publicación que ya no es la vigente.
  const [borradorDesactualizado, setBorradorDesactualizado] = useState(
    borrador.basadoEn !== vigente.id,
  );

  function actualizarBorrador(nuevaDist: Distribucion) {
    const nuevo: Borrador = { ...borrador, distribucion: nuevaDist, guardadoEn: Date.now() };
    setBorrador(nuevo);
    guardarBorrador(jornada, nuevo);
  }

  function empezarDesdeVigente() {
    const nuevo = borradorDesdeVigente(vigente, vigente.id);
    setBorrador(nuevo);
    guardarBorrador(jornada, nuevo);
    setBorradorDesactualizado(false);
  }

  function seguirConBorrador() {
    setBorradorDesactualizado(false);
  }

  function descartar() {
    descartarBorrador(jornada);
    const nuevo = borradorDesdeVigente(vigente, vigente.id);
    setBorrador(nuevo);
    setBorradorDesactualizado(false);
  }

  const { bloqueos, avisos } = revisar(borrador.distribucion);

  function usarDistribucion(d: Distribucion) {
    actualizarBorrador(d);
    setOpcion('manual');
  }

  const TITULOS: Record<Opcion, string> = {
    menu: 'Editar acompañamientos',
    zonas: 'Zonas',
    carga: 'Carga por profesor',
    alternativas: 'Generar alternativas',
    manual: 'Editar a mano',
    historial: 'Historial',
    publicar: 'Publicar',
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/45 dark:bg-black/75 backdrop-blur-sm p-0 sm:p-6"
        onClick={onCerrar}
      >
        <motion.div
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 30, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 320, damping: 30 }}
          className={cn(
            'w-full h-full sm:h-auto sm:max-h-[92vh] bg-card border border-line sm:rounded-2xl shadow-2xl overflow-hidden flex flex-col',
            // La matriz de la semana necesita todo el ancho; el resto se queda angosto.
            opcion === 'manual' || opcion === 'alternativas' ? 'sm:max-w-6xl' : 'sm:max-w-2xl',
          )}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="px-6 pt-5 pb-4 border-b border-line flex items-center justify-between shrink-0">
            <div>
              {opcion !== 'menu' && (
                <button
                  onClick={() => setOpcion('menu')}
                  className="text-muted hover:text-strong text-xs font-medium mb-1 transition"
                >
                  ← Volver al menú
                </button>
              )}
              <h2 className="text-strong font-semibold text-base">{TITULOS[opcion]}</h2>
              <p className="text-xs text-muted mt-0.5">Jornada {jornada === 'manana' ? 'mañana' : 'tarde'}</p>
            </div>
            <div className="flex items-center gap-2">
              {opcion === 'manual' && (
                <button
                  onClick={() => setOpcion('publicar')}
                  className="rounded-lg bg-accent text-accent-fg px-3 py-1.5 text-xs font-semibold hover:opacity-90 transition"
                >
                  Publicar…
                </button>
              )}
              <button
                onClick={onCerrar}
                className="text-muted hover:text-strong transition text-lg leading-none p-1"
                aria-label="Cerrar"
              >✕</button>
            </div>
          </div>

          {/* Aviso de borrador desactualizado */}
          {borradorDesactualizado && (
            <div className="mx-6 mt-4 rounded-lg bg-warning-soft border border-line px-4 py-3 space-y-2 shrink-0">
              <p className="text-warning-soft-fg text-xs">
                Tu borrador se armó sobre una distribución que ya cambió.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={seguirConBorrador}
                  className="rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-soft hover:bg-hover transition"
                >
                  Seguir con mi borrador
                </button>
                <button
                  onClick={empezarDesdeVigente}
                  className="rounded-lg bg-accent text-accent-fg px-3 py-1.5 text-xs font-semibold hover:opacity-90 transition"
                >
                  Empezar desde la vigente
                </button>
              </div>
            </div>
          )}

          {/* Contenido */}
          <div className="flex-1 overflow-y-auto px-6 py-4">
            {opcion === 'menu' && (
              <div className="space-y-2">
                {OPCIONES.map((op) => (
                  <button
                    key={op.id}
                    disabled={!op.disponible}
                    onClick={() => op.disponible && setOpcion(op.id)}
                    className={cn(
                      'w-full text-left rounded-xl border border-line px-4 py-3 transition flex items-center justify-between',
                      op.disponible ? 'bg-elevated hover:bg-hover text-strong' : 'bg-elevated/40 text-muted opacity-60 cursor-not-allowed',
                    )}
                  >
                    <span className="text-sm font-semibold">{op.label}</span>
                    {!op.disponible && <span className="text-[10px] uppercase tracking-wide">Próximamente</span>}
                  </button>
                ))}
                <button
                  onClick={() => setOpcion('historial')}
                  className="w-full text-left rounded-xl border border-line px-4 py-3 bg-elevated hover:bg-hover text-strong transition flex items-center justify-between"
                >
                  <span className="text-sm font-semibold">Historial</span>
                </button>

                {/* Resumen del borrador */}
                <div className="rounded-xl border border-line bg-elevated/40 px-4 py-3 mt-4 space-y-2">
                  <p className="text-soft text-xs font-semibold">Tu borrador</p>
                  <p className="text-muted text-xs">
                    {bloqueos.length} bloqueo{bloqueos.length === 1 ? '' : 's'} · {avisos.length} aviso{avisos.length === 1 ? '' : 's'}
                  </p>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setOpcion('publicar')}
                      className="rounded-lg bg-accent text-accent-fg px-3 py-1.5 text-xs font-semibold hover:opacity-90 transition"
                    >
                      Publicar…
                    </button>
                    <button
                      onClick={descartar}
                      className="text-danger-soft-fg text-xs font-semibold hover:opacity-80 transition"
                    >
                      Descartar borrador
                    </button>
                  </div>
                  {!usuario.correo && (
                    <p className="text-warning-soft-fg text-xs">No se pudo confirmar tu sesión.</p>
                  )}
                </div>
              </div>
            )}

            {opcion === 'zonas' && (
              <ZonasEditor distribucion={borrador.distribucion} onCambiar={actualizarBorrador} />
            )}

            {opcion === 'carga' && (
              <CargaPorProfesor
                distribucion={borrador.distribucion}
                onCambiarMetas={(metas) => actualizarBorrador({ ...borrador.distribucion, metas })}
              />
            )}

            {opcion === 'manual' && (
              <EditorManualAcompanamientos
                jornada={jornada}
                distribucion={borrador.distribucion}
                onCambiar={actualizarBorrador}
              />
            )}

            {opcion === 'alternativas' && (
              <AlternativasAcompanamientos
                borrador={borrador.distribucion}
                vigente={vigente}
                onUsar={usarDistribucion}
              />
            )}

            {opcion === 'historial' && (
              <HistorialAcompanamientos jornada={jornada} publicaciones={publicaciones} onCancelar={onCancelarPublicacion} />
            )}

            {opcion === 'publicar' && (
              usuario.correo ? (
                <PublicarAcompanamientos
                  jornada={jornada}
                  borrador={borrador.distribucion}
                  vigente={vigente}
                  publicaciones={publicaciones}
                  nombrePublicador={usuario.nombre}
                  onPublicar={onPublicar}
                  onPublicado={() => {
                    descartarBorrador(jornada);
                    setOpcion('menu');
                    onCerrar();
                  }}
                  onCancelar={() => setOpcion('menu')}
                />
              ) : (
                <div className="rounded-xl border border-warning bg-warning-soft px-4 py-3">
                  <p className="text-warning-soft-fg text-xs">No se pudo confirmar tu sesión.</p>
                </div>
              )
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
