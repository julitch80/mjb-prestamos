// Brigadas de gestión del riesgo — transcritas de la Resolución Rectoral
// N.º 33 (07 de septiembre de 2023), "Por medio de la cual se conforma las
// Brigadas para la atención de emergencias en la Institución Educativa
// Manuel J Betancur".
//
// Mapeo de sedes del documento → SedeId:
//   'Principal' / 'principal'                 → 'central'
//   'GRI' / 'Gustavo Rodas'                    → 'gustavo_rodas'
//   'FINCA' / 'La Finca' / 'Sede Alterna'      → 'la_finquita'

import type { SedeId } from './maestros';

export interface IntegranteBrigada {
  nombre: string;
  sede: SedeId | 'todas';
  jornada: 'manana' | 'tarde' | 'ambas' | 'nocturna';
  docenteId?: string;
  nota?: string;
}

export interface Brigada {
  id: string;
  nombre: string;
  descripcion: string;
  funciones: string[];
  integrantes: IntegranteBrigada[];
}

export const RESOLUCION_BRIGADAS = {
  numero: 33,
  fecha: '2023-09-07',
  titulo: 'Resolución Rectoral N.º 33 — Conformación de brigadas para la atención de emergencias',
};

// ── Líderes de gestión del riesgo por sede (Artículo 1) ──────────────────────

export const LIDERES_GESTION_RIESGO: IntegranteBrigada[] = [
  // Directivos docentes
  { nombre: 'Nancy Adriana Herrera López', sede: 'todas', jornada: 'ambas', docenteId: 'rectora' },
  { nombre: 'Juan Diego Salazar Rendón', sede: 'central', jornada: 'tarde', docenteId: 'coord_tarde' },
  { nombre: 'Juan Diego Salazar Rendón', sede: 'la_finquita', jornada: 'tarde', docenteId: 'coord_tarde' },
  { nombre: 'Janeth Astrid Ocampo Carvajal', sede: 'central', jornada: 'manana', docenteId: 'coord_manana' },
  { nombre: 'Janeth Astrid Ocampo Carvajal', sede: 'gustavo_rodas', jornada: 'manana', docenteId: 'coord_manana' },

  // Docentes líderes por sede
  { nombre: 'Gloria Yanet Gallego Rendón', sede: 'la_finquita', jornada: 'manana' },
  { nombre: 'Paula Andrea Zapata M', sede: 'la_finquita', jornada: 'tarde' },
  { nombre: 'Claudia Patricia Henao', sede: 'central', jornada: 'manana', docenteId: 'claudia' },
  { nombre: 'Hugo Armando Yepes', sede: 'central', jornada: 'tarde', docenteId: 'hugo' },
  { nombre: 'Leidy Yadira Atehortua', sede: 'gustavo_rodas', jornada: 'manana' },
  { nombre: 'Dolly Gutiérrez Guevara', sede: 'gustavo_rodas', jornada: 'tarde' },
  { nombre: 'Luz Marina Zapata', sede: 'central', jornada: 'tarde', docenteId: 'marina' },
];

// ── Brigadas (Artículos 3 a 7) ────────────────────────────────────────────────

