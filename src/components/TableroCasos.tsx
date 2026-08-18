// Tablero de casos (contención emocional + remisiones al seguro).
// docs/plan-gestor-casos.md sección 5: UNA sola implementación, renderizada
// tanto en la pestaña "Casos" de GestionRiesgo.tsx como en la pestaña
// "Informes" de PanelAdmin.tsx. No asumir dónde vive: no lee ni escribe rutas,
// ni estado del store distinto de userId.
import { useEffect, useState, useCallback } from 'react';
import { cn } from '../lib/utils';
import {
  listarInformesContencion,
  listarRemisionesSeguro,
  listarSeguimientos,
} from '../data/api';
import type { InformeContencion, RemisionSeguro } from '../data/api';
import {
  SeguimientoCaso,
  diasSinSeguimiento,
  nivelAlerta,
} from './SeguimientoCaso';
import type { CasoResumen } from './SeguimientoCaso';
import type { SeguimientoCaso as SeguimientoCasoTipo } from '../data/api';

// Un caso conserva el registro original (informe o remisión) para poder
// mostrar los datos completos en el detalle — CasoResumen (el contrato del
// Lote 3) solo trae lo mínimo que necesitan las tarjetas y el badge.
interface CasoCompleto extends CasoResumen {
  raw: InformeContencion | RemisionSeguro;
}

function informeAResumen(i: InformeContencion, ultimo?: string): CasoCompleto {
  return {
    id: i.id, tipo: 'contencion', estudianteNombre: i.estudianteNombre, grado: i.grado,
    fecha: i.fecha, estado: i.estado ?? 'abierto', proximaRevision: i.proximaRevision,
    ultimoSeguimiento: ultimo, raw: i,
  };
}

function remisionAResumen(r: RemisionSeguro, ultimo?: string): CasoCompleto {
  return {
    id: r.id, tipo: 'seguro', estudianteNombre: r.estudianteNombre, grado: r.grado,
    fecha: r.fecha, estado: r.estado ?? 'abierto', proximaRevision: r.proximaRevision,
    ultimoSeguimiento: ultimo, raw: r,
  };
}

// Clases completas y literales a propósito — Tailwind solo detecta nombres de
// clase que aparecen tal cual en el código; construirlas con template strings
// (`bg-${x}-soft`) hace que el escáner no las vea y desaparezcan del CSS final.
const ESTILO_ESTADO: Record<CasoResumen['estado'], { chip: string; label: string }> = {
  abierto: { chip: 'bg-info-soft border-info text-info-soft-fg', label: 'Abierto' },
  en_seguimiento: { chip: 'bg-warning-soft border-warning text-warning-soft-fg', label: 'En seguimiento' },
  cerrado: { chip: 'bg-success-soft border-success text-success-soft-fg', label: 'Cerrado' },
};

const ESTILO_ALERTA: Record<'ambar' | 'roja', string> = {
  ambar: 'bg-warning-soft border-warning text-warning-soft-fg',
  roja: 'bg-danger-soft border-danger text-danger-soft-fg',
};

const ESTILO_TIPO: Record<CasoResumen['tipo'], string> = {
  contencion: 'bg-purple-soft border-purple text-purple-soft-fg',
  seguro: 'bg-teal-soft border-teal text-teal-soft-fg',
};

const LABEL_TIPO: Record<CasoResumen['tipo'], string> = {
  contencion: 'Contención',
  seguro: 'Seguro',
};

type FiltroTipo = 'todos' | CasoResumen['tipo'];
type FiltroEstado = 'todos' | CasoResumen['estado'];

function ChipFiltro({ activo, onClick, children }: { activo: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'px-3 py-1.5 rounded-full text-xs font-medium border transition-all whitespace-nowrap',
        activo ? 'bg-accent-soft border-accent text-accent' : 'border-line text-muted hover:text-soft hover:bg-hover',
      )}
    >
      {children}
    </button>
  );
}

function PastillaEstado({ estado }: { estado: CasoResumen['estado'] }) {
  const e = ESTILO_ESTADO[estado];
  return (
    <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full border whitespace-nowrap', e.chip)}>
      {e.label}
    </span>
  );
}

function BadgeAlerta({ caso }: { caso: CasoResumen }) {
  const nivel = nivelAlerta(caso);
  if (nivel === 'ninguna') return null;
  const dias = diasSinSeguimiento(caso);
  return (
    <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full border whitespace-nowrap', ESTILO_ALERTA[nivel])}>
      ⏳ {dias} días sin seguimiento
    </span>
  );
}

function TarjetaCaso({ caso, onClick }: { caso: CasoCompleto; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left rounded-xl border border-line bg-card px-4 py-3 flex flex-col gap-1.5 hover:bg-hover active:bg-elevated transition"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-semibold text-strong truncate">{caso.estudianteNombre}</span>
        <span className="text-[11px] text-muted whitespace-nowrap">{caso.fecha}</span>
      </div>
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className={cn('text-[10px] font-medium px-2 py-0.5 rounded-full border whitespace-nowrap', ESTILO_TIPO[caso.tipo])}>
          {LABEL_TIPO[caso.tipo]}
        </span>
        <span className="text-[11px] text-muted">Grado {caso.grado}</span>
        <PastillaEstado estado={caso.estado} />
        <BadgeAlerta caso={caso} />
      </div>
    </button>
  );
}

