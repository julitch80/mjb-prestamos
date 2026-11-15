// Resultados de la «Evaluación de los centros de interés» dentro de la app.
// Quién lo ve lo decide App.tsx (puedeVerResultados); la barrera real es la regla de Firestore.
import { useCallback, useEffect, useMemo, useState } from 'react';
import QRCode from 'qrcode';
import { collection, doc, getDoc, getDocs, setDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAppStore } from '../../data/store';
import {
  COL_EVAL, COL_EVAL_CONFIG, DOC_ESTADO, DOC_LECTORES, GRADOS, PREGUNTAS_A, PREGUNTAS_B, RUTA_PUBLICA, SEDES_EVAL,
  etiquetaGrado, etiquetaSede, etiquetaValor, filasExcel, filtrar, porcentaje, resumir,
  type ConteoPregunta, type RespuestaCI,
} from '../../data/evaluacionCI/logica';

const COLORES: Record<string, string> = {
  feliz: '#16a34a', neutral: '#ca8a04', triste: '#dc2626', si: '#16a34a', no: '#dc2626',
};

function urlPublica() {
  return `${window.location.origin}${window.location.pathname}${RUTA_PUBLICA}`;
}

function Barras({ titulo, c }: { titulo: string; c: ConteoPregunta }) {
  return (
    <div className="rounded-xl border border-line bg-card p-3 space-y-2">
      <p className="text-sm font-medium text-strong">{titulo}</p>
      {Object.entries(c.valores).map(([v, n]) => {
        const p = porcentaje(n, c.total);
        return (
          <div key={v} className="flex items-center gap-2 text-xs">
            <span className="w-14 text-soft">{etiquetaValor(v)}</span>
            <div className="flex-1 h-4 rounded bg-elevated overflow-hidden">
              <div className="h-full" style={{ width: `${p}%`, background: COLORES[v] }} />
            </div>
            <span className="w-24 text-right text-strong tabular-nums">{p}% · {n}</span>
          </div>
        );
      })}
    </div>
  );
}

function TarjetaEnlace() {
  const [qr, setQr] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);
  const url = urlPublica();
  useEffect(() => { QRCode.toDataURL(url, { width: 280, margin: 1 }).then(setQr).catch(() => setQr(null)); }, [url]);
  async function copiar() {
    try { await navigator.clipboard.writeText(url); setCopiado(true); setTimeout(() => setCopiado(false), 2000); } catch { /* sin portapapeles */ }
  }
  return (
    <div className="rounded-xl border border-line bg-card p-4 flex flex-col sm:flex-row gap-4 items-center">
      {qr && <img src={qr} alt="Código QR de la evaluación" className="w-40 h-40 rounded bg-white p-1" />}
      <div className="space-y-2 min-w-0">
        <p className="text-sm font-semibold text-strong">Enlace público para estudiantes</p>
        <p className="text-xs text-soft break-all">{url}</p>
        <button type="button" onClick={copiar} className="min-h-[44px] px-4 rounded-lg border border-accent bg-accent text-accent-fg text-sm font-medium">
          {copiado ? 'Copiado ✓' : 'Copiar enlace'}
        </button>
      </div>
    </div>
  );
}

