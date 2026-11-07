// Página pública del plan de trabajo en casa (QR, sin login). Lee UN documento:
// planesCasaPublico/{token}. Solo primer nombre; nunca apellidos.
// Se usa en el celular: navegación por pestañas (Hoy · Semana · Mes · Mis guías · Entregas).
import { subpasos } from '../../data/planCasa/subpasos';
import { aFecha, aISO, agruparPorDia, diasEntre, semanaDe } from '../../data/planCasa/calendarioAgenda';
import { pendientesPorDia, textoEntre, textoVentana } from '../../data/planCasa/ventanaSustentacion';
import { hayQueEntregar, medioEntrega, partirEtiquetaGuia } from '../../data/planCasa/integrada';
import { VistaMes, VistaSemana, colorGuia } from './VistasCalendario';
import { useEffect, useMemo, useRef, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { ExternalLink, Clock, PackageCheck, Upload, Link2, CheckCircle2, Camera } from 'lucide-react';
import { ACCEPT_ENTREGA, formatoTamano, validarArchivo, validarEnlace } from '../../data/planCasa/entregas';
import { prepararArchivo, registrarRechazo, subirEntrega } from '../../data/planCasa/entregasCliente';
import { BotonSugerencias, ComoMeFue, Manual, HoraDeEstudio, PildoraDelDia, Sugerencias, TemporizadorMomento, useHorarioEstudio } from './OrientacionFamilia';
import { BotonesConsulta, ComoEnviar } from './ConsultasFamilia';
import { db } from '../../lib/firebase';
import { cn } from '@/lib/utils';
import { SUGERENCIAS, guardarHechos, leerHechos, pildoraDelDia, progresoDia } from '../../data/planCasa/orientacionFamilia';
import { RespiracionGuiada } from '../RespiracionGuiada';
import { COL_PUBLICO, MODALIDADES_SUSTENTACION, type FechaISO, type PlanPublico } from '../../data/planCasa/tipos';

type Paso = PlanPublico['pasos'][number];

const DIAS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
const DIAS_LARGO = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

const hoyISO = () => aISO(new Date());
const fechaLinda = (f: FechaISO) => { const d = aFecha(f); return `${DIAS_LARGO[d.getDay()]} ${d.getDate()} de ${MESES[d.getMonth()]}`; };
const fechaCorta = (f: FechaISO) => `${aFecha(f).getDate()} ${MESES[aFecha(f).getMonth()]}`;

function cuenta(f: FechaISO, hoy: FechaISO): string {
  const n = diasEntre(hoy, f);
  if (n === 0) return 'hoy';
  if (n === 1) return 'mañana';
  if (n < 0) return `hace ${-n} días`;
  return `en ${n} días`;
}

const unidades = (m: number) => `≈ ${m * 25} min`;

type Pestana = 'hoy' | 'semana' | 'mes' | 'guias' | 'entregas';
const PESTANAS: Pestana[] = ['hoy', 'semana', 'mes', 'guias', 'entregas'];
const CLAVE_VISTA = 'agendaPlanVista';
function pestanaGuardada(): Pestana {
  try {
    const v = localStorage.getItem(CLAVE_VISTA);
    if (v === 'dia') return 'hoy'; // valor de la versión anterior
    if (v && (PESTANAS as string[]).includes(v)) return v as Pestana;
  } catch { /* sin almacenamiento: pestaña por defecto */ }
  return 'hoy';
}

/**
 * `hoy` (opcional) sustituye a la fecha real en TODA la página: cuentas regresivas, atrasos,
 * día elegido y «Entregado». Lo usa la agenda de demostración. Con `datos` no se lee Firestore.
 */
export default function AgendaPlanPublica({ token, datos, hoy: hoyForzado }: { token: string; datos?: PlanPublico; hoy?: FechaISO }) {
  const [plan, setPlan] = useState<PlanPublico | null | undefined>(datos); // undefined=cargando, null=no existe
  const [sinRed, setSinRed] = useState(false);
  const [hoyReal] = useState(hoyISO);
  const hoy = hoyForzado ?? hoyReal;
  const [dia, setDia] = useState<FechaISO>(hoy);
  const [pestana, setPestanaEstado] = useState<Pestana>(pestanaGuardada);
  const setPestana = (v: Pestana) => {
    setPestanaEstado(v);
    try { localStorage.setItem(CLAVE_VISTA, v); } catch { /* ignorar */ }
  };

  // Si «hoy» simulado cambia, la agenda salta a ese día.
  useEffect(() => { setDia(hoy); }, [hoy]);

  useEffect(() => {
    if (datos) { setPlan(datos); return; }
    if (!db) { setSinRed(true); setPlan(null); return; }
    let vivo = true;
    getDoc(doc(db, COL_PUBLICO, token))
      .then(s => { if (vivo) { setPlan(s.exists() ? (s.data() as PlanPublico) : null); setSinRed(false); } })
      .catch(() => { if (vivo) { setSinRed(true); setPlan(null); } });
    return () => { vivo = false; };
  }, [token, datos]);

  // Con fecha simulada, lo «entregado» después de esa fecha todavía no ha ocurrido.
  const planVisto = useMemo(() => {
    if (!plan || !hoyForzado) return plan;
    const pendiente = (ms?: number) => !!ms && aISO(new Date(ms)) > hoyForzado;
    return {
      ...plan,
      pasos: plan.pasos.map(p => {
        if (!pendiente(p.entregadoEn)) return p;
        const { entregadoEn: _e, revisado: _r, comentario: _c, ...resto } = p;
        return { ...resto, componentes: p.componentes?.map(c => ({ ...c, revisado: false, comentario: undefined })) };
      }),
    };
  }, [plan, hoyForzado]);

  const ancho = pestana === 'semana' || pestana === 'mes' ? 'max-w-3xl' : 'max-w-md';
  const marco = (hijo: React.ReactNode) => (
    <div className="min-h-screen flex flex-col items-center px-4 py-6">
      <div className={`w-full ${ancho} space-y-4`}>{hijo}</div>
    </div>
  );

  if (planVisto === undefined) {
    return marco(<div className="rounded-2xl border border-line bg-elevated/40 p-6 text-center text-base text-muted">Cargando tu plan…</div>);
  }
  if (planVisto === null) {
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
  return marco(<Contenido plan={planVisto} token={datos ? '' : token} hoy={hoy} dia={dia} setDia={setDia} pestana={pestana} setPestana={setPestana} />);
}

interface InfoGuia {
  clave: string; etiqueta: string; eje: string; materias: string[]; indice: number; pasos: Paso[];
  entregables: Paso[]; entregados: number;
}

/** Las entregas de una guía: las parciales; si no tiene ninguna, todo paso con algo que entregar. */
function marcarEntregables(pasos: Paso[]): Paso[] {
  const parciales = pasos.filter(p => p.esEntregaParcial);
  return parciales.length ? parciales : pasos.filter(p => p.guiaId && hayQueEntregar(p));
}

const claveGuia = (p: Paso) => p.guiaId ?? p.asignatura;
/** Clave estable de un paso en un día (para la lista de chequeo). */
const clavePaso = (dia: FechaISO, p: Paso) => `${dia}|${p.guiaId ?? p.asignatura}|${p.id}`;

function Contenido({ plan, token, hoy, dia, setDia, pestana, setPestana }: { plan: PlanPublico; token: string; hoy: FechaISO; dia: FechaISO; setDia: (f: FechaISO) => void; pestana: Pestana; setPestana: (v: Pestana) => void }) {
  const delDia = useMemo(() => plan.pasos.filter(p => p.fecha === dia), [plan, dia]);
  const total = delDia.reduce((s, p) => s + p.momentos, 0);
  const esHoy = dia === hoy;
  const totalHoy = useMemo(() => plan.pasos.filter(p => p.fecha === hoy).reduce((s, p) => s + p.momentos, 0), [plan, hoy]);
  const horario = useHorarioEstudio(token, hoy); // token vacío = demostración
  const [hechos, setHechos] = useState(() => leerHechos(token));
  const [verSugerencias, setVerSugerencias] = useState(false);
  const [verManual, setVerManual] = useState(false);

  // Guías en el orden en que aparecen; cada una con su color.
  const guias = useMemo<InfoGuia[]>(() => {
    const mapa = new Map<string, Paso[]>();
    for (const p of plan.pasos) mapa.set(claveGuia(p), [...(mapa.get(claveGuia(p)) ?? []), p]);
    return [...mapa.entries()].map(([clave, pasos], indice) => {
      const etiqueta = pasos[0].asignatura;
      const { eje, materias } = partirEtiquetaGuia(etiqueta);
      const entregables = marcarEntregables(pasos);
      return { clave, etiqueta, eje, materias, indice, pasos, entregables, entregados: entregables.filter(p => p.entregadoEn).length };
    });
  }, [plan]);
  const guiaDe = useMemo(() => new Map(guias.map(g => [g.clave, g])), [guias]);
  const colorDeAsignatura = useMemo(() => {
    const m = new Map<string, number>();
    for (const g of guias) if (!m.has(g.etiqueta)) m.set(g.etiqueta, g.indice);
    return (a: string) => { const c = colorGuia(m.get(a) ?? 0); return { fondo: c.fondo, borde: c.borde }; };
  }, [guias]);

  // Entregas: atrasadas primero y luego las próximas; las ya entregadas al final.
  const entregas = useMemo(() => {
    const todas = guias.flatMap(g => g.entregables).filter(p => p.fecha);
    const orden = (a: Paso, b: Paso) => (a.fecha! < b.fecha! ? -1 : a.fecha! > b.fecha! ? 1 : 0);
    const pend = todas.filter(p => !p.entregadoEn).sort(orden);
    return {
      atrasadas: pend.filter(p => p.fecha! < hoy),
      proximas: pend.filter(p => p.fecha! >= hoy),
      hechas: todas.filter(p => p.entregadoEn).sort(orden),
    };
  }, [guias, hoy]);
  const nProximas = entregas.atrasadas.length + entregas.proximas.length;

  // Tira de la semana que contiene el día elegido (lunes a viernes).
  const semana = useMemo(() => semanaDe(dia).slice(0, 5), [dia]);
  const porDia = useMemo(() => agruparPorDia(plan.pasos), [plan]);
  // Las sustentaciones sin fecha se avisan en cada día de la ventana institucional.
  const sustPorDia = useMemo(() => agruparPorDia(plan.sustentaciones.filter(s => s.fecha)), [plan]);
  const pendPorDia = useMemo(() => pendientesPorDia(plan.sustentaciones), [plan]);
  const pendDelDia = pendPorDia[dia] ?? [];
  const irADia = (f: FechaISO) => { setDia(f); setPestana('hoy'); };

  const sust = [...plan.sustentaciones].sort((a, b) => ((a.fecha ?? '9') < (b.fecha ?? '9') ? -1 : 1));
  const tabs: { id: Pestana; texto: string }[] = [
    { id: 'hoy', texto: 'Hoy' }, { id: 'semana', texto: 'Semana' }, { id: 'mes', texto: 'Mes' },
    { id: 'guias', texto: 'Mis guías' }, { id: 'entregas', texto: nProximas ? `Entregas (${nProximas})` : 'Entregas' },
  ];

  return (
    <>
      <header className="flex items-center gap-3">
        <img src={`${import.meta.env.BASE_URL}mjb_escudo.png`} alt="Escudo MJB" className="w-10 h-10 object-contain" />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Plan Académico Especial</p>
          <h1 className="text-xl font-bold text-strong leading-tight">Hola, {plan.primerNombre}</h1>
          <p className="text-sm text-muted">
            Grupo {plan.grupo} · {fechaCorta(plan.desde)} – {fechaCorta(plan.hasta)}
            {' · '}{totalHoy > 0 ? `hoy ${totalHoy} ${totalHoy === 1 ? 'momento' : 'momentos'} (${unidades(totalHoy)})` : 'hoy sin pasos'}
          </p>
        </div>
        <button onClick={() => setVerManual(true)} aria-label="Manual de la agenda"
          className="flex-shrink-0 inline-flex items-center gap-1 min-h-[40px] px-3 rounded-full border border-sky-500/40 bg-sky-500/10 text-sm font-semibold text-strong">
          📖 Manual
        </button>
      </header>
      <div className="flex flex-wrap gap-2"><BotonesConsulta token={token} /></div>
      {verManual && <Manual onCerrar={() => setVerManual(false)} desde={plan.desde} hasta={plan.hasta} />}

      <div><BotonSugerencias onClick={() => setVerSugerencias(true)} /></div>
      {verSugerencias && <Sugerencias onCerrar={() => setVerSugerencias(false)} />}

      <nav role="tablist" aria-label="Secciones" className="flex gap-1.5 overflow-x-auto -mx-1 px-1 pb-1">
        {tabs.map(t => {
          const sel = pestana === t.id;
          return (
            <button key={t.id} role="tab" aria-selected={sel} onClick={() => setPestana(t.id)}
              className={`min-h-[44px] px-4 rounded-full border text-base whitespace-nowrap flex-shrink-0 ${sel ? 'bg-accent/20 border-accent/60 text-strong font-semibold' : 'bg-card border-line text-soft'}`}>
              {t.texto}
            </button>
          );
        })}
      </nav>

      {pestana === 'semana' && <VistaSemana plan={plan} hoy={hoy} dia={dia} setDia={setDia} porDia={porDia} sustPorDia={sustPorDia} pendPorDia={pendPorDia} color={colorDeAsignatura} irADia={irADia} horaDe={horario.horaDe} />}
      {pestana === 'mes' && <VistaMes plan={plan} hoy={hoy} dia={dia} porDia={porDia} sustPorDia={sustPorDia} pendPorDia={pendPorDia} irADia={irADia} />}

      {pestana === 'hoy' && <>
        <nav aria-label="Semana" className="grid grid-cols-5 gap-1.5">
          {semana.map(f => {
            const n = plan.pasos.filter(p => p.fecha === f).length;
            const sel = f === dia;
            return (
              <button key={f} onClick={() => setDia(f)} aria-pressed={sel}
                className={`min-h-[56px] rounded-xl border text-center ${sel ? 'bg-accent/20 border-accent/60 text-strong' : 'border-line bg-card text-soft'}`}>
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
          {pendDelDia.length > 0 && <AvisoSustentaciones areas={pendDelDia} />}
          {total > 0 && <HoraDeEstudio h={horario} dia={dia} esHoy={esHoy} momentos={total} />}
          {total > 0 && (() => {
            const pr = progresoDia(delDia.map(p => ({ key: clavePaso(dia, p), momentos: p.momentos })), hechos);
            return (
              <div className="rounded-2xl border border-success/40 bg-success/10 p-3 space-y-1.5" aria-live="polite">
                <p className="text-sm font-semibold text-strong">{pr.hechos === pr.total ? '🎉 ¡Terminaste todo lo de este día!' : `Mi lista de ${esHoy ? 'hoy' : 'este día'}: ${pr.hechos} de ${pr.total} ${pr.total === 1 ? 'momento hecho' : 'momentos hechos'}`}</p>
                <div className="h-2 rounded-full bg-card/60 overflow-hidden"><div className="h-full bg-success transition-all" style={{ width: `${pr.total ? Math.round((pr.hechos / pr.total) * 100) : 0}%` }} /></div>
                <p className="text-xs text-soft">Tacha cada momento en su tarjeta cuando lo termines.</p>
              </div>);
          })()}
          {delDia.length === 0 ? (
            <p className="rounded-2xl border border-line bg-card p-4 text-base text-soft">
              {esHoy ? 'Hoy no tienes pasos. ¡Buen descanso!' : 'Este día no tiene pasos.'}
            </p>
          ) : delDia.map(p => (
            <TarjetaPaso key={`${dia}-${p.asignatura}-${p.id}`} p={p} token={token} hoy={hoy}
              guia={guiaDe.get(claveGuia(p))} abierta={delDia.length === 1}
              hechos={hechos[clavePaso(dia, p)] ?? 0} onHechos={n => setHechos(guardarHechos(token, clavePaso(dia, p), n))} />
          ))}
        </section>

        {esHoy && (
          <section className="space-y-3" aria-label="Para estudiar mejor">
            <PildoraDelDia fecha={hoy} clave={token} abrirSugerencias={() => setVerSugerencias(true)} />
            {total > 0 && (() => {
              const cuerpo = SUGERENCIAS.filter(x => x.grupo === 'cuerpo');
              const sug = pildoraDelDia(hoy, cuerpo, token + 'cuerpo');
              return (
                <div className="rounded-2xl border border-sky-500/40 bg-sky-500/10 p-4 space-y-3">
                  <p className="text-sm font-semibold text-strong">🌬️ Antes de empezar: {sug.titulo}</p>
                  <p className="text-sm text-soft">{sug.texto}</p>
                  <RespiracionGuiada sinAvisoEmergencia tecnicas={['larga', 'suspiro', 'coherente']} subtitulo="Respira largo o suspira junto a la pantalla · 1 a 3 minutos" />
                </div>);
            })()}
            {total > 0 && (() => {
              const claves = delDia.map(p => ({ key: clavePaso(dia, p), momentos: p.momentos }));
              const pr = progresoDia(claves, hechos);
              const tachar = () => {
                const sig = claves.find(c => (hechos[c.key] ?? 0) < c.momentos);
                if (sig) setHechos(guardarHechos(token, sig.key, (hechos[sig.key] ?? 0) + 1));
              };
              return <TemporizadorMomento total={pr.total} hechos={pr.hechos} onTachar={tachar}
                extraPausa={<RespiracionGuiada sinAvisoEmergencia tecnicas={['larga', 'suspiro', 'coherente']} subtitulo="Respira un minuto en la pausa" />} />;
            })()}
            {total > 0 && <ComoMeFue clave={token} fecha={hoy} />}
          </section>
        )}
      </>}

      {pestana === 'guias' && (
        <section className="space-y-3" aria-label="Mis guías">
          {guias.map(g => {
            const c = colorGuia(g.indice);
            const n = g.entregables.length;
            const pct = n ? Math.round((g.entregados / n) * 100) : 0;
            return (
              <article key={g.clave} style={{ background: c.fondo, borderColor: c.borde }} className="rounded-2xl border p-4 space-y-2">
                <h2 className="text-lg font-bold text-strong leading-snug">{g.eje || g.materias.join(' · ')}</h2>
                {g.eje && (
                  <div className="flex flex-wrap gap-1.5">
                    {g.materias.map(m => <span key={m} style={{ background: c.chip }} className="text-xs font-semibold text-strong rounded-full px-2 py-0.5">{m}</span>)}
                  </div>
                )}
                <p className="text-sm text-soft">{g.pasos.length} {g.pasos.length === 1 ? 'paso' : 'pasos'} · {g.pasos.reduce((s, p) => s + p.momentos, 0)} momentos</p>
                {n > 0 && (
                  <div className="space-y-1">
                    <div className="h-2 rounded-full bg-elevated/70 overflow-hidden" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Avance">
                      <div className="h-full" style={{ width: `${pct}%`, background: c.borde }} />
                    </div>
                    <p className="text-sm text-soft">{g.entregados} de {n} {n === 1 ? 'entrega' : 'entregas'} · {pct}% de avance</p>
                  </div>
                )}
              </article>
            );
          })}
        </section>
      )}

      {pestana === 'entregas' && <>
        <section className="space-y-2" aria-label="Entregas">
          {nProximas === 0 && <p className="rounded-2xl border border-line bg-card p-4 text-base text-soft">No tienes entregas pendientes. ¡Bien hecho!</p>}
          {entregas.atrasadas.length > 0 && <h2 className="text-base font-bold text-warning-soft-fg">Atrasadas</h2>}
          {entregas.atrasadas.map(p => <FilaEntrega key={`${p.guiaId}-${p.id}`} p={p} g={guiaDe.get(claveGuia(p))} hoy={hoy} atrasada irADia={irADia} />)}
          {entregas.proximas.length > 0 && <h2 className="text-base font-bold text-strong">Próximas entregas</h2>}
          {entregas.proximas.map(p => <FilaEntrega key={`${p.guiaId}-${p.id}`} p={p} g={guiaDe.get(claveGuia(p))} hoy={hoy} irADia={irADia} />)}
          {entregas.hechas.length > 0 && <h2 className="text-base font-bold text-strong pt-2">Ya entregadas</h2>}
          {entregas.hechas.map(p => <FilaEntrega key={`${p.guiaId}-${p.id}`} p={p} g={guiaDe.get(claveGuia(p))} hoy={hoy} hecha irADia={irADia} />)}
        </section>

        {sust.length > 0 && (
          <section className="space-y-2">
            <h2 className="text-lg font-bold text-strong">Sustentaciones</h2>
            {sust.map((s, i) => (
              <div key={i} className="rounded-2xl border border-line bg-card p-4 space-y-2">
                <p className="text-base font-semibold text-strong">{s.asignatura}</p>
                <p className="text-base text-soft">
                  {s.fecha ? `${fechaLinda(s.fecha)} (${cuenta(s.fecha, hoy)})` : `${textoEntre()} · fecha y hora por confirmar`}
                  {s.hora ? ` · ${s.hora}` : ''} · {MODALIDADES_SUSTENTACION.find(m => m.id === s.modalidad)?.texto ?? 'Presencial'}
                </p>
                {s.lugarOEnlace && (/^https?:\/\//.test(s.lugarOEnlace)
                  ? <a href={s.lugarOEnlace} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 min-h-[44px] px-4 rounded-xl bg-accent/20 border border-accent/60 text-strong text-base font-semibold">
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
      </>}

      <footer className="text-center text-xs text-muted pb-4">I.E. Manuel J. Betancur · Un paso a la vez, tú puedes.</footer>
    </>
  );
}

/** Una entrega en la lista: al tocarla se abre ese día en «Hoy». */
function FilaEntrega({ p, g, hoy, atrasada, hecha, irADia }: { p: Paso; g?: InfoGuia; hoy: FechaISO; atrasada?: boolean; hecha?: boolean; irADia: (f: FechaISO) => void }) {
  const c = colorGuia(g?.indice ?? 0);
  const n = p.fecha ? diasEntre(p.fecha, hoy) : 0;
  const cuando = hecha ? 'entregada' : atrasada ? `venció ${n === 1 ? 'ayer' : `hace ${n} días`}` : cuenta(p.fecha!, hoy);
  return (
    <button onClick={() => irADia(p.fecha!)}
      style={atrasada ? undefined : { background: c.fondo, borderColor: c.borde }}
      className={`w-full text-left rounded-2xl border p-3 space-y-0.5 min-h-[56px] ${atrasada ? 'bg-warning/10 border-warning/40' : ''} ${hecha ? 'opacity-70' : ''}`}>
      <span className={`block text-sm font-semibold ${atrasada ? 'text-warning-soft-fg' : 'text-accent'}`}>{hecha ? '✓ ' : ''}{cuando}{p.fecha ? ` · ${fechaLinda(p.fecha)}` : ''}</span>
      <span className="block text-base font-semibold text-strong leading-snug">{p.titulo}</span>
      <span className="block text-sm text-soft">{g?.materias.join(' · ') ?? p.asignatura}{p.evidenciaDetalle ? ` · ${p.evidenciaDetalle}` : ''}</span>
    </button>
  );
}

/** Aviso de la semana de sustentaciones para las áreas que aún no tienen fecha. */
export function AvisoSustentaciones({ areas }: { areas: string[] }) {
  return (
    <div role="note" className="rounded-2xl border border-accent/40 bg-accent/10 p-3 space-y-1">
      <p className="text-base font-semibold text-strong">🎤 Semana de sustentaciones ({textoVentana()}) — fecha y hora por confirmar</p>
      <p className="text-sm text-soft">Áreas pendientes: {areas.join(' · ')}</p>
    </div>
  );
}

/** Tarjeta compacta con velo del color de su guía; el detalle queda plegado bajo «Ver instrucciones». */
function TarjetaPaso({ p, token, hoy, guia, abierta, hechos, onHechos }: { p: Paso; token: string; hoy: FechaISO; guia?: InfoGuia; abierta: boolean; hechos: number; onHechos: (n: number) => void }) {
  const [entregadoEn, setEntregadoEn] = useState<number | undefined>(p.entregadoEn);
  useEffect(() => { setEntregadoEn(p.entregadoEn); }, [p.entregadoEn]);
  const c = colorGuia(guia?.indice ?? 0);
  const entrega = hayQueEntregar(p);
  const atraso = p.fecha && p.guiaId && !entregadoEn && entrega && p.fecha < hoy ? diasEntre(p.fecha, hoy) : 0;
  const materias = guia?.materias ?? [p.asignatura];
  return (
    <article style={{ background: c.fondo, borderColor: c.borde }} className="rounded-2xl border p-4 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-wrap gap-1.5 min-w-0">
          {materias.map(m => <span key={m} style={{ background: c.chip }} className="text-xs font-semibold text-strong rounded-full px-2 py-0.5">{m}</span>)}
        </div>
        <span className="flex items-center gap-1 text-sm text-soft whitespace-nowrap">
          <Clock size={14} /> {p.momentos} {p.momentos === 1 ? 'momento' : 'momentos'}
        </span>
      </div>
      {guia?.eje && <p className="text-sm text-muted truncate" title={guia.eje}>{guia.eje}</p>}
      <h3 className={cn('text-lg font-bold leading-snug', hechos >= p.momentos ? 'text-soft line-through' : 'text-strong')}>{p.titulo}</h3>
      <div className="flex flex-wrap gap-1.5" aria-label="Momentos hechos">
        {Array.from({ length: p.momentos }, (_, i) => {
          const ok = i < hechos;
          return (
            <button key={i} type="button" onClick={() => onHechos(ok ? i : i + 1)} aria-pressed={ok}
              className={cn('min-h-[40px] inline-flex items-center gap-1.5 rounded-full border px-3 text-sm transition',
                ok ? 'bg-success/15 border-success/50 text-strong line-through' : 'bg-card/50 border-line text-soft hover:text-strong')}>
              <span aria-hidden>{ok ? '☑' : '☐'}</span> Momento {i + 1}
            </button>);
        })}
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        {p.esEntregaParcial && (
          <span className="inline-flex items-center gap-1 rounded-full bg-warning/10 border border-warning/40 text-warning-soft-fg text-xs font-semibold px-2.5 py-0.5">
            <PackageCheck size={14} /> Entrega de la semana{p.semana ? ' ' + p.semana : ''}
          </span>
        )}
        {entregadoEn && <span className="inline-flex items-center gap-1 rounded-full bg-success-soft text-success-soft-fg text-xs font-semibold px-2.5 py-0.5"><CheckCircle2 size={14} /> Entregado</span>}
        {p.revisado && <span className="inline-flex items-center rounded-full bg-success-soft text-success-soft-fg text-xs font-semibold px-2.5 py-0.5">✓ Revisado</span>}
      </div>
      {atraso > 0 && (
        <p className="rounded-xl bg-warning/10 border border-warning/40 text-warning-soft-fg px-3 py-1.5 text-sm font-semibold">
          Sin entregar · venció {atraso === 1 ? 'ayer' : `hace ${atraso} días`}. ¡Aún puedes enviarlo!
        </p>
      )}
      <details open={abierta} className="group rounded-xl border border-line/60 bg-card/50 px-3">
        <summary className="cursor-pointer min-h-[44px] flex items-center justify-between text-base font-semibold text-accent list-none">
          <span>Ver instrucciones</span><span aria-hidden className="group-open:rotate-180 transition-transform">▾</span>
        </summary>
        <div className="space-y-2 pb-3">
          <ol className="list-decimal pl-5 space-y-1.5 text-base text-soft leading-relaxed">
            {subpasos(p.instrucciones).map((s, i) => <li key={i}>{s}</li>)}
          </ol>
          {p.lectura && (
            <details open className="rounded-xl border border-line bg-elevated/60 px-3 py-2">
              <summary className="cursor-pointer text-base font-semibold text-accent py-1">📖 Lectura de este paso</summary>
              <div className="whitespace-pre-wrap text-[17px] leading-relaxed text-strong pt-2 pb-1">{p.lectura}</div>
            </details>
          )}
          {entrega ? (
            <p className="text-base text-strong rounded-xl bg-elevated/60 px-3 py-2">
              {p.evidenciaDetalle && <span className="block"><b>Qué entregas:</b> {p.evidenciaDetalle}</span>}
              <span className="block"><b>Cómo lo entregas:</b> {medioEntrega(p)}</span>
            </p>
          ) : (
            <p className="text-base text-strong rounded-xl bg-elevated/60 px-3 py-2">{medioEntrega(p)}</p>
          )}
          {p.componentes && p.componentes.length > 0 && (
            <div className="rounded-xl border border-line px-3 py-2 space-y-1.5">
              <p className="text-base font-semibold text-strong">Tu entrega incluye:</p>
              <ul className="space-y-1.5 text-base text-soft">
                {p.componentes.map(cp => (
                  <li key={cp.asignaturaId}>
                    <span aria-hidden>{cp.revisado ? '☑' : '☐'}</span> {cp.parte} <span className="text-muted">({cp.asignatura ?? 'Asignatura'})</span>
                    {cp.revisado && (
                      <span className="block ml-6 text-sm text-green-700 dark:text-green-400 font-semibold">
                        ✓ {cp.asignatura ?? 'Asignatura'} revisó{cp.comentario ? <span className="font-normal text-soft whitespace-pre-wrap"> · «{cp.comentario}»</span> : null}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
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
          {token && p.guiaId && entrega
            ? <Entregar p={p} token={token} onEntregado={setEntregadoEn} />
            : (p.entregadoEn || p.revisado) ? <Entregar p={p} token="" soloLectura /> : null}
        </div>
      </details>
    </article>
  );
}

const fechaHora = (ms: number) => {
  const d = new Date(ms);
  return `${DIAS_LARGO[d.getDay()]} ${d.getDate()} de ${MESES[d.getMonth()]}, ${d.toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit' })}`;
};

type FaseEntrega = 'quieto' | 'elegido' | 'enviando' | 'ok';

/** Botón «Entregar»: foto (cámara), audio o PDF; o un enlace para los videos. */
function Entregar({ p, token, soloLectura, onEntregado }: { p: Paso; token: string; soloLectura?: boolean; onEntregado?: (ms: number) => void }) {
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
    if (!v.ok) { setError(v.error); registrarRechazo(token, f, v.error); return; }
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
      if (!v.ok) { setError(v.error); registrarRechazo(token, { name: prep.nombre, type: prep.contentType, size: prep.blob.size }, v.error); setFase('elegido'); return; }
      contenido = prep;
    }
    setFase('enviando');
    const r = await subirEntrega({ token, guiaId: p.guiaId!, pasoId: p.id }, contenido);
    if (!r.ok) { setError(r.error ?? 'No se pudo enviar.'); if (!modoEnlace && archivo) registrarRechazo(token, archivo, `servidor: ${r.error ?? ''}`); setFase(modoEnlace ? 'quieto' : 'elegido'); return; }
    setEntregadoEn(r.entregadoEn);
    if (r.entregadoEn) onEntregado?.(r.entregadoEn);
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
      {p.revisado && (
        <div className="rounded-xl bg-success-soft text-success-soft-fg p-3 text-base">
          <p className="font-semibold">✓ Tu docente ya lo revisó</p>
          {p.comentario && <p className="mt-1 whitespace-pre-wrap">«{p.comentario}»</p>}
        </div>
      )}
      {!soloLectura && <>
      <input ref={input} type="file" accept={ACCEPT_ENTREGA} className="hidden"
        onChange={e => elegir(e.target.files?.[0])} aria-label="Elegir archivo para entregar" />
      {/* `capture` abre la cámara directamente; el otro input deja elegir audio o PDF. */}
      <input ref={camara} type="file" accept="image/*" capture="environment" className="hidden"
        onChange={e => elegir(e.target.files?.[0])} aria-label="Tomar foto para entregar" />
      {fase !== 'elegido' && fase !== 'enviando' && !modoEnlace && (
        <div className="flex flex-wrap gap-2">
          <button onClick={() => input.current?.click()} className={`${boton} bg-accent/20 border border-accent/60 text-strong`}>
            <Upload size={18} /> {entregadoEn ? 'Enviar otra versión' : 'Entregar'}
          </button>
          <button onClick={() => camara.current?.click()} className={`${boton} border border-accent/50 text-accent`}>
            <Camera size={18} /> Tomar foto
          </button>
          <button onClick={() => { setModoEnlace(true); setError(''); }} className={`${boton} border border-line text-soft`}>
            <Link2 size={18} /> Pegar enlace (video)
          </button>
          <ComoEnviar />
        </div>
      )}
      {modoEnlace && fase !== 'enviando' && (
        <div className="space-y-2">
          <input value={enlace} onChange={e => setEnlace(e.target.value)} inputMode="url" placeholder="https://drive.google.com/… o https://youtu.be/…"
            className="w-full min-h-[44px] rounded-xl border border-line bg-card px-3 text-base text-strong" />
          <div className="flex gap-2">
            <button onClick={enviar} className={`${boton} bg-accent/20 border border-accent/60 text-strong`}>Enviar enlace</button>
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
              <button onClick={enviar} className={`${boton} bg-accent/20 border border-accent/60 text-strong`}>Enviar</button>
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
      </>}
    </div>
  );
}

