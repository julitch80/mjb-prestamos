import { useMemo, useState } from 'react';
import { MARKS, findMark, type MarkCode } from './domain/marks';
import { computeStats, conDenominador } from './domain/stats';
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
}: PlanillaProps) {
  const [celda, setCelda] = useState<{ sessionId: string; studentId: string } | null>(null);

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
        <h2 className="text-base font-semibold text-strong">
          {grado} · {asignatura}
        </h2>
        <span className="text-xs text-muted">
          {ordenadas.length === 0
            ? 'Sin sesiones registradas en este periodo'
            : `${ordenadas.length} sesiones registradas`}
        </span>
        <span className="grow" />
        {puedeRegistrar && (
          <button
            onClick={onNuevaSesion}
            className="rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-accent-fg"
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
        <div className="overflow-x-auto rounded-xl border border-line bg-card">
          <table className="w-max min-w-full border-collapse">
            <thead>
              <tr>
                <th className="sticky left-0 z-10 min-w-[9.5rem] max-w-[9.5rem] border-b border-r border-line bg-card p-2 text-left text-xs font-semibold text-muted">
                  Estudiante ({estudiantes.length})
                </th>
                {ordenadas.map((s) => (
                  <th
                    key={s.sessionId}
                    className="border-b border-line p-1 text-center text-[0.65rem] font-normal text-muted"
                  >
                    <span className="block font-semibold text-strong">{s.fecha.slice(5)}</span>
                    b{s.bloque}
                    <button
                      onClick={() => puedeRegistrar && !s.closed && cerrar(s)}
                      title={s.closed ? 'Sesión cerrada' : 'Cerrar sesión de clase'}
                      className="block w-full text-center"
                    >
                      {s.closed ? '🔒' : '🔓'}
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {estudiantes.map((e) => (
                <tr key={e.studentId}>
                  <td className="sticky left-0 z-10 min-w-[9.5rem] max-w-[9.5rem] border-b border-r border-line bg-card p-2">
                    <button
                      onClick={() => onAbrirFicha(e.studentId)}
                      className="block truncate text-left text-xs leading-tight text-strong"
                      title={`${e.apellidos}, ${e.nombres}`}
                    >
                      <span className="font-semibold">{e.apellidos}</span>
                      <br />
                      <span className="text-muted">{e.nombres}</span>
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

      {celda && (
        <MenuMarcas
          nombre={(() => {
            const a = alumnoDe(celda.studentId);
            return a ? `${a.apellidos}, ${a.nombres}` : celda.studentId;
          })()}
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

function MenuMarcas({
  nombre,
  detalle,
  onElegir,
  onCerrar,
}: {
  nombre: string;
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
        <p className="text-sm font-semibold text-strong">{nombre}</p>
        <p className="mb-3 text-xs text-muted">{detalle}</p>
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
              <span className="grow text-sm text-strong">{m.label}</span>
              {m.goesToMaster2000 && (
                <span className="text-[0.65rem] text-muted">va a Master2000</span>
              )}
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
                  {e.apellidos}, {e.nombres}
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

