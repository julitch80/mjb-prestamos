import { useEffect, useRef, useState } from 'react';

/**
 * Lector de codigos QR para porteria.
 *
 * Dos motores, en este orden de preferencia:
 * 1. `BarcodeDetector` nativo (Android/Chrome): no descarga nada, es lo que hay en el
 *    Android institucional.
 * 2. `jsqr` como respaldo (Safari/iPhone no trae `BarcodeDetector`). Se importa DE FORMA
 *    DIFERIDA (`import('jsqr')`) para que el archivo solo se descargue cuando alguien
 *    realmente abre el escaner: un docente que solo pasa lista con la planilla nunca lo
 *    baja.
 */
export default function EscanerQr({
  onLeer,
  onCerrar,
}: {
  onLeer: (texto: string) => void;
  onCerrar: () => void;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const lienzo = useRef<HTMLCanvasElement>(null);
  const flujo = useRef<MediaStream | null>(null);
  const intervalo = useRef<ReturnType<typeof setInterval> | null>(null);
  // Ultimo texto leido: mientras la camara sigue enfocando el mismo QR no hay que
  // repetir onLeer veinte veces por el mismo estudiante. Solo se dispara de nuevo si el
  // contenido cambia (otro estudiante) o si se reinicia el escaneo.
  const ultimoLeido = useRef<string | null>(null);
  /** Cuando se disparo el ultimo aviso. Ver la nota de anti-repeticion en `leerCuadro`. */
  const ultimoEn = useRef(0);
  const detectorNativo = useRef<any>(null);

  const [activo, setActivo] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Limpieza al desmontar: parar TODAS las pistas de la camara y el intervalo de
  // lectura. Una camara que se queda encendida es bateria que se vacia y una luz que no
  // se apaga en el telefono de porteria.
  useEffect(() => {
    return () => {
      if (intervalo.current) clearInterval(intervalo.current);
      flujo.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  // La camara se pide SOLO tras el toque de "Activar camara", nunca en el montaje: en
  // iOS/Safari, getUserMedia sin un gesto explicito del usuario queda bloqueado en
  // silencio y la pantalla se queda negra sin explicacion.
  async function activarCamara() {
    setError(null);
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false,
      });
      flujo.current = s;
      if (video.current) video.current.srcObject = s;
      setActivo(true);
      iniciarLectura();
    } catch {
      setError(
        'No fue posible activar la camara. Puede registrar buscando al estudiante por nombre.',
      );
    }
  }

  function iniciarLectura() {
    if ('BarcodeDetector' in window) {
      // Detector nativo: soportado en el Android institucional (Chrome). No hace falta
      // descargar ninguna libreria.
      detectorNativo.current = new (window as any).BarcodeDetector({ formats: ['qr_code'] });
    }
    intervalo.current = setInterval(() => void leerCuadro(), 200);
  }

  async function leerCuadro() {
    const v = video.current;
    if (!v || v.readyState < 2) return; // aun no hay video decodificado

    let texto: string | null = null;

    if (detectorNativo.current) {
      try {
        const codigos = await detectorNativo.current.detect(v);
        texto = codigos[0]?.rawValue ?? null;
      } catch {
        // El detector nativo puede fallar cuadro a cuadro (p. ej. video en blanco al
        // arrancar); se ignora y se reintenta en el siguiente intervalo.
        return;
      }
    } else {
      // Respaldo para iPhone: se descarga jsqr solo la primera vez que hace falta.
      const { default: jsQR } = await import('jsqr');
      const c = lienzo.current;
      if (!c) return;
      c.width = v.videoWidth;
      c.height = v.videoHeight;
      const ctx = c.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(v, 0, 0, c.width, c.height);
      const datos = ctx.getImageData(0, 0, c.width, c.height);
      const resultado = jsQR(datos.data, datos.width, datos.height);
      texto = resultado?.data ?? null;
    }

    if (!texto) return;

    // Anti-repeticion POR TIEMPO, no por "salio de cuadro".
    //
    // La version anterior olvidaba el ultimo codigo en cuanto un cuadro salia borroso, y
    // con la mano en movimiento eso ocurre a cada momento: el mismo QR volvia a dispararse
    // cinco veces por segundo, con su consulta a Firestore cada vez. Con una espera fija
    // el parpadeo deja de importar, y el mismo codigo se puede reintentar a proposito
    // pasados dos segundos (p. ej. tras un aviso de "otra sede").
    const ahora = Date.now();
    const esOtro = texto !== ultimoLeido.current;
    const paso = ahora - ultimoEn.current > 2000;
    if (esOtro || paso) {
      ultimoLeido.current = texto;
      ultimoEn.current = ahora;
      onLeer(texto);
    }
  }

  function cerrar() {
    if (intervalo.current) clearInterval(intervalo.current);
    flujo.current?.getTracks().forEach((t) => t.stop());
    onCerrar();
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black">
      <div className="flex items-center justify-between p-3">
        <span className="text-sm font-medium text-white">Escanear código QR</span>
        <button
          onClick={cerrar}
          className="rounded-lg border border-line px-3 py-1.5 text-sm text-strong"
        >
          Cerrar
        </button>
      </div>

      <div className="relative flex grow items-center justify-center overflow-hidden">
        {error ? (
          <div className="mx-4 rounded-xl border border-danger-soft bg-danger-soft p-3 text-sm text-danger-soft-fg">
            {error}
          </div>
        ) : !activo ? (
          <button
            onClick={() => void activarCamara()}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-fg"
          >
            Activar cámara
          </button>
        ) : null}

        {/*
          El video se monta siempre (oculto tras el error/boton con opacidad) para que
          la ref exista antes de pedir la camara. `playsInline` + `muted` + `autoPlay`
          son obligatorios en iOS: sin ellos Safari abre el video a pantalla completa
          nativa y el bucle de lectura deja de ver el <video> del DOM.
        */}
        <video
          ref={video}
          playsInline
          muted
          autoPlay
          className={`h-full w-full object-cover ${activo ? '' : 'hidden'}`}
        />

        {activo && (
          <div className="pointer-events-none absolute inset-0 grid place-items-center">
            <div className="h-56 w-56 rounded-2xl border-4 border-dashed border-white/80" />
          </div>
        )}
      </div>

      {/* Lienzo oculto: solo se usa como superficie intermedia para leer pixeles con jsqr. */}
      <canvas ref={lienzo} className="hidden" />
    </div>
  );
}
