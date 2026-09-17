/**
 * Importar los correos institucionales de los estudiantes desde Google Workspace —
 * pantalla del superusuario. Diseño: `docs/importar-correos-workspace.md`.
 *
 * El archivo se lee ENTERO EN EL NAVEGADOR y no se guarda en ninguna parte: trae el
 * directorio completo del colegio, docentes incluidos, y lo unico que se conserva es el
 * correo de cada estudiante emparejado.
 *
 * Tres pasos, como la importacion del Master: elegir el archivo, mirar el plan con sus
 * numeros, y solo entonces aplicar. Y lo que la maquina no puede decidir —colisiones,
 * apellidos compuestos— no se escribe: se lista para que lo resuelva una persona.
 */

import { useState } from 'react';

import { aplicarCorreosInstitucionales, leerEstudiantesDeSede } from './datos';
import {
  correoSugerido,
  escriturasDelPlan,
  ExportNoReconocido,
  leerCsv,
  leerExportWorkspace,
  planCorreos,
  retirosDelPlan,
  type CuentaWorkspace,
  type EstadoCorreo,
  type PlanCorreos,
} from './domain/correos-workspace';
import { toDateKey } from './domain/ids';
import { normalizar } from './domain/nombres';
import type { Sede } from './domain/types';

const ESTADO: Record<EstadoCorreo, { nombre: string; explica: string }> = {
  automatico: {
    nombre: 'Automático',
    explica:
      'Llave única, la cuenta existe, el nombre de la cuenta coincide con la ficha y no hay otra cuenta con la misma llave. Se aplica.',
  },
  cuenta_inactiva: {
    nombre: 'Cuenta suspendida',
    explica: 'Se aplica, marcada: la cuenta existe pero no está activa.',
  },
  confirmar: {
    nombre: 'Por confirmar',
    explica:
      'Hay una cuenta probable, pero algo no cuadra: el nombre de la cuenta es distinto, hay otra cuenta con la misma llave en Workspace, o es un homónimo. No se aplica: lo aprueba una persona.',
  },
  colision: {
    nombre: 'Colisión',
    explica: 'Dos estudiantes producen la misma llave. No se aplica a ninguno.',
  },
  sin_cuenta: {
    nombre: 'Sin cuenta',
    explica: 'No hay correo con su patrón. Es una lista de trabajo para quien administra Workspace.',
  },
};

const ORDEN: EstadoCorreo[] = ['automatico', 'cuenta_inactiva', 'confirmar', 'colision', 'sin_cuenta'];

