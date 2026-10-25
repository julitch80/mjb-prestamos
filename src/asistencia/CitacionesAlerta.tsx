import { useEffect, useMemo, useRef, useState } from 'react';
import { enviarCitacionesAlerta } from '../data/api';
import { guardarAgendaCitaciones, leerAgendaCitaciones, marcarEnvioCitas } from './datos';
import { nombreCompleto } from './domain/nombres';
import { enlaceSms } from './domain/telefonos';
import {
  aHora,
  aMinutos,
  cambiosEnCitados,
  citacionAlertaId,
  describirMetodo,
  metodoDeConvocatoria,
  mismoMetodo,
  motivoCitacion,
  NOMBRE_MODO,
  PARAMETROS_POR_DEFECTO,
  agendaSinDecisiones,
  proponerAgenda,
  revisarAgenda,
  textoSmsCitacion,
  type Citado,
  type FilaConsolidado,
  type MetodoAgenda,
} from './domain/alerta-academica';
import { fechaLarga, horaLegible } from './domain/imprimibles-alerta';
import type { AgendaCitaciones, BandaAgenda, CitaAlerta, ConvocatoriaAlerta, ModoAgenda, ParametrosAgenda, Sede, Student } from './domain/types';

/**
 * Citaciones de la alerta — la agenda del DIRECTOR (Julian, 2026-10-02).
 *
 * Coordinacion fija el dia, la franja y la FORMA de citar —turnos, reunion general o mixta,
 * con sus parametros— (el colegio, 2026-10-22: el director ya no la elige). Con esa forma se
 * le propone la agenda de sus citados (dos o mas alertas) y la cuenta de si alcanza el
 * tiempo; el director puede mover horas a mano para encajarla, la guarda y despues envia las de su grupo: correo al institucional del estudiante, SMS desde su
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
  // Con que forma esta armada la agenda que se ve: la de coordinacion al proponer, o la que
  // trae la agenda guardada (puede ser anterior al cambio). Es lo que se guarda en la agenda.
  const [modo, setModo] = useState<ModoAgenda>('turnos');
  const [p, setP] = useState<ParametrosAgenda>(PARAMETROS_POR_DEFECTO);
  const [bandas, setBandas] = useState<BandaAgenda[] | null>(null);
  const [citas, setCitas] = useState<Record<string, CitaAlerta>>({});
  const [sucio, setSucio] = useState(false);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [aviso, setAviso] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null);

  const franja = conv.franjaInicio && conv.franjaFin ? { inicio: conv.franjaInicio, fin: conv.franjaFin } : null;
  const metodo = metodoDeConvocatoria(conv);

  const citados: Citado[] = useMemo(
    () => filas.filter((f) => f.citar).flatMap((f) => {
      const e = estudiantes.find((x) => x.studentId === f.studentId);
      return e ? [{ studentId: f.studentId, nombre: nombreCompleto(e), asignaturas: f.total }] : [];
    }),
    [filas, estudiantes],
  );

  const vacia = (c: Pick<CitaAlerta, 'hora' | 'duracionMin' | 'general'>): CitaAlerta => ({ ...c, enviadaCorreoEn: null, enviadaSmsEn: null, impresaEn: null });

  // Solo con la forma de coordinacion: el director no propone con otra.
  function proponer(m: MetodoAgenda) {
    if (!franja) return;
    const r = proponerAgenda(citados, franja, m.modo, m.parametros, m.bandas);
    // Conserva las marcas de envio de quien ya estaba: recalcular no borra lo enviado.
    setCitas((antes) => Object.fromEntries(Object.entries(r.citas).map(([id, c]) => [id, { ...vacia(c), ...pick(antes[id]) }])));
    setModo(m.modo);
    setP(m.parametros);
    setBandas(m.bandas ?? null);
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
      if (a) { setModo(a.modo); setP(a.parametros); setBandas(a.bandas ?? null); setCitas(a.citas); setSucio(false); }
    });
  }, [idDoc]);

  // Sin agenda guardada: la primera propuesta sale sola, con la forma de coordinacion. Sin
  // forma fijada no se propone nada (ver el aviso de abajo).
  const claveMetodo = metodo ? JSON.stringify(metodo) : null;
  useEffect(() => {
    if (agendaGuardada === null && metodo && franja && citados.length && Object.keys(citas).length === 0) proponer(metodo);
  }, [agendaGuardada, franja?.inicio, franja?.fin, citados.length, claveMetodo]); // eslint-disable-line react-hooks/exhaustive-deps

  // REUNION GENERAL: no hay nada que decidir, asi que la primera propuesta se guarda sola
  // (Julian, 2026-10-22). Sin esto, el grupo cuyo director no pulsaba «Guardar agenda» se
  // quedaba sin citaciones en el archivo de impresion. Una sola vez por pantalla.
  const autoGuardada = useRef(false);
  useEffect(() => {
    // Tambien la MIXTA POR RANGOS (2026-10-23): la hora la da el rango, no el director. Y si
    // la agenda guardada se armo con OTRA forma (coordinacion la cambio despues), se vuelve a
    // proponer con la vigente —conservando envios y asistencia— y se guarda sola.
    if (autoGuardada.current || agendaGuardada === undefined || !agendaSinDecisiones(metodo) || !metodo || !franja) return;
    const vieja = !!agendaGuardada && !mismoMetodo(
      { modo: agendaGuardada.modo, parametros: agendaGuardada.parametros, bandas: agendaGuardada.bandas ?? null }, metodo);
    if (agendaGuardada !== null && !vieja) return;
    if (vieja && !sucio) { proponer(metodo); return; }
    if (!sucio || modo !== metodo.modo || Object.keys(citas).length === 0) return;
    autoGuardada.current = true;
    const yaEnviadas = vieja
      ? Object.values(agendaGuardada!.citas).filter((c) => c.enviadaCorreoEn || c.enviadaSmsEn || c.impresaEn).length
      : 0;
    void guardar().then(() => {
      if (yaEnviadas > 0) {
        setAviso({ tipo: 'ok', texto: `Coordinación cambió la forma de citar y su agenda se actualizó sola. ${yaEnviadas === 1 ? 'Una familia ya había recibido' : `${yaEnviadas} familias ya habían recibido`} la citación con la hora anterior: vuelva a enviársela.` });
      }
    });
  }); // eslint-disable-line react-hooks/exhaustive-deps

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
  // Sin forma de citar y sin agenda: no hay con que proponer. Con agenda guardada (armada
  // antes del cambio) se sigue mostrando: puede estar ya enviada a las familias.
  if (!metodo && !agendaGuardada) {
    return (
      <div className="rounded-2xl border border-line bg-card p-4 text-sm text-muted">
        Coordinación todavía no ha definido la forma de citar a los acudientes (turnos individuales, reunión general o mixta).
        Cuando la defina, aquí le aparecerá la agenda propuesta para su grupo.
      </div>
    );
  }

  const disponibles = aMinutos(franja.fin) - aMinutos(franja.inicio);
  const ids = Object.keys(citas);
  const ultimaFin = ids.length ? Math.max(...ids.map((id) => aMinutos(citas[id].hora) + citas[id].duracionMin)) : aMinutos(franja.inicio);
  const necesarios = ultimaFin - aMinutos(franja.inicio);
  // La agenda que se ve, ¿esta armada con la forma vigente de coordinacion?
  const desfasada = !!metodo && !mismoMetodo({ modo, parametros: p, bandas }, metodo);
  const yaEnviadas = ids.filter((id) => citas[id].enviadaCorreoEn || citas[id].enviadaSmsEn || citas[id].impresaEn).length;
  const problemas = revisarAgenda(citas, franja);
  const cambios = agendaGuardada ? cambiosEnCitados(agendaGuardada.citas, citados.map((c) => c.studentId)) : { entran: [], salen: [] };
  const nombreDe = (id: string) => { const e = estudiantes.find((x) => x.studentId === id); return e ? nombreCompleto(e) : id; };
  const ordenadas = ids.sort((a, b) => citas[a].hora.localeCompare(citas[b].hora) || nombreDe(a).localeCompare(nombreDe(b), 'es'));

  async function guardar() {
    setOcupado('guardar');
    setAviso(null);
    try {
      await guardarAgendaCitaciones({ anio: conv.anio, periodo: conv.periodo, sede, jornada: conv.jornada, grado, modo, parametros: p, bandas, citas }, !!agendaGuardada);
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
          {cambios.entran.length > 0 && <p>Entran: {cambios.entran.map(nombreDe).join(', ')}. {metodo ? 'Use «Volver a proponer» para incluirlos.' : 'Para incluirlos, coordinación tiene que definir la forma de citar.'}</p>}
          {cambios.salen.map((s) => (
            <p key={s.studentId}>
              Sale: {nombreDe(s.studentId)}{s.yaEnviada ? ' — ya se le había enviado la citación: avísele que ya no hace falta venir.' : '.'}
            </p>
          ))}
        </div>
      )}

      {/* La forma de citar la define coordinacion (2026-10-22): aqui solo se lee. */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-line px-3 py-2 text-sm">
        <span className="min-w-0 flex-1">
          <span className="block text-xs text-muted">Forma de citar (la define coordinación)</span>
          {metodo
            ? <span className="text-strong">{describirMetodo(metodo)}</span>
            : <span className="text-strong">Coordinación aún no la ha definido. Su agenda guardada ({NOMBRE_MODO[modo]}) sigue valiendo: puede mover horas, guardarla y enviarla.</span>}
        </span>
        {metodo && (
          <button
            onClick={() => proponer(metodo)}
            disabled={!!ocupado}
            title="Vuelve a repartir las horas con la forma que definió coordinación. Se pierden los cambios hechos a mano; los envíos registrados se conservan."
            className="min-h-[44px] rounded-xl border border-line px-3 text-sm text-strong disabled:opacity-50"
          >
            Volver a proponer
          </button>
        )}
      </div>

      {desfasada && (
        <div className="rounded-xl border border-warning-soft bg-warning-soft p-3 text-sm text-warning-soft-fg">
          <b>Coordinación cambió la forma de citar</b> después de que se armó esta agenda (la suya está como {NOMBRE_MODO[modo]}{modo === metodo?.modo ? ', con otros tiempos' : ''}).
          {' '}Use «Volver a proponer» para ajustarla y guárdela.
          {yaEnviadas > 0 && <> {yaEnviadas === 1 ? 'A 1 familia' : `A ${yaEnviadas} familias`} ya se le envió la citación: si cambia su hora, vuelva a enviársela.</>}
        </div>
      )}

      <div className={`rounded-xl px-3 py-2 text-sm ${necesarios <= disponibles ? 'bg-success-soft text-success-soft-fg' : 'bg-danger-soft text-danger-soft-fg'}`}>
        {necesarios <= disponibles
          ? <>Necesita {necesarios} min de {disponibles}: le sobran {disponibles - necesarios}.</>
          : <>Necesita {necesarios} min y tiene {disponibles}. Puede mover turnos a mano o pedirle a coordinación que ajuste la forma de citar o la franja.</>}
      </div>

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
