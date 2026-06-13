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
  colorGrado,
  horaOrdinal,
  getDocentes,
  MIXTOS_TARDE,
} from '../data/maestros';
import { horarioBase } from '../data/horarioBase';
import { cn } from '@/lib/utils';

type Modo         = 'aulas' | 'docente' | 'grupo';
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
        active ? 'text-white' : 'text-gray-500 hover:text-gray-300 hover:bg-white/6'
      )}
    >
      {active && (
        <motion.span
          layoutId={`tab-${color}`}
          className="absolute inset-0 rounded-xl bg-white/12 border border-white/15"
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
    <div className="h-full rounded-lg border border-dashed border-white/10 flex items-center justify-center">
      <span className="text-gray-700 text-[10px]">—</span>
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
        <span className="text-[9px] leading-none text-gray-500 truncate w-full text-center">
          {aula}
        </span>
      )}
    </div>
  );
}

function CeldaCI() {
  return (
    <div className="h-full rounded-lg border border-yellow-700/50 bg-yellow-900/25 flex items-center justify-center">
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
        <span className={lugar ? 'text-orange-400 font-medium' : 'text-gray-600'}>
          {lugar ? '🧑‍🏫 Acompañamiento' : 'Descanso'}
        </span>
        {lugar && <span className="text-orange-300 font-semibold">{lugar}</span>}
      </div>
      <span className="text-gray-600 tabular-nums">{inicio} – {fin}</span>
    </div>
  );
}

// ── Vista por aulas ──────────────────────────────────────────────────────────

