import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { useAppStore } from '../data/store';
import { SEDES, esDirectivo } from '../data/maestros';
import type { SedeId } from '../data/maestros';
import {
  BRIGADAS,
  LIDERES_GESTION_RIESGO,
  RESOLUCION_BRIGADAS,
  brigadasDeDocente,
  liderazgosDeDocente,
} from '../data/brigadas';
import type { Brigada, IntegranteBrigada } from '../data/brigadas';
import { CATEGORIAS_EMERGENCIA, formatearTelefono } from '../data/emergencias';
import type { CategoriaEmergenciaId } from '../data/emergencias';

const JORNADA_LABEL: Record<string, string> = {
  manana: 'Mañana', tarde: 'Tarde', ambas: 'Ambas', nocturna: 'Nocturna',
};

const BRIGADA_EVACUACION = BRIGADAS.find(b => b.id === 'evacuacion')!;

function ChipJornada({ jornada }: { jornada: string }) {
  return (
    <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-elevated border border-line text-muted">
      {JORNADA_LABEL[jornada] ?? jornada}
    </span>
  );
}

// ── Lista de funciones colapsable ────────────────────────────────────────────

function FuncionesDetalle({ funciones }: { funciones: string[] }) {
  return (
    <details className="group">
      <summary className="cursor-pointer text-xs font-medium text-accent select-none list-none flex items-center gap-1">
        <span className="transition-transform group-open:rotate-90">▸</span> Ver funciones
      </summary>
      <ul className="mt-2 flex flex-col gap-1.5 pl-1">
        {funciones.map((f, i) => (
          <li key={i} className="text-xs text-soft leading-relaxed flex gap-2">
            <span className="text-muted flex-shrink-0">•</span>
            <span>{f}</span>
          </li>
        ))}
      </ul>
    </details>
  );
}

// ── Tarjeta "tus brigadas" ────────────────────────────────────────────────────

function TarjetaPertenencia({ titulo, sub, funciones, esLider }: {
  titulo: string; sub?: string; funciones: string[]; esLider?: boolean;
}) {
  return (
    <div className="rounded-xl border border-line bg-card px-4 py-3 flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-strong text-sm font-semibold">{esLider ? '⭐ ' : ''}{titulo}</span>
      </div>
      {sub && <p className="text-xs text-muted">{sub}</p>}
      <FuncionesDetalle funciones={funciones} />
    </div>
  );
}

// ── Sección "brigadas por sede" (directivos) ──────────────────────────────────

