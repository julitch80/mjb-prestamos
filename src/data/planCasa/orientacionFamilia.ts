// Orientación a las familias en la agenda pública del Plan Académico Especial
// (docs/plan-casa/orientacion-familias.md): horario de estudio, pildoritas y registro diario.
//
// TODO SE GUARDA SOLO EN ESTE DISPOSITIVO (localStorage, clave por token), igual que los
// hábitos del módulo de Tareas: la agenda es pública y sin sesión. Si cambian de celular
// o borran los datos del navegador, se pierde y se vuelve a elegir. Sin servidor a propósito.
import type { FechaISO } from './tipos';

// ── Horario de estudio ───────────────────────────────────────────────────────

export interface HorarioEstudio {
  /** Hora habitual «HH:MM» (24 h) para todos los días con trabajo. */
  habitual?: string;
  /** Ajustes puntuales por día; `null` = ese día sin hora fija. */
  porDia: Record<FechaISO, string | null>;
}

/** ¿Es una hora «HH:MM» válida (00:00 a 23:59)? */
export const horaValida = (h: unknown): h is string => typeof h === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(h);

/** La hora de estudio de un día: el ajuste puntual manda sobre la habitual. null = sin hora. */
export function horaDeDia(h: HorarioEstudio, fecha: FechaISO): string | null {
  if (Object.prototype.hasOwnProperty.call(h.porDia, fecha)) {
    const p = h.porDia[fecha];
    return horaValida(p) ? p : null;
  }
  return horaValida(h.habitual) ? h.habitual : null;
}

/** «15:00» → «3:00 p. m.»; «00:30» → «12:30 a. m.». */
export function formatearHora(h: string): string {
  if (!horaValida(h)) return '';
  const [hh, mm] = h.split(':').map(Number);
  const sufijo = hh >= 12 ? 'p. m.' : 'a. m.';
  const h12 = hh % 12 === 0 ? 12 : hh % 12;
  return `${h12}:${String(mm).padStart(2, '0')} ${sufijo}`;
}

/** Hora y fin aproximado: «3:00 p. m. – 3:50 p. m.» (los momentos van seguidos, 25 min c/u). */
export function rangoEstudio(h: string, momentos: number): string {
  if (!horaValida(h) || momentos <= 0) return formatearHora(h);
  const [hh, mm] = h.split(':').map(Number);
  const fin = (hh * 60 + mm + momentos * 25) % 1440;
  const f = `${String(Math.floor(fin / 60)).padStart(2, '0')}:${String(fin % 60).padStart(2, '0')}`;
  return `${formatearHora(h)} – ${formatearHora(f)}`;
}

/** Cambia la hora habitual. Los ajustes puntuales se conservan. */
export function conHabitual(h: HorarioEstudio, hora: string | null): HorarioEstudio {
  const { habitual: _x, ...resto } = h;
  return horaValida(hora) ? { ...resto, habitual: hora } : { ...resto };
}

/**
 * Ajusta un día. `hora` = hora propia; `null` = ese día sin hora; `undefined` = volver a la habitual.
 * Si el ajuste coincide con la habitual no se guarda (queda más limpio).
 */
export function conDia(h: HorarioEstudio, fecha: FechaISO, hora: string | null | undefined): HorarioEstudio {
  const porDia = { ...h.porDia };
  if (hora === undefined || (horaValida(hora) && hora === h.habitual)) delete porDia[fecha];
  else porDia[fecha] = horaValida(hora) ? hora : null;
  return { ...h, porDia };
}

/** Quita ajustes de días anteriores a `hoy` para que no crezca sin límite. */
export function podarHorario(h: HorarioEstudio, hoy: FechaISO): HorarioEstudio {
  const porDia: Record<FechaISO, string | null> = {};
  for (const [f, v] of Object.entries(h.porDia)) if (f >= hoy) porDia[f] = v;
  return { ...h, porDia };
}

const claveHorario = (clave: string) => `mjb:planCasa:horario:${clave || 'demo'}`;

/** Lee el horario guardado; ante cualquier fallo o dato raro devuelve uno vacío. */
export function leerHorario(clave: string): HorarioEstudio {
  try {
    const raw = localStorage.getItem(claveHorario(clave));
    if (!raw) return { porDia: {} };
    const o = JSON.parse(raw);
    const porDia: Record<FechaISO, string | null> = {};
    if (o && typeof o.porDia === 'object' && o.porDia) {
      for (const [f, v] of Object.entries(o.porDia)) {
        if (/^\d{4}-\d{2}-\d{2}$/.test(f) && (v === null || horaValida(v))) porDia[f] = v as string | null;
      }
    }
    return horaValida(o?.habitual) ? { habitual: o.habitual, porDia } : { porDia };
  } catch {
    return { porDia: {} };
  }
}

