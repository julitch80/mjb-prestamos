// Píldoras de estudio personal (docs/pildoras-estudio-personal.md, aprobadas por
// Julián el 16-09-2026). GENERADO desde ese documento: si cambia el texto, se
// edita allá y se vuelve a copiar, para que ambos no diverjan.
//
// Tres colecciones: COMUN (6º a 11º), FAMILIA (solo 6º y 7º, todavía acompañados
// en casa) y AUTONOMIA (8º a 11º). Ver `coleccionDeGrupo`.

export interface Pildora {
  id: string;
  titulo: string;
  texto: string;
  /** Acción concreta para hacer hoy, si la hay. */
  pruebalo?: string;
  /** Sitio gratuito para aprender más. */
  enlace?: string;
  /** Trata del uso de la inteligencia artificial. */
  ia: boolean;
}

export const PILDORAS_COMUN: Pildora[] = [
  {
    "id": "C1",
    "titulo": "Releer no es estudiar",
    "texto": "Leer tres veces el cuaderno se siente como estudiar, pero se olvida rápido. Lo que sí funciona es cerrar el cuaderno e intentar recordar.",
    "ia": false,
    "pruebalo": "lee una página, ciérrala y escribe todo lo que recuerdes. Después compara."
  },
  {
    "id": "C2",
    "titulo": "Pregúntate a ti mismo",
    "texto": "Convierte tus apuntes en preguntas: «¿Qué es la fotosíntesis?», «¿Por qué pasó esto?». Responderlas sin mirar es de las mejores formas de aprender.",
    "ia": false,
    "pruebalo": "escribe cinco preguntas de un tema y respóndelas mañana."
  },
  {
    "id": "C3",
    "titulo": "Poquito cada día gana",
    "texto": "Estudiar 20 minutos durante cinco días rinde más que dos horas la noche antes. El cerebro necesita tiempo entre repaso y repaso para guardar lo aprendido.",
    "ia": false
  },
  {
    "id": "C4",
    "titulo": "Explícaselo a alguien",
    "texto": "Si puedes explicar un tema con tus palabras a otra persona, lo entendiste. Si te enredas, ya sabes qué repasar.",
    "ia": false,
    "pruebalo": "explícale a alguien de tu casa lo que viste hoy en una materia."
  },
  {
    "id": "C5",
    "titulo": "Un mapa en vez de un resumen largo",
    "texto": "Pon la idea principal en el centro de una hoja y dibuja flechas hacia las ideas que salen de ella. Ver cómo se conectan ayuda a recordar.",
    "ia": false
  },
  {
    "id": "C6",
    "titulo": "Mezcla los ejercicios",
    "texto": "En matemáticas o física, no hagas diez ejercicios iguales seguidos. Mezclar tipos distintos obliga a pensar cuál método usar, y eso es lo que te preguntan en la evaluación.",
    "ia": false
  },
  {
    "id": "C7",
    "titulo": "Equivocarse también es estudiar",
    "texto": "Cuando fallas una pregunta practicando, el cerebro presta más atención a la respuesta correcta. Los errores en casa evitan errores en la evaluación.",
    "ia": false
  },
  {
    "id": "C8",
    "titulo": "La técnica de los 25 minutos",
    "texto": "Trabaja 25 minutos sin interrupciones y descansa 5. Es la técnica Pomodoro, y por eso los momentos de tus tareas duran 25 minutos.",
    "ia": false,
    "enlace": "https://es.wikipedia.org/wiki/T%C3%A9cnica_Pomodoro"
  },
  {
    "id": "C9",
    "titulo": "Aprende gratis en Khan Academy",
    "texto": "Si un tema no te quedó claro, Khan Academy tiene videos y ejercicios gratuitos en español de matemáticas, ciencias y más.",
    "ia": false,
    "enlace": "https://es.khanacademy.org"
  },
  {
    "id": "C10",
    "titulo": "El celular, lejos",
    "texto": "Tenerlo al lado, aunque no lo toques, distrae. Déjalo en otro cuarto o bocabajo y en silencio mientras estudias.",
    "ia": false
  },
  {
    "id": "C11",
    "titulo": "Un solo lugar para estudiar",
    "texto": "Estudia siempre en el mismo sitio, con buena luz y sin la televisión prendida. Con el tiempo, sentarte ahí le avisa a tu cabeza que es hora de concentrarse.",
    "ia": false
  },
  {
    "id": "C12",
    "titulo": "Empieza por lo más difícil",
    "texto": "Al comienzo tienes más energía. Deja lo fácil para el final, cuando ya estés cansado.",
    "ia": false
  },
  {
    "id": "C13",
    "titulo": "Dormir también es estudiar",
    "texto": "Mientras duermes, el cerebro ordena lo que aprendiste en el día. Trasnochar antes de una evaluación hace que rindas menos.",
    "ia": false
  },
  {
    "id": "C14",
    "titulo": "Agua y un descanso de verdad",
    "texto": "En el descanso de 5 minutos, levántate, toma agua y mira lejos. Revisar redes sociales no descansa la mente.",
    "ia": false
  },
  {
    "id": "C15",
    "titulo": "Tachar se siente bien",
    "texto": "Cuando termines una tarea, táchala en tu agenda. Ver lo que ya lograste te da ganas de seguir.",
    "ia": false
  },
  {
    "id": "C16",
    "titulo": "Si no entiendes, pregunta",
    "texto": "Anota la duda y pregúntale al profesor en la próxima clase. Nadie aprende todo solo, y preguntar es de valientes.",
    "ia": false
  },
  {
    "id": "C17",
    "titulo": "Cuaderno al día",
    "texto": "Diez minutos al llegar a casa para completar lo que no alcanzaste a copiar evitan que se te acumule todo al final del periodo.",
    "ia": false
  },
  {
    "id": "C18",
    "titulo": "La IA puede equivocarse",
    "texto": "Las inteligencias artificiales como ChatGPT o Gemini a veces inventan datos, fechas o fuentes con mucha seguridad. Siempre verifica en tu cuaderno, en un libro o con tu profesor.",
    "ia": true
  },
  {
    "id": "C19",
    "titulo": "Que te explique, no que te lo haga",
    "texto": "Pídele a la IA: «Explícame paso a paso cómo se resuelve esto», no «Resuélveme la tarea». Si solo copias la respuesta, la tarea queda hecha pero tú no aprendiste.",
    "ia": true
  },
  {
    "id": "C20",
    "titulo": "Pídele que te pregunte",
    "texto": "Una buena forma de estudiar con IA: «Hazme cinco preguntas sobre el sistema solar y dime si mis respuestas están bien». Así la usas para practicar, no para copiar.",
    "ia": true
  },
  {
    "id": "C21",
    "titulo": "Tu tarea, tus palabras",
    "texto": "Si la IA te ayudó a entender, cierra el chat y escribe la respuesta tú mismo. Si no puedes escribirla sin mirar, todavía no lo entendiste.",
    "ia": true
  },
  {
    "id": "C22",
    "titulo": "Tus datos son tuyos",
    "texto": "No escribas en una IA tu nombre completo, tu dirección, tu teléfono ni fotos tuyas o de otras personas. Lo que escribes puede guardarse.",
    "ia": true
  },
  {
    "id": "C23",
    "titulo": "No todo lo que ves es real",
    "texto": "Hoy la IA puede crear fotos, voces y videos falsos que parecen reales. Antes de creer o compartir algo sorprendente, pregúntate quién lo publicó.",
    "ia": true
  },
  {
    "id": "C24",
    "titulo": "La IA no reemplaza pensar",
    "texto": "La IA puede darte ideas, pero lo que te pide el colegio es que tú aprendas a razonar. Si ella piensa por ti siempre, tu cerebro no se entrena.",
    "ia": true
  },
  {
    "id": "C25",
    "titulo": "Primero intenta tú",
    "texto": "Antes de abrir la IA, dale 10 minutos a la tarea por tu cuenta. Así sabes exactamente en qué te trabaste y la pregunta que le haces es mejor.",
    "ia": true
  },
  {
    "id": "C26",
    "titulo": "Dile al profe que usaste IA",
    "texto": "Si la IA te ayudó en una tarea, cuéntalo. Usarla no está mal; esconderla sí rompe la confianza.",
    "ia": true
  }
];

