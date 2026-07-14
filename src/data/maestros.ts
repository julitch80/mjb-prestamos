import { horarioBase } from './horarioBase';

// ── Tipos ─────────────────────────────────────────────────────────────────────

export type Rol       = 'rectora' | 'coordinador' | 'docente';
export type Jornada   = 'manana' | 'tarde' | 'ambas';
export type RecursoTipo = 'aula' | 'otro_espacio' | 'equipo';

export interface Usuario {
  id: string;
  nombre: string;
  nombreCorto: string;
  rol: Rol;
  jornada: Jornada;
  correo: string;
  pin: string;
  color: string;
}

export interface Recurso {
  id: string;
  nombre: string;
  tipo: RecursoTipo;
  jornada: Jornada;
  nombreHorario?: string; // nombre en horarioBase para detectar clases regulares
}

export interface BloqueHorario {
  id: number;
  inicio: string;
  fin: string;
  jornada: Jornada;
}

export interface Acompanamiento {
  docente: string;
  dia: string;
  descansos: 1 | 2 | 'ambos';
  lugar: string;
  jornada: 'manana' | 'tarde';
}

// ── Usuarios ──────────────────────────────────────────────────────────────────

export const USUARIOS: Usuario[] = [
  // Directivos
  { id: 'rectora',      nombre: 'Nancy Adriana Herrera López',    nombreCorto: 'Nancy',      rol: 'rectora',     jornada: 'ambas',  correo: 'mjb@iemanueljbetancur.edu.co',            pin: '11111', color: '#e8c84a' },
  { id: 'coord_manana', nombre: 'Janneth Astrid Ocampo Carvajal', nombreCorto: 'Janneth',    rol: 'coordinador', jornada: 'manana', correo: 'janneth.ocampo@iemanueljbetancur.edu.co', pin: '11111', color: '#f08080' },
  { id: 'coord_tarde',  nombre: 'Juan Diego Salazar Rendón',      nombreCorto: 'Juan Diego', rol: 'coordinador', jornada: 'tarde',  correo: 'juan.salazar@iemanueljbetancur.edu.co',   pin: '11111', color: '#f08080' },

  // Docentes mañana — paleta arcoíris de 15 colores equidistantes (~24° entre sí)
  { id: 'johana',    nombre: 'Leidy Johana Cano Ruiz',          nombreCorto: 'Johana',     rol: 'docente', jornada: 'manana', correo: 'johana.cano@iemanueljbetancur.edu.co',     pin: '', color: '#ef4444' }, // red-500
  { id: 'beatriz',   nombre: 'Beatriz Elena Montoya Valdés',    nombreCorto: 'Beatriz',    rol: 'docente', jornada: 'manana', correo: 'beatriz.montoya@iemanueljbetancur.edu.co', pin: '', color: '#f97316' }, // orange-500
  { id: 'adolfo',    nombre: 'Adolfo León Arango Arroyave',     nombreCorto: 'Adolfo',     rol: 'docente', jornada: 'manana', correo: 'adolfo.arango@iemanueljbetancur.edu.co',   pin: '', color: '#eab308' }, // yellow-500
  { id: 'gloria_a',  nombre: 'Gloria Estella Álvarez López',    nombreCorto: 'Gloria A.',  rol: 'docente', jornada: 'manana', correo: 'gloria.alvarez@iemanueljbetancur.edu.co',  pin: '', color: '#84cc16' }, // lime-500
  { id: 'doris',     nombre: 'Doris Castrillón Álvarez',        nombreCorto: 'Doris',      rol: 'docente', jornada: 'manana', correo: 'doris.castrillon@iemanueljbetancur.edu.co', pin: '', color: '#22c55e' }, // green-500
  { id: 'marta',     nombre: 'Marta Úsuga',                     nombreCorto: 'Marta',      rol: 'docente', jornada: 'ambas',  correo: 'martha.usuga@iemanueljbetancur.edu.co',    pin: '', color: '#10b981' }, // emerald-500
  { id: 'julian',    nombre: 'Julián David Medina Tamayo',      nombreCorto: 'Julián',     rol: 'docente', jornada: 'manana', correo: 'julian.medina@iemanueljbetancur.edu.co',   pin: '', color: '#14b8a6' }, // teal-500
  { id: 'carlos',    nombre: 'Carlos Cárdenas',                 nombreCorto: 'Carlos',     rol: 'docente', jornada: 'manana', correo: 'carlos.cardenas@iemanueljbetancur.edu.co', pin: '', color: '#0ea5e9' }, // sky-500
  { id: 'yoguis',    nombre: 'Juan Carlos Blandón Vargas',      nombreCorto: 'Yoguis',     rol: 'docente', jornada: 'ambas',  correo: 'juancarlosbv@iemanueljbetancur.edu.co',    pin: '', color: '#3b82f6' }, // blue-500
  { id: 'jorge',     nombre: 'Jorge Iván Acevedo Tabares',      nombreCorto: 'Jorge',      rol: 'docente', jornada: 'manana', correo: 'jorge.acevedo@iemanueljbetancur.edu.co',   pin: '', color: '#6366f1' }, // indigo-500
  { id: 'ledis',     nombre: 'Ledis Laura Quintana Seguanes',   nombreCorto: 'Ledis',      rol: 'docente', jornada: 'manana', correo: 'ledis.quintana@iemanueljbetancur.edu.co',  pin: '', color: '#8b5cf6' }, // violet-500
  { id: 'uriel',     nombre: 'José Uriel López Arias',          nombreCorto: 'Uriel',      rol: 'docente', jornada: 'manana', correo: 'uriel.lopez@iemanueljbetancur.edu.co',     pin: '', color: '#a855f7' }, // purple-500
  { id: 'claudia',   nombre: 'Claudia Patricia Henao Bermúdez', nombreCorto: 'Claudia',    rol: 'docente', jornada: 'manana', correo: 'claudia.henao@iemanueljbetancur.edu.co',   pin: '', color: '#d946ef' }, // fuchsia-500
  { id: 'margara',   nombre: 'Margarita María Montoya Olaya',   nombreCorto: 'Margarita',  rol: 'docente', jornada: 'manana', correo: 'margarita.montoya@iemanueljbetancur.edu.co', pin: '', color: '#ec4899' }, // pink-500
  { id: 'monica_c',  nombre: 'Mónica Tatiana Córdoba Zapata',   nombreCorto: 'Mónica C.',  rol: 'docente', jornada: 'ambas',  correo: 'monica.cordoba@iemanueljbetancur.edu.co',  pin: '', color: '#f43f5e' }, // rose-500

  // Docentes tarde — paleta independiente
  { id: 'edgar',       nombre: 'Edgar Alexis Pérez Jaramillo',     nombreCorto: 'Edgar',       rol: 'docente', jornada: 'ambas', correo: 'edgar.perez@iemanueljbetancur.edu.co',    pin: '', color: '#94a3b8' }, // slate
  { id: 'carolina',    nombre: 'Carolina Medina',                   nombreCorto: 'Carolina',    rol: 'docente', jornada: 'tarde', correo: 'carolina.medina@iemanueljbetancur.edu.co', pin: '', color: '#f97316' }, // orange-dark
  { id: 'monica_rave', nombre: 'Mónica Alexandra Rave Velásquez',   nombreCorto: 'Mónica R.',   rol: 'docente', jornada: 'tarde', correo: 'monica.rave@iemanueljbetancur.edu.co',    pin: '', color: '#f472b6' }, // pink
  { id: 'fredy_g',     nombre: 'Fredy Gutiérrez',                   nombreCorto: 'Fredy G.',    rol: 'docente', jornada: 'tarde', correo: 'fredy.gutierrez@iemanueljbetancur.edu.co', pin: '', color: '#4ade80' }, // green
  { id: 'fredy_garcia',nombre: 'John Fredy García Arrubla',         nombreCorto: 'Fredy García',rol: 'docente', jornada: 'tarde', correo: 'john.garcia@iemanueljbetancur.edu.co',    pin: '', color: '#bef264' }, // lime-light
  { id: 'luis_javier', nombre: 'Luis Javier Rojas',                 nombreCorto: 'Luis Javier', rol: 'docente', jornada: 'tarde', correo: 'luisjavierrojas@gmail.com',               pin: '', color: '#2dd4bf' }, // teal
  { id: 'marina',      nombre: 'Luz Marina Zapata Vásquez',         nombreCorto: 'Marina',      rol: 'docente', jornada: 'tarde', correo: 'luz.zapata@iemanueljbetancur.edu.co',      pin: '', color: '#fb7185' }, // rose
  { id: 'luis_angel',  nombre: 'Luis Ángel Quiceno',                nombreCorto: 'Luis Ángel',  rol: 'docente', jornada: 'tarde', correo: 'luis.quiceno@iemanueljbetancur.edu.co',   pin: '', color: '#a78bfa' }, // violet
  { id: 'juan_pablo',  nombre: 'Juan Pablo Bettin Tapia',           nombreCorto: 'Juan Pablo',  rol: 'docente', jornada: 'tarde', correo: 'juan.bettin@iemanueljbetancur.edu.co',    pin: '', color: '#facc15' }, // yellow
  { id: 'hugo',        nombre: 'Hugo Armando Yepes Franco',         nombreCorto: 'Hugo',        rol: 'docente', jornada: 'tarde', correo: 'hugo.yepes@iemanueljbetancur.edu.co',      pin: '', color: '#fca5a5' }, // red-light
  { id: 'felipe',      nombre: 'Felipe Piedrahita Nieto',           nombreCorto: 'Felipe',      rol: 'docente', jornada: 'tarde', correo: 'felipe.piedrahita@iemanueljbetancur.edu.co', pin: '', color: '#fdba74' }, // peach
  { id: 'valentina',   nombre: 'Valentina Jaramillo López',         nombreCorto: 'Valentina',   rol: 'docente', jornada: 'tarde', correo: 'valentina.jaramillo@iemanueljbetancur.edu.co', pin: '', color: '#67e8f9' }, // cyan-light
  { id: 'yanet',       nombre: 'Yanet María Moscote Marulanda',     nombreCorto: 'Yanet',       rol: 'docente', jornada: 'tarde', correo: 'yanet.moscote@iemanueljbetancur.edu.co',   pin: '', color: '#86efac' }, // green-light
  { id: 'harol',       nombre: 'Harol Gómez',                       nombreCorto: 'Harol',       rol: 'docente', jornada: 'tarde', correo: 'harol.gomez@iemanueljbetancur.edu.co',     pin: '', color: '#e879f9' }, // fuchsia

  // Nuevos docentes
  { id: 'yuri',       nombre: 'Yuri Catalina Gómez Gómez',        nombreCorto: 'Yuri',       rol: 'docente', jornada: 'ambas', correo: 'yuri.gomez@iemanueljbetancur.edu.co',       pin: '', color: '#c4b5fd' },
  { id: 'alexander',  nombre: 'Jhon Alexander Sánchez Giraldo',   nombreCorto: 'Alexander',  rol: 'docente', jornada: 'ambas', correo: 'alexander.sanchez@iemanueljbetancur.edu.co', pin: '', color: '#fda4af' },
];

