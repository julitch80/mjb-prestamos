import { useState } from 'react';
import Avatar from './Avatar';
import { filasDelPanel, textoDenominador } from './domain/panel';
import { alertaPorcentajePeriodo, alertaRacha } from './domain/alertas';
import { nombreCompleto } from './domain/nombres';
import { computeStats } from './domain/stats';
import type { AlertConfig, Enrollment, LateArrival, Session, Student } from './domain/types';

/**
 * Panel de estadísticas de un estudiante. Modal, no una pantalla nueva: se abre desde
 * la pastilla de la columna "Faltas" de la planilla y no necesita navegación propia.
 *
 * Mismo patrón de hoja modal que `MenuMarcas` en Planilla.tsx (hoja abajo en móvil,
 * centrada en escritorio): no se inventa otro mecanismo de superposición solo porque
 * esta muestra estadísticas en vez de marcas.
 */
export default function PanelEstudiante({
  estudiante,
  asignaturaActual,
  sesionesPorAsignatura,
  matriculas,
  llegadasTarde,
  alertConfig,
  onCerrar,
}: {
  estudiante: Student;
  asignaturaActual: string;
  /** Clave = subjectId. Solo trae más de una si el usuario dirige el grupo. */
  sesionesPorAsignatura: Record<string, Session[]>;
  matriculas: Enrollment[];
  llegadasTarde: LateArrival[];
  alertConfig: AlertConfig;
  onCerrar: () => void;
}) {
  const asignaturas = Object.keys(sesionesPorAsignatura);
  const [asignatura, setAsignatura] = useState(
    asignaturas.includes(asignaturaActual) ? asignaturaActual : (asignaturas[0] ?? asignaturaActual),
  );

  const sesiones = sesionesPorAsignatura[asignatura] ?? [];
  const statsInput = {
    studentId: estudiante.studentId,
    sessions: sesiones,
    enrollments: matriculas,
    subjectId: asignatura,
  };
  const stats = computeStats(statsInput);
  const filas = filasDelPanel(stats);
  const racha = alertaRacha(statsInput, alertConfig);
  const periodo = alertaPorcentajePeriodo(stats, alertConfig);

  const llegadasDelEstudiante = llegadasTarde.filter(
    (la) => la.studentId === estudiante.studentId,
  );
  const sinJustificar = llegadasDelEstudiante.filter(
    (la) => la.estado === 'sin_justificar',
  ).length;

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
        </div>

        {/* Pestañas de asignatura: solo si el usuario dirige el grupo y por eso trae más
            de una. Con una sola no aportan nada, solo ocupan espacio. */}
        {asignaturas.length > 1 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {asignaturas.map((a) => (
              <button
                key={a}
                onClick={() => setAsignatura(a)}
                className={[
                  'rounded-full border px-3 py-1 text-sm',
                  a === asignatura
                    ? 'border-accent bg-accent-soft font-semibold text-accent-soft-fg'
                    : 'border-line text-soft',
                ].join(' ')}
              >
                {a}
              </button>
            ))}
          </div>
        )}

        <div className="mt-3 grid grid-cols-2 gap-1.5 sm:grid-cols-3">
          {filas.map((f) => (
            <div
              key={f.code}
              className="flex flex-col items-center gap-0.5 rounded-lg border border-line p-2 text-center"
            >
              <span className="text-lg font-bold text-strong">{f.valor}</span>
              <span className="text-xs leading-tight text-muted">{f.label}</span>
            </div>
          ))}
        </div>
        {/* El denominador va SIEMPRE, incluso sin ninguna falta: sin él, la cifra de
            arriba no significa nada (domain/panel.ts). */}
        <p className="mt-2 text-xs text-muted">{textoDenominador(stats)}</p>

        {/* Alertas del docente (domain/alertas.ts), acordadas con Julian el 2026-08-10.
            Aparte de la pastilla: aquí sí caben el umbral y la cifra exacta, que en la
            fila de la planilla no entran. */}
        {(racha.activa || periodo.activa) && (
          <div className="mt-2 rounded-lg border border-danger-soft bg-danger-soft p-2 text-xs text-danger-soft-fg">
            {racha.activa && (
              <p>
                <b>{racha.racha}</b> faltas seguidas sin explicar en {asignatura} (alerta
                desde {alertConfig.faltasConsecutivas}).
              </p>
            )}
            {periodo.activa && (
              <p>
                <b>{periodo.porcentaje}%</b> de inasistencia sin explicar sobre lo
                registrado (alerta desde {alertConfig.porcentajeFaltasPeriodo}%).
              </p>
            )}
          </div>
        )}

        {/* Sección aparte a propósito: las llegadas tarde a la institución las registra
            coordinación, no el docente, y NO se suman a las faltas de clase — son otro
            fenómeno y otra autoridad. */}
        <div className="mt-4 rounded-xl border border-line bg-elevated p-3">
          <p className="text-sm font-semibold text-strong">Llegadas tarde a la institución</p>
          <p className="text-xs text-muted">
            No es lo mismo que las faltas de clase: lo registra coordinación, no el docente.
          </p>
          {llegadasDelEstudiante.length === 0 ? (
            <p className="mt-2 text-sm text-soft">
              Sin llegadas tarde registradas en este periodo.
            </p>
          ) : (
            <p className="mt-2 text-sm text-strong">
              <span className="font-semibold">{llegadasDelEstudiante.length}</span> en total
              {sinJustificar > 0 && (
                <span className="text-danger-soft-fg">
                  {' '}
                  · <span className="font-semibold">{sinJustificar}</span> sin justificar
                </span>
              )}
            </p>
          )}
        </div>

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
