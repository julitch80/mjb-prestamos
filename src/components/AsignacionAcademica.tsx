import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronDown, GraduationCap, Users } from 'lucide-react';
import { useAppStore } from '../data/store';
import {
  USUARIOS,
  DIRECTORES_MANANA,
  DIRECTORES_TARDE,
  colorGrado,
} from '../data/maestros';
import {
  asignacionDeDocente,
  horasDeDocente,
  docentesConAsignacion,
  DOCENTES_APOYO,
} from '../data/asignacionAcademica';
import { cn } from '@/lib/utils';

type FiltroJornada = 'todas' | 'manana' | 'tarde';

// Grupo que dirige un docente (si es director), en cualquiera de las jornadas.
function grupoQueDirige(docenteId: string): string | null {
  for (const [grupo, id] of Object.entries(DIRECTORES_MANANA)) if (id === docenteId) return grupo;
  for (const [grupo, id] of Object.entries(DIRECTORES_TARDE)) if (id === docenteId) return grupo;
  return null;
}

function esGrupoTarde(grupo: string) {
  return grupo.includes('º');
}

// ── Ficha expandida de un docente ─────────────────────────────────────────────

function FichaDocente({ docenteId }: { docenteId: string }) {
  const usuario = USUARIOS.find(u => u.id === docenteId);
  const resumen = asignacionDeDocente(docenteId);
  const dirige  = grupoQueDirige(docenteId);
  const apoyo   = DOCENTES_APOYO[docenteId];

  if (!usuario) return null;

  if (apoyo) return (
    <div className="text-sm text-muted px-1 py-2">
      {apoyo} — sin asignación académica por grupos.
    </div>
  );

  return (
    <div className="space-y-3 pt-1">
      <div className="flex flex-wrap gap-2 text-xs">
        <span className="px-3 py-1.5 rounded-full bg-elevated border border-line text-soft">
          Total: <span className="font-semibold text-strong">{horasDeDocente(docenteId)} h/semana</span>
        </span>
        {dirige && (
          <span className="px-3 py-1.5 rounded-full bg-elevated border border-line text-soft">
            Director de grupo: <span className="font-semibold" style={{ color: colorGrado(dirige) }}>{dirige}</span>
          </span>
        )}
      </div>
      <div className="space-y-2">
        {resumen.map(({ asignatura, grupos, totalHoras }) => (
          <div key={asignatura.id} className="rounded-xl border border-line bg-elevated/40 p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="font-semibold text-sm text-strong">{asignatura.nombre}</span>
              <span className="text-xs text-muted">{totalHoras} h</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {grupos.map(({ grupo, horas }) => (
                <span
                  key={grupo}
                  className="px-2 py-1 rounded-lg bg-card border border-line text-[11px]"
                >
                  <span className="font-bold" style={{ color: colorGrado(grupo) }}>{grupo}</span>
                  <span className="text-muted"> · {horas}h</span>
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Vista principal ───────────────────────────────────────────────────────────

export default function AsignacionAcademica() {
  const { userId, rol } = useAppStore();
  const esDirectivo = rol === 'rectora' || rol === 'coordinador';

  const [filtro, setFiltro] = useState<FiltroJornada>('todas');
  const [abierto, setAbierto] = useState<string | null>(esDirectivo ? null : userId);

  const plantel = useMemo(() => {
    const ids = docentesConAsignacion();
    return ids
      .map(id => {
        const usuario = USUARIOS.find(u => u.id === id);
        const resumen = asignacionDeDocente(id);
        const grupos  = new Set(resumen.flatMap(r => r.grupos.map(g => g.grupo)));
        const enManana = [...grupos].some(g => !esGrupoTarde(g));
        const enTarde  = [...grupos].some(g => esGrupoTarde(g));
        return usuario ? {
          usuario,
          resumen,
          enManana,
          enTarde,
          total: horasDeDocente(id),
          dirige: grupoQueDirige(id),
        } : null;
      })
      .filter((d): d is NonNullable<typeof d> => d !== null)
      .filter(d =>
        filtro === 'todas' ? true :
        filtro === 'manana' ? d.enManana : d.enTarde
      )
      .sort((a, b) => a.usuario.nombreCorto.localeCompare(b.usuario.nombreCorto, 'es'));
  }, [filtro]);

  const apoyo = Object.keys(DOCENTES_APOYO)
    .map(id => USUARIOS.find(u => u.id === id))
    .filter((u): u is NonNullable<typeof u> => !!u);

  const miFicha = !esDirectivo && userId && docentesConAsignacion().includes(userId);
  const soyApoyo = !esDirectivo && userId && DOCENTES_APOYO[userId];

  return (
    <div className="space-y-5">

      {/* ── Mi asignación (docentes) ─────────────────────────────── */}
      {(miFicha || soyApoyo) && (
        <section className="rounded-2xl border border-line bg-card p-4">
          <div className="flex items-center gap-2 mb-1">
            <GraduationCap size={18} className="text-soft" />
            <h2 className="font-bold text-strong">Mi asignación 2026</h2>
          </div>
          <FichaDocente docenteId={userId!} />
        </section>
      )}

      {/* ── Plantel ──────────────────────────────────────────────── */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Users size={18} className="text-soft" />
            <h2 className="font-bold text-strong">
              {esDirectivo ? 'Asignación académica 2026' : 'Plantel docente'}
            </h2>
          </div>
          <div className="flex gap-1 ml-auto">
            {(['todas', 'manana', 'tarde'] as const).map(f => (
              <button
                key={f}
                onClick={() => setFiltro(f)}
                className={cn(
                  'px-3 py-1.5 rounded-full text-xs font-medium border transition-all',
                  filtro === f
                    ? 'bg-hover text-strong border-line-strong'
                    : 'text-muted border-line hover:text-soft hover:bg-elevated'
                )}
              >
                {f === 'todas' ? 'Todas' : f === 'manana' ? 'Mañana' : 'Tarde'}
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-line bg-elevated/40 divide-y divide-[var(--color-line)]">
          {plantel.map(({ usuario, resumen, total, dirige, enManana, enTarde }) => {
            const materias = [...new Set(resumen.map(r => r.asignatura.nombre))];
            const estaAbierto = abierto === usuario.id;
            return (
              <div key={usuario.id}>
                <button
                  onClick={() => setAbierto(estaAbierto ? null : usuario.id)}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-elevated transition-colors"
                >
                  <span
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: usuario.color }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm" style={{ color: usuario.color }}>
                        {usuario.nombreCorto}
                      </span>
                      {dirige && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-card border border-line text-muted">
                          Dir. <span style={{ color: colorGrado(dirige) }}>{dirige}</span>
                        </span>
                      )}
                      {enManana && enTarde && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-warning-soft border border-warning text-warning-soft-fg">
                          mixta
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-muted truncate mt-0.5">
                      {materias.join(' · ')}
                    </div>
                  </div>
                  <span className="text-xs text-muted flex-shrink-0">{total} h</span>
                  <ChevronDown
                    size={14}
                    className={cn('text-muted transition-transform flex-shrink-0', estaAbierto ? 'rotate-180' : '')}
                  />
                </button>
                <AnimatePresence>
                  {estaAbierto && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.18 }}
                      className="overflow-hidden"
                    >
                      <div className="px-4 pb-4">
                        <FichaDocente docenteId={usuario.id} />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>

        {/* Docentes de apoyo */}
        {filtro === 'todas' && apoyo.length > 0 && (
          <div className="rounded-2xl border border-line bg-elevated/40 px-4 py-3 space-y-1.5">
            <div className="text-xs text-muted font-medium mb-1">Docentes de apoyo</div>
            {apoyo.map(u => (
              <div key={u.id} className="flex items-center gap-3 text-sm">
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: u.color }} />
                <span className="font-semibold" style={{ color: u.color }}>{u.nombreCorto}</span>
                <span className="text-xs text-muted">{DOCENTES_APOYO[u.id]}</span>
              </div>
            ))}
          </div>
        )}

        <p className="text-[11px] text-muted px-1">
          Primaria se agregará cuando estén disponibles los datos de las sedes.
        </p>
      </section>
    </div>
  );
}
