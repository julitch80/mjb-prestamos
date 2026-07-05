// Asignación académica 2026 — bachillerato (sede central).
// Fuente: "asignacion Academica 2026 FINAL.xlsx" reconciliada con horarioBase.ts
// y con los reemplazos confirmados por Julián (jul 2026):
//   Liliana → Carlos · Gloria Isabel → Marta · Emerson → Harol
//   Alexander Pinzón → Luis Javier · Patricia Colorado → Fredy G. (Gutiérrez)
// Las horas por docente-grupo cuadran con el conteo de horarioBase (sin CI).
// Las horas de optativa/CI no se listan aquí: ya se muestran como ★CI en el horario.
// Primaria: pendiente de datos (se agregará cuando Julián envíe las imágenes).

import { DOCENTES_CI_MANANA, DOCENTES_CI_TARDE } from './maestros';

export interface Asignatura {
  id: string;
  nombre: string;
  abrev: string; // para celdas de horario
}

export const ASIGNATURAS: Asignatura[] = [
  { id: 'matematicas',    nombre: 'Matemáticas',              abrev: 'Mat' },
  { id: 'lengua',         nombre: 'Lengua Castellana',        abrev: 'Leng' },
  { id: 'ingles',         nombre: 'Inglés',                   abrev: 'Ing' },
  { id: 'naturales',      nombre: 'Ciencias Naturales',       abrev: 'C.Nat' },
  { id: 'biologia',       nombre: 'Biología',                 abrev: 'Bio' },
  { id: 'quimica',        nombre: 'Química',                  abrev: 'Quím' },
  { id: 'fisica',         nombre: 'Física',                   abrev: 'Fís' },
  { id: 'sociales',       nombre: 'Ciencias Sociales',        abrev: 'Soc' },
  { id: 'economia',       nombre: 'Economía y Política',      abrev: 'Econ' },
  { id: 'filosofia',      nombre: 'Filosofía',                abrev: 'Filo' },
  { id: 'ed_fisica',      nombre: 'Educación Física',         abrev: 'E.F.' },
  { id: 'artistica',      nombre: 'Educación Artística',      abrev: 'Art' },
  { id: 'religion',       nombre: 'Educación Religiosa',      abrev: 'Rel' },
  { id: 'etica',          nombre: 'Ética y Valores',          abrev: 'Ética' },
  { id: 'tecnologia',     nombre: 'Tecnología e Informática', abrev: 'Tec' },
  { id: 'mt_software',    nombre: 'Media Técnica · Desarrollo de Software', abrev: 'MT Soft' },
  { id: 'mt_audiovisual', nombre: 'Media Técnica · Audiovisuales',          abrev: 'MT Audio' },
  { id: 'ci',             nombre: 'Centro de Interés',                      abrev: '★CI' },
];

export interface EntradaAsignacion {
  docenteId: string;
  asignaturaId: string;
  grupo: string;   // notación del horario: '9.1' mañana, '6º1' tarde
  horas: number;   // horas semanales de clase con ese grupo
}

// Docentes de apoyo: sin asignación académica por grupos.
export const DOCENTES_APOYO: Record<string, string> = {
  yuri: 'Docente de apoyo PTA',
  alexander: 'Docente de apoyo',
};

