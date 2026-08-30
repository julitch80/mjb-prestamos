import { useEffect, useRef } from 'react';
import { useAppStore } from '../data/store';
import type { VistaActual } from '../data/store';

/**
 * Conecta la navegación de la app con el historial del navegador.
 *
 * POR QUÉ EXISTE: toda la navegación vive en `vistaActual` (Zustand), así que para el
 * navegador el usuario NUNCA se movió — hay una sola entrada en el historial, la de
 * cuando abrió la app. Por eso el botón atrás de Android cerraba la aplicación en vez
 * de volver a la pantalla anterior: Android hacía lo correcto con lo que sabía.
 *
 * Aquí se le cuenta. Cada cambio de sección añade una entrada, y `popstate` restaura
 * la anterior.
 *
 * ALCANCE: solo las secciones de primer nivel (las del menú). Las pantallas internas
 * —el detalle de un caso, los submenús de Gestión del Riesgo, las planillas de
 * asistencia— llevan su propio estado dentro de cada componente y no participan
 * todavía. Ver docs/navegacion-boton-atras.md.
 *
 * En iPhone cambia poco: una PWA instalada en iOS no tiene botón atrás.
 */
export function useHistorialDeVistas() {
  const vistaActual = useAppStore(s => s.vistaActual);
  const setVistaActual = useAppStore(s => s.setVistaActual);

  // Distingue "el usuario pulsó atrás" de "el usuario tocó el menú". Sin esta marca,
  // restaurar la vista desde popstate volvería a apilar una entrada y el botón atrás
  // no avanzaría nunca hacia afuera: quedaría rebotando en la misma pantalla.
  const vieneDelHistorial = useRef(false);
  const esPrimeraVez = useRef(true);

  useEffect(() => {
    const alVolver = (e: PopStateEvent) => {
      const vista = (e.state as { vista?: VistaActual } | null)?.vista;
      // Sin `vista` en el estado, la entrada no es nuestra (por ejemplo la que existía
      // antes de montar el hook): no se toca nada y el navegador sigue su curso, que
      // desde Inicio significa salir de la app. Ese es el comportamiento esperado.
      if (!vista) return;
      vieneDelHistorial.current = true;
      setVistaActual(vista);
    };
    window.addEventListener('popstate', alVolver);
    return () => window.removeEventListener('popstate', alVolver);
  }, [setVistaActual]);

  useEffect(() => {
    if (esPrimeraVez.current) {
      esPrimeraVez.current = false;
      // replaceState y no pushState: la primera vista no es un paso nuevo, es donde ya
      // estaba. Apilarla obligaría a pulsar atrás dos veces para salir desde Inicio.
      window.history.replaceState({ vista: vistaActual }, '');
      return;
    }
    if (vieneDelHistorial.current) {
      vieneDelHistorial.current = false;
      return;
    }
    window.history.pushState({ vista: vistaActual }, '');
  }, [vistaActual]);
}
