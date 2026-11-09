import { useState } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../lib/firebase';

type Cifra = { id: string; grupo: string; etiqueta: string; valor: number | null; nota?: string };
type Respuesta = { generadoEn: number; cifras: Cifra[] };

const fmt = (n: number) => n.toLocaleString('es-CO');

export function resumenTexto(r: Respuesta): string {
  const fecha = new Date(r.generadoEn).toLocaleString('es-CO');
  const lineas = [`Cifras de uso de la plataforma MJB (consulta: ${fecha})`];
  let grupo = '';
  for (const c of r.cifras) {
    if (c.grupo !== grupo) { grupo = c.grupo; lineas.push('', grupo.toUpperCase()); }
    lineas.push(`- ${c.etiqueta}: ${c.valor === null ? 'no disponible' : fmt(c.valor)}`);
  }
  return lineas.join('\n');
}

export default function CifrasUso() {
  const [datos, setDatos] = useState<Respuesta | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);

  async function consultar() {
    if (!functions) { setError('Firebase no está configurado.'); return; }
    setCargando(true); setError(null); setCopiado(false);
    try {
      const r = await httpsCallable<unknown, Respuesta>(functions, 'cifrasUso')({});
      setDatos(r.data);
    } catch (e) {
      setError(`No se pudo consultar: ${(e as Error).message}`);
    } finally {
      setCargando(false);
    }
  }

  async function copiar() {
    if (!datos) return;
    try { await navigator.clipboard.writeText(resumenTexto(datos)); setCopiado(true); }
    catch { setError('No se pudo copiar al portapapeles.'); }
  }

  const grupos = datos ? Array.from(new Set(datos.cifras.map(c => c.grupo))) : [];

  return (
    <div className="bg-card rounded-xl p-5 space-y-3 max-w-2xl">
      <div>
        <h3 className="text-strong font-semibold">Cifras de uso</h3>
        <p className="text-muted text-xs mt-0.5 leading-snug">
          Solo totales (conteos); no se descarga ningún dato de personas. Útil para el informe ejecutivo.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={consultar} disabled={cargando}
          className="min-h-[40px] px-3 rounded-lg bg-accent text-accent-fg text-sm font-semibold disabled:opacity-50">
          {cargando ? 'Consultando…' : datos ? 'Actualizar' : 'Consultar cifras'}
        </button>
        {datos && (
          <button type="button" onClick={copiar}
            className="min-h-[40px] px-3 rounded-lg border border-line text-strong text-sm font-semibold">
            {copiado ? 'Copiado' : 'Copiar como texto'}
          </button>
        )}
      </div>
      {error && <p className="text-xs text-soft">{error}</p>}
      {datos && (
        <>
          <p className="text-xs text-muted">Consulta: {new Date(datos.generadoEn).toLocaleString('es-CO')}</p>
          {grupos.map(g => (
            <div key={g} className="space-y-1.5">
              <h4 className="text-soft text-xs font-semibold uppercase tracking-wide">{g}</h4>
              <div className="grid grid-cols-2 gap-2">
                {datos.cifras.filter(c => c.grupo === g).map(c => (
                  <div key={c.id} className="rounded-lg border border-line p-2.5">
                    <div className="text-strong text-xl font-bold leading-tight">
                      {c.valor === null ? 'No disponible' : fmt(c.valor)}
                    </div>
                    <div className="text-soft text-xs leading-snug">{c.etiqueta}</div>
                    {c.valor === null && c.nota && <div className="text-muted text-[11px] mt-1 leading-snug">{c.nota}</div>}
                  </div>
                ))}
              </div>
            </div>
          ))}
          <p className="text-muted text-[11px] leading-snug">
            Tareas (momentos), reservas de espacios y sugerencias viven en Google Sheets/Apps Script, no en Firestore; no se cuentan aquí.
          </p>
        </>
      )}
    </div>
  );
}
