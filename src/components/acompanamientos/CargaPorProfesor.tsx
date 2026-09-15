// Pantalla «Carga por profesor» (tarea 3.4 del editor de acompañamientos,
// extendida en la tarea A.3 con metas editables por profesor).
// Recibe TODO por props — no lee el store ni Firestore (ver CLAUDE.md /
// TAREAS.md: principio de diseño obligatorio de este módulo) — para poder
// verse en el banco de pruebas local sin iniciar sesión.

import { cn } from '@/lib/utils';
import type { Distribucion } from '../../data/acompanamientos/tipos';
import { cargaPorDocente, revisar } from '../../data/acompanamientos/revision';
import { docentesDeLaJornada, esMixto, diasDisponibles } from '../../data/acompanamientos/disponibilidad';
import { metasAutomaticas } from '../../data/acompanamientos/metas';
import { clasesEnDia, DIA_CARGADO } from '../../data/acompanamientos/clases';
import { DIAS } from '../../data/acompanamientos/tipos';

const DIA_LABEL: Record<string, string> = {
  lunes: 'Lunes', martes: 'Martes', miercoles: 'Miércoles', jueves: 'Jueves', viernes: 'Viernes',
};

interface Props {
  distribucion: Distribucion;
  /** Si viene, habilita la edición de metas (número objetivo por profesor). */
  onCambiarMetas?: (metas: Record<string, number>) => void;
}

export default function CargaPorProfesor({ distribucion, onCambiarMetas }: Props) {
  const docentes = docentesDeLaJornada(distribucion.jornada);
  const carga = cargaPorDocente(distribucion);
  const { avisos } = revisar(distribucion);
  const avisoCargaDesigual = avisos.find((a) => a.tipo === 'carga_desigual');

  const zonaNombre = (zonaId: string) => distribucion.zonas.find((z) => z.id === zonaId)?.nombre ?? zonaId;

  const metas = distribucion.metas;
  const totalCasillas = distribucion.zonas.reduce((s, z) => s + z.cupo * DIAS.length, 0);
  const sumaMetas = metas ? docentes.reduce((s, u) => s + (metas[u.id] ?? 0), 0) : null;

  // Orden: de más a menos acompañamientos, luego por nombre.
  const filas = docentes
    .map((u) => ({ usuario: u, entrada: carga.get(u.id) ?? { total: 0, asignaciones: [] } }))
    .sort((a, b) => b.entrada.total - a.entrada.total || a.usuario.nombre.localeCompare(b.usuario.nombre, 'es'));

  function cambiarMeta(docenteId: string, nuevo: number) {
    if (!onCambiarMetas) return;
    const base = metas ?? {};
    const max = Math.max(0, diasDisponibles(docenteId, distribucion.jornada).length, 5);
    const acotado = Math.max(0, Math.min(nuevo, Math.min(max, 5)));
    onCambiarMetas({ ...base, [docenteId]: acotado });
  }

  function volverAutomatico() {
    if (!onCambiarMetas) return;
    onCambiarMetas(metasAutomaticas(distribucion));
  }

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-line bg-elevated/40 px-4 py-3 space-y-1.5">
        <p className="text-strong text-sm font-semibold">
          {totalCasillas} casilla{totalCasillas === 1 ? '' : 's'} · {docentes.length} profesor{docentes.length === 1 ? '' : 'es'}
        </p>

        {metas ? (
          <>
            <p className={cn('text-xs', sumaMetas === totalCasillas ? 'text-muted' : 'text-warning-soft-fg font-medium')}>
              Metas: {sumaMetas} de {totalCasillas} casillas
              {sumaMetas !== totalCasillas && (
                sumaMetas! < totalCasillas
                  ? ` · faltan ${totalCasillas - sumaMetas!} por repartir`
                  : ` · sobran ${sumaMetas! - totalCasillas}`
              )}
            </p>
            {onCambiarMetas && (
              <button
                onClick={volverAutomatico}
                className="text-accent text-xs font-semibold hover:opacity-80 transition"
              >
                Volver a lo automático
              </button>
            )}
          </>
        ) : (
          avisoCargaDesigual && <p className="text-warning-soft-fg text-xs">{avisoCargaDesigual.mensaje}</p>
        )}
      </div>

      <div className="space-y-2">
        {filas.map(({ usuario, entrada }) => {
          const mixto = esMixto(usuario.id);
          const meta = metas?.[usuario.id] ?? 0;
          const maxMeta = Math.min(5, Math.max(diasDisponibles(usuario.id, distribucion.jornada).length, 1));
          return (
            <div key={usuario.id} className="rounded-xl border border-line bg-card px-4 py-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <span
                    className="rounded-lg px-2.5 py-1 text-xs font-bold"
                    style={{ borderWidth: 1, borderColor: usuario.color, backgroundColor: `${usuario.color}15`, color: usuario.color }}
                  >
                    {usuario.nombreCorto}
                  </span>
                  {mixto && (
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-muted bg-elevated border border-line rounded-full px-2 py-0.5">
                      mixto · meta a la mitad
                    </span>
                  )}
                </div>

                {metas ? (
                  onCambiarMetas ? (
                    <div className="flex items-center gap-2">
                      <span className={cn('text-xs font-semibold', entrada.total !== meta ? 'text-warning-soft-fg' : 'text-soft')}>
                        {entrada.total} de {meta}
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => cambiarMeta(usuario.id, meta - 1)}
                          disabled={meta <= 0}
                          className="w-6 h-6 rounded-md border border-line text-soft hover:bg-hover transition disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center text-sm font-bold"
                          aria-label={`Bajar meta de ${usuario.nombreCorto}`}
                        >
                          −
                        </button>
                        <span className="text-strong text-xs font-bold w-4 text-center">{meta}</span>
                        <button
                          onClick={() => cambiarMeta(usuario.id, meta + 1)}
                          disabled={meta >= maxMeta}
                          className="w-6 h-6 rounded-md border border-line text-soft hover:bg-hover transition disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center text-sm font-bold"
                          aria-label={`Subir meta de ${usuario.nombreCorto}`}
                        >
                          +
                        </button>
                      </div>
                    </div>
                  ) : (
                    <span className={cn('text-sm font-semibold', entrada.total !== meta ? 'text-warning-soft-fg' : 'text-soft')}>
                      {entrada.total} de {meta}
                    </span>
                  )
                ) : (
                  <span className="text-soft text-sm font-semibold">
                    {entrada.total} acompañamiento{entrada.total === 1 ? '' : 's'}
                  </span>
                )}
              </div>

              {entrada.total === 0 ? (
                <p className="text-muted text-xs mt-2 opacity-70">Sin acompañamientos</p>
              ) : (
                <ul className="mt-2 space-y-1">
                  {entrada.asignaciones
                    .slice()
                    .sort((a, b) => DIAS.indexOf(a.dia) - DIAS.indexOf(b.dia))
                    .map((a, i) => {
                      const clases = clasesEnDia(usuario.id, distribucion.jornada, a.dia);
                      const cargado = clases >= DIA_CARGADO;
                      return (
                        <li
                          key={`${a.zonaId}-${a.dia}-${i}`}
                          className={cn('text-xs', cargado ? 'text-warning-soft-fg font-medium' : 'text-muted')}
                        >
                          {DIA_LABEL[a.dia]} · {zonaNombre(a.zonaId)} ({clases} clase{clases === 1 ? '' : 's'})
                          {cargado && ' · día cargado'}
                        </li>
                      );
                    })}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
