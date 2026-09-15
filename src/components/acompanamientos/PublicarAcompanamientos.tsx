// Flujo «Publicar…» (tarea 7): fecha de vigencia → vista previa de avisos →
// confirmar. La escritura real (Firestore + notificaciones + correos) la hace
// `onPublicar`, que vive en VistaHorario.tsx — aquí solo se arma lo que hay
// que publicar y se muestra el resultado.

import { useState } from 'react';
import { cn } from '@/lib/utils';
import type { Distribucion, JornadaAcomp, Publicacion } from '../../data/acompanamientos/tipos';
import { revisar } from '../../data/acompanamientos/revision';
import { publicacionVigente } from '../../data/acompanamientos/vigente';
import { avisosDeCambio, DIA_CAPITALIZADO, type AvisoDocente } from '../../data/acompanamientos/avisos';
import { fechaLegibleAcomp } from '../../data/acompanamientos/textos';

interface Props {
  jornada: JornadaAcomp;
  borrador: Distribucion;
  vigente: Publicacion;
  publicaciones: Publicacion[];
  onPublicar: (dist: Distribucion, vigenteDesde: string, avisos: AvisoDocente[]) => Promise<{ correosFallidos: string[] }>;
  onPublicado: () => void;
  onCancelar: () => void;
}

