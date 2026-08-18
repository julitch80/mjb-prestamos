import { useCallback, useState } from 'react';
import { cn } from '@/lib/utils';
import { useAppStore } from '../data/store';
import { DIRECTORES_MANANA, DIRECTORES_TARDE, getUsuario } from '../data/maestros';
import { guardarInformeContencion } from '../data/api';
import { useDictado } from '../hooks/useDictado';

interface EstudianteBusqueda {
  studentId: string;
  nombres: string;
  apellidos: string;
  docNumber?: string;
  telefonos: string[];
  gradoActual: string;
}

type RutaTipo = 'institucional' | 'externa';
type RutaDetalle = 'psicoorientador' | 'uai' | 'medellin_me_cuida' | 'externa';

const RUTAS_INSTITUCIONALES: Array<{ id: RutaDetalle; label: string }> = [
  { id: 'psicoorientador', label: 'Atención por psicoorientador del colegio' },
  { id: 'uai', label: 'Remisión a la UAI (Unidad de Atención Integral)' },
  { id: 'medellin_me_cuida', label: 'Remisión a Medellín Te Quiere Saludable' },
];

function directorDeGrupo(grado: string): string {
  const id = DIRECTORES_MANANA[grado] ?? DIRECTORES_TARDE[grado];
  return id ? (getUsuario(id)?.nombre ?? id) : '';
}

