/**
 * Rastreador del estado de envio de las escrituras de asistencia.
 *
 * El problema que resuelve: `updateDoc` de Firestore no se resuelve hasta que el
 * SERVIDOR confirma. Con la cache local activada la escritura ya quedo aplicada en el
 * telefono al instante, asi que esperar esa promesa antes de reaccionar en pantalla deja
 * la casilla muerta sin razon — sobre todo sin señal, donde el acuse puede tardar horas.
 *
 * Este modulo no encola nada (Firestore ya reintenta las escrituras solas): solo cuenta
 * cuantas estan en vuelo y guarda el ultimo rechazo, para que la interfaz pueda mostrar
 * "se esta enviando" o "esto no se guardo" sin bloquear al docente mientras tanto.
 */

export interface EstadoSync {
  enLinea: boolean;
  /** Escrituras ya aplicadas en el cliente pero aun sin acuse del servidor. */
  pendientes: number;
  /** Mensaje del ultimo rechazo del servidor, o null si no hay ninguno pendiente de ver. */
  ultimoError: string | null;
}

const suscriptores = new Set<(e: EstadoSync) => void>();

const estado: EstadoSync = {
  // navigator.onLine no existe (o no es booleano) fuera del navegador real: Node trae un
  // `navigator` global sin ese campo, y en las pruebas con vitest eso no debe leerse como
  // "sin conexion". Se asume en linea si no hay como saberlo con certeza.
  enLinea: typeof navigator === 'object' && typeof navigator.onLine === 'boolean' ? navigator.onLine : true,
  pendientes: 0,
  ultimoError: null,
};

function avisar(): void {
  const copia = { ...estado };
  for (const fn of suscriptores) fn(copia);
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    estado.enLinea = true;
    avisar();
  });
  window.addEventListener('offline', () => {
    estado.enLinea = false;
    avisar();
  });
}

/**
 * ¿Hay señal ahora mismo?
 *
 * Se usa para decidir si una escritura se ESPERA o se lanza sin esperar. La diferencia no
 * es de estilo: `setDoc` no resuelve hasta que el SERVIDOR confirma, asi que esperarla sin
 * señal cuelga la pantalla indefinidamente. Con señal se espera, porque el error inmediato
 * es lo que permite distinguir "ya existia" de "no tiene permiso".
 *
 * `navigator.onLine` miente en un solo sentido: puede decir que hay red cuando la red no
 * llega a ninguna parte (wifi del colegio sin salida). Eso NO rompe nada aqui: se toma el
 * camino de esperar, y si el acuse no llega, la escritura ya quedo aplicada en local y
 * Firestore la reintenta sola. Al reves —decir que no hay red cuando si la hay— es lo que
 * si haria daño, y `navigator.onLine` no se equivoca en esa direccion.
 */
export function hayConexion(): boolean {
  return estado.enLinea;
}

/** Se suscribe a los cambios. Devuelve la funcion para darse de baja. */
export function observarSync(fn: (e: EstadoSync) => void): () => void {
  suscriptores.add(fn);
  fn({ ...estado });
  return () => {
    suscriptores.delete(fn);
  };
}

/**
 * Envuelve una escritura: la cuenta como pendiente, la descuenta al confirmarse y
 * registra el error si el servidor la rechaza. NO se espera a que termine — quien llama
 * ya siguio adelante con la escritura aplicada localmente.
 */
export function registrarEnvio(promesa: Promise<unknown>): void {
  estado.pendientes += 1;
  avisar();

  promesa
    .then(() => {
      estado.pendientes = Math.max(0, estado.pendientes - 1);
      avisar();
    })
    .catch((e: unknown) => {
      estado.pendientes = Math.max(0, estado.pendientes - 1);
      // Un rechazo no se puede tragar en silencio: la marca desaparecio sin que nadie
      // se entere si nadie lee este campo.
      estado.ultimoError = e instanceof Error ? e.message : String(e);
      avisar();
    });
}

/** Descarta el ultimo error ya mostrado, para que no quede pegado en pantalla. */
export function limpiarUltimoError(): void {
  estado.ultimoError = null;
  avisar();
}
