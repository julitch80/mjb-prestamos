import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { formatearMmSs } from '../../data/botiquin/bitacora';
import { DURACION_AGUA_FRIA_S, INSTRUCCIONES_QUEMADURA, progreso, segundosRestantes } from '../../data/botiquin/quemaduras';
import { AnadirABitacora, BOTON, BOTON_NEUTRO, Instrucciones, useAhora, useBip, useWakeLock, vibrar } from './compartido';

/** Temporizador de 20 min de agua fría con pausa/reanudar. */
export function Quemaduras() {
  const [acumulado, setAcumulado] = useState(0); // ms acumulados en pausas previas
  const [desde, setDesde] = useState<number | null>(null); // inicio del tramo en marcha
  const [empezo, setEmpezo] = useState(false);
  const ahora = useAhora(desde !== null, 250);
  const { iniciar, pitar } = useBip();
  const avisado = useRef(false);

  const transcurrido = acumulado + (desde !== null ? ahora - desde : 0);
  const restante = segundosRestantes(DURACION_AGUA_FRIA_S, transcurrido);
  const fin = empezo && restante <= 0;
  useWakeLock(desde !== null);

  useEffect(() => {
    if (fin && !avisado.current) {
      avisado.current = true;
      setDesde(null);
      pitar(880, 0.4, 0.5); window.setTimeout(() => pitar(880, 0.4, 0.5), 600);
      vibrar([400, 150, 400, 150, 400]);
    }
  }, [fin, pitar]);

  const empezar = async () => { await iniciar(); avisado.current = false; setAcumulado(0); setEmpezo(true); setDesde(Date.now()); vibrar(80); };
  const pausar = () => { if (desde !== null) { setAcumulado(a => a + Date.now() - desde); setDesde(null); } };
  const reanudar = () => setDesde(Date.now());
  const reiniciar = () => { setAcumulado(0); setDesde(null); setEmpezo(false); avisado.current = false; };
  const pct = Math.round(progreso(DURACION_AGUA_FRIA_S, transcurrido) * 100);

  return (
    <div className="flex flex-col gap-3">
      {!empezo ? (
        <button type="button" onClick={empezar} className={cn(BOTON, 'min-h-[72px] w-full border-accent bg-accent text-accent-fg text-xl')}>
          Empezar 20 min de agua fría
        </button>
      ) : (
        <>
          <p className="text-center text-7xl font-bold tabular-nums text-strong" aria-hidden="true">{formatearMmSs(restante)}</p>
          <div className="h-3 w-full rounded-full bg-elevated overflow-hidden" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label="Avance del enfriado">
            <div className="h-full bg-accent transition-all" style={{ width: `${pct}%` }} />
          </div>
          <span className="sr-only" role="status" aria-live="polite">
            {fin ? 'Terminaron los 20 minutos' : restante > 0 && restante % 300 === 0 ? `Faltan ${restante / 60} minutos` : ''}
          </span>
          {fin ? (
            <div role="alert" className="rounded-xl border-2 border-success bg-success-soft px-4 py-3 flex flex-col gap-2">
              <p className="text-lg font-bold text-success-soft-fg">Terminaron los 20 minutos</p>
              <p className="text-sm text-success-soft-fg">Cubra con gasa o plástico limpio. Si es grande, en cara, manos o genitales, llame al 123.</p>
              <AnadirABitacora detalle="Quemadura: 20 min de agua fría completados" />
              <button type="button" onClick={reiniciar} className={BOTON_NEUTRO}>Reiniciar</button>
            </div>
          ) : (
            <div className="flex gap-2">
              {desde !== null
                ? <button type="button" onClick={pausar} className={cn(BOTON_NEUTRO, 'flex-1 min-h-[64px]')}>Pausar</button>
                : <button type="button" onClick={reanudar} className={cn(BOTON, 'flex-1 min-h-[64px] border-accent bg-accent text-accent-fg')}>Reanudar</button>}
              <button type="button" onClick={reiniciar} className={BOTON_NEUTRO}>Reiniciar</button>
            </div>
          )}
        </>
      )}
      <div className="rounded-xl border border-line bg-card px-4 py-3">
        <p className="text-sm font-bold text-strong mb-1">Qué hacer</p>
        <Instrucciones items={INSTRUCCIONES_QUEMADURA} />
      </div>
    </div>
  );
}
