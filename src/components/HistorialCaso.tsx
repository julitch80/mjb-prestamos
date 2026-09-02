// Historial imprimible de un caso (contención o remisión al seguro): a
// diferencia del informe puntual (InformeContencion.tsx), aquí puede haber
// VARIAS páginas porque un caso puede acumular muchos seguimientos. Reutiliza
// el mismo patrón de overlay + window.print() — no una librería de PDF — y
// el mismo arreglo de `position: static` en @media print, que es lo que
// evita que Chrome recorte la impresión a una sola hoja cuando el contenido
// no cabe en el viewport del overlay con scroll propio.
import { DIRECTORES_MANANA, DIRECTORES_TARDE, getUsuario } from '../data/maestros';
import type { SeguimientoCaso } from '../data/api';

const ESCUDO = `${import.meta.env.BASE_URL}mjb_escudo.png`;
const ID_HISTORIAL_IMPRIMIBLE = 'historial-caso-imprimible';

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
 * Vista imprimible del historial: overlay fijo + `window.print()`, igual
 * técnica que `VistaImprimibleInforme` en InformeContencion.tsx (ver ese
 * archivo para la explicación de `visibility: hidden` en toda la app menos
 * el historial). La diferencia real está en el CSS de impresión: aquí SÍ
 * puede haber varias páginas.
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
    <div className="historial-overlay fixed inset-0 z-50 overflow-auto bg-[#525659] p-4">
      <style>{CSS_HISTORIAL_IMPRIMIBLE}</style>

      <div className="historial-solo-pantalla mx-auto mb-4 flex max-w-[210mm] flex-wrap items-center gap-2 rounded-xl bg-surface p-3">
        <h2 className="text-sm font-semibold text-strong">Vista previa del historial (PDF)</h2>
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
          Cerrar
        </button>
      </div>

      <div id={ID_HISTORIAL_IMPRIMIBLE} className="historial-hoja">
        <div className="historial-encabezado">
          <img src={ESCUDO} alt="" className="historial-escudo" />
          <div>
            <h1 className="historial-titulo">Institución Educativa Manuel J. Betancur</h1>
            <h2 className="historial-subtitulo">HISTORIAL DE ATENCIÓN</h2>
          </div>
        </div>

        <table className="historial-tabla">
          <tbody>
            <tr><td className="historial-etiqueta">Nombres y apellidos del estudiante</td><td>{datos.estudianteNombre}</td></tr>
            <tr><td className="historial-etiqueta">Documento de identidad</td><td>{datos.estudianteDocumento || 'Sin registrar'}</td></tr>
            <tr><td className="historial-etiqueta">Grado / Grupo</td><td>{datos.grado}</td></tr>
            <tr><td className="historial-etiqueta">Director de grupo</td><td>{directorDeGrupo(datos.grado) || '—'}</td></tr>
            <tr><td className="historial-etiqueta">Acudiente</td><td>{datos.acudienteNombre || 'Sin registrar'}</td></tr>
            <tr><td className="historial-etiqueta">Teléfono del acudiente</td><td>{datos.acudienteTelefonos || 'Sin registrar'}</td></tr>
            <tr><td className="historial-etiqueta">Fecha de generación del documento</td><td>{hoy}</td></tr>
          </tbody>
        </table>

        {/* Resumen arriba: es lo primero que necesita ver quien recibe el
            documento (comisión, entidad externa) antes de leer atención por
            atención — cuántas veces se ha atendido y el estado actual. */}
        <table className="historial-tabla historial-tabla-bloque">
          <thead><tr><th colSpan={2}>RESUMEN DEL CASO</th></tr></thead>
          <tbody>
            <tr><td className="historial-etiqueta">Caso abierto desde</td><td>{datos.fechaCreacion}</td></tr>
            <tr><td className="historial-etiqueta">Atenciones registradas</td><td>{ordenados.length}</td></tr>
            {ordenados.length > 0 && (
              <tr><td className="historial-etiqueta">Primera / última atención</td><td>{primera} — {ultima}</td></tr>
            )}
            <tr><td className="historial-etiqueta">Estado actual</td><td>{LABEL_ESTADO[datos.estado]}</td></tr>
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
      </div>
    </div>
  );
}

/**
 * Igual criterio que InformeContencion.tsx: colores literales, no tokens del
 * tema. El papel siempre es blanco con texto negro sin importar si el
 * docente tenía el modo oscuro activado al imprimir.
 */
const CSS_HISTORIAL_IMPRIMIBLE = `
@page { size: letter; margin: 18mm 16mm; }

.historial-hoja {
  width: 210mm;
  max-width: 100%;
  margin: 0 auto;
  padding: 10mm;
  background: #fff;
  color: #000;
  box-sizing: border-box;
  font-family: Arial, sans-serif;
  font-size: 11pt;
}
.historial-encabezado { display: flex; align-items: center; gap: 4mm; justify-content: center; text-align: center; margin-bottom: 6mm; }
.historial-escudo { width: 18mm; height: 18mm; object-fit: contain; }
.historial-titulo { font-size: 14pt; margin: 0; }
.historial-subtitulo { font-size: 11pt; margin: 2pt 0 0; color: #444; }
.historial-tabla { border-collapse: collapse; width: 100%; margin: 0 0 4mm; break-inside: avoid; page-break-inside: avoid; }
.historial-tabla td, .historial-tabla th { border: 1px solid #000; padding: 5pt 8pt; font-size: 10pt; vertical-align: top; text-align: left; }
.historial-tabla th { background: #eaf1dd; }
.historial-etiqueta { font-weight: bold; background: #eaf1dd; width: 38%; }
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

@media print {
  /* Mismo arreglo que InformeContencion.tsx y por la misma razón: el overlay
     cuelga de position:fixed con scroll propio, y Chrome recorta a UNA SOLA
     PAGINA lo que hay dentro de un position:fixed al imprimir. Aqui es
     imprescindible (a diferencia del informe puntual) porque un historial
     con varias atenciones ocupa varias hojas — sin esto se perderia todo
     menos la primera pagina, justo el dia que hay que presentar el caso. */
  .historial-overlay {
    position: static !important;
    overflow: visible !important;
    padding: 0 !important;
    background: #fff !important;
  }
  body * { visibility: hidden !important; }
  #${ID_HISTORIAL_IMPRIMIBLE}, #${ID_HISTORIAL_IMPRIMIBLE} * { visibility: visible !important; }
  .historial-solo-pantalla, .historial-solo-pantalla * { display: none !important; }
  .historial-hoja { width: auto; margin: 0; padding: 0; }
}
`;
