import { useState } from 'react';
import { cn } from '@/lib/utils';
import {
  DIRECCIONES_SEDES, enlaceMapas, formatearCoordenada, mensajeErrorUbicacion, textoCoordenadas, textoParaDictar,
} from '../../data/botiquin/ubicacion';
import type { Posicion } from '../../data/botiquin/ubicacion';
import { AnadirABitacora, BOTON_ACENTO, BOTON_NEUTRO, useCopiar } from './compartido';

export function Ubicacion() {
  const [pos, setPos] = useState<Posicion | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  const { copiado, copiar } = useCopiar();

  const obtener = () => {
    setError('');
    if (!('geolocation' in navigator)) { setError(mensajeErrorUbicacion(2)); return; }
    setCargando(true);
    navigator.geolocation.getCurrentPosition(
      p => { setPos({ lat: p.coords.latitude, lng: p.coords.longitude, precisionM: p.coords.accuracy }); setCargando(false); },
      e => { setError(mensajeErrorUbicacion(e.code)); setCargando(false); },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 },
    );
  };

  return (
    <div className="flex flex-col gap-3">
      <button type="button" onClick={obtener} disabled={cargando} className={cn(BOTON_ACENTO, 'min-h-[64px] w-full disabled:opacity-60')}>
        {cargando ? 'Buscando señal GPS…' : 'Obtener mi ubicación'}
      </button>

      <div role="status" aria-live="polite" className="flex flex-col gap-2">
        {error && <p className="rounded-xl border-2 border-danger bg-danger-soft text-danger-soft-fg text-sm px-4 py-3">{error}</p>}
        {pos && (
          <div className="rounded-xl border-2 border-line bg-card px-4 py-3 flex flex-col gap-2">
            <p className="text-sm text-soft">Latitud <strong className="text-strong tabular-nums text-lg">{formatearCoordenada(pos.lat)}</strong></p>
            <p className="text-sm text-soft">Longitud <strong className="text-strong tabular-nums text-lg">{formatearCoordenada(pos.lng)}</strong></p>
            <p className="text-xs text-muted">Precisión: unos {Math.round(pos.precisionM)} m{pos.precisionM > 100 ? ' (baja: salga a un lugar abierto y repita)' : ''}</p>
            <a href={enlaceMapas(pos)} target="_blank" rel="noopener noreferrer" className={cn(BOTON_NEUTRO, 'flex items-center justify-center')}>Abrir en mapas</a>
            <button type="button" onClick={() => copiar(`${textoCoordenadas(pos)}\n${enlaceMapas(pos)}`)} className={BOTON_NEUTRO}>{copiado ? 'Copiado' : 'Copiar'}</button>
            <div className="rounded-lg border border-line bg-elevated px-3 py-2">
              <p className="text-xs font-bold text-strong mb-1">Para decirle al 123</p>
              <p className="text-sm text-soft leading-relaxed">{textoParaDictar(pos)}</p>
            </div>
            <AnadirABitacora detalle={`Ubicación: ${textoCoordenadas(pos)}`} />
          </div>
        )}
      </div>

      <div className="rounded-xl border border-line bg-card px-4 py-3">
        <p className="text-sm font-bold text-strong mb-1">Direcciones de las sedes</p>
        <ul className="flex flex-col gap-1 text-sm text-soft">
          {DIRECCIONES_SEDES.map(s => (
            <li key={s.sede}><strong className="text-strong">{s.sede}:</strong> {s.direccion}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
