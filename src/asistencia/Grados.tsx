import { useEffect, useMemo, useRef, useState } from 'react';
import { QrCode } from 'lucide-react';
import { PestanasSubrayadas } from '../components/Navegacion';
import EscanerQr from './EscanerQr';
import VerificacionFoto from './VerificacionFoto';
import { buscarEstudiantes, buscarPorQrToken, leerEstudiantesDeSede } from './datos';
import {
  ErrorGrados,
  administrarGrados,
  escucharAforo,
  escucharGraduandos,
  leerEstudiante,
  leerEventosGrados,
  leerGraduando,
  leerIngresos,
  leerInvitacion,
  leerInvitaciones,
  puertaGrados,
  type IngresoRegistrado,
  type VistaInvitacion,
} from './datos-grados';
import {
  CAPACIDAD_POR_DEFECTO,
  CATEGORIAS_MANUAL,
  RESUMEN_VACIO,
  cantidadesDisponibles,
  compararParaHoja,
  cuposRestantes,
  esCodigoInvitacion,
  etiquetaCantidad,
  horaCorta,
  lecturaDeGraduando,
  lecturaDeInvitacion,
  nivelAforo,
  totalAforo,
  ultimoRegistroVigente,
  type CategoriaManual,
  type EventoGrados,
  type Graduando,
  type Invitacion,
  type ResumenAforo,
} from './domain/grados-evento';
import { imprimirHojasQr } from './hojas-qr-grados';
import { emitirSenal, guardarSonido, nivelDeLectura, prepararAudio, sonidoActivo, type NivelSenal } from './senales-grados';
import { correoAutorAsync } from './identidad';
import { compararEstudiantes } from './domain/nombres';
import type { Student } from './domain/types';

/**
 * Grados 2026 — invitaciones con QR y aforo (Julian, 2026-11-24). PRD: docs/grados/PRD.md.
 *
 * Quien ve que:
 *  - porteria (lista del evento), coordinacion y superusuario: Lector, Graduandos, Aforo;
 *  - coordinacion y superusuario, ademas: Preparar (invitaciones, hojas de QR, cierre);
 *  - el director de un grupo del evento: SOLO Graduandos de su grupo.
 * Lo que se muestra es comodidad: quien decide es el servidor (funciones y reglas).
 */
type Pestana = 'lector' | 'graduandos' | 'aforo' | 'preparar';

