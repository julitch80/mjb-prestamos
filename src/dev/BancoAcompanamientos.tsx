// Banco de pruebas local del editor de acompañamientos — SOLO DESARROLLO.
// Se monta desde App.tsx con React.lazy tras comprobar `import.meta.env.DEV`,
// así Vite lo deja fuera del build de producción (TAREAS.md § D).
//
// Muestra las pantallas nuevas con datos de ejemplo (la distribución
// inicial), sin Firebase y sin iniciar sesión: `onPublicar` solo hace
// console.log.

import { useState } from 'react';
import type { JornadaAcomp, Publicacion } from '../data/acompanamientos/tipos';
import { asignacionesDeZonaEnDia, publicacionVigente } from '../data/acompanamientos/vigente';
import { DIAS } from '../data/acompanamientos/tipos';
import { USUARIOS } from '../data/maestros';
import CargaPorProfesor from '../components/acompanamientos/CargaPorProfesor';
import PanelEditarAcompanamientos from '../components/acompanamientos/PanelEditarAcompanamientos';

function fechaHoyLocal(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const DIA_LABEL: Record<string, string> = {
  lunes: 'Lunes', martes: 'Martes', miercoles: 'Miércoles', jueves: 'Jueves', viernes: 'Viernes',
};

export default function BancoAcompanamientos() {
  const [jornada, setJornada] = useState<JornadaAcomp>('manana');
  const [panelAbierto, setPanelAbierto] = useState(false);
  // Publicaciones en memoria — SOLO este banco. Nunca toca Firebase ni Apps
  // Script (TAREAS.md § Banco de pruebas): así el historial y el aviso
  // «Cambia desde…» se pueden ver en local sin backend.
  const [publicaciones, setPublicaciones] = useState<Publicacion[]>([]);

  const vigente = publicacionVigente(publicaciones, jornada, fechaHoyLocal());

  return (
    <div className="min-h-screen bg-bg p-6 space-y-6 max-w-3xl mx-auto">
      <div>
        <h1 className="text-strong text-lg font-bold">Banco de pruebas — Acompañamientos</h1>
        <p className="text-muted text-xs mt-1">Solo desarrollo. No viaja al build de producción.</p>
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => setJornada('manana')}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium border border-line ${jornada === 'manana' ? 'bg-hover text-strong' : 'text-muted'}`}
        >
          Mañana
        </button>
        <button
          onClick={() => setJornada('tarde')}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium border border-line ${jornada === 'tarde' ? 'bg-hover text-strong' : 'text-muted'}`}
        >
          Tarde
        </button>
        <button
          onClick={() => setPanelAbierto(true)}
          className="px-3 py-1.5 rounded-lg text-sm font-medium bg-accent text-accent-fg ml-auto"
        >
          ✎ Editar
        </button>
      </div>

      {/* Tabla de la pestaña, con la distribución inicial como ejemplo */}
      <div className="overflow-x-auto rounded-2xl border border-line bg-elevated/40">
        <table className="text-xs border-collapse w-full">
          <thead>
            <tr className="border-b border-line">
              <th className="text-muted px-3 py-2.5 text-left font-medium w-36">Zona</th>
              {DIAS.map((dia) => (
                <th key={dia} className="text-center px-2 py-2.5 font-semibold text-soft min-w-[90px]">
                  {DIA_LABEL[dia]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {vigente.zonas.map((zona, i) => (
              <tr key={zona.id} className={`border-b border-line/50 ${i % 2 === 0 ? '' : 'bg-card/30'}`}>
                <td className="px-3 py-2 font-semibold text-strong whitespace-nowrap">{zona.nombre}</td>
                {DIAS.map((dia) => {
                  const asignados = asignacionesDeZonaEnDia(vigente, zona.id, dia)
                    .map((a) => USUARIOS.find((u) => u.id === a.docenteId))
                    .filter((u): u is NonNullable<typeof u> => !!u);
                  return (
                    <td key={dia} className="px-1.5 py-1">
                      <div className="flex flex-col gap-1">
                        {asignados.length === 0 ? (
                          <div className="rounded-lg border border-dashed border-line flex items-center justify-center py-2">
                            <span className="text-muted opacity-50 text-[10px]">—</span>
                          </div>
                        ) : (
                          asignados.map((u) => (
                            <div
                              key={u.id}
                              className="rounded-lg px-2 py-1 flex items-center justify-center"
                              style={{ borderWidth: 1, borderColor: u.color, backgroundColor: `${u.color}15` }}
                            >
                              <span className="text-[11px] font-bold leading-none" style={{ color: u.color }}>
                                {u.nombreCorto}
                              </span>
                            </div>
                          ))
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

      <div>
        <h2 className="text-strong text-sm font-semibold mb-2">Carga por profesor</h2>
        <CargaPorProfesor distribucion={vigente} />
      </div>

      {panelAbierto && (
        <PanelEditarAcompanamientos
          jornada={jornada}
          vigente={vigente}
          publicaciones={publicaciones}
          usuario={{ correo: 'coordinador.prueba@iemanueljbetancur.edu.co', nombre: 'Coordinadora (banco)' }}
          onPublicar={async (dist, vigenteDesde, avisos) => {
            const nueva: Publicacion = {
              ...dist,
              id: `banco-${Date.now()}`,
              vigenteDesde,
              publicadoPor: 'coordinador.prueba@iemanueljbetancur.edu.co',
              publicadoPorNombre: 'Coordinadora (banco)',
              publicadoEn: Date.now(),
              esInicial: false,
            };
            setPublicaciones((prev) => [...prev, nueva]);
            // Simula un correo fallido, para poder ver ese mensaje en local.
            const correosFallidos = avisos.length > 0 ? [avisos[0].nombre + ' (simulado, banco de pruebas)'] : [];
            return { correosFallidos };
          }}
          onCerrar={() => setPanelAbierto(false)}
        />
      )}
    </div>
  );
}
