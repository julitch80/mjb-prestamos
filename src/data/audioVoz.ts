// Grabación de notas de voz para el chat interno, con conversión a MP3 en el
// navegador (Etapa 2 del chat).
//
// EL PROBLEMA QUE RESUELVE ESTE ARCHIVO: MediaRecorder graba en el formato
// nativo de cada plataforma — `audio/mp4` en Safari/iOS, `audio/webm;codecs=
// opus` en Chrome/Android — y Safari en iOS NO puede reproducir webm. Si se
// guardara el formato nativo tal cual, las notas grabadas en Android serían
// inaudibles en iPhone. Por eso TODA nota de voz se convierte a MP3 antes de
// subirse: MP3 se reproduce en todas las plataformas.
//
// CÓMO FUNCIONA LA CONVERSIÓN EN AMBOS SENTIDOS: `AudioContext.decodeAudioData`
// no decodifica MP3/webm/mp4 "en general" — decodifica lo que el propio
// navegador sabe reproducir. Como cada grabación se decodifica en el MISMO
// navegador que la produjo (iOS decodifica su propio mp4, Chrome decodifica su
// propio webm), la conversión a MP3 funciona igual en los dos lados aunque el
// formato de origen sea distinto. No hace falta detectar el formato: solo se
// codifica la salida.
import lamejs from '@breezystack/lamejs';

export const DURACION_MAXIMA_SEG = 5 * 60; // corte automático a los 5 minutos

/** Comprueba que el navegador soporte grabación de audio. */
export function grabadoraSoportada(): boolean {
  return Boolean(
    typeof navigator !== 'undefined' &&
      navigator.mediaDevices &&
      typeof navigator.mediaDevices.getUserMedia === 'function' &&
      typeof (window as any).MediaRecorder === 'function',
  );
}

const MIME_CANDIDATOS = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'];

function elegirMimeType(): string {
  for (const mime of MIME_CANDIDATOS) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(mime)) return mime;
  }
  throw new Error('Este navegador no puede grabar audio en un formato compatible.');
}

/** Convierte un Float32Array (rango -1..1) a Int16Array (PCM 16 bits). */
function float32AInt16(entrada: Float32Array): Int16Array {
  const salida = new Int16Array(entrada.length);
  for (let i = 0; i < entrada.length; i++) {
    const s = Math.max(-1, Math.min(1, entrada[i]));
    salida[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return salida;
}

// MP3 solo admite un conjunto cerrado de frecuencias de muestreo. La que
// reporta el micrófono del dispositivo no siempre es una de ellas, y pasarle a
// lamejs una frecuencia no admitida produce un archivo corrupto o con el tono
// alterado. Por eso todo se remuestrea a 44,1 kHz mono antes de codificar:
// OfflineAudioContext hace el remuestreo y la mezcla a un canal de una vez.
const SAMPLE_RATE_MP3 = 44100;

async function aMonoRemuestreado(buffer: AudioBuffer): Promise<Float32Array> {
  if (buffer.sampleRate === SAMPLE_RATE_MP3 && buffer.numberOfChannels === 1) {
    return buffer.getChannelData(0);
  }
  const muestras = Math.max(1, Math.ceil(buffer.duration * SAMPLE_RATE_MP3));
  const offline = new OfflineAudioContext(1, muestras, SAMPLE_RATE_MP3);
  const fuente = offline.createBufferSource();
  fuente.buffer = buffer;
  fuente.connect(offline.destination);
  fuente.start();
  const renderizado = await offline.startRendering();
  return renderizado.getChannelData(0);
}

/** Codifica PCM mono Int16 a MP3 (48 kbps: de sobra para voz, archivos pequeños). */
function codificarMp3(pcm: Int16Array, sampleRate: number): Blob {
  const encoder = new lamejs.Mp3Encoder(1, sampleRate, 48);
  const partes: Uint8Array[] = [];
  const BLOQUE = 1152;
  for (let i = 0; i < pcm.length; i += BLOQUE) {
    const trozo = pcm.subarray(i, i + BLOQUE);
    const mp3buf = encoder.encodeBuffer(trozo);
    if (mp3buf.length > 0) partes.push(mp3buf);
  }
  const final = encoder.flush();
  if (final.length > 0) partes.push(final);
  return new Blob(partes as BlobPart[], { type: 'audio/mpeg' });
}

export type Grabadora = {
  /** Pide el micrófono e inicia la grabación. */
  iniciar: () => Promise<void>;
  /** Detiene la grabación, libera el micrófono y devuelve el Blob MP3 + duración. */
  detener: () => Promise<{ blob: Blob; duracionSeg: number }>;
  /** Cancela la grabación en curso y libera el micrófono sin devolver nada. */
  cancelar: () => void;
};

/** Crea una grabadora de notas de voz que produce MP3 al detenerse. */
export function crearGrabadora(onCorteAutomatico?: () => void): Grabadora {
  let stream: MediaStream | null = null;
  let recorder: MediaRecorder | null = null;
  let chunks: BlobPart[] = [];
  let inicioMs = 0;
  let corteTimer: ReturnType<typeof setTimeout> | null = null;

  function liberarMicrofono() {
    stream?.getTracks().forEach((t) => t.stop());
    stream = null;
    if (corteTimer) {
      clearTimeout(corteTimer);
      corteTimer = null;
    }
  }

  return {
    async iniciar() {
      if (!grabadoraSoportada()) {
        throw new Error('Este dispositivo no permite grabar notas de voz.');
      }
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = elegirMimeType();
      recorder = new MediaRecorder(stream, { mimeType });
      chunks = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };
      recorder.start();
      inicioMs = Date.now();
      corteTimer = setTimeout(() => {
        onCorteAutomatico?.();
      }, DURACION_MAXIMA_SEG * 1000);
    },

    async detener() {
      if (!recorder) throw new Error('No hay ninguna grabación en curso.');
      const mimeType = recorder.mimeType;
      const duracionSeg = Math.round((Date.now() - inicioMs) / 1000);

      const blobNativo: Blob = await new Promise((resolve) => {
        recorder!.onstop = () => resolve(new Blob(chunks, { type: mimeType }));
        recorder!.stop();
      });
      liberarMicrofono();

      const arrayBuffer = await blobNativo.arrayBuffer();
      const audioCtx = new AudioContext();
      let audioBuffer: AudioBuffer;
      try {
        audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
      } finally {
        audioCtx.close().catch(() => {});
      }
      const mono = await aMonoRemuestreado(audioBuffer);
      const blob = codificarMp3(float32AInt16(mono), SAMPLE_RATE_MP3);

      return { blob, duracionSeg };
    },

    cancelar() {
      try {
        recorder?.stop();
      } catch {
        // ya estaba detenida; no importa.
      }
      liberarMicrofono();
    },
  };
}
