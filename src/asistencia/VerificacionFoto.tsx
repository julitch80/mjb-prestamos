import type { ReactNode } from 'react';
import Avatar from './Avatar';
import { nombreCompleto } from './domain/nombres';
import type { Student } from './domain/types';

/**
 * Fila de identificacion de un estudiante por fotografia.
 *
 * LA FOTO NO ES DECORACION: es el unico control de identidad que hay aqui. Quien
 * registra no siempre conoce al estudiante —a veces es un auxiliar a quien
 * coordinacion le delego la tarea—, y sin la cara basta con dar el nombre de otro
 * para que el registro le quede al companero. Es un fraude facil, silencioso y que
 * perjudica a un tercero.
 *
 * Por eso va grande (56 px) y ANTES del nombre: se ve primero la cara y despues se
 * lee, que es el orden en que uno reconoce a alguien.
 */
export default function VerificacionFoto({
  estudiante,
  extra,
  acciones,
}: {
  estudiante: Student;
  /** Informacion adicional bajo el grado (p. ej. la reincidencia de llegadas tarde). */
  extra?: ReactNode;
  /** Botones de la fila. Cambian segun la pantalla: registrar, marcar asistencia, etc. */
  acciones: ReactNode;
}) {
  return (
    <li className="flex flex-wrap items-center gap-2 rounded-lg border border-line p-2">
      <Avatar estudiante={estudiante} tamano={56} />
      <span className="grow text-sm">
        <b className="block text-strong">{nombreCompleto(estudiante)}</b>
        <span className="text-xs text-muted">{estudiante.gradoActual}</span>
        {extra}
        {!estudiante.fotoPath && (
          // Sin foto cargada no hay verificacion posible. Decirlo, en vez de
          // mostrar unas iniciales que aparentan una comprobacion que no existe.
          <span className="block text-[0.65rem] text-warning-soft-fg">
            Sin fotografía: no se puede verificar la identidad
          </span>
        )}
      </span>
      {acciones}
    </li>
  );
}
