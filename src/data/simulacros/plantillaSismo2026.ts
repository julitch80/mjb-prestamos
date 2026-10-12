// Plantilla del simulacro de sismo 2026 (Sede Principal).
// Transcrita de la guía HTML del 11-oct-2026 (guia_simulacro_2026_sede_principal.html).
// Lo fijo vive aquí; lo que cambia (fecha, hora, encargados) vive en Firestore: simulacros/{id}.
// SIN teléfonos: el repositorio es público.

export type RolClave =
  | 'docente' | 'evac' | 'pa' | 'inc' | 'tra' | 'apoyo' | 'port' | 'coord' | 'crono' | 'foto' | 'eval';
export type Fase = 'antes' | 'durante' | 'despues';
export type JornadaId = 'manana' | 'tarde';
/** Clave corta usada en la guía original. */
export type JornadaCorta = 'm' | 't';

export interface RolInfo { k: RolClave; n: string; c: string; d: string }

/** Paso del guion. a y b: minutos respecto al timbre prolongado; la sirena suena en +1. */
export interface Paso {
  f: Fase;
  a: number;
  b: number;
  dur?: string;
  t: string;
  q: string;
  oye?: string;
  medio: string;
  /** Acciones por rol. 'doc' = docente de aula; 'br' = común a las brigadas (evac, pa, inc, tra). */
  doc?: string[];
  br?: string[];
  evac?: string[];
  pa?: string[];
  inc?: string[];
  tra?: string[];
  apoyo?: string[];
  port?: string[];
  coord?: string[];
  crono?: string[];
  foto?: string[];
  eval?: string[];
}

export interface Ruta { k: string; t: string; w: string; o: string[] }

export interface Puesto {
  id: string;
  nombre: string;
  grupo: string;
  rol: RolClave;
  jornadas: 'm' | 't' | 'both';
  nota?: string;
  detalle?: string;
  opcional?: boolean;
}

export interface AsignacionJornada { slot: string | null; porConfirmar?: boolean; textoLibre?: string }
export type Asignaciones = Record<string, { manana?: AsignacionJornada; tarde?: AsignacionJornada }>;

