// Iconos de línea ("neón") para el panel de inicio.
// Dibujados a mano en SVG en vez de traer una librería: así el trazo, el
// grosor y el viewBox son uniformes, heredan el color del contenedor con
// `currentColor` y no añaden peso ni dependencias al bundle.
// Todos comparten viewBox 24×24, trazo 1.5 y extremos redondeados.

type Props = { className?: string; style?: React.CSSProperties };

function Svg({ className, style, children }: Props & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
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

/** Reservar — calendario con una marca de confirmación. */
export const IconoReservar = (p: Props) => (
  <Svg {...p}>
    <rect x="3" y="5" width="18" height="16" rx="2.5" />
    <path d="M3 10h18M8 3v4M16 3v4" />
    <path d="M9 15l2 2 4-4" />
  </Svg>
);

/** Historial — reloj con aguja hacia atrás. */
export const IconoHistorial = (p: Props) => (
  <Svg {...p}>
    <circle cx="12" cy="13" r="8" />
    <path d="M12 9v4l2.5 1.5" />
    <path d="M4.5 6.5V3M4.5 6.5H8" />
  </Svg>
);

/** Panel del coordinador — bandejas apiladas. */
export const IconoPanel = (p: Props) => (
  <Svg {...p}>
    <path d="M3 14l3-8h12l3 8" />
    <path d="M3 14h5l1 2.5h6L16 14h5v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
  </Svg>
);

/** Rectoría — frontón institucional con columnas. */
export const IconoRectoria = (p: Props) => (
  <Svg {...p}>
    <path d="M3 9l9-5 9 5" />
    <path d="M5 9v9M10 9v9M14 9v9M19 9v9" />
    <path d="M3 21h18" />
  </Svg>
);

/** Horario — cuadrícula de bloques. */
export const IconoHorario = (p: Props) => (
  <Svg {...p}>
    <rect x="3" y="4" width="18" height="17" rx="2.5" />
    <path d="M3 9h18M9 9v12M15 9v12" />
  </Svg>
);

/** Asignación académica — libros. */
export const IconoAsignacion = (p: Props) => (
  <Svg {...p}>
    <path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H11v15H5.5A1.5 1.5 0 0 0 4 20.5z" />
    <path d="M20 5.5A1.5 1.5 0 0 0 18.5 4H13v15h5.5a1.5 1.5 0 0 1 1.5 1.5z" />
  </Svg>
);

/** Tareas — lista con visto. */
export const IconoTareas = (p: Props) => (
  <Svg {...p}>
    <path d="M3.5 7l2 2 3.5-3.5" />
    <path d="M3.5 16l2 2L9 14.5" />
    <path d="M13 7.5h7.5M13 16.5h7.5" />
  </Svg>
);

/** Agenda institucional — periódico. */
export const IconoAgenda = (p: Props) => (
  <Svg {...p}>
    <path d="M4 5h13v14a2 2 0 0 0 2 2H6a2 2 0 0 1-2-2z" />
    <path d="M17 9h3v10a2 2 0 0 1-2 2" />
    <path d="M7 9h7M7 12.5h7M7 16h4" />
  </Svg>
);

/** Gestión del riesgo — triángulo de advertencia con exclamación. */
export const IconoRiesgo = (p: Props) => (
  <Svg {...p}>
    <path d="M12 3.5l9.5 16.5h-19z" />
    <path d="M12 9.5v5" />
    <path d="M12 17.5h.01" />
  </Svg>
);

/** Asistentes — chatbot. */
export const IconoAsistentes = (p: Props) => (
  <Svg {...p}>
    <rect x="4" y="8" width="16" height="11" rx="3" />
    <path d="M12 4v4M9.5 13h.01M14.5 13h.01" />
    <path d="M2.5 12v3M21.5 12v3" />
  </Svg>
);

/** Usuarios — dos personas. */
export const IconoUsuarios = (p: Props) => (
  <Svg {...p}>
    <circle cx="9" cy="8" r="3.5" />
    <path d="M3 20a6 6 0 0 1 12 0" />
    <path d="M16 5.5a3.5 3.5 0 0 1 0 6.5M17.5 15.5A6 6 0 0 1 21 20" />
  </Svg>
);

/** Chat — burbuja de conversación. */
export const IconoChat = (p: Props) => (
  <Svg {...p}>
    <path d="M20 12.5a7.5 7.5 0 0 1-10.9 6.7L4 20.5l1.4-4.7A7.5 7.5 0 1 1 20 12.5z" />
    <path d="M9 12h.01M12 12h.01M15 12h.01" />
  </Svg>
);

// ── Iconos de los banners de "Tu día" ──────────────────────────────────────

/** Campana de notificaciones. */
export const IconoCampana = (p: Props) => (
  <Svg {...p}>
    <path d="M18 8.5a6 6 0 1 0-12 0c0 5-2 6.5-2 6.5h16s-2-1.5-2-6.5z" />
    <path d="M10.3 19a2 2 0 0 0 3.4 0" />
  </Svg>
);

/** Reloj — jornada acortada / próxima clase. */
export const IconoReloj = (p: Props) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7v5l3.5 2" />
  </Svg>
);

