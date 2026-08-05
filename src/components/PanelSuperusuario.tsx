import { useEffect, useState } from 'react';
import { mapaDirectores, sincronizarAutoridadSede, sincronizarDirectores } from '../data/directoresSync';
import { sincronizarCuentasUsuarios } from '../data/usuariosSync';
import { useAppStore } from '../data/store';
import { firebaseConfigurado, functions, db } from '../lib/firebase';
import { httpsCallable } from 'firebase/functions';
import { collection, doc, getDoc, getDocs } from 'firebase/firestore';
import {
  listarUsuarios,
  crearDocente,
  cambiarRol,
  setActivo,
  type UsuarioFirestore,
  type RolUsuario,
} from '../data/adminUsers';
import { SEDES, USUARIOS, type SedeId } from '../data/maestros';

type CambioReemplazo = { campo: string; de?: string; a: string; valor?: string; usuario?: string };
type ResultadoReemplazo = { dryRun: boolean; slot: string; changes: CambioReemplazo[] };

type LogAuditoria = {
  id: string;
  action?: string;
  executedBy?: string;
  executedAt?: { toDate?: () => Date } | null;
  outgoingEmail?: string;
  incomingEmail?: string;
  dryRun?: boolean;
  status?: string;
  errorMessage?: string | null;
};

const ROLES: RolUsuario[] = ['docente', 'coordinador', 'superusuario'];

const ROL_LABEL: Record<RolUsuario, string> = {
  docente: 'Docente',
  coordinador: 'Coordinador',
  superusuario: 'Superusuario',
};

type Mensaje = { tipo: 'ok' | 'error'; texto: string };

const ROL_VER_COMO_LABEL: Record<string, string> = {
  rectora: 'Rectora',
  coordinador: 'Coordinador',
  docente: 'Docente',
  superusuario: 'Superusuario',
};

