import { useEffect, useMemo, useState } from 'react';
import { ArrowRightLeft } from 'lucide-react';
import { ASIGNACION_2026, getAsignatura } from '../data/asignacionAcademica';
import { aplicarCambioDeGrupo, leerAlcanceUsuario, leerInsumosCambioGrupo, type InsumosCambioGrupo } from './datos';
import {
  gruposDestino,
  matriculasSinSede,
  motivoParaNoCambiar,
  planCambioGrupo,
  posiblesDuplicados,
  slotDeAsignatura,
} from './domain/cambio-grupo';
import { toDateKey } from './domain/ids';
import { nombreCompleto } from './domain/nombres';
import type { Jornada, MarcaAlerta, Student } from './domain/types';

/**
 * «Cambiar de grupo» (2026-10-22). Mueve la MISMA ficha a otro grupo: no la retira de uno
 * ni la crea en otro, que era lo que dejaba a los estudiantes atascados o con una ficha
 * nueva sin foto ni datos. Ver `domain/cambio-grupo.ts`.
 *
 * Dos pasos, como el retiro: elegir el grupo y LEER lo que va a pasar antes de confirmar.
 * Lo que se muestra es exactamente lo que se va a escribir.
 */
export default function ModalCambiarGrupo({
  estudiante,
  grados,
  onCerrar,
  onHecho,
}: {
  estudiante: Student;
  /** Grupos que existen (las claves del mapa de directores). */
  grados: string[];
  onCerrar: () => void;
  onHecho: () => void;
}) {
  const [gradoNuevo, setGradoNuevo] = useState('');
  const [insumos, setInsumos] = useState<InsumosCambioGrupo | null>(null);
  const [jornadaLimitada, setJornadaLimitada] = useState<Jornada | null>(null);
  const [cargando, setCargando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Fichas duplicadas que la coordinacion decide retirar en el mismo cambio. */
  const [retirar, setRetirar] = useState<Set<string>>(new Set());

  const anio = new Date().getFullYear();
  const fecha = toDateKey(new Date());
  const opciones = useMemo(() => gruposDestino(estudiante.gradoActual, grados), [estudiante.gradoActual, grados]);

  useEffect(() => {
    void leerAlcanceUsuario(estudiante.sede).then((a) => setJornadaLimitada(a.jornadaLimitada)).catch(() => {});
  }, [estudiante.sede]);

  const motivo = gradoNuevo ? motivoParaNoCambiar(estudiante, gradoNuevo, jornadaLimitada) : null;

  useEffect(() => {
    setInsumos(null);
    setError(null);
    if (!gradoNuevo || motivo) return;
    let vivo = true;
    setCargando(true);
    void leerInsumosCambioGrupo(estudiante.studentId, gradoNuevo, anio)
      .then((i) => {
        if (!vivo) return;
        setInsumos(i);
        // Por defecto se proponen para retirar las que coinciden: es la huella del traslado
        // hecho a mano. La coordinacion puede desmarcarlas (homonimos reales).
        setRetirar(new Set(posiblesDuplicados(i.estudiante, i.enDestino)));
      })
      .catch((e) => vivo && setError((e as Error).message))
      .finally(() => vivo && setCargando(false));
    return () => {
      vivo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gradoNuevo, motivo, estudiante.studentId]);

  const duplicados = useMemo(
    () => (insumos ? posiblesDuplicados(insumos.estudiante, insumos.enDestino) : []),
    [insumos],
  );

  const plan = useMemo(() => {
    if (!insumos || !gradoNuevo || motivo) return null;
    return planCambioGrupo({
      estudiante: insumos.estudiante,
      gradoNuevo,
      anio,
      fecha,
      autor: '', // lo pone `aplicarCambioDeGrupo` con la cuenta real
      ahoraMs: Date.now(),
      matriculas: insumos.matriculas,
      matriculasDuplicados: insumos.matriculasDestino,
      duplicadosARetirar: [...retirar],
      alertasOrigen: insumos.alertasOrigen,
      alertasDestino: insumos.alertasDestino,
      agendasOrigen: insumos.agendasOrigen,
      slotDe: (subjectId) => slotDeAsignatura(ASIGNACION_2026, gradoNuevo, subjectId),
    });
  }, [insumos, gradoNuevo, motivo, retirar, anio, fecha]);

  // Matriculas viejas sin `sede`: la regla no deja que coordinacion las cierre.
  const sinSede = useMemo(
    () =>
      plan && insumos
        ? matriculasSinSede([...insumos.matriculas, ...insumos.matriculasDestino], [plan.studentId, ...plan.retirarDuplicados.map((d) => d.studentId)])
        : [],
    [plan, insumos],
  );

  async function confirmar() {
    if (!plan || sinSede.length > 0) return;
    setError(null);
    setGuardando(true);
    try {
      await aplicarCambioDeGrupo(plan);
      onHecho();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setGuardando(false);
    }
  }

  const asignatura = (id: string) => getAsignatura(id)?.nombre ?? id;
  const signo = (m: MarcaAlerta) => (m === 'alerta' ? '⚠️ en alerta' : '✓ sin alerta');
  const porId = new Map((insumos?.enDestino ?? []).map((s) => [s.studentId, s]));

  return (
    <div className="fixed inset-0 z-50 grid place-items-end bg-black/40 sm:place-items-center sm:p-4" onClick={onCerrar}>
      <div
        className="max-h-[90vh] w-full max-w-md overflow-auto rounded-t-2xl border border-line bg-card p-4 sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="flex items-center gap-1.5 text-sm font-semibold text-strong">
          <ArrowRightLeft size={16} aria-hidden />
          Cambiar de grupo a {nombreCompleto(estudiante)}
        </h3>
        <p className="mt-1 text-xs text-muted">
          Se mueve la misma ficha: conserva la foto, los datos del acudiente, el código QR y todo
          su historial. No use «Agregar estudiante nuevo» para esto.
        </p>
        <p className="mt-1 text-xs text-muted">
          Si el estudiante aparece dos veces en el buscador, haga el cambio desde la ficha que tiene
          la foto y los datos (la original). La otra se retira en este mismo paso.
        </p>

        <label className="mt-3 block text-xs text-muted">
          Grupo actual: <b className="text-strong">{estudiante.gradoActual}</b>
          {!estudiante.activo && ' (retirado)'}. Pasar a:
          <select
            value={gradoNuevo}
            onChange={(e) => setGradoNuevo(e.target.value)}
            className="mt-1 block w-full rounded-lg border border-line bg-elevated px-2 py-1.5 text-sm text-strong"
          >
            <option value="">Elija el grupo…</option>
            {opciones.mismoGrado.length > 0 && (
              <optgroup label="Mismo grado">
                {opciones.mismoGrado.map((g) => <option key={g} value={g}>{g}</option>)}
              </optgroup>
            )}
            {opciones.otros.length > 0 && (
              <optgroup label="Otros grupos">
                {opciones.otros.map((g) => <option key={g} value={g}>{g}</option>)}
              </optgroup>
            )}
          </select>
        </label>

        {motivo && <p className="mt-2 text-sm text-danger">{motivo}</p>}
        {cargando && <p className="mt-2 text-sm text-muted">Revisando matrículas y alertas…</p>}

        {plan && (
          <div className="mt-3 space-y-2 text-sm text-soft">
            <ul className="space-y-1">
              <li>
                Desde hoy ({fecha}) cuenta en <b className="text-strong">{plan.gradoNuevo}</b>; su asistencia
                de {plan.gradoAnterior} queda guardada tal como está.
              </li>
              {plan.reintegra && (
                <li className="text-warning-soft-fg">Estaba marcado como retirado: quedará activo en {plan.gradoNuevo}.</li>
              )}
            </ul>

            {duplicados.length > 0 && (
              <div className="rounded-lg border border-warning-soft bg-warning-soft p-2 text-warning-soft-fg">
                <p className="text-xs font-semibold">
                  En {plan.gradoNuevo} ya hay una ficha que parece ser este mismo estudiante (probablemente
                  creada a mano al trasladarlo):
                </p>
                {duplicados.map((id) => {
                  const d = porId.get(id);
                  return (
                    <label key={id} className="mt-1 flex items-start gap-2 text-xs">
                      <input
                        type="checkbox"
                        checked={retirar.has(id)}
                        onChange={(e) => {
                          const s = new Set(retirar);
                          if (e.target.checked) s.add(id);
                          else s.delete(id);
                          setRetirar(s);
                        }}
                      />
                      <span>
                        Retirar la ficha de {d ? nombreCompleto(d) : id}
                        {d && !d.fotoPath ? ' (sin foto)' : ''}. No se borra: queda retirada y marcada como
                        duplicada de esta. Sus marcas de alerta pasan a esta ficha.
                      </span>
                    </label>
                  );
                })}
                <p className="mt-1 text-xs">
                  La asistencia que se haya tomado con esa ficha queda en ella; no se mezcla sola.
                </p>
              </div>
            )}

            {(plan.alertas.copiar.length > 0 || plan.alertas.conservadas.length > 0 || plan.alertas.sinDestino.length > 0) && (
              <div>
                <p className="text-xs font-semibold text-strong">Alerta académica</p>
                <ul className="mt-1 space-y-0.5 text-xs">
                  {plan.alertas.copiar.map((c) => (
                    <li key={c.alertaId}>
                      Pasa: {asignatura(c.subjectId)}, periodo {c.periodo} — {signo(c.marca)}
                      {c.traslado.fichaDuplicada ? ' (la marcó el docente de ' + plan.gradoNuevo + ')' : ''}
                      {c.crear ? ' (se abre la planilla del docente)' : ''}
                    </li>
                  ))}
                  {plan.alertas.conservadas.map((c) => (
                    <li key={`c-${c.alertaId}`}>
                      Se respeta: {asignatura(c.subjectId)}, periodo {c.periodo} — el docente de {plan.gradoNuevo} ya
                      lo marcó {signo(c.marcaDestino)}
                      {c.marcaDestino !== c.marcaOrigen ? ` (en ${plan.gradoAnterior} estaba ${signo(c.marcaOrigen)})` : ''}
                    </li>
                  ))}
                  {plan.alertas.sinDestino.map((c) => (
                    <li key={`s-${c.subjectId}-${c.periodo}`} className="text-muted">
                      No pasa: {asignatura(c.subjectId)}, periodo {c.periodo} — {signo(c.marca)}.{' '}
                      {c.motivo === 'sin_asignatura'
                        ? `Esa asignatura no se dicta en ${plan.gradoNuevo}.`
                        : `La dictan dos docentes en ${plan.gradoNuevo}; pídale al que corresponda que la marque.`}
                    </li>
                  ))}
                </ul>
                <p className="mt-1 text-xs text-muted">
                  Las marcas de {plan.gradoAnterior} no se borran: quedan allí como constancia.
                </p>
              </div>
            )}

            {plan.citacionesEnGrupoAnterior.length > 0 && (
              <p className="rounded-lg border border-line p-2 text-xs">
                Tiene citación de alerta académica en la agenda de {plan.gradoAnterior} (periodo
                {plan.citacionesEnGrupoAnterior.length > 1 ? 's' : ''} {plan.citacionesEnGrupoAnterior.join(', ')}). Esa
                citación sigue a cargo del director de {plan.gradoAnterior}; avísele al director de {plan.gradoNuevo} para que no
                lo cite dos veces.
              </p>
            )}
          </div>
        )}

        {sinSede.length > 0 && (
          <p className="mt-2 text-sm text-danger">
            No se puede hacer todavía: la matrícula {sinSede.join(', ')} es anterior a agosto y no tiene
            sede, y las reglas no dejan que coordinación la cierre. Pídale al superusuario que le agregue
            {' '}<code>sede</code> en la consola y vuelva a intentarlo.
          </p>
        )}
        {error && <p className="mt-2 text-sm text-danger">{error}</p>}

        <div className="mt-3 flex gap-2">
          <button
            onClick={() => void confirmar()}
            disabled={!plan || guardando || sinSede.length > 0}
            className="rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-accent-fg disabled:opacity-50"
          >
            {guardando ? 'Guardando…' : plan ? `Cambiar a ${plan.gradoNuevo}` : 'Cambiar de grupo'}
          </button>
          <button onClick={onCerrar} className="rounded-lg border border-line px-3 py-1.5 text-sm text-strong">
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
