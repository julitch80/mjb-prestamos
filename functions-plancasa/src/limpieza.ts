// Selección pura de entregas vencidas (borrado al fin del año lectivo).
export const LOTE_LIMPIEZA = 200;

export interface EntregaVencible { ruta?: string; borrarDespuesDe?: number }

/** Las que ya vencieron (estrictamente), como máximo `limite`. Sin fecha válida nunca se borra. */
export function seleccionarVencidas<T extends EntregaVencible>(entregas: T[], ahora: number, limite = LOTE_LIMPIEZA): T[] {
  return entregas
    .filter(e => typeof e.borrarDespuesDe === 'number' && Number.isFinite(e.borrarDespuesDe) && e.borrarDespuesDe < ahora)
    .slice(0, limite);
}
