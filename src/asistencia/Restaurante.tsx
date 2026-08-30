import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  anularPasoRestaurante,
  buscarEstudiantes,
  buscarPorQrToken,
  leerEstudiantesDeSede,
  leerInscritosRestaurante,
  leerPasosDelDia,
  registrarPasoRestaurante,
} from './datos';
import EscanerQr from './EscanerQr';
import VerificacionFoto from './VerificacionFoto';
import Avatar from './Avatar';
import { toDateKey } from './domain/ids';
import { nombreCompleto } from './domain/nombres';
import { registroRestauranteId } from './domain/restaurante';
import type {
  RegistroRestaurante,
  Sede,
  ServicioRestaurante,
  Student,
} from './domain/types';

/** Como se nombran los dos servicios en el colegio. No se traducen ni se renombran. */
const SERVICIOS: { servicio: ServicioRestaurante; etiqueta: string; cuando: string }[] = [
  { servicio: 'vaso_leche', etiqueta: 'Vaso de leche', cuando: 'refrigerio del primer descanso' },
  { servicio: 'restaurante', etiqueta: 'Restaurante', cuando: 'menú del final de la jornada' },
];

/**
 * `registradoEn` viaja como `serverTimestamp()`: al releerlo de Firestore NO es el numero
 * que declara el tipo, sino un Timestamp; y mientras la escritura local todavia no tiene
 * acuse del servidor puede llegar `null`. Los tres casos se resuelven aqui, en un solo
 * sitio, porque la hora es lo unico que la fila necesita de ese campo.
 */
function milisegundos(valor: unknown): number | null {
  if (typeof valor === 'number') return valor;
  if (valor && typeof valor === 'object') {
    const t = valor as { toMillis?: () => number; seconds?: number };
    if (typeof t.toMillis === 'function') return t.toMillis();
    if (typeof t.seconds === 'number') return t.seconds * 1000;
  }
  return null;
}