/** Brújula — acompañamiento. */
export const IconoBrujula = (p: Props) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M15.5 8.5l-2 5-5 2 2-5z" />
  </Svg>
);

/** Sol tras nube — día despejado, sin más clases. */
export const IconoDespejado = (p: Props) => (
  <Svg {...p}>
    <circle cx="9" cy="9" r="3.5" />
    <path d="M9 2.5v1.5M9 14v1.5M2.5 9H4M14 9h1.5M4.4 4.4l1 1M12.6 12.6l1 1M13.6 4.4l-1 1M5.4 12.6l-1 1" />
    <path d="M11 19.5a3 3 0 0 1 .5-6 4 4 0 0 1 7.4 1.2 2.5 2.5 0 0 1-.4 4.8z" />
  </Svg>
);

/** Gráfico de barras — resumen del coordinador. */
export const IconoGrafico = (p: Props) => (
  <Svg {...p}>
    <path d="M4 20V4" />
    <path d="M4 20h16" />
    <path d="M8 20v-6M13 20V8M18 20v-9" />
  </Svg>
);

/** Sugerencias — bombilla. */
export const IconoSugerencias = (p: Props) => (
  <Svg {...p}>
    <path d="M9 18h6M10 21h4" />
    <path d="M12 3a6.5 6.5 0 0 0-3.5 12c.6.4 1 1.1 1 1.8V17h5v-.2c0-.7.4-1.4 1-1.8A6.5 6.5 0 0 0 12 3z" />
  </Svg>
);

/** Asistencia — planilla con casillas marcadas. */
export const IconoAsistencia = (p: Props) => (
  <Svg {...p}>
    <rect x="3.5" y="4" width="17" height="16" rx="2.5" />
    <path d="M3.5 9h17" />
    <path d="M7 5.5v-2M17 5.5v-2" />
    <path d="M6.5 12.5l1.3 1.3L10.3 11" />
    <path d="M6.5 16.7l1.3 1.3 2.5-2.8" />
    <path d="M13 12.2h5M13 16.7h5" />
  </Svg>
);

/** Policía — escudo con estrella. */
export const IconoPolicia = (p: Props) => (
  <Svg {...p}>
    <path d="M12 3l7 3v5.5c0 4.5-3 7.7-7 9.5-4-1.8-7-5-7-9.5V6z" />
    <path d="M12 8.3l1.1 2.3 2.5.35-1.8 1.75.4 2.5-2.2-1.2-2.2 1.2.4-2.5-1.8-1.75 2.5-.35z" />
  </Svg>
);

/** Niñez y familia — dos figuras de la mano. */
export const IconoNinezFamilia = (p: Props) => (
  <Svg {...p}>
    <circle cx="8" cy="6" r="2.5" />
    <path d="M3.5 19v-1.5A4 4 0 0 1 8 13.5a4 4 0 0 1 3 1.4" />
    <circle cx="17" cy="9" r="1.8" />
    <path d="M13.5 19v-1.2a3 3 0 0 1 3.5-3 3 3 0 0 1 3.5 3V19" />
    <path d="M10.3 16.5l1.2 1.2" />
  </Svg>
);

