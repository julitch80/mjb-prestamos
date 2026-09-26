import { useEffect, useMemo, useState } from 'react';
import { MessageSquare } from 'lucide-react';
import { leerAvisosDeTope, leerEstudiante, registrarContacto } from './datos';
import { nombreCompleto } from './domain/nombres';
import { primerCelular } from './domain/avisos';
import { enlaceSms, formatearTelefono } from './domain/telefonos';
import {
  describirCuenta,
  pasoLlegadasTarde,
  type ColorAlerta,
  type CuentaLlegadas,
} from './domain/alertas';
import {
  diasParaVencer,
  mensajeTopeLlegadas,
  type Ventana,
} from './domain/llegadas-seguimiento';
import { gradoEnJornada, type FiltroJornada } from './domain/filtro-jornada';
import type { AlertConfig, FamilyContact, LateArrival, Student } from './domain/types';

/**
 * Lo que viene DESPUES de registrar (Julián, 2026-09-25): quienes superaron un tope y
 * falta avisarle a la familia, y las llegadas «pendientes de verificación» con su plazo.
 * Antes el semaforo solo se veia cuando el estudiante volvia a llegar tarde y alguien lo
 * buscaba: el rojo no generaba ninguna tarea.
 */

/** Fichas de varios estudiantes, para nombre y telefonos. Se piden solo las que faltan. */
export function useFichas(ids: string[]): Record<string, Student> {
  const [fichas, setFichas] = useState<Record<string, Student>>({});
  const clave = [...new Set(ids)].sort().join('|');
  useEffect(() => {
    const faltan = clave ? clave.split('|').filter((id) => !fichas[id]) : [];
    if (faltan.length === 0) return;
    let vivo = true;
    void Promise.all(faltan.map((id) => leerEstudiante(id).catch(() => null))).then((r) => {
      if (!vivo) return;
      setFichas((f) => {
        const n = { ...f };
        r.forEach((e) => {
          if (e) n[e.studentId] = e;
        });
        return n;
      });
    });
    return () => {
      vivo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clave]);
  return fichas;
}

/**
 * El boton de mensaje a la familia, desde el celular de coordinacion. El telefono abre la
 * aplicacion de mensajes con el texto listo; la aplicacion NO puede saber si se envio, asi
 * que al volver pregunta, y solo con el «Sí» queda registrado a nombre de quien lo envio.
 */
export function BotonAvisoSms({
  estudiante,
  texto,
  enviado,
  onEnviado,
  etiqueta = 'Avisar',
}: {
  estudiante: Student | undefined;
  texto: string;
  /** Si ya hay aviso registrado: se muestra en vez del boton. */
  enviado: FamilyContact | undefined;
  /** Registra el aviso (lo hace quien usa el boton, con su motivo). */
  onEnviado: (telefono: string) => Promise<void>;
  etiqueta?: string;
}) {
  const [preguntando, setPreguntando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (enviado) {
    return (
      <span className="rounded-full bg-success-soft px-2 py-0.5 text-xs text-success-soft-fg" title={enviado.observacion}>
        Mensaje enviado
      </span>
    );
  }
  const telefono = estudiante ? primerCelular(estudiante.telefonos ?? []) : null;
  if (!estudiante) return null;
  if (!telefono) {
    return <span className="text-xs text-muted">Sin celular en la ficha</span>;
  }
  const enlace = enlaceSms(telefono, texto);

  if (preguntando) {
    return (
      <span className="flex flex-wrap items-center gap-1 text-xs">
        <span className="text-strong">¿Lo envió?</span>
        <button
          disabled={guardando}
          onClick={async () => {
            setGuardando(true);
            setError(null);
            try {
              await onEnviado(telefono);
              setPreguntando(false);
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setGuardando(false);
            }
          }}
          className="rounded-lg bg-accent px-2 py-1 font-medium text-accent-fg disabled:opacity-60"
        >
          Sí
        </button>
        <button onClick={() => setPreguntando(false)} className="rounded-lg border border-line px-2 py-1 text-soft">
          No
        </button>
        {error && <span className="text-danger">{error}</span>}
      </span>
    );
  }

  return (
    <a
      href={enlace ?? undefined}
      onClick={() => setPreguntando(true)}
      title={`${formatearTelefono(telefono)}: «${texto}»`}
      className="flex items-center gap-1 rounded-lg border border-line px-2 py-1 text-xs text-strong"
    >
      <MessageSquare size={14} aria-hidden /> {etiqueta}
    </a>
  );
}

export default function SeguimientoLlegadas({
  sede,
  hoy,
  filtro,
  anuales,
  cuentas,
  ventana,
  config,
  estiloAlerta,
  onJustificar,
}: {
  sede: string;
  hoy: string;
  filtro: FiltroJornada;
  /** Todas las llegadas del año (el lapso se aplica aqui y en `cuentas`). */
  anuales: LateArrival[];
  /** Cuenta por estudiante YA dentro del lapso y con las pendientes vencidas. */
  cuentas: Record<string, CuentaLlegadas>;
  ventana: Ventana;
  config: AlertConfig;
  estiloAlerta: (c: ColorAlerta) => React.CSSProperties;
  onJustificar: (l: LateArrival) => void;
}) {
  const diasVence = config.diasVencePendiente ?? 8;

  // El grado de cada estudiante sale de su ultima llegada: basta para filtrar por jornada.
  const gradoDe = useMemo(() => {
    const m: Record<string, string> = {};
    for (const l of [...anuales].sort((a, b) => a.fecha.localeCompare(b.fecha))) m[l.studentId] = l.grado;
    return m;
  }, [anuales]);

  const conTope = useMemo(
    () =>
      Object.entries(cuentas)
        .map(([studentId, cuenta]) => ({ studentId, cuenta, paso: pasoLlegadasTarde(cuenta, config) }))
        .filter((x) => x.paso && gradoEnJornada(gradoDe[x.studentId] ?? '', filtro))
        .sort((a, b) => b.cuenta.puntos - a.cuenta.puntos),
    [cuentas, config, gradoDe, filtro],
  );

  const pendientes = useMemo(
    () =>
      anuales
        .filter((l) => l.estado === 'pendiente_verificacion' && gradoEnJornada(l.grado, filtro))
        .sort((a, b) => a.fecha.localeCompare(b.fecha)),
    [anuales, filtro],
  );

  const fichas = useFichas([...conTope.map((x) => x.studentId), ...pendientes.map((l) => l.studentId)]);
  const nombreDe = (id: string) => (fichas[id] ? nombreCompleto(fichas[id]) : '…');

  // Avisos de tope ya enviados en el lapso: uno por estudiante y color.
  const [avisosTope, setAvisosTope] = useState<FamilyContact[]>([]);
  const cargarAvisos = async () => {
    try {
      setAvisosTope(await leerAvisosDeTope(sede, ventana.desde, ventana.hasta));
    } catch {
      setAvisosTope([]);
    }
  };
  useEffect(() => {
    void cargarAvisos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sede, ventana.desde, ventana.hasta]);
  const avisoDe = (studentId: string, color: ColorAlerta) =>
    avisosTope.find((c) => c.studentId === studentId && c.tope === color);

  return (
    <>
      <section className="rounded-xl border border-line bg-card p-3">
        <h3 className="text-sm font-semibold text-strong">
          Superaron un tope {ventana.nombre} <span className="text-muted">({conTope.length})</span>
        </h3>
        <p className="text-xs text-muted">
          Del {ventana.desde} al {ventana.hasta}. Cada color se le avisa a la familia una vez, con
          un mensaje distinto al de cada llegada. Las de 2º nivel cuentan doble.
        </p>
        {ventana.sinPeriodos && (
          <p className="mt-1 rounded-lg bg-warning-soft p-2 text-xs text-warning-soft-fg">
            Está configurado para contar por periodo, pero no hay fechas de inicio de los periodos
            de este año: se está contando el año entero. Escríbalas en «Ajustar alertas».
          </p>
        )}
        {conTope.length === 0 ? (
          <p className="mt-2 text-sm text-muted">Nadie ha superado el tope.</p>
        ) : (
          <ul className="mt-2 space-y-1">
            {conTope.map(({ studentId, cuenta, paso }) => (
              <li key={studentId} className="flex flex-wrap items-center gap-2 rounded-lg border border-line p-2 text-sm">
                <span className="grow">
                  <b className="text-strong">{nombreDe(studentId)}</b>
                  <span className="ml-2 text-xs text-muted">{gradoDe[studentId]}</span>
                  <span className="block text-xs text-muted">{describirCuenta(cuenta)}</span>
                </span>
                <span
                  className="rounded-full border px-1.5 py-0.5 text-[0.65rem] font-semibold"
                  style={estiloAlerta(paso!.color)}
                >
                  {paso!.color}
                </span>
                <BotonAvisoSms
                  estudiante={fichas[studentId]}
                  etiqueta="Avisar tope"
                  texto={mensajeTopeLlegadas(nombreDe(studentId), cuenta.llegadas, ventana.nombre)}
                  enviado={avisoDe(studentId, paso!.color)}
                  onEnviado={async (telefono) => {
                    await registrarContacto({
                      studentId,
                      grado: gradoDe[studentId] ?? '',
                      sede,
                      fecha: hoy,
                      motivoContacto: 'umbral_llegadas_tarde',
                      telefonoUsado: telefono,
                      resultado: 'pendiente',
                      medio: 'mensaje',
                      tope: paso!.color,
                      observacion: mensajeTopeLlegadas(nombreDe(studentId), cuenta.llegadas, ventana.nombre),
                    });
                    await cargarAvisos();
                  }}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      {pendientes.length > 0 && (
        <section className="rounded-xl border border-line bg-card p-3">
          <h3 className="text-sm font-semibold text-strong">
            Pendientes de verificar con la familia <span className="text-muted">({pendientes.length})</span>
          </h3>
          <p className="text-xs text-muted">
            Dijo traer excusa y no la trajo. Si en {diasVence} días no se resuelve, cuenta como sin
            justificar.
          </p>
          <ul className="mt-2 space-y-1">
            {pendientes.map((l) => {
              const quedan = diasParaVencer(l, hoy, diasVence);
              return (
                <li key={l.lateArrivalId} className="flex flex-wrap items-center gap-2 rounded-lg border border-line p-2 text-sm">
                  <span className="grow">
                    <b className="text-strong">{nombreDe(l.studentId)}</b>
                    <span className="ml-2 text-xs text-muted">
                      {l.grado} · {l.fecha}
                    </span>
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs ${
                      quedan <= 0 ? 'bg-danger-soft text-danger-soft-fg' : 'bg-warning-soft text-warning-soft-fg'
                    }`}
                  >
                    {quedan <= 0
                      ? 'vencida: ya cuenta'
                      : `vence en ${quedan} día${quedan === 1 ? '' : 's'}`}
                  </span>
                  <button
                    onClick={() => onJustificar(l)}
                    className="rounded-lg border border-line px-2 py-1 text-xs text-strong"
                  >
                    Resolver
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </>
  );
}
