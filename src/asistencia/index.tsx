import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import Planilla, { CLASE_MARCA, SIGLA } from './Planilla';
import EscanerQr from './EscanerQr';
import VerificacionFoto from './VerificacionFoto';

/**
 * ⚠️ NO CONVERTIR EN IMPORT ESTATICO.
 *
 * `Importar` arrastra `exceljs` (~1 MB) para leer el archivo de Master2000. Cargado de
 * forma estatica, ese peso entra en el bundle principal de MJB y lo paga TODO el mundo
 * —incluidos los docentes que solo pasan lista desde el celular— aunque la importacion
 * la use el superusuario dos veces al ano.
 *
 * Esto ya se perdio dos veces al recopiar el archivo completo. Si vuelve a aparecer como
 * `import Importar from './Importar'` arriba, es una regresion: devolverlo aqui.
 */
const Importar = lazy(() => import('./Importar'));

/**
 * ⚠️ NO CONVERTIR EN IMPORT ESTATICO — mismo motivo que `Importar` arriba.
 *
 * `DireccionGrupo` arrastra `exceljs` para la descarga del cuaderno a Excel, y solo la
 * ve el director de cada grupo (una fraccion de los docentes, y solo en SU grupo). Cargar
 * ese peso de forma estatica lo pagaria tambien el docente que solo pasa lista.
 */
const DireccionGrupo = lazy(() => import('./DireccionGrupo'));
/**
 * Centros de interes. Va con lazy() como Importar y DireccionGrupo: por dentro arrastra
 * la carga desde Excel, y con ella exceljs, que no tiene por que pesar en el arranque de
 * quien solo va a pasar lista.
 */
const Programas = lazy(() => import('./Programas'));
import CargaFotos from './CargaFotos';
import DiagnosticoPermisos from './DiagnosticoPermisos';
import Ficha from './Ficha';
import PanelEstudiante from './PanelEstudiante';
import TerceraHora from './TerceraHora';
import LlegadasTarde from './LlegadasTarde';
import Eventos from './Eventos';
import MisGrupos from './MisGrupos';
import {
  abrirSesion,
  borrarSesionesDeCruce,
  buscarEstudiantes,
  buscarPorQrToken,
  cerrarSesion as cerrarSesionRemota,
  crearEstudianteManual,
  leerAlcanceUsuario,
  leerConfigAlertas,
  leerDirectores,
  leerGrupo,
  leerLlegadasTardePorGrado,
  llenarColumna,
  leerSesiones,
  marcarEstudiante,
  type AlcanceLectura,
  type ResumenBorradoCruce,
  leerCreadoresDeProgramas,
  guardarCreadoresDeProgramas,
} from './datos';
import type { NuevoEstudianteInput } from './Planilla';
import { toDateKey } from './domain/ids';
import { nombreCompleto } from './domain/nombres';
import { jornadaDeGrado } from './domain/ids';
import { ALERT_CONFIG_POR_DEFECTO } from './domain/alertas';
import { MARKS, findMark, type MarkCode } from './domain/marks';
import type { AlertConfig, Enrollment, LateArrival, Session, Student } from './domain/types';
import { firebaseConfigurado } from '../lib/firebase';
import { useAppStore } from '../data/store';
import { guardarColor, leerMapa, resolverColor, type MapaColores } from './domain/colores';
import Ayuda from './Ayuda';
import { ASIGNATURAS, getAsignatura } from '../data/asignacionAcademica';
import { exigirAutor } from './identidad';
import { observarSync, type EstadoSync } from './sincronizacion';
import type { StudentMark } from './domain/types';

/**
 * Navegacion interna del modulo. `eventos` esta disponible para cualquier rol que llegue
 * hasta aqui (coordinador o docente) porque cualquier docente puede crear un evento; las
 * otras tres pestanas quedan filtradas por rol dentro de `Pestanas`.
 */
type VistaAsistencia = 'planilla' | 'tercera_hora' | 'llegadas' | 'eventos' | 'programas';

/**
 * Componente raiz del modulo de asistencia. ESTE es el punto de pegado.
 *
 * Export default y sin props obligatorias, como pide el contrato. La navegacion interna
 * es estado local, nunca URLs.
 *
 * Sobre el alcance de las consultas: NO es una preferencia. Firestore rechaza la
 * consulta entera si no puede probar que todo el resultado sera legible, asi que un
 * docente tiene que consultar por su `slotId` y un coordinador puede ir sin acotar
 * (dentro de las sedes que le tocan). Una consulta sin filtrar falla con
 * permission-denied aunque el usuario tuviera derecho a cada documento por separado.
 */
