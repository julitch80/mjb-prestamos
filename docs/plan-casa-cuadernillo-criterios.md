# Criterios de diseño del cuadernillo impreso (Plan en casa)

Fuentes consultadas (búsquedas del 2026-10-30; algunas son de apoyo, no normativas):
- Estructura de las guías de Escuela Nueva (momentos A-D: actividades básicas, cuento, práctica, libres; procesos antes que contenido): https://escuelanueva.org/wp-content/uploads/2021/02/Catalogo_Guias_Aprendizaje_FEN.pdf y https://www.rmm.cl/sites/default/files/usuarios/maran/doc/200812041324440.Pasantia_Escuela_Nueva.doc
- Formatos amigables con la dislexia (12 pt mínimo, interlineado 1,5, 50-75 caracteres por línea, sin texto justificado, fondos suaves, márgenes amplios): https://dyslexiascotland.org.uk/dyslexia-friendly-typed-formats
- Tipografía y legibilidad: https://ezud.com/typography-readability-dyslexia-friendly/ y https://dyslexiefont.com/en/size-interline-and-spacing/
- Cajas de énfasis (callouts) cortas y con un solo propósito: https://lc.excelsior.edu/course-development-hub/excelsior-bootstrap-style-guide-new/callouts/
- Cuadernos de trabajo: objetivos claros, reflexión y autoevaluación: https://learnybox.com/blog/how-to-create-a-course-workbook/

No se halló guía específica sobre íconos y espacios de respuesta; esas reglas son criterio propio.

## Reglas aplicadas
1. Cuerpo en 11,5 pt con interlineado 1,5.
2. Texto alineado a la izquierda, nunca justificado; párrafos cortos.
3. Línea de ~60-75 caracteres: márgenes amplios, columna única, `max-width` en párrafos.
4. Fuente sans de formas abiertas (Nunito / Atkinson Hyperlegible) para el cuerpo y Poppins solo para títulos, con alternativas del sistema.
5. Jerarquía clara: asignatura > semana > paso.
6. Espacio en blanco generoso y bandas tenues alternadas; poco color, y cada rol lleva además etiqueta de texto para que sirva en escala de grises.
7. Una etiqueta e ícono fijos por tipo de momento (Explora, Aprende, Practica, Entrega).
8. Instrucciones numeradas, una acción por paso, dirigidas al estudiante.
9. Cajas «Qué entregas» breves y sin cortes de página.
10. Renglones de respuesta justo donde se pide la tarea, proporcionales a los momentos.
11. Autogestión: casilla «Lo hice» y línea de fecha en cada paso; lista de verificación en entregas integradas.
12. Entregas parciales resaltadas con banda de color, siempre igual.
13. Portada con bienvenida, materias con docente y guía de íconos antes del contenido.
14. Pie con número de página y lema institucional; encabezado delgado con el escudo oficial.
15. `break-inside: avoid` en pasos y cajas, para un número de páginas razonable.
