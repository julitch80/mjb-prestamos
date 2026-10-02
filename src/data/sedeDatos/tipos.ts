// Tipos del formulario «Datos de la sede». Documento Firestore: sedeDatos/{sedeId}.
export type SedeDatosId = 'gustavo_rodas' | 'la_finquita';
export const SEDES_DATOS: SedeDatosId[] = ['gustavo_rodas', 'la_finquita'];

/** pendiente = sin tocar; despues = «lo dejo para después». */
export type EstadoTema = 'pendiente' | 'bien' | 'corregir' | 'respondido' | 'despues';

export interface AudioNota {
  ruta: string;        // sedeDatos/{sedeId}/{id}
  nombre: string;
  tipo: string;        // mime base (audio/webm, audio/mp4...)
  tamano: number;
  duracionSeg: number;
}
export interface RefArchivo { etiqueta: string; donde: string }   // «A1» + «p.2»
export interface Entrada { texto: string; refs: RefArchivo[]; audios: AudioNota[] }
export interface RespuestaPregunta { valor: string; detalle: string; entrada: Entrada }
export interface RespuestaTema {
  estado: EstadoTema;
  entrada: Entrada;
  preguntas: Record<string, RespuestaPregunta>;
}
export interface ArchivoSede {
  id: string;
  etiqueta: string;    // A1, A2…
  nombre: string;      // nombre corto editable
  nombreOriginal: string;
  ruta: string;        // sedeDatos/{sedeId}/{id}
  tipo: string;
  tamano: number;
  subidoPor: string;
  fecha: string;       // ISO (no se puede serverTimestamp dentro de un arreglo)
}
export interface SedeDatosDoc {
  sede: SedeDatosId;
  respuestas: Record<string, RespuestaTema>;
  archivos: ArchivoSede[];
  enviadoEn?: unknown;       // Timestamp de Firestore
  enviosCount?: number;
  actualizadoPor?: string;
  actualizadoEn?: unknown;
}

export type HojaExcel =
  | 'Docentes' | 'Directores' | 'Horario' | 'Horas y descansos'
  | 'Acompañamientos' | 'Asistencia' | 'Estudiantes';
export const HOJAS_EXCEL: HojaExcel[] = [
  'Docentes', 'Directores', 'Horario', 'Horas y descansos', 'Acompañamientos', 'Asistencia', 'Estudiantes',
];

export interface FilaPrellenada { etiqueta: string; valor: string }
/** `pide` = etiqueta del campo de detalle que aparece al elegir la opción («Otro», «Sí → cuáles»). */
export interface OpcionPregunta { valor: string; pide?: string }
export interface Pregunta {
  id: string;
  etiqueta: string;
  opciones?: OpcionPregunta[];   // sin opciones = respuesta de texto corto
}
export interface Tema {
  id: string;
  titulo: string;
  ayuda?: string;
  modo: 'confirmar' | 'responder';
  hoja: HojaExcel;
  prellenado: FilaPrellenada[];
  preguntas: Pregunta[];
}
