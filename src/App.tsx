import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAppStore } from './data/store';
import { useTheme } from './hooks/useTheme';
import LoginScreen from './components/LoginScreen';
import PanelAdmin from './components/PanelAdmin';
import PanelRectora from './components/PanelRectora';
import DisponibilidadGrid from './components/DisponibilidadGrid';
import VistaHorario from './components/VistaHorario';
import MiHistorial from './components/MiHistorial';
import BannerNotificaciones from './components/BannerNotificaciones';
import { getNotificaciones } from './data/api';
import { USUARIOS } from './data/maestros';

type NavItem = {
  id: string;
  label: string;
  roles: string[];
};

const NAV_ITEMS: NavItem[] = [
  { id: 'disponibilidad', label: 'Reservar',    roles: ['docente', 'coordinador'] },
  { id: 'historial',      label: 'Mis reservas', roles: ['docente', 'coordinador', 'rectora'] },
  { id: 'admin',          label: 'Panel',        roles: ['coordinador'] },
  { id: 'rectora',        label: 'Asignación',   roles: ['rectora'] },
  { id: 'horario',        label: 'Horario del J', roles: ['docente', 'coordinador', 'rectora'] },
];

export default function App() {
  const { temaOscuro, toggleTema } = useTheme();
  const { userId, nombre, rol, cerrarSesion, vistaActual, setVistaActual, setNotificaciones } =
    useAppStore();

  const notificaciones = useAppStore(s => s.notificaciones);
  const notifNoLeidas = notificaciones.filter(n => !n.leida).length;

  // Polling de notificaciones cada 30s con TanStack Query
  const { data: notifData } = useQuery({
    queryKey: ['notificaciones', userId],
    queryFn: () => getNotificaciones(userId!),
    enabled: !!userId,
    refetchInterval: 1000 * 30,
  });

  useEffect(() => {
    if (notifData) setNotificaciones(notifData);
  }, [notifData, setNotificaciones]);

  if (!userId) return <LoginScreen />;

  const navItems = NAV_ITEMS.filter(item => item.roles.includes(rol ?? ''));
  const usuario = USUARIOS.find(u => u.id === userId);

  const bgBase = temaOscuro
    ? 'bg-gray-950 text-white'
    : 'bg-gray-100 text-gray-900';

  const headerBg = temaOscuro
    ? 'bg-gray-900 border-gray-800'
    : 'bg-white border-gray-200';

  return (
    <div className={`min-h-screen flex flex-col ${bgBase}`}>
      {/* ── Header ─────────────────────────────────────────────────── */}
      <header className={`sticky top-0 z-40 border-b ${headerBg} shadow-sm`}>
        <div className="max-w-7xl mx-auto px-4 py-2 flex items-center gap-3">
          {/* Logo + nombre institución */}
          <img
            src="/mjb-prestamos/mjb_escudo.png"
            alt="MJB"
            className="w-8 h-8 object-contain"
            style={{ mixBlendMode: 'lighten' }}
          />
          <span className="text-sm font-semibold hidden sm:block">
            I.E. Manuel J. Betancur
          </span>

          {/* Nav */}
          <nav className="flex items-center gap-1 ml-4 flex-1 overflow-x-auto">
            {navItems.map(item => (
              <button
                key={item.id}
                onClick={() => setVistaActual(item.id as typeof vistaActual)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition whitespace-nowrap ${
                  vistaActual === item.id
                    ? 'bg-blue-600 text-white'
                    : temaOscuro
                      ? 'text-gray-400 hover:text-white hover:bg-gray-800'
                      : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'
                }`}
              >
                {item.label}
                {item.id === 'disponibilidad' && notifNoLeidas > 0 && (
                  <span className="ml-1.5 bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5">
                    {notifNoLeidas}
                  </span>
                )}
              </button>
            ))}
          </nav>

          {/* Pastilla usuario + tema + logout */}
          <div className="flex items-center gap-2 ml-auto flex-shrink-0">
            {/* Pastilla rol */}
            <span
              className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
              style={{
                backgroundColor:
                  rol === 'rectora'
                    ? 'rgba(232,200,74,0.15)'
                    : rol === 'coordinador'
                      ? 'rgba(240,128,128,0.15)'
                      : 'rgba(134,239,172,0.15)',
                color: usuario?.color ?? '#fff',
              }}
            >
              {nombre?.split(' ')[0]}
            </span>

            {/* Tema */}
            <button
              onClick={toggleTema}
              className={`p-1.5 rounded-lg text-sm transition ${
                temaOscuro
                  ? 'text-gray-400 hover:text-white hover:bg-gray-800'
                  : 'text-gray-500 hover:text-gray-900 hover:bg-gray-200'
              }`}
              title="Cambiar tema"
            >
              {temaOscuro ? '☀️' : '🌙'}
            </button>

            {/* Logout */}
            <button
              onClick={cerrarSesion}
              className={`p-1.5 rounded-lg text-sm transition ${
                temaOscuro
                  ? 'text-gray-400 hover:text-white hover:bg-gray-800'
                  : 'text-gray-500 hover:text-gray-900 hover:bg-gray-200'
              }`}
              title="Cerrar sesión"
            >
              🏠
            </button>
          </div>
        </div>
      </header>

      {/* ── Banner notificaciones (solo docentes) ──────────────────── */}
      {rol === 'docente' && <BannerNotificaciones />}

      {/* ── Contenido principal ────────────────────────────────────── */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-4">
        {vistaActual === 'disponibilidad' && <DisponibilidadGrid />}
        {vistaActual === 'historial'      && <MiHistorial />}
        {vistaActual === 'admin'          && rol === 'coordinador' && <PanelAdmin />}
        {vistaActual === 'rectora'        && rol === 'rectora'     && <PanelRectora />}
        {vistaActual === 'horario'        && <VistaHorario />}
      </main>
    </div>
  );
}
