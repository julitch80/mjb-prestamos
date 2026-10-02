// Lógica pura de «Mi ubicación».

export interface Posicion { lat: number; lng: number; precisionM: number }

/** Direcciones fijas de las sedes del colegio. */
// TODO: dirección por confirmar. No existe en el repositorio; completar con rectoría.
export const DIRECCIONES_SEDES: { sede: string; direccion: string }[] = [
  { sede: 'Sede Central (I.E. Manuel J. Betancur)', direccion: 'dirección por confirmar' },
  { sede: 'Sede Gustavo Rodas Isaza', direccion: 'dirección por confirmar' },
  { sede: 'Sede La Finquita', direccion: 'dirección por confirmar' },
];

export function formatearCoordenada(n: number): string { return n.toFixed(5); }

export function enlaceMapas(p: Posicion): string {
  return `https://maps.google.com/?q=${formatearCoordenada(p.lat)},${formatearCoordenada(p.lng)}`;
}

export function textoCoordenadas(p: Posicion): string {
  return `Latitud ${formatearCoordenada(p.lat)}, longitud ${formatearCoordenada(p.lng)} (precisión aprox. ${Math.round(p.precisionM)} m)`;
}

/** Texto listo para leer al operador del 123. */
export function textoParaDictar(p: Posicion): string {
  return `Estoy en San Antonio de Prado, Medellín. Mis coordenadas son latitud ${formatearCoordenada(p.lat)} y longitud ${formatearCoordenada(p.lng)}, con una precisión de unos ${Math.round(p.precisionM)} metros. Enlace del mapa: ${enlaceMapas(p)}`;
}

/** Mensaje según el código de error de Geolocation (1 denegado, 2 no disponible, 3 tiempo). */
export function mensajeErrorUbicacion(codigo: number): string {
  if (codigo === 1) return 'Permiso de ubicación denegado. Active la ubicación del teléfono y permita el acceso para este sitio (candado o ajustes del navegador) y vuelva a intentar. Mientras tanto, diga al 123 la dirección o un punto de referencia.';
  if (codigo === 3) return 'Se agotó el tiempo sin obtener la ubicación. Salga a un lugar abierto, active el GPS e intente de nuevo.';
  return 'No se pudo obtener la ubicación. Active el GPS e intente de nuevo, o diga al 123 la dirección.';
}
