import { asignacionDeDocente } from '../data/asignacionAcademica';
import { colorGrado } from '../data/maestros';
import { gradoSortKey } from './domain/ids';

/**
 * "Mis grupos" — la puerta de entrada del docente al módulo.
 *
 * Reemplaza el formulario de texto libre: la asignación académica ya sabe qué grados y
 * qué asignaturas dicta cada docente, así que no hay nada que escribir a mano. Una
 * tarjeta por CRUCE grado+asignatura, no por asignatura — un docente que dicta
 * Matemáticas en 11.1 y en 11.2 tiene dos planillas distintas, y debe ver dos tarjetas.
 */
export default function MisGrupos({
  slotId,
  onElegir,
  onSinAsignacion,
}: {
  slotId: string | null;
  onElegir: (grado: string, subjectId: string) => void;
  onSinAsignacion: () => void;
}) {
  const resumenes = slotId ? asignacionDeDocente(slotId) : [];

  // El Centro de Interés (`asignaturaId: 'ci'`, grupo `'CI mañana'` / `'CI tarde'`) NO es
  // un grupo de clase: es la franja institucional donde participan TODOS los grupos de
  // la jornada a la vez, sin estudiantes fijos. Una tarjeta con "CI mañana" invitaría a
  // abrir una planilla que no tiene sentido — ese registro vive en la pestaña Eventos.
  const tieneCentroInteres = resumenes.some((r) => r.asignatura.id === 'ci');

  const tarjetas = resumenes
    .filter((r) => r.asignatura.id !== 'ci')
    .flatMap((r) => r.grupos.map((g) => ({ grado: g.grupo, asignatura: r.asignatura, horas: g.horas })))
    // Jornada primero (mañana antes que tarde), luego grado: es el orden en que un
    // docente de pie recorre su horario, no el orden alfabético del grupo.
    .sort((a, b) => gradoSortKey(a.grado).localeCompare(gradoSortKey(b.grado)));

  // Sin ninguna entrada en la asignación: docente de apoyo, o alguien cuya asignación
  // todavía no se cargó. Sin esto no habría forma de entrar al módulo.
  if (resumenes.length === 0) {
    return (
      <div className="rounded-xl border border-line bg-card p-4 text-center">
        <p className="text-sm text-strong">No hay asignación académica cargada para usted.</p>
        <p className="mt-1 text-xs text-muted">
          Puede que sea un cargo de apoyo, o que la asignación de este periodo aún no se
          haya cargado. Puede abrir una sesión escribiendo el grado y la asignatura a mano.
        </p>
        <button
          onClick={onSinAsignacion}
          className="mt-3 min-h-[36px] rounded-lg border border-line px-3 py-2 text-sm font-medium text-strong"
        >
          Abrir sesión sin asignación
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {tarjetas.length === 0 ? (
        // Tiene asignación, pero es solo Centro de Interés: no hay ningún cruce que
        // produzca una planilla. Se ofrece igual el respaldo manual por si acaso.
        <div className="rounded-xl border border-line bg-card p-4 text-center">
          <p className="text-sm text-strong">Su única asignación es el Centro de Interés.</p>
          <p className="mt-1 text-xs text-muted">No tiene grupos de clase con planilla propia.</p>
          <button
            onClick={onSinAsignacion}
            className="mt-3 min-h-[36px] rounded-lg border border-line px-3 py-2 text-sm font-medium text-strong"
          >
            Abrir sesión sin asignación
          </button>
        </div>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          {tarjetas.map((t) => (
            <button
              key={`${t.grado}|${t.asignatura.id}`}
              onClick={() => onElegir(t.grado, t.asignatura.id)}
              style={{ borderLeftColor: colorGrado(t.grado) }}
              className="min-h-[72px] w-full rounded-xl border border-line border-l-4 bg-card p-3 text-left hover:bg-hover"
            >
              {/* El grado va grande Y con el color oficial de su grado: es lo que el ojo
                  busca primero, y el color refuerza el número en vez de competir con él.
                  Con el filete del borde solo, el color casi no se percibe en el celular. */}
              <p
                style={{ color: colorGrado(t.grado) }}
                className="text-2xl font-bold leading-tight"
              >
                {t.grado}
              </p>
              <p className="text-sm text-muted">
                {t.asignatura.nombre} · {t.horas}h/semana
              </p>
            </button>
          ))}
        </div>
      )}

      {tieneCentroInteres && (
        <p className="text-xs text-muted">
          El Centro de Interés se lleva desde la pestaña <b>Eventos</b>, no desde aquí: es
          una franja de toda la jornada, no un curso con estudiantes fijos.
        </p>
      )}
    </div>
  );
}
