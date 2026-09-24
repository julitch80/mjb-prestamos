import { useCallback, useEffect, useMemo, useState } from 'react';
import { MessageSquare } from 'lucide-react';
import {
  crearAvisosInasistencia,
  leerAvisosDelDia,
  marcarEnvioAviso,
  registrarContacto,
  type ResultadoAviso,
} from './datos';
import {
  candidatosParaAviso,
  ETIQUETA_EXCLUSION,
  ETIQUETA_HABLAR,
  estadoVisible,
  MOTIVO_HABLAR,
  VIGENCIA_AVISO_HORAS,
  type AvisoInasistencia,
  type EstadoVisible,
} from './domain/avisos';
import { etiquetaDeMotivo, type MotivoFamilia, type PrioridadLlamada } from './domain/permanencia';
import type { FilaAusente } from './domain/reports';
import { enlaceSms, formatearTelefono } from './domain/telefonos';
import type { ContactResult, Jornada } from './domain/types';

/**
 * Avisos por mensaje de texto, dentro de la tercera hora (2026-09-23). Ver
 * `domain/avisos.ts` para las decisiones.
 *
 * LA COLA. Coordinacion oprime «Preparar», el servidor arma un aviso por estudiante (con
 * su enlace unico) y aqui se abren uno tras otro: cada toque en «Enviar» abre la
 * aplicacion de mensajes del celular con el numero y el texto puestos, y al volver ya
 * esta el siguiente. Unos cinco segundos por mensaje.
 *
 * LO QUE QUEDA REGISTRADO al tocar «Enviar» es lo que coordinacion DECLARA, con su nombre
 * y la hora del servidor. Que el mensaje de verdad salio lo dice el celular, con sus
 * informes de entrega; la aplicacion no lo puede saber. Por eso existe «No salió».
 *
 * LA RESPUESTA ES UNA PISTA. Lo que escoge la familia se muestra aqui, pero no entra al
 * registro de contactos hasta que coordinacion lo valida con un toque, a su nombre.
 */
