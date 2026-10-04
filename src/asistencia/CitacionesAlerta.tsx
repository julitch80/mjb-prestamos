import { useEffect, useMemo, useState } from 'react';
import { enviarCitacionesAlerta } from '../data/api';
import { guardarAgendaCitaciones, leerAgendaCitaciones, marcarEnvioCitas } from './datos';
import { nombreCompleto } from './domain/nombres';
import { enlaceSms } from './domain/telefonos';
import {
  aHora,
  aMinutos,
  alternativasSiNoAlcanza,
  cambiosEnCitados,
  citacionAlertaId,
  motivoCitacion,
  PARAMETROS_POR_DEFECTO,
  proponerAgenda,
  revisarAgenda,
  textoSmsCitacion,
  type Citado,
  type FilaConsolidado,
} from './domain/alerta-academica';
import { fechaLarga, horaLegible } from './domain/imprimibles-alerta';
import type { AgendaCitaciones, CitaAlerta, ConvocatoriaAlerta, ModoAgenda, ParametrosAgenda, Sede, Student } from './domain/types';

const CAJA = 'w-16 rounded-lg border border-line bg-elevated px-2 py-1 text-sm text-strong';
const MODOS: { modo: ModoAgenda; nombre: string; ayuda: string }[] = [
  { modo: 'turnos', nombre: 'Turnos individuales', ayuda: 'Cada acudiente con su hora; más asignaturas, más tiempo.' },
  { modo: 'general', nombre: 'Reunión general', ayuda: 'Todos a la misma hora, al inicio de la franja.' },
  { modo: 'mixta', nombre: 'Mixta', ayuda: 'Reunión corta para los leves y turnos para los demás.' },
];

/**
 * Citaciones de la alerta — la agenda del DIRECTOR (Julian, 2026-10-02).
 *
 * Coordinacion fija el dia y la franja; el director reparte a sus citados (dos o mas
 * alertas) por turnos, en reunion general o mixta, con la cuenta de si alcanza el tiempo.
 * Despues envia las de su grupo: correo al institucional del estudiante, SMS desde su
 * celular (un toque por familia). La impresa la descarga coordinacion con toda la jornada
 * (Julian, 2026-10-03): el director no imprime. Nada sale sin que lo toque.
 */
