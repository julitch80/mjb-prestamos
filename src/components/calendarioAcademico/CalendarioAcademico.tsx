// Calendario académico 2026: Próximo / Lo que falta / Mes, con búsqueda y filtros.
import { useMemo, useState } from 'react';
import { ChevronDown, ChevronLeft, ChevronRight, History, Pencil, Plus, Search } from 'lucide-react';
import { useAppStore } from '../../data/store';
import { ASIGNACION_2026 } from '../../data/asignacionAcademica';
import { useCalendario } from '../../data/calendarioAcademico/persistencia';
import {
  buscar, cambioReciente, diaDeSemana, estadoActual, eventosDelDia, eventosParaGrado11, filtrarPorCategoria,
  hoyISO, nombreMes, pasados, pendientesPorMes, proximos, sumarDias, textoCuentaRegresiva, textoFecha,
} from '../../data/calendarioAcademico/logica';
import { CATEGORIAS, colorCategoria, type CategoriaCal, type EventoCal } from '../../data/calendarioAcademico/tipos';
import { cn } from '@/lib/utils';
import ModalEvento from './ModalEvento';
import RegistroCambios from './RegistroCambios';

type Vista = 'proximo' | 'falta' | 'mes';

function Insignia({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span className={cn('inline-block text-[11px] font-medium px-2 py-0.5 rounded-full', className)}>{children}</span>;
}

function FilaEvento({ e, hoy, extra, onEditar }: { e: EventoCal; hoy: string; extra?: React.ReactNode; onEditar?: () => void }) {
  const cambio = cambioReciente(e, hoy);
  return (
    <div className="flex items-start gap-3 py-2.5">
      <span className="mt-1.5 w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: colorCategoria(e.categoria) }} />
      <div className="min-w-0 flex-1">
        <p className={cn('text-sm text-strong leading-snug', e.noSeRealiza && 'line-through opacity-70')}>{e.titulo}</p>
        <p className="text-xs text-soft mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1">
          {cambio && e.cambio && (
            <span className="line-through opacity-70">
              {e.cambio.antes.porDefinir ? 'Por definir' : textoFecha(e.cambio.antes)}
            </span>
          )}
          <span className={cn(cambio && 'text-strong font-medium')}>{e.noSeRealiza ? 'No se realiza' : textoFecha(e)}</span>
          {e.aplicaA === 'grado11' && <Insignia className="bg-purple-soft text-purple-soft-fg">Grado 11</Insignia>}
          {cambio && <Insignia className="bg-warning-soft text-warning-soft-fg">Cambió</Insignia>}
          {e.porDefinir && <Insignia className="bg-elevated text-soft">Por definir</Insignia>}
        </p>
        {e.nota && <p className="text-xs text-muted mt-1">{e.nota}</p>}
      </div>
      {extra}
      {onEditar && (
        <button onClick={onEditar} aria-label={`Editar ${e.titulo}`}
          className="p-2 -mr-1 rounded-lg text-soft hover:text-strong hover:bg-elevated flex-shrink-0">
          <Pencil size={14} />
        </button>
      )}
    </div>
  );
}

export default function CalendarioAcademico() {
  const userId = useAppStore(s => s.userId);
  const rol = useAppStore(s => s.rol);
  const { eventos, desdeFirestore, puedeEditar, guardar } = useCalendario();
  const hoy = hoyISO();
  const [vista, setVista] = useState<Vista>('proximo');
  const [texto, setTexto] = useState('');
  const [cats, setCats] = useState<CategoriaCal[]>([]);
  const [verPasados, setVerPasados] = useState(false);
  const [mes, setMes] = useState(hoy.slice(0, 7));
  const [dia, setDia] = useState<string | null>(null);
  const [editando, setEditando] = useState<EventoCal | 'nuevo' | null>(null);
  const [verRegistro, setVerRegistro] = useState(false);

  const ensenaOnce = rol !== 'docente' || ASIGNACION_2026.some(a => a.docenteId === userId && a.grupo.startsWith('11'));
  const visibles = useMemo(() => {
    const base = eventosParaGrado11(eventos, ensenaOnce);
    return buscar(filtrarPorCategoria(base, cats), texto);
  }, [eventos, ensenaOnce, cats, texto]);

  const estado = useMemo(() => estadoActual(eventos, hoy), [eventos, hoy]);
  const lista = useMemo(() => proximos(visibles, hoy, 6), [visibles, hoy]);
  const grupos = useMemo(() => pendientesPorMes(visibles, hoy), [visibles, hoy]);
  const viejos = useMemo(() => pasados(visibles, hoy), [visibles, hoy]);
  const buscando = texto.trim() !== '';

  function alternarCat(c: CategoriaCal) { setCats(p => (p.includes(c) ? p.filter(x => x !== c) : [...p, c])); }

  const cabecera = estado.periodo
    ? `${estado.nombrePeriodo[0].toUpperCase()}${estado.nombrePeriodo.slice(1)} · semana ${estado.semanaN} de ${estado.totalSemanas} · faltan ${estado.diasLectivosRestantes} días lectivos`
    : 'Fuera de periodo lectivo';
  const editar = puedeEditar ? (e: EventoCal) => setEditando(e) : undefined;

  return (
    <div className="space-y-3">
      <div className="rounded-xl bg-card border border-line px-4 py-3">
        <p className="text-strong text-sm font-semibold">{cabecera}</p>
        {estado.enReceso && estado.periodo && <p className="text-xs text-soft mt-0.5">Hoy estás en receso de estudiantes.</p>}
        {!desdeFirestore && <p className="text-[11px] text-muted mt-1">Mostrando las fechas del documento oficial v2.</p>}
      </div>

      {/* Búsqueda siempre visible */}
      <div className="relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
        <input value={texto} onChange={e => setTexto(e.target.value)} placeholder="Buscar: informes, receso, graduación…"
          aria-label="Buscar en el calendario"
          className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-card border border-line text-sm text-strong placeholder:text-muted outline-none focus:border-accent" />
      </div>

      <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
        {CATEGORIAS.map(c => {
          const on = cats.includes(c.id);
          return (
            <button key={c.id} onClick={() => alternarCat(c.id)} aria-pressed={on}
              className={cn('flex items-center gap-1.5 whitespace-nowrap text-xs px-3 py-1.5 rounded-full border transition',
                on ? 'bg-elevated text-strong border-accent' : 'bg-card text-soft border-line hover:text-strong')}>
              <span className="w-2 h-2 rounded-full" style={{ background: c.color }} />{c.label}
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-2">
        <div className="flex gap-1.5 flex-1">
          {([['proximo', 'Próximo'], ['falta', 'Lo que falta'], ['mes', 'Mes']] as const).map(([id, label]) => (
            <button key={id} onClick={() => setVista(id)}
              className={cn('flex-1 text-xs font-medium px-3 py-2 rounded-full transition',
                vista === id ? 'bg-accent text-strong' : 'bg-elevated text-soft hover:text-strong')}>{label}</button>
          ))}
        </div>
      </div>

      {puedeEditar && (
        <div className="flex gap-2">
          <button onClick={() => setEditando('nuevo')}
            className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg bg-elevated text-strong hover:bg-line"><Plus size={14} /> Agregar evento</button>
          <button onClick={() => setVerRegistro(true)}
            className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg bg-elevated text-soft hover:text-strong"><History size={14} /> Ver registro de cambios</button>
        </div>
      )}

      {/* PRÓXIMO */}
      {vista === 'proximo' && (
        <div className="rounded-xl bg-card border border-line px-4 divide-y divide-line">
          {lista.length === 0 && <p className="text-sm text-soft py-4">No hay eventos próximos con ese filtro.</p>}
          {lista.map(p => (
            <div key={p.evento.id} className={cn(p.estaSemana && '-mx-4 px-4 bg-info-soft/40')}>
              <FilaEvento e={p.evento} hoy={hoy} onEditar={editar ? () => editar(p.evento) : undefined}
                extra={<span className={cn('text-xs font-semibold whitespace-nowrap mt-0.5', p.dias <= 2 ? 'text-danger-soft-fg' : 'text-soft')}>
                  {textoCuentaRegresiva(p.dias, p.enCurso)}</span>} />
            </div>
          ))}
          {lista.length > 0 && <p className="text-[11px] text-muted py-2">Lo resaltado ocurre esta semana.</p>}
        </div>
      )}

      {/* LO QUE FALTA */}
      {vista === 'falta' && (
        <div className="space-y-3">
          {grupos.length === 0 && <p className="text-sm text-soft">Nada pendiente con ese filtro.</p>}
          {grupos.map(g => (
            <div key={g.mes}>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-soft mb-1 px-1">{nombreMes(g.mes)}</h3>
              <div className="rounded-xl bg-card border border-line px-4 divide-y divide-line">
                {g.eventos.map(e => <FilaEvento key={e.id} e={e} hoy={hoy} onEditar={editar ? () => editar(e) : undefined} />)}
              </div>
            </div>
          ))}
          <button onClick={() => setVerPasados(v => !v)} aria-expanded={verPasados}
            className="w-full flex items-center justify-between text-sm text-soft hover:text-strong px-4 py-2.5 rounded-xl bg-card border border-line">
            <span>Ya pasó ({viejos.length})</span>
            <ChevronDown size={16} className={cn('transition', verPasados && 'rotate-180')} />
          </button>
          {verPasados && (
            <div className="rounded-xl bg-card border border-line px-4 divide-y divide-line opacity-80">
              {viejos.map(e => <FilaEvento key={e.id} e={e} hoy={hoy} onEditar={editar ? () => editar(e) : undefined} />)}
            </div>
          )}
        </div>
      )}

      {/* MES */}
      {vista === 'mes' && (
        <VistaMes eventos={visibles} mes={mes} setMes={setMes} dia={dia} setDia={setDia} hoy={hoy} buscando={buscando}
          onEditar={editar} />
      )}

      {editando && (
        <ModalEvento evento={editando === 'nuevo' ? null : editando} onCerrar={() => setEditando(null)}
          onGuardar={async (antes, despues, motivo) => { await guardar(antes, despues, motivo); setEditando(null); }} />
      )}
      {verRegistro && <RegistroCambios onCerrar={() => setVerRegistro(false)} />}
    </div>
  );
}

// ── Mes ──────────────────────────────────────────────────────────────────────

function VistaMes({ eventos, mes, setMes, dia, setDia, hoy, buscando, onEditar }: {
  eventos: EventoCal[]; mes: string; setMes: (m: string) => void; dia: string | null; setDia: (d: string | null) => void;
  hoy: string; buscando: boolean; onEditar?: (e: EventoCal) => void;
}) {
  const primero = `${mes}-01`;
  const offset = (diaDeSemana(primero) + 6) % 7; // lunes = 0
  const inicio = sumarDias(primero, -offset);
  const celdas = Array.from({ length: 42 }, (_, i) => sumarDias(inicio, i));
  const mover = (n: number) => {
    const [y, m] = mes.split('-').map(Number);
    const d = new Date(Date.UTC(y, m - 1 + n, 1));
    setMes(d.toISOString().slice(0, 7)); setDia(null);
  };
  const delMes = (f: string) => eventosDelDia(eventos, f).filter(e => e.categoria !== 'periodo' || e.desde === f);
  const seleccionados = dia ? delMes(dia) : [];
  return (
    <div className="rounded-xl bg-card border border-line p-3">
      <div className="flex items-center justify-between mb-2">
        <button onClick={() => mover(-1)} aria-label="Mes anterior" className="p-2 rounded-lg text-soft hover:text-strong hover:bg-elevated"><ChevronLeft size={18} /></button>
        <span className="text-sm font-semibold text-strong capitalize">{nombreMes(mes)}</span>
        <button onClick={() => mover(1)} aria-label="Mes siguiente" className="p-2 rounded-lg text-soft hover:text-strong hover:bg-elevated"><ChevronRight size={18} /></button>
      </div>
      <div className="grid grid-cols-7 text-center text-[11px] text-muted mb-1">
        {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((d, i) => <span key={i}>{d}</span>)}
      </div>
      <div className="grid grid-cols-7 gap-0.5">
        {celdas.map(f => {
          const fuera = f.slice(0, 7) !== mes;
          const evs = fuera ? [] : delMes(f).filter(e => e.categoria !== 'periodo');
          const cats = [...new Set(evs.map(e => e.categoria))].slice(0, 3);
          const esHoy = f === hoy;
          return (
            <button key={f} disabled={fuera} onClick={() => setDia(dia === f ? null : f)}
              aria-label={`${Number(f.slice(8))} de ${nombreMes(mes)}${evs.length ? `, ${evs.length} eventos` : ''}`}
              className={cn('h-11 rounded-lg flex flex-col items-center justify-center gap-0.5 text-xs transition',
                fuera ? 'opacity-0 pointer-events-none' : 'hover:bg-elevated',
                esHoy && 'ring-1 ring-accent', dia === f && 'bg-elevated', 'text-strong')}>
              <span>{Number(f.slice(8))}</span>
              <span className="flex gap-0.5 h-1.5">
                {cats.map(c => <span key={c} className="w-1.5 h-1.5 rounded-full" style={{ background: colorCategoria(c) }} />)}
              </span>
            </button>
          );
        })}
      </div>
      {dia && (
        <div className="mt-3 pt-2 border-t border-line">
          <p className="text-xs text-soft mb-1">{textoFecha({ desde: dia })}</p>
          {seleccionados.length === 0 && <p className="text-sm text-soft py-1">Sin eventos este día.</p>}
          <div className="divide-y divide-line">
            {seleccionados.map(e => <FilaEvento key={e.id} e={e} hoy={hoy} onEditar={onEditar ? () => onEditar(e) : undefined} />)}
          </div>
        </div>
      )}
      {buscando && <p className="text-[11px] text-muted mt-2">La búsqueda también filtra los puntos del mes.</p>}
    </div>
  );
}

