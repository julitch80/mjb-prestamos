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
}

// ── Usuarios ──────────────────────────────────────────────────────────────────

export const USUARIOS: Usuario[] = [
  // Directivos
  { id: 'rectora',      nombre: 'Nancy Adriana Herrera López',    nombreCorto: 'Nancy',      rol: 'rectora',     jornada: 'ambas',  correo: 'mjb@iemanueljbetancur.edu.co',            pin: '11111', color: '#e8c84a' },
  { id: 'coord_manana', nombre: 'Janneth Astrid Ocampo Carvajal', nombreCorto: 'Janneth',    rol: 'coordinador', jornada: 'manana', correo: 'janneth.ocampo@iemanueljbetancur.edu.co', pin: '11111', color: '#f08080' },
  { id: 'coord_tarde',  nombre: 'Juan Diego Salazar Rendón',      nombreCorto: 'Juan Diego', rol: 'coordinador', jornada: 'tarde',  correo: 'juan.salazar@iemanueljbetancur.edu.co',   pin: '11111', color: '#f08080' },

  // Docentes mañana — paleta con máxima separación perceptual
  { id: 'monica_c',  nombre: 'Mónica Córdoba',                  nombreCorto: 'Mónica C.',  rol: 'docente', jornada: 'ambas',  correo: '', pin: '', color: '#f472b6' }, // pink
  { id: 'yoguis',    nombre: 'Juan Carlos Blandón Vargas',      nombreCorto: 'Yoguis',     rol: 'docente', jornada: 'ambas',  correo: 'juancarlosbv@iemanueljbetancur.edu.co', pin: '', color: '#38bdf8' }, // sky
  { id: 'uriel',     nombre: 'José Uriel López Arias',          nombreCorto: 'Uriel',      rol: 'docente', jornada: 'manana', correo: 'uriel.lopez@iemanueljbetancur.edu.co', pin: '', color: '#a78bfa' }, // violet
  { id: 'claudia',   nombre: 'Claudia Patricia Henao Bermúdez', nombreCorto: 'Claudia',    rol: 'docente', jornada: 'manana', correo: '', pin: '', color: '#818cf8' }, // indigo — era naranja, confundía con Beatriz
  { id: 'carlos',    nombre: 'Carlos',                          nombreCorto: 'Carlos',     rol: 'docente', jornada: 'manana', correo: '', pin: '', color: '#22d3ee' }, // cyan
  { id: 'julian',    nombre: 'Julián David Medina Tamayo',      nombreCorto: 'Julián',     rol: 'docente', jornada: 'manana', correo: '', pin: '', color: '#0d9488' }, // teal — era verde esmeralda, confundía con Marta
  { id: 'margara',   nombre: 'Margarita Bedoya',                nombreCorto: 'Margarita',  rol: 'docente', jornada: 'manana', correo: '', pin: '', color: '#e879f9' }, // fuchsia
  { id: 'beatriz',   nombre: 'Beatriz Elena Montoya Valdés',    nombreCorto: 'Beatriz',    rol: 'docente', jornada: 'manana', correo: '', pin: '', color: '#fb923c' }, // orange
  { id: 'marta',     nombre: 'Marta Úsuga',                     nombreCorto: 'Marta',      rol: 'docente', jornada: 'ambas',  correo: '', pin: '', color: '#34d399' }, // emerald
  { id: 'johana',    nombre: 'Leidy Johana Cano Ruiz',          nombreCorto: 'Johana',     rol: 'docente', jornada: 'manana', correo: '', pin: '', color: '#f87171' }, // red
  { id: 'gloria_a',  nombre: 'Gloria Estella Álvarez López',    nombreCorto: 'Gloria A.',  rol: 'docente', jornada: 'manana', correo: '', pin: '', color: '#fde68a' }, // yellow-light
  { id: 'ledis',     nombre: 'Ledis Laura Quintana Seguanes',   nombreCorto: 'Ledis',      rol: 'docente', jornada: 'manana', correo: '', pin: '', color: '#c4b5fd' }, // lavender
  { id: 'adolfo',    nombre: 'Adolfo Díaz',                     nombreCorto: 'Adolfo',     rol: 'docente', jornada: 'manana', correo: '', pin: '', color: '#f59e0b' }, // amber — era amarillo pálido, confundía con Carlos
  { id: 'jorge',     nombre: 'Jorge',                           nombreCorto: 'Jorge',      rol: 'docente', jornada: 'manana', correo: '', pin: '', color: '#60a5fa' }, // blue
  { id: 'doris',     nombre: 'Doris',                           nombreCorto: 'Doris',      rol: 'docente', jornada: 'manana', correo: '', pin: '', color: '#a3e635' }, // lime

  // Docentes tarde — paleta independiente
  { id: 'edgar',       nombre: 'Edgar Pérez',       nombreCorto: 'Edgar',       rol: 'docente', jornada: 'ambas', correo: '', pin: '', color: '#94a3b8' }, // slate
  { id: 'carolina',    nombre: 'Carolina Medina',   nombreCorto: 'Carolina',    rol: 'docente', jornada: 'tarde', correo: '', pin: '', color: '#f97316' }, // orange-dark
  { id: 'monica_rave', nombre: 'Mónica Rave',        nombreCorto: 'Mónica R.',   rol: 'docente', jornada: 'tarde', correo: '', pin: '', color: '#f472b6' }, // pink
  { id: 'fredy_g',     nombre: 'Fredy Gutiérrez',   nombreCorto: 'Fredy G.',    rol: 'docente', jornada: 'tarde', correo: '', pin: '', color: '#4ade80' }, // green
  { id: 'fredy_garcia',nombre: 'Fredy García',      nombreCorto: 'Fredy García',rol: 'docente', jornada: 'tarde', correo: '', pin: '', color: '#bef264' }, // lime-light
  { id: 'luis_javier', nombre: 'Luis Javier Rojas', nombreCorto: 'Luis Javier', rol: 'docente', jornada: 'tarde', correo: '', pin: '', color: '#2dd4bf' }, // teal
  { id: 'marina',      nombre: 'Marina Zapata',     nombreCorto: 'Marina',      rol: 'docente', jornada: 'tarde', correo: '', pin: '', color: '#fb7185' }, // rose
  { id: 'luis_angel',  nombre: 'Luis Ángel Quiceno',nombreCorto: 'Luis Ángel',  rol: 'docente', jornada: 'tarde', correo: '', pin: '', color: '#a78bfa' }, // violet
  { id: 'juan_pablo',  nombre: 'Juan Pablo Bettin', nombreCorto: 'Juan Pablo',  rol: 'docente', jornada: 'tarde', correo: '', pin: '', color: '#facc15' }, // yellow
  { id: 'hugo',        nombre: 'Hugo Yepes',        nombreCorto: 'Hugo',        rol: 'docente', jornada: 'tarde', correo: '', pin: '', color: '#fca5a5' }, // red-light
  { id: 'felipe',      nombre: 'Felipe Piedrahita', nombreCorto: 'Felipe',      rol: 'docente', jornada: 'tarde', correo: '', pin: '', color: '#fdba74' }, // peach
  { id: 'valentina',   nombre: 'Valentina Jaramillo',nombreCorto: 'Valentina',  rol: 'docente', jornada: 'tarde', correo: '', pin: '', color: '#67e8f9' }, // cyan-light
  { id: 'yanet',       nombre: 'Yanet Moscote',     nombreCorto: 'Yanet',       rol: 'docente', jornada: 'tarde', correo: '', pin: '', color: '#86efac' }, // green-light
  { id: 'harol',       nombre: 'Harol Gómez',       nombreCorto: 'Harol',       rol: 'docente', jornada: 'tarde', correo: '', pin: '', color: '#e879f9' }, // fuchsia
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

export const MIXTOS_TARDE: Record<string, string[]> = {
  'marta':    ['martes', 'jueves'],
  'monica_c': ['lunes', 'miercoles'],
  'yoguis':   ['miercoles'],
  'edgar':    ['lunes', 'martes', 'miercoles', 'jueves', 'viernes'],
};

// ── Acompañamientos de descanso ────────────────────────────────────────────────
// Pendiente completar con datos de la jornada tarde

export const ACOMPAÑAMIENTOS: Acompanamiento[] = [
  // Julián — mañana
  { docente: 'julian', dia: 'martes',  descansos: 'ambos', lugar: 'Patio central' },
  { docente: 'julian', dia: 'viernes', descansos: 'ambos', lugar: 'Quioscos' },
];

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

export const COLORES_GRADO: Record<string, string> = {
  '9':  '#c4b5fd',
  '10': '#fde68a',
  '11': '#6ee7b7',
  '6':  '#fca5a5',
  '7':  '#93c5fd',
  '8':  '#fed7aa',
};

export function colorGrado(grado: string): string {
  if (grado.startsWith('11')) return COLORES_GRADO['11'];
  if (grado.startsWith('10')) return COLORES_GRADO['10'];
  if (grado.startsWith('9'))  return COLORES_GRADO['9'];
  if (grado.startsWith('6'))  return COLORES_GRADO['6'];
  if (grado.startsWith('7'))  return COLORES_GRADO['7'];
  if (grado.startsWith('8'))  return COLORES_GRADO['8'];
  return '#ffffff';
}

// ── Helpers ────────────────────────────────────────────────────────────────────

const ORDINALES = ['1.ª', '2.ª', '3.ª', '4.ª', '5.ª', '6.ª'];

export function horaOrdinal(id: number): string {
  return ORDINALES[id - 1] ?? `${id}.ª`;
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
