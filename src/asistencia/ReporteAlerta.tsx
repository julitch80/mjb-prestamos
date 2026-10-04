import { useEffect, useMemo, useState } from 'react';
import { USUARIOS } from '../data/maestros';
import { alertasDelGrado, convocatoriasAlerta } from './datos';
import { nombreCompleto, ordenarEstudiantes } from './domain/nombres';
import { jornadaDeGrado } from './domain/ids';
import { consolidarGrupo, MINIMO_PARA_CITAR, puedeCitar } from './domain/alerta-academica';
import { toDateKey } from './domain/ids';
import CitacionesAlerta from './CitacionesAlerta';
import EntregaAlerta from './EntregaAlerta';
import { asignaturasDelGrado } from './horarioDelDia';
import type { ConvocatoriaAlerta, PlanillaAlerta, Sede, Student } from './domain/types';

/**
 * «Reporte de alerta» — la pestaña del DIRECTOR DE GRUPO (Julian, 2026-10-02).
 *
 * El cuadro de su grupo: estudiantes por asignaturas, con ⚠️ donde corresponde y el total.
 * Arriba, cuantas asignaturas ya entregaron y quien falta, porque las ESPERADAS salen de la
 * asignacion academica: «9 de 12» dice la verdad. Quien tiene dos o mas queda resaltado:
 * a su acudiente se le cita.
 */
