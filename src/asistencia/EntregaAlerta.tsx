import { useEffect, useMemo, useState } from 'react';
import { enviarCitacionesAlerta } from '../data/api';
import {
  cerrarEntrega,
  leerAgendaCitaciones,
  marcarAsistenciaEntrega,
  marcarAsistenciaReprogramada,
  marcarEnvioReprogramacion,
  registrarJustificacion,
  remitirCita,
  reprogramarCita,
} from './datos';
import { nombreCompleto } from './domain/nombres';
import { toDateKey } from './domain/ids';
import { enlaceSms } from './domain/telefonos';
import { citacionAlertaId, fechaCorta, motivoCitacion } from './domain/alerta-academica';
import { fechaLarga, horaLegible } from './domain/imprimibles-alerta';
import {
  diasHabilesSiguientes,
  PLAZO_EXCUSA_DIAS,
  seguimientoDe,
  textoSmsSegundaCitacion,
  type EstadoSeguimiento,
} from './domain/seguimiento-alerta';
import { diaSinClases, horasLibresDirector } from './horarioDelDia';
import type {
  AgendaCitaciones,
  CitaAlerta,
  ConvocatoriaAlerta,
  JustificacionInasistencia,
  MedioJustificacion,
  Sede,
  Student,
  TipoJustificacion,
} from './domain/types';

const ETIQUETA: Record<EstadoSeguimiento, { texto: string; clase: string }> = {
  pendiente_marcar: { texto: 'Sin marcar', clase: 'bg-elevated text-soft' },
  asistio: { texto: 'Vino', clase: 'bg-success-soft text-success-soft-fg' },
  esperando_excusa: { texto: 'Esperando excusa', clase: 'bg-info-soft text-info-soft-fg' },
  citar_simple: { texto: 'Justificó: falta la nueva citación', clase: 'bg-warning-soft text-warning-soft-fg' },
  citar_con_norma: { texto: 'No justificó: falta la nueva citación', clase: 'bg-warning-soft text-warning-soft-fg' },
  reprogramada: { texto: 'Nueva citación', clase: 'bg-info-soft text-info-soft-fg' },
  asistio_reprogramada: { texto: 'Vino a la segunda citación', clase: 'bg-success-soft text-success-soft-fg' },
  remitida: { texto: 'Remitido a coordinación', clase: 'bg-danger-soft text-danger-soft-fg' },
};

const MEDIOS: { id: MedioJustificacion; nombre: string }[] = [
  { id: 'escrito', nombre: 'Por escrito' },
  { id: 'mensaje', nombre: 'Por mensaje' },
  { id: 'llamada', nombre: 'Por llamada' },
  { id: 'en_persona', nombre: 'En persona' },
];

const MOTIVOS_REMISION = ['No contesta', 'Número errado o sin teléfono', 'No es posible acordar la cita', 'Otro'];

const CHIP = 'min-h-[34px] rounded-lg border px-3 text-sm';

/**
 * El dia de la entrega y el seguimiento — pantalla del DIRECTOR (Julian, 2026-10-03).
 *
 * 1. Marca quien vino (la firma en papel sigue siendo la prueba) y cierra la entrega.
 * 2. A quien no vino: registra la excusa dentro del plazo (3 dias habiles por defecto) y
 *    genera UNA nueva citacion en una de sus horas libres: simple si justifico, con el
 *    fundamento normativo si no.
 * 3. Si tampoco viene, o vencen los 5 dias habiles, el caso pasa a coordinacion.
 */
