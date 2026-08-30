import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'motion/react';
import { onIdTokenChanged } from 'firebase/auth';
import { Sun, Moon, LogOut, Bell, BellRing, Home } from 'lucide-react';
import { useAppStore } from './data/store';
import { useTheme } from './hooks/useTheme';
import { useNotificacionesSistema } from './hooks/useNotificacionesSistema';
import { auth } from './lib/firebase';
import { salirDeSuplantacion, quienSuplanta } from './lib/auth';
import BarraSuplantacion from './components/BarraSuplantacion';
import LoginScreen from './components/LoginScreen';
import PanelInicio from './components/PanelInicio';
import PanelAdmin from './components/PanelAdmin';
import PanelRectora from './components/PanelRectora';
import Reservas from './components/Reservas';
import VistaHorario from './components/VistaHorario';
import AsignacionAcademica from './components/AsignacionAcademica';
import VistaTareas from './components/VistaTareas';
import AgendaPublica from './components/AgendaPublica';
import MiHistorial from './components/MiHistorial';
import PanelSuperusuario from './components/PanelSuperusuario';
import PanelSugerencias from './components/PanelSugerencias';
import Chat from './components/Chat';
import AgendaSemanal from './components/AgendaSemanal';
import GestionRiesgo from './components/GestionRiesgo';
import Asistentes from './components/Asistentes';
import Asistencia from './asistencia';
import BannerNotificaciones from './components/BannerNotificaciones';
import FichaSede from './components/FichaSede';
import NavDropdown from './components/NavDropdown';
import ModalSugerencia from './components/ModalSugerencia';
import { getNotificaciones } from './data/api';
import { useCasosVencidos } from './hooks/useCasosVencidos';
import { useHistorialDeVistas } from './hooks/useHistorialDeVistas';
import { cargarSyncEditor } from './data/syncEditor';
import { USUARIOS, SEDES, esDirectivo, sedeDeUsuario } from './data/maestros';
import { AUTH_MODE } from './data/authStore';
import { useChatStore } from './data/chatStore';
import { cn } from './lib/utils';
import { SelectorSedeMenu, SelectorSedePastilla, sedeYaElegidaEnSesion } from './components/SelectorSede';

type NavItem = { id: string; label: string; descripcion: string; roles: string[] };

