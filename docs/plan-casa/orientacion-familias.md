# Orientación a las familias en la agenda del Plan Académico Especial

Investigación del 2026-11-03. Cada hallazgo indica qué tan fuerte es la fuente.
Las búsquedas dieron sobre todo material secundario (resúmenes, blogs, repositorios); donde la
fuente es débil se dice. Los textos de la agenda NO afirman nada clínico ni diagnóstico.

## Hallazgos aplicables

1. **Rutina y tiempos acordados en familia (MEN, 2020).** El anexo 2 de la Directiva 05 del MEN
   para el trabajo académico en casa pide organizar primero las dinámicas familiares y definir
   tiempos de acompañamiento según edades y recursos. Fuente oficial, aunque de la emergencia COVID.
   https://escuelasecretarias.mineducacion.gov.co/sites/default/files/2022-12/Anexo%202%20de%20la%20Directiva%20No.%2005%20del%2025%20de%20marzo%20de%202020%20del%20Ministerio%20de%20Educaci%C3%B3n%20Nacional%20%20.pdf
   -> Función A «Mi horario de estudio».
2. **Horarios con descanso y movimiento (Aprende en Casa, Bogotá).** Las orientaciones distritales
   insisten en incluir descansos y actividad física, y en acompañar el uso de internet.
   https://www.eltiempo.com/bogota/aprende-en-casa-la-estrategia-para-que-los-ninos-aprendan-en-casa-473244
   https://bogota.gov.co/mi-ciudad/educacion/estudiar-en-casa-plantea-desafios-para-padres-e-hijos
   -> Pildoras de bienestar y tecnología.
3. **La familia protege y apoya, no reemplaza al colegio; con adolescentes se busca autonomía.**
   Mismo anexo del MEN (hallazgo 1) y estudio colombiano sobre acompañamiento familiar:
   https://dialnet.unirioja.es/descarga/articulo/5893097.pdf
   -> Pildoras de acompañamiento: preguntar y orientar, no hacer la tarea.
4. **Planear el «cuándo y dónde» (intenciones de implementación «si... entonces»).** Fijar una hora y
   un lugar como disparador ayuda a pasar de la intención a la acción. La evidencia específica en
   estudio es indirecta (viene de cambio de hábitos en general); es una extrapolación razonable.
   https://www.ncbi.nlm.nih.gov/pmc/articles/PMC10585941/
   -> «Tu hora de estudio» y su recordatorio en Hoy.
5. **Prácticas de estudio de mayor utilidad: practicarse con preguntas y repartir el estudio.**
   Dunlosky et al. (2013, *Psychological Science in the Public Interest*): práctica con preguntas y
   práctica distribuida = utilidad alta; releer y subrayar = baja.
   (resumen) https://www.readingrockets.org/resources/resource-library/improving-students-learning-effective-learning-techniques-promising
   (DOI del original: 10.1177/1529100612453266)
   -> Pildoras: «cierren el cuaderno y cuéntenlo con sus palabras».
6. **Elogiar el esfuerzo y las decisiones, no el resultado ni la «inteligencia».** Guías escolares de
   tareas para padres lo repiten; es consejo de consenso, con evidencia mixta.
   https://sau51.org/pmhs/wp-content/uploads/2012/03/Homework-Tips-for-Teachers-Parents.pdf
7. **Preguntas abiertas en vez de «¿ya hiciste la tarea?».** Misma guía: «¿cómo vas a estudiar
   esta noche?» pide planear. Parte de la guía: mostrar cómo organizarse, explicar lo difícil sin
   quitarle la tarea, y proponer un descanso.
   https://sau51.org/pmhs/wp-content/uploads/2012/03/Homework-Tips-for-Teachers-Parents.pdf
8. **Lugar fijo, sin distracciones, con rutina acorde a la energía del estudiante.**
   https://www.topmarks.co.uk/Parents/practical-ways-to-help-with-homework
   https://kidshealth.org/CHOC/en/parents/homework.html
