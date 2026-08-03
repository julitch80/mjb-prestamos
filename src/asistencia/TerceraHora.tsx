import { useCallback, useEffect, useState } from 'react';
import { leerInsumosTerceraHora, registrarContacto } from './datos';
import { advertenciaCobertura, construirReporteTerceraHora, type ReporteTerceraHora } from './domain/reports';
import { toDateKey } from './domain/ids';
import type { Jornada } from './domain/types';

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
 * El reporte se CALCULA, no se guarda. Lo unico que se persiste son las llamadas.
 */
export default function TerceraHora({ sede }: { sede: string }) {
  const [fecha, setFecha] = useState(toDateKey(new Date()));
  const [jornada, setJornada] = useState<Jornada>(
    new Date().getHours() < 12 ? 'manana' : 'tarde',
  );
  const [gradosEsperados, setGradosEsperados] = useState('');
  const [reporte, setReporte] = useState<ReporteTerceraHora | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [llamados, setLlamados] = useState<Record<string, string>>({});

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

  async function registrar(
    f: { studentId: string; grado: string; telefonos: string[] },
    resultado: 'contesto' | 'no_contesto',
  ) {
    const observacion = window.prompt(
      resultado === 'contesto'
        ? '¿Qué informó la familia? (opcional)'
        : 'Observación de la llamada sin respuesta (opcional)',
      '',
    );
    if (observacion === null) return;
    try {
      await registrarContacto({
        studentId: f.studentId,
        grado: f.grado,
        sede,
        fecha,
        motivoContacto: 'inasistencia_dia',
        telefonoUsado: f.telefonos[0] ?? '',
        resultado,
        observacion,
      });
      setLlamados((p) => ({ ...p, [f.studentId]: resultado }));
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

      {aviso && (
        <div className="rounded-xl border border-warning-soft bg-warning-soft p-3 text-sm text-warning-soft-fg">
          {aviso}
        </div>
      )}

      {reporte && (
        <>
          <Seccion
            titulo="No ingresaron al colegio"
            explicacion="Ausentes en tercera hora y sin registro de llegada tarde. Aquí sí se llama a la familia."
            vacio="Nadie. Todos los ausentes del bloque 3 tienen registro de ingreso."
            filas={reporte.noIngresaron}
            tono="danger"
            render={(f) => (
              <>
                <span className="grow">
                  <b className="text-strong">{f.nombreCompleto}</b>
                  <span className="ml-2 text-xs text-muted">{f.grado}</span>
                  <br />
                  <span className="text-xs text-soft">
                    {f.telefonos.join(' · ') || 'sin teléfono registrado'}
                  </span>
                </span>
                {llamados[f.studentId] ? (
                  <span className="rounded-full bg-success-soft px-2 py-0.5 text-xs text-success-soft-fg">
                    {llamados[f.studentId] === 'contesto' ? 'contestó' : 'no contestó'}
                  </span>
                ) : (
                  <span className="flex gap-1">
                    <button
                      onClick={() => void registrar(f, 'contesto')}
                      className="rounded-lg border border-line px-2 py-1 text-xs text-strong"
                    >
                      Contestó
                    </button>
                    <button
                      onClick={() => void registrar(f, 'no_contesto')}
                      className="rounded-lg border border-line px-2 py-1 text-xs text-strong"
                    >
                      No contestó
                    </button>
                  </span>
                )}
              </>
            )}
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
