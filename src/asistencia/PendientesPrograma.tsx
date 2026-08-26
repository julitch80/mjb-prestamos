import { useCallback, useEffect, useState } from 'react';
import {
  buscarEstudiantes,
  contarPendientesPrograma,
  inscribirEnGrupoPrograma,
  leerEstudiantesDeSede,
  leerMisGruposDePrograma,
  leerPendientesPrograma,
  limpiarConflictoEnGrupo,
  resolverPendientePrograma,
  retirarDeGrupoPrograma,
} from './datos';
import Avatar from './Avatar';
import { coberturaPrograma } from './domain/programas';
import { nombreCompleto } from './domain/nombres';
import type {
  CandidatoPendiente,
  GrupoPrograma,
  PendientePrograma,
  Student,
  TipoPendiente,
} from './domain/types';
import { Check, Search, UserCheck, UserX, X } from 'lucide-react';

/**
 * Bandeja de pendientes de un programa — la pantalla de la coordinadora.
 *
 * Existe para no mandarle una lista de cuarenta y dos preguntas en un papel. Cada caso
 * que el cruce con la matricula no pudo decidir solo llega aqui como una tarjeta con sus
 * candidatos, y se resuelve EN UN CLIC: nada de escribir, nada de buscar (salvo cuando de
 * verdad no hay candidato), nada de vocabulario tecnico. La lee una coordinadora, no un
 * programador.
 *
 * Las fotografias no son decoracion: la coordinadora reconoce a los muchachos por la
 * cara, no por el apellido. En un homonimo —dos "Quiroz Quiroz Samanta"— la foto es
 * literalmente el unico dato que le permite decidir.
 *
 * LA PROPUESTA DEL LIDER MANDA EN LA PANTALLA (2026-08-26). Quien conoce a los muchachos
 * es el lider del centro, que les da clase; la coordinadora no. Cuando un pendiente trae
 * `propuestaLider`, la tarjeta lo dice arriba con el nombre de quien lo propuso, deja ese
 * candidato preseleccionado y ofrece un boton de «Confirmar» que resuelve de un clic. La
 * propuesta es INFORMACION, no una orden: la coordinadora sigue pudiendo escoger otro
 * candidato o descartar, y si el lider y el sistema (`sugerido`) discrepan se DICE — son
 * dos opiniones distintas y esconder una seria decidir por ella.
 *
 * DOS ESCRITURAS, EN ESTE ORDEN. Resolver el pendiente y mover la inscripcion son dos
 * documentos distintos y `resolverPendientePrograma` no inscribe por si solo (a
 * proposito, ver su comentario en datos.ts). Aqui se hace SIEMPRE primero la escritura de
 * inscripcion y solo despues se marca el pendiente: si la inscripcion falla, el pendiente
 * sigue abierto y el error se ve en la tarjeta. Al reves —marcar resuelto y fallar al
 * inscribir— el caso desapareceria de la bandeja sin que el estudiante quedara en ningun
 * centro, y nadie se enteraria hasta que el lider pasara lista.
 */

const ETIQUETA_TIPO: Record<TipoPendiente, string> = {
  homonimo: 'Dos personas se llaman igual',
  ortografia: 'El nombre no coincide exactamente',
  no_encontrado: 'No aparece en la matrícula',
  duplicado: 'Está en dos centros a la vez',
};

const ORDEN_TIPO: TipoPendiente[] = ['homonimo', 'ortografia', 'no_encontrado', 'duplicado'];

/**
 * Un correo institucional puesto en palabras. No hay directorio de nombres en el modulo,
 * asi que el unico dato disponible es el correo — y ensenarlo crudo en una frase («
 * julian.medina@… dice que es esta») la vuelve ilegible.
 *
 * La regla es ESTRECHA a proposito: solo se traduce cuando el correo trae el nombre
 * separado por puntos, guiones o barrabajos («julian.medina» → «Julián Medina», sin los
 * acentos que el correo no lleva). Un buzon como «jmedina» o «coord2» no se disfraza de
 * nombre: se muestra el correo entero, que es informacion honesta. Nunca un identificador
 * tecnico.
 */
export function nombreLegibleDeCorreo(correo: string): string {
  const limpio = (correo ?? '').trim();
  const local = limpio.split('@')[0] ?? '';
  if (!/^[a-zA-ZñÑáéíóúÁÉÍÓÚ]{2,}([._-][a-zA-ZñÑáéíóúÁÉÍÓÚ]{2,})+$/.test(local)) return limpio;
  return local
    .split(/[._-]/)
    .map((parte) => parte.charAt(0).toUpperCase() + parte.slice(1).toLowerCase())
    .join(' ');
}

