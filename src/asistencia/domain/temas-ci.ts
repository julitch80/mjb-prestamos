/**
 * Temas de los indicadores de los centros de interes, para buscar por tematica y no por la
 * palabra literal (Julian, 2026-11-09: «si yo le digo "inteligencia artificial", que me
 * muestre cuales indicadores podrian estar asociados»).
 *
 * TRES PIEZAS, todas revisables a mano:
 *  - TEMAS: cada tema con las expresiones que lo encuentran (lo que escribiria un docente)
 *    y sus temas CERCANOS, que salen despues, como «tambien podria servir».
 *  - TEMAS_DE_INDICADOR: los temas de cada uno de los 92 indicadores, asignados leyendo el
 *    texto. Es criterio, no calculo: si un tema sobra o falta, se corrige aqui.
 *  - La busqueda en `buscar-indicadores.ts`.
 *
 * Sin IA en vivo, a proposito: el catalogo son 92 indicadores fijos, asi que preparar los
 * temas una vez da lo mismo, sin internet, sin costo y siempre con el mismo resultado.
 */

export type Tema =
  | 'emociones' | 'convivencia' | 'trabajo_equipo' | 'participacion' | 'asistencia'
  | 'tecnologia' | 'ciencias' | 'ambiente' | 'matematicas' | 'lectura_escritura'
  | 'comunicacion' | 'idiomas' | 'arte' | 'creatividad' | 'musica' | 'danza'
  | 'cuerpo_deporte' | 'autocuidado' | 'ajedrez' | 'territorio' | 'ciudadania'
  | 'electricidad' | 'identidad';

export interface DefTema {
  nombre: string;
  /** Lo que escribiria un docente. Se compara sin tildes ni mayusculas, por raiz. */
  expresiones: string[];
  /** Salen despues de los directos, como sugerencia. */
  cercanos: Tema[];
}

