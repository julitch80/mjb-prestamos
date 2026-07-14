import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useAppStore } from '../data/store';
import {
  USUARIOS,
  BLOQUES_MANANA,
  BLOQUES_TARDE,
  DESCANSOS_MANANA,
  DESCANSOS_TARDE,
  DIRECTORES_MANANA,
  DIRECTORES_TARDE,
  AULA_GRUPO_TARDE,
  COLORES_AULA,
  ACOMPAÑAMIENTOS,
  ZONAS_ACOMPANAMIENTO,
  ZONAS_ACOMPANAMIENTO_TARDE,
  MOMENTOS_TARDE,
  colorGrado,
  horaOrdinal,
  getDocentes,
  MIXTOS_TARDE,
  compararAulas,
  compararGrupos,
  esCIBloque,
  esCIDocente,
} from '../data/maestros';
import { horarioBase } from '../data/horarioBase';
import { abrevDeCelda, asignaturasDeCelda, ASIGNACION_2026, getAsignatura } from '../data/asignacionAcademica';
import { cn } from '@/lib/utils';
import EditorHorarioWizard from './EditorHorarioWizard';
import EditorHorarioMode from './EditorHorarioMode';
import ModalDiaModificado from './ModalDiaModificado';
import ModalAcortarJornada from './ModalAcortarJornada';
import ModalRevisarPublicacion from './ModalRevisarPublicacion';
import { modificacionesProximas, jornadasReducidasProximas, formatearFechaLegible } from '../data/horarioModificado';
import type { HorarioModificado, JornadaReducida } from '../data/horarioModificado';
import { publicacionesPendientesDeRevisar } from '../data/publicacion';
import type { PublicacionPendiente } from '../data/publicacion';

type Modo         = 'aulas' | 'docente' | 'grupo' | 'acompanamiento';
type VistaDetalle = 'semana' | 'dia';

const DIAS = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes'] as const;
const DIAS_LABEL: Record<string, string> = {
  lunes: 'Lunes', martes: 'Martes', miercoles: 'Miércoles', jueves: 'Jueves', viernes: 'Viernes',
};
const DIAS_CORTO: Record<string, string> = {
  lunes: 'Lu', martes: 'Ma', miercoles: 'Mi', jueves: 'Ju', viernes: 'Vi',
};

function docenteEnTarde(id: string, dia: string) {
  return MIXTOS_TARDE[id]?.includes(dia) ?? false;
}

// ── Tab button ───────────────────────────────────────────────────────────────

function TabButton({ active, onClick, children, color = 'blue' }: {
  active: boolean; onClick: () => void; children: React.ReactNode; color?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'relative px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200',
        active ? 'text-strong' : 'text-muted hover:text-soft hover:bg-elevated'
      )}
    >
      {active && (
        <motion.span
          layoutId={`tab-${color}`}
          className="absolute inset-0 rounded-xl bg-hover border border-line-strong"
          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
        />
      )}
      <span className="relative z-10">{children}</span>
    </button>
  );
}

// ── Celda de docente (borde completo) ────────────────────────────────────────

function CeldaDocente({ docenteId, aula }: { docenteId?: string; aula?: string }) {
  const docente = USUARIOS.find(u => u.id === docenteId);
  if (!docente) return (
    <div className="h-full rounded-lg border border-dashed border-line flex items-center justify-center">
      <span className="text-muted opacity-70 text-[10px]">—</span>
    </div>
  );
  const color = docente.color;
  return (
    <div
      className="h-full rounded-lg flex flex-col items-center justify-center px-1 py-1 gap-0.5 overflow-hidden"
      style={{ borderColor: color, borderWidth: 1, backgroundColor: `${color}1a` }}
    >
      <span className="text-[10px] font-bold leading-none truncate w-full text-center" style={{ color }}>
        {docente.nombreCorto}
      </span>
      {aula && (
        <span className="text-[9px] leading-none text-muted truncate w-full text-center">
          {aula}
        </span>
      )}
    </div>
  );
}

function CeldaCI() {
  return (
    <div className="h-full rounded-lg border border-yellow-700/50 bg-warning-soft flex items-center justify-center">
      <span className="text-[10px] text-yellow-400 font-bold">⭐CI</span>
    </div>
  );
}

// ── Fila de descanso (banner entre horas) ────────────────────────────────────

function BannerDescanso({ inicio, fin, lugar }: { inicio: string; fin: string; lugar?: string }) {
  return (
    <div className={cn(
      'flex items-center gap-3 rounded-xl px-4 py-2 text-xs',
      lugar
        ? 'bg-orange-950/40 border border-orange-800/40'
        : 'bg-gray-900/50 border border-white/5'
    )}>
      <div className="flex-1 flex items-center gap-2">
        <span className={lugar ? 'text-orange-400 font-medium' : 'text-muted'}>
          {lugar ? '🧑‍🏫 Acompañamiento' : 'Descanso'}
        </span>
        {lugar && <span className="text-orange-300 font-semibold">{lugar}</span>}
      </div>
      <span className="text-muted tabular-nums">{inicio} – {fin}</span>
    </div>
  );
}

// ── Vista por aulas ──────────────────────────────────────────────────────────

