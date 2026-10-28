// Página pública del plan de trabajo en casa (QR, sin login). Lee UN documento:
// planesCasaPublico/{token}. Solo primer nombre; nunca apellidos.
import { subpasos } from '../../data/planCasa/subpasos';
import { useEffect, useMemo, useRef, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { ExternalLink, Clock, PackageCheck, Upload, Link2, CheckCircle2, Camera } from 'lucide-react';
import { ACCEPT_ENTREGA, formatoTamano, validarArchivo, validarEnlace } from '../../data/planCasa/entregas';
import { prepararArchivo, subirEntrega } from '../../data/planCasa/entregasCliente';
import { db } from '../../lib/firebase';
import { COL_PUBLICO, MODALIDADES_SUSTENTACION, type FechaISO, type PlanPublico } from '../../data/planCasa/tipos';

type Paso = PlanPublico['pasos'][number];

const DIAS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
const DIAS_LARGO = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

const aFecha = (f: FechaISO) => new Date(`${f}T12:00:00`);
function aISO(d: Date): FechaISO {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
const hoyISO = () => aISO(new Date());
const sumarDias = (f: FechaISO, n: number) => { const d = aFecha(f); d.setDate(d.getDate() + n); return aISO(d); };
const diasEntre = (a: FechaISO, b: FechaISO) => Math.round((aFecha(b).getTime() - aFecha(a).getTime()) / 86400000);
const fechaLinda = (f: FechaISO) => { const d = aFecha(f); return `${DIAS_LARGO[d.getDay()]} ${d.getDate()} de ${MESES[d.getMonth()]}`; };

function cuenta(f: FechaISO, hoy: FechaISO): string {
  const n = diasEntre(hoy, f);
  if (n === 0) return 'hoy';
  if (n === 1) return 'mañana';
  if (n < 0) return `hace ${-n} días`;
  return `en ${n} días`;
}

const unidades = (m: number) => `≈ ${m * 25} min`;

export default function AgendaPlanPublica({ token, datos }: { token: string; datos?: PlanPublico }) {
  const [plan, setPlan] = useState<PlanPublico | null | undefined>(datos); // undefined=cargando, null=no existe
  const [sinRed, setSinRed] = useState(false);
  const [hoy] = useState(hoyISO);
  const [dia, setDia] = useState<FechaISO>(hoy);

  useEffect(() => {
    if (datos) { setPlan(datos); return; }
    if (!db) { setSinRed(true); setPlan(null); return; }
    let vivo = true;
    getDoc(doc(db, COL_PUBLICO, token))
      .then(s => { if (vivo) { setPlan(s.exists() ? (s.data() as PlanPublico) : null); setSinRed(false); } })
      .catch(() => { if (vivo) { setSinRed(true); setPlan(null); } });
    return () => { vivo = false; };
  }, [token, datos]);

  const marco = (hijo: React.ReactNode) => (
    <div className="min-h-screen flex flex-col items-center px-4 py-6">
      <div className="w-full max-w-md space-y-4">{hijo}</div>
    </div>
  );

  if (plan === undefined) {
    return marco(<div className="rounded-2xl border border-line bg-elevated/40 p-6 text-center text-base text-muted">Cargando tu plan…</div>);
  }
  if (plan === null) {
    return marco(
      <div className="rounded-2xl border border-line bg-card p-6 text-center space-y-2">
        <p className="text-lg font-semibold text-strong">
          {sinRed ? 'No pudimos conectarnos' : 'Este enlace no es válido o fue reemplazado'}
        </p>
        <p className="text-base text-soft">
          {sinRed ? 'Revisa tu conexión a internet y vuelve a abrir esta página.' : 'Pide un enlace nuevo a quien te lo entregó en el colegio.'}
        </p>
      </div>,
    );
  }
  return marco(<Contenido plan={plan} token={datos ? '' : token} hoy={hoy} dia={dia} setDia={setDia} />);
}

function Contenido({ plan, token, hoy, dia, setDia }: { plan: PlanPublico; token: string; hoy: FechaISO; dia: FechaISO; setDia: (f: FechaISO) => void }) {
  const delDia = useMemo(() => plan.pasos.filter(p => p.fecha === dia), [plan, dia]);
  const total = delDia.reduce((s, p) => s + p.momentos, 0);
  const esHoy = dia === hoy;

  const proximas = useMemo(() => {
    const tope = sumarDias(hoy, 7);
    return plan.pasos
      .filter(p => p.fecha && p.fecha >= hoy && p.fecha <= tope)
      .sort((a, b) => (a.fecha! < b.fecha! ? -1 : 1));
  }, [plan, hoy]);

  // Tira de la semana que contiene el día elegido (lunes a viernes).
  const semana = useMemo(() => {
    const d = aFecha(dia);
    const lunes = sumarDias(dia, -((d.getDay() + 6) % 7));
    return [0, 1, 2, 3, 4].map(i => sumarDias(lunes, i));
  }, [dia]);

  const sust = [...plan.sustentaciones].sort((a, b) => ((a.fecha ?? '9') < (b.fecha ?? '9') ? -1 : 1));

  return (
    <>
      <header className="flex items-center gap-3">
        <img src={`${import.meta.env.BASE_URL}mjb_escudo.png`} alt="Escudo MJB" className="w-10 h-10 object-contain" />
        <div className="flex-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Plan Académico Especial</p>
          <h1 className="text-xl font-bold text-strong leading-tight">Hola, {plan.primerNombre}</h1>
          <p className="text-sm text-muted">Grupo {plan.grupo} · {fechaLinda(plan.desde)} al {fechaLinda(plan.hasta)}</p>
        </div>
      </header>

      <nav aria-label="Semana" className="grid grid-cols-5 gap-1.5">
        {semana.map(f => {
          const n = plan.pasos.filter(p => p.fecha === f).length;
          const sel = f === dia;
          return (
            <button key={f} onClick={() => setDia(f)} aria-pressed={sel}
              className={`min-h-[56px] rounded-xl border text-center ${sel ? 'bg-accent text-accent-fg border-accent' : 'border-line bg-card text-soft'}`}>
              <div className="text-xs uppercase">{DIAS[aFecha(f).getDay()]}</div>
              <div className="text-base font-semibold">{aFecha(f).getDate()}</div>
              <div className="text-[10px]">{n ? `${n} paso${n > 1 ? 's' : ''}` : '·'}</div>
            </button>
          );
        })}
      </nav>

      <section className="space-y-3">
        <div className="flex items-baseline justify-between">
          <h2 className="text-lg font-bold text-strong">{esHoy ? 'Hoy' : fechaLinda(dia)}</h2>
          {total > 0 && <span className="text-sm text-soft">{total} {total === 1 ? 'momento' : 'momentos'} · {unidades(total)}</span>}
        </div>
        {delDia.length === 0 ? (
          <p className="rounded-2xl border border-line bg-card p-4 text-base text-soft">
            {esHoy ? 'Hoy no tienes pasos. ¡Buen descanso!' : 'Este día no tiene pasos.'}
          </p>
        ) : delDia.map(p => <TarjetaPaso key={`${p.asignatura}-${p.id}`} p={p} token={token} />)}
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-bold text-strong">Próximas entregas</h2>
        {proximas.length === 0 ? (
          <p className="text-base text-soft">No hay entregas en los próximos 7 días.</p>
        ) : (
          <ul className="rounded-2xl border border-line bg-card divide-y divide-line">
            {proximas.map(p => (
              <li key={`${p.asignatura}-${p.id}`} className="p-3 flex gap-3 items-start">
                <span className="text-sm font-semibold text-accent w-20 flex-shrink-0">{cuenta(p.fecha!, hoy)}</span>
                <span className="text-base text-strong leading-snug">
                  {p.asignatura}: {p.titulo}
                  {p.esEntregaParcial && <span className="ml-2 text-xs font-semibold px-2 py-0.5 rounded-full bg-accent text-accent-fg whitespace-nowrap">Entrega de la semana</span>}
                  <span className="block text-sm text-muted">{p.evidenciaDetalle}{p.canalEntrega ? ` · Entrega: ${p.canalEntrega}` : ''}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {sust.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-lg font-bold text-strong">Sustentaciones</h2>
          {sust.map((s, i) => (
            <div key={i} className="rounded-2xl border border-line bg-card p-4 space-y-2">
              <p className="text-base font-semibold text-strong">{s.asignatura}</p>
              <p className="text-base text-soft">
                {s.fecha ? `${fechaLinda(s.fecha)} (${cuenta(s.fecha, hoy)})` : 'Fecha por confirmar'}
                {s.hora ? ` · ${s.hora}` : ''} · {MODALIDADES_SUSTENTACION.find(m => m.id === s.modalidad)?.texto ?? 'Presencial'}
              </p>
              {s.lugarOEnlace && (/^https?:\/\//.test(s.lugarOEnlace)
                ? <a href={s.lugarOEnlace} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 min-h-[44px] px-4 rounded-xl bg-accent text-accent-fg text-base font-semibold">
                    Entrar a la sustentación <ExternalLink size={16} />
                  </a>
                : <p className="text-base text-soft">Lugar: {s.lugarOEnlace}</p>)}
              {s.preguntasGuia.length > 0 && (
                <div>
                  <p className="text-sm font-semibold text-strong">Preguntas para prepararte</p>
                  <ol className="list-decimal pl-5 text-base text-soft space-y-1">
                    {s.preguntasGuia.map((q, j) => <li key={j}>{q}</li>)}
                  </ol>
                </div>
              )}
            </div>
          ))}
        </section>
      )}

      <footer className="text-center text-xs text-muted pb-4">I.E. Manuel J. Betancur · Un paso a la vez, tú puedes.</footer>
    </>
  );
}

function TarjetaPaso({ p, token }: { p: Paso; token: string }) {
  return (
    <article className="rounded-2xl border border-line bg-card p-4 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold text-accent">{p.asignatura}</p>
        <span className="flex items-center gap-1 text-sm text-soft whitespace-nowrap">
          <Clock size={14} /> {p.momentos} {p.momentos === 1 ? 'momento' : 'momentos'} {unidades(p.momentos)}
        </span>
      </div>
      {p.esEntregaParcial && (
        <p className="inline-flex items-center gap-1.5 rounded-full bg-accent text-accent-fg text-sm font-semibold px-3 py-1">
          <PackageCheck size={16} /> Entrega de la semana{p.semana ? ' ' + p.semana : ''}
        </p>
      )}
      <h3 className="text-lg font-bold text-strong leading-snug">{p.titulo}</h3>
      <ol className="list-decimal pl-5 space-y-1.5 text-base text-soft leading-relaxed">
        {subpasos(p.instrucciones).map((s, i) => <li key={i}>{s}</li>)}
      </ol>
      <p className="text-base text-strong rounded-xl bg-elevated/60 px-3 py-2">
        <b>Qué entregas:</b> {p.evidenciaDetalle}
        {p.canalEntrega && <span className="block"><b>Cómo lo entregas:</b> {p.canalEntrega}</span>}
      </p>
      {p.enlaces && p.enlaces.length > 0 && (
        <div className="flex flex-wrap gap-2 pt-1">
          {p.enlaces.map((e, i) => (
            <a key={i} href={e.url} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 min-h-[44px] px-4 rounded-xl border border-accent/50 text-accent text-base font-semibold">
              {e.nombre || 'Abrir material'} <ExternalLink size={16} />
            </a>
          ))}
        </div>
      )}
      {token && p.guiaId && <Entregar p={p} token={token} />}
    </article>
  );
}

const fechaHora = (ms: number) => {
  const d = new Date(ms);
  return `${DIAS_LARGO[d.getDay()]} ${d.getDate()} de ${MESES[d.getMonth()]}, ${d.toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit' })}`;
};

type FaseEntrega = 'quieto' | 'elegido' | 'enviando' | 'ok';

/** Botón «Entregar»: foto (cámara), audio o PDF; o un enlace para los videos. */
function Entregar({ p, token }: { p: Paso; token: string }) {
  const [entregadoEn, setEntregadoEn] = useState<number | undefined>(p.entregadoEn);
  const [fase, setFase] = useState<FaseEntrega>('quieto');
  const [archivo, setArchivo] = useState<File | null>(null);
  const [vista, setVista] = useState('');
  const [modoEnlace, setModoEnlace] = useState(false);
  const [enlace, setEnlace] = useState('');
  const [error, setError] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const camara = useRef<HTMLInputElement>(null);

  useEffect(() => { setEntregadoEn(p.entregadoEn); }, [p.entregadoEn]);
  useEffect(() => () => { if (vista) URL.revokeObjectURL(vista); }, [vista]);

  function reiniciar() {
    setArchivo(null); setVista(''); setError(''); setEnlace(''); setModoEnlace(false); setFase('quieto');
    if (input.current) input.current.value = '';
    if (camara.current) camara.current.value = '';
  }
  function elegir(f: File | undefined) {
    setError('');
    if (!f) return;
    // Las fotos se reducen antes de enviar: aquí solo se aplica el tope a audios y PDF.
    const v = validarArchivo(f.name, f.type, f.type.startsWith('image/') ? Math.min(f.size, 1) : f.size);
    if (!v.ok) { setError(v.error); return; }
    setArchivo(f);
    setVista(f.type.startsWith('image/') || f.type.startsWith('audio/') ? URL.createObjectURL(f) : '');
    setFase('elegido');
  }
  async function enviar() {
    setError('');
    if (typeof navigator !== 'undefined' && navigator.onLine === false) { setError('Sin conexión a internet. Conéctate y vuelve a intentarlo.'); return; }
    let contenido: Parameters<typeof subirEntrega>[1];
    if (modoEnlace) {
      const v = validarEnlace(enlace);
      if (!v.ok) { setError(v.error); return; }
      contenido = { enlace: v.url };
    } else {
      if (!archivo) return;
      setFase('enviando');
      const prep = await prepararArchivo(archivo);
      const v = validarArchivo(prep.nombre, prep.contentType, prep.blob.size);
      if (!v.ok) { setError(v.error); setFase('elegido'); return; }
      contenido = prep;
    }
    setFase('enviando');
    const r = await subirEntrega({ token, guiaId: p.guiaId!, pasoId: p.id }, contenido);
    if (!r.ok) { setError(r.error ?? 'No se pudo enviar.'); setFase(modoEnlace ? 'quieto' : 'elegido'); return; }
    setEntregadoEn(r.entregadoEn);
    setArchivo(null); setVista(''); setEnlace(''); setModoEnlace(false); setFase('ok');
    if (input.current) input.current.value = '';
  }

  const boton = 'inline-flex items-center justify-center gap-1.5 min-h-[44px] px-4 rounded-xl text-base font-semibold';
  return (
    <div className="pt-2 space-y-2 border-t border-line">
      {entregadoEn && (
        <p className="flex items-center gap-1.5 text-base font-semibold text-green-600 dark:text-green-400">
          <CheckCircle2 size={18} /> Entregado el {fechaHora(entregadoEn)}
        </p>
      )}
      <input ref={input} type="file" accept={ACCEPT_ENTREGA} className="hidden"
        onChange={e => elegir(e.target.files?.[0])} aria-label="Elegir archivo para entregar" />
      {/* `capture` abre la cámara directamente; el otro input deja elegir audio o PDF. */}
      <input ref={camara} type="file" accept="image/*" capture="environment" className="hidden"
        onChange={e => elegir(e.target.files?.[0])} aria-label="Tomar foto para entregar" />
      {fase !== 'elegido' && fase !== 'enviando' && !modoEnlace && (
        <div className="flex flex-wrap gap-2">
          <button onClick={() => input.current?.click()} className={`${boton} bg-accent text-accent-fg`}>
            <Upload size={18} /> {entregadoEn ? 'Enviar otra versión' : 'Entregar'}
          </button>
          <button onClick={() => camara.current?.click()} className={`${boton} border border-accent/50 text-accent`}>
            <Camera size={18} /> Tomar foto
          </button>
          <button onClick={() => { setModoEnlace(true); setError(''); }} className={`${boton} border border-line text-soft`}>
            <Link2 size={18} /> Pegar enlace (video)
          </button>
        </div>
      )}
      {modoEnlace && fase !== 'enviando' && (
        <div className="space-y-2">
          <input value={enlace} onChange={e => setEnlace(e.target.value)} inputMode="url" placeholder="https://drive.google.com/… o https://youtu.be/…"
            className="w-full min-h-[44px] rounded-xl border border-line bg-card px-3 text-base text-strong" />
          <div className="flex gap-2">
            <button onClick={enviar} className={`${boton} bg-accent text-accent-fg`}>Enviar enlace</button>
            <button onClick={reiniciar} className={`${boton} border border-line text-soft`}>Cancelar</button>
          </div>
        </div>
      )}
      {archivo && (fase === 'elegido' || fase === 'enviando') && (
        <div className="space-y-2 rounded-xl bg-elevated/60 p-3">
          {vista && archivo.type.startsWith('image/') && <img src={vista} alt="Vista previa" className="max-h-56 rounded-lg mx-auto" />}
          {vista && archivo.type.startsWith('audio/') && <audio src={vista} controls className="w-full" />}
          <p className="text-sm text-soft break-all">{archivo.name} · {formatoTamano(archivo.size)}</p>
          {fase === 'elegido' && (
            <div className="flex gap-2">
              <button onClick={enviar} className={`${boton} bg-accent text-accent-fg`}>Enviar</button>
              <button onClick={reiniciar} className={`${boton} border border-line text-soft`}>Cancelar</button>
            </div>
          )}
        </div>
      )}
      {fase === 'enviando' && (
        <div role="status" className="space-y-1">
          <p className="text-base text-soft">Enviando… no cierres esta página.</p>
          <div className="h-2 rounded-full bg-elevated overflow-hidden"><div className="h-full w-1/3 bg-accent animate-pulse" /></div>
        </div>
      )}
      {fase === 'ok' && <p role="status" className="text-base text-strong">¡Listo! Tu docente ya puede verlo.</p>}
      {error && <p role="alert" className="text-base text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}

