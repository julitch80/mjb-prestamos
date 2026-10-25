import { useState } from 'react';
import { USUARIOS } from '../data/maestros';
import { correosDelPuesto, crearPlanillaReconstruida, leerHistorialAlerta, reasignarPlanillaAlerta } from './datos';
import {
  alertaId,
  alertaIdDocente,
  filasDigitacion,
  reconstruirDesdeHistorial,
  type FilaDigitacion,
  type FuenteReconstruida,
  type MarcaReconstruida,
} from './domain/alerta-academica';
import { asignacionesDelGrado } from './horarioDelDia';
import { IconoMarcaAlerta } from './IconoMarcaAlerta';
import type { ConvocatoriaAlerta, PlanillaAlerta, Sede } from './domain/types';

/** Nombre del docente de un puesto; el puesto tal cual si no esta en la lista de MJB. */
export function nombreDelPuesto(slotId: string): string {
  return USUARIOS.find((u) => u.id === slotId)?.nombre ?? slotId;
}

const ETIQUETA: Record<FilaDigitacion['estado'], { texto: string; clase: string }> = {
  entregada: { texto: '✓ Entregada', clase: 'bg-success-soft text-success-soft-fg' },
  sin_entregar: { texto: 'Sin entregar', clase: 'bg-warning-soft text-warning-soft-fg' },
  no_existe: { texto: 'No existe', clase: 'border border-dashed border-line text-muted' },
};

/**
 * Digitacion por coordinacion (2026-10-22) — en la vista de un grupo, cada asignatura con su
 * estado y el boton para digitar la alerta EN NOMBRE del docente. Si la planilla quedo a
 * nombre de otro puesto (la abrio quien no era), se ofrece pasarla al que corresponde para
 * que el docente la digite el mismo. Pensado para el celular: una tarjeta por asignatura,
 * botones a todo el ancho.
 */
