import { useId } from 'react';

type Direccion = 'izquierda' | 'derecha' | 'arriba' | 'abajo';
type Tamano = 'sm' | 'md' | 'lg';

const RUTAS: Record<Direccion, string> = {
  izquierda: 'M15 5l-7 7 7 7',
  derecha: 'M9 5l7 7-7 7',
  arriba: 'M5 15l7-7 7 7',
  abajo: 'M5 9l7 7 7-7',
};

const TAMANOS: Record<Tamano, string> = {
  sm: 'w-5 h-5',
  md: 'w-6 h-6',
  lg: 'w-9 h-9',
};

/**
 * Ángulo neón (trazo en degradado cian → fucsia con brillo suave).
 * El efecto hover se activa cuando un ancestro tiene la clase `group/flecha` o `group`.
 */
export function FlechaNeon({ direccion = 'izquierda', tamano = 'md', className }: {
  direccion?: Direccion;
  tamano?: Tamano;
  className?: string;
}) {
  const id = 'flecha-neon-' + useId().replace(/:/g, '');
  const d = RUTAS[direccion];
  const pequena = tamano === 'sm';
  return (
    <svg viewBox="0 0 24 24"
      className={`${TAMANOS[tamano]} shrink-0 ${pequena ? 'opacity-85' : 'opacity-55'} group-hover/flecha:opacity-100 group-hover:opacity-100 transition-[transform,opacity] duration-200 group-hover/flecha:scale-110 group-hover:scale-110 [filter:drop-shadow(0_0_3px_rgba(34,211,238,0.45))_drop-shadow(0_0_6px_rgba(217,70,239,0.35))] group-hover/flecha:[filter:drop-shadow(0_0_5px_rgba(34,211,238,0.95))_drop-shadow(0_0_10px_rgba(217,70,239,0.8))] group-hover:[filter:drop-shadow(0_0_5px_rgba(34,211,238,0.95))_drop-shadow(0_0_10px_rgba(217,70,239,0.8))]${className ? ' ' + className : ''}`}
      fill="none" strokeWidth={pequena ? 2.75 : 2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#22d3ee" />
          <stop offset="100%" stopColor="#d946ef" />
        </linearGradient>
      </defs>
      <path stroke={`url(#${id})`} strokeOpacity={0.85} d={d} />
      {!pequena && <path stroke="white" strokeOpacity={0.45} strokeWidth={0.8} d={d} />}
    </svg>
  );
}
