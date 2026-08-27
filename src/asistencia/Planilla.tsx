import { lazy, Suspense, useMemo, useState } from 'react';
import Avatar from './Avatar';
import { MARKS, findMark, type MarkCode } from './domain/marks';
import { nombreCompleto, nombresDePila } from './domain/nombres';
import { computeStats, conDenominador } from './domain/stats';
import { resumenPastilla } from './domain/panel';
import { alertaPorcentajePeriodo, alertaRacha } from './domain/alertas';
import { COLORES_GRUPO, estiloAnillo, estiloBorde, type ColorGrupo } from './domain/colores';
import { toDateKey } from './domain/ids';
import type { AlertConfig, Enrollment, LateArrival, Session, Student } from './domain/types';
import { getAsignatura } from '../data/asignacionAcademica';

/**
 * Caratula del observador fisico. Va con `lazy` a proposito: arrastra `datos.ts` entero
 * para resolver el director de grupo, y esta planilla es presentacional —se puede ver y
 * probar sin Firestore detras—. Con `lazy` eso se mantiene: el modulo solo se descarga
 * cuando alguien pulsa el boton, que es una vez al año.
 */
const MosaicoGrupo = lazy(() => import('./MosaicoGrupo'));

/**
 * Planilla del docente, al estilo del cuaderno de Additio.
 *
 * Filas = estudiantes con matricula vigente. Columnas = SESIONES REGISTRADAS, nunca
 * dias del calendario: si no hay columna, ese dia no existe para la estadistica.
 *
 * Reglas que esta pantalla hace visibles:
 *  - Una casilla vacia se dibuja rayada y dice "sin registrar". NO es una ausencia.
 *  - El cierre de la sesion es manual; al cerrar avisa cuantas quedaron vacias pero no
 *    las convierte en nada.
 *  - Solo tokens semanticos, cero colores literales: se ve igual en claro y en oscuro.
 *  - La tabla lleva su propio overflow-x-auto: a 375 px la pagina no se desborda.
 *
 * Es presentacional a proposito: recibe los datos y devuelve las intenciones del
 * usuario por callbacks. Asi se puede ver y probar sin Firestore detras.
 */

/**
 * Clases por token. Escritas completas para que Tailwind las detecte al compilar.
 * Exportado para que PlanillaEvento.tsx no duplique la tabla: dos copias se
 * desincronizarian el dia que se ajuste un color.
 */
export const CLASE_MARCA: Record<MarkCode, string> = {
  asistencia: 'bg-success-soft text-success-soft-fg',
  ausencia: 'bg-danger-soft text-danger-soft-fg',
  retraso: 'bg-warning-soft text-warning-soft-fg',
  ausencia_justificada: 'bg-info-soft text-info-soft-fg',
  retraso_justificado: 'bg-info-soft text-info-soft-fg',
  evasion: 'bg-purple-soft text-purple-soft-fg',
  ausencia_autorizada: 'bg-info-soft text-info-soft-fg',
};

/** Sigla corta para que la celda quepa en movil. Exportado, ver nota de CLASE_MARCA. */
export const SIGLA: Record<MarkCode, string> = {
  asistencia: 'A',
  ausencia: 'F',
  retraso: 'R',
  ausencia_justificada: 'FJ',
  retraso_justificado: 'RJ',
  evasion: 'EV',
  ausencia_autorizada: 'FP',
};

