// Guía de acción fase por fase para emergencias escolares, pensada para
// leerse en el celular en medio de una emergencia real (una fase = una
// pantalla). Es una condensación distinta del mismo protocolo institucional
// que vive en protocoloEmergencias.ts (que sigue siendo el documento de
// consulta completo, sin cambios). NO se reescribe ni se resume aquí: el
// contenido está transcrito tal cual del protocolo.

import type { NivelFuente } from './protocoloEmergencias';

/** Tono visual de cada fase — seis tonos distintos, como en la infografía. */
export type TonoFase = 'peligro' | 'info' | 'exito' | 'advertencia' | 'morado' | 'teal';

export interface BloqueFase {
  titulo: string;
  texto: string;
}

/** Llamada directa desde la fase. Si `pendiente` es true, no hay número
 * confirmado — no se debe inventar uno, se muestra un aviso honesto que
 * remite a la pestaña de Números de emergencia. */
export interface LlamadaFase {
  etiqueta: string;
  telefono?: string;
  destacada?: boolean;
  pendiente?: boolean;
}

export interface FaseEmergencia {
  id: number;
  titulo: string;
  subtitulo: string;
  tono: TonoFase;
  nivelFuente: NivelFuente;
  bloques: BloqueFase[];
  llamadas?: LlamadaFase[];
}

export const FASES_EMERGENCIA: FaseEmergencia[] = [
  {
    id: 1,
    titulo: 'Triage inmediato',
    subtitulo: '¿Llamo al 123?',
    tono: 'peligro',
    nivelFuente: 'practica',
    bloques: [
      {
        titulo: 'Filtro de gravedad extrema',
        texto:
          'Si el estudiante presenta convulsiones, pérdida de consciencia por un golpe o si simplemente no tienes claridad sobre la gravedad, llama al 123 inmediatamente y sigue sus instrucciones.',
      },
      {
        titulo: 'Tu función no es diagnosticar',
        texto:
          'Debes reconocer y actuar en lo básico; la decisión médica no es tuya una vez contactas a emergencias.',
      },
    ],
    llamadas: [{ etiqueta: 'Llamar al 123', telefono: '123', destacada: true }],
  },
  {
    id: 2,
    titulo: 'Atención básica',
    subtitulo: 'Lo que sí puedes hacer',
    tono: 'info',
    nivelFuente: 'practica',
    bloques: [
      {
        titulo: 'Ubicación y privacidad',
        texto:
          'Lleva al estudiante a un lugar privado y cómodo; si no puede moverse, asegura la seguridad y privacidad en el sitio del accidente.',
      },
      {
        titulo: 'Primeros auxilios elementales',
        texto:
          'Puedes realizar inmovilizaciones necesarias, aplicar compresas frías o suministrar hidratación o alimento según el caso lo requiera.',
      },
      {
        titulo: 'Indagación inicial',
        texto:
          'Pregunta al estudiante si ha tenido episodios similares, qué sucedió exactamente y dónde localiza el dolor.',
      },
    ],
  },
  {
    id: 3,
    titulo: 'Acciones en paralelo',
    subtitulo: 'Gestión administrativa',
    tono: 'exito',
    nivelFuente: 'practica',
    bloques: [
      {
        titulo: '¡No esperes! Actúa simultáneamente',
        texto:
          'Mientras atiendes al estudiante, llama al acudiente para que lo recoja y elabora el formato de remisión para el Fondo de Protección Escolar.',
      },
      {
        titulo: 'Documentación lista',
        texto:
          'Solicita la constancia de estudios en secretaría para tenerla lista al llegar el acudiente, y toma fotografía del documento firmado para el seguro.',
      },
    ],
  },
  {
    id: 4,
    titulo: 'Casos especiales',
    subtitulo: 'Sin contacto con acudientes',
    tono: 'advertencia',
    nivelFuente: 'legal_sin_verificar',
    bloques: [
      {
        titulo: 'Ruta de resguardo legal',
        texto:
          'Si termina la jornada y no hay contacto, se debe llamar a la Policía de Infancia y Adolescencia para gestionar el resguardo del estudiante.',
      },
      {
        titulo: 'Registro de evidencias',
        texto:
          'Documenta meticulosamente la hora y los números marcados en cada intento de contacto fallido con la familia.',
      },
      {
        titulo: 'Reporte ICBF',
        texto:
          'Si la situación lo amerita, reporta el caso a la Comisaría de Familia o a la Línea 141 del ICBF.',
      },
    ],
    llamadas: [
      { etiqueta: 'Comisaría de Familia', telefono: '6043855555' },
      { etiqueta: 'ICBF', telefono: '018000112440' },
      { etiqueta: 'Policía de Infancia y Adolescencia (San Antonio de Prado)', pendiente: true },
    ],
  },
  {
    id: 5,
    titulo: 'Apoyo emocional y salud mental',
    subtitulo: '',
    tono: 'morado',
    nivelFuente: 'practica',
    bloques: [
      {
        titulo: 'Contención sin intrusión',
        texto:
          'Ante tristeza o angustia, acércate con calma aclarando que no es necesario que el estudiante comparta detalles íntimos.',
      },
      {
        titulo: 'Identificación del ámbito',
        texto:
          'Pregunta únicamente si el problema ocurrió dentro o fuera del colegio, para activar la ruta de convivencia (evaluar acoso) o informar a la familia.',
      },
      {
        titulo: 'Rutas de apoyo psicológico',
        texto:
          'Si no hay docente orientador disponible o el estudiante se niega al apoyo interno, contacta a la Línea Naranja para orientación profesional.',
      },
    ],
    llamadas: [
      { etiqueta: 'Prevención del Suicidio', telefono: '018000113113' },
      { etiqueta: 'Línea Naranja', pendiente: true },
    ],
  },
  {
    id: 6,
    titulo: 'Gestión posterior',
    subtitulo: '',
    tono: 'teal',
    nivelFuente: 'institucional',
    bloques: [
      {
        titulo: 'Registro de salida e informe',
        texto:
          'Diligencia el formato institucional de salida y elabora un informe administrativo firmado por un directivo (tiempo, modo y lugar) como respaldo judicial.',
      },
      {
        titulo: 'Seguimiento del caso',
        texto:
          'Contacta a la familia días después para conocer el diagnóstico médico y la evolución del estudiante.',
      },
    ],
  },
];

/** Secuencia de primeros auxilios: 1 → 2 → 3 → 4 → 6 (la 5 queda aparte,
 * para "Contención emocional"). Son 5 pantallas aunque los números salten. */
export const SECUENCIA_PRIMEROS_AUXILIOS = [1, 2, 3, 4, 6];

/** Contención emocional: solo la fase 5. */
export const SECUENCIA_CONTENCION_EMOCIONAL = [5];

export function faseporId(id: number): FaseEmergencia {
  const fase = FASES_EMERGENCIA.find(f => f.id === id);
  if (!fase) throw new Error(`Fase de emergencia no encontrada: ${id}`);
  return fase;
}
