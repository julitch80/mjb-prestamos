/**
 * «Resumen del periodo» (2026-10-22): qué pasó con la permanencia entre dos fechas.
 *
 * SOLO LECTURA. No abre, no cierra y no modifica casos: la apertura automática es de la
 * parte «Estudiantes en riesgo» y aquí no se llama a nada que escriba. Cuenta con lo que
 * las reglas ya dejan leer a coordinación y rectoría en esta pantalla: el censo de la
 * tercera hora (cualquier usuario activo), los casos de la sede y sus seguimientos.
 *
 * No carga nada al entrar a la pantalla: solo al abrir la sección y cada vez que cambia el
 * rango. El censo se pide SOLO para el rango (un día de un grupo = un documento); si el
 * rango nuevo cabe dentro de lo ya leído, se filtra en memoria sin volver a leer. Los
 * seguimientos se leen una vez por caso y se guardan mientras la pantalla esté abierta.
 */

import { useEffect, useMemo, useRef, useState } from 'react';

import { useCalendario } from '../data/calendarioAcademico/persistencia';
import { leerCensosEntre, leerSeguimientos } from './datos';
import { toDateKey } from './domain/ids';
import { ESTADO_CASO_ETIQUETA, GESTION_ETIQUETA, NIVEL_ETIQUETA, type CasoPermanencia } from './domain/permanencia';
import {
  atajosDeRango,
  DECISION_ETIQUETA,
  desglose,
  hojasResumenPeriodo,
  problemaDelRango,
  rangoDelAnio,
  resumirPeriodo,
  textoRango,
  type RangoFechas,
} from './domain/resumen-permanencia';
import { TIPO_SEGUIMIENTO_ETIQUETA, type SeguimientoCaso } from './domain/seguimiento-caso';
import { ETIQUETA_JORNADA, gradoEnJornada, type FiltroJornada } from './domain/filtro-jornada';
import type { CensoDia, Sede, Student } from './domain/types';
import { imprimirResumenPermanencia, NOMBRE_SEDE } from './imprimirAlerta';

const CAJA = 'rounded-lg border border-line bg-elevated px-2 py-1.5 text-sm text-strong';
const BOTON = 'rounded-lg border border-line px-3 py-1.5 text-sm text-strong disabled:opacity-50';

