/**
 * Casos de permanencia — lo que Guardianes de la Permanencia pide seguir.
 *
 * Dos partes, en este orden:
 *
 *  1. CASOS ABIERTOS (coordinación y rectoría). Cada caso con su línea de tiempo y su
 *     próximo seguimiento; los vencidos arriba y en rojo. Se abre el detalle y se registra
 *     el seguimiento ahí mismo (`DetalleCaso`). Es la pestaña de «casos que implican
 *     seguimiento» que pidió Julián (2026-09-17), al modo de la gestión del riesgo de MJB.
 *
 *  2. ESTUDIANTES EN RIESGO (solo coordinación). Al entrar, el sistema cruza el censo de la
 *     tercera hora, las llamadas a las familias y el catálogo de motivos, dice en qué nivel
 *     está cada estudiante y ABRE SOLO los casos que hacen falta: coordinación no crea nada,
 *     gestiona.
 *
 * La rectora no ve el cálculo de la parte 2 —decisión pendiente de Julián—, pero sí gestiona
 * los casos: puede ajustar lo que le presentan antes de firmarlo.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';

import DetalleCaso from './DetalleCaso';
import {
  abrirCasosPermanencia,
  leerCasosDeSede,
  leerCensosDesde,
  leerConfigPermanencia,
  leerContactosDeSede,
  leerEstudiantesDeSede,
  leerSeguimientos,
} from './datos';
import { toDateKey } from './domain/ids';
import { nombreCompleto } from './domain/nombres';
import {
  casosPorAbrir,
  ESTADO_CASO_ETIQUETA,
  ESTADOS_ABIERTOS,
  etiquetaDeMotivo,
  evaluarEstudiante,
  inasistenciasDesdeCensos,
  NIVEL_ETIQUETA,
  ordenarPorGravedad,
  PERMANENCIA_CONFIG_POR_DEFECTO,
  type CasoPermanencia,
  type EvaluacionPermanencia,
  type NivelPermanencia,
  type PermanenciaConfig,
} from './domain/permanencia';
import { alertaDeSeguimiento, type SeguimientoCaso } from './domain/seguimiento-caso';
import { filtroEfectivo, filtroInicial, gradoEnJornada, type FiltroJornada } from './domain/filtro-jornada';
import type { FamilyContact, Jornada, Sede, Student } from './domain/types';
import SelectorJornada from './SelectorJornada';

/** Cuántos días de calendario se piden para cubrir la ventana de días con censo. Holgado a
 *  propósito: un puente festivo o una semana de receso no deben dejar la ventana corta. */
const DIAS_DE_CALENDARIO_A_LEER = 60;

function haceDias(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return toDateKey(d);
}

const TONO: Record<NivelPermanencia, string> = {
  candidato: 'border-danger-soft bg-danger-soft text-danger-soft-fg',
  alerta: 'border-warning-soft bg-warning-soft text-warning-soft-fg',
  seguimiento: 'border-line bg-elevated text-soft',
  ninguno: 'border-line bg-elevated text-muted',
};

