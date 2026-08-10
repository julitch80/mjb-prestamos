// Agenda semanal institucional — transcrita del PDF oficial "AGENDA DE LA
// SEMANA n" que Equipo Técnico Institucional envía cada viernes. Ver
// docs/agenda-semanal-actualizacion.md para el flujo de actualización.

export interface ActividadAgenda {
  hora?: string;
  actividad: string;
  asisten?: string;
  lugar?: string;
  responsables?: string;
}

export interface DiaAgenda {
  fecha: string; // YYYY-MM-DD
  dia: string; // 'lunes'..'viernes'
  festivo?: string;
  notas?: string[];
  actividades: ActividadAgenda[];
}

export interface AgendaSemanal {
  semana: number;
  periodo: number;
  desde: string;
  hasta: string;
  publicadaPor: string;
  notaFinal?: string;
  dias: DiaAgenda[];
}

/**
 * TODAS las agendas publicadas, de la más antigua a la más reciente.
 *
 * Antes solo se guardaba la semana en curso y al transcribir una nueva se
 * perdía la anterior. Eso impide contar cuántas sesiones de clase ha perdido un
 * grupo en el periodo, porque los festivos y las jornadas pedagógicas solo
 * constan aquí. La semana 8 se recuperó del historial de Git.
 *
 * PARA AÑADIR UNA SEMANA: se agrega su objeto AL FINAL de este arreglo. No hay
 * que mover ni archivar nada — AGENDA_ACTUAL es siempre el último elemento, así
 * que es imposible olvidarse de conservar la anterior.
 */
