import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import Planilla from './Planilla';

/**
 * ⚠️ NO CONVERTIR EN IMPORT ESTATICO.
 *
 * `Importar` arrastra `exceljs` (~1 MB) para leer el archivo de Master2000. Cargado de
 * forma estatica, ese peso entra en el bundle principal de MJB y lo paga TODO el mundo
 * —incluidos los docentes que solo pasan lista desde el celular— aunque la importacion
 * la use el superusuario dos veces al ano.
 *
 * Esto ya se perdio dos veces al recopiar el archivo completo. Si vuelve a aparecer como
 * `import Importar from './Importar'` arriba, es una regresion: devolverlo aqui.
 */
const Importar = lazy(() => import('./Importar'));
import Ficha from './Ficha';
import TerceraHora from './TerceraHora';
import LlegadasTarde from './LlegadasTarde';
import {
  abrirSesion,
  buscarEstudiantes,
  cerrarSesion as cerrarSesionRemota,
  leerDirectores,
  leerGrupo,
  llenarColumna,
  leerSesiones,
  marcarEstudiante,
  type AlcanceLectura,
} from './datos';
import { toDateKey } from './domain/ids';
import { nombreCompleto } from './domain/nombres';
import { jornadaDeGrado } from './domain/ids';
import type { MarkCode } from './domain/marks';
import type { Enrollment, Session, Student } from './domain/types';
import { firebaseConfigurado } from '../lib/firebase';
import { useAppStore } from '../data/store';
import { estiloEtiqueta, guardarColor, leerMapa, resolverColor, type MapaColores } from './domain/colores';

/**
 * Componente raiz del modulo de asistencia. ESTE es el punto de pegado.
 *
 * Export default y sin props obligatorias, como pide el contrato. La navegacion interna
 * es estado local, nunca URLs.
 *
 * Sobre el alcance de las consultas: NO es una preferencia. Firestore rechaza la
 * consulta entera si no puede probar que todo el resultado sera legible, asi que un
 * docente tiene que consultar por su `slotId` y un coordinador puede ir sin acotar
 * (dentro de las sedes que le tocan). Una consulta sin filtrar falla con
 * permission-denied aunque el usuario tuviera derecho a cada documento por separado.
 */
