import { useEffect, useRef, useState } from 'react';
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
  perfil = 'docente',
  todosLosGrados,
  onElegir,
  onSinAsignacion,
  grupoAbierto = null,
  onListaDelGrupo,
}: {
  slotId: string | null;
  /**
   * Cruces que TIENEN sesiones registradas pero NO estan en la asignacion academica.
   *
   * Sin esto quedarian inalcanzables al hacer de esta pantalla la unica puerta de
   * entrada: las planillas viejas con el codigo de asignatura escrito a mano, las que
   * abrio un docente de apoyo por el formulario manual, y —para el coordinador, la
   * rectora y los cargos de apoyo, que no tienen asignacion academica— absolutamente
   * todas.
   */
  extras: { grado: string; subjectId: string }[];
  /**
   * Quien esta mirando. Cambia el mensaje cuando no hay nada que enseñar, que es donde
   * esta pantalla mentia:
   *
   *  - `docente`: sin asignacion ES una falla que hay que explicar (falta cargarla, o es
   *    un cargo de apoyo) y se le ofrece abrir a mano.
   *  - `coordinacion`: NO tiene asignacion academica y nunca la va a tener — se comprobo
   *    contra el archivo real de MJB: 29 docentes con asignacion, CERO coordinadores.
   *    Decirle "no hay asignacion cargada para usted" lo manda a buscar un fallo que no
   *    existe. Si conserva el abrir a mano, porque hace digitacion de respaldo.
   *  - `consulta`: rectora y cargos de apoyo. Igual que coordinacion, pero ademas NO se
   *    les ofrece abrir sesion: el servidor solo deja registrar a quien dicta o dirige.
   */
  perfil?: 'docente' | 'coordinacion' | 'consulta';
  /**
   * TODOS los grados que existen en la sede, salgan o no en `extras`.
   *
   * Hace falta porque `extras` solo trae los cruces DONDE YA HAY SESIONES, y para un
   * cargo de apoyo eso invierte la pregunta: la PTA no necesita ver los grupos que ya
   * registran asistencia, necesita ver los que NO. Medido el 2026-08-25 en produccion:
   * 7 grupos con sesiones, 13 sin ninguna — y los 13 invisibles eran justo los suyos.
   *
   * Un grado sin sesiones NO es pulsable: no hay planilla que abrir todavia. La tarjeta
   * existe para que se sepa que el grupo existe y que nadie ha pasado lista.
   */
  todosLosGrados?: string[];
  onElegir: (grado: string, subjectId: string) => void;
  onSinAsignacion: () => void;
  /** Grupo que llega abierto desde el tablero de tercera hora («Ver las planillas de…»). */
  grupoAbierto?: string | null;
  /**
   * Abre la lista del grupo sin asignatura (ficha, alta de estudiantes). Solo para quien
   * no dicta clase: el docente ya llega a su grupo por su planilla.
   */
  onListaDelGrupo?: (grado: string) => void;
}) {
  const resumenes = slotId ? asignacionDeDocente(slotId) : [];

  // El Centro de Interés (`asignaturaId: 'ci'`, grupo `'CI mañana'` / `'CI tarde'`) NO es
  // un grupo de clase: es la franja institucional donde participan TODOS los grupos de
  // la jornada a la vez, sin estudiantes fijos. Una tarjeta con "CI mañana" invitaría a
  // abrir una planilla que no tiene sentido — ese registro vive en la pestaña Eventos.
  const tieneCentroInteres = resumenes.some((r) => r.asignatura.id === 'ci');

  const cruces = resumenes
    .filter((r) => r.asignatura.id !== 'ci')
    .flatMap((r) => r.grupos.map((g) => ({ grado: g.grupo, asignatura: r.asignatura, horas: g.horas })))
    // Jornada primero (mañana antes que tarde), luego grado: es el orden en que un
    // docente de pie recorre su horario, no el orden alfabético del grupo.
    .sort((a, b) => gradoSortKey(a.grado).localeCompare(gradoSortKey(b.grado)));

  /**
   * Agrupados por grado: un docente puede dictar mas de una asignatura en el MISMO
   * grado (34 casos reales en la asignacion de 2026 — Carlos con Quimica y Biologia en
   * los siete grupos de 10 y 11, por ejemplo). Antes cada cruce sacaba su propia
   * tarjeta y dos tarjetas de "11.2" quedaban identicas salvo por una linea de texto
   * chico: facil de confundir entre clases. Ahora es UNA tarjeta por grado, con un
   * boton por asignatura adentro.
   */
  const tarjetas = (() => {
    const porGrado = new Map<string, typeof cruces>();
    for (const c of cruces) {
      if (!porGrado.has(c.grado)) porGrado.set(c.grado, []);
      porGrado.get(c.grado)!.push(c);
    }
    return [...porGrado.entries()]
      .map(([grado, materias]) => ({ grado, materias }))
      .sort((a, b) => gradoSortKey(a.grado).localeCompare(gradoSortKey(b.grado)));
  })();

  // Cruces con sesiones que NO estan en la asignacion. Se descartan los que ya salen
  // arriba para no ofrecer el mismo grupo dos veces.
  const yaListado = new Set(cruces.map((t) => `${t.grado}|${t.asignatura.id}`));
  const otros = extras
    .filter((e) => !yaListado.has(`${e.grado}|${e.subjectId}`))
    .sort((a, b) => gradoSortKey(a.grado).localeCompare(gradoSortKey(b.grado)));

  // Cuantas planillas hay por grado. Sale de `extras`, que son los cruces CON sesiones
  // dentro del alcance de quien mira: para coordinacion y consulta, toda la sede.
  const conSesiones = new Map<string, number>();
  for (const e of extras) conSesiones.set(e.grado, (conSesiones.get(e.grado) ?? 0) + 1);

  // Ni asignacion ni sesiones todavia. El mensaje depende de QUIEN mira: para un docente
  // es una falla que hay que explicar; para coordinacion y rectoria es sencillamente lo
  // normal, y decirles que "falta cargar su asignacion" los manda a buscar un problema
  // inexistente.
  // El estado vacio NO se usa cuando hay panorama que enseñar: para coordinacion y
  // consulta, "nadie ha pasado lista todavia" es justo la informacion mas util del dia,
  // y esconderla tras un cartel de "no hay nada" es lo contrario de lo que necesitan.
  const hayPanorama = perfil !== 'docente' && (todosLosGrados?.length ?? 0) > 0;

  if (tarjetas.length === 0 && otros.length === 0 && !hayPanorama) {
    if (perfil !== 'docente') {
      return (
        <div className="rounded-xl border border-line bg-card p-4 text-center">
          <p className="text-sm text-strong">Todavía no hay planillas que mostrar.</p>
          <p className="mt-1 text-xs text-muted">
            {perfil === 'coordinacion'
              ? 'Aquí aparecerán las planillas de los grupos de su jornada en cuanto los docentes empiecen a pasar lista.'
              : 'Aquí aparecerán las planillas de los grupos en cuanto los docentes empiecen a pasar lista.'}
          </p>
          {perfil === 'coordinacion' && (
            <button
              onClick={onSinAsignacion}
              className="mt-3 min-h-[36px] rounded-lg border border-line px-3 py-2 text-sm font-medium text-strong"
            >
              Abrir una sesión a mano
            </button>
          )}
        </div>
      );
    }
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
        {tarjetas.map((t) =>
          t.materias.length === 1 ? (
            <TarjetaGrupo
              key={t.grado}
              grado={t.grado}
              detalle={`${t.materias[0].asignatura.nombre} · ${t.materias[0].horas}h/semana`}
              onElegir={() => onElegir(t.grado, t.materias[0].asignatura.id)}
            />
          ) : (
            <TarjetaGrupoConMaterias
              key={t.grado}
              grado={t.grado}
              materias={t.materias}
              onElegir={onElegir}
            />
          ),
        )}
      </div>

      {/*
        PANORAMA DEL COLEGIO — solo para quien no dicta clase (coordinacion y cargos de
        apoyo). Para ellos la pregunta util no es "que grupos tengo" sino "quien NO esta
        pasando lista", y esa no se puede responder con una lista que solo muestra los
        grupos que ya tienen sesiones.
      */}
      {perfil !== 'docente' && (todosLosGrados?.length ?? 0) > 0 && (
        <div className="rounded-xl border border-line bg-card p-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-sm font-semibold text-strong">Todos los grupos del colegio</p>
            <p className="text-xs text-muted">
              {conSesiones.size} de {todosLosGrados!.length} están registrando asistencia
            </p>
          </div>
          <p className="mt-0.5 text-xs text-muted">
            Los grupos en gris todavía no tienen ninguna planilla: nadie ha pasado lista
            ahí. No es que falten permisos.
            {onListaDelGrupo && ' Toque un grupo para ver su lista de estudiantes.'}
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {[...todosLosGrados!]
              .sort((a, b) => gradoSortKey(a).localeCompare(gradoSortKey(b)))
              .map((g) => {
                const activo = conSesiones.has(g);
                // Con `onListaDelGrupo` la pastilla es un boton: TODOS los grupos, tambien
                // los grises, tienen estudiantes y ficha aunque nadie haya pasado lista.
                const Etiqueta = onListaDelGrupo ? 'button' : 'span';
                return (
                  <Etiqueta
                    key={g}
                    {...(onListaDelGrupo ? { onClick: () => onListaDelGrupo(g) } : {})}
                    title={
                      activo
                        ? `${g}: ${conSesiones.get(g)} planilla(s) registradas`
                        : `${g}: todavía sin asistencia registrada`
                    }
                    style={activo ? { borderColor: colorGrado(g), color: colorGrado(g) } : undefined}
                    className={[
                      'rounded-full border px-2.5 py-1 text-sm font-semibold',
                      activo ? 'bg-card' : 'border-line bg-elevated text-muted opacity-60',
                    ].join(' ')}
                  >
                    {g}
                    {activo && (
                      <span className="ml-1 text-xs font-normal">· {conSesiones.get(g)}</span>
                    )}
                  </Etiqueta>
                );
              })}
          </div>
        </div>
      )}

      {otros.length > 0 && (
        <div className="space-y-2">
          {/* Aparte y explicado: son planillas reales, pero fuera de la asignacion. Si se
              mezclaran con las de arriba, el docente no distinguiria su horario oficial de
              lo que abrio a mano o quedo de un periodo anterior.
              Para quien es solo de consulta no hay "arriba" (no dicta clase), asi que el
              texto no puede decir "suyos": son las planillas del colegio, no las de esta
              cuenta. */}
          <p className="text-xs text-muted">
            {perfil === 'docente'
              ? 'Otras planillas con registros suyos, fuera de la asignación académica:'
              : 'Planillas disponibles:'}
          </p>
          {perfil === 'docente' ? (
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
          ) : (
            <PlanillasPorGrupo
              cruces={otros}
              grupoAbierto={grupoAbierto}
              onElegir={onElegir}
              onListaDelGrupo={onListaDelGrupo}
            />
          )}
        </div>
      )}

      {tieneCentroInteres && (
        <p className="text-xs text-muted">
          El Centro de Interés se lleva desde la pestaña <b>Eventos</b>, no desde aquí: es
          una franja de toda la jornada, no un curso con estudiantes fijos.
        </p>
      )}

      {perfil !== 'consulta' && (
        <button
          onClick={onSinAsignacion}
          className="min-h-[36px] text-xs text-muted underline"
        >
          Abrir una sesión de un grupo que no aparece aquí
        </button>
      )}
    </div>
  );
}

