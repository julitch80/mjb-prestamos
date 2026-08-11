import { useCallback, useEffect, useMemo, useState } from 'react';
import Avatar from './Avatar';
import EscanerQr from './EscanerQr';
import VerificacionFoto from './VerificacionFoto';
import { CLASE_MARCA, SIGLA } from './Planilla';
import {
  abrirSesionEvento,
  buscarPorQrToken,
  compartirEvento,
  leerEstudiantesDeSede,
  leerSesionesEvento,
  marcarEnEvento,
} from './datos';
import { estadisticaEvento, eventoVigente, resumenSesionEvento } from './domain/eventos';
import { conDenominador } from './domain/stats';
import { toDateKey } from './domain/ids';
import { MARKS, findMark, type MarkCode } from './domain/marks';
import { nombreCompleto } from './domain/nombres';
import type { Event, EventSession, Student } from './domain/types';

type Pestana = 'registro' | 'estadisticas' | 'compartir';

/**
 * Planilla de un evento — registro, estadistica y compartir en una sola pantalla.
 *
 * A diferencia de `Planilla.tsx` (columnas = sesiones de un cruce grado+asignatura), aqui
 * solo hay UNA fecha visible a la vez: un evento no tiene "todas las sesiones a la vista"
 * porque la lista de integrantes puede ser grande (una jornada completa) y mostrar
 * columnas por cada dia del rango la haria ilegible en movil.
 */
