import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'motion/react';
import { Sun, Moon, LogOut, Bell, BellRing } from 'lucide-react';
import { useAppStore } from './data/store';
import { useTheme } from './hooks/useTheme';
import { useNotificacionesSistema } from './hooks/useNotificacionesSistema';
import LoginScreen from './components/LoginScreen';
import PanelAdmin from './components/PanelAdmin';
import PanelRectora from './components/PanelRectora';
import DisponibilidadGrid from './components/DisponibilidadGrid';
import VistaHorario from './components/VistaHorario';
import AsignacionAcademica from './components/AsignacionAcademica';
import VistaTareas from './components/VistaTareas';
import AgendaPublica from './components/AgendaPublica';
import MiHistorial from './components/MiHistorial';
import BannerNotificaciones from './components/BannerNotificaciones';
import NavDropdown from './components/NavDropdown';
import ModalSugerencia from './components/ModalSugerencia';
import { getNotificaciones } from './data/api';
import { USUARIOS } from './data/maestros';
import { cn } from './lib/utils';

type NavItem = { id: string; label: string; descripcion: string; roles: string[] };

const NAV_ITEMS: NavItem[] = [
  { id: 'disponibilidad', label: 'Reservar',     descripcion: 'Solicita un aula o recurso',        roles: ['docente', 'coordinador'] },
  { id: 'historial',      label: 'Mis reservas', descripcion: 'Tus solicitudes y su estado',       roles: ['docente', 'coordinador', 'rectora'] },
  { id: 'admin',          label: 'Panel',         descripcion: 'Pendientes, hoy y configuración',   roles: ['coordinador'] },
  { id: 'rectora',        label: 'Asignación',    descripcion: 'Asigna espacios directamente',      roles: ['rectora'] },
  { id: 'horario',        label: 'Horario',       descripcion: 'Por aulas, docente o grupo',        roles: ['docente', 'coordinador', 'rectora'] },
  { id: 'asignacion',     label: 'Asignación 2026', descripcion: 'Docentes y materias del año',     roles: ['docente', 'coordinador', 'rectora'] },
  { id: 'tareas',         label: 'Tareas',          descripcion: 'Momentos de tarea por grupo',     roles: ['docente', 'coordinador', 'rectora'] },
];

const ROL_COLOR: Record<string, string> = {
  rectora:     'rgba(232,200,74,0.18)',
  coordinador: 'rgba(240,128,128,0.18)',
  docente:     'rgba(134,239,172,0.18)',
};

