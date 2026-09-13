/**
 * Revisión aritmética de los datos, antes de intentar generar nada.
 * Espejo de `motor/revision.py`.
 *
 * La mayoría de los horarios «imposibles» no lo son por culpa del motor, sino
 * porque los datos piden más horas de las que caben. Eso se descubre sumando y
 * restando, sin gastar un segundo de solver, y se explica muchísimo mejor: «a
 * 7º2 le sobra una hora» es accionable; «no hay solución» no lo es.
 *
 * Que esté también aquí, y no solo en el motor, es lo que permite avisar
 * **antes** de descargar el archivo y esperar los minutos de la generación. El
 * caso real que lo justifica: la jornada de la tarde pide 30 horas por grupo
 * donde caben 29, y hasta ahora eso se descubría al final.
 *
 * Se comprueban cuatro cosas:
 *   1. cada grupo: horas que recibe frente a los espacios de su semana
 *   2. cada docente: horas que dicta frente a los bloques en que está disponible
 *   3. cada espacio compartido: veces que se pide frente a las que existe
 *   4. datos que faltan y que el motor no puede adivinar
 */

import type { EntradaGenerador } from './tipos';

export interface Aviso {
  ambito: 'grupo' | 'docente' | 'aula' | 'datos';
  /** A quién señala. Un aviso sin nombre no sirve para actuar. */
  quien: string;
  mensaje: string;
  /** Grave = impide generar el horario completo. Leve = conviene mirarlo. */
  grave: boolean;
}

export interface Revision {
  avisos: Aviso[];
  /** Si los datos caben. Es lo que decide si tiene sentido generar. */
  cuadra: boolean;
  graves: Aviso[];
  leves: Aviso[];
}

