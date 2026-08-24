// Guía de primeros auxilios — fichas de consulta.
//
// FUENTE: «Primeros auxilios para todas las personas. Guía accesible en
// lectura fácil», Plena inclusión Región de Murcia, 2024.
// ISBN 978-84-09-59496-2 · Depósito Legal MU 275-2024.
//
// LICENCIA (textual, de la propia publicación): «Se permite la difusión y
// reproducción de esta obra siempre que sea sin fines comerciales y
// mencionando a los autores y al editor.» Esta aplicación es de uso
// institucional sin fines comerciales y cita autores y editor en la propia
// interfaz (ver ATRIBUCION), así que el uso queda dentro de esa licencia.
//
// POR QUÉ ESTA FUENTE Y NO LAS FICHAS DE CARM: las 21 fichas de la
// Consejería de Salud de la Región de Murcia están publicadas como imágenes
// y solo llevan un aviso de copyright, sin permiso expreso de
// reutilización. Esta guía sí lo lleva, y además está redactada en Lectura
// Fácil (norma UNE 153101:2018 EX, validada por personas con discapacidad
// intelectual): frases cortas y lenguaje llano, que es justo lo que se
// necesita leyendo un celular bajo estrés.
//
// ⚠️ ÚNICA ADAPTACIÓN DE CONTENIDO: el original dice «112» (número de
// emergencias de España). Aquí dice «123», que es el de Colombia. Es un
// cambio de seguridad, no de estilo: dejar el 112 haría marcar un número
// que no existe aquí. Todo lo demás se transcribe fiel, sin reescribir.
//
// ⚠️ DOS PUNTOS PARA QUE REVISE EL COPASST — ver NOTAS_REVISION al final.

/** Tonos disponibles, mapeados a los tokens semánticos de la app. */
export type TonoFicha = 'azul' | 'verde' | 'naranja' | 'rojo' | 'morado' | 'teal';

export type TipoBloque = 'texto' | 'pasos' | 'hacer' | 'no_hacer' | 'aviso' | 'foto';

export interface BloqueFicha {
  tipo: TipoBloque;
  titulo?: string;
  texto?: string;
  items?: string[];
  /** Solo para tipo 'foto': nombre del archivo en public/fotos-brigada/, p. ej. 'cabestrillo.jpg'. */
  foto?: string;
  /** Solo para tipo 'foto': pie de foto, también usado como alt descriptivo. */
  pie?: string;
}

/** Identificador de fuente bibliográfica — cada ficha declara la suya en `fuente`. */
export type FuenteId = 'plena_inclusion' | 'armada';

export interface FichaAuxilios {
  id: string;
  numero: number;
  /** Etiqueta de la pastilla — corta a propósito, se toca con prisa. */
  titulo: string;
  /** Una línea que aclara cuándo sirve esta ficha. */
  resumen: string;
  icono: string;
  tono: TonoFicha;
  bloques: BloqueFicha[];
  /** Si la ficha debe ofrecer el botón de llamar al 123. */
  llamar123?: boolean;
  /** Qué fuente respalda esta ficha (ver FUENTES). Por defecto: plena_inclusion. */
  fuente?: FuenteId;
  /** Ficha técnica dirigida a la brigada, no a cualquier docente. */
  soloBrigada?: boolean;
}

/** Atribución de la guía de lectura fácil — se mantiene igual que antes, sin alterar. */
export const ATRIBUCION = {
  obra: 'Primeros auxilios para todas las personas. Guía accesible en lectura fácil',
  editor: 'Plena inclusión Región de Murcia',
  anio: 2024,
  isbn: '978-84-09-59496-2',
  nota: 'Reproducida sin fines comerciales, citando autores y editor, según la licencia de la propia obra.',
} as const;

/**
 * Mapa de fuentes bibliográficas usadas por las fichas. Se agregó la
 * Cartilla de la Armada al incorporar las fichas de vendajes y fracturas
 * (fichas 10 y 11). ATRIBUCION se conserva tal cual para no romper nada
 * que ya dependiera de ella; FUENTES.plena_inclusion es su equivalente
 * dentro del mapa nuevo.
 */
