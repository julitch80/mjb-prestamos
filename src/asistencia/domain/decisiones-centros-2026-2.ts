/**
 * Decisiones YA TOMADAS sobre la lista de centros de interes 2026-2.
 *
 * Para que existe este archivo: la depuracion de los dos archivos de Excel (manana y
 * tarde) dejo 42 casos que el cruce automatico no puede decidir. De esos, Julian ya
 * resolvio varios en conversacion el 2026-08-24. Sin este archivo, el importador se los
 * volveria a preguntar a la coordinadora — y preguntar dos veces lo mismo es la forma
 * mas rapida de que nadie confie en la bandeja de pendientes.
 *
 * El importador aplica estas decisiones ANTES de generar pendientes. Lo que quede sin
 * decidir aqui es lo que Yuri ve en pantalla.
 *
 * Formato del nombre: EXACTAMENTE como venia en el Excel, sin sanear. Es la llave de
 * busqueda y es la evidencia de que se corrigio algo. La comparacion ignora tildes y
 * puntuacion, pero NO adivina: si el nombre no esta, la decision no se aplica y la
 * pantalla la lista como "decision sin usar". Aplicar la decision de una persona a otra
 * seria peor que preguntar.
 *
 * ESTE ARCHIVO VIVE EN `domain/`, NO EN `seed/`. `seed/` no viaja a `src/asistencia/` de
 * MJB, y sin estas decisiones la importacion volveria a preguntar lo que Julian ya
 * respondio.
 */

export interface DecisionCentro {
  /** Nombre tal cual en el archivo de origen. */
  nombreArchivo: string;
  /** Que hacer. */
  accion: 'ubicar' | 'excluir' | 'quitar_de_centro';
  /** Nombre completo en la matricula. Solo en `ubicar`. */
  nombreMatricula?: string;
  /** Grado literal de la matricula (manda sobre el del archivo). Solo en `ubicar`. */
  grado?: string;
  /** En `quitar_de_centro`: de que centro se saca (se queda en el otro). */
  centroQueSale?: string;
  /** Por que. Se muestra en la bandeja para que quede la trazabilidad. */
  motivo: string;
}

export const DECISIONES_MANANA: DecisionCentro[] = [
  {
    nombreArchivo: 'ARROYO ARBELAEZ ALDAIR',
    accion: 'excluir',
    motivo: 'No corresponde a la jornada de la manana: en la matricula esta en 6º3 (tarde). Decision de Julian, 2026-08-24.',
  },
  {
    // En el Excel esta como apellido suelto: 'BERRIO' + 'JERÓNIMO'.
    nombreArchivo: 'BERRIO JERONIMO',
    accion: 'ubicar',
    nombreMatricula: 'BERRIO VIDALES JERONIMO',
    grado: '11.2',
    motivo: 'El archivo lo situaba en 9-2. Confirmado 11.2 por Julian, 2026-08-24. Caso testigo de la regla: manda la matricula, no el archivo.',
  },
  {
    // En el Excel falta la J del nombre: 'SÁNCHEZ' + 'OSE MANUEL'.
    nombreArchivo: 'SANCHEZ OSE MANUEL',
    accion: 'ubicar',
    nombreMatricula: 'SANCHEZ VELEZ JOSE MANUEL',
    grado: '10.3',
    motivo: 'El archivo lo situaba en 10-1. Cambio de grupo confirmado, 2026-08-24.',
  },
  {
    // En el Excel el apellido esta cambiado: 'COLORADO' + 'JULIANA', 11-2, Vibe Coding.
    // Es Coronado con L en vez de N; el grado y el centro confirman que es ella.
    nombreArchivo: 'COLORADO JULIANA',
    accion: 'ubicar',
    nombreMatricula: 'CORONADO BEDOYA JULIANA',
    grado: '11.2',
    motivo: 'Confirmado por Julian, 2026-08-24.',
  },
  {
    nombreArchivo: 'HURTADO EMANUEL',
    accion: 'ubicar',
    nombreMatricula: 'HURTADO ARBOLEDA EMMANUEL',
    grado: '9.3',
    motivo: 'Unico candidato compatible; sin objecion de Julian, 2026-08-24.',
  },
  {
    nombreArchivo: 'MATALLANA JULIAN',
    accion: 'quitar_de_centro',
    centroQueSale: 'Escenicas',
    motivo: 'Pertenece solo a Vibe Coding. Decision de Julian, 2026-08-24.',
  },
];

/**
 * Los ocho de la tarde que el cruce daba por inexistentes y que SI existen, solo que
 * mal escritos. Salieron al comparar contra quien habia quedado sin centro en el mismo
 * grupo — no de adivinar. Los siete primeros coinciden en grado y apellido y no tienen
 * otro candidato posible.
 */
export const DECISIONES_TARDE: DecisionCentro[] = [
  {
    nombreArchivo: 'ALVAREZ IAM',
    accion: 'ubicar',
    nombreMatricula: 'ALVAREZ SANCHEZ IAN ARLEY',
    grado: '8º1',
    motivo: 'Mismo grado, apellido y nombre reconocible. Sin otro candidato.',
  },
  {
    nombreArchivo: 'RAMIREZCARRASQUILLA MATIAS',
    accion: 'ubicar',
    nombreMatricula: 'RAMIREZ CARRASQUILLA MATIAS',
    grado: '7º2',
    motivo: 'Falta el espacio entre los dos apellidos. Coincidencia exacta al separarlos.',
  },
  {
    nombreArchivo: 'VELILLA EMMANUEL',
    accion: 'ubicar',
    nombreMatricula: 'VELILLA SOCORRO EMANUEL DAVID',
    grado: '7º3',
    motivo: 'Mismo grado y apellido. Sin otro candidato.',
  },
  {
    nombreArchivo: 'MOSQUERA ISABELLA',
    accion: 'ubicar',
    nombreMatricula: 'MOSQUERA GARCES ISABELA',
    grado: '8º3',
    motivo: 'Mismo grado y apellido; una sola L de diferencia. Sin otro candidato.',
  },
  {
    nombreArchivo: 'PEREZ FRANCO JEAN PAUL',
    accion: 'ubicar',
    nombreMatricula: 'PEREZ FRANCO JAMPOOL',
    grado: '6º3',
    motivo: 'Mismos dos apellidos y grado. "Jean Paul" es la grafia culta de "Jampool".',
  },
  {
    nombreArchivo: 'PINEDA EMANUEL',
    accion: 'ubicar',
    nombreMatricula: 'PINEDA TARAZONA EMMANUEL',
    grado: '6º3',
    motivo: 'Mismo grado y apellido. Sin otro candidato.',
  },
  {
    nombreArchivo: 'ROA MIGUEL ANYER',
    accion: 'ubicar',
    nombreMatricula: 'RUA ATEHORTUA MIGUEL ANYEL',
    grado: '8º1',
    motivo: 'ROA es RUA mal escrito; el nombre propio "Anyel/Anyer" coincide y no hay otro en 8º1.',
  },
  // OJO: este NO se da por bueno. El apellido cambia de verdad (Castellañeda ->
  // Castaneda Bravo), no es una errata de una letra. Se deja fuera a proposito para que
  // caiga en la bandeja y lo confirme la coordinadora.
];