export const PILDORAS_FAMILIA: Pildora[] = [
  {
    "id": "F1",
    "titulo": "Muéstrale tu agenda a tu familia",
    "texto": "Enséñale a quien te cuida qué tareas tienes esta semana. Así te pueden recordar el momento que elegiste.",
    "ia": false
  },
  {
    "id": "F2",
    "titulo": "Tu momento, en la nevera",
    "texto": "Escribe en un papel a qué hora vas a hacer tus tareas y pégalo donde todos lo vean.",
    "ia": false
  },
  {
    "id": "F3",
    "titulo": "Cuéntale qué aprendiste hoy",
    "texto": "En la comida, cuéntale a tu familia una cosa que aprendiste en el colegio. Contarla te ayuda a recordarla.",
    "ia": false
  },
  {
    "id": "F4",
    "titulo": "Pide ayuda sin pena",
    "texto": "Si no entiendes una tarea, pregúntale a alguien de tu casa. Y si ellos tampoco saben, anota la duda para el profesor: no pasa nada.",
    "ia": false
  },
  {
    "id": "F5",
    "titulo": "Que te tomen la lección",
    "texto": "Pídele a alguien de tu familia que te haga preguntas de lo que estudiaste. Es como un juego, y funciona.",
    "ia": false
  },
  {
    "id": "F6",
    "titulo": "Mochila lista la noche anterior",
    "texto": "Revisa con tu familia el horario de mañana y empaca los cuadernos antes de dormir. Así no se te queda nada.",
    "ia": false
  },
  {
    "id": "F7",
    "titulo": "Primero la tarea, después la pantalla",
    "texto": "Hagan un acuerdo en casa: primero los 25 minutos de tarea, y luego televisión o celular.",
    "ia": false
  },
  {
    "id": "F8",
    "titulo": "Un rincón para estudiar",
    "texto": "Busca con tu familia un lugar tranquilo de la casa para hacer tareas, aunque sea una esquina de la mesa.",
    "ia": false
  },
  {
    "id": "F9",
    "titulo": "La IA, con un adulto al lado",
    "texto": "Si vas a usar una inteligencia artificial, hazlo con alguien grande cerca. Muchas de estas aplicaciones no son para menores de 13 años.",
    "ia": true
  },
  {
    "id": "F10",
    "titulo": "Pregúntale a tu familia antes que a la IA",
    "texto": "Tu familia sabe cosas que ninguna máquina sabe: cómo era el barrio antes, cómo se hace una receta, qué significa un dicho. Pregúntales primero.",
    "ia": true
  },
  {
    "id": "F11",
    "titulo": "Si algo en internet te asusta, cuéntalo",
    "texto": "Si ves un video, una foto o un mensaje raro o que te da miedo, díselo a un adulto de confianza. No es tu culpa y no te vas a meter en problemas.",
    "ia": true
  },
  {
    "id": "F12",
    "titulo": "La IA no es tu amiga",
    "texto": "Algunos chats hablan como si fueran una persona, pero son programas. Tus amigos y tu familia son quienes de verdad te conocen y te cuidan.",
    "ia": true
  }
];