export const FUENTES: Record<FuenteId, {
  obra: string;
  editor: string;
  anio: number;
  nota: string;
  url?: string;
}> = {
  plena_inclusion: {
    obra: ATRIBUCION.obra,
    editor: ATRIBUCION.editor,
    anio: ATRIBUCION.anio,
    nota: ATRIBUCION.nota,
  },
  armada: {
    obra: 'Cartilla de Primeros Auxilios',
    editor: 'Armada Nacional de Colombia — Infantería de Marina',
    anio: 2007,
    nota: 'Transcrita del capítulo de vendajes y del capítulo de lesiones en huesos y articulaciones. Se omitieron deliberadamente la recomendación de medicar con aspirina/acetaminofén y las férulas neumáticas (ver NOTAS_REVISION).',
    url: 'https://www.armada.mil.co/sites/default/files/013._cartilla_de_primeros_auxilios_17-dic-2007.pdf',
  },
};

export const FICHAS_AUXILIOS: FichaAuxilios[] = [
  {
    id: 'pas',
    numero: 1,
    titulo: 'La regla PAS',
    resumen: 'Lo primero, siempre y en este orden',
    icono: '🛡️',
    tono: 'azul',
    llamar123: true,
    bloques: [
      {
        tipo: 'texto',
        texto: 'La regla PAS se llama así por la primera letra de cada paso: Proteger, Avisar, Socorrer. Es muy importante seguir el orden.',
      },
      {
        tipo: 'pasos',
        titulo: '1. Proteger',
        items: [
          'Protégete a ti mismo o a ti misma. ¡Si no, no podrás ayudar a nadie!',
          'Protege a la víctima de la emergencia. Aléjala del peligro o elimínalo si puedes.',
          'Protege a otras personas para que no haya más heridos.',
        ],
      },
      {
        tipo: 'pasos',
        titulo: '2. Avisar',
        items: [
          'Llama por teléfono al número 123. Es el teléfono de emergencias.',
          'Allí avisarán a la ambulancia, a los bomberos o a la policía si hace falta.',
          'Para que puedan ir rápido, explica de forma clara qué ha pasado y dónde estás.',
          'Si no sabes la dirección exacta, explica qué tienes cerca.',
        ],
      },
      {
        tipo: 'pasos',
        titulo: '3. Socorrer',
        items: [
          'Mantén la calma y tranquiliza también a la víctima. Dile que la ayuda está de camino.',
          'No la muevas ni la cambies de sitio.',
          'Revisa cómo está la víctima.',
        ],
      },
    ],
  },
  {
    id: 'revisar',
    numero: 2,
    titulo: 'Revisar a la víctima',
    resumen: 'Consciencia, respiración y heridas',
    icono: '🩺',
    tono: 'azul',
    bloques: [
      { tipo: 'texto', texto: 'La revisión se hace en 3 pasos.' },
      {
        tipo: 'pasos',
        titulo: '1. Comprobar si está consciente',
        items: [
          'Háblale cerca del oído. Pregúntale «¿Me oyes?» o «¿Estás bien?».',
          'Si responde, salta al paso 3: buscar heridas.',
          'Si no responde, pellízcale. Si reacciona, salta al paso 3.',
          'Si no reacciona, sigue con el paso 2: comprobar la respiración.',
        ],
      },
      {
        tipo: 'pasos',
        titulo: '2. Comprobar la respiración',
        items: [
          'Mira si su pecho se mueve con la respiración.',
          'Escucha si su boca o nariz toman y echan aire.',
          'Pon la mano sobre su pecho.',
          'Si respira, ponla en Posición Lateral de Seguridad.',
          'Si no respira, haz la reanimación.',
        ],
      },
      {
        tipo: 'pasos',
        titulo: '3. Buscar heridas',
        items: [
          'Si la persona está consciente o al menos respira, busca heridas en el cuerpo desde la cabeza hasta los pies: espalda, piernas, barriga…',
          'Si no hay heridas importantes: colócala en una posición cómoda, espera la ayuda, acompáñala y tranquilízala.',
          'Si hay alguna herida importante: sigue las instrucciones de la ficha de heridas.',
        ],
      },
      {
        tipo: 'aviso',
        texto: 'Estar consciente es estar despierta y darse cuenta de las cosas. Lo contrario es estar inconsciente.',
      },
    ],
  },
  {
    id: 'posicion_lateral',
    numero: 3,
    titulo: 'Posición lateral de seguridad',
    resumen: 'Inconsciente pero respira',
    icono: '🛏️',
    tono: 'teal',
    llamar123: true,
    bloques: [
      {
        tipo: 'texto',
        texto: 'Esta posición del cuerpo es para víctimas que no están conscientes pero sí respiran. Así, si la víctima vomita, no se ahoga.',
      },
      {
        tipo: 'no_hacer',
        titulo: 'Cuándo NO usarla',
        items: [
          'No se usa si la víctima se ha dado un golpe fuerte en la espalda. Por ejemplo, en un accidente de moto o bicicleta.',
        ],
      },
      {
        tipo: 'pasos',
        titulo: 'Los ocho pasos',
        items: [
          'Arrodíllate junto a la víctima.',
          'Retira los objetos que puedan hacerle daño: gafas, llaves, móvil…',
          'Dobla el brazo de la víctima más cercano a ti hacia arriba.',
          'Dobla su pierna más alejada hacia ti.',
          'Dobla el otro brazo de la víctima y pon su mano junto a su cabeza.',
          'Cógele por la cadera y el hombro para girarlo despacio hacia ti.',
          'Mantén la calma y llama al teléfono 123.',
          'Cambia a la persona de lado cada 20 minutos hasta que llegue la ayuda.',
        ],
      },
    ],
  },
  {
    id: 'reanimacion',
    numero: 4,
    titulo: 'Reanimación',
    resumen: 'Inconsciente y no respira',
    icono: '❤️',
    tono: 'rojo',
    llamar123: true,
    bloques: [
      {
        tipo: 'aviso',
        texto: 'Antes de nada: llama al 123. Después haz la reanimación hasta que la persona se mueva o abra los ojos, o hasta que llegue la ayuda.',
      },
      {
        tipo: 'texto',
        texto: 'La reanimación es una ayuda para personas que están inconscientes y no respiran. Eso significa que sus pulmones y su corazón se han parado: está en peligro y necesita ayuda muy rápida.',
      },
      {
        tipo: 'pasos',
        titulo: 'A) Reanimar los latidos',
        items: [
          'Coloca a la víctima tumbada hacia arriba.',
          'Ponte de rodillas junto a su pecho.',
          'Busca el punto que está justo en el centro del pecho.',
          'Coloca tus manos entrelazadas en ese punto. Pon la zona más dura de tu mano en ese punto.',
          'Aprieta fuerte en ese punto 30 veces. Intenta apretar el pecho unos 5 centímetros cada vez.',
          'Ve al paso B: reanimar la respiración.',
        ],
      },
      {
        tipo: 'pasos',
        titulo: 'B) Recuperar la respiración',
        items: [
          'Coloca a la víctima tumbada hacia arriba.',
          'Abre su boca: pon una de tus manos en su frente y la otra en su barbilla.',
          'Tapa su nariz con tus dedos.',
          'Respira hondo.',
          'Pon tu boca y pégala a la de la víctima para pasarle el aire sin que se escape.',
          'En esa postura, toma aire por la nariz y suéltalo por la boca con fuerza 2 veces en la boca de la víctima. Comprueba que su pecho se mueve: eso significa que tu aire entra en sus pulmones.',
        ],
      },
      {
        tipo: 'pasos',
        titulo: 'C) Repetir A y B',
        items: [
          'Dos respiraciones y 30 apretones, y vuelta a empezar.',
          'Repite el ejercicio hasta que la persona respire o llegue la ayuda.',
        ],
      },
    ],
  },
  {
    id: 'atragantamiento',
    numero: 5,
    titulo: 'Atragantamiento',
    resumen: 'Algo en la garganta impide respirar',
    icono: '😰',
    tono: 'naranja',
    llamar123: true,
    bloques: [
      {
        tipo: 'texto',
        texto: 'Es cuando una persona no respira bien, o no respira nada, por algo de comida u objetos en su garganta.',
      },
      {
        tipo: 'hacer',
        titulo: 'Si NO respira bien, pero puede toser',
        items: [
          'Anima a la persona a toser hasta que eche la comida que no le deja respirar bien.',
        ],
      },
      {
        tipo: 'no_hacer',
        titulo: 'Si puede toser, lo que NO se hace',
        items: [
          'No le des golpes en la espalda. Eso no le ayuda y puede ser peor.',
        ],
      },
      {
        tipo: 'hacer',
        titulo: 'Si NO respira nada, ni puede toser',
        items: [
          'Intenta sacar la comida de su boca con tus manos.',
          'Intenta sacar la comida apretando debajo de su pecho.',
        ],
      },
    ],
  },
  {
    id: 'convulsiones',
    numero: 6,
    titulo: 'Convulsiones',
    resumen: 'Movimientos que no controla',
    icono: '⚡',
    tono: 'morado',
    llamar123: true,
    bloques: [
      {
        tipo: 'texto',
        texto: 'Las convulsiones son movimientos rápidos y fuertes del cuerpo que la persona no controla. Puede perder la consciencia, caer al suelo y cerrar la boca muy fuerte. Suelen durar unos 5 minutos.',
      },
      {
        tipo: 'hacer',
        titulo: 'Qué hay que hacer',
        items: [
          'Tumba a la persona.',
          'Quita las cosas que se le puedan caer encima.',
          'Cuando no convulsione, colócala en Posición Lateral de Seguridad.',
        ],
      },
      {
        tipo: 'no_hacer',
        titulo: 'Qué NO hay que hacer',
        items: ['No la sujetes.', 'No le des agua ni comida.', 'No la dejes sola.'],
      },
      {
        tipo: 'aviso',
        texto: 'Una de las causas de las convulsiones es la epilepsia, una enfermedad que puede provocar desmayos o convulsiones.',
      },
    ],
  },
  {
    id: 'heridas',
    numero: 7,
    titulo: 'Heridas',
    resumen: 'Cortes, arañazos, mordeduras',
    icono: '🩹',
    tono: 'rojo',
    llamar123: true,
    bloques: [
      {
        tipo: 'texto',
        texto: 'Las heridas son daños que rompen la piel u otras partes del cuerpo: cortes, arañazos y mordeduras. Una herida puede sangrar.',
      },
      {
        tipo: 'aviso',
        texto: 'Cada tipo de herida se cura de una forma diferente. Lo mejor es esperar la ayuda de enfermeros y médicos del 123.',
      },
      {
        tipo: 'hacer',
        titulo: 'Si la víctima sangra',
        items: [
          'Aprieta la herida con una gasa limpia.',
          'Lava la herida con agua y jabón.',
          'Tapa la herida con otra gasa limpia.',
        ],
      },
      {
        tipo: 'no_hacer',
        titulo: 'Qué NO hay que hacer',
        items: ['No toques la herida.', 'No eches alcohol.'],
      },
    ],
  },
  {
    id: 'golpes',
    numero: 8,
    titulo: 'Golpes',
    resumen: 'Caídas, fracturas, contusiones',
    icono: '🧊',
    tono: 'naranja',
    llamar123: true,
    bloques: [
      {
        tipo: 'texto',
        texto: 'Ejemplos de golpe son: algo que cae sobre la cabeza, una pierna rota al caer de la bicicleta, o daño en una rodilla al tropezar.',
      },
      {
        tipo: 'hacer',
        titulo: 'Qué hay que hacer',
        items: ['Poner hielo en la parte del cuerpo donde se ha dado el golpe.'],
      },
      {
        tipo: 'no_hacer',
        titulo: 'Qué NO hay que hacer',
        items: ['No mover la parte del cuerpo donde se ha dado el golpe.'],
      },
    ],
  },
  {
    id: 'que_son',
    numero: 9,
    titulo: '¿Qué son los primeros auxilios?',
    resumen: 'Para leer con calma, antes de necesitarlo',
    icono: '📘',
    tono: 'verde',
    bloques: [
      {
        tipo: 'texto',
        texto: 'Los primeros auxilios son las ayudas a una persona en un accidente o un problema de salud inesperado. Es la ayuda que damos las personas que estamos cerca en ese mismo momento, hasta que llegan los médicos o enfermeros.',
      },
      {
        tipo: 'aviso',
        texto: 'El objetivo de esta ayuda no es curar o arreglar el problema. El objetivo es que el problema no empeore hasta que llegan los médicos o enfermeros del 123.',
      },
      {
        tipo: 'texto',
        texto: 'Algunos ejemplos en los que podemos ayudar son una caída, un corte o un desmayo. En casos así podemos ser muy útiles para cuidar a la persona.',
      },
      {
        tipo: 'pasos',
        titulo: 'Lo más importante, en este orden',
        items: [
          'Proteger a la persona.',
          'Avisar a los servicios de emergencia del 123.',
          'Tranquilizar a la persona mientras esperamos a los médicos o enfermeros.',
        ],
      },
    ],
  },
  {
    id: 'fracturas_luxaciones_esguinces',
    numero: 10,
    titulo: 'Golpes en huesos y articulaciones',
    resumen: 'Fractura, luxación o esguince — qué NO hacer',
    icono: '🦴',
    tono: 'naranja',
    llamar123: true,
    fuente: 'armada',
    bloques: [
      {
        tipo: 'texto',
        texto: 'A veces es difícil distinguir si una lesión es una fractura (el hueso se rompe), una luxación (el hueso se sale de su articulación) o un esguince (se lastiman los tejidos al torcer una articulación). Cuando no esté seguro acerca de cuál es la lesión, trátela como si fuera una fractura.',
      },
      {
        tipo: 'no_hacer',
        titulo: 'Lo que NUNCA se hace',
        items: [
          'No intentar colocar el hueso en su sitio.',
          'No mover la parte afectada innecesariamente.',
          'No hacer masajes.',
          'No untar pomadas.',
        ],
      },
      {
        tipo: 'pasos',
        titulo: 'Signos y síntomas',
        items: [
          'Deformidad en la articulación.',
          'Dolor en la articulación o dolor muscular.',
          'Incapacidad de movimiento o rigidez articular.',
          'Edema o inflamación.',
          'Decoloración de la piel, especialmente equimosis (morado).',
        ],
      },
      {
        tipo: 'hacer',
        titulo: 'Primeros auxilios de un esguince',
        items: [
          'Aplicar hielo inmediatamente para reducir la inflamación, envolviendo el hielo en un pedazo de tela y evitando aplicarlo directamente sobre la piel.',
          'No mover el área afectada: colocar un vendaje firme pero no apretado sobre ella.',
          'Mantener elevada la articulación inflamada por encima del nivel del corazón, incluso mientras se duerme.',
          'Dejar en reposo la articulación afectada por varios días.',
        ],
      },
      {
        tipo: 'aviso',
        texto: 'Si hay herida abierta, cúbrala con un trapo limpio e inmovilice a la persona sin intentar nada más. Esta ficha es solo lo esencial: la técnica de vendajes e inmovilización la aplica la brigada.',
      },
    ],
  },
  {
    id: 'vendajes_inmovilizacion_brigada',
    numero: 11,
    titulo: 'Vendajes e inmovilización (brigada)',
    resumen: 'Técnica de vendaje y férulas — solo brigada',
    icono: '🩹',
    tono: 'morado',
    llamar123: true,
    fuente: 'armada',
    soloBrigada: true,
    bloques: [
      {
        tipo: 'aviso',
        texto: 'La ejecución de un vendaje perfecto exige un entrenamiento previo. Esta ficha es para quien ya recibió esa formación, no para improvisar sobre la marcha.',
      },
      {
        tipo: 'pasos',
        titulo: 'Normas generales de todo vendaje',
        items: [
          'Siempre se inicia por la parte más distal (más alejada del corazón), dirigiéndose hacia la raíz del miembro.',
          'Se aplica con una tensión homogénea, ni muy intensa ni muy débil.',
          'Señal de alarma de que quedó apretado: la persona siente hormigueo en los dedos, los nota fríos o hay cambio de coloración. Si ocurre, se afloja.',
          'Se cubren con algodón los salientes óseos y las cavidades naturales (axilas, ingles) antes de vendar.',
          'Se termina con dos vueltas circulares perpendiculares al eje del miembro.',
        ],
      },
      {
        tipo: 'pasos',
        titulo: 'Vendaje en ocho (articulaciones)',
        items: [
          'Se usa en tobillo, rodilla, hombro, codo y muñeca, porque permite cierta movilidad.',
          'Con la articulación ligeramente flexionada, se hace una vuelta circular en medio de la articulación.',
          'La venda se dirige alternando hacia arriba y hacia abajo, cruzándose siempre en el centro de la articulación.',
        ],
      },
      {
        tipo: 'pasos',
        titulo: 'Vendaje para codo o rodilla',
        items: [
          'Con la articulación semiflexionada, dos vueltas circulares en el centro de esta.',
          'Se prosigue con cruzados en 8, alternos sobre brazo/antebrazo o pierna/muslo.',
          'No se debe inmovilizar totalmente la articulación con este vendaje.',
        ],
      },
      {
        tipo: 'pasos',
        titulo: 'Vendaje para tobillo o pie',
        items: [
          'Se comienza con dos circulares a nivel del tobillo.',
          'Varias vueltas en 8 que abarquen alternativamente pie y tobillo, remontando de la parte distal hacia la proximal.',
          'Se termina con dos vueltas circulares a la altura del tobillo y se fija la venda.',
          'No debe apretarse excesivamente: los dedos deben quedar descubiertos para poder controlar la circulación.',
        ],
      },
      {
        tipo: 'pasos',
        titulo: 'Cabestrillo improvisado',
        items: [
          'Se coloca el brazo sobre el pecho, con la mano hacia el hombro contrario a la lesión (o, en fractura de codo/antebrazo, con la mano más alta que el codo).',
          'Se compone con lo que se tenga a la mano: pañoleta, cinturón, corbata o camisa.',
        ],
      },
      {
        tipo: 'pasos',
        titulo: 'Férulas improvisadas',
        items: [
          'Pueden elaborarse con cartón, revistas, madera u otros objetos rígidos.',
          'Se pone material de acolchado entre el objeto rígido y la extremidad, con acolchado extra sobre articulaciones y áreas sensibles.',
          'Se amarra en la parte superior e inferior de la fractura (no solo en un punto).',
          'Si el brazo está en extensión, se coloca una férula y se amarra con vendas triangulares o se asegura contra el cuerpo. Si está flejado, se inmoviliza con férulas rígidas en forma de L.',
        ],
      },
      {
        tipo: 'pasos',
        titulo: 'Inmovilización por zona',
        items: [
          'Clavícula: brazo sobre el pecho, mano hacia el hombro contrario, cabestrillo compuesto.',
          'Brazo: antebrazo flejado sobre el pecho, algodón protegiendo la axila, férula en la parte externa amarrada arriba y abajo de la fractura, y cabestrillo.',
          'Codo o antebrazo: se inmoviliza en la posición en que se encontró. Extendido: férula y vendas triangulares o contra el cuerpo. Flejado: férulas rígidas en L.',
          'Mano y dedos: almohadilla en palma y muñeca, férula desde el codo hasta la punta de los dedos. Una falange se inmoviliza con un baja lenguas acolchado fijado con esparadrapo.',
          'Rodilla: acostar o sentar a la persona, férula por debajo de la pierna desde la región glútea hasta el talón, amarrada, con vendaje en ocho alrededor del tobillo, el pie y la tablilla.',
          'Tibia-peroné (parte inferior de la pierna): dos férulas (interna y externa) desde la parte superior del muslo hasta el tobillo, protegiendo rodilla y tobillo, y amarradas. Con un cartón largo puede hacerse una férula en L.',
          'Tobillo o pie: si el zapato es plano, no se retira porque ayuda a inmovilizar. Férula en L que cubra pie y parte inferior de la pierna. Si no hay férula, una almohada o abrigo hacen de férula blanda.',
        ],
      },
      {
        tipo: 'aviso',
        texto: 'Ante cualquier fractura, se debe verificar el pulso distal (más allá de la lesión) para valorar la circulación de la extremidad fracturada.',
      },
      {
        tipo: 'texto',
        texto: 'Kit de inmovilización del colegio: el colegio cuenta con un kit inmovilizador de cartonplast (fabricante Health Solutions), con 5 piezas: pierna, tobillo, brazo, muñeca y cuello. Es reutilizable, se ajusta con correas y velcro, y es radiolúcido: permite tomar radiografías sin necesidad de retirarlo. No sustituye el criterio de la brigada: se aplican sobre él los mismos principios ya descritos en esta ficha, acolchado entre la pieza rígida y la piel, un amarre por encima y otro por debajo de la lesión, dedos visibles para vigilar la circulación, y aflojar de inmediato si aparece hormigueo, frío o cambio de color.',
      },
      {
        tipo: 'aviso',
        texto: '⚠️ La pieza de CUELLO no debe usarla personal sin entrenamiento formal en inmovilización cervical. Ante sospecha de lesión de columna, lo indicado es NO mover a la persona, estabilizar la cabeza sujetándola con las manos, y esperar la llegada del 123.',
      },
      {
        tipo: 'aviso',
        texto: 'Pendiente: fotos de la brigada aplicando el kit sobre cada pieza (pierna, tobillo, brazo, muñeca, cuello). Se agregarán a esta ficha en cuanto estén disponibles.',
      },
    ],
  },
];

