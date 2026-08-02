# Módulo del Día Escolar — diseño

## Origen

Este documento nace de cuatro situaciones reales que Julián vivió en el colegio
(julio 2026) y de su conclusión: el editor de horario y el acortamiento de
jornada no deberían ser dos herramientas sueltas, sino **un solo módulo con más
músculo**.

1. **La actividad con los onces.** Un viernes, las dos últimas horas, tres
   docentes debían acompañar una actividad. La app reorganizó bien a quienes
   quedaban descubiertos, pero **Ledis nunca se enteró**: a ella no había que
   moverla —su grupo iba a la actividad y ella lo acompañaba—, así que el sistema
   no tuvo nada que anunciar.
2. **Reunir docentes.** Los coordinadores buscan a mano cuándo reunir a los
   directores de noveno o al área de matemáticas.
3. **Reuniones entre jornadas.** Con los bloques reales, el único punto de
   contacto es la frontera (6.ª de la mañana + 1.ª de la tarde), y eso estira la
   jornada de alguien.
4. **El día de horario especial.** Se acortaron las horas y se decidió **un solo
   descanso de 30 minutos** en vez de los dos habituales.

## El diagnóstico

Las cuatro son **la misma operación**: algo consume tiempo docente y obliga a
reorganizar el día. Solo cambian los parámetros.

| | Quién falta | Quién decide la hora | Estructura del día |
|---|---|---|---|
| Ausencia | Un docente, todo el día | — | Normal |
| Actividad | Varios, unas horas | El humano | Normal |
| Reunión | Varios, unas horas | **El sistema propone** | Normal |
| Jornada especial | Nadie | — | **Alterada** |

### Lo que el modelo actual no sabe expresar

Verificado en el código, no supuesto:

- **Los descansos están fijos.** `recalcularBloquesAcortados` codifica 20 minutos
  tras el 2.º bloque y 10 tras el 4.º. No hay forma de decir "un solo descanso de
  30 minutos". La situación 4 no es un ajuste: es una capacidad inexistente.
- **No existe el "acompañante".** Un docente solo puede estar reubicado,
  eliminado o en su sitio. No hay estado "va con el grupo a otra cosa".
- **No existe la deuda horaria.** "Negociar con el profesor" no queda registrado.
- **No se sabe cuántas horas seguidas trabaja un docente**, así que no se pueden
  respetar sus seis horas continuas.
- **El sistema nunca propone un momento**; solo reorganiza uno ya dado.

## Reglas de oro

**1. Todo cambio es de un solo día.** El horario base (`horarioBase.ts`) **nunca**
se modifica. Un cambio temporal que se filtre al horario permanente es la peor
equivocación posible de este módulo, porque nadie la nota hasta que es tarde.

**2. La agenda sugiere, el coordinador decide.** Nunca se deriva el horario de la
agenda automáticamente. El caso que lo demuestra: la agenda dice "8:00 a 12:00",
pero si la actividad es en MOVA, el docente **no llega al colegio en todo el
día**. El dato literal es correcto y la conclusión automática sería falsa.

**3. Aprueba el coordinador** de la jornada.

## Criterio de optimización

**Minimizar las sesiones de clase perdidas por los grupos.** Todas las
asignaturas pesan igual: no hay privilegio de matemáticas sobre artística. El
ideal es que cada grupo reciba sus seis sesiones.

Se mide en **sesiones, no en minutos**. Un día acortado no cuenta como pérdida:
la clase se dio, más corta. Es más simple y se parece a como lo piensa un
docente.

### Grupo sin clase ≠ grupo en actividad

Distinción imprescindible. Si un grupo se queda sin docente por una reunión de
área, **eso es pérdida**. Si el grupo está en una actividad institucional
acompañado por su docente, **no lo es**: no están desescolarizados.

Sin esta distinción el sistema evitaría programar actividades tanto como
reuniones, y son cosas distintas.

### Criterios de desempate

Cuando dos opciones cuestan lo mismo en sesiones perdidas:

