import { useEffect, useMemo, useState } from 'react';
import ExcelJS from 'exceljs';
import { ChevronLeft, ChevronRight, Download, Ellipsis, Eye, EyeOff, Plus, X } from 'lucide-react';
import Avatar from './Avatar';
import Ayuda from './Ayuda';
import { ICONO_COMPONENTE } from './IconosDireccion';
import {
  ajustarPuntos,
  guardarAutomaticasOcultas,
  leerAutomaticasOcultas,
  moverColumna,
  quitarColumna,
  totalDeAutomatica,
  totalDeColumna,
  validarColumna,
  type ColumnaAutomatica,
} from './domain/direccion-grupo';
import { buildDireccionGrupoExport } from './domain/exports';
import { COLORES_GRUPO, estiloEtiqueta } from './domain/colores';
import { iconosPorGrupo, type IconoDisponible } from './domain/iconos-direccion';
import { nombreCompleto, nombresDePila } from './domain/nombres';
import { llegadasQueAlertan } from './domain/alertas';
import { computeStats } from './domain/stats';
import type {
  ColumnaDireccion,
  DireccionGrupo as DireccionGrupoModelo,
  OpcionColumna,
  Student,
  TipoColumna,
  ValorCelda,
} from './domain/types';
import { abrirDireccionGrupo, guardarColumnas, leerGrupo, leerLlegadasTardePorGrado, leerSesiones, marcarCelda } from './datos';

/**
 * Cuaderno paralelo del director de grupo — el modelo, la logica y el acceso a datos ya
 * estan hechos y probados (`domain/direccion-grupo.ts`, `datos.ts`). Esta pantalla solo
 * los conecta.
 *
 * Es SOLO del director del grado: `index.tsx` no la ofrece a nadie mas (ver `esDirector`
 * alla). No se cruza con la asistencia por asignatura.
 */
