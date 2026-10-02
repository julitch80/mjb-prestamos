import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { formatearMmSs } from '../../data/botiquin/bitacora';
import { estadoConvulsion, RECORDATORIOS_CONVULSION, textoDuracion, UMBRAL_CONVULSION_S } from '../../data/botiquin/convulsion';
import { AnadirABitacora, BOTON, BOTON_NEUTRO, useAhora, useBip, useWakeLock, vibrar } from './compartido';

/** Cronómetro de convulsión: alarma fuerte a los 5:00. */
export function Convulsion() {
  const [inicio, setInicio] = useState<number | null>(null);
  const [duracionFinal, setDuracionFinal] = useState<number | null>(null);
  const ahora = useAhora(inicio !== null, 250);
  const { iniciar, pitar } = useBip();
  const alarmaRef = useRef<number | null>(null);
  useWakeLock(inicio !== null);

  const seg = inicio !== null ? Math.floor((ahora - inicio) / 1000) : 0;
  const estado = estadoConvulsion(inicio !== null, seg);

  useEffect(() => {
    if (estado !== 'alerta') return;
    const sonar = () => { pitar(1000, 0.35, 0.5); vibrar([400, 150, 400]); };
    sonar();
    alarmaRef.current = window.setInterval(sonar, 2000);
    return () => { if (alarmaRef.current !== null) window.clearInterval(alarmaRef.current); alarmaRef.current = null; };
  }, [estado, pitar]);

  const empezar = async () => {
    await iniciar();
    setDuracionFinal(null);
    setInicio(Date.now());
    vibrar(100);
  };
  const terminar = () => {
    if (inicio === null) return;
    setDuracionFinal(Math.floor((Date.now() - inicio) / 1000));
    setInicio(null);
  };

  return (
    <div className="flex flex-col gap-3">
      {estado === 'alerta' && (
        <div role="alert" className="rounded-xl border-4 border-danger bg-danger text-white px-4 py-4 flex flex-col gap-3 animate-pulse">
          <p className="text-xl font-bold">Más de 5 minutos: llame al 123</p>
          <a href="tel:123" className="min-h-[64px] rounded-xl bg-white text-danger text-xl font-bold flex items-center justify-center">Llamar al 123</a>
        </div>
      )}

      {inicio === null ? (
        <button type="button" onClick={empezar} className={cn(BOTON, 'min-h-[72px] w-full border-danger bg-danger text-white text-xl')}>
          Empezó la convulsión
        </button>
      ) : (
        <>
          <p className={cn('text-center text-7xl font-bold tabular-nums', estado === 'alerta' ? 'text-danger' : 'text-strong')} aria-hidden="true">
            {formatearMmSs(seg)}
          </p>
          <span className="sr-only" role="status" aria-live="polite">
            {seg > 0 && seg % 60 === 0 ? `${seg / 60} minutos` : ''}
          </span>
          <p className="text-xs text-soft text-center">La alarma suena a los {formatearMmSs(UMBRAL_CONVULSION_S)}.</p>
          <button type="button" onClick={terminar} className={cn(BOTON_NEUTRO, 'min-h-[64px] w-full')}>Terminó</button>
        </>
      )}

      {duracionFinal !== null && (
        <div role="status" className="rounded-xl border-2 border-line bg-card px-4 py-3 flex flex-col gap-2">
          <p className="text-base font-bold text-strong">Duración: {textoDuracion(duracionFinal)}</p>
          <p className="text-sm text-soft">Póngalo de lado y no lo deje solo. Si fue la primera vez, duró más de 5 minutos o no despierta, llame al 123.</p>
          <AnadirABitacora detalle={`Convulsión de ${textoDuracion(duracionFinal)}`} />
        </div>
      )}

      <div className="rounded-xl border border-warning bg-warning-soft px-4 py-3">
        <p className="text-sm font-bold text-warning-soft-fg mb-1">Mientras tanto</p>
        <ul className="list-disc pl-5 text-sm text-warning-soft-fg flex flex-col gap-1">
          {RECORDATORIOS_CONVULSION.map((t, i) => <li key={i}>{t}</li>)}
        </ul>
      </div>
    </div>
  );
}