1. Menor pérdida acumulada del grupo afectado (ver Histórico).
2. Menor pérdida acumulada de ese día de la semana.
3. Evitar los bloques de Centro de Interés (martes B6 mañana / B1 tarde).
4. Evitar mover a docentes mixtos fuera de su jornada habitual de ese día.

## Modelo de datos

### `EventoDia`

Reemplaza y absorbe `HorarioModificado` y `JornadaReducida`.

```ts
type TipoEvento = 'ausencia' | 'actividad' | 'reunion' | 'jornada_especial';

interface EventoDia {
  id: string;
  fecha: string;              // YYYY-MM-DD — siempre un solo día
  jornadas: Array<'manana' | 'tarde'>;   // puede tocar las dos
  tipo: TipoEvento;
  motivo: string;
  estado: 'borrador' | 'aprobado';
  creadoPor: string;
  aprobadoPor?: string;

  // Quién no está disponible y en qué bloques
  ausentes: Array<{ docenteId: string; bloques: number[] | 'dia_completo' }>;

  // NUEVO: no se mueven, pero van con el grupo. Se les avisa.
  acompanantes: Array<{ docenteId: string; grupo: string; bloques: number[] }>;

  // NUEVO: estos grupos NO cuentan como desescolarizados
  gruposEnActividad: Array<{ grupo: string; bloques: number[] }>;

  // Solo para jornada_especial
  estructura?: {
    horaInicio: string;
    horaFin: string;
    numBloques: number;
    descansos: Array<{ despuesDe: number; duracion: number }>;  // configurable
  };

  fichas: FichaColocada[];    // el resultado de la reorganización
  timestamp: string;
}
```

El cambio clave frente a hoy: `acompanantes`, `gruposEnActividad` y
`estructura.descansos` configurable.

### `DeudaHoraria`

```ts
interface DeudaHoraria {
  id: string;
  docenteId: string;
  sesiones: number;           // positivo: se le debe; negativo: debe él
  fecha: string;              // cuándo se generó
  eventoId: string;           // qué la originó
  motivo: string;
  estado: 'pendiente' | 'compensada';
  compensadaEn?: string;
  nota?: string;
}
```

Sin este registro, "se negocia con el profesor" queda en un mensaje que nadie
audita después.

### `PerdidaGrupo` (histórico)

Derivable de los eventos, pero se materializa para poder consultarlo rápido.

```ts
interface PerdidaGrupo {
  grupo: string;
  fecha: string;
  diaSemana: string;
  sesionesEsperadas: number;
  sesionesRecibidas: number;
  causa: 'ausencia' | 'reunion' | 'actividad' | 'jornada_especial' | 'festivo';
  eventoId?: string;
}
```

Los festivos salen de la agenda semanal, que ya los trae (`DiaAgenda.festivo`).

## Almacenamiento — sin tocar el Apps Script

**Hallazgo importante:** la hoja `EditorSync` ya es un sobre genérico. Sus
columnas son `id`, `tipo`, `fecha`, `jornada`, `estado`, `json`, `timestamp`, y
`getSyncEditor()` devuelve **todas** las filas sin filtrar por tipo. Hoy solo se
usan dos tipos: `modificacion` y `jornada`.

Por lo tanto los tipos nuevos —`evento`, `deuda`, `perdida`— **caben sin una sola
acción nueva en el backend**. Este módulo completo no requiere redesplegar el
Apps Script.

Migración: los registros existentes de tipo `modificacion` y `jornada` se siguen
leyendo; los nuevos se escriben como `evento`. No se convierte nada
retroactivamente.

## El buscador de reuniones

**Entrada:** el coordinador elige **quiénes** y **cuántas sesiones dura**. El
sistema propone **qué día y a qué hora**.

**Espacio de búsqueda:** 5 días × 6 bloques = 30 casillas por jornada. Con una
duración de N bloques, hay `5 × (6 − N + 1)` candidatos. Para N=2 son 25. Es un
espacio diminuto: se evalúan todos por fuerza bruta, sin heurísticas ni
aproximaciones.