export default function App() {
  const [sugerenciaAbierta, setSugerenciaAbierta] = useState(false);
  const [hash, setHash] = useState(() => window.location.hash);
  const { temaOscuro, toggleTema } = useTheme();
  const { permiso, solicitarPermiso, soportado } = useNotificacionesSistema();
  const { userId, nombre, rol, cerrarSesion, vistaActual, setVistaActual, setNotificaciones } =
    useAppStore();

  const notificaciones = useAppStore(s => s.notificaciones);
  const notifNoLeidas = notificaciones.filter(n => !n.leida).length;

  const { data: notifData } = useQuery({
    queryKey: ['notificaciones', userId],
    queryFn: () => getNotificaciones(userId!),
    enabled: !!userId,
    refetchInterval: 1000 * 30,
  });

  useEffect(() => {
    if (notifData) setNotificaciones(notifData);
  }, [notifData, setNotificaciones]);

  useEffect(() => {
    const fn = () => setHash(window.location.hash);
    window.addEventListener('hashchange', fn);
    return () => window.removeEventListener('hashchange', fn);
  }, []);

  // ── Ruta pública: agenda de tareas por grupo (sin login) ──────────
  const agendaMatch = hash.match(/^#\/agenda\/(.+)$/);
  if (agendaMatch) return <AgendaPublica grupo={decodeURIComponent(agendaMatch[1])} />;

  if (!userId) return <LoginScreen />;

  const navItems = NAV_ITEMS.filter(item => item.roles.includes(rol ?? ''));
  const usuario  = USUARIOS.find(u => u.id === userId);

  return (
    <div className={cn('min-h-screen flex flex-col')}>

      {/* ── Header ───────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 border-b border-line bg-card/85 backdrop-blur-xl shadow-sm">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center gap-3">

          {/* Logo */}
          <div className="flex items-center gap-2.5 flex-shrink-0">
            <img
              src="/mjb-prestamos/mjb_escudo.png"
              alt="MJB"
              className="w-8 h-8 object-contain"
            />
            <span className="text-sm font-semibold text-strong hidden md:block tracking-wide">
              Manuel J. Betancur
            </span>
          </div>

          {/* Divisor */}
          <div className="w-px h-5 bg-line hidden md:block flex-shrink-0" />

          {/* Nav — menú desplegable compacto */}
          <NavDropdown
            opciones={navItems.map(({ id, label, descripcion }) => ({ id, label, descripcion }))}
            activa={vistaActual}
            onSelect={id => setVistaActual(id as typeof vistaActual)}
            badge={notifNoLeidas}
          />

          {/* Acciones derecha */}
          <div className="flex items-center gap-1 ml-auto flex-shrink-0">

            {/* Pastilla usuario */}
            <div
              className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border border-line"
              style={{ backgroundColor: ROL_COLOR[rol ?? 'docente'], color: usuario?.color ?? 'var(--color-strong)' }}
            >
              <span
                className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: usuario?.color ?? 'var(--color-strong)' }}
              />
              {nombre?.split(' ')[0]}
            </div>

            {/* Bell (solo docentes con notifs) */}
            {rol === 'docente' && notifNoLeidas > 0 && (
              <button
                onClick={() => setVistaActual('disponibilidad' as typeof vistaActual)}
                className="relative p-2 rounded-lg text-muted hover:text-strong hover:bg-elevated transition"
                title="Notificaciones"
              >
                <Bell size={16} />
                <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-danger rounded-full" />
              </button>
            )}

            {/* Activar avisos del sistema (solo si aún no se ha decidido) */}
            {soportado && permiso === 'default' && (
              <button
                onClick={solicitarPermiso}
                className="flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-info hover:bg-info-soft transition text-xs font-medium"
                title="Recibe un aviso del sistema cuando llegue una notificación nueva"
              >
                <BellRing size={15} />
                <span className="hidden sm:inline">Activar avisos</span>
              </button>
            )}

            {/* Toggle tema */}
            <button
              onClick={toggleTema}
              className="p-2 rounded-lg text-muted hover:text-strong hover:bg-elevated transition"
              title="Cambiar tema"
            >
              <AnimatePresence mode="wait" initial={false}>
                <motion.span
                  key={temaOscuro ? 'moon' : 'sun'}
                  initial={{ opacity: 0, rotate: -30, scale: 0.7 }}
                  animate={{ opacity: 1, rotate: 0, scale: 1 }}
                  exit={{ opacity: 0, rotate: 30, scale: 0.7 }}
                  transition={{ duration: 0.2 }}
                  className="flex"
                >
                  {temaOscuro ? <Moon size={16} /> : <Sun size={16} />}
                </motion.span>
              </AnimatePresence>
            </button>

            {/* Logout */}
            <button
              onClick={cerrarSesion}
              className="p-2 rounded-lg text-muted hover:text-danger hover:bg-danger-soft transition"
              title="Cerrar sesión"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </header>

      {/* ── Banner notificaciones ─────────────────────────────────── */}
      {rol === 'docente' && <BannerNotificaciones />}

      {/* ── Contenido ────────────────────────────────────────────── */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-5">
        <AnimatePresence mode="wait">
          <motion.div
            key={vistaActual}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            {vistaActual === 'disponibilidad' && <DisponibilidadGrid />}
            {vistaActual === 'historial'      && <MiHistorial />}
            {vistaActual === 'admin'          && rol === 'coordinador' && <PanelAdmin />}
            {vistaActual === 'rectora'        && rol === 'rectora'     && <PanelRectora />}
            {vistaActual === 'horario'        && <VistaHorario />}
            {vistaActual === 'asignacion'     && <AsignacionAcademica />}
            {vistaActual === 'tareas'         && <VistaTareas />}
          </motion.div>
        </AnimatePresence>
      </main>

        <footer className="mt-auto py-4 text-center">
          <button
            onClick={() => setSugerenciaAbierta(true)}
            className="text-xs text-muted hover:text-strong transition"
          >
            💡 Enviar sugerencia
          </button>
        </footer>
        <ModalSugerencia open={sugerenciaAbierta} onClose={() => setSugerenciaAbierta(false)} />
    </div>
  );
}