export default function CitacionesAlerta({
  grado,
  sede,
  conv,
  filas,
  estudiantes,
  director,
}: {
  grado: string;
  sede: Sede;
  conv: ConvocatoriaAlerta;
  filas: FilaConsolidado[];
  estudiantes: Student[];
  director: string;
}) {
  const idDoc = citacionAlertaId(conv.anio, conv.periodo, sede, grado);
  const [agendaGuardada, setAgendaGuardada] = useState<AgendaCitaciones | null | undefined>(undefined);
  const [modo, setModo] = useState<ModoAgenda>('turnos');
  const [p, setP] = useState<ParametrosAgenda>(PARAMETROS_POR_DEFECTO);
  const [citas, setCitas] = useState<Record<string, CitaAlerta>>({});
  const [sucio, setSucio] = useState(false);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [aviso, setAviso] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null);

  const franja = conv.franjaInicio && conv.franjaFin ? { inicio: conv.franjaInicio, fin: conv.franjaFin } : null;

  const citados: Citado[] = useMemo(
    () => filas.filter((f) => f.citar).flatMap((f) => {
      const e = estudiantes.find((x) => x.studentId === f.studentId);
      return e ? [{ studentId: f.studentId, nombre: nombreCompleto(e), asignaturas: f.total }] : [];
    }),
    [filas, estudiantes],
  );

  const vacia = (c: Pick<CitaAlerta, 'hora' | 'duracionMin' | 'general'>): CitaAlerta => ({ ...c, enviadaCorreoEn: null, enviadaSmsEn: null, impresaEn: null });

  function proponer(m: ModoAgenda, params: ParametrosAgenda) {
    if (!franja) return;
    const r = proponerAgenda(citados, franja, m, params);
    // Conserva las marcas de envio de quien ya estaba: recalcular no borra lo enviado.
    setCitas((antes) => Object.fromEntries(Object.entries(r.citas).map(([id, c]) => [id, { ...vacia(c), ...pick(antes[id]) }])));
    setModo(m);
    setP(params);
    setSucio(true);
  }
  // Todo lo registrado de ese citado (envios, asistencia, excusa, reprogramacion, remision) se
  // conserva: recalcular solo cambia la hora, la duracion y si va a la reunion general.
  const pick = (c?: CitaAlerta): Partial<CitaAlerta> => {
    if (!c) return {};
    const { hora: _h, duracionMin: _d, general: _g, ...resto } = c;
    return resto;
  };

  useEffect(() => {
    void leerAgendaCitaciones(idDoc).then((a) => {
      setAgendaGuardada(a);
      if (a) { setModo(a.modo); setP(a.parametros); setCitas(a.citas); setSucio(false); }
    });
  }, [idDoc]);

  // Sin agenda guardada: la primera propuesta sale sola, con los valores por defecto.
  useEffect(() => {
    if (agendaGuardada === null && franja && citados.length && Object.keys(citas).length === 0) proponer('turnos', PARAMETROS_POR_DEFECTO);
  }, [agendaGuardada, franja?.inicio, franja?.fin, citados.length]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!franja || !conv.fechaEntrega) {
    return (
      <div className="rounded-2xl border border-line bg-card p-4 text-sm text-muted">
        Para armar las citaciones, coordinación tiene que poner el día y la franja de entrega de la alerta.
      </div>
    );
  }
  if (citados.length === 0 && agendaGuardada === null) {
    return <div className="rounded-2xl border border-line bg-card p-4 text-sm text-muted">Nadie del grupo tiene dos o más asignaturas en alerta: no hay a quién citar.</div>;
  }
  if (agendaGuardada === undefined) return <p className="p-3 text-sm text-muted">Cargando la agenda…</p>;

  const disponibles = aMinutos(franja.fin) - aMinutos(franja.inicio);
  const ids = Object.keys(citas);
  const ultimaFin = ids.length ? Math.max(...ids.map((id) => aMinutos(citas[id].hora) + citas[id].duracionMin)) : aMinutos(franja.inicio);
  const necesarios = ultimaFin - aMinutos(franja.inicio);
  const alternativas = sucio || !agendaGuardada ? alternativasSiNoAlcanza(citados, franja, modo, p) : [];
  const problemas = revisarAgenda(citas, franja);
  const cambios = agendaGuardada ? cambiosEnCitados(agendaGuardada.citas, citados.map((c) => c.studentId)) : { entran: [], salen: [] };
  const nombreDe = (id: string) => { const e = estudiantes.find((x) => x.studentId === id); return e ? nombreCompleto(e) : id; };
  const ordenadas = ids.sort((a, b) => citas[a].hora.localeCompare(citas[b].hora) || nombreDe(a).localeCompare(nombreDe(b), 'es'));

  async function guardar() {
    setOcupado('guardar');
    setAviso(null);
    try {
      await guardarAgendaCitaciones({ anio: conv.anio, periodo: conv.periodo, sede, jornada: conv.jornada, grado, modo, parametros: p, citas }, !!agendaGuardada);
      const a = await leerAgendaCitaciones(idDoc);
      setAgendaGuardada(a);
      setSucio(false);
      setAviso({ tipo: 'ok', texto: 'Agenda guardada.' });
    } catch (e) {
      setAviso({ tipo: 'error', texto: e instanceof Error ? e.message : 'No se pudo guardar.' });
    } finally {
      setOcupado(null);
    }
  }

  async function registrar(idsEnvio: string[], campo: 'enviadaCorreoEn' | 'enviadaSmsEn' | 'impresaEn') {
    await marcarEnvioCitas(idDoc, idsEnvio, campo);
    const ahora = Date.now();
    setCitas((cs) => Object.fromEntries(Object.entries(cs).map(([id, c]) => [id, idsEnvio.includes(id) ? { ...c, [campo]: ahora } : c])));
  }

  const conCorreo = ordenadas.filter((id) => estudiantes.find((e) => e.studentId === id)?.correoInstitucional);
  async function enviarCorreos() {
    setOcupado('correo');
    setAviso(null);
    try {
      const res = await enviarCitacionesAlerta(grado, conCorreo.map((id) => {
        const e = estudiantes.find((x) => x.studentId === id)!;
        return {
          correo: e.correoInstitucional!, estudiante: nombreCompleto(e), fecha: fechaLarga(conv.fechaEntrega!),
          hora: horaLegible(citas[id].hora), general: citas[id].general, motivo: motivoCitacion(conv.periodo), director,
        };
      }));
      if (!res.ok) throw new Error(res.error ?? 'El servidor no envió los correos.');
      const enviados = new Set((res.enviados ?? []).map((c) => c.toLowerCase()));
      const ok = conCorreo.filter((id) => enviados.has(String(estudiantes.find((e) => e.studentId === id)?.correoInstitucional).toLowerCase()));
      await registrar(ok, 'enviadaCorreoEn');
      setAviso({ tipo: ok.length === conCorreo.length ? 'ok' : 'error', texto: `Correos enviados: ${ok.length} de ${conCorreo.length}.` });
    } catch (e) {
      setAviso({ tipo: 'error', texto: e instanceof Error ? e.message : 'No se pudieron enviar los correos.' });
    } finally {
      setOcupado(null);
    }
  }


  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-line bg-card p-4">
      <div>
        <h3 className="text-base font-semibold text-strong">Citaciones a acudientes</h3>
        <p className="text-xs text-muted">
          {fechaLarga(conv.fechaEntrega)} · de {horaLegible(franja.inicio)} a {horaLegible(franja.fin)} ({disponibles} min) ·
          {' '}{citados.length} por citar (dos o más alertas)
        </p>
      </div>

      {(cambios.entran.length > 0 || cambios.salen.length > 0) && (
        <div className="rounded-xl border border-warning-soft bg-warning-soft p-3 text-sm text-warning-soft-fg">
          <b>Su lista de citados cambió</b> desde que guardó la agenda (se reabrió la alerta o un docente corrigió).
          {cambios.entran.length > 0 && <p>Entran: {cambios.entran.map(nombreDe).join(', ')}. Recalcule o agréguelos a la agenda.</p>}
          {cambios.salen.map((s) => (
            <p key={s.studentId}>
              Sale: {nombreDe(s.studentId)}{s.yaEnviada ? ' — ya se le había enviado la citación: avísele que ya no hace falta venir.' : '.'}
            </p>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Forma de organizar">
        {MODOS.map((m) => (
          <button
            key={m.modo}
            title={m.ayuda}
            onClick={() => proponer(m.modo, p)}
            className={`min-h-[36px] rounded-full border px-3 text-sm ${modo === m.modo ? 'border-accent bg-accent-soft font-semibold text-accent-soft-fg' : 'border-line text-soft'}`}
          >
            {m.nombre}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-end gap-3 text-xs text-muted">
        {modo !== 'general' && (
          <>
            <label className="flex flex-col gap-1">Base (min)<input type="number" min={1} value={p.baseMin} onChange={(e) => proponer(modo, { ...p, baseMin: Math.max(1, +e.target.value) })} className={CAJA} /></label>
            <label className="flex flex-col gap-1">Por asignatura<input type="number" min={0} value={p.porAsignaturaMin} onChange={(e) => proponer(modo, { ...p, porAsignaturaMin: Math.max(0, +e.target.value) })} className={CAJA} /></label>
            <label className="flex flex-col gap-1">Entre turnos<input type="number" min={0} value={p.intervaloMin} onChange={(e) => proponer(modo, { ...p, intervaloMin: Math.max(0, +e.target.value) })} className={CAJA} /></label>
          </>
        )}
        {modo !== 'turnos' && (
          <label className="flex flex-col gap-1">Reunión (min)<input type="number" min={5} value={p.generalMin} onChange={(e) => proponer(modo, { ...p, generalMin: Math.max(5, +e.target.value) })} className={CAJA} /></label>
        )}
        {modo === 'mixta' && (
          <label className="flex flex-col gap-1">Turno desde (asig.)<input type="number" min={3} value={p.umbralIndividual} onChange={(e) => proponer(modo, { ...p, umbralIndividual: Math.max(3, +e.target.value) })} className={CAJA} /></label>
        )}
        <label className="flex flex-col gap-1">Orden
          <select value={p.orden} onChange={(e) => proponer(modo, { ...p, orden: e.target.value as ParametrosAgenda['orden'] })} className="rounded-lg border border-line bg-elevated px-2 py-1 text-sm text-strong">
            <option value="mas_asignaturas">Más asignaturas primero</option>
            <option value="alfabetico">Alfabético</option>
          </select>
        </label>
      </div>

      <div className={`rounded-xl px-3 py-2 text-sm ${necesarios <= disponibles ? 'bg-success-soft text-success-soft-fg' : 'bg-danger-soft text-danger-soft-fg'}`}>
        {necesarios <= disponibles
          ? <>Necesita {necesarios} min de {disponibles}: le sobran {disponibles - necesarios}.</>
          : <>Necesita {necesarios} min y tiene {disponibles}. Puede mover turnos a mano o elegir una opción:</>}
      </div>
      {necesarios > disponibles && alternativas.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {alternativas.map((a) => (
            <button key={a.etiqueta} onClick={() => proponer(a.modo, a.parametros)} className="rounded-xl border border-line px-3 py-2 text-left text-sm hover:bg-elevated">
              <b className="text-strong">{a.etiqueta}</b>
              <span className={`block text-xs ${a.alcanza ? 'text-success' : 'text-muted'}`}>{a.necesariosMin} min{a.alcanza ? ' · alcanza' : ''}</span>
            </button>
          ))}
        </div>
      )}

      <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line">
        {ordenadas.map((id) => {
          const c = citas[id];
          const n = citados.find((x) => x.studentId === id)?.asignaturas ?? 0;
          const prob = problemas.find((x) => x.studentId === id);
          const e = estudiantes.find((x) => x.studentId === id);
          const tel = e?.telefonos?.find((t) => enlaceSms(t));
          const sms = tel ? enlaceSms(tel, textoSmsCitacion({ estudiante: nombreDe(id), grado, fechaISO: conv.fechaEntrega!, hora: c.hora, general: c.general, periodo: conv.periodo, director })) : null;
          return (
            <li key={id} className="flex flex-wrap items-center gap-2 px-3 py-2">
              <input
                type="time"
                value={c.hora}
                onChange={(ev) => { setCitas((cs) => ({ ...cs, [id]: { ...cs[id], hora: ev.target.value || cs[id].hora } })); setSucio(true); }}
                className="rounded-lg border border-line bg-elevated px-2 py-1 text-sm text-strong"
                aria-label={`Hora de ${nombreDe(id)}`}
              />
              <span className="min-w-0 flex-1 text-sm text-strong">
                {nombreDe(id)}
                <span className="block text-xs text-muted">
                  {n} asignaturas · {c.general ? `reunión general (${c.duracionMin} min)` : `${c.duracionMin} min, hasta ${aHora(aMinutos(c.hora) + c.duracionMin)}`}
                  {prob && <span className="text-danger"> · {prob.tipo === 'fuera_de_franja' ? 'fuera de la franja' : 'se cruza con otro turno'}</span>}
                </span>
              </span>
              <span className="flex gap-1 text-xs" aria-label="Envíos">
                <span title="Correo" className={c.enviadaCorreoEn ? 'text-success' : 'text-muted'}>✉{c.enviadaCorreoEn ? '✓' : ''}</span>
                <span title="SMS" className={c.enviadaSmsEn ? 'text-success' : 'text-muted'}>💬{c.enviadaSmsEn ? '✓' : ''}</span>
              </span>
              {sms && agendaGuardada && !sucio ? (
                <a href={sms} onClick={() => void registrar([id], 'enviadaSmsEn')} className="rounded-lg border border-line px-2 py-1 text-xs text-accent">SMS</a>
              ) : (
                !tel && <span className="text-xs text-muted">sin celular</span>
              )}
            </li>
          );
        })}
      </ul>

      {aviso && <p className={`text-sm ${aviso.tipo === 'ok' ? 'text-success' : 'text-danger'}`}>{aviso.texto}</p>}

      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => void guardar()}
          disabled={!!ocupado || (!sucio && !!agendaGuardada) || problemas.length > 0}
          className="min-h-[40px] rounded-xl bg-accent px-4 text-sm font-semibold text-accent-fg disabled:opacity-50"
        >
          {ocupado === 'guardar' ? 'Guardando…' : agendaGuardada && !sucio ? 'Agenda guardada' : 'Guardar agenda'}
        </button>
        <button
          onClick={() => void enviarCorreos()}
          disabled={!!ocupado || sucio || !agendaGuardada || conCorreo.length === 0}
          className="min-h-[40px] rounded-xl border border-line px-4 text-sm font-semibold text-strong disabled:opacity-50"
        >
          {ocupado === 'correo' ? 'Enviando…' : `Enviar por correo (${conCorreo.length} de ${ordenadas.length})`}
        </button>
      </div>
      {problemas.length > 0 && <p className="text-xs text-danger">Corrija los turnos que se cruzan o se salen de la franja antes de guardar.</p>}
      {(sucio || !agendaGuardada) && <p className="text-xs text-muted">Guarde la agenda para poder enviar: así lo que llega a las familias es lo que queda registrado. Coordinación imprime las citaciones de las agendas guardadas.</p>}
      {ordenadas.length > conCorreo.length && (
        <p className="text-xs text-muted">{ordenadas.length - conCorreo.length} sin correo institucional registrado: les llegan el SMS y la citación impresa.</p>
      )}
    </section>
  );
}