export default function ResultadosEvaluacionCI() {
  const rol = useAppStore(s => s.rol);
  const esSuper = rol === 'superusuario';
  const [datos, setDatos] = useState<RespuestaCI[]>([]);
  const [estado, setEstado] = useState<'cargando' | 'listo' | 'error'>('cargando');
  const [abierta, setAbierta] = useState<boolean | null>(null);
  const [grado, setGrado] = useState('');
  const [sede, setSede] = useState('');
  const [aviso, setAviso] = useState('');
  const [lectoresTxt, setLectoresTxt] = useState('');

  const cargar = useCallback(async () => {
    if (!db) { setEstado('error'); return; }
    setEstado('cargando');
    try {
      const s = await getDocs(collection(db, COL_EVAL));
      setDatos(s.docs.map(d => {
        const x = d.data();
        return { id: d.id, instrumento: x.instrumento, grado: x.grado, sede: x.sede ?? null, respuestas: x.respuestas ?? {},
          comentario: x.comentario, creado: x.creado?.toDate ? x.creado.toDate() : null } as RespuestaCI;
      }));
      const e = await getDoc(doc(db, COL_EVAL_CONFIG, DOC_ESTADO));
      setAbierta(e.exists() && e.data().abierta === true);
      if (esSuper) {
        const l = await getDoc(doc(db, COL_EVAL_CONFIG, DOC_LECTORES));
        setLectoresTxt(((l.data()?.correos as string[] | undefined) ?? []).join('\n'));
      }
      setEstado('listo');
    } catch { setEstado('error'); }
  }, [esSuper]);
  useEffect(() => { void cargar(); }, [cargar]);

  const filtrados = useMemo(() => filtrar(datos, { grado, sede }), [datos, grado, sede]);
  const r = useMemo(() => resumir(filtrados), [filtrados]);

  async function alternar() {
    if (!db || abierta === null) return;
    try { await setDoc(doc(db, COL_EVAL_CONFIG, DOC_ESTADO), { abierta: !abierta }); setAbierta(!abierta); setAviso(''); }
    catch { setAviso('No se pudo cambiar el estado.'); }
  }
  async function guardarLectores() {
    if (!db) return;
    const correos = lectoresTxt.split(/[\s,;]+/).map(c => c.trim().toLowerCase()).filter(Boolean);
    try { await setDoc(doc(db, COL_EVAL_CONFIG, DOC_LECTORES), { correos }); setAviso('Lectores guardados.'); }
    catch { setAviso('No se pudieron guardar los lectores.'); }
  }
  async function descargar() {
    const { default: ExcelJS } = await import('exceljs');
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Evaluación CI');
    filasExcel(datos).forEach(f => ws.addRow(f));
    ws.getRow(1).font = { bold: true };
    ws.columns.forEach(c => { c.width = 14; });
    const buf = await wb.xlsx.writeBuffer();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
    a.download = `evaluacion_centros_interes_${new Date().toISOString().slice(0, 10)}.xlsx`;
    a.click(); URL.revokeObjectURL(a.href);
  }

  const sel = 'min-h-[44px] rounded-lg border border-line bg-card px-3 text-sm text-strong';
  return (
    <div className="max-w-4xl mx-auto space-y-4 p-4">
      <h1 className="text-xl font-bold text-strong">Evaluación de centros de interés</h1>
      <TarjetaEnlace />

      <div className="rounded-xl border border-line bg-card p-3 flex flex-wrap items-center gap-3">
        <span className="text-sm text-strong">
          Encuesta: <b>{abierta === null ? '…' : abierta ? 'abierta' : 'cerrada'}</b>
        </span>
        {esSuper
          ? <button type="button" onClick={alternar} disabled={abierta === null}
              className="min-h-[44px] px-4 rounded-lg border border-line bg-card text-sm font-medium text-strong hover:bg-elevated">
              {abierta ? 'Cerrar encuesta' : 'Abrir encuesta'}
            </button>
          : <span className="text-xs text-muted">(solo el superusuario la abre o cierra)</span>}
        <button type="button" onClick={cargar} className="min-h-[44px] px-4 rounded-lg border border-line bg-card text-sm text-soft hover:bg-elevated">Actualizar</button>
        <button type="button" onClick={descargar} disabled={datos.length === 0}
          className="min-h-[44px] px-4 rounded-lg border border-accent bg-accent text-accent-fg text-sm font-medium disabled:opacity-40">Descargar Excel</button>
      </div>
      {aviso && <p className="text-sm text-soft">{aviso}</p>}

      {esSuper && (
        <details className="rounded-xl border border-line bg-card p-3">
          <summary className="text-sm font-medium text-strong cursor-pointer">Lectores adicionales (correos, uno por línea)</summary>
          <textarea value={lectoresTxt} onChange={e => setLectoresTxt(e.target.value)} rows={3}
            className="mt-2 w-full rounded-lg border border-line bg-card p-2 text-sm text-strong" placeholder="correo@iemanueljbetancur.edu.co" />
          <button type="button" onClick={guardarLectores} className="mt-2 min-h-[44px] px-4 rounded-lg border border-line text-sm text-strong hover:bg-elevated">Guardar</button>
        </details>
      )}

      {estado === 'cargando' && <p className="text-soft">Cargando…</p>}
      {estado === 'error' && <p className="rounded-lg bg-danger-soft text-danger-soft-fg p-3 text-sm">No se pudieron leer las respuestas (permisos o conexión).</p>}

      {estado === 'listo' && (
        <>
          <div className="flex flex-wrap gap-3 items-center">
            <select className={sel} value={grado} onChange={e => setGrado(e.target.value)} aria-label="Filtrar por grado">
              <option value="">Todos los grados</option>
              {GRADOS.map(g => <option key={g} value={g}>{etiquetaGrado(g)}</option>)}
            </select>
            <select className={sel} value={sede} onChange={e => setSede(e.target.value)} aria-label="Filtrar por sede">
              <option value="">Todas las sedes</option>
              {SEDES_EVAL.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
              <option value="sin_dato">{etiquetaSede(null)}</option>
            </select>
            <span className="text-sm text-strong">
              Total: <b>{r.total}</b> · Preescolar–2.° (A): <b>{r.totalA}</b> · 3.°–11.° (B): <b>{r.totalB}</b>
            </span>
          </div>

          {r.totalA > 0 && (
            <section className="space-y-2">
              <h2 className="font-semibold text-strong">Instrumento A — Preescolar a 2.°</h2>
              {PREGUNTAS_A.map((q, i) => <Barras key={i} titulo={`${i + 1}. ${q}`} c={r.A[i]} />)}
              <div className="rounded-xl border border-line bg-card p-3">
                <p className="text-sm font-medium text-strong mb-2">Lo que más les gustó ({r.comentarios.length})</p>
                {r.comentarios.length === 0 ? <p className="text-xs text-muted">Sin comentarios.</p> : (
                  <ul className="space-y-1 text-sm text-soft max-h-64 overflow-auto">
                    {r.comentarios.map((c, i) => <li key={i}>«{c.texto}» <span className="text-xs text-muted">· {etiquetaGrado(c.grado)}</span></li>)}
                  </ul>
                )}
              </div>
            </section>
          )}
          {r.totalB > 0 && (
            <section className="space-y-2">
              <h2 className="font-semibold text-strong">Instrumento B — 3.° a 11.°</h2>
              {PREGUNTAS_B.map((q, i) => <Barras key={i} titulo={`${i + 1}. ${q}`} c={r.B[i]} />)}
            </section>
          )}
          {r.total === 0 && <p className="text-soft">Todavía no hay respuestas con estos filtros.</p>}
        </>
      )}
    </div>
  );
}
