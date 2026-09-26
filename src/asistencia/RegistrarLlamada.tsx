import { useState } from 'react';

import {
  motivosVigentes,
  PERSONA_CONTACTADA_ETIQUETA,
  RESULTADO_ETIQUETA,
  type MotivoFamilia,
  type PersonaContactada,
} from './domain/permanencia';
import type { ContactReason, ContactResult } from './domain/types';

/** Lo que devuelve la ventana. Un objeto y no una lista de argumentos: al agregar un campo,
 *  las pantallas que la usan no se pueden quedar pasando los valores en otro orden. */
export interface LlamadaRegistrada {
  motivoContacto: ContactReason;
  resultado: ContactResult;
  motivoFamilia: string | null;
  personaContactada: PersonaContactada | null;
  compromiso: string | null;
  observacion: string;
}

/**
 * Registrar una llamada a la familia. Una sola ventana para toda la aplicación: la usan la
 * ficha del estudiante y el reporte de tercera hora.
 *
 * Antes eran dos: la ficha tenía los seis resultados y «qué informó la familia», y la tercera
 * hora solo «Contestó / No contestó» con una nota libre (2026-09-17). La pantalla desde donde
 * más se llama era la única que no registraba la causa — justo el dato que Guardianes pide
 * «reconocer».
 */

/** Etiquetas en español de `ContactReason` (domain/types.ts). La regla de creación no
 *  restringe el motivo (sí el resultado), así que agregar uno no exige desplegar reglas. */
export const ETIQUETAS_MOTIVO: Record<ContactReason, string> = {
  inasistencia_dia: 'No vino hoy',
  umbral_ausencias: 'Acumulado de ausencias',
  umbral_retrasos: 'Acumulado de retrasos',
  umbral_llegadas_tarde: 'Acumulado de llegadas tarde',
  llegada_tarde: 'Llegada tarde de hoy',
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
  onGuardar: (llamada: LlamadaRegistrada) => Promise<void>;
}) {
  const [motivo, setMotivo] = useState<ContactReason>('inasistencia_dia');
  const [resultado, setResultado] = useState<ContactResult>('contesto');
  const [motivoFamilia, setMotivoFamilia] = useState<string>('');
  const [persona, setPersona] = useState<PersonaContactada>('acudiente');
  const [compromiso, setCompromiso] = useState('');
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
          <label className="block text-xs text-muted">Quién contestó</label>
          <div className="mb-2 flex flex-wrap gap-1.5">
            {(Object.entries(PERSONA_CONTACTADA_ETIQUETA) as [PersonaContactada, string][]).map(([valor, etiqueta]) => (
              <button
                key={valor}
                onClick={() => setPersona(valor)}
                className={`min-h-9 rounded-lg border px-3 py-1.5 text-sm ${
                  persona === valor ? 'border-accent bg-accent text-accent-fg' : 'border-line text-strong'
                }`}
              >
                {etiqueta}
              </button>
            ))}
          </div>

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

      {contesto && (
        <>
          <label className="block text-xs text-muted">Compromiso (opcional)</label>
          <input
            value={compromiso}
            onChange={(e) => setCompromiso(e.target.value)}
            placeholder="Ej.: el acudiente lo trae mañana y pasa por coordinación"
            className="mb-2 w-full rounded-lg border border-line bg-elevated px-2 py-1.5 text-sm"
          />
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
            void onGuardar({
              motivoContacto: motivo,
              resultado,
              // Nada de lo que dijo alguien si nadie contestó: ver el comentario de `contesto`.
              motivoFamilia: contesto ? motivoFamilia || null : null,
              personaContactada: contesto ? persona : null,
              compromiso: contesto ? compromiso.trim() || null : null,
              observacion: observacion.trim(),
            })
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