// ── Recursos ──────────────────────────────────────────────────────────────────

export const RECURSOS: Recurso[] = [
  // Aulas (numeradas)
  { id: 'aula_1',  nombre: 'Aula 1',  tipo: 'aula', jornada: 'ambas' },
  { id: 'aula_2',  nombre: 'Aula 2',  tipo: 'aula', jornada: 'ambas' },
  { id: 'aula_3',  nombre: 'Aula 3',  tipo: 'aula', jornada: 'ambas' },
  { id: 'aula_4',  nombre: 'Aula 4',  tipo: 'aula', jornada: 'ambas' },
  { id: 'aula_5',  nombre: 'Aula 5',  tipo: 'aula', jornada: 'ambas' },
  { id: 'aula_6',  nombre: 'Aula 6',  tipo: 'aula', jornada: 'ambas' },
  { id: 'aula_7',  nombre: 'Aula 7',  tipo: 'aula', jornada: 'ambas' },
  { id: 'aula_8',  nombre: 'Aula 8',  tipo: 'aula', jornada: 'ambas' },
  { id: 'aula_9',  nombre: 'Aula 9',  tipo: 'aula', jornada: 'ambas' },
  { id: 'aula_10', nombre: 'Aula 10', tipo: 'aula', jornada: 'ambas' },

  // Otros espacios
  { id: 'sala_info_1',   nombre: 'Sala de Informática 1',        tipo: 'otro_espacio', jornada: 'ambas', nombreHorario: 'Sala Informática' },
  { id: 'sala_info_2',   nombre: 'Sala de Informática 2',        tipo: 'otro_espacio', jornada: 'ambas' },
  { id: 'lab_ciencias',  nombre: 'Lab. Ciencias',                tipo: 'otro_espacio', jornada: 'ambas', nombreHorario: 'Lab. Ciencias' },
  { id: 'lab_innovacion',nombre: 'Lab. Innovación Educativa',    tipo: 'otro_espacio', jornada: 'ambas' },
  { id: 'biblioteca',    nombre: 'Biblioteca',                   tipo: 'otro_espacio', jornada: 'ambas' },
  { id: 'auditorio',     nombre: 'Auditorio',                    tipo: 'otro_espacio', jornada: 'ambas' },
  { id: 'sala_ef',       nombre: 'Sala de Educación Física',     tipo: 'otro_espacio', jornada: 'ambas' },

  // Equipos para préstamo
  { id: 'computadores',  nombre: 'Computadores',   tipo: 'equipo', jornada: 'ambas' },
  { id: 'video_beam',    nombre: 'Video beam',     tipo: 'equipo', jornada: 'ambas' },
  { id: 'parlante',      nombre: 'Parlante',       tipo: 'equipo', jornada: 'ambas' },
  { id: 'emisora',       nombre: 'Emisora',        tipo: 'equipo', jornada: 'ambas' },
  { id: 'tv_interactivo',nombre: 'TV interactivo', tipo: 'equipo', jornada: 'ambas' },
  { id: 'impresora_3d',  nombre: 'Impresora 3D',   tipo: 'equipo', jornada: 'ambas' },
];

