import type { ReactNode } from 'react';

/**
 * Texto flotante de ayuda al pasar el raton por encima.
 *
 * Se hace con un elemento propio y no con el atributo `title` del navegador por dos
 * razones: el `title` tarda un segundo largo en aparecer y no se puede dar formato, asi
 * que para una frase explicativa de dos lineas queda incomodo de leer.
 *
 * Aparece tambien con el foco del teclado (`group-focus-within`), no solo con el raton:
 * quien navega con tabulador tiene el mismo derecho a la explicacion.
 *
 * `pointer-events-none` es necesario: sin el, el globo aparece bajo el cursor, roba el
 * puntero y se cierra solo en un parpadeo infinito.
 */
export default function Ayuda({
  texto,
  children,
}: {
  texto: string;
  children: ReactNode;
}) {
  return (
    <span className="group relative inline-flex">
      {children}
      <span
        role="tooltip"
        className="pointer-events-none absolute left-1/2 top-full z-50 mt-1.5 hidden w-60 -translate-x-1/2 rounded-lg border border-line bg-card p-2 text-left text-xs font-normal leading-snug text-soft shadow-lg group-hover:block group-focus-within:block"
      >
        {texto}
      </span>
    </span>
  );
}
