// «Vincular Classroom»: enlaza cada grupo+asignatura con un curso de Google Classroom.
// Solo aparece para quienes tienen documento en classroomVinculos/{correo} (o el superusuario); para el
// resto no se renderiza nada (criterio 8 del PRD). Backend: classroomCursos / classroomVincular.
import { useEffect, useMemo, useState } from 'react';
import { GraduationCap, Loader2, X } from 'lucide-react';
import { httpsCallable } from 'firebase/functions';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db, firebaseConfigurado, functions } from '../lib/firebase';
import { useAppStore } from '../data/store';
import { getAsignatura, ASIGNACION_2026 } from '../data/asignacionAcademica';
import { gruposAsignables, todosLosGrupos } from '../data/tareas/horario';
import { claveVinculo, sugerirCurso } from '../data/classroomSugerencia';

interface Curso { id: string; nombre: string; seccion?: string; anio?: number | null }
interface Vinculo { courseId: string; nombre?: string; registro?: { registrationId?: string; expiryTime?: string; error?: string } }
interface Par { grupo: string; asignatura: string }
type Resp = { ok: boolean; motivo?: string; detalle?: string; cursos?: Curso[]; desvinculado?: boolean; avisos?: boolean; registro?: { error?: string } };

const MSG_SIN_AUTORIZACION = 'Sin autorización: faltan los permisos de Classroom en la delegación de dominio (consola de administración).';

export default function VincularClassroom() {
  const { rol, userId } = useAppStore();
  const esSuper = rol === 'superusuario';
  const [visible, setVisible] = useState(false);
  const [abierto, setAbierto] = useState(false);

  // Gating: se lee una vez; cualquier fallo oculta la entrada sin avisar.
  useEffect(() => {
    let vivo = true;
    (async () => {
      if (!firebaseConfigurado || !db) return;
      if (esSuper) { if (vivo) setVisible(true); return; }
      try {
        const correo = auth?.currentUser?.email?.toLowerCase();
        if (!correo) return;
        // Piloto: quien tiene documento en classroomVinculos/{su correo} (lo crea el sistema).
        // Las reglas ya dejan a cada profesor leer el suyo; a los demás, la lectura falla o no existe.
        const snap = await getDoc(doc(db, 'classroomVinculos', correo));
        const ok = snap.exists();
        if (vivo && ok) setVisible(true);
      } catch { /* sin permiso o sin red: se oculta */ }
    })();
    return () => { vivo = false; };
  }, [esSuper]);

  if (!visible) return null;
  return (
    <>
      <button
        onClick={() => setAbierto(true)}
        className="px-3 py-1.5 rounded-full text-xs font-medium border border-line text-soft hover:bg-elevated transition-all flex items-center gap-1.5"
      >
        <GraduationCap size={13} /> Vincular Classroom
      </button>
      {abierto && <Panel esSuper={esSuper} userId={userId} onCerrar={() => setAbierto(false)} />}
    </>
  );
}