export default function PendientesPrograma({
  programaId,
  sede,
  grupoInicial,
}: {
  programaId: string;
  sede: string;
  /**
   * Centro por el que llega ya filtrada la bandeja. Existe porque la coordinadora entro a
   * un centro, no encontro sus pendientes y creyo que no habia ninguno: desde la lista de
   * centros ahora se llega aqui con el filtro puesto.
   */
  grupoInicial?: string;
}) {
  const [pendientes, setPendientes] = useState<PendientePrograma[]>([]);
  const [grupos, setGrupos] = useState<GrupoPrograma[]>([]);
  const [matriculados, setMatriculados] = useState<Student[]>([]);
  const [conteo, setConteo] = useState<Record<TipoPendiente, number> | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [filtroTipo, setFiltroTipo] = useState<TipoPendiente | 'todos'>('todos');
  const [filtroGrupo, setFiltroGrupo] = useState<string>(grupoInicial ?? 'todos');
  const [verResueltos, setVerResueltos] = useState(false);
  /** Solo los que ya traen la propuesta del lider: son los que se despachan rapido. */
  const [soloConPropuesta, setSoloConPropuesta] = useState(false);

  // Si se vuelve a entrar desde otro centro, el filtro sigue al centro elegido.
  useEffect(() => {
    if (grupoInicial) setFiltroGrupo(grupoInicial);
  }, [grupoInicial]);

  const recargar = useCallback(async () => {
    setError(null);
    try {
      // `false` = tambien los resueltos: se pueden mirar, pero por defecto no estorban.
      // Traerlos de una vez evita una segunda consulta al marcar la casilla de "ver los
      // ya resueltos", que es justo cuando la coordinadora quiere comprobar algo rapido.
      const [lista, gs, ms, c] = await Promise.all([
        leerPendientesPrograma(programaId, false),
        leerMisGruposDePrograma(programaId),
        leerEstudiantesDeSede(sede),
        contarPendientesPrograma(programaId),
      ]);
      setPendientes(lista);
      setGrupos(gs);
      setMatriculados(ms);
      setConteo(c);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setCargando(false);
    }
  }, [programaId, sede]);

  useEffect(() => {
    void recargar();
  }, [recargar]);

  /** Aplica la decision en local sin recargar toda la bandeja: la tarjeta resuelta se
   *  queda en su sitio (marcada) en vez de saltar la lista bajo el dedo. */
  const aplicarEnLocal = useCallback(
    (pendienteId: string, cambio: Partial<PendientePrograma>) => {
      setPendientes((lista) =>
        lista.map((p) => (p.pendienteId === pendienteId ? { ...p, ...cambio } : p)),
      );
      setConteo((c) => {
        if (!c) return c;
        const p = pendientes.find((x) => x.pendienteId === pendienteId);
        if (!p || p.estado !== 'pendiente') return c;
        return { ...c, [p.tipo]: Math.max(0, c[p.tipo] - 1) };
      });
    },
    [pendientes],
  );

  const nombreGrupo = useCallback(
    (grupoId: string) => grupos.find((g) => g.grupoId === grupoId)?.nombre ?? grupoId,
    [grupos],
  );

  /** Correo de quien lidera un centro, para poder decir «que lidera este centro». */
  const liderDelCentro = useCallback(
    (grupoId: string) => grupos.find((g) => g.grupoId === grupoId)?.lider ?? null,
    [grupos],
  );

  /**
   * Nombre de un estudiante de la matricula. Hace falta porque la propuesta del lider es
   * un `studentId` y puede senalar a alguien que NO esta entre los candidatos (en un
   * `no_encontrado` el lider lo busco en toda la sede). Sin esto la tarjeta diria «dice
   * que es est_0412», que es exactamente el identificador tecnico que no se muestra.
   */
  const nombreEstudiante = useCallback(
    (studentId: string) => {
      const e = matriculados.find((x) => x.studentId === studentId);
      return e ? nombreCompleto(e) : null;
    },
    [matriculados],
  );

  if (cargando) {
    return <p className="p-3 text-sm text-muted">Cargando la bandeja de pendientes…</p>;
  }

  const abiertos = pendientes.filter((p) => p.estado === 'pendiente');
  const conPropuesta = abiertos.filter((p) => Boolean(p.propuestaLider));
  const visibles = pendientes
    .filter((p) => (verResueltos ? true : p.estado === 'pendiente'))
    .filter((p) => filtroTipo === 'todos' || p.tipo === filtroTipo)
    .filter(
      (p) =>
        filtroGrupo === 'todos' ||
        p.grupoId === filtroGrupo ||
        (p.gruposEnConflicto ?? []).includes(filtroGrupo),
    )
    .filter((p) => !soloConPropuesta || Boolean(p.propuestaLider))
    // Primero los que ya traen propuesta del lider: son confirmaciones de un clic, y
    // despacharlas de entrada deja la bandeja en los pocos casos que hay que pensar.
    // `sort` sobre una copia ya filtrada, y estable: dentro de cada bloque se conserva el
    // orden alfabetico con que llegaron de `leerPendientesPrograma`.
    .sort((a, b) => Number(Boolean(b.propuestaLider)) - Number(Boolean(a.propuestaLider)));

  const cobertura = coberturaPrograma(matriculados, grupos);

  return (
    <section className="space-y-3">
      <Contador
        total={cobertura.total}
        ubicados={cobertura.inscritos}
        porConfirmar={abiertos.length}
        sinCentro={cobertura.sinInscribir}
      />

      {error && (
        <p className="rounded-lg border border-danger-soft bg-danger-soft p-2 text-sm text-danger-soft-fg">
          {error}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-1.5">
        <Pastilla activa={filtroTipo === 'todos'} onClick={() => setFiltroTipo('todos')}>
          Todos ({abiertos.length})
        </Pastilla>
        {ORDEN_TIPO.map((t) => (
          <Pastilla key={t} activa={filtroTipo === t} onClick={() => setFiltroTipo(t)}>
            {ETIQUETA_TIPO[t]} ({conteo?.[t] ?? 0})
          </Pastilla>
        ))}
      </div>

      {/* La propuesta del lider primero, y con su propio filtro: de los 63 casos, los que
          ya traen respuesta se cierran confirmando. */}
      <div className="flex flex-wrap items-center gap-1.5">
        <Pastilla
          activa={soloConPropuesta}
          onClick={() => setSoloConPropuesta((v) => !v)}
        >
          <span className="inline-flex items-center gap-1.5">
            <UserCheck size={14} aria-hidden />
            Con propuesta del líder ({conPropuesta.length})
          </span>
        </Pastilla>
        {conPropuesta.length > 0 && !soloConPropuesta && (
          <span className="text-xs text-muted">
            Aparecen de primeras en la lista: solo hay que confirmarlas.
          </span>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <select
          value={filtroGrupo}
          onChange={(e) => setFiltroGrupo(e.target.value)}
          className="min-w-0 rounded-lg border border-line bg-elevated px-2 py-1.5 text-sm text-strong"
        >
          <option value="todos">Todos los centros de interés</option>
          {grupos.map((g) => (
            <option key={g.grupoId} value={g.grupoId}>
              {g.nombre}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-1.5 text-sm text-soft">
          <input
            type="checkbox"
            checked={verResueltos}
            onChange={(e) => setVerResueltos(e.target.checked)}
          />
          Ver también los ya resueltos
        </label>
      </div>

      {visibles.length === 0 ? (
        <p className="rounded-xl border border-success-soft bg-success-soft p-3 text-sm text-success-soft-fg">
          No queda nada por confirmar con estos filtros.
        </p>
      ) : (
        <ul className="space-y-2">
          {visibles.map((p) => (
            <li key={p.pendienteId}>
              <Tarjeta
                pendiente={p}
                sede={sede}
                nombreGrupo={nombreGrupo}
                liderDelCentro={liderDelCentro}
                nombreEstudiante={nombreEstudiante}
                onAplicado={aplicarEnLocal}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/**
 * El contador de arriba. Permanente y honesto: se ve antes de abrir ninguna tarjeta y
 * sigue ahi mientras se trabaja, porque la pregunta de la coordinadora no es "¿cuantos
 * pendientes hay?" sino "¿cuanto me falta?".
 *
 * Las tres cifras NO tienen por que sumar el total, y decirlo evita que parezca un error
 * de cuentas: un pendiente de tipo `duplicado` habla de alguien que YA esta inscrito (en
 * dos sitios), y uno de tipo `no_encontrado` puede hablar de alguien que ni siquiera esta
 * en la matricula. Inflar o cuadrar los numeros a la fuerza seria mentir.
 */
function Contador({
  total,
  ubicados,
  porConfirmar,
  sinCentro,
}: {
  total: number;
  ubicados: number;
  porConfirmar: number;
  sinCentro: number;
}) {
  return (
    <div className="rounded-xl border border-line bg-card p-3">
      <p className="text-sm text-strong">
        <b>{ubicados}</b> de <b>{total}</b> ubicados · <b>{porConfirmar}</b> por confirmar ·{' '}
        <b>{sinCentro}</b> sin centro de interés
      </p>
      <p className="mt-1 text-xs text-muted">
        Las tres cifras no suman el total, y está bien: quien está en dos centros ya cuenta
        como ubicado, y algún nombre de la lista puede no estar en la matrícula.
      </p>
    </div>
  );
}

function Pastilla({
  activa,
  onClick,
  children,
}: {
  activa: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={[
        'rounded-full border px-3 py-1 text-sm',
        activa
          ? 'border-accent bg-accent-soft font-semibold text-accent-soft-fg'
          : 'border-line text-soft',
      ].join(' ')}
    >
      {children}
    </button>
  );
}

// ---------------------------------------------------------------------------
//  La tarjeta — una por pendiente, resuelta en un clic
// ---------------------------------------------------------------------------

function Tarjeta({
  pendiente,
  sede,
  nombreGrupo,
  liderDelCentro,
  nombreEstudiante,
  onAplicado,
}: {
  pendiente: PendientePrograma;
  sede: string;
  nombreGrupo: (grupoId: string) => string;
  liderDelCentro: (grupoId: string) => string | null;
  nombreEstudiante: (studentId: string) => string | null;
  onAplicado: (pendienteId: string, cambio: Partial<PendientePrograma>) => void;
}) {
  const [trabajando, setTrabajando] = useState(false);
  const [fallo, setFallo] = useState<string | null>(null);
  const p = pendiente;

  /**
   * Inscribe (o retira) PRIMERO y solo despues marca el pendiente. Ver la nota grande de
   * la cabecera del archivo: si la escritura de inscripcion falla, el pendiente NO se
   * marca como resuelto y el fallo se dice con todas las letras.
   */
  async function decidir(opciones: {
    inscribirEn?: { grupoId: string; studentId: string };
    retirarDe?: { grupoId: string; studentId: string }[];
    /**
     * Centro que GANA un `duplicado`: hay que levantarle la marca de conflicto, porque
     * ya no hay duda. Al que pierde no hace falta: el estudiante sale de `miembros` y
     * deja de aparecer en esa planilla.
     *
     * Sin esto el estudiante se quedaria senalado para siempre en la planilla del lider
     * que se lo quedo, que es peor que no haberlo marcado nunca: una advertencia que no
     * se apaga se vuelve ruido y se deja de leer.
     */
    limpiarConflictoEn?: { grupoId: string; studentId: string };
    estado: 'resuelto' | 'descartado';
    decision?: string;
  }) {
    setTrabajando(true);
    setFallo(null);
    try {
      if (opciones.inscribirEn) {
        await inscribirEnGrupoPrograma(p.programaId, opciones.inscribirEn.grupoId, [
          opciones.inscribirEn.studentId,
        ]);
      }
      for (const r of opciones.retirarDe ?? []) {
        await retirarDeGrupoPrograma(p.programaId, r.grupoId, [r.studentId]);
      }
      if (opciones.limpiarConflictoEn) {
        await limpiarConflictoEnGrupo(p.programaId, opciones.limpiarConflictoEn.grupoId, [
          opciones.limpiarConflictoEn.studentId,
        ]);
      }
    } catch (e) {
      setFallo(
        'No se pudo guardar la inscripción, así que este caso sigue pendiente: ' +
          (e instanceof Error ? e.message : String(e)),
      );
      setTrabajando(false);
      return;
    }

    try {
      await resolverPendientePrograma(p.programaId, p.pendienteId, {
        estado: opciones.estado,
        decision: opciones.decision,
      });
      onAplicado(p.pendienteId, { estado: opciones.estado, decision: opciones.decision });
    } catch (e) {
      setFallo(
        'La inscripción sí quedó guardada, pero el caso no se pudo cerrar. Vuelva a ' +
          'intentarlo: ' +
          (e instanceof Error ? e.message : String(e)),
      );
    } finally {
      setTrabajando(false);
    }
  }

  const resuelto = p.estado !== 'pendiente';

  return (
    <article
      className={[
        'rounded-xl border p-3',
        resuelto ? 'border-line bg-elevated opacity-60' : 'border-line bg-card',
      ].join(' ')}
    >
      <header className="flex flex-wrap items-baseline gap-x-2">
        <span className="text-base font-semibold text-strong">{p.nombreArchivo}</span>
        {p.grupoArchivo && <span className="text-sm text-muted">{p.grupoArchivo}</span>}
        <span className="text-sm text-muted">·</span>
        <span className="text-sm italic text-soft">{nombreGrupo(p.grupoId)}</span>
      </header>

      {resuelto ? (
        <p className="mt-1 text-sm text-soft">
          {p.estado === 'resuelto' ? 'Ya resuelto.' : 'Descartado: no estaba en el colegio.'}
        </p>
      ) : (
        <>
          <AvisoPropuesta
            pendiente={p}
            nombreGrupo={nombreGrupo}
            liderDelCentro={liderDelCentro}
            nombreEstudiante={nombreEstudiante}
            trabajando={trabajando}
            onDecidir={decidir}
          />
          {p.tipo === 'homonimo' && (
            <Homonimo pendiente={p} trabajando={trabajando} onDecidir={decidir} />
          )}
          {p.tipo === 'ortografia' && (
            <Ortografia pendiente={p} trabajando={trabajando} onDecidir={decidir} />
          )}
          {p.tipo === 'no_encontrado' && (
            <NoEncontrado
              pendiente={p}
              sede={sede}
              trabajando={trabajando}
              onDecidir={decidir}
            />
          )}
          {p.tipo === 'duplicado' && (
            <Duplicado
              pendiente={p}
              nombreGrupo={nombreGrupo}
              trabajando={trabajando}
              onDecidir={decidir}
            />
          )}
        </>
      )}

      {fallo && (
        <p className="mt-2 rounded-lg border border-danger-soft bg-danger-soft p-2 text-sm text-danger-soft-fg">
          {fallo}
        </p>
      )}
    </article>
  );
}

type OpcionesDecidir = {
  inscribirEn?: { grupoId: string; studentId: string };
  retirarDe?: { grupoId: string; studentId: string }[];
  /** Centro que gana un `duplicado`: se le levanta la marca de conflicto. */
  limpiarConflictoEn?: { grupoId: string; studentId: string };
  estado: 'resuelto' | 'descartado';
  decision?: string;
};

type Decidir = (opciones: OpcionesDecidir) => void | Promise<void>;

/**
 * La propuesta del lider traducida a la MISMA decision que tomaria la coordinadora a
 * mano. Confirmar no es un atajo con reglas propias: produce exactamente las escrituras
 * que produce pulsar el candidato (o el centro ganador) en la tarjeta, en el mismo orden.
 *
 * Devuelve `null` cuando la propuesta no se puede aplicar tal cual —un `duplicado` que
 * senala un centro que ya no esta en conflicto, por ejemplo—; entonces no se ofrece el
 * boton y la tarjeta se resuelve como siempre. Antes que aplicar una decision que no se
 * entiende, no ofrecerla.
 */
function accionDePropuesta(p: PendientePrograma): OpcionesDecidir | null {
  const propuesta = p.propuestaLider;
  if (!propuesta) return null;

  if (p.tipo === 'duplicado') {
    const enConflicto =
      p.gruposEnConflicto && p.gruposEnConflicto.length > 0
        ? p.gruposEnConflicto
        : [p.grupoId];
    const studentId = p.sugerido ?? p.candidatos[0]?.studentId ?? null;
    if (!studentId || !enConflicto.includes(propuesta)) return null;
    return {
      retirarDe: enConflicto
        .filter((otro) => otro !== propuesta)
        .map((otro) => ({ grupoId: otro, studentId })),
      limpiarConflictoEn: { grupoId: propuesta, studentId },
      estado: 'resuelto',
      decision: propuesta,
    };
  }

  return {
    inscribirEn: { grupoId: p.grupoId, studentId: propuesta },
    estado: 'resuelto',
    decision: propuesta,
  };
}

/**
 * El aviso de arriba: quien propuso, que propuso, y el boton de confirmarlo.
 *
 * Va con nombre propio —«Julián Medina, que lidera este centro, dice que es esta»— porque
 * lo que convierte una pregunta en una confirmacion es saber QUIEN responde: la
 * coordinadora no conoce a los muchachos, pero si conoce a los veintiun lideres.
 *
 * Si el sistema habia propuesto a otra persona, se dice. Son dos opiniones distintas y
 * esconder la del sistema seria decidir por ella; el candidato del sistema sigue visible
 * y pulsable mas abajo.
 */
function AvisoPropuesta({
  pendiente,
  nombreGrupo,
  liderDelCentro,
  nombreEstudiante,
  trabajando,
  onDecidir,
}: {
  pendiente: PendientePrograma;
  nombreGrupo: (grupoId: string) => string;
  liderDelCentro: (grupoId: string) => string | null;
  nombreEstudiante: (studentId: string) => string | null;
  trabajando: boolean;
  onDecidir: Decidir;
}) {
  const p = pendiente;
  const propuesta = p.propuestaLider;
  if (!propuesta) return null;

  const correo = (p.propuestaLiderPor ?? '').trim();
  const quien = correo ? nombreLegibleDeCorreo(correo) : null;
  const esElLider = Boolean(correo) && liderDelCentro(p.grupoId) === correo.toLowerCase();

  const duplicado = p.tipo === 'duplicado';
  const nombrePropuesto = duplicado
    ? nombreGrupo(propuesta)
    : (p.candidatos.find((c) => c.studentId === propuesta)?.nombre ??
      nombreEstudiante(propuesta));

  const accion = accionDePropuesta(p);

  // La propuesta senala a alguien que ya no se puede mostrar (salio de la matricula, o el
  // centro dejo de estar en conflicto). Se dice y no se ofrece confirmar a ciegas.
  if (!nombrePropuesto || !accion) {
    return (
      <p className="mt-2 rounded-lg border border-warning-soft bg-warning-soft p-2 text-sm text-warning-soft-fg">
        {quien ?? 'El líder del centro'} dejó una propuesta para este caso, pero ya no se
        puede aplicar tal cual. Resuélvalo abajo como siempre.
      </p>
    );
  }

  const sugeridoDistinto =
    !duplicado && p.sugerido && p.sugerido !== propuesta
      ? (p.candidatos.find((c) => c.studentId === p.sugerido)?.nombre ??
        nombreEstudiante(p.sugerido))
      : null;

  return (
    <div className="mt-2 rounded-xl border border-accent bg-accent-soft p-2.5">
      <p className="text-sm text-accent-soft-fg">
        <UserCheck size={16} className="mr-1 inline align-text-bottom" aria-hidden />
        <b>{quien ?? 'El líder de este centro'}</b>
        {quien ? (esElLider ? ', que lidera este centro,' : ', docente de este centro,') : ''} dice
        que {duplicado ? 'se queda en' : 'es'} <b>{nombrePropuesto}</b>.
      </p>

      {sugeridoDistinto && (
        <p className="mt-1 text-xs text-accent-soft-fg">
          El sistema había propuesto a <b>{sugeridoDistinto}</b>. Son dos opiniones
          distintas: las dos están abajo y decide usted.
        </p>
      )}

      <button
        disabled={trabajando}
        onClick={() => void onDecidir(accion)}
        className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-3 py-2.5 text-sm font-semibold text-accent-fg disabled:opacity-50"
      >
        <Check size={18} aria-hidden />
        {trabajando ? 'Guardando…' : `Confirmar: ${nombrePropuesto}`}
      </button>
      <p className="mt-1 text-xs text-accent-soft-fg">
        Es una propuesta, no una orden: abajo puede escoger otra persona o descartar.
      </p>
    </div>
  );
}

/** Boton grande con la FOTO del candidato. La cara es el dato que decide. */
function BotonCandidato({
  candidato,
  tono,
  disabled,
  onClick,
}: {
  candidato: CandidatoPendiente;
  /**
   * De quien es la propuesta que marca a este candidato. `lider` pesa mas que `sistema`
   * —quien conoce al muchacho es el docente que le da clase—, pero el del sistema no se
   * esconde: se marca en gris y se deja pulsable.
   */
  tono?: 'lider' | 'sistema';
  disabled: boolean;
  onClick: () => void;
}) {
  // `Avatar` usa `fotoPath` solo como senal de "este tiene foto, ve a buscarla" — la
  // ruta real la calcula `urlDeFoto` a partir del `studentId`. El pendiente no guarda
  // `fotoPath` (guarda lo minimo: son datos de menores), asi que se pone la senal y se
  // deja que la busqueda decida: si no hay foto, `urlDeFoto` devuelve null y salen las
  // iniciales, igual que en la planilla.
  const comoEstudiante = {
    studentId: candidato.studentId,
    nombres: candidato.nombre,
    apellidos: '',
    fotoPath: 'buscar',
  };
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      className={[
        'flex w-full items-center gap-3 rounded-xl border p-2 text-left disabled:opacity-50',
        tono === 'lider' ? 'border-accent bg-accent-soft' : 'border-line bg-elevated',
      ].join(' ')}
    >
      <Avatar estudiante={comoEstudiante} tamano={52} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-strong">
          {candidato.nombre}
        </span>
        <span className="block text-xs text-muted">{candidato.grado}</span>
      </span>
      {tono === 'lider' && (
        <span className="shrink-0 rounded-full bg-accent px-2 py-0.5 text-xs font-semibold text-accent-fg">
          Dice el líder
        </span>
      )}
      {tono === 'sistema' && (
        <span className="shrink-0 rounded-full border border-line px-2 py-0.5 text-xs text-muted">
          Dice el sistema
        </span>
      )}
    </button>
  );
}

function BotonDescartar({
  texto,
  disabled,
  onClick,
}: {
  texto: string;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      className="flex w-full items-center justify-center gap-2 rounded-xl border border-line p-2 text-sm text-soft disabled:opacity-50"
    >
      <UserX size={16} aria-hidden />
      {texto}
    </button>
  );
}

function Homonimo({
  pendiente,
  trabajando,
  onDecidir,
}: {
  pendiente: PendientePrograma;
  trabajando: boolean;
  onDecidir: Decidir;
}) {
  // El candidato que senala el lider sube al primer puesto: es el que se va a pulsar.
  const ordenados = [...pendiente.candidatos].sort(
    (a, b) =>
      Number(b.studentId === pendiente.propuestaLider) -
      Number(a.studentId === pendiente.propuestaLider),
  );

  return (
    <>
      <p className="mt-1 text-sm text-soft">
        {pendiente.propuestaLider
          ? `Estas son las ${pendiente.candidatos.length} que se llaman igual.`
          : `No estoy seguro de quién es. ¿Cuál de estas ${pendiente.candidatos.length}?`}
      </p>
      <div className="mt-2 space-y-1.5">
        {ordenados.map((c) => (
          <BotonCandidato
            key={c.studentId}
            candidato={c}
            tono={
              c.studentId === pendiente.propuestaLider
                ? 'lider'
                : c.studentId === pendiente.sugerido
                  ? 'sistema'
                  : undefined
            }
            disabled={trabajando}
            onClick={() =>
              void onDecidir({
                inscribirEn: { grupoId: pendiente.grupoId, studentId: c.studentId },
                estado: 'resuelto',
                decision: c.studentId,
              })
            }
          />
        ))}
        <BotonDescartar
          texto="Ninguna: es otra persona"
          disabled={trabajando}
          onClick={() => void onDecidir({ estado: 'descartado' })}
        />
      </div>
    </>
  );
}

/**
 * Ortografia: hay un solo candidato y viene ya marcado como propuesta. Lo unico que se
 * pide es confirmar o rechazar, y por eso se muestran los dos nombres LADO A LADO: la
 * decision es comparar dos cadenas, y ponerlas juntas es la mitad del trabajo hecho.
 */
function Ortografia({
  pendiente,
  trabajando,
  onDecidir,
}: {
  pendiente: PendientePrograma;
  trabajando: boolean;
  onDecidir: Decidir;
}) {
  // Manda el lider sobre el sistema: si senalo a alguien de la lista, es ese el que se
  // compara lado a lado con el nombre del archivo.
  const propuesto =
    pendiente.candidatos.find((c) => c.studentId === pendiente.propuestaLider) ??
    pendiente.candidatos.find((c) => c.studentId === pendiente.sugerido) ??
    pendiente.candidatos[0];

  if (!propuesto) {
    return (
      <p className="mt-1 text-sm text-soft">
        Este caso venía con una propuesta, pero ya no la tiene. Descártelo y vuelva a
        importar la lista.
      </p>
    );
  }

  return (
    <>
      <p className="mt-1 text-sm text-soft">Creo que es la misma persona, escrita distinto.</p>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <div className="rounded-lg border border-line bg-elevated p-2">
          <p className="text-xs text-muted">En la lista decía</p>
          <p className="text-sm font-semibold text-strong">{pendiente.nombreArchivo}</p>
          {pendiente.grupoArchivo && (
            <p className="text-xs text-muted">{pendiente.grupoArchivo}</p>
          )}
        </div>
        <div className="rounded-lg border border-accent bg-accent-soft p-2">
          <p className="text-xs text-accent-soft-fg">En la matrícula es</p>
          <p className="text-sm font-semibold text-strong">{propuesto.nombre}</p>
          <p className="text-xs text-muted">{propuesto.grado}</p>
        </div>
      </div>
      <div className="mt-2 space-y-1.5">
        <BotonCandidato
          candidato={propuesto}
          tono={propuesto.studentId === pendiente.propuestaLider ? 'lider' : 'sistema'}
          disabled={trabajando}
          onClick={() =>
            void onDecidir({
              inscribirEn: { grupoId: pendiente.grupoId, studentId: propuesto.studentId },
              estado: 'resuelto',
              decision: propuesto.studentId,
            })
          }
        />
        <BotonDescartar
          texto="No, no es la misma persona"
          disabled={trabajando}
          onClick={() => void onDecidir({ estado: 'descartado' })}
        />
      </div>
    </>
  );
}

/**
 * No encontrado: no hay candidato, asi que aqui SI hay que buscar — pero en TODO el
 * colegio, no en el grado que decia el archivo. Tres de los treinta fallos de la manana
 * del 2026-08-24 eran cambios de grupo, no errores de nombre; con la busqueda acotada al
 * grado se habrian perdido en silencio (regla de oro, docs/modelo-centros-interes.md).
 */
function NoEncontrado({
  pendiente,
  sede,
  trabajando,
  onDecidir,
}: {
  pendiente: PendientePrograma;
  sede: string;
  trabajando: boolean;
  onDecidir: Decidir;
}) {
  const [texto, setTexto] = useState('');
  const [resultados, setResultados] = useState<Student[]>([]);
  const [buscando, setBuscando] = useState(false);

  useEffect(() => {
    if (texto.trim().length < 2) {
      setResultados([]);
      return;
    }
    let vivo = true;
    setBuscando(true);
    void buscarEstudiantes(sede, texto)
      .then((lista) => vivo && setResultados(lista))
      .finally(() => vivo && setBuscando(false));
    return () => {
      vivo = false;
    };
  }, [texto, sede]);

  return (
    <>
      <p className="mt-1 text-sm text-soft">
        Con ese nombre no encontré a nadie en la matrícula. Búsquelo usted, en todo el
        colegio — puede haber cambiado de grupo.
      </p>
      <div className="mt-2 flex items-center gap-2 rounded-lg border border-line bg-elevated px-2">
        <Search size={16} className="shrink-0 text-muted" aria-hidden />
        <input
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Apellido o nombre"
          className="min-w-0 flex-1 bg-transparent py-2 text-base text-strong outline-none"
        />
      </div>

      {buscando && <p className="mt-1 text-xs text-muted">Buscando…</p>}

      <div className="mt-2 space-y-1.5">
        {resultados.map((e) => (
          <BotonCandidato
            key={e.studentId}
            candidato={{
              studentId: e.studentId,
              nombre: nombreCompleto(e),
              grado: e.gradoActual,
            }}
            disabled={trabajando}
            onClick={() =>
              void onDecidir({
                inscribirEn: { grupoId: pendiente.grupoId, studentId: e.studentId },
                estado: 'resuelto',
                decision: e.studentId,
              })
            }
          />
        ))}
        <BotonDescartar
          texto="No está / se retiró"
          disabled={trabajando}
          onClick={() => void onDecidir({ estado: 'descartado' })}
        />
      </div>
    </>
  );
}

/**
 * Duplicado: el mismo estudiante quedo en dos centros.
 *
 * Y MIENTRAS NADIE DECIDA, SIGUE EN LOS DOS. Es una decision expresa de Julian, no un
 * fallo: si el sistema lo sacara de uno por su cuenta, el lider de ese centro lo llamaria
 * a lista y no lo encontraria. La tarjeta lo dice con esas palabras, porque lo que parece
 * un error y no se explica se "arregla" a mano y se rompe.
 */
function Duplicado({
  pendiente,
  nombreGrupo,
  trabajando,
  onDecidir,
}: {
  pendiente: PendientePrograma;
  nombreGrupo: (grupoId: string) => string;
  trabajando: boolean;
  onDecidir: Decidir;
}) {
  const enConflicto =
    pendiente.gruposEnConflicto && pendiente.gruposEnConflicto.length > 0
      ? pendiente.gruposEnConflicto
      : [pendiente.grupoId];
  const studentId = pendiente.sugerido ?? pendiente.candidatos[0]?.studentId ?? null;
  const persona = pendiente.candidatos.find((c) => c.studentId === studentId);

  return (
    <>
      <p className="mt-1 text-sm text-soft">
        <b className="text-strong">{persona?.nombre ?? pendiente.nombreArchivo}</b> está
        inscrita en {enConflicto.length === 2 ? 'DOS' : enConflicto.length} centros:{' '}
        {enConflicto.map((g, i) => (
          <span key={g}>
            {i > 0 && ' y '}
            <i>{nombreGrupo(g)}</i>
          </span>
        ))}
        . ¿En cuál se queda?
      </p>

      <p className="mt-2 rounded-lg border border-info-soft bg-info-soft p-2 text-xs text-info-soft-fg">
        Mientras no se decida, el estudiante está inscrito en los dos a propósito, para que
        ninguno de los dos líderes se quede sin poder llamarlo a lista. No es un error. Al
        elegir, se le quita del centro que no gane.
      </p>

      <div className="mt-2 space-y-1.5">
        {[...enConflicto]
          .sort(
            (a, b) =>
              Number(b === pendiente.propuestaLider) - Number(a === pendiente.propuestaLider),
          )
          .map((g) => (
          <button
            key={g}
            disabled={trabajando || !studentId}
            onClick={() =>
              studentId &&
              void onDecidir({
                retirarDe: enConflicto
                  .filter((otro) => otro !== g)
                  .map((otro) => ({ grupoId: otro, studentId })),
                // `g` es el centro que gana: se le levanta la marca.
                limpiarConflictoEn: { grupoId: g, studentId },
                estado: 'resuelto',
                decision: g,
              })
            }
            className={[
              'flex w-full items-center gap-2 rounded-xl border p-3 text-left text-sm font-semibold text-strong disabled:opacity-50',
              g === pendiente.propuestaLider
                ? 'border-accent bg-accent-soft'
                : 'border-line bg-elevated',
            ].join(' ')}
          >
            <Check size={18} className="shrink-0 text-accent" aria-hidden />
            <span className="min-w-0 flex-1">Se queda en {nombreGrupo(g)}</span>
            {g === pendiente.propuestaLider && (
              <span className="shrink-0 rounded-full bg-accent px-2 py-0.5 text-xs font-semibold text-accent-fg">
                Dice el líder
              </span>
            )}
          </button>
        ))}
        <button
          disabled={trabajando}
          onClick={() => void onDecidir({ estado: 'descartado' })}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-line p-2 text-sm text-soft disabled:opacity-50"
        >
          <X size={16} aria-hidden />
          Dejarlo así por ahora
        </button>
      </div>
    </>
  );
}
