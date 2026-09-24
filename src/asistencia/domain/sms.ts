/**
 * Mensajes de texto al acudiente, escritos por la aplicacion y enviados por la persona.
 *
 * Por que aqui no hay ninguna pasarela de envio: la institucion tiene una linea celular
 * con mensajes incluidos en su plan, en un equipo que coordinacion usa a diario. Contratar
 * un proveedor costaria por mensaje y, lo mas incomodo, lo convertiria en ENCARGADO DEL
 * TRATAMIENTO de celulares de acudientes de menores (Ley 1581/2012): contrato, clausulas y
 * el dato saliendo de la institucion. Enviando desde la linea propia no sale nada.
 *
 * Asi que la aplicacion no envia: REDACTA. Devuelve un enlace `sms:` con el numero y el
 * texto puestos; al tocarlo se abre la aplicacion de mensajes del celular y la persona
 * oprime enviar. Es el mismo trato que ya se le da al correo en `escribir-correo.ts`.
 *
 * ── Por que el texto va SIN TILDES ─────────────────────────────────────────────
 * Un SMS cabe en 160 caracteres mientras use el alfabeto GSM-7. Basta UNA tilde (a, i, o,
 * u con tilde no estan en ese alfabeto) para que el mensaje entero pase a UCS-2 y el corte
 * baje a 70 caracteres: el mismo texto se factura como dos o tres mensajes y, peor, llega
 * partido. La ñ y la é si estan en GSM-7, asi que esas se conservan.
 *
 * Por eso las plantillas se escriben sin tildes a proposito —no es un descuido de
 * ortografia— y el nombre del estudiante, que viene de Master2000 con tildes, se limpia
 * antes de entrar. Hay pruebas que lo fijan.
 */

/** Caracteres del alfabeto GSM-7. Fuera de esta lista, el mensaje se corta en 70. */
const GSM7 =
  '@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !"#¤%&\'()*+,-./0123456789:;<=>?' +
  '¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà' +
  '^{}\\[~]|€';

export const LIMITE_GSM7 = 160;
export const LIMITE_UCS2 = 70;

/** Quien firma. Va al principio para que la familia sepa de entrada quien escribe. */
export const REMITENTE = 'I.E. Manuel J. Betancur';

/** Cuantos caracteres caben en UN mensaje con este texto: 160, o 70 si se le colo algo. */
export function limiteDe(texto: string): number {
  return [...texto].every((c) => GSM7.includes(c)) ? LIMITE_GSM7 : LIMITE_UCS2;
}

/** Cuantos mensajes se van a facturar. Uno es la meta; dos ya es un texto mal armado. */
export function mensajesQueOcupa(texto: string): number {
  return Math.max(1, Math.ceil(texto.length / limiteDe(texto)));
}

/**
 * Quita tildes dejando la ñ, que en GSM-7 si existe. No se toca nada mas: mayusculas,
 * puntuacion y espacios se respetan porque el texto lo va a leer una familia.
 */
export function sinTildes(s: string): string {
  return (s ?? '')
    .replace(/ñ/g, '')
    .replace(/Ñ/g, '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(//g, 'ñ')
    .replace(//g, 'Ñ');
}

/**
 * "ARBOLEDA ASPRILLA, Samantha Sofia" -> "Samantha Arboleda".
 *
 * En un mensaje de 160 caracteres el nombre completo se come el texto, y a la familia le
 * basta el primer nombre con un apellido para saber de quien se habla. Acepta tanto el
 * formato "Apellidos, Nombres" que usa la aplicacion como un nombre suelto.
 */
export function nombreCorto(nombreCompleto: string): string {
  const limpio = sinTildes(nombreCompleto ?? '').replace(/\s+/g, ' ').trim();
  if (!limpio) return '';
  const [apellidos, nombres] = limpio.includes(',')
    ? limpio.split(',').map((p) => p.trim())
    : [null, limpio];
  const pila = (nombres ?? '').split(' ')[0] ?? '';
  const apellido = apellidos ? apellidos.split(' ')[0] : '';
  const titulo = (p: string) => (p ? p[0].toUpperCase() + p.slice(1).toLowerCase() : '');
  return [titulo(pila), titulo(apellido)].filter(Boolean).join(' ');
}

/**
 * Arma el mensaje y, si se pasa del unico mensaje, recorta el NOMBRE y no el texto: el
 * texto es el que lleva la instruccion de que hacer, y cortarlo dejaria a la familia sin
 * saber que se le pide.
 */
function armar(plantilla: (nombre: string) => string, nombre: string): string {
  const corto = nombreCorto(nombre);
  const completo = sinTildes(plantilla(corto));
  if (mensajesQueOcupa(completo) === 1) return completo;
  const sobra = completo.length - limiteDe(completo);
  const recortado = corto.slice(0, Math.max(0, corto.length - sobra - 1)).trim();
  return sinTildes(plantilla(recortado));
}

/** Tras el censo de la tercera hora: el estudiante no llego al colegio. */
export function mensajeInasistencia(nombreCompleto: string): string {
  return armar(
    (n) => `${REMITENTE}: hoy no registramos el ingreso de ${n} al colegio. Por favor responda este mensaje informando el motivo. Gracias.`,
    nombreCompleto,
  );
}

/** Cuando el numero contesta pero hay que confirmar que es el del acudiente. */
export function mensajeConfirmarDatos(nombreCompleto: string): string {
  return armar(
    (n) => `${REMITENTE}: estamos actualizando los datos de contacto de ${n}. Si este es el numero del acudiente, por favor responda SI. Gracias.`,
    nombreCompleto,
  );
}

/**
 * El codigo de verificacion del aviso por correo (apartado 3.5 del informe a los consejos).
 * El envio automatico todavia no existe; mientras tanto, el codigo sale de aqui y lo manda
 * coordinacion desde la linea institucional.
 */
export function mensajeCodigo(codigo: string): string {
  return sinTildes(`${REMITENTE}: su codigo para responder el aviso de inasistencia es ${codigo}. No lo comparta.`);
}
