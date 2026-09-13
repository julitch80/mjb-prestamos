/**
 * Revisor de horarios dentro de la app. Espejo de `motor/validador.py`.
 *
 * Existe por dos razones. La primera es que el coordinador tiene que poder mover
 * una clase y saber al instante si eso rompe algo, sin volver a pasar por el
 * motor. La segunda es que el juicio sobre si un horario sirve no puede vivir
 * solo en el programa que lo construyó: si el único que certifica el horario es
 * quien lo hizo, nadie lo está auditando.
 *
 * Las reglas no pesan igual, y esa jerarquía es del colegio, no nuestra:
 *
 *   - Un docente en dos sitios a la vez        BLOQUEA
 *   - Un grupo con dos clases a la vez         BLOQUEA
 *   - Dos clases en el mismo salón             solo AVISA
 *
 * Lo tercero es deliberado: en la práctica dos grupos comparten espacio a veces,
 * y bloquearlo impide soluciones que el coordinador sí quiere. Los espacios
 * marcados `exclusiva: false` (el Patio) no producen ni aviso: dos grupos de
 * educación física comparten cancha sin estorbarse.
 */

import type {
  ClaseGenerada, Dia, DocenteGenerador, EntradaGenerador, Jornada,
} from './tipos';

export type TipoViolacion =
  | 'choque_docente' | 'choque_grupo' | 'choque_aula' | 'no_disponible'
  | 'franja_reservada' | 'cobertura' | 'aula_incorrecta' | 'fuera_de_rejilla';

/** Lo que no invalida el horario, solo merece una mirada. */
const TIPOS_DE_AVISO: ReadonlySet<TipoViolacion> = new Set<TipoViolacion>(['choque_aula']);

export interface Violacion {
  tipo: TipoViolacion;
  /** A quién señala: un docente, un grupo, un aula. */
  quien: string;
  mensaje: string;
  /** Si solo avisa. Separarlo importa: mezclado con lo grave, se ignora todo. */
  aviso: boolean;
}

export function duras(violaciones: Violacion[]): Violacion[] {
  return violaciones.filter(v => !v.aviso);
}

export function avisos(violaciones: Violacion[]): Violacion[] {
  return violaciones.filter(v => v.aviso);
}

export function resumen(violaciones: Violacion[]): Record<string, number> {
  const cuenta: Record<string, number> = {};
  for (const v of violaciones) cuenta[v.tipo] = (cuenta[v.tipo] ?? 0) + 1;
  return cuenta;
}

function violacion(tipo: TipoViolacion, quien: string, mensaje: string): Violacion {
  return { tipo, quien, mensaje, aviso: TIPOS_DE_AVISO.has(tipo) };
}

/** Las clases de Centro de Interés vienen marcadas en el grado ('9.1/CI'). */
function esCentroDeInteres(clase: ClaseGenerada): boolean {
  const grado = String(clase.grado ?? '').toUpperCase();
  return grado.split('/').pop()?.trim().includes('CI') === true || grado.trim() === 'CI';
}

/**
 * Clave para agrupar. El separador no es un espacio a propósito: hay aulas que
 * se llaman "Aula 10", y con un espacio dos claves distintas podrían confundirse.
 */
function clave(...partes: Array<string | number>): string {
  return partes.join('␟');
}

interface Indice {
  nombre: Map<string, string>;
  aulaDocente: Map<string, string | undefined>;
  aulaGrupo: Map<string, string | undefined>;
  aulasVigiladas: Set<string>;
  noDisponible: Set<string>;
}

function indexar(entrada: EntradaGenerador): Indice {
  const noDisponible = new Set<string>();
  for (const d of entrada.docentes) {
    for (const f of d.no_disponible ?? []) {
      for (const b of f.bloques) noDisponible.add(clave(d.id, f.jornada, f.dia, b));
    }
  }
  // Se vigilan todas las aulas, no solo las escasas: si una clase acaba en un
  // salón que otro está usando, hay que avisar aunque ese salón sea de uso
  // exclusivo de una persona. Quedan fuera las que no se disputan.
  const aulasVigiladas = new Set(
    entrada.aulas.filter(a => a.exclusiva !== false).map(a => a.id),
  );
  return {
    nombre: new Map(entrada.docentes.map(d => [d.id, d.nombre])),
    aulaDocente: new Map(entrada.docentes.map(d => [d.id, d.aula_fija])),
    aulaGrupo: new Map(entrada.grupos.map(g => [g.id, g.aula_fija])),
    aulasVigiladas,
    noDisponible,
  };
}

/**
 * Revisa un horario completo contra las reglas del colegio.
 *
 * Devuelve todo lo que encuentra, grave y leve, en un orden estable: dos
 * ejecuciones sobre el mismo horario dan exactamente la misma lista.
 */
