import { useEffect, useState } from 'react';
import { httpsCallable } from 'firebase/functions';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db, functions } from '../lib/firebase';
import type { UsuarioFirestore } from '../data/adminUsers';

// Reemplazo temporal (docs/reemplazo-temporal): el reemplazo ocupa el puesto del
// titular hasta la fecha de regreso; el titular queda en solo lectura.

interface Props {
  usuarios: UsuarioFirestore[];
  onCambio: () => void | Promise<void>;
}

interface Previa {
  slot: string;
  titularNombre: string;
  reemplazoNombre: string;
  titularEmail: string;
  reemplazoEmail: string;
  hasta: string;
}

interface Activo {
  id: string;
  slot: string;
  titularEmail: string;
  reemplazoEmail: string;
  hasta: string;
}

type Msg = { tipo: 'ok' | 'error'; texto: string } | null;

const fmt = (iso: string) => {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
};

export default function SeccionReemplazoTemporal({ usuarios, onCambio }: Props) {
  const [titular, setTitular] = useState('');
  const [reemplazo, setReemplazo] = useState('');
  const [hasta, setHasta] = useState('');
  const [previa, setPrevia] = useState<Previa | null>(null);
  const [confirmando, setConfirmando] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [msg, setMsg] = useState<Msg>(null);
  const [activos, setActivos] = useState<Activo[]>([]);
  const [editando, setEditando] = useState<{ id: string; fecha: string } | null>(null);
  const [terminando, setTerminando] = useState<string | null>(null);

  useEffect(() => {
    if (!db) return;
    const q = query(collection(db, 'reemplazosTemporales'), where('estado', '==', 'activo'));
    return onSnapshot(q, (snap) => {
      setActivos(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Activo, 'id'>) })));
    }, () => { /* sin permiso o sin red: la lista queda vacía */ });
  }, []);

  const titulares = usuarios.filter((u) => u.active && u.slotId && !u.soloLectura);
  const reemplazos = usuarios.filter((u) => u.active && !u.slotId && u.role !== 'superusuario' && u.email !== titular);
  const nombre = (email: string) => usuarios.find((u) => u.email === email)?.displayName ?? email;

  function limpiar() {
    setPrevia(null);
    setConfirmando(false);
  }

  async function llamar(data: Record<string, unknown>) {
    if (!functions) throw new Error('Firebase Functions no está configurado.');
    return (await httpsCallable(functions, 'reemplazoTemporal')(data)).data as Record<string, unknown>;
  }

  async function previsualizar() {
    setMsg(null);
    limpiar();
    setOcupado(true);
    try {
      const r = await llamar({ accion: 'previsualizar', titularEmail: titular, reemplazoEmail: reemplazo, hasta });
      setPrevia(r as unknown as Previa);
    } catch (e) {
      setMsg({ tipo: 'error', texto: (e as Error).message });
    } finally {
      setOcupado(false);
    }
  }

  async function iniciar() {
    setMsg(null);
    setOcupado(true);
    try {
      await llamar({ accion: 'iniciar', titularEmail: titular, reemplazoEmail: reemplazo, hasta });
      setMsg({ tipo: 'ok', texto: 'Reemplazo temporal iniciado.' });
      limpiar();
      setTitular('');
      setReemplazo('');
      setHasta('');
      await onCambio();
    } catch (e) {
      setMsg({ tipo: 'error', texto: (e as Error).message });
    } finally {
      setOcupado(false);
    }
  }

  async function terminar(id: string) {
    setMsg(null);
    setOcupado(true);
    try {
      await llamar({ accion: 'terminar', id });
      setMsg({ tipo: 'ok', texto: 'Reemplazo terminado: el puesto volvió al titular.' });
      setTerminando(null);
      await onCambio();
    } catch (e) {
      setMsg({ tipo: 'error', texto: (e as Error).message });
    } finally {
      setOcupado(false);
    }
  }

  async function cambiarFecha() {
    if (!editando) return;
    setMsg(null);
    setOcupado(true);
    try {
      await llamar({ accion: 'cambiarFecha', id: editando.id, hasta: editando.fecha });
      setMsg({ tipo: 'ok', texto: 'Fecha de regreso actualizada.' });
      setEditando(null);
      await onCambio();
    } catch (e) {
      setMsg({ tipo: 'error', texto: (e as Error).message });
    } finally {
      setOcupado(false);
    }
  }

  const campo = 'w-full px-3 py-2 rounded-lg bg-elevated border border-line text-strong text-sm focus:outline-none focus:border-line-strong';
  const boton = 'px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition disabled:opacity-40 disabled:cursor-not-allowed';

  return (
    <div className="bg-card rounded-xl p-5 space-y-3 max-w-xl">
      <h3 className="text-strong font-semibold">Reemplazo temporal</h3>
      <p className="text-muted text-xs leading-snug">
        Para una incapacidad: el reemplazo ocupa el puesto del titular hasta la fecha de regreso.
        El titular conserva su cuenta en solo lectura y recupera el puesto solo ese día.
        El reemplazo debe existir, estar activo y no tener puesto.
      </p>

      {msg && (
        <div className={'rounded-lg text-xs px-3 py-2 ' + (msg.tipo === 'ok' ? 'bg-success-soft text-success-soft-fg' : 'bg-danger-soft text-danger-soft-fg')}>
          {msg.texto}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label className="text-muted text-xs">Titular</label>
          <select value={titular} onChange={(e) => { setTitular(e.target.value); limpiar(); }} className={campo}>
            <option value="">Seleccionar…</option>
            {titulares.map((u) => <option key={u.email} value={u.email}>{u.displayName} ({u.slotId})</option>)}
          </select>
        </div>
        <div>
          <label className="text-muted text-xs">Reemplazo</label>
          <select value={reemplazo} onChange={(e) => { setReemplazo(e.target.value); limpiar(); }} className={campo}>
            <option value="">Seleccionar…</option>
            {reemplazos.map((u) => <option key={u.email} value={u.email}>{u.displayName}</option>)}
          </select>
        </div>
        <div>
          <label className="text-muted text-xs">Fecha de regreso</label>
          <input type="date" value={hasta} onChange={(e) => { setHasta(e.target.value); limpiar(); }} className={campo} />
        </div>
      </div>

      <button
        type="button"
        onClick={previsualizar}
        disabled={ocupado || !titular || !reemplazo || !hasta}
        className={boton + ' bg-elevated text-strong'}
      >
        {ocupado && !previa ? 'Previsualizando…' : 'Previsualizar'}
      </button>

      {previa && (
        <div className="rounded-lg bg-elevated text-xs px-3 py-2 space-y-1">
          <p className="text-strong font-medium">Puesto: {previa.slot}</p>
          <p className="text-soft">{previa.reemplazoNombre} ocupará el puesto de {previa.titularNombre} hasta el {fmt(previa.hasta)}.</p>
          <p className="text-soft">{previa.titularNombre} queda en solo lectura (sin puesto) y vuelve a tenerlo ese día.</p>
          {!confirmando ? (
            <button type="button" onClick={() => setConfirmando(true)} className={boton + ' mt-2 bg-danger-soft text-danger-soft-fg'}>
              Iniciar reemplazo…
            </button>
          ) : (
            <div className="mt-2 rounded-lg border border-warning bg-warning-soft text-warning-soft-fg px-3 py-2 space-y-2">
              <p className="font-medium">¿Confirmas iniciar el reemplazo temporal ahora?</p>
              <div className="flex gap-2">
                <button type="button" onClick={iniciar} disabled={ocupado} className={boton + ' bg-danger-soft text-danger-soft-fg'}>
                  {ocupado ? 'Iniciando…' : 'Sí, iniciar'}
                </button>
                <button type="button" onClick={() => setConfirmando(false)} disabled={ocupado} className={boton + ' bg-elevated text-strong'}>
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="pt-2 border-t border-line space-y-2">
        <h4 className="text-strong text-sm font-semibold">Reemplazos activos</h4>
        {activos.length === 0 && <p className="text-muted text-xs">No hay reemplazos temporales activos.</p>}
        {activos.map((a) => (
          <div key={a.id} className="rounded-lg bg-elevated text-xs px-3 py-2 space-y-2">
            <p className="text-soft">
              <span className="text-strong font-medium">{nombre(a.reemplazoEmail)}</span> reemplaza a{' '}
              <span className="text-strong font-medium">{nombre(a.titularEmail)}</span> ({a.slot}) hasta el {fmt(a.hasta)}.
            </p>
            {editando?.id === a.id ? (
              <div className="flex flex-wrap items-center gap-2">
                <input type="date" value={editando.fecha} onChange={(e) => setEditando({ id: a.id, fecha: e.target.value })} className={campo + ' !w-auto'} />
                <button type="button" onClick={cambiarFecha} disabled={ocupado || !editando.fecha} className={boton + ' bg-card text-strong'}>Guardar</button>
                <button type="button" onClick={() => setEditando(null)} className={boton + ' bg-card text-soft'}>Cancelar</button>
              </div>
            ) : terminando === a.id ? (
              <div className="flex flex-wrap items-center gap-2 text-warning-soft-fg">
                <span>¿Devolver el puesto al titular ahora?</span>
                <button type="button" onClick={() => terminar(a.id)} disabled={ocupado} className={boton + ' bg-danger-soft text-danger-soft-fg'}>Sí, terminar</button>
                <button type="button" onClick={() => setTerminando(null)} className={boton + ' bg-card text-soft'}>Cancelar</button>
              </div>
            ) : (
              <div className="flex gap-2">
                <button type="button" onClick={() => setEditando({ id: a.id, fecha: a.hasta })} className={boton + ' bg-card text-strong'}>Cambiar fecha</button>
                <button type="button" onClick={() => setTerminando(a.id)} className={boton + ' bg-card text-strong'}>Terminar ahora</button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
