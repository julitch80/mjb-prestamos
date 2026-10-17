import { describe, it, expect } from 'vitest';
import type { ContextoValidacion, Tarea } from './tipos';
import { planificarAgenda, validarTarea, cupoDisponible, clavePeriodo } from './motor';
import {
  avisoEvaluaciones, cuentaRegresiva, enlacesVisibles, nombreDeEnlace, recordatoriosProximos,
  validarEnlaces, validarRecordatorio,
} from './recordatorios';
import { eventosDeseadosDelGrupo, type TareaRemota } from './sincronizacion-calendario';

const HOY = '2026-10-19'; // lunes
const JUEVES = '2026-10-22';

function rec(p: Partial<Tarea> = {}): Tarea {
  return {
    id: Math.random().toString(36).slice(2), grupo: '9.1', asignaturaId: 'fisica', docenteId: 'julian',
    titulo: 'Examen', momentos: 0, fechaAsignacion: HOY, fechaEntrega: JUEVES, estado: 'activa',
    tipo: 'recordatorio', tipoRecordatorio: 'evaluacion', ...p,
  };
}
function ctx(tareas: Tarea[] = []): ContextoValidacion {
  return { hoy: HOY, tareas, cesiones: [], diasClase: ['lunes', 'martes', 'miercoles', 'jueves', 'viernes'] };
}
const nombre = (id: string) => ({ fisica: 'Física', quimica: 'Química', matematicas: 'Matemáticas' }[id] ?? id);

describe('enlaces', () => {
  it('«hola» no es un enlace válido', () => {
    expect(validarEnlaces([{ url: 'hola' }])).toEqual({ ok: false, error: 'Ese enlace no es válido' });
  });
  it('rechaza javascript: y acepta http/https', () => {
    expect(validarEnlaces([{ url: 'javascript:alert(1)' }]).ok).toBe(false);
    expect(validarEnlaces([{ url: 'https://youtu.be/x', nombre: 'Video' }, { url: 'http://a.co' }]).ok).toBe(true);
  });
  it('máximo 3 y descarta filas vacías', () => {
    const e = (u: string) => ({ url: u });
    expect(validarEnlaces([e('https://a.co'), e('https://b.co'), e('https://c.co'), e('https://d.co')]).ok).toBe(false);
    const r = validarEnlaces([e('https://a.co'), { url: '' }]);
    expect(r.ok && r.enlaces.length).toBe(1);
  });
  it('el botón usa el nombre o, si no, el dominio', () => {
    expect(nombreDeEnlace({ url: 'https://www.youtube.com/watch?v=1', nombre: 'Video de la clase' })).toBe('Video de la clase');
    expect(nombreDeEnlace({ url: 'https://www.youtube.com/watch?v=1' })).toBe('youtube.com');
  });
  it('enlacesVisibles ignora lo inseguro', () => {
    expect(enlacesVisibles({ enlaces: [{ url: 'javascript:x' }, { url: 'https://ok.co' }] })).toHaveLength(1);
  });
  it('validarTarea rechaza una tarea con enlace inválido', () => {
    const t: Tarea = { ...rec(), tipo: 'tarea', tipoRecordatorio: undefined, momentos: 1, fechaEntrega: '2026-10-30', enlaces: [{ url: 'hola' }] };
    expect(validarTarea(t, ctx()).ok).toBe(false);
  });
});

