// Ilustraciones esquematicas para la ficha de primeros auxilios de brigada.
// Dibujos propios, NO anatomicos, en el mismo espiritu que IconosNeon.tsx:
// trazo uniforme, `currentColor` para heredar el tema (claro/oscuro), sin
// relleno solido y sin texto salvo alguna etiqueta muy corta si hace falta.
// Cada ilustracion tiene su propio viewBox (son mas grandes que un icono de
// menu) pero comparten stroke-width y extremos redondeados.

import type { ComponentType } from 'react';

type Props = { className?: string; style?: React.CSSProperties };

function Lienzo({ viewBox, className, style, children }: Props & { viewBox: string; children: React.ReactNode }) {
  return (
    <svg
      viewBox={viewBox}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={style}
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

/**
 * Cabestrillo — antebrazo sostenido por un triangulo de tela anudado al
 * cuello. La mano queda mas alta que el codo, tal como pide la fuente en
 * fractura de codo/antebrazo ("la mano quede mas alta que el codo").
 */
export const IlustracionCabestrillo = (p: Props) => (
  <Lienzo viewBox="0 0 120 120" {...p}>
    {/* Torso esquematico */}
    <path d="M40 20 L38 100 M80 20 L82 100" opacity={0.35} />
    {/* Cuello y nudo */}
    <circle cx="60" cy="18" r="7" opacity={0.35} />
    <path d="M52 34 L60 24 L74 40" />
    {/* Triangulo de tela (cabestrillo) */}
    <path d="M52 34 L30 70 L74 40 L90 66 L30 70" />
    {/* Antebrazo dentro: codo abajo, mano arriba junto al hombro */}
    <path d="M46 78 L58 46" strokeWidth={4} />
    <circle cx="46" cy="78" r="4" />
    <circle cx="58" cy="46" r="4" />
  </Lienzo>
);

/**
 * Ferula acolchada — extremidad recta con tabla rigida al lado, relleno
 * (acolchado) entre la tabla y la piel, y DOS amarres: uno por encima y
 * otro por debajo de la fractura. Dedos visibles al final.
 */
export const IlustracionFerulaAcolchada = (p: Props) => (
  <Lienzo viewBox="0 0 140 80" {...p}>
    {/* Extremidad (linea central) */}
    <path d="M15 40 L120 40" strokeWidth={4} />
    {/* Punto de fractura */}
    <path d="M60 30 L68 50" strokeDasharray="3 4" opacity={0.6} />
    {/* Tabla rigida (paralela, separada = acolchado entre ambas) */}
    <rect x="20" y="25" width="95" height="8" rx="1.5" />
    {/* Dedos al final */}
    <path d="M120 40 L128 34 M120 40 L130 40 M120 40 L128 46" strokeWidth={1.5} />
    {/* Amarres: uno antes y otro despues de la fractura */}
    <path d="M38 20 L38 55" strokeWidth={3} />
    <path d="M92 20 L92 55" strokeWidth={3} />
  </Lienzo>
);

/**
 * Vendaje en ocho — tobillo con el cruce en 8 sobre la articulacion,
 * dedos descubiertos (la fuente insiste en no tapar los dedos).
 */
export const IlustracionVendajeOcho = (p: Props) => (
  <Lienzo viewBox="0 0 120 100" {...p}>
    {/* Pierna */}
    <path d="M55 10 L55 45" strokeWidth={4} opacity={0.35} />
    {/* Pie */}
    <path d="M55 55 L95 68" strokeWidth={4} opacity={0.35} />
    {/* Dedos descubiertos al final del pie */}
    <path d="M95 68 L102 63 M95 68 L104 68 M95 68 L102 74" strokeWidth={1.5} opacity={0.35} />
    {/* Vueltas en 8 cruzando sobre el tobillo (articulacion en 55,50) */}
    <path d="M35 30 Q55 40 70 32 Q80 45 55 50 Q30 55 40 68 Q55 78 75 66" />
    <path d="M38 25 Q58 35 72 28" opacity={0.6} />
  </Lienzo>
);

/**
 * Ferula en L de carton — carton doblado en L cubriendo pie y parte baja
 * de la pierna, con amarres. Sirve para tobillo/pie.
 */
export const IlustracionFerulaLCarton = (p: Props) => (
  <Lienzo viewBox="0 0 120 120" {...p}>
    {/* Pierna dentro de la ferula */}
    <path d="M50 10 L50 75" strokeWidth={4} opacity={0.35} />
    {/* Pie dentro de la ferula */}
    <path d="M50 75 L95 88" strokeWidth={4} opacity={0.35} />
    {/* Carton doblado en L (contorno rigido) */}
    <path d="M35 8 L35 82 L100 100 L100 82 L58 70 L58 8 Z" />
    {/* Pliegue de la L */}
    <path d="M35 82 L58 70" opacity={0.6} strokeDasharray="3 4" />
    {/* Amarres */}
    <path d="M40 30 L53 34" strokeWidth={3} />
    <path d="M40 55 L55 60" strokeWidth={3} />
    <path d="M65 82 L85 90" strokeWidth={3} />
  </Lienzo>
);

export const ILUSTRACIONES: Record<string, ComponentType<Props>> = {
  cabestrillo: IlustracionCabestrillo,
  'ferula-acolchada': IlustracionFerulaAcolchada,
  'vendaje-ocho': IlustracionVendajeOcho,
  'ferula-l-carton': IlustracionFerulaLCarton,
};