export default function AvisosPorMensaje({
  sede,
  fecha,
  jornada,
  filas,
  conContactoHoy,
  avisosRegistrados,
  motivos,
  prioridades,
  onContactoRegistrado,
}: {
  sede: string;
  fecha: string;
  jornada: Jornada;
  /** «No ingresaron» del reporte de tercera hora. */
  filas: FilaAusente[];
  /** Estudiantes con un contacto con la familia ya registrado ese dia. */
  conContactoHoy: Set<string>;
  /** Avisos cuya respuesta ya se convirtio en contacto (por `FamilyContact.avisoId`). */
  avisosRegistrados: Set<string>;
  motivos: MotivoFamilia[];
  prioridades: Map<string, PrioridadLlamada>;
  onContactoRegistrado: (studentId: string, resultado: ContactResult) => void;
}) {
  const [avisos, setAvisos] = useState<AvisoInasistencia[]>([]);
  const [cola, setCola] = useState<Extract<ResultadoAviso, { avisoId: string }>[] | null>(null);
  const [indice, setIndice] = useState(0);
  const [preparando, setPreparando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nota, setNota] = useState<string | null>(null);
  const [registrando, setRegistrando] = useState<AvisoInasistencia | null>(null);
  const [registradosAqui, setRegistradosAqui] = useState<Set<string>>(new Set());

  const cargar = useCallback(async () => {
    try {
      const todos = await leerAvisosDelDia(sede, fecha);
      setAvisos(todos.filter((a) => a.jornada === jornada));
    } catch (e) {
      setError(`No fue posible leer los avisos: ${(e as Error).message}`);
    }
  }, [sede, fecha, jornada]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const nombres = useMemo(() => new Map(filas.map((f) => [f.studentId, f.nombreCompleto])), [filas]);
  const { candidatos, excluidos } = useMemo(
    () => candidatosParaAviso(filas, { conContactoHoy, conAviso: new Set(avisos.map((a) => a.studentId)) }),
    [filas, conContactoHoy, avisos],
  );
  const sinCelular = excluidos.filter((x) => x.razon === 'sin_celular').length;
  const preparadosSinEnviar = avisos.filter((a) => a.estado === 'creado');

  async function preparar(studentIds: string[]) {
    setPreparando(true);
    setError(null);
    setNota(null);
    try {
      const resultados = await crearAvisosInasistencia({ sede, fecha, jornada, studentIds });
      const listos = resultados.filter((r): r is Extract<ResultadoAviso, { avisoId: string }> => 'avisoId' in r);
      const rechazados = resultados.length - listos.length;
      if (rechazados > 0) {
        setNota(
          `${rechazados} no se prepararon: al revisarlos en el servidor ya no correspondía avisar ` +
            '(llegó tarde, se justificó la ausencia o cambió la ficha).',
        );
      }
      setCola(listos);
      setIndice(0);
      await cargar();
    } catch (e) {
      setError(`No fue posible preparar los avisos: ${(e as Error).message}`);
    } finally {
      setPreparando(false);
    }
  }

  function siguiente() {
    // Un momento de espera para que el celular alcance a abrir la aplicacion de mensajes
    // antes de que la pantalla cambie de estudiante.
    setTimeout(() => setIndice((i) => i + 1), 400);
  }

  function marcar(avisoId: string, evento: 'enviado' | 'no_salio') {
    void marcarEnvioAviso(avisoId, evento).catch((e) =>
      setError(`No quedó registrado el envío de un aviso: ${(e as Error).message}`),
    );
  }

  async function terminarCola() {
    setCola(null);
    setIndice(0);
    await cargar();
  }

  async function registrar(a: AvisoInasistencia) {
    if (!a.respuesta) return;
    try {
      await registrarContacto({
        studentId: a.studentId,
        grado: a.grado,
        sede: a.sede,
        fecha: a.fecha,
        motivoContacto: 'inasistencia_dia',
        telefonoUsado: a.telefono,
        resultado: 'contesto',
        motivoFamilia: a.respuesta.motivoId,
        // No se sabe quien tenia el celular: se deja vacio antes que suponer.
        personaContactada: null,
        observacion: 'Respondió el aviso por mensaje de texto (enlace).',
        medio: 'mensaje',
        avisoId: a.avisoId,
      });
      setRegistradosAqui((s) => new Set(s).add(a.avisoId));
      onContactoRegistrado(a.studentId, 'contesto');
      setRegistrando(null);
    } catch (e) {
      setError(`No fue posible registrar el contacto: ${(e as Error).message}`);
    }
  }

  const actual = cola && indice < cola.length ? cola[indice] : null;
  const sms = actual ? enlaceSms(actual.telefono, actual.texto) : null;
  const ahora = Date.now();

  return (
    <section className="rounded-xl border border-line bg-card p-3">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-strong">
        <MessageSquare size={16} aria-hidden /> Avisos por mensaje de texto
      </h3>
      <p className="mt-1 text-xs text-muted">
        Cada mensaje sale desde el celular de coordinación con un enlace para que el acudiente
        informe el motivo. El enlace vence a las {VIGENCIA_AVISO_HORAS} horas; sin respuesta,
        el estudiante pasa a llamada.
      </p>

      {error && (
        <p className="mt-2 rounded-lg border border-danger-soft bg-danger-soft p-2 text-xs text-danger-soft-fg">{error}</p>
      )}
      {nota && <p className="mt-2 rounded-lg border border-line bg-elevated p-2 text-xs text-soft">{nota}</p>}

      {/* ---------- La cola ---------- */}
      {cola ? (
        actual ? (
          <div className="mt-3 rounded-lg border border-accent bg-accent-soft p-3">
            <p className="text-xs text-muted">
              {indice + 1} de {cola.length}
            </p>
            <p className="mt-1 text-sm">
              <b className="text-strong">{nombres.get(actual.studentId) ?? actual.studentId}</b>
            </p>
            <p className="font-mono text-base tabular-nums text-strong">{formatearTelefono(actual.telefono)}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {sms ? (
                <a
                  href={sms}
                  onClick={() => {
                    marcar(actual.avisoId, 'enviado');
                    siguiente();
                  }}
                  className="flex min-h-11 items-center gap-2 rounded-lg bg-accent px-4 text-sm font-semibold text-on-accent"
                >
                  <MessageSquare size={16} aria-hidden /> Enviar mensaje
                </a>
              ) : (
                <span className="text-xs text-danger-soft-fg">Este número no recibe mensajes.</span>
              )}
              <button
                onClick={() => {
                  marcar(actual.avisoId, 'no_salio');
                  siguiente();
                }}
                className="min-h-11 rounded-lg border border-line px-3 text-sm text-strong"
              >
                No salió
              </button>
              <button onClick={() => void terminarCola()} className="min-h-11 px-2 text-xs text-muted">
                Terminar aquí
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-3 rounded-lg border border-line bg-elevated p-3 text-sm text-strong">
            Listo: se recorrieron los {cola.length} avisos.{' '}
            <button onClick={() => void terminarCola()} className="underline">
              Cerrar
            </button>
          </div>
        )
      ) : (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {preparadosSinEnviar.length > 0 && (
            <button
              disabled={preparando}
              onClick={() => void preparar(preparadosSinEnviar.map((a) => a.studentId))}
              className="rounded-lg border border-line px-3 py-1.5 text-sm text-strong disabled:opacity-50"
            >
              Continuar con {preparadosSinEnviar.length} preparado(s) sin enviar
            </button>
          )}
          {candidatos.length > 0 ? (
            <button
              disabled={preparando}
              onClick={() => void preparar(candidatos.map((c) => c.fila.studentId))}
              className="rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-on-accent disabled:opacity-50"
            >
              {preparando ? 'Preparando…' : `Preparar y enviar ${candidatos.length} aviso(s)`}
            </button>
          ) : (
            preparadosSinEnviar.length === 0 && <span className="text-xs text-muted">No hay avisos por enviar.</span>
          )}
          {sinCelular > 0 && (
            <span className="text-xs text-muted">
              {sinCelular} {ETIQUETA_EXCLUSION.sin_celular}.
            </span>
          )}
        </div>
      )}

      {/* ---------- El estado de cada aviso del dia ---------- */}
      {avisos.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {[...avisos]
            .sort((a, b) => a.grado.localeCompare(b.grado) || (nombres.get(a.studentId) ?? '').localeCompare(nombres.get(b.studentId) ?? ''))
            .map((a) => {
              const registrado = avisosRegistrados.has(a.avisoId) || registradosAqui.has(a.avisoId);
              const estado = estadoVisible(a, ahora, registrado);
              return (
                <li key={a.avisoId} className="rounded-lg border border-line p-2 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <b className="text-strong">{nombres.get(a.studentId) ?? a.primerNombre}</b>
                    <span className="text-xs text-muted">{a.grado}</span>
                    <span className="grow" />
                    <ChipEstado estado={estado} aviso={a} motivos={motivos} />
                  </div>
                  {estado === 'respondido' && (
                    registrando?.avisoId === a.avisoId ? (
                      <ConfirmarRegistro
                        aviso={a}
                        motivos={motivos}
                        prioridad={prioridades.get(a.studentId)}
                        onConfirmar={() => void registrar(a)}
                        onCancelar={() => setRegistrando(null)}
                      />
                    ) : (
                      <button onClick={() => setRegistrando(a)} className="mt-1 text-xs text-strong underline">
                        Registrar como contacto
                      </button>
                    )
                  )}
                </li>
              );
            })}
        </ul>
      )}
    </section>
  );
}

