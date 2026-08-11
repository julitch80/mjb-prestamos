import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import Planilla from './Planilla';

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
import Ficha from './Ficha';
import PanelEstudiante from './PanelEstudiante';
import TerceraHora from './TerceraHora';
import LlegadasTarde from './LlegadasTarde';
import Eventos from './Eventos';
import {
  abrirSesion,
  buscarEstudiantes,
  cerrarSesion as cerrarSesionRemota,
  crearEstudianteManual,
  leerConfigAlertas,
  leerDirectores,
  leerGrupo,
  leerLlegadasTardePorGrado,
  llenarColumna,
  leerSesiones,
  marcarEstudiante,
  type AlcanceLectura,
} from './datos';
import type { NuevoEstudianteInput } from './Planilla';
import { toDateKey } from './domain/ids';
import { nombreCompleto } from './domain/nombres';
import { jornadaDeGrado } from './domain/ids';
import { ALERT_CONFIG_POR_DEFECTO } from './domain/alertas';
import type { MarkCode } from './domain/marks';
import type { AlertConfig, Enrollment, LateArrival, Session, Student } from './domain/types';
import { firebaseConfigurado } from '../lib/firebase';
import { useAppStore } from '../data/store';
import { estiloEtiqueta, guardarColor, leerMapa, resolverColor, type MapaColores } from './domain/colores';

/**
 * Navegacion interna del modulo. `eventos` esta disponible para cualquier rol que llegue
 * hasta aqui (coordinador o docente) porque cualquier docente puede crear un evento; las
 * otras tres pestanas quedan filtradas por rol dentro de `Pestanas`.
 */
