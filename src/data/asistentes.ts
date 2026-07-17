export interface Asistente {
  id: string;
  nombre: string;
  descripcion: string;
  emoji: string;
  url: string | null;   // null = aún no disponible
}

export const ASISTENTES: Asistente[] = [
  {
    id: 'convivencia',
    nombre: 'El Jota — Manual de Convivencia',
    descripcion: 'Resuelve dudas sobre el manual de convivencia de la institución.',
    emoji: '🤝',
    url: 'https://cdn.botpress.cloud/webchat/v3.6/shareable.html?configUrl=https://files.bpcontent.cloud/2026/07/09/01/20260709015200-MDLC81SL.json',
  },
  {
    id: 'evaluacion',
    nombre: 'Asistente del Sistema de Evaluación',
    descripcion: 'Orientación sobre el sistema institucional de evaluación (SIEE).',
    emoji: '📝',
    url: null,   // pendiente: URL por definir
  },
];
