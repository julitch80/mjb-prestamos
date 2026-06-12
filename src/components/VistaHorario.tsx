import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useAppStore } from '../data/store';
import {
  USUARIOS,
  BLOQUES_MANANA,
  BLOQUES_TARDE,
  DIRECTORES_MANANA,
  DIRECTORES_TARDE,
  AULA_GRUPO_TARDE,
  COLORES_AULA,
  colorGrado,
  getDocentes,
  MIXTOS_TARDE,
} from '../data/maestros';
import { horarioBase } from '../data/horarioBase';
import { cn } from '@/lib/utils';

type Modo        = 'aulas' | 'docente' | 'grupo';
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

// ── Botones de modo y jornada ────────────────────────────────────────────────

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

// ── Celda de horario con tarjeta ─────────────────────────────────────────────

function CeldaDocente({ docenteId, aula }: { docenteId?: string; aula?: string }) {
  const docente = USUARIOS.find(u => u.id === docenteId);
  if (!docente) return (
    <div className="h-full rounded-lg border border-dashed border-white/8 flex items-center justify-center">
      <span className="text-gray-700 text-[10px]">—</span>
    </div>
  );
  const color = docente.color;
  return (
    <div
      className="h-full rounded-lg border border-white/8 bg-white/4 flex flex-col items-center justify-center px-1 py-1.5 gap-0.5 overflow-hidden"
      style={{ borderLeftColor: color, borderLeftWidth: 2 }}
    >
      <span className="text-[10px] font-semibold leading-none truncate w-full text-center" style={{ color }}>
        {docente.nombreCorto}
      </span>
      {aula && (
        <span className="text-[9px] leading-none text-gray-600 truncate w-full text-center">
          {aula}
        </span>
      )}
    </div>
  );
}

function CeldaCI() {
  return (
    <div className="h-full rounded-lg border border-yellow-700/40 bg-yellow-900/20 flex items-center justify-center">
      <span className="text-[10px] text-yellow-400 font-bold">⭐CI</span>
    </div>
  );
}

// ── Vista por aulas ──────────────────────────────────────────────────────────

