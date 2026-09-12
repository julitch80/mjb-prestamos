import { useCallback, useEffect, useMemo, useState } from 'react';
import Avatar from './Avatar';
import Ayuda from './Ayuda';
import {
  entregarValoracion,
  guardarConfigValoracion,
  guardarValoracion,
  leerAutorizanCorreccion,
  leerConfigValoracion,
  leerEstadoValoracion,
  leerValoracionesDeCentro,
  reabrirValoracion,
} from './datos';
import { correoAutorAsync } from './identidad';
import { nombreCompleto, nombresDePila } from './domain/nombres';
import {
  avanceDelCentro,
  avisoDeCodigo,
  codigosDelNivel,
  MAX_CODIGOS,
  nivelDe,
  nivelesSinConfigurar,
  NIVELES,
  nuevaValoracion,
  puedeValorar,
  validarCodigosDeNivel,
} from './domain/valoracion';
import type {
  CodigoIndicador,
  ConfigValoracion,
  EstadoValoracion,
  GrupoPrograma,
  NivelValoracion,
  Programa,
  Student,
  ValoracionEstudiante,
} from './domain/types';

/** Clases por nivel. Tokens semanticos, nunca colores literales (contrato, seccion 5). */
const CLASE_NIVEL: Record<NivelValoracion, string> = {
  1: 'bg-warning-soft text-warning-soft-fg',
  2: 'bg-info-soft text-info-soft-fg',
  3: 'bg-success-soft text-success-soft-fg',
  4: 'bg-accent-soft text-accent-soft-fg',
};

/**
 * Valoracion del centro de interes — la pantalla del LIDER.
 *
 * EL PROCESO QUE REEMPLAZA (Julian, 2026-09-10): hoy cada lider llena un Drive estudiante
 * por estudiante y el director de grupo espera a que seis lideres terminen para consolidar
 * a mano y digitar en el Master. Aqui el lider valora y el director ve el resultado solo.
 *
 * Dos pasos, y el orden importa:
 *  1. CONFIGURAR los indicadores de cada nivel. Va primero porque los codigos se COPIAN a
 *     cada valoracion al ponerla: valorar sin configurar dejaria treinta registros sin
 *     indicadores que habria que rehacer uno por uno.
 *  2. VALORAR, un toque por estudiante.
 *
 * Y al final ENTREGAR. Despues de entregar el lider no escribe; solo la coordinacion
 * academica puede reabrirle, y con plazo. Ese plazo lo comprueba el servidor.
 */
