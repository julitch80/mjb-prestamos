import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import './GuiaSimulacro.css';
import { useAppStore } from '../../data/store';
import {
  ANTES_BASE, ANTES_EX, FASES_CAPITULO, FASES_ROTULO, FN, MISION, PASOS, PUESTOS,
  ROLES, ROLES_DOCENTE, ROL_PRIORIDAD, RUTAS,
} from '../../data/simulacros/plantillaSismo2026';
import type { Fase, JornadaId, Puesto, RolClave } from '../../data/simulacros/plantillaSismo2026';
import { PORTADA_SISMO, PUNTOS_ESPACIOS, SOTANO_NOTA } from '../../data/simulacros/portadaSismo2026';
import {
  JORNADA_NOMBRE, accionesDelPaso, asignacionDe, cargoDe, cronograma, diasRestantes, fechaLarga,
  formatoMinutos, horaAMinutos, nombreDeSlot, normalizar, partesDeHora, pasosAhora, puestosDeJornada,
  resumenPendientes,
} from '../../data/simulacros/logica';
import type { SimulacroConId } from './useSimulacro';

type Pestana = 'guion' | 'rol' | 'enc' | 'rutas';
type Tema = 'light' | 'dark';

const LS_KEY = 'simulacros_guia_v1';
const FONTS_ID = 'simu-guia-fonts';
const FONTS_HREF =
  'https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700&family=Barlow:wght@400;500;600;700&display=swap';

interface Guardado { theme?: Tema; checks?: Record<string, boolean> }

function leerGuardado(): Guardado {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return {};
    const o = JSON.parse(raw) as Guardado;
    return o && typeof o === 'object' ? o : {};
  } catch { return {}; }
}
function escribirGuardado(g: Guardado) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(g)); } catch { /* sin almacenamiento */ }
}

function rolInfo(k: RolClave) {
  return ROLES.find(r => r.k === k) ?? ROLES[0];
}

// ── Iconos ────────────────────────────────────────────────────────────────────

const svgBase = { fill: 'none', stroke: 'currentColor', strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true };

function IcoOye() {
  return <svg width="22" height="22" viewBox="0 0 24 24" strokeWidth="2" {...svgBase}><path d="M4 9v6h4l5 4V5L8 9z" /><path d="M16.5 8.5a5 5 0 0 1 0 7" /></svg>;
}
function IcoCheck() {
  return <svg width="22" height="22" viewBox="0 0 24 24" strokeWidth="3" {...svgBase}><path d="M5 12.5l4.5 4.5L19 7" /></svg>;
}
function IcoPlay() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 4.5v15l13-7.5z" /></svg>;
}
function IcoFlecha() {
  return <svg width="44" height="44" viewBox="0 0 48 48" fill="none" stroke="#fff" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 24h34" /><path d="M26 10l14 14-14 14" /></svg>;
}
function IcoTema() {
  return <svg width="22" height="22" viewBox="0 0 24 24" strokeWidth="2" {...svgBase}><path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" /></svg>;
}
function IcoCerrar() {
  return <svg width="22" height="22" viewBox="0 0 24 24" strokeWidth="2.2" {...svgBase}><path d="M6 6l12 12M18 6L6 18" /></svg>;
}
const ICONOS_NAV: Record<Pestana, ReactNode> = {
  guion: <svg width="24" height="24" viewBox="0 0 24 24" strokeWidth="2" {...svgBase}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>,
  rol: <svg width="24" height="24" viewBox="0 0 24 24" strokeWidth="2" {...svgBase}><circle cx="12" cy="8" r="3.5" /><path d="M5 20c0-3.5 3-6 7-6s7 2.5 7 6" /></svg>,
  enc: <svg width="24" height="24" viewBox="0 0 24 24" strokeWidth="2" {...svgBase}><circle cx="9" cy="9" r="3" /><circle cx="17" cy="10" r="2.5" /><path d="M3 19c0-3 2.7-5 6-5s6 2 6 5" /><path d="M15 15c3 0 6 1.5 6 4" /></svg>,
  rutas: <svg width="24" height="24" viewBox="0 0 24 24" strokeWidth="2" {...svgBase}><circle cx="6" cy="6" r="2" /><circle cx="18" cy="18" r="2" /><path d="M8 6h6a3 3 0 0 1 0 6h-4a3 3 0 0 0 0 6h6" /></svg>,
};

// ── Piezas pequeñas ───────────────────────────────────────────────────────────

function Lista({ items }: { items: string[] }) {
  return <ul className="acts">{items.map((x, i) => <li key={i}>{x}</li>)}</ul>;
}

