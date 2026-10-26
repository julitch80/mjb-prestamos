// «Mis notificaciones» (Etapa 1 — docs/notificaciones-push/PRD.md). Estado del
// dispositivo (activo/no), interruptores por categoría y notas de contexto
// (silencio nocturno, iPhone). Casos/evasión solo se ven para
// coordinador/rectora/superusuario (son categorías que Etapa 2 activará).
import { useEffect, useState } from 'react';
import { useAppStore } from '../data/store';
import {
  activar, desactivarEsteDispositivo, enviarPruebaNotificacion, esteDispositivoTieneToken, guardarPreferencias, avisoLocal, infoServiceWorker, leerUltimoPush, type InfoSW, type UltimoPush, leerPreferencias, soportado,
} from '../data/notificacionesPush';
import { PREFERENCIAS_DEFAULT, type CategoriaNotificacion, type PreferenciasNotif } from '../data/notificacionesPushLogica';
import { IconoCampana } from './IconosNeon';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';

const CATEGORIAS: { id: CategoriaNotificacion; label: string; descripcion: string; soloDirectivos?: boolean; tambienCopasst?: boolean }[] = [
  { id: 'chat', label: 'Mensajes del chat', descripcion: 'Cuando te escriben en un canal que puedes ver' },
  { id: 'avisos', label: 'Avisos de coordinación y rectoría', descripcion: 'Rectoría, coordinación e intercambios de espacio' },
  { id: 'horario', label: 'Cambios en mi horario', descripcion: 'Cuando tu horario se modifica temporalmente' },
  { id: 'reservas', label: 'Mis reservas', descripcion: 'Aprobada, rechazada o cancelada' },
  { id: 'sugerencias', label: 'Respuesta a mi sugerencia', descripcion: 'Cuando te responden lo que reportaste' },
  { id: 'casos', label: 'Casos de permanencia', descripcion: 'Nuevos, vencidos o remitidos', soloDirectivos: true },
  { id: 'evasion', label: 'Posible evasión', descripcion: 'Alertas de evasión escolar', soloDirectivos: true },
  { id: 'accidentes', label: 'Accidentes laborales', descripcion: 'Cuando hay un caso nuevo por atender', soloDirectivos: true, tambienCopasst: true },
];