export function validar(entrada: EntradaGenerador, horario: ClaseGenerada[]): Violacion[] {
  const v: Violacion[] = [];
  const ix = indexar(entrada);
  const dias = new Set<string>(entrada.config.dias);
  const bloques = entrada.config.bloques_por_jornada;
  const ci = entrada.config.centro_interes;

  const porDocente = new Map<string, ClaseGenerada[]>();
  const porGrupo = new Map<string, ClaseGenerada[]>();
  const porAula = new Map<string, ClaseGenerada[]>();
  const dictadas = new Map<string, number>();

  const acumular = (m: Map<string, ClaseGenerada[]>, k: string, c: ClaseGenerada) => {
    const lista = m.get(k);
    if (lista) lista.push(c);
    else m.set(k, [c]);
  };

  for (const e of horario) {
    if (esCentroDeInteres(e)) continue;

    acumular(porDocente, clave(e.docente, e.jornada, e.dia, e.bloque), e);
    acumular(porGrupo, clave(e.grado, e.dia, e.bloque), e);
    if (ix.aulasVigiladas.has(e.aula)) {
      acumular(porAula, clave(e.aula, e.jornada, e.dia, e.bloque), e);
    }
    const kc = clave(e.docente, e.grado);
    dictadas.set(kc, (dictadas.get(kc) ?? 0) + 1);

    if (!dias.has(e.dia)) {
      v.push(violacion('fuera_de_rejilla', e.docente,
        `clase en '${e.dia}', que no es día lectivo`));
    }
    const tope = bloques[e.jornada];
    if (tope !== undefined && (e.bloque < 1 || e.bloque > tope)) {
      v.push(violacion('fuera_de_rejilla', e.docente,
        `bloque ${e.bloque} fuera de los ${tope} de la jornada ${e.jornada}`));
    }

    if (ix.noDisponible.has(clave(e.docente, e.jornada, e.dia, e.bloque))) {
      v.push(violacion('no_disponible', e.docente,
        `${ix.nombre.get(e.docente) ?? e.docente} tiene clase con ${e.grado} el `
        + `${e.dia} bloque ${e.bloque} (${e.jornada}), donde no está disponible`));
    }

    const franja = ci[e.jornada];
    if (franja && e.dia === franja.dia && e.bloque === franja.bloque) {
      v.push(violacion('franja_reservada', e.grado,
        `clase de ${e.docente} el ${e.dia} bloque ${e.bloque} ocupa la franja `
        + `reservada al Centro de Interés de la ${e.jornada}`));
    }

    const esperada = e.jornada === 'manana'
      ? ix.aulaDocente.get(e.docente)
      : ix.aulaGrupo.get(e.grado);
    if (esperada && e.aula !== esperada) {
      v.push(violacion('aula_incorrecta', e.docente,
        `clase con ${e.grado} el ${e.dia} bloque ${e.bloque} está en `
        + `'${e.aula}' y le corresponde '${esperada}'`));
    }
  }

  // Lo que se muestra sale de la primera clase del grupo, no de deshacer la
  // clave: la franja es la misma para todas, y así el mensaje no depende de
  // cómo esté armada la clave.
  const conflictivas = (m: Map<string, ClaseGenerada[]>) =>
    [...m].sort((a, b) => a[0].localeCompare(b[0]))
      .map(([, lista]) => lista)
      .filter(lista => lista.length > 1);

  for (const lista of conflictivas(porDocente)) {
    const { docente, dia, bloque } = lista[0];
    const grupos = lista.map(x => x.grado).sort().join(', ');
    v.push(violacion('choque_docente', docente,
      `${ix.nombre.get(docente) ?? docente} tiene ${lista.length} clases a la vez `
      + `el ${dia} bloque ${bloque}: ${grupos}`));
  }

  for (const lista of conflictivas(porGrupo)) {
    const { grado, dia, bloque } = lista[0];
    const docs = lista.map(x => x.docente).sort().join(', ');
    v.push(violacion('choque_grupo', grado,
      `el grupo tiene ${lista.length} clases a la vez el ${dia} bloque ${bloque}: ${docs}`));
  }

  for (const lista of conflictivas(porAula)) {
    const { aula, dia, bloque } = lista[0];
    const quienes = lista.map(x => `${x.docente}/${x.grado}`).sort().join(', ');
    v.push(violacion('choque_aula', aula,
      `${lista.length} clases a la vez el ${dia} bloque ${bloque}: ${quienes}`));
  }

  // Cobertura por pareja (docente, grupo): es todo lo que el formato permite. Si
  // un docente da dos materias al mismo grupo se verifica la suma, que basta
  // para garantizar que no falten ni sobren horas.
  const esperadas = new Map<string, number>();
  const nombresDePareja = new Map<string, [string, string]>();
  for (const f of entrada.asignacion) {
    const k = clave(f.docente, f.grupo);
    esperadas.set(k, (esperadas.get(k) ?? 0) + f.horas);
    nombresDePareja.set(k, [f.docente, f.grupo]);
  }
  for (const e of horario) {
    if (esCentroDeInteres(e)) continue;
    nombresDePareja.set(clave(e.docente, e.grado), [e.docente, e.grado]);
  }

  for (const k of [...new Set([...esperadas.keys(), ...dictadas.keys()])].sort()) {
    const esp = esperadas.get(k) ?? 0;
    const real = dictadas.get(k) ?? 0;
    if (esp === real) continue;
    const [doc, grupo] = nombresDePareja.get(k) ?? ['?', '?'];
    v.push(violacion('cobertura', `${doc}/${grupo}`, real < esp
      ? `le faltan ${esp - real} de las ${esp} horas asignadas`
      : `tiene ${real - esp} horas de más sobre las ${esp} asignadas`));
  }

  return v;
}