export default function Asistencia() {
  const rol = useAppStore((s) => s.rol);
  const slotId = useAppStore((s) => s.userId);
  const sede = useAppStore((s) => s.sedeActual);

  /**
   * Que le toca leer a esta cuenta segun los documentos espejo `consultaAmpliada` y
   * `autoridadSede` (ver datos.ts). Se carga junto a la config de alertas: ninguna de
   * las dos depende del cruce elegido, solo de quien entro.
   */
  const [alcanceUsuario, setAlcanceUsuario] = useState<{
    soloConsulta: boolean;
    jornadaLimitada: 'manana' | 'tarde' | null;
  }>({ soloConsulta: false, jornadaLimitada: null });
  useEffect(() => {
    if (!firebaseConfigurado) return;
    void leerAlcanceUsuario(sede).then(setAlcanceUsuario);
    // Depende de la sede: la restriccion de jornada es del par sede+coordinador, no de
    // la persona, asi que al cambiar de sede hay que volver a resolverla.
  }, [sede]);

  // La rectora, el superusuario y los cargos de apoyo (consulta ampliada) consultan pero
  // no registran. El servidor ya lo impide; esto solo evita ofrecer botones que
  // fallarian. Decision de Julian (2026-08-12): "solo de consulta; esa es tarea de los
  // coordinadores" — no editan, no marcan y no abren sesiones.
  const puedeRegistrar =
    rol !== 'rectora' && rol !== 'superusuario' && !alcanceUsuario.soloConsulta;

  const alcance: AlcanceLectura = useMemo(() => {
    // Rectora y cargos de apoyo no dictan clase: filtrarlos como docente (por slotId, que
    // ni siquiera tienen) o como coordinador (por sede sin mas) no refleja lo que la
    // regla les permite — leer TODA la sede, sin acotar por puesto.
    if (rol === 'rectora' || alcanceUsuario.soloConsulta) return { tipo: 'consulta', sede };
    if (rol === 'coordinador') {
      return { tipo: 'coordinador', sede, jornada: alcanceUsuario.jornadaLimitada ?? undefined };
    }
    return { tipo: 'docente', slotId: slotId ?? '' };
  }, [rol, slotId, sede, alcanceUsuario]);

  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sesiones, setSesiones] = useState<Session[]>([]);
  const [estudiantes, setEstudiantes] = useState<Student[]>([]);
  const [matriculas, setMatriculas] = useState<Enrollment[]>([]);
  const [cruce, setCruce] = useState<{ grado: string; subjectId: string } | null>(null);
  /** Navegacion interna: por estado, nunca por URL (contrato, seccion 6). */
  const [fichaAbierta, setFichaAbierta] = useState<string | null>(null);
  const [directores, setDirectores] = useState<Record<string, string>>({});
  const [vista, setVista] = useState<VistaAsistencia>('planilla');

  /**
   * Cruce grado+asignatura ya elegido (desde "Mis grupos" o desde "nueva sesión" sobre
   * el cruce activo) que solo le falta el BLOQUE para convertirse en una sesión. Separado
   * de `cruce`: este es un cruce todavía sin sesión de hoy, `cruce` es el que ya tiene
   * planilla abierta.
   */
  const [bloqueParaAbrir, setBloqueParaAbrir] = useState<{ grado: string; subjectId: string } | null>(
    null,
  );
  /** Formulario manual de respaldo: docentes de apoyo, o asignación aún no cargada. */
  const [formularioManual, setFormularioManual] = useState(false);

  /**
   * Sesión en la que se está escaneando (elegida en `Planilla.tsx`, que resuelve la
   * ambigüedad de qué columna es "hoy"). Se mantiene aunque se cierre la cámara para
   * mostrar la tarjeta de verificación, porque hace falta para volver a marcar.
   */
  const [escaneandoSessionId, setEscaneandoSessionId] = useState<string | null>(null);
  /** Estudiante identificado por QR, pendiente de que la persona confirme con foto. */
  const [candidatoQr, setCandidatoQr] = useState<Student | null>(null);
  /** Avisos del flujo de escaneo (código no reconocido, otra sede, marcado). Aparte de
   * `error`: la cámara cubre toda la pantalla y este aviso tiene que verse por encima. */
  const [avisoQr, setAvisoQr] = useState<string | null>(null);

  /** Panel de estadísticas de un estudiante (pastilla de la columna "Faltas"). */
  const [panelAbierto, setPanelAbierto] = useState<string | null>(null);
  /** Sesiones de TODAS las asignaturas del grado, agrupadas por subjectId. Solo llega
   * más de una clave si el usuario dirige el grupo (ver efecto más abajo). */
  const [sesionesPorAsignatura, setSesionesPorAsignatura] = useState<Record<string, Session[]>>({});
  /** Llegadas tarde a la institución del grado. Vacío si el usuario no dirige el grupo:
   * es autoridad de coordinación y el director de grupo, nadie más. */
  const [llegadasTarde, setLlegadasTarde] = useState<LateArrival[]>([]);

  // Preferencia visual del dispositivo, no un dato del colegio: se lee una sola vez del
  // almacen local (ver domain/colores.ts) y de ahi en adelante vive en memoria.
  const [mapaColores, setMapaColores] = useState<MapaColores>(() => leerMapa());

  /** Estado de envio de las marcas: sin conexion, cuantas van pendientes de acuse del
   *  servidor, y el ultimo rechazo si lo hubo. Ver sincronizacion.ts. */
  const [sync, setSync] = useState<EstadoSync>({ enLinea: true, pendientes: 0, ultimoError: null });
  useEffect(() => observarSync(setSync), []);

  /**
   * Umbrales de alerta (`asistenciaConfig/alertas`). Cualquier cuenta activa puede
   * leerlos (incluido el superusuario, aunque no los use), asi que se carga aparte de
   * `cargarSesiones` y sin filtrar por rol.
   */
  const [alertConfig, setAlertConfig] = useState<AlertConfig>(ALERT_CONFIG_POR_DEFECTO);
  useEffect(() => {
    if (!firebaseConfigurado) return;
    void leerConfigAlertas().then(setAlertConfig);
  }, []);

  /** Cruces (grado + asignatura) que aparecen en las sesiones del usuario. */
  const cruces = useMemo(() => {
    const vistos = new Map<string, { grado: string; subjectId: string }>();
    for (const s of sesiones) vistos.set(`${s.grado}|${s.subjectId}`, { grado: s.grado, subjectId: s.subjectId });
    return [...vistos.values()].sort((a, b) => a.grado.localeCompare(b.grado));
  }, [sesiones]);

  const cargarSesiones = useCallback(async () => {
    setError(null);
    try {
      const lista = await leerSesiones(alcance);
      setSesiones(lista);
      // NO se elige un cruce automaticamente. La puerta de entrada es "Mis grupos": el
      // docente escoge, igual que abre un cuaderno. Antes se caia directo en la planilla
      // del primer grupo que devolviera la consulta, que no es ni el de la clase actual
      // ni ninguno en particular — solo el primero.
    } catch (e) {
      setError(mensajeDeError(e));
    } finally {
      setCargando(false);
    }
  }, [alcance]);

  useEffect(() => {
    // El superusuario no lee sesiones: la regla se lo deniega siempre. Pedirlas igual
    // solo produciria un permission-denied inutil en cada visita.
    if (!firebaseConfigurado || rol === 'superusuario') {
      setCargando(false);
      return;
    }
    void cargarSesiones();
    void leerDirectores().then(setDirectores);
  }, [cargarSesiones, rol]);

  // El grupo se carga aparte: depende del grado elegido, no de las sesiones.
  useEffect(() => {
    if (!cruce) return;
    void (async () => {
      try {
        const { estudiantes: al, matriculas: mat } = await leerGrupo(cruce.grado);
        setEstudiantes(al);
        setMatriculas(mat);
      } catch (e) {
        setError(mensajeDeError(e));
      }
    })();
  }, [cruce?.grado]);

  const sesionesDelCruce = useMemo(
    () =>
      cruce
        ? sesiones.filter((s) => s.grado === cruce.grado && s.subjectId === cruce.subjectId)
        : [],
    [sesiones, cruce],
  );

  // El usuario dirige el grupo si su slotId coincide con el director de ese grado en el
  // documento espejo que consultan las reglas.
  const esDirector = useMemo(
    () => !!cruce && directores[cruce.grado] === slotId,
    [cruce, directores, slotId],
  );

  // Grados de los que esta cuenta puede subir fotos, para pasarselos a `CargaFotos` como
  // `gradosPermitidos`. El director solo el suyo (puede dirigir mas de un grado); el
  // coordinador, los que aparezcan en las sesiones que ya puede leer (`cruces`). La
  // autoridad real la decide el espejo `asistenciaConfig/directores.fotos` que evaluan
  // las reglas de Storage — esto solo evita ofrecer una carpeta que el servidor va a
  // rechazar.
  const gradosDirector = useMemo(
    () => Object.entries(directores).filter(([, s]) => s === slotId).map(([g]) => g),
    [directores, slotId],
  );
  const gradosCoordinador = useMemo(
    () => [...new Set(cruces.map((c) => c.grado))],
    [cruces],
  );
  const mostrarFotos = esDirector || rol === 'coordinador';
  const gradosPermitidosFotos = rol === 'coordinador' ? gradosCoordinador : gradosDirector;

  // Sub-pestaña dentro de un grupo: asistencia, el cuaderno de dirección o la carga de
  // fotos. Vuelve a "asistencia" al cambiar de grado, para no dejar abierto por accidente
  // el cuaderno o la carga de fotos de un grupo que ya no es este.
  const [vistaGrupo, setVistaGrupo] = useState<'asistencia' | 'direccion' | 'fotos'>('asistencia');
  useEffect(() => {
    setVistaGrupo('asistencia');
  }, [cruce?.grado]);

  /**
   * Insumos del panel de estudiante: sesiones de las demás asignaturas y llegadas tarde.
   *
   * SOLO se piden si el usuario dirige el grupo. Si no, pedir las sesiones de otra
   * asignatura haría que el servidor rechace la consulta ENTERA (la regla de sesiones
   * solo deja pasar `slotId == propio` o `grado == el que dirige`), y no hay que ofrecer
   * en el panel datos que se sabe de antemano que van a fallar.
   *
   * Envuelto en try/catch por separado: el panel es un extra, la planilla es el trabajo.
   * Si esto falla, la planilla debe seguir funcionando con lo que ya tenía.
   */
  useEffect(() => {
    if (!cruce) {
      setSesionesPorAsignatura({});
      setLlegadasTarde([]);
      return;
    }
    if (!esDirector) {
      setSesionesPorAsignatura({ [cruce.subjectId]: sesionesDelCruce });
      setLlegadasTarde([]);
      return;
    }
    let vivo = true;
    void (async () => {
      let todasLasDelGrado: Session[] = sesionesDelCruce;
      try {
        todasLasDelGrado = await leerSesiones({ tipo: 'director', grado: cruce.grado });
        if (!vivo) return;
        const agrupadas: Record<string, Session[]> = {};
        for (const s of todasLasDelGrado) {
          (agrupadas[s.subjectId] ??= []).push(s);
        }
        setSesionesPorAsignatura(agrupadas);
      } catch {
        if (!vivo) return;
        setSesionesPorAsignatura({ [cruce.subjectId]: sesionesDelCruce });
      }
      try {
        // Periodo visible: el que cubren las sesiones ya cargadas del grado. Sin
        // sesiones aún no hay nada que acotar; se usa hoy como rango minimo.
        const fechas = todasLasDelGrado.map((s) => s.fecha);
        const hoy = toDateKey(new Date());
        const desde = fechas.length ? fechas.reduce((a, b) => (a < b ? a : b)) : hoy;
        const hasta = fechas.length ? fechas.reduce((a, b) => (a > b ? a : b)) : hoy;
        const llegadas = await leerLlegadasTardePorGrado({ grado: cruce.grado, desde, hasta });
        if (vivo) setLlegadasTarde(llegadas);
      } catch {
        if (vivo) setLlegadasTarde([]);
      }
    })();
    return () => {
      vivo = false;
    };
  }, [cruce, esDirector, sesionesDelCruce]);

  /**
   * Marca optimista: la casilla se pinta en el acto, ANTES de que el servidor confirme
   * nada. `marcarEstudiante` ya no espera el acuse (ver datos.ts), así que si aquí se
   * esperara igual el resultado la pantalla se quedaría muerta sin señal — se aplica el
   * cambio local y se deja que la escritura viaje sola.
   */
  async function marcar(sessionIdDoc: string, studentId: string, estado: MarkCode) {
    setError(null);
    let autor: string;
    try {
      autor = await exigirAutor();
    } catch (e) {
      setError(mensajeDeError(e));
      return;
    }
    setSesiones((prev) =>
      prev.map((s) => {
        if (s.sessionId !== sessionIdDoc) return s;
        const previa = s.estudiantes[studentId];
        const marca: StudentMark = {
          estado,
          motivo: null,
          observacion: null,
          // La autoría original (registradoPor/registradoEn) es inmutable una vez
          // puesta; solo se guarda quién y cuándo corrigió, igual que en el servidor.
          registradoPor: previa?.registradoPor ?? autor,
          registradoEn: previa?.registradoEn ?? Date.now(),
          modificadoPor: previa ? autor : null,
          modificadoEn: previa ? Date.now() : null,
        };
        return { ...s, estudiantes: { ...s.estudiantes, [studentId]: marca } };
      }),
    );
    try {
      await marcarEstudiante(sessionIdDoc, studentId, estado);
    } catch (e) {
      setError(mensajeDeError(e));
    }
  }

  /** Abre el escáner para la sesión que `Planilla.tsx` ya resolvió. */
  function iniciarEscaneo(sessionId: string) {
    setError(null);
    setAvisoQr(null);
    setCandidatoQr(null);
    setEscaneandoSessionId(sessionId);
  }

  function cerrarEscaneoQr() {
    setEscaneandoSessionId(null);
    setCandidatoQr(null);
    setAvisoQr(null);
  }

  /**
   * Al leer un QR NO se registra automáticamente: se muestra al estudiante con su foto
   * (mismo control de identidad que EscanerQr usa en LlegadasTarde.tsx y PlanillaEvento.tsx)
   * y la persona confirma tocando la marca. Sin esa pausa se registra a quien no es.
   */
  async function leerQr(texto: string) {
    if (!escaneandoSessionId) return;
    setAvisoQr(null);
    setError(null);
    try {
      const { estudiante, otraSede } = await buscarPorQrToken(sede, texto);
      if (!estudiante) {
        setAvisoQr(
          otraSede
            ? 'Ese código pertenece a un estudiante de otra sede.'
            : 'Código no reconocido. Puede marcar desde la lista de la planilla.',
        );
        return;
      }
      // No pertenece al grupo de ESTA planilla: se dice con su nombre y no se ofrece
      // marcarlo. Se comprueba contra `estudiantes`, la lista ya cargada del cruce
      // abierto, no contra la sede entera.
      if (!estudiantes.some((e) => e.studentId === estudiante.studentId)) {
        setEscaneandoSessionId(null);
        setAvisoQr(`${nombreCompleto(estudiante)} no pertenece a este grupo.`);
        return;
      }
      setCandidatoQr(estudiante);
    } catch (e) {
      setError(mensajeDeError(e));
    }
  }

  async function marcarDesdeQr(estado: MarkCode) {
    if (!candidatoQr || !escaneandoSessionId) return;
    const nombre = nombreCompleto(candidatoQr);
    await marcar(escaneandoSessionId, candidatoQr.studentId, estado);
    setAvisoQr(`${nombre} — marcado.`);
    // Se vuelve a mostrar el escáner (no se cierra `escaneandoSessionId`) para encadenar
    // el siguiente estudiante sin volver a tocar el botón de la planilla.
    setCandidatoQr(null);
  }

  /**
   * Llenado por defecto de una columna. Solo toca las casillas vacías, y las pinta de
   * una vez en el estado local — mismo motivo que `marcar`: no hay que esperar al
   * servidor para ver el resultado, y sin red ese llenado de 33 casillas tendría que
   * verse igual de inmediato.
   */
  async function llenar(sessionIdDoc: string, estado: MarkCode) {
    setError(null);
    const sesion = sesiones.find((s) => s.sessionId === sessionIdDoc);
    if (!sesion) return;
    let autor: string;
    try {
      autor = await exigirAutor();
    } catch (e) {
      setError(mensajeDeError(e));
      return;
    }
    const ids = estudiantes.map((e) => e.studentId);
    const vacios = ids.filter((id) => !sesion.estudiantes[id]);
    if (vacios.length === 0) return;
    setSesiones((prev) =>
      prev.map((s) => {
        if (s.sessionId !== sessionIdDoc) return s;
        const nuevoMapa = { ...s.estudiantes };
        for (const id of vacios) {
          nuevoMapa[id] = {
            estado,
            motivo: null,
            observacion: null,
            registradoPor: autor,
            registradoEn: Date.now(),
            modificadoPor: null,
            modificadoEn: null,
          };
        }
        return { ...s, estudiantes: nuevoMapa };
      }),
    );
    try {
      await llenarColumna(sessionIdDoc, ids, estado, sesion.estudiantes);
    } catch (e) {
      setError(mensajeDeError(e));
    }
  }

  async function cerrar(sessionIdDoc: string, sinRegistrar: number) {
    const ok = window.confirm(
      sinRegistrar > 0
        ? `Quedan ${sinRegistrar} casillas SIN REGISTRAR. Al cerrar NO se convierten en ` +
          'ausencias: siguen contando como sin registrar.\n\n¿Cerrar de todos modos?'
        : '¿Cerrar la sesión de clase?',
    );
    if (!ok) return;
    setError(null);
    try {
      await cerrarSesionRemota(sessionIdDoc);
      await cargarSesiones();
    } catch (e) {
      setError(mensajeDeError(e));
    }
  }

  /**
   * Alta de un estudiante que no vino de Master2000. `crearEstudianteManual` puede
   * rechazar la creación (documento ya registrado en otra ficha); se deja propagar el
   * error para que el modal de Planilla lo muestre tal cual, con el nombre de quién ya
   * existe.
   */
  async function agregarEstudiante(input: NuevoEstudianteInput) {
    if (!cruce) return;
    await crearEstudianteManual({ ...input, grado: cruce.grado, sede });
    const { estudiantes: al, matriculas: mat } = await leerGrupo(cruce.grado);
    setEstudiantes(al);
    setMatriculas(mat);
  }

  // Reemplaza al `window.prompt` de antes: en una pantalla que se usa de pie, un prompt
  // de numeros es lento y facil de teclear mal (mismo cambio ya hecho en
  // LlegadasTarde.tsx). Solo PIDE el bloque; quien crea la sesion es `abrirCruce`.
  function nuevaSesion() {
    if (!cruce) return;
    setBloqueParaAbrir({ grado: cruce.grado, subjectId: cruce.subjectId });
  }

  /**
   * Crea la sesion de hoy para un cruce grado+asignatura ya elegido. Punto unico: lo usan
   * "Mis grupos" (primera sesion o grupo nuevo), "nueva sesion" sobre el cruce activo, y
   * el formulario manual de respaldo — los tres terminan aqui para no triplicar el
   * try/catch ni el calculo de jornada/fecha.
   */
  const abrirCruce = useCallback(
    async (grado: string, subjectId: string, bloque: number) => {
      setError(null);
      try {
        await abrirSesion({
          sede,
          grado,
          jornada: jornadaDeGrado(grado),
          fecha: toDateKey(new Date()),
          bloque,
          subjectId,
          slotId: slotId ?? '',
        });
        setCruce({ grado, subjectId });
        await cargarSesiones();
      } catch (e) {
        setError(mensajeDeError(e));
      }
    },
    [sede, slotId, cargarSesiones],
  );

  if (!firebaseConfigurado) {
    return (
      <p className="rounded-xl border border-warning-soft bg-warning-soft p-3 text-sm text-warning-soft-fg">
        Firebase no está configurado en esta instalación, así que el módulo de asistencia
        no puede cargar datos.
      </p>
    );
  }

  // El superusuario no registra asistencia (su clave es transferible) ni lee el detalle
  // de las sesiones: las reglas se lo impiden. Lo suyo es cargar los datos base.
  //
  // Pero SI puede ver fichas: `asistenciaStudents` se lee con `isActiveUser()`. Antes
  // esta pantalla era solo el importador, y el resultado era absurdo — quien carga dos
  // mil estudiantes no podia mirar ni uno para comprobar que quedaron bien. Tambien
  // dejaba sin forma de probar los permisos de fotografia con una cuenta distinta a la
  // del docente, que es lo que hizo falta al depurar.
  if (rol === 'superusuario') {
    if (fichaAbierta) {
      return (
        <Ficha
          studentId={fichaAbierta}
          rol={rol}
          slotId={slotId}
          directores={directores}
          onVolver={() => setFichaAbierta(null)}
        />
      );
    }
    return (
      <div className="space-y-4">
        <Suspense fallback={<p className="p-3 text-sm text-muted">Cargando importación…</p>}>
          <Importar />
        </Suspense>
        {/*
          CENTROS DE INTERES AQUI, y no en las pestañas.
          El superusuario NUNCA llega a la barra de pestañas: el `return` de arriba corta
          antes. Por eso el 2026-08-25 nadie pudo crear el primer programa — el único a
          quien la regla se lo permitía era el único sin pantalla para hacerlo. Este panel
          es el sitio que le corresponde: existe para sembrar los datos base (estudiantes,
          fotos), y crear el programa del semestre y subir las 21 listas es lo mismo, dos
          veces al año.

          Después de sembrarlo el superusuario desaparece de la operación: la coordinación
          del programa administra y cada líder pasa su lista.
        */}
        <Suspense
          fallback={<p className="p-3 text-sm text-muted">Cargando centros de interés…</p>}
        >
          <Programas puedeRegistrar={false} puedeCrearPrograma />
        </Suspense>
        <BuscadorFichas sede={sede} onAbrir={setFichaAbierta} />
        <DiagnosticoPermisos />
        <CreadoresDeProgramas />
        <CargaFotos />
        <LimpiezaPlanillas />
      </div>
    );
  }

  if (cargando) return <p className="p-3 text-sm text-muted">Cargando asistencia…</p>;

  if (fichaAbierta) {
    // Editar la ficha lo decide el servidor: director del grupo, coordinacion o
    // superusuario. Aqui solo se evita ofrecer botones que fallarian.
    return (
      <Ficha
        studentId={fichaAbierta}
        rol={rol}
        slotId={slotId}
        directores={directores}
        onVolver={() => setFichaAbierta(null)}
      />
    );
  }

  // El reporte de tercera hora es del coordinador: lee sesiones de todos los grados de
  // su sede, y las reglas solo se lo permiten a el.
  if (rol === 'coordinador' && vista === 'tercera_hora') {
    return (
      <div className="space-y-3">
        <Pestanas vista={vista} onCambiar={setVista} rol={rol} />
        <TerceraHora sede={sede} />
      </div>
    );
  }

  // Las llegadas tarde a la institucion son autoridad exclusiva del coordinador.
  if (rol === 'coordinador' && vista === 'llegadas') {
    return (
      <div className="space-y-3">
        <Pestanas vista={vista} onCambiar={setVista} rol={rol} />
        <LlegadasTarde sede={sede} />
      </div>
    );
  }

  // Eventos es para cualquier docente, no solo coordinacion: por eso NO va detras de un
  // `rol === 'coordinador'` como las dos pestanas anteriores.
  if (vista === 'programas') {
    return (
      <div className="space-y-3">
        <Pestanas vista={vista} onCambiar={setVista} rol={rol} />
        {/* La autoridad la resuelve la propia pantalla leyendo `coordinadores` del
            programa: el lider ve su centro y nada mas, la coordinacion ve los veintiuno.
            `puedeRegistrar` solo decide si se ofrece marcar asistencia, igual que en
            Eventos — y NO es lo mismo que coordinar: Yuri tiene `asistenciaConsulta` y
            aun asi coordina el programa. */}
        <Suspense fallback={<p className="p-3 text-sm text-muted">Cargando centros de interés…</p>}>
          <Programas
            puedeRegistrar={puedeRegistrar}
            // Espeja la regla `allow create` del programa: isSuper() o coordinador de
            // sede. NO es `puedeRegistrar` — el superusuario no marca asistencia y aun
            // asi es el unico que puede crear el primero.
            puedeCrearPrograma={rol === 'superusuario' || rol === 'coordinador'}
            // Consulta sin administrar. Espeja `asisConsultaDelPrograma()` de las reglas.
            //
            // `total` = rectora y cargos de apoyo (PTA, apoyo): todo el colegio, las dos
            // jornadas. Decision de Julian (2026-08-25): su trabajo es de sexto a once, no
            // de una jornada, asi que la restriccion por jornada NO les aplica.
            // `coordinador` = solo su sede, y solo su jornada si el programa la declara.
            rolConsulta={
              rol === 'rectora' || alcanceUsuario.soloConsulta
                ? 'total'
                : rol === 'coordinador'
                  ? 'coordinador'
                  : null
            }
            jornadaLimitada={alcanceUsuario.jornadaLimitada ?? null}
          />
        </Suspense>
      </div>
    );
  }

  if (vista === 'eventos') {
    return (
      <div className="space-y-3">
        <Pestanas vista={vista} onCambiar={setVista} rol={rol} />
        {/* La rectora consulta pero no registra: puede entrar a un evento que le hayan
            compartido, pero no crearlo ni marcar. El servidor ya lo impide
            (`asisCanRecord`); esto solo evita ofrecerle botones que fallarian. */}
        <Eventos sede={sede} puedeRegistrar={puedeRegistrar} />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <Pestanas vista={vista} onCambiar={setVista} rol={rol} />

      <IndicadorSync sync={sync} />

      {error && (
        <div className="rounded-xl border border-danger-soft bg-danger-soft p-3 text-sm text-danger-soft-fg">
          {error}
        </div>
      )}

      {/*
        Sin cruce elegido, la pantalla es "Mis grupos". Antes habia una fila de pastillas
        con TODOS los cruces donde el docente hubiera pasado lista alguna vez, y crecia
        sola sin poder quitarse: no eran una preferencia, eran el reflejo de donde habia
        sesiones. Tenia sentido cuando el sistema no sabia que grupos dictaba cada quien y
        tenia que deducirlos de lo registrado; con la asignacion academica cargada, sobran.
      */}
      {!cruce ? (
        <MisGrupos
          slotId={slotId}
          extras={cruces}
          // Todos los grados que le TOCAN, no solo los que ya tienen planilla. Sin esto,
          // un cargo de apoyo solo ve los grupos donde alguien ya paso lista — y los que
          // NO aparecen son precisamente los que tiene que ir a buscar.
          //
          // Se acota por jornada cuando la cuenta esta limitada a una: en la sede central
          // hay dos coordinadores, uno por jornada, y `leerEstudiantesDeSede` trae la
          // sede COMPLETA sin filtrar. Sin este recorte, al coordinador de la manana le
          // saldrian los diez grupos de la tarde como "sin asistencia registrada" — trece
          // grupos que no son asunto suyo, presentados como si tuviera que perseguirlos.
          todosLosGrados={[
            ...new Set(
              estudiantes
                .filter((e) => e.activo)
                .map((e) => e.gradoActual)
                .filter(
                  (g) =>
                    !alcanceUsuario.jornadaLimitada ||
                    jornadaDeGrado(g) === alcanceUsuario.jornadaLimitada,
                ),
            ),
          ]}
          perfil={
            rol === 'rectora' || alcanceUsuario.soloConsulta
              ? 'consulta'
              : rol === 'coordinador'
                ? 'coordinacion'
                : 'docente'
          }
          onElegir={(grado, subjectId) => {
            const yaTieneSesiones = cruces.some(
              (c) => c.grado === grado && c.subjectId === subjectId,
            );
            // Si ya hay planilla, se abre y punto. Si es la primera vez de este grupo,
            // hay que saber en que bloque es la clase antes de crear la sesion.
            if (yaTieneSesiones) setCruce({ grado, subjectId });
            else if (puedeRegistrar) setBloqueParaAbrir({ grado, subjectId });
            else setCruce({ grado, subjectId });
          }}
          onSinAsignacion={() => setFormularioManual(true)}
        />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setCruce(null)}
              className="min-h-[36px] text-sm text-accent"
            >
              ← Mis grupos
            </button>

            {/* El director ve el cuaderno paralelo Y la carga de fotos, en los demas
                grupos que dicta no se ofrece ninguna de las dos. El coordinador solo ve
                Fotos: el cuaderno de direccion es autoridad exclusiva del director. */}
            {mostrarFotos && (
              <div className="flex gap-1.5">
                <Ayuda texto="Pasar lista de la asignatura: la asistencia de cada clase.">
                  <button
                    onClick={() => setVistaGrupo('asistencia')}
                    className={[
                      'min-h-[36px] rounded-full border px-3 py-1 text-sm',
                      vistaGrupo === 'asistencia'
                        ? 'border-accent bg-accent-soft font-semibold text-accent-soft-fg'
                        : 'border-line text-soft',
                    ].join(' ')}
                  >
                    Asistencia
                  </button>
                </Ayuda>
                {esDirector && (
                  <Ayuda texto="El cuaderno paralelo del director: cuotas, equipos de aseo, requisitos — columnas que usted define. No es asistencia y no se cruza con ella.">
                    <button
                      onClick={() => setVistaGrupo('direccion')}
                      className={[
                        'min-h-[36px] rounded-full border px-3 py-1 text-sm',
                        vistaGrupo === 'direccion'
                          ? 'border-accent bg-accent-soft font-semibold text-accent-soft-fg'
                          : 'border-line text-soft',
                      ].join(' ')}
                    >
                      Dirección de grupo
                    </button>
                  </Ayuda>
                )}
                <Ayuda texto="Subir las fotografías de los estudiantes de este grupo: la foto es el control de identidad al escanear el QR.">
                  <button
                    onClick={() => setVistaGrupo('fotos')}
                    className={[
                      'min-h-[36px] rounded-full border px-3 py-1 text-sm',
                      vistaGrupo === 'fotos'
                        ? 'border-accent bg-accent-soft font-semibold text-accent-soft-fg'
                        : 'border-line text-soft',
                    ].join(' ')}
                  >
                    Fotos
                  </button>
                </Ayuda>
              </div>
            )}
          </div>

          {cruce && esDirector && vistaGrupo === 'direccion' ? (
            <Suspense fallback={<p className="p-3 text-sm text-muted">Cargando…</p>}>
              <DireccionGrupo
                grado={cruce.grado}
                anio={new Date().getFullYear()}
                estudiantes={estudiantes}
              />
            </Suspense>
          ) : cruce && mostrarFotos && vistaGrupo === 'fotos' ? (
            <CargaFotos gradosPermitidos={gradosPermitidosFotos} />
          ) : (
            cruce && (
              <Planilla
                grado={cruce.grado}
                asignatura={cruce.subjectId}
                estudiantes={estudiantes}
                sesiones={sesionesDelCruce}
                matriculas={matriculas}
                llegadasTarde={llegadasTarde}
                puedeRegistrar={puedeRegistrar}
                onMarcar={marcar}
                onCerrarSesion={cerrar}
                onAbrirFicha={setFichaAbierta}
                onAbrirPanel={setPanelAbierto}
                onLlenarColumna={llenar}
                onNuevaSesion={nuevaSesion}
                onEscanear={iniciarEscaneo}
                color={resolverColor(mapaColores, cruce.grado, cruce.subjectId)}
                onElegirColor={(colorId) =>
                  setMapaColores((m) => guardarColor(m, cruce.grado, cruce.subjectId, colorId))
                }
                alertConfig={alertConfig}
                puedeAgregarEstudiante={esDirector || rol === 'coordinador'}
                onAgregarEstudiante={agregarEstudiante}
              />
            )
          )}
        </>
      )}

      {bloqueParaAbrir && (
        <MenuBloque
          grado={bloqueParaAbrir.grado}
          subjectId={bloqueParaAbrir.subjectId}
          onElegir={(bloque) => {
            const p = bloqueParaAbrir;
            setBloqueParaAbrir(null);
            void abrirCruce(p.grado, p.subjectId, bloque);
          }}
          onCerrar={() => setBloqueParaAbrir(null)}
        />
      )}

      {formularioManual && (
        <FormularioManual
          onAbrir={async (grado, subjectId, bloque) => {
            setFormularioManual(false);
            await abrirCruce(grado, subjectId, bloque);
          }}
          onCerrar={() => setFormularioManual(false)}
        />
      )}

      {panelAbierto && cruce && estudiantes.find((e) => e.studentId === panelAbierto) && (
        <PanelEstudiante
          estudiante={estudiantes.find((e) => e.studentId === panelAbierto)!}
          asignaturaActual={cruce.subjectId}
          sesionesPorAsignatura={sesionesPorAsignatura}
          matriculas={matriculas}
          llegadasTarde={llegadasTarde}
          alertConfig={alertConfig}
          onCerrar={() => setPanelAbierto(null)}
        />
      )}

      {/* La cámara cubre toda la pantalla (EscanerQr es `fixed inset-0 z-50`): el aviso
          tiene que ir por encima o desaparece detrás de ella mientras se escanea. */}
      {avisoQr && (
        <div className="fixed inset-x-3 top-16 z-[60] rounded-xl border border-info-soft bg-info-soft p-3 text-center text-sm text-info-soft-fg shadow-lg">
          {avisoQr}
        </div>
      )}

      {/* El escáner NO se desmonta al aparecer la tarjeta de verificación: se PAUSA.
          Desmontarlo obligaba a tocar "Activar cámara" otra vez con cada estudiante —
          treinta y tres veces en un curso—, porque iOS exige un gesto explícito para
          encender la cámara y el componente arrancaba de cero cada vez. */}
      {escaneandoSessionId && (
        <EscanerQr
          onLeer={(t) => void leerQr(t)}
          onCerrar={cerrarEscaneoQr}
          pausado={candidatoQr !== null}
        />
      )}

      {candidatoQr && escaneandoSessionId && (
        <div
          className="fixed inset-0 z-[55] grid place-items-end bg-black/40 p-0 sm:place-items-center sm:p-4"
          onClick={cerrarEscaneoQr}
        >
          <div
            className="w-full max-w-md rounded-t-2xl border border-line bg-card p-4 sm:rounded-2xl"
            onClick={(ev) => ev.stopPropagation()}
          >
            {(() => {
              const marcaPrevia = sesionesDelCruce.find((s) => s.sessionId === escaneandoSessionId)
                ?.estudiantes?.[candidatoQr.studentId];
              // Si ya tenía marca, se dice ANTES de que la persona toque nada: va a
              // corregir, no a registrar por primera vez.
              return (
                marcaPrevia && (
                  <p className="mb-2 text-xs text-warning-soft-fg">
                    Ya estaba marcado como{' '}
                    {findMark(marcaPrevia.estado)?.label ?? marcaPrevia.estado}.
                  </p>
                )
              );
            })()}
            <ul>
              <VerificacionFoto
                estudiante={candidatoQr}
                tamano={110}
                acciones={<BotonesMarcaQr onElegir={(m) => void marcarDesdeQr(m)} />}
              />
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Fila de marcas para la tarjeta de verificación del escáner. "Asistencia" es el botón
 * prominente porque es el caso normal —la clase entera pasando—; el resto queda discreto
 * al lado, con sigla y color, para la corrección puntual.
 */
function BotonesMarcaQr({ onElegir }: { onElegir: (m: MarkCode) => void }) {
  const otras = MARKS.filter((m) => m.code !== 'asistencia');
  return (
    <div className="flex w-full flex-col gap-2">
      <button
        onClick={() => onElegir('asistencia')}
        className="min-h-[36px] w-full rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-accent-fg"
      >
        Asistencia
      </button>
      <div className="flex flex-wrap gap-1">
        {otras.map((m) => (
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
    </div>
  );
}

/**
 * Buscador de fichas para el superusuario.
 *
 * No duplica la planilla: no lee sesiones (las reglas se lo niegan), solo estudiantes,
 * que `isActiveUser()` si le permite. Sirve para comprobar que una importacion quedo
 * bien —el momento en que mas falta hace mirar una ficha— y para probar permisos de
 * fotografia con una cuenta que no sea la del docente.
 */
function BuscadorFichas({
  sede,
  onAbrir,
}: {
  sede: string;
  onAbrir: (studentId: string) => void;
}) {
  const [texto, setTexto] = useState('');
  const [incluirRetirados, setIncluirRetirados] = useState(false);
  const [resultados, setResultados] = useState<Student[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (texto.trim().length < 2) {
      setResultados([]);
      return;
    }
    // Con retardo: se teclea mas rapido de lo que conviene consultar.
    const t = setTimeout(() => {
      void buscarEstudiantes(sede, texto, incluirRetirados)
        .then((r) => {
          setResultados(r);
          setError(null);
        })
        .catch((e) => setError(mensajeDeError(e)));
    }, 250);
    return () => clearTimeout(t);
  }, [texto, sede, incluirRetirados]);

  return (
    <section className="rounded-xl border border-line bg-card p-3">
      <h3 className="text-sm font-semibold text-strong">Consultar una ficha</h3>
      <p className="text-xs text-muted">
        Para comprobar que la importación quedó bien. No registra asistencia.
      </p>
      <input
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        placeholder="Apellido o nombre…"
        className="mt-2 w-full rounded-lg border border-line bg-elevated px-2 py-2 text-base text-strong"
      />
      {/* Apagada por defecto: mezclar retirados con activos en la busqueda de todos los
          dias confundiria a quien solo quiere pasar lista. Se prende a proposito, solo
          para reintegrar a alguien que el boton de retirar dejo inalcanzable. */}
      <label className="mt-2 flex min-h-[36px] w-fit items-center gap-2 text-sm text-strong">
        <input
          type="checkbox"
          checked={incluirRetirados}
          onChange={(e) => setIncluirRetirados(e.target.checked)}
        />
        Incluir retirados
      </label>
      {error && <p className="mt-2 text-xs text-danger">{error}</p>}
      {texto.trim().length >= 2 && resultados.length === 0 && !error && (
        <p className="mt-2 text-sm text-muted">Ningún estudiante coincide.</p>
      )}
      <ul className="mt-2 space-y-1">
        {resultados.map((e) => (
          <li key={e.studentId}>
            <button
              onClick={() => onAbrir(e.studentId)}
              className="w-full rounded-lg border border-line p-2 text-left text-sm text-strong"
            >
              {nombreCompleto(e)}
              <span className="ml-2 text-xs text-muted">{e.gradoActual}</span>
              {/* Marcado, para que no se confunda con un estudiante activo: es la unica
                  garantia de que aqui no se anda editando por error la ficha de alguien
                  que ya no esta en el colegio. */}
              {!e.activo && (
                <span className="ml-2 rounded-full bg-danger-soft px-2 py-0.5 text-xs font-medium text-danger-soft-fg">
                  Retirado
                </span>
              )}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * Limpieza de planillas de prueba, para el superusuario.
 *
 * Durante el desarrollo se registraron marcas de asistencia inventadas sobre estudiantes
 * reales, para probar la planilla. Esas marcas no deben quedarse: no por espacio, sino
 * porque son datos de asistencia FALSOS sobre menores identificables.
 *
 * Flujo en dos pasos obligatorios: primero se pide "ver qué se borraría" (no toca nada),
 * y solo con ese resultado a la vista aparece el botón de borrar de verdad, que además
 * exige volver a escribir el grado. La asignatura es texto libre A PROPÓSITO: lo que hay
 * que poder borrar son justo los códigos escritos a mano en las pruebas, que nunca
 * estuvieron en el catálogo cerrado de asignaturas.
 */
/**
 * Quien puede crear programas de centros de interes, aparte del superusuario.
 *
 * Existe para que la lider del proyecto (Yuri) arranque el semestre siguiente sin
 * depender de esta cuenta. Se hace desde aqui y no desde la consola de Firebase a
 * proposito: cada cosa que solo se puede hacer en la consola es una cosa que Julian tiene
 * que pedirle a alguien o buscar como se hacia.
 *
 * Escribe `asistenciaConfig/programas`, el mismo documento que leen las reglas.
 */
function CreadoresDeProgramas() {
  const [texto, setTexto] = useState('');
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void leerCreadoresDeProgramas()
      .then((c) => setTexto(c.join(', ')))
      .catch((e) => setError(`No fue posible leer la lista. (${(e as Error).message})`))
      .finally(() => setCargando(false));
  }, []);

  async function guardar() {
    setGuardando(true);
    setAviso(null);
    setError(null);
    try {
      const correos = texto.split(',').map((c) => c.trim()).filter(Boolean);
      await guardarCreadoresDeProgramas(correos);
      setAviso(
        correos.length === 0
          ? 'Lista vacía: solo usted y la coordinación de sede pueden crear programas.'
          : `Guardado. ${correos.length === 1 ? 'Esa persona podrá' : 'Esas personas podrán'} crear programas de centros de interés.`,
      );
    } catch (e) {
      setError(`No se pudo guardar. (${(e as Error).message})`);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="rounded-xl border border-line bg-card p-3">
      <h3 className="text-sm font-semibold text-strong">Quién puede crear centros de interés</h3>
      <p className="mt-0.5 text-xs text-muted">
        Además de usted. Quien esté aquí puede crear el programa de un semestre nuevo y
        subir las listas, sin tener que pedírselo a esta cuenta.
      </p>
      {cargando ? (
        <p className="mt-2 text-sm text-muted">Cargando…</p>
      ) : (
        <>
          <input
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="yuri.gomez@iemanueljbetancur.edu.co"
            className="mt-2 block w-full rounded-lg border border-line bg-elevated px-2 py-2 text-base text-strong"
          />
          <p className="mt-1 text-xs text-muted">Correos separados por coma.</p>
          <button
            onClick={() => void guardar()}
            disabled={guardando}
            className="mt-2 rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-accent-fg disabled:opacity-50"
          >
            {guardando ? 'Guardando…' : 'Guardar'}
          </button>
        </>
      )}
      {aviso && <p className="mt-2 text-xs text-info-soft-fg">{aviso}</p>}
      {error && <p className="mt-2 text-xs text-danger-soft-fg">{error}</p>}
    </div>
  );
}

function LimpiezaPlanillas() {
  const [grado, setGrado] = useState('');
  const [asignatura, setAsignatura] = useState('');
  const [resumen, setResumen] = useState<ResumenBorradoCruce | null>(null);
  const [confirmacion, setConfirmacion] = useState('');
  const [verificando, setVerificando] = useState(false);
  const [borrando, setBorrando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const listoParaVerificar = grado.trim() !== '' && asignatura.trim() !== '';

  async function verVerificacion() {
    setError(null);
    setAviso(null);
    setResumen(null);
    setVerificando(true);
    try {
      const r = await borrarSesionesDeCruce({
        grado: grado.trim(),
        subjectId: asignatura.trim(),
        dryRun: true,
      });
      setResumen(r);
    } catch (e) {
      setError(mensajeDeError(e));
    } finally {
      setVerificando(false);
    }
  }

  async function borrarDeVerdad() {
    setError(null);
    setBorrando(true);
    try {
      const r = await borrarSesionesDeCruce({
        grado: grado.trim(),
        subjectId: asignatura.trim(),
        dryRun: false,
      });
      setAviso(`Se borraron ${r.total} ${r.total === 1 ? 'clase registrada' : 'clases registradas'}.`);
      setGrado('');
      setAsignatura('');
      setResumen(null);
      setConfirmacion('');
    } catch (e) {
      setError(mensajeDeError(e));
    } finally {
      setBorrando(false);
    }
  }

  return (
    <section className="rounded-xl border border-danger-soft bg-danger-soft p-3">
      <h3 className="text-sm font-semibold text-danger-soft-fg">Limpiar planillas de prueba</h3>
      <p className="mt-1 text-xs text-danger-soft-fg">
        Borra únicamente las clases de asistencia registradas para un grado y una materia.
        <b> No borra estudiantes, ni matrículas, ni fotos</b> — solo las clases de ese
        grado con esa materia.
      </p>

      <div className="mt-2 grid grid-cols-2 gap-2">
        <label className="text-xs text-muted">
          Grado
          <input
            value={grado}
            onChange={(e) => {
              setGrado(e.target.value);
              setResumen(null);
              setAviso(null);
            }}
            placeholder="11.2"
            className="mt-0.5 block w-full rounded-lg border border-line bg-elevated px-2 py-2 text-base text-strong"
          />
        </label>
        <label className="text-xs text-muted">
          Materia (tal como se escribió)
          <input
            value={asignatura}
            onChange={(e) => {
              setAsignatura(e.target.value);
              setResumen(null);
              setAviso(null);
            }}
            placeholder="ej. mate11"
            className="mt-0.5 block w-full rounded-lg border border-line bg-elevated px-2 py-2 text-base text-strong"
          />
        </label>
      </div>

      <button
        disabled={!listoParaVerificar || verificando}
        onClick={() => void verVerificacion()}
        className="mt-3 min-h-[36px] w-full rounded-lg border border-danger-soft bg-card px-3 py-2 text-sm font-medium text-danger-soft-fg disabled:opacity-50"
      >
        {verificando ? 'Consultando…' : 'Ver qué se borraría'}
      </button>

      {error && <p className="mt-2 text-xs text-danger-soft-fg">{error}</p>}
      {aviso && <p className="mt-2 text-xs font-semibold text-danger-soft-fg">{aviso}</p>}

      {resumen && resumen.total === 0 && (
        <p className="mt-2 text-sm text-strong">
          No hay clases registradas para ese grado y esa materia. No hay nada que borrar.
        </p>
      )}

      {resumen && resumen.total > 0 && (
        <div className="mt-3 rounded-lg border border-danger-soft bg-card p-2">
          <p className="text-sm text-strong">
            Hay <b>{resumen.total}</b> {resumen.total === 1 ? 'clase registrada' : 'clases registradas'}
            {resumen.primera && resumen.ultima && (
              <>
                {' '}
                entre el <b>{resumen.primera}</b> y el <b>{resumen.ultima}</b>
              </>
            )}
            .
          </p>

          <label className="mt-2 block text-xs text-muted">
            Para borrar de verdad, escriba el grado tal como lo escribió arriba ({grado}):
            <input
              value={confirmacion}
              onChange={(e) => setConfirmacion(e.target.value)}
              disabled={borrando}
              className="mt-0.5 block w-full rounded-lg border border-line bg-elevated px-2 py-2 text-base text-strong"
            />
          </label>

          <button
            disabled={confirmacion !== grado || borrando}
            onClick={() => void borrarDeVerdad()}
            className="mt-2 min-h-[36px] w-full rounded-lg bg-danger px-3 py-2 text-sm font-medium text-accent-fg disabled:opacity-50"
          >
            {borrando ? 'Borrando…' : 'Borrar estas clases definitivamente'}
          </button>
        </div>
      )}
    </section>
  );
}

/**
 * Respaldo manual: docentes de apoyo o cuya asignación aún no se cargó no aparecen en
 * "Mis grupos", y sin esta salida se quedarían sin forma de abrir una sesión. La
 * asignatura ya NO es texto libre — sale del catálogo cerrado `ASIGNATURAS`, que es el
 * punto de todo este cambio: tres docentes de la misma materia deben producir el MISMO
 * id, no tres códigos distintos que le parten la estadística al sistema.
 */
function FormularioManual({
  onAbrir,
  onCerrar,
}: {
  onAbrir: (grado: string, subjectId: string, bloque: number) => Promise<void>;
  onCerrar: () => void;
}) {
  const [grado, setGrado] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [bloque, setBloque] = useState(1);
  const [enviando, setEnviando] = useState(false);

  const listo = grado.trim() !== '' && subjectId !== '';

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-end bg-black/40 p-0 sm:place-items-center sm:p-4"
      onClick={onCerrar}
    >
      <div
        className="w-full max-w-md rounded-t-2xl border border-line bg-card p-4 sm:rounded-2xl"
        onClick={(ev) => ev.stopPropagation()}
      >
        <h3 className="text-sm font-semibold text-strong">Abrir sesión sin asignación</h3>
        <p className="mb-2 text-xs text-muted">
          Solo para cuando el grupo no aparece en "Mis grupos" — cargo de apoyo, o
          asignación de este periodo aún no cargada.
        </p>

        <div className="space-y-2">
          <label className="block text-xs text-muted">
            Grado
            <input
              value={grado}
              onChange={(e) => setGrado(e.target.value)}
              placeholder="11.2"
              className="mt-0.5 block w-full rounded-lg border border-line bg-elevated px-2 py-2 text-base text-strong"
            />
          </label>
          <label className="block text-xs text-muted">
            Asignatura
            <select
              value={subjectId}
              onChange={(e) => setSubjectId(e.target.value)}
              className="mt-0.5 block w-full rounded-lg border border-line bg-elevated px-2 py-2 text-base text-strong"
            >
              <option value="">Seleccione…</option>
              {ASIGNATURAS.filter((a) => a.id !== 'ci').map((a) => (
                <option key={a.id} value={a.id}>
                  {a.nombre}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs text-muted">
            Bloque
            <select
              value={bloque}
              onChange={(e) => setBloque(Number(e.target.value))}
              className="mt-0.5 block w-full rounded-lg border border-line bg-elevated px-2 py-2 text-base text-strong"
            >
              {[1, 2, 3, 4, 5, 6].map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </label>
        </div>

        <p className="mt-2 text-xs text-muted">
          El grado va tal como lo escribe el colegio: <b>11.2</b> en la mañana, <b>6º1</b>{' '}
          en la tarde. La <b>º</b> es lo que distingue la jornada, así que no la cambie.
        </p>

        <button
          disabled={!listo || enviando}
          onClick={async () => {
            setEnviando(true);
            await onAbrir(grado.trim(), subjectId, bloque);
            setEnviando(false);
          }}
          className="mt-3 w-full rounded-lg bg-accent px-3 py-2 text-sm font-medium text-accent-fg disabled:opacity-50"
        >
          {enviando ? 'Abriendo…' : 'Abrir sesión de hoy'}
        </button>
        <button onClick={onCerrar} className="mt-2 w-full rounded-lg border border-line p-2 text-sm text-soft">
          Cancelar
        </button>
      </div>
    </div>
  );
}

/**
 * Selector de bloque (1 a 6): reemplaza al `window.prompt` numérico de antes. Sigue el
 * mismo patrón de hoja modal que `MenuExcusas` en LlegadasTarde.tsx — un botón grande por
 * opción, sin teclear nada, pensado para usarse de pie y con prisa.
 */
function MenuBloque({
  grado,
  subjectId,
  onElegir,
  onCerrar,
}: {
  grado: string;
  subjectId: string;
  onElegir: (bloque: number) => void;
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
        <p className="text-center text-lg font-semibold text-strong">{grado}</p>
        <p className="text-center text-xs text-muted">
          {getAsignatura(subjectId)?.nombre ?? subjectId} · ¿En qué bloque es la clase de
          hoy?
        </p>

        <div className="mt-3 grid grid-cols-3 gap-1.5">
          {[1, 2, 3, 4, 5, 6].map((b) => (
            <button
              key={b}
              onClick={() => onElegir(b)}
              className="rounded-lg border border-line p-3 text-center text-lg font-semibold text-strong hover:bg-hover"
            >
              {b}
            </button>
          ))}
        </div>

        <button onClick={onCerrar} className="mt-3 w-full rounded-lg border border-line p-2 text-sm text-soft">
          Cancelar
        </button>
      </div>
    </div>
  );
}

/** Las secciones del modulo, con la ayuda que aparece al pasar el raton. */
const SECCIONES: {
  vista: VistaAsistencia;
  nombre: string;
  descripcion: string;
  soloCoordinador?: boolean;
}[] = [
  {
    vista: 'planilla',
    nombre: 'Planillas',
    descripcion: 'Pase de lista de sus clases: escoja un grupo y marque la asistencia del día.',
  },
  {
    vista: 'tercera_hora',
    nombre: 'Reporte de tercera hora',
    descripcion:
      'Quiénes no vinieron hoy al colegio. Se mide después de la tercera hora, cuando ya entraron los que esperaban afuera.',
    soloCoordinador: true,
  },
  {
    vista: 'llegadas',
    nombre: 'Llegadas tarde',
    descripcion:
      'Registro en la puerta de quien entra tarde al colegio. No es el retraso a una clase, que lo pone cada docente.',
    soloCoordinador: true,
  },
  {
    vista: 'eventos',
    nombre: 'Eventos',
    descripcion:
      'Aquí puede crear grupos personalizados de asistencia para una actividad particular: una feria, una salida, un centro de interés. Se arma con los estudiantes que quiera, se comparte con otros docentes y lleva su propia planilla.',
  },
  {
    vista: 'programas',
    nombre: 'Centros de interés',
    descripcion:
      'Los centros de interés del semestre. Cada profesor entra a la planilla del suyo; la coordinación del programa los ve todos, carga las listas desde Excel y resuelve los casos que no cruzaron.',
  },
];

function Pestanas({
  vista,
  onCambiar,
  rol,
}: {
  vista: VistaAsistencia;
  onCambiar: (v: VistaAsistencia) => void;
  /** "Tercera hora" y "Llegadas tarde" son autoridad exclusiva del coordinador; el resto
   * de roles que llegan hasta aqui (docente) solo ven Planillas y Eventos. */
  rol: string | null;
}) {
  const visibles = SECCIONES.filter((s) => !s.soloCoordinador || rol === 'coordinador');

  return (
    <div className="flex flex-wrap gap-1.5">
      {visibles.map(({ vista: v, nombre, descripcion }) => (
        <Ayuda key={v} texto={descripcion}>
          <button
            onClick={() => onCambiar(v)}
            className={[
              'min-h-[36px] rounded-full border px-3 py-1 text-sm',
              vista === v
                ? 'border-accent bg-accent-soft font-semibold text-accent-soft-fg'
                : 'border-line text-soft',
            ].join(' ')}
          >
            {nombre}
          </button>
        </Ayuda>
      ))}
    </div>
  );
}

/**
 * Aviso del estado de envío de las marcas. Va justo debajo de las pestañas —arriba de
 * todo, visible mientras se pasa lista, no al final de la página— porque es ahí donde el
 * docente necesita saber si lo que está tocando de verdad se está guardando.
 *
 * Sin conexión y "enviando" son avisos informativos (nada se ha perdido); el último
 * error es distinto: el servidor rechazó una marca y hay que decirlo, porque de lo
 * contrario esa marca desaparece sin que nadie se entere.
 */
function IndicadorSync({ sync }: { sync: EstadoSync }) {
  if (sync.enLinea && sync.pendientes === 0 && !sync.ultimoError) return null;
  return (
    <div className="space-y-1.5">
      {/* Desde que MJB activó la caché persistente de Firestore (2026-08-11), las marcas
          quedan guardadas EN EL DISPOSITIVO y sobreviven a cerrar la aplicación. El aviso
          decía "no cierre la aplicación" cuando eso todavía no era cierto; mantenerlo
          ahora sería asustar sin motivo y, peor, enseñaría al docente a desconfiar de un
          mensaje que sí es fiable. */}
      {!sync.enLinea && (
        <div className="rounded-xl border border-warning-soft bg-warning-soft p-3 text-sm text-warning-soft-fg">
          Sin conexión. Puede seguir pasando lista: sus marcas quedan guardadas en este
          dispositivo y se enviarán solas cuando vuelva la señal.
        </div>
      )}
      {sync.enLinea && sync.pendientes > 0 && (
        <div className="rounded-xl border border-info-soft bg-info-soft p-3 text-sm text-info-soft-fg">
          Enviando {sync.pendientes} {sync.pendientes === 1 ? 'marca' : 'marcas'}…
        </div>
      )}
      {sync.ultimoError && (
        <div className="rounded-xl border border-danger-soft bg-danger-soft p-3 text-sm text-danger-soft-fg">
          El servidor no guardó una marca: {sync.ultimoError}. Vuelva a marcar esa casilla.
        </div>
      )}
    </div>
  );
}

/**
 * Traduce los errores de Firestore a algo que un docente pueda entender. Un
 * `permission-denied` crudo no le dice a nadie qué hacer, y aquí casi siempre significa
 * una de dos cosas concretas.
 */
function mensajeDeError(e: unknown): string {
  const texto = e instanceof Error ? e.message : String(e);
  if (texto.includes('permission-denied') || texto.includes('insufficient permissions')) {
    return (
      'El servidor no permitió la operación. Suele ser porque la sesión de clase no es ' +
      'suya o pertenece a otra sede. Si cree que sí le corresponde, avise a coordinación.'
    );
  }
  if (texto.includes('Sesión no activa') || texto.includes('sesion activa')) {
    return 'Su sesión expiró. Vuelva a entrar antes de registrar.';
  }
  return texto;
}