export default function PlanillaEvento({
  evento,
  miCorreo,
  puedeRegistrar,
  onVolver,
}: {
  evento: Event;
  miCorreo: string;
  /**
   * Falso para la rectora. Puede LEER un evento que le hayan compartido —la regla solo
   * exige estar en `docentes`— pero no marcar: `asisCanRecord()` la excluye. Sin esta
   * distincion la pantalla le ofreceria botones que el servidor rechaza.
   */
  puedeRegistrar: boolean;
  onVolver: () => void;
}) {
  const [pestana, setPestana] = useState<Pestana>('registro');
  const [fecha, setFecha] = useState(toDateKey(new Date()));
  const [miembros, setMiembros] = useState<Student[]>([]);
  const [sesiones, setSesiones] = useState<EventSession[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [escaneando, setEscaneando] = useState(false);
  const [candidatoQr, setCandidatoQr] = useState<Student | null>(null);
  const [marcando, setMarcando] = useState<Student | null>(null);

  // `leerEstudiantesDeSede` trae solo activos: un integrante dado de baja despues de
  // crear el evento desaparece del listado. `evento.miembros` es la foto fija de IDs; el
  // orden ya viene resuelto por apellidos desde `resolverIntegrantes`, asi que se
  // preserva mapeando en ese mismo orden.
  useEffect(() => {
    let vivo = true;
    setCargando(true);
    void (async () => {
      try {
        const [todos, sesionesEvento] = await Promise.all([
          leerEstudiantesDeSede(evento.sede),
          leerSesionesEvento(evento.eventId),
        ]);
        if (!vivo) return;
        const porId = new Map(todos.map((e) => [e.studentId, e]));
        setMiembros(evento.miembros.map((id) => porId.get(id)).filter((e): e is Student => !!e));
        setSesiones(sesionesEvento);
      } catch (e) {
        if (vivo) setError(`No fue posible cargar el evento: ${(e as Error).message}`);
      } finally {
        if (vivo) setCargando(false);
      }
    })();
    return () => {
      vivo = false;
    };
  }, [evento.eventId, evento.sede, evento.miembros]);

  const recargarSesiones = useCallback(async () => {
    setSesiones(await leerSesionesEvento(evento.eventId));
  }, [evento.eventId]);

  const sesionActual = useMemo(
    () => sesiones.find((s) => s.fecha === fecha) ?? null,
    [sesiones, fecha],
  );
  const avance = resumenSesionEvento(sesionActual, evento.miembros);

  /**
   * Abre la sesion del dia SOLO cuando hace falta escribir en ella, nunca al elegir la
   * fecha en el selector: si se abriera al mirar una fecha, cada vistazo dejaria una
   * sesion vacia y el denominador de `estadisticaEvento` (sesiones REGISTRADAS, nunca el
   * calendario) quedaria inflado con dias en los que nadie tomo asistencia.
   */
  async function asegurarSesion(): Promise<EventSession> {
    const existente = sesiones.find((s) => s.fecha === fecha);
    if (existente) return existente;
    const nueva = await abrirSesionEvento(evento.eventId, fecha);
    setSesiones((prev) => [...prev, nueva]);
    return nueva;
  }

  async function marcar(studentId: string, estado: MarkCode) {
    setError(null);
    try {
      await asegurarSesion();
      await marcarEnEvento(evento.eventId, fecha, studentId, estado);
      await recargarSesiones();
    } catch (e) {
      setError(`No fue posible registrar: ${(e as Error).message}`);
    }
  }

  async function leerQr(texto: string) {
    setAviso(null);
    setError(null);
    try {
      const { estudiante, otraSede } = await buscarPorQrToken(evento.sede, texto);
      if (!estudiante) {
        setAviso(
          otraSede
            ? 'Ese código pertenece a un estudiante de otra sede.'
            : 'Código no reconocido. Puede marcar desde la lista de integrantes.',
        );
        return;
      }
      if (!evento.miembros.includes(estudiante.studentId)) {
        setEscaneando(false);
        setAviso(`${nombreCompleto(estudiante)} no es integrante de este evento.`);
        return;
      }
      setEscaneando(false);
      setCandidatoQr(estudiante);
    } catch (e) {
      setError(`No fue posible resolver el código: ${(e as Error).message}`);
    }
  }

  async function marcarDesdeQr(estado: MarkCode) {
    if (!candidatoQr) return;
    const nombre = nombreCompleto(candidatoQr);
    await marcar(candidatoQr.studentId, estado);
    setAviso(`${nombre} — marcado.`);
    setCandidatoQr(null);
  }

  if (cargando) {
    return <p className="p-3 text-sm text-muted">Cargando evento…</p>;
  }

  const vigenteHoy = eventoVigente(evento, toDateKey(new Date()));

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <button onClick={onVolver} className="text-xs text-muted underline">
            ← Volver a eventos
          </button>
          <h2 className="text-base font-semibold text-strong">{evento.nombre}</h2>
          <p className="text-xs text-muted">
            {evento.desde} a {evento.hasta} · {evento.miembros.length} integrantes
            {!vigenteHoy && <span className="ml-1 text-warning-soft-fg">· no vigente hoy</span>}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {(['registro', 'estadisticas'] as Pestana[])
          .concat(evento.creadoPor === miCorreo ? ['compartir'] : [])
          .map((p) => (
            <button
              key={p}
              onClick={() => setPestana(p)}
              className={[
                'rounded-full border px-3 py-1 text-sm',
                pestana === p
                  ? 'border-accent bg-accent-soft font-semibold text-accent-soft-fg'
                  : 'border-line text-soft',
              ].join(' ')}
            >
              {p === 'registro' ? 'Registro' : p === 'estadisticas' ? 'Estadísticas' : 'Compartir'}
            </button>
          ))}
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

      {pestana === 'registro' && (
        <div className="space-y-3">
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
              {puedeRegistrar && (
                <button
                  onClick={() => setEscaneando(true)}
                  className="rounded-lg border border-line px-3 py-2 text-sm font-medium text-strong"
                >
                  Escanear código
                </button>
              )}
              <span className="grow" />
              <span className="text-sm font-semibold text-strong">
                {avance.marcados} de {avance.total} marcados
              </span>
            </div>

            {candidatoQr && (
              <ul className="mt-2">
                <VerificacionFoto
                  estudiante={candidatoQr}
                  acciones={<BotonesMarca onElegir={(m) => void marcarDesdeQr(m)} />}
                />
              </ul>
            )}
          </div>

          <ul className="space-y-1">
            {miembros.map((e) => {
              const m = sesionActual?.estudiantes?.[e.studentId];
              const def = m ? findMark(m.estado) : undefined;
              return (
                <li
                  key={e.studentId}
                  className="flex flex-wrap items-center gap-2 rounded-lg border border-line bg-card p-2"
                >
                  <Avatar estudiante={e} tamano={40} />
                  <span className="grow text-sm">
                    <b className="block text-strong">{nombreCompleto(e)}</b>
                    <span className="text-xs text-muted">{e.gradoActual}</span>
                  </span>
                  {/* La trazabilidad es el punto de un evento compartido: aqui va SIEMPRE
                      visible, no escondida en un title como en la planilla de clase. */}
                  {def && m && (
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${CLASE_MARCA[def.code]}`}
                      title={`Registró ${m.registradoPor}`}
                    >
                      {SIGLA[def.code]} · {m.registradoPor}
                    </span>
                  )}
                  {puedeRegistrar && (
                    <button
                      onClick={() => setMarcando(e)}
                      className="rounded-lg border border-line px-3 py-1.5 text-sm text-strong"
                      aria-label={`Marcar a ${nombreCompleto(e)}`}
                    >
                      {def ? 'Cambiar' : 'Marcar'}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {pestana === 'estadisticas' && <EstadisticasEvento miembros={miembros} sesiones={sesiones} />}

      {pestana === 'compartir' && evento.creadoPor === miCorreo && (
        <CompartirEvento
          eventId={evento.eventId}
          docentesIniciales={evento.docentes}
          creadoPor={evento.creadoPor}
          onAviso={setAviso}
          onError={setError}
        />
      )}

      {escaneando && <EscanerQr onLeer={(t) => void leerQr(t)} onCerrar={() => setEscaneando(false)} />}

      {marcando && (
        <HojaMarcar
          estudiante={marcando}
          marcaActual={sesionActual?.estudiantes?.[marcando.studentId] ?? null}
          onElegir={(estado) => {
            void marcar(marcando.studentId, estado);
            setMarcando(null);
          }}
          onCerrar={() => setMarcando(null)}
        />
      )}
    </div>
  );
}

/** Fila compacta de las siete marcas, para el flujo rapido del escaner. */
function BotonesMarca({ onElegir }: { onElegir: (m: MarkCode) => void }) {
  return (
    <div className="flex flex-wrap gap-1">
      {MARKS.map((m) => (
        <button
          key={m.code}
          onClick={() => onElegir(m.code)}
          aria-label={`Marcar ${m.label}`}
          title={m.label}
          className={`grid h-9 min-w-9 place-items-center rounded-lg px-1.5 text-xs font-bold ${CLASE_MARCA[m.code]}`}
        >
          {SIGLA[m.code]}
        </button>
      ))}
    </div>
  );
}

/**
 * Hoja de marcas para la lista completa de integrantes — mismo patron de `MenuMarcas` en
 * Planilla.tsx (foto grande, un boton por marca), reconstruido aqui porque ese componente
 * no esta exportado y no hay que copiar+pegar su contenido, solo el patron visual.
 */
function HojaMarcar({
  estudiante,
  marcaActual,
  onElegir,
  onCerrar,
}: {
  estudiante: Student;
  marcaActual: { estado: string; registradoPor: string } | null;
  onElegir: (estado: MarkCode) => void;
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
        <div className="flex flex-col items-center gap-1">
          <Avatar estudiante={estudiante} tamano={110} />
          <p className="text-lg font-semibold text-strong">{nombreCompleto(estudiante)}</p>
          {marcaActual && (
            <p className="text-xs text-muted">
              Marca actual: {findMark(marcaActual.estado)?.label ?? marcaActual.estado} · registró{' '}
              {marcaActual.registradoPor}
            </p>
          )}
        </div>

        <div className="mt-3 grid grid-cols-2 gap-1.5 sm:grid-cols-3">
          {MARKS.map((m) => (
            <button
              key={m.code}
              onClick={() => onElegir(m.code)}
              className="flex flex-col items-center gap-1 rounded-lg border border-line p-2 text-center hover:bg-hover"
            >
              <span
                className={`grid h-7 w-9 place-items-center rounded text-xs font-bold ${CLASE_MARCA[m.code]}`}
              >
                {SIGLA[m.code]}
              </span>
              <span className="text-xs leading-tight text-strong">{m.label}</span>
            </button>
          ))}
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
 * Estadistica por integrante. El denominador (`sesionesCount`) va SIEMPRE junto al
 * numero: "3 faltas" no dice nada sin saber sobre cuantas sesiones se registraron.
 */
function EstadisticasEvento({
  miembros,
  sesiones,
}: {
  miembros: Student[];
  sesiones: EventSession[];
}) {
  if (sesiones.length === 0) {
    return (
      <p className="rounded-xl border border-line bg-card p-3 text-sm text-muted">
        Todavía no hay sesiones registradas en este evento: mientras no exista una, ese
        día no existe para la estadística.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-line bg-card p-3">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-muted">
            <th className="p-1">Estudiante</th>
            <th className="p-1 text-right">Asistencias</th>
            <th className="p-1 text-right">Retrasos</th>
            <th className="p-1">Ausencias</th>
            <th className="p-1 text-right">Sin registrar</th>
          </tr>
        </thead>
        <tbody>
          {miembros.map((e) => {
            const r = estadisticaEvento(e.studentId, sesiones);
            return (
              <tr key={e.studentId} className="border-t border-line">
                <td className="p-1 text-strong">{nombreCompleto(e)}</td>
                <td className="p-1 text-right text-soft">{r.porMarca.asistencia}</td>
                <td className="p-1 text-right text-soft">
                  {r.porMarca.retraso + r.porMarca.retraso_justificado}
                </td>
                <td className="p-1 text-xs text-muted">
                  {conDenominador(r.ausenciasTotales, r.sesionesCount)}
                </td>
                <td className="p-1 text-right text-muted">{r.sinRegistrar}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="mt-2 text-xs text-muted">
        Sobre {sesiones.length} {sesiones.length === 1 ? 'sesión registrada' : 'sesiones registradas'} de
        este evento. El calendario no cuenta: solo los días en que alguien tomó asistencia.
      </p>
    </div>
  );
}

/**
 * Compartir el evento. Solo la pantalla del CREADOR la ofrece: el servidor lo exige
 * igual (`callerEmail() == creadoPor`), pero no hay que mostrar un boton que va a fallar
 * a cualquier otro docente del evento.
 */
function CompartirEvento({
  eventId,
  docentesIniciales,
  creadoPor,
  onAviso,
  onError,
}: {
  eventId: string;
  docentesIniciales: string[];
  creadoPor: string;
  onAviso: (m: string) => void;
  onError: (m: string) => void;
}) {
  const [docentes, setDocentes] = useState(docentesIniciales);
  const [nuevo, setNuevo] = useState('');
  const [guardando, setGuardando] = useState(false);

  function agregar() {
    const correo = nuevo.trim().toLowerCase();
    if (!correo) return;
    if (!docentes.includes(correo)) setDocentes((d) => [...d, correo]);
    setNuevo('');
  }

  async function guardar() {
    setGuardando(true);
    try {
      await compartirEvento(eventId, docentes);
      onAviso('Lista de docentes actualizada.');
    } catch (e) {
      onError(`No fue posible compartir: ${(e as Error).message}`);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="rounded-xl border border-line bg-card p-3">
      <p className="text-sm font-semibold text-strong">Docentes con acceso</p>
      <ul className="mt-2 space-y-1">
        {docentes.map((correo) => (
          <li
            key={correo}
            className="flex items-center justify-between rounded-lg border border-line p-2 text-sm"
          >
            <span className="text-strong">
              {correo}
              {correo === creadoPor && <span className="ml-1 text-xs text-muted">(creador)</span>}
            </span>
            {correo !== creadoPor && (
              <button
                onClick={() => setDocentes((d) => d.filter((c) => c !== correo))}
                aria-label={`Quitar a ${correo}`}
                className="rounded-lg border border-line px-2 py-1 text-xs text-muted"
              >
                Quitar
              </button>
            )}
          </li>
        ))}
      </ul>

      <div className="mt-2 flex gap-2">
        <input
          value={nuevo}
          onChange={(ev) => setNuevo(ev.target.value)}
          onKeyDown={(ev) => ev.key === 'Enter' && agregar()}
          placeholder="correo@colegio.edu.co"
          className="grow rounded-lg border border-line bg-elevated px-2 py-2 text-sm text-strong"
        />
        <button onClick={agregar} className="rounded-lg border border-line px-3 py-2 text-sm text-strong">
          Añadir
        </button>
      </div>

      <button
        disabled={guardando}
        onClick={() => void guardar()}
        className="mt-3 w-full rounded-lg bg-accent px-3 py-2 text-sm font-medium text-accent-fg disabled:opacity-50"
      >
        {guardando ? 'Guardando…' : 'Guardar cambios'}
      </button>
    </div>
  );
}