function fechaHoyLocal(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function diasHasta(desde: string, hasta: string): number {
  const a = new Date(`${desde}T12:00:00`).getTime();
  const b = new Date(`${hasta}T12:00:00`).getTime();
  return Number.isFinite(b) ? Math.round((b - a) / 86_400_000) : 0;
}

// Ya no se usa como fecha por defecto (15-09-2026: se propone hoy).
export function proximoLunes(): string {
  const d = new Date();
  const diaSemana = d.getDay(); // 0=domingo
  const diasHastaLunes = diaSemana === 0 ? 1 : diaSemana === 1 ? 7 : 8 - diaSemana;
  d.setDate(d.getDate() + diasHastaLunes);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function distribucionesIguales(a: Distribucion, b: Distribucion): boolean {
  const clave = (d: Distribucion) => new Set(d.asignaciones.map((x) => `${x.zonaId}|${x.dia}|${x.docenteId}`));
  const sa = clave(a);
  const sb = clave(b);
  if (sa.size !== sb.size) return false;
  for (const k of sa) if (!sb.has(k)) return false;
  return true;
}

type Paso = 'form' | 'previa' | 'publicando' | 'resultado';

export default function PublicarAcompanamientos({
  jornada,
  borrador,
  vigente,
  publicaciones,
  onPublicar,
  onPublicado,
  onCancelar,
}: Props) {
  const hoy = fechaHoyLocal();
  const [fecha, setFecha] = useState(hoy);
  const [paso, setPaso] = useState<Paso>('form');
  const [error, setError] = useState<string | null>(null);
  const [resultado, setResultado] = useState<{ correosFallidos: string[]; avisados: number } | null>(null);

  const { bloqueos } = revisar(borrador);
  const anterior = publicacionVigente(publicaciones, jornada, fecha);
  const avisos = avisosDeCambio(anterior, borrador, fecha);
  const sinCambios = distribucionesIguales(borrador, vigente);

  let motivoDeshabilitado: string | null = null;
  if (bloqueos.length > 0) motivoDeshabilitado = `Hay ${bloqueos.length} casilla${bloqueos.length === 1 ? '' : 's'} o asignación${bloqueos.length === 1 ? '' : 'es'} por resolver`;
  else if (fecha < hoy) motivoDeshabilitado = 'La fecha no puede ser anterior a hoy';
  else if (sinCambios) motivoDeshabilitado = 'No hay cambios frente a la distribución vigente';

  async function confirmarPublicar() {
    setPaso('publicando');
    setError(null);
    try {
      const res = await onPublicar(borrador, fecha, avisos);
      // Se guarda el número ahora: al publicarse, la vigente de esa fecha pasa a ser
      // la nueva y `avisos` se recalcularía en cero.
      setResultado({ ...res, avisados: avisos.length });
      setPaso('resultado');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error desconocido.');
      setPaso('previa');
    }
  }

  if (paso === 'resultado' && resultado) {
    return (
      <div className="space-y-3">
        <div className="rounded-xl border border-success bg-success-soft px-4 py-3 space-y-1">
          <p className="text-success-soft-fg text-sm font-semibold">
            Publicada. Rige desde el {fechaLegibleAcomp(fecha)}. Se avisó a {resultado.avisados} profesor{resultado.avisados === 1 ? '' : 'es'}.
          </p>
          {resultado.correosFallidos.length > 0 && (
            <p className="text-warning-soft-fg text-xs">
              No llegó el correo a: {resultado.correosFallidos.join(', ')}. El aviso en la aplicación sí les llegó.
            </p>
          )}
        </div>
        <button
          onClick={onPublicado}
          className="rounded-lg bg-accent text-accent-fg px-3 py-2 text-sm font-semibold hover:opacity-90 transition"
        >
          Aceptar
        </button>
      </div>
    );
  }

  if (paso === 'publicando') {
    return (
      <div className="rounded-xl border border-line bg-elevated/40 px-4 py-8 text-center">
        <p className="text-soft text-sm">Publicando…</p>
      </div>
    );
  }

  if (paso === 'previa') {
    return (
      <div className="space-y-3">
        {error && (
          <div className="rounded-xl border border-danger bg-danger-soft px-4 py-3">
            <p className="text-danger-soft-fg text-xs font-semibold">No se pudo publicar: {error}.</p>
            <p className="text-danger-soft-fg text-xs mt-1">Tu borrador sigue guardado.</p>
          </div>
        )}
        <div className="rounded-xl border border-line bg-elevated/40 px-4 py-3">
          <p className="text-soft text-xs">
            Se enviará un aviso en la aplicación y un correo a {avisos.length} profesor{avisos.length === 1 ? '' : 'es'}. Nadie más recibe nada.
          </p>
        </div>
        <div className="space-y-2 max-h-[40vh] overflow-y-auto">
          {avisos.length === 0 ? (
            <p className="text-muted text-xs italic">Nadie cambia frente a lo que regía el {fechaLegibleAcomp(fecha)}.</p>
          ) : (
            avisos.map((a) => (
              <div key={a.docenteId} className="rounded-lg border border-line bg-card px-3 py-2">
                <p className="text-strong text-xs font-semibold">{a.nombre}</p>
                <p className="text-muted text-[11px] mt-0.5">
                  {a.antes.length === 0 ? 'ninguno' : a.antes.map((p) => `${DIA_CAPITALIZADO[p.dia]} · ${p.zona}`).join('; ')}
                  {' → '}
                  {a.despues.length === 0 ? 'ninguno' : a.despues.map((p) => `${DIA_CAPITALIZADO[p.dia]} · ${p.zona}`).join('; ')}
                </p>
              </div>
            ))
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setPaso('form')}
            className="rounded-lg border border-line px-3 py-2 text-xs font-medium text-soft hover:bg-hover transition"
          >
            Volver a editar
          </button>
          <button
            onClick={confirmarPublicar}
            className="rounded-lg bg-accent text-accent-fg px-3 py-2 text-xs font-semibold hover:opacity-90 transition"
          >
            Confirmar y publicar
          </button>
        </div>
      </div>
    );
  }

  // paso === 'form'
  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-soft block">¿Desde qué día empieza a regir?</label>
        <p className="text-muted text-[11px]">No es la fecha en que termina: rige desde ese día hasta que se publique otra.</p>
        <input
          type="date"
          value={fecha}
          min={hoy}
          onChange={(e) => setFecha(e.target.value)}
          className="rounded-lg border border-line bg-card px-3 py-2 text-sm text-strong"
        />
        {/^\d{4}-\d{2}-\d{2}$/.test(fecha) && fecha >= hoy && (
          <p className="text-strong text-xs font-semibold">
            Rige desde el {fechaLegibleAcomp(fecha)}{fecha === hoy ? ' (hoy)' : ''} hasta que se publique otra.
          </p>
        )}
        {diasHasta(hoy, fecha) > 14 && (
          <p className="rounded-lg border border-warning bg-warning-soft px-3 py-2 text-warning-soft-fg text-xs">
            ⚠ Faltan {diasHasta(hoy, fecha)} días para que empiece a regir. Hasta entonces todos siguen con la distribución actual. ¿Es la fecha correcta?
          </p>
        )}
      </div>
      {motivoDeshabilitado && (
        <p className="text-warning-soft-fg text-xs">{motivoDeshabilitado}</p>
      )}
      <div className="flex gap-2">
        <button
          onClick={onCancelar}
          className="rounded-lg border border-line px-3 py-2 text-xs font-medium text-soft hover:bg-hover transition"
        >
          Cancelar
        </button>
        <button
          onClick={() => setPaso('previa')}
          disabled={!!motivoDeshabilitado}
          className={cn(
            'rounded-lg px-3 py-2 text-xs font-semibold transition',
            motivoDeshabilitado ? 'bg-elevated text-muted cursor-not-allowed' : 'bg-accent text-accent-fg hover:opacity-90',
          )}
        >
          Ver vista previa
        </button>
      </div>
    </div>
  );
}
