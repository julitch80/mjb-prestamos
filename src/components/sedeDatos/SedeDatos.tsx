// «Datos de la sede»: formulario guiado para el coordinador de una sede de primaria.
// Autoguardado con debounce en Firestore (sedeDatos/{sedeId}); archivos y voz en Storage.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAppStore } from '../../data/store';
import { calcularAvance, respuestaVacia } from '../../data/sedeDatos/avance';
import { formatearTamano, nombreCorto, siguienteEtiqueta } from '../../data/sedeDatos/archivos';
import { subirArchivoSede } from '../../data/sedeDatos/almacenamiento';
import { avisarEnvioASuperusuarios, cargarSedeDatos, docIdDeSede, guardarSedeDatos, miCorreo } from '../../data/sedeDatos/persistencia';
import { NOMBRE_SEDE, sedesDeUsuario, temasDeSede } from '../../data/sedeDatos/temas';
import type { ArchivoSede, RespuestaTema, SedeDatosId } from '../../data/sedeDatos/tipos';
import { ACEPTA } from './EntradaCombinada';
import { Boton, Chip, EnlaceArchivo } from './piezas';
import ResumenSedeDatos from './ResumenSedeDatos';
import TarjetaTema from './TarjetaTema';

type EstadoGuardado = 'cargando' | 'listo' | 'guardando' | 'guardado' | 'error';

