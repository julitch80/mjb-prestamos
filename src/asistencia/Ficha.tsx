import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import {
  abrirDireccionGrupo,
  actualizarFicha,
  guardarCorreoManual,
  guardarColumnas,
  guardarGuiaDeColor,
  leerAutoridadSede,
  leerDireccionGrupo,
  leerCasosRemitidos,
  leerConfigPermanencia,
  leerContactosDeEstudiante,
  leerEstudiante,
  leerMiCuenta,
  marcarCelda,
  registrarContacto,
  type MiCuenta,
} from './datos';
import {
  asignarColorEnGuia,
  colorDeEstudiante,
  cuantosConColor,
  ETIQUETA_COLOR_MAX,
  guiaDeColor,
  quitarColorDeGuia,
  renombrarColorEnGuia,
  validarEtiquetaColor,
} from './domain/direccion-grupo';
import { colorPorId, COLORES_GRUPO, estiloEtiqueta } from './domain/colores';
import { subirFoto, urlDeFoto } from './fotos';
import { iniciales, nombreCompleto } from './domain/nombres';
import { toDateKey } from './domain/ids';
import { DOMINIO_INSTITUCIONAL } from './domain/correos-workspace';
import { escribirAUno } from './domain/escribir-correo';
import {
  edadEn,
  MOTIVOS_SEMILLA,
  type CasoPermanencia,
  type MotivoFamilia,
  type PermanenciaConfig,
} from './domain/permanencia';
import type {
  DireccionGrupo,
  FamilyContact,
  OpcionColumna,
  Student,
} from './domain/types';
import DetalleCaso from './DetalleCaso';
import TelefonoAcudiente from './TelefonoAcudiente';
import { ModalRegistrarLlamada } from './RegistrarLlamada';
import { Check, Copy, UserCheck, UserX } from 'lucide-react';


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
  const [autoridadSede, setAutoridadSede] = useState<Record<string, string[]>>({});
  const [confirmandoRetiro, setConfirmandoRetiro] = useState(false);
  // Numero sobre el que se pulso "Llamar", pendiente de que se decida si se registra la
  // gestion. `null` = no hay aviso pendiente.
  const [numeroLlamado, setNumeroLlamado] = useState<string | null>(null);
  const [registrandoLlamada, setRegistrandoLlamada] = useState(false);
  /**
   * El cuaderno del director, SOLO para la guia de color del anillo de la foto.
   *
   * Se lee aqui y no se recibe por props porque la ficha se abre desde cuatro sitios
   * distintos (planilla, direccion de grupo, panel del estudiante, centros) y hacer que
   * los cuatro carguen y pasen el cuaderno seria repetir la misma lectura cuatro veces.
   *
   * Queda en `null` para quien no dirige el grupo, y ni siquiera se pide: la regla del
   * cuaderno es `asisIsDirectorOf(grado)`, asi que pedirlo de todas formas seria un
   * permission-denied garantizado en la consola de coordinacion cada vez que abre una ficha.
   */
  const [direccion, setDireccion] = useState<DireccionGrupo | null>(null);
  const [guiaAbierta, setGuiaAbierta] = useState(false);
  /**
   * Catalogo de "que dijo la familia". Se pide SOLO al abrir el modal de la llamada, no
   * al abrir la ficha: la ficha se abre decenas de veces al dia y una llamada se
   * registra muy de vez en cuando. Hasta que llegue del servidor se ofrece la semilla,
   * para que nunca haya un desplegable vacio.
   */
  const [motivosFamilia, setMotivosFamilia] = useState<MotivoFamilia[]>(MOTIVOS_SEMILLA);

  useEffect(() => {
    void (async () => {
      const e = await leerEstudiante(studentId);
      setEst(e);
      if (e) setFoto(await urlDeFoto(studentId));
      // El puesto segun el SERVIDOR, que es contra el que evaluan las reglas.
      setCuenta(await leerMiCuenta());
      setAutoridadSede(await leerAutoridadSede());
    })();
  }, [studentId]);

  useEffect(() => {
    if (!registrandoLlamada) return;
    let vivo = true;
    void leerConfigPermanencia().then((c) => {
      if (vivo) setMotivosFamilia(c.motivos);
    });
    return () => {
      vivo = false;
    };
  }, [registrandoLlamada]);

  const grado = est?.gradoActual ?? null;
  const dirigeEsteGrupo = Boolean(grado && slotId && directores[grado] === slotId);
  const anio = new Date().getFullYear();

  // El cuaderno solo se pide cuando quien mira dirige ESE grado. Ver la nota del estado.
  useEffect(() => {
    if (!grado || !dirigeEsteGrupo) {
      setDireccion(null);
      return;
    }
    let vivo = true;
    void leerDireccionGrupo(grado, anio).then((d) => {
      if (vivo) setDireccion(d);
    });
    return () => {
      vivo = false;
    };
  }, [grado, dirigeEsteGrupo, anio]);

  /**
   * El caso de permanencia que coordinación le REMITIÓ al director de este grupo. Solo se
   * pide si quien mira dirige el grupo, y solo existe si coordinación lo remitió: por su
   * cuenta el director no ve casos (Julián, 2026-09-17). Pedirlo a los demás sería un
   * permission-denied seguro en la consola.
   */
  const [remitido, setRemitido] = useState<{
    caso: CasoPermanencia;
    contactos: FamilyContact[];
    config: PermanenciaConfig;
  } | null>(null);
  const [recargaRemitido, setRecargaRemitido] = useState(0);
  useEffect(() => {
    if (!grado || !dirigeEsteGrupo) {
      setRemitido(null);
      return;
    }
    let vivo = true;
    void (async () => {
      try {
        const caso = (await leerCasosRemitidos(grado)).find((c) => c.studentId === studentId);
        if (!caso) {
          if (vivo) setRemitido(null);
          return;
        }
        const [contactos, config] = await Promise.all([
          leerContactosDeEstudiante(grado, studentId),
          leerConfigPermanencia(),
        ]);
        if (vivo) setRemitido({ caso, contactos, config });
      } catch {
        // Sin remisión, o sin permiso todavía: la ficha sigue funcionando igual.
        if (vivo) setRemitido(null);
      }
    })();
    return () => {
      vivo = false;
    };
  }, [grado, dirigeEsteGrupo, studentId, recargaRemitido]);

  const colorClasificacion = colorDeEstudiante(direccion, studentId);
  const tonoClasificacion = colorPorId(colorClasificacion?.colorId);

  /**
   * Aplica un cambio de la guia. Recarga el cuaderno del servidor al terminar en vez de
   * remendar el estado local: las escrituras van sin esperar acuse (`registrarEnvio`),
   * asi que lo que se relee es la cache local ya actualizada, y asi la pantalla no puede
   * quedar mostrando una guia que no coincide con la del cuaderno.
   */
  async function aplicarEnGuia(fn: () => Promise<void>) {
    if (!grado) return;
    try {
      await fn();
      setDireccion(await leerDireccionGrupo(grado, anio));
    } catch (e) {
      setError((e as Error).message);
    }
  }

  if (!est) return <p className="p-3 text-sm text-muted">Cargando ficha…</p>;

  // Se compara contra el grado DEL ESTUDIANTE, no contra el grupo que el docente tenga
  // abierto en la planilla: son cosas distintas y confundirlas daba permisos erráticos.
  // Es el mismo criterio que aplican las reglas, así que la interfaz y el servidor
  // dicen lo mismo.
  const esDirector = Boolean(slotId && directores[est.gradoActual] === slotId);
  const puedeEditar = rol === 'coordinador' || rol === 'superusuario' || esDirector;

  // Registrar una llamada a la familia es MAS ESTRECHO que editar la ficha: la regla de
  // `asistenciaFamilyContacts` (rules/asistencia.rules) solo deja crear al director del
  // grupo o a coordinacion CON AUTORIDAD SOBRE LA SEDE del estudiante — el superusuario
  // queda fuera a proposito, la misma razon por la que tampoco marca asistencia. Por eso
  // esto NO se calcula con `puedeEditar`, que si incluye al superusuario.
  const puedeContactar = Boolean(
    esDirector ||
      (cuenta?.rol === 'coordinador' &&
        cuenta.activo &&
        (autoridadSede[est.sede] ?? []).includes(cuenta.correo)),
  );

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
        {/*
          Foto redonda arriba y centrada, como en la toma de asistencia, con el nombre
          debajo (Julian, 2026-09-17: "me gusta mas el estilo que tiene la toma de
          asistencia"). Antes era una foto rectangular a la izquierda con todo el texto al
          lado, que en el celular dejaba los datos en una columna estrecha.
        */}
        <div className="flex flex-col items-center gap-3">
          <div className="text-center">
            {foto ? (
              <img
                src={foto}
                alt={`${est.nombres} ${est.apellidos}`}
                className="h-28 w-28 rounded-full object-cover"
                /* El anillo va por `boxShadow` y no por `border`, igual que en
                   `estiloAnillo`: un borde cambiaria el tamaño de la foto. */
                style={tonoClasificacion ? { boxShadow: `0 0 0 3px ${tonoClasificacion.hex}` } : {}}
              />
            ) : (
              <div className="grid h-28 w-28 place-items-center rounded-full border border-dashed border-line-strong bg-elevated text-2xl font-bold text-muted">
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

            {/* GUIA DE COLOR — solo para el director de ESTE grupo. Va pegada a la foto
                porque lo que colorea es la foto: puesta entre los datos del acudiente se
                leeria como un dato del estudiante, y no lo es — es una clasificacion que
                el director hace y deshace. */}
            {dirigeEsteGrupo && (
              <button
                onClick={() => setGuiaAbierta(true)}
                title="Color de clasificación de este estudiante"
                className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg border px-2 py-1.5 text-[0.7rem]"
                style={
                  colorClasificacion
                    ? estiloEtiqueta(tonoClasificacion)
                    : undefined
                }
              >
                <span
                  style={
                    tonoClasificacion
                      ? { backgroundColor: tonoClasificacion.hex }
                      : undefined
                  }
                  className={[
                    'h-3 w-3 shrink-0 rounded-full',
                    tonoClasificacion ? '' : 'border border-dashed border-line-strong',
                  ].join(' ')}
                />
                <span className="truncate">
                  {colorClasificacion ? colorClasificacion.etiqueta : 'Sin clasificar'}
                </span>
              </button>
            )}
          </div>

          <div className="w-full">
            <h2 className="text-center text-lg font-semibold text-strong">{nombreCompleto(est)}</h2>
            <p className="text-center text-xs text-muted">
              {est.gradoActual} · {est.sede.replace('_', ' ')}
              {!est.activo && ' · retirado'}
            </p>

            {/*
              PRIMERA ETAPA: con quien se habla. Acudiente, telefonos y correo, que es a lo
              que se entra a la ficha el 90% de las veces. Todo lo demas queda detras del
              desplegable de abajo, sobre todo pensando en el celular.
            */}
            <dl className="mt-3 text-sm">
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
                        <TelefonoAcudiente
                          key={`${t}-${i}`}
                          numero={t}
                          // Solo se ofrece dejar constancia a quien la regla se lo va a
                          // aceptar; a los demas el boton de llamar sigue funcionando,
                          // simplemente no aparece el aviso de despues.
                          onLlamar={puedeContactar ? setNumeroLlamado : undefined}
                        />
                      ))}
                    </span>
                  ) : (
                    'sin teléfono registrado'
                  )
                }
              />
              {(est.correoInstitucional || puedeEditar) && (
                <Dato
                  termino="Correo"
                  valor={
                    <CorreoDelEstudiante
                      est={est}
                      puedeEditar={puedeEditar}
                      onGuardar={async (correo) => {
                        await guardarCorreoManual(studentId, correo);
                        setEst((p) =>
                          p
                            ? {
                                ...p,
                                correoInstitucional: correo ?? undefined,
                                correoOrigen: correo ? 'manual' : undefined,
                                correoVerificadoEn: correo ? toDateKey(new Date()) : undefined,
                                correoCuentaActiva: undefined,
                              }
                            : p,
                        );
                      }}
                    />
                  }
                />
              )}
            </dl>

            {/*
              SEGUNDA ETAPA: lo que no se necesita para llamar. El documento vive aqui
              aunque su caso de uso sea urgente (dictarlo al 123 o a la EPS): abrir un
              desplegable es un toque, y tenerlo siempre a la vista costaba que los
              telefonos quedaran fuera de pantalla en el celular.
            */}
            <details className="mt-3 rounded-lg border border-line bg-elevated p-2">
              <summary className="cursor-pointer text-sm text-accent">Más datos del estudiante</summary>
              <dl className="mt-2 text-sm">
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
              {/*
                Datos del listado ampliado del Master (2026-09-16), para Guardianes de la
                Permanencia. Solo aparecen si la ficha ya los tiene: cuatro renglones de
                "sin registrar" en cada ficha vieja serian ruido, no informacion.
              */}
              {(est.fechaNacimiento || est.sexo || est.matricula || est.direccion || est.barrio) && (
                <>
                  <Dato
                    termino="Nacimiento"
                    valor={
                      est.fechaNacimiento
                        ? `${est.fechaNacimiento}${
                            edadEn(est.fechaNacimiento, toDateKey(new Date())) !== null
                              ? ` · ${edadEn(est.fechaNacimiento, toDateKey(new Date()))} años`
                              : ''
                          }`
                        : ''
                    }
                  />
                  <Dato
                    termino="Sexo"
                    valor={est.sexo === 'F' ? 'Femenino' : est.sexo === 'M' ? 'Masculino' : est.sexo ?? ''}
                  />
                  <Dato termino="Matrícula" valor={est.matricula ?? ''} />
                  <Dato
                    termino="Dirección"
                    valor={[est.direccion, est.barrio].filter(Boolean).join(' · ')}
                  />
                </>
              )}
              </dl>
            </details>

            {remitido && (
              <details open className="mt-3 rounded-lg border border-info-soft bg-info-soft p-2">
                <summary className="cursor-pointer text-sm font-semibold text-info-soft-fg">
                  Coordinación le remitió el caso de permanencia de este estudiante
                </summary>
                <DetalleCaso
                  caso={remitido.caso}
                  estudiante={est}
                  contactos={remitido.contactos}
                  config={remitido.config}
                  modo="aporte"
                  onCambio={async () => setRecargaRemitido((n) => n + 1)}
                />
              </details>
            )}

            {/*
              Aviso discreto tras pulsar "Llamar": NADA se registra solo. El sistema no
              sabe si la llamada de verdad ocurrio, solo que se toco el boton — por eso
              esto es una oferta con un boton, no una hoja que se abre encima sin
              pedirlo.
            */}
            {numeroLlamado && !registrandoLlamada && (
              <div className="mt-2 flex items-center gap-2 rounded-lg border border-line bg-elevated p-2 text-xs text-muted">
                <span className="grow">¿Registrar la gestión de esta llamada?</span>
                <button
                  onClick={() => setRegistrandoLlamada(true)}
                  className="rounded-lg border border-line px-2 py-1 text-xs text-strong"
                >
                  Registrar llamada
                </button>
                <button
                  onClick={() => setNumeroLlamado(null)}
                  aria-label="Descartar aviso de llamada"
                  className="grid min-h-9 min-w-9 place-items-center text-muted"
                >
                  ✕
                </button>
              </div>
            )}

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

      {/*
        Zona de peligro, separada del resto: retirar (y reintegrar) es del mismo
        `puedeEditar` que edita el contacto, pero es una accion que cambia si el
        estudiante aparece en planillas y conteos, asi que lleva sus propios tokens de
        peligro y su propia confirmacion — no debe confundirse con "Editar contacto".
      */}
      {puedeEditar && (
        <div className="rounded-xl border border-danger-soft bg-danger-soft p-3">
          {est.activo ? (
            <>
              <p className="text-xs text-danger-soft-fg">
                Retirar no borra nada: el estudiante deja de aparecer en planillas y
                conteos, pero su historial se conserva y se puede reintegrar cuando haga
                falta.
              </p>
              <button
                onClick={() => setConfirmandoRetiro(true)}
                className="mt-2 flex min-h-9 items-center gap-1.5 rounded-lg border border-danger-soft px-3 py-1.5 text-sm text-danger-soft-fg"
              >
                <UserX size={16} aria-hidden />
                Marcar como retirado
              </button>
            </>
          ) : (
            <>
              <p className="flex items-center gap-1.5 text-sm font-semibold text-danger-soft-fg">
                <UserX size={16} aria-hidden />
                Estudiante retirado
              </p>
              <p className="mt-1 text-xs text-danger-soft-fg">
                No aparece en planillas ni conteos. Su historial sigue intacto.
              </p>
              <button
                onClick={async () => {
                  setError(null);
                  try {
                    await actualizarFicha(studentId, { activo: true });
                    setEst((p) => (p ? { ...p, activo: true } : p));
                  } catch (e) {
                    setError((e as Error).message);
                  }
                }}
                className="mt-2 flex min-h-9 items-center gap-1.5 rounded-lg border border-danger-soft px-3 py-1.5 text-sm text-danger-soft-fg"
              >
                <UserCheck size={16} aria-hidden />
                Reintegrar
              </button>
            </>
          )}
        </div>
      )}

      {confirmandoRetiro && (
        <ModalConfirmarRetiro
          estudiante={est}
          onCerrar={() => setConfirmandoRetiro(false)}
          onConfirmar={async () => {
            setError(null);
            try {
              await actualizarFicha(studentId, { activo: false });
              setEst((p) => (p ? { ...p, activo: false } : p));
              setConfirmandoRetiro(false);
            } catch (e) {
              setError((e as Error).message);
            }
          }}
        />
      )}

      {registrandoLlamada && numeroLlamado && (
        <ModalRegistrarLlamada
          numero={numeroLlamado}
          motivosFamilia={motivosFamilia}
          onCerrar={() => setRegistrandoLlamada(false)}
          onGuardar={async (llamada) => {
            setError(null);
            try {
              await registrarContacto({
                studentId,
                grado: est.gradoActual,
                sede: est.sede,
                fecha: toDateKey(new Date()),
                telefonoUsado: numeroLlamado,
                ...llamada,
              });
              setRegistrandoLlamada(false);
              setNumeroLlamado(null);
            } catch (e) {
              setError((e as Error).message);
            }
          }}
        />
      )}

      {verQr && <ModalQr estudiante={est} onCerrar={() => setVerQr(false)} />}

      {camara && <Camara onListo={guardarFoto} onCancelar={() => setCamara(false)} />}

      {guiaAbierta && grado && (
        <SheetGuiaColor
          direccion={direccion}
          actual={colorClasificacion}
          /* Un color que ya esta en la guia: solo hay que escribir la casilla. Ni se
             tocan las columnas ni se reescribe su palabra. */
          onElegirExistente={(opcion) => {
            setGuiaAbierta(false);
            const guia = guiaDeColor(direccion);
            if (!guia) return;
            void aplicarEnGuia(() =>
              marcarCelda(grado, anio, studentId, guia.columnaId, opcion.opcionId),
            );
          }}
          /* Color nuevo: puede haber que ESTRENAR el cuaderno entero (si el director
             nunca lo abrio), crear la columna de la guia y ademas escribir la casilla.
             Van en ese orden a proposito: si el cuaderno no existe, `marcarCelda` haria
             un `updateDoc` sobre un documento inexistente y fallaria. */
          onCrear={(colorId, etiqueta) => {
            setGuiaAbierta(false);
            void aplicarEnGuia(async () => {
              const base = direccion ?? (await abrirDireccionGrupo(grado, anio));
              const cambio = asignarColorEnGuia(base, colorId, etiqueta);
              await guardarGuiaDeColor(grado, anio, cambio.columnas, cambio.columnaColorId);
              await marcarCelda(grado, anio, studentId, cambio.columnaColorId, cambio.opcionId);
            });
          }}
          onRenombrar={(opcionId, etiqueta) => {
            setGuiaAbierta(false);
            if (!direccion) return;
            void aplicarEnGuia(() =>
              guardarColumnas(grado, anio, renombrarColorEnGuia(direccion, opcionId, etiqueta)),
            );
          }}
          onQuitarDelEstudiante={() => {
            setGuiaAbierta(false);
            const guia = guiaDeColor(direccion);
            if (!guia) return;
            void aplicarEnGuia(() => marcarCelda(grado, anio, studentId, guia.columnaId, null));
          }}
          /* Quitar el color se lleva las casillas de todos los que lo tenian, en la MISMA
             escritura: ver `quitarColorDeGuia`. */
          onQuitarDeLaGuia={(opcionId) => {
            setGuiaAbierta(false);
            if (!direccion) return;
            const { columnas, valores } = quitarColorDeGuia(direccion, opcionId);
            void aplicarEnGuia(() => guardarColumnas(grado, anio, columnas, valores));
          }}
          onCerrar={() => setGuiaAbierta(false)}
        />
      )}

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