export default function Asistencia() {
  const rol = useAppStore((s) => s.rol);
  const slotId = useAppStore((s) => s.userId);
  const sede = useAppStore((s) => s.sedeActual);

  // La rectora y el superusuario consultan pero no registran. El servidor ya lo impide;
  // esto solo evita ofrecer botones que fallarian.
  const puedeRegistrar = rol !== 'rectora' && rol !== 'superusuario';

  const alcance: AlcanceLectura = useMemo(
    () =>
      rol === 'coordinador'
        ? { tipo: 'coordinador', sede }
        : { tipo: 'docente', slotId: slotId ?? '' },
    [rol, slotId, sede],
  );

  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sesiones, setSesiones] = useState<Session[]>([]);
  const [estudiantes, setEstudiantes] = useState<Student[]>([]);
  const [matriculas, setMatriculas] = useState<Enrollment[]>([]);
  const [cruce, setCruce] = useState<{ grado: string; subjectId: string } | null>(null);
  /** Navegacion interna: por estado, nunca por URL (contrato, seccion 6). */
  const [fichaAbierta, setFichaAbierta] = useState<string | null>(null);
  const [directores, setDirectores] = useState<Record<string, string>>({});
  const [vista, setVista] = useState<'planilla' | 'tercera_hora' | 'llegadas'>('planilla');

  // Preferencia visual del dispositivo, no un dato del colegio: se lee una sola vez del
  // almacen local (ver domain/colores.ts) y de ahi en adelante vive en memoria.
  const [mapaColores, setMapaColores] = useState<MapaColores>(() => leerMapa());

  /** Cruces (grado + asignatura) que aparecen en las sesiones del usuario. */
  const cruces = useMemo(() => {
    const vistos = new Map<string, { grado: string; subjectId: string }>();
    for (const s of sesiones) vistos.set(`${s.grado}|${s.subjectId}`, { grado: s.grado, subjectId: s.subjectId });
    return [...vistos.values()].sort((a, b) => a.grado.localeCompare(b.grado));
  }, [sesiones]);

  const cargarSesiones = useCallback(async () => {
    setError(null);
    try {
      const lista = await leerSesiones(alcance);
      setSesiones(lista);
      setCruce((actual) => actual ?? (lista.length ? { grado: lista[0].grado, subjectId: lista[0].subjectId } : null));
    } catch (e) {
      setError(mensajeDeError(e));
    } finally {
      setCargando(false);
    }
  }, [alcance]);

  useEffect(() => {
    // El superusuario no lee sesiones: la regla se lo deniega siempre. Pedirlas igual
    // solo produciria un permission-denied inutil en cada visita.
    if (!firebaseConfigurado || rol === 'superusuario') {
      setCargando(false);
      return;
    }
    void cargarSesiones();
    void leerDirectores().then(setDirectores);
  }, [cargarSesiones, rol]);

  // El grupo se carga aparte: depende del grado elegido, no de las sesiones.
  useEffect(() => {
    if (!cruce) return;
    void (async () => {
      try {
        const { estudiantes: al, matriculas: mat } = await leerGrupo(cruce.grado);
        setEstudiantes(al);
        setMatriculas(mat);
      } catch (e) {
        setError(mensajeDeError(e));
      }
    })();
  }, [cruce?.grado]);

  const sesionesDelCruce = useMemo(
    () =>
      cruce
        ? sesiones.filter((s) => s.grado === cruce.grado && s.subjectId === cruce.subjectId)
        : [],
    [sesiones, cruce],
  );

  async function marcar(sessionIdDoc: string, studentId: string, estado: MarkCode) {
    setError(null);
    try {
      await marcarEstudiante(sessionIdDoc, studentId, estado);
      await cargarSesiones();
    } catch (e) {
      setError(mensajeDeError(e));
    }
  }

  /** Llenado por defecto de una columna. Solo toca las casillas vacías. */
  async function llenar(sessionIdDoc: string, estado: MarkCode) {
    setError(null);
    try {
      await llenarColumna(
        sessionIdDoc,
        estudiantes.map((e) => e.studentId),
        estado,
      );
      await cargarSesiones();
    } catch (e) {
      setError(mensajeDeError(e));
    }
  }

  async function cerrar(sessionIdDoc: string, sinRegistrar: number) {
    const ok = window.confirm(
      sinRegistrar > 0
        ? `Quedan ${sinRegistrar} casillas SIN REGISTRAR. Al cerrar NO se convierten en ` +
          'ausencias: siguen contando como sin registrar.\n\n¿Cerrar de todos modos?'
        : '¿Cerrar la sesión de clase?',
    );
    if (!ok) return;
    setError(null);
    try {
      await cerrarSesionRemota(sessionIdDoc);
      await cargarSesiones();
    } catch (e) {
      setError(mensajeDeError(e));
    }
  }

  async function nuevaSesion() {
    if (!cruce) return;
    const respuesta = window.prompt('¿En qué bloque es la clase de hoy? (1 a 6)', '1');
    if (!respuesta) return;
    const bloque = Number(respuesta);
    if (!Number.isInteger(bloque) || bloque < 1 || bloque > 6) {
      setError('El bloque debe ser un número entre 1 y 6.');
      return;
    }
    setError(null);
    try {
      await abrirSesion({
        sede,
        grado: cruce.grado,
        jornada: jornadaDeGrado(cruce.grado),
        fecha: toDateKey(new Date()),
        bloque,
        subjectId: cruce.subjectId,
        slotId: slotId ?? '',
      });
      await cargarSesiones();
    } catch (e) {
      setError(mensajeDeError(e));
    }
  }

  if (!firebaseConfigurado) {
    return (
      <p className="rounded-xl border border-warning-soft bg-warning-soft p-3 text-sm text-warning-soft-fg">
        Firebase no está configurado en esta instalación, así que el módulo de asistencia
        no puede cargar datos.
      </p>
    );
  }

  // El superusuario no registra asistencia (su clave es transferible) ni lee el detalle
  // de las sesiones: las reglas se lo impiden. Lo suyo es cargar los datos base.
  //
  // Pero SI puede ver fichas: `asistenciaStudents` se lee con `isActiveUser()`. Antes
  // esta pantalla era solo el importador, y el resultado era absurdo — quien carga dos
  // mil estudiantes no podia mirar ni uno para comprobar que quedaron bien. Tambien
  // dejaba sin forma de probar los permisos de fotografia con una cuenta distinta a la
  // del docente, que es lo que hizo falta al depurar.
  if (rol === 'superusuario') {
    if (fichaAbierta) {
      return (
        <Ficha
          studentId={fichaAbierta}
          rol={rol}
          slotId={slotId}
          directores={directores}
          onVolver={() => setFichaAbierta(null)}
        />
      );
    }
    return (
      <div className="space-y-4">
        <Suspense fallback={<p className="p-3 text-sm text-muted">Cargando importación…</p>}>
          <Importar />
        </Suspense>
        <BuscadorFichas sede={sede} onAbrir={setFichaAbierta} />
      </div>
    );
  }

  if (cargando) return <p className="p-3 text-sm text-muted">Cargando asistencia…</p>;

  if (fichaAbierta) {
    // Editar la ficha lo decide el servidor: director del grupo, coordinacion o
    // superusuario. Aqui solo se evita ofrecer botones que fallarian.
    return (
      <Ficha
        studentId={fichaAbierta}
        rol={rol}
        slotId={slotId}
        directores={directores}
        onVolver={() => setFichaAbierta(null)}
      />
    );
  }

  // El reporte de tercera hora es del coordinador: lee sesiones de todos los grados de
  // su sede, y las reglas solo se lo permiten a el.
  if (rol === 'coordinador' && vista === 'tercera_hora') {
    return (
      <div className="space-y-3">
        <Pestanas vista={vista} onCambiar={setVista} />
        <TerceraHora sede={sede} />
      </div>
    );
  }

  // Las llegadas tarde a la institucion son autoridad exclusiva del coordinador.
  if (rol === 'coordinador' && vista === 'llegadas') {
    return (
      <div className="space-y-3">
        <Pestanas vista={vista} onCambiar={setVista} />
        <LlegadasTarde sede={sede} />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {rol === 'coordinador' && <Pestanas vista={vista} onCambiar={setVista} />}
      {error && (
        <div className="rounded-xl border border-danger-soft bg-danger-soft p-3 text-sm text-danger-soft-fg">
          {error}
        </div>
      )}

      {cruces.length === 0 ? (
        <PrimeraSesion
          puedeRegistrar={puedeRegistrar}
          onAbrir={async (grado, subjectId, bloque) => {
            setError(null);
            try {
              await abrirSesion({
                sede,
                grado,
                jornada: jornadaDeGrado(grado),
                fecha: toDateKey(new Date()),
                bloque,
                subjectId,
                slotId: slotId ?? '',
              });
              setCruce({ grado, subjectId });
              await cargarSesiones();
            } catch (e) {
              setError(mensajeDeError(e));
            }
          }}
        />
      ) : (
        <>
          {cruces.length > 1 && (
            <div className="flex flex-wrap gap-1.5">
              {cruces.map((c) => {
                const activo = cruce?.grado === c.grado && cruce?.subjectId === c.subjectId;
                const colorPestana = resolverColor(mapaColores, c.grado, c.subjectId);
                return (
                  <button
                    key={`${c.grado}|${c.subjectId}`}
                    onClick={() => setCruce(c)}
                    style={estiloEtiqueta(colorPestana)}
                    className={[
                      'rounded-full border px-3 py-1 text-sm',
                      // El color de grupo va por `style` (arriba); aqui solo se decide si
                      // la pestana activa se distingue de las inactivas cuando NO hay
                      // color propio, con un borde mas marcado.
                      activo
                        ? colorPestana
                          ? 'border-2 font-semibold'
                          : 'border-accent bg-accent-soft font-semibold text-accent-soft-fg'
                        : colorPestana
                          ? 'border font-normal'
                          : 'border-line text-soft',
                    ].join(' ')}
                  >
                    {c.grado} · {c.subjectId}
                  </button>
                );
              })}
            </div>
          )}

          {cruce && (
            <Planilla
              grado={cruce.grado}
              asignatura={cruce.subjectId}
              estudiantes={estudiantes}
              sesiones={sesionesDelCruce}
              matriculas={matriculas}
              puedeRegistrar={puedeRegistrar}
              onMarcar={marcar}
              onCerrarSesion={cerrar}
              onAbrirFicha={setFichaAbierta}
              onLlenarColumna={llenar}
              onNuevaSesion={nuevaSesion}
              color={resolverColor(mapaColores, cruce.grado, cruce.subjectId)}
              onElegirColor={(colorId) =>
                setMapaColores((m) => guardarColor(m, cruce.grado, cruce.subjectId, colorId))
              }
            />
          )}
        </>
      )}
    </div>
  );
}

