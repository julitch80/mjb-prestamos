/**
 * Aviso de inasistencia por mensaje de texto, con enlace para responder (2026-09-23).
 *
 * ── Lo que se decidio con Julián, y por que ──────────────────────────────────
 *  - El canal es el MENSAJE DE TEXTO al celular del acudiente, desde la linea celular
 *    institucional que coordinacion usa a diario. No hay pasarela ni proveedor: ningun
 *    tercero queda como encargado del tratamiento de celulares de acudientes de menores.
 *  - El mensaje lleva un ENLACE UNICO. Tener el enlace ya prueba que se tiene el celular
 *    del acudiente, asi que no hace falta codigo. Se descarto el correo como via de
 *    respuesta: en noveno a once apenas uno de cada cinco acudientes conoce la
 *    contraseña de la cuenta del estudiante, justo donde mas riesgo de desercion hay.
 *  - El envio es SEMIAUTOMATICO: la aplicacion prepara la cola y coordinacion toca
 *    enviar en cada uno. Automatizarlo del todo desde la SIM arriesga que el operador
 *    suspenda la linea que coordinacion usa todos los dias.
 *
 * ── La respuesta es una PISTA, no una fuente de verdad ──────────────────────
 * Lo que responde la familia NO entra al registro de contactos ni al motor de
 * permanencia por si solo. Coordinacion lo ve en la lista de tercera hora y, con un
 * toque, lo convierte en un contacto A SU NOMBRE. Asi se conserva la autoria de todo lo
 * que el motor usa, y una respuesta por enlace no puede apagar sola un factor de riesgo
 * ni cerrar un caso: eso lo decide una persona.
 *
 * Este archivo es puro (sin Firebase ni criptografia): lo usan la pantalla y las
 * funciones del servidor. La firma del enlace vive en `functions/src/firma-aviso.ts`.
 */

import type { MotivoFamilia } from './permanencia';
import { addDays } from './ids';
import type { FilaAusente } from './reports';
import { tipoDeTelefono } from './telefonos';
import type { Jornada, Sede } from './types';

/** Cuanto vive el enlace. Pasado el plazo sin respuesta, el estudiante pasa a llamada. */
export const VIGENCIA_AVISO_HORAS = 48;
const VIGENCIA_MS = VIGENCIA_AVISO_HORAS * 3_600_000;

/**
 * El enlace es `<base>#<id>.<firma>`:
 *  - `id`, 10 caracteres al azar (60 bits). NO es secreto: identifica el aviso.
 *  - `firma`, 12 caracteres de un HMAC con clave del servidor (72 bits). Es la llave.
 * Va despues de `#` a proposito: el fragmento no viaja al servidor que entrega la
 * pagina ni aparece en sus registros.
 *
 * Largo total pensado para caber en UN mensaje de 160 caracteres (ver `sms.ts`).
 */
export const LARGO_ID_AVISO = 10;
export const LARGO_FIRMA_AVISO = 12;
const PATRON_FRAGMENTO = new RegExp(
  `^#?([A-Za-z0-9_-]{${LARGO_ID_AVISO}})\\.([A-Za-z0-9_-]{${LARGO_FIRMA_AVISO}})$`,
);

/**
 * Direccion provisional de la pagina de respuesta: el sitio de Firebase Hosting del
 * proyecto. Cuando exista el subdominio del colegio se cambia en
 * `asistenciaConfig/avisos.urlBase`, sin tocar codigo.
 */
export const URL_BASE_AVISOS_POR_DEFECTO = 'https://mjb-prestamos.web.app/';

/**
 * La opcion que siempre se ofrece a la familia ademas del catalogo. Quien la escoge
 * pasa a llamada: hay causas que nadie deberia tener que escribir en un formulario.
 */
export const MOTIVO_HABLAR = 'hablar_con_coordinacion';
export const ETIQUETA_HABLAR = 'Prefiero hablarlo con coordinación';

export type EstadoAviso = 'creado' | 'enviado' | 'no_salio' | 'respondido';

/**
 * Foto del soporte que la familia puede adjuntar (2026-09-23). Decision de Julián: solo
 * en las causas que JUSTIFICAN la inasistencia, opcional, y solo fotos por ahora (un PDF
 * de un desconocido es un riesgo que no se asume todavia).
 *
 * Es un dato de SALUD de un menor —sensible en la Ley 1581—: el archivo vive en una
 * carpeta de Storage que ningun cliente puede leer (la cierra el catch-all de las reglas)
 * y solo coordinacion lo abre, a traves del servidor, que deja constancia de cada vez.
 * La carpeta va por fecha para que borrar por antiguedad sea simple el dia que se decida
 * cuanto se conservan.
 */
