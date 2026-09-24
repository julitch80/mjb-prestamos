import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  leerCasosDeSede,
  leerCensosDesde,
  leerConfigPermanencia,
  leerContactosDeSede,
  leerInsumosTerceraHora,
  registrarContacto,
} from './datos';
import { advertenciaCobertura, construirReporteTerceraHora, type ReporteTerceraHora } from './domain/reports';
import { toDateKey } from './domain/ids';
import {
  ESTADOS_ABIERTOS,
  evaluarEstudiante,
  inasistenciasDesdeCensos,
  MOTIVOS_SEMILLA,
  prioridadDeLlamada,
  RESULTADO_ETIQUETA,
  type CasoPermanencia,
  type PermanenciaConfig,
  type PrioridadLlamada,
} from './domain/permanencia';
import type { CensoDia, ContactResult, FamilyContact, Jornada } from './domain/types';
import TelefonoAcudiente from './TelefonoAcudiente';
import { ETIQUETA_JORNADA } from './domain/filtro-jornada';
import { mensajeInasistencia } from './domain/sms';
import { ModalRegistrarLlamada, type LlamadaRegistrada } from './RegistrarLlamada';

/** Lo que hace falta para decir a quién hay que llamar primero. Se lee aparte del reporte. */
interface DatosPermanencia {
  config: PermanenciaConfig;
  censos: CensoDia[];
  casos: CasoPermanencia[];
  contactos: FamilyContact[];
}

type FilaLlamada = { studentId: string; grado: string; telefonos: string[] };

/** Los mismos 60 días de calendario que lee la pantalla de Permanencia. */
function haceDias(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return toDateKey(d);
}

/**
 * Reporte de tercera hora — la pantalla del coordinador.
 *
 * Idea de Julian: a la tercera hora los estudiantes que esperaban en el hall ya
 * ingresaron, asi que estar ausente en el bloque 3 es el indicador mas fiel de no haber
 * venido al colegio. Se dispara al terminar ese bloque: ~09:05 en la manana y ~15:20 en
 * la tarde, segun los bloques reales de MJB.
 *
 * Las tres secciones estan separadas A PROPOSITO. Mezclarlas haria que el coordinador
 * llame a una familia para decirle que su hijo no fue, cuando el muchacho esta en el
 * patio.
 *
 * Dentro de «no ingresaron», los que HAY QUE LLAMAR van arriba con la razon a la vista
 * (`prioridadDeLlamada`, 2026-09-17): caso abierto, factor de riesgo, alerta, varios dias
 * seguidos, o ningun otro canal de aviso. Hoy se sigue llamando a todos; la marca dice por
 * quien empezar. Cuando exista el aviso por correo, es la que decide a quien NO basta con
 * escribirle.
 *
 * El reporte se CALCULA, no se guarda. Lo unico que se persiste son las llamadas.
 */
