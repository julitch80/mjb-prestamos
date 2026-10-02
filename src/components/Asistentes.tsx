import { useEffect, useRef, useState } from 'react';
import { ChevronRight, FileText, Smartphone, X } from 'lucide-react';
import QRCode from 'qrcode';
import {
  OPCIONES_MANUAL, URL_MANUAL_PDF, URL_MANUAL_WORD, urlAbsolutaManualDigital,
} from '../data/manualConvivencia';
import type { OpcionManual } from '../data/manualConvivencia';
import { IconoConvivencia, IconoEvaluacion } from './IconosNeon';
import DocumentoInstitucional from './DocumentoInstitucional';
import ModalPropuestaEscena from './ModalPropuestaEscena';
import { leerMensajeManual, type LaminaDeReferencia } from '../data/propuestaEscena';

// Módulo «Manual de convivencia» (antes «Chatbot»). El id de la vista sigue
// siendo 'asistentes' para no romper la navegación guardada.

type IconoTarjeta = (p: { className?: string; style?: React.CSSProperties }) => React.ReactElement;

const ICONO_OPCION: Record<string, { Icono: IconoTarjeta; color: string }> = {
  convivencia: { Icono: IconoConvivencia as IconoTarjeta, color: '#4ade80' },
  evaluacion: { Icono: IconoEvaluacion as IconoTarjeta, color: '#60a5fa' },
  digital: { Icono: Smartphone as IconoTarjeta, color: '#f472b6' },
  clasico: { Icono: FileText as IconoTarjeta, color: '#fbbf24' },
};

const BOTON = 'text-xs font-medium px-3 py-1.5 rounded-lg bg-elevated border border-line text-soft hover:text-strong transition';
const ENLACE = 'text-xs font-medium text-accent hover:underline';

function TarjetaOpcion({ opcion, onAbrir }: { opcion: OpcionManual; onAbrir: () => void }) {
  const { Icono, color } = ICONO_OPCION[opcion.id];
  return (
    <button
      type="button"
      onClick={onAbrir}
      className="w-full text-left rounded-2xl border border-line bg-card p-5 flex items-start gap-4 min-h-[7.5rem] transition hover:bg-elevated active:bg-hover cursor-pointer"
    >
      <div className="w-14 h-14 flex-shrink-0 rounded-2xl flex items-center justify-center" style={{ background: `${color}1a` }}>
        <Icono className="w-7 h-7" style={{ color }} />
      </div>
      <div className="flex-1 min-w-0 flex flex-col gap-1">
        <h3 className="text-strong text-base font-semibold leading-snug">{opcion.nombre}</h3>
        <p className="text-muted text-xs leading-relaxed">{opcion.descripcion}</p>
      </div>
      <ChevronRight className="w-5 h-5 flex-shrink-0 text-muted self-center" />
    </button>
  );
}

function descargar(href: string, nombre: string) {
  const a = document.createElement('a');
  a.href = href;
  a.download = nombre;
  a.click();
}