/**
 * Dos divergencias del contenido original que conviene que revise el COPASST
 * antes de quitar la marca BETA. Se transcriben tal cual están en la fuente
 * — no nos corresponde corregir contenido médico de una publicación con
 * asesoramiento técnico — pero tampoco callarlas.
 */
export const NOTAS_REVISION = [
  'Atragantamiento: la fuente dice explícitamente que NO se den golpes en la espalda cuando la persona puede toser. Otros protocolos de primeros auxilios sí contemplan golpes interescapulares cuando la tos es inefectiva. Conviene que el COPASST confirme cuál es la pauta que adopta la institución.',
  'Reanimación: la fuente ordena los pasos como A) 30 compresiones y luego B) 2 respiraciones, pero al describir el ciclo repetido lo enuncia empezando por las dos respiraciones. Conviene aclarar el orden del ciclo.',
  'Fichas 10 y 11 (fracturas, luxaciones, esguinces, vendajes e inmovilización): provienen de la Cartilla de Primeros Auxilios de la Armada Nacional de Colombia — Infantería de Marina (2007), un manual dirigido a personal militar adulto, no a un entorno escolar. Se omitieron a propósito dos contenidos de la fuente: la recomendación de dar una pastilla (aspirina/acetaminofén) ante dolor intenso en luxaciones — medicar a un estudiante no le corresponde a un docente, y la aspirina está contraindicada en menores por el síndrome de Reye — y las férulas neumáticas, que no existen en un botiquín escolar y que la propia fuente advierte que mal aplicadas pueden causar isquemia o síndrome compartimental. La brigada debe validar el contenido técnico de la ficha 11 antes de que salga de BETA.',
] as const;

export function fichaPorId(id: string): FichaAuxilios | undefined {
  return FICHAS_AUXILIOS.find(f => f.id === id);
}
