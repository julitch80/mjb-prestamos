// Ficha «Narra la escena que quieres que aparezca» (cartilla ilustrada del manual).
// La abre Asistentes cuando el manual digital, en su marco, avisa con postMessage.
// Entra al buzón de sugerencias existente; ver src/data/propuestaEscena.ts.
import { useState } from 'react';
import { X } from 'lucide-react';
import { useAppStore } from '../data/store';
import { crearSugerencia } from '../data/api';
import { useDictado } from '../hooks/useDictado';
import {
  faltantesPropuesta, PROPUESTA_VACIA, textoSugerenciaEscena,
  type LaminaDeReferencia, type PropuestaEscena,
} from '../data/propuestaEscena';

type Campo = keyof typeof PROPUESTA_VACIA;

// Topes de largo: la sugerencia viaja por GET (api.ts, callApi) junto con el idToken, y la
// URL aguanta unos 8 KB. Con estos topes el texto completo queda por debajo de ~2.000 caracteres.
const MAX: Record<Campo, number> = { tema: 150, queOcurre: 900, aprendizaje: 250, lugar: 120, personajes: 150, grados: 80 };

const CAMPOS: { id: Campo; etiqueta: string; ayuda: string; filas: number; opcional?: boolean }[] = [
  { id: 'tema', etiqueta: '¿Qué parte del manual falta en las láminas?', ayuda: 'Ej.: el uso del celular en clase', filas: 1 },
  { id: 'queOcurre', etiqueta: '¿Qué pasa en la escena?', ayuda: 'Cuéntala como se la contarías a los niños', filas: 4 },
  { id: 'aprendizaje', etiqueta: '¿Qué debería entender el niño al verla?', ayuda: 'Una frase', filas: 2 },
  { id: 'lugar', etiqueta: '¿Dónde pasa?', ayuda: 'El salón, el patio, la tienda escolar…', filas: 1, opcional: true },
  { id: 'personajes', etiqueta: '¿Quiénes aparecen?', ayuda: 'Pueden ser los personajes de la cartilla', filas: 1, opcional: true },
  { id: 'grados', etiqueta: '¿Para qué grados?', ayuda: 'Transición, 1º a 3º, 4º y 5º…', filas: 1, opcional: true },
];

const CAJA = 'w-full rounded-xl border border-line bg-elevated px-3 py-2 text-sm text-strong placeholder:text-muted';

function CampoConDictado({ etiqueta, ayuda, filas, opcional, maximo, valor, onCambio, onDictado }: {
  etiqueta: string; ayuda: string; filas: number; opcional?: boolean; maximo: number; valor: string;
  onCambio: (v: string) => void;
  /** Estable y con actualización funcional: el reconocedor guarda la función con que arrancó. */
  onDictado: (t: string) => void;
}) {
  const dictado = useDictado(onDictado);
  return (
    <label className="flex flex-col gap-1">
      <span className="flex items-center gap-2">
        <span className="text-sm font-medium text-strong flex-1">
          {etiqueta}{opcional && <span className="text-muted font-normal"> (opcional)</span>}
        </span>
        {dictado.disponible && (
          <button
            type="button"
            onClick={dictado.grabando ? dictado.detener : dictado.iniciar}
            className={`text-xs px-2.5 py-1 rounded-lg border transition ${
              dictado.grabando ? 'border-danger text-danger bg-danger-soft animate-pulse' : 'border-line text-muted hover:bg-hover'
            }`}
          >
            {dictado.grabando ? '● Grabando…' : '🎤 Narrar'}
          </button>
        )}
      </span>
      {filas > 1
        ? <textarea rows={filas} value={valor} maxLength={maximo} placeholder={ayuda} onChange={e => onCambio(e.target.value)} className={CAJA} />
        : <input value={valor} maxLength={maximo} placeholder={ayuda} onChange={e => onCambio(e.target.value)} className={CAJA} />}
      {valor.length > maximo * 0.85 && <span className="text-xs text-muted self-end">{valor.length}/{maximo}</span>}
    </label>
  );
}

