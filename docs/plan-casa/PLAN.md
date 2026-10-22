# PLAN técnico — Plan de trabajo en casa (etapa 1)

Base: PRD.md (decisiones del 20-oct-2026). Borrador para aprobación de Julián.

## Idea
Todo vive en Firebase (Firestore + funciones), como Simulacros y el calendario académico: los
cambios se ven al instante en todos los celulares, sin Apps Script ni hojas de cálculo.

## Quién es quién
- **Equipo del plan** (UAI y orientador): una lista de correos en `planCasaConfig/equipo`, que el
  superusuario edita desde su panel. Así no hay que tocar código cuando cambie una persona.
  Al inicio: Alexander Sánchez (orientador) y las profesionales de la UAI que Julián indique.
- **Docentes:** salen de la asignación académica 2026 del grupo del estudiante.

## Datos (Firestore)
| Colección | Qué guarda | Quién lee / escribe |
|---|---|---|
| `planesCasa/{id}` | estudiante (id de asistencia, nombre, grupo), fechas, **ajustes**, tope de momentos por día, estado | Equipo y coordinación: todo. Docentes del grupo: leen sin el motivo |
| `planesCasa/{id}/reservado/motivo` | el motivo | Solo equipo y coordinación |
| `planesCasa/{id}/asignaturas/{asig}` | criterios de promoción, guía (borrador / aprobada), pasos, sustentación, seguimiento | Docente de esa asignatura escribe; equipo y coordinación leen |
| `planesCasaPublico/{token}` | copia **sin datos sensibles** de la agenda (primer nombre, pasos aprobados, fechas) | Lectura pública por token largo e imposible de adivinar; escribe solo el servidor |

El motivo vive aparte porque las reglas de Firestore protegen documentos completos, no campos.

## Piezas
| Pieza | Qué hace |
|---|---|
| Lógica pura + pruebas | Repartir pasos en días hábiles sin pasar el tope diario (sumando materias, sin festivos ni recesos del calendario académico); estados del seguimiento |
| Pantalla «Planes en casa» (equipo) | Crear plan, ajustes (lista de ajustes frecuentes + texto libre), ver tablero |
| Sección en Tareas (docente) | Sus estudiantes con plan: criterios de promoción, formulario de guía, revisar/editar/aprobar, seguimiento de pasos y sustentación |
| Función `planCasaGuia` (servidor) | Recibe temática, competencias, texto de referencia, ajustes, criterios y periodo → pide a Claude una guía con la estructura del PRD en formato fijo (JSON) → devuelve la propuesta. **No envía nombre, motivo ni datos de salud** |
| Función `planCasaPublicar` (servidor) | Al aprobar una guía, actualiza la copia pública del QR |
| Página pública `#/plan/{token}` | La agenda del estudiante, como la agenda del grupo: hoy, próximas entregas, sustentaciones |
| Asistencia «plan en casa» | Pedido a la sesión de asistencia (no se toca desde aquí) |
| Classroom por estudiante | Etapa 3 (reutiliza la integración existente) |

Las funciones van en un codebase nuevo `plancasa`, aislado de los demás.

## Lo que necesita Julián
1. **Clave de Claude:** crearla en console.anthropic.com (con tope de gasto mensual) y guardarla con
   `npx firebase functions:secrets:set ANTHROPIC_API_KEY` (la pega en la terminal; nunca en el chat).
2. Decir quiénes de la UAI entran al equipo (correos institucionales).
3. Autorizar los despliegues de reglas y funciones cuando se los pida.

## Modelo de IA
Claude Sonnet: buena redacción pedagógica en español a bajo costo (centavos de dólar por guía).
Respuesta en formato estructurado para que la app la pinte y el docente la edite campo por campo.

## Etapas
1. Plan + ajustes + criterios + guía con IA + aprobación + QR con agenda diaria.
2. Seguimiento de pasos y sustentación + tablero.
3. Classroom asignado solo al estudiante.
(En paralelo: marca «plan en casa» en asistencia, por la sesión de asistencia.)

## Verificación
Pruebas automáticas (reparto diario con tope, reglas: el docente no lee el motivo, el QR no
expone apellidos) y, al final de cada etapa, una prueba con Julián en la app con un estudiante de prueba.
