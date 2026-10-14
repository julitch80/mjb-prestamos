// Brigadas de gestión del riesgo — transcritas de la Resolución Rectoral
// N.º 06 de 2026 (versión final firmada, expedida el 10 de junio de 2026), "Por medio de la cual se
// conforman y reglamentan las Brigadas Escolares para la Prevención,
// Preparación y Respuesta ante Emergencias en la Institución Educativa
// Manuel J. Betancur". Reemplaza a la Resolución N.º 33 de 2023.
//
// Mapeo de sedes del documento → SedeId:
//   'Sede Principal'                → 'central'
//   'Sede Gustavo Rodas Isaza'      → 'gustavo_rodas'
//   'Sede La Finca'                 → 'la_finquita'

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
  numero: 6,
  fecha: '2026-06-10',
  titulo: 'Resolución Rectoral N.º 06 de 2026 — Conformación y reglamentación de las brigadas escolares',
};

// ── Líderes de gestión del riesgo (Artículo 4; La Finca: Artículo 12) ───────

export const LIDERES_GESTION_RIESGO: IntegranteBrigada[] = [
  // Comité Escolar de Gestión del Riesgo (directivos docentes)
      { nombre: 'Nancy Adriana Herrera López', sede: 'todas', jornada: 'ambas', docenteId: 'rectora', nota: '  ' },
      { nombre: 'Juan Diego Salazar Rendón', sede: 'la_finquita', jornada: 'tarde', docenteId: 'coord_tarde', nota: '  ' },
      { nombre: 'Janeth Astrid Ocampo Carvajal', sede: 'gustavo_rodas', jornada: 'manana', docenteId: 'coord_manana', nota: '  ' },
      { nombre: 'Julián David Medina Tamayo', sede: 'todas', jornada: 'ambas', docenteId: 'julian', nota: 'Docente AM' },
      { nombre: 'Gloria Yaneth Gallego Rendón', sede: 'todas', jornada: 'ambas', docenteId: 'fin_gloria', nota: 'Docente AM' },

  // Docentes líderes: Sede Principal y Gustavo Rodas (Art. 4) y La Finca (Art. 12)
      { nombre: 'Carlos Alberto Cárdenas', sede: 'central', jornada: 'manana', docenteId: 'carlos', nota: '  ' },
      { nombre: 'Hugo Armando Yepes', sede: 'central', jornada: 'tarde', docenteId: 'hugo', nota: '  ' },
      { nombre: 'Leidy Yadira Atehortúa', sede: 'gustavo_rodas', jornada: 'manana', docenteId: 'gri_leidy_a', nota: '  ' },
      { nombre: 'Dolly Gutiérrez Guevara', sede: 'gustavo_rodas', jornada: 'tarde', docenteId: 'gri_dolly', nota: '  ' },
      { nombre: 'Paula Andrea Zapata Martínez', sede: 'la_finquita', jornada: 'tarde', docenteId: 'fin_paula', nota: '  ' },
];

// ── Brigadas (Artículos 5 a 12) ───────────────────────────────────────────────
// Ningún brigadista ejecuta funciones operativas simultáneas (Art. 3):
// Fase 1 todos evacúan; Fase 2 se activan las funciones especializadas.
// La Finca no tiene brigadas separadas: sus docentes forman la Brigada Integral.

