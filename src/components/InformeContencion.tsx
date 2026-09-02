import { useCallback, useState } from 'react';
import { cn } from '@/lib/utils';
import { useAppStore } from '../data/store';
import { DIRECTORES_MANANA, DIRECTORES_TARDE, getUsuario } from '../data/maestros';
import { guardarInformeContencion } from '../data/api';
import { useDictado } from '../hooks/useDictado';
import { exportarInformeContencion, compartirInformeContencion, RUTA_LABEL, type DatosInformeContencion } from '../lib/exportarDoc';

const ESCUDO = `${import.meta.env.BASE_URL}mjb_escudo.png`;
const ID_IMPRIMIBLE = 'informe-contencion-imprimible';

interface EstudianteBusqueda {
  studentId: string;
  nombres: string;
  apellidos: string;
  docNumber?: string;
  telefonos: string[];
  acudiente: string;
  parentesco?: string;
  gradoActual: string;
}

type RutaDetalle =
  | 'psicoorientador' | 'uai' | 'medellin_me_cuida'
  | 'linea_naranja' | 'linea_dorada' | 'directo' | 'externa';

// Ninguna casilla obligatoria: la contención puede terminar sin remisión
// (se atendió directo) o con una línea externa, y eso no es un caso fallido
// que haya que forzar a encajar en "psicoorientador/UAI/Medellín Me Cuida".
const RUTAS: Array<{ id: RutaDetalle; tipo: 'institucional' | 'externa'; label: string }> = [
  { id: 'psicoorientador', tipo: 'institucional', label: 'Atención por psicoorientador del colegio' },
  { id: 'medellin_me_cuida', tipo: 'institucional', label: 'Remisión a Medellín Te Quiere Saludable' },
  { id: 'directo', tipo: 'externa', label: 'Se atendió directamente, sin remisión' },
  { id: 'linea_naranja', tipo: 'externa', label: 'Se atendió con Línea Naranja' },
  { id: 'linea_dorada', tipo: 'externa', label: 'Se atendió con Línea Dorada u otra línea de emergencia externa' },
  { id: 'externa', tipo: 'externa', label: 'Se orienta a ayuda externa al colegio (familia busca apoyo por fuera)' },
];

/**
 * Vista imprimible del informe: se monta como overlay sobre toda la app y se
 * imprime con `window.print()`, igual que el mosaico de asistencia
 * (src/asistencia/MosaicoGrupo.tsx) — sin librería de PDF, apoyándose en
 * "Guardar como PDF" del diálogo de impresión nativo de Android/escritorio.
 * La técnica de `visibility: hidden` en TODO menos el informe evita que el
 * menú, la cabecera o el resto de la app se cuelen en la hoja impresa.
 */
function VistaImprimibleInforme({ datos, onCerrar }: { datos: DatosInformeContencion; onCerrar: () => void }) {
  const rutaTexto = RUTA_LABEL[datos.rutaDetalle] ?? datos.rutaDetalle;
  return (
    <div className="informe-overlay fixed inset-0 z-50 overflow-auto bg-[#525659] p-4">
      <style>{CSS_INFORME_IMPRIMIBLE}</style>

      <div className="informe-solo-pantalla mx-auto mb-4 flex max-w-[210mm] flex-wrap items-center gap-2 rounded-xl bg-surface p-3">
        <h2 className="text-sm font-semibold text-strong">Vista previa del informe (PDF)</h2>
        <span className="grow" />
        <button
          onClick={() => window.print()}
          className="flex min-h-[36px] items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-accent-fg"
        >
          Imprimir / Guardar PDF
        </button>
        <button
          onClick={onCerrar}
          className="flex min-h-[36px] items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-sm text-strong"
        >
          Cerrar
        </button>
      </div>

      <div id={ID_IMPRIMIBLE} className="informe-hoja">
        <div className="informe-encabezado">
          <img src={ESCUDO} alt="" className="informe-escudo" />
          <div>
            <h1 className="informe-titulo">Institución Educativa Manuel J. Betancur</h1>
            <h2 className="informe-subtitulo">INFORME DE CONTENCIÓN EMOCIONAL</h2>
          </div>
        </div>

        <table className="informe-tabla">
          <tbody>
            <tr><td className="informe-etiqueta">Nombres y apellidos del estudiante</td><td>{datos.estudianteNombre}</td></tr>
            <tr><td className="informe-etiqueta">Documento de identidad</td><td>{datos.estudianteDocumento || 'Sin registrar'}</td></tr>
            <tr><td className="informe-etiqueta">Grado / Grupo</td><td>{datos.grado}</td></tr>
            <tr><td className="informe-etiqueta">Director de grupo</td><td>{datos.director || '—'}</td></tr>
            <tr>
              <td className="informe-etiqueta">Acudiente</td>
              <td>{datos.acudienteNombre || 'Sin registrar'}{datos.acudienteParentesco ? ` (${datos.acudienteParentesco})` : ''}</td>
            </tr>
            <tr><td className="informe-etiqueta">Teléfono del acudiente</td><td>{datos.acudienteTelefonos || 'Sin registrar'}</td></tr>
            <tr><td className="informe-etiqueta">Fecha de generación del informe</td><td>{datos.fecha}</td></tr>
            <tr><td className="informe-etiqueta">Docente que genera el informe</td><td>{datos.docenteNombre}</td></tr>
          </tbody>
        </table>

        <table className="informe-tabla informe-tabla-bloque">
          <thead><tr><th colSpan={2}>DESCRIPCIÓN DEL INFORME</th></tr></thead>
          <tbody><tr><td colSpan={2} style={{ whiteSpace: 'pre-wrap' }}>{datos.descripcion}</td></tr></tbody>
        </table>

        <table className="informe-tabla informe-tabla-bloque">
          <thead><tr><th colSpan={2}>RUTA DE ATENCIÓN</th></tr></thead>
          <tbody><tr><td colSpan={2}>{rutaTexto}</td></tr></tbody>
        </table>

        <p className="informe-nota">
          Este informe fue registrado automáticamente por el sistema y notificado a coordinación y psicoorientación.
        </p>

        <div className="informe-firma">
          <div className="informe-firma-linea">Firma del docente</div>
        </div>
      </div>
    </div>
  );
}