export default function DigitacionPorCoordinacion({
  grado,
  sede,
  conv,
  planillas,
  onDigitar,
  onCambio,
  nombreDe = (id) => id,
}: {
  grado: string;
  sede: Sede;
  conv: ConvocatoriaAlerta;
  /** Las planillas del periodo (de la jornada o del grado). */
  planillas: PlanillaAlerta[];
  onDigitar: (fila: FilaDigitacion) => void;
  /** Tras pasar una planilla de nombre: recargar las planillas. */
  onCambio: () => void;
  /** Nombre del estudiante, para la vista previa de la reconstruccion. */
  nombreDe?: (studentId: string) => string;
}) {
  const [pasando, setPasando] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hecho, setHecho] = useState<string | null>(null);
  const filas = filasDigitacion(grado, asignacionesDelGrado(grado), planillas);
  // Reconstruccion desde el historial (2026-10-23): vista previa antes de escribir nada.
  const [previa, setPrevia] = useState<{ fila: FilaDigitacion; desde: string; dueno: string; marcas: MarcaReconstruida[]; sinCorreo: boolean } | null>(null);
  const [guardandoPrevia, setGuardandoPrevia] = useState(false);
  const idComun = (subjectId: string) => alertaId(conv.anio, conv.periodo, sede, grado, subjectId);
  /** Asignatura compartida sin planilla propia del docente, con una comun a nombre de otro. */
  const comunDeOtro = (f: FilaDigitacion) =>
    f.compartida && f.estado === 'no_existe'
      ? planillas.find((p) => p.alertaId === idComun(f.subjectId) && p.slotId !== f.slotResponsable) ?? null
      : null;
  const esLaPrevia = (f: FilaDigitacion) => !!previa && previa.fila.subjectId === f.subjectId && previa.fila.slotResponsable === f.slotResponsable;

  async function prepararReconstruccion(f: FilaDigitacion) {
    const comun = comunDeOtro(f);
    if (!comun) return;
    setPasando(`${f.subjectId}|${f.slotResponsable}`);
    setError(null);
    setHecho(null);
    try {
      const [historial, correos] = await Promise.all([leerHistorialAlerta(comun.alertaId), correosDelPuesto(f.slotResponsable)]);
      setPrevia({ fila: f, desde: comun.alertaId, dueno: comun.slotId, marcas: reconstruirDesdeHistorial(comun, historial, correos), sinCorreo: correos.length === 0 });
    } catch (e) {
      const codigo = (e as { code?: string } | null)?.code ?? '';
      setError(codigo.includes('permission-denied') ? 'El servidor no dejó leer el historial de la planilla.' : e instanceof Error ? e.message : 'No se pudo leer el historial.');
    } finally {
      setPasando(null);
    }
  }

  async function confirmarReconstruccion() {
    if (!previa) return;
    const f = previa.fila;
    setGuardandoPrevia(true);
    setError(null);
    try {
      await crearPlanillaReconstruida(
        {
          anio: conv.anio, periodo: conv.periodo, sede, jornada: conv.jornada, grado, subjectId: f.subjectId, slotId: f.slotResponsable,
          alertaId: alertaIdDocente(conv.anio, conv.periodo, sede, grado, f.subjectId, f.slotResponsable),
        },
        Object.fromEntries(previa.marcas.map((m) => [m.studentId, m.marca])),
        previa.desde,
      );
      setHecho(`${f.nombre}: quedó creada y entregada la planilla de ${nombreDelPuesto(f.slotResponsable)}, reconstruida del historial.`);
      setPrevia(null);
      onCambio();
    } catch (e) {
      const codigo = (e as { code?: string } | null)?.code ?? '';
      setError(codigo.includes('permission-denied')
        ? 'El servidor no aceptó la planilla. Verifique que el grupo sea de su sede y jornada, y que no esté usando «Ver como».'
        : e instanceof Error ? e.message : 'No se pudo crear la planilla.');
    } finally {
      setGuardandoPrevia(false);
    }
  }

  async function pasar(f: FilaDigitacion) {
    setPasando(f.subjectId);
    setError(null);
    setHecho(null);
    try {
      await reasignarPlanillaAlerta(alertaId(conv.anio, conv.periodo, sede, grado, f.subjectId), f.slotResponsable);
      setHecho(`${f.nombre} quedó a nombre de ${nombreDelPuesto(f.slotResponsable)}: ya puede digitarla desde su planilla.`);
      onCambio();
    } catch (e) {
      const codigo = (e as { code?: string } | null)?.code ?? '';
      setError(codigo.includes('permission-denied')
        ? 'El servidor no aceptó el cambio de nombre. Verifique que el grupo sea de su sede y jornada.'
        : e instanceof Error ? e.message : 'No se pudo cambiar el nombre de la planilla.');
    } finally {
      setPasando(null);
    }
  }

  if (filas.length === 0) {
    return (
      <p className="rounded-2xl border border-line bg-card p-3 text-sm text-muted">
        La asignación académica no tiene asignaturas para {grado}.
      </p>
    );
  }

  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-sm font-semibold text-strong">Asignaturas de {grado} · periodo {conv.periodo}</h3>
      <p className="text-xs text-muted">
        Si un docente no puede entrar su alerta, usted puede digitarla en su nombre, aunque ya haya pasado la fecha límite.
      </p>
      <ul className="flex flex-col gap-2">
        {filas.map((f) => {
          const docente = nombreDelPuesto(f.slotResponsable);
          const otro = f.slotPlanilla ? nombreDelPuesto(f.slotPlanilla) : null;
          return (
            <li key={`${f.subjectId}|${f.slotResponsable}`} className="flex flex-col gap-2 rounded-xl border border-line bg-card p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="flex-1 text-sm font-semibold text-strong">{f.nombre}</span>
                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${ETIQUETA[f.estado].clase}`}>
                  {ETIQUETA[f.estado].texto}
                </span>
              </div>
              <p className="text-xs text-muted">
                {docente}
                {f.porCoordinacion && ' · digitada por coordinación'}
              </p>
              {f.compartida && (
                <p className="text-xs text-muted">
                  Asignatura compartida: cada docente entrega su planilla y el reporte las combina (queda en alerta si cualquiera lo marcó).
                </p>
              )}
              {f.aNombreDeOtro && otro && (
                <div className="flex flex-col gap-2 rounded-lg bg-warning-soft p-2 text-xs text-warning-soft-fg">
                  <span>Esta planilla está a nombre de <b>{otro}</b>; corresponde a <b>{docente}</b>.</span>
                  <button
                    type="button"
                    disabled={pasando !== null}
                    onClick={() => void pasar(f)}
                    className="min-h-[44px] rounded-lg border border-warning-soft bg-card px-3 text-sm font-semibold text-strong disabled:opacity-50"
                  >
                    {pasando === f.subjectId ? 'Cambiando…' : `Pasar a nombre de ${docente}`}
                  </button>
                </div>
              )}
              {comunDeOtro(f) && !esLaPrevia(f) && (
                <button
                  type="button"
                  disabled={pasando !== null}
                  onClick={() => void prepararReconstruccion(f)}
                  className="min-h-[44px] w-full rounded-lg border border-line px-3 text-sm font-semibold text-strong hover:bg-elevated sm:w-auto sm:self-start"
                >
                  {pasando === `${f.subjectId}|${f.slotResponsable}` ? 'Leyendo el historial…' : 'Reconstruir desde el historial'}
                </button>
              )}
              {previa && esLaPrevia(f) && (
                <VistaPrevia
                  previa={previa}
                  docente={docente}
                  nombreDe={nombreDe}
                  guardando={guardandoPrevia}
                  onConfirmar={() => void confirmarReconstruccion()}
                  onCancelar={() => setPrevia(null)}
                />
              )}
              <button
                type="button"
                onClick={() => onDigitar(f)}
                className="min-h-[44px] w-full rounded-lg border border-line px-3 text-sm font-semibold text-accent hover:bg-elevated sm:w-auto sm:self-start"
              >
                Digitar en nombre del docente
              </button>
            </li>
          );
        })}
      </ul>
      {hecho && <p className="text-sm text-success">{hecho}</p>}
      {error && <p className="text-sm text-danger">{error}</p>}
    </section>
  );
}

const FUENTE: Record<FuenteReconstruida, string> = {
  correccion_propia: 'corrección del docente',
  antes_de_otro: 'su marca antes del cambio',
  planilla_comun: 'planilla común',
};

/** Lo que se va a escribir, antes de escribirlo: los ⚠️ primero, con de donde salio cada marca. */
function VistaPrevia({
  previa,
  docente,
  nombreDe,
  guardando,
  onConfirmar,
  onCancelar,
}: {
  previa: { dueno: string; marcas: MarcaReconstruida[]; sinCorreo: boolean };
  docente: string;
  nombreDe: (studentId: string) => string;
  guardando: boolean;
  onConfirmar: () => void;
  onCancelar: () => void;
}) {
  const alerta = previa.marcas.filter((m) => m.marca === 'alerta');
  const sin = previa.marcas.filter((m) => m.marca !== 'alerta');
  const fila = (m: MarcaReconstruida) => (
    <li key={m.studentId} className="flex flex-wrap gap-x-2">
      <span className="inline-flex items-center gap-1 text-strong">
        <span className={m.marca === 'alerta' ? 'text-warning-soft-fg' : 'text-success'}><IconoMarcaAlerta marca={m.marca} /></span>
        {nombreDe(m.studentId)}
      </span>
      <span className="text-muted">· {FUENTE[m.fuente]}</span>
    </li>
  );
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-line bg-elevated p-3 text-xs">
      <p className="text-soft">
        Planilla de <b className="text-strong">{docente}</b> reconstruida del historial de la planilla común (que sigue siendo de
        {' '}{nombreDelPuesto(previa.dueno)} y no se toca): <b className="text-strong">{alerta.length} en alerta</b>, {sin.length} sin alerta.
        Se crea ya entregada y queda dicho que la reconstruyó coordinación.
      </p>
      {previa.sinCorreo && (
        <p className="rounded bg-warning-soft p-2 text-warning-soft-fg">
          No se encontró la cuenta de {docente}: no se pueden separar sus correcciones de las del otro docente. Revise la lista con cuidado.
        </p>
      )}
      {previa.marcas.length === 0 ? (
        <p className="text-muted">El historial no tiene marcas para reconstruir.</p>
      ) : (
        <>
          <ul className="flex flex-col gap-0.5">{alerta.map(fila)}</ul>
          {sin.length > 0 && (
            <details>
              <summary className="cursor-pointer text-muted">Ver los {sin.length} sin alerta</summary>
              <ul className="mt-1 flex flex-col gap-0.5">{sin.map(fila)}</ul>
            </details>
          )}
        </>
      )}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={guardando || previa.marcas.length === 0}
          onClick={onConfirmar}
          className="min-h-[44px] rounded-lg bg-accent px-3 text-sm font-semibold text-accent-fg disabled:opacity-50"
        >
          {guardando ? 'Creando…' : `Crear la planilla de ${docente} con estas marcas`}
        </button>
        <button type="button" onClick={onCancelar} className="min-h-[44px] rounded-lg border border-line px-3 text-sm font-semibold text-strong">
          Cancelar
        </button>
      </div>
    </div>
  );
}
