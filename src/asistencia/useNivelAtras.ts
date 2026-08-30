import { useEffect, useRef } from 'react';

let contador = 0;

/**
 * Boton "atras" de Android para pantallas internas de asistencia que NO son un cambio
 * de seccion del menu — eso ya lo cubre `useHistorialDeVistas` en `src/hooks/` de MJB.
 * Esto es para el nivel de adentro: la planilla de un grupo, de un evento, de un centro
 * de interes; el mosaico; la ficha de un estudiante; programas → centros → un centro;
 * el cuaderno de direccion y la carga de fotos dentro de un grupo.
 *
 * POR QUE HACIA FALTA: cada una de esas pantallas es solo un `useState` del componente.
 * Para el navegador el usuario nunca se movio — hay una sola entrada de historial, la
 * de cuando entro al menu — asi que el boton atras de Android cerraba la aplicacion en
 * vez de volver a la pantalla anterior. Android hacia lo correcto con lo que sabia.
 *
 * USO:
 *   useNivelAtras(fichaAbierta !== null, () => setFichaAbierta(null));
 *   ...
 *   <Ficha onVolver={atras} ... />        // NO: onVolver={() => setFichaAbierta(null)}
 *
 * El "Volver" propio de la pantalla debe llamar a `atras()` (exportada aparte), nunca
 * cerrar el estado directamente: el cierre real solo ocurre cuando el `popstate`
 * resultante llega al listener de aqui adentro. Asi Android y el boton en pantalla
 * dejan el historial exactamente igual — mismo requisito que ya resolvio
 * `useHistorialDeVistas.ts` de MJB para el nivel 1, aplicado aqui a estado LOCAL de un
 * componente en vez de a una unica vista global compartida.
 *
 * Si una pantalla se cierra por OTRO camino que no es `atras()` (un boton "Guardar" que
 * cierra directo, o `onEliminado` en un evento borrado), la entrada que se habia
 * apilado para ella queda huerfana: este hook la desapila solo, con un
 * `history.back()` silencioso, para que el siguiente atras de Android no se quede
 * "atascado" pidiendo un paso de mas.
 *
 * CLAVE PROPIA: la entrada de historial lleva `asistenciaNivel`, un numero, NUNCA el
 * campo `vista` que usa el hook de MJB. Si compartieran clave, un "atras" aqui adentro
 * se leeria como un cambio de seccion del menu principal y sacaria al usuario de
 * asistencia en vez de cerrar solo esta pantalla.
 */
export function useNivelAtras(abierto: boolean, onCerrar: () => void): void {
  const miToken = useRef<number | null>(null);
  // Ref y no la funcion directa: `onCerrar` casi siempre es una arrow function nueva en
  // cada render, y no debe forzar a desmontar/remontar el listener de `popstate`.
  const onCerrarRef = useRef(onCerrar);
  onCerrarRef.current = onCerrar;

  useEffect(() => {
    function alVolver(e: PopStateEvent) {
      // Esta instancia no tiene nada apilado: el popstate es de otro nivel, no el suyo.
      if (miToken.current === null) return;
      const estado = e.state as { asistenciaNivel?: number } | null;
      // Se volvio a una entrada anterior a la mia: cerrar. Si el token coincide, el
      // popstate es de un nivel MAS ADENTRO que el mio (por ejemplo el mosaico
      // cerrandose dentro de una planilla que sigue abierta) y no me toca reaccionar.
      if (estado?.asistenciaNivel === miToken.current) return;
      miToken.current = null;
      onCerrarRef.current();
    }
    window.addEventListener('popstate', alVolver);
    return () => window.removeEventListener('popstate', alVolver);
  }, []);

  useEffect(() => {
    if (abierto) {
      if (miToken.current !== null) return; // ya apilada
      miToken.current = ++contador;
      window.history.pushState({ asistenciaNivel: miToken.current }, '');
      return;
    }
    if (miToken.current !== null) {
      // Se cerro sin pasar por `atras()`: la entrada apilada quedo huerfana. Se
      // desapila en silencio; `alVolver` no vuelve a llamar a `onCerrar` porque el
      // token ya queda en null ANTES de pedir el `history.back()`.
      miToken.current = null;
      window.history.back();
    }
  }, [abierto]);
}

/**
 * El "Volver" de una pantalla que usa `useNivelAtras`. Nunca cierra el estado
 * directamente: retrocede el historial, y es el `popstate` resultante el que dispara
 * `onCerrar` en el listener de arriba. Es una funcion de modulo, no algo que devuelva
 * el hook: todas las instancias hacen exactamente lo mismo, y cualquiera de ellas debe
 * poder usarla sin tener que ir a buscar cual "le pertenece".
 */
export function atras(): void {
  window.history.back();
}
