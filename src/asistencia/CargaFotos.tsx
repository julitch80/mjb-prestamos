import { useEffect, useMemo, useRef, useState } from 'react';
import Avatar from './Avatar';
import { subirFoto } from './fotos';
import { actualizarFicha, leerGrupo } from './datos';
import {
  emparejarFotos,
  gradoDeCarpeta,
  sinFoto,
  type ArchivoFoto,
  type Emparejamiento,
} from './domain/fotos-masivas';
import { nombreCompleto } from './domain/nombres';
import type { Student } from './domain/types';

/**
 * Carga masiva de fotografías — pantalla del superusuario.
 *
 * El insumo real es una carpeta con una subcarpeta por grupo (`10_1`, `11_2`…) y dentro
 * archivos `Apellidos_Nombres.jpg`. La rejilla de confirmación es el corazón de la
 * pantalla, no un extra: sin ver la foto real junto al nombre propuesto, subir en bloque
 * sería confiar a ciegas en un emparejamiento de texto sobre datos de menores, y un
 * homónimo mal resuelto deja la foto de otro estudiante como control de identidad.
 */
export default function CargaFotos() {
  const [archivos, setArchivos] = useState<ArchivoFoto[]>([]);
  const [estudiantesPorGrado, setEstudiantesPorGrado] = useState<Record<string, Student[]>>({});
  const [cargandoGrupos, setCargandoGrupos] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** Elección manual para archivos 'ambiguo' o 'sin_estudiante': studentId elegido, o
   *  '' para "saltar este archivo". Clave = rutaRelativa. */
  const [decisiones, setDecisiones] = useState<Record<string, string>>({});
  /** Archivos 'emparejado' que el usuario decidió NO subir (ya tiene foto y no la quiere
   *  reemplazar, por ejemplo). Clave = rutaRelativa. */
  const [excluidos, setExcluidos] = useState<Set<string>>(new Set());

  const [subiendo, setSubiendo] = useState(false);
  const detenerRef = useRef(false);
  const [progreso, setProgreso] = useState({ hechas: 0, total: 0 });
  const [fallidos, setFallidos] = useState<{ key: string; studentId: string; motivo: string }[]>(
    [],
  );
  const [subidasOk, setSubidasOk] = useState(0);

  const emparejamientos = useMemo(
    () => emparejarFotos(archivos, estudiantesPorGrado),
    [archivos, estudiantesPorGrado],
  );

  // Cada miniatura se genera con URL.createObjectURL: hay que liberarlas al reemplazar
  // la lista o al salir de la pantalla, o cientos de fotos agotan la memoria del
  // navegador — no es un detalle, es lo primero que revienta con una carpeta grande.
  const urlsRef = useRef<Map<string, string>>(new Map());
  useEffect(() => {
    const mapa = new Map<string, string>();
    for (const a of archivos) mapa.set(a.rutaRelativa, URL.createObjectURL(a.archivo));
    urlsRef.current = mapa;
    return () => {
      for (const url of mapa.values()) URL.revokeObjectURL(url);
    };
  }, [archivos]);

  async function elegirCarpeta(ev: React.ChangeEvent<HTMLInputElement>) {
    const lista = ev.target.files;
    ev.target.value = '';
    if (!lista || lista.length === 0) return;

    setError(null);
    setDecisiones({});
    setExcluidos(new Set());
    setFallidos([]);
    setSubidasOk(0);

    // `webkitRelativePath` trae el nombre de la carpeta raíz que la persona eligió
    // (p. ej. 'entrega_parcial/10_1/Foto.jpg'). Se descarta ese primer segmento: no
    // aporta nada al emparejamiento y varía según cómo se llame la carpeta en el
    // computador de turno.
    const nuevos: ArchivoFoto[] = [];
    for (const f of Array.from(lista)) {
      if (!f.type.startsWith('image/')) continue;
      const conRaiz = (f as File & { webkitRelativePath?: string }).webkitRelativePath || f.name;
      const partes = conRaiz.split('/');
      const rutaRelativa = partes.length > 1 ? partes.slice(1).join('/') : partes[0];
      nuevos.push({ rutaRelativa, archivo: f });
    }

    if (nuevos.length === 0) {
      setError('La carpeta elegida no tiene imágenes.');
      return;
    }

    setArchivos(nuevos);

    const grados = [
      ...new Set(
        nuevos
          .map((a) => gradoDeCarpeta(a.rutaRelativa.split('/')[0] ?? ''))
          .filter((g): g is string => g !== null),
      ),
    ];

    setCargandoGrupos(true);
    try {
      const entradas = await Promise.all(
        grados.map(async (g) => [g, (await leerGrupo(g)).estudiantes] as const),
      );
      setEstudiantesPorGrado(Object.fromEntries(entradas));
    } catch (e) {
      setError(`No fue posible cargar los grupos: ${(e as Error).message}`);
    } finally {
      setCargandoGrupos(false);
    }
  }

  /** Agrupa por grado literal; los archivos de carpeta no reconocida van aparte. */
  const porGrado = useMemo(() => {
    const mapa = new Map<string, Emparejamiento[]>();
    const sinGrado: Emparejamiento[] = [];
    for (const m of emparejamientos) {
      if (!m.grado) {
        sinGrado.push(m);
        continue;
      }
      (mapa.get(m.grado) ?? mapa.set(m.grado, []).get(m.grado)!).push(m);
    }
    return { grupos: [...mapa.entries()].sort((a, b) => a[0].localeCompare(b[0])), sinGrado };
  }, [emparejamientos]);

  /** Qué se va a subir de verdad: lo emparejado sin excluir, más lo elegido a mano. */
  const paraSubir = useMemo(() => {
    const lista: { key: string; studentId: string; archivo: ArchivoFoto; nombre: string }[] = [];
    for (const m of emparejamientos) {
      const key = m.archivo.rutaRelativa;
      if (m.estado === 'emparejado' && !excluidos.has(key)) {
        lista.push({
          key,
          studentId: m.candidatos[0].studentId,
          archivo: m.archivo,
          nombre: nombreCompleto(m.candidatos[0]),
        });
      } else if (m.estado !== 'emparejado' && decisiones[key]) {
        const elegido = m.candidatos.find((c) => c.studentId === decisiones[key]);
        // El elegido puede venir de fuera de los `candidatos` sugeridos (el desplegable
        // ofrece TODO el grupo, no solo los aproximados) — se busca también ahí.
        const nombreGrupo = m.grado ? estudiantesPorGrado[m.grado] ?? [] : [];
        const persona = elegido ?? nombreGrupo.find((c) => c.studentId === decisiones[key]);
        if (persona) {
          lista.push({ key, studentId: persona.studentId, archivo: m.archivo, nombre: nombreCompleto(persona) });
        }
      }
    }
    return lista;
  }, [emparejamientos, excluidos, decisiones, estudiantesPorGrado]);

  const faltantesPorGrado = useMemo(() => {
    if (Object.keys(estudiantesPorGrado).length === 0) return [];
    return sinFoto(emparejamientos, estudiantesPorGrado);
  }, [emparejamientos, estudiantesPorGrado]);

  /** Sube de a lo sumo 3 a la vez. Se puede detener entre lotes sin dejar nada a medio
   *  subir: cada foto es una operación independiente y completa antes de contar. */
  async function subir(lista: { key: string; studentId: string; archivo: ArchivoFoto }[]) {
    detenerRef.current = false;
    setSubiendo(true);
    setProgreso({ hechas: 0, total: lista.length });
    const nuevosFallidos: typeof fallidos = [];
    let ok = 0;

    const CONCURRENCIA = 3;
    let cursor = 0;
    async function trabajador() {
      while (cursor < lista.length) {
        if (detenerRef.current) return;
        const item = lista[cursor++];
        try {
          const { ruta } = await subirFoto(item.studentId, item.archivo.archivo);
          await actualizarFicha(item.studentId, { fotoPath: ruta });
          ok++;
        } catch (e) {
          nuevosFallidos.push({ key: item.key, studentId: item.studentId, motivo: (e as Error).message });
        }
        setProgreso((p) => ({ ...p, hechas: p.hechas + 1 }));
      }
    }
    await Promise.all(Array.from({ length: CONCURRENCIA }, trabajador));

    setSubidasOk((n) => n + ok);
    setFallidos((prev) => [...prev.filter((f) => !lista.some((l) => l.key === f.key)), ...nuevosFallidos]);
    setSubiendo(false);
  }

  function detener() {
    detenerRef.current = true;
  }

  function reintentarFallidos() {
    const items = fallidos
      .map((f) => {
        const m = emparejamientos.find((x) => x.archivo.rutaRelativa === f.key);
        return m ? { key: f.key, studentId: f.studentId, archivo: m.archivo } : null;
      })
      .filter((x): x is { key: string; studentId: string; archivo: ArchivoFoto } => x !== null);
    if (items.length > 0) void subir(items);
  }

  const hayAlgoQueMostrar = archivos.length > 0;

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-base font-semibold text-strong">Carga masiva de fotografías</h2>
        <p className="text-xs text-muted">
          Elija la carpeta con una subcarpeta por grupo (por ejemplo <b>10_1</b>, <b>11_2</b>)
          y dentro los archivos con el nombre del estudiante. Nada se sube hasta que usted
          lo confirme abajo.
        </p>
      </div>

      <label className="flex min-h-[36px] w-fit cursor-pointer items-center gap-2 rounded-lg border border-line bg-card px-3 py-2 text-sm font-medium text-strong">
        Elegir carpeta…
        <input
          type="file"
          multiple
          // `webkitdirectory` no está tipado en React: es un atributo no estandar que
          // solo entienden Chrome/Edge/Safari, y es la unica forma de que el navegador
          // ofrezca "elegir carpeta" en vez de "elegir archivos".
          {...({ webkitdirectory: 'true', directory: 'true' } as Record<string, string>)}
          onChange={(e) => void elegirCarpeta(e)}
          className="hidden"
        />
      </label>

      {error && (
        <p className="rounded-xl border border-danger-soft bg-danger-soft p-3 text-sm text-danger-soft-fg">
          {error}
        </p>
      )}

      {cargandoGrupos && <p className="text-sm text-muted">Cargando los grupos…</p>}

      {hayAlgoQueMostrar && !cargandoGrupos && (
        <>
          <ResumenSubida
            paraSubir={paraSubir}
            subiendo={subiendo}
            progreso={progreso}
            subidasOk={subidasOk}
            fallidos={fallidos}
            onSubir={() => void subir(paraSubir)}
            onDetener={detener}
            onReintentar={reintentarFallidos}
          />

          {porGrado.grupos.map(([grado, items]) => (
            <GrupoFotos
              key={grado}
              grado={grado}
              items={items}
              urls={urlsRef.current}
              decisiones={decisiones}
              excluidos={excluidos}
              candidatosGrupo={estudiantesPorGrado[grado] ?? []}
              onExcluir={(key, excluir) =>
                setExcluidos((prev) => {
                  const s = new Set(prev);
                  if (excluir) s.add(key);
                  else s.delete(key);
                  return s;
                })
              }
              onElegir={(key, studentId) => setDecisiones((prev) => ({ ...prev, [key]: studentId }))}
            />
          ))}

          {porGrado.sinGrado.length > 0 && (
            <section className="rounded-xl border border-warning-soft bg-warning-soft p-3">
              <h3 className="text-sm font-semibold text-warning-soft-fg">
                Carpetas sin reconocer ({porGrado.sinGrado.length})
              </h3>
              <p className="mt-1 text-xs text-warning-soft-fg">
                El nombre de la subcarpeta no se pudo traducir a un grupo del colegio.
                Revise que se llame, por ejemplo, <b>10_1</b> o <b>6º1</b> con guion bajo en
                vez de la º, y vuelva a elegir la carpeta.
              </p>
              <ul className="mt-2 space-y-1 text-xs text-warning-soft-fg">
                {porGrado.sinGrado.map((m) => (
                  <li key={m.archivo.rutaRelativa}>{m.archivo.rutaRelativa}</li>
                ))}
              </ul>
            </section>
          )}

          {faltantesPorGrado.length > 0 && (
            <section className="rounded-xl border border-line bg-card p-3">
              <h3 className="text-sm font-semibold text-strong">
                Estudiantes sin foto todavía ({faltantesPorGrado.length})
              </h3>
              <ul className="mt-2 grid grid-cols-1 gap-1 text-sm text-strong sm:grid-cols-2">
                {faltantesPorGrado.map((e) => (
                  <li key={e.studentId} className="flex items-center gap-2">
                    <Avatar estudiante={e} tamano={24} />
                    {nombreCompleto(e)}
                    <span className="text-xs text-muted">{e.gradoActual}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </section>
  );
}

/** Barra de acción: cuánto hay listo, botón de subir, progreso y resultado. */
function ResumenSubida({
  paraSubir,
  subiendo,
  progreso,
  subidasOk,
  fallidos,
  onSubir,
  onDetener,
  onReintentar,
}: {
  paraSubir: { studentId: string }[];
  subiendo: boolean;
  progreso: { hechas: number; total: number };
  subidasOk: number;
  fallidos: { key: string; motivo: string }[];
  onSubir: () => void;
  onDetener: () => void;
  onReintentar: () => void;
}) {
  return (
    <section className="sticky top-0 z-10 rounded-xl border border-line bg-card p-3 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-strong">
          <b>{paraSubir.length}</b> {paraSubir.length === 1 ? 'foto lista' : 'fotos listas'} para
          subir.
        </p>
        {!subiendo ? (
          <button
            disabled={paraSubir.length === 0}
            onClick={onSubir}
            className="min-h-[36px] rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-fg disabled:opacity-50"
          >
            Subir fotografías
          </button>
        ) : (
          <button
            onClick={onDetener}
            className="min-h-[36px] rounded-lg border border-danger-soft bg-danger-soft px-4 py-2 text-sm font-medium text-danger-soft-fg"
          >
            Detener
          </button>
        )}
      </div>

      {subiendo && (
        <p className="mt-2 text-sm text-muted">
          Subiendo {progreso.hechas} de {progreso.total}…
        </p>
      )}

      {!subiendo && (subidasOk > 0 || fallidos.length > 0) && (
        <div className="mt-2 space-y-1 text-sm">
          {subidasOk > 0 && (
            <p className="text-success-soft-fg">
              {subidasOk} {subidasOk === 1 ? 'fotografía subida' : 'fotografías subidas'}.
            </p>
          )}
          {fallidos.length > 0 && (
            <div className="rounded-lg border border-danger-soft bg-danger-soft p-2 text-danger-soft-fg">
              <p>
                {fallidos.length} {fallidos.length === 1 ? 'fotografía falló' : 'fotografías fallaron'}:
              </p>
              <ul className="mt-1 list-inside list-disc">
                {fallidos.map((f) => (
                  <li key={f.key}>{f.motivo}</li>
                ))}
              </ul>
              <button
                onClick={onReintentar}
                className="mt-2 min-h-[36px] rounded-lg border border-danger-soft bg-card px-3 py-1 text-xs font-medium text-danger-soft-fg"
              >
                Reintentar las que fallaron
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

/** Rejilla de un grupo, separada por estado de emparejamiento. */
function GrupoFotos({
  grado,
  items,
  urls,
  decisiones,
  excluidos,
  candidatosGrupo,
  onExcluir,
  onElegir,
}: {
  grado: string;
  items: Emparejamiento[];
  urls: Map<string, string>;
  decisiones: Record<string, string>;
  excluidos: Set<string>;
  candidatosGrupo: Student[];
  onExcluir: (key: string, excluir: boolean) => void;
  onElegir: (key: string, studentId: string) => void;
}) {
  const emparejadas = items.filter((m) => m.estado === 'emparejado');
  const ambiguas = items.filter((m) => m.estado === 'ambiguo');
  const sinEstudiante = items.filter((m) => m.estado === 'sin_estudiante');

  return (
    <section className="rounded-xl border border-line bg-card p-3">
      <h3 className="text-sm font-semibold text-strong">
        {grado} <span className="font-normal text-muted">({items.length} fotos)</span>
      </h3>

      {emparejadas.length > 0 && (
        <div className="mt-2">
          <p className="text-xs font-medium text-muted">Emparejadas ({emparejadas.length})</p>
          <div className="mt-1 grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-3">
            {emparejadas.map((m) => {
              const key = m.archivo.rutaRelativa;
              const est = m.candidatos[0];
              const excluida = excluidos.has(key);
              return (
                <div
                  key={key}
                  className={`flex items-center gap-2 rounded-lg border p-2 ${
                    excluida ? 'border-line bg-elevated opacity-60' : 'border-line'
                  }`}
                >
                  <img
                    src={urls.get(key)}
                    alt=""
                    className="h-12 w-12 shrink-0 rounded-lg object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-strong">{nombreCompleto(est)}</p>
                    {est.fotoPath && (
                      <p className="text-xs text-warning-soft-fg">Reemplaza la foto actual</p>
                    )}
                  </div>
                  <label className="flex min-h-[36px] shrink-0 items-center gap-1 text-xs text-muted">
                    <input
                      type="checkbox"
                      checked={!excluida}
                      onChange={(e) => onExcluir(key, !e.target.checked)}
                    />
                    Subir
                  </label>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {ambiguas.length > 0 && (
        <div className="mt-3">
          <p className="text-xs font-medium text-warning-soft-fg">
            Homónimos: hay más de un estudiante con ese nombre ({ambiguas.length})
          </p>
          <div className="mt-1 grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-3">
            {ambiguas.map((m) => (
              <SelectorManual
                key={m.archivo.rutaRelativa}
                m={m}
                url={urls.get(m.archivo.rutaRelativa)}
                opciones={m.candidatos}
                valor={decisiones[m.archivo.rutaRelativa] ?? ''}
                onElegir={(id) => onElegir(m.archivo.rutaRelativa, id)}
              />
            ))}
          </div>
        </div>
      )}

      {sinEstudiante.length > 0 && (
        <div className="mt-3">
          <p className="text-xs font-medium text-muted">
            Sin coincidencia exacta ({sinEstudiante.length})
          </p>
          <div className="mt-1 grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-3">
            {sinEstudiante.map((m) => (
              <SelectorManual
                key={m.archivo.rutaRelativa}
                m={m}
                url={urls.get(m.archivo.rutaRelativa)}
                // Aquí se ofrece el grupo COMPLETO, no solo los aproximados: el archivo
                // pudo no tener ningún candidato cercano y aun así corresponder a alguien.
                opciones={candidatosGrupo}
                valor={decisiones[m.archivo.rutaRelativa] ?? ''}
                onElegir={(id) => onElegir(m.archivo.rutaRelativa, id)}
              />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

/** Tarjeta con miniatura + desplegable, para 'ambiguo' y 'sin_estudiante'. Nunca elige
 *  sola: la persona tiene que tocar el desplegable, y "Saltar" queda como valor inicial. */
function SelectorManual({
  m,
  url,
  opciones,
  valor,
  onElegir,
}: {
  m: Emparejamiento;
  url: string | undefined;
  opciones: Student[];
  valor: string;
  onElegir: (studentId: string) => void;
}) {
  const nombreArchivo = m.archivo.rutaRelativa.split('/').pop();
  return (
    <div className="flex items-center gap-2 rounded-lg border border-line p-2">
      <img src={url} alt="" className="h-12 w-12 shrink-0 rounded-lg object-cover" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs text-muted">{nombreArchivo}</p>
        <select
          value={valor}
          onChange={(e) => onElegir(e.target.value)}
          className="mt-1 w-full min-h-[36px] rounded-lg border border-line bg-elevated px-1 text-xs text-strong"
        >
          <option value="">— Saltar —</option>
          {opciones.map((e) => (
            <option key={e.studentId} value={e.studentId}>
              {nombreCompleto(e)}
              {e.fotoPath ? ' (ya tiene foto)' : ''}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
