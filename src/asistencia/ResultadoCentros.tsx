import { useEffect, useMemo, useState } from 'react';
import Avatar from './Avatar';
import { leerProgramasVisibles, leerValoracionesDeGrado } from './datos';
import { nombresDePila } from './domain/nombres';
import { jornadaDeGrado } from './domain/ids';
import { hojaResultadoCentros } from './domain/exports';
import {
  consolidarGrupo,
  nivelDe,
  PLAN_DE_APOYO,
  resumirConsolidado,
} from './domain/valoracion';
import type { NivelValoracion, Programa, Student, ValoracionEstudiante } from './domain/types';

const CLASE_NIVEL: Record<NivelValoracion, string> = {
  1: 'bg-warning-soft text-warning-soft-fg',
  2: 'bg-info-soft text-info-soft-fg',
  3: 'bg-success-soft text-success-soft-fg',
  4: 'bg-accent-soft text-accent-soft-fg',
};

/**
 * Resultado del centro de interes — la pantalla del DIRECTOR DE GRUPO.
 *
 * ESTO ES LO QUE REEMPLAZA EL DRIVE. Hasta hoy el director esperaba a que seis lideres
 * llenaran una hoja compartida, la consolidaba a mano y despues digitaba en el Master.
 * Aqui sus estudiantes salen ya cruzados, vengan del centro que vengan.
 *
 * COMO LLEGA LO DE SEIS CENTROS AJENOS: cada valoracion se guarda marcada con el GRADO del
 * estudiante, y la regla dice "el director de ese grado puede leerla". Una sola consulta,
 * `where('grado','==','11.2')`, y sin que se le abra ningun centro. Ver `domain/valoracion.ts`.
 *
 * Los indicadores vienen COPIADOS dentro de cada valoracion, asi que esta pantalla no
 * necesita leer la configuracion de esos centros —que no podria— para mostrar los codigos.
 */
