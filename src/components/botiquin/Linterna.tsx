import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';
import { BOTON_ACENTO, BOTON_NEUTRO, useWakeLock } from './compartido';


/** Linterna: flash por getUserMedia + torch; si no se puede, pantalla blanca. */
export function Linterna() {
  const [encendida, setEncendida] = useState(false);
  const [pantalla, setPantalla] = useState(false);
  const [aviso, setAviso] = useState('');
  const streamRef = useRef<MediaStream | null>(null);
  useWakeLock(encendida || pantalla);

  const liberar = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    setEncendida(false);
  }, []);
  useEffect(() => liberar, [liberar]);

  const encender = async () => {
    setAviso('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      const track = stream.getVideoTracks()[0];
      if (!track || !(track.getCapabilities?.() as { torch?: boolean } | undefined)?.torch) {
        stream.getTracks().forEach(t => t.stop());
        setAviso('Este teléfono no permite encender el flash desde la aplicación. Use la linterna del sistema o la pantalla blanca.');
        return;
      }
      await track.applyConstraints({ advanced: [{ torch: true } as MediaTrackConstraintSet] });
      streamRef.current = stream;
      setEncendida(true);
    } catch {
      streamRef.current?.getTracks().forEach(t => t.stop());
      setAviso('No se pudo usar la cámara (permiso denegado o no disponible). Use la linterna del sistema o la pantalla blanca.');
    }
  };

  return (
    <div className="flex flex-col gap-3">
      {encendida
        ? <button type="button" onClick={liberar} className={cn(BOTON_ACENTO, 'min-h-[72px] w-full text-xl')}>Apagar linterna</button>
        : <button type="button" onClick={encender} className={cn(BOTON_ACENTO, 'min-h-[72px] w-full text-xl')}>Encender linterna</button>}
      <button type="button" onClick={() => setPantalla(true)} className={cn(BOTON_NEUTRO, 'min-h-[64px] w-full')}>Pantalla blanca</button>
      <p role="status" aria-live="polite" className={cn('text-sm', aviso ? 'rounded-xl border-2 border-warning bg-warning-soft text-warning-soft-fg px-4 py-3' : 'sr-only')}>
        {aviso || (encendida ? 'Linterna encendida' : '')}
      </p>
      <p className="text-[11px] text-muted">En iPhone y en computador el flash no se puede controlar desde el navegador: use la linterna del sistema (Centro de control o panel rápido). La pantalla blanca ilumina poco; suba el brillo al máximo.</p>

      {pantalla && createPortal(
        <div className="fixed inset-0 z-[9999] bg-white flex items-end justify-center p-6" style={{ backgroundColor: '#ffffff' }}>
          <button type="button" autoFocus onClick={() => setPantalla(false)} className="min-h-[56px] rounded-xl border-2 border-black bg-white text-black font-bold px-8">
            Cerrar
          </button>
        </div>,
        document.body,
      )}
    </div>
  );
}
