import { useEffect, useRef, useState } from 'react';
import { asignacionDeDocente, getAsignatura } from '../data/asignacionAcademica';
import { colorGrado } from '../data/maestros';
import SelectorVista, { useVistaRecordada } from '../components/SelectorVista';
import { gradoSortKey } from './domain/ids';
import TarjetaClaseAhora from './TarjetaClaseAhora';

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
  sesionesHoy = [],
  onPasarLista,
}: {
  /** Sesiones de hoy (para que la tarjeta de «la clase de ahora» sepa si ya se llamo lista). */
  sesionesHoy?: { grado: string; bloque: number; subjectId: string }[];
  /** Abre (o crea, con sus dos horas si es bloque) la planilla de la clase sugerida. */
  onPasarLista?: (grado: string, subjectId: string, bloque: number) => void;
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
  // Con mas de 6 grupos, «Ver: matriz (tarjetas) / lista compacta» (revision visual, 2026-10-26).
  const [vista, setVista] = useVistaRecordada<'matriz' | 'lista'>('mis-grupos', 'matriz', ['matriz', 'lista']);

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
              className="mt-3 min-h-[44px] rounded-lg border border-line px-3 py-2 text-sm font-medium text-strong"
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
          className="mt-3 min-h-[44px] rounded-lg border border-line px-3 py-2 text-sm font-medium text-strong"
        >
          Abrir sesión sin asignación
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {perfil === 'docente' && onPasarLista && (
        <TarjetaClaseAhora slotId={slotId} sesionesHoy={sesionesHoy} onPasarLista={onPasarLista} />
      )}
      {tarjetas.length > 6 && (
        <div className="flex justify-end">
          <SelectorVista valor={vista} onCambio={setVista} />
        </div>
      )}
      {tarjetas.length > 6 && vista === 'lista' ? (
        <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-card">
          {tarjetas.map((t) => (
            <li key={t.grado} className="flex flex-wrap items-center gap-2 px-3 py-1.5" style={{ borderLeft: `4px solid ${colorGrado(t.grado)}` }}>
              <span style={{ color: colorGrado(t.grado) }} className="w-14 shrink-0 text-lg font-bold">{t.grado}</span>
              {t.materias.map((m) => (
                <button
                  key={m.asignatura.id}
                  onClick={() => onElegir(t.grado, m.asignatura.id)}
                  className="min-h-[44px] rounded-lg border border-line px-3 text-left text-sm text-strong hover:bg-hover"
                >
                  {m.asignatura.nombre} <span className="text-xs text-muted">· {m.horas}h</span>
                </button>
              ))}
            </li>
          ))}
        </ul>
      ) : (
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
      )}

      {/*
        GRUPOS DEL COLEGIO — solo para quien no dicta clase (coordinacion, rectoria y cargos
        de apoyo). Antes salia DOS veces lo mismo: «Todos los grupos del colegio» en pastillas
        y «Planillas disponibles» en filas (Julian, 2026-10-26, viendo como coordinadora).
        Ahora es una sola seccion con «Ver: matriz / lista». La pregunta util sigue siendo
        «quien NO esta pasando lista»: los grupos sin planillas salen en gris.
      */}
      {perfil !== 'docente' && (todosLosGrados?.length || otros.length) ? (
        <GruposDelColegio
          grados={[...new Set([...(todosLosGrados ?? []), ...otros.map((o) => o.grado)])]}
          cruces={otros}
          grupoAbierto={grupoAbierto}
          onElegir={onElegir}
          onListaDelGrupo={onListaDelGrupo}
        />
      ) : null}

      {perfil === 'docente' && otros.length > 0 && (
        <div className="space-y-2">
          {/* Aparte y explicado: son planillas reales, pero fuera de la asignacion. Si se
              mezclaran con las de arriba, el docente no distinguiria su horario oficial de
              lo que abrio a mano o quedo de un periodo anterior.
              Para quien es solo de consulta no hay "arriba" (no dicta clase), asi que el
              texto no puede decir "suyos": son las planillas del colegio, no las de esta
              cuenta. */}
          <p className="text-xs text-muted">Otras planillas con registros suyos, fuera de la asignación académica:</p>
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

      {perfil !== 'consulta' && (
        <button
          onClick={onSinAsignacion}
          className="min-h-[44px] text-xs text-muted underline"
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
 * Desde el 2026-10-26 es ademas el panorama: TODOS los grupos (en gris los que no tienen
 * planillas), una sola vez, con «Ver: matriz (pastillas) / lista (filas)».
 *
 * El grupo que llega desde el tablero de tercera hora viene abierto y se desplaza a la
 * vista, para no obligar a buscarlo otra vez.
 */
function GruposDelColegio({
  grados,
  cruces,
  grupoAbierto,
  onElegir,
  onListaDelGrupo,
}: {
  /** Todos los grupos del alcance, tengan o no planillas. */
  grados: string[];
  /** Las planillas que existen (grado + asignatura). */
  cruces: { grado: string; subjectId: string }[];
  grupoAbierto: string | null;
  onElegir: (grado: string, subjectId: string) => void;
  onListaDelGrupo?: (grado: string) => void;
}) {
  const [vista, setVista] = useVistaRecordada<'matriz' | 'lista'>('mis-grupos-coordinacion', 'matriz', ['matriz', 'lista']);
  const [abiertos, setAbiertos] = useState<Set<string>>(() => new Set(grupoAbierto ? [grupoAbierto] : []));
  const refAbierto = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!grupoAbierto) return;
    setAbiertos((s) => new Set(s).add(grupoAbierto));
    refAbierto.current?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }, [grupoAbierto]);

  const porGrado = new Map<string, string[]>();
  for (const c of cruces) porGrado.set(c.grado, [...(porGrado.get(c.grado) ?? []), c.subjectId]);
  const ordenados = [...grados].sort((a, b) => gradoSortKey(a).localeCompare(gradoSortKey(b)));
  const conPlanillas = ordenados.filter((g) => porGrado.has(g)).length;
  const sePuedeAbrir = (g: string) => porGrado.has(g) || !!onListaDelGrupo;
  const alternar = (g: string) => setAbiertos((s) => {
    const n = new Set(vista === 'matriz' ? [] : s);
    if (s.has(g)) n.delete(g); else n.add(g);
    return n;
  });

  /** Lo que se ve al abrir un grupo: su lista y sus planillas. */
  const contenido = (grado: string) => {
    const materias = [...(porGrado.get(grado) ?? [])]
      .map((id) => ({ id, nombre: getAsignatura(id)?.nombre ?? id }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
    return (
      <div className="grid gap-1.5 sm:grid-cols-2">
        {onListaDelGrupo && (
          <button
            onClick={() => onListaDelGrupo(grado)}
            className="min-h-[44px] rounded-lg border border-accent px-2 text-left text-sm font-semibold text-accent hover:bg-hover sm:col-span-2"
          >
            Lista del grupo (fichas y estudiantes nuevos)
          </button>
        )}
        {materias.map((m) => (
          <button
            key={m.id}
            onClick={() => onElegir(grado, m.id)}
            className="min-h-[44px] rounded-lg border border-line bg-elevated px-2 text-left text-sm font-semibold text-strong hover:bg-hover"
          >
            {m.nombre}
          </button>
        ))}
        {materias.length === 0 && <p className="text-sm text-muted sm:col-span-2">Todavía nadie ha pasado lista en {grado}.</p>}
      </div>
    );
  };

  const abiertoMatriz = vista === 'matriz' ? ordenados.find((g) => abiertos.has(g)) ?? null : null;

  return (
    <div className="rounded-xl border border-line bg-card p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-strong">Grupos del colegio</p>
          <p className="text-xs text-muted">{conPlanillas} de {ordenados.length} están registrando asistencia · en gris, los que aún no tienen planillas</p>
        </div>
        <SelectorVista valor={vista} onCambio={(v) => { setVista(v); setAbiertos(new Set()); }} />
      </div>

      {vista === 'matriz' ? (
        <>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {ordenados.map((g) => {
              const n = porGrado.get(g)?.length ?? 0;
              const abierto = abiertoMatriz === g;
              return (
                <button
                  key={g}
                  disabled={!sePuedeAbrir(g)}
                  onClick={() => alternar(g)}
                  aria-expanded={abierto}
                  title={n ? `${g}: ${n} planilla(s)` : `${g}: todavía sin asistencia registrada`}
                  style={n ? { borderColor: colorGrado(g), color: colorGrado(g) } : undefined}
                  className={[
                    'min-h-[44px] rounded-full border px-3 text-sm font-semibold',
                    n ? 'bg-card' : 'border-line bg-elevated text-muted',
                    abierto ? 'ring-2 ring-accent' : '',
                  ].join(' ')}
                >
                  {g}
                  {n > 0 && <span className="ml-1 text-xs font-normal">· {n}</span>}
                </button>
              );
            })}
          </div>
          {abiertoMatriz && (
            <div ref={refAbierto} className="mt-3 rounded-xl border border-line border-l-4 p-3" style={{ borderLeftColor: colorGrado(abiertoMatriz) }}>
              <p className="mb-2 text-sm font-semibold" style={{ color: colorGrado(abiertoMatriz) }}>{abiertoMatriz}</p>
              {contenido(abiertoMatriz)}
            </div>
          )}
        </>
      ) : (
        <div className="mt-3 space-y-1.5">
          {ordenados.map((g) => {
            const n = porGrado.get(g)?.length ?? 0;
            const abierto = abiertos.has(g);
            return (
              <div
                key={g}
                ref={g === grupoAbierto ? refAbierto : undefined}
                style={{ borderLeftColor: n ? colorGrado(g) : undefined }}
                className={`rounded-xl border border-line border-l-4 ${n ? 'bg-card' : 'bg-elevated'}`}
              >
                <button
                  disabled={!sePuedeAbrir(g)}
                  onClick={() => alternar(g)}
                  aria-expanded={abierto}
                  className="flex min-h-12 w-full items-center gap-2 px-3 text-left"
                >
                  <b style={n ? { color: colorGrado(g) } : undefined} className={`text-xl ${n ? '' : 'text-muted'}`}>{g}</b>
                  <span className="text-sm text-muted">{n ? `${n} planilla${n === 1 ? '' : 's'}` : 'sin asistencia registrada'}</span>
                  <span className="grow" />
                  {sePuedeAbrir(g) && <span className={`text-muted transition-transform ${abierto ? 'rotate-180' : ''}`} aria-hidden>▾</span>}
                </button>
                {abierto && <div className="px-3 pb-3">{contenido(g)}</div>}
              </div>
            );
          })}
        </div>
      )}
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