export default function ValoracionCentro({
  programa,
  grupo,
  miembros,
  puedeRegistrar,
  onAbrirFicha,
}: {
  programa: Programa;
  grupo: GrupoPrograma;
  /** Los inscritos vivos, ya resueltos y en orden de lista por `PlanillaCentro`. */
  miembros: Student[];
  /** Falso para quien solo consulta: ve la valoracion, no la escribe. */
  puedeRegistrar: boolean;
  onAbrirFicha: (studentId: string) => void;
}) {
  const [config, setConfig] = useState<ConfigValoracion | null>(null);
  const [estado, setEstado] = useState<EstadoValoracion | null>(null);
  const [valoraciones, setValoraciones] = useState<ValoracionEstudiante[]>([]);
  const [autorizan, setAutorizan] = useState<string[]>([]);
  const [miCorreo, setMiCorreo] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [configurando, setConfigurando] = useState(false);
  const [eligiendo, setEligiendo] = useState<Student | null>(null);
  const [confirmandoEntrega, setConfirmandoEntrega] = useState(false);
  const [reabriendo, setReabriendo] = useState(false);

  const cargar = useCallback(async () => {
    setError(null);
    try {
      const [c, e, v, a] = await Promise.all([
        leerConfigValoracion(programa.programaId, grupo.grupoId),
        leerEstadoValoracion(programa.programaId, grupo.grupoId),
        leerValoracionesDeCentro(programa.programaId, grupo.grupoId),
        leerAutorizanCorreccion(),
      ]);
      setConfig(c);
      setEstado(e);
      setValoraciones(v);
      setAutorizan(a);
    } catch (err) {
      setError(`No fue posible cargar la valoración: ${(err as Error).message}`);
    } finally {
      setCargando(false);
    }
  }, [programa.programaId, grupo.grupoId]);

  useEffect(() => {
    void cargar();
    void correoAutorAsync().then(setMiCorreo);
  }, [cargar]);

  const porEstudiante = useMemo(
    () => new Map(valoraciones.map((v) => [v.studentId, v])),
    [valoraciones],
  );
  const avance = useMemo(
    () => avanceDelCentro(miembros.map((e) => e.studentId), valoraciones),
    [miembros, valoraciones],
  );
  const faltanNiveles = nivelesSinConfigurar(config);
  const permiso = puedeValorar(estado, Date.now());
  const puedeEscribir = puedeRegistrar && permiso.puede;
  const yoAutorizo = Boolean(miCorreo && autorizan.includes(miCorreo.toLowerCase()));

  async function poner(estudiante: Student, nivel: NivelValoracion) {
    setEligiendo(null);
    setError(null);
    try {
      const base = nuevaValoracion({
        programaId: programa.programaId,
        grupoId: grupo.grupoId,
        studentId: estudiante.studentId,
        grado: estudiante.gradoActual,
        sede: programa.sede,
        nivel,
        config,
      });
      await guardarValoracion(base, porEstudiante.get(estudiante.studentId) ?? null);
      await cargar();
    } catch (err) {
      setError(`No fue posible guardar la valoración: ${(err as Error).message}`);
    }
  }

  if (cargando) return <p className="p-3 text-sm text-muted">Cargando la valoración…</p>;

  return (
    <div className="space-y-3">
      {error && (
        <div className="rounded-xl border border-danger-soft bg-danger-soft p-3 text-sm text-danger-soft-fg">
          {error}
        </div>
      )}
      {aviso && (
        <div className="rounded-xl border border-info-soft bg-info-soft p-3 text-sm text-info-soft-fg">
          {aviso}
        </div>
      )}

      {/* ESTADO DE LA ENTREGA. Va arriba del todo: si el centro esta entregado, todo lo de
          abajo esta en solo lectura y el lider tiene que saberlo antes de intentar tocar. */}
      {estado?.entregado && (
        <div
          className={[
            'rounded-xl border p-3 text-sm',
            permiso.puede
              ? 'border-info-soft bg-info-soft text-info-soft-fg'
              : 'border-line bg-elevated text-soft',
          ].join(' ')}
        >
          {permiso.puede ? (
            <>
              <b>Reabierto para corregir.</b> Tiene plazo hasta{' '}
              {new Date(estado.reabiertoHasta ?? 0).toLocaleString('es-CO')}. Pasada esa hora,
              el sistema deja de aceptar cambios.
            </>
          ) : (
            <>
              <b>Entregado.</b> {'motivo' in permiso ? permiso.motivo : ''}
            </>
          )}
        </div>
      )}

      {/* PASO 1 — LOS INDICADORES. Bloquea el paso 2 a proposito. */}
      {faltanNiveles.length > 0 ? (
        <div className="rounded-xl border border-warning-soft bg-warning-soft p-3">
          <p className="text-sm font-semibold text-warning-soft-fg">
            Primero, los indicadores de su centro
          </p>
          <p className="mt-1 text-xs text-warning-soft-fg">
            Cada centro tiene sus propios códigos en el Máster. Falta definir los de{' '}
            {faltanNiveles.map((n) => nivelDe(n)?.label).join(', ')}. Se copian a cada
            valoración cuando la pone, así que hay que dejarlos listos antes de empezar.
          </p>
          {puedeEscribir && (
            <button
              onClick={() => setConfigurando(true)}
              className="mt-2 min-h-[36px] rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-accent-fg"
            >
              Definir los indicadores
            </button>
          )}
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-strong">
            <b>
              {avance.valorados} de {avance.total}
            </b>{' '}
            valorados
          </span>
          {avance.faltan > 0 && (
            <span className="text-xs text-muted">· faltan {avance.faltan}</span>
          )}
          <span className="grow" />
          {puedeEscribir && (
            <button
              onClick={() => setConfigurando(true)}
              className="min-h-[34px] rounded-lg border border-line px-3 py-1 text-sm text-soft"
            >
              Indicadores
            </button>
          )}
          {puedeEscribir && avance.faltan === 0 && !estado?.entregado && (
            <button
              onClick={() => setConfirmandoEntrega(true)}
              className="min-h-[34px] rounded-lg bg-accent px-3 py-1 text-sm font-medium text-accent-fg"
            >
              Entregar
            </button>
          )}
          {yoAutorizo && estado?.entregado && !permiso.puede && (
            <button
              onClick={() => setReabriendo(true)}
              className="min-h-[34px] rounded-lg border border-line px-3 py-1 text-sm text-soft"
            >
              Reabrir para corregir
            </button>
          )}
        </div>
      )}

      {/* Convenciones: los cuatro niveles con el número que se digita en el Máster. */}
      <div className="flex flex-wrap items-center gap-2">
        {NIVELES.map((n) => (
          <Ayuda
            key={n.nivel}
            texto={
              n.seDigita
                ? `En el Máster se digita ${n.nivel}.`
                : 'Por ahora no se digita en el Máster y no lleva indicadores.'
            }
          >
            <span
              className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${CLASE_NIVEL[n.nivel]}`}
            >
              <span className="font-bold">{n.nivel}</span> {n.label}
            </span>
          </Ayuda>
        ))}
      </div>

      <ul className="divide-y divide-line rounded-xl border border-line bg-card">
        {miembros.map((e) => {
          const v = porEstudiante.get(e.studentId);
          return (
            <li key={e.studentId} className="flex items-center gap-2 p-2">
              <button
                onClick={() => onAbrirFicha(e.studentId)}
                title={`Abrir la ficha de ${nombreCompleto(e)}`}
                className="flex min-w-0 grow items-center gap-2 text-left"
              >
                <Avatar estudiante={e} tamano={36} />
                <span className="min-w-0 truncate text-xs leading-tight text-strong">
                  <span className="block truncate font-semibold">{e.apellidos}</span>
                  <span className="block truncate text-muted">
                    {nombresDePila(e.apellidos, e.nombres)} · {e.gradoActual}
                  </span>
                </span>
              </button>

              <button
                onClick={() => puedeEscribir && faltanNiveles.length === 0 && setEligiendo(e)}
                disabled={!puedeEscribir || faltanNiveles.length > 0}
                className={[
                  'min-h-[36px] shrink-0 rounded-lg px-3 py-1 text-sm font-semibold disabled:opacity-60',
                  v ? CLASE_NIVEL[v.nivel] : 'border border-dashed border-line-strong text-muted',
                ].join(' ')}
              >
                {v ? (
                  <>
                    <span className="font-bold">{v.nivel}</span> {nivelDe(v.nivel)?.label}
                  </>
                ) : (
                  'Sin valorar'
                )}
              </button>
            </li>
          );
        })}
      </ul>

      {/* Los indicadores que quedaron en cada valoración, para revisar antes de entregar. */}
      {avance.valorados > 0 && faltanNiveles.length === 0 && (
        <div className="rounded-xl border border-line bg-card p-3">
          <p className="text-sm font-semibold text-strong">Indicadores de este centro</p>
          <ul className="mt-1 space-y-1">
            {NIVELES.filter((n) => n.llevaCodigos).map((n) => (
              <li key={n.nivel} className="text-xs text-soft">
                <span className={`rounded px-1 font-semibold ${CLASE_NIVEL[n.nivel]}`}>
                  {n.nivel} {n.label}
                </span>{' '}
                {codigosDelNivel(config, n.nivel)
                  .map((c) => `${c.codigo}`)
                  .join(' · ') || '—'}
              </li>
            ))}
          </ul>
        </div>
      )}

      {eligiendo && (
        <SelectorNivel
          estudiante={eligiendo}
          actual={porEstudiante.get(eligiendo.studentId)?.nivel ?? null}
          config={config}
          onElegir={(n) => void poner(eligiendo, n)}
          onCerrar={() => setEligiendo(null)}
        />
      )}

      {configurando && (
        <EditorIndicadores
          config={config}
          onGuardar={async (porNivel) => {
            setError(null);
            try {
              await guardarConfigValoracion(programa.programaId, grupo.grupoId, porNivel);
              setConfigurando(false);
              setAviso('Indicadores guardados. Ya puede valorar.');
              await cargar();
            } catch (err) {
              setError(`No fue posible guardar los indicadores: ${(err as Error).message}`);
            }
          }}
          onCerrar={() => setConfigurando(false)}
        />
      )}

      {confirmandoEntrega && (
        <Hoja titulo="Entregar este centro">
          <p className="text-sm text-soft">
            Después de entregar no podrá cambiar las valoraciones ni los indicadores. Para
            corregir algo tendrá que pedirle a coordinación que se lo reabra, y esa apertura
            va con un plazo.
          </p>
          <div className="mt-3 flex gap-2">
            <button
              onClick={async () => {
                setError(null);
                try {
                  await entregarValoracion(programa.programaId, grupo.grupoId, estado);
                  setConfirmandoEntrega(false);
                  setAviso('Centro entregado. El director de cada grupo ya lo puede ver.');
                  await cargar();
                } catch (err) {
                  setError(`No fue posible entregar: ${(err as Error).message}`);
                }
              }}
              className="min-h-[44px] flex-1 rounded-lg bg-accent px-3 py-2 text-sm font-medium text-accent-fg"
            >
              Entregar
            </button>
            <button
              onClick={() => setConfirmandoEntrega(false)}
              className="min-h-[44px] flex-1 rounded-lg border border-line px-3 py-2 text-sm text-soft"
            >
              Todavía no
            </button>
          </div>
        </Hoja>
      )}

      {reabriendo && (
        <Reapertura
          onCerrar={() => setReabriendo(false)}
          onReabrir={async (hasta) => {
            setError(null);
            try {
              await reabrirValoracion(programa.programaId, grupo.grupoId, hasta);
              setReabriendo(false);
              setAviso(`Reabierto hasta ${hasta.toLocaleString('es-CO')}.`);
              await cargar();
            } catch (err) {
              setError(`No fue posible reabrir: ${(err as Error).message}`);
            }
          }}
        />
      )}
    </div>
  );
}

/** Hoja modal, mismo patrón que el resto del módulo. */
function Hoja({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-end bg-black/40 p-0 sm:place-items-center sm:p-4">
      <div className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-t-2xl border border-line bg-card p-4 sm:rounded-2xl">
        <p className="text-sm font-semibold text-strong">{titulo}</p>
        {children}
      </div>
    </div>
  );
}

function SelectorNivel({
  estudiante,
  actual,
  config,
  onElegir,
  onCerrar,
}: {
  estudiante: Student;
  actual: NivelValoracion | null;
  config: ConfigValoracion | null;
  onElegir: (nivel: NivelValoracion) => void;
  onCerrar: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-end bg-black/40 p-0 sm:place-items-center sm:p-4"
      onClick={onCerrar}
    >
      <div
        className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-t-2xl border border-line bg-card p-4 sm:rounded-2xl"
        onClick={(ev) => ev.stopPropagation()}
      >
        <div className="flex items-center gap-2">
          <Avatar estudiante={estudiante} tamano={44} />
          <span className="min-w-0">
            <b className="block truncate text-sm text-strong">{nombreCompleto(estudiante)}</b>
            <span className="text-xs text-muted">{estudiante.gradoActual}</span>
          </span>
        </div>

        <div className="mt-3 space-y-2">
          {NIVELES.map((n) => {
            const codigos = codigosDelNivel(config, n.nivel);
            return (
              <button
                key={n.nivel}
                onClick={() => onElegir(n.nivel)}
                className={[
                  'flex w-full items-start gap-2 rounded-lg border p-2 text-left',
                  actual === n.nivel ? 'border-line-strong' : 'border-line',
                ].join(' ')}
              >
                <span
                  className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg text-sm font-bold ${CLASE_NIVEL[n.nivel]}`}
                >
                  {n.nivel}
                </span>
                <span className="min-w-0 grow">
                  <span className="block text-sm font-semibold text-strong">{n.label}</span>
                  {/* Lo que de verdad va a quedar registrado, antes de tocar. */}
                  <span className="block text-xs text-muted">
                    {n.llevaCodigos
                      ? codigos.length > 0
                        ? codigos.map((c) => `${c.codigo} ${c.texto}`).join(' · ')
                        : 'Sin indicadores definidos'
                      : 'No se digita en el Máster y no lleva indicadores.'}
                  </span>
                </span>
              </button>
            );
          })}
        </div>

        <button
          onClick={onCerrar}
          className="mt-3 w-full rounded-lg border border-line p-2 text-sm text-soft"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}

