/**
 * Escribir un correo desde la aplicación, sin servidor: se abre el redactor del propio usuario
 * con los destinatarios puestos. Lo que sale de aquí son URLs; enviar lo envía la persona.
 *
 * Dos caminos porque los equipos del colegio no son iguales:
 *
 *  - **Gmail en el navegador** es el que funciona casi siempre, porque la sesión del colegio ya
 *    está abierta. Es el botón principal.
 *  - **`mailto:`** abre el programa de correo del computador, si es que hay alguno configurado.
 *    En muchas máquinas del colegio no lo hay y el clic no hace nada: por eso es la alternativa
 *    y nunca lo único.
 *
 * Y una regla que no se negocia: **a un grupo se le escribe con copia oculta**. Si las
 * direcciones van en el campo normal, cada familia se lleva los correos de los demás menores
 * del salón. Por eso `escribirAVarios` solo sabe poner destinatarios ocultos.
 */

import type { Student } from './types';

export type Destinatarios = { conCorreo: Student[]; sinCorreo: Student[] };

/** Separa a quién le podemos escribir y a quién no. Lo segundo hay que decirlo en pantalla. */
export function destinatariosDe(estudiantes: Student[]): Destinatarios {
  const activos = estudiantes.filter((e) => e.activo !== false);
  return {
    conCorreo: activos.filter((e) => e.correoInstitucional),
    sinCorreo: activos.filter((e) => !e.correoInstitucional),
  };
}

export function correosDe(estudiantes: Student[]): string[] {
  return [...new Set(estudiantes.map((e) => e.correoInstitucional).filter((c): c is string => Boolean(c)))];
}

/** Redactar en Gmail. `cco` son los destinatarios ocultos; `para`, los visibles. */
export function urlGmail({ para = [], cco = [], asunto = '' }: { para?: string[]; cco?: string[]; asunto?: string }): string {
  const q = new URLSearchParams({ view: 'cm', fs: '1' });
  if (para.length) q.set('to', para.join(','));
  if (cco.length) q.set('bcc', cco.join(','));
  if (asunto) q.set('su', asunto);
  return `https://mail.google.com/mail/?${q.toString()}`;
}

/** Redactar en el programa de correo del computador, si hay alguno. */
export function urlMailto({ para = [], cco = [], asunto = '' }: { para?: string[]; cco?: string[]; asunto?: string }): string {
  const q = new URLSearchParams();
  if (cco.length) q.set('bcc', cco.join(','));
  if (asunto) q.set('subject', asunto);
  const cola = q.toString();
  return `mailto:${para.join(',')}${cola ? `?${cola}` : ''}`;
}

/** Escribirle a UNA persona: su dirección va visible, que para eso es suya. */
export function escribirAUno(correo: string, asunto = ''): { gmail: string; mailto: string } {
  return { gmail: urlGmail({ para: [correo], asunto }), mailto: urlMailto({ para: [correo], asunto }) };
}

/**
 * Escribirle a VARIOS: siempre con copia oculta, nunca visible. No hay parámetro para
 * cambiarlo — que la opción no exista es lo que garantiza que nadie se equivoque un día con
 * prisa.
 */
export function escribirAVarios(correos: string[], asunto = ''): { gmail: string; mailto: string } {
  return { gmail: urlGmail({ cco: correos, asunto }), mailto: urlMailto({ cco: correos, asunto }) };
}