// ── Bloques horarios ──────────────────────────────────────────────────────────

export const BLOQUES_MANANA: BloqueHorario[] = [
  { id: 1, inicio: '06:00', fin: '06:55', jornada: 'manana' },
  { id: 2, inicio: '06:55', fin: '07:50', jornada: 'manana' },
  { id: 3, inicio: '08:10', fin: '09:05', jornada: 'manana' },
  { id: 4, inicio: '09:05', fin: '10:00', jornada: 'manana' },
  { id: 5, inicio: '10:10', fin: '11:05', jornada: 'manana' },
  { id: 6, inicio: '11:05', fin: '12:00', jornada: 'manana' },
];

export const BLOQUES_TARDE: BloqueHorario[] = [
  { id: 1, inicio: '12:15', fin: '13:10', jornada: 'tarde' },
  { id: 2, inicio: '13:10', fin: '14:05', jornada: 'tarde' },
  { id: 3, inicio: '14:25', fin: '15:20', jornada: 'tarde' },
  { id: 4, inicio: '15:20', fin: '16:15', jornada: 'tarde' },
  { id: 5, inicio: '16:25', fin: '17:20', jornada: 'tarde' },
  { id: 6, inicio: '17:20', fin: '18:15', jornada: 'tarde' },
];

// Descansos entre horas
export const DESCANSOS_MANANA = [
  { id: 1, despuesDe: 2, inicio: '07:50', fin: '08:10', duracion: 20 },
  { id: 2, despuesDe: 4, inicio: '10:00', fin: '10:10', duracion: 10 },
];

