import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ChevronDown } from 'lucide-react';
import { cn } from '../lib/utils';
import { neonDe } from './IconosNeon';

export type NavOption = {
  id: string;
  label: string;
  descripcion: string;
};

interface Props {
  opciones: NavOption[];
  activa: string;
  onSelect: (id: string) => void;
  /** notificaciones nuevas, badge en "Reservar" y en el botón cerrado */
  badge?: number;
  /** Contadores por ítem del menú: { riesgo: 3 }. Antes el badge estaba
   *  cableado solo a 'disponibilidad', así que cualquier otra sección que
   *  necesitara contador terminaba pegando el número al texto de la etiqueta
   *  ("Gestión del Riesgo (3)"), que desentona con el resto del menú. */
  badges?: Record<string, number>;
}

export default function NavDropdown({ opciones, activa, onSelect, badge = 0, badges = {} }: Props) {
  const [abierto, setAbierto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const actual = opciones.find(o => o.id === activa) ?? opciones[0];
  const { Icono: IconActual, color: colorActual } = neonDe(actual?.id ?? '');

  // Cerrar al hacer clic afuera o con Escape
  useEffect(() => {
    if (!abierto) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setAbierto(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setAbierto(false);
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [abierto]);

  function elegir(id: string) {
    registrarUso(id);
    onSelect(id);
    setAbierto(false);
  }

  return (
    <div ref={ref} className="relative flex-1 min-w-0">
      {/* Botón que muestra la sección actual */}
      <button
        onClick={() => setAbierto(v => !v)}
        className={cn(
          'flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all',
          'text-strong hover:bg-elevated border',
          abierto ? 'bg-elevated border-line-strong' : 'border-line',
        )}
        aria-haspopup="menu"
        aria-expanded={abierto}
      >
        <IconActual className="w-4 h-4 flex-shrink-0" style={{ color: colorActual }} />
        <span className="truncate">{actual?.label}</span>
        {badge > 0 && actual?.id !== 'disponibilidad' && (
          <span className="min-w-4 h-4 bg-danger text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1">
            {badge}
          </span>
        )}
        <motion.span animate={{ rotate: abierto ? 180 : 0 }} transition={{ duration: 0.18 }} className="ml-0.5 text-muted">
          <ChevronDown size={15} />
        </motion.span>
      </button>

      {/* Menú en matriz (Julián, 25-oct-2026): bloques de 3 columnas con fondo suave y
          sin títulos. El primero son las 6 secciones que este usuario más abre; luego
          consulta, reporte y administración, sin repetir lo que ya salió arriba. */}
      <AnimatePresence>
        {abierto && (
          <motion.div
            role="menu"
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.16 }}
            className="absolute left-0 top-full mt-1.5 w-[22rem] max-w-[calc(100vw-2rem)] max-h-[calc(100vh-5rem)] overflow-y-auto z-50 rounded-2xl border border-line bg-card shadow-xl p-2 space-y-2"
          >
            {bloquesMenu(opciones, leerUso()).map((bloque, i) => (
              <div key={i} className="grid grid-cols-3 gap-1 rounded-xl bg-elevated/70 p-1.5">
                {bloque.map(op => {
                  const { Icono: Icon, color } = neonDe(op.id);
                  const activo = op.id === activa;
                  const conteo = op.id === 'disponibilidad' ? badge : (badges[op.id] ?? 0);
                  return (
                    <button
                      key={op.id}
                      role="menuitem"
                      title={op.descripcion}
                      onClick={() => elegir(op.id)}
                      className={cn(
                        'relative flex flex-col items-center gap-1 px-1 py-2 rounded-lg text-center transition',
                        activo ? 'bg-card ring-1 ring-line-strong' : 'hover:bg-card',
                      )}
                    >
                      <span className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: `${color}1a` }}>
                        <Icon className="w-5 h-5" style={{ color }} />
                      </span>
                      <span className="text-[11px] font-medium text-strong leading-tight">{op.label}</span>
                      {conteo > 0 && (
                        <span className="absolute top-1 right-1 min-w-4 h-4 bg-danger text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1">
                          {conteo}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Orden del menú en matriz ──────────────────────────────────────────────

const CLAVE_USO = 'mjb_uso_menu';
const FRECUENTES_INICIALES = ['inicio', 'asistencia', 'horario', 'agenda', 'tareas', 'chat'];
const CONSULTA = ['inicio', 'agenda', 'horario', 'asignacion', 'asistentes', 'notificaciones', 'historial'];
const REPORTE = ['asistencia', 'tareas', 'riesgo', 'plan_casa', 'disponibilidad', 'chat'];
const ADMINISTRACION = ['admin', 'rectora', 'generar_horario', 'admin_users', 'sugerencias', 'sede_datos'];

/** Veces que este navegador abrió cada sección desde el menú. Solo local: es una comodidad. */
function leerUso(): Record<string, number> {
  try { return JSON.parse(localStorage.getItem(CLAVE_USO) ?? '{}') ?? {}; } catch { return {}; }
}
function registrarUso(id: string) {
  try { const u = leerUso(); u[id] = (u[id] ?? 0) + 1; localStorage.setItem(CLAVE_USO, JSON.stringify(u)); } catch { /* sin almacenamiento */ }
}

/** Bloques de hasta 6: los más usados, y después consulta, reporte y administración. */
export function bloquesMenu<T extends { id: string }>(opciones: T[], uso: Record<string, number>): T[][] {
  const pos = (id: string) => { const i = FRECUENTES_INICIALES.indexOf(id); return i < 0 ? 99 : i; };
  const frecuentes = [...opciones]
    .sort((a, b) => (uso[b.id] ?? 0) - (uso[a.id] ?? 0) || pos(a.id) - pos(b.id))
    .slice(0, 6);
  const usados = new Set(frecuentes.map(o => o.id));
  const resto = opciones.filter(o => !usados.has(o.id));
  const de = (ids: string[]) => resto.filter(o => ids.includes(o.id));
  const conocidos = [...REPORTE, ...ADMINISTRACION];
  const consulta = resto.filter(o => CONSULTA.includes(o.id) || !conocidos.includes(o.id));
  return [frecuentes, consulta, de(REPORTE), de(ADMINISTRACION)].filter(b => b.length > 0);
}
