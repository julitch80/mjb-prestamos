import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { useAppStore } from '../data/store';
import { SEDES, esDirectivo } from '../data/maestros';
import type { SedeId } from '../data/maestros';
import {
  BRIGADAS,
  LIDERES_GESTION_RIESGO,
  RESOLUCION_BRIGADAS,
  brigadasDeDocente,
  liderazgosDeDocente,
} from '../data/brigadas';
import type { Brigada, IntegranteBrigada } from '../data/brigadas';
import { CATEGORIAS_EMERGENCIA, formatearTelefono } from '../data/emergencias';
import type { CategoriaEmergenciaId } from '../data/emergencias';
import {
  IconoPolicia,
  IconoNinezFamilia,
  IconoSaludMental,
  IconoSalud,
  IconoBomberos,
  IconoInstitucional,
  IconoGenerico,
} from './IconosNeon';
import {
  FLUJO_PROTOCOLO,
  FRASE_MARCO,
  NOTA_CIERRE,
  PENDIENTES_RECTORIA,
  SECCIONES_PROTOCOLO,
} from '../data/protocoloEmergencias';
import type { BloqueContenido, NivelFuente } from '../data/protocoloEmergencias';
import {
  SECUENCIA_CONTENCION_EMOCIONAL,
  SECUENCIA_PRIMEROS_AUXILIOS,
  faseporId,
} from '../data/guiaEmergencia';
import type { FaseEmergencia, LlamadaFase, TonoFase } from '../data/guiaEmergencia';
import { InformeContencion } from './InformeContencion';
import { RemisionSeguro } from './RemisionSeguro';
import {
  ATRIBUCION,
  FICHAS_AUXILIOS,
  NOTAS_REVISION,
  fichaPorId,
} from '../data/fichasAuxilios';
import type { BloqueFicha, FichaAuxilios, TonoFicha } from '../data/fichasAuxilios';

const JORNADA_LABEL: Record<string, string> = {
  manana: 'Mañana', tarde: 'Tarde', ambas: 'Ambas', nocturna: 'Nocturna',
};

const BRIGADA_EVACUACION = BRIGADAS.find(b => b.id === 'evacuacion')!;

function ChipJornada({ jornada }: { jornada: string }) {
  return (
    <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-elevated border border-line text-muted">
      {JORNADA_LABEL[jornada] ?? jornada}
    </span>
  );
}

// ── Lista de funciones colapsable ────────────────────────────────────────────

function FuncionesDetalle({ funciones }: { funciones: string[] }) {
  return (
    <details className="group">
      <summary className="cursor-pointer text-xs font-medium text-accent select-none list-none flex items-center gap-1">
        <span className="transition-transform group-open:rotate-90">▸</span> Ver funciones
      </summary>
      <ul className="mt-2 flex flex-col gap-1.5 pl-1">
        {funciones.map((f, i) => (
          <li key={i} className="text-xs text-soft leading-relaxed flex gap-2">
            <span className="text-muted flex-shrink-0">•</span>
            <span>{f}</span>
          </li>
        ))}
      </ul>
    </details>
  );
}

// ── Tarjeta "tus brigadas" ────────────────────────────────────────────────────

function TarjetaPertenencia({ titulo, sub, funciones, esLider }: {
  titulo: string; sub?: string; funciones: string[]; esLider?: boolean;
}) {
  return (
    <div className="rounded-xl border border-line bg-card px-4 py-3 flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-strong text-sm font-semibold">{esLider ? '⭐ ' : ''}{titulo}</span>
      </div>
      {sub && <p className="text-xs text-muted">{sub}</p>}
      <FuncionesDetalle funciones={funciones} />
    </div>
  );
}

// ── Sección "brigadas por sede" (directivos) ──────────────────────────────────

