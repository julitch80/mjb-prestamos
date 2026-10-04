import { ASISTENTES } from './asistentes';

export type TipoOpcionManual = 'chatbot' | 'digital' | 'clasico';

export interface OpcionManual {
  id: string;
  nombre: string;
  descripcion: string;
  tipo: TipoOpcionManual;
  url: string;
}

// Los archivos viven en public/convivencia/; BASE_URL evita fijar /mjb-prestamos/.
const BASE = `${import.meta.env.BASE_URL}convivencia/`;
const urlChatbot = (id: string) => ASISTENTES.find(a => a.id === id)?.url ?? '';

export const URL_MANUAL_DIGITAL = `${BASE}manual-digital.html`;
export const URL_MANUAL_PDF = `${BASE}manual-convivencia-2026.pdf`;
export const URL_MANUAL_WORD = `${BASE}manual-convivencia-2026.docx`;
export const URL_SIEPE_DIGITAL = `${BASE}siepe-digital.html`;
export const URL_SIEPE_PDF = `${BASE}siepe-2026.pdf`;

/** URL absoluta de la versión digital, para el código QR. */
export function urlAbsolutaManualDigital(): string {
  return `${window.location.origin}${URL_MANUAL_DIGITAL}`;
}

export const OPCIONES_MANUAL: OpcionManual[] = [
  {
    id: 'convivencia',
    nombre: 'Chatbot del manual de convivencia',
    descripcion: 'El Jota resuelve dudas sobre el manual de convivencia.',
    tipo: 'chatbot',
    url: urlChatbot('convivencia'),
  },
  {
    id: 'evaluacion',
    nombre: 'Chatbot del Sistema Institucional de Evaluación',
    descripcion: 'Orientación sobre el sistema institucional de evaluación (SIEPE).',
    tipo: 'chatbot',
    url: urlChatbot('evaluacion'),
  },
  {
    id: 'siepe-digital',
    nombre: 'SIEPE digital (beta)',
    descripcion: 'Por preguntas, con rutas y mapa de conexiones. Pendiente de verificación por las directivas.',
    tipo: 'digital',
    url: URL_SIEPE_DIGITAL,
  },
  {
    id: 'siepe-clasico',
    nombre: 'SIEPE clásico',
    descripcion: 'El documento oficial completo, en PDF.',
    tipo: 'clasico',
    url: URL_SIEPE_PDF,
  },
  {
    id: 'digital',
    nombre: 'Versión digital',
    descripcion: 'Por preguntas, con rutas paso a paso y cartilla ilustrada para primaria.',
    tipo: 'digital',
    url: URL_MANUAL_DIGITAL,
  },
  {
    id: 'clasico',
    nombre: 'Versión clásica',
    descripcion: 'El documento oficial completo, en PDF o Word.',
    tipo: 'clasico',
    url: URL_MANUAL_PDF,
  },
];