/**
 * Colores literales (no tokens del tema): el papel siempre es blanco con
 * texto negro, independientemente de si el docente tenía el modo oscuro
 * activado al momento de imprimir.
 */
const CSS_INFORME_IMPRIMIBLE = `
@page { size: letter; margin: 18mm 16mm; }

.informe-hoja {
  width: 210mm;
  max-width: 100%;
  margin: 0 auto;
  padding: 10mm;
  background: #fff;
  color: #000;
  box-sizing: border-box;
  font-family: Arial, sans-serif;
  font-size: 11pt;
}
.informe-encabezado { display: flex; align-items: center; gap: 4mm; justify-content: center; text-align: center; margin-bottom: 6mm; }
.informe-escudo { width: 18mm; height: 18mm; object-fit: contain; }
.informe-titulo { font-size: 14pt; margin: 0; }
.informe-subtitulo { font-size: 11pt; margin: 2pt 0 0; color: #444; }
.informe-tabla { border-collapse: collapse; width: 100%; margin: 0 0 4mm; break-inside: avoid; page-break-inside: avoid; }
.informe-tabla td, .informe-tabla th { border: 1px solid #000; padding: 5pt 8pt; font-size: 10pt; vertical-align: top; text-align: left; }
.informe-tabla th { background: #eaf1dd; }
.informe-etiqueta { font-weight: bold; background: #eaf1dd; width: 32%; }
.informe-tabla-bloque { break-inside: avoid; page-break-inside: avoid; }
.informe-nota { font-size: 9pt; color: #555; margin-top: 6mm; }
.informe-firma { margin-top: 16mm; break-inside: avoid; page-break-inside: avoid; }
.informe-firma-linea { border-top: 1px solid #000; width: 70mm; margin-top: 12mm; padding-top: 3pt; font-size: 10pt; }

@media print {
  /* El imprimible cuelga de un contenedor de posicion fija con scroll propio, y Chrome
     RECORTA A UNA SOLA PAGINA lo que hay dentro de un position:fixed. Con el
     informe no se nota porque cabe en una hoja; con un historial de varias
     atenciones se perderia todo menos la primera pagina, y justo el dia que hay
     que presentar el caso. En papel el overlay deja de ser overlay. */
  .informe-overlay {
    position: static !important;
    overflow: visible !important;
    padding: 0 !important;
    background: #fff !important;
  }
  body * { visibility: hidden !important; }
  #${ID_IMPRIMIBLE}, #${ID_IMPRIMIBLE} * { visibility: visible !important; }
  .informe-solo-pantalla, .informe-solo-pantalla * { display: none !important; }
  .informe-hoja { width: auto; margin: 0; padding: 0; }
}
`;

function directorDeGrupo(grado: string): string {
  const id = DIRECTORES_MANANA[grado] ?? DIRECTORES_TARDE[grado];
  return id ? (getUsuario(id)?.nombre ?? id) : '';
}

