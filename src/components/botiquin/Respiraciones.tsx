import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { GRUPOS_EDAD } from '../../data/tomaPulso';
import type { GrupoEdad, Semaforo } from '../../data/tomaPulso';
import {
  clasificarRespiraciones, formatearMedicionResp, formatearRegistroResp, rpmPorConteo,
} from '../../data/botiquin/respiraciones';
import type { MedicionResp } from '../../data/botiquin/respiraciones';
import { AnadirABitacora, BOTON_ACENTO, BOTON_NEUTRO, BOTON_PELIGRO, chip, horaAhora, useAhora, useBip, useCopiar, useWakeLock, vibrar } from './compartido';

const SEG = 30;
const CLAVE = 'mjb_botiquin_respiraciones';
const ESTILO: Record<Semaforo, { caja: string; fg: string; titulo: string; texto: string }> = {
  normal: { caja: 'border-success bg-success-soft', fg: 'text-success-soft-fg', titulo: 'Normal', texto: 'Dentro de lo esperado en reposo.' },
  vigilar: { caja: 'border-warning bg-warning-soft', fg: 'text-warning-soft-fg', titulo: 'Vigilar', texto: 'Fuera de lo habitual. Deje que descanse 5 minutos y vuelva a medir.' },
  alerta: { caja: 'border-danger bg-danger-soft', fg: 'text-danger-soft-fg', titulo: 'Alerta', texto: 'Frecuencia de alerta. Si además se ve azulado o pálido, se agita, tiene mucho esfuerzo para respirar o está confundido, llame al 123.' },
};

function cargar(): MedicionResp[] {
  try { const v = sessionStorage.getItem(CLAVE); return v ? (JSON.parse(v) as MedicionResp[]) : []; } catch { return []; }
}