function Panel({ esSuper, userId, onCerrar }: { esSuper: boolean; userId: string | null; onCerrar: () => void }) {
  const [cuenta, setCuenta] = useState('');
  const [cursos, setCursos] = useState<Curso[] | null>(null);
  const [vinculos, setVinculos] = useState<Record<string, Vinculo>>({});
  const [elegidos, setElegidos] = useState<Record<string, string>>({});
  const [cargando, setCargando] = useState(false);
  const [trabajando, setTrabajando] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<{ tipo: 'ok' | 'aviso' | 'error'; texto: string } | null>(null);
  const [cargado, setCargado] = useState(false);
  const anio = new Date().getFullYear();

  // Pares grupo+asignatura: del docente si se resuelve por asignación; el superusuario
  // elige entre todos los del plan de estudios (su login no es la cuenta de profesor).
  // Superusuario: por defecto solo las filas con curso sugerido o ya vinculadas.
  const [relevantes, setRelevantes] = useState<Set<string>>(new Set());
  const [verTodos, setVerTodos] = useState(false);
  const pares: Par[] = useMemo(() => {
    if (!esSuper) {
      const propios = userId ? gruposAsignables(userId) : [];
      return propios.flatMap(g => g.asignaturaIds.map(id => ({ grupo: g.grupo, asignatura: getAsignatura(id)?.nombre ?? id })));
    }
    const vistos = new Set<string>();
    const todos: Par[] = [];
    for (const g of todosLosGrupos()) {
      for (const e of ASIGNACION_2026) {
        if (e.grupo !== g || e.asignaturaId === 'ci') continue;
        const nombre = getAsignatura(e.asignaturaId)?.nombre ?? e.asignaturaId;
        if (vistos.has(`${g}|${nombre}`)) continue;
        vistos.add(`${g}|${nombre}`);
        todos.push({ grupo: g, asignatura: nombre });
      }
    }
    return todos;
  }, [userId, esSuper]);

  const args = () => (esSuper && cuenta.trim() ? { correo: cuenta.trim() } : {});

  async function cargar() {
    if (!functions) return;
    setCargando(true); setMensaje(null);
    try {
      const r = await httpsCallable<unknown, Resp>(functions, 'classroomCursos')(args());
      if (!r.data.ok) {
        setMensaje({ tipo: 'error', texto: r.data.motivo === 'sin-autorizacion' ? MSG_SIN_AUTORIZACION : `No se pudieron leer los cursos: ${r.data.detalle ?? r.data.motivo ?? 'error'}` });
        return;
      }
      const lista = r.data.cursos ?? [];
      setCursos(lista);
      // Vínculos existentes del documento de la cuenta consultada.
      const correo = (esSuper && cuenta.trim() ? cuenta.trim() : auth?.currentUser?.email ?? '').toLowerCase();
      let v: Record<string, Vinculo> = {};
      if (db && correo) {
        try { v = ((await getDoc(doc(db, 'classroomVinculos', correo))).data()?.vinculos ?? {}) as Record<string, Vinculo>; } catch { /* sin lectura: se asume sin vínculos */ }
      }
      setVinculos(v);
      const el: Record<string, string> = {};
      for (const p of pares) {
        const k = claveVinculo(p.grupo, p.asignatura);
        el[k] = v[k]?.courseId ?? sugerirCurso(p.grupo, p.asignatura, lista, anio) ?? '';
      }
      setElegidos(el);
      setRelevantes(new Set(Object.keys(el).filter(k => el[k])));
      setCargado(true);
    } catch (e) {
      setMensaje({ tipo: 'error', texto: `La función no respondió: ${(e as Error).message}` });
    } finally { setCargando(false); }
  }

  // El docente normal carga al abrir; el superusuario primero escribe la cuenta.
  useEffect(() => { if (!esSuper) void cargar(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  async function accion(p: Par, courseId: string | null) {
    if (!functions) return;
    const k = claveVinculo(p.grupo, p.asignatura);
    setTrabajando(k); setMensaje(null);
    try {
      const r = await httpsCallable<unknown, Resp>(functions, 'classroomVincular')({ grupo: p.grupo, asignatura: p.asignatura, courseId, ...args() });
      if (!r.data.ok) {
        setMensaje({ tipo: 'error', texto: r.data.motivo === 'sin-autorizacion' ? MSG_SIN_AUTORIZACION : `No se pudo completar: ${r.data.detalle ?? r.data.motivo ?? 'error'}` });
        return;
      }
      if (courseId === null) {
        setVinculos(v => { const c = { ...v }; delete c[k]; return c; });
        setMensaje({ tipo: 'ok', texto: `Desvinculado: ${p.grupo} · ${p.asignatura}.` });
      } else {
        const curso = cursos?.find(c => c.id === courseId);
        const sinAvisos = r.data.avisos === false || !!r.data.registro?.error;
        setVinculos(v => ({ ...v, [k]: { courseId, nombre: curso?.nombre } }));
        setMensaje(sinAvisos
          ? { tipo: 'aviso', texto: 'Vinculado, pero los avisos de Classroom aún no están activos.' }
          : { tipo: 'ok', texto: `Vinculado: ${p.grupo} · ${p.asignatura}.` });
      }
    } catch (e) {
      setMensaje({ tipo: 'error', texto: (e as Error).message });
    } finally { setTrabajando(null); }
  }

  const viejos = (cursos ?? []).filter(c => c.anio != null && c.anio < anio);
  const vigentes = (cursos ?? []).filter(c => !(c.anio != null && c.anio < anio));
  const etiqueta = (c: Curso) => `${c.nombre}${c.seccion ? ` · ${c.seccion}` : ''}`;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onCerrar}>
      <div className="w-full sm:max-w-2xl max-h-[92vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl bg-card border border-line p-4 space-y-3" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-2">
          <GraduationCap size={18} className="text-soft" />
          <h2 className="font-bold text-strong">Vincular Classroom</h2>
          <button onClick={onCerrar} aria-label="Cerrar" className="ml-auto p-1.5 rounded-lg text-soft hover:bg-elevated"><X size={16} /></button>
        </div>
        <p className="text-xs text-muted leading-snug">Elige el curso de Classroom de cada grupo y asignatura. Al vincular se activan los avisos de ese curso.</p>

        {esSuper && (
          <div className="flex flex-wrap gap-2">
            <input type="email" value={cuenta} onChange={e => { setCuenta(e.target.value); setCargado(false); }}
              placeholder="Cuenta de profesor (vacío = la tuya)"
              className="flex-1 min-w-[200px] min-h-[40px] px-3 rounded-lg border border-line bg-app text-sm text-strong" />
            <button onClick={cargar} disabled={cargando}
              className="px-3 min-h-[40px] rounded-lg bg-accent text-accent-fg text-xs font-medium disabled:opacity-50">
              {cargando ? 'Cargando…' : 'Cargar cursos'}
            </button>
          </div>
        )}

        {cargando && !cargado && <p className="text-xs text-muted flex items-center gap-2"><Loader2 size={14} className="animate-spin" /> Leyendo tus cursos…</p>}
        {mensaje && (
          <p className={'text-xs rounded-lg px-3 py-2 ' + (mensaje.tipo === 'ok' ? 'bg-info-soft text-info-soft-fg' : mensaje.tipo === 'aviso' ? 'bg-elevated text-strong border border-line' : 'text-danger')}>
            {mensaje.texto}
          </p>
        )}
        {cargado && cursos?.length === 0 && <p className="text-xs text-muted">No tienes cursos activos en Classroom.</p>}
        {!esSuper && pares.length === 0 && <p className="text-xs text-muted">No tienes asignación académica registrada.</p>}

        {cargado && (cursos?.length ?? 0) > 0 && (
          <ul className="space-y-2">
            {esSuper && (
              <li>
                <button type="button" onClick={() => setVerTodos(t => !t)} className="text-xs text-accent underline">
                  {verTodos ? 'Ver solo los grupos con curso sugerido o vinculado' : `Ver todos los grupos y asignaturas (${pares.length})`}
                </button>
              </li>
            )}
            {pares.filter(p => !esSuper || verTodos || relevantes.has(claveVinculo(p.grupo, p.asignatura))).map(p => {
              const k = claveVinculo(p.grupo, p.asignatura);
              const v = vinculos[k];
              const ocupado = trabajando === k;
              return (
                <li key={k} className="rounded-xl border border-line bg-elevated/40 p-3 space-y-2">
                  <div className="text-sm font-semibold text-strong">{p.grupo} · <span className="font-normal text-soft">{p.asignatura}</span></div>
                  {v ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs text-strong flex-1 min-w-[160px]">Vinculado: {v.nombre ?? cursos?.find(c => c.id === v.courseId)?.nombre ?? v.courseId}
                        <span className="block text-muted">
                          {v.registro?.registrationId
                            ? `Avisos activos${v.registro.expiryTime ? ` hasta ${new Date(v.registro.expiryTime).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' })}` : ''}`
                            : v.registro?.error ? `Avisos sin activar: ${v.registro.error}` : 'Avisos: sin registro'}
                        </span>
                      </span>
                      <button onClick={() => accion(p, null)} disabled={ocupado}
                        className="px-3 min-h-[36px] rounded-lg border border-line text-xs text-soft hover:bg-elevated disabled:opacity-50">
                        {ocupado ? '…' : 'Desvincular'}
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-center gap-2">
                      <select value={elegidos[k] ?? ''} onChange={e => setElegidos(s => ({ ...s, [k]: e.target.value }))}
                        className="flex-1 min-w-[180px] min-h-[40px] px-2 rounded-lg border border-line bg-app text-sm text-strong">
                        <option value="">— Sin curso —</option>
                        {vigentes.map(c => <option key={c.id} value={c.id}>{etiqueta(c)}</option>)}
                        {viejos.length > 0 && (
                          <optgroup label="Años anteriores">
                            {viejos.map(c => <option key={c.id} value={c.id}>{etiqueta(c)}</option>)}
                          </optgroup>
                        )}
                      </select>
                      <button onClick={() => accion(p, elegidos[k])} disabled={ocupado || !elegidos[k]}
                        className="px-3 min-h-[40px] rounded-lg bg-accent text-accent-fg text-xs font-medium disabled:opacity-50">
                        {ocupado ? 'Vinculando…' : 'Vincular'}
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
