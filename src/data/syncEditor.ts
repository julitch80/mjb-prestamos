// Sincronización de las modificaciones de horario y jornadas reducidas con el
// backend (hoja 'EditorSync'). El servidor es la fuente de verdad compartida;
// el localStorage del store sigue funcionando como caché local para que la UI
// del coordinador no dependa de la red.
import { guardarSyncEditor, borrarSyncEditor, getSyncEditor } from './api';
import type { HorarioModificado, JornadaReducida } from './horarioModificado';

/** Sube un HorarioModificado al backend. Solo se envían los que ya están
 * 'guardado' — los borradores son trabajo en curso del coordinador y no
 * deben propagarse a los docentes. Devuelve si el envío tuvo éxito: antes
 * era fire-and-forget y un fallo quedaba invisible para el coordinador
 * (ver nota en api.ts junto a guardarSyncEditor). */
export async function pushModificacion(hm: HorarioModificado): Promise<boolean> {
  if (hm.estado !== 'guardado') return true;
  try {
    const res = await guardarSyncEditor({
      id: hm.id,
      tipo: 'modificacion',
      fecha: hm.fecha,
      jornada: hm.jornada,
      estado: hm.estado,
      json: JSON.stringify(hm),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** Sube una JornadaReducida al backend. Fire-and-forget. */
export function pushJornada(jr: JornadaReducida): void {
  guardarSyncEditor({
    id: jr.id,
    tipo: 'jornada',
    fecha: jr.fecha,
    jornada: jr.jornada,
    estado: 'guardado',
    json: JSON.stringify(jr),
  }).catch(() => {});
}

/** Elimina un item (modificación o jornada) del backend. Fire-and-forget. */
export function pushBorrado(id: string): void {
  borrarSyncEditor(id).catch(() => {});
}

/** Descarga y parsea los items publicados en el backend. */
export async function cargarSyncEditor(): Promise<{
  modificaciones: HorarioModificado[];
  jornadas: JornadaReducida[];
}> {
  const items = await getSyncEditor();
  const modificaciones: HorarioModificado[] = [];
  const jornadas: JornadaReducida[] = [];
  for (const item of items) {
    try {
      if (item.tipo === 'modificacion') {
        modificaciones.push(JSON.parse(item.json) as HorarioModificado);
      } else if (item.tipo === 'jornada') {
        jornadas.push(JSON.parse(item.json) as JornadaReducida);
      }
    } catch {
      // item corrupto o parcial — se ignora
    }
  }
  return { modificaciones, jornadas };
}
