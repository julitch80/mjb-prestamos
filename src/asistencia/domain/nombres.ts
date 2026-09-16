/**
 * Master2000 exporta la columna NOMBRES con el nombre COMPLETO —apellidos incluidos—,
 * no solo los nombres de pila. Al juntarlo con la columna APELLIDOS el resultado es
 * "ARBOLEDA ASPRILLA, ARBOLEDA ASPRILLA SAMANTHA".
 *
 * Esto recorta el apellido repetido, y lo hace con una regla ESTRECHA a proposito: solo
 * actua cuando el campo de nombres empieza exactamente por el de apellidos. Una regla
 * mas lista (quitar las dos primeras palabras, por ejemplo) destrozaria los casos
 * reales: apellidos compuestos, un solo apellido, nombres que coinciden con apellidos.
 *
 * Se aplica al MOSTRAR y no al importar, para que el dato guardado siga siendo el que
 * vino de Master2000 y se pueda volver a leer si algun dia la exportacion cambia.
 */

/**
 * Exportada el 2026-09-16 para el emparejamiento de correos de Workspace: dos criterios
 * de normalizacion conviviendo en el modulo son una fuente de errores silenciosos.
 */
export function normalizar(s: string): string {
  return (s ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Devuelve solo los nombres de pila. Si no detecta repeticion, devuelve el original
 * tal cual: ante la duda, mostrar de mas antes que borrar el nombre de alguien.
 */
export function nombresDePila(apellidos: string, nombres: string): string {
  const ap = normalizar(apellidos);
  const nom = normalizar(nombres);
  if (!ap || !nom) return (nombres ?? '').trim();

  // Debe empezar por el apellido Y seguir con un espacio: sin eso, "ARBOLEDA" recortaria
  // el nombre de una estudiante llamada "ARBOLEDANA".
  if (!nom.startsWith(ap + ' ')) return (nombres ?? '').trim();

  const restante = (nombres ?? '').trim().slice(apellidos.trim().length).trim();
  // Si al recortar no queda nada, el campo era solo el apellido: mejor dejarlo entero
  // que mostrar una fila sin nombre.
  return restante || (nombres ?? '').trim();
}

/** "Apellidos, Nombres" ya sin la repeticion. */
export function nombreCompleto(e: { apellidos: string; nombres: string }): string {
  return `${e.apellidos}, ${nombresDePila(e.apellidos, e.nombres)}`;
}

/**
 * Iniciales para el avatar sin foto. Tambien tiene que pasar por `nombresDePila`: si no,
 * el estudiante cuyo campo de nombres repite el apellido sale con la misma letra dos
 * veces ("BB" en vez de "BS").
 */
export function iniciales(e: { apellidos: string; nombres: string }): string {
  const pila = nombresDePila(e.apellidos, e.nombres);
  return (pila[0] ?? '').toUpperCase() + (e.apellidos[0] ?? '').toUpperCase();
}

// ---------------------------------------------------------------------------
//  Orden de lista: uno solo para todo el modulo (2026-09-09)
// ---------------------------------------------------------------------------
//
// EL ORDEN DE LISTA ES POR APELLIDOS, SIEMPRE Y EN TODAS PARTES. Un docente busca a un
// estudiante recorriendo la columna con el dedo; si una pantalla ordena distinto que
// otra, deja de poder hacerlo y tiene que leer los treinta y tres nombres.
//
// POR QUE UNA FUNCION Y NO UN `sort` EN CADA SITIO. Habia tres criterios distintos
// repartidos por el modulo, escritos a mano cada vez. Se comprobo el 2026-09-09 con
// nombres ficticios de los rasgos reales del colegio (mayusculas mezcladas, tildes, eñes,
// particulas como "de la") y los tres coincidian, asi que NO habia ningun desorden a la
// vista: esto no arregla un fallo, cierra la puerta a que aparezca uno el dia que alguien
// toque uno de los tres y no los otros dos.
//
// `'es'` explicito y `sensitivity: 'base'`: sin locale, el orden lo decide la
// configuracion del telefono de cada docente —el mismo grupo saldria distinto en dos
// aparatos—, y sin `base` la tilde y la mayuscula separan a "PATIÑO" de "PATINO", que
// para una lista de clase son la misma persona escrita de dos maneras.
//
// ⚠️ EL ORDEN SE APLICA AL PINTAR, NUNCA REESCRIBIENDO EL DATO GUARDADO. Los inscritos de
// un centro (`grupo.miembros`) y los integrantes de un evento (`evento.miembros`) son
// CONJUNTOS: se escriben con `arrayUnion`, que añade al final. Ordenar ese arreglo en
// Firestore seria pelearse con `arrayUnion` en cada inscripcion y, peor, convertiria una
// lista compartida en algo que dos personas reescriben a la vez.

/** El criterio unico: apellidos y, a igualdad, nombres. */
export function compararEstudiantes(
  a: { apellidos: string; nombres: string },
  b: { apellidos: string; nombres: string },
): number {
  return nombreCompleto(a).localeCompare(nombreCompleto(b), 'es', { sensitivity: 'base' });
}

/**
 * La lista en orden de lista. Devuelve una copia: quien la llama suele recibir un arreglo
 * que viene de `useState` o de props, y ordenarlo en el sitio mutaria algo de React.
 */
export function ordenarEstudiantes<T extends { apellidos: string; nombres: string }>(
  lista: T[],
): T[] {
  return [...lista].sort(compararEstudiantes);
}
