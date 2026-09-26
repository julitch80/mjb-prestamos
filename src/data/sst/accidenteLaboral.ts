// Lógica pura del módulo "Accidente laboral" (Etapa 1 —
// docs/accidente-laboral/PRD.md, aprobado 26-sep-2026). SIN imports de
// navegador ni de firebase-admin: la usa tanto el cliente (componente React)
// como la función `alNuevoAccidente` (functions-notificaciones), igual que
// notificacionesPushLogica.ts.

export type TipoPersonaAccidente = 'docente' | 'administrativo' | 'contratista';

export type EstadoAccidenteDocente =
  | 'reportado' | 'furat_radicado' | 'en_investigacion' | 'cerrado';
export type EstadoAccidenteOtro = 'reportado' | 'en_investigacion' | 'cerrado';

const HORAS_FURAT = 48;
const UMBRAL_AMBAR_HORAS = 24;
const UMBRAL_ROJO_HORAS = 40;
const DIAS_ALERTA_INVESTIGACION = 15;

/** Hora límite del FURAT: fechaHora del accidente + 48 h, en ISO. */
export function horaLimiteFurat(fechaHoraISO: string): string {
  const limite = new Date(fechaHoraISO).getTime() + HORAS_FURAT * 60 * 60 * 1000;
  return new Date(limite).toISOString();
}

export type EstadoCuentaRegresiva = 'normal' | 'ambar' | 'rojo' | 'vencido';

/**
 * Estado visual de la cuenta regresiva del FURAT, a partir de las horas
 * transcurridas desde el accidente (bordes: 24 h ámbar, 40 h rojo, 48 h
 * vencido). `ahoraISO` es inyectable para que las pruebas no dependan del
 * reloj real.
 */
export function estadoCuentaRegresivaFurat(fechaHoraISO: string, ahoraISO: string): EstadoCuentaRegresiva {
  const horasTranscurridas =
    (new Date(ahoraISO).getTime() - new Date(fechaHoraISO).getTime()) / (60 * 60 * 1000);
  if (horasTranscurridas >= HORAS_FURAT) return 'vencido';
  if (horasTranscurridas >= UMBRAL_ROJO_HORAS) return 'rojo';
  if (horasTranscurridas >= UMBRAL_AMBAR_HORAS) return 'ambar';
  return 'normal';
}

/** Horas restantes hasta el límite del FURAT (puede ser negativo si venció). */
export function horasRestantesFurat(fechaHoraISO: string, ahoraISO: string): number {
  const horasTranscurridas =
    (new Date(ahoraISO).getTime() - new Date(fechaHoraISO).getTime()) / (60 * 60 * 1000);
  return HORAS_FURAT - horasTranscurridas;
}

/** true si ya pasaron más de 15 días desde el accidente sin cerrar la
 * investigación (para la alerta de `alertasAccidentes`). */
export function debeAlertarInvestigacion(fechaHoraISO: string, ahoraISO: string, estado: string): boolean {
  if (estado === 'cerrado') return false;
  const dias = (new Date(ahoraISO).getTime() - new Date(fechaHoraISO).getTime()) / (24 * 60 * 60 * 1000);
  return dias >= DIAS_ALERTA_INVESTIGACION;
}

// ── Destinatarios de un caso nuevo (responsables) ───────────────────────────

export interface UsuarioResponsableAccidente {
  correo: string;
  role: string;
  active: boolean;
}

/** Correos (en minúsculas) de rectora/coordinadores activos + representantes
 * del COPASST, sin duplicados y sin el autor del reporte. */
export function destinatariosAccidente(
  usuariosActivos: UsuarioResponsableAccidente[],
  copasstCorreos: string[],
  autorCorreo: string,
): string[] {
  const autorLower = autorCorreo.toLowerCase();
  const deRoles = usuariosActivos
    .filter(u => u.active && (u.role === 'rectora' || u.role === 'coordinador'))
    .map(u => u.correo.toLowerCase());
  const deCopasst = copasstCorreos.map(c => c.toLowerCase());
  const todos = [...new Set([...deRoles, ...deCopasst])];
  return todos.filter(c => c !== autorLower);
}

