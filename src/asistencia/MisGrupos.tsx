import { asignacionDeDocente, getAsignatura } from '../data/asignacionAcademica';
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
  extras,
  onElegir,
  onSinAsignacion,
}: {
  slotId: string | null;
  /**
   * Cruces que TIENEN sesiones registradas pero NO estan en la asignacion academica.
   *
   * Sin esto quedarian inalcanzables al hacer de esta pantalla la unica puerta de
   * entrada: las planillas viejas con el codigo de asignatura escrito a mano, las que
   * abrio un docente de apoyo por el formulario manual, y —para el coordinador y la
   * rectora, que no tienen asignacion academica— absolutamente todas.
   */
  extras: { grado: string; subjectId: string }[];
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

  // Cruces con sesiones que NO estan en la asignacion. Se descartan los que ya salen
  // arriba para no ofrecer el mismo grupo dos veces.
  const yaListado = new Set(tarjetas.map((t) => `${t.grado}|${t.asignatura.id}`));
  const otros = extras
    .filter((e) => !yaListado.has(`${e.grado}|${e.subjectId}`))
    .sort((a, b) => gradoSortKey(a.grado).localeCompare(gradoSortKey(b.grado)));

  // Ni asignacion ni sesiones: docente de apoyo, o alguien cuya asignacion no se ha
  // cargado. Sin esta salida no habria forma de entrar al modulo.
  if (tarjetas.length === 0 && otros.length === 0) {
    return (
      <div className="rounded-xl border border-line bg-card p-4 text-center">
        <p className="text-sm text-strong">
          {tieneCentroInteres
            ? 'Su única asignación es el Centro de Interés.'
            : 'No hay asignación académica cargada para usted.'}
        </p>
        <p className="mt-1 text-xs text-muted">
          {tieneCentroInteres
            ? 'No tiene grupos de clase con planilla propia. El Centro de Interés se lleva desde la pestaña Eventos.'
            : 'Puede que sea un cargo de apoyo, o que la asignación de este periodo aún no se haya cargado. Puede abrir una sesión escribiendo el grado y la asignatura a mano.'}
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
      <div className="grid gap-2 sm:grid-cols-2">
        {tarjetas.map((t) => (
          <TarjetaGrupo
            key={`${t.grado}|${t.asignatura.id}`}
            grado={t.grado}
            detalle={`${t.asignatura.nombre} · ${t.horas}h/semana`}
            onElegir={() => onElegir(t.grado, t.asignatura.id)}
          />
        ))}
      </div>

      {otros.length > 0 && (
        <div className="space-y-2">
          {/* Aparte y explicado: son planillas reales, pero fuera de la asignacion. Si se
              mezclaran con las de arriba, el docente no distinguiria su horario oficial de
              lo que abrio a mano o quedo de un periodo anterior. */}
          <p className="text-xs text-muted">
            Otras planillas con registros suyos, fuera de la asignación académica:
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {otros.map((e) => (
              <TarjetaGrupo
                key={`${e.grado}|${e.subjectId}`}
                grado={e.grado}
                detalle={getAsignatura(e.subjectId)?.nombre ?? e.subjectId}
                onElegir={() => onElegir(e.grado, e.subjectId)}
              />
            ))}
          </div>
        </div>
      )}

      {tieneCentroInteres && (
        <p className="text-xs text-muted">
          El Centro de Interés se lleva desde la pestaña <b>Eventos</b>, no desde aquí: es
          una franja de toda la jornada, no un curso con estudiantes fijos.
        </p>
      )}

      <button
        onClick={onSinAsignacion}
        className="min-h-[36px] text-xs text-muted underline"
      >
        Abrir una sesión de un grupo que no aparece aquí
      </button>
    </div>
  );
}

/**
 * El grado va grande Y con el color oficial de su grado: es lo que el ojo busca primero,
 * y el color refuerza el numero en vez de competir con el. Con el filete del borde solo,
 * el color casi no se percibe en el celular.
 */
function TarjetaGrupo({
  grado,
  detalle,
  onElegir,
}: {
  grado: string;
  detalle: string;
  onElegir: () => void;
}) {
  return (
    <button
      onClick={onElegir}
      style={{ borderLeftColor: colorGrado(grado) }}
      className="min-h-[72px] w-full rounded-xl border border-line border-l-4 bg-card p-3 text-left hover:bg-hover"
    >
      <p style={{ color: colorGrado(grado) }} className="text-2xl font-bold leading-tight">
        {grado}
      </p>
      <p className="text-sm text-muted">{detalle}</p>
    </button>
  );
}
