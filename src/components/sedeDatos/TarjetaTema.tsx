import { useState } from 'react';
import { entradaTieneContenido, estaCompleto, respuestaVacia, entradaVacia } from '../../data/sedeDatos/avance';
import type {
  ArchivoSede, Entrada, EstadoTema, Pregunta, RespuestaPregunta, RespuestaTema, Tema,
} from '../../data/sedeDatos/tipos';
import EntradaCombinada from './EntradaCombinada';
import { Boton, Chip } from './piezas';

type Props = {
  sede: string;
  tema: Tema;
  numero: number;
  respuesta: RespuestaTema | undefined;
  archivos: ArchivoSede[];
  onChange: (cambio: (prev: RespuestaTema) => RespuestaTema) => void;
  subirArchivos: (files: File[]) => Promise<ArchivoSede[]>;
};

function PreguntaChips({ sede, p, valor, archivos, onChange, subirArchivos }: {
  sede: string; p: Pregunta; valor: RespuestaPregunta | undefined; archivos: ArchivoSede[];
  onChange: (cambio: (prev: RespuestaPregunta) => RespuestaPregunta) => void;
  subirArchivos: (files: File[]) => Promise<ArchivoSede[]>;
}) {
  const v: RespuestaPregunta = valor ?? { valor: '', detalle: '', entrada: entradaVacia() };
  const opcion = p.opciones?.find(o => o.valor === v.valor);
  const [nota, setNota] = useState(false);
  const verNota = nota || entradaTieneContenido(v.entrada);
  return (
    <div className="space-y-2 border-t border-line pt-3">
      <p className="text-sm text-strong">{p.etiqueta}</p>
      {p.opciones ? (
        <div className="flex flex-wrap gap-2">
          {p.opciones.map(o => (
            <Chip key={o.valor} activo={v.valor === o.valor}
              onClick={() => onChange(prev => ({ ...prev, valor: prev.valor === o.valor ? '' : o.valor, detalle: o.valor === prev.valor ? '' : prev.detalle }))}>
              {o.valor}{o.pide && o.valor !== 'Otro' ? ' →' : ''}
            </Chip>
          ))}
        </div>
      ) : (
        <input value={v.valor} onChange={e => onChange(prev => ({ ...prev, valor: e.target.value }))}
          placeholder="Respuesta corta" className="w-full min-h-[44px] rounded-lg border border-line bg-card px-3 text-sm text-strong placeholder:text-muted" />
      )}
      {opcion?.pide && (
        <input value={v.detalle} onChange={e => onChange(prev => ({ ...prev, detalle: e.target.value }))}
          placeholder={opcion.pide} className="w-full min-h-[44px] rounded-lg border border-line bg-card px-3 text-sm text-strong placeholder:text-muted" />
      )}
      {verNota ? (
        <EntradaCombinada sede={sede} archivos={archivos} conArchivos={false} placeholder="Nota (opcional)…"
          entrada={v.entrada} onChange={e => onChange(prev => ({ ...prev, entrada: e }))} subirArchivos={subirArchivos} />
      ) : (
        <button type="button" onClick={() => setNota(true)} className="min-h-[44px] text-xs text-info underline">
          Agregar nota o voz
        </button>
      )}
    </div>
  );
}