/**
 * El correo institucional: se ve, se escribe a mano y se quita. Lo edita quien puede editar la
 * ficha — el director del grupo y coordinación—, que es lo que reparte el trabajo de completar
 * los que la importación no pudo resolver sola.
 *
 * Se escribe solo la parte de antes de la arroba y el dominio se pone aquí: es la fuente de
 * error más tonta y más frecuente, y así no existe.
 */
function CorreoDelEstudiante({
  est,
  puedeEditar,
  onGuardar,
}: {
  est: Student;
  puedeEditar: boolean;
  onGuardar: (correo: string | null) => Promise<void>;
}) {
  const [editando, setEditando] = useState(false);
  const [texto, setTexto] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  async function guardar(correo: string | null) {
    setOcupado(true);
    setError(null);
    try {
      await onGuardar(correo);
      setEditando(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setOcupado(false);
    }
  }

  if (!editando) {
    const escribir = est.correoInstitucional ? escribirAUno(est.correoInstitucional) : null;
    return (
      <span>
        {escribir ? (
          <a
            href={escribir.gmail}
            target="_blank"
            rel="noreferrer"
            title="Abre Gmail con su dirección puesta"
            className="break-all text-accent underline"
          >
            {est.correoInstitucional}
          </a>
        ) : (
          <span className="text-muted">sin correo</span>
        )}
        {puedeEditar && (
          <button
            onClick={() => {
              setTexto(est.correoInstitucional?.split('@')[0] ?? '');
              setEditando(true);
            }}
            className="ml-2 text-xs text-accent underline"
          >
            {est.correoInstitucional ? 'Cambiar' : 'Poner correo'}
          </button>
        )}
        {escribir && (
          <span className="block text-xs text-muted">
            <a href={escribir.mailto} className="underline">
              escribir con el programa de correo
            </a>
            {' · '}
            {est.correoOrigen === 'manual' ? 'Puesto a mano' : 'Desde Workspace'}
            {est.correoVerificadoEn ? ` · ${est.correoVerificadoEn}` : ''}
            {est.correoCuentaActiva === false ? ' · la cuenta estaba suspendida' : ''}
          </span>
        )}
      </span>
    );
  }

  const local = texto.trim().toLowerCase().split('@')[0];
  const valido = /^[a-z0-9]+([._-][a-z0-9]+)*$/.test(local);

  return (
    <span className="block">
      <span className="flex flex-wrap items-center gap-1">
        <input
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="nombre.apellido"
          autoFocus
          className="min-w-0 flex-1 rounded-lg border border-line bg-elevated px-2 py-1 text-sm"
        />
        <span className="text-xs text-muted">@{DOMINIO_INSTITUCIONAL}</span>
      </span>
      <span className="mt-1 flex flex-wrap gap-2">
        <button
          onClick={() => void guardar(`${local}@${DOMINIO_INSTITUCIONAL}`)}
          disabled={!valido || ocupado}
          className="rounded-lg bg-accent px-3 py-1 text-xs text-on-accent disabled:opacity-50"
        >
          Guardar
        </button>
        <button onClick={() => setEditando(false)} className="text-xs text-soft underline">
          Cancelar
        </button>
        {est.correoInstitucional && (
          <button
            onClick={() => void guardar(null)}
            disabled={ocupado}
            className="text-xs text-danger-soft-fg underline disabled:opacity-50"
          >
            Quitar el correo
          </button>
        )}
      </span>
      {texto.trim() && !valido && (
        <span className="mt-1 block text-xs text-warning-soft-fg">
          Solo letras, números, puntos y guiones: escribe lo que va antes de la arroba.
        </span>
      )}
      {error && <span className="mt-1 block text-xs text-danger-soft-fg">{error}</span>}
    </span>
  );
}

/**
 * Un renglón de la ficha. En el celular la etiqueta va ARRIBA y el valor debajo, a todo el
 * ancho; desde pantallas medianas, en dos columnas. Antes eran siempre dos columnas con la
 * etiqueta en 6rem fijos, y en el celular un correo largo
 * (`valentina.arredondo.gonzalez@…`) quedaba apretado en media pantalla y se desordenaba con
 * el resto (Julián, 2026-09-17).
 */
function Dato({ termino, valor }: { termino: string; valor: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 border-b border-line py-1.5 last:border-b-0 sm:flex-row sm:gap-2 sm:border-b-0 sm:py-0.5">
      <dt className="text-xs text-muted sm:w-24 sm:shrink-0 sm:pt-0.5">{termino}</dt>
      <dd className="min-w-0 break-words text-sm text-soft">
        {valor || <span className="text-muted">sin registrar</span>}
      </dd>
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

/**
 * Confirmacion de retiro. No es un `window.confirm`: la decision borra al estudiante de
 * planillas y conteos de un click, y necesita explicar en el momento — no despues del
 * click — que no se pierde nada y que se puede deshacer.
 */
function ModalConfirmarRetiro({
  estudiante,
  onCerrar,
  onConfirmar,
}: {
  estudiante: Student;
  onCerrar: () => void;
  onConfirmar: () => Promise<void>;
}) {
  return (
    <Modal onCerrar={onCerrar}>
      <h3 className="text-sm font-semibold text-strong">
        ¿Marcar a {nombreCompleto(estudiante)} como retirado?
      </h3>
      <ul className="mt-2 space-y-1 text-sm text-soft">
        <li>No se borra nada: la ficha y su historial de sesiones quedan intactos.</li>
        <li>Desaparece de las planillas y de los conteos de asistencia.</li>
        <li>Se puede reintegrar en cualquier momento desde esta misma ficha.</li>
      </ul>
      <div className="mt-3 flex gap-2">
        <button
          onClick={() => void onConfirmar()}
          className="rounded-lg border border-danger-soft bg-danger-soft px-3 py-1.5 text-sm text-danger-soft-fg"
        >
          Marcar como retirado
        </button>
        <button onClick={onCerrar} className="rounded-lg border border-line px-3 py-1.5 text-sm text-strong">
          Cancelar
        </button>
      </div>
    </Modal>
  );
}

/**
 * Deja constancia de una llamada YA hecha (el boton de "Llamar" ya se pulso antes de
 * llegar aqui). No sugiere un resultado por defecto: que contesten o no, y el motivo,
 * los decide quien llamo, no la pantalla.
 */

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

/**
 * Guia de color del director: elegir el color del anillo de la foto, y la palabra que
 * dice para que es (Julian, 2026-09-07).
 *
 * Mismo patron de hoja modal que `SelectorColor` de `Planilla.tsx`: no se inventa otro
 * mecanismo de seleccion solo porque aqui el color ademas signifique algo.
 *
 * LA DIFERENCIA CON EL COLOR DEL GRUPO, que es lo que hay que tener claro al leer esto:
 * aquel es una preferencia del dispositivo y no significa nada; este es una CLASIFICACION
 * sobre un menor, vive en el cuaderno del director y la comparten varios estudiantes. Por
 * eso aqui hay palabras, avisos de "esto afecta a 7" y confirmacion para quitar, y alli
 * no hacia falta nada de eso.
 */
function SheetGuiaColor({
  direccion,
  actual,
  onElegirExistente,
  onCrear,
  onRenombrar,
  onQuitarDelEstudiante,
  onQuitarDeLaGuia,
  onCerrar,
}: {
  direccion: DireccionGrupo | null;
  actual: OpcionColumna | null;
  onElegirExistente: (opcion: OpcionColumna) => void;
  onCrear: (colorId: string, etiqueta: string) => void;
  onRenombrar: (opcionId: string, etiqueta: string) => void;
  onQuitarDelEstudiante: () => void;
  onQuitarDeLaGuia: (opcionId: string) => void;
  onCerrar: () => void;
}) {
  const guia = guiaDeColor(direccion);
  const usados = new Map((guia?.opciones ?? []).map((o) => [o.colorId, o]));

  /** Color recien tocado que todavia no tiene palabra, o el que se esta renombrando. */
  const [pidiendo, setPidiendo] = useState<
    { modo: 'crear'; colorId: string } | { modo: 'renombrar'; opcion: OpcionColumna } | null
  >(null);
  const [palabra, setPalabra] = useState('');
  const [errorPalabra, setErrorPalabra] = useState<string | null>(null);
  const [confirmandoQuitar, setConfirmandoQuitar] = useState<OpcionColumna | null>(null);

  function tocarColor(colorId: string) {
    const existente = usados.get(colorId);
    // Un color que ya esta en la guia se aplica y punto: su palabra ya la decidio el
    // director cuando lo estreno, y volver a preguntarla desde el segundo estudiante le
    // cambiaria la clasificacion al primero.
    if (existente) {
      onElegirExistente(existente);
      return;
    }
    setPidiendo({ modo: 'crear', colorId });
    setPalabra('');
    setErrorPalabra(null);
  }

  function confirmarPalabra() {
    if (!pidiendo) return;
    const opcionIgnorada = pidiendo.modo === 'renombrar' ? pidiendo.opcion.opcionId : undefined;
    const problema = validarEtiquetaColor(palabra, guia, opcionIgnorada);
    if (problema) {
      setErrorPalabra(problema);
      return;
    }
    if (pidiendo.modo === 'crear') onCrear(pidiendo.colorId, palabra.trim());
    else onRenombrar(pidiendo.opcion.opcionId, palabra.trim());
  }

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-end bg-black/40 p-0 sm:place-items-center sm:p-4"
      onClick={onCerrar}
    >
      <div
        className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-t-2xl border border-line bg-card p-4 sm:rounded-2xl"
        onClick={(ev) => ev.stopPropagation()}
      >
        <p className="text-sm font-semibold text-strong">Color de clasificación</p>
        <p className="mt-0.5 text-xs text-muted">
          Su guía de colores para este grupo. Varios estudiantes pueden llevar el mismo
          color: es lo que hace que sirva para clasificar. Solo la ve usted, como director.
        </p>

        {/* PEDIR LA PALABRA. Ocupa la hoja entera mientras esta abierto: elegir un color
            y bautizarlo son dos pasos de la misma decision, y mezclarlos con la paleta
            invita a dejar colores sin palabra, que es justo lo que no debe pasar. */}
        {pidiendo ? (
          <div className="mt-3 space-y-2">
            <div className="flex items-center gap-2">
              <span
                style={{
                  backgroundColor:
                    colorPorId(
                      pidiendo.modo === 'crear' ? pidiendo.colorId : pidiendo.opcion.colorId,
                    )?.hex,
                }}
                className="h-7 w-7 shrink-0 rounded-full"
              />
              <label className="text-sm text-strong">
                {pidiendo.modo === 'crear' ? '¿Para qué es este color?' : 'Nueva palabra'}
              </label>
            </div>
            <input
              autoFocus
              value={palabra}
              maxLength={ETIQUETA_COLOR_MAX}
              onChange={(ev) => {
                setPalabra(ev.target.value);
                setErrorPalabra(null);
              }}
              onKeyDown={(ev) => ev.key === 'Enter' && confirmarPalabra()}
              placeholder="Refuerzo, Al día, Beca…"
              className="w-full rounded-lg border border-line bg-elevated p-2 text-sm text-strong"
            />
            {pidiendo.modo === 'renombrar' && (
              <p className="text-xs text-muted">
                Esta palabra la comparten{' '}
                <strong className="text-soft">
                  {cuantosConColor(direccion, pidiendo.opcion.opcionId)} estudiante(s)
                </strong>
                : les cambia a todos a la vez.
              </p>
            )}
            {errorPalabra && (
              <p className="text-xs text-danger-soft-fg">{errorPalabra}</p>
            )}
            <div className="flex gap-2">
              <button
                onClick={confirmarPalabra}
                className="flex-1 rounded-lg bg-accent p-2 text-sm font-medium text-accent-fg"
              >
                Guardar
              </button>
              <button
                onClick={() => setPidiendo(null)}
                className="flex-1 rounded-lg border border-line p-2 text-sm text-soft"
              >
                Cancelar
              </button>
            </div>
          </div>
        ) : confirmandoQuitar ? (
          <div className="mt-3 space-y-2">
            <p className="text-sm text-strong">
              Quitar «{confirmandoQuitar.etiqueta}» de la guía
            </p>
            <p className="text-xs text-muted">
              Se le quita a los{' '}
              <strong className="text-soft">
                {cuantosConColor(direccion, confirmandoQuitar.opcionId)} estudiante(s)
              </strong>{' '}
              que lo tienen, y el color vuelve a quedar libre. No borra nada más del
              cuaderno.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => onQuitarDeLaGuia(confirmandoQuitar.opcionId)}
                className="flex-1 rounded-lg border border-danger-soft bg-danger-soft p-2 text-sm font-medium text-danger-soft-fg"
              >
                Quitar de la guía
              </button>
              <button
                onClick={() => setConfirmandoQuitar(null)}
                className="flex-1 rounded-lg border border-line p-2 text-sm text-soft"
              >
                Cancelar
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="mt-3 grid grid-cols-4 gap-2">
              {COLORES_GRUPO.map((c) => {
                const opcion = usados.get(c.id);
                const elegido = actual?.colorId === c.id;
                return (
                  <button
                    key={c.id}
                    onClick={() => tocarColor(c.id)}
                    title={opcion ? opcion.etiqueta : `${c.nombre} — sin usar todavía`}
                    className="flex flex-col items-center gap-1 rounded-lg border border-line p-2 hover:bg-hover"
                  >
                    <span
                      style={{ backgroundColor: c.hex }}
                      className={[
                        'h-7 w-7 rounded-full',
                        elegido ? 'ring-2 ring-line-strong ring-offset-2' : '',
                      ].join(' ')}
                    />
                    {/* La palabra manda sobre el nombre del tono: el director busca
                        "Refuerzo", no "Rosa". Un color sin estrenar se marca como tal
                        para que se vea de un golpe cuales ya significan algo. */}
                    <span
                      className={[
                        'w-full truncate text-center text-[0.65rem]',
                        opcion ? 'font-semibold text-strong' : 'text-muted',
                      ].join(' ')}
                    >
                      {opcion ? opcion.etiqueta : 'sin usar'}
                    </span>
                  </button>
                );
              })}
            </div>

            {actual && (
              <div className="mt-3 space-y-2 rounded-lg border border-line bg-elevated p-2">
                <p className="text-xs text-muted">
                  Este estudiante está en{' '}
                  <strong className="text-strong">{actual.etiqueta}</strong>, junto con{' '}
                  {cuantosConColor(direccion, actual.opcionId) - 1} más.
                </p>
                <button
                  onClick={() => {
                    setPidiendo({ modo: 'renombrar', opcion: actual });
                    setPalabra(actual.etiqueta);
                    setErrorPalabra(null);
                  }}
                  className="w-full rounded-lg border border-line p-2 text-sm text-soft"
                >
                  Cambiar la palabra de este color
                </button>
                <button
                  onClick={() => setConfirmandoQuitar(actual)}
                  className="w-full rounded-lg border border-line p-2 text-sm text-soft"
                >
                  Quitar este color de la guía
                </button>
              </div>
            )}

            <button
              onClick={onQuitarDelEstudiante}
              disabled={!actual}
              className="mt-3 w-full rounded-lg border border-line p-2 text-sm text-soft disabled:opacity-50"
            >
              Sin clasificar
            </button>
            <button
              onClick={onCerrar}
              className="mt-2 w-full rounded-lg border border-line p-2 text-sm text-soft"
            >
              Cerrar
            </button>
          </>
        )}
      </div>
    </div>
  );
}