/** Contador de respiraciones en 30 s (se cuenta mirando el pecho/abdomen; subida + bajada = 1). */
export function Respiraciones() {
  const [edad, setEdad] = useState<GrupoEdad | null>(null);
  const [fin, setFin] = useState<number | null>(null);
  const [toques, setToques] = useState(0);
  const [manual, setManual] = useState('');
  const [rpm, setRpm] = useState<number | null>(null);
  const [registro, setRegistro] = useState<MedicionResp[]>(cargar);
  const ahora = useAhora(fin !== null, 200);
  const { iniciar, pitar } = useBip();
  const { copiado, copiar } = useCopiar();
  useWakeLock(fin !== null);

  const restante = fin !== null ? Math.max(0, Math.ceil((fin - ahora) / 1000)) : 0;
  const contando = fin !== null && restante > 0;
  const terminoConteo = fin !== null && restante <= 0;

  useEffect(() => { try { sessionStorage.setItem(CLAVE, JSON.stringify(registro)); } catch { /* sin storage */ } }, [registro]);
  useEffect(() => {
    if (terminoConteo) { pitar(660, 0.3, 0.3); vibrar([200, 100, 200]); }
  }, [terminoConteo, pitar]);

  const empezar = async () => { await iniciar(); setToques(0); setManual(''); setRpm(null); setFin(Date.now() + SEG * 1000); pitar(880, 0.2, 0.3); vibrar(120); };
  const calcular = (n: number) => {
    if (!edad) return;
    const v = rpmPorConteo(n, SEG);
    setRpm(v);
    setRegistro(r => [...r, { hora: horaAhora(), rpm: v, edad, semaforo: clasificarRespiraciones(v, edad) }]);
    setFin(null);
  };
  const reiniciar = () => { setFin(null); setRpm(null); setToques(0); setManual(''); };

  const sem = edad && rpm !== null ? clasificarRespiraciones(rpm, edad) : null;
  const n = parseInt(manual, 10);

  return (
    <div className="flex flex-col gap-3">
      <div role="group" aria-label="Edad del afectado" className="flex flex-wrap gap-2">
        {GRUPOS_EDAD.map(g => (
          <button key={g.id} type="button" aria-pressed={edad === g.id} onClick={() => { setEdad(g.id); reiniciar(); }} className={chip(edad === g.id)}>{g.etiqueta}</button>
        ))}
      </div>
      {!edad && <p className="text-xs text-muted">Elija la edad para empezar.</p>}

      {edad && fin === null && rpm === null && (
        <button type="button" onClick={empezar} className={cn(BOTON_PELIGRO, 'min-h-[64px] w-full')}>Empezar a contar ({SEG} s)</button>
      )}

      {edad && contando && (
        <>
          <p className="text-center text-7xl font-bold tabular-nums text-strong" aria-hidden="true">{restante}</p>
          <span className="sr-only" role="status" aria-live="assertive">{restante <= 5 ? `${restante}` : ''}</span>
          <button
            type="button"
            onClick={() => { setToques(t => t + 1); vibrar(20); }}
            className="w-full min-h-[140px] rounded-2xl border-4 border-danger bg-danger text-white text-2xl font-bold active:scale-95 transition-transform select-none touch-manipulation"
          >
            Toque con cada respiración
            <span className="block text-sm font-semibold opacity-90 mt-1">{toques} respiraciones</span>
          </button>
          <button type="button" onClick={reiniciar} className={BOTON_NEUTRO}>Cancelar</button>
        </>
      )}

      {edad && terminoConteo && (
        <div className="flex flex-col gap-3">
          <p className="text-base font-bold text-strong text-center">Tiempo cumplido. Confirme el número contado.</p>
          <label htmlFor="resp-n" className="text-sm text-soft text-center">Por toques: {toques}. Si contó de cabeza, escriba el número:</label>
          <input
            id="resp-n"
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={manual}
            onChange={e => setManual(e.target.value.replace(/\D/g, '').slice(0, 3))}
            className="w-full min-h-[64px] rounded-xl border-2 border-line bg-card text-strong text-center text-3xl font-bold tabular-nums"
          />
          <button type="button" onClick={() => calcular(Number.isFinite(n) && manual ? n : toques)} className={cn(BOTON_ACENTO, 'min-h-[64px]')}>
            Calcular con {Number.isFinite(n) && manual ? n : toques}
          </button>
        </div>
      )}

      <div role="status" aria-live="polite">
        {sem && rpm !== null && (
          <div className={cn('rounded-xl border-2 px-4 py-3 flex flex-col gap-2', ESTILO[sem].caja)}>
            <p className={cn('text-4xl font-bold tabular-nums', ESTILO[sem].fg)}>{rpm} <span className="text-base">resp/min</span></p>
            <p className={cn('text-sm font-bold', ESTILO[sem].fg)}>{ESTILO[sem].titulo}</p>
            <p className={cn('text-sm leading-relaxed', ESTILO[sem].fg)}>{ESTILO[sem].texto}</p>
            {sem === 'alerta' && <a href="tel:123" className="min-h-[56px] rounded-xl bg-danger text-white text-base font-bold flex items-center justify-center">Llamar al 123</a>}
            <AnadirABitacora detalle={`Respiraciones: ${rpm}/min (${ESTILO[sem].titulo})`} />
            <button type="button" onClick={reiniciar} className={BOTON_NEUTRO}>Nueva medición</button>
          </div>
        )}
      </div>

      <p className="text-[11px] text-muted">Rangos en reposo (orientativos, AHA/PALS): 6–11 años normal 18–25; 12–17 y adulto normal 12–20. Cuente una subida y bajada del pecho como una respiración.</p>

      {registro.length > 0 && (
        <div className="border-t border-line pt-3 flex flex-col gap-2">
          <p className="text-xs font-bold text-strong">Registro de esta sesión</p>
          <ul className="flex flex-col gap-1">
            {registro.map((m, i) => <li key={i} className="text-xs text-soft">{formatearMedicionResp(m)}</li>)}
          </ul>
          <div className="flex gap-2">
            <button type="button" onClick={() => copiar(formatearRegistroResp(registro))} className={cn(BOTON_NEUTRO, 'flex-1')}>{copiado ? 'Copiado' : 'Copiar registro'}</button>
            <button type="button" onClick={() => setRegistro([])} className={BOTON_NEUTRO}>Borrar registro</button>
          </div>
          <p className="text-[11px] text-muted">Solo queda en este dispositivo; no se envía a ningún servidor.</p>
        </div>
      )}
    </div>
  );
}
