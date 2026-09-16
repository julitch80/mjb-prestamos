import { getAsignatura } from '../data/asignacionAcademica';
import type { FechaISO, Tarea } from '../data/tareas/tipos';
import { CONFIG_NIVEL, nivelDeGrupo } from '../data/tareas/config';
import { anclasDeGrupo, etiquetaMomento, leerMomentos, leerTachadas, type MomentoElegido } from '../data/tareas/habitos';
import DocumentoInstitucional from './DocumentoInstitucional';

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
 * Usa la PLANTILLA INSTITUCIONAL (DocumentoInstitucional.tsx): el membrete,
 * el overlay, los botones y el @media print son de ahí. Aquí solo quedan las
 * clases propias de la tabla semanal (casilla, momento, línea en blanco).
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
    <DocumentoInstitucional
      titulo={`Agenda de ${grupo}`}
      subtitulo={`Semana del ${fechaCorta(semana[0])} al ${fechaCorta(semana[semana.length - 1])}`}
      onCerrar={onCerrar}
    >
      <style>{CSS_AGENDA_IMPRIMIBLE}</style>

      <p className="agenda-imp-instruccion">
        Marca la casilla cuando termines la tarea. Si no elegiste un momento en tu teléfono,
        escríbelo en la línea: {opcionesAncla}, u otro.
      </p>

      {semana.map(f => {
        const items = tareasDelDia(f);
        return (
          <table key={f} className="doc-inst-tabla agenda-imp-tabla">
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
    </DocumentoInstitucional>
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

// Solo lo que la plantilla institucional NO trae: el formato propio de la
// tabla semanal (casilla, momento, línea en blanco). El overlay, el @page,
// el membrete y el @media print ya los aporta DocumentoInstitucional.
const CSS_AGENDA_IMPRIMIBLE = `
.agenda-imp-instruccion { font-size: 8.5pt; color: #444; margin: 0 0 4mm; }
.agenda-imp-tabla { margin: 0 0 3mm; break-inside: avoid; page-break-inside: avoid; }
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
`;