export const BRIGADAS: Brigada[] = [
  {
    id: 'evacuacion',
    nombre: 'Brigada de evacuación',
    descripcion:
      'Integrada por todos los docentes, directivos docentes y profesionales de apoyo a cargo de un grupo de estudiantes al momento de una emergencia o simulacro (deber de todo el personal en aula, figure o no en el listado). Los relacionados aquí son Líderes de Evacuación de bloque o piso en la Sede Gustavo Rodas Isaza y en la Sede Principal. La Sede La Finca se rige por la Brigada Integral. La docente Doris Castrillón Álvarez (Sede Principal) requiere acompañamiento por movilidad reducida: el Líder de Evacuación del bloque asigna a un integrante de la Brigada de Apoyo Inmediato para acompañarla hasta el punto de encuentro.',
    funciones: [
      'Evacuar el aula, conducir al grupo por la ruta señalizada hasta el punto de encuentro y verificar allí el conteo completo de los estudiantes: deber inherente e ineludible de todo el personal en aula, figure o no en el listado.',
      'Verificar que ningún salón, baño o área común de su bloque o piso quede rezagado durante la evacuación.',
      'Reportar el estado de su sector al Puesto de Mando Unificado o a quien haga sus veces.',
      'Conocer el plan de atención de emergencias de la sede, las rutas de evacuación, la señalización y los puntos de encuentro.',
      'Adelantar de forma permanente con sus estudiantes la sensibilización frente a la prevención de riesgos y a la importancia de conservar la calma.',
      'Parágrafo: en cada sede se nombra un líder por jornada (Líder AM / Líder PM); ellos conforman la brigada principal de evacuación y toman las decisiones que orienten a los brigadistas de la sede.',
      'Reportar al líder de gestión del riesgo de la sede la ausencia de cualquier estudiante en el punto de encuentro, para activar la brigada que corresponda.',
      'En caso de sismo, conservar la calma durante los primeros cuarenta (40) segundos y hacer que el grupo adopte una posición segura sin salir del aula. La evacuación se realiza al escuchar la alarma; no obstante, si dentro de esos primeros segundos se presentan fisuras estructurales o caída de objetos peligrosos, se evacúa de forma controlada aun sin alarma.',
      'Mantener la puerta del aula abierta durante toda la jornada. Las puertas de las tres sedes no cuentan con dispositivos de apertura hacia afuera, por lo que esta medida es de obligatorio cumplimiento.',
    ],
    integrantes: [
      { nombre: 'Leidy Yadira Atehortúa Rojas', sede: 'gustavo_rodas', jornada: 'manana', docenteId: 'gri_leidy_a', nota: 'Líder AM' },
      { nombre: 'María Victoria Henao Toro', sede: 'gustavo_rodas', jornada: 'manana', docenteId: 'gri_maria_v' },
      { nombre: 'Lourdes Uparela Imbeth', sede: 'gustavo_rodas', jornada: 'manana', docenteId: 'gri_lourdes' },
      { nombre: 'Jaqueline Arévalo Alzate', sede: 'gustavo_rodas', jornada: 'manana', docenteId: 'gri_jaqueline' },
      { nombre: 'Edison Alejandro Sánchez Ángel', sede: 'gustavo_rodas', jornada: 'manana', docenteId: 'gri_edison' },
      { nombre: 'Sandra García García', sede: 'gustavo_rodas', jornada: 'tarde', docenteId: 'gri_sandra' },
      { nombre: 'Edwin Alexis Toro', sede: 'gustavo_rodas', jornada: 'tarde', docenteId: 'gri_edwin' },
      { nombre: 'Delcy Johana Rivera', sede: 'gustavo_rodas', jornada: 'tarde', docenteId: 'gri_johana_r' },
      { nombre: 'Leonardo Acevedo Suárez', sede: 'gustavo_rodas', jornada: 'tarde', docenteId: 'gri_leonardo' },
      { nombre: 'Diego Alejandro Mejía Merino', sede: 'gustavo_rodas', jornada: 'tarde', docenteId: 'gri_diego' },
      { nombre: 'Dolly Marley Gutiérrez Guevara', sede: 'gustavo_rodas', jornada: 'tarde', docenteId: 'gri_dolly', nota: 'Líder PM' },
      { nombre: 'Beatriz Elena Zapata Vásquez', sede: 'gustavo_rodas', jornada: 'tarde', docenteId: 'gri_beatriz_z' },
      { nombre: 'Jorge Iván Acevedo Tabares', sede: 'central', jornada: 'manana', docenteId: 'jorge' },
      { nombre: 'Juan Carlos Blandón Vargas', sede: 'central', jornada: 'manana', docenteId: 'yoguis' },
      { nombre: 'Gloria Estella Álvarez López', sede: 'central', jornada: 'manana', docenteId: 'gloria_a' },
      { nombre: 'Adolfo León Arango Arroyave', sede: 'central', jornada: 'manana', docenteId: 'adolfo' },
      { nombre: 'Carlos Alberto Cárdenas', sede: 'central', jornada: 'manana', docenteId: 'carlos', nota: 'Líder AM' },
      { nombre: 'Leidy Johana Cano Ruiz', sede: 'central', jornada: 'manana', docenteId: 'johana' },
      { nombre: 'Mónica Tatiana Córdoba Zapata', sede: 'central', jornada: 'manana', docenteId: 'monica_c' },
      { nombre: 'Claudia Patricia Henao Bermúdez', sede: 'central', jornada: 'manana', docenteId: 'claudia' },
      { nombre: 'Julián David Medina Tamayo', sede: 'central', jornada: 'manana', docenteId: 'julian' },
      { nombre: 'Margarita María Montoya Olaya', sede: 'central', jornada: 'manana', docenteId: 'margara' },
      { nombre: 'Beatriz Elena Montoya Valdés', sede: 'central', jornada: 'manana', docenteId: 'beatriz' },
      { nombre: 'José Uriel López', sede: 'central', jornada: 'manana', docenteId: 'uriel' },
      { nombre: 'Ledis Laura Quintana Seguanes', sede: 'central', jornada: 'manana', docenteId: 'ledis' },
      { nombre: 'Martha Lucía Úsuga', sede: 'central', jornada: 'manana', docenteId: 'marta' },
      { nombre: 'Luis Javier Rojas García', sede: 'central', jornada: 'tarde', docenteId: 'luis_javier' },
      { nombre: 'Julieth Carolina Medina', sede: 'central', jornada: 'tarde', docenteId: 'carolina' },
      { nombre: 'Juan Pablo Bettin Tapia', sede: 'central', jornada: 'tarde', docenteId: 'juan_pablo' },
      { nombre: 'Víctor Giraldo', sede: 'central', jornada: 'tarde' },
      { nombre: 'Edgar Alexis Pérez', sede: 'central', jornada: 'tarde', docenteId: 'edgar' },
      { nombre: 'Jonathan Felipe Piedrahíta Nieto', sede: 'central', jornada: 'tarde', docenteId: 'felipe' },
      { nombre: 'Mónica Alexandra Rave Velásquez', sede: 'central', jornada: 'tarde', docenteId: 'monica_rave' },
      { nombre: 'Harol Meyid Gómez López', sede: 'central', jornada: 'tarde', docenteId: 'harol' },
      { nombre: 'Luis Ángel Quiceno', sede: 'central', jornada: 'tarde', docenteId: 'luis_angel' },
      { nombre: 'Hugo Armando Yepes Franco', sede: 'central', jornada: 'tarde', docenteId: 'hugo', nota: 'Líder PM' },
      { nombre: 'Yaneth Moscote', sede: 'central', jornada: 'tarde', docenteId: 'yanet' },
      { nombre: 'Luz Marina Zapata Vásquez', sede: 'central', jornada: 'tarde', docenteId: 'marina' },
      { nombre: 'Jhon Fredy García Arrubla', sede: 'central', jornada: 'tarde', docenteId: 'fredy_garcia' },
      { nombre: 'Valentina Jaramillo', sede: 'central', jornada: 'tarde', docenteId: 'valentina' },
    ],
  },
  {
    id: 'primeros_auxilios',
    nombre: 'Brigada de primeros auxilios',
    descripcion:
      'Docentes formados como primer respondiente de la Sede Principal y la Sede Gustavo Rodas Isaza, mínimo un integrante por sede y jornada.',
    funciones: [
      'Mantener vigente su formación como primer respondiente y aplicarla en cada evento que se presente en la sede.',
      'Activar la alerta a los organismos de apoyo cuando la atención del caso lo exija.',
      'Conocer la ubicación de los botiquines y camillas de la sede, e informar al líder de gestión del riesgo las necesidades de dotación.',
      'Valorar a los afectados, prestar los primeros auxilios con el apoyo de los estudiantes brigadistas y remitir a los servicios de salud u organismos de socorro los casos que lo ameriten, informando de su actuación al líder de gestión del riesgo de la sede, quien informa a las familias.',
      'Activar la póliza de accidentes escolares y diligenciar el formato correspondiente siempre que se remita un estudiante a un centro hospitalario o se entregue a su familia para que lo traslade.',
      'Aplicar el protocolo de relevo de custodia del artículo 8 antes de abandonar su función de evacuación para atender su función de primeros auxilios.',
    ],
    integrantes: [
      { nombre: 'Julián David Medina', sede: 'central', jornada: 'manana', docenteId: 'julian' },
      { nombre: 'Carlos Alberto Cárdenas', sede: 'central', jornada: 'manana', docenteId: 'carlos' },
      { nombre: 'Juan Pablo Bettin', sede: 'central', jornada: 'tarde', docenteId: 'juan_pablo' },
      { nombre: 'Mónica Rave', sede: 'central', jornada: 'tarde', docenteId: 'monica_rave' },
      { nombre: 'Lourdes Uparela', sede: 'gustavo_rodas', jornada: 'manana', docenteId: 'gri_lourdes' },
      { nombre: 'Dolly Marley Gutiérrez', sede: 'gustavo_rodas', jornada: 'tarde', docenteId: 'gri_dolly' },
    ],
  },
  {
    id: 'contra_incendios',
    nombre: 'Brigada contra incendios',
    descripcion:
      'Docentes formados en el manejo de equipos de extinción de la Sede Principal y la Sede Gustavo Rodas Isaza, mínimo un integrante por sede y jornada.',
    funciones: [
      'Mantener vigente su formación en el manejo de elementos de seguridad y de extinción de incendios.',
      'Tener identificados los extintores de la sede según su clase de uso, verificar su vigencia e informar las novedades que se presenten.',
      'Informar al líder de gestión del riesgo sobre elementos, eventos o condiciones de infraestructura que representen riesgo de conato de incendio o de electrocución.',
      'Identificar el conato de incendio, dar la alerta y activar la alarma de evacuación cuando se requiera.',
      'Atender el conato de incendio cuando esté a su alcance y, en caso contrario, activar de inmediato la alerta a los organismos de socorro del corregimiento.',
      'Voluntariedad y aptitud: quien manifieste temor insuperable frente al manejo directo del fuego será reasignado, dentro de la misma brigada, a funciones logísticas de bajo riesgo (corte de electricidad y gas, voz de alerta, inspección de extintores, orientación de organismos de socorro). Si el impedimento es absoluto, la Rectoría tramita su traslado y designa reemplazo, sin que la sede y jornada queden sin brigadista de incendios.',
    ],
    integrantes: [
      { nombre: 'Juan Carlos Vargas', sede: 'central', jornada: 'manana', docenteId: 'yoguis' },
      { nombre: 'Jhon Fredy García', sede: 'central', jornada: 'tarde', docenteId: 'fredy_garcia' },
      { nombre: 'María Victoria Henao', sede: 'gustavo_rodas', jornada: 'manana', docenteId: 'gri_maria_v' },
      { nombre: 'Dolly Gutiérrez Guevara', sede: 'gustavo_rodas', jornada: 'tarde', docenteId: 'gri_dolly' },
    ],
  },
  {
    id: 'transito_movilidad',
    nombre: 'Brigada de tránsito y movilidad',
    descripcion:
      'Servidores y personal de apoyo de la Sede Principal y la Sede Gustavo Rodas Isaza, mínimo un integrante por sede y jornada. Se articula al Plan Estratégico de Seguridad Vial (Ley 1503 de 2011).',
    funciones: [
      'Identificar las amenazas, riesgos y vulnerabilidades de tránsito y movilidad en el entorno de su sede e informarlas al líder de gestión del riesgo.',
      'Proponer medidas de mitigación del riesgo de atropello vehicular y de estampida en el ingreso, la salida y la evacuación.',
      'Sensibilizar de forma permanente a la comunidad educativa y al vecindario frente a los riesgos del tránsito vehicular, y solicitar la señalización requerida a las entidades competentes y a Rectoría.',
      'Actuar conforme al plan de gestión del riesgo cuando la evacuación deba dirigirse hacia el exterior de la sede.',
      'Conocer la ubicación de la señalización móvil de pare y siga y garantizar su disponibilidad y uso.',
      'El personal de las empresas contratistas de aseo y del PAE actúa como apoyo secundario y preventivo dentro del perímetro de la sede, y no asume el control del tráfico en la vía pública.',
    ],
    integrantes: [
      { nombre: 'Claudia Patricia Henao', sede: 'central', jornada: 'manana', docenteId: 'claudia', nota: 'Docente' },
      { nombre: 'Harold Meyid Gómez López', sede: 'central', jornada: 'tarde', docenteId: 'harol', nota: 'Docente' },
      { nombre: 'Luis Ángel Quiceno', sede: 'central', jornada: 'tarde', docenteId: 'luis_angel', nota: 'Docente' },
      { nombre: 'Lourdes Uparella', sede: 'gustavo_rodas', jornada: 'manana', docenteId: 'gri_lourdes', nota: 'Docente' },
      { nombre: 'Beatriz Elena Zapata', sede: 'gustavo_rodas', jornada: 'tarde', docenteId: 'gri_beatriz_z', nota: 'Docente' },
      { nombre: 'Beatriz Marín Marín', sede: 'gustavo_rodas', jornada: 'ambas', nota: 'Personal de apoyo — dos jornadas' },
      { nombre: 'Milena Badel', sede: 'gustavo_rodas', jornada: 'ambas', nota: 'Personal de apoyo — dos jornadas' },
    ],
  },
  {
    id: 'apoyo_inmediato',
    nombre: 'Brigada de apoyo inmediato a brigadistas de base',
    descripcion:
      'Personal no docente que labora en cada sede o se encuentre presente en ella al momento de una emergencia o simulacro. Ejecuta el protocolo de relevo de custodia (Art. 8): se permanece con el grupo hasta que el integrante de esta brigada llegue y asuma la supervisión.',
    funciones: [
      'Conocer el plan de atención de emergencias de cada sede para servir de apoyo efectivo en la evacuación y relevar al brigadista de base de primeros auxilios, incendios o tránsito cuando este deba activarse.',
      'Identificar, en cada jornada y sede, a los docentes que pertenecen a brigadas distintas a la de evacuación, para asumir su grupo cuando estos deban cumplir su función especializada.',
      'Ejecutar el protocolo de relevo de custodia del artículo 8, asumiendo de manera efectiva la supervisión del grupo hasta que el docente de aula retorne.',
      'Acompañar durante todo el desplazamiento al personal y a los estudiantes que requieran apoyo por movilidad reducida.',
      'Nota: el relevo solo procede cuando el integrante no se encuentre, en ese mismo momento, cumpliendo su propia función de evacuación.',
    ],
    integrantes: [
      { nombre: 'John Alexander Sánchez', sede: 'todas', jornada: 'ambas', docenteId: 'alexander', nota: 'Docente orientador' },
      { nombre: 'Natalia Rivas', sede: 'todas', jornada: 'ambas', nota: 'Psicóloga EEP' },
      { nombre: 'Diana Ramírez', sede: 'todas', jornada: 'ambas', nota: 'Profesional de apoyo UAI' },
      { nombre: 'Paola Andrea Vélez', sede: 'central', jornada: 'ambas', nota: 'Auxiliar administrativa' },
      { nombre: 'Román Serna', sede: 'central', jornada: 'ambas', nota: 'Auxiliar administrativa' },
      { nombre: 'Yaneth Hurtado', sede: 'central', jornada: 'ambas', nota: 'Auxiliar administrativo' },
      { nombre: 'Janneth Ocampo', sede: 'central', jornada: 'manana', docenteId: 'coord_manana', nota: 'Coordinadora — Sede Principal y Gustavo Rodas' },
      { nombre: 'Janneth Ocampo', sede: 'gustavo_rodas', jornada: 'manana', docenteId: 'coord_manana', nota: 'Coordinadora — Sede Principal y Gustavo Rodas' },
      { nombre: 'Juan Diego Salazar', sede: 'central', jornada: 'tarde', docenteId: 'coord_tarde', nota: 'Coordinador — Sede Principal y La Finca' },
      { nombre: 'Juan Diego Salazar', sede: 'la_finquita', jornada: 'tarde', docenteId: 'coord_tarde', nota: 'Coordinador — Sede Principal y La Finca' },
    ],
  },
  {
    id: 'integral_finca',
    nombre: 'Brigada integral — Sede La Finca',
    descripcion:
      'Régimen especial de la Sede La Finca (tres docentes por jornada, Art. 12): una única brigada con formación cruzada en evacuación, primeros auxilios y manejo de extintores. La función de Fase 2 de cada docente figura junto a su nombre.',
    funciones: [
      'Fase 1: los tres docentes de la jornada evacúan cada uno su grupo hasta el punto de encuentro y reportan el conteo al líder de gestión del riesgo de la sede. Ninguno se desplaza a su función prioritaria antes de completar ese reporte.',
      'Concluida la Fase 1, el líder de gestión del riesgo de la sede asume la custodia de todos los estudiantes en el punto de encuentro y libera a los otros dos docentes para que ejecuten su función prioritaria (sustituye aquí a la Brigada de Apoyo Inmediato).',
      'Si concurren primeros auxilios y tránsito y movilidad, prevalecen los primeros auxilios. Tránsito se activa solo si la evacuación debe ir al exterior y no hay lesionados por atender.',
      'Ante un conato de incendio que exceda la capacidad del extintor, suspender la intervención, dar la voz de alerta y activar a los organismos de socorro. No se intenta el control directo del fuego sin respaldo externo.',
      'Cuando el coordinador asignado a la sede se encuentre en ella, asume la coordinación general y releva al líder en la custodia del punto de encuentro.',
      'Todos los docentes mantienen formación cruzada en evacuación, primeros auxilios y manejo de extintores, para poder asumir la función de otro ante su ausencia.',
      'El líder informa a Rectoría toda ausencia de un docente, para redistribuir funciones. Cada sede opera al menos con un docente formado en primeros auxilios.',
    ],
    integrantes: [
      { nombre: 'Margarita María Bedoya Bedoya', sede: 'la_finquita', jornada: 'manana', docenteId: 'fin_margarita', nota: 'Fase 2: control de incendios' },
      { nombre: 'Gloria Yanet Gallego Rendón', sede: 'la_finquita', jornada: 'manana', docenteId: 'fin_gloria', nota: 'Fase 2: líder de gestión del riesgo de la sede y coordinación de la evacuación' },
      { nombre: 'Mary Luz Hoyos Hoyos', sede: 'la_finquita', jornada: 'manana', docenteId: 'fin_mary', nota: 'Fase 2: primeros auxilios y, subsidiariamente, tránsito y movilidad' },
      { nombre: 'Soraya Bodther', sede: 'la_finquita', jornada: 'tarde', docenteId: 'fin_soraya', nota: 'Fase 2: primeros auxilios' },
      { nombre: 'Leidy Viviana Zapata Corrales', sede: 'la_finquita', jornada: 'tarde', docenteId: 'fin_leidy_v', nota: 'Fase 2: tránsito y movilidad' },
      { nombre: 'Paula Andrea Zapata Martínez', sede: 'la_finquita', jornada: 'tarde', docenteId: 'fin_paula', nota: 'Fase 2: líder de gestión del riesgo de la sede y control de incendios' },
    ],
  },
  {
    id: 'porteria_vigilancia',
    nombre: 'Portería y vigilancia',
    descripcion:
      'El personal de portería, vigilancia y control de accesos de cada sede hace parte del plan de emergencias (Art. 6).',
    funciones: [
      'Suspender de inmediato el ingreso de acudientes y particulares a la sede.',
      'Abrir y asegurar la apertura total de los portones vehiculares y peatonales que sirven de ruta de salida, e impedir que permanezcan cerrados u obstruidos mientras dure la emergencia.',
      'Recibir y orientar a los organismos de socorro (Bomberos, ambulancias y Policía) desde su llegada hasta el punto donde se requiera su intervención.',
      'Informar al líder de gestión del riesgo de la sede sobre el ingreso y salida de vehículos de emergencia.',
      'Suspender el suministro de servicios públicos (gas, energía, agua) según la emergencia que responda al simulacro o al evento presentado. Para esto debe pedir apoyo inmediato de brigadista líder que supla su ausencia temporal en portería.',
      'Parágrafo: es necesario que el personal de PAE y de servicios generales conozca la ubicación de las llaves de paso de los servicios públicos, para que sean ellos quienes apoyen esta última función.',
    ],
    integrantes: [
      { nombre: 'Personal de portería, vigilancia y control de accesos', sede: 'todas', jornada: 'ambas', nota: 'Sin nombres en la resolución; cada sede' },
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