**Costo de cada candidato:** por cada docente convocado y cada bloque de la
reunión, si tiene clase con un grupo, ese grupo pierde una sesión — salvo que
quede cubierto o esté en actividad.

**Salida:** las mejores opciones ordenadas por costo, cada una con el desglose
(qué grupo pierde qué) y **el horario ya reorganizado**, listo para aprobar.

### Restricciones que debe respetar

- La jornada de cada docente ese día (`MIXTOS_TARDE` para los mixtos).
- Los bloques de CI del martes.
- Que no se supere la carga continua del docente.
- Los eventos ya aprobados para esa fecha.

## Fases

**Fase 1 — Unificación.** `EventoDia` absorbe el editor y el acortamiento.
Acompañantes y descansos configurables. *Resuelve las situaciones 1 y 4, que son
fallos vividos.*

**Fase 2 — Histórico.** `PerdidaGrupo` y su consulta. Es barato y habilita los
desempates y el veto por acumulado.

**Fase 3 — Buscador de reuniones.** La pieza pesada. *Resuelve la situación 2.*

**Fase 4 — Deuda horaria.** Registro, consulta y compensación.

**Fase 5 — Agenda estructurada.** Campos opcionales `docentes[]`, `grupos[]` y
`bloques[]` en las actividades de la agenda, para que el sistema pueda
**sugerir** eventos. Implica trabajo adicional en la transcripción de cada
viernes: hay que marcar esos tres datos en las actividades que afecten clases.
El sistema puede proponer la correspondencia y el humano confirma.

### Fuera de alcance por ahora

**Cambiar un día por otro** (dictar el horario del viernes un jueves). Es la idea
más potente, pero arrastra demasiados cabos: los mixtos cambian de jornada, el CI
viaja con el día, no se sabe qué acompañamientos aplican y las tareas programadas
quedan huérfanas. Además **necesita el histórico funcionando antes**, porque sin
él no se sabe qué día conviene recuperar.

**Negociación completa entre jornadas.** El buscador propondrá el horario
frontera, pero las opciones de compensar el mismo día frente a generar deuda se
dejan para cuando el registro de deuda lleve tiempo en uso.

## Auditoría del propio diseño

Debilidades que encontré revisando esto antes de escribir código:

**Composición de eventos el mismo día.** Si hay una ausencia aprobada y luego se
crea una reunión para esa fecha, el segundo evento debe partir del horario **ya
modificado** por el primero, no del base. Hoy nada lo impide ni lo contempla. Es
el error más probable de toda la fase 3.

**Los acompañamientos se rompen en silencio.** Con un solo descanso de 30
minutos, los 60 turnos repartidos por lugar y por descanso dejan de tener
sentido. El módulo debe avisarlo; no puede reasignarlos solo.

**La reunión necesita un aula, y la app ya sabe reservar.** Lo natural es que al
aprobar se cree la reserva del espacio. Hoy son dos mundos separados y el diseño
no los une todavía.

**El aviso por docentes mixtos debe ser específico.** No "cuidado con los
mixtos", sino "Marta trabaja el martes en la tarde; esto le cambia la jornada,
háblalo con ella antes de aprobar". Un aviso genérico se ignora a la tercera vez.

**Las tareas ya programadas quedan descuadradas** si un grupo pierde sesiones: el
cupo de esa semana asume clases que no ocurrieron.

**Las familias quedan fuera.** Si la jornada se acorta, los estudiantes salen
antes, y eso hay que comunicarlo fuera del colegio. La app solo habla hacia
adentro.

**El histórico necesita el calendario.** Para contar bien hay que saber qué días
fueron festivos. La agenda los trae, pero solo la de la semana en curso: no hay
histórico de agendas anteriores. Si se quiere el acumulado del año, hay que
empezar a guardarlas.

**Aprobación entre jornadas sin definir.** Si una reunión toca las dos jornadas,
¿aprueban los dos coordinadores, o basta uno? Queda abierto.

**Lo que el sistema nunca sabrá:** si esa reunión de verdad requiere a los cuatro
docentes o si con tres basta. La máquina propone, la coordinadora decide.
