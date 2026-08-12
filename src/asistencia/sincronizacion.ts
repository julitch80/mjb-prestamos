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
