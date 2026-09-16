// Historial imprimible de un caso (contención o remisión al seguro): a
// diferencia del informe puntual (InformeContencion.tsx), aquí puede haber
// VARIAS páginas porque un caso puede acumular muchos seguimientos. Usa la
// PLANTILLA INSTITUCIONAL (DocumentoInstitucional.tsx): el membrete (que ya
// trae el escudo), el overlay, los botones y el @media print son de ahí.
import DocumentoInstitucional from './DocumentoInstitucional';
import { DIRECTORES_MANANA, DIRECTORES_TARDE, getUsuario } from '../data/maestros';
import type { SeguimientoCaso } from '../data/api';

export interface DatosHistorialCaso {
  estudianteNombre: string;
  estudianteDocumento: string;
  grado: string;
  acudienteNombre: string;
  acudienteTelefonos: string;
  tipo: 'contencion' | 'seguro';
  estado: 'abierto' | 'en_seguimiento' | 'cerrado';
  fechaCreacion: string;
  seguimientos: SeguimientoCaso[];
}

const LABEL_ESTADO: Record<DatosHistorialCaso['estado'], string> = {
  abierto: 'Abierto',
  en_seguimiento: 'En seguimiento',
  cerrado: 'Cerrado',
};

function directorDeGrupo(grado: string): string {
  const id = DIRECTORES_MANANA[grado] ?? DIRECTORES_TARDE[grado];
  return id ? (getUsuario(id)?.nombre ?? id) : '';
}

/**
 * Vista imprimible del historial dentro de la plantilla institucional.
 * Puede haber varias páginas: el flujo normal del documento (sin overlay
 * fijo propio) las pagina bien, y cada bloque de atención lleva
 * `break-inside: avoid` para no partirse a la mitad.
 */
export function VistaImprimibleHistorial({ datos, onCerrar }: {
  datos: DatosHistorialCaso;
  onCerrar: () => void;
}) {
  // Del más antiguo al más reciente: así se lee una historia, no un feed.
  const ordenados = [...datos.seguimientos].sort((a, b) => a.fecha.localeCompare(b.fecha));
  const primera = ordenados[0]?.fecha;
  const ultima = ordenados[ordenados.length - 1]?.fecha;
  const hoy = new Date().toISOString().slice(0, 10);

  return (
    <DocumentoInstitucional titulo="Historial de atención" subtitulo={`Caso de ${datos.estudianteNombre}`} onCerrar={onCerrar}>
      <style>{CSS_HISTORIAL_IMPRIMIBLE}</style>

      <table className="doc-inst-tabla">
        <tbody>
          <tr><td className="doc-inst-col-titulo">Nombres y apellidos del estudiante</td><td>{datos.estudianteNombre}</td></tr>
          <tr><td className="doc-inst-col-titulo">Documento de identidad</td><td>{datos.estudianteDocumento || 'Sin registrar'}</td></tr>
          <tr><td className="doc-inst-col-titulo">Grado / Grupo</td><td>{datos.grado}</td></tr>
          <tr><td className="doc-inst-col-titulo">Director de grupo</td><td>{directorDeGrupo(datos.grado) || '—'}</td></tr>
          <tr><td className="doc-inst-col-titulo">Acudiente</td><td>{datos.acudienteNombre || 'Sin registrar'}</td></tr>
          <tr><td className="doc-inst-col-titulo">Teléfono del acudiente</td><td>{datos.acudienteTelefonos || 'Sin registrar'}</td></tr>
          <tr><td className="doc-inst-col-titulo">Fecha de generación del documento</td><td>{hoy}</td></tr>
        </tbody>
      </table>

      {/* Resumen arriba: es lo primero que necesita ver quien recibe el
          documento (comisión, entidad externa) antes de leer atención por
          atención — cuántas veces se ha atendido y el estado actual. */}
      <table className="doc-inst-tabla historial-tabla-bloque">
        <thead><tr><th colSpan={2}>RESUMEN DEL CASO</th></tr></thead>
        <tbody>
          <tr><td className="doc-inst-col-titulo">Caso abierto desde</td><td>{datos.fechaCreacion}</td></tr>
          <tr><td className="doc-inst-col-titulo">Atenciones registradas</td><td>{ordenados.length}</td></tr>
          {ordenados.length > 0 && (
            <tr><td className="doc-inst-col-titulo">Primera / última atención</td><td>{primera} — {ultima}</td></tr>
          )}
          <tr><td className="doc-inst-col-titulo">Estado actual</td><td>{LABEL_ESTADO[datos.estado]}</td></tr>
        </tbody>
      </table>

      <h3 className="historial-seccion">REGISTRO CRONOLÓGICO DE ATENCIONES</h3>

      {ordenados.length === 0 ? (
        <p className="historial-vacio">
          Este caso no registra atenciones de seguimiento adicionales a su apertura.
        </p>
      ) : (
        ordenados.map((s, i) => (
          <div key={s.id} className="historial-atencion">
            <div className="historial-atencion-cabecera">
              <span>Atención {i + 1} de {ordenados.length}</span>
              <span>{s.fecha}</span>
            </div>
            <p className="historial-atencion-autor">Registrado por: {s.autorNombre}</p>
            <p className="historial-atencion-texto">{s.texto}</p>
            {s.decision === 'cerrar' ? (
              <p className="historial-atencion-decision historial-decision-cierre">Se cerró el caso en esta atención.</p>
            ) : (
              <p className="historial-atencion-decision">
                Se programó próximo seguimiento para el {s.proximaFecha || 'sin fecha registrada'}.
              </p>
            )}
          </div>
        ))
      )}

      <p className="historial-nota">
        Documento generado por el sistema institucional a partir de los seguimientos registrados para este caso.
      </p>

      <div className="historial-firma">
        <div className="historial-firma-linea">Firma de quien presenta el caso</div>
      </div>
    </DocumentoInstitucional>
  );
}

