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
  tamano = 56,
}: {
  estudiante: Student;
  /** Informacion adicional bajo el grado (p. ej. la reincidencia de llegadas tarde). */
  extra?: ReactNode;
  /** Botones de la fila. Cambian segun la pantalla: registrar, marcar asistencia, etc. */
  acciones: ReactNode;
  /**
   * Tamano de la foto. 56 px para una LISTA de candidatos, donde la cara solo sirve para
   * ir descartando; 110 px cuando hay UNO SOLO y lo que toca es confirmar que es el.
   *
   * Los 110 px no son un capricho: es el mismo tamano al que la planilla muestra la foto
   * al tocar una casilla. Que el QR la mostrara mas pequena era justo al reves de lo que
   * conviene — al escanear es cuando MENOS se sabe a quien se tiene delante, porque no se
   * ha escrito su nombre ni se le ha buscado en la lista.
   */
  tamano?: number;
}) {
  return (
    <li className="flex flex-wrap items-center gap-2 rounded-lg border border-line p-2">
      <Avatar estudiante={estudiante} tamano={tamano} />
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
