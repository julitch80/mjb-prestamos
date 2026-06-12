// ── Tipos ─────────────────────────────────────────────────────────────────────

export type Rol = 'rectora' | 'coordinador' | 'docente';
export type Jornada = 'manana' | 'tarde' | 'ambas';

export interface Usuario {
  id: string;
  nombre: string;
  nombreCorto: string;
  rol: Rol;
  jornada: Jornada;
  correo: string;
  pin: string;
  color: string; // color hex del docente en la paleta
}

export interface Recurso {
  id: string;
  nombre: string;
  tipo: 'aula' | 'laboratorio' | 'sala';
  jornada: Jornada;
}

export interface BloqueHorario {
  id: number;
  inicio: string;
  fin: string;
  jornada: Jornada;
}

// ── Usuarios ──────────────────────────────────────────────────────────────────

export const USUARIOS: Usuario[] = [
  // Directivos
  { id: 'rectora',      nombre: 'Nancy Adriana Herrera López',    nombreCorto: 'Nancy',    rol: 'rectora',       jornada: 'ambas',   correo: 'mjb@iemanueljbetancur.edu.co',        pin: '11111', color: '#e8c84a' },
  { id: 'coord_manana', nombre: 'Janneth Astrid Ocampo Carvajal', nombreCorto: 'Janneth',  rol: 'coordinador',   jornada: 'manana',  correo: 'janneth.ocampo@iemanueljbetancur.edu.co', pin: '11111', color: '#f08080' },
  { id: 'coord_tarde',  nombre: 'Juan Diego Salazar Rendón',      nombreCorto: 'Juan Diego', rol: 'coordinador', jornada: 'tarde',   correo: 'juan.salazar@iemanueljbetancur.edu.co', pin: '11111', color: '#f08080' },

  // Docentes mañana
  { id: 'monica_c',  nombre: 'Mónica Córdoba',                  nombreCorto: 'Mónica C.',   rol: 'docente', jornada: 'ambas',  correo: '', pin: '', color: '#f472b6' },
  { id: 'yoguis',    nombre: 'Juan Carlos Blandón Vargas',      nombreCorto: 'Yoguis',      rol: 'docente', jornada: 'ambas',  correo: 'juancarlosbv@iemanueljbetancur.edu.co', pin: '', color: '#38bdf8' },
  { id: 'uriel',     nombre: 'José Uriel López Arias',          nombreCorto: 'Uriel',       rol: 'docente', jornada: 'manana', correo: 'uriel.lopez@iemanueljbetancur.edu.co', pin: '', color: '#a78bfa' },
  { id: 'claudia',   nombre: 'Claudia Patricia Henao Bermúdez', nombreCorto: 'Claudia',     rol: 'docente', jornada: 'manana', correo: '', pin: '', color: '#f97316' },
  { id: 'carlos',    nombre: 'Carlos',                          nombreCorto: 'Carlos',      rol: 'docente', jornada: 'manana', correo: '', pin: '', color: '#22d3ee' },
  { id: 'julian',    nombre: 'Julián David Medina Tamayo',      nombreCorto: 'Julián',      rol: 'docente', jornada: 'manana', correo: '', pin: '', color: '#6ee7b7' },
  { id: 'margara',   nombre: 'Margarita Bedoya',                nombreCorto: 'Margarita',   rol: 'docente', jornada: 'manana', correo: '', pin: '', color: '#e879f9' },
  { id: 'beatriz',   nombre: 'Beatriz Elena Montoya Valdés',    nombreCorto: 'Beatriz',     rol: 'docente', jornada: 'manana', correo: '', pin: '', color: '#fb923c' },
  { id: 'marta',     nombre: 'Marta Úsuga',                     nombreCorto: 'Marta',       rol: 'docente', jornada: 'ambas',  correo: '', pin: '', color: '#34d399' },
  { id: 'johana',    nombre: 'Leidy Johana Cano Ruiz',          nombreCorto: 'Johana',      rol: 'docente', jornada: 'manana', correo: '', pin: '', color: '#f87171' },
  { id: 'gloria_a',  nombre: 'Gloria Estella Álvarez López',    nombreCorto: 'Gloria A.',   rol: 'docente', jornada: 'manana', correo: '', pin: '', color: '#fde68a' },
  { id: 'ledis',     nombre: 'Ledis Laura Quintana Seguanes',   nombreCorto: 'Ledis',       rol: 'docente', jornada: 'manana', correo: '', pin: '', color: '#c4b5fd' },
  { id: 'adolfo',    nombre: 'Adolfo Díaz',                     nombreCorto: 'Adolfo',      rol: 'docente', jornada: 'manana', correo: '', pin: '', color: '#fbbf24' },
  { id: 'jorge',     nombre: 'Jorge',                           nombreCorto: 'Jorge',       rol: 'docente', jornada: 'manana', correo: '', pin: '', color: '#60a5fa' },
  { id: 'doris',     nombre: 'Doris',                           nombreCorto: 'Doris',       rol: 'docente', jornada: 'manana', correo: '', pin: '', color: '#a3e635' },

  // Docentes tarde
  { id: 'edgar',      nombre: 'Edgar Pérez',            nombreCorto: 'Edgar',      rol: 'docente', jornada: 'ambas',  correo: '', pin: '', color: '#94a3b8' },
  { id: 'carolina',   nombre: 'Carolina Medina',        nombreCorto: 'Carolina',   rol: 'docente', jornada: 'tarde',  correo: '', pin: '', color: '#fb923c' },
  { id: 'monica_rave',nombre: 'Mónica Rave',            nombreCorto: 'Mónica R.',  rol: 'docente', jornada: 'tarde',  correo: '', pin: '', color: '#f472b6' },
  { id: 'fredy_g',    nombre: 'Fredy Gutiérrez',        nombreCorto: 'Fredy G.',   rol: 'docente', jornada: 'tarde',  correo: '', pin: '', color: '#22d3ee' },
  { id: 'fredy_garcia',nombre:'Fredy García',           nombreCorto: 'Fredy García',rol:'docente', jornada: 'tarde',  correo: '', pin: '', color: '#38bdf8' },
  { id: 'luis_javier',nombre: 'Luis Javier Rojas',      nombreCorto: 'Luis Javier',rol: 'docente', jornada: 'tarde',  correo: '', pin: '', color: '#6ee7b7' },
  { id: 'marina',     nombre: 'Marina Zapata',          nombreCorto: 'Marina',     rol: 'docente', jornada: 'tarde',  correo: '', pin: '', color: '#e879f9' },
  { id: 'luis_angel', nombre: 'Luis Ángel Quiceno',     nombreCorto: 'Luis Ángel', rol: 'docente', jornada: 'tarde',  correo: '', pin: '', color: '#a78bfa' },
  { id: 'juan_pablo', nombre: 'Juan Pablo Bettin',      nombreCorto: 'Juan Pablo', rol: 'docente', jornada: 'tarde',  correo: '', pin: '', color: '#fbbf24' },
  { id: 'hugo',       nombre: 'Hugo Yepes',             nombreCorto: 'Hugo',       rol: 'docente', jornada: 'tarde',  correo: '', pin: '', color: '#f87171' },
  { id: 'felipe',     nombre: 'Felipe Piedrahita',      nombreCorto: 'Felipe',     rol: 'docente', jornada: 'tarde',  correo: '', pin: '', color: '#fdba74' },
  { id: 'valentina',  nombre: 'Valentina Jaramillo',    nombreCorto: 'Valentina',  rol: 'docente', jornada: 'tarde',  correo: '', pin: '', color: '#c4b5fd' },
  { id: 'yanet',      nombre: 'Yanet Moscote',          nombreCorto: 'Yanet',      rol: 'docente', jornada: 'tarde',  correo: '', pin: '', color: '#fde68a' },
  { id: 'harol',      nombre: 'Harol Gómez',            nombreCorto: 'Harol',      rol: 'docente', jornada: 'tarde',  correo: '', pin: '', color: '#60a5fa' },
];

