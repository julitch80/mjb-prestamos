import { useState } from 'react';

import { motivosVigentes, RESULTADO_ETIQUETA, type MotivoFamilia } from './domain/permanencia';
import type { ContactReason, ContactResult } from './domain/types';

/**
 * Registrar una llamada a la familia. Una sola ventana para toda la aplicación: la usan la
 * ficha del estudiante y el reporte de tercera hora.
 *
 * Antes eran dos: la ficha tenía los seis resultados y «qué informó la familia», y la tercera
 * hora solo «Contestó / No contestó» con una nota libre (2026-09-17). La pantalla desde donde
 * más se llama era la única que no registraba la causa — justo el dato que Guardianes pide
 * «reconocer».
 */

/** Etiquetas en español de `ContactReason` (domain/types.ts). No se inventan motivos
 *  nuevos aquí: son exactamente los que acepta el servidor. */
export const ETIQUETAS_MOTIVO: Record<ContactReason, string> = {
  inasistencia_dia: 'No vino hoy',
  umbral_ausencias: 'Acumulado de ausencias',
  umbral_retrasos: 'Acumulado de retrasos',
  umbral_llegadas_tarde: 'Acumulado de llegadas tarde',
  faltas_consecutivas: 'Faltas consecutivas',
};

function Modal({ children, onCerrar }: { children: React.ReactNode; onCerrar: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-end bg-black/40 sm:place-items-center sm:p-4"
      onClick={onCerrar}
    >
      <div
        className="max-h-[90vh] w-full max-w-md overflow-auto rounded-t-2xl border border-line bg-card p-4 sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

export function ModalRegistrarLlamada({
  numero,
  motivosFamilia,
  onCerrar,
  onGuardar,
}: {
  numero: string;
  onCerrar: () => void;
  motivosFamilia: MotivoFamilia[];
  onGuardar: (
    motivoContacto: ContactReason,
    resultado: ContactResult,
    motivoFamilia: string | null,
    observacion: string,
  ) => Promise<void>;
}) {
  const [motivo, setMotivo] = useState<ContactReason>('inasistencia_dia');
  const [resultado, setResultado] = useState<ContactResult>('contesto');
  const [motivoFamilia, setMotivoFamilia] = useState<string>('');
  const [observacion, setObservacion] = useState('');

  // Que dijo la familia solo tiene sentido si la familia hablo. Preguntarlo cuando
  // nadie contesto invita a inventar un motivo, y ese dato inventado es justo el que
  // despues decide si un caso escala o no.
  const contesto = resultado === 'contesto';

  return (
    <Modal onCerrar={onCerrar}>
      <h3 className="text-sm font-semibold text-strong">Registrar llamada</h3>
      <p className="mb-2 text-xs text-muted">Número marcado: {numero}</p>

      <label className="block text-xs text-muted">Resultado</label>
      <div className="mb-2 flex flex-wrap gap-1.5">
        {(Object.entries(RESULTADO_ETIQUETA) as [ContactResult, string][]).map(
          ([valor, etiqueta]) => (
          <button
            key={valor}
            onClick={() => setResultado(valor)}
            className={`min-h-9 rounded-lg border px-3 py-1.5 text-sm ${
              resultado === valor
                ? 'border-accent bg-accent text-accent-fg'
                : 'border-line text-strong'
            }`}
          >
            {etiqueta}
          </button>
          ),
        )}
      </div>

      {resultado === 'numero_equivocado' || resultado === 'numero_fuera_servicio' ? (
        <p className="mb-2 rounded-lg border border-line bg-elevated p-2 text-xs text-muted">
          El teléfono de la ficha no sirve. Esto <b>no</b> cuenta como intento de contacto
          y no escala el caso: lo que hay que hacer es conseguir otro número y corregir la
          ficha.
        </p>
      ) : null}

      {contesto && (
        <>
          <label className="block text-xs text-muted">Qué informó la familia</label>
          <select
            value={motivoFamilia}
            onChange={(e) => setMotivoFamilia(e.target.value)}
            className="mb-2 w-full rounded-lg border border-line bg-elevated px-2 py-1.5 text-sm"
          >
            <option value="">— Escoja una opción —</option>
            {motivosVigentes(motivosFamilia).map((m) => (
              <option key={m.id} value={m.id}>
                {m.etiqueta}
              </option>
            ))}
          </select>
        </>
      )}

      <label className="block text-xs text-muted">Motivo de la llamada</label>
      <select
        value={motivo}
        onChange={(e) => setMotivo(e.target.value as ContactReason)}
        className="mb-2 w-full rounded-lg border border-line bg-elevated px-2 py-1.5 text-sm"
      >
        {Object.entries(ETIQUETAS_MOTIVO).map(([valor, etiqueta]) => (
          <option key={valor} value={valor}>
            {etiqueta}
          </option>
        ))}
      </select>

      <label className="block text-xs text-muted">Observación</label>
      <textarea
        value={observacion}
        onChange={(e) => setObservacion(e.target.value)}
        rows={3}
        placeholder="Qué informó la familia, o por qué quedó pendiente…"
        className="mb-2 w-full rounded-lg border border-line bg-elevated px-2 py-1.5 text-sm"
      />

      <div className="mt-3 flex gap-2">
        <button
          onClick={() =>
            void onGuardar(motivo, resultado, contesto ? motivoFamilia || null : null, observacion.trim())
          }
          className="rounded-lg bg-accent px-3 py-1.5 text-sm text-accent-fg"
        >
          Guardar
        </button>
        <button onClick={onCerrar} className="rounded-lg border border-line px-3 py-1.5 text-sm text-strong">
          Cancelar
        </button>
      </div>
    </Modal>
  );
}
