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
import {
  ajusteDeJornada,
  combinarPlanillas,
  consolidarGrupo,
  convocatoriaDelGrado,
  correrBandas,
  excepcionPropuesta,
  fechaCorta,
  problemasExcepcion,
  agendaSinDecisiones,
  agendaVigente,
  normalizarBandas,
  problemasBandas,
  textoRango,
  alertaPorEmpezar,
  convocatoriaEditable,
  horaCorta,
  LIMITES_PARAMETROS,
  metodoDeConvocatoria,
  MINIMO_PARA_CITAR,
  NOMBRE_MODO,
  normalizarParametros,
  PARAMETROS_POR_DEFECTO,
  type Citado,
  type FilaDigitacion,
  type MetodoAgenda,
} from './domain/alerta-academica';
import { nombreCompleto, ordenarEstudiantes } from './domain/nombres';
import { citacionesDelGrupo, imprimirTodo, informesDelGrupo, nombreDirector, planillaDelGrupo, type OrdenPlanilla } from './imprimirAlerta';
import { asignaturasDelGrado } from './horarioDelDia';
import ReporteAlerta from './ReporteAlerta';
import AlertaAcademica from './AlertaAcademica';
import DigitacionPorCoordinacion, { nombreDelPuesto } from './DigitacionPorCoordinacion';
import SeguimientoCoordinacion from './SeguimientoCoordinacion';
import PanoramaAlerta from './PanoramaAlerta';
import { fechaLarga } from './domain/imprimibles-alerta';
import { PLAZO_EXCUSA_DIAS } from './domain/seguimiento-alerta';
import type { AgendaCitaciones, BandaAgenda, ConvocatoriaAlerta, ExcepcionAgenda, Jornada, ModoAgenda, ParametrosAgenda, PlanillaAlerta, Sede, Student } from './domain/types';

const CAJA = 'rounded-lg border border-line bg-elevated px-2 py-1.5 text-sm text-strong';
const BOTON = 'min-h-[40px] rounded-xl px-4 text-sm font-semibold disabled:opacity-50';