// ── Recursos ──────────────────────────────────────────────────────────────────

export const RECURSOS: Recurso[] = [
  // Aulas mañana (numeradas — físicamente comparten el edificio con tarde)
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
  // Espacios especiales
  { id: 'sala_info', nombre: 'Sala Informática', tipo: 'sala',        jornada: 'ambas' },
  { id: 'lab_cien',  nombre: 'Lab. Ciencias',    tipo: 'laboratorio', jornada: 'ambas' },
  { id: 'auditorio', nombre: 'Auditorio',        tipo: 'aula',        jornada: 'ambas' },
  // Patio: espacio de Ed. Física (Adolfo Díaz), NO reservable — aparece en horario pero no en la cuadrícula
];

// ── Bloques horarios ──────────────────────────────────────────────────────────

export const BLOQUES_MANANA: BloqueHorario[] = [
  { id: 1, inicio: '06:00', fin: '06:55', jornada: 'manana' },
  { id: 2, inicio: '06:55', fin: '07:50', jornada: 'manana' },
  { id: 3, inicio: '08:10', fin: '09:05', jornada: 'manana' }, // tras recreo 20min
  { id: 4, inicio: '09:05', fin: '10:00', jornada: 'manana' },
  { id: 5, inicio: '10:10', fin: '11:05', jornada: 'manana' }, // tras recreo 10min
  { id: 6, inicio: '11:05', fin: '12:00', jornada: 'manana' },
];