/**
 * Buscador de fichas para el superusuario.
 *
 * No duplica la planilla: no lee sesiones (las reglas se lo niegan), solo estudiantes,
 * que `isActiveUser()` si le permite. Sirve para comprobar que una importacion quedo
 * bien —el momento en que mas falta hace mirar una ficha— y para probar permisos de
 * fotografia con una cuenta que no sea la del docente.
 */
function BuscadorFichas({
  sede,
  onAbrir,
}: {
  sede: string;
  onAbrir: (studentId: string) => void;
}) {
  const [texto, setTexto] = useState('');
  const [resultados, setResultados] = useState<Student[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (texto.trim().length < 2) {
      setResultados([]);
      return;
    }
    // Con retardo: se teclea mas rapido de lo que conviene consultar.
    const t = setTimeout(() => {
      void buscarEstudiantes(sede, texto)
        .then((r) => {
          setResultados(r);
          setError(null);
        })
        .catch((e) => setError(mensajeDeError(e)));
    }, 250);
    return () => clearTimeout(t);
  }, [texto, sede]);

  return (
    <section className="rounded-xl border border-line bg-card p-3">
      <h3 className="text-sm font-semibold text-strong">Consultar una ficha</h3>
      <p className="text-xs text-muted">
        Para comprobar que la importación quedó bien. No registra asistencia.
      </p>
      <input
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        placeholder="Apellido o nombre…"
        className="mt-2 w-full rounded-lg border border-line bg-elevated px-2 py-2 text-base text-strong"
      />
      {error && <p className="mt-2 text-xs text-danger">{error}</p>}
      {texto.trim().length >= 2 && resultados.length === 0 && !error && (
        <p className="mt-2 text-sm text-muted">Ningún estudiante coincide.</p>
      )}
      <ul className="mt-2 space-y-1">
        {resultados.map((e) => (
          <li key={e.studentId}>
            <button
              onClick={() => onAbrir(e.studentId)}
              className="w-full rounded-lg border border-line p-2 text-left text-sm text-strong"
            >
              {nombreCompleto(e)}
              <span className="ml-2 text-xs text-muted">{e.gradoActual}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * Arranque en frio: sin ninguna sesion registrada, la planilla no tiene de donde sacar
 * los grados ni las asignaturas —los deduce de las sesiones existentes—, asi que sin
 * esta pantalla no habria forma de crear la primera. Callejon sin salida clasico del
 * primer dia.
 */
function PrimeraSesion({
  puedeRegistrar,
  onAbrir,
}: {
  puedeRegistrar: boolean;
  onAbrir: (grado: string, subjectId: string, bloque: number) => Promise<void>;
}) {
  const [grado, setGrado] = useState('');
  const [asignatura, setAsignatura] = useState('');
  const [bloque, setBloque] = useState(1);
  const [enviando, setEnviando] = useState(false);

  if (!puedeRegistrar) {
    return (
      <p className="rounded-xl border border-line bg-card p-3 text-sm text-muted">
        No hay sesiones de clase registradas todavía. Aparecerán aquí cuando los docentes
        empiecen a pasar lista.
      </p>
    );
  }

  const listo = grado.trim() !== '' && asignatura.trim() !== '';

  return (
    <div className="rounded-xl border border-line bg-card p-3">
      <h3 className="text-sm font-semibold text-strong">Abrir la primera sesión</h3>
      <p className="mb-2 text-xs text-muted">
        Todavía no hay ninguna sesión registrada. Cree la de hoy y la planilla aparecerá
        con los estudiantes del grupo. Mientras no exista la sesión, ese día no existe
        para la estadística.
      </p>

      <div className="flex flex-wrap items-end gap-2">
        <label className="text-xs text-muted">
          Grado
          <input
            value={grado}
            onChange={(e) => setGrado(e.target.value)}
            placeholder="11.2"
            className="mt-0.5 block w-24 rounded-lg border border-line bg-elevated px-2 py-1.5 text-sm text-strong"
          />
        </label>
        <label className="text-xs text-muted">
          Asignatura
          <input
            value={asignatura}
            onChange={(e) => setAsignatura(e.target.value.toUpperCase())}
            placeholder="MAT"
            className="mt-0.5 block w-28 rounded-lg border border-line bg-elevated px-2 py-1.5 text-sm text-strong"
          />
        </label>
        <label className="text-xs text-muted">
          Bloque
          <select
            value={bloque}
            onChange={(e) => setBloque(Number(e.target.value))}
            className="mt-0.5 block rounded-lg border border-line bg-elevated px-2 py-1.5 text-sm text-strong"
          >
            {[1, 2, 3, 4, 5, 6].map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
        </label>
        <button
          disabled={!listo || enviando}
          onClick={async () => {
            setEnviando(true);
            await onAbrir(grado.trim(), asignatura.trim(), bloque);
            setEnviando(false);
          }}
          className="rounded-lg bg-accent px-3 py-2 text-sm font-medium text-accent-fg disabled:opacity-50"
        >
          {enviando ? 'Abriendo…' : 'Abrir sesión de hoy'}
        </button>
      </div>

      <p className="mt-2 text-xs text-muted">
        El grado va tal como lo escribe el colegio: <b>11.2</b> en la mañana, <b>6º1</b> en
        la tarde. La <b>º</b> es lo que distingue la jornada, así que no la cambie.
      </p>
    </div>
  );
}

function Pestanas({
  vista,
  onCambiar,
}: {
  vista: 'planilla' | 'tercera_hora' | 'llegadas';
  onCambiar: (v: 'planilla' | 'tercera_hora' | 'llegadas') => void;
}) {
  const clase = (activa: boolean) =>
    [
      'rounded-full border px-3 py-1 text-sm',
      activa
        ? 'border-accent bg-accent-soft font-semibold text-accent-soft-fg'
        : 'border-line text-soft',
    ].join(' ');
  return (
    <div className="flex flex-wrap gap-1.5">
      <button className={clase(vista === 'planilla')} onClick={() => onCambiar('planilla')}>
        Planillas
      </button>
      <button
        className={clase(vista === 'tercera_hora')}
        onClick={() => onCambiar('tercera_hora')}
      >
        Reporte de tercera hora
      </button>
      <button className={clase(vista === 'llegadas')} onClick={() => onCambiar('llegadas')}>
        Llegadas tarde
      </button>
    </div>
  );
}

/**
 * Traduce los errores de Firestore a algo que un docente pueda entender. Un
 * `permission-denied` crudo no le dice a nadie qué hacer, y aquí casi siempre significa
 * una de dos cosas concretas.
 */
function mensajeDeError(e: unknown): string {
  const texto = e instanceof Error ? e.message : String(e);
  if (texto.includes('permission-denied') || texto.includes('insufficient permissions')) {
    return (
      'El servidor no permitió la operación. Suele ser porque la sesión de clase no es ' +
      'suya o pertenece a otra sede. Si cree que sí le corresponde, avise a coordinación.'
    );
  }
  if (texto.includes('Sesión no activa') || texto.includes('sesion activa')) {
    return 'Su sesión expiró. Vuelva a entrar antes de registrar.';
  }
  return texto;
}


