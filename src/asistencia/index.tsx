import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import Planilla from './Planilla';
// Carga diferida: la pantalla de importacion arrastra exceljs (~1 MB) y solo la
// usa el superusuario. Con import() dinamico sale del bundle principal y no la
// descargan los 34 docentes que nunca van a importar nada.
// OJO al recopiar el modulo: este cambio es de MJB y se pierde si se pega el
// index.tsx original tal cual. Ya paso dos veces.
const Importar = lazy(() => import('./Importar'));
import Ficha from './Ficha';
import TerceraHora from './TerceraHora';
import LlegadasTarde from './LlegadasTarde';
import {
  abrirSesion,
  cerrarSesion as cerrarSesionRemota,
  leerDirectores,
  leerGrupo,
  leerSesiones,
  marcarEstudiante,
  type AlcanceLectura,
} from './datos';
import { toDateKey } from './domain/ids';
import { jornadaDeGrado } from './domain/ids';
import type { MarkCode } from './domain/marks';
import type { Enrollment, Session, Student } from './domain/types';
import { firebaseConfigurado } from '../lib/firebase';
import { useAppStore } from '../data/store';

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
    () => (rol === 'coordinador' ? { tipo: 'coordinador' } : { tipo: 'docente', slotId: slotId ?? '' }),
    [rol, slotId],
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
  if (rol === 'superusuario') {
    return (
      <Suspense
        fallback={<p className="text-sm text-muted text-center py-12">Cargando el importador…</p>}
      >
        <Importar />
      </Suspense>
    );
  }

  if (cargando) return <p className="p-3 text-sm text-muted">Cargando asistencia…</p>;

  if (fichaAbierta) {
    // Editar la ficha lo decide el servidor: director del grupo, coordinacion o
    // superusuario. Aqui solo se evita ofrecer botones que fallarian.
    const esDirector = Boolean(cruce && directores[cruce.grado] === slotId);
    return (
      <Ficha
        studentId={fichaAbierta}
        puedeEditar={rol === 'coordinador' || esDirector}
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
        <p className="rounded-xl border border-line bg-card p-3 text-sm text-muted">
          No hay sesiones de clase registradas todavía. Cuando alguien abra la primera,
          aparecerá aquí. Recuerde que mientras no exista una sesión, ese día no existe
          para la estadística.
        </p>
      ) : (
        <>
          {cruces.length > 1 && (
            <div className="flex flex-wrap gap-1.5">
              {cruces.map((c) => {
                const activo = cruce?.grado === c.grado && cruce?.subjectId === c.subjectId;
                return (
                  <button
                    key={`${c.grado}|${c.subjectId}`}
                    onClick={() => setCruce(c)}
                    className={[
                      'rounded-full border px-3 py-1 text-sm',
                      activo
                        ? 'border-accent bg-accent-soft font-semibold text-accent-soft-fg'
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
              onNuevaSesion={nuevaSesion}
            />
          )}
        </>
      )}
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