export const BLOQUES_TARDE: BloqueHorario[] = [
  { id: 1, inicio: '12:15', fin: '13:10', jornada: 'tarde' },
  { id: 2, inicio: '13:10', fin: '14:05', jornada: 'tarde' },
  { id: 3, inicio: '14:25', fin: '15:20', jornada: 'tarde' }, // tras recreo 20min
  { id: 4, inicio: '15:20', fin: '16:15', jornada: 'tarde' },
  { id: 5, inicio: '16:25', fin: '17:20', jornada: 'tarde' }, // tras recreo 10min
  { id: 6, inicio: '17:20', fin: '18:15', jornada: 'tarde' },
];

// ── Directores de grupo ───────────────────────────────────────────────────────

export const DIRECTORES_MANANA: Record<string, string> = {
  '11.1': 'johana',
  '11.2': 'julian',
  '11.3': 'claudia',
  '10.1': 'yoguis',
  '10.2': 'beatriz',
  '10.3': 'ledis',
  '10.4': 'adolfo',
  '9.1':  'gloria_a',
  '9.2':  'marta',
  '9.3':  'uriel',
};

// Directores de tarde: pendiente de obtener del usuario
export const DIRECTORES_TARDE: Record<string, string> = {};

// Aulas tarde → grupo
export const AULA_GRUPO_TARDE: Record<string, string> = {
  'A1': '7º1', 'A2': '7º2', 'A3': '7º3',
  'A4': '8º4', 'A5': '8º3', 'A6': '8º2', 'A7': '8º1',
  'A8': '6º1', 'A9': '6º2', 'A10': '6º3',
};

// ── Docentes mixtos (trabajan en ambas jornadas) ───────────────────────────────

// Días en que estos docentes están en jornada TARDE
export const MIXTOS_TARDE: Record<string, string[]> = {
  'marta':    ['martes', 'jueves'],
  'monica_c': ['lunes', 'miercoles'],
  'yoguis':   ['miercoles'],
  'edgar':    ['lunes', 'martes', 'miercoles', 'jueves', 'viernes'], // siempre tarde, solo martes B6 en mañana (CI)
};

// ── Propósitos de reserva ─────────────────────────────────────────────────────

export const PROPOSITOS = [
  'Clase de refuerzo',
  'Evaluación',
  'Actividad grupal',
  'Proyecto de aula',
  'Reunión docente',
  'Evento institucional',
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
  'Aula 1':           '#60a5fa',
  'Aula 2':           '#34d399',
  'Aula 3':           '#fb923c',
  'Aula 4':           '#a78bfa',
  'Aula 5':           '#fbbf24',
  'Aula 6':           '#f472b6',
  'Aula 7':           '#22d3ee',
  'Aula 8':           '#f87171',
  'Aula 9':           '#a3e635',
  'Aula 10':          '#fdba74',
  'Sala Informática': '#f1f5f9',
  'Lab. Ciencias':    '#ff4444',
  'Patio':            '#86efac',
  'Auditorio':        '#fcd34d',
  // Alias tarde
  'A1': '#60a5fa', 'A2': '#34d399', 'A3':  '#fb923c',
  'A4': '#a78bfa', 'A5': '#fbbf24', 'A6':  '#f472b6',
  'A7': '#22d3ee', 'A8': '#f87171', 'A9':  '#a3e635',
  'A10':'#fdba74',
};

// ── Colores por grado ──────────────────────────────────────────────────────────

export const COLORES_GRADO: Record<string, string> = {
  '9':  '#c4b5fd', // noveno
  '10': '#fde68a', // décimo
  '11': '#6ee7b7', // once
  '6':  '#fca5a5', // sexto
  '7':  '#93c5fd', // séptimo
  '8':  '#fed7aa', // octavo
};

export function colorGrado(grado: string): string {
  if (grado.startsWith('9'))  return COLORES_GRADO['9'];
  if (grado.startsWith('10')) return COLORES_GRADO['10'];
  if (grado.startsWith('11')) return COLORES_GRADO['11'];
  if (grado.startsWith('6'))  return COLORES_GRADO['6'];
  if (grado.startsWith('7'))  return COLORES_GRADO['7'];
  if (grado.startsWith('8'))  return COLORES_GRADO['8'];
  return '#ffffff';
}

// ── Helpers ────────────────────────────────────────────────────────────────────

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
