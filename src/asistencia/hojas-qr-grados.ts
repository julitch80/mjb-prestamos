/**
 * Hojas de QR para recortar y pegar en la tarjeta de invitacion (Julian, 2026-11-24).
 *
 * Carta, 4 columnas x 6 filas = 24 recuadros por hoja. QR de 2,5 x 2,5 cm con el nombre
 * y el grupo debajo, y lineas de corte punteadas. El QR solo lleva el codigo (sin URL):
 * asi tiene pocos modulos y se lee bien a ese tamano. Lleva un margen blanco de 2 modulos dentro de los 2,5 cm (zona de silencio): sin el, la camara no separa el QR del texto. Las medidas van en cm para que la
 * impresora las respete al 100 %.
 */
import QRCode from 'qrcode';
import { COLUMNAS_HOJA, LADO_QR_CM, enHojas, type Invitacion } from './domain/grados-evento';

const escapar = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

export function construirHtmlHojas(items: { nombre: string; grado: string; qr: string }[], titulo: string): string {
  const hojas = enHojas(items);
  const cuerpo = hojas
    .map(
      (hoja, n) => `<section class="hoja">
  <p class="enc">${escapar(titulo)} · hoja ${n + 1} de ${hojas.length} · Imprimir en carta al 100 % (sin «ajustar a la página»): el QR debe medir ${String(LADO_QR_CM).replace('.', ',')} cm.</p>
  <div class="rejilla">${hoja
    .map(
      (i) => `<div class="recuadro"><img src="${i.qr}" alt=""><p class="nombre">${escapar(i.nombre)}</p><p class="grado">${escapar(i.grado)}</p></div>`,
    )
    .join('')}</div>
</section>`,
    )
    .join('\n');
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${escapar(titulo)}</title>
<style>
@page { size: letter; margin: 1cm; }
* { box-sizing: border-box; }
body { margin: 0; font-family: Arial, Helvetica, sans-serif; color: #000; background: #fff; }
.hoja { width: 19.59cm; page-break-after: always; }
.hoja:last-child { page-break-after: auto; }
.enc { font-size: 8pt; margin: 0 0 0.2cm; color: #444; }
.rejilla { display: grid; grid-template-columns: repeat(${COLUMNAS_HOJA}, 4.85cm); grid-auto-rows: 4.1cm; }
.recuadro { border: 1px dashed #888; padding: 0.3cm 0.2cm 0.1cm; text-align: center; overflow: hidden; }
.recuadro img { width: ${LADO_QR_CM}cm; height: ${LADO_QR_CM}cm; display: block; margin: 0 auto; image-rendering: pixelated; }
.nombre { font-size: 8.5pt; font-weight: bold; line-height: 1.15; margin: 0.15cm 0 0; }
.grado { font-size: 8pt; margin: 0.05cm 0 0; }
@media screen { body { padding: 1cm; background: #eee; } .hoja { background: #fff; padding: 0.5cm; margin-bottom: 1cm; } }
</style></head><body>
${cuerpo}
<script>window.onload = function () { setTimeout(function () { window.print(); }, 300); };</script>
</body></html>`;
}

/** Abre la ventana ANTES de generar los QR: si se abre despues de un await, el navegador la bloquea. */
export async function imprimirHojasQr(invs: Pick<Invitacion, 'token' | 'nombre' | 'grado'>[], titulo: string): Promise<void> {
  const ventana = window.open('', '_blank');
  if (!ventana) {
    window.alert('El navegador bloqueó la ventana de impresión. Permita las ventanas emergentes para esta página.');
    return;
  }
  ventana.document.write('<p style="font-family:sans-serif">Generando los QR…</p>');
  const items = await Promise.all(
    invs.map(async (i) => ({
      nombre: i.nombre,
      grado: i.grado,
      qr: await QRCode.toDataURL(i.token, { errorCorrectionLevel: 'M', margin: 2, width: 400 }),
    })),
  );
  ventana.document.open();
  ventana.document.write(construirHtmlHojas(items, titulo));
  ventana.document.close();
}
