import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { actualizarFicha, leerEstudiante, leerMiCuenta, type MiCuenta } from './datos';
import { subirFoto, urlDeFoto } from './fotos';
import { iniciales, nombreCompleto } from './domain/nombres';
import type { Student } from './domain/types';
import TelefonoAcudiente from './TelefonoAcudiente';
import { Check, Copy } from 'lucide-react';

/**
 * Ficha del estudiante. Se llama "Información" y no "Editar" a proposito: la mayoria
 * entra a consultar.
 *
 * Quien puede editar lo decide el servidor (director del grupo, coordinacion,
 * superusuario). Aqui solo se evita ofrecer botones que fallarian.
 */
export default function Ficha({
  studentId,
  rol,
  slotId,
  directores,
  onVolver,
}: {
  studentId: string;
  rol: string | null;
  /** slotId del usuario, para compararlo con el mapa de directores. */
  slotId: string | null;
  /** Mapa grado -> slotId, el mismo documento espejo que consultan las reglas. */
  directores: Record<string, string>;
  onVolver: () => void;
}) {
  const [est, setEst] = useState<Student | null>(null);
  const [foto, setFoto] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progreso, setProgreso] = useState<number | null>(null);
  const [editando, setEditando] = useState(false);
  const [verQr, setVerQr] = useState(false);
  const [camara, setCamara] = useState(false);
  const [cuenta, setCuenta] = useState<MiCuenta | null>(null);

  useEffect(() => {
    void (async () => {
      const e = await leerEstudiante(studentId);
      setEst(e);
      if (e) setFoto(await urlDeFoto(studentId));
      // El puesto segun el SERVIDOR, que es contra el que evaluan las reglas.
      setCuenta(await leerMiCuenta());
    })();
  }, [studentId]);

  if (!est) return <p className="p-3 text-sm text-muted">Cargando ficha…</p>;

  // Se compara contra el grado DEL ESTUDIANTE, no contra el grupo que el docente tenga
  // abierto en la planilla: son cosas distintas y confundirlas daba permisos erráticos.
  // Es el mismo criterio que aplican las reglas, así que la interfaz y el servidor
  // dicen lo mismo.
  const esDirector = Boolean(slotId && directores[est.gradoActual] === slotId);
  const puedeEditar = rol === 'coordinador' || rol === 'superusuario' || esDirector;

  // El puesto que ve el servidor. Si difiere del que resuelve la interfaz, la app
  // habilita botones que las reglas rechazan: es el fallo mas confuso del sistema,
  // porque todo en pantalla dice que si y el servidor dice que no.
  const puestoServidor = cuenta?.slotId ?? null;
  const discrepa = cuenta !== null && esDirector && puestoServidor !== slotId;

  async function guardarFoto(blob: Blob) {
    setCamara(false);
    setError(null);
    setProgreso(0);
    try {
      const r = await subirFoto(studentId, blob, setProgreso);
      await actualizarFicha(studentId, { fotoPath: r.ruta });
      setFoto(r.url);
      setEst((p) => (p ? { ...p, fotoPath: r.ruta } : p));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setProgreso(null);
    }
  }

  const letras = iniciales(est);

  return (
    <div className="space-y-3">
      <button onClick={onVolver} className="text-sm text-accent">
        ← Volver
      </button>

      <div className="rounded-xl border border-line bg-card p-3">
        <div className="flex flex-wrap items-start gap-4">
          <div className="text-center">
            {foto ? (
              <img
                src={foto}
                alt={`${est.nombres} ${est.apellidos}`}
                className="h-28 w-21 rounded-lg object-cover"
                style={{ width: '5.25rem' }}
              />
            ) : (
              <div className="grid h-28 w-[5.25rem] place-items-center rounded-lg border border-dashed border-line-strong bg-elevated text-lg font-bold text-muted">
                {letras}
              </div>
            )}
            {puedeEditar ? (
              <button
                onClick={() => setCamara(true)}
                disabled={progreso !== null}
                className="mt-1 text-xs text-accent disabled:opacity-50"
              >
                {progreso !== null
                  ? `Subiendo ${progreso}%`
                  : foto
                    ? 'Cambiar foto'
                    : 'Tomar foto'}
              </button>
            ) : (
              <p className="mt-1 text-[0.65rem] leading-tight text-muted">Sin permiso de edición</p>
            )}
          </div>

          <div className="min-w-[12rem] grow">
            <h2 className="text-base font-semibold text-strong">{nombreCompleto(est)}</h2>
            <p className="text-xs text-muted">
              {est.gradoActual} · {est.sede.replace('_', ' ')}
              {!est.activo && ' · retirado'}
            </p>

            <dl className="mt-2 space-y-1 text-sm">
              {/*
                El parentesco va pegado al nombre, no en su propia fila: quien llama a
                una familia necesita saber "a quien" y "que es del estudiante" de un
                golpe, y son la misma pregunta. Si la ficha se importo antes de que
                existiera el campo, simplemente no aparece el parentesis.
              */}
              <Dato
                termino="Acudiente"
                valor={
                  est.parentesco?.trim()
                    ? `${est.acudiente} (${est.parentesco.trim()})`
                    : est.acudiente
                }
              />
              <Dato
                termino="Teléfonos"
                valor={
                  est.telefonos.length > 0 ? (
                    <span className="flex flex-col gap-1.5">
                      {est.telefonos.map((t, i) => (
                        <TelefonoAcudiente key={`${t}-${i}`} numero={t} />
                      ))}
                    </span>
                  ) : (
                    'sin teléfono registrado'
                  )
                }
              />
              {/*
                El caso de uso es una urgencia: el estudiante se lastimo y en la llamada
                al 123 o a la EPS piden el documento. Por eso va en cifra grande y
                tabular (para dictarlo sin equivocarse) y con un boton de copiar, en vez
                de un renglon mas de texto corrido.
              */}
              <Dato
                termino="Documento"
                valor={
                  est.docNumber ? (
                    <span className="flex flex-wrap items-center gap-2">
                      <b className="font-mono text-base tabular-nums tracking-wide text-strong">
                        {est.docType} {est.docNumber}
                      </b>
                      <BotonCopiar valor={est.docNumber} />
                    </span>
                  ) : (
                    `${est.docType} — sin registrar (vuelva a importar el grupo)`
                  )
                }
              />
            </dl>

            <div className="mt-2 flex flex-wrap gap-2">
              <button
                onClick={() => setVerQr(true)}
                className="rounded-lg border border-line px-3 py-1.5 text-sm text-strong"
              >
                Ver código QR
              </button>
              {puedeEditar && (
                <button
                  onClick={() => setEditando(true)}
                  className="rounded-lg border border-line px-3 py-1.5 text-sm text-strong"
                >
                  Editar contacto
                </button>
              )}
            </div>
          </div>
        </div>

        {error && (
          <div className="mt-3 rounded-lg border border-danger-soft bg-danger-soft p-2 text-sm text-danger-soft-fg">
            {error}
          </div>
        )}

        {/*
          Aviso de discrepancia. Va SIEMPRE visible y en rojo, no escondido en un
          desplegable: cuando ocurre, la persona esta a punto de pulsar un boton que va a
          fallar, y el mensaje del fallo llega demasiado tarde y sin la causa.
        */}
        {discrepa && (
          <div className="mt-3 rounded-lg border border-warning-soft bg-warning-soft p-2 text-xs text-warning-soft-fg">
            <b>Sus permisos van a fallar aunque los botones estén activos.</b> La
            aplicación lo reconoce como director de {est.gradoActual} con el puesto{' '}
            <b>{slotId}</b>, pero en el servidor su cuenta tiene el puesto{' '}
            <b>{puestoServidor ?? 'vacío'}</b>. Las reglas usan el del servidor.
            <br />
            Solución: el superusuario debe pulsar <b>«Crear y reparar cuentas»</b> en su
            panel; después cierre sesión y vuelva a entrar.
          </div>
        )}

        {/*
          El diagnostico va SIEMPRE, no solo cuando `!puedeEditar`. Estaba condicionado a
          no poder editar, que es justo el caso en que NO se necesita: el fallo real es
          creer que se puede y que el servidor lo niegue. Escondido asi, no sirvio de nada
          durante toda una sesion de busqueda.
        */}
        <details className="mt-3 rounded-lg border border-line p-2 text-xs text-muted">
          <summary className="cursor-pointer">
            {puedeEditar ? 'Ver contra qué comprueba el servidor' : '¿Por qué no puedo editar esta ficha?'}
          </summary>
            <p className="mt-1">
              La edición es de coordinación y del director del grupo del estudiante. Ser
              director no depende de su rol: sale del documento{' '}
              <code>asistenciaConfig/directores</code>, que asigna cada grado a un puesto.
            </p>
            <ul className="mt-1 space-y-0.5">
              <li>
                Grado del estudiante: <b>{est.gradoActual}</b>
              </li>
              <li>
                Director registrado para ese grado:{' '}
                <b>{directores[est.gradoActual] ?? 'ninguno'}</b>
              </li>
              <li>
                Su puesto <i>según la aplicación</i>: <b>{slotId ?? '—'}</b>
              </li>
              {/*
                La linea que faltaba. Sin ella no habia forma de ver, desde la propia
                aplicacion, que los dos lados estaban leyendo el puesto de sitios
                distintos.
              */}
              <li>
                Su puesto <i>según el servidor</i> (es el que mandan las reglas):{' '}
                <b>{cuenta === null ? 'consultando…' : (puestoServidor ?? 'vacío')}</b>
              </li>
              <li>
                Su cuenta: <b>{cuenta?.rol ?? '—'}</b>
                {cuenta && !cuenta.activo && ' · INACTIVA'}
              </li>
            </ul>
            <p className="mt-1">
              Los dos últimos deben coincidir. Si el del servidor está vacío, el
              superusuario tiene que pulsar «Crear y reparar cuentas». Si el director
              registrado no es el que debería, hay que pulsar «Sincronizar permisos».
            </p>
        </details>
      </div>

      {verQr && <ModalQr estudiante={est} onCerrar={() => setVerQr(false)} />}

      {camara && <Camara onListo={guardarFoto} onCancelar={() => setCamara(false)} />}

      {editando && (
        <ModalContacto
          estudiante={est}
          onCerrar={() => setEditando(false)}
          onGuardar={async (acudiente, parentesco, telefonos) => {
            setError(null);
            try {
              await actualizarFicha(studentId, { acudiente, parentesco, telefonos });
              setEst((p) => (p ? { ...p, acudiente, parentesco, telefonos } : p));
              setEditando(false);
            } catch (e) {
              setError((e as Error).message);
            }
          }}
        />
      )}
    </div>
  );
}