function VistaAulas({ jornadaTab }: { jornadaTab: 'manana' | 'tarde' }) {
  const [vistaDetalle, setVistaDetalle] = useState<VistaDetalle>('semana');
  const [diaSeleccionado, setDiaSeleccionado] = useState('lunes');

  const bloques  = jornadaTab === 'tarde' ? BLOQUES_TARDE : BLOQUES_MANANA;
  const entradas = horarioBase.filter(e => e.jornada === jornadaTab);

  const aulasSet = new Set<string>();
  entradas.forEach(e => { if (e.aula) aulasSet.add(e.aula); });
  const aulas = Array.from(aulasSet).sort();

  if (aulas.length === 0) return (
    <div className="text-center py-16 text-gray-600 text-sm">Sin datos de aulas para esta jornada.</div>
  );

  const CELL_H = 48;

  return (
    <div className="space-y-3">
      {/* Toggle semana/día */}
      <div className="flex gap-1">
        <TabButton active={vistaDetalle === 'semana'} onClick={() => setVistaDetalle('semana')} color="aulas-det">Semana</TabButton>
        <TabButton active={vistaDetalle === 'dia'} onClick={() => setVistaDetalle('dia')} color="aulas-det">Día</TabButton>
      </div>

      <AnimatePresence mode="wait">
        {vistaDetalle === 'semana' ? (
          <motion.div key="semana" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="overflow-x-auto rounded-2xl border border-white/8 bg-white/2">
              <table className="text-xs border-collapse" style={{ minWidth: 720 }}>
                <thead>
                  {/* Fila de días */}
                  <tr>
                    <th className="sticky left-0 bg-gray-950/98 z-10 text-left text-gray-600 px-3 py-2 w-24 font-medium border-b border-white/8" />
                    {DIAS.map((dia, di) => (
                      <th
                        key={dia}
                        colSpan={bloques.length}
                        className={cn(
                          'text-center py-2.5 font-semibold text-sm border-b border-white/8',
                          di > 0 ? 'border-l border-white/10' : '',
                          'text-gray-300'
                        )}
                      >
                        {DIAS_LABEL[dia]}
                      </th>
                    ))}
                  </tr>
                  {/* Fila de horas */}
                  <tr className="border-b border-white/6">
                    <th className="sticky left-0 bg-gray-950/98 z-10 text-left text-gray-600 px-3 py-1.5 font-normal text-[10px]">
                      Aula
                    </th>
                    {DIAS.map((dia, di) =>
                      bloques.map((b, bi) => (
                        <th
                          key={`${dia}-${b.id}`}
                          className={cn(
                            'text-center px-0.5 py-1.5 font-normal min-w-[54px]',
                            bi === 0 && di > 0 ? 'border-l border-white/10' : ''
                          )}
                        >
                          <span className="block text-gray-400 text-[10px]">{horaOrdinal(b.id)}</span>
                          <span className="block text-gray-700 text-[9px]">{b.inicio}</span>
                        </th>
                      ))
                    )}
                  </tr>
                </thead>
                <tbody>
                  {aulas.map((aula, ai) => (
                    <tr key={aula} className={cn('border-b border-white/5', ai % 2 !== 0 ? 'bg-white/2' : '')}>
                      <td
                        className="px-3 sticky left-0 bg-gray-950/98 z-10"
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
                              className={cn('p-0.5', bi === 0 && di > 0 ? 'border-l border-white/8' : '')}
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
                  onClick={() => setDiaSeleccionado(dia)}
                  className={cn(
                    'flex-1 py-2 rounded-xl text-xs font-medium transition-all border',
                    diaSeleccionado === dia
                      ? 'bg-white/12 text-white border-white/20'
                      : 'text-gray-500 border-transparent hover:text-gray-300 hover:bg-white/6'
                  )}
                >
                  {DIAS_CORTO[dia]}
                </button>
              ))}
            </div>
            {/* Tabla por aulas del día */}
            <div className="rounded-2xl border border-white/8 bg-white/2 overflow-hidden">
              <table className="text-xs border-collapse w-full">
                <thead>
                  <tr className="border-b border-white/8">
                    <th className="text-left text-gray-500 px-3 py-2.5 font-medium w-28">Aula</th>
                    {bloques.map(b => (
                      <th key={b.id} className="text-center px-2 py-2.5 min-w-[80px]">
                        <div className="text-gray-300 font-semibold text-xs">{horaOrdinal(b.id)}</div>
                        <div className="text-gray-600 text-[10px]">{b.inicio} – {b.fin}</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {aulas.map((aula, ai) => (
                    <tr key={aula} className={cn('border-b border-white/5', ai % 2 !== 0 ? 'bg-white/2' : '')}>
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
      (a.descansos === 'ambos' || a.descansos === numDescanso)
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-1">
        <TabButton active={vistaDetalle === 'semana'} onClick={() => setVistaDetalle('semana')} color="docente">Semana</TabButton>
        <TabButton active={vistaDetalle === 'dia'} onClick={() => setVistaDetalle('dia')} color="docente">Día</TabButton>
      </div>

      <AnimatePresence mode="wait">
        {vistaDetalle === 'semana' ? (
          <motion.div key="semana" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="overflow-x-auto rounded-2xl border border-white/8 bg-white/2">
              <table className="text-xs border-collapse" style={{ minWidth: 400 }}>
                <thead>
                  <tr className="border-b border-white/8">
                    <th className="text-gray-500 px-3 py-2.5 text-left font-medium w-28">Hora</th>
                    {DIAS.map(dia => {
                      const esTarde = docenteEnTarde(docenteId, dia);
                      return (
                        <th key={dia} className={cn(
                          'text-center px-2 py-2.5 font-semibold min-w-[90px]',
                          esTarde ? 'text-yellow-500' : 'text-gray-300'
                        )}>
                          {DIAS_LABEL[dia].slice(0, 2)}
                          {esTarde && <span className="ml-1 text-yellow-600 text-[9px]">T</span>}
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
                          <div className="font-bold text-white">{horaOrdinal(b.id)} hora</div>
                          <div className="text-gray-600 text-[10px]">{b.inicio} – {b.fin}</div>
                        </td>
                        {DIAS.map(dia => {
                          const esTardeHoy = docenteEnTarde(docenteId, dia);
                          if (esTardeHoy && jornadaTab === 'manana') return (
                            <td key={dia} className="p-1" style={{ height: CELL_H }}>
                              <div className="h-full rounded-lg bg-yellow-900/15 border border-yellow-900/30 flex items-center justify-center">
                                <span className="text-yellow-700 text-[10px]">Tarde</span>
                              </div>
                            </td>
                          );
                          if (dia === 'martes' && b.id === 6) return (
                            <td key={dia} className="p-1" style={{ height: CELL_H }}><CeldaCI /></td>
                          );
                          const entrada = entradas.find(e => e.dia === dia && e.bloque === b.id);
                          if (!entrada) return (
                            <td key={dia} className="p-1" style={{ height: CELL_H }}>
                              <div className="h-full rounded-lg border border-dashed border-white/6 flex items-center justify-center">
                                <span className="text-gray-700 text-[10px]">—</span>
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
                        <tr key={`desc-${b.id}`} className="bg-gray-900/30">
                          <td className="px-3 py-1.5">
                            <div className="text-gray-700 text-[10px]">Descanso</div>
                            <div className="text-gray-800 text-[9px]">{descanso.inicio} – {descanso.fin} ({descanso.duracion} min)</div>
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
                        ? 'bg-white/12 text-white border-white/20'
                        : 'text-gray-500 border-transparent hover:text-gray-300 hover:bg-white/6',
                      esTarde ? 'border-yellow-800/40' : ''
                    )}
                  >
                    {DIAS_CORTO[dia]}
                    {esTarde && <span className="block text-[9px] text-yellow-700">T</span>}
                  </button>
                );
              })}
            </div>

            {/* Banners del día con descansos intercalados */}
            {bloques.flatMap(b => {
              const items: React.ReactNode[] = [];
              const esTardeHoy = docenteEnTarde(docenteId, diaSeleccionado);
              const esCI = diaSeleccionado === 'martes' && b.id === 6;

              if (esTardeHoy && jornadaTab === 'manana') {
                items.push(
                  <div key={b.id} className="flex items-center gap-3 rounded-xl bg-yellow-900/15 border border-yellow-900/30 p-3">
                    <div className="w-24 flex-shrink-0">
                      <div className="text-yellow-500 font-bold">{horaOrdinal(b.id)} hora</div>
                      <div className="text-yellow-800 text-[10px]">{b.inicio} – {b.fin}</div>
                    </div>
                    <span className="text-yellow-700 text-sm">Jornada tarde</span>
                  </div>
                );
              } else if (esCI) {
                items.push(
                  <div key={b.id} className="flex items-center gap-3 rounded-xl bg-yellow-900/25 border border-yellow-700/40 p-3">
                    <div className="w-24 flex-shrink-0">
                      <div className="text-yellow-400 font-bold">{horaOrdinal(b.id)} hora</div>
                      <div className="text-yellow-700 text-[10px]">{b.inicio} – {b.fin}</div>
                    </div>
                    <span className="text-yellow-300 font-semibold">⭐ Centro de Interés</span>
                  </div>
                );
              } else {
                const entrada = entradas.find(e => e.dia === diaSeleccionado && e.bloque === b.id);
                if (!entrada) {
                  items.push(
                    <div key={b.id} className="flex items-center gap-3 rounded-xl border border-dashed border-white/8 p-3 opacity-40">
                      <div className="w-24 flex-shrink-0">
                        <div className="text-gray-500 font-bold">{horaOrdinal(b.id)} hora</div>
                        <div className="text-gray-700 text-[10px]">{b.inicio} – {b.fin}</div>
                      </div>
                      <span className="text-gray-600">Libre</span>
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
                        <div className="text-white font-bold">{horaOrdinal(b.id)} hora</div>
                        <div className="text-gray-500 text-[10px]">{b.inicio} – {b.fin}</div>
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
            <span className="px-3 py-1.5 rounded-full bg-white/6 border border-white/10">
              Director: <span style={{ color: director.color }} className="font-semibold">{director.nombre}</span>
            </span>
          )}
          {aulaGrupo && (
            <span className="px-3 py-1.5 rounded-full bg-white/6 border border-white/10">
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
            <div className="overflow-x-auto rounded-2xl border border-white/8 bg-white/2">
              <table className="text-xs border-collapse" style={{ minWidth: 400 }}>
                <thead>
                  <tr className="border-b border-white/8">
                    <th className="text-gray-500 px-3 py-2.5 text-left font-medium w-28">Hora</th>
                    {DIAS.map(dia => (
                      <th key={dia} className="text-center px-2 py-2.5 text-gray-300 font-semibold min-w-[90px]">
                        {DIAS_LABEL[dia].slice(0, 2)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {bloques.map(b => (
                    <tr key={b.id} className="border-b border-white/5">
                      <td className="px-3" style={{ height: CELL_H }}>
                        <div className="font-bold text-white">{horaOrdinal(b.id)} hora</div>
                        <div className="text-gray-600 text-[10px]">{b.inicio} – {b.fin}</div>
                      </td>
                      {DIAS.map(dia => {
                        const esCI = dia === 'martes' && b.id === 6 && jornadaTab === 'manana';
                        if (esCI) return <td key={dia} className="p-1" style={{ height: CELL_H }}><CeldaCI /></td>;
                        const entrada = entradas.find(e => e.dia === dia && e.bloque === b.id);
                        if (!entrada) return (
                          <td key={dia} className="p-1" style={{ height: CELL_H }}>
                            <div className="h-full rounded-lg border border-dashed border-white/6 flex items-center justify-center">
                              <span className="text-gray-700 text-[10px]">—</span>
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
                              {entrada.aula && (
                                <span className="text-[9px] text-gray-600 truncate w-full text-center">{entrada.aula}</span>
                              )}
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
                      ? 'bg-white/12 text-white border-white/20'
                      : 'text-gray-500 border-transparent hover:text-gray-300 hover:bg-white/6'
                  )}
                >
                  {DIAS_CORTO[dia]}
                </button>
              ))}
            </div>
            <div className="space-y-2">
              {bloques.map(b => {
                const esCI = diaSeleccionado === 'martes' && b.id === 6 && jornadaTab === 'manana';
                if (esCI) return (
                  <div key={b.id} className="flex items-center gap-3 rounded-xl bg-yellow-900/25 border border-yellow-700/40 p-3">
                    <div className="w-24 flex-shrink-0">
                      <div className="text-yellow-400 font-bold">{horaOrdinal(b.id)} hora</div>
                      <div className="text-yellow-700 text-[10px]">{b.inicio} – {b.fin}</div>
                    </div>
                    <span className="text-yellow-300 font-semibold">⭐ Centro de Interés</span>
                  </div>
                );
                const entrada = entradas.find(e => e.dia === diaSeleccionado && e.bloque === b.id);
                const docente = entrada ? USUARIOS.find(u => u.id === entrada.docente) : null;
                if (!entrada) return (
                  <div key={b.id} className="flex items-center gap-3 rounded-xl border border-dashed border-white/8 p-3 opacity-40">
                    <div className="w-24 flex-shrink-0">
                      <div className="text-gray-500 font-bold">{horaOrdinal(b.id)} hora</div>
                      <div className="text-gray-700 text-[10px]">{b.inicio} – {b.fin}</div>
                    </div>
                    <span className="text-gray-600">Sin clase</span>
                  </div>
                );
                return (
                  <div
                    key={b.id}
                    className="flex items-center gap-3 rounded-xl p-3"
                    style={{ borderColor: docente?.color ?? '#fff', borderWidth: 1, backgroundColor: `${docente?.color ?? '#aaa'}18` }}
                  >
                    <div className="w-24 flex-shrink-0">
                      <div className="text-white font-bold">{horaOrdinal(b.id)} hora</div>
                      <div className="text-gray-500 text-[10px]">{b.inicio} – {b.fin}</div>
                    </div>
                    <div className="flex-1">
                      <div className="font-semibold" style={{ color: docente?.color ?? '#aaa' }}>
                        {docente?.nombreCorto ?? entrada.docente}
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

function TablaDocentesOverview({ jornadaTab, onSelect }: {
  jornadaTab: 'manana' | 'tarde';
  onSelect: (id: string) => void;
}) {
  const docentes = getDocentes(jornadaTab);
  const bloques  = jornadaTab === 'tarde' ? BLOQUES_TARDE : BLOQUES_MANANA;
  const CELL_H   = 46;

  return (
    <div className="overflow-x-auto rounded-2xl border border-white/8 bg-white/2">
      <table className="text-xs border-collapse" style={{ minWidth: 860 }}>
        <thead>
          <tr>
            <th className="sticky left-0 bg-gray-950/98 z-20 w-24 border-b border-white/8" />
            {DIAS.map((dia, di) => (
              <th
                key={dia}
                colSpan={bloques.length}
                className={cn(
                  'text-center py-2.5 font-semibold text-sm border-b border-white/8 text-gray-300',
                  di > 0 ? 'border-l border-white/10' : ''
                )}
              >
                {DIAS_LABEL[dia]}
              </th>
            ))}
          </tr>
          <tr className="border-b border-white/6">
            <th className="sticky left-0 bg-gray-950/98 z-20 px-3 py-1 text-[9px] text-gray-600 font-normal text-left">
              Docente
            </th>
            {DIAS.map((dia, di) =>
              bloques.map((b, bi) => (
                <th
                  key={`${dia}-${b.id}`}
                  className={cn(
                    'text-center py-1 font-normal min-w-[42px]',
                    bi === 0 && di > 0 ? 'border-l border-white/10' : ''
                  )}
                >
                  <span className="text-gray-500 text-[9px]">{horaOrdinal(b.id)}</span>
                </th>
              ))
            )}
          </tr>
        </thead>
        <tbody>
          {docentes.map((docente, ri) => (
            <tr key={docente.id} className={cn('border-b border-white/5', ri % 2 !== 0 ? 'bg-white/[0.015]' : '')}>
              <td
                className="sticky left-0 bg-gray-950/95 z-10 px-3 cursor-pointer group hover:bg-gray-900/80 transition-colors"
                style={{ height: CELL_H }}
                onClick={() => onSelect(docente.id)}
              >
                <div className="font-bold text-[11px] leading-tight" style={{ color: docente.color }}>
                  {docente.nombreCorto}
                </div>
                <div className="text-[9px] text-gray-700 group-hover:text-gray-500 transition-colors mt-0.5">
                  ver →
                </div>
              </td>
              {DIAS.map((dia, di) =>
                bloques.map((b, bi) => {
                  const esTardeHoy = docenteEnTarde(docente.id, dia) && jornadaTab === 'manana';
                  const esCI       = dia === 'martes' && b.id === 6 && jornadaTab === 'manana';
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
                      className={cn('p-0.5', bi === 0 && di > 0 ? 'border-l border-white/8' : '')}
                      style={{ height: CELL_H }}
                    >
                      {esTardeHoy ? (
                        <div className="h-full rounded border border-yellow-900/30 bg-yellow-900/10 flex items-center justify-center">
                          <span className="text-yellow-800 text-[9px]">T</span>
                        </div>
                      ) : esCI ? (
                        <div className="h-full rounded border border-yellow-700/40 bg-yellow-900/20 flex items-center justify-center">
                          <span className="text-yellow-500 text-[9px] font-bold">★CI</span>
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
                        <div className="h-full rounded border border-dashed border-white/6 flex items-center justify-center">
                          <span className="text-gray-800 text-[9px]">—</span>
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

function TablaGruposOverview({ jornadaTab, onSelect }: {
  jornadaTab: 'manana' | 'tarde';
  onSelect: (grado: string) => void;
}) {
  const bloques    = jornadaTab === 'tarde' ? BLOQUES_TARDE : BLOQUES_MANANA;
  const directores = jornadaTab === 'manana' ? DIRECTORES_MANANA : DIRECTORES_TARDE;
  const gruposUnicos = Array.from(new Set(
    horarioBase
      .filter(e => e.jornada === jornadaTab)
      .map(e => e.grado.includes('/') ? e.grado.split('/')[0] : e.grado)
  )).sort();
  const CELL_H = 46;

  return (
    <div className="overflow-x-auto rounded-2xl border border-white/8 bg-white/2">
      <table className="text-xs border-collapse" style={{ minWidth: 860 }}>
        <thead>
          <tr>
            <th className="sticky left-0 bg-gray-950/98 z-20 w-28 border-b border-white/8" />
            {DIAS.map((dia, di) => (
              <th
                key={dia}
                colSpan={bloques.length}
                className={cn(
                  'text-center py-2.5 font-semibold text-sm border-b border-white/8 text-gray-300',
                  di > 0 ? 'border-l border-white/10' : ''
                )}
              >
                {DIAS_LABEL[dia]}
              </th>
            ))}
          </tr>
          <tr className="border-b border-white/6">
            <th className="sticky left-0 bg-gray-950/98 z-20 px-3 py-1 text-[9px] text-gray-600 font-normal text-left">
              Grupo
            </th>
            {DIAS.map((dia, di) =>
              bloques.map((b, bi) => (
                <th
                  key={`${dia}-${b.id}`}
                  className={cn(
                    'text-center py-1 font-normal min-w-[42px]',
                    bi === 0 && di > 0 ? 'border-l border-white/10' : ''
                  )}
                >
                  <span className="text-gray-500 text-[9px]">{horaOrdinal(b.id)}</span>
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
              <tr key={grado} className={cn('border-b border-white/5', ri % 2 !== 0 ? 'bg-white/[0.015]' : '')}>
                <td
                  className="sticky left-0 bg-gray-950/95 z-10 px-3 cursor-pointer group hover:bg-gray-900/80 transition-colors"
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
                    const esCI   = dia === 'martes' && b.id === 6 && jornadaTab === 'manana';
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
                        className={cn('p-0.5', bi === 0 && di > 0 ? 'border-l border-white/8' : '')}
                        style={{ height: CELL_H }}
                      >
                        {esCI ? (
                          <div className="h-full rounded border border-yellow-700/40 bg-yellow-900/20 flex items-center justify-center">
                            <span className="text-yellow-500 text-[9px] font-bold">★CI</span>
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
                            <span className="text-[8px] leading-none text-gray-500 w-full text-center truncate">
                              {abrevAula(entrada.aula)}
                            </span>
                          </div>
                        ) : (
                          <div className="h-full rounded border border-dashed border-white/6 flex items-center justify-center">
                            <span className="text-gray-800 text-[9px]">—</span>
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
  const { jornada, rol, userId } = useAppStore();
  const defaultJornada: 'manana' | 'tarde' = jornada === 'tarde' ? 'tarde' : 'manana';

  const [modo, setModo]             = useState<Modo>('aulas');
  const [jornadaTab, setJornadaTab] = useState<'manana' | 'tarde'>(defaultJornada);
  const [docenteSel, setDocenteSel] = useState(rol === 'docente' ? (userId ?? '') : '');
  const [grupoSel, setGrupoSel]     = useState('');

  // Al cambiar jornada (solo coord/rectora), volver al overview de cada modo
  useEffect(() => {
    if (rol !== 'docente') setDocenteSel('');
    setGrupoSel('');
  }, [jornadaTab, rol]);

  const puedeVerAmbas = rol === 'rectora' || rol === 'coordinador';

  const MODO_LABELS: Record<Modo, string> = {
    aulas:   'Por aulas',
    docente: 'Por docente',
    grupo:   'Por grupo',
  };

  return (
    <div className="space-y-4">
      {/* Selector de modo */}
      <div className="flex gap-1 p-1 rounded-xl bg-white/4 border border-white/8 w-fit">
        {(['aulas', 'docente', 'grupo'] as Modo[]).map(m => (
          <TabButton key={m} active={modo === m} onClick={() => setModo(m)} color="modo">
            {MODO_LABELS[m]}
          </TabButton>
        ))}
      </div>

      {/* Selector de jornada */}
      {puedeVerAmbas && (
        <div className="flex gap-1">
          <TabButton active={jornadaTab === 'manana'} onClick={() => setJornadaTab('manana')} color="jornada">Mañana</TabButton>
          <TabButton active={jornadaTab === 'tarde'} onClick={() => setJornadaTab('tarde')} color="jornada">Tarde</TabButton>
        </div>
      )}

      {/* Contenido */}
      <AnimatePresence mode="wait">
        <motion.div
          key={`${modo}-${jornadaTab}`}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2 }}
        >
          {modo === 'aulas' && <VistaAulas jornadaTab={jornadaTab} />}

          {modo === 'docente' && (
            docenteSel ? (
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setDocenteSel('')}
                    className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition px-3 py-1.5 rounded-xl bg-white/6 border border-white/10 flex-shrink-0"
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
              <TablaDocentesOverview jornadaTab={jornadaTab} onSelect={setDocenteSel} />
            )
          )}

          {modo === 'grupo' && (
            grupoSel ? (
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setGrupoSel('')}
                    className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition px-3 py-1.5 rounded-xl bg-white/6 border border-white/10 flex-shrink-0"
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
                        {dir && <span className="font-normal text-gray-500 ml-2 text-xs">Director: {dir.nombre}</span>}
                      </span>
                    );
                  })()}
                </div>
                <VistaGrupo grado={grupoSel} jornadaTab={jornadaTab} />
              </div>
            ) : (
              <TablaGruposOverview jornadaTab={jornadaTab} onSelect={setGrupoSel} />
            )
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
