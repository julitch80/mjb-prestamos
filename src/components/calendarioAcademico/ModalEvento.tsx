// Editar, agregar o borrar un evento del calendario (solo coordinador/rectora/superusuario).
import { useState } from 'react';
import { X } from 'lucide-react';
import { CATEGORIAS, type CategoriaCal, type EventoCal } from '../../data/calendarioAcademico/tipos';

interface Props {
  evento: EventoCal | null; // null = nuevo
  onCerrar: () => void;
  onGuardar: (antes: EventoCal | null, despues: EventoCal | null, motivo: string) => Promise<void>;
}

const campo = 'w-full px-3 py-2 rounded-lg bg-elevated border border-line text-sm text-strong outline-none focus:border-accent';

function idDe(titulo: string): string {
  const base = titulo.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 40);
  return `${base || 'evento'}_${Date.now().toString(36)}`;
}

export default function ModalEvento({ evento, onCerrar, onGuardar }: Props) {
  const [titulo, setTitulo] = useState(evento?.titulo ?? '');
  const [desde, setDesde] = useState(evento?.desde ?? '');
  const [hasta, setHasta] = useState(evento?.hasta ?? '');
  const [porDefinir, setPorDefinir] = useState(!!evento?.porDefinir);
  const [noSeRealiza, setNoSeRealiza] = useState(!!evento?.noSeRealiza);
  const [nota, setNota] = useState(evento?.nota ?? '');
  const [categoria, setCategoria] = useState<CategoriaCal>(evento?.categoria ?? 'institucional');
  const [alerta, setAlerta] = useState(evento?.alertaDocente ?? false);
  const [motivo, setMotivo] = useState('');
  const [confirmarBorrar, setConfirmarBorrar] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  const valido = titulo.trim() !== '' && /^\d{4}-\d{2}-\d{2}$/.test(desde) && (!hasta || hasta >= desde) && motivo.trim() !== '';

  async function enviar(borrar: boolean) {
    setGuardando(true); setError('');
    try {
      const despues: EventoCal | null = borrar ? null : {
        ...(evento ?? { id: idDe(titulo) }),
        titulo: titulo.trim(), desde, hasta: hasta || undefined, porDefinir: porDefinir || undefined,
        noSeRealiza: noSeRealiza || undefined, nota: nota.trim() || undefined, categoria, alertaDocente: alerta,
        aplicaA: evento?.aplicaA,
      } as EventoCal;
      await onGuardar(evento, despues, motivo.trim());
    } catch (e) {
      setError((e as Error).message || 'No se pudo guardar.');
      setGuardando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4" role="dialog" aria-modal="true">
      <div className="w-full sm:max-w-md max-h-[92vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl bg-card border border-line p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <h2 className="text-strong font-semibold text-base">{evento ? 'Editar evento' : 'Agregar evento'}</h2>
          <button onClick={onCerrar} aria-label="Cerrar" className="p-2 -m-2 text-soft hover:text-strong"><X size={18} /></button>
        </div>
        <label className="block text-xs text-soft">Título
          <input value={titulo} onChange={e => setTitulo(e.target.value)} className={campo + ' mt-1'} /></label>
        <div className="grid grid-cols-2 gap-2">
          <label className="block text-xs text-soft">Desde
            <input type="date" value={desde} onChange={e => setDesde(e.target.value)} className={campo + ' mt-1'} /></label>
          <label className="block text-xs text-soft">Hasta (opcional)
            <input type="date" value={hasta} min={desde} onChange={e => setHasta(e.target.value)} className={campo + ' mt-1'} /></label>
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm text-strong">
          <label className="flex items-center gap-2"><input type="checkbox" checked={porDefinir} onChange={e => setPorDefinir(e.target.checked)} /> Por definir</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={noSeRealiza} onChange={e => setNoSeRealiza(e.target.checked)} /> No se realiza</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={alerta} onChange={e => setAlerta(e.target.checked)} /> Avisar a docentes</label>
        </div>
        <label className="block text-xs text-soft">Categoría
          <select value={categoria} onChange={e => setCategoria(e.target.value as CategoriaCal)} className={campo + ' mt-1'}>
            {CATEGORIAS.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select></label>
        <label className="block text-xs text-soft">Nota (opcional)
          <textarea value={nota} onChange={e => setNota(e.target.value)} rows={2} className={campo + ' mt-1'} /></label>
        <label className="block text-xs text-soft">Motivo del cambio (obligatorio)
          <input value={motivo} onChange={e => setMotivo(e.target.value)} placeholder="Ej.: circular de la Secretaría" className={campo + ' mt-1'} /></label>
        {error && <p className="text-xs rounded-lg bg-danger-soft text-danger-soft-fg px-3 py-2">{error}</p>}

        {confirmarBorrar ? (
          <div className="rounded-lg bg-danger-soft text-danger-soft-fg p-3 space-y-2 text-sm">
            <p>¿Borrar «{evento?.titulo}»? Queda anotado en el registro de cambios.</p>
            <div className="flex gap-2">
              <button disabled={!motivo.trim() || guardando} onClick={() => enviar(true)}
                className="px-3 py-2 rounded-lg bg-danger text-white text-xs font-medium disabled:opacity-50">Sí, borrar</button>
              <button onClick={() => setConfirmarBorrar(false)} className="px-3 py-2 rounded-lg bg-elevated text-strong text-xs">No</button>
            </div>
            {!motivo.trim() && <p className="text-xs">Escribe antes el motivo del cambio.</p>}
          </div>
        ) : (
          <div className="flex items-center gap-2 pt-1">
            <button disabled={!valido || guardando} onClick={() => enviar(false)}
              className="flex-1 px-4 py-2.5 rounded-lg bg-accent text-strong text-sm font-medium disabled:opacity-50">
              {guardando ? 'Guardando…' : 'Guardar'}</button>
            {evento && <button onClick={() => setConfirmarBorrar(true)} className="px-3 py-2.5 rounded-lg bg-danger-soft text-danger-soft-fg text-sm">Borrar</button>}
          </div>
        )}
      </div>
    </div>
  );
}