function SeccionPorSede() {
  const [sede, setSede] = useState<SedeId>('central');

  const lideres = LIDERES_GESTION_RIESGO.filter(l => l.sede === sede || l.sede === 'todas');

  return (
    <div className="flex flex-col gap-4">
      <h3 className="text-strong text-sm font-semibold">Brigadas por sede</h3>

      <div className="flex items-center gap-1.5 flex-wrap">
        {SEDES.map(s => (
          <button
            key={s.id}
            onClick={() => setSede(s.id)}
            className={cn(
              'px-3 py-1.5 rounded-full text-xs font-medium border transition-all',
              sede === s.id
                ? 'bg-accent-soft border-accent text-accent'
                : 'border-line text-muted hover:text-soft hover:bg-elevated'
            )}
          >
            {s.nombre}
          </button>
        ))}
      </div>

      {lideres.length > 0 && (
        <div className="rounded-xl border border-line bg-elevated px-4 py-3 flex flex-col gap-2">
          <span className="text-xs font-semibold text-strong">Líderes de gestión del riesgo</span>
          <div className="flex flex-col gap-1.5">
            {lideres.map((l, i) => (
              <div key={i} className="flex items-center gap-2 text-xs text-soft">
                <span className="flex-1">{l.nombre}</span>
                <ChipJornada jornada={l.jornada} />
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-col gap-3">
        {BRIGADAS.map(b => {
          const integrantesSede = b.integrantes.filter(i => i.sede === sede || i.sede === 'todas');
          if (integrantesSede.length === 0) return null;
          return (
            <div key={b.id} className="rounded-xl border border-line bg-card px-4 py-3 flex flex-col gap-2">
              <span className="text-sm font-semibold text-strong">{b.nombre}</span>
              <div className="flex flex-col gap-1.5">
                {integrantesSede.map((it, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs text-soft">
                    <span className="flex-1">
                      {it.nombre}
                      {it.nota && <span className="text-muted"> — {it.nota}</span>}
                    </span>
                    <ChipJornada jornada={it.jornada} />
                  </div>
                ))}
              </div>
              <FuncionesDetalle funciones={b.funciones} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Acordeón "todas las brigadas de mi sede" (no directivos) ─────────────────

function AcordeonMiSede({ sede }: { sede: SedeId }) {
  return (
    <details className="rounded-xl border border-line bg-card px-4 py-3">
      <summary className="cursor-pointer text-sm font-medium text-strong select-none">
        Ver todas las brigadas de mi sede
      </summary>
      <div className="mt-3 flex flex-col gap-3">
        {BRIGADAS.map((b: Brigada) => {
          const integrantesSede = b.integrantes.filter(i => i.sede === sede || i.sede === 'todas');
          if (integrantesSede.length === 0) return null;
          return (
            <div key={b.id} className="rounded-lg bg-elevated px-3 py-2.5 flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-strong">{b.nombre}</span>
              {integrantesSede.map((it: IntegranteBrigada, i: number) => (
                <div key={i} className="flex items-center gap-2 text-[11px] text-soft">
                  <span className="flex-1">{it.nombre}</span>
                  <ChipJornada jornada={it.jornada} />
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </details>
  );
}

// ── Números de emergencia ─────────────────────────────────────────────────────

// Clases completas y literales a proposito -- Tailwind solo detecta nombres
// de clase que aparecen tal cual en el codigo fuente; construirlas con
// template strings (`bg-${color}-soft`) hace que el escaner no las vea y
// desaparezcan del CSS final.
const ESTILO_CATEGORIA: Record<CategoriaEmergenciaId, { chipActivo: string; chipInactivo: string; tarjeta: string; titulo: string }> = {
  policia: {
    chipActivo: 'bg-info-soft border-info text-info-soft-fg',
    chipInactivo: 'border-info text-info',
    tarjeta: 'border-info-soft bg-info-soft',
    titulo: 'text-info-soft-fg',
  },
  ninez_familia: {
    chipActivo: 'bg-purple-soft border-purple text-purple-soft-fg',
    chipInactivo: 'border-purple text-purple',
    tarjeta: 'border-purple-soft bg-purple-soft',
    titulo: 'text-purple-soft-fg',
  },
  salud_mental: {
    chipActivo: 'bg-warning-soft border-warning text-warning-soft-fg',
    chipInactivo: 'border-warning text-warning',
    tarjeta: 'border-warning-soft bg-warning-soft',
    titulo: 'text-warning-soft-fg',
  },
  salud: {
    chipActivo: 'bg-success-soft border-success text-success-soft-fg',
    chipInactivo: 'border-success text-success',
    tarjeta: 'border-success-soft bg-success-soft',
    titulo: 'text-success-soft-fg',
  },
  bomberos: {
    chipActivo: 'bg-danger-soft border-danger text-danger-soft-fg',
    chipInactivo: 'border-danger text-danger',
    tarjeta: 'border-danger-soft bg-danger-soft',
    titulo: 'text-danger-soft-fg',
  },
  institucional: {
    // teal en vez de accent (azul): el azul queda reservado para "seleccionada".
    chipActivo: 'bg-teal-soft border-teal text-teal-soft-fg',
    chipInactivo: 'border-teal text-teal',
    tarjeta: 'border-teal-soft bg-teal-soft',
    titulo: 'text-teal-soft-fg',
  },
};
const ESTILO_TODAS = { chipActivo: 'bg-accent-soft border-accent text-accent' };

// Icono de línea por categoría (los emoji de CATEGORIAS_EMERGENCIA no se usan
// aquí — se mapea por id para no tocar data/emergencias.ts).
const ICONO_CATEGORIA: Record<CategoriaEmergenciaId, (p: { className?: string }) => ReactNode> = {
  policia: IconoPolicia,
  ninez_familia: IconoNinezFamilia,
  salud_mental: IconoSaludMental,
  salud: IconoSalud,
  bomberos: IconoBomberos,
  institucional: IconoInstitucional,
};

function ChipCategoria({ activo, Icono, nombre, chipActivo, chipInactivo, onClick }: {
  activo: boolean; Icono: (p: { className?: string }) => ReactNode; nombre: string; chipActivo: string; chipInactivo?: string; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'px-3 py-1.5 rounded-full text-xs font-medium border transition-all flex items-center gap-1.5 whitespace-nowrap',
        activo ? chipActivo : (chipInactivo ?? 'border-line text-muted hover:text-soft hover:bg-elevated')
      )}
    >
      <Icono className="w-4 h-4 flex-shrink-0" />
      {nombre}
    </button>
  );
}

function TarjetaContacto({ entidad, telefonos, nota, tarjeta, titulo }: {
  entidad: string; telefonos: string[]; nota?: string; tarjeta: string; titulo: string;
}) {
  return (
    <div className={cn('rounded-xl border px-4 py-3 flex flex-col gap-2', tarjeta)}>
      <span className={cn('text-sm font-semibold', titulo)}>{entidad}</span>
      <div className="flex flex-wrap gap-2">
        {telefonos.map((tel, i) => (
          <a
            key={i}
            href={`tel:${tel}`}
            className="text-xs font-mono font-semibold px-2.5 py-1 rounded-lg bg-card border border-line text-strong hover:bg-elevated transition"
          >
            📞 {formatearTelefono(tel)}
          </a>
        ))}
      </div>
      {nota && <p className="text-[11px] text-muted">{nota}</p>}
    </div>
  );
}

function NumerosEmergencia() {
  const [categoria, setCategoria] = useState<CategoriaEmergenciaId | null>(null);
  const [busqueda, setBusqueda] = useState('');

  const categoriasFiltradas = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();
    return CATEGORIAS_EMERGENCIA
      .filter(c => !categoria || c.id === categoria)
      .map(c => ({
        ...c,
        contactos: texto
          ? c.contactos.filter(k => k.entidad.toLowerCase().includes(texto))
          : c.contactos,
      }))
      .filter(c => c.contactos.length > 0);
  }, [categoria, busqueda]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h3 className="text-strong text-sm font-semibold">📞 Números de emergencia</h3>
        <p className="text-muted text-xs">Institución Educativa Manuel J. Betancur — directorio COPASST.</p>
      </div>

      <input
        type="text"
        value={busqueda}
        onChange={e => setBusqueda(e.target.value)}
        placeholder="Buscar una entidad (ej. policía, ICBF, salud mental)..."
        className="w-full px-3 py-2 rounded-lg border border-line bg-card text-sm text-strong placeholder:text-muted focus:outline-none focus:border-accent"
      />

      <div className="flex items-center gap-1.5 flex-wrap">
        <ChipCategoria
          activo={categoria === null}
          Icono={IconoGenerico}
          nombre="Todas"
          chipActivo={ESTILO_TODAS.chipActivo}
          onClick={() => setCategoria(null)}
        />
        {CATEGORIAS_EMERGENCIA.map(c => (
          <ChipCategoria
            key={c.id}
            activo={categoria === c.id}
            Icono={ICONO_CATEGORIA[c.id]}
            nombre={c.nombre}
            chipActivo={ESTILO_CATEGORIA[c.id].chipActivo}
            chipInactivo={ESTILO_CATEGORIA[c.id].chipInactivo}
            onClick={() => setCategoria(prev => prev === c.id ? null : c.id)}
          />
        ))}
      </div>

      {categoriasFiltradas.length === 0 && (
        <p className="text-xs text-muted text-center py-4">No hay ningún número que coincida con la búsqueda.</p>
      )}

      <div className="flex flex-col gap-5">
        {categoriasFiltradas.map(c => (
          <div key={c.id} className="flex flex-col gap-2">
            {/* El encabezado usa el MISMO icono de linea que la pastilla de esa
                categoria, no el emoji: mezclar emoji con iconos de linea en la
                misma pantalla se ve inconsistente. */}
            {(() => {
              const IconoCat = ICONO_CATEGORIA[c.id] ?? IconoGenerico;
              return (
                <span className={cn('text-xs font-semibold flex items-center gap-1.5', ESTILO_CATEGORIA[c.id].titulo)}>
                  <IconoCat className="w-4 h-4 flex-shrink-0" /> {c.nombre}
                </span>
              );
            })()}
            <div className="flex flex-col gap-2">
              {c.contactos.map((contacto, i) => (
                <TarjetaContacto
                  key={i}
                  {...contacto}
                  tarjeta={ESTILO_CATEGORIA[c.id].tarjeta}
                  titulo={ESTILO_CATEGORIA[c.id].titulo}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Protocolo de emergencias (consulta estática, sin asistente/IA) ──────────

// Clases completas y literales a proposito -- mismo motivo que ESTILO_CATEGORIA:
// Tailwind no detecta clases construidas con template strings.
const ESTILO_NIVEL_FUENTE: Record<NivelFuente, { chip: string; label: string }> = {
  institucional: {
    chip: 'bg-accent-soft border-accent text-accent',
    label: 'Protocolo institucional',
  },
  practica: {
    chip: 'bg-info-soft border-info-soft text-info-soft-fg',
    label: 'Práctica docente documentada',
  },
  legal_sin_verificar: {
    chip: 'bg-warning-soft border-warning text-warning-soft-fg',
    label: 'Marco legal sin verificar',
  },
};

function BadgeBeta() {
  return (
    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-warning-soft border border-warning text-warning-soft-fg leading-none">
      BETA
    </span>
  );
}

function ChipNivelFuente({ nivel }: { nivel: NivelFuente }) {
  const estilo = ESTILO_NIVEL_FUENTE[nivel];
  return (
    <span className={cn('text-[9px] font-medium px-1.5 py-0.5 rounded-full border leading-none whitespace-nowrap', estilo.chip)}>
      {estilo.label}
    </span>
  );
}

function BloqueContenidoView({ bloque }: { bloque: BloqueContenido }) {
  if (bloque.tipo === 'parrafo') {
    return <p className="text-xs text-soft leading-relaxed">{bloque.texto}</p>;
  }
  if (bloque.tipo === 'pasos') {
    return (
      <div className="flex flex-col gap-1.5">
        {bloque.titulo && <span className="text-xs font-semibold text-strong">{bloque.titulo}</span>}
        <ul className="flex flex-col gap-1.5">
          {bloque.items.map((item, i) => (
            <li key={i} className="text-xs text-soft leading-relaxed flex gap-2">
              <span className="text-muted flex-shrink-0">•</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </div>
    );
  }
  if (bloque.tipo === 'subseccion') {
    return (
      <div className="flex flex-col gap-2">
        <span className="text-xs font-semibold text-strong">{bloque.titulo}</span>
        <div className="flex flex-col gap-2 pl-1">
          {bloque.contenido.map((b, i) => (
            <BloqueContenidoView key={i} bloque={b} />
          ))}
        </div>
      </div>
    );
  }
  // destacado
  return (
    <div
      className={cn(
        'rounded-lg border px-3 py-2.5',
        bloque.tono === 'peligro'
          ? 'bg-danger-soft border-danger'
          : 'bg-info-soft border-info-soft'
      )}
    >
      <p className={cn('text-xs font-semibold leading-relaxed', bloque.tono === 'peligro' ? 'text-danger-soft-fg' : 'text-info-soft-fg')}>
        {bloque.texto}
      </p>
    </div>
  );
}

function TarjetaSeccionProtocolo({ seccion }: { seccion: (typeof SECCIONES_PROTOCOLO)[number] }) {
  return (
    <div className="rounded-xl border border-line bg-card px-4 py-3 flex flex-col gap-2.5">
      <div className="flex items-start justify-between gap-2">
        <span className="text-sm font-semibold text-strong">
          {seccion.numero}. {seccion.titulo}
        </span>
        <ChipNivelFuente nivel={seccion.nivelFuente} />
      </div>
      <p className="text-[10px] text-muted italic leading-relaxed">{seccion.notaFuente}</p>
      <div className="flex flex-col gap-2.5">
        {seccion.contenido.map((bloque, i) => (
          <BloqueContenidoView key={i} bloque={bloque} />
        ))}
      </div>
    </div>
  );
}

function FlujoProtocolo() {
  return (
    <div className="flex items-center gap-1 flex-wrap">
      {FLUJO_PROTOCOLO.map((paso, i) => (
        <div key={paso.numero} className="flex items-center gap-1">
          <span className="text-[10px] font-medium px-2 py-1 rounded-full bg-elevated border border-line text-soft whitespace-nowrap">
            {paso.numero}. {paso.nombre}
          </span>
          {i < FLUJO_PROTOCOLO.length - 1 && <span className="text-muted text-[10px]">›</span>}
        </div>
      ))}
    </div>
  );
}

function ProtocoloEmergencias() {
  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-xl border border-warning bg-warning-soft px-4 py-3">
        <p className="text-xs text-warning-soft-fg leading-relaxed">
          ⚠️ <strong>En pruebas.</strong> Esta guía puede cambiar. En una urgencia manda el <strong>123</strong>;
          en salud mental, la <strong>Línea Naranja</strong>. Si algo aquí no cuadra con lo que estás viendo, hazle
          caso a la línea, no a la aplicación.
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <h3 className="text-strong text-sm font-semibold">🚑 Protocolo de atención en emergencias</h3>
        <p className="text-xs text-soft leading-relaxed italic">{FRASE_MARCO}</p>
      </div>

      <FlujoProtocolo />

      <div className="flex flex-col gap-3">
        {SECCIONES_PROTOCOLO.map(seccion => (
          <TarjetaSeccionProtocolo key={seccion.numero} seccion={seccion} />
        ))}
      </div>

      <div className="rounded-xl border border-line bg-elevated px-4 py-3">
        <p className="text-[11px] text-muted leading-relaxed">{NOTA_CIERRE}</p>
      </div>

      <div className="rounded-xl border border-danger bg-danger-soft px-4 py-3 flex flex-col gap-2">
        <span className="text-xs font-semibold text-danger-soft-fg">⏳ Pendiente de confirmar con rectoría</span>
        <ul className="flex flex-col gap-1.5">
          {PENDIENTES_RECTORIA.map((p, i) => (
            <li key={i} className="text-[11px] text-danger-soft-fg leading-relaxed flex gap-2">
              <span className="flex-shrink-0">•</span>
              <span>{p.texto}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

// ── Emergencia escolar: submenú + visor de fases ─────────────────────────────

// Clases completas y literales a proposito -- mismo motivo que ESTILO_CATEGORIA
// y ESTILO_NIVEL_FUENTE: Tailwind no detecta clases construidas con template
// strings, así que cada tono se escribe a mano.
const ESTILO_TONO_FASE: Record<TonoFase, { fondo: string; borde: string; texto: string; chip: string }> = {
  peligro: {
    fondo: 'bg-danger-soft',
    borde: 'border-danger',
    texto: 'text-danger-soft-fg',
    chip: 'bg-danger-soft border-danger text-danger-soft-fg',
  },
  info: {
    fondo: 'bg-info-soft',
    borde: 'border-info',
    texto: 'text-info-soft-fg',
    chip: 'bg-info-soft border-info text-info-soft-fg',
  },
  exito: {
    fondo: 'bg-success-soft',
    borde: 'border-success',
    texto: 'text-success-soft-fg',
    chip: 'bg-success-soft border-success text-success-soft-fg',
  },
  advertencia: {
    fondo: 'bg-warning-soft',
    borde: 'border-warning',
    texto: 'text-warning-soft-fg',
    chip: 'bg-warning-soft border-warning text-warning-soft-fg',
  },
  morado: {
    fondo: 'bg-purple-soft',
    borde: 'border-purple',
    texto: 'text-purple-soft-fg',
    chip: 'bg-purple-soft border-purple text-purple-soft-fg',
  },
  teal: {
    fondo: 'bg-teal-soft',
    borde: 'border-teal',
    texto: 'text-teal-soft-fg',
    chip: 'bg-teal-soft border-teal text-teal-soft-fg',
  },
};

// Clases completas y literales a proposito -- mismo motivo que ESTILO_CATEGORIA:
// Tailwind no detecta clases construidas con template strings.
const ESTILO_TONO_FICHA: Record<TonoFicha, { chipActivo: string; header: string; headerTexto: string }> = {
  azul: {
    chipActivo: 'bg-info-soft border-info text-info-soft-fg',
    header: 'bg-info-soft border-info',
    headerTexto: 'text-info-soft-fg',
  },
  verde: {
    chipActivo: 'bg-success-soft border-success text-success-soft-fg',
    header: 'bg-success-soft border-success',
    headerTexto: 'text-success-soft-fg',
  },
  naranja: {
    chipActivo: 'bg-warning-soft border-warning text-warning-soft-fg',
    header: 'bg-warning-soft border-warning',
    headerTexto: 'text-warning-soft-fg',
  },
  rojo: {
    chipActivo: 'bg-danger-soft border-danger text-danger-soft-fg',
    header: 'bg-danger-soft border-danger',
    headerTexto: 'text-danger-soft-fg',
  },
  morado: {
    chipActivo: 'bg-purple-soft border-purple text-purple-soft-fg',
    header: 'bg-purple-soft border-purple',
    headerTexto: 'text-purple-soft-fg',
  },
  teal: {
    chipActivo: 'bg-teal-soft border-teal text-teal-soft-fg',
    header: 'bg-teal-soft border-teal',
    headerTexto: 'text-teal-soft-fg',
  },
};

function ChipFichaAuxilios({ ficha, activo, onClick }: {
  ficha: FichaAuxilios; activo: boolean; onClick: () => void;
}) {
  const estilo = ESTILO_TONO_FICHA[ficha.tono];
  return (
    <button
      onClick={onClick}
      className={cn(
        'px-3 py-2 rounded-full text-xs font-medium border transition-all flex items-center gap-1.5 whitespace-nowrap',
        activo ? estilo.chipActivo : 'border-line text-muted hover:text-soft hover:bg-elevated'
      )}
    >
      <span>{ficha.icono}</span>
      {ficha.titulo}
    </button>
  );
}

function BloqueFichaView({ bloque }: { bloque: BloqueFicha }) {
  if (bloque.tipo === 'texto') {
    return <p className="text-sm text-soft leading-relaxed">{bloque.texto}</p>;
  }
  if (bloque.tipo === 'pasos') {
    return (
      <div className="flex flex-col gap-1.5">
        {bloque.titulo && <span className="text-sm font-semibold text-strong">{bloque.titulo}</span>}
        <ol className="flex flex-col gap-1.5 list-decimal list-inside marker:text-muted marker:font-semibold">
          {bloque.items?.map((item, i) => (
            <li key={i} className="text-sm text-soft leading-relaxed pl-1">{item}</li>
          ))}
        </ol>
      </div>
    );
  }
  if (bloque.tipo === 'hacer') {
    return (
      <div className="rounded-lg border border-success bg-success-soft px-3 py-2.5 flex flex-col gap-1.5">
        <span className="text-xs font-bold text-success-soft-fg">✓ {bloque.titulo}</span>
        <ul className="flex flex-col gap-1">
          {bloque.items?.map((item, i) => (
            <li key={i} className="text-xs text-success-soft-fg leading-relaxed flex gap-2">
              <span className="flex-shrink-0">•</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </div>
    );
  }
  if (bloque.tipo === 'no_hacer') {
    return (
      <div className="rounded-lg border border-danger bg-danger-soft px-3 py-2.5 flex flex-col gap-1.5">
        <span className="text-xs font-bold text-danger-soft-fg">✕ {bloque.titulo}</span>
        <ul className="flex flex-col gap-1">
          {bloque.items?.map((item, i) => (
            <li key={i} className="text-xs text-danger-soft-fg leading-relaxed flex gap-2">
              <span className="flex-shrink-0">•</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </div>
    );
  }
  // aviso
  return (
    <div className="rounded-lg border border-line bg-elevated px-3 py-2.5">
      <p className="text-xs text-soft leading-relaxed">ℹ️ {bloque.texto}</p>
    </div>
  );
}

function FichaAuxiliosDetalle({ ficha }: { ficha: FichaAuxilios }) {
  const estilo = ESTILO_TONO_FICHA[ficha.tono];
  return (
    <div className="flex flex-col gap-3">
      <div className={cn('rounded-2xl border-2 px-4 py-4 flex flex-col gap-1.5', estilo.header)}>
        <div className="flex items-center gap-2">
          <span className="text-2xl leading-none flex-shrink-0">{ficha.icono}</span>
          <span className={cn('text-base font-bold', estilo.headerTexto)}>{ficha.titulo}</span>
        </div>
        <p className={cn('text-xs leading-relaxed', estilo.headerTexto)}>{ficha.resumen}</p>
      </div>

      <div className="flex flex-col gap-2.5">
        {ficha.bloques.map((bloque, i) => (
          <BloqueFichaView key={i} bloque={bloque} />
        ))}
      </div>

      {ficha.llamar123 && (
        <a
          href="tel:123"
          className="rounded-xl border border-danger bg-danger text-white text-base font-bold py-4 flex items-center justify-center gap-2 hover:brightness-110 transition"
        >
          📞 Llamar al 123
        </a>
      )}
    </div>
  );
}

function GuiaAuxiliosRapida() {
  const [fichaId, setFichaId] = useState<string | null>(null);
  const ficha = fichaId ? fichaPorId(fichaId) : undefined;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h3 className="text-strong text-sm font-semibold">🚑 Guía de primeros auxilios</h3>
        <p className="text-muted text-xs">Fichas de consulta rápida. Toca una para leerla.</p>
      </div>

      <div className="flex items-center gap-1.5 flex-wrap">
        {FICHAS_AUXILIOS.map(f => (
          <ChipFichaAuxilios
            key={f.id}
            ficha={f}
            activo={fichaId === f.id}
            onClick={() => setFichaId(prev => (prev === f.id ? null : f.id))}
          />
        ))}
      </div>

      {ficha ? (
        <FichaAuxiliosDetalle ficha={ficha} />
      ) : (
        <div className="flex flex-col gap-3">
          <p className="text-[11px] text-muted leading-relaxed">
            Adaptado para Colombia: donde la fuente original dice 112, aquí dice 123.
          </p>
          <p className="text-[11px] text-muted leading-relaxed">
            Fuente: «{ATRIBUCION.obra}». {ATRIBUCION.editor}, {ATRIBUCION.anio}. ISBN {ATRIBUCION.isbn}. {ATRIBUCION.nota}
          </p>
          <div className="rounded-xl border border-warning bg-warning-soft px-4 py-3 flex flex-col gap-2">
            <span className="text-xs font-semibold text-warning-soft-fg">⏳ Pendiente de revisión por el COPASST</span>
            <ul className="flex flex-col gap-1.5">
              {NOTAS_REVISION.map((nota, i) => (
                <li key={i} className="text-[11px] text-warning-soft-fg leading-relaxed flex gap-2">
                  <span className="flex-shrink-0">•</span>
                  <span>{nota}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

type VistaEmergencia = 'menu' | 'primeros_auxilios' | 'contencion' | 'protocolo_completo' | 'guia_auxilios' | 'informe_contencion' | 'remision_seguro';

function BotonVolver({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="self-start px-3 py-2 rounded-lg text-xs font-semibold text-soft border border-line bg-elevated hover:bg-hover transition flex items-center gap-1.5"
    >
      ← {children}
    </button>
  );
}

function TarjetaSubmenu({ icono, titulo, subtitulo, onClick }: {
  icono: string; titulo: string; subtitulo: string; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left rounded-2xl border border-line bg-card px-5 py-4 flex items-center gap-4 hover:bg-elevated active:bg-hover transition"
    >
      <span className="text-3xl leading-none flex-shrink-0">{icono}</span>
      <div className="flex flex-col gap-0.5 min-w-0">
        <span className="text-strong text-base font-semibold">{titulo}</span>
        <span className="text-muted text-xs leading-relaxed">{subtitulo}</span>
      </div>
    </button>
  );
}

function SubmenuEmergencia({ onSeleccionar }: { onSeleccionar: (vista: VistaEmergencia) => void }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-xl border border-warning bg-warning-soft px-4 py-3">
        <p className="text-xs text-warning-soft-fg leading-relaxed">
          ⚠️ <strong>En pruebas.</strong> Esta guía puede cambiar. En una urgencia manda el <strong>123</strong>;
          en salud mental, la <strong>Línea Naranja</strong>. Si algo aquí no cuadra con lo que estás viendo, hazle
          caso a la línea, no a la aplicación.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <TarjetaSubmenu
          icono="🚑"
          titulo="Primeros auxilios"
          subtitulo="Lesión, golpe, desmayo, malestar físico"
          onClick={() => onSeleccionar('primeros_auxilios')}
        />
        <TarjetaSubmenu
          icono="💚"
          titulo="Contención emocional"
          subtitulo="Tristeza, angustia, crisis emocional"
          onClick={() => onSeleccionar('contencion')}
        />
        <TarjetaSubmenu
          icono="📋"
          titulo="Consultar el protocolo completo"
          subtitulo="El documento institucional, para leer con calma"
          onClick={() => onSeleccionar('protocolo_completo')}
        />
        <TarjetaSubmenu
          icono="🩹"
          titulo="Guía de primeros auxilios"
          subtitulo="Fichas de consulta rápida"
          onClick={() => onSeleccionar('guia_auxilios')}
        />
      </div>
    </div>
  );
}

function LlamadaFaseView({ llamada, onIrANumeros }: { llamada: LlamadaFase; onIrANumeros: () => void }) {
  if (llamada.pendiente) {
    return (
      <div className="rounded-lg border border-danger bg-danger-soft px-3 py-2.5 flex flex-col gap-1.5">
        <span className="text-xs font-semibold text-danger-soft-fg">⏳ {llamada.etiqueta}</span>
        <p className="text-[11px] text-danger-soft-fg leading-relaxed">
          Pendiente de confirmar con rectoría.
        </p>
        <button
          onClick={onIrANumeros}
          className="self-start text-[11px] font-semibold text-danger-soft-fg underline underline-offset-2"
        >
          Ver números de emergencia →
        </button>
      </div>
    );
  }
  return (
    <a
      href={`tel:${llamada.telefono}`}
      className={cn(
        'rounded-lg border px-4 py-3 flex items-center justify-center gap-2 font-semibold transition',
        llamada.destacada
          ? 'bg-danger border-danger text-white text-base py-4 hover:brightness-110'
          : 'bg-card border-line text-strong text-sm hover:bg-elevated'
      )}
    >
      📞 {llamada.etiqueta}{llamada.telefono ? ` · ${formatearTelefono(llamada.telefono)}` : ''}
    </a>
  );
}

function VisorFase({ fase, indice, total, mostrarNumero = true, textoBotonFinal = 'Terminar', onSiguiente, onAnterior, onTerminar, onIrANumeros, onIrAGuia, onIrARemisionSeguro }: {
  fase: FaseEmergencia;
  indice: number;
  total: number;
  mostrarNumero?: boolean;
  textoBotonFinal?: string;
  onSiguiente: () => void;
  onAnterior: () => void;
  onTerminar: () => void;
  onIrANumeros: () => void;
  onIrAGuia?: () => void;
  onIrARemisionSeguro?: () => void;
}) {
  const estilo = ESTILO_TONO_FASE[fase.tono];
  const esUltima = indice === total - 1;

  return (
    <div className="flex flex-col gap-4">
      <span className="text-[11px] font-medium text-muted text-center">
        Fase {indice + 1} de {total}
      </span>

      <div className={cn('rounded-2xl border-2 px-5 py-5 flex flex-col gap-2', estilo.fondo, estilo.borde)}>
        <div className="flex items-center justify-between gap-2">
          <span className={cn('text-2xl font-bold', estilo.texto)}>
            {mostrarNumero ? `${indice + 1}. ` : ''}{fase.titulo}
          </span>
          <ChipNivelFuente nivel={fase.nivelFuente} />
        </div>
        {fase.subtitulo && (
          <span className={cn('text-sm font-medium', estilo.texto)}>{fase.subtitulo}</span>
        )}
      </div>

      <div className="flex flex-col gap-3">
        {fase.bloques.map((bloque, i) => (
          <div key={i} className="rounded-xl border border-line bg-card px-4 py-3.5 flex flex-col gap-1.5">
            <span className="text-sm font-bold text-strong">{bloque.titulo}</span>
            <p className="text-sm text-soft leading-relaxed">{bloque.texto}</p>
          </div>
        ))}
      </div>

      {fase.id === 2 && onIrAGuia && (
        <button
          onClick={onIrAGuia}
          className="rounded-lg border border-line bg-elevated px-4 py-3 text-sm font-semibold text-accent hover:bg-hover transition"
        >
          🩹 Ver la guía de primeros auxilios →
        </button>
      )}

      {fase.id === 3 && onIrARemisionSeguro && (
        <button
          onClick={onIrARemisionSeguro}
          className="rounded-lg border border-line bg-elevated px-4 py-3 text-sm font-semibold text-accent hover:bg-hover transition"
        >
          📄 Escanear documento para el seguro →
        </button>
      )}

      {fase.llamadas && fase.llamadas.length > 0 && (
        <div className="flex flex-col gap-2">
          {fase.llamadas.map((llamada, i) => (
            <LlamadaFaseView key={i} llamada={llamada} onIrANumeros={onIrANumeros} />
          ))}
        </div>
      )}

      <div className="flex items-center gap-2 pt-1">
        {indice > 0 && (
          <button
            onClick={onAnterior}
            className="flex-1 px-4 py-3 rounded-xl text-sm font-semibold text-soft border border-line bg-elevated hover:bg-hover transition"
          >
            ← Anterior
          </button>
        )}
        <button
          onClick={esUltima ? onTerminar : onSiguiente}
          className="flex-1 px-4 py-3 rounded-xl text-sm font-semibold text-accent-fg bg-accent hover:brightness-110 transition"
        >
          {esUltima ? textoBotonFinal : 'Siguiente fase →'}
        </button>
      </div>
    </div>
  );
}

function VisorFases({ secuenciaIds, mostrarNumero = true, textoBotonFinal, onTerminar, onIrANumeros, onIrAGuia, onIrARemisionSeguro }: {
  secuenciaIds: number[];
  mostrarNumero?: boolean;
  textoBotonFinal?: string;
  onTerminar: () => void;
  onIrANumeros: () => void;
  onIrAGuia?: () => void;
  onIrARemisionSeguro?: () => void;
}) {
  const [indice, setIndice] = useState(0);
  const fase = faseporId(secuenciaIds[indice]);

  return (
    <VisorFase
      fase={fase}
      indice={indice}
      total={secuenciaIds.length}
      mostrarNumero={mostrarNumero}
      textoBotonFinal={textoBotonFinal}
      onSiguiente={() => setIndice(i => Math.min(i + 1, secuenciaIds.length - 1))}
      onAnterior={() => setIndice(i => Math.max(i - 1, 0))}
      onTerminar={onTerminar}
      onIrANumeros={onIrANumeros}
      onIrAGuia={onIrAGuia}
      onIrARemisionSeguro={onIrARemisionSeguro}
    />
  );
}

function EmergenciaEscolar({ onIrANumeros }: { onIrANumeros: () => void }) {
  const [vista, setVista] = useState<VistaEmergencia>('menu');

  if (vista === 'menu') {
    return <SubmenuEmergencia onSeleccionar={setVista} />;
  }

  const volver = () => setVista('menu');

  if (vista === 'primeros_auxilios') {
    return (
      <div className="flex flex-col gap-4">
        <BotonVolver onClick={volver}>Volver</BotonVolver>
        <VisorFases
          secuenciaIds={SECUENCIA_PRIMEROS_AUXILIOS}
          onTerminar={volver}
          onIrANumeros={onIrANumeros}
          onIrAGuia={() => setVista('guia_auxilios')}
          onIrARemisionSeguro={() => setVista('remision_seguro')}
        />
      </div>
    );
  }

  if (vista === 'contencion') {
    return (
      <div className="flex flex-col gap-4">
        <BotonVolver onClick={volver}>Volver</BotonVolver>
        <VisorFases
          secuenciaIds={SECUENCIA_CONTENCION_EMOCIONAL}
          mostrarNumero={false}
          textoBotonFinal="Generar informe →"
          onTerminar={() => setVista('informe_contencion')}
          onIrANumeros={onIrANumeros}
        />
      </div>
    );
  }

  if (vista === 'guia_auxilios') {
    return (
      <div className="flex flex-col gap-4">
        <BotonVolver onClick={volver}>Volver</BotonVolver>
        <GuiaAuxiliosRapida />
      </div>
    );
  }

  if (vista === 'informe_contencion') {
    return (
      <div className="flex flex-col gap-4">
        <BotonVolver onClick={volver}>Volver</BotonVolver>
        <InformeContencion onTerminado={volver} onCancelar={volver} />
      </div>
    );
  }

  if (vista === 'remision_seguro') {
    return (
      <div className="flex flex-col gap-4">
        <BotonVolver onClick={volver}>Volver</BotonVolver>
        <RemisionSeguro onTerminado={volver} onCancelar={volver} />
      </div>
    );
  }

  // protocolo_completo
  return (
    <div className="flex flex-col gap-4">
      <BotonVolver onClick={volver}>Volver</BotonVolver>
      <ProtocoloEmergencias />
    </div>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────

type Pestana = 'brigadas' | 'emergencias' | 'protocolo';

export default function GestionRiesgo() {
  const userId = useAppStore(s => s.userId);
  const rol = useAppStore(s => s.rol);
  const sedeActual = useAppStore(s => s.sedeActual);
  const [pestana, setPestana] = useState<Pestana>('brigadas');

  const pertenencias = userId ? brigadasDeDocente(userId) : [];
  const liderazgos = userId ? liderazgosDeDocente(userId) : [];
  const yaTieneEvacuacion = pertenencias.some(p => p.brigada.id === 'evacuacion');

  return (
    <div className="max-w-2xl mx-auto flex flex-col gap-6">

      {/* Encabezado */}
      <div className="flex flex-col gap-1">
        <h2 className="text-strong text-lg font-semibold">Gestión del Riesgo</h2>
        <p className="text-muted text-xs">{RESOLUCION_BRIGADAS.titulo}</p>
      </div>

      {/* Pestañas */}
      <div className="flex items-center gap-1.5 border-b border-line pb-2">
        <button
          onClick={() => setPestana('brigadas')}
          className={cn(
            'px-3 py-1.5 rounded-full text-xs font-medium border transition-all',
            pestana === 'brigadas'
              ? 'bg-accent-soft border-accent text-accent'
              : 'border-success text-success hover:bg-elevated'
          )}
        >
          🧑‍🚒 Brigadas
        </button>
        <button
          onClick={() => setPestana('emergencias')}
          className={cn(
            'px-3 py-1.5 rounded-full text-xs font-medium border transition-all',
            pestana === 'emergencias'
              ? 'bg-accent-soft border-accent text-accent'
              : 'border-warning text-warning hover:bg-elevated'
          )}
        >
          📞 Números de emergencia
        </button>
        <button
          onClick={() => setPestana('protocolo')}
          className={cn(
            'px-3 py-1.5 rounded-full text-xs font-medium border transition-all flex items-center gap-1.5',
            pestana === 'protocolo'
              ? 'bg-accent-soft border-accent text-accent'
              : 'border-danger text-danger hover:bg-elevated'
          )}
        >
          🚑 Emergencia escolar <BadgeBeta />
        </button>
      </div>

      {pestana === 'protocolo' ? (
        <EmergenciaEscolar onIrANumeros={() => setPestana('emergencias')} />
      ) : pestana === 'emergencias' ? (
        <NumerosEmergencia />
      ) : (
        <>
          {/* Tus brigadas */}
          <div className="flex flex-col gap-3">
            <h3 className="text-strong text-sm font-semibold">🧑‍🚒 Tus brigadas</h3>

            {liderazgos.map((l, i) => (
              <TarjetaPertenencia
                key={`lider-${i}`}
                titulo="Líder de gestión del riesgo"
                sub={`${SEDES.find(s => s.id === l.sede)?.nombre ?? 'Todas las sedes'} · ${JORNADA_LABEL[l.jornada]}`}
                funciones={['Coordinar la respuesta a emergencias de la sede.', 'Activar las brigadas correspondientes según el tipo de emergencia.', 'Servir de enlace con DAGRD, SED y organismos de apoyo.']}
                esLider
              />
            ))}

            {pertenencias.map(({ brigada, integrante }, i) => (
              <TarjetaPertenencia
                key={`${brigada.id}-${i}`}
                titulo={brigada.nombre}
                sub={`${SEDES.find(s => s.id === integrante.sede)?.nombre ?? 'Todas las sedes'} · ${JORNADA_LABEL[integrante.jornada]}${integrante.nota ? ` · ${integrante.nota}` : ''}`}
                funciones={brigada.funciones}
              />
            ))}

            {!yaTieneEvacuacion && rol === 'docente' && (
              <TarjetaPertenencia
                titulo="Brigada de evacuación (todos los docentes en aula)"
                sub="Artículo 3 de la resolución — aplica a todo docente presente en el aula."
                funciones={BRIGADA_EVACUACION.funciones}
              />
            )}
          </div>

          {/* Brigadas por sede — solo directivos */}
          {esDirectivo(rol) && <SeccionPorSede />}

          {/* Acordeón para no directivos */}
          {!esDirectivo(rol) && <AcordeonMiSede sede={sedeActual} />}
        </>
      )}
    </div>
  );
}