export interface PlanillaProps {
  grado: string;
  asignatura: string;
  estudiantes: Student[];
  sesiones: Session[];
  matriculas: Enrollment[];
  /**
   * Llegadas tarde a la institución del grado, solo para la pastilla de la columna
   * "Faltas". Llega vacía cuando el usuario no dirige el grupo: pedirlas igual haría
   * que el servidor rechace la consulta entera (ver index.tsx).
   */
  llegadasTarde: LateArrival[];
  /** Solo lectura cuando el usuario no puede registrar (p. ej. la rectora). */
  puedeRegistrar: boolean;
  onMarcar: (sessionId: string, studentId: string, estado: MarkCode) => void;
  onCerrarSesion: (sessionId: string, sinRegistrar: number) => void;
  onAbrirFicha: (studentId: string) => void;
  /** Abre el panel de estadísticas del estudiante (pastilla de la columna "Faltas"). */
  onAbrirPanel: (studentId: string) => void;
  onNuevaSesion: () => void;
  /** Abre el lector de QR para registrar en esa sesión. */
  onEscanear: (sessionId: string) => void;
  /** Llena de golpe las casillas vacías de una columna. */
  onLlenarColumna: (sessionId: string, estado: MarkCode) => void;
  /** Color identificativo del cruce grado+asignatura, elegido por el docente. Solo ayuda
   * visual: nunca reemplaza el nombre del grupo ni toca el color de las marcas. */
  color: ColorGrupo | null;
  /** Guarda (o borra, con `null`) el color del cruce activo. El mapa vive en index.tsx. */
  onElegirColor: (colorId: string | null) => void;
  /** Umbrales de alerta (racha y % de faltas del periodo). `asistenciaConfig/alertas`. */
  alertConfig: AlertConfig;
  /** Solo el director del grupo o coordinación pueden dar de alta un estudiante nuevo
   * que no vino de Master2000 — la misma autoridad que ya decide quién edita una ficha. */
  puedeAgregarEstudiante: boolean;
  /** Crea el estudiante (vía Cloud Function, ver datos.ts) y recarga el grupo. Puede
   * rechazar (p. ej. documento ya existente): el modal muestra el error tal cual. */
  onAgregarEstudiante: (input: NuevoEstudianteInput) => Promise<void>;
}

export interface NuevoEstudianteInput {
  nombres: string;
  apellidos: string;
  docType: string;
  docNumber: string;
  acudiente: string;
  parentesco: string;
  telefonos: string[];
}