const HORA = (ms: number | null | undefined) =>
  ms ? new Date(ms).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }) : '';

function ChipEstado({
  estado,
  aviso,
  motivos,
}: {
  estado: EstadoVisible;
  aviso: AvisoInasistencia;
  motivos: MotivoFamilia[];
}) {
  const clase = (tono: 'ok' | 'aviso' | 'peligro' | 'neutro') =>
    ({
      ok: 'bg-success-soft text-success-soft-fg',
      aviso: 'bg-warning-soft text-warning-soft-fg',
      peligro: 'bg-danger-soft text-danger-soft-fg',
      neutro: 'bg-elevated text-soft',
    })[tono] + ' rounded-full px-2 py-0.5 text-xs';

  const motivo = aviso.respuesta
    ? aviso.respuesta.motivoId === MOTIVO_HABLAR
      ? ETIQUETA_HABLAR
      : etiquetaDeMotivo(motivos, aviso.respuesta.motivoId)
    : '';

  switch (estado) {
    case 'por_enviar':
      return <span className={clase('neutro')}>Preparado, sin enviar</span>;
    case 'enviado':
      return <span className={clase('neutro')}>Enviado {HORA(aviso.enviadoEnMs)} · sin respuesta</span>;
    case 'respondido':
      return <span className={clase('aviso')}>Respondió: {motivo} (sin validar)</span>;
    case 'registrado':
      return <span className={clase('ok')}>Registrado: {motivo}</span>;
    case 'pide_llamada':
      return <span className={clase('peligro')}>Pidió hablar con coordinación: llamar</span>;
    case 'no_salio':
      return <span className={clase('peligro')}>No salió: llamar</span>;
    case 'vencido':
      return <span className={clase('peligro')}>Venció sin respuesta: llamar</span>;
  }
}

/**
 * Antes de convertir la respuesta en contacto. Si el estudiante esta marcado «Llamar
 * primero» —caso abierto, factor de riesgo, varios dias sin venir—, se dice aqui: una
 * respuesta por enlace no deberia apagar sola esa alarma, y registrarla cambiaria la
 * causa vigente. La decision es de coordinacion.
 */
function ConfirmarRegistro({
  aviso,
  motivos,
  prioridad,
  onConfirmar,
  onCancelar,
}: {
  aviso: AvisoInasistencia;
  motivos: MotivoFamilia[];
  prioridad: PrioridadLlamada | undefined;
  onConfirmar: () => void;
  onCancelar: () => void;
}) {
  const motivo = aviso.respuesta ? etiquetaDeMotivo(motivos, aviso.respuesta.motivoId) : '';
  return (
    <div className="mt-2 rounded-lg border border-line bg-elevated p-2 text-xs">
      <p className="text-strong">
        Se registrará como contacto con la familia, a su nombre: «{motivo}», respondido por
        mensaje al {formatearTelefono(aviso.telefono)}.
      </p>
      {prioridad?.llamar && (
        <div className="mt-2 rounded-lg border border-danger-soft bg-danger-soft p-2 text-danger-soft-fg">
          <b>Este estudiante está marcado «Llamar primero»:</b>
          <ul className="list-disc pl-4">
            {prioridad.motivos.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
          Registrar esta respuesta cambia la causa vigente. Si hay duda, mejor llamar.
        </div>
      )}
      <div className="mt-2 flex gap-2">
        <button onClick={onConfirmar} className="rounded-lg bg-accent px-3 py-1 font-semibold text-on-accent">
          Registrar
        </button>
        <button onClick={onCancelar} className="rounded-lg border border-line px-3 py-1 text-strong">
          Cancelar
        </button>
      </div>
    </div>
  );
}
