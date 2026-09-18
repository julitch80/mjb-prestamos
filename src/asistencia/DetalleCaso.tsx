import { useCallback, useEffect, useMemo, useState } from 'react';

import { corregirSeguimiento, crearSeguimiento, leerSeguimientos, remitirAlDirector } from './datos';
import { toDateKey } from './domain/ids';
import {
  ESTADO_CASO_ETIQUETA,
  ESTADO_DISTRITO,
  ESTADOS_ABIERTOS,
  ESTADOS_CIERRE,
  etiquetaDeMotivo,
  GESTION_ETIQUETA,
  PERSONA_CONTACTADA_ETIQUETA,
  RESULTADO_ETIQUETA,
  type CasoPermanencia,
  type EstadoCierre,
  type PermanenciaConfig,
} from './domain/permanencia';
import {
  alertaDeSeguimiento,
  APOYO_ETIQUETA,
  RESPONSABLE_ETIQUETA,
  seguimientosVigentes,
  TIPO_SEGUIMIENTO_ETIQUETA,
  validarSeguimiento,
  type ApoyoArticulacion,
  type BorradorSeguimiento,
  type CamposSeguimiento,
  type DecisionSeguimiento,
  type ResponsableSeguimiento,
  type SeguimientoCaso,
  type SeguimientoVigente,
  type TipoSeguimiento,
} from './domain/seguimiento-caso';
import type { FamilyContact, Student } from './domain/types';

/**
 * El detalle de un caso de permanencia: su historia y lo que sigue (2026-09-17).
 *
 * Dos modos, según quién lo abre:
 *  - `gestion` (coordinación de la sede y rectoría): registra seguimientos que DECIDEN
 *    —programar el siguiente, marcar «no ubicado», cerrar—, corrige los existentes y
 *    remite al director de grupo.
 *  - `aporte` (el director de grupo, SOLO si coordinación le remitió el caso): registra lo
 *    que hizo —típicamente el diálogo con el estudiante—, sin decidir el rumbo del caso.
 *    Las reglas imponen lo mismo; esta pantalla solo evita ofrecer lo que fallaría.
 */