function Dato({ termino, valor }: { termino: string; valor: React.ReactNode }) {
  return (
    <div className="flex gap-2">
      <dt className="w-24 shrink-0 text-xs text-muted">{termino}</dt>
      <dd className="text-sm text-soft">{valor || <span className="text-muted">sin registrar</span>}</dd>
    </div>
  );
}

/**
 * Copiar al portapapeles con confirmacion visible.
 *
 * El aviso de "copiado" no es adorno: en una urgencia hay que poder pegar el numero en
 * la app del telefono sin volver a mirar la pantalla para comprobar que sirvio. Si el
 * navegador niega el portapapeles (pasa sin HTTPS), se dice, en vez de fingir que
 * funciono.
 */
export function BotonCopiar({
  valor,
  soloIcono = false,
}: {
  valor: string;
  /**
   * Sin texto, solo el icono. Se usa junto a los botones de llamar y WhatsApp, que son
   * iconos: una palabra suelta al lado de dos dibujos desequilibra la fila. En el numero
   * de documento sigue con texto, que ahi no compite con nada.
   */
  soloIcono?: boolean;
}) {
  const [estado, setEstado] = useState<'listo' | 'copiado' | 'error'>('listo');

  const rotulo =
    estado === 'copiado' ? 'Copiado' : estado === 'error' ? 'No se pudo copiar' : 'Copiar';

  return (
    <button
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(valor);
          setEstado('copiado');
        } catch {
          setEstado('error');
        }
        setTimeout(() => setEstado('listo'), 2000);
      }}
      // Sin texto visible, el `aria-label` deja de ser un detalle: es lo unico que oye
      // quien usa lector de pantalla.
      aria-label={soloIcono ? `${rotulo} el número` : undefined}
      title={soloIcono ? rotulo : undefined}
      className="grid min-h-9 min-w-9 place-items-center rounded-lg border border-line px-2 py-0.5 text-xs text-strong"
    >
      {soloIcono ? (
        estado === 'copiado' ? (
          <Check size={16} aria-hidden />
        ) : (
          <Copy size={16} aria-hidden />
        )
      ) : estado === 'copiado' ? (
        '✓ Copiado'
      ) : estado === 'error' ? (
        'No se pudo copiar'
      ) : (
        'Copiar'
      )}
    </button>
  );
}

