// Vista imprimible de una publicación de acompañamientos (tarea B): una hoja
// A4 apaisada, colores claros sin importar el tema, con la matriz Zona × Días
// completa para pegar en cartelera o repartir en papel. Mismo patrón de
// impresión que AgendaImprimible.tsx / VistaImprimibleHistorial en
// HistorialCaso.tsx: overlay position:fixed vuelto position:static en
// @media print (si no, Chrome recorta la impresión a una sola página), y
// solo el contenido con ID_IMPRIMIBLE queda visible al imprimir.

import { X } from 'lucide-react';
import { USUARIOS } from '../../data/maestros';
import type { Distribucion, JornadaAcomp } from '../../data/acompanamientos/tipos';
import { DIAS } from '../../data/acompanamientos/tipos';
import { fechaLegibleAcomp } from '../../data/acompanamientos/textos';

const ID_IMPRIMIBLE = 'acompanamientos-imp';

const DIA_LABEL: Record<string, string> = {
  lunes: 'Lunes', martes: 'Martes', miercoles: 'Miércoles', jueves: 'Jueves', viernes: 'Viernes',
};

interface Props {
  jornada: JornadaAcomp;
  distribucion: Distribucion;
  vigenteDesde: string;
  publicadoPorNombre: string;
  onCerrar: () => void;
}

function fechaHoyLegible(): string {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

export default function AcompanamientosImprimible({ jornada, distribucion, vigenteDesde, publicadoPorNombre, onCerrar }: Props) {
  const nombreCorto = (docenteId: string) => USUARIOS.find((u) => u.id === docenteId)?.nombreCorto ?? docenteId;

  return (
    <div className="acomp-imp-overlay fixed inset-0 z-50 overflow-auto bg-[#525659] p-4">
      <style>{CSS_ACOMPANAMIENTOS_IMPRIMIBLE}</style>

      <div className="acomp-imp-solo-pantalla mx-auto mb-4 flex max-w-[297mm] flex-wrap items-center gap-2 rounded-xl bg-surface p-3">
        <h2 className="text-sm font-semibold text-strong">Vista para imprimir — Acompañamientos</h2>
        <span className="grow" />
        <button
          onClick={() => window.print()}
          className="flex min-h-[36px] items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-accent-fg"
        >
          Imprimir / Guardar PDF
        </button>
        <button
          onClick={onCerrar}
          className="flex min-h-[36px] items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-sm text-strong"
        >
          <X size={14} /> Cerrar
        </button>
      </div>

      <div id={ID_IMPRIMIBLE} className="acomp-imp-hoja">
        <div className="acomp-imp-encabezado">
          <h1 className="acomp-imp-titulo">I.E. Manuel J. Betancur — Acompañamientos de descanso</h1>
          <p className="acomp-imp-subtitulo">
            Jornada {jornada === 'manana' ? 'Mañana' : 'Tarde'} · Rige desde el {fechaLegibleAcomp(vigenteDesde)}
          </p>
        </div>

        <table className="acomp-imp-tabla">
          <thead>
            <tr>
              <th className="acomp-imp-th-zona">Zona</th>
              {DIAS.map((dia) => (
                <th key={dia}>{DIA_LABEL[dia]}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {distribucion.zonas.map((zona) => (
              <tr key={zona.id}>
                <td className="acomp-imp-td-zona">{zona.nombre}</td>
                {DIAS.map((dia) => {
                  const asignados = distribucion.asignaciones.filter((a) => a.zonaId === zona.id && a.dia === dia);
                  return (
                    <td key={dia}>
                      {asignados.length === 0 ? (
                        <span className="acomp-imp-vacio">—</span>
                      ) : (
                        asignados.map((a) => nombreCorto(a.docenteId)).join(', ')
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>

        <p className="acomp-imp-pie">
          Publicada por {publicadoPorNombre || 'la distribución inicial'} · Impreso el {fechaHoyLegible()}
        </p>
      </div>
    </div>
  );
}

const CSS_ACOMPANAMIENTOS_IMPRIMIBLE = `
@page { size: A4 landscape; margin: 14mm; }

.acomp-imp-hoja {
  width: 297mm;
  max-width: 100%;
  margin: 0 auto;
  padding: 8mm;
  background: #fff;
  color: #000;
  box-sizing: border-box;
  font-family: Arial, sans-serif;
}
.acomp-imp-encabezado { text-align: center; margin-bottom: 5mm; }
.acomp-imp-titulo { font-size: 16pt; margin: 0; color: #111; }
.acomp-imp-subtitulo { font-size: 11pt; margin: 2pt 0 0; color: #444; }
.acomp-imp-tabla { border-collapse: collapse; width: 100%; table-layout: fixed; }
.acomp-imp-tabla th, .acomp-imp-tabla td {
  border: 1px solid #333;
  padding: 5pt 6pt;
  font-size: 10.5pt;
  text-align: center;
  vertical-align: middle;
}
.acomp-imp-tabla thead th {
  background: #eaf1dd;
  font-weight: bold;
}
.acomp-imp-th-zona, .acomp-imp-td-zona {
  text-align: left;
  font-weight: bold;
  width: 20%;
  background: #f7f7f2;
}
.acomp-imp-vacio { color: #999; }
.acomp-imp-pie { font-size: 9pt; color: #555; margin-top: 6mm; text-align: right; }

@media print {
  .acomp-imp-overlay {
    position: static !important;
    overflow: visible !important;
    padding: 0 !important;
    background: #fff !important;
  }
  body * { visibility: hidden !important; }
  #${ID_IMPRIMIBLE}, #${ID_IMPRIMIBLE} * { visibility: visible !important; }
  .acomp-imp-solo-pantalla, .acomp-imp-solo-pantalla * { display: none !important; }
  .acomp-imp-hoja { width: auto; margin: 0; padding: 0; }
}
`;
