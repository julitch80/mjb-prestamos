import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { canvasABase64, esquinasPorDefecto, recortarDocumento, type Esquinas, type Punto } from '../lib/scanner';

/** Captura una foto (cámara trasera en celular) y deja ajustar las 4 esquinas
 * de la hoja antes de recortarla y enderezarla — como un escáner de bolsillo.
 * Entrega el resultado final como base64 JPEG vía `onListo`. */
export function CapturaEscaner({ onListo, onCancelar }: {
  onListo: (base64: string) => void;
  onCancelar: () => void;
}) {
  const [imgUrl, setImgUrl] = useState<string | null>(null);
  const [imgEl, setImgEl] = useState<HTMLImageElement | null>(null);
  const [esquinas, setEsquinas] = useState<Esquinas | null>(null);
  const [arrastrando, setArrastrando] = useState<number | null>(null);
  const [previsualizacion, setPrevisualizacion] = useState<string | null>(null);
  const contenedorRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!imgUrl) return;
    const img = new Image();
    img.onload = () => {
      setImgEl(img);
      setEsquinas(esquinasPorDefecto(img.naturalWidth, img.naturalHeight));
    };
    img.src = imgUrl;
  }, [imgUrl]);

  function elegirArchivo(archivo: File) {
    const url = URL.createObjectURL(archivo);
    setImgUrl(url);
    setPrevisualizacion(null);
  }

  function coordARelativa(clientX: number, clientY: number): Punto | null {
    const cont = contenedorRef.current;
    if (!cont || !imgEl) return null;
    const rect = cont.getBoundingClientRect();
    const escalaX = imgEl.naturalWidth / rect.width;
    const escalaY = imgEl.naturalHeight / rect.height;
    return {
      x: Math.max(0, Math.min(imgEl.naturalWidth, (clientX - rect.left) * escalaX)),
      y: Math.max(0, Math.min(imgEl.naturalHeight, (clientY - rect.top) * escalaY)),
    };
  }

  function onMover(clientX: number, clientY: number) {
    if (arrastrando === null || !esquinas) return;
    const p = coordARelativa(clientX, clientY);
    if (!p) return;
    const nuevas = [...esquinas] as Esquinas;
    nuevas[arrastrando] = p;
    setEsquinas(nuevas);
  }

  function confirmarRecorte() {
    if (!imgEl || !esquinas) return;
    const canvas = recortarDocumento(imgEl, esquinas);
    setPrevisualizacion(canvasABase64(canvas));
  }

  if (previsualizacion) {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-xs text-muted text-center">Vista previa del documento enderezado</p>
        <img src={previsualizacion} alt="Documento recortado" className="w-full rounded-lg border border-line" />
        <div className="flex gap-2">
          <button
            onClick={() => setPrevisualizacion(null)}
            className="flex-1 px-4 py-3 rounded-xl text-sm font-semibold text-soft border border-line bg-elevated hover:bg-hover transition"
          >
            ← Ajustar de nuevo
          </button>
          <button
            onClick={() => onListo(previsualizacion)}
            className="flex-1 px-4 py-3 rounded-xl text-sm font-semibold text-accent-fg bg-accent hover:brightness-110 transition"
          >
            Usar esta foto
          </button>
        </div>
      </div>
    );
  }

  if (imgEl && esquinas) {
    const rect = contenedorRef.current?.getBoundingClientRect();
    const escala = rect ? rect.width / imgEl.naturalWidth : 0;
    return (
      <div className="flex flex-col gap-3">
        <p className="text-xs text-muted text-center">
          Arrastra las 4 esquinas para que coincidan con los bordes de la hoja
        </p>
        <div
          ref={contenedorRef}
          className="relative w-full select-none touch-none"
          onMouseMove={e => onMover(e.clientX, e.clientY)}
          onMouseUp={() => setArrastrando(null)}
          onMouseLeave={() => setArrastrando(null)}
          onTouchMove={e => { const t = e.touches[0]; if (t) onMover(t.clientX, t.clientY); }}
          onTouchEnd={() => setArrastrando(null)}
        >
          <img src={imgUrl!} alt="Foto tomada" className="w-full rounded-lg" draggable={false} />
          <svg className="absolute inset-0 w-full h-full pointer-events-none" preserveAspectRatio="none">
            <polygon
              points={esquinas.map(p => `${p.x * escala},${p.y * escala}`).join(' ')}
              className="fill-accent/15 stroke-accent"
              strokeWidth={2}
            />
          </svg>
          {esquinas.map((p, i) => (
            <div
              key={i}
              onMouseDown={() => setArrastrando(i)}
              onTouchStart={() => setArrastrando(i)}
              className={cn(
                'absolute w-7 h-7 -ml-3.5 -mt-3.5 rounded-full border-2 border-accent bg-card cursor-grab active:cursor-grabbing',
                arrastrando === i && 'bg-accent',
              )}
              style={{ left: p.x * escala, top: p.y * escala }}
            />
          ))}
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => { setImgUrl(null); setImgEl(null); setEsquinas(null); }}
            className="flex-1 px-4 py-3 rounded-xl text-sm font-semibold text-soft border border-line bg-elevated hover:bg-hover transition"
          >
            ← Otra foto
          </button>
          <button
            onClick={confirmarRecorte}
            className="flex-1 px-4 py-3 rounded-xl text-sm font-semibold text-accent-fg bg-accent hover:brightness-110 transition"
          >
            Recortar →
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) elegirArchivo(f); }}
      />
      <button
        onClick={() => inputRef.current?.click()}
        className="rounded-xl border-2 border-dashed border-line px-4 py-8 text-sm font-semibold text-soft hover:bg-hover transition flex flex-col items-center gap-2"
      >
        <span className="text-2xl">📄</span>
        Tomar foto del documento
      </button>
      <button
        onClick={onCancelar}
        className="px-4 py-2 rounded-xl text-xs font-medium text-muted hover:text-soft transition"
      >
        Cancelar
      </button>
    </div>
  );
}
