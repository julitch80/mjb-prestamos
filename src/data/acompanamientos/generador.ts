/**
 * Genera alternativas automáticas de distribución, respetando los candados y
 * las reglas de reparto del PRD (§ «Reglas de reparto»). Corre en el
 * navegador del coordinador (PLAN.md § 7): el problema es pequeño (unas 30
 * casillas y unos 20 profesores por jornada), así que no hace falta backend.
 *
 * DISEÑO (ver también el resumen en la respuesta de la tarea):
 * - Construcción voraz aleatorizada: recorre las casillas vacías (zona, día)
 *   en un orden barajado con un PRNG sembrado (mulberry32, reproducible), y
 *   para cada una elige, entre los profesores que SÍ pueden cubrirla sin
 *   romper un bloqueo, al de menor "penalización" (día liviano, equidad,
 *   meta del mixto, no repetir zona) con un empate aleatorio pequeño para
 *   que semillas distintas den resultados distintos.
 * - Si ninguna casilla queda cubierta por falta de profesores disponibles sin
 *   romper una regla, se deja incompleta y se registra en `faltantes` — es
 *   el único bloqueo que el generador se permite producir (`casilla_incompleta`).
 * - Se repite la construcción con varias semillas derivadas de la semilla
 *   base, se descartan las que quedan a menos de 4 asignaciones de otra ya
 *   elegida (para que las alternativas sean realmente distintas), y se
 *   devuelven las `cantidad` con mejor puntaje.
 */

import type { Asignacion, Dia, Distribucion, Zona } from './tipos';
import { DIAS } from './tipos';
import { puedeCubrir, docentesDeLaJornada, pesoDeCarga } from './disponibilidad';
import { clasesEnDia, DIA_CARGADO } from './clases';

export interface Faltante {
  zonaId: string;
  dia: Dia;
  motivo: string;
}

export interface Metricas {
  diferenciaCarga: number;
  profesoresQueCambian: number;
  diasCargados: number;
  faltantes: Faltante[];
}

export interface Alternativa {
  distribucion: Distribucion;
  metricas: Metricas;
}

export interface OpcionesGenerador {
  cantidad?: number;
  semilla?: number;
  referencia?: Distribucion;
}

