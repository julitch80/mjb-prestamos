import { useCallback, useEffect, useMemo, useState } from 'react';
import Avatar from './Avatar';
import { convocatoriasAlerta, entregarPlanillaAlerta, leerPlanillaAlerta, marcarAlerta } from './datos';
import { nombreCompleto, ordenarEstudiantes } from './domain/nombres';
import { toDateKey, jornadaDeGrado } from './domain/ids';
import {
  alertaId,
  convocatoriaEditable,
  estadoPlanilla,
  marcasAlEntregar,
  siguienteMarca,
} from './domain/alerta-academica';
import { fechaLarga } from './domain/imprimibles-alerta';
import type { ConvocatoriaAlerta, MarcaAlerta, PlanillaAlerta, Sede, Student } from './domain/types';

/**
 * Alerta academica — la pestaña del DOCENTE en cada planilla (Julian, 2026-10-02).
 *
 * No es asistencia ni nota: un toque por estudiante, ⚠️ en alerta / ✓ sin alerta, y al
 * final «Entregar», que deja en ✓ a los que no marco. Asi el director distingue «sin
 * alerta» de «el docente aun no la hizo». Se edita mientras coordinacion tenga la
 * convocatoria abierta; despues se ve y no se toca.
 */
/**
 * Como marca el docente (Julian, 2026-10-03): «recuadro» abre la foto grande con ⚠️/✓ y
 * pasa solo al siguiente; «toque» alterna la marca en la misma fila, sin abrir nada.
 * Preferencia del dispositivo, como el color del grupo: no viaja a Firestore.
 */
type ModoMarcar = 'recuadro' | 'toque';
const CLAVE_MODO = 'asis.alerta.modoMarcar';
function leerModo(): ModoMarcar {
  try { return localStorage.getItem(CLAVE_MODO) === 'toque' ? 'toque' : 'recuadro'; } catch { return 'recuadro'; }
}
function guardarModo(m: ModoMarcar) {
  try { localStorage.setItem(CLAVE_MODO, m); } catch { /* sin almacenamiento: vale para esta sesion */ }
}

