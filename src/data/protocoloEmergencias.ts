// Protocolo institucional de atención en emergencias escolares (IE Manuel J.
// Betancur), transcrito de docs/asistente-emergencias-plan.md, sección
// "1. El documento fuente, transcrito íntegro". Contenido textual, sin
// resumir ni completar: es un documento sobre atención a menores en
// emergencias.
//
// Esta vista es SOLO de consulta rápida (no hay asistente conversacional ni
// integración con IA aquí). Ver docs/asistente-emergencias-plan.md para el
// plan del asistente, que sigue sin implementarse.

/** Qué tan firme es una instrucción: el propio documento fuente distingue
 * estos tres niveles explícitamente, sección por sección. No es un detalle
 * cosmético — es información honesta sobre el origen de cada instrucción. */
export type NivelFuente = 'institucional' | 'practica' | 'legal_sin_verificar';

export interface BloqueParrafo {
  tipo: 'parrafo';
  texto: string;
}

export interface BloquePasos {
  tipo: 'pasos';
  titulo?: string;
  items: string[];
}

/** Subsección con su propio título dentro de una sección numerada (ej. "2.1
 * Ubicar y preguntar" dentro de la sección 2). */
export interface BloqueSubseccion {
  tipo: 'subseccion';
  titulo: string;
  contenido: BloqueContenido[];
}

/** Bloque destacado visualmente — usado para la instrucción del triage
 * ("SÍ → Llama al 123 ya..."), la más importante de todo el documento. */
export interface BloqueDestacado {
  tipo: 'destacado';
  texto: string;
  tono: 'peligro' | 'info';
}

export type BloqueContenido = BloqueParrafo | BloquePasos | BloqueSubseccion | BloqueDestacado;

export interface SeccionProtocolo {
  numero: number;
  titulo: string;
  nivelFuente: NivelFuente;
  /** Nota de fuente textual del documento, tal como aparece (ej. "*Fuente:
   * práctica docente documentada — el protocolo institucional escrito no
   * especifica este criterio de decisión.*"). */
  notaFuente: string;
  contenido: BloqueContenido[];
}

export interface PasoFlujo {
  numero: number;
  nombre: string;
}

/** Flujo general de 5 pasos, tal como lo declara el documento: "Triage ›
 * Atención básica › En paralelo › Traslado › Gestión posterior." */
export const FLUJO_PROTOCOLO: PasoFlujo[] = [
  { numero: 1, nombre: 'Triage' },
  { numero: 2, nombre: 'Atención básica' },
  { numero: 3, nombre: 'En paralelo' },
  { numero: 4, nombre: 'Traslado' },
  { numero: 5, nombre: 'Gestión posterior' },
];

export const FRASE_MARCO =
  'Tu función no es diagnosticar ni tratar. Es reconocer, actuar dentro de lo básico, y conectar con quien sí puede decidir.';

export const NOTA_CIERRE =
  'Sobre este protocolo: se apoya en las brigadas institucionales y en el acompañamiento del Comité Paritario de Seguridad y Salud en el Trabajo (COPASST). Este documento integra el protocolo institucional vigente con la práctica real de atención en el aula, para facilitar su consulta rápida en el momento en que se necesita.';

/** Los dos puntos que el propio documento marca como pendientes de
 * confirmar con rectoría. Deben quedar visibles, nunca rellenados. */
export interface PendienteRectoria {
  texto: string;
}

export const PENDIENTES_RECTORIA: PendienteRectoria[] = [
  {
    texto:
      'Número/sede de la Policía de Infancia y Adolescencia de San Antonio de Prado — el documento lo marca literalmente como pendiente de confirmar antes de "imprimir la versión final".',
  },
  {
    texto:
      'Si el escenario de "no se logra contactar a nadie al final de la jornada" ya está codificado en el Manual de Convivencia, para no duplicar ni contradecir instrucciones que ya existan en otro documento institucional.',
  },
];