export interface SoporteAviso {
  ruta: string;
  tipo: TipoSoporte;
  bytes: number;
  enMs: number;
}

export const TIPOS_SOPORTE = ['image/jpeg', 'image/png'] as const;
export type TipoSoporte = (typeof TIPOS_SOPORTE)[number];
/**
 * Tope del archivo que llega al servidor. La pagina reduce la foto antes de enviarla
 * (unos cientos de KB); el tope es para lo que no pase por ahi.
 */
export const SOPORTE_MAX_BYTES = 5 * 1024 * 1024;

export function rutaSoporte(fecha: string, avisoId: string, tipo: TipoSoporte): string {
  return `asistencia/soportes/${fecha}/${avisoId}.${tipo === 'image/png' ? 'png' : 'jpg'}`;
}

export interface AvisoInasistencia {
  avisoId: string;
  studentId: string;
  grado: string;
  sede: Sede;
  jornada: Jornada;
  fecha: string;
  telefono: string;
  /** Lo unico del estudiante que ve la pagina publica. */
  primerNombre: string;
  /**
   * El texto exacto que salio, con la firma enmascarada: guardar la llave en claro
   * convertiria cualquier lectura de la base de datos en enlaces vivos. El servidor la
   * puede volver a calcular, asi que el texto completo es reconstruible.
   */
  textoRegistrado: string;
  estado: EstadoAviso;
  creadoPor: string;
  creadoEnMs: number;
  expiraEnMs: number;
  enviadoPor: string | null;
  enviadoEnMs: number | null;
  respuesta: { motivoId: string; enMs: number } | null;
  /** Ausente en los avisos anteriores al 2026-09-23. */
  soporte?: SoporteAviso | null;
}

/** Cada cosa que le pasa a un aviso. Solo se agregan, nunca se editan ni se borran. */
export interface EventoAviso {
  /** `soporte_visto`: quien abrio la foto del soporte, y cuando. Es un dato de salud. */
  tipo: 'creado' | 'enviado' | 'no_salio' | 'respuesta' | 'soporte_visto';
  /** Correo institucional de quien lo hizo; `null` en la respuesta de la familia. */
  por: string | null;
  enMs: number;
  motivoId?: string;
}

export function enlaceDeAviso(urlBase: string, avisoId: string, firma: string): string {
  const base = urlBase.endsWith('/') ? urlBase : `${urlBase}/`;
  return `${base}#${avisoId}.${firma}`;
}

/** Lo que la pagina de respuesta saca de su propia direccion. */
export function leerFragmento(fragmento: string): { avisoId: string; firma: string } | null {
  const m = PATRON_FRAGMENTO.exec((fragmento ?? '').trim());
  return m ? { avisoId: m[1], firma: m[2] } : null;
}

/** El texto que se guarda: identico al enviado, con la llave tapada. */
export function enmascararFirma(texto: string, firma: string): string {
  return texto.split(firma).join('*'.repeat(firma.length));
}

export function desenmascararFirma(textoRegistrado: string, avisoId: string, firma: string): string {
  return textoRegistrado.replace(`#${avisoId}.${'*'.repeat(firma.length)}`, `#${avisoId}.${firma}`);
}

export function primerCelular(telefonos: string[]): string | null {
  return telefonos.find((t) => tipoDeTelefono(t) === 'movil') ?? null;
}

export function avisoVencido(aviso: Pick<AvisoInasistencia, 'expiraEnMs'>, ahoraMs: number): boolean {
  return ahoraMs >= aviso.expiraEnMs;
}

export function vencimientoDesde(creadoEnMs: number): number {
  return creadoEnMs + VIGENCIA_MS;
}

export type RazonExclusion = 'ya_contactado' | 'ya_tiene_aviso' | 'sin_celular';

export const ETIQUETA_EXCLUSION: Record<RazonExclusion, string> = {
  ya_contactado: 'ya tiene un contacto registrado hoy',
  ya_tiene_aviso: 'ya se le preparó el aviso',
  sin_celular: 'no tiene celular en la ficha: solo se le puede llamar',
};

