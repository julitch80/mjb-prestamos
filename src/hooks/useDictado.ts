import { useCallback, useRef, useState } from 'react';

// Web Speech API (SpeechRecognition) — transcripción en el navegador, sin
// backend ni costo. Buen soporte en Chrome/Android; irregular en Safari/iOS
// (por eso el botón de micrófono es un complemento del textarea, nunca su
// único modo de entrada: si no hay soporte, simplemente no aparece).
interface SpeechRecognitionResultLike {
  transcript: string;
}
interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: ArrayLike<ArrayLike<SpeechRecognitionResultLike> & { isFinal: boolean }>;
}
interface SpeechRecognitionLike extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((ev: SpeechRecognitionEventLike) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
}

function obtenerConstructor(): (new () => SpeechRecognitionLike) | null {
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function dictadoDisponible(): boolean {
  return obtenerConstructor() !== null;
}

/** Dictado por voz: acumula el texto reconocido y lo entrega vía `onTexto`
 * (para que quien llama decida si reemplaza o concatena). */
export function useDictado(onTexto: (texto: string) => void) {
  const [grabando, setGrabando] = useState(false);
  const reconocedorRef = useRef<SpeechRecognitionLike | null>(null);

  const iniciar = useCallback(() => {
    const Ctor = obtenerConstructor();
    if (!Ctor) return;
    const r = new Ctor();
    r.lang = 'es-CO';
    r.continuous = true;
    r.interimResults = false;
    r.onresult = (ev) => {
      let texto = '';
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        texto += ev.results[i][0].transcript;
      }
      if (texto.trim()) onTexto(texto.trim());
    };
    r.onerror = () => setGrabando(false);
    r.onend = () => setGrabando(false);
    reconocedorRef.current = r;
    r.start();
    setGrabando(true);
  }, [onTexto]);

  const detener = useCallback(() => {
    reconocedorRef.current?.stop();
    setGrabando(false);
  }, []);

  return { grabando, iniciar, detener, disponible: dictadoDisponible() };
}
