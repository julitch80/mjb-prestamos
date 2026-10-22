// Editor de campos de una guía (propuesta o aprobada) para el docente responsable.
// Sigue la propuesta curricular integrada por áreas (UAI): producto integrado, evidencias por área,
// fases semanales con una entrega parcial por semana, canal de entrega y modalidad de sustentación.
import { Plus, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { EvidenciaTipo, Guia, ModalidadSustentacion, PasoGuia } from '../../data/planCasa/tipos';
import { MODALIDADES_SUSTENTACION } from '../../data/planCasa/tipos';
import { CLASE_BOTON_SEC, CLASE_INPUT, Etiqueta } from './comun';

const EVIDENCIAS: EvidenciaTipo[] = ['foto', 'texto', 'audio', 'video', 'documento'];

// ── Editor de la guía (propuesta o aprobada) ──────────────────────────────

export default function EditorGuia({ guia, onChange }: { guia: Guia; onChange: (g: Guia) => void }) {
  const setPaso = (i: number, c: Partial<PasoGuia>) =>
    onChange({ ...guia, pasos: guia.pasos.map((p, j) => (j === i ? { ...p, ...c } : p)) });
  const setLista = (campo: 'criteriosEvaluacion', i: number, v: string) =>
    onChange({ ...guia, [campo]: guia[campo].map((x, j) => (j === i ? v : x)) });
  const s = guia.sustentacion;
  const setSust = (c: Partial<Guia['sustentacion']>) => onChange({ ...guia, sustentacion: { ...s, ...c } });
  const evidencias = guia.evidenciasAprendizaje ?? [];
  const setEvidencia = (i: number, v: string) =>
    onChange({ ...guia, evidenciasAprendizaje: evidencias.map((e, j) => (j === i ? { ...e, evidencia: v } : e)) });

  // Pasos agrupados por semana, conservando el índice real dentro de guia.pasos.
  const semanas = [...new Set(guia.pasos.map(p => p.semana || 1))].sort((a, b) => a - b);
  const ultimaSemana = semanas.length ? semanas[semanas.length - 1] : 1;

  function nuevoPaso(semana: number): PasoGuia {
    return { id: `p${Date.now().toString(36)}`, titulo: '', instrucciones: '', momentos: 1, evidencia: 'foto', evidenciaDetalle: '', semana, fecha: null };
  }

  return (
    <div className="space-y-4">
      {guia.notaAjustes && <p className="text-xs text-soft rounded-lg bg-elevated p-2.5">{guia.notaAjustes}</p>}

      <div>
        <Etiqueta>Producto integrado (único para todas las áreas)</Etiqueta>
        <textarea rows={2} value={guia.productoFinal} onChange={e => onChange({ ...guia, productoFinal: e.target.value })} className={CLASE_INPUT} />
      </div>

      {evidencias.length > 0 && (
        <div className="space-y-2">
          <Etiqueta>Evidencias de aprendizaje (una por área)</Etiqueta>
          {evidencias.map((e, i) => (
            <div key={i}>
              <p className="text-xs text-muted mb-0.5">{e.asignatura}</p>
              <textarea rows={2} value={e.evidencia} onChange={ev => setEvidencia(i, ev.target.value)} className={CLASE_INPUT} />
            </div>
          ))}
        </div>
      )}

      <div>
        <Etiqueta>Criterios de evaluación</Etiqueta>
        <div className="space-y-2">
          {guia.criteriosEvaluacion.map((c, i) => (
            <div key={i} className="flex gap-2">
              <input value={c} onChange={e => setLista('criteriosEvaluacion', i, e.target.value)} className={CLASE_INPUT} />
              <button aria-label="Quitar criterio" onClick={() => onChange({ ...guia, criteriosEvaluacion: guia.criteriosEvaluacion.filter((_, j) => j !== i) })}
                className="p-2 text-muted hover:text-danger flex-shrink-0"><Trash2 size={15} /></button>
            </div>
          ))}
          <button onClick={() => onChange({ ...guia, criteriosEvaluacion: [...guia.criteriosEvaluacion, ''] })} className="text-xs text-soft hover:text-strong">+ Agregar criterio</button>
        </div>
      </div>

      <div className="space-y-4">
        <Etiqueta>Cronograma: pasos por semana (el marcado como entrega parcial es lo que se entrega esa semana)</Etiqueta>
        {semanas.map(sem => (
          <div key={sem} className="space-y-3">
            <h4 className="text-sm font-semibold text-strong">Semana {sem}</h4>
            {guia.pasos.map((p, i) => ((p.semana || 1) !== sem ? null : (
              <div key={p.id} className={cn('rounded-xl border p-3 space-y-2', p.esEntregaParcial ? 'border-accent bg-warning-soft' : 'border-line')}>
                <div className="flex gap-2 items-center">
                  <span className="text-xs text-muted w-5">{i + 1}.</span>
                  <input value={p.titulo} onChange={e => setPaso(i, { titulo: e.target.value })} placeholder="Título del paso" className={CLASE_INPUT} />
                  <button aria-label="Quitar paso" onClick={() => onChange({ ...guia, pasos: guia.pasos.filter((_, j) => j !== i) })}
                    className="p-2 text-muted hover:text-danger flex-shrink-0"><Trash2 size={15} /></button>
                </div>
                <label className="flex items-center gap-2 text-xs text-soft">
                  <input type="checkbox" checked={!!p.esEntregaParcial} onChange={e => setPaso(i, { esEntregaParcial: e.target.checked })} />
                  <span className={cn(p.esEntregaParcial && 'font-semibold text-strong')}>Entrega parcial de la semana {sem}</span>
                </label>
                <textarea rows={3} value={p.instrucciones} onChange={e => setPaso(i, { instrucciones: e.target.value })} placeholder="Qué hacer" className={CLASE_INPUT} />
                <div className="grid grid-cols-3 gap-2">
                  <div><Etiqueta>Semana</Etiqueta>
                    <input type="number" min={1} max={12} value={p.semana || 1}
                      onChange={e => setPaso(i, { semana: Math.min(12, Math.max(1, Number(e.target.value) || 1)) })} className={CLASE_INPUT} /></div>
                  <div><Etiqueta>Momentos (25 min)</Etiqueta>
                    <input type="number" min={1} max={4} value={p.momentos}
                      onChange={e => setPaso(i, { momentos: Math.min(4, Math.max(1, Number(e.target.value) || 1)) })} className={CLASE_INPUT} /></div>
                  <div><Etiqueta>Evidencia</Etiqueta>
                    <select value={p.evidencia} onChange={e => setPaso(i, { evidencia: e.target.value as EvidenciaTipo })} className={CLASE_INPUT}>
                      {EVIDENCIAS.map(v => <option key={v} value={v}>{v}</option>)}
                    </select></div>
                </div>
                <input value={p.evidenciaDetalle} onChange={e => setPaso(i, { evidenciaDetalle: e.target.value })} placeholder="Qué entrega exactamente" className={CLASE_INPUT} />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div><Etiqueta>Canal / formato de entrega</Etiqueta>
                    <input value={p.canalEntrega ?? ''} onChange={e => setPaso(i, { canalEntrega: e.target.value })} placeholder="Ej.: foto por WhatsApp, audio…" className={CLASE_INPUT} /></div>
                  <div><Etiqueta>Ajuste razonable aplicado</Etiqueta>
                    <input value={p.ajusteAplicado ?? ''} onChange={e => setPaso(i, { ajusteAplicado: e.target.value })} className={CLASE_INPUT} /></div>
                </div>
                <div><Etiqueta>Fecha de entrega (si la deja vacía, se reparte sola)</Etiqueta>
                  <input type="date" value={p.fecha ?? ''} onChange={e => setPaso(i, { fecha: e.target.value || null })} className={CLASE_INPUT} /></div>
              </div>
            )))}
          </div>
        ))}
        <div className="flex flex-wrap gap-2">
          <button onClick={() => onChange({ ...guia, pasos: [...guia.pasos, nuevoPaso(ultimaSemana)] })} className={CLASE_BOTON_SEC}><Plus size={14} />Agregar paso</button>
          <button onClick={() => onChange({ ...guia, pasos: [...guia.pasos, { ...nuevoPaso(ultimaSemana + 1), esEntregaParcial: true }] })} className={CLASE_BOTON_SEC}><Plus size={14} />Agregar semana</button>
        </div>
      </div>

      <div className="space-y-2">
        <Etiqueta>Sustentación</Etiqueta>
        <div className="grid grid-cols-2 gap-2">
          <select value={s.modalidad} onChange={e => setSust({ modalidad: e.target.value as ModalidadSustentacion })} className={CLASE_INPUT}>
            {MODALIDADES_SUSTENTACION.map(m => <option key={m.id} value={m.id}>{m.texto}</option>)}
          </select>
          <input type="date" value={s.fecha ?? ''} onChange={e => setSust({ fecha: e.target.value || null })} className={CLASE_INPUT} />
          <input type="time" value={s.hora ?? ''} onChange={e => setSust({ hora: e.target.value || null })} className={CLASE_INPUT} />
          <input value={s.lugarOEnlace} onChange={e => setSust({ lugarOEnlace: e.target.value })}
            placeholder={s.modalidad === 'virtual' ? 'Enlace' : 'Lugar, enlace o dónde se entrega'} className={CLASE_INPUT} />
        </div>
        <Etiqueta>Preguntas guía</Etiqueta>
        {s.preguntasGuia.map((q, i) => (
          <div key={i} className="flex gap-2">
            <input value={q} onChange={e => setSust({ preguntasGuia: s.preguntasGuia.map((x, j) => (j === i ? e.target.value : x)) })} className={CLASE_INPUT} />
            <button aria-label="Quitar pregunta" onClick={() => setSust({ preguntasGuia: s.preguntasGuia.filter((_, j) => j !== i) })}
              className="p-2 text-muted hover:text-danger flex-shrink-0"><Trash2 size={15} /></button>
          </div>
        ))}
        <button onClick={() => setSust({ preguntasGuia: [...s.preguntasGuia, ''] })} className="text-xs text-soft hover:text-strong">+ Agregar pregunta</button>
      </div>
    </div>
  );
}