// ── Borrador del FURAT (modo / tiempo / lugar), SIN cédula ──────────────────

export interface DatosBorradorFurat {
  tipoPersona: TipoPersonaAccidente;
  nombrePersona: string;
  fechaHora: string;
  lugar: string;
  queHacia: string;
  comoOcurrio: string;
  lesionAparente: string;
  partesCuerpo?: string;
  testigos?: string;
  atencionRecibida: boolean;
  atencionDonde?: string;
}

/**
 * Texto ordenado modo / tiempo / lugar para copiar y pegar en HORUS. La
 * cédula NUNCA aparece aquí: se digita directamente en HORUS al radicar.
 */
export function borradorFurat(datos: DatosBorradorFurat): string {
  const fecha = new Date(datos.fechaHora);
  const fechaTexto = fecha.toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' });
  const horaTexto = fecha.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
  const lineas = [
    `Trabajador: ${datos.nombrePersona}`,
    '',
    'MODO (qué hacía y cómo ocurrió):',
    `${datos.queHacia}`,
    `${datos.comoOcurrio}`,
    '',
    'TIEMPO:',
    `${fechaTexto}, ${horaTexto}`,
    '',
    'LUGAR:',
    `${datos.lugar}`,
    '',
    `Lesión aparente: ${datos.lesionAparente}`,
  ];
  if (datos.partesCuerpo) lineas.push(`Partes del cuerpo afectadas: ${datos.partesCuerpo}`);
  if (datos.testigos) lineas.push(`Testigos: ${datos.testigos}`);
  lineas.push(`Atención: ${datos.atencionRecibida ? `Sí, en ${datos.atencionDonde || 'sitio no especificado'}` : 'No recibida aún'}`);
  lineas.push('', 'Nota: la cédula del trabajador se digita directamente en HORUS al radicar.');
  return lineas.join('\n');
}

// ── Evidencias (fotos y documentos escaneados) ──────────────────────────────

/** Tipos de contenido admitidos para una evidencia (espeja storage.rules). */
export const TIPOS_EVIDENCIA_VALIDOS = [
  'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf',
] as const;

export const TAMANO_MAXIMO_EVIDENCIA_BYTES = 10 * 1024 * 1024; // 10 MB

/** true si el contentType es uno de los admitidos para evidencias. */
export function esTipoEvidenciaValido(contentType: string): boolean {
  return (TIPOS_EVIDENCIA_VALIDOS as readonly string[]).includes(contentType);
}

/** true si el tamaño (bytes) está dentro del límite de evidencias. */
export function esTamanoEvidenciaValido(bytes: number): boolean {
  return bytes > 0 && bytes < TAMANO_MAXIMO_EVIDENCIA_BYTES;
}

/**
 * Dimensiones de destino para comprimir una imagen antes de subirla como
 * evidencia: conserva la proporción y limita el lado mayor a `ladoMaximo`
 * (1600 px por defecto). Si la imagen ya es más chica, no se agranda.
 */
export function dimensionesComprimidas(
  anchoOriginal: number,
  altoOriginal: number,
  ladoMaximo = 1600,
): { width: number; height: number } {
  if (anchoOriginal <= 0 || altoOriginal <= 0) return { width: anchoOriginal, height: altoOriginal };
  const ladoMayor = Math.max(anchoOriginal, altoOriginal);
  if (ladoMayor <= ladoMaximo) return { width: anchoOriginal, height: altoOriginal };
  const factor = ladoMaximo / ladoMayor;
  return {
    width: Math.round(anchoOriginal * factor),
    height: Math.round(altoOriginal * factor),
  };
}

// ── "Mis reportes": fusión de casos reportados + casos donde soy la persona ──

/**
 * Fusiona dos listas de casos (reportados por mí + casos donde soy la
 * persona accidentada) sin duplicar por id. Se usa porque son dos consultas
 * Firestore separadas (no se puede hacer OR de dos campos distintos con
 * where()).
 */
export function fusionarCasosSinDuplicar<T extends { id: string }>(a: T[], b: T[]): T[] {
  const porId = new Map<string, T>();
  for (const c of [...a, ...b]) porId.set(c.id, c);
  return [...porId.values()];
}