function FormularioSede({ sede, prueba }: { sede: SedeDatosId; prueba: boolean }) {
  const docId = docIdDeSede(sede, prueba);
  const nombre = useAppStore(s => s.nombre);
  const temas = useMemo(() => temasDeSede(sede), [sede]);
  const [respuestas, setRespuestas] = useState<Record<string, RespuestaTema>>({});
  const [archivos, setArchivos] = useState<ArchivoSede[]>([]);
  const [enviosCount, setEnviosCount] = useState(0);
  const [estado, setEstado] = useState<EstadoGuardado>('cargando');
  const [errorMsg, setErrorMsg] = useState('');
  const [aviso, setAviso] = useState('');
  const [errSubida, setErrSubida] = useState<string[]>([]);
  const [subiendo, setSubiendo] = useState(false);
  const sucio = useRef(false);
  const archivosRef = useRef<ArchivoSede[]>([]);
  const respRef = useRef<Record<string, RespuestaTema>>({});
  const fileRef = useRef<HTMLInputElement>(null);
  const camRef = useRef<HTMLInputElement>(null);
  archivosRef.current = archivos;
  respRef.current = respuestas;

  useEffect(() => {
    let vivo = true;
    setEstado('cargando');
    cargarSedeDatos(docId).then(d => {
      if (!vivo) return;
      setRespuestas(d?.respuestas ?? {});
      setArchivos(d?.archivos ?? []);
      setEnviosCount(d?.enviosCount ?? 0);
      setEstado('listo');
    }).catch(e => {
      if (!vivo) return;
      setErrorMsg((e as Error).message || 'No se pudo cargar.');
      setEstado('error');
    });
    return () => { vivo = false; };
  }, [docId]);

  const guardar = useCallback(async (enviar = false) => {
    setEstado('guardando');
    // Se baja antes de escribir: un cambio hecho durante el guardado lo vuelve a subir.
    sucio.current = false;
    try {
      await guardarSedeDatos(docId, { respuestas: respRef.current, archivos: archivosRef.current }, enviar);
      setEstado('guardado');
      setErrorMsg('');
    } catch (e) {
      setErrorMsg((e as Error).message || 'No se pudo guardar.');
      setEstado('error');
      throw e;
    }
  }, [docId]);

  // Autoguardado: 1,5 s después del último cambio (nunca antes de haber cargado lo que ya había).
  useEffect(() => {
    if (!sucio.current || estado === 'cargando') return;
    const t = window.setTimeout(() => { guardar().catch(() => {}); }, 1500);
    return () => window.clearTimeout(t);
  }, [respuestas, archivos, estado, guardar]);

  const cambiarTema = useCallback((id: string, cambio: (prev: RespuestaTema) => RespuestaTema) => {
    sucio.current = true;
    setRespuestas(prev => ({ ...prev, [id]: cambio(prev[id] ?? respuestaVacia()) }));
  }, []);

  /** Sube uno por uno (así las etiquetas A1, A2… salen en orden) y devuelve los que sí entraron. */
  const subirArchivos = useCallback(async (files: File[]): Promise<ArchivoSede[]> => {
    const nuevos: ArchivoSede[] = [];
    const fallos: string[] = [];
    for (const f of files) {
      try {
        const s = await subirArchivoSede(docId, f);
        const a: ArchivoSede = {
          id: s.id, etiqueta: siguienteEtiqueta([...archivosRef.current, ...nuevos]), nombre: nombreCorto(f.name),
          nombreOriginal: f.name, ruta: s.ruta, tipo: s.tipo, tamano: s.tamano, subidoPor: miCorreo(), fecha: new Date().toISOString(),
        };
        nuevos.push(a);
        archivosRef.current = [...archivosRef.current, a];
        sucio.current = true;
        setArchivos(archivosRef.current);
      } catch (e) {
        fallos.push((e as Error).message || f.name);
      }
    }
    setErrSubida(fallos);
    return nuevos;
  }, [docId]);

  async function subirDesdePaso(files: FileList | null) {
    if (!files?.length) return;
    setSubiendo(true);
    await subirArchivos([...files]);
    setSubiendo(false);
    if (fileRef.current) fileRef.current.value = '';
    if (camRef.current) camRef.current.value = '';
  }

  const avance = useMemo(() => calcularAvance(temas, respuestas), [temas, respuestas]);

  async function enviar() {
    setAviso('');
    try {
      await guardar(true);
      setEnviosCount(n => n + 1);
      if (prueba) {
        setAviso('Envío de PRUEBA registrado. No se avisó a nadie por chat y el coordinador no lo verá.');
        return;
      }
      const n = await avisarEnvioASuperusuarios(
        `📋 Datos de la sede ${NOMBRE_SEDE[sede]} enviados por ${nombre ?? 'el coordinador'}: ${avance.hechos} de ${avance.total} temas completos`
        + (avance.abiertos.length ? ` (${avance.abiertos.length} quedan abiertos).` : '.'),
      );
      setAviso(`Enviado. ${avance.abiertos.length ? 'Los temas en «Después» siguen abiertos: puede completarlos y volver a enviar. ' : ''}${n ? '' : 'No se pudo avisar por chat; igual quedó registrado.'}`);
    } catch {
      /* el error ya quedó en errorMsg */
    }
  }

  if (estado === 'cargando') return <p className="text-sm text-muted">Cargando…</p>;
  const pct = avance.total ? Math.round((avance.hechos / avance.total) * 100) : 0;
  const textoGuardado = { cargando: '', listo: '', guardando: 'Guardando…', guardado: 'Guardado', error: 'No se guardó' }[estado];

  return (
    <div className="space-y-4">
      {prueba && (
        <p className="rounded-lg bg-warning-soft text-warning-soft-fg text-sm font-semibold px-3 py-2 text-center">
          MODO PRUEBA — esto no lo ve el coordinador
        </p>
      )}
      {/* Barra de avance, pegada arriba para verla mientras se responde */}
      <div className="sticky top-14 z-20 -mx-4 px-4 py-2 bg-app/95 backdrop-blur border-b border-line">
        <div className="flex items-center justify-between text-xs mb-1">
          <span className="font-semibold text-strong">{avance.hechos} de {avance.total} temas</span>
          <span className={estado === 'error' ? 'text-danger' : 'text-muted'}>{textoGuardado}</span>
        </div>
        <div className="h-2 rounded-full bg-elevated overflow-hidden" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
          <div className="h-full bg-success transition-all" style={{ width: `${pct}%` }} />
        </div>
      </div>

      {estado === 'error' && errorMsg && (
        <p className="rounded-lg bg-danger-soft text-danger-soft-fg text-sm px-3 py-2">{errorMsg}</p>
      )}

      {/* Paso opcional: sus archivos */}
      <section className="rounded-xl border border-line bg-card p-4 space-y-3">
        <div>
          <h3 className="text-sm font-semibold text-strong">Sus archivos <span className="text-muted font-normal">(opcional)</span></h3>
          <p className="text-xs text-muted mt-0.5">
            Suba de una vez horarios, fotos, PDF, Word, Excel o audios. Cada uno recibe una etiqueta (A1, A2…) para señalarlo después.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <input ref={fileRef} type="file" multiple accept={ACEPTA} hidden onChange={e => subirDesdePaso(e.target.files)} />
          <input ref={camRef} type="file" accept="image/*" capture="environment" hidden onChange={e => subirDesdePaso(e.target.files)} />
          <Boton disabled={subiendo} onClick={() => fileRef.current?.click()}>{subiendo ? 'Subiendo…' : 'Elegir archivos'}</Boton>
          <Boton disabled={subiendo} onClick={() => camRef.current?.click()}>Tomar foto</Boton>
        </div>
        {errSubida.length > 0 && (
          <ul className="text-xs text-danger list-disc pl-4">{errSubida.map((e, i) => <li key={i}>{e}</li>)}</ul>
        )}
        {archivos.length > 0 && (
          <ul className="space-y-2">
            {archivos.map(a => (
              <li key={a.id} className="flex items-center gap-2 flex-wrap">
                <span className="rounded bg-info-soft text-info-soft-fg text-xs font-semibold px-2 py-1">{a.etiqueta}</span>
                <input value={a.nombre} aria-label={`Nombre de ${a.etiqueta}`}
                  onChange={e => { sucio.current = true; setArchivos(prev => prev.map(x => x.id === a.id ? { ...x, nombre: e.target.value.slice(0, 60) } : x)); }}
                  className="min-h-[44px] flex-1 min-w-[140px] rounded-lg border border-line bg-card px-3 text-sm text-strong" />
                <span className="text-xs text-muted"><EnlaceArchivo ruta={a.ruta}>abrir</EnlaceArchivo> · {formatearTamano(a.tamano)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {temas.map((t, i) => (
        <TarjetaTema key={t.id} sede={docId} tema={t} numero={i + 1} respuesta={respuestas[t.id]} archivos={archivos}
          onChange={cambio => cambiarTema(t.id, cambio)} subirArchivos={subirArchivos} />
      ))}

      <section className="rounded-xl border border-line bg-card p-4 space-y-2">
        <p className="text-sm text-strong">
          Lleva <b>{avance.hechos} de {avance.total}</b> temas.{' '}
          {avance.abiertos.length > 0 && 'Puede enviar ya: lo que quede en «Después» sigue abierto y lo completa cuando pueda.'}
        </p>
        <div className="flex items-center gap-3 flex-wrap">
          <Boton tono="primario" onClick={enviar} disabled={estado === 'guardando'}>{enviosCount > 0 ? 'Volver a enviar' : 'Enviar'}</Boton>
          {enviosCount > 0 && <span className="text-xs text-muted">Enviado {enviosCount} {enviosCount === 1 ? 'vez' : 'veces'}</span>}
        </div>
        {aviso && <p className="text-sm text-success">{aviso}</p>}
      </section>
    </div>
  );
}

export default function SedeDatos() {
  const { userId, rol } = useAppStore();
  const sedes = sedesDeUsuario(userId, rol);
  const [sede, setSede] = useState<SedeDatosId | null>(sedes[0] ?? null);
  const [modo, setModo] = useState<'responder' | 'respuestas'>(rol === 'superusuario' ? 'respuestas' : 'responder');
  const esSuper = rol === 'superusuario';
  // El superusuario entra en modo prueba por defecto: no toca el documento real de la sede.
  const [prueba, setPrueba] = useState(true);
  const [verPrueba, setVerPrueba] = useState(false);

  if (!sede) return <p className="text-sm text-muted">Esta sección es para los coordinadores de las sedes de primaria.</p>;

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-strong">Datos de la sede</h1>
        <p className="text-sm text-muted mt-0.5">
          Unos 10 minutos. Lo que no tenga, déjelo para después: se guarda solo y puede volver cuando quiera.
        </p>
      </div>

      {(sedes.length > 1 || esSuper) && (
        <div className="flex flex-wrap gap-2">
          {sedes.map(s => <Chip key={s} activo={sede === s} onClick={() => setSede(s)}>{NOMBRE_SEDE[s]}</Chip>)}
          {esSuper && (
            <>
              <span className="w-px bg-line mx-1" />
              <Chip activo={modo === 'responder'} onClick={() => setModo('responder')}>Formulario</Chip>
              <Chip activo={modo === 'respuestas'} onClick={() => setModo('respuestas')}>Ver respuestas</Chip>
              {modo === 'responder'
                ? <Chip activo={prueba} onClick={() => setPrueba(p => !p)}>{prueba ? 'Modo prueba: sí' : 'Modo prueba: no (REAL)'}</Chip>
                : <Chip activo={verPrueba} onClick={() => setVerPrueba(v => !v)}>{verPrueba ? 'Viendo datos de prueba' : 'Ver los de prueba'}</Chip>}
            </>
          )}
        </div>
      )}
      {sedes.length === 1 && <p className="text-xs font-semibold text-soft">{NOMBRE_SEDE[sede]}</p>}

      {esSuper && modo === 'respuestas'
        ? <ResumenSedeDatos key={sede + verPrueba} sede={sede} prueba={verPrueba} />
        : <FormularioSede key={sede + prueba} sede={sede} prueba={esSuper && prueba} />}
    </div>
  );
}
