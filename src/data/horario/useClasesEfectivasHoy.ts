import { useMemo } from 'react';
import { useAppStore } from '../store';
import { clasesEfectivas, fechaLocalISO, type ClaseEfectiva } from './clasesEfectivas';

/**
 * Clases efectivas de hoy del docente. Los horarios modificados y las jornadas reducidas
 * vienen del store (que los sincroniza con el backend); si aún no cargaron, devuelve el
 * horario base y se recalcula solo cuando llegan.
 */
export function useClasesEfectivasHoy(slotId: string | null | undefined, fecha?: string): ClaseEfectiva[] {
  const horariosModificados = useAppStore((s) => s.horariosModificados);
  const jornadasReducidas = useAppStore((s) => s.jornadasReducidas);
  const f = fecha ?? fechaLocalISO(new Date());
  return useMemo(
    () => clasesEfectivas(slotId, f, { horariosModificados, jornadasReducidas }),
    [slotId, f, horariosModificados, jornadasReducidas],
  );
}