export const AGENDAS: AgendaSemanal[] = [
  {
    semana: 8,
    periodo: 2,
    desde: '2026-07-13',
    hasta: '2026-07-17',
    publicadaPor: 'Equipo Técnico Institucional',
    notaFinal: 'AGENDA DE PROFESIONALES: se envía separado por esta semana',
    dias: [
      {
        fecha: '2026-07-13',
        dia: 'lunes',
        festivo: 'Festividad de la Virgen de Chiquinquirá',
        notas: ['Diligenciamiento DRIVE para informe de alerta del 2° periodo hasta el miércoles 6:00 pm'],
        actividades: [],
      },
      {
        fecha: '2026-07-14',
        dia: 'martes',
        notas: ['Del 14 al 17 de julio capacitación tutoras PTA FI 3.0'],
        actividades: [
          {
            hora: '8:00 am a 12:00 m',
            actividad: 'Socialización de la estrategia para el fortalecimiento de las matemáticas en el grado 3°',
            responsables: 'Rectora, MOVA, Fundación LUKER',
          },
          {
            hora: '1:00 pm a 4:00 pm',
            actividad: 'Capacitación en gestión del riesgo: Instrumentos de planificación en gestión escolar de riesgo.',
            asisten: 'Julian Medina, Gloria Yaneth Gallego, Hugo Armando Yepes',
            responsables: 'MOVA, SED-DAGRD',
          },
          {
            actividad: 'Aplicación de pruebas diagnósticas del componente de lectura.',
            asisten: 'Estudiantes faltantes',
            lugar: 'Aula 1 sede GRI y Aula 1 sede La Finca',
            responsables: 'Fundación Pies Descalzos',
          },
        ],
      },
      {
        fecha: '2026-07-15',
        dia: 'miercoles',
        actividades: [
          {
            hora: '2 y 3 bloque de clase',
            actividad: 'Aplicación de 2° simulacro pruebas saber (los estudiantes tienen el primer bloque de clase)',
            asisten: 'Estudiantes de 11° y docentes acompañantes',
            lugar: 'Aulas de clase',
            responsables: 'Docentes',
          },
        ],
      },
      {
        fecha: '2026-07-16',
        dia: 'jueves',
        actividades: [
          {
            hora: '8:00 am',
            actividad: 'Capacitación auxiliares administrativos',
            asisten: 'Auxiliares administrativos',
            lugar: 'ITM Fraternidad',
            responsables: 'SED',
          },
          {
            hora: '2 y 3 bloque de clase',
            actividad: 'Aplicación de 2° simulacro pruebas saber (los estudiantes tienen el primer bloque de clase)',
            asisten: 'Estudiantes de 11° y docentes acompañantes',
            lugar: 'Aulas de clase',
            responsables: 'Docentes',
          },
        ],
      },
      {
        fecha: '2026-07-17',
        dia: 'viernes',
        actividades: [
          {
            hora: '10:00 am a 12:00 m',
            actividad: 'Reunión equipo directivo: reconocimientos aplicativo para el préstamo de espacios y equipos.',
            asisten: 'Directivos y docente Julian Medina',
            lugar: 'Sala de innovación',
            responsables: 'Rectora',
          },
        ],
      },
    ],
  },
  {
    semana: 11,
    periodo: 2,
    desde: '2026-08-03',
    hasta: '2026-08-07',
    publicadaPor: 'Equipo Técnico Institucional',
    notaFinal: 'La agenda de profesionales (orientación escolar, escuela entorno protector y tutoras PTA) viene dentro del mismo documento esta semana.',
    dias: [
      {
        fecha: '2026-08-03',
        dia: 'lunes',
        actividades: [
          {
            hora: '7:00 am a 1:00 pm',
            actividad: 'Propuestas concretas para la atención a estudiantes en condición de enfermedad y/o diagnósticos',
            asisten: 'Profesionales UAI y Psicología',
            lugar: 'Sede principal',
            responsables: 'Profesionales',
          },
          {
            hora: '11:00 am',
            actividad: 'Reunión de equipo directivo y profesionales de apoyo',
            asisten: 'Coordinadores y profesionales de apoyo',
            lugar: 'Biblioteca',
            responsables: 'Rectora',
          },
          {
            hora: '9:30 am a 2:30 pm (jornadas mañana y tarde)',
            actividad: 'Acciones educativas — Prevención de abuso sexual infantil y reconocimiento del cuerpo; prevención de enfermedades transmitidas por vectores; alimentación funcional. Se adjunta cronograma.',
            asisten: 'Profesionales MTQS',
            lugar: 'Sede Finca',
            responsables: 'Estefanía Bolívar, profesional MTS',
          },
        ],
      },
      {
        fecha: '2026-08-04',
        dia: 'martes',
        actividades: [
          {
            hora: '10:30 am a 11:40 am',
            actividad: 'Fortalecimiento de competencia lúdica',
            asisten: 'Grupo T°3 y su directora Gloria Yanet Gallego',
            lugar: 'Ludoteca Prado',
            responsables: 'INDER',
          },
          {
            hora: '11:00 am a 12:30 pm',
            actividad: 'Reunión conjunta de maestros de básica primaria',
            asisten: 'Docentes de las sedes de primaria, coordinadores y rectora',
            lugar: 'Sede Gustavo Rodas Isaza',
            responsables: 'Julián Medina',
          },
          {
            hora: '2:25 pm a 4:15 pm',
            actividad: 'Reunión grupo Tech',
            asisten: 'Grupo focal jornada tarde',
            lugar: 'Biblioteca',
            responsables: 'Luis Javier Rojas y asesor',
          },
        ],
      },
      {
        fecha: '2026-08-05',
        dia: 'miercoles',
        actividades: [
          {
            hora: '6:00 am',
            actividad: 'Reunión con padres y madres de estudiantes de grado 11: ceremonia de graduación',
            asisten: 'Padres, madres y representantes de grupo',
            lugar: 'Auditorio',
            responsables: 'Rectora',
          },
          {
            hora: '10:30 am a 12:00 m',
            actividad: 'Fortalecimiento de competencia lúdica',
            asisten: 'Grupo 2°3 y su directora Mary Luz Hoyos',
            lugar: 'Ludoteca Prado',
            responsables: 'INDER',
          },
          {
            hora: '11:00 am a 12:30 pm',
            actividad: 'Reunión de docentes del macroproyecto «Me cuido, te cuido, nos cuidamos»: plan de gestión del riesgo y simulacro',
            asisten: 'Integrantes del macroproyecto (matemáticas y ciencias naturales)',
            lugar: 'Aula de innovación',
            responsables: 'Líder del macroproyecto',
          },
          {
            hora: '11:00 am',
            actividad: 'Reunión de permanencia escolar',
            asisten: 'Auxiliares, coordinadores, profesionales de apoyo y rectora',
            lugar: 'Biblioteca',
            responsables: 'Guardián de la permanencia',
          },
        ],
      },
      {
        fecha: '2026-08-06',
        dia: 'jueves',
        actividades: [
          {
            hora: '10:30 am a 12:00 m',
            actividad: 'Fortalecimiento de competencia lúdica',
            asisten: 'Grupo 1°3 y su directora Margarita Bedoya',
            lugar: 'Ludoteca Prado',
            responsables: 'INDER',
          },
          {
            hora: '2:00 pm',
            actividad: 'Actividad educativa «Linda Calle» de EPM',
            asisten: 'Estudiantes y docentes de la sede principal, jornada tarde',
            lugar: 'Patio',
            responsables: 'Partido político y consejo de padres',
          },
        ],
      },
      {
        fecha: '2026-08-07',
        dia: 'viernes',
        festivo: 'Batalla de Boyacá',
        actividades: [],
      },
    ],
  },
  {
    semana: 12,
    periodo: 2,
    desde: '2026-08-10',
    hasta: '2026-08-14',
    publicadaPor: 'Equipo Técnico Institucional',
    notaFinal: 'La agenda de profesionales (orientación escolar, escuela entorno protector y tutoras PTA/UAI) viene dentro del mismo documento esta semana, aparte de la agenda institucional.',
    dias: [
      {
        fecha: '2026-08-10',
        dia: 'lunes',
        notas: [
          'Inicia el proceso de autoevaluación de los estudiantes',
          'Jornada sindical de ASDEM media jornada (novedades en horarios, ver en la web)',
        ],
        actividades: [
          {
            hora: '8am',
            actividad: 'Reunión coordinadora y auxiliar Yaneth para ajustes al MÁSTER, centros de interés y boletines',
            asisten: 'Coordinadora y auxiliar Yaneth',
            lugar: 'Secretaría',
          },
          {
            hora: '8:00 am',
            actividad: 'Reunión de Rectores con EEP',
            asisten: 'Rectora',
            lugar: 'INEM del poblado',
            responsables: 'SED',
          },
          {
            hora: '3h',
            actividad: 'Prevención ITS grupos de 10°',
            asisten: 'Estudiantes de grado 10°1',
            lugar: 'Aulas de clase',
            responsables: 'Enfermera de Medellín Te Quiere Saludable y docente de la hora',
          },
          {
            hora: '4h',
            actividad: 'Prevención ITS grupos de 10°',
            asisten: 'Estudiantes de grado 10°2',
            lugar: 'Aulas de clase',
            responsables: 'Enfermera de Medellín Te Quiere Saludable y docente de la hora',
          },
          {
            hora: '5h',
            actividad: 'Prevención ITS grupos de 10°',
            asisten: 'Estudiantes de grado 10°4',
            lugar: 'Aulas de clase',
            responsables: 'Enfermera de Medellín Te Quiere Saludable y docente de la hora',
          },
          {
            hora: '6h',
            actividad: 'Prevención ITS grupos de 10°',
            asisten: 'Estudiantes de grado 10°3',
            lugar: 'Aulas de clase',
            responsables: 'Enfermera de Medellín Te Quiere Saludable y docente de la hora',
          },
        ],
      },
      {
        fecha: '2026-08-11',
        dia: 'martes',
        actividades: [
          {
            hora: 'Por confirmar',
            actividad: 'Lanzamiento de la feria del libro',
            asisten: 'Vanesa, bibliotecaria',
            lugar: 'Virtual',
            responsables: 'SED',
          },
          {
            hora: '10am',
            actividad: 'Reunión con el guardián de la permanencia',
            asisten: 'Coordinadores, rectora, auxiliar y profesionales',
            lugar: 'Biblioteca',
            responsables: 'Guardián de la permanencia',
          },
          {
            hora: '1ra hora',
            actividad: 'Asesoría a docentes: ajustes razonables',
            asisten: 'Docente Ledis y DAP',
            lugar: 'Sala de Profesores',
            responsables: 'DAP - Karen Bohórquez',
          },
          {
            hora: '2da hora',
            actividad: 'Asesoría a docentes: ajustes razonables',
            asisten: 'Docente Julián y DAP',
            lugar: 'Sala de Profesores',
            responsables: 'DAP - Karen Bohórquez',
          },
          {
            hora: '3ra hora',
            actividad: 'Asesoría a docentes: ajustes razonables',
            asisten: 'Docente Doris y DAP',
            lugar: 'Sala de Profesores',
            responsables: 'DAP - Karen Bohórquez',
          },
          {
            hora: '2:30-4:15pm',
            actividad: 'Formación a mediadores escolares y representantes de grupo',
            asisten: 'Estudiantes del grado 8°',
            lugar: 'Auditorio',
            responsables: 'Profesional PP y Erika Gómez',
          },
        ],
      },
      {
        fecha: '2026-08-12',
        dia: 'miercoles',
        actividades: [
          {
            hora: '9am a 11am',
            actividad: 'Reunión en el INDER Medellín',
            asisten: 'Juan Pablo Bettin',
            lugar: 'INDER Medellín',
            responsables: 'INDER',
          },
          {
            hora: '9:30 am',
            actividad: 'Reunión con estudiantes líderes ambientales y directivos del programa Colegios Verdes',
            asisten: 'Líderes ambientales, coordinadora y Juan Carlos B.',
            lugar: 'Biblioteca',
          },
          {
            hora: '9:00 am',
            actividad: 'Reunión con líderes representativos del plan de transformación sostenible',
            asisten: 'Docente líder de democracia y líderes representativos',
            lugar: 'Sede Principal',
            responsables: 'Docente líder del proyecto de democracia - Erika Gómez',
          },
          {
            hora: '11am a 12:30pm',
            actividad: 'Reunión conjunta de maestros de bachillerato ambas jornadas',
            asisten: 'Docentes jornada AM y PM',
            lugar: 'Biblioteca',
            responsables: 'Rectora',
          },
          {
            hora: '1ra hora',
            actividad: 'Asesoría a docentes: ajustes razonables',
            asisten: 'Docente Carolina y DAP',
            lugar: 'Sala de Profesores',
            responsables: 'DAP - Karen Bohórquez',
          },
          {
            hora: '2da hora',
            actividad: 'Asesoría a docentes: ajustes razonables',
            asisten: 'Docente Fredy Gutiérrez y DAP',
            lugar: 'Sala de Profesores',
            responsables: 'DAP - Karen Bohórquez',
          },
          {
            hora: '2:25pm a 6:15pm',
            actividad: 'Reunión grupo Tech',
            asisten: 'Grupo focal jornada tarde',
            lugar: 'Biblioteca',
            responsables: 'Luis Javier Rojas y asesor',
          },
        ],
      },
      {
        fecha: '2026-08-13',
        dia: 'jueves',
        actividades: [
          {
            hora: 'Media jornada',
            actividad: 'Jornada lúdico-recreativa con líderes estudiantiles, sede bachillerato',
            asisten: 'Todos los estudiantes y docentes',
            lugar: 'Aulas y patio',
            responsables: 'Líderes estudiantiles',
          },
          {
            hora: '9am a 12m',
            actividad: 'Comunidad de aprendizaje entre auxiliares administrativos y bibliotecaria',
            lugar: 'Biblioteca',
            responsables: 'Rectora',
          },
          {
            hora: '9:00 am',
            actividad: 'Espacio de formación en gestión emocional',
            asisten: 'Grupo 2°3',
            lugar: 'Finca',
            responsables: 'Erika Gómez',
          },
          {
            hora: 'Durante la jornada',
            actividad: 'Montaje Festival Buen Comienzo',
            asisten: "DAP's - Mediador Indígena",
            lugar: 'Plaza Mayor',
            responsables: 'SED',
          },
        ],
      },
      {
        fecha: '2026-08-14',
        dia: 'viernes',
        actividades: [
          {
            hora: '7am',
            actividad: 'Reunión Consejo de Padres — tema: Antioqueñidad',
            asisten: 'Integrantes y suplentes',
            lugar: 'Biblioteca',
            responsables: 'Rectora y docente de Sociales',
          },
          {
            hora: '7:00am',
            actividad: 'Encuentro focal de padres de familia del grado primero',
            asisten: 'Padres de familia del grado 1°',
            lugar: 'GRI',
            responsables: 'Erika Gómez y Milena Badel',
          },
          {
            hora: '9:00 am',
            actividad: 'Espacio de formación en gestión emocional',
            asisten: 'Grupo 2°1',
            lugar: 'GRI',
            responsables: 'Erika Gómez',
          },
        ],
      },
    ],
  },
];