const NAV_ITEMS: NavItem[] = [
  // ORDEN pedido por Julián (17 de agosto de 2026). El arreglo se filtra por
  // rol más abajo, así que los módulos de un solo rol se intercalan donde le
  // sirven a ESE rol: la coordinadora y la rectora encuentran su herramienta
  // principal arriba, y un docente —que no ve ninguno de los dos— ve
  // exactamente la lista que pidió.
  //
  // 'historial' (Mis reservas) YA NO está en el menú para docente y
  // coordinador: ahora es una pastilla dentro de Reservas. Se conserva como
  // entrada suelta solo para la rectora, que no tiene pantalla de Reservas
  // donde anidarlo (su rol no incluye 'disponibilidad').
  { id: 'inicio',         label: 'Inicio',          descripcion: 'Tu resumen del día',                roles: ['docente', 'coordinador', 'rectora', 'superusuario'] },
  { id: 'admin',          label: 'Panel',           descripcion: 'Pendientes, hoy y configuración',   roles: ['coordinador'] },
  { id: 'rectora',        label: 'Asignación',      descripcion: 'Asigna espacios directamente',      roles: ['rectora'] },
  { id: 'agenda',         label: 'Agenda',          descripcion: 'Agenda semanal institucional',      roles: ['docente', 'coordinador', 'rectora', 'superusuario'] },
  { id: 'horario',        label: 'Horario',         descripcion: 'Por aulas, docente o grupo',        roles: ['docente', 'coordinador', 'rectora'] },
  { id: 'asistencia',     label: 'Asistencia',      descripcion: 'Registro de clase',                 roles: ['docente', 'coordinador', 'rectora', 'superusuario'] },
  { id: 'tareas',         label: 'Tareas',          descripcion: 'Momentos de tarea por grupo',       roles: ['docente', 'coordinador', 'rectora'] },
  { id: 'asistentes',     label: 'Chatbot',         descripcion: 'Chatbots de convivencia y evaluación', roles: ['docente', 'coordinador', 'rectora', 'superusuario'] },
  { id: 'riesgo',         label: 'Gestión del Riesgo', descripcion: 'Emergencia escolar, brigadas y números', roles: ['docente', 'coordinador', 'rectora', 'superusuario'] },
  { id: 'disponibilidad', label: 'Reservas',        descripcion: 'Solicita un aula o recurso',        roles: ['docente', 'coordinador'] },
  { id: 'historial',      label: 'Mis reservas',    descripcion: 'Tus solicitudes y su estado',       roles: ['rectora'] },
  { id: 'asignacion',     label: 'Asignación 2026', descripcion: 'Docentes y materias del año',       roles: ['docente', 'coordinador', 'rectora'] },
  { id: 'chat',           label: 'Chat',            descripcion: 'Mensajería interna',                roles: ['docente', 'coordinador', 'rectora', 'superusuario'] },
  { id: 'admin_users',    label: 'Usuarios',        descripcion: 'Alta, roles y activación',          roles: ['superusuario'] },
  { id: 'sugerencias',    label: 'Sugerencias',     descripcion: 'Lo que reportan los docentes',      roles: ['superusuario'] },
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
  const { userId, nombre, rol, cerrarSesion, vistaActual, setVistaActual, setNotificaciones, mergeSync } =
    useAppStore();
  const sedeActual = useAppStore(s => s.sedeActual);
  const [menuSedeAbierto, setMenuSedeAbierto] = useState(false);

  // Suplantación real (Cloud Function `suplantar`): el claim `suplantadoPor`
  // del token vigente es la ÚNICA fuente de verdad de si esta sesión está
  // suplantada. Nunca se decide con estado local -- userId/nombre/rol del
  // store ya reflejan la identidad suplantada (authStore los recarga solo
  // con cada cambio de sesión de Firebase), así que lo único que falta es
  // saber SI el token trae la marca. onIdTokenChanged también dispara en
  // cada refresco de token, no solo al iniciar sesión.
  const [sesionSuplantada, setSesionSuplantada] = useState(false);
  useEffect(() => {
    if (!auth) return;
    return onIdTokenChanged(auth, async (user) => {
      if (!user) { setSesionSuplantada(false); return; }
      try {
        // Se usa quienSuplanta() y no getIdTokenResult directo porque ademas
        // cachea el correo del superusuario, que es lo que permite salir de la
        // suplantacion sin que Google pregunte por la cuenta.
        setSesionSuplantada((await quienSuplanta()) !== null);
      } catch {
        setSesionSuplantada(false);
      }
    });
  }, []);

  const notificaciones = useAppStore(s => s.notificaciones);
  const notifNoLeidas = notificaciones.filter(n => !n.leida).length;

  // Badge de "Gestión del Riesgo": casos con alerta ámbar/roja
  // (docs/plan-gestor-casos.md sección 4). El backend ya filtra qué casos ve
  // cada rol (sección 3); aquí solo se cuenta lo que llega.
  const casosVencidos = useCasosVencidos(userId);

  // El boton atras de Android debe volver a la seccion anterior, no cerrar la app.
  useHistorialDeVistas();

  const { data: notifData } = useQuery({
    queryKey: ['notificaciones', userId],
    queryFn: () => getNotificaciones(userId!),
    enabled: !!userId,
    refetchInterval: 1000 * 30,
  });

  useEffect(() => {
    if (notifData) setNotificaciones(notifData);
  }, [notifData, setNotificaciones]);

  // Sincronización del editor de horario: recibe las modificaciones y
  // jornadas reducidas publicadas por el coordinador desde cualquier
  // dispositivo (fuente de verdad = backend), cada 60s.
  const { data: syncData } = useQuery({
    queryKey: ['syncEditor'],
    queryFn: cargarSyncEditor,
    enabled: !!userId,
    refetchInterval: 1000 * 60,
  });

  useEffect(() => {
    if (syncData) mergeSync(syncData.modificaciones, syncData.jornadas);
  }, [syncData, mergeSync]);

  useEffect(() => {
    const fn = () => setHash(window.location.hash);
    window.addEventListener('hashchange', fn);
    return () => window.removeEventListener('hashchange', fn);
  }, []);

  // Chat interno — solo se inicia en modo google con sesión activa (no-op en pin).
  useEffect(() => {
    if (AUTH_MODE === 'google' && userId && rol) {
      const usuarioActual = USUARIOS.find((u) => u.id === userId);
      const miSede = sedeDeUsuario(userId);
      const miJornada = usuarioActual?.jornada ?? 'manana';
      useChatStore.getState().initChat(rol, miSede, miJornada);
    }
  }, [userId, rol]);

  // Menú de sede — solo directivos, solo una vez por sesión de navegador.
  useEffect(() => {
    if (userId && esDirectivo(rol) && !sedeYaElegidaEnSesion()) {
      setMenuSedeAbierto(true);
    }
  }, [userId, rol]);

  // ── Ruta pública: agenda de tareas por grupo (sin login) ──────────
  const agendaMatch = hash.match(/^#\/agenda\/(.+)$/);
  if (agendaMatch) return <AgendaPublica grupo={decodeURIComponent(agendaMatch[1])} />;

  if (!userId) return <LoginScreen />;

  const navItems = NAV_ITEMS
    .filter(item => item.roles.includes(rol ?? ''))
    // El chat solo tiene sentido en modo google (Firebase). En modo pin se oculta.
    .filter(item => item.id !== 'chat' || AUTH_MODE === 'google');
  const usuario  = USUARIOS.find(u => u.id === userId);

  return (
    <div className={cn('min-h-screen flex flex-col')}>

      {/* Barra de suplantación + header, pegados como un solo bloque sticky:
          así la barra nunca se pierde de vista aunque se desplace la página. */}
      <div className="sticky top-0 z-40">
      {sesionSuplantada && <BarraSuplantacion nombre={nombre} onSalir={salirDeSuplantacion} />}
      <header className="border-b border-line bg-card/85 backdrop-blur-xl shadow-sm">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center gap-3">

          {/* Logo — también es el botón de regreso al panel de inicio, para no
              quedar encerrado en una sección sin pasar por el desplegable. */}
          <button
            type="button"
            onClick={() => setVistaActual('inicio' as typeof vistaActual)}
            className="flex items-center gap-2.5 flex-shrink-0 rounded-lg px-1 -mx-1 py-1 hover:bg-elevated transition"
            title="Ir al panel de inicio"
            aria-label="Ir al panel de inicio"
          >
            <img
              src="/mjb-prestamos/mjb_escudo.png"
              alt="MJB"
              className="w-8 h-8 object-contain"
            />
            <span className="text-sm font-semibold text-strong hidden md:block tracking-wide">
              Manuel J. Betancur
            </span>
          </button>

          {/* Divisor */}
          <div className="w-px h-5 bg-line hidden md:block flex-shrink-0" />

          {/* Nav — menú desplegable compacto */}
          <NavDropdown
            opciones={navItems.map(({ id, label, descripcion }) => ({ id, label, descripcion }))}
            activa={vistaActual}
            onSelect={id => setVistaActual(id as typeof vistaActual)}
            badge={notifNoLeidas}
            badges={{ riesgo: casosVencidos }}
          />

          {/* Regreso explícito al inicio: el escudo ya lleva allí, pero no es
              evidente, así que fuera del inicio se muestra también este chip. */}
          {vistaActual !== 'inicio' && (
            <button
              type="button"
              onClick={() => setVistaActual('inicio' as typeof vistaActual)}
              className="flex-shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-full border border-line text-xs font-medium text-soft hover:text-strong hover:bg-elevated transition"
              title="Volver al panel de inicio"
            >
              <Home size={13} />
              <span className="hidden sm:inline">Inicio</span>
            </button>
          )}

          {/* Acciones derecha */}
          <div className="flex items-center gap-1 ml-auto flex-shrink-0">

            {/* Pastilla de sede — solo directivos, pueden cambiar en cualquier momento */}
            {esDirectivo(rol) && <SelectorSedePastilla />}

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
      </div>

      {/* ── Banner notificaciones ─────────────────────────────────── */}
      {rol === 'docente' && <BannerNotificaciones />}

      {/* ── Contenido ────────────────────────────────────────────── */}
      {/* overflow-x-hidden como red de seguridad: las tablas anchas ya tienen su
          propio scroll interno, así que nada debería empujar la página entera
          de lado en el celular. */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-5 overflow-x-hidden">
        <AnimatePresence mode="wait">
          <motion.div
            key={vistaActual}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            {/*
              Fase A — multi-sede: si la sede activa NO está configurada
              (hoy, cualquiera distinta a 'central'), solo se dejan pasar las
              vistas transversales (chat, panel de superusuario). El resto
              muestra un placeholder — el switch de abajo, usado cuando la
              sede SÍ está configurada (incl. 'central' siempre), no se toca.
            */}
            {(() => {
              const sede = SEDES.find(s => s.id === sedeActual);
              const vistaTransversal = vistaActual === 'inicio' || vistaActual === 'chat' || vistaActual === 'admin_users' || vistaActual === 'agenda' || vistaActual === 'riesgo' || vistaActual === 'asistentes' || vistaActual === 'sugerencias';
              if (sede && !sede.configurada && !vistaTransversal) {
                return <FichaSede sede={sede} />;
              }
              return (
                <>
                  {vistaActual === 'inicio'          && <PanelInicio navItems={navItems} />}
                  {vistaActual === 'disponibilidad' && <Reservas />}
                  {vistaActual === 'historial'      && <MiHistorial />}
                  {vistaActual === 'admin'          && rol === 'coordinador' && <PanelAdmin />}
                  {vistaActual === 'rectora'        && rol === 'rectora'     && <PanelRectora />}
                  {vistaActual === 'horario'        && <VistaHorario />}
                  {vistaActual === 'asignacion'     && <AsignacionAcademica />}
                  {vistaActual === 'tareas'         && <VistaTareas />}
                  {vistaActual === 'chat'           && AUTH_MODE === 'google' && <Chat />}
                  {vistaActual === 'agenda'         && <AgendaSemanal />}
                  {vistaActual === 'riesgo'         && <GestionRiesgo />}
                  {vistaActual === 'asistentes'     && <Asistentes />}
                  {vistaActual === 'admin_users'    && rol === 'superusuario' && <PanelSuperusuario />}
                  {vistaActual === 'sugerencias'    && rol === 'superusuario' && <PanelSugerencias />}
                  {vistaActual === 'asistencia'     && <Asistencia />}
                </>
              );
            })()}
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

        {/* Menú inicial de sede — solo directivos, una vez por sesión */}
        {menuSedeAbierto && <SelectorSedeMenu onElegir={() => setMenuSedeAbierto(false)} />}
    </div>
  );
}