function BloqueAcciones({ own, base, rol }: { own: string[]; base: string[]; rol: RolClave }) {
  if (own.length && base.length) {
    return (
      <>
        <p className="grp">Como {rolInfo(rol).c}</p><Lista items={own} />
        <p className="grp">Como docente de aula</p><Lista items={base} />
      </>
    );
  }
  if (own.length) return (<><p className="grp">Tu acción</p><Lista items={own} /></>);
  if (base.length) return (<><p className="grp">Tu acción</p><Lista items={base} /></>);
  return <p className="sin">Sin acción tuya en este momento.</p>;
}

interface Persona {
  key: string;
  nombre: string;
  nn: string;
  puestos: Record<JornadaId, Puesto[]>;
}

// ── Componente principal ──────────────────────────────────────────────────────

export default function GuiaSimulacro({ sim }: { sim: SimulacroConId }) {
  const userId = useAppStore(s => s.userId);
  const temaApp = useAppStore(s => s.temaOscuro);

  const guardado = useRef<Guardado>(leerGuardado());
  const [tema, setTema] = useState<Tema | null>(guardado.current.theme ?? null);
  const [checks, setChecks] = useState<Record<string, boolean>>(guardado.current.checks ?? {});

  const [j, setJ] = useState<JornadaId>('manana');
  const [rol, setRol] = useState<RolClave>('docente');
  const [tab, setTab] = useState<Pestana>('guion');
  const [abiertos, setAbiertos] = useState<Record<number, boolean>>({});
  const [soloPend, setSoloPend] = useState(false);
  const [busca, setBusca] = useState('');
  const [salon, setSalon] = useState('');
  const [ocultarYo, setOcultarYo] = useState(false);
  const [personaSel, setPersonaSel] = useState<string | null>(null);
  const [liveAbierto, setLiveAbierto] = useState(false);
  const [liveI, setLiveI] = useState(0);
  const [aviso, setAviso] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const inicializado = useRef(false);
  const wakeLock = useRef<{ release: () => Promise<void> } | null>(null);
  const toqueX = useRef<number | null>(null);
  const avisoTimer = useRef<number | undefined>(undefined);
  const envoltorio = useRef<HTMLDivElement>(null);

  const temaEfectivo: Tema = tema ?? (temaApp ? 'dark' : 'light');
  const asig = sim.asignaciones ?? {};
  const nacional = sim.nacional;
  const cfg = sim.jornadas?.[j] ?? { fecha: nacional?.fecha ?? '2026-10-21', hora: j === 'manana' ? '10:00' : '16:00' };

  // Fuentes de la guía (Barlow)
  useEffect(() => {
    if (document.getElementById(FONTS_ID)) return;
    const l = document.createElement('link');
    l.id = FONTS_ID; l.rel = 'stylesheet'; l.href = FONTS_HREF;
    document.head.appendChild(l);
  }, []);

  // Reloj: solo el día del simulacro se refresca la marca «Ahora».
  useEffect(() => {
    if (diasRestantes(cfg.fecha) !== 0) return;
    const h = window.setInterval(() => setTick(t => t + 1), 30000);
    return () => window.clearInterval(h);
  }, [cfg.fecha]);

  // Personas con asignación (para «Mi rol»)
  const gente = useMemo(() => {
    const m = new Map<string, Persona>();
    for (const jj of ['manana', 'tarde'] as JornadaId[]) {
      for (const p of puestosDeJornada(jj, PUESTOS)) {
        const a = asignacionDe(asig, p.id, jj);
        if (!a) continue;
        const key = a.slot ?? (a.textoLibre ? `txt:${a.textoLibre}` : '');
        if (!key) continue;
        const nombre = a.slot ? nombreDeSlot(a.slot) : (a.textoLibre ?? '');
        let g = m.get(key);
        if (!g) { g = { key, nombre, nn: normalizar(nombre), puestos: { manana: [], tarde: [] } }; m.set(key, g); }
        g.puestos[jj].push(p);
      }
    }
    return m;
  }, [asig]);

  const rolesDe = useCallback((g: Persona | undefined, jj: JornadaId): RolClave[] => {
    if (!g) return [];
    const set = new Set(g.puestos[jj].map(p => p.rol));
    return ROL_PRIORIDAD.filter(r => set.has(r));
  }, []);

  // Al abrir: jornada y rol de quien inició sesión (una sola vez)
  useEffect(() => {
    if (inicializado.current || !userId) return;
    const g = gente.get(userId);
    if (!g) { inicializado.current = true; return; }
    inicializado.current = true;
    const jj: JornadaId = g.puestos.manana.length ? 'manana' : g.puestos.tarde.length ? 'tarde' : 'manana';
    setJ(jj);
    const rs = rolesDe(g, jj);
    if (rs.length) setRol(rs[0]);
  }, [userId, gente, rolesDe]);

  const personaKey = personaSel ?? (userId && gente.has(userId) ? userId : null);
  const persona = personaKey ? gente.get(personaKey) : undefined;

  function mostrarAviso(t: string) {
    setAviso(t);
    window.clearTimeout(avisoTimer.current);
    avisoTimer.current = window.setTimeout(() => setAviso(null), 2400);
  }

  function cambiarTema() {
    const nuevo: Tema = temaEfectivo === 'dark' ? 'light' : 'dark';
    setTema(nuevo);
    guardado.current = { ...guardado.current, theme: nuevo };
    escribirGuardado(guardado.current);
  }

  function marcar(k: string, v: boolean) {
    setChecks(prev => {
      const n = { ...prev };
      if (v) n[k] = true; else delete n[k];
      guardado.current = { ...guardado.current, checks: n };
      escribirGuardado(guardado.current);
      return n;
    });
  }

  function irAPestana(t: Pestana) {
    setTab(t);
    envoltorio.current?.scrollIntoView({ block: 'start' });
  }

  const filas = cronograma(PASOS, cfg);
  const ahoraIdx = useMemo(() => pasosAhora(PASOS, cfg), [cfg, tick]); // eslint-disable-line react-hooks/exhaustive-deps
  const dias = diasRestantes(cfg.fecha);
  const cuenta = dias > 1 ? `Faltan ${dias} días` : dias === 1 ? 'Es mañana' : dias === 0 ? 'Es hoy' : 'Ya se realizó';
  const clockH = formatoMinutos(horaAMinutos(cfg.hora));
  const sirena = partesDeHora(cfg.hora, 1);

  function ir(paso: number) {
    setAbiertos(a => ({ ...a, [paso]: true }));
    setTab('guion');
    window.setTimeout(() => document.getElementById(`simu-paso-${paso}`)?.scrollIntoView({ block: 'start' }), 30);
  }

  // ── Paso a paso ──
  function abrirLive() {
    let idx = 0;
    if (ahoraIdx.length) idx = ahoraIdx[0];
    else if (dias === 0) {
      const d = new Date(); const m = d.getHours() * 60 + d.getMinutes(); const H = horaAMinutos(cfg.hora);
      idx = PASOS.length - 1;
      for (let i = 0; i < PASOS.length; i++) { if (H + PASOS[i].a > m) { idx = i; break; } }
    }
    setLiveI(idx);
    setLiveAbierto(true);
    try {
      const nav = navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<{ release: () => Promise<void> }> } };
      nav.wakeLock?.request('screen').then(l => { wakeLock.current = l; }).catch(() => { /* sin wake lock */ });
    } catch { /* sin wake lock */ }
  }
  const cerrarLive = useCallback(() => {
    setLiveAbierto(false);
    try { void wakeLock.current?.release(); } catch { /* nada */ }
    wakeLock.current = null;
  }, []);

  useEffect(() => {
    if (!liveAbierto) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') cerrarLive();
      else if (e.key === 'ArrowRight') setLiveI(i => Math.min(PASOS.length - 1, i + 1));
      else if (e.key === 'ArrowLeft') setLiveI(i => Math.max(0, i - 1));
    };
    window.addEventListener('keydown', onKey);
    return () => { document.body.style.overflow = prev; window.removeEventListener('keydown', onKey); };
  }, [liveAbierto, cerrarLive]);

  const pend = resumenPendientes(asig, j);
  const rolSel = rolInfo(rol);

  // ── Copiar ──
  function copiar(txt: string, msg: string) {
    const fb = () => {
      const a = document.createElement('textarea');
      a.value = txt; a.setAttribute('readonly', ''); a.style.position = 'fixed'; a.style.opacity = '0';
      document.body.appendChild(a); a.select();
      let ok = false; try { ok = document.execCommand('copy'); } catch { /* nada */ }
      document.body.removeChild(a);
      mostrarAviso(ok ? msg : 'No se pudo copiar');
    };
    if (navigator.clipboard?.writeText) navigator.clipboard.writeText(txt).then(() => mostrarAviso(msg), fb); else fb();
  }

  // ── Encargados agrupados por fila ──
  const gruposEnc = useMemo(() => {
    const grupos: { titulo: string; filas: { cargo: string; nota?: string; puestos: Puesto[] }[] }[] = [];
    for (const p of puestosDeJornada(j)) {
      let g = grupos.find(x => x.titulo === p.grupo);
      if (!g) { g = { titulo: p.grupo, filas: [] }; grupos.push(g); }
      const cargo = cargoDe(p);
      let f = g.filas.find(x => x.cargo === cargo);
      if (!f) { f = { cargo, nota: p.nota, puestos: [] }; g.filas.push(f); }
      f.puestos.push(p);
    }
    return grupos;
  }, [j]);

  function estadoPuesto(p: Puesto) {
    const a = asignacionDe(asig, p.id, j);
    const nombre = a?.slot ? nombreDeSlot(a.slot) : (a?.textoLibre ?? '');
    return { nombre, porConfirmar: !!a?.porConfirmar && !!nombre, vacio: !nombre };
  }

  const textoPendientes = useMemo(() => {
    const lista: string[] = [];
    for (const g of gruposEnc) for (const f of g.filas) {
      let rp = 0; let rc = 0;
      for (const p of f.puestos) {
        if (p.opcional) continue;
        const e = estadoPuesto(p);
        if (e.vacio) rp++; else if (e.porConfirmar) rc++;
      }
      if (rp || rc) lista.push(`- ${f.cargo}: ${rp ? `${rp} por asignar` : ''}${rp && rc ? ' y ' : ''}${rc ? `${rc} por confirmar` : ''}`);
    }
    return lista;
  }, [gruposEnc, asig, j]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Resultados de búsqueda ──
  const resultados = useMemo(() => {
    const nq = normalizar(busca).trim();
    if (nq.length < 2) return null;
    const toks = nq.split(/\s+/);
    return [...gente.values()].filter(g => toks.every(t => g.nn.includes(t))).slice(0, 6);
  }, [busca, gente]);

  function elegirRol(k: RolClave, personaClave?: string) {
    setRol(k);
    if (personaClave && gente.has(personaClave)) { setPersonaSel(personaClave); setOcultarYo(false); }
    window.setTimeout(() => document.getElementById('simu-rd')?.scrollIntoView({ block: 'start' }), 30);
  }

  // ── Rutas ──
  const salones = useMemo(() => RUTAS.flatMap(r => r.o.map((n, i) => ({ n, k: r.k, i }))), []);
  const salonInfo = salon && salon !== 'sotano' ? salones.find(s => s.n === salon) : undefined;
  const rutaDeSalon = salonInfo ? RUTAS.find(r => r.k === salonInfo.k) : undefined;

  // ── Detalle del rol ──
  const itemsAntes = useMemo(() => {
    const items: { k: string; t: string }[] = [];
    if (ROLES_DOCENTE.includes(rol)) {
      (rol === 'docente' ? [] : (ANTES_EX[rol] ?? [])).forEach((t, i) => items.push({ k: `${sim.id}:${rol}${i}`, t }));
      ANTES_BASE.forEach((t, i) => items.push({ k: `${sim.id}:d${i}`, t }));
    } else {
      (ANTES_EX[rol] ?? []).forEach((t, i) => items.push({ k: `${sim.id}:${rol}${i}`, t }));
    }
    return items;
  }, [rol, sim.id]);
  const hechos = itemsAntes.filter(x => checks[x.k]).length;

  const reprogramado = !!cfg.motivo;

  // ── Render ──
  const miAsignacion = persona?.puestos[j] ?? [];
  const otraJ: JornadaId = j === 'manana' ? 'tarde' : 'manana';
  const rolesPersona = rolesDe(persona, j);

  const liveP = PASOS[liveI];
  const liveFila = filas[liveI];
  const liveAc = accionesDelPaso(liveP, rol);

  return (
    <div className="simu-guia" data-theme={temaEfectivo} ref={envoltorio}>
      <header className="appbar">
        <div className="wrap">
          <div className="bar1">
            <div className="brand">
              <b>{PORTADA_SISMO.titulo}<span className="estado-chip" hidden={sim.estado === 'publicado'}>{sim.estado}</span></b>
              <span>{PORTADA_SISMO.sede}</span>
            </div>
            <div className="tools">
              <button className="iconbtn" type="button" aria-label="Cambiar entre tema claro y oscuro" onClick={cambiarTema}><IcoTema /></button>
            </div>
          </div>
          <div className="seg" role="group" aria-label="Jornada">
            {(['manana', 'tarde'] as JornadaId[]).map(k => (
              <button key={k} type="button" aria-pressed={j === k} onClick={() => setJ(k)}>
                <b>{JORNADA_NOMBRE[k]}</b>
                <span>{formatoMinutos(horaAMinutos(sim.jornadas?.[k]?.hora ?? (k === 'manana' ? '10:00' : '16:00')))}</span>
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="wrap app">
        {/* ── Guion ── */}
        <section data-panel="guion" aria-label="Guion" hidden={tab !== 'guion'}>
          {reprogramado && (
            <div className="reprog" role="status">
              <b>Simulacro reprogramado</b>
              Jornada de la {JORNADA_NOMBRE[j].toLowerCase()}: {fechaLarga(cfg.fecha)}, {clockH}. Motivo: {cfg.motivo}.
            </div>
          )}
          <div className="placa" data-f="durante" style={{ marginTop: 14 }}>
            <div className="placa-in">
              <div className="hero-top"><span className="hero-fecha">{fechaLarga(cfg.fecha)}</span><span className="cuenta">{cuenta}</span></div>
              <div className="hero-main">
                <div className="hero-hora">{sirena.t}<small>{sirena.ap}</small></div>
                <div className="hero-txt">Suena la sirena:<br />empieza la salida</div>
              </div>
              <div className="hero-pie">El timbre largo suena a las {clockH} {PORTADA_SISMO.resumen}</div>
            </div>
          </div>
          <div className="alerta" role="note">
            <b>Coincide con la hora del descanso</b>
            El timbre largo de las {clockH} no es el descanso: es el inicio del simulacro. El descanso empieza cuando termina el ejercicio.
          </div>

          {persona && !ocultarYo && (
            <section className="yo" aria-label="Tu asignación">
              <div className="yo-top">
                <b>Hola, {persona.nombre.split(' ')[0]}</b>
                <button className="linkbtn" type="button" onClick={() => setOcultarYo(true)}>No soy yo</button>
              </div>
              {miAsignacion.length > 0 ? (
                <>
                  <p className="yo-t">Tus asignaciones en la jornada de la {JORNADA_NOMBRE[j].toLowerCase()}:</p>
                  <ul className="yo-l">
                    {miAsignacion.map(p => (
                      <li key={p.id}><b>{p.nombre}</b>{p.nota && <span>{p.nota}</span>}</li>
                    ))}
                  </ul>
                </>
              ) : persona.puestos[otraJ].length > 0 ? (
                <p className="yo-t">No tienes asignación en la jornada de la {JORNADA_NOMBRE[j].toLowerCase()}. Cambia de jornada arriba para ver la tuya.</p>
              ) : null}
              {rolesPersona.length > 1 && (
                <>
                  <p className="yo-t">Ver el guion como:</p>
                  <div className="chips">
                    {rolesPersona.map(k => (
                      <button key={k} className="chipbtn" type="button" aria-pressed={rol === k} onClick={() => setRol(k)}>{rolInfo(k).n}</button>
                    ))}
                  </div>
                </>
              )}
            </section>
          )}

          <button className="cta" type="button" onClick={abrirLive}>
            <IcoPlay />
            <span className="tx"><b>Seguir el guion paso a paso</b><small>{dias === 0 ? 'En vivo, sigue la hora del simulacro' : 'Modo ensayo, para practicar antes del día'}</small></span>
          </button>

          <div className="duo">
            {PORTADA_SISMO.duo.map(d => (
              <div key={d.titulo} className="placa" data-f={d.f}><div className="placa-in"><b>{d.titulo}</b><span>{d.texto}</span></div></div>
            ))}
          </div>
          <ul className="recuerda">{PORTADA_SISMO.recuerda.map((t, i) => <li key={i}>{t}</li>)}</ul>

          <div className="rolbar">
            <span>Guía para: <b>{rolSel.n}</b></span>
            <button className="linkbtn" type="button" onClick={() => irAPestana('rol')}>Cambiar rol</button>
          </div>

          <ol className="ruta">
            {filas.map(({ indice, paso, partes, duracion }) => {
              const esAhora = ahoraIdx.includes(indice);
              const abierto = !!abiertos[indice] || esAhora;
              const ac = accionesDelPaso(paso, rol);
              const pv = ac.own[0] ?? ac.base[0];
              const nuevaFase = indice === 0 || PASOS[indice - 1].f !== paso.f;
              return (
                <FaseYParada key={indice} nuevaFase={nuevaFase} fase={paso.f}>
                  <li className={`parada${esAhora ? ' ahora' : ''}`} data-f={paso.f} id={`simu-paso-${indice}`}>
                    <span className="nodo" aria-hidden="true">{indice + 1}</span>
                    <div className="p-body">
                      <button className="p-head" type="button" aria-expanded={abierto} aria-controls={`simu-d-${indice}`}
                        onClick={() => setAbiertos(a => ({ ...a, [indice]: !abierto }))}>
                        <span className="p-top">
                          <span className="p-time">{partes.t}<small>{partes.ap}</small></span>
                          <span className="p-dur">{duracion}</span>
                          {esAhora && <span className="badge-now">Ahora</span>}
                        </span>
                        <span className="p-tit"><span className="sr">Paso {indice + 1}: </span>{paso.t}</span>
                        <span className="p-prev">{pv ?? 'Sin acción tuya en este momento.'}</span>
                      </button>
                      <div className="p-det" id={`simu-d-${indice}`} hidden={!abierto}>
                        {paso.oye && <blockquote className="oye"><IcoOye /><span><b>Se oirá</b>{paso.oye}</span></blockquote>}
                        <BloqueAcciones own={ac.own} base={ac.base} rol={rol} />
                        <p className="grp">Qué pasa</p>
                        <p className="q">{paso.q}</p>
                        <p className="medio">Medio: {paso.medio}</p>
                      </div>
                    </div>
                  </li>
                </FaseYParada>
              );
            })}
          </ol>
        </section>

        {/* ── Mi rol ── */}
        <section data-panel="rol" aria-label="Mi rol" hidden={tab !== 'rol'}>
          <label className="lbl" htmlFor="simu-q">Busca tu nombre</label>
          <input className="buscar" id="simu-q" type="search" placeholder="Por ejemplo: Claudia Henao" autoComplete="off"
            autoCapitalize="words" spellCheck={false} value={busca} onChange={e => setBusca(e.target.value)} />
          <div className="res" aria-live="polite">
            {resultados && resultados.length === 0 && (
              <div className="nota-vacio">
                No encontré «{busca.trim()}» en los listados de brigadas. Si tienes un grupo a cargo, tu rol es el de docente de aula.
                <div className="chips"><button className="chipbtn" type="button" onClick={() => elegirRol('docente')}>Ver guía de docente de aula</button></div>
              </div>
            )}
            {resultados?.map(g => {
              const mine = rolesDe(g, j);
              const oth = rolesDe(g, otraJ);
              return (
                <div className="res-item" key={g.key}>
                  <b>{g.nombre}</b>
                  {mine.length > 0 ? (
                    <>
                      <small>Jornada de la {JORNADA_NOMBRE[j].toLowerCase()}. Toca un rol para ver tu guía:</small>
                      <div className="chips">
                        {mine.map(k => <button key={k} className="chipbtn" type="button" onClick={() => elegirRol(k, g.key)}>{rolInfo(k).n}</button>)}
                      </div>
                    </>
                  ) : oth.length > 0 ? (
                    <small>No aparece en la jornada de la {JORNADA_NOMBRE[j].toLowerCase()}, sino en la de la {JORNADA_NOMBRE[otraJ].toLowerCase()}. Cambia de jornada arriba para ver sus roles.</small>
                  ) : null}
                </div>
              );
            })}
          </div>

          <h2 className="sec">O elige tu rol</h2>
          <ul className="ops">
            {ROLES.map(r => (
              <li key={r.k}>
                <button className="op" type="button" aria-pressed={rol === r.k} onClick={() => elegirRol(r.k)}>
                  <span><b>{r.n}</b><span>{r.d}</span></span>
                  <IcoCheck />
                </button>
              </li>
            ))}
          </ul>

          <div className="rd" id="simu-rd">
            <h2>{rolSel.n}</h2>
            <p className="mision">{MISION[rol]}</p>
            <h3>Antes del día</h3>
            <p className="prog">{hechos} de {itemsAntes.length} listos</p>
            {itemsAntes.map(x => (
              <label className="chk" key={x.k}>
                <input type="checkbox" checked={!!checks[x.k]} onChange={e => marcar(x.k, e.target.checked)} />
                <span>{x.t}</span>
              </label>
            ))}
            <h3>El día del simulacro</h3>
            <ul className="mini">
              {filas.map(({ indice, paso, partes }) => {
                const ac = accionesDelPaso(paso, rol);
                const primera = ac.own[0] ?? ac.base[0];
                if (!primera) return null;
                return (
                  <li key={indice} data-f={paso.f}>
                    <button type="button" onClick={() => ir(indice)}>
                      <span className="t">{partes.t}<small> {partes.ap}</small></span>
                      <span><b>{paso.t}</b><span className="d">{primera}</span></span>
                    </button>
                  </li>
                );
              })}
            </ul>
            {FN[rol] && (
              <details className="fn">
                <summary>Funciones oficiales según la Resolución Rectoral 06 de 2026</summary>
                <Lista items={FN[rol] as string[]} />
              </details>
            )}
            <div className="evita"><b>Evita siempre</b>{PORTADA_SISMO.evita}</div>
          </div>
        </section>

        {/* ── Encargados ── */}
        <section data-panel="enc" aria-label="Encargados" hidden={tab !== 'enc'}>
          {pend.porAsignar || pend.porConfirmar ? (
            <div className="resumen">
              <b>
                {pend.porAsignar ? `${pend.porAsignar} ${pend.porAsignar === 1 ? 'puesto por asignar' : 'puestos por asignar'}` : ''}
                {pend.porAsignar && pend.porConfirmar ? ' y ' : ''}
                {pend.porConfirmar ? `${pend.porConfirmar} por confirmar` : ''}
              </b>{' '}
              en la jornada de la {JORNADA_NOMBRE[j].toLowerCase()}. Cuando el responsable defina los nombres, aparecen aquí y cada persona ve su rol al buscarse.
            </div>
          ) : (
            <div className="resumen ok"><b>Todos los puestos tienen responsable</b> en la jornada de la {JORNADA_NOMBRE[j].toLowerCase()}.</div>
          )}
          <div className="acciones">
            <button className="btn2" type="button" aria-pressed={soloPend} onClick={() => setSoloPend(v => !v)}>Solo pendientes</button>
            {textoPendientes.length > 0 && (
              <button className="btn2" type="button"
                onClick={() => copiar(`Pendientes del simulacro del ${fechaLarga(cfg.fecha).split(' ').slice(1).join(' ')}, jornada de la ${JORNADA_NOMBRE[j].toLowerCase()}:\n${textoPendientes.join('\n')}`, 'Pendientes copiados')}>
                Copiar pendientes
              </button>
            )}
          </div>
          {(() => {
            let alguno = false;
            const out = gruposEnc.map(g => {
              const filasVis = g.filas.filter(f => {
                if (!soloPend) return true;
                return f.puestos.some(p => !p.opcional && (estadoPuesto(p).vacio || estadoPuesto(p).porConfirmar));
              });
              if (!filasVis.length) return null;
              alguno = true;
              return (
                <section className="grupo" key={g.titulo}>
                  <h3>{g.titulo}</h3>
                  {filasVis.map(f => {
                    const chips = f.puestos.map(p => {
                      const e = estadoPuesto(p);
                      if (e.vacio) return p.opcional
                        ? <span key={p.id} className="opc">Opcional: sin definir</span>
                        : <span key={p.id} className="pend">Por asignar</span>;
                      return (
                        <span key={p.id} style={{ display: 'contents' }}>
                          <span className="nom">{e.nombre}{p.detalle && <> <small>{p.detalle}</small></>}</span>
                          {e.porConfirmar && <span className="tagc">por confirmar</span>}
                        </span>
                      );
                    });
                    const sinPend = f.puestos.every(p => !estadoPuesto(p).vacio && !estadoPuesto(p).porConfirmar);
                    return (
                      <div className="fila" key={f.cargo}>
                        <span className="cargo">{f.cargo}</span>
                        {f.nota && <span className="nota">{f.nota}</span>}
                        {f.puestos.length > 5 && sinPend
                          ? <details className="ver"><summary>Ver las {f.puestos.length} personas</summary><div className="quien">{chips}</div></details>
                          : <div className="quien">{chips}</div>}
                      </div>
                    );
                  })}
                </section>
              );
            });
            return alguno ? out : <p className="nota-vacio">No hay pendientes en esta jornada.</p>;
          })()}
        </section>

        {/* ── Rutas ── */}
        <section data-panel="rutas" aria-label="Rutas" hidden={tab !== 'rutas'}>
          <label className="lbl" htmlFor="simu-salon">¿En qué salón estarás a esa hora?</label>
          <select className="sel" id="simu-salon" value={salon} onChange={e => setSalon(e.target.value)}>
            <option value="">Elige tu salón o espacio</option>
            {RUTAS.map(r => (
              <optgroup key={r.k} label={r.t}>
                {r.o.map(n => <option key={n} value={n}>{n}</option>)}
              </optgroup>
            ))}
            <optgroup label="Sótano"><option value="sotano">Sótano</option></optgroup>
          </select>
          <div className="salon-res" aria-live="polite">
            {!salon && 'Elige tu salón y verás tu ruta y tu turno de salida.'}
            {salon === 'sotano' && <><b>Sótano:</b> la ruta todavía está por definir. Consúltala con el responsable del simulacro.</>}
            {salonInfo && rutaDeSalon && (
              <>
                <b>{salon}</b> sale por «{rutaDeSalon.t}». Es el turno <b>{salonInfo.i + 1} de {rutaDeSalon.o.length}</b> de esa ruta.{' '}
                {salonInfo.i > 0 ? `Sale después de ${rutaDeSalon.o[salonInfo.i - 1]}. ` : 'Es el primero en salir de esa ruta. '}
                {salonInfo.i < rutaDeSalon.o.length - 1 ? `Detrás de ti sale ${rutaDeSalon.o[salonInfo.i + 1]}.` : 'Es el último en salir de esa ruta.'}
                <br /><br />Cada grupo evacúa según el salón que ocupa a esa hora, no según su número de grupo.
              </>
            )}
          </div>
          <div>
            {RUTAS.map(r => (
              <section className="lane" key={r.k}>
                <h3>{r.t}</h3>
                <p className="cuando">{r.w}</p>
                <ol>
                  {r.o.map((n, i) => (
                    <li key={n} className={`stop${salon === n ? ' me' : ''}`}><span className="n">{i + 1}</span><span className="nm">{n}</span></li>
                  ))}
                </ol>
              </section>
            ))}
            <section className="lane por-definir">
              <h3>Sótano</h3>
              <div className="box"><b>Ruta por definir.</b> {SOTANO_NOTA}</div>
            </section>
            <div className="dest">
              <div className="placa" data-f="durante"><div className="placa-in"><IcoFlecha /><div><b>Patio central</b><span>Punto de encuentro de todas las rutas</span></div></div></div>
            </div>
            <h2 className="sec">Puntos y espacios</h2>
            <dl className="puntos">
              {PUNTOS_ESPACIOS.map(p => <div key={p.t}><dt>{p.t}</dt><dd>{p.d}</dd></div>)}
            </dl>
          </div>
        </section>

        <footer className="pie">
          Los puestos marcados como «por asignar» o «por confirmar» se completan antes del simulacro. Responsable del ejercicio: {PORTADA_SISMO.responsable}.
        </footer>
      </main>

      <nav className="nav" aria-label="Secciones de la guía">
        <div className="nav-in">
          {([['guion', 'Guion'], ['rol', 'Mi rol'], ['enc', 'Encargados'], ['rutas', 'Rutas']] as [Pestana, string][]).map(([k, n]) => (
            <button key={k} type="button" aria-current={tab === k ? 'page' : undefined} onClick={() => irAPestana(k)}>
              {ICONOS_NAV[k]}<span>{n}</span>
            </button>
          ))}
        </div>
      </nav>

      {liveAbierto && (
        <div className="live" role="dialog" aria-modal="true" aria-label="Guion paso a paso"
          onTouchStart={e => { toqueX.current = e.touches[0].clientX; }}
          onTouchEnd={e => {
            if (toqueX.current === null) return;
            const dx = e.changedTouches[0].clientX - toqueX.current; toqueX.current = null;
            if (Math.abs(dx) < 70) return;
            if (dx < 0) setLiveI(i => Math.min(PASOS.length - 1, i + 1)); else setLiveI(i => Math.max(0, i - 1));
          }}>
          <div className="live-in">
            <div className="live-top">
              <button className="iconbtn" type="button" aria-label="Cerrar el paso a paso" onClick={cerrarLive} autoFocus><IcoCerrar /></button>
              <label className="sr" htmlFor="simu-live-rol">Tu rol</label>
              <select className="sel" id="simu-live-rol" value={rol} onChange={e => setRol(e.target.value as RolClave)}>
                {ROLES.map(r => <option key={r.k} value={r.k}>{r.n}</option>)}
              </select>
            </div>
            <div className="live-prog">
              {PASOS.map((q, i) => (
                <button key={i} type="button" data-f={q.f} className={i < liveI ? 'hecho' : i === liveI ? 'act' : ''}
                  aria-label={`Ir al paso ${i + 1}`} onClick={() => setLiveI(i)} />
              ))}
            </div>
            <div className="live-body" key={liveI}>
              <div className="placa" data-f={liveP.f}>
                <div className="placa-in">
                  <div className="l-top">
                    <span className="l-time">{liveFila.partes.t}<small>{liveFila.partes.ap}</small></span>
                    <span className="l-fase">{FASES_ROTULO[liveP.f as Fase]}<br />Paso {liveI + 1} de {PASOS.length}</span>
                  </div>
                  <div className="l-tit">{liveP.t}</div>
                  {liveP.oye && <div className="l-oye"><IcoOye /><span>{liveP.oye}</span></div>}
                </div>
              </div>
              <div data-f={liveP.f}>
                <BloqueAcciones own={liveAc.own} base={liveAc.base} rol={rol} />
                <p className="grp">Qué pasa</p>
                <p className="q">{liveP.q}</p>
                <p className="medio">Medio: {liveP.medio}</p>
              </div>
              {ahoraIdx.length > 0 && !ahoraIdx.includes(liveI) && (
                <button className="btn2 live-sync" type="button" onClick={() => setLiveI(ahoraIdx[0])}>Ir al paso de ahora</button>
              )}
            </div>
            <div className="live-nav">
              <button type="button" disabled={liveI === 0} onClick={() => setLiveI(i => Math.max(0, i - 1))}>Anterior</button>
              <button type="button" className="go" onClick={() => (liveI < PASOS.length - 1 ? setLiveI(liveI + 1) : cerrarLive())}>
                {liveI === PASOS.length - 1 ? 'Terminar' : 'Siguiente'}
              </button>
            </div>
          </div>
        </div>
      )}

      {aviso && <div className="toast" role="status" aria-live="polite">{aviso}</div>}
    </div>
  );
}

/** Inserta el rótulo de fase («Antes del simulacro»…) antes de la primera parada de cada fase. */
function FaseYParada({ nuevaFase, fase, children }: { nuevaFase: boolean; fase: Fase; children: ReactNode }) {
  return (
    <>
      {nuevaFase && <li className="cap" data-f={fase}><span className="cap-t">{FASES_CAPITULO[fase]}</span></li>}
      {children}
    </>
  );
}