export const DESCANSOS_TARDE = [
  { id: 1, despuesDe: 2, inicio: '14:05', fin: '14:25', duracion: 20 },
  { id: 2, despuesDe: 4, inicio: '16:15', fin: '16:25', duracion: 10 },
];

// ── Directores de grupo ───────────────────────────────────────────────────────

export const DIRECTORES_MANANA: Record<string, string> = {
  '11.1': 'johana',
  '11.2': 'julian',
  '11.3': 'claudia',
  '10.1': 'carlos',
  '10.2': 'beatriz',
  '10.3': 'ledis',
  '10.4': 'adolfo',
  '9.1':  'gloria_a',
  '9.2':  'marta',
  '9.3':  'uriel',
};

// Directores de tarde — asignación académica 2026 (con reemplazos vigentes)
export const DIRECTORES_TARDE: Record<string, string> = {
  '6º1': 'luis_angel',
  '6º2': 'fredy_garcia',
  '6º3': 'carolina',
  '7º1': 'yanet',
  '7º2': 'luis_javier',
  '7º3': 'harol',
  '8º1': 'edgar',
  '8º2': 'hugo',
  '8º3': 'monica_rave',
  '8º4': 'juan_pablo',
};

// Aulas tarde → grupo
export const AULA_GRUPO_TARDE: Record<string, string> = {
  'A1': '7º1', 'A2': '7º2', 'A3': '7º3',
  'A4': '8º4', 'A5': '8º3', 'A6': '8º2', 'A7': '8º1',
  'A8': '6º1', 'A9': '6º2', 'A10': '6º3',
};

// ── Docentes mixtos (trabajan en ambas jornadas) ───────────────────────────────

export const MIXTOS_TARDE: Record<string, string[]> = {
  'marta':    ['martes', 'jueves'],
  'monica_c': ['lunes', 'miercoles'],
  'yoguis':   ['miercoles'],
  'edgar':    ['lunes', 'martes', 'miercoles', 'jueves', 'viernes'],
};

// ── Acompañamientos de descanso ────────────────────────────────────────────────
// Pendiente completar con datos de la jornada tarde

