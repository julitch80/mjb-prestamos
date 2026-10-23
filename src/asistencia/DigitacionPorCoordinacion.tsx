import { useState } from 'react';
import { USUARIOS } from '../data/maestros';
import { reasignarPlanillaAlerta } from './datos';
import { alertaId, filasDigitacion, type FilaDigitacion } from './domain/alerta-academica';
import { asignacionesDelGrado } from './horarioDelDia';
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
}: {
  grado: string;
  sede: Sede;
  conv: ConvocatoriaAlerta;
  /** Las planillas del periodo (de la jornada o del grado). */
  planillas: PlanillaAlerta[];
  onDigitar: (fila: FilaDigitacion) => void;
  /** Tras pasar una planilla de nombre: recargar las planillas. */
  onCambio: () => void;
}) {
  const [pasando, setPasando] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hecho, setHecho] = useState<string | null>(null);
  const filas = filasDigitacion(grado, asignacionesDelGrado(grado), planillas);

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
