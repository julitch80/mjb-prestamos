// Dosificación de entregas de planes ya publicados. Parte PURA (planificar) + parte con efectos
// (dosificarPlan). La fecha del docente es solo SUGERIDA: se reparte para no pasar el tope diario.
import { armarAprobacion, fusionarReacomodos } from './completarPlan';
import { diasSobreTope, esPasoEntrega } from './logica';
import type { AsignaturaPlan, FechaISO, GuiaPlan, PasoGuia, PlanCasa, ReacomodoEntrega } from './tipos';

/** Devuelve la guía con las entregas ya reacomodadas en su fecha SUGERIDA original (para repartir de nuevo desde cero). */
function conSugeridas(g: GuiaPlan): GuiaPlan {
  if (!g.aprobada || !g.reacomodos?.length) return g;
  const porId = new Map(g.reacomodos.map(r => [r.pasoId, r]));
  const pasos = g.aprobada.pasos.map(p => { const r = porId.get(p.id); return r && p.fecha === r.final && esPasoEntrega(p) ? { ...p, fecha: r.sugerida } : p; });
  return { ...g, aprobada: { ...g.aprobada, pasos } };
}

export interface CambioDosificacion { guiaId: string; pasos: PasoGuia[]; reacomodos: ReacomodoEntrega[] }
export interface PlanDosificacion {
  /** Guías que cambian (pasos nuevos de la aprobada y reacomodos vigentes). Vacío = nada que hacer. */
  cambios: CambioDosificacion[];
  /** Estado final de todas las guías (para encadenar o medir). */
  guias: GuiaPlan[];
  sobreAntes: number;
  sobreDespues: number;
  /** Entregas con fecha final distinta de la sugerida, ya vigentes tras el reparto. */
  reacomodadas: number;
  /** Fechas que cambiaron respecto de lo publicado. */
  fechasCambiadas: number;
}

const fechasDe = (gs: GuiaPlan[]) => new Map(gs.flatMap(g => (g.aprobada?.pasos ?? []).map(p => [`${g.id}/${p.id}`, p.fecha] as const)));
const pasosAprobados = (gs: GuiaPlan[]) => gs.flatMap(g => g.aprobada?.pasos ?? []);

/** Calcula, sin escribir nada, cómo quedan las entregas de un plan al dosificarlas. Idempotente. */
export function planificarDosificacion(
  plan: Pick<PlanCasa, 'desde' | 'hasta' | 'topeDiario' | 'ritmo' | 'cierreEdicion'>,
  asigs: AsignaturaPlan[], guiasIni: GuiaPlan[], nombre: (id: string) => string, hoy: FechaISO,
): PlanDosificacion {
  const antes = fechasDe(guiasIni);
  const sobreAntes = diasSobreTope(pasosAprobados(guiasIni), plan.topeDiario).length;
  let guias = guiasIni.map(g => ({ ...g }));
  for (const id of guiasIni.filter(g => g.aprobada).map(g => g.id)) {
    const restauradas = guias.map(conSugeridas);
    const g = restauradas.find(x => x.id === id)!;
    const propias = asigs.filter(a => g.asignaturaIds.includes(a.asignaturaId));
    const r = armarAprobacion({ plan, guia: g, borrador: g.aprobada!, todas: restauradas, propias, nombre, hoy });
    guias = guias.map(x => {
      const nuevos = x.id === id ? r.aprobada.pasos : r.repartidas[x.id];
      if (!x.aprobada || !nuevos) return x;
      const reac = fusionarReacomodos(x.reacomodos, r.reacomodos[x.id] ?? [], nuevos, 0);
      return { ...x, aprobada: { ...x.aprobada, pasos: nuevos }, ...(reac.length || x.reacomodos ? { reacomodos: reac } : {}) };
    });
  }
  // Cambia una guía solo si su estado FINAL difiere del publicado (los pasos intermedios no cuentan).
  const tocadas = new Set(guias.filter(x => JSON.stringify(x) !== JSON.stringify(guiasIni.find(y => y.id === x.id))).map(x => x.id));
  const despues = fechasDe(guias);
  let fechasCambiadas = 0;
  for (const [k, f] of despues) if (antes.get(k) !== f) fechasCambiadas++;
  const cambios = guias.filter(g => tocadas.has(g.id)).map(g => ({ guiaId: g.id, pasos: g.aprobada!.pasos, reacomodos: g.reacomodos ?? [] }));
  return {
    cambios, guias, sobreAntes, sobreDespues: diasSobreTope(pasosAprobados(guias), plan.topeDiario).length,
    reacomodadas: guias.reduce((n, g) => n + (g.reacomodos?.length ?? 0), 0), fechasCambiadas,
  };
}
