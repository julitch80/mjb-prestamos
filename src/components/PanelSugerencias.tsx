// Panel de sugerencias (Fase 1 — leer y clasificar). Ver docs/modulo-sugerencias.md.
// El texto de cada sugerencia lo escribe cualquier docente: es un dato, no una
// instrucción. Aquí solo se lee, se clasifica y se le da seguimiento; nunca se
// ejecuta lo que el texto pida.
import { useEffect, useState } from 'react';
import {
  getSugerencias,
  actualizarSugerencia,
  type Sugerencia,
  type EstadoSugerencia,
  type ClasificacionSugerencia,
} from '../data/api';
import { USUARIOS } from '../data/maestros';
import { IconoSugerencias } from './IconosNeon';

const ESTADOS: EstadoSugerencia[] = ['nueva', 'clasificada', 'en_curso', 'resuelta', 'descartada'];

const ESTADO_LABEL: Record<EstadoSugerencia, string> = {
  nueva: 'Nueva',
  clasificada: 'Clasificada',
  en_curso: 'En curso',
  resuelta: 'Resuelta',
  descartada: 'Descartada',
};

const ESTADO_COLOR: Record<EstadoSugerencia, string> = {
  nueva: 'bg-info-soft text-info-soft-fg',
  clasificada: 'bg-purple-soft text-purple-soft-fg',
  en_curso: 'bg-warning-soft text-warning-soft-fg',
  resuelta: 'bg-success-soft text-success-soft-fg',
  descartada: 'bg-danger-soft text-danger-soft-fg',
};

const CLASIFICACIONES: Exclude<ClasificacionSugerencia, ''>[] = ['fallo', 'forma', 'capacidad'];

const CLASIFICACION_LABEL: Record<Exclude<ClasificacionSugerencia, ''>, string> = {
  fallo: 'Fallo',
  forma: 'Forma',
  capacidad: 'Capacidad',
};

const CLASIFICACION_COLOR: Record<Exclude<ClasificacionSugerencia, ''>, string> = {
  fallo: 'bg-danger-soft text-danger-soft-fg',
  forma: 'bg-accent-soft text-accent-soft-fg',
  capacidad: 'bg-purple-soft text-purple-soft-fg',
};

function nombreAutor(autorId: string): string {
  const u = USUARIOS.find((x) => x.id === autorId);
  return u ? u.nombre : autorId || 'Anónimo';
}