/** La agenda vigente: siempre la última publicada. */
export const AGENDA_ACTUAL: AgendaSemanal = AGENDAS[AGENDAS.length - 1];

/** El día de agenda correspondiente a una fecha, en cualquier semana guardada. */
export function agendaDeFecha(fecha: string): DiaAgenda | null {
  for (const semana of AGENDAS) {
    const dia = semana.dias.find((d) => d.fecha === fecha);
    if (dia) return dia;
  }
  return null;
}

/**
 * Motivo del festivo de esa fecha, o null si fue día lectivo.
 * Devuelve null también cuando la fecha cae en una semana que no se guardó:
 * "no consta" no es lo mismo que "hubo clase", y quien cuente pérdidas debe
 * distinguirlo — para eso está fechaCubierta().
 */
export function esFestivo(fecha: string): string | null {
  return agendaDeFecha(fecha)?.festivo ?? null;
}

/** Si esa fecha está dentro de alguna semana guardada. */
export function fechaCubierta(fecha: string): boolean {
  return AGENDAS.some((s) => fecha >= s.desde && fecha <= s.hasta);
}

/** Los festivos conocidos, ordenados por fecha. */
export function festivosConocidos(): Array<{ fecha: string; motivo: string }> {
  const out: Array<{ fecha: string; motivo: string }> = [];
  for (const semana of AGENDAS) {
    for (const dia of semana.dias) {
      if (dia.festivo) out.push({ fecha: dia.fecha, motivo: dia.festivo });
    }
  }
  return out.sort((a, b) => a.fecha.localeCompare(b.fecha));
}