/**
 * A quienes se les prepara aviso, partiendo de «no ingresaron» del reporte de tercera
 * hora (que ya excluye las ausencias justificadas o autorizadas y las llegadas tarde).
 *
 * «Llamar primero» NO excluye: el mensaje es el aviso a la familia y la llamada se hace
 * igual. Mandarle el mensaje a quien de todos modos se va a llamar no sobra.
 */
export function candidatosParaAviso(
  filas: FilaAusente[],
  opciones: { conContactoHoy: Set<string>; conAviso: Set<string> },
): {
  candidatos: { fila: FilaAusente; telefono: string }[];
  excluidos: { fila: FilaAusente; razon: RazonExclusion }[];
} {
  const candidatos: { fila: FilaAusente; telefono: string }[] = [];
  const excluidos: { fila: FilaAusente; razon: RazonExclusion }[] = [];
  for (const fila of filas) {
    if (opciones.conAviso.has(fila.studentId)) {
      excluidos.push({ fila, razon: 'ya_tiene_aviso' });
      continue;
    }
    if (opciones.conContactoHoy.has(fila.studentId)) {
      excluidos.push({ fila, razon: 'ya_contactado' });
      continue;
    }
    const telefono = primerCelular(fila.telefonos);
    if (!telefono) {
      excluidos.push({ fila, razon: 'sin_celular' });
      continue;
    }
    candidatos.push({ fila, telefono });
  }
  return { candidatos, excluidos };
}

/**
 * Las causas que se le ofrecen a la familia en la pagina publica.
 *
 * NO se ofrecen los factores de riesgo (consumo, seguridad, trabajo, "no quiere
 * volver"…): una pagina abierta no es el lugar para declararlos, y quien los viva puede
 * escoger «Prefiero hablarlo con coordinación», que pasa a llamada. Tampoco «Sin
 * información», que no es una respuesta.
 *
 * Es un criterio por defecto: la taxonomia la define Julián, y cambiar que se ofrece es
 * cambiar esta funcion.
 */
export interface MotivoOfrecido {
  id: string;
  etiqueta: string;
  /** Si en esta causa la familia puede adjuntar la foto del soporte: las que justifican. */
  admiteSoporte: boolean;
}

export function motivosParaFamilias(motivos: MotivoFamilia[]): MotivoOfrecido[] {
  return motivos
    .filter((m) => m.activo && !m.factorDeRiesgo && m.id !== 'sin_informacion')
    .sort((a, b) => a.etiqueta.localeCompare(b.etiqueta, 'es'))
    .map((m) => ({ id: m.id, etiqueta: m.etiqueta, admiteSoporte: m.justifica }));
}

export type RechazoRespuesta = 'vencido' | 'ya_respondido' | 'motivo_invalido' | 'soporte_no_admitido';

export const MENSAJE_RECHAZO: Record<RechazoRespuesta, string> = {
  vencido: 'Este enlace ya venció. Si necesita informar algo, comuníquese con coordinación.',
  ya_respondido: 'Este aviso ya fue respondido. Gracias.',
  motivo_invalido: 'Escoja una de las opciones de la lista.',
  soporte_no_admitido: 'Para esta opción no se adjunta soporte. Quite la foto y envíe de nuevo.',
};

export function admiteSoporte(motivoId: string, permitidos: { id: string; admiteSoporte?: boolean }[]): boolean {
  return permitidos.some((m) => m.id === motivoId && m.admiteSoporte === true);
}

/**
 * Si la respuesta se puede aceptar. Una sola respuesta por aviso, y la foto solo en las
 * causas que la admiten: el servidor no se fia de que la pagina haya escondido el boton.
 */
export function validarRespuesta(
  aviso: Pick<AvisoInasistencia, 'expiraEnMs' | 'respuesta'>,
  motivoId: string,
  permitidos: { id: string; admiteSoporte?: boolean }[],
  ahoraMs: number,
  conSoporte = false,
): RechazoRespuesta | null {
  if (aviso.respuesta) return 'ya_respondido';
  if (avisoVencido(aviso, ahoraMs)) return 'vencido';
  const valido = motivoId === MOTIVO_HABLAR || permitidos.some((m) => m.id === motivoId);
  if (!valido) return 'motivo_invalido';
  if (conSoporte && !admiteSoporte(motivoId, permitidos)) return 'soporte_no_admitido';
  return null;
}

/**
 * Lo que coordinacion ve de cada aviso en la lista. `registrado` = la respuesta ya se
 * convirtio en contacto; `pide_llamada` = la familia pidio hablar, o el mensaje no
 * salio, o vencio sin respuesta. En los tres hay que llamar.
 */
