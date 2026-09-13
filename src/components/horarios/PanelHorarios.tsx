/**
 * Pantalla del módulo de generación de horarios.
 *
 * El horario se construye de una sede y una jornada a la vez, nunca del colegio
 * entero: son problemas independientes y cada coordinador trabaja el suyo. Lo
 * primero que hay que decir, por tanto, es cuál se va a construir.
 *
 * Después son tres pasos: se descargan los datos, se genera con el motor (un
 * programa aparte, porque esta app es un sitio estático y no puede ejecutar el
 * solver) y se carga el resultado para revisarlo.
 *
 * Nada de lo que se cargue aquí toca el horario vigente del colegio: son
 * borradores que viven en el navegador del coordinador hasta que se publiquen.
 */

import { useCallback, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle, CheckCircle2, Download, FileJson, Trash2, Upload,
} from 'lucide-react';

import {
  ciMananaDeducida, construirEntrada, leerSalida, nombreArchivoEntrada, sedesParaGenerar,
} from '../../data/horarios/contrato';
import {
  activar, borrarVersion, guardarVersion, horarioActivo, listarVersiones, obtenerVersion,
} from '../../data/horarios/almacen';
import {
  compararHorarios, docentesConVariosDiasLlenos, movidasPorDocente,
} from '../../data/horarios/comparar';
import type { Cambios, ClaseMovida } from '../../data/horarios/comparar';
import { leerConfiguracion } from '../../data/horarios/configuracion';
import { ASIGNATURAS } from '../../data/asignacionAcademica';
import { USUARIOS } from '../../data/maestros';
import type { ClaseGenerada, Jornada, SalidaGenerador } from '../../data/horarios/tipos';
import { cn } from '../../lib/utils';
import AjustarBorrador from './AjustarBorrador';
import ConfiguracionAnio from './ConfiguracionAnio';
import DisponibilidadDocente from './DisponibilidadDocente';
import RevisionDatos from './RevisionDatos';

const ANIO_OBJETIVO = new Date().getFullYear();

const NOMBRE_JORNADA: Record<Jornada, string> = { manana: 'Mañana', tarde: 'Tarde' };

