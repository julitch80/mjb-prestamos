/**
 * Centros de interes -> extension «MJB -> Master 2000», V2 (2026-11-20).
 *
 * La extension deja de leer el Excel del director y le pide los datos a la app
 * (`ciParaMaster`). Al subir, le cuenta a la app que quedo en el Master
 * (`ciRegistrarSubida`). Con eso la app sabe que valoraciones cambiaron despues de
 * subirlas y se lo avisa al director. Ver
 * `mjb-prestamos/docs/extension-master2000/PRD.md`, seccion «Version 2».
 *
 * Logica pura: la usan las funciones (servidor) y las pruebas. Las filas salen de
 * `hojaResultadoCentros`, la MISMA que arma el Excel del director: lo que la extension
 * sube es exactamente lo que el director descargaria. Por eso los codigos ya vienen en
 * la serie 600 (entrega 40).
 */
import { hojaResultadoCentros } from './exports';

/** Las 10 casillas de codigo de la planilla del Master (COD1..COD10). 0 = vacia. */
export const CASILLAS_CODIGO = 10;

/**
 * Codigo del grupo en el Master: «11.2» -> `110200`, «6º1» -> `060100`.
 *
 * `GGSS00`: grado y grupo a dos digitos; el ultimo par es `00` en todo bachillerato
 * (hallazgo del export del 2026-07-31). En primaria ese par NO es fijo (`01` en algunos
 * grupos) y Transicion es alfanumerico (`TS0101`), asi que por debajo de 6.º se devuelve
 * `null` y no se adivina: la extension lo toma de la planilla descargada.
 */
export function codigoGrupoMaster(grado: string): string | null {
  const m = /^\s*(\d{1,2})\s*[.º°-]\s*(\d{1,2})\s*$/.exec(grado);
  if (!m) return null;
  const g = Number(m[1]);
  const s = Number(m[2]);
  if (g < 6 || g > 11 || s < 1) return null;
  return `${String(g).padStart(2, '0')}${String(s).padStart(2, '0')}00`;
}

/** Lo que se escribe (o se escribio) en el Master para un estudiante. */
export interface ContenidoMaster {
  /** 2 Basico · 3 Alto · 4 Superior. */
  val: number;
  /** Siempre 10 casillas, serie 600, 0 = vacia. */
  codigos: number[];
  /** `null` = la casilla va vacia (no es lo mismo que 0 faltas). */
  f: number | null;
  fj: number | null;
  observaciones: string;
}

export interface FilaCiMaster extends ContenidoMaster {
  studentId: string;
  /** Orden en la lista del grupo, desde 1 (columna «Ord»). */
  ord: number;
  /** `''` si la ficha no la trae: la extension NO la empareja. */
  matricula: string;
  /** «APELLIDOS, NOMBRES», como en el Excel. */
  nombre: string;
  /** false = no se digita (Val 0): plan de apoyo, pendiente, sin centro o dos centros. */
  seDigita: boolean;
  /** Por que no se digita. `''` si se digita. Es interno: NO va al Master. */
  motivo: string;
}

/** Las filas que alimentan el Excel del director, en el formato que pide la extension. */
export function filasCiMaster(
  grado: string,
  filas: (Parameters<typeof hojaResultadoCentros>[1][number] & { studentId: string })[],
): FilaCiMaster[] {
  const hoja = hojaResultadoCentros(grado, filas);
  // Columnas de COLUMNAS_PLANILLA_MASTER: Estado, Matricula, Nombre, Ord, Val,
  // COD1..COD10, F, FJ, Observaciones.
  return hoja.filas.map((r, i) => {
    const val = Number(r[4]) || 0;
    const seDigita = val !== 0;
    const num = (x: unknown) => (x === '' || x === null || x === undefined ? null : Number(x));
    return {
      studentId: filas[i].studentId,
      ord: Number(r[3]),
      matricula: String(r[1] ?? ''),
      nombre: String(r[2] ?? ''),
      val,
      codigos: r.slice(5, 5 + CASILLAS_CODIGO).map((c) => Number(c) || 0),
      f: seDigita ? num(r[15]) : null,
      fj: seDigita ? num(r[16]) : null,
      // En los que no se digitan, la columna trae el motivo: se separa para que la
      // extension nunca lo escriba en el Master.
      observaciones: seDigita ? String(r[17] ?? '') : '',
      seDigita,
      motivo: seDigita ? '' : String(r[17] ?? ''),
    };
  });
}