export type EstadoVisible =
  | 'por_enviar'
  | 'enviado'
  | 'respondido'
  | 'registrado'
  | 'pide_llamada'
  | 'no_salio'
  | 'vencido';

export function estadoVisible(
  aviso: Pick<AvisoInasistencia, 'estado' | 'expiraEnMs' | 'respuesta'>,
  ahoraMs: number,
  contactoRegistrado: boolean,
): EstadoVisible {
  if (aviso.respuesta) {
    if (aviso.respuesta.motivoId === MOTIVO_HABLAR) return 'pide_llamada';
    return contactoRegistrado ? 'registrado' : 'respondido';
  }
  if (aviso.estado === 'no_salio') return 'no_salio';
  if (avisoVencido(aviso, ahoraMs)) return 'vencido';
  return aviso.estado === 'creado' ? 'por_enviar' : 'enviado';
}

// ---------------------------------------------------------------------------
//  Pendientes de dias anteriores (2026-09-24)
// ---------------------------------------------------------------------------
//
// El aviso vive 48 horas, pero la tercera hora muestra solo los avisos DEL DIA. Sin esto,
// la respuesta que llega al dia siguiente, o el aviso que vence sin respuesta, no los veia
// nadie: habia que cambiar la fecha de la pantalla al dia del aviso para enterarse.

/**
 * Cuantos dias hacia atras se buscan pendientes. Siete cubren el fin de semana y un
 * festivo: un aviso del viernes vence el domingo y se atiende el lunes o el martes.
 * Pasado ese plazo, lo que no se atendio ya no es un aviso sino un caso de permanencia,
 * y de eso se ocupa esa pantalla.
 */
export const DIAS_DE_PENDIENTES = 7;

/** Los dias anteriores a `hoy`, del mas reciente al mas antiguo. `hoy` no se incluye. */
export function fechasAnteriores(hoy: string, dias: number): string[] {
  return Array.from({ length: dias }, (_, i) => addDays(hoy, -(i + 1)));
}

/** Los estados que piden algo a coordinacion. Enviado y vigente no pide nada: se espera. */
export type EstadoPendiente = Extract<EstadoVisible, 'pide_llamada' | 'vencido' | 'no_salio' | 'respondido'>;
const PIDEN_ALGO: EstadoPendiente[] = ['pide_llamada', 'vencido', 'no_salio', 'respondido'];

/**
 * Avisos de dias anteriores que todavia piden algo: llamar (la familia lo pidio, el
 * mensaje no salio o el enlace vencio sin respuesta) o registrar la respuesta.
 *
 * `resuelto` decide cuando dejan de pedirlo: en la pantalla, cuando la respuesta ya se
 * registro o cuando la familia ya tiene un contacto registrado desde el dia del aviso
 * (se la llamo, por el aviso o por otra razon). Primero los de llamar, luego las
 * respuestas; dentro de cada grupo, los mas antiguos arriba.
 */
export function avisosPendientes(
  avisos: AvisoInasistencia[],
  opciones: { hoy: string; ahoraMs: number; resuelto: (a: AvisoInasistencia) => boolean },
): { aviso: AvisoInasistencia; estado: EstadoPendiente }[] {
  const orden = (e: EstadoPendiente) => (e === 'respondido' ? 1 : 0);
  return avisos
    .filter((a) => a.fecha < opciones.hoy)
    .map((a) => ({ aviso: a, estado: estadoVisible(a, opciones.ahoraMs, false) }))
    .filter((x): x is { aviso: AvisoInasistencia; estado: EstadoPendiente } =>
      (PIDEN_ALGO as EstadoVisible[]).includes(x.estado),
    )
    .filter((x) => !opciones.resuelto(x.aviso))
    .sort(
      (a, b) =>
        orden(a.estado) - orden(b.estado) ||
        a.aviso.fecha.localeCompare(b.aviso.fecha) ||
        a.aviso.grado.localeCompare(b.aviso.grado),
    );
}

/** Primer nombre de pila, con mayuscula inicial: "SAMANTHA SOFIA" -> "Samantha". */
export function primerNombreDe(nombresDePila: string): string {
  const p = (nombresDePila ?? '').trim().split(/\s+/)[0] ?? '';
  return p ? p[0].toUpperCase() + p.slice(1).toLowerCase() : '';
}
