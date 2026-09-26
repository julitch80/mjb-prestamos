import { useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import Avatar from './Avatar';
import EscribirAlGrupo from './EscribirAlGrupo';
import { ModalNuevoEstudiante, type NuevoEstudianteInput } from './Planilla';
import { buscarEstudiantes, crearEstudianteManual, leerGrupo } from './datos';
import { nombresDePila } from './domain/nombres';
import { gradoEnJornada, type FiltroJornada } from './domain/filtro-jornada';
import type { Student } from './domain/types';
import { colorGrado } from '../data/maestros';

/**
 * La lista de un grupo SIN asignatura, para coordinacion y consulta (2026-09-25).
 *
 * Antes, para abrir la ficha de un estudiante o dar de alta a uno nuevo, la coordinadora
 * tenia que entrar por una planilla de alguna asignatura —y si el grupo todavia no tenia
 * ninguna, no habia por donde—. Julián: «para acceder a la ficha tengo que entrar por una
 * asignatura». Aqui el grupo es el grupo: sus estudiantes, su ficha, y el alta.
 *
 * Retirar o reintegrar NO esta aqui: se hace desde la ficha (zona de cuidado), que ya
 * pide confirmacion y deja el cambio registrado. Duplicarlo en la lista invitaria a
 * retirar a alguien de un toque equivocado.
 */
export default function ListaDelGrupo({
  grado,
  sede,
  puedeAgregar,
  puedeEscribir,
  onAbrirFicha,
  onVolver,
}: {
  grado: string;
  sede: string;
  /** Alta de estudiantes: coordinacion (el servidor vuelve a comprobarlo). */
  puedeAgregar: boolean;
  /** Correo a todo el grupo: coordinacion (el director lo tiene en su planilla). */
  puedeEscribir: boolean;
  onAbrirFicha: (studentId: string) => void;
  onVolver: () => void;
}) {
  const [estudiantes, setEstudiantes] = useState<Student[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [agregando, setAgregando] = useState(false);

  async function cargar() {
    try {
      setEstudiantes((await leerGrupo(grado)).estudiantes);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  useEffect(() => {
    setEstudiantes(null);
    void cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grado]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button onClick={onVolver} className="min-h-[36px] text-sm text-accent">
          ← Planillas
        </button>
        {/* Correo con las direcciones en copia oculta, el mismo del director de grupo.
            No aparece si nadie del grupo tiene correo institucional. */}
        {puedeEscribir && estudiantes && <EscribirAlGrupo estudiantes={estudiantes} etiqueta={grado} conTexto />}
      </div>

      <div
        style={{ borderLeftColor: colorGrado(grado) }}
        className="rounded-xl border border-line border-l-4 bg-card"
      >
        <div className="border-b border-line p-3">
          <p className="text-sm font-semibold text-strong">
            <b style={{ color: colorGrado(grado) }} className="mr-1.5 text-xl">
              {grado}
            </b>
            Lista del grupo{estudiantes ? ` (${estudiantes.length})` : ''}
          </p>
          <p className="mt-0.5 text-xs text-muted">
            Toque un estudiante para abrir su ficha. Para retirarlo o reintegrarlo, hágalo
            desde la ficha.
          </p>
        </div>

        {error && <p className="p-3 text-sm text-danger">{error}</p>}
        {!error && estudiantes === null && <p className="p-3 text-sm text-muted">Cargando…</p>}
        {estudiantes?.length === 0 && (
          <p className="p-3 text-sm text-muted">Este grupo no tiene estudiantes activos.</p>
        )}

        <ul>
          {estudiantes?.map((e) => (
            <li key={e.studentId} className="border-b border-line last:border-b-0">
              <button
                onClick={() => onAbrirFicha(e.studentId)}
                className="flex w-full items-center gap-2 p-2 text-left hover:bg-hover"
              >
                <Avatar estudiante={e} tamano={44} />
                <span className="min-w-0 flex-1 truncate text-xs leading-tight text-strong">
                  <span className="block truncate font-semibold">{e.apellidos}</span>
                  <span className="block truncate text-muted">
                    {nombresDePila(e.apellidos, e.nombres)}
                  </span>
                </span>
                <span className="shrink-0 pr-1 text-xs text-accent">Ficha →</span>
              </button>
            </li>
          ))}
        </ul>
      </div>

      {puedeAgregar && estudiantes !== null && (
        <button
          onClick={() => setAgregando(true)}
          className="w-full rounded-xl border border-dashed border-line-strong bg-card p-3 text-sm font-medium text-accent"
        >
          + Agregar estudiante nuevo a {grado}
        </button>
      )}

      {agregando && (
        <ModalNuevoEstudiante
          grado={grado}
          onGuardar={async (input: NuevoEstudianteInput) => {
            // El error se deja propagar: el modal lo muestra tal cual (p. ej. «ese
            // documento ya está en la ficha de…»).
            await crearEstudianteManual({ ...input, grado, sede });
            setAgregando(false);
            await cargar();
          }}
          onCerrar={() => setAgregando(false)}
        />
      )}
    </div>
  );
}

/**
 * Buscar a un estudiante por nombre en toda la sede y abrir su ficha, sin saber el grupo
 * ni pasar por una planilla. Con `incluirRetirados`, salen tambien los retirados
 * (marcados como tales), porque reintegrar a alguien empieza por encontrarlo, y un
 * retirado ya no aparece en la lista de su grupo.
 */
export function BuscarEstudiante({
  sede,
  incluirRetirados,
  filtro = 'ambas',
  onAbrirFicha,
}: {
  sede: string;
  incluirRetirados: boolean;
  /** Jornada elegida en Planillas: el buscador solo trae estudiantes de ella. */
  filtro?: FiltroJornada;
  onAbrirFicha: (studentId: string) => void;
}) {
  const [texto, setTexto] = useState('');
  const [resultados, setResultados] = useState<Student[]>([]);
  const [buscando, setBuscando] = useState(false);

  useEffect(() => {
    if (texto.trim().length < 2) {
      setResultados([]);
      return;
    }
    let vigente = true;
    setBuscando(true);
    const t = setTimeout(() => {
      void buscarEstudiantes(sede, texto, incluirRetirados, (g) => gradoEnJornada(g, filtro))
        .then((r) => vigente && setResultados(r))
        .catch(() => vigente && setResultados([]))
        .finally(() => vigente && setBuscando(false));
    }, 250);
    return () => {
      vigente = false;
      clearTimeout(t);
    };
  }, [texto, sede, incluirRetirados, filtro]);

  return (
    <div className="rounded-xl border border-line bg-card p-3">
      <label className="flex items-center gap-2">
        <Search size={16} className="text-muted" aria-hidden />
        <input
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Buscar estudiante por nombre o apellido"
          className="min-h-[36px] w-full bg-transparent text-sm text-strong outline-none placeholder:text-muted"
        />
      </label>
      {texto.trim().length >= 2 && (
        <ul className="mt-2 border-t border-line">
          {buscando && resultados.length === 0 && (
            <li className="p-2 text-xs text-muted">Buscando…</li>
          )}
          {!buscando && resultados.length === 0 && (
            <li className="p-2 text-xs text-muted">Nadie con ese nombre en la sede.</li>
          )}
          {resultados.map((e) => (
            <li key={e.studentId} className="border-b border-line last:border-b-0">
              <button
                onClick={() => onAbrirFicha(e.studentId)}
                className="flex w-full items-center gap-2 p-2 text-left hover:bg-hover"
              >
                <Avatar estudiante={e} tamano={36} />
                <span className="min-w-0 flex-1 truncate text-sm text-strong">
                  {e.apellidos} {e.nombres}
                </span>
                {!e.activo && (
                  <span className="shrink-0 rounded-full bg-elevated px-2 py-0.5 text-xs text-muted">
                    retirado
                  </span>
                )}
                <b style={{ color: colorGrado(e.gradoActual) }} className="shrink-0 text-sm">
                  {e.gradoActual}
                </b>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