export function guardarHorario(clave: string, h: HorarioEstudio): void {
  try { localStorage.setItem(claveHorario(clave), JSON.stringify(h)); } catch { /* sin almacenamiento: no persiste */ }
}

// ── Pildoritas para la familia ───────────────────────────────────────────────

export type GrupoSugerencia = 'ambiente' | 'concentracion' | 'cuerpo' | 'acompanamiento' | 'tecnologia' | 'bienestar' | 'atrasos';

export interface Sugerencia { id: string; grupo: GrupoSugerencia; titulo: string; texto: string }

export const GRUPOS_SUGERENCIA: { id: GrupoSugerencia; titulo: string; icono: string }[] = [
  { id: 'ambiente', titulo: 'El lugar de estudio', icono: '🪑' },
  { id: 'concentracion', titulo: 'Concentración', icono: '🎯' },
  { id: 'cuerpo', titulo: 'Cuerpo y respiración', icono: '🌬️' },
  { id: 'acompanamiento', titulo: 'Cómo acompañar', icono: '🤝' },
  { id: 'tecnologia', titulo: 'Tecnología y fotos de la entrega', icono: '📱' },
  { id: 'bienestar', titulo: 'Bienestar', icono: '🌱' },
  { id: 'atrasos', titulo: 'Si se atrasan o se frustran', icono: '💬' },
];