// Solo lo que la plantilla institucional no trae: los bloques propios del
// historial (resumen, atenciones cronológicas, firma). Tabla, overlay,
// membrete, @page y @media print ya los aporta DocumentoInstitucional.
const CSS_HISTORIAL_IMPRIMIBLE = `
.historial-tabla-bloque { break-inside: avoid; page-break-inside: avoid; }
.historial-seccion { font-size: 11pt; margin: 6mm 0 3mm; border-bottom: 1px solid #000; padding-bottom: 2pt; }
.historial-vacio { font-size: 10pt; color: #555; font-style: italic; }

/* Cada atención es un bloque que NO debe partirse entre dos hojas — si el
   texto es largo, el bloque completo fluye a la página siguiente en vez de
   cortarse a la mitad. Cuando el bloque es más largo que una página entera
   el navegador ya no puede evitar el corte, pero eso es un caso extremo que
   no aplica a una nota de seguimiento normal. */
.historial-atencion { border: 1px solid #000; border-radius: 2pt; padding: 5pt 8pt; margin: 0 0 4mm; break-inside: avoid; page-break-inside: avoid; }
.historial-atencion-cabecera { display: flex; justify-content: space-between; font-size: 9pt; font-weight: bold; color: #444; margin-bottom: 2pt; }
.historial-atencion-autor { font-size: 9pt; color: #444; margin: 0 0 2pt; }
.historial-atencion-texto { font-size: 10pt; white-space: pre-wrap; margin: 0 0 3pt; }
.historial-atencion-decision { font-size: 9pt; font-weight: bold; margin: 0; }
.historial-decision-cierre { color: #7a1f1f; }
.historial-nota { font-size: 9pt; color: #555; margin-top: 6mm; }
.historial-firma { margin-top: 16mm; break-inside: avoid; page-break-inside: avoid; }
.historial-firma-linea { border-top: 1px solid #000; width: 70mm; margin-top: 12mm; padding-top: 3pt; font-size: 10pt; }
`;
