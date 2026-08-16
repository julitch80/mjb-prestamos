/**
 * Numeracion telefonica colombiana. Los datos vienen de Master2000 con formatos
 * heterogeneos (puntos, guiones, indicativo de pais segun la version del export), asi
 * que todo aqui parte de reducir al puro digito antes de clasificar.
 */

export type TipoTelefono = 'movil' | 'fijo' | 'desconocido';

export function soloDigitos(raw: string): string {
  return raw.replace(/\D/g, '');
}

/**
 * Reduce al numero nacional de 10 (o 7, para fijos antiguos) digitos, quitando el
 * indicativo de pais si vino incluido. No se toca nada mas: normalizar de mas
 * inventaria datos que Master2000 no dio.
 */
function numeroNacional(raw: string): string {
  const d = soloDigitos(raw);
  if (d.length === 12 && d.startsWith('57')) return d.slice(2);
  return d;
}

export function tipoDeTelefono(raw: string): TipoTelefono {
  const d = numeroNacional(raw);
  if (d.length === 10 && d.startsWith('3')) return 'movil';
  // Plan de numeracion vigente desde 2022: fijos nacionales de 10 digitos con
  // indicativo `60` incorporado (antes eran 7 digitos + indicativo de ciudad aparte).
  if (d.length === 10 && d.startsWith('60')) return 'fijo';
  // Fijos antiguos siguen en los datos importados, sin indicativo de ciudad: no hay
  // forma de saber a que ciudad pertenecen, asi que se aceptan tal cual.
  if (d.length === 7) return 'fijo';
  return 'desconocido';
}

/** '3001234567' -> '300 123 4567'. Para poder DICTARLO sin equivocarse. */
export function formatearTelefono(raw: string): string {
  const d = numeroNacional(raw);
  if (d.length === 10) return `${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6)}`;
  if (d.length === 7) return `${d.slice(0, 3)} ${d.slice(3)}`;
  return raw;
}

/** Enlace `tel:`. Siempre devuelve algo si hay digitos. */
export function enlaceLlamada(raw: string): string | null {
  const d = numeroNacional(raw);
  if (d.length === 10) return `tel:+57${d}`;
  // Fijo antiguo de 7 digitos: sin indicativo de ciudad no se puede construir el
  // internacional, y adivinarlo seria peor que dejar la marcacion local.
  if (d.length === 7) return `tel:${d}`;
  return null;
}

/** Enlace de WhatsApp. `null` si el numero NO es movil. */
export function enlaceWhatsApp(raw: string): string | null {
  if (tipoDeTelefono(raw) !== 'movil') return null;
  const d = numeroNacional(raw);
  return `https://wa.me/57${d}`;
}
