import { useState } from 'react';
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

// ── Componente principal ──────────────────────────────────────────────────────

export default function GestionRiesgo() {
  const userId = useAppStore(s => s.userId);
  const rol = useAppStore(s => s.rol);
  const sedeActual = useAppStore(s => s.sedeActual);

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
    </div>
  );
}