/**
 * Un contenido limpio y comparable. Lo usa `ciRegistrarSubida` para validar lo que manda
 * la extension: `null` si no tiene la forma esperada (no se guarda a medias).
 */
export function contenidoValido(x: unknown): ContenidoMaster | null {
  if (!x || typeof x !== 'object') return null;
  const o = x as Record<string, unknown>;
  const entero = (v: unknown, min: number, max: number) =>
    typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max;
  const faltas = (v: unknown) => v === null || v === undefined || entero(v, 0, 200);
  if (!entero(o.val, 0, 4)) return null;
  if (!Array.isArray(o.codigos) || o.codigos.length > CASILLAS_CODIGO) return null;
  if (!o.codigos.every((c) => entero(c, 0, 999))) return null;
  if (!faltas(o.f) || !faltas(o.fj)) return null;
  if (o.observaciones !== undefined && o.observaciones !== null && typeof o.observaciones !== 'string') return null;
  const obs = String(o.observaciones ?? '');
  if (obs.length > 1000) return null;
  return {
    val: o.val as number,
    codigos: Array.from({ length: CASILLAS_CODIGO }, (_, k) => (o.codigos as number[])[k] ?? 0),
    f: (o.f as number | null | undefined) ?? null,
    fj: (o.fj as number | null | undefined) ?? null,
    observaciones: obs,
  };
}

/** Igualdad de lo que importa en el Master. Observaciones sin espacios sobrantes. */
export function mismoContenido(a: ContenidoMaster, b: ContenidoMaster): boolean {
  const cods = (c: number[]) => Array.from({ length: CASILLAS_CODIGO }, (_, k) => c[k] ?? 0).join(',');
  return (
    a.val === b.val &&
    cods(a.codigos) === cods(b.codigos) &&
    (a.f ?? null) === (b.f ?? null) &&
    (a.fj ?? null) === (b.fj ?? null) &&
    a.observaciones.trim().replace(/\s+/g, ' ') === b.observaciones.trim().replace(/\s+/g, ' ')
  );
}

/**
 * Como esta cada estudiante frente a la ultima subida, DESDE LA APP (la app no ve el
 * Master; eso lo decide la extension comparando con la planilla descargada):
 *  - `sin_subir`: nunca se le subio nada.
 *  - `igual`: la app tiene lo mismo que se subio.
 *  - `cambio_en_app`: la app cambio despues de subirlo (incluye que ya no se digite).
 */
export type EstadoFrenteASubida = 'sin_subir' | 'igual' | 'cambio_en_app';

export function estadoFrenteASubida(fila: FilaCiMaster, subido: ContenidoMaster | null): EstadoFrenteASubida {
  if (!subido) return 'sin_subir';
  if (!fila.seDigita) return 'cambio_en_app';
  return mismoContenido(fila, subido) ? 'igual' : 'cambio_en_app';
}

export interface PendienteDeSubir {
  studentId: string;
  nombre: string;
  /**
   * `cambio`: se subio y despues cambio en la app.
   * `nuevo`: el grupo ya se subio, y este estudiante recibio valoracion despues.
   * `ya_no_se_digita`: se subio, y ahora no se digita (p. ej. paso a plan de apoyo). La
   *   extension nunca borra notas: este hay que corregirlo a mano en el Master.
   */
  tipo: 'cambio' | 'nuevo' | 'ya_no_se_digita';
}

/**
 * Lo que el director tiene que volver a subir. Vacio si el grupo nunca se ha subido:
 * entonces no hay «cambios despues de subir», solo la primera subida.
 */
export function pendientesDeSubir(
  filas: FilaCiMaster[],
  subidas: Record<string, ContenidoMaster> | null,
): PendienteDeSubir[] {
  if (!subidas || Object.keys(subidas).length === 0) return [];
  const out: PendienteDeSubir[] = [];
  for (const f of filas) {
    const s = subidas[f.studentId] ?? null;
    if (!s) {
      if (f.seDigita) out.push({ studentId: f.studentId, nombre: f.nombre, tipo: 'nuevo' });
      continue;
    }
    if (!f.seDigita) out.push({ studentId: f.studentId, nombre: f.nombre, tipo: 'ya_no_se_digita' });
    else if (!mismoContenido(f, s)) out.push({ studentId: f.studentId, nombre: f.nombre, tipo: 'cambio' });
  }
  return out;
}

/** Id del documento de subidas: uno por programa y grado. */
export function idSubidaCi(programaId: string, grado: string): string {
  return `${programaId}__${grado}`;
}