9. **El celular en otro cuarto concentra más.** Ward et al. (2017): con el teléfono en la mesa, aun
   apagado o boca abajo, rinde menos la atención; en otra habitación, mejor. Experimentos con
   ~800 personas; sin réplicas revisadas por mí.
   https://www.journals.uchicago.edu/doi/10.1086/691462
   -> Pildora «el celular, en otro cuarto».
10. **Bloques cortos con pausa (Pomodoro): estructura útil, evidencia modesta.** No hay estudios
    sólidos en estudiantes con dificultades de atención; las fuentes son comerciales. Se recomienda
    como estructura flexible y para «arrancar», probando qué le funciona a cada estudiante. Coincide
    con el momento de 25 min de la agenda.
    https://www.brain.fm/blog/adhd-study-tips  (fuente débil, solo recomendaciones)
    -> Temporizador del momento de 25 min con pausa de 5.
11. **Sueño, actividad física y pantallas con plan familiar (AAP).** Dormir 8–12 h, una hora diaria de
    actividad, dispositivos fuera del cuarto y apagados una hora antes de dormir; plan de uso de
    medios acordado en familia. Política de 2016, hoy con más énfasis en hábitos de salud que en
    topes de horas.
    https://www.aafp.org/pubs/afp/issues/2017/0701/p56.html
    https://www.upmc.com/healthbeat/pediatrics/adolescent-sleep-and-media-use
    -> Pildoras de bienestar y pantallas. (Ejercicio y atención: revisión citada en el hallazgo 10.)
12. **DUA / ajustes razonables: el plan es un acuerdo con la familia.** En Colombia (Decreto 1421 de
    2017) el PIAR consolida compromisos de docentes y familias, que se socializan con ellas. El DUA
    y sus pautas de «autorregulación» sugieren metas propias, listas de chequeo y autoevaluación
    breve. Ninguna fuente encontrada trae pautas específicas para familias; es un puente nuestro.
    https://www.sedarauca.edu.co/wp-content/uploads/2025/02/Introduccion-al-DUA-y-PIAR.pdf
    https://tea.texas.gov/academics/special-student-populations/special-education/universal-design-for-learning-udl-guidelines
    -> Checklist de inicio y «¿cómo me fue hoy?» (autoevaluación).

## Funciones implementadas en la agenda (2026-11-03)

- **A. Mi horario de estudio.** Hora habitual para todos los días con trabajo + ajuste por día.
  Se ve en Hoy («Tu hora de estudio hoy: 3:00 p. m.») y en Semana. Solo en el dispositivo
  (localStorage, clave por token), como el módulo de Tareas (`src/data/tareas/habitos.ts`).
- **B. Sugerencias de estudio.** Botón en la cabecera; pildoritas por grupo (ambiente,
  concentración, acompañamiento, tecnología, bienestar, si hay atrasos o frustración) y una
  «pildorita del día» rotativa en Hoy.
- **C. Pequeñas.** Temporizador de un momento (25 min + 5 de pausa) y «¿cómo me fue hoy?» con caritas
  (también por dispositivo).

## Propuestas NO implementadas

- **Guardar el horario y las caritas en el servidor** (campo en `planesCasaPublico` o una función
  llamable) para que sobrevivan al cambio de teléfono y para que el docente/director vean cómo les
  va. Exige tocar reglas/funciones y definir privacidad; no se hizo.
- **Recordatorio con aviso (push o .ics)** a la hora elegida, usando FCM o un archivo de calendario.
- **Carta a la familia imprimible** con la hora acordada y las 6 pildoritas clave (para quienes no
  usan el celular).
- **Resumen semanal para la familia**: momentos hechos vs. planeados, entregas de la semana siguiente.
- **Contrato de pantallas** de una página, inspirado en el Plan de Medios Familiar de la AAP.
- **Revisar con el equipo UAI** el texto de las pildoritas de frustración y los ajustes razonables.