export default function DetalleCaso({
  caso,
  estudiante,
  contactos,
  config,
  modo,
  onCambio,
}: {
  caso: CasoPermanencia;
  estudiante?: Student;
  /** Las llamadas a la familia de ESTE estudiante. Entran solas a la línea de tiempo. */
  contactos: FamilyContact[];
  config: PermanenciaConfig;
  modo: 'gestion' | 'aporte';
  /** Tras cualquier escritura, para que la lista de casos se relea. */
  onCambio: () => Promise<void>;
}) {
  const [seguimientos, setSeguimientos] = useState<SeguimientoCaso[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [agregando, setAgregando] = useState(false);
  const [corrigiendo, setCorrigiendo] = useState<SeguimientoVigente | null>(null);
  const hoy = toDateKey(new Date());

  const recargar = useCallback(async () => {
    try {
      setSeguimientos(await leerSeguimientos(caso.casoId));
    } catch (e) {
      setError(`No se pudieron leer los seguimientos: ${(e as Error).message}`);
    } finally {
      setCargando(false);
    }
  }, [caso.casoId]);

  useEffect(() => {
    void recargar();
  }, [recargar]);

  const vigentes = useMemo(() => seguimientosVigentes(seguimientos), [seguimientos]);
  const llamadasDelCaso = useMemo(
    () => contactos.filter((c) => c.fecha >= caso.fechaApertura),
    [contactos, caso.fechaApertura],
  );
  const alerta = alertaDeSeguimiento({ caso, seguimientos, contactos, config, hoy });
  const abierto = ESTADOS_ABIERTOS.includes(caso.estado);

  async function trasEscribir() {
    await recargar();
    await onCambio();
  }

  return (
    <div className="space-y-3 border-t border-line pt-3">
      {/* ---- Estado y lo que sigue ---- */}
      <div className="text-xs text-muted">
        <p>
          Abierto el {caso.fechaApertura} por {caso.abiertoPor.split('@')[0]}. Motivo de apertura:{' '}
          {caso.criterioQueLoAbrio}
        </p>
        <p className="mt-1">
          Estado: <b className="text-strong">{ESTADO_CASO_ETIQUETA[caso.estado]}</b> · para el Distrito:{' '}
          {ESTADO_DISTRITO[caso.estado]}
        </p>
        {abierto && caso.proximoSeguimiento && (
          <p className="mt-1">
            Próximo seguimiento: <b className="text-strong">{caso.proximoSeguimiento}</b>
            {caso.responsableSeguimiento &&
              `, a cargo de ${RESPONSABLE_ETIQUETA[caso.responsableSeguimiento as ResponsableSeguimiento]?.toLowerCase() ?? caso.responsableSeguimiento}`}
          </p>
        )}
        {!abierto && caso.motivoCierre && <p className="mt-1">Por qué se cerró: {caso.motivoCierre}</p>}
      </div>

      {alerta.vencido && (
        <p className="rounded-lg border border-danger-soft bg-danger-soft p-2 text-sm text-danger-soft-fg">
          <b>Seguimiento vencido.</b> {alerta.razon}
        </p>
      )}

      {modo === 'gestion' && <Remision caso={caso} onCambio={trasEscribir} />}
      {modo === 'aporte' && caso.remisionNota && (
        <p className="rounded-lg border border-info-soft bg-info-soft p-2 text-xs text-info-soft-fg">
          Coordinación le remitió este caso: «{caso.remisionNota}»
        </p>
      )}

      {/* ---- Línea de tiempo ---- */}
      <div>
        <p className="text-xs font-semibold text-strong">Lo que se ha hecho</p>
        {cargando ? (
          <p className="text-xs text-muted">Cargando…</p>
        ) : (
          <LineaDeTiempo
            vigentes={vigentes}
            llamadas={llamadasDelCaso}
            caso={caso}
            config={config}
            puedeCorregir={modo === 'gestion'}
            onCorregir={setCorrigiendo}
          />
        )}
      </div>

      {error && <p className="text-xs text-danger-soft-fg">{error}</p>}

      {corrigiendo && (
        <FormularioCorreccion
          original={corrigiendo}
          onCancelar={() => setCorrigiendo(null)}
          onGuardado={async () => {
            setCorrigiendo(null);
            await trasEscribir();
          }}
        />
      )}

      {agregando ? (
        <FormularioSeguimiento
          caso={caso}
          estudiante={estudiante}
          modo={modo}
          hoy={hoy}
          onCancelar={() => setAgregando(false)}
          onGuardado={async () => {
            setAgregando(false);
            await trasEscribir();
          }}
        />
      ) : (
        <button
          onClick={() => setAgregando(true)}
          className="rounded-lg bg-accent px-3 py-1.5 text-sm text-accent-fg"
        >
          {abierto ? '+ Agregar seguimiento' : 'Reabrir con un seguimiento'}
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

function Remision({ caso, onCambio }: { caso: CasoPermanencia; onCambio: () => Promise<void> }) {
  const [nota, setNota] = useState('');
  const [abierta, setAbierta] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function cambiar(remitir: boolean) {
    setError(null);
    try {
      await remitirAlDirector(caso.casoId, remitir, remitir ? nota : null);
      setAbierta(false);
      setNota('');
      await onCambio();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  if (caso.remitidoDirector) {
    return (
      <div className="rounded-lg border border-info-soft bg-info-soft p-2 text-xs text-info-soft-fg">
        Remitido al director de grupo el {caso.remitidoEn}
        {caso.remisionNota ? `: «${caso.remisionNota}»` : ''}. Él puede ver el caso y agregar lo que haga.{' '}
        <button onClick={() => void cambiar(false)} className="underline">
          Retirar la remisión
        </button>
        {error && <span className="block text-danger-soft-fg">{error}</span>}
      </div>
    );
  }

  return abierta ? (
    <div className="rounded-lg border border-line p-2 text-xs">
      <p className="text-muted">
        El director de grupo verá este caso —incluida la causa que informó la familia— y podrá agregar lo que
        haga. No podrá cerrarlo ni programar seguimientos.
      </p>
      <input
        value={nota}
        onChange={(e) => setNota(e.target.value)}
        placeholder="Qué se le pide (ej.: hablar con el estudiante esta semana)"
        className="mt-1 w-full rounded-lg border border-line bg-elevated px-2 py-1 text-sm"
      />
      <div className="mt-1 flex gap-2">
        <button onClick={() => void cambiar(true)} className="rounded-lg bg-accent px-3 py-1 text-xs text-accent-fg">
          Remitir
        </button>
        <button onClick={() => setAbierta(false)} className="text-soft underline">
          Cancelar
        </button>
      </div>
      {error && <p className="text-danger-soft-fg">{error}</p>}
    </div>
  ) : (
    <button onClick={() => setAbierta(true)} className="text-xs text-accent underline">
      Remitir al director de grupo
    </button>
  );
}

// ---------------------------------------------------------------------------

interface Evento {
  clave: string;
  fecha: string;
  orden: number;
  titulo: string;
  lineas: string[];
  autor: string;
  corregido?: string;
  seguimiento?: SeguimientoVigente;
}

/**
 * Todo lo que se ha hecho, en orden: las llamadas registradas desde la apertura, las gestiones
 * del modelo anterior (un renglón cada una) y los seguimientos, con sus correcciones ya
 * aplicadas. Las llamadas NO se vuelven a escribir como seguimiento: ya están registradas.
 */
function LineaDeTiempo({
  vigentes,
  llamadas,
  caso,
  config,
  puedeCorregir,
  onCorregir,
}: {
  vigentes: SeguimientoVigente[];
  llamadas: FamilyContact[];
  caso: CasoPermanencia;
  config: PermanenciaConfig;
  puedeCorregir: boolean;
  onCorregir: (s: SeguimientoVigente) => void;
}) {
  const eventos: Evento[] = [
    ...llamadas.map((c) => ({
      clave: `llamada_${c.contactId}`,
      fecha: c.fecha,
      orden: 0,
      titulo: `Llamada — ${RESULTADO_ETIQUETA[c.resultado]}`,
      lineas: [
        c.personaContactada ? `Contestó: ${PERSONA_CONTACTADA_ETIQUETA[c.personaContactada].toLowerCase()}` : '',
        c.motivoFamilia ? `La familia informó: ${etiquetaDeMotivo(config.motivos, c.motivoFamilia)}` : '',
        c.compromiso ? `Compromiso: ${c.compromiso}` : '',
        c.observacion,
      ].filter(Boolean),
      autor: c.llamadoPor,
    })),
    ...(caso.gestiones ?? []).map((g, i) => ({
      clave: `gestion_${i}`,
      fecha: g.fecha,
      orden: 1,
      titulo: GESTION_ETIQUETA[g.tipo] ?? g.tipo,
      lineas: g.nota ? [g.nota] : [],
      autor: g.realizadaPor,
    })),
    ...vigentes.map((s) => ({
      clave: s.seguimientoId,
      fecha: s.fecha,
      orden: 2 + s.creadoEn / 1e13,
      titulo: TIPO_SEGUIMIENTO_ETIQUETA[s.tipo],
      lineas: lineasDeSeguimiento(s),
      autor: s.autor,
      corregido: s.corregido ? `Corregido por ${s.corregido.por.split('@')[0]}` : undefined,
      seguimiento: s,
    })),
  ].sort((a, b) => a.fecha.localeCompare(b.fecha) || a.orden - b.orden);

  if (eventos.length === 0) {
    return <p className="text-xs text-muted">Todavía nada desde que se abrió.</p>;
  }

  return (
    <ol className="mt-1 space-y-2 border-l-2 border-line pl-3">
      {eventos.map((ev) => (
        <li key={ev.clave} className="text-xs">
          <p className="text-strong">
            <b>{ev.fecha}</b> · {ev.titulo}
            <span className="text-muted"> · {ev.autor.split('@')[0]}</span>
          </p>
          {ev.lineas.map((l, i) => (
            <p key={i} className="text-soft">
              {l}
            </p>
          ))}
          {ev.corregido && <p className="italic text-muted">{ev.corregido}</p>}
          {puedeCorregir && ev.seguimiento && (
            <button onClick={() => onCorregir(ev.seguimiento!)} className="text-accent underline">
              Corregir
            </button>
          )}
        </li>
      ))}
    </ol>
  );
}

function lineasDeSeguimiento(s: SeguimientoVigente): string[] {
  const l: string[] = [];
  if (s.tipo === 'visita') {
    if (s.direccionVisitada) l.push(`Dirección visitada: ${s.direccionVisitada}`);
    if (s.seEncontroEstudiante !== undefined && s.seEncontroEstudiante !== null)
      l.push(s.seEncontroEstudiante ? 'Se encontró al estudiante.' : 'No se encontró al estudiante.');
    if (s.personaQueRecibe) l.push(`Recibió: ${s.personaQueRecibe}`);
  }
  if (s.tipo === 'dialogo') {
    if (s.lugar) l.push(`Lugar: ${s.lugar}`);
    if (s.manifestaciones) l.push(`Manifestó: ${s.manifestaciones}`);
  }
  if (s.tipo === 'articulacion') {
    if (s.entidades) l.push(`Entidades: ${s.entidades}`);
    if (s.acciones) l.push(`Acciones: ${s.acciones}`);
    if (s.apoyos?.length) l.push(`Estrategias: ${s.apoyos.map((a) => APOYO_ETIQUETA[a]).join(', ')}`);
  }
  if (s.tipo === 'mesa') {
    if (s.recomendaciones) l.push(`Recomendaciones: ${s.recomendaciones}`);
    if (s.estrategias) l.push(`Estrategias definidas: ${s.estrategias}`);
  }
  if (s.observaciones) l.push(s.observaciones);
  if (s.decision === 'programar' || s.decision === 'no_ubicado') {
    l.push(
      `${s.decision === 'no_ubicado' ? 'No ubicado. ' : ''}Próximo seguimiento: ${s.proximaFecha}` +
        (s.responsable ? `, a cargo de ${RESPONSABLE_ETIQUETA[s.responsable].toLowerCase()}` : ''),
    );
  }
  if (s.decision === 'cerrar' && s.estadoFinal) l.push(`Cerró el caso: ${ESTADO_CASO_ETIQUETA[s.estadoFinal]}`);
  return l;
}

// ---------------------------------------------------------------------------

const CAMPO = 'mt-0.5 w-full rounded-lg border border-line bg-elevated px-2 py-1.5 text-sm';

function Texto({
  etiqueta,
  valor,
  onCambio,
  largo,
  placeholder,
}: {
  etiqueta: string;
  valor: string;
  onCambio: (v: string) => void;
  largo?: boolean;
  placeholder?: string;
}) {
  return (
    <label className="block text-xs text-muted">
      {etiqueta}
      {largo ? (
        <textarea value={valor} rows={3} placeholder={placeholder} onChange={(e) => onCambio(e.target.value)} className={CAMPO} />
      ) : (
        <input value={valor} placeholder={placeholder} onChange={(e) => onCambio(e.target.value)} className={CAMPO} />
      )}
    </label>
  );
}

/** Los campos propios de cada tipo. Los comparten el formulario nuevo y la corrección. */
function CamposDelTipo({
  tipo,
  campos,
  set,
}: {
  tipo: TipoSeguimiento;
  campos: CamposSeguimiento;
  set: (c: Partial<CamposSeguimiento>) => void;
}) {
  return (
    <div className="space-y-2">
      {tipo === 'visita' && (
        <>
          <Texto etiqueta="Dirección visitada" valor={campos.direccionVisitada ?? ''} onCambio={(v) => set({ direccionVisitada: v })} />
          <div className="text-xs text-muted">
            ¿Se encontró al estudiante?
            <div className="mt-1 flex gap-1.5">
              {[
                [true, 'Sí'],
                [false, 'No'],
              ].map(([v, e]) => (
                <button
                  key={String(v)}
                  onClick={() => set({ seEncontroEstudiante: v as boolean })}
                  className={`min-h-9 rounded-lg border px-3 text-sm ${
                    campos.seEncontroEstudiante === v ? 'border-accent bg-accent text-accent-fg' : 'border-line text-strong'
                  }`}
                >
                  {e as string}
                </button>
              ))}
            </div>
          </div>
          <Texto etiqueta="Persona que recibe la visita" valor={campos.personaQueRecibe ?? ''} onCambio={(v) => set({ personaQueRecibe: v })} />
          <p className="text-xs text-muted">La firma de quien recibe se toma en el informe impreso.</p>
        </>
      )}
      {tipo === 'dialogo' && (
        <>
          <Texto etiqueta="Lugar" valor={campos.lugar ?? ''} onCambio={(v) => set({ lugar: v })} placeholder="Ej.: coordinación" />
          <Texto etiqueta="Qué manifestó el estudiante" valor={campos.manifestaciones ?? ''} onCambio={(v) => set({ manifestaciones: v })} largo />
        </>
      )}
      {tipo === 'articulacion' && (
        <>
          <Texto etiqueta="Entidades contactadas" valor={campos.entidades ?? ''} onCambio={(v) => set({ entidades: v })} placeholder="Ej.: Comisaría de Familia, ICBF, EPS" />
          <Texto etiqueta="Acciones realizadas" valor={campos.acciones ?? ''} onCambio={(v) => set({ acciones: v })} largo />
          <div className="text-xs text-muted">
            Otras estrategias
            {(Object.entries(APOYO_ETIQUETA) as [ApoyoArticulacion, string][]).map(([k, e]) => (
              <label key={k} className="mt-1 flex items-center gap-2 text-sm text-strong">
                <input
                  type="checkbox"
                  checked={campos.apoyos?.includes(k) ?? false}
                  onChange={(x) =>
                    set({
                      apoyos: x.target.checked
                        ? [...(campos.apoyos ?? []), k]
                        : (campos.apoyos ?? []).filter((a) => a !== k),
                    })
                  }
                />
                {e}
              </label>
            ))}
          </div>
        </>
      )}
      {tipo === 'mesa' && (
        <>
          <Texto etiqueta="Recomendaciones de la mesa" valor={campos.recomendaciones ?? ''} onCambio={(v) => set({ recomendaciones: v })} largo />
          <Texto etiqueta="Estrategias definidas" valor={campos.estrategias ?? ''} onCambio={(v) => set({ estrategias: v })} largo />
        </>
      )}
      <Texto
        etiqueta={tipo === 'observacion' ? 'Observación o recomendación' : 'Observaciones'}
        valor={campos.observaciones ?? ''}
        onCambio={(v) => set({ observaciones: v })}
        largo
      />
    </div>
  );
}

function sumarDias(fecha: string, n: number): string {
  const d = new Date(`${fecha}T12:00:00`);
  d.setDate(d.getDate() + n);
  return toDateKey(d);
}

function FormularioSeguimiento({
  caso,
  estudiante,
  modo,
  hoy,
  onCancelar,
  onGuardado,
}: {
  caso: CasoPermanencia;
  estudiante?: Student;
  modo: 'gestion' | 'aporte';
  hoy: string;
  onCancelar: () => void;
  onGuardado: () => Promise<void>;
}) {
  const abierto = ESTADOS_ABIERTOS.includes(caso.estado);
  const [b, setB] = useState<BorradorSeguimiento>({
    tipo: modo === 'aporte' ? 'dialogo' : 'visita',
    fecha: hoy,
    direccionVisitada: [estudiante?.direccion, estudiante?.barrio].filter(Boolean).join(' · '),
    decision: modo === 'aporte' ? 'ninguna' : 'programar',
    proximaFecha: sumarDias(hoy, 7),
    responsable: 'coordinacion',
    estadoFinal: null,
  });
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const set = (c: Partial<BorradorSeguimiento>) => setB((p) => ({ ...p, ...c }));

  // Un caso cerrado solo se reabre programando: no tiene sentido «cerrar» lo cerrado.
  const decisiones: [DecisionSeguimiento, string][] = abierto
    ? [
        ['programar', 'Programar el próximo seguimiento'],
        ['no_ubicado', 'No se ha ubicado: programar otra búsqueda'],
        ['cerrar', 'Cerrar el caso'],
      ]
    : [['programar', 'Reabrir y programar el próximo seguimiento']];

  async function guardar() {
    const problema = validarSeguimiento(b, hoy);
    if (problema) return setError(problema);
    setGuardando(true);
    setError(null);
    try {
      await crearSeguimiento(caso, {
        ...b,
        // Solo lo que corresponde a la decisión tomada: nada de fechas de un cierre.
        proximaFecha: b.decision === 'programar' || b.decision === 'no_ubicado' ? b.proximaFecha : null,
        responsable: b.decision === 'programar' || b.decision === 'no_ubicado' ? b.responsable : null,
        estadoFinal: b.decision === 'cerrar' ? b.estadoFinal : null,
      });
      await onGuardado();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="space-y-2 rounded-lg border border-line p-3">
      <p className="text-sm font-semibold text-strong">Nuevo seguimiento</p>

      <div className="flex flex-wrap gap-1.5">
        {(Object.entries(TIPO_SEGUIMIENTO_ETIQUETA) as [TipoSeguimiento, string][])
          .filter(([t]) => modo === 'gestion' || t !== 'mesa')
          .map(([t, e]) => (
            <button
              key={t}
              onClick={() => set({ tipo: t })}
              className={`min-h-9 rounded-lg border px-3 py-1 text-sm ${
                b.tipo === t ? 'border-accent bg-accent text-accent-fg' : 'border-line text-strong'
              }`}
            >
              {e}
            </button>
          ))}
      </div>

      <label className="block text-xs text-muted">
        Fecha en que se hizo
        <input type="date" value={b.fecha} max={hoy} onChange={(e) => set({ fecha: e.target.value })} className={CAMPO} />
      </label>

      <CamposDelTipo tipo={b.tipo} campos={b} set={set} />

      {modo === 'gestion' && (
        <div className="space-y-2 rounded-lg bg-elevated p-2">
          <p className="text-xs font-semibold text-strong">¿Y ahora qué?</p>
          {decisiones.map(([d, e]) => (
            <label key={d} className="flex items-center gap-2 text-sm text-strong">
              <input type="radio" checked={b.decision === d} onChange={() => set({ decision: d })} />
              {e}
            </label>
          ))}

          {(b.decision === 'programar' || b.decision === 'no_ubicado') && (
            <div className="flex flex-wrap gap-2">
              <label className="text-xs text-muted">
                Fecha
                <input
                  type="date"
                  value={b.proximaFecha ?? ''}
                  min={hoy}
                  onChange={(e) => set({ proximaFecha: e.target.value })}
                  className={CAMPO}
                />
              </label>
              <label className="grow text-xs text-muted">
                A cargo de
                <select
                  value={b.responsable ?? ''}
                  onChange={(e) => set({ responsable: e.target.value as ResponsableSeguimiento })}
                  className={CAMPO}
                >
                  {(Object.entries(RESPONSABLE_ETIQUETA) as [ResponsableSeguimiento, string][]).map(([k, e]) => (
                    <option key={k} value={k}>
                      {e}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          )}

          {b.decision === 'cerrar' && (
            <label className="block text-xs text-muted">
              Cómo se cierra
              <select
                value={b.estadoFinal ?? ''}
                onChange={(e) => set({ estadoFinal: (e.target.value || null) as EstadoCierre | null })}
                className={CAMPO}
              >
                <option value="">— Escoja —</option>
                {ESTADOS_CIERRE.map((est) => (
                  <option key={est} value={est}>
                    {ESTADO_CASO_ETIQUETA[est]} ({ESTADO_DISTRITO[est]})
                  </option>
                ))}
              </select>
              <span className="mt-1 block">Escriba en observaciones por qué se cierra.</span>
            </label>
          )}
        </div>
      )}

      {modo === 'aporte' && (
        <p className="text-xs text-muted">
          Lo que registre queda en el caso para coordinación. El próximo paso lo decide coordinación.
        </p>
      )}

      {error && <p className="text-xs text-danger-soft-fg">{error}</p>}

      <div className="flex gap-2">
        <button
          onClick={() => void guardar()}
          disabled={guardando}
          className="rounded-lg bg-accent px-3 py-1.5 text-sm text-accent-fg disabled:opacity-50"
        >
          {guardando ? 'Guardando…' : 'Guardar seguimiento'}
        </button>
        <button onClick={onCancelar} className="rounded-lg border border-line px-3 py-1.5 text-sm text-strong">
          Cancelar
        </button>
      </div>
    </div>
  );
}

/**
 * Corregir: se edita el texto, se guarda como una corrección nueva, y el original queda en el
 * historial. La decisión que se tomó no se corrige: ya cambió el caso.
 */
function FormularioCorreccion({
  original,
  onCancelar,
  onGuardado,
}: {
  original: SeguimientoVigente;
  onCancelar: () => void;
  onGuardado: () => Promise<void>;
}) {
  const [campos, setCampos] = useState<CamposSeguimiento>({ ...original });
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  async function guardar() {
    setGuardando(true);
    setError(null);
    try {
      await corregirSeguimiento(original, campos);
      await onGuardado();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="space-y-2 rounded-lg border border-warning-soft p-3">
      <p className="text-sm font-semibold text-strong">
        Corregir: {TIPO_SEGUIMIENTO_ETIQUETA[original.tipo]} del {original.fecha}
      </p>
      <p className="text-xs text-muted">
        Lo que escribió {original.autor.split('@')[0]} no se borra: queda en el historial, y en pantalla se ve
        la versión corregida con su nombre.
      </p>
      <CamposDelTipo tipo={original.tipo} campos={campos} set={(c) => setCampos((p) => ({ ...p, ...c }))} />
      {original.versionesAnteriores.length > 0 && (
        <details className="text-xs text-muted">
          <summary className="cursor-pointer">Versiones anteriores ({original.versionesAnteriores.length})</summary>
          <ul className="mt-1 space-y-1">
            {original.versionesAnteriores.map((v) => (
              <li key={v.seguimientoId}>
                <b>{v.autor.split('@')[0]}</b>: {lineasDeSeguimiento({ ...v, corregido: null, versionesAnteriores: [] }).join(' · ')}
              </li>
            ))}
          </ul>
        </details>
      )}
      {error && <p className="text-xs text-danger-soft-fg">{error}</p>}
      <div className="flex gap-2">
        <button
          onClick={() => void guardar()}
          disabled={guardando}
          className="rounded-lg bg-accent px-3 py-1.5 text-sm text-accent-fg disabled:opacity-50"
        >
          {guardando ? 'Guardando…' : 'Guardar corrección'}
        </button>
        <button onClick={onCancelar} className="rounded-lg border border-line px-3 py-1.5 text-sm text-strong">
          Cancelar
        </button>
      </div>
    </div>
  );
}