export default function Planilla({
  grado,
  asignatura,
  estudiantes,
  sesiones,
  matriculas,
  llegadasTarde,
  puedeRegistrar,
  onMarcar,
  onCerrarSesion,
  onAbrirFicha,
  onAbrirPanel,
  onNuevaSesion,
  onEscanear,
  onLlenarColumna,
  color,
  onElegirColor,
  alertConfig,
  puedeAgregarEstudiante,
  onAgregarEstudiante,
}: PlanillaProps) {
  const [celda, setCelda] = useState<{ sessionId: string; studentId: string } | null>(null);
  const [columnaMenu, setColumnaMenu] = useState<string | null>(null);
  const [selectorColor, setSelectorColor] = useState(false);
  const [agregando, setAgregando] = useState(false);
  /** Aviso de "cree la sesión de hoy primero", cuando el docente pide escanear sin
   * tener aún ninguna columna de hoy. No es un error: solo falta el paso previo. */
  const [avisoSinSesionHoy, setAvisoSinSesionHoy] = useState(false);
  /** Cuando hay más de una sesión de hoy (dos bloques del mismo grupo), hay que
   * preguntar en cuál se escanea antes de abrir la cámara. */
  const [eligiendoSesionQr, setEligiendoSesionQr] = useState<Session[] | null>(null);
  /** Mosaico de fotos para la caratula del observador. Se abre encima de la planilla. */
  const [mosaico, setMosaico] = useState(false);

  const ordenadas = useMemo(
    () =>
      [...sesiones].sort((a, b) =>
        (a.fecha + String(a.bloque).padStart(2, '0')).localeCompare(
          b.fecha + String(b.bloque).padStart(2, '0'),
        ),
      ),
    [sesiones],
  );

  const sesionDe = (id: string) => ordenadas.find((s) => s.sessionId === id);
  const alumnoDe = (id: string) => estudiantes.find((e) => e.studentId === id);

  function cerrar(s: Session) {
    const faltan = estudiantes.filter((e) => !s.estudiantes?.[e.studentId]).length;
    onCerrarSesion(s.sessionId, faltan);
  }

  /**
   * Sobre qué sesión escanea: la planilla puede tener varias columnas (varias fechas y
   * bloques), así que hay que resolver la ambigüedad en vez de adivinar. Ninguna de hoy
   * -> no se abre la cámara, se pide crear la sesión primero. Más de una -> se pregunta
   * el bloque. Exactamente una -> directo.
   */
  function manejarPasarListaQr() {
    const hoy = toDateKey(new Date());
    const deHoy = ordenadas.filter((s) => s.fecha === hoy);
    if (deHoy.length === 0) {
      setAvisoSinSesionHoy(true);
    } else if (deHoy.length === 1) {
      onEscanear(deHoy[0].sessionId);
    } else {
      setEligiendoSesionQr(deHoy);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="shrink-0 text-base font-semibold text-strong">
          {/* `?? asignatura`: sesiones ya existentes en produccion se guardaron con
              codigos escritos a mano que no estan en el catalogo, y deben seguir
              viendose en vez de desaparecer. */}
          {grado} · {getAsignatura(asignatura)?.nombre ?? asignatura}
        </h2>
        {/* Selector de color del grupo: solo ayuda visual para quien lleva varios grupos
            a la vez, por eso va pegado al nombre y no compite con las marcas de asistencia. */}
        {/* El punto se ve pequeno pero la zona pulsable es de 36 px: un boton de 20 px es
            imposible de acertar con el dedo, y esta pantalla se usa de pie y con prisa.
            Y lleva `aria-label` porque no tiene texto: sin el, quien use lector de
            pantalla oye "boton" y nada mas. El `title` no sirve — en el movil no hay
            puntero que lo dispare. */}
        <button
          onClick={() => setSelectorColor(true)}
          aria-label={
            color
              ? `Color del grupo: ${color.nombre}. Pulse para cambiarlo`
              : 'Elegir un color para este grupo'
          }
          title={color ? `Color del grupo: ${color.nombre}` : 'Elegir un color para este grupo'}
          className="flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-line px-2 text-xs text-muted"
        >
          <span
            style={color ? { backgroundColor: color.hex } : {}}
            className={[
              'block h-4 w-4 rounded-full',
              color ? '' : 'border-2 border-dashed border-line-strong',
            ].join(' ')}
          />
          {/* La palabra "Color" va SIEMPRE, no solo el punto. Sin color asignado el punto
              es un circulito punteado de 20 px junto al titulo: en el celular la cabecera
              se parte en varias lineas y se ve, pero en una pantalla ancha queda todo en
              una sola fila y pasa desapercibido. Julian reporto que "en el computador no
              existe la opcion" — existia, pero era invisible, que para el caso es lo
              mismo. */}
          {color ? color.nombre : 'Color'}
        </button>
        <span className="shrink-0 text-xs text-muted">
          {ordenadas.length === 0
            ? 'Sin sesiones registradas en este periodo'
            : `${ordenadas.length} sesiones registradas`}
        </span>
        {/* Convenciones siempre visibles: el docente no debe tener que recordar las siglas
            ni abrir nada para saber que significa una marca en la planilla. */}
        <div className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto">
          {MARKS.map((m) => (
            <span key={m.code} className="flex shrink-0 items-center gap-1 text-xs text-muted">
              <span className={`font-bold ${CLASE_MARCA[m.code]} rounded px-1`}>
                {SIGLA[m.code]}
              </span>
              {m.label}
            </span>
          ))}
        </div>
        <span className="grow" />
        {/* La caratula del observador la imprime coordinacion o el director de grupo, y
            ninguno de los dos necesita `puedeRegistrar`: es un papel, no un registro. */}
        <button
          onClick={() => setMosaico(true)}
          title="Mosaico de fotos del grupo para la carátula del observador"
          className="shrink-0 rounded-lg border border-line px-3 py-1.5 text-sm font-medium text-strong"
        >
          Mosaico de fotos
        </button>
        {puedeRegistrar && (
          <button
            onClick={manejarPasarListaQr}
            className="shrink-0 rounded-lg border border-line px-3 py-1.5 text-sm font-medium text-strong"
          >
            Pasar lista con QR
          </button>
        )}
        {puedeRegistrar && (
          <button
            onClick={onNuevaSesion}
            className="shrink-0 rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-accent-fg"
          >
            + Sesión de hoy
          </button>
        )}
      </div>

      {mosaico && (
        <Suspense fallback={null}>
          <MosaicoGrupo
            grado={grado}
            estudiantes={estudiantes}
            onCerrar={() => setMosaico(false)}
          />
        </Suspense>
      )}

      {avisoSinSesionHoy && (
        <div className="rounded-xl border border-info-soft bg-info-soft p-3 text-sm text-info-soft-fg">
          Todavía no hay una sesión de hoy en este grupo: cree la sesión de hoy antes de
          escanear.
          <button
            onClick={() => {
              setAvisoSinSesionHoy(false);
              onNuevaSesion();
            }}
            className="ml-2 min-h-[36px] rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-accent-fg"
          >
            + Sesión de hoy
          </button>
        </div>
      )}

      {ordenadas.length === 0 ? (
        <p className="rounded-xl border border-line bg-card p-3 text-sm text-muted">
          Mientras no exista una columna, ese día no existe para la estadística. Cree la
          sesión de hoy para empezar a registrar.
        </p>
      ) : (
        <div
          className="overflow-x-auto rounded-xl border border-line bg-card"
          style={estiloBorde(color)}
        >
          <table className="w-max min-w-full border-collapse">
            <thead>
              <tr>
                {/* El ancho debe coincidir EXACTO con el de la celda de la fila: son dos
                    elementos sticky distintos y, si difieren, la columna fija se parte al
                    desplazar la tabla de lado. */}
                <th className="sticky left-0 z-10 min-w-[10.5rem] max-w-[10.5rem] border-b border-r border-line bg-card p-2 text-left text-xs font-semibold text-muted">
                  Estudiante ({estudiantes.length})
                </th>
                {ordenadas.map((s) => (
                  <th
                    key={s.sessionId}
                    className="border-b border-line p-1 text-center text-[0.65rem] font-normal text-muted"
                  >
                    <span className="block font-semibold text-strong">{s.fecha.slice(5)}</span>
                    b{s.bloque}
                    <span className="flex items-center justify-center gap-0.5">
                      <button
                        onClick={() => puedeRegistrar && !s.closed && cerrar(s)}
                        title={s.closed ? 'Sesión cerrada' : 'Cerrar sesión de clase'}
                      >
                        {s.closed ? '🔒' : '🔓'}
                      </button>
                      {puedeRegistrar && !s.closed && (
                        <button
                          onClick={() => setColumnaMenu(s.sessionId)}
                          title="Llenar las casillas vacías de esta columna"
                          className="rounded px-1 text-strong"
                        >
                          ⋯
                        </button>
                      )}
                    </span>
                  </th>
                ))}
                {/* Misma regla que la columna del nombre: el ancho del <th> y el del <td>
                    deben coincidir EXACTO, o esta columna fija se parte al desplazar. */}
                <th className="sticky right-0 z-10 min-w-[4.5rem] max-w-[4.5rem] border-b border-l border-line bg-card p-2 text-center text-xs font-semibold text-muted">
                  Faltas
                </th>
              </tr>
            </thead>
            <tbody>
              {estudiantes.map((e) => (
                <tr key={e.studentId}>
                  <td className="sticky left-0 z-10 min-w-[10.5rem] max-w-[10.5rem] border-b border-r border-line bg-card p-1.5">
                    <button
                      onClick={() => onAbrirFicha(e.studentId)}
                      className="flex w-full items-center gap-2 text-left"
                      title={nombreCompleto(e)}
                    >
                      <Avatar estudiante={e} tamano={44} style={estiloAnillo(color)} />
                      <span className="min-w-0 truncate text-xs leading-tight text-strong">
                        <span className="block truncate font-semibold">{e.apellidos}</span>
                        <span className="block truncate text-muted">
                          {nombresDePila(e.apellidos, e.nombres)}
                        </span>
                      </span>
                    </button>
                  </td>
                  {ordenadas.map((s) => {
                    const m = s.estudiantes?.[e.studentId];
                    const def = m ? findMark(m.estado) : undefined;
                    return (
                      <td key={s.sessionId} className="border-b border-line p-0">
                        <button
                          disabled={!puedeRegistrar}
                          onClick={() => setCelda({ sessionId: s.sessionId, studentId: e.studentId })}
                          title={
                            def
                              ? `${def.label} · registró ${m!.registradoPor}`
                              : 'Sin registrar (no es una ausencia)'
                          }
                          className={[
                            'h-9 w-14 text-xs font-bold',
                            def
                              ? CLASE_MARCA[def.code]
                              : 'bg-elevated text-muted font-normal opacity-70',
                          ].join(' ')}
                        >
                          {def ? SIGLA[def.code] : '·'}
                        </button>
                      </td>
                    );
                  })}
                  <td className="sticky right-0 z-10 min-w-[4.5rem] max-w-[4.5rem] border-b border-l border-line bg-card p-1">
                    <PastillaEstudiante
                      estudiante={e}
                      sesiones={sesiones}
                      matriculas={matriculas.filter((m) => m.studentId === e.studentId)}
                      asignatura={asignatura}
                      llegadasTarde={llegadasTarde}
                      alertConfig={alertConfig}
                      onAbrir={onAbrirPanel}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-muted">
        La casilla con «·» está <strong className="text-soft">sin registrar</strong>: no
        cuenta como ausencia. Toque una casilla para marcar.
      </p>

      {/* Al final de la lista, no mezclado con las filas: dar de alta a alguien no es
          una acción de pasar lista y no debe competir visualmente con las que sí lo son. */}
      {puedeAgregarEstudiante && (
        <button
          onClick={() => setAgregando(true)}
          className="w-full rounded-xl border border-dashed border-line-strong bg-card p-3 text-sm font-medium text-accent"
        >
          + Agregar estudiante nuevo a {grado}
        </button>
      )}

      {agregando && (
        <ModalNuevoEstudiante
          grado={grado}
          onGuardar={async (input) => {
            await onAgregarEstudiante(input);
            setAgregando(false);
          }}
          onCerrar={() => setAgregando(false)}
        />
      )}

      {selectorColor && (
        <SelectorColor
          actual={color}
          onElegir={(colorId) => {
            onElegirColor(colorId);
            setSelectorColor(false);
          }}
          onCerrar={() => setSelectorColor(false)}
        />
      )}

      {columnaMenu && (
        <MenuColumna
          sesion={sesionDe(columnaMenu)!}
          vacias={
            estudiantes.filter((e) => !sesionDe(columnaMenu)?.estudiantes?.[e.studentId]).length
          }
          total={estudiantes.length}
          onElegir={(estado) => {
            onLlenarColumna(columnaMenu, estado);
            setColumnaMenu(null);
          }}
          onCerrar={() => setColumnaMenu(null)}
        />
      )}

      {eligiendoSesionQr && (
        <MenuElegirSesionQr
          sesiones={eligiendoSesionQr}
          onElegir={(sessionId) => {
            setEligiendoSesionQr(null);
            onEscanear(sessionId);
          }}
          onCerrar={() => setEligiendoSesionQr(null)}
        />
      )}

      {celda && alumnoDe(celda.studentId) && (
        <MenuMarcas
          estudiante={alumnoDe(celda.studentId)!}
          detalle={(() => {
            const s = sesionDe(celda.sessionId);
            return s ? `${s.fecha}, bloque ${s.bloque}` : '';
          })()}
          onElegir={(estado) => {
            onMarcar(celda.sessionId, celda.studentId, estado);
            setCelda(null);
          }}
          onCerrar={() => setCelda(null)}
        />
      )}

      <Resumen
        estudiantes={estudiantes}
        sesiones={ordenadas}
        matriculas={matriculas}
        asignatura={asignatura}
      />
    </div>
  );
}

/**
 * Pastilla de la columna fija "Faltas": lo único visible sin abrir el panel.
 *
 * Usa `resumenPastilla` (domain/panel.ts), que ya decide qué cifra importa y cuándo no
 * hay nada que medir. Aquí solo se traduce esa decisión a color y texto.
 */
function PastillaEstudiante({
  estudiante,
  sesiones,
  matriculas,
  asignatura,
  llegadasTarde,
  alertConfig,
  onAbrir,
}: {
  estudiante: Student;
  sesiones: Session[];
  matriculas: Enrollment[];
  asignatura: string;
  llegadasTarde: LateArrival[];
  alertConfig: AlertConfig;
  onAbrir: (studentId: string) => void;
}) {
  const statsInput = {
    studentId: estudiante.studentId,
    sessions: sesiones,
    enrollments: matriculas,
    subjectId: asignatura,
  };
  const stats = computeStats(statsInput);
  const llegadasDelEstudiante = llegadasTarde.filter(
    (la) => la.studentId === estudiante.studentId,
  ).length;
  const resumen = resumenPastilla(stats, llegadasDelEstudiante);

  // Alertas de docente (domain/alertas.ts): racha sin explicar y % del periodo. NO se
  // mezclan con `hayAvisos` (retrasos/llegadas tarde) porque son de otra gravedad — a
  // esta el docente le debe registrar un aviso a la familia, no solo mirarla.
  const racha = alertaRacha(statsInput, alertConfig);
  const periodo = alertaPorcentajePeriodo(stats, alertConfig);
  const alerta = racha.activa || periodo.activa;

  return (
    <button
      onClick={() => onAbrir(estudiante.studentId)}
      aria-label={`Ver panel de ${nombreCompleto(estudiante)}`}
      title={
        alerta
          ? [
              racha.activa ? `${racha.racha} faltas seguidas sin explicar` : null,
              periodo.activa ? `${periodo.porcentaje}% de inasistencia sin explicar` : null,
            ]
              .filter(Boolean)
              .join(' · ')
          : resumen.sinDatos
            ? 'Sin sesiones registradas todavía: no hay nada que medir.'
            : undefined
      }
      className={[
        'relative flex h-9 w-full items-center justify-center gap-1 rounded-lg text-sm font-bold',
        resumen.sinDatos
          ? 'text-muted'
          : resumen.aMaster2000 > 0
            ? 'bg-danger-soft text-danger-soft-fg'
            : 'text-strong',
        alerta ? 'ring-2 ring-danger-soft-fg' : '',
      ].join(' ')}
    >
      {resumen.sinDatos ? '–' : resumen.aMaster2000}
      {/* Aviso de retrasos o llegadas tarde: NO se suma a la cifra de faltas, son otro
          fenomeno. Solo un punto que dice "hay algo mas que mirar". */}
      {resumen.hayAvisos && (
        <span
          className="h-1.5 w-1.5 shrink-0 rounded-full bg-warning-soft-fg"
          aria-hidden
          title="Hay retrasos o llegadas tarde registrados"
        />
      )}
      {/* La alerta seria (racha o % del periodo) es un anillo, no un punto mas: tiene
          que distinguirse a simple vista del aviso leve de arriba. */}
      {alerta && (
        <span
          className="absolute -right-1 -top-1 grid h-3.5 w-3.5 place-items-center rounded-full bg-danger text-[0.55rem] text-accent-fg"
          aria-hidden
        >
          !
        </span>
      )}
    </button>
  );
}

/**
 * Llenado por defecto de una columna — el atajo que de verdad ahorra tiempo al docente.
 *
 * Los dos usos reales, dichos por Julian:
 *   "hoy vinieron casi todos"  -> llenar asistencia y corregir a los tres que faltaron;
 *   a principio de ano          -> llenar ausencia y pasar uno por uno, que obliga a
 *                                  mirarles la cara mientras los conoce.
 *
 * Solo toca las casillas VACIAS. Por eso el boton dice cuantas son: si el docente ya
 * marco veinte, tiene que ver que este atajo no las va a tocar.
 */
/**
 * Menu de color del grupo. Mismo patron de hoja modal que `MenuColumna`: no se inventa
 * otro mecanismo de seleccion solo porque esta elige un color en vez de una marca.
 */
function SelectorColor({
  actual,
  onElegir,
  onCerrar,
}: {
  actual: ColorGrupo | null;
  onElegir: (colorId: string | null) => void;
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
        <p className="mb-3 text-sm font-semibold text-strong">Color de este grupo</p>
        <div className="grid grid-cols-4 gap-2">
          {COLORES_GRUPO.map((c) => (
            <button
              key={c.id}
              onClick={() => onElegir(c.id)}
              title={c.nombre}
              className="flex flex-col items-center gap-1 rounded-lg border border-line p-2 hover:bg-hover"
            >
              <span
                style={{ backgroundColor: c.hex }}
                className={[
                  'h-7 w-7 rounded-full',
                  actual?.id === c.id ? 'ring-2 ring-offset-2 ring-line-strong' : '',
                ].join(' ')}
              />
              <span className="truncate text-[0.65rem] text-muted">{c.nombre}</span>
            </button>
          ))}
        </div>
        <button
          onClick={() => onElegir(null)}
          className={[
            'mt-3 w-full rounded-lg border border-line p-2 text-sm text-soft',
            actual === null ? 'font-semibold text-strong' : '',
          ].join(' ')}
        >
          Sin color
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

function MenuColumna({
  sesion,
  vacias,
  total,
  onElegir,
  onCerrar,
}: {
  sesion: Session;
  vacias: number;
  total: number;
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
          Llenar la columna del {sesion.fecha}, bloque {sesion.bloque}
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
 * Hoy hay dos bloques del mismo grupo: hay que preguntar antes de abrir la cámara, en vez
 * de adivinar sobre cuál se está pasando lista. Mismo patrón visual que `MenuColumna`.
 */
function MenuElegirSesionQr({
  sesiones,
  onElegir,
  onCerrar,
}: {
  sesiones: Session[];
  onElegir: (sessionId: string) => void;
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
        <p className="text-sm font-semibold text-strong">¿En qué bloque escanea?</p>
        <p className="mb-3 text-xs text-muted">Hoy hay más de una sesión de este grupo.</p>

        <div className="grid gap-1.5">
          {sesiones.map((s) => (
            <button
              key={s.sessionId}
              onClick={() => onElegir(s.sessionId)}
              className="rounded-lg border border-line p-3 text-left text-sm text-strong hover:bg-hover"
            >
              Bloque {s.bloque}
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

function MenuMarcas({
  estudiante,
  detalle,
  onElegir,
  onCerrar,
}: {
  estudiante: Student;
  detalle: string;
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
          <p className="text-xs text-muted">{detalle}</p>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-1.5 sm:grid-cols-3">
          {MARKS.map((m) => (
            <button
              key={m.code}
              onClick={() => onElegir(m.code)}
              className="relative flex flex-col items-center gap-1 rounded-lg border border-line p-2 text-center hover:bg-hover"
            >
              {m.goesToMaster2000 && (
                <span
                  className="absolute right-1 top-1 text-[0.6rem] text-muted"
                  title="Esta marca se transcribe a Master2000"
                >
                  M
                </span>
              )}
              <span
                className={`grid h-7 w-9 place-items-center rounded text-xs font-bold ${CLASE_MARCA[m.code]}`}
              >
                {SIGLA[m.code]}
              </span>
              <span className="text-xs leading-tight text-strong">{m.label}</span>
            </button>
          ))}
        </div>
        {/* La "M" de las esquinas se explica AQUI y no solo en un `title`: esta pantalla
            se usa sobre todo desde el celular, donde no hay puntero y el tooltip no
            existe. Un indicador que solo se entiende con raton es un indicador invisible
            para quien de verdad pasa lista. */}
        <p className="mt-2 text-center text-[0.65rem] text-muted">
          Las marcas con <b className="text-soft">M</b> son las que se transcriben a
          Master2000.
        </p>
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
 * Alta de un estudiante que no vino de Master2000. El grado y la sede NO se piden: son
 * los del grupo donde se está parado, no algo que se pueda elegir mal por descuido.
 *
 * El envío puede ser rechazado por el servidor (documento ya registrado en otra ficha):
 * el error se muestra tal cual, porque nombra a quién ya existe y con eso basta para
 * saber qué hacer (trasladar, no duplicar).
 */
function ModalNuevoEstudiante({
  grado,
  onGuardar,
  onCerrar,
}: {
  grado: string;
  onGuardar: (input: NuevoEstudianteInput) => Promise<void>;
  onCerrar: () => void;
}) {
  const [nombres, setNombres] = useState('');
  const [apellidos, setApellidos] = useState('');
  const [docType, setDocType] = useState('TI');
  const [docNumber, setDocNumber] = useState('');
  const [acudiente, setAcudiente] = useState('');
  const [parentesco, setParentesco] = useState('');
  const [tel, setTel] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const listo = nombres.trim() !== '' && apellidos.trim() !== '' && docNumber.trim() !== '';

  async function enviar() {
    setError(null);
    setEnviando(true);
    try {
      await onGuardar({
        nombres: nombres.trim(),
        apellidos: apellidos.trim(),
        docType,
        docNumber: docNumber.trim(),
        acudiente: acudiente.trim(),
        parentesco: parentesco.trim(),
        telefonos: tel.split(',').map((t) => t.trim()).filter(Boolean),
      });
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
        className="max-h-[90vh] w-full max-w-md overflow-auto rounded-t-2xl border border-line bg-card p-4 sm:rounded-2xl"
        onClick={(ev) => ev.stopPropagation()}
      >
        <p className="text-lg font-semibold text-strong">Agregar estudiante nuevo</p>
        <p className="mb-2 text-xs text-muted">
          Se matricula en <b>{grado}</b>. Para trasladar a alguien que ya está en el
          sistema, use el cambio de grado en su ficha en vez de crearlo de nuevo.
        </p>

        <div className="grid grid-cols-2 gap-2">
          <label className="text-xs text-muted">
            Nombres
            <input
              value={nombres}
              onChange={(e) => setNombres(e.target.value)}
              className="mt-0.5 block w-full rounded-lg border border-line bg-elevated px-2 py-1.5 text-sm text-strong"
            />
          </label>
          <label className="text-xs text-muted">
            Apellidos
            <input
              value={apellidos}
              onChange={(e) => setApellidos(e.target.value)}
              className="mt-0.5 block w-full rounded-lg border border-line bg-elevated px-2 py-1.5 text-sm text-strong"
            />
          </label>
        </div>

        <div className="mt-2 grid grid-cols-[5rem_1fr] gap-2">
          <label className="text-xs text-muted">
            Tipo
            <select
              value={docType}
              onChange={(e) => setDocType(e.target.value)}
              className="mt-0.5 block w-full rounded-lg border border-line bg-elevated px-2 py-1.5 text-sm text-strong"
            >
              {['RC', 'TI', 'CC', 'PPT', 'otro'].map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs text-muted">
            Número de documento
            <input
              value={docNumber}
              onChange={(e) => setDocNumber(e.target.value)}
              inputMode="numeric"
              className="mt-0.5 block w-full rounded-lg border border-line bg-elevated px-2 py-1.5 text-sm text-strong"
            />
          </label>
        </div>

        <label className="mt-2 block text-xs text-muted">
          Acudiente
          <input
            value={acudiente}
            onChange={(e) => setAcudiente(e.target.value)}
            className="mt-0.5 block w-full rounded-lg border border-line bg-elevated px-2 py-1.5 text-sm text-strong"
          />
        </label>
        <label className="mt-2 block text-xs text-muted">
          Parentesco (madre, padre, tía…)
          <input
            value={parentesco}
            onChange={(e) => setParentesco(e.target.value)}
            placeholder="Sin registrar"
            className="mt-0.5 block w-full rounded-lg border border-line bg-elevated px-2 py-1.5 text-sm text-strong"
          />
        </label>
        <label className="mt-2 block text-xs text-muted">
          Teléfonos (separados por coma)
          <input
            value={tel}
            onChange={(e) => setTel(e.target.value)}
            className="mt-0.5 block w-full rounded-lg border border-line bg-elevated px-2 py-1.5 text-sm text-strong"
          />
        </label>

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
          {enviando ? 'Guardando…' : 'Agregar estudiante'}
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

/** Resumen con el denominador SIEMPRE explícito. */
function Resumen({
  estudiantes,
  sesiones,
  matriculas,
  asignatura,
}: {
  estudiantes: Student[];
  sesiones: Session[];
  matriculas: Enrollment[];
  asignatura: string;
}) {
  if (sesiones.length === 0) return null;

  const filas = estudiantes
    .map((e) => ({
      e,
      r: computeStats({
        studentId: e.studentId,
        sessions: sesiones,
        enrollments: matriculas.filter((m) => m.studentId === e.studentId),
        subjectId: asignatura,
      }),
    }))
    .filter(({ r }) => r.ausenciasTotales > 0 || r.retrasosTotales > 0)
    .sort((a, b) => b.r.aMaster2000 - a.r.aMaster2000);

  if (filas.length === 0) return null;

  return (
    <div className="rounded-xl border border-line bg-card p-3">
      <p className="mb-2 text-sm font-semibold text-strong">Resumen del periodo</p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-muted">
              <th className="p-1">Estudiante</th>
              <th className="p-1 text-right">A Master2000</th>
              <th className="p-1 text-right">Justificadas</th>
              <th className="p-1 text-right">Retrasos</th>
              <th className="p-1 text-right">Sin registrar</th>
              <th className="p-1">Inasistencia</th>
            </tr>
          </thead>
          <tbody>
            {filas.slice(0, 10).map(({ e, r }) => (
              <tr key={e.studentId} className="border-t border-line">
                <td className="p-1 text-strong">
                  {nombreCompleto(e)}
                </td>
                <td className="p-1 text-right font-semibold text-strong">{r.aMaster2000}</td>
                <td className="p-1 text-right text-soft">
                  {r.ausenciasTotales - r.aMaster2000}
                </td>
                <td className="p-1 text-right text-soft">{r.retrasosTotales}</td>
                <td className="p-1 text-right text-muted">{r.sinRegistrar}</td>
                <td className="p-1 text-xs text-muted">
                  {conDenominador(r.ausenciasTotales, r.sessionsCount)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-muted">
        A Master2000 solo se transcriben las ausencias y las evasiones. El denominador son
        las sesiones registradas, no los días del calendario.
      </p>
    </div>
  );
}


