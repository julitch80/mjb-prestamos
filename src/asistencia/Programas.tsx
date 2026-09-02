import { lazy, Suspense, useEffect, useMemo, useState, type ReactNode } from 'react';
import PlanillaCentro from './PlanillaCentro';
import PendientesPrograma from './PendientesPrograma';
import PanelPrograma from './PanelPrograma';
/**
 * La carga desde Excel arrastra exceljs. Va con lazy() —como Importar y DireccionGrupo—
 * para que no pese en el arranque de los veinte lideres que solo entran a pasar lista y
 * nunca van a importar nada: la coordinacion es una sola persona.
 */
const ImportarCentros = lazy(() => import('./ImportarCentros'));
import {
  crearGrupoPrograma,
  crearPrograma,
  desactivarPrograma,
  leerCreadoresDeProgramas,
  editarGrupoPrograma,
  editarPrograma,
  leerMisGruposDePrograma,
  leerEstudiantesDeSede,
  leerPendientesPrograma,
  leerProgramasVisibles,
} from './datos';
import { correoAutorAsync } from './identidad';
import {
  coberturaPrograma,
  detectarDuplicados,
  slugGrupo,
  slugPrograma,
  validarPrograma,
} from './domain/programas';
import { toDateKey } from './domain/ids';
import { atras, useNivelAtras } from './useNivelAtras';
import type {
  GrupoPrograma,
  Jornada,
  PendientePrograma,
  Programa,
  Sede,
  Student,
} from './domain/types';

/** Nombre para mostrar de cada sede. El id real sigue siendo la clave. */
const NOMBRE_SEDE: Record<string, string> = {
  central: 'central',
  gustavo_rodas: 'Gustavo Rodas',
  la_finquita: 'La Finquita',
};

const SEDES: Sede[] = ['central', 'gustavo_rodas', 'la_finquita'];

const OPCIONES_JORNADA: { valor: Jornada | ''; label: string }[] = [
  { valor: '', label: 'Las dos jornadas' },
  { valor: 'manana', label: 'Solo mañana' },
  { valor: 'tarde', label: 'Solo tarde' },
];

/**
 * Programas y centros de interes — la lista, y desde ella la planilla de cada centro.
 *
 * DOS NIVELES Y DOS AUTORIDADES, que es justamente lo que hace falta un nivel nuevo y no
 * un evento mas (`docs/modelo-centros-interes.md`):
 *
 *   - el PROGRAMA agrupa los veintiun centros del semestre, y su lista `coordinadores`
 *     es la unica autoridad que manda sobre todos a la vez;
 *   - el CENTRO tiene un lider, que registra la asistencia de su grupo y nada mas.
 *
 * Quien no coordina el programa NO ve los botones de crear ni de editar. La regla
 * tambien los rechaza —`allow create: if asisCoordinaPrograma(programaId)`—, pero pintar
 * un boton que el servidor va a negar es hacerle perder el tiempo a un docente y
 * hacerle creer que la aplicacion falla.
 */
