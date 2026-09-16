/**
 * Emparejamiento de importación — §8 del manual.
 *
 * El documento de identidad es el único identificador estable compartido con Master2000.
 *
 * El EMPAREJAMIENTO se hace siempre por `docHash` (HMAC-SHA256 calculado server-side),
 * nunca por el número en claro: así el criterio de identidad no cambia si algún día se
 * decide dejar de guardar el número.
 *
 * Desde 2026-08-04 el número TAMBIÉN se guarda en claro, por decisión de Julián como
 * responsable del dato: en una urgencia médica el 123 y la EPS lo piden para atender al
 * estudiante, y hoy eso obliga a ir hasta secretaría. Los dos campos conviven y no son
 * intercambiables — ver la nota en `types.ts`.
 *
 * Regla dura: JAMÁS emparejar por nombre automáticamente. El nombre solo sirve para
 * SOSPECHAR un duplicado y mandarlo a revisión humana — es donde nacen los duplicados
 * y las fusiones equivocadas de dos personas distintas.
 */

import type { CampoFicha } from './import-parse';
import type { DocType, Student } from './types';

/** Fila ya mapeada del archivo de Master2000 (el mapeo de columnas es configurable). */
export interface IncomingRow {
  nombres: string;
  apellidos: string;
  /** Hash del documento. Es lo ÚNICO por lo que se empareja. */
  docHash: string;
  /** Número en claro, solo para persistirlo. No se usa para emparejar. */
  docNumber: string;
  /** `null` = la celda venia vacia o el archivo no trae la columna: no se escribe. */
  docType: DocType | null;
  grado: string;
  acudiente: string;
  parentesco: string;
  telefonos: string[];
  // Campos del listado ampliado (2026-09-16). Opcionales: un archivo viejo no los trae.
  primerNombre?: string;
  primerApellido?: string;
  matricula?: string;
  sexo?: 'F' | 'M' | 'otro' | null;
  fechaNacimiento?: string;
  direccion?: string;
  barrio?: string;
  correoAcudiente?: string;
}

export type MatchDecision =
  | { kind: 'update'; row: IncomingRow; studentId: string }
  | { kind: 'create'; row: IncomingRow }
  | { kind: 'review'; row: IncomingRow; reason: string; candidateIds: string[] };

export interface MatchPlan {
  updates: Extract<MatchDecision, { kind: 'update' }>[];
  creates: Extract<MatchDecision, { kind: 'create' }>[];
  reviews: Extract<MatchDecision, { kind: 'review' }>[];
}

/** Solo dígitos: Master2000 exporta con puntos, guiones o espacios según la versión. */
export function normalizeDocNumber(raw: string): string {
  return (raw ?? '').replace(/\D+/g, '');
}

