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

import type { DocType, Student } from './types';

/** Fila ya mapeada del archivo de Master2000 (el mapeo de columnas es configurable). */
export interface IncomingRow {
  nombres: string;
  apellidos: string;
  /** Hash del documento. Es lo ÚNICO por lo que se empareja. */
  docHash: string;
  /** Número en claro, solo para persistirlo. No se usa para emparejar. */
  docNumber: string;
  docType: DocType;
  grado: string;
  acudiente: string;
  parentesco: string;
  telefonos: string[];
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