export const SUGERENCIAS: Sugerencia[] = [
  { id: 'a1', grupo: 'ambiente', titulo: 'Un lugar fijo', texto: 'Escojan un rincón siempre igual, con buena luz y una superficie para escribir. Con los días, sentarse ahí avisa que es hora de estudiar.' },
  { id: 'a2', grupo: 'ambiente', titulo: 'Menos ruido', texto: 'Apaguen el televisor y la música con letra durante el momento de estudio. Si la casa es ruidosa, busquen la hora más tranquila.' },
  { id: 'a3', grupo: 'ambiente', titulo: 'Todo a la mano', texto: 'Antes de empezar, pongan sobre la mesa cuaderno, lápiz, la guía y agua. Levantarse a buscar cosas rompe la concentración.' },
  { id: 'c1', grupo: 'concentracion', titulo: 'Momentos de 25 minutos', texto: 'Un momento son 25 minutos de trabajo y luego 5 de pausa. Si hoy hay dos momentos, hagan la pausa entre uno y otro.' },
  { id: 'c2', grupo: 'concentracion', titulo: 'Una sola tarea a la vez', texto: 'Elijan un paso de la agenda y dejen los demás para después. Cambiar de tarea cada rato cansa y rinde menos.' },
  { id: 'c3', grupo: 'concentracion', titulo: 'El celular, en otro cuarto', texto: 'Tenerlo a la vista distrae aunque no suene. Déjenlo en otra habitación durante el momento de estudio.' },
  { id: 'c4', grupo: 'concentracion', titulo: 'Antes de empezar', texto: 'Tres cosas: mirar juntos qué toca hoy, preparar los materiales y decidir cómo sabrán que terminaron. Toma dos minutos.' },
  { id: 'c5', grupo: 'concentracion', titulo: 'Practicar con preguntas', texto: 'Al terminar, cierren el cuaderno y pídanle que cuente con sus palabras lo que hizo. Recordar sin mirar enseña más que releer.' },
  { id: 'r1', grupo: 'cuerpo', titulo: 'Cuerpo en marcha', texto: 'Antes de abrir el cuaderno, muévanse 5 a 10 minutos: marchar, subir escaleras, saltar suave. Con el corazón un poco acelerado, la mente suele quedar más lista para atender.' },
  { id: 'r2', grupo: 'cuerpo', titulo: 'Pausa: párate y muévete', texto: 'En los 5 minutos de pausa, párate, estírate, camina por la casa y toma agua. Moverse un rato ayuda a volver a la tarea con más atención.' },
  { id: 'r3', grupo: 'cuerpo', titulo: 'Respira largo', texto: 'Inhala por la nariz contando 4 y suelta el aire despacio contando 6, unas 10 veces. Soltar el aire más lento ayuda al cuerpo a calmarse. Usa el botón «Respiración guiada».' },
  { id: 'r4', grupo: 'cuerpo', titulo: 'Suspiro para soltar tensión', texto: 'Toma aire por la nariz, suma un segundo sorbito y suéltalo despacio por la boca, como un suspiro largo. Cinco a diez suspiros ayudan cuando aparece la rabia o el desánimo.' },
  { id: 'r5', grupo: 'cuerpo', titulo: 'Un minuto de silencio atento', texto: 'Mira un punto fijo o cierra los ojos y sigue tu respiración uno a tres minutos. Si la mente se va, tráela de vuelta con amabilidad.' },
  { id: 'r6', grupo: 'cuerpo', titulo: 'Sacudir y volver', texto: 'Si ya no puedes más, párate dos minutos: sacude brazos y piernas, camina en el sitio y estira el cuello. Luego intenta solo la siguiente parte pequeña.' },
  { id: 'r7', grupo: 'cuerpo', titulo: '¿Movimiento o respiración?', texto: 'Si está inquieto, primero movimiento. Si está nervioso o enojado, primero respiración. Prueben y vean qué le funciona mejor. Respiren suave: si hay mareo, paren y respiren normal.' },
  { id: 'p1', grupo: 'acompanamiento', titulo: 'Preguntar sin hacer la tarea', texto: 'Cambie «¿ya hiciste la tarea?» por «¿cómo vas a empezar?» o «¿qué parte te cuesta?». Si se traba, ayude a pensar, no a resolver.' },
  { id: 'p2', grupo: 'acompanamiento', titulo: 'Elogiar el esfuerzo', texto: 'Destaque lo que hizo: «me gustó que lo intentaste otra vez» vale más que «qué inteligente eres». El esfuerzo se puede repetir mañana.' },
  { id: 'p3', grupo: 'acompanamiento', titulo: 'Revisar la agenda juntos', texto: 'Al comenzar el día miren qué toca y a qué hora lo harán. Al terminar, miren qué se logró. Bastan cinco minutos.' },
  { id: 'p4', grupo: 'acompanamiento', titulo: 'Estar cerca, sin vigilar', texto: 'Con estudiantes más pequeños sirve que usted esté en la misma mesa haciendo algo propio. Con adolescentes, que esté disponible si lo llaman.' },
  { id: 't1', grupo: 'tecnologia', titulo: 'Modo «No molestar»', texto: 'Activen «No molestar» en el celular durante el momento de estudio. Los mensajes pueden esperar 25 minutos.' },
  { id: 't2', grupo: 'tecnologia', titulo: 'Pantallas con acuerdo', texto: 'Acuerden en familia cuándo hay pantalla recreativa; por ejemplo, después del momento de estudio. Un acuerdo claro evita discusiones diarias.' },
  { id: 't3', grupo: 'tecnologia', titulo: 'Buenas fotos de la entrega', texto: 'Con buena luz, la hoja plana sobre la mesa, el celular de frente y sin sombras. Revisen que se lea todo antes de enviar.' },
  { id: 't4', grupo: 'tecnologia', titulo: 'Una foto por hoja', texto: 'Si el trabajo tiene varias hojas, tomen una foto por página y en orden. Así es más fácil leerlo y revisarlo.' },
  { id: 'b1', grupo: 'bienestar', titulo: 'Pausas de verdad', texto: 'En los 5 minutos de pausa: pararse, tomar agua y mirar lejos. Las redes sociales no descansan la mente.' },
  { id: 'b2', grupo: 'bienestar', titulo: 'Dormir bien también es estudiar', texto: 'Dormir ordena lo aprendido. Si es posible, guarden los celulares fuera del cuarto desde una hora antes de dormir.' },
  { id: 'b3', grupo: 'bienestar', titulo: 'Moverse cada día', texto: 'Caminar, bailar o jugar un rato ayuda a concentrarse después. Procuren una hora de movimiento al día.' },
  { id: 'b4', grupo: 'bienestar', titulo: 'Comer a su hora', texto: 'Mejor no estudiar con hambre. Una fruta o un vaso de agua antes de empezar ayuda a mantener la energía.' },
  { id: 'f1', grupo: 'atrasos', titulo: 'Un atraso se arregla', texto: 'Si se atrasaron, no regañe ni se castigue. Elijan un solo paso para hoy y empiecen por ahí; mañana verán el siguiente.' },
  { id: 'f2', grupo: 'atrasos', titulo: 'Si se frustra', texto: 'Pare, respire y tome agua. Luego pregunte: «¿qué parte es la que no entiendes?». Con frecuencia basta dividir el paso en uno más pequeño.' },
  { id: 'f3', grupo: 'atrasos', titulo: 'A quién escribir', texto: 'Si algo no se entiende o no se alcanza, escriba al docente de esa asignatura o a la coordinación. Avisar a tiempo siempre ayuda más que callar.' },
  { id: 'f4', grupo: 'atrasos', titulo: 'Un mal día no cuenta', texto: 'Hay días en que no se puede. Anótenlo, descansen y retomen al día siguiente. Lo importante es volver.' },
];