export const ROLES: RolInfo[] = [
 {
  "k": "docente",
  "n": "Docente de aula",
  "c": "docente de aula",
  "d": "Todo el personal a cargo de un grupo"
 },
 {
  "k": "evac",
  "n": "Líder de evacuación",
  "c": "líder de evacuación",
  "d": "Cuida un bloque o un piso"
 },
 {
  "k": "pa",
  "n": "Primeros auxilios",
  "c": "brigadista de primeros auxilios",
  "d": "Brigada"
 },
 {
  "k": "inc",
  "n": "Contra incendios",
  "c": "brigadista contra incendios",
  "d": "Brigada"
 },
 {
  "k": "tra",
  "n": "Tránsito y movilidad",
  "c": "brigadista de tránsito y movilidad",
  "d": "Brigada"
 },
 {
  "k": "apoyo",
  "n": "Apoyo inmediato",
  "c": "apoyo inmediato",
  "d": "Movilidad reducida y apoyo psicosocial"
 },
 {
  "k": "port",
  "n": "Portería y vigilancia",
  "c": "portería y vigilancia",
  "d": "Accesos y portones de salida"
 },
 {
  "k": "coord",
  "n": "Coordinación y PMU",
  "c": "coordinación",
  "d": "Dirección del ejercicio y Puesto de Mando"
 },
 {
  "k": "crono",
  "n": "Cronometraje",
  "c": "cronometrador",
  "d": "Tiempos de evacuación de cada grupo"
 },
 {
  "k": "foto",
  "n": "Registro fotográfico",
  "c": "registro fotográfico",
  "d": "Evidencia para la evaluación"
 },
 {
  "k": "eval",
  "n": "Evaluación",
  "c": "evaluador",
  "d": "Observación con el formato oficial"
 }
];
export const ROLES_DOCENTE: RolClave[] = [
 "docente",
 "evac",
 "pa",
 "inc",
 "tra"
];
export const MISION: Record<RolClave, string> = {
 "docente": "Llevar a tu grupo completo y en calma hasta el patio central, y confirmarlo con la paleta verde. Evacuar es un deber de todo docente a cargo de un grupo, aparezca o no en un listado de brigadas.",
 "evac": "Además de tu propio grupo, cuidas que tu bloque o tu piso salga completo, sin rezagados, y reportas su estado al Puesto de Mando y das la retroalimentación pedagógica a los grupos de tu sector.",
 "pa": "En este ejercicio evacuas con tu grupo y estás atento a cualquier lesión real. Tus funciones especializadas se activan en la Fase 2, que esta vez no se simula.",
 "inc": "En este ejercicio evacuas con tu grupo y das la alerta si aparece un conato real o un riesgo eléctrico. Tus funciones especializadas se activan en la Fase 2, que esta vez no se simula.",
 "tra": "En este ejercicio evacuas con tu grupo y observas el entorno de la sede. Tus funciones especializadas se activan en la Fase 2, que esta vez no se simula.",
 "apoyo": "Acompañas a quienes necesitan ayuda para evacuar y das contención emocional a quien la requiera, durante y después del ejercicio.",
 "port": "Mantienes los accesos controlados y los portones de salida completamente abiertos mientras dure el ejercicio.",
 "coord": "Diriges el ejercicio: das las alertas, mantienes el Puesto de Mando, consolidas los reportes y decides el regreso a las aulas.",
 "crono": "Mides el tiempo de evacuación de cada grupo, desde la sirena hasta que levanta la paleta verde.",
 "foto": "Documentas el ejercicio en los puntos asignados para que la evaluación tenga evidencia.",
 "eval": "Observas el ejercicio y lo evalúas con el formato oficial: objetivos, estructura, flujo de información, suministros, guion y Puesto de Mando."
};
export const PASOS: Paso[] = [
 {
  "f": "antes",
  "a": -60,
  "b": -45,
  "t": "Convocatoria e instalación del Puesto de Mando",
  "q": "Responsables, brigadistas y líderes se reúnen en Coordinación, verifican las condiciones de la sede e instalan el Puesto de Mando Unificado (PMU).",
  "medio": "Convocatoria previa",
  "doc": [],
  "br": [
   "Asiste a la convocatoria en Coordinación y participa en el recorrido de verificación: rutas libres, portones abiertos, y timbre, sirena y parlantes funcionando."
  ],
  "apoyo": [
   "Asiste a la convocatoria en Coordinación."
  ],
  "port": [
   "Verifica que los portones y accesos funcionen y estén libres."
  ],
  "coord": [
   "Convoca al equipo, instala el PMU en Coordinación y dirige el recorrido de verificación."
  ],
  "crono": [
   "Preséntate en Coordinación para recibir instrucciones y tu cronómetro o planilla."
  ],
  "foto": [
   "Preséntate en Coordinación para recibir instrucciones y definir tus puntos de registro."
  ],
  "eval": [
   "Preséntate en Coordinación para recibir el formato de evaluación."
  ]
 },
 {
  "f": "antes",
  "a": -45,
  "b": -35,
  "t": "Condiciones óptimas y autorización",
  "q": "Con el reporte del recorrido, el responsable confirma que hay condiciones óptimas y autoriza el ejercicio. Si aparece un riesgo, se interviene antes de continuar.",
  "medio": "Personalmente",
  "doc": [],
  "br": [
   "Entrega el reporte de tu recorrido y avisa de cualquier condición de riesgo."
  ],
  "port": [
   "Reporta el estado de los portones."
  ],
  "coord": [
   "Recibe los reportes, decide si el ejercicio se hace con evacuación o solo hasta el punto de encuentro, y lo autoriza."
  ]
 },
 {
  "f": "antes",
  "a": -35,
  "b": -30,
  "t": "Cada quien a su puesto",
  "q": "Brigadistas, líderes, cronometradores y fotógrafos se ubican en los puntos preestablecidos: escaleras, punto de encuentro y portones.",
  "medio": "Personalmente",
  "doc": [],
  "br": [
   "Ubícate en el puesto que te asignaron (míralo en la pestaña Encargados)."
  ],
  "pa": [
   "Ubica los botiquines (entrada, tienda escolar y sala de profesores) y las camillas (entrada y junto a la tienda)."
  ],
  "inc": [
   "Comprueba que los extintores de tu zona estén visibles y despejados."
  ],
  "tra": [
   "Comprueba que las paletas de pare y siga estén disponibles."
  ],
  "apoyo": [
   "Ubícate junto a las personas que necesitan apoyo para evacuar."
  ],
  "port": [
   "Ubícate en los portones y accesos."
  ],
  "coord": [
   "Verifica que cada persona esté en su puesto."
  ],
  "crono": [
   "Ubícate en tu punto con el cronómetro listo."
  ],
  "foto": [
   "Ubícate en tu punto de registro."
  ],
  "eval": [
   "Ubícate en tu punto de observación."
  ]
 },
 {
  "f": "antes",
  "a": -30,
  "b": -5,
  "t": "Aviso: el ejercicio inicia en 30 minutos",
  "q": "Se avisa a toda la comunidad que el simulacro empieza en 30 minutos.",
  "medio": "Parlantes de la emisora, correo electrónico y mensajería",
  "doc": [
   "Aclara a tu grupo: el timbre largo de la hora del descanso no es el descanso, es el inicio del simulacro.",
   "Verifica que la puerta del aula esté abierta y las salidas despejadas.",
   "Ubica al estudiante brigadista de tu grupo: llevará la paleta con el número del salón.",
   "Ten a la mano la lista del grupo y la tarjeta de conteo.",
   "Recuérdale al grupo: calma, sin correr, sin gritar y sin celulares."
  ],
  "evac": [
   "Con los docentes de tu bloque o piso, confirma puertas abiertas y rutas despejadas."
  ],
  "apoyo": [
   "Confirma con cada persona que necesita apoyo cómo será su salida."
  ],
  "port": [
   "Confirma que las salidas estén operativas y sin obstrucciones."
  ],
  "coord": [
   "Da el aviso por los parlantes de la emisora, el correo y la mensajería, aclarando que el timbre largo no es el del descanso."
  ],
  "crono": [
   "Prueba tu cronómetro."
  ],
  "foto": [
   "Revisa batería y espacio de tu cámara o celular."
  ],
  "eval": [
   "Repasa el formato de evaluación."
  ]
 },
 {
  "f": "durante",
  "a": -5,
  "b": 0,
  "t": "Inicio del ejercicio",
  "q": "Se declara el inicio. Cada grupo está en su sitio, esperando el timbre prolongado.",
  "medio": "Parlantes de la emisora",
  "doc": [
   "Grupo en su lugar y en calma.",
   "Repite la regla: el timbre largo es para protegerse, no para salir al descanso; la sirena es para evacuar."
  ],
  "evac": [
   "Atento a la señal desde tu puesto."
  ],
  "port": [
   "Suspende el ingreso de acudientes y particulares a la sede."
  ],
  "coord": [
   "Da la orden de inicio y recuerda por los parlantes que el timbre largo no es el descanso."
  ],
  "crono": [
   "Cronómetro en cero, listo para la sirena."
  ],
  "foto": [
   "Atento al inicio del ejercicio."
  ],
  "eval": [
   "Atento al inicio del ejercicio."
  ]
 },
 {
  "f": "durante",
  "a": 0,
  "b": 1,
  "t": "Timbre prolongado: protégete",
  "q": "Suena el timbre de cambio de clase, prolongado, a la hora del descanso, y empieza el simulacro: no es el descanso. Se simula el temblor y todos se protegen donde están.",
  "oye": "Este es un simulacro de sismo. Por favor conserve la calma y atienda las recomendaciones de los brigadistas.",
  "medio": "Timbre de cambio de clase prolongado y parlantes de la emisora",
  "doc": [
   "Detén la actividad: no es el descanso, nadie sale del aula.",
   "Grupo en cuclillas, con las manos cubriendo la cabeza.",
   "Quienes estén junto a las ventanas se ubican en una hilera paralela al tablero, también en cuclillas.",
   "Tú también te proteges. Mantén la calma y la posición hasta que suene la sirena (la resolución habla de unos 40 segundos)."
  ],
  "evac": [
   "Protégete como tu grupo y observa tu sector."
  ],
  "coord": [
   "Activa el timbre prolongado y da el anuncio del simulacro por los parlantes."
  ],
  "crono": [
   "Espera: el cronómetro arranca con la sirena."
  ],
  "foto": [
   "Registra cómo se protegen los grupos de tu zona."
  ],
  "eval": [
   "Observa la reacción de los grupos."
  ]
 },
 {
  "f": "durante",
  "a": 1,
  "b": 6,
  "t": "Sirena: evacuación",
  "q": "Suena la sirena y los grupos salen en hilera, cada uno por su ruta y en su turno, hasta el patio central. Primero salen los pisos de abajo y después el segundo piso. La alarma o los parlantes siguen sonando durante todo el proceso. El personal directivo, administrativo, de tienda y de restaurante va a su espacio exclusivo.",
  "oye": "Por favor dirigirse al punto de encuentro.",
  "medio": "Sirena y parlantes de la emisora",
  "doc": [
   "Sale primero la hilera paralela al tablero, luego la cercana a la puerta y luego la siguiente.",
   "El estudiante brigadista encabeza con la paleta del salón en alto (el salón que el grupo ocupa a esa hora).",
   "Sigue la ruta y el turno de tu salón: míralos en la pestaña Rutas.",
   "Si estás en un laboratorio o sala de sistemas, desconecta los equipos y cierra gas y agua antes de salir.",
   "Sin correr, sin empujar, sin gritar, sin celulares y sin cargar objetos. Por las escaleras, por la derecha.",
   "Tú sales de último: revisa que no quede nadie y haz el barrido visual."
  ],
  "evac": [
   "Regula la salida de tu bloque o piso según el orden de las rutas.",
   "Verifica que ningún salón, baño o área común quede rezagado."
  ],
  "pa": [
   "Si ves una lesión real, atiéndela con el botiquín más cercano."
  ],
  "inc": [
   "Si detectas un conato real o un riesgo eléctrico, da la alerta."
  ],
  "tra": [
   "Observa el entorno de la sede (andenes y vías) y reporta novedades al PMU."
  ],
  "apoyo": [
   "Acompaña durante todo el desplazamiento a quien necesite apoyo por movilidad reducida."
  ],
  "port": [
   "Abre y asegura la apertura total de los portones que sirven de salida: que no queden cerrados ni obstruidos."
  ],
  "coord": [
   "Mantén la alarma o los parlantes sonando durante todo el proceso."
  ],
  "crono": [
   "Inicia el cronómetro con la sirena."
  ],
  "foto": [
   "Registra el flujo de salida en escaleras, corredores y portones."
  ],
  "eval": [
   "Observa el orden y la fluidez de la salida."
  ]
 },
 {
  "f": "durante",
  "a": 6,
  "b": 8,
  "t": "Llegada al punto de encuentro",
  "q": "Los grupos llegan al patio central y se forman en fila frente a la paleta con el número de su salón.",
  "oye": "En el punto de encuentro, ubíquese frente a la paleta de su salón, en forma ordenada.",
  "medio": "Parlantes de la emisora",
  "doc": [
   "Forma a tu grupo en fila frente a la paleta de tu salón.",
   "Si el grupo tiene más de 30 estudiantes, formen dos filas.",
   "Guarden 1,5 m de distancia del andén y de la malla.",
   "Nadie se devuelve: el grupo permanece contigo."
  ],
  "evac": [
   "Comprueba que los grupos de tu sector se ubiquen frente a su paleta."
  ],
  "apoyo": [
   "Acompaña a la persona con movilidad reducida hasta su grupo."
  ],
  "coord": [
   "Verifica en el PMU que los grupos vayan llegando."
  ],
  "crono": [
   "Atento a los grupos que llegan."
  ],
  "foto": [
   "Registra la formación en el patio central."
  ],
  "eval": [
   "Observa la ubicación y el orden en el punto de encuentro."
  ]
 },
 {
  "f": "durante",
  "a": 8,
  "b": 12,
  "t": "Conteo del grupo",
  "q": "Cada grupo es contado. Ese conteo cierra el tiempo de evacuación del grupo.",
  "medio": "Paleta verde y reporte verbal",
  "doc": [
   "Cuenta a tu grupo (con apoyo del estudiante brigadista) y compáralo con la lista.",
   "Completo: levanta la paleta verde.",
   "Incompleto: reporta de inmediato la ausencia al líder de gestión del riesgo de la sede.",
   "Llena la tarjeta de conteo: presentes, completo o incompleto, y hora."
  ],
  "evac": [
   "Recoge los reportes de conteo de tu sector."
  ],
  "pa": [
   "Atiende cualquier lesión o malestar que se reporte."
  ],
  "apoyo": [
   "Acompaña a quien muestre ansiedad o angustia."
  ],
  "coord": [
   "Recibe en el PMU los reportes de conteo."
  ],
  "crono": [
   "Anota el tiempo de cada grupo cuando levanta la paleta verde (grupo, salón y hora)."
  ],
  "foto": [
   "Registra el conteo y las paletas verdes."
  ],
  "eval": [
   "Observa si el método de conteo funciona."
  ]
 },
 {
  "f": "durante",
  "a": 12,
  "b": 14,
  "t": "Reporte al Puesto de Mando",
  "q": "Los resultados del conteo se entregan al coordinador de reporte en el PMU.",
  "medio": "Personalmente o por celular",
  "doc": [
   "Entrega la tarjeta de conteo diligenciada al líder de evacuación o al PMU.",
   "Firma la tarjeta como docente del grupo."
  ],
  "evac": [
   "Reporta el estado de tu sector al PMU y entrega las tarjetas que recogiste."
  ],
  "coord": [
   "Consolida el reporte de personas evacuadas y su estado."
  ],
  "crono": [
   "Cierra la medición cuando todos los grupos hayan reportado."
  ]
 },
 {
  "f": "durante",
  "a": 12,
  "b": 16,
  "t": "Verificación de las condiciones de la sede",
  "q": "La brigada de evacuación revisa las condiciones de la edificación y reporta al responsable si hay novedades antes de dar por terminado el ejercicio.",
  "medio": "Personalmente",
  "doc": [
   "Permanece con tu grupo en el punto de encuentro hasta que se anuncie el fin del ejercicio."
  ],
  "evac": [
   "Revisa rutas, aulas y escaleras de tu sector y reporta si hay novedades."
  ],
  "coord": [
   "Recibe los reportes de la brigada de evacuación y dispone el cierre del ejercicio."
  ]
 },
 {
  "f": "durante",
  "a": 16,
  "b": 19,
  "t": "Retroalimentación pedagógica de los líderes",
  "q": "Con los grupos aún reunidos en el punto de encuentro, los líderes comentan brevemente cómo salió el ejercicio: qué funcionó y qué se puede mejorar, con énfasis en la seriedad y la fluidez.",
  "medio": "Verbal, en el punto de encuentro",
  "doc": [
   "Escucha con tu grupo, en fila y en silencio, la retroalimentación del líder de tu sector.",
   "Apunta lo que quieras aportar para la evaluación."
  ],
  "evac": [
   "Da a los grupos de tu sector una retroalimentación breve: qué salió bien y qué se debe mejorar (seriedad, fluidez, sin correr, sin gritar, sin devolverse)."
  ],
  "apoyo": [
   "Atiende a quien muestre ansiedad o angustia."
  ],
  "coord": [
   "Verifica que los líderes den la retroalimentación a todos los sectores."
  ],
  "foto": [
   "Registra la retroalimentación en el punto de encuentro."
  ],
  "eval": [
   "Observa la retroalimentación pedagógica."
  ]
 },
 {
  "f": "durante",
  "a": 19,
  "b": 20,
  "t": "Fin del simulacro",
  "q": "Se anuncia el fin del simulacro. Desde ese momento los grupos quedan en su descanso.",
  "medio": "Parlantes de la emisora",
  "doc": [
   "Cuando se anuncie el fin del simulacro, tu grupo queda en su descanso.",
   "Hasta ese anuncio nadie se mueve del punto de encuentro."
  ],
  "evac": [
   "Avisa a tu sector que el ejercicio terminó y que los grupos quedan en su descanso."
  ],
  "port": [
   "Restablece el ingreso a la sede cuando el responsable lo indique."
  ],
  "coord": [
   "Anuncia por los parlantes el fin del simulacro."
  ]
 },
 {
  "f": "despues",
  "a": 20,
  "b": 30,
  "t": "Descanso",
  "q": "Los estudiantes y los docentes están en su descanso, que dura 10 minutos.",
  "medio": "Horario del descanso",
  "doc": [
   "Tu grupo está en su descanso: no tienes más acciones en este momento."
  ]
 },
 {
  "f": "despues",
  "a": 30,
  "b": 70,
  "dur": "30 a 40 min",
  "t": "Cierre y evaluación",
  "q": "Al terminar el descanso, el equipo organizador da por cerrado el ejercicio y se reúne el equipo evaluador: coordinador de la jornada, mínimo tres docentes, dos estudiantes y, de ser posible, un invitado externo. Se recogen los tiempos, se revisa el registro fotográfico, se aplica la encuesta a la comunidad educativa y se elabora el análisis FODA.",
  "medio": "Personalmente",
  "doc": [
   "Atiende a los estudiantes que muestren ansiedad y remítelos a orientación escolar si es necesario.",
   "Responde la encuesta a la comunidad educativa sobre la actividad.",
   "Revisa tu aula (vidrios, luminarias, cielorrasos, mampostería) y reporta cualquier novedad.",
   "Comparte qué funcionó y qué se puede mejorar."
  ],
  "br": [
   "Reporta al responsable cualquier novedad de tu sector y, si hiciste parte de la organización, asiste a la reunión de evaluación."
  ],
  "apoyo": [
   "Informa al coordinador de lo que requiera seguimiento y asiste a la reunión de evaluación."
  ],
  "coord": [
   "Declara cerrado el ejercicio y dirige la reunión de evaluación y el reporte oficial del simulacro."
  ],
  "crono": [
   "Entrega tus datos de tiempo."
  ],
  "foto": [
   "Entrega el registro fotográfico."
  ],
  "eval": [
   "Integras el equipo evaluador: diligencia el formato de evaluación y preséntalo en la reunión."
  ]
 }
];
export const ANTES_BASE: string[] = [
 "Explica a tu grupo que el timbre largo de la hora del descanso no es el descanso: es el inicio del simulacro, y el descanso empieza cuando termina el ejercicio.",
 "Mira en la pestaña Rutas cuál es tu salón y tu turno de salida.",
 "Identifica al estudiante brigadista de tu grupo y confirma que sabe que lleva la paleta con el número del salón.",
 "Explícale al grupo qué hacer con el timbre largo y con la sirena (puedes aprovechar la dirección de grupo).",
 "Ten lista la tarjeta de conteo y la lista del grupo.",
 "Comprueba que la puerta del aula abra y que las salidas estén despejadas.",
 "Ubica el botiquín y el extintor más cercanos a tu salón."
];
export const ANTES_EX: Partial<Record<RolClave, string[]>> = {
 "evac": [
  "Conoce las rutas y el orden de salida de tu bloque o piso.",
  "Prepara una retroalimentación breve para tu sector: qué observar y qué decir.",
  "Confirma tu puesto de control en la pestaña Encargados.",
  "Recuerda que reportas el estado de tu sector al Puesto de Mando."
 ],
 "pa": [
  "Ubica los 3 botiquines (entrada, tienda escolar y sala de profesores) y las 2 camillas (entrada y junto a la tienda).",
  "Mantén vigente tu formación como primer respondiente."
 ],
 "inc": [
  "Identifica los 14 extintores de la sede, revisa su vigencia e informa las novedades."
 ],
 "tra": [
  "Comprueba que las paletas de pare y siga estén disponibles.",
  "Revisa el entorno de la sede: andenes y vías."
 ],
 "apoyo": [
  "Identifica a las personas que necesitan apoyo y acuerda con ellas cómo será su salida.",
  "Conoce las rutas y los puntos de encuentro."
 ],
 "port": [
  "Verifica que los portones de salida abran por completo y no tengan obstáculos.",
  "Define quién cubre cada acceso.",
  "Repasa cómo recibir y orientar a los organismos de socorro si llegaran."
 ],
 "coord": [
  "Incluye en el aviso previo y en el anuncio de inicio que el timbre largo no es el timbre del descanso.",
  "Revisa que la pestaña Encargados no tenga puestos por asignar.",
  "Prueba el timbre, la sirena y los parlantes de la emisora el día anterior.",
  "Confirma que haya una tarjeta de conteo impresa por cada grupo.",
  "Informa a la comunidad el horario del ejercicio."
 ],
 "crono": [
  "Lleva cronómetro (puede ser el celular) y una planilla de tiempos.",
  "Repasa el guion y tu punto de ubicación."
 ],
 "foto": [
  "Carga la batería y libera espacio en tu cámara o celular.",
  "Repasa el guion y tus puntos de registro."
 ],
 "eval": [
  "Lee el formato de evaluación: objetivos, estructura, flujo de información, suministros, guion y Puesto de Mando."
 ]
};
export const FN: Partial<Record<RolClave, string[]>> = {
 "evac": [
  "Evacuar el aula, conducir el grupo por la ruta señalizada hasta el punto de encuentro y verificar allí el conteo completo. Es un deber de todo el personal a cargo de un grupo, figure o no en el listado.",
  "Identificar, dentro de su grupo, al estudiante brigadista de apoyo en la evacuación.",
  "Verificar que ningún salón, baño o área común de su bloque o piso quede rezagado.",
  "Reportar el estado de su sector al Puesto de Mando Unificado (Coordinación) o a quien haga sus veces.",
  "Conocer el plan de atención de emergencias de la sede, las rutas, la señalización y los puntos de encuentro.",
  "Sensibilizar de forma permanente a sus estudiantes sobre prevención de riesgos y la importancia de conservar la calma.",
  "Reportar al líder de gestión del riesgo la ausencia de cualquier estudiante en el punto de encuentro.",
  "En caso de sismo, conservar la calma durante los primeros 40 segundos y hacer que el grupo adopte una posición segura sin salir del aula. La evacuación se hace al escuchar la alarma; si en ese lapso hay fisuras estructurales o caída de objetos peligrosos, se evacúa de forma controlada aun sin alarma.",
  "Mantener la puerta del aula abierta durante toda la jornada."
 ],
 "pa": [
  "Mantener vigente su formación como primer respondiente y aplicarla en cada evento que se presente en la sede.",
  "Activar la alerta a los organismos de apoyo cuando la atención del caso lo exija.",
  "Conocer la ubicación de los botiquines y camillas e informar las necesidades de dotación.",
  "Valorar a los afectados, prestar los primeros auxilios con apoyo de los estudiantes brigadistas y remitir los casos que lo ameriten, informando al líder de gestión del riesgo, quien avisa a las familias.",
  "Activar la póliza de accidentes escolares y diligenciar el formato cuando se remita a un estudiante a un centro hospitalario o se entregue a su familia.",
  "Aplicar el protocolo de relevo de custodia antes de abandonar su función de evacuación para atender la de primeros auxilios."
 ],
 "inc": [
  "Mantener vigente su formación en manejo de elementos de seguridad y extinción de incendios.",
  "Tener identificados los extintores según su clase de uso, verificar su vigencia e informar las novedades.",
  "Informar al líder de gestión del riesgo sobre condiciones que representen riesgo de conato de incendio o de electrocución.",
  "Identificar el conato, dar la alerta y activar la alarma de evacuación cuando se requiera.",
  "Atender el conato cuando esté a su alcance y, si no, activar de inmediato la alerta a los organismos de socorro.",
  "La pertenencia a la brigada es voluntaria: quien sienta temor insuperable frente al fuego pasa a funciones logísticas de bajo riesgo (corte de electricidad y gas, voz de alerta, inspección de extintores)."
 ],
 "tra": [
  "Identificar las amenazas y vulnerabilidades de tránsito y movilidad en el entorno de la sede e informarlas al líder de gestión del riesgo.",
  "Proponer medidas contra el riesgo de atropello y de estampida en el ingreso, la salida y la evacuación.",
  "Sensibilizar a la comunidad y al vecindario sobre los riesgos del tránsito y solicitar la señalización requerida.",
  "Actuar según el plan de gestión del riesgo cuando la evacuación deba dirigirse al exterior de la sede.",
  "Conocer la ubicación de la señalización móvil de pare y siga y garantizar su disponibilidad y uso.",
  "El personal de aseo y del PAE es apoyo secundario y preventivo dentro del perímetro de la sede; no controla el tráfico en la vía pública."
 ],
 "apoyo": [
  "Conocer el plan de atención de emergencias para servir de apoyo efectivo en la evacuación y relevar al brigadista de base cuando este deba activarse.",
  "Identificar en cada jornada a los docentes de otras brigadas para asumir su grupo cuando cumplan su función especializada.",
  "Ejecutar el protocolo de relevo de custodia: asumir de manera efectiva la supervisión del grupo antes de que el docente se retire.",
  "Acompañar durante todo el desplazamiento al personal y a los estudiantes con movilidad reducida.",
  "Apoyo psicosocial: capacitarse en primeros auxilios emocionales y acompañar a las personas afectadas durante y después del evento.",
  "Apoyo psicosocial: solicitar apoyo a las entidades de salud para atender o derivar a las personas afectadas."
 ],
 "port": [
  "Suspender de inmediato el ingreso de acudientes y particulares a la sede.",
  "Abrir y asegurar la apertura total de los portones vehiculares y peatonales que sirven de salida, e impedir que permanezcan cerrados u obstruidos mientras dure la emergencia.",
  "Recibir y orientar a los organismos de socorro (Bomberos, ambulancias y Policía) desde su llegada hasta donde se requiera su intervención.",
  "Informar al líder de gestión del riesgo sobre el ingreso y la salida de vehículos de emergencia."
 ],
 "coord": [
  "Decidir si el simulacro se hace con evacuación o solo hasta el punto de encuentro.",
  "Dar la orden de alarma y alerta.",
  "Inscribir la sede y la jornada en el Simulacro Nacional.",
  "Socializar con la comunidad el plan de trabajo del simulacro.",
  "Citar a los actores para la preparación del simulacro.",
  "Hacer el reporte oficial de evacuados y tiempo.",
  "Decidir el retorno a las aulas, previa consulta con la brigada de evacuación.",
  "Determinar el aspecto a evaluar, el evento a simular y realizar la evaluación."
 ]
};
export const RUTAS: Ruta[] = [
 {
  "k": "n1",
  "t": "Nivel 1: directo al patio central",
  "w": "Salen primero, porque los pisos de abajo van antes",
  "o": [
   "Salón 10",
   "Salón 9",
   "Salón 8",
   "Salón 7",
   "Sala de sistemas principal",
   "Laboratorio",
   "Bodega de artística"
  ]
 },
 {
  "k": "co",
  "t": "Nivel 2: escalera de coordinación",
  "w": "Salen después de los pisos de abajo",
  "o": [
   "Psicología",
   "Sala de profesores",
   "Salón 1",
   "Salón 2"
  ]
 },
 {
  "k": "au",
  "t": "Nivel 2: escalera del auditorio",
  "w": "Salen después de los pisos de abajo",
  "o": [
   "Salón 6",
   "Salón 5",
   "Salón 4",
   "Salón 3",
   "Sala de sistemas 2"
  ]
 }
];
export const PUESTOS: Puesto[] = [
 {
  "id": "responsable_del_simulacro",
  "nombre": "Responsable del simulacro",
  "grupo": "Dirección del ejercicio",
  "rol": "coord",
  "jornadas": "both"
 },
 {
  "id": "anuncios_por_los_parlantes_de_la_emisora",
  "nombre": "Anuncios por los parlantes de la emisora",
  "grupo": "Dirección del ejercicio",
  "rol": "coord",
  "jornadas": "both",
  "detalle": "o su delegado"
 },
 {
  "id": "timbre_prolongado_inicio_y_sirena_evacuacion",
  "nombre": "Timbre prolongado (inicio) y sirena (evacuación)",
  "grupo": "Dirección del ejercicio",
  "rol": "coord",
  "jornadas": "both",
  "nota": "El timbre de cambio de clase está en Coordinación; la sirena, junto a la emisora",
  "detalle": "o su delegado"
 },
 {
  "id": "rectoria",
  "nombre": "Rectoría",
  "grupo": "Puesto de Mando Unificado (Coordinación)",
  "rol": "coord",
  "jornadas": "both"
 },
 {
  "id": "coordinacion_del_pmu",
  "nombre": "Coordinación del PMU",
  "grupo": "Puesto de Mando Unificado (Coordinación)",
  "rol": "coord",
  "jornadas": "both"
 },
 {
  "id": "reporte_consolidado_del_conteo",
  "nombre": "Reporte consolidado del conteo",
  "grupo": "Puesto de Mando Unificado (Coordinación)",
  "rol": "coord",
  "jornadas": "both",
  "nota": "Recibe las tarjetas de conteo"
 },
 {
  "id": "equipo_evaluador_coordinador_de_la_jornada",
  "nombre": "Equipo evaluador: coordinador de la jornada",
  "grupo": "Evaluación y registro",
  "rol": "eval",
  "jornadas": "both"
 },
 {
  "id": "equipo_evaluador_docentes_minimo_3_1",
  "nombre": "Equipo evaluador: docentes (mínimo 3) 1",
  "grupo": "Evaluación y registro",
  "rol": "eval",
  "jornadas": "both"
 },
 {
  "id": "equipo_evaluador_docentes_minimo_3_2",
  "nombre": "Equipo evaluador: docentes (mínimo 3) 2",
  "grupo": "Evaluación y registro",
  "rol": "eval",
  "jornadas": "both"
 },
 {
  "id": "equipo_evaluador_docentes_minimo_3_3",
  "nombre": "Equipo evaluador: docentes (mínimo 3) 3",
  "grupo": "Evaluación y registro",
  "rol": "eval",
  "jornadas": "both"
 },
 {
  "id": "equipo_evaluador_estudiantes_2_1",
  "nombre": "Equipo evaluador: estudiantes (2) 1",
  "grupo": "Evaluación y registro",
  "rol": "eval",
  "jornadas": "both",
  "nota": "Se pueden indicar por grupo, sin nombre"
 },
 {
  "id": "equipo_evaluador_estudiantes_2_2",
  "nombre": "Equipo evaluador: estudiantes (2) 2",
  "grupo": "Evaluación y registro",
  "rol": "eval",
  "jornadas": "both",
  "nota": "Se pueden indicar por grupo, sin nombre"
 },
 {
  "id": "equipo_evaluador_invitado_externo",
  "nombre": "Equipo evaluador: invitado externo",
  "grupo": "Evaluación y registro",
  "rol": "eval",
  "jornadas": "both",
  "nota": "Opcional, pero muy deseable",
  "opcional": true
 },
 {
  "id": "reporte_oficial_del_simulacro_1",
  "nombre": "Reporte oficial del simulacro 1",
  "grupo": "Evaluación y registro",
  "rol": "eval",
  "jornadas": "both"
 },
 {
  "id": "reporte_oficial_del_simulacro_2",
  "nombre": "Reporte oficial del simulacro 2",
  "grupo": "Evaluación y registro",
  "rol": "eval",
  "jornadas": "m"
 },
 {
  "id": "cronometradores_1",
  "nombre": "Cronometradores 1",
  "grupo": "Evaluación y registro",
  "rol": "crono",
  "jornadas": "both",
  "nota": "Dos personas"
 },
 {
  "id": "cronometradores_2",
  "nombre": "Cronometradores 2",
  "grupo": "Evaluación y registro",
  "rol": "crono",
  "jornadas": "both",
  "nota": "Dos personas"
 },
 {
  "id": "registro_fotografico_1",
  "nombre": "Registro fotográfico 1",
  "grupo": "Evaluación y registro",
  "rol": "foto",
  "jornadas": "both",
  "nota": "Dos personas"
 },
 {
  "id": "registro_fotografico_2",
  "nombre": "Registro fotográfico 2",
  "grupo": "Evaluación y registro",
  "rol": "foto",
  "jornadas": "both",
  "nota": "Dos personas"
 },
 {
  "id": "escalera_de_coordinacion_nivel_2",
  "nombre": "Escalera de coordinación (nivel 2)",
  "grupo": "Puestos de control durante la evacuación",
  "rol": "evac",
  "jornadas": "both"
 },
 {
  "id": "escalera_del_auditorio_nivel_2",
  "nombre": "Escalera del auditorio (nivel 2)",
  "grupo": "Puestos de control durante la evacuación",
  "rol": "evac",
  "jornadas": "both"
 },
 {
  "id": "escalera_del_lado_de_la_biblioteca",
  "nombre": "Escalera del lado de la biblioteca",
  "grupo": "Puestos de control durante la evacuación",
  "rol": "evac",
  "jornadas": "both",
  "nota": "Estrecha y en mal estado: definir si se usa y cómo se regula"
 },
 {
  "id": "sotano",
  "nombre": "Sótano",
  "grupo": "Puestos de control durante la evacuación",
  "rol": "evac",
  "jornadas": "both",
  "nota": "Patio o aula de educación física bajo el restaurante"
 },
 {
  "id": "punto_de_encuentro_patio_central",
  "nombre": "Punto de encuentro: patio central",
  "grupo": "Puestos de control durante la evacuación",
  "rol": "evac",
  "jornadas": "both",
  "nota": "Orden de las filas y de las paletas"
 },
 {
  "id": "portones_y_accesos",
  "nombre": "Portones y accesos",
  "grupo": "Portería y vigilancia",
  "rol": "port",
  "jornadas": "both",
  "nota": "Personal de vigilancia"
 },
 {
  "id": "lider_de_gestion_del_riesgo_1",
  "nombre": "Líder de gestión del riesgo 1",
  "grupo": "Brigadas (Resolución Rectoral 06 de 2026)",
  "rol": "coord",
  "jornadas": "both"
 },
 {
  "id": "lider_de_gestion_del_riesgo_2",
  "nombre": "Líder de gestión del riesgo 2",
  "grupo": "Brigadas (Resolución Rectoral 06 de 2026)",
  "rol": "coord",
  "jornadas": "t"
 },
 {
  "id": "lideres_de_evacuacion_1",
  "nombre": "Líderes de evacuación 1",
  "grupo": "Brigadas (Resolución Rectoral 06 de 2026)",
  "rol": "evac",
  "jornadas": "both"
 },
 {
  "id": "lideres_de_evacuacion_2",
  "nombre": "Líderes de evacuación 2",
  "grupo": "Brigadas (Resolución Rectoral 06 de 2026)",
  "rol": "evac",
  "jornadas": "both"
 },
 {
  "id": "lideres_de_evacuacion_3",
  "nombre": "Líderes de evacuación 3",
  "grupo": "Brigadas (Resolución Rectoral 06 de 2026)",
  "rol": "evac",
  "jornadas": "both"
 },
 {
  "id": "lideres_de_evacuacion_4",
  "nombre": "Líderes de evacuación 4",
  "grupo": "Brigadas (Resolución Rectoral 06 de 2026)",
  "rol": "evac",
  "jornadas": "both"
 },
 {
  "id": "lideres_de_evacuacion_5",
  "nombre": "Líderes de evacuación 5",
  "grupo": "Brigadas (Resolución Rectoral 06 de 2026)",
  "rol": "evac",
  "jornadas": "both"
 },
 {
  "id": "lideres_de_evacuacion_6",
  "nombre": "Líderes de evacuación 6",
  "grupo": "Brigadas (Resolución Rectoral 06 de 2026)",
  "rol": "evac",
  "jornadas": "both"
 },
 {
  "id": "lideres_de_evacuacion_7",
  "nombre": "Líderes de evacuación 7",
  "grupo": "Brigadas (Resolución Rectoral 06 de 2026)",
  "rol": "evac",
  "jornadas": "both"
 },
 {
  "id": "lideres_de_evacuacion_8",
  "nombre": "Líderes de evacuación 8",
  "grupo": "Brigadas (Resolución Rectoral 06 de 2026)",
  "rol": "evac",
  "jornadas": "both"
 },
 {
  "id": "lideres_de_evacuacion_9",
  "nombre": "Líderes de evacuación 9",
  "grupo": "Brigadas (Resolución Rectoral 06 de 2026)",
  "rol": "evac",
  "jornadas": "both"
 },
 {
  "id": "lideres_de_evacuacion_10",
  "nombre": "Líderes de evacuación 10",
  "grupo": "Brigadas (Resolución Rectoral 06 de 2026)",
  "rol": "evac",
  "jornadas": "both"
 },
 {
  "id": "lideres_de_evacuacion_11",
  "nombre": "Líderes de evacuación 11",
  "grupo": "Brigadas (Resolución Rectoral 06 de 2026)",
  "rol": "evac",
  "jornadas": "both"
 },
 {
  "id": "lideres_de_evacuacion_12",
  "nombre": "Líderes de evacuación 12",
  "grupo": "Brigadas (Resolución Rectoral 06 de 2026)",
  "rol": "evac",
  "jornadas": "both"
 },
 {
  "id": "lideres_de_evacuacion_13",
  "nombre": "Líderes de evacuación 13",
  "grupo": "Brigadas (Resolución Rectoral 06 de 2026)",
  "rol": "evac",
  "jornadas": "both"
 },
 {
  "id": "lideres_de_evacuacion_14",
  "nombre": "Líderes de evacuación 14",
  "grupo": "Brigadas (Resolución Rectoral 06 de 2026)",
  "rol": "evac",
  "jornadas": "both"
 },
 {
  "id": "primeros_auxilios_1",
  "nombre": "Primeros auxilios 1",
  "grupo": "Brigadas (Resolución Rectoral 06 de 2026)",
  "rol": "pa",
  "jornadas": "both"
 },
 {
  "id": "primeros_auxilios_2",
  "nombre": "Primeros auxilios 2",
  "grupo": "Brigadas (Resolución Rectoral 06 de 2026)",
  "rol": "pa",
  "jornadas": "both"
 },
 {
  "id": "contra_incendios",
  "nombre": "Contra incendios",
  "grupo": "Brigadas (Resolución Rectoral 06 de 2026)",
  "rol": "inc",
  "jornadas": "both"
 },
 {
  "id": "transito_y_movilidad_1",
  "nombre": "Tránsito y movilidad 1",
  "grupo": "Brigadas (Resolución Rectoral 06 de 2026)",
  "rol": "tra",
  "jornadas": "both"
 },
 {
  "id": "transito_y_movilidad_2",
  "nombre": "Tránsito y movilidad 2",
  "grupo": "Brigadas (Resolución Rectoral 06 de 2026)",
  "rol": "tra",
  "jornadas": "t"
 },
 {
  "id": "apoyo_inmediato_1",
  "nombre": "Apoyo inmediato 1",
  "grupo": "Brigadas (Resolución Rectoral 06 de 2026)",
  "rol": "apoyo",
  "jornadas": "both",
  "nota": "Personal no docente y coordinación",
  "detalle": "docente orientador"
 },
 {
  "id": "apoyo_inmediato_2",
  "nombre": "Apoyo inmediato 2",
  "grupo": "Brigadas (Resolución Rectoral 06 de 2026)",
  "rol": "apoyo",
  "jornadas": "both",
  "nota": "Personal no docente y coordinación",
  "detalle": "psicóloga"
 },
 {
  "id": "apoyo_inmediato_3",
  "nombre": "Apoyo inmediato 3",
  "grupo": "Brigadas (Resolución Rectoral 06 de 2026)",
  "rol": "apoyo",
  "jornadas": "both",
  "nota": "Personal no docente y coordinación",
  "detalle": "profesional de apoyo"
 },
 {
  "id": "apoyo_inmediato_4",
  "nombre": "Apoyo inmediato 4",
  "grupo": "Brigadas (Resolución Rectoral 06 de 2026)",
  "rol": "apoyo",
  "jornadas": "both",
  "nota": "Personal no docente y coordinación",
  "detalle": "auxiliar administrativa"
 },
 {
  "id": "apoyo_inmediato_5",
  "nombre": "Apoyo inmediato 5",
  "grupo": "Brigadas (Resolución Rectoral 06 de 2026)",
  "rol": "apoyo",
  "jornadas": "both",
  "nota": "Personal no docente y coordinación",
  "detalle": "auxiliar administrativo"
 },
 {
  "id": "apoyo_inmediato_6",
  "nombre": "Apoyo inmediato 6",
  "grupo": "Brigadas (Resolución Rectoral 06 de 2026)",
  "rol": "apoyo",
  "jornadas": "both",
  "nota": "Personal no docente y coordinación",
  "detalle": "auxiliar administrativa"
 },
 {
  "id": "apoyo_inmediato_7",
  "nombre": "Apoyo inmediato 7",
  "grupo": "Brigadas (Resolución Rectoral 06 de 2026)",
  "rol": "apoyo",
  "jornadas": "both",
  "nota": "Personal no docente y coordinación",
  "detalle": "coordinadora"
 },
 {
  "id": "apoyo_inmediato_8",
  "nombre": "Apoyo inmediato 8",
  "grupo": "Brigadas (Resolución Rectoral 06 de 2026)",
  "rol": "apoyo",
  "jornadas": "both",
  "nota": "Personal no docente y coordinación",
  "detalle": "coordinador"
 }
];