function LineaTiempo({ seguimientos }: { seguimientos: SeguimientoCasoTipo[] }) {
  if (seguimientos.length === 0) {
    return <p className="text-xs text-muted py-2">Sin seguimientos registrados todavía.</p>;
  }
  // Del más antiguo al más reciente, como pide la spec.
  const ordenados = [...seguimientos].sort((a, b) => a.fecha.localeCompare(b.fecha));
  return (
    <div className="flex flex-col gap-2">
      {ordenados.map(s => (
        <div key={s.id} className="rounded-xl border border-line bg-elevated px-3 py-2.5 flex flex-col gap-1">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-strong">{s.autorNombre}</span>
            <span className="text-[11px] text-muted whitespace-nowrap">{s.fecha}</span>
          </div>
          <p className="text-xs text-soft leading-relaxed">{s.texto}</p>
          {s.decision === 'cerrar' ? (
            <span className="text-[10px] font-medium text-danger-soft-fg w-fit px-1.5 py-0.5 rounded bg-danger-soft">Cerró el caso</span>
          ) : (
            <span className="text-[10px] font-medium text-info-soft-fg w-fit px-1.5 py-0.5 rounded bg-info-soft">
              Próximo seguimiento: {s.proximaFecha || '—'}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

function DetalleCaso({ caso, onVolver, onActualizado }: {
  caso: CasoCompleto;
  onVolver: () => void;
  onActualizado: () => void;
}) {
  const [seguimientos, setSeguimientos] = useState<SeguimientoCasoTipo[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mostrarFormulario, setMostrarFormulario] = useState(false);

  const cargarSeguimientos = useCallback(() => {
    setCargando(true);
    setError(null);
    listarSeguimientos(caso.id)
      .then(setSeguimientos)
      .catch(() => setError('No se pudieron cargar los seguimientos de este caso.'))
      .finally(() => setCargando(false));
  }, [caso.id]);

  useEffect(() => { cargarSeguimientos(); }, [cargarSeguimientos]);

  const esContencion = caso.tipo === 'contencion';
  const informe = esContencion ? (caso.raw as InformeContencion) : null;
  const remision = !esContencion ? (caso.raw as RemisionSeguro) : null;

  return (
    <div className="flex flex-col gap-4">
      <button
        onClick={onVolver}
        className="self-start px-3 py-2 rounded-lg text-xs font-semibold text-soft border border-line bg-elevated hover:bg-hover transition flex items-center gap-1.5"
      >
        ← Volver a la lista
      </button>

      <div className="rounded-2xl border border-line bg-card px-4 py-4 flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <span className="text-base font-semibold text-strong">{caso.estudianteNombre}</span>
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className={cn('text-[10px] font-medium px-2 py-0.5 rounded-full border whitespace-nowrap', ESTILO_TIPO[caso.tipo])}>
              {LABEL_TIPO[caso.tipo]}
            </span>
            <PastillaEstado estado={caso.estado} />
          </div>
        </div>
        <p className="text-xs text-muted">Grado {caso.grado} · Creado {caso.fecha}</p>
        <BadgeAlerta caso={caso} />

        {informe && (
          <div className="flex flex-col gap-1 pt-1">
            <p className="text-xs text-soft"><span className="text-muted">Docente:</span> {informe.docenteNombre}</p>
            <p className="text-xs text-soft"><span className="text-muted">Director:</span> {informe.director || '—'}</p>
            <p className="text-sm text-strong leading-relaxed pt-1">{informe.descripcion}</p>
            <p className="text-xs text-accent pt-1">Ruta: {informe.rutaTipo === 'externa' ? 'Atención externa' : informe.rutaDetalle}</p>
          </div>
        )}

        {remision && (
          <div className="flex flex-col gap-2 pt-1">
            <p className="text-xs text-soft"><span className="text-muted">Docente:</span> {remision.docenteNombre}</p>
            <a href={remision.fotoUrl} target="_blank" rel="noreferrer" className="w-fit">
              <div className="w-32 aspect-[3/4] rounded-lg overflow-hidden bg-elevated border border-line">
                <img src={remision.fotoUrl} alt={`Remisión de ${remision.estudianteNombre}`} className="w-full h-full object-cover" />
              </div>
            </a>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-strong">Línea de tiempo</h3>
          {!mostrarFormulario && (
            <button
              onClick={() => setMostrarFormulario(true)}
              className="px-3 py-1.5 rounded-full bg-accent text-accent-fg text-xs font-semibold hover:opacity-90 transition"
            >
              + Agregar seguimiento
            </button>
          )}
        </div>

        {mostrarFormulario && (
          <SeguimientoCaso
            caso={caso}
            onCancelar={() => setMostrarFormulario(false)}
            onGuardado={() => {
              setMostrarFormulario(false);
              cargarSeguimientos();
              onActualizado();
            }}
          />
        )}

        {cargando && <div className="text-center py-6 text-soft text-xs">Cargando seguimientos…</div>}
        {error && (
          <div className="rounded-xl bg-danger-soft border border-danger px-3 py-2 text-xs text-danger-soft-fg">
            {error}
          </div>
        )}
        {!cargando && !error && <LineaTiempo seguimientos={seguimientos} />}
      </div>
    </div>
  );
}

export default function TableroCasos() {
  const [casos, setCasos] = useState<CasoCompleto[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filtroTipo, setFiltroTipo] = useState<FiltroTipo>('todos');
  const [filtroEstado, setFiltroEstado] = useState<FiltroEstado>('todos');
  const [casoSeleccionadoId, setCasoSeleccionadoId] = useState<string | null>(null);

  const cargar = useCallback(() => {
    setCargando(true);
    setError(null);
    Promise.all([
      listarInformesContencion(),
      listarRemisionesSeguro(),
      listarSeguimientos(),
    ])
      .then(([informes, remisiones, seguimientos]) => {
        const ultimoPorCaso = new Map<string, string>();
        for (const s of seguimientos) {
          const actual = ultimoPorCaso.get(s.casoId);
          if (!actual || s.fecha > actual) ultimoPorCaso.set(s.casoId, s.fecha);
        }
        const todos: CasoCompleto[] = [
          ...informes.map(i => informeAResumen(i, ultimoPorCaso.get(i.id))),
          ...remisiones.map(r => remisionAResumen(r, ultimoPorCaso.get(r.id))),
        ];
        setCasos(todos);
      })
      // No se esconde el error tras una lista vacía: estos datos exigen sesión
      // válida y el backend filtra por rol, así que un fallo real (token
      // vencido, sin permiso) debe verse, no confundirse con "no hay casos".
      .catch(() => setError('No se pudieron cargar los casos. Verifica tu sesión e intenta de nuevo.'))
      .finally(() => setCargando(false));
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const casoSeleccionado = casoSeleccionadoId
    ? casos.find(c => c.id === casoSeleccionadoId) ?? null
    : null;

  if (casoSeleccionado) {
    return (
      <DetalleCaso
        caso={casoSeleccionado}
        onVolver={() => setCasoSeleccionadoId(null)}
        onActualizado={cargar}
      />
    );
  }

  const casosFiltrados = casos
    .filter(c => filtroTipo === 'todos' || c.tipo === filtroTipo)
    .filter(c => filtroEstado === 'todos' || c.estado === filtroEstado)
    // Los casos con alerta van primero (los que necesitan atención hoy),
    // luego por fecha de creación más reciente.
    .sort((a, b) => {
      const alertaA = nivelAlerta(a) !== 'ninguna';
      const alertaB = nivelAlerta(b) !== 'ninguna';
      if (alertaA !== alertaB) return alertaA ? -1 : 1;
      return b.fecha.localeCompare(a.fecha);
    });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-1.5 flex-wrap">
        <ChipFiltro activo={filtroTipo === 'todos'} onClick={() => setFiltroTipo('todos')}>Todos</ChipFiltro>
        <ChipFiltro activo={filtroTipo === 'contencion'} onClick={() => setFiltroTipo('contencion')}>Contención</ChipFiltro>
        <ChipFiltro activo={filtroTipo === 'seguro'} onClick={() => setFiltroTipo('seguro')}>Seguro</ChipFiltro>
      </div>

      <div className="flex items-center gap-1.5 flex-wrap">
        <ChipFiltro activo={filtroEstado === 'todos'} onClick={() => setFiltroEstado('todos')}>Todos</ChipFiltro>
        <ChipFiltro activo={filtroEstado === 'abierto'} onClick={() => setFiltroEstado('abierto')}>Abiertos</ChipFiltro>
        <ChipFiltro activo={filtroEstado === 'en_seguimiento'} onClick={() => setFiltroEstado('en_seguimiento')}>En seguimiento</ChipFiltro>
        <ChipFiltro activo={filtroEstado === 'cerrado'} onClick={() => setFiltroEstado('cerrado')}>Cerrados</ChipFiltro>
      </div>

      {cargando && <div className="text-center py-8 text-soft text-sm">Cargando casos…</div>}

      {!cargando && error && (
        <div className="rounded-xl bg-danger-soft border border-danger px-4 py-3 text-sm text-danger-soft-fg">
          {error}
        </div>
      )}

      {!cargando && !error && casos.length === 0 && (
        <div className="text-center py-12 text-muted text-sm">Sin casos registrados.</div>
      )}

      {!cargando && !error && casos.length > 0 && casosFiltrados.length === 0 && (
        <div className="text-center py-12 text-muted text-sm">Ningún caso coincide con los filtros elegidos.</div>
      )}

      {!cargando && !error && casosFiltrados.length > 0 && (
        <div className="flex flex-col gap-2.5">
          {casosFiltrados.map(c => (
            <TarjetaCaso key={c.id} caso={c} onClick={() => setCasoSeleccionadoId(c.id)} />
          ))}
        </div>
      )}
    </div>
  );
}