export const SECCIONES_PROTOCOLO: SeccionProtocolo[] = [
  {
    numero: 1,
    titulo: 'Triage inmediato — responde esto primero',
    nivelFuente: 'practica',
    notaFuente:
      'Fuente: práctica docente documentada — el protocolo institucional escrito no especifica este criterio de decisión.',
    contenido: [
      {
        tipo: 'pasos',
        titulo: '¿Se presenta alguna de estas señales?',
        items: [
          'Convulsión',
          'Pérdida de consciencia por un golpe',
          'No tienes claridad sobre qué tan grave es la situación',
        ],
      },
      {
        tipo: 'destacado',
        tono: 'peligro',
        texto:
          'SÍ → Llama al 123 ya. Sigue sus instrucciones al pie de la letra. No necesitas evaluar más: la decisión ya no es tuya, es de ellos.',
      },
      {
        tipo: 'parrafo',
        texto: 'Si tu respuesta es NO a las tres, continúa con la atención básica (punto 2).',
      },
    ],
  },
  {
    numero: 2,
    titulo: 'Atención básica — esto sí puedes hacerlo tú',
    nivelFuente: 'practica',
    notaFuente:
      'Fuente: práctica docente documentada, complementaria al protocolo institucional (que no detalla estas acciones).',
    contenido: [
      {
        tipo: 'subseccion',
        titulo: '2.1 Ubicar y preguntar',
        contenido: [
          {
            tipo: 'pasos',
            items: [
              'Ubica al estudiante en un lugar privado y cómodo, si es posible movilizarlo.',
              'Si no se puede movilizar, asegura las condiciones de privacidad y seguridad en el sitio.',
              'Pregunta: ¿ha tenido episodios similares antes? ¿qué sucedió? ¿dónde le duele? ¿cómo fue el accidente?',
            ],
          },
        ],
      },
      {
        tipo: 'subseccion',
        titulo: '2.2 Primeros auxilios básicos (según el caso)',
        contenido: [
          {
            tipo: 'pasos',
            items: [
              'Inmovilización, si es necesaria.',
              'Hidratación o alimento, si el caso lo requiere.',
              'Compresas frías, si es necesario.',
            ],
          },
        ],
      },
    ],
  },
  {
    numero: 3,
    titulo: 'En paralelo — no es una fila, hazlo al tiempo',
    nivelFuente: 'practica',
    notaFuente:
      'Fuente: práctica docente documentada. El protocolo institucional presenta estos pasos en secuencia, no en paralelo.',
    contenido: [
      {
        tipo: 'parrafo',
        texto:
          'Mientras atiendes al estudiante, no tienes que esperar a terminar para empezar lo siguiente:',
      },
      {
        tipo: 'pasos',
        items: [
          'Llama al acudiente para que recoja al estudiante.',
          'Si el accidente ocurrió en el colegio: elabora el formato de remisión para el Fondo de Protección Escolar (documentando los detalles relevantes del accidente) y solicita la constancia de estudios en secretaría, para tener todo listo cuando llegue el acudiente.',
        ],
      },
      {
        tipo: 'pasos',
        titulo: 'Al llegar el acudiente:',
        items: [
          'Solicita la información del régimen de salud del estudiante.',
          'Explica que, según la urgencia y el aseguramiento, será llevado a un hospital o IPS público o privado.',
          'Haz firmar el documento correspondiente y toma una fotografía.',
          'Sirve de apoyo para que el padre de familia pueda llevarse al estudiante al centro de salud recomendado en la póliza.',
        ],
      },
      {
        tipo: 'subseccion',
        titulo: '3.1 Si no logras contactar al acudiente',
        contenido: [
          {
            tipo: 'parrafo',
            texto:
              'Caso general (no grave) — Fuente: práctica docente documentada. El estudiante se aparta y se acompaña hasta lograr el contacto. A veces demora, pero normalmente se logra.',
          },
          {
            tipo: 'parrafo',
            texto:
              '⚠️ Si termina la jornada y no se logra contactar a ningún número registrado — Fuente: marco legal general (Ley 1098 de 2006 y Ley 1523 de 2012) — no verificado contra un protocolo escrito del MJB para este escenario específico.',
          },
          {
            tipo: 'pasos',
            items: [
              'Contacta a la Policía de Infancia y Adolescencia de la jurisdicción para gestionar el resguardo del estudiante. [Confirmar con rectoría el número/sede local de San Antonio de Prado antes de imprimir la versión final]',
              'Documenta el intento de contacto: hora y números marcados.',
              'Reporta después a Comisaría de Familia o a la Línea 141 del ICBF, si la situación lo amerita.',
            ],
          },
          {
            tipo: 'parrafo',
            texto:
              'Nota del documento: verificar con rectoría si este escenario ya está codificado en el Manual de Convivencia, para no duplicar instrucciones.',
          },
        ],
      },
    ],
  },
  {
    numero: 4,
    titulo: 'Apoyo emocional inmediato',
    nivelFuente: 'practica',
    notaFuente:
      'Fuente: práctica docente documentada. La ramificación dentro/fuera del colegio es coherente con el marco general de la Ley 1620 de 2013 (Comité Escolar de Convivencia), pero no está verificada contra el protocolo de convivencia escrito del MJB.',
    contenido: [
      {
        tipo: 'subseccion',
        titulo: '4.1 Acércate y pregunta, sin pedir detalles',
        contenido: [
          {
            tipo: 'pasos',
            items: [
              'Si identificas tristeza, angustia o bajo ánimo, acércate con calma.',
              'Aclara al estudiante que no tiene que dar detalles ni contar nada íntimo.',
              'Pregunta solo si es algo que pasó dentro del colegio o fuera de él — únicamente para ubicar el ámbito, no el contenido.',
            ],
          },
        ],
      },
      {
        tipo: 'subseccion',
        titulo: '4.2 Según el ámbito',
        contenido: [
          {
            tipo: 'pasos',
            items: [
              'Dentro del colegio → además del apoyo emocional, debe procederse internamente: evaluar si hay personas implicadas (por ejemplo, un posible caso de acoso escolar).',
              'Fuera del colegio → se ofrece el apoyo del colegio y se informa a la familia, sin pedir detalles.',
            ],
          },
        ],
      },
      {
        tipo: 'subseccion',
        titulo: '4.3 Si el estudiante requiere apoyo psicológico, dos rutas',
        contenido: [
          {
            tipo: 'pasos',
            items: [
              'Hay docente de apoyo psicológico disponible en el colegio en ese momento → ofrécelo.',
              'El estudiante se niega a recibir apoyo del colegio, o no hay nadie disponible en ese momento → llama a la Línea Naranja para orientación.',
            ],
          },
        ],
      },
    ],
  },
  {
    numero: 5,
    titulo: 'Gestión posterior — una vez el estudiante está atendido o en camino',
    nivelFuente: 'institucional',
    notaFuente:
      'Fuente: protocolo institucional "Protocolo de Atención y Respuesta ante Incidentes Escolares", con un ajuste de secuencia: el trámite del Fondo de Protección Escolar se movió al punto 3 porque, en la práctica, se hace en paralelo durante la atención, no después.',
    contenido: [
      {
        tipo: 'pasos',
        items: [
          'Dejar constancia de retiro del colegio: diligenciar el formato institucional de salida de estudiantes.',
          'Elaborar el informe administrativo post-accidente, firmado por un directivo docente, exponiendo tiempo, modo y lugar del siniestro, como antecedente ante una eventual acción judicial.',
          'Hacer seguimiento del caso: consultar cómo fue la atención en el centro médico, el diagnóstico y cómo evoluciona el estudiante en los días siguientes.',
        ],
      },
    ],
  },
];
