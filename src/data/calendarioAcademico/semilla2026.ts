// Semilla del calendario académico 2026 (fuente: «CALENDARIO ACADÉMICO 2026 versión 2»,
// docs/calendario-academico/fuente-v2-1.txt). Es el respaldo: si Firestore no tiene
// calendarioAcademico/2026, se muestra esto. Interpretaciones: docs/calendario-academico/PRD.md
import type { CategoriaCal, EventoCal } from './tipos';

type Extra = Partial<Pick<EventoCal, 'hasta' | 'porDefinir' | 'noSeRealiza' | 'aplicaA' | 'alertaDocente' | 'nota'>>;
const ev = (id: string, titulo: string, desde: string, categoria: CategoriaCal, x: Extra = {}): EventoCal =>
  ({ id, titulo, desde, categoria, alertaDocente: false, ...x });

const NOTA_P3 = 'El documento también dice 23 de agosto (domingo en 2026).';
const NOTA_REC = (t: string) => `Documento original: ${t} (los días de la semana del documento no corresponden a 2026).`;

/** Las columnas con fecha de la tabla grande, para un periodo. */
interface Fila {
  k: string; nombre: string; g?: 'grado11';
  cierre: string; autoeval: [string, string]; planes: [string, string][]; informe: string;
  consol: string; comisiones: string; padres: string; diario: string;
}
function filaEventos(f: Fila): EventoCal[] {
  const a = f.g ? { aplicaA: 'grado11' as const } : {};
  const n = f.g ? 'Grado 11 · ' : '';
  const out: EventoCal[] = [
    ev(`${f.k}_cierre_sistema`, `${n}Cierre del sistema (${f.nombre})`, f.cierre, 'entrega_docente', { ...a, alertaDocente: true }),
    ev(`${f.k}_autoeval`, `${n}Autoevaluación y coevaluación de estudiantes (${f.nombre})`, f.autoeval[0], 'institucional', { ...a, hasta: f.autoeval[1], alertaDocente: true }),
  ];
  f.planes.forEach((p, i) => out.push(ev(`${f.k}_planes_apoyo${f.planes.length > 1 ? '_' + (i + 1) : ''}`,
    `${n}Planes de apoyo (${f.nombre})${i === 1 ? ' · horario especial' : ''}`, p[0], 'entrega_docente', { ...a, hasta: p[1], alertaDocente: true })));
  out.push(
    ev(`${f.k}_informe_resultados`, `${n}Informe de resultados de planes de apoyo (${f.nombre})`, f.informe, 'entrega_docente', { ...a, alertaDocente: true }),
    ev(`${f.k}_consolidados`, `${n}Impresión de consolidados (${f.nombre})`, f.consol, 'entrega_docente', a),
    ev(`${f.k}_comisiones`, `${n}Comisiones de evaluación y promoción (${f.nombre})`, f.comisiones, 'reunion', { ...a, alertaDocente: true }),
    ev(`${f.k}_reunion_padres`, `${n}Reunión informe a padres (${f.nombre})`, f.padres, 'reunion', { ...a, alertaDocente: true }),
    ev(`${f.k}_diario_campo`, `${n}Entrega del diario de campo (${f.nombre})`, f.diario, 'entrega_docente', { ...a, alertaDocente: true }),
  );
  return out;
}

