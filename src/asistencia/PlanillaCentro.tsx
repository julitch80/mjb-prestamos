import { useCallback, useEffect, useMemo, useState } from 'react';
import Avatar from './Avatar';
import Ayuda from './Ayuda';
import EscanerQr from './EscanerQr';
import VerificacionFoto from './VerificacionFoto';
import { CLASE_MARCA, SIGLA } from './Planilla';
import {
  abrirSesionPrograma,
  buscarEstudiantes,
  buscarPorQrToken,
  inscribirEnGrupoPrograma,
  leerEstudiantesDeSede,
  leerMisGruposDePrograma,
  leerSesionesPrograma,
  llenarColumnaPrograma,
  marcarEnPrograma,
  retirarDeGrupoPrograma,
} from './datos';
import { estadisticaEvento, resumenSesionEvento } from './domain/eventos';
import { detectarDuplicados } from './domain/programas';
import { conDenominador } from './domain/stats';
import { toDateKey } from './domain/ids';
import { MARKS, findMark, type MarkCode } from './domain/marks';
import { nombreCompleto } from './domain/nombres';
import type {
  EventSession,
  GrupoPrograma,
  Programa,
  SesionPrograma,
  Student,
} from './domain/types';

type Pestana = 'registro' | 'columnas' | 'estadisticas' | 'integrantes';

const PESTANAS: { clave: Pestana; nombre: string; descripcion: string }[] = [
  {
    clave: 'registro',
    nombre: 'Registro',
    descripcion:
      'Pase la lista del día: escanee el código del estudiante y confirme con la foto, o márquelo desde la lista.',
  },
  {
    clave: 'columnas',
    nombre: 'Por columnas',
    descripcion:
      'El cuaderno completo: una columna por sesión registrada. Toque una casilla para corregirla o el encabezado para abrir esa fecha.',
  },
  {
    clave: 'estadisticas',
    nombre: 'Estadísticas',
    descripcion:
      'Cuánto ha asistido cada estudiante, siempre sobre el número de sesiones que de verdad se registraron.',
  },
  {
    clave: 'integrantes',
    nombre: 'Inscripción',
    descripcion:
      'Inscribir o retirar estudiantes de este centro. Solo la coordinación del programa puede hacerlo.',
  },
];

/**
 * TEXTO DEL CONFLICTO — se escribe una sola vez y se usa en la fila y en la hoja de
 * marcar. Lo lee un docente, no un programador: no dice "enConflicto", dice qué pasó y
 * qué tiene que hacer él (nada).
 */
const AVISO_CONFLICTO =
  'Este estudiante quedó inscrito en dos centros de interés a la vez. No es un error suyo ni de la lista: la coordinación del programa va a decidir en cuál se queda. Mientras tanto aparece en las dos planillas y usted puede llamarlo a lista con normalidad.';

/**
 * Nombres de dia y mes escritos a mano, NO con Intl.
 *
 * Misma razon que en `domain/direccion-grupo.ts`: el locale 'es-CO' no llega completo en
 * todos los runtimes, y una fecha que en un telefono dice "mié" y en otro dice "Wed" es
 * exactamente el tipo de detalle que hace desconfiar de la planilla.
 */
const DIAS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/** Partes de una fecha 'YYYY-MM-DD'. En UTC a proposito: sin hora no hay huso que corra el dia. */
function partesFecha(fecha: string): { dia: number; mes: number; diaSemana: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(fecha);
  if (!m) return null;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  if (Number.isNaN(d.getTime())) return null;
  return { dia: Number(m[3]), mes: Number(m[2]) - 1, diaSemana: d.getUTCDay() };
}

/** «12 ago» — para la casilla estrecha del encabezado de columna. */
function fechaCorta(fecha: string): string {
  const p = partesFecha(fecha);
  return p ? `${p.dia} ${MESES[p.mes]}` : fecha;
}

/** «mié 12 ago» — para las pastillas, donde sí cabe el día de la semana. */
function fechaLegible(fecha: string): string {
  const p = partesFecha(fecha);
  return p ? `${DIAS[p.diaSemana]} ${p.dia} ${MESES[p.mes]}` : fecha;
}

/** Solo el día de la semana («mié»), para la segunda línea del encabezado de columna. */
function diaSemana(fecha: string): string {
  const p = partesFecha(fecha);
  return p ? DIAS[p.diaSemana] : '';
}

/**
 * Planilla de UN centro de interes en UNA fecha.
 *
 * Es la planilla que el docente ya conoce —foto grande, las siete marcas, llenar la
 * columna, escaner de QR—, no una pantalla nueva: quien lidera un centro de interes es
 * el mismo docente que pasa lista en su clase, y no tiene por que aprender dos formas
 * de hacer lo mismo.
 *
 * DOS VISTAS, y la distincion es lo que hace usable un centro de interes de semestre:
 *   - «Registro» trabaja sobre UNA sesion —la del dia—, con foto grande y las siete
 *     marcas, que es como se pasa lista de pie y con el telefono en la mano;
 *   - «Por columnas» enseña el cuaderno entero, una columna por sesion registrada, para
 *     mirar el semestre y corregir lo que quedo mal.
 * La barra de sesiones es la que une las dos: sin ella el docente solo veia un campo de
 * fecha suelto y no habia nada que dijera que cada semana es una columna nueva.
 *
 * AUTORIDAD. Aqui hay dos papeles distintos y la pantalla no los mezcla:
 *   - el LIDER del centro registra la asistencia y ve su estadistica, nada mas;
 *   - la COORDINACION del programa, ademas, inscribe y retira.
 * Los botones de inscripcion NO se pintan para quien no coordina. La regla tambien los
 * rechazaria, pero ofrecer un boton que el servidor va a negar es maltratar al docente.
 */
