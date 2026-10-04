import { useEffect, useState } from 'react';
import { encuentrosDelDia, etiquetaHoras, sugerirClase } from './domain/bloques-clase';
import { asignaturasEnGrado, FRANJAS, useHorasDeHoy } from './horarioDelDia';

/**
 * «La lista que toca ahora», destacada arriba de «Mis grupos» (Julian, 2026-10-01).
 *
 * Sale de las clases EFECTIVAS de hoy del docente (ver `horarioDelDia.ts`, la misma fuente
 * que la pastilla «Próxima clase» del inicio: reemplazos, jornadas reducidas y festivos): la clase en curso o, si no hay, la siguiente
 * de hoy. Si es un bloque de dos horas lo dice, y «Pasar lista» abre la planilla con las
 * dos horas creadas y enlazadas. Si ya se llamo lista, baja el tono y ofrece verla.
 *
 * Se recalcula cada 30 segundos: la pantalla se deja abierta y la clase cambia sola.
 */
export default function TarjetaClaseAhora({
  slotId,
  sesionesHoy,
  onPasarLista,
}: {
  slotId: string | null;
  /** Sesiones de HOY a las que el docente tiene acceso, para saber si ya llamo lista. */
  sesionesHoy: { grado: string; bloque: number; subjectId: string }[];
  onPasarLista: (grado: string, subjectId: string, bloque: number) => void;
}) {
  const [ahora, setAhora] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setAhora(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);

  const encuentros = encuentrosDelDia(useHorasDeHoy(slotId, ahora));
  const sugerencia = sugerirClase(encuentros, FRANJAS, ahora.getHours() * 60 + ahora.getMinutes());
  if (!sugerencia) return null;

  const { encuentro } = sugerencia;
  const primera = encuentro.bloques[0];
  const asignaturas = asignaturasEnGrado(slotId, encuentro.grado);
  if (asignaturas.length === 0) return null;
  const tomada = (subjectId: string) =>
    sesionesHoy.some((s) => s.grado === encuentro.grado && s.bloque === primera && s.subjectId === subjectId);
  const todasTomadas = asignaturas.every((a) => tomada(a.id));

  const encabezado =
    sugerencia.estado === 'en_curso'
      ? 'Ahora'
      : sugerencia.faltan <= 15
        ? `Empieza en ${sugerencia.faltan} min`
        : 'Siguiente clase';

  return (
    <section
      aria-label="Clase para pasar lista"
      className={`rounded-2xl p-4 ${
        todasTomadas ? 'border border-line bg-card' : 'border-2 border-accent bg-accent-soft shadow-sm'
      }`}
    >
      <p className={`text-xs font-semibold uppercase tracking-wide ${todasTomadas ? 'text-muted' : 'text-accent'}`}>
        {encabezado}
        {encuentro.bloques.length === 2 && ' · bloque de dos horas'}
      </p>
      <p className="mt-1 text-2xl font-bold text-strong">
        {encuentro.grado}
        <span className="text-lg font-semibold"> · {asignaturas.map((a) => a.nombre).join(' / ')}</span>
      </p>
      <p className="text-sm text-muted">
        {etiquetaHoras(encuentro.bloques)} · {sugerencia.inicio} a {sugerencia.fin}
        {encuentro.aula ? ` · ${encuentro.aula}` : ''}
      </p>

      <div className="mt-3 grid gap-2">
        {asignaturas.map((a) => {
          const ya = tomada(a.id);
          const varias = asignaturas.length > 1;
          return (
            <button
              key={a.id}
              onClick={() => onPasarLista(encuentro.grado, a.id, primera)}
              className={
                ya
                  ? 'w-full rounded-xl border border-line p-2.5 text-sm font-semibold text-soft'
                  : 'w-full rounded-xl bg-accent p-3 text-base font-bold text-accent-fg'
              }
            >
              {ya ? `✓ Lista tomada${varias ? ` · ${a.nombre}` : ''} · Ver planilla` : `Pasar lista${varias ? ` · ${a.nombre}` : ''}`}
            </button>
          );
        })}
      </div>
      {encuentro.bloques.length === 2 && !todasTomadas && (
        <p className="mt-2 text-xs text-muted">
          Se llama lista una vez y cuenta para las dos horas. Si alguien llega en la segunda, se le
          corrige solo esa hora.
        </p>
      )}
    </section>
  );
}
