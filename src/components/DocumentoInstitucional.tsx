// Plantilla institucional para TODO lo que la aplicación saque en papel o PDF
// (Julián, 16-09-2026). Reproduce el membrete del colegio —el mismo de los
// documentos oficiales, extraído de «política de tareas 2026»—: escudo y datos
// arriba, marca de agua al centro y la franja de contacto abajo.
//
// CÓMO SE USA desde cualquier pantalla:
//
//   const [imprimiendo, setImprimiendo] = useState(false);
//   ...
//   {imprimiendo && (
//     <DocumentoInstitucional
//       titulo="Acompañamientos de descanso"
//       subtitulo="Jornada Mañana · Rige desde el martes 15 de septiembre"
//       pie="Publicada por Janneth Ocampo"
//       onCerrar={() => setImprimiendo(false)}
//     >
//       <table>…</table>
//     </DocumentoInstitucional>
//   )}
//
// Lo que hay dentro se imprime tal cual: usa tablas y párrafos normales, en
// negro sobre blanco. Las clases `.doc-inst-tabla` y `.doc-inst-parrafo` dan el
// formato de los documentos del colegio, pero puedes traer tu propio HTML.
//
// EL MEMBRETE ES UNA IMAGEN DE FONDO (public/membrete-mjb.jpg). Para que el
// navegador la imprima hay que pedirlo explícitamente con print-color-adjust:
// exact; sin eso Chrome imprime la hoja en blanco «para ahorrar tinta».
//
// Patrón de impresión igual al de AgendaImprimible.tsx: el overlay fijo pasa a
// estático en @media print (si no, Chrome recorta a una sola página) y solo el
// contenido del documento queda visible.

import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

const ID_DOCUMENTO = 'documento-institucional';

interface Props {
  titulo: string;
  subtitulo?: string;
  /** Línea final, a la izquierda del «Impreso el …». */
  pie?: string;
  /** Vertical por defecto; horizontal para tablas anchas (sin membrete de fondo). */
  orientacion?: 'vertical' | 'horizontal';
  children: ReactNode;
  onCerrar: () => void;
}

export function fechaHoyLegible(): string {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

export default function DocumentoInstitucional({
  titulo,
  subtitulo,
  pie,
  orientacion = 'vertical',
  children,
  onCerrar,
}: Props) {
  const horizontal = orientacion === 'horizontal';

  // Se monta directo en <body> con un portal. Dentro de la aplicación, cada sección
  // vive en un motion.div de la transición entre vistas (App.tsx) que deja un
  // `transform` puesto; un `position: fixed` bajo un ancestro con transform deja
  // de cubrir la pantalla y queda atrapado en esa caja. Así pasó el 16-09-2026:
  // la proyección de la agenda no se veía desde Tareas; aquí pasaría lo mismo.
  return createPortal(
    <div className="doc-inst-overlay fixed inset-0 z-50 overflow-auto bg-[#525659] p-4">
      <style>{css(horizontal)}</style>

      <div className="doc-inst-solo-pantalla mx-auto mb-4 flex max-w-[210mm] flex-wrap items-center gap-2 rounded-xl bg-surface p-3">
        <h2 className="text-sm font-semibold text-strong">Vista para imprimir — {titulo}</h2>
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

      <div id={ID_DOCUMENTO} className={horizontal ? 'doc-inst-hoja doc-inst-hoja-h' : 'doc-inst-hoja'}>
        <div className="doc-inst-encabezado">
          <h1 className="doc-inst-titulo">{titulo}</h1>
          {subtitulo && <p className="doc-inst-subtitulo">{subtitulo}</p>}
        </div>

        <div className="doc-inst-cuerpo">{children}</div>

        <p className="doc-inst-pie">
          {pie ? `${pie} · ` : ''}Impreso el {fechaHoyLegible()}
        </p>
      </div>
    </div>,
    document.body,
  );
}

function css(horizontal: boolean): string {
  return `
@page { size: A4 ${horizontal ? 'landscape' : 'portrait'}; margin: 0; }

.doc-inst-hoja {
  width: 210mm;
  min-height: 297mm;
  max-width: 100%;
  margin: 0 auto;
  box-sizing: border-box;
  background: #fff url('${import.meta.env.BASE_URL}membrete-mjb.jpg') no-repeat center / 100% 100%;
  color: #000;
  font-family: Arial, Helvetica, sans-serif;
  /* El membrete ocupa arriba y abajo de la hoja: el contenido vive en el medio. */
  padding: 42mm 20mm 46mm;
  display: flex;
  flex-direction: column;
}
/* Apaisada: la imagen es vertical, así que ahí va sin fondo y con el texto del
   colegio en el encabezado (una tabla de la semana no cabe en vertical). */
.doc-inst-hoja-h {
  width: 297mm;
  min-height: 210mm;
  background-image: none;
  padding: 14mm 14mm 12mm;
}
.doc-inst-encabezado { text-align: center; margin-bottom: 6mm; }
.doc-inst-hoja-h .doc-inst-encabezado::before {
  content: 'INSTITUCIÓN EDUCATIVA MANUEL J. BETANCUR';
  display: block;
  font-weight: bold;
  font-size: 13pt;
  letter-spacing: .02em;
  border-bottom: 2px solid #9d1c20;
  padding-bottom: 2mm;
  margin-bottom: 3mm;
}
.doc-inst-titulo { font-size: 15pt; margin: 0; color: #111; text-transform: uppercase; letter-spacing: .01em; }
.doc-inst-subtitulo { font-size: 11pt; margin: 2pt 0 0; color: #444; }
.doc-inst-cuerpo { flex: 1; font-size: 11pt; line-height: 1.45; }
.doc-inst-pie { font-size: 8.5pt; color: #555; margin: 6mm 0 0; text-align: right; }

/* Piezas listas para el contenido, con el aire de los documentos del colegio. */
.doc-inst-tabla { border-collapse: collapse; width: 100%; table-layout: fixed; }
.doc-inst-tabla th, .doc-inst-tabla td {
  border: 1px solid #333;
  padding: 4pt 6pt;
  font-size: 10.5pt;
  text-align: center;
  vertical-align: middle;
}
.doc-inst-tabla thead th { background: #eaf1dd; font-weight: bold; }
.doc-inst-tabla .doc-inst-col-titulo { text-align: left; font-weight: bold; background: #f7f7f2; }
.doc-inst-parrafo { margin: 0 0 3mm; text-align: justify; }

@media print {
  .doc-inst-overlay {
    position: static !important;
    overflow: visible !important;
    padding: 0 !important;
    background: #fff !important;
  }
  /* El documento vive en un portal, fuera de #root: la aplicación se saca del
     flujo para que no deje páginas en blanco antes del documento. */
  body > #root { display: none !important; }
  body * { visibility: hidden !important; }
  #${ID_DOCUMENTO}, #${ID_DOCUMENTO} * { visibility: visible !important; }
  .doc-inst-solo-pantalla, .doc-inst-solo-pantalla * { display: none !important; }
  .doc-inst-hoja {
    width: auto;
    margin: 0;
    /* Sin esto el navegador no imprime el membrete: lo trata como decoración. */
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }
}
`;
}