/** Asignaciones iniciales (semilla 2026). slot = id de USUARIOS; textoLibre = persona que no es usuaria de la app. */
export const ASIGNACIONES_2026: Asignaciones = {
 "responsable_del_simulacro": {
  "manana": {
   "slot": "julian"
  },
  "tarde": {
   "slot": "julian"
  }
 },
 "anuncios_por_los_parlantes_de_la_emisora": {
  "manana": {
   "slot": "coord_manana"
  },
  "tarde": {
   "slot": "coord_manana"
  }
 },
 "timbre_prolongado_inicio_y_sirena_evacuacion": {
  "manana": {
   "slot": "coord_manana"
  },
  "tarde": {
   "slot": "coord_manana"
  }
 },
 "rectoria": {
  "manana": {
   "slot": "rectora"
  },
  "tarde": {
   "slot": "rectora"
  }
 },
 "coordinacion_del_pmu": {
  "manana": {
   "slot": "coord_manana",
   "porConfirmar": true
  },
  "tarde": {
   "slot": "coord_tarde",
   "porConfirmar": true
  }
 },
 "reporte_consolidado_del_conteo": {
  "manana": {
   "slot": null
  },
  "tarde": {
   "slot": null
  }
 },
 "equipo_evaluador_coordinador_de_la_jornada": {
  "manana": {
   "slot": "coord_manana"
  },
  "tarde": {
   "slot": "coord_tarde",
   "porConfirmar": true
  }
 },
 "equipo_evaluador_docentes_minimo_3_1": {
  "manana": {
   "slot": "claudia"
  },
  "tarde": {
   "slot": null
  }
 },
 "equipo_evaluador_docentes_minimo_3_2": {
  "manana": {
   "slot": null
  },
  "tarde": {
   "slot": null
  }
 },
 "equipo_evaluador_docentes_minimo_3_3": {
  "manana": {
   "slot": null
  },
  "tarde": {
   "slot": null
  }
 },
 "equipo_evaluador_estudiantes_2_1": {
  "manana": {
   "slot": null
  },
  "tarde": {
   "slot": null
  }
 },
 "equipo_evaluador_estudiantes_2_2": {
  "manana": {
   "slot": null
  },
  "tarde": {
   "slot": null
  }
 },
 "equipo_evaluador_invitado_externo": {
  "manana": {
   "slot": null
  },
  "tarde": {
   "slot": null
  }
 },
 "reporte_oficial_del_simulacro_1": {
  "manana": {
   "slot": "coord_manana"
  },
  "tarde": {
   "slot": null
  }
 },
 "reporte_oficial_del_simulacro_2": {
  "manana": {
   "slot": "claudia"
  }
 },
 "cronometradores_1": {
  "manana": {
   "slot": null
  },
  "tarde": {
   "slot": null
  }
 },
 "cronometradores_2": {
  "manana": {
   "slot": null
  },
  "tarde": {
   "slot": null
  }
 },
 "registro_fotografico_1": {
  "manana": {
   "slot": null
  },
  "tarde": {
   "slot": null
  }
 },
 "registro_fotografico_2": {
  "manana": {
   "slot": null
  },
  "tarde": {
   "slot": null
  }
 },
 "escalera_de_coordinacion_nivel_2": {
  "manana": {
   "slot": null
  },
  "tarde": {
   "slot": null
  }
 },
 "escalera_del_auditorio_nivel_2": {
  "manana": {
   "slot": null
  },
  "tarde": {
   "slot": null
  }
 },
 "escalera_del_lado_de_la_biblioteca": {
  "manana": {
   "slot": null
  },
  "tarde": {
   "slot": null
  }
 },
 "sotano": {
  "manana": {
   "slot": null
  },
  "tarde": {
   "slot": null
  }
 },
 "punto_de_encuentro_patio_central": {
  "manana": {
   "slot": null
  },
  "tarde": {
   "slot": null
  }
 },
 "portones_y_accesos": {
  "manana": {
   "slot": null
  },
  "tarde": {
   "slot": null
  }
 },
 "lider_de_gestion_del_riesgo_1": {
  "manana": {
   "slot": "carlos"
  },
  "tarde": {
   "slot": "hugo"
  }
 },
 "lider_de_gestion_del_riesgo_2": {
  "tarde": {
   "slot": "marina"
  }
 },
 "lideres_de_evacuacion_1": {
  "manana": {
   "slot": "jorge"
  },
  "tarde": {
   "slot": "luis_javier"
  }
 },
 "lideres_de_evacuacion_2": {
  "manana": {
   "slot": "yoguis"
  },
  "tarde": {
   "slot": "carolina"
  }
 },
 "lideres_de_evacuacion_3": {
  "manana": {
   "slot": "gloria_a"
  },
  "tarde": {
   "slot": "juan_pablo"
  }
 },
 "lideres_de_evacuacion_4": {
  "manana": {
   "slot": "adolfo"
  },
  "tarde": {
   "slot": null,
   "textoLibre": "Víctor Giraldo"
  }
 },
 "lideres_de_evacuacion_5": {
  "manana": {
   "slot": "carlos"
  },
  "tarde": {
   "slot": "edgar"
  }
 },
 "lideres_de_evacuacion_6": {
  "manana": {
   "slot": "johana"
  },
  "tarde": {
   "slot": "felipe"
  }
 },
 "lideres_de_evacuacion_7": {
  "manana": {
   "slot": "monica_c"
  },
  "tarde": {
   "slot": "monica_rave"
  }
 },
 "lideres_de_evacuacion_8": {
  "manana": {
   "slot": "claudia"
  },
  "tarde": {
   "slot": "harol"
  }
 },
 "lideres_de_evacuacion_9": {
  "manana": {
   "slot": "julian"
  },
  "tarde": {
   "slot": "luis_angel"
  }
 },
 "lideres_de_evacuacion_10": {
  "manana": {
   "slot": "margara"
  },
  "tarde": {
   "slot": "hugo"
  }
 },
 "lideres_de_evacuacion_11": {
  "manana": {
   "slot": "beatriz"
  },
  "tarde": {
   "slot": "yanet"
  }
 },
 "lideres_de_evacuacion_12": {
  "manana": {
   "slot": "uriel"
  },
  "tarde": {
   "slot": "marina"
  }
 },
 "lideres_de_evacuacion_13": {
  "manana": {
   "slot": "ledis"
  },
  "tarde": {
   "slot": "fredy_garcia"
  }
 },
 "lideres_de_evacuacion_14": {
  "manana": {
   "slot": "marta"
  },
  "tarde": {
   "slot": "valentina"
  }
 },
 "primeros_auxilios_1": {
  "manana": {
   "slot": "julian"
  },
  "tarde": {
   "slot": "juan_pablo"
  }
 },
 "primeros_auxilios_2": {
  "manana": {
   "slot": "carlos"
  },
  "tarde": {
   "slot": "monica_rave"
  }
 },
 "contra_incendios": {
  "manana": {
   "slot": "yoguis"
  },
  "tarde": {
   "slot": "fredy_garcia"
  }
 },
 "transito_y_movilidad_1": {
  "manana": {
   "slot": "claudia"
  },
  "tarde": {
   "slot": "harol"
  }
 },
 "transito_y_movilidad_2": {
  "tarde": {
   "slot": "luis_angel"
  }
 },
 "apoyo_inmediato_1": {
  "manana": {
   "slot": "alexander"
  },
  "tarde": {
   "slot": "alexander"
  }
 },
 "apoyo_inmediato_2": {
  "manana": {
   "slot": null,
   "textoLibre": "Natalia Rivas"
  },
  "tarde": {
   "slot": null,
   "textoLibre": "Natalia Rivas"
  }
 },
 "apoyo_inmediato_3": {
  "manana": {
   "slot": null,
   "textoLibre": "Diana Ramírez"
  },
  "tarde": {
   "slot": null,
   "textoLibre": "Diana Ramírez"
  }
 },
 "apoyo_inmediato_4": {
  "manana": {
   "slot": null,
   "textoLibre": "Paola Andrea Vélez"
  },
  "tarde": {
   "slot": null,
   "textoLibre": "Paola Andrea Vélez"
  }
 },
 "apoyo_inmediato_5": {
  "manana": {
   "slot": null,
   "textoLibre": "Román Serna"
  },
  "tarde": {
   "slot": null,
   "textoLibre": "Román Serna"
  }
 },
 "apoyo_inmediato_6": {
  "manana": {
   "slot": null,
   "textoLibre": "Yaneth Hurtado"
  },
  "tarde": {
   "slot": null,
   "textoLibre": "Yaneth Hurtado"
  }
 },
 "apoyo_inmediato_7": {
  "manana": {
   "slot": "coord_manana"
  },
  "tarde": {
   "slot": "coord_manana"
  }
 },
 "apoyo_inmediato_8": {
  "manana": {
   "slot": "coord_tarde"
  },
  "tarde": {
   "slot": "coord_tarde"
  }
 }
};

/** Orden de prioridad de roles al mostrar «Ver el guion como». */
export const ROL_PRIORIDAD: RolClave[] = ['coord','eval','crono','foto','port','apoyo','evac','pa','inc','tra'];

export const FASES_ROTULO: Record<Fase, string> = { antes: 'Antes', durante: 'Durante', despues: 'Después' };
export const FASES_CAPITULO: Record<Fase, string> = {
  antes: 'Antes del simulacro', durante: 'Durante el simulacro', despues: 'Después del simulacro',
};

/** Editores por jornada (aprobado por Julián el 12-oct-2026). */
export const EDITORES_2026: Record<JornadaId, string[]> = {
  manana: ['julian', 'coord_manana'],
  tarde: ['coord_tarde', 'hugo'],
};