export const TEMAS: Record<Tema, DefTema> = {
  emociones: {
    nombre: 'Emociones y autorregulación',
    expresiones: ['emociones', 'sentimientos', 'autorregulación', 'regulación emocional', 'frustración', 'resiliencia', 'calma', 'ansiedad', 'estrés', 'salud mental', 'bienestar emocional', 'socioemocional', 'inteligencia emocional', 'manejo de emociones'],
    cercanos: ['convivencia', 'identidad'],
  },
  convivencia: {
    nombre: 'Convivencia y respeto',
    expresiones: ['convivencia', 'respeto', 'empatía', 'conflictos', 'resolución de conflictos', 'paz', 'solidaridad', 'valores', 'tolerancia', 'buen trato', 'mediación', 'acoso'],
    cercanos: ['emociones', 'trabajo_equipo', 'ciudadania'],
  },
  trabajo_equipo: {
    nombre: 'Trabajo en equipo',
    expresiones: ['trabajo en equipo', 'colaborativo', 'colaboración', 'cooperación', 'trabajo grupal', 'grupo', 'equipo', 'proyectos colectivos'],
    cercanos: ['convivencia', 'participacion'],
  },
  participacion: {
    nombre: 'Participación y actitud',
    expresiones: ['participación', 'participa', 'compromiso', 'motivación', 'entusiasmo', 'actitud', 'disposición', 'interés', 'desempeño', 'aprendizaje', 'competencias'],
    cercanos: ['trabajo_equipo', 'asistencia'],
  },
  asistencia: {
    nombre: 'Asistencia y puntualidad',
    expresiones: ['asistencia', 'inasistencia', 'faltas', 'ausencias', 'puntualidad', 'horarios', 'cronograma', 'cumplimiento', 'no asiste', 'deserción'],
    cercanos: ['participacion'],
  },
  tecnologia: {
    nombre: 'Tecnología y programación',
    expresiones: ['tecnología', 'programación', 'código', 'robótica', 'robots', 'micro:bit', 'microbit', 'computador', 'computadora', 'digital', 'herramientas digitales', 'inteligencia artificial', 'IA', 'pensamiento computacional', 'informática', 'sistemas', 'STEM', 'STEAM', 'videojuegos', 'internet', 'multimedia'],
    cercanos: ['matematicas', 'ciencias', 'comunicacion'],
  },
  ciencias: {
    nombre: 'Ciencias e investigación',
    expresiones: ['ciencias', 'científico', 'experimentos', 'experimentación', 'observación', 'investigación', 'método científico', 'laboratorio', 'registro', 'bitácora', 'biología'],
    cercanos: ['ambiente', 'tecnologia', 'matematicas'],
  },
  ambiente: {
    nombre: 'Medio ambiente y ecología',
    expresiones: ['medio ambiente', 'ambiental', 'ecología', 'naturaleza', 'huerta', 'plantas', 'cultivos', 'reciclaje', 'sostenibilidad', 'cuidado del entorno', 'agua', 'suelo', 'seres vivos', 'ecosistemas', 'animales'],
    cercanos: ['ciencias', 'territorio'],
  },
  matematicas: {
    nombre: 'Lógica y matemáticas',
    expresiones: ['matemáticas', 'lógica', 'lógico-matemático', 'razonamiento', 'resolver problemas', 'resolución de problemas', 'retos', 'cálculo', 'números', 'estrategia'],
    cercanos: ['tecnologia', 'ajedrez', 'ciencias'],
  },
  lectura_escritura: {
    nombre: 'Lectura y escritura',
    expresiones: ['lectura', 'leer', 'escritura', 'escribir', 'literatura', 'cuentos', 'textos', 'poesía', 'haikus', 'narrativa', 'El Principito', 'libros', 'redacción', 'lenguaje', 'producción textual'],
    cercanos: ['comunicacion', 'identidad', 'idiomas'],
  },
  comunicacion: {
    nombre: 'Comunicación y medios',
    expresiones: ['comunicación', 'expresión oral', 'oralidad', 'expresar ideas', 'medios de comunicación', 'podcast', 'radio', 'audiovisual', 'periodismo', 'video', 'fotografía', 'entrevistas', 'asertiva'],
    cercanos: ['lectura_escritura', 'tecnologia'],
  },
  idiomas: {
    nombre: 'Inglés e idiomas',
    expresiones: ['inglés', 'idioma extranjero', 'idiomas', 'English', 'bilingüismo', 'lengua extranjera'],
    cercanos: ['lectura_escritura', 'comunicacion'],
  },
  arte: {
    nombre: 'Artes plásticas y escénicas',
    expresiones: ['arte', 'artístico', 'artes plásticas', 'dibujo', 'pintura', 'mandalas', 'collage', 'manualidades', 'teatro', 'dramatización', 'mímica', 'expresión artística'],
    cercanos: ['creatividad', 'musica', 'danza'],
  },
  creatividad: {
    nombre: 'Creatividad e imaginación',
    expresiones: ['creatividad', 'creativo', 'imaginación', 'innovación', 'soluciones creativas', 'crear', 'proponer ideas', 'emprendimiento'],
    cercanos: ['arte'],
  },
  musica: {
    nombre: 'Música',
    expresiones: ['música', 'musical', 'ritmos', 'ensamble', 'instrumentos', 'canto', 'banda', 'sonido'],
    cercanos: ['danza', 'arte'],
  },
  danza: {
    nombre: 'Danza',
    expresiones: ['danza', 'baile', 'bailar', 'coreografía', 'folclor', 'folclórica', 'ritmos colombianos'],
    cercanos: ['musica', 'cuerpo_deporte', 'arte'],
  },
  cuerpo_deporte: {
    nombre: 'Cuerpo, juego y deporte',
    expresiones: ['deporte', 'deportiva', 'actividad física', 'educación física', 'cuerpo', 'corporal', 'movimiento', 'juego', 'yoga', 'respiración', 'equilibrio', 'motricidad', 'salud física'],
    cercanos: ['autocuidado', 'danza'],
  },
  autocuidado: {
    nombre: 'Autocuidado y vida saludable',
    expresiones: ['autocuidado', 'higiene', 'alimentación', 'nutrición', 'hábitos saludables', 'vida saludable', 'salud', 'bienestar'],
    cercanos: ['cuerpo_deporte', 'emociones'],
  },
  ajedrez: {
    nombre: 'Ajedrez',
    expresiones: ['ajedrez', 'jaque', 'tablero', 'juegos de mesa', 'estrategia'],
    cercanos: ['matematicas'],
  },
  territorio: {
    nombre: 'Territorio, memoria y geografía',
    expresiones: ['territorio', 'memoria histórica', 'historia', 'geografía', 'geógrafo', 'mapas', 'espacio', 'entorno local', 'comunidad', 'San Antonio de Prado', 'barrio', 'patrimonio', 'cultura'],
    cercanos: ['ciudadania', 'ambiente'],
  },
  ciudadania: {
    nombre: 'Ciudadanía, derechos y liderazgo',
    expresiones: ['ciudadanía', 'derechos humanos', 'derechos', 'democracia', 'liderazgo', 'líder', 'ética', 'filosofía', 'pensamiento crítico', 'participación ciudadana', 'gobierno escolar', 'manual de convivencia'],
    cercanos: ['convivencia', 'territorio'],
  },
  electricidad: {
    nombre: 'Electricidad y oficios técnicos',
    expresiones: ['electricidad', 'eléctrico', 'circuitos', 'instalaciones', 'interruptor', 'técnica', 'oficios', 'media técnica'],
    cercanos: ['tecnologia', 'matematicas'],
  },
  identidad: {
    nombre: 'Identidad y proyecto de vida',
    expresiones: ['identidad', 'autoconocimiento', 'proyecto de vida', 'autoestima', 'quién soy', 'historia personal', 'confianza en sí mismo', 'reflexión personal'],
    cercanos: ['emociones', 'lectura_escritura'],
  },
};

