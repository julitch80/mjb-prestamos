import { useCallback, useEffect, useState } from 'react';
import {
  buscarEstudiantes,
  ConflictoError,
  leerLlegadasTarde,
  registrarLlegadaTarde,
  resolverLlegadaTarde,
} from './datos';
import { toDateKey } from './domain/ids';
import { nombreCompleto } from './domain/nombres';
import { EXCUSE_REASONS, LATE_ARRIVAL_STATES, type ExcuseReason } from './domain/marks';
import type { LateArrival, Student } from './domain/types';

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
    try {
      await registrarLlegadaTarde({
        studentId: e.studentId,
        grado: e.gradoActual,
        sede,
        fecha,
        horaLlegada: hora,
        // Bloque 2: el caso normal es que espere en el hall y entre a segunda hora.
        // Si llegó más tarde, se corrige desde la lista de abajo.
        bloqueIngreso: 2,
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

  async function resolver(r: LateArrival) {
    const opciones = EXCUSE_REASONS.map((m, i) => `${i + 1}. ${m.label}`).join('\n');
    const elegido = window.prompt(
      `Justificar la llegada tarde.\n\n${opciones}\n\nEscriba el número, o 0 para dejarla sin justificar:`,
      '1',
    );
    if (elegido === null) return;
    const idx = Number(elegido) - 1;
    try {
      if (idx < 0) {
        await resolverLlegadaTarde(r.lateArrivalId, 'sin_justificar', null, null);
      } else {
        const motivo = EXCUSE_REASONS[idx]?.reason as ExcuseReason | undefined;
        if (!motivo) return;
        const obs = window.prompt('Observación (opcional):', '') ?? '';
        await resolverLlegadaTarde(r.lateArrivalId, 'justificada', motivo, obs || null);
      }
      await cargar();
    } catch (e) {
      setError(`No fue posible actualizar: ${(e as Error).message}`);
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
      <div>
        <h2 className="text-base font-semibold text-strong">Llegadas tarde a la institución</h2>
        <p className="text-xs text-muted">
          Ingreso tardío al colegio. No es el <b>retraso</b> a una clase, que registra
          cada docente en su llamado a lista.
        </p>
      </div>

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
        </div>

        {candidatos.length > 0 && (
          <ul className="mt-2 space-y-1">
            {candidatos.map((e) => (
              <li
                key={e.studentId}
                className="flex flex-wrap items-center gap-2 rounded-lg border border-line p-2"
              >
                <span className="grow text-sm">
                  <b className="text-strong">
                    {nombreCompleto(e)}
                  </b>
                  <span className="ml-2 text-xs text-muted">{e.gradoActual}</span>
                </span>
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
              </li>
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
                <span className={`rounded-full px-2 py-0.5 text-xs ${tono(r.estado)}`}>
                  {etiqueta(r.estado)}
                </span>
                <button
                  onClick={() => void resolver(r)}
                  className="rounded-lg border border-line px-2 py-1 text-xs text-strong"
                >
                  {r.estado === 'justificada' ? 'Cambiar' : 'Justificar'}
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
    </div>
  );
}