describe('recordatorios: validación', () => {
  it('se puede publicar para mañana (sin plazo mínimo) y no gasta cupo de momentos', () => {
    const manana = '2026-10-20';
    const antes = cupoDisponible(ctx(), '9.1', 'fisica', clavePeriodo('9.1', manana));
    const r = rec({ fechaEntrega: manana });
    expect(validarTarea(r, ctx()).ok).toBe(true);
    const despues = cupoDisponible(ctx([r]), '9.1', 'fisica', clavePeriodo('9.1', manana));
    expect(despues).toBe(antes);
    expect(planificarAgenda([r], '9.1', HOY).porDia).toEqual({});
  });
  it('rechaza hoy, fines de semana y festivos', () => {
    expect(validarRecordatorio(rec({ fechaEntrega: HOY }), ctx()).ok).toBe(false);
    expect(validarRecordatorio(rec({ fechaEntrega: '2026-10-24' }), ctx()).ok).toBe(false); // sábado
    expect(validarRecordatorio(rec({ fechaEntrega: '2026-11-02' }), ctx()).ok).toBe(false); // festivo
  });
  it('el cuarto recordatorio del día no se deja publicar', () => {
    const tres = [rec(), rec({ tipoRecordatorio: 'materiales' }), rec({ tipoRecordatorio: 'aviso' })];
    expect(validarRecordatorio(rec(), ctx(tres))).toMatchObject({ ok: false, mensaje: 'Este grupo ya tiene 3 recordatorios ese día' });
  });
  it('las canceladas, otros grupos y otros días no cuentan', () => {
    const otros = [rec({ estado: 'cancelada' }), rec({ grupo: '9.2' }), rec({ fechaEntrega: '2026-10-23' })];
    expect(validarRecordatorio(rec(), ctx(otros)).ok).toBe(true);
  });
  it('con 2 evaluaciones, la tercera avisa (sin bloquear)', () => {
    const dos = [rec(), rec({ asignaturaId: 'quimica' })];
    const nueva = rec({ asignaturaId: 'matematicas' });
    expect(validarRecordatorio(nueva, ctx(dos)).ok).toBe(true);
    expect(avisoEvaluaciones(nueva, dos, nombre)).toBe(
      '9.1 ya tiene 2 evaluaciones el jueves 22: Física y Química. ¿Publicar de todos modos?',
    );
  });
  it('con 1 evaluación o con otro tipo no avisa', () => {
    expect(avisoEvaluaciones(rec(), [rec()], nombre)).toBeNull();
    expect(avisoEvaluaciones(rec({ tipoRecordatorio: 'aviso' }), [rec(), rec()], nombre)).toBeNull();
  });
});

describe('recordatorios: agenda del estudiante', () => {
  it('cuenta regresiva', () => {
    expect(cuentaRegresiva('2026-10-20', HOY)).toBe('mañana');
    expect(cuentaRegresiva('2026-10-22', HOY)).toBe('en 3 días');
    expect(cuentaRegresiva(HOY, HOY)).toBe('hoy');
  });
  it('los próximos salen ordenados, sin pasados ni cancelados', () => {
    const a = rec({ id: 'a', fechaEntrega: '2026-10-23' });
    const b = rec({ id: 'b', fechaEntrega: '2026-10-20' });
    const c = rec({ id: 'c', estado: 'cancelada' });
    const d = rec({ id: 'd', fechaEntrega: '2026-10-16' });
    expect(recordatoriosProximos([a, b, c, d], '9.1', HOY).map(t => t.id)).toEqual(['b', 'a']);
  });
});

describe('recordatorios en el calendario de Google', () => {
  const base: TareaRemota = {
    id: 'R1', grupo: '9.1', asignaturaId: 'fisica', titulo: 'Examen',
    fechaEntrega: JUEVES, estado: 'activa', momentos: 0, tipo: 'recordatorio', tipoRecordatorio: 'evaluacion',
  };
  it('crea evento con el ícono en el título, y la cancelación lo quita', () => {
    const ev = eventosDeseadosDelGrupo([base], '9.1', nombre, 'https://x/agenda');
    expect(ev).toHaveLength(1);
    expect(ev[0].resumen.startsWith('📝')).toBe(true);
    expect(eventosDeseadosDelGrupo([{ ...base, estado: 'cancelada' }], '9.1', nombre, 'https://x/agenda')).toHaveLength(0);
  });
});

describe('recordatorios: replicar a otros grupos', () => {
  it('va a los otros grupos el mismo día y respeta el tope de 3', async () => {
    const { planificarReplica, tareaDesdePlan } = await import('./replicar');
    const original = rec({ enlaces: [{ url: 'https://a.co' }] });
    const ok = planificarReplica(original, '9.2', ctx());
    expect(ok).toMatchObject({ viable: true, fechaEntrega: JUEVES });
    expect(tareaDesdePlan(original, ok)).toMatchObject({ tipo: 'recordatorio', tipoRecordatorio: 'evaluacion', enlaces: [{ url: 'https://a.co' }] });
    const llenos = [rec({ grupo: '9.2' }), rec({ grupo: '9.2' }), rec({ grupo: '9.2' })];
    expect(planificarReplica(original, '9.2', ctx(llenos)).viable).toBe(false);
  });
});