export const PILDORAS_AUTONOMIA: Pildora[] = [
  {
    "id": "A1",
    "titulo": "Planea tu semana el domingo",
    "texto": "Mira tu agenda el domingo y elige desde ya el momento de cada tarea. Diez minutos de plan ahorran la angustia del jueves en la noche.",
    "ia": false
  },
  {
    "id": "A2",
    "titulo": "Divide lo grande",
    "texto": "«Hacer el proyecto» asusta. «Buscar tres fuentes», «hacer el esquema» y «escribir la introducción» son pasos que caben en un momento de 25 minutos.",
    "ia": false
  },
  {
    "id": "A3",
    "titulo": "Estudia para la evaluación desde la semana anterior",
    "texto": "Reparte el repaso en tres o cuatro días cortos antes de la evaluación, en lugar de todo la víspera.",
    "ia": false
  },
  {
    "id": "A4",
    "titulo": "Repasa lo de hace un mes",
    "texto": "Cada tanto, vuelve a practicar un tema viejo. Lo que no se repasa se borra, y las evaluaciones finales y las pruebas Saber lo preguntan.",
    "ia": false
  },
  {
    "id": "A5",
    "titulo": "Haz tu propia prueba",
    "texto": "Antes de una evaluación, escribe las preguntas que tú harías si fueras el profesor, y respóndelas sin mirar.",
    "ia": false
  },
  {
    "id": "A6",
    "titulo": "Aprende a aprender",
    "texto": "Colombia Aprende, del Ministerio de Educación, tiene contenidos gratuitos para estudiantes de todas las áreas.",
    "ia": false,
    "enlace": "https://www.colombiaaprende.edu.co"
  },
  {
    "id": "A7",
    "titulo": "Pruebas Saber: práctica con tiempo",
    "texto": "En 10º y 11º, practica preguntas tipo Saber con reloj. Parte de la prueba es aprender a manejar el tiempo, y eso también se entrena.",
    "ia": false
  },
  {
    "id": "A8",
    "titulo": "Lee algo que te guste",
    "texto": "Leer por gusto —una novela, un cómic, una revista— mejora tu comprensión lectora, que es la base de todas las materias.",
    "ia": false
  },
  {
    "id": "A9",
    "titulo": "Descansa sin culpa",
    "texto": "Estudiar bien incluye parar. El deporte, dormir y ver a tus amigos también son parte de que te vaya bien.",
    "ia": false
  },
  {
    "id": "A10",
    "titulo": "Pide ayuda antes de que sea tarde",
    "texto": "Si una materia se te está complicando, habla con el profesor o con tu director de grupo ahora, no en la última semana del periodo.",
    "ia": false
  },
  {
    "id": "A11",
    "titulo": "Copiar de la IA también es plagio",
    "texto": "Presentar como tuyo un texto que escribió una IA es lo mismo que copiar el trabajo de un compañero. Además, los profesores suelen notarlo.",
    "ia": true
  },
  {
    "id": "A12",
    "titulo": "Pregúntale a la IA por qué",
    "texto": "Cuando la IA te dé una respuesta, pregúntale: «¿Por qué?», «¿Cómo lo sabes?», «¿Qué fuente lo dice?». Si no puede justificarlo, desconfía.",
    "ia": true
  },
  {
    "id": "A13",
    "titulo": "Pídele que critique tu trabajo",
    "texto": "Un buen uso: escribe tú el texto y pídele a la IA que te diga qué está confuso o qué falta. Tú decides qué cambias.",
    "ia": true
  },
  {
    "id": "A14",
    "titulo": "Busca la fuente original",
    "texto": "Si la IA te cita un libro, un artículo o una ley, búscalo tú. A veces inventa referencias que no existen.",
    "ia": true
  },
  {
    "id": "A15",
    "titulo": "La IA tiene sesgos",
    "texto": "La IA aprendió de textos escritos por personas, con sus prejuicios. Puede repetir estereotipos sobre países, mujeres, regiones o culturas. Léela con ojo crítico.",
    "ia": true
  },
  {
    "id": "A16",
    "titulo": "Lo que la IA no sabe de ti",
    "texto": "La IA no conoce tu colegio, tu barrio ni lo que explicó tu profesor en clase. Una respuesta general puede no servir para lo que te pidieron.",
    "ia": true
  },
  {
    "id": "A17",
    "titulo": "Si no puedes defenderlo, no lo entregues",
    "texto": "Antes de entregar algo en lo que te ayudó la IA, pregúntate: ¿podría explicarlo en voz alta frente al profesor? Si no, todavía no es tuyo.",
    "ia": true
  },
  {
    "id": "A18",
    "titulo": "Deepfakes: no los crees ni los compartas",
    "texto": "Hacer fotos o videos falsos de compañeros o profesores con IA puede hacer mucho daño, y en Colombia puede tener consecuencias legales. Si ves uno, repórtalo.",
    "ia": true
  },
  {
    "id": "A19",
    "titulo": "La IA gasta energía",
    "texto": "Cada pregunta a una IA usa electricidad y agua en centros de datos enormes. Úsala cuando te sirva de verdad, no para todo.",
    "ia": true
  },
  {
    "id": "A20",
    "titulo": "Tu cerebro, tu ventaja",
    "texto": "En el futuro todos van a tener IA. Lo que te va a diferenciar es lo que sepas pensar, crear y resolver por tu cuenta. Entrénalo ahora.",
    "ia": true
  }
];