// --------------------------------------------------------------------------
// Mover una clase: la comprobación de un solo movimiento
// --------------------------------------------------------------------------

export interface Destino {
  dia: Dia;
  bloque: number;
}

export interface Veredicto {
  /** Si el movimiento se puede hacer. Los avisos no lo impiden. */
  permitido: boolean;
  /** Por qué no, nombrando a quien estorba. Vacío si se permite. */
  motivo?: string;
  /** Lo que conviene que el coordinador sepa aunque el movimiento valga. */
  avisos: string[];
}

/**
 * ¿Se puede mover esta clase a esa franja?
 *
 * `clase` tiene que ser el objeto que está dentro de `horario`, no una copia: es
 * como se sabe cuál no debe estorbarse a sí misma.
 *
 * El mensaje dice **quién estorba**, no "movimiento inválido". Es la diferencia
 * entre que el coordinador sepa qué hacer y que no: "10.2 a la 3.ª hora ya tiene
 * clase con Doris" le señala la salida; "conflicto" lo deja igual que estaba.
 */
export function puedeColocar(
  entrada: EntradaGenerador,
  horario: ClaseGenerada[],
  clase: ClaseGenerada,
  destino: Destino,
  comoSeLlama?: (id: string) => string,
): Veredicto {
  const ix = indexar(entrada);
  // Quien llama puede dar nombres más cortos. En un aviso, «Gloria a la 6.ª hora
  // ya está con 9.1» se lee de un vistazo; con el nombre completo y dos
  // apellidos, el aviso deja de leerse y empieza a estorbar.
  const nombreDe = (id: string) => comoSeLlama?.(id) ?? ix.nombre.get(id) ?? id;
  const bloqueado = (motivo: string): Veredicto => ({ permitido: false, avisos: [], motivo });

  const dias = new Set<string>(entrada.config.dias);
  const tope = entrada.config.bloques_por_jornada[clase.jornada];
  if (!dias.has(destino.dia)
      || (tope !== undefined && (destino.bloque < 1 || destino.bloque > tope))) {
    return bloqueado('Esa franja no existe en la semana.');
  }

  const franja = entrada.config.centro_interes[clase.jornada];
  if (franja && destino.dia === franja.dia && destino.bloque === franja.bloque) {
    return bloqueado(`Esa franja está reservada al Centro de Interés de la ${clase.jornada}.`);
  }

  if (ix.noDisponible.has(clave(clase.docente, clase.jornada, destino.dia, destino.bloque))) {
    return bloqueado(`${nombreDe(clase.docente)} no está disponible el ${destino.dia} `
      + `a la ${destino.bloque}.ª hora.`);
  }

  const enDestino = horario.filter(
    e => e !== clase && e.dia === destino.dia && e.bloque === destino.bloque
      && e.jornada === clase.jornada && !esCentroDeInteres(e),
  );

  const choqueDocente = enDestino.find(e => e.docente === clase.docente);
  if (choqueDocente) {
    return bloqueado(`${nombreDe(clase.docente)} a la ${destino.bloque}.ª hora ya está `
      + `con ${choqueDocente.grado}.`);
  }

  const choqueGrupo = enDestino.find(e => e.grado === clase.grado);
  if (choqueGrupo) {
    return bloqueado(`${clase.grado} a la ${destino.bloque}.ª hora ya tiene clase con `
      + `${nombreDe(choqueGrupo.docente)}.`);
  }

  // El aula avisa, no bloquea: es la regla del colegio.
  const avisosDelMovimiento: string[] = [];
  if (ix.aulasVigiladas.has(clase.aula)) {
    for (const otra of enDestino.filter(e => e.aula === clase.aula)) {
      avisosDelMovimiento.push(
        `${clase.aula} quedaría con dos clases a la ${destino.bloque}.ª hora: `
        + `${nombreDe(clase.docente)} con ${clase.grado} y `
        + `${nombreDe(otra.docente)} con ${otra.grado}.`);
    }
  }

  return { permitido: true, avisos: avisosDelMovimiento };
}

/**
 * Franjas en las que un docente no puede dar clase, para pintar la rejilla en
 * gris antes de que el coordinador intente soltar algo ahí.
 */
export function franjasImposibles(
  entrada: EntradaGenerador,
  docente: DocenteGenerador,
  jornada: Jornada,
): Set<string> {
  const fuera = new Set<string>();
  for (const f of docente.no_disponible ?? []) {
    if (f.jornada !== jornada) continue;
    for (const b of f.bloques) fuera.add(clave(f.dia, b));
  }
  const franja = entrada.config.centro_interes[jornada];
  if (franja) fuera.add(clave(franja.dia, franja.bloque));
  return fuera;
}