const ENTRADAS_BASE: EntradaAsignacion[] = [
  // ── Jornada mañana ──────────────────────────────────────────────────────────
  // Uriel — Matemáticas
  { docenteId: 'uriel', asignaturaId: 'matematicas', grupo: '9.1', horas: 5 },
  { docenteId: 'uriel', asignaturaId: 'matematicas', grupo: '9.2', horas: 5 },
  { docenteId: 'uriel', asignaturaId: 'matematicas', grupo: '9.3', horas: 5 },
  { docenteId: 'uriel', asignaturaId: 'matematicas', grupo: '10.1', horas: 4 },
  { docenteId: 'uriel', asignaturaId: 'matematicas', grupo: '10.2', horas: 2 },
  // Claudia — Matemáticas
  { docenteId: 'claudia', asignaturaId: 'matematicas', grupo: '10.2', horas: 2 },
  { docenteId: 'claudia', asignaturaId: 'matematicas', grupo: '10.3', horas: 4 },
  { docenteId: 'claudia', asignaturaId: 'matematicas', grupo: '10.4', horas: 4 },
  { docenteId: 'claudia', asignaturaId: 'matematicas', grupo: '11.1', horas: 4 },
  { docenteId: 'claudia', asignaturaId: 'matematicas', grupo: '11.2', horas: 4 },
  { docenteId: 'claudia', asignaturaId: 'matematicas', grupo: '11.3', horas: 4 },
  // Carlos — Química + Biología (plaza heredada de Liliana)
  { docenteId: 'carlos', asignaturaId: 'quimica',  grupo: '10.1', horas: 2 },
  { docenteId: 'carlos', asignaturaId: 'quimica',  grupo: '10.2', horas: 2 },
  { docenteId: 'carlos', asignaturaId: 'quimica',  grupo: '10.3', horas: 2 },
  { docenteId: 'carlos', asignaturaId: 'quimica',  grupo: '10.4', horas: 2 },
  { docenteId: 'carlos', asignaturaId: 'quimica',  grupo: '11.1', horas: 2 },
  { docenteId: 'carlos', asignaturaId: 'quimica',  grupo: '11.2', horas: 2 },
  { docenteId: 'carlos', asignaturaId: 'quimica',  grupo: '11.3', horas: 2 },
  { docenteId: 'carlos', asignaturaId: 'biologia', grupo: '10.1', horas: 1 },
  { docenteId: 'carlos', asignaturaId: 'biologia', grupo: '10.2', horas: 1 },
  { docenteId: 'carlos', asignaturaId: 'biologia', grupo: '10.3', horas: 1 },
  { docenteId: 'carlos', asignaturaId: 'biologia', grupo: '10.4', horas: 1 },
  { docenteId: 'carlos', asignaturaId: 'biologia', grupo: '11.1', horas: 1 },
  { docenteId: 'carlos', asignaturaId: 'biologia', grupo: '11.2', horas: 1 },
  { docenteId: 'carlos', asignaturaId: 'biologia', grupo: '11.3', horas: 1 },
  // Julián — Física
  { docenteId: 'julian', asignaturaId: 'fisica', grupo: '10.1', horas: 3 },
  { docenteId: 'julian', asignaturaId: 'fisica', grupo: '10.2', horas: 3 },
  { docenteId: 'julian', asignaturaId: 'fisica', grupo: '10.3', horas: 3 },
  { docenteId: 'julian', asignaturaId: 'fisica', grupo: '10.4', horas: 3 },
  { docenteId: 'julian', asignaturaId: 'fisica', grupo: '11.1', horas: 3 },
  { docenteId: 'julian', asignaturaId: 'fisica', grupo: '11.2', horas: 3 },
  { docenteId: 'julian', asignaturaId: 'fisica', grupo: '11.3', horas: 3 },
  // Mónica Córdoba — C. Naturales (mañana) + Sociales (tarde)
  { docenteId: 'monica_c', asignaturaId: 'naturales', grupo: '9.1', horas: 4 },
  { docenteId: 'monica_c', asignaturaId: 'naturales', grupo: '9.2', horas: 4 },
  { docenteId: 'monica_c', asignaturaId: 'naturales', grupo: '9.3', horas: 4 },
  { docenteId: 'monica_c', asignaturaId: 'sociales',  grupo: '7º2', horas: 5 },
  { docenteId: 'monica_c', asignaturaId: 'sociales',  grupo: '7º3', horas: 5 },
  // Margarita — Lengua Castellana
  { docenteId: 'margara', asignaturaId: 'lengua', grupo: '10.3', horas: 4 },
  { docenteId: 'margara', asignaturaId: 'lengua', grupo: '10.4', horas: 4 },
  { docenteId: 'margara', asignaturaId: 'lengua', grupo: '11.1', horas: 4 },
  { docenteId: 'margara', asignaturaId: 'lengua', grupo: '11.2', horas: 4 },
  { docenteId: 'margara', asignaturaId: 'lengua', grupo: '11.3', horas: 4 },
  // Beatriz — Lengua Castellana
  { docenteId: 'beatriz', asignaturaId: 'lengua', grupo: '9.1', horas: 4 },
  { docenteId: 'beatriz', asignaturaId: 'lengua', grupo: '9.2', horas: 4 },
  { docenteId: 'beatriz', asignaturaId: 'lengua', grupo: '9.3', horas: 4 },
  { docenteId: 'beatriz', asignaturaId: 'lengua', grupo: '10.1', horas: 4 },
  { docenteId: 'beatriz', asignaturaId: 'lengua', grupo: '10.2', horas: 4 },
  // Marta — Inglés mixta (plaza heredada de Gloria Isabel)
  { docenteId: 'marta', asignaturaId: 'ingles', grupo: '9.1', horas: 3 },
  { docenteId: 'marta', asignaturaId: 'ingles', grupo: '9.2', horas: 3 },
  { docenteId: 'marta', asignaturaId: 'ingles', grupo: '9.3', horas: 3 },
  { docenteId: 'marta', asignaturaId: 'ingles', grupo: '10.1', horas: 4 },
  { docenteId: 'marta', asignaturaId: 'ingles', grupo: '8º2', horas: 3 },
  { docenteId: 'marta', asignaturaId: 'ingles', grupo: '8º3', horas: 3 },
  { docenteId: 'marta', asignaturaId: 'ingles', grupo: '8º4', horas: 3 },
  // Johana — Inglés
  { docenteId: 'johana', asignaturaId: 'ingles', grupo: '10.2', horas: 2 },
  { docenteId: 'johana', asignaturaId: 'ingles', grupo: '10.3', horas: 4 },
  { docenteId: 'johana', asignaturaId: 'ingles', grupo: '10.4', horas: 4 },
  { docenteId: 'johana', asignaturaId: 'ingles', grupo: '11.1', horas: 4 },
  { docenteId: 'johana', asignaturaId: 'ingles', grupo: '11.2', horas: 4 },
  { docenteId: 'johana', asignaturaId: 'ingles', grupo: '11.3', horas: 4 },
  // Gloria Álvarez — Ciencias Sociales
  { docenteId: 'gloria_a', asignaturaId: 'sociales', grupo: '9.1', horas: 5 },
  { docenteId: 'gloria_a', asignaturaId: 'sociales', grupo: '9.2', horas: 5 },
  { docenteId: 'gloria_a', asignaturaId: 'sociales', grupo: '9.3', horas: 5 },
  { docenteId: 'gloria_a', asignaturaId: 'sociales', grupo: '10.1', horas: 1 },
  { docenteId: 'gloria_a', asignaturaId: 'sociales', grupo: '10.2', horas: 1 },
  { docenteId: 'gloria_a', asignaturaId: 'sociales', grupo: '10.3', horas: 1 },
  { docenteId: 'gloria_a', asignaturaId: 'sociales', grupo: '10.4', horas: 1 },
  { docenteId: 'gloria_a', asignaturaId: 'sociales', grupo: '11.1', horas: 1 },
  { docenteId: 'gloria_a', asignaturaId: 'sociales', grupo: '11.2', horas: 1 },
  { docenteId: 'gloria_a', asignaturaId: 'sociales', grupo: '11.3', horas: 1 },
  // Ledis — Economía y Política + Filosofía
  { docenteId: 'ledis', asignaturaId: 'economia',  grupo: '10.1', horas: 1 },
  { docenteId: 'ledis', asignaturaId: 'economia',  grupo: '10.2', horas: 1 },
  { docenteId: 'ledis', asignaturaId: 'economia',  grupo: '10.3', horas: 1 },
  { docenteId: 'ledis', asignaturaId: 'economia',  grupo: '10.4', horas: 1 },
  { docenteId: 'ledis', asignaturaId: 'economia',  grupo: '11.1', horas: 1 },
  { docenteId: 'ledis', asignaturaId: 'economia',  grupo: '11.2', horas: 1 },
  { docenteId: 'ledis', asignaturaId: 'economia',  grupo: '11.3', horas: 1 },
  { docenteId: 'ledis', asignaturaId: 'filosofia', grupo: '10.1', horas: 2 },
  { docenteId: 'ledis', asignaturaId: 'filosofia', grupo: '10.2', horas: 2 },
  { docenteId: 'ledis', asignaturaId: 'filosofia', grupo: '10.3', horas: 2 },
  { docenteId: 'ledis', asignaturaId: 'filosofia', grupo: '10.4', horas: 2 },
  { docenteId: 'ledis', asignaturaId: 'filosofia', grupo: '11.1', horas: 2 },
  { docenteId: 'ledis', asignaturaId: 'filosofia', grupo: '11.2', horas: 2 },
  { docenteId: 'ledis', asignaturaId: 'filosofia', grupo: '11.3', horas: 2 },
  // Juan Carlos Blandón (Yoguis) — Tecnología (ambas jornadas) + Inglés 10°2
  { docenteId: 'yoguis', asignaturaId: 'tecnologia', grupo: '9.1', horas: 2 },
  { docenteId: 'yoguis', asignaturaId: 'tecnologia', grupo: '9.2', horas: 2 },
  { docenteId: 'yoguis', asignaturaId: 'tecnologia', grupo: '9.3', horas: 2 },
  { docenteId: 'yoguis', asignaturaId: 'tecnologia', grupo: '10.1', horas: 1 },
  { docenteId: 'yoguis', asignaturaId: 'tecnologia', grupo: '10.2', horas: 1 },
  { docenteId: 'yoguis', asignaturaId: 'tecnologia', grupo: '10.3', horas: 1 },
  { docenteId: 'yoguis', asignaturaId: 'tecnologia', grupo: '10.4', horas: 1 },
  { docenteId: 'yoguis', asignaturaId: 'tecnologia', grupo: '11.1', horas: 1 },
  { docenteId: 'yoguis', asignaturaId: 'tecnologia', grupo: '11.2', horas: 1 },
  { docenteId: 'yoguis', asignaturaId: 'tecnologia', grupo: '11.3', horas: 1 },
  { docenteId: 'yoguis', asignaturaId: 'ingles',     grupo: '10.2', horas: 2 },
  { docenteId: 'yoguis', asignaturaId: 'tecnologia', grupo: '7º1', horas: 2 },
  { docenteId: 'yoguis', asignaturaId: 'tecnologia', grupo: '7º2', horas: 2 },
  { docenteId: 'yoguis', asignaturaId: 'tecnologia', grupo: '7º3', horas: 2 },
  // Adolfo — Educación Física
  { docenteId: 'adolfo', asignaturaId: 'ed_fisica', grupo: '9.1', horas: 2 },
  { docenteId: 'adolfo', asignaturaId: 'ed_fisica', grupo: '9.2', horas: 2 },
  { docenteId: 'adolfo', asignaturaId: 'ed_fisica', grupo: '9.3', horas: 2 },
  { docenteId: 'adolfo', asignaturaId: 'ed_fisica', grupo: '10.1', horas: 2 },
  { docenteId: 'adolfo', asignaturaId: 'ed_fisica', grupo: '10.2', horas: 2 },
  { docenteId: 'adolfo', asignaturaId: 'ed_fisica', grupo: '10.3', horas: 2 },
  { docenteId: 'adolfo', asignaturaId: 'ed_fisica', grupo: '10.4', horas: 2 },
  { docenteId: 'adolfo', asignaturaId: 'ed_fisica', grupo: '11.1', horas: 2 },
  { docenteId: 'adolfo', asignaturaId: 'ed_fisica', grupo: '11.2', horas: 2 },
  { docenteId: 'adolfo', asignaturaId: 'ed_fisica', grupo: '11.3', horas: 2 },
  // Doris — Educación Artística
  { docenteId: 'doris', asignaturaId: 'artistica', grupo: '9.1', horas: 2 },
  { docenteId: 'doris', asignaturaId: 'artistica', grupo: '9.2', horas: 2 },
  { docenteId: 'doris', asignaturaId: 'artistica', grupo: '9.3', horas: 2 },
  { docenteId: 'doris', asignaturaId: 'artistica', grupo: '10.1', horas: 2 },
  { docenteId: 'doris', asignaturaId: 'artistica', grupo: '10.2', horas: 2 },
  { docenteId: 'doris', asignaturaId: 'artistica', grupo: '10.3', horas: 2 },
  { docenteId: 'doris', asignaturaId: 'artistica', grupo: '10.4', horas: 2 },
  { docenteId: 'doris', asignaturaId: 'artistica', grupo: '11.1', horas: 2 },
  { docenteId: 'doris', asignaturaId: 'artistica', grupo: '11.2', horas: 2 },
  { docenteId: 'doris', asignaturaId: 'artistica', grupo: '11.3', horas: 2 },
  // Jorge Iván — Religión + Ética
  { docenteId: 'jorge', asignaturaId: 'religion', grupo: '9.1', horas: 1 },
  { docenteId: 'jorge', asignaturaId: 'religion', grupo: '9.2', horas: 1 },
  { docenteId: 'jorge', asignaturaId: 'religion', grupo: '9.3', horas: 1 },
  { docenteId: 'jorge', asignaturaId: 'religion', grupo: '10.1', horas: 1 },
  { docenteId: 'jorge', asignaturaId: 'religion', grupo: '10.2', horas: 1 },
  { docenteId: 'jorge', asignaturaId: 'religion', grupo: '10.3', horas: 1 },
  { docenteId: 'jorge', asignaturaId: 'religion', grupo: '10.4', horas: 1 },
  { docenteId: 'jorge', asignaturaId: 'religion', grupo: '11.1', horas: 1 },
  { docenteId: 'jorge', asignaturaId: 'religion', grupo: '11.2', horas: 1 },
  { docenteId: 'jorge', asignaturaId: 'religion', grupo: '11.3', horas: 1 },
  { docenteId: 'jorge', asignaturaId: 'etica', grupo: '9.1', horas: 1 },
  { docenteId: 'jorge', asignaturaId: 'etica', grupo: '9.2', horas: 1 },
  { docenteId: 'jorge', asignaturaId: 'etica', grupo: '9.3', horas: 1 },
  { docenteId: 'jorge', asignaturaId: 'etica', grupo: '10.1', horas: 1 },
  { docenteId: 'jorge', asignaturaId: 'etica', grupo: '10.2', horas: 1 },
  { docenteId: 'jorge', asignaturaId: 'etica', grupo: '10.3', horas: 1 },
  { docenteId: 'jorge', asignaturaId: 'etica', grupo: '10.4', horas: 1 },
  { docenteId: 'jorge', asignaturaId: 'etica', grupo: '11.1', horas: 1 },
  { docenteId: 'jorge', asignaturaId: 'etica', grupo: '11.2', horas: 1 },
  { docenteId: 'jorge', asignaturaId: 'etica', grupo: '11.3', horas: 1 },

  // ── Jornada tarde ───────────────────────────────────────────────────────────
  // Luz Marina — Lengua Castellana
  { docenteId: 'marina', asignaturaId: 'lengua', grupo: '7º3', horas: 5 },
  { docenteId: 'marina', asignaturaId: 'lengua', grupo: '8º1', horas: 4 },
  { docenteId: 'marina', asignaturaId: 'lengua', grupo: '8º2', horas: 4 },
  { docenteId: 'marina', asignaturaId: 'lengua', grupo: '8º3', horas: 4 },
  { docenteId: 'marina', asignaturaId: 'lengua', grupo: '8º4', horas: 4 },
  // Carolina — Lengua Castellana
  { docenteId: 'carolina', asignaturaId: 'lengua', grupo: '6º1', horas: 4 },
  { docenteId: 'carolina', asignaturaId: 'lengua', grupo: '6º2', horas: 4 },
  { docenteId: 'carolina', asignaturaId: 'lengua', grupo: '6º3', horas: 5 },
  { docenteId: 'carolina', asignaturaId: 'lengua', grupo: '7º1', horas: 4 },
  { docenteId: 'carolina', asignaturaId: 'lengua', grupo: '7º2', horas: 4 },
  // Jhon Fredy García — Inglés
  { docenteId: 'fredy_garcia', asignaturaId: 'ingles', grupo: '6º1', horas: 3 },
  { docenteId: 'fredy_garcia', asignaturaId: 'ingles', grupo: '6º2', horas: 4 },
  { docenteId: 'fredy_garcia', asignaturaId: 'ingles', grupo: '6º3', horas: 3 },
  { docenteId: 'fredy_garcia', asignaturaId: 'ingles', grupo: '7º1', horas: 3 },
  { docenteId: 'fredy_garcia', asignaturaId: 'ingles', grupo: '7º2', horas: 3 },
  { docenteId: 'fredy_garcia', asignaturaId: 'ingles', grupo: '7º3', horas: 3 },
  { docenteId: 'fredy_garcia', asignaturaId: 'ingles', grupo: '8º1', horas: 3 },
  // Mónica Rave — Ciencias Naturales
  { docenteId: 'monica_rave', asignaturaId: 'naturales', grupo: '7º3', horas: 4 },
  { docenteId: 'monica_rave', asignaturaId: 'naturales', grupo: '8º1', horas: 4 },
  { docenteId: 'monica_rave', asignaturaId: 'naturales', grupo: '8º2', horas: 4 },
  { docenteId: 'monica_rave', asignaturaId: 'naturales', grupo: '8º3', horas: 5 },
  { docenteId: 'monica_rave', asignaturaId: 'etica',     grupo: '8º3', horas: 1 },
  { docenteId: 'monica_rave', asignaturaId: 'naturales', grupo: '8º4', horas: 4 },
  // Luis Javier — Ciencias Naturales (plaza heredada de Alexander Pinzón)
  { docenteId: 'luis_javier', asignaturaId: 'naturales', grupo: '6º1', horas: 4 },
  { docenteId: 'luis_javier', asignaturaId: 'naturales', grupo: '6º2', horas: 4 },
  { docenteId: 'luis_javier', asignaturaId: 'naturales', grupo: '6º3', horas: 4 },
  { docenteId: 'luis_javier', asignaturaId: 'naturales', grupo: '7º1', horas: 4 },
  { docenteId: 'luis_javier', asignaturaId: 'naturales', grupo: '7º2', horas: 5 },
  { docenteId: 'luis_javier', asignaturaId: 'etica',     grupo: '7º2', horas: 1 },
  // Fredy Gutiérrez — Ciencias Sociales (plaza heredada de Patricia Colorado)
  { docenteId: 'fredy_g', asignaturaId: 'sociales', grupo: '8º1', horas: 5 },
  { docenteId: 'fredy_g', asignaturaId: 'etica',    grupo: '8º1', horas: 1 },
  { docenteId: 'fredy_g', asignaturaId: 'sociales', grupo: '8º2', horas: 5 },
  { docenteId: 'fredy_g', asignaturaId: 'sociales', grupo: '8º3', horas: 5 },
  { docenteId: 'fredy_g', asignaturaId: 'sociales', grupo: '8º4', horas: 5 },
  // Luis Ángel — Ciencias Sociales (plaza "Martha Inés" del archivo)
  { docenteId: 'luis_angel', asignaturaId: 'sociales', grupo: '6º1', horas: 6 },
  { docenteId: 'luis_angel', asignaturaId: 'etica',    grupo: '6º1', horas: 1 },
  { docenteId: 'luis_angel', asignaturaId: 'sociales', grupo: '6º2', horas: 5 },
  { docenteId: 'luis_angel', asignaturaId: 'sociales', grupo: '6º3', horas: 5 },
  { docenteId: 'luis_angel', asignaturaId: 'sociales', grupo: '7º1', horas: 5 },
  // Yanet Moscote — Matemáticas
  { docenteId: 'yanet', asignaturaId: 'matematicas', grupo: '6º1', horas: 5 },
  { docenteId: 'yanet', asignaturaId: 'matematicas', grupo: '6º2', horas: 5 },
  { docenteId: 'yanet', asignaturaId: 'matematicas', grupo: '6º3', horas: 5 },
  { docenteId: 'yanet', asignaturaId: 'matematicas', grupo: '7º1', horas: 3 },
  { docenteId: 'yanet', asignaturaId: 'matematicas', grupo: '7º3', horas: 4 },
  // Hugo — Matemáticas
  { docenteId: 'hugo', asignaturaId: 'matematicas', grupo: '7º2', horas: 2 },
  { docenteId: 'hugo', asignaturaId: 'matematicas', grupo: '8º1', horas: 5 },
  { docenteId: 'hugo', asignaturaId: 'matematicas', grupo: '8º2', horas: 5 },
  { docenteId: 'hugo', asignaturaId: 'matematicas', grupo: '8º3', horas: 5 },
  { docenteId: 'hugo', asignaturaId: 'matematicas', grupo: '8º4', horas: 5 },
  // Felipe — Matemáticas 7° + Media Técnica Software (contrajornada)
  { docenteId: 'felipe', asignaturaId: 'matematicas', grupo: '7º1', horas: 3 },
  { docenteId: 'felipe', asignaturaId: 'matematicas', grupo: '7º2', horas: 3 },
  { docenteId: 'felipe', asignaturaId: 'matematicas', grupo: '7º3', horas: 2 },
  { docenteId: 'felipe', asignaturaId: 'mt_software', grupo: '10.1', horas: 7 },
  { docenteId: 'felipe', asignaturaId: 'mt_software', grupo: '11.1', horas: 7 },
  // Valentina — Tecnología 8° + Media Técnica Audiovisuales (contrajornada)
  { docenteId: 'valentina', asignaturaId: 'tecnologia', grupo: '8º1', horas: 2 },
  { docenteId: 'valentina', asignaturaId: 'tecnologia', grupo: '8º2', horas: 2 },
  { docenteId: 'valentina', asignaturaId: 'tecnologia', grupo: '8º3', horas: 2 },
  { docenteId: 'valentina', asignaturaId: 'tecnologia', grupo: '8º4', horas: 2 },
  { docenteId: 'valentina', asignaturaId: 'mt_audiovisual', grupo: '10.2', horas: 7 },
  { docenteId: 'valentina', asignaturaId: 'mt_audiovisual', grupo: '11.2', horas: 7 },
  // Juan Pablo — Educación Física
  { docenteId: 'juan_pablo', asignaturaId: 'ed_fisica', grupo: '6º1', horas: 2 },
  { docenteId: 'juan_pablo', asignaturaId: 'ed_fisica', grupo: '6º2', horas: 2 },
  { docenteId: 'juan_pablo', asignaturaId: 'ed_fisica', grupo: '6º3', horas: 2 },
  { docenteId: 'juan_pablo', asignaturaId: 'ed_fisica', grupo: '7º1', horas: 2 },
  { docenteId: 'juan_pablo', asignaturaId: 'ed_fisica', grupo: '7º2', horas: 2 },
  { docenteId: 'juan_pablo', asignaturaId: 'ed_fisica', grupo: '7º3', horas: 2 },
  { docenteId: 'juan_pablo', asignaturaId: 'ed_fisica', grupo: '8º1', horas: 2 },
  { docenteId: 'juan_pablo', asignaturaId: 'ed_fisica', grupo: '8º2', horas: 2 },
  { docenteId: 'juan_pablo', asignaturaId: 'ed_fisica', grupo: '8º3', horas: 2 },
  { docenteId: 'juan_pablo', asignaturaId: 'ed_fisica', grupo: '8º4', horas: 4 },
  // Edgar — Educación Artística (tarde)
  { docenteId: 'edgar', asignaturaId: 'artistica', grupo: '6º1', horas: 2 },
  { docenteId: 'edgar', asignaturaId: 'artistica', grupo: '6º2', horas: 2 },
  { docenteId: 'edgar', asignaturaId: 'artistica', grupo: '6º3', horas: 2 },
  { docenteId: 'edgar', asignaturaId: 'artistica', grupo: '7º1', horas: 2 },
  { docenteId: 'edgar', asignaturaId: 'artistica', grupo: '7º2', horas: 2 },
  { docenteId: 'edgar', asignaturaId: 'artistica', grupo: '7º3', horas: 2 },
  { docenteId: 'edgar', asignaturaId: 'artistica', grupo: '8º1', horas: 3 },
  { docenteId: 'edgar', asignaturaId: 'artistica', grupo: '8º2', horas: 2 },
  { docenteId: 'edgar', asignaturaId: 'artistica', grupo: '8º3', horas: 2 },
  { docenteId: 'edgar', asignaturaId: 'artistica', grupo: '8º4', horas: 2 },
  // Harol — Religión + Tecnología 6° + Ética (plaza heredada de Emerson Pinzón)
  { docenteId: 'harol', asignaturaId: 'religion',   grupo: '6º1', horas: 1 },
  { docenteId: 'harol', asignaturaId: 'tecnologia', grupo: '6º1', horas: 2 },
  { docenteId: 'harol', asignaturaId: 'religion',   grupo: '6º2', horas: 1 },
  { docenteId: 'harol', asignaturaId: 'tecnologia', grupo: '6º2', horas: 2 },
  { docenteId: 'harol', asignaturaId: 'etica',      grupo: '6º2', horas: 1 },
  { docenteId: 'harol', asignaturaId: 'religion',   grupo: '6º3', horas: 1 },
  { docenteId: 'harol', asignaturaId: 'tecnologia', grupo: '6º3', horas: 2 },
  { docenteId: 'harol', asignaturaId: 'etica',      grupo: '6º3', horas: 1 },
  { docenteId: 'harol', asignaturaId: 'religion',   grupo: '7º1', horas: 1 },
  { docenteId: 'harol', asignaturaId: 'etica',      grupo: '7º1', horas: 1 },
  { docenteId: 'harol', asignaturaId: 'religion',   grupo: '7º2', horas: 1 },
  { docenteId: 'harol', asignaturaId: 'religion',   grupo: '7º3', horas: 1 },
  { docenteId: 'harol', asignaturaId: 'religion',   grupo: '8º1', horas: 1 },
  { docenteId: 'harol', asignaturaId: 'religion',   grupo: '8º2', horas: 1 },
  { docenteId: 'harol', asignaturaId: 'etica',      grupo: '8º2', horas: 2 },
  { docenteId: 'harol', asignaturaId: 'religion',   grupo: '8º3', horas: 1 },
  { docenteId: 'harol', asignaturaId: 'religion',   grupo: '8º4', horas: 1 },
];

