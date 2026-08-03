import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { actualizarFicha, leerEstudiante } from './datos';
import { subirFoto, urlDeFoto } from './fotos';
import type { Student } from './domain/types';

/**
 * Ficha del estudiante. Se llama "Información" y no "Editar" a proposito: la mayoria
 * entra a consultar.
 *
 * Quien puede editar lo decide el servidor (director del grupo, coordinacion,
 * superusuario). Aqui solo se evita ofrecer botones que fallarian.
 */
export default function Ficha({
  studentId,
  puedeEditar,
  onVolver,
}: {
  studentId: string;
  puedeEditar: boolean;
  onVolver: () => void;
}) {
  const [est, setEst] = useState<Student | null>(null);
  const [foto, setFoto] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progreso, setProgreso] = useState<number | null>(null);
  const [editando, setEditando] = useState(false);
  const [verQr, setVerQr] = useState(false);
  const [camara, setCamara] = useState(false);

  useEffect(() => {
    void (async () => {
      const e = await leerEstudiante(studentId);
      setEst(e);
      if (e) setFoto(await urlDeFoto(studentId));
    })();
  }, [studentId]);

  if (!est) return <p className="p-3 text-sm text-muted">Cargando ficha…</p>;

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

  const iniciales =
    (est.nombres[0] ?? '').toUpperCase() + (est.apellidos[0] ?? '').toUpperCase();

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
                {iniciales}
              </div>
            )}
            {puedeEditar && (
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
            )}
          </div>

          <div className="min-w-[12rem] grow">
            <h2 className="text-base font-semibold text-strong">
              {est.apellidos}, {est.nombres}
            </h2>
            <p className="text-xs text-muted">
              {est.gradoActual} · {est.sede.replace('_', ' ')}
              {!est.activo && ' · retirado'}
            </p>

            <dl className="mt-2 space-y-1 text-sm">
              <Dato termino="Acudiente" valor={est.acudiente} />
              <Dato termino="Teléfonos" valor={est.telefonos.join(' · ')} />
              <Dato
                termino="Documento"
                valor={`${est.docType} — el número no se almacena en claro`}
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
      </div>

      {verQr && <ModalQr estudiante={est} onCerrar={() => setVerQr(false)} />}

      {camara && <Camara onListo={guardarFoto} onCancelar={() => setCamara(false)} />}

      {editando && (
        <ModalContacto
          estudiante={est}
          onCerrar={() => setEditando(false)}
          onGuardar={async (acudiente, telefonos) => {
            setError(null);
            try {
              await actualizarFicha(studentId, { acudiente, telefonos });
              setEst((p) => (p ? { ...p, acudiente, telefonos } : p));
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

function Dato({ termino, valor }: { termino: string; valor: string }) {
  return (
    <div className="flex gap-2">
      <dt className="w-24 shrink-0 text-xs text-muted">{termino}</dt>
      <dd className="text-sm text-soft">{valor || <span className="text-muted">sin registrar</span>}</dd>
    </div>
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
        {estudiante.apellidos}, {estudiante.nombres}
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
  onGuardar: (acudiente: string, telefonos: string[]) => Promise<void>;
}) {
  const [acudiente, setAcudiente] = useState(estudiante.acudiente);
  const [tel, setTel] = useState(estudiante.telefonos.join(', '));

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
      <label className="block text-xs text-muted">Teléfonos (separados por coma)</label>
      <input
        value={tel}
        onChange={(e) => setTel(e.target.value)}
        className="w-full rounded-lg border border-line bg-elevated px-2 py-1.5 text-sm"
      />
      <div className="mt-3 flex gap-2">
        <button
          onClick={() =>
            void onGuardar(
              acudiente.trim(),
              tel.split(',').map((t) => t.trim()).filter(Boolean),
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
