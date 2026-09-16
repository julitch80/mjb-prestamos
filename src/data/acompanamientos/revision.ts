/**
 * Revisa una distribución contra las reglas de reparto del PRD (§ «Reglas de
 * reparto»). Separa BLOQUEOS (impiden publicar) de AVISOS (se señalan en
 * ámbar, pero dejan publicar) — la misma separación que usa el editor manual
 * y el generador de alternativas (`generador.ts`).
 *
 * `mensaje` está pensado para mostrarse tal cual al coordinador: en español,
 * con el nombre corto del profesor y el nombre de la zona.
 */

import { USUARIOS } from '../maestros';
import type { Asignacion, Distribucion, Dia } from './tipos';
import { puedeCubrir, docentesDeLaJornada, pesoDeCarga } from './disponibilidad';
import { clasesEnDia, DIA_CARGADO } from './clases';

export type TipoProblema =
  | 'dos_zonas_mismo_dia'
  | 'fuera_de_jornada'
  | 'profesor_desconocido'
  | 'casilla_incompleta'
  | 'cupo_excedido'
  | 'zona_inexistente'
  | 'repetido_en_casilla'
  | 'dia_cargado'
  | 'carga_desigual'
  | 'mixto_excedido'
  | 'meta_distinta';

export interface Problema {
  tipo: TipoProblema;
  mensaje: string;
  zonaId?: string;
  dia?: Dia;
  docenteId?: string;
}

function nombreCorto(docenteId: string): string {
  return USUARIOS.find((u) => u.id === docenteId)?.nombreCorto ?? docenteId;
}

function nombreZona(dist: Distribucion, zonaId: string): string {
  return dist.zonas.find((z) => z.id === zonaId)?.nombre ?? zonaId;
}

/** Todos los docentes de la jornada, con su carga (incluidos los de cero). */
export function cargaPorDocente(dist: Distribucion): Map<string, { total: number; asignaciones: Asignacion[] }> {
  const mapa = new Map<string, { total: number; asignaciones: Asignacion[] }>();
  for (const u of docentesDeLaJornada(dist.jornada)) {
    mapa.set(u.id, { total: 0, asignaciones: [] });
  }
  for (const a of dist.asignaciones) {
    if (!mapa.has(a.docenteId)) {
      // Un profesor que no es de la jornada (fuera_de_jornada o desconocido):
      // igual se cuenta aquí para que la pantalla «Carga por profesor» lo
      // muestre; los bloqueos ya lo señalan aparte.
      mapa.set(a.docenteId, { total: 0, asignaciones: [] });
    }
    const entrada = mapa.get(a.docenteId)!;
    entrada.total += 1;
    entrada.asignaciones.push(a);
  }
  return mapa;
}

/** «miercoles» se escribe con tilde en los avisos que lee un coordinador. */
const DIA_TEXTO: Record<string, string> = {
  lunes: 'lunes', martes: 'martes', miercoles: 'miércoles', jueves: 'jueves', viernes: 'viernes',
};
function diaTexto(dia: string): string {
  return DIA_TEXTO[dia] ?? dia;
}

