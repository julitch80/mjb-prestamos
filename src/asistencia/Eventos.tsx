import { useEffect, useMemo, useState } from 'react';
import PlanillaEvento from './PlanillaEvento';
import { buscarEstudiantes, crearEvento, leerEstudiantesDeSede, leerMisEventos } from './datos';
import { correoAutorAsync } from './identidad';
import { eventoVigente, resolverIntegrantes, validarRangoEvento } from './domain/eventos';
import { gradoSortKey, toDateKey } from './domain/ids';
import { nombreCompleto } from './domain/nombres';
import type { Event, EventMemberSource, Jornada, Student } from './domain/types';

/**
 * Umbral tecnico, no de negocio: Firestore acepta una escritura por segundo sobre un
 * mismo documento. Con mas de esto marcando a la vez desde varios telefonos, el registro
 * empieza a demorarse. No bloquea la creacion — solo avisa, porque un evento grande
 * (una jornada completa) es un caso real, no un error.
 */
const UMBRAL_AVISO_INTEGRANTES = 300;

/**
 * Lista y creacion de eventos — grupos temporales de asistencia.
 *
 * La navegacion a la planilla de un evento es estado local de este componente, no de
 * `index.tsx`: al volver de un evento hay que recargar la lista (pudo cambiarse su
 * vigencia o sus integrantes desde otra pantalla), y mantener esa recarga aqui evita que
 * `index.tsx` tenga que conocer los detalles internos de eventos.
 */
