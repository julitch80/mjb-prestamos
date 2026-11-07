// Consultas de la familia desde la agenda pública y ayuda «Cómo enviar». Ver consultas.ts.
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { ETIQUETA_CONSULTA, MAX_CONTACTO, MAX_TEXTO_CONSULTA, type ConsultaFamilia, type TipoConsulta } from '../../data/planCasa/consultas';
import { enviarConsulta, misConsultas } from '../../data/planCasa/consultasCliente';
import { TOPE_BYTES } from '../../data/planCasa/entregas';

function Modal({ titulo, subtitulo, onCerrar, children }: { titulo: string; subtitulo?: string; onCerrar: () => void; children: ReactNode }) {
  const cierre = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    cierre.current?.focus();
    const f = (e: KeyboardEvent) => { if (e.key === 'Escape') onCerrar(); };
    window.addEventListener('keydown', f);
    return () => window.removeEventListener('keydown', f);
  }, [onCerrar]);
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50" onClick={onCerrar}>
      <div role="dialog" aria-modal="true" aria-label={titulo} onClick={e => e.stopPropagation()}
        className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl border border-line bg-card p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 className="text-xl font-bold text-strong">{titulo}</h2>
            {subtitulo && <p className="text-sm text-soft">{subtitulo}</p>}
          </div>
          <button ref={cierre} onClick={onCerrar} aria-label="Cerrar" className="min-h-[44px] min-w-[44px] rounded-xl border border-line bg-card text-strong flex items-center justify-center">
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