/**
 * El grado va grande Y con el color oficial de su grado: es lo que el ojo busca primero,
 * y el color refuerza el numero en vez de competir con el. Con el filete del borde solo,
 * el color casi no se percibe en el celular.
 */
/**
 * Un grado donde el docente dicta MAS de una asignatura. Una sola tarjeta con el numero
 * del grado arriba (mismo estilo que la de una sola materia, mismo color por grado) y
 * abajo un boton por asignatura, cada uno con su propia planilla detras.
 *
 * Antes esto salian como tarjetas sueltas identicas salvo por una linea de texto chico:
 * facil de confundir entre clases. Agruparlas deja claro de una mirada que es el MISMO
 * curso con dos cuadernos distintos, no dos grupos parecidos.
 */
function TarjetaGrupoConMaterias({
  grado,
  materias,
  onElegir,
}: {
  grado: string;
  materias: { asignatura: { id: string; nombre: string }; horas: number }[];
  onElegir: (grado: string, subjectId: string) => void;
}) {
  return (
    <div
      style={{ borderLeftColor: colorGrado(grado) }}
      className="min-h-[72px] w-full rounded-xl border border-line border-l-4 bg-card p-3"
    >
      <p style={{ color: colorGrado(grado) }} className="text-2xl font-bold leading-tight">
        {grado}
      </p>
      <div className="mt-1.5 space-y-1">
        {materias.map((m) => (
          <button
            key={m.asignatura.id}
            onClick={() => onElegir(grado, m.asignatura.id)}
            className="block w-full rounded-lg border border-line bg-elevated px-2 py-1.5 text-left hover:bg-hover"
          >
            <span className="text-sm font-semibold text-strong">{m.asignatura.nombre}</span>
            <span className="ml-1.5 text-xs text-muted">· {m.horas}h/semana</span>
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * Las planillas del colegio agrupadas por GRUPO (2026-09-25), para coordinacion y
 * consulta. Antes salia una tarjeta por cada asignatura de cada grupo —9.1 doce veces,
 * 9.2 catorce—: una lista larga en la que no se encontraba nada. Ahora es un renglon por
 * grupo con cuantas planillas tiene, y al tocarlo se despliegan sus asignaturas.
 *
 * El grupo que llega desde el tablero de tercera hora viene abierto y se desplaza a la
 * vista, para no obligar a buscarlo otra vez.
 */
function PlanillasPorGrupo({
  cruces,
  grupoAbierto,
  onElegir,
  onListaDelGrupo,
}: {
  cruces: { grado: string; subjectId: string }[];
  grupoAbierto: string | null;
  onElegir: (grado: string, subjectId: string) => void;
  onListaDelGrupo?: (grado: string) => void;
}) {
  const [abiertos, setAbiertos] = useState<Set<string>>(() => new Set(grupoAbierto ? [grupoAbierto] : []));
  const refAbierto = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!grupoAbierto) return;
    setAbiertos((s) => new Set(s).add(grupoAbierto));
    refAbierto.current?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }, [grupoAbierto]);

  const porGrado = new Map<string, string[]>();
  for (const c of cruces) {
    if (!porGrado.has(c.grado)) porGrado.set(c.grado, []);
    porGrado.get(c.grado)!.push(c.subjectId);
  }
  const grupos = [...porGrado.entries()].sort((a, b) => gradoSortKey(a[0]).localeCompare(gradoSortKey(b[0])));

  return (
    <div className="space-y-1.5">
      {grupos.map(([grado, materias]) => {
        const abierto = abiertos.has(grado);
        return (
          <div
            key={grado}
            ref={grado === grupoAbierto ? refAbierto : undefined}
            style={{ borderLeftColor: colorGrado(grado) }}
            className="rounded-xl border border-line border-l-4 bg-card"
          >
            <button
              onClick={() =>
                setAbiertos((s) => {
                  const n = new Set(s);
                  if (n.has(grado)) n.delete(grado);
                  else n.add(grado);
                  return n;
                })
              }
              aria-expanded={abierto}
              className="flex min-h-12 w-full items-center gap-2 px-3 text-left"
            >
              <b style={{ color: colorGrado(grado) }} className="text-xl">
                {grado}
              </b>
              <span className="text-sm text-muted">
                {materias.length} planilla{materias.length === 1 ? '' : 's'}
              </span>
              <span className="grow" />
              <span className={`text-muted transition-transform ${abierto ? 'rotate-180' : ''}`} aria-hidden>
                ▾
              </span>
            </button>
            {abierto && (
              <div className="grid gap-1.5 px-3 pb-3 sm:grid-cols-2">
                {onListaDelGrupo && (
                  <button
                    onClick={() => onListaDelGrupo(grado)}
                    className="rounded-lg border border-accent px-2 py-1.5 text-left text-sm font-semibold text-accent hover:bg-hover sm:col-span-2"
                  >
                    Lista del grupo (fichas y estudiantes nuevos)
                  </button>
                )}
                {[...materias]
                  .map((id) => ({ id, nombre: getAsignatura(id)?.nombre ?? id }))
                  .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
                  .map((m) => (
                    <button
                      key={m.id}
                      onClick={() => onElegir(grado, m.id)}
                      className="rounded-lg border border-line bg-elevated px-2 py-1.5 text-left text-sm font-semibold text-strong hover:bg-hover"
                    >
                      {m.nombre}
                    </button>
                  ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

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