/**
 * El QR contiene SOLO el token: una cadena opaca. Leido con un lector cualquiera no
 * revela nada del estudiante, y resolverlo exige estar dentro de la aplicacion.
 */
function ModalQr({ estudiante, onCerrar }: { estudiante: Student; onCerrar: () => void }) {
  const [img, setImg] = useState('');
  useEffect(() => {
    void QRCode.toDataURL(estudiante.qrToken, { width: 480, margin: 1 }).then(setImg);
  }, [estudiante.qrToken]);

  return (
    <Modal onCerrar={onCerrar}>
      <h3 className="text-sm font-semibold text-strong">
        {nombreCompleto(estudiante)}
      </h3>
      <p className="text-xs text-muted">{estudiante.gradoActual}</p>
      <div className="my-3 grid place-items-center">
        {img && <img src={img} alt="Código QR" className="w-56" />}
      </div>
      <p className="text-xs text-muted">
        Este código no contiene datos personales: leído con un lector cualquiera solo
        muestra una cadena sin significado. Si el estudiante lo pierde, se vuelve a
        mostrar <b>este mismo</b>; no se genera otro dentro del año.
      </p>
      <div className="mt-3 flex gap-2">
        <button
          onClick={() => window.print()}
          className="rounded-lg bg-accent px-3 py-1.5 text-sm text-accent-fg"
        >
          Imprimir
        </button>
        <button onClick={onCerrar} className="rounded-lg border border-line px-3 py-1.5 text-sm text-strong">
          Cerrar
        </button>
      </div>
    </Modal>
  );
}

