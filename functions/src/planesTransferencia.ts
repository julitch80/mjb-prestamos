// Transferencia de planes académicos especiales (plan en casa) entre docentes en un
// reemplazo temporal. Parte pura (testeable); la parte con Firestore está en reemplazoTemporal.ts.
// NO se reescribe `docenteId` (es el puesto, que no cambia) ni `vistosBuenos` (historial de
// quién aprobó: el reemplazo da el suyo cuando le toque).

const minus = (s: unknown) => (typeof s === 'string' ? s.trim().toLowerCase() : '');

/** Cambia `de` por `a` en una lista de correos (sin duplicar). null si no hay nada que cambiar. */
export function reemplazarCorreo(lista: unknown, de: string, a: string): string[] | null {
  if (!Array.isArray(lista)) return null;
  const d = minus(de);
  if (!lista.some((c) => minus(c) === d)) return null;
  const out: string[] = [];
  for (const c of lista) {
    const v: string = minus(c) === d ? minus(a) : String(c);
    if (!out.some((x) => minus(x) === minus(v))) out.push(v);
  }
  return out;
}

export interface CamposPlan { docentesCorreos?: string[] }
export interface CamposAsignatura { docenteCorreo?: string }
export interface CamposGuia { responsableCorreo?: string; docentesCorreos?: string[] }

export function cambiosPlan(plan: Record<string, unknown>, de: string, a: string): CamposPlan | null {
  const l = reemplazarCorreo(plan.docentesCorreos, de, a);
  return l ? { docentesCorreos: l } : null;
}

export function cambiosAsignatura(asig: Record<string, unknown>, de: string, a: string): CamposAsignatura | null {
  return minus(asig.docenteCorreo) === minus(de) ? { docenteCorreo: minus(a) } : null;
}

export function cambiosGuia(guia: Record<string, unknown>, de: string, a: string): CamposGuia | null {
  const out: CamposGuia = {};
  if (minus(guia.responsableCorreo) === minus(de)) out.responsableCorreo = minus(a);
  const l = reemplazarCorreo(guia.docentesCorreos, de, a);
  if (l) out.docentesCorreos = l;
  return Object.keys(out).length ? out : null;
}
