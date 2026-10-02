// Vista del superusuario: respuestas de una sede, audios, archivos y descarga en Excel.
import { useEffect, useMemo, useState } from 'react';
import { calcularAvance, entradaTieneContenido, preguntasSinResponder } from '../../data/sedeDatos/avance';
import { formatearRef, formatearTamano } from '../../data/sedeDatos/archivos';
import { descargarExcelSede } from '../../data/sedeDatos/excelDescarga';
import { estadoExcel } from '../../data/sedeDatos/excelFilas';
import { docIdDeSede, escucharSedeDatos } from '../../data/sedeDatos/persistencia';
import { temasDeSede } from '../../data/sedeDatos/temas';
import type { Entrada, SedeDatosDoc, SedeDatosId } from '../../data/sedeDatos/tipos';
import { Boton, EnlaceArchivo, ReproductorNota } from './piezas';

export function fechaDeTimestamp(t: unknown): string {
  const d = (t as { toDate?: () => Date } | undefined)?.toDate?.();
  return d ? d.toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' }) : '';
}

function Detalle({ e }: { e: Entrada }) {
  if (!entradaTieneContenido(e)) return null;
  return (
    <div className="space-y-1 mt-1">
      {e.texto.trim() && <p className="text-sm text-strong whitespace-pre-wrap">{e.texto}</p>}
      {e.refs.length > 0 && <p className="text-xs text-info">Archivo: {e.refs.map(formatearRef).join('; ')}</p>}
      {e.audios.map(a => <ReproductorNota key={a.ruta} nota={a} />)}
    </div>
  );
}

const COLOR_ESTADO: Record<string, string> = {
  bien: 'bg-success-soft text-success-soft-fg', respondido: 'bg-success-soft text-success-soft-fg',
  corregir: 'bg-warning-soft text-warning-soft-fg', 'después': 'bg-elevated text-muted', pendiente: 'bg-elevated text-muted',
};

export default function ResumenSedeDatos({ sede, prueba = false }: { sede: SedeDatosId; prueba?: boolean }) {
  const [doc, setDoc] = useState<SedeDatosDoc | null>(null);
  const [listo, setListo] = useState(false);
  const [bajando, setBajando] = useState(false);
  const [err, setErr] = useState('');
  const temas = useMemo(() => temasDeSede(sede), [sede]);

  useEffect(() => escucharSedeDatos(docIdDeSede(sede, prueba), d => { setDoc(d); setListo(true); }), [sede, prueba]);

  if (!listo) return <p className="text-sm text-muted">Cargando…</p>;
  const avance = calcularAvance(temas, doc?.respuestas ?? {});

  async function bajar() {
    setBajando(true); setErr('');
    try { await descargarExcelSede(sede, doc); } catch (e) { setErr((e as Error).message); }
    setBajando(false);
  }

  return (
    <div className="space-y-4">
      {prueba && <p className="rounded-lg bg-warning-soft text-warning-soft-fg text-sm font-semibold px-3 py-2 text-center">DATOS DE PRUEBA — no son los de la sede</p>}
      <div className="rounded-xl border border-line bg-card p-4 flex items-center justify-between gap-3 flex-wrap">
        <div>
          <p className="text-sm text-strong"><b>{avance.hechos} de {avance.total}</b> temas completos · {doc?.archivos.length ?? 0} archivos</p>
          <p className="text-xs text-muted">
            {doc?.enviadoEn ? `Enviado ${fechaDeTimestamp(doc.enviadoEn)} (${doc.enviosCount ?? 1} ${(doc.enviosCount ?? 1) === 1 ? 'vez' : 'veces'})` : 'Aún no se ha enviado.'}
            {doc?.actualizadoPor ? ` · Última edición: ${doc.actualizadoPor}` : ''}
          </p>
        </div>
        {!prueba && <Boton tono="primario" disabled={bajando} onClick={bajar}>{bajando ? "Preparando…" : "Descargar Excel"}</Boton>}
      </div>
      {err && <p className="text-sm text-danger">{err}</p>}

      {temas.map(t => {
        const r = doc?.respuestas?.[t.id];
        const est = estadoExcel(r);
        const sin = preguntasSinResponder(t, r);
        return (
          <section key={t.id} className="rounded-xl border border-line bg-card p-4 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <h3 className="text-sm font-semibold text-strong">{t.titulo}</h3>
              <span className={`text-[11px] font-semibold rounded-full px-2 py-0.5 ${COLOR_ESTADO[est]}`}>{est}</span>
            </div>
            {r && <Detalle e={r.entrada} />}
            {t.preguntas.filter(p => !sin.includes(p.id)).map(p => {
              const x = r!.preguntas[p.id];
              return (
                <div key={p.id} className="border-t border-line pt-2">
                  <p className="text-xs text-muted">{p.etiqueta}</p>
                  <p className="text-sm text-strong">{[x.valor, x.detalle].filter(s => s.trim()).join(' · ')}</p>
                  <Detalle e={x.entrada} />
                </div>
              );
            })}
          </section>
        );
      })}

      <section className="rounded-xl border border-line bg-card p-4 space-y-2">
        <h3 className="text-sm font-semibold text-strong">Archivos</h3>
        {(doc?.archivos.length ?? 0) === 0 && <p className="text-xs text-muted">Ninguno.</p>}
        {doc?.archivos.map(a => (
          <p key={a.id} className="text-sm text-strong">
            <span className="font-semibold">{a.etiqueta}</span> · <EnlaceArchivo ruta={a.ruta}>{a.nombre}</EnlaceArchivo>
            <span className="text-xs text-muted"> · {formatearTamano(a.tamano)} · {a.subidoPor}</span>
          </p>
        ))}
      </section>
    </div>
  );
}
