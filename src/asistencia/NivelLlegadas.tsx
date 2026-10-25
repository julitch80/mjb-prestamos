import type { ReactNode } from 'react';
import type { ColorAlerta } from './domain/alertas';

/**
 * Escala de reincidencia de llegadas tarde (revision visual, 2026-10-26): el nivel se lee por
 * los PUNTOS (● ●● ●●●), no solo por el color, y los colores son tokens de la app (claro y
 * oscuro). Antes eran tres hex fijos; el amarillo como letra no se leia en modo claro y
 * amarillo y naranja se confunden con daltonismo.
 */
export const NIVEL_ALERTA: Record<ColorAlerta, { n: number; nombre: string; clase: string }> = {
  amarillo: { n: 1, nombre: '1.er nivel', clase: 'border-warning-soft bg-warning-soft text-warning-soft-fg' },
  naranja: { n: 2, nombre: '2.º nivel', clase: 'border-warning bg-warning-soft text-warning-soft-fg' },
  rojo: { n: 3, nombre: '3.er nivel', clase: 'border-danger bg-danger-soft text-danger-soft-fg' },
};

export function PastillaNivel({ color, title, children }: { color: ColorAlerta; title?: string; children?: ReactNode }) {
  const x = NIVEL_ALERTA[color];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-sm font-semibold ${x.clase}`} title={title}>
      <span aria-hidden className="text-xs tracking-tighter">{'●'.repeat(x.n)}</span>
      <span className="sr-only">{x.nombre}: </span>
      {children ?? x.nombre}
    </span>
  );
}