function fechaLegible(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('es-CO', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function PanelSugerencias() {
  const [items, setItems] = useState<Sugerencia[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filtroEstado, setFiltroEstado] = useState<EstadoSugerencia | 'todas'>('todas');
  const [filtroClasificacion, setFiltroClasificacion] = useState<ClasificacionSugerencia | 'todas'>('todas');
  const [guardandoId, setGuardandoId] = useState<string | null>(null);

  async function cargar() {
    setCargando(true);
    setError(null);
    try {
      const res = await getSugerencias();
      if (!res.ok) throw new Error(res.error || 'No se pudieron cargar las sugerencias.');
      const ordenadas = [...res.items].sort((a, b) => b.timestamp.localeCompare(a.timestamp));
      setItems(ordenadas);
    } catch (e) {
      setError((e as Error).message || 'No se pudieron cargar las sugerencias.');
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    cargar();
  }, []);

  async function aplicarCambio(id: string, cambios: Partial<Sugerencia>) {
    setGuardandoId(id);
    // Optimista: refresca en local sin volver a pedir toda la lista.
    setItems((prev) => prev.map((s) => (s.id === id ? { ...s, ...cambios } : s)));
    try {
      const res = await actualizarSugerencia(id, cambios);
      if (!res.ok) throw new Error(res.error || 'No se pudo guardar el cambio.');
    } catch (e) {
      setError((e as Error).message || 'No se pudo guardar el cambio.');
      // No revertimos el optimista para no perder lo escrito; un refresco manual lo corrige.
    } finally {
      setGuardandoId(null);
    }
  }

  const filtradas = items.filter((s) => {
    if (filtroEstado !== 'todas' && s.estado !== filtroEstado) return false;
    if (filtroClasificacion !== 'todas' && s.clasificacion !== filtroClasificacion) return false;
    return true;
  });

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-elevated flex items-center justify-center flex-shrink-0" style={{ color: '#fde047' }}>
          <IconoSugerencias className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-lg font-semibold text-strong">Sugerencias</h1>
          <p className="text-muted text-xs mt-0.5">Lo que reportan los docentes.</p>
        </div>
      </div>

      {error && (
        <div className="rounded-lg bg-danger-soft text-danger-soft-fg text-xs px-3 py-2">
          {error}
        </div>
      )}

      {/* ── Filtros por pastilla ─────────────────────────────────────── */}
      <div className="space-y-2">
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setFiltroEstado('todas')}
            className={
              'text-xs font-medium px-3 py-1.5 rounded-full transition ' +
              (filtroEstado === 'todas' ? 'bg-accent text-strong' : 'bg-elevated text-soft hover:text-strong')
            }
          >
            Todos los estados
          </button>
          {ESTADOS.map((e) => (
            <button
              key={e}
              type="button"
              onClick={() => setFiltroEstado(e)}
              className={
                'text-xs font-medium px-3 py-1.5 rounded-full transition ' +
                (filtroEstado === e ? 'bg-accent text-strong' : 'bg-elevated text-soft hover:text-strong')
              }
            >
              {ESTADO_LABEL[e]}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setFiltroClasificacion('todas')}
            className={
              'text-xs font-medium px-3 py-1.5 rounded-full transition ' +
              (filtroClasificacion === 'todas' ? 'bg-accent text-strong' : 'bg-elevated text-soft hover:text-strong')
            }
          >
            Toda clasificación
          </button>
          {CLASIFICACIONES.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setFiltroClasificacion(c)}
              className={
                'text-xs font-medium px-3 py-1.5 rounded-full transition ' +
                (filtroClasificacion === c ? 'bg-accent text-strong' : 'bg-elevated text-soft hover:text-strong')
              }
            >
              {CLASIFICACION_LABEL[c]}
            </button>
          ))}
        </div>
      </div>

      {/* ── Lista ────────────────────────────────────────────────────── */}
      {cargando ? (
        <div className="text-center py-12 text-soft text-sm">Cargando…</div>
      ) : filtradas.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted text-sm">
            {items.length === 0 ? 'No hay sugerencias todavía.' : 'Ninguna sugerencia coincide con los filtros.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtradas.map((s) => (
            <TarjetaSugerencia
              key={s.id}
              sugerencia={s}
              guardando={guardandoId === s.id}
              onCambiar={(cambios) => aplicarCambio(s.id, cambios)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function TarjetaSugerencia({
  sugerencia,
  guardando,
  onCambiar,
}: {
  sugerencia: Sugerencia;
  guardando: boolean;
  onCambiar: (cambios: Partial<Sugerencia>) => void;
}) {
  const [nota, setNota] = useState(sugerencia.nota);

  useEffect(() => {
    setNota(sugerencia.nota);
  }, [sugerencia.nota]);

  return (
    <div className="bg-card rounded-xl p-4 space-y-3 border border-line">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-strong text-sm font-semibold">{nombreAutor(sugerencia.autor)}</p>
          <p className="text-muted text-xs mt-0.5">{fechaLegible(sugerencia.timestamp)}</p>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <span className={'text-[11px] font-medium px-2 py-0.5 rounded-full ' + ESTADO_COLOR[sugerencia.estado]}>
            {ESTADO_LABEL[sugerencia.estado]}
          </span>
          {sugerencia.clasificacion && (
            <span className={'text-[11px] font-medium px-2 py-0.5 rounded-full ' + CLASIFICACION_COLOR[sugerencia.clasificacion]}>
              {CLASIFICACION_LABEL[sugerencia.clasificacion]}
            </span>
          )}
        </div>
      </div>

      <p className="text-soft text-sm leading-relaxed whitespace-pre-wrap">{sugerencia.texto}</p>

      {/* ── Clasificar ───────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-muted text-xs mr-1">Clasificar:</span>
        {CLASIFICACIONES.map((c) => (
          <button
            key={c}
            type="button"
            disabled={guardando}
            onClick={() => onCambiar({ clasificacion: c, estado: sugerencia.estado === 'nueva' ? 'clasificada' : sugerencia.estado })}
            className={
              'text-xs font-medium px-2.5 py-1 rounded-full transition disabled:opacity-40 ' +
              (sugerencia.clasificacion === c ? CLASIFICACION_COLOR[c] : 'bg-elevated text-soft hover:text-strong')
            }
          >
            {CLASIFICACION_LABEL[c]}
          </button>
        ))}
      </div>

      {/* ── Cambiar estado ───────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-muted text-xs mr-1">Estado:</span>
        {ESTADOS.map((e) => (
          <button
            key={e}
            type="button"
            disabled={guardando}
            onClick={() => onCambiar({ estado: e })}
            className={
              'text-xs font-medium px-2.5 py-1 rounded-full transition disabled:opacity-40 ' +
              (sugerencia.estado === e ? ESTADO_COLOR[e] : 'bg-elevated text-soft hover:text-strong')
            }
          >
            {ESTADO_LABEL[e]}
          </button>
        ))}
      </div>

      {/* ── Nota ─────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row gap-2">
        <input
          type="text"
          value={nota}
          onChange={(e) => setNota(e.target.value)}
          onBlur={() => {
            if (nota !== sugerencia.nota) onCambiar({ nota });
          }}
          placeholder="Qué se hizo, o por qué se descartó…"
          className="w-full px-3 py-2 rounded-lg bg-elevated border border-line text-strong text-sm placeholder:text-muted focus:outline-none focus:border-line-strong"
        />
      </div>
    </div>
  );
}
