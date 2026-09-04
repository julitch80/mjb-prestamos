import { X } from 'lucide-react';
import { getAsignatura } from '../data/asignacionAcademica';
import type { FechaISO, Tarea } from '../data/tareas/tipos';
import { CONFIG_NIVEL, nivelDeGrupo } from '../data/tareas/config';
import { anclasDeGrupo, etiquetaMomento, leerMomentos, leerTachadas, type MomentoElegido } from '../data/tareas/habitos';

const ID_IMPRIMIBLE = 'agenda-imprimible';

/**
 * Vista imprimible ÚNICA de la semana, pensada por Julián para servir a los
 * dos casos con la misma hoja:
 *  - quien YA eligió momento en su teléfono la imprime con casilla y momento
 *    ya escritos (leídos de localStorage);
 *  - quien no tiene teléfono o no eligió nada imprime la casilla vacía y una
 *    LÍNEA EN BLANCO para escribirlo a mano.
 * Así el director de grupo reparte copias en blanco y quien ya decidió
 * imprime la suya llena, sin dos plantillas distintas que mantener.
 *
 * Mismo patrón de impresión que InformeContencion.tsx: overlay position:fixed
 * vuelto position:static en @media print (si no, Chrome recorta a una sola
 * página), y papel siempre blanco/negro aunque el teléfono esté en oscuro.
 */
export default function AgendaImprimible({ grupo, semana, tareasDelDia, onCerrar }: {
  grupo: string;
  semana: FechaISO[];
  tareasDelDia: (f: FechaISO) => { b: { momentos: number }; t: Tarea }[];
  onCerrar: () => void;
}) {
  const nivel = nivelDeGrupo(grupo);
  const config = CONFIG_NIVEL[nivel];
  const anclas = anclasDeGrupo(grupo);

  // Se lee UNA vez al abrir: es exactamente lo que hay guardado en este
  // teléfono ahora mismo, no algo que deba refrescarse mientras se imprime.
  const momentos = leerMomentos();
  const tachadas = leerTachadas();

  const opcionesAncla = anclas.map(a => a.label).join(' / ');

  return (
    <div className="agenda-imp-overlay fixed inset-0 z-50 overflow-auto bg-[#525659] p-4">
      <style>{CSS_AGENDA_IMPRIMIBLE}</style>

      <div className="agenda-imp-solo-pantalla mx-auto mb-4 flex max-w-[210mm] flex-wrap items-center gap-2 rounded-xl bg-surface p-3">
        <h2 className="text-sm font-semibold text-strong">Vista para imprimir — semana de {grupo}</h2>
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

      <div id={ID_IMPRIMIBLE} className="agenda-imp-hoja">
        <div className="agenda-imp-encabezado">
          <h1 className="agenda-imp-titulo">Agenda de {grupo}</h1>
          <p className="agenda-imp-subtitulo">
            Semana del {fechaCorta(semana[0])} al {fechaCorta(semana[semana.length - 1])}
          </p>
        </div>

        <p className="agenda-imp-instruccion">
          Marca la casilla cuando termines la tarea. Si no elegiste un momento en tu teléfono,
          escríbelo en la línea: {opcionesAncla}, u otro.
        </p>

        {semana.map(f => {
          const items = tareasDelDia(f);
          return (
            <table key={f} className="agenda-imp-tabla">
              <thead>
                <tr><th colSpan={3}>{diaLargo(f)}</th></tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr><td colSpan={3} className="agenda-imp-vacio">Sin tareas programadas</td></tr>
                ) : items.map(({ t }, i) => {
                  const tachada = !!tachadas[t.id];
                  const momento: MomentoElegido | undefined = momentos[t.id];
                  const etiqueta = etiquetaMomento(grupo, momento);
                  return (
                    <tr key={i}>
                      <td className="agenda-imp-casilla">
                        <span className={tachada ? 'agenda-imp-check agenda-imp-check-marcado' : 'agenda-imp-check'} />
                      </td>
                      <td className="agenda-imp-tarea">
                        <span className="agenda-imp-asignatura">{getAsignatura(t.asignaturaId)?.nombre ?? t.asignaturaId}</span>
                        {' — '}{t.titulo}
                      </td>
                      <td className="agenda-imp-momento">
                        {etiqueta ? etiqueta : <span className="agenda-imp-linea" />}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          );
        })}

        <p className="agenda-imp-nota">
          Además, todos los días: {config.estudioMin} minutos de estudio personal.
        </p>
      </div>
    </div>
  );
}

function diaLargo(f: FechaISO): string {
  const [y, m, d] = f.split('-').map(Number);
  const fecha = new Date(y, m - 1, d);
  const dias = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  return `${dias[fecha.getDay()]} ${d}/${m}`;
}

function fechaCorta(f: FechaISO): string {
  return `${f.slice(8)}/${f.slice(5, 7)}`;
}

const CSS_AGENDA_IMPRIMIBLE = `
@page { size: letter; margin: 16mm 14mm; }

.agenda-imp-hoja {
  width: 210mm;
  max-width: 100%;
  margin: 0 auto;
  padding: 8mm;
  background: #fff;
  color: #000;
  box-sizing: border-box;
  font-family: Arial, sans-serif;
  font-size: 10.5pt;
}
.agenda-imp-encabezado { text-align: center; margin-bottom: 3mm; }
.agenda-imp-titulo { font-size: 15pt; margin: 0; }
.agenda-imp-subtitulo { font-size: 10pt; margin: 1pt 0 0; color: #444; }
.agenda-imp-instruccion { font-size: 8.5pt; color: #444; margin: 0 0 4mm; }
.agenda-imp-tabla { border-collapse: collapse; width: 100%; margin: 0 0 3mm; break-inside: avoid; page-break-inside: avoid; }
.agenda-imp-tabla th { border: 1px solid #000; background: #eaf1dd; padding: 3pt 6pt; font-size: 10pt; text-align: left; }
.agenda-imp-tabla td { border: 1px solid #000; padding: 4pt 6pt; font-size: 9.5pt; vertical-align: middle; }
.agenda-imp-casilla { width: 8mm; text-align: center; }
.agenda-imp-momento { width: 48mm; }
.agenda-imp-asignatura { font-weight: bold; }
.agenda-imp-vacio { color: #666; font-style: italic; }
.agenda-imp-check {
  display: inline-block; width: 4mm; height: 4mm; border: 1px solid #000;
}
.agenda-imp-check-marcado {
  background: #000;
}
.agenda-imp-linea {
  display: inline-block; width: 100%; border-bottom: 1px solid #000; height: 4mm;
}
.agenda-imp-nota { font-size: 9pt; color: #555; margin-top: 4mm; }

@media print {
  /* Mismo motivo que InformeContencion.tsx: sin esto Chrome recorta la
     impresión del overlay fijo a una sola página, y una semana con varias
     tareas no cabe en una. */
  .agenda-imp-overlay {
    position: static !important;
    overflow: visible !important;
    padding: 0 !important;
    background: #fff !important;
  }
  body * { visibility: hidden !important; }
  #${ID_IMPRIMIBLE}, #${ID_IMPRIMIBLE} * { visibility: visible !important; }
  .agenda-imp-solo-pantalla, .agenda-imp-solo-pantalla * { display: none !important; }
  .agenda-imp-hoja { width: auto; margin: 0; padding: 0; }
}
`;
