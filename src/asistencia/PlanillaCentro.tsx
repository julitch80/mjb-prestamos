import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
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
  leerPendientesDeGrupo,
  leerSesionesPrograma,
  llenarColumnaPrograma,
  marcarEnPrograma,
  proponerPendiente,
  retirarDeGrupoPrograma,
} from './datos';

/**
 * Caratula del centro de interes con las fotos de sus integrantes. `lazy` porque solo se
 * usa una vez al semestre y no tiene por que viajar en el paquete de la planilla.
 */
const MosaicoGrupo = lazy(() => import('./MosaicoGrupo'));
import { estadisticaEvento, resumenSesionEvento } from './domain/eventos';
import { detectarDuplicados } from './domain/programas';
import { conDenominador } from './domain/stats';
import { toDateKey } from './domain/ids';
import { MARKS, findMark, type MarkCode } from './domain/marks';
import { nombreCompleto } from './domain/nombres';
import type {
  CandidatoPendiente,
  EventSession,
  GrupoPrograma,
  PendientePrograma,
  Programa,
  SesionPrograma,
  Student,
} from './domain/types';
import { Check, UserSearch } from 'lucide-react';
import { atras, useNivelAtras } from './useNivelAtras';

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

/** «mié 12 ago» — donde sí cabe el día de la semana (avisos y hojas modales). */
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
 * Planilla de UN centro de interes — UNA sola pantalla, con la forma del cuaderno.
 *
 * Filas = estudiantes inscritos. Columnas = SESIONES REGISTRADAS. Ultima columna = la
 * estadistica de ese estudiante. Se marca tocando la casilla, ahi mismo. Es la misma
 * planilla que el docente ya usa en su clase: quien lidera un centro es el mismo docente
 * que pasa lista, y no tiene por que aprender dos formas de hacer lo mismo.
 *
 * POR QUE YA NO HAY PESTAÑAS. Antes esto estaba partido en cuatro («Registro», «Por
 * columnas», «Estadisticas», «Inscripcion»), copiando la forma de PlanillaEvento.tsx.
 * Ese encargo estaba mal: un evento es UN dia (una salida, una izada) y ahi la vista de
 * un solo dia tiene sentido; un centro de interes dura un SEMESTRE, y su forma correcta
 * es la del cuaderno. Registro y «Por columnas» eran la misma cosa dicha dos veces, la
 * estadistica es una columna mas, y la inscripcion es un panel que se abre — no un sitio
 * al que haya que irse.
 *
 * POR QUE NO SE REUTILIZA `Planilla.tsx` TAL CUAL, aunque es presentacional. Se intento;
 * la adaptacion deforma la semantica en cosas que se LEEN en pantalla, no en detalles
 * internos:
 *   - `Session` exige `bloque` (1..6), `subjectId`, `slotId`, `grado`, `jornada` y
 *     `closed`. Planilla los pinta: el titulo sale «{grado} · {asignatura}», cada columna
 *     lleva «b{bloque}» y un candado de «Cerrar sesión de clase», y la hoja de marcar
 *     dice «{fecha}, bloque {N}». Un centro de interes no tiene bloque, ni asignatura, ni
 *     grado (mezcla grados a proposito) ni cierre de sesion: todo eso saldria inventado.
 *   - `computeStats` pregunta por MATRICULA vigente en un grado con `subjectId`; aqui la
 *     pertenencia la define `grupo.miembros`, y fabricar matriculas falsas para que el
 *     motor las acepte es mentirle al calculo. El motor correcto ya existe y es
 *     `estadisticaEvento` (domain/eventos.ts), que cuenta sobre la lista de integrantes.
 *   - El resumen de Planilla habla de «A Master2000», que no aplica a un centro de
 *     interes, y no hay sitio donde decir a que centro pertenece cada estudiante.
 * Lo que SI se reutiliza es lo que se puede reutilizar sin mentir: `CLASE_MARCA`, `SIGLA`
 * y `MARKS`, importados de Planilla.tsx. Asi el dia que se ajuste un color de marca,
 * cambia en las dos planillas a la vez, que es de lo que avisa el comentario de alla.
 *
 * REGLA DE ORO: las columnas son las sesiones REGISTRADAS, jamas el calendario. Un
 * miercoles del semestre en el que nadie paso lista no existe y no se pinta.
 *
 * AUTORIDAD. Dos papeles distintos que la pantalla no mezcla:
 *   - el LIDER del centro registra la asistencia y ve la estadistica;
 *   - la COORDINACION del programa, ademas, inscribe y retira.
 * El boton de inscripcion NO se pinta para quien no coordina. La regla tambien lo
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
   * Sirven para dos cosas: saber quién quedó inscrito en dos centros a la vez, y poder
   * decir —al pasar el ratón sobre un estudiante— a qué centro(s) pertenece. Si no
   * llegan, esta pantalla los pide con `leerMisGruposDePrograma` —NUNCA armando la
   * consulta a mano: la rama de docente necesita el `where('docentes','array-contains')`
   * o Firestore rechaza la consulta entera con permission-denied—.
   */
  gruposDelPrograma?: GrupoPrograma[];
  /**
   * Ausente para el lider de UN solo centro (20 de los 21): ahi esta pantalla ES la
   * entrada directa a "Centros de interes", sin ninguna lista detras a la que volver.
   * `setMisCentros(null)` en Programas.tsx nunca revivia la busqueda —quedaba atascado
   * en "Buscando su centro de interes..." para siempre—, y el texto "Volver a los
   * centros de interes" tampoco tenia sentido en singular. Julian, 2026-08-27: "resuelve
   * eso para que quede listo", aunque no era parte del encargo de turno.
   */
  onVolver?: () => void;
}) {
  /**
   * La columna sobre la que actuan los atajos de sesion (escáner de QR y «Llenar la
   * lista»). `null` es un estado REAL: todavia no hay ninguna sesion registrada ni
   * elegida, y entonces la pantalla manda a «+ Nueva sesión» en vez de adivinar.
   */
  const [fechaActiva, setFechaActiva] = useState<string | null>(null);
  /**
   * Fecha elegida en «+ Nueva sesión» que TODAVIA no tiene documento. Se pinta como una
   * columna mas, rayada, para poder marcar en ella: el documento nace con la primera
   * marca (ver `asegurarSesion`), no al elegir la fecha.
   */
  const [fechaPendiente, setFechaPendiente] = useState<string | null>(null);
  /** Borrador del selector de fecha; `null` mientras el selector esta cerrado. */
  const [borradorFecha, setBorradorFecha] = useState<string | null>(null);
  const [miembros, setMiembros] = useState<Student[]>([]);
  const [sesiones, setSesiones] = useState<SesionPrograma[]>([]);
  const [hermanos, setHermanos] = useState<GrupoPrograma[]>(gruposDelPrograma ?? []);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [escaneando, setEscaneando] = useState(false);
  const [candidatoQr, setCandidatoQr] = useState<Student | null>(null);
  const [marcando, setMarcando] = useState<{ estudiante: Student; fecha: string } | null>(null);
  const [menuColumna, setMenuColumna] = useState<string | null>(null);
  const [estadisticaDe, setEstadisticaDe] = useState<Student | null>(null);
  const [inscribiendo, setInscribiendo] = useState(false);
  /** Mosaico de fotos del centro, para la caratula de su carpeta. */
  const [mosaico, setMosaico] = useState(false);
  useNivelAtras(mosaico, () => setMosaico(false));
  /**
   * Los estudiantes de la lista del lider que el cruce con la matricula NO pudo ubicar.
   *
   * Hasta ahora esperaban en la bandeja de coordinacion y el lider NI SIQUIERA SABIA QUE
   * EXISTIAN: su lista en papel tenia veintiocho nombres y la planilla mostraba veinte,
   * sin decir nada de los otros ocho. Aqui se los enseña a quien tiene la lista en papel
   * y conoce las caras, que es la unica persona capaz de decir cual es cual.
   */
  const [pendientes, setPendientes] = useState<PendientePrograma[]>([]);
  const [verPendientes, setVerPendientes] = useState(false);

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
        // La columna activa arranca en la sesion MAS RECIENTE que exista, no en la de
        // hoy: hoy casi nunca hay clase del centro. Para empezar la de hoy esta el boton
        // «+ Nueva sesión». Si el usuario ya eligio una, se respeta.
        const reciente = [...sesionesCentro].sort((a, b) => b.fecha.localeCompare(a.fecha))[0];
        setFechaActiva((prev) => prev ?? reciente?.fecha ?? null);
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

  // Los demas centros, para señalar a quien quedo en dos y para decir a cual pertenece
  // cada estudiante. Si falla no se enseña ningun error: no poder señalar un conflicto no
  // impide pasar lista, que es a lo que el docente vino.
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

  // Los pendientes de ESTE centro. Se pide con `leerPendientesDeGrupo`, que ya lleva
  // dentro el `where('grupoId','==',...)` obligatorio: la regla mira el documento y
  // Firestore rechaza la consulta ENTERA si la consulta no filtra por ese mismo campo.
  //
  // Si falla no se enseña ningun error y el aviso simplemente no aparece. Hoy en
  // produccion la regla de lectura para el lider TODAVIA no esta desplegada: hasta que lo
  // este, esta llamada devuelve permission-denied, y un centro de interes tiene que poder
  // pasar lista igual — a eso vino el docente.
  useEffect(() => {
    let vivo = true;
    void leerPendientesDeGrupo(programa.programaId, grupo.grupoId)
      .then((lista) => {
        if (vivo) setPendientes(lista);
      })
      .catch(() => undefined);
    return () => {
      vivo = false;
    };
  }, [programa.programaId, grupo.grupoId]);

  /**
   * Lo que se le enseña al lider: los casos que le dejan un hueco en la lista.
   *
   * Se dejan fuera los `duplicado`, y no por descuido: ese caso habla de alguien que YA
   * esta inscrito y que ya sale señalado en la planilla y en el aviso de conflicto.
   * Meterlo aqui seria decir dos veces la misma cosa con dos numeros distintos.
   */
  const sinUbicar = useMemo(
    () => pendientes.filter((p) => p.estado === 'pendiente' && p.tipo !== 'duplicado'),
    [pendientes],
  );

  /** Guarda la propuesta del lider. NO inscribe: eso lo hace la coordinacion. */
  const proponer = useCallback(
    async (pendienteId: string, propuesta: string | null) => {
      await proponerPendiente(programa.programaId, pendienteId, propuesta);
      setPendientes((lista) =>
        lista.map((p) =>
          p.pendienteId === pendienteId ? { ...p, propuestaLider: propuesta } : p,
        ),
      );
    },
    [programa.programaId],
  );

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

  /**
   * A que centro(s) pertenece cada estudiante, para el texto flotante de la fila.
   *
   * Solo puede nombrar los centros que el usuario alcanza a LEER: un lider ve los suyos.
   * Por eso el conflicto se dice aparte y con `enConflicto` (que si esta escrito en el
   * grupo), y no se deduce de este mapa.
   */
  const centrosPorEstudiante = useMemo(() => {
    const mapa = new Map<string, string[]>();
    for (const g of hermanos) {
      if (!g.activo) continue;
      for (const id of g.miembros) {
        const previos = mapa.get(id) ?? [];
        if (!previos.includes(g.nombre)) previos.push(g.nombre);
        mapa.set(id, previos);
      }
    }
    return mapa;
  }, [hermanos]);

  const recargarSesiones = useCallback(async () => {
    setSesiones(await leerSesionesPrograma(programa.programaId, grupo.grupoId));
  }, [programa.programaId, grupo.grupoId]);

  /**
   * Las COLUMNAS de la planilla: las sesiones registradas de la mas antigua a la mas
   * reciente, mas —si la hay— la fecha recien elegida que aun no tiene documento.
   *
   * De aqui y de ningun otro lado salen las columnas. Nada de pintar todos los miercoles
   * del semestre: eso convertiria el calendario en denominador y hundiria la estadistica
   * de todo el mundo con dias en los que no hubo clase.
   */
  const columnas = useMemo(() => {
    const fechas = sesiones.map((s) => s.fecha);
    if (fechaPendiente && !fechas.includes(fechaPendiente)) fechas.push(fechaPendiente);
    fechas.sort((a, b) => a.localeCompare(b));
    return fechas.map((fecha) => ({
      fecha,
      sesion: sesiones.find((s) => s.fecha === fecha) ?? null,
    }));
  }, [sesiones, fechaPendiente]);

  const comoEventos = useMemo(
    () => sesiones.map((s) => comoSesionDeEvento(s)).filter((s): s is EventSession => !!s),
    [sesiones],
  );

  const sesionActiva = useMemo(
    () => (fechaActiva ? (sesiones.find((s) => s.fecha === fechaActiva) ?? null) : null),
    [sesiones, fechaActiva],
  );
  const avance = resumenSesionEvento(comoSesionDeEvento(sesionActiva), grupo.miembros);

  /**
   * Abre la sesion del dia SOLO cuando de verdad hay que escribir en ella, nunca al
   * elegir la fecha: si se abriera al mirar, cada vistazo dejaria una sesion vacia y el
   * denominador de la estadistica —sesiones REGISTRADAS, jamas el calendario— quedaria
   * inflado con dias en los que nadie paso lista.
   *
   * ESTO SIGUE VALIENDO CON EL BOTON «+ Nueva sesión». Ese boton NO escribe el documento:
   * añade una columna rayada y deja la planilla lista para marcar. El documento nace con
   * la primera marca, aqui. Un docente que abre el selector, ve que se equivoco de semana
   * y se sale no deja ninguna sesion fantasma en la estadistica.
   */
  async function asegurarSesion(fechaSesion: string): Promise<void> {
    if (sesiones.some((s) => s.fecha === fechaSesion)) return;
    const nueva = await abrirSesionPrograma(programa.programaId, grupo.grupoId, fechaSesion);
    setSesiones((prev) => [...prev, nueva]);
  }

  async function marcar(fechaSesion: string, studentId: string, estado: MarkCode) {
    setError(null);
    try {
      await asegurarSesion(fechaSesion);
      await marcarEnPrograma(programa.programaId, grupo.grupoId, fechaSesion, studentId, estado);
      await recargarSesiones();
      // Ya existe documento: la columna deja de ser "pendiente" y pasa a ser una sesion
      // registrada como cualquier otra.
      setFechaPendiente((prev) => (prev === fechaSesion ? null : prev));
      setFechaActiva(fechaSesion);
    } catch (e) {
      setError(`No fue posible guardar la marca: ${(e as Error).message}`);
    }
  }

  async function llenarColumna(fechaSesion: string, estado: MarkCode) {
    setError(null);
    try {
      await asegurarSesion(fechaSesion);
      const sesion = sesiones.find((s) => s.fecha === fechaSesion);
      const llenadas = await llenarColumnaPrograma(
        programa.programaId,
        grupo.grupoId,
        fechaSesion,
        grupo.miembros,
        estado,
        sesion?.estudiantes ?? {},
      );
      await recargarSesiones();
      setFechaPendiente((prev) => (prev === fechaSesion ? null : prev));
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
            : 'No se reconoció el código. Puede marcarlo tocando su casilla en la planilla.',
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
    if (!candidatoQr || !fechaActiva) return;
    const nombre = nombreCompleto(candidatoQr);
    await marcar(fechaActiva, candidatoQr.studentId, estado);
    setAviso(`${nombre} — marcado en la sesión del ${fechaLegible(fechaActiva)}.`);
    setCandidatoQr(null);
  }

  /** «+ Nueva sesión»: abre el selector con hoy, o con la fecha ya elegida sin marcar. */
  function abrirSelector() {
    setBorradorFecha(fechaPendiente ?? toDateKey(new Date()));
  }

  function abrirEscaner() {
    if (!fechaActiva) {
      setAviso(
        'Antes de escanear hay que tener una sesión: use «+ Nueva sesión» y elija el día de la clase.',
      );
      return;
    }
    setEscaneando(true);
  }

  if (cargando) {
    return <p className="p-3 text-sm text-muted">Cargando el centro de interés…</p>;
  }

  const fueraDeSemestre =
    fechaActiva !== null && (fechaActiva < programa.desde || fechaActiva > programa.hasta);

  return (
    <div className="space-y-3">
      <div>
        {onVolver && (
          <button onClick={onVolver} className="text-xs text-muted underline">
            ← Volver a los centros de interés
          </button>
        )}
        <h2 className="text-base font-semibold text-strong">{grupo.nombre}</h2>
        <p className="text-xs text-muted">
          {programa.nombre} · {grupo.miembros.length}{' '}
          {grupo.miembros.length === 1 ? 'inscrito' : 'inscritos'} · lidera {grupo.lider}
        </p>
      </div>

      {mosaico && (
        <Suspense fallback={null}>
          <MosaicoGrupo
            grado={grupo.nombre}
            subtitulo={programa.nombre}
            estudiantes={miembros}
            onCerrar={atras}
          />
        </Suspense>
      )}

      {/* Barra de acciones. Todo lo que antes vivia en pestañas se hace desde aqui, sin
          cambiar de pantalla. */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="shrink-0 text-xs text-muted">
          {sesiones.length === 0
            ? 'Sin sesiones registradas'
            : `${sesiones.length} ${sesiones.length === 1 ? 'sesión registrada' : 'sesiones registradas'}`}
        </span>
        {/* Convenciones siempre visibles: el docente no debe tener que recordar las
            siglas ni abrir nada para saber qué significa una marca. */}
        <div className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto">
          {MARKS.map((m) => (
            <span key={m.code} className="flex shrink-0 items-center gap-1 text-xs text-muted">
              <span className={`rounded px-1 font-bold ${CLASE_MARCA[m.code]}`}>
                {SIGLA[m.code]}
              </span>
              {m.label}
            </span>
          ))}
        </div>
        <span className="grow" />
        {/* Imprimir la caratula no es registrar: la ve tambien quien solo puede leer. */}
        <button
          onClick={() => setMosaico(true)}
          title="Mosaico de fotos del centro para la carátula de su carpeta"
          className="min-h-[36px] shrink-0 rounded-lg border border-line px-3 py-1.5 text-sm font-medium text-strong"
        >
          Mosaico de fotos
        </button>
        {esCoordinador && (
          <Ayuda texto="Inscribir o retirar estudiantes de este centro. Solo la coordinación del programa puede hacerlo.">
            <button
              onClick={() => setInscribiendo((v) => !v)}
              className="min-h-[36px] shrink-0 rounded-lg border border-line px-3 py-1.5 text-sm font-medium text-strong"
            >
              {inscribiendo ? 'Cerrar inscripción' : 'Inscribir o retirar'}
            </button>
          </Ayuda>
        )}
        {puedeRegistrar && (
          <button
            onClick={abrirEscaner}
            className="min-h-[36px] shrink-0 rounded-lg border border-line px-3 py-1.5 text-sm font-medium text-strong"
          >
            Escanear código
          </button>
        )}
        {puedeRegistrar && (
          <button
            onClick={abrirSelector}
            title="Abrir la columna de un día nuevo para empezar a marcar"
            className="min-h-[36px] shrink-0 rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-accent-fg"
          >
            + Nueva sesión
          </button>
        )}
      </div>

      {borradorFecha !== null && (
        <div className="rounded-xl border border-accent bg-accent-soft p-3 text-accent-soft-fg">
          <p className="text-xs font-semibold">¿De qué día es la clase que va a registrar?</p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <input
              type="date"
              value={borradorFecha}
              onChange={(ev) => setBorradorFecha(ev.target.value)}
              className="rounded-lg border border-line bg-elevated px-2 py-1 text-sm text-strong"
            />
            <button
              onClick={() => {
                setFechaPendiente(borradorFecha);
                setFechaActiva(borradorFecha);
                setBorradorFecha(null);
                setAviso(null);
              }}
              className="rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-accent-fg"
            >
              Abrir la columna
            </button>
            <button
              onClick={() => setBorradorFecha(null)}
              className="rounded-lg border border-line px-3 py-1.5 text-sm text-soft"
            >
              Cancelar
            </button>
          </div>
          <p className="mt-1 text-[0.7rem]">
            Abrirla no guarda nada todavía: la sesión queda registrada con la primera marca
            que usted ponga.
          </p>
          {(borradorFecha < programa.desde || borradorFecha > programa.hasta) && (
            <p className="mt-1 text-[0.7rem] font-semibold">
              Esa fecha queda fuera del semestre del programa ({programa.desde} a{' '}
              {programa.hasta}). Se puede registrar igual, pero revise que sea la correcta.
            </p>
          )}
        </div>
      )}

      {sinUbicar.length > 0 && (
        <div className="rounded-xl border border-warning-soft bg-warning-soft text-warning-soft-fg">
          <button
            onClick={() => setVerPendientes((v) => !v)}
            aria-expanded={verPendientes}
            className="flex w-full items-center gap-2 p-3 text-left"
          >
            <UserSearch size={18} aria-hidden className="shrink-0" />
            <span className="grow text-sm font-semibold">
              {sinUbicar.length === 1
                ? '1 estudiante de su lista no se pudo ubicar'
                : `${sinUbicar.length} estudiantes de su lista no se pudieron ubicar`}
            </span>
            <span className="shrink-0 text-xs underline">
              {verPendientes ? 'Ocultar' : 'Ver quiénes son'}
            </span>
          </button>

          {verPendientes && (
            <div className="border-t border-warning-soft p-3">
              {esCoordinador ? (
                // A la coordinacion no se la entretiene aqui: aqui solo ve los de ESTE
                // centro y no puede comprobar `exclusivo`, que es unicidad entre los
                // veintiun centros a la vez. Donde resuelve de verdad es en la bandeja.
                <p className="text-xs">
                  Usted coordina este programa: estos casos se resuelven —y quedan
                  inscritos— en la <b>bandeja de pendientes del programa</b>, que los
                  muestra todos juntos. Desde aquí solo se pueden señalar, porque esta
                  pantalla ve un solo centro y no puede comprobar si el estudiante ya quedó
                  en otro.
                </p>
              ) : (
                <p className="text-xs">
                  Estos nombres venían en la lista de su centro, pero no se pudo saber con
                  seguridad a qué estudiante de la matrícula corresponden.{' '}
                  <b>Señale cuál es cuál: usted los conoce de vista.</b>
                </p>
              )}
              <ul className="mt-2 space-y-2">
                {sinUbicar.map((p) => (
                  <li key={p.pendienteId}>
                    <TarjetaSinUbicar pendiente={p} onProponer={proponer} />
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

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

      {/* ESTADO VACIO dicho con todas las letras. La planilla de abajo se sigue pintando
          con los inscritos: que no haya sesiones no significa que el centro este vacio, y
          eso era justo lo que la pantalla anterior hacia creer. */}
      {sesiones.length === 0 && (
        <div className="rounded-xl border border-line bg-card p-3 text-sm text-soft">
          <p className="font-semibold text-strong">
            Todavía nadie ha pasado lista en este centro de interés.
          </p>
          <p className="mt-1 text-xs text-muted">
            Cada semana de clase es una sesión nueva, y cada sesión es una columna de esta
            planilla. Mientras no exista la columna, ese día no cuenta para la estadística:
            el calendario no llena la planilla solo.{' '}
            {puedeRegistrar
              ? 'Empiece por «+ Nueva sesión» y elija el día de la clase.'
              : 'La registra quien lidera el centro.'}
          </p>
        </div>
      )}

      {fechaActiva && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-line bg-card p-3">
          <span className="text-sm font-semibold text-strong">
            Sesión del {fechaLegible(fechaActiva)}
          </span>
          {!sesionActiva && (
            <span className="text-xs text-muted">
              todavía no existe: se creará sola con la primera marca
            </span>
          )}
          {puedeRegistrar && (
            <button
              onClick={() => setMenuColumna(fechaActiva)}
              title="Llenar de una vez las casillas vacías de este día"
              className="min-h-[36px] rounded-lg border border-line px-3 py-1.5 text-sm font-medium text-strong"
            >
              Llenar la lista
            </button>
          )}
          <span className="grow" />
          <span className="text-sm font-semibold text-strong">
            {avance.marcados} de {avance.total} marcados
          </span>
          {fueraDeSemestre && (
            <p className="w-full text-xs text-warning-soft-fg">
              Esa fecha queda fuera del semestre del programa ({programa.desde} a{' '}
              {programa.hasta}). Se puede registrar igual, pero revise que sea la fecha
              correcta.
            </p>
          )}
          {candidatoQr && (
            <ul className="w-full">
              <VerificacionFoto
                estudiante={candidatoQr}
                tamano={110}
                extra={enConflicto.has(candidatoQr.studentId) ? <MarcaConflicto /> : undefined}
                acciones={<BotonesMarca onElegir={(m) => void marcarDesdeQr(m)} />}
              />
            </ul>
          )}
        </div>
      )}

      {miembros.length === 0 ? (
        <div className="rounded-xl border border-line bg-card p-4 text-center">
          <p className="text-sm text-strong">Este centro todavía no tiene inscritos.</p>
          <p className="mt-1 text-xs text-muted">
            {esCoordinador
              ? 'Use «Inscribir o retirar» para agregar a los estudiantes que le corresponden.'
              : 'La coordinación del programa es quien inscribe a los estudiantes. En cuanto lo haga, aparecerán aquí.'}
          </p>
        </div>
      ) : (
        // El contenedor lleva SU PROPIO overflow-x-auto: a 375 px la página no se
        // desborda de lado. La columna del nombre queda fija a la izquierda.
        <div className="overflow-x-auto rounded-xl border border-line bg-card">
          <table className="w-max min-w-full border-collapse">
            <thead>
              <tr>
                {/* El ancho del <th> y el del <td> de abajo tienen que coincidir EXACTO:
                    son dos elementos sticky distintos y, si difieren, la columna del
                    nombre se parte al desplazar la tabla de lado. */}
                <th className="sticky left-0 z-10 min-w-[10.5rem] max-w-[10.5rem] border-b border-r border-line bg-card p-2 text-left text-xs font-semibold text-muted">
                  Estudiante ({miembros.length})
                </th>
                {columnas.map((c) => (
                  <th key={c.fecha} className="border-b border-line p-0 align-top">
                    <button
                      onClick={() => setFechaActiva(c.fecha)}
                      title={
                        c.sesion
                          ? `Sesión del ${fechaLegible(c.fecha)}`
                          : `${fechaLegible(c.fecha)} · todavía sin registrar`
                      }
                      className={[
                        'w-14 px-1 py-1 text-center text-[0.65rem] font-normal',
                        c.fecha === fechaActiva
                          ? 'bg-accent-soft text-accent-soft-fg'
                          : 'text-muted',
                        c.sesion ? '' : 'border-b-2 border-dashed border-accent',
                      ].join(' ')}
                    >
                      <span className="block font-semibold text-strong">
                        {fechaCorta(c.fecha)}
                      </span>
                      {diaSemana(c.fecha)}
                    </button>
                    {puedeRegistrar && (
                      <button
                        onClick={() => setMenuColumna(c.fecha)}
                        title="Llenar las casillas vacías de esta columna"
                        className="block w-full text-center text-xs text-strong"
                      >
                        ⋯
                      </button>
                    )}
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
                const conflicto = enConflicto.has(e.studentId);
                const centros = centrosPorEstudiante.get(e.studentId) ?? [];
                return (
                  <tr key={e.studentId}>
                    <td className="sticky left-0 z-10 min-w-[10.5rem] max-w-[10.5rem] border-b border-r border-line bg-card p-1.5">
                      {/* Al pasar el ratón (o al llegar con el tabulador) se dice a qué
                          centro pertenece, y si está en dos se dice con todas las letras.
                          Va con `Ayuda` y no con el `title` del navegador porque el
                          `title` tarda un segundo largo y no admite dos líneas. */}
                      <Ayuda
                        texto={
                          conflicto
                            ? AVISO_CONFLICTO
                            : centros.length > 1
                              ? `Inscrito en: ${centros.join(', ')}.`
                              : centros.length === 1
                                ? `Inscrito en «${centros[0]}».`
                                : `Inscrito en «${grupo.nombre}».`
                        }
                      >
                        <span className="flex items-center gap-2 text-left">
                          <Avatar estudiante={e} tamano={32} />
                          <span className="min-w-0 truncate text-xs leading-tight text-strong">
                            <span className="block truncate font-semibold">{e.apellidos}</span>
                            <span className="block truncate text-muted">{e.nombres}</span>
                            <span className="block truncate text-[0.6rem] text-muted">
                              {e.gradoActual}
                            </span>
                            {conflicto && (
                              <span className="block truncate text-[0.6rem] font-semibold text-warning-soft-fg">
                                En dos centros de interés
                              </span>
                            )}
                          </span>
                        </span>
                      </Ayuda>
                    </td>
                    {columnas.map((c) => {
                      const m = c.sesion?.estudiantes?.[e.studentId];
                      const def = m ? findMark(m.estado) : undefined;
                      return (
                        <td key={c.fecha} className="border-b border-line p-0">
                          <button
                            disabled={!puedeRegistrar}
                            onClick={() => {
                              setFechaActiva(c.fecha);
                              setMarcando({ estudiante: e, fecha: c.fecha });
                            }}
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
                    {/* La estadistica del estudiante, en la ULTIMA COLUMNA. Asistencias
                        SOBRE SESIONES REGISTRADAS: el denominador nunca es el calendario.
                        Toque para ver el detalle completo. */}
                    <td className="sticky right-0 z-10 min-w-[5.5rem] max-w-[5.5rem] border-b border-l border-line bg-card p-1">
                      <button
                        onClick={() => setEstadisticaDe(e)}
                        aria-label={`Ver la estadística de ${nombreCompleto(e)}`}
                        className="h-9 w-full rounded-lg text-center text-xs text-soft"
                      >
                        {r.sesionesCount === 0 ? (
                          <span className="text-muted">–</span>
                        ) : (
                          <>
                            <b className="text-strong">{r.porMarca.asistencia}</b> de{' '}
                            {r.sesionesCount}
                          </>
                        )}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-muted">
        Una columna por sesión registrada, de la más antigua a la más reciente. La casilla
        con «·» está <b className="text-soft">sin registrar</b>: no es una falta. Toque una
        casilla para marcar o corregir, el encabezado para trabajar sobre ese día, y la
        última columna para ver la estadística del estudiante.
      </p>

      {inscribiendo && esCoordinador && (
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
          estudiante={marcando.estudiante}
          fecha={marcando.fecha}
          enConflicto={enConflicto.has(marcando.estudiante.studentId)}
          marcaActual={
            sesiones.find((s) => s.fecha === marcando.fecha)?.estudiantes?.[
              marcando.estudiante.studentId
            ] ?? null
          }
          onElegir={(estado) => {
            void marcar(marcando.fecha, marcando.estudiante.studentId, estado);
            setMarcando(null);
          }}
          onCerrar={() => setMarcando(null)}
        />
      )}

      {menuColumna && (
        <MenuLlenarLista
          fecha={menuColumna}
          total={grupo.miembros.length}
          vacias={
            grupo.miembros.filter(
              (id) => !sesiones.find((s) => s.fecha === menuColumna)?.estudiantes?.[id],
            ).length
          }
          onElegir={(estado) => {
            void llenarColumna(menuColumna, estado);
            setMenuColumna(null);
          }}
          onCerrar={() => setMenuColumna(null)}
        />
      )}

      {estadisticaDe && (
        <HojaEstadistica
          estudiante={estadisticaDe}
          sesiones={comoEventos}
          centros={centrosPorEstudiante.get(estadisticaDe.studentId) ?? [grupo.nombre]}
          enConflicto={enConflicto.has(estadisticaDe.studentId)}
          onCerrar={() => setEstadisticaDe(null)}
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
 * El señalamiento del estudiante que quedo en dos centros, para la ficha del escaner.
 *
 * Va con `Ayuda` y no con el `title` del navegador: el `title` tarda un segundo largo en
 * salir y no admite dos lineas de texto, y aqui lo que hace falta es justamente una
 * explicacion de dos lineas.
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

/**
 * Un estudiante de la lista del lider que el cruce con la matricula no pudo ubicar.
 *
 * LO CONTRAINTUITIVO, Y HAY QUE DECIRLO EN LA TARJETA: tocar un candidato NO INSCRIBE A
 * NADIE. Guarda la propuesta del lider (`proponerPendiente`) y la coordinacion la
 * confirma. Son dos actos separados a proposito —el lider sabe cual de las dos "Jimenez
 * Mariana" es la suya, la coordinacion es la unica que ve los veintiun centros a la vez y
 * puede inscribir sin romper `exclusivo`—, pero para quien toca el boton eso es invisible:
 * si la pantalla no lo dice, el lider se va creyendo que el estudiante ya quedo y vuelve
 * la semana siguiente a reclamar por que no aparece en la planilla.
 *
 * La FOTO no es adorno: en un homonimo —dos personas con el mismo nombre y el mismo
 * grado— la cara es literalmente el unico dato que permite decidir. A los muchachos se los
 * reconoce por la cara, no por el apellido.
 */
function TarjetaSinUbicar({
  pendiente,
  onProponer,
}: {
  pendiente: PendientePrograma;
  onProponer: (pendienteId: string, propuesta: string | null) => Promise<void>;
}) {
  const [guardando, setGuardando] = useState(false);
  const [fallo, setFallo] = useState<string | null>(null);
  const p = pendiente;
  const elegido = p.propuestaLider ?? null;
  const nombreElegido = p.candidatos.find((c) => c.studentId === elegido)?.nombre ?? null;

  async function elegir(studentId: string | null) {
    setGuardando(true);
    setFallo(null);
    try {
      await onProponer(p.pendienteId, studentId);
    } catch (e) {
      setFallo(
        `No fue posible guardar lo que señaló: ${e instanceof Error ? e.message : String(e)}`,
      );
    } finally {
      setGuardando(false);
    }
  }

  return (
    <article className="rounded-xl border border-line bg-card p-3 text-soft">
      <header className="flex flex-wrap items-baseline gap-x-2">
        {/* El nombre TAL CUAL venia en la lista, sin corregir: es la evidencia, y es lo
            que el lider va a reconocer de su papel. */}
        <span className="text-sm font-semibold text-strong">{p.nombreArchivo}</span>
        {p.grupoArchivo && <span className="text-xs text-muted">{p.grupoArchivo}</span>}
      </header>

      {p.tipo === 'no_encontrado' || p.candidatos.length === 0 ? (
        // Aqui NO hay candidatos que ofrecer, y ofrecer una busqueda seria mandar al lider
        // a buscar lo que no existe: ese nombre no esta en la matricula del colegio. El
        // sitio donde se arregla no es esta aplicacion.
        <p className="mt-1 text-xs">
          Este nombre <b>no aparece en la matrícula del colegio</b>. No es algo que se
          arregle desde aquí: puede estar mal escrito en su lista, o el estudiante no quedó
          matriculado. Verifíquelo en <b>secretaría</b> y avise a la coordinación del
          programa.
        </p>
      ) : (
        <>
          <p className="mt-1 text-xs">
            {p.tipo === 'ortografia' ? (
              <>
                Puede ser la misma persona, escrita distinto. ¿Es esta?
              </>
            ) : (
              <>
                Hay {p.candidatos.length} estudiantes que pueden ser. ¿Cuál es el suyo?
              </>
            )}
          </p>
          <div className="mt-2 space-y-1.5">
            {p.candidatos.map((c) => (
              <BotonCandidatoLider
                key={c.studentId}
                candidato={c}
                elegido={c.studentId === elegido}
                disabled={guardando}
                onClick={() => void elegir(c.studentId === elegido ? null : c.studentId)}
              />
            ))}
          </div>

          {elegido ? (
            <p className="mt-2 rounded-lg border border-info-soft bg-info-soft p-2 text-xs text-info-soft-fg">
              Usted señaló a <b>{nombreElegido ?? 'un estudiante'}</b>. Está esperando que
              la coordinación lo confirme; en cuanto lo haga, queda inscrito y aparecerá en
              esta planilla. <b>Usted no tiene que hacer nada más.</b> Si se equivocó, toque
              otro nombre —o el mismo, para quitar lo que señaló— mientras el caso siga
              abierto.
            </p>
          ) : (
            <p className="mt-2 text-[0.7rem] text-muted">
              Tocar un nombre <b>no lo inscribe</b>: solo señala quién cree usted que es.
              Coordinación lo confirma y queda inscrito. Usted no tiene que hacer nada más.
            </p>
          )}
        </>
      )}

      {fallo && (
        <p className="mt-2 rounded-lg border border-danger-soft bg-danger-soft p-2 text-xs text-danger-soft-fg">
          {fallo}
        </p>
      )}
    </article>
  );
}

/**
 * Boton de candidato con la FOTO, igual que en la bandeja de coordinacion.
 *
 * `Avatar` usa `fotoPath` solo como señal de «este tiene foto, ve a buscarla»: la ruta
 * real la calcula `urlDeFoto` a partir del `studentId`. Un pendiente no guarda `fotoPath`
 * —guarda lo minimo, son datos de menores—, asi que se pone la señal y se deja que la
 * busqueda decida: si no hay foto salen las iniciales, como en la planilla.
 */
function BotonCandidatoLider({
  candidato,
  elegido,
  disabled,
  onClick,
}: {
  candidato: CandidatoPendiente;
  elegido: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  const comoEstudiante = {
    studentId: candidato.studentId,
    nombres: candidato.nombre,
    apellidos: '',
    fotoPath: 'buscar',
  };
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      aria-pressed={elegido}
      className={[
        'flex w-full items-center gap-3 rounded-xl border p-2 text-left disabled:opacity-50',
        elegido ? 'border-accent bg-accent-soft' : 'border-line bg-elevated',
      ].join(' ')}
    >
      <Avatar estudiante={comoEstudiante} tamano={52} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-strong">
          {candidato.nombre}
        </span>
        <span className="block text-xs text-muted">{candidato.grado}</span>
      </span>
      {elegido && (
        <span className="flex shrink-0 items-center gap-1 rounded-full bg-accent px-2 py-0.5 text-xs font-semibold text-accent-fg">
          <Check size={12} aria-hidden />
          Es este
        </span>
      )}
    </button>
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
 * Hoja de marcas — mismo patron que `MenuMarcas` en Planilla.tsx: foto GRANDE (110 px) y
 * un boton por marca. Se replica el patron, no el codigo, porque no esta exportado.
 */
function HojaMarcar({
  estudiante,
  fecha,
  enConflicto,
  marcaActual,
  onElegir,
  onCerrar,
}: {
  estudiante: Student;
  fecha: string;
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
        {/* Foto grande: el docente confirma que es el estudiante correcto antes de marcar,
            que es justo el momento en que mas se confunden nombres parecidos. */}
        <div className="flex flex-col items-center gap-1">
          <Avatar estudiante={estudiante} tamano={110} />
          <p className="text-lg font-semibold text-strong">{nombreCompleto(estudiante)}</p>
          <p className="text-xs text-muted">{estudiante.gradoActual}</p>
          <p className="text-xs text-muted">Sesión del {fechaLegible(fecha)}</p>
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
 * Llenado por defecto de una columna — el atajo que de verdad ahorra tiempo, igual que
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
 * El detalle de la ultima columna: la estadistica de UN estudiante en este centro.
 *
 * El denominador va SIEMPRE junto al numero: "3 faltas" no dice nada sin saber sobre
 * cuantas sesiones registradas se cuentan. Y aqui tambien se dice a que centro(s)
 * pertenece, que es lo que el lider quiere saber cuando se para sobre un estudiante.
 */
function HojaEstadistica({
  estudiante,
  sesiones,
  centros,
  enConflicto,
  onCerrar,
}: {
  estudiante: Student;
  sesiones: EventSession[];
  centros: string[];
  enConflicto: boolean;
  onCerrar: () => void;
}) {
  const r = estadisticaEvento(estudiante.studentId, sesiones);
  const filas: { etiqueta: string; valor: string }[] = [
    { etiqueta: 'Asistencias', valor: `${r.porMarca.asistencia} de ${r.sesionesCount}` },
    {
      etiqueta: 'Retrasos',
      valor: String(r.porMarca.retraso + r.porMarca.retraso_justificado),
    },
    { etiqueta: 'Ausencias', valor: conDenominador(r.ausenciasTotales, r.sesionesCount) },
    { etiqueta: 'Evasiones', valor: String(r.porMarca.evasion) },
    { etiqueta: 'Sin registrar', valor: String(r.sinRegistrar) },
  ];

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
          <p className="text-xs text-muted">
            {centros.length > 1
              ? `Inscrito en: ${centros.join(', ')}`
              : `Inscrito en «${centros[0]}»`}
          </p>
        </div>

        {enConflicto && (
          <p className="mt-3 rounded-lg border border-warning-soft bg-warning-soft p-2 text-xs text-warning-soft-fg">
            {AVISO_CONFLICTO}
          </p>
        )}

        {r.sesionesCount === 0 ? (
          <p className="mt-3 text-sm text-muted">
            Todavía no hay ninguna sesión registrada en este centro, así que no hay nada
            que medir. El calendario no cuenta: solo los días en que alguien tomó
            asistencia.
          </p>
        ) : (
          <>
            <table className="mt-3 w-full text-sm">
              <tbody>
                {filas.map((f) => (
                  <tr key={f.etiqueta} className="border-t border-line">
                    <td className="p-1 text-soft">{f.etiqueta}</td>
                    <td className="p-1 text-right font-semibold text-strong">{f.valor}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-2 text-xs text-muted">
              Sobre {r.sesionesCount}{' '}
              {r.sesionesCount === 1 ? 'sesión registrada' : 'sesiones registradas'} de este
              centro. El calendario no cuenta: solo los días en que alguien tomó asistencia.
            </p>
          </>
        )}

        <button
          onClick={onCerrar}
          className="mt-3 w-full rounded-lg border border-line p-2 text-sm text-soft"
        >
          Cerrar
        </button>
      </div>
    </div>
  );
}

/**
 * Inscribir y retirar — SOLO la coordinacion del programa.
 *
 * Ya no es una pestaña: es un panel que se abre desde la misma pantalla, porque inscribir
 * no es una forma de mirar la planilla sino una accion puntual que hace otra persona.
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
        `${nombreCompleto(e)} quedó inscrito en «${grupo.nombre}». Vuelva a entrar al centro para verlo en la planilla.`,
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
        `${nombreCompleto(e)} se retiró de «${grupo.nombre}». Vuelva a entrar al centro para ver la planilla actualizada.`,
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
        <p className="text-sm font-semibold text-strong">Inscritos ({miembros.length})</p>
        {miembros.length === 0 ? (
          <p className="mt-1 text-xs text-muted">Todavía no hay nadie inscrito en este centro.</p>
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
