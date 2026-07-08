import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { RefreshCw } from 'lucide-react';
import { getDatosTareas } from '../data/api';
import AgendaGrupo from './AgendaGrupo';

export default function AgendaPublica({ grupo }: { grupo: string }) {
  const { data, dataUpdatedAt, isLoading } = useQuery({
    queryKey: ['agendaPublica', grupo],
    queryFn: () => getDatosTareas(grupo),
    refetchInterval: 1000 * 60 * 5,
  });

  // "actualizado hace X min" con tic de refresco
  const [, setTic] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTic(t => t + 1), 30000);
    return () => clearInterval(id);
  }, []);

  const minAtras = Math.max(0, Math.round((Date.now() - dataUpdatedAt) / 60000));

  return (
    <div className="min-h-screen flex flex-col items-center px-4 py-6">
      <div className="w-full max-w-md space-y-4">
        <header className="flex items-center gap-3">
          <img src={`${import.meta.env.BASE_URL}mjb_escudo.png`} alt="Escudo MJB" className="w-10 h-10 object-contain" />
          <div>
            <h1 className="font-bold text-strong leading-tight">Agenda de tareas</h1>
            <p className="text-[11px] text-muted">I.E. Manuel J. Betancur</p>
          </div>
        </header>

        {isLoading ? (
          <div className="rounded-2xl border border-line bg-elevated/40 p-6 text-center text-sm text-muted">
            Cargando la agenda…
          </div>
        ) : (
          <>
            <AgendaGrupo grupo={grupo} tareas={data?.tareas ?? []} mostrarQR={false} />
            <footer className="flex justify-between items-center text-[10px] text-muted px-1">
              <span className="flex items-center gap-1"><RefreshCw size={10} /> actualizado hace {minAtras} min</span>
              <span>se actualiza automáticamente</span>
            </footer>
          </>
        )}
      </div>
    </div>
  );
}
