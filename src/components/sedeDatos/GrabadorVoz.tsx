// Nota de voz: MediaRecorder en el navegador (webm en Chrome Android, mp4 en Safari iOS).
// Grabar / detener / escuchar / borrar, máximo 5 minutos. Se sube a Storage al detener.
import { useEffect, useRef, useState } from 'react';
import { Mic, Square, Trash2 } from 'lucide-react';
import { MAX_SEGUNDOS_AUDIO, elegirMimeType, formatearDuracion } from '../../data/sedeDatos/audio';
import { subirAudioSede } from '../../data/sedeDatos/almacenamiento';
import type { AudioNota } from '../../data/sedeDatos/tipos';
import { Boton, ReproductorNota } from './piezas';

export default function GrabadorVoz({ sede, audios, onChange, soloLectura }: {
  sede: string; audios: AudioNota[]; onChange: (a: AudioNota[]) => void; soloLectura?: boolean;
}) {
  const [grabando, setGrabando] = useState(false);
  const [seg, setSeg] = useState(0);
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState('');
  const rec = useRef<MediaRecorder | null>(null);
  const trozos = useRef<Blob[]>([]);
  const reloj = useRef<number | null>(null);
  const inicio = useRef(0);
  const audiosRef = useRef(audios);
  audiosRef.current = audios;

  const soportado = typeof window !== 'undefined' && typeof MediaRecorder !== 'undefined'
    && !!navigator.mediaDevices?.getUserMedia;

  useEffect(() => () => {
    if (reloj.current) window.clearInterval(reloj.current);
    if (rec.current && rec.current.state !== 'inactive') {
      rec.current.onstop = null;
      rec.current.stop();
      rec.current.stream.getTracks().forEach(t => t.stop());
    }
  }, []);

  async function empezar() {
    setError('');
    const mime = elegirMimeType(t => MediaRecorder.isTypeSupported(t));
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Si ningún tipo está declarado soportado, se deja que el navegador elija el suyo.
      const r = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      trozos.current = [];
      r.ondataavailable = e => { if (e.data.size > 0) trozos.current.push(e.data); };
      r.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        const duracion = Math.round((Date.now() - inicio.current) / 1000);
        const tipo = r.mimeType || mime || 'audio/webm';
        const blob = new Blob(trozos.current, { type: tipo });
        setSubiendo(true);
        try {
          const s = await subirAudioSede(sede, blob, tipo);
          onChange([...audiosRef.current, {
            ruta: s.ruta, nombre: `Nota de voz ${audiosRef.current.length + 1}`, tipo: s.tipo, tamano: s.tamano, duracionSeg: duracion,
          }]);
        } catch (e) {
          setError((e as Error).message || 'No se pudo subir la nota de voz.');
        } finally {
          setSubiendo(false);
        }
      };
      rec.current = r;
      inicio.current = Date.now();
      r.start();
      setSeg(0);
      setGrabando(true);
      reloj.current = window.setInterval(() => {
        const s = Math.round((Date.now() - inicio.current) / 1000);
        setSeg(s);
        if (s >= MAX_SEGUNDOS_AUDIO) detener();
      }, 500);
    } catch {
      setError('No se pudo usar el micrófono. Revise el permiso del navegador.');
    }
  }

  function detener() {
    if (reloj.current) { window.clearInterval(reloj.current); reloj.current = null; }
    if (rec.current && rec.current.state !== 'inactive') rec.current.stop();
    setGrabando(false);
  }

  if (!soportado && audios.length === 0) {
    return <p className="text-xs text-muted">Este navegador no permite grabar voz; escriba o suba un audio.</p>;
  }

  return (
    <div className="space-y-2">
      {audios.map((a, i) => (
        <div key={a.ruta} className="flex items-center gap-2 flex-wrap rounded-lg bg-elevated px-2 py-1.5">
          <ReproductorNota nota={a} />
          {!soloLectura && (
            <button type="button" aria-label="Borrar nota de voz" title="Quitar esta nota (el archivo queda guardado)"
              onClick={() => onChange(audios.filter((_, j) => j !== i))}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-muted hover:text-danger hover:bg-danger-soft">
              <Trash2 size={16} />
            </button>
          )}
        </div>
      ))}
      {!soloLectura && soportado && (
        <div className="flex items-center gap-3 flex-wrap">
          {grabando ? (
            <Boton tono="aviso" onClick={detener}><Square size={14} className="inline mr-1.5" />Detener · {formatearDuracion(seg)}</Boton>
          ) : (
            <Boton onClick={empezar} disabled={subiendo}><Mic size={14} className="inline mr-1.5" />{subiendo ? 'Subiendo…' : 'Grabar nota de voz'}</Boton>
          )}
          <span className="text-xs text-muted">Máximo {MAX_SEGUNDOS_AUDIO / 60} minutos</span>
        </div>
      )}
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}
