import { useEffect, useMemo, useState } from 'react';
import { Download } from 'lucide-react';
import {
  contrasteConListaOficial,
  porGrado,
  type ContrasteRestaurante,
  type FilaContraste,
} from './domain/restaurante';
import { ETIQUETA_SERVICIO } from './domain/parse-inscritos-restaurante';
import { leerEstudiantesDeSede, leerInscritosRestaurante, leerPasosDeRango } from './datos';
import { jornadaDeGrado, toDateKey } from './domain/ids';
import { nombreCompleto } from './domain/nombres';
import type { Hoja } from './domain/exports';
import type { InscritoRestaurante, RegistroRestaurante, Sede, Student } from './domain/types';

/**
 * El reporte del restaurante: lo que se le entrega al proveedor.
 *
 * Julian, 2026-08-27: «al final necesitan saber cuales fueron los estudiantes que fueron
 * al restaurante o al vaso de leche y cuantas veces, y contrastarlo con la lista oficial
 * de los que estan».
 *
 * Y el grupo que de verdad le interesa, el que NO puede quedar escondido dentro de un
 * total: **los que usaron el servicio sin estar inscritos**. La comida que sobra se le da
 * a quien este ahi, y esto es lo unico que deja constancia de a quien. Por eso los cuatro
 * grupos del contraste se pintan como CUATRO SECCIONES visibles, cada una con su nombre y
 * su cifra, y ninguna detras de un desplegable.
 *
 * ESTA PANTALLA NO CALCULA NADA. Todo el contraste lo hace `domain/restaurante.ts`
 * (`contrasteConListaOficial`, `porGrado`), que esta probado. Aqui solo se pinta: una
 * segunda copia de la aritmetica seria la que se quedaria sin el proximo arreglo, y ademas
 * las cifras del titular y las de la tabla podrian dejar de coincidir.
 *
 * SIN LISTA OFICIAL EL REPORTE SIGUE SIRVIENDO, y ese es el estado real de hoy, no un caso
 * raro: enseña quienes usaron el servicio y cuantas veces, y dice con todas las letras que
 * sin lista oficial no hay con que contrastar. Un reporte que se negara a salir hasta que
 * alguien suba un Excel dejaria al colegio sin la unica cifra que ya tiene.
 *
 * `exceljs` pesa cerca de un mega y solo hace falta si alguien pulsa «Descargar»: se carga
 * con `import()` dentro del propio manejador, no arriba. Mismo motivo que en
 * `PanelPrograma`.
 *
 * DATOS DE MENORES: ni en pantalla ni en el Excel aparece el documento de identidad. Al
 * proveedor se le entrega nombre, grupo y conteos, que es lo que necesita para facturar.
 */

const SEDES: { valor: Sede; etiqueta: string }[] = [
  { valor: 'central', etiqueta: 'Central' },
  { valor: 'gustavo_rodas', etiqueta: 'Gustavo Rodas' },
  { valor: 'la_finquita', etiqueta: 'La Finquita' },
];

/** Primer y ultimo dia del mes en curso, en hora local (nunca UTC: ver `ids.ts`). */
function mesEnCurso(): { desde: string; hasta: string } {
  const hoy = new Date();
  return {
    desde: toDateKey(new Date(hoy.getFullYear(), hoy.getMonth(), 1)),
    hasta: toDateKey(new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0)),
  };
}

/** Nombre de cada uno de los cuatro grupos, y por que existe. */
type ClaveGrupo =
  | 'inscritosQueUsaron'
  | 'usaronSinEstarInscritos'
  | 'inscritosQueUsaronOtroServicio'
  | 'inscritosQueNuncaUsaron';