/** Número de días desde 1970 para una fecha ISO (independiente de la zona horaria). */
function ordinalDia(f: FechaISO): number {
  const [y, m, d] = f.split('-').map(Number);
  return Math.floor(Date.UTC(y, m - 1, d) / 86400000);
}

/**
 * La pildorita del día: rota una por día, igual todo el día. `semilla` (p. ej. el token)
 * desfasa el orden entre estudiantes sin que cambie dentro del día.
 */
export function pildoraDelDia(fecha: FechaISO, lista: Sugerencia[] = SUGERENCIAS, semilla = ''): Sugerencia {
  let h = 0;
  for (const c of semilla) h = (h * 31 + c.charCodeAt(0)) % 9973;
  const n = lista.length;
  return lista[(((ordinalDia(fecha) + h) % n) + n) % n];
}

// ── ¿Cómo me fue hoy? ────────────────────────────────────────────────────────

export type Carita = 'bien' | 'mas_o_menos' | 'dificil';
export const CARITAS: { id: Carita; emoji: string; texto: string }[] = [
  { id: 'bien', emoji: '😀', texto: 'Muy bien' },
  { id: 'mas_o_menos', emoji: '😐', texto: 'Más o menos' },
  { id: 'dificil', emoji: '😟', texto: 'Se me hizo difícil' },
];
const esCarita = (v: unknown): v is Carita => CARITAS.some(c => c.id === v);

const claveCaritas = (clave: string) => `mjb:planCasa:caritas:${clave || 'demo'}`;

export function leerCaritas(clave: string): Record<FechaISO, Carita> {
  try {
    const o = JSON.parse(localStorage.getItem(claveCaritas(clave)) ?? '{}');
    const r: Record<FechaISO, Carita> = {};
    if (o && typeof o === 'object') for (const [f, v] of Object.entries(o)) if (esCarita(v)) r[f] = v;
    return r;
  } catch {
    return {};
  }
}

export function guardarCarita(clave: string, fecha: FechaISO, carita: Carita | null): Record<FechaISO, Carita> {
  const r = leerCaritas(clave);
  if (carita) r[fecha] = carita; else delete r[fecha];
  try { localStorage.setItem(claveCaritas(clave), JSON.stringify(r)); } catch { /* no persiste */ }
  return r;
}

// ── Lista de chequeo: momentos hechos por paso ────────────────────────────────

/** pasoKey → cuántos momentos de ese paso ya tachó el estudiante. */
export type Hechos = Record<string, number>;
const claveHechos = (clave: string) => `mjb:planCasa:hechos:${clave || 'demo'}`;

export function leerHechos(clave: string): Hechos {
  try {
    const o = JSON.parse(localStorage.getItem(claveHechos(clave)) ?? '{}');
    const r: Hechos = {};
    if (o && typeof o === 'object') for (const [k, v] of Object.entries(o)) if (typeof v === 'number' && v > 0) r[k] = Math.floor(v);
    return r;
  } catch {
    return {};
  }
}

/** Marca (o desmarca) hasta `n` momentos hechos de un paso; 0 lo borra. */
export function guardarHechos(clave: string, pasoKey: string, n: number): Hechos {
  const r = leerHechos(clave);
  if (n > 0) r[pasoKey] = n; else delete r[pasoKey];
  try { localStorage.setItem(claveHechos(clave), JSON.stringify(r)); } catch { /* no persiste */ }
  return r;
}

/** Progreso del día: momentos hechos sobre momentos totales. */
export function progresoDia(pasos: { key: string; momentos: number }[], hechos: Hechos): { hechos: number; total: number } {
  let h = 0, t = 0;
  for (const p of pasos) { t += p.momentos; h += Math.min(p.momentos, hechos[p.key] ?? 0); }
  return { hechos: h, total: t };
}

// ── Temporizador de un momento ───────────────────────────────────────────────

export const SEGUNDOS_MOMENTO = 25 * 60;
export const SEGUNDOS_PAUSA = 5 * 60;

/** «mm:ss» para el temporizador; nunca negativo. */
export function formatoReloj(segundos: number): string {
  const s = Math.max(0, Math.ceil(segundos));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}
