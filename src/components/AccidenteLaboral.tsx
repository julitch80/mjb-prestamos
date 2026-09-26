// Accidente laboral (Etapa 1 — docs/accidente-laboral/PRD.md, aprobado
// 26-sep-2026). Ruta inmediata + registro + borrador FURAT + seguimiento +
// ficha de contactos + COPASST. Firestore directo (patrón de src/data/chat.ts):
// identidad = auth.currentUser.email, no-op seguro si auth/db son null.
import { useEffect, useState } from 'react';
import {
  addDoc, collection, doc, getDoc, onSnapshot, orderBy, query,
  serverTimestamp, setDoc, updateDoc, where,
} from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { useAppStore } from '../data/store';
import { listarUsuarios, type UsuarioFirestore } from '../data/adminUsers';
import {
  borradorFurat, estadoCuentaRegresivaFurat, horaLimiteFurat, horasRestantesFurat,
  type EstadoCuentaRegresiva, type TipoPersonaAccidente,
} from '../data/sst/accidenteLaboral';

function miEmail(): string {
  return auth?.currentUser?.email?.toLowerCase() ?? '';
}
// ── Contactos (defaults del PRD; SOLO se usan si sstConfig/contactos no existe) ─

interface ContactoItem { titulo: string; detalle: string; enlace?: string; telefono?: string; whatsapp?: string }
interface FichaContactos { items: ContactoItem[]; verificadoEn: string; verificadoPor: string }

const CONTACTOS_DEFAULT: FichaContactos = {
  verificadoEn: 'sin verificar',
  verificadoPor: '',
  items: [
    {
      titulo: 'Radicar FURAT — Módulo SST/FURAT de SUIM-HORUS',
      detalle: 'Ingresa la rectora, un coordinador o el encargado autorizado. Busca por cédula, diligencia modo/tiempo/lugar y genera el comprobante con fecha y hora.',
      enlace: 'https://www.fomag.gov.co/horus/',
    },
    {
      titulo: 'Soporte técnico SUIM HORUS',
      detalle: 'Solo WhatsApp, si no puedes ingresar o el usuario no está habilitado por la Secretaría.',
      whatsapp: '3162474797',
    },
    {
      titulo: 'IPS Alma Mater — atención en salud a docentes (Medellín)',
      detalle: 'Calle 69 n.º 51 C 24 (Sevilla) y Carrera 51 A 62-42 (Prado). Citas.',
      telefono: '6043223633',
    },
    {
      titulo: 'Líneas FOMAG',
      detalle: 'Atención nacional.',
      telefono: '018000160500',
    },
    {
      titulo: 'Emergencias',
      detalle: 'Atención médica inmediata.',
      telefono: '123',
    },
  ],
};

function useContactos(): FichaContactos {
  const [contactos, setContactos] = useState<FichaContactos>(CONTACTOS_DEFAULT);
  useEffect(() => {
    if (!db) return;
    getDoc(doc(db, 'sstConfig/contactos')).then(snap => {
      if (snap.exists()) setContactos(snap.data() as FichaContactos);
    }).catch(() => {});
  }, []);
  return contactos;
}

function formatearTelDisplay(tel?: string): string {
  return tel ?? '';
}

function TarjetaContacto({ c }: { c: ContactoItem }) {
  return (
    <div className="rounded-xl border border-line bg-card px-4 py-3 flex flex-col gap-1.5">
      <span className="text-sm font-semibold text-strong">{c.titulo}</span>
      <p className="text-xs text-muted leading-relaxed">{c.detalle}</p>
      <div className="flex items-center gap-3 flex-wrap mt-1">
        {c.enlace && (
          <a href={c.enlace} target="_blank" rel="noreferrer" className="text-xs font-semibold text-accent underline underline-offset-2">
            Abrir enlace →
          </a>
        )}
        {c.telefono && (
          <a href={`tel:${c.telefono}`} className="text-xs font-semibold text-accent underline underline-offset-2">
            📞 {formatearTelDisplay(c.telefono)}
          </a>
        )}
        {c.whatsapp && (
          <a href={`https://wa.me/57${c.whatsapp}`} target="_blank" rel="noreferrer" className="text-xs font-semibold text-accent underline underline-offset-2">
            💬 WhatsApp {formatearTelDisplay(c.whatsapp)}
          </a>
        )}
      </div>
    </div>
  );
}