const fechaHora = (ms: number) => new Date(ms).toLocaleString('es-CO', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

function ModalConsulta({ tipo, token, onCerrar }: { tipo: TipoConsulta; token: string; onCerrar: () => void }) {
  const info = ETIQUETA_CONSULTA[tipo];
  const [texto, setTexto] = useState('');
  const [contacto, setContacto] = useState('');
  const [fase, setFase] = useState<'editando' | 'enviando' | 'ok'>('editando');
  const [error, setError] = useState('');
  const [previas, setPrevias] = useState<ConsultaFamilia[]>([]);
  const cargar = () => { if (token) misConsultas(token).then(setPrevias); };
  useEffect(cargar, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  async function enviar() {
    setError('');
    if (!token) { setError('Esto es un ejemplo: aquí no se envían consultas. En su agenda real sí.'); return; }
    if (!texto.trim()) { setError('Escriba su consulta.'); return; }
    setFase('enviando');
    const r = await enviarConsulta(token, tipo, texto, contacto);
    if (!r.ok) { setError(r.error ?? 'No se pudo enviar.'); setFase('editando'); return; }
    setTexto(''); setFase('ok'); cargar();
  }
  const delTipo = previas.filter(c => c.tipo === tipo);
  const campo = 'w-full rounded-xl border border-line bg-card px-3 text-base text-strong';
  return (
    <Modal titulo={`${info.icono} ${info.titulo}`} subtitulo={info.ayuda} onCerrar={onCerrar}>
      {!token && <p className="rounded-xl border border-warning/40 bg-warning/10 p-3 text-sm text-strong">Esto es un ejemplo: aquí no se envían consultas.</p>}
      {fase === 'ok' ? (
        <div className="space-y-2">
          <p role="status" className="rounded-xl border border-success/40 bg-success/10 p-3 text-base text-strong">¡Listo! Recibimos su consulta. La respuesta aparecerá aquí abajo, en «Mis consultas».</p>
          <button onClick={() => setFase('editando')} className="min-h-[44px] px-4 rounded-xl border border-line text-soft text-base font-semibold">Hacer otra consulta</button>
        </div>
      ) : (
        <div className="space-y-2">
          <label className="block text-sm font-semibold text-strong">Su consulta
            <textarea value={texto} onChange={e => setTexto(e.target.value.slice(0, MAX_TEXTO_CONSULTA))} rows={5} maxLength={MAX_TEXTO_CONSULTA}
              className={`${campo} py-2 mt-1 font-normal`} placeholder="Cuéntenos qué pasa, con sus palabras." />
            <span className="block text-xs text-muted font-normal text-right">{texto.length}/{MAX_TEXTO_CONSULTA}</span>
          </label>
          <label className="block text-sm font-semibold text-strong">Celular o correo (opcional)
            <input value={contacto} onChange={e => setContacto(e.target.value.slice(0, MAX_CONTACTO))} className={`${campo} min-h-[44px] mt-1 font-normal`} placeholder="Para contactarlo si hace falta" />
          </label>
          {error && <p role="alert" className="text-base text-red-600 dark:text-red-400">{error}</p>}
          <button onClick={enviar} disabled={fase === 'enviando'}
            className="min-h-[44px] px-5 rounded-xl bg-accent/20 border border-accent/60 text-strong text-base font-semibold disabled:opacity-60">
            {fase === 'enviando' ? 'Enviando…' : 'Enviar'}
          </button>
        </div>
      )}
      {delTipo.length > 0 && (
        <div className="space-y-2 pt-2 border-t border-line">
          <h3 className="text-base font-semibold text-strong">Mis consultas</h3>
          {delTipo.map(c => (
            <div key={c.id} className="rounded-xl border border-line bg-elevated/60 p-3 space-y-1">
              <p className="text-xs text-muted">{fechaHora(c.creada)} · {c.estado === 'respondida' ? 'Respondida' : 'Pendiente'}</p>
              <p className="text-sm text-strong whitespace-pre-wrap">{c.texto}</p>
              {c.respuesta && <p className="rounded-lg bg-success/10 border border-success/30 p-2 text-sm text-strong whitespace-pre-wrap"><strong>Respuesta:</strong> {c.respuesta}</p>}
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}

/** Dos botones de la cabecera de la agenda (con token vacío = demostración). */
export function BotonesConsulta({ token }: { token: string }) {
  const [abierta, setAbierta] = useState<TipoConsulta | null>(null);
  const clase = 'inline-flex items-center gap-1 min-h-[40px] px-3 rounded-full border border-sky-500/40 bg-sky-500/10 text-sm font-semibold text-strong';
  return (
    <>
      {(['pedagogica', 'tecnica'] as const).map(t => (
        <button key={t} onClick={() => setAbierta(t)} className={clase}>{ETIQUETA_CONSULTA[t].icono} {ETIQUETA_CONSULTA[t].titulo}</button>
      ))}
      {abierta && <ModalConsulta tipo={abierta} token={token} onCerrar={() => setAbierta(null)} />}
    </>
  );
}

/** Botoncito «ℹ️ Cómo enviar» junto a los botones de entrega. */
export function ComoEnviar() {
  const [abierto, setAbierto] = useState(false);
  const mb = Math.round(TOPE_BYTES / 1048576);
  return (
    <>
      <button onClick={() => setAbierto(true)} aria-label="Cómo enviar la entrega"
        className="inline-flex items-center justify-center gap-1.5 min-h-[44px] px-4 rounded-xl text-base font-semibold border border-sky-500/40 bg-sky-500/10 text-strong">
        ℹ️ Cómo enviar
      </button>
      {abierto && (
        <Modal titulo="ℹ️ Cómo enviar su entrega" onCerrar={() => setAbierto(false)}>
          <ul className="space-y-2 text-sm text-soft list-disc pl-5">
            <li><strong className="text-strong">Se aceptan:</strong> fotos (JPG, PNG, HEIC), audio, PDF y documentos de Word, PowerPoint, Excel u ODT.</li>
            <li><strong className="text-strong">Tamaño máximo:</strong> {mb} MB por archivo.</li>
            <li><strong className="text-strong">Videos:</strong> no se suben aquí. Súbalo a Google Drive o YouTube, compártalo como «Cualquier persona con el enlace» y péguelo con «Pegar enlace (video)».</li>
            <li><strong className="text-strong">PDF escaneado muy pesado:</strong> envíelo en partes o como fotos.</li>
            <li><strong className="text-strong">Consejos para la foto:</strong> buena luz, la hoja completa y derecha, una página por foto.</li>
            <li>Si sale un error, use «🛠️ Consulta técnica» en la parte de arriba de la agenda.</li>
          </ul>
        </Modal>
      )}
    </>
  );
}