/** mulberry32: PRNG sembrado, rápido y suficiente para desempates reproducibles. */
function mulberry32(semilla: number): () => number {
  let a = semilla >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function clave(zonaId: string, dia: Dia, docenteId: string): string {
  return `${zonaId}|${dia}|${docenteId}`;
}

/** Pares (zona, día) que cubre cada docente en una distribución. */
function paresPorDocente(dist: Distribucion): Map<string, Set<string>> {
  const mapa = new Map<string, Set<string>>();
  for (const a of dist.asignaciones) {
    if (!mapa.has(a.docenteId)) mapa.set(a.docenteId, new Set());
    mapa.get(a.docenteId)!.add(`${a.zonaId}|${a.dia}`);
  }
  return mapa;
}

function profesoresQueCambian(nueva: Distribucion, referencia: Distribucion): number {
  const antes = paresPorDocente(referencia);
  const despues = paresPorDocente(nueva);
  const ids = new Set([...antes.keys(), ...despues.keys()]);
  let cambian = 0;
  for (const id of ids) {
    const a = antes.get(id) ?? new Set<string>();
    const b = despues.get(id) ?? new Set<string>();
    if (a.size !== b.size || [...a].some((x) => !b.has(x))) cambian += 1;
  }
  return cambian;
}

function diferenciaCarga(dist: Distribucion): number {
  const docentes = docentesDeLaJornada(dist.jornada);
  if (docentes.length === 0) return 0;
  const conteo = new Map<string, number>();
  for (const u of docentes) conteo.set(u.id, 0);
  for (const a of dist.asignaciones) {
    if (conteo.has(a.docenteId)) conteo.set(a.docenteId, (conteo.get(a.docenteId) ?? 0) + 1);
  }
  let max = -Infinity;
  let min = Infinity;
  for (const u of docentes) {
    const carga = (conteo.get(u.id) ?? 0) / pesoDeCarga(u.id, dist.jornada);
    if (carga > max) max = carga;
    if (carga < min) min = carga;
  }
  return max - min;
}

/** Diferencia mínima (en número de asignaciones distintas) entre dos alternativas. */
function distanciaAsignaciones(a: Distribucion, b: Distribucion): number {
  const setA = new Set(a.asignaciones.map((x) => clave(x.zonaId, x.dia, x.docenteId)));
  const setB = new Set(b.asignaciones.map((x) => clave(x.zonaId, x.dia, x.docenteId)));
  let dif = 0;
  for (const k of setA) if (!setB.has(k)) dif += 1;
  for (const k of setB) if (!setA.has(k)) dif += 1;
  return dif;
}

interface Hueco {
  zonaId: string;
  dia: Dia;
}

/** Una construcción voraz aleatorizada con la semilla dada. Devuelve la distribución y sus faltantes. */
function construir(base: Distribucion, semilla: number): { distribucion: Distribucion; faltantes: Faltante[] } {
  const rand = mulberry32(semilla);
  const jornada = base.jornada;
  const zonas: Zona[] = base.zonas;
  const docentesJornada = docentesDeLaJornada(jornada);
  const sumaPesos = docentesJornada.reduce((s, u) => s + pesoDeCarga(u.id, jornada), 0);
  const totalCasillas = zonas.reduce((s, z) => s + z.cupo * DIAS.length, 0);

  // Candados: se conservan tal cual.
  const candados = base.asignaciones.filter((a) => a.candado);
  const asignaciones: Asignacion[] = [...candados];

  // Estado que se va actualizando mientras se llenan huecos.
  const cargaDocente = new Map<string, number>(); // conteo crudo (sin normalizar)
  for (const u of docentesJornada) cargaDocente.set(u.id, 0);
  const diaOcupadoPorDocente = new Map<string, Set<Dia>>(); // docenteId -> días ya usados en CUALQUIER zona
  const zonasDelDocente = new Map<string, Set<string>>(); // docenteId -> zonas ya cubiertas esta semana
  for (const a of candados) {
    cargaDocente.set(a.docenteId, (cargaDocente.get(a.docenteId) ?? 0) + 1);
    if (!diaOcupadoPorDocente.has(a.docenteId)) diaOcupadoPorDocente.set(a.docenteId, new Set());
    diaOcupadoPorDocente.get(a.docenteId)!.add(a.dia);
    if (!zonasDelDocente.has(a.docenteId)) zonasDelDocente.set(a.docenteId, new Set());
    zonasDelDocente.get(a.docenteId)!.add(a.zonaId);
  }

  // Huecos a llenar: cupo - candados ya puestos en esa zona/día.
  const huecos: Hueco[] = [];
  for (const zona of zonas) {
    for (const dia of DIAS) {
      const yaPuestos = candados.filter((a) => a.zonaId === zona.id && a.dia === dia).length;
      const faltan = Math.max(0, zona.cupo - yaPuestos);
      for (let i = 0; i < faltan; i++) huecos.push({ zonaId: zona.id, dia });
    }
  }
  // Orden barajado (Fisher-Yates con el PRNG sembrado) para que la construcción varíe por semilla.
  for (let i = huecos.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [huecos[i], huecos[j]] = [huecos[j], huecos[i]];
  }

  const faltantes: Faltante[] = [];

  for (const hueco of huecos) {
    const ocupadosEnEstaCasilla = new Set(
      asignaciones.filter((a) => a.zonaId === hueco.zonaId && a.dia === hueco.dia).map((a) => a.docenteId),
    );
    const candidatos = docentesJornada.filter((u) => {
      if (ocupadosEnEstaCasilla.has(u.id)) return false; // repetido_en_casilla
      if (!puedeCubrir(u.id, jornada, hueco.dia)) return false; // fuera_de_jornada
      if (diaOcupadoPorDocente.get(u.id)?.has(hueco.dia)) return false; // dos_zonas_mismo_dia
      return true;
    });

    if (candidatos.length === 0) {
      faltantes.push({
        zonaId: hueco.zonaId,
        dia: hueco.dia,
        motivo: `Nadie más puede cubrir el ${hueco.dia} sin quedar en dos zonas o salirse de su jornada.`,
      });
      continue;
    }

    // Puntaje por candidato: menor es mejor. Empate aleatorio pequeño para variar entre semillas.
    let mejor = candidatos[0];
    let mejorPuntaje = Infinity;
    for (const u of candidatos) {
      const clases = clasesEnDia(u.id, jornada, hueco.dia);
      const peso = pesoDeCarga(u.id, jornada);
      const cargaActual = cargaDocente.get(u.id) ?? 0;
      const cargaNormalizada = cargaActual / peso;
      const meta = peso * (totalCasillas / (sumaPesos || 1));

      let puntaje = 0;
      if (clases >= DIA_CARGADO) {
        puntaje += 1000; // se usa solo si no hay más remedio
      } else {
        puntaje += clases * 10; // prefiere el día más liviano del profesor
      }
      puntaje += cargaNormalizada * 50; // equidad
      if (peso < 1 && cargaActual + 1 > meta) {
        puntaje += (cargaActual + 1 - meta) * 30; // mixto cerca de su meta
      }
      if (zonasDelDocente.get(u.id)?.has(hueco.zonaId)) {
        puntaje += 5; // rotación de zonas: penalización leve, no bloquea
      }
      puntaje += rand() * 0.5; // empate aleatorio, mantiene reproducibilidad por semilla

      if (puntaje < mejorPuntaje) {
        mejorPuntaje = puntaje;
        mejor = u;
      }
    }

    asignaciones.push({ zonaId: hueco.zonaId, dia: hueco.dia, docenteId: mejor.id, candado: false });
    cargaDocente.set(mejor.id, (cargaDocente.get(mejor.id) ?? 0) + 1);
    if (!diaOcupadoPorDocente.has(mejor.id)) diaOcupadoPorDocente.set(mejor.id, new Set());
    diaOcupadoPorDocente.get(mejor.id)!.add(hueco.dia);
    if (!zonasDelDocente.has(mejor.id)) zonasDelDocente.set(mejor.id, new Set());
    zonasDelDocente.get(mejor.id)!.add(hueco.zonaId);
  }

  return { distribucion: { jornada, zonas, asignaciones }, faltantes };
}

function diasCargados(dist: Distribucion): number {
  let n = 0;
  for (const a of dist.asignaciones) {
    if (clasesEnDia(a.docenteId, dist.jornada, a.dia) >= DIA_CARGADO) n += 1;
  }
  return n;
}

export function generarAlternativas(base: Distribucion, opciones: OpcionesGenerador = {}): Alternativa[] {
  const cantidad = opciones.cantidad ?? 3;
  const semillaBase = opciones.semilla ?? 1;
  const referencia = opciones.referencia ?? base;

  const candidatas: Alternativa[] = [];
  const maxIntentos = 40;

  for (let i = 0; i < maxIntentos && candidatas.length < Math.max(cantidad * 4, 12); i++) {
    const semilla = semillaBase + i * 104729; // salto grande para decorrelacionar semillas cercanas
    const { distribucion, faltantes } = construir(base, semilla);
    candidatas.push({
      distribucion,
      metricas: {
        diferenciaCarga: diferenciaCarga(distribucion),
        profesoresQueCambian: profesoresQueCambian(distribucion, referencia),
        diasCargados: diasCargados(distribucion),
        faltantes,
      },
    });
  }

  // Puntaje total para ordenar: menos días cargados, más equidad y menos faltantes es mejor.
  function puntajeTotal(alt: Alternativa): number {
    return (
      alt.metricas.diasCargados * 1000 +
      alt.metricas.faltantes.length * 500 +
      alt.metricas.diferenciaCarga * 100
    );
  }
  candidatas.sort((a, b) => puntajeTotal(a) - puntajeTotal(b));

  // Selecciona las mejores que sean distintas entre sí (>= 4 asignaciones de diferencia).
  const elegidas: Alternativa[] = [];
  for (const cand of candidatas) {
    if (elegidas.every((e) => distanciaAsignaciones(e.distribucion, cand.distribucion) >= 4)) {
      elegidas.push(cand);
    }
    if (elegidas.length >= cantidad) break;
  }
  // Si no alcanzaron `cantidad` distintas pero sí hay más candidatas disponibles,
  // completa con las mejores restantes hasta min(cantidad, 2, candidatas) —
  // el piso de 2 (PLAN.md § 7) nunca se aplica si se pidió menos de 2.
  const piso = Math.min(cantidad, 2, candidatas.length);
  if (elegidas.length < piso) {
    for (const cand of candidatas) {
      if (!elegidas.includes(cand)) elegidas.push(cand);
      if (elegidas.length >= piso) break;
    }
  }

  return elegidas;
}
