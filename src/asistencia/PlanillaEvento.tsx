import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { FlechaNeon } from '../components/FlechaNeon';
import Avatar from './Avatar';
import EscanerQr from './EscanerQr';
import VerificacionFoto from './VerificacionFoto';
import { CLASE_MARCA, SiglaMarca } from './Planilla';
import {
  abrirSesionEvento,
  buscarPorQrToken,
  compartirEvento,
  eliminarEvento,
  leerDocentes,
  leerEstudiantesDeSede,
  leerSesionesEvento,
  marcarEnEvento,
  type DocenteDirectorio,
} from './datos';
import {
  agruparPorGrado,
  diasDelEvento,
  estadisticaEvento,
  eventoVigente,
  nombreCortoDocente,
  quienesLlamaronLista,
  resumenSesionEvento,
} from './domain/eventos';
import { conDenominador } from './domain/stats';
import { toDateKey } from './domain/ids';
import { MARKS, findMark, type MarkCode } from './domain/marks';
import { nombreCompleto, ordenarEstudiantes } from './domain/nombres';
import type { Event, EventSession, Student } from './domain/types';
import { colorGrado } from '../data/maestros';
import Ayuda from './Ayuda';

/** El cuaderno de columnas propias. `lazy`: arrastra ExcelJS, igual que en el centro de interes. */
const DireccionGrupo = lazy(() => import('./DireccionGrupo'));

type Pestana = 'registro' | 'columnas' | 'estadisticas' | 'compartir';
type Orden = 'az' | 'grupo';

const CLAVE_ORDEN = 'asis.evento.orden';

const PESTANAS_EVENTO: { clave: Pestana; nombre: string; descripcion: string }[] = [
  {
    clave: 'registro',
    nombre: 'Registro',
    descripcion:
      'La asistencia: una columna por cada día del evento en que se llama lista. Con «+ Registro de asistencia» se abre otro día. Toque una casilla para marcar, o escanee el código del estudiante.',
  },
  {
    clave: 'columnas',
    nombre: 'Gestión del grupo',
    descripcion:
      'La misma lista, sin la asistencia: columnas suyas con íconos, puntos, casillas o contadores, como en dirección de grupo. Por ejemplo, a qué brigada pertenece cada estudiante.',
  },
  {
    clave: 'estadisticas',
    nombre: 'Estadísticas',
    descripcion: 'Cuánto ha asistido cada integrante, sobre el total de sesiones registradas, y quién llamó lista cada día.',
  },
  {
    clave: 'compartir',
    nombre: 'Compartir',
    descripcion:
      'Dé acceso a otros docentes para que también puedan registrar en este evento. Solo usted, que lo creó, puede hacerlo.',
  },
];

/** «lun 19 oct» a partir de 'YYYY-MM-DD', sin depender de la zona horaria. */
function etiquetaDia(fecha: string): string {
  const d = new Date(`${fecha}T12:00:00`);
  return d.toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric', month: 'short' }).replace(/\./g, '');
}

function leerOrden(): Orden {
  try {
    return localStorage.getItem(CLAVE_ORDEN) === 'grupo' ? 'grupo' : 'az';
  } catch {
    return 'az';
  }
}

function guardarOrden(o: Orden) {
  try {
    localStorage.setItem(CLAVE_ORDEN, o);
  } catch {
    /* sin almacenamiento: el orden vuelve a A–Z la proxima vez */
  }
}

/**
 * Planilla de un evento — registro, estadistica y compartir en una sola pantalla.
 *
 * Registro en COLUMNAS, como la planilla de clase (Julian, 2026-10-19): una columna por
 * cada dia del evento en que se llama lista, la mas reciente primero. Antes se veia un
 * solo dia a la vez y no habia forma evidente de pasar al siguiente. «+ Columna» ofrece
 * SOLO los dias del rango del evento. Una columna nueva no crea nada hasta la primera
 * marca: si se creara al abrirla, cada vistazo dejaria una sesion vacia e inflaria el
 * denominador de la estadistica (sesiones REGISTRADAS, nunca el calendario). El boton dice
 * «+ Registro de asistencia», no «+ Columna»: Julian lo confundio con las columnas de gestion.
 *
 * Quien marco ya no se ve en cada fila (antes salia el correo completo): queda en el
 * aviso de la casilla y, con el nombre corto, en Estadisticas.
 */