export const ACOMPAÑAMIENTOS: Acompanamiento[] = [
  // Tienda Escolar
  { docente: 'johana',   dia: 'lunes',     descansos: 'ambos', lugar: 'Tienda Escolar',          jornada: 'manana' },
  { docente: 'monica_c', dia: 'martes',    descansos: 'ambos', lugar: 'Tienda Escolar',          jornada: 'manana' },
  { docente: 'gloria_a', dia: 'miercoles', descansos: 'ambos', lugar: 'Tienda Escolar',          jornada: 'manana' },
  { docente: 'uriel',    dia: 'jueves',    descansos: 'ambos', lugar: 'Tienda Escolar',          jornada: 'manana' },
  { docente: 'ledis',    dia: 'viernes',   descansos: 'ambos', lugar: 'Tienda Escolar',          jornada: 'manana' },
  // Baños
  { docente: 'claudia',  dia: 'lunes',     descansos: 'ambos', lugar: 'Baños',                   jornada: 'manana' },
  { docente: 'yoguis',   dia: 'martes',    descansos: 'ambos', lugar: 'Baños',                   jornada: 'manana' },
  { docente: 'ledis',    dia: 'miercoles', descansos: 'ambos', lugar: 'Baños',                   jornada: 'manana' },
  { docente: 'claudia',  dia: 'jueves',    descansos: 'ambos', lugar: 'Baños',                   jornada: 'manana' },
  { docente: 'beatriz',  dia: 'viernes',   descansos: 'ambos', lugar: 'Baños',                   jornada: 'manana' },
  // Restaurante
  { docente: 'doris',    dia: 'lunes',     descansos: 'ambos', lugar: 'Restaurante',             jornada: 'manana' },
  { docente: 'gloria_a', dia: 'martes',    descansos: 'ambos', lugar: 'Restaurante',             jornada: 'manana' },
  { docente: 'margara',  dia: 'miercoles', descansos: 'ambos', lugar: 'Restaurante',             jornada: 'manana' },
  { docente: 'margara',  dia: 'jueves',    descansos: 'ambos', lugar: 'Restaurante',             jornada: 'manana' },
  { docente: 'doris',    dia: 'viernes',   descansos: 'ambos', lugar: 'Restaurante',             jornada: 'manana' },
  // Segundo Piso
  { docente: 'uriel',    dia: 'lunes',     descansos: 'ambos', lugar: 'Segundo Piso',            jornada: 'manana' },
  { docente: 'carlos',   dia: 'martes',    descansos: 'ambos', lugar: 'Segundo Piso',            jornada: 'manana' },
  { docente: 'marta',    dia: 'miercoles', descansos: 'ambos', lugar: 'Segundo Piso',            jornada: 'manana' },
  { docente: 'monica_c', dia: 'jueves',    descansos: 'ambos', lugar: 'Segundo Piso',            jornada: 'manana' },
  { docente: 'marta',    dia: 'viernes',   descansos: 'ambos', lugar: 'Segundo Piso',            jornada: 'manana' },
  // Kioscos
  { docente: 'jorge',    dia: 'lunes',     descansos: 'ambos', lugar: 'Kioscos',                 jornada: 'manana' },
  { docente: 'adolfo',   dia: 'martes',    descansos: 'ambos', lugar: 'Kioscos',                 jornada: 'manana' },
  { docente: 'carlos',   dia: 'miercoles', descansos: 'ambos', lugar: 'Kioscos',                 jornada: 'manana' },
  { docente: 'yoguis',   dia: 'jueves',    descansos: 'ambos', lugar: 'Kioscos',                 jornada: 'manana' },
  { docente: 'julian',   dia: 'viernes',   descansos: 'ambos', lugar: 'Kioscos',                 jornada: 'manana' },
  // Patio Central y Malla
  { docente: 'beatriz',  dia: 'lunes',     descansos: 'ambos', lugar: 'Patio Central y Malla',   jornada: 'manana' },
  { docente: 'julian',   dia: 'martes',    descansos: 'ambos', lugar: 'Patio Central y Malla',   jornada: 'manana' },
  { docente: 'adolfo',   dia: 'miercoles', descansos: 'ambos', lugar: 'Patio Central y Malla',   jornada: 'manana' },
  { docente: 'jorge',    dia: 'jueves',    descansos: 'ambos', lugar: 'Patio Central y Malla',   jornada: 'manana' },
  { docente: 'uriel',    dia: 'viernes',   descansos: 'ambos', lugar: 'Patio Central y Malla',   jornada: 'manana' },

  // ── Jornada tarde ──────────────────────────────────────────────────────────
  // Tienda Escolar
  { docente: 'harol',         dia: 'lunes',     descansos: 'ambos', lugar: 'Tienda Escolar',                       jornada: 'tarde' },
  { docente: 'fredy_garcia',  dia: 'martes',    descansos: 'ambos', lugar: 'Tienda Escolar',                       jornada: 'tarde' },
  { docente: 'yanet',         dia: 'miercoles', descansos: 'ambos', lugar: 'Tienda Escolar',                       jornada: 'tarde' },
  { docente: 'juan_pablo',    dia: 'jueves',    descansos: 'ambos', lugar: 'Tienda Escolar',                       jornada: 'tarde' },
  { docente: 'carolina',      dia: 'viernes',   descansos: 'ambos', lugar: 'Tienda Escolar',                       jornada: 'tarde' },
  // Baños Mujeres y Hombres
  { docente: 'felipe',        dia: 'lunes',     descansos: 'ambos', lugar: 'Baños Mujeres y Hombres',              jornada: 'tarde' },
  { docente: 'felipe',        dia: 'martes',    descansos: 'ambos', lugar: 'Baños Mujeres y Hombres',              jornada: 'tarde' },
  { docente: 'fredy_garcia',  dia: 'miercoles', descansos: 'ambos', lugar: 'Baños Mujeres y Hombres',              jornada: 'tarde' },
  { docente: 'hugo',          dia: 'jueves',    descansos: 'ambos', lugar: 'Baños Mujeres y Hombres',              jornada: 'tarde' },
  { docente: 'luis_angel',    dia: 'viernes',   descansos: 'ambos', lugar: 'Baños Mujeres y Hombres',              jornada: 'tarde' },
  // Restaurante Escolar
  { docente: 'marina',        dia: 'lunes',     descansos: 'ambos', lugar: 'Restaurante Escolar',                  jornada: 'tarde' },
  { docente: 'fredy_g',       dia: 'martes',    descansos: 'ambos', lugar: 'Restaurante Escolar',                  jornada: 'tarde' },
  { docente: 'luis_javier',   dia: 'miercoles', descansos: 'ambos', lugar: 'Restaurante Escolar',                  jornada: 'tarde' },
  { docente: 'fredy_g',       dia: 'jueves',    descansos: 'ambos', lugar: 'Restaurante Escolar',                  jornada: 'tarde' },
  { docente: 'hugo',          dia: 'viernes',   descansos: 'ambos', lugar: 'Restaurante Escolar',                  jornada: 'tarde' },
  // Segundo Piso (corredor y accesos)
  { docente: 'fredy_g',       dia: 'lunes',     descansos: 'ambos', lugar: 'Segundo Piso (corredor y accesos)',    jornada: 'tarde' },
  { docente: 'marta',         dia: 'martes',    descansos: 'ambos', lugar: 'Segundo Piso (corredor y accesos)',    jornada: 'tarde' },
  { docente: 'monica_c',      dia: 'miercoles', descansos: 'ambos', lugar: 'Segundo Piso (corredor y accesos)',    jornada: 'tarde' },
  { docente: 'marina',        dia: 'jueves',    descansos: 'ambos', lugar: 'Segundo Piso (corredor y accesos)',    jornada: 'tarde' },
  { docente: 'monica_rave',   dia: 'viernes',   descansos: 'ambos', lugar: 'Segundo Piso (corredor y accesos)',    jornada: 'tarde' },
  // Kioscos
  { docente: 'luis_javier',   dia: 'lunes',     descansos: 'ambos', lugar: 'Kioscos',                              jornada: 'tarde' },
  { docente: 'yanet',         dia: 'martes',    descansos: 'ambos', lugar: 'Kioscos',                              jornada: 'tarde' },
  { docente: 'carolina',      dia: 'miercoles', descansos: 'ambos', lugar: 'Kioscos',                              jornada: 'tarde' },
  { docente: 'harol',         dia: 'jueves',    descansos: 'ambos', lugar: 'Kioscos',                              jornada: 'tarde' },
  { docente: 'edgar',         dia: 'viernes',   descansos: 'ambos', lugar: 'Kioscos',                              jornada: 'tarde' },
  // Patio Central y Zonas Comunes
  { docente: 'edgar',         dia: 'lunes',     descansos: 'ambos', lugar: 'Patio Central y Zonas Comunes',        jornada: 'tarde' },
  { docente: 'valentina',     dia: 'martes',    descansos: 'ambos', lugar: 'Patio Central y Zonas Comunes',        jornada: 'tarde' },
  { docente: 'luis_angel',    dia: 'miercoles', descansos: 'ambos', lugar: 'Patio Central y Zonas Comunes',        jornada: 'tarde' },
  { docente: 'monica_rave',   dia: 'jueves',    descansos: 'ambos', lugar: 'Patio Central y Zonas Comunes',        jornada: 'tarde' },
  { docente: 'juan_pablo',    dia: 'viernes',   descansos: 'ambos', lugar: 'Patio Central y Zonas Comunes',        jornada: 'tarde' },
];

