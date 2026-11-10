/**
 * Indice de inscripcion por grado: en que centro de interes esta cada estudiante, para que
 * su director de grupo lo vea aunque todavia no tenga valoracion (Julian, 2026-11-09).
 *
 * POR QUE UN INDICE Y NO ABRIRLE EL CENTRO: el documento del centro trae los inscritos de
 * todos los grados, y Julian decidio que un director solo vea a los suyos. Las reglas no
 * pueden filtrar una lista por dentro, asi que se guarda aparte, un documento por grado:
 * `asistenciaProgramas/{programaId}/porGrado/{grado}`, que la regla deja leer con
 * `asisIsDirectorOf(grado)`.
 *
 * Lo escribe SOLO la funcion `onCentroInteresEscrito` (y `reconstruirInscripcionPorGrado`),
 * con lo que aqui se calcula. Logica pura: la comparten la funcion y las pruebas.
 *
 * Forma: centros[studentId][grupoId] = { nombre, lider }. Dos niveles y no uno porque un
 * estudiante puede quedar en dos centros mientras la coordinacion decide; asi ninguno pisa
 * al otro.
 */

export interface CentroEnIndice {
  nombre: string;
  /** Correo del lider. */
  lider: string;
}

export type IndiceGrado = Record<string, Record<string, CentroEnIndice>>;

/** Lo que importa del documento de un centro para el indice. */
export interface CabeceraCentro {
  nombre?: string;
  lider?: string;
  miembros?: string[];
  activo?: boolean;
}

/**
 * Que hay que cambiar en el indice cuando se escribe un centro.
 *
 *  - `quitar`: estudiantes que salieron (o todos, si el centro se borro o se desactivo).
 *  - `poner`: los que entraron; y TODOS los inscritos si cambio el nombre o el lider, o si
 *    el centro se reactivo, para que el indice no quede con el dato viejo.
 */
export function cambiosPorEscrituraDeCentro(
  antes: CabeceraCentro | null,
  despues: CabeceraCentro | null,
): { poner: string[]; quitar: string[] } {
  const vivoAntes = !!antes && antes.activo !== false;
  const vivoDespues = !!despues && despues.activo !== false;
  const enAntes = new Set(vivoAntes ? antes!.miembros ?? [] : []);
  const enDespues = new Set(vivoDespues ? despues!.miembros ?? [] : []);

  const quitar = [...enAntes].filter((id) => !enDespues.has(id));
  const cambioCabecera =
    vivoDespues && (!vivoAntes || antes!.nombre !== despues!.nombre || antes!.lider !== despues!.lider);
  const poner = cambioCabecera ? [...enDespues] : [...enDespues].filter((id) => !enAntes.has(id));
  return { poner, quitar };
}

/** El indice completo de un programa, grado por grado. Para reconstruirlo desde cero. */
export function construirIndicePorGrado(
  centros: ({ grupoId: string } & CabeceraCentro)[],
  gradoDe: Map<string, string>,
): Map<string, IndiceGrado> {
  const porGrado = new Map<string, IndiceGrado>();
  for (const c of centros) {
    if (c.activo === false) continue;
    for (const id of c.miembros ?? []) {
      const grado = gradoDe.get(id);
      if (!grado) continue;
      const indice = porGrado.get(grado) ?? {};
      indice[id] = { ...(indice[id] ?? {}), [c.grupoId]: { nombre: c.nombre ?? c.grupoId, lider: (c.lider ?? '').toLowerCase() } };
      porGrado.set(grado, indice);
    }
  }
  return porGrado;
}

/** El centro de un estudiante segun el indice (el primero por nombre si hay dos). */
export function centroDeEstudiante(
  indice: IndiceGrado | null,
  studentId: string,
): ({ grupoId: string } & CentroEnIndice) | null {
  const suyos = Object.entries(indice?.[studentId] ?? {})
    .map(([grupoId, c]) => ({ grupoId, ...c }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  return suyos[0] ?? null;
}
