import { useEffect, useMemo, useState } from 'react';
import { FlechaNeon } from '../components/FlechaNeon';
import {
  abrirConvocatoriaAlerta,
  actualizarConvocatoriaAlerta,
  agendasDeJornada,
  alertasDeJornada,
  convocatoriasAlerta,
  leerEstudiantesDeSede,
} from './datos';
import { jornadaDeGrado, toDateKey } from './domain/ids';
import { consolidarGrupo, convocatoriaEditable, MINIMO_PARA_CITAR } from './domain/alerta-academica';
import { ordenarEstudiantes } from './domain/nombres';
import { citacionesDelGrupo, imprimirTodo, informesDelGrupo, nombreDirector, planillaDelGrupo, type OrdenPlanilla } from './imprimirAlerta';
import { asignaturasDelGrado } from './horarioDelDia';
import ReporteAlerta from './ReporteAlerta';
import SeguimientoCoordinacion from './SeguimientoCoordinacion';
import { fechaLarga } from './domain/imprimibles-alerta';
import { PLAZO_EXCUSA_DIAS } from './domain/seguimiento-alerta';
import type { AgendaCitaciones, ConvocatoriaAlerta, Jornada, PlanillaAlerta, Sede, Student } from './domain/types';

const CAJA = 'rounded-lg border border-line bg-elevated px-2 py-1.5 text-sm text-strong';
const BOTON = 'min-h-[40px] rounded-xl px-4 text-sm font-semibold disabled:opacity-50';

/**
 * Alerta academica — la seccion de COORDINACION (Julian, 2026-10-02).
 *
 *  1. Abre la convocatoria del periodo con su fecha limite, la cierra y la reabre.
 *  2. Pone el dia y la franja de entrega a las familias (las horas las reparte cada director).
 *  3. Ve el avance de todos los grupos de su sede y jornada, y entra al reporte de cualquiera.
 */
