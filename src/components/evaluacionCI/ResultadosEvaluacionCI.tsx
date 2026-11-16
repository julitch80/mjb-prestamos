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

// Títulos cortos para la matriz (la pregunta completa se ve al desplegar).
const CORTOS_A = ['Cómo se sintió', 'Actividades y materiales', 'Comprensión', 'Volver al taller'];
const CORTOS_B = ['Ideas y proyectos', 'Problemas reales', 'Útil para la vida', 'Expresión y emociones', 'Respeto y escucha',
  'Habilidades personales', 'Trabajo en equipo', 'Aporte a la comunidad', 'Motivación al colegio', 'Espacio adecuado'];
const EMOJI: Record<string, string> = { feliz: '😊', neutral: '😐', triste: '☹️', si: 'Sí', no: 'No' };

/** % del valor «positivo» (Sí / feliz): da el color del índice y de la tarjeta. */
const positivo = (c: ConteoPregunta) => porcentaje(c.valores.si ?? c.valores.feliz ?? 0, c.total);
const tono = (p: number, total: number) =>
  total === 0 ? '#9ca3af' : p >= 75 ? '#16a34a' : p >= 50 ? '#ca8a04' : '#dc2626';

/** Diagrama de barras verticales de una pregunta. */
function Grafico({ c, alto = 96 }: { c: ConteoPregunta; alto?: number }) {
  return (
    <div className="flex items-end justify-center gap-4" style={{ height: alto + 40 }}>
      {Object.entries(c.valores).map(([v, n]) => {
        const p = porcentaje(n, c.total);
        return (
          <div key={v} className="flex flex-col items-center gap-1 w-12">
            <span className="text-xs font-semibold text-strong tabular-nums">{p}%</span>
            <div className="w-full rounded-t bg-elevated flex items-end" style={{ height: alto }}>
              <div className="w-full rounded-t" style={{ height: `${p}%`, background: COLORES[v], minHeight: n ? 2 : 0 }} />
            </div>
            <span className="text-sm text-soft">{EMOJI[v] ?? v}</span>
          </div>
        );
      })}
    </div>
  );
}

/** Desglose por grado de una pregunta (para el detalle desplegable). */
function porGrado(rs: RespuestaCI[], instrumento: 'A' | 'B', idx: number) {
  const k = `p${idx + 1}`;
  const m = new Map<string, { pos: number; total: number }>();
  for (const r of rs) {
    if (r.instrumento !== instrumento) continue;
    const v = r.respuestas?.[k];
    if (!v) continue;
    const e = m.get(r.grado) ?? { pos: 0, total: 0 };
    e.total++;
    if (v === 'si' || v === 'feliz') e.pos++;
    m.set(r.grado, e);
  }
  return GRADOS.filter(g => m.has(g)).map(g => ({ grado: g, ...m.get(g)! }));
}