export default function AlertaAcademica({
  grado,
  subjectId,
  nombreAsignatura,
  sede,
  slotId,
  estudiantes,
  puedeRegistrar,
}: {
  grado: string;
  subjectId: string;
  nombreAsignatura: string;
  sede: Sede;
  slotId: string;
  estudiantes: Student[];
  puedeRegistrar: boolean;
}) {
  const jornada = jornadaDeGrado(grado);
  const [convocatorias, setConvocatorias] = useState<ConvocatoriaAlerta[] | null>(null);
  const [periodoElegido, setPeriodoElegido] = useState<string | null>(null);
  const [planilla, setPlanilla] = useState<PlanillaAlerta | null>(null);
  const [cargando, setCargando] = useState(true);
  const [entregando, setEntregando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Estudiante del recuadro abierto (null = cerrado).
  const [abierto, setAbierto] = useState<string | null>(null);
  const [modo, setModo] = useState<ModoMarcar>(leerModo);

  useEffect(() => {
    void convocatoriasAlerta(sede, jornada).then((cs) => {
      setConvocatorias(cs);
      // La abierta primero; si no hay, la mas reciente (para consultar lo entregado).
      const abierta = cs.find((c) => c.abierta) ?? cs[0];
      setPeriodoElegido(abierta?.convocatoriaId ?? null);
    }).catch(() => setConvocatorias([]));
  }, [sede, jornada]);

  const conv = convocatorias?.find((c) => c.convocatoriaId === periodoElegido) ?? null;
  const base = conv
    ? { anio: conv.anio, periodo: conv.periodo, sede, jornada, grado, subjectId, slotId }
    : null;
  const idDoc = conv ? alertaId(conv.anio, conv.periodo, sede, grado, subjectId) : null;

  useEffect(() => {
    if (!idDoc) { setPlanilla(null); setCargando(false); return; }
    setCargando(true);
    void leerPlanillaAlerta(idDoc).then((p) => { setPlanilla(p); setCargando(false); });
  }, [idDoc]);

  const activos = useMemo(() => ordenarEstudiantes(estudiantes.filter((e) => e.activo !== false)), [estudiantes]);
  const ids = useMemo(() => activos.map((e) => e.studentId), [activos]);
  const estado = estadoPlanilla(planilla, ids);
  const editable = puedeRegistrar && convocatoriaEditable(conv, toDateKey(new Date()));

  const marcar = useCallback(async (studentId: string, nueva: MarcaAlerta) => {
    if (!base || !editable) return;
    const existia = !!planilla;
    // Optimista, como la asistencia: la marca se ve al instante y se envia sola.
    setPlanilla((p) => ({
      ...(p ?? ({ alertaId: idDoc!, ...base, entregada: false, entregadaPor: null, entregadaEn: null, ultimaEscrituraPor: '', ultimaEscrituraEn: Date.now() } as PlanillaAlerta)),
      estudiantes: { ...(p?.estudiantes ?? {}), [studentId]: nueva },
    }));
    try {
      await marcarAlerta(base, existia, studentId, nueva);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar la marca.');
    }
  }, [base, editable, planilla, idDoc]);

  // Tras elegir, el recuadro pasa al siguiente de la lista: se recorre el grupo sin
  // abrir y cerrar treinta veces. Al llegar al ultimo, se cierra.
  function elegir(studentId: string, nueva: MarcaAlerta) {
    void marcar(studentId, nueva);
    const i = ids.indexOf(studentId);
    setAbierto(i >= 0 && i < ids.length - 1 ? ids[i + 1] : null);
  }

  async function entregar() {
    if (!base) return;
    setEntregando(true);
    setError(null);
    const cambios = marcasAlEntregar(planilla, ids);
    try {
      await entregarPlanillaAlerta(base, !!planilla, cambios);
      setPlanilla(await leerPlanillaAlerta(idDoc!));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo entregar.');
    } finally {
      setEntregando(false);
    }
  }

  if (convocatorias === null) return <p className="p-3 text-sm text-muted">Cargando la alerta académica…</p>;

  if (!conv) {
    return (
      <div className="rounded-2xl border border-line bg-card p-4 text-sm text-muted">
        Coordinación todavía no ha abierto la alerta académica de este periodo. Cuando la abra,
        aquí podrá señalar quién está en alerta en {nombreAsignatura}.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="flex-1 text-base font-semibold text-strong">
          Alerta académica · {grado} · {nombreAsignatura}
        </h3>
        {convocatorias.length > 1 && (
          <select
            value={periodoElegido ?? ''}
            onChange={(e) => setPeriodoElegido(e.target.value)}
            className="rounded-lg border border-line bg-elevated px-2 py-1 text-sm text-strong"
            aria-label="Periodo"
          >
            {convocatorias.map((c) => (
              <option key={c.convocatoriaId} value={c.convocatoriaId}>
                {c.anio} · periodo {c.periodo}
              </option>
            ))}
          </select>
        )}
      </div>

      <div
        className={`rounded-xl px-3 py-2 text-sm ${
          editable ? 'bg-info-soft text-info-soft-fg' : 'bg-elevated text-soft'
        }`}
      >
        {editable
          ? <>Periodo {conv.periodo}: abierta hasta el <b>{fechaLarga(conv.fechaLimite)}</b>. {modo === 'toque' ? 'Toque a quien esté en alerta (⚠️; otro toque lo deja en ✓)' : 'Toque un estudiante y elija ⚠️ o ✓ (el recuadro pasa solo al siguiente)'} y al terminar, «Entregar».</>
          : <>Periodo {conv.periodo}: cerrada. Puede consultarla, pero ya no se modifica.</>}
      </div>

      <div className="flex flex-wrap gap-3 text-sm">
        <span className="text-warning-soft-fg"><b>{estado.alerta}</b> en alerta</span>
        <span className="text-success"><b>{estado.sinAlerta}</b> sin alerta</span>
        {estado.sinMarcar > 0 && <span className="text-muted"><b>{estado.sinMarcar}</b> sin marcar</span>}
        <span className={estado.completa ? 'font-semibold text-success' : 'text-muted'}>
          {estado.completa ? '✓ Entregada' : planilla?.entregada ? 'Pendiente: hay estudiantes nuevos sin marcar' : 'Sin entregar'}
        </span>
      </div>

      {editable && (
        <div className="flex items-center gap-2 text-xs text-muted">
          Marcar con
          <div className="grid grid-cols-2 gap-1 rounded-lg border border-line p-1" role="group" aria-label="Cómo marcar">
            {(['recuadro', 'toque'] as const).map((x) => (
              <button
                key={x}
                type="button"
                aria-pressed={modo === x}
                onClick={() => { setModo(x); guardarModo(x); }}
                className={`rounded-md px-2 py-1 ${modo === x ? 'bg-elevated font-semibold text-strong' : 'text-muted'}`}
              >
                {x === 'recuadro' ? 'Recuadro con foto' : 'Toque directo'}
              </button>
            ))}
          </div>
        </div>
      )}

      {cargando ? (
        <p className="p-3 text-sm text-muted">Cargando…</p>
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-card">
          {activos.map((e) => {
            const m = planilla?.estudiantes?.[e.studentId];
            return (
              <li key={e.studentId}>
                <button
                  type="button"
                  disabled={!editable}
                  onClick={() => (modo === 'toque' ? void marcar(e.studentId, siguienteMarca(m)) : setAbierto(e.studentId))}
                  className="flex min-h-[52px] w-full items-center gap-3 px-3 py-2 text-left disabled:cursor-default"
                  aria-label={`${nombreCompleto(e)}: ${m === 'alerta' ? 'en alerta' : m === 'sin_alerta' ? 'sin alerta' : 'sin marcar'}`}
                >
                  <Avatar estudiante={e} />
                  <span className="flex-1 text-sm text-strong">{nombreCompleto(e)}</span>
                  <span
                    className={`flex h-9 min-w-[44px] items-center justify-center rounded-lg px-2 text-lg ${
                      m === 'alerta'
                        ? 'bg-warning-soft text-warning-soft-fg'
                        : m === 'sin_alerta'
                          ? 'bg-success-soft text-success-soft-fg'
                          : 'border border-dashed border-line text-muted'
                    }`}
                  >
                    {m === 'alerta' ? '⚠️' : m === 'sin_alerta' ? '✓' : '·'}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {error && <p className="text-sm text-danger">{error}</p>}

      {abierto && (() => {
        const e = activos.find((x) => x.studentId === abierto);
        if (!e) return null;
        return (
          <RecuadroAlerta
            estudiante={e}
            detalle={`${grado} · ${nombreAsignatura} · ${ids.indexOf(abierto) + 1} de ${ids.length}`}
            actual={planilla?.estudiantes?.[abierto]}
            onElegir={(m) => elegir(abierto, m)}
            onCerrar={() => setAbierto(null)}
          />
        );
      })()}

      {editable && (
        <button
          type="button"
          onClick={() => void entregar()}
          disabled={entregando || (estado.completa && estado.sinMarcar === 0)}
          className="min-h-[44px] rounded-xl bg-accent px-4 text-sm font-semibold text-accent-fg disabled:opacity-50"
        >
          {entregando
            ? 'Entregando…'
            : estado.completa
              ? 'Entregada · puede seguir corrigiendo hasta la fecha límite'
              : `Entregar${estado.sinMarcar ? ` (los ${estado.sinMarcar} sin marcar quedan sin alerta)` : ''}`}
        </button>
      )}
    </div>
  );
}

/**
 * El mismo recuadro de la asistencia (`MenuMarcas` de Planilla): foto grande para
 * confirmar que es el estudiante correcto, y solo dos opciones (Julian, 2026-10-03).
 */
export function RecuadroAlerta({
  estudiante,
  detalle,
  actual,
  onElegir,
  onCerrar,
}: {
  estudiante: Student;
  detalle: string;
  actual: MarcaAlerta | undefined;
  onElegir: (m: MarcaAlerta) => void;
  onCerrar: () => void;
}) {
  const opcion = (m: MarcaAlerta, icono: string, texto: string, color: string) => (
    <button
      onClick={() => onElegir(m)}
      aria-pressed={actual === m}
      className={`flex flex-col items-center gap-1 rounded-xl border p-3 text-center hover:bg-hover ${
        actual === m ? 'border-accent ring-2 ring-accent' : 'border-line'
      }`}
    >
      <span className={`grid h-10 w-12 place-items-center rounded-lg text-xl ${color}`}>{icono}</span>
      <span className="text-sm font-semibold text-strong">{texto}</span>
    </button>
  );
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
          <p className="text-xs text-muted">{detalle}</p>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {opcion('alerta', '⚠️', 'En alerta', 'bg-warning-soft text-warning-soft-fg')}
          {opcion('sin_alerta', '✓', 'Sin alerta', 'bg-success-soft text-success-soft-fg')}
        </div>
        <button onClick={onCerrar} className="mt-3 w-full rounded-lg border border-line p-2 text-sm text-soft">
          Cerrar
        </button>
      </div>
    </div>
  );
}
