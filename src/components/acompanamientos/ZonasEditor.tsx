// Pantalla «Zonas» (tarea 4.3): agregar, cambiar cupo y quitar zonas del
// borrador. Todo modifica `distribucion` vía `onCambiar` — nunca toca la
// vigente ni Firestore (recibe y devuelve por props, como pide TAREAS.md).

import { useState } from 'react';
import { cn } from '@/lib/utils';
import type { Distribucion } from '../../data/acompanamientos/tipos';
import { DIAS } from '../../data/acompanamientos/tipos';
import { idDeZona } from '../../data/acompanamientos/inicial';

interface Props {
  distribucion: Distribucion;
  onCambiar: (nueva: Distribucion) => void;
}

/** Normaliza para comparar nombres sin distinguir mayúsculas ni tildes. */
function normalizar(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

/** Id único, desambiguado con un sufijo numérico si ya existe. */
function idUnico(nombre: string, existentes: Set<string>): string {
  const base = idDeZona(nombre);
  if (!existentes.has(base)) return base;
  let n = 2;
  while (existentes.has(`${base}-${n}`)) n += 1;
  return `${base}-${n}`;
}

export default function ZonasEditor({ distribucion, onCambiar }: Props) {
  const [nombreNuevo, setNombreNuevo] = useState('');
  const [errorNombre, setErrorNombre] = useState<string | null>(null);
  const [confirmarQuitar, setConfirmarQuitar] = useState<string | null>(null);
  const [confirmarBajarCupo, setConfirmarBajarCupo] = useState<{ zonaId: string; nuevoCupo: number } | null>(null);

  function asignacionesDeZona(zonaId: string) {
    return distribucion.asignaciones.filter((a) => a.zonaId === zonaId);
  }

  function agregarZona() {
    const nombre = nombreNuevo.trim();
    if (!nombre) {
      setErrorNombre('El nombre es obligatorio.');
      return;
    }
    const yaExiste = distribucion.zonas.some((z) => normalizar(z.nombre) === normalizar(nombre));
    if (yaExiste) {
      setErrorNombre('Ya existe una zona con ese nombre.');
      return;
    }
    const id = idUnico(nombre, new Set(distribucion.zonas.map((z) => z.id)));
    onCambiar({
      ...distribucion,
      zonas: [...distribucion.zonas, { id, nombre, cupo: 1 }],
    });
    setNombreNuevo('');
    setErrorNombre(null);
  }

  function quitarZona(zonaId: string) {
    onCambiar({
      ...distribucion,
      zonas: distribucion.zonas.filter((z) => z.id !== zonaId),
      asignaciones: distribucion.asignaciones.filter((a) => a.zonaId !== zonaId),
    });
    setConfirmarQuitar(null);
  }

  function cambiarCupo(zonaId: string, nuevoCupo: number) {
    const zona = distribucion.zonas.find((z) => z.id === zonaId);
    if (!zona) return;
    const clamped = Math.max(1, Math.min(6, nuevoCupo));
    if (clamped >= zona.cupo) {
      onCambiar({
        ...distribucion,
        zonas: distribucion.zonas.map((z) => (z.id === zonaId ? { ...z, cupo: clamped } : z)),
      });
      return;
    }
    // Bajar el cupo puede sobrar asignaciones algún día: ¿alcanza a quitar
    // solo las que no tienen candado?
    const porDia = new Map<string, number>();
    for (const dia of DIAS) {
      porDia.set(dia, distribucion.asignaciones.filter((a) => a.zonaId === zonaId && a.dia === dia).length);
    }
    const algunDiaExcede = [...porDia.values()].some((n) => n > clamped);
    if (!algunDiaExcede) {
      onCambiar({
        ...distribucion,
        zonas: distribucion.zonas.map((z) => (z.id === zonaId ? { ...z, cupo: clamped } : z)),
      });
      return;
    }
    setConfirmarBajarCupo({ zonaId, nuevoCupo: clamped });
  }

  function confirmarBajada() {
    if (!confirmarBajarCupo) return;
    const { zonaId, nuevoCupo } = confirmarBajarCupo;
    // Por cada día que exceda el nuevo cupo, quita las sobrantes SIN candado
    // (las últimas primero). Si todas tienen candado, ese día se queda como está.
    let asignaciones = [...distribucion.asignaciones];
    for (const dia of DIAS) {
      const deEseDia = asignaciones.filter((a) => a.zonaId === zonaId && a.dia === dia);
      if (deEseDia.length <= nuevoCupo) continue;
      const sinCandado = deEseDia.filter((a) => !a.candado);
      const sobran = deEseDia.length - nuevoCupo;
      const aQuitar = sinCandado.slice(0, Math.min(sobran, sinCandado.length));
      asignaciones = asignaciones.filter((a) => !aQuitar.includes(a));
    }
    onCambiar({
      ...distribucion,
      zonas: distribucion.zonas.map((z) => (z.id === zonaId ? { ...z, cupo: nuevoCupo } : z)),
      asignaciones,
    });
    setConfirmarBajarCupo(null);
  }

  // ¿Bajar el cupo es posible del todo, o algún día tiene TODAS con candado?
  function bajadaImposibleDelTodo(zonaId: string, nuevoCupo: number): boolean {
    for (const dia of DIAS) {
      const deEseDia = distribucion.asignaciones.filter((a) => a.zonaId === zonaId && a.dia === dia);
      if (deEseDia.length <= nuevoCupo) continue;
      const sinCandado = deEseDia.filter((a) => !a.candado);
      if (sinCandado.length === 0) return true; // ese día no se puede bajar
    }
    return false;
  }

  return (
    <div className="space-y-3">
      {/* Agregar zona */}
      <div className="rounded-xl border border-line bg-elevated/40 p-3 space-y-2">
        <div className="flex gap-2">
          <input
            value={nombreNuevo}
            onChange={(e) => { setNombreNuevo(e.target.value); setErrorNombre(null); }}
            placeholder="Nombre de la nueva zona"
            className="flex-1 rounded-lg border border-line bg-card px-3 py-2 text-sm text-strong placeholder:text-muted"
          />
          <button
            onClick={agregarZona}
            className="rounded-lg bg-accent text-accent-fg px-3 py-2 text-sm font-semibold hover:opacity-90 transition"
          >
            + Agregar zona
          </button>
        </div>
        {errorNombre && <p className="text-danger-soft-fg text-xs">{errorNombre}</p>}
      </div>

      {/* Lista de zonas */}
      <div className="space-y-2">
        {distribucion.zonas.map((zona) => {
          const asignadas = asignacionesDeZona(zona.id);
          return (
            <div key={zona.id} className="rounded-xl border border-line bg-card px-4 py-3">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <span className="text-strong text-sm font-semibold">{zona.nombre}</span>
                <div className="flex items-center gap-3">
                  {/* Stepper de cupo */}
                  <div className="flex items-center gap-1.5 bg-elevated border border-line rounded-lg px-1.5 py-1">
                    <button
                      onClick={() => cambiarCupo(zona.id, zona.cupo - 1)}
                      disabled={zona.cupo <= 1}
                      className="w-6 h-6 rounded-md text-soft hover:bg-hover disabled:opacity-30 transition"
                    >
                      −
                    </button>
                    <span className="text-strong text-sm font-semibold w-5 text-center">{zona.cupo}</span>
                    <button
                      onClick={() => cambiarCupo(zona.id, zona.cupo + 1)}
                      disabled={zona.cupo >= 6}
                      className="w-6 h-6 rounded-md text-soft hover:bg-hover disabled:opacity-30 transition"
                    >
                      +
                    </button>
                  </div>
                  <button
                    onClick={() => setConfirmarQuitar(zona.id)}
                    className="text-danger-soft-fg text-xs font-semibold hover:opacity-80 transition"
                  >
                    Quitar
                  </button>
                </div>
              </div>

              {/* Confirmación de quitar */}
              {confirmarQuitar === zona.id && (
                <div className="mt-3 rounded-lg bg-danger-soft border border-line p-3 space-y-2">
                  <p className="text-danger-soft-fg text-xs">
                    Se {asignadas.length === 1 ? 'libera 1 asignación' : `liberan ${asignadas.length} asignaciones`}
                    {asignadas.filter((a) => a.candado).length > 0
                      ? ` (incluye ${asignadas.filter((a) => a.candado).length} con candado)`
                      : ''}
                    . ¿Quitar «{zona.nombre}»?
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => quitarZona(zona.id)}
                      className="rounded-lg bg-danger-soft-fg/90 text-white px-3 py-1.5 text-xs font-semibold hover:opacity-90 transition"
                    >
                      Confirmar
                    </button>
                    <button
                      onClick={() => setConfirmarQuitar(null)}
                      className="rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-soft hover:bg-hover transition"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              )}

              {/* Confirmación de bajar cupo */}
              {confirmarBajarCupo?.zonaId === zona.id && (
                <div className={cn(
                  'mt-3 rounded-lg border border-line p-3 space-y-2',
                  bajadaImposibleDelTodo(zona.id, confirmarBajarCupo.nuevoCupo) ? 'bg-danger-soft' : 'bg-warning-soft',
                )}>
                  {bajadaImposibleDelTodo(zona.id, confirmarBajarCupo.nuevoCupo) ? (
                    <>
                      <p className="text-danger-soft-fg text-xs">
                        No se puede bajar a {confirmarBajarCupo.nuevoCupo}: algún día todas las asignaciones de «{zona.nombre}» tienen candado.
                      </p>
                      <button
                        onClick={() => setConfirmarBajarCupo(null)}
                        className="rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-soft hover:bg-hover transition"
                      >
                        Entendido
                      </button>
                    </>
                  ) : (
                    <>
                      <p className="text-warning-soft-fg text-xs">
                        Bajar el cupo de «{zona.nombre}» a {confirmarBajarCupo.nuevoCupo} libera las asignaciones sobrantes sin candado.
                      </p>
                      <div className="flex gap-2">
                        <button
                          onClick={confirmarBajada}
                          className="rounded-lg bg-warning-soft-fg/90 text-white px-3 py-1.5 text-xs font-semibold hover:opacity-90 transition"
                        >
                          Confirmar
                        </button>
                        <button
                          onClick={() => setConfirmarBajarCupo(null)}
                          className="rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-soft hover:bg-hover transition"
                        >
                          Cancelar
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
