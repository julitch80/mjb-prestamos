import { useState } from 'react';
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

type Modo = 'aulas' | 'docente' | 'grupo';
type VistaDetalle = 'semana' | 'dia';

const DIAS = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes'] as const;
const DIAS_LABEL: Record<string, string> = {
  lunes: 'Lunes', martes: 'Martes', miercoles: 'Miércoles', jueves: 'Jueves', viernes: 'Viernes',
};

function docenteEnTarde(docenteId: string, dia: string): boolean {
  const dias = MIXTOS_TARDE[docenteId];
  return dias ? dias.includes(dia) : false;
}

// ── Vista por aulas ─────────────────────────────────────────────────────────

function VistaAulas({ jornadaTab }: { jornadaTab: 'manana' | 'tarde' }) {
  const bloques = jornadaTab === 'tarde' ? BLOQUES_TARDE : BLOQUES_MANANA;

  // Filtrar horario por jornada
  const entradas = horarioBase.filter(e => e.jornada === jornadaTab);

  // Obtener lista de aulas únicas
  const aulasSet = new Set<string>();
  entradas.forEach(e => { if (e.aula) aulasSet.add(e.aula); });
  const aulas = Array.from(aulasSet).sort();

  if (aulas.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500 text-sm">
        {jornadaTab === 'manana'
          ? 'Las aulas de mañana están pendientes de configurar. Consulta la vista por docente.'
          : 'Sin datos de aulas.'}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr>
            <th className="text-left text-gray-500 p-2 w-16">Aula</th>
            {DIAS.map(dia => (
              bloques.map(b => (
                <th key={`${dia}-${b.id}`} className="text-center text-gray-500 p-1 font-normal">
                  <div className="text-xs">{DIAS_LABEL[dia].slice(0, 2)}</div>
                  <div className="text-gray-600">B{b.id}</div>
                </th>
              ))
            ))}
          </tr>
        </thead>
        <tbody>
          {aulas.map(aula => (
            <tr key={aula}>
              <td className="p-2 font-medium" style={{ color: COLORES_AULA[aula] ?? '#fff' }}>
                {aula}
              </td>
              {DIAS.map(dia =>
                bloques.map(b => {
                  const entrada = entradas.find(e => e.dia === dia && e.bloque === b.id && e.aula === aula);
                  if (!entrada) return <td key={`${dia}-${b.id}`} className="p-1 text-center text-gray-700">–</td>;
                  const docente = USUARIOS.find(u => u.id === entrada.docente);
                  return (
                    <td key={`${dia}-${b.id}`} className="p-1 text-center">
                      <span style={{ color: docente?.color ?? '#aaa' }} className="font-medium">
                        {docente?.nombreCorto ?? entrada.docente}
                      </span>
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
  const [diaSeleccionado, setDiaSeleccionado] = useState<string>('lunes');

  const bloques = jornadaTab === 'tarde' ? BLOQUES_TARDE : BLOQUES_MANANA;
  const entradas = horarioBase.filter(e => e.docente === docenteId && e.jornada === jornadaTab);

  // ── Vista semana ──
  if (vistaDetalle === 'semana') {
    return (
      <div className="space-y-3">
        <div className="flex gap-2">
          <button onClick={() => setVistaDetalle('semana')} className="px-3 py-1 rounded-lg bg-blue-600 text-white text-xs">Semana</button>
          <button onClick={() => setVistaDetalle('dia')} className="px-3 py-1 rounded-lg bg-gray-800 text-gray-400 hover:text-white text-xs transition">Día</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr>
                <th className="text-gray-500 p-2 text-left w-16">Bloque</th>
                {DIAS.map(dia => {
                  const esTarde = docenteEnTarde(docenteId, dia);
                  return (
                    <th key={dia} className={`text-center p-2 font-medium ${esTarde ? 'text-yellow-400' : 'text-gray-400'}`}>
                      {DIAS_LABEL[dia].slice(0, 2)}
                      {esTarde && <span className="ml-0.5 text-yellow-400">·T</span>}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {bloques.map(b => (
                <tr key={b.id}>
                  <td className="text-gray-500 p-2">B{b.id}<br /><span className="text-gray-700">{b.inicio}</span></td>
                  {DIAS.map(dia => {
                    const esTarde = docenteEnTarde(docenteId, dia);
                    if (esTarde && jornadaTab === 'manana') {
                      return <td key={dia} className="p-2 text-center text-yellow-700 text-xs">Tarde</td>;
                    }
                    const entrada = entradas.find(e => e.dia === dia && e.bloque === b.id);
                    // CI martes B6
                    const esCI = dia === 'martes' && b.id === 6;
                    if (esCI) {
                      return (
                        <td key={dia} className="p-2 text-center">
                          <span className="text-yellow-400 font-bold">⭐ CI</span>
                        </td>
                      );
                    }
                    if (!entrada) return <td key={dia} className="p-2 text-center text-gray-700">–</td>;
                    const gradoStr = entrada.grado.includes('/') ? entrada.grado.split('/')[0] : entrada.grado;
                    return (
                      <td key={dia} className="p-2 text-center">
                        <div style={{ color: COLORES_AULA[entrada.aula] ?? '#aaa' }} className="font-medium">
                          {entrada.aula || '?'}
                        </div>
                        <div style={{ color: colorGrado(gradoStr) }} className="text-xs">
                          {gradoStr}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // ── Vista día (banners Opción B) ──
  const entradasDia = entradas.filter(e => e.dia === diaSeleccionado);

  return (
    <div className="space-y-3">
      <div className="flex gap-2 flex-wrap">
        <button onClick={() => setVistaDetalle('semana')} className="px-3 py-1 rounded-lg bg-gray-800 text-gray-400 hover:text-white text-xs transition">Semana</button>
        <button onClick={() => setVistaDetalle('dia')} className="px-3 py-1 rounded-lg bg-blue-600 text-white text-xs">Día</button>
        <div className="w-full flex gap-1 mt-1">
          {DIAS.map(dia => {
            const esTarde = docenteEnTarde(docenteId, dia);
            return (
              <button
                key={dia}
                onClick={() => setDiaSeleccionado(dia)}
                className={`flex-1 py-1 rounded text-xs transition ${
                  diaSeleccionado === dia ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'
                } ${esTarde ? 'border border-yellow-700' : ''}`}
              >
                {DIAS_LABEL[dia].slice(0, 2)}
              </button>
            );
          })}
        </div>
      </div>

      {/* Banners del día */}
      {bloques.map(b => {
        const entrada = entradasDia.find(e => e.bloque === b.id);
        const esCI = diaSeleccionado === 'martes' && b.id === 6;
        const esTardeHoy = docenteEnTarde(docenteId, diaSeleccionado);

        if (esTardeHoy && jornadaTab === 'manana') {
          return (
            <div key={b.id} className="flex items-center gap-3 bg-yellow-900/20 border border-yellow-900/40 rounded-xl p-3">
              <div className="text-center w-12 flex-shrink-0">
                <div className="text-yellow-400 font-bold text-sm">B{b.id}</div>
                <div className="text-yellow-700 text-xs">{b.inicio}</div>
              </div>
              <span className="text-yellow-600 text-sm">Jornada tarde</span>
            </div>
          );
        }

        if (esCI) {
          return (
            <div key={b.id} className="flex items-center gap-3 bg-yellow-900/30 border border-yellow-700/50 rounded-xl p-3">
              <div className="text-center w-12 flex-shrink-0">
                <div className="text-yellow-400 font-bold text-sm">B{b.id}</div>
                <div className="text-yellow-700 text-xs">{b.inicio}</div>
              </div>
              <span className="text-yellow-400 font-semibold">⭐ Centro de Interés</span>
            </div>
          );
        }

        if (!entrada) {
          return (
            <div key={b.id} className="flex items-center gap-3 bg-gray-900/50 border border-gray-800 rounded-xl p-3 opacity-40">
              <div className="text-center w-12 flex-shrink-0">
                <div className="text-gray-500 font-bold text-sm">B{b.id}</div>
                <div className="text-gray-700 text-xs">{b.inicio}</div>
              </div>
              <span className="text-gray-600 text-sm">Libre</span>
            </div>
          );
        }

        const gradoStr = entrada.grado.includes('/') ? entrada.grado.split('/')[0] : entrada.grado;
        return (
          <div key={b.id} className="flex items-center gap-3 bg-gray-900 border border-gray-800 rounded-xl p-3">
            <div className="text-center w-12 flex-shrink-0">
              <div className="text-white font-bold text-sm">B{b.id}</div>
              <div className="text-gray-500 text-xs">{b.inicio}</div>
            </div>
            <div className="flex-1">
              <div style={{ color: colorGrado(gradoStr) }} className="font-semibold text-sm">
                {gradoStr}
              </div>
              {entrada.aula && (
                <div style={{ color: COLORES_AULA[entrada.aula] ?? '#aaa' }} className="text-xs mt-0.5">
                  {entrada.aula}
                </div>
              )}
            </div>
            <div className="text-right text-xs text-gray-500">{b.fin}</div>
          </div>
        );
      })}
    </div>
  );
}

// ── Vista por grupo ──────────────────────────────────────────────────────────

function VistaGrupo({ grado, jornadaTab }: { grado: string; jornadaTab: 'manana' | 'tarde' }) {
  const [vistaDetalle, setVistaDetalle] = useState<VistaDetalle>('semana');
  const [diaSeleccionado, setDiaSeleccionado] = useState<string>('lunes');

  const bloques = jornadaTab === 'tarde' ? BLOQUES_TARDE : BLOQUES_MANANA;

  // Obtener aula fija del grupo (tarde)
  const aulaGrupo = Object.entries(AULA_GRUPO_TARDE).find(([, g]) => g === grado)?.[0] ?? '';

  // Director
  const directores = jornadaTab === 'manana' ? DIRECTORES_MANANA : DIRECTORES_TARDE;
  const directorId = directores[grado];
  const director = USUARIOS.find(u => u.id === directorId);

  const entradas = horarioBase.filter(e => {
    const gradoBase = e.grado.includes('/') ? e.grado.split('/')[0] : e.grado;
    return gradoBase === grado && e.jornada === jornadaTab;
  });

  if (vistaDetalle === 'semana') {
    return (
      <div className="space-y-3">
        <div className="flex gap-2">
          <button onClick={() => setVistaDetalle('semana')} className="px-3 py-1 rounded-lg bg-blue-600 text-white text-xs">Semana</button>
          <button onClick={() => setVistaDetalle('dia')} className="px-3 py-1 rounded-lg bg-gray-800 text-gray-400 hover:text-white text-xs transition">Día</button>
        </div>
        {director && (
          <p className="text-xs text-gray-500">
            Director de grupo: <span style={{ color: director.color }} className="font-medium">{director.nombre}</span>
          </p>
        )}
        {aulaGrupo && (
          <p className="text-xs text-gray-500">
            Aula fija: <span style={{ color: COLORES_AULA[aulaGrupo] }} className="font-medium">{aulaGrupo}</span>
          </p>
        )}
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr>
                <th className="text-gray-500 p-2 text-left w-16">Bloque</th>
                {DIAS.map(dia => (
                  <th key={dia} className="text-center p-2 text-gray-400 font-medium">
                    {DIAS_LABEL[dia].slice(0, 2)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {bloques.map(b => (
                <tr key={b.id}>
                  <td className="text-gray-500 p-2">B{b.id}<br /><span className="text-gray-700">{b.inicio}</span></td>
                  {DIAS.map(dia => {
                    const esCI = dia === 'martes' && b.id === 6 && jornadaTab === 'manana';
                    if (esCI) {
                      return (
                        <td key={dia} className="p-2 text-center">
                          <span className="text-yellow-400 font-bold">⭐ CI</span>
                        </td>
                      );
                    }
                    const entrada = entradas.find(e => e.dia === dia && e.bloque === b.id);
                    if (!entrada) return <td key={dia} className="p-2 text-center text-gray-700">–</td>;
                    const docente = USUARIOS.find(u => u.id === entrada.docente);
                    return (
                      <td key={dia} className="p-2 text-center">
                        <div style={{ color: docente?.color ?? '#aaa' }} className="font-medium">
                          {docente?.nombreCorto ?? entrada.docente}
                        </div>
                        {entrada.aula && (
                          <div style={{ color: COLORES_AULA[entrada.aula] ?? '#888' }} className="text-xs">
                            {entrada.aula}
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
      </div>
    );
  }

  // Vista día
  const entradasDia = entradas.filter(e => e.dia === diaSeleccionado);

  return (
    <div className="space-y-3">
      <div className="flex gap-2 flex-wrap">
        <button onClick={() => setVistaDetalle('semana')} className="px-3 py-1 rounded-lg bg-gray-800 text-gray-400 hover:text-white text-xs transition">Semana</button>
        <button onClick={() => setVistaDetalle('dia')} className="px-3 py-1 rounded-lg bg-blue-600 text-white text-xs">Día</button>
        <div className="w-full flex gap-1 mt-1">
          {DIAS.map(dia => (
            <button
              key={dia}
              onClick={() => setDiaSeleccionado(dia)}
              className={`flex-1 py-1 rounded text-xs transition ${
                diaSeleccionado === dia ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'
              }`}
            >
              {DIAS_LABEL[dia].slice(0, 2)}
            </button>
          ))}
        </div>
      </div>

      {director && (
        <p className="text-xs text-gray-500">
          Director: <span style={{ color: director.color }} className="font-medium">{director.nombre}</span>
        </p>
      )}

      {bloques.map(b => {
        const esCI = diaSeleccionado === 'martes' && b.id === 6 && jornadaTab === 'manana';
        if (esCI) {
          return (
            <div key={b.id} className="flex items-center gap-3 bg-yellow-900/30 border border-yellow-700/50 rounded-xl p-3">
              <div className="text-center w-12 flex-shrink-0">
                <div className="text-yellow-400 font-bold text-sm">B{b.id}</div>
                <div className="text-yellow-700 text-xs">{b.inicio}</div>
              </div>
              <span className="text-yellow-400 font-semibold">⭐ Centro de Interés</span>
            </div>
          );
        }

        const entrada = entradasDia.find(e => e.bloque === b.id);
        if (!entrada) {
          return (
            <div key={b.id} className="flex items-center gap-3 bg-gray-900/50 border border-gray-800 rounded-xl p-3 opacity-40">
              <div className="text-center w-12 flex-shrink-0">
                <div className="text-gray-500 font-bold text-sm">B{b.id}</div>
                <div className="text-gray-700 text-xs">{b.inicio}</div>
              </div>
              <span className="text-gray-600 text-sm">Sin clase</span>
            </div>
          );
        }

        const docente = USUARIOS.find(u => u.id === entrada.docente);
        return (
          <div key={b.id} className="flex items-center gap-3 bg-gray-900 border border-gray-800 rounded-xl p-3">
            <div className="text-center w-12 flex-shrink-0">
              <div className="text-white font-bold text-sm">B{b.id}</div>
              <div className="text-gray-500 text-xs">{b.inicio}</div>
            </div>
            <div className="flex-1">
              <div style={{ color: docente?.color ?? '#aaa' }} className="font-semibold text-sm">
                {docente?.nombreCorto ?? entrada.docente}
              </div>
              {entrada.aula && (
                <div style={{ color: COLORES_AULA[entrada.aula] ?? '#888' }} className="text-xs mt-0.5">
                  {entrada.aula}
                </div>
              )}
            </div>
            <div className="text-right text-xs text-gray-500">{b.fin}</div>
          </div>
        );
      })}
    </div>
  );
}

// ── Componente principal ─────────────────────────────────────────────────────

export default function VistaHorario() {
  const { jornada, rol } = useAppStore();

  const defaultJornada: 'manana' | 'tarde' =
    jornada === 'tarde' ? 'tarde' : 'manana';

  const [modo, setModo] = useState<Modo>('aulas');
  const [jornadaTab, setJornadaTab] = useState<'manana' | 'tarde'>(defaultJornada);
  const [docenteSeleccionado, setDocenteSeleccionado] = useState('');
  const [grupoSeleccionado, setGrupoSeleccionado] = useState('');

  // Paleta de docentes filtrada por jornada
  const docentesMostrar = getDocentes(jornadaTab === 'manana' ? 'manana' : 'tarde');

  // Grupos únicos del horario según jornada
  const gruposUnicos = Array.from(
    new Set(
      horarioBase
        .filter(e => e.jornada === jornadaTab)
        .map(e => e.grado.includes('/') ? e.grado.split('/')[0] : e.grado)
    )
  ).sort();

  // Solo rectora y coordinador pueden ver ambas jornadas; docentes solo la suya
  const puedeVerAmbasJornadas = rol === 'rectora' || rol === 'coordinador';

  return (
    <div className="space-y-4">
      {/* Selector de modo */}
      <div className="flex gap-1">
        {(['aulas', 'docente', 'grupo'] as Modo[]).map(m => (
          <button
            key={m}
            onClick={() => setModo(m)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition capitalize ${
              modo === m
                ? 'bg-blue-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700'
            }`}
          >
            {m === 'aulas' ? 'Por aulas' : m === 'docente' ? 'Por docente' : 'Por grupo'}
          </button>
        ))}
      </div>

      {/* Selector de jornada (si puede ver ambas) */}
      {puedeVerAmbasJornadas && (
        <div className="flex gap-1">
          <button
            onClick={() => setJornadaTab('manana')}
            className={`px-4 py-2 rounded-lg text-sm transition ${
              jornadaTab === 'manana' ? 'bg-gray-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'
            }`}
          >
            Mañana
          </button>
          <button
            onClick={() => setJornadaTab('tarde')}
            className={`px-4 py-2 rounded-lg text-sm transition ${
              jornadaTab === 'tarde' ? 'bg-gray-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'
            }`}
          >
            Tarde
          </button>
        </div>
      )}

      {/* Contenido según modo */}
      {modo === 'aulas' && <VistaAulas jornadaTab={jornadaTab} />}

      {modo === 'docente' && (
        <div className="space-y-4">
          {/* Selector de docente */}
          <div className="flex flex-wrap gap-2">
            {docentesMostrar.map(d => (
              <button
                key={d.id}
                onClick={() => setDocenteSeleccionado(d.id)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition border ${
                  docenteSeleccionado === d.id
                    ? 'border-current opacity-100'
                    : 'border-transparent opacity-60 hover:opacity-100'
                }`}
                style={{ color: d.color, borderColor: docenteSeleccionado === d.id ? d.color : undefined }}
              >
                {d.nombreCorto}
              </button>
            ))}
          </div>
          {docenteSeleccionado && (
            <VistaDocente docenteId={docenteSeleccionado} jornadaTab={jornadaTab} />
          )}
        </div>
      )}

      {modo === 'grupo' && (
        <div className="space-y-4">
          {/* Selector de grupo */}
          <div className="flex flex-wrap gap-2">
            {gruposUnicos.map(g => {
              const directorId = jornadaTab === 'manana' ? DIRECTORES_MANANA[g] : DIRECTORES_TARDE[g];
              const director = USUARIOS.find(u => u.id === directorId);
              return (
                <button
                  key={g}
                  onClick={() => setGrupoSeleccionado(g)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition border ${
                    grupoSeleccionado === g
                      ? 'border-current opacity-100'
                      : 'border-transparent opacity-60 hover:opacity-100'
                  }`}
                  style={{
                    color: colorGrado(g),
                    borderColor: grupoSeleccionado === g ? colorGrado(g) : undefined,
                  }}
                >
                  {director ? `${director.nombreCorto}·${g}` : g}
                </button>
              );
            })}
          </div>
          {grupoSeleccionado && (
            <VistaGrupo grado={grupoSeleccionado} jornadaTab={jornadaTab} />
          )}
        </div>
      )}
    </div>
  );
}
