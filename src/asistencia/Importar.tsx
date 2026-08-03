import { useState } from 'react';
import ExcelJS from 'exceljs';
import { httpsCallable } from 'firebase/functions';
import {
  aplicarMapeo,
  ArchivoNoReconocido,
  leerArchivo,
  sugerirMapeo,
  type ArchivoLeido,
  type AvisoFila,
  type CampoDestino,
  type FilaCruda,
} from './domain/import-parse';
import { parseGrupoMaster2000 } from './domain/grados';
import { functions } from '../lib/firebase';

/**
 * Importacion de estudiantes desde Master2000 — pantalla del superusuario.
 *
 * El archivo se lee ENTERO EN EL NAVEGADOR. Ni el documento de identidad ni los nombres
 * viajan a ningun servidor hasta que el superusuario confirma, y aun entonces el numero
 * de documento solo pasa en transito hacia la Cloud Function, que lo convierte en un
 * hash irreversible y nunca lo persiste.
 *
 * El flujo tiene tres pasos a proposito, y el del medio es el que protege:
 *   1. elegir archivo -> se detecta la fila de encabezados y se sugiere el mapeo;
 *   2. revisar el mapeo y los avisos, y PREVISUALIZAR (dryRun: no escribe nada);
 *   3. confirmar.
 */

const ETIQUETA: Record<CampoDestino, string> = {
  docNumber: 'Documento',
  apellidos: 'Apellidos',
  nombres: 'Nombres',
  grado: 'Grado',
  grupo: 'Grupo',
  acudiente: 'Acudiente',
  afinidad: 'Afinidad',
  telefono1: 'Teléfono 1',
  telefono2: 'Teléfono 2',
  email: 'Correo del acudiente',
  ignorar: '— no importar —',
};

interface Resumen {
  created: number;
  updated: number;
  review: number;
}