/** Los temas de cada indicador (codigo de Basico, 601-692). */
export const TEMAS_DE_INDICADOR: Record<number, Tema[]> = {
  601: ['ciencias', 'participacion'],
  602: ['participacion', 'trabajo_equipo', 'ambiente'],
  603: ['autocuidado', 'cuerpo_deporte'],
  604: ['autocuidado'],
  605: ['emociones', 'cuerpo_deporte', 'convivencia'],
  606: ['emociones', 'cuerpo_deporte', 'convivencia'],
  607: ['emociones', 'creatividad', 'arte', 'trabajo_equipo'],
  608: ['participacion', 'cuerpo_deporte', 'autocuidado', 'emociones'],
  609: ['asistencia'],
  610: ['emociones', 'lectura_escritura'],
  611: ['identidad', 'emociones'],
  612: ['creatividad', 'arte', 'lectura_escritura'],
  613: ['convivencia'],
  614: ['emociones'],
  615: ['emociones', 'comunicacion', 'arte', 'cuerpo_deporte'],
  616: ['convivencia', 'emociones'],
  617: ['emociones'],
  618: ['participacion', 'emociones', 'comunicacion'],
  619: ['matematicas', 'participacion'],
  620: ['tecnologia', 'ciencias'],
  621: ['emociones', 'trabajo_equipo', 'convivencia'],
  622: ['ajedrez'],
  623: ['ajedrez', 'matematicas'],
  624: ['ajedrez', 'asistencia'],
  625: ['emociones', 'comunicacion'],
  626: ['cuerpo_deporte'],
  627: ['cuerpo_deporte'],
  628: ['emociones', 'convivencia'],
  629: ['lectura_escritura', 'identidad'],
  630: ['arte', 'identidad', 'creatividad', 'cuerpo_deporte'],
  631: ['cuerpo_deporte', 'musica', 'danza'],
  632: ['danza', 'musica', 'territorio'],
  633: ['danza', 'emociones', 'convivencia', 'trabajo_equipo'],
  634: ['asistencia', 'danza'],
  635: ['lectura_escritura', 'participacion'],
  636: ['lectura_escritura', 'emociones'],
  637: ['territorio', 'participacion', 'trabajo_equipo'],
  638: ['territorio', 'trabajo_equipo'],
  639: ['trabajo_equipo', 'convivencia', 'ambiente'],
  640: ['participacion', 'ambiente'],
  641: ['ambiente', 'lectura_escritura'],
  642: ['convivencia', 'trabajo_equipo', 'ambiente'],
  643: ['idiomas', 'participacion'],
  644: ['idiomas', 'lectura_escritura'],
  645: ['idiomas', 'emociones', 'comunicacion'],
  646: ['lectura_escritura', 'comunicacion', 'tecnologia'],
  647: ['trabajo_equipo', 'convivencia'],
  648: ['lectura_escritura', 'identidad'],
  649: ['lectura_escritura', 'convivencia', 'identidad'],
  650: ['lectura_escritura', 'emociones'],
  651: ['danza', 'creatividad', 'trabajo_equipo'],
  652: ['emociones', 'ambiente', 'cuerpo_deporte'],
  653: ['participacion', 'trabajo_equipo', 'ambiente'],
  654: ['asistencia', 'ambiente'],
  655: ['ambiente'],
  656: ['ambiente', 'ciencias'],
  657: ['ambiente'],
  658: ['arte', 'creatividad', 'ciudadania'],
  659: ['arte', 'emociones'],
  660: ['territorio'],
  661: ['territorio', 'ciencias', 'comunicacion'],
  662: ['territorio', 'trabajo_equipo', 'identidad'],
  663: ['lectura_escritura', 'convivencia', 'identidad'],
  664: ['lectura_escritura', 'emociones'],
  665: ['territorio', 'ciudadania'],
  666: ['comunicacion', 'tecnologia', 'ciudadania'],
  667: ['trabajo_equipo', 'ciudadania', 'comunicacion', 'convivencia'],
  668: ['emociones', 'ciudadania', 'identidad'],
  669: ['emociones', 'identidad'],
  670: ['convivencia', 'emociones'],
  671: ['emociones', 'arte'],
  672: ['participacion'],
  673: ['asistencia'],
  674: ['electricidad'],
  675: ['electricidad', 'matematicas'],
  676: ['participacion'],
  677: ['participacion'],
  678: ['convivencia', 'trabajo_equipo', 'emociones'],
  679: ['creatividad', 'participacion'],
  680: ['tecnologia', 'matematicas'],
  681: ['emociones'],
  682: ['comunicacion', 'lectura_escritura'],
  683: ['tecnologia', 'comunicacion', 'lectura_escritura'],
  684: ['ciudadania', 'comunicacion'],
  685: ['emociones', 'cuerpo_deporte'],
  686: ['emociones', 'creatividad'],
  687: ['musica', 'trabajo_equipo', 'creatividad'],
  688: ['asistencia', 'trabajo_equipo'],
  689: ['lectura_escritura', 'identidad'],
  690: ['arte', 'emociones'],
  691: ['asistencia'],
  692: ['emociones', 'comunicacion'],
};