function FichaContactosView({ contactos }: { contactos: FichaContactos }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-[11px] text-muted">
        {contactos.verificadoEn === 'sin verificar'
          ? 'Contactos sin verificar por rectoría/coordinación.'
          : `Verificado el ${contactos.verificadoEn}${contactos.verificadoPor ? ` por ${contactos.verificadoPor}` : ''}.`}
      </p>
      {contactos.items.map((c, i) => <TarjetaContacto key={i} c={c} />)}
    </div>
  );
}

// ── Paso 1-2: ruta inmediata ─────────────────────────────────────────────────

const RUTA_LABEL: Record<TipoPersonaAccidente, string> = {
  docente: 'Docente o directivo docente',
  administrativo: 'Administrativo',
  contratista: 'Contratista (restaurante, tienda…)',
};

function RutaInmediata({ tipo, onRegistrar, contactos }: {
  tipo: TipoPersonaAccidente; onRegistrar: () => void; contactos: FichaContactos;
}) {
  if (tipo === 'docente') {
    return (
      <div className="flex flex-col gap-3">
        <div className="rounded-xl border border-danger bg-danger-soft px-4 py-3">
          <p className="text-xs text-danger-soft-fg leading-relaxed">
            <strong>Plazo del FURAT: 48 horas.</strong> Lo radica la rectora (o un coordinador/encargado
            autorizado) por HORUS. Guarda evidencia: fotos del sitio, testigos y la hora exacta.
          </p>
        </div>
        <FichaContactosView contactos={contactos} />
        <button
          onClick={onRegistrar}
          className="px-5 py-3 rounded-xl text-sm font-semibold text-accent-fg bg-accent hover:brightness-110 transition"
        >
          Registrar el accidente →
        </button>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-xl border border-warning bg-warning-soft px-4 py-3">
        <p className="text-xs text-warning-soft-fg leading-relaxed">
          Este caso <strong>NO va por HORUS</strong>: lo reporta {tipo === 'administrativo' ? 'su empleador' : 'su empresa contratista'}
          {' '}ante su propia ARL. <strong>Avisa de inmediato a tu jefe o empresa.</strong> Guarda evidencia:
          fotos del sitio, testigos y la hora exacta.
        </p>
      </div>
      <button
        onClick={onRegistrar}
        className="px-5 py-3 rounded-xl text-sm font-semibold text-accent-fg bg-accent hover:brightness-110 transition"
      >
        Registrar para el COPASST →
      </button>
    </div>
  );
}

// ── Paso: selector de quién se accidentó ────────────────────────────────────

function SelectorTipoPersona({ onSeleccionar }: { onSeleccionar: (t: TipoPersonaAccidente) => void }) {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm font-semibold text-strong">Primero la persona</p>
      <p className="text-xs text-muted leading-relaxed">
        Atiende primeros auxilios si hace falta (ver la ficha de esta pestaña) y llama al <strong>123</strong> si es grave.
        Cuando la persona esté atendida, sigue aquí.
      </p>
      <p className="text-sm font-semibold text-strong mt-2">¿Quién se accidentó?</p>
      {(['docente', 'administrativo', 'contratista'] as const).map(t => (
        <button
          key={t}
          onClick={() => onSeleccionar(t)}
          className="w-full text-left rounded-xl border border-line bg-card px-4 py-3 hover:bg-elevated transition text-sm font-semibold text-strong"
        >
          {RUTA_LABEL[t]}
        </button>
      ))}
    </div>
  );
}

// ── Registro ─────────────────────────────────────────────────────────────────

interface FormAccidente {
  tipoPersona: TipoPersonaAccidente;
  nombrePersona: string;
  cargoOEmpresa: string;
  fecha: string; hora: string;
  lugar: string;
  queHacia: string;
  comoOcurrio: string;
  lesionAparente: string;
  partesCuerpo: string;
  testigos: string;
  atencionRecibida: boolean;
  atencionDonde: string;
}