function VentanaQR({ onCerrar }: { onCerrar: () => void }) {
  const url = urlAbsolutaManualDigital();
  const [png, setPng] = useState<string | null>(null);
  const [imprimiendo, setImprimiendo] = useState(false);

  useEffect(() => {
    QRCode.toDataURL(url, { errorCorrectionLevel: 'M', width: 1024, margin: 2 }).then(setPng).catch(() => setPng(null));
  }, [url]);

  async function descargarSvg() {
    const svg = await QRCode.toString(url, { type: 'svg', errorCorrectionLevel: 'M', margin: 2 });
    const href = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
    descargar(href, 'qr-manual-convivencia.svg');
    setTimeout(() => URL.revokeObjectURL(href), 1000);
  }

  if (imprimiendo && png) {
    return (
      <DocumentoInstitucional titulo="Manual de convivencia 2026" subtitulo="Versión digital" onCerrar={() => setImprimiendo(false)}>
        <div style={{ textAlign: 'center', marginTop: '1.5cm' }}>
          <img src={png} alt="Código QR del manual digital" style={{ width: '9cm', height: '9cm', margin: '0 auto' }} />
          <p className="doc-inst-parrafo" style={{ textAlign: 'center', fontSize: '14pt', marginTop: '0.6cm' }}>
            Escanee el código para consultar el manual en su celular
          </p>
          <p style={{ textAlign: 'center', fontSize: '9pt', wordBreak: 'break-all' }}>{url}</p>
        </div>
      </DocumentoInstitucional>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={onCerrar}>
      <div className="w-full max-w-sm rounded-2xl bg-card border border-line p-5 flex flex-col gap-3" onClick={e => e.stopPropagation()}>
        <div className="flex items-center">
          <h3 className="text-strong font-semibold flex-1">Código QR — versión digital</h3>
          <button onClick={onCerrar} aria-label="Cerrar" className="p-1 text-muted hover:text-strong"><X size={16} /></button>
        </div>
        {png
          ? <img src={png} alt="Código QR del manual digital" className="w-full rounded-xl bg-white" />
          : <div className="aspect-square rounded-xl bg-elevated animate-pulse" />}
        <input readOnly value={url} onFocus={e => e.currentTarget.select()}
          className="w-full text-xs rounded-lg border border-line bg-elevated px-2 py-1.5 text-soft" />
        <div className="grid grid-cols-3 gap-2">
          <button className={BOTON} disabled={!png} onClick={() => png && descargar(png, 'qr-manual-convivencia.png')}>Descargar PNG</button>
          <button className={BOTON} onClick={() => { void descargarSvg(); }}>Descargar SVG</button>
          <button className={BOTON} disabled={!png} onClick={() => setImprimiendo(true)}>Imprimir</button>
        </div>
      </div>
    </div>
  );
}

function useAnchoMinimo(px: number) {
  const consulta = `(min-width: ${px}px)`;
  const [cumple, setCumple] = useState(() => window.matchMedia(consulta).matches);
  useEffect(() => {
    const mq = window.matchMedia(consulta);
    const cambio = () => setCumple(mq.matches);
    mq.addEventListener('change', cambio);
    return () => mq.removeEventListener('change', cambio);
  }, [consulta]);
  return cumple;
}

const ALTO_IFRAME = { height: 'calc(100vh - 220px)', minHeight: 480 };

function VistaOpcion({ opcion, onVolver }: { opcion: OpcionManual; onVolver: () => void }) {
  const [qr, setQr] = useState(false);
  const escritorio = useAnchoMinimo(768);
  const marco = useRef<HTMLIFrameElement>(null);
  const [propuesta, setPropuesta] = useState<{ despuesDe: LaminaDeReferencia | null } | null>(null);

  // El manual digital, abierto aquí con ?desde=app, muestra «Propón una escena» en la cartilla
  // y avisa por postMessage. Solo se escucha a ESTE marco y a este mismo origen.
  useEffect(() => {
    if (opcion.tipo !== 'digital') return;
    const fn = (ev: MessageEvent) => {
      if (ev.origin !== window.location.origin || ev.source !== marco.current?.contentWindow) return;
      const mensaje = leerMensajeManual(ev.data);
      if (mensaje) setPropuesta(mensaje);
    };
    window.addEventListener('message', fn);
    return () => window.removeEventListener('message', fn);
  }, [opcion.tipo]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3 flex-wrap">
        <button onClick={onVolver} className={BOTON}>← Manual de convivencia</button>
        <h2 className="text-strong text-sm font-semibold flex-1">{opcion.nombre}</h2>
        {opcion.tipo === 'digital' && <button onClick={() => setQr(true)} className={BOTON}>Código QR</button>}
        {opcion.tipo !== 'clasico' && (
          <a href={opcion.url} target="_blank" rel="noopener noreferrer" className={ENLACE}>Abrir en pestaña ↗</a>
        )}
      </div>

      {opcion.tipo === 'clasico' ? (
        <>
          <div className="flex gap-3 flex-wrap">
            <a href={URL_MANUAL_PDF} target="_blank" rel="noopener noreferrer"
              className="min-h-[44px] px-4 rounded-xl bg-accent text-accent-fg text-sm font-semibold flex items-center">
              Ver PDF
            </a>
            <a href={URL_MANUAL_WORD} download="manual-convivencia-2026.docx"
              className="min-h-[44px] px-4 rounded-xl border border-line text-strong text-sm font-semibold flex items-center hover:bg-elevated">
              Descargar Word
            </a>
          </div>
          {escritorio && (
            <iframe src={URL_MANUAL_PDF} title="Manual de convivencia 2026 (PDF)"
              className="w-full rounded-2xl border border-line bg-card" style={ALTO_IFRAME} />
          )}
        </>
      ) : (
        <>
          <iframe ref={marco} src={opcion.tipo === 'digital' ? `${opcion.url}?desde=app` : opcion.url} title={opcion.nombre}
            className="w-full rounded-2xl border border-line bg-card" style={ALTO_IFRAME}
            allow="clipboard-write; microphone" />
          {opcion.tipo === 'chatbot' && <p className="text-muted text-xs">El asistente requiere conexión a internet.</p>}
        </>
      )}

      {qr && <VentanaQR onCerrar={() => setQr(false)} />}
      {propuesta && <ModalPropuestaEscena despuesDe={propuesta.despuesDe} onCerrar={() => setPropuesta(null)} />}
    </div>
  );
}

export default function Asistentes() {
  const [abierto, setAbierto] = useState<string | null>(null);
  const opcion = OPCIONES_MANUAL.find(o => o.id === abierto) ?? null;

  if (opcion) return <VistaOpcion opcion={opcion} onVolver={() => setAbierto(null)} />;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-strong text-lg font-semibold">Manual de convivencia</h2>
        <p className="text-muted text-sm">Escoja cómo quiere consultarlo</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {OPCIONES_MANUAL.map(o => <TarjetaOpcion key={o.id} opcion={o} onAbrir={() => setAbierto(o.id)} />)}
      </div>
    </div>
  );
}