export default function PlanillaCentro({
  programa,
  grupo,
  puedeRegistrar,
  esCoordinador,
  gruposDelPrograma,
  onVolver,
}: {
  programa: Programa;
  grupo: GrupoPrograma;
  /**
   * Falso para la rectora y los cargos de apoyo. Pueden LEER el centro, pero
   * `asisCanRecord()` los excluye de escribir. Sin esta distincion la pantalla les
   * ofreceria botones que el servidor rechaza.
   */
  puedeRegistrar: boolean;
  /** `programa.coordinadores` incluye a quien mira. Lo resuelve el padre, que ya leyó el programa. */
  esCoordinador: boolean;
  /**
   * Los centros del programa que el usuario puede ver, si el padre ya los leyó.
   *
   * Sirven para UNA sola cosa: saber quién quedó inscrito en dos centros a la vez. Si no
   * llegan, esta pantalla los pide con `leerMisGruposDePrograma` —NUNCA armando la
   * consulta a mano: la rama de docente necesita el `where('docentes','array-contains')`
   * o Firestore rechaza la consulta entera con permission-denied—.
   */
  gruposDelPrograma?: GrupoPrograma[];
  onVolver: () => void;
}) {
  const [pestana, setPestana] = useState<Pestana>('registro');
  /**
   * La sesion que se esta mirando. `null` es un estado REAL, no un placeholder: significa
   * "todavia no hay ninguna sesion abierta ni elegida", y la pantalla entonces no enseña
   * una lista en blanco que parezca un dia sin marcar, sino el estado vacio que manda a
   * «+ Nueva sesión».
   */
  const [fecha, setFecha] = useState<string | null>(null);
  /** Borrador del selector de «+ Nueva sesión»; `null` mientras el selector esta cerrado. */
  const [fechaNueva, setFechaNueva] = useState<string | null>(null);
  const [miembros, setMiembros] = useState<Student[]>([]);
  const [sesiones, setSesiones] = useState<SesionPrograma[]>([]);
  const [hermanos, setHermanos] = useState<GrupoPrograma[]>(gruposDelPrograma ?? []);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [escaneando, setEscaneando] = useState(false);
  const [candidatoQr, setCandidatoQr] = useState<Student | null>(null);
  const [marcando, setMarcando] = useState<Student | null>(null);
  const [llenando, setLlenando] = useState(false);

  // La lista de inscritos es una FOTO FIJA de studentIds (`grupo.miembros`), igual que
  // `Event.miembros`: se resuelve contra los estudiantes activos de la sede y se
  // preserva el orden en que llegó, que ya viene por apellidos.
  useEffect(() => {
    let vivo = true;
    setCargando(true);
    void (async () => {
      try {
        const [todos, sesionesCentro] = await Promise.all([
          leerEstudiantesDeSede(programa.sede),
          leerSesionesPrograma(programa.programaId, grupo.grupoId),
        ]);
        if (!vivo) return;
        const porId = new Map(todos.map((e) => [e.studentId, e]));
        setMiembros(grupo.miembros.map((id) => porId.get(id)).filter((e): e is Student => !!e));
        setSesiones(sesionesCentro);
        // Al entrar se abre la sesion MAS RECIENTE que exista, no la de hoy: hoy casi
        // nunca hay clase del centro, y arrancar en una columna vacia hace creer que se
        // perdio lo de la semana pasada. Para empezar la de hoy esta «+ Nueva sesión».
        // Si el usuario ya tenia una fecha elegida, se respeta.
        const reciente = [...sesionesCentro].sort((a, b) => b.fecha.localeCompare(a.fecha))[0];
        setFecha((prev) => (prev ?? reciente?.fecha ?? null));
      } catch (e) {
        if (vivo) {
          setError(
            `No fue posible abrir el centro de interés. Intente de nuevo en un momento. (${(e as Error).message})`,
          );
        }
      } finally {
        if (vivo) setCargando(false);
      }
    })();
    return () => {
      vivo = false;
    };
  }, [programa.programaId, programa.sede, grupo.grupoId, grupo.miembros]);

  // Los demas centros, SOLO para detectar a quien quedo en dos. Si falla no se enseña
  // ningun error: no poder señalar un conflicto no impide pasar lista, que es a lo que
  // el docente vino.
  useEffect(() => {
    if (gruposDelPrograma) {
      setHermanos(gruposDelPrograma);
      return;
    }
    let vivo = true;
    void leerMisGruposDePrograma(programa.programaId)
      .then((g) => {
        if (vivo) setHermanos(g);
      })
      .catch(() => undefined);
    return () => {
      vivo = false;
    };
  }, [programa.programaId, gruposDelPrograma]);

  /**
   * Quien esta inscrito en DOS centros del programa a la vez.
   *
   * PRIMERO lo que hay ESCRITO en el grupo (`enConflicto`), y solo como refuerzo lo que
   * se pueda deducir de los centros que el usuario alcanza a ver.
   *
   * El orden importa y no es estilistico. Deducirlo en el cliente falla justo en el caso
   * mas comun: un lider consulta con where('docentes','array-contains', su correo) y
   * recibe UNICAMENTE sus centros, asi que si solo tiene uno no hay con que comparar y
   * la marca no aparece nunca. El conflicto solo se DETECTA mirando los veintiun centros
   * a la vez —cosa que solo alcanza la coordinacion, porque `exclusivo` es unicidad
   * ENTRE documentos y ninguna regla de Firestore puede comprobarla sin reventar el tope
   * de 10 `get()`—, y por eso se deja escrito al importar.
   *
   * La deduccion se conserva para que la coordinacion vea al instante un choque que
   * acaba de crear a mano, antes de que nadie vuelva a correr la importacion.
   */
  const enConflicto = useMemo(() => {
    const marcados = new Set<string>(grupo.enConflicto ?? []);
    if (!programa.exclusivo) return marcados;
    const dobles = detectarDuplicados(hermanos.filter((g) => g.activo));
    for (const d of dobles) {
      if (d.grupoIds.includes(grupo.grupoId)) marcados.add(d.studentId);
    }
    return marcados;
  }, [hermanos, grupo.grupoId, grupo.enConflicto, programa.exclusivo]);

  const recargarSesiones = useCallback(async () => {
    setSesiones(await leerSesionesPrograma(programa.programaId, grupo.grupoId));
  }, [programa.programaId, grupo.grupoId]);

  /** Las sesiones ya registradas, de la mas reciente a la mas antigua: asi van las pastillas. */
  const sesionesRecientes = useMemo(
    () => [...sesiones].sort((a, b) => b.fecha.localeCompare(a.fecha)),
    [sesiones],
  );

  const sesionActual = useMemo(
    () => (fecha ? (sesiones.find((s) => s.fecha === fecha) ?? null) : null),
    [sesiones, fecha],
  );
  const avance = resumenSesionEvento(comoSesionDeEvento(sesionActual), grupo.miembros);

  /**
   * Abre la sesion del dia SOLO cuando de verdad hay que escribir en ella, nunca al
   * elegir la fecha: si se abriera al mirar, cada vistazo dejaria una sesion vacia y el
   * denominador de la estadistica —sesiones REGISTRADAS, jamas el calendario— quedaria
   * inflado con dias en los que nadie paso lista.
   *
   * ESTO SIGUE VALIENDO CON EL BOTON «+ Nueva sesión». Ese boton NO escribe el documento:
   * selecciona la fecha y deja la lista lista para marcar. El documento nace con la
   * primera marca, aqui. Un docente que abre el selector, ve que se equivoco de semana y
   * se sale no deja ninguna sesion fantasma en la estadistica.
   */
  async function asegurarSesion(fechaSesion: string): Promise<void> {
    if (sesiones.some((s) => s.fecha === fechaSesion)) return;
    const nueva = await abrirSesionPrograma(programa.programaId, grupo.grupoId, fechaSesion);
    setSesiones((prev) => [...prev, nueva]);
  }

  async function marcar(studentId: string, estado: MarkCode) {
    if (!fecha) return;
    setError(null);
    try {
      await asegurarSesion(fecha);
      await marcarEnPrograma(programa.programaId, grupo.grupoId, fecha, studentId, estado);
      await recargarSesiones();
    } catch (e) {
      setError(`No fue posible guardar la marca: ${(e as Error).message}`);
    }
  }

  async function llenarColumna(estado: MarkCode) {
    if (!fecha) return;
    setError(null);
    try {
      await asegurarSesion(fecha);
      const llenadas = await llenarColumnaPrograma(
        programa.programaId,
        grupo.grupoId,
        fecha,
        grupo.miembros,
        estado,
        sesionActual?.estudiantes ?? {},
      );
      await recargarSesiones();
      setAviso(
        llenadas === 0
          ? 'No quedaba ninguna casilla vacía: no se cambió nada.'
          : `Se llenaron ${llenadas} casillas vacías. Lo que ya estaba marcado no se tocó.`,
      );
    } catch (e) {
      setError(`No fue posible llenar la lista: ${(e as Error).message}`);
    }
  }

  async function leerQr(texto: string) {
    setAviso(null);
    setError(null);
    try {
      const { estudiante, otraSede } = await buscarPorQrToken(programa.sede, texto);
      if (!estudiante) {
        setAviso(
          otraSede
            ? 'Ese código es de un estudiante de otra sede.'
            : 'No se reconoció el código. Puede marcarlo desde la lista de inscritos.',
        );
        return;
      }
      if (!grupo.miembros.includes(estudiante.studentId)) {
        setEscaneando(false);
        setAviso(`${nombreCompleto(estudiante)} no está inscrito en «${grupo.nombre}».`);
        return;
      }
      setEscaneando(false);
      setCandidatoQr(estudiante);
    } catch (e) {
      setError(`No fue posible leer el código: ${(e as Error).message}`);
    }
  }

  async function marcarDesdeQr(estado: MarkCode) {
    if (!candidatoQr) return;
    const nombre = nombreCompleto(candidatoQr);
    await marcar(candidatoQr.studentId, estado);
    setAviso(`${nombre} — marcado.`);
    setCandidatoQr(null);
  }

  if (cargando) {
    return <p className="p-3 text-sm text-muted">Cargando el centro de interés…</p>;
  }

  const pestanasVisibles = PESTANAS.filter((p) => p.clave !== 'integrantes' || esCoordinador);

  return (
    <div className="space-y-3">
      <div>
        <button onClick={onVolver} className="text-xs text-muted underline">
          ← Volver a los centros de interés
        </button>
        <h2 className="text-base font-semibold text-strong">{grupo.nombre}</h2>
        <p className="text-xs text-muted">
          {programa.nombre} · {grupo.miembros.length}{' '}
          {grupo.miembros.length === 1 ? 'inscrito' : 'inscritos'} · lidera {grupo.lider}
        </p>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {pestanasVisibles.map(({ clave, nombre, descripcion }) => (
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
        ))}
      </div>

      {enConflicto.size > 0 && (
        <div className="rounded-xl border border-warning-soft bg-warning-soft p-3 text-xs text-warning-soft-fg">
          {enConflicto.size === 1 ? (
            <>
              Hay <b>1 estudiante</b> inscrito además en otro centro de interés. Aparece
              señalado en la lista. La coordinación del programa decidirá en cuál se queda;
              usted no tiene que hacer nada.
            </>
          ) : (
            <>
              Hay <b>{enConflicto.size} estudiantes</b> inscritos además en otro centro de
              interés. Aparecen señalados en la lista. La coordinación del programa
              decidirá en cuál se quedan; usted no tiene que hacer nada.
            </>
          )}
        </div>
      )}

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
          <BarraSesiones
            sesiones={sesionesRecientes}
            fecha={fecha}
            fechaNueva={fechaNueva}
            puedeRegistrar={puedeRegistrar}
            onElegir={(f) => {
              setFecha(f);
              setFechaNueva(null);
              setAviso(null);
            }}
            onAbrirSelector={() => setFechaNueva(fecha && !sesionActual ? fecha : toDateKey(new Date()))}
            onCambiarNueva={setFechaNueva}
            onCancelarSelector={() => setFechaNueva(null)}
          />

          {fecha && (
            <div className="rounded-xl border border-line bg-card p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold text-strong">
                  Sesión del {fechaLegible(fecha)}
                </span>
                {puedeRegistrar && (
                  <>
                    <button
                      onClick={() => setEscaneando(true)}
                      className="rounded-lg border border-line px-3 py-2 text-sm font-medium text-strong"
                    >
                      Escanear código
                    </button>
                    <button
                      onClick={() => setLlenando(true)}
                      title="Llenar de una vez las casillas vacías de este día"
                      className="rounded-lg border border-line px-3 py-2 text-sm font-medium text-strong"
                    >
                      Llenar la lista
                    </button>
                  </>
                )}
                <span className="grow" />
                <span className="text-sm font-semibold text-strong">
                  {avance.marcados} de {avance.total} marcados
                </span>
              </div>

              {(fecha < programa.desde || fecha > programa.hasta) && (
                <p className="mt-2 text-xs text-warning-soft-fg">
                  Esa fecha queda fuera del semestre del programa ({programa.desde} a{' '}
                  {programa.hasta}). Se puede registrar igual, pero revise que sea la fecha
                  correcta.
                </p>
              )}

              {!sesionActual && (
                <p className="mt-2 text-xs text-muted">
                  Esta sesión todavía no existe: se creará sola con la primera marca que
                  usted ponga. Si se equivocó de fecha, cierre y vuelva a elegir; no queda
                  nada guardado.
                </p>
              )}

              {candidatoQr && (
                <ul className="mt-2">
                  <VerificacionFoto
                    estudiante={candidatoQr}
                    tamano={110}
                    extra={
                      enConflicto.has(candidatoQr.studentId) ? (
                        <MarcaConflicto />
                      ) : undefined
                    }
                    acciones={<BotonesMarca onElegir={(m) => void marcarDesdeQr(m)} />}
                  />
                </ul>
              )}
            </div>
          )}

          {!fecha ? null : miembros.length === 0 ? (
            <div className="rounded-xl border border-line bg-card p-4 text-center">
              <p className="text-sm text-strong">Este centro todavía no tiene inscritos.</p>
              <p className="mt-1 text-xs text-muted">
                {esCoordinador
                  ? 'Use la pestaña «Inscripción» para agregar a los estudiantes que le corresponden.'
                  : 'La coordinación del programa es quien inscribe a los estudiantes. En cuanto lo haga, aparecerán aquí.'}
              </p>
            </div>
          ) : (
            <ul className="space-y-1">
              {miembros.map((e) => {
                const m = sesionActual?.estudiantes?.[e.studentId];
                const def = m ? findMark(m.estado) : undefined;
                const conflicto = enConflicto.has(e.studentId);
                return (
                  <li
                    key={e.studentId}
                    className={[
                      'flex flex-wrap items-center gap-2 rounded-lg border bg-card p-2',
                      // El señalamiento va en el BORDE de la fila, no en una pastilla
                      // suelta: se ve de un vistazo recorriendo la lista con el pulgar.
                      conflicto ? 'border-warning-soft bg-warning-soft' : 'border-line',
                    ].join(' ')}
                  >
                    {/* Foto grande, como en la planilla de clase: es el único control de
                        identidad que hay aquí (ver VerificacionFoto). */}
                    <Avatar estudiante={e} tamano={56} />
                    <span className="grow text-sm">
                      <b className="block text-strong">{nombreCompleto(e)}</b>
                      <span className="text-xs text-muted">{e.gradoActual}</span>
                      {conflicto && <MarcaConflicto />}
                    </span>
                    {def && m && (
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-semibold ${CLASE_MARCA[def.code]}`}
                        title={`Registró ${m.registradoPor}`}
                      >
                        {SIGLA[def.code]}
                      </span>
                    )}
                    {puedeRegistrar && (
                      <button
                        onClick={() => setMarcando(e)}
                        className="rounded-lg border border-line px-3 py-1.5 text-sm text-strong"
                        aria-label={`Marcar a ${nombreCompleto(e)}`}
                      >
                        {def ? 'Cambiar' : 'Marcar'}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      {pestana === 'columnas' && (
        <HistorialColumnas
          miembros={miembros}
          sesiones={sesiones}
          fecha={fecha}
          enConflicto={enConflicto}
          onAbrirSesion={(f) => {
            setFecha(f);
            setFechaNueva(null);
            setPestana('registro');
          }}
          onAbrirCasilla={(f, e) => {
            setFecha(f);
            setFechaNueva(null);
            setPestana('registro');
            // Solo se abre la hoja de marcar a quien PUEDE registrar. A la rectora y a
            // los cargos de apoyo la casilla los lleva a la sesion y ahi se queda: el
            // servidor les rechazaria la escritura y ofrecerles el menu seria mentirles.
            if (puedeRegistrar) setMarcando(e);
          }}
        />
      )}

      {pestana === 'estadisticas' && (
        <EstadisticasCentro miembros={miembros} sesiones={sesiones} />
      )}

      {pestana === 'integrantes' && esCoordinador && (
        <Inscripcion
          programa={programa}
          grupo={grupo}
          miembros={miembros}
          enConflicto={enConflicto}
          onAviso={setAviso}
          onError={setError}
        />
      )}

      {escaneando && (
        <EscanerQr
          onLeer={(t) => void leerQr(t)}
          onCerrar={() => setEscaneando(false)}
          pausado={Boolean(candidatoQr)}
        />
      )}

      {marcando && (
        <HojaMarcar
          estudiante={marcando}
          enConflicto={enConflicto.has(marcando.studentId)}
          marcaActual={sesionActual?.estudiantes?.[marcando.studentId] ?? null}
          onElegir={(estado) => {
            void marcar(marcando.studentId, estado);
            setMarcando(null);
          }}
          onCerrar={() => setMarcando(null)}
        />
      )}

      {llenando && fecha && (
        <MenuLlenarLista
          fecha={fecha}
          total={grupo.miembros.length}
          vacias={grupo.miembros.filter((id) => !sesionActual?.estudiantes?.[id]).length}
          onElegir={(estado) => {
            void llenarColumna(estado);
            setLlenando(false);
          }}
          onCerrar={() => setLlenando(false)}
        />
      )}
    </div>
  );
}

/**
 * `resumenSesionEvento` y `estadisticaEvento` piden `EventSession`. Una `SesionPrograma`
 * es identica en forma —asi se diseño a proposito, ver `domain/programas.ts`— salvo por
 * su identidad. Se adapta aqui en cuatro lineas en vez de duplicar el motor de conteo.
 */
function comoSesionDeEvento(s: SesionPrograma | null): EventSession | null {
  if (!s) return null;
  return {
    eventId: `${s.programaId}/${s.grupoId}`,
    fecha: s.fecha,
    estudiantes: s.estudiantes,
    ultimaEscrituraPor: s.ultimaEscrituraPor,
    ultimaEscrituraEn: s.ultimaEscrituraEn,
  };
}

/**
 * La barra de sesiones — el arreglo del problema que reporto Julian.
 *
 * Antes aqui habia un `<input type="date">` suelto. Funcionaba (cambiar la fecha YA
 * cambiaba de sesion, el modelo siempre guardo una sesion por fecha), pero no habia NADA
 * que dijera que cada semana es una columna nueva ni forma de ver las semanas anteriores,
 * y el docente concluyo —con razon— que el centro de interes era un unico evento que se
 * repetia. La pastilla y el boton dicen lo que el campo de fecha callaba.
 *
 * El boton NO escribe nada: selecciona la fecha. Ver `asegurarSesion`.
 */
function BarraSesiones({
  sesiones,
  fecha,
  fechaNueva,
  puedeRegistrar,
  onElegir,
  onAbrirSelector,
  onCambiarNueva,
  onCancelarSelector,
}: {
  /** Ya ordenadas de la mas reciente a la mas antigua. */
  sesiones: SesionPrograma[];
  fecha: string | null;
  fechaNueva: string | null;
  puedeRegistrar: boolean;
  onElegir: (fecha: string) => void;
  onAbrirSelector: () => void;
  onCambiarNueva: (fecha: string) => void;
  onCancelarSelector: () => void;
}) {
  // La fecha elegida que TODAVIA no tiene documento se enseña como una pastilla mas, para
  // que el docente no crea que perdio la seleccion. Va aparte y dicha como lo que es.
  const seleccionSinSesion = fecha && !sesiones.some((s) => s.fecha === fecha) ? fecha : null;

  return (
    <div className="rounded-xl border border-line bg-card p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold text-muted">
          {sesiones.length === 0
            ? 'Sesiones registradas'
            : `${sesiones.length} ${sesiones.length === 1 ? 'sesión registrada' : 'sesiones registradas'}`}
        </span>
        <span className="grow" />
        {puedeRegistrar && (
          <button
            onClick={onAbrirSelector}
            title="Abrir la lista de un día nuevo para empezar a marcar"
            className="rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-accent-fg"
          >
            + Nueva sesión
          </button>
        )}
      </div>

      {fechaNueva !== null && (
        <div className="mt-2 rounded-lg border border-accent bg-accent-soft p-2 text-accent-soft-fg">
          <p className="text-xs font-semibold">¿De qué día es la clase que va a registrar?</p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <input
              type="date"
              value={fechaNueva}
              onChange={(ev) => onCambiarNueva(ev.target.value)}
              className="rounded-lg border border-line bg-elevated px-2 py-1 text-sm text-strong"
            />
            <button
              onClick={() => onElegir(fechaNueva)}
              className="rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-accent-fg"
            >
              Abrir la lista
            </button>
            <button
              onClick={onCancelarSelector}
              className="rounded-lg border border-line px-3 py-1.5 text-sm text-soft"
            >
              Cancelar
            </button>
          </div>
          <p className="mt-1 text-[0.7rem]">
            Abrirla no guarda nada todavía: la sesión queda registrada con la primera marca
            que usted ponga.
          </p>
        </div>
      )}

      {sesiones.length === 0 && !seleccionSinSesion ? (
        <p className="mt-2 text-xs text-muted">
          Todavía no se ha pasado lista ni una vez en este centro. Cada semana es una
          sesión nueva:{' '}
          {puedeRegistrar
            ? 'empiece por «+ Nueva sesión» y elija el día de la clase.'
            : 'la registra quien lidera el centro.'}
        </p>
      ) : (
        // Barra propia con desplazamiento horizontal: un semestre son ~18 pastillas y la
        // pagina entera NO se puede desbordar de lado en un telefono.
        <div className="mt-2 flex gap-1.5 overflow-x-auto pb-1">
          {seleccionSinSesion && (
            <button
              onClick={() => onElegir(seleccionSinSesion)}
              className="shrink-0 rounded-full border border-dashed border-accent bg-accent-soft px-3 py-1 text-xs font-semibold text-accent-soft-fg"
            >
              {fechaLegible(seleccionSinSesion)} · sin marcar
            </button>
          )}
          {sesiones.map((s) => (
            <button
              key={s.fecha}
              onClick={() => onElegir(s.fecha)}
              className={[
                'shrink-0 rounded-full border px-3 py-1 text-xs',
                s.fecha === fecha
                  ? 'border-accent bg-accent-soft font-semibold text-accent-soft-fg'
                  : 'border-line text-soft',
              ].join(' ')}
            >
              {fechaLegible(s.fecha)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * El cuaderno completo: una fila por inscrito, una columna por sesion REGISTRADA.
 *
 * REGLA DE ORO del modulo, y por eso las columnas salen de `sesiones` y de ningun otro
 * lado: un dia sin sesion no existe. Nada de pintar todos los miercoles del semestre y
 * dejarlos vacios — eso convertiria el calendario en denominador y hundiria la
 * estadistica de todo el mundo con dias en los que no hubo clase.
 */
function HistorialColumnas({
  miembros,
  sesiones,
  fecha,
  enConflicto,
  onAbrirSesion,
  onAbrirCasilla,
}: {
  miembros: Student[];
  sesiones: SesionPrograma[];
  fecha: string | null;
  enConflicto: Set<string>;
  onAbrirSesion: (fecha: string) => void;
  onAbrirCasilla: (fecha: string, estudiante: Student) => void;
}) {
  const ordenadas = useMemo(
    () => [...sesiones].sort((a, b) => a.fecha.localeCompare(b.fecha)),
    [sesiones],
  );
  const comoEventos = useMemo(
    () => ordenadas.map((s) => comoSesionDeEvento(s)).filter((s): s is EventSession => !!s),
    [ordenadas],
  );

  if (ordenadas.length === 0) {
    return (
      <p className="rounded-xl border border-line bg-card p-3 text-sm text-muted">
        Todavía no hay ninguna columna que enseñar: nadie ha pasado lista en este centro.
        Vaya a «Registro» y abra la primera sesión con «+ Nueva sesión».
      </p>
    );
  }

  if (miembros.length === 0) {
    return (
      <p className="rounded-xl border border-line bg-card p-3 text-sm text-muted">
        Este centro todavía no tiene inscritos, así que no hay filas que enseñar.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {/* El contenedor lleva SU PROPIO overflow-x-auto: a 375 px la página no se desborda. */}
      <div className="overflow-x-auto rounded-xl border border-line bg-card">
        <table className="w-max min-w-full border-collapse">
          <thead>
            <tr>
              {/* El ancho del <th> y el del <td> de abajo tienen que coincidir EXACTO:
                  son dos elementos sticky distintos y, si difieren, la columna del nombre
                  se parte al desplazar la tabla de lado. */}
              <th className="sticky left-0 z-10 min-w-[10.5rem] max-w-[10.5rem] border-b border-r border-line bg-card p-2 text-left text-xs font-semibold text-muted">
                Estudiante ({miembros.length})
              </th>
              {ordenadas.map((s) => (
                <th key={s.fecha} className="border-b border-line p-0">
                  <button
                    onClick={() => onAbrirSesion(s.fecha)}
                    title={`Abrir la sesión del ${fechaLegible(s.fecha)}`}
                    className={[
                      'h-full w-14 px-1 py-1 text-center text-[0.65rem] font-normal',
                      s.fecha === fecha ? 'bg-accent-soft text-accent-soft-fg' : 'text-muted',
                    ].join(' ')}
                  >
                    <span className="block font-semibold text-strong">{fechaCorta(s.fecha)}</span>
                    {diaSemana(s.fecha)}
                  </button>
                </th>
              ))}
              {/* Misma regla de anchos que la columna del nombre. */}
              <th className="sticky right-0 z-10 min-w-[5.5rem] max-w-[5.5rem] border-b border-l border-line bg-card p-2 text-center text-xs font-semibold text-muted">
                Asistió
              </th>
            </tr>
          </thead>
          <tbody>
            {miembros.map((e) => {
              const r = estadisticaEvento(e.studentId, comoEventos);
              return (
                <tr key={e.studentId}>
                  <td className="sticky left-0 z-10 min-w-[10.5rem] max-w-[10.5rem] border-b border-r border-line bg-card p-1.5">
                    <span className="flex items-center gap-2 text-left">
                      <Avatar estudiante={e} tamano={32} />
                      <span className="min-w-0 truncate text-xs leading-tight text-strong">
                        <span className="block truncate font-semibold">{e.apellidos}</span>
                        <span className="block truncate text-muted">{e.nombres}</span>
                        {enConflicto.has(e.studentId) && (
                          <span className="block truncate text-[0.6rem] text-warning-soft-fg">
                            En dos centros
                          </span>
                        )}
                      </span>
                    </span>
                  </td>
                  {ordenadas.map((s) => {
                    const m = s.estudiantes?.[e.studentId];
                    const def = m ? findMark(m.estado) : undefined;
                    return (
                      <td key={s.fecha} className="border-b border-line p-0">
                        <button
                          onClick={() => onAbrirCasilla(s.fecha, e)}
                          title={
                            def
                              ? `${def.label} · registró ${m!.registradoPor}`
                              : 'Sin registrar (no es una ausencia)'
                          }
                          className={[
                            'h-9 w-14 text-xs font-bold',
                            def
                              ? CLASE_MARCA[def.code]
                              : 'bg-elevated font-normal text-muted opacity-70',
                          ].join(' ')}
                        >
                          {def ? SIGLA[def.code] : '·'}
                        </button>
                      </td>
                    );
                  })}
                  {/* Asistencias SOBRE SESIONES REGISTRADAS. El denominador nunca es el
                      calendario: si una semana no se paso lista, esa semana no existe. */}
                  <td className="sticky right-0 z-10 min-w-[5.5rem] max-w-[5.5rem] border-b border-l border-line bg-card p-1 text-center text-xs text-soft">
                    <b className="text-strong">{r.porMarca.asistencia}</b> de{' '}
                    {ordenadas.length}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted">
        Una columna por sesión registrada, de la más antigua a la más reciente. Un punto
        «·» es una casilla <b>sin registrar</b>, que no es lo mismo que una falta. Toque
        una casilla para marcarla o corregirla, o el encabezado para abrir ese día
        completo.
      </p>
    </div>
  );
}

/**
 * El señalamiento del estudiante que quedo en dos centros.
 *
 * Va con `Ayuda` y no con el `title` del navegador: el `title` tarda un segundo largo en
 * salir y no admite dos lineas de texto, y aqui lo que hace falta es justamente una
 * explicacion de dos lineas. Sin ella el lider ve una fila marcada, no entiende por que,
 * y termina preguntando — que es exactamente lo que esta pantalla tiene que evitar.
 */
function MarcaConflicto() {
  return (
    <Ayuda texto={AVISO_CONFLICTO}>
      <span
        tabIndex={0}
        className="mt-0.5 inline-block cursor-help rounded-full border border-warning-soft bg-card px-2 py-0.5 text-[0.65rem] font-semibold text-warning-soft-fg"
      >
        En dos centros de interés
      </span>
    </Ayuda>
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
          {SIGLA[m.code]}
        </button>
      ))}
    </div>
  );
}

/**
 * Hoja de marcas — mismo patron que `MenuMarcas` en Planilla.tsx y que `HojaMarcar` en
 * PlanillaEvento.tsx: foto GRANDE (110 px) y un boton por marca. Se replica el patron,
 * no el codigo, porque ninguno de los dos esta exportado.
 */
function HojaMarcar({
  estudiante,
  enConflicto,
  marcaActual,
  onElegir,
  onCerrar,
}: {
  estudiante: Student;
  enConflicto: boolean;
  marcaActual: { estado: string; registradoPor: string } | null;
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
          <p className="text-xs text-muted">{estudiante.gradoActual}</p>
          {marcaActual && (
            <p className="text-xs text-muted">
              Marca actual: {findMark(marcaActual.estado)?.label ?? marcaActual.estado} ·
              registró {marcaActual.registradoPor}
            </p>
          )}
        </div>

        {/* Aqui el aviso va COMPLETO y no como globo flotante: en una hoja modal hay
            sitio, y quien llega marcando uno por uno merece leerlo entero una vez. */}
        {enConflicto && (
          <p className="mt-3 rounded-lg border border-warning-soft bg-warning-soft p-2 text-xs text-warning-soft-fg">
            {AVISO_CONFLICTO}
          </p>
        )}

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
                {SIGLA[m.code]}
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
 * Llenado por defecto del dia — el atajo que de verdad ahorra tiempo, igual que
 * `MenuColumna` en Planilla.tsx. Solo toca las casillas VACIAS, y por eso el menu dice
 * cuantas son: si el lider ya marco veinte, tiene que ver que esto no las va a tocar.
 */
function MenuLlenarLista({
  fecha,
  total,
  vacias,
  onElegir,
  onCerrar,
}: {
  fecha: string;
  total: number;
  vacias: number;
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
        <p className="text-sm font-semibold text-strong">
          Llenar la lista del {fechaLegible(fecha)}
        </p>
        <p className="mb-3 text-xs text-muted">
          {vacias === 0 ? (
            <>Ya están marcados los {total}. No queda ninguna casilla vacía que llenar.</>
          ) : (
            <>
              Se llenarán las <b>{vacias}</b> casillas vacías de {total}. Lo ya marcado{' '}
              <b>no se toca</b>.
            </>
          )}
        </p>

        {vacias > 0 && (
          <div className="grid gap-1.5">
            {MARKS.map((m) => (
              <button
                key={m.code}
                onClick={() => onElegir(m.code)}
                className="flex items-center gap-2 rounded-lg border border-line p-2 text-left hover:bg-hover"
              >
                <span
                  className={`grid h-7 w-9 place-items-center rounded text-xs font-bold ${CLASE_MARCA[m.code]}`}
                >
                  {SIGLA[m.code]}
                </span>
                <span className="grow text-sm text-strong">Todos a «{m.label}»</span>
              </button>
            ))}
          </div>
        )}

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
 * Estadistica por inscrito. El denominador (`sesionesCount`) va SIEMPRE junto al numero:
 * "3 faltas" no dice nada sin saber sobre cuantas sesiones se registraron.
 */
function EstadisticasCentro({
  miembros,
  sesiones,
}: {
  miembros: Student[];
  sesiones: SesionPrograma[];
}) {
  const comoEventos = useMemo(
    () => sesiones.map((s) => comoSesionDeEvento(s)).filter((s): s is EventSession => !!s),
    [sesiones],
  );

  if (sesiones.length === 0) {
    return (
      <p className="rounded-xl border border-line bg-card p-3 text-sm text-muted">
        Todavía no se ha pasado lista ni una vez en este centro de interés. Mientras no
        exista una sesión registrada, ese día no cuenta para la estadística: el calendario
        no llena la planilla solo.
      </p>
    );
  }

  return (
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
            const r = estadisticaEvento(e.studentId, comoEventos);
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
        Sobre {sesiones.length}{' '}
        {sesiones.length === 1 ? 'sesión registrada' : 'sesiones registradas'} de este
        centro. El calendario no cuenta: solo los días en que alguien tomó asistencia.
      </p>
    </div>
  );
}

/**
 * Inscribir y retirar — SOLO la coordinacion del programa.
 *
 * Se escribe con `arrayUnion`/`arrayRemove` (dentro de `inscribirEnGrupoPrograma` y
 * `retirarDeGrupoPrograma`), nunca reemplazando la lista: `miembros` es la inscripcion
 * del semestre entero y mandarla completa desde una pantalla cargada hace dos minutos
 * borraria a quien otra persona inscribio mientras tanto.
 */
function Inscripcion({
  programa,
  grupo,
  miembros,
  enConflicto,
  onAviso,
  onError,
}: {
  programa: Programa;
  grupo: GrupoPrograma;
  miembros: Student[];
  enConflicto: Set<string>;
  onAviso: (m: string) => void;
  onError: (m: string) => void;
}) {
  const [busqueda, setBusqueda] = useState('');
  const [candidatos, setCandidatos] = useState<Student[]>([]);
  const [buscando, setBuscando] = useState(false);

  useEffect(() => {
    if (busqueda.trim().length < 2) {
      setCandidatos([]);
      return;
    }
    setBuscando(true);
    const t = setTimeout(() => {
      void buscarEstudiantes(programa.sede, busqueda)
        .then(setCandidatos)
        .finally(() => setBuscando(false));
    }, 250);
    return () => clearTimeout(t);
  }, [busqueda, programa.sede]);

  async function inscribir(e: Student) {
    try {
      await inscribirEnGrupoPrograma(programa.programaId, grupo.grupoId, [e.studentId]);
      onAviso(
        `${nombreCompleto(e)} quedó inscrito en «${grupo.nombre}». Vuelva a entrar al centro para verlo en la lista.`,
      );
      setBusqueda('');
      setCandidatos([]);
    } catch (err) {
      onError(`No fue posible inscribir: ${(err as Error).message}`);
    }
  }

  async function retirar(e: Student) {
    try {
      await retirarDeGrupoPrograma(programa.programaId, grupo.grupoId, [e.studentId]);
      onAviso(
        `${nombreCompleto(e)} se retiró de «${grupo.nombre}». Vuelva a entrar al centro para ver la lista actualizada.`,
      );
    } catch (err) {
      onError(`No fue posible retirar: ${(err as Error).message}`);
    }
  }

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-line bg-card p-3">
        <p className="text-sm font-semibold text-strong">Inscribir un estudiante</p>
        <p className="text-xs text-muted">
          {programa.exclusivo
            ? 'En este programa cada estudiante va en un solo centro. Si ya está en otro, quedará señalado en las dos listas hasta que usted decida en cuál se queda.'
            : 'En este programa un estudiante puede estar en más de un centro.'}
        </p>
        <input
          value={busqueda}
          onChange={(ev) => setBusqueda(ev.target.value)}
          placeholder="Buscar por apellido o nombre…"
          className="mt-2 block w-full rounded-lg border border-line bg-elevated px-2 py-2 text-base text-strong"
        />
        {busqueda.trim().length >= 2 && !buscando && candidatos.length === 0 && (
          <p className="mt-2 text-xs text-muted">
            Ningún estudiante de la sede coincide con «{busqueda.trim()}». Revise la
            escritura del apellido.
          </p>
        )}
        {candidatos.length > 0 && (
          <ul className="mt-2 space-y-1">
            {candidatos.map((e) => {
              const ya = grupo.miembros.includes(e.studentId);
              return (
                <VerificacionFoto
                  key={e.studentId}
                  estudiante={e}
                  acciones={
                    ya ? (
                      <span className="text-xs text-muted">Ya está inscrito</span>
                    ) : (
                      <button
                        onClick={() => void inscribir(e)}
                        className="rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-accent-fg"
                      >
                        Inscribir
                      </button>
                    )
                  }
                />
              );
            })}
          </ul>
        )}
      </div>

      <div className="rounded-xl border border-line bg-card p-3">
        <p className="text-sm font-semibold text-strong">
          Inscritos ({miembros.length})
        </p>
        {miembros.length === 0 ? (
          <p className="mt-1 text-xs text-muted">
            Todavía no hay nadie inscrito en este centro.
          </p>
        ) : (
          <ul className="mt-2 space-y-1">
            {miembros.map((e) => (
              <VerificacionFoto
                key={e.studentId}
                estudiante={e}
                extra={enConflicto.has(e.studentId) ? <MarcaConflicto /> : undefined}
                acciones={
                  <button
                    onClick={() => void retirar(e)}
                    className="rounded-lg border border-line px-3 py-1.5 text-sm text-strong"
                  >
                    Retirar
                  </button>
                }
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
