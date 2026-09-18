import { useState } from 'react';
import { Mail, X } from 'lucide-react';

import { correosDe, destinatariosDe, escribirAVarios } from './domain/escribir-correo';
import { nombreCompleto } from './domain/nombres';
import type { Student } from './domain/types';

/**
 * Escribirle al grupo entero. Abre el redactor con las direcciones EN COPIA OCULTA: si fueran
 * visibles, cada familia se llevaría los correos de los demás menores del salón.
 *
 * En la cabecera es solo un icono. Primero fue un recuadro con todo el texto a la vista, al
 * final del cuaderno de dirección de grupo; ahí no se encontraba, y arriba ocupaba demasiado
 * (Julián, 2026-09-17). Un botón pequeño arriba y la explicación dentro de la ventana.
 */
export default function EscribirAlGrupo({ estudiantes, etiqueta }: { estudiantes: Student[]; etiqueta: string }) {
  const [abierta, setAbierta] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const { conCorreo, sinCorreo } = destinatariosDe(estudiantes);
  const correos = correosDe(conCorreo);
  if (correos.length === 0) return null;
  const { gmail, mailto } = escribirAVarios(correos, `${etiqueta} — `);

  return (
    <>
      <button
        onClick={() => setAbierta(true)}
        title={`Escribir al grupo (${correos.length} con correo)`}
        aria-label={`Escribir al grupo, ${correos.length} con correo`}
        className="flex h-9 w-9 items-center justify-center rounded-xl border border-line bg-card text-soft"
      >
        <Mail size={16} aria-hidden />
      </button>

      {abierta && (
        <div
          className="fixed inset-0 z-50 grid place-items-end bg-black/40 sm:place-items-center sm:p-4"
          onClick={() => setAbierta(false)}
        >
          <div
            className="max-h-[90vh] w-full max-w-md overflow-auto rounded-t-2xl border border-line bg-card p-4 sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-base font-semibold text-strong">Escribir a {etiqueta}</h3>
              <button onClick={() => setAbierta(false)} aria-label="Cerrar" className="text-soft">
                <X size={18} aria-hidden />
              </button>
            </div>

            <a
              href={gmail}
              target="_blank"
              rel="noreferrer"
              onClick={() => setAbierta(false)}
              className="flex min-h-[40px] w-full items-center justify-center gap-2 rounded-xl bg-accent px-3 text-sm font-medium text-on-accent"
            >
              <Mail size={16} aria-hidden />
              Escribir a {correos.length} del grupo
            </a>

            <button
              onClick={() => void navigator.clipboard.writeText(correos.join(', ')).then(() => setCopiado(true))}
              className="mt-2 min-h-[36px] w-full rounded-xl border border-line px-3 text-sm text-soft"
            >
              {copiado ? 'Direcciones copiadas' : 'Copiar direcciones'}
            </button>

            <p className="mt-3 text-xs text-muted">
              Se abre Gmail con las direcciones en <b>copia oculta</b>, para que nadie vea los correos de los
              demás. Si prefieres el programa de correo del computador,{' '}
              <a href={mailto} className="underline">
                ábrelo desde aquí
              </a>
              .
            </p>

            {sinCorreo.length > 0 && (
              <div className="mt-3 rounded-lg border border-warning-soft bg-warning-soft p-2 text-xs text-warning-soft-fg">
                <b>No les llega a {sinCorreo.length}</b>, porque no tienen correo en la ficha. Se lo puedes poner
                desde su ficha, y queda puesto para todos.
                {/* Uno por línea: el nombre ya lleva una coma dentro («BEDOYA VASCO, LIZETH»), así
                    que separarlos con comas hacía parecer cinco personas donde había tres. */}
                <ul className="mt-1 space-y-0.5">
                  {sinCorreo.map((e) => (
                    <li key={e.studentId}>{nombreCompleto(e)}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
