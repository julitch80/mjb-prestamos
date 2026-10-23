import { Fragment, useEffect, useMemo, useState } from 'react';
import { atenderRemision, leerEstudiantesDeSede } from './datos';
import { nombreCompleto } from './domain/nombres';
import { citacionAlertaId, convocatoriaDelGrado } from './domain/alerta-academica';
import { fechaLarga, horaLegible } from './domain/imprimibles-alerta';
import { toDateKey } from './domain/ids';
import { citadosDelGrupo, filaAsistencia, PLAZO_EXCUSA_DIAS, seguimientoDe, totalAsistencia } from './domain/seguimiento-alerta';
import { ETIQUETA_SEGUIMIENTO } from './etiquetasSeguimiento';
import { diaSinClases } from './horarioDelDia';
import { citacionesSeguimientoDe, imprimirSeguimiento, nombreDirector } from './imprimirAlerta';
import type { AgendaCitaciones, ConvocatoriaAlerta, Sede, Student } from './domain/types';

const CAJA = 'rounded-lg border border-line bg-elevated px-2 py-1.5 text-sm text-strong';
const BOTON = 'min-h-[40px] rounded-xl px-4 text-sm font-semibold disabled:opacity-50';

/**
 * Seguimiento de la entrega — lo que ve COORDINACION (Julian, 2026-10-03):
 *  - el tablero de asistencia: totales de la jornada y cuadro por grupo (eran, vinieron,
 *    faltaron, sin marcar, recibieron el informe, remitidos). Cada grupo se abre para ver
 *    los nombres, primero los que faltaron (Julian, 2026-10-19);
 *  - la bandeja de casos remitidos, con su historial, para atenderlos;
 *  - el archivo de «citaciones de seguimiento» (las segundas citaciones + constancias con la
 *    fecha en blanco), porque la impresion la centraliza coordinacion.
 */