export const ZONAS_ACOMPANAMIENTO_TARDE = [
  'Tienda Escolar',
  'Baños Mujeres y Hombres',
  'Restaurante Escolar',
  'Segundo Piso (corredor y accesos)',
  'Kioscos',
  'Patio Central y Zonas Comunes',
];

export interface MomentoTarde {
  id: string;
  titulo: string;
  asignaciones: Record<string, string[]>; // dia -> ids de docente
}

export const MOMENTOS_TARDE: MomentoTarde[] = [
  {
    id: 'porteria',
    titulo: 'Portería (inicio de jornada)',
    asignaciones: {
      lunes: ['felipe'],
      martes: ['yanet'],
      miercoles: ['harol'],
      jueves: ['hugo'],
      viernes: ['carolina'],
    },
  },
  {
    id: 'almuerzo',
    titulo: 'Restaurante escolar (almuerzo)',
    asignaciones: {
      lunes: ['marina'],
      martes: ['fredy_g'],
      miercoles: ['fredy_g'],
      jueves: ['marina'],
      viernes: ['marina'],
    },
  },
  {
    id: 'evacuacion',
    titulo: 'Evacuación de estudiantes (fin de jornada)',
    asignaciones: {
      lunes: ['felipe', 'luis_javier'],
      martes: ['valentina', 'monica_rave'],
      miercoles: ['fredy_garcia', 'hugo'],
      jueves: ['carolina', 'fredy_g'],
      viernes: ['edgar', 'marina'],
    },
  },
];