/** 'HH:MM' de la hora del registro, o null si el servidor todavia no la ha puesto. */
function horaDe(registro: RegistroRestaurante): string | null {
  const ms = milisegundos(registro.registradoEn);
  if (ms === null) return null;
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/**
 * La fila del restaurante — vaso de leche y restaurante.
 *
 * ESTO NO ES ASISTENCIA (ver la cabecera de la seccion "Restaurante" en domain/types.ts).
 * No hay marcas, ni faltas, ni denominador: solo existe "pasó" o no hay registro. Se
 * anota quien uso el servicio, para poder contrastarlo despues con la lista oficial.
 *
 * Y SOBRE TODO: NO RESTRINGE. Julian, 2026-08-27: "muchas veces estos grupos no se agotan
 * y la comida no se puede perder (...) preferible darle el vaso de leche o la comida a un
 * estudiante que no esta inscrito en ninguno de los dos". Por eso registrar a alguien que
 * no figura en la lista cuesta EXACTAMENTE lo mismo que registrar a un inscrito: el mismo
 * boton, sin dialogo de confirmacion, sin advertencia, sin paso extra. La lista oficial
 * solo pinta una etiqueta gris informativa. Cualquier friccion añadida ahi convertiria la
 * pantalla en lo contrario de lo que se pidio.
 *
 * Se usa DE PIE, en la puerta del comedor, con la fila avanzando: mismo ritmo que
 * LlegadasTarde.tsx — escanear o buscar, tocar una vez, listo.
 */
export default function Restaurante({
  sede,
  puedeRegistrar,
}: {
  sede: Sede;
  /**
   * Falso para quien solo consulta (rectora, superusuario, cargos de apoyo): la pantalla
   * se ve entera y el dia se puede revisar, pero no se registra ni se anula. El servidor
   * manda igual; esto solo evita ofrecer un boton que iba a fallar.
   */
  puedeRegistrar: boolean;
}) {
  const [servicio, setServicio] = useState<ServicioRestaurante>('vaso_leche');
  const [fecha, setFecha] = useState(toDateKey(new Date()));
  const [busqueda, setBusqueda] = useState('');
  const [candidatos, setCandidatos] = useState<Student[]>([]);
  const [candidatoQr, setCandidatoQr] = useState<Student | null>(null);
  const [escaneando, setEscaneando] = useState(false);
  const [registros, setRegistros] = useState<RegistroRestaurante[]>([]);
  const [aviso, setAviso] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Fichas de la sede: la lista del dia guarda solo el studentId y el grado, y para la
  // fila hacen falta la FOTO y el nombre. Una lectura por sede (la cache offline ya la
  // tiene) en vez de una por cada estudiante que pasa.
  const [fichas, setFichas] = useState<Record<string, Student>>({});
  useEffect(() => {
    let vivo = true;
    void leerEstudiantesDeSede(sede).then((lista) => {
      if (!vivo) return;
      const mapa: Record<string, Student> = {};
      for (const e of lista) mapa[e.studentId] = e;
      setFichas(mapa);
    });
    return () => {
      vivo = false;
    };
  }, [sede]);

  // La lista oficial NO decide quien puede pasar: solo sirve para poner una etiqueta
  // informativa. Si esta lectura falla, la pantalla sigue registrando igual.
  const [inscritos, setInscritos] = useState<Set<string>>(new Set());
  useEffect(() => {
    let vivo = true;
    const anio = Number(fecha.slice(0, 4));
    void leerInscritosRestaurante(sede, anio)
      .then((lista) => {
        if (vivo) setInscritos(new Set(lista.map((i) => i.studentId)));
      })
      .catch(() => {
        if (vivo) setInscritos(new Set());
      });
    return () => {
      vivo = false;
    };
  }, [sede, fecha]);

  const cargar = useCallback(async () => {
    try {
      setRegistros(await leerPasosDelDia(sede, fecha, servicio));
    } catch (e) {
      setError(`No fue posible cargar los pasos del día: ${(e as Error).message}`);
    }
  }, [sede, fecha, servicio]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  // Busqueda con retardo: en la fila se teclea rapido y no tiene sentido consultar en
  // cada letra.
  useEffect(() => {
    if (busqueda.trim().length < 2) {
      setCandidatos([]);
      return;
    }
    const t = setTimeout(() => {
      void buscarEstudiantes(sede, busqueda).then(setCandidatos);
    }, 250);
    return () => clearTimeout(t);
  }, [busqueda, sede]);

  /** Mas recientes arriba: lo ultimo que uno hizo es lo que quiere ver y, si se equivoco,
   * lo que va a anular. Los que aun no tienen hora del servidor van primero. */
  const orden = useMemo(
    () =>
      [...registros].sort((a, b) => (milisegundos(b.registradoEn) ?? Infinity) - (milisegundos(a.registradoEn) ?? Infinity)),
    [registros],
  );

  /** El TOTAL del dia: comidas servidas, sin los anulados. Es la cifra del proveedor. */
  const total = orden.filter((r) => r.anulado !== true).length;

  function pasoVigente(studentId: string): RegistroRestaurante | undefined {
    return registros.find((r) => r.studentId === studentId && r.anulado !== true);
  }

  function limpiarBusqueda() {
    setBusqueda('');
    setCandidatos([]);
    setCandidatoQr(null);
  }

  /**
   * Registrar es UN toque, y cuesta lo mismo para todo el mundo: no se comprueba la lista
   * oficial en ningun momento de este camino.
   *
   * `registrarPasoRestaurante` NO se espera: la promesa es el acuse del SERVIDOR y
   * esperarla congelaria la fila entre estudiante y estudiante (sin señal,
   * indefinidamente). La escritura ya quedo aplicada en local, asi que la lista se
   * actualiza de forma optimista y el indicador de envio del modulo avisa si el servidor
   * la rechaza. El `catch` solo recoge el fallo de identificar al autor, que ocurre antes
   * de escribir.
   */
  function registrar(e: Student) {
    setAviso(null);
    setError(null);

    const nombre = nombreCompleto(e);
    const ya = pasoVigente(e.studentId);
    if (ya) {
      // No es un error ni una acusacion: en una fila es de lo mas normal volver a pasar.
      const hora = horaDe(ya);
      setAviso(hora ? `${nombre} ya pasó a las ${hora}.` : `${nombre} ya pasó hoy.`);
      limpiarBusqueda();
      return;
    }

    let registroId: string;
    try {
      registroId = registroRestauranteId(sede, servicio, fecha, e.studentId);
    } catch (err) {
      setError(`No fue posible registrar: ${(err as Error).message}`);
      return;
    }

    const optimista: RegistroRestaurante = {
      registroId,
      studentId: e.studentId,
      grado: e.gradoActual,
      sede,
      fecha,
      servicio,
      registradoPor: '',
      registradoEn: Date.now(),
      anulado: false,
    };
    // Reemplaza a un registro anulado del mismo estudiante: el id es determinista, asi
    // que en el servidor tambien es el mismo documento el que vuelve a quedar vigente.
    setRegistros((prev) => [optimista, ...prev.filter((r) => r.registroId !== registroId)]);
    setFichas((prev) => (prev[e.studentId] ? prev : { ...prev, [e.studentId]: e }));

    void registrarPasoRestaurante({
      registroId,
      studentId: e.studentId,
      grado: e.gradoActual,
      sede,
      fecha,
      servicio,
    }).catch((err: unknown) => setError(`No fue posible registrar: ${(err as Error).message}`));

    const hora = horaDe(optimista);
    setAviso(`${nombre} — registrado${hora ? ` a las ${hora}` : ''}.`);
    limpiarBusqueda();
  }

  /**
   * Anular un registro equivocado (se escaneo a quien no era). Baja LOGICA: el nombre NO
   * desaparece de la lista, se queda tachado. Que se esfumara dejaria a quien se equivoco
   * sin ninguna señal de que su correccion surtio efecto, y sin nada que auditar despues
   * contra lo que el proveedor sirvio ese dia.
   */
  function anular(r: RegistroRestaurante) {
    setAviso(null);
    setError(null);
    setRegistros((prev) =>
      prev.map((x) => (x.registroId === r.registroId ? { ...x, anulado: true } : x)),
    );
    void anularPasoRestaurante(r.registroId).catch((err: unknown) =>
      setError(`No fue posible anular: ${(err as Error).message}`),
    );
  }

  // Al leer un QR NO se registra automaticamente: se deja como unico candidato para que
  // aparezca su FOTO GRANDE y quien atiende confirme que es esa persona antes de contarle
  // una comida. La camara enfoca rapido y sin esa pausa se registra a quien no es.
  async function leerQr(texto: string) {
    setAviso(null);
    setError(null);
    try {
      const { estudiante, otraSede } = await buscarPorQrToken(sede, texto);
      if (!estudiante) {
        setAviso(
          otraSede
            ? 'Ese código pertenece a un estudiante de otra sede.'
            : 'Código no reconocido. Puede registrarlo buscándolo por nombre.',
        );
        return;
      }
      setEscaneando(false);
      setBusqueda('');
      setCandidatos([]);
      setCandidatoQr(estudiante);
    } catch (e) {
      setError(`No fue posible leer el código: ${(e as Error).message}`);
    }
  }

  /** La etiqueta gris de "no figura en la lista". INFORMATIVA: nunca impide registrar. */
  function etiquetaLista(studentId: string) {
    if (inscritos.size === 0 || inscritos.has(studentId)) return null;
    return (
      <span className="mt-0.5 inline-block rounded-full bg-elevated px-1.5 py-0.5 text-[0.65rem] text-muted">
        No figura en la lista
      </span>
    );
  }

  function botonRegistrar(e: Student) {
    const ya = pasoVigente(e.studentId);
    if (ya) {
      const hora = horaDe(ya);
      return (
        <span className="rounded-lg bg-elevated px-3 py-2 text-sm text-muted">
          {hora ? `Ya pasó a las ${hora}` : 'Ya pasó hoy'}
        </span>
      );
    }
    if (!puedeRegistrar) return <span className="text-xs text-muted">Solo consulta</span>;
    return (
      <button
        onClick={() => registrar(e)}
        className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-fg"
      >
        Registrar
      </button>
    );
  }

  const servicioActual = SERVICIOS.find((s) => s.servicio === servicio)!;

  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-base font-semibold text-strong">Restaurante</h2>
        <p className="text-xs text-muted">
          Se registra <b>quién pasó</b> por el servicio. No hay faltas ni asistencia: pasa
          quien esté ahí, figure o no en la lista oficial.
        </p>
      </div>

      <div className="rounded-xl border border-line bg-card p-3">
        {/* El servicio primero: es lo que decide todo lo demas de la pantalla. */}
        <div className="flex flex-wrap gap-1.5">
          {SERVICIOS.map((s) => (
            <button
              key={s.servicio}
              onClick={() => {
                setServicio(s.servicio);
                limpiarBusqueda();
                setAviso(null);
              }}
              className={
                s.servicio === servicio
                  ? 'rounded-lg bg-accent px-3 py-2 text-sm font-medium text-accent-fg'
                  : 'rounded-lg border border-line px-3 py-2 text-sm text-strong'
              }
            >
              {s.etiqueta}
            </button>
          ))}
          <span className="grow" />
          <label className="text-xs text-muted">
            Fecha
            <input
              type="date"
              value={fecha}
              onChange={(ev) => setFecha(ev.target.value)}
              className="mt-0.5 block rounded-lg border border-line bg-elevated px-2 py-1 text-sm text-strong"
            />
          </label>
        </div>
        <p className="mt-1 text-xs text-muted">{servicioActual.cuando}</p>

        <div className="mt-2 flex flex-wrap items-end gap-2">
          <label className="grow text-xs text-muted">
            Buscar estudiante
            <input
              value={busqueda}
              onChange={(ev) => setBusqueda(ev.target.value)}
              placeholder="Apellido o nombre…"
              className="mt-0.5 block w-full rounded-lg border border-line bg-elevated px-2 py-2 text-base text-strong"
            />
          </label>
          {/* Junto al buscador, siempre: en la fila el estudiante ya trae el carné en la
              mano y escanear es mas rapido que teclear el apellido. */}
          <button
            onClick={() => setEscaneando(true)}
            className="rounded-lg border border-line px-3 py-2 text-sm font-medium text-strong"
          >
            Escanear carné
          </button>
        </div>

        {candidatoQr && (
          <ul className="mt-2">
            <VerificacionFoto
              estudiante={candidatoQr}
              tamano={110}
              extra={etiquetaLista(candidatoQr.studentId)}
              acciones={
                <>
                  {botonRegistrar(candidatoQr)}
                  <button
                    onClick={() => setCandidatoQr(null)}
                    className="rounded-lg border border-line px-3 py-2 text-sm text-soft"
                  >
                    No es
                  </button>
                </>
              }
            />
          </ul>
        )}

        {candidatos.length > 0 && (
          <ul className="mt-2 space-y-1">
            {candidatos.map((e) => (
              // Con un solo candidato la foto va grande: no es una lista para descartar,
              // es una cara que hay que confirmar. Con varios, pequeña, para verlos todos.
              <VerificacionFoto
                key={e.studentId}
                estudiante={e}
                tamano={candidatos.length === 1 ? 110 : 56}
                extra={etiquetaLista(e.studentId)}
                acciones={botonRegistrar(e)}
              />
            ))}
          </ul>
        )}

        {busqueda.trim().length >= 2 && candidatos.length === 0 && (
          <p className="mt-2 text-sm text-muted">Ningún estudiante coincide.</p>
        )}
      </div>

      {aviso && (
        <div className="rounded-xl border border-info-soft bg-info-soft p-3 text-sm text-info-soft-fg">
          {aviso}
        </div>
      )}
      {error && (
        <div className="rounded-xl border border-danger-soft bg-danger-soft p-3 text-sm text-danger-soft-fg">
          {error}
        </div>
      )}

      <section className="rounded-xl border border-line bg-card p-3">
        {/* El contador va GRANDE y arriba: es la cifra que pide el proveedor y la que se
            consulta de un vistazo, sin contar filas. */}
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-semibold text-strong">{total}</span>
          <span className="text-sm text-muted">
            {servicioActual.etiqueta.toLowerCase()} · {fecha}
          </span>
        </div>

        {orden.length === 0 ? (
          <p className="mt-2 text-sm text-muted">Todavía no ha pasado nadie.</p>
        ) : (
          <ul className="mt-2 space-y-1">
            {orden.map((r) => {
              const ficha = fichas[r.studentId];
              const anulado = r.anulado === true;
              const hora = horaDe(r);
              return (
                <li
                  key={r.registroId}
                  className={`flex flex-wrap items-center gap-2 rounded-lg border border-line p-2 text-sm ${anulado ? 'opacity-60' : ''}`}
                >
                  {ficha && <Avatar estudiante={ficha} tamano={40} />}
                  <span className={`grow ${anulado ? 'line-through' : ''}`}>
                    <b className="block text-strong">
                      {ficha ? nombreCompleto(ficha) : r.studentId}
                    </b>
                    <span className="text-xs text-muted">{r.grado}</span>
                  </span>
                  {!anulado && etiquetaLista(r.studentId)}
                  <span className="rounded-full bg-elevated px-2 py-0.5 text-xs font-semibold text-strong">
                    {hora ?? '—'}
                  </span>
                  {anulado ? (
                    <span className="text-xs text-muted">Anulado</span>
                  ) : (
                    puedeRegistrar && (
                      <button
                        onClick={() => anular(r)}
                        className="rounded-lg border border-line px-2 py-1 text-xs text-muted"
                        title="Se escaneó a quien no era: el registro deja de contar, pero no se borra"
                      >
                        Anular
                      </button>
                    )
                  )}
                </li>
              );
            })}
          </ul>
        )}

        <p className="mt-2 text-xs text-muted">
          Los anulados se quedan tachados a propósito: así se ve que la corrección surtió
          efecto y queda constancia de lo ocurrido.
        </p>
      </section>

      {escaneando && (
        <EscanerQr
          onLeer={(t) => void leerQr(t)}
          onCerrar={() => setEscaneando(false)}
          pausado={Boolean(candidatoQr)}
        />
      )}
    </div>
  );
}
