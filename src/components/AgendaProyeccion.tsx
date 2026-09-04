import { X } from 'lucide-react';
import { getAsignatura } from '../data/asignacionAcademica';
import type { FechaISO, Tarea } from '../data/tareas/tipos';

/**
 * Modo proyección: el director lo muestra al frente del salón mientras cada
 * estudiante elige SU momento en su propio teléfono. Por eso aquí NO se
 * muestran momentos elegidos ni casillas de nadie — lo que cada quien decide
 * es suyo y no se expone frente al grupo. Solo las tareas de la semana, en
 * letra grande legible desde la última fila, sin menús alrededor.
 */
export default function AgendaProyeccion({ grupo, semana, tareasDelDia, onCerrar }: {
  grupo: string;
  semana: FechaISO[];
  tareasDelDia: (f: FechaISO) => { b: { momentos: number }; t: Tarea }[];
  onCerrar: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 overflow-auto bg-[#0b1220] text-white">
      <button
        onClick={onCerrar}
        className="fixed top-4 right-4 z-10 flex items-center gap-1.5 rounded-full border border-white/30 bg-black/40 px-4 py-2 text-sm font-medium text-white"
      >
        <X size={16} /> Cerrar
      </button>

      <div className="mx-auto max-w-4xl px-8 py-10 space-y-8">
        <h1 className="text-4xl font-bold text-center">Agenda de {grupo}</h1>

        {semana.map(f => {
          const items = tareasDelDia(f);
          if (items.length === 0) return null;
          return (
            <div key={f} className="space-y-3">
              <h2 className="text-2xl font-bold border-b border-white/20 pb-1">{diaLargo(f)}</h2>
              <div className="space-y-2">
                {items.map(({ b, t }, i) => (
                  <div key={i} className="text-xl leading-snug">
                    <span className="font-bold">{getAsignatura(t.asignaturaId)?.nombre ?? t.asignaturaId}</span>
                    {' — '}{t.titulo}
                    <span className="text-white/60 text-lg"> ({b.momentos * 25} min)</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function diaLargo(f: FechaISO): string {
  const [y, m, d] = f.split('-').map(Number);
  const fecha = new Date(y, m - 1, d);
  const dias = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  const meses = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  return `${dias[fecha.getDay()]} ${d} de ${meses[m - 1]}`;
}