export default function TarjetaTema({ sede, tema, numero, respuesta, archivos, onChange, subirArchivos }: Props) {
  const r = respuesta ?? respuestaVacia();
  const completo = estaCompleto(tema, respuesta);
  const confirmar = tema.modo === 'confirmar';
  const [abierto, setAbierto] = useState(false);
  const [verTodo, setVerTodo] = useState(false);
  const mostrarEditor = confirmar ? r.estado === 'corregir' : (abierto || r.estado === 'respondido');
  const filas = verTodo ? tema.prellenado : tema.prellenado.slice(0, 8);

  const poner = (estado: EstadoTema) => onChange(prev => ({ ...prev, estado }));
  const setEntrada = (e: Entrada) => onChange(prev => ({ ...prev, entrada: e }));

  function responder() {
    setAbierto(true);
    poner('respondido');
  }

  return (
    <section className={'rounded-xl border bg-card p-4 space-y-3 ' + (completo ? 'border-success' : 'border-line')}>
      <div className="flex items-start gap-3">
        <span className={'mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-xs font-semibold ' +
          (completo ? 'bg-success-soft text-success-soft-fg' : 'bg-elevated text-muted')}>
          {completo ? '✓' : numero}
        </span>
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-strong">{tema.titulo}</h3>
          {tema.ayuda && <p className="text-xs text-muted mt-0.5">{tema.ayuda}</p>}
        </div>
      </div>

      {tema.prellenado.length > 0 && (
        <div className="rounded-lg bg-elevated p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted mb-1.5">Lo que ya sabemos</p>
          <dl className="space-y-1">
            {filas.map((f, i) => (
              <div key={i} className="flex gap-2 text-xs">
                <dt className="text-soft flex-1 min-w-0">{f.etiqueta}</dt>
                <dd className="text-strong font-medium text-right">{f.valor}</dd>
              </div>
            ))}
          </dl>
          {tema.prellenado.length > 8 && (
            <button type="button" onClick={() => setVerTodo(v => !v)} className="mt-1 min-h-[44px] text-xs text-info underline">
              {verTodo ? 'Ver menos' : `Ver los ${tema.prellenado.length}`}
            </button>
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {confirmar ? (
          <>
            <Boton tono={r.estado === 'bien' ? 'bien' : 'neutro'} onClick={() => poner('bien')}>✓ Está bien</Boton>
            <Boton tono={r.estado === 'corregir' ? 'aviso' : 'neutro'} onClick={() => poner('corregir')}>✎ Hay que corregir</Boton>
          </>
        ) : (
          <Boton tono={mostrarEditor ? 'primario' : 'neutro'} onClick={responder}>Responder</Boton>
        )}
        <Boton tono={r.estado === 'despues' ? 'aviso' : 'neutro'} onClick={() => { setAbierto(false); poner('despues'); }}>⏳ Después</Boton>
      </div>

      {/* Preguntas de chips: en los temas de «responder» salen al abrir; en los de «confirmar» siempre. */}
      {tema.preguntas.length > 0 && (confirmar || mostrarEditor) && (
        <div className="space-y-3">
          {tema.preguntas.map(p => (
            <PreguntaChips key={p.id} sede={sede} p={p} valor={r.preguntas[p.id]} archivos={archivos}
              subirArchivos={subirArchivos}
              onChange={cambio => onChange(prev => ({
                ...prev,
                // Contestar una pregunta de un tema de «responder» lo marca como respondido.
                estado: prev.estado === 'despues' || prev.estado === 'pendiente' ? (confirmar ? prev.estado : 'respondido') : prev.estado,
                preguntas: { ...prev.preguntas, [p.id]: cambio(prev.preguntas[p.id] ?? { valor: '', detalle: '', entrada: entradaVacia() }) },
              }))} />
          ))}
        </div>
      )}

      {mostrarEditor && (tema.preguntas.length === 0 || !confirmar) && (
        <div className="border-t border-line pt-3">
          <p className="text-xs text-muted mb-2">
            {confirmar ? 'Escriba la corrección, indique en qué archivo está, o grábela.' : tema.preguntas.length ? 'Algo más que quiera agregar (opcional):' : 'Responda como le quede más fácil; puede combinar varias formas.'}
          </p>
          <EntradaCombinada sede={sede} archivos={archivos} entrada={r.entrada} onChange={setEntrada} subirArchivos={subirArchivos} />
        </div>
      )}
      {confirmar && tema.preguntas.length > 0 && r.estado === 'corregir' && (
        <div className="border-t border-line pt-3">
          <EntradaCombinada sede={sede} archivos={archivos} entrada={r.entrada} onChange={setEntrada} subirArchivos={subirArchivos} />
        </div>
      )}
    </section>
  );
}