export default function ImportarCorreos({ sede }: { sede: Sede }) {
  const [plan, setPlan] = useState<PlanCorreos | null>(null);
  const [cuentas, setCuentas] = useState<CuentaWorkspace[]>([]);
  const [nombreArchivo, setNombreArchivo] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aplicados, setAplicados] = useState<number | null>(null);
  const [retirados, setRetirados] = useState<number | null>(null);
  const [busqueda, setBusqueda] = useState('');

  async function elegir(ev: React.ChangeEvent<HTMLInputElement>) {
    const f = ev.target.files?.[0];
    ev.target.value = '';
    if (!f) return;
    setOcupado(true);
    setError(null);
    setAplicados(null);
    setRetirados(null);
    try {
      const cs = leerExportWorkspace(leerCsv(await f.text()));
      const estudiantes = await leerEstudiantesDeSede(sede);
      setCuentas(cs);
      setPlan(planCorreos(estudiantes, cs));
      setNombreArchivo(f.name);
    } catch (e) {
      setPlan(null);
      setError(
        e instanceof ExportNoReconocido ? e.message : `No se pudo leer el archivo: ${(e as Error).message}`,
      );
    } finally {
      setOcupado(false);
    }
  }

  async function aplicar() {
    if (!plan) return;
    setOcupado(true);
    setError(null);
    try {
      setAplicados(await aplicarCorreosInstitucionales(escriturasDelPlan(plan, toDateKey(new Date()))));
    } catch (e) {
      setError(`No se aplicó: ${(e as Error).message}`);
    } finally {
      setOcupado(false);
    }
  }

  /**
   * Retira los correos aplicados antes que ya no se sostienen. Botón aparte del de aplicar a
   * propósito: retirar es deshacer algo que ya estaba escrito, y tiene que verse por separado.
   */
  async function retirar() {
    if (!plan) return;
    setOcupado(true);
    setError(null);
    try {
      setRetirados(await aplicarCorreosInstitucionales(retirosDelPlan(plan, toDateKey(new Date()))));
    } catch (e) {
      setError(`No se retiró: ${(e as Error).message}`);
    } finally {
      setOcupado(false);
    }
  }

  async function descargar() {
    if (!plan) return;
    try {
      const { default: ExcelJS } = await import('exceljs');
      const wb = new ExcelJS.Workbook();

      // Hoja 1: a quién hay que crearle cuenta. Sin documento de identidad a propósito:
      // la hoja sale hacia quien administra Workspace, y para crear una cuenta basta el
      // nombre, el grado y la dirección.
      const sinCuenta = wb.addWorksheet('Sin cuenta');
      // «Cuentas parecidas»: si la llave no existe pero sí `juan.perez2`, puede que el
      // estudiante YA tenga cuenta con otra numeración. Crearle otra sería un duplicado.
      sinCuenta.addRow(['Estudiante', 'Grado', 'Correo que le correspondería', 'Cuentas parecidas: revisar antes de crear']);
      for (const f of plan.filas.filter((x) => x.estado === 'sin_cuenta')) {
        sinCuenta.addRow([
          f.nombre,
          f.grado,
          correoSugerido(f) || 'Revisar: apellido compuesto',
          f.candidatas.map((c) => `${c.correo} — ${c.nombreCuenta || 'sin nombre'}`).join('\n'),
        ]);
      }

      // Hoja 2: lo que necesita a una persona.
      // Lleva el nombre con que se creó cada cuenta posible: sin eso, quien resuelve no tiene
      // cómo distinguir a dos Juan Pérez. Es información interna del colegio.
      const revisar = wb.addWorksheet('Por revisar');
      revisar.addRow(['Estudiante', 'Grado', 'Estado', 'Por qué', 'Correo sugerido', 'Cuentas posibles (nombre de la cuenta)']);
      for (const f of plan.filas.filter((x) => x.estado === 'colision' || x.estado === 'confirmar')) {
        revisar.addRow([
          f.nombre,
          f.grado,
          ESTADO[f.estado].nombre,
          f.motivo ?? '',
          f.correo ?? '',
          f.candidatas.map((c) => `${c.correo} — ${c.nombreCuenta || 'sin nombre'}`).join('\n'),
        ]);
      }

      const blob = new Blob([await wb.xlsx.writeBuffer()], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `correos-por-resolver-${sede}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  const escrituras = plan ? escriturasDelPlan(plan, toDateKey(new Date())) : [];
  const yaAplicados = plan ? plan.filas.filter((f) => f.sinCambios).length : 0;
  const protegidos = plan ? plan.filas.filter((f) => f.protegidoManual && f.correo).length : 0;

  // Cuántas cuentas de ESTUDIANTE emparejadas nunca se han usado. No se guarda: decide si
  // el observador puede apoyarse en el correo o si primero hay que trabajar la costumbre
  // de revisarlo.
  const emparejadas = plan ? new Set(plan.filas.map((f) => f.correo).filter(Boolean)) : new Set();
  const nuncaUsadas = cuentas.filter(
    (c) => emparejadas.has(c.correo) && /never/i.test(c.ultimoAcceso),
  ).length;

  const compuestos = plan ? plan.filas.filter((f) => f.compuesto) : [];
  const porResolver = plan
    ? plan.filas.filter((f) => f.estado === 'confirmar' || f.estado === 'colision')
    : [];
  // Los que se aplicarían, según qué tan bien coincide el nombre de la cuenta.
  const aAplicar = plan
    ? plan.filas.filter((f) => f.estado === 'automatico' || f.estado === 'cuenta_inactiva')
    : [];
  const completos = aAplicar.filter((f) => f.concordancia === 'completo').length;
  const parciales = aAplicar.filter((f) => f.concordancia === 'compatible');
  const porNombreCompleto = aAplicar.filter((f) => f.via === 'nombre_completo').length;
  const encontrados =
    plan && busqueda.trim().length >= 3
      ? plan.filas.filter((f) => normalizar(f.nombre).includes(normalizar(busqueda))).slice(0, 10)
      : [];

  return (
    <section className="space-y-3 rounded-xl border border-line bg-card p-3">
      <div>
        <h2 className="text-base font-semibold text-strong">Correos institucionales de estudiantes</h2>
        <p className="text-xs text-muted">
          Desde la descarga de usuarios de la Consola de administración de Google, en CSV. El
          archivo se lee en este navegador y no se guarda: solo se conserva el correo de cada
          estudiante que empareje sin dudas.
        </p>
      </div>

      <label className="inline-block cursor-pointer rounded-lg border border-line bg-elevated px-3 py-2 text-sm text-strong">
        {ocupado ? 'Trabajando…' : plan ? 'Elegir otro archivo…' : 'Seleccionar CSV de Workspace…'}
        <input type="file" accept=".csv" hidden onChange={(e) => void elegir(e)} />
      </label>
      {nombreArchivo && <span className="ml-2 text-xs text-muted">{nombreArchivo}</span>}

      {error && (
        <p className="rounded-lg border border-danger-soft bg-danger-soft p-2 text-sm text-danger-soft-fg">{error}</p>
      )}

      {plan && (
        <>
          <p className="text-xs text-muted">
            {cuentas.length} cuentas en el archivo · {plan.filas.length} estudiantes activos
          </p>

          <div className="space-y-1.5">
            {ORDEN.map((e) => (
              <div key={e} className="flex items-start gap-3 rounded-lg border border-line p-2">
                <b className="w-12 shrink-0 text-right text-base tabular-nums text-strong">{plan.conteo[e]}</b>
                <div>
                  <p className="text-sm font-semibold text-strong">{ESTADO[e].nombre}</p>
                  <p className="text-xs text-muted">{ESTADO[e].explica}</p>
                </div>
              </div>
            ))}
          </div>

          <p className="text-xs text-muted">
            {plan.cuentasSinDueno.length} cuentas del archivo no quedaron asignadas: estudiantes de
            otras sedes y de primaria, exalumnos, docentes y cuentas administrativas. Por eso no basta
            con que la llave exista: una cuenta con el patrón de un estudiante puede ser de otro con
            el mismo nombre que no está en la aplicación.
          </p>

          {aAplicar.length > 0 && (
            <div className="rounded-lg border border-line bg-elevated p-2 text-sm">
              <p className="text-strong">
                De los <b>{aAplicar.length}</b> que se aplicarían: <b>{completos}</b> coinciden con el
                nombre completo de la cuenta y <b>{parciales.length}</b> solo en parte.
              </p>
              <p className="mt-1 text-xs text-muted">
                «En parte» quiere decir que a la cuenta le falta algún nombre de pila, pero trae los dos
                apellidos — por ejemplo, «Lorena López Aguilar» para LÓPEZ AGUILAR, LORENA MARÍA. Una
                cuenta a la que le falta un APELLIDO no se aplica: queda por confirmar.
              </p>
              {parciales.length > 0 && (
                <details className="mt-2">
                  <summary className="cursor-pointer text-xs text-strong">Ver los {parciales.length} en parte</summary>
                  <ul className="mt-1 space-y-0.5 text-xs text-soft">
                    {parciales.map((f) => (
                      <li key={f.studentId}>
                        <b className="text-strong">{f.nombre}</b> ({f.grado}) → {f.correo?.split('@')[0]} («
                        {f.nombreCuentaPropuesta || 'sin nombre'}»)
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          )}

          {porResolver.length > 0 && (
            <details className="rounded-lg border border-line p-2">
              <summary className="cursor-pointer text-sm text-strong">
                {porResolver.length} por resolver — por qué no son automáticos
              </summary>
              <ul className="mt-2 space-y-2 text-xs">
                {porResolver.map((f) => (
                  <li key={f.studentId} className="border-t border-line pt-1">
                    <b className="text-strong">{f.nombre}</b> <span className="text-muted">({f.grado})</span>
                    <p className="text-soft">{f.motivo}</p>
                    {f.candidatas.length > 0 && (
                      <p className="text-muted">
                        Cuentas posibles:{' '}
                        {f.candidatas.map((c) => `${c.correo.split('@')[0]} («${c.nombreCuenta || 'sin nombre'}»)`).join(' · ')}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            </details>
          )}

          {nuncaUsadas > 0 && (
            <p className="rounded-lg border border-line bg-elevated p-2 text-xs text-strong">
              De las cuentas emparejadas, <b>{nuncaUsadas}</b> nunca han iniciado sesión. Un aviso que
              llegue a esas cuentas no lo va a leer nadie.
            </p>
          )}

          {compuestos.length > 0 && (
            <details className="rounded-lg border border-line p-2">
              <summary className="cursor-pointer text-sm text-strong">
                {compuestos.length} apellido(s) compuesto(s) — así escribe el colegio sus correos
              </summary>
              <ul className="mt-1 space-y-0.5 text-xs text-soft">
                {compuestos.map((f) => (
                  <li key={f.studentId}>
                    {f.nombre} ({f.grado}): probadas {f.llavesProbadas.join(', ')} →{' '}
                    {f.correo ?? 'ninguna existe'}
                  </li>
                ))}
              </ul>
            </details>
          )}

          {plan.retiros.length > 0 && (
            <div className="rounded-lg border border-danger-soft bg-danger-soft p-2 text-sm text-danger-soft-fg">
              <p>
                <b>{plan.retiros.length} correo(s) aplicados antes ya no se sostienen</b> con las reglas
                actuales y no tienen un reemplazo seguro. Conviene retirarlos: un correo dudoso escrito
                en la ficha es peor que ninguno.
              </p>
              <ul className="mt-1 space-y-1 text-xs">
                {plan.retiros.map((f) => (
                  <li key={f.studentId}>
                    <b>{f.nombre}</b> ({f.grado}) — tiene {f.correoActual?.split('@')[0]}. {f.motivo}
                  </li>
                ))}
              </ul>
              <button
                onClick={() => void retirar()}
                disabled={ocupado || retirados !== null}
                className="mt-2 rounded-lg border border-line bg-card px-3 py-1.5 text-sm text-strong disabled:opacity-50"
              >
                Retirar {plan.retiros.length} correo(s)
              </button>
              {retirados !== null && <p className="mt-1 text-xs">Listo: se retiraron {retirados}.</p>}
            </div>
          )}

          {plan.reemplazos.length > 0 && (
            <div className="rounded-lg border border-warning-soft bg-warning-soft p-2 text-sm text-warning-soft-fg">
              <b>Al aplicar, {plan.reemplazos.length} correo(s) aplicados antes se reemplazan por otro:</b>
              <ul className="mt-1 space-y-0.5 text-xs">
                {plan.reemplazos.map((f) => (
                  <li key={f.studentId}>
                    <b>{f.nombre}</b> ({f.grado}): {f.correoActual?.split('@')[0]} → {f.correo?.split('@')[0]} («
                    {f.nombreCuentaPropuesta}»)
                  </li>
                ))}
              </ul>
            </div>
          )}

          {porNombreCompleto > 0 && (
            <p className="text-xs text-muted">
              De los que se aplicarían, <b>{porNombreCompleto}</b> se encontraron por el nombre completo exacto
              de la cuenta, porque su correo no sigue la llave (por ejemplo, con el segundo apellido agregado).
            </p>
          )}

          <div className="rounded-lg border border-line p-2">
            <label className="block text-xs text-muted">Buscar un estudiante para revisar qué pasa con su correo</label>
            <input
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Al menos 3 letras del nombre o apellido"
              className="mt-1 w-full rounded-lg border border-line bg-elevated px-2 py-1.5 text-sm"
            />
            {encontrados.map((f) => (
              <div key={f.studentId} className="mt-2 border-t border-line pt-1 text-xs">
                <b className="text-strong">{f.nombre}</b> <span className="text-muted">({f.grado})</span> —{' '}
                <b>{ESTADO[f.estado].nombre}</b>
                <p className="text-soft">
                  Propuesto: {f.correo ?? 'ninguno'}
                  {f.nombreCuentaPropuesta ? ` («${f.nombreCuentaPropuesta}»)` : ''}
                  {f.via === 'nombre_completo' ? ' · por nombre completo' : ''}
                </p>
                <p className="text-soft">
                  Hoy en la ficha: {f.correoActual ?? 'sin correo'}
                  {f.origenActual ? ` (${f.origenActual === 'manual' ? 'puesto a mano' : 'de la importación'})` : ''}
                </p>
                {f.motivo && <p className="text-muted">{f.motivo}</p>}
                {f.candidatas.length > 0 && (
                  <p className="text-muted">
                    Cuentas posibles: {f.candidatas.map((c) => `${c.correo.split('@')[0]} («${c.nombreCuenta || 'sin nombre'}»)`).join(' · ')}
                  </p>
                )}
              </div>
            ))}
          </div>

          <div className="flex flex-wrap gap-2 border-t border-line pt-3">
            <button
              onClick={() => void aplicar()}
              disabled={ocupado || escrituras.length === 0 || aplicados !== null}
              className="rounded-lg bg-accent px-3 py-2 text-sm text-accent-fg disabled:opacity-50"
            >
              Aplicar {escrituras.length} correo(s)
            </button>
            <button
              onClick={() => void descargar()}
              className="rounded-lg border border-line px-3 py-2 text-sm text-strong"
            >
              Descargar lo que falta resolver
            </button>
          </div>

          {(yaAplicados > 0 || protegidos > 0) && (
            <p className="text-xs text-muted">
              {yaAplicados > 0 && <>{yaAplicados} ya tenían ese mismo correo y no se reescriben. </>}
              {protegidos > 0 && <>{protegidos} fueron corregidos a mano por un director y no se tocan.</>}
            </p>
          )}

          {aplicados !== null && (
            <p className="rounded-lg border border-success-soft bg-success-soft p-2 text-sm text-success-soft-fg">
              Listo: se escribieron {aplicados} correos.
            </p>
          )}
        </>
      )}
    </section>
  );
}
