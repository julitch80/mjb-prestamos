// Temas del formulario por sede. Lo que «ya sabemos» se GENERA desde maestros.ts
// (nada copiado a mano): si cambia el maestro, cambia la tarjeta.
import {
  USUARIOS, DIRECTORES_GUSTAVO_RODAS, DIRECTORES_LA_FINQUITA, GRUPOS_GUSTAVO_RODAS, GRUPOS_LA_FINQUITA,
  HORARIO_JORNADA_GUSTAVO_RODAS, HORARIO_JORNADA_LA_FINQUITA,
  BLOQUES_POR_JORNADA_GUSTAVO_RODAS, BLOQUES_POR_JORNADA_LA_FINQUITA,
  ASIGNATURAS_TARDE_GUSTAVO_RODAS, ASIGNATURAS_TARDE_LA_FINQUITA, AUTORIDAD_SEDE,
} from '../maestros';
import type { FilaPrellenada, Pregunta, SedeDatosId, Tema } from './tipos';

export const NOMBRE_SEDE: Record<SedeDatosId, string> = {
  gustavo_rodas: 'Gustavo Rodas Isaza',
  la_finquita: 'La Finquita',
};
const JORNADA: Record<string, string> = { manana: 'Mañana', tarde: 'Tarde', ambas: 'Ambas' };

/** Sedes que puede responder un usuario: el coordinador con autoridad, y el superusuario ambas. */
export function sedesDeUsuario(userId: string | null, rol: string | null): SedeDatosId[] {
  if (rol === 'superusuario') return ['gustavo_rodas', 'la_finquita'];
  if (rol !== 'coordinador' || !userId) return [];
  return (['gustavo_rodas', 'la_finquita'] as SedeDatosId[]).filter(s => AUTORIDAD_SEDE[s].includes(userId));
}

function nombreDe(id: string): string {
  return USUARIOS.find(u => u.id === id)?.nombre ?? id;
}

function docentes(sede: SedeDatosId): FilaPrellenada[] {
  return USUARIOS.filter(u => u.sede === sede && u.rol === 'docente')
    .map(u => ({ etiqueta: u.nombre, valor: JORNADA[u.jornada] ?? u.jornada }));
}

function directores(sede: SedeDatosId): FilaPrellenada[] {
  const dir = sede === 'gustavo_rodas' ? DIRECTORES_GUSTAVO_RODAS : DIRECTORES_LA_FINQUITA;
  const gr = sede === 'gustavo_rodas' ? GRUPOS_GUSTAVO_RODAS : GRUPOS_LA_FINQUITA;
  const filas: FilaPrellenada[] = [];
  for (const j of ['manana', 'tarde'] as const) {
    for (const g of gr[j]) filas.push({ etiqueta: `${g} (${JORNADA[j]})`, valor: dir[g] ? nombreDe(dir[g]) : 'sin director' });
  }
  return filas;
}

function horasJornada(sede: SedeDatosId): FilaPrellenada[] {
  const h = sede === 'gustavo_rodas' ? HORARIO_JORNADA_GUSTAVO_RODAS : HORARIO_JORNADA_LA_FINQUITA;
  const b = sede === 'gustavo_rodas' ? BLOQUES_POR_JORNADA_GUSTAVO_RODAS : BLOQUES_POR_JORNADA_LA_FINQUITA;
  const filas: FilaPrellenada[] = h.map(x => ({
    etiqueta: `${JORNADA[x.jornada]} · ${x.grupos.join(', ')}`, valor: `${x.inicio} a ${x.fin}`,
  }));
  for (const j of ['manana', 'tarde'] as const) {
    filas.push({ etiqueta: `Bloques diarios · ${JORNADA[j]}`, valor: b[j] == null ? 'sin dato' : String(b[j]) });
  }
  return filas;
}

function gruposPorJornada(sede: SedeDatosId): FilaPrellenada[] {
  const gr = sede === 'gustavo_rodas' ? GRUPOS_GUSTAVO_RODAS : GRUPOS_LA_FINQUITA;
  return (['manana', 'tarde'] as const).map(j => ({ etiqueta: JORNADA[j], valor: gr[j].join(', ') }));
}

