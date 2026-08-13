import { useCallback, useEffect, useState } from 'react';
import {
  buscarEstudiantes,
  buscarPorQrToken,
  ConflictoError,
  guardarConfigAlertas,
  leerConfigAlertas,
  leerEstudiante,
  leerLlegadasTarde,
  leerSesiones,
  registrarLlegadaTarde,
  resolverLlegadaTarde,
} from './datos';
import EscanerQr from './EscanerQr';
import VerificacionFoto from './VerificacionFoto';
import { addDays, jornadaDeGrado, toDateKey } from './domain/ids';
import { bloqueDeHora } from './domain/bloques';
import { nombreCompleto } from './domain/nombres';
import { EXCUSE_REASONS, LATE_ARRIVAL_STATES, type ExcuseReason } from './domain/marks';
import {
  ALERT_CONFIG_POR_DEFECTO,
  activaAlertaDiasSinAsistir,
  diasSinAsistirConsecutivos,
  llegadasQueAlertan,
  pasoLlegadasTarde,
  type ColorAlerta,
} from './domain/alertas';
import type { AlertConfig, LateArrival, Student } from './domain/types';
import { BLOQUES_MANANA, BLOQUES_TARDE } from '../data/maestros';

/** Colores de la escala de reincidencia. Via `style`, no clase: son tres tonos fijos de
 * severidad, no un token de la app (mismo patron que domain/colores.ts usa para el color
 * de grupo). */
const COLOR_ALERTA: Record<ColorAlerta, string> = {
  amarillo: '#eab308',
  naranja: '#f97316',
  rojo: '#b91c1c',
};

function estiloAlerta(color: ColorAlerta): React.CSSProperties {
  const hex = COLOR_ALERTA[color];
  return {
    color: hex,
    backgroundColor: `color-mix(in srgb, ${hex} 16%, transparent)`,
    borderColor: `color-mix(in srgb, ${hex} 50%, transparent)`,
  };
}

/**
 * Llegadas tarde a la institucion — pantalla de porteria del coordinador.
 *
 * NO es el `retraso` de clase: otro fenomeno, otra autoridad, otra unidad temporal. El
 * retraso lo pone el docente dentro del llamado a lista; esto lo registra
 * exclusivamente coordinacion en la entrada del colegio.
 *
 * Pensada para usarse de pie, con el telefono en una mano y diez segundos por
 * estudiante: buscar, tocar, listo. Por eso el buscador esta arriba y el registro es un
 * solo toque, sin formulario.
 *
 * El estado `pendiente_verificacion` existe porque el estudiante suele decir que tiene
 * excusa pero no la trae. Sin ese estado, el coordinador tendria que elegir entre
 * marcarla injustificada —disparando una alerta que quiza no corresponde— o no
 * registrar el hecho.
 */
