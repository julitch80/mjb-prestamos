import { useEffect, useState } from 'react';
import { leerEvasionesDelDia, resolverEvasion } from './datos';
import { toDateKey } from './domain/ids';
import { BLOQUE_CENTRO } from './domain/evasion';
import { coincideJornada, filtroEfectivo, filtroInicial, type FiltroJornada } from './domain/filtro-jornada';
import type { AvisoEvasion, Jornada, Sede } from './domain/types';
import SelectorJornada from './SelectorJornada';

/**
 * Bandeja de evasiones del coordinador (Julian, 2026-09-09).
 *
 * POR QUE EXISTE. El docente detecta pero no puede resolver: marca la evasion porque el
 * estudiante no esta en su salon y no figura entre los ausentes del dia, pero no sabe si
 * salio con permiso. El coordinador si. Y de ahi salen los dos caminos que pidio Julian:
 *
 *  - SALIO CON PERMISO  -> lo descarta, y queda escrito que se reviso.
 *  - NO SALIO POR NADA  -> entonces esta en alguna parte del colegio donde no le
 *                          corresponde, y el coordinador lo va a buscar o pide apoyo.
 *
 * NO ES UNA LISTA DE CASTIGOS Y LA PANTALLA NO DEBE SUGERIRLO. Lo urgente aqui es
 * localizar a un menor que no esta donde deberia; por eso lo primero que se lee es el
 * nombre y de donde falto, y por eso los avisos abiertos van arriba y en color.
 */