export default function EntregaAlerta({
  grado,
  sede,
  conv,
  estudiantes,
  director,
  slotDirector,
}: {
  grado: string;
  sede: Sede;
  conv: ConvocatoriaAlerta;
  estudiantes: Student[];
  director: string;
  slotDirector: string | null;
}) {
  const idDoc = citacionAlertaId(conv.anio, conv.periodo, sede, grado);
  const [agenda, setAgenda] = useState<AgendaCitaciones | null | undefined>(undefined);
  const [abierto, setAbierto] = useState<string | null>(null);
  const [aviso, setAviso] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const hoy = toDateKey(new Date());

  useEffect(() => { void leerAgendaCitaciones(idDoc).then(setAgenda); }, [idDoc]);

  const nombreDe = (id: string) => { const e = estudiantes.find((x) => x.studentId === id); return e ? nombreCompleto(e) : id; };
  const ctx = useMemo(() => conv.fechaEntrega ? {
    fechaEntrega: conv.fechaEntrega,
    entregaCerrada: !!agenda?.entregaCerradaEn,
    hoy,
    plazoExcusaDias: conv.plazoExcusaDias ?? PLAZO_EXCUSA_DIAS,
    sinClases: diaSinClases,
  } : null, [conv.fechaEntrega, conv.plazoExcusaDias, agenda?.entregaCerradaEn, hoy]);

  if (!conv.fechaEntrega || !ctx) return null;
  if (agenda === undefined) return <p className="p-3 text-sm text-muted">Cargando la entrega…</p>;
  if (!agenda || Object.keys(agenda.citas).length === 0) return null;
  if (hoy < conv.fechaEntrega) {
    return (
      <p className="rounded-xl bg-elevated px-3 py-2 text-sm text-soft">
        El {fechaLarga(conv.fechaEntrega)}, aquí marcará quién vino a la entrega y hará el seguimiento de quien no.
      </p>
    );
  }

  const ids = Object.keys(agenda.citas).sort((a, b) => agenda.citas[a].hora.localeCompare(agenda.citas[b].hora));
  const estado = (id: string) => seguimientoDe(agenda.citas[id], ctx);
  const cerrada = !!agenda.entregaCerradaEn;

  // Cambio local optimista de una cita (la escritura va por `escribirCita`, sin esperar acuse).
  const local = (id: string, cambio: (c: CitaAlerta) => CitaAlerta) =>
    setAgenda((a) => (a ? { ...a, citas: { ...a.citas, [id]: cambio(a.citas[id]) } } : a));

  async function hacer(f: () => Promise<void>, ok?: string) {
    setOcupado(true);
    setAviso(null);
    try {
      await f();
      if (ok) setAviso({ tipo: 'ok', texto: ok });
    } catch (e) {
      setAviso({ tipo: 'error', texto: e instanceof Error ? e.message : 'No se pudo guardar.' });
    } finally {
      setOcupado(false);
    }
  }

  // ── 1. Dia de la entrega: marcar asistencia ─────────────────────────────────
  if (!cerrada) {
    const sinMarcar = ids.filter((id) => agenda.citas[id].asistio == null);
    const vinieron = ids.filter((id) => agenda.citas[id].asistio === true).length;
    return (
      <section className="flex flex-col gap-3 rounded-2xl border border-line bg-card p-4">
        <div>
          <h3 className="text-base font-semibold text-strong">Día de la entrega · {fechaLarga(conv.fechaEntrega)}</h3>
          <p className="text-xs text-muted">Marque quién vino mientras firman la lista, o al final mirándola. {vinieron} de {ids.length} han venido.</p>
        </div>
        <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line">
          {ids.map((id) => {
            const c = agenda.citas[id];
            return (
              <li key={id} className="flex flex-wrap items-center gap-2 px-3 py-2">
                <span className="w-16 text-sm text-muted">{horaLegible(c.hora)}</span>
                <span className="min-w-0 flex-1 text-sm text-strong">{nombreDe(id)}</span>
                {([true, false] as const).map((v) => (
                  <button
                    key={String(v)}
                    onClick={() => {
                      const nuevo = c.asistio === v ? null : v;
                      local(id, (x) => ({ ...x, asistio: nuevo }));
                      void marcarAsistenciaEntrega(idDoc, id, nuevo);
                    }}
                    className={`${CHIP} ${c.asistio === v
                      ? v ? 'border-success bg-success-soft font-semibold text-success-soft-fg' : 'border-danger bg-danger-soft font-semibold text-danger-soft-fg'
                      : 'border-line text-soft'}`}
                  >
                    {v ? 'Vino' : 'No vino'}
                  </button>
                ))}
              </li>
            );
          })}
        </ul>
        {aviso && <p className={`text-sm ${aviso.tipo === 'ok' ? 'text-success' : 'text-danger'}`}>{aviso.texto}</p>}
        <button
          disabled={ocupado}
          onClick={() => void hacer(async () => {
            await cerrarEntrega(idDoc, sinMarcar);
            setAgenda(await leerAgendaCitaciones(idDoc));
          }, 'Entrega cerrada.')}
          className="min-h-[44px] self-start rounded-xl bg-accent px-4 text-sm font-semibold text-accent-fg disabled:opacity-50"
        >
          Cerrar la entrega{sinMarcar.length ? ` (${sinMarcar.length} sin marcar quedarán como «no vino»)` : ''}
        </button>
      </section>
    );
  }

  // ── 2. Seguimiento de quien no vino ─────────────────────────────────────────
  const ausentes = ids.filter((id) => agenda.citas[id].asistio === false);
  const resumen = {
    vinieron: ids.filter((id) => ['asistio', 'asistio_reprogramada'].includes(estado(id).estado)).length,
    pendientes: ausentes.filter((id) => ['citar_simple', 'citar_con_norma'].includes(estado(id).estado)).length,
  };

  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-line bg-card p-4">
      <div>
        <h3 className="text-base font-semibold text-strong">Seguimiento de la entrega</h3>
        <p className="text-xs text-muted">
          {resumen.vinieron} de {ids.length} acudientes atendidos · {ausentes.length} no vinieron
          {resumen.pendientes > 0 && <b className="text-warning-soft-fg"> · {resumen.pendientes} esperan su nueva citación</b>}
        </p>
      </div>
      {ausentes.length === 0 && <p className="text-sm text-success">Vinieron todos los acudientes citados.</p>}
      <ul className="flex flex-col gap-2">
        {ausentes.map((id) => {
          const s = estado(id);
          const c = agenda.citas[id];
          const et = ETIQUETA[s.estado];
          return (
            <li key={id} className="rounded-xl border border-line p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="min-w-0 flex-1 text-sm font-medium text-strong">{nombreDe(id)}</span>
                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${et.clase}`}>{et.texto}</span>
                {s.estado !== 'remitida' && s.estado !== 'asistio_reprogramada' && (
                  <button onClick={() => setAbierto(abierto === id ? null : id)} className="text-xs text-accent">
                    {abierto === id ? 'Cerrar' : 'Gestionar'}
                  </button>
                )}
              </div>
              <p className="mt-1 text-xs text-muted">
                {s.estado === 'esperando_excusa' && <>Plazo para la excusa: hasta el {fechaLarga(s.venceExcusa)}.</>}
                {(s.estado === 'citar_simple' || s.estado === 'citar_con_norma') && <>Genere la nueva citación antes del {fechaLarga(s.venceReprogramar)}, o el caso pasará a coordinación.</>}
                {c.justificacion && <> Justificó {c.justificacion.tipo === 'aviso_previo' ? '(avisó antes)' : ''} {MEDIOS.find((m) => m.id === c.justificacion!.medio)?.nombre.toLowerCase()}{c.justificacion.nota ? `: «${c.justificacion.nota}»` : ''}.</>}
                {c.reprogramacion && <> Citado de nuevo el {fechaLarga(c.reprogramacion.fecha)} a las {horaLegible(c.reprogramacion.hora)}{c.reprogramacion.conFundamento ? ' (con fundamento normativo)' : ''}.</>}
                {s.estado === 'remitida' && <> Motivo: {s.motivoRemision}.</>}
              </p>
              {abierto === id && (
                <Gestion
                  estado={s.estado}
                  cita={c}
                  venceReprogramar={s.venceReprogramar}
                  hoy={hoy}
                  estudiante={estudiantes.find((x) => x.studentId === id)}
                  nombre={nombreDe(id)}
                  grado={grado}
                  conv={conv}
                  director={director}
                  slotDirector={slotDirector}
                  ocupado={ocupado}
                  onJustificar={(j) => void hacer(async () => {
                    await registrarJustificacion(idDoc, id, j);
                    local(id, (x) => ({ ...x, justificacion: { ...j, registradaPor: '', registradaEn: Date.now() } }));
                  }, 'Justificación registrada.')}
                  onReprogramar={(fecha, hora) => void hacer(async () => {
                    const conFundamento = s.estado === 'citar_con_norma';
                    await reprogramarCita(idDoc, id, { fecha, hora, conFundamento });
                    local(id, (x) => ({ ...x, reprogramacion: { fecha, hora, conFundamento, creadaPor: '', creadaEn: Date.now(), enviadaCorreoEn: null, enviadaSmsEn: null, asistio: null } }));
                  }, 'Nueva citación creada. Envíela por correo o SMS; la impresa sale en el archivo de seguimiento de coordinación.')}
                  onEnviado={(campo) => void hacer(async () => {
                    await marcarEnvioReprogramacion(idDoc, [id], campo);
                    local(id, (x) => ({ ...x, reprogramacion: x.reprogramacion ? { ...x.reprogramacion, [campo]: Date.now() } : x.reprogramacion }));
                  })}
                  onAsistioReprogramada={(v) => void hacer(async () => {
                    await marcarAsistenciaReprogramada(idDoc, id, v);
                    local(id, (x) => ({ ...x, reprogramacion: x.reprogramacion ? { ...x.reprogramacion, asistio: v } : x.reprogramacion }));
                  }, v ? 'Asistencia registrada.' : 'No asistió: el caso pasó a coordinación.')}
                  onRemitir={(motivo) => void hacer(async () => {
                    await remitirCita(idDoc, id, motivo);
                    local(id, (x) => ({ ...x, remision: { motivo, remitidaPor: '', remitidaEn: Date.now() } }));
                    setAbierto(null);
                  }, 'Remitido a coordinación.')}
                  onError={(texto) => setAviso({ tipo: 'error', texto })}
                />
              )}
            </li>
          );
        })}
      </ul>
      {aviso && <p className={`text-sm ${aviso.tipo === 'ok' ? 'text-success' : 'text-danger'}`}>{aviso.texto}</p>}
    </section>
  );
}

function Gestion({
  estado, cita, venceReprogramar, hoy, estudiante, nombre, grado, conv, director, slotDirector, ocupado,
  onJustificar, onReprogramar, onEnviado, onAsistioReprogramada, onRemitir, onError,
}: {
  estado: EstadoSeguimiento;
  cita: CitaAlerta;
  venceReprogramar: string;
  hoy: string;
  estudiante: Student | undefined;
  nombre: string;
  grado: string;
  conv: ConvocatoriaAlerta;
  director: string;
  slotDirector: string | null;
  ocupado: boolean;
  onJustificar: (j: Omit<JustificacionInasistencia, 'registradaPor' | 'registradaEn'>) => void;
  onReprogramar: (fecha: string, hora: string) => void;
  onEnviado: (campo: 'enviadaCorreoEn' | 'enviadaSmsEn') => void;
  onAsistioReprogramada: (v: boolean) => void;
  onRemitir: (motivo: string) => void;
  onError: (texto: string) => void;
}) {
  const [tipo, setTipo] = useState<TipoJustificacion>('posterior');
  const [medio, setMedio] = useState<MedioJustificacion>('mensaje');
  const [nota, setNota] = useState('');
  const [fecha, setFecha] = useState('');
  const [hora, setHora] = useState('');
  const [motivo, setMotivo] = useState(MOTIVOS_REMISION[0]);

  // Horas libres del director entre hoy y el limite para reprogramar.
  const libres = useMemo(() => {
    const dias = diasHabilesSiguientes(hoy, 5, diaSinClases).filter((d) => d <= venceReprogramar);
    return horasLibresDirector(slotDirector, conv.jornada, dias);
  }, [hoy, venceReprogramar, slotDirector, conv.jornada]);

  const rep = cita.reprogramacion;
  const sms = rep && estudiante?.telefonos?.find((t) => enlaceSms(t));
  const enlace = rep && sms ? enlaceSms(sms, textoSmsSegundaCitacion({
    estudiante: nombre, grado, fechaCorta: fechaCorta(rep.fecha), hora: horaLegible(rep.hora), conFundamento: rep.conFundamento, director,
  })) : null;

  async function correo() {
    if (!rep || !estudiante?.correoInstitucional) return;
    const r = await enviarCitacionesAlerta(grado, [{
      correo: estudiante.correoInstitucional, estudiante: nombre, fecha: fechaLarga(rep.fecha), hora: horaLegible(rep.hora),
      general: false, motivo: motivoCitacion(conv.periodo), director,
      seguimiento: { fechaEntrega: fechaLarga(conv.fechaEntrega!), conFundamento: rep.conFundamento },
    }]).catch((e) => ({ ok: false, error: e instanceof Error ? e.message : String(e) }));
    if (r.ok) onEnviado('enviadaCorreoEn');
    else onError(r.error ?? 'No se pudo enviar el correo.');
  }

  return (
    <div className="mt-2 flex flex-col gap-3 border-t border-line pt-3 text-sm">
      {/* Justificacion: mientras no haya nueva citacion */}
      {!rep && (estado === 'esperando_excusa' || estado === 'citar_con_norma' || estado === 'citar_simple') && (
        <div className="flex flex-col gap-2">
          <p className="text-xs font-semibold text-strong">¿Justificó su inasistencia?</p>
          <div className="flex flex-wrap gap-2">
            <select value={tipo} onChange={(e) => setTipo(e.target.value as TipoJustificacion)} className="rounded-lg border border-line bg-elevated px-2 py-1 text-strong">
              <option value="posterior">Justificó después</option>
              <option value="aviso_previo">Avisó antes de la cita</option>
            </select>
            <select value={medio} onChange={(e) => setMedio(e.target.value as MedioJustificacion)} className="rounded-lg border border-line bg-elevated px-2 py-1 text-strong">
              {MEDIOS.map((m) => <option key={m.id} value={m.id}>{m.nombre}</option>)}
            </select>
            <input value={nota} onChange={(e) => setNota(e.target.value.slice(0, 200))} placeholder="Motivo, en pocas palabras" className="min-w-[12rem] flex-1 rounded-lg border border-line bg-elevated px-2 py-1 text-strong" />
            <button disabled={ocupado} onClick={() => onJustificar({ tipo, medio, nota: nota.trim() })} className={`${CHIP} border-line text-strong`}>Registrar</button>
          </div>
        </div>
      )}

      {/* Nueva citacion: una sola */}
      {!rep && (estado === 'citar_simple' || estado === 'citar_con_norma') && (
        <div className="flex flex-col gap-2">
          <p className="text-xs font-semibold text-strong">
            Generar nueva citación {estado === 'citar_con_norma' ? '(con fundamento normativo: no justificó)' : '(simple: justificó)'}
          </p>
          {libres.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {libres.slice(0, 12).map((h) => (
                <button
                  key={`${h.fecha}_${h.bloque}`}
                  onClick={() => { setFecha(h.fecha); setHora(h.inicio); }}
                  className={`${CHIP} ${fecha === h.fecha && hora === h.inicio ? 'border-accent bg-accent-soft font-semibold text-accent-soft-fg' : 'border-line text-soft'}`}
                >
                  {fechaCorta(h.fecha)} · {horaLegible(h.inicio)}
                </button>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted">No encontré horas libres en su horario: escriba la que acordó con el acudiente.</p>
          )}
          <div className="flex flex-wrap items-end gap-2">
            <label className="flex flex-col gap-1 text-xs text-muted">Fecha<input type="date" min={hoy} max={venceReprogramar} value={fecha} onChange={(e) => setFecha(e.target.value)} className="rounded-lg border border-line bg-elevated px-2 py-1 text-sm text-strong" /></label>
            <label className="flex flex-col gap-1 text-xs text-muted">Hora<input type="time" value={hora} onChange={(e) => setHora(e.target.value)} className="rounded-lg border border-line bg-elevated px-2 py-1 text-sm text-strong" /></label>
            <button disabled={ocupado || !fecha || !hora} onClick={() => onReprogramar(fecha, hora)} className="min-h-[36px] rounded-xl bg-accent px-3 text-sm font-semibold text-accent-fg disabled:opacity-50">
              Generar nueva citación
            </button>
          </div>
          <p className="text-xs text-muted">Solo hay una reprogramación: si tampoco viene, el caso pasa a coordinación.</p>
        </div>
      )}

      {/* Envio y asistencia a la segunda citacion */}
      {rep && (
        <div className="flex flex-wrap items-center gap-2">
          <button disabled={ocupado || !estudiante?.correoInstitucional} onClick={() => void correo()} className={`${CHIP} border-line text-strong disabled:opacity-50`}>
            Correo{rep.enviadaCorreoEn ? ' ✓' : ''}
          </button>
          {enlace ? (
            <a href={enlace} onClick={() => onEnviado('enviadaSmsEn')} className={`${CHIP} flex items-center border-line text-accent`}>SMS{rep.enviadaSmsEn ? ' ✓' : ''}</a>
          ) : <span className="text-xs text-muted">sin celular</span>}
          {hoy >= rep.fecha && rep.asistio == null && (
            <>
              <span className="text-xs text-muted">¿Vino a la nueva cita?</span>
              <button disabled={ocupado} onClick={() => onAsistioReprogramada(true)} className={`${CHIP} border-line text-strong`}>Vino</button>
              <button disabled={ocupado} onClick={() => onAsistioReprogramada(false)} className={`${CHIP} border-line text-strong`}>No vino</button>
            </>
          )}
        </div>
      )}

      {/* Remitir a mano */}
      <div className="flex flex-wrap items-center gap-2 border-t border-line pt-2">
        <span className="text-xs text-muted">¿No es posible?</span>
        <select value={motivo} onChange={(e) => setMotivo(e.target.value)} className="rounded-lg border border-line bg-elevated px-2 py-1 text-xs text-strong">
          {MOTIVOS_REMISION.map((m) => <option key={m}>{m}</option>)}
        </select>
        <button disabled={ocupado} onClick={() => onRemitir(motivo)} className={`${CHIP} border-line text-xs text-danger`}>Remitir a coordinación</button>
      </div>
    </div>
  );
}
