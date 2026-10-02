/**
 * «Clases efectivas» de un docente en una fecha: lo que de verdad va a dictar ese día,
 * con todo lo que cambia el horario ya aplicado.
 *
 * Combina (todo SINCRONO; los dos últimos los trae el store ya sincronizado):
 *  1. Horario base (`horarioBase`, indexado por slotId: un docente de reemplazo hereda el
 *     slot, así que el reemplazo es transparente aquí).
 *  2. Días no lectivos: fines de semana, festivos (agenda + calendario de tareas) y
 *     jornadas pedagógicas («no tienen clase los estudiantes») → [].
 *  3. `HorarioModificado` guardado de esa fecha+jornada (el más reciente): bloques movidos,
 *     eliminados, cambio de docente (`docenteNuevo`) y ausencias del docente.
 *  4. `JornadaReducida` de esa fecha+jornada: horas reales de cada bloque y bloques que
 *     ya no se dictan.
 *  5. Horas oficiales de `BLOQUES_MANANA` / `BLOQUES_TARDE` cuando no hay jornada reducida.
 */
import { horarioBase as HORARIO_BASE } from '../horarioBase';
import { BLOQUES_MANANA, BLOQUES_TARDE } from '../maestros';
import { asignacionDeDocente } from '../asignacionAcademica';
import { agendaDeFecha } from '../agendaSemanal';
import { esFestivo as esFestivoTareas } from '../tareas/calendario';
import {
  aplicarModificacionesAlDia,
  diaDeSemana,
  type EntradaHorarioBase,
  type HorarioModificado,
  type JornadaReducida,
} from '../horarioModificado';

export type JornadaClase = 'manana' | 'tarde';

export interface ClaseEfectiva {
  bloque: number;
  grado: string;
  aula: string;
  jornada: JornadaClase;
  /** HH:MM reales de ese día (jornada reducida incluida). */
  inicio: string;
  fin: string;
  /** Solo si el docente dicta UNA asignatura en ese grado (si no, se omite). */
  asignatura?: string;
  /** La clase fue movida de otro bloque por una modificación del día. */
  movida?: boolean;
}

export interface DatosHorario {
  horarioBase: EntradaHorarioBase[];
  horariosModificados: HorarioModificado[];
  jornadasReducidas: JornadaReducida[];
  /** Por defecto: festivo en agenda/calendario o jornada pedagógica en la agenda. */
  esDiaSinClases?: (fecha: string) => boolean;
}

/** YYYY-MM-DD en hora local de un Date. */
export function fechaLocalISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function esDiaSinClasesPorDefecto(fecha: string): boolean {
  if (esFestivoTareas(fecha)) return true;
  const d = agendaDeFecha(fecha);
  if (!d) return false;
  if (d.festivo) return true;
  return (d.notas ?? []).some((n) => /no tienen clase los estudiantes/i.test(n));
}

function masReciente<T extends { timestamp: string }>(xs: T[]): T | undefined {
  return xs.reduce<T | undefined>((m, x) => (!m || x.timestamp > m.timestamp ? x : m), undefined);
}

