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
  type CuentaWorkspace,
  type EstadoCorreo,
  type PlanCorreos,
} from './domain/correos-workspace';
import { toDateKey } from './domain/ids';
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

  async function elegir(ev: React.ChangeEvent<HTMLInputElement>) {
    const f = ev.target.files?.[0];
    ev.target.value = '';
    if (!f) return;
    setOcupado(true);
    setError(null);
    setAplicados(null);
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
