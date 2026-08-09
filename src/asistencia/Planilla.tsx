import { useMemo, useState } from 'react';
import Avatar from './Avatar';
import { MARKS, findMark, type MarkCode } from './domain/marks';
import { nombreCompleto, nombresDePila } from './domain/nombres';
import { computeStats, conDenominador } from './domain/stats';
import { COLORES_GRUPO, estiloAnillo, estiloBorde, type ColorGrupo } from './domain/colores';
import type { Enrollment, Session, Student } from './domain/types';

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

/** Clases por token. Escritas completas para que Tailwind las detecte al compilar. */
const CLASE_MARCA: Record<MarkCode, string> = {
  asistencia: 'bg-success-soft text-success-soft-fg',
  ausencia: 'bg-danger-soft text-danger-soft-fg',
  retraso: 'bg-warning-soft text-warning-soft-fg',
  ausencia_justificada: 'bg-info-soft text-info-soft-fg',
  retraso_justificado: 'bg-info-soft text-info-soft-fg',
  evasion: 'bg-purple-soft text-purple-soft-fg',
  ausencia_autorizada: 'bg-info-soft text-info-soft-fg',
};

/** Sigla corta para que la celda quepa en movil. */
const SIGLA: Record<MarkCode, string> = {
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
  /** Solo lectura cuando el usuario no puede registrar (p. ej. la rectora). */
  puedeRegistrar: boolean;
  onMarcar: (sessionId: string, studentId: string, estado: MarkCode) => void;
  onCerrarSesion: (sessionId: string, sinRegistrar: number) => void;
  onAbrirFicha: (studentId: string) => void;
  onNuevaSesion: () => void;
  /** Llena de golpe las casillas vacías de una columna. */
  onLlenarColumna: (sessionId: string, estado: MarkCode) => void;
  /** Color identificativo del cruce grado+asignatura, elegido por el docente. Solo ayuda
   * visual: nunca reemplaza el nombre del grupo ni toca el color de las marcas. */
  color: ColorGrupo | null;
  /** Guarda (o borra, con `null`) el color del cruce activo. El mapa vive en index.tsx. */
  onElegirColor: (colorId: string | null) => void;
}

export default function Planilla({
  grado,
  asignatura,
  estudiantes,
  sesiones,
  matriculas,
  puedeRegistrar,
  onMarcar,
  onCerrarSesion,
  onAbrirFicha,
  onNuevaSesion,
  onLlenarColumna,
  color,
  onElegirColor,
}: PlanillaProps) {
  const [celda, setCelda] = useState<{ sessionId: string; studentId: string } | null>(null);
  const [columnaMenu, setColumnaMenu] = useState<string | null>(null);
  const [selectorColor, setSelectorColor] = useState(false);

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

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="shrink-0 text-base font-semibold text-strong">
          {grado} · {asignatura}
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
          className="grid h-9 w-9 shrink-0 place-items-center"
        >
          <span
            style={color ? { backgroundColor: color.hex } : {}}
            className={[
              'block h-5 w-5 rounded-full',
              color ? '' : 'border-2 border-dashed border-line-strong',
            ].join(' ')}
          />
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
        {puedeRegistrar && (
          <button
            onClick={onNuevaSesion}
            className="shrink-0 rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-accent-fg"
          >
            + Sesión de hoy
          </button>
        )}
      </div>

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