export default function AlertaCoordinacion({
  sede,
  jornadaLimitada,
  directores,
}: {
  sede: Sede;
  /** Si la cuenta coordina solo una jornada de la sede (central tiene dos coordinaciones). */
  jornadaLimitada: Jornada | null;
  /** grado → puesto del director (`asistenciaConfig/directores`), de las dos jornadas. */
  directores: Record<string, string>;
}) {
  const [jornada, setJornada] = useState<Jornada>(jornadaLimitada ?? 'manana');
  const [convocatorias, setConvocatorias] = useState<ConvocatoriaAlerta[] | null>(null);
  const [elegida, setElegida] = useState<string | null>(null);
  const [planillas, setPlanillas] = useState<PlanillaAlerta[] | null>(null);
  const [grupoAbierto, setGrupoAbierto] = useState<string | null>(null);
  const [agendas, setAgendas] = useState<AgendaCitaciones[]>([]);
  // Orden de las planillas de asistencia: lo decide coordinacion (Julian, 2026-10-03).
  const [ordenPlanilla, setOrdenPlanilla] = useState<OrdenPlanilla>('hora');
  // Constancias en blanco del archivo unico; null = la sugerencia (1 hoja por cada 10 citados).
  const [constancias, setConstancias] = useState<number | null>(null);
  const [estudiantes, setEstudiantes] = useState<Student[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const grados = useMemo(() => Object.keys(directores), [directores]);

  // Formulario de apertura.
  const hoy = new Date();
  const [periodoNuevo, setPeriodoNuevo] = useState(1);
  const [limiteNuevo, setLimiteNuevo] = useState('');

  async function recargar(seleccion?: string) {
    const cs = await convocatoriasAlerta(sede, jornada).catch(() => []);
    setConvocatorias(cs);
    setElegida(seleccion ?? (cs.find((c) => c.abierta) ?? cs[0])?.convocatoriaId ?? null);
  }
  useEffect(() => { void recargar(); }, [sede, jornada]); // eslint-disable-line react-hooks/exhaustive-deps

  const conv = convocatorias?.find((c) => c.convocatoriaId === elegida) ?? null;

  useEffect(() => {
    if (!conv) { setPlanillas([]); return; }
    setPlanillas(null);
    void alertasDeJornada(sede, jornada, conv.anio, conv.periodo).then(setPlanillas).catch(() => setPlanillas([]));
    void agendasDeJornada(sede, jornada, conv.anio, conv.periodo).then(setAgendas).catch(() => setAgendas([]));
  }, [sede, jornada, conv?.anio, conv?.periodo]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!grupoAbierto || estudiantes) return;
    void leerEstudiantesDeSede(sede).then(setEstudiantes).catch(() => setEstudiantes([]));
  }, [grupoAbierto, estudiantes, sede]);

  const gradosJornada = useMemo(
    () => grados.filter((g) => jornadaDeGrado(g) === jornada).sort((a, b) => a.localeCompare(b, 'es', { numeric: true })),
    [grados, jornada],
  );

  // Avance por grupo con solo las planillas: entregadas frente a esperadas, y cuantos
  // estudiantes suman dos o mas alertas (no hace falta la lista del grupo para contarlos).
  const avance = useMemo(() => gradosJornada.map((g) => {
    const esperadas = asignaturasDelGrado(g);
    const del = (planillas ?? []).filter((p) => p.grado === g);
    const entregadas = esperadas.filter((e) => del.some((p) => p.subjectId === e.subjectId && p.entregada)).length;
    const cuenta = new Map<string, number>();
    for (const p of del) for (const [id, m] of Object.entries(p.estudiantes ?? {})) if (m === 'alerta') cuenta.set(id, (cuenta.get(id) ?? 0) + 1);
    const citados = [...cuenta.values()].filter((n) => n >= MINIMO_PARA_CITAR).length;
    return { grado: g, esperadas: esperadas.length, entregadas, citados };
  }), [gradosJornada, planillas]);

  // Grupos con citados (dos o mas alertas) cuyo director aun no guardo la agenda.
  const sinAgenda = avance.filter((a) => a.citados > 0 && !agendas.some((x) => x.grado === a.grado)).map((a) => a.grado);
  const citadosJornada = avance.reduce((n, a) => n + a.citados, 0);
  const constanciasSugeridas = Math.max(4, Math.ceil(citadosJornada / 10) * 4);
  const nConstancias = constancias ?? constanciasSugeridas;

  async function hacer(accion: () => Promise<void>, seleccion?: string) {
    setGuardando(true);
    setError(null);
    try {
      await accion();
      await recargar(seleccion ?? elegida ?? undefined);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar.');
    } finally {
      setGuardando(false);
    }
  }

  /**
   * La descarga de la jornada (Julian, 2026-10-03): coordinacion centraliza la impresion y
   * la pide a biblioteca con UN solo correo y UN solo archivo. Por eso van juntas, en un solo
   * documento, todas las citaciones (de las agendas guardadas) y todos los informes.
   */
  async function descargarTodo() {
    if (!conv) return;
    setGuardando(true);
    setError(null);
    try {
      const todos = estudiantes ?? (await leerEstudiantesDeSede(sede));
      if (!estudiantes) setEstudiantes(todos);
      const frescas = await agendasDeJornada(sede, jornada, conv.anio, conv.periodo);
      setAgendas(frescas);
      const titulo = `Alerta académica · jornada ${jornada === 'manana' ? 'mañana' : 'tarde'} · periodo ${conv.periodo}`;
      const citaciones = gradosJornada.flatMap((g) => {
        const a = frescas.find((x) => x.grado === g);
        return a ? citacionesDelGrupo(g, conv, a, todos.filter((e) => e.gradoActual === g), nombreDirector(directores[g])) : [];
      });
      const informes: ReturnType<typeof informesDelGrupo> = [];
      const firmas: NonNullable<ReturnType<typeof planillaDelGrupo>>[] = [];
      for (const g of gradosJornada) {
        const del = ordenarEstudiantes(todos.filter((e) => e.gradoActual === g && e.activo !== false));
        const c = consolidarGrupo((planillas ?? []).filter((p) => p.grado === g), asignaturasDelGrado(g), del.map((e) => e.studentId));
        informes.push(...informesDelGrupo(g, conv, c.filas, del, nombreDirector(directores[g])));
        const a = frescas.find((x) => x.grado === g);
        const pf = a ? planillaDelGrupo(g, conv, a, c.filas, del, nombreDirector(directores[g]), ordenPlanilla) : null;
        if (pf) firmas.push(pf);
      }
      const ok = imprimirTodo(sede, citaciones, informes, titulo, firmas,
        conv.fechaEntrega ? { fecha: fechaLarga(conv.fechaEntrega), cuantas: nConstancias } : null);
      if (!ok) setError('El navegador bloqueó la ventana de impresión: permita las ventanas emergentes de la app.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo preparar el documento.');
    } finally {
      setGuardando(false);
    }
  }

  if (grupoAbierto) {
    return (
      <div className="flex flex-col gap-3">
        <button onClick={() => setGrupoAbierto(null)} className="group inline-flex items-center gap-1 self-start text-sm text-accent"><FlechaNeon direccion="izquierda" tamano="sm" /> Todos los grupos</button>
        {estudiantes === null ? (
          <p className="p-3 text-sm text-muted">Cargando el grupo…</p>
        ) : (
          <ReporteAlerta
            grado={grupoAbierto}
            sede={sede}
            estudiantes={estudiantes.filter((e) => e.gradoActual === grupoAbierto)}
            director={nombreDirector(directores[grupoAbierto])}
          />
        )}
      </div>
    );
  }

  const yaExiste = (convocatorias ?? []).some((c) => c.anio === hoy.getFullYear() && c.periodo === periodoNuevo);
  const editable = convocatoriaEditable(conv, toDateKey(hoy));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="flex-1 text-lg font-semibold text-strong">Alerta académica</h2>
        {!jornadaLimitada && (
          <div className="flex gap-1.5">
            {(['manana', 'tarde'] as const).map((j) => (
              <button
                key={j}
                onClick={() => { setJornada(j); setGrupoAbierto(null); }}
                className={`min-h-[36px] rounded-full border px-3 text-sm ${jornada === j ? 'border-accent bg-accent-soft font-semibold text-accent-soft-fg' : 'border-line text-soft'}`}
              >
                {j === 'manana' ? 'Mañana' : 'Tarde'}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 1. Abrir una convocatoria */}
      <section className="flex flex-col gap-2 rounded-2xl border border-line bg-card p-4">
        <h3 className="text-sm font-semibold text-strong">Abrir la alerta de un periodo</h3>
        <div className="flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1 text-xs text-muted">
            Periodo
            <select value={periodoNuevo} onChange={(e) => setPeriodoNuevo(Number(e.target.value))} className={CAJA}>
              {[1, 2, 3, 4].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted">
            Fecha límite para los docentes
            <input type="date" value={limiteNuevo} onChange={(e) => setLimiteNuevo(e.target.value)} className={CAJA} />
          </label>
          <button
            disabled={guardando || !limiteNuevo || yaExiste}
            onClick={() => void hacer(
              () => abrirConvocatoriaAlerta({ anio: hoy.getFullYear(), periodo: periodoNuevo, sede, jornada, fechaLimite: limiteNuevo }),
              `${hoy.getFullYear()}_${periodoNuevo}_${sede}_${jornada}`,
            )}
            className={`${BOTON} bg-accent text-accent-fg`}
          >
            Abrir
          </button>
        </div>
        {yaExiste && <p className="text-xs text-muted">El periodo {periodoNuevo} de {hoy.getFullYear()} ya está creado: adminístrelo abajo.</p>}
      </section>

      {/* 2. La convocatoria elegida */}
      {conv && (
        <section className="flex flex-col gap-3 rounded-2xl border border-line bg-card p-4">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="flex-1 text-sm font-semibold text-strong">
              {conv.anio} · periodo {conv.periodo} · {editable ? <span className="text-success">abierta hasta el {conv.fechaLimite}</span> : <span className="text-muted">cerrada</span>}
            </h3>
            {convocatorias && convocatorias.length > 1 && (
              <select value={elegida ?? ''} onChange={(e) => setElegida(e.target.value)} className={CAJA} aria-label="Periodo">
                {convocatorias.map((c) => <option key={c.convocatoriaId} value={c.convocatoriaId}>{c.anio} · periodo {c.periodo}</option>)}
              </select>
            )}
          </div>

          <div className="flex flex-wrap items-end gap-2">
            <label className="flex flex-col gap-1 text-xs text-muted">
              Mover la fecha límite
              <input
                type="date"
                defaultValue={conv.fechaLimite}
                onBlur={(e) => e.target.value && e.target.value !== conv.fechaLimite &&
                  void hacer(() => actualizarConvocatoriaAlerta(conv.convocatoriaId, { fechaLimite: e.target.value }))}
                className={CAJA}
              />
            </label>
            {conv.abierta ? (
              <button disabled={guardando} onClick={() => void hacer(() => actualizarConvocatoriaAlerta(conv.convocatoriaId, { abierta: false }))} className={`${BOTON} border border-line text-strong`}>
                Cerrar la alerta
              </button>
            ) : (
              <button disabled={guardando} onClick={() => void hacer(() => actualizarConvocatoriaAlerta(conv.convocatoriaId, { abierta: true }))} className={`${BOTON} border border-line text-strong`}>
                Reabrir
              </button>
            )}
          </div>

          <FranjaEntrega conv={conv} guardando={guardando} onGuardar={(c) => void hacer(() => actualizarConvocatoriaAlerta(conv.convocatoriaId, c))} />

          <label className="flex flex-wrap items-center gap-2 text-xs text-muted">
            Días hábiles para justificar la inasistencia a la entrega
            <input
              type="number"
              min={1}
              max={10}
              defaultValue={conv.plazoExcusaDias ?? PLAZO_EXCUSA_DIAS}
              onBlur={(e) => {
                const n = Math.min(10, Math.max(1, Math.round(+e.target.value || PLAZO_EXCUSA_DIAS)));
                if (n !== (conv.plazoExcusaDias ?? PLAZO_EXCUSA_DIAS)) void hacer(() => actualizarConvocatoriaAlerta(conv.convocatoriaId, { plazoExcusaDias: n }));
              }}
              className={`${CAJA} w-16`}
            />
            <span>(no hay plazo nacional: lo fija la institución)</span>
          </label>

          <div className="flex flex-col gap-2 border-t border-line pt-3">
            <p className="text-xs text-muted">
              Todo lo que hay que imprimir de la jornada en un solo archivo: las citaciones y los informes individuales
              (4 por hoja), la planilla de asistencia de cada grupo y las constancias de asistencia en blanco para el
              día de la entrega. Ábralo, guárdelo como PDF y envíelo a biblioteca en un solo correo.
            </p>
            {sinAgenda.length > 0 && (
              <p className="rounded-xl bg-warning-soft px-3 py-2 text-xs text-warning-soft-fg">
                Aún sin agenda de citaciones guardada: {sinAgenda.join(', ')}. Sus citaciones no saldrán en el archivo hasta que el director la guarde.
              </p>
            )}
            <div className="flex flex-wrap items-end gap-2">
              <label className="flex flex-col gap-1 text-xs text-muted">
                Orden de las planillas de asistencia
                <select value={ordenPlanilla} onChange={(e) => setOrdenPlanilla(e.target.value as OrdenPlanilla)} className={CAJA}>
                  <option value="hora">Por hora de citación</option>
                  <option value="alfabetico">Alfabético</option>
                </select>
              </label>
              <label className="flex flex-col gap-1 text-xs text-muted">
                Constancias en blanco (sugerido {constanciasSugeridas})
                <input type="number" min={0} step={4} value={nConstancias} onChange={(e) => setConstancias(Math.max(0, +e.target.value))} className={`${CAJA} w-24`} />
              </label>
              <button disabled={guardando} onClick={() => void descargarTodo()} className={`${BOTON} bg-accent text-accent-fg`}>
                Descargar todo para imprimir
              </button>
            </div>
          </div>
        </section>
      )}

      {error && <p className="text-sm text-danger">{error}</p>}

      {/* 3. Avance por grupo */}
      {conv && (
        <section className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold text-strong">Avance por grupo</h3>
          {planillas === null ? (
            <p className="p-3 text-sm text-muted">Cargando…</p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {avance.map((a) => (
                <button
                  key={a.grado}
                  onClick={() => setGrupoAbierto(a.grado)}
                  className="flex items-center gap-3 rounded-xl border border-line bg-card p-3 text-left hover:bg-elevated"
                >
                  <span className="text-lg font-bold text-strong">{a.grado}</span>
                  <span className="flex-1 text-xs text-muted">
                    {a.entregadas} de {a.esperadas} entregadas
                    {a.entregadas === a.esperadas && a.esperadas > 0 && <span className="text-success"> ✓</span>}
                  </span>
                  {a.citados > 0 && (
                    <span className="rounded-full bg-warning-soft px-2 py-0.5 text-xs font-semibold text-warning-soft-fg">{a.citados} por citar</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </section>
      )}

      {conv && (
        <SeguimientoCoordinacion
          sede={sede}
          conv={conv}
          agendas={agendas}
          directores={directores}
          onRecargar={() => void agendasDeJornada(sede, jornada, conv.anio, conv.periodo).then(setAgendas)}
        />
      )}
    </div>
  );
}

function FranjaEntrega({
  conv,
  guardando,
  onGuardar,
}: {
  conv: ConvocatoriaAlerta;
  guardando: boolean;
  onGuardar: (c: { fechaEntrega: string | null; franjaInicio: string | null; franjaFin: string | null }) => void;
}) {
  const [fecha, setFecha] = useState(conv.fechaEntrega ?? '');
  const [inicio, setInicio] = useState(conv.franjaInicio ?? '');
  const [fin, setFin] = useState(conv.franjaFin ?? '');
  const valida = fecha && inicio && fin && inicio < fin;
  const cambio = fecha !== (conv.fechaEntrega ?? '') || inicio !== (conv.franjaInicio ?? '') || fin !== (conv.franjaFin ?? '');
  return (
    <div className="flex flex-col gap-2 border-t border-line pt-3">
      <p className="text-xs text-muted">
        Día y franja de entrega a las familias. Cada director reparte dentro de ella las horas de sus citados.
      </p>
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1 text-xs text-muted">Día<input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className={CAJA} /></label>
        <label className="flex flex-col gap-1 text-xs text-muted">Desde<input type="time" value={inicio} onChange={(e) => setInicio(e.target.value)} className={CAJA} /></label>
        <label className="flex flex-col gap-1 text-xs text-muted">Hasta<input type="time" value={fin} onChange={(e) => setFin(e.target.value)} className={CAJA} /></label>
        <button
          disabled={guardando || !valida || !cambio}
          onClick={() => onGuardar({ fechaEntrega: fecha, franjaInicio: inicio, franjaFin: fin })}
          className={`${BOTON} bg-accent text-accent-fg`}
        >
          Guardar franja
        </button>
      </div>
      {inicio && fin && inicio >= fin && <p className="text-xs text-danger">La hora de inicio debe ser anterior a la de fin.</p>}
    </div>
  );
}
