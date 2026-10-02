// Genera y descarga el .xlsx de una sede (exceljs, cargado solo al pedirlo).
import { armarFilasExcel, rutasParaEnlaces, type MapaUrls } from './excelFilas';
import { urlArchivoSede } from './almacenamiento';
import type { SedeDatosDoc, SedeDatosId } from './tipos';

export async function descargarExcelSede(sede: SedeDatosId, doc: SedeDatosDoc | null): Promise<void> {
  const ExcelJS = (await import('exceljs')).default;
  // Enlaces: se resuelven en paralelo; si uno falla queda la ruta de Storage como texto.
  const urls: MapaUrls = {};
  await Promise.all(rutasParaEnlaces(doc).map(async ruta => {
    try { urls[ruta] = await urlArchivoSede(ruta); } catch { /* sin enlace */ }
  }));
  const hojas = armarFilasExcel(sede, doc, urls);

  const libro = new ExcelJS.Workbook();
  for (const [nombre, filas] of Object.entries(hojas)) {
    const hoja = libro.addWorksheet(nombre.slice(0, 31));
    filas.forEach((fila, i) => {
      const r = hoja.addRow(fila);
      r.alignment = { vertical: 'top', wrapText: true };
      if (i === 0) r.font = { bold: true };
      else {
        // Columnas de enlace: «Audio» (6) en hojas de tema, «Enlace» (3) en Archivos.
        const col = nombre === 'Archivos' ? 3 : 6;
        const v = String(fila[col - 1] ?? '');
        const primera = v.split('\n')[0];
        if (primera.startsWith('http')) r.getCell(col).value = { text: v, hyperlink: primera };
      }
    });
    hoja.columns.forEach((c, i) => { c.width = [14, 38, 12, 50, 18, 40, 40][i] ?? 20; });
    hoja.views = [{ state: 'frozen', ySplit: 1 }];
  }
  const buf = await libro.xlsx.writeBuffer();
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `datos-sede-${sede}-${new Date().toISOString().slice(0, 10)}.xlsx`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}