function formularioVacio(tipo: TipoPersonaAccidente): FormAccidente {
  const ahora = new Date();
  return {
    tipoPersona: tipo, nombrePersona: '', cargoOEmpresa: '',
    fecha: ahora.toISOString().slice(0, 10),
    hora: ahora.toTimeString().slice(0, 5),
    lugar: '', queHacia: '', comoOcurrio: '', lesionAparente: '',
    partesCuerpo: '', testigos: '', atencionRecibida: false, atencionDonde: '',
  };
}

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] text-muted">{label}</span>
      {children}
    </label>
  );
}

const inputCls = 'w-full px-3 py-2 rounded-xl bg-elevated border border-line text-sm text-strong placeholder:text-muted focus:outline-none focus:border-line-strong';

function FormularioRegistro({ tipo, onGuardado, onCancelar }: {
  tipo: TipoPersonaAccidente; onGuardado: (id: string, f: FormAccidente) => void; onCancelar: () => void;
}) {
  const [f, setF] = useState<FormAccidente>(formularioVacio(tipo));
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  const set = <K extends keyof FormAccidente>(k: K, v: FormAccidente[K]) => setF(prev => ({ ...prev, [k]: v }));

  async function guardar() {
    if (!f.nombrePersona.trim() || !f.lugar.trim() || !f.queHacia.trim() || !f.comoOcurrio.trim() || !f.lesionAparente.trim()) {
      setError('Completa nombre, lugar, qué hacía, cómo ocurrió y la lesión aparente.');
      return;
    }
    if (!db || !auth?.currentUser) {
      setError('No hay sesión activa.');
      return;
    }
    setError('');
    setGuardando(true);
    try {
      const fechaHora = new Date(`${f.fecha}T${f.hora}:00`).toISOString();
      const ref = await addDoc(collection(db, 'sstAccidentes'), {
        tipoPersona: f.tipoPersona,
        nombrePersona: f.nombrePersona.trim(),
        cargoOEmpresa: f.cargoOEmpresa.trim() || null,
        fechaHora,
        lugar: f.lugar.trim(),
        queHacia: f.queHacia.trim(),
        comoOcurrio: f.comoOcurrio.trim(),
        lesionAparente: f.lesionAparente.trim(),
        partesCuerpo: f.partesCuerpo.trim() || null,
        testigos: f.testigos.trim() || null,
        atencion: { recibida: f.atencionRecibida, donde: f.atencionDonde.trim() || null },
        reportadoPor: miEmail(),
        reportadoEn: serverTimestamp(),
        estado: 'reportado',
      });
      onGuardado(ref.id, f);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-xl border border-line bg-elevated/40 px-3 py-2.5 text-xs text-muted">
        Aviso de privacidad: este reporte solo lo ven la rectora, coordinación y los representantes del COPASST.
        Tu jefe inmediato se entera si corresponde a tu ruta institucional.
      </div>
      <Campo label="Nombre completo de la persona accidentada">
        <input className={inputCls} value={f.nombrePersona} onChange={e => set('nombrePersona', e.target.value)} />
      </Campo>
      {tipo !== 'docente' && (
        <Campo label="Cargo / empresa contratista">
          <input className={inputCls} value={f.cargoOEmpresa} onChange={e => set('cargoOEmpresa', e.target.value)} />
        </Campo>
      )}
      <div className="grid grid-cols-2 gap-3">
        <Campo label="Fecha">
          <input type="date" className={inputCls} value={f.fecha} onChange={e => set('fecha', e.target.value)} />
        </Campo>
        <Campo label="Hora">
          <input type="time" className={inputCls} value={f.hora} onChange={e => set('hora', e.target.value)} />
        </Campo>
      </div>
      <Campo label="Lugar (sitio del colegio)">
        <input className={inputCls} placeholder="Ej.: Cancha del patio central" value={f.lugar} onChange={e => set('lugar', e.target.value)} />
      </Campo>
      <Campo label="¿Qué hacía?">
        <textarea className={inputCls} rows={2} value={f.queHacia} onChange={e => set('queHacia', e.target.value)} />
      </Campo>
      <Campo label="¿Cómo ocurrió?">
        <textarea className={inputCls} rows={2} value={f.comoOcurrio} onChange={e => set('comoOcurrio', e.target.value)} />
      </Campo>
      <Campo label="Lesión aparente">
        <input className={inputCls} value={f.lesionAparente} onChange={e => set('lesionAparente', e.target.value)} />
      </Campo>
      <Campo label="Partes del cuerpo afectadas (opcional)">
        <input className={inputCls} value={f.partesCuerpo} onChange={e => set('partesCuerpo', e.target.value)} />
      </Campo>
      <Campo label="Testigos (opcional)">
        <input className={inputCls} value={f.testigos} onChange={e => set('testigos', e.target.value)} />
      </Campo>
      <label className="flex items-center gap-2 text-sm text-strong">
        <input type="checkbox" checked={f.atencionRecibida} onChange={e => set('atencionRecibida', e.target.checked)} className="w-4 h-4" />
        ¿Fue atendido?
      </label>
      {f.atencionRecibida && (
        <Campo label="¿Dónde fue atendido?">
          <input className={inputCls} value={f.atencionDonde} onChange={e => set('atencionDonde', e.target.value)} />
        </Campo>
      )}
      {error && <p className="text-xs text-danger">{error}</p>}
      <div className="flex items-center gap-2">
        <button
          onClick={guardar}
          disabled={guardando}
          className="px-5 py-2.5 rounded-xl text-sm font-semibold text-accent-fg bg-accent hover:brightness-110 transition disabled:opacity-50"
        >
          {guardando ? 'Guardando…' : 'Guardar'}
        </button>
        <button onClick={onCancelar} className="px-4 py-2.5 rounded-xl text-sm font-medium text-muted hover:text-soft transition">
          Cancelar
        </button>
      </div>
    </div>
  );
}

// ── Confirmación + borrador FURAT ───────────────────────────────────────────

function Confirmacion({ tipo, f }: { tipo: TipoPersonaAccidente; f: FormAccidente }) {
  const [copiado, setCopiado] = useState(false);
  const fechaHora = new Date(`${f.fecha}T${f.hora}:00`).toISOString();
  const limite = tipo === 'docente' ? horaLimiteFurat(fechaHora) : null;
  const texto = borradorFurat({
    tipoPersona: tipo,
    nombrePersona: f.nombrePersona,
    fechaHora,
    lugar: f.lugar,
    queHacia: f.queHacia,
    comoOcurrio: f.comoOcurrio,
    lesionAparente: f.lesionAparente,
    partesCuerpo: f.partesCuerpo || undefined,
    testigos: f.testigos || undefined,
    atencionRecibida: f.atencionRecibida,
    atencionDonde: f.atencionDonde || undefined,
  });

  async function copiar() {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch { /* no-op */ }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-xl border border-success bg-success-soft px-4 py-3">
        <p className="text-sm font-semibold text-success-soft-fg">✅ Accidente registrado</p>
        {limite && (
          <p className="text-xs text-success-soft-fg mt-1">
            Hora límite del FURAT: <strong>{new Date(limite).toLocaleString('es-CO')}</strong>
          </p>
        )}
      </div>
      {tipo === 'docente' && (
        <div className="rounded-xl border border-line bg-card px-4 py-3 flex flex-col gap-2">
          <p className="text-sm font-semibold text-strong">Borrador del FURAT</p>
          <pre className="text-xs text-soft whitespace-pre-wrap font-sans">{texto}</pre>
          <div className="flex items-center gap-2">
            <button onClick={copiar} className="px-3 py-2 rounded-lg bg-elevated text-soft hover:text-strong text-xs font-semibold">
              {copiado ? '✓ Copiado' : 'Copiar'}
            </button>
            <a href="https://www.fomag.gov.co/horus/" target="_blank" rel="noreferrer" className="px-3 py-2 rounded-lg bg-accent text-accent-fg text-xs font-semibold">
              Ir a HORUS →
            </a>
          </div>
          <p className="text-[11px] text-muted">La cédula se digita directamente en HORUS: no se guarda en la aplicación.</p>
        </div>
      )}
    </div>
  );
}

// ── Seguimiento (responsables) ──────────────────────────────────────────────

interface CasoAccidente {
  id: string;
  tipoPersona: TipoPersonaAccidente;
  nombrePersona: string;
  fechaHora: string;
  lugar: string;
  lesionAparente: string;
  estado: string;
  furat?: { fechaHoraComprobante: string; numero?: string };
  investigacion?: { causas: string; acciones: { accion: string; responsable: string; fechaLimite?: string; hecha: boolean }[] };
  reportadoPor: string;
}

const COLOR_CUENTA: Record<EstadoCuentaRegresiva, string> = {
  normal: 'text-muted', ambar: 'text-warning', rojo: 'text-danger', vencido: 'text-danger font-bold',
};

function EtiquetaCuentaRegresiva({ fechaHora }: { fechaHora: string }) {
  const ahora = new Date().toISOString();
  const estado = estadoCuentaRegresivaFurat(fechaHora, ahora);
  const restantes = horasRestantesFurat(fechaHora, ahora);
  const texto = estado === 'vencido' ? 'FURAT vencido' : `Quedan ${Math.max(0, Math.round(restantes))} h para el FURAT`;
  return <span className={`text-xs ${COLOR_CUENTA[estado]}`}>{texto}</span>;
}

function TarjetaCaso({ caso, onCambiar }: { caso: CasoAccidente; onCambiar: () => void }) {
  const [numero, setNumero] = useState('');
  const [fechaComprobante, setFechaComprobante] = useState(new Date().toISOString().slice(0, 16));
  const [causas, setCausas] = useState('');

  async function radicar() {
    if (!db || !fechaComprobante) return;
    await updateDoc(doc(db, 'sstAccidentes', caso.id), {
      estado: 'furat_radicado',
      furat: { fechaHoraComprobante: new Date(fechaComprobante).toISOString(), numero: numero || null, radicadoPor: miEmail() },
    });
    await addDoc(collection(db, 'sstAccidentes', caso.id, 'eventos'), {
      por: miEmail(), cuando: serverTimestamp(), que: 'FURAT radicado',
    });
    onCambiar();
  }

  async function iniciarInvestigacion() {
    if (!db) return;
    await updateDoc(doc(db, 'sstAccidentes', caso.id), {
      estado: 'en_investigacion',
      investigacion: { causas, acciones: [] },
    });
    await addDoc(collection(db, 'sstAccidentes', caso.id, 'eventos'), {
      por: miEmail(), cuando: serverTimestamp(), que: 'Investigación iniciada',
    });
    onCambiar();
  }

  async function cerrar() {
    if (!db) return;
    await updateDoc(doc(db, 'sstAccidentes', caso.id), { estado: 'cerrado' });
    await addDoc(collection(db, 'sstAccidentes', caso.id, 'eventos'), {
      por: miEmail(), cuando: serverTimestamp(), que: 'Caso cerrado',
    });
    onCambiar();
  }

  return (
    <div className="rounded-xl border border-line bg-card px-4 py-3 flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-semibold text-strong">{caso.nombrePersona} · {RUTA_LABEL[caso.tipoPersona]}</span>
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-elevated border border-line text-muted">{caso.estado}</span>
      </div>
      <p className="text-xs text-muted">{caso.lugar} · {new Date(caso.fechaHora).toLocaleString('es-CO')}</p>
      {caso.tipoPersona === 'docente' && caso.estado === 'reportado' && <EtiquetaCuentaRegresiva fechaHora={caso.fechaHora} />}

      {caso.tipoPersona === 'docente' && caso.estado === 'reportado' && (
        <div className="flex flex-col gap-2 mt-1 border-t border-line pt-2">
          <p className="text-xs font-semibold text-strong">Registrar radicación del FURAT</p>
          <input type="datetime-local" className={inputCls} value={fechaComprobante} onChange={e => setFechaComprobante(e.target.value)} />
          <input className={inputCls} placeholder="Número (opcional)" value={numero} onChange={e => setNumero(e.target.value)} />
          <button onClick={radicar} className="self-start px-3 py-2 rounded-lg bg-accent text-accent-fg text-xs font-semibold">
            Registrar radicación
          </button>
        </div>
      )}

      {(caso.estado === 'furat_radicado' || (caso.estado === 'reportado' && caso.tipoPersona !== 'docente')) && (
        <div className="flex flex-col gap-2 mt-1 border-t border-line pt-2">
          <p className="text-xs font-semibold text-strong">Iniciar investigación</p>
          <textarea className={inputCls} rows={2} placeholder="Causas" value={causas} onChange={e => setCausas(e.target.value)} />
          <button onClick={iniciarInvestigacion} className="self-start px-3 py-2 rounded-lg bg-elevated text-soft hover:text-strong text-xs font-semibold">
            Iniciar investigación
          </button>
        </div>
      )}

      {caso.estado === 'en_investigacion' && (
        <button onClick={cerrar} className="self-start px-3 py-2 rounded-lg bg-elevated text-soft hover:text-strong text-xs font-semibold mt-1">
          Cerrar caso
        </button>
      )}
    </div>
  );
}

function Seguimiento() {
  const [casos, setCasos] = useState<CasoAccidente[]>([]);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (!db) return;
    const unsub = onSnapshot(query(collection(db, 'sstAccidentes'), orderBy('fechaHora', 'desc')), snap => {
      setCasos(snap.docs.map(d => ({ id: d.id, ...d.data() } as CasoAccidente)));
    });
    return unsub;
  }, [version]);

  if (casos.length === 0) return <p className="text-sm text-muted text-center py-6">No hay casos registrados.</p>;

  return (
    <div className="flex flex-col gap-3">
      {casos.map(c => <TarjetaCaso key={c.id} caso={c} onCambiar={() => setVersion(v => v + 1)} />)}
    </div>
  );
}