export const BRIGADAS: Brigada[] = [
  {
    id: 'evacuacion',
    nombre: 'Brigada de evacuación',
    descripcion:
      'Conformada por todos los docentes y/o profesionales de apoyo que se encuentren en las aulas en cada sede, en caso de presentarse una emergencia real o simulacro de evacuación. Cada docente debe identificar en cada aula al estudiante del grupo que es brigadista de apoyo en la evacuación.',
    funciones: [
      'Conocer de forma amplia el plan de atención de emergencias de cada sede donde presta sus servicios.',
      'Identificar las rutas de evacuación y puntos de encuentro de la sede; seguir señalización.',
      'Realizar con sus estudiantes de forma permanente sensibilización frente a la prevención de riesgos y la importancia de conservar la calma en caso de una emergencia.',
      'Actuar de forma adecuada y bajo directrices del plan de gestión del riesgo institucional en caso de requerirse una evacuación del aula y llevar de forma tranquila y organizada al grupo de estudiantes al punto de encuentro, siguiendo la ruta correcta de evacuación.',
      'Con apoyo de brigadistas escolares realizar informe de la presencia o ausencia de alguno de los estudiantes e informar al líder de gestión de riesgo de la sede para activar otra brigada.',
      'En caso de sismo el brigadista de evacuación debe conservar la calma y animar a los demás a que también la conserven durante los primeros 40 segundos y hacer que adopten una posición segura sin salir del aula; solo en caso de escuchar alarma se realizará la evacuación de forma ordenada y segura. Si se presentan en los primeros 40 segundos fisuras estructurales o caída de objetos peligrosos, debe realizarse la evacuación de forma controlada aún sin escuchar la alarma. Se recomienda para las tres sedes permanecer con la puerta del aula abierta ya que no cuentan con dispositivos de seguridad que permitan en la evacuación la apertura hacia afuera de forma ágil.',
    ],
    integrantes: [
      // Jornada AM: Sede FINCA
      { nombre: 'Margarita María Bedoya Bedoya', sede: 'la_finquita', jornada: 'manana' },
      { nombre: 'Gloria Yanet Gallego Rendón', sede: 'la_finquita', jornada: 'manana' },
      { nombre: 'Mary Luz Hoyos Hoyos', sede: 'la_finquita', jornada: 'manana' },
      // Jornada PM: Sede FINCA
      { nombre: 'Soraya Bother', sede: 'la_finquita', jornada: 'tarde' },
      { nombre: 'Leidy Viviana Zapata Corrales', sede: 'la_finquita', jornada: 'tarde' },
      { nombre: 'Paula Andrea Zapata Martínez', sede: 'la_finquita', jornada: 'tarde' },
      // Jornada AM: Sede GRI
      { nombre: 'Leidy Yadira Atehortua Rojas', sede: 'gustavo_rodas', jornada: 'manana' },
      { nombre: 'María Victoria Henao Toro', sede: 'gustavo_rodas', jornada: 'manana' },
      { nombre: 'Lourdes Uparela Imbeth', sede: 'gustavo_rodas', jornada: 'manana' },
      { nombre: 'Jaqueline Arevalo Alzate', sede: 'gustavo_rodas', jornada: 'manana' },
      { nombre: 'Edison Alejandro Sánchez Angel', sede: 'gustavo_rodas', jornada: 'manana' },
      // Jornada PM: Sede GRI
      { nombre: 'Sandra García García', sede: 'gustavo_rodas', jornada: 'tarde' },
      { nombre: 'Edwin Alexis Toro', sede: 'gustavo_rodas', jornada: 'tarde' },
      { nombre: 'Delcy Johana Rivera', sede: 'gustavo_rodas', jornada: 'tarde' },
      { nombre: 'Leonardo Acevedo Suárez', sede: 'gustavo_rodas', jornada: 'tarde' },
      { nombre: 'Diego Alejandro Mejía Merino', sede: 'gustavo_rodas', jornada: 'tarde' },
      { nombre: 'Dolly Marley Gutiérrez Guevara', sede: 'gustavo_rodas', jornada: 'tarde' },
      { nombre: 'Beatriz Elena Zapata Vásquez', sede: 'gustavo_rodas', jornada: 'tarde' },
      // Jornada AM: Sede principal
      { nombre: 'Jorge Iván Acevedo Tabares', sede: 'central', jornada: 'manana', docenteId: 'jorge' },
      { nombre: 'Juan Carlos Blandón Vargas', sede: 'central', jornada: 'manana', docenteId: 'yoguis' },
      { nombre: 'Gloria Estella Álvarez López', sede: 'central', jornada: 'manana', docenteId: 'gloria_a' },
      { nombre: 'Adolfo León Arango Arroyave', sede: 'central', jornada: 'manana', docenteId: 'adolfo' },
      { nombre: 'Carlos Alberto Cárdenas', sede: 'central', jornada: 'manana', docenteId: 'carlos' },
      { nombre: 'Leidy Johana Cano Ruiz', sede: 'central', jornada: 'manana', docenteId: 'johana' },
      { nombre: 'Mónica Tatiana Córdoba Zapata', sede: 'central', jornada: 'manana', docenteId: 'monica_c' },
      { nombre: 'Claudia Patricia Henao Bermúdez', sede: 'central', jornada: 'manana', docenteId: 'claudia' },
      { nombre: 'Julián David Medina Tamayo', sede: 'central', jornada: 'manana', docenteId: 'julian' },
      { nombre: 'Margarita María Montoya Olaya', sede: 'central', jornada: 'manana', docenteId: 'margara' },
      { nombre: 'Beatriz Elena Montoya Valdés', sede: 'central', jornada: 'manana', docenteId: 'beatriz' },
      { nombre: 'José Uriel López Arias', sede: 'central', jornada: 'manana', docenteId: 'uriel' },
      { nombre: 'Ledis Laura Quintana Seguanes', sede: 'central', jornada: 'manana', docenteId: 'ledis' },
      { nombre: 'Doris Castrillón Álvarez', sede: 'central', jornada: 'manana', docenteId: 'doris', nota: 'Requiere apoyo: movilidad reducida' },
      { nombre: 'Martha Lucía Úsuga Sepúlveda', sede: 'central', jornada: 'manana', docenteId: 'marta' },
      // Jornada PM: Sede principal
      { nombre: 'Luis Javier Rojas García', sede: 'central', jornada: 'tarde', docenteId: 'luis_javier' },
      { nombre: 'Carolina Medina', sede: 'central', jornada: 'tarde', docenteId: 'carolina' },
      { nombre: 'Juan Pablo Bettin Tapia', sede: 'central', jornada: 'tarde', docenteId: 'juan_pablo' },
      { nombre: 'Víctor Hugo Giraldo', sede: 'central', jornada: 'tarde' },
      { nombre: 'Edgar Alexis Pérez', sede: 'central', jornada: 'tarde', docenteId: 'edgar' },
      { nombre: 'Jonathan Felipe Piedrahita Nieto', sede: 'central', jornada: 'tarde', docenteId: 'felipe' },
      { nombre: 'Mónica Alexandra Rave Velásquez', sede: 'central', jornada: 'tarde', docenteId: 'monica_rave' },
      { nombre: 'Harold Meyit Gómez Lopera', sede: 'central', jornada: 'tarde', docenteId: 'harol' },
      { nombre: 'Luis Ángel Quiceno Quiceno', sede: 'central', jornada: 'tarde', docenteId: 'luis_angel' },
      { nombre: 'Hugo Armando Yepes Franco', sede: 'central', jornada: 'tarde', docenteId: 'hugo' },
    ],
  },
  {
    id: 'primeros_auxilios',
    nombre: 'Brigada de primeros auxilios',
    descripcion:
      'Conformada por docentes que tengan conocimiento de primer respondiente o la IE abrirá espacios de capacitación para ellos; mínimo un docente por sede y jornada.',
    funciones: [
      'Capacitarse como primer respondiente e implementar sus conocimientos cada vez que se presente un evento en la sede.',
      'Activar alerta a organismos de apoyo cuando se requiera atender una emergencia.',
      'Identificar plenamente los sitios donde se encuentran ubicados los botiquines y camillas para su fácil acceso.',
      'Hacer revisión e informe al líder de gestión del riesgo de las necesidades de dotación de los botiquines.',
      'En caso de emergencia, valorar a los afectados, brindar los primeros auxilios con apoyo de estudiantes brigadistas y derivar a salud y a organismos de apoyo los casos que así lo ameriten, informando de su actuación al líder de atención de emergencias de la sede quien informa a las familias de los menores.',
      'Activar la póliza de accidentes escolares siempre que se remita un paciente a centro hospitalario o se entregue a la familia para hacerlo (diligenciar formato).',
      'En caso de emergencia debe esperar a ser relevado de su cargo de brigadista de evacuación, para dirigirse a cumplir sus funciones como brigadista de primeros auxilios.',
    ],
    integrantes: [
      { nombre: 'Juan Pablo Bettin', sede: 'central', jornada: 'tarde', docenteId: 'juan_pablo' },
      { nombre: 'Mónica Rave', sede: 'central', jornada: 'tarde', docenteId: 'monica_rave' },
      { nombre: 'Julián David Medina', sede: 'central', jornada: 'manana', docenteId: 'julian' },
      { nombre: 'Carlos Alberto Cárdenas', sede: 'central', jornada: 'manana', docenteId: 'carlos' },
      { nombre: 'Dolly Marley Gutiérrez', sede: 'gustavo_rodas', jornada: 'tarde' },
      { nombre: 'Lourdes Uparela', sede: 'gustavo_rodas', jornada: 'manana' },
      { nombre: 'Mary Luz Hoyos', sede: 'la_finquita', jornada: 'manana' },
      { nombre: 'Soraya Bother', sede: 'la_finquita', jornada: 'tarde' },
    ],
  },
  {
    id: 'contra_incendios',
    nombre: 'Brigada contra incendios',
    descripcion:
      'Conformada por docentes que tengan conocimiento del tema o la IE abrirá espacios de capacitación para ellos; mínimo un docente por sede y jornada.',
    funciones: [
      'Capacitarse en el manejo de elementos de seguridad y contra incendios.',
      'Tener plenamente identificados los lugares donde se encuentran ubicados los extintores según su uso, además de verificar su vigencia e informar novedades que se presenten.',
      'Informar novedades al líder de gestión del riesgo cuando se identifiquen elementos, eventos o aspectos de infraestructura que puedan representar riesgo de conato de incendio o electrocución en cada sede.',
      'Identificar de forma rápida el conato de incendio, dar alerta y/o activar alarma para evacuación segura si se requiere.',
      'Atender de forma ágil el conato de incendio siempre que esté a su alcance; de lo contrario debe activar alerta a organismos de apoyo del corregimiento de forma rápida y oportuna.',
    ],
    integrantes: [
      { nombre: 'Juan Carlos Vargas', sede: 'central', jornada: 'manana', docenteId: 'yoguis' },
      { nombre: 'Jhon Fredy García', sede: 'central', jornada: 'tarde', docenteId: 'fredy_garcia' },
      { nombre: 'Dolly Gutiérrez Guevara', sede: 'gustavo_rodas', jornada: 'tarde' },
      { nombre: 'María Victoria Henao', sede: 'gustavo_rodas', jornada: 'manana' },
      { nombre: 'Margarita Bedoya', sede: 'la_finquita', jornada: 'manana' },
      { nombre: 'Paula Andrea Zapata', sede: 'la_finquita', jornada: 'tarde' },
    ],
  },
  {
    id: 'transito_movilidad',
    nombre: 'Brigada de tránsito y movilidad',
    descripcion:
      'Conformada por docentes que tengan conocimiento del tema o la IE abrirá espacios de capacitación para ellos; mínimo un docente por sede y jornada.',
    funciones: [
      'Identificar las amenazas, riesgos y vulnerabilidad relacionadas con el tránsito y la movilidad en el sector de cada sede e informar al líder de gestión del riesgo.',
      'Proponer alternativas de mitigación del riesgo de atropello vehicular y/o estampida por la movilidad o en caso de evacuación.',
      'Sensibilizar de forma permanente a la comunidad educativa y aledaña frente a los riesgos con el tránsito vehicular y solicitar señalización a entidades competentes y a Rectoría.',
      'Actuar de forma consciente y adecuada según el plan de gestión del riesgo cuando se presenta una emergencia y se deba evacuar la IE hacia el exterior de la misma.',
      'Identificar los sitios donde se encuentra la señalización móvil de pare y siga, facilitando su acceso y uso.',
    ],
    integrantes: [
      { nombre: 'Claudia Patricia Henao', sede: 'central', jornada: 'manana', docenteId: 'claudia' },
      { nombre: 'Harold Meyit Gómez Lopera', sede: 'central', jornada: 'tarde', docenteId: 'harol' },
      { nombre: 'Beatriz Elena Zapata', sede: 'gustavo_rodas', jornada: 'tarde' },
      { nombre: 'Lourdes Uparella', sede: 'gustavo_rodas', jornada: 'manana' },
      { nombre: 'Mary Luz Hoyos', sede: 'la_finquita', jornada: 'manana' },
      { nombre: 'Leidy Viviana Zapata', sede: 'la_finquita', jornada: 'tarde' },
      { nombre: 'Luis Ángel Quiceno Quiceno', sede: 'central', jornada: 'nocturna', docenteId: 'luis_angel' },
      { nombre: 'Personal de aseo', sede: 'todas', jornada: 'ambas' },
      { nombre: 'Beatriz Marín Marín', sede: 'gustavo_rodas', jornada: 'ambas' },
      { nombre: 'Milena Badel', sede: 'gustavo_rodas', jornada: 'ambas' },
    ],
  },
  {
    id: 'apoyo_inmediato',
    nombre: 'Brigada de apoyo inmediato a brigadistas de base',
    descripcion:
      'Conformada por personal no docente que labora en cada sede o se encuentre presente en la misma en caso de emergencia o simulacro.',
    funciones: [
      'Conocer de forma amplia el plan de atención de emergencias de cada sede para servir de apoyo efectivo en la evacuación reemplazando al brigadista de base (primeros auxilios, incendios, tránsito) en el momento que pueda presentarse una emergencia o simulacro.',
      'Identificar en cada jornada y sede a los docentes que pertenecen a brigadas diferentes a evacuación, para reemplazarlos en esta función cuando se requiera y se esté presente en ese momento en la sede en caso de emergencia o simulacro.',
      'Nota: el apoyo podrá prestarlo solo en caso de no ser brigadista de evacuación en ese momento.',
    ],
    integrantes: [
      { nombre: 'John Alexander Sánchez', sede: 'todas', jornada: 'ambas', docenteId: 'alexander', nota: 'Docente orientador' },
      { nombre: 'Paula González', sede: 'todas', jornada: 'ambas', nota: 'Psicóloga EEP' },
      { nombre: 'Karen Bohórquez', sede: 'todas', jornada: 'ambas', nota: 'Profesional de apoyo UAI' },
      { nombre: 'Paola Andrea Vélez', sede: 'central', jornada: 'ambas', nota: 'Auxiliar administrativa' },
      { nombre: 'Adrián', sede: 'central', jornada: 'ambas', nota: 'Auxiliar administrativa' },
      { nombre: 'Yaneth Hurtado', sede: 'central', jornada: 'ambas', nota: 'Auxiliar administrativo' },
      { nombre: 'Janneth Ocampo', sede: 'central', jornada: 'manana', docenteId: 'coord_manana', nota: 'Coordinadora — Principal/GRI' },
      { nombre: 'Janneth Ocampo', sede: 'gustavo_rodas', jornada: 'manana', docenteId: 'coord_manana', nota: 'Coordinadora — Principal/GRI' },
      { nombre: 'Juan Diego Salazar', sede: 'central', jornada: 'tarde', docenteId: 'coord_tarde', nota: 'Coordinador — Principal/Sede Finca' },
      { nombre: 'Juan Diego Salazar', sede: 'la_finquita', jornada: 'tarde', docenteId: 'coord_tarde', nota: 'Coordinador — Principal/Sede Finca' },
      { nombre: 'Personal de aseo', sede: 'todas', jornada: 'ambas', nota: 'Aseadoras — sede y jornada de turno' },
      { nombre: 'Personal de PAE', sede: 'todas', jornada: 'ambas', nota: 'Manipuladoras PAE — sede y jornada' },
      { nombre: 'Martha Isabel Granda', sede: 'central', jornada: 'ambas', nota: 'Bibliotecaria' },
      { nombre: 'Yuri Catalina Gómez', sede: 'central', jornada: 'ambas', docenteId: 'yuri', nota: 'Docente PTA' },
    ],
  },
];

/** Todas las pertenencias (líder y/o brigadista) de un docente dado su docenteId. */
export function brigadasDeDocente(docenteId: string): Array<{ brigada: Brigada; integrante: IntegranteBrigada }> {
  const resultado: Array<{ brigada: Brigada; integrante: IntegranteBrigada }> = [];
  for (const brigada of BRIGADAS) {
    for (const integrante of brigada.integrantes) {
      if (integrante.docenteId === docenteId) resultado.push({ brigada, integrante });
    }
  }
  return resultado;
}

/** Roles de líder de gestión del riesgo de un docente. */
export function liderazgosDeDocente(docenteId: string): IntegranteBrigada[] {
  return LIDERES_GESTION_RIESGO.filter(l => l.docenteId === docenteId);
}
