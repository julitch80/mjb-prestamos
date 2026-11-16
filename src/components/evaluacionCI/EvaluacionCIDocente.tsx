// Contenido de la pastilla «Evaluación CI» de cada centro de interés: el QR y el enlace de la
// encuesta GENERAL, para que cualquier líder lo comparta (Julián, 2026-11-16).
import { TarjetaEnlace } from './ResultadosEvaluacionCI';

export default function EvaluacionCIDocente() {
  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-line bg-card p-4 space-y-2 text-sm text-soft">
        <p className="font-semibold text-strong">Evaluación de los centros de interés</p>
        <p>
          En esta ocasión la evaluación es <b>general para todos los centros</b>: no es de este centro en
          particular. Es anónima.
        </p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Proyecte el código QR o comparta el enlace con sus estudiantes.</li>
          <li>Cada estudiante elige su grado y responde desde su celular o un computador.</li>
          <li>Preescolar a 2.° responde con caritas: usted puede leerles las preguntas y pasar el dispositivo con «Siguiente niño».</li>
        </ul>
      </div>
      <TarjetaEnlace />
    </div>
  );
}