export default function MisNotificaciones() {
  const rol = useAppStore(s => s.rol);
  const esDirectivo = rol === 'coordinador' || rol === 'rectora' || rol === 'superusuario';
  // Los representantes docentes del COPASST también reciben los avisos de accidente
  // laboral (sstConfig/copasst): tienen que poder apagarlos aquí.
  const [esCopasst, setEsCopasst] = useState(false);
  useEffect(() => {
    const correo = auth?.currentUser?.email?.toLowerCase();
    if (!db || !correo) return;
    getDoc(doc(db, 'sstConfig/copasst'))
      .then((snap) => setEsCopasst(((snap.data()?.correos ?? []) as string[]).map((c) => c.toLowerCase()).includes(correo)))
      .catch(() => setEsCopasst(false));
  }, []);

  const [disponible, setDisponible] = useState(false);
  const [permiso, setPermiso] = useState<NotificationPermission>('default');
  const [cargando, setCargando] = useState(false);
  const [prefs, setPrefs] = useState<PreferenciasNotif>(PREFERENCIAS_DEFAULT);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    void (async () => {
      setDisponible(await soportado());
      setPermiso(typeof Notification !== 'undefined' ? Notification.permission : 'default');
      setPrefs(await leerPreferencias());
    })();
  }, []);

  const [tieneToken, setTieneToken] = useState<boolean | null>(null);
  const [probando, setProbando] = useState(false);
  const [resultadoPrueba, setResultadoPrueba] = useState<{ ok: boolean; texto: string; detalle?: string } | null>(null);

  useEffect(() => {
    void esteDispositivoTieneToken().then(setTieneToken);
  }, [permiso]);

  const [info, setInfo] = useState<InfoSW | null>(null);
  const [ultimo, setUltimo] = useState<UltimoPush | null>(null);
  const [crudo, setCrudo] = useState('');
  const [msgLocal, setMsgLocal] = useState('');

  useEffect(() => {
    void infoServiceWorker().then(setInfo).catch(() => setInfo(null));
    void leerUltimoPush().then(setUltimo);
    const alMensaje = (e: MessageEvent) => {
      if (e.data?.tipo === 'mjb-push-recibido') setUltimo({ cuando: e.data.cuando, titulo: e.data.titulo, estado: e.data.estado });
    };
    navigator.serviceWorker?.addEventListener('message', alMensaje);
    return () => navigator.serviceWorker?.removeEventListener('message', alMensaje);
  }, [permiso]);

  async function alAvisoLocal() {
    setMsgLocal('');
    try {
      await avisoLocal();
      setMsgLocal('Orden enviada. Si no aparece nada en la barra del celular, el sistema bloquea las notificaciones de este sitio.');
    } catch (e) {
      setMsgLocal('Falló: ' + (e instanceof Error ? e.message : String(e)));
    }
  }

  async function alProbar() {
    setProbando(true);
    setResultadoPrueba(null);
    try {
      const r = await enviarPruebaNotificacion();
      setCrudo(JSON.stringify(r));
      if (r.motivo === 'sin-dispositivos') {
        setResultadoPrueba({ ok: false, texto: 'Este celular no está registrado: activa las notificaciones aquí primero.' });
      } else if (r.enviados > 0) {
        const fallos = r.detalles.filter(d => d.error).map(d => `${d.dispositivo}: ${d.error}`).join('; ');
        setResultadoPrueba({
          ok: true,
          texto: `Enviada a ${r.enviados} dispositivo(s). Cierra la app: debería llegarte en segundos.`,
          detalle: fallos ? `Fallaron: ${fallos}` : undefined,
        });
      } else {
        setResultadoPrueba({
          ok: false,
          texto: 'No se pudo entregar a ningún dispositivo.',
          detalle: r.detalles.map(d => `${d.dispositivo}: ${d.error}`).join('; '),
        });
      }
    } catch (e) {
      setResultadoPrueba({ ok: false, texto: 'No se pudo enviar la prueba.', detalle: e instanceof Error ? e.message : String(e) });
    } finally {
      setProbando(false);
    }
  }

  const [errorActivar, setErrorActivar] = useState<string | null>(null);
  async function alActivar() {
    setCargando(true);
    setErrorActivar(null);
    try {
      const res = await activar();
      setPermiso(res);
      if (res === 'granted') setTieneToken(true);
    } catch (e) {
      // Antes este error se perdía y la pantalla seguía diciendo «Activo».
      setErrorActivar(e instanceof Error ? e.message : String(e));
    } finally {
      setCargando(false);
    }
  }

  async function alDesactivar() {
    setCargando(true);
    try {
      await desactivarEsteDispositivo();
      setPermiso('default');
      setTieneToken(false);
    } finally {
      setCargando(false);
    }
  }

  async function alCambiar(categoria: CategoriaNotificacion, valor: boolean) {
    const nuevas = { ...prefs, [categoria]: valor };
    setPrefs(nuevas);
    setGuardando(true);
    try {
      await guardarPreferencias(nuevas);
    } finally {
      setGuardando(false);
    }
  }

  const esIOS = typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent);
  // «Activo» exige permiso Y token guardado en el servidor: con permiso pero sin token
  // (token rotado, o desactivado antes) el servidor responde «sin-dispositivos» y aquí
  // decía «Activo» sin ofrecer cómo arreglarlo (Julián, 27-oct-2026).
  const activo = permiso === 'granted' && tieneToken === true;

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-strong flex items-center gap-2">
          <IconoCampana className="w-5 h-5" />
          Mis notificaciones
        </h1>
        <p className="text-muted text-xs mt-0.5">Qué te avisa la aplicación en el celular, aunque esté cerrada.</p>
      </div>

      <div className="bg-card rounded-xl p-4 border border-line space-y-3">
        {!disponible ? (
          <p className="text-muted text-sm">
            Este navegador no admite notificaciones push
            {esIOS ? ': en iPhone solo funcionan si agregas la aplicación a la pantalla de inicio (iOS 16.4 o más reciente).' : '.'}
          </p>
        ) : (
          <>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-strong text-sm font-semibold">Este dispositivo</p>
                <p className="text-muted text-xs mt-0.5">
                  {activo ? 'Activo — recibe notificaciones'
                    : permiso === 'denied' ? 'Bloqueado en el navegador'
                    : permiso === 'granted' && tieneToken === false ? 'Permiso concedido, pero este celular no está registrado en el servidor'
                    : 'No activo'}
                </p>
              </div>
              {activo ? (
                <button
                  onClick={alDesactivar}
                  disabled={cargando}
                  className="px-3 py-2 rounded-lg bg-elevated text-soft hover:text-strong text-sm font-semibold disabled:opacity-40 whitespace-nowrap"
                >
                  Desactivar aquí
                </button>
              ) : (
                <button
                  onClick={alActivar}
                  disabled={cargando || permiso === 'denied'}
                  className="px-3 py-2 rounded-lg bg-accent text-accent-fg text-sm font-semibold disabled:opacity-40 whitespace-nowrap"
                >
                  {permiso === 'granted' ? 'Registrar este celular' : 'Activar'}
                </button>
              )}
            </div>
            {errorActivar && <p role="alert" className="text-danger text-xs">No se pudo registrar: {errorActivar}</p>}
            {permiso === 'denied' && (
              <p className="text-muted text-xs">
                Bloqueaste el permiso antes. Actívalo desde los ajustes de notificaciones del navegador para este sitio.
              </p>
            )}
          </>
        )}
      </div>

      <div className="bg-card rounded-xl p-4 border border-line space-y-2">
        <p className="text-strong text-sm font-semibold">Probar notificaciones</p>
        <p className="text-muted text-xs">
          Permiso en este navegador: {permiso === 'granted' ? 'concedido' : permiso === 'denied' ? 'bloqueado' : 'sin pedir'}
          {' · '}Token guardado: {tieneToken === null ? 'comprobando…' : tieneToken ? 'sí' : 'no'}
        </p>
        <button
          onClick={alProbar}
          disabled={probando}
          className="px-3 py-2 rounded-lg bg-elevated text-soft hover:text-strong text-sm font-semibold disabled:opacity-40"
        >
          {probando ? 'Enviando…' : 'Enviarme una notificación de prueba'}
        </button>
        <button
          onClick={alAvisoLocal}
          className="ml-2 px-3 py-2 rounded-lg bg-elevated text-soft hover:text-strong text-sm font-semibold"
        >
          Probar aviso local
        </button>
        {msgLocal && <p className="text-xs text-muted">{msgLocal}</p>}
        <div className="text-xs text-muted space-y-0.5 break-all">
          <p>Último aviso recibido por este celular: {ultimo ? `${new Date(ultimo.cuando).toLocaleString('es-CO')} — ${ultimo.titulo} (${ultimo.estado})` : 'ninguno'}</p>
          {info && <p>SW: {info.script} · alcance {info.scope} · {info.estado} · controla la página: {info.controlador ? 'sí' : 'no'} · token {info.hashToken}</p>}
          {crudo && <p>Respuesta del servidor: {crudo}</p>}
        </div>
        {resultadoPrueba && (
          <div role="status" className={`text-sm ${resultadoPrueba.ok ? 'text-strong' : 'text-muted'}`}>
            <p>{resultadoPrueba.texto}</p>
            {resultadoPrueba.detalle && <p className="text-xs text-muted mt-0.5">{resultadoPrueba.detalle}</p>}
          </div>
        )}
      </div>

      <div className="bg-card rounded-xl p-4 border border-line space-y-1">
        <p className="text-strong text-sm font-semibold mb-2">Qué te avisa</p>
        {CATEGORIAS.filter(c => !c.soloDirectivos || esDirectivo || (c.tambienCopasst && esCopasst)).map(c => (
          <label key={c.id} className="flex items-center justify-between gap-3 py-2 border-b border-line last:border-0">
            <span>
              <span className="block text-strong text-sm">{c.label}</span>
              <span className="block text-muted text-xs mt-0.5">{c.descripcion}</span>
            </span>
            <input
              type="checkbox"
              checked={prefs[c.id]}
              disabled={guardando}
              onChange={e => alCambiar(c.id, e.target.checked)}
              className="w-5 h-5 accent-current flex-shrink-0"
            />
          </label>
        ))}
      </div>

      <div className="text-muted text-xs space-y-1 px-1">
        <p>Nada llega entre las 9:00 p. m. y las 5:30 a. m.: lo que ocurra en ese lapso se entrega a las 5:30 a. m.</p>
        <p>En iPhone, solo con la aplicación agregada a la pantalla de inicio (iOS 16.4 o más reciente).</p>
      </div>
    </div>
  );
}