/** Salud mental — cabeza de perfil con pulso. */
export const IconoSaludMental = (p: Props) => (
  <Svg {...p}>
    <path d="M8 20v-2.5c-2.5-1.3-4-3.7-4-6.5a7 7 0 0 1 14 0c0 1-.3 1.9-.8 2.7l.8 3.3-3.3-.6c-.6.3-1.2.5-1.9.6V20z" />
    <path d="M6 11h2.2l1-2 1.6 4 1-2H14" />
  </Svg>
);

/** Salud — cruz médica dentro de un contenedor redondeado. */
export const IconoSalud = (p: Props) => (
  <Svg {...p}>
    <rect x="3.5" y="3.5" width="17" height="17" rx="4" />
    <path d="M12 8v8M8 12h8" />
  </Svg>
);

/** Bomberos — casco de bombero. */
export const IconoBomberos = (p: Props) => (
  <Svg {...p}>
    <path d="M4 14.5A8 8 0 0 1 12 7a8 8 0 0 1 8 7.5" />
    <path d="M3 14.5h18v1.5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    <path d="M12 7V4M12 4c-1.2 0-1.9 1-1.6 2" />
    <path d="M9 18v1.5M15 18v1.5" />
  </Svg>
);

/** Institucional — edificio con techo y puerta. */
export const IconoInstitucional = (p: Props) => (
  <Svg {...p}>
    <path d="M4 10l8-6 8 6" />
    <path d="M5.5 9.5V20h13V9.5" />
    <path d="M10 20v-5h4v5" />
  </Svg>
);

/** Convivencia — apretón de manos. */
export const IconoConvivencia = (p: Props) => (
  <Svg {...p}>
    <path d="M2.5 12l3.5-3 3 2 2.5-2 3 2 3.5-3 3.5 3-3.5 3.5-1.7-1.2" />
    <path d="M9 11l3 2.7a1.4 1.4 0 0 1-1.9 2l-.3-.25" />
    <path d="M12 13.5l1.6 1.4a1.3 1.3 0 0 1-1.7 1.9" />
    <path d="M10.3 17.2a1.2 1.2 0 0 1-1.6 1.7l-1-.9" />
  </Svg>
);

/** Evaluación — hoja con marca de verificación. */
export const IconoEvaluacion = (p: Props) => (
  <Svg {...p}>
    <path d="M6 3.5h9l3.5 3.5V20a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1z" />
    <path d="M15 3.5V7h3.5" />
    <path d="M8.5 13.5l2 2 4-4.2" />
  </Svg>
);

/** Genérico, por si aparece una sección nueva sin icono propio. */
export const IconoGenerico = (p: Props) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 8v4l2.5 2.5" />
  </Svg>
);

/**
 * Icono + color de acento por sección. El color se usa para el trazo, el
 * fondo tintado de la baldosa y el resplandor: un solo tono por sección.
 */
export const NEON_NAV: Record<
  string,
  { Icono: (p: Props) => React.ReactElement; color: string }
> = {
  disponibilidad: { Icono: IconoReservar,   color: '#22d3ee' }, // cian
  historial:      { Icono: IconoHistorial,  color: '#a78bfa' }, // violeta
  admin:          { Icono: IconoPanel,      color: '#fb923c' }, // naranja
  rectora:        { Icono: IconoRectoria,   color: '#fbbf24' }, // dorado
  horario:        { Icono: IconoHorario,    color: '#60a5fa' }, // azul
  asignacion:     { Icono: IconoAsignacion, color: '#34d399' }, // verde menta
  tareas:         { Icono: IconoTareas,     color: '#a3e635' }, // lima
  agenda:         { Icono: IconoAgenda,     color: '#f472b6' }, // rosa
  riesgo:         { Icono: IconoRiesgo,     color: '#f87171' }, // rojo coral
  asistentes:     { Icono: IconoAsistentes, color: '#c084fc' }, // púrpura
  admin_users:    { Icono: IconoUsuarios,   color: '#38bdf8' }, // celeste
  chat:           { Icono: IconoChat,       color: '#2dd4bf' }, // turquesa
  sugerencias:    { Icono: IconoSugerencias, color: '#fde047' }, // amarillo
  asistencia:     { Icono: IconoAsistencia, color: '#4ade80' }, // verde esmeralda
};

export function neonDe(id: string) {
  return NEON_NAV[id] ?? { Icono: IconoGenerico, color: '#94a3b8' };
}
