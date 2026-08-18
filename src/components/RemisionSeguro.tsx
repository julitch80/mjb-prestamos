import { useState } from 'react';
import { useAppStore } from '../data/store';
import { getUsuario } from '../data/maestros';
import { guardarRemisionSeguro } from '../data/api';
import { CapturaEscaner } from './CapturaEscaner';

interface EstudianteBusqueda {
  studentId: string;
  nombres: string;
  apellidos: string;
  docNumber?: string;
  gradoActual: string;
}

export function RemisionSeguro({ onTerminado, onCancelar }: {
  onTerminado: () => void;
  onCancelar: () => void;
}) {
  const userId = useAppStore(s => s.userId);
  const sedeActual = useAppStore(s => s.sedeActual);
  const docente = getUsuario(userId ?? '');

  const [busqueda, setBusqueda] = useState('');
  const [resultados, setResultados] = useState<EstudianteBusqueda[]>([]);
  const [estudiante, setEstudiante] = useState<EstudianteBusqueda | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [resultado, setResultado] = useState<{ ok: boolean; error?: string } | null>(null);

  async function buscar(texto: string) {
    setBusqueda(texto);
    setEstudiante(null);
    if (texto.trim().length < 2) { setResultados([]); return; }
    const { buscarEstudiantes } = await import('../asistencia/datos');
    const encontrados = await buscarEstudiantes(sedeActual, texto);
    setResultados(encontrados as unknown as EstudianteBusqueda[]);
  }

  async function guardar(fotoBase64: string) {
    if (!estudiante || !docente) return;
    setGuardando(true);
    const r = await guardarRemisionSeguro({
      fecha: new Date().toISOString().slice(0, 10),
      docenteId: docente.id,
      docenteNombre: docente.nombre,
      sede: sedeActual,
      jornada: docente.jornada === 'ambas' ? (estudiante.gradoActual.includes('º') ? 'tarde' : 'manana') : docente.jornada,
      grado: estudiante.gradoActual,
      estudianteNombre: `${estudiante.nombres} ${estudiante.apellidos}`,
      estudianteDocumento: estudiante.docNumber ?? '',
      fotoBase64,
    });
    setGuardando(false);
    setResultado(r);
  }

  if (resultado) {
    return (
      <div className="flex flex-col gap-4 items-center text-center py-6">
        <span className="text-3xl">{resultado.ok ? '✅' : '⚠️'}</span>
        <p className="text-sm font-semibold text-strong">
          {resultado.ok ? 'Documento archivado' : 'No se pudo guardar la foto'}
        </p>
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

  if (guardando) {
    return <p className="text-sm text-muted text-center py-6">Guardando documento…</p>;
  }

  if (!estudiante) {
    return (
      <div className="flex flex-col gap-1.5">
        <p className="text-sm font-bold text-strong mb-1">Remisión al seguro estudiantil</p>
        <label className="text-[11px] text-muted">Buscar estudiante</label>
        <input
          value={busqueda}
          onChange={e => buscar(e.target.value)}
          placeholder="Nombre o apellido…"
          className="w-full px-3 py-2 rounded-xl bg-elevated border border-line text-sm text-strong placeholder:text-muted focus:outline-none focus:border-line-strong"
        />
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
        <button
          onClick={onCancelar}
          className="px-4 py-2 mt-2 rounded-xl text-xs font-medium text-muted hover:text-soft transition self-start"
        >
          Cancelar
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-xl border border-line bg-elevated/40 px-3 py-2.5 text-xs">
        <span className="font-semibold text-strong text-sm">{estudiante.apellidos} {estudiante.nombres}</span>
        <span className="text-muted"> · {estudiante.gradoActual}</span>
      </div>
      <CapturaEscaner onListo={guardar} onCancelar={() => setEstudiante(null)} />
    </div>
  );
}