/**
 * Alerta academica — la seccion de COORDINACION (Julian, 2026-10-02).
 *
 *  1. Abre la convocatoria del periodo con su fecha limite, la cierra y la reabre.
 *  2. Pone el dia y la franja de entrega a las familias, y la FORMA de citar (turnos, reunion
 *     general o mixta, con sus parametros: el colegio, 2026-10-22). Las horas de cada citado
 *     se le proponen al director con esa forma; el director ya no la elige.
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
  // «Gestión» (lo de siempre) o «Panorama» (por jornada y por sede, sin nombres; 2026-10-24).
  const [verPanorama, setVerPanorama] = useState(false);
  // Asignatura del grupo abierto que coordinacion digita en nombre del docente (2026-10-22).
  const [digitando, setDigitando] = useState<FilaDigitacion | null>(null);
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
  const [horaNueva, setHoraNueva] = useState('');

  async function recargar(seleccion?: string) {
    const cs = await convocatoriasAlerta(sede, jornada).catch(() => []);
    setConvocatorias(cs);
    setElegida(seleccion ?? (cs.find((c) => c.abierta) ?? cs[0])?.convocatoriaId ?? null);
  }
  useEffect(() => { void recargar(); }, [sede, jornada]); // eslint-disable-line react-hooks/exhaustive-deps

  const conv = convocatorias?.find((c) => c.convocatoriaId === elegida) ?? null;

  function recargarPlanillas() {
    if (!conv) return;
    void alertasDeJornada(sede, jornada, conv.anio, conv.periodo).then(setPlanillas).catch(() => undefined);
  }

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
    const del = combinarPlanillas((planillas ?? []).filter((p) => p.grado === g), esperadas);
    const entregadas = esperadas.filter((e) => del.some((p) => p.subjectId === e.subjectId && p.entregada)).length;
    const cuenta = new Map<string, number>();
    for (const p of del) for (const [id, m] of Object.entries(p.estudiantes ?? {})) if (m === 'alerta') cuenta.set(id, (cuenta.get(id) ?? 0) + 1);
    // Para la cuenta de tiempo de la forma de citar basta el numero de asignaturas: el nombre
    // solo cambia el orden, no los minutos.
    const listaCitados: Citado[] = [...cuenta.entries()]
      .filter(([, n]) => n >= MINIMO_PARA_CITAR)
      .map(([studentId, n]) => ({ studentId, nombre: studentId, asignaturas: n }));
    return { grado: g, esperadas: esperadas.length, entregadas, citados: listaCitados.length, listaCitados };
  }), [gradosJornada, planillas]);

  // Grupos con citados (dos o mas alertas) cuyo director aun no guardo la agenda. Con la
  // REUNION GENERAL no hace falta: el archivo la arma solo (ver `descargarTodo`).
  const esGeneral = agendaSinDecisiones(metodoDeConvocatoria(conv));
  const sinAgenda = esGeneral ? [] : avance.filter((a) => a.citados > 0 && !agendas.some((x) => x.grado === a.grado)).map((a) => a.grado);
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
   * La descarga de la jornada (Julian, 2026-10-03): coordinacion centraliza la impresion.
   * Desde el 2026-10-24, UN ARCHIVO POR PARTE (citaciones, informes, planillas, soportes):
   * en uno solo, separar y cortar al imprimir era un enredo.
   */
  async function descargarTodo(parte: ParteImpresion) {
    if (!conv) return;
    setGuardando(true);
    setError(null);
    try {
      const todos = estudiantes ?? (await leerEstudiantesDeSede(sede));
      if (!estudiantes) setEstudiantes(todos);
      const frescas = await agendasDeJornada(sede, jornada, conv.anio, conv.periodo);
      setAgendas(frescas);
      const titulo = `${NOMBRE_PARTE[parte]} · alerta académica · jornada ${jornada === 'manana' ? 'mañana' : 'tarde'} · periodo ${conv.periodo}`;
      const citaciones: ReturnType<typeof citacionesDelGrupo> = [];
      const informes: ReturnType<typeof informesDelGrupo> = [];
      const firmas: NonNullable<ReturnType<typeof planillaDelGrupo>>[] = [];
      for (const g of gradosJornada) {
        // Cada grupo con su convocatoria: la de todos o su caso especial (fecha, franja, horas).
        const cg = convocatoriaDelGrado(conv, g);
        const metodo = metodoDeConvocatoria(cg);
        const franja = cg.franjaInicio && cg.franjaFin ? { inicio: cg.franjaInicio, fin: cg.franjaFin } : null;
        const del = ordenarEstudiantes(todos.filter((e) => e.gradoActual === g && e.activo !== false));
        const c = consolidarGrupo((planillas ?? []).filter((p) => p.grado === g), asignaturasDelGrado(g), del.map((e) => e.studentId));
        informes.push(...informesDelGrupo(g, cg, c.filas, del, nombreDirector(directores[g])));
        // La agenda guardada por el director; con la REUNION GENERAL y sin agenda, la que
        // propone la forma de coordinacion (todos a la misma hora): ningun grupo queda fuera.
        let a = frescas.find((x) => x.grado === g);
        if (agendaSinDecisiones(metodo) && metodo && franja) {
          // La forma la decide coordinacion: si la guardada se armo con otra (o no hay), se
          // imprime con la vigente, conservando lo registrado de cada familia.
          const citados = c.filas.filter((f) => f.citar).map((f) => ({ studentId: f.studentId, nombre: f.studentId, asignaturas: f.total }));
          a = agendaVigente(a, { anio: conv.anio, periodo: conv.periodo, sede, jornada, grado: g }, citados, franja, metodo) ?? undefined;
        }
        if (!a) continue;
        citaciones.push(...citacionesDelGrupo(g, cg, a, todos.filter((e) => e.gradoActual === g), nombreDirector(directores[g])));
        const pf = planillaDelGrupo(g, cg, a, c.filas, del, nombreDirector(directores[g]), ordenPlanilla);
        if (pf) firmas.push(pf);
      }
      const vacio = parte === 'citaciones' ? citaciones.length === 0
        : parte === 'informes' ? informes.length === 0
        : parte === 'planillas' ? firmas.length === 0
        : !conv.fechaEntrega || nConstancias === 0;
      if (vacio) {
        setError(parte === 'soportes'
          ? 'Para los soportes hace falta el día de entrega y al menos una constancia.'
          : `No hay ${NOMBRE_PARTE[parte].toLowerCase()} para imprimir todavía.`);
        return;
      }
      const ok = imprimirTodo(
        sede,
        parte === 'citaciones' ? citaciones : [],
        parte === 'informes' ? informes : [],
        titulo,
        parte === 'planillas' ? firmas : [],
        parte === 'soportes' && conv.fechaEntrega ? { fecha: fechaLarga(conv.fechaEntrega), cuantas: nConstancias } : null,
      );
      if (!ok) setError('El navegador bloqueó la ventana de impresión: permita las ventanas emergentes de la app.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo preparar el documento.');
    } finally {
      setGuardando(false);
    }
  }

  if (grupoAbierto && digitando && conv) {
    return (
      <div className="flex flex-col gap-3">
        <button
          onClick={() => { setDigitando(null); recargarPlanillas(); }}
          className="group inline-flex min-h-[44px] items-center gap-1 self-start text-sm text-accent"
        >
          <FlechaNeon direccion="izquierda" tamano="sm" /> Asignaturas de {grupoAbierto}
        </button>
        {estudiantes === null ? (
          <p className="p-3 text-sm text-muted">Cargando el grupo…</p>
        ) : (
          <AlertaAcademica
            key={`${grupoAbierto}-${digitando.subjectId}`}
            grado={grupoAbierto}
            subjectId={digitando.subjectId}
            nombreAsignatura={digitando.nombre}
            sede={sede}
            slotId={digitando.slotResponsable}
            estudiantes={estudiantes.filter((e) => e.gradoActual === grupoAbierto)}
            puedeRegistrar
            porCoordinacion={{ nombreDocente: nombreDelPuesto(digitando.slotResponsable) }}
            convocatoriaId={conv.convocatoriaId}
            onCambio={recargarPlanillas}
          />
        )}
      </div>
    );
  }

  if (grupoAbierto) {
    return (
      <div className="flex flex-col gap-3">
        <button onClick={() => { setGrupoAbierto(null); setDigitando(null); }} className="group inline-flex min-h-[44px] items-center gap-1 self-start text-sm text-accent"><FlechaNeon direccion="izquierda" tamano="sm" /> Todos los grupos</button>
        {conv && planillas && (
          <DigitacionPorCoordinacion
            grado={grupoAbierto}
            sede={sede}
            conv={conv}
            planillas={planillas}
            onDigitar={setDigitando}
            onCambio={recargarPlanillas}
            nombreDe={(id) => { const e = estudiantes?.find((x) => x.studentId === id); return e ? nombreCompleto(e) : id; }}
          />
        )}
        {conv && (
          <CasosEspeciales
            key={`caso-${conv.convocatoriaId}-${grupoAbierto}`}
            conv={conv}
            grados={[grupoAbierto]}
            soloGrado={grupoAbierto}
            guardando={guardando}
            onGuardar={(x) => void hacer(() => actualizarConvocatoriaAlerta(conv.convocatoriaId, { excepcionesAgenda: x }))}
          />
        )}
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
  const selectorVista = (
    <div className="inline-flex rounded-xl border border-line p-0.5" role="group" aria-label="Vista">
      {[false, true].map((v) => (
        <button
          key={String(v)}
          type="button"
          aria-pressed={verPanorama === v}
          onClick={() => setVerPanorama(v)}
          className={`min-h-[40px] rounded-lg px-3 text-sm font-semibold ${verPanorama === v ? 'bg-accent text-accent-fg' : 'text-strong'}`}
        >
          {v ? 'Panorama' : 'Gestión'}
        </button>
      ))}
    </div>
  );

  if (verPanorama) {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="flex-1 text-lg font-semibold text-strong">Alerta académica</h2>
          {selectorVista}
        </div>
        <PanoramaAlerta sede={sede} jornadaLimitada={jornadaLimitada ?? null} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="flex-1 text-lg font-semibold text-strong">Alerta académica</h2>
        {selectorVista}
        {!jornadaLimitada && (
          <div className="flex gap-1.5">
            {(['manana', 'tarde'] as const).map((j) => (
              <button
                key={j}
                onClick={() => { setJornada(j); setGrupoAbierto(null); setDigitando(null); }}
                className={`min-h-[44px] rounded-full border px-3 text-sm ${jornada === j ? 'border-accent bg-accent-soft font-semibold text-accent-soft-fg' : 'border-line text-soft'}`}
              >
                {j === 'manana' ? 'Mañana' : 'Tarde'}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Revision de UX (2026-10-25): lo que se consulta a diario va primero —el estado y el
          avance por grupo—; abrir, configurar e imprimir quedan plegados abajo. */}
      {conv && (
        <section className="flex flex-wrap items-center gap-2 rounded-2xl border border-line bg-card p-3">
          <p className="flex-1 text-sm text-strong">
            <b>Periodo {conv.periodo}</b> ·{' '}
            {editable ? (
              <span className="text-success">abierta hasta el {conv.fechaLimite}{conv.horaLimite ? ` a las ${horaCorta(conv.horaLimite)}` : ''}</span>
            ) : conv.abierta && alertaPorEmpezar(conv) && conv.fechaInicio && conv.horaInicio ? (
              <span className="text-info-soft-fg">se habilita el {conv.fechaInicio} a las {horaCorta(conv.horaInicio)}</span>
            ) : (
              <span className="text-muted">cerrada</span>
            )}
            {planillas !== null && (
              <> · {avance.filter((a) => a.esperadas > 0 && a.entregadas === a.esperadas).length} de {avance.length} grupos completos · {avance.reduce((n, a) => n + a.citados, 0)} por citar</>
            )}
          </p>
          {convocatorias && convocatorias.length > 1 && (
            <select value={elegida ?? ''} onChange={(e) => setElegida(e.target.value)} className={CAJA} aria-label="Periodo">
              {convocatorias.map((c) => <option key={c.convocatoriaId} value={c.convocatoriaId}>{c.anio} · periodo {c.periodo}</option>)}
            </select>
          )}
        </section>
      )}

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
                  {conv.excepcionesAgenda?.[a.grado] && (
                    <span className="rounded-full bg-elevated px-2 py-0.5 text-xs font-semibold text-strong">caso especial</span>
                  )}
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
      {error && <p className="text-sm text-danger">{error}</p>}

      <details className="group rounded-2xl border border-line bg-card" open={!conv}>
        <summary className="flex min-h-[48px] cursor-pointer items-center px-4 text-sm font-semibold text-strong">
          Administrar la alerta: abrir un periodo, horario, entrega, forma de citar e imprimir
        </summary>
        <div className="flex flex-col gap-3 p-3 pt-0">
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
          <label className="flex flex-col gap-1 text-xs text-muted">
            Hora de cierre (opcional)
            <input type="time" value={horaNueva} onChange={(e) => setHoraNueva(e.target.value)} className={CAJA} />
          </label>
          <button
            disabled={guardando || !limiteNuevo || yaExiste}
            onClick={() => void hacer(
              () => abrirConvocatoriaAlerta({ anio: hoy.getFullYear(), periodo: periodoNuevo, sede, jornada, fechaLimite: limiteNuevo, horaLimite: horaNueva || null }),
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
              {conv.anio} · periodo {conv.periodo} ·{' '}
              {editable ? (
                <span className="text-success">abierta hasta el {conv.fechaLimite}{conv.horaLimite ? ` a las ${horaCorta(conv.horaLimite)}` : ''}</span>
              ) : conv.abierta && alertaPorEmpezar(conv) && conv.fechaInicio && conv.horaInicio ? (
                <span className="text-info-soft-fg">programada: se habilita el {conv.fechaInicio} a las {horaCorta(conv.horaInicio)}</span>
              ) : (
                <span className="text-muted">cerrada</span>
              )}
            </h3>
            {convocatorias && convocatorias.length > 1 && (
              <select value={elegida ?? ''} onChange={(e) => setElegida(e.target.value)} className={CAJA} aria-label="Periodo">
                {convocatorias.map((c) => <option key={c.convocatoriaId} value={c.convocatoriaId}>{c.anio} · periodo {c.periodo}</option>)}
              </select>
            )}
          </div>

          <div className="flex flex-wrap items-end gap-2">
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

          <HorarioAlerta
            key={`horario-${conv.convocatoriaId}`}
            conv={conv}
            guardando={guardando}
            onGuardar={(c) => void hacer(() => actualizarConvocatoriaAlerta(conv.convocatoriaId, c))}
          />

          <FranjaEntrega key={`franja-${conv.convocatoriaId}`} conv={conv} guardando={guardando} onGuardar={(c) => void hacer(() => actualizarConvocatoriaAlerta(conv.convocatoriaId, c))} />

          <MetodoCitacion
            key={`metodo-${conv.convocatoriaId}`}
            conv={conv}
            guardando={guardando}
            grupos={avance.filter((a) => !conv.excepcionesAgenda?.[a.grado]).map((a) => ({ grado: a.grado, citados: a.listaCitados }))}
            conAgenda={agendas.length}
            onGuardar={(m) => void hacer(() => actualizarConvocatoriaAlerta(conv.convocatoriaId, {
              modoAgenda: m.modo, parametrosAgenda: m.parametros, bandasAgenda: m.modo === 'mixta' ? m.bandas ?? null : null,
            }))}
          />

          <CasosEspeciales
            key={`casos-${conv.convocatoriaId}`}
            conv={conv}
            grados={gradosJornada}
            guardando={guardando}
            onGuardar={(x) => void hacer(() => actualizarConvocatoriaAlerta(conv.convocatoriaId, { excepcionesAgenda: x }))}
          />

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
              Lo que hay que imprimir de la jornada, un archivo por cada parte: las citaciones y los informes individuales
              (4 por hoja), la planilla de asistencia de cada grupo y los soportes de asistencia (constancias en blanco)
              para el día de la entrega. Ábralos, guárdelos como PDF y envíelos a biblioteca.
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
            </div>
            <div className="flex flex-wrap gap-2">
              {PARTES.map((parte) => (
                <button key={parte} disabled={guardando} onClick={() => void descargarTodo(parte)} className={`${BOTON} bg-accent text-accent-fg`}>
                  {NOMBRE_PARTE[parte]}
                </button>
              ))}
            </div>
          </div>
        </section>
      )}

        </div>
      </details>
    </div>
  );
}

/**
 * Cuando pueden marcar los docentes (Julian, 2026-10-22: «ademas de la fecha, la hora, y
 * poder habilitarla de tal hora a tal hora por cualquier eventualidad»). La hora de cierre
 * es opcional: sin ella, fin del dia, como siempre. «Habilitar desde» tambien: sin ella,
 * desde que se abre. Lo que ya estaba organizado no cambia mientras no se toque aqui.
 */
function HorarioAlerta({
  conv,
  guardando,
  onGuardar,
}: {
  conv: ConvocatoriaAlerta;
  guardando: boolean;
  onGuardar: (c: { fechaLimite: string; horaLimite: string | null; fechaInicio: string | null; horaInicio: string | null }) => void;
}) {
  const [fecha, setFecha] = useState(conv.fechaLimite);
  const [hora, setHora] = useState(conv.horaLimite ?? '');
  const [fechaIni, setFechaIni] = useState(conv.fechaInicio ?? '');
  const [horaIni, setHoraIni] = useState(conv.horaInicio ?? '');
  const ventanaIncompleta = (!!fechaIni) !== (!!horaIni);
  const inicioDespuesDelCierre =
    !!fechaIni && !!horaIni && `${fechaIni}T${horaIni}` >= `${fecha}T${hora || '23:59'}`;
  const cambio =
    fecha !== conv.fechaLimite || hora !== (conv.horaLimite ?? '') ||
    fechaIni !== (conv.fechaInicio ?? '') || horaIni !== (conv.horaInicio ?? '');
  const valida = !!fecha && !ventanaIncompleta && !inicioDespuesDelCierre;
  return (
    <div className="flex flex-col gap-2 border-t border-line pt-3">
      <p className="text-xs text-muted">
        Hasta cuándo pueden marcar los docentes. Sin hora de cierre, la alerta cierra al final del día. Para habilitarla solo
        en una franja (por ejemplo hoy de 2:00 a 4:00 p. m.), ponga también «Habilitar desde»; si estaba cerrada, use «Reabrir».
      </p>
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1 text-xs text-muted">Fecha límite<input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className={CAJA} /></label>
        <label className="flex flex-col gap-1 text-xs text-muted">Hora de cierre (opcional)<input type="time" value={hora} onChange={(e) => setHora(e.target.value)} className={CAJA} /></label>
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1 text-xs text-muted">Habilitar desde: día (opcional)<input type="date" value={fechaIni} onChange={(e) => setFechaIni(e.target.value)} className={CAJA} /></label>
        <label className="flex flex-col gap-1 text-xs text-muted">Hora<input type="time" value={horaIni} onChange={(e) => setHoraIni(e.target.value)} className={CAJA} /></label>
        {(fechaIni || horaIni) && (
          <button type="button" onClick={() => { setFechaIni(''); setHoraIni(''); }} className={`${BOTON} border border-line text-strong`}>
            Quitar «desde»
          </button>
        )}
        <button
          type="button"
          disabled={guardando || !valida || !cambio}
          onClick={() => onGuardar({ fechaLimite: fecha, horaLimite: hora || null, fechaInicio: fechaIni || null, horaInicio: horaIni || null })}
          className={`${BOTON} bg-accent text-accent-fg`}
        >
          Guardar horario
        </button>
      </div>
      {ventanaIncompleta && <p className="text-xs text-danger">Para «Habilitar desde» ponga el día y la hora.</p>}
      {inicioDespuesDelCierre && <p className="text-xs text-danger">«Habilitar desde» debe ser antes del cierre.</p>}
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
        Día y franja de entrega a las familias. A cada director se le propone dentro de ella la agenda de sus citados, con la forma de citar que usted defina abajo.
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

/**
 * Casos especiales (Julian, 2026-10-23): un director de grupo que entrega en otra fecha, en
 * otra franja y, con la mixta por rangos, a otras horas. Lo decide SOLO coordinacion; al
 * director se le muestra y su agenda, citaciones y planilla de firmas salen con esto.
 */
function CasosEspeciales({
  conv,
  grados,
  soloGrado,
  guardando,
  onGuardar,
}: {
  conv: ConvocatoriaAlerta;
  grados: string[];
  /** En la vista de un grupo: solo su caso, sin escoger grupo. */
  soloGrado?: string;
  guardando: boolean;
  onGuardar: (x: Record<string, ExcepcionAgenda> | null) => void;
}) {
  const todos = conv.excepcionesAgenda ?? {};
  const casos = soloGrado ? Object.fromEntries(Object.entries(todos).filter(([g]) => g === soloGrado)) : todos;
  const [grado, setGrado] = useState<string | null>(null);
  const [x, setX] = useState<ExcepcionAgenda>(() => excepcionPropuesta(conv));
  const errores = grado ? problemasExcepcion(x) : [];
  const libres = grados.filter((g) => !casos[g] || g === grado);

  function editar(g: string) {
    setGrado(g);
    setX(casos[g] ?? excepcionPropuesta(conv));
  }
  function ponerInicio(inicio: string) {
    setX((v) => ({ ...v, franjaInicio: inicio, bandas: v.bandas ? correrBandas(v.bandas, v.franjaInicio, inicio) : v.bandas }));
  }
  function guardar() {
    if (!grado || errores.length) return;
    onGuardar({ ...todos, [grado]: x });
    setGrado(null);
  }
  function quitar(g: string) {
    const resto = Object.fromEntries(Object.entries(todos).filter(([k]) => k !== g));
    onGuardar(Object.keys(resto).length ? resto : null);
  }

  return (
    <div className={soloGrado ? 'flex flex-col gap-2 rounded-2xl border border-line bg-card p-4' : 'flex flex-col gap-2 border-t border-line pt-3'}>
      <h4 className="text-sm font-semibold text-strong">{soloGrado ? `Caso especial de ${soloGrado}` : 'Casos especiales por grupo'}</h4>
      <p className="text-xs text-muted">
        {soloGrado
          ? `Si el director de ${soloGrado} necesita entregar en otro día u otro horario, defínalo aquí: este grupo sale con su propia fecha y franja en la agenda, las citaciones y la planilla de firmas.`
          : 'Si un director de grupo necesita entregar en otro día u otro horario, defínalo aquí (o desde la tarjeta del grupo, en «Avance por grupo»). Ese grupo sale con su propia fecha y franja en la agenda, las citaciones y la planilla de firmas; los demás siguen igual.'}
      </p>
      {Object.keys(casos).length > 0 && (
        <ul className="flex flex-col gap-1">
          {Object.entries(casos).sort(([a], [b]) => a.localeCompare(b, 'es', { numeric: true })).map(([g, c]) => (
            <li key={g} className="flex flex-wrap items-center gap-2 rounded-xl border border-line px-3 py-2 text-sm">
              <b className="text-strong">{g}</b>
              <span className="flex-1 text-soft">
                {fechaCorta(c.fechaEntrega)}, de {horaCorta(c.franjaInicio)} a {horaCorta(c.franjaFin)}
                {c.bandas?.length ? ` · ${c.bandas.map((b) => `${textoRango(b)}: ${horaCorta(b.hora)}`).join(' · ')}` : ''}
                {c.motivo ? ` · ${c.motivo}` : ''}
              </span>
              <button type="button" disabled={guardando} onClick={() => editar(g)} className={`${BOTON} border border-line text-strong`}>Cambiar</button>
              <button type="button" disabled={guardando} onClick={() => quitar(g)} className={`${BOTON} border border-line text-strong`}>Quitar</button>
            </li>
          ))}
        </ul>
      )}
      {grado === null ? (
        <button type="button" disabled={guardando || libres.length === 0} onClick={() => editar(libres[0])} className={`${BOTON} self-start border border-line text-strong`}>
          {soloGrado ? `+ Definir caso especial para ${soloGrado}` : '+ Agregar caso especial'}
        </button>
      ) : (
        <div className="flex flex-col gap-2 rounded-xl border border-line p-3">
          <div className="flex flex-wrap items-end gap-2">
            <label className="flex flex-col gap-1 text-xs text-muted">Grupo
              <select value={grado} onChange={(e) => editar(e.target.value)} className={CAJA}>
                {libres.map((g) => <option key={g} value={g}>{g}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs text-muted">Día
              <input type="date" value={x.fechaEntrega} onChange={(e) => setX({ ...x, fechaEntrega: e.target.value })} className={CAJA} />
            </label>
            <label className="flex flex-col gap-1 text-xs text-muted">Desde
              <input type="time" value={x.franjaInicio} onChange={(e) => ponerInicio(e.target.value)} className={CAJA} />
            </label>
            <label className="flex flex-col gap-1 text-xs text-muted">Hasta
              <input type="time" value={x.franjaFin} onChange={(e) => setX({ ...x, franjaFin: e.target.value })} className={CAJA} />
            </label>
            <label className="flex flex-1 flex-col gap-1 text-xs text-muted">Motivo (opcional)
              <input type="text" maxLength={200} value={x.motivo ?? ''} onChange={(e) => setX({ ...x, motivo: e.target.value })} className={CAJA} />
            </label>
          </div>
          {x.bandas?.length ? (
            <div className="flex flex-col gap-1">
              <p className="text-xs text-muted">Horas de cada rango para este grupo (se corren solas al cambiar «Desde»):</p>
              {x.bandas.map((b, i) => (
                <div key={i} className="flex flex-wrap items-end gap-2">
                  <span className="w-28 text-sm text-strong">{textoRango(b)} asig.</span>
                  <label className="flex flex-col gap-1 text-xs text-muted">Hora
                    <input type="time" value={b.hora} onChange={(e) => setX({ ...x, bandas: x.bandas!.map((y, j) => (j === i ? { ...y, hora: e.target.value } : y)) })} className={CAJA} />
                  </label>
                  <label className="flex flex-col gap-1 text-xs text-muted">Reunión (min)
                    <input type="number" min={5} max={240} value={b.duracionMin} onChange={(e) => setX({ ...x, bandas: x.bandas!.map((y, j) => (j === i ? { ...y, duracionMin: +e.target.value } : y)) })} className={`${CAJA} w-20`} />
                  </label>
                </div>
              ))}
            </div>
          ) : null}
          {errores.length > 0 && (
            <ul className="list-disc pl-5 text-xs text-danger">{errores.map((e) => <li key={e}>{e}</li>)}</ul>
          )}
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={guardando || errores.length > 0} onClick={guardar} className={`${BOTON} bg-accent text-accent-fg`}>Guardar caso especial</button>
            <button type="button" onClick={() => setGrado(null)} className={`${BOTON} border border-line text-strong`}>Cancelar</button>
          </div>
        </div>
      )}
    </div>
  );
}

type ParteImpresion = 'citaciones' | 'informes' | 'planillas' | 'soportes';
const PARTES: ParteImpresion[] = ['citaciones', 'informes', 'planillas', 'soportes'];
const NOMBRE_PARTE: Record<ParteImpresion, string> = {
  citaciones: 'Citaciones',
  informes: 'Informes',
  planillas: 'Planillas de asistencia',
  soportes: 'Soportes de asistencia',
};

const MODOS: { modo: ModoAgenda; ayuda: string }[] = [
  { modo: 'turnos', ayuda: 'Cada acudiente con su hora; más asignaturas, más tiempo.' },
  { modo: 'general', ayuda: 'Todos a la misma hora, al inicio de la franja.' },
  { modo: 'mixta', ayuda: 'Reunión corta para los leves y turnos para los demás.' },
];

/**
 * La forma de citar a los acudientes — la define SOLO coordinacion, por convocatoria (el
 * colegio, 2026-10-22). Mismas opciones y parametros que antes elegia cada director; con
 * esto se le propone a cada uno la agenda de su grupo. La cuenta de tiempo por grupo que
 * antes veia el director la ve ahora quien decide.
 */
function MetodoCitacion({
  conv,
  guardando,
  grupos,
  conAgenda,
  onGuardar,
}: {
  conv: ConvocatoriaAlerta;
  guardando: boolean;
  grupos: { grado: string; citados: Citado[] }[];
  /** Cuantos directores ya guardaron agenda: cambiar la forma no se la modifica. */
  conAgenda: number;
  onGuardar: (m: MetodoAgenda) => void;
}) {
  const guardado = metodoDeConvocatoria(conv);
  const [modo, setModo] = useState<ModoAgenda>(guardado?.modo ?? 'turnos');
  const [p, setP] = useState<ParametrosAgenda>(guardado?.parametros ?? PARAMETROS_POR_DEFECTO);
  const franja = conv.franjaInicio && conv.franjaFin ? { inicio: conv.franjaInicio, fin: conv.franjaFin } : null;
  // Mixta por rangos (2026-10-23): si no hay guardados, se sugieren tres para editar.
  const [bandas, setBandas] = useState<BandaAgenda[]>(
    guardado?.bandas?.length ? guardado.bandas : [
      { desde: 2, hasta: 3, hora: franja?.inicio ?? '07:00', duracionMin: 45 },
      { desde: 4, hasta: 6, hora: '', duracionMin: 45 },
      { desde: 7, hasta: null, hora: '', duracionMin: 45 },
    ],
  );
  const bandasN = normalizarBandas(bandas);
  const errBandas = modo === 'mixta' ? problemasBandas(bandasN, franja) : [];
  const metodo: MetodoAgenda = { modo, parametros: normalizarParametros(p), bandas: modo === 'mixta' ? bandasN : null };
  const cambio = !guardado || guardado.modo !== modo || JSON.stringify(guardado.parametros) !== JSON.stringify(metodo.parametros)
    || (modo === 'mixta' && JSON.stringify(guardado.bandas ?? []) !== JSON.stringify(bandasN));
  const ponerBanda = (i: number, b: Partial<BandaAgenda>) => setBandas(bandas.map((x, j) => (j === i ? { ...x, ...b } : x)));
  const ajuste = franja ? ajusteDeJornada(grupos, franja, metodo) : [];
  const noAlcanzan = ajuste.filter((a) => !a.alcanza);

  const numero = (k: keyof typeof LIMITES_PARAMETROS, etiqueta: string) => (
    <label className="flex flex-col gap-1 text-xs text-muted">
      {etiqueta}
      <input
        type="number"
        min={LIMITES_PARAMETROS[k].min}
        max={LIMITES_PARAMETROS[k].max}
        value={p[k]}
        onChange={(e) => setP({ ...p, [k]: e.target.value === '' ? '' : +e.target.value } as ParametrosAgenda)}
        onBlur={() => setP(normalizarParametros(p))}
        className={`${CAJA} w-20`}
      />
    </label>
  );

  return (
    <div className="flex flex-col gap-2 border-t border-line pt-3">
      <p className="text-xs text-muted">
        Forma de citar a los acudientes. La define usted para toda la jornada: los directores ven la agenda de su grupo
        ya propuesta con ella y no pueden cambiarla (sí pueden mover una hora a mano para encajar un turno).
      </p>
      {!guardado && (
        <p className="rounded-xl bg-warning-soft px-3 py-2 text-xs text-warning-soft-fg">
          Aún no la ha definido: mientras tanto, los directores no pueden armar su agenda de citaciones.
        </p>
      )}
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Forma de citar">
        {MODOS.map((m) => (
          <button
            key={m.modo}
            title={m.ayuda}
            aria-pressed={modo === m.modo}
            onClick={() => setModo(m.modo)}
            className={`min-h-[44px] rounded-full border px-3 text-sm ${modo === m.modo ? 'border-accent bg-accent-soft font-semibold text-accent-soft-fg' : 'border-line text-soft'}`}
          >
            {NOMBRE_MODO[m.modo]}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-end gap-2">
        {modo === 'turnos' && (
          <>
            {numero('baseMin', 'Base (min)')}
            {numero('porAsignaturaMin', 'Por asignatura')}
            {numero('intervaloMin', 'Entre turnos')}
          </>
        )}
        {modo === 'general' && numero('generalMin', 'Reunión (min)')}
        {modo === 'turnos' && (
          <label className="flex flex-col gap-1 text-xs text-muted">
            Orden
            <select value={p.orden} onChange={(e) => setP({ ...p, orden: e.target.value as ParametrosAgenda['orden'] })} className={CAJA}>
              <option value="mas_asignaturas">Más asignaturas primero</option>
              <option value="alfabetico">Alfabético</option>
            </select>
          </label>
        )}
        <button
          disabled={guardando || !cambio || errBandas.length > 0}
          onClick={() => { setP(metodo.parametros); if (modo === 'mixta') setBandas(bandasN); onGuardar(metodo); }}
          className={`${BOTON} bg-accent text-accent-fg`}
        >
          Guardar forma de citar
        </button>
      </div>

      {modo === 'mixta' && (
        <div className="flex flex-col gap-2 rounded-xl border border-line p-3">
          <p className="text-xs text-muted">
            Por rangos: según cuántas asignaturas tenga en alerta, cada acudiente va a la reunión de su rango. Empieza en
            {' '}{MINIMO_PARA_CITAR} (con menos no se cita) y el último rango queda abierto («o más»).
          </p>
          {bandas.map((b, i) => {
            const ultimo = i === bandas.length - 1;
            return (
              <div key={i} className="flex flex-wrap items-end gap-2">
                <label className="flex flex-col gap-1 text-xs text-muted">Desde
                  <input type="number" min={MINIMO_PARA_CITAR} value={b.desde} onChange={(e) => ponerBanda(i, { desde: +e.target.value })} className={`${CAJA} w-16`} />
                </label>
                <label className="flex flex-col gap-1 text-xs text-muted">Hasta
                  {ultimo ? (
                    <span className={`${CAJA} w-20 text-muted`}>o más</span>
                  ) : (
                    <input type="number" min={b.desde} value={b.hasta ?? ''} onChange={(e) => ponerBanda(i, { hasta: e.target.value === '' ? null : +e.target.value })} className={`${CAJA} w-16`} />
                  )}
                </label>
                <label className="flex flex-col gap-1 text-xs text-muted">Hora
                  <input type="time" value={b.hora} onChange={(e) => ponerBanda(i, { hora: e.target.value })} className={CAJA} />
                </label>
                <label className="flex flex-col gap-1 text-xs text-muted">Reunión (min)
                  <input type="number" min={5} max={240} value={b.duracionMin} onChange={(e) => ponerBanda(i, { duracionMin: +e.target.value })} className={`${CAJA} w-20`} />
                </label>
                {bandas.length > 1 && (
                  <button type="button" onClick={() => setBandas(bandas.filter((_, j) => j !== i).map((x, j, arr) => (j === arr.length - 1 ? { ...x, hasta: null } : x)))}
                    className={`${BOTON} border border-line text-strong`} aria-label={`Quitar el rango ${textoRango(b)}`}>
                    Quitar
                  </button>
                )}
              </div>
            );
          })}
          {bandas.length < 10 && (
            <button
              type="button"
              onClick={() => {
                const ult = bandas[bandas.length - 1];
                const desde = ult ? ult.desde + 1 : MINIMO_PARA_CITAR;
                setBandas([...bandas.slice(0, -1), ...(ult ? [{ ...ult, hasta: ult.desde }] : []), { desde, hasta: null, hora: '', duracionMin: ult?.duracionMin ?? 45 }]);
              }}
              className={`${BOTON} self-start border border-line text-strong`}
            >
              + Agregar rango
            </button>
          )}
          {errBandas.length > 0 && (
            <ul className="list-disc pl-5 text-xs text-danger">
              {errBandas.map((e) => <li key={e}>{e}</li>)}
            </ul>
          )}
        </div>
      )}

      {!franja ? (
        <p className="text-xs text-muted">Guarde la franja para ver si alcanza el tiempo en cada grupo.</p>
      ) : ajuste.length === 0 ? (
        <p className="text-xs text-muted">Todavía no hay estudiantes con dos o más alertas en la jornada.</p>
      ) : noAlcanzan.length === 0 ? (
        <p className="rounded-xl bg-success-soft px-3 py-2 text-xs text-success-soft-fg">
          Con esta forma alcanza la franja en los {ajuste.length} grupos con citados (con lo marcado hasta ahora).
        </p>
      ) : (
        <p className="rounded-xl bg-danger-soft px-3 py-2 text-xs text-danger-soft-fg">
          Con esta forma no alcanza la franja en {noAlcanzan.length} de {ajuste.length} grupos:{' '}
          {noAlcanzan.map((a) => `${a.grado} (${a.citados} citados, ${a.necesariosMin} min)`).join(', ')}.
          {' '}Pruebe otra forma, menos minutos o una franja más amplia.
        </p>
      )}
      {guardado && cambio && conAgenda > 0 && (
        <p className="text-xs text-muted">
          {conAgenda === 1 ? 'Un director ya guardó su agenda' : `${conAgenda} directores ya guardaron su agenda`}: cambiar la forma no se la
          modifica; a cada uno le aparecerá el aviso para volver a proponerla.
        </p>
      )}
    </div>
  );
}