export default function Grados({ rol, slotId, directores }: { rol: string | null; slotId: string | null; directores: Record<string, string> }) {
  const [eventos, setEventos] = useState<EventoGrados[] | null>(null);
  const [eventoId, setEventoId] = useState<string | null>(null);
  const [correo, setCorreo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Coordinacion entra a Preparar (lo suyo antes del evento); porteria, al Lector (26-nov).
  const [pestana, setPestana] = useState<Pestana>(() => (rol === 'superusuario' || rol === 'coordinador' ? 'preparar' : 'lector'));

  async function cargarEventos() {
    try {
      const lista = await leerEventosGrados();
      setEventos(lista);
      setEventoId((actual) => actual ?? lista.find((e) => !e.ensayo && e.estado === 'abierto')?.eventoId ?? lista[0]?.eventoId ?? null);
    } catch (e) {
      setError((e as Error).message);
      setEventos([]);
    }
  }
  useEffect(() => {
    void cargarEventos();
    void correoAutorAsync().then(setCorreo);
  }, []);

  const evento = eventos?.find((e) => e.eventoId === eventoId) ?? null;
  const esCoord = rol === 'superusuario' || rol === 'coordinador';
  const esPorteria = !!evento && !!correo && evento.porteria.includes(correo);
  const puerta = esCoord || esPorteria;
  const misGrados = evento ? evento.grados.filter((g) => slotId && directores[g] === slotId) : [];

  const opciones = useMemo(() => {
    const o: { id: Pestana; label: string }[] = [];
    if (puerta) o.push({ id: 'lector', label: 'Lector' });
    if (puerta || misGrados.length > 0) o.push({ id: 'graduandos', label: 'Graduandos' });
    if (puerta) o.push({ id: 'aforo', label: 'Aforo' });
    if (esCoord) o.push({ id: 'preparar', label: 'Preparar' });
    return o;
  }, [puerta, misGrados.length, esCoord]);
  const activa = opciones.some((o) => o.id === pestana) ? pestana : opciones[0]?.id;

  if (eventos === null) return <p className="p-3 text-sm text-muted">Cargando grados…</p>;
  if (error) return <Aviso tono="rojo">{error}</Aviso>;

  // El ensayo y el evento real se crean por separado: si ya existe uno, se ofrece el otro
  // (pedido 26-nov: creado primero el ensayo, desaparecia el boton del evento real).
  const faltaReal = !eventos.some((e) => !e.ensayo);
  const faltaEnsayo = !eventos.some((e) => e.ensayo);
  const alCrear = (id: string) => {
    setEventoId(id);
    setPestana('preparar');
    void cargarEventos();
  };

  if (!evento) {
    return esCoord ? (
      <CrearEventos faltaReal={faltaReal} faltaEnsayo={faltaEnsayo} onCreado={alCrear} />
    ) : (
      <Aviso>Todavía no hay ningún evento de grados.</Aviso>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-base font-semibold text-strong">{evento.nombre}</h2>
        {eventos.length > 1 && (
          <select
            value={evento.eventoId}
            onChange={(e) => setEventoId(e.target.value)}
            className="min-h-[40px] rounded-lg border border-line bg-card px-2 text-sm text-strong"
          >
            {eventos.map((e) => (
              <option key={e.eventoId} value={e.eventoId}>
                {e.nombre}
                {e.ensayo ? ' (ensayo)' : ''}
                {e.estado === 'cerrado' ? ' — cerrado' : ''}
              </option>
            ))}
          </select>
        )}
        {evento.estado === 'cerrado' && <span className="rounded bg-elevated px-2 py-0.5 text-xs text-muted">Evento cerrado</span>}
      </div>

      {opciones.length === 0 ? (
        <Aviso tono="rojo">No está autorizado para portería de grados.</Aviso>
      ) : (
        <>
          {opciones.length > 1 && <PestanasSubrayadas opciones={opciones} activa={activa!} onCambio={setPestana} />}
          {activa === 'lector' && <Lector evento={evento} />}
          {activa === 'graduandos' && <ListaGraduandos evento={evento} grados={puerta ? evento.grados : misGrados} />}
          {activa === 'aforo' && <Aforo evento={evento} esCoord={esCoord} />}
          {activa === 'preparar' && (faltaReal || faltaEnsayo) && (
            <CrearEventos faltaReal={faltaReal} faltaEnsayo={faltaEnsayo} onCreado={alCrear} />
          )}
          {activa === 'preparar' && <Preparar key={evento.eventoId} evento={evento} onCambio={() => void cargarEventos()} />}
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
//  Piezas comunes
// ---------------------------------------------------------------------------

function Aviso({ tono = 'info', children }: { tono?: 'info' | 'rojo' | 'verde'; children: React.ReactNode }) {
  const clase =
    tono === 'rojo'
      ? 'border-danger-soft bg-danger-soft text-danger-soft-fg'
      : tono === 'verde'
        ? 'border-success-soft bg-success-soft text-success-soft-fg'
        : 'border-line bg-card text-soft';
  return <div className={`rounded-xl border p-3 text-sm ${clase}`}>{children}</div>;
}

/** El rojo grande de la puerta: se ve desde lejos. */
function Rojo({ titulo, children }: { titulo: string; children?: React.ReactNode }) {
  return (
    <div className="rounded-xl border-2 border-danger bg-danger-soft p-4 text-danger-soft-fg">
      <p className="text-xl font-bold">{titulo}</p>
      {children && <div className="mt-1 text-sm">{children}</div>}
    </div>
  );
}

const BOTON = 'min-h-[48px] rounded-lg px-4 text-base font-semibold disabled:opacity-50';
const BOTON_PRIMARIO = `${BOTON} bg-accent text-accent-fg`;
const BOTON_SEC = 'min-h-[44px] rounded-lg border border-line px-3 text-sm font-medium text-strong disabled:opacity-50';

function nombreCorto(correo: string | null | undefined) {
  return correo ? correo.split('@')[0] : '—';
}

function TarjetaPrueba({ inv }: { inv: Pick<Invitacion, 'nombre'> }) {
  return (
    <div className="rounded-lg border-2 border-dashed border-line p-3 text-center">
      <p className="text-lg font-bold text-strong">INVITACIÓN DE PRUEBA</p>
      <p className="text-sm text-soft">Invitación de prueba · sin foto</p>
      <p className="text-xs text-muted">{inv.nombre} · solo para el ensayo. En el evento real aquí sale la foto del estudiante.</p>
    </div>
  );
}

/**
 * El boton de la puerta (pedido de Julian, 26-nov): redondo, grande (112 px) y con relieve,
 * para que el pulgar lo encuentre sin mirar. Brillo arriba, sombra abajo, se hunde al
 * presionar; el resplandor cian/magenta es el mismo de FlechaNeon.
 */
function BotonEscanear({ onClick }: { onClick: () => void }) {
  return (
    <div className="flex justify-center py-1">
      <button
        type="button"
        onClick={onClick}
        className="relative flex h-28 w-28 flex-col items-center justify-center gap-1 rounded-full bg-accent text-sm font-bold text-accent-fg transition-[transform,box-shadow] duration-75 [box-shadow:inset_0_3px_0_rgba(255,255,255,0.35),inset_0_-4px_0_rgba(0,0,0,0.25),0_6px_0_rgba(0,0,0,0.35),0_0_14px_rgba(34,211,238,0.55),0_0_28px_rgba(217,70,239,0.35)] active:translate-y-[5px] active:[box-shadow:inset_0_2px_0_rgba(255,255,255,0.25),inset_0_-2px_0_rgba(0,0,0,0.25),0_1px_0_rgba(0,0,0,0.35),0_0_10px_rgba(34,211,238,0.45),0_0_20px_rgba(217,70,239,0.25)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
      >
        <QrCode className="h-9 w-9 [filter:drop-shadow(0_0_3px_rgba(34,211,238,0.8))]" aria-hidden="true" />
        Escanear
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
//  Lector
// ---------------------------------------------------------------------------

type Resultado =
  | { tipo: 'invitacion'; inv: VistaInvitacion; estudiante: Student | null; aviso?: string }
  | { tipo: 'graduando'; g: Graduando; estudiante: Student; aviso?: string }
  | { tipo: 'rojo'; titulo: string; detalle?: React.ReactNode; estudiante?: Student | null; prueba?: VistaInvitacion };

function aVista(inv: Invitacion): VistaInvitacion {
  return { ...inv, restantes: cuposRestantes(inv) };
}

function RegistrosPrevios({ inv }: { inv: Pick<VistaInvitacion, 'registros'> }) {
  const vigentes = inv.registros.filter((r) => !r.deshecho);
  if (vigentes.length === 0) return null;
  return (
    <ul className="mt-1 space-y-0.5 text-sm">
      {vigentes.map((r) => (
        <li key={r.ingresoId}>
          {r.cantidad === 1 ? 'Entró 1' : `Entraron ${r.cantidad}`} a las {horaCorta(r.en)} · registró {nombreCorto(r.por)}
        </li>
      ))}
    </ul>
  );
}

function Lector({ evento }: { evento: EventoGrados }) {
  const [res, setRes] = useState<Resultado | null>(null);
  const [trabajando, setTrabajando] = useState(false);
  // La camara no se pide al entrar: solo cuando se toca «Abrir la cámara» (26-nov).
  const [camara, setCamara] = useState(false);
  const [busca, setBusca] = useState('');
  const [encontrados, setEncontrados] = useState<Student[]>([]);
  const cerrado = evento.estado === 'cerrado';

  // Senales al leer (26-nov): color de la hoja, destello, sonido y vibracion. Solo suenan
  // las LECTURAS (y un rechazo al registrar), no la confirmacion de «Entran 2»: por eso
  // el nivel de la hoja se fija al leer y no se recalcula cuando el cupo baja a cero.
  const [sonido, setSonido] = useState(sonidoActivo);
  const [nivelHoja, setNivelHoja] = useState<NivelSenal | null>(null);
  const [destello, setDestello] = useState<{ nivel: NivelSenal; n: number } | null>(null);
  const senalPendiente = useRef(false);
  useEffect(() => {
    if (!res) {
      setNivelHoja(null);
      return;
    }
    if (!senalPendiente.current) return;
    senalPendiente.current = false;
    const nivel = nivelDeLectura(res);
    setNivelHoja(nivel);
    emitirSenal(nivel, sonido);
    const n = Date.now();
    setDestello({ nivel, n });
    // Sin limpieza en el return: si `res` cambia antes del segundo (p. ej. «Entran 2»),
    // el destello igual debe apagarse. El `n` evita apagar uno mas nuevo.
    setTimeout(() => setDestello((d) => (d?.n === n ? null : d)), 1000);
  }, [res, sonido]);

  useEffect(() => {
    if (busca.trim().length < 2) {
      setEncontrados([]);
      return;
    }
    let vivo = true;
    const t = setTimeout(() => {
      void buscarEstudiantes(evento.sede, busca, false, (g) => evento.grados.includes(g)).then((l) => vivo && setEncontrados(l));
    }, 250);
    return () => {
      vivo = false;
      clearTimeout(t);
    };
  }, [busca, evento.sede, evento.grados]);

  async function mostrarInvitacion(inv: Invitacion | VistaInvitacion | null) {
    const lectura = lecturaDeInvitacion(inv, evento);
    if (lectura.tipo === 'cerrado') return setRes({ tipo: 'rojo', titulo: 'El evento está cerrado' });
    if (lectura.tipo === 'invalida' || !inv) return setRes({ tipo: 'rojo', titulo: 'Invitación no válida' });
    const estudiante = inv.studentId ? await leerEstudiante(inv.studentId) : null;
    const vista = 'restantes' in inv ? inv : aVista(inv);
    if (lectura.tipo === 'agotada') {
      return setRes({
        tipo: 'rojo',
        titulo: inv.cupos === 2 ? 'Ya ingresaron los dos invitados' : `Ya ingresaron los ${inv.cupos} invitados`,
        detalle: <RegistrosPrevios inv={vista} />,
        estudiante,
        prueba: inv.prueba ? vista : undefined,
      });
    }
    setRes({ tipo: 'invitacion', inv: vista, estudiante });
  }

  async function mostrarGraduando(estudiante: Student) {
    const g = await leerGraduando(evento.eventoId, estudiante.studentId);
    const l = lecturaDeGraduando(g, evento);
    if (l.tipo === 'cerrado') return setRes({ tipo: 'rojo', titulo: 'El evento está cerrado' });
    if (l.tipo === 'no_es_graduando') return setRes({ tipo: 'rojo', titulo: 'No es graduando de este evento', estudiante });
    if (l.tipo === 'ya_llego') {
      return setRes({ tipo: 'rojo', titulo: 'El graduando ya llegó', detalle: `A las ${horaCorta(l.en)} · registró ${nombreCorto(l.por)}`, estudiante });
    }
    setRes({ tipo: 'graduando', g: g!, estudiante });
  }

  async function leer(texto: string) {
    if (trabajando) return;
    senalPendiente.current = true;
    setTrabajando(true);
    try {
      if (esCodigoInvitacion(texto)) {
        await mostrarInvitacion(await leerInvitacion(evento.eventoId, texto.trim()));
      } else {
        const { estudiante } = await buscarPorQrToken(evento.sede, texto);
        if (!estudiante) setRes({ tipo: 'rojo', titulo: 'Código no reconocido', detalle: 'No es una invitación ni un carné de este colegio.' });
        else await mostrarGraduando(estudiante);
      }
    } catch (e) {
      setRes({ tipo: 'rojo', titulo: 'No se pudo leer', detalle: (e as Error).message });
    } finally {
      setTrabajando(false);
    }
  }

  async function elegirEstudiante(e: Student) {
    senalPendiente.current = true;
    setBusca('');
    setEncontrados([]);
    setTrabajando(true);
    try {
      const r = await puertaGrados(evento.eventoId, { accion: 'consultarInvitacion', studentId: e.studentId });
      setRes({ tipo: 'invitacion', inv: r.invitacion!, estudiante: e });
    } catch (err) {
      const g = err as ErrorGrados;
      if (g.motivo === 'invalida') setRes({ tipo: 'rojo', titulo: 'Invitación no válida', estudiante: e });
      else setRes({ tipo: 'rojo', titulo: g.sinConexion ? 'Sin conexión' : 'No se pudo consultar', detalle: g.message });
    } finally {
      setTrabajando(false);
    }
  }

  /** Para la busqueda por apellido: el graduando se registra desde aqui tambien. */
  async function elegirGraduando(e: Student) {
    senalPendiente.current = true;
    setBusca('');
    setEncontrados([]);
    await mostrarGraduando(e);
  }

  async function registrar(accion: string, datos: Record<string, unknown>) {
    setTrabajando(true);
    try {
      const r = await puertaGrados(evento.eventoId, { accion, ...datos });
      if (r.invitacion) {
        const est = res && 'estudiante' in res ? (res.estudiante ?? null) : null;
        setRes({ tipo: 'invitacion', inv: r.invitacion, estudiante: est, aviso: accion === 'invitado' ? 'Registrado ✓' : 'Ingreso deshecho' });
      } else if (r.graduando && res && 'estudiante' in res && res.estudiante) {
        setRes({ tipo: 'graduando', g: r.graduando, estudiante: res.estudiante, aviso: r.graduando.llego ? 'Llegada registrada ✓' : 'Llegada deshecha' });
      }
    } catch (e) {
      senalPendiente.current = true;
      const g = e as ErrorGrados;
      const est = res && 'estudiante' in res ? (res.estudiante ?? null) : null;
      if (g.motivo === 'agotada') {
        const inv = g.detalles.invitacion as VistaInvitacion;
        setRes({ tipo: 'rojo', titulo: 'Ya ingresaron los dos invitados', detalle: <RegistrosPrevios inv={inv} />, estudiante: est });
      } else if (g.motivo === 'ya_llego') {
        setRes({ tipo: 'rojo', titulo: 'El graduando ya llegó', detalle: `A las ${horaCorta(g.detalles.en as number)} · registró ${nombreCorto(g.detalles.por as string)}`, estudiante: est });
      } else if (g.motivo === 'invalida') setRes({ tipo: 'rojo', titulo: 'Invitación no válida' });
      else if (g.motivo === 'cerrado') setRes({ tipo: 'rojo', titulo: 'El evento está cerrado' });
      else setRes({ tipo: 'rojo', titulo: g.sinConexion ? 'Sin conexión: no se registró' : 'No se registró', detalle: g.sinConexion ? 'Intente de nuevo. El cupo NO se descontó.' : g.message, estudiante: est });
    } finally {
      setTrabajando(false);
    }
  }

  if (cerrado) return <Aviso>El evento está cerrado: ya no se registran ingresos.</Aviso>;

  return (
    <div className="space-y-3">
      {camara ? (
        <EscanerQr onLeer={(t) => void leer(t)} onCerrar={() => setCamara(false)} pausado={res !== null || trabajando} />
      ) : (
        <div className="flex flex-col items-center gap-1">
          <BotonEscanear
            onClick={() => {
              prepararAudio();
              setCamara(true);
            }}
          />
          <label className="flex min-h-[44px] items-center gap-2 text-sm text-strong">
            <input
              type="checkbox"
              checked={sonido}
              onChange={(e) => {
                const v = e.target.checked;
                if (v) prepararAudio();
                guardarSonido(v);
                setSonido(v);
              }}
              className="h-5 w-5"
            />
            Sonido
          </label>
        </div>
      )}

      {destello && (
        <div
          key={destello.n}
          aria-hidden="true"
          className="pointer-events-none fixed inset-0 z-[60]"
          // Colores fijos de semaforo, no los tokens del tema: en modo claro --color-warning
          // es cafe y no se distingue del rojo de un vistazo, que es todo el proposito.
          style={{
            backgroundColor: destello.nivel === 'verde' ? '#16a34a' : destello.nivel === 'naranja' ? '#f97316' : '#dc2626',
            animation: 'destelloGrados 1s ease-out forwards',
          }}
        />
      )}
      <style>{'@keyframes destelloGrados { 0% { opacity: 0.85 } 100% { opacity: 0 } }'}</style>

      {/* El resultado se arma una vez y se pinta en dos sitios. Con la camara abierta
          (EscanerQr es `fixed inset-0 z-50`) va en una hoja ENCIMA del escaner, como en
          pasar lista: dibujado en linea quedaba tapado y el lector parecia no reaccionar
          (bug del ensayo, 26-nov). El escaner no se desmonta, solo se pausa. */}
      {(() => {
        const contenido = (
          <>
            {trabajando && !res && <p className="text-sm text-muted">Consultando…</p>}
            {res && (
        <div className="space-y-2">
          {res.tipo === 'rojo' && (
            <>
              <Rojo titulo={res.titulo}>{res.detalle}</Rojo>
              {res.estudiante && (
                <ul>
                  <VerificacionFoto estudiante={res.estudiante} tamano={110} acciones={null} />
                </ul>
              )}
              {res.prueba && <TarjetaPrueba inv={res.prueba} />}
            </>
          )}

          {res.tipo === 'invitacion' && (
            <ResultadoInvitacion res={res} trabajando={trabajando} onRegistrar={registrar} />
          )}

          {res.tipo === 'graduando' && (
            <div className="space-y-2">
              {res.aviso && <Aviso tono="verde">{res.aviso}</Aviso>}
              <p className="text-sm font-semibold text-strong">Graduando</p>
              <ul>
                <VerificacionFoto
                  estudiante={res.estudiante}
                  tamano={110}
                  acciones={
                    res.g.llego ? (
                      <button disabled={trabajando} onClick={() => void registrar('deshacerGraduando', { studentId: res.g.studentId })} className={BOTON_SEC}>
                        Deshacer llegada
                      </button>
                    ) : (
                      <button disabled={trabajando} onClick={() => void registrar('graduando', { studentId: res.g.studentId })} className={BOTON_PRIMARIO}>
                        Llegó
                      </button>
                    )
                  }
                />
              </ul>
            </div>
          )}

          {camara ? (
            <BotonEscanear onClick={() => setRes(null)} />
          ) : (
            <button onClick={() => setRes(null)} className={`${BOTON_SEC} w-full`}>
              Siguiente
            </button>
          )}
        </div>
            )}
          </>
        );
        if (!res && !trabajando) return null;
        const fondo =
          nivelHoja === 'verde'
            ? 'border-success-soft bg-success-soft'
            : nivelHoja === 'naranja'
              ? 'border-warning-soft bg-warning-soft'
              : nivelHoja === 'rojo'
                ? 'border-danger-soft bg-danger-soft'
                : 'border-line bg-card';
        if (!camara) return <div className={`rounded-xl border p-3 ${fondo}`}>{contenido}</div>;
        return (
          <div className="fixed inset-0 z-[55] grid place-items-end bg-black/40 p-0 sm:place-items-center sm:p-4">
            <div className={`max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-2xl border p-4 sm:rounded-2xl ${fondo}`}>
              {contenido}
            </div>
          </div>
        );
      })()}

      <section className="rounded-xl border border-line bg-card p-3">
        <p className="text-sm font-semibold text-strong">Si el QR no lee: buscar por apellido</p>
        <input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Apellido del graduando"
          className="mt-1 w-full rounded-lg border border-line bg-elevated px-2 py-2 text-base text-strong"
        />
        {encontrados.length > 0 && (
          <ul className="mt-2 space-y-1.5">
            {encontrados.map((e) => (
              <VerificacionFoto
                key={e.studentId}
                estudiante={e}
                acciones={
                  <span className="flex gap-1">
                    <button onClick={() => void elegirEstudiante(e)} className={BOTON_SEC}>
                      Sus invitados
                    </button>
                    <button onClick={() => void elegirGraduando(e)} className={BOTON_SEC}>
                      Graduando
                    </button>
                  </span>
                }
              />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function ResultadoInvitacion({
  res,
  trabajando,
  onRegistrar,
}: {
  res: Extract<Resultado, { tipo: 'invitacion' }>;
  trabajando: boolean;
  onRegistrar: (accion: string, datos: Record<string, unknown>) => void;
}) {
  const { inv } = res;
  const lectura = lecturaDeInvitacion(inv, { estado: 'abierto' });
  const cantidades = cantidadesDisponibles(inv);
  const hayDeshacer = !!ultimoRegistroVigente(inv.registros);
  const botones = (
    <span className="flex flex-wrap gap-1.5">
      {cantidades.map((n) => (
        <button key={n} disabled={trabajando} onClick={() => onRegistrar('invitado', { token: inv.token, cantidad: n })} className={BOTON_PRIMARIO}>
          {etiquetaCantidad(n)}
        </button>
      ))}
    </span>
  );
  return (
    <div className="space-y-2">
      {res.aviso && <Aviso tono="verde">{res.aviso}</Aviso>}
      {lectura.tipo === 'agotada' ? (
        <Rojo titulo={inv.cupos === 2 ? 'Ya ingresaron los dos invitados' : `Ya ingresaron los ${inv.cupos} invitados`}>
          <RegistrosPrevios inv={inv} />
        </Rojo>
      ) : (
        <p className="text-lg font-bold text-strong">
          Invitación · {inv.restantes === 1 ? 'Queda 1 cupo' : `Quedan ${inv.restantes} cupos`}
        </p>
      )}
      {inv.prueba ? (
        <>
          <TarjetaPrueba inv={inv} />
          {cantidades.length > 0 && botones}
        </>
      ) : res.estudiante ? (
        <ul>
          <VerificacionFoto estudiante={res.estudiante} tamano={110} acciones={cantidades.length > 0 ? botones : null} />
        </ul>
      ) : (
        <Aviso>Foto no disponible: pida un documento. {inv.nombre} · {inv.grado}</Aviso>
      )}
      {!res.estudiante && !inv.prueba && cantidades.length > 0 && botones}
      {lectura.tipo !== 'agotada' && <RegistrosPrevios inv={inv} />}
      {hayDeshacer && (
        <button disabled={trabajando} onClick={() => onRegistrar('deshacerInvitado', { token: inv.token })} className={BOTON_SEC}>
          Deshacer el último ingreso
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
//  Graduandos
// ---------------------------------------------------------------------------

function ListaGraduandos({ evento, grados }: { evento: EventoGrados; grados: string[] }) {
  const [grado, setGrado] = useState(grados[0] ?? '');
  const [lista, setLista] = useState<Graduando[] | null>(null);
  const [fichas, setFichas] = useState<Map<string, Student>>(new Map());
  const [soloFaltan, setSoloFaltan] = useState(false);
  const [trabajando, setTrabajando] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void leerEstudiantesDeSede(evento.sede).then((l) => setFichas(new Map(l.map((e) => [e.studentId, e]))));
  }, [evento.sede]);

  useEffect(() => {
    if (!grado) return;
    setLista(null);
    return escucharGraduandos(evento.eventoId, grado, setLista, (e) => setError(e.message));
  }, [evento.eventoId, grado]);

  async function marcar(g: Graduando) {
    setTrabajando(g.studentId);
    setError(null);
    try {
      await puertaGrados(evento.eventoId, { accion: g.llego ? 'deshacerGraduando' : 'graduando', studentId: g.studentId });
    } catch (e) {
      const err = e as ErrorGrados;
      setError(err.motivo === 'ya_llego' ? `Ya había llegado (a las ${horaCorta(err.detalles.en as number)}, registró ${nombreCorto(err.detalles.por as string)}).` : err.message);
    } finally {
      setTrabajando(null);
    }
  }

  const elegibles = (lista ?? []).filter((g) => g.elegible);
  const llegaron = elegibles.filter((g) => g.llego).length;
  const filas = elegibles
    .map((g) => ({ g, e: fichas.get(g.studentId) }))
    .filter((x) => !soloFaltan || !x.g.llego)
    .sort((a, b) => (a.e && b.e ? compararEstudiantes(a.e, b.e) : a.g.nombre.localeCompare(b.g.nombre, 'es')));
  const cerrado = evento.estado === 'cerrado';

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        {grados.length > 1 && (
          <select value={grado} onChange={(e) => setGrado(e.target.value)} className="min-h-[40px] rounded-lg border border-line bg-card px-2 text-sm text-strong">
            {grados.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        )}
        <p className="text-base font-semibold text-strong">
          Llegaron {llegaron} de {elegibles.length}
          {grados.length === 1 ? ` · ${grado}` : ''}
        </p>
        <label className="ml-auto flex items-center gap-1 text-sm text-soft">
          <input type="checkbox" checked={soloFaltan} onChange={(e) => setSoloFaltan(e.target.checked)} /> Solo los que faltan
        </label>
      </div>
      {error && <Aviso tono="rojo">{error}</Aviso>}
      {lista === null ? (
        <p className="text-sm text-muted">Cargando…</p>
      ) : (
        <ul className="space-y-1.5">
          {filas.map(({ g, e }) =>
            e ? (
              <VerificacionFoto
                key={g.studentId}
                estudiante={e}
                extra={g.llego ? <span className="block text-xs text-success-soft-fg">Llegó a las {horaCorta(g.en)} · {nombreCorto(g.por)}</span> : null}
                acciones={
                  cerrado ? null : (
                    <button disabled={trabajando === g.studentId} onClick={() => void marcar(g)} className={g.llego ? BOTON_SEC : BOTON_PRIMARIO}>
                      {g.llego ? 'Deshacer' : 'Llegó'}
                    </button>
                  )
                }
              />
            ) : (
              <li key={g.studentId} className="rounded-lg border border-line p-2 text-sm text-soft">
                {g.nombre}
              </li>
            ),
          )}
        </ul>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
//  Aforo
// ---------------------------------------------------------------------------

function Aforo({ evento, esCoord }: { evento: EventoGrados; esCoord: boolean }) {
  const [r, setR] = useState<ResumenAforo>(RESUMEN_VACIO);
  const [cantidad, setCantidad] = useState('');
  const [categoria, setCategoria] = useState<CategoriaManual>('docentes');
  const [trabajando, setTrabajando] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [registro, setRegistro] = useState<IngresoRegistrado[] | null>(null);

  useEffect(() => escucharAforo(evento.eventoId, setR, (e) => setMensaje(e.message)), [evento.eventoId]);

  const total = totalAforo(r);
  const nivel = nivelAforo(total, evento.capacidad);
  const color =
    nivel === 'rojo' ? 'bg-danger-soft text-danger-soft-fg border-danger' : nivel === 'amarillo' ? 'bg-warning-soft text-warning-soft-fg border-warning' : 'bg-success-soft text-success-soft-fg border-success-soft';
  const cerrado = evento.estado === 'cerrado';
  const ultimoManual = [...r.manualesRecientes].reverse().find((m) => !m.deshecho);

  async function registrar(accion: string, datos: Record<string, unknown>) {
    setTrabajando(true);
    setMensaje(null);
    try {
      await puertaGrados(evento.eventoId, { accion, ...datos });
      setCantidad('');
    } catch (e) {
      setMensaje((e as Error).message);
    } finally {
      setTrabajando(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className={`rounded-xl border-2 p-4 text-center ${color}`}>
        <p className="text-5xl font-bold tabular-nums">{total}</p>
        <p className="text-sm">
          ingresados de {evento.capacidad}
          {nivel === 'rojo' && <b> · Aforo completo</b>}
        </p>
        <p className="mt-1 text-xs">
          Invitados {r.invitados} · Graduandos {r.graduandos} · Manuales {r.manuales}
        </p>
      </div>

      {!cerrado && (
        <section className="rounded-xl border border-line bg-card p-3">
          <p className="text-sm font-semibold text-strong">Ingreso manual (sin invitación)</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <input
              inputMode="numeric"
              value={cantidad}
              onChange={(e) => setCantidad(e.target.value.replace(/\D/g, ''))}
              placeholder="Cuántos"
              className="w-24 rounded-lg border border-line bg-elevated px-2 py-2 text-base text-strong"
            />
            <select value={categoria} onChange={(e) => setCategoria(e.target.value as CategoriaManual)} className="min-h-[44px] rounded-lg border border-line bg-elevated px-2 text-sm text-strong">
              {CATEGORIAS_MANUAL.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.etiqueta}
                </option>
              ))}
            </select>
            <button
              disabled={trabajando || !Number(cantidad)}
              onClick={() => void registrar('manual', { cantidad: Number(cantidad), categoria })}
              className={BOTON_PRIMARIO}
            >
              Sumar
            </button>
          </div>
          {ultimoManual && (
            <p className="mt-2 text-sm text-soft">
              Último: {ultimoManual.cantidad} · {CATEGORIAS_MANUAL.find((c) => c.id === ultimoManual.categoria)?.etiqueta} · {horaCorta(ultimoManual.en)} · {nombreCorto(ultimoManual.por)}{' '}
              <button disabled={trabajando} onClick={() => void registrar('deshacerManual', { ingresoId: ultimoManual.ingresoId })} className="underline">
                deshacer
              </button>
            </p>
          )}
        </section>
      )}
      {mensaje && <Aviso tono="rojo">{mensaje}</Aviso>}

      {esCoord && (
        <section className="rounded-xl border border-line bg-card p-3">
          <p className="text-sm font-semibold text-strong">Registro de ingresos</p>
          {registro === null ? (
            <button onClick={() => void leerIngresos(evento.eventoId).then(setRegistro)} className={`${BOTON_SEC} mt-1`}>
              Ver el registro
            </button>
          ) : (
            <ul className="mt-1 max-h-80 space-y-0.5 overflow-y-auto text-xs text-soft">
              {registro.map((i, k) => (
                <li key={k} className={i.deshecho ? 'line-through' : ''}>
                  {horaCorta(i.en)} · {i.tipo} · {i.cantidad} · {nombreCorto(i.por)}
                  {i.categoria ? ` · ${i.categoria}` : ''}
                  {i.deshecho ? ' (deshecho)' : ''}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
//  Preparar (coordinacion)
// ---------------------------------------------------------------------------

function CrearEventos({ faltaReal, faltaEnsayo, onCreado }: { faltaReal: boolean; faltaEnsayo: boolean; onCreado: (eventoId: string) => void }) {
  const [trabajando, setTrabajando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function crear(ensayo: boolean) {
    setTrabajando(true);
    setError(null);
    try {
      const eventoId = ensayo ? 'ensayo-grados-2026' : 'grados-2026';
      await administrarGrados(eventoId, {
        accion: 'crearEvento',
        nombre: ensayo ? 'Ensayo de grados 2026' : 'Grados 2026',
        fecha: ensayo ? '2026-12-03' : '2026-12-04',
        hora: '11:00',
        capacidad: CAPACIDAD_POR_DEFECTO,
        grados: ensayo ? [] : ['11.1', '11.2', '11.3'],
        sede: 'central',
        ensayo,
      });
      await administrarGrados(eventoId, { accion: 'generarInvitaciones' });
      onCreado(eventoId);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setTrabajando(false);
    }
  }
  return (
    <div className="space-y-2">
      {faltaReal && faltaEnsayo ? (
        <Aviso>Todavía no hay ningún evento de grados. Créelo; las invitaciones de 11.1, 11.2 y 11.3 se generan solas.</Aviso>
      ) : faltaReal ? (
        <Aviso>Ya está el ensayo. Falta crear el evento real; sus invitaciones de 11.1, 11.2 y 11.3 se generan solas.</Aviso>
      ) : (
        <Aviso>Ya está el evento real. Si quiere probar antes, cree el ensayo.</Aviso>
      )}
      <div className="flex flex-wrap gap-2">
        {faltaReal && (
          <button disabled={trabajando} onClick={() => void crear(false)} className={BOTON_PRIMARIO}>
            Crear «Grados 2026» (4 dic, 11 a. m., 310)
          </button>
        )}
        {faltaEnsayo && (
          <button disabled={trabajando} onClick={() => void crear(true)} className={BOTON_SEC}>
            Crear el ensayo (3 invitaciones de prueba)
          </button>
        )}
      </div>
      {trabajando && <p className="text-xs text-muted">Creando el evento y sus invitaciones…</p>}
      {error && <Aviso tono="rojo">{error}</Aviso>}
    </div>
  );
}

function Preparar({ evento, onCambio }: { evento: EventoGrados; onCambio: () => void }) {
  const [invs, setInvs] = useState<Invitacion[] | null>(null);
  const [capacidad, setCapacidad] = useState(String(evento.capacidad));
  const [porteria, setPorteria] = useState(evento.porteria.join('\n'));
  const [trabajando, setTrabajando] = useState(false);
  const [mensaje, setMensaje] = useState<{ tono: 'verde' | 'rojo'; texto: string } | null>(null);

  async function recargar() {
    try {
      setInvs((await leerInvitaciones(evento.eventoId)).sort(compararParaHoja));
    } catch (e) {
      setMensaje({ tono: 'rojo', texto: (e as Error).message });
    }
  }
  useEffect(() => {
    setCapacidad(String(evento.capacidad));
    setPorteria(evento.porteria.join('\n'));
    void recargar();
  }, [evento.eventoId]);

  async function hacer(datos: Record<string, unknown>, ok: string) {
    setTrabajando(true);
    setMensaje(null);
    try {
      const r = await administrarGrados(evento.eventoId, datos);
      setMensaje({ tono: 'verde', texto: r.creadas !== undefined ? `${ok}: ${r.creadas} nuevas.` : ok });
      await recargar();
      onCambio();
    } catch (e) {
      setMensaje({ tono: 'rojo', texto: (e as Error).message });
    } finally {
      setTrabajando(false);
    }
  }

  const vigentes = (invs ?? []).filter((i) => !i.reemplazadaPor);
  const grupos = [...new Set(vigentes.map((i) => i.grado))].sort();
  const cerrado = evento.estado === 'cerrado';

  function hojas(grado: string | null) {
    const lista = vigentes.filter((i) => !i.anulada && (grado === null || i.grado === grado));
    void imprimirHojasQr(lista, `${evento.nombre}${grado ? ` · ${grado}` : ''}`);
  }

  return (
    <div className="space-y-3">
      {mensaje && <Aviso tono={mensaje.tono}>{mensaje.texto}</Aviso>}

      <section className="rounded-xl border border-line bg-card p-3">
        <p className="text-sm font-semibold text-strong">Hojas de QR para recortar (2,5 × 2,5 cm)</p>
        <p className="text-xs text-muted">Imprima en carta al 100 %, sin «ajustar a la página». Las anuladas no salen.</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {grupos.map((g) => (
            <button key={g} onClick={() => hojas(g)} className={BOTON_SEC}>
              {g}
            </button>
          ))}
          {grupos.length > 1 && (
            <button onClick={() => hojas(null)} className={BOTON_SEC}>
              Todos
            </button>
          )}
        </div>
      </section>

      {!cerrado && (
        <section className="rounded-xl border border-line bg-card p-3 space-y-2">
          <p className="text-sm font-semibold text-strong">Configuración</p>
          <label className="block text-sm text-soft">
            Capacidad del sitio
            <input
              inputMode="numeric"
              value={capacidad}
              onChange={(e) => setCapacidad(e.target.value.replace(/\D/g, ''))}
              className="ml-2 w-24 rounded-lg border border-line bg-elevated px-2 py-1 text-base text-strong"
            />
          </label>
          <label className="block text-sm text-soft">
            Portería: un correo por línea
            <textarea value={porteria} onChange={(e) => setPorteria(e.target.value)} rows={4} className="mt-1 w-full rounded-lg border border-line bg-elevated px-2 py-1 text-sm text-strong" />
          </label>
          <div className="flex flex-wrap gap-2">
            <button disabled={trabajando} onClick={() => void hacer({ accion: 'configurar', capacidad: Number(capacidad), porteria }, 'Guardado')} className={BOTON_SEC}>
              Guardar
            </button>
            <button disabled={trabajando} onClick={() => void hacer({ accion: 'generarInvitaciones' }, 'Invitaciones generadas')} className={BOTON_SEC}>
              Generar invitaciones faltantes
            </button>
          </div>
        </section>
      )}

      <section className="rounded-xl border border-line bg-card p-3">
        <p className="text-sm font-semibold text-strong">Invitaciones ({vigentes.length})</p>
        {invs === null ? (
          <p className="text-sm text-muted">Cargando…</p>
        ) : (
          grupos.map((g) => (
            <div key={g} className="mt-2">
              <p className="text-xs font-semibold text-muted">{g}</p>
              <ul className="space-y-1">
                {vigentes
                  .filter((i) => i.grado === g)
                  .map((i) => (
                    <li key={i.token} className="flex flex-wrap items-center gap-2 rounded-lg border border-line p-1.5 text-sm">
                      <span className={`grow ${i.anulada ? 'text-muted line-through' : 'text-strong'}`}>{i.nombre}</span>
                      <span className="text-xs text-muted">
                        {i.usados}/{i.cupos}
                        {i.anulada ? ' · anulada' : ''}
                      </span>
                      {!cerrado && (
                        <span className="flex gap-1">
                          <button
                            disabled={trabajando}
                            className="text-xs underline"
                            onClick={() => {
                              if (i.anulada) void hacer({ accion: 'reactivar', token: i.token }, 'Reactivada');
                              else {
                                const motivo = window.prompt(`¿Por qué se anula la invitación de ${i.nombre}?`);
                                if (motivo?.trim()) void hacer({ accion: 'anular', token: i.token, motivo }, 'Anulada');
                              }
                            }}
                          >
                            {i.anulada ? 'reactivar' : 'anular'}
                          </button>
                          <button
                            disabled={trabajando}
                            className="text-xs underline"
                            onClick={() => {
                              const cupos = Number(window.prompt(`Cupos para ${i.nombre} (hoy ${i.cupos}):`, String(i.cupos + 1)));
                              if (!cupos) return;
                              const motivo = window.prompt('Motivo de la ampliación:');
                              if (motivo?.trim()) void hacer({ accion: 'ampliar', token: i.token, cupos, motivo }, 'Cupos actualizados');
                            }}
                          >
                            cupos
                          </button>
                          <button
                            disabled={trabajando}
                            className="text-xs underline"
                            onClick={() => {
                              if (window.confirm(`¿Regenerar la invitación de ${i.nombre}? La impresa deja de servir y hay que imprimir la nueva.`)) {
                                void hacer({ accion: 'regenerar', token: i.token, motivo: 'regenerada' }, 'Regenerada: imprima la nueva');
                              }
                            }}
                          >
                            regenerar
                          </button>
                        </span>
                      )}
                    </li>
                  ))}
              </ul>
            </div>
          ))
        )}
      </section>

      {!cerrado && (
        <button
          disabled={trabajando}
          onClick={() => {
            if (window.confirm('¿Cerrar el evento? Ya no se podrá registrar ningún ingreso y el lector dejará de mostrar fotos.')) {
              void hacer({ accion: 'cerrar' }, 'Evento cerrado');
            }
          }}
          className={`${BOTON_SEC} border-danger text-danger-soft-fg`}
        >
          Cerrar evento
        </button>
      )}
    </div>
  );
}