export function revisar(dist: Distribucion): { bloqueos: Problema[]; avisos: Problema[] } {
  const bloqueos: Problema[] = [];
  const avisos: Problema[] = [];
  const zonaIds = new Set(dist.zonas.map((z) => z.id));

  // ── Por asignación: profesor_desconocido, fuera_de_jornada, zona_inexistente ──
  for (const a of dist.asignaciones) {
    const usuario = USUARIOS.find((u) => u.id === a.docenteId);
    if (!usuario) {
      bloqueos.push({
        tipo: 'profesor_desconocido',
        mensaje: `El profesor "${a.docenteId}" asignado a ${nombreZona(dist, a.zonaId)} el ${diaTexto(a.dia)} no existe en el plantel.`,
        zonaId: a.zonaId,
        dia: a.dia,
        docenteId: a.docenteId,
      });
      continue;
    }
    if (!zonaIds.has(a.zonaId)) {
      bloqueos.push({
        tipo: 'zona_inexistente',
        mensaje: `${nombreCorto(a.docenteId)} está asignado a una zona que ya no existe (${diaTexto(a.dia)}).`,
        zonaId: a.zonaId,
        dia: a.dia,
        docenteId: a.docenteId,
      });
      continue;
    }
    if (!puedeCubrir(a.docenteId, dist.jornada, a.dia)) {
      bloqueos.push({
        tipo: 'fuera_de_jornada',
        mensaje: `${nombreCorto(a.docenteId)} no puede cubrir ${nombreZona(dist, a.zonaId)} el ${diaTexto(a.dia)}: no es de esta jornada ese día.`,
        zonaId: a.zonaId,
        dia: a.dia,
        docenteId: a.docenteId,
      });
    }
  }

  // ── Por profesor y día: dos_zonas_mismo_dia ──
  const porDocenteDia = new Map<string, Set<string>>(); // docenteId -> set de zonaId por dia (clave dia)
  const zonasPorDocenteDia = new Map<string, Map<Dia, Set<string>>>();
  for (const a of dist.asignaciones) {
    if (!zonasPorDocenteDia.has(a.docenteId)) zonasPorDocenteDia.set(a.docenteId, new Map());
    const porDia = zonasPorDocenteDia.get(a.docenteId)!;
    if (!porDia.has(a.dia)) porDia.set(a.dia, new Set());
    porDia.get(a.dia)!.add(a.zonaId);
  }
  for (const [docenteId, porDia] of zonasPorDocenteDia) {
    for (const [dia, zonas] of porDia) {
      if (zonas.size > 1) {
        bloqueos.push({
          tipo: 'dos_zonas_mismo_dia',
          mensaje: `${nombreCorto(docenteId)} queda en más de una zona el ${diaTexto(dia)}.`,
          dia,
          docenteId,
        });
      }
    }
  }
  void porDocenteDia; // (no usado, se deja el nombre por claridad de la sección)

  // ── Por zona y día: casilla_incompleta, cupo_excedido, repetido_en_casilla ──
  for (const zona of dist.zonas) {
    for (const dia of ['lunes', 'martes', 'miercoles', 'jueves', 'viernes'] as Dia[]) {
      const asignados = dist.asignaciones.filter((a) => a.zonaId === zona.id && a.dia === dia);
      const conteoPorDocente = new Map<string, number>();
      for (const a of asignados) {
        conteoPorDocente.set(a.docenteId, (conteoPorDocente.get(a.docenteId) ?? 0) + 1);
      }
      for (const [docenteId, n] of conteoPorDocente) {
        if (n > 1) {
          bloqueos.push({
            tipo: 'repetido_en_casilla',
            mensaje: `${nombreCorto(docenteId)} está repetido en ${zona.nombre} el ${diaTexto(dia)}.`,
            zonaId: zona.id,
            dia,
            docenteId,
          });
        }
      }
      if (asignados.length > zona.cupo) {
        bloqueos.push({
          tipo: 'cupo_excedido',
          mensaje: `${zona.nombre} el ${diaTexto(dia)} tiene ${asignados.length} profesores para un cupo de ${zona.cupo}.`,
          zonaId: zona.id,
          dia,
        });
      } else if (asignados.length < zona.cupo) {
        bloqueos.push({
          tipo: 'casilla_incompleta',
          mensaje: `${zona.nombre} el ${diaTexto(dia)} tiene ${asignados.length} de ${zona.cupo} profesores.`,
          zonaId: zona.id,
          dia,
        });
      }
    }
  }

  // ── Avisos ──

  // dia_cargado: por cada asignación en un día con clasesEnDia >= DIA_CARGADO.
  const diasCargadosVistos = new Set<string>();
  for (const a of dist.asignaciones) {
    const clases = clasesEnDia(a.docenteId, dist.jornada, a.dia);
    if (clases >= DIA_CARGADO) {
      const clave = `${a.docenteId}|${diaTexto(a.dia)}`;
      if (!diasCargadosVistos.has(clave)) {
        diasCargadosVistos.add(clave);
        avisos.push({
          tipo: 'dia_cargado',
          mensaje: `${nombreCorto(a.docenteId)} tiene ${clases} clases el ${diaTexto(a.dia)} y además acompañamiento en ${nombreZona(dist, a.zonaId)}.`,
          zonaId: a.zonaId,
          dia: a.dia,
          docenteId: a.docenteId,
        });
      }
    }
  }

  // carga_desigual / mixto_excedido / meta_distinta: carga normalizada =
  // acompañamientos / pesoDeCarga. Cuando la distribución trae `metas`
  // (coordinador definió números por profesor), estas reemplazan la regla de
  // equidad automática: solo se avisa 'meta_distinta' por quien no cuadre con
  // su meta, y NO se emiten 'carga_desigual' ni 'mixto_excedido' (PRD/tarea A.5).
  const docentesJornada = docentesDeLaJornada(dist.jornada);
  const conteoAsignaciones = new Map<string, number>();
  for (const u of docentesJornada) conteoAsignaciones.set(u.id, 0);
  for (const a of dist.asignaciones) {
    if (conteoAsignaciones.has(a.docenteId)) {
      conteoAsignaciones.set(a.docenteId, (conteoAsignaciones.get(a.docenteId) ?? 0) + 1);
    }
  }

  if (dist.metas) {
    for (const u of docentesJornada) {
      const meta = dist.metas[u.id] ?? 0;
      const total = conteoAsignaciones.get(u.id) ?? 0;
      if (total !== meta) {
        avisos.push({
          tipo: 'meta_distinta',
          mensaje: `${nombreCorto(u.id)}: ${total} de ${meta} acompañamiento${meta === 1 ? '' : 's'}.`,
          docenteId: u.id,
        });
      }
    }
  } else {
    if (docentesJornada.length > 0) {
      let maxDocente = docentesJornada[0].id;
      let minDocente = docentesJornada[0].id;
      let maxCarga = -Infinity;
      let minCarga = Infinity;
      for (const u of docentesJornada) {
        const carga = (conteoAsignaciones.get(u.id) ?? 0) / pesoDeCarga(u.id, dist.jornada);
        if (carga > maxCarga) {
          maxCarga = carga;
          maxDocente = u.id;
        }
        if (carga < minCarga) {
          minCarga = carga;
          minDocente = u.id;
        }
      }
      if (maxCarga - minCarga > 1) {
        avisos.push({
          tipo: 'carga_desigual',
          mensaje: `La carga no queda equitativa: ${nombreCorto(maxDocente)} tiene más acompañamientos que ${nombreCorto(minDocente)}. Conviene repartir mejor.`,
          docenteId: maxDocente,
        });
      }
    }

    // mixto_excedido: meta = pesoDeCarga * (total de casillas / suma de pesos de todos los docentes de la jornada).
    const totalCasillas = dist.zonas.reduce((suma, z) => suma + z.cupo * 5, 0);
    const sumaPesos = docentesJornada.reduce((suma, u) => suma + pesoDeCarga(u.id, dist.jornada), 0);
    if (sumaPesos > 0) {
      for (const u of docentesJornada) {
        const peso = pesoDeCarga(u.id, dist.jornada);
        if (peso >= 1) continue; // no es mixto
        const meta = peso * (totalCasillas / sumaPesos);
        const total = conteoAsignaciones.get(u.id) ?? 0;
        if (total > Math.ceil(meta)) {
          avisos.push({
            tipo: 'mixto_excedido',
            mensaje: `${nombreCorto(u.id)} es mixto y tiene ${total} acompañamientos; su meta es ${Math.ceil(meta)}.`,
            docenteId: u.id,
          });
        }
      }
    }
  }

  return { bloqueos, avisos };
}