// Centro de Interés (martes 6.ª mañana / martes 1.ª tarde): una hora para cada
// docente que efectivamente lo supervisa. Se deriva de las listas de maestros.ts
// para que nunca queden desincronizadas.
const ENTRADAS_CI: EntradaAsignacion[] = [
  ...[...DOCENTES_CI_MANANA].map(d => ({
    docenteId: d, asignaturaId: 'ci', grupo: 'CI mañana', horas: 1,
  })),
  ...[...DOCENTES_CI_TARDE].map(d => ({
    docenteId: d, asignaturaId: 'ci', grupo: 'CI tarde', horas: 1,
  })),
];

export const ASIGNACION_2026: EntradaAsignacion[] = [...ENTRADAS_BASE, ...ENTRADAS_CI];

// ── Helpers ───────────────────────────────────────────────────────────────────

const mapaAsignaturas = new Map(ASIGNATURAS.map(a => [a.id, a]));

export function getAsignatura(id: string): Asignatura | undefined {
  return mapaAsignaturas.get(id);
}

/** Asignaturas que un docente dicta a un grupo (para celdas de horario). */
export function asignaturasDeCelda(docenteId: string, grupo: string): Asignatura[] {
  return ASIGNACION_2026
    .filter(e => e.docenteId === docenteId && e.grupo === grupo)
    .map(e => mapaAsignaturas.get(e.asignaturaId)!)
    .filter(Boolean);
}

