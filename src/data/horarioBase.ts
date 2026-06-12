export interface EntradaHorario {
  dia: 'lunes' | 'martes' | 'miercoles' | 'jueves' | 'viernes';
  bloque: 1 | 2 | 3 | 4 | 5 | 6;
  docente: string;
  grado: string;
  aula: string;
  jornada: 'manana' | 'tarde';
}

export const horarioBase: EntradaHorario[] = [
  {
    "dia": "martes",
    "bloque": 1,
    "docente": "monica_c",
    "grado": "9.1",
    "aula": "Lab. Ciencias",
    "jornada": "manana"
  },
  {
    "dia": "martes",
    "bloque": 2,
    "docente": "monica_c",
    "grado": "9.1",
    "aula": "Lab. Ciencias",
    "jornada": "manana"
  },
  {
    "dia": "jueves",
    "bloque": 3,
    "docente": "monica_c",
    "grado": "9.2",
    "aula": "Aula 6",
    "jornada": "manana"
  },
  {
    "dia": "jueves",
    "bloque": 4,
    "docente": "monica_c",
    "grado": "9.2",
    "aula": "Aula 6",
    "jornada": "manana"
  },
  {
    "dia": "jueves",
    "bloque": 5,
    "docente": "monica_c",
    "grado": "9.3",
    "aula": "Aula 2",
    "jornada": "manana"
  },
  {
    "dia": "jueves",
    "bloque": 6,
    "docente": "monica_c",
    "grado": "9.3",
    "aula": "Aula 2",
    "jornada": "manana"
  },
  {
    "dia": "viernes",
    "bloque": 1,
    "docente": "monica_c",
    "grado": "9.2",
    "aula": "Aula 6",
    "jornada": "manana"
  },
  {
    "dia": "viernes",
    "bloque": 2,
    "docente": "monica_c",
    "grado": "9.2",
    "aula": "Aula 6",
    "jornada": "manana"
  },
  {
    "dia": "viernes",
    "bloque": 3,
    "docente": "monica_c",
    "grado": "9.3",
    "aula": "Aula 3",
    "jornada": "manana"
  },
  {
    "dia": "viernes",
    "bloque": 4,
    "docente": "monica_c",
    "grado": "9.3",
    "aula": "Aula 3",
    "jornada": "manana"
  },
  {
    "dia": "viernes",
    "bloque": 5,
    "docente": "monica_c",
    "grado": "9.1",
    "aula": "Aula 9",
    "jornada": "manana"
  },
  {
    "dia": "viernes",
    "bloque": 6,
    "docente": "monica_c",
    "grado": "9.1",
    "aula": "Aula 9",
    "jornada": "manana"
  },
  {
    "dia": "lunes",
    "bloque": 3,
    "docente": "yoguis",
    "grado": "10.4",
    "aula": "Sala Informática",
    "jornada": "manana"
  },
  {
    "dia": "lunes",
    "bloque": 4,
    "docente": "yoguis",
    "grado": "9.1",
    "aula": "Sala Informática",
    "jornada": "manana"
  },
  {
    "dia": "lunes",
    "bloque": 5,
    "docente": "yoguis",
    "grado": "9.1",
    "aula": "Sala Informática",
    "jornada": "manana"
  },
  {
    "dia": "lunes",
    "bloque": 6,
    "docente": "yoguis",
    "grado": "11.2",
    "aula": "Sala Informática",
    "jornada": "manana"
  },
  {
    "dia": "martes",
    "bloque": 1,
    "docente": "yoguis",
    "grado": "10.3",
    "aula": "Sala Informática",
    "jornada": "manana"
  },
  {
    "dia": "martes",
    "bloque": 4,
    "docente": "yoguis",
    "grado": "9.3",
    "aula": "Sala Informática",
    "jornada": "manana"
  },
  {
    "dia": "martes",
    "bloque": 5,
    "docente": "yoguis",
    "grado": "9.3",
    "aula": "Sala Informática",
    "jornada": "manana"
  },
  {
    "dia": "martes",
    "bloque": 6,
    "docente": "yoguis",
    "grado": "CI",
    "aula": "Sala Informática",
    "jornada": "manana"
  },
  {
    "dia": "jueves",
    "bloque": 1,
    "docente": "yoguis",
    "grado": "10.1",
    "aula": "Sala Informática",
    "jornada": "manana"
  },
  {
    "dia": "jueves",
    "bloque": 4,
    "docente": "yoguis",
    "grado": "10.2",
    "aula": "Sala Informática",
    "jornada": "manana"
  },
  {
    "dia": "jueves",
    "bloque": 5,
    "docente": "yoguis",
    "grado": "9.2",
    "aula": "Sala Informática",
    "jornada": "manana"
  },
  {
    "dia": "jueves",
    "bloque": 6,
    "docente": "yoguis",
    "grado": "9.2",
    "aula": "Sala Informática",
    "jornada": "manana"
  },
  {
    "dia": "viernes",
    "bloque": 1,
    "docente": "yoguis",
    "grado": "10.2",
    "aula": "Sala Informática",
    "jornada": "manana"
  },
  {
    "dia": "viernes",
    "bloque": 2,
    "docente": "yoguis",
    "grado": "10.2",
    "aula": "Sala Informática",
    "jornada": "manana"
  },
  {
    "dia": "viernes",
    "bloque": 3,
    "docente": "yoguis",
    "grado": "11.3",
    "aula": "Sala Informática",
    "jornada": "manana"
  },
  {
    "dia": "viernes",
    "bloque": 5,
    "docente": "yoguis",
    "grado": "11.1",
    "aula": "Sala Informática",
    "jornada": "manana"
  },
  {
    "dia": "lunes",
    "bloque": 1,
    "docente": "uriel",
    "grado": "9.3",
    "aula": "Aula 10",
    "jornada": "manana"
  },
  {
    "dia": "lunes",
    "bloque": 2,
    "docente": "uriel",
    "grado": "9.3",
    "aula": "Aula 10",
    "jornada": "manana"
  },
  {
    "dia": "lunes",
    "bloque": 3,
    "docente": "uriel",
    "grado": "9.2",
    "aula": "Aula 10",
    "jornada": "manana"
  },
  {
    "dia": "lunes",
    "bloque": 4,
    "docente": "uriel",
    "grado": "9.2",
    "aula": "Aula 10",
    "jornada": "manana"
  },
  {
    "dia": "martes",
    "bloque": 1,
    "docente": "uriel",
    "grado": "9.3",
    "aula": "Aula 10",
    "jornada": "manana"
  },
  {
    "dia": "martes",
    "bloque": 2,
    "docente": "uriel",
    "grado": "9.3",
    "aula": "Aula 10",
    "jornada": "manana"
  },
  {
    "dia": "martes",
    "bloque": 3,
    "docente": "uriel",
    "grado": "9.2",
    "aula": "Aula 10",
    "jornada": "manana"
  },
  {
    "dia": "martes",
    "bloque": 4,
    "docente": "uriel",
    "grado": "9.2",
    "aula": "Aula 10",
    "jornada": "manana"
  },
  {
    "dia": "martes",
    "bloque": 5,
    "docente": "uriel",
    "grado": "9.1",
    "aula": "Aula 10",
    "jornada": "manana"
  },
  {
    "dia": "martes",
    "bloque": 6,
    "docente": "uriel",
    "grado": "9.3/CI",
    "aula": "Aula 10",
    "jornada": "manana"
  },
  {
    "dia": "miercoles",
    "bloque": 1,
    "docente": "uriel",
    "grado": "9.1",
    "aula": "Aula 10",
    "jornada": "manana"
  },
  {
    "dia": "miercoles",
    "bloque": 2,
    "docente": "uriel",
    "grado": "9.1",
    "aula": "Aula 10",
    "jornada": "manana"
  },
  {
    "dia": "miercoles",
    "bloque": 3,
    "docente": "uriel",
    "grado": "10.1",
    "aula": "Aula 10",
    "jornada": "manana"
  },
  {
    "dia": "miercoles",
    "bloque": 4,
    "docente": "uriel",
    "grado": "10.1",
    "aula": "Aula 10",
    "jornada": "manana"
  },
  {
    "dia": "jueves",
    "bloque": 2,
    "docente": "uriel",
    "grado": "10.1",
    "aula": "Aula 10",
    "jornada": "manana"
  },
  {
    "dia": "jueves",
    "bloque": 3,
    "docente": "uriel",
    "grado": "10.1",
    "aula": "Aula 10",
    "jornada": "manana"
  },
  {
    "dia": "jueves",
    "bloque": 5,
    "docente": "uriel",
    "grado": "10.2",
    "aula": "Aula 10",
    "jornada": "manana"
  },
  {
    "dia": "jueves",
    "bloque": 6,
    "docente": "uriel",
    "grado": "10.2",
    "aula": "Aula 10",
    "jornada": "manana"
  },
  {
    "dia": "viernes",
    "bloque": 1,
    "docente": "uriel",
    "grado": "9.3",
    "aula": "Aula 10",
    "jornada": "manana"
  },
  {
    "dia": "viernes",
    "bloque": 3,
    "docente": "uriel",
    "grado": "9.1",
    "aula": "Aula 10",
    "jornada": "manana"
  },
  {
    "dia": "viernes",
    "bloque": 4,
    "docente": "uriel",
    "grado": "9.1",
    "aula": "Aula 10",
    "jornada": "manana"
  },
  {
    "dia": "viernes",
    "bloque": 6,
    "docente": "uriel",
    "grado": "9.2",
    "aula": "Aula 10",
    "jornada": "manana"
  },
  {
    "dia": "lunes",
    "bloque": 1,
    "docente": "claudia",
    "grado": "11.3",
    "aula": "Aula 6",
    "jornada": "manana"
  },
  {
    "dia": "lunes",
    "bloque": 2,
    "docente": "claudia",
    "grado": "11.3",
    "aula": "Aula 6",
    "jornada": "manana"
  },
  {
    "dia": "lunes",
    "bloque": 5,
    "docente": "claudia",
    "grado": "10.3",
    "aula": "Aula 6",
    "jornada": "manana"
  },
  {
    "dia": "lunes",
    "bloque": 6,
    "docente": "claudia",
    "grado": "10.3",
    "aula": "Aula 6",
    "jornada": "manana"
  },
  {
    "dia": "martes",
    "bloque": 2,
    "docente": "claudia",
    "grado": "10.3",
    "aula": "Aula 6",
    "jornada": "manana"
  },
  {
    "dia": "martes",
    "bloque": 3,
    "docente": "claudia",
    "grado": "10.3",
    "aula": "Aula 6",
    "jornada": "manana"
  },
  {
    "dia": "martes",
    "bloque": 4,
    "docente": "claudia",
    "grado": "11.2",
    "aula": "Aula 6",
    "jornada": "manana"
  },
  {
    "dia": "martes",
    "bloque": 5,
    "docente": "claudia",
    "grado": "11.2",
    "aula": "Aula 6",
    "jornada": "manana"
  },
  {
    "dia": "miercoles",
    "bloque": 1,
    "docente": "claudia",
    "grado": "10.4",
    "aula": "Aula 6",
    "jornada": "manana"
  },
  {
    "dia": "miercoles",
    "bloque": 2,
    "docente": "claudia",
    "grado": "10.4",
    "aula": "Aula 6",
    "jornada": "manana"
  },
  {
    "dia": "miercoles",
    "bloque": 3,
    "docente": "claudia",
    "grado": "10.2",
    "aula": "Aula 6",
    "jornada": "manana"
  },
  {
    "dia": "miercoles",
    "bloque": 4,
    "docente": "claudia",
    "grado": "10.2",
    "aula": "Aula 6",
    "jornada": "manana"
  },
  {
    "dia": "miercoles",
    "bloque": 5,
    "docente": "claudia",
    "grado": "11.1",
    "aula": "Aula 6",
    "jornada": "manana"
  },
  {
    "dia": "miercoles",
    "bloque": 6,
    "docente": "claudia",
    "grado": "11.1",
    "aula": "Aula 6",
    "jornada": "manana"
  },
  {
    "dia": "jueves",
    "bloque": 1,
    "docente": "claudia",
    "grado": "11.1",
    "aula": "Aula 6",
    "jornada": "manana"
  },
  {
    "dia": "jueves",
    "bloque": 2,
    "docente": "claudia",
    "grado": "11.1",
    "aula": "Aula 6",
    "jornada": "manana"
  },
  {
    "dia": "jueves",
    "bloque": 5,
    "docente": "claudia",
    "grado": "11.3",
    "aula": "Aula 6",
    "jornada": "manana"
  },
  {
    "dia": "jueves",
    "bloque": 6,
    "docente": "claudia",
    "grado": "11.3",
    "aula": "Aula 6",
    "jornada": "manana"
  },
  {
    "dia": "viernes",
    "bloque": 3,
    "docente": "claudia",
    "grado": "11.2",
    "aula": "Aula 6",
    "jornada": "manana"
  },
  {
    "dia": "viernes",
    "bloque": 4,
    "docente": "claudia",
    "grado": "11.2",
    "aula": "Aula 6",
    "jornada": "manana"
  },
  {
    "dia": "viernes",
    "bloque": 5,
    "docente": "claudia",
    "grado": "10.4",
    "aula": "Aula 6",
    "jornada": "manana"
  },
  {
    "dia": "viernes",
    "bloque": 6,
    "docente": "claudia",
    "grado": "10.4",
    "aula": "Aula 6",
    "jornada": "manana"
  },
  {
    "dia": "lunes",
    "bloque": 1,
    "docente": "carlos",
    "grado": "10.1",
    "aula": "Aula 8",
    "jornada": "manana"
  },
  {
    "dia": "lunes",
    "bloque": 2,
    "docente": "carlos",
    "grado": "10.1",
    "aula": "Aula 8",
    "jornada": "manana"
  },
  {
    "dia": "lunes",
    "bloque": 3,
    "docente": "carlos",
    "grado": "11.1",
    "aula": "Aula 8",
    "jornada": "manana"
  },
  {
    "dia": "lunes",
    "bloque": 4,
    "docente": "carlos",
    "grado": "11.2",
    "aula": "Aula 8",
    "jornada": "manana"
  },
  {
    "dia": "lunes",
    "bloque": 5,
    "docente": "carlos",
    "grado": "11.2",
    "aula": "Aula 8",
    "jornada": "manana"
  },
  {
    "dia": "martes",
    "bloque": 1,
    "docente": "carlos",
    "grado": "10.2",
    "aula": "Aula 8",
    "jornada": "manana"
  },
  {
    "dia": "martes",
    "bloque": 3,
    "docente": "carlos",
    "grado": "11.2",
    "aula": "Aula 8",
    "jornada": "manana"
  },
  {
    "dia": "martes",
    "bloque": 5,
    "docente": "carlos",
    "grado": "10.3",
    "aula": "Aula 8",
    "jornada": "manana"
  },
  {
    "dia": "martes",
    "bloque": 6,
    "docente": "carlos",
    "grado": "10.1/CI",
    "aula": "Aula 8",
    "jornada": "manana"
  },
  {
    "dia": "miercoles",
    "bloque": 1,
    "docente": "carlos",
    "grado": "10.2",
    "aula": "Aula 8",
    "jornada": "manana"
  },
  {
    "dia": "miercoles",
    "bloque": 2,
    "docente": "carlos",
    "grado": "10.2",
    "aula": "Aula 8",
    "jornada": "manana"
  },
  {
    "dia": "miercoles",
    "bloque": 4,
    "docente": "carlos",
    "grado": "11.3",
    "aula": "Aula 8",
    "jornada": "manana"
  },
  {
    "dia": "miercoles",
    "bloque": 5,
    "docente": "carlos",
    "grado": "10.4",
    "aula": "Aula 8",
    "jornada": "manana"
  },
  {
    "dia": "miercoles",
    "bloque": 6,
    "docente": "carlos",
    "grado": "10.4",
    "aula": "Aula 8",
    "jornada": "manana"
  },
  {
    "dia": "jueves",
    "bloque": 2,
    "docente": "carlos",
    "grado": "10.4",
    "aula": "Aula 8",
    "jornada": "manana"
  },
  {
    "dia": "jueves",
    "bloque": 3,
    "docente": "carlos",
    "grado": "11.3",
    "aula": "Aula 8",
    "jornada": "manana"
  },
  {
    "dia": "jueves",
    "bloque": 4,
    "docente": "carlos",
    "grado": "11.3",
    "aula": "Aula 8",
    "jornada": "manana"
  },
  {
    "dia": "jueves",
    "bloque": 5,
    "docente": "carlos",
    "grado": "11.1",
    "aula": "Aula 8",
    "jornada": "manana"
  },
  {
    "dia": "jueves",
    "bloque": 6,
    "docente": "carlos",
    "grado": "11.1",
    "aula": "Aula 8",
    "jornada": "manana"
  },
  {
    "dia": "viernes",
    "bloque": 1,
    "docente": "carlos",
    "grado": "10.1",
    "aula": "Aula 8",
    "jornada": "manana"
  },
  {
    "dia": "viernes",
    "bloque": 3,
    "docente": "carlos",
    "grado": "10.3",
    "aula": "Aula 8",
    "jornada": "manana"
  },
  {
    "dia": "viernes",
    "bloque": 4,
    "docente": "carlos",
    "grado": "10.3",
    "aula": "Aula 8",
    "jornada": "manana"
  },
  {
    "dia": "lunes",
    "bloque": 1,
    "docente": "julian",
    "grado": "11.2",
    "aula": "Lab. Ciencias",
    "jornada": "manana"
  },
  {
    "dia": "lunes",
    "bloque": 2,
    "docente": "julian",
    "grado": "11.2",
    "aula": "Lab. Ciencias",
    "jornada": "manana"
  },
  {
    "dia": "lunes",
    "bloque": 3,
    "docente": "julian",
    "grado": "10.2",
    "aula": "Lab. Ciencias",
    "jornada": "manana"
  },
  {
    "dia": "lunes",
    "bloque": 4,
    "docente": "julian",
    "grado": "10.2",
    "aula": "Lab. Ciencias",
    "jornada": "manana"
  },
  {
    "dia": "martes",
    "bloque": 3,
    "docente": "julian",
    "grado": "11.3",
    "aula": "Lab. Ciencias",
    "jornada": "manana"
  },
  {
    "dia": "martes",
    "bloque": 4,
    "docente": "julian",
    "grado": "11.3",
    "aula": "Lab. Ciencias",
    "jornada": "manana"
  },
  {
    "dia": "martes",
    "bloque": 5,
    "docente": "julian",
    "grado": "11.1",
    "aula": "Lab. Ciencias",
    "jornada": "manana"
  },
  {
    "dia": "martes",
    "bloque": 6,
    "docente": "julian",
    "grado": "11.2/CI",
    "aula": "Lab. Ciencias",
    "jornada": "manana"
  },
  {
    "dia": "miercoles",
    "bloque": 1,
    "docente": "julian",
    "grado": "10.1",
    "aula": "Lab. Ciencias",
    "jornada": "manana"
  },
  {
    "dia": "miercoles",
    "bloque": 2,
    "docente": "julian",
    "grado": "10.1",
    "aula": "Lab. Ciencias",
    "jornada": "manana"
  },
  {
    "dia": "miercoles",
    "bloque": 3,
    "docente": "julian",
    "grado": "10.4",
    "aula": "Lab. Ciencias",
    "jornada": "manana"
  },
  {
    "dia": "miercoles",
    "bloque": 4,
    "docente": "julian",
    "grado": "10.4",
    "aula": "Lab. Ciencias",
    "jornada": "manana"
  },
  {
    "dia": "miercoles",
    "bloque": 5,
    "docente": "julian",
    "grado": "11.3",
    "aula": "Lab. Ciencias",
    "jornada": "manana"
  },
  {
    "dia": "miercoles",
    "bloque": 6,
    "docente": "julian",
    "grado": "10.3",
    "aula": "Lab. Ciencias",
    "jornada": "manana"
  },
  {
    "dia": "jueves",
    "bloque": 1,
    "docente": "julian",
    "grado": "10.4",
    "aula": "Lab. Ciencias",
    "jornada": "manana"
  },
  {
    "dia": "jueves",
    "bloque": 2,
    "docente": "julian",
    "grado": "10.2",
    "aula": "Lab. Ciencias",
    "jornada": "manana"
  },
  {
    "dia": "jueves",
    "bloque": 4,
    "docente": "julian",
    "grado": "10.1",
    "aula": "Lab. Ciencias",
    "jornada": "manana"
  },
  {
    "dia": "jueves",
    "bloque": 5,
    "docente": "julian",
    "grado": "11.2",
    "aula": "Lab. Ciencias",
    "jornada": "manana"
  },
  {
    "dia": "viernes",
    "bloque": 3,
    "docente": "julian",
    "grado": "11.1",
    "aula": "Lab. Ciencias",
    "jornada": "manana"
  },
  {
    "dia": "viernes",
    "bloque": 4,
    "docente": "julian",
    "grado": "11.1",
    "aula": "Lab. Ciencias",
    "jornada": "manana"
  },
  {
    "dia": "viernes",
    "bloque": 5,
    "docente": "julian",
    "grado": "10.3",
    "aula": "Lab. Ciencias",
    "jornada": "manana"
  },
  {
    "dia": "viernes",
    "bloque": 6,
    "docente": "julian",
    "grado": "10.3",
    "aula": "Lab. Ciencias",
    "jornada": "manana"
  },
  {
    "dia": "lunes",
    "bloque": 3,
    "docente": "margara",
    "grado": "11.3",
    "aula": "Aula 9",
    "jornada": "manana"
  },
  {
    "dia": "lunes",
    "bloque": 4,
    "docente": "margara",
    "grado": "11.3",
    "aula": "Aula 9",
    "jornada": "manana"
  },
  {
    "dia": "lunes",
    "bloque": 5,
    "docente": "margara",
    "grado": "11.1",
    "aula": "Aula 9",
    "jornada": "manana"
  },
  {
    "dia": "lunes",
    "bloque": 6,
    "docente": "margara",
    "grado": "11.1",
    "aula": "Aula 9",
    "jornada": "manana"
  },
  {
    "dia": "martes",
    "bloque": 1,
    "docente": "margara",
    "grado": "10.4",
    "aula": "Aula 9",
    "jornada": "manana"
  },
  {
    "dia": "martes",
    "bloque": 2,
    "docente": "margara",
    "grado": "10.4",
    "aula": "Aula 9",
    "jornada": "manana"
  },
  {
    "dia": "martes",
    "bloque": 3,
    "docente": "margara",
    "grado": "11.1",
    "aula": "Aula 9",
    "jornada": "manana"
  },
  {
    "dia": "martes",
    "bloque": 4,
    "docente": "margara",
    "grado": "11.1",
    "aula": "Aula 9",
    "jornada": "manana"
  },
  {
    "dia": "martes",
    "bloque": 6,
    "docente": "margara",
    "grado": "11.3/CI",
    "aula": "Aula 9",
    "jornada": "manana"
  },
  {
    "dia": "miercoles",
    "bloque": 3,
    "docente": "margara",
    "grado": "10.3",
    "aula": "Aula 9",
    "jornada": "manana"
  },
  {
    "dia": "miercoles",
    "bloque": 4,
    "docente": "margara",
    "grado": "10.3",
    "aula": "Aula 9",
    "jornada": "manana"
  },
  {
    "dia": "miercoles",
    "bloque": 5,
    "docente": "margara",
    "grado": "11.2",
    "aula": "Aula 9",
    "jornada": "manana"
  },
  {
    "dia": "miercoles",
    "bloque": 6,
    "docente": "margara",
    "grado": "11.2",
    "aula": "Aula 9",
    "jornada": "manana"
  },
  {
    "dia": "jueves",
    "bloque": 1,
    "docente": "margara",
    "grado": "11.3",
    "aula": "Aula 9",
    "jornada": "manana"
  },
  {
    "dia": "jueves",
    "bloque": 2,
    "docente": "margara",
    "grado": "11.3",
    "aula": "Aula 9",
    "jornada": "manana"
  },
  {
    "dia": "jueves",
    "bloque": 5,
    "docente": "margara",
    "grado": "10.3",
    "aula": "Aula 9",
    "jornada": "manana"
  },
  {
    "dia": "jueves",
    "bloque": 6,
    "docente": "margara",
    "grado": "10.3",
    "aula": "Aula 9",
    "jornada": "manana"
  },
  {
    "dia": "viernes",
    "bloque": 1,
    "docente": "margara",
    "grado": "11.2",
    "aula": "Aula 9",
    "jornada": "manana"
  },
  {
    "dia": "viernes",
    "bloque": 2,
    "docente": "margara",
    "grado": "11.2",
    "aula": "Aula 9",
    "jornada": "manana"
  },
  {
    "dia": "viernes",
    "bloque": 3,
    "docente": "margara",
    "grado": "10.4",
    "aula": "Aula 9",
    "jornada": "manana"
  },
  {
    "dia": "viernes",
    "bloque": 4,
    "docente": "margara",
    "grado": "10.4",
    "aula": "Aula 9",
    "jornada": "manana"
  },
  {
    "dia": "lunes",
    "bloque": 1,
    "docente": "beatriz",
    "grado": "10.2",
    "aula": "Aula 5",
    "jornada": "manana"
  },
  {
    "dia": "lunes",
    "bloque": 2,
    "docente": "beatriz",
    "grado": "10.2",
    "aula": "Aula 5",
    "jornada": "manana"
  },
  {
    "dia": "lunes",
    "bloque": 5,
    "docente": "beatriz",
    "grado": "9.3",
    "aula": "Aula 5",
    "jornada": "manana"
  },
  {
    "dia": "lunes",
    "bloque": 6,
    "docente": "beatriz",
    "grado": "9.3",
    "aula": "Aula 5",
    "jornada": "manana"
  },
  {
    "dia": "martes",
    "bloque": 1,
    "docente": "beatriz",
    "grado": "9.2",
    "aula": "Aula 5",
    "jornada": "manana"
  },
  {
    "dia": "martes",
    "bloque": 2,
    "docente": "beatriz",
    "grado": "9.2",
    "aula": "Aula 5",
    "jornada": "manana"
  },
  {
    "dia": "martes",
    "bloque": 3,
    "docente": "beatriz",
    "grado": "9.1",
    "aula": "Aula 5",
    "jornada": "manana"
  },
  {
    "dia": "martes",
    "bloque": 4,
    "docente": "beatriz",
    "grado": "9.1",
    "aula": "Aula 5",
    "jornada": "manana"
  },
  {
    "dia": "martes",
    "bloque": 6,
    "docente": "beatriz",
    "grado": "10.2/CI",
    "aula": "Aula 5",
    "jornada": "manana"
  },
  {
    "dia": "miercoles",
    "bloque": 1,
    "docente": "beatriz",
    "grado": "9.2",
    "aula": "Aula 5",
    "jornada": "manana"
  },
  {
    "dia": "miercoles",
    "bloque": 2,
    "docente": "beatriz",
    "grado": "9.2",
    "aula": "Aula 5",
    "jornada": "manana"
  },
  {
    "dia": "miercoles",
    "bloque": 5,
    "docente": "beatriz",
    "grado": "10.1",
    "aula": "Aula 5",
    "jornada": "manana"
  },
  {
    "dia": "miercoles",
    "bloque": 6,
    "docente": "beatriz",
    "grado": "10.1",
    "aula": "Aula 5",
    "jornada": "manana"
  },
  {
    "dia": "jueves",
    "bloque": 1,
    "docente": "beatriz",
    "grado": "9.3",
    "aula": "Aula 5",
    "jornada": "manana"
  },
  {
    "dia": "jueves",
    "bloque": 2,
    "docente": "beatriz",
    "grado": "9.3",
    "aula": "Aula 5",
    "jornada": "manana"
  },
  {
    "dia": "jueves",
    "bloque": 3,
    "docente": "beatriz",
    "grado": "9.1",
    "aula": "Aula 5",
    "jornada": "manana"
  },
  {
    "dia": "jueves",
    "bloque": 4,
    "docente": "beatriz",
    "grado": "9.1",
    "aula": "Aula 5",
    "jornada": "manana"
  },
  {
    "dia": "jueves",
    "bloque": 5,
    "docente": "beatriz",
    "grado": "10.1",
    "aula": "Aula 5",
    "jornada": "manana"
  },
  {
    "dia": "jueves",
    "bloque": 6,
    "docente": "beatriz",
    "grado": "10.1",
    "aula": "Aula 5",
    "jornada": "manana"
  },
  {
    "dia": "viernes",
    "bloque": 5,
    "docente": "beatriz",
    "grado": "10.2",
    "aula": "Aula 5",
    "jornada": "manana"
  },
  {
    "dia": "viernes",
    "bloque": 6,
    "docente": "beatriz",
    "grado": "10.2",
    "aula": "Aula 5",
    "jornada": "manana"
  },
  {
    "dia": "lunes",
    "bloque": 1,
    "docente": "marta",
    "grado": "9.2",
    "aula": "Aula 2",
    "jornada": "manana"
  },
  {
    "dia": "lunes",
    "bloque": 2,
    "docente": "marta",
    "grado": "9.2",
    "aula": "Aula 2",
    "jornada": "manana"
  },
  {
    "dia": "lunes",
    "bloque": 3,
    "docente": "marta",
    "grado": "10.1",
    "aula": "Aula 2",
    "jornada": "manana"
  },
  {
    "dia": "lunes",
    "bloque": 4,
    "docente": "marta",
    "grado": "10.1",
    "aula": "Aula 2",
    "jornada": "manana"
  },
  {
    "dia": "lunes",
    "bloque": 6,
    "docente": "marta",
    "grado": "9.1",
    "aula": "Aula 2",
    "jornada": "manana"
  },
  {
    "dia": "miercoles",
    "bloque": 3,
    "docente": "marta",
    "grado": "9.1",
    "aula": "Aula 2",
    "jornada": "manana"
  },
  {
    "dia": "miercoles",
    "bloque": 4,
    "docente": "marta",
    "grado": "9.1",
    "aula": "Aula 2",
    "jornada": "manana"
  },
  {
    "dia": "miercoles",
    "bloque": 5,
    "docente": "marta",
    "grado": "9.3",
    "aula": "Aula 2",
    "jornada": "manana"
  },
  {
    "dia": "miercoles",
    "bloque": 6,
    "docente": "marta",
    "grado": "9.3",
    "aula": "Aula 2",
    "jornada": "manana"
  },
  {
    "dia": "viernes",
    "bloque": 2,
    "docente": "marta",
    "grado": "9.3",
    "aula": "Aula 2",
    "jornada": "manana"
  },
  {
    "dia": "viernes",
    "bloque": 3,
    "docente": "marta",
    "grado": "10.1",
    "aula": "Aula 2",
    "jornada": "manana"
  },
  {
    "dia": "viernes",
    "bloque": 4,
    "docente": "marta",
    "grado": "10.1",
    "aula": "Aula 2",
    "jornada": "manana"
  },
  {
    "dia": "viernes",
    "bloque": 5,
    "docente": "marta",
    "grado": "9.2",
    "aula": "Aula 2",
    "jornada": "manana"
  },
  {
    "dia": "lunes",
    "bloque": 1,
    "docente": "johana",
    "grado": "11.1",
    "aula": "Aula 3",
    "jornada": "manana"
  },
  {
    "dia": "lunes",
    "bloque": 2,
    "docente": "johana",
    "grado": "11.1",
    "aula": "Aula 3",
    "jornada": "manana"
  },
  {
    "dia": "lunes",
    "bloque": 5,
    "docente": "johana",
    "grado": "11.3",
    "aula": "Aula 3",
    "jornada": "manana"
  },
  {
    "dia": "lunes",
    "bloque": 6,
    "docente": "johana",
    "grado": "11.3",
    "aula": "Aula 3",
    "jornada": "manana"
  },
  {
    "dia": "martes",
    "bloque": 1,
    "docente": "johana",
    "grado": "11.2",
    "aula": "Aula 3",
    "jornada": "manana"
  },
  {
    "dia": "martes",
    "bloque": 2,
    "docente": "johana",
    "grado": "11.2",
    "aula": "Aula 3",
    "jornada": "manana"
  },
  {
    "dia": "martes",
    "bloque": 3,
    "docente": "johana",
    "grado": "10.4",
    "aula": "Aula 3",
    "jornada": "manana"
  },
  {
    "dia": "martes",
    "bloque": 4,
    "docente": "johana",
    "grado": "10.4",
    "aula": "Aula 3",
    "jornada": "manana"
  },
  {
    "dia": "miercoles",
    "bloque": 1,
    "docente": "johana",
    "grado": "10.3",
    "aula": "Aula 3",
    "jornada": "manana"
  },
  {
    "dia": "miercoles",
    "bloque": 2,
    "docente": "johana",
    "grado": "10.3",
    "aula": "Aula 3",
    "jornada": "manana"
  },
  {
    "dia": "miercoles",
    "bloque": 3,
    "docente": "johana",
    "grado": "11.1",
    "aula": "Aula 3",
    "jornada": "manana"
  },
  {
    "dia": "miercoles",
    "bloque": 4,
    "docente": "johana",
    "grado": "11.1",
    "aula": "Aula 3",
    "jornada": "manana"
  },
  {
    "dia": "miercoles",
    "bloque": 5,
    "docente": "johana",
    "grado": "10.2",
    "aula": "Aula 3",
    "jornada": "manana"
  },
  {
    "dia": "miercoles",
    "bloque": 6,
    "docente": "johana",
    "grado": "10.2",
    "aula": "Aula 3",
    "jornada": "manana"
  },
  {
    "dia": "jueves",
    "bloque": 1,
    "docente": "johana",
    "grado": "11.2",
    "aula": "Aula 3",
    "jornada": "manana"
  },
  {
    "dia": "jueves",
    "bloque": 2,
    "docente": "johana",
    "grado": "11.2",
    "aula": "Aula 3",
    "jornada": "manana"
  },
  {
    "dia": "jueves",
    "bloque": 3,
    "docente": "johana",
    "grado": "10.3",
    "aula": "Aula 3",
    "jornada": "manana"
  },
  {
    "dia": "jueves",
    "bloque": 4,
    "docente": "johana",
    "grado": "10.3",
    "aula": "Aula 3",
    "jornada": "manana"
  },
  {
    "dia": "viernes",
    "bloque": 1,
    "docente": "johana",
    "grado": "10.4",
    "aula": "Aula 3",
    "jornada": "manana"
  },
  {
    "dia": "viernes",
    "bloque": 2,
    "docente": "johana",
    "grado": "10.4",
    "aula": "Aula 3",
    "jornada": "manana"
  },
  {
    "dia": "viernes",
    "bloque": 5,
    "docente": "johana",
    "grado": "11.3",
    "aula": "Aula 3",
    "jornada": "manana"
  },
  {
    "dia": "viernes",
    "bloque": 6,
    "docente": "johana",
    "grado": "11.3",
    "aula": "Aula 3",
    "jornada": "manana"
  },
  {
    "dia": "lunes",
    "bloque": 1,
    "docente": "gloria_a",
    "grado": "9.1",
    "aula": "Aula 4",
    "jornada": "manana"
  },
  {
    "dia": "lunes",
    "bloque": 2,
    "docente": "gloria_a",
    "grado": "9.1",
    "aula": "Aula 4",
    "jornada": "manana"
  },
  {
    "dia": "lunes",
    "bloque": 3,
    "docente": "gloria_a",
    "grado": "9.3",
    "aula": "Aula 4",
    "jornada": "manana"
  },
  {
    "dia": "lunes",
    "bloque": 4,
    "docente": "gloria_a",
    "grado": "9.3",
    "aula": "Aula 4",
    "jornada": "manana"
  },
  {
    "dia": "lunes",
    "bloque": 6,
    "docente": "gloria_a",
    "grado": "10.4",
    "aula": "Aula 4",
    "jornada": "manana"
  },
  {
    "dia": "martes",
    "bloque": 1,
    "docente": "gloria_a",
    "grado": "10.1",
    "aula": "Aula 4",
    "jornada": "manana"
  },
  {
    "dia": "martes",
    "bloque": 3,
    "docente": "gloria_a",
    "grado": "9.3",
    "aula": "Aula 4",
    "jornada": "manana"
  },
  {
    "dia": "martes",
    "bloque": 4,
    "docente": "gloria_a",
    "grado": "10.3",
    "aula": "Aula 4",
    "jornada": "manana"
  },
  {
    "dia": "martes",
    "bloque": 5,
    "docente": "gloria_a",
    "grado": "9.2",
    "aula": "Aula 4",
    "jornada": "manana"
  },
  {
    "dia": "miercoles",
    "bloque": 1,
    "docente": "gloria_a",
    "grado": "9.3",
    "aula": "Aula 4",
    "jornada": "manana"
  },
  {
    "dia": "miercoles",
    "bloque": 2,
    "docente": "gloria_a",
    "grado": "9.3",
    "aula": "Aula 4",
    "jornada": "manana"
  },
  {
    "dia": "miercoles",
    "bloque": 3,
    "docente": "gloria_a",
    "grado": "11.3",
    "aula": "Aula 4",
    "jornada": "manana"
  },
  {
    "dia": "miercoles",
    "bloque": 6,
    "docente": "gloria_a",
    "grado": "9.1",
    "aula": "Aula 4",
    "jornada": "manana"
  },
  {
    "dia": "jueves",
    "bloque": 1,
    "docente": "gloria_a",
    "grado": "9.2",
    "aula": "Aula 4",
    "jornada": "manana"
  },
  {
    "dia": "jueves",
    "bloque": 2,
    "docente": "gloria_a",
    "grado": "9.2",
    "aula": "Aula 4",
    "jornada": "manana"
  },
  {
    "dia": "jueves",
    "bloque": 3,
    "docente": "gloria_a",
    "grado": "10.2",
    "aula": "Aula 4",
    "jornada": "manana"
  },
  {
    "dia": "jueves",
    "bloque": 6,
    "docente": "gloria_a",
    "grado": "11.2",
    "aula": "Aula 4",
    "jornada": "manana"
  },
  {
    "dia": "viernes",
    "bloque": 1,
    "docente": "gloria_a",
    "grado": "9.1",
    "aula": "Aula 4",
    "jornada": "manana"
  },
  {
    "dia": "viernes",
    "bloque": 2,
    "docente": "gloria_a",
    "grado": "9.1",
    "aula": "Aula 4",
    "jornada": "manana"
  },
  {
    "dia": "viernes",
    "bloque": 3,
    "docente": "gloria_a",
    "grado": "9.2",
    "aula": "Aula 4",
    "jornada": "manana"
  },
  {
    "dia": "viernes",
    "bloque": 4,
    "docente": "gloria_a",
    "grado": "9.2",
    "aula": "Aula 4",
    "jornada": "manana"
  },
  {
    "dia": "viernes",
    "bloque": 6,
    "docente": "gloria_a",
    "grado": "11.1",
    "aula": "Aula 4",
    "jornada": "manana"
  },
  {
    "dia": "lunes",
    "bloque": 1,
    "docente": "ledis",
    "grado": "10.3",
    "aula": "Aula 1",
    "jornada": "manana"
  },
  {
    "dia": "lunes",
    "bloque": 2,
    "docente": "ledis",
    "grado": "10.3",
    "aula": "Aula 1",
    "jornada": "manana"
  },
  {
    "dia": "lunes",
    "bloque": 3,
    "docente": "ledis",
    "grado": "11.2",
    "aula": "Aula 1",
    "jornada": "manana"
  },
  {
    "dia": "lunes",
    "bloque": 4,
    "docente": "ledis",
    "grado": "11.1",
    "aula": "Aula 1",
    "jornada": "manana"
  },
  {
    "dia": "lunes",
    "bloque": 5,
    "docente": "ledis",
    "grado": "10.1",
    "aula": "Aula 1",
    "jornada": "manana"
  },
  {
    "dia": "lunes",
    "bloque": 6,
    "docente": "ledis",
    "grado": "10.1",
    "aula": "Aula 1",
    "jornada": "manana"
  },
  {
    "dia": "martes",
    "bloque": 2,
    "docente": "ledis",
    "grado": "10.2",
    "aula": "Aula 1",
    "jornada": "manana"
  },
  {
    "dia": "martes",
    "bloque": 3,
    "docente": "ledis",
    "grado": "10.2",
    "aula": "Aula 1",
    "jornada": "manana"
  },
  {
    "dia": "martes",
    "bloque": 5,
    "docente": "ledis",
    "grado": "10.4",
    "aula": "Aula 1",
    "jornada": "manana"
  },
  {
    "dia": "martes",
    "bloque": 6,
    "docente": "ledis",
    "grado": "10.3/CI",
    "aula": "Aula 1",
    "jornada": "manana"
  },
  {
    "dia": "miercoles",
    "bloque": 1,
    "docente": "ledis",
    "grado": "11.3",
    "aula": "Aula 1",
    "jornada": "manana"
  },
  {
    "dia": "miercoles",
    "bloque": 2,
    "docente": "ledis",
    "grado": "11.3",
    "aula": "Aula 1",
    "jornada": "manana"
  },
  {
    "dia": "miercoles",
    "bloque": 5,
    "docente": "ledis",
    "grado": "10.3",
    "aula": "Aula 1",
    "jornada": "manana"
  },
  {
    "dia": "jueves",
    "bloque": 1,
    "docente": "ledis",
    "grado": "10.2",
    "aula": "Aula 1",
    "jornada": "manana"
  },
  {
    "dia": "jueves",
    "bloque": 3,
    "docente": "ledis",
    "grado": "11.1",
    "aula": "Aula 1",
    "jornada": "manana"
  },
  {
    "dia": "jueves",
    "bloque": 4,
    "docente": "ledis",
    "grado": "11.1",
    "aula": "Aula 1",
    "jornada": "manana"
  },
  {
    "dia": "jueves",
    "bloque": 5,
    "docente": "ledis",
    "grado": "10.4",
    "aula": "Aula 1",
    "jornada": "manana"
  },
  {
    "dia": "jueves",
    "bloque": 6,
    "docente": "ledis",
    "grado": "10.4",
    "aula": "Aula 1",
    "jornada": "manana"
  },
  {
    "dia": "viernes",
    "bloque": 2,
    "docente": "ledis",
    "grado": "10.1",
    "aula": "Aula 1",
    "jornada": "manana"
  },
  {
    "dia": "viernes",
    "bloque": 4,
    "docente": "ledis",
    "grado": "11.3",
    "aula": "Aula 1",
    "jornada": "manana"
  },
  {
    "dia": "viernes",
    "bloque": 5,
    "docente": "ledis",
    "grado": "11.2",
    "aula": "Aula 1",
    "jornada": "manana"
  },
  {
    "dia": "viernes",
    "bloque": 6,
    "docente": "ledis",
    "grado": "11.2",
    "aula": "Aula 1",
    "jornada": "manana"
  },
  {
    "dia": "lunes",
    "bloque": 1,
    "docente": "adolfo",
    "grado": "10.4",
    "aula": "Patio",
    "jornada": "manana"
  },
  {
    "dia": "lunes",
    "bloque": 2,
    "docente": "adolfo",
    "grado": "10.4",
    "aula": "Patio",
    "jornada": "manana"
  },
  {
    "dia": "lunes",
    "bloque": 3,
    "docente": "adolfo",
    "grado": "10.3",
    "aula": "Patio",
    "jornada": "manana"
  },
  {
    "dia": "lunes",
    "bloque": 4,
    "docente": "adolfo",
    "grado": "10.3",
    "aula": "Patio",
    "jornada": "manana"
  },
  {
    "dia": "lunes",
    "bloque": 5,
    "docente": "adolfo",
    "grado": "9.2",
    "aula": "Patio",
    "jornada": "manana"
  },
  {
    "dia": "lunes",
    "bloque": 6,
    "docente": "adolfo",
    "grado": "9.2",
    "aula": "Patio",
    "jornada": "manana"
  },
  {
    "dia": "martes",
    "bloque": 1,
    "docente": "adolfo",
    "grado": "11.1",
    "aula": "Patio",
    "jornada": "manana"
  },
  {
    "dia": "martes",
    "bloque": 2,
    "docente": "adolfo",
    "grado": "11.1",
    "aula": "Patio",
    "jornada": "manana"
  },
  {
    "dia": "martes",
    "bloque": 4,
    "docente": "adolfo",
    "grado": "10.2",
    "aula": "Patio",
    "jornada": "manana"
  },
  {
    "dia": "martes",
    "bloque": 5,
    "docente": "adolfo",
    "grado": "10.2",
    "aula": "Patio",
    "jornada": "manana"
  },
  {
    "dia": "martes",
    "bloque": 6,
    "docente": "adolfo",
    "grado": "10.4/CI",
    "aula": "Patio",
    "jornada": "manana"
  },
  {
    "dia": "miercoles",
    "bloque": 3,
    "docente": "adolfo",
    "grado": "9.3",
    "aula": "Patio",
    "jornada": "manana"
  },
  {
    "dia": "miercoles",
    "bloque": 4,
    "docente": "adolfo",
    "grado": "9.3",
    "aula": "Patio",
    "jornada": "manana"
  },
  {
    "dia": "jueves",
    "bloque": 3,
    "docente": "adolfo",
    "grado": "11.2",
    "aula": "Patio",
    "jornada": "manana"
  },
  {
    "dia": "jueves",
    "bloque": 4,
    "docente": "adolfo",
    "grado": "11.2",
    "aula": "Patio",
    "jornada": "manana"
  },
  {
    "dia": "jueves",
    "bloque": 5,
    "docente": "adolfo",
    "grado": "9.1",
    "aula": "Patio",
    "jornada": "manana"
  },
  {
    "dia": "jueves",
    "bloque": 6,
    "docente": "adolfo",
    "grado": "9.1",
    "aula": "Patio",
    "jornada": "manana"
  },
  {
    "dia": "viernes",
    "bloque": 1,
    "docente": "adolfo",
    "grado": "11.3",
    "aula": "Patio",
    "jornada": "manana"
  },
  {
    "dia": "viernes",
    "bloque": 2,
    "docente": "adolfo",
    "grado": "11.3",
    "aula": "Patio",
    "jornada": "manana"
  },
  {
    "dia": "viernes",
    "bloque": 5,
    "docente": "adolfo",
    "grado": "10.1",
    "aula": "Patio",
    "jornada": "manana"
  },
  {
    "dia": "viernes",
    "bloque": 6,
    "docente": "adolfo",
    "grado": "10.1",
    "aula": "Patio",
    "jornada": "manana"
  },
  {
    "dia": "lunes",
    "bloque": 3,
    "docente": "jorge",
    "grado": "9.1",
    "aula": "Aula 7",
    "jornada": "manana"
  },
  {
    "dia": "lunes",
    "bloque": 4,
    "docente": "jorge",
    "grado": "10.4",
    "aula": "Aula 7",
    "jornada": "manana"
  },
  {
    "dia": "lunes",
    "bloque": 5,
    "docente": "jorge",
    "grado": "10.4",
    "aula": "Aula 7",
    "jornada": "manana"
  },
  {
    "dia": "martes",
    "bloque": 2,
    "docente": "jorge",
    "grado": "10.1",
    "aula": "Aula 2",
    "jornada": "manana"
  },
  {
    "dia": "martes",
    "bloque": 3,
    "docente": "jorge",
    "grado": "10.1",
    "aula": "Aula 2",
    "jornada": "manana"
  },
  {
    "dia": "martes",
    "bloque": 5,
    "docente": "jorge",
    "grado": "11.3",
    "aula": "Aula 2",
    "jornada": "manana"
  },
  {
    "dia": "martes",
    "bloque": 6,
    "docente": "jorge",
    "grado": "9.2/CI",
    "aula": "Aula 2",
    "jornada": "manana"
  },
  {
    "dia": "miercoles",
    "bloque": 1,
    "docente": "jorge",
    "grado": "11.2",
    "aula": "Aula 2",
    "jornada": "manana"
  },
  {
    "dia": "miercoles",
    "bloque": 2,
    "docente": "jorge",
    "grado": "11.2",
    "aula": "Aula 2",
    "jornada": "manana"
  },
  {
    "dia": "miercoles",
    "bloque": 3,
    "docente": "jorge",
    "grado": "9.2",
    "aula": "Aula 5",
    "jornada": "manana"
  },
  {
    "dia": "miercoles",
    "bloque": 4,
    "docente": "jorge",
    "grado": "9.2",
    "aula": "Aula 5",
    "jornada": "manana"
  },
  {
    "dia": "miercoles",
    "bloque": 5,
    "docente": "jorge",
    "grado": "9.1",
    "aula": "Aula 10",
    "jornada": "manana"
  },
  {
    "dia": "miercoles",
    "bloque": 6,
    "docente": "jorge",
    "grado": "11.3",
    "aula": "Aula 10",
    "jornada": "manana"
  },
  {
    "dia": "jueves",
    "bloque": 1,
    "docente": "jorge",
    "grado": "10.3",
    "aula": "Aula 2",
    "jornada": "manana"
  },
  {
    "dia": "jueves",
    "bloque": 2,
    "docente": "jorge",
    "grado": "10.3",
    "aula": "Aula 2",
    "jornada": "manana"
  },
  {
    "dia": "jueves",
    "bloque": 3,
    "docente": "jorge",
    "grado": "9.3",
    "aula": "Aula 2",
    "jornada": "manana"
  },
  {
    "dia": "jueves",
    "bloque": 4,
    "docente": "jorge",
    "grado": "9.3",
    "aula": "Aula 2",
    "jornada": "manana"
  },
  {
    "dia": "viernes",
    "bloque": 1,
    "docente": "jorge",
    "grado": "11.1",
    "aula": "Aula 5",
    "jornada": "manana"
  },
  {
    "dia": "viernes",
    "bloque": 2,
    "docente": "jorge",
    "grado": "11.1",
    "aula": "Aula 5",
    "jornada": "manana"
  },
  {
    "dia": "viernes",
    "bloque": 3,
    "docente": "jorge",
    "grado": "10.2",
    "aula": "Aula 5",
    "jornada": "manana"
  },
  {
    "dia": "viernes",
    "bloque": 4,
    "docente": "jorge",
    "grado": "10.2",
    "aula": "Aula 5",
    "jornada": "manana"
  },
  {
    "dia": "lunes",
    "bloque": 5,
    "docente": "doris",
    "grado": "10.2",
    "aula": "Aula 7",
    "jornada": "manana"
  },
  {
    "dia": "lunes",
    "bloque": 6,
    "docente": "doris",
    "grado": "10.2",
    "aula": "Aula 7",
    "jornada": "manana"
  },
  {
    "dia": "martes",
    "bloque": 1,
    "docente": "doris",
    "grado": "11.3",
    "aula": "Aula 7",
    "jornada": "manana"
  },
  {
    "dia": "martes",
    "bloque": 2,
    "docente": "doris",
    "grado": "11.3",
    "aula": "Aula 7",
    "jornada": "manana"
  },
  {
    "dia": "martes",
    "bloque": 4,
    "docente": "doris",
    "grado": "10.1",
    "aula": "Aula 7",
    "jornada": "manana"
  },
  {
    "dia": "martes",
    "bloque": 5,
    "docente": "doris",
    "grado": "10.1",
    "aula": "Aula 7",
    "jornada": "manana"
  },
  {
    "dia": "martes",
    "bloque": 6,
    "docente": "doris",
    "grado": "9.1/CI",
    "aula": "Aula 7",
    "jornada": "manana"
  },
  {
    "dia": "miercoles",
    "bloque": 1,
    "docente": "doris",
    "grado": "11.1",
    "aula": "Aula 7",
    "jornada": "manana"
  },
  {
    "dia": "miercoles",
    "bloque": 2,
    "docente": "doris",
    "grado": "11.1",
    "aula": "Aula 7",
    "jornada": "manana"
  },
  {
    "dia": "miercoles",
    "bloque": 3,
    "docente": "doris",
    "grado": "11.2",
    "aula": "Aula 7",
    "jornada": "manana"
  },
  {
    "dia": "miercoles",
    "bloque": 4,
    "docente": "doris",
    "grado": "11.2",
    "aula": "Aula 7",
    "jornada": "manana"
  },
  {
    "dia": "miercoles",
    "bloque": 5,
    "docente": "doris",
    "grado": "9.2",
    "aula": "Aula 7",
    "jornada": "manana"
  },
  {
    "dia": "miercoles",
    "bloque": 6,
    "docente": "doris",
    "grado": "9.2",
    "aula": "Aula 7",
    "jornada": "manana"
  },
  {
    "dia": "jueves",
    "bloque": 1,
    "docente": "doris",
    "grado": "9.1",
    "aula": "Aula 7",
    "jornada": "manana"
  },
  {
    "dia": "jueves",
    "bloque": 2,
    "docente": "doris",
    "grado": "9.1",
    "aula": "Aula 7",
    "jornada": "manana"
  },
  {
    "dia": "jueves",
    "bloque": 3,
    "docente": "doris",
    "grado": "10.4",
    "aula": "Aula 7",
    "jornada": "manana"
  },
  {
    "dia": "jueves",
    "bloque": 4,
    "docente": "doris",
    "grado": "10.4",
    "aula": "Aula 7",
    "jornada": "manana"
  },
  {
    "dia": "viernes",
    "bloque": 1,
    "docente": "doris",
    "grado": "10.3",
    "aula": "Aula 7",
    "jornada": "manana"
  },
  {
    "dia": "viernes",
    "bloque": 2,
    "docente": "doris",
    "grado": "10.3",
    "aula": "Aula 7",
    "jornada": "manana"
  },
  {
    "dia": "viernes",
    "bloque": 5,
    "docente": "doris",
    "grado": "9.3",
    "aula": "Aula 7",
    "jornada": "manana"
  },
  {
    "dia": "viernes",
    "bloque": 6,
    "docente": "doris",
    "grado": "9.3",
    "aula": "Aula 7",
    "jornada": "manana"
  },
  {
    "dia": "martes",
    "bloque": 6,
    "docente": "edgar",
    "grado": "11.1/CI",
    "aula": "Auditorio",
    "jornada": "manana"
  },
  {
    "dia": "lunes",
    "bloque": 1,
    "docente": "edgar",
    "grado": "8º1",
    "aula": "A7",
    "jornada": "tarde"
  },
  {
    "dia": "lunes",
    "bloque": 2,
    "docente": "edgar",
    "grado": "8º1",
    "aula": "A7",
    "jornada": "tarde"
  },
  {
    "dia": "lunes",
    "bloque": 5,
    "docente": "edgar",
    "grado": "8º4",
    "aula": "A4",
    "jornada": "tarde"
  },
  {
    "dia": "lunes",
    "bloque": 6,
    "docente": "edgar",
    "grado": "8º4",
    "aula": "A4",
    "jornada": "tarde"
  },
  {
    "dia": "martes",
    "bloque": 1,
    "docente": "edgar",
    "grado": "8º1",
    "aula": "A7",
    "jornada": "tarde"
  },
  {
    "dia": "martes",
    "bloque": 4,
    "docente": "edgar",
    "grado": "6º2",
    "aula": "A9",
    "jornada": "tarde"
  },
  {
    "dia": "martes",
    "bloque": 5,
    "docente": "edgar",
    "grado": "6º2",
    "aula": "A9",
    "jornada": "tarde"
  },
  {
    "dia": "miercoles",
    "bloque": 1,
    "docente": "edgar",
    "grado": "8º2",
    "aula": "A6",
    "jornada": "tarde"
  },
  {
    "dia": "miercoles",
    "bloque": 2,
    "docente": "edgar",
    "grado": "8º2",
    "aula": "A6",
    "jornada": "tarde"
  },
  {
    "dia": "miercoles",
    "bloque": 3,
    "docente": "edgar",
    "grado": "6º1",
    "aula": "A8",
    "jornada": "tarde"
  },
  {
    "dia": "miercoles",
    "bloque": 4,
    "docente": "edgar",
    "grado": "6º1",
    "aula": "A8",
    "jornada": "tarde"
  },
  {
    "dia": "miercoles",
    "bloque": 5,
    "docente": "edgar",
    "grado": "8º3",
    "aula": "A5",
    "jornada": "tarde"
  },
  {
    "dia": "miercoles",
    "bloque": 6,
    "docente": "edgar",
    "grado": "8º3",
    "aula": "A5",
    "jornada": "tarde"
  },
  {
    "dia": "jueves",
    "bloque": 1,
    "docente": "edgar",
    "grado": "7º3",
    "aula": "A3",
    "jornada": "tarde"
  },
  {
    "dia": "jueves",
    "bloque": 2,
    "docente": "edgar",
    "grado": "7º3",
    "aula": "A3",
    "jornada": "tarde"
  },
  {
    "dia": "jueves",
    "bloque": 5,
    "docente": "edgar",
    "grado": "6º3",
    "aula": "A10",
    "jornada": "tarde"
  },
  {
    "dia": "jueves",
    "bloque": 6,
    "docente": "edgar",
    "grado": "6º3",
    "aula": "A10",
    "jornada": "tarde"
  },
  {
    "dia": "viernes",
    "bloque": 3,
    "docente": "edgar",
    "grado": "7º1",
    "aula": "A1",
    "jornada": "tarde"
  },
  {
    "dia": "viernes",
    "bloque": 4,
    "docente": "edgar",
    "grado": "7º1",
    "aula": "A1",
    "jornada": "tarde"
  },
  {
    "dia": "viernes",
    "bloque": 5,
    "docente": "edgar",
    "grado": "7º2",
    "aula": "A2",
    "jornada": "tarde"
  },
  {
    "dia": "viernes",
    "bloque": 6,
    "docente": "edgar",
    "grado": "7º2",
    "aula": "A2",
    "jornada": "tarde"
  },
  {
    "dia": "lunes",
    "bloque": 1,
    "docente": "carolina",
    "grado": "6º3",
    "aula": "A10",
    "jornada": "tarde"
  },
  {
    "dia": "lunes",
    "bloque": 2,
    "docente": "carolina",
    "grado": "6º3",
    "aula": "A10",
    "jornada": "tarde"
  },
  {
    "dia": "lunes",
    "bloque": 3,
    "docente": "carolina",
    "grado": "6º1",
    "aula": "A8",
    "jornada": "tarde"
  },
  {
    "dia": "lunes",
    "bloque": 4,
    "docente": "carolina",
    "grado": "6º1",
    "aula": "A8",
    "jornada": "tarde"
  },
  {
    "dia": "lunes",
    "bloque": 5,
    "docente": "carolina",
    "grado": "6º2",
    "aula": "A9",
    "jornada": "tarde"
  },
  {
    "dia": "lunes",
    "bloque": 6,
    "docente": "carolina",
    "grado": "6º2",
    "aula": "A9",
    "jornada": "tarde"
  },
  {
    "dia": "martes",
    "bloque": 1,
    "docente": "carolina",
    "grado": "6º3",
    "aula": "A10",
    "jornada": "tarde"
  },
  {
    "dia": "martes",
    "bloque": 3,
    "docente": "carolina",
    "grado": "7º1",
    "aula": "A1",
    "jornada": "tarde"
  },
  {
    "dia": "martes",
    "bloque": 4,
    "docente": "carolina",
    "grado": "7º1",
    "aula": "A1",
    "jornada": "tarde"
  },
  {
    "dia": "martes",
    "bloque": 5,
    "docente": "carolina",
    "grado": "7º2",
    "aula": "A2",
    "jornada": "tarde"
  },
  {
    "dia": "martes",
    "bloque": 6,
    "docente": "carolina",
    "grado": "7º2",
    "aula": "A2",
    "jornada": "tarde"
  },
  {
    "dia": "miercoles",
    "bloque": 3,
    "docente": "carolina",
    "grado": "6º2",
    "aula": "A9",
    "jornada": "tarde"
  },
  {
    "dia": "miercoles",
    "bloque": 4,
    "docente": "carolina",
    "grado": "6º2",
    "aula": "A9",
    "jornada": "tarde"
  },
  {
    "dia": "jueves",
    "bloque": 1,
    "docente": "carolina",
    "grado": "6º1",
    "aula": "A8",
    "jornada": "tarde"
  },
  {
    "dia": "jueves",
    "bloque": 2,
    "docente": "carolina",
    "grado": "6º1",
    "aula": "A8",
    "jornada": "tarde"
  },
  {
    "dia": "jueves",
    "bloque": 3,
    "docente": "carolina",
    "grado": "7º2",
    "aula": "A2",
    "jornada": "tarde"
  },
  {
    "dia": "jueves",
    "bloque": 4,
    "docente": "carolina",
    "grado": "7º2",
    "aula": "A2",
    "jornada": "tarde"
  },
  {
    "dia": "viernes",
    "bloque": 3,
    "docente": "carolina",
    "grado": "6º3",
    "aula": "A10",
    "jornada": "tarde"
  },
  {
    "dia": "viernes",
    "bloque": 4,
    "docente": "carolina",
    "grado": "6º3",
    "aula": "A10",
    "jornada": "tarde"
  },
  {
    "dia": "viernes",
    "bloque": 5,
    "docente": "carolina",
    "grado": "7º1",
    "aula": "A1",
    "jornada": "tarde"
  },
  {
    "dia": "viernes",
    "bloque": 6,
    "docente": "carolina",
    "grado": "7º1",
    "aula": "A1",
    "jornada": "tarde"
  },
  {
    "dia": "lunes",
    "bloque": 1,
    "docente": "monica_rave",
    "grado": "8º3",
    "aula": "A5",
    "jornada": "tarde"
  },
  {
    "dia": "lunes",
    "bloque": 2,
    "docente": "monica_rave",
    "grado": "8º3",
    "aula": "A5",
    "jornada": "tarde"
  },
  {
    "dia": "lunes",
    "bloque": 3,
    "docente": "monica_rave",
    "grado": "8º4",
    "aula": "A4",
    "jornada": "tarde"
  },
  {
    "dia": "lunes",
    "bloque": 4,
    "docente": "monica_rave",
    "grado": "8º4",
    "aula": "A4",
    "jornada": "tarde"
  },
  {
    "dia": "lunes",
    "bloque": 5,
    "docente": "monica_rave",
    "grado": "8º2",
    "aula": "A6",
    "jornada": "tarde"
  },
  {
    "dia": "lunes",
    "bloque": 6,
    "docente": "monica_rave",
    "grado": "8º2",
    "aula": "A6",
    "jornada": "tarde"
  },
  {
    "dia": "martes",
    "bloque": 1,
    "docente": "monica_rave",
    "grado": "8º3",
    "aula": "A5",
    "jornada": "tarde"
  },
  {
    "dia": "martes",
    "bloque": 2,
    "docente": "monica_rave",
    "grado": "8º3",
    "aula": "A5",
    "jornada": "tarde"
  },
  {
    "dia": "martes",
    "bloque": 3,
    "docente": "monica_rave",
    "grado": "7º3",
    "aula": "A3",
    "jornada": "tarde"
  },
  {
    "dia": "martes",
    "bloque": 4,
    "docente": "monica_rave",
    "grado": "7º3",
    "aula": "A3",
    "jornada": "tarde"
  },
  {
    "dia": "miercoles",
    "bloque": 1,
    "docente": "monica_rave",
    "grado": "8º4",
    "aula": "A4",
    "jornada": "tarde"
  },
  {
    "dia": "miercoles",
    "bloque": 2,
    "docente": "monica_rave",
    "grado": "8º4",
    "aula": "A4",
    "jornada": "tarde"
  },
  {
    "dia": "miercoles",
    "bloque": 3,
    "docente": "monica_rave",
    "grado": "8º1",
    "aula": "A7",
    "jornada": "tarde"
  },
  {
    "dia": "miercoles",
    "bloque": 4,
    "docente": "monica_rave",
    "grado": "8º1",
    "aula": "A7",
    "jornada": "tarde"
  },
  {
    "dia": "jueves",
    "bloque": 1,
    "docente": "monica_rave",
    "grado": "8º3",
    "aula": "A5",
    "jornada": "tarde"
  },
  {
    "dia": "jueves",
    "bloque": 2,
    "docente": "monica_rave",
    "grado": "8º3",
    "aula": "A5",
    "jornada": "tarde"
  },
  {
    "dia": "jueves",
    "bloque": 3,
    "docente": "monica_rave",
    "grado": "7º3",
    "aula": "A3",
    "jornada": "tarde"
  },
  {
    "dia": "jueves",
    "bloque": 4,
    "docente": "monica_rave",
    "grado": "7º3",
    "aula": "A3",
    "jornada": "tarde"
  },
  {
    "dia": "viernes",
    "bloque": 3,
    "docente": "monica_rave",
    "grado": "8º2",
    "aula": "A6",
    "jornada": "tarde"
  },
  {
    "dia": "viernes",
    "bloque": 4,
    "docente": "monica_rave",
    "grado": "8º2",
    "aula": "A6",
    "jornada": "tarde"
  },
  {
    "dia": "viernes",
    "bloque": 5,
    "docente": "monica_rave",
    "grado": "8º1",
    "aula": "A7",
    "jornada": "tarde"
  },
  {
    "dia": "viernes",
    "bloque": 6,
    "docente": "monica_rave",
    "grado": "8º1",
    "aula": "A7",
    "jornada": "tarde"
  },
  {
    "dia": "lunes",
    "bloque": 3,
    "docente": "fredy_g",
    "grado": "8º3",
    "aula": "A5",
    "jornada": "tarde"
  },
  {
    "dia": "lunes",
    "bloque": 4,
    "docente": "fredy_g",
    "grado": "8º3",
    "aula": "A5",
    "jornada": "tarde"
  },
  {
    "dia": "lunes",
    "bloque": 5,
    "docente": "fredy_g",
    "grado": "8º1",
    "aula": "A7",
    "jornada": "tarde"
  },
  {
    "dia": "lunes",
    "bloque": 6,
    "docente": "fredy_g",
    "grado": "8º1",
    "aula": "A7",
    "jornada": "tarde"
  },
  {
    "dia": "martes",
    "bloque": 3,
    "docente": "fredy_g",
    "grado": "8º4",
    "aula": "A4",
    "jornada": "tarde"
  },
  {
    "dia": "martes",
    "bloque": 4,
    "docente": "fredy_g",
    "grado": "8º1",
    "aula": "A7",
    "jornada": "tarde"
  },
  {
    "dia": "martes",
    "bloque": 5,
    "docente": "fredy_g",
    "grado": "8º1",
    "aula": "A7",
    "jornada": "tarde"
  },
  {
    "dia": "martes",
    "bloque": 6,
    "docente": "fredy_g",
    "grado": "8º2",
    "aula": "A6",
    "jornada": "tarde"
  },
  {
    "dia": "miercoles",
    "bloque": 3,
    "docente": "fredy_g",
    "grado": "8º3",
    "aula": "A5",
    "jornada": "tarde"
  },
  {
    "dia": "miercoles",
    "bloque": 5,
    "docente": "fredy_g",
    "grado": "8º2",
    "aula": "A6",
    "jornada": "tarde"
  },
  {
    "dia": "miercoles",
    "bloque": 6,
    "docente": "fredy_g",
    "grado": "8º2",
    "aula": "A6",
    "jornada": "tarde"
  },
  {
    "dia": "jueves",
    "bloque": 1,
    "docente": "fredy_g",
    "grado": "8º4",
    "aula": "A4",
    "jornada": "tarde"
  },
  {
    "dia": "jueves",
    "bloque": 2,
    "docente": "fredy_g",
    "grado": "8º4",
    "aula": "A4",
    "jornada": "tarde"
  },
  {
    "dia": "jueves",
    "bloque": 3,
    "docente": "fredy_g",
    "grado": "8º1",
    "aula": "A7",
    "jornada": "tarde"
  },
  {
    "dia": "jueves",
    "bloque": 4,
    "docente": "fredy_g",
    "grado": "8º1",
    "aula": "A7",
    "jornada": "tarde"
  },
  {
    "dia": "viernes",
    "bloque": 1,
    "docente": "fredy_g",
    "grado": "8º2",
    "aula": "A6",
    "jornada": "tarde"
  },
  {
    "dia": "viernes",
    "bloque": 2,
    "docente": "fredy_g",
    "grado": "8º2",
    "aula": "A6",
    "jornada": "tarde"
  },
  {
    "dia": "viernes",
    "bloque": 3,
    "docente": "fredy_g",
    "grado": "8º3",
    "aula": "A5",
    "jornada": "tarde"
  },
  {
    "dia": "viernes",
    "bloque": 4,
    "docente": "fredy_g",
    "grado": "8º3",
    "aula": "A5",
    "jornada": "tarde"
  },
  {
    "dia": "viernes",
    "bloque": 5,
    "docente": "fredy_g",
    "grado": "8º4",
    "aula": "A4",
    "jornada": "tarde"
  },
  {
    "dia": "viernes",
    "bloque": 6,
    "docente": "fredy_g",
    "grado": "8º4",
    "aula": "A4",
    "jornada": "tarde"
  },
  {
    "dia": "lunes",
    "bloque": 1,
    "docente": "fredy_garcia",
    "grado": "6º2",
    "aula": "A9",
    "jornada": "tarde"
  },
  {
    "dia": "lunes",
    "bloque": 3,
    "docente": "fredy_garcia",
    "grado": "8º1",
    "aula": "A7",
    "jornada": "tarde"
  },
  {
    "dia": "lunes",
    "bloque": 4,
    "docente": "fredy_garcia",
    "grado": "7º2",
    "aula": "A2",
    "jornada": "tarde"
  },
  {
    "dia": "lunes",
    "bloque": 5,
    "docente": "fredy_garcia",
    "grado": "7º1",
    "aula": "A1",
    "jornada": "tarde"
  },
  {
    "dia": "lunes",
    "bloque": 6,
    "docente": "fredy_garcia",
    "grado": "7º1",
    "aula": "A1",
    "jornada": "tarde"
  },
  {
    "dia": "martes",
    "bloque": 1,
    "docente": "fredy_garcia",
    "grado": "6º2",
    "aula": "A9",
    "jornada": "tarde"
  },
  {
    "dia": "martes",
    "bloque": 2,
    "docente": "fredy_garcia",
    "grado": "7º3",
    "aula": "A3",
    "jornada": "tarde"
  },
  {
    "dia": "martes",
    "bloque": 5,
    "docente": "fredy_garcia",
    "grado": "6º3",
    "aula": "A10",
    "jornada": "tarde"
  },
  {
    "dia": "martes",
    "bloque": 6,
    "docente": "fredy_garcia",
    "grado": "6º1",
    "aula": "A8",
    "jornada": "tarde"
  },
  {
    "dia": "miercoles",
    "bloque": 1,
    "docente": "fredy_garcia",
    "grado": "6º3",
    "aula": "A10",
    "jornada": "tarde"
  },
  {
    "dia": "miercoles",
    "bloque": 2,
    "docente": "fredy_garcia",
    "grado": "6º3",
    "aula": "A10",
    "jornada": "tarde"
  },
  {
    "dia": "miercoles",
    "bloque": 4,
    "docente": "fredy_garcia",
    "grado": "7º1",
    "aula": "A1",
    "jornada": "tarde"
  },
  {
    "dia": "jueves",
    "bloque": 1,
    "docente": "fredy_garcia",
    "grado": "8º1",
    "aula": "A7",
    "jornada": "tarde"
  },
  {
    "dia": "jueves",
    "bloque": 2,
    "docente": "fredy_garcia",
    "grado": "8º1",
    "aula": "A7",
    "jornada": "tarde"
  },
  {
    "dia": "jueves",
    "bloque": 3,
    "docente": "fredy_garcia",
    "grado": "6º1",
    "aula": "A8",
    "jornada": "tarde"
  },
  {
    "dia": "jueves",
    "bloque": 4,
    "docente": "fredy_garcia",
    "grado": "6º1",
    "aula": "A8",
    "jornada": "tarde"
  },
  {
    "dia": "jueves",
    "bloque": 5,
    "docente": "fredy_garcia",
    "grado": "7º3",
    "aula": "A3",
    "jornada": "tarde"
  },
  {
    "dia": "jueves",
    "bloque": 6,
    "docente": "fredy_garcia",
    "grado": "7º3",
    "aula": "A3",
    "jornada": "tarde"
  },
  {
    "dia": "viernes",
    "bloque": 1,
    "docente": "fredy_garcia",
    "grado": "7º2",
    "aula": "A2",
    "jornada": "tarde"
  },
  {
    "dia": "viernes",
    "bloque": 2,
    "docente": "fredy_garcia",
    "grado": "7º2",
    "aula": "A2",
    "jornada": "tarde"
  },
  {
    "dia": "viernes",
    "bloque": 3,
    "docente": "fredy_garcia",
    "grado": "6º2",
    "aula": "A9",
    "jornada": "tarde"
  },
  {
    "dia": "viernes",
    "bloque": 4,
    "docente": "fredy_garcia",
    "grado": "6º2",
    "aula": "A9",
    "jornada": "tarde"
  },
  {
    "dia": "martes",
    "bloque": 2,
    "docente": "marta",
    "grado": "8º4",
    "aula": "A4",
    "jornada": "tarde"
  },
  {
    "dia": "martes",
    "bloque": 3,
    "docente": "marta",
    "grado": "8º3",
    "aula": "A5",
    "jornada": "tarde"
  },
  {
    "dia": "martes",
    "bloque": 4,
    "docente": "marta",
    "grado": "8º2",
    "aula": "A6",
    "jornada": "tarde"
  },
  {
    "dia": "jueves",
    "bloque": 1,
    "docente": "marta",
    "grado": "8º2",
    "aula": "A6",
    "jornada": "tarde"
  },
  {
    "dia": "jueves",
    "bloque": 2,
    "docente": "marta",
    "grado": "8º2",
    "aula": "A6",
    "jornada": "tarde"
  },
  {
    "dia": "jueves",
    "bloque": 3,
    "docente": "marta",
    "grado": "8º3",
    "aula": "A5",
    "jornada": "tarde"
  },
  {
    "dia": "jueves",
    "bloque": 4,
    "docente": "marta",
    "grado": "8º3",
    "aula": "A5",
    "jornada": "tarde"
  },
  {
    "dia": "jueves",
    "bloque": 5,
    "docente": "marta",
    "grado": "8º4",
    "aula": "A4",
    "jornada": "tarde"
  },
  {
    "dia": "jueves",
    "bloque": 6,
    "docente": "marta",
    "grado": "8º4",
    "aula": "A4",
    "jornada": "tarde"
  },
  {
    "dia": "lunes",
    "bloque": 1,
    "docente": "luis_javier",
    "grado": "7º2",
    "aula": "A2",
    "jornada": "tarde"
  },
  {
    "dia": "lunes",
    "bloque": 2,
    "docente": "luis_javier",
    "grado": "6º2",
    "aula": "A9",
    "jornada": "tarde"
  },
  {
    "dia": "lunes",
    "bloque": 3,
    "docente": "luis_javier",
    "grado": "6º2",
    "aula": "A9",
    "jornada": "tarde"
  },
  {
    "dia": "martes",
    "bloque": 1,
    "docente": "luis_javier",
    "grado": "7º2",
    "aula": "A2",
    "jornada": "tarde"
  },
  {
    "dia": "martes",
    "bloque": 2,
    "docente": "luis_javier",
    "grado": "6º2",
    "aula": "A9",
    "jornada": "tarde"
  },
  {
    "dia": "martes",
    "bloque": 3,
    "docente": "luis_javier",
    "grado": "6º2",
    "aula": "A9",
    "jornada": "tarde"
  },
  {
    "dia": "martes",
    "bloque": 5,
    "docente": "luis_javier",
    "grado": "7º1",
    "aula": "A1",
    "jornada": "tarde"
  },
  {
    "dia": "martes",
    "bloque": 6,
    "docente": "luis_javier",
    "grado": "7º1",
    "aula": "A1",
    "jornada": "tarde"
  },
  {
    "dia": "miercoles",
    "bloque": 1,
    "docente": "luis_javier",
    "grado": "6º1",
    "aula": "A8",
    "jornada": "tarde"
  },
  {
    "dia": "miercoles",
    "bloque": 2,
    "docente": "luis_javier",
    "grado": "6º1",
    "aula": "A8",
    "jornada": "tarde"
  },
  {
    "dia": "miercoles",
    "bloque": 5,
    "docente": "luis_javier",
    "grado": "6º3",
    "aula": "A10",
    "jornada": "tarde"
  },
  {
    "dia": "miercoles",
    "bloque": 6,
    "docente": "luis_javier",
    "grado": "6º3",
    "aula": "A10",
    "jornada": "tarde"
  },
  {
    "dia": "jueves",
    "bloque": 1,
    "docente": "luis_javier",
    "grado": "6º3",
    "aula": "A10",
    "jornada": "tarde"
  },
  {
    "dia": "jueves",
    "bloque": 2,
    "docente": "luis_javier",
    "grado": "6º3",
    "aula": "A10",
    "jornada": "tarde"
  },
  {
    "dia": "jueves",
    "bloque": 3,
    "docente": "luis_javier",
    "grado": "7º1",
    "aula": "A1",
    "jornada": "tarde"
  },
  {
    "dia": "jueves",
    "bloque": 4,
    "docente": "luis_javier",
    "grado": "7º1",
    "aula": "A1",
    "jornada": "tarde"
  },
  {
    "dia": "jueves",
    "bloque": 5,
    "docente": "luis_javier",
    "grado": "7º2",
    "aula": "A2",
    "jornada": "tarde"
  },
  {
    "dia": "jueves",
    "bloque": 6,
    "docente": "luis_javier",
    "grado": "7º2",
    "aula": "A2",
    "jornada": "tarde"
  },
  {
    "dia": "viernes",
    "bloque": 1,
    "docente": "luis_javier",
    "grado": "6º1",
    "aula": "A8",
    "jornada": "tarde"
  },
  {
    "dia": "viernes",
    "bloque": 2,
    "docente": "luis_javier",
    "grado": "6º1",
    "aula": "A8",
    "jornada": "tarde"
  },
  {
    "dia": "viernes",
    "bloque": 3,
    "docente": "luis_javier",
    "grado": "7º2",
    "aula": "A2",
    "jornada": "tarde"
  },
  {
    "dia": "viernes",
    "bloque": 4,
    "docente": "luis_javier",
    "grado": "7º2",
    "aula": "A2",
    "jornada": "tarde"
  },
  {
    "dia": "lunes",
    "bloque": 5,
    "docente": "marina",
    "grado": "7º3",
    "aula": "A3",
    "jornada": "tarde"
  },
  {
    "dia": "lunes",
    "bloque": 6,
    "docente": "marina",
    "grado": "7º3",
    "aula": "A3",
    "jornada": "tarde"
  },
  {
    "dia": "martes",
    "bloque": 1,
    "docente": "marina",
    "grado": "7º3",
    "aula": "A3",
    "jornada": "tarde"
  },
  {
    "dia": "martes",
    "bloque": 2,
    "docente": "marina",
    "grado": "8º1",
    "aula": "A7",
    "jornada": "tarde"
  },
  {
    "dia": "martes",
    "bloque": 3,
    "docente": "marina",
    "grado": "8º1",
    "aula": "A7",
    "jornada": "tarde"
  },
  {
    "dia": "martes",
    "bloque": 5,
    "docente": "marina",
    "grado": "8º4",
    "aula": "A4",
    "jornada": "tarde"
  },
  {
    "dia": "martes",
    "bloque": 6,
    "docente": "marina",
    "grado": "8º4",
    "aula": "A4",
    "jornada": "tarde"
  },
  {
    "dia": "miercoles",
    "bloque": 1,
    "docente": "marina",
    "grado": "8º3",
    "aula": "A5",
    "jornada": "tarde"
  },
  {
    "dia": "miercoles",
    "bloque": 2,
    "docente": "marina",
    "grado": "8º3",
    "aula": "A5",
    "jornada": "tarde"
  },
  {
    "dia": "miercoles",
    "bloque": 3,
    "docente": "marina",
    "grado": "8º2",
    "aula": "A6",
    "jornada": "tarde"
  },
  {
    "dia": "miercoles",
    "bloque": 4,
    "docente": "marina",
    "grado": "8º2",
    "aula": "A6",
    "jornada": "tarde"
  },
  {
    "dia": "miercoles",
    "bloque": 5,
    "docente": "marina",
    "grado": "8º4",
    "aula": "A4",
    "jornada": "tarde"
  },
  {
    "dia": "miercoles",
    "bloque": 6,
    "docente": "marina",
    "grado": "8º4",
    "aula": "A4",
    "jornada": "tarde"
  },
  {
    "dia": "jueves",
    "bloque": 3,
    "docente": "marina",
    "grado": "8º2",
    "aula": "A6",
    "jornada": "tarde"
  },
  {
    "dia": "jueves",
    "bloque": 4,
    "docente": "marina",
    "grado": "8º2",
    "aula": "A6",
    "jornada": "tarde"
  },
  {
    "dia": "jueves",
    "bloque": 5,
    "docente": "marina",
    "grado": "8º3",
    "aula": "A5",
    "jornada": "tarde"
  },
  {
    "dia": "jueves",
    "bloque": 6,
    "docente": "marina",
    "grado": "8º3",
    "aula": "A5",
    "jornada": "tarde"
  },
  {
    "dia": "viernes",
    "bloque": 1,
    "docente": "marina",
    "grado": "8º1",
    "aula": "A7",
    "jornada": "tarde"
  },
  {
    "dia": "viernes",
    "bloque": 2,
    "docente": "marina",
    "grado": "8º1",
    "aula": "A7",
    "jornada": "tarde"
  },
  {
    "dia": "viernes",
    "bloque": 3,
    "docente": "marina",
    "grado": "7º3",
    "aula": "A3",
    "jornada": "tarde"
  },
  {
    "dia": "viernes",
    "bloque": 4,
    "docente": "marina",
    "grado": "7º3",
    "aula": "A3",
    "jornada": "tarde"
  },
  {
    "dia": "lunes",
    "bloque": 1,
    "docente": "luis_angel",
    "grado": "6º1",
    "aula": "A8",
    "jornada": "tarde"
  },
  {
    "dia": "lunes",
    "bloque": 2,
    "docente": "luis_angel",
    "grado": "6º1",
    "aula": "A8",
    "jornada": "tarde"
  },
  {
    "dia": "lunes",
    "bloque": 4,
    "docente": "luis_angel",
    "grado": "6º2",
    "aula": "A9",
    "jornada": "tarde"
  },
  {
    "dia": "martes",
    "bloque": 1,
    "docente": "luis_angel",
    "grado": "6º1",
    "aula": "A8",
    "jornada": "tarde"
  },
  {
    "dia": "martes",
    "bloque": 2,
    "docente": "luis_angel",
    "grado": "7º1",
    "aula": "A1",
    "jornada": "tarde"
  },
  {
    "dia": "martes",
    "bloque": 3,
    "docente": "luis_angel",
    "grado": "6º1",
    "aula": "A8",
    "jornada": "tarde"
  },
  {
    "dia": "martes",
    "bloque": 4,
    "docente": "luis_angel",
    "grado": "6º1",
    "aula": "A8",
    "jornada": "tarde"
  },
  {
    "dia": "martes",
    "bloque": 6,
    "docente": "luis_angel",
    "grado": "6º3",
    "aula": "A10",
    "jornada": "tarde"
  },
  {
    "dia": "miercoles",
    "bloque": 1,
    "docente": "luis_angel",
    "grado": "6º2",
    "aula": "A9",
    "jornada": "tarde"
  },
  {
    "dia": "miercoles",
    "bloque": 2,
    "docente": "luis_angel",
    "grado": "6º2",
    "aula": "A9",
    "jornada": "tarde"
  },
  {
    "dia": "miercoles",
    "bloque": 3,
    "docente": "luis_angel",
    "grado": "6º3",
    "aula": "A10",
    "jornada": "tarde"
  },
  {
    "dia": "miercoles",
    "bloque": 4,
    "docente": "luis_angel",
    "grado": "6º3",
    "aula": "A10",
    "jornada": "tarde"
  },
  {
    "dia": "jueves",
    "bloque": 1,
    "docente": "luis_angel",
    "grado": "7º1",
    "aula": "A1",
    "jornada": "tarde"
  },
  {
    "dia": "jueves",
    "bloque": 2,
    "docente": "luis_angel",
    "grado": "7º1",
    "aula": "A1",
    "jornada": "tarde"
  },
  {
    "dia": "jueves",
    "bloque": 3,
    "docente": "luis_angel",
    "grado": "6º3",
    "aula": "A10",
    "jornada": "tarde"
  },
  {
    "dia": "jueves",
    "bloque": 4,
    "docente": "luis_angel",
    "grado": "6º3",
    "aula": "A10",
    "jornada": "tarde"
  },
  {
    "dia": "jueves",
    "bloque": 5,
    "docente": "luis_angel",
    "grado": "6º2",
    "aula": "A9",
    "jornada": "tarde"
  },
  {
    "dia": "jueves",
    "bloque": 6,
    "docente": "luis_angel",
    "grado": "6º2",
    "aula": "A9",
    "jornada": "tarde"
  },
  {
    "dia": "viernes",
    "bloque": 1,
    "docente": "luis_angel",
    "grado": "7º1",
    "aula": "A1",
    "jornada": "tarde"
  },
  {
    "dia": "viernes",
    "bloque": 2,
    "docente": "luis_angel",
    "grado": "7º1",
    "aula": "A1",
    "jornada": "tarde"
  },
  {
    "dia": "viernes",
    "bloque": 5,
    "docente": "luis_angel",
    "grado": "6º1",
    "aula": "A8",
    "jornada": "tarde"
  },
  {
    "dia": "viernes",
    "bloque": 6,
    "docente": "luis_angel",
    "grado": "6º1",
    "aula": "A8",
    "jornada": "tarde"
  },
  {
    "dia": "lunes",
    "bloque": 1,
    "docente": "juan_pablo",
    "grado": "8º4",
    "aula": "A4",
    "jornada": "tarde"
  },
  {
    "dia": "lunes",
    "bloque": 2,
    "docente": "juan_pablo",
    "grado": "8º4",
    "aula": "A4",
    "jornada": "tarde"
  },
  {
    "dia": "lunes",
    "bloque": 3,
    "docente": "juan_pablo",
    "grado": "8º2",
    "aula": "A6",
    "jornada": "tarde"
  },
  {
    "dia": "lunes",
    "bloque": 4,
    "docente": "juan_pablo",
    "grado": "8º2",
    "aula": "A6",
    "jornada": "tarde"
  },
  {
    "dia": "lunes",
    "bloque": 5,
    "docente": "juan_pablo",
    "grado": "6º3",
    "aula": "A10",
    "jornada": "tarde"
  },
  {
    "dia": "lunes",
    "bloque": 6,
    "docente": "juan_pablo",
    "grado": "6º3",
    "aula": "A10",
    "jornada": "tarde"
  },
  {
    "dia": "martes",
    "bloque": 1,
    "docente": "juan_pablo",
    "grado": "8º4",
    "aula": "A4",
    "jornada": "tarde"
  },
  {
    "dia": "martes",
    "bloque": 4,
    "docente": "juan_pablo",
    "grado": "8º3",
    "aula": "A5",
    "jornada": "tarde"
  },
  {
    "dia": "martes",
    "bloque": 5,
    "docente": "juan_pablo",
    "grado": "8º3",
    "aula": "A5",
    "jornada": "tarde"
  },
  {
    "dia": "miercoles",
    "bloque": 1,
    "docente": "juan_pablo",
    "grado": "7º1",
    "aula": "A1",
    "jornada": "tarde"
  },
  {
    "dia": "miercoles",
    "bloque": 2,
    "docente": "juan_pablo",
    "grado": "7º1",
    "aula": "A1",
    "jornada": "tarde"
  },
  {
    "dia": "miercoles",
    "bloque": 5,
    "docente": "juan_pablo",
    "grado": "8º1",
    "aula": "A7",
    "jornada": "tarde"
  },
  {
    "dia": "miercoles",
    "bloque": 6,
    "docente": "juan_pablo",
    "grado": "8º1",
    "aula": "A7",
    "jornada": "tarde"
  },
  {
    "dia": "jueves",
    "bloque": 1,
    "docente": "juan_pablo",
    "grado": "7º2",
    "aula": "A2",
    "jornada": "tarde"
  },
  {
    "dia": "jueves",
    "bloque": 2,
    "docente": "juan_pablo",
    "grado": "7º2",
    "aula": "A2",
    "jornada": "tarde"
  },
  {
    "dia": "jueves",
    "bloque": 5,
    "docente": "juan_pablo",
    "grado": "6º1",
    "aula": "A8",
    "jornada": "tarde"
  },
  {
    "dia": "jueves",
    "bloque": 6,
    "docente": "juan_pablo",
    "grado": "6º1",
    "aula": "A8",
    "jornada": "tarde"
  },
  {
    "dia": "viernes",
    "bloque": 1,
    "docente": "juan_pablo",
    "grado": "7º3",
    "aula": "A3",
    "jornada": "tarde"
  },
  {
    "dia": "viernes",
    "bloque": 2,
    "docente": "juan_pablo",
    "grado": "7º3",
    "aula": "A3",
    "jornada": "tarde"
  },
  {
    "dia": "viernes",
    "bloque": 4,
    "docente": "juan_pablo",
    "grado": "8º4",
    "aula": "A4",
    "jornada": "tarde"
  },
  {
    "dia": "viernes",
    "bloque": 5,
    "docente": "juan_pablo",
    "grado": "6º2",
    "aula": "A9",
    "jornada": "tarde"
  },
  {
    "dia": "viernes",
    "bloque": 6,
    "docente": "juan_pablo",
    "grado": "6º2",
    "aula": "A9",
    "jornada": "tarde"
  },
  {
    "dia": "lunes",
    "bloque": 1,
    "docente": "hugo",
    "grado": "8º2",
    "aula": "A6",
    "jornada": "tarde"
  },
  {
    "dia": "lunes",
    "bloque": 2,
    "docente": "hugo",
    "grado": "8º2",
    "aula": "A6",
    "jornada": "tarde"
  },
  {
    "dia": "lunes",
    "bloque": 4,
    "docente": "hugo",
    "grado": "8º1",
    "aula": "A7",
    "jornada": "tarde"
  },
  {
    "dia": "lunes",
    "bloque": 5,
    "docente": "hugo",
    "grado": "8º3",
    "aula": "A5",
    "jornada": "tarde"
  },
  {
    "dia": "lunes",
    "bloque": 6,
    "docente": "hugo",
    "grado": "8º3",
    "aula": "A5",
    "jornada": "tarde"
  },
  {
    "dia": "martes",
    "bloque": 2,
    "docente": "hugo",
    "grado": "7º2",
    "aula": "A2",
    "jornada": "tarde"
  },
  {
    "dia": "martes",
    "bloque": 3,
    "docente": "hugo",
    "grado": "7º2",
    "aula": "A2",
    "jornada": "tarde"
  },
  {
    "dia": "martes",
    "bloque": 4,
    "docente": "hugo",
    "grado": "8º4",
    "aula": "A4",
    "jornada": "tarde"
  },
  {
    "dia": "martes",
    "bloque": 5,
    "docente": "hugo",
    "grado": "8º2",
    "aula": "A6",
    "jornada": "tarde"
  },
  {
    "dia": "martes",
    "bloque": 6,
    "docente": "hugo",
    "grado": "8º3",
    "aula": "A5",
    "jornada": "tarde"
  },
  {
    "dia": "miercoles",
    "bloque": 1,
    "docente": "hugo",
    "grado": "8º1",
    "aula": "A7",
    "jornada": "tarde"
  },
  {
    "dia": "miercoles",
    "bloque": 2,
    "docente": "hugo",
    "grado": "8º1",
    "aula": "A7",
    "jornada": "tarde"
  },
  {
    "dia": "miercoles",
    "bloque": 3,
    "docente": "hugo",
    "grado": "8º4",
    "aula": "A4",
    "jornada": "tarde"
  },
  {
    "dia": "miercoles",
    "bloque": 4,
    "docente": "hugo",
    "grado": "8º4",
    "aula": "A4",
    "jornada": "tarde"
  },
  {
    "dia": "jueves",
    "bloque": 3,
    "docente": "hugo",
    "grado": "8º4",
    "aula": "A4",
    "jornada": "tarde"
  },
  {
    "dia": "jueves",
    "bloque": 4,
    "docente": "hugo",
    "grado": "8º4",
    "aula": "A4",
    "jornada": "tarde"
  },
  {
    "dia": "jueves",
    "bloque": 5,
    "docente": "hugo",
    "grado": "8º1",
    "aula": "A7",
    "jornada": "tarde"
  },
  {
    "dia": "jueves",
    "bloque": 6,
    "docente": "hugo",
    "grado": "8º1",
    "aula": "A7",
    "jornada": "tarde"
  },
  {
    "dia": "viernes",
    "bloque": 1,
    "docente": "hugo",
    "grado": "8º3",
    "aula": "A5",
    "jornada": "tarde"
  },
  {
    "dia": "viernes",
    "bloque": 2,
    "docente": "hugo",
    "grado": "8º3",
    "aula": "A5",
    "jornada": "tarde"
  },
  {
    "dia": "viernes",
    "bloque": 5,
    "docente": "hugo",
    "grado": "8º2",
    "aula": "A6",
    "jornada": "tarde"
  },
  {
    "dia": "viernes",
    "bloque": 6,
    "docente": "hugo",
    "grado": "8º2",
    "aula": "A6",
    "jornada": "tarde"
  },
  {
    "dia": "lunes",
    "bloque": 3,
    "docente": "felipe",
    "grado": "7º1",
    "aula": "A1",
    "jornada": "tarde"
  },
  {
    "dia": "lunes",
    "bloque": 4,
    "docente": "felipe",
    "grado": "7º1",
    "aula": "A1",
    "jornada": "tarde"
  },
  {
    "dia": "martes",
    "bloque": 1,
    "docente": "felipe",
    "grado": "7º1",
    "aula": "A1",
    "jornada": "tarde"
  },
  {
    "dia": "martes",
    "bloque": 4,
    "docente": "felipe",
    "grado": "7º2",
    "aula": "A2",
    "jornada": "tarde"
  },
  {
    "dia": "martes",
    "bloque": 5,
    "docente": "felipe",
    "grado": "7º3",
    "aula": "A3",
    "jornada": "tarde"
  },
  {
    "dia": "martes",
    "bloque": 6,
    "docente": "felipe",
    "grado": "7º3",
    "aula": "A3",
    "jornada": "tarde"
  },
  {
    "dia": "miercoles",
    "bloque": 5,
    "docente": "felipe",
    "grado": "7º2",
    "aula": "A2",
    "jornada": "tarde"
  },
  {
    "dia": "miercoles",
    "bloque": 6,
    "docente": "felipe",
    "grado": "7º2",
    "aula": "A2",
    "jornada": "tarde"
  },
  {
    "dia": "martes",
    "bloque": 2,
    "docente": "valentina",
    "grado": "8º2",
    "aula": "A6",
    "jornada": "tarde"
  },
  {
    "dia": "martes",
    "bloque": 3,
    "docente": "valentina",
    "grado": "8º2",
    "aula": "A6",
    "jornada": "tarde"
  },
  {
    "dia": "viernes",
    "bloque": 1,
    "docente": "valentina",
    "grado": "8º4",
    "aula": "A4",
    "jornada": "tarde"
  },
  {
    "dia": "viernes",
    "bloque": 2,
    "docente": "valentina",
    "grado": "8º4",
    "aula": "A4",
    "jornada": "tarde"
  },
  {
    "dia": "viernes",
    "bloque": 3,
    "docente": "valentina",
    "grado": "8º1",
    "aula": "A7",
    "jornada": "tarde"
  },
  {
    "dia": "viernes",
    "bloque": 4,
    "docente": "valentina",
    "grado": "8º1",
    "aula": "A7",
    "jornada": "tarde"
  },
  {
    "dia": "viernes",
    "bloque": 5,
    "docente": "valentina",
    "grado": "8º3",
    "aula": "A5",
    "jornada": "tarde"
  },
  {
    "dia": "viernes",
    "bloque": 6,
    "docente": "valentina",
    "grado": "8º3",
    "aula": "A5",
    "jornada": "tarde"
  },
  {
    "dia": "lunes",
    "bloque": 2,
    "docente": "monica_c",
    "grado": "7º2",
    "aula": "A2",
    "jornada": "tarde"
  },
  {
    "dia": "lunes",
    "bloque": 3,
    "docente": "monica_c",
    "grado": "7º3",
    "aula": "A3",
    "jornada": "tarde"
  },
  {
    "dia": "lunes",
    "bloque": 4,
    "docente": "monica_c",
    "grado": "7º3",
    "aula": "A3",
    "jornada": "tarde"
  },
  {
    "dia": "lunes",
    "bloque": 5,
    "docente": "monica_c",
    "grado": "7º2",
    "aula": "A2",
    "jornada": "tarde"
  },
  {
    "dia": "lunes",
    "bloque": 6,
    "docente": "monica_c",
    "grado": "7º2",
    "aula": "A2",
    "jornada": "tarde"
  },
  {
    "dia": "miercoles",
    "bloque": 1,
    "docente": "monica_c",
    "grado": "7º2",
    "aula": "A2",
    "jornada": "tarde"
  },
  {
    "dia": "miercoles",
    "bloque": 2,
    "docente": "monica_c",
    "grado": "7º2",
    "aula": "A2",
    "jornada": "tarde"
  },
  {
    "dia": "miercoles",
    "bloque": 4,
    "docente": "monica_c",
    "grado": "7º3",
    "aula": "A3",
    "jornada": "tarde"
  },
  {
    "dia": "miercoles",
    "bloque": 5,
    "docente": "monica_c",
    "grado": "7º3",
    "aula": "A3",
    "jornada": "tarde"
  },
  {
    "dia": "miercoles",
    "bloque": 6,
    "docente": "monica_c",
    "grado": "7º3",
    "aula": "A3",
    "jornada": "tarde"
  },
  {
    "dia": "lunes",
    "bloque": 1,
    "docente": "yanet",
    "grado": "7º3",
    "aula": "A3",
    "jornada": "tarde"
  },
  {
    "dia": "lunes",
    "bloque": 2,
    "docente": "yanet",
    "grado": "7º3",
    "aula": "A3",
    "jornada": "tarde"
  },
  {
    "dia": "lunes",
    "bloque": 3,
    "docente": "yanet",
    "grado": "6º3",
    "aula": "A10",
    "jornada": "tarde"
  },
  {
    "dia": "lunes",
    "bloque": 4,
    "docente": "yanet",
    "grado": "6º3",
    "aula": "A10",
    "jornada": "tarde"
  },
  {
    "dia": "lunes",
    "bloque": 5,
    "docente": "yanet",
    "grado": "6º1",
    "aula": "A8",
    "jornada": "tarde"
  },
  {
    "dia": "lunes",
    "bloque": 6,
    "docente": "yanet",
    "grado": "6º1",
    "aula": "A8",
    "jornada": "tarde"
  },
  {
    "dia": "martes",
    "bloque": 2,
    "docente": "yanet",
    "grado": "6º3",
    "aula": "A10",
    "jornada": "tarde"
  },
  {
    "dia": "martes",
    "bloque": 5,
    "docente": "yanet",
    "grado": "6º1",
    "aula": "A8",
    "jornada": "tarde"
  },
  {
    "dia": "martes",
    "bloque": 6,
    "docente": "yanet",
    "grado": "6º2",
    "aula": "A9",
    "jornada": "tarde"
  },
  {
    "dia": "miercoles",
    "bloque": 3,
    "docente": "yanet",
    "grado": "7º1",
    "aula": "A1",
    "jornada": "tarde"
  },
  {
    "dia": "miercoles",
    "bloque": 5,
    "docente": "yanet",
    "grado": "6º2",
    "aula": "A9",
    "jornada": "tarde"
  },
  {
    "dia": "miercoles",
    "bloque": 6,
    "docente": "yanet",
    "grado": "6º2",
    "aula": "A9",
    "jornada": "tarde"
  },
  {
    "dia": "jueves",
    "bloque": 3,
    "docente": "yanet",
    "grado": "6º2",
    "aula": "A9",
    "jornada": "tarde"
  },
  {
    "dia": "jueves",
    "bloque": 4,
    "docente": "yanet",
    "grado": "6º2",
    "aula": "A9",
    "jornada": "tarde"
  },
  {
    "dia": "jueves",
    "bloque": 5,
    "docente": "yanet",
    "grado": "7º1",
    "aula": "A1",
    "jornada": "tarde"
  },
  {
    "dia": "jueves",
    "bloque": 6,
    "docente": "yanet",
    "grado": "7º1",
    "aula": "A1",
    "jornada": "tarde"
  },
  {
    "dia": "viernes",
    "bloque": 1,
    "docente": "yanet",
    "grado": "6º3",
    "aula": "A10",
    "jornada": "tarde"
  },
  {
    "dia": "viernes",
    "bloque": 2,
    "docente": "yanet",
    "grado": "6º3",
    "aula": "A10",
    "jornada": "tarde"
  },
  {
    "dia": "viernes",
    "bloque": 3,
    "docente": "yanet",
    "grado": "6º1",
    "aula": "A8",
    "jornada": "tarde"
  },
  {
    "dia": "viernes",
    "bloque": 4,
    "docente": "yanet",
    "grado": "6º1",
    "aula": "A8",
    "jornada": "tarde"
  },
  {
    "dia": "viernes",
    "bloque": 5,
    "docente": "yanet",
    "grado": "7º3",
    "aula": "A3",
    "jornada": "tarde"
  },
  {
    "dia": "viernes",
    "bloque": 6,
    "docente": "yanet",
    "grado": "7º3",
    "aula": "A3",
    "jornada": "tarde"
  },
  {
    "dia": "miercoles",
    "bloque": 1,
    "docente": "yoguis",
    "grado": "7º3",
    "aula": "A3",
    "jornada": "tarde"
  },
  {
    "dia": "miercoles",
    "bloque": 2,
    "docente": "yoguis",
    "grado": "7º3",
    "aula": "A3",
    "jornada": "tarde"
  },
  {
    "dia": "miercoles",
    "bloque": 3,
    "docente": "yoguis",
    "grado": "7º2",
    "aula": "A2",
    "jornada": "tarde"
  },
  {
    "dia": "miercoles",
    "bloque": 4,
    "docente": "yoguis",
    "grado": "7º2",
    "aula": "A2",
    "jornada": "tarde"
  },
  {
    "dia": "miercoles",
    "bloque": 5,
    "docente": "yoguis",
    "grado": "7º1",
    "aula": "A1",
    "jornada": "tarde"
  },
  {
    "dia": "miercoles",
    "bloque": 6,
    "docente": "yoguis",
    "grado": "7º1",
    "aula": "A1",
    "jornada": "tarde"
  },
  {
    "dia": "lunes",
    "bloque": 1,
    "docente": "harol",
    "grado": "7º1",
    "aula": "A1",
    "jornada": "tarde"
  },
  {
    "dia": "lunes",
    "bloque": 2,
    "docente": "harol",
    "grado": "7º1",
    "aula": "A1",
    "jornada": "tarde"
  },
  {
    "dia": "lunes",
    "bloque": 3,
    "docente": "harol",
    "grado": "7º2",
    "aula": "A2",
    "jornada": "tarde"
  },
  {
    "dia": "martes",
    "bloque": 1,
    "docente": "harol",
    "grado": "8º2",
    "aula": "A6",
    "jornada": "tarde"
  },
  {
    "dia": "martes",
    "bloque": 2,
    "docente": "harol",
    "grado": "6º1",
    "aula": "A8",
    "jornada": "tarde"
  },
  {
    "dia": "martes",
    "bloque": 3,
    "docente": "harol",
    "grado": "6º3",
    "aula": "A10",
    "jornada": "tarde"
  },
  {
    "dia": "martes",
    "bloque": 4,
    "docente": "harol",
    "grado": "6º3",
    "aula": "A10",
    "jornada": "tarde"
  },
  {
    "dia": "martes",
    "bloque": 6,
    "docente": "harol",
    "grado": "8º1",
    "aula": "A7",
    "jornada": "tarde"
  },
  {
    "dia": "miercoles",
    "bloque": 3,
    "docente": "harol",
    "grado": "7º3",
    "aula": "A3",
    "jornada": "tarde"
  },
  {
    "dia": "miercoles",
    "bloque": 4,
    "docente": "harol",
    "grado": "8º3",
    "aula": "A5",
    "jornada": "tarde"
  },
  {
    "dia": "miercoles",
    "bloque": 5,
    "docente": "harol",
    "grado": "6º1",
    "aula": "A8",
    "jornada": "tarde"
  },
  {
    "dia": "miercoles",
    "bloque": 6,
    "docente": "harol",
    "grado": "6º1",
    "aula": "A8",
    "jornada": "tarde"
  },
  {
    "dia": "jueves",
    "bloque": 1,
    "docente": "harol",
    "grado": "6º2",
    "aula": "A9",
    "jornada": "tarde"
  },
  {
    "dia": "jueves",
    "bloque": 2,
    "docente": "harol",
    "grado": "6º2",
    "aula": "A9",
    "jornada": "tarde"
  },
  {
    "dia": "jueves",
    "bloque": 5,
    "docente": "harol",
    "grado": "8º2",
    "aula": "A6",
    "jornada": "tarde"
  },
  {
    "dia": "jueves",
    "bloque": 6,
    "docente": "harol",
    "grado": "8º2",
    "aula": "A6",
    "jornada": "tarde"
  },
  {
    "dia": "viernes",
    "bloque": 1,
    "docente": "harol",
    "grado": "6º2",
    "aula": "A9",
    "jornada": "tarde"
  },
  {
    "dia": "viernes",
    "bloque": 2,
    "docente": "harol",
    "grado": "6º2",
    "aula": "A9",
    "jornada": "tarde"
  },
  {
    "dia": "viernes",
    "bloque": 3,
    "docente": "harol",
    "grado": "8º4",
    "aula": "A4",
    "jornada": "tarde"
  },
  {
    "dia": "viernes",
    "bloque": 5,
    "docente": "harol",
    "grado": "6º3",
    "aula": "A10",
    "jornada": "tarde"
  },
  {
    "dia": "viernes",
    "bloque": 6,
    "docente": "harol",
    "grado": "6º3",
    "aula": "A10",
    "jornada": "tarde"
  }
];
