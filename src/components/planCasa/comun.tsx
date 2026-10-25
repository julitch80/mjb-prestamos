// Piezas compartidas del módulo «Plan en casa».
import { useState, type ReactNode } from 'react';
import { AlertTriangle, FileDown, Printer, Loader2, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { AsignaturaPlan, GuiaPlan, FechaISO, PasoGuia, RitmoPlan } from '../../data/planCasa/tipos';
import { sugerirPreguntas, type PreguntaSugerida } from '../../data/planCasa/persistencia';
import { repartirPasos } from '../../data/planCasa/logica';
import { abrirImprimibleGuia, construirHtmlCuadernillo } from '../../data/planCasa/imprimibleGuia';
import { abrirImprimibleUAI, construirHtmlUAI, type PlanParaUAI } from '../../data/planCasa/imprimibleUAI';

export const CLASE_INPUT =
  'w-full px-3 py-2.5 rounded-xl bg-elevated border border-line text-sm text-strong placeholder:text-muted focus:outline-none focus:border-line-strong';
export const CLASE_BOTON =
  'inline-flex items-center justify-center gap-1.5 text-sm font-medium px-4 py-2.5 rounded-xl bg-accent text-strong hover:opacity-90 disabled:opacity-40 transition';
export const CLASE_BOTON_SEC =
  'inline-flex items-center justify-center gap-1.5 text-sm font-medium px-4 py-2.5 rounded-xl bg-elevated text-soft hover:text-strong disabled:opacity-40 transition';

export function Etiqueta({ children }: { children: ReactNode }) {
  return <label className="block text-xs font-medium text-soft mb-1">{children}</label>;
}

export function CajaError({ children }: { children: ReactNode }) {
  return (
    <div role="alert" className="flex items-start gap-2 rounded-xl bg-danger-soft text-danger-soft-fg text-sm p-3">
      <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
      <span className="min-w-0">{children}</span>
    </div>
  );
}

export function Cargando({ texto }: { texto: string }) {
  return (
    <p className="flex items-center gap-2 text-sm text-soft">
      <Loader2 size={16} className="animate-spin" />{texto}
    </p>
  );
}

export function fechaCorta(iso: FechaISO | null | undefined): string {
  if (!iso) return 'sin fecha';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

// ── Tablero (por guía y por asignatura) ───────────────────────────────────

export interface ResumenGuia {
  guia: boolean;      // aprobada
  avance: number;     // 0–100 de pasos entregados o revisados
  pasosTotal: number;
  sustentacion: 'sin_guia' | 'sin_citar' | 'citada' | 'sustentada';
  vistos: number;     // vistos buenos dados
  vistosTotal: number;
}

export function resumenGuia(g: GuiaPlan): ResumenGuia {
  const pasos = g.aprobada?.pasos ?? [];
  const hechos = pasos.filter(p => (g.seguimiento?.[p.id]?.estado ?? 'pendiente') !== 'pendiente').length;
  return {
    guia: !!g.aprobada, pasosTotal: pasos.length,
    avance: pasos.length ? Math.round((hechos / pasos.length) * 100) : 0,
    sustentacion: g.aprobada ? g.sustentacionEstado : 'sin_guia',
    vistos: g.docentesCorreos.filter(c => g.vistosBuenos?.[c]).length,
    vistosTotal: g.docentesCorreos.length,
  };
}

export const criteriosPuestos = (a: AsignaturaPlan) => a.criteriosPromocion.trim().length > 0;

export const TEXTO_SUSTENTACION: Record<ResumenGuia['sustentacion'], string> = {
  sin_guia: '—', sin_citar: 'Sin citar', citada: 'Citada', sustentada: 'Sustentada',
};

export function Marca({ ok, etiqueta }: { ok: boolean; etiqueta: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full',
      ok ? 'bg-success-soft text-success-soft-fg' : 'bg-warning-soft text-warning-soft-fg')}>
      <span aria-hidden>{ok ? '✓' : '✗'}</span>{etiqueta}
    </span>
  );
}

// ── Formato UAI ───────────────────────────────────────────────────────────

/** Botón «Descargar en formato UAI»: abre el documento imprimible (Guardar como PDF desde el diálogo). */
export function BotonFormatoUAI({ plan, guias, asigs, nombres }: {
  plan: PlanParaUAI; guias: GuiaPlan[]; asigs: AsignaturaPlan[]; nombres: Record<string, { asignatura: string; docente: string }>;
}) {
  const html = construirHtmlUAI(plan, guias, asigs, nombres);
  return (
    <button onClick={() => abrirImprimibleUAI(html)} disabled={!html} className={CLASE_BOTON_SEC}
      title={html ? 'Abre el formato para imprimir o guardar como PDF' : 'Aún no hay una guía con propuesta'}>
      <FileDown size={15} />Descargar en formato UAI
    </button>
  );
}

