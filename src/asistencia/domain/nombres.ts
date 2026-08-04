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

function normalizar(s: string): string {
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