export const SEMILLA_2026: EventoCal[] = [
  // Periodos
  ev('periodo_1', 'Primer periodo académico', '2026-01-26', 'periodo', { hasta: '2026-05-01', nota: '13 semanas lectivas.' }),
  ev('periodo_2', 'Segundo periodo académico', '2026-05-04', 'periodo', { hasta: '2026-08-21', nota: '13 semanas lectivas.' }),
  ev('periodo_3', 'Tercer periodo académico', '2026-08-24', 'periodo', { hasta: '2026-12-04', nota: `14 semanas lectivas. ${NOTA_P3}` }),
  ev('periodo_3_grado11', 'Tercer periodo · Grado 11', '2026-08-24', 'periodo', { hasta: '2026-11-20', aplicaA: 'grado11', nota: NOTA_P3 }),
  // Recesos de estudiantes
  ev('receso_semana_santa', 'Receso de Semana Santa', '2026-03-30', 'receso', { hasta: '2026-04-03', nota: NOTA_REC('salen viernes 30 de marzo, ingresan lunes 03 de abril') }),
  ev('receso_mitad_anio', 'Vacaciones de mitad de año', '2026-06-22', 'receso', { hasta: '2026-07-10', nota: NOTA_REC('salen viernes 22 de junio, ingresan lunes 10 de julio') }),
  ev('receso_octubre', 'Receso de octubre', '2026-10-05', 'receso', { hasta: '2026-10-09', nota: NOTA_REC('salen viernes 05 de octubre, ingresan martes 11 de octubre') + ' El 12 de octubre es festivo; regresan el martes 13.' }),
  ev('receso_fin_anio', 'Vacaciones de fin de año (estudiantes)', '2026-12-07', 'receso', { nota: 'Desde el 7 de diciembre.' }),
  // Docentes y directivos
  ev('vacaciones_docentes_1', 'Vacaciones de docentes y directivos (2 semanas)', '2026-06-22', 'vacaciones_docentes', { hasta: '2026-07-05' }),
  ev('vacaciones_docentes_2', 'Vacaciones de docentes y directivos (2 semanas)', '2026-12-14', 'vacaciones_docentes', { hasta: '2026-12-27' }),
  // Desarrollo institucional
  ev('desarrollo_1', 'Semana de desarrollo institucional 1', '2026-01-12', 'desarrollo_institucional', { hasta: '2026-01-23', nota: 'El documento da el rango del 12 al 23 de enero.' }),
  ev('desarrollo_2', 'Semana de desarrollo institucional 2', '2026-03-30', 'desarrollo_institucional', { hasta: '2026-04-03' }),
  ev('desarrollo_3', 'Semana de desarrollo institucional 3', '2026-07-06', 'desarrollo_institucional', { hasta: '2026-07-10' }),
  ev('desarrollo_4', 'Semana de desarrollo institucional 4', '2026-10-05', 'desarrollo_institucional', { hasta: '2026-10-09' }),
  ev('desarrollo_5', 'Semana de desarrollo institucional 5', '2026-12-07', 'desarrollo_institucional', { hasta: '2026-12-11' }),
  // Alertas académicas
  ev('alerta_p1', 'Entrega de alertas académicas · 1.er periodo', '2026-03-25', 'entrega_docente', { alertaDocente: true }),
  ev('alerta_p2', 'Entrega de alertas académicas · 2.º periodo', '2026-07-22', 'entrega_docente', { alertaDocente: true }),
  ev('alerta_p3', 'Entrega de alertas académicas · 3.er periodo', '2026-10-28', 'entrega_docente', { alertaDocente: true }),
  // Informes académicos
  ev('informe_p1', 'Entrega de informes académicos · 1.er periodo', '2026-05-12', 'entrega_docente', { alertaDocente: true }),
  ev('informe_p2', 'Entrega de informes académicos · 2.º periodo', '2026-09-10', 'entrega_docente', { alertaDocente: true }),
  ev('informe_p3', 'Entrega de informes académicos · 3.er periodo e informe final', '2026-12-10', 'entrega_docente', { alertaDocente: true }),
  // Actividades institucionales
  ev('dia_democracia', 'Día de la democracia', '2026-03-13', 'institucional'),
  ev('posesion_gobierno', 'Posesión del gobierno escolar', '2026-03-27', 'institucional'),
  ev('dia_nino', 'Día del niño', '2026-04-29', 'institucional'),
  ev('antioquenidad', 'Antioqueñidad', '2026-08-28', 'institucional'),
  ev('semana_convivencia', 'Semana de la convivencia', '2026-10-12', 'institucional', { hasta: '2026-10-16' }),
  ev('semana_ed_vial', 'Semana de educación vial', '2026-10-01', 'institucional', { porDefinir: true, nota: 'Fecha por definir.' }),
  ev('carrusel_media_tecnica', 'Carrusel de media técnica', '2026-10-23', 'institucional'),
  ev('muestras_pedagogicas', 'Muestras pedagógicas', '2026-10-29', 'institucional'),
  ev('entrega_simbolos', 'Entrega de símbolos', '2026-11-13', 'institucional'),
  ev('foro_corregimental', 'Foro corregimental', '2026-11-01', 'institucional', { noSeRealiza: true, nota: 'No se realiza en 2026.' }),
  ev('corpresarte', 'Corpresarte «Danza en América»', '2026-11-06', 'institucional'),
  ev('evaluacion_docentes_1278', 'Evaluación de docentes (Decreto 1278)', '2026-11-01', 'institucional', { hasta: '2026-11-30', nota: 'El documento solo dice «Noviembre».' }),
  ev('planes_recuperacion_2027', 'Entrega a coordinación de planes de recuperación 2027', '2026-12-03', 'entrega_docente', { alertaDocente: true }),
  ev('acto_excelencia', 'Acto de la excelencia', '2026-12-07', 'institucional'),
  ev('entrega_productos', 'Entrega de productos a coordinación', '2026-12-07', 'entrega_docente', { alertaDocente: true }),
  ev('graduacion', 'Graduación', '2026-12-04', 'institucional'),
  ev('cierre_anio_lectivo', 'Cierre del año lectivo', '2026-12-14', 'institucional'),
  ev('autoevaluacion_institucional', 'Autoevaluación institucional', '2027-01-01', 'institucional', { hasta: '2027-01-31', nota: 'El documento solo dice «Enero 2027».' }),
  // Tabla grande por periodo
  ...filaEventos({ k: 'p1', nombre: '1.er periodo', cierre: '2026-05-06', autoeval: ['2026-04-20', '2026-05-01'],
    planes: [['2026-05-04', '2026-05-15']], informe: '2026-05-19', consol: '2026-05-07', comisiones: '2026-05-08', padres: '2026-05-13', diario: '2026-05-04' }),
  ...filaEventos({ k: 'p2', nombre: '2.º periodo', cierre: '2026-08-26', autoeval: ['2026-08-10', '2026-08-21'],
    planes: [['2026-08-24', '2026-09-09']], informe: '2026-09-14', consol: '2026-08-31', comisiones: '2026-09-02', padres: '2026-09-10', diario: '2026-08-28' }),
  ...filaEventos({ k: 'p3', nombre: '3.er periodo', cierre: '2026-12-04', autoeval: ['2026-11-09', '2026-11-19'],
    planes: [['2026-11-17', '2026-11-23'], ['2026-11-24', '2026-11-30']], informe: '2026-12-01', consol: '2026-12-02', comisiones: '2026-12-03', padres: '2026-12-10', diario: '2026-12-07' }),
  ...filaEventos({ k: 'g11', nombre: '3.er periodo', g: 'grado11', cierre: '2026-11-23', autoeval: ['2026-11-10', '2026-11-13'],
    planes: [['2026-11-17', '2026-11-23'], ['2026-11-24', '2026-11-26']], informe: '2026-11-27', consol: '2026-11-27', comisiones: '2026-11-28', padres: '2026-12-02', diario: '2026-12-07' }),
];