export function InformeContencion({ onTerminado, onCancelar }: {
  onTerminado: () => void;
  onCancelar: () => void;
}) {
  const userId = useAppStore(s => s.userId);
  const sedeActual = useAppStore(s => s.sedeActual);
  const docente = getUsuario(userId ?? '');

  const [busqueda, setBusqueda] = useState('');
  const [resultados, setResultados] = useState<EstudianteBusqueda[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [estudiante, setEstudiante] = useState<EstudianteBusqueda | null>(null);
  const [descripcion, setDescripcion] = useState('');
  const [rutaTipo, setRutaTipo] = useState<RutaTipo>('institucional');
  const [rutaDetalle, setRutaDetalle] = useState<RutaDetalle>('psicoorientador');
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState<{ ok: boolean; correoEnviado?: boolean; error?: string } | null>(null);

  const dictado = useDictado(useCallback((texto: string) => {
    setDescripcion(prev => (prev ? `${prev} ${texto}` : texto));
  }, []));

  async function buscar(texto: string) {
    setBusqueda(texto);
    setEstudiante(null);
    if (texto.trim().length < 2) { setResultados([]); return; }
    setBuscando(true);
    try {
      const { buscarEstudiantes } = await import('../asistencia/datos');
      const encontrados = await buscarEstudiantes(sedeActual, texto);
      setResultados(encontrados as unknown as EstudianteBusqueda[]);
    } catch {
      setResultados([]);
    } finally {
      setBuscando(false);
    }
  }

  async function enviar() {
    if (!estudiante || !docente || !descripcion.trim()) return;
    setEnviando(true);
    const r = await guardarInformeContencion({
      fecha: new Date().toISOString().slice(0, 10),
      docenteId: docente.id,
      docenteNombre: docente.nombre,
      sede: sedeActual,
      jornada: docente.jornada === 'ambas' ? (estudiante.gradoActual.includes('º') ? 'tarde' : 'manana') : docente.jornada,
      grado: estudiante.gradoActual,
      estudianteNombre: `${estudiante.nombres} ${estudiante.apellidos}`,
      estudianteDocumento: estudiante.docNumber ?? '',
      estudianteTelefonos: estudiante.telefonos.join(', '),
      director: directorDeGrupo(estudiante.gradoActual),
      descripcion: descripcion.trim(),
      rutaTipo,
      rutaDetalle: rutaTipo === 'externa' ? 'externa' : rutaDetalle,
    });
    setEnviando(false);
    setResultado(r);
  }

  if (resultado) {
    return (
      <div className="flex flex-col gap-4 items-center text-center py-6">
        <span className="text-3xl">{resultado.ok ? '✅' : '⚠️'}</span>
        <p className="text-sm font-semibold text-strong">
          {resultado.ok ? 'Informe guardado' : 'No se pudo guardar el informe'}
        </p>
        {resultado.ok && (
          <p className="text-xs text-muted max-w-xs">
            {resultado.correoEnviado
              ? 'Se envió automáticamente a coordinación y a psicoorientación.'
              : 'El informe quedó guardado, pero el envío por correo falló — avisa a coordinación directamente.'}
          </p>
        )}
        {!resultado.ok && <p className="text-xs text-danger">{resultado.error}</p>}
        <button
          onClick={onTerminado}
          className="px-5 py-2.5 rounded-xl text-sm font-semibold text-accent-fg bg-accent hover:brightness-110 transition"
        >
          Terminar
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm font-bold text-strong">Informe de contención emocional</p>

      {!estudiante ? (
        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] text-muted">Buscar estudiante</label>
          <input
            value={busqueda}
            onChange={e => buscar(e.target.value)}
            placeholder="Nombre o apellido…"
            className="w-full px-3 py-2 rounded-xl bg-elevated border border-line text-sm text-strong placeholder:text-muted focus:outline-none focus:border-line-strong"
          />
          {buscando && <span className="text-xs text-muted">Buscando…</span>}
          {resultados.length > 0 && (
            <div className="flex flex-col gap-1 mt-1">
              {resultados.map(e => (
                <button
                  key={e.studentId}
                  onClick={() => { setEstudiante(e); setResultados([]); }}
                  className="text-left px-3 py-2 rounded-lg border border-line bg-card hover:bg-hover transition text-sm"
                >
                  <span className="font-semibold text-strong">{e.apellidos} {e.nombres}</span>
                  <span className="text-muted text-xs"> · {e.gradoActual}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-xl border border-line bg-elevated/40 px-3 py-2.5 text-xs flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-strong text-sm">{estudiante.apellidos} {estudiante.nombres}</span>
            <button onClick={() => setEstudiante(null)} className="text-muted hover:text-soft">Cambiar</button>
          </div>
          <span className="text-muted">Grado {estudiante.gradoActual} · Director: {directorDeGrupo(estudiante.gradoActual) || '—'}</span>
          <span className="text-muted">Documento: {estudiante.docNumber ?? 'sin registrar'}</span>
        </div>
      )}

      {estudiante && (
        <>
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[11px] text-muted">Descripción del informe</label>
              {dictado.disponible && (
                <button
                  onClick={dictado.grabando ? dictado.detener : dictado.iniciar}
                  className={cn(
                    'text-[11px] font-semibold px-2 py-1 rounded-full border transition',
                    dictado.grabando ? 'border-danger text-danger bg-danger-soft animate-pulse' : 'border-line text-muted hover:bg-hover',
                  )}
                >
                  {dictado.grabando ? '● Grabando…' : '🎤 Dictar'}
                </button>
              )}
            </div>
            <textarea
              value={descripcion}
              onChange={e => setDescripcion(e.target.value)}
              rows={4}
              placeholder="Qué observaste, qué te dijo el estudiante, contexto relevante…"
              className="w-full px-3 py-2 rounded-xl bg-elevated border border-line text-sm text-strong placeholder:text-muted focus:outline-none focus:border-line-strong resize-y"
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-[11px] text-muted">Ruta de atención</label>
            <div className="flex flex-col gap-1.5">
              {RUTAS_INSTITUCIONALES.map(r => (
                <label key={r.id} className="flex items-center gap-2 text-sm text-soft cursor-pointer">
                  <input
                    type="radio"
                    checked={rutaTipo === 'institucional' && rutaDetalle === r.id}
                    onChange={() => { setRutaTipo('institucional'); setRutaDetalle(r.id); }}
                  />
                  {r.label}
                </label>
              ))}
              <label className="flex items-center gap-2 text-sm text-soft cursor-pointer">
                <input type="radio" checked={rutaTipo === 'externa'} onChange={() => setRutaTipo('externa')} />
                Se orienta a ayuda externa al colegio
              </label>
            </div>
          </div>

          <div className="flex gap-2 pt-1">
            <button
              onClick={onCancelar}
              className="flex-1 px-4 py-3 rounded-xl text-sm font-semibold text-soft border border-line bg-elevated hover:bg-hover transition"
            >
              Cancelar
            </button>
            <button
              onClick={enviar}
              disabled={!descripcion.trim() || enviando}
              className="flex-1 px-4 py-3 rounded-xl text-sm font-semibold text-accent-fg bg-accent hover:brightness-110 transition disabled:opacity-50"
            >
              {enviando ? 'Guardando…' : 'Guardar y enviar'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
