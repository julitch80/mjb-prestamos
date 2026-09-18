import { useEffect, useState } from 'react';

import { leerCasosRemitidos } from './datos';
import { nombreCompleto } from './domain/nombres';
import type { CasoPermanencia } from './domain/permanencia';
import type { Student } from './domain/types';

/**
 * Aviso al director de grupo: coordinación le remitió casos de permanencia. Sin esto,
 * se enteraría solo si abre por casualidad la ficha del estudiante.
 *
 * No aparece nada si no hay remisiones: es la situación normal, y un aviso de «0 casos»
 * en la cabecera de todos los grupos sería ruido.
 */
export default function CasosRemitidos({
  grado,
  estudiantes,
  onAbrirFicha,
}: {
  grado: string;
  estudiantes: Student[];
  onAbrirFicha: (studentId: string) => void;
}) {
  const [casos, setCasos] = useState<CasoPermanencia[]>([]);
  const [abierto, setAbierto] = useState(false);

  useEffect(() => {
    let vivo = true;
    // Si falla (sin permiso, sin red) no se muestra nada: es un aviso, no una pantalla.
    void leerCasosRemitidos(grado)
      .then((c) => vivo && setCasos(c))
      .catch(() => vivo && setCasos([]));
    return () => {
      vivo = false;
    };
  }, [grado]);

  if (casos.length === 0) return null;
  const nombre = (id: string) => {
    const e = estudiantes.find((x) => x.studentId === id);
    return e ? nombreCompleto(e) : id;
  };

  return (
    <div className="relative">
      <button
        onClick={() => setAbierto((v) => !v)}
        className="min-h-9 rounded-xl border border-info-soft bg-info-soft px-3 text-xs font-semibold text-info-soft-fg"
      >
        {casos.length} caso(s) remitido(s) por coordinación
      </button>
      {abierto && (
        <ul className="absolute left-0 z-20 mt-1 w-72 space-y-1 rounded-xl border border-line bg-card p-2 text-sm shadow-lg">
          {casos.map((c) => (
            <li key={c.casoId}>
              <button
                onClick={() => {
                  setAbierto(false);
                  onAbrirFicha(c.studentId);
                }}
                className="text-left text-accent underline"
              >
                {nombre(c.studentId)}
              </button>
              {c.remisionNota && <span className="block text-xs text-muted">«{c.remisionNota}»</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
