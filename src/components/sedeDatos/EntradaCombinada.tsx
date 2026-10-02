// Las cuatro formas de responder, combinables: texto, «está en el archivo»,
// subir un archivo ahora y nota de voz.
import { useRef, useState } from 'react';
import { Camera, Paperclip, X } from 'lucide-react';
import { formatearRef } from '../../data/sedeDatos/archivos';
import type { ArchivoSede, Entrada } from '../../data/sedeDatos/tipos';
import GrabadorVoz from './GrabadorVoz';
import { Boton } from './piezas';

export const ACEPTA = 'image/*,application/pdf,.doc,.docx,.xls,.xlsx,audio/*';

export default function EntradaCombinada({ sede, archivos, entrada, onChange, subirArchivos, placeholder, conArchivos = true }: {
  sede: string;
  archivos: ArchivoSede[];
  entrada: Entrada;
  onChange: (e: Entrada) => void;
  subirArchivos: (files: File[]) => Promise<ArchivoSede[]>;
  placeholder?: string;
  conArchivos?: boolean;
}) {
  const [etq, setEtq] = useState('');
  const [donde, setDonde] = useState('');
  const [subiendo, setSubiendo] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const camRef = useRef<HTMLInputElement>(null);
  // Siempre la entrada vigente, para que varias subidas seguidas no se pisen entre sí.
  const vigente = useRef(entrada);
  vigente.current = entrada;

  function agregarRef(etiqueta: string, d: string) {
    if (!etiqueta) return;
    const ya = vigente.current.refs.some(r => r.etiqueta === etiqueta && r.donde === d.trim());
    if (ya) return;
    onChange({ ...vigente.current, refs: [...vigente.current.refs, { etiqueta, donde: d.trim() }] });
  }

  async function alElegir(files: FileList | null) {
    if (!files || files.length === 0) return;
    setSubiendo(true);
    try {
      const nuevos = await subirArchivos([...files]);
      if (nuevos.length) {
        // Lo recién subido queda referenciado de una vez en esta respuesta.
        onChange({ ...vigente.current, refs: [...vigente.current.refs, ...nuevos.map(a => ({ etiqueta: a.etiqueta, donde: '' }))] });
      }
    } finally {
      setSubiendo(false);
      if (inputRef.current) inputRef.current.value = '';
      if (camRef.current) camRef.current.value = '';
    }
  }

  return (
    <div className="space-y-3">
      <textarea
        value={entrada.texto}
        onChange={e => onChange({ ...entrada, texto: e.target.value })}
        rows={3}
        placeholder={placeholder ?? 'Escriba o pegue aquí…'}
        className="w-full rounded-lg border border-line bg-card px-3 py-2 text-sm text-strong placeholder:text-muted"
      />

      {conArchivos && (
        <div className="space-y-2">
          {archivos.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <select value={etq} onChange={e => setEtq(e.target.value)}
                className="min-h-[44px] rounded-lg border border-line bg-card px-2 text-sm text-strong" aria-label="Archivo donde está la respuesta">
                <option value="">Está en el archivo…</option>
                {archivos.map(a => <option key={a.id} value={a.etiqueta}>{a.etiqueta} · {a.nombre}</option>)}
              </select>
              <input value={donde} onChange={e => setDonde(e.target.value)} placeholder="dónde (página, hoja…)"
                className="min-h-[44px] flex-1 min-w-[140px] rounded-lg border border-line bg-card px-3 text-sm text-strong placeholder:text-muted" />
              <Boton disabled={!etq} onClick={() => { agregarRef(etq, donde); setDonde(''); }}>Agregar</Boton>
            </div>
          )}
          {entrada.refs.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {entrada.refs.map((r, i) => (
                <span key={i} className="inline-flex items-center gap-1 rounded-full bg-info-soft text-info-soft-fg text-xs pl-3 pr-1 min-h-[32px]">
                  {formatearRef(r)}
                  <button type="button" aria-label="Quitar referencia"
                    onClick={() => onChange({ ...entrada, refs: entrada.refs.filter((_, j) => j !== i) })}
                    className="min-h-[32px] min-w-[32px] flex items-center justify-center"><X size={12} /></button>
                </span>
              ))}
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <input ref={inputRef} type="file" multiple accept={ACEPTA} hidden onChange={e => alElegir(e.target.files)} />
            <input ref={camRef} type="file" accept="image/*" capture="environment" hidden onChange={e => alElegir(e.target.files)} />
            <Boton disabled={subiendo} onClick={() => inputRef.current?.click()}>
              <Paperclip size={14} className="inline mr-1.5" />{subiendo ? 'Subiendo…' : 'Subir archivo ahora'}
            </Boton>
            <Boton disabled={subiendo} onClick={() => camRef.current?.click()}>
              <Camera size={14} className="inline mr-1.5" />Tomar foto
            </Boton>
          </div>
        </div>
      )}

      <GrabadorVoz sede={sede} audios={entrada.audios} onChange={audios => onChange({ ...vigente.current, audios })} />
    </div>
  );
}
