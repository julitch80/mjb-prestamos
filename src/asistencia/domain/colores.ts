/**
 * Color identificativo por grupo. Ayuda visual, nunca la unica pista.
 *
 * PARA QUE SIRVE: un docente con cinco grupos abiertos necesita saber en cual esta sin
 * leer. El color se lo dice de un vistazo. Pero el nombre del grupo sigue escrito al
 * lado SIEMPRE: hay docentes que no distinguen ciertos colores, y una interfaz donde el
 * color sea el unico indicio los deja fuera.
 *
 * PALETA CERRADA, no selector libre. Dos razones:
 *   - El contrato prohibe introducir otro sistema de color en MJB. Estos ocho tonos son
 *     los que MJB ya usa para identificar docentes en `maestros.ts`; no se inventa nada.
 *   - Con un selector libre alguien acaba eligiendo un amarillo que no se ve en modo
 *     claro o un azul que desaparece en el oscuro. Ocho tonos probados no fallan.
 *
 * DONDE SE GUARDA: en el dispositivo (`localStorage`). Es una preferencia visual, no un
 * dato del colegio. Guardarla en Firestore obligaria a tocar permisos, y no se justifica
 * para algo estetico. Si algun dia se quiere que siga al usuario entre dispositivos, se
 * cambia SOLO `leerMapa`/`guardarMapa`: el resto de este modulo no se entera.
 */

export interface ColorGrupo {
  id: string;
  nombre: string;
  /** Tono base. Los estilos derivados salen de aqui, no se escriben a mano. */
  hex: string;
}

/** Los mismos tonos que MJB usa para los docentes. */
export const COLORES_GRUPO: ColorGrupo[] = [
  { id: 'teal', nombre: 'Verde azulado', hex: '#14b8a6' },
  { id: 'sky', nombre: 'Azul cielo', hex: '#0ea5e9' },
  { id: 'indigo', nombre: 'Añil', hex: '#6366f1' },
  { id: 'violet', nombre: 'Violeta', hex: '#8b5cf6' },
  { id: 'rose', nombre: 'Rosa', hex: '#f43f5e' },
  { id: 'amber', nombre: 'Ámbar', hex: '#eab308' },
  { id: 'lime', nombre: 'Verde', hex: '#84cc16' },
  { id: 'orange', nombre: 'Naranja', hex: '#f97316' },
];

const CLAVE_ALMACEN = 'asistencia.coloresGrupo';

/**
 * Clave de un cruce grado+asignatura.
 *
 * El separador es `|` porque los grados llevan punto y ordinal masculino (`9.1`, `6º1`)
 * y no se pueden sanear: la `º` es lo que distingue la jornada. Con `|` no hay choque.
 */
export function claveCruce(grado: string, subjectId: string): string {
  return `${grado}|${subjectId}`;
}

export type MapaColores = Record<string, string>;

/**
 * Color asignado a un cruce, o `null` si no tiene.
 *
 * Devuelve null tambien cuando el id guardado ya no existe en la paleta —puede pasar si
 * la paleta cambia—, en vez de romper o inventar un color.
 */
export function resolverColor(
  mapa: MapaColores,
  grado: string,
  subjectId: string,
): ColorGrupo | null {
  const id = mapa[claveCruce(grado, subjectId)];
  return COLORES_GRUPO.find((c) => c.id === id) ?? null;
}

export function leerMapa(): MapaColores {
  try {
    const crudo = localStorage.getItem(CLAVE_ALMACEN);
    const dato = crudo ? JSON.parse(crudo) : {};
    // Sin este filtro, un valor corrupto en el almacen local rompe la planilla entera.
    return dato && typeof dato === 'object' && !Array.isArray(dato) ? (dato as MapaColores) : {};
  } catch {
    return {};
  }
}

export function guardarColor(
  mapa: MapaColores,
  grado: string,
  subjectId: string,
  colorId: string | null,
): MapaColores {
  const siguiente = { ...mapa };
  if (colorId) siguiente[claveCruce(grado, subjectId)] = colorId;
  else delete siguiente[claveCruce(grado, subjectId)];
  try {
    localStorage.setItem(CLAVE_ALMACEN, JSON.stringify(siguiente));
  } catch {
    // Modo privado o almacen lleno: se pierde la preferencia, no la sesion de trabajo.
  }
  return siguiente;
}

/**
 * Estilos derivados del tono. Se calculan aqui y no en cada pantalla para que el color
 * se aplique igual en todas partes, y para que quien lo use no tenga que decidir opacidades.
 *
 * `color-mix` es lo que permite que el mismo tono funcione en claro y en oscuro: el fondo
 * se mezcla con transparente, no con blanco ni con negro, asi que se apoya en el fondo
 * real del tema en vez de imponer uno.
 */
export function estiloBorde(c: ColorGrupo | null): React.CSSProperties {
  return c ? { borderColor: c.hex } : {};
}

export function estiloEtiqueta(c: ColorGrupo | null): React.CSSProperties {
  if (!c) return {};
  return {
    color: c.hex,
    backgroundColor: `color-mix(in srgb, ${c.hex} 14%, transparent)`,
    borderColor: `color-mix(in srgb, ${c.hex} 45%, transparent)`,
  };
}

/** Anillo alrededor de la foto. Va por `boxShadow` para no alterar el tamano del circulo. */
export function estiloAnillo(c: ColorGrupo | null): React.CSSProperties {
  return c ? { boxShadow: `0 0 0 2px ${c.hex}` } : {};
}