function Tarjeta({ n, corto, completa, c, abierta, onToggle, rs, instrumento, idx }: {
  n: number; corto: string; completa: string; c: ConteoPregunta; abierta: boolean; onToggle: () => void;
  rs: RespuestaCI[]; instrumento: 'A' | 'B'; idx: number;
}) {
  const p = positivo(c);
  const grados = abierta ? porGrado(rs, instrumento, idx) : [];
  return (
    <article id={`preg-${instrumento}-${n}`}
      className={`rounded-xl border bg-card p-3 flex flex-col scroll-mt-28 ${abierta ? 'border-accent sm:col-span-2' : 'border-line'}`}>
      <header className="flex items-start gap-2">
        <span className="shrink-0 w-7 h-7 rounded-full text-xs font-bold flex items-center justify-center text-white"
          style={{ background: tono(p, c.total) }}>{n}</span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-strong leading-tight">{corto}</p>
          <p className="text-xs text-muted">{c.total} respuestas · {p}% {instrumento === 'A' ? '😊' : 'Sí'}</p>
        </div>
        <button type="button" onClick={onToggle} aria-expanded={abierta} aria-label={abierta ? 'Ocultar detalle' : 'Ver detalle'}
          className="shrink-0 w-9 h-9 rounded-lg border border-line text-soft hover:bg-elevated hover:text-strong">
          <span className={`inline-block transition-transform ${abierta ? 'rotate-180' : ''}`}>▾</span>
        </button>
      </header>
      <div className="mt-2"><Grafico c={c} /></div>
      {abierta && (
        <div className="mt-3 pt-3 border-t border-line space-y-3 text-sm">
          <p className="text-soft">{completa}</p>
          <table className="w-full text-xs tabular-nums">
            <thead><tr className="text-muted text-left"><th className="py-1">Respuesta</th><th>Cantidad</th><th>Porcentaje</th></tr></thead>
            <tbody>
              {Object.entries(c.valores).map(([v, k]) => (
                <tr key={v} className="border-t border-line">
                  <td className="py-1 text-strong">{EMOJI[v]} {v === 'si' || v === 'no' ? '' : etiquetaValor(v)}</td>
                  <td>{k}</td><td>{porcentaje(k, c.total)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
          {grados.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-strong mb-1">Por grado ({instrumento === 'A' ? '% 😊' : '% Sí'})</p>
              <div className="flex flex-wrap gap-1.5">
                {grados.map(g => {
                  const pg = porcentaje(g.pos, g.total);
                  return (
                    <span key={g.grado} className="px-2 py-1 rounded-md text-xs text-white" style={{ background: tono(pg, g.total) }}>
                      {etiquetaGrado(g.grado)}: {pg}% <span className="opacity-80">({g.total})</span>
                    </span>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </article>
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
  const [inst, setInst] = useState<'A' | 'B'>('B');
  const [abiertaN, setAbiertaN] = useState<number | null>(null);
  function irA(n: number) {
    setAbiertaN(n);
    requestAnimationFrame(() => document.getElementById(`preg-${inst}-${n}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }

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
    <div className="max-w-6xl mx-auto space-y-4 p-4">
      <h1 className="text-xl font-bold text-strong">Evaluación de centros de interés</h1>
      <details className="rounded-xl border border-line bg-card p-3">
        <summary className="text-sm font-medium text-strong cursor-pointer">
          Administrar encuesta · <span className="text-soft">{abierta === null ? '…' : abierta ? 'abierta' : 'cerrada'}</span> · enlace y QR
        </summary>
        <div className="mt-3 space-y-3">
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

        </div>
      </details>

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

          <div className="inline-flex rounded-xl border border-line overflow-hidden">
            {(['B', 'A'] as const).map(i => (
              <button key={i} type="button" onClick={() => { setInst(i); setAbiertaN(null); }}
                className={`min-h-[44px] px-4 text-sm font-medium ${inst === i ? 'bg-accent text-accent-fg' : 'bg-card text-soft hover:bg-elevated'}`}>
                {i === 'B' ? `3.° a 11.° (${r.totalB})` : `Preescolar a 2.° (${r.totalA})`}
              </button>
            ))}
          </div>

          {(() => {
            const conteos = inst === 'A' ? r.A : r.B;
            const cortos = inst === 'A' ? CORTOS_A : CORTOS_B;
            const completas = inst === 'A' ? PREGUNTAS_A : PREGUNTAS_B;
            const totalInst = inst === 'A' ? r.totalA : r.totalB;
            if (totalInst === 0) return <p className="text-soft">Todavía no hay respuestas de estos grados con los filtros elegidos.</p>;
            return (
              <>
                {/* Índice: salto directo a cualquier pregunta; el color resume el resultado */}
                <nav className="sticky top-0 z-10 py-2 bg-app flex flex-wrap gap-1.5" aria-label="Ir a la pregunta">
                  {conteos.map((c, i) => {
                    const p = positivo(c);
                    return (
                      <button key={i} type="button" onClick={() => irA(i + 1)} title={`${i + 1}. ${cortos[i]}: ${p}%`}
                        className={`min-w-[48px] h-12 px-2 rounded-lg text-xs font-bold text-white tabular-nums leading-tight ${abiertaN === i + 1 ? 'ring-2 ring-offset-2 ring-accent' : ''}`}
                        style={{ background: tono(p, c.total) }}>
                        P{i + 1}<span className="block text-[10px] font-medium opacity-90">{p}%</span>
                      </button>
                    );
                  })}
                  {abiertaN !== null && (
                    <button type="button" onClick={() => setAbiertaN(null)}
                      className="h-12 px-3 rounded-lg border border-line text-xs text-soft hover:bg-elevated">Cerrar detalle</button>
                  )}
                </nav>
                <p className="text-xs text-muted">
                  Verde: 75 % o más {inst === 'A' ? '😊' : 'Sí'} · Amarillo: 50–74 % · Rojo: menos de 50 %. Toque ▾ para ver el detalle.
                </p>

                <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                  {conteos.map((c, i) => (
                    <Tarjeta key={i} n={i + 1} corto={cortos[i]} completa={completas[i]} c={c} rs={filtrados} instrumento={inst} idx={i}
                      abierta={abiertaN === i + 1} onToggle={() => setAbiertaN(abiertaN === i + 1 ? null : i + 1)} />
                  ))}
                  {inst === 'A' && (
                    <article className="rounded-xl border border-line bg-card p-3">
                      <p className="text-sm font-semibold text-strong mb-2">Lo que más les gustó ({r.comentarios.length})</p>
                      {r.comentarios.length === 0 ? <p className="text-xs text-muted">Sin comentarios.</p> : (
                        <ul className="space-y-1 text-sm text-soft max-h-48 overflow-auto">
                          {r.comentarios.map((c, i) => <li key={i}>«{c.texto}» <span className="text-xs text-muted">· {etiquetaGrado(c.grado)}</span></li>)}
                        </ul>
                      )}
                    </article>
                  )}
                </div>
              </>
            );
          })()}
          {r.total === 0 && <p className="text-soft">Todavía no hay respuestas con estos filtros.</p>}
        </>
      )}
    </div>
  );
}