const SECCIONES: { clave: ClaveGrupo; titulo: string; explicacion: string }[] = [
  {
    clave: 'usaronSinEstarInscritos',
    titulo: 'Usaron el servicio sin estar inscritos',
    explicacion:
      'La comida que sobra se le da a quien esté ahí. Este es el uso real que no aparece ' +
      'en ninguna lista, y va primero a propósito: es lo que el colegio no puede ver de ' +
      'ninguna otra forma.',
  },
  {
    clave: 'inscritosQueUsaron',
    titulo: 'Inscritos que sí usaron su servicio',
    explicacion: 'Están en la lista oficial y pasaron por el servicio en el que figuran.',
  },
  {
    clave: 'inscritosQueUsaronOtroServicio',
    titulo: 'Inscritos que solo usaron el otro servicio',
    explicacion:
      'Figuran en una lista y pasaron únicamente por la otra. Suele significar que se ' +
      'cargaron en el servicio equivocado; no impide nada, pero conviene revisarlo.',
  },
  {
    clave: 'inscritosQueNuncaUsaron',
    titulo: 'Inscritos que no aparecieron nunca',
    explicacion: 'Están en la lista oficial y no pasaron ni una vez en este rango de fechas.',
  },
];

export default function ReporteRestaurante({ sedeInicial = 'central' }: { sedeInicial?: Sede } = {}) {
  const inicial = mesEnCurso();
  const [sede, setSede] = useState<Sede>(sedeInicial);
  const [desde, setDesde] = useState(inicial.desde);
  const [hasta, setHasta] = useState(inicial.hasta);
  const [agrupar, setAgrupar] = useState(false);

  const [registros, setRegistros] = useState<RegistroRestaurante[]>([]);
  const [inscritos, setInscritos] = useState<InscritoRestaurante[]>([]);
  const [matricula, setMatricula] = useState<Student[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /**
   * La lista oficial va por AÑO, y el año se toma del final del rango: si alguien mira
   * diciembre-enero a caballo entre dos años, la lista que vale es la del año en el que
   * termina la consulta.
   */
  const anio = Number(hasta.slice(0, 4));

  useEffect(() => {
    if (!desde || !hasta || desde > hasta) return;
    let vivo = true;
    setCargando(true);
    setError(null);
    void (async () => {
      try {
        const [ps, ins, ms] = await Promise.all([
          leerPasosDeRango(sede, desde, hasta),
          leerInscritosRestaurante(sede, anio),
          leerEstudiantesDeSede(sede),
        ]);
        if (!vivo) return;
        setRegistros(ps);
        setInscritos(ins);
        setMatricula(ms);
      } catch (e) {
        if (vivo) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (vivo) setCargando(false);
      }
    })();
    return () => {
      vivo = false;
    };
  }, [sede, desde, hasta, anio]);

  const contraste = useMemo(
    () => contrasteConListaOficial(registros, inscritos),
    [registros, inscritos],
  );

  /** studentId -> nombre para mostrar. Los conteos NO dependen de esto. */
  const nombreDe = useMemo(() => {
    const mapa = new Map<string, string>();
    for (const e of matricula) mapa.set(e.studentId, nombreCompleto(e));
    return mapa;
  }, [matricula]);

  const hayListaOficial = contraste.conteos.inscritosTotal > 0;
  const rangoInvalido = Boolean(desde && hasta && desde > hasta);

  async function descargar() {
    const hoja = hojaReporteRestaurante(contraste, nombreDe, { sede, desde, hasta, anio });
    // Import dinamico: `exceljs` no entra en el paquete inicial. Ver la cabecera.
    const { default: ExcelJS } = await import('exceljs');
    const wb = new ExcelJS.Workbook();
    // Excel no admite nombres de hoja de mas de 31 caracteres.
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
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-semibold text-strong">Reporte del restaurante</h2>
        <p className="text-xs text-muted">
          Quiénes usaron el vaso de leche y el restaurante, cuántas veces, y cómo se compara
          con la lista oficial de inscritos. Es lo que se le entrega al proveedor.
        </p>
      </div>

      <Filtros
        sede={sede}
        desde={desde}
        hasta={hasta}
        onSede={setSede}
        onDesde={setDesde}
        onHasta={setHasta}
        agrupar={agrupar}
        onAgrupar={setAgrupar}
        onDescargar={descargar}
        puedeDescargar={!cargando && contraste.conteos.usosTotales + contraste.conteos.inscritosTotal > 0}
      />

      {rangoInvalido && (
        <p className="rounded-lg border border-danger-soft bg-danger-soft p-2 text-sm text-danger-soft-fg">
          La fecha inicial es posterior a la final.
        </p>
      )}
      {error && (
        <p className="rounded-lg border border-danger-soft bg-danger-soft p-2 text-sm text-danger-soft-fg">
          {error}
        </p>
      )}

      {cargando ? (
        <p className="p-3 text-sm text-muted">Cargando el reporte…</p>
      ) : (
        <>
          <Totales contraste={contraste} hayListaOficial={hayListaOficial} />

          {!hayListaOficial && (
            <div className="rounded-xl border border-warning-soft bg-warning-soft p-3 text-sm text-warning-soft-fg">
              <b>No hay lista oficial de inscritos cargada para {anio} en esta sede.</b> El
              reporte enseña igual quiénes usaron el servicio y cuántas veces —que es la
              cifra que factura el proveedor—, pero <b>no hay con qué contrastar</b>: no se
              puede decir quién estaba inscrito y no fue, ni quién fue sin estar inscrito,
              porque no existe la lista contra la que compararlo. Cárguela desde «Cargar la
              lista oficial de inscritos».
            </div>
          )}

          {hayListaOficial ? (
            SECCIONES.map((s) => (
              <Seccion
                key={s.clave}
                titulo={s.titulo}
                explicacion={s.explicacion}
                filas={contraste[s.clave]}
                nombreDe={nombreDe}
                agrupar={agrupar}
                destacada={s.clave === 'usaronSinEstarInscritos'}
              />
            ))
          ) : (
            <Seccion
              titulo="Quiénes usaron el servicio y cuántas veces"
              explicacion={
                'Todos los pasos registrados en el rango. Sin lista oficial no se pueden ' +
                'separar los inscritos de los que no lo están: es una sola lista.'
              }
              filas={contraste.usaronSinEstarInscritos}
              nombreDe={nombreDe}
              agrupar={agrupar}
              destacada
            />
          )}
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
//  Filtros
// ---------------------------------------------------------------------------

function Filtros({
  sede,
  desde,
  hasta,
  onSede,
  onDesde,
  onHasta,
  agrupar,
  onAgrupar,
  onDescargar,
  puedeDescargar,
}: {
  sede: Sede;
  desde: string;
  hasta: string;
  onSede: (s: Sede) => void;
  onDesde: (s: string) => void;
  onHasta: (s: string) => void;
  agrupar: boolean;
  onAgrupar: (v: boolean) => void;
  onDescargar: () => Promise<void>;
  puedeDescargar: boolean;
}) {
  const [descargando, setDescargando] = useState(false);
  const [fallo, setFallo] = useState<string | null>(null);

  async function descargar() {
    setDescargando(true);
    setFallo(null);
    try {
      await onDescargar();
    } catch (e) {
      setFallo(e instanceof Error ? e.message : String(e));
    } finally {
      setDescargando(false);
    }
  }

  return (
    <section className="rounded-xl border border-line bg-card p-3">
      <div className="grid gap-2 sm:grid-cols-3">
        <div>
          <label className="text-xs text-muted" htmlFor="reporte-desde">
            Desde
          </label>
          <input
            id="reporte-desde"
            type="date"
            value={desde}
            onChange={(ev) => onDesde(ev.target.value)}
            className="mt-1 w-full rounded-lg border border-line bg-elevated px-2 py-2 text-sm text-strong"
          />
        </div>
        <div>
          <label className="text-xs text-muted" htmlFor="reporte-hasta">
            Hasta
          </label>
          <input
            id="reporte-hasta"
            type="date"
            value={hasta}
            onChange={(ev) => onHasta(ev.target.value)}
            className="mt-1 w-full rounded-lg border border-line bg-elevated px-2 py-2 text-sm text-strong"
          />
        </div>
        <div>
          <label className="text-xs text-muted" htmlFor="reporte-sede">
            Sede
          </label>
          <select
            id="reporte-sede"
            value={sede}
            onChange={(ev) => onSede(ev.target.value as Sede)}
            className="mt-1 w-full rounded-lg border border-line bg-elevated px-2 py-2 text-sm text-strong"
          >
            {SEDES.map((s) => (
              <option key={s.valor} value={s.valor}>
                {s.etiqueta}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <label className="flex items-center gap-2 text-sm text-soft">
          <input
            type="checkbox"
            checked={agrupar}
            onChange={(ev) => onAgrupar(ev.target.checked)}
          />
          Agrupar por grupo
        </label>
        <button
          onClick={() => void descargar()}
          disabled={descargando || !puedeDescargar}
          className="flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-accent-fg disabled:opacity-50"
        >
          <Download size={16} aria-hidden />
          {descargando ? 'Generando…' : 'Descargar para el proveedor'}
        </button>
      </div>
      {fallo && <p className="mt-2 text-xs text-danger">{fallo}</p>}
      <p className="mt-1 text-xs text-muted">
        El archivo lleva nombre, grupo y conteos. <b>Nunca</b> el documento de identidad: son
        menores y el proveedor no lo necesita para facturar.
      </p>
    </section>
  );
}

// ---------------------------------------------------------------------------
//  Totales
// ---------------------------------------------------------------------------

function Totales({
  contraste,
  hayListaOficial,
}: {
  contraste: ContrasteRestaurante;
  hayListaOficial: boolean;
}) {
  const c = contraste.conteos;
  return (
    <section className="rounded-xl border border-line bg-card p-3">
      <h3 className="text-sm font-semibold text-strong">En este rango</h3>
      <p className="mt-1 rounded-lg border border-accent bg-accent-soft p-2 text-sm text-strong">
        <b>{c.usosTotales}</b> comida(s) servida(s) a <b>{c.estudiantesQuePasaron}</b>{' '}
        estudiante(s) distinto(s).
        <span className="block text-xs text-accent-soft-fg">
          {c.usosVasoLeche} de {ETIQUETA_SERVICIO.vaso_leche.toLowerCase()} ·{' '}
          {c.usosRestaurante} de {ETIQUETA_SERVICIO.restaurante.toLowerCase()}. Los dos se
          cuentan aparte porque un mismo estudiante puede pasar por los dos el mismo día:
          son dos comidas reales.
        </span>
      </p>
      <p className="mt-1 text-xs text-muted">
        {hayListaOficial ? (
          <>
            La lista oficial tiene <b>{c.inscritosTotal}</b> inscrito(s). Las cuatro
            secciones de abajo no se solapan: cada estudiante aparece en una sola.
          </>
        ) : (
          <>No hay lista oficial cargada, así que no hay contraste posible.</>
        )}
      </p>
    </section>
  );
}

// ---------------------------------------------------------------------------
//  Una de las cuatro secciones
// ---------------------------------------------------------------------------

function FilaEstudiante({
  fila,
  nombreDe,
}: {
  fila: FilaContraste;
  nombreDe: Map<string, string>;
}) {
  return (
    <li className="flex flex-wrap items-baseline justify-between gap-x-2 border-t border-line py-1 first:border-t-0">
      <span className="truncate text-sm text-soft">
        {nombreDe.get(fila.studentId) ?? (
          <span className="text-muted">Sin nombre en la matrícula ({fila.studentId})</span>
        )}
      </span>
      <span className="text-xs text-muted">
        {fila.grado} · {ETIQUETA_SERVICIO.vaso_leche}: <b>{fila.vasoLeche}</b> ·{' '}
        {ETIQUETA_SERVICIO.restaurante}: <b>{fila.restaurante}</b> · total{' '}
        <b className="text-strong">{fila.total}</b>
      </span>
    </li>
  );
}

function Seccion({
  titulo,
  explicacion,
  filas,
  nombreDe,
  agrupar,
  destacada,
}: {
  titulo: string;
  explicacion: string;
  filas: FilaContraste[];
  nombreDe: Map<string, string>;
  agrupar: boolean;
  destacada?: boolean;
}) {
  const grupos = useMemo(() => (agrupar ? porGrado(filas) : []), [agrupar, filas]);

  return (
    <section
      className={`rounded-xl border p-3 ${
        destacada ? 'border-accent bg-accent-soft' : 'border-line bg-card'
      }`}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-2">
        <h3 className="text-sm font-semibold text-strong">{titulo}</h3>
        <span className="text-sm font-semibold text-strong">{filas.length}</span>
      </div>
      <p className="text-xs text-muted">{explicacion}</p>

      {filas.length === 0 ? (
        <p className="mt-2 text-sm text-muted">Ninguno en este rango de fechas.</p>
      ) : agrupar ? (
        <div className="mt-2 space-y-2">
          {grupos.map((g) => (
            <div key={g.grado} className="rounded-lg border border-line bg-card p-2">
              <p className="text-sm font-semibold text-strong">
                {g.grado}{' '}
                <span className="font-normal text-muted">
                  · {g.jornada === 'manana' ? 'mañana' : 'tarde'} · {g.filas.length}
                </span>
              </p>
              <ul className="mt-1">
                {g.filas.map((f) => (
                  <FilaEstudiante key={f.studentId} fila={f} nombreDe={nombreDe} />
                ))}
              </ul>
            </div>
          ))}
        </div>
      ) : (
        <ul className="mt-2">
          {filas.map((f) => (
            <FilaEstudiante key={f.studentId} fila={f} nombreDe={nombreDe} />
          ))}
        </ul>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
//  La hoja que se le entrega al proveedor
// ---------------------------------------------------------------------------

/** Como se llama cada situacion en el archivo. Es la columna que mantiene los cuatro
 *  grupos separados dentro de una sola hoja: fundirlos escondería justo el que interesa. */
const SITUACION: Record<ClaveGrupo, string> = {
  usaronSinEstarInscritos: 'Usó sin estar inscrito',
  inscritosQueUsaron: 'Inscrito que usó su servicio',
  inscritosQueUsaronOtroServicio: 'Inscrito que usó el otro servicio',
  inscritosQueNuncaUsaron: 'Inscrito que no apareció',
};

/**
 * Arma la hoja del reporte. Se construye aqui, con la forma `Hoja` de `domain/exports.ts`,
 * por la misma razon que `hojaFaltantes` en `PanelPrograma`: es la entrega a un proveedor,
 * no una transcripcion al registro oficial del colegio.
 *
 * SIN DOCUMENTO DE IDENTIDAD, ni en claro ni en hash. Son menores y para facturar una
 * comida basta el nombre, el grupo y el conteo.
 */
export function hojaReporteRestaurante(
  contraste: ContrasteRestaurante,
  nombreDe: Map<string, string>,
  ctx: { sede: Sede; desde: string; hasta: string; anio: number },
): Hoja {
  const filas: (string | number)[][] = [];
  for (const s of SECCIONES) {
    for (const f of contraste[s.clave]) {
      filas.push([
        SITUACION[s.clave],
        f.grado,
        jornadaDeGrado(f.grado) === 'manana' ? 'Mañana' : 'Tarde',
        nombreDe.get(f.studentId) ?? 'Sin nombre en la matrícula',
        f.inscritoEn ? ETIQUETA_SERVICIO[f.inscritoEn] : 'No inscrito',
        f.vasoLeche,
        f.restaurante,
        f.total,
      ]);
    }
  }

  const c = contraste.conteos;
  const notas = [
    `Sede ${ctx.sede} · del ${ctx.desde} al ${ctx.hasta}.`,
    `${c.usosTotales} comidas servidas a ${c.estudiantesQuePasaron} estudiantes distintos ` +
      `(${c.usosVasoLeche} de vaso de leche, ${c.usosRestaurante} de restaurante).`,
    'Un mismo estudiante puede pasar el mismo dia por los dos servicios: son dos comidas.',
    'Los registros anulados no se cuentan.',
    'Sin documento de identidad: son menores de edad (Ley 1581/2012).',
  ];

  if (c.inscritosTotal === 0) {
    notas.push(
      `NO hay lista oficial de inscritos cargada para ${ctx.anio} en esta sede: no hay con ` +
        'que contrastar. Todas las filas figuran como "Uso sin estar inscrito" porque no ' +
        'existe la lista que diria lo contrario, no porque se sepa que no estan inscritos.',
    );
  } else {
    notas.push(
      `Lista oficial: ${c.inscritosTotal} inscritos. ${c.inscritosQueUsaron} usaron su ` +
        `servicio, ${c.inscritosQueUsaronOtroServicio} solo el otro, ` +
        `${c.inscritosQueNuncaUsaron} no aparecieron.`,
      `${c.usaronSinEstarInscritos} estudiantes usaron el servicio sin estar inscritos.`,
    );
  }

  return {
    nombre: `Restaurante ${ctx.desde} a ${ctx.hasta}`,
    encabezados: [
      'Situación',
      'Grupo',
      'Jornada',
      'Estudiante',
      'Inscrito en',
      'Vaso de leche',
      'Restaurante',
      'Total',
    ],
    filas,
    notas,
  };
}
