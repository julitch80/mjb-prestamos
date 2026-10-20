import type { EstadoSeguimiento } from './domain/seguimiento-alerta';

/** Como se nombra cada estado del seguimiento, igual para el director y para coordinacion. */
export const ETIQUETA_SEGUIMIENTO: Record<EstadoSeguimiento, { texto: string; clase: string }> = {
  pendiente_marcar: { texto: 'Sin marcar', clase: 'bg-elevated text-soft' },
  asistio: { texto: 'Vino', clase: 'bg-success-soft text-success-soft-fg' },
  esperando_excusa: { texto: 'Esperando excusa', clase: 'bg-info-soft text-info-soft-fg' },
  citar_simple: { texto: 'Justificó: falta la nueva citación', clase: 'bg-warning-soft text-warning-soft-fg' },
  citar_con_norma: { texto: 'No justificó: falta la nueva citación', clase: 'bg-warning-soft text-warning-soft-fg' },
  reprogramada: { texto: 'Nueva citación', clase: 'bg-info-soft text-info-soft-fg' },
  asistio_reprogramada: { texto: 'Vino a la segunda citación', clase: 'bg-success-soft text-success-soft-fg' },
  remitida: { texto: 'Remitido a coordinación', clase: 'bg-danger-soft text-danger-soft-fg' },
};