function asignaturasTarde(sede: SedeDatosId): FilaPrellenada[] {
  const a = sede === 'gustavo_rodas' ? ASIGNATURAS_TARDE_GUSTAVO_RODAS : ASIGNATURAS_TARDE_LA_FINQUITA;
  return Object.entries(a).map(([id, v]) => ({ etiqueta: nombreDe(id), valor: v }));
}

const OTRO = { valor: 'Otro', pide: '¿Cuál?' };

export const PREGUNTAS_ASISTENCIA: Pregunta[] = [
  { id: 'lista', etiqueta: '¿Cómo se pasa lista?', opciones: [
    { valor: 'Una vez al día' }, { valor: 'En cada clase' }, { valor: 'Mixto', pide: '¿En qué grupos?' },
  ] },
  { id: 'tolerancia', etiqueta: 'Llegadas tarde: ¿cuántos minutos de tolerancia?', opciones: [
    { valor: '5 min' }, { valor: '10 min' }, { valor: '15 min' }, { valor: 'Otro', pide: '¿Cuántos minutos?' },
  ] },
  { id: 'recibe', etiqueta: 'Llegadas tarde: ¿quién recibe al niño?', opciones: [
    { valor: 'Portería' }, { valor: 'Docente' }, { valor: 'Coordinación' }, OTRO,
  ] },
  { id: 'registra_hoy', etiqueta: 'Llegadas tarde: ¿hoy se registra?', opciones: [{ valor: 'Sí' }, { valor: 'No' }] },
  { id: 'quien_llama', etiqueta: 'Inasistencia: ¿quién llama a la familia?' },
  { id: 'telefono', etiqueta: 'Inasistencia: ¿desde qué teléfono?', opciones: [
    { valor: 'Celular de coordinación' }, { valor: 'Teléfono de la sede' }, { valor: 'Celular del docente' }, OTRO,
  ] },
  { id: 'pae_ci', etiqueta: '¿Hay restaurante escolar (PAE) o centros de interés con lista?', opciones: [
    { valor: 'Sí', pide: '¿Cuáles?' }, { valor: 'No' },
  ] },
];

const PREG_MASTER: Pregunta = {
  id: 'fuera_master', etiqueta: '¿Hay estudiantes que todavía no estén en el Máster?',
  opciones: [{ valor: 'No' }, { valor: 'Sí', pide: '¿Cuáles?' }],
};