export default function PlanillaEvento({
  evento,
  miCorreo,
  puedeRegistrar,
  onAbrirFicha,
  onVolver,
  onEliminado,
}: {
  evento: Event;
  miCorreo: string;
  /**
   * Falso para la rectora. Puede LEER un evento que le hayan compartido —la regla solo
   * exige estar en `docentes`— pero no marcar: `asisCanRecord()` la excluye. Sin esta
   * distincion la pantalla le ofreceria botones que el servidor rechaza.
   */
  puedeRegistrar: boolean;
  /** Abre la ficha del estudiante. La pinta `index.tsx`. */
  onAbrirFicha: (studentId: string) => void;
  onVolver: () => void;
  /** Se eliminó el evento: esta pantalla ya no existe, el aviso lo da la lista. */
  onEliminado: (mensaje: string) => void;
}) {
  const [pestana, setPestana] = useState<Pestana>('registro');
  const dias = useMemo(() => diasDelEvento(evento.desde, evento.hasta), [evento.desde, evento.hasta]);
  const hoy = toDateKey(new Date());
  const [columnaActiva, setColumnaActiva] = useState<string>(dias.includes(hoy) ? hoy : '');
  const [columnasNuevas, setColumnasNuevas] = useState<string[]>([]);
  const [orden, setOrden] = useState<Orden>(leerOrden);
  const [miembros, setMiembros] = useState<Student[]>([]);
  const [sesiones, setSesiones] = useState<EventSession[]>([]);
  const [directorio, setDirectorio] = useState<DocenteDirectorio[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [escaneando, setEscaneando] = useState(false);
  const [candidatoQr, setCandidatoQr] = useState<Student | null>(null);
  const [marcando, setMarcando] = useState<{ estudiante: Student; fecha: string } | null>(null);

  // `leerEstudiantesDeSede` trae solo activos: un integrante dado de baja despues de
  // crear el evento desaparece del listado. `evento.miembros` es la foto fija de IDs.
  useEffect(() => {
    let vivo = true;
    setCargando(true);
    void (async () => {
      try {
        const [todos, sesionesEvento] = await Promise.all([
          leerEstudiantesDeSede(evento.sede),
          leerSesionesEvento(evento.eventId),
        ]);
        if (!vivo) return;
        const porId = new Map(todos.map((e) => [e.studentId, e]));
        // Se ordena al pintar: `miembros` es un conjunto de studentIds y nada garantiza
        // que siga ordenado el dia que se puedan añadir integrantes despues.
        setMiembros(
          ordenarEstudiantes(
            evento.miembros.map((id) => porId.get(id)).filter((e): e is Student => !!e),
          ),
        );
        setSesiones(sesionesEvento);
      } catch (e) {
        if (vivo) setError(`No fue posible cargar el evento: ${(e as Error).message}`);
      } finally {
        if (vivo) setCargando(false);
      }
    })();
    return () => {
      vivo = false;
    };
  }, [evento.eventId, evento.sede, evento.miembros]);

  // El directorio da los nombres cortos («Julián») y la lista para compartir. Si falla,
  // la planilla sigue: solo se veria la parte del correo antes de la arroba.
  useEffect(() => {
    let vivo = true;
    leerDocentes()
      .then((d) => vivo && setDirectorio(d))
      .catch(() => undefined);
    return () => {
      vivo = false;
    };
  }, []);

  // Estable entre renders: el cuaderno se reabre cada vez que cambia `fuente`. El año es
  // el del inicio del evento, para que un evento no se parta en dos cuadernos.
  const fuenteCuaderno = useMemo(() => ({ tipo: 'evento' as const, eventId: evento.eventId }), [evento.eventId]);
  const anioCuaderno = Number(evento.desde.slice(0, 4)) || new Date().getFullYear();

  const nombreCorto = useCallback(
    (correo: string) => nombreCortoDocente(directorio.find((d) => d.correo === correo)?.nombre, correo),
    [directorio],
  );

  const recargarSesiones = useCallback(async () => {
    setSesiones(await leerSesionesEvento(evento.eventId));
  }, [evento.eventId]);

  // Columnas: los dias con sesion registrada, mas los recien abiertos con «+ Columna» y
  // el dia activo; la mas reciente primero, como en la planilla de clase.
  const columnas = useMemo(() => {
    const s = new Set<string>([...sesiones.map((x) => x.fecha), ...columnasNuevas]);
    if (columnaActiva) s.add(columnaActiva);
    return [...s].sort().reverse();
  }, [sesiones, columnasNuevas, columnaActiva]);

  // Sin dia activo (el evento no es de hoy): la columna mas reciente; si no hay ninguna,
  // el primer dia del evento.
  const activa = columnaActiva || columnas[0] || dias[0] || hoy;
  const sesionDe = (f: string) => sesiones.find((s) => s.fecha === f) ?? null;
  const avance = resumenSesionEvento(sesionDe(activa), evento.miembros);
  const diasLibres = dias.filter((d) => !columnas.includes(d));

  async function asegurarSesion(fecha: string): Promise<EventSession> {
    const existente = sesiones.find((s) => s.fecha === fecha);
    if (existente) return existente;
    const nueva = await abrirSesionEvento(evento.eventId, fecha);
    setSesiones((prev) => [...prev, nueva]);
    return nueva;
  }

  async function marcar(studentId: string, estado: MarkCode, fecha: string) {
    setError(null);
    try {
      await asegurarSesion(fecha);
      await marcarEnEvento(evento.eventId, fecha, studentId, estado);
      await recargarSesiones();
    } catch (e) {
      setError(`No fue posible registrar: ${(e as Error).message}`);
    }
  }

  function abrirColumna(fecha: string) {
    if (!fecha) return;
    setColumnasNuevas((c) => (c.includes(fecha) ? c : [...c, fecha]));
    setColumnaActiva(fecha);
  }

  function cambiarOrden(o: Orden) {
    setOrden(o);
    guardarOrden(o);
  }

  async function leerQr(texto: string) {
    setAviso(null);
    setError(null);
    try {
      const { estudiante, otraSede } = await buscarPorQrToken(evento.sede, texto);
      if (!estudiante) {
        setAviso(
          otraSede
            ? 'Ese código pertenece a un estudiante de otra sede.'
            : 'Código no reconocido. Puede marcar desde la lista de integrantes.',
        );
        return;
      }
      if (!evento.miembros.includes(estudiante.studentId)) {
        setEscaneando(false);
        setAviso(`${nombreCompleto(estudiante)} no es integrante de este evento.`);
        return;
      }
      setEscaneando(false);
      setCandidatoQr(estudiante);
    } catch (e) {
      setError(`No fue posible resolver el código: ${(e as Error).message}`);
    }
  }

  async function marcarDesdeQr(estado: MarkCode) {
    if (!candidatoQr) return;
    const nombre = nombreCompleto(candidatoQr);
    await marcar(candidatoQr.studentId, estado, activa);
    setAviso(`${nombre} — marcado el ${etiquetaDia(activa)}.`);
    setCandidatoQr(null);
  }

  if (cargando) {
    return <p className="p-3 text-sm text-muted">Cargando evento…</p>;
  }

  const vigenteHoy = eventoVigente(evento, hoy);
  const grupos: { grado: string | null; estudiantes: Student[] }[] =
    orden === 'grupo' ? agruparPorGrado(miembros) : [{ grado: null, estudiantes: miembros }];

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <button onClick={onVolver} className="group inline-flex items-center gap-1 text-xs text-muted underline">
            <FlechaNeon direccion="izquierda" tamano="sm" /> Volver a eventos
          </button>
          <h2 className="text-base font-semibold text-strong">{evento.nombre}</h2>
          <p className="text-xs text-muted">
            {evento.desde} a {evento.hasta} · {evento.miembros.length} integrantes
            {!vigenteHoy && <span className="ml-1 text-warning-soft-fg">· no vigente hoy</span>}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {PESTANAS_EVENTO.filter(
          (p) =>
            (p.clave !== 'compartir' || evento.creadoPor === miCorreo) &&
            // Escribir el cuaderno exige poder registrar, igual que marcar.
            (p.clave !== 'columnas' || puedeRegistrar),
        ).map(
          ({ clave, nombre, descripcion }) => (
            <Ayuda key={clave} texto={descripcion}>
              <button
                onClick={() => setPestana(clave)}
                className={[
                  'min-h-[36px] rounded-full border px-3 py-1 text-sm',
                  pestana === clave
                    ? 'border-accent bg-accent-soft font-semibold text-accent-soft-fg'
                    : 'border-line text-soft',
                ].join(' ')}
              >
                {nombre}
              </button>
            </Ayuda>
          ),
        )}
      </div>

      {aviso && (
        <div className="rounded-xl border border-info-soft bg-info-soft p-3 text-sm text-info-soft-fg">
          {aviso}
        </div>
      )}
      {error && (
        <div className="rounded-xl border border-danger-soft bg-danger-soft p-3 text-sm text-danger-soft-fg">
          {error}
        </div>
      )}

      {pestana === 'registro' && (
        <div className="space-y-3">
          <div className="rounded-xl border border-line bg-card p-3">
            <div className="flex flex-wrap items-center gap-2">
              {puedeRegistrar && diasLibres.length > 0 && (
                <label className="flex items-center gap-1 text-sm text-strong">
                  <span className="sr-only">Abrir el registro de asistencia de otro día del evento</span>
                  <select
                    value=""
                    onChange={(ev) => abrirColumna(ev.target.value)}
                    className="rounded-lg border border-accent bg-accent-soft px-2 py-2 text-sm font-medium text-accent-soft-fg"
                  >
                    <option value="">+ Registro de asistencia</option>
                    {diasLibres.map((d) => (
                      <option key={d} value={d}>
                        {etiquetaDia(d)}
                        {d === hoy ? ' (hoy)' : ''}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {puedeRegistrar && (
                <button
                  onClick={() => setEscaneando(true)}
                  className="rounded-lg border border-line px-3 py-2 text-sm font-medium text-strong"
                >
                  Escanear código
                </button>
              )}
              <div className="flex rounded-full border border-line p-0.5 text-xs" role="group" aria-label="Orden de la lista">
                {(['az', 'grupo'] as Orden[]).map((o) => (
                  <button
                    key={o}
                    onClick={() => cambiarOrden(o)}
                    aria-pressed={orden === o}
                    className={[
                      'rounded-full px-3 py-1',
                      orden === o ? 'bg-accent-soft font-semibold text-accent-soft-fg' : 'text-soft',
                    ].join(' ')}
                  >
                    {o === 'az' ? 'A–Z' : 'Por grupo'}
                  </button>
                ))}
              </div>
              <span className="grow" />
              <span className="text-sm font-semibold text-strong">
                {etiquetaDia(activa)}: {avance.marcados} de {avance.total} marcados
              </span>
            </div>
            {puedeRegistrar && (
              <p className="mt-1 text-xs text-muted">
                El código escaneado se marca en la columna resaltada. Toque el encabezado de otra columna para cambiarla.
              </p>
            )}

            {candidatoQr && (
              <ul className="mt-2">
                <VerificacionFoto
                  estudiante={candidatoQr}
                  tamano={110}
                  acciones={<BotonesMarca onElegir={(m) => void marcarDesdeQr(m)} />}
                />
              </ul>
            )}
          </div>

          <div className="overflow-x-auto rounded-xl border border-line bg-card">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="text-xs text-muted">
                  <th className="sticky left-0 z-10 bg-card p-2 text-left font-medium">Estudiante</th>
                  {columnas.map((f) => {
                    const registrada = Boolean(sesionDe(f));
                    return (
                      <th key={f} className="p-1 font-medium">
                        <button
                          onClick={() => setColumnaActiva(f)}
                          title={registrada ? `Asistencia del ${etiquetaDia(f)}` : 'Registro nuevo: se guarda con la primera marca'}
                          className={[
                            'whitespace-nowrap rounded-lg px-2 py-1',
                            f === activa ? 'bg-accent-soft font-semibold text-accent-soft-fg' : 'text-soft',
                          ].join(' ')}
                        >
                          {etiquetaDia(f)}
                          {!registrada && <span className="block text-[10px] font-normal">nueva</span>}
                        </button>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {grupos.map(({ grado, estudiantes }) => (
                  <FilasGrupo
                    key={grado ?? 'todos'}
                    grado={grado}
                    estudiantes={estudiantes}
                    columnas={columnas}
                    sesionDe={sesionDe}
                    nombreCorto={nombreCorto}
                    puedeRegistrar={puedeRegistrar}
                    onAbrirFicha={onAbrirFicha}
                    onMarcar={(estudiante, fecha) => setMarcando({ estudiante, fecha })}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {pestana === 'columnas' && puedeRegistrar && (
        <Suspense fallback={<p className="p-3 text-sm text-muted">Cargando la gestión del grupo…</p>}>
          <DireccionGrupo
            fuente={fuenteCuaderno}
            etiqueta={evento.nombre}
            anio={anioCuaderno}
            estudiantes={miembros}
            sesionesEvento={sesiones}
            onAbrirFicha={onAbrirFicha}
          />
        </Suspense>
      )}

      {pestana === 'estadisticas' && (
        <EstadisticasEvento miembros={miembros} sesiones={sesiones} nombreCorto={nombreCorto} />
      )}

      {pestana === 'compartir' && evento.creadoPor === miCorreo && (
        <div className="space-y-4">
          <CompartirEvento
            eventId={evento.eventId}
            sedeEvento={evento.sede}
            docentesIniciales={evento.docentes}
            creadoPor={evento.creadoPor}
            directorio={directorio}
            onAviso={setAviso}
            onError={setError}
          />
          <ZonaEliminarEvento evento={evento} onError={setError} onEliminado={onEliminado} />
        </div>
      )}

      {escaneando && <EscanerQr onLeer={(t) => void leerQr(t)} onCerrar={() => setEscaneando(false)} />}

      {marcando && (
        <HojaMarcar
          estudiante={marcando.estudiante}
          fecha={marcando.fecha}
          marcaActual={sesionDe(marcando.fecha)?.estudiantes?.[marcando.estudiante.studentId] ?? null}
          nombreCorto={nombreCorto}
          onElegir={(estado) => {
            void marcar(marcando.estudiante.studentId, estado, marcando.fecha);
            setMarcando(null);
          }}
          onCerrar={() => setMarcando(null)}
        />
      )}
    </div>
  );
}

/** Las filas de un grupo (o de toda la lista en A–Z), con su encabezado de grado. */
function FilasGrupo({
  grado,
  estudiantes,
  columnas,
  sesionDe,
  nombreCorto,
  puedeRegistrar,
  onAbrirFicha,
  onMarcar,
}: {
  grado: string | null;
  estudiantes: Student[];
  columnas: string[];
  sesionDe: (f: string) => EventSession | null;
  nombreCorto: (correo: string) => string;
  puedeRegistrar: boolean;
  onAbrirFicha: (studentId: string) => void;
  onMarcar: (e: Student, fecha: string) => void;
}) {
  return (
    <>
      {grado && (
        <tr>
          <td
            colSpan={columnas.length + 1}
            className="border-t border-line bg-elevated px-2 py-1 text-xs font-semibold"
            style={{ color: colorGrado(grado) }}
          >
            {grado} · {estudiantes.length}
          </td>
        </tr>
      )}
      {estudiantes.map((e) => (
        <tr key={e.studentId} className="border-t border-line">
          <td className="sticky left-0 z-10 bg-card p-1.5">
            {/* Pulsable: quien lleva el evento necesita el telefono del acudiente y la
                ficha ya se lo deja ver (Julian, 2026-09-09). */}
            <button
              onClick={() => onAbrirFicha(e.studentId)}
              title={`Abrir la ficha de ${nombreCompleto(e)}`}
              className="flex min-w-[11rem] items-center gap-2 text-left"
            >
              <Avatar estudiante={e} tamano={36} />
              <span className="min-w-0 text-sm">
                <b className="block truncate text-strong">{nombreCompleto(e)}</b>
                {!grado && <span className="text-xs text-muted">{e.gradoActual}</span>}
              </span>
            </button>
          </td>
          {columnas.map((f) => {
            const m = sesionDe(f)?.estudiantes?.[e.studentId];
            const def = m ? findMark(m.estado) : undefined;
            const titulo = def && m ? `${def.label} · marcó ${nombreCorto(m.registradoPor)}` : 'Sin marcar';
            return (
              <td key={f} className="p-1 text-center">
                <button
                  disabled={!puedeRegistrar}
                  onClick={() => onMarcar(e, f)}
                  title={titulo}
                  aria-label={`${nombreCompleto(e)}, ${f}: ${titulo}`}
                  className={[
                    'mx-auto grid h-9 min-w-9 place-items-center rounded-lg px-1.5 text-xs font-bold disabled:cursor-default',
                    def ? CLASE_MARCA[def.code] : 'border border-dashed border-line text-muted',
                  ].join(' ')}
                >
                  {def ? <SiglaMarca code={def.code} /> : '·'}
                </button>
              </td>
            );
          })}
        </tr>
      ))}
    </>
  );
}

/** Fila compacta de las siete marcas, para el flujo rapido del escaner. */
function BotonesMarca({ onElegir }: { onElegir: (m: MarkCode) => void }) {
  return (
    <div className="flex flex-wrap gap-1">
      {MARKS.map((m) => (
        <button
          key={m.code}
          onClick={() => onElegir(m.code)}
          aria-label={`Marcar ${m.label}`}
          title={m.label}
          className={`grid h-9 min-w-9 place-items-center rounded-lg px-1.5 text-xs font-bold ${CLASE_MARCA[m.code]}`}
        >
          <SiglaMarca code={m.code} />
        </button>
      ))}
    </div>
  );
}

/**
 * Hoja de marcas — mismo patron de `MenuMarcas` en Planilla.tsx (foto grande, un boton
 * por marca), reconstruido aqui porque ese componente no esta exportado.
 */
function HojaMarcar({
  estudiante,
  fecha,
  marcaActual,
  nombreCorto,
  onElegir,
  onCerrar,
}: {
  estudiante: Student;
  fecha: string;
  marcaActual: { estado: string; registradoPor: string } | null;
  nombreCorto: (correo: string) => string;
  onElegir: (estado: MarkCode) => void;
  onCerrar: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-end bg-black/40 p-0 sm:place-items-center sm:p-4"
      onClick={onCerrar}
    >
      <div
        className="w-full max-w-md rounded-t-2xl border border-line bg-card p-4 sm:rounded-2xl"
        onClick={(ev) => ev.stopPropagation()}
      >
        <div className="flex flex-col items-center gap-1">
          <Avatar estudiante={estudiante} tamano={110} />
          <p className="text-lg font-semibold text-strong">{nombreCompleto(estudiante)}</p>
          <p className="text-xs text-muted">{etiquetaDia(fecha)}</p>
          {marcaActual && (
            <p className="text-xs text-muted">
              Marca actual: {findMark(marcaActual.estado)?.label ?? marcaActual.estado} · marcó{' '}
              {nombreCorto(marcaActual.registradoPor)}
            </p>
          )}
        </div>

        <div className="mt-3 grid grid-cols-2 gap-1.5 sm:grid-cols-3">
          {MARKS.map((m) => (
            <button
              key={m.code}
              onClick={() => onElegir(m.code)}
              className="flex flex-col items-center gap-1 rounded-lg border border-line p-2 text-center hover:bg-hover"
            >
              <span
                className={`grid h-7 w-9 place-items-center rounded text-xs font-bold ${CLASE_MARCA[m.code]}`}
              >
                <SiglaMarca code={m.code} />
              </span>
              <span className="text-xs leading-tight text-strong">{m.label}</span>
            </button>
          ))}
        </div>

        <button
          onClick={onCerrar}
          className="mt-3 w-full rounded-lg border border-line p-2 text-sm text-soft"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}

/**
 * Estadistica por integrante. El denominador (`sesionesCount`) va SIEMPRE junto al
 * numero: "3 faltas" no dice nada sin saber sobre cuantas sesiones se registraron.
 * Abajo, quien llamo lista cada dia, con el nombre corto: es el reporte del evento.
 */
function EstadisticasEvento({
  miembros,
  sesiones,
  nombreCorto,
}: {
  miembros: Student[];
  sesiones: EventSession[];
  nombreCorto: (correo: string) => string;
}) {
  if (sesiones.length === 0) {
    return (
      <p className="rounded-xl border border-line bg-card p-3 text-sm text-muted">
        Todavía no hay sesiones registradas en este evento: mientras no exista una, ese
        día no existe para la estadística.
      </p>
    );
  }

  const porFecha = [...sesiones].sort((a, b) => b.fecha.localeCompare(a.fecha));

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-xl border border-line bg-card p-3">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-muted">
              <th className="p-1">Estudiante</th>
              <th className="p-1 text-right">Asistencias</th>
              <th className="p-1 text-right">Retrasos</th>
              <th className="p-1">Ausencias</th>
              <th className="p-1 text-right">Sin registrar</th>
            </tr>
          </thead>
          <tbody>
            {miembros.map((e) => {
              const r = estadisticaEvento(e.studentId, sesiones);
              return (
                <tr key={e.studentId} className="border-t border-line">
                  <td className="p-1 text-strong">{nombreCompleto(e)}</td>
                  <td className="p-1 text-right text-soft">{r.porMarca.asistencia}</td>
                  <td className="p-1 text-right text-soft">
                    {r.porMarca.retraso + r.porMarca.retraso_justificado}
                  </td>
                  <td className="p-1 text-xs text-muted">
                    {conDenominador(r.ausenciasTotales, r.sesionesCount)}
                  </td>
                  <td className="p-1 text-right text-muted">{r.sinRegistrar}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="mt-2 text-xs text-muted">
          Sobre {sesiones.length} {sesiones.length === 1 ? 'sesión registrada' : 'sesiones registradas'} de
          este evento. El calendario no cuenta: solo los días en que alguien tomó asistencia.
        </p>
      </div>

      <div className="rounded-xl border border-line bg-card p-3">
        <p className="text-sm font-semibold text-strong">Quién llamó lista</p>
        <ul className="mt-2 space-y-1 text-sm">
          {porFecha.map((s) => (
            <li key={s.fecha} className="flex flex-wrap gap-2 border-t border-line pt-1 first:border-t-0 first:pt-0">
              <span className="w-28 text-muted">{etiquetaDia(s.fecha)}</span>
              <span className="text-strong">
                {quienesLlamaronLista(s).map(nombreCorto).join(', ') || 'sin marcas'}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/** Para buscar sin que importen tildes ni mayusculas: «julian» encuentra «Julián». */
function sinTildes(t: string): string {
  return t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/**
 * Compartir el evento escogiendo de la lista de docentes (Julian, 2026-10-19): antes
 * habia que escribir el correo completo de cada uno. Por defecto muestra la sede del
 * evento, con la opcion de ver todas las sedes; el buscador filtra por nombre o correo.
 * Se guardan los mismos correos de siempre en `docentes`, asi que las reglas no cambian.
 * Solo la pantalla del CREADOR la ofrece: el servidor lo exige igual.
 */
function CompartirEvento({
  eventId,
  sedeEvento,
  docentesIniciales,
  creadoPor,
  directorio,
  onAviso,
  onError,
}: {
  eventId: string;
  sedeEvento: string;
  docentesIniciales: string[];
  creadoPor: string;
  directorio: DocenteDirectorio[];
  onAviso: (m: string) => void;
  onError: (m: string) => void;
}) {
  const [docentes, setDocentes] = useState(docentesIniciales);
  const [busqueda, setBusqueda] = useState('');
  const [todasLasSedes, setTodasLasSedes] = useState(false);
  const [guardando, setGuardando] = useState(false);

  const nombreDe = (correo: string) => directorio.find((d) => d.correo === correo)?.nombre ?? correo;
  const q = sinTildes(busqueda.trim());
  const visibles = directorio.filter(
    (d) =>
      d.correo !== creadoPor &&
      (todasLasSedes || q || d.sede === sedeEvento) &&
      (!q || sinTildes(d.nombre).includes(q) || d.correo.includes(q)),
  );
  // Un correo escrito completo que no esta en el directorio se puede añadir igual, como antes.
  const correoLibre = busqueda.trim().toLowerCase();
  const ofrecerCorreo =
    correoLibre.includes('@') && !directorio.some((d) => d.correo === correoLibre) && !docentes.includes(correoLibre);

  function alternar(correo: string) {
    setDocentes((d) => (d.includes(correo) ? d.filter((c) => c !== correo) : [...d, correo]));
  }

  async function guardar() {
    setGuardando(true);
    try {
      await compartirEvento(eventId, docentes);
      onAviso('Lista de docentes actualizada.');
    } catch (e) {
      onError(`No fue posible compartir: ${(e as Error).message}`);
    } finally {
      setGuardando(false);
    }
  }

  const compartidos = docentes.filter((c) => c !== creadoPor);

  return (
    <div className="rounded-xl border border-line bg-card p-3">
      <p className="text-sm font-semibold text-strong">Docentes con acceso</p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        <span className="rounded-full bg-elevated px-2 py-1 text-xs text-soft">{nombreDe(creadoPor)} (creador)</span>
        {compartidos.map((c) => (
          <button
            key={c}
            onClick={() => alternar(c)}
            aria-label={`Quitar a ${nombreDe(c)}`}
            className="rounded-full border border-accent bg-accent-soft px-2 py-1 text-xs text-accent-soft-fg"
          >
            {nombreDe(c)} ✕
          </button>
        ))}
        {compartidos.length === 0 && <span className="text-xs text-muted">Todavía no lo ha compartido.</span>}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <input
          value={busqueda}
          onChange={(ev) => setBusqueda(ev.target.value)}
          placeholder="Buscar por nombre…"
          aria-label="Buscar docente por nombre"
          className="min-w-0 grow rounded-lg border border-line bg-elevated px-2 py-2 text-sm text-strong"
        />
        <label className="flex items-center gap-1 text-xs text-soft">
          <input type="checkbox" checked={todasLasSedes} onChange={(ev) => setTodasLasSedes(ev.target.checked)} />
          Todas las sedes
        </label>
      </div>

      {ofrecerCorreo && (
        <button
          onClick={() => {
            alternar(correoLibre);
            setBusqueda('');
          }}
          className="mt-2 rounded-lg border border-line px-3 py-1.5 text-xs text-strong"
        >
          Añadir {correoLibre}
        </button>
      )}

      <ul className="mt-2 max-h-72 space-y-1 overflow-y-auto">
        {directorio.length === 0 && <li className="p-2 text-xs text-muted">Cargando la lista de docentes…</li>}
        {directorio.length > 0 && visibles.length === 0 && (
          <li className="p-2 text-xs text-muted">Nadie coincide con «{busqueda}».</li>
        )}
        {visibles.map((d) => (
          <li key={d.correo}>
            <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-line p-2 text-sm hover:bg-hover">
              <input type="checkbox" checked={docentes.includes(d.correo)} onChange={() => alternar(d.correo)} />
              <span className="grow text-strong">{d.nombre}</span>
              {d.sede !== sedeEvento && <span className="text-xs text-muted">otra sede</span>}
            </label>
          </li>
        ))}
      </ul>

      <button
        disabled={guardando}
        onClick={() => void guardar()}
        className="mt-3 w-full rounded-lg bg-accent px-3 py-2 text-sm font-medium text-accent-fg disabled:opacity-50"
      >
        {guardando ? 'Guardando…' : `Guardar cambios (${compartidos.length} ${compartidos.length === 1 ? 'docente' : 'docentes'})`}
      </button>
    </div>
  );
}

/**
 * Borrado del evento. Separada visualmente de "Compartir" con los tokens de peligro:
 * es la unica accion de esta pantalla que no se puede deshacer.
 *
 * El boton abre una hoja aparte en vez de un `window.confirm`: un confirm se acepta por
 * reflejo, y esto se lleva por delante todas las sesiones registradas del evento.
 */
function ZonaEliminarEvento({
  evento,
  onError,
  onEliminado,
}: {
  evento: Event;
  onError: (m: string) => void;
  /**
   * Se avisa hacia ARRIBA en vez de con un `window.alert`: esta pantalla desaparece justo
   * despues de borrar, asi que el mensaje tiene que sobrevivirla y salir en la lista de
   * eventos. Y el resto del modulo avisa con bandas dentro de la pagina, no con dialogos
   * del navegador, que en el movil tapan todo y se cierran de un toque sin leerse.
   */
  onEliminado: (mensaje: string) => void;
}) {
  const [confirmando, setConfirmando] = useState(false);
  const [eliminando, setEliminando] = useState(false);

  async function confirmarBorrado() {
    setEliminando(true);
    try {
      const { sesionesBorradas } = await eliminarEvento(evento.eventId);
      onEliminado(
        `Se eliminó «${evento.nombre}» y ${sesionesBorradas} ${
          sesionesBorradas === 1 ? 'sesión registrada' : 'sesiones registradas'
        }.`,
      );
    } catch (e) {
      // El mensaje ya viene redactado para una persona (por ejemplo, cuando quien pulsa
      // no es el creador): se muestra tal cual, sin reformular.
      onError((e as Error).message);
      setConfirmando(false);
      setEliminando(false);
    }
  }

  return (
    <div className="rounded-xl border border-danger-soft bg-danger-soft p-3">
      <p className="text-sm font-semibold text-danger-soft-fg">Zona de eliminación</p>
      <p className="mt-1 text-xs text-danger-soft-fg">
        Elimina el evento completo y todas sus sesiones registradas. No se puede deshacer.
      </p>
      <button
        onClick={() => setConfirmando(true)}
        className="mt-3 min-h-[36px] w-full rounded-lg border border-danger-soft bg-card px-3 py-2 text-sm font-medium text-danger-soft-fg"
      >
        Eliminar este evento
      </button>

      {confirmando && (
        <ConfirmarEliminarEvento
          evento={evento}
          eliminando={eliminando}
          onConfirmar={() => void confirmarBorrado()}
          onCerrar={() => setConfirmando(false)}
        />
      )}
    </div>
  );
}

/**
 * Exige escribir el nombre exacto del evento para habilitar el botón: un clic aceptado
 * por reflejo no debería poder borrar datos de asistencia de menores.
 */
function ConfirmarEliminarEvento({
  evento,
  eliminando,
  onConfirmar,
  onCerrar,
}: {
  evento: Event;
  eliminando: boolean;
  onConfirmar: () => void;
  onCerrar: () => void;
}) {
  const [texto, setTexto] = useState('');
  const habilitado = texto === evento.nombre;

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-end bg-black/40 p-0 sm:place-items-center sm:p-4"
      onClick={eliminando ? undefined : onCerrar}
    >
      <div
        className="w-full max-w-md rounded-t-2xl border border-danger-soft bg-card p-4 sm:rounded-2xl"
        onClick={(ev) => ev.stopPropagation()}
      >
        <p className="text-lg font-semibold text-danger-soft-fg">Eliminar «{evento.nombre}»</p>
        <ul className="mt-2 list-disc space-y-1 pl-4 text-sm text-strong">
          <li>{evento.miembros.length} integrantes perderán su registro en este evento.</li>
          <li>Se borrarán TODAS las sesiones de asistencia ya registradas.</li>
          <li>Esta acción no se puede deshacer.</li>
        </ul>

        <label className="mt-3 block text-xs text-muted">
          Para confirmar, escriba el nombre del evento tal como aparece arriba:
          <input
            value={texto}
            onChange={(ev) => setTexto(ev.target.value)}
            placeholder={evento.nombre}
            disabled={eliminando}
            className="mt-1 block w-full rounded-lg border border-line bg-elevated px-2 py-2 text-base text-strong"
          />
        </label>

        <button
          disabled={!habilitado || eliminando}
          onClick={onConfirmar}
          className="mt-3 min-h-[36px] w-full rounded-lg bg-danger px-3 py-2 text-sm font-medium text-accent-fg disabled:opacity-50"
        >
          {eliminando ? 'Eliminando…' : 'Eliminar definitivamente'}
        </button>
        <button
          disabled={eliminando}
          onClick={onCerrar}
          className="mt-2 w-full rounded-lg border border-line p-2 text-sm text-soft disabled:opacity-50"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