/** «Imprimir cuadernillo (versión PDF)»: un solo documento con todas las guías aprobadas. Sale en todos los planes; en los sin tecnología es el material principal. */
export function BotonCuadernillo({ plan, guias, nombres }: {
  plan: Parameters<typeof construirHtmlCuadernillo>[0] & { sinTecnologia?: boolean }; guias: GuiaPlan[]; nombres: Record<string, { asignatura: string; docente: string }>;
}) {
  const html = construirHtmlCuadernillo(plan, guias, nombres);
  const pendientes = guias.filter(g => !g.aprobada).flatMap(g => g.asignaturaIds.map(id => nombres[id]?.asignatura ?? id));
  return (
    <div className="space-y-1">
      <button onClick={() => abrirImprimibleGuia(html)} disabled={!html} className={CLASE_BOTON_SEC}
        title={html ? 'Abre el cuadernillo para imprimir o guardar como PDF' : 'Aún no hay guías aprobadas'}>
        <Printer size={15} />Imprimir cuadernillo (versión PDF)
      </button>
      {!plan.sinTecnologia && <p className="text-[11px] text-muted">Versión impresa opcional: los enlaces y archivos de la agenda no salen en papel.</p>}
      {pendientes.length > 0 && <p className="text-[11px] text-muted">Falta aprobar (no entran al cuadernillo): {pendientes.join(', ')}.</p>}
    </div>
  );
}

// ── Reparto de fechas ─────────────────────────────────────────────────────

/**
 * Reparte los pasos de TODAS las guías aprobadas del plan en días hábiles sin pasar el
 * tope diario (suma de momentos entre asignaturas). Respeta las fechas ya puestas.
 * Devuelve guiaId → pasos con fecha, y los avisos de lo que no cupo.
 */
export function repartirTodas(
  plan: { desde: FechaISO; hasta: FechaISO; topeDiario: number; ritmo?: RitmoPlan },
  guias: { guiaId: string; pasos: PasoGuia[] }[],
): { pasos: Record<string, PasoGuia[]>; avisos: string[] } {
  const r = repartirPasos(guias, plan.desde, plan.hasta, plan.topeDiario, hoyLocal(), plan.ritmo ?? 'diario');
  return { pasos: Object.fromEntries(r.asignaturas.map(g => [g.guiaId, g.pasos])), avisos: r.avisos };
}

function hoyLocal(): FechaISO {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// ── Ayudante «Sugerir preguntas orientadoras» ─────────────────────────────

export function SugerirPreguntas({ asignaturas, grado, ajustes, onUsar }: {
  asignaturas: string[]; grado: string; ajustes: string[]; onUsar: (pregunta: string) => void;
}) {
  const [tematica, setTematica] = useState('');
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  const [lista, setLista] = useState<PreguntaSugerida[]>([]);

  async function pedir() {
    if (!asignaturas.length) return setError('No hay asignaturas en la guía.');
    setError(''); setCargando(true);
    try { setLista(await sugerirPreguntas({ tematica: tematica.trim(), asignaturas, grado, ajustes })); }
    catch (e) { setError((e as Error).message || 'No se pudieron generar las sugerencias.'); }
    finally { setCargando(false); }
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <input value={tematica} onChange={e => setTematica(e.target.value)} placeholder="Temática (opcional): ej. el agua en mi barrio" className={CLASE_INPUT} />
        <button onClick={pedir} disabled={cargando} className={cn(CLASE_BOTON_SEC, 'flex-shrink-0')}>
          <Sparkles size={14} />{cargando ? 'Pensando…' : lista.length ? 'Otras preguntas' : 'Sugerir preguntas'}
        </button>
      </div>
      {error && <p className="text-xs text-danger">{error}</p>}
      {lista.length > 0 && (
        <ul className="space-y-2">
          {lista.map((p, k) => (
            <li key={k} className="rounded-xl bg-elevated p-3 space-y-1.5">
              <p className="text-sm font-semibold text-strong">{p.pregunta}</p>
              {p.porQue && <p className="text-xs text-soft">{p.porQue}</p>}
              {p.aportes.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {p.aportes.map(a => <span key={a.asignatura} className="text-[11px] px-2 py-0.5 rounded-full bg-card text-soft">{a.asignatura}: {a.aporte}</span>)}
                </div>
              )}
              {p.producto && <p className="text-xs text-muted">Producto: {p.producto}</p>}
              <button onClick={() => { onUsar(p.pregunta); setLista([]); }} className={CLASE_BOTON_SEC}>Usar esta</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

