/**
 * Configuración de permanencia — umbrales y catálogo de motivos.
 *
 * La pantalla que vuelve real la palabra "autogestionable": sin ella, cambiar un motivo
 * o un umbral exigiría un despliegue, y entonces no lo administra la institución sino
 * quien programa.
 *
 * Quién entra: coordinación y rectoría. Es la ÚNICA pantalla del módulo donde la
 * rectora escribe; en todo lo demás consulta. Ver la excepción documentada en
 * `rules/asistencia.rules` y §4.3 del diseño.
 */

import { useEffect, useState } from 'react';

import { guardarConfigPermanencia, leerConfigPermanencia, leerEstudiantesDeSede } from './datos';
import { hojaContactabilidad } from './domain/exports';
import { ordenarEstudiantes } from './domain/nombres';
import { tipoDeTelefono } from './domain/telefonos';
import type { Sede, Student } from './domain/types';
import {
  contactabilidadDe,
  desactivarMotivo,
  PERMANENCIA_CONFIG_POR_DEFECTO,
  resumirContactabilidad,
  validarMotivoNuevo,
  type MotivoFamilia,
  type PermanenciaConfig,
} from './domain/permanencia';

export default function ConfigPermanencia({ sede }: { sede: Sede }) {
  const [config, setConfig] = useState<PermanenciaConfig>(PERMANENCIA_CONFIG_POR_DEFECTO);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [guardado, setGuardado] = useState<string | null>(null);
  const [etiquetaNueva, setEtiquetaNueva] = useState('');
  const [justifica, setJustifica] = useState(false);
  const [riesgo, setRiesgo] = useState(false);

  useEffect(() => {
    void (async () => {
      setConfig(await leerConfigPermanencia());
      setCargando(false);
    })();
  }, []);

  /** Guarda y recarga del servidor: lo que se muestra es lo que quedó, no lo que se pidió. */
  async function guardar(cambios: Partial<PermanenciaConfig>, aviso: string) {
    setError(null);
    setGuardado(null);
    try {
      await guardarConfigPermanencia(cambios);
      setConfig(await leerConfigPermanencia());
      setGuardado(aviso);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  function agregar() {
    const r = validarMotivoNuevo(config.motivos, etiquetaNueva);
    if (!r.ok) {
      setError(
        r.reactivar
          ? `${r.error} Búsquela más abajo y vuelva a activarla en vez de crear una igual.`
          : r.error,
      );
      return;
    }
    const nuevo: MotivoFamilia = {
      id: r.id,
      etiqueta: etiquetaNueva.trim().replace(/\s+/g, ' '),
      activo: true,
      justifica,
      factorDeRiesgo: riesgo,
    };
    setEtiquetaNueva('');
    setJustifica(false);
    setRiesgo(false);
    void guardar({ motivos: [...config.motivos, nuevo] }, `Se agregó «${nuevo.etiqueta}».`);
  }

  function cambiarBandera(id: string, campo: 'justifica' | 'factorDeRiesgo', valor: boolean) {
    const motivos = config.motivos.map((m) => (m.id === id ? { ...m, [campo]: valor } : m));
    void guardar({ motivos }, 'Cambio guardado.');
  }

  function alternarActivo(m: MotivoFamilia) {
    const motivos = m.activo
      ? desactivarMotivo(config.motivos, m.id)
      : config.motivos.map((x) => (x.id === m.id ? { ...x, activo: true } : x));
    void guardar(
      { motivos },
      m.activo ? `«${m.etiqueta}» ya no se ofrece.` : `«${m.etiqueta}» vuelve a ofrecerse.`,
    );
  }

  if (cargando) return <p className="p-3 text-sm text-muted">Cargando configuración…</p>;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-line bg-card p-3">
        <h3 className="text-sm font-semibold text-strong">Cuándo se abre un caso</h3>
        <p className="mt-1 text-xs text-muted">
          Estos números deciden a quién se le abre un caso de permanencia. Cambiarlos cambia
          a quién señala el sistema mañana, no lo que ya se reportó.
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <Umbral
            etiqueta="Días acumulados en el periodo"
            valor={config.diasParaAbrirCaso}
            onGuardar={(v) => guardar({ diasParaAbrirCaso: v }, 'Umbral guardado.')}
          />
          <Umbral
            etiqueta="Días seguidos sin asistir"
            valor={config.diasConsecutivosParaAbrirCaso}
            onGuardar={(v) => guardar({ diasConsecutivosParaAbrirCaso: v }, 'Umbral guardado.')}
          />
          <Umbral
            etiqueta="Intentos de contacto sin respuesta"
            valor={config.intentosSinExitoParaEscalar}
            onGuardar={(v) => guardar({ intentosSinExitoParaEscalar: v }, 'Umbral guardado.')}
          />
        </div>
      </div>

      <div className="rounded-xl border border-line bg-card p-3">
        <h3 className="text-sm font-semibold text-strong">Qué puede informar la familia</h3>
        <p className="mt-1 text-xs text-muted">
          Es la lista que aparece al registrar una llamada. Las dos casillas de cada opción
          son lo importante: <b>Justifica</b> significa que esa respuesta explica la
          inasistencia y el caso no escala; <b>Riesgo</b> significa que el caso escala de
          inmediato, sin esperar a que se cumpla ningún umbral de días.
        </p>

        <div className="mt-3 space-y-1.5">
          {config.motivos.map((m) => (
            <div
              key={m.id}
              className={`flex flex-wrap items-center gap-2 rounded-lg border border-line p-2 ${
                m.activo ? '' : 'opacity-60'
              }`}
            >
              <span className="min-w-[12rem] flex-1 text-sm text-strong">
                {m.etiqueta}
                {!m.activo && <span className="ml-2 text-xs text-muted">(retirada)</span>}
              </span>
              <label className="flex items-center gap-1 text-xs text-soft">
                <input
                  type="checkbox"
                  checked={m.justifica}
                  onChange={(e) => cambiarBandera(m.id, 'justifica', e.target.checked)}
                />
                Justifica
              </label>
              <label className="flex items-center gap-1 text-xs text-soft">
                <input
                  type="checkbox"
                  checked={m.factorDeRiesgo}
                  onChange={(e) => cambiarBandera(m.id, 'factorDeRiesgo', e.target.checked)}
                />
                Riesgo
              </label>
              <button
                onClick={() => alternarActivo(m)}
                className="rounded-lg border border-line px-2 py-1 text-xs text-strong"
              >
                {m.activo ? 'Retirar' : 'Volver a ofrecer'}
              </button>
            </div>
          ))}
        </div>

        <p className="mt-2 text-xs text-muted">
          Una opción retirada no se borra: deja de ofrecerse para casos nuevos, y los casos
          viejos que la usaron la siguen mostrando. Si se borrara, un caso de marzo quedaría
          sin motivo.
        </p>

        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-line pt-3">
          <input
            value={etiquetaNueva}
            onChange={(e) => setEtiquetaNueva(e.target.value)}
            placeholder="Nueva opción…"
            className="min-w-[14rem] flex-1 rounded-lg border border-line bg-elevated px-2 py-1.5 text-sm"
          />
          <label className="flex items-center gap-1 text-xs text-soft">
            <input type="checkbox" checked={justifica} onChange={(e) => setJustifica(e.target.checked)} />
            Justifica
          </label>
          <label className="flex items-center gap-1 text-xs text-soft">
            <input type="checkbox" checked={riesgo} onChange={(e) => setRiesgo(e.target.checked)} />
            Riesgo
          </label>
          <button
            onClick={agregar}
            disabled={!etiquetaNueva.trim()}
            className="rounded-lg bg-accent px-3 py-1.5 text-sm text-accent-fg disabled:opacity-50"
          >
            Agregar
          </button>
        </div>
      </div>

      <Contactabilidad sede={sede} />

      {config.ultimaEscrituraPor && (
        <p className="text-xs text-muted">
          Última modificación: {config.ultimaEscrituraPor}
        </p>
      )}
      {guardado && <p className="text-xs text-accent">{guardado}</p>}
      {error && (
        <p className="rounded-lg border border-line bg-elevated p-2 text-xs text-strong">{error}</p>
      )}
    </div>
  );
}

/** Un umbral. Se guarda al salir del campo, no en cada tecla. */
function Umbral({
  etiqueta,
  valor,
  onGuardar,
}: {
  etiqueta: string;
  valor: number;
  onGuardar: (v: number) => void;
}) {
  const [texto, setTexto] = useState(String(valor));
  useEffect(() => setTexto(String(valor)), [valor]);

  return (
    <label className="block">
      <span className="block text-xs text-muted">{etiqueta}</span>
      <input
        type="number"
        min={1}
        max={60}
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        onBlur={() => {
          const n = Number(texto);
          // Un umbral en cero o vacío señalaría a todo el colegio. Se revierte en vez de
          // guardarse: es mejor que no pase nada a que pase eso.
          if (!Number.isInteger(n) || n < 1 || n > 60) {
            setTexto(String(valor));
            return;
          }
          if (n !== valor) onGuardar(n);
        }}
        className="mt-1 w-full rounded-lg border border-line bg-elevated px-2 py-1.5 text-sm"
      />
    </label>
  );
}

/**
 * Contactabilidad de las familias. Es un CONTEO, no una configuración, pero vive aquí
 * porque responde la pregunta previa a cualquier aviso automático: un teléfono fijo no
 * recibe mensajes, así que el ahorro posible de llamadas es, como mucho, el tamaño del
 * grupo que tiene celular.
 *
 * Se carga bajo demanda —leer todas las fichas de la sede es caro— y por eso no se pide
 * al abrir la pantalla.
 */
function Contactabilidad({ sede }: { sede: Sede }) {
  const [estudiantes, setEstudiantes] = useState<Student[] | null>(null);
  const [cargando, setCargando] = useState(false);
  const [fallo, setFallo] = useState<string | null>(null);

  async function cargar() {
    setCargando(true);
    setFallo(null);
    try {
      setEstudiantes(await leerEstudiantesDeSede(sede));
    } catch (e) {
      setFallo((e as Error).message);
    } finally {
      setCargando(false);
    }
  }

  async function descargar() {
    if (!estudiantes) return;
    setFallo(null);
    try {
      const resumen = resumirContactabilidad(estudiantes, tipoDeTelefono);
      const sinMovil = ordenarEstudiantes(
        estudiantes.filter(
          (e) => e.activo && contactabilidadDe(e.telefonos ?? [], tipoDeTelefono) !== 'movil',
        ),
      ).map((e) => ({
        apellidos: e.apellidos,
        nombres: e.nombres,
        grado: e.gradoActual,
        telefonos: e.telefonos ?? [],
      }));
      const hoja = hojaContactabilidad(resumen, sinMovil);

      // Import dinamico: `exceljs` no entra en el paquete inicial.
      const { default: ExcelJS } = await import('exceljs');
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet(hoja.nombre.slice(0, 31));
      ws.addRow(hoja.encabezados);
      for (const fila of hoja.filas) ws.addRow(fila);
      ws.addRow([]);
      for (const nota of hoja.notas) ws.addRow([nota]);

      const blob = new Blob([await wb.xlsx.writeBuffer()], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${hoja.nombre}-${sede}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setFallo((e as Error).message);
    }
  }

  const resumen = estudiantes ? resumirContactabilidad(estudiantes, tipoDeTelefono) : null;

  return (
    <div className="rounded-xl border border-line bg-card p-3">
      <h3 className="text-sm font-semibold text-strong">Por dónde se puede avisar a las familias</h3>
      <p className="mt-1 text-xs text-muted">
        Un teléfono fijo no recibe mensajes de texto ni WhatsApp: a esas familias solo se les
        puede llamar. Este conteo dice cuántas llamadas se podrían evitar el día que se envíen
        avisos automáticos — y, mientras tanto, a cuántas familias el colegio hoy no tiene cómo
        avisarles nada.
      </p>

      {!resumen && (
        <button
          onClick={() => void cargar()}
          disabled={cargando}
          className="mt-3 rounded-lg border border-line px-3 py-1.5 text-sm text-strong disabled:opacity-50"
        >
          {cargando ? 'Contando…' : 'Contar'}
        </button>
      )}

      {resumen && (
        <>
          <div className="mt-3 rounded-lg border border-accent bg-accent-soft p-2 text-sm text-strong">
            <b>{resumen.total.movil}</b> de <b>{resumen.total.total}</b> estudiantes tienen un
            celular en la ficha (<b>{resumen.total.porcentajeMovil}%</b>). A{' '}
            <b>{resumen.total.soloFijo}</b> familias solo se les puede llamar, y{' '}
            <b>{resumen.total.sinTelefono}</b> no tienen ningún teléfono utilizable.
          </div>

          <div className="mt-2 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted">
                  <th className="py-1">Grado</th>
                  <th className="py-1 text-right">Total</th>
                  <th className="py-1 text-right">Celular</th>
                  <th className="py-1 text-right">Solo fijo</th>
                  <th className="py-1 text-right">Sin teléfono</th>
                  <th className="py-1 text-right">%</th>
                </tr>
              </thead>
              <tbody>
                {resumen.porGrado.map((f) => (
                  <tr key={f.grado} className="border-t border-line">
                    <td className="py-1 text-strong">{f.grado}</td>
                    <td className="py-1 text-right text-soft">{f.total}</td>
                    <td className="py-1 text-right text-soft">{f.movil}</td>
                    <td className="py-1 text-right text-soft">{f.soloFijo}</td>
                    <td className="py-1 text-right text-soft">{f.sinTelefono}</td>
                    <td className="py-1 text-right text-strong">{f.porcentajeMovil}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <button
            onClick={() => void descargar()}
            className="mt-3 rounded-lg border border-line px-3 py-1.5 text-sm text-strong"
          >
            Descargar Excel, con la lista de quiénes no tienen celular
          </button>
        </>
      )}

      {fallo && (
        <p className="mt-2 rounded-lg border border-line bg-elevated p-2 text-xs text-strong">{fallo}</p>
      )}
    </div>
  );
}