/** Momentos adicionales de la tarde en los que participa un docente, con los días asignados. */
export function momentosDeDocente(docenteId: string): Array<{ id: string; titulo: string; dias: string[] }> {
  return MOMENTOS_TARDE
    .map(m => ({
      id: m.id,
      titulo: m.titulo,
      dias: Object.keys(m.asignaciones).filter(d => m.asignaciones[d].includes(docenteId)),
    }))
    .filter(m => m.dias.length > 0);
}

export const ZONAS_ACOMPANAMIENTO = ['Tienda Escolar', 'Baños', 'Restaurante', 'Segundo Piso', 'Kioscos', 'Patio Central y Malla'];

// ── Propósitos de reserva ─────────────────────────────────────────────────────

export const PROPOSITOS = [
  'Clase regular',
  'Evaluación',
  'Actividad grupal',
  'Proyecto de aula',
  'Reunión docente',
  'Evento institucional',
  'Docente de apoyo',
  'Docente UAI',
  'Medellín te quiere saludable',
  'Centro de interés',
  'Otro',
];

// ── Motivos rectora ────────────────────────────────────────────────────────────

export const MOTIVOS_RECTORA = [
  'Necesidad institucional',
  'Visita externa',
  'Reunión administrativa',
  'Evento cultural',
  'Requerimiento Secretaría Educación',
  'Otro',
];

// ── Colores por aula ───────────────────────────────────────────────────────────

export const COLORES_AULA: Record<string, string> = {
  'Aula 1':                    '#60a5fa',
  'Aula 2':                    '#34d399',
  'Aula 3':                    '#fb923c',
  'Aula 4':                    '#a78bfa',
  'Aula 5':                    '#fbbf24',
  'Aula 6':                    '#f472b6',
  'Aula 7':                    '#22d3ee',
  'Aula 8':                    '#f87171',
  'Aula 9':                    '#a3e635',
  'Aula 10':                   '#fdba74',
  'Sala Informática':          '#f1f5f9',
  'Sala de Informática 1':     '#f1f5f9',
  'Sala de Informática 2':     '#cbd5e1',
  'Lab. Ciencias':             '#ff4444',
  'Lab. Innovación Educativa': '#a78bfa',
  'Biblioteca':                '#86efac',
  'Auditorio':                 '#fcd34d',
  'Sala de Educación Física':  '#67e8f9',
  'Patio':                     '#86efac',
  // Alias tarde
  'A1': '#60a5fa', 'A2': '#34d399', 'A3':  '#fb923c',
  'A4': '#a78bfa', 'A5': '#fbbf24', 'A6':  '#f472b6',
  'A7': '#22d3ee', 'A8': '#f87171', 'A9':  '#a3e635',
  'A10':'#fdba74',
};

// ── Colores por grado ──────────────────────────────────────────────────────────

// Los valores devueltos son referencias a CSS custom properties definidas en
// index.css. Cada token tiene un par claro/oscuro que cambia con html.dark,
// garantizando contraste WCAG AA en ambos modos.
export const COLORES_GRADO: Record<string, string> = {
  '9':  'var(--color-grado-9)',
  '10': 'var(--color-grado-10)',
  '11': 'var(--color-grado-11)',
  '6':  'var(--color-grado-6)',
  '7':  'var(--color-grado-7)',
  '8':  'var(--color-grado-8)',
};

export function colorGrado(grado: string): string {
  if (grado.startsWith('11')) return COLORES_GRADO['11'];
  if (grado.startsWith('10')) return COLORES_GRADO['10'];
  if (grado.startsWith('9'))  return COLORES_GRADO['9'];
  if (grado.startsWith('6'))  return COLORES_GRADO['6'];
  if (grado.startsWith('7'))  return COLORES_GRADO['7'];
  if (grado.startsWith('8'))  return COLORES_GRADO['8'];
  return 'var(--color-strong)';
}

// ── Helpers ────────────────────────────────────────────────────────────────────

const ORDINALES = ['1.ª', '2.ª', '3.ª', '4.ª', '5.ª', '6.ª'];

export function horaOrdinal(id: number): string {
  return ORDINALES[id - 1] ?? `${id}.ª`;
}

// Orden de los espacios con nombre (sin número). Auditorio siempre al final.
const PRIORIDAD_ESPACIO: Record<string, number> = {
  'Lab. Ciencias': 1,
  'Sala Informática': 2,
  'Sala Info.': 2,
  'Patio': 3,
  'Auditorio': 9,
};