function descargarJson(contenido: unknown, nombre: string): void {
  const blob = new Blob([JSON.stringify(contenido, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = nombre;
  document.body.appendChild(enlace);
  enlace.click();
  document.body.removeChild(enlace);
  // Sin esto el archivo se queda en memoria hasta que se cierre la pestaña.
  URL.revokeObjectURL(url);
}

function Pastilla({ activa, deshabilitada, onClick, children, nota }: {
  activa: boolean; deshabilitada?: boolean; onClick: () => void;
  children: React.ReactNode; nota?: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={deshabilitada}
      className={cn(
        'rounded-xl border px-4 py-2 text-sm text-left transition',
        deshabilitada && 'opacity-40 cursor-not-allowed border-line bg-card',
        !deshabilitada && activa && 'border-accent bg-accent text-accent-fg font-medium',
        !deshabilitada && !activa && 'border-line bg-card text-strong hover:bg-hover',
      )}
    >
      <div>{children}</div>
      {nota && <div className="text-[11px] opacity-70 mt-0.5">{nota}</div>}
    </button>
  );
}

function Paso({ numero, titulo, children }: {
  numero: number; titulo: string; children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-line bg-card p-5 flex gap-4">
      <div className="w-8 h-8 flex-shrink-0 rounded-full bg-accent-soft text-accent-soft-fg
                      flex items-center justify-center text-sm font-semibold">
        {numero}
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="text-strong text-base font-semibold mb-1">{titulo}</h3>
        {children}
      </div>
    </div>
  );
}

function Cifra({ valor, texto }: { valor: string; texto: string }) {
  return (
    <div className="rounded-xl border border-line bg-card px-4 py-2">
      <div className="text-strong text-lg font-semibold leading-tight">{valor}</div>
      <div className="text-muted text-[11px]">{texto}</div>
    </div>
  );
}

const NOMBRE_DIA: Record<string, string> = {
  lunes: 'lunes', martes: 'martes', miercoles: 'miércoles',
  jueves: 'jueves', viernes: 'viernes',
};

/**
 * En qué se diferencian dos versiones.
 *
 * Con pocos cambios se listan uno a uno: es un ajuste y se lee de un vistazo.
 * Con muchos, una lista renglón por renglón no sirve —la primera vez que Julián
 * la usó eran 240 líneas— y se agrupa por docente, de quien más cambió a quien
 * menos, con el detalle de cada uno a un clic. Y se enseña la carga (docentes con
 * más de un día lleno) antes y después, que es lo que decide cuál es mejor.
 */
function Comparacion({ nombre, cambios, antes, despues }: {
  nombre: string; cambios: Cambios; antes: ClaseGenerada[]; despues: ClaseGenerada[];
}) {
  const [abierto, setAbierto] = useState<string | null>(null);
  const { movidas, quitadas, agregadas, intactas } = cambios;
  const total = movidas.length + intactas;

  const nombreDocente = (id: string) => USUARIOS.find(u => u.id === id)?.nombreCorto ?? id;
  const nombreMateria = (id?: string) =>
    ASIGNATURAS.find(a => a.id === id)?.abrev ?? id ?? 'clase';
  const cuando = (f: { dia: string; bloque: number }) =>
    `${NOMBRE_DIA[f.dia] ?? f.dia} ${f.bloque}.ª`;

  const porDocente = useMemo(() => movidasPorDocente(movidas), [movidas]);

  // La carga de cada uno, antes y después. Es lo que de verdad importa al elegir
  // entre dos horarios, y lo que una lista de movimientos no deja ver.
  const llenos = useMemo(() => {
    const bloques = leerConfiguracion(ciMananaDeducida()).bloques;
    return {
      antes: docentesConVariosDiasLlenos(antes, bloques),
      despues: docentesConVariosDiasLlenos(despues, bloques),
    };
  }, [antes, despues]);

  const Movimiento = ({ m }: { m: ClaseMovida }) => (
    <li>
      <span className="text-strong">{m.grupo}</span> · {nombreMateria(m.asignatura)}:{' '}
      {cuando(m.de)} → <span className="text-strong">{cuando(m.a)}</span>
    </li>
  );

  if (movidas.length === 0 && quitadas.length === 0 && agregadas.length === 0) {
    return (
      <div className="mt-4 rounded-xl border border-line bg-hover p-4">
        <p className="text-strong text-sm font-medium mb-1">Frente a «{nombre}»</p>
        <p className="text-muted text-sm">
          Son el mismo horario: las {intactas} clases están en la misma hora.
        </p>
      </div>
    );
  }

  // Pocos cambios se leen de uno en uno. Muchos, no: se agrupan por persona.
  const esUnAjuste = movidas.length <= 15;
  const sonOtroHorario = total > 0 && movidas.length / total > 0.5;

  return (
    <div className="mt-4 rounded-xl border border-line bg-hover p-4">
      <p className="text-strong text-sm font-medium mb-1">Frente a «{nombre}»</p>
      <p className="text-muted text-sm">
        <span className="text-strong font-medium">{movidas.length}</span> de {total} clases
        cambiaron de hora.
        {sonOtroHorario && ' Más de la mitad: no es un ajuste, son dos horarios distintos.'}
      </p>

      <div className="flex flex-wrap gap-x-6 gap-y-1 mt-3 text-sm">
        <span className="text-muted">
          Docentes con más de un día lleno:{' '}
          <span className="text-strong font-medium">{llenos.antes.length}</span>
          {' → '}
          <span className={
            llenos.despues.length < llenos.antes.length ? 'text-success font-medium'
              : llenos.despues.length > llenos.antes.length ? 'text-danger-soft-fg font-medium'
                : 'text-strong font-medium'}
          >
            {llenos.despues.length}
          </span>
          {llenos.despues.length > 0 && llenos.despues.length <= 5 && (
            <span className="text-muted">
              {' '}({llenos.despues.map(x => nombreDocente(x.docente)).join(', ')})
            </span>
          )}
        </span>
      </div>

      {esUnAjuste ? (
        <ul className="text-muted text-sm space-y-0.5 mt-3">
          {movidas.map((m, i) => (
            <li key={i}>
              <span className="text-strong">{nombreDocente(m.docente)}</span>{' · '}
              {m.grupo} · {nombreMateria(m.asignatura)}: {cuando(m.de)} →{' '}
              <span className="text-strong">{cuando(m.a)}</span>
            </li>
          ))}
        </ul>
      ) : (
        <>
          <p className="text-muted text-xs mt-3 mb-1.5">
            A quién le cambió la semana, de más a menos. Pulsa un nombre para ver sus clases.
          </p>
          <div className="flex flex-col gap-1">
            {porDocente.map(([docente, suyas]) => {
              const visible = abierto === docente;
              return (
                <div key={docente}>
                  <button
                    onClick={() => setAbierto(visible ? null : docente)}
                    className="w-full flex items-center gap-3 rounded-lg px-2 py-1 text-left
                               text-sm hover:bg-card transition"
                  >
                    <span className="text-strong w-28 truncate">{nombreDocente(docente)}</span>
                    <span className="flex-1 h-1.5 rounded-full bg-line overflow-hidden">
                      <span
                        className="block h-full bg-accent"
                        style={{ width: `${(suyas.length / porDocente[0][1].length) * 100}%` }}
                      />
                    </span>
                    <span className="text-muted text-xs w-20 text-right">
                      {suyas.length} clase{suyas.length === 1 ? '' : 's'}
                    </span>
                  </button>
                  {visible && (
                    <ul className="text-muted text-xs space-y-0.5 pl-6 pb-2 pt-1">
                      {suyas.map((m, i) => <Movimiento key={i} m={m} />)}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {(quitadas.length > 0 || agregadas.length > 0) && (
        <p className="text-warning-soft-fg text-xs mt-3">
          Además, {quitadas.length} clase(s) ya no están y {agregadas.length} son nuevas. Los
          dos horarios no cubren lo mismo: probablemente se generaron con asignaciones
          distintas.
        </p>
      )}
    </div>
  );
}

export default function PanelHorarios() {
  const sedes = useMemo(() => sedesParaGenerar(), []);
  const [sede, setSede] = useState(() => sedes.find(s => s.tieneDatos)?.id ?? sedes[0].id);
  const [jornada, setJornada] = useState<Jornada>('manana');

  const [versiones, setVersiones] = useState(() => listarVersiones());
  const [activo, setActivo] = useState<SalidaGenerador | null>(() => horarioActivo());
  const [errores, setErrores] = useState<string[]>([]);
  const [aviso, setAviso] = useState<string | null>(null);
  const [comparadaId, setComparadaId] = useState<string | null>(null);
  // Sube cada vez que se guarda algo de la configuración. Sin esto, la revisión
  // de datos seguiría enseñando las cuentas de antes del cambio.
  const [versionConfig, setVersionConfig] = useState(0);
  const configCambio = useCallback(() => {
    setAviso(null);
    setVersionConfig(v => v + 1);
  }, []);
  const inputArchivo = useRef<HTMLInputElement>(null);

  const sedeElegida = sedes.find(s => s.id === sede)!;
  const listaParaGenerar = sedeElegida.tieneDatos;

  const refrescar = useCallback(() => {
    setVersiones(listarVersiones());
    setActivo(horarioActivo());
  }, []);

  const alDescargar = useCallback(() => {
    setErrores([]);
    setAviso(null);
    try {
      const entrada = construirEntrada({ sede, jornada, anio: ANIO_OBJETIVO });
      if (entrada.asignacion.length === 0) {
        setErrores([`No hay asignación académica cargada para ${sedeElegida.nombre} `
          + `en la jornada de la ${jornada}. No se puede generar un horario de la nada.`]);
        return;
      }
      descargarJson(entrada, nombreArchivoEntrada(ANIO_OBJETIVO, sede, jornada));
      setAviso(`${sedeElegida.nombre}, jornada de la ${jornada}: se descargaron `
        + `${entrada.asignacion.length} renglones de asignación `
        + `(${entrada.asignacion.reduce((s, f) => s + f.horas, 0)} horas), `
        + `${entrada.docentes.length} docentes y ${entrada.grupos.length} grupos.`);
    } catch (e) {
      setErrores([`No se pudieron preparar los datos: ${(e as Error).message}`]);
    }
  }, [sede, jornada, sedeElegida]);

  const alCargarArchivo = useCallback(async (archivo: File) => {
    setErrores([]);
    setAviso(null);
    const lectura = leerSalida(await archivo.text());
    if (!lectura.ok) {
      setErrores(lectura.errores);
      return;
    }
    const guardado = guardarVersion(lectura.valor, archivo.name.replace(/\.json$/i, ''));
    if (!guardado.ok) setErrores([guardado.mensaje ?? 'No se pudo guardar.']);
    refrescar();
  }, [refrescar]);

  const calidad = activo?.calidad;
  const sinUbicar = activo?.sin_ubicar ?? [];

  /**
   * Comparación con otra versión guardada. Se compara siempre contra la que está
   * en revisión, que es la pregunta que el coordinador se hace de verdad: «¿en
   * qué se diferencia esta de la que estoy mirando?».
   */
  const comparacion = useMemo(() => {
    if (!comparadaId || !activo) return null;
    const otra = obtenerVersion(comparadaId);
    if (!otra) return null;
    const nombre = versiones.find(v => v.id === comparadaId)?.nombre ?? 'esa versión';
    return {
      nombre,
      cambios: compararHorarios(otra.horario, activo.horario),
      antes: otra.horario,
      despues: activo.horario,
    };
  }, [comparadaId, activo, versiones]);

  /**
   * Los datos con los que se juzga un movimiento salen de la jornada que cubre
   * el borrador, no de la que esté elegida arriba: si el coordinador cargó el
   * de la tarde y luego tocó el selector, se estaría midiendo contra la semana
   * equivocada y los avisos serían mentira.
   */
  const entradaDelBorrador = useMemo(() => {
    if (!activo || activo.horario.length === 0) return null;
    try {
      return construirEntrada({
        sede,
        jornada: activo.horario[0].jornada,
        anio: ANIO_OBJETIVO,
      });
    } catch {
      return null;
    }
  }, [activo, sede]);

  const alGuardarAjuste = useCallback((horario: ClaseGenerada[]) => {
    if (!activo) return;
    setErrores([]);
    const marca = new Date().toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' });
    const guardado = guardarVersion({ ...activo, horario }, `Ajustado a mano · ${marca}`);
    if (!guardado.ok) {
      setErrores([guardado.mensaje ?? 'No se pudo guardar.']);
      return;
    }
    setAviso('Se guardó el horario ajustado como una versión nueva. La anterior sigue '
      + 'en la lista, por si hay que volver a ella.');
    refrescar();
  }, [activo, refrescar]);

  return (
    <div className="flex flex-col gap-5 max-w-5xl">
      <div>
        <h2 className="text-strong text-xl font-semibold">Generar el horario</h2>
        <p className="text-muted text-sm mt-1">
          Se construye una sede y una jornada a la vez. Lo que se cargue aquí no cambia el
          horario que ven los docentes: queda como borrador hasta que se publique.
        </p>
      </div>

      {errores.length > 0 && (
        <div className="rounded-2xl border border-danger-soft bg-danger-soft p-4">
          <div className="flex items-center gap-2 text-danger-soft-fg font-medium mb-2">
            <AlertTriangle className="w-4 h-4" /> No se pudo continuar
          </div>
          <ul className="text-danger-soft-fg text-sm list-disc pl-5 space-y-0.5">
            {errores.slice(0, 8).map((e, i) => <li key={i}>{e}</li>)}
            {errores.length > 8 && <li>… y {errores.length - 8} problemas más.</li>}
          </ul>
        </div>
      )}

      {aviso && (
        <div className="rounded-2xl border border-line bg-card p-4 flex items-start gap-2">
          <CheckCircle2 className="w-4 h-4 text-success flex-shrink-0 mt-0.5" />
          <p className="text-muted text-sm">{aviso}</p>
        </div>
      )}

      <div className="rounded-2xl border border-line bg-card p-5">
        <h3 className="text-strong text-base font-semibold mb-1">¿Qué horario va a construir?</h3>
        <p className="text-muted text-sm mb-4">
          Cualquier coordinador puede construir cualquiera. Publicarlo es otra cosa.
        </p>

        <div className="text-muted text-xs font-medium mb-2">Sede</div>
        <div className="flex flex-wrap gap-2 mb-4">
          {sedes.map(s => (
            <Pastilla
              key={s.id}
              activa={s.id === sede}
              deshabilitada={!s.tieneDatos}
              onClick={() => setSede(s.id)}
              nota={s.tieneDatos ? undefined : 'sin datos todavía'}
            >
              {s.nombre}
            </Pastilla>
          ))}
        </div>

        <div className="text-muted text-xs font-medium mb-2">Jornada</div>
        <div className="flex flex-wrap gap-2">
          {(['manana', 'tarde'] as Jornada[]).map(j => (
            <Pastilla key={j} activa={j === jornada} onClick={() => setJornada(j)}>
              {NOMBRE_JORNADA[j]}
            </Pastilla>
          ))}
        </div>
      </div>

      <ConfiguracionAnio onCambio={configCambio} />

      <DisponibilidadDocente
        // La cuadrícula cambia con la sede y la jornada elegidas arriba: se
        // remonta para no arrastrar el docente seleccionado de la anterior.
        key={`${sede}-${jornada}-${versionConfig}`}
        sede={sede}
        jornada={jornada}
        anio={ANIO_OBJETIVO}
        onCambio={configCambio}
      />

      <RevisionDatos
        key={`rev-${sede}-${jornada}-${versionConfig}`}
        sede={sede}
        jornada={jornada}
        anio={ANIO_OBJETIVO}
      />

      <Paso numero={1} titulo="Descargar los datos para el generador">
        <p className="text-muted text-sm mb-3">
          Se toma la asignación académica de{' '}
          <span className="text-strong">{sedeElegida.nombre}, jornada de la {jornada}</span>,
          con sus docentes, grupos, aulas y franjas fijas.
        </p>
        <button
          onClick={alDescargar}
          disabled={!listaParaGenerar}
          className={cn(
            'inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition',
            listaParaGenerar
              ? 'bg-accent text-accent-fg hover:opacity-90'
              : 'bg-card border border-line text-muted cursor-not-allowed',
          )}
        >
          <Download className="w-4 h-4" /> Descargar datos
        </button>
        {!listaParaGenerar && (
          <p className="text-muted text-xs mt-2">
            {sedeElegida.nombre} todavía no tiene asignación académica cargada en la app.
          </p>
        )}
      </Paso>

      <Paso numero={2} titulo="Generar el horario con el motor">
        <p className="text-muted text-sm">
          En el computador donde está el proyecto <span className="text-strong">Horarios</span>,
          doble clic en <code className="text-strong">generar_horario.bat</code>. El programa
          lee el archivo descargado y deja el horario en la carpeta{' '}
          <code className="text-strong">salidas</code>. Tarda unos minutos.
        </p>
      </Paso>

      <Paso numero={3} titulo="Cargar el horario generado">
        <p className="text-muted text-sm mb-3">
          Se comprueba el archivo antes de aceptarlo. Si algo no encaja, se dice qué y dónde.
        </p>
        <input
          ref={inputArchivo}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={e => {
            const archivo = e.target.files?.[0];
            if (archivo) void alCargarArchivo(archivo);
            e.target.value = '';
          }}
        />
        <button
          onClick={() => inputArchivo.current?.click()}
          className="inline-flex items-center gap-2 rounded-xl border border-line bg-card
                     px-4 py-2 text-sm font-medium text-strong transition hover:bg-hover"
        >
          <Upload className="w-4 h-4" /> Elegir archivo del horario
        </button>
      </Paso>

      {activo && calidad && (
        <div className="rounded-2xl border border-line bg-card p-5">
          <h3 className="text-strong text-base font-semibold mb-3">
            Horario en revisión
            {activo.estado === 'parcial' && (
              <span className="ml-2 text-[10px] font-medium px-2 py-0.5 rounded-full
                               bg-warning-soft text-warning-soft-fg">
                incompleto
              </span>
            )}
          </h3>
          <div className="flex flex-wrap gap-3">
            <Cifra valor={`${activo.horario.length}`} texto="clases ubicadas" />
            <Cifra valor={`${activo.metricas.cobertura_pct}%`} texto="de cobertura" />
            <Cifra valor={`${calidad.pct_horas_en_bloques_dobles}%`} texto="en bloques de dos horas" />
            <Cifra valor={`${calidad.pct_exigentes_en_primeras_horas}%`} texto="materias exigentes temprano" />
            <Cifra
              valor={`${calidad.docentes_con_varios_dias_llenos.length}`}
              texto="docentes con dos días llenos"
            />
          </div>

          {sinUbicar.length > 0 && (
            <div className="mt-4 rounded-xl border border-warning-soft bg-warning-soft p-4">
              <p className="text-warning-soft-fg text-sm font-medium mb-2">
                Quedaron {sinUbicar.reduce((s, f) => s + f.horas_faltantes, 0)} horas sin ubicar:
              </p>
              <ul className="text-warning-soft-fg text-sm space-y-1">
                {sinUbicar.map((f, i) => (
                  <li key={i}>
                    <span className="font-medium">{f.asignatura} de {f.docente} con {f.grupo}</span>
                    {' '}({f.horas_faltantes} h) — {f.motivo}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {activo.recomendaciones.length > 0 && (
            <div className="mt-3 text-muted text-sm">
              <p className="font-medium text-strong mb-1">Qué se podría aflojar:</p>
              <ul className="list-disc pl-5 space-y-0.5">
                {activo.recomendaciones.map((r, i) => <li key={i}>{r.descripcion}</li>)}
              </ul>
            </div>
          )}
        </div>
      )}

      {activo && entradaDelBorrador && (
        <AjustarBorrador
          key={activo.generado_en}
          entrada={entradaDelBorrador}
          salida={activo}
          onGuardar={alGuardarAjuste}
        />
      )}

      {versiones.length > 0 && (
        <div className="rounded-2xl border border-line bg-card p-5">
          <h3 className="text-strong text-base font-semibold mb-3">
            Horarios guardados en este computador
          </h3>
          <ul className="divide-y divide-line">
            {versiones.map(v => (
              <li key={v.id} className="py-2.5 flex items-center gap-3">
                <FileJson className={cn('w-4 h-4 flex-shrink-0',
                  v.activa ? 'text-accent' : 'text-muted')} />
                <div className="flex-1 min-w-0">
                  <div className="text-strong text-sm truncate">
                    {v.nombre}
                    {v.activa && <span className="text-accent text-xs ml-2">· en revisión</span>}
                  </div>
                  <div className="text-muted text-xs">
                    {v.jornadas.map(j => NOMBRE_JORNADA[j]).join(' y ') || 'sin clases'} ·{' '}
                    {new Date(v.guardadaEn).toLocaleString('es-CO')} · {v.clases} clases ·{' '}
                    {v.cobertura}% de cobertura
                  </div>
                </div>
                {!v.activa && (
                  <>
                    <button
                      onClick={() => setComparadaId(comparadaId === v.id ? null : v.id)}
                      className={cn('text-xs transition px-2 py-1',
                        comparadaId === v.id
                          ? 'text-accent font-medium'
                          : 'text-muted hover:text-strong')}
                    >
                      {comparadaId === v.id ? 'Ocultar' : 'Comparar'}
                    </button>
                    <button
                      onClick={() => { activar(v.id); setComparadaId(null); refrescar(); }}
                      className="text-xs text-muted hover:text-strong transition px-2 py-1"
                    >
                      Revisar
                    </button>
                  </>
                )}
                <button
                  onClick={() => { borrarVersion(v.id); refrescar(); }}
                  aria-label={`Borrar ${v.nombre}`}
                  className="text-muted hover:text-danger transition p-1"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </li>
            ))}
          </ul>
          {comparacion && <Comparacion key={comparadaId} {...comparacion} />}

          <p className="text-muted text-xs mt-3">
            El horario en revisión se puede ver en la pantalla de Horario, en las tres
            vistas de siempre. Solo cambia la jornada que cubre el borrador.
          </p>
        </div>
      )}
    </div>
  );
}