export default function Eventos({
  sede,
  puedeRegistrar,
}: {
  sede: string;
  /** Falso para la rectora: consulta lo que le compartan, pero no crea ni marca. */
  puedeRegistrar: boolean;
}) {
  const [eventos, setEventos] = useState<Event[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creando, setCreando] = useState(false);
  const [eventoAbierto, setEventoAbierto] = useState<Event | null>(null);
  const [miCorreo, setMiCorreo] = useState<string | null>(null);

  async function cargar() {
    setError(null);
    try {
      setEventos(await leerMisEventos());
    } catch (e) {
      setError(`No fue posible cargar los eventos: ${(e as Error).message}`);
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    void cargar();
    void correoAutorAsync().then(setMiCorreo);
  }, []);

  if (eventoAbierto) {
    return (
      <PlanillaEvento
        evento={eventoAbierto}
        miCorreo={miCorreo ?? ''}
        puedeRegistrar={puedeRegistrar}
        onVolver={() => {
          setEventoAbierto(null);
          void cargar();
        }}
      />
    );
  }

  const hoy = toDateKey(new Date());

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-base font-semibold text-strong">Eventos</h2>
        {puedeRegistrar && (
          <button
            onClick={() => setCreando(true)}
            className="shrink-0 rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-accent-fg"
          >
            + Crear evento
          </button>
        )}
      </div>
      <p className="text-xs text-muted">
        Ferias, centros de interés, salidas: un grupo de estudiantes que no es un curso,
        con su propia planilla por fecha.
      </p>

      {error && (
        <div className="rounded-xl border border-danger-soft bg-danger-soft p-3 text-sm text-danger-soft-fg">
          {error}
        </div>
      )}

      {cargando ? (
        <p className="text-sm text-muted">Cargando eventos…</p>
      ) : eventos.length === 0 ? (
        <p className="rounded-xl border border-line bg-card p-3 text-sm text-muted">
          Todavía no ha creado ni le han compartido ningún evento.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {eventos.map((ev) => {
            const vigente = eventoVigente(ev, hoy);
            return (
              <li key={ev.eventId}>
                <button
                  onClick={() => setEventoAbierto(ev)}
                  className={[
                    'w-full rounded-xl border border-line bg-card p-3 text-left',
                    vigente ? '' : 'opacity-60',
                  ].join(' ')}
                >
                  <p className="text-sm font-semibold text-strong">
                    {ev.nombre}
                    {!vigente && <span className="ml-2 text-xs font-normal text-muted">(no vigente)</span>}
                  </p>
                  <p className="text-xs text-muted">
                    {ev.desde} a {ev.hasta} · {ev.miembros.length} integrantes
                  </p>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {creando && (
        <FormularioEvento
          sede={sede}
          onCreado={async (nuevo) => {
            setCreando(false);
            setEventos((prev) => [nuevo, ...prev]);
            setEventoAbierto(nuevo);
          }}
          onCerrar={() => setCreando(false)}
        />
      )}
    </div>
  );
}

const JORNADAS: { valor: Jornada; label: string }[] = [
  { valor: 'manana', label: 'Mañana (toda)' },
  { valor: 'tarde', label: 'Tarde (toda)' },
];

/**
 * Formulario de creacion. Las tres formas de seleccion (grados, jornadas, individuales)
 * se combinan en el mismo `EventMemberSource`: por eso el conteo se recalcula con
 * `resolverIntegrantes` cada vez que cualquiera de las tres cambia, en vez de sumar
 * listas por separado, que contaria dos veces a quien quede cubierto por mas de una.
 */
function FormularioEvento({
  sede,
  onCreado,
  onCerrar,
}: {
  sede: string;
  onCreado: (evento: Event) => void;
  onCerrar: () => void;
}) {
  const [nombre, setNombre] = useState('');
  const [desde, setDesde] = useState(toDateKey(new Date()));
  const [hasta, setHasta] = useState(toDateKey(new Date()));
  const [grados, setGrados] = useState<Set<string>>(new Set());
  const [jornadas, setJornadas] = useState<Set<Jornada>>(new Set());
  const [individuales, setIndividuales] = useState<Map<string, Student>>(new Map());
  const [busqueda, setBusqueda] = useState('');
  const [candidatos, setCandidatos] = useState<Student[]>([]);

  const [candidatosSede, setCandidatosSede] = useState<Student[]>([]);
  const [cargandoSede, setCargandoSede] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void leerEstudiantesDeSede(sede)
      .then(setCandidatosSede)
      .finally(() => setCargandoSede(false));
  }, [sede]);

  const gradosDisponibles = useMemo(
    () =>
      [...new Set(candidatosSede.map((e) => e.gradoActual))].sort(
        (a, b) => gradoSortKey(a).localeCompare(gradoSortKey(b)) || a.localeCompare(b),
      ),
    [candidatosSede],
  );

  const origen: EventMemberSource = useMemo(
    () => ({
      grados: [...grados],
      jornadas: [...jornadas],
      individuales: [...individuales.keys()],
    }),
    [grados, jornadas, individuales],
  );

  const integrantes = useMemo(
    () => resolverIntegrantes(candidatosSede, origen),
    [candidatosSede, origen],
  );

  useEffect(() => {
    if (busqueda.trim().length < 2) {
      setCandidatos([]);
      return;
    }
    const t = setTimeout(() => {
      void buscarEstudiantes(sede, busqueda).then(setCandidatos);
    }, 250);
    return () => clearTimeout(t);
  }, [busqueda, sede]);

  function alternarGrado(g: string) {
    setGrados((prev) => {
      const n = new Set(prev);
      if (n.has(g)) n.delete(g);
      else n.add(g);
      return n;
    });
  }

  function alternarJornada(j: Jornada) {
    setJornadas((prev) => {
      const n = new Set(prev);
      if (n.has(j)) n.delete(j);
      else n.add(j);
      return n;
    });
  }

  function agregarIndividual(e: Student) {
    setIndividuales((prev) => new Map(prev).set(e.studentId, e));
    setBusqueda('');
    setCandidatos([]);
  }

  function quitarIndividual(studentId: string) {
    setIndividuales((prev) => {
      const n = new Map(prev);
      n.delete(studentId);
      return n;
    });
  }

  const errorRango = validarRangoEvento(desde, hasta);
  const listo = nombre.trim() !== '' && !errorRango && integrantes.length > 0;

  async function enviar() {
    if (!listo) return;
    setEnviando(true);
    setError(null);
    try {
      const nuevo = await crearEvento({
        nombre: nombre.trim(),
        sede,
        desde,
        hasta,
        miembros: integrantes,
        origenMiembros: origen,
      });
      onCreado(nuevo);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-end bg-black/40 p-0 sm:place-items-center sm:p-4"
      onClick={onCerrar}
    >
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-auto rounded-t-2xl border border-line bg-card p-4 sm:rounded-2xl"
        onClick={(ev) => ev.stopPropagation()}
      >
        <p className="text-lg font-semibold text-strong">Crear evento</p>

        <label className="mt-2 block text-xs text-muted">
          Nombre
          <input
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Feria de la ciencia"
            className="mt-0.5 block w-full rounded-lg border border-line bg-elevated px-2 py-2 text-base text-strong"
          />
        </label>

        <div className="mt-2 grid grid-cols-2 gap-2">
          <label className="text-xs text-muted">
            Desde
            <input
              type="date"
              value={desde}
              onChange={(e) => setDesde(e.target.value)}
              className="mt-0.5 block w-full rounded-lg border border-line bg-elevated px-2 py-1.5 text-sm text-strong"
            />
          </label>
          <label className="text-xs text-muted">
            Hasta
            <input
              type="date"
              value={hasta}
              onChange={(e) => setHasta(e.target.value)}
              className="mt-0.5 block w-full rounded-lg border border-line bg-elevated px-2 py-1.5 text-sm text-strong"
            />
          </label>
        </div>
        {/* El mensaje viene redactado por el dominio para que lo lea un docente tal cual;
            no se reformula aqui. */}
        {errorRango && <p className="mt-1 text-xs text-danger-soft-fg">{errorRango}</p>}

        <p className="mt-4 text-sm font-semibold text-strong">Integrantes</p>
        <p className="text-xs text-muted">
          Combine grados completos, jornadas enteras y estudiantes sueltos: se suman sin
          repetir a nadie dos veces.
        </p>

        {cargandoSede ? (
          <p className="mt-2 text-sm text-muted">Cargando estudiantes de la sede…</p>
        ) : (
          <>
            <div className="mt-2">
              <p className="text-xs font-medium text-muted">Jornada completa</p>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {JORNADAS.map((j) => (
                  <button
                    key={j.valor}
                    onClick={() => alternarJornada(j.valor)}
                    className={[
                      'rounded-full border px-3 py-1.5 text-sm',
                      jornadas.has(j.valor)
                        ? 'border-accent bg-accent-soft font-semibold text-accent-soft-fg'
                        : 'border-line text-soft',
                    ].join(' ')}
                  >
                    {j.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-2">
              <p className="text-xs font-medium text-muted">Grados completos</p>
              <div className="mt-1 flex max-h-40 flex-wrap gap-1.5 overflow-y-auto">
                {gradosDisponibles.map((g) => (
                  <button
                    key={g}
                    onClick={() => alternarGrado(g)}
                    className={[
                      'rounded-full border px-3 py-1.5 text-sm',
                      grados.has(g)
                        ? 'border-accent bg-accent-soft font-semibold text-accent-soft-fg'
                        : 'border-line text-soft',
                    ].join(' ')}
                  >
                    {g}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-2">
              <p className="text-xs font-medium text-muted">Estudiantes sueltos</p>
              <input
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Buscar por apellido o nombre…"
                className="mt-1 block w-full rounded-lg border border-line bg-elevated px-2 py-2 text-base text-strong"
              />
              {candidatos.length > 0 && (
                <ul className="mt-1 space-y-1">
                  {candidatos.map((e) => (
                    <li key={e.studentId}>
                      <button
                        onClick={() => agregarIndividual(e)}
                        className="w-full rounded-lg border border-line p-2 text-left text-sm text-strong"
                      >
                        {nombreCompleto(e)}
                        <span className="ml-2 text-xs text-muted">{e.gradoActual}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {individuales.size > 0 && (
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {[...individuales.values()].map((e) => (
                    <span
                      key={e.studentId}
                      className="flex items-center gap-1 rounded-full border border-line bg-elevated px-2 py-1 text-xs text-strong"
                    >
                      {nombreCompleto(e)}
                      <button
                        onClick={() => quitarIndividual(e.studentId)}
                        aria-label={`Quitar a ${nombreCompleto(e)}`}
                        className="grid h-4 w-4 place-items-center rounded-full text-muted"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        <p className="mt-3 text-sm font-semibold text-strong">
          {integrantes.length} integrante{integrantes.length === 1 ? '' : 's'} en la selección
        </p>

        {integrantes.length > UMBRAL_AVISO_INTEGRANTES && (
          <p className="mt-1 rounded-lg border border-warning-soft bg-warning-soft p-2 text-xs text-warning-soft-fg">
            Con más de {UMBRAL_AVISO_INTEGRANTES} integrantes, si varios docentes escanean
            a la vez el registro puede ir lento: Firestore solo acepta una escritura por
            segundo sobre la misma sesión. No es un límite de la app, es del servidor. El
            evento igual se puede crear.
          </p>
        )}

        {error && (
          <div className="mt-3 rounded-lg border border-danger-soft bg-danger-soft p-2 text-sm text-danger-soft-fg">
            {error}
          </div>
        )}

        <button
          disabled={!listo || enviando}
          onClick={() => void enviar()}
          className="mt-3 w-full rounded-lg bg-accent px-3 py-2 text-sm font-medium text-accent-fg disabled:opacity-50"
        >
          {enviando ? 'Creando…' : 'Crear evento'}
        </button>
        <button
          onClick={onCerrar}
          className="mt-2 w-full rounded-lg border border-line p-2 text-sm text-soft"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
