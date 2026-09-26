import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, ChevronDown, Clock, Minus } from 'lucide-react';
import { asignaturasDeCelda, getAsignatura } from '../data/asignacionAcademica';
import { horarioBase } from '../data/horarioBase';
import { aplicarModificacionesAlDia } from '../data/horarioModificado';
import { BLOQUES_MANANA, BLOQUES_TARDE, colorGrado, getUsuario, USUARIOS } from '../data/maestros';
import { useAppStore } from '../data/store';
import { escucharSesionesDelDia, leerGrupo } from './datos';
import { ETIQUETA_JORNADA } from './domain/filtro-jornada';
import { toDateKey } from './domain/ids';
import { nombreCompleto } from './domain/nombres';
import {
  ausentesDe,
  BLOQUE_TERCERA,
  cambioVigente,
  construirTablero,
  GRACIA_MINUTOS,
  marcasDe,
  minutosDe,
  resumirTablero,
  type ClaseDelDia,
  type Cubrimiento,
  type EstadoBloque,
  type EstadoLista,
  type FilaTablero,
} from './domain/tablero-tercera';
import type { Jornada, Session } from './domain/types';

/**
 * Paso 1 de la tercera hora: «¿Quién llamó lista?» (2026-09-25). Ver
 * `domain/tablero-tercera.ts` para de donde sale cada dato.
 *
 * Pensado para entenderse sin leer: arriba cuantos grupos faltan, luego SOLO los que
 * faltan con lo necesario para actuar (asignatura, docente, aula), y abajo todos los
 * grupos en tarjetas de color. Tocar un grupo despliega su detalle y sus seis horas.
 *
 * Se actualiza solo: escucha las sesiones del dia en vivo y el reloj corre cada 30
 * segundos, asi que un grupo pasa de «en hora» a «sin lista» cuando se acaba la gracia
 * y a verde cuando el docente cierra la lista, sin oprimir nada.
 */