export default function DireccionGrupo({
  grado,
  anio,
  estudiantes,
}: {
  grado: string;
  anio: number;
  estudiantes: Student[];
}) {
  const [direccion, setDireccion] = useState<DireccionGrupoModelo | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sheetNuevaColumna, setSheetNuevaColumna] = useState(false);
  const [menuColumna, setMenuColumna] = useState<string | null>(null);
  const [sheetIcono, setSheetIcono] = useState<{ studentId: string; columna: ColumnaDireccion } | null>(
    null,
  );
  const [descargando, setDescargando] = useState(false);
  const [ocultarAutomaticas, setOcultarAutomaticas] = useState(() => leerAutomaticasOcultas());
  const [faltasPorEstudiante, setFaltasPorEstudiante] = useState<Record<string, number>>({});
  const [llegadasTardePorEstudiante, setLlegadasTardePorEstudiante] = useState<Record<string, number>>({});

  // Se reabre el cuaderno cada vez que cambia el grado (o el año, aunque hoy es siempre
  // el actual): `abrirDireccionGrupo` crea el documento si es la primera vez que este
  // director entra, y lo reutiliza si ya existia.
  useEffect(() => {
    let vivo = true;
    setCargando(true);
    setError(null);
    void abrirDireccionGrupo(grado, anio)
      .then((d) => {
        if (vivo) setDireccion(d);
      })
      .catch((e) => {
        if (vivo) setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (vivo) setCargando(false);
      });
    return () => {
      vivo = false;
    };
  }, [grado, anio]);

  const columnas = useMemo(
    () => [...(direccion?.columnas ?? [])].sort((a, b) => a.orden - b.orden),
    [direccion],
  );
  const studentIds = useMemo(() => estudiantes.map((e) => e.studentId), [estudiantes]);
  const totales = useMemo(
    () =>
      direccion
        ? new Map(columnas.map((c) => [c.columnaId, totalDeColumna(c, direccion.valores, studentIds)]))
        : new Map(),
    [columnas, direccion, studentIds],
  );

  /**
   * Faltas en TODO el grado (todas las asignaturas), lo que se transcribe a Master2000 —
   * no `ausenciasTotales`, porque las justificadas no se transcriben y mezclarlas exagera
   * la cifra. Es una columna AUTOMATICA (ver domain/direccion-grupo.ts): el cuaderno es
   * el trabajo, esto es un extra, por eso va en su propio try/catch. Si falla, el
   * cuaderno del director sigue funcionando con lo que ya tenia — igual que
   * `sesionesPorAsignatura` en index.tsx.
   */
  useEffect(() => {
    let vivo = true;
    void (async () => {
      try {
        const [sesionesDelGrado, { matriculas }] = await Promise.all([
          leerSesiones({ tipo: 'director', grado }),
          leerGrupo(grado),
        ]);
        if (!vivo) return;
        const porEstudiante: Record<string, number> = {};
        for (const id of studentIds) {
          const enrollmentsEstudiante = matriculas.filter((m) => m.studentId === id);
          const stats = computeStats({
            studentId: id,
            sessions: sesionesDelGrado,
            enrollments: enrollmentsEstudiante,
          });
          // Sin sesiones registradas todavia para este estudiante: no hay dato, y una
          // casilla sin dato NO es cero — decir "0 faltas" de alguien a quien nadie ha
          // pasado lista es mentir.
          if (stats.sessionsCount === 0) continue;
          porEstudiante[id] = stats.aMaster2000;
        }
        setFaltasPorEstudiante(porEstudiante);
      } catch {
        if (vivo) setFaltasPorEstudiante({});
      }
    })();
    return () => {
      vivo = false;
    };
  }, [grado, studentIds]);

  /**
   * Llegadas tarde a la institucion que ALERTAN (excluye justificadas y pendientes de
   * verificar, ver `llegadasQueAlertan`). Acumuladas en el año escolar, igual que el
   * escalamiento de color del coordinador. Cada estudiante del grupo parte de 0: aqui, a
   * diferencia de las faltas, la consulta si cubre a todo el grado, asi que la ausencia
   * de registros para alguien es una respuesta real (nunca llego tarde), no un vacio de
   * datos. Try/catch propio: si esto falla, el resto del cuaderno sigue igual.
   */
  useEffect(() => {
    let vivo = true;
    void (async () => {
      try {
        const hoy = new Date().toISOString().slice(0, 10);
        const llegadas = await leerLlegadasTardePorGrado({ grado, desde: `${anio}-01-01`, hasta: hoy });
        if (!vivo) return;
        const queAlertan = llegadasQueAlertan(llegadas);
        const porEstudiante: Record<string, number> = {};
        for (const id of studentIds) porEstudiante[id] = 0;
        for (const l of queAlertan) {
          if (porEstudiante[l.studentId] !== undefined) porEstudiante[l.studentId] += 1;
        }
        setLlegadasTardePorEstudiante(porEstudiante);
      } catch {
        if (vivo) setLlegadasTardePorEstudiante({});
      }
    })();
    return () => {
      vivo = false;
    };
  }, [grado, anio, studentIds]);

  /** Las dos columnas que el sistema ya sabe, listas para pintarse al final del cuaderno
   * si el director no las ha ocultado. */
  const columnasAutomaticas: ColumnaAutomatica[] = ocultarAutomaticas
    ? []
    : [
        { id: 'faltas', nombre: 'Faltas', valores: faltasPorEstudiante },
        { id: 'llegadas_tarde', nombre: 'Llegadas tarde', valores: llegadasTardePorEstudiante },
      ];
  const totalesAutomaticas = useMemo(
    () => new Map(columnasAutomaticas.map((c) => [c.id, totalDeAutomatica(c, studentIds)])),
    [ocultarAutomaticas, faltasPorEstudiante, llegadasTardePorEstudiante, studentIds],
  );

  function alternarAutomaticas() {
    const siguiente = !ocultarAutomaticas;
    setOcultarAutomaticas(siguiente);
    guardarAutomaticasOcultas(siguiente);
  }

  /**
   * Pinta la casilla en el acto y manda la escritura sin esperarla: `marcarCelda` ya no
   * espera el acuse del servidor (ver `datos.ts`), asi que esperarla aqui dejaria la
   * casilla muerta sin señal. Los fallos de red los avisa `IndicadorSync`, en `index.tsx`,
   * que ya cubre toda la pantalla de asistencia.
   */
  function fijarCelda(studentId: string, columnaId: string, valor: ValorCelda | null) {
    setDireccion((d) => {
      if (!d) return d;
      const porEstudiante = { ...(d.valores[studentId] ?? {}) };
      if (valor === null) delete porEstudiante[columnaId];
      else porEstudiante[columnaId] = valor;
      return { ...d, valores: { ...d.valores, [studentId]: porEstudiante } };
    });
    void marcarCelda(grado, anio, studentId, columnaId, valor);
  }

  /** Tres estados, no dos: sin asignar -> si -> no -> sin asignar. */
  function alternarCasilla(studentId: string, columnaId: string) {
    const actual = direccion?.valores[studentId]?.[columnaId];
    const siguiente = actual === undefined ? true : actual === true ? false : null;
    fijarCelda(studentId, columnaId, siguiente);
  }

  function ajustarCeldaPuntos(studentId: string, columnaId: string, delta: 1 | -1) {
    const actual = direccion?.valores[studentId]?.[columnaId];
    fijarCelda(studentId, columnaId, ajustarPuntos(actual, delta));
  }

  function moverColumnaYGuardar(columnaId: string, delta: 1 | -1) {
    if (!direccion) return;
    const nuevas = moverColumna(direccion.columnas, columnaId, delta);
    setDireccion((d) => (d ? { ...d, columnas: nuevas } : d));
    void guardarColumnas(grado, anio, nuevas);
    setMenuColumna(null);
  }

  function quitarColumnaYGuardar(columnaId: string) {
    if (!direccion) return;
    const nombre = direccion.columnas.find((c) => c.columnaId === columnaId)?.nombre ?? 'esta columna';
    const ok = window.confirm(
      `¿Quitar "${nombre}"? Se pierden los valores que tenga registrados cada estudiante en esta columna.`,
    );
    if (!ok) return;
    const { columnas: nuevasColumnas, valores } = quitarColumna(direccion, columnaId);
    setDireccion((d) => (d ? { ...d, columnas: nuevasColumnas, valores } : d));
    void guardarColumnas(grado, anio, nuevasColumnas, valores);
    setMenuColumna(null);
  }

  function crearColumna(columna: ColumnaDireccion) {
    if (!direccion) return;
    const nuevas = [...direccion.columnas, columna];
    setDireccion((d) => (d ? { ...d, columnas: nuevas } : d));
    void guardarColumnas(grado, anio, nuevas);
    setSheetNuevaColumna(false);
  }

  async function descargarExcel() {
    if (!direccion) return;
    setDescargando(true);
    try {
      const hoja = buildDireccionGrupoExport({
        grado,
        anio,
        estudiantes: estudiantes.map((e) => ({
          studentId: e.studentId,
          apellidos: e.apellidos,
          nombres: e.nombres,
        })),
        direccion,
      });
      const wb = new ExcelJS.Workbook();
      // El nombre de la hoja de Excel no admite mas de 31 caracteres.
      const ws = wb.addWorksheet(hoja.nombre.slice(0, 31));
      ws.addRow(hoja.encabezados);
      for (const fila of hoja.filas) ws.addRow(fila);
      ws.addRow([]);
      for (const nota of hoja.notas) ws.addRow([nota]);

      const buffer = await wb.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${hoja.nombre}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setDescargando(false);
    }
  }

  if (cargando) {
    return <p className="p-3 text-sm text-muted">Cargando cuaderno de dirección de grupo…</p>;
  }

  return (
    <div className="space-y-3">
      {error && (
        <div className="rounded-xl border border-danger-soft bg-danger-soft p-3 text-sm text-danger-soft-fg">
          {error}
        </div>
      )}

      {columnas.length > 0 && (
        <div className="flex justify-end">
          <button
            onClick={alternarAutomaticas}
            className="flex min-h-[36px] items-center gap-1.5 rounded-lg border border-line px-2.5 text-xs font-medium text-soft hover:bg-hover"
          >
            {ocultarAutomaticas ? <EyeOff size={14} /> : <Eye size={14} />}
            {ocultarAutomaticas ? 'Mostrar faltas y llegadas tarde' : 'Ocultar faltas y llegadas tarde'}
          </button>
        </div>
      )}

      {columnas.length === 0 ? (
        <div className="space-y-3 rounded-xl border border-line bg-card p-4 text-sm text-soft">
          <p>
            Este es su cuaderno paralelo del grupo: cuotas, equipos de aseo, requisitos,
            media técnica — lo que usted decida llevar aquí, con las columnas que usted
            defina. No es asistencia y no se cruza con ella.
          </p>
          <button
            onClick={() => setSheetNuevaColumna(true)}
            className="min-h-[36px] rounded-lg border border-dashed border-line-strong px-3 text-sm font-medium text-accent"
          >
            + Crear la primera columna
          </button>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-line bg-card">
          <table className="w-max min-w-full border-collapse">
            <thead>
              <tr>
                {/* Mismo patron que Planilla.tsx: el ancho del <th> y el del <td> de esta
                    columna deben coincidir EXACTO, o la columna fija se parte al
                    desplazar la tabla de lado. */}
                <th className="sticky left-0 z-10 min-w-[10.5rem] max-w-[10.5rem] border-b border-r border-line bg-card p-2 text-left text-xs font-semibold text-muted">
                  Estudiante ({estudiantes.length})
                </th>
                {/* Franja alterna + borde vertical: sin esto las columnas se funden unas
                    con otras y no se sabe donde acaba "Cuota 1" y empieza "Cuota 2". La
                    franja va en la cabecera Y en las celdas, con el mismo indice, o el
                    rayado no se alinea con lo que separa. */}
                {columnas.map((c, i) => (
                  <th
                    key={c.columnaId}
                    className={[
                      'min-w-[7rem] max-w-[7rem] border-b border-r border-line p-1.5 text-center text-xs font-normal text-muted',
                      i % 2 === 1 ? 'bg-elevated' : '',
                    ].join(' ')}
                  >
                    <div className="flex items-center justify-center gap-1">
                      <span className="truncate font-semibold text-strong">{c.nombre}</span>
                      <button
                        onClick={() => setMenuColumna(c.columnaId)}
                        aria-label={`Opciones de la columna ${c.nombre}`}
                        className="grid h-7 w-7 shrink-0 place-items-center rounded text-muted hover:bg-hover"
                      >
                        <Ellipsis size={14} />
                      </button>
                    </div>
                    <div className="mt-0.5 truncate text-[0.65rem] text-muted" title={totales.get(c.columnaId)?.texto}>
                      {totales.get(c.columnaId)?.texto}
                    </div>
                  </th>
                ))}
                {/* Columnas automaticas: siempre al final, sin boton de opciones (no se
                    mueven ni se quitan) y con el rotulo "automática" para que nadie
                    intente escribir en ellas. Mismo ancho EXACTO que las manuales — ver
                    la nota de <td> mas abajo. */}
                {columnasAutomaticas.map((c, j) => {
                  const i = columnas.length + j;
                  return (
                    <th
                      key={c.id}
                      className={[
                        'min-w-[7rem] max-w-[7rem] border-b border-r border-line p-1.5 text-center text-xs font-normal text-muted',
                        i % 2 === 1 ? 'bg-elevated' : '',
                      ].join(' ')}
                    >
                      <span className="truncate font-semibold text-strong">{c.nombre}</span>
                      <div className="mt-0.5 flex justify-center">
                        <span className="rounded-full border border-line-strong px-1.5 py-px text-[0.55rem] uppercase tracking-wide text-muted">
                          automática
                        </span>
                      </div>
                      <div
                        className="mt-0.5 truncate text-[0.65rem] text-muted"
                        title={totalesAutomaticas.get(c.id)?.texto}
                      >
                        {totalesAutomaticas.get(c.id)?.texto}
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {estudiantes.map((e) => (
                <tr key={e.studentId}>
                  <td className="sticky left-0 z-10 min-w-[10.5rem] max-w-[10.5rem] border-b border-r border-line bg-card p-1.5">
                    <div className="flex items-center gap-2">
                      <Avatar estudiante={e} tamano={40} />
                      <span className="min-w-0 truncate text-xs leading-tight text-strong">
                        <span className="block truncate font-semibold">{e.apellidos}</span>
                        <span className="block truncate text-muted">
                          {nombresDePila(e.apellidos, e.nombres)}
                        </span>
                      </span>
                    </div>
                  </td>
                  {columnas.map((c, i) => (
                    <td
                      key={c.columnaId}
                      className={[
                        'border-b border-r border-line p-0 text-center',
                        i % 2 === 1 ? 'bg-elevated' : '',
                      ].join(' ')}
                    >
                      <CeldaColumna
                        columna={c}
                        valor={direccion?.valores[e.studentId]?.[c.columnaId]}
                        onCasilla={() => alternarCasilla(e.studentId, c.columnaId)}
                        onPuntos={(delta) => ajustarCeldaPuntos(e.studentId, c.columnaId, delta)}
                        onNumero={(n) => fijarCelda(e.studentId, c.columnaId, n)}
                        onAbrirIcono={() => setSheetIcono({ studentId: e.studentId, columna: c })}
                      />
                    </td>
                  ))}
                  {columnasAutomaticas.map((c, j) => {
                    const i = columnas.length + j;
                    const valor = c.valores[e.studentId];
                    return (
                      <td
                        key={c.id}
                        className={[
                          'border-b border-r border-line p-0 text-center',
                          i % 2 === 1 ? 'bg-elevated' : '',
                        ].join(' ')}
                      >
                        <div className="grid h-9 min-h-[36px] place-items-center text-xs font-semibold text-strong">
                          {valor === undefined ? <span className="text-muted opacity-70">·</span> : valor}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {columnas.length > 0 && (
        <button
          onClick={() => setSheetNuevaColumna(true)}
          className="min-h-[36px] w-full rounded-xl border border-dashed border-line-strong bg-card p-3 text-sm font-medium text-accent"
        >
          + Columna
        </button>
      )}

      {direccion && columnas.length > 0 && (
        <button
          onClick={descargarExcel}
          disabled={descargando}
          className="flex min-h-[36px] w-full items-center justify-center gap-2 rounded-xl border border-line bg-card p-2.5 text-sm font-medium text-soft disabled:opacity-60"
        >
          <Download size={16} aria-hidden />
          {descargando ? 'Generando Excel…' : 'Descargar a Excel'}
        </button>
      )}

      {menuColumna && (
        <MenuColumna
          columna={columnas.find((c) => c.columnaId === menuColumna) ?? null}
          esPrimera={columnas[0]?.columnaId === menuColumna}
          esUltima={columnas[columnas.length - 1]?.columnaId === menuColumna}
          onMover={(delta) => moverColumnaYGuardar(menuColumna, delta)}
          onQuitar={() => quitarColumnaYGuardar(menuColumna)}
          onCerrar={() => setMenuColumna(null)}
        />
      )}

      {sheetIcono && (
        <SheetOpcionIcono
          estudiante={estudiantes.find((e) => e.studentId === sheetIcono.studentId) ?? null}
          columna={sheetIcono.columna}
          valorActual={direccion?.valores[sheetIcono.studentId]?.[sheetIcono.columna.columnaId]}
          onElegir={(opcionId) => {
            fijarCelda(sheetIcono.studentId, sheetIcono.columna.columnaId, opcionId);
            setSheetIcono(null);
          }}
          onQuitar={() => {
            fijarCelda(sheetIcono.studentId, sheetIcono.columna.columnaId, null);
            setSheetIcono(null);
          }}
          onCerrar={() => setSheetIcono(null)}
        />
      )}

      {sheetNuevaColumna && (
        <SheetNuevaColumna
          existentes={columnas}
          onCrear={crearColumna}
          onCerrar={() => setSheetNuevaColumna(false)}
        />
      )}
    </div>
  );
}

/** Una casilla, segun el tipo de su columna. */
function CeldaColumna({
  columna,
  valor,
  onCasilla,
  onPuntos,
  onNumero,
  onAbrirIcono,
}: {
  columna: ColumnaDireccion;
  valor: ValorCelda | undefined;
  onCasilla: () => void;
  onPuntos: (delta: 1 | -1) => void;
  onNumero: (n: number | null) => void;
  onAbrirIcono: () => void;
}) {
  if (columna.tipo === 'numero') {
    return <CeldaNumero valor={valor} onCommit={onNumero} />;
  }

  if (columna.tipo === 'casilla') {
    // Tres estados: sin asignar (rayado), si (verde), no (rojo). Ausente no es "no".
    const clase =
      valor === true
        ? 'bg-success-soft text-success-soft-fg'
        : valor === false
          ? 'bg-danger-soft text-danger-soft-fg'
          : 'bg-elevated text-muted opacity-70';
    return (
      <button
        onClick={onCasilla}
        className={`grid h-9 w-full min-h-[36px] place-items-center text-xs font-bold ${clase}`}
        aria-label={valor === true ? 'Marcado sí' : valor === false ? 'Marcado no' : 'Sin asignar'}
        title={valor === true ? 'Sí' : valor === false ? 'No' : 'Sin asignar — toque para marcar'}
      >
        {valor === true ? 'Sí' : valor === false ? 'No' : '·'}
      </button>
    );
  }

  if (columna.tipo === 'puntos') {
    const total = typeof valor === 'number' ? valor : 0;
    const signo = total > 0 ? '+' : '';
    return (
      <div className="flex h-9 min-h-[36px] items-center justify-center gap-1 px-1">
        <button
          onClick={() => onPuntos(-1)}
          aria-label="Restar un punto"
          className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-line text-danger-soft-fg"
        >
          −
        </button>
        <span className="min-w-[1.75rem] text-center text-xs font-semibold text-strong">
          {valor === undefined ? '·' : `${signo}${total}`}
        </span>
        <button
          onClick={() => onPuntos(1)}
          aria-label="Sumar un punto"
          className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-line text-success-soft-fg"
        >
          +
        </button>
      </div>
    );
  }

  // icono
  const opcion = columna.opciones.find((o) => o.opcionId === valor);
  const color = COLORES_GRUPO.find((c) => c.id === opcion?.colorId) ?? null;
  const Icono = opcion && opcion.icono ? ICONO_COMPONENTE[opcion.icono] : null;
  return (
    <button
      onClick={onAbrirIcono}
      className="flex h-9 min-h-[36px] w-full items-center justify-center gap-1 px-1"
      aria-label={opcion ? opcion.etiqueta : 'Sin asignar'}
      title={opcion ? opcion.etiqueta : 'Sin asignar — toque para elegir'}
    >
      {opcion ? (
        <span
          className="flex max-w-full items-center gap-1 truncate rounded-full border px-1.5 py-0.5 text-[0.65rem]"
          style={estiloEtiqueta(color)}
        >
          {Icono && <Icono size={12} />}
          <span className="truncate">{opcion.etiqueta}</span>
        </span>
      ) : (
        <span className="text-muted">·</span>
      )}
    </button>
  );
}

/**
 * Campo numerico con estado local propio: la escritura se confirma al salir de la
 * casilla (blur) o con Intro, no en cada tecla, para no mandar una escritura por digito.
 * Vacio = sin asignar, y no es lo mismo que cero (ver `ValorCelda` en `domain/types.ts`).
 */
function CeldaNumero({
  valor,
  onCommit,
}: {
  valor: ValorCelda | undefined;
  onCommit: (n: number | null) => void;
}) {
  const [texto, setTexto] = useState(() => (typeof valor === 'number' ? String(valor) : ''));

  useEffect(() => {
    setTexto(typeof valor === 'number' ? String(valor) : '');
  }, [valor]);

  return (
    <input
      type="number"
      inputMode="decimal"
      value={texto}
      onChange={(ev) => setTexto(ev.target.value)}
      onBlur={() => {
        const limpio = texto.trim();
        if (limpio === '') {
          onCommit(null);
          return;
        }
        const n = Number(limpio);
        if (Number.isNaN(n)) {
          setTexto(typeof valor === 'number' ? String(valor) : '');
          return;
        }
        onCommit(n);
      }}
      onKeyDown={(ev) => {
        if (ev.key === 'Enter') (ev.target as HTMLInputElement).blur();
      }}
      placeholder="·"
      aria-label="Valor"
      className="h-9 min-h-[36px] w-full border-0 bg-transparent px-1 text-center text-sm text-strong outline-none focus:ring-2 focus:ring-accent"
    />
  );
}

/** Hoja de opciones de una columna de tipo `icono`, mas "quitar". La paleta es la que
 * se fijo al crear la columna: no se ofrecen los 53 iconos aqui. */
function SheetOpcionIcono({
  estudiante,
  columna,
  valorActual,
  onElegir,
  onQuitar,
  onCerrar,
}: {
  estudiante: Student | null;
  columna: ColumnaDireccion;
  valorActual: ValorCelda | undefined;
  onElegir: (opcionId: string) => void;
  onQuitar: () => void;
  onCerrar: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-end bg-black/40 p-0 sm:place-items-center sm:p-4"
      onClick={onCerrar}
    >
      <div
        className="w-full max-w-md rounded-t-2xl border border-line bg-card p-4 sm:rounded-2xl"
        onClick={(ev) => ev.stopPropagation()}
      >
        <p className="text-sm font-semibold text-strong">
          {columna.nombre}
          {estudiante && <span className="font-normal text-muted"> · {nombreCompleto(estudiante)}</span>}
        </p>
        <div className="mt-3 grid grid-cols-2 gap-1.5 sm:grid-cols-3">
          {columna.opciones.map((o) => {
            const color = COLORES_GRUPO.find((c) => c.id === o.colorId) ?? null;
            const Icono = o.icono ? ICONO_COMPONENTE[o.icono] : null;
            const activa = valorActual === o.opcionId;
            return (
              <button
                key={o.opcionId}
                onClick={() => onElegir(o.opcionId)}
                className={[
                  'flex min-h-[36px] flex-col items-center gap-1 rounded-lg border p-2 text-center',
                  activa ? 'border-accent' : 'border-line',
                ].join(' ')}
              >
                <span
                  className="grid h-8 w-10 place-items-center rounded"
                  style={estiloEtiqueta(color)}
                >
                  {Icono && <Icono size={16} />}
                </span>
                <span className="truncate text-xs leading-tight text-strong">{o.etiqueta}</span>
              </button>
            );
          })}
        </div>
        <button
          onClick={onQuitar}
          className="mt-3 w-full rounded-lg border border-line p-2 text-sm text-soft"
        >
          Quitar (sin asignar)
        </button>
        <button onClick={onCerrar} className="mt-1.5 w-full rounded-lg p-2 text-sm text-muted">
          Cancelar
        </button>
      </div>
    </div>
  );
}

/** Mover a izquierda/derecha y quitar. Mismo patron de hoja que el resto del modulo. */
function MenuColumna({
  columna,
  esPrimera,
  esUltima,
  onMover,
  onQuitar,
  onCerrar,
}: {
  columna: ColumnaDireccion | null;
  esPrimera: boolean;
  esUltima: boolean;
  onMover: (delta: 1 | -1) => void;
  onQuitar: () => void;
  onCerrar: () => void;
}) {
  if (!columna) return null;
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-end bg-black/40 p-0 sm:place-items-center sm:p-4"
      onClick={onCerrar}
    >
      <div
        className="w-full max-w-sm rounded-t-2xl border border-line bg-card p-4 sm:rounded-2xl"
        onClick={(ev) => ev.stopPropagation()}
      >
        <p className="text-sm font-semibold text-strong">{columna.nombre}</p>
        <div className="mt-3 space-y-1.5">
          <button
            onClick={() => onMover(-1)}
            disabled={esPrimera}
            className="flex min-h-[36px] w-full items-center gap-2 rounded-lg border border-line p-2 text-sm text-strong disabled:opacity-40"
          >
            <ChevronLeft size={16} /> Mover a la izquierda
          </button>
          <button
            onClick={() => onMover(1)}
            disabled={esUltima}
            className="flex min-h-[36px] w-full items-center gap-2 rounded-lg border border-line p-2 text-sm text-strong disabled:opacity-40"
          >
            <ChevronRight size={16} /> Mover a la derecha
          </button>
          <button
            onClick={onQuitar}
            className="flex min-h-[36px] w-full items-center gap-2 rounded-lg border border-danger-soft p-2 text-sm text-danger-soft-fg"
          >
            <X size={16} /> Quitar columna
          </button>
        </div>
        <button onClick={onCerrar} className="mt-3 w-full rounded-lg p-2 text-sm text-muted">
          Cerrar
        </button>
      </div>
    </div>
  );
}

const CONTADOR_OPCION = { n: 0 };
/** Id corto y unico dentro de la sesion del navegador; no necesita ser global. */
function nuevoOpcionId(): string {
  CONTADOR_OPCION.n += 1;
  return `op_${Date.now().toString(36)}_${CONTADOR_OPCION.n}`;
}

/** Hoja para crear una columna: nombre, tipo, y si es `icono`, la paleta cerrada de esa
 * columna elegida entre los 53 iconos curados. */
function SheetNuevaColumna({
  existentes,
  onCrear,
  onCerrar,
}: {
  existentes: ColumnaDireccion[];
  onCrear: (columna: ColumnaDireccion) => void;
  onCerrar: () => void;
}) {
  const [nombre, setNombre] = useState('');
  const [tipo, setTipo] = useState<TipoColumna>('numero');
  const [opciones, setOpciones] = useState<OpcionColumna[]>([]);
  const grupos = useMemo(() => iconosPorGrupo(), []);

  function alternarIcono(icono: IconoDisponible) {
    setOpciones((prev) => {
      const yaEsta = prev.find((o) => o.icono === icono.nombre);
      if (yaEsta) return prev.filter((o) => o.icono !== icono.nombre);
      const color = COLORES_GRUPO[prev.length % COLORES_GRUPO.length];
      return [...prev, { opcionId: nuevoOpcionId(), icono: icono.nombre, etiqueta: icono.etiqueta, colorId: color.id }];
    });
  }

  function renombrarOpcion(opcionId: string, etiqueta: string) {
    setOpciones((prev) => prev.map((o) => (o.opcionId === opcionId ? { ...o, etiqueta } : o)));
  }

  function cambiarColorOpcion(opcionId: string) {
    setOpciones((prev) =>
      prev.map((o) => {
        if (o.opcionId !== opcionId) return o;
        const idx = COLORES_GRUPO.findIndex((c) => c.id === o.colorId);
        const siguiente = COLORES_GRUPO[(idx + 1) % COLORES_GRUPO.length];
        return { ...o, colorId: siguiente.id };
      }),
    );
  }

  const opcionesFinales = tipo === 'icono' ? opciones : [];
  const errorValidacion = validarColumna(nombre, tipo, opcionesFinales, existentes);

  function confirmar() {
    if (errorValidacion) return;
    onCrear({
      columnaId: nuevoOpcionId().replace('op_', 'col_'),
      nombre: nombre.trim(),
      tipo,
      orden: existentes.length,
      opciones: opcionesFinales,
    });
  }

  const TIPOS: { tipo: TipoColumna; etiqueta: string; descripcion: string }[] = [
    { tipo: 'numero', etiqueta: 'Número', descripcion: 'Una cifra por estudiante, como una cuota. Vacío no es cero.' },
    { tipo: 'casilla', etiqueta: 'Casilla', descripcion: 'Un toque alterna sí / no / sin asignar.' },
    { tipo: 'puntos', etiqueta: 'Puntos', descripcion: 'Botones + y − que acumulan, como +3 o −1.' },
    { tipo: 'icono', etiqueta: 'Ícono', descripcion: 'Elija una paleta cerrada de íconos para esta columna.' },
  ];

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-end bg-black/40 p-0 sm:place-items-center sm:p-4"
      onClick={onCerrar}
    >
      <div
        className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-t-2xl border border-line bg-card p-4 sm:rounded-2xl"
        onClick={(ev) => ev.stopPropagation()}
      >
        <p className="text-sm font-semibold text-strong">Nueva columna</p>

        <label className="mt-3 block text-xs font-medium text-muted">Nombre corto</label>
        <input
          value={nombre}
          onChange={(ev) => setNombre(ev.target.value)}
          placeholder="Cuota 1, Aseo P1…"
          maxLength={24}
          className="mt-1 h-9 w-full rounded-lg border border-line bg-transparent px-2 text-sm text-strong outline-none focus:ring-2 focus:ring-accent"
        />

        <p className="mt-3 text-xs font-medium text-muted">Tipo</p>
        <div className="mt-1 grid grid-cols-2 gap-1.5">
          {TIPOS.map((t) => (
            <Ayuda key={t.tipo} texto={t.descripcion}>
              <button
                onClick={() => setTipo(t.tipo)}
                className={[
                  'min-h-[36px] w-full rounded-lg border px-2 py-1.5 text-sm',
                  tipo === t.tipo
                    ? 'border-accent bg-accent-soft font-semibold text-accent-soft-fg'
                    : 'border-line text-soft',
                ].join(' ')}
              >
                {t.etiqueta}
              </button>
            </Ayuda>
          ))}
        </div>

        {tipo === 'icono' && (
          <div className="mt-3 space-y-3">
            {opciones.length > 0 && (
              <div className="space-y-1.5 rounded-lg border border-line p-2">
                <p className="text-xs font-medium text-muted">Opciones elegidas ({opciones.length})</p>
                {opciones.map((o) => {
                  const color = COLORES_GRUPO.find((c) => c.id === o.colorId) ?? null;
                  const Icono = ICONO_COMPONENTE[o.icono];
                  return (
                    <div key={o.opcionId} className="flex items-center gap-1.5">
                      <button
                        onClick={() => cambiarColorOpcion(o.opcionId)}
                        title="Cambiar color"
                        aria-label={`Cambiar color de ${o.etiqueta}`}
                        className="grid h-8 w-8 shrink-0 place-items-center rounded"
                        style={estiloEtiqueta(color)}
                      >
                        {Icono && <Icono size={15} />}
                      </button>
                      <input
                        value={o.etiqueta}
                        onChange={(ev) => renombrarOpcion(o.opcionId, ev.target.value)}
                        className="h-8 min-w-0 flex-1 rounded-lg border border-line bg-transparent px-2 text-sm text-strong outline-none focus:ring-2 focus:ring-accent"
                      />
                      <button
                        onClick={() => alternarIcono({ nombre: o.icono, etiqueta: o.etiqueta, grupo: '' })}
                        aria-label={`Quitar ${o.etiqueta}`}
                        className="grid h-8 w-8 shrink-0 place-items-center rounded text-muted hover:bg-hover"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="max-h-64 space-y-2 overflow-y-auto">
              {grupos.map((g) => (
                <div key={g.grupo}>
                  <p className="text-xs font-medium text-muted">{g.grupo}</p>
                  <div className="mt-1 grid grid-cols-4 gap-1 sm:grid-cols-5">
                    {g.iconos.map((ic) => {
                      const elegido = opciones.some((o) => o.icono === ic.nombre);
                      const Icono = ICONO_COMPONENTE[ic.nombre];
                      return (
                        <button
                          key={ic.nombre}
                          onClick={() => alternarIcono(ic)}
                          title={ic.etiqueta}
                          aria-label={ic.etiqueta}
                          className={[
                            'grid min-h-[36px] place-items-center rounded-lg border p-1.5',
                            elegido ? 'border-accent bg-accent-soft' : 'border-line',
                          ].join(' ')}
                        >
                          <Icono size={16} />
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {errorValidacion && nombre.trim() !== '' && (
          <p className="mt-3 rounded-lg border border-warning-soft bg-warning-soft p-2 text-xs text-warning-soft-fg">
            {errorValidacion}
          </p>
        )}

        <div className="mt-4 flex gap-2">
          <button
            onClick={onCerrar}
            className="min-h-[36px] flex-1 rounded-lg border border-line p-2 text-sm text-soft"
          >
            Cancelar
          </button>
          <button
            onClick={confirmar}
            disabled={!nombre.trim() || !!errorValidacion}
            className="flex min-h-[36px] flex-1 items-center justify-center gap-1.5 rounded-lg bg-accent p-2 text-sm font-semibold text-accent-fg disabled:opacity-40"
          >
            <Plus size={15} /> Crear columna
          </button>
        </div>
      </div>
    </div>
  );
}
