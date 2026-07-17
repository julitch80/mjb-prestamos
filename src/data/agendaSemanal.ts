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
};