/** Etiqueta corta de asignatura(s) para una celda: 'Mat', 'Quím/Bio', etc. */
export function abrevDeCelda(docenteId: string, grupo: string): string {
  const asigs = asignaturasDeCelda(docenteId, grupo);
  return [...new Set(asigs.map(a => a.abrev))].join('/');
}

export interface ResumenAsignatura {
  asignatura: Asignatura;
  grupos: { grupo: string; horas: number }[];
  totalHoras: number;
}

/** Asignación completa de un docente, agrupada por asignatura. */
export function asignacionDeDocente(docenteId: string): ResumenAsignatura[] {
  const porAsig = new Map<string, { grupo: string; horas: number }[]>();
  for (const e of ASIGNACION_2026) {
    if (e.docenteId !== docenteId) continue;
    if (!porAsig.has(e.asignaturaId)) porAsig.set(e.asignaturaId, []);
    porAsig.get(e.asignaturaId)!.push({ grupo: e.grupo, horas: e.horas });
  }
  return [...porAsig.entries()]
    .map(([id, grupos]) => ({
      asignatura: mapaAsignaturas.get(id)!,
      grupos,
      totalHoras: grupos.reduce((s, g) => s + g.horas, 0),
    }))
    .sort((a, b) => b.totalHoras - a.totalHoras);
}

/** Total de horas semanales de un docente (incluye media técnica). */
export function horasDeDocente(docenteId: string): number {
  return ASIGNACION_2026
    .filter(e => e.docenteId === docenteId)
    .reduce((s, e) => s + e.horas, 0);
}

/** Docentes y asignaturas de un grupo (plan de estudios del grupo). */
export function asignacionDeGrupo(grupo: string): EntradaAsignacion[] {
  return ASIGNACION_2026.filter(e => e.grupo === grupo);
}

/** Todos los docentes con asignación (para la vista de plantel). */
export function docentesConAsignacion(): string[] {
  return [...new Set(ASIGNACION_2026.map(e => e.docenteId))];
}