function SeccionPorSede() {
  const [sede, setSede] = useState<SedeId>('central');

  const lideres = LIDERES_GESTION_RIESGO.filter(l => l.sede === sede || l.sede === 'todas');

  return (
    <div className="flex flex-col gap-4">
      <h3 className="text-strong text-sm font-semibold">Brigadas por sede</h3>

      <div className="flex items-center gap-1.5 flex-wrap">
        {SEDES.map(s => (
          <button
            key={s.id}
            onClick={() => setSede(s.id)}
            className={cn(
              'px-3 py-1.5 rounded-full text-xs font-medium border transition-all',
              sede === s.id
                ? 'bg-accent-soft border-accent text-accent'
                : 'border-line text-muted hover:text-soft hover:bg-elevated'
            )}
          >
            {s.nombre}
          </button>
        ))}
      </div>

      {lideres.length > 0 && (
        <div className="rounded-xl border border-line bg-elevated px-4 py-3 flex flex-col gap-2">
          <span className="text-xs font-semibold text-strong">Líderes de gestión del riesgo</span>
          <div className="flex flex-col gap-1.5">
            {lideres.map((l, i) => (
              <div key={i} className="flex items-center gap-2 text-xs text-soft">
                <span className="flex-1">{l.nombre}</span>
                <ChipJornada jornada={l.jornada} />
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-col gap-3">
        {BRIGADAS.map(b => {
          const integrantesSede = b.integrantes.filter(i => i.sede === sede || i.sede === 'todas');
          if (integrantesSede.length === 0) return null;
          return (
            <div key={b.id} className="rounded-xl border border-line bg-card px-4 py-3 flex flex-col gap-2">
              <span className="text-sm font-semibold text-strong">{b.nombre}</span>
              <div className="flex flex-col gap-1.5">
                {integrantesSede.map((it, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs text-soft">
                    <span className="flex-1">
                      {it.nombre}
                      {it.nota && <span className="text-muted"> — {it.nota}</span>}
                    </span>
                    <ChipJornada jornada={it.jornada} />
                  </div>
                ))}
              </div>
              <FuncionesDetalle funciones={b.funciones} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Acordeón "todas las brigadas de mi sede" (no directivos) ─────────────────

function AcordeonMiSede({ sede }: { sede: SedeId }) {
  return (
    <details className="rounded-xl border border-line bg-card px-4 py-3">
      <summary className="cursor-pointer text-sm font-medium text-strong select-none">
        Ver todas las brigadas de mi sede
      </summary>
      <div className="mt-3 flex flex-col gap-3">
        {BRIGADAS.map((b: Brigada) => {
          const integrantesSede = b.integrantes.filter(i => i.sede === sede || i.sede === 'todas');
          if (integrantesSede.length === 0) return null;
          return (
            <div key={b.id} className="rounded-lg bg-elevated px-3 py-2.5 flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-strong">{b.nombre}</span>
              {integrantesSede.map((it: IntegranteBrigada, i: number) => (
                <div key={i} className="flex items-center gap-2 text-[11px] text-soft">
                  <span className="flex-1">{it.nombre}</span>
                  <ChipJornada jornada={it.jornada} />
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </details>
  );
}

// ── Números de emergencia ─────────────────────────────────────────────────────

// Clases completas y literales a proposito -- Tailwind solo detecta nombres
// de clase que aparecen tal cual en el codigo fuente; construirlas con
// template strings (`bg-${color}-soft`) hace que el escaner no las vea y
// desaparezcan del CSS final.
const ESTILO_CATEGORIA: Record<CategoriaEmergenciaId, { chipActivo: string; tarjeta: string; titulo: string }> = {
  policia: {
    chipActivo: 'bg-info-soft border-info text-info-soft-fg',
    tarjeta: 'border-info-soft bg-info-soft',
    titulo: 'text-info-soft-fg',
  },
  ninez_familia: {
    chipActivo: 'bg-purple-soft border-purple text-purple-soft-fg',
    tarjeta: 'border-purple-soft bg-purple-soft',
    titulo: 'text-purple-soft-fg',
  },
  salud_mental: {
    chipActivo: 'bg-warning-soft border-warning text-warning-soft-fg',
    tarjeta: 'border-warning-soft bg-warning-soft',
    titulo: 'text-warning-soft-fg',
  },
  salud: {
    chipActivo: 'bg-success-soft border-success text-success-soft-fg',
    tarjeta: 'border-success-soft bg-success-soft',
    titulo: 'text-success-soft-fg',
  },
  bomberos: {
    chipActivo: 'bg-danger-soft border-danger text-danger-soft-fg',
    tarjeta: 'border-danger-soft bg-danger-soft',
    titulo: 'text-danger-soft-fg',
  },
  institucional: {
    chipActivo: 'bg-accent-soft border-accent text-accent',
    tarjeta: 'border-accent-soft bg-accent-soft',
    titulo: 'text-accent',
  },
};
const ESTILO_TODAS = { chipActivo: 'bg-accent-soft border-accent text-accent' };

function ChipCategoria({ activo, icono, nombre, chipActivo, onClick }: {
  activo: boolean; icono: string; nombre: string; chipActivo: string; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'px-3 py-1.5 rounded-full text-xs font-medium border transition-all flex items-center gap-1.5 whitespace-nowrap',
        activo ? chipActivo : 'border-line text-muted hover:text-soft hover:bg-elevated'
      )}
    >
      <span>{icono}</span>
      {nombre}
    </button>
  );
}

function TarjetaContacto({ entidad, telefonos, nota, tarjeta, titulo }: {
  entidad: string; telefonos: string[]; nota?: string; tarjeta: string; titulo: string;
}) {
  return (
    <div className={cn('rounded-xl border px-4 py-3 flex flex-col gap-2', tarjeta)}>
      <span className={cn('text-sm font-semibold', titulo)}>{entidad}</span>
      <div className="flex flex-wrap gap-2">
        {telefonos.map((tel, i) => (
          <a
            key={i}
            href={`tel:${tel}`}
            className="text-xs font-mono font-semibold px-2.5 py-1 rounded-lg bg-card border border-line text-strong hover:bg-elevated transition"
          >
            📞 {formatearTelefono(tel)}
          </a>
        ))}
      </div>
      {nota && <p className="text-[11px] text-muted">{nota}</p>}
    </div>
  );
}

function NumerosEmergencia() {
  const [categoria, setCategoria] = useState<CategoriaEmergenciaId | null>(null);
  const [busqueda, setBusqueda] = useState('');

  const categoriasFiltradas = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();
    return CATEGORIAS_EMERGENCIA
      .filter(c => !categoria || c.id === categoria)
      .map(c => ({
        ...c,
        contactos: texto
          ? c.contactos.filter(k => k.entidad.toLowerCase().includes(texto))
          : c.contactos,
      }))
      .filter(c => c.contactos.length > 0);
  }, [categoria, busqueda]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h3 className="text-strong text-sm font-semibold">📞 Números de emergencia</h3>
        <p className="text-muted text-xs">Institución Educativa Manuel J. Betancur — directorio COPASST.</p>
      </div>

      <input
        type="text"
        value={busqueda}
        onChange={e => setBusqueda(e.target.value)}
        placeholder="Buscar una entidad (ej. policía, ICBF, salud mental)..."
        className="w-full px-3 py-2 rounded-lg border border-line bg-card text-sm text-strong placeholder:text-muted focus:outline-none focus:border-accent"
      />

      <div className="flex items-center gap-1.5 flex-wrap">
        <ChipCategoria
          activo={categoria === null}
          icono="📋"
          nombre="Todas"
          chipActivo={ESTILO_TODAS.chipActivo}
          onClick={() => setCategoria(null)}
        />
        {CATEGORIAS_EMERGENCIA.map(c => (
          <ChipCategoria
            key={c.id}
            activo={categoria === c.id}
            icono={c.icono}
            nombre={c.nombre}
            chipActivo={ESTILO_CATEGORIA[c.id].chipActivo}
            onClick={() => setCategoria(prev => prev === c.id ? null : c.id)}
          />
        ))}
      </div>

      {categoriasFiltradas.length === 0 && (
        <p className="text-xs text-muted text-center py-4">No hay ningún número que coincida con la búsqueda.</p>
      )}

      <div className="flex flex-col gap-5">
        {categoriasFiltradas.map(c => (
          <div key={c.id} className="flex flex-col gap-2">
            <span className="text-xs font-semibold text-soft flex items-center gap-1.5">
              <span>{c.icono}</span> {c.nombre}
            </span>
            <div className="flex flex-col gap-2">
              {c.contactos.map((contacto, i) => (
                <TarjetaContacto
                  key={i}
                  {...contacto}
                  tarjeta={ESTILO_CATEGORIA[c.id].tarjeta}
                  titulo={ESTILO_CATEGORIA[c.id].titulo}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────

type Pestana = 'brigadas' | 'emergencias';

export default function GestionRiesgo() {
  const userId = useAppStore(s => s.userId);
  const rol = useAppStore(s => s.rol);
  const sedeActual = useAppStore(s => s.sedeActual);
  const [pestana, setPestana] = useState<Pestana>('brigadas');

  const pertenencias = userId ? brigadasDeDocente(userId) : [];
  const liderazgos = userId ? liderazgosDeDocente(userId) : [];
  const yaTieneEvacuacion = pertenencias.some(p => p.brigada.id === 'evacuacion');

  return (
    <div className="max-w-2xl mx-auto flex flex-col gap-6">

      {/* Encabezado */}
      <div className="flex flex-col gap-1">
        <h2 className="text-strong text-lg font-semibold">Gestión del Riesgo</h2>
        <p className="text-muted text-xs">{RESOLUCION_BRIGADAS.titulo}</p>
      </div>

      {/* Pestañas */}
      <div className="flex items-center gap-1.5 border-b border-line pb-2">
        <button
          onClick={() => setPestana('brigadas')}
          className={cn(
            'px-3 py-1.5 rounded-full text-xs font-medium border transition-all',
            pestana === 'brigadas'
              ? 'bg-accent-soft border-accent text-accent'
              : 'border-line text-muted hover:text-soft hover:bg-elevated'
          )}
        >
          🧑‍🚒 Brigadas
        </button>
        <button
          onClick={() => setPestana('emergencias')}
          className={cn(
            'px-3 py-1.5 rounded-full text-xs font-medium border transition-all',
            pestana === 'emergencias'
              ? 'bg-accent-soft border-accent text-accent'
              : 'border-line text-muted hover:text-soft hover:bg-elevated'
          )}
        >
          📞 Números de emergencia
        </button>
      </div>

      {pestana === 'emergencias' ? (
        <NumerosEmergencia />
      ) : (
        <>
          {/* Tus brigadas */}
          <div className="flex flex-col gap-3">
            <h3 className="text-strong text-sm font-semibold">🧑‍🚒 Tus brigadas</h3>

            {liderazgos.map((l, i) => (
              <TarjetaPertenencia
                key={`lider-${i}`}
                titulo="Líder de gestión del riesgo"
                sub={`${SEDES.find(s => s.id === l.sede)?.nombre ?? 'Todas las sedes'} · ${JORNADA_LABEL[l.jornada]}`}
                funciones={['Coordinar la respuesta a emergencias de la sede.', 'Activar las brigadas correspondientes según el tipo de emergencia.', 'Servir de enlace con DAGRD, SED y organismos de apoyo.']}
                esLider
              />
            ))}

            {pertenencias.map(({ brigada, integrante }, i) => (
              <TarjetaPertenencia
                key={`${brigada.id}-${i}`}
                titulo={brigada.nombre}
                sub={`${SEDES.find(s => s.id === integrante.sede)?.nombre ?? 'Todas las sedes'} · ${JORNADA_LABEL[integrante.jornada]}${integrante.nota ? ` · ${integrante.nota}` : ''}`}
                funciones={brigada.funciones}
              />
            ))}

            {!yaTieneEvacuacion && rol === 'docente' && (
              <TarjetaPertenencia
                titulo="Brigada de evacuación (todos los docentes en aula)"
                sub="Artículo 3 de la resolución — aplica a todo docente presente en el aula."
                funciones={BRIGADA_EVACUACION.funciones}
              />
            )}
          </div>

          {/* Brigadas por sede — solo directivos */}
          {esDirectivo(rol) && <SeccionPorSede />}

          {/* Acordeón para no directivos */}
          {!esDirectivo(rol) && <AcordeonMiSede sede={sedeActual} />}
        </>
      )}
    </div>
  );
}
