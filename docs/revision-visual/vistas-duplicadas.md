# Vistas duplicadas y conmutadores de vista

Revisión solo de lectura de `src/**` (incluida `src/asistencia`). Fecha: 2026-10-25.

## En una frase

La app tiene 6 conmutadores distintos para cambiar la forma de ver algo (Día/Semana, Cuadro/Análisis...), cada uno hecho a su manera. Y hay sitios donde la MISMA información sale de dos formas sin avisar. Falta un patrón único: «Ver: [matriz] [lista]».

## A. La misma información, dos formas distintas

| # | Dónde (archivo:línea) | Información | Forma 1 | Forma 2 | Quién lo ve | ¿Unificar? |
|---|---|---|---|---|---|---|
| A1 | `App.tsx:307` (NavDropdown) y `PanelInicio.tsx:370` (MatrizMenu) | Las secciones de la app | Menú desplegable del encabezado (por dentro ya usa la matriz de 3 columnas, `NavDropdown.tsx:109`) | Baldosas grandes en Inicio (6 más usadas + «Ver todo») | Todos los roles | SÍ. Caso estrella. Conmutador «Ver: matriz / lista» en Inicio y en el menú |
| A2 | `asistencia/index.tsx:2291` (Pestanas) | Secciones de Asistencia | Fila de pastillas que se parte en varias líneas | Al entrar a un grupo, otra fila de pastillas distinta (`hayPestanasGrupo`, línea 415) | Docente, coordinación | PARCIAL. Una sola fila con desplazamiento o matriz/lista |
| A3 | `components/DisponibilidadGrid.tsx:293` y `:472` | Reservas: día y tipo de recurso | Pastillas de día con scroll lateral y pestañas Aulas/Espacios/Equipos | Cuadrícula de todos los días en pantalla ancha | Docentes, coordinación | SÍ. «Ver: por día / semana» con el mismo conmutador |
| A4 | `asistencia/MisGrupos.tsx:101` | Grupos del docente | Tarjetas por grado/cruce | No hay lista compacta | Docente, coordinación | SÍ cuando hay muchos grupos: tarjetas / lista |
| A5 | `components/SelectorSede.tsx:28` y `:73` | Sede activa | Pantalla completa tras el login | Pastilla en el encabezado | Directivos | NO. Son dos momentos, no dos vistas |
| A6 | `components/VistaHorario.tsx:1444` | Modo del horario (docente, grupo, aulas, acompañamiento) | Pastillas | Selector de docente/grupo dentro de cada modo | Todos | NO. No es lo mismo dicho dos veces |
| A7 | `asistencia/PanoramaAlerta.tsx:127-140`, `AlertaCoordinacion.tsx:370,472`, `SelectorJornada.tsx:31` | Sede, jornada, periodo | Lista desplegable (`select`) | En otras pantallas esos filtros van en pastillas (`Planilla.tsx:380`) | Coordinación | A MEDIAS: pocas opciones (2 a 4) en pastillas; muchas en lista desplegable |

## B. Conmutadores que ya existen (y no son iguales)

| # | Archivo:línea | Opciones | Cómo está hecho | Problemas |
|---|---|---|---|---|
| B1 | `asistencia/ReporteAlerta.tsx:126` | Cuadro / Análisis | Grupo con borde, `aria-pressed`, 40 px | El mejor hecho. Sin ícono ni «Ver:»; no recuerda la elección |
| B2 | `components/AgendaSemanal.tsx:253` | Semana / Día | Caja con fondo, sin `aria-pressed`, unos 30 px | Orden «Semana, Día» |
| B3 | `components/AgendaGrupo.tsx:285` | Día / Semana | Pastillas sueltas, sin `aria-pressed`, unos 30 px | Orden inverso a B2 y otra forma, para la misma idea |
| B4 | `components/VistaHorario.tsx:359` y `:639` | Semana / Día | `TabButton` propio | Tercera forma. Arranca en día para docente y en semana para grupo |
| B5 | `components/planCasa/VistaPlanCasa.tsx:34` | Planes / Mis guías | Grupo con borde, 36 px, sin `aria-pressed` | Bajo el mínimo táctil de 44 px |
| B6 | `components/calendarioAcademico/CalendarioAcademico.tsx:116` | Próximo / Lo que falta / Mes | Pastillas a todo el ancho, sin `aria-pressed` | Otra forma más |
| B7 | `asistencia/AlertaAcademica.tsx:280` | Recuadro con foto / Toque directo | Grupo de 2, `aria-pressed`, 44 px | Único que recuerda la preferencia (`guardarModo`) |
| B8 | `asistencia/LlegadasTarde.tsx:396`, `AlertaCoordinacion.tsx:872` | Modo hall/individual; forma de citar | Tarjetas `role=tab` / pastillas | Son modos de trabajo, NO vistas. No tocar |

