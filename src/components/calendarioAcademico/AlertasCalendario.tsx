// Avisos del calendario académico para docentes/coordinadores: a 7, 2 y 0 días de cada
// evento marcado «alertaDocente». Se calculan en el cliente; se descartan por evento+escalón.
import { useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { useAppStore } from '../../data/store';
import { ASIGNACION_2026 } from '../../data/asignacionAcademica';
import { useCalendario } from '../../data/calendarioAcademico/persistencia';
import { alertasDocente, eventosParaGrado11, hoyISO, textoCuentaRegresiva, textoFecha } from '../../data/calendarioAcademico/logica';

const LLAVE = 'mjb_cal_alertas_descartadas';
function leer(): string[] {
  try { const v = JSON.parse(localStorage.getItem(LLAVE) ?? '[]'); return Array.isArray(v) ? v : []; } catch { return []; }
}
function guardar(v: string[]) { try { localStorage.setItem(LLAVE, JSON.stringify(v.slice(-200))); } catch { /* sin almacenamiento */ } }

export default function AlertasCalendario() {
  const userId = useAppStore(s => s.userId);
  const rol = useAppStore(s => s.rol);
  const { eventos } = useCalendario();
  const [descartadas, setDescartadas] = useState<string[]>(leer);

  const alertas = useMemo(() => {
    const ensenaOnce = rol !== 'docente' || ASIGNACION_2026.some(a => a.docenteId === userId && a.grupo.startsWith('11'));
    return alertasDocente(eventosParaGrado11(eventos, ensenaOnce), hoyISO()).filter(a => !descartadas.includes(a.clave));
  }, [eventos, userId, rol, descartadas]);

  if (alertas.length === 0) return null;
  const descartar = (clave: string) => { const n = [...descartadas, clave]; setDescartadas(n); guardar(n); };

  return (
    <div className="bg-card border-b border-line">
      <div className="max-w-7xl mx-auto px-4 py-2 space-y-1.5">
        {alertas.slice(0, 3).map(a => (
          <div key={a.clave} className="flex items-start gap-2 rounded-lg bg-warning-soft text-warning-soft-fg px-3 py-2 text-sm">
            <span aria-hidden>🗓️</span>
            <p className="flex-1 min-w-0">
              <span className="font-medium">{a.evento.titulo}</span>
              {a.evento.aplicaA === 'grado11' && ' (Grado 11)'} — {textoFecha(a.evento)} · {textoCuentaRegresiva(a.dias)}
            </p>
            <button onClick={() => descartar(a.clave)} aria-label="Descartar aviso" className="p-1.5 -m-1 opacity-70 hover:opacity-100"><X size={14} /></button>
          </div>
        ))}
        {alertas.length > 3 && <p className="text-xs text-soft px-1">y {alertas.length - 3} avisos más en Académico → Calendario.</p>}
      </div>
    </div>
  );
}