export default function SeguimientoCoordinacion({
  sede,
  conv,
  agendas,
  directores,
  onRecargar,
}: {
  sede: Sede;
  conv: ConvocatoriaAlerta;
  agendas: AgendaCitaciones[];
  directores: Record<string, string>;
  onRecargar: () => void;
}) {
  const hoy = toDateKey(new Date());
  const [estudiantes, setEstudiantes] = useState<Student[] | null>(null);
  const [constancias, setConstancias] = useState(4);
  const [nota, setNota] = useState<Record<string, string>>({});
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [abierto, setAbierto] = useState<string | null>(null);

  const ctx = useMemo(() => ({
    fechaEntrega: conv.fechaEntrega ?? hoy,
    hoy,
    plazoExcusaDias: conv.plazoExcusaDias ?? PLAZO_EXCUSA_DIAS,
    sinClases: diaSinClases,
  }), [conv.fechaEntrega, conv.plazoExcusaDias, hoy]);

  // Caso especial (2026-10-23): un grupo puede entregar en otra fecha. Cada uno cuenta desde
  // la suya, y solo entran los que ya entregaron.
  const fechaDe = (g: string) => convocatoriaDelGrado(conv, g).fechaEntrega;
  const ctxDe = (g: string) => ({ ...ctx, fechaEntrega: fechaDe(g) ?? hoy });
  const vigentes = useMemo(
    () => agendas.filter((a) => { const f = convocatoriaDelGrado(conv, a.grado).fechaEntrega; return !!f && hoy >= f; }),
    [agendas, conv, hoy],
  );
  const filas = useMemo(
    () => vigentes.map((a) => filaAsistencia(a, ctxDe(a.grado))).sort((a, b) => a.grado.localeCompare(b.grado, 'es', { numeric: true })),
    [vigentes, ctx], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const remitidos = useMemo(() => vigentes.flatMap((a) =>
    Object.entries(a.citas).flatMap(([id, c]) => {
      const s = seguimientoDe(c, { ...ctxDe(a.grado), entregaCerrada: !!a.entregaCerradaEn });
      return s.estado === 'remitida' ? [{ agenda: a, id, cita: c, motivo: s.motivoRemision ?? '' }] : [];
    })), [vigentes, ctx]); // eslint-disable-line react-hooks/exhaustive-deps
  const reprogramadas = vigentes.reduce((n, a) => n + Object.values(a.citas).filter((c) => c.reprogramacion && !c.remision).length, 0);

  // Los nombres solo hacen falta si hay remitidos, se abre un grupo o se va a imprimir.
  useEffect(() => {
    if (estudiantes || (remitidos.length === 0 && reprogramadas === 0 && !abierto)) return;
    void leerEstudiantesDeSede(sede).then(setEstudiantes).catch(() => setEstudiantes([]));
  }, [remitidos.length, reprogramadas, abierto, estudiantes, sede]);

  if (vigentes.length === 0) return null;
  const especiales = vigentes.filter((a) => conv.excepcionesAgenda?.[a.grado]).map((a) => `${a.grado} (${fechaLarga(fechaDe(a.grado)!)})`);

  const nombreDe = (id: string) => { const e = estudiantes?.find((x) => x.studentId === id); return e ? nombreCompleto(e) : '…'; };
  const total = totalAsistencia(filas);
  const tarjetas: { valor: string | number; texto: string; clase?: string }[] = [
    { valor: total.citados, texto: 'Citados' },
    { valor: total.vinieron, texto: 'Vinieron a la entrega' },
    { valor: total.faltaron, texto: 'Faltaron', clase: total.faltaron ? 'text-danger' : '' },
    { valor: total.asistieron, texto: 'Recibieron el informe' },
    { valor: `${total.porcentaje} %`, texto: 'De los citados recibió' },
  ];

  async function descargarSeguimiento() {
    setOcupado(true);
    setError(null);
    try {
      const todos = estudiantes ?? (await leerEstudiantesDeSede(sede));
      if (!estudiantes) setEstudiantes(todos);
      const citas = vigentes
        .slice()
        .sort((a, b) => a.grado.localeCompare(b.grado, 'es', { numeric: true }))
        .flatMap((a) => citacionesSeguimientoDe(a.grado, convocatoriaDelGrado(conv, a.grado), a, todos.filter((e) => e.gradoActual === a.grado), nombreDirector(directores[a.grado])));
      const ok = imprimirSeguimiento(sede, citas, constancias, `Citaciones de seguimiento · ${conv.jornada === 'manana' ? 'mañana' : 'tarde'} · periodo ${conv.periodo}`);
      if (!ok) setError('El navegador bloqueó la ventana de impresión: permita las ventanas emergentes de la app.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo preparar el documento.');
    } finally {
      setOcupado(false);
    }
  }

  async function atender(r: (typeof remitidos)[number]) {
    setOcupado(true);
    setError(null);
    try {
      const idDoc = citacionAlertaId(r.agenda.anio, r.agenda.periodo, r.agenda.sede, r.agenda.grado);
      await atenderRemision(idDoc, r.id, r.motivo, (nota[`${r.agenda.grado}_${r.id}`] ?? '').trim(), !!r.cita.remision);
      onRecargar();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar.');
    } finally {
      setOcupado(false);
    }
  }

  return (
    <section className="flex flex-col gap-3">
      <h3 className="text-sm font-semibold text-strong">
        Asistencia de la entrega{conv.fechaEntrega ? ` · ${fechaLarga(conv.fechaEntrega)}` : ''}
      </h3>
      {especiales.length > 0 && <p className="text-xs text-muted">Con caso especial: {especiales.join(', ')}.</p>}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        {tarjetas.map((c) => (
          <div key={c.texto} className="rounded-2xl border border-line bg-card px-3 py-2">
            <p className={`text-2xl font-bold ${c.clase || 'text-strong'}`}>{c.valor}</p>
            <p className="text-xs text-muted">{c.texto}</p>
          </div>
        ))}
      </div>
      {(total.sinMarcar > 0 || total.remitidos > 0) && (
        <p className="text-xs text-muted">
          {total.sinMarcar > 0 && `${total.sinMarcar} sin marcar todavía por su director. `}
          {total.remitidos > 0 && `${total.remitidos} remitido${total.remitidos === 1 ? '' : 's'} a coordinación (abajo).`}
        </p>
      )}
      <div className="overflow-x-auto rounded-2xl border border-line bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-xs text-muted">
              <th className="px-2 sm:px-3 py-2 text-left font-medium">Grupo</th>
              <th className="px-1 sm:px-2 py-2 text-center font-medium">Citados</th>
              <th className="px-1 sm:px-2 py-2 text-center font-medium">Vinieron</th>
              <th className="px-1 sm:px-2 py-2 text-center font-medium">Faltaron</th>
              <th className="hidden px-1 sm:px-2 py-2 text-center font-medium sm:table-cell">Sin marcar</th>
              <th className="px-1 sm:px-2 py-2 text-center font-medium">Recibieron</th>
              <th className="hidden px-1 sm:px-2 py-2 text-center font-medium sm:table-cell">Remitidos</th>
              <th className="px-1 sm:px-2 py-2 text-center font-medium">%</th>
            </tr>
          </thead>
          <tbody>
            {filas.map((f) => {
              const agenda = agendas.find((a) => a.grado === f.grado)!;
              const esta = abierto === f.grado;
              return (
                <Fragment key={f.grado}>
                  <tr
                    onClick={() => setAbierto(esta ? null : f.grado)}
                    className="cursor-pointer border-b border-line last:border-0 hover:bg-elevated"
                    title={esta ? 'Cerrar el grupo' : 'Ver los nombres'}
                  >
                    <td className="px-2 sm:px-3 py-1.5 font-semibold text-strong">
                      <span aria-hidden className="mr-1 text-muted">{esta ? '▾' : '▸'}</span>
                      {f.grado}
                    </td>
                    <td className="px-1 sm:px-2 py-1.5 text-center">{f.citados}</td>
                    <td className="px-1 sm:px-2 py-1.5 text-center">{f.vinieron}</td>
                    <td className={`px-1 sm:px-2 py-1.5 text-center ${f.faltaron ? 'font-semibold text-danger' : ''}`}>{f.faltaron || ''}</td>
                    <td className="hidden px-1 sm:px-2 py-1.5 text-center text-muted sm:table-cell">{f.sinMarcar || ''}</td>
                    <td className="px-1 sm:px-2 py-1.5 text-center">{f.asistieron}</td>
                    <td className={`hidden px-1 sm:px-2 py-1.5 text-center sm:table-cell ${f.remitidos ? 'font-semibold text-danger' : ''}`}>{f.remitidos || ''}</td>
                    <td className="whitespace-nowrap px-1 sm:px-2 py-1.5 text-center">{f.porcentaje} %</td>
                  </tr>
                  {esta && (
                    <tr className="border-b border-line bg-elevated">
                      <td colSpan={8} className="px-2 sm:px-3 py-2">
                        <p className="mb-1 text-xs text-muted">Director: {nombreDirector(directores[f.grado]) || 'sin director'}</p>
                        <ul className="flex flex-col gap-1">
                          {citadosDelGrupo(agenda, ctxDe(agenda.grado)).map((c) => (
                            <li key={c.id} className="flex flex-wrap items-center gap-2">
                              <span className="min-w-0 flex-1 text-strong">{nombreDe(c.id)}</span>
                              <span className={`rounded-full px-1 sm:px-2 py-0.5 text-xs font-semibold ${ETIQUETA_SEGUIMIENTO[c.estado].clase}`}>
                                {c.falto && c.estado !== 'remitida' && c.estado !== 'asistio_reprogramada' ? 'Faltó · ' : ''}
                                {ETIQUETA_SEGUIMIENTO[c.estado].texto}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
            <tr className="bg-elevated font-semibold">
              <td className="px-2 sm:px-3 py-1.5">Jornada</td>
              <td className="px-1 sm:px-2 py-1.5 text-center">{total.citados}</td>
              <td className="px-1 sm:px-2 py-1.5 text-center">{total.vinieron}</td>
              <td className="px-1 sm:px-2 py-1.5 text-center">{total.faltaron || ''}</td>
              <td className="hidden px-1 sm:px-2 py-1.5 text-center sm:table-cell">{total.sinMarcar || ''}</td>
              <td className="px-1 sm:px-2 py-1.5 text-center">{total.asistieron}</td>
              <td className="hidden px-1 sm:px-2 py-1.5 text-center sm:table-cell">{total.remitidos || ''}</td>
              <td className="whitespace-nowrap px-1 sm:px-2 py-1.5 text-center">{total.porcentaje} %</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted">Toque un grupo para ver los nombres; primero aparecen los que faltaron.</p>

      <h3 className="text-sm font-semibold text-strong">Casos remitidos por los directores ({remitidos.length})</h3>
      {remitidos.length === 0 ? (
        <p className="text-sm text-muted">Ningún caso remitido.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {remitidos.map((r) => {
            const k = `${r.agenda.grado}_${r.id}`;
            const c = r.cita;
            const atendida = c.remision?.atendidaEn;
            return (
              <li key={k} className="rounded-xl border border-line bg-card p-3 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-strong">{r.agenda.grado}</span>
                  <span className="min-w-0 flex-1 text-strong">{nombreDe(r.id)}</span>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${atendida ? 'bg-success-soft text-success-soft-fg' : 'bg-danger-soft text-danger-soft-fg'}`}>
                    {atendida ? 'Atendido' : 'Por atender'}
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted">
                  Motivo: {r.motivo}.
                  {c.justificacion ? ` Justificó por ${c.justificacion.medio}${c.justificacion.nota ? `: «${c.justificacion.nota}»` : ''}.` : ' No justificó.'}
                  {c.reprogramacion && ` Segunda citación: ${fechaLarga(c.reprogramacion.fecha)}, ${horaLegible(c.reprogramacion.hora)}${c.reprogramacion.enviadaCorreoEn ? ', correo enviado' : ''}${c.reprogramacion.enviadaSmsEn ? ', SMS enviado' : ''}.`}
                  {c.remision?.notaCoordinacion && ` Coordinación: «${c.remision.notaCoordinacion}».`}
                </p>
                {!atendida && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    <input
                      value={nota[k] ?? ''}
                      onChange={(e) => setNota((n) => ({ ...n, [k]: e.target.value.slice(0, 200) }))}
                      placeholder="Qué se hizo (citación de coordinación, llamada…)"
                      className={`${CAJA} min-w-[14rem] flex-1`}
                    />
                    <button disabled={ocupado} onClick={() => void atender(r)} className={`${BOTON} border border-line text-strong`}>Marcar atendido</button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <div className="flex flex-col gap-2 rounded-2xl border border-line bg-card p-4">
        <p className="text-xs text-muted">
          Citaciones de seguimiento: las segundas citaciones que ya generaron los directores ({reprogramadas}) y constancias de
          asistencia con la fecha en blanco, en un solo archivo para biblioteca.
        </p>
        <div className="flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1 text-xs text-muted">
            Constancias en blanco
            <input type="number" min={0} step={4} value={constancias} onChange={(e) => setConstancias(Math.max(0, +e.target.value))} className={`${CAJA} w-24`} />
          </label>
          <button disabled={ocupado || (reprogramadas === 0 && constancias === 0)} onClick={() => void descargarSeguimiento()} className={`${BOTON} bg-accent text-accent-fg`}>
            Descargar citaciones de seguimiento
          </button>
        </div>
      </div>
      {error && <p className="text-sm text-danger">{error}</p>}
    </section>
  );
}
