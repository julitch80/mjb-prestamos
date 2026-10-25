import { CircleCheck, TriangleAlert } from 'lucide-react';
import type { MarcaAlerta } from './domain/types';

/**
 * La marca de la alerta academica como ICONO (revision visual, 2026-10-26): triangulo = en
 * alerta, circulo con chulo = sin alerta (el chulo solo es «presente» en la planilla), raya =
 * sin marcar, que es lo que mas importa ver para terminar la lista. Antes eran emojis (cada
 * celular los pinta distinto) y un «·» casi invisible. El color lo pone quien lo usa (token).
 */
export function IconoMarcaAlerta({ marca, grande = false }: { marca: MarcaAlerta | undefined; grande?: boolean }) {
  const t = grande ? 26 : 20;
  if (marca === 'alerta') return <TriangleAlert size={t} aria-hidden strokeWidth={2.4} />;
  if (marca === 'sin_alerta') return <CircleCheck size={t} aria-hidden strokeWidth={2.2} />;
  return <span aria-hidden className="text-lg font-bold leading-none">—</span>;
}