export default function ResumenPeriodo({
  sede,
  filtro,
  estudiantes,
  casos,
  seguimientosConocidos,
}: {
  sede: Sede;
  /** El filtro de jornada que ya aplica la pantalla (el coordinador limitado no sale del suyo). */
  filtro: FiltroJornada;
  estudiantes: Student[];
  casos: CasoPermanencia[];
  /** Los seguimientos que la pantalla ya leyó (casos abiertos): no se vuelven a pedir. */
  seguimientosConocidos: Map<string, SeguimientoCaso[]>;
}) {
  const hoy = toDateKey(new Date());
  const { eventos } = useCalendario();
  const atajos = useMemo(() => atajosDeRango(eventos, hoy), [eventos, hoy]);

  const [abierto, setAbierto] = useState(false);
  const [rango, setRango] = useState<RangoFechas>(() => rangoDelAnio(hoy));
  const [borrador, setBorrador] = useState<RangoFechas>(() => rangoDelAnio(hoy));
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [censos, setCensos] = useState<CensoDia[] | null>(null);
  const [segsLeidos, setSegsLeidos] = useState<Map<string, SeguimientoCaso[]>>(new Map());

  // Lo ya leído, para no repetir lecturas al cambiar de rango.
  const cacheCensos = useRef<{ sede: Sede; desde: string; hasta: string; censos: CensoDia[] } | null>(null);
  const cacheSegs = useRef<Map<string, SeguimientoCaso[]>>(new Map());

  const casosRelevantes = useMemo(
    () => casos.filter((c) => c.fechaApertura <= rango.hasta && gradoEnJornada(c.grado, filtro)),
    [casos, rango.hasta, filtro],
  );

  useEffect(() => {
    if (!abierto || problemaDelRango(rango)) return;
    let vigente = true;
    setCargando(true);
    setError(null);
    (async () => {
      try {
        const cc = cacheCensos.current;
        let leidos: CensoDia[];
        if (cc && cc.sede === sede && cc.desde <= rango.desde && cc.hasta >= rango.hasta) {
          leidos = cc.censos;
        } else {
          leidos = await leerCensosEntre(rango.desde, rango.hasta, sede);
          cacheCensos.current = { sede, desde: rango.desde, hasta: rango.hasta, censos: leidos };
        }

        const faltan = casosRelevantes.filter(
          (c) => !seguimientosConocidos.has(c.casoId) && !cacheSegs.current.has(c.casoId),
        );
        const pares = await Promise.all(faltan.map(async (c) => [c.casoId, await leerSeguimientos(c.casoId)] as const));
        for (const [id, segs] of pares) cacheSegs.current.set(id, segs);

        if (!vigente) return;
        setCensos(leidos);
        setSegsLeidos(new Map(cacheSegs.current));
      } catch (e) {
        if (vigente) setError((e as Error).message);
      } finally {
        if (vigente) setCargando(false);
      }
    })();
    return () => {
      vigente = false;
    };
  }, [abierto, rango, sede, casosRelevantes, seguimientosConocidos]);

  const resumen = useMemo(() => {
    if (!censos) return null;
    const seguimientos: SeguimientoCaso[] = [];
    for (const c of casosRelevantes) {
      seguimientos.push(...(seguimientosConocidos.get(c.casoId) ?? segsLeidos.get(c.casoId) ?? []));
    }
    return resumirPeriodo({ rango, censos, estudiantes, casos: casosRelevantes, seguimientos, filtro });
  }, [censos, casosRelevantes, seguimientosConocidos, segsLeidos, estudiantes, rango, filtro]);

  const alcance = filtro === 'ambas' ? 'Ambas jornadas' : ETIQUETA_JORNADA[filtro];
  const problema = problemaDelRango(borrador);
  const atajoActivo = atajos.find((a) => a.rango.desde === rango.desde && a.rango.hasta === rango.hasta)?.id;

  function aplicar(r: RangoFechas) {
    setBorrador(r);
    setRango(r);
  }

  async function descargar() {
    if (!resumen) return;
    setError(null);
    try {
      const hojas = hojasResumenPeriodo(resumen, `Sede ${NOMBRE_SEDE[sede]} · ${alcance}`);
      // Import dinámico: `exceljs` no entra en el paquete inicial.
      const { default: ExcelJS } = await import('exceljs');
      const wb = new ExcelJS.Workbook();
      for (const hoja of hojas) {
        const ws = wb.addWorksheet(hoja.nombre.slice(0, 31));
        ws.addRow(hoja.encabezados).font = { bold: true };
        for (const fila of hoja.filas) ws.addRow(fila);
        ws.addRow([]);
        for (const nota of hoja.notas) ws.addRow([nota]);
        ws.columns.forEach((col, i) => {
          col.width = i === 0 ? 44 : 16;
        });
      }
      const blob = new Blob([await wb.xlsx.writeBuffer()], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `resumen-permanencia-${sede}${filtro === 'ambas' ? '' : `-${filtro}`}-${rango.desde}_a_${rango.hasta}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  function imprimir() {
    if (!resumen) return;
    if (!imprimirResumenPermanencia(sede, resumen, alcance)) {
      setError('El navegador bloqueó la ventana de impresión. Permita las ventanas emergentes para esta página.');
    }
  }

  return (
    <details
      className="rounded-xl border border-line bg-card p-3"
      onToggle={(e) => setAbierto((e.currentTarget as HTMLDetailsElement).open)}
    >
      <summary className="cursor-pointer text-sm font-semibold text-strong">Resumen del periodo</summary>
      <p className="mt-1 text-xs text-muted">
        Solo consulta: cuenta inasistencias, casos y seguimientos entre dos fechas (las dos incluidas). No abre ni
        cierra ningún caso.
      </p>

      {/* ---- Rango ---- */}
      <div className="mt-3 flex flex-wrap gap-1.5">
        {atajos.map((a) => (
          <button
            key={a.id}
            type="button"
            disabled={!a.disponible}
            onClick={() => aplicar(a.rango)}
            title={a.disponible ? textoRango(a.rango) : 'Todavía no empieza'}
            className={`rounded-full border px-3 py-1 text-xs disabled:opacity-40 ${
              atajoActivo === a.id ? 'border-accent bg-accent-soft text-strong' : 'border-line text-soft'
            }`}
          >
            {a.etiqueta}
            {a.nota ? ` (${a.nota})` : ''}
          </button>
        ))}
      </div>
      <div className="mt-2 flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1 text-xs text-muted">
          Desde
          <input
            type="date"
            value={borrador.desde}
            max={hoy}
            onChange={(e) => setBorrador({ ...borrador, desde: e.target.value })}
            className={CAJA}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted">
          Hasta
          <input
            type="date"
            value={borrador.hasta}
            max={hoy}
            onChange={(e) => setBorrador({ ...borrador, hasta: e.target.value })}
            className={CAJA}
          />
        </label>
        <button
          type="button"
          disabled={Boolean(problema) || (borrador.desde === rango.desde && borrador.hasta === rango.hasta)}
          onClick={() => setRango(borrador)}
          className={BOTON}
        >
          Consultar
        </button>
      </div>
      {problema && <p className="mt-1 text-xs text-danger-soft-fg">{problema}</p>}

      <p className="mt-3 text-base font-semibold text-strong">{textoRango(rango)}</p>
      <p className="text-xs text-muted">{alcance}</p>

      {error && (
        <p className="mt-2 rounded-lg border border-danger-soft bg-danger-soft p-2 text-sm text-danger-soft-fg">{error}</p>
      )}
      {cargando && <p className="mt-2 text-sm text-muted">Contando…</p>}

      {resumen && !cargando && (
        <>
          <div className="mt-2 flex flex-wrap gap-2">
            <button type="button" onClick={imprimir} className={BOTON}>
              Imprimir
            </button>
            <button type="button" onClick={() => void descargar()} className={BOTON}>
              Descargar Excel
            </button>
          </div>

          {/* ---- Inasistencias ---- */}
          <h4 className="mt-4 text-sm font-semibold text-strong">Inasistencias (censo de la tercera hora)</h4>
          <div className="mt-2 grid grid-cols-3 gap-2 text-center">
            <Cifra n={resumen.inasistencias.total} etiqueta="inasistencias (estudiante-día)" />
            <Cifra n={resumen.inasistencias.estudiantes} etiqueta="estudiantes con al menos una" />
            <Cifra n={resumen.inasistencias.diasConCenso} etiqueta="días con censo" />
          </div>
          {resumen.inasistencias.primerCenso ? (
            resumen.inasistencias.primerCenso > rango.desde && (
              <p className="mt-2 text-xs text-muted">
                El primer día con censo en este rango es el {resumen.inasistencias.primerCenso}: antes no hay datos de
                inasistencia.
              </p>
            )
          ) : (
            <p className="mt-2 rounded-lg border border-warning-soft bg-warning-soft p-2 text-xs text-warning-soft-fg">
              No hay censo de la tercera hora en este rango.
            </p>
          )}
          {resumen.inasistencias.gruposSinCenso.length > 0 && resumen.inasistencias.diasConCenso > 0 && (
            <p className="mt-2 rounded-lg border border-warning-soft bg-warning-soft p-2 text-xs text-warning-soft-fg">
              <b>Sin datos:</b> {resumen.inasistencias.gruposSinCenso.join(', ')}. Nadie pasó lista en tercera hora en
              estos grupos en el rango. <b>No significa que no haya faltado nadie.</b>
            </p>
          )}

          {resumen.inasistencias.top.length > 0 && (
            <details className="mt-2">
              <summary className="cursor-pointer text-xs text-muted">
                Los {resumen.inasistencias.top.length} estudiantes con más inasistencias
              </summary>
              <div className="mt-1 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-muted">
                      <th className="py-1">Estudiante</th>
                      <th className="py-1">Grado</th>
                      <th className="py-1 text-right">Inasistencias</th>
                    </tr>
                  </thead>
                  <tbody>
                    {resumen.inasistencias.top.map((f) => (
                      <tr key={f.studentId} className="border-t border-line">
                        <td className="py-1 text-strong">{f.nombre || <span className="text-muted">(ficha no activa)</span>}</td>
                        <td className="py-1 text-soft">{f.grado}</td>
                        <td className="py-1 text-right tabular-nums text-strong">{f.inasistencias}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          )}

          {/* ---- Casos ---- */}
          <h4 className="mt-4 text-sm font-semibold text-strong">Casos de permanencia</h4>
          <div className="mt-2 grid grid-cols-3 gap-2 text-center">
            <Cifra n={resumen.casos.abiertosEnRango} etiqueta="abiertos en el rango" />
            <Cifra n={resumen.casos.cerradosEnRango} etiqueta="cerrados en el rango" />
            <Cifra n={resumen.casos.abiertosAlFinal} etiqueta="seguían abiertos al final" />
          </div>
          <div className="mt-2 grid gap-2 text-xs sm:grid-cols-3">
            <Desglose titulo="Abiertos en el rango, por nivel" pares={desglose(resumen.casos.abiertosEnRangoPorNivel, NIVEL_ETIQUETA)} />
            <Desglose titulo="Cerrados, por estado" pares={desglose(resumen.casos.cerradosEnRangoPorEstado, ESTADO_CASO_ETIQUETA)} />
            <Desglose titulo="Abiertos al final, por estado" pares={desglose(resumen.casos.abiertosAlFinalPorEstado, ESTADO_CASO_ETIQUETA)} />
          </div>

          {/* ---- Seguimientos ---- */}
          <h4 className="mt-4 text-sm font-semibold text-strong">
            Seguimientos registrados: <span className="tabular-nums">{resumen.seguimientos.total}</span>
          </h4>
          <div className="mt-2 grid gap-2 text-xs sm:grid-cols-3">
            <Desglose titulo="Por tipo" pares={desglose(resumen.seguimientos.porTipo, TIPO_SEGUIMIENTO_ETIQUETA)} />
            <Desglose titulo="Por decisión" pares={desglose(resumen.seguimientos.porDecision, DECISION_ETIQUETA)} />
            {resumen.seguimientos.gestiones > 0 && (
              <Desglose
                titulo={`Gestiones marcadas en los casos (${resumen.seguimientos.gestiones})`}
                pares={desglose(resumen.seguimientos.gestionesPorTipo, GESTION_ETIQUETA)}
              />
            )}
          </div>

          {/* ---- Por grado ---- */}
          <details className="mt-4">
            <summary className="cursor-pointer text-sm font-semibold text-strong">Por grado</summary>
            <div className="mt-1 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted">
                    <th className="py-1">Grado</th>
                    <th className="py-1 text-right">Inasistencias</th>
                    <th className="py-1 text-right">Estudiantes</th>
                    <th className="py-1 text-right">Casos abiertos</th>
                  </tr>
                </thead>
                <tbody>
                  {resumen.porGrado.map((f) => (
                    <tr key={f.grado} className="border-t border-line">
                      <td className="py-1 text-strong">
                        {f.grado}
                        {f.diasConCenso === 0 && <span className="ml-1 text-xs text-muted">(sin censo)</span>}
                      </td>
                      <td className="py-1 text-right tabular-nums text-soft">{f.inasistencias}</td>
                      <td className="py-1 text-right tabular-nums text-soft">{f.estudiantesConInasistencia}</td>
                      <td className="py-1 text-right tabular-nums text-soft">{f.casosAbiertos}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-1 text-xs text-muted">
              «Estudiantes»: los que faltaron al menos un día en ese grupo. «Casos abiertos»: abiertos dentro del rango.
            </p>
          </details>
        </>
      )}
    </details>
  );
}

function Cifra({ n, etiqueta }: { n: number; etiqueta: string }) {
  return (
    <div className="rounded-lg border border-line bg-elevated p-2">
      <b className="block text-xl tabular-nums text-strong">{n}</b>
      <span className="text-xs text-muted">{etiqueta}</span>
    </div>
  );
}

function Desglose({ titulo, pares }: { titulo: string; pares: [string, number][] }) {
  return (
    <div className="rounded-lg border border-line p-2">
      <p className="font-semibold text-soft">{titulo}</p>
      {pares.length === 0 ? (
        <p className="text-muted">Ninguno.</p>
      ) : (
        <ul className="mt-1 space-y-0.5">
          {pares.map(([k, n]) => (
            <li key={k} className="flex justify-between gap-2">
              <span className="text-soft">{k}</span>
              <b className="tabular-nums text-strong">{n}</b>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
