// Alerta diaria de inactividad del Plan Académico Especial (lógica pura, sin Firestore).
// La usa la función programada `planCasaAlertaInactividad` (functions-notificaciones) y se
// prueba aparte. Sin imports de navegador ni de firebase-admin.
// Privacidad: solo primer nombre, grupo y días; nunca apellidos, motivo ni salud.

export const DIAS_ALERTA = 7;
export const TITULO_ALERTA_INACTIVIDAD = 'Plan Académico Especial · Sin entregas';

export interface PlanParaAlerta {
  id: string;
  nombres: string;
  grupo: string;
  desde: string; // YYYY-MM-DD
  hasta: string;
  estado: string;
  enEspera?: unknown;
  alertaInactividad?: { en: number; dias: number };
  /** max(entregas.creadoEn) en ms, o null si no hay ninguna. */
  ultimaEntregaMs: number | null;
}

export interface AlertaInactividad {
  planId: string;
  primerNombre: string;
  grupo: string;
  jornada: 'manana' | 'tarde';
  dias: number;
}

const MS_DIA = 86400000;
const diaBogota = (ms: number) => new Date(ms - 5 * 3600000).toISOString().slice(0, 10);
const parse = (f: string) => { const [y, m, d] = f.split('-').map(Number); return Date.UTC(y, m - 1, d); };
const dias = (a: string, b: string) => Math.round((parse(b) - parse(a)) / MS_DIA);

export const jornadaDelGrupo = (grupo: string): 'manana' | 'tarde' => (grupo.includes('º') ? 'tarde' : 'manana');

export const primerNombreDe = (nombres: string): string => String(nombres ?? '').trim().split(/\s+/)[0] ?? '';

/**
 * Planes a alertar hoy: activos, sin «en espera», dentro de su rango de fechas, con 7+ días
 * sin entregar (desde la última entrega o, si no hay, desde `desde`) y sin alerta vigente:
 * la última alerta es anterior a la última entrega, o ya pasaron 7 días desde ella.
 */
export function planesAAlertar(planes: PlanParaAlerta[], hoy: string, ahoraMs: number): AlertaInactividad[] {
  const salida: AlertaInactividad[] = [];
  for (const p of planes) {
    if (p.estado !== 'activo' || p.enEspera) continue;
    if (!(p.desde <= hoy && hoy <= p.hasta)) continue;
    const base = p.ultimaEntregaMs ? diaBogota(p.ultimaEntregaMs) : p.desde;
    const d = dias(base, hoy);
    if (d < DIAS_ALERTA) continue;
    const a = p.alertaInactividad;
    const vigente = !!a && a.en >= (p.ultimaEntregaMs ?? 0) && dias(diaBogota(a.en), diaBogota(ahoraMs)) < DIAS_ALERTA;
    if (vigente) continue;
    salida.push({ planId: p.id, primerNombre: primerNombreDe(p.nombres), grupo: p.grupo, jornada: jornadaDelGrupo(p.grupo), dias: d });
  }
  return salida;
}

export interface CoordinadorMin { correo: string; jornada?: string | null }

/** Equipo ∪ coordinadores de la jornada (o de «ambas»), en minúsculas y sin repetidos. */
export function destinatariosAlerta(jornada: 'manana' | 'tarde', equipo: string[], coordinadores: CoordinadorMin[]): string[] {
  const coords = coordinadores.filter(c => c.jornada === jornada || c.jornada === 'ambas').map(c => c.correo);
  return [...new Set([...equipo, ...coords].map(c => String(c ?? '').trim().toLowerCase()).filter(Boolean))];
}

export function cuerpoAlertaInactividad(a: Pick<AlertaInactividad, 'primerNombre' | 'grupo' | 'dias'>): string {
  const quien = a.grupo ? `${a.primerNombre} (${a.grupo})` : a.primerNombre;
  return `${quien} lleva ${a.dias} días sin entregar en su plan. Por favor contacten a la familia.`;
}

/** destinatario → alertas que le corresponden (para una sola llamada de correo por corrida). */
export function agruparPorDestinatario(
  alertas: AlertaInactividad[], equipo: string[], coordinadores: CoordinadorMin[],
): Map<string, AlertaInactividad[]> {
  const mapa = new Map<string, AlertaInactividad[]>();
  for (const a of alertas) {
    for (const c of destinatariosAlerta(a.jornada, equipo, coordinadores)) {
      mapa.set(c, [...(mapa.get(c) ?? []), a]);
    }
  }
  return mapa;
}
