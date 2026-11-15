// Página pública (sin login) de la «Evaluación de los centros de interés».
// Anónima: no pide nombre ni nada identificable. Escribe en evaluacionCI/{auto};
// las reglas de Firestore validan la forma y que la encuesta esté abierta.
import { useEffect, useRef, useState } from 'react';
import { addDoc, collection, doc, getDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import {
  COL_EVAL, COL_EVAL_CONFIG, DOC_ESTADO, GRADOS, MAX_COMENTARIO, PREGUNTAS_A, PREGUNTAS_B, PREGUNTA_COMENTARIO_A,
  SEDES_EVAL, armarDocumento, etiquetaGrado, instrumentoDeGrado,
} from '../../data/evaluacionCI/logica';

type Estado = 'cargando' | 'abierta' | 'cerrada' | 'sinRed';
const CARAS = [
  { v: 'feliz', e: '😊', t: 'Me gustó' },
  { v: 'neutral', e: '😐', t: 'Más o menos' },
  { v: 'triste', e: '☹️', t: 'No me gustó' },
];

function Marco({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen px-4 py-6">
      <div className="max-w-xl mx-auto space-y-5">
        <header className="text-center space-y-1">
          <h1 className="text-xl font-bold text-strong leading-snug">
            Evaluación de los centros de interés — I.E. Manuel J. Betancur
          </h1>
        </header>
        {children}
      </div>
    </div>
  );
}

export default function EvaluacionPublica() {
  const [estado, setEstado] = useState<Estado>('cargando');
  const [grado, setGrado] = useState<string | null>(null);
  const [sede, setSede] = useState<string | null>(null); // null = sin elegir / omitida
  const [sedeVista, setSedeVista] = useState(false); // ya pasó el paso de sede
  const [resp, setResp] = useState<Record<string, string>>({});
  const [comentario, setComentario] = useState('');
  const [enviado, setEnviado] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  const bloqueo = useRef(false); // evita el doble envío por doble clic

  useEffect(() => {
    if (!db) { setEstado('sinRed'); return; }
    let vivo = true;
    getDoc(doc(db, COL_EVAL_CONFIG, DOC_ESTADO))
      .then(s => { if (vivo) setEstado(s.exists() && s.data().abierta === true ? 'abierta' : 'cerrada'); })
      .catch(() => { if (vivo) setEstado('sinRed'); });
    return () => { vivo = false; };
  }, []);

  const instrumento = grado ? instrumentoDeGrado(grado) : null;
  const preguntas = instrumento === 'A' ? PREGUNTAS_A : PREGUNTAS_B;
  const completas = preguntas.every((_, i) => !!resp[`p${i + 1}`]);

  async function enviar() {
    if (bloqueo.current || !grado || !db) return;
    const datos = armarDocumento(grado, sede, resp, comentario);
    if (!datos) { setError('Faltan respuestas por contestar.'); return; }
    bloqueo.current = true; setEnviando(true); setError('');
    try {
      await addDoc(collection(db, COL_EVAL), { ...datos, creado: serverTimestamp() });
      setEnviado(true);
    } catch {
      setError('No se pudo guardar. Revisa tu internet e inténtalo de nuevo.');
      bloqueo.current = false;
    } finally { setEnviando(false); }
  }

  function siguiente() { // modo aula: conserva grado y sede
    setResp({}); setComentario(''); setEnviado(false); setError(''); bloqueo.current = false;
    window.scrollTo({ top: 0 });
  }

  const tarjeta = 'rounded-2xl border border-line bg-card p-4 shadow-sm';
  const grande = 'min-h-[56px] rounded-xl border text-base font-semibold transition active:scale-[0.98]';
  const off = 'bg-card text-soft border-line hover:bg-elevated hover:text-strong';
  const on = 'bg-accent text-accent-fg border-accent';

  if (estado === 'cargando') return <Marco><p className="text-center text-soft">Cargando…</p></Marco>;
  if (estado === 'sinRed') return <Marco><p className={`${tarjeta} text-center text-soft`}>No se pudo conectar. Revisa tu internet y vuelve a abrir el enlace.</p></Marco>;
  if (estado === 'cerrada') return <Marco><p className={`${tarjeta} text-center text-strong text-lg`}>La evaluación no está abierta en este momento.</p></Marco>;

  if (enviado) {
    return (
      <Marco>
        <div className={`${tarjeta} text-center space-y-4`}>
          <p className="text-5xl" aria-hidden>🎉</p>
          <p className="text-xl font-bold text-strong">¡Gracias!</p>
          <p className="text-soft">Tu respuesta quedó guardada.</p>
          <button type="button" onClick={siguiente} className={`${grande} ${on} w-full`}>Siguiente niño</button>
          <button type="button" onClick={() => { setGrado(null); setSedeVista(false); setSede(null); siguiente(); }}
            className="text-sm text-muted underline">Cambiar grado</button>
        </div>
      </Marco>
    );
  }

  if (!grado) {
    return (
      <Marco>
        <section className={`${tarjeta} space-y-3`}>
          <h2 className="text-lg font-semibold text-strong">¿En qué grado estás?</h2>
          <div className="grid grid-cols-3 gap-2">
            {GRADOS.map(g => (
              <button key={g} type="button" onClick={() => setGrado(g)} className={`${grande} ${off} text-sm`}>
                {etiquetaGrado(g)}
              </button>
            ))}
          </div>
          <p className="text-xs text-muted">Esta encuesta es anónima: no pedimos tu nombre.</p>
        </section>
      </Marco>
    );
  }

  if (!sedeVista) {
    return (
      <Marco>
        <section className={`${tarjeta} space-y-3`}>
          <h2 className="text-lg font-semibold text-strong">¿En qué sede estudias? <span className="text-sm font-normal text-muted">(opcional)</span></h2>
          <div className="grid grid-cols-2 gap-2">
            {SEDES_EVAL.map(s => (
              <button key={s.id} type="button" onClick={() => { setSede(s.id); setSedeVista(true); }} className={`${grande} ${off}`}>{s.nombre}</button>
            ))}
          </div>
          <button type="button" onClick={() => { setSede(null); setSedeVista(true); }} className="text-sm text-muted underline">Omitir</button>
          <button type="button" onClick={() => setGrado(null)} className="block text-sm text-muted underline">← Cambiar grado</button>
        </section>
      </Marco>
    );
  }

  return (
    <Marco>
      <p className="text-center text-sm text-soft">
        Grado: <b className="text-strong">{etiquetaGrado(grado)}</b>{' · '}
        <button type="button" className="underline" onClick={() => { setGrado(null); setSedeVista(false); setSede(null); setResp({}); }}>cambiar</button>
      </p>
      {preguntas.map((q, i) => {
        const k = `p${i + 1}`;
        return (
          <section key={k} className={`${tarjeta} space-y-3`}>
            <h2 className="text-base font-semibold text-strong">{i + 1}. {q}</h2>
            {instrumento === 'A' ? (
              <div className="grid grid-cols-3 gap-2">
                {CARAS.map(c => (
                  <button key={c.v} type="button" aria-pressed={resp[k] === c.v} aria-label={c.t}
                    onClick={() => setResp(r => ({ ...r, [k]: c.v }))}
                    className={`min-h-[84px] rounded-xl border flex flex-col items-center justify-center gap-1 transition active:scale-[0.98] ${resp[k] === c.v ? 'bg-accent text-accent-fg border-accent ring-2 ring-accent' : off}`}>
                    <span className="text-4xl" aria-hidden>{c.e}</span>
                    <span className="text-xs">{c.t}</span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {([['si', 'Sí'], ['no', 'No']] as const).map(([v, t]) => (
                  <button key={v} type="button" aria-pressed={resp[k] === v}
                    onClick={() => setResp(r => ({ ...r, [k]: v }))}
                    className={`${grande} ${resp[k] === v ? on : off}`}>{t}</button>
                ))}
              </div>
            )}
          </section>
        );
      })}
      {instrumento === 'A' && (
        <section className={`${tarjeta} space-y-2`}>
          <h2 className="text-base font-semibold text-strong">5. {PREGUNTA_COMENTARIO_A} <span className="text-sm font-normal text-muted">(opcional)</span></h2>
          <input type="text" value={comentario} maxLength={MAX_COMENTARIO} onChange={e => setComentario(e.target.value)}
            className="w-full min-h-[48px] rounded-lg border border-line bg-card px-3 text-strong" placeholder="Escribe aquí (puede ayudarte tu profe)" />
          <p className="text-xs text-muted text-right">{comentario.length}/{MAX_COMENTARIO}</p>
        </section>
      )}
      {error && <p role="alert" className="rounded-lg bg-danger-soft text-danger-soft-fg p-3 text-sm">{error}</p>}
      <button type="button" disabled={!completas || enviando} onClick={enviar}
        className={`${grande} ${on} w-full disabled:opacity-40`}>
        {enviando ? 'Enviando…' : completas ? 'Enviar' : 'Responde todas las preguntas para enviar'}
      </button>
    </Marco>
  );
}
