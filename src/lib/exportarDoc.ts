// Exporta un informe como archivo .doc descargable, abrible en Word o subible
// a Google Docs. Truco deliberado: un .doc no tiene que ser el formato binario
// OOXML — Word y Google Docs abren perfectamente HTML guardado con extensión
// .doc (es el mismo mecanismo detrás de "Guardar como página web" de Word
// viejo). Evita cargar una librería de generación de .docx en el navegador
// solo para esto.

// Escudo institucional embebido como data URI (no una URL externa): así el
// .doc se ve igual si se abre sin internet o años después de que cambie el
// hosting. Se reutiliza el mismo archivo que ya usa el login — sin
// reprocesar nada, ya viene con el fondo transparente resuelto.
let escudoBase64Cache: string | null = null;
async function escudoBase64(): Promise<string> {
  if (escudoBase64Cache) return escudoBase64Cache;
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}mjb_escudo.png`);
    const blob = await res.blob();
    escudoBase64Cache = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
    return escudoBase64Cache;
  } catch {
    return '';
  }
}

function documentoHtml(tituloDoc: string, cuerpoHtml: string): string {
  return `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head>
<meta charset="utf-8">
<title>${tituloDoc}</title>
<!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View></w:WordDocument></xml><![endif]-->
<style>
  body { font-family: Arial, sans-serif; font-size: 11pt; color: #000; }
  h1 { font-size: 14pt; text-align: center; margin-bottom: 2pt; }
  h2 { font-size: 11pt; text-align: center; margin-top: 0; color: #444; }
  table { border-collapse: collapse; width: 100%; margin: 10pt 0; }
  td, th { border: 1px solid #000; padding: 5pt 8pt; font-size: 10pt; vertical-align: top; }
  th { background: #eaf1dd; text-align: left; }
  .etiqueta { font-weight: bold; background: #eaf1dd; width: 32%; }
  .firma { margin-top: 40pt; }
  .firma-linea { border-top: 1px solid #000; width: 260pt; margin-top: 30pt; padding-top: 4pt; font-size: 10pt; }
</style>
</head>
<body>
${cuerpoHtml}
</body>
</html>`;
}

function descargar(nombreArchivo: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombreArchivo;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // OJO: revocar la URL aquí mismo, de forma síncrona, es una condición de
  // carrera real (no una fuga que "limpiar"). En escritorio el navegador ya
  // leyó el blob antes de que el hilo de JS termine, pero en Android el
  // gestor de descargas recibe el intent y lee la blob: URL de forma
  // asíncrona — si la revocamos ya, a veces todavía no la leyó, y sale
  // "descarga con error". Se le da margen con un setTimeout antes de
  // revocar. No se puede detectar de forma fiable cuándo terminó de leerla
  // (no hay evento para eso), así que el margen es una estimación generosa,
  // no una garantía matemática.
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

export interface DatosInformeContencion {
  estudianteNombre: string;
  estudianteDocumento: string;
  grado: string;
  director: string;
  acudienteNombre: string;
  acudienteParentesco: string;
  acudienteTelefonos: string;
  docenteNombre: string;
  fecha: string;
  descripcion: string;
  rutaDetalle: string;
}

export const RUTA_LABEL: Record<string, string> = {
  psicoorientador: 'Atención por psicoorientador del colegio',
  uai: 'Remisión a la UAI (Unidad de Atención Integral)',
  medellin_me_cuida: 'Remisión a Medellín Te Quiere Saludable',
  directo: 'Se atendió directamente, sin remisión',
  linea_naranja: 'Se atendió con Línea Naranja',
  linea_dorada: 'Se atendió con Línea Dorada u otra línea de emergencia externa',
  externa: 'Se orienta a ayuda externa al colegio',
  sin_seleccionar: 'Sin especificar',
};

// Separado de exportarInformeContencion() para que el mismo .doc se pueda
// tanto descargar (<a download>) como adjuntar al menú nativo de compartir
// de Android (navigator.share con `files`), que necesita el Blob/File en
// mano en vez de un link.
async function construirArchivoInforme(datos: DatosInformeContencion): Promise<{ blob: Blob; nombreArchivo: string }> {
  const rutaTexto = RUTA_LABEL[datos.rutaDetalle] ?? datos.rutaDetalle;
  const escudo = await escudoBase64();
  const cuerpo = `
    ${escudo ? `<div style="text-align:center;"><img src="${escudo}" alt="Escudo MJB" width="70" height="70"></div>` : ''}
    <h1>Institución Educativa Manuel J. Betancur</h1>
    <h2>INFORME DE CONTENCIÓN EMOCIONAL</h2>
    <table>
      <tr><td class="etiqueta">Nombres y apellidos del estudiante</td><td>${datos.estudianteNombre}</td></tr>
      <tr><td class="etiqueta">Documento de identidad</td><td>${datos.estudianteDocumento || 'Sin registrar'}</td></tr>
      <tr><td class="etiqueta">Grado / Grupo</td><td>${datos.grado}</td></tr>
      <tr><td class="etiqueta">Director de grupo</td><td>${datos.director || '—'}</td></tr>
      <tr><td class="etiqueta">Acudiente</td><td>${datos.acudienteNombre || 'Sin registrar'}${datos.acudienteParentesco ? ` (${datos.acudienteParentesco})` : ''}</td></tr>
      <tr><td class="etiqueta">Teléfono del acudiente</td><td>${datos.acudienteTelefonos || 'Sin registrar'}</td></tr>
      <tr><td class="etiqueta">Fecha de generación del informe</td><td>${datos.fecha}</td></tr>
      <tr><td class="etiqueta">Docente que genera el informe</td><td>${datos.docenteNombre}</td></tr>
    </table>
    <table>
      <tr><th colspan="2">DESCRIPCIÓN DEL INFORME</th></tr>
      <tr><td colspan="2">${datos.descripcion.replace(/\n/g, '<br>')}</td></tr>
    </table>
    <table>
      <tr><th colspan="2">RUTA DE ATENCIÓN</th></tr>
      <tr><td colspan="2">${rutaTexto}</td></tr>
    </table>
    <p style="font-size:9pt; color:#555;">
      Este informe fue registrado automáticamente por el sistema y notificado a coordinación y psicoorientación.
    </p>
    <div class="firma">
      <div class="firma-linea">Firma del docente</div>
    </div>
  `;
  const html = documentoHtml('Informe de contención emocional', cuerpo);
  const nombreLimpio = datos.estudianteNombre.replace(/[^\w\s]/g, '').trim().replace(/\s+/g, '_');
  const nombreArchivo = `Informe_contencion_${nombreLimpio}_${datos.fecha}.doc`;
  const blob = new Blob(['﻿', html], { type: 'application/msword' });
  return { blob, nombreArchivo };
}

export async function exportarInformeContencion(datos: DatosInformeContencion) {
  const { blob, nombreArchivo } = await construirArchivoInforme(datos);
  descargar(nombreArchivo, blob);
}

/**
 * Comparte el .doc por el menú nativo de Android (WhatsApp, Drive, correo…)
 * cuando el navegador lo soporta (`navigator.canShare` con `files`). Si no,
 * el llamador debe caer de vuelta a exportarInformeContencion(). No se
 * intenta compartir el PDF aquí: el PDF lo genera el propio diálogo de
 * impresión del sistema operativo, y JS no tiene forma de leer ese archivo
 * de vuelta para adjuntarlo.
 */
export async function compartirInformeContencion(datos: DatosInformeContencion): Promise<boolean> {
  if (!navigator.share) return false;
  const { blob, nombreArchivo } = await construirArchivoInforme(datos);
  const archivo = new File([blob], nombreArchivo, { type: 'application/msword' });
  if (!navigator.canShare?.({ files: [archivo] })) return false;
  try {
    await navigator.share({ files: [archivo], title: 'Informe de contención emocional' });
    return true;
  } catch (e) {
    // AbortError = el usuario cerró el panel de compartir sin elegir nada;
    // no es un fallo real, no hay que caer a la descarga por esto.
    if (e instanceof Error && e.name === 'AbortError') return true;
    return false;
  }
}