Conclusión: 6 conmutadores de «forma de ver» (B1 a B6) con 6 diseños; 4 sin `aria-pressed`, 4 por debajo de 44 px; solo B7 recuerda la elección.

## C. Listas de navegación en pastillas que se desbordan

| # | Archivo:línea | Qué es | Problema | Recomendación |
|---|---|---|---|---|
| C1 | `components/PanelAdmin.tsx:72` | Pestañas del coordinador (Pendientes, Hoy, Historial, Horario del J, Configuración) | Scroll lateral sin pista; la última queda fuera | Es navegación: matriz/lista |
| C2 | `asistencia/index.tsx:2291` | 7 u 8 secciones de Asistencia | Se parte en 2 o 3 líneas | Matriz/lista con el conmutador |
| C3 | `components/DisponibilidadGrid.tsx:293` | Días de la semana | Scroll lateral | Aceptable; ayudaría un botón «Hoy» |
| C4 | `calendarioAcademico/CalendarioAcademico.tsx:102` | Categorías del calendario | Scroll lateral | Aceptable (son filtros) |
| C5 | `EditorHorarioMode.tsx:370`, `acompanamientos/EditorManualAcompanamientos.tsx:539` | Fichas de espera | Scroll lateral | Herramienta de arrastre; dejar |
| C6 | `asistencia/Planilla.tsx:380`, `PlanillaCentro.tsx:754` | Barra de acciones | Scroll lateral | Revisar que se note que hay más |

## D. Especificación de `SelectorVista`

- Archivo: `src/components/SelectorVista.tsx`.
- Aspecto: «Ver:» + dos botones con ícono `LayoutGrid` (matriz) y `List` (lista) de lucide; texto corto al lado del ícono en pantallas anchas.
- Tamaño: cada botón de 44 px de alto como mínimo; el grupo cabe en 375 px de ancho.
- Recibe: `valor` (matriz o lista), `onCambio`, `clave` (nombre de la pantalla para recordar) y, opcional, `opciones` propias (por ejemplo día/semana con sus íconos).
- Accesibilidad: `role="group"` con `aria-label="Cambiar la forma de ver"`; cada botón con `aria-pressed` y `aria-label` («Ver en matriz»); el activo se distingue además del color (relleno y borde).
- Memoria: `localStorage`, clave `mjb.vista.<pantalla>`, dentro de try/catch (si falla, funciona igual sin recordar). Preferencia por pantalla y por dispositivo.
- Estilo: el de `ReporteAlerta.tsx:126`, con los tokens de tema claro y oscuro.
- Orden fijo: matriz primero, lista después. Para tiempo, siempre «Día, Semana».
- Regla de uso: solo cuando la MISMA información cabe de las dos formas. Los modos de trabajo (B8) y los filtros no lo usan.

## E. Recomendación priorizada

1. Crear `SelectorVista` y migrar B1 (sirve de molde) para validarlo. Esfuerzo bajo.
2. A1, Inicio y menú: «Ver: matriz / lista». La matriz por defecto; la lista es el menú vertical de siempre. Deja de parecer que son dos cosas. Es lo que más nota Julián.
3. C1 y C2, PanelAdmin y Asistencia: navegación de sección con el mismo conmutador, sin desborde oculto.
4. Unificar Día/Semana (B2, B3, B4) en un solo componente, mismo orden, 44 px y `aria-pressed`.
5. A3, Reservas: «Ver: por día / semana».
6. A4, grupos: tarjetas / lista compacta cuando hay más de 6 grupos.
7. A7, B5, B6: homogeneizar filtros y subir a 44 px. Bajo riesgo.

Dejar sin tocar: A5, A6, B8, C3 a C5.

## Notas

- Las líneas pueden desplazarse si otra sesión edita esos archivos.
- Total: 7 casos de duplicación (A), 8 conmutadores (B), 6 desbordes (C).
