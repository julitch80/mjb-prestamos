// Evaluación de los centros de interés: encuesta anónima abierta.
// Módulo PURO (sin Firebase ni React): constantes, validación y agregación.

export type Instrumento = 'A' | 'B';
export type CarasA = 'feliz' | 'neutral' | 'triste';
export type SiNoB = 'si' | 'no';

export const COL_EVAL = 'evaluacionCI';
export const COL_EVAL_CONFIG = 'evaluacionCIConfig';
export const DOC_ESTADO = 'estado';
export const DOC_LECTORES = 'lectores';
export const RUTA_PUBLICA = '#/evaluacion-ci';
export const MAX_COMENTARIO = 100;

export const GRADOS = ['preescolar', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11'] as const;
export type Grado = typeof GRADOS[number];
export const etiquetaGrado = (g: string) => (g === 'preescolar' ? 'Preescolar' : `${g}.°`);

export const SEDES_EVAL = [
  { id: 'principal', nombre: 'Sede principal' },
  { id: 'gustavo_rodas', nombre: 'Gustavo Rodas' },
  { id: 'alterna', nombre: 'Alterna' },
  { id: 'no_sabe', nombre: 'No sé' },
] as const;
export type SedeEval = typeof SEDES_EVAL[number]['id'];
export const etiquetaSede = (s: string | null) => SEDES_EVAL.find(x => x.id === s)?.nombre ?? 'Sin dato';

export const PREGUNTAS_A = [
  '¿Cómo te sentiste en el centro de interés?',
  '¿Te gustaron las actividades y los materiales que usamos? (juegos, pinturas, cuentos, disfraces)',
  '¿Entendiste fácil las explicaciones de tu profe?',
  '¿Te gustaría volver a estar en este taller?',
] as const;
export const PREGUNTA_COMENTARIO_A = '¿Qué fue lo que más te gustó?';

export const PREGUNTAS_B = [
  '¿Pudiste proponer ideas y crear proyectos prácticos?',
  '¿Las actividades te ayudaron a resolver problemas reales?',
  '¿Lo aprendido te sirve para tu vida fuera del colegio?',
  '¿Tuviste espacios para expresarte y gestionar tus emociones?',
  '¿Te sentiste respetado y escuchado por tu docente y compañeros?',
  '¿Sentiste que desarrollaste alguna habilidad personal (ej. empatía, liderazgo)?',
  '¿Trabajaste en equipo y resolviste desacuerdos dialogando?',
  '¿Tu proyecto aportó positivamente al bienestar de la comunidad?',
  '¿Asistir al centro de interés te motivó a venir al colegio?',
  '¿El espacio asignado (aula, laboratorio, cancha) fue acorde para las actividades?',
] as const;

export const VALORES_A: CarasA[] = ['feliz', 'neutral', 'triste'];
export const VALORES_B: SiNoB[] = ['si', 'no'];

export const instrumentoDeGrado = (g: string): Instrumento | null =>
  g === 'preescolar' || g === '1' || g === '2' ? 'A' : (GRADOS as readonly string[]).includes(g) ? 'B' : null;

export const clavesDe = (i: Instrumento): string[] =>
  Array.from({ length: i === 'A' ? PREGUNTAS_A.length : PREGUNTAS_B.length }, (_, k) => `p${k + 1}`);

export interface RespuestaCI {
  id?: string;
  instrumento: Instrumento;
  grado: string;
  sede: string | null;
  respuestas: Record<string, string>;
  comentario?: string;
  creado: Date | null;
}

/** Documento que se manda a Firestore (sin `creado`: lo pone el servidor). */
export function armarDocumento(
  grado: string, sede: string | null, respuestas: Record<string, string>, comentario: string,
): Omit<RespuestaCI, 'creado' | 'id'> | null {
  const instrumento = instrumentoDeGrado(grado);
  if (!instrumento) return null;
  const dominio = instrumento === 'A' ? VALORES_A : VALORES_B;
  const claves = clavesDe(instrumento);
  const limpia: Record<string, string> = {};
  for (const k of claves) {
    const v = respuestas[k];
    if (!v || !(dominio as string[]).includes(v)) return null; // todas obligatorias
    limpia[k] = v;
  }
  if (sede !== null && !SEDES_EVAL.some(s => s.id === sede)) return null;
  const doc: Omit<RespuestaCI, 'creado' | 'id'> = { instrumento, grado, sede, respuestas: limpia };
  const c = comentario.trim().slice(0, MAX_COMENTARIO);
  if (instrumento === 'A' && c) doc.comentario = c;
  return doc;
}

// ── Agregación ────────────────────────────────────────────────────────────

export interface Filtros { grado: string; sede: string } // '' = todos
export interface ConteoPregunta { valores: Record<string, number>; total: number }

export function filtrar(rs: RespuestaCI[], f: Filtros): RespuestaCI[] {
  return rs.filter(r =>
    (!f.grado || r.grado === f.grado) && (!f.sede || (f.sede === 'sin_dato' ? r.sede == null : r.sede === f.sede)));
}

export function resumir(rs: RespuestaCI[]) {
  const mk = (i: Instrumento): ConteoPregunta[] => {
    const dominio = i === 'A' ? VALORES_A : VALORES_B;
    return clavesDe(i).map(() => ({ valores: Object.fromEntries(dominio.map(v => [v, 0])), total: 0 }));
  };
  const A = mk('A'); const B = mk('B');
  const comentarios: { grado: string; sede: string | null; texto: string; creado: Date | null }[] = [];
  let totalA = 0; let totalB = 0;
  for (const r of rs) {
    const conteos = r.instrumento === 'A' ? A : B;
    if (r.instrumento === 'A') totalA++; else totalB++;
    clavesDe(r.instrumento).forEach((k, idx) => {
      const v = r.respuestas?.[k];
      if (v !== undefined && v in conteos[idx].valores) { conteos[idx].valores[v]++; conteos[idx].total++; }
    });
    if (r.instrumento === 'A' && r.comentario) comentarios.push({ grado: r.grado, sede: r.sede, texto: r.comentario, creado: r.creado });
  }
  return { total: rs.length, totalA, totalB, A, B, comentarios };
}

export const porcentaje = (n: number, total: number) => (total === 0 ? 0 : Math.round((n / total) * 1000) / 10);

const ETQ_VALOR: Record<string, string> = { feliz: 'Feliz', neutral: 'Neutral', triste: 'Triste', si: 'Sí', no: 'No' };
export const etiquetaValor = (v: string) => ETQ_VALOR[v] ?? v;

/** Filas planas para el Excel: una por respuesta; columnas P1..P10 (las de A usan P1..P4). */
export function filasExcel(rs: RespuestaCI[]): (string | number)[][] {
  const cab = ['Fecha', 'Instrumento', 'Grado', 'Sede', ...Array.from({ length: 10 }, (_, i) => `P${i + 1}`), 'Comentario'];
  const filas = rs.map(r => [
    r.creado ? r.creado.toISOString().slice(0, 16).replace('T', ' ') : '',
    r.instrumento,
    etiquetaGrado(r.grado),
    etiquetaSede(r.sede),
    ...Array.from({ length: 10 }, (_, i) => etiquetaValor(r.respuestas?.[`p${i + 1}`] ?? '')),
    r.comentario ?? '',
  ]);
  return [cab, ...filas];
}

/** Quién ve los resultados en la app (la regla de Firestore es la barrera real). */
export const ROLES_LECTORES = ['rectora', 'coordinador', 'superusuario'];
export const IDS_LECTORES_EXTRA = ['yuri'];
export const puedeVerResultados = (rol: string | null, userId: string | null, correo: string | null, lectores: string[]) =>
  (!!rol && ROLES_LECTORES.includes(rol))
  || (!!userId && IDS_LECTORES_EXTRA.includes(userId))
  || (!!correo && lectores.map(c => c.toLowerCase()).includes(correo.toLowerCase()));