export default function PanelSuperusuario() {
  const { userId, nombre, rol } = useAppStore();
  const identidadReal = useAppStore((s) => s.identidadReal);
  const simularUsuario = useAppStore((s) => s.simularUsuario);
  const salirSimulacion = useAppStore((s) => s.salirSimulacion);
  const [usuarios, setUsuarios] = useState<UsuarioFirestore[]>([]);
  const [cargando, setCargando] = useState(true);
  const [mensaje, setMensaje] = useState<Mensaje | null>(null);

  // "Ver como" — buscador + selección
  const [busquedaVerComo, setBusquedaVerComo] = useState('');
  const [seleccionVerComo, setSeleccionVerComo] = useState('');

  // Formulario de alta
  const [correo, setCorreo] = useState('');
  const [nombreNuevo, setNombreNuevo] = useState('');
  const [rolNuevo, setRolNuevo] = useState<RolUsuario>('docente');
  const [slotNuevo, setSlotNuevo] = useState('');
  const [sedeNueva, setSedeNueva] = useState<SedeId>('central');
  const [jornadaNueva, setJornadaNueva] = useState<'manana' | 'tarde' | 'ambas'>('manana');
  const [creando, setCreando] = useState(false);

  // Reemplazo de docente
  const [salienteEmail, setSalienteEmail] = useState('');
  const [entranteEmail, setEntranteEmail] = useState('');
  const [previa, setPrevia] = useState<ResultadoReemplazo | null>(null);
  const [previendo, setPreviendo] = useState(false);
  const [ejecutando, setEjecutando] = useState(false);
  const [mensajeReemplazo, setMensajeReemplazo] = useState<Mensaje | null>(null);

  // Espejo de directores de grupo para las reglas de asistencia.
  const [sincronizandoDir, setSincronizandoDir] = useState(false);
  const [mensajeDir, setMensajeDir] = useState<Mensaje | null>(null);
  const [sincronizandoCuentas, setSincronizandoCuentas] = useState(false);
  const [mensajeCuentas, setMensajeCuentas] = useState<Mensaje | null>(null);
  const [espejoDirectores, setEspejoDirectores] = useState<Record<string, string> | null>(null);
  const [cargandoEspejo, setCargandoEspejo] = useState(false);
  const [errorEspejo, setErrorEspejo] = useState<string | null>(null);

  // Auditoría
  const [logs, setLogs] = useState<LogAuditoria[] | null>(null);
  const [cargandoLogs, setCargandoLogs] = useState(false);

  // Identidad del superusuario actual (para anti-auto-modificación).
  // En modo google el id del store es el correo cuando no hay usuario interno.
  const yoEmail = (userId ?? '').toLowerCase();
  const creadoPor = yoEmail || nombre || 'superusuario';

  async function recargar() {
    setCargando(true);
    try {
      const lista = await listarUsuarios();
      setUsuarios(lista);
    } catch (e) {
      setMensaje({ tipo: 'error', texto: (e as Error).message });
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    if (firebaseConfigurado) recargar();
    else setCargando(false);
  }, []);

  async function handleCrear(e: React.FormEvent) {
    e.preventDefault();
    setMensaje(null);
    setCreando(true);
    try {
      await crearDocente(correo, nombreNuevo, rolNuevo, creadoPor, slotNuevo.trim() || null, sedeNueva, jornadaNueva);
      setMensaje({ tipo: 'ok', texto: 'Usuario creado correctamente.' });
      setCorreo('');
      setNombreNuevo('');
      setRolNuevo('docente');
      setSlotNuevo('');
      setSedeNueva('central');
      setJornadaNueva('manana');
      await recargar();
    } catch (e) {
      setMensaje({ tipo: 'error', texto: (e as Error).message });
    } finally {
      setCreando(false);
    }
  }

  async function handleRol(u: UsuarioFirestore, role: RolUsuario) {
    setMensaje(null);
    try {
      await cambiarRol(u.email, role);
      await recargar();
    } catch (e) {
      setMensaje({ tipo: 'error', texto: (e as Error).message });
    }
  }

  async function handleActivo(u: UsuarioFirestore, active: boolean) {
    setMensaje(null);
    try {
      await setActivo(u.email, active);
      await recargar();
    } catch (e) {
      setMensaje({ tipo: 'error', texto: (e as Error).message });
    }
  }

  // ── Reemplazo de docente (Etapa 5) ──────────────────────────────────
  const salientes = usuarios.filter((u) => u.active && u.slotId);
  const entrantes = usuarios.filter((u) => u.active && !u.slotId && u.email !== salienteEmail);

  async function handlePrevisualizar() {
    setMensajeReemplazo(null);
    setPrevia(null);
    if (!functions) {
      setMensajeReemplazo({ tipo: 'error', texto: 'Firebase Functions no está configurado.' });
      return;
    }
    setPreviendo(true);
    try {
      const call = httpsCallable(functions, 'replaceTeacher');
      const res = await call({ outgoingEmail: salienteEmail, incomingEmail: entranteEmail, dryRun: true });
      setPrevia(res.data as ResultadoReemplazo);
    } catch (e) {
      setMensajeReemplazo({ tipo: 'error', texto: (e as Error).message });
    } finally {
      setPreviendo(false);
    }
  }

  async function handleEjecutarReemplazo() {
    if (!functions || !previa) return;
    const ok = window.confirm(
      `¿Confirmas reemplazar a ${salienteEmail} por ${entranteEmail}? Esta acción no se puede deshacer desde el panel.`,
    );
    if (!ok) return;
    setMensajeReemplazo(null);
    setEjecutando(true);
    try {
      const call = httpsCallable(functions, 'replaceTeacher');
      await call({ outgoingEmail: salienteEmail, incomingEmail: entranteEmail, dryRun: false });
      setMensajeReemplazo({ tipo: 'ok', texto: 'Reemplazo ejecutado correctamente.' });
      setPrevia(null);
      setSalienteEmail('');
      setEntranteEmail('');
      await recargar();
    } catch (e) {
      setMensajeReemplazo({ tipo: 'error', texto: (e as Error).message });
    } finally {
      setEjecutando(false);
    }
  }

  // ── Auditoría (solo lectura) ────────────────────────────────────────
  async function cargarAuditoria() {
    if (!db) return;
    setCargandoLogs(true);
    try {
      const snap = await getDocs(collection(db, 'auditLogs'));
      const lista: LogAuditoria[] = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<LogAuditoria, 'id'>) }));
      lista.sort((a, b) => {
        const ta = a.executedAt?.toDate?.()?.getTime() ?? 0;
        const tb = b.executedAt?.toDate?.()?.getTime() ?? 0;
        return tb - ta;
      });
      setLogs(lista.slice(0, 50));
    } catch (e) {
      setMensajeReemplazo({ tipo: 'error', texto: (e as Error).message });
    } finally {
      setCargandoLogs(false);
    }
  }

  const puedeVerComo = rol === 'superusuario' || !!identidadReal;
  const propioIdReal = identidadReal?.userId ?? userId;
  const usuariosFiltrados = USUARIOS.filter((u) => {
    if (u.id === propioIdReal) return false; // para verse a sí mismo está el interruptor del header
    const q = busquedaVerComo.trim().toLowerCase();
    if (!q) return true;
    return u.nombre.toLowerCase().includes(q) || u.nombreCorto.toLowerCase().includes(q) || u.rol.includes(q);
  });

  function handleVerComo() {
    if (!seleccionVerComo) return;
    simularUsuario(seleccionVerComo);
    setSeleccionVerComo('');
  }

  const seccionVerComo = puedeVerComo && (
    <div className="bg-card rounded-xl p-5 space-y-3 max-w-xl">
      <h3 className="text-strong font-semibold">👁 Ver como otro usuario</h3>
      <p className="text-muted text-xs leading-snug">
        Revisa la app tal como la vería otro rol. Tu identidad real sigue
        siendo la tuya; puedes volver en cualquier momento.
      </p>

      {identidadReal ? (
        <div className="rounded-lg bg-warning-soft text-warning-soft-fg text-xs px-3 py-2 flex items-center justify-between gap-3">
          <span>
            Simulando a <strong>{nombre}</strong> ({rol}). Identidad real: {identidadReal.nombre}.
          </span>
          <button
            type="button"
            onClick={salirSimulacion}
            className="flex-shrink-0 px-3 py-1.5 rounded-md bg-elevated text-strong text-xs font-medium hover:opacity-90 transition"
          >
            Volver a mi identidad
          </button>
        </div>
      ) : (
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            placeholder="Buscar por nombre o rol…"
            value={busquedaVerComo}
            onChange={(e) => setBusquedaVerComo(e.target.value)}
            className="w-full sm:w-48 px-3 py-2 rounded-lg bg-elevated border border-line text-strong text-sm placeholder:text-muted focus:outline-none focus:border-line-strong"
          />
          <select
            value={seleccionVerComo}
            onChange={(e) => setSeleccionVerComo(e.target.value)}
            className="flex-1 px-3 py-2 rounded-lg bg-elevated border border-line text-strong text-sm focus:outline-none focus:border-line-strong"
          >
            <option value="">Seleccionar usuario…</option>
            {usuariosFiltrados.map((u) => (
              <option key={u.id} value={u.id}>
                {u.nombreCorto} — {ROL_VER_COMO_LABEL[u.rol] ?? u.rol}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={handleVerComo}
            disabled={!seleccionVerComo}
            className="px-4 py-2 rounded-lg bg-accent text-strong text-sm font-medium hover:opacity-90 transition disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
          >
            Ver como este usuario
          </button>
        </div>
      )}
    </div>
  );

  async function handleSincronizarDirectores() {
    setSincronizandoDir(true);
    setMensajeDir(null);
    try {
      const total = await sincronizarDirectores();
      const sedes = await sincronizarAutoridadSede();
      setMensajeDir({
        tipo: 'ok',
        texto: `${total} directores de grupo y la autoridad de ${sedes} sedes sincronizados.`,
      });
    } catch (e: any) {
      setMensajeDir({ tipo: 'error', texto: e?.message || 'No se pudo sincronizar.' });
    } finally {
      setSincronizandoDir(false);
    }
  }

  async function handleSincronizarCuentas() {
    setSincronizandoCuentas(true);
    setMensajeCuentas(null);
    try {
      const { creadas, reparadas } = await sincronizarCuentasUsuarios();
      const partes: string[] = [];
      if (creadas.length > 0) partes.push(`${creadas.length} cuenta(s) nueva(s): ${creadas.join(', ')}`);
      if (reparadas.length > 0) {
        partes.push(
          `Puesto repuesto a ${reparadas.length}: ` +
            reparadas.map((r) => `${r.correo} → ${r.slotId}`).join(', ') +
            '. Quien estuviera afectado debe cerrar sesión y volver a entrar.',
        );
      }
      setMensajeCuentas({
        tipo: 'ok',
        texto:
          partes.length === 0
            ? 'Todo al día: ninguna cuenta faltaba y ninguna tenía el puesto vacío.'
            : partes.join(' · '),
      });
    } catch (e: any) {
      setMensajeCuentas({ tipo: 'error', texto: e?.message || 'No se pudo sincronizar.' });
    } finally {
      setSincronizandoCuentas(false);
    }
  }

  /**
   * Lee el espejo `asistenciaConfig/directores` TAL COMO LO VE EL SERVIDOR.
   *
   * Es el único lado que no se puede deducir desde el código: las reglas comparan
   * `mapa[grado]` contra `users/{correo}.slotId`, y si ningún usuario activo tiene
   * ese puesto, el docente queda sin poder subir fotos ni editar fichas aunque la
   * app —que resuelve el puesto contra la lista estática— sí lo habilite.
   */
  async function handleCargarEspejo() {
    setCargandoEspejo(true);
    setErrorEspejo(null);
    try {
      if (!db) throw new Error('Firebase no está configurado.');
      const snap = await getDoc(doc(db, 'asistenciaConfig', 'directores'));
      if (!snap.exists()) {
        setErrorEspejo(
          'El documento asistenciaConfig/directores NO EXISTE. Sin él, ningún docente ' +
            'es reconocido como director. Pulse «Sincronizar permisos» arriba.',
        );
        setEspejoDirectores(null);
        return;
      }
      setEspejoDirectores((snap.data().mapa ?? {}) as Record<string, string>);
    } catch (e: any) {
      setErrorEspejo(e?.message || 'No se pudo leer el espejo de directores.');
    } finally {
      setCargandoEspejo(false);
    }
  }

  if (!firebaseConfigurado) {
    return (
      <div className="space-y-5">
        {seccionVerComo}
        <div className="max-w-md mx-auto">
          <div className="rounded-xl bg-info-soft text-info-soft-fg text-sm px-4 py-4 leading-snug">
            Disponible solo con autenticación Google activa.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {seccionVerComo}

      <div>
        <h2 className="text-strong text-lg font-semibold">Gestión de usuarios</h2>
        <p className="text-muted text-xs mt-1">
          Alta de docentes, cambio de rol y activación en Firestore.
        </p>
      </div>

      {/* Espejo de directores de grupo. Las reglas de seguridad del módulo de
          asistencia no pueden leer maestros.ts, así que necesitan este
          documento para saber quién dirige cada grupo. */}
      <div className="rounded-xl border border-line bg-card p-3 space-y-2">
        <div>
          <h3 className="text-strong text-sm font-semibold">Directores y autoridad por sede</h3>
          <p className="text-muted text-xs mt-0.5 leading-snug">
            Copia a Firestore los {Object.keys(mapaDirectores()).length} directores de grupo y qué
            coordinador manda en cada sede. Los permisos de asistencia leen esos datos de ahí, porque
            las reglas no pueden consultar el código. Vuelve a pulsarlo cuando cambie un director o
            la autoridad de una sede.
          </p>
        </div>
        <button
          onClick={handleSincronizarDirectores}
          disabled={sincronizandoDir}
          className="px-3 py-2 rounded-lg bg-elevated hover:bg-hover text-soft hover:text-strong text-xs font-medium transition disabled:opacity-50"
        >
          {sincronizandoDir ? 'Sincronizando…' : 'Sincronizar permisos'}
        </button>
        {mensajeDir && (
          <p className={'text-xs ' + (mensajeDir.tipo === 'ok' ? 'text-success-soft-fg' : 'text-danger')}>
            {mensajeDir.texto}
          </p>
        )}
      </div>

      {/* Cuentas de acceso: agregar a alguien en USUARIOS (código) no le da
          acceso a la app por sí solo — hace falta este paso aparte en
          Firestore. Antes requería el panel uno por uno o una clave de
          servicio; esto lo deja en un clic. Solo CREA, nunca sobreescribe
          una cuenta que ya existe. */}
      <div className="rounded-xl border border-line bg-card p-3 space-y-2">
        <div>
          <h3 className="text-strong text-sm font-semibold">Cuentas de acceso</h3>
          <p className="text-muted text-xs mt-0.5 leading-snug">
            Crea la cuenta de Firestore de cualquier correo de USUARIOS (maestros.ts) que todavía no
            pueda entrar a la app, y repone el <b>puesto</b> a las cuentas activas que lo tengan
            vacío. Sin el puesto, el servidor no reconoce a un docente como director de su grupo
            aunque la app sí lo muestre: no puede subir fotos ni editar fichas. No pisa ningún dato
            que ya esté puesto.
          </p>
        </div>
        <button
          onClick={handleSincronizarCuentas}
          disabled={sincronizandoCuentas}
          className="px-3 py-2 rounded-lg bg-elevated hover:bg-hover text-soft hover:text-strong text-xs font-medium transition disabled:opacity-50"
        >
          {sincronizandoCuentas ? 'Sincronizando…' : 'Crear y reparar cuentas'}
        </button>
        {mensajeCuentas && (
          <p className={'text-xs ' + (mensajeCuentas.tipo === 'ok' ? 'text-success-soft-fg' : 'text-danger')}>
            {mensajeCuentas.texto}
          </p>
        )}

        {/*
          Diagnóstico del puesto (slotId). Es EL dato que hace que un docente sea
          reconocido como director de su grupo, y el más difícil de ver: la app lo
          resuelve contra la lista estática y el servidor contra Firestore, así que
          cuando no coinciden la app habilita botones que el servidor rechaza.
          Aquí se ven los dos lados juntos, que es lo único que permite decidir cuál
          de los dos está mal — reponer a ciegas rompería un reemplazo de docente.
        */}
        {(() => {
          const filas = usuarios
            .filter((u) => u.active)
            .map((u) => {
              const correo = (u.email || '').toLowerCase();
              const estatico = USUARIOS.find((s) => (s.correo || '').toLowerCase() === correo);
              return { correo, enFirestore: u.slotId || null, enCodigo: estatico?.id ?? null };
            })
            .filter((f) => f.enCodigo !== null && f.enFirestore !== f.enCodigo);
          if (filas.length === 0) return null;
          return (
            <details className="rounded-lg border border-warning bg-warning-soft p-2 text-xs">
              <summary className="cursor-pointer text-warning-soft-fg">
                {filas.length} cuenta(s) con el puesto distinto al del código — puede impedir subir
                fotos o editar fichas
              </summary>
              <table className="mt-2 w-full text-left">
                <thead className="text-muted">
                  <tr>
                    <th className="pr-2 font-medium">Correo</th>
                    <th className="pr-2 font-medium">En Firestore</th>
                    <th className="font-medium">En el código</th>
                  </tr>
                </thead>
                <tbody className="text-soft">
                  {filas.map((f) => (
                    <tr key={f.correo}>
                      <td className="pr-2">{f.correo}</td>
                      <td className="pr-2 font-mono">{f.enFirestore ?? '(vacío)'}</td>
                      <td className="font-mono">{f.enCodigo}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-2 text-muted">
                El servidor usa la columna «En Firestore». Si una fila corresponde a un reemplazo de
                docente, el valor de Firestore es el correcto y no hay que tocarlo.
              </p>
            </details>
          );
        })()}
      </div>

      {/* Diagnóstico de dirección de grupo: cruza el espejo que leen las REGLAS con
          el slotId real de cada cuenta. Si un grado apunta a un puesto que ninguna
          cuenta activa tiene, ese director no puede subir fotos ni editar fichas,
          aunque la app se lo ofrezca. */}
      <div className="rounded-xl border border-line bg-card p-3 space-y-2">
        <div>
          <h3 className="text-strong text-sm font-semibold">Diagnóstico de dirección de grupo</h3>
          <p className="text-muted text-xs mt-0.5 leading-snug">
            Muestra lo que el servidor ve realmente al decidir si alguien es director: el grado, el
            puesto registrado en el espejo, y qué cuenta activa ocupa ese puesto. Si una fila sale en
            rojo, ese director no podrá subir fotos ni editar fichas.
          </p>
        </div>
        <button
          onClick={handleCargarEspejo}
          disabled={cargandoEspejo}
          className="px-3 py-2 rounded-lg bg-elevated hover:bg-hover text-soft hover:text-strong text-xs font-medium transition disabled:opacity-50"
        >
          {cargandoEspejo ? 'Leyendo…' : 'Revisar quién es director según el servidor'}
        </button>

        {errorEspejo && <p className="text-xs text-danger">{errorEspejo}</p>}

        {espejoDirectores && (() => {
          const activos = usuarios.filter((u) => u.active);
          const filas = Object.entries(espejoDirectores).map(([grado, slot]) => {
            const cuenta = activos.find((u) => u.slotId === slot);
            return { grado, slot, correo: cuenta?.email ?? null };
          });
          const rotas = filas.filter((f) => !f.correo);
          return (
            <div className="space-y-2">
              <p className={'text-xs ' + (rotas.length === 0 ? 'text-success-soft-fg' : 'text-danger')}>
                {rotas.length === 0
                  ? `Los ${filas.length} grados apuntan a una cuenta activa. La dirección de grupo está bien.`
                  : `${rotas.length} de ${filas.length} grados apuntan a un puesto que NINGUNA cuenta activa tiene.`}
              </p>
              <div className="max-h-64 overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="text-muted sticky top-0 bg-card">
                    <tr>
                      <th className="pr-2 font-medium">Grado</th>
                      <th className="pr-2 font-medium">Puesto en el espejo</th>
                      <th className="font-medium">Cuenta activa con ese puesto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filas
                      .sort((a, b) => (a.correo ? 1 : 0) - (b.correo ? 1 : 0))
                      .map((f) => (
                        <tr key={f.grado} className={f.correo ? 'text-soft' : 'text-danger'}>
                          <td className="pr-2 font-mono">{f.grado}</td>
                          <td className="pr-2 font-mono">{f.slot}</td>
                          <td>{f.correo ?? '⚠ ninguna'}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })()}
      </div>

      {mensaje && (
        <div
          className={
            'rounded-lg text-xs px-3 py-2 ' +
            (mensaje.tipo === 'ok'
              ? 'bg-success-soft text-success-soft-fg'
              : 'bg-danger-soft text-danger-soft-fg')
          }
        >
          {mensaje.texto}
        </div>
      )}

      {/* ── Formulario de alta ─────────────────────────────────────── */}
      <form onSubmit={handleCrear} className="bg-card rounded-xl p-5 space-y-3 max-w-xl">
        <h3 className="text-strong font-semibold">Nuevo usuario</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <input
            type="email"
            placeholder="correo@iemanueljbetancur.edu.co"
            value={correo}
            onChange={(e) => setCorreo(e.target.value)}
            className="w-full px-3 py-2 rounded-lg bg-elevated border border-line text-strong text-sm placeholder:text-muted focus:outline-none focus:border-line-strong"
          />
          <input
            type="text"
            placeholder="Nombre completo"
            value={nombreNuevo}
            onChange={(e) => setNombreNuevo(e.target.value)}
            className="w-full px-3 py-2 rounded-lg bg-elevated border border-line text-strong text-sm placeholder:text-muted focus:outline-none focus:border-line-strong"
          />
        </div>
        <div className="flex items-center gap-3">
          <select
            value={rolNuevo}
            onChange={(e) => setRolNuevo(e.target.value as RolUsuario)}
            className="px-3 py-2 rounded-lg bg-elevated border border-line text-strong text-sm focus:outline-none focus:border-line-strong"
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {ROL_LABEL[r]}
              </option>
            ))}
          </select>
          <button
            type="submit"
            disabled={creando || !correo || !nombreNuevo}
            className="px-5 py-2 rounded-lg bg-accent text-strong text-sm font-medium hover:opacity-90 transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {creando ? 'Creando…' : 'Crear'}
          </button>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <input
              type="text"
              placeholder="Puesto (id interno) — opcional"
              value={slotNuevo}
              onChange={(e) => setSlotNuevo(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-elevated border border-line text-strong text-sm placeholder:text-muted focus:outline-none focus:border-line-strong"
            />
            <p className="text-muted text-xs mt-1">
              Dejar vacío si es un docente nuevo sin puesto en el horario.
            </p>
          </div>
          <div>
            <label className="text-muted text-xs">Sede</label>
            <select
              value={sedeNueva}
              onChange={(e) => setSedeNueva(e.target.value as SedeId)}
              className="w-full px-3 py-2 rounded-lg bg-elevated border border-line text-strong text-sm focus:outline-none focus:border-line-strong"
            >
              {SEDES.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nombre}{!s.configurada ? ' (en configuración)' : ''}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-muted text-xs">Jornada</label>
            <select
              value={jornadaNueva}
              onChange={(e) => setJornadaNueva(e.target.value as 'manana' | 'tarde' | 'ambas')}
              className="w-full px-3 py-2 rounded-lg bg-elevated border border-line text-strong text-sm focus:outline-none focus:border-line-strong"
            >
              <option value="manana">Mañana</option>
              <option value="tarde">Tarde</option>
              <option value="ambas">Ambas</option>
            </select>
          </div>
        </div>
      </form>

      {/* Nota de seguridad */}
      <div className="rounded-lg bg-elevated text-muted text-xs px-3 py-2 leading-snug max-w-xl">
        El superusuario no puede cambiarse el propio rol ni desactivarse (regla de seguridad).
      </div>

      {/* ── Tabla de usuarios ──────────────────────────────────────── */}
      {cargando ? (
        <div className="text-center py-10 text-soft">Cargando…</div>
      ) : usuarios.length === 0 ? (
        <div className="text-center py-10 text-muted">No hay usuarios registrados.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="text-left text-muted border-b border-line">
                <th className="py-2 pr-4 font-medium">Nombre</th>
                <th className="py-2 pr-4 font-medium">Correo</th>
                <th className="py-2 pr-4 font-medium">Rol</th>
                <th className="py-2 pr-4 font-medium">Estado</th>
              </tr>
            </thead>
            <tbody>
              {usuarios.map((u) => {
                const esYo = u.email.toLowerCase() === yoEmail;
                return (
                  <tr key={u.email} className="border-b border-line/60">
                    <td className="py-2 pr-4 text-strong">{u.displayName}</td>
                    <td className="py-2 pr-4 text-soft">{u.email}</td>
                    <td className="py-2 pr-4">
                      <select
                        value={u.role}
                        disabled={esYo}
                        onChange={(e) => handleRol(u, e.target.value as RolUsuario)}
                        className="px-2 py-1 rounded-md bg-elevated border border-line text-strong text-xs focus:outline-none focus:border-line-strong disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        {ROLES.map((r) => (
                          <option key={r} value={r}>
                            {ROL_LABEL[r]}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="py-2 pr-4">
                      <div className="flex items-center gap-2">
                        <span
                          className={
                            'text-xs rounded-full px-2 py-0.5 ' +
                            (u.active
                              ? 'bg-success-soft text-success-soft-fg'
                              : 'bg-danger-soft text-danger-soft-fg')
                          }
                        >
                          {u.active ? 'Activo' : 'Inactivo'}
                        </span>
                        <button
                          onClick={() => handleActivo(u, !u.active)}
                          disabled={esYo}
                          className="text-xs px-2 py-1 rounded-md bg-elevated text-soft hover:text-strong transition disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          {u.active ? 'Desactivar' : 'Activar'}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Reemplazar docente ─────────────────────────────────────── */}
      <div className="bg-card rounded-xl p-5 space-y-3 max-w-xl">
        <h3 className="text-strong font-semibold">Reemplazar docente</h3>
        <p className="text-muted text-xs leading-snug">
          Mueve el puesto (horario, aulas, grupos) de un docente saliente a
          uno entrante. El entrante debe existir y estar activo, y no puede
          ocupar ya otro puesto.
        </p>

        {mensajeReemplazo && (
          <div
            className={
              'rounded-lg text-xs px-3 py-2 ' +
              (mensajeReemplazo.tipo === 'ok'
                ? 'bg-success-soft text-success-soft-fg'
                : 'bg-danger-soft text-danger-soft-fg')
            }
          >
            {mensajeReemplazo.texto}
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="text-muted text-xs">Saliente</label>
            <select
              value={salienteEmail}
              onChange={(e) => { setSalienteEmail(e.target.value); setPrevia(null); }}
              className="w-full px-3 py-2 rounded-lg bg-elevated border border-line text-strong text-sm focus:outline-none focus:border-line-strong"
            >
              <option value="">Seleccionar…</option>
              {salientes.map((u) => (
                <option key={u.email} value={u.email}>
                  {u.displayName} ({u.slotId})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-muted text-xs">Entrante</label>
            <select
              value={entranteEmail}
              onChange={(e) => { setEntranteEmail(e.target.value); setPrevia(null); }}
              className="w-full px-3 py-2 rounded-lg bg-elevated border border-line text-strong text-sm focus:outline-none focus:border-line-strong"
            >
              <option value="">Seleccionar…</option>
              {entrantes.map((u) => (
                <option key={u.email} value={u.email}>
                  {u.displayName}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handlePrevisualizar}
            disabled={previendo || !salienteEmail || !entranteEmail}
            className="px-4 py-2 rounded-lg bg-elevated text-strong text-sm font-medium hover:opacity-90 transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {previendo ? 'Previsualizando…' : 'Previsualizar'}
          </button>
          <button
            type="button"
            onClick={handleEjecutarReemplazo}
            disabled={!previa || ejecutando}
            className="px-4 py-2 rounded-lg bg-danger-soft text-danger-soft-fg text-sm font-medium hover:opacity-90 transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {ejecutando ? 'Ejecutando…' : 'Ejecutar reemplazo'}
          </button>
        </div>

        {previa && (
          <div className="rounded-lg bg-elevated text-xs px-3 py-2 space-y-1">
            <p className="text-strong font-medium">Puesto: {previa.slot}</p>
            {previa.changes.map((c, i) => (
              <p key={i} className="text-soft">
                {c.usuario
                  ? `${c.campo} de ${c.usuario} → ${String(c.a)}`
                  : `${c.campo}: ${c.de} → ${c.a}${c.valor ? ` (${c.valor})` : ''}`}
              </p>
            ))}
          </div>
        )}
      </div>

      {/* ── Auditoría ───────────────────────────────────────────────── */}
      <div className="bg-card rounded-xl p-5 space-y-3 max-w-2xl">
        <div className="flex items-center justify-between">
          <h3 className="text-strong font-semibold">Auditoría</h3>
          <button
            type="button"
            onClick={cargarAuditoria}
            disabled={cargandoLogs}
            className="text-xs px-3 py-1.5 rounded-md bg-elevated text-soft hover:text-strong transition disabled:opacity-40"
          >
            {cargandoLogs ? 'Cargando…' : 'Ver auditoría'}
          </button>
        </div>
        {logs && (
          logs.length === 0 ? (
            <p className="text-muted text-xs">Sin registros.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="text-left text-muted border-b border-line">
                    <th className="py-2 pr-3 font-medium">Fecha</th>
                    <th className="py-2 pr-3 font-medium">Ejecutado por</th>
                    <th className="py-2 pr-3 font-medium">Saliente → Entrante</th>
                    <th className="py-2 pr-3 font-medium">Dry run</th>
                    <th className="py-2 pr-3 font-medium">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((l) => (
                    <tr key={l.id} className="border-b border-line/60">
                      <td className="py-2 pr-3 text-soft">
                        {l.executedAt?.toDate?.()?.toLocaleString('es-CO') ?? '—'}
                      </td>
                      <td className="py-2 pr-3 text-soft">{l.executedBy}</td>
                      <td className="py-2 pr-3 text-soft">
                        {l.outgoingEmail} → {l.incomingEmail}
                      </td>
                      <td className="py-2 pr-3 text-soft">{l.dryRun ? 'Sí' : 'No'}</td>
                      <td className="py-2 pr-3">
                        <span
                          className={
                            'text-xs rounded-full px-2 py-0.5 ' +
                            (l.status === 'ok'
                              ? 'bg-success-soft text-success-soft-fg'
                              : 'bg-danger-soft text-danger-soft-fg')
                          }
                        >
                          {l.status ?? '—'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}
      </div>
    </div>
  );
}