function correoDirectorDeGrupo(grado: string): string {
  const id = DIRECTORES_MANANA[grado] ?? DIRECTORES_TARDE[grado];
  return id ? (getUsuario(id)?.correo ?? '') : '';
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
  const [rutaDetalle, setRutaDetalle] = useState<RutaDetalle | ''>('');
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState<{ ok: boolean; correoEnviado?: boolean; error?: string } | null>(null);
  const [datosParaExportar, setDatosParaExportar] = useState<Parameters<typeof exportarInformeContencion>[0] | null>(null);
  const [vistaImprimir, setVistaImprimir] = useState(false);
  const [compartiendo, setCompartiendo] = useState(false);

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
    const fecha = new Date().toISOString().slice(0, 10);
    const ruta = RUTAS.find(r => r.id === rutaDetalle);
    const r = await guardarInformeContencion({
      fecha,
      docenteId: docente.id,
      docenteNombre: docente.nombre,
      sede: sedeActual,
      jornada: docente.jornada === 'ambas' ? (estudiante.gradoActual.includes('º') ? 'tarde' : 'manana') : docente.jornada,
      grado: estudiante.gradoActual,
      estudianteNombre: `${estudiante.nombres} ${estudiante.apellidos}`,
      estudianteDocumento: estudiante.docNumber ?? '',
      estudianteTelefonos: estudiante.telefonos.join(', '),
      acudienteNombre: estudiante.acudiente ?? '',
      acudienteParentesco: estudiante.parentesco ?? '',
      director: directorDeGrupo(estudiante.gradoActual),
      directorCorreo: correoDirectorDeGrupo(estudiante.gradoActual),
      descripcion: descripcion.trim(),
      rutaTipo: ruta?.tipo ?? '',
      rutaDetalle,
    });
    setEnviando(false);
    setResultado(r);
    setDatosParaExportar({
      estudianteNombre: `${estudiante.nombres} ${estudiante.apellidos}`,
      estudianteDocumento: estudiante.docNumber ?? '',
      grado: estudiante.gradoActual,
      director: directorDeGrupo(estudiante.gradoActual),
      acudienteNombre: estudiante.acudiente ?? '',
      acudienteParentesco: estudiante.parentesco ?? '',
      acudienteTelefonos: estudiante.telefonos.join(', '),
      docenteNombre: docente.nombre,
      fecha,
      descripcion: descripcion.trim(),
      rutaDetalle: rutaDetalle || 'sin_seleccionar',
    });
  }

  if (resultado) {
    return (
      <>
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
        {resultado.ok && datosParaExportar && (
          <div className="flex flex-col gap-2 w-full max-w-xs">
            <div className="flex gap-2">
              <button
                onClick={() => setVistaImprimir(true)}
                className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold text-accent-fg bg-accent hover:brightness-110 transition"
              >
                📄 Descargar PDF
              </button>
              <button
                onClick={() => exportarInformeContencion(datosParaExportar)}
                className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold text-soft border border-line bg-elevated hover:bg-hover transition"
              >
                📝 Editable (Word)
              </button>
            </div>
            {/* PDF = para firmar/entregar tal cual (funciona igual en celular y PC).
                Word = por si hay que editar el texto antes de firmarlo; en Android
                puede que el .doc no abra directo en la app de Word/Drive — si eso
                sigue pasando, Julián decide si se retira, no se oculta por defecto. */}
            <p className="text-[10px] text-muted text-center">
              PDF: para firmar e imprimir tal cual. Word: si necesitas editarlo antes de firmarlo (en algunos celulares puede no abrir directo — mejor desde computador).
            </p>
            {typeof navigator !== 'undefined' && !!navigator.share && (
              <button
                onClick={async () => {
                  setCompartiendo(true);
                  const ok = await compartirInformeContencion(datosParaExportar);
                  setCompartiendo(false);
                  if (!ok) exportarInformeContencion(datosParaExportar);
                }}
                disabled={compartiendo}
                className="px-4 py-2.5 rounded-xl text-sm font-semibold text-soft border border-line bg-elevated hover:bg-hover transition disabled:opacity-50"
              >
                {compartiendo ? 'Abriendo…' : '📤 Compartir (Word)'}
              </button>
            )}
          </div>
        )}
        <button
          onClick={onTerminado}
          className="w-full max-w-xs px-5 py-2.5 rounded-xl text-sm font-semibold text-soft border border-line bg-elevated hover:bg-hover transition"
        >
          Terminar
        </button>
      </div>
      {vistaImprimir && datosParaExportar && (
        <VistaImprimibleInforme datos={datosParaExportar} onCerrar={() => setVistaImprimir(false)} />
      )}
    </>
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
          <span className="text-muted">
            Acudiente: {estudiante.acudiente || 'sin registrar'}
            {estudiante.parentesco ? ` (${estudiante.parentesco})` : ''}
            {estudiante.telefonos.length > 0 ? ` · ${estudiante.telefonos.join(', ')}` : ''}
          </span>
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
            <label className="text-[11px] text-muted">
              Ruta de atención <span className="opacity-70">(opcional — no toda contención termina en remisión)</span>
            </label>
            <div className="flex flex-col gap-1.5">
              {RUTAS.map(r => (
                <label key={r.id} className="flex items-center gap-2 text-sm text-soft cursor-pointer">
                  <input
                    type="radio"
                    name="rutaDetalle"
                    checked={rutaDetalle === r.id}
                    onChange={() => setRutaDetalle(r.id)}
                  />
                  {r.label}
                </label>
              ))}
              {rutaDetalle !== '' && (
                <button
                  onClick={() => setRutaDetalle('')}
                  className="text-[11px] text-muted hover:text-soft self-start"
                >
                  Quitar selección
                </button>
              )}
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
