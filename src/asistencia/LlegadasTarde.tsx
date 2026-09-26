import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  buscarEstudiantes,
  buscarPorQrToken,
  ConflictoError,
  guardarConfigAlertas,
  leerAvisosDeLlegadasDelDia,
  leerConfigAlertas,
  leerLlegadasTarde,
  registrarContacto,
  registrarLlegadaTarde,
  resolverLlegadaTarde,
} from './datos';
import SeguimientoLlegadas, { BotonAvisoSms, useFichas } from './SeguimientoLlegadas';
import {
  ajustesDeSeguimiento,
  ETIQUETA_VENTANA,
  mensajeLlegadaTarde,
  ventanaDe,
  type VentanaLlegadas,
} from './domain/llegadas-seguimiento';
import EscanerQr from './EscanerQr';
import VerificacionFoto from './VerificacionFoto';
import { jornadaDeGrado, toDateKey } from './domain/ids';
import { bloqueDeHora } from './domain/bloques';
import { nombreCompleto } from './domain/nombres';
import { EXCUSE_REASONS, LATE_ARRIVAL_STATES, type ExcuseReason } from './domain/marks';
import {
  ALERT_CONFIG_POR_DEFECTO,
  CUENTA_VACIA,
  cuentaLlegadasPorEstudiante,
  modoSugerido,
  nivelDeLlegada,
  nivelDeRegistroIndividual,
  pasoLlegadasTarde,
  sumarMinutos,
  type ColorAlerta,
  type CuentaLlegadas,
} from './domain/alertas';
import { filtroEfectivo, filtroInicial, gradoEnJornada, type FiltroJornada } from './domain/filtro-jornada';
import type { AlertConfig, FamilyContact, Jornada, LateArrival, Student } from './domain/types';
import SelectorJornada from './SelectorJornada';
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
/** 'HH:mm' de este momento. */
function horaActual(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export default function LlegadasTarde({
  sede,
  jornadaLimitada = null,
}: {
  sede: string;
  /**
   * Coordinador de central acotado a una jornada. Ve solo las llegadas y alertas de la
   * suya. Registrar, en cambio, puede a cualquier estudiante: en la porteria no se le
   * puede cerrar la puerta a nadie por la jornada que tenga en la ficha.
   */
  jornadaLimitada?: Jornada | null;
}) {
  const [elegida, setElegida] = useState<FiltroJornada>(filtroInicial(jornadaLimitada));
  const filtro = filtroEfectivo(jornadaLimitada, elegida);
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
  // Con peso: las de 2º nivel valen doble (ver `cuentaLlegadasPorEstudiante`).
  // El lapso (periodo, semestre o año) y el plazo de las pendientes los escoge
  // coordinacion en «Ajustar alertas» (Julián, 2026-09-25).
  const [anuales, setAnuales] = useState<LateArrival[]>([]);
  const hoy = toDateKey(new Date());
  const seguimiento = ajustesDeSeguimiento(config);
  const ventana = ventanaDe(fecha, seguimiento.ventana, seguimiento.iniciosPeriodo);
  const conteoAnual = useMemo<Record<string, CuentaLlegadas>>(
    () =>
      cuentaLlegadasPorEstudiante(anuales, {
        hoy,
        diasVencePendiente: seguimiento.diasVencePendiente,
        desde: ventana.desde,
        hasta: ventana.hasta,
      }),
    [anuales, hoy, seguimiento.diasVencePendiente, ventana.desde, ventana.hasta],
  );
  const cuentaDe = (studentId: string) => conteoAnual[studentId] ?? CUENTA_VACIA;
  const recontar = useCallback(async () => {
    const anio = fecha.slice(0, 4);
    setAnuales(await leerLlegadasTarde({ sede, desde: `${anio}-01-01`, hasta: `${anio}-12-31` }));
  }, [sede, fecha]);
  useEffect(() => {
    void recontar();
  }, [recontar]);

  /**
   * Los dos caminos de una llegada tarde (Julián, 2026-09-25), que son los que distinguen
   * el nivel:
   *  - `hall`: paso la tolerancia (6:10) y espera en el hall a que termine la primera
   *    hora. Coordinacion arma la lista y la registra junta al pasarlos a clase: 1º nivel.
   *  - `individual`: el vigilante lo trae a coordinacion. Si ya termino la primera hora,
   *    2º nivel (cuenta doble); si no, 1º.
   * Por la hora sola no se distinguen: la lista del hall se pasa a las 6:55, la misma
   * hora a la que entraria uno de 2º nivel.
   */
  const tolerancia = config.toleranciaMinutos ?? ALERT_CONFIG_POR_DEFECTO.toleranciaMinutos ?? 10;
  const [modo, setModo] = useState<'hall' | 'individual'>(() =>
    modoSugerido([BLOQUES_MANANA, BLOQUES_TARDE], horaActual(), tolerancia),
  );
  const [hall, setHall] = useState<{ estudiante: Student; excusa: boolean }[]>([]);
  const [registrandoHall, setRegistrandoHall] = useState(false);

  // La alerta de «N dias seguidos sin asistir» vivia aqui; se movio al paso 2 de la
  // tercera hora (AlertaDiasSinAsistir.tsx, 2026-09-25). El umbral se sigue ajustando
  // desde «Ajustar alertas» de esta pantalla.

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
    const nivel = nivelDeRegistroIndividual(bloques, hora);
    try {
      await registrarLlegadaTarde({
        studentId: e.studentId,
        grado: e.gradoActual,
        sede,
        fecha,
        horaLlegada: hora,
        bloqueIngreso,
        estado: conExcusa ? 'pendiente_verificacion' : 'sin_justificar',
        nivel,
        origen: 'individual',
      });
      setAviso(
        `${nombreCompleto(e)} — registrado a las ${hora}, ` +
          (nivel === 2 ? '2º nivel (después de la primera hora: cuenta doble).' : '1º nivel.'),
      );
      setBusqueda('');
      setCandidatos([]);
      await cargar();
      await recontar();
    } catch (err) {
      if (err instanceof ConflictoError) setAviso(err.message);
      else setError((err as Error).message);
    }
  }

  function agregarAlHall(e: Student, excusa: boolean) {
    setAviso(null);
    setHall((h) => (h.some((x) => x.estudiante.studentId === e.studentId) ? h : [...h, { estudiante: e, excusa }]));
    setBusqueda('');
    setCandidatos([]);
  }

  /**
   * Registra a todos los del hall de una vez, al pasarlos a clase. Todos 1º nivel, con la
   * hora de ahora (la de entrada al salon) y entrando a la segunda hora, aunque se pase
   * la lista un par de minutos antes de que termine la primera.
   */
  async function registrarHall() {
    if (hall.length === 0) return;
    setAviso(null);
    setError(null);
    setRegistrandoHall(true);
    const hora = horaActual();
    const yaEstaban: string[] = [];
    const fallaron: { id: string; texto: string }[] = [];
    const registrados: string[] = [];
    for (const { estudiante: e, excusa } of hall) {
      const bloques = jornadaDeGrado(e.gradoActual) === 'tarde' ? BLOQUES_TARDE : BLOQUES_MANANA;
      try {
        await registrarLlegadaTarde({
          studentId: e.studentId,
          grado: e.gradoActual,
          sede,
          fecha,
          horaLlegada: hora,
          bloqueIngreso: bloques[1]?.id ?? 2,
          estado: excusa ? 'pendiente_verificacion' : 'sin_justificar',
          nivel: 1,
          origen: 'hall',
        });
        registrados.push(e.studentId);
      } catch (err) {
        if (err instanceof ConflictoError) yaEstaban.push(nombreCompleto(e));
        else fallaron.push({ id: e.studentId, texto: `${nombreCompleto(e)} (${(err as Error).message})` });
      }
    }
    // Se quedan en la lista solo los que fallaron por un error real, para reintentar.
    setHall((h) => h.filter((x) => fallaron.some((f) => f.id === x.estudiante.studentId)));
    setRegistrandoHall(false);
    setAviso(
      [
        `${registrados.length} del hall registrados (1º nivel) a las ${hora}. Ya pueden ir al salón.`,
        yaEstaban.length > 0 ? `Ya tenían llegada tarde hoy: ${yaEstaban.join('; ')}.` : '',
      ]
        .filter(Boolean)
        .join(' '),
    );
    if (fallaron.length > 0) setError(`No se pudo registrar: ${fallaron.map((f) => f.texto).join('; ')}`);
    await cargar();
    await recontar();
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
      await recontar();
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

  // Se filtra al MOSTRAR (ver domain/filtro-jornada). Sin grado conocido, se muestra.
  const registrosVisibles = registros.filter((r) => gradoEnJornada(r.grado, filtro));
  const pendientes = registrosVisibles.filter((r) => r.estado === 'pendiente_verificacion').length;

  // Para el aviso de cada llegada: la ficha (celular) y si ya se le aviso hoy.
  const fichasDelDia = useFichas(registros.map((r) => r.studentId));
  const [avisosDelDia, setAvisosDelDia] = useState<FamilyContact[]>([]);
  const cargarAvisosDelDia = useCallback(async () => {
    try {
      setAvisosDelDia(await leerAvisosDeLlegadasDelDia(sede, fecha));
    } catch {
      setAvisosDelDia([]);
    }
  }, [sede, fecha]);
  useEffect(() => {
    void cargarAvisosDelDia();
  }, [cargarAvisosDelDia]);

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


      <div className="rounded-xl border border-line bg-card p-3">
        {/* Los dos caminos, como pastillas: de cual se registra depende el nivel. */}
        <div role="tablist" aria-label="Cómo llegó" className="mb-3 grid gap-2 sm:grid-cols-2">
          {(
            [
              {
                id: 'hall',
                titulo: 'Hall de primera hora',
                detalle: `Llegaron después de las ${sumarMinutos(BLOQUES_MANANA[0].inicio, tolerancia)} (tarde: ${sumarMinutos(BLOQUES_TARDE[0].inicio, tolerancia)}) y esperan. Se registran juntos al pasarlos a clase: 1º nivel.`,
              },
              {
                id: 'individual',
                titulo: 'Llega a coordinación',
                detalle: 'Lo trae el vigilante. Si ya terminó la primera hora es 2º nivel y cuenta doble en las alertas.',
              },
            ] as const
          ).map((m) => (
            <button
              key={m.id}
              role="tab"
              aria-selected={modo === m.id}
              onClick={() => setModo(m.id)}
              className={[
                'rounded-2xl border-2 px-3 py-2 text-left',
                modo === m.id
                  ? 'border-accent bg-accent-soft text-accent-soft-fg'
                  : 'border-line bg-elevated text-soft hover:bg-hover',
              ].join(' ')}
            >
              <span className={`block text-sm ${modo === m.id ? 'font-bold' : 'font-semibold text-strong'}`}>
                {m.titulo}
              </span>
              <span className="block text-xs opacity-80">{m.detalle}</span>
            </button>
          ))}
        </div>

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
          <SelectorJornada limitada={jornadaLimitada} valor={elegida} onCambio={setElegida} />
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
                  const paso = pasoLlegadasTarde(cuentaDe(e.studentId), config);
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
                  modo === 'hall' ? (
                    <>
                      <button
                        onClick={() => agregarAlHall(e, false)}
                        className="rounded-lg bg-accent px-3 py-2 text-sm font-medium text-accent-fg"
                      >
                        Al hall
                      </button>
                      <button
                        onClick={() => agregarAlHall(e, true)}
                        className="rounded-lg border border-line px-3 py-2 text-sm text-strong"
                        title="Dice tener excusa pero no la trae: queda pendiente de verificar con el acudiente"
                      >
                        Al hall · dice traer excusa
                      </button>
                    </>
                  ) : (
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
                  )
                }
              />
            ))}
          </ul>
        )}

        {busqueda.trim().length >= 2 && candidatos.length === 0 && (
          <p className="mt-2 text-sm text-muted">Ningún estudiante coincide.</p>
        )}

        {modo === 'hall' && (
          <div className="mt-3 rounded-xl border border-line bg-elevated p-3">
            <p className="text-sm font-semibold text-strong">
              En el hall <span className="text-muted">({hall.length})</span>
            </p>
            {hall.length === 0 ? (
              <p className="mt-1 text-xs text-muted">
                Busque o escanee a cada estudiante que está esperando y tóquelo «Al hall». Nada
                se guarda hasta que los registre juntos.
              </p>
            ) : (
              <>
                <ul className="mt-2 space-y-1">
                  {hall.map(({ estudiante: e, excusa }) => (
                    <li
                      key={e.studentId}
                      className="flex items-center gap-2 rounded-lg border border-line bg-card p-2 text-sm"
                    >
                      <span className="grow">
                        <b className="text-strong">{nombreCompleto(e)}</b>
                        <span className="ml-2 text-xs text-muted">{e.gradoActual}</span>
                        {excusa && (
                          <span className="ml-2 rounded-full bg-warning-soft px-1.5 py-0.5 text-xs text-warning-soft-fg">
                            dice traer excusa
                          </span>
                        )}
                      </span>
                      <button
                        onClick={() => setHall((h) => h.filter((x) => x.estudiante.studentId !== e.studentId))}
                        aria-label={`Quitar a ${nombreCompleto(e)} de la lista`}
                        className="rounded-lg border border-line px-2 py-1 text-xs text-muted"
                      >
                        Quitar
                      </button>
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => void registrarHall()}
                  disabled={registrandoHall}
                  className="mt-2 w-full rounded-lg bg-accent px-3 py-2 text-sm font-medium text-accent-fg disabled:opacity-60"
                >
                  {registrandoHall
                    ? 'Registrando…'
                    : `Registrar a los ${hall.length} del hall y enviarlos al salón`}
                </button>
              </>
            )}
          </div>
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
          Registradas el {fecha} <span className="text-muted">({registrosVisibles.length})</span>
        </h3>
        {pendientes > 0 && (
          <p className="text-xs text-warning-soft-fg">
            {pendientes} pendiente(s) de verificar con el acudiente. Mientras estén así no
            cuentan para las alertas.
          </p>
        )}

        {registrosVisibles.length === 0 ? (
          <p className="mt-2 text-sm text-muted">Ninguna todavía.</p>
        ) : (
          <ul className="mt-2 space-y-1">
            {registrosVisibles.map((r) => (
              <li
                key={r.lateArrivalId}
                className="flex flex-wrap items-center gap-2 rounded-lg border border-line p-2 text-sm"
              >
                <span className="rounded-full bg-elevated px-2 py-0.5 text-xs font-semibold text-strong">
                  {r.horaLlegada}
                </span>
                {nivelDeLlegada(r) === 2 ? (
                  <span
                    className="rounded-full bg-danger-soft px-2 py-0.5 text-xs font-semibold text-danger-soft-fg"
                    title="Llegó después de la primera hora: cuenta doble si no se justifica"
                  >
                    2º nivel
                  </span>
                ) : (
                  <span className="rounded-full bg-elevated px-2 py-0.5 text-xs text-muted">
                    {r.origen === 'hall' ? 'hall · 1º nivel' : '1º nivel'}
                  </span>
                )}
                <span className="grow">
                  <b className="text-strong">{nombres[r.studentId] ?? r.studentId}</b>
                  <span className="ml-2 text-xs text-muted">{r.grado}</span>
                </span>
                {(() => {
                  const cuenta = cuentaDe(r.studentId);
                  const paso = pasoLlegadasTarde(cuenta, config);
                  return (
                    paso && (
                      <span
                        className="rounded-full border px-1.5 py-0.5 text-[0.65rem] font-semibold"
                        style={estiloAlerta(paso.color)}
                        title={paso.mensaje}
                      >
                        {cuenta.llegadas} {ventana.nombre}{cuenta.segundoNivel > 0 ? ` (${cuenta.segundoNivel} de 2º)` : ''}
                      </span>
                    )
                  );
                })()}
                <span className={`rounded-full px-2 py-0.5 text-xs ${tono(r.estado)}`}>
                  {etiqueta(r.estado)}
                </span>
                <BotonAvisoSms
                  estudiante={fichasDelDia[r.studentId]}
                  texto={mensajeLlegadaTarde(nombres[r.studentId] ?? (fichasDelDia[r.studentId] ? nombreCompleto(fichasDelDia[r.studentId]) : ''), r.horaLlegada, nivelDeLlegada(r))}
                  enviado={avisosDelDia.find((c) => c.lateArrivalId === r.lateArrivalId)}
                  onEnviado={async (telefono) => {
                    const ficha = fichasDelDia[r.studentId];
                    await registrarContacto({
                      studentId: r.studentId,
                      grado: r.grado,
                      sede,
                      fecha: r.fecha,
                      motivoContacto: 'llegada_tarde',
                      telefonoUsado: telefono,
                      resultado: 'pendiente',
                      medio: 'mensaje',
                      lateArrivalId: r.lateArrivalId,
                      observacion: mensajeLlegadaTarde(ficha ? nombreCompleto(ficha) : '', r.horaLlegada, nivelDeLlegada(r)),
                    });
                    await cargarAvisosDelDia();
                  }}
                />
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
          Solo las <b>no justificadas</b> cuentan para las alertas (y las pendientes que pasan{' '}
          {seguimiento.diasVencePendiente} días sin resolverse); las de <b>2º nivel</b>{' '}
          (después de la primera hora) cuentan doble. El colegio tiene el
          deber de creer lo que informa la familia: coordinación verifica que esté al
          tanto, registra y firma.
        </p>
      </section>

      <SeguimientoLlegadas
        sede={sede}
        hoy={hoy}
        filtro={filtro}
        anuales={anuales}
        cuentas={conteoAnual}
        ventana={ventana}
        config={config}
        estiloAlerta={estiloAlerta}
        onJustificar={setAResolver}
      />

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
        className="max-h-[90vh] w-full max-w-md space-y-3 overflow-auto rounded-t-2xl border border-line bg-card p-4 sm:rounded-2xl"
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
          'Amarillo al llegar aquí, naranja la siguiente, rojo de dos más en adelante. Las de 2º nivel cuentan doble.',
          borrador.llegadasTardeUmbral,
          (n) => setBorrador({ ...borrador, llegadasTardeUmbral: n }),
        )}
        <label className="block text-sm">
          <span className="font-medium text-strong">Los topes de llegadas tarde se cuentan</span>
          <select
            value={borrador.ventanaLlegadas ?? 'anio'}
            onChange={(ev) => setBorrador({ ...borrador, ventanaLlegadas: ev.target.value as VentanaLlegadas })}
            className="mt-0.5 block rounded-lg border border-line bg-elevated px-2 py-1 text-sm text-strong"
          >
            {(Object.keys(ETIQUETA_VENTANA) as VentanaLlegadas[]).map((v) => (
              <option key={v} value={v}>
                {ETIQUETA_VENTANA[v]}
              </option>
            ))}
          </select>
          <span className="mt-0.5 block text-xs text-muted">
            Al empezar un periodo, semestre o año nuevo, la cuenta vuelve a cero. Semestres: enero a
            junio y julio a diciembre.
          </span>
        </label>
        {(borrador.ventanaLlegadas ?? 'anio') === 'periodo' && (
          <div className="grid grid-cols-2 gap-2 text-sm">
            {[0, 1].map((k) => (
              <label key={k} className="block">
                <span className="font-medium text-strong">Inicio del periodo {k + 2}</span>
                <input
                  type="date"
                  value={borrador.iniciosPeriodo?.[k] ?? ''}
                  onChange={(ev) => {
                    const inicios = [...(borrador.iniciosPeriodo ?? [])];
                    inicios[k] = ev.target.value;
                    setBorrador({ ...borrador, iniciosPeriodo: inicios.filter(Boolean) });
                  }}
                  className="mt-0.5 block w-full rounded-lg border border-line bg-elevated px-2 py-1 text-sm text-strong"
                />
              </label>
            ))}
            <span className="col-span-2 text-xs text-muted">El periodo 1 empieza en enero.</span>
          </div>
        )}
        {campo(
          'Días para verificar una excusa',
          'Si una llegada «pendiente de verificación» pasa este plazo sin resolverse, cuenta como sin justificar.',
          borrador.diasVencePendiente ?? 8,
          (n) => setBorrador({ ...borrador, diasVencePendiente: n }),
        )}
        {campo(
          'Minutos de tolerancia al entrar',
          'Después del inicio de la jornada (6:00 y 12:15). Pasado este tiempo, al hall.',
          borrador.toleranciaMinutos ?? 10,
          (n) => setBorrador({ ...borrador, toleranciaMinutos: n }),
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