// ── Mis reportes (autor) ─────────────────────────────────────────────────────

function MisReportes() {
  const [casos, setCasos] = useState<CasoAccidente[]>([]);
  useEffect(() => {
    if (!db || !auth?.currentUser) return;
    const unsub = onSnapshot(query(collection(db, 'sstAccidentes'), where('reportadoPor', '==', miEmail())), snap => {
      setCasos(snap.docs.map(d => ({ id: d.id, ...d.data() } as CasoAccidente)));
    });
    return unsub;
  }, []);
  if (casos.length === 0) return <p className="text-sm text-muted text-center py-6">Todavía no has reportado ningún caso.</p>;
  return (
    <div className="flex flex-col gap-3">
      {casos.map(c => (
        <div key={c.id} className="rounded-xl border border-line bg-card px-4 py-3 flex items-center justify-between gap-2">
          <div>
            <p className="text-sm font-semibold text-strong">{new Date(c.fechaHora).toLocaleDateString('es-CO')}</p>
            <p className="text-xs text-muted">{c.lugar}</p>
          </div>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-elevated border border-line text-muted">{c.estado}</span>
        </div>
      ))}
    </div>
  );
}

// ── COPASST (rectora/superusuario) ──────────────────────────────────────────

function AdminCopasst() {
  // Se escoge a la gente de la lista de usuarios de la app (ya tiene sus correos):
  // nadie tiene que escribir un correo a mano (Julián, 26-sep-2026).
  const [correos, setCorreos] = useState<string[]>([]);
  const [usuarios, setUsuarios] = useState<UsuarioFirestore[]>([]);
  const [filtro, setFiltro] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!db) return;
    getDoc(doc(db, 'sstConfig/copasst')).then(snap => {
      if (snap.exists()) setCorreos((snap.data().correos as string[]) ?? []);
    }).catch(() => {});
    listarUsuarios()
      .then(lista => setUsuarios(lista.filter(u => u.active)))
      .catch(() => setError('No se pudo cargar la lista de usuarios.'));
  }, []);

  async function guardar(lista: string[]) {
    if (!db) return;
    try {
      await setDoc(doc(db, 'sstConfig/copasst'), { correos: lista });
      setCorreos(lista);
      setError('');
    } catch {
      setError('No se pudo guardar. Solo la rectora o el superusuario pueden cambiar el COPASST.');
    }
  }

  function alternar(email: string) {
    const c = email.toLowerCase();
    guardar(correos.includes(c) ? correos.filter(x => x !== c) : [...correos, c]);
  }

  const nombreDe = (email: string) => usuarios.find(u => u.email === email)?.displayName || email;
  const f = filtro.trim().toLowerCase();
  const visibles = usuarios.filter(u =>
    !correos.includes(u.email) && (!f || (u.displayName || '').toLowerCase().includes(f) || u.email.includes(f)));

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-muted leading-relaxed">
        Representantes docentes del COPASST. La rectora y los coordinadores ya reciben los avisos por su cargo:
        aquí solo se agregan los docentes del comité.
      </p>
      {correos.length === 0 ? (
        <p className="text-sm text-muted">Todavía no hay representantes escogidos.</p>
      ) : correos.map(c => (
        <div key={c} className="flex items-center justify-between gap-2 rounded-lg border border-line bg-card px-3 py-2">
          <span className="text-sm text-strong">{nombreDe(c)}</span>
          <button onClick={() => alternar(c)} className="text-xs text-danger font-semibold">Quitar</button>
        </div>
      ))}
      <input className={inputCls} placeholder="Buscar docente por nombre…" value={filtro} onChange={e => setFiltro(e.target.value)} />
      <div className="max-h-64 overflow-y-auto flex flex-col gap-1">
        {visibles.map(u => (
          <button key={u.email} onClick={() => alternar(u.email)}
            className="text-left rounded-lg border border-line px-3 py-2 text-sm text-soft hover:bg-elevated flex justify-between gap-2">
            <span>{u.displayName || u.email}</span>
            <span className="text-xs text-accent font-semibold">Agregar</span>
          </button>
        ))}
      </div>
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}

