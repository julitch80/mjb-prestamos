// Agenda de demostración (#/plan-demo): datos ficticios y un «hoy» que se puede mover para
// ver cómo se comporta la agenda en cada momento del plan. No sube nada (token vacío).
import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import AgendaPlanPublica from './AgendaPlanPublica';
import { crearDemoAgenda } from '../../data/planCasa/demoAgenda';
import { aISO, sumarDias } from '../../data/planCasa/calendarioAgenda';
import type { FechaISO } from '../../data/planCasa/tipos';

export default function AgendaDemo() {
  const demo = useMemo(() => crearDemoAgenda(), []);
  // Arranca en la mitad del plan: ya hay entregas hechas, otras atrasadas y otras por venir.
  const [hoy, setHoy] = useState<FechaISO>(demo.atajos.mitad);
  const mover = (n: number) => { if (hoy) setHoy(sumarDias(hoy, n)); };
  const atajos: { texto: string; f: FechaISO }[] = [
    { texto: 'Inicio del plan', f: demo.atajos.inicio },
    { texto: 'Mitad', f: demo.atajos.mitad },
    { texto: 'Día de entrega', f: demo.atajos.entrega },
    { texto: 'Después del cierre', f: demo.atajos.despues },
  ];
  const boton = 'min-h-[44px] min-w-[44px] rounded-lg border border-line bg-card text-strong flex items-center justify-center';
  return (
    <>
      <div className="border-b-2 border-warning bg-warning-soft text-warning-soft-fg px-4 py-3">
        <div className="mx-auto max-w-3xl space-y-2">
          <p className="text-base font-bold">Agenda de demostración — datos ficticios</p>
          <div className="flex flex-wrap items-center gap-2">
            <label htmlFor="demo-hoy" className="text-sm font-semibold">Ver como si hoy fuera:</label>
            <button onClick={() => mover(-1)} aria-label="Un día antes" className={boton}><ChevronLeft size={18} /></button>
            <input id="demo-hoy" type="date" value={hoy} onChange={e => { if (e.target.value) setHoy(e.target.value); }}
              className="min-h-[44px] rounded-lg border border-line bg-card text-strong px-2 text-base" />
            <button onClick={() => mover(1)} aria-label="Un día después" className={boton}><ChevronRight size={18} /></button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {atajos.map(a => (
              <button key={a.texto} onClick={() => setHoy(a.f)}
                className={`min-h-[44px] px-3 rounded-lg border text-sm font-semibold ${hoy === a.f ? 'bg-accent text-accent-fg border-accent' : 'border-line bg-card text-strong'}`}>
                {a.texto}
              </button>
            ))}
          </div>
          <p className="text-xs">Hoy real: {aISO(new Date())}. Las entregas no se envían en la demostración.</p>
        </div>
      </div>
      <AgendaPlanPublica token="" datos={demo.datos} hoy={hoy} />
    </>
  );
}