function VistaAulas({ jornadaTab }: { jornadaTab: 'manana' | 'tarde' }) {
  const bloques  = jornadaTab === 'tarde' ? BLOQUES_TARDE : BLOQUES_MANANA;
  const entradas = horarioBase.filter(e => e.jornada === jornadaTab);

  const aulasSet = new Set<string>();
  entradas.forEach(e => { if (e.aula) aulasSet.add(e.aula); });
  const aulas = Array.from(aulasSet).sort();

  if (aulas.length === 0) return (
    <div className="text-center py-16 text-gray-600 text-sm">
      Sin datos de aulas para esta jornada.
    </div>
  );

  const CELL_H = 44; // px

  return (
    <div className="overflow-x-auto rounded-2xl border border-white/8 bg-white/3">
      <table className="text-xs border-collapse" style={{ minWidth: 700 }}>
        <thead>
          <tr className="border-b border-white/8">
            {/* Columna aula */}
            <th className="text-left text-gray-500 px-3 py-2.5 font-medium w-24 sticky left-0 bg-gray-950/95 z-10">
              Aula
            </th>
            {DIAS.map(dia => (
              bloques.map(b => (
                <th
                  key={`${dia}-${b.id}`}
                  className="text-center px-0.5 py-2 font-normal min-w-[52px]"
                >
                  <span className="block text-gray-600 text-[10px]">{DIAS_CORTO[dia]}</span>
                  <span className="block text-gray-700 text-[9px]">B{b.id}</span>
                </th>
              ))
            ))}
          </tr>
          {/* Separadores de día */}
          <tr className="border-b border-white/5">
            <td className="sticky left-0 bg-gray-950/95" />
            {DIAS.map(dia => (
              bloques.map((b, i) => (
                <td key={`sep-${dia}-${b.id}`} className={cn(
                  'h-0.5 px-0.5',
                  i === 0 ? 'border-l border-white/10' : ''
                )}>
                  {i === 0 && (
                    <div className="text-[9px] text-gray-600 text-center pt-1 whitespace-nowrap">
                      {DIAS_LABEL[dia]}
                    </div>
                  )}
                </td>
              ))
            ))}
          </tr>
        </thead>
        <tbody>
          {aulas.map((aula, ai) => (
            <tr
              key={aula}
              className={cn('border-b border-white/5', ai % 2 === 0 ? '' : 'bg-white/2')}
            >
              {/* Nombre aula */}
              <td
                className="px-3 font-semibold sticky left-0 bg-gray-950/95 z-10"
                style={{ color: COLORES_AULA[aula] ?? '#fff', height: CELL_H }}
              >
                {aula}
              </td>
              {/* Celdas */}
              {DIAS.map((dia, di) =>
                bloques.map((b, bi) => {
                  const entrada = entradas.find(e => e.dia === dia && e.bloque === b.id && e.aula === aula);
                  return (
                    <td
                      key={`${dia}-${b.id}`}
                      className={cn(
                        'p-0.5',
                        bi === 0 && di > 0 ? 'border-l border-white/8' : ''
                      )}
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
  );
}

// ── Vista por docente ────────────────────────────────────────────────────────

function VistaDocente({ docenteId, jornadaTab }: { docenteId: string; jornadaTab: 'manana' | 'tarde' }) {
  const [vistaDetalle, setVistaDetalle] = useState<VistaDetalle>('semana');
  const [diaSeleccionado, setDiaSeleccionado] = useState('lunes');

  const bloques  = jornadaTab === 'tarde' ? BLOQUES_TARDE : BLOQUES_MANANA;
  const entradas = horarioBase.filter(e => e.docente === docenteId && e.jornada === jornadaTab);

  const CELL_H = 52;

  return (
    <div className="space-y-3">
      {/* Toggle semana/día */}
      <div className="flex gap-1">
        <TabButton active={vistaDetalle === 'semana'} onClick={() => setVistaDetalle('semana')} color="docente">
          Semana
        </TabButton>
        <TabButton active={vistaDetalle === 'dia'} onClick={() => setVistaDetalle('dia')} color="docente">
          Día
        </TabButton>
      </div>

      <AnimatePresence mode="wait">
        {vistaDetalle === 'semana' ? (
          <motion.div key="semana" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="overflow-x-auto rounded-2xl border border-white/8 bg-white/3">
              <table className="text-xs border-collapse" style={{ minWidth: 400 }}>
                <thead>
                  <tr className="border-b border-white/8">
                    <th className="text-gray-500 px-3 py-2.5 text-left font-medium w-20">Bloque</th>
                    {DIAS.map(dia => {
                      const esTarde = docenteEnTarde(docenteId, dia);
                      return (
                        <th key={dia} className={cn(
                          'text-center px-2 py-2.5 font-medium min-w-[90px]',
                          esTarde ? 'text-yellow-500' : 'text-gray-400'
                        )}>
                          {DIAS_LABEL[dia].slice(0, 2)}
                          {esTarde && <span className="ml-1 text-yellow-600 text-[9px]">T</span>}
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {bloques.map(b => (
                    <tr key={b.id} className="border-b border-white/5">
                      <td className="px-3 text-gray-500" style={{ height: CELL_H }}>
                        <div className="font-semibold text-gray-400">B{b.id}</div>
                        <div className="text-gray-700 text-[10px]">{b.inicio}</div>
                      </td>
                      {DIAS.map(dia => {
                        const esTardeHoy = docenteEnTarde(docenteId, dia);
                        if (esTardeHoy && jornadaTab === 'manana') {
                          return (
                            <td key={dia} className="p-1" style={{ height: CELL_H }}>
                              <div className="h-full rounded-lg bg-yellow-900/15 border border-yellow-900/30 flex items-center justify-center">
                                <span className="text-yellow-700 text-[10px]">Tarde</span>
                              </div>
                            </td>
                          );
                        }
                        const esCI = dia === 'martes' && b.id === 6;
                        if (esCI) return (
                          <td key={dia} className="p-1" style={{ height: CELL_H }}>
                            <CeldaCI />
                          </td>
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
                              className="h-full rounded-lg border border-white/8 bg-white/4 flex flex-col items-center justify-center px-1 gap-0.5"
                              style={{ borderLeftColor: COLORES_AULA[entrada.aula] ?? '#fff', borderLeftWidth: 2 }}
                            >
                              <span className="text-[10px] font-semibold" style={{ color: COLORES_AULA[entrada.aula] ?? '#aaa' }}>
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
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        ) : (
          <motion.div key="dia" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3">
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
            {/* Banners del día */}
            <div className="space-y-2">
              {bloques.map(b => {
                const esTardeHoy = docenteEnTarde(docenteId, diaSeleccionado);
                const esCI = diaSeleccionado === 'martes' && b.id === 6;
                if (esTardeHoy && jornadaTab === 'manana') return (
                  <div key={b.id} className="flex items-center gap-3 rounded-xl bg-yellow-900/15 border border-yellow-900/30 p-3">
                    <div className="w-12 text-center flex-shrink-0">
                      <div className="text-yellow-500 font-bold text-sm">B{b.id}</div>
                      <div className="text-yellow-800 text-[10px]">{b.inicio}</div>
                    </div>
                    <span className="text-yellow-700 text-sm">Jornada tarde</span>
                  </div>
                );
                if (esCI) return (
                  <div key={b.id} className="flex items-center gap-3 rounded-xl bg-yellow-900/25 border border-yellow-700/40 p-3">
                    <div className="w-12 text-center flex-shrink-0">
                      <div className="text-yellow-400 font-bold text-sm">B{b.id}</div>
                      <div className="text-yellow-700 text-[10px]">{b.inicio}</div>
                    </div>
                    <span className="text-yellow-300 font-semibold text-sm">⭐ Centro de Interés</span>
                  </div>
                );
                const entrada = entradas.find(e => e.dia === diaSeleccionado && e.bloque === b.id);
                if (!entrada) return (
                  <div key={b.id} className="flex items-center gap-3 rounded-xl border border-dashed border-white/8 p-3 opacity-40">
                    <div className="w-12 text-center flex-shrink-0">
                      <div className="text-gray-500 font-bold text-sm">B{b.id}</div>
                      <div className="text-gray-700 text-[10px]">{b.inicio}</div>
                    </div>
                    <span className="text-gray-600 text-sm">Libre</span>
                  </div>
                );
                const gradoStr = entrada.grado.includes('/') ? entrada.grado.split('/')[0] : entrada.grado;
                return (
                  <div
                    key={b.id}
                    className="flex items-center gap-3 rounded-xl border border-white/8 bg-white/4 p-3"
                    style={{ borderLeftColor: COLORES_AULA[entrada.aula] ?? '#fff', borderLeftWidth: 3 }}
                  >
                    <div className="w-12 text-center flex-shrink-0">
                      <div className="text-white font-bold text-sm">B{b.id}</div>
                      <div className="text-gray-500 text-[10px]">{b.inicio}</div>
                    </div>
                    <div className="flex-1">
                      <div className="font-semibold text-sm" style={{ color: colorGrado(gradoStr) }}>{gradoStr}</div>
                      {entrada.aula && (
                        <div className="text-xs mt-0.5" style={{ color: COLORES_AULA[entrada.aula] ?? '#aaa' }}>
                          {entrada.aula}
                        </div>
                      )}
                    </div>
                    <div className="text-xs text-gray-600">{b.fin}</div>
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

      {/* Toggle */}
      <div className="flex gap-1">
        <TabButton active={vistaDetalle === 'semana'} onClick={() => setVistaDetalle('semana')} color="grupo">Semana</TabButton>
        <TabButton active={vistaDetalle === 'dia'} onClick={() => setVistaDetalle('dia')} color="grupo">Día</TabButton>
      </div>

      <AnimatePresence mode="wait">
        {vistaDetalle === 'semana' ? (
          <motion.div key="semana" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="overflow-x-auto rounded-2xl border border-white/8 bg-white/3">
              <table className="text-xs border-collapse" style={{ minWidth: 400 }}>
                <thead>
                  <tr className="border-b border-white/8">
                    <th className="text-gray-500 px-3 py-2.5 text-left font-medium w-20">Bloque</th>
                    {DIAS.map(dia => (
                      <th key={dia} className="text-center px-2 py-2.5 text-gray-400 font-medium min-w-[90px]">
                        {DIAS_LABEL[dia].slice(0, 2)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {bloques.map(b => (
                    <tr key={b.id} className="border-b border-white/5">
                      <td className="px-3 text-gray-500" style={{ height: CELL_H }}>
                        <div className="font-semibold text-gray-400">B{b.id}</div>
                        <div className="text-gray-700 text-[10px]">{b.inicio}</div>
                      </td>
                      {DIAS.map(dia => {
                        const esCI = dia === 'martes' && b.id === 6 && jornadaTab === 'manana';
                        if (esCI) return (
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
                        const docente = USUARIOS.find(u => u.id === entrada.docente);
                        return (
                          <td key={dia} className="p-1" style={{ height: CELL_H }}>
                            <div
                              className="h-full rounded-lg border border-white/8 bg-white/4 flex flex-col items-center justify-center px-1 gap-0.5"
                              style={{ borderLeftColor: docente?.color ?? '#fff', borderLeftWidth: 2 }}
                            >
                              <span className="text-[10px] font-semibold truncate w-full text-center" style={{ color: docente?.color ?? '#aaa' }}>
                                {docente?.nombreCorto ?? entrada.docente}
                              </span>
                              {entrada.aula && (
                                <span className="text-[9px] text-gray-600 truncate w-full text-center">
                                  {entrada.aula}
                                </span>
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
          <motion.div key="dia" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3">
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
                    <div className="w-12 text-center flex-shrink-0">
                      <div className="text-yellow-400 font-bold text-sm">B{b.id}</div>
                      <div className="text-yellow-700 text-[10px]">{b.inicio}</div>
                    </div>
                    <span className="text-yellow-300 font-semibold text-sm">⭐ Centro de Interés</span>
                  </div>
                );
                const entrada = entradas.find(e => e.dia === diaSeleccionado && e.bloque === b.id);
                const docente = entrada ? USUARIOS.find(u => u.id === entrada.docente) : null;
                if (!entrada) return (
                  <div key={b.id} className="flex items-center gap-3 rounded-xl border border-dashed border-white/8 p-3 opacity-40">
                    <div className="w-12 text-center flex-shrink-0">
                      <div className="text-gray-500 font-bold text-sm">B{b.id}</div>
                      <div className="text-gray-700 text-[10px]">{b.inicio}</div>
                    </div>
                    <span className="text-gray-600 text-sm">Sin clase</span>
                  </div>
                );
                return (
                  <div
                    key={b.id}
                    className="flex items-center gap-3 rounded-xl border border-white/8 bg-white/4 p-3"
                    style={{ borderLeftColor: docente?.color ?? '#fff', borderLeftWidth: 3 }}
                  >
                    <div className="w-12 text-center flex-shrink-0">
                      <div className="text-white font-bold text-sm">B{b.id}</div>
                      <div className="text-gray-500 text-[10px]">{b.inicio}</div>
                    </div>
                    <div className="flex-1">
                      <div className="font-semibold text-sm" style={{ color: docente?.color ?? '#aaa' }}>
                        {docente?.nombreCorto ?? entrada.docente}
                      </div>
                      {entrada.aula && (
                        <div className="text-xs mt-0.5" style={{ color: COLORES_AULA[entrada.aula] ?? '#aaa' }}>
                          {entrada.aula}
                        </div>
                      )}
                    </div>
                    <div className="text-xs text-gray-600">{b.fin}</div>
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

// ── Componente principal ─────────────────────────────────────────────────────

export default function VistaHorario() {
  const { jornada, rol } = useAppStore();
  const defaultJornada: 'manana' | 'tarde' = jornada === 'tarde' ? 'tarde' : 'manana';

  const [modo, setModo]                   = useState<Modo>('aulas');
  const [jornadaTab, setJornadaTab]       = useState<'manana' | 'tarde'>(defaultJornada);
  const [docenteSel, setDocenteSel]       = useState('');
  const [grupoSel, setGrupoSel]           = useState('');

  const docentesMostrar = getDocentes(jornadaTab);
  const gruposUnicos = Array.from(new Set(
    horarioBase
      .filter(e => e.jornada === jornadaTab)
      .map(e => e.grado.includes('/') ? e.grado.split('/')[0] : e.grado)
  )).sort();

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
          <TabButton active={jornadaTab === 'manana'} onClick={() => setJornadaTab('manana')} color="jornada">
            Mañana
          </TabButton>
          <TabButton active={jornadaTab === 'tarde'} onClick={() => setJornadaTab('tarde')} color="jornada">
            Tarde
          </TabButton>
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
            <div className="space-y-4">
              <div className="flex flex-wrap gap-1.5">
                {docentesMostrar.map(d => (
                  <button
                    key={d.id}
                    onClick={() => setDocenteSel(d.id)}
                    className={cn(
                      'px-3 py-1.5 rounded-full text-xs font-medium transition-all border',
                      docenteSel === d.id
                        ? 'opacity-100 bg-white/8'
                        : 'opacity-50 border-transparent hover:opacity-80 hover:bg-white/5'
                    )}
                    style={{
                      color: d.color,
                      borderColor: docenteSel === d.id ? d.color : undefined,
                    }}
                  >
                    {d.nombreCorto}
                  </button>
                ))}
              </div>
              {docenteSel && <VistaDocente docenteId={docenteSel} jornadaTab={jornadaTab} />}
              {!docenteSel && (
                <p className="text-sm text-gray-600 text-center py-8">
                  Selecciona un docente para ver su horario
                </p>
              )}
            </div>
          )}

          {modo === 'grupo' && (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-1.5">
                {gruposUnicos.map(g => {
                  const dirId = jornadaTab === 'manana' ? DIRECTORES_MANANA[g] : DIRECTORES_TARDE[g];
                  const dir   = USUARIOS.find(u => u.id === dirId);
                  return (
                    <button
                      key={g}
                      onClick={() => setGrupoSel(g)}
                      className={cn(
                        'px-3 py-1.5 rounded-full text-xs font-medium transition-all border',
                        grupoSel === g
                          ? 'opacity-100 bg-white/8'
                          : 'opacity-50 border-transparent hover:opacity-80 hover:bg-white/5'
                      )}
                      style={{
                        color: colorGrado(g),
                        borderColor: grupoSel === g ? colorGrado(g) : undefined,
                      }}
                    >
                      {dir ? `${dir.nombreCorto}·${g}` : g}
                    </button>
                  );
                })}
              </div>
              {grupoSel && <VistaGrupo grado={grupoSel} jornadaTab={jornadaTab} />}
              {!grupoSel && (
                <p className="text-sm text-gray-600 text-center py-8">
                  Selecciona un grupo para ver su horario
                </p>
              )}
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