/** Clases efectivas del docente (slotId) en `fecha` (YYYY-MM-DD), ordenadas por jornada y bloque. */
export function clasesEfectivas(
  slotId: string | null | undefined,
  fecha: string,
  datos: Partial<DatosHorario> = {},
): ClaseEfectiva[] {
  if (!slotId) return [];
  const base = datos.horarioBase ?? (HORARIO_BASE as EntradaHorarioBase[]);
  const hms = datos.horariosModificados ?? [];
  const jrs = datos.jornadasReducidas ?? [];
  const sinClases = datos.esDiaSinClases ?? esDiaSinClasesPorDefecto;

  const dia = diaDeSemana(fecha);
  if (dia === 'sabado' || dia === 'domingo') return [];
  if (sinClases(fecha)) return [];

  const asigs = asignacionDeDocente(slotId).filter((r) => r.asignatura.id !== 'ci');
  const asignaturaDe = (grado: string): string | undefined => {
    const l = asigs.filter((r) => r.grupos.some((g) => g.grupo === grado));
    return l.length === 1 ? l[0].asignatura.nombre : undefined;
  };

  const out: ClaseEfectiva[] = [];
  for (const jornada of ['manana', 'tarde'] as const) {
    const hm = masReciente(hms.filter((h) => h.fecha === fecha && h.jornada === jornada && h.estado === 'guardado'));
    const jr = masReciente(jrs.filter((j) => j.fecha === fecha && j.jornada === jornada));
    const horas: { id: number; inicio: string; fin: string }[] =
      jr?.bloques?.length ? jr.bloques : jornada === 'manana' ? BLOQUES_MANANA : BLOQUES_TARDE;

    // Entradas con las modificaciones aplicadas; solo las de este docente.
    let propias = aplicarModificacionesAlDia(fecha, jornada, base, hms)
      .filter((e) => e.docente === slotId)
      .map((e) => ({
        bloque: e.bloque,
        // aplicarModificacionesAlDia recorta «11.1/CI» a «11.1»: se recupera el original (CI).
        grado:
          (!e.esModificada &&
            base.find(
              (b) =>
                b.jornada === jornada && b.dia === dia && b.docente === slotId && b.bloque === e.bloque &&
                b.grado.includes('/') && b.grado.split('/')[0] === e.grado,
            )?.grado) ||
          e.grado,
        aula: e.aula,
        movida: e.esModificada,
      }));

    if (hm) {
      // Cambio de docente: la clase pasa de docenteOriginal a docenteNuevo.
      for (const m of hm.modificaciones) {
        if (!m.docenteNuevo || m.docenteNuevo === m.docenteOriginal) continue;
        if (m.docenteOriginal === slotId) {
          propias = propias.filter((p) => !(p.grado === m.grupo && p.bloque === (m.bloqueNuevo ?? m.bloqueOriginal)));
        }
        if (m.docenteNuevo === slotId && m.bloqueNuevo !== null) {
          propias.push({ bloque: m.bloqueNuevo, grado: m.grupo, aula: m.aula, movida: m.bloqueNuevo !== m.bloqueOriginal });
        }
      }
      // Ausencia declarada: en sus bloques ausentes no dicta clase.
      const aus = hm.ausencias.find((a) => a.docenteId === slotId);
      if (aus) propias = propias.filter((p) => !aus.bloques.includes(p.bloque));
    }

    const vistos = new Set<string>();
    for (const p of propias) {
      const franja = horas.find((h) => h.id === p.bloque);
      if (!franja) continue; // bloque que la jornada reducida ya no dicta
      const clave = `${p.bloque}|${p.grado}`;
      if (vistos.has(clave)) continue;
      vistos.add(clave);
      const asignatura = asignaturaDe(p.grado);
      out.push({
        bloque: p.bloque,
        grado: p.grado,
        aula: p.aula,
        jornada,
        inicio: franja.inicio,
        fin: franja.fin,
        ...(asignatura ? { asignatura } : {}),
        ...(p.movida ? { movida: true } : {}),
      });
    }
  }
  return out.sort((a, b) =>
    a.jornada === b.jornada ? a.bloque - b.bloque : a.jornada === 'manana' ? -1 : 1,
  );
}

/** Primera clase que aún no terminó a `minsAhora` (minutos desde medianoche). */
export function proximaClaseEfectiva(
  clases: ClaseEfectiva[],
  minsAhora: number,
): (ClaseEfectiva & { enCurso: boolean }) | null {
  const aMin = (s: string) => {
    const [h, m] = s.split(':').map(Number);
    return h * 60 + m;
  };
  for (const c of clases) {
    if (minsAhora < aMin(c.fin)) return { ...c, enCurso: minsAhora >= aMin(c.inicio) };
  }
  return null;
}