export default function ModalPropuestaEscena({ despuesDe, onCerrar }: {
  despuesDe: LaminaDeReferencia | null;
  onCerrar: () => void;
}) {
  const { userId, nombre } = useAppStore();
  const [datos, setDatos] = useState(PROPUESTA_VACIA);
  const [enviando, setEnviando] = useState(false);
  const [estado, setEstado] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null);
  const propuesta: PropuestaEscena = { despuesDe, ...datos };
  const faltan = faltantesPropuesta(propuesta);

  // Funciones estables por campo: el dictado añade sobre el valor vigente, no sobre uno viejo.
  const [setters] = useState(() => Object.fromEntries(CAMPOS.map(c => [c.id, {
    cambiar: (v: string) => setDatos(d => ({ ...d, [c.id]: v.slice(0, MAX[c.id]) })),
    dictar: (t: string) => setDatos(d => ({ ...d, [c.id]: (d[c.id] ? `${d[c.id]} ${t}` : t).slice(0, MAX[c.id]) })),
  }])) as Record<Campo, { cambiar: (v: string) => void; dictar: (t: string) => void }>);

  async function enviar() {
    if (faltan.length) {
      setEstado({ tipo: 'error', texto: `Falta: ${faltan.join('; ')}.` });
      return;
    }
    setEnviando(true);
    setEstado(null);
    try {
      const res = await crearSugerencia(userId || nombre || 'anónimo', textoSugerenciaEscena(propuesta));
      if (res.ok) {
        setEstado({ tipo: 'ok', texto: '¡Gracias! Tu propuesta quedó en la lista de escenas por construir, para revisión.' });
        setTimeout(onCerrar, 2200);
      } else {
        setEstado({ tipo: 'error', texto: res.error ?? 'No se pudo enviar la propuesta.' });
      }
    } catch {
      setEstado({ tipo: 'error', texto: 'Error de comunicación con el servidor.' });
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center p-4" onClick={onCerrar}>
      <div
        role="dialog"
        aria-label="Proponer una escena para la cartilla"
        className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl bg-card border border-line p-5 flex flex-col gap-4"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start gap-2">
          <div className="flex-1">
            <h3 className="text-strong font-semibold">🎙 Propón una escena para construir</h3>
            <p className="text-muted text-xs mt-0.5">
              {despuesDe
                ? <>Iría después de la lámina {despuesDe.numero}, «{despuesDe.titulo}».</>
                : 'Escena nueva para la cartilla de primaria.'}
            </p>
          </div>
          <button onClick={onCerrar} aria-label="Cerrar" className="p-1 text-muted hover:text-strong"><X size={16} /></button>
        </div>

        <p className="text-sm text-soft">
          Cuéntanos qué escena le falta al manual y cómo te la imaginas. No se agrega de inmediato:
          queda en la lista de escenas por construir para revisión; después se dibuja y se
          incorpora a la cartilla.
        </p>

        <p className="text-xs rounded-xl bg-warning-soft text-warning-soft-fg px-3 py-2">
          No uses nombres reales de estudiantes ni detalles de un caso verdadero: describe la situación en general.
        </p>

        {CAMPOS.map(c => (
          <CampoConDictado key={c.id} etiqueta={c.etiqueta} ayuda={c.ayuda} filas={c.filas} opcional={c.opcional} maximo={MAX[c.id]}
            valor={datos[c.id]} onCambio={setters[c.id].cambiar} onDictado={setters[c.id].dictar} />
        ))}

        {estado && (
          <p className={`text-sm ${estado.tipo === 'ok' ? 'text-success' : 'text-danger'}`}>{estado.texto}</p>
        )}

        <div className="flex gap-2 justify-end">
          <button onClick={onCerrar} className="px-4 py-2 rounded-xl border border-line text-sm text-soft hover:bg-elevated">Cancelar</button>
          <button
            onClick={() => { void enviar(); }}
            disabled={enviando || estado?.tipo === 'ok'}
            className="px-4 py-2 rounded-xl bg-accent text-accent-fg text-sm font-semibold disabled:opacity-50"
          >
            {enviando ? 'Enviando…' : 'Enviar propuesta'}
          </button>
        </div>
      </div>
    </div>
  );
}