export default function CasosPermanencia({
  sede,
  rol,
  onAbrirFicha,
  jornadaLimitada = null,
}: {
  sede: Sede;
  rol: string | null;
  onAbrirFicha: (studentId: string) => void;
  /**
   * Coordinador de central acotado a una jornada. Solo cambia lo que VE: el calculo y la
   * apertura automatica de casos siguen siendo de toda la sede, para que un caso de la
   * otra jornada no espere a que entre su coordinador (ver domain/filtro-jornada).
   */
  jornadaLimitada?: Jornada | null;
}) {
  const esCoordinacion = rol === 'coordinador';
  const [elegida, setElegida] = useState<FiltroJornada>(filtroInicial(jornadaLimitada));
  const filtro = filtroEfectivo(jornadaLimitada, elegida);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [config, setConfig] = useState<PermanenciaConfig>(PERMANENCIA_CONFIG_POR_DEFECTO);
  const [estudiantes, setEstudiantes] = useState<Student[]>([]);
  const [evaluaciones, setEvaluaciones] = useState<EvaluacionPermanencia[]>([]);
  const [casos, setCasos] = useState<CasoPermanencia[]>([]);
  const [contactos, setContactos] = useState<FamilyContact[]>([]);
  const [sinLlamadas, setSinLlamadas] = useState(false);
  const [seguimientosDe, setSeguimientosDe] = useState<Map<string, SeguimientoCaso[]>>(new Map());
  const [gruposSinCenso, setGruposSinCenso] = useState<string[]>([]);

  /** Los casos y lo que cada uno tiene registrado. Se relee tras cada seguimiento. */
  const cargarCasos = useCallback(async () => {
    const leidos = await leerCasosDeSede(sede);
    setCasos(leidos);
    const pares = await Promise.all(
      leidos
        .filter((c) => ESTADOS_ABIERTOS.includes(c.estado))
        .map(async (c) => [c.casoId, await leerSeguimientos(c.casoId)] as const),
    );
    setSeguimientosDe(new Map(pares));
    return leidos;
  }, [sede]);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const hoy = toDateKey(new Date());
      const [cfg, ests, censos, casosLeidos] = await Promise.all([
        leerConfigPermanencia(),
        leerEstudiantesDeSede(sede),
        leerCensosDesde(haceDias(DIAS_DE_CALENDARIO_A_LEER), sede),
        cargarCasos(),
      ]);
      setConfig(cfg);
      setEstudiantes(ests);

      // Las llamadas: para la línea de tiempo de cada caso y para saber si está desatendido.
      // La rectora NO las lee: Julián las reservó a coordinación y dirección de grupo
      // (2026-07-30), y ampliarlo es decisión suya. Los casos se le muestran igual, con un
      // aviso: sin llamadas, la alerta de «días sin seguimiento» podría estar exagerada.
      let contactosLeidos: FamilyContact[] = [];
      if (esCoordinacion) {
        try {
          contactosLeidos = await leerContactosDeSede(sede);
          setSinLlamadas(false);
        } catch {
          setSinLlamadas(true);
        }
      } else {
        // Ni se piden: sería un «permiso denegado» seguro en la consola en cada visita.
        setSinLlamadas(true);
      }
      setContactos(contactosLeidos);

      const ina = inasistenciasDesdeCensos(censos, ests, cfg.ventanaDiasHabiles);
      setGruposSinCenso(
        [...new Set(ests.filter((e) => (ina.get(e.studentId)?.diasConCenso ?? 0) === 0).map((e) => e.gradoActual))].sort(),
      );

      if (!esCoordinacion) {
        setEvaluaciones([]);
        return;
      }

      const porEstudiante = new Map<string, FamilyContact[]>();
      for (const c of contactosLeidos) {
        const l = porEstudiante.get(c.studentId) ?? [];
        l.push(c);
        porEstudiante.set(c.studentId, l);
      }
      const evs = ests
        .map((e) =>
          evaluarEstudiante({
            studentId: e.studentId,
            inasistencia: ina.get(e.studentId)!,
            contactos: porEstudiante.get(e.studentId) ?? [],
            config: cfg,
            hoy,
          }),
        )
        .filter((e) => e.nivel !== 'ninguno');
      setEvaluaciones(ordenarPorGravedad(evs));

      // Coordinación no crea nada: los casos que hacen falta se abren solos.
      //
      // SEGURO: no mientras nadie haya guardado los criterios. Un caso no se borra —es un
      // expediente—, así que abrirlos con los valores por defecto el primer día dejaría
      // decenas de expedientes permanentes con umbrales que la institución nunca aprobó.
      // Mientras tanto se calcula y se muestra, pero no se escribe nada.
      const nuevos = casosPorAbrir(evs, casosLeidos);
      if (nuevos.length > 0 && !cfg.ultimaEscrituraPor) {
        setAviso(
          `${nuevos.length} estudiante(s) abrirían caso con estos criterios, pero todavía no se abre ` +
            'ninguno: los criterios no han sido revisados. Cuando coordinación o rectoría los guarden ' +
            'al menos una vez (abajo, en «Criterios»), los casos se abrirán solos.',
        );
      } else if (nuevos.length > 0) {
        const mapa = new Map(ests.map((e) => [e.studentId, { gradoActual: e.gradoActual, sede: e.sede }]));
        const abiertos = await abrirCasosPermanencia(nuevos, mapa, hoy);
        if (abiertos > 0) setAviso(`Se abrieron ${abiertos} caso(s) nuevo(s) con lo registrado hasta hoy.`);
        await cargarCasos();
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setCargando(false);
    }
  }, [sede, esCoordinacion, cargarCasos]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const porId = useMemo(() => new Map(estudiantes.map((e) => [e.studentId, e])), [estudiantes]);
  const contactosDe = useMemo(() => {
    const m = new Map<string, FamilyContact[]>();
    for (const c of contactos) {
      const l = m.get(c.studentId) ?? [];
      l.push(c);
      m.set(c.studentId, l);
    }
    return m;
  }, [contactos]);
  const casoAbiertoDe = useMemo(() => {
    const m = new Map<string, CasoPermanencia>();
    for (const c of casos) if (ESTADOS_ABIERTOS.includes(c.estado)) m.set(c.studentId, c);
    return m;
  }, [casos]);

  /** Los casos abiertos con su alerta, los vencidos primero y luego por próxima fecha. */
  const abiertos = useMemo(() => {
    const hoy = toDateKey(new Date());
    return casos
      .filter((c) => ESTADOS_ABIERTOS.includes(c.estado) && gradoEnJornada(c.grado, filtro))
      .map((c) => ({
        caso: c,
        alerta: alertaDeSeguimiento({
          caso: c,
          seguimientos: seguimientosDe.get(c.casoId) ?? [],
          contactos: contactosDe.get(c.studentId) ?? [],
          config,
          hoy,
        }),
      }))
      .sort(
        (a, b) =>
          Number(b.alerta.vencido) - Number(a.alerta.vencido) ||
          (a.caso.proximoSeguimiento ?? '9999').localeCompare(b.caso.proximoSeguimiento ?? '9999'),
      );
  }, [casos, seguimientosDe, contactosDe, config, filtro]);
  const cerrados = casos.filter((c) => !ESTADOS_ABIERTOS.includes(c.estado) && gradoEnJornada(c.grado, filtro));
  const vencidos = abiertos.filter((a) => a.alerta.vencido).length;

  if (cargando) return <p className="p-3 text-sm text-muted">Revisando el censo y las llamadas…</p>;

  // Sin ficha no se sabe la jornada: se muestra en vez de esconderlo. Esconder a un
  // estudiante en riesgo por un dato faltante es peor que mostrarle uno de mas.
  const visibles = evaluaciones.filter((ev) => {
    const e = porId.get(ev.studentId);
    return !e || gradoEnJornada(e.gradoActual, filtro);
  });
  const cuenta = (n: NivelPermanencia) => visibles.filter((e) => e.nivel === n).length;
  const graves = visibles.filter((e) => e.nivel === 'candidato' || e.nivel === 'alerta');
  const seguimiento = visibles.filter((e) => e.nivel === 'seguimiento');
  const sinCensoVisibles = gruposSinCenso.filter((g) => gradoEnJornada(g, filtro));

  const detalle = (c: CasoPermanencia) => (
    <DetalleCaso
      caso={c}
      estudiante={porId.get(c.studentId)}
      contactos={contactosDe.get(c.studentId) ?? []}
      config={config}
      modo="gestion"
      onCambio={async () => {
        await cargarCasos();
      }}
    />
  );

  return (
    <div className="space-y-3">
      {aviso && <p className="rounded-lg border border-info-soft bg-info-soft p-2 text-sm text-info-soft-fg">{aviso}</p>}
      {error && <p className="rounded-lg border border-danger-soft bg-danger-soft p-2 text-sm text-danger-soft-fg">{error}</p>}

      <div className="flex justify-end">
        <SelectorJornada limitada={jornadaLimitada} valor={elegida} onCambio={setElegida} />
      </div>

      {/* ================= 1. CASOS ABIERTOS ================= */}
      <div className="rounded-xl border border-line bg-card p-3">
        <h3 className="text-sm font-semibold text-strong">
          Casos abiertos ({abiertos.length})
          {vencidos > 0 && (
            <span className="ml-2 rounded-full bg-danger-soft px-2 py-0.5 text-xs text-danger-soft-fg">
              {vencidos} con seguimiento vencido
            </span>
          )}
        </h3>
        <p className="mt-1 text-xs text-muted">
          Un caso se marca vencido si pasa la fecha programada sin seguimiento, o si lleva{' '}
          {config.diasSinSeguimientoParaAlerta} días sin ninguno. Las llamadas registradas cuentan como seguimiento.
        </p>
        {sinLlamadas && (
          <p className="mt-2 rounded-lg border border-warning-soft bg-warning-soft p-2 text-xs text-warning-soft-fg">
            Esta cuenta no lee el registro de llamadas a las familias: los casos se ven sin sus llamadas, y los
            días sin seguimiento pueden estar exagerados si el último contacto fue una llamada.
          </p>
        )}

        {abiertos.length === 0 ? (
          <p className="mt-2 text-sm text-soft">No hay casos abiertos.</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {abiertos.map(({ caso: c, alerta }) => {
              const e = porId.get(c.studentId);
              return (
                <li key={c.casoId} className="rounded-lg border border-line p-2">
                  <details>
                    <summary className="cursor-pointer list-none">
                      <span className="flex flex-wrap items-center gap-2">
                        {alerta.vencido && (
                          <span className="rounded-full bg-danger-soft px-2 py-0.5 text-xs font-semibold text-danger-soft-fg">
                            Vencido
                          </span>
                        )}
                        <b className="text-sm text-strong">{e ? nombreCompleto(e) : c.studentId}</b>
                        <span className="text-xs text-muted">
                          {c.grado} · {ESTADO_CASO_ETIQUETA[c.estado]}
                          {c.proximoSeguimiento ? ` · próximo: ${c.proximoSeguimiento}` : ''}
                          {c.remitidoDirector ? ' · remitido al director' : ''}
                        </span>
                      </span>
                      <span className="mt-0.5 block text-xs text-soft">
                        {alerta.vencido ? alerta.razon : `Última actuación: ${alerta.ultimaActuacion}`}
                      </span>
                    </summary>
                    <button
                      onClick={() => onAbrirFicha(c.studentId)}
                      className="mt-2 text-xs text-accent underline"
                    >
                      Abrir la ficha del estudiante
                    </button>
                    {detalle(c)}
                  </details>
                </li>
              );
            })}
          </ul>
        )}

        {cerrados.length > 0 && (
          <details className="mt-3">
            <summary className="cursor-pointer text-xs text-muted">Casos cerrados ({cerrados.length})</summary>
            <ul className="mt-2 space-y-2">
              {cerrados.map((c) => {
                const e = porId.get(c.studentId);
                return (
                  <li key={c.casoId} className="rounded-lg border border-line p-2">
                    <details>
                      <summary className="cursor-pointer text-sm">
                        <b className="text-strong">{e ? nombreCompleto(e) : c.studentId}</b>{' '}
                        <span className="text-xs text-muted">
                          {c.grado} · {ESTADO_CASO_ETIQUETA[c.estado]} · {c.cerradoEn ?? ''}
                        </span>
                      </summary>
                      {detalle(c)}
                    </details>
                  </li>
                );
              })}
            </ul>
          </details>
        )}
      </div>

      {/* ================= 2. ESTUDIANTES EN RIESGO ================= */}
      {esCoordinacion && (
        <div className="rounded-xl border border-line bg-card p-3">
          <h3 className="text-sm font-semibold text-strong">Estudiantes en riesgo de desescolarización</h3>
          <p className="mt-1 text-xs text-muted">
            Calculado con el censo de la tercera hora de los últimos {config.ventanaDiasHabiles} días de clase.
            Los casos que hacen falta se abren solos al entrar a esta pantalla.
          </p>

          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            {(['candidato', 'alerta', 'seguimiento'] as NivelPermanencia[]).map((n) => (
              <div key={n} className={`rounded-lg border p-2 ${TONO[n]}`}>
                <b className="block text-xl tabular-nums">{cuenta(n)}</b>
                <span className="text-xs">{NIVEL_ETIQUETA[n]}</span>
              </div>
            ))}
          </div>

          {sinCensoVisibles.length > 0 && (
            <p className="mt-3 rounded-lg border border-warning-soft bg-warning-soft p-2 text-xs text-warning-soft-fg">
              <b>Sin datos:</b> {sinCensoVisibles.join(', ')}. En estos grupos nadie pasó lista en tercera hora en la
              ventana, así que el sistema no sabe quién faltó. <b>No significa que no haya faltado nadie.</b>
            </p>
          )}
        </div>
      )}

      {esCoordinacion && graves.length === 0 && (
        <p className="rounded-xl border border-line bg-card p-3 text-sm text-soft">
          Ningún estudiante cruza hoy los umbrales de la institución.
        </p>
      )}

      {esCoordinacion &&
        graves.map((ev) => (
          <FilaRiesgo
            key={ev.studentId}
            evaluacion={ev}
            estudiante={porId.get(ev.studentId)}
            caso={casoAbiertoDe.get(ev.studentId) ?? null}
            config={config}
            onAbrirFicha={onAbrirFicha}
          />
        ))}

      {esCoordinacion && seguimiento.length > 0 && (
        <details className="rounded-xl border border-line bg-card p-3">
          <summary className="cursor-pointer text-sm text-strong">
            {seguimiento.length} en seguimiento — faltas bajo el umbral, sin caso
          </summary>
          <ul className="mt-2 space-y-1 text-sm">
            {seguimiento.map((ev) => {
              const e = porId.get(ev.studentId);
              return (
                <li key={ev.studentId} className="flex flex-wrap gap-2">
                  <button onClick={() => onAbrirFicha(ev.studentId)} className="text-accent">
                    {e ? nombreCompleto(e) : ev.studentId}
                  </button>
                  <span className="text-muted">
                    {e?.gradoActual} · {ev.inasistencia.fechasEnVentana.length} día(s)
                  </span>
                </li>
              );
            })}
          </ul>
        </details>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

/**
 * Un estudiante que cruza los umbrales. Su caso, si lo tiene, se gestiona arriba en «Casos
 * abiertos»: aquí solo se dice que existe, para no tener dos sitios donde registrar lo mismo.
 */
function FilaRiesgo({
  evaluacion: ev,
  estudiante: e,
  caso,
  config,
  onAbrirFicha,
}: {
  evaluacion: EvaluacionPermanencia;
  estudiante: Student | undefined;
  caso: CasoPermanencia | null;
  config: PermanenciaConfig;
  onAbrirFicha: (id: string) => void;
}) {
  const ina = ev.inasistencia;

  return (
    <div className="rounded-xl border border-line bg-card p-3">
      <div className="flex flex-wrap items-start gap-2">
        <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${TONO[ev.nivel]}`}>
          {NIVEL_ETIQUETA[ev.nivel]}
        </span>
        <div className="min-w-0 flex-1">
          <button onClick={() => onAbrirFicha(ev.studentId)} className="text-left text-sm font-semibold text-accent">
            {e ? nombreCompleto(e) : ev.studentId}
          </button>
          <p className="text-xs text-muted">
            {e?.gradoActual} · {ina.fechasEnVentana.length} día(s) sin venir en la ventana
            {ina.rachaActual > 0 && ` · ${ina.rachaActual} seguido(s) hasta hoy`}
            {ev.motivoId && ` · la familia informó: ${etiquetaDeMotivo(config.motivos, ev.motivoId)}`}
          </p>
          <p className="mt-1 text-sm text-soft">{ev.razon}</p>
          <p className="mt-1 text-xs text-muted">
            {caso
              ? `Tiene un caso ${ESTADO_CASO_ETIQUETA[caso.estado].toLowerCase()}: se gestiona arriba, en «Casos abiertos».`
              : 'No se pudo abrir el caso. Vuelva a entrar a esta pantalla; si persiste, es un problema de permisos de la cuenta.'}
          </p>
        </div>
      </div>
    </div>
  );
}
