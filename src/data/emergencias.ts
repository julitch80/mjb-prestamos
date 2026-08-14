// Directorio de números de emergencia — Gestión del Riesgo.
// Transcrito del volante institucional COPASST (I.E. Manuel J. Betancur,
// San Antonio de Prado). Se agrupó por tipo de situación en vez de replicar
// las dos columnas del volante, para que un docente encuentre el número que
// necesita sin tener que leer la lista completa.

export type CategoriaEmergenciaId =
  | 'policia'
  | 'ninez_familia'
  | 'salud_mental'
  | 'salud'
  | 'bomberos'
  | 'institucional';

export interface ContactoEmergencia {
  entidad: string;
  telefonos: string[];
  nota?: string;
}

export interface CategoriaEmergencia {
  id: CategoriaEmergenciaId;
  nombre: string;
  icono: string;
  contactos: ContactoEmergencia[];
}

export const CATEGORIAS_EMERGENCIA: CategoriaEmergencia[] = [
  {
    id: 'policia',
    nombre: 'Policía y seguridad',
    icono: '🚓',
    contactos: [
      { entidad: 'Policía Nacional', telefonos: ['6042860040'] },
      { entidad: 'Policía Nacional — línea nacional', telefonos: ['123'] },
      { entidad: 'Cuadrante SAP', telefonos: ['3127206020'] },
      { entidad: 'Fiscalía General de la Nación', telefonos: ['122'] },
      { entidad: 'Fiscalía', telefonos: ['6044446677'] },
    ],
  },
  {
    id: 'ninez_familia',
    nombre: 'Niñez, mujer y familia',
    icono: '👶',
    contactos: [
      { entidad: 'Infancia y Adolescencia', telefonos: ['123'], nota: 'opciones Social · Niñez · Mujer' },
      { entidad: 'Comisaría de Familia', telefonos: ['6043855555', '6043856923'] },
      { entidad: 'ICBF', telefonos: ['6044163071', '018000112440'], nota: 'línea gratuita, ext. 141' },
      { entidad: 'CAIVAS', telefonos: ['6043852600'], nota: 'atención integral a víctimas de abuso sexual, ext. 7721/7729' },
      { entidad: 'Centro de Inclusión y Familia', telefonos: ['6043858846', '3113399879', '3147504821'] },
    ],
  },
  {
    id: 'salud_mental',
    nombre: 'Salud mental y prevención del suicidio',
    icono: '🧠',
    contactos: [
      { entidad: 'Prevención del Suicidio', telefonos: ['018000113113'], nota: 'línea gratuita' },
      {
        entidad: 'Línea Código Dorado — Centro Integral de Familia (Psicología)',
        telefonos: ['123', '6044444448', '6043028412', '3134663107'],
        nota: 'opciones Social · Mujer',
      },
    ],
  },
  {
    id: 'salud',
    nombre: 'Salud',
    icono: '🏥',
    contactos: [
      { entidad: 'Puesto de Salud Más Cercano', telefonos: ['6043849295'] },
      { entidad: 'MetroSalud', telefonos: ['6042860055'], nota: 'ext. 110' },
      { entidad: 'Medicina Legal', telefonos: ['6044548230'] },
    ],
  },
  {
    id: 'bomberos',
    nombre: 'Bomberos',
    icono: '🚒',
    contactos: [
      { entidad: 'Bomberos San Antonio de Prado', telefonos: ['6043374747'] },
    ],
  },
  {
    id: 'institucional',
    nombre: 'Institucional y educativo',
    icono: '🏫',
    contactos: [
      { entidad: 'Núcleo Educativo 937', telefonos: ['6043710572', '6043710170'] },
      { entidad: 'Corregiduría San Antonio de Prado', telefonos: ['6042868858'] },
    ],
  },
];

/** Formato legible para mostrar (no para marcar): 6042860040 -> 604 286 0040. */
export function formatearTelefono(tel: string): string {
  if (/^\d{2,4}$/.test(tel)) return tel; // líneas cortas: 123, 122
  if (tel.length === 10 && /^\d+$/.test(tel)) {
    return `${tel.slice(0, 3)} ${tel.slice(3, 6)} ${tel.slice(6)}`;
  }
  if (tel.length === 12 && /^\d+$/.test(tel)) {
    return `${tel.slice(0, 3)}${tel.slice(3, 5)} ${tel.slice(5, 8)} ${tel.slice(8)}`;
  }
  return tel;
}