/**
 * Camara con guia de encuadre. La guia no es decorativa: estas fotos se usan para
 * verificar identidad al escanear un QR, y una foto mal encuadrada no sirve para eso.
 */
function Camara({
  onListo,
  onCancelar,
}: {
  onListo: (b: Blob) => void;
  onCancelar: () => void;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const flujo = useRef<MediaStream | null>(null);

  useEffect(() => {
    let cancelado = false;
    navigator.mediaDevices
      ?.getUserMedia({ video: { facingMode: 'environment', width: 720, height: 960 } })
      .then((s) => {
        if (cancelado) return s.getTracks().forEach((t) => t.stop());
        flujo.current = s;
        if (video.current) video.current.srcObject = s;
      })
      .catch(() => setError('No fue posible abrir la cámara. Puede subir un archivo.'));
    return () => {
      cancelado = true;
      flujo.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  function capturar() {
    const v = video.current;
    if (!v) return;
    const lienzo = document.createElement('canvas');
    lienzo.width = v.videoWidth;
    lienzo.height = v.videoHeight;
    lienzo.getContext('2d')?.drawImage(v, 0, 0);
    lienzo.toBlob((b) => b && onListo(b), 'image/jpeg', 0.92);
  }

  return (
    <Modal onCerrar={onCancelar}>
      <h3 className="mb-2 text-sm font-semibold text-strong">Fotografía del estudiante</h3>
      {error ? (
        <div className="rounded-lg border border-danger-soft bg-danger-soft p-2 text-sm text-danger-soft-fg">
          {error}
        </div>
      ) : (
        <div className="relative mx-auto max-w-xs">
          <video ref={video} autoPlay playsInline muted className="w-full rounded-lg bg-black" />
          {/* Guía de encuadre: óvalo del rostro y línea de hombros. */}
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute left-1/2 top-[42%] aspect-[3/4] w-[52%] -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-dashed border-white/90" />
            <div className="absolute bottom-[6%] left-1/2 h-[22%] w-[74%] -translate-x-1/2 rounded-t-full border-2 border-b-0 border-dashed border-white/50" />
          </div>
        </div>
      )}
      <p className="mt-2 text-xs text-muted">
        Encuadre el rostro dentro del óvalo y los hombros en la línea inferior.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {!error && (
          <button
            onClick={capturar}
            className="rounded-lg bg-accent px-3 py-1.5 text-sm text-accent-fg"
          >
            Tomar fotografía
          </button>
        )}
        <label className="cursor-pointer rounded-lg border border-line px-3 py-1.5 text-sm text-strong">
          Subir archivo
          <input
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onListo(f);
            }}
          />
        </label>
        <button onClick={onCancelar} className="rounded-lg border border-line px-3 py-1.5 text-sm text-soft">
          Cancelar
        </button>
      </div>
    </Modal>
  );
}

function ModalContacto({
  estudiante,
  onCerrar,
  onGuardar,
}: {
  estudiante: Student;
  onCerrar: () => void;
  onGuardar: (acudiente: string, parentesco: string, telefonos: string[]) => Promise<void>;
}) {
  const [acudiente, setAcudiente] = useState(estudiante.acudiente);
  const [parentesco, setParentesco] = useState(estudiante.parentesco ?? '');
  // Un campo por telefono en vez de texto separado por comas: una coma de mas o de
  // menos ahi rompia el numero sin que se notara hasta la siguiente llamada fallida.
  const [telefonos, setTelefonos] = useState(
    estudiante.telefonos.length > 0 ? estudiante.telefonos : [''],
  );

  return (
    <Modal onCerrar={onCerrar}>
      <h3 className="text-sm font-semibold text-strong">Editar contacto</h3>
      <p className="mb-2 text-xs text-muted">
        El nombre, el documento y el grado vienen de Master2000 y no se editan aquí.
      </p>
      <label className="block text-xs text-muted">Acudiente</label>
      <input
        value={acudiente}
        onChange={(e) => setAcudiente(e.target.value)}
        className="mb-2 w-full rounded-lg border border-line bg-elevated px-2 py-1.5 text-sm"
      />
      {/*
        Texto libre a proposito: la afinidad viene tal cual de Master2000 y el catalogo
        real que usa el colegio es mas ancho que cualquier lista que se escriba aqui.
      */}
      <label className="block text-xs text-muted">Parentesco (madre, padre, tía…)</label>
      <input
        value={parentesco}
        onChange={(e) => setParentesco(e.target.value)}
        placeholder="Sin registrar"
        className="mb-2 w-full rounded-lg border border-line bg-elevated px-2 py-1.5 text-sm"
      />
      <label className="block text-xs text-muted">Teléfonos</label>
      <div className="space-y-1.5">
        {telefonos.map((t, i) => (
          <div key={i} className="flex gap-1.5">
            <input
              value={t}
              onChange={(e) =>
                setTelefonos((p) => p.map((x, j) => (j === i ? e.target.value : x)))
              }
              className="w-full rounded-lg border border-line bg-elevated px-2 py-1.5 text-sm"
            />
            <button
              onClick={() => setTelefonos((p) => p.filter((_, j) => j !== i))}
              disabled={telefonos.length === 1}
              className="grid min-h-9 min-w-9 place-items-center rounded-lg border border-line px-2 text-sm text-strong disabled:opacity-40"
            >
              Quitar
            </button>
          </div>
        ))}
      </div>
      <button
        onClick={() => setTelefonos((p) => [...p, ''])}
        className="mt-1.5 text-xs text-accent"
      >
        + Añadir teléfono
      </button>
      <div className="mt-3 flex gap-2">
        <button
          onClick={() =>
            void onGuardar(
              acudiente.trim(),
              parentesco.trim(),
              telefonos.map((t) => t.trim()).filter(Boolean),
            )
          }
          className="rounded-lg bg-accent px-3 py-1.5 text-sm text-accent-fg"
        >
          Guardar
        </button>
        <button onClick={onCerrar} className="rounded-lg border border-line px-3 py-1.5 text-sm text-strong">
          Cancelar
        </button>
      </div>
    </Modal>
  );
}

function Modal({ children, onCerrar }: { children: React.ReactNode; onCerrar: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-end bg-black/40 sm:place-items-center sm:p-4"
      onClick={onCerrar}
    >
      <div
        className="max-h-[90vh] w-full max-w-md overflow-auto rounded-t-2xl border border-line bg-card p-4 sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}