export function temasDeSede(sede: SedeDatosId): Tema[] {
  const gr = sede === 'gustavo_rodas';
  const temas: Tema[] = [];

  const nombreSoraya = USUARIOS.find(u => u.id === 'fin_soraya')?.nombre ?? 'Soraya';
  temas.push({
    id: 'docentes', titulo: 'Docentes y jornada', modo: 'confirmar', hoja: 'Docentes',
    ayuda: 'Revise que estén todos los docentes y la jornada de cada uno.',
    prellenado: docentes(sede),
    preguntas: gr ? [] : [{
      id: 'apellido_soraya', etiqueta: `¿Así se escribe el nombre de Soraya: «${nombreSoraya}»?`,
      opciones: [{ valor: 'Sí, así' }, { valor: 'No', pide: '¿Cómo se escribe?' }],
    }],
  });
  temas.push({
    id: 'directores', titulo: 'Directores de grupo', modo: 'confirmar', hoja: 'Directores',
    ayuda: gr ? 'Mañana y tarde.' : undefined,
    prellenado: directores(sede), preguntas: [],
  });

  if (gr) {
    temas.push({
      id: 'funciones', titulo: 'Función y jornada de Beatriz Amparo Marín Marín y Milena Badel', modo: 'responder',
      hoja: 'Docentes',
      ayuda: 'Figuran en la Resolución 33 como personal de la sede, pero no en la asignación académica.',
      prellenado: [],
      preguntas: [
        { id: 'beatriz_funcion', etiqueta: 'Beatriz Amparo Marín Marín: ¿qué función cumple?' },
        { id: 'beatriz_jornada', etiqueta: 'Beatriz Amparo Marín Marín: ¿en qué jornada?', opciones: [{ valor: 'Mañana' }, { valor: 'Tarde' }, { valor: 'Ambas' }] },
        { id: 'milena_funcion', etiqueta: 'Milena Badel: ¿qué función cumple?' },
        { id: 'milena_jornada', etiqueta: 'Milena Badel: ¿en qué jornada?', opciones: [{ valor: 'Mañana' }, { valor: 'Tarde' }, { valor: 'Ambas' }] },
      ],
    });
    temas.push({
      id: 'horario', titulo: 'Horario de la mañana', modo: 'responder', hoja: 'Horario',
      ayuda: 'Docente y asignatura por bloque. Lo más fácil: una foto o el archivo del horario.',
      prellenado: gruposPorJornada(sede), preguntas: [],
    });
    temas.push({
      id: 'bloques_ci', titulo: 'Bloques de la tarde y Centro de Interés', modo: 'confirmar', hoja: 'Horario',
      ayuda: 'Confirme: la tarde tiene 5 bloques diarios y el C.I. es el miércoles en el tercer bloque.',
      prellenado: [
        { etiqueta: 'Bloques diarios · Tarde', valor: String(BLOQUES_POR_JORNADA_GUSTAVO_RODAS.tarde ?? 'sin dato') },
        { etiqueta: 'Centro de Interés (C.I.)', valor: 'Miércoles, tercer bloque' },
        ...asignaturasTarde(sede),
      ],
      preguntas: [],
    });
  } else {
    temas.push({
      id: 'jornada_33', titulo: 'Jornada de 3°3 y docentes con carga en la mañana', modo: 'responder', hoja: 'Docentes',
      ayuda: 'El Excel pone a 3°3 en las dos jornadas; hoy figura en la tarde.',
      prellenado: gruposPorJornada(sede),
      preguntas: [
        { id: 'jornada_33', etiqueta: '¿En qué jornada está 3°3?', opciones: [{ valor: 'Mañana' }, { valor: 'Tarde' }, { valor: 'Ambas' }] },
        { id: 'manana_tres', etiqueta: '¿Soraya, Leidy Viviana y Paula trabajan también en la mañana?',
          opciones: [{ valor: 'No' }, { valor: 'Sí', pide: '¿Cuáles y qué días?' }] },
      ],
    });
    temas.push({
      id: 'horario', titulo: 'Horario de las dos jornadas', modo: 'responder', hoja: 'Horario',
      ayuda: 'Docente y asignatura por bloque. Lo más fácil: una foto o el archivo del horario.',
      prellenado: asignaturasTarde(sede), preguntas: [],
    });
  }

  temas.push({
    id: 'horas', titulo: 'Horas de los bloques y de los descansos', modo: 'responder', hoja: 'Horas y descansos',
    ayuda: 'Inicio y fin de cada bloque y de cada descanso, en ambas jornadas.',
    prellenado: horasJornada(sede), preguntas: [],
  });
  temas.push({
    id: 'acompanamientos', titulo: gr ? 'Acompañamientos en los descansos' : 'Acompañamientos', modo: 'responder',
    hoja: 'Acompañamientos',
    ayuda: 'Lugares, docente, día y jornada de cada turno.',
    prellenado: [], preguntas: [],
  });
  temas.push({
    id: 'asistencia', titulo: 'Asistencia', modo: 'responder', hoja: 'Asistencia',
    ayuda: 'Un toque por pregunta. Si no aplica, déjela en blanco.',
    prellenado: [], preguntas: PREGUNTAS_ASISTENCIA,
  });
  temas.push({
    id: 'estudiantes', titulo: 'Estudiantes fuera del Máster', modo: 'responder', hoja: 'Estudiantes',
    prellenado: [], preguntas: [PREG_MASTER],
  });
  return temas;
}