function VistaAulas({ jornadaTab, vistaDetalle, diaSeleccionado, onSetDia }: {
  jornadaTab: 'manana' | 'tarde';
  vistaDetalle: VistaDetalle;
  diaSeleccionado: string;
  onSetDia: (dia: string) => void;
}) {
  const bloques  = jornadaTab === 'tarde' ? BLOQUES_TARDE : BLOQUES_MANANA;
  const entradas = horarioBase.filter(e => e.jornada === jornadaTab);

  const aulasSet = new Set<string>();
  entradas.forEach(e => { if (e.aula) aulasSet.add(e.aula); });
  const aulas = Array.from(aulasSet).sort(compararAulas);

  if (aulas.length === 0) return (
    <div className="text-center py-16 text-muted text-sm">Sin datos de aulas para esta jornada.</div>
  );

  const CELL_H = 48;

  return (
    <div className="space-y-3">
      <AnimatePresence mode="wait">
        {vistaDetalle === 'semana' ? (
          <motion.div key="semana" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="overflow-x-auto rounded-2xl border border-line bg-elevated/40">
              <table className="text-xs border-collapse" style={{ minWidth: 720 }}>
                <thead>
                  {/* Fila de días */}
                  <tr>
                    <th className="sticky left-0 bg-card z-10 text-left text-muted px-3 py-2 w-24 font-medium border-b border-line" />
                    {DIAS.map((dia, di) => (
                      <th
                        key={dia}
                        colSpan={bloques.length}
                        className={cn(
                          'text-center py-2.5 font-semibold text-sm border-b border-line',
                          di > 0 ? 'border-l-[3px] border-line-strong' : '',
                          'text-soft'
                        )}
                      >
                        {DIAS_LABEL[dia]}
                      </th>
                    ))}
                  </tr>
                  {/* Fila de horas */}
                  <tr className="border-b border-line">
                    <th className="sticky left-0 bg-card z-10 text-left text-muted px-3 py-1.5 font-normal text-[10px]">
                      Aula
                    </th>
                    {DIAS.map((dia, di) =>
                      bloques.map((b, bi) => (
                        <th
                          key={`${dia}-${b.id}`}
                          className={cn(
                            'text-center px-0.5 py-1.5 font-normal min-w-[54px]',
                            bi === 0 && di > 0 ? 'border-l-[3px] border-line-strong' : ''
                          )}
                        >
                          <span className="block text-soft text-[10px]">{horaOrdinal(b.id)}</span>
                          <span className="block text-muted opacity-70 text-[9px]">{b.inicio}</span>
                        </th>
                      ))
                    )}
                  </tr>
                </thead>
                <tbody>
                  {aulas.map((aula, ai) => (
                    <tr key={aula} className={cn('border-b border-white/5', ai % 2 !== 0 ? 'bg-elevated/40' : '')}>
                      <td
                        className="px-3 sticky left-0 bg-card z-10"
                        style={{ height: CELL_H }}
                      >
                        <div className="font-bold text-sm" style={{ color: COLORES_AULA[aula] ?? '#fff' }}>{aula}</div>
                        {jornadaTab === 'tarde' && AULA_GRUPO_TARDE[aula] && (
                          <div className="text-[10px] mt-0.5" style={{ color: colorGrado(AULA_GRUPO_TARDE[aula]) }}>
                            {AULA_GRUPO_TARDE[aula]}
                          </div>
                        )}
                      </td>
                      {DIAS.map((dia, di) =>
                        bloques.map((b, bi) => {
                          const entrada = entradas.find(e => e.dia === dia && e.bloque === b.id && e.aula === aula);
                          return (
                            <td
                              key={`${dia}-${b.id}`}
                              className={cn('p-0.5', bi === 0 && di > 0 ? 'border-l-[3px] border-line-strong' : '')}
                              style={{ height: CELL_H }}
                            >
                              <CeldaDocente docenteId={entrada?.docente} />
                            </td>
                          );
                        })
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        ) : (
          <motion.div key="dia" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3">
            {/* Selector de día */}
            <div className="flex gap-1">
              {DIAS.map(dia => (
                <button
                  key={dia}
                  onClick={() => onSetDia(dia)}
                  className={cn(
                    'flex-1 py-2 rounded-xl text-xs font-medium transition-all border',
                    diaSeleccionado === dia
                      ? 'bg-hover text-strong border-line-strong'
                      : 'text-muted border-transparent hover:text-soft hover:bg-elevated'
                  )}
                >
                  {DIAS_CORTO[dia]}
                </button>
              ))}
            </div>
            {/* Tabla por aulas del día */}
            <div className="rounded-2xl border border-line bg-elevated/40 overflow-x-auto">
              <table className="text-xs border-collapse" style={{ minWidth: 560 }}>
                <thead>
                  <tr className="border-b border-line">
                    <th className="text-left text-muted px-3 py-2.5 font-medium w-28">Aula</th>
                    {bloques.map(b => (
                      <th key={b.id} className="text-center px-2 py-2.5 min-w-[80px]">
                        <div className="text-soft font-semibold text-xs">{horaOrdinal(b.id)}</div>
                        <div className="text-muted text-[10px]">{b.inicio} – {b.fin}</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {aulas.map((aula, ai) => (
                    <tr key={aula} className={cn('border-b border-white/5', ai % 2 !== 0 ? 'bg-elevated/40' : '')}>
                      <td className="px-3" style={{ height: CELL_H }}>
                        <div className="font-bold text-sm" style={{ color: COLORES_AULA[aula] ?? '#fff' }}>{aula}</div>
                        {jornadaTab === 'tarde' && AULA_GRUPO_TARDE[aula] && (
                          <div className="text-[10px] mt-0.5" style={{ color: colorGrado(AULA_GRUPO_TARDE[aula]) }}>
                            {AULA_GRUPO_TARDE[aula]}
                          </div>
                        )}
                      </td>
                      {bloques.map(b => {
                        const entrada = entradas.find(e => e.dia === diaSeleccionado && e.bloque === b.id && e.aula === aula);
                        return (
                          <td key={b.id} className="p-1" style={{ height: CELL_H }}>
                            <CeldaDocente docenteId={entrada?.docente} />
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Vista por docente ────────────────────────────────────────────────────────

function VistaDocente({ docenteId, jornadaTab }: { docenteId: string; jornadaTab: 'manana' | 'tarde' }) {
  const [vistaDetalle, setVistaDetalle] = useState<VistaDetalle>('semana');
  const [diaSeleccionado, setDiaSeleccionado] = useState('lunes');

  const bloques   = jornadaTab === 'tarde' ? BLOQUES_TARDE : BLOQUES_MANANA;
  const descansos = jornadaTab === 'tarde' ? DESCANSOS_TARDE : DESCANSOS_MANANA;
  const entradas  = horarioBase.filter(e => e.docente === docenteId && e.jornada === jornadaTab);

  const CELL_H = 52;

  function getAcomp(dia: string, numDescanso: 1 | 2) {
    return ACOMPAÑAMIENTOS.find(a =>
      a.docente === docenteId && a.dia === dia &&
      (a.descansos === 'ambos' || a.descansos === numDescanso) &&
      a.jornada === jornadaTab
    );
  }

  const materiasDocente = [...new Set(
    ASIGNACION_2026.filter(e => e.docenteId === docenteId)
      .map(e => getAsignatura(e.asignaturaId)?.nombre)
      .filter(Boolean)
  )];

  return (
    <div className="space-y-3">
      {materiasDocente.length > 0 && (
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="px-3 py-1.5 rounded-full bg-elevated border border-line text-soft">
            Asignación 2026: <span className="font-semibold text-strong">{materiasDocente.join(' · ')}</span>
          </span>
        </div>
      )}
      <div className="flex gap-1">
        <TabButton active={vistaDetalle === 'semana'} onClick={() => setVistaDetalle('semana')} color="docente">Semana</TabButton>
        <TabButton active={vistaDetalle === 'dia'} onClick={() => setVistaDetalle('dia')} color="docente">Día</TabButton>
      </div>

      <AnimatePresence mode="wait">
        {vistaDetalle === 'semana' ? (
          <motion.div key="semana" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="overflow-x-auto rounded-2xl border border-line bg-elevated/40">
              <table className="text-xs border-collapse" style={{ minWidth: 400 }}>
                <thead>
                  <tr className="border-b border-line">
                    <th className="text-muted px-3 py-2.5 text-left font-medium w-28">Hora</th>
                    {DIAS.map(dia => {
                      const esTarde = docenteEnTarde(docenteId, dia);
                      return (
                        <th key={dia} className={cn(
                          'text-center px-2 py-2.5 font-semibold min-w-[90px]',
                          esTarde ? 'text-warning' : 'text-soft'
                        )}>
                          {DIAS_LABEL[dia].slice(0, 2)}
                          {esTarde && <span className="ml-1 text-warning text-[9px]">T</span>}
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {bloques.flatMap(b => {
                    const rows = [];

                    // Fila principal de la hora
                    rows.push(
                      <tr key={b.id} className="border-b border-white/5">
                        <td className="px-3" style={{ height: CELL_H }}>
                          <div className="font-bold text-strong">{horaOrdinal(b.id)} hora</div>
                          <div className="text-muted text-[10px]">{b.inicio} – {b.fin}</div>
                        </td>
                        {DIAS.map(dia => {
                          const esTardeHoy = docenteEnTarde(docenteId, dia);
                          if (esTardeHoy && jornadaTab === 'manana') return (
                            <td key={dia} className="p-1" style={{ height: CELL_H }}>
                              <div className="h-full rounded-lg bg-warning-soft border border-warning flex items-center justify-center">
                                <span className="text-warning-soft-fg text-[10px]">Tarde</span>
                              </div>
                            </td>
                          );
                          if (esCIDocente(docenteId, dia, b.id, jornadaTab)) return (
                            <td key={dia} className="p-1" style={{ height: CELL_H }}><CeldaCI /></td>
                          );
                          const entrada = entradas.find(e => e.dia === dia && e.bloque === b.id);
                          if (!entrada) return (
                            <td key={dia} className="p-1" style={{ height: CELL_H }}>
                              <div className="h-full rounded-lg border border-dashed border-line flex items-center justify-center">
                                <span className="text-muted opacity-70 text-[10px]">—</span>
                              </div>
                            </td>
                          );
                          const gradoStr = entrada.grado.includes('/') ? entrada.grado.split('/')[0] : entrada.grado;
                          return (
                            <td key={dia} className="p-1" style={{ height: CELL_H }}>
                              <div
                                className="h-full rounded-lg flex flex-col items-center justify-center px-1 gap-0.5"
                                style={{ borderColor: COLORES_AULA[entrada.aula] ?? '#fff', borderWidth: 1, backgroundColor: `${COLORES_AULA[entrada.aula] ?? '#aaa'}1a` }}
                              >
                                <span className="text-[10px] font-bold" style={{ color: COLORES_AULA[entrada.aula] ?? '#aaa' }}>
                                  {entrada.aula || '?'}
                                </span>
                                <span className="text-[9px]" style={{ color: colorGrado(gradoStr) }}>
                                  {gradoStr}
                                </span>
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    );

                    // Fila de descanso después de hora 2 y 4
                    const descanso = descansos.find(d => d.despuesDe === b.id);
                    if (descanso) {
                      rows.push(
                        <tr key={`desc-${b.id}`} className="bg-elevated/40">
                          <td className="px-3 py-1.5">
                            <div className="text-muted opacity-70 text-[10px]">Descanso</div>
                            <div className="text-muted opacity-50 text-[9px]">{descanso.inicio} – {descanso.fin} ({descanso.duracion} min)</div>
                          </td>
                          {DIAS.map(dia => {
                            const acomp = getAcomp(dia, descanso.id as 1 | 2);
                            return (
                              <td key={dia} className="px-1 py-1">
                                {acomp ? (
                                  <div className="rounded-lg bg-orange-950/50 border border-orange-800/40 px-2 py-1 text-center">
                                    <div className="text-orange-400 text-[9px] font-semibold">{acomp.lugar}</div>
                                  </div>
                                ) : (
                                  <div className="h-4" />
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    }

                    return rows;
                  })}
                </tbody>
              </table>
            </div>
          </motion.div>
        ) : (
          <motion.div key="dia" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-2">
            {/* Selector de día */}
            <div className="flex gap-1">
              {DIAS.map(dia => {
                const esTarde = docenteEnTarde(docenteId, dia);
                return (
                  <button
                    key={dia}
                    onClick={() => setDiaSeleccionado(dia)}
                    className={cn(
                      'flex-1 py-2 rounded-xl text-xs font-medium transition-all border',
                      diaSeleccionado === dia
                        ? 'bg-hover text-strong border-line-strong'
                        : 'text-muted border-transparent hover:text-soft hover:bg-elevated',
                      esTarde ? 'border-yellow-800/40' : ''
                    )}
                  >
                    {DIAS_CORTO[dia]}
                    {esTarde && <span className="block text-[9px] text-warning-soft-fg">T</span>}
                  </button>
                );
              })}
            </div>

            {/* Banners del día con descansos intercalados */}
            {bloques.flatMap(b => {
              const items: React.ReactNode[] = [];
              const esTardeHoy = docenteEnTarde(docenteId, diaSeleccionado);
              const esCI = esCIDocente(docenteId, diaSeleccionado, b.id, jornadaTab);

              if (esCI) {
                items.push(
                  <div key={b.id} className="flex items-center gap-3 rounded-xl bg-warning-soft border border-warning p-3">
                    <div className="w-24 flex-shrink-0">
                      <div className="text-yellow-400 font-bold">{horaOrdinal(b.id)} hora</div>
                      <div className="text-warning-soft-fg text-[10px]">{b.inicio} – {b.fin}</div>
                    </div>
                    <span className="text-warning-soft-fg font-semibold">⭐ Centro de Interés</span>
                  </div>
                );
              } else if (esTardeHoy && jornadaTab === 'manana') {
                items.push(
                  <div key={b.id} className="flex items-center gap-3 rounded-xl bg-warning-soft border border-warning p-3">
                    <div className="w-24 flex-shrink-0">
                      <div className="text-warning font-bold">{horaOrdinal(b.id)} hora</div>
                      <div className="text-warning-soft-fg text-[10px]">{b.inicio} – {b.fin}</div>
                    </div>
                    <span className="text-warning-soft-fg text-sm">Jornada tarde</span>
                  </div>
                );
              } else {
                const entrada = entradas.find(e => e.dia === diaSeleccionado && e.bloque === b.id);
                if (!entrada) {
                  items.push(
                    <div key={b.id} className="flex items-center gap-3 rounded-xl border border-dashed border-line p-3 opacity-40">
                      <div className="w-24 flex-shrink-0">
                        <div className="text-muted font-bold">{horaOrdinal(b.id)} hora</div>
                        <div className="text-muted opacity-70 text-[10px]">{b.inicio} – {b.fin}</div>
                      </div>
                      <span className="text-muted">Libre</span>
                    </div>
                  );
                } else {
                  const gradoStr = entrada.grado.includes('/') ? entrada.grado.split('/')[0] : entrada.grado;
                  const aulaColor = COLORES_AULA[entrada.aula] ?? '#aaa';
                  items.push(
                    <div
                      key={b.id}
                      className="flex items-center gap-3 rounded-xl p-3"
                      style={{ borderColor: aulaColor, borderWidth: 1, backgroundColor: `${aulaColor}18` }}
                    >
                      <div className="w-24 flex-shrink-0">
                        <div className="text-strong font-bold">{horaOrdinal(b.id)} hora</div>
                        <div className="text-muted text-[10px]">{b.inicio} – {b.fin}</div>
                      </div>
                      <div className="flex-1">
                        <div className="font-semibold" style={{ color: colorGrado(gradoStr) }}>{gradoStr}</div>
                        {entrada.aula && <div className="text-xs mt-0.5" style={{ color: aulaColor }}>{entrada.aula}</div>}
                      </div>
                    </div>
                  );
                }
              }

              // Insertar banner de descanso después de hora 2 y 4
              const descanso = descansos.find(d => d.despuesDe === b.id);
              if (descanso) {
                const acomp = getAcomp(diaSeleccionado, descanso.id as 1 | 2);
                items.push(
                  <BannerDescanso
                    key={`desc-${b.id}`}
                    inicio={descanso.inicio}
                    fin={descanso.fin}
                    lugar={acomp?.lugar}
                  />
                );
              }

              return items;
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Vista por grupo ──────────────────────────────────────────────────────────

function VistaGrupo({ grado, jornadaTab }: { grado: string; jornadaTab: 'manana' | 'tarde' }) {
  const [vistaDetalle, setVistaDetalle] = useState<VistaDetalle>('semana');
  const [diaSeleccionado, setDiaSeleccionado] = useState('lunes');

  const bloques   = jornadaTab === 'tarde' ? BLOQUES_TARDE : BLOQUES_MANANA;
  const aulaGrupo = Object.entries(AULA_GRUPO_TARDE).find(([, g]) => g === grado)?.[0] ?? '';
  const directores = jornadaTab === 'manana' ? DIRECTORES_MANANA : DIRECTORES_TARDE;
  const director  = USUARIOS.find(u => u.id === directores[grado]);

  const entradas = horarioBase.filter(e => {
    const g = e.grado.includes('/') ? e.grado.split('/')[0] : e.grado;
    return g === grado && e.jornada === jornadaTab;
  });

  const CELL_H = 52;

  return (
    <div className="space-y-3">
      {/* Info director + aula */}
      {(director || aulaGrupo) && (
        <div className="flex flex-wrap gap-3 text-xs">
          {director && (
            <span className="px-3 py-1.5 rounded-full bg-elevated border border-line">
              Director: <span style={{ color: director.color }} className="font-semibold">{director.nombre}</span>
            </span>
          )}
          {aulaGrupo && (
            <span className="px-3 py-1.5 rounded-full bg-elevated border border-line">
              Aula fija: <span style={{ color: COLORES_AULA[aulaGrupo] }} className="font-semibold">{aulaGrupo}</span>
            </span>
          )}
        </div>
      )}

      <div className="flex gap-1">
        <TabButton active={vistaDetalle === 'semana'} onClick={() => setVistaDetalle('semana')} color="grupo">Semana</TabButton>
        <TabButton active={vistaDetalle === 'dia'} onClick={() => setVistaDetalle('dia')} color="grupo">Día</TabButton>
      </div>

      <AnimatePresence mode="wait">
        {vistaDetalle === 'semana' ? (
          <motion.div key="semana" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="overflow-x-auto rounded-2xl border border-line bg-elevated/40">
              <table className="text-xs border-collapse" style={{ minWidth: 400 }}>
                <thead>
                  <tr className="border-b border-line">
                    <th className="text-muted px-3 py-2.5 text-left font-medium w-28">Hora</th>
                    {DIAS.map(dia => (
                      <th key={dia} className="text-center px-2 py-2.5 text-soft font-semibold min-w-[90px]">
                        {DIAS_LABEL[dia].slice(0, 2)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {bloques.map(b => (
                    <tr key={b.id} className="border-b border-white/5">
                      <td className="px-3" style={{ height: CELL_H }}>
                        <div className="font-bold text-strong">{horaOrdinal(b.id)} hora</div>
                        <div className="text-muted text-[10px]">{b.inicio} – {b.fin}</div>
                      </td>
                      {DIAS.map(dia => {
                        const esCI = esCIBloque(dia, b.id, jornadaTab);
                        if (esCI) return <td key={dia} className="p-1" style={{ height: CELL_H }}><CeldaCI /></td>;
                        const entrada = entradas.find(e => e.dia === dia && e.bloque === b.id);
                        if (!entrada) return (
                          <td key={dia} className="p-1" style={{ height: CELL_H }}>
                            <div className="h-full rounded-lg border border-dashed border-line flex items-center justify-center">
                              <span className="text-muted opacity-70 text-[10px]">—</span>
                            </div>
                          </td>
                        );
                        const docente = USUARIOS.find(u => u.id === entrada.docente);
                        return (
                          <td key={dia} className="p-1" style={{ height: CELL_H }}>
                            <div
                              className="h-full rounded-lg flex flex-col items-center justify-center px-1 gap-0.5"
                              style={{ borderColor: docente?.color ?? '#fff', borderWidth: 1, backgroundColor: `${docente?.color ?? '#aaa'}1a` }}
                            >
                              <span className="text-[10px] font-bold truncate w-full text-center" style={{ color: docente?.color ?? '#aaa' }}>
                                {docente?.nombreCorto ?? entrada.docente}
                              </span>
                              <span className="text-[9px] text-muted truncate w-full text-center">
                                {[abrevDeCelda(entrada.docente, grado), entrada.aula ? abrevAula(entrada.aula) : '']
                                  .filter(Boolean).join(' · ')}
                              </span>
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        ) : (
          <motion.div key="dia" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-2">
            <div className="flex gap-1">
              {DIAS.map(dia => (
                <button
                  key={dia}
                  onClick={() => setDiaSeleccionado(dia)}
                  className={cn(
                    'flex-1 py-2 rounded-xl text-xs font-medium transition-all border',
                    diaSeleccionado === dia
                      ? 'bg-hover text-strong border-line-strong'
                      : 'text-muted border-transparent hover:text-soft hover:bg-elevated'
                  )}
                >
                  {DIAS_CORTO[dia]}
                </button>
              ))}
            </div>
            <div className="space-y-2">
              {bloques.map(b => {
                const esCI = esCIBloque(diaSeleccionado, b.id, jornadaTab);
                if (esCI) return (
                  <div key={b.id} className="flex items-center gap-3 rounded-xl bg-warning-soft border border-warning p-3">
                    <div className="w-24 flex-shrink-0">
                      <div className="text-yellow-400 font-bold">{horaOrdinal(b.id)} hora</div>
                      <div className="text-warning-soft-fg text-[10px]">{b.inicio} – {b.fin}</div>
                    </div>
                    <span className="text-warning-soft-fg font-semibold">⭐ Centro de Interés</span>
                  </div>
                );
                const entrada = entradas.find(e => e.dia === diaSeleccionado && e.bloque === b.id);
                const docente = entrada ? USUARIOS.find(u => u.id === entrada.docente) : null;
                if (!entrada) return (
                  <div key={b.id} className="flex items-center gap-3 rounded-xl border border-dashed border-line p-3 opacity-40">
                    <div className="w-24 flex-shrink-0">
                      <div className="text-muted font-bold">{horaOrdinal(b.id)} hora</div>
                      <div className="text-muted opacity-70 text-[10px]">{b.inicio} – {b.fin}</div>
                    </div>
                    <span className="text-muted">Sin clase</span>
                  </div>
                );
                return (
                  <div
                    key={b.id}
                    className="flex items-center gap-3 rounded-xl p-3"
                    style={{ borderColor: docente?.color ?? '#fff', borderWidth: 1, backgroundColor: `${docente?.color ?? '#aaa'}18` }}
                  >
                    <div className="w-24 flex-shrink-0">
                      <div className="text-strong font-bold">{horaOrdinal(b.id)} hora</div>
                      <div className="text-muted text-[10px]">{b.inicio} – {b.fin}</div>
                    </div>
                    <div className="flex-1">
                      <div className="font-semibold" style={{ color: docente?.color ?? '#aaa' }}>
                        {docente?.nombreCorto ?? entrada.docente}
                        {asignaturasDeCelda(entrada.docente, grado).length > 0 && (
                          <span className="text-soft font-normal">
                            {' · '}{asignaturasDeCelda(entrada.docente, grado).map(a => a.nombre).join(' / ')}
                          </span>
                        )}
                      </div>
                      {entrada.aula && <div className="text-xs mt-0.5" style={{ color: COLORES_AULA[entrada.aula] ?? '#aaa' }}>{entrada.aula}</div>}
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Helper ────────────────────────────────────────────────────────────────────

function abrevAula(aula: string): string {
  return aula
    .replace('Aula ', 'A')
    .replace('Lab. Ciencias', 'Lab.')
    .replace('Sala Informática', 'SI')
    .replace('Sala Info.', 'SI');
}

// ── Tabla maestra: todos los docentes × días × horas ─────────────────────────

function TablaDocentesOverview({ jornadaTab, onSelect, vistaDetalle, diaSeleccionado, onSetDia }: {
  jornadaTab: 'manana' | 'tarde';
  onSelect: (id: string) => void;
  vistaDetalle: VistaDetalle;
  diaSeleccionado: string;
  onSetDia: (dia: string) => void;
}) {
  const docentes = getDocentes(jornadaTab);
  const bloques  = jornadaTab === 'tarde' ? BLOQUES_TARDE : BLOQUES_MANANA;
  const CELL_H   = 46;

  // ── Vista día: selector + tabla de 6 columnas ─────────────────────────────
  if (vistaDetalle === 'dia') return (
    <div className="space-y-3">
      <div className="flex gap-1">
        {DIAS.map(dia => (
          <button
            key={dia}
            onClick={() => onSetDia(dia)}
            className={cn(
              'flex-1 py-2 rounded-xl text-xs font-medium transition-all border',
              diaSeleccionado === dia
                ? 'bg-hover text-strong border-line-strong'
                : 'text-muted border-transparent hover:text-soft hover:bg-elevated'
            )}
          >
            {DIAS_CORTO[dia]}
          </button>
        ))}
      </div>
      <div className="overflow-x-auto rounded-2xl border border-line bg-elevated/40">
        <table className="text-xs border-collapse w-full">
          <thead>
            <tr className="border-b border-line">
              <th className="sticky left-0 bg-card z-10 text-left px-3 py-2.5 text-muted font-medium w-28">Docente</th>
              {bloques.map(b => (
                <th key={b.id} className="text-center px-1 py-2.5 min-w-[72px]">
                  <div className="text-soft font-semibold text-xs">{horaOrdinal(b.id)}</div>
                  <div className="text-muted text-[9px]">{b.inicio}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {docentes.map((docente, ri) => {
              const esTardeHoy = docenteEnTarde(docente.id, diaSeleccionado) && jornadaTab === 'manana';
              return (
                <tr key={docente.id} className={cn('border-b border-line', ri % 2 !== 0 ? 'bg-elevated/40' : '')}>
                  <td
                    className="sticky left-0 bg-card z-10 px-3 cursor-pointer group hover:bg-gray-900/80 transition-colors"
                    style={{ height: CELL_H }}
                    onClick={() => onSelect(docente.id)}
                  >
                    <div className="font-bold text-[11px]" style={{ color: docente.color }}>{docente.nombreCorto}</div>
                    <div className="text-[9px] text-muted opacity-70 group-hover:text-muted mt-0.5">ver →</div>
                  </td>
                  {bloques.map(b => {
                    const esCI    = esCIDocente(docente.id, diaSeleccionado, b.id, jornadaTab);
                    const entrada = (!esTardeHoy && !esCI)
                      ? horarioBase.find(e =>
                          e.docente === docente.id && e.dia === diaSeleccionado &&
                          e.bloque === b.id && e.jornada === jornadaTab
                        )
                      : undefined;
                    const gradoStr = entrada?.grado.includes('/') ? entrada.grado.split('/')[0] : entrada?.grado;
                    return (
                      <td key={b.id} className="p-1" style={{ height: CELL_H }}>
                        {esCI ? (
                          <div className="h-full rounded border border-warning bg-warning-soft flex items-center justify-center">
                            <span className="text-warning text-[9px] font-bold">★CI</span>
                          </div>
                        ) : esTardeHoy ? (
                          <div className="h-full rounded border border-warning bg-warning-soft/60 flex items-center justify-center">
                            <span className="text-warning-soft-fg text-[9px]">T</span>
                          </div>
                        ) : entrada ? (
                          <div
                            className="h-full rounded flex flex-col items-center justify-center gap-0.5 px-1"
                            style={{ borderWidth: 1, borderColor: COLORES_AULA[entrada.aula] ?? '#aaa', backgroundColor: `${COLORES_AULA[entrada.aula] ?? '#aaa'}15` }}
                          >
                            <span className="text-[10px] font-bold leading-none" style={{ color: COLORES_AULA[entrada.aula] ?? '#aaa' }}>{abrevAula(entrada.aula)}</span>
                            <span className="text-[9px] leading-none" style={{ color: colorGrado(gradoStr ?? '') }}>{gradoStr}</span>
                          </div>
                        ) : (
                          <div className="h-full rounded border border-dashed border-line flex items-center justify-center">
                            <span className="text-muted opacity-50 text-[9px]">—</span>
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );

  // ── Vista semana: tabla completa (30 columnas) ────────────────────────────
  return (
    <div className="overflow-x-auto rounded-2xl border border-line bg-elevated/40">
      <table className="text-xs border-collapse" style={{ minWidth: 860 }}>
        <thead>
          <tr>
            <th className="sticky left-0 bg-card z-20 w-24 border-b border-line" />
            {DIAS.map((dia, di) => (
              <th
                key={dia}
                colSpan={bloques.length}
                className={cn(
                  'text-center py-2.5 font-semibold text-sm border-b border-line text-soft',
                  di > 0 ? 'border-l-[3px] border-line-strong' : ''
                )}
              >
                {DIAS_LABEL[dia]}
              </th>
            ))}
          </tr>
          <tr className="border-b border-line">
            <th className="sticky left-0 bg-card z-20 px-3 py-1 text-[9px] text-muted font-normal text-left">
              Docente
            </th>
            {DIAS.map((dia, di) =>
              bloques.map((b, bi) => (
                <th
                  key={`${dia}-${b.id}`}
                  className={cn(
                    'text-center py-1 font-normal min-w-[42px]',
                    bi === 0 && di > 0 ? 'border-l-[3px] border-line-strong' : ''
                  )}
                >
                  <span className="text-muted text-[9px]">{horaOrdinal(b.id)}</span>
                </th>
              ))
            )}
          </tr>
        </thead>
        <tbody>
          {docentes.map((docente, ri) => (
            <tr key={docente.id} className={cn('border-b border-line', ri % 2 !== 0 ? 'bg-elevated/40' : '')}>
              <td
                className="sticky left-0 bg-card z-10 px-3 cursor-pointer group hover:bg-gray-900/80 transition-colors"
                style={{ height: CELL_H }}
                onClick={() => onSelect(docente.id)}
              >
                <div className="font-bold text-[11px] leading-tight" style={{ color: docente.color }}>
                  {docente.nombreCorto}
                </div>
                <div className="text-[9px] text-muted opacity-70 group-hover:text-muted transition-colors mt-0.5">
                  ver →
                </div>
              </td>
              {DIAS.map((dia, di) =>
                bloques.map((b, bi) => {
                  const esTardeHoy = docenteEnTarde(docente.id, dia) && jornadaTab === 'manana';
                  const esCI       = esCIDocente(docente.id, dia, b.id, jornadaTab);
                  const entrada    = (!esTardeHoy && !esCI)
                    ? horarioBase.find(e =>
                        e.docente === docente.id && e.dia === dia &&
                        e.bloque === b.id && e.jornada === jornadaTab
                      )
                    : undefined;
                  const gradoStr = entrada?.grado.includes('/')
                    ? entrada.grado.split('/')[0]
                    : entrada?.grado;

                  return (
                    <td
                      key={`${dia}-${b.id}`}
                      className={cn('p-0.5', bi === 0 && di > 0 ? 'border-l-[3px] border-line-strong' : '')}
                      style={{ height: CELL_H }}
                    >
                      {esCI ? (
                        <div className="h-full rounded border border-warning bg-warning-soft flex items-center justify-center">
                          <span className="text-warning text-[9px] font-bold">★CI</span>
                        </div>
                      ) : esTardeHoy ? (
                        <div className="h-full rounded border border-warning bg-warning-soft/60 flex items-center justify-center">
                          <span className="text-warning-soft-fg text-[9px]">T</span>
                        </div>
                      ) : entrada ? (
                        <div
                          className="h-full rounded flex flex-col items-center justify-center gap-0.5 px-0.5"
                          style={{
                            borderWidth: 1,
                            borderColor: COLORES_AULA[entrada.aula] ?? '#aaa',
                            backgroundColor: `${COLORES_AULA[entrada.aula] ?? '#aaa'}15`,
                          }}
                        >
                          <span
                            className="text-[9px] font-bold leading-none w-full text-center truncate"
                            style={{ color: COLORES_AULA[entrada.aula] ?? '#aaa' }}
                          >
                            {abrevAula(entrada.aula)}
                          </span>
                          <span
                            className="text-[8px] leading-none w-full text-center truncate"
                            style={{ color: colorGrado(gradoStr ?? '') }}
                          >
                            {gradoStr}
                          </span>
                        </div>
                      ) : (
                        <div className="h-full rounded border border-dashed border-line flex items-center justify-center">
                          <span className="text-muted opacity-50 text-[9px]">—</span>
                        </div>
                      )}
                    </td>
                  );
                })
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Tabla maestra: todos los grupos × días × horas ───────────────────────────

function TablaGruposOverview({ jornadaTab, onSelect, vistaDetalle, diaSeleccionado, onSetDia }: {
  jornadaTab: 'manana' | 'tarde';
  onSelect: (grado: string) => void;
  vistaDetalle: VistaDetalle;
  diaSeleccionado: string;
  onSetDia: (dia: string) => void;
}) {
  const bloques    = jornadaTab === 'tarde' ? BLOQUES_TARDE : BLOQUES_MANANA;
  const directores = jornadaTab === 'manana' ? DIRECTORES_MANANA : DIRECTORES_TARDE;
  const gruposUnicos = Array.from(new Set(
    horarioBase
      .filter(e => e.jornada === jornadaTab)
      .map(e => e.grado.includes('/') ? e.grado.split('/')[0] : e.grado)
  )).sort(compararGrupos);
  const CELL_H = 46;

  // ── Vista día ─────────────────────────────────────────────────────────────
  if (vistaDetalle === 'dia') return (
    <div className="space-y-3">
      <div className="flex gap-1">
        {DIAS.map(dia => (
          <button
            key={dia}
            onClick={() => onSetDia(dia)}
            className={cn(
              'flex-1 py-2 rounded-xl text-xs font-medium transition-all border',
              diaSeleccionado === dia
                ? 'bg-hover text-strong border-line-strong'
                : 'text-muted border-transparent hover:text-soft hover:bg-elevated'
            )}
          >
            {DIAS_CORTO[dia]}
          </button>
        ))}
      </div>
      <div className="overflow-x-auto rounded-2xl border border-line bg-elevated/40">
        <table className="text-xs border-collapse w-full">
          <thead>
            <tr className="border-b border-line">
              <th className="sticky left-0 bg-card z-10 text-left px-3 py-2.5 text-muted font-medium w-28">Grupo</th>
              {bloques.map(b => (
                <th key={b.id} className="text-center px-1 py-2.5 min-w-[72px]">
                  <div className="text-soft font-semibold text-xs">{horaOrdinal(b.id)}</div>
                  <div className="text-muted text-[9px]">{b.inicio}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {gruposUnicos.map((grado, ri) => {
              const dirId  = directores[grado];
              const dir    = USUARIOS.find(u => u.id === dirId);
              const gColor = colorGrado(grado);
              return (
                <tr key={grado} className={cn('border-b border-line', ri % 2 !== 0 ? 'bg-elevated/40' : '')}>
                  <td
                    className="sticky left-0 bg-card z-10 px-3 cursor-pointer group hover:bg-gray-900/80 transition-colors"
                    style={{ height: CELL_H }}
                    onClick={() => onSelect(grado)}
                  >
                    <div className="font-bold text-[11px]" style={{ color: gColor }}>{grado}</div>
                    {dir && <div className="text-[9px] mt-0.5" style={{ color: dir.color }}>{dir.nombreCorto}</div>}
                  </td>
                  {bloques.map(b => {
                    const esCIcelda = esCIBloque(diaSeleccionado, b.id, jornadaTab);
                    const entrada = !esCIcelda
                      ? horarioBase.find(e => {
                          const g = e.grado.includes('/') ? e.grado.split('/')[0] : e.grado;
                          return g === grado && e.dia === diaSeleccionado && e.bloque === b.id && e.jornada === jornadaTab;
                        })
                      : undefined;
                    const docente = entrada ? USUARIOS.find(u => u.id === entrada.docente) : undefined;
                    return (
                      <td key={b.id} className="p-1" style={{ height: CELL_H }}>
                        {esCIcelda ? (
                          <div className="h-full rounded border border-warning bg-warning-soft flex items-center justify-center">
                            <span className="text-warning text-[9px] font-bold">★CI</span>
                          </div>
                        ) : entrada && docente ? (
                          <div
                            className="h-full rounded flex flex-col items-center justify-center gap-0.5 px-1"
                            style={{ borderWidth: 1, borderColor: docente.color, backgroundColor: `${docente.color}15` }}
                          >
                            <span className="text-[10px] font-bold leading-none" style={{ color: docente.color }}>{docente.nombreCorto.split(' ')[0]}</span>
                            <span className="text-[9px] leading-none text-muted">
                              {[abrevDeCelda(entrada.docente, grado), abrevAula(entrada.aula)].filter(Boolean).join('·')}
                            </span>
                          </div>
                        ) : (
                          <div className="h-full rounded border border-dashed border-line flex items-center justify-center">
                            <span className="text-muted opacity-50 text-[9px]">—</span>
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );

  // ── Vista semana: tabla completa ──────────────────────────────────────────
  return (
    <div className="overflow-x-auto rounded-2xl border border-line bg-elevated/40">
      <table className="text-xs border-collapse" style={{ minWidth: 860 }}>
        <thead>
          <tr>
            <th className="sticky left-0 bg-card z-20 w-28 border-b border-line" />
            {DIAS.map((dia, di) => (
              <th
                key={dia}
                colSpan={bloques.length}
                className={cn(
                  'text-center py-2.5 font-semibold text-sm border-b border-line text-soft',
                  di > 0 ? 'border-l-[3px] border-line-strong' : ''
                )}
              >
                {DIAS_LABEL[dia]}
              </th>
            ))}
          </tr>
          <tr className="border-b border-line">
            <th className="sticky left-0 bg-card z-20 px-3 py-1 text-[9px] text-muted font-normal text-left">
              Grupo
            </th>
            {DIAS.map((dia, di) =>
              bloques.map((b, bi) => (
                <th
                  key={`${dia}-${b.id}`}
                  className={cn(
                    'text-center py-1 font-normal min-w-[42px]',
                    bi === 0 && di > 0 ? 'border-l-[3px] border-line-strong' : ''
                  )}
                >
                  <span className="text-muted text-[9px]">{horaOrdinal(b.id)}</span>
                </th>
              ))
            )}
          </tr>
        </thead>
        <tbody>
          {gruposUnicos.map((grado, ri) => {
            const dirId  = directores[grado];
            const dir    = USUARIOS.find(u => u.id === dirId);
            const gColor = colorGrado(grado);

            return (
              <tr key={grado} className={cn('border-b border-line', ri % 2 !== 0 ? 'bg-elevated/40' : '')}>
                <td
                  className="sticky left-0 bg-card z-10 px-3 cursor-pointer group hover:bg-gray-900/80 transition-colors"
                  style={{ height: CELL_H }}
                  onClick={() => onSelect(grado)}
                >
                  <div className="font-bold text-[11px] leading-tight" style={{ color: gColor }}>
                    {grado}
                  </div>
                  {dir && (
                    <div className="text-[9px] mt-0.5" style={{ color: dir.color }}>
                      {dir.nombreCorto}
                    </div>
                  )}
                </td>
                {DIAS.map((dia, di) =>
                  bloques.map((b, bi) => {
                    const esCI   = esCIBloque(dia, b.id, jornadaTab);
                    const entrada = !esCI
                      ? horarioBase.find(e => {
                          const g = e.grado.includes('/') ? e.grado.split('/')[0] : e.grado;
                          return g === grado && e.dia === dia && e.bloque === b.id && e.jornada === jornadaTab;
                        })
                      : undefined;
                    const docente = entrada ? USUARIOS.find(u => u.id === entrada.docente) : undefined;

                    return (
                      <td
                        key={`${dia}-${b.id}`}
                        className={cn('p-0.5', bi === 0 && di > 0 ? 'border-l-[3px] border-line-strong' : '')}
                        style={{ height: CELL_H }}
                      >
                        {esCI ? (
                          <div className="h-full rounded border border-warning bg-warning-soft flex items-center justify-center">
                            <span className="text-warning text-[9px] font-bold">★CI</span>
                          </div>
                        ) : entrada && docente ? (
                          <div
                            className="h-full rounded flex flex-col items-center justify-center gap-0.5 px-0.5"
                            style={{
                              borderWidth: 1,
                              borderColor: docente.color,
                              backgroundColor: `${docente.color}15`,
                            }}
                          >
                            <span
                              className="text-[9px] font-bold leading-none w-full text-center truncate"
                              style={{ color: docente.color }}
                            >
                              {docente.nombreCorto.split(' ')[0]}
                            </span>
                            <span className="text-[8px] leading-none text-muted w-full text-center truncate">
                              {[abrevDeCelda(entrada.docente, grado), abrevAula(entrada.aula)].filter(Boolean).join('·')}
                            </span>
                          </div>
                        ) : (
                          <div className="h-full rounded border border-dashed border-line flex items-center justify-center">
                            <span className="text-muted opacity-50 text-[9px]">—</span>
                          </div>
                        )}
                      </td>
                    );
                  })
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── Componente principal ─────────────────────────────────────────────────────

export default function VistaHorario() {
  const { jornada, rol, userId, horariosModificados, jornadasReducidas, publicacionesPendientes } = useAppStore();
  const defaultJornada: 'manana' | 'tarde' = jornada === 'tarde' ? 'tarde' : 'manana';

  const [modo, setModo]               = useState<Modo>('docente');
  const [jornadaTab, setJornadaTab]   = useState<'manana' | 'tarde'>(defaultJornada);
  const [docenteSel, setDocenteSel]   = useState(rol === 'docente' ? (userId ?? '') : '');
  const [grupoSel, setGrupoSel]       = useState('');
  const [vistaOverview, setVistaOverview] = useState<VistaDetalle>('semana');
  const [diaOverview, setDiaOverview]     = useState('lunes');

  // Editor de horario
  const [wizardAbierto, setWizardAbierto]   = useState(false);
  const [editandoBorrador, setEditandoBorrador] = useState<HorarioModificado | null>(null);
  const [verDetalleMod, setVerDetalleMod] = useState<HorarioModificado | null>(null);
  const [acortarAbierto, setAcortarAbierto] = useState(false);
  const [verDetalleJr, setVerDetalleJr] = useState<JornadaReducida | null>(null);
  const [revisarPub, setRevisarPub] = useState<PublicacionPendiente | null>(null);

  // Modificaciones y jornadas reducidas próximas — visibles para todos
  const proximasMods = modificacionesProximas(horariosModificados);
  const proximasJr = jornadasReducidasProximas(jornadasReducidas);

  // Publicaciones pendientes de revisar (solo coordinador, las suyas)
  const pubsPendientes = rol === 'coordinador'
    ? publicacionesPendientesDeRevisar(publicacionesPendientes).filter(p => p.autor === userId)
    : [];

  // ¿Hay borrador activo del usuario para entrar al modo edición?
  // Cuando el wizard completa o el usuario decide retomar, este estado activa el editor.
  const borradorActivo = editandoBorrador
    ? horariosModificados.find(h => h.id === editandoBorrador.id) ?? null
    : null;

  // Al cambiar jornada (solo coord/rectora), volver al overview de cada modo
  useEffect(() => {
    if (rol !== 'docente') setDocenteSel('');
    setGrupoSel('');
  }, [jornadaTab, rol]);

  const puedeVerAmbas = rol === 'rectora' || rol === 'coordinador';

  // Botón "Editar": solo el coordinador, en su propia jornada, en vistas docente/grupo
  const jornadaPropia: 'manana' | 'tarde' | null =
    rol === 'coordinador'
      ? (jornada === 'tarde' ? 'tarde' : 'manana')
      : null;
  const puedeEditar =
    rol === 'coordinador' &&
    jornadaTab === jornadaPropia &&
    (modo === 'docente' || modo === 'grupo');

  // El toggle Semana/Día aplica solo cuando estamos en el overview (no en detalle)
  const enOverview =
    modo === 'aulas' ||
    (modo === 'docente' && !docenteSel) ||
    (modo === 'grupo'   && !grupoSel) ||
    modo === 'acompanamiento';

  const MODO_LABELS: Record<Modo, string> = {
    aulas:          'Por aulas',
    docente:        'Por docente',
    grupo:          'Por grupo',
    acompanamiento: 'Acompañamiento',
  };

  // Si hay borrador activo, el editor toma el control de toda la vista
  if (borradorActivo) {
    return (
      <EditorHorarioMode
        borrador={borradorActivo}
        onSalir={() => setEditandoBorrador(null)}
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* Banner de modificaciones próximas — visible para todos */}
      {proximasMods.length > 0 && (
        <div className="rounded-2xl border border-info bg-info-soft p-3 space-y-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-info-soft-fg">
            <span className="text-base">📌</span>
            {proximasMods.length === 1 ? 'Hay 1 modificación de horario' : `Hay ${proximasMods.length} modificaciones de horario`}
          </div>
          <div className="flex flex-wrap gap-2">
            {proximasMods.map(m => {
              const ausentes = m.ausencias.length;
              const docNombres = m.ausencias.map(a => USUARIOS.find(u => u.id === a.docenteId)?.nombreCorto ?? a.docenteId).join(', ');
              return (
                <button
                  key={m.id}
                  onClick={() => setVerDetalleMod(m)}
                  className="text-left px-3 py-2 rounded-xl bg-elevated hover:bg-hover border border-line transition flex-1 min-w-[220px]"
                >
                  <div className="text-xs font-semibold text-strong">{formatearFechaLegible(m.fecha)}</div>
                  <div className="text-[11px] text-soft mt-0.5">
                    Jornada {m.jornada === 'manana' ? 'mañana' : 'tarde'} · {ausentes} {ausentes === 1 ? 'ausente' : 'ausentes'}
                    {docNombres && `: ${docNombres}`}
                  </div>
                  <div className="text-[10px] text-info-soft-fg mt-1">Ver detalle →</div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Banner de jornadas reducidas próximas — visible para todos */}
      {proximasJr.length > 0 && (
        <div className="rounded-2xl border border-warning bg-warning-soft p-3 space-y-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-warning-soft-fg">
            <span className="text-base">⏱</span>
            {proximasJr.length === 1 ? 'Hay 1 jornada acortada' : `Hay ${proximasJr.length} jornadas acortadas`}
          </div>
          <div className="flex flex-wrap gap-2">
            {proximasJr.map(j => (
              <button
                key={j.id}
                onClick={() => setVerDetalleJr(j)}
                className="text-left px-3 py-2 rounded-xl bg-elevated hover:bg-hover border border-line transition flex-1 min-w-[220px]"
              >
                <div className="text-xs font-semibold text-strong">{formatearFechaLegible(j.fecha)}</div>
                <div className="text-[11px] text-soft mt-0.5">
                  Jornada {j.jornada === 'manana' ? 'mañana' : 'tarde'} · {j.horaInicio}–{j.horaFin} · {j.motivo}
                </div>
                <div className="text-[10px] text-warning-soft-fg mt-1">Ver bloques →</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Banner de publicaciones pendientes de revisar — solo coordinador */}
      {pubsPendientes.length > 0 && (
        <div className="rounded-2xl border border-info bg-info-soft p-3 space-y-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-info-soft-fg">
            <span className="text-base">📄</span>
            {pubsPendientes.length === 1
              ? 'Hay 1 publicación pendiente de revisar para la página del colegio'
              : `Hay ${pubsPendientes.length} publicaciones pendientes de revisar para la página del colegio`}
          </div>
          <div className="flex flex-wrap gap-2">
            {pubsPendientes.map(p => (
              <button
                key={p.id}
                onClick={() => setRevisarPub(p)}
                className="text-left px-3 py-2 rounded-xl bg-elevated hover:bg-hover border border-line transition flex-1 min-w-[220px]"
              >
                <div className="text-xs font-semibold text-strong">{p.titulo}</div>
                <div className="text-[11px] text-muted mt-0.5">
                  Jornada {p.jornada === 'manana' ? 'mañana' : 'tarde'} · creada {new Date(p.timestampCreacion).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' })}
                </div>
                <div className="text-[10px] text-info mt-1">Revisar y aprobar →</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Barra de controles: modo · jornada · semana/día — todo en una línea */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex flex-wrap gap-1 p-1 rounded-xl bg-elevated border border-line">
          {(['docente', 'grupo', 'aulas', 'acompanamiento'] as Modo[]).map(m => (
            <TabButton key={m} active={modo === m} onClick={() => setModo(m)} color="modo">
              {MODO_LABELS[m]}
            </TabButton>
          ))}
        </div>

        {puedeVerAmbas && <div className="h-5 w-px bg-elevated/400 flex-shrink-0" />}

        {puedeVerAmbas && (
          <div className="flex gap-1 p-1 rounded-xl bg-elevated border border-line">
            <TabButton active={jornadaTab === 'manana'} onClick={() => setJornadaTab('manana')} color="jornada">Mañana</TabButton>
            <TabButton active={jornadaTab === 'tarde'}  onClick={() => setJornadaTab('tarde')}  color="jornada">Tarde</TabButton>
          </div>
        )}

        {enOverview && <div className="h-5 w-px bg-elevated/400 flex-shrink-0" />}

        {enOverview && (
          <div className="flex gap-1 p-1 rounded-xl bg-elevated border border-line">
            <TabButton active={vistaOverview === 'semana'} onClick={() => setVistaOverview('semana')} color="overview">Semana</TabButton>
            <TabButton active={vistaOverview === 'dia'}    onClick={() => setVistaOverview('dia')}    color="overview">Día</TabButton>
          </div>
        )}

        {puedeEditar && (
          <>
            <button
              onClick={() => setWizardAbierto(true)}
              className="ml-auto flex items-center gap-1.5 px-4 py-2 rounded-xl bg-accent hover:bg-accent/85 text-strong text-sm font-semibold transition shadow-lg shadow-accent/30"
              title="Crear modificación temporal del horario"
            >
              <span className="text-base leading-none">✎</span> Editar
            </button>
            <button
              onClick={() => setAcortarAbierto(true)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-warning hover:bg-warning/85 text-strong text-sm font-semibold transition shadow-lg shadow-warning/30"
              title="Acortar la jornada por acto cívico o reunión"
            >
              <span className="text-base leading-none">⏱</span> Acortar
            </button>
          </>
        )}
      </div>


      {/* Contenido */}
      <AnimatePresence mode="wait">
        <motion.div
          key={`${modo}-${jornadaTab}`}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2 }}
        >
          {modo === 'aulas' && (
            <VistaAulas
              jornadaTab={jornadaTab}
              vistaDetalle={vistaOverview}
              diaSeleccionado={diaOverview}
              onSetDia={setDiaOverview}
            />
          )}

          {modo === 'docente' && (
            docenteSel ? (
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setDocenteSel('')}
                    className="flex items-center gap-2 text-sm text-soft hover:text-strong transition px-3 py-1.5 rounded-xl bg-elevated border border-line flex-shrink-0"
                  >
                    ← Todos los docentes
                  </button>
                  {(() => {
                    const d = USUARIOS.find(u => u.id === docenteSel);
                    return d ? (
                      <span className="font-semibold text-sm" style={{ color: d.color }}>{d.nombre}</span>
                    ) : null;
                  })()}
                </div>
                <VistaDocente docenteId={docenteSel} jornadaTab={jornadaTab} />
              </div>
            ) : (
              <TablaDocentesOverview
                jornadaTab={jornadaTab}
                onSelect={setDocenteSel}
                vistaDetalle={vistaOverview}
                diaSeleccionado={diaOverview}
                onSetDia={setDiaOverview}
              />
            )
          )}

          {modo === 'grupo' && (
            grupoSel ? (
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setGrupoSel('')}
                    className="flex items-center gap-2 text-sm text-soft hover:text-strong transition px-3 py-1.5 rounded-xl bg-elevated border border-line flex-shrink-0"
                  >
                    ← Todos los grupos
                  </button>
                  {(() => {
                    const directores = jornadaTab === 'manana' ? DIRECTORES_MANANA : DIRECTORES_TARDE;
                    const dirId = directores[grupoSel];
                    const dir = USUARIOS.find(u => u.id === dirId);
                    return (
                      <span className="font-semibold text-sm" style={{ color: colorGrado(grupoSel) }}>
                        {grupoSel}
                        {dir && <span className="font-normal text-muted ml-2 text-xs">Director: {dir.nombre}</span>}
                      </span>
                    );
                  })()}
                </div>
                <VistaGrupo grado={grupoSel} jornadaTab={jornadaTab} />
              </div>
            ) : (
              <TablaGruposOverview
                jornadaTab={jornadaTab}
                onSelect={setGrupoSel}
                vistaDetalle={vistaOverview}
                diaSeleccionado={diaOverview}
                onSetDia={setDiaOverview}
              />
            )
          )}
          {modo === 'acompanamiento' && (() => {
            const zonas = jornadaTab === 'tarde' ? ZONAS_ACOMPANAMIENTO_TARDE : ZONAS_ACOMPANAMIENTO;
            return (
            <div className="space-y-4">
              {vistaOverview === 'semana' ? (
                <div className="overflow-x-auto rounded-2xl border border-line bg-elevated/40">
                  <table className="text-xs border-collapse w-full">
                    <thead>
                      <tr className="border-b border-line">
                        <th className="text-muted px-3 py-2.5 text-left font-medium w-36 sticky left-0 bg-elevated/80 z-10">Zona</th>
                        {DIAS.map(dia => (
                          <th key={dia} className="text-center px-2 py-2.5 font-semibold text-soft min-w-[90px]">
                            {DIAS_LABEL[dia]}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {zonas.map((zona, i) => (
                        <tr key={zona} className={cn('border-b border-line/50', i % 2 === 0 ? '' : 'bg-card/30')}>
                          <td className="px-3 py-2 font-semibold text-strong sticky left-0 bg-elevated/80 z-10 whitespace-nowrap">
                            {zona}
                          </td>
                          {DIAS.map(dia => {
                            const entrada = ACOMPAÑAMIENTOS.find(
                              a => a.lugar === zona && a.dia === dia && a.jornada === jornadaTab
                            );
                            const usuario = entrada ? USUARIOS.find(u => u.id === entrada.docente) : null;
                            return (
                              <td key={dia} className="px-1.5 py-1">
                                {usuario ? (
                                  <div
                                    className="rounded-lg px-2 py-1.5 flex items-center justify-center"
                                    style={{ borderWidth: 1, borderColor: usuario.color, backgroundColor: `${usuario.color}15` }}
                                  >
                                    <span className="text-[11px] font-bold leading-none text-center" style={{ color: usuario.color }}>
                                      {usuario.nombreCorto}
                                    </span>
                                  </div>
                                ) : (
                                  <div className="rounded-lg border border-dashed border-line flex items-center justify-center py-2">
                                    <span className="text-muted opacity-50 text-[10px]">—</span>
                                  </div>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Selector de día */}
                  <div className="flex gap-1">
                    {DIAS.map(dia => (
                      <button
                        key={dia}
                        onClick={() => setDiaOverview(dia)}
                        className={cn(
                          'flex-1 py-2 rounded-xl text-xs font-medium transition-all border',
                          diaOverview === dia
                            ? 'bg-hover text-strong border-line-strong'
                            : 'text-muted border-transparent hover:text-soft hover:bg-elevated'
                        )}
                      >
                        {DIAS_CORTO[dia]}
                      </button>
                    ))}
                  </div>
                  {/* Tarjetas por zona: lugar arriba, docente (pastilla) abajo */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {zonas.map(zona => {
                      const entrada = ACOMPAÑAMIENTOS.find(
                        a => a.lugar === zona && a.dia === diaOverview && a.jornada === jornadaTab
                      );
                      const usuario = entrada ? USUARIOS.find(u => u.id === entrada.docente) : null;
                      return (
                        <div
                          key={zona}
                          className="flex flex-col items-center justify-center gap-2 text-center rounded-xl bg-elevated border border-line p-3"
                        >
                          <span className="text-strong font-semibold text-[13px] leading-tight">{zona}</span>
                          {usuario ? (
                            <span
                              className="rounded-lg px-3 py-1.5 text-sm font-bold leading-none"
                              style={{ borderWidth: 1, borderColor: usuario.color, backgroundColor: `${usuario.color}15`, color: usuario.color }}
                            >
                              {usuario.nombreCorto}
                            </span>
                          ) : (
                            <span className="text-muted opacity-50 text-sm">—</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {jornadaTab === 'tarde' && (
                <div className="space-y-4 pt-2">
                  <h4 className="text-muted opacity-60 text-xs font-semibold uppercase tracking-wide text-center">
                    Otros acompañamientos (tarde)
                  </h4>
                  {MOMENTOS_TARDE.map(momento => (
                    <div key={momento.id} className="space-y-2">
                      <p className="text-soft text-xs font-semibold">{momento.titulo}</p>
                      {vistaOverview === 'semana' ? (
                        <div className="overflow-x-auto rounded-2xl border border-line bg-elevated/40">
                          <table className="text-xs border-collapse w-full">
                            <thead>
                              <tr className="border-b border-line">
                                {DIAS.map(dia => (
                                  <th key={dia} className="text-center px-2 py-2 font-semibold text-soft min-w-[90px]">
                                    {DIAS_LABEL[dia]}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              <tr>
                                {DIAS.map(dia => {
                                  const ids = momento.asignaciones[dia] ?? [];
                                  const usuarios = ids
                                    .map(id => USUARIOS.find(u => u.id === id))
                                    .filter((u): u is NonNullable<typeof u> => !!u);
                                  return (
                                    <td key={dia} className="px-1.5 py-1.5">
                                      {usuarios.length > 0 ? (
                                        <div className="flex flex-col items-center gap-1">
                                          {usuarios.map(usuario => (
                                            <div
                                              key={usuario.id}
                                              className="rounded-lg px-2 py-1.5 flex items-center justify-center w-full"
                                              style={{ borderWidth: 1, borderColor: usuario.color, backgroundColor: `${usuario.color}15` }}
                                            >
                                              <span className="text-[11px] font-bold leading-none text-center" style={{ color: usuario.color }}>
                                                {usuario.nombreCorto}
                                              </span>
                                            </div>
                                          ))}
                                        </div>
                                      ) : (
                                        <div className="rounded-lg border border-dashed border-line flex items-center justify-center py-2">
                                          <span className="text-muted opacity-50 text-[10px]">—</span>
                                        </div>
                                      )}
                                    </td>
                                  );
                                })}
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center gap-2 text-center rounded-xl bg-elevated border border-line p-3">
                          {(() => {
                            const ids = momento.asignaciones[diaOverview] ?? [];
                            const usuarios = ids
                              .map(id => USUARIOS.find(u => u.id === id))
                              .filter((u): u is NonNullable<typeof u> => !!u);
                            return usuarios.length > 0 ? (
                              <div className="flex flex-wrap items-center justify-center gap-1.5">
                                {usuarios.map(usuario => (
                                  <span
                                    key={usuario.id}
                                    className="rounded-lg px-3 py-1.5 text-sm font-bold leading-none"
                                    style={{ borderWidth: 1, borderColor: usuario.color, backgroundColor: `${usuario.color}15`, color: usuario.color }}
                                  >
                                    {usuario.nombreCorto}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span className="text-muted opacity-50 text-sm">—</span>
                            );
                          })()}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
            );
          })()}
        </motion.div>
      </AnimatePresence>

      {/* Wizard de parametrización */}
      {jornadaPropia && (
        <EditorHorarioWizard
          open={wizardAbierto}
          jornada={jornadaPropia}
          onClose={() => setWizardAbierto(false)}
          onCompletar={(hm) => setEditandoBorrador(hm)}
        />
      )}

      {/* Modal de detalle del día modificado */}
      <ModalDiaModificado
        modificacion={verDetalleMod}
        onClose={() => setVerDetalleMod(null)}
      />

      {/* Modal de revisión de publicación pendiente */}
      <ModalRevisarPublicacion
        publicacion={revisarPub}
        onClose={() => setRevisarPub(null)}
      />

      {/* Modal acortar jornada */}
      {jornadaPropia && (
        <ModalAcortarJornada
          open={acortarAbierto}
          jornada={jornadaPropia}
          onClose={() => setAcortarAbierto(false)}
        />
      )}

      {/* Modal de detalle de jornada reducida */}
      <AnimatePresence>
        {verDetalleJr && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/45 dark:bg-black/75 backdrop-blur-sm p-3 sm:p-6"
            onClick={() => setVerDetalleJr(null)}
          >
            <motion.div
              initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 30, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 320, damping: 30 }}
              className="w-full max-w-md bg-gray-950 border border-line rounded-2xl shadow-2xl overflow-hidden flex flex-col"
              onClick={e => e.stopPropagation()}
            >
              <div className="px-6 pt-5 pb-4 border-b border-line flex items-center justify-between">
                <div>
                  <h2 className="text-strong font-semibold text-base flex items-center gap-2">
                    <span className="text-warning">⏱</span> Jornada acortada
                  </h2>
                  <p className="text-xs text-muted mt-0.5">
                    {formatearFechaLegible(verDetalleJr.fecha)} · {verDetalleJr.jornada === 'manana' ? 'mañana' : 'tarde'} · {verDetalleJr.horaInicio}–{verDetalleJr.horaFin}
                  </p>
                </div>
                <button
                  onClick={() => setVerDetalleJr(null)}
                  className="text-muted hover:text-strong text-lg leading-none p-1"
                  aria-label="Cerrar"
                >✕</button>
              </div>
              <div className="px-6 py-5 space-y-3">
                <div className="text-xs text-warning-soft-fg">Motivo: {verDetalleJr.motivo}</div>
                <div className="bg-elevated border border-line rounded-2xl p-4">
                  <table className="w-full text-sm">
                    <tbody>
                      {verDetalleJr.bloques.map(b => (
                        <tr key={b.id} className="border-b border-line last:border-b-0">
                          <td className="py-2 text-soft w-24 text-sm">{b.id}.ª hora</td>
                          <td className="py-2 font-semibold text-strong tabular-nums">{b.inicio} – {b.fin}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="text-[11px] text-muted italic">Descansos: 20 min después de 2.ª · 10 min después de 4.ª</div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