export default function Importar() {
  const [archivo, setArchivo] = useState<ArchivoLeido | null>(null);
  const [nombreArchivo, setNombreArchivo] = useState('');
  const [mapeo, setMapeo] = useState<CampoDestino[]>([]);
  const [filas, setFilas] = useState<FilaCruda[]>([]);
  const [avisos, setAvisos] = useState<AvisoFila[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [previa, setPrevia] = useState<Resumen | null>(null);
  const [hecho, setHecho] = useState<Resumen | null>(null);

  async function elegirArchivo(ev: React.ChangeEvent<HTMLInputElement>) {
    const f = ev.target.files?.[0];
    if (!f) return;
    setError(null);
    setPrevia(null);
    setHecho(null);
    setOcupado(true);
    try {
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(await f.arrayBuffer());
      const ws = wb.worksheets[0];

      // `cell.text` y no `cell.value`: los encabezados vienen como texto enriquecido y
      // `value` devuelve un objeto que al convertirlo a cadena da "[object Object]".
      const matriz: string[][] = [];
      for (let n = 1; n <= ws.rowCount; n++) {
        const fila: string[] = [];
        ws.getRow(n).eachCell({ includeEmpty: true }, (c, i) => {
          fila[i - 1] = (c.text ?? '').trim();
        });
        matriz.push(fila);
      }

      const leido = leerArchivo(matriz);
      const sugerido = sugerirMapeo(leido.encabezados);
      const { filas: fs, avisos: av } = aplicarMapeo(leido, sugerido);

      setArchivo(leido);
      setNombreArchivo(f.name);
      setMapeo(sugerido);
      setFilas(fs);
      setAvisos(av);
    } catch (e) {
      setArchivo(null);
      setError(
        e instanceof ArchivoNoReconocido
          ? e.message
          : `No fue posible leer el archivo: ${(e as Error).message}`,
      );
    } finally {
      setOcupado(false);
    }
  }

  function cambiarMapeo(columna: number, destino: CampoDestino) {
    if (!archivo) return;
    const nuevo = mapeo.map((c, i) => (i === columna ? destino : c));
    setMapeo(nuevo);
    setPrevia(null);
    try {
      const { filas: fs, avisos: av } = aplicarMapeo(archivo, nuevo);
      setFilas(fs);
      setAvisos(av);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  /** Traduce el grupo de Master2000 (060300) a la notación de la app (6º3). */
  function gradoDeFila(f: FilaCruda): { grado: string; error?: string } {
    try {
      return { grado: parseGrupoMaster2000(f.grupo).grado };
    } catch (e) {
      return { grado: f.grupo, error: (e as Error).message };
    }
  }

  const gradosNoTraducibles = [
    ...new Set(filas.map(gradoDeFila).filter((g) => g.error).map((g) => g.grado)),
  ];

  async function enviar(dryRun: boolean) {
    if (!functions) {
      setError('Firebase no está configurado en esta instalación.');
      return;
    }
    setOcupado(true);
    setError(null);
    try {
      const importar = httpsCallable(functions, 'importStudents');
      const res = await importar({
        anio: new Date().getFullYear(),
        fileName: nombreArchivo,
        dryRun,
        rows: filas
          .filter((f) => !gradoDeFila(f).error)
          .map((f) => ({
            nombres: f.nombres,
            apellidos: f.apellidos,
            docNumber: f.docNumber,
            docType: 'TI',
            grado: gradoDeFila(f).grado,
            acudiente: f.acudiente,
            telefonos: f.telefonos,
          })),
      });
      const resumen = (res.data as { resumen: Resumen }).resumen;
      if (dryRun) setPrevia(resumen);
      else {
        setHecho(resumen);
        setPrevia(null);
      }
    } catch (e) {
      setError(`La importación falló: ${(e as Error).message}`);
    } finally {
      setOcupado(false);
    }
  }

  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-base font-semibold text-strong">Importar estudiantes</h2>
        <p className="text-xs text-muted">
          Desde el listado de Master2000. El archivo se lee en este navegador; nada se
          guarda hasta que usted confirme.
        </p>
      </div>

      <label className="inline-block cursor-pointer rounded-lg border border-line bg-card px-3 py-2 text-sm text-strong">
        Seleccionar archivo…
        <input type="file" accept=".xlsx,.xls" hidden onChange={elegirArchivo} />
      </label>
      {nombreArchivo && <span className="ml-2 text-xs text-muted">{nombreArchivo}</span>}

      {error && (
        <div className="rounded-xl border border-danger-soft bg-danger-soft p-3 text-sm text-danger-soft-fg">
          {error}
        </div>
      )}

      {archivo && (
        <>
          <div className="rounded-xl border border-line bg-card p-3 text-sm">
            <p className="text-strong">
              {filas.length} filas · encabezados en la fila {archivo.filaEncabezados + 1}
            </p>
            <p className="text-xs text-muted">
              Revise que cada columna vaya al campo correcto. Master2000 cambia las
              columnas según lo que se elija al generar el listado, así que la sugerencia
              puede fallar.
            </p>
          </div>

          <div className="overflow-x-auto rounded-xl border border-line bg-card">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted">
                  <th className="p-2">Columna del archivo</th>
                  <th className="p-2">Se importa como</th>
                </tr>
              </thead>
              <tbody>
                {archivo.encabezados.map((e, i) =>
                  e ? (
                    <tr key={i} className="border-t border-line">
                      <td className="p-2 text-strong">{e}</td>
                      <td className="p-2">
                        <select
                          value={mapeo[i]}
                          onChange={(ev) => cambiarMapeo(i, ev.target.value as CampoDestino)}
                          className="rounded-lg border border-line bg-elevated px-2 py-1 text-sm"
                        >
                          {(Object.keys(ETIQUETA) as CampoDestino[]).map((c) => (
                            <option key={c} value={c}>
                              {ETIQUETA[c]}
                            </option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ) : null,
                )}
              </tbody>
            </table>
          </div>

          {gradosNoTraducibles.length > 0 && (
            <div className="rounded-xl border border-warning-soft bg-warning-soft p-3 text-sm text-warning-soft-fg">
              <b>{gradosNoTraducibles.length} código(s) de grupo sin traducir:</b>{' '}
              {gradosNoTraducibles.join(', ')}. Esas filas <b>no se importarán</b>. Ocurre
              con Transición y con la primaria, cuya notación todavía no está definida.
            </div>
          )}

          {avisos.length > 0 && (
            <details className="rounded-xl border border-line bg-card p-3">
              <summary className="cursor-pointer text-sm font-semibold text-strong">
                {avisos.length} aviso(s) de calidad en el archivo
              </summary>
              <p className="mt-1 text-xs text-muted">
                No impiden importar. Son filas que conviene mirar en Master2000: un
                documento con longitud imposible entra como si fuera válido y crea un
                estudiante fantasma que nadie relaciona después.
              </p>
              <ul className="mt-2 space-y-0.5 text-xs text-soft">
                {avisos.slice(0, 40).map((a, i) => (
                  <li key={i}>
                    Fila {a.fila}: {a.motivo}
                  </li>
                ))}
                {avisos.length > 40 && <li className="text-muted">… y {avisos.length - 40} más</li>}
              </ul>
            </details>
          )}

          <div className="flex flex-wrap gap-2">
            <button
              disabled={ocupado || filas.length === 0}
              onClick={() => void enviar(true)}
              className="rounded-lg bg-accent px-3 py-2 text-sm font-medium text-accent-fg disabled:opacity-50"
            >
              {ocupado ? 'Trabajando…' : 'Previsualizar (no escribe nada)'}
            </button>
            {previa && (
              <button
                disabled={ocupado}
                onClick={() => void enviar(false)}
                className="rounded-lg border border-line px-3 py-2 text-sm text-strong disabled:opacity-50"
              >
                Confirmar e importar
              </button>
            )}
          </div>

          {previa && (
            <div className="rounded-xl border border-info-soft bg-info-soft p-3 text-sm text-info-soft-fg">
              <b>Previsualización — todavía no se ha escrito nada.</b>
              <br />
              Crearía <b>{previa.created}</b> estudiantes, actualizaría <b>{previa.updated}</b> y
              mandaría <b>{previa.review}</b> a revisión manual.
              {previa.review > 0 && (
                <>
                  {' '}
                  Los de revisión son casos donde dos personas podrían ser la misma:
                  el sistema no lo decide solo.
                </>
              )}
            </div>
          )}

          {hecho && (
            <div className="rounded-xl border border-success-soft bg-success-soft p-3 text-sm text-success-soft-fg">
              <b>Importación terminada.</b> {hecho.created} creados, {hecho.updated}{' '}
              actualizados, {hecho.review} en revisión.
            </div>
          )}
        </>
      )}
    </div>
  );
}