export default function Programas({
  puedeRegistrar,
  puedeCrearPrograma,
  rolConsulta = null,
  jornadaLimitada = null,
}: {
  /** Si se ofrece marcar asistencia. NO decide quien crea un programa: ver abajo. */
  puedeRegistrar: boolean;
  /**
   * Quien puede crear un programa: el superusuario, un coordinador de sede, o quien este
   * en `asistenciaConfig/programas` (la lider del proyecto). Esta prop cubre los dos
   * primeros; el tercero lo resuelve la propia pantalla leyendo la lista.
   *
   * NO es `puedeRegistrar`, y confundirlos dejo el modulo muerto el 2026-08-25: el
   * superusuario no registra asistencia, asi que `puedeRegistrar` es falso para el, y el
   * boton se le escondia — pero la regla de Firestore dice `isSuper() ||
   * asisCoordinaSede(...)`, o sea que era el UNICO que podia crearlo. Nadie podia crear
   * nada. Al reves, un docente cualquiera SI veia el boton y la regla se lo rechazaba.
   *
   * Regla general que sale de esto: la condicion de un boton tiene que ser la MISMA que
   * la de la regla que lo respalda, no una parecida.
   */
  puedeCrearPrograma: boolean;
  /**
   * Rol de CONSULTA sobre los programas: ve los centros y sus planillas, no administra.
   * Espeja `asisConsultaDelPrograma()` de las reglas (decision de Julian, 2026-08-25).
   *
   *  - `total`: la rectora y los cargos de apoyo con `asistenciaConsulta` (PTA y apoyo).
   *    Todos los programas, las dos jornadas, sin restriccion. Su trabajo es de sexto a
   *    once, no de una jornada.
   *  - `coordinador`: solo los de su sede, y si el programa declara jornada, solo la suya.
   *    En la sede central hay dos, uno por jornada.
   *
   * `null` para todos los demas. Abrir la regla sin abrir tambien la CONSULTA no sirve de
   * nada: la rama de docente filtra por `array-contains` y devolveria cero igual.
   */
  rolConsulta?: 'total' | 'coordinador' | null;
  /** Jornada a la que esta limitada la cuenta, si lo esta. La rectora nunca lo esta. */
  jornadaLimitada?: Jornada | null;
}) {
  const [programas, setProgramas] = useState<Programa[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [miCorreo, setMiCorreo] = useState<string | null>(null);
  const [abierto, setAbierto] = useState<Programa | null>(null);
  useNivelAtras(abierto !== null, () => {
    setAbierto(null);
    void cargar();
  });
  const [creando, setCreando] = useState(false);
  const [editando, setEditando] = useState<Programa | null>(null);
  const [creadores, setCreadores] = useState<string[]>([]);
  /**
   * Los centros que lidera esta cuenta, de TODOS los programas a la vez.
   *
   * Existe para que un lider no tenga que escoger jornada. Julian, 2026-08-26: "¿Que
   * sentido tiene que yo escoja cuando ya estoy clasificado en la manana y ya se sabe cual
   * es mi centro de interes?". Tenia razon: el programa es un concepto de ADMINISTRACION
   * —sirve para cargar listas, resolver pendientes y cerrar el semestre— y para quien solo
   * dicta su centro es un peaje sin contenido, ademas de una pantalla donde la mitad de
   * las opciones no llevan a ninguna parte.
   *
   * OJO: la separacion en dos programas NO sobra y no se toca. Es lo que impide que
   * "Musica en el 'J'" de la manana y el de la tarde —mismo profesor, mismo nombre, mismo
   * identificador— se fundan en una sola lista de cincuenta estudiantes de dos jornadas.
   * Lo que sobraba era hacer ESCOGER, no la separacion.
   *
   * `null` mientras se averigua; `[]` = no lidera ninguno.
   */
  const [misCentros, setMisCentros] = useState<
    { programa: Programa; grupo: GrupoPrograma }[] | null
  >(null);

  /**
   * El permiso final es el de la regla: rol O lista. Se lee aparte porque `rol` viene del
   * store y la lista vive en Firestore; juntarlos aqui es lo que evita el desajuste que
   * dejo el modulo muerto el 2026-08-25 (boton con una condicion, regla con otra).
   */
  const puedeCrear = puedeCrearPrograma || creadores.includes((miCorreo ?? '').toLowerCase());

  async function cargar() {
    setError(null);
    try {
      setProgramas(await leerProgramasVisibles());
    } catch (e) {
      setError(
        `No fue posible cargar los programas. Intente de nuevo en un momento. (${(e as Error).message})`,
      );
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    void cargar();
    void correoAutorAsync().then(setMiCorreo);
    // Si la lista no se puede leer no se rompe nada: se cae al permiso por rol, que es
    // el restrictivo. Fallar hacia "no ofrezco el boton" muestra de menos; fallar hacia
    // el otro lado ofrece un boton que la regla rechaza.
    void leerCreadoresDeProgramas().then(setCreadores).catch(() => setCreadores([]));
  }, []);

  /**
   * Si esta cuenta puede VER los centros de ESTE programa sin coordinarlo. Se calcula por
   * programa y no una sola vez, porque el coordinador de la manana no debe ver el de la
   * tarde aunque los dos sean de su sede.
   */
  const puedeConsultar = (p: Programa): boolean => {
    if (rolConsulta === 'total') return true;
    if (rolConsulta !== 'coordinador') return false;
    if (!p.jornada || !jornadaLimitada) return true;
    return p.jornada === jornadaLimitada;
  };

  /**
   * Solo administra quien coordina algun programa o tiene consulta ampliada. Para el
   * resto —los veinte lideres— el nivel de "programa" no significa nada.
   */
  const soloLidera =
    !rolConsulta &&
    miCorreo !== null &&
    !programas.some((p) => (p.coordinadores ?? []).includes(miCorreo));

  // Se buscan los centros del lider en TODOS los programas a la vez. Son dos consultas
  // pequeñas, ya filtradas por `array-contains` dentro de `leerMisGruposDePrograma`.
  useEffect(() => {
    if (!soloLidera || programas.length === 0) return;
    let vivo = true;
    void (async () => {
      const encontrados: { programa: Programa; grupo: GrupoPrograma }[] = [];
      for (const p of programas.filter((x) => x.activo)) {
        const gs = await leerMisGruposDePrograma(p.programaId).catch(() => []);
        for (const g of gs) if (g.activo) encontrados.push({ programa: p, grupo: g });
      }
      if (vivo) setMisCentros(encontrados);
    })();
    return () => {
      vivo = false;
    };
  }, [soloLidera, programas]);

  const coordinaAlguno = useMemo(
    () => programas.some((p) => (p.coordinadores ?? []).includes(miCorreo ?? '')),
    [programas, miCorreo],
  );

  // ---------- El camino del LIDER: sin escoger jornada ----------
  //
  // Va ANTES de todo lo demas a proposito. Para quien solo dicta su centro, la lista de
  // programas es un peaje: la mitad de las opciones no llevan a ninguna parte (entrar al
  // programa de la otra jornada muestra una pantalla vacia) y la otra mitad tiene un solo
  // resultado.
  if (soloLidera && !abierto) {
    if (misCentros === null) {
      return <p className="p-3 text-sm text-muted">Buscando su centro de interés…</p>;
    }
    if (misCentros.length === 0) {
      return (
        <div className="rounded-xl border border-line bg-card p-4 text-center">
          <p className="text-sm text-strong">No tiene ningún centro de interés asignado.</p>
          <p className="mt-1 text-xs text-muted">
            Si debería tener uno, pídaselo a la coordinación del programa: es quien crea los
            centros y asigna a su responsable.
          </p>
        </div>
      );
    }
    // Uno solo: se entra directo. Es el caso de veinte de los veintiun lideres.
    //
    // SIN `onVolver`: aqui no hay ninguna lista detras a la que volver, ni de
    // programas ni de centros — esta pantalla ES la entrada a "Centros de interes"
    // para este lider. Antes se pasaba `() => setMisCentros(null)`, que no revivia la
    // busqueda (el efecto de arriba no depende de `misCentros`) y dejaba a la persona
    // atascada en "Buscando su centro de interes..." para siempre. `PlanillaCentro` ya
    // sabe ocultar el enlace "Volver" cuando no lo recibe.
    if (misCentros.length === 1) {
      const { programa, grupo } = misCentros[0];
      return (
        <PlanillaCentro
          programa={programa}
          grupo={grupo}
          puedeRegistrar={puedeRegistrar}
          esCoordinador={false}
          gruposDelPrograma={[grupo]}
        />
      );
    }
    // Varios (Edgar Perez lleva Musica en el 'J' en las dos jornadas): se listan los
    // CENTROS, no los programas, con la jornada como subtitulo para distinguirlos.
    return (
      <div className="space-y-3">
        <h2 className="text-base font-semibold text-strong">Sus centros de interés</h2>
        <ul className="space-y-1.5">
          {misCentros.map(({ programa, grupo }) => (
            <li key={`${programa.programaId}|${grupo.grupoId}`}>
              <button
                onClick={() => setAbierto(programa)}
                className="w-full rounded-xl border border-line bg-card p-3 text-left hover:bg-hover"
              >
                <p className="text-sm font-semibold text-strong">{grupo.nombre}</p>
                <p className="text-xs text-muted">
                  {programa.jornada === 'manana'
                    ? 'Jornada de la mañana'
                    : programa.jornada === 'tarde'
                      ? 'Jornada de la tarde'
                      : programa.nombre}{' '}
                  · {(grupo.miembros ?? []).length} estudiantes
                </p>
              </button>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  if (abierto) {
    const actualizado = programas.find((p) => p.programaId === abierto.programaId) ?? abierto;
    return (
      <DetallePrograma
        programa={actualizado}
        miCorreo={miCorreo ?? ''}
        puedeRegistrar={puedeRegistrar}
        soloConsulta={puedeConsultar(actualizado)}
        onEditarPrograma={() => setEditando(actualizado)}
        onVolver={atras}
      />
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-base font-semibold text-strong">Centros de interés</h2>
        {/* Mismo criterio que la regla: superusuario o coordinador de sede. Quien lo crea
            queda dentro de `coordinadores` (lo exige la propia regla), si no nacería
            huérfano y nadie podría volver a tocarlo. */}
        {puedeCrear && (
          <button
            onClick={() => setCreando(true)}
            className="shrink-0 rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-accent-fg"
          >
            + Crear programa
          </button>
        )}
      </div>
      <p className="text-xs text-muted">
        Un programa agrupa los centros de interés de un semestre. Cada centro tiene su
        líder y su propia planilla; la coordinación del programa los ve todos.
      </p>

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

      {cargando ? (
        <p className="text-sm text-muted">Cargando programas…</p>
      ) : programas.length === 0 ? (
        <div className="rounded-xl border border-line bg-card p-4 text-center">
          <p className="text-sm text-strong">Todavía no hay ningún programa.</p>
          <p className="mt-1 text-xs text-muted">
            {puedeCrear
              ? 'Cree el programa del semestre y luego agregue dentro cada centro de interés con su líder.'
              : 'Aquí aparecerán los centros de interés en cuanto la coordinación cree el programa del semestre y le asigne el suyo.'}
          </p>
        </div>
      ) : (
        <ul className="space-y-1.5">
          {programas.map((p) => {
            const coordino = (p.coordinadores ?? []).includes(miCorreo ?? '');
            return (
              <li key={p.programaId}>
                <button
                  onClick={() => setAbierto(p)}
                  className="w-full rounded-xl border border-line bg-card p-3 text-left hover:bg-hover"
                >
                  <p className="text-sm font-semibold text-strong">{p.nombre}</p>
                  <p className="text-xs text-muted">
                    {p.desde} a {p.hasta} · sede {NOMBRE_SEDE[p.sede] ?? p.sede}
                    {p.jornada ? ` · jornada ${p.jornada === 'manana' ? 'mañana' : 'tarde'}` : ''}
                  </p>
                  {coordino && (
                    <p className="mt-0.5 text-xs text-accent-soft-fg">Usted lo coordina</p>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {!cargando && programas.length > 0 && !coordinaAlguno && (
        <p className="text-xs text-muted">
          Usted no coordina ningún programa: puede entrar a los centros de interés que
          lidera y pasar su lista. Crear centros e inscribir estudiantes le corresponde a
          la coordinación del programa.
        </p>
      )}

      {creando && (
        <FormularioPrograma
          idsUsados={programas.map((p) => p.programaId)}
          onGuardado={(p) => {
            setCreando(false);
            setProgramas((prev) => [p, ...prev]);
            setAbierto(p);
          }}
          onCerrar={() => setCreando(false)}
        />
      )}

      {editando && (
        <FormularioPrograma
          programa={editando}
          idsUsados={programas.map((p) => p.programaId)}
          onGuardado={(p) => {
            setEditando(null);
            setProgramas((prev) =>
              prev.map((x) => (x.programaId === p.programaId ? p : x)),
            );
            setAviso(`Se guardaron los cambios de «${p.nombre}».`);
          }}
          onCerrar={() => setEditando(null)}
        />
      )}
    </div>
  );
}

/**
 * Los centros de UN programa, y desde ahi la planilla de cada uno.
 *
 * La lista SIEMPRE sale de `leerMisGruposDePrograma`. Nunca se arma la consulta a mano:
 * la rama de docente de la regla mira `resource.data.docentes`, asi que Firestore exige
 * el `where('docentes','array-contains', <correo>)` para poder demostrar ANTES de
 * ejecutar que todo el resultado sera legible. Sin ese filtro la consulta ENTERA es
 * rechazada con permission-denied — no devuelve de menos: falla. Ya rompio pantallas en
 * este modulo.
 */
function DetallePrograma({
  programa,
  miCorreo,
  puedeRegistrar,
  soloConsulta,
  onEditarPrograma,
  onVolver,
}: {
  programa: Programa;
  miCorreo: string;
  puedeRegistrar: boolean;
  /**
   * Ve todos los centros del programa pero NO los administra: rectora y coordinacion de
   * la sede/jornada. Cambia la CONSULTA (rama sin filtro, o no ve ninguno) y NO cambia
   * nada de lo que puede escribir: eso lo sigue decidiendo `esCoordinador`.
   */
  soloConsulta: boolean;
  onEditarPrograma: () => void;
  onVolver: () => void;
}) {
  const [grupos, setGrupos] = useState<GrupoPrograma[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [creando, setCreando] = useState(false);
  const [editando, setEditando] = useState<GrupoPrograma | null>(null);
  const [centroAbierto, setCentroAbierto] = useState<GrupoPrograma | null>(null);
  useNivelAtras(centroAbierto !== null, () => {
    setCentroAbierto(null);
    void cargar();
  });
  /**
   * Las tres pantallas de coordinacion cuelgan de aqui y no del menu principal a
   * proposito: todas necesitan un programa concreto para significar algo. "Pendientes"
   * suelto no quiere decir nada; "pendientes de Centros de Interes 2026-2" si.
   */
  const [seccion, setSeccion] = useState<'centros' | 'pendientes' | 'panel' | 'cargar'>(
    'centros',
  );
  useNivelAtras(seccion !== 'centros', () => setSeccion('centros'));
  /**
   * Los pendientes abiertos del programa entero, solo para CONTARLOS por centro.
   *
   * La bandeja vive a nivel de programa y los centros a otro nivel, y eso hizo que la
   * coordinadora entrara a un centro, no viera nada y creyera que no habia pendientes: los
   * 63 casos estaban en otra pestaña. Aqui cada centro dice cuantos tiene y lleva a la
   * bandeja ya filtrada por el.
   *
   * Si la lectura falla no se rompe la pantalla ni se inventa un cero explicado: se queda
   * sin avisos y los centros se siguen viendo, que es lo que se vino a hacer.
   */
  const [pendientes, setPendientes] = useState<PendientePrograma[]>([]);
  /** Centro con el que se entra a la bandeja, cuando se llega desde su aviso. */
  const [grupoPendientes, setGrupoPendientes] = useState<string | undefined>(undefined);
  /**
   * La matricula de la sede, cargada AQUI y no dentro del panel.
   *
   * Hace falta en dos sitios: la pastilla necesita el numero de "sin centro" ANTES de que
   * nadie abra el panel —si no, el problema solo se descubre cuando alguien se acuerda de
   * ir a mirar—, y el panel necesita la lista entera. Cargarla en los dos seria leer 688
   * fichas dos veces para la misma pantalla.
   */
  const [matriculados, setMatriculados] = useState<Student[]>([]);

  const esCoordinador = (programa.coordinadores ?? []).includes(miCorreo);

  async function cargar() {
    setError(null);
    try {
      setGrupos(await leerMisGruposDePrograma(programa.programaId, false, soloConsulta));
    } catch (e) {
      setError(
        `No fue posible cargar los centros de este programa. Intente de nuevo en un momento. (${(e as Error).message})`,
      );
    } finally {
      setCargando(false);
    }
  }

  // Solo el `programaId` en las dependencias, a proposito: `cargar` se redefine en cada
  // pintado y ponerla aqui recargaria los centros en bucle.
  useEffect(() => {
    void cargar();
  }, [programa.programaId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Solo la coordinacion puede leer la bandeja: pedirla desde una cuenta de lider seria
  // un permission-denied garantizado, y el lider no ve la seccion de todos modos.
  useEffect(() => {
    if (!esCoordinador) {
      setPendientes([]);
      return;
    }
    let vivo = true;
    void leerPendientesPrograma(programa.programaId)
      .then((lista) => vivo && setPendientes(lista))
      .catch(() => vivo && setPendientes([]));
    return () => {
      vivo = false;
    };
    // `seccion` esta a proposito: al volver de la bandeja los numeros tienen que reflejar
    // lo que se acaba de resolver. Es una consulta de una coleccion pequena y solo la hace
    // la coordinacion, que es una sola persona.
  }, [programa.programaId, esCoordinador, seccion]);

  // La matricula de la sede: solo la coordinacion la necesita aqui (para el conteo de la
  // pastilla y para el panel). Si falla, la pantalla sigue viva sin el aviso.
  useEffect(() => {
    if (!esCoordinador) {
      setMatriculados([]);
      return;
    }
    let vivo = true;
    void leerEstudiantesDeSede(programa.sede)
      .then((lista) => vivo && setMatriculados(lista))
      .catch(() => vivo && setMatriculados([]));
    return () => {
      vivo = false;
    };
  }, [programa.sede, esCoordinador, seccion]);

  /**
   * Cuantos matriculados no estan en ningun centro. Es el numero que va en la pastilla:
   * sin el, la lista de "sin centro" es pasiva y solo se descubre cuando alguien se
   * acuerda de entrar a mirarla. Un estudiante que ingresa a mitad de año puede pasar
   * semanas sin centro y nada lo señala.
   */
  const sinCentro = useMemo(
    () =>
      matriculados.length === 0
        ? 0
        : coberturaPrograma(matriculados, grupos, programa.jornada).faltantes.length,
    [matriculados, grupos, programa.jornada],
  );

  /**
   * Cuantos pendientes abiertos toca a cada centro. Un `duplicado` cuenta en LOS DOS
   * centros en conflicto —el caso es de los dos y cualquiera de los dos lideres lo
   * reconoce—, y por eso la suma de los avisos puede pasar del total del programa.
   */
  const pendientesPorGrupo = useMemo(() => {
    const cuenta = new Map<string, number>();
    for (const p of pendientes) {
      const centros = new Set<string>([p.grupoId, ...(p.gruposEnConflicto ?? [])]);
      for (const id of centros) cuenta.set(id, (cuenta.get(id) ?? 0) + 1);
    }
    return cuenta;
  }, [pendientes]);

  /** Quien quedo inscrito en dos centros a la vez, sobre los centros que se alcanzan a ver. */
  const conflictos = useMemo(() => {
    if (!programa.exclusivo) return new Map<string, string[]>();
    return new Map(
      detectarDuplicados(grupos.filter((g) => g.activo)).map((d) => [d.studentId, d.grupoIds]),
    );
  }, [grupos, programa.exclusivo]);

  const conflictoPorGrupo = useMemo(() => {
    const cuenta = new Map<string, number>();
    for (const grupoIds of conflictos.values()) {
      for (const id of grupoIds) cuenta.set(id, (cuenta.get(id) ?? 0) + 1);
    }
    return cuenta;
  }, [conflictos]);

  if (centroAbierto) {
    const actual = grupos.find((g) => g.grupoId === centroAbierto.grupoId) ?? centroAbierto;
    return (
      <PlanillaCentro
        programa={programa}
        grupo={actual}
        puedeRegistrar={puedeRegistrar}
        esCoordinador={esCoordinador}
        gruposDelPrograma={grupos}
        onVolver={atras}
      />
    );
  }

  return (
    <div className="space-y-3">
      <div>
        <button onClick={onVolver} className="text-xs text-muted underline">
          ← Volver a los programas
        </button>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold text-strong">{programa.nombre}</h2>
            <p className="text-xs text-muted">
              {programa.desde} a {programa.hasta} · sede{' '}
              {NOMBRE_SEDE[programa.sede] ?? programa.sede}
              {programa.exclusivo ? ' · un estudiante, un solo centro' : ''}
            </p>
          </div>
          {/* Editar el programa y crear centros: SOLO la coordinación. */}
          {esCoordinador && (
            <div className="flex shrink-0 gap-1.5">
              <button
                onClick={onEditarPrograma}
                className="rounded-lg border border-line px-3 py-1.5 text-sm text-strong"
              >
                Editar programa
              </button>
              <button
                onClick={() => setCreando(true)}
                className="rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-accent-fg"
              >
                + Crear centro
              </button>
            </div>
          )}
        </div>
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

      {/* Solo la coordinacion ve estas tres. El lider entra, ve su centro y pasa lista:
          no tiene por que enterarse de que existe una bandeja ni un panel. */}
      {esCoordinador && (
        <div className="flex flex-wrap gap-1.5">
          {(
            [
              ['centros', 'Centros'],
              ['pendientes', 'Por confirmar'],
              ['panel', 'Cobertura y asistencia'],
              ['cargar', 'Cargar lista de Excel'],
            ] as const
          ).map(([v, nombre]) => (
            <button
              key={v}
              onClick={() => {
                setSeccion(v);
                // Entrar por la pastilla es entrar a la bandeja entera: el filtro por
                // centro solo lo pone el aviso de cada centro.
                if (v === 'pendientes') setGrupoPendientes(undefined);
              }}
              className={[
                'min-h-[34px] rounded-full border px-3 py-1 text-sm',
                seccion === v
                  ? 'border-accent bg-accent-soft font-semibold text-accent-soft-fg'
                  : 'border-line text-soft',
              ].join(' ')}
            >
              {/* El total va en la pastilla: es el numero que dice si queda trabajo.
                  "Sin centro" tambien, porque si no, un estudiante que ingresa a mitad de
                  año puede pasar semanas sin asignar y nada lo señala: la lista existe,
                  pero es pasiva y hay que acordarse de ir a mirarla. */}
              {v === 'pendientes' && pendientes.length > 0
                ? `${nombre} (${pendientes.length})`
                : v === 'panel' && sinCentro > 0
                  ? `${nombre} · ${sinCentro} sin centro`
                  : nombre}
            </button>
          ))}
        </div>
      )}

      {esCoordinador && seccion === 'pendientes' && (
        <PendientesPrograma
          programaId={programa.programaId}
          sede={programa.sede}
          grupoInicial={grupoPendientes}
        />
      )}
      {esCoordinador && seccion === 'panel' && (
        <PanelPrograma
          programaId={programa.programaId}
          sede={programa.sede}
          jornada={programa.jornada}
          // La matricula ya esta cargada aqui para el conteo de la pastilla: pasarla
          // evita que el panel vuelva a leer las 688 fichas de la misma sede.
          matriculadosPrecargados={matriculados}
          grupos={grupos}
          puedeInscribir={esCoordinador}
          onInscrito={() => void cargar()}
        />
      )}
      {esCoordinador && seccion === 'cargar' && (
        <Suspense
          fallback={<p className="p-3 text-sm text-muted">Cargando la lectura de Excel…</p>}
        >
          <ImportarCentros
            programaFijo={programa}
            // No cambia de seccion sola: el resumen de lo que se importo esta en esta
            // misma pantalla y llevarsela de golpe seria esconderselo.
            onTerminado={() => void cargar()}
          />
        </Suspense>
      )}

      {esCoordinador && conflictos.size > 0 && seccion === 'centros' && (
        <div className="rounded-xl border border-warning-soft bg-warning-soft p-3 text-xs text-warning-soft-fg">
          <b>
            {conflictos.size}{' '}
            {conflictos.size === 1 ? 'estudiante quedó' : 'estudiantes quedaron'}
          </b>{' '}
          inscrito{conflictos.size === 1 ? '' : 's'} en dos centros a la vez. Están
          señalados en la planilla de los dos centros y ahí puede retirarlos del que no
          corresponda.
        </div>
      )}

      {cargando ? (
        <p className="text-sm text-muted">Cargando centros de interés…</p>
      ) : grupos.length === 0 ? (
        <div className="rounded-xl border border-line bg-card p-4 text-center">
          <p className="text-sm text-strong">
            {esCoordinador
              ? 'Este programa todavía no tiene ningún centro de interés.'
              : 'No hay ningún centro de interés a su nombre en este programa.'}
          </p>
          <p className="mt-1 text-xs text-muted">
            {esCoordinador
              ? 'Cree el primero con «+ Crear centro»: necesita un nombre y el correo del docente que lo lidera.'
              : 'Solo aparecen aquí los centros en los que usted figura como docente. Si debería tener uno, pídale a la coordinación del programa que lo agregue.'}
          </p>
        </div>
      ) : (
        <ul className="space-y-1.5">
          {grupos.map((g) => {
            const dobles = conflictoPorGrupo.get(g.grupoId) ?? 0;
            const porConfirmar = pendientesPorGrupo.get(g.grupoId) ?? 0;
            return (
              <li key={g.grupoId} className="rounded-xl border border-line bg-card">
                <div className="flex items-stretch gap-1.5">
                  <button
                    onClick={() => setCentroAbierto(g)}
                    className="grow rounded-xl p-3 text-left hover:bg-hover"
                  >
                    <p className="text-sm font-semibold text-strong">{g.nombre}</p>
                    <p className="text-xs text-muted">
                      {g.miembros.length} {g.miembros.length === 1 ? 'inscrito' : 'inscritos'}
                      {g.cupo ? ` de ${g.cupo}` : ''} · lidera {g.lider}
                    </p>
                    {dobles > 0 && (
                      <p className="mt-0.5 text-xs text-warning-soft-fg">
                        {dobles} {dobles === 1 ? 'estudiante está' : 'estudiantes están'}{' '}
                        también en otro centro
                      </p>
                    )}
                  </button>
                  {esCoordinador && (
                    <button
                      onClick={() => setEditando(g)}
                      aria-label={`Editar ${g.nombre}`}
                      className="shrink-0 rounded-r-xl border-l border-line px-3 text-xs text-muted hover:bg-hover"
                    >
                      Editar
                    </button>
                  )}
                </div>

                {/* El aviso que faltaba: los pendientes de ESTE centro, donde la
                    coordinadora los fue a buscar. Lleva a la bandeja ya filtrada. */}
                {esCoordinador && porConfirmar > 0 && (
                  <button
                    onClick={() => {
                      setGrupoPendientes(g.grupoId);
                      setSeccion('pendientes');
                    }}
                    className="flex w-full items-center justify-between gap-2 border-t border-line px-3 py-2 text-left text-xs font-medium text-accent-soft-fg hover:bg-hover"
                  >
                    <span>
                      {porConfirmar} por confirmar en «{g.nombre}»
                    </span>
                    <span aria-hidden>→</span>
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {creando && esCoordinador && (
        <FormularioCentro
          programaId={programa.programaId}
          idsUsados={grupos.map((g) => g.grupoId)}
          onGuardado={(g) => {
            setCreando(false);
            setGrupos((prev) => [...prev, g].sort((a, b) => a.nombre.localeCompare(b.nombre)));
            setAviso(`Se creó el centro «${g.nombre}».`);
          }}
          onCerrar={() => setCreando(false)}
        />
      )}

      {editando && esCoordinador && (
        <FormularioCentro
          programaId={programa.programaId}
          grupo={editando}
          idsUsados={grupos.map((g) => g.grupoId)}
          onGuardado={(g) => {
            setEditando(null);
            setGrupos((prev) => prev.map((x) => (x.grupoId === g.grupoId ? g : x)));
            setAviso(`Se guardaron los cambios de «${g.nombre}».`);
          }}
          onCerrar={() => setEditando(null)}
        />
      )}
    </div>
  );
}

/**
 * Crear o editar un programa.
 *
 * El `programaId` se propone con `slugPrograma` a partir del nombre y NO se vuelve a
 * tocar al editar: va en la ruta de todos los centros, de todas sus sesiones y de la
 * bandeja de pendientes. Cambiarlo dejaria el semestre entero colgando de un documento
 * que ya no existe.
 *
 * Los errores salen de `validarPrograma`, que devuelve TODOS de una vez: quien llena
 * esto es la coordinadora, y corregir de a un error por intento es maltratarla. Los
 * mensajes vienen ya redactados en español para leerse tal cual; no se reformulan aqui.
 */
function FormularioPrograma({
  programa,
  idsUsados,
  onGuardado,
  onCerrar,
}: {
  /** Presente = edición. Ausente = creación. */
  programa?: Programa;
  idsUsados: string[];
  onGuardado: (p: Programa) => void;
  onCerrar: () => void;
}) {
  const edicion = Boolean(programa);
  const hoy = toDateKey(new Date());

  const [nombre, setNombre] = useState(programa?.nombre ?? '');
  const [sede, setSede] = useState<Sede>(programa?.sede ?? 'central');
  const [jornada, setJornada] = useState<Jornada | ''>(programa?.jornada ?? '');
  const [desde, setDesde] = useState(programa?.desde ?? hoy);
  const [hasta, setHasta] = useState(programa?.hasta ?? hoy);
  const [coordinadores, setCoordinadores] = useState((programa?.coordinadores ?? []).join(', '));
  const [exclusivo, setExclusivo] = useState(programa?.exclusivo ?? true);
  const [enviando, setEnviando] = useState(false);
  const [confirmandoBaja, setConfirmandoBaja] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const listaCoordinadores = coordinadores
    .split(/[,;\s]+/)
    .map((c) => c.trim().toLowerCase())
    .filter(Boolean);

  const problemas = validarPrograma({
    nombre,
    sede,
    desde,
    hasta,
    coordinadores: listaCoordinadores,
    ...(jornada ? { jornada } : {}),
  });

  // Solo al crear: el id se congela en la edición (ver el comentario del componente).
  const idPropuesto = edicion
    ? programa!.programaId
    : nombre.trim()
      ? intentarSlug(() => slugPrograma(nombre, idsUsados))
      : '';

  async function darDeBaja() {
    if (!programa) return;
    setEnviando(true);
    setError(null);
    try {
      await desactivarPrograma(programa.programaId);
      onGuardado({ ...programa, activo: false });
      onCerrar();
    } catch (e) {
      setError(`No se pudo dar de baja. (${(e as Error).message})`);
      setEnviando(false);
    }
  }

  async function enviar() {
    if (problemas.length > 0 || (!edicion && !idPropuesto)) return;
    setEnviando(true);
    setError(null);
    try {
      if (programa) {
        await editarPrograma(programa.programaId, {
          nombre: nombre.trim(),
          desde,
          hasta,
          coordinadores: listaCoordinadores,
          exclusivo,
          ...(jornada ? { jornada } : {}),
        });
        onGuardado({
          ...programa,
          nombre: nombre.trim(),
          desde,
          hasta,
          exclusivo,
          coordinadores: listaCoordinadores,
          ...(jornada ? { jornada } : {}),
        });
      } else {
        const nuevo = await crearPrograma({
          programaId: idPropuesto,
          nombre: nombre.trim(),
          sede,
          desde,
          hasta,
          coordinadores: listaCoordinadores,
          exclusivo,
          ...(jornada ? { jornada } : {}),
        });
        onGuardado(nuevo);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Hoja titulo={edicion ? 'Editar programa' : 'Crear programa'} onCerrar={onCerrar}>
      <label className="mt-2 block text-xs text-muted">
        Nombre
        <input
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          placeholder="Centros de Interés 2026-2"
          className="mt-0.5 block w-full rounded-lg border border-line bg-elevated px-2 py-2 text-base text-strong"
        />
      </label>
      {idPropuesto && (
        <p className="mt-1 text-xs text-muted">
          Identificador: <b>{idPropuesto}</b>
          {edicion
            ? ' · no se puede cambiar: de él cuelgan todos los centros y sus listas.'
            : ' · se arma con el nombre y ya no se podrá cambiar.'}
        </p>
      )}

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

      <div className="mt-2">
        <p className="text-xs font-medium text-muted">Sede</p>
        <div className="mt-1 flex flex-wrap gap-1.5">
          {SEDES.map((s) => (
            <button
              key={s}
              disabled={edicion}
              onClick={() => setSede(s)}
              className={[
                'rounded-full border px-3 py-1.5 text-sm disabled:opacity-50',
                sede === s
                  ? 'border-accent bg-accent-soft font-semibold text-accent-soft-fg'
                  : 'border-line text-soft',
              ].join(' ')}
            >
              {NOMBRE_SEDE[s] ?? s}
            </button>
          ))}
        </div>
        {edicion && (
          <p className="mt-1 text-xs text-muted">
            La sede no se cambia: los estudiantes inscritos son de la sede en que nació el
            programa.
          </p>
        )}
      </div>

      <div className="mt-2">
        <p className="text-xs font-medium text-muted">Jornada</p>
        <div className="mt-1 flex flex-wrap gap-1.5">
          {OPCIONES_JORNADA.map((j) => (
            <button
              key={j.label}
              onClick={() => setJornada(j.valor)}
              className={[
                'rounded-full border px-3 py-1.5 text-sm',
                jornada === j.valor
                  ? 'border-accent bg-accent-soft font-semibold text-accent-soft-fg'
                  : 'border-line text-soft',
              ].join(' ')}
            >
              {j.label}
            </button>
          ))}
        </div>
      </div>

      <label className="mt-2 block text-xs text-muted">
        Correos de la coordinación (separados por coma)
        <input
          value={coordinadores}
          onChange={(e) => setCoordinadores(e.target.value)}
          placeholder="coordinadora@colegio.edu.co"
          className="mt-0.5 block w-full rounded-lg border border-line bg-elevated px-2 py-2 text-base text-strong"
        />
      </label>
      <p className="mt-1 text-xs text-muted">
        Quien coordina ve y administra los centros del programa entero, sin tener que
        estar agregado en cada uno. Usted queda siempre dentro de la lista.
      </p>
      {/*
        Aviso deliberado. La coordinación del programa SÍ puede leer las planillas de sus
        centros, y eso es correcto para quien lo administra. Pero el superusuario es una
        cuenta de administración con clave transferible: en el resto del módulo no lee
        ninguna planilla, a propósito. Si crea el programa y se queda dentro, se abre una
        excepción a esa regla sin que nadie lo haya decidido.
      */}
      <p className="mt-1 text-xs text-warning-soft-fg">
        Si está creando esto desde la cuenta de administración: cuando termine de cargar
        las listas, edite el programa y quite su correo, dejando el de quien lidera. La
        coordinación puede leer las planillas de sus centros, y esa cuenta no debería.
      </p>

      <label className="mt-3 flex items-start gap-2 text-sm text-strong">
        <input
          type="checkbox"
          checked={exclusivo}
          onChange={(e) => setExclusivo(e.target.checked)}
          className="mt-1"
        />
        <span>
          Cada estudiante en un solo centro
          <span className="block text-xs text-muted">
            Si aun así alguien queda en dos, no se le deja fuera de ninguno: aparece
            señalado en las dos planillas hasta que la coordinación decida.
          </span>
        </span>
      </label>

      {problemas.length > 0 && nombre.trim() !== '' && (
        <ul className="mt-3 list-disc space-y-0.5 rounded-lg border border-danger-soft bg-danger-soft p-2 pl-6 text-xs text-danger-soft-fg">
          {problemas.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      )}

      {error && (
        <div className="mt-3 rounded-lg border border-danger-soft bg-danger-soft p-2 text-sm text-danger-soft-fg">
          {error}
        </div>
      )}

      <button
        disabled={problemas.length > 0 || enviando || (!edicion && !idPropuesto)}
        onClick={() => void enviar()}
        className="mt-3 w-full rounded-lg bg-accent px-3 py-2 text-sm font-medium text-accent-fg disabled:opacity-50"
      >
        {enviando ? 'Guardando…' : edicion ? 'Guardar cambios' : 'Crear programa'}
      </button>
      <button
        onClick={onCerrar}
        className="mt-2 w-full rounded-lg border border-line p-2 text-sm text-soft"
      >
        Cancelar
      </button>

      {/*
        Dar de baja. Solo al editar, y con confirmación en dos pasos.

        Hace falta porque un programa creado por error —o el del semestre pasado— se
        queda para siempre estorbando en la lista de todos los líderes, y no había forma
        de quitarlo desde la aplicación. Es baja LÓGICA (`activo: false`), como todo en
        este módulo: los centros, las inscripciones y las planillas siguen ahí, solo deja
        de aparecer. Nada de lo registrado se pierde.
      */}
      {edicion && (
        <div className="mt-4 border-t border-line pt-3">
          {!confirmandoBaja ? (
            <button
              onClick={() => setConfirmandoBaja(true)}
              className="w-full rounded-lg border border-danger-soft p-2 text-sm text-danger-soft-fg"
            >
              Dar de baja este programa
            </button>
          ) : (
            <div className="rounded-lg border border-danger-soft bg-danger-soft p-3">
              <p className="text-sm text-danger-soft-fg">
                Deja de aparecer para todo el mundo. <b>No se borra nada</b>: los centros,
                los inscritos y las planillas quedan guardados y vuelven si se reactiva.
              </p>
              <div className="mt-2 flex gap-2">
                <button
                  disabled={enviando}
                  onClick={() => void darDeBaja()}
                  className="flex-1 rounded-lg bg-danger px-3 py-2 text-sm font-medium text-danger-fg disabled:opacity-50"
                >
                  {enviando ? 'Dando de baja…' : 'Sí, darlo de baja'}
                </button>
                <button
                  onClick={() => setConfirmandoBaja(false)}
                  className="flex-1 rounded-lg border border-line px-3 py-2 text-sm text-soft"
                >
                  No
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </Hoja>
  );
}

/**
 * Crear o editar un centro de interes.
 *
 * El lider queda SIEMPRE dentro de `docentes` —lo garantizan `crearGrupoPrograma` y
 * `editarGrupoPrograma`, y la regla lo exige—: la rama de docente de la lectura mira esa
 * lista, y un lider fuera de ella no podria ni abrir su propio centro.
 *
 * `miembros` NO se toca aqui. Inscribir y retirar va por su propia puerta (la pestaña
 * «Inscripción» de la planilla del centro), que escribe con `arrayUnion`/`arrayRemove`
 * en vez de reemplazar la inscripcion del semestre entera.
 */
function FormularioCentro({
  programaId,
  grupo,
  idsUsados,
  onGuardado,
  onCerrar,
}: {
  programaId: string;
  /** Presente = edición. Ausente = creación. */
  grupo?: GrupoPrograma;
  idsUsados: string[];
  onGuardado: (g: GrupoPrograma) => void;
  onCerrar: () => void;
}) {
  const edicion = Boolean(grupo);
  const [nombre, setNombre] = useState(grupo?.nombre ?? '');
  const [lider, setLider] = useState(grupo?.lider ?? '');
  const [apoyo, setApoyo] = useState(
    (grupo?.docentes ?? []).filter((d) => d !== grupo?.lider).join(', '),
  );
  const [cupo, setCupo] = useState(grupo?.cupo ? String(grupo.cupo) : '');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const correoLider = lider.trim().toLowerCase();
  const listaApoyo = apoyo
    .split(/[,;\s]+/)
    .map((c) => c.trim().toLowerCase())
    .filter(Boolean);

  const problemas: string[] = [];
  if (!nombre.trim()) problemas.push('El centro de interés necesita un nombre.');
  if (!correoLider) problemas.push('Falta el correo del docente que lidera el centro.');
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correoLider)) {
    problemas.push(`«${lider.trim()}» no parece un correo válido.`);
  }
  if (cupo.trim() !== '' && (!/^\d+$/.test(cupo.trim()) || Number(cupo) <= 0)) {
    problemas.push('El cupo debe ser un número entero mayor que cero, o quedar vacío.');
  }

  const idPropuesto = edicion
    ? grupo!.grupoId
    : nombre.trim()
      ? intentarSlug(() => slugGrupo(nombre, idsUsados))
      : '';

  async function enviar() {
    if (problemas.length > 0 || (!edicion && !idPropuesto)) return;
    setEnviando(true);
    setError(null);
    const docentes = [...new Set([correoLider, ...listaApoyo])];
    const numeroCupo = cupo.trim() === '' ? undefined : Number(cupo.trim());
    try {
      if (grupo) {
        await editarGrupoPrograma(programaId, grupo.grupoId, {
          nombre: nombre.trim(),
          lider: correoLider,
          docentes,
          ...(numeroCupo === undefined ? {} : { cupo: numeroCupo }),
        });
        onGuardado({
          ...grupo,
          nombre: nombre.trim(),
          lider: correoLider,
          docentes,
          ...(numeroCupo === undefined ? {} : { cupo: numeroCupo }),
        });
      } else {
        const nuevo = await crearGrupoPrograma({
          programaId,
          grupoId: idPropuesto,
          nombre: nombre.trim(),
          lider: correoLider,
          docentes,
          ...(numeroCupo === undefined ? {} : { cupo: numeroCupo }),
        });
        onGuardado(nuevo);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Hoja titulo={edicion ? 'Editar centro de interés' : 'Crear centro de interés'} onCerrar={onCerrar}>
      <label className="mt-2 block text-xs text-muted">
        Nombre
        <input
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          placeholder="Vibe Coding"
          className="mt-0.5 block w-full rounded-lg border border-line bg-elevated px-2 py-2 text-base text-strong"
        />
      </label>
      {idPropuesto && (
        <p className="mt-1 text-xs text-muted">
          Identificador: <b>{idPropuesto}</b>
          {edicion ? ' · no se puede cambiar: de él cuelgan todas las listas ya pasadas.' : ''}
        </p>
      )}

      <label className="mt-2 block text-xs text-muted">
        Correo del docente que lo lidera
        <input
          value={lider}
          onChange={(e) => setLider(e.target.value)}
          placeholder="docente@colegio.edu.co"
          className="mt-0.5 block w-full rounded-lg border border-line bg-elevated px-2 py-2 text-base text-strong"
        />
      </label>

      <label className="mt-2 block text-xs text-muted">
        Otros docentes de apoyo (separados por coma, opcional)
        <input
          value={apoyo}
          onChange={(e) => setApoyo(e.target.value)}
          placeholder="apoyo@colegio.edu.co"
          className="mt-0.5 block w-full rounded-lg border border-line bg-elevated px-2 py-2 text-base text-strong"
        />
      </label>
      <p className="mt-1 text-xs text-muted">
        El líder y los docentes de apoyo son los únicos que pueden abrir la planilla de
        este centro y registrar en ella, además de la coordinación del programa.
      </p>

      <label className="mt-2 block text-xs text-muted">
        Cupo (opcional)
        <input
          value={cupo}
          onChange={(e) => setCupo(e.target.value)}
          inputMode="numeric"
          placeholder="30"
          className="mt-0.5 block w-32 rounded-lg border border-line bg-elevated px-2 py-2 text-base text-strong"
        />
      </label>

      {problemas.length > 0 && nombre.trim() !== '' && (
        <ul className="mt-3 list-disc space-y-0.5 rounded-lg border border-danger-soft bg-danger-soft p-2 pl-6 text-xs text-danger-soft-fg">
          {problemas.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      )}

      {error && (
        <div className="mt-3 rounded-lg border border-danger-soft bg-danger-soft p-2 text-sm text-danger-soft-fg">
          {error}
        </div>
      )}

      <button
        disabled={problemas.length > 0 || enviando || (!edicion && !idPropuesto)}
        onClick={() => void enviar()}
        className="mt-3 w-full rounded-lg bg-accent px-3 py-2 text-sm font-medium text-accent-fg disabled:opacity-50"
      >
        {enviando ? 'Guardando…' : edicion ? 'Guardar cambios' : 'Crear centro'}
      </button>
      <button
        onClick={onCerrar}
        className="mt-2 w-full rounded-lg border border-line p-2 text-sm text-soft"
      >
        Cancelar
      </button>
    </Hoja>
  );
}

/**
 * Hoja modal — mismo patron que el formulario de `Eventos.tsx` y que los menus de
 * `Planilla.tsx`: abajo en movil, centrada en escritorio. No se inventa otro mecanismo
 * de superposicion solo porque esta muestra un formulario.
 */
function Hoja({
  titulo,
  children,
  onCerrar,
}: {
  titulo: string;
  children: ReactNode;
  onCerrar: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-end bg-black/40 p-0 sm:place-items-center sm:p-4"
      onClick={onCerrar}
    >
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-auto rounded-t-2xl border border-line bg-card p-4 sm:rounded-2xl"
        onClick={(ev) => ev.stopPropagation()}
      >
        <p className="text-lg font-semibold text-strong">{titulo}</p>
        {children}
      </div>
    </div>
  );
}

/**
 * `slugPrograma` y `slugGrupo` LANZAN si el nombre no tiene ni una letra ni un numero
 * («¿¿??»): mejor fallar que escribir un documento en una ruta vacia. Aqui eso no puede
 * reventar la pantalla mientras alguien escribe, asi que se traduce a "todavia no hay
 * identificador" y el boton de guardar se queda deshabilitado.
 */
function intentarSlug(fn: () => string): string {
  try {
    return fn();
  } catch {
    return '';
  }
}