/**
 * Los indicadores de cada nivel.
 *
 * Se escriben a mano mientras no exista el documento con los indicadores de los 21 centros.
 * Cuando ese documento llegue, la carga masiva escribe exactamente este mismo `porNivel` y
 * esta pantalla sigue sirviendo para revisarlo y corregirlo.
 */
function EditorIndicadores({
  config,
  onGuardar,
  onCerrar,
}: {
  config: ConfigValoracion | null;
  onGuardar: (porNivel: ConfigValoracion['porNivel']) => void;
  onCerrar: () => void;
}) {
  const [porNivel, setPorNivel] = useState<ConfigValoracion['porNivel']>(() => ({
    '2': config?.porNivel?.['2'] ?? [],
    '3': config?.porNivel?.['3'] ?? [],
    '4': config?.porNivel?.['4'] ?? [],
  }));
  const [fallo, setFallo] = useState<string | null>(null);

  function cambiar(nivel: '2' | '3' | '4', lista: CodigoIndicador[]) {
    setPorNivel((p) => ({ ...p, [nivel]: lista }));
    setFallo(null);
  }

  function guardar() {
    for (const n of ['2', '3', '4'] as const) {
      const problema = validarCodigosDeNivel(porNivel[n]);
      if (problema) {
        setFallo(`${nivelDe(Number(n) as NivelValoracion)?.label}: ${problema}`);
        return;
      }
    }
    onGuardar(porNivel);
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-end bg-black/40 p-0 sm:place-items-center sm:p-4">
      <div className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-t-2xl border border-line bg-card p-4 sm:rounded-2xl">
        <p className="text-sm font-semibold text-strong">Indicadores de este centro</p>
        <p className="mt-0.5 text-xs text-muted">
          Los códigos que le corresponden a su centro en el Máster, con su texto. Van de uno
          a {MAX_CODIGOS} por nivel: son las columnas C1 a C{MAX_CODIGOS}.
        </p>

        {(['2', '3', '4'] as const).map((n) => (
          <NivelEditor
            key={n}
            nivel={Number(n) as NivelValoracion}
            codigos={porNivel[n]}
            onCambiar={(lista) => cambiar(n, lista)}
          />
        ))}

        {fallo && <p className="mt-2 text-xs text-danger-soft-fg">{fallo}</p>}

        <div className="mt-3 flex gap-2">
          <button
            onClick={guardar}
            className="min-h-[44px] flex-1 rounded-lg bg-accent px-3 py-2 text-sm font-medium text-accent-fg"
          >
            Guardar
          </button>
          <button
            onClick={onCerrar}
            className="min-h-[44px] flex-1 rounded-lg border border-line px-3 py-2 text-sm text-soft"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}

function NivelEditor({
  nivel,
  codigos,
  onCambiar,
}: {
  nivel: NivelValoracion;
  codigos: CodigoIndicador[];
  onCambiar: (lista: CodigoIndicador[]) => void;
}) {
  const [numero, setNumero] = useState('');
  const [texto, setTexto] = useState('');
  const aviso = numero.trim() ? avisoDeCodigo(Number(numero)) : null;

  return (
    <div className="mt-3 rounded-lg border border-line p-2">
      <span className={`rounded px-1.5 py-0.5 text-xs font-semibold ${CLASE_NIVEL[nivel]}`}>
        {nivel} {nivelDe(nivel)?.label}
      </span>

      <ul className="mt-1.5 space-y-1">
        {codigos.map((c) => (
          <li key={c.codigo} className="flex items-start gap-2 text-xs">
            <b className="shrink-0 text-strong">{c.codigo}</b>
            <span className="min-w-0 grow text-soft">{c.texto}</span>
            <button
              onClick={() => onCambiar(codigos.filter((x) => x.codigo !== c.codigo))}
              className="shrink-0 text-muted underline"
            >
              quitar
            </button>
          </li>
        ))}
        {codigos.length === 0 && (
          <li className="text-xs text-muted">Todavía sin indicadores.</li>
        )}
      </ul>

      {codigos.length < MAX_CODIGOS && (
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          <input
            value={numero}
            onChange={(ev) => setNumero(ev.target.value.replace(/\D/g, '').slice(0, 3))}
            inputMode="numeric"
            placeholder="610"
            className="w-16 rounded-lg border border-line bg-elevated p-1.5 text-sm text-strong"
          />
          <input
            value={texto}
            onChange={(ev) => setTexto(ev.target.value)}
            placeholder="Texto del indicador, como está en el Máster"
            className="min-w-[10rem] grow rounded-lg border border-line bg-elevated p-1.5 text-sm text-strong"
          />
          <button
            onClick={() => {
              const n = Number(numero);
              if (!numero.trim() || !texto.trim()) return;
              onCambiar([...codigos, { codigo: n, texto: texto.trim() }]);
              setNumero('');
              setTexto('');
            }}
            className="min-h-[34px] rounded-lg border border-line px-3 text-sm text-strong"
          >
            Añadir
          </button>
        </div>
      )}
      {/* AVISA Y NO BLOQUEA: el rango no está confirmado (Julián, 2026-09-11). */}
      {aviso && <p className="mt-1 text-xs text-warning-soft-fg">{aviso}</p>}
    </div>
  );
}

function Reapertura({
  onReabrir,
  onCerrar,
}: {
  onReabrir: (hasta: Date) => void;
  onCerrar: () => void;
}) {
  /** Por omisión, hasta mañana a esta hora: lo típico es "corrija hoy y mañana". */
  const [valor, setValor] = useState(() => {
    const d = new Date(Date.now() + 86400000);
    d.setSeconds(0, 0);
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  });

  return (
    <Hoja titulo="Reabrir para corregir">
      <p className="mt-1 text-xs text-muted">
        El líder podrá cambiar valoraciones e indicadores hasta la fecha y hora que ponga
        aquí. Pasado ese momento, el servidor vuelve a rechazar los cambios solo.
      </p>
      <input
        type="datetime-local"
        value={valor}
        onChange={(ev) => setValor(ev.target.value)}
        className="mt-2 w-full rounded-lg border border-line bg-elevated p-2 text-sm text-strong"
      />
      <div className="mt-3 flex gap-2">
        <button
          onClick={() => onReabrir(new Date(valor))}
          className="min-h-[44px] flex-1 rounded-lg bg-accent px-3 py-2 text-sm font-medium text-accent-fg"
        >
          Reabrir
        </button>
        <button
          onClick={onCerrar}
          className="min-h-[44px] flex-1 rounded-lg border border-line px-3 py-2 text-sm text-soft"
        >
          Cancelar
        </button>
      </div>
    </Hoja>
  );
}