export default function TableroTerceraHora({
  sede,
  fecha,
  jornada,
  grados,
  onVerPlanillas,
}: {
  sede: string;
  fecha: string;
  jornada: Jornada;
  /** Todos los grupos de la jornada, salgan o no en el horario o en las sesiones. */
  grados: string[];
  onVerPlanillas: (grado: string) => void;
}) {
  const horariosModificados = useAppStore((s) => s.horariosModificados) ?? [];
  const [sesiones, setSesiones] = useState<Session[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [ahora, setAhora] = useState(() => Date.now());
  const [abierto, setAbierto] = useState<string | null>(null);

  useEffect(() => {
    setSesiones([]);
    setError(null);
    return escucharSesionesDelDia({ sede, fecha, jornada }, setSesiones, (e) =>
      setError(`No fue posible leer las listas del día: ${e.message}`),
    );
  }, [sede, fecha, jornada]);

  useEffect(() => {
    const t = setInterval(() => setAhora(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  const bloques = jornada === 'manana' ? BLOQUES_MANANA : BLOQUES_TARDE;
  const bloque3 = bloques.find((b) => b.id === BLOQUE_TERCERA);

  const filas = useMemo(() => {
    const clases: ClaseDelDia[] = aplicarModificacionesAlDia(fecha, jornada, horarioBase, horariosModificados)
      .filter((c) => c.grado !== 'CI');
    const gruposConHorario = new Set(
      horarioBase.filter((e) => e.jornada === jornada).map((e) => e.grado.split('/')[0]),
    );
    const d = new Date(ahora);
    return construirTablero({
      // Tambien los grupos que tienen sesion hoy aunque no esten en la lista: en las sedes
      // sin horario cargado, son la unica forma de que aparezcan.
      grados: [...grados, ...sesiones.map((s) => s.grado)],
      clases,
      sesiones,
      cambio: cambioVigente(horariosModificados, fecha, jornada),
      gruposConHorario,
      inicioDeBloque: (b) => minutosDe(bloques.find((x) => x.id === b)?.inicio ?? '00:00'),
      fecha,
      hoy: toDateKey(d),
      minutoActual: d.getHours() * 60 + d.getMinutes(),
    });
  }, [grados, sesiones, horariosModificados, fecha, jornada, ahora, bloques]);

  const resumen = resumirTablero(filas);
  const faltan = filas.filter((f) => f.tercera.estado === 'sin_lista');
  const niveles = [...new Set(filas.map((f) => f.nivel))];
  const filaAbierta = filas.find((f) => f.grado === abierto) ?? null;
  const pct = resumen.conClase > 0 ? Math.round((resumen.llamo / resumen.conClase) * 100) : 0;

  return (
    <div className="space-y-3">
      {/* ---------- Cuántos faltan ---------- */}
      <div className="rounded-xl border border-line bg-card p-3">
        <p className="text-xs text-muted">
          Tercera hora · {ETIQUETA_JORNADA[jornada]}
          {bloque3 ? ` · ${bloque3.inicio} – ${bloque3.fin}` : ''}
        </p>
        {resumen.conClase === 0 ? (
          <p className="mt-1 text-lg font-semibold text-strong">Hoy no hay clases a tercera hora en esta jornada.</p>
        ) : (
          <>
            <p className="mt-1 text-lg font-semibold text-strong">
              {resumen.llamo} de {resumen.conClase} grupos ya llamaron lista
            </p>
            <p className="text-xs text-muted">
              Son los {resumen.conClase} grupos que, según el horario de hoy, tienen clase a tercera
              hora. Un grupo «llamó lista» cuando alguien marcó la asistencia en esa hora en la
              aplicación. Se actualiza sola.
            </p>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-elevated" aria-hidden>
              <div className="h-full rounded-full bg-success" style={{ width: `${pct}%` }} />
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
              <Pastilla estado="llamo">{resumen.llamo} llamaron lista</Pastilla>
              {resumen.sinLista > 0 && <Pastilla estado="sin_lista">{resumen.sinLista} sin lista</Pastilla>}
              {resumen.enHora > 0 && (
                <Pastilla estado="en_hora">
                  {resumen.enHora} en los primeros {GRACIA_MINUTOS} minutos
                </Pastilla>
              )}
            </div>
            {resumen.sinCerrar > 0 && (
              <p className="mt-1 text-xs text-muted">
                De los que llamaron lista, {resumen.sinCerrar} no han cerrado la planilla. No hace
                falta para esta pantalla: las marcas ya cuentan.
              </p>
            )}
          </>
        )}
      </div>

      {error && (
        <p className="rounded-xl border border-danger-soft bg-danger-soft p-3 text-sm text-danger-soft-fg">{error}</p>
      )}

      {/* ---------- Por resolver ahora: solo los que faltan ---------- */}
      {faltan.length > 0 && (
        <div className="rounded-xl border border-danger-soft bg-card p-3">
          <p className="flex items-center gap-2 text-sm font-semibold text-danger-soft-fg">
            <AlertCircle size={16} aria-hidden /> Por resolver ahora: grupos sin lista
          </p>
          <p className="mt-0.5 text-xs text-muted">
            Tenían clase a tercera hora y, pasados {GRACIA_MINUTOS} minutos, nadie ha marcado
            asistencia en la aplicación. Puede ser que no se llamó lista, que se llevó en otro
            medio, o que se registró como otra hora: toque el grupo y mire sus seis horas.
          </p>
          <ul className="mt-1 divide-y divide-line">
            {faltan.map((f) => (
              <li key={f.grado}>
                <button
                  onClick={() => setAbierto(f.grado)}
                  className="flex min-h-12 w-full flex-wrap items-center gap-x-2 gap-y-0.5 py-2 text-left"
                >
                  <b className="w-14 text-lg" style={{ color: colorGrado(f.grado) }}>
                    {f.grado}
                  </b>
                  <span className="text-sm text-soft">
                    {asignaturaDe(f.tercera)} · {docenteDe(f)}
                  </span>
                  <span className="grow" />
                  <b className="text-sm text-strong">{f.tercera.clase?.aula ?? 'sin aula'}</b>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {resumen.conClase > 0 && faltan.length === 0 && resumen.enHora === 0 && (
        <p className="flex items-center gap-2 rounded-xl border border-line bg-success-soft p-3 text-sm text-success-soft-fg">
          <CheckCircle2 size={16} aria-hidden /> Todos los grupos con clase a tercera hora ya llamaron lista.
        </p>
      )}

      {/* ---------- Todos los grupos ---------- */}
      <div className="rounded-xl border border-line bg-card p-3">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-semibold text-strong">Todos los grupos</p>
          <span className="grow" />
          <div className="flex flex-wrap gap-1 text-xs">
            <Pastilla estado="llamo">llamó lista</Pastilla>
            <Pastilla estado="sin_lista">sin lista</Pastilla>
            <Pastilla estado="sin_clase">todavía no, o no aplica</Pastilla>
          </div>
        </div>
        <p className="mt-0.5 text-xs text-muted">Toque un grupo para ver quién faltó y sus seis horas de hoy.</p>

        {niveles.map((n) => (
          <div key={n} className="mt-2">
            <p className="mb-1 text-xs text-muted">{n}°</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {filas
                .filter((f) => f.nivel === n)
                .map((f) => (
                  <TarjetaGrupo
                    key={f.grado}
                    fila={f}
                    abierta={abierto === f.grado}
                    onTocar={() => setAbierto(abierto === f.grado ? null : f.grado)}
                  />
                ))}
            </div>
            {filaAbierta?.nivel === n && (
              <DetalleGrupo fila={filaAbierta} onCerrar={() => setAbierto(null)} onVerPlanillas={onVerPlanillas} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
//  Piezas
// ---------------------------------------------------------------------------

const TONO: Record<EstadoLista, string> = {
  llamo: 'border-success-soft bg-success-soft text-success-soft-fg',
  sin_lista: 'border-danger-soft bg-danger-soft text-danger-soft-fg',
  en_hora: 'border-line bg-elevated text-muted',
  sin_clase: 'border-line bg-elevated text-muted',
  sin_horario: 'border-line bg-elevated text-muted',
};

function IconoEstado({ estado }: { estado: EstadoLista }) {
  if (estado === 'llamo') return <CheckCircle2 size={16} aria-label="Llamó lista" />;
  if (estado === 'en_hora') return <Clock size={16} aria-label="Todavía en hora" />;
  if (estado === 'sin_lista') return <AlertCircle size={16} aria-label="Sin lista" />;
  return <Minus size={16} aria-label="Sin clase" />;
}

function Pastilla({ estado, children }: { estado: EstadoLista; children: React.ReactNode }) {
  return <span className={`rounded-full border px-2 py-0.5 ${TONO[estado]}`}>{children}</span>;
}

function nombreDocente(id: string | null | undefined): string {
  if (!id) return '';
  const u = getUsuario(id);
  return u?.nombreCorto || u?.nombre || id;
}

/** "ana.lara@..." -> el nombre corto de quien es, o la parte antes de @ si no se sabe. */
function nombrePorCorreo(correo: string | null | undefined): string {
  if (!correo) return '';
  const u = USUARIOS.find((x) => x.correo?.toLowerCase() === correo.toLowerCase());
  return u?.nombreCorto || u?.nombre || correo.split('@')[0];
}

function horaDe(v: unknown): string {
  const d =
    v && typeof (v as { toDate?: () => Date }).toDate === 'function'
      ? (v as { toDate: () => Date }).toDate()
      : typeof v === 'number'
        ? new Date(v)
        : null;
  return d ? d.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }) : '';
}

/**
 * La asignatura de una hora: la de la sesion si ya existe (es lo que de verdad se
 * registro), si no la del horario. Si el docente dicta dos asignaturas al grupo, el
 * horario no dice cual es a esa hora: van las dos.
 */
function asignaturaDe(b: EstadoBloque): string {
  if (b.sesion) return getAsignatura(b.sesion.subjectId)?.nombre ?? b.sesion.subjectId;
  if (!b.clase) return '—';
  const nombres = asignaturasDeCelda(b.clase.docente, b.clase.grado).map((a) => a.nombre);
  return nombres.length ? [...new Set(nombres)].join(' / ') : 'asignatura sin registrar';
}

function textoCubrimiento(c: Cubrimiento): string {
  if (c.tipo === 'reemplazo') return `reemplazo: ${nombreDocente(c.docente)}`;
  if (c.tipo === 'apoyo') return `cubre: ${c.nombre}`;
  return c.supervisor ? `taller, supervisa ${nombreDocente(c.supervisor)}` : 'taller';
}

/** Quien esta con el grupo a tercera hora, dicho como lo necesita la coordinadora. */
function docenteDe(f: FilaTablero): string {
  if (!f.tercera.clase) return '';
  if (f.cubrimiento) return textoCubrimiento(f.cubrimiento);
  const titular = nombreDocente(f.tercera.clase.docente);
  return f.titularAusente ? `${titular} (ausente hoy según el día escolar)` : titular;
}

function TarjetaGrupo({ fila, abierta, onTocar }: { fila: FilaTablero; abierta: boolean; onTocar: () => void }) {
  const b = fila.tercera;
  const e = b.estado;
  const detalle =
    e === 'llamo'
      ? `${ausentesDe(b.sesion).length} ausente(s)${b.sesion?.closed ? '' : ' · sin cerrar'}`
      : e === 'sin_lista'
          ? (b.clase?.aula ?? 'sin aula')
          : e === 'en_hora'
            ? 'en hora'
            : e === 'sin_clase'
              ? 'sin clase a 3.ª'
              : 'sin horario cargado';
  return (
    <button
      onClick={onTocar}
      aria-expanded={abierta}
      className={`min-h-[72px] rounded-xl border p-2 text-left ${TONO[e]} ${abierta ? 'ring-2 ring-accent' : ''}`}
    >
      <span className="flex items-center justify-between">
        <b className="text-lg">{fila.grado}</b>
        <IconoEstado estado={e} />
      </span>
      {b.clase || b.sesion ? <span className="block truncate text-xs">{asignaturaDe(b)}</span> : null}
      <span className="block truncate text-xs opacity-90">{detalle}</span>
    </button>
  );
}

/**
 * El desplegable de un grupo: la tercera hora al frente —quien tomo lista, a que hora y
 * quienes faltaron— y las seis horas del dia como consulta.
 *
 * Los nombres de los ausentes se piden SOLO al abrir el grupo: son unas pocas fichas, y
 * traer las de toda la sede para pintar el tablero no tendria sentido.
 */
function DetalleGrupo({
  fila,
  onCerrar,
  onVerPlanillas,
}: {
  fila: FilaTablero;
  onCerrar: () => void;
  onVerPlanillas: (grado: string) => void;
}) {
  const b = fila.tercera;
  const [nombres, setNombres] = useState<Map<string, string> | null>(null);
  const ausentes = ausentesDe(b.sesion);
  const claveAusentes = ausentes.join(',');

  useEffect(() => {
    setNombres(null);
    if (!claveAusentes) return;
    let vivo = true;
    void leerGrupo(fila.grado)
      .then(({ estudiantes }) => {
        if (vivo) setNombres(new Map(estudiantes.map((e) => [e.studentId, nombreCompleto(e)])));
      })
      .catch(() => vivo && setNombres(new Map()));
    return () => {
      vivo = false;
    };
  }, [fila.grado, claveAusentes]);

  const estadoTexto =
    b.estado === 'llamo'
      ? b.sesion?.closed
        ? `Lista tomada por ${nombrePorCorreo(b.sesion.closedBy ?? b.sesion.createdBy)}; planilla cerrada a las ${horaDe(b.sesion.closedAt)}.`
        : `Lista tomada por ${nombrePorCorreo(b.sesion?.createdBy)}: ${marcasDe(b.sesion)} estudiantes marcados. La planilla no se ha cerrado.`
      : b.estado === 'sin_lista'
          ? 'Todavía nadie ha llamado lista en esta hora.'
          : b.estado === 'en_hora'
            ? `Todavía está dentro de los primeros ${GRACIA_MINUTOS} minutos de la hora.`
            : b.estado === 'sin_clase'
              ? 'Según el horario, este grupo no tiene clase a tercera hora hoy.'
              : 'El horario cargado no cubre este grupo: no se sabe qué clase tenía.';

  return (
    <div className="mt-2 rounded-xl border border-line bg-elevated p-3 text-sm">
      <div className="flex items-center gap-2">
        <b className="text-lg" style={{ color: colorGrado(fila.grado) }}>
          {fila.grado}
        </b>
        <span className="text-xs text-muted">detalle de hoy</span>
        <span className="grow" />
        <button onClick={onCerrar} className="flex items-center gap-1 text-xs text-muted" aria-label="Cerrar el detalle">
          Cerrar <ChevronDown size={14} className="rotate-180" aria-hidden />
        </button>
      </div>

      {b.clase || b.sesion ? (
        <p className="mt-1 text-strong">
          3.ª hora: <b>{asignaturaDe(b)}</b>
          {b.clase && (
            <>
              {' '}· {docenteDe(fila)} · <b>{b.clase.aula}</b>
            </>
          )}
        </p>
      ) : null}
      <p className="text-soft">{estadoTexto}</p>

      {ausentes.length > 0 && (
        <p className="mt-1 text-xs text-soft">
          Ausentes ({ausentes.length}):{' '}
          {nombres === null ? 'cargando…' : ausentes.map((id) => nombres.get(id) ?? 'estudiante sin ficha').join(' · ')}
        </p>
      )}

      <p className="mt-3 text-xs text-muted">Las seis horas de hoy</p>
      <div className="mt-1 grid grid-cols-3 gap-1.5 sm:grid-cols-6">
        {fila.dia.map((h) => (
          <div key={h.bloque} className={`rounded-lg border p-1.5 text-xs ${TONO[h.estado]}`}>
            <span className="block">{h.bloque}.ª hora</span>
            <b className="block truncate">{h.clase || h.sesion ? asignaturaDe(h) : '—'}</b>
          </div>
        ))}
      </div>

      <button
        onClick={() => onVerPlanillas(fila.grado)}
        className="mt-3 rounded-lg border border-line bg-card px-3 py-1.5 text-xs text-strong"
      >
        Ver las planillas de {fila.grado}
      </button>
    </div>
  );
}
