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

export const AGENDA_ACTUAL: AgendaSemanal = {
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
};