export default function ReporteAlerta({
  grado,
  sede,
  estudiantes,
  director,
  slotDirector = null,
  esDirector = false,
  onAbrirFicha,
}: {
  grado: string;
  sede: Sede;
  estudiantes: Student[];
  /** Nombre del director de grupo: firma los informes y las citaciones. */
  director: string;
  /** Puesto del director: de su horario salen las horas libres para la segunda citacion. */
  slotDirector?: string | null;
  /** Solo el director arma la agenda y envia (la regla lo exige); coordinacion consulta. */
  esDirector?: boolean;
  onAbrirFicha?: (studentId: string) => void;
}) {
  const jornada = jornadaDeGrado(grado);
  const [convocatorias, setConvocatorias] = useState<ConvocatoriaAlerta[] | null>(null);
  const [periodoElegido, setPeriodoElegido] = useState<string | null>(null);
  const [planillas, setPlanillas] = useState<PlanillaAlerta[] | null>(null);
  const [soloCitados, setSoloCitados] = useState(false);

  useEffect(() => {
    void convocatoriasAlerta(sede, jornada)
      .then((cs) => {
        setConvocatorias(cs);
        setPeriodoElegido((cs.find((c) => c.abierta) ?? cs[0])?.convocatoriaId ?? null);
      })
      .catch(() => setConvocatorias([]));
  }, [sede, jornada]);

  const conv = convocatorias?.find((c) => c.convocatoriaId === periodoElegido) ?? null;

  useEffect(() => {
    if (!conv) { setPlanillas([]); return; }
    setPlanillas(null);
    void alertasDelGrado(grado, conv.anio, conv.periodo).then(setPlanillas).catch(() => setPlanillas([]));
  }, [grado, conv?.anio, conv?.periodo]); // eslint-disable-line react-hooks/exhaustive-deps

  const activos = useMemo(() => ordenarEstudiantes(estudiantes.filter((e) => e.activo !== false)), [estudiantes]);
  const esperadas = useMemo(() => asignaturasDelGrado(grado), [grado]);
  const consolidado = useMemo(
    () => consolidarGrupo(planillas ?? [], esperadas, activos.map((e) => e.studentId)),
    [planillas, esperadas, activos],
  );

  if (convocatorias === null) return <p className="p-3 text-sm text-muted">Cargando el reporte…</p>;
  if (!conv) {
    return (
      <div className="rounded-2xl border border-line bg-card p-4 text-sm text-muted">
        Coordinación todavía no ha abierto la alerta académica de este periodo.
      </div>
    );
  }

  const columnas = [
    ...esperadas.map((e) => ({ subjectId: e.subjectId, abrev: e.abrev, nombre: e.nombre })),
    ...consolidado.extra.map((s) => ({ subjectId: s, abrev: s.slice(0, 4), nombre: s })),
  ];
  const fila = (id: string) => consolidado.filas.find((f) => f.studentId === id)!;
  const conAlguna = consolidado.filas.filter((f) => f.total > 0).length;
  const citados = consolidado.filas.filter((f) => f.citar).length;
  const visibles = soloCitados ? activos.filter((e) => fila(e.studentId).citar) : activos;
  const nombreDocente = (slotId: string) => USUARIOS.find((u) => u.id === slotId)?.nombreCorto ?? slotId;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="flex-1 text-base font-semibold text-strong">Reporte de alerta · {grado}</h3>
        {convocatorias.length > 1 && (
          <select
            value={periodoElegido ?? ''}
            onChange={(e) => setPeriodoElegido(e.target.value)}
            className="rounded-lg border border-line bg-elevated px-2 py-1 text-sm text-strong"
            aria-label="Periodo"
          >
            {convocatorias.map((c) => (
              <option key={c.convocatoriaId} value={c.convocatoriaId}>{c.anio} · periodo {c.periodo}</option>
            ))}
          </select>
        )}
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        <div className="rounded-xl border border-line bg-card p-3">
          <p className="text-xs text-muted">Asignaturas entregadas</p>
          <p className="text-xl font-bold text-strong">{consolidado.entregadas.length} de {esperadas.length}</p>
        </div>
        <div className="rounded-xl border border-line bg-card p-3">
          <p className="text-xs text-muted">Con al menos una alerta</p>
          <p className="text-xl font-bold text-strong">{conAlguna}</p>
        </div>
        <div className="rounded-xl border border-warning-soft bg-warning-soft p-3">
          <p className="text-xs text-warning-soft-fg">Por citar ({MINIMO_PARA_CITAR} o más)</p>
          <p className="text-xl font-bold text-warning-soft-fg">{citados}</p>
        </div>
      </div>

      {consolidado.faltantes.length > 0 && (
        <div className="rounded-xl bg-elevated px-3 py-2 text-sm text-soft">
          <b>Faltan por entregar:</b>{' '}
          {consolidado.faltantes
            .map((s) => {
              const e = esperadas.find((x) => x.subjectId === s)!;
              return `${e.nombre} (${nombreDocente(e.slotId)})`;
            })
            .join(' · ')}
        </div>
      )}

      <label className="flex items-center gap-2 text-sm text-soft">
        <input type="checkbox" checked={soloCitados} onChange={(e) => setSoloCitados(e.target.checked)} />
        Ver solo a quienes hay que citar
      </label>

      {planillas === null ? (
        <p className="p-3 text-sm text-muted">Cargando…</p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-line bg-card">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-line text-xs text-muted">
                <th className="sticky left-0 z-10 bg-card px-3 py-2 text-left font-medium">Estudiante</th>
                {columnas.map((c) => (
                  <th key={c.subjectId} title={c.nombre} className="px-1.5 py-2 text-center font-medium">
                    {c.abrev}
                    {!consolidado.entregadas.includes(c.subjectId) && <span className="block text-[0.6rem] text-warning-soft-fg">pend.</span>}
                  </th>
                ))}
                <th className="px-2 py-2 text-center font-medium">Total</th>
              </tr>
            </thead>
            <tbody>
              {visibles.map((e) => {
                const f = fila(e.studentId);
                return (
                  <tr key={e.studentId} className={`border-b border-line last:border-0 ${f.citar ? 'bg-warning-soft/40' : ''}`}>
                    <td className="sticky left-0 z-10 bg-card px-3 py-1.5">
                      <button
                        type="button"
                        onClick={() => onAbrirFicha?.(e.studentId)}
                        className="text-left text-strong hover:underline"
                      >
                        {nombreCompleto(e)}
                      </button>
                    </td>
                    {columnas.map((c) => {
                      const m = planillas.find((p) => p.subjectId === c.subjectId)?.estudiantes?.[e.studentId];
                      return (
                        <td key={c.subjectId} className="px-1.5 py-1.5 text-center">
                          {m === 'alerta' ? '⚠️' : m === 'sin_alerta' ? <span className="text-muted">✓</span> : <span className="text-muted">·</span>}
                        </td>
                      );
                    })}
                    <td className={`px-2 py-1.5 text-center font-bold ${f.citar ? 'text-warning-soft-fg' : 'text-strong'}`}>
                      {f.total || ''}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-xs text-muted">⚠️ en alerta · ✓ sin alerta · «·» la asignatura aún no lo marca.</p>

      {/* La impresion la centraliza coordinacion (Julian, 2026-10-03): ni el director ni el
          docente imprimen; coordinacion descarga un solo archivo con toda la jornada. */}
      {citados > 0 && (
        <p className="text-xs text-muted">Los informes individuales y las citaciones de sus {citados} citados los descarga coordinación para toda la jornada: usted no tiene que imprimir nada.</p>
      )}

      {esDirector && (puedeCitar(conv, toDateKey(new Date())) ? (
        <>
          {/* Desde el dia de la entrega la agenda ya no se edita: guardarla reescribiria el mapa
              de citas y borraria la asistencia y el seguimiento registrados. */}
          {(!conv.fechaEntrega || toDateKey(new Date()) < conv.fechaEntrega) && (
            <CitacionesAlerta grado={grado} sede={sede} conv={conv} filas={consolidado.filas} estudiantes={activos} director={director} />
          )}
          <EntregaAlerta grado={grado} sede={sede} conv={conv} estudiantes={activos} director={director} slotDirector={slotDirector} />
        </>
      ) : (
        <p className="rounded-xl bg-elevated px-3 py-2 text-sm text-soft">Las citaciones se arman cuando coordinación cierre la alerta: hasta entonces la lista de citados puede cambiar.</p>
      ))}
    </div>
  );
}