export default function Evasiones({
  sede,
  jornadaLimitada = null,
}: {
  sede: Sede;
  /** Coordinador de central acotado a una jornada: solo ve los avisos de la suya. */
  jornadaLimitada?: Jornada | null;
}) {
  const [fecha, setFecha] = useState(toDateKey(new Date()));
  const [elegida, setElegida] = useState<FiltroJornada>(filtroInicial(jornadaLimitada));
  const filtro = filtroEfectivo(jornadaLimitada, elegida);
  const [avisos, setAvisos] = useState<AvisoEvasion[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  /** Aviso que se esta resolviendo, con la nota que el coordinador va escribiendo. */
  const [resolviendo, setResolviendo] = useState<{ aviso: AvisoEvasion; nota: string } | null>(
    null,
  );
  const [guardando, setGuardando] = useState(false);

  async function cargar() {
    setError(null);
    setCargando(true);
    try {
      setAvisos(await leerEvasionesDelDia(sede, fecha));
    } catch (e) {
      setError(`No fue posible cargar los avisos: ${(e as Error).message}`);
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    void cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sede, fecha]);

  // Abiertos arriba: es lo unico accionable, y el resto es historial del dia.
  // Se filtra al MOSTRAR: la lectura sigue siendo de la sede (ver domain/filtro-jornada).
  const deLaJornada = avisos.filter((a) => coincideJornada(a.jornada, filtro));
  const ordenados = [...deLaJornada].sort(
    (a, b) =>
      Number(b.estado === 'abierto') - Number(a.estado === 'abierto') ||
      a.grado.localeCompare(b.grado),
  );
  const abiertos = deLaJornada.filter((a) => a.estado === 'abierto').length;

  async function cerrar(estado: 'confirmada' | 'descartada') {
    if (!resolviendo) return;
    setGuardando(true);
    try {
      await resolverEvasion(resolviendo.aviso.avisoId, estado, resolviendo.nota);
      setResolviendo(null);
      await cargar();
    } catch (e) {
      setError(`No fue posible cerrar el aviso: ${(e as Error).message}`);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-base font-semibold text-strong">Evasiones reportadas</h2>
        <span className="grow" />
        <SelectorJornada limitada={jornadaLimitada} valor={elegida} onCambio={setElegida} />
        <label className="text-xs text-muted">
          Día{' '}
          <input
            type="date"
            value={fecha}
            onChange={(ev) => setFecha(ev.target.value)}
            className="rounded-lg border border-line bg-elevated p-1.5 text-sm text-strong"
          />
        </label>
      </div>

      <p className="text-xs text-muted">
        Un docente marcó evasión porque el estudiante no estaba en su clase y tampoco figura
        entre los ausentes del día. Si salió con permiso, descártelo; si no salió, está en
        alguna parte del colegio donde no le corresponde.
      </p>

      {error && (
        <div className="rounded-xl border border-danger-soft bg-danger-soft p-3 text-sm text-danger-soft-fg">
          {error}
        </div>
      )}

      {cargando ? (
        <p className="p-3 text-sm text-muted">Cargando…</p>
      ) : ordenados.length === 0 ? (
        <p className="rounded-xl border border-line bg-card p-3 text-sm text-muted">
          {filtro === 'ambas'
            ? 'Ningún docente reportó evasiones este día.'
            : 'Ningún docente reportó evasiones de esta jornada este día.'}
        </p>
      ) : (
        <>
          <p className="text-sm text-strong">
            {abiertos === 0
              ? 'Todos los avisos del día están resueltos.'
              : `${abiertos} sin resolver, de ${ordenados.length} del día.`}
          </p>

          <ul className="space-y-2">
            {ordenados.map((a) => (
              <li
                key={a.avisoId}
                className={[
                  'rounded-xl border p-3',
                  a.estado === 'abierto'
                    ? 'border-warning-soft bg-warning-soft'
                    : 'border-line bg-card',
                ].join(' ')}
              >
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <span
                    className={[
                      'text-sm font-semibold',
                      a.estado === 'abierto' ? 'text-warning-soft-fg' : 'text-strong',
                    ].join(' ')}
                  >
                    {a.grado}
                  </span>
                  <span className="text-xs text-muted">
                    {/* El centro de interes no va por bloques: decirlo con la hora seria
                        inventarse un dato. Se dice de donde falto, que es lo util. */}
                    {a.bloque === BLOQUE_CENTRO
                      ? `Centro de interés · ${a.nombreOrigen}`
                      : `Bloque ${a.bloque} · ${a.nombreOrigen}`}
                  </span>
                  <span className="grow" />
                  {a.estado !== 'abierto' && (
                    <span className="rounded-full border border-line px-2 py-0.5 text-xs text-muted">
                      {a.estado === 'descartada' ? 'No era evasión' : 'Evasión confirmada'}
                    </span>
                  )}
                </div>

                <p
                  className={[
                    'mt-0.5 text-sm',
                    a.estado === 'abierto' ? 'text-warning-soft-fg' : 'text-soft',
                  ].join(' ')}
                >
                  {/* El id y no el nombre: esta pantalla no carga la matricula entera para
                      una lista que casi siempre tiene dos o tres filas. El grado y la hora
                      bastan para saber a quien buscar, y el docente que reportó está ahí. */}
                  Estudiante {a.studentId} · reportó {a.reportadoPor}
                </p>

                {a.nota && <p className="mt-1 text-xs text-muted">«{a.nota}»</p>}

                {a.estado === 'abierto' && (
                  <button
                    onClick={() => setResolviendo({ aviso: a, nota: '' })}
                    className="mt-2 min-h-[36px] rounded-lg border border-line bg-card px-3 py-1.5 text-sm font-medium text-strong"
                  >
                    Resolver
                  </button>
                )}
                {a.estado !== 'abierto' && a.resueltoPor && (
                  <p className="mt-1 text-xs text-muted">Cerrado por {a.resueltoPor}</p>
                )}
              </li>
            ))}
          </ul>
        </>
      )}

      {resolviendo && (
        <div className="fixed inset-0 z-50 grid place-items-end bg-black/40 p-0 sm:place-items-center sm:p-4">
          <div className="w-full max-w-md rounded-t-2xl border border-line bg-card p-4 sm:rounded-2xl">
            <p className="text-sm font-semibold text-strong">
              {resolviendo.aviso.grado} · estudiante {resolviendo.aviso.studentId}
            </p>
            <p className="mt-0.5 text-xs text-muted">
              Ninguna de las dos opciones borra el aviso: un aviso descartado documenta que
              se revisó, que no es lo mismo que no haber ocurrido.
            </p>

            <textarea
              value={resolviendo.nota}
              onChange={(ev) => setResolviendo({ ...resolviendo, nota: ev.target.value })}
              rows={2}
              placeholder="Salió a las 10:30 con la mamá. / No apareció, se avisó a la familia."
              className="mt-2 w-full rounded-lg border border-line bg-elevated p-2 text-sm text-strong"
            />

            <div className="mt-3 flex flex-col gap-2">
              <button
                onClick={() => void cerrar('descartada')}
                disabled={guardando}
                className="min-h-[44px] rounded-lg border border-success-soft bg-success-soft px-3 py-2 text-sm font-medium text-success-soft-fg disabled:opacity-50"
              >
                No era evasión: salió con permiso
              </button>
              <button
                onClick={() => void cerrar('confirmada')}
                disabled={guardando}
                className="min-h-[44px] rounded-lg border border-warning-soft bg-warning-soft px-3 py-2 text-sm font-medium text-warning-soft-fg disabled:opacity-50"
              >
                Sí era evasión
              </button>
              <button
                onClick={() => setResolviendo(null)}
                disabled={guardando}
                className="min-h-[40px] rounded-lg border border-line px-3 py-2 text-sm text-soft disabled:opacity-50"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