/** Para comparar nombres sin que acentos o dobles espacios generen falsos negativos. */
export function normalizeName(raw: string): string {
  return (raw ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function fullKey(first: string, last: string): string {
  return `${normalizeName(last)}|${normalizeName(first)}`;
}

/**
 * Decide qué hacer con cada fila entrante. No escribe nada: devuelve el plan para que
 * la Cloud Function lo ejecute y el superusuario vea el resumen antes/después.
 */
export function planImport(rows: IncomingRow[], existing: Student[]): MatchPlan {
  const byHash = new Map(existing.map((s) => [s.docHash, s]));
  const byName = new Map<string, Student[]>();
  for (const s of existing) {
    const k = fullKey(s.nombres, s.apellidos);
    const list = byName.get(k);
    if (list) list.push(s);
    else byName.set(k, [s]);
  }

  const plan: MatchPlan = { updates: [], creates: [], reviews: [] };
  // Un mismo archivo puede traer la misma persona dos veces (error de Master2000).
  const seenHashes = new Set<string>();

  for (const row of rows) {
    if (!row.docHash) {
      plan.reviews.push({
        kind: 'review',
        row,
        reason: 'Fila sin documento de identidad legible',
        candidateIds: [],
      });
      continue;
    }

    if (seenHashes.has(row.docHash)) {
      plan.reviews.push({
        kind: 'review',
        row,
        reason: 'Documento repetido dentro del mismo archivo',
        candidateIds: [],
      });
      continue;
    }
    seenHashes.add(row.docHash);

    const hit = byHash.get(row.docHash);
    if (hit) {
      plan.updates.push({ kind: 'update', row, studentId: hit.studentId });
      continue;
    }

    // Mismo nombre y apellido, documento distinto: típico cambio de TI a CC al cumplir
    // 18, o un error de digitación en Master2000. Podrían ser la misma persona o dos
    // homónimos reales. No lo decide la máquina.
    const nameHits = byName.get(fullKey(row.nombres, row.apellidos)) ?? [];
    if (nameHits.length > 0) {
      plan.reviews.push({
        kind: 'review',
        row,
        reason:
          'Ya existe un estudiante con el mismo nombre y apellido pero con documento distinto ' +
          '(posible cambio de TI a CC o error de digitación)',
        candidateIds: nameHits.map((s) => s.studentId),
      });
      continue;
    }

    plan.creates.push({ kind: 'create', row });
  }

  return plan;
}

/** Resumen para el log de auditoría y para mostrar al superusuario (§8). */
export function summarizePlan(plan: MatchPlan): {
  created: number;
  updated: number;
  review: number;
} {
  return {
    created: plan.creates.length,
    updated: plan.updates.length,
    review: plan.reviews.length,
  };
}


/**
 * Qué se escribe en una ficha EXISTENTE al reimportar. Es la regla que protege los
 * datos del colegio, y tiene dos mitades, las dos obligatorias:
 *
 *  1. **Lo que el archivo no trae, no se toca.** Solo se consideran los campos que
 *     `presentes` declara. El listado para Guardianes no trae acudiente ni teléfonos a
 *     propósito — ya están en la aplicación —, y antes de esta función la reimportación
 *     los sobrescribía SIEMPRE: importar ese archivo habría dejado a todo el colegio sin
 *     acudiente y sin teléfono.
 *
 *  2. **Una celda vacía no borra.** Aunque la columna venga, un vacío en el Máster es
 *     casi siempre un dato que nadie digitó, no una decisión de borrar. Se vio con la
 *     columna de teléfono del familiar: venía entera en blanco.
 *
 * Nunca incluye `docHash` ni `qrToken`: la identidad no se reescribe.
 */
export function actualizacionDeFicha(
  row: IncomingRow,
  presentes: readonly CampoFicha[],
): Partial<Student> {
  const cambios: Record<string, unknown> = {};
  const si = (campo: CampoFicha, destino: string, valor: unknown) => {
    if (!presentes.includes(campo)) return;
    if (valor === null || valor === undefined) return;
    if (typeof valor === 'string' && valor.trim() === '') return;
    if (Array.isArray(valor) && valor.length === 0) return;
    cambios[destino] = typeof valor === 'string' ? valor.trim() : valor;
  };

  si('nombres', 'nombres', row.nombres);
  si('apellidos', 'apellidos', row.apellidos);
  si('primerNombre', 'primerNombre', row.primerNombre);
  si('primerApellido', 'primerApellido', row.primerApellido);
  // `otro` sí se escribe: es un tipo real distinto. Lo que no se escribe es la AUSENCIA.
  si('docType', 'docType', row.docType);
  si('matricula', 'matricula', row.matricula);
  si('sexo', 'sexo', row.sexo);
  si('fechaNacimiento', 'fechaNacimiento', row.fechaNacimiento);
  si('direccion', 'direccion', row.direccion);
  si('barrio', 'barrio', row.barrio);
  si('acudiente', 'acudiente', row.acudiente);
  si('parentesco', 'parentesco', row.parentesco);
  si('telefonos', 'telefonos', row.telefonos?.filter(Boolean));
  si('correoAcudiente', 'correoAcudiente', row.correoAcudiente?.toLowerCase());

  // El número del documento siempre viaja (es la llave del emparejamiento) y se
  // reescribe a propósito: es el único camino para rellenar fichas importadas antes de
  // que el campo existiera. No mezcla personas: la fila llegó aquí por su hash.
  if (row.docNumber) cambios.docNumber = row.docNumber;

  return cambios as Partial<Student>;
}

/**
 * Versión del contrato entre la pantalla y la Cloud Function. La pantalla se niega a
 * importar si el servidor no la declara: una pantalla nueva contra una función vieja
 * mandaría acudientes vacíos que la función vieja escribiría sin mirar. Se sube cuando
 * cambia lo que la función hace con los campos.
 */
export const VERSION_IMPORTACION = 3;

// ---------------------------------------------------------------------------
//  Qué cambiaría, ficha por ficha — la verificación antes de escribir
// ---------------------------------------------------------------------------

/** Qué campo del archivo autoriza a escribir cada campo de la ficha. */
const CAMPO_QUE_AUTORIZA: Record<string, CampoFicha | 'siempre'> = {
  nombres: 'nombres',
  apellidos: 'apellidos',
  primerNombre: 'primerNombre',
  primerApellido: 'primerApellido',
  docType: 'docType',
  matricula: 'matricula',
  sexo: 'sexo',
  fechaNacimiento: 'fechaNacimiento',
  direccion: 'direccion',
  barrio: 'barrio',
  acudiente: 'acudiente',
  parentesco: 'parentesco',
  telefonos: 'telefonos',
  correoAcudiente: 'correoAcudiente',
  // Viaja siempre: es la llave. Sale del mismo número que dio el hash, así que en una
  // ficha emparejada nunca debería REEMPLAZAR nada. Si lo hace, algo anda muy mal.
  docNumber: 'siempre',
};

export interface DiferenciaCampo {
  campo: string;
  /** La ficha no tenía el dato y se llena. */
  completa: number;
  /** La ficha tenía OTRO valor y se reemplaza. Es lo que hay que mirar. */
  reemplaza: number;
  /** Hasta tres casos de reemplazo, para ver qué significa el número. */
  ejemplos: { estudiante: string; antes: string; despues: string }[];
}

export interface InformeDiferencias {
  campos: DiferenciaCampo[];
  /**
   * Escrituras a campos que el archivo NO trae. Por construcción debe ser CERO: si no lo
   * es, la regla «lo que no viene no se toca» se rompió, y la pantalla no deja confirmar.
   */
  fueraDelArchivo: number;
  /** Escrituras que dejarían vacío un dato que existía. También debe ser CERO. */
  vaciaria: number;
  fichasSinCambios: number;
}

function comoTexto(v: unknown): string {
  if (v === null || v === undefined) return '';
  if (Array.isArray(v)) return v.filter(Boolean).join(' / ');
  return String(v).trim();
}

/**
 * Compara, ficha por ficha, lo que la importación ESCRIBIRÍA contra lo que la ficha tiene
 * hoy. Corre dentro de la Cloud Function en la previsualización, sobre los datos reales y
 * con la MISMA función que después escribe: no es una suposición sobre el código, es el
 * servidor contando antes de tocar nada.
 *
 * `escribir` se recibe por parámetro solo para poder probar que el detector detecta: en
 * producción es siempre `actualizacionDeFicha`.
 */
export function diferenciasDeImportacion(
  updates: MatchPlan['updates'],
  existentes: Map<string, Student>,
  presentes: readonly CampoFicha[],
  escribir: (row: IncomingRow, presentes: readonly CampoFicha[]) => Partial<Student> = actualizacionDeFicha,
): InformeDiferencias {
  const porCampo = new Map<string, DiferenciaCampo>();
  let fueraDelArchivo = 0;
  let vaciaria = 0;
  let fichasSinCambios = 0;

  for (const u of updates) {
    const ficha = existentes.get(u.studentId);
    if (!ficha) continue;
    const cambios = escribir(u.row, presentes) as Record<string, unknown>;
    let tocoAlgo = false;

    for (const [campo, valor] of Object.entries(cambios)) {
      const autoriza = CAMPO_QUE_AUTORIZA[campo];
      if (autoriza !== 'siempre' && (!autoriza || !presentes.includes(autoriza))) fueraDelArchivo += 1;

      const antes = comoTexto((ficha as unknown as Record<string, unknown>)[campo]);
      const despues = comoTexto(valor);
      if (antes === despues) continue;
      tocoAlgo = true;

      if (antes && !despues) vaciaria += 1;
      const d = porCampo.get(campo) ?? { campo, completa: 0, reemplaza: 0, ejemplos: [] };
      if (!antes) {
        d.completa += 1;
      } else {
        d.reemplaza += 1;
        if (d.ejemplos.length < 3) {
          d.ejemplos.push({ estudiante: `${ficha.apellidos} ${ficha.nombres}`.trim(), antes, despues });
        }
      }
      porCampo.set(campo, d);
    }
    if (!tocoAlgo) fichasSinCambios += 1;
  }

  return {
    campos: [...porCampo.values()].sort((a, b) => b.reemplaza - a.reemplaza || a.campo.localeCompare(b.campo)),
    fueraDelArchivo,
    vaciaria,
    fichasSinCambios,
  };
}

/**
 * Lo que impide confirmar. Vacío = se puede importar. Cada motivo es una frase para una
 * persona, no un código.
 */
export function bloqueosDeImportacion(informe: InformeDiferencias | null | undefined): string[] {
  if (!informe) {
    return ['El servidor no devolvió la comparación ficha por ficha. Sin ella no se importa.'];
  }
  const b: string[] = [];
  if (informe.fueraDelArchivo > 0) {
    b.push(
      `Se escribirían ${informe.fueraDelArchivo} dato(s) en campos que el archivo no trae. ` +
        'Eso no debe pasar nunca: no importe y avise.',
    );
  }
  if (informe.vaciaria > 0) {
    b.push(`${informe.vaciaria} dato(s) existentes quedarían vacíos. No importe y avise.`);
  }
  const doc = informe.campos.find((c) => c.campo === 'docNumber');
  if (doc && doc.reemplaza > 0) {
    b.push(
      `${doc.reemplaza} ficha(s) cambiarían de número de documento. Una ficha se empareja por ` +
        'ese número: si cambia, algo anda muy mal. No importe y avise.',
    );
  }
  return b;
}