/** Número del aula si es "Aula N" (mañana) o "AN" (tarde); null si es espacio con nombre. */
function numeroAula(aula: string): number | null {
  const m = aula.match(/^(?:Aula\s*|A)(\d+)$/i);
  return m ? parseInt(m[1], 10) : null;
}

/**
 * Comparador de aulas para ordenamiento natural:
 * Aula 1, 2, 3, ..., 9, 10 (numérico), luego los espacios con nombre
 * (Lab. Ciencias, Sala Informática, Patio) y el Auditorio al final.
 */
export function compararAulas(a: string, b: string): number {
  const na = numeroAula(a);
  const nb = numeroAula(b);
  if (na !== null && nb !== null) return na - nb;      // ambas numeradas
  if (na !== null) return -1;                           // numeradas antes que con nombre
  if (nb !== null) return 1;
  const pa = PRIORIDAD_ESPACIO[a] ?? 50;
  const pb = PRIORIDAD_ESPACIO[b] ?? 50;
  if (pa !== pb) return pa - pb;
  return a.localeCompare(b);
}

/** Extrae [grado, sección] de un código de grupo ('9.1', '10.2', '6º1', '8º4'). */
function clavGrado(grupo: string): [number, number] {
  const m = grupo.match(/^(\d+)\D+(\d+)/);
  if (!m) return [999, 999];
  return [parseInt(m[1], 10), parseInt(m[2], 10)];
}

/**
 * Comparador de grupos para ordenamiento numérico ascendente:
 * 6º1, 6º2, 7º1, ... (tarde) / 9.1, 9.2, 10.1, 10.2, 11.1, ... (mañana).
 */
export function compararGrupos(a: string, b: string): number {
  const [ga, sa] = clavGrado(a);
  const [gb, sb] = clavGrado(b);
  return ga - gb || sa - sb;
}

export function esJornadaTarde(grado: string): boolean {
  return grado.includes('º');
}

export function getUsuario(id: string): Usuario | undefined {
  return USUARIOS.find(u => u.id === id);
}

export function getDocentes(jornada?: Jornada): Usuario[] {
  return USUARIOS.filter(u => {
    if (u.rol !== 'docente') return false;
    if (!jornada) return true;
    return u.jornada === jornada || u.jornada === 'ambas';
  });
}

// ── Centro de Interés (CI) ───────────────────────────────────────────────────
//
// Mañana: martes 6.ª hora. Los docentes que lo supervisan se derivan del
// horario base (entradas de martes B6 cuyo grado incluye "CI"). NO todos los
// docentes de mañana tienen CI.
//
// Tarde: martes 1.ª hora (jornada independiente). Lista de docentes definida
// explícitamente abajo. Edgar es el único que tiene CI en ambas jornadas.
//
// En la vista POR GRUPO/AULA la franja de CI aplica a todos los grupos de la
// jornada; en la vista POR DOCENTE solo a quienes efectivamente lo supervisan.

/** Bloque institucional del CI según la jornada. */
export const BLOQUE_CI: Record<'manana' | 'tarde', number> = { manana: 6, tarde: 1 };

/** Docentes con CI en la TARDE (martes 1.ª hora). */
export const DOCENTES_CI_TARDE = new Set<string>([
  'marina',       // Marina Zapata ("Luz Marina")
  'carolina',     // Carolina Medina
  'fredy_garcia', // Fredy García
  'monica_rave',  // Mónica Rave
  'marta',        // Marta Úsuga
  'juan_pablo',   // Juan Pablo Bettin
  'edgar',        // Edgar Pérez (también CI en la mañana)
  'harol',        // Harol Gómez
  'felipe',       // Felipe Piedrahita
  'luis_angel',   // Luis Ángel Quiceno
  'luis_javier',  // Luis Javier Rojas
]);

/** Docentes con CI en la MAÑANA (martes 6.ª hora), derivados del horario base. */
export const DOCENTES_CI_MANANA = new Set<string>(
  horarioBase
    .filter(e => e.dia === 'martes' && e.bloque === 6 && e.jornada === 'manana' && e.grado.includes('CI'))
    .map(e => e.docente),
);

/** ¿La franja (día/bloque/jornada) es Centro de Interés para todos los grupos? */
export function esCIBloque(dia: string, bloque: number, jornada: 'manana' | 'tarde'): boolean {
  return dia === 'martes' && bloque === BLOQUE_CI[jornada];
}

/** ¿Este docente tiene CI en esta franja? */
export function esCIDocente(
  docenteId: string,
  dia: string,
  bloque: number,
  jornada: 'manana' | 'tarde',
): boolean {
  if (!esCIBloque(dia, bloque, jornada)) return false;
  return jornada === 'manana'
    ? DOCENTES_CI_MANANA.has(docenteId)
    : DOCENTES_CI_TARDE.has(docenteId);
}