export default function TerceraHora({
  sede,
  jornadaLimitada = null,
}: {
  sede: string;
  /**
   * Coordinador de central acotado a una jornada. No es solo comodidad: las reglas solo
   * le dejan leer las sesiones de la suya, asi que si escogiera la otra, la consulta se
   * rechazaria entera y el reporte fallaria.
   */
  jornadaLimitada?: Jornada | null;
}) {
  const [fecha, setFecha] = useState(toDateKey(new Date()));
  const [jornada, setJornada] = useState<Jornada>(
    jornadaLimitada ?? (new Date().getHours() < 12 ? 'manana' : 'tarde'),
  );
  const [gradosEsperados, setGradosEsperados] = useState('');
  const [reporte, setReporte] = useState<ReporteTerceraHora | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [llamados, setLlamados] = useState<Record<string, ContactResult>>({});
  // Que numero se pulso "Llamar" por estudiante. Sin esto, telefonoUsado quedaba
  // siempre en el primer telefono aunque el coordinador hubiera llamado al segundo.
  const [telefonoPulsado, setTelefonoPulsado] = useState<Record<string, string>>({});
  const [permanencia, setPermanencia] = useState<DatosPermanencia | null>(null);
  const [avisoPermanencia, setAvisoPermanencia] = useState<string | null>(null);
  const [registrando, setRegistrando] = useState<FilaLlamada | null>(null);

  const generar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const { sesiones, llegadas, estudiantes } = await leerInsumosTerceraHora({
        sede,
        fecha,
        jornada,
      });
      setReporte(
        construirReporteTerceraHora({
          fecha,
          jornada,
          sessions: sesiones,
          lateArrivals: llegadas,
          students: estudiantes,
          gradosEsperados: gradosEsperados
            .split(',')
            .map((g) => g.trim())
            .filter(Boolean),
        }),
      );
    } catch (e) {
      setError(`No fue posible generar el reporte: ${(e as Error).message}`);
    } finally {
      setCargando(false);
    }
  }, [sede, fecha, jornada, gradosEsperados]);

  useEffect(() => {
    void generar();
  }, [generar]);

  // Lo necesario para la marca de «hay que llamar». Va APARTE del reporte y sin bloquearlo:
  // si esto falla, la lista de quien no vino sale igual, solo que sin ordenar. Una lista sin
  // prioridad es incomoda; una lista que no sale es un dia sin llamadas.
  useEffect(() => {
    let vivo = true;
    void (async () => {
      try {
        const [config, censos, casos, contactos] = await Promise.all([
          leerConfigPermanencia(),
          leerCensosDesde(haceDias(60), sede),
          leerCasosDeSede(sede),
          leerContactosDeSede(sede),
        ]);
        if (vivo) setPermanencia({ config, censos, casos, contactos });
      } catch (e) {
        if (vivo) setAvisoPermanencia(`No se pudo calcular a quién llamar primero: ${(e as Error).message}`);
      }
    })();
    return () => {
      vivo = false;
    };
  }, [sede]);

  /** La prioridad de cada estudiante que no ingresó. */
  const prioridades = useMemo(() => {
    const m = new Map<string, PrioridadLlamada>();
    if (!reporte) return m;
    const filas = reporte.noIngresaron;
    const contactosDe = new Map<string, FamilyContact[]>();
    for (const c of permanencia?.contactos ?? []) {
      const l = contactosDe.get(c.studentId) ?? [];
      l.push(c);
      contactosDe.set(c.studentId, l);
    }
    const ina = permanencia
      ? inasistenciasDesdeCensos(
          permanencia.censos,
          filas.map((f) => ({ studentId: f.studentId, gradoActual: f.grado })),
          permanencia.config.ventanaDiasHabiles,
        )
      : null;
    for (const f of filas) {
      const contactos = contactosDe.get(f.studentId) ?? [];
      const inasistencia = ina?.get(f.studentId);
      m.set(
        f.studentId,
        prioridadDeLlamada({
          evaluacion:
            permanencia && inasistencia
              ? evaluarEstudiante({
                  studentId: f.studentId,
                  inasistencia,
                  contactos,
                  config: permanencia.config,
                  hoy: fecha,
                })
              : null,
          casoAbierto:
            permanencia?.casos.find(
              (c) => c.studentId === f.studentId && ESTADOS_ABIERTOS.includes(c.estado),
            ) ?? null,
          config: permanencia?.config ?? ({ motivos: MOTIVOS_SEMILLA } as PermanenciaConfig),
          telefonos: f.telefonos,
          contactos,
        }),
      );
    }
    return m;
  }, [reporte, permanencia, fecha]);

  /** Los que hay que llamar primero, arriba y del más grave al menos. */
  const noIngresaronOrdenados = useMemo(() => {
    if (!reporte) return [];
    return [...reporte.noIngresaron].sort(
      (a, b) => (prioridades.get(b.studentId)?.peso ?? 0) - (prioridades.get(a.studentId)?.peso ?? 0),
    );
  }, [reporte, prioridades]);
  const cuantosLlamarPrimero = noIngresaronOrdenados.filter((f) => prioridades.get(f.studentId)?.llamar).length;

  async function registrar(f: FilaLlamada, llamada: LlamadaRegistrada) {
    try {
      await registrarContacto({
        studentId: f.studentId,
        grado: f.grado,
        sede,
        fecha,
        // El numero sobre el que realmente se pulso Llamar; si se registra sin haber
        // pulsado ninguno, se conserva el primero como comportamiento por defecto.
        telefonoUsado: telefonoPulsado[f.studentId] ?? f.telefonos[0] ?? '',
        ...llamada,
      });
      setLlamados((p) => ({ ...p, [f.studentId]: llamada.resultado }));
      setRegistrando(null);
    } catch (e) {
      setError(`No fue posible registrar la llamada: ${(e as Error).message}`);
    }
  }

  const aviso = reporte ? advertenciaCobertura(reporte) : null;

  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-base font-semibold text-strong">Reporte de tercera hora</h2>
        <p className="text-xs text-muted">
          A esta hora los que esperaban en el hall ya entraron, así que estar ausente aquí
          es el indicador más fiel de no haber venido al colegio.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-2 rounded-xl border border-line bg-card p-3">
        <label className="text-xs text-muted">
          Fecha
          <input
            type="date"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
            className="mt-0.5 block rounded-lg border border-line bg-elevated px-2 py-1 text-sm text-strong"
          />
        </label>
        {jornadaLimitada ? (
          <span className="self-end rounded-full bg-elevated px-2 py-1 text-xs text-soft">
            {ETIQUETA_JORNADA[jornadaLimitada]}
          </span>
        ) : (
          <label className="text-xs text-muted">
            Jornada
            <select
              value={jornada}
              onChange={(e) => setJornada(e.target.value as Jornada)}
              className="mt-0.5 block rounded-lg border border-line bg-elevated px-2 py-1 text-sm text-strong"
            >
              <option value="manana">Mañana (bloque 3: 08:10–09:05)</option>
              <option value="tarde">Tarde (bloque 3: 14:25–15:20)</option>
            </select>
          </label>
        )}
        <label className="grow text-xs text-muted">
          Grados esperados (separados por coma, para detectar los que no reportaron)
          <input
            value={gradosEsperados}
            onChange={(e) => setGradosEsperados(e.target.value)}
            placeholder="6º1, 6º2, 7º1…"
            className="mt-0.5 block w-full rounded-lg border border-line bg-elevated px-2 py-1 text-sm text-strong"
          />
        </label>
        <button
          onClick={() => void generar()}
          disabled={cargando}
          className="rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-accent-fg disabled:opacity-50"
        >
          {cargando ? 'Generando…' : 'Actualizar'}
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-danger-soft bg-danger-soft p-3 text-sm text-danger-soft-fg">
          {error}
        </div>
      )}

      {avisoPermanencia && (
        <div className="rounded-xl border border-warning-soft bg-warning-soft p-3 text-sm text-warning-soft-fg">
          {avisoPermanencia}. La lista sale completa, pero sin ordenar.
        </div>
      )}

      {aviso && (
        <div className="rounded-xl border border-warning-soft bg-warning-soft p-3 text-sm text-warning-soft-fg">
          {aviso}
        </div>
      )}

      {registrando && (
        <ModalRegistrarLlamada
          numero={telefonoPulsado[registrando.studentId] ?? registrando.telefonos[0] ?? 'sin número'}
          motivosFamilia={permanencia?.config.motivos ?? MOTIVOS_SEMILLA}
          onCerrar={() => setRegistrando(null)}
          onGuardar={(llamada) => registrar(registrando, llamada)}
        />
      )}

      {reporte && (
        <>
          <Seccion
            titulo="No ingresaron al colegio"
            explicacion={
              cuantosLlamarPrimero > 0
                ? `Ausentes en tercera hora y sin registro de llegada tarde. Aquí sí se llama a la familia. Arriba, los ${cuantosLlamarPrimero} que hay que llamar primero, con la razón.`
                : 'Ausentes en tercera hora y sin registro de llegada tarde. Aquí sí se llama a la familia.'
            }
            vacio="Nadie. Todos los ausentes del bloque 3 tienen registro de ingreso."
            filas={noIngresaronOrdenados}
            tono="danger"
            render={(f) => {
              const pr = prioridades.get(f.studentId);
              return (
                <>
                  <span className="grow">
                    <b className="text-strong">{f.nombreCompleto}</b>
                    <span className="ml-2 text-xs text-muted">{f.grado}</span>
                    {pr?.llamar && (
                      <span className="ml-2 rounded-full bg-danger-soft px-2 py-0.5 text-xs font-semibold text-danger-soft-fg">
                        Llamar primero
                      </span>
                    )}
                    {pr?.llamar && (
                      <ul className="mt-1 list-disc pl-4 text-xs text-danger-soft-fg">
                        {pr.motivos.map((m) => (
                          <li key={m}>{m}</li>
                        ))}
                      </ul>
                    )}
                    <span className="mt-1 flex flex-col gap-1 text-xs text-soft">
                      {f.telefonos.length > 0 ? (
                        f.telefonos.map((t, i) => (
                          <TelefonoAcudiente
                            key={`${t}-${i}`}
                            numero={t}
                            onLlamar={(numero) =>
                              setTelefonoPulsado((p) => ({ ...p, [f.studentId]: numero }))
                            }
                            // El mensaje sale escrito con el nombre del estudiante: en
                            // la fila de llamadas no hay tiempo de redactar nada.
                            mensaje={mensajeInasistencia(f.nombreCompleto)}
                            onMensaje={(numero) =>
                              setTelefonoPulsado((p) => ({ ...p, [f.studentId]: numero }))
                            }
                          />
                        ))
                      ) : (
                        'sin teléfono registrado'
                      )}
                    </span>
                  </span>
                  {llamados[f.studentId] ? (
                    <span className="rounded-full bg-success-soft px-2 py-0.5 text-xs text-success-soft-fg">
                      {RESULTADO_ETIQUETA[llamados[f.studentId]]}
                    </span>
                  ) : (
                    <button
                      onClick={() => setRegistrando(f)}
                      className="rounded-lg border border-line px-2 py-1 text-xs text-strong"
                    >
                      Registrar llamada
                    </button>
                  )}
                </>
              );
            }}
          />

          <Seccion
            titulo="Ingresaron pero no están en clase"
            explicacion="Tienen registro de llegada tarde: sí entraron al colegio. Aquí no se llama a nadie — se busca al estudiante."
            vacio="Ninguno."
            filas={reporte.enColegioPeroNoEnClase}
            tono="purple"
            render={(f) => (
              <span className="grow">
                <b className="text-strong">{f.nombreCompleto}</b>
                <span className="ml-2 text-xs text-muted">{f.grado}</span>
                <br />
                <span className="text-xs text-soft">
                  Ingresó a las {f.horaLlegada}, alcanzó el bloque {f.bloqueIngreso}
                </span>
              </span>
            )}
          />

          <p className="text-xs text-muted">
            Cubre {reporte.estudiantesCubiertos} registros de estudiantes en{' '}
            {reporte.noIngresaron.length + reporte.enColegioPeroNoEnClase.length} casos
            sin resolver. Las ausencias ya justificadas o autorizadas no aparecen: no
            tiene sentido llamar por algo que el colegio ya sabe.
          </p>
        </>
      )}
    </div>
  );
}

function Seccion<T extends { studentId: string }>({
  titulo,
  explicacion,
  vacio,
  filas,
  tono,
  render,
}: {
  titulo: string;
  explicacion: string;
  vacio: string;
  filas: T[];
  tono: 'danger' | 'purple';
  render: (f: T) => React.ReactNode;
}) {
  const borde = tono === 'danger' ? 'border-danger-soft' : 'border-purple-soft';
  return (
    <section className={`rounded-xl border ${borde} bg-card p-3`}>
      <h3 className="text-sm font-semibold text-strong">
        {titulo} <span className="text-muted">({filas.length})</span>
      </h3>
      <p className="mb-2 text-xs text-muted">{explicacion}</p>
      {filas.length === 0 ? (
        <p className="text-sm text-muted">{vacio}</p>
      ) : (
        <ul className="space-y-1">
          {filas.map((f) => (
            <li
              key={f.studentId}
              className="flex flex-wrap items-center gap-2 rounded-lg border border-line p-2 text-sm"
            >
              {render(f)}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