export default function LlegadasTarde({ sede }: { sede: string }) {
  const [fecha, setFecha] = useState(toDateKey(new Date()));
  const [busqueda, setBusqueda] = useState('');
  const [candidatos, setCandidatos] = useState<Student[]>([]);
  const [registros, setRegistros] = useState<LateArrival[]>([]);
  const [nombres, setNombres] = useState<Record<string, string>>({});
  const [aviso, setAviso] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [escaneando, setEscaneando] = useState(false);

  // Umbrales de alerta: institucionales, cualquier cuenta activa los puede leer.
  const [config, setConfig] = useState<AlertConfig>(ALERT_CONFIG_POR_DEFECTO);
  const [ajustandoConfig, setAjustandoConfig] = useState(false);
  useEffect(() => {
    void leerConfigAlertas().then(setConfig);
  }, []);

  // Llegadas tarde SIN JUSTIFICAR acumuladas en el año, para el color de reincidencia.
  // Se piden aparte de `registros` (que es solo del día) porque la reincidencia es un
  // patrón acumulado, no algo que se vea en la fila de un solo día.
  const [conteoAnual, setConteoAnual] = useState<Record<string, number>>({});
  useEffect(() => {
    const anio = fecha.slice(0, 4);
    void leerLlegadasTarde({ sede, desde: `${anio}-01-01`, hasta: `${anio}-12-31` }).then(
      (lista) => {
        const conteo: Record<string, number> = {};
        for (const l of llegadasQueAlertan(lista)) conteo[l.studentId] = (conteo[l.studentId] ?? 0) + 1;
        setConteoAnual(conteo);
      },
    );
  }, [sede, fecha]);

  // Alerta institucional: estudiantes con `diasSinAsistir` o más días seguidos sin
  // asistir a NINGUNA clase. Ventana acotada (umbral + margen) para no traer todas las
  // sesiones de la sede desde siempre.
  const [alertasInasistencia, setAlertasInasistencia] = useState<
    { studentId: string; nombre: string; dias: number }[]
  >([]);
  useEffect(() => {
    let vivo = true;
    void (async () => {
      try {
        const desde = addDays(fecha, -(config.diasSinAsistir + 4));
        const sesiones = await leerSesiones({ tipo: 'coordinador', sede }, { desde, hasta: fecha });
        const idsVistos = new Set<string>();
        for (const s of sesiones) for (const id of Object.keys(s.estudiantes ?? {})) idsVistos.add(id);
        const candidatas = [...idsVistos]
          .map((id) => ({ studentId: id, dias: diasSinAsistirConsecutivos(sesiones, id) }))
          .filter((a) => activaAlertaDiasSinAsistir(a.dias, config));
        if (!vivo) return;
        if (candidatas.length === 0) {
          setAlertasInasistencia([]);
          return;
        }
        const fichas = await Promise.all(candidatas.map((a) => leerEstudiante(a.studentId)));
        if (!vivo) return;
        setAlertasInasistencia(
          candidatas.map((a, i) => ({
            studentId: a.studentId,
            dias: a.dias,
            nombre: fichas[i] ? nombreCompleto(fichas[i]!) : a.studentId,
          })),
        );
      } catch {
        // Es un aviso adicional, no el trabajo de la pantalla: si falla, la puerta del
        // colegio sigue funcionando con lo demás.
        if (vivo) setAlertasInasistencia([]);
      }
    })();
    return () => {
      vivo = false;
    };
  }, [sede, fecha, config.diasSinAsistir]);

  const cargar = useCallback(async () => {
    try {
      const lista = await leerLlegadasTarde({ sede, desde: fecha, hasta: fecha });
      setRegistros(lista.sort((a, b) => b.horaLlegada.localeCompare(a.horaLlegada)));
    } catch (e) {
      setError(`No fue posible cargar las llegadas: ${(e as Error).message}`);
    }
  }, [sede, fecha]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  // Busqueda con retardo: en porteria se teclea rapido y no tiene sentido consultar en
  // cada letra.
  useEffect(() => {
    if (busqueda.trim().length < 2) {
      setCandidatos([]);
      return;
    }
    const t = setTimeout(() => {
      void buscarEstudiantes(sede, busqueda).then((r) => {
        setCandidatos(r);
        setNombres((p) => {
          const n = { ...p };
          for (const e of r) n[e.studentId] = nombreCompleto(e);
          return n;
        });
      });
    }, 250);
    return () => clearTimeout(t);
  }, [busqueda, sede]);

  async function registrar(e: Student, conExcusa: boolean) {
    setAviso(null);
    setError(null);
    const ahora = new Date();
    const hora = `${String(ahora.getHours()).padStart(2, '0')}:${String(ahora.getMinutes()).padStart(2, '0')}`;
    // Antes quedaba fijo en el bloque 2 ("el caso normal es que entre a segunda hora"),
    // lo cual era inexacto para quien llega a media manana o media tarde: el bloque real
    // se calcula con la hora de llegada y la jornada del estudiante.
    const bloques = jornadaDeGrado(e.gradoActual) === 'tarde' ? BLOQUES_TARDE : BLOQUES_MANANA;
    const bloqueIngreso = bloqueDeHora(bloques, hora);
    try {
      await registrarLlegadaTarde({
        studentId: e.studentId,
        grado: e.gradoActual,
        sede,
        fecha,
        horaLlegada: hora,
        bloqueIngreso,
        estado: conExcusa ? 'pendiente_verificacion' : 'sin_justificar',
      });
      setAviso(`${nombreCompleto(e)} — registrado a las ${hora}.`);
      setBusqueda('');
      setCandidatos([]);
      await cargar();
    } catch (err) {
      if (err instanceof ConflictoError) setAviso(err.message);
      else setError((err as Error).message);
    }
  }

  // Al leer un QR NO se registra automaticamente: se deja como unico candidato para que
  // aparezca su FOTO GRANDE (el mismo control de identidad que usa la busqueda por
  // nombre) y el coordinador confirme con los botones de siempre. La camara enfoca
  // rapido y sin esa pausa se corre el riesgo de registrar a quien no es.
  async function leerQr(texto: string) {
    setAviso(null);
    setError(null);
    try {
      const { estudiante, otraSede } = await buscarPorQrToken(sede, texto);
      if (estudiante) {
        setEscaneando(false);
        setBusqueda('');
        setCandidatos([estudiante]);
        setNombres((p) => ({ ...p, [estudiante.studentId]: nombreCompleto(estudiante) }));
      } else if (otraSede) {
        setAviso('Ese código pertenece a un estudiante de otra sede.');
      } else {
        setAviso('Código no reconocido. Puede registrar buscando al estudiante por nombre.');
      }
    } catch (e) {
      setError(`No fue posible resolver el código: ${(e as Error).message}`);
    }
  }

  // Reemplaza al `window.prompt` de antes: en la puerta del colegio no hay tiempo ni
  // manos libres para teclear un numero, y un botón grande de una sola pulsación es
  // mucho más rápido de acertar que un input de texto libre.
  const [aResolver, setAResolver] = useState<LateArrival | null>(null);

  async function aplicarResolucion(motivo: ExcuseReason | null, observacion: string | null) {
    if (!aResolver) return;
    try {
      if (motivo === null) {
        await resolverLlegadaTarde(aResolver.lateArrivalId, 'sin_justificar', null, null);
      } else {
        await resolverLlegadaTarde(aResolver.lateArrivalId, 'justificada', motivo, observacion);
      }
      setAResolver(null);
      await cargar();
    } catch (e) {
      setError(`No fue posible actualizar: ${(e as Error).message}`);
    }
  }

  // El servidor no permite borrar (`allow delete: if false`), a propósito: borrar un
  // registro destruiría la evidencia de lo ocurrido. Si quedó mal asignado, se corrige
  // marcándolo "justificada" con una observación que deja rastro — así deja de contar
  // para las alertas pero el historial no desaparece.
  async function corregir(r: LateArrival) {
    const nombre = nombres[r.studentId] ?? r.studentId;
    if (!window.confirm(`¿Corregir el registro de ${nombre}? Se marcará como registro erróneo.`)) {
      return;
    }
    try {
      await resolverLlegadaTarde(r.lateArrivalId, 'justificada', null, 'Registro erróneo: no corresponde a este estudiante');
      await cargar();
    } catch (e) {
      setError(`No fue posible corregir: ${(e as Error).message}`);
    }
  }

  const etiqueta = (estado: LateArrival['estado']) =>
    LATE_ARRIVAL_STATES.find((s) => s.state === estado)?.label ?? estado;

  const tono = (estado: LateArrival['estado']) =>
    estado === 'justificada'
      ? 'bg-success-soft text-success-soft-fg'
      : estado === 'pendiente_verificacion'
        ? 'bg-warning-soft text-warning-soft-fg'
        : 'bg-danger-soft text-danger-soft-fg';

  const pendientes = registros.filter((r) => r.estado === 'pendiente_verificacion').length;

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold text-strong">Llegadas tarde a la institución</h2>
          <p className="text-xs text-muted">
            Ingreso tardío al colegio. No es el <b>retraso</b> a una clase, que registra
            cada docente en su llamado a lista.
          </p>
        </div>
        <button
          onClick={() => setAjustandoConfig(true)}
          className="shrink-0 rounded-lg border border-line px-2 py-1 text-xs text-muted"
        >
          Ajustar alertas
        </button>
      </div>

      {alertasInasistencia.length > 0 && (
        <section className="rounded-xl border border-danger-soft bg-danger-soft p-3">
          <h3 className="text-sm font-semibold text-danger-soft-fg">
            {alertasInasistencia.length} estudiante(s) sin asistir {config.diasSinAsistir}{' '}
            días seguidos o más
          </h3>
          <p className="text-xs text-danger-soft-fg">
            Ninguna clase, en ningún bloque. Verifique con la familia qué ha informado y si
            hay ausencia proyectada.
          </p>
          <ul className="mt-2 space-y-1">
            {alertasInasistencia.map((a) => (
              <li
                key={a.studentId}
                className="flex items-center justify-between rounded-lg border border-line bg-card p-2 text-sm"
              >
                <span className="text-strong">{a.nombre}</span>
                <span className="text-xs font-semibold text-danger-soft-fg">
                  {a.dias} días seguidos
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="rounded-xl border border-line bg-card p-3">
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-xs text-muted">
            Fecha
            <input
              type="date"
              value={fecha}
              onChange={(ev) => setFecha(ev.target.value)}
              className="mt-0.5 block rounded-lg border border-line bg-elevated px-2 py-1 text-sm text-strong"
            />
          </label>
          <label className="grow text-xs text-muted">
            Buscar estudiante
            <input
              value={busqueda}
              onChange={(ev) => setBusqueda(ev.target.value)}
              placeholder="Apellido o nombre…"
              autoFocus
              className="mt-0.5 block w-full rounded-lg border border-line bg-elevated px-2 py-2 text-base text-strong"
            />
          </label>
          {/*
            Siempre visible junto al buscador: en la fila de la puerta el estudiante ya
            trae el QR en la mano (impreso o en el celular) y es mas rapido que teclear
            el apellido.
          */}
          <button
            onClick={() => setEscaneando(true)}
            className="rounded-lg border border-line px-3 py-2 text-sm font-medium text-strong"
          >
            Escanear código
          </button>
        </div>

        {candidatos.length > 0 && (
          <ul className="mt-2 space-y-1">
            {candidatos.map((e) => (
              // Un solo candidato —lo que deja siempre el escaneo del QR, y tambien una
              // busqueda que ya acerto— no es una lista para descartar: es una cara que
              // hay que confirmar, y va grande. Con varios, la foto pequena deja verlos
              // todos de un vistazo, que es lo util ahi.
              <VerificacionFoto
                key={e.studentId}
                estudiante={e}
                tamano={candidatos.length === 1 ? 110 : 56}
                extra={(() => {
                  const paso = pasoLlegadasTarde(conteoAnual[e.studentId] ?? 0, config);
                  return (
                    paso && (
                      <span
                        className="mt-0.5 inline-block rounded-full border px-1.5 py-0.5 text-[0.65rem] font-semibold"
                        style={estiloAlerta(paso.color)}
                      >
                        {paso.mensaje}
                      </span>
                    )
                  );
                })()}
                acciones={
                  <>
                    <button
                      onClick={() => void registrar(e, false)}
                      className="rounded-lg bg-accent px-3 py-2 text-sm font-medium text-accent-fg"
                    >
                      Registrar
                    </button>
                    <button
                      onClick={() => void registrar(e, true)}
                      className="rounded-lg border border-line px-3 py-2 text-sm text-strong"
                      title="Dice tener excusa pero no la trae: queda pendiente de verificar con el acudiente"
                    >
                      Dice traer excusa
                    </button>
                  </>
                }
              />
            ))}
          </ul>
        )}

        {busqueda.trim().length >= 2 && candidatos.length === 0 && (
          <p className="mt-2 text-sm text-muted">Ningún estudiante coincide.</p>
        )}
      </div>

      {aviso && (
        <div className="rounded-xl border border-info-soft bg-info-soft p-3 text-sm text-info-soft-fg">
          {aviso}
        </div>
      )}
      {error && (
        <div className="rounded-xl border border-danger-soft bg-danger-soft p-3 text-sm text-danger-soft-fg">
          {error}
        </div>
      )}

      <section className="rounded-xl border border-line bg-card p-3">
        <h3 className="text-sm font-semibold text-strong">
          Registradas el {fecha} <span className="text-muted">({registros.length})</span>
        </h3>
        {pendientes > 0 && (
          <p className="text-xs text-warning-soft-fg">
            {pendientes} pendiente(s) de verificar con el acudiente. Mientras estén así no
            cuentan para las alertas.
          </p>
        )}

        {registros.length === 0 ? (
          <p className="mt-2 text-sm text-muted">Ninguna todavía.</p>
        ) : (
          <ul className="mt-2 space-y-1">
            {registros.map((r) => (
              <li
                key={r.lateArrivalId}
                className="flex flex-wrap items-center gap-2 rounded-lg border border-line p-2 text-sm"
              >
                <span className="rounded-full bg-elevated px-2 py-0.5 text-xs font-semibold text-strong">
                  {r.horaLlegada}
                </span>
                <span className="grow">
                  <b className="text-strong">{nombres[r.studentId] ?? r.studentId}</b>
                  <span className="ml-2 text-xs text-muted">{r.grado}</span>
                </span>
                {(() => {
                  const paso = pasoLlegadasTarde(conteoAnual[r.studentId] ?? 0, config);
                  return (
                    paso && (
                      <span
                        className="rounded-full border px-1.5 py-0.5 text-[0.65rem] font-semibold"
                        style={estiloAlerta(paso.color)}
                        title={paso.mensaje}
                      >
                        {conteoAnual[r.studentId]}ª del año
                      </span>
                    )
                  );
                })()}
                <span className={`rounded-full px-2 py-0.5 text-xs ${tono(r.estado)}`}>
                  {etiqueta(r.estado)}
                </span>
                <button
                  onClick={() => setAResolver(r)}
                  className="rounded-lg border border-line px-2 py-1 text-xs text-strong"
                >
                  {r.estado === 'justificada' ? 'Cambiar' : 'Justificar'}
                </button>
                <button
                  onClick={() => void corregir(r)}
                  className="rounded-lg border border-line px-2 py-1 text-xs text-muted"
                  title="El registro no se borra: queda justificado con nota de que fue un error"
                >
                  Corregir
                </button>
              </li>
            ))}
          </ul>
        )}

        <p className="mt-2 text-xs text-muted">
          Solo las <b>no justificadas</b> cuentan para las alertas. El colegio tiene el
          deber de creer lo que informa la familia: coordinación verifica que esté al
          tanto, registra y firma.
        </p>
      </section>

      {aResolver && (
        <MenuExcusas
          nombre={nombres[aResolver.studentId] ?? aResolver.studentId}
          onElegir={aplicarResolucion}
          onCerrar={() => setAResolver(null)}
        />
      )}

      {escaneando && <EscanerQr onLeer={(t) => void leerQr(t)} onCerrar={() => setEscaneando(false)} />}

      {ajustandoConfig && (
        <ModalConfigAlertas
          config={config}
          onGuardar={async (nueva) => {
            try {
              await guardarConfigAlertas(nueva);
              setConfig(nueva);
              setAjustandoConfig(false);
            } catch (e) {
              setError(`No fue posible guardar: ${(e as Error).message}`);
            }
          }}
          onCerrar={() => setAjustandoConfig(false)}
        />
      )}
    </div>
  );
}

/**
 * Editor de los cuatro umbrales institucionales. Solo lo pueden guardar superusuario o
 * coordinador (regla de `asistenciaConfig/alertas`); si otra cuenta lo abriera, el
 * guardado fallaría en el servidor con el mismo mensaje de error de siempre.
 */
function ModalConfigAlertas({
  config,
  onGuardar,
  onCerrar,
}: {
  config: AlertConfig;
  onGuardar: (config: AlertConfig) => void;
  onCerrar: () => void;
}) {
  const [borrador, setBorrador] = useState(config);

  function campo(
    etiqueta: string,
    ayuda: string,
    valor: number,
    onCambiar: (n: number) => void,
  ) {
    return (
      <label className="block text-sm">
        <span className="font-medium text-strong">{etiqueta}</span>
        <input
          type="number"
          min={1}
          value={valor}
          onChange={(ev) => onCambiar(Math.max(1, Number(ev.target.value) || 1))}
          className="mt-0.5 block w-24 rounded-lg border border-line bg-elevated px-2 py-1 text-sm text-strong"
        />
        <span className="mt-0.5 block text-xs text-muted">{ayuda}</span>
      </label>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-end bg-black/40 p-0 sm:place-items-center sm:p-4"
      onClick={onCerrar}
    >
      <div
        className="w-full max-w-md space-y-3 rounded-t-2xl border border-line bg-card p-4 sm:rounded-2xl"
        onClick={(ev) => ev.stopPropagation()}
      >
        <p className="text-lg font-semibold text-strong">Ajustar alertas</p>
        <p className="text-xs text-muted">
          Son institucionales: aplican a todo el colegio, no a un docente en particular.
        </p>

        {campo(
          'Faltas seguidas sin explicar',
          'Alerta al docente en la asignatura donde ocurren.',
          borrador.faltasConsecutivas,
          (n) => setBorrador({ ...borrador, faltasConsecutivas: n }),
        )}
        {campo(
          '% de inasistencia del periodo',
          'Sobre las sesiones ya registradas de la asignatura.',
          borrador.porcentajeFaltasPeriodo,
          (n) => setBorrador({ ...borrador, porcentajeFaltasPeriodo: n }),
        )}
        {campo(
          'Llegadas tarde para el primer aviso',
          'Amarillo al llegar aquí, naranja la siguiente, rojo de dos más en adelante.',
          borrador.llegadasTardeUmbral,
          (n) => setBorrador({ ...borrador, llegadasTardeUmbral: n }),
        )}
        {campo(
          'Días seguidos sin asistir',
          'Ninguna clase, en ningún bloque. Alerta al coordinador.',
          borrador.diasSinAsistir,
          (n) => setBorrador({ ...borrador, diasSinAsistir: n }),
        )}

        <button
          onClick={() => onGuardar(borrador)}
          className="w-full rounded-lg bg-accent px-3 py-2 text-sm font-medium text-accent-fg"
        >
          Guardar
        </button>
        <button
          onClick={onCerrar}
          className="w-full rounded-lg border border-line p-2 text-sm text-soft"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}

/**
 * Hoja de opciones para justificar una llegada tarde: un botón grande por motivo, una
 * sola pulsación. Reemplaza al `window.prompt` de números, que en la puerta del colegio
 * —de pie, con prisa, con una fila de estudiantes— era lento y facil de teclear mal.
 * Sigue el mismo patrón visual que `MenuMarcas` en Planilla.tsx.
 */
function MenuExcusas({
  nombre,
  onElegir,
  onCerrar,
}: {
  nombre: string;
  onElegir: (motivo: ExcuseReason | null, observacion: string | null) => void;
  onCerrar: () => void;
}) {
  const [observacion, setObservacion] = useState('');

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-end bg-black/40 p-0 sm:place-items-center sm:p-4"
      onClick={onCerrar}
    >
      <div
        className="w-full max-w-md rounded-t-2xl border border-line bg-card p-4 sm:rounded-2xl"
        onClick={(ev) => ev.stopPropagation()}
      >
        <p className="text-center text-lg font-semibold text-strong">{nombre}</p>
        <p className="text-center text-xs text-muted">Justificar la llegada tarde</p>

        <div className="mt-3 space-y-1.5">
          {EXCUSE_REASONS.map((m) => (
            <button
              key={m.reason}
              onClick={() => onElegir(m.reason, observacion || null)}
              className="w-full rounded-lg border border-line p-3 text-left text-sm text-strong hover:bg-hover"
            >
              {m.label}
            </button>
          ))}
        </div>

        <label className="mt-3 block text-xs text-muted">
          Observación (opcional)
          <textarea
            value={observacion}
            onChange={(ev) => setObservacion(ev.target.value)}
            rows={2}
            className="mt-0.5 block w-full rounded-lg border border-line bg-elevated px-2 py-1 text-sm text-strong"
          />
        </label>

        <button
          onClick={() => onElegir(null, null)}
          className="mt-3 w-full rounded-lg border border-line p-2 text-sm text-warning-soft-fg"
        >
          Dejar sin justificar
        </button>
        <button onClick={onCerrar} className="mt-2 w-full rounded-lg border border-line p-2 text-sm text-soft">
          Cancelar
        </button>
      </div>
    </div>
  );
}