// ── Componente principal ─────────────────────────────────────────────────────

type Paso = 'inicio' | 'tipo' | 'registro' | 'confirmacion' | 'seguimiento' | 'mis_reportes' | 'contactos' | 'copasst';

export function AccidenteLaboral() {
  const rol = useAppStore(s => s.rol);
  const esResponsable = rol === 'rectora' || rol === 'coordinador' || rol === 'superusuario';
  const esRectoraOSuper = rol === 'rectora' || rol === 'superusuario';
  const contactos = useContactos();

  const [paso, setPaso] = useState<Paso>('inicio');
  const [tipo, setTipo] = useState<TipoPersonaAccidente>('docente');
  const [datosGuardados, setDatosGuardados] = useState<FormAccidente | null>(null);

  const Tab = ({ id, label }: { id: Paso; label: string }) => (
    <button
      onClick={() => setPaso(id)}
      className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
        paso === id ? 'bg-accent-soft border-accent text-accent' : 'border-line text-muted hover:bg-elevated'}`}
    >
      {label}
    </button>
  );

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm font-semibold text-strong">🦺 Accidente laboral</p>
      <div className="flex items-center gap-1.5 flex-wrap">
        <Tab id="inicio" label="Ruta inmediata" />
        <Tab id="mis_reportes" label="Mis reportes" />
        {esResponsable && <Tab id="seguimiento" label="Seguimiento" />}
        {esResponsable && <Tab id="contactos" label="Contactos" />}
        {esRectoraOSuper && <Tab id="copasst" label="COPASST" />}
      </div>

      {paso === 'inicio' && <SelectorTipoPersona onSeleccionar={t => { setTipo(t); setPaso('tipo'); }} />}

      {paso === 'tipo' && (
        <div className="flex flex-col gap-3">
          <RutaInmediata tipo={tipo} contactos={contactos} onRegistrar={() => setPaso('registro')} />
          <button onClick={() => setPaso('inicio')} className="self-start text-xs text-muted hover:text-soft">← Cambiar quién se accidentó</button>
        </div>
      )}

      {paso === 'registro' && (
        <FormularioRegistro
          tipo={tipo}
          onCancelar={() => setPaso('tipo')}
          onGuardado={(_id, f) => { setDatosGuardados(f); setPaso('confirmacion'); }}
        />
      )}

      {paso === 'confirmacion' && datosGuardados && <Confirmacion tipo={tipo} f={datosGuardados} />}

      {paso === 'seguimiento' && esResponsable && <Seguimiento />}
      {paso === 'mis_reportes' && <MisReportes />}
      {paso === 'contactos' && esResponsable && <FichaContactosView contactos={contactos} />}
      {paso === 'copasst' && esRectoraOSuper && <AdminCopasst />}
    </div>
  );
}
