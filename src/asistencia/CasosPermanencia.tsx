/**
 * Casos de permanencia — etapa 3 del reporte a Guardianes de la Permanencia.
 *
 * Al entrar, el sistema cruza el censo de la tercera hora, las llamadas a las familias y
 * el catálogo de motivos, y dice en qué nivel está cada estudiante. Para coordinación,
 * además, ABRE SOLO los casos que hacen falta: coordinación no crea nada, gestiona.
 *
 * La rectora ve los casos ya abiertos, pero no el cálculo: el cálculo necesita las
 * observaciones de las llamadas, que la regla reserva a coordinación y a dirección de
 * grupo. Mostrarle alertas calculadas sin esas llamadas sería mostrarle un nivel
 * equivocado —una incapacidad ya explicada saldría como alerta—.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  abrirCasosPermanencia,
  cerrarCaso,
  registrarGestionCaso,
  leerCasosDeSede,
  leerCensosDesde,
  leerConfigPermanencia,
  leerContactosDeSede,
  leerEstudiantesDeSede,
} from './datos';
import { toDateKey } from './domain/ids';
import { nombreCompleto } from './domain/nombres';
import {
  casosPorAbrir,
  ESTADO_CASO_ETIQUETA,
  ESTADOS_ABIERTOS,
  etiquetaDeMotivo,
  evaluarEstudiante,
  GESTION_ETIQUETA,
  gestionesParaInforme,
  inasistenciasDesdeCensos,
  NIVEL_ETIQUETA,
  ordenarPorGravedad,
  PERMANENCIA_CONFIG_POR_DEFECTO,
  type CasoPermanencia,
  type EstadoCaso,
  type EvaluacionPermanencia,
  type NivelPermanencia,
  type PermanenciaConfig,
  type TipoGestion,
} from './domain/permanencia';
import type { Sede, Student } from './domain/types';

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
}: {
  sede: Sede;
  rol: string | null;
  onAbrirFicha: (studentId: string) => void;
}) {
  const esCoordinacion = rol === 'coordinador';
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [config, setConfig] = useState<PermanenciaConfig>(PERMANENCIA_CONFIG_POR_DEFECTO);
  const [estudiantes, setEstudiantes] = useState<Student[]>([]);
  const [evaluaciones, setEvaluaciones] = useState<EvaluacionPermanencia[]>([]);
  const [casos, setCasos] = useState<CasoPermanencia[]>([]);
  const [gruposSinCenso, setGruposSinCenso] = useState<string[]>([]);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const hoy = toDateKey(new Date());
      const [cfg, ests, censos, casosLeidos] = await Promise.all([
        leerConfigPermanencia(),
        leerEstudiantesDeSede(sede),
        leerCensosDesde(haceDias(DIAS_DE_CALENDARIO_A_LEER), sede),
        leerCasosDeSede(sede),
      ]);
      setConfig(cfg);
      setEstudiantes(ests);

      const ina = inasistenciasDesdeCensos(censos, ests, cfg.ventanaDiasHabiles);
      setGruposSinCenso(
        [...new Set(ests.filter((e) => (ina.get(e.studentId)?.diasConCenso ?? 0) === 0).map((e) => e.gradoActual))].sort(),
      );

      if (!esCoordinacion) {
        setEvaluaciones([]);
        setCasos(casosLeidos);
        return;
      }

      const contactos = await leerContactosDeSede(sede);
      const porEstudiante = new Map<string, typeof contactos>();
      for (const c of contactos) {
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
        setCasos(casosLeidos);
      } else if (nuevos.length > 0) {
        const mapa = new Map(ests.map((e) => [e.studentId, { gradoActual: e.gradoActual, sede: e.sede }]));
        const abiertos = await abrirCasosPermanencia(nuevos, mapa, hoy);
        if (abiertos > 0) setAviso(`Se abrieron ${abiertos} caso(s) nuevo(s) con lo registrado hasta hoy.`);
        setCasos(await leerCasosDeSede(sede));
      } else {
        setCasos(casosLeidos);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setCargando(false);
    }
  }, [sede, esCoordinacion]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const porId = useMemo(() => new Map(estudiantes.map((e) => [e.studentId, e])), [estudiantes]);
  const casoAbiertoDe = useMemo(() => {
    const m = new Map<string, CasoPermanencia>();
    for (const c of casos) if (ESTADOS_ABIERTOS.includes(c.estado)) m.set(c.studentId, c);
    return m;
  }, [casos]);

  if (cargando) return <p className="p-3 text-sm text-muted">Revisando el censo y las llamadas…</p>;

  const cuenta = (n: NivelPermanencia) => evaluaciones.filter((e) => e.nivel === n).length;
  const graves = evaluaciones.filter((e) => e.nivel === 'candidato' || e.nivel === 'alerta');
  const seguimiento = evaluaciones.filter((e) => e.nivel === 'seguimiento');
  const casosAbiertos = casos.filter((c) => ESTADOS_ABIERTOS.includes(c.estado));

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-line bg-card p-3">
        <h3 className="text-sm font-semibold text-strong">Estudiantes en riesgo de desescolarización</h3>
        <p className="mt-1 text-xs text-muted">
          Calculado con el censo de la tercera hora de los últimos {config.ventanaDiasHabiles} días de
          clase. {esCoordinacion ? 'Los casos que hacen falta se abren solos al entrar a esta pantalla.' : ''}
        </p>

        {esCoordinacion && (
          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            {(['candidato', 'alerta', 'seguimiento'] as NivelPermanencia[]).map((n) => (
              <div key={n} className={`rounded-lg border p-2 ${TONO[n]}`}>
                <b className="block text-xl tabular-nums">{cuenta(n)}</b>
                <span className="text-xs">{NIVEL_ETIQUETA[n]}</span>
              </div>
            ))}
          </div>
        )}

        {gruposSinCenso.length > 0 && (
          <p className="mt-3 rounded-lg border border-warning-soft bg-warning-soft p-2 text-xs text-warning-soft-fg">
            <b>Sin datos:</b> {gruposSinCenso.join(', ')}. En estos grupos nadie pasó lista en tercera
            hora en la ventana, así que el sistema no sabe quién faltó. <b>No significa que no haya
            faltado nadie.</b>
          </p>
        )}
      </div>

      {aviso && <p className="rounded-lg border border-info-soft bg-info-soft p-2 text-sm text-info-soft-fg">{aviso}</p>}
      {error && <p className="rounded-lg border border-danger-soft bg-danger-soft p-2 text-sm text-danger-soft-fg">{error}</p>}

      {esCoordinacion && graves.length === 0 && (
        <p className="rounded-xl border border-line bg-card p-3 text-sm text-soft">
          Ningún estudiante cruza hoy los umbrales de la institución.
        </p>
      )}

      {esCoordinacion &&
        graves.map((ev) => (
          <FilaCaso
            key={ev.studentId}
            evaluacion={ev}
            estudiante={porId.get(ev.studentId)}
            caso={casoAbiertoDe.get(ev.studentId) ?? null}
            config={config}
            onAbrirFicha={onAbrirFicha}
            onRecargar={async () => setCasos(await leerCasosDeSede(sede))}
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

      {!esCoordinacion && (
        <div className="rounded-xl border border-line bg-card p-3">
          <h3 className="text-sm font-semibold text-strong">{casosAbiertos.length} caso(s) abierto(s)</h3>
          <ul className="mt-2 space-y-2 text-sm">
            {casosAbiertos.map((c) => {
              const e = porId.get(c.studentId);
              return (
                <li key={c.casoId} className="rounded-lg border border-line p-2">
                  <button onClick={() => onAbrirFicha(c.studentId)} className="font-medium text-accent">
                    {e ? nombreCompleto(e) : c.studentId}
                  </button>{' '}
                  <span className="text-muted">
                    {c.grado} · {ESTADO_CASO_ETIQUETA[c.estado]} · desde {c.fechaApertura}
                  </span>
                  <p className="text-xs text-soft">{c.criterioQueLoAbrio}</p>
                  {c.gestiones.length > 0 && (
                    <ul className="mt-1 text-xs text-muted">
                      {gestionesParaInforme(c.gestiones).map((g) => (
                        <li key={g}>{g}</li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

function FilaCaso({
  evaluacion: ev,
  estudiante: e,
  caso,
  config,
  onAbrirFicha,
  onRecargar,
}: {
  evaluacion: EvaluacionPermanencia;
  estudiante: Student | undefined;
  caso: CasoPermanencia | null;
  config: PermanenciaConfig;
  onAbrirFicha: (id: string) => void;
  onRecargar: () => Promise<void>;
}) {
  const [abierto, setAbierto] = useState(false);
  const [tipo, setTipo] = useState<TipoGestion>('llamada');
  const [fecha, setFecha] = useState(toDateKey(new Date()));
  const [nota, setNota] = useState('');
  const [motivoCierre, setMotivoCierre] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function hacer(fn: () => Promise<void>) {
    setError(null);
    try {
      await fn();
      await onRecargar();
    } catch (err) {
      setError((err as Error).message);
    }
  }

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
        </div>
        {caso && (
          <button onClick={() => setAbierto((v) => !v)} className="rounded-lg border border-line px-2 py-1 text-xs text-strong">
            {abierto ? 'Cerrar' : `Caso · ${ESTADO_CASO_ETIQUETA[caso.estado]}`}
          </button>
        )}
      </div>

      {caso && abierto && (
        <div className="mt-3 space-y-3 border-t border-line pt-3">
          <p className="text-xs text-muted">
            Abierto el {caso.fechaApertura} por {caso.abiertoPor}. Motivo de apertura: {caso.criterioQueLoAbrio}
          </p>

          <div>
            <p className="text-xs font-semibold text-strong">Gestiones realizadas</p>
            {caso.gestiones.length === 0 ? (
              <p className="text-xs text-muted">Todavía ninguna registrada en el caso.</p>
            ) : (
              <ul className="text-xs text-soft">
                {gestionesParaInforme(caso.gestiones).map((g) => (
                  <li key={g}>{g}</li>
                ))}
              </ul>
            )}
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <select
                value={tipo}
                onChange={(x) => setTipo(x.target.value as TipoGestion)}
                className="rounded-lg border border-line bg-elevated px-2 py-1 text-sm"
              >
                {(Object.keys(GESTION_ETIQUETA) as TipoGestion[]).map((g) => (
                  <option key={g} value={g}>
                    {GESTION_ETIQUETA[g]}
                  </option>
                ))}
              </select>
              <input
                type="date"
                value={fecha}
                max={toDateKey(new Date())}
                onChange={(x) => setFecha(x.target.value)}
                className="rounded-lg border border-line bg-elevated px-2 py-1 text-sm"
              />
              <input
                value={nota}
                onChange={(x) => setNota(x.target.value)}
                placeholder="Nota (opcional)"
                className="min-w-[10rem] flex-1 rounded-lg border border-line bg-elevated px-2 py-1 text-sm"
              />
              <button
                onClick={() =>
                  void hacer(async () => {
                    await registrarGestionCaso(caso, { tipo, fecha, nota });
                    setNota('');
                  })
                }
                className="rounded-lg bg-accent px-3 py-1 text-sm text-accent-fg"
              >
                Registrar gestión
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted">Cerrar el caso:</span>
            {(['cerrado_reintegro', 'cerrado_traslado', 'cerrado_retiro'] as EstadoCaso[]).map((est) => (
              <button
                key={est}
                disabled={!motivoCierre.trim()}
                onClick={() =>
                  void hacer(() =>
                    cerrarCaso(
                      caso.casoId,
                      est as 'cerrado_reintegro' | 'cerrado_traslado' | 'cerrado_retiro',
                      motivoCierre,
                      toDateKey(new Date()),
                    ),
                  )
                }
                className="rounded-lg border border-line px-2 py-1 text-xs text-strong disabled:opacity-40"
              >
                {ESTADO_CASO_ETIQUETA[est]}
              </button>
            ))}
            <input
              value={motivoCierre}
              onChange={(x) => setMotivoCierre(x.target.value)}
              placeholder="Por qué se cierra (obligatorio)"
              className="min-w-[12rem] flex-1 rounded-lg border border-line bg-elevated px-2 py-1 text-sm"
            />
          </div>

          {error && <p className="text-xs text-danger-soft-fg">{error}</p>}
        </div>
      )}

      {!caso && (
        <p className="mt-2 text-xs text-muted">
          No se pudo abrir el caso. Vuelva a entrar a esta pantalla; si persiste, es un problema de
          permisos de la cuenta.
        </p>
      )}
    </div>
  );
}