export default function ResultadoCentros({
  grado,
  estudiantes,
}: {
  grado: string;
  /** Los del grupo, activos. Los trae `index.tsx`, que ya los tiene cargados. */
  estudiantes: Student[];
}) {
  const [programa, setPrograma] = useState<Programa | null>(null);
  const [valoraciones, setValoraciones] = useState<ValoracionEstudiante[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [descargando, setDescargando] = useState(false);

  useEffect(() => {
    let vivo = true;
    void (async () => {
      setError(null);
      try {
        // El programa vigente de la JORNADA del grupo. Se valora una vez al semestre
        // (Julian, 2026-09-10), asi que no hay que elegir periodo — pero si hay dos
        // programas activos, uno por jornada, y coger el primero le mostraria al director
        // de un grupo de la manana el programa de la tarde: cero valoraciones y ninguna
        // pista de por que.
        const programas = await leerProgramasVisibles();
        const activo =
          programas.find(
            (p) => p.activo && (!p.jornada || p.jornada === jornadaDeGrado(grado)),
          ) ?? null;
        if (!vivo) return;
        setPrograma(activo);
        if (!activo) return;
        setValoraciones(await leerValoracionesDeGrado(grado, activo.programaId));
      } catch (e) {
        if (vivo) setError(`No fue posible cargar las valoraciones: ${(e as Error).message}`);
      } finally {
        if (vivo) setCargando(false);
      }
    })();
    return () => {
      vivo = false;
    };
  }, [grado]);

  const filas = useMemo(
    // `null` = no se sabe quien esta inscrito: el director no puede leer los centros de
    // sus estudiantes. Sin esto, un "sin centro" inventado le diria que no espere a nadie.
    () => consolidarGrupo(estudiantes, valoraciones, null),
    [estudiantes, valoraciones],
  );
  const resumen = useMemo(() => resumirConsolidado(filas), [filas]);
  const porId = useMemo(
    () => new Map(estudiantes.map((e) => [e.studentId, e])),
    [estudiantes],
  );

  async function descargar() {
    setDescargando(true);
    try {
      const hoja = hojaResultadoCentros(grado, filas);
      const { default: ExcelJS } = await import('exceljs');
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet(hoja.nombre.slice(0, 31));
      ws.addRow(hoja.encabezados);
      for (const f of hoja.filas) ws.addRow(f);
      ws.addRow([]);
      for (const n of hoja.notas) ws.addRow([n]);
      const buf = await wb.xlsx.writeBuffer();
      const url = URL.createObjectURL(
        new Blob([buf], {
          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        }),
      );
      const a = document.createElement('a');
      a.href = url;
      a.download = `${hoja.nombre}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(`No fue posible generar el Excel: ${(e as Error).message}`);
    } finally {
      setDescargando(false);
    }
  }

  if (cargando) return <p className="p-3 text-sm text-muted">Cargando el resultado…</p>;

  if (!programa) {
    return (
      <p className="rounded-xl border border-line bg-card p-3 text-sm text-muted">
        No hay ningún programa de centros de interés activo en este momento.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {error && (
        <div className="rounded-xl border border-danger-soft bg-danger-soft p-3 text-sm text-danger-soft-fg">
          {error}
        </div>
      )}

      {/* EL AVANCE PRIMERO. El dolor del director no es el resultado: es la espera. Aqui
          ve de un vistazo si ya puede digitar o a quien le falta. */}
      <div className="rounded-xl border border-line bg-card p-3">
        <p className="text-sm text-strong">
          <b>
            {resumen.valorados} de {resumen.total}
          </b>{' '}
          con valoración
        </p>
        <p className="mt-0.5 text-xs text-muted">
          {resumen.pendientes > 0
            ? `${resumen.pendientes} sin valoración todavía. Puede ser que su líder no la haya puesto, o que no estén inscritos en ningún centro: eso lo sabe la coordinación del programa.`
            : 'Todos tienen valoración.'}
          {resumen.planDeApoyo > 0 && ` · ${resumen.planDeApoyo} en plan de apoyo.`}
        </p>
        {resumen.conDuplicado > 0 && (
          <p className="mt-1 text-xs text-warning-soft-fg">
            ⚠️ {resumen.conDuplicado} estudiante(s) con valoración en DOS centros. Están
            marcados abajo: decida cuál va al Máster antes de digitar.
          </p>
        )}
        <button
          onClick={() => void descargar()}
          disabled={descargando || resumen.valorados === 0}
          className="mt-2 min-h-[36px] rounded-lg border border-line px-3 py-1.5 text-sm font-medium text-strong disabled:opacity-50"
        >
          {descargando ? 'Generando…' : 'Descargar Excel'}
        </button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-line bg-card">
        <table className="w-max min-w-full border-collapse">
          <thead>
            <tr>
              <th className="border-b border-r border-line p-2 text-left text-xs font-semibold text-muted">
                Estudiante ({filas.length})
              </th>
              <th className="border-b border-line p-2 text-center text-xs font-semibold text-muted">
                Valoración
              </th>
              <th className="border-b border-line p-2 text-left text-xs font-semibold text-muted">
                Indicadores
              </th>
            </tr>
          </thead>
          <tbody>
            {filas.map((f) => {
              const est = porId.get(f.studentId);
              const v = f.valoracion;
              return (
                <tr key={f.studentId}>
                  <td className="border-b border-r border-line p-1.5">
                    <span className="flex items-center gap-2">
                      {est && <Avatar estudiante={est} tamano={32} />}
                      <span className="min-w-0 text-xs leading-tight text-strong">
                        <span className="block truncate font-semibold">{f.apellidos}</span>
                        <span className="block truncate text-muted">
                          {nombresDePila(f.apellidos, f.nombres)}
                        </span>
                        {f.duplicadas.length > 0 && (
                          <span className="block text-[0.65rem] font-semibold text-warning-soft-fg">
                            En dos centros
                          </span>
                        )}
                      </span>
                    </span>
                  </td>

                  <td className="border-b border-line p-1.5 text-center">
                    {!v ? (
                      <span className="text-xs text-muted">Sin valoración</span>
                    ) : (
                      <span
                        className={`inline-block rounded-lg px-2 py-1 text-sm font-semibold ${CLASE_NIVEL[v.nivel]}`}
                      >
                        <span className="font-bold">{v.nivel}</span> {nivelDe(v.nivel)?.label}
                      </span>
                    )}
                  </td>

                  <td className="border-b border-line p-1.5 text-xs text-soft">
                    {v?.nivel === PLAN_DE_APOYO ? (
                      <span className="text-muted">No se digita en el Máster.</span>
                    ) : (
                      (v?.codigos ?? []).join(' · ') || <span className="text-muted">—</span>
                    )}
                    {/* Las dos, sin escoger: quien decide es el director, no la aplicación. */}
                    {f.duplicadas.length > 1 && (
                      <span className="mt-0.5 block text-[0.65rem] text-warning-soft-fg">
                        {f.duplicadas
                          .map((d) => `${d.grupoId}: ${d.nivel} (${d.codigos.join(', ')})`)
                          .join(' — ')}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-muted">
        La columna «Valoración» es el número que se digita en el Máster: 2 Básico, 3 Alto, 4
        Superior. Los indicadores van en C1 a C4.
      </p>
    </div>
  );
}