/** Grado numérico del grupo: '6º1' → 6, '10.2' → 10. null si no se reconoce. */
export function gradoDeGrupo(grupo: string): number | null {
  const m = grupo.match(/^(\d{1,2})/);
  return m ? Number(m[1]) : null;
}

/**
 * La colección que ve un grupo: las comunes intercaladas con las de su etapa
 * (dos comunes, una de la etapa), para que no salgan todas las de un tipo
 * seguidas. 6º y 7º: familia; 8º en adelante: autonomía.
 */
export function coleccionDeGrupo(grupo: string): Pildora[] {
  const grado = gradoDeGrupo(grupo);
  const etapa = grado !== null && grado <= 7 ? PILDORAS_FAMILIA : PILDORAS_AUTONOMIA;
  const resultado: Pildora[] = [];
  let c = 0;
  let e = 0;
  while (c < PILDORAS_COMUN.length || e < etapa.length) {
    for (let i = 0; i < 2 && c < PILDORAS_COMUN.length; i++) resultado.push(PILDORAS_COMUN[c++]);
    if (e < etapa.length) resultado.push(etapa[e++]);
  }
  return resultado;
}

const CLAVE = (grupo: string) => `mjb:pildoras:siguiente:${grupo}`;

/**
 * Entrega la siguiente píldora del grupo y avanza. Al terminar la colección
 * vuelve a empezar. El avance se guarda solo en este dispositivo (como los
 * momentos elegidos); si el navegador no deja guardar, igual muestra una.
 */
export function siguientePildora(grupo: string): Pildora {
  const coleccion = coleccionDeGrupo(grupo);
  let indice = 0;
  try {
    indice = Number(localStorage.getItem(CLAVE(grupo)) ?? 0) || 0;
  } catch {
    indice = Math.floor(Math.random() * coleccion.length);
  }
  const pildora = coleccion[indice % coleccion.length];
  try {
    localStorage.setItem(CLAVE(grupo), String((indice + 1) % coleccion.length));
  } catch {
    // Sin almacenamiento: no se recuerda el avance, pero se muestra la píldora.
  }
  return pildora;
}