type VistaAsistencia = 'planilla' | 'tercera_hora' | 'llegadas' | 'eventos';

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
   * Modo "Ver como" activo: la pantalla se comporta como el usuario simulado, pero el
   * SERVIDOR sigue viendo al usuario real. En asistencia eso no es un detalle — casi
   * todas las reglas dependen de quien pregunta, asi que simular a un coordinador desde
   * el superusuario produce rechazos que parecen fallos del modulo y no lo son.
   *
   * Costo una tarde de diagnostico: se probaban las pantallas del coordinador simulandolo
   * desde el superusuario, que por regla NO puede leer ninguna sesion, y el error generico
   * decia "la sesion no es suya o es de otra sede" sin mencionar la simulacion.
   */
  const identidadReal = useAppStore((s) => s.identidadReal);

  // La rectora y el superusuario consultan pero no registran. El servidor ya lo impide;
  // esto solo evita ofrecer botones que fallarian.
  const puedeRegistrar = rol !== 'rectora' && rol !== 'superusuario';

  const alcance: AlcanceLectura = useMemo(
    () =>
      rol === 'coordinador'
        ? { tipo: 'coordinador', sede }
        : { tipo: 'docente', slotId: slotId ?? '' },
    [rol, slotId, sede],
  );

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
      setCruce((actual) => actual ?? (lista.length ? { grado: lista[0].grado, subjectId: lista[0].subjectId } : null));
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

  async function marcar(sessionIdDoc: string, studentId: string, estado: MarkCode) {
    setError(null);
    try {
      await marcarEstudiante(sessionIdDoc, studentId, estado);
      await cargarSesiones();
    } catch (e) {
      setError(mensajeDeError(e));
    }
  }

  /** Llenado por defecto de una columna. Solo toca las casillas vacías. */
  async function llenar(sessionIdDoc: string, estado: MarkCode) {
    setError(null);
    try {
      await llenarColumna(
        sessionIdDoc,
        estudiantes.map((e) => e.studentId),
        estado,
      );
      await cargarSesiones();
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

  async function nuevaSesion() {
    if (!cruce) return;
    const respuesta = window.prompt('¿En qué bloque es la clase de hoy? (1 a 6)', '1');
    if (!respuesta) return;
    const bloque = Number(respuesta);
    if (!Number.isInteger(bloque) || bloque < 1 || bloque > 6) {
      setError('El bloque debe ser un número entre 1 y 6.');
      return;
    }
    setError(null);
    try {
      await abrirSesion({
        sede,
        grado: cruce.grado,
        jornada: jornadaDeGrado(cruce.grado),
        fecha: toDateKey(new Date()),
        bloque,
        subjectId: cruce.subjectId,
        slotId: slotId ?? '',
      });
      await cargarSesiones();
    } catch (e) {
      setError(mensajeDeError(e));
    }
  }

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
        <BuscadorFichas sede={sede} onAbrir={setFichaAbierta} />
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

      {/* Va ANTES del error y siempre visible: cuando se simula a otra persona, casi
          cualquier fallo de permisos de este modulo se explica por aqui, y el mensaje
          generico manda a buscar donde no es. */}
      {identidadReal && (
        <div className="rounded-xl border border-warning-soft bg-warning-soft p-3 text-sm text-warning-soft-fg">
          <b>Está viendo la aplicación como otra persona.</b> El servidor sigue
          identificándolo como <b>{identidadReal.nombre}</b>, así que los permisos de
          asistencia son los de esa cuenta, no los de la simulada. Es normal que aquí no
          cargue nada.
          <br />
          Para probar las pantallas de un docente o del coordinador, hay que{' '}
          <b>entrar con su propia cuenta</b>.
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-danger-soft bg-danger-soft p-3 text-sm text-danger-soft-fg">
          {error}
        </div>
      )}

      {cruces.length === 0 ? (
        <PrimeraSesion
          puedeRegistrar={puedeRegistrar}
          onAbrir={async (grado, subjectId, bloque) => {
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
          }}
        />
      ) : (
        <>
          {cruces.length > 1 && (
            <div className="flex flex-wrap gap-1.5">
              {cruces.map((c) => {
                const activo = cruce?.grado === c.grado && cruce?.subjectId === c.subjectId;
                const colorPestana = resolverColor(mapaColores, c.grado, c.subjectId);
                return (
                  <button
                    key={`${c.grado}|${c.subjectId}`}
                    onClick={() => setCruce(c)}
                    style={estiloEtiqueta(colorPestana)}
                    className={[
                      'rounded-full border px-3 py-1 text-sm',
                      // El color de grupo va por `style` (arriba); aqui solo se decide si
                      // la pestana activa se distingue de las inactivas cuando NO hay
                      // color propio, con un borde mas marcado.
                      activo
                        ? colorPestana
                          ? 'border-2 font-semibold'
                          : 'border-accent bg-accent-soft font-semibold text-accent-soft-fg'
                        : colorPestana
                          ? 'border font-normal'
                          : 'border-line text-soft',
                    ].join(' ')}
                  >
                    {c.grado} · {c.subjectId}
                  </button>
                );
              })}
            </div>
          )}

          {cruce && (
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
              color={resolverColor(mapaColores, cruce.grado, cruce.subjectId)}
              onElegirColor={(colorId) =>
                setMapaColores((m) => guardarColor(m, cruce.grado, cruce.subjectId, colorId))
              }
              alertConfig={alertConfig}
              puedeAgregarEstudiante={esDirector || rol === 'coordinador'}
              onAgregarEstudiante={agregarEstudiante}
            />
          )}
        </>
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
  const [resultados, setResultados] = useState<Student[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (texto.trim().length < 2) {
      setResultados([]);
      return;
    }
    // Con retardo: se teclea mas rapido de lo que conviene consultar.
    const t = setTimeout(() => {
      void buscarEstudiantes(sede, texto)
        .then((r) => {
          setResultados(r);
          setError(null);
        })
        .catch((e) => setError(mensajeDeError(e)));
    }, 250);
    return () => clearTimeout(t);
  }, [texto, sede]);

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
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * Arranque en frio: sin ninguna sesion registrada, la planilla no tiene de donde sacar
 * los grados ni las asignaturas —los deduce de las sesiones existentes—, asi que sin
 * esta pantalla no habria forma de crear la primera. Callejon sin salida clasico del
 * primer dia.
 */
function PrimeraSesion({
  puedeRegistrar,
  onAbrir,
}: {
  puedeRegistrar: boolean;
  onAbrir: (grado: string, subjectId: string, bloque: number) => Promise<void>;
}) {
  const [grado, setGrado] = useState('');
  const [asignatura, setAsignatura] = useState('');
  const [bloque, setBloque] = useState(1);
  const [enviando, setEnviando] = useState(false);

  if (!puedeRegistrar) {
    return (
      <p className="rounded-xl border border-line bg-card p-3 text-sm text-muted">
        No hay sesiones de clase registradas todavía. Aparecerán aquí cuando los docentes
        empiecen a pasar lista.
      </p>
    );
  }

  const listo = grado.trim() !== '' && asignatura.trim() !== '';

  return (
    <div className="rounded-xl border border-line bg-card p-3">
      <h3 className="text-sm font-semibold text-strong">Abrir la primera sesión</h3>
      <p className="mb-2 text-xs text-muted">
        Todavía no hay ninguna sesión registrada. Cree la de hoy y la planilla aparecerá
        con los estudiantes del grupo. Mientras no exista la sesión, ese día no existe
        para la estadística.
      </p>

      <div className="flex flex-wrap items-end gap-2">
        <label className="text-xs text-muted">
          Grado
          <input
            value={grado}
            onChange={(e) => setGrado(e.target.value)}
            placeholder="11.2"
            className="mt-0.5 block w-24 rounded-lg border border-line bg-elevated px-2 py-1.5 text-sm text-strong"
          />
        </label>
        <label className="text-xs text-muted">
          Asignatura
          <input
            value={asignatura}
            onChange={(e) => setAsignatura(e.target.value.toUpperCase())}
            placeholder="MAT"
            className="mt-0.5 block w-28 rounded-lg border border-line bg-elevated px-2 py-1.5 text-sm text-strong"
          />
        </label>
        <label className="text-xs text-muted">
          Bloque
          <select
            value={bloque}
            onChange={(e) => setBloque(Number(e.target.value))}
            className="mt-0.5 block rounded-lg border border-line bg-elevated px-2 py-1.5 text-sm text-strong"
          >
            {[1, 2, 3, 4, 5, 6].map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
        </label>
        <button
          disabled={!listo || enviando}
          onClick={async () => {
            setEnviando(true);
            await onAbrir(grado.trim(), asignatura.trim(), bloque);
            setEnviando(false);
          }}
          className="rounded-lg bg-accent px-3 py-2 text-sm font-medium text-accent-fg disabled:opacity-50"
        >
          {enviando ? 'Abriendo…' : 'Abrir sesión de hoy'}
        </button>
      </div>

      <p className="mt-2 text-xs text-muted">
        El grado va tal como lo escribe el colegio: <b>11.2</b> en la mañana, <b>6º1</b> en
        la tarde. La <b>º</b> es lo que distingue la jornada, así que no la cambie.
      </p>
    </div>
  );
}

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
  const clase = (activa: boolean) =>
    [
      'rounded-full border px-3 py-1 text-sm',
      activa
        ? 'border-accent bg-accent-soft font-semibold text-accent-soft-fg'
        : 'border-line text-soft',
    ].join(' ');
  return (
    <div className="flex flex-wrap gap-1.5">
      <button className={clase(vista === 'planilla')} onClick={() => onCambiar('planilla')}>
        Planillas
      </button>
      {rol === 'coordinador' && (
        <>
          <button
            className={clase(vista === 'tercera_hora')}
            onClick={() => onCambiar('tercera_hora')}
          >
            Reporte de tercera hora
          </button>
          <button className={clase(vista === 'llegadas')} onClick={() => onCambiar('llegadas')}>
            Llegadas tarde
          </button>
        </>
      )}
      <button className={clase(vista === 'eventos')} onClick={() => onCambiar('eventos')}>
        Eventos
      </button>
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