export function revisar(entrada: EntradaGenerador): Revision {
  const avisos: Aviso[] = [];
  const avisar = (
    ambito: Aviso['ambito'], quien: string, mensaje: string, grave = true,
  ) => avisos.push({ ambito, quien, mensaje, grave });

  const dias = entrada.config.dias.length;
  const bloques = entrada.config.bloques_por_jornada;
  const espacios = (jornada: string) => dias * (bloques[jornada as 'manana' | 'tarde'] ?? 0);
  // La franja del Centro de Interés no queda libre para clase regular: hay que
  // descontarla del cupo de todos los grupos de esa jornada.
  const conCI = new Set(Object.keys(entrada.config.centro_interes));

  const jornadaDeGrupo = new Map(entrada.grupos.map(g => [g.id, g.jornada]));
  const nombreDe = new Map(entrada.docentes.map(d => [d.id, d.nombre]));

  const horasGrupo = new Map<string, number>();
  const horasDocente = new Map<string, number>();
  const jornadasQueDicta = new Map<string, Set<string>>();
  for (const f of entrada.asignacion) {
    horasGrupo.set(f.grupo, (horasGrupo.get(f.grupo) ?? 0) + f.horas);
    horasDocente.set(f.docente, (horasDocente.get(f.docente) ?? 0) + f.horas);
    const j = jornadaDeGrupo.get(f.grupo);
    if (j) {
      const suyas = jornadasQueDicta.get(f.docente) ?? new Set<string>();
      suyas.add(j);
      jornadasQueDicta.set(f.docente, suyas);
    }
  }

  // ---- 1. Grupos -----------------------------------------------------------
  for (const g of entrada.grupos) {
    const cupo = espacios(g.jornada) - (conCI.has(g.jornada) ? 1 : 0);
    const horas = horasGrupo.get(g.id) ?? 0;
    if (horas > cupo) {
      avisar('grupo', g.id,
        `recibe ${horas} horas y solo caben ${cupo}: sobran ${horas - cupo}`);
    } else if (horas < cupo) {
      avisar('grupo', g.id,
        `recibe ${horas} horas y caben ${cupo}: quedan ${cupo - horas} huecos`, false);
    }
  }

  // ---- 2. Docentes ---------------------------------------------------------
  for (const d of entrada.docentes) {
    const suyas = jornadasQueDicta.get(d.id);
    if (!suyas || suyas.size === 0) continue;

    // Se cuentan las horas libres una por una, en vez de restar totales. Restar
    // "todas las horas, menos las bloqueadas, menos la del Centro de Interés"
    // descuenta el Centro de Interés dos veces cuando esa hora YA estaba
    // bloqueada para esta persona. Pasaba con Yoguis: baja a la tarde solo los
    // miércoles, el Centro de Interés de la tarde es el martes, y la resta le
    // quitaba una hora que nunca tuvo y lo daba por sobrecargado sin estarlo.
    const bloqueada = new Set<string>();
    for (const f of d.no_disponible ?? []) {
      for (const b of f.bloques) bloqueada.add(`${f.jornada}␟${f.dia}␟${b}`);
    }

    let disponible = 0;
    for (const j of suyas) {
      const franjaCI = entrada.config.centro_interes[j as 'manana' | 'tarde'];
      for (const dia of entrada.config.dias) {
        for (let b = 1; b <= (bloques[j as 'manana' | 'tarde'] ?? 0); b++) {
          if (bloqueada.has(`${j}␟${dia}␟${b}`)) continue;
          if (franjaCI && franjaCI.dia === dia && franjaCI.bloque === b) continue;
          disponible++;
        }
      }
    }

    const horas = horasDocente.get(d.id) ?? 0;
    if (horas > disponible) {
      avisar('docente', d.id,
        `${nombreDe.get(d.id) ?? d.id} dicta ${horas} horas y solo tiene ${disponible} `
        + 'bloques disponibles');
    }
  }

  // ---- 3. Espacios compartidos ---------------------------------------------
  const aulaDeDocente = new Map(entrada.docentes.map(d => [d.id, d.aula_fija]));
  const demanda = new Map<string, number>();
  for (const a of entrada.aulas) if (a.compartida) demanda.set(a.id, 0);
  for (const f of entrada.asignacion) {
    const aula = aulaDeDocente.get(f.docente);
    if (aula && demanda.has(aula)) demanda.set(aula, (demanda.get(aula) ?? 0) + f.horas);
  }
  const cupoManana = espacios('manana') - (conCI.has('manana') ? 1 : 0);
  for (const [aula, pedido] of [...demanda].sort()) {
    if (pedido > cupoManana) {
      avisar('aula', aula,
        `se pide ${pedido} veces y solo existe ${cupoManana}: sobran ${pedido - cupoManana}`);
    }
  }

  // ---- 4. Datos que faltan -------------------------------------------------
  //
  // La media técnica se programa aparte, pero se dicta en la misma jornada en
  // que sus docentes dan clase regular. Si esas horas no están declaradas como
  // indisponibilidad, el motor puede poner una clase encima y el validador no
  // lo verá, porque no existen en ningún lado: saldría un horario que parece
  // correcto y no lo es.
  const bloqueoPorDocente = new Map(entrada.docentes.map(
    d => [d.id, (d.no_disponible ?? []).reduce((s, f) => s + f.bloques.length, 0)],
  ));
  const mtPorDocente = new Map<string, number>();
  for (const mt of entrada.config.contrajornada_media_tecnica ?? []) {
    if (!mt.docente) continue;
    mtPorDocente.set(mt.docente, (mtPorDocente.get(mt.docente) ?? 0) + mt.horas);
  }
  for (const [docente, horas] of [...mtPorDocente].sort()) {
    if ((bloqueoPorDocente.get(docente) ?? 0) === 0) {
      avisar('datos', docente,
        `${nombreDe.get(docente) ?? docente} tiene ${horas} horas de media técnica que el `
        + 'motor no ve: hacen falta sus días y horas exactos para bloquearlas', false);
    }
  }

  const graves = avisos.filter(a => a.grave);
  return { avisos, graves, leves: avisos.filter(a => !a.grave), cuadra: graves.length === 0 };
}
