# Asistente de emergencias — plan de implementación

Estado: **análisis hecho, sin código escrito todavía.** Julián trajo un prompt
para un asistente conversacional de emergencias dentro de Gestión del
Riesgo, junto con el documento fuente (`protocolo_emergencias_MJB v2.docx`,
en `D:\Descargas\`, no versionado). No alcanzó el presupuesto de tokens de
la sesión para programarlo — este documento deja todo listo para que la
próxima sesión empiece a ejecutar directamente, sin tener que re-analizar
nada.

## 0. Lo primero que hay que saber: esto es un desarrollo desde cero

Revisé el repo completo: **no existe ninguna integración con un LLM** (ni
Claude, ni OpenAI, ni ningún otro) en ningún punto de la aplicación, ni en
el frontend ni en las Cloud Functions. `Asistentes.tsx` es un menú de
enlaces externos a herramientas docentes — coincidencia de nombre, nada que
ver con esto. Esto significa que el prompt que trajo Julián es la
especificación de un feature nuevo de punta a punta: backend que llama al
LLM, ejecución de herramientas (tool calling), UI de chat, y todo el
manejo de datos sensibles que implica (menores, documentos firmados,
casos de salud mental).

## 1. El documento fuente, transcrito íntegro

Esto reemplaza el placeholder `[PEGAR AQUÍ el texto completo del protocolo
de emergencias escolares]` del prompt. Transcripción fiel de
`protocolo_emergencias_MJB v2.docx` (extraído con `python-docx`, revisado
párrafo por párrafo y tabla por tabla):

> **INSTITUCIÓN EDUCATIVA MANUEL J. BETANCUR**
> **Protocolo de Atención en Emergencias Escolares**
> *Primeros auxilios y contención inicial — versión práctica de bolsillo*
>
> Tu función no es diagnosticar ni tratar. Es reconocer, actuar dentro de
> lo básico, y conectar con quien sí puede decidir.
>
> **Flujo:** 1. Triage › 2. Atención básica › 3. En paralelo › 4. Traslado
> › 5. Gestión posterior.
>
> ### 1. Triage inmediato — responde esto primero
> *Fuente: práctica docente documentada — el protocolo institucional
> escrito no especifica este criterio de decisión.*
>
> ¿Se presenta alguna de estas señales?
> - Convulsión
> - Pérdida de consciencia por un golpe
> - No tienes claridad sobre qué tan grave es la situación
>
> **SÍ → Llama al 123 ya. Sigue sus instrucciones al pie de la letra. No
> necesitas evaluar más: la decisión ya no es tuya, es de ellos.**
>
> Si tu respuesta es NO a las tres, continúa con la atención básica
> (punto 2).
>
> ### 2. Atención básica — esto sí puedes hacerlo tú
> *Fuente: práctica docente documentada, complementaria al protocolo
> institucional (que no detalla estas acciones).*
>
> **2.1 Ubicar y preguntar**
> - Ubica al estudiante en un lugar privado y cómodo, si es posible
>   movilizarlo.
> - Si no se puede movilizar, asegura las condiciones de privacidad y
>   seguridad en el sitio.
> - Pregunta: ¿ha tenido episodios similares antes? ¿qué sucedió? ¿dónde
>   le duele? ¿cómo fue el accidente?
>
> **2.2 Primeros auxilios básicos (según el caso)**
> - Inmovilización, si es necesaria.
> - Hidratación o alimento, si el caso lo requiere.
> - Compresas frías, si es necesario.
>
> ### 3. En paralelo — no es una fila, hazlo al tiempo
> *Fuente: práctica docente documentada. El protocolo institucional
> presenta estos pasos en secuencia, no en paralelo.*
>
> Mientras atiendes al estudiante, no tienes que esperar a terminar para
> empezar lo siguiente:
> - Llama al acudiente para que recoja al estudiante.
> - Si el accidente ocurrió en el colegio: elabora el formato de remisión
>   para el Fondo de Protección Escolar (documentando los detalles
>   relevantes del accidente) y solicita la constancia de estudios en
>   secretaría, para tener todo listo cuando llegue el acudiente.
>
> **Al llegar el acudiente:**
> - Solicita la información del régimen de salud del estudiante.
> - Explica que, según la urgencia y el aseguramiento, será llevado a un
>   hospital o IPS público o privado.
> - Haz firmar el documento correspondiente y toma una fotografía.
> - Sirve de apoyo para que el padre de familia pueda llevarse al
>   estudiante al centro de salud recomendado en la póliza.
>
> **3.1 Si no logras contactar al acudiente**
>
> *Caso general (no grave)* — *Fuente: práctica docente documentada.*
> El estudiante se aparta y se acompaña hasta lograr el contacto. A veces
> demora, pero normalmente se logra.
>
> *Si termina la jornada y no se logra contactar a ningún número
> registrado* — ⚠️ *Fuente: marco legal general (Ley 1098 de 2006 y Ley
> 1523 de 2012) — no verificado contra un protocolo escrito del MJB para
> este escenario específico.*
> - Contacta a la Policía de Infancia y Adolescencia de la jurisdicción
>   para gestionar el resguardo del estudiante. **[Confirmar con
>   rectoría el número/sede local de San Antonio de Prado antes de
>   imprimir la versión final]**
> - Documenta el intento de contacto: hora y números marcados.
> - Reporta después a Comisaría de Familia o a la Línea 141 del ICBF, si
>   la situación lo amerita.
>
> *Nota del documento: verificar con rectoría si este escenario ya está
> codificado en el Manual de Convivencia, para no duplicar
> instrucciones.*
>
> ### 4. Apoyo emocional inmediato
> *Fuente: práctica docente documentada. La ramificación dentro/fuera del
> colegio es coherente con el marco general de la Ley 1620 de 2013
> (Comité Escolar de Convivencia), pero no está verificada contra el
> protocolo de convivencia escrito del MJB.*
>
> **4.1 Acércate y pregunta, sin pedir detalles**
> - Si identificas tristeza, angustia o bajo ánimo, acércate con calma.
> - Aclara al estudiante que no tiene que dar detalles ni contar nada
>   íntimo.
> - Pregunta solo si es algo que pasó dentro del colegio o fuera de él —
>   únicamente para ubicar el ámbito, no el contenido.
>
> **4.2 Según el ámbito**
> - Dentro del colegio → además del apoyo emocional, debe procederse
>   internamente: evaluar si hay personas implicadas (por ejemplo, un
>   posible caso de acoso escolar).
> - Fuera del colegio → se ofrece el apoyo del colegio y se informa a la
>   familia, sin pedir detalles.
>
> **4.3 Si el estudiante requiere apoyo psicológico, dos rutas**
> - Hay docente de apoyo psicológico disponible en el colegio en ese
>   momento → ofrécelo.
> - El estudiante se niega a recibir apoyo del colegio, o no hay nadie
>   disponible en ese momento → llama a la Línea Naranja para
>   orientación.
>
> ### 5. Gestión posterior — una vez el estudiante está atendido o en
> camino
> *Fuente: protocolo institucional "Protocolo de Atención y Respuesta
> ante Incidentes Escolares", con un ajuste de secuencia: el trámite del
> Fondo de Protección Escolar se movió al punto 3 porque, en la práctica,
> se hace en paralelo durante la atención, no después.*
> - Dejar constancia de retiro del colegio: diligenciar el formato
>   institucional de salida de estudiantes.
> - Elaborar el informe administrativo post-accidente, firmado por un
>   directivo docente, exponiendo tiempo, modo y lugar del siniestro,
>   como antecedente ante una eventual acción judicial.
> - Hacer seguimiento del caso: consultar cómo fue la atención en el
>   centro médico, el diagnóstico y cómo evoluciona el estudiante en los
>   días siguientes.
>
> *Sobre este protocolo: se apoya en las brigadas institucionales y en el
> acompañamiento del Comité Paritario de Seguridad y Salud en el Trabajo
> (COPASST). Este documento integra el protocolo institucional vigente
> con la práctica real de atención en el aula, para facilitar su consulta
> rápida en el momento en que se necesita.*

**El documento distingue explícitamente tres niveles de fuente** en cada
sección: protocolo institucional escrito, práctica docente documentada
(complementaria, no contradictoria), y marco legal general sin verificar
contra el protocolo del MJB. Esa distinción no está en el prompt de
Julián, pero conviene preservarla en el system prompt final — es
información honesta sobre qué tan firme es cada instrucción.

## 2. Dos puntos que el propio documento deja abiertos — hay que resolverlos con rectoría antes de una versión final

1. **Número/sede de la Policía de Infancia y Adolescencia de San Antonio
   de Prado** — el documento lo marca literalmente como pendiente de
   confirmar antes de "imprimir la versión final". Sin este dato, el
   asistente no puede completar el paso 3.1 (jornada terminada, acudiente
   sin contactar) con información verificada.
2. **Si el escenario de "no se logra contactar a nadie al final de la
   jornada" ya está codificado en el Manual de Convivencia** — para no
   duplicar ni contradecir instrucciones que ya existan en otro documento
   institucional.

Se puede programar el asistente completo sin resolver esto (dejando el
número como placeholder visible, ej. "[pendiente de confirmar con
rectoría]"), pero no debería considerarse listo para uso en una emergencia
real hasta que Julián lo confirme.

## 3. Análisis del prompt de Julián

**Lo que está bien resuelto y no hay que tocar:**
- La separación de ramas (primeros auxilios / contención emocional) y el
  triage como "estado terminal" que corta el flujo — coincide
  exactamente con la estructura del documento fuente.
- Las dos herramientas están acotadas con precisión quirúrgica: cuándo se
  usan y cuándo NO se ofrecen proactivamente. Eso hay que respetarlo tal
  cual al implementar el tool-calling, no relajarlo "por conveniencia".
- El estilo de respuesta (una idea por mensaje, imperativo, sin
  narrar) está pensado para alguien en estrés real — es la parte más
  fácil de implementar mal por exceso de "personalidad" del modelo, hay
  que ser estricto en el system prompt.

**Lo que es ambiguo y necesita una decisión antes de programar** (ver
sección 5, preguntas para Julián):
- Dónde vive el chat en la UI y cómo se llega a él en segundos reales
  (no es una pantalla más del menú si de verdad se usa en una emergencia).
- Qué pasa con el historial de la conversación — ¿se guarda? Es
  información de un menor en una situación de crisis; si se persiste,
  entra en la misma categoría de sensibilidad que las fotos de
  identificación de asistencia (o más).
- Quién es exactamente "coordinación" en `notificar_coordinacion` —
  ¿el coordinador de la jornada actual del docente, los dos, o alguien
  más? El sistema ya tiene el concepto de coordinador por jornada
  (`coord_manana`, `coord_tarde` en `maestros.ts`), pero no hay overlap
  automático con "quién está de turno ahora".
- Proveedor del LLM y quién paga la API — el prompt no lo dice, es una
  decisión de Julián con implicación de costo recurrente.

## 4. Arquitectura propuesta (a validar, no a asumir)

- **LLM**: Claude vía Anthropic Messages API (tool use nativo), llamado
  **solo desde una Cloud Function** — la API key nunca debe llegar al
  cliente. El repo es público (o en camino a decidirse, ver conversación
  anterior sobre visibilidad); un system prompt con contenido
  institucional no es grave si se filtra, pero una API key sí.
- **Dónde vive la función**: nuevo codebase o dentro de uno existente —
  decidir. `functions-asistencia` ya tiene el patrón de secretos
  (`DOC_HASH_KEY` vía `defineSecret`) y de `invoker: 'public'` explícito
  para funciones nuevas (lección aprendida esta semana, no repetir el
  ciclo de fallo-y-redeploy). Mismo patrón aplicaría para la API key del
  LLM.
- **Tool calling**: implementar el loop estándar de Anthropic (el modelo
  pide una tool, el backend la ejecuta, se le devuelve el resultado, el
  modelo continúa) enteramente server-side. El cliente solo envía
  mensajes de usuario y recibe texto — nunca ejecuta una tool
  directamente.
- **`notificar_coordinacion`**: reutilizar el sistema de notificaciones
  ya existente en vez de inventar uno nuevo. Hay que decidir si esto vive
  en el backend de Apps Script/Sheets (`crearNotificacionesLote` en
  `api.ts`, el que usa el resto de préstamos/horarios) o en Firestore
  (el que usa asistencia) — probablemente Firestore, porque esta
  función es más parecida en naturaleza a asistencia (datos sensibles de
  estudiante, tiempo real) que a préstamos.
- **`escanear_documento_firmado`**: reutilizar el patrón de captura de
  cámara que ya existe en `src/asistencia/EscanerQr.tsx` y
  `src/asistencia/fotos.ts`, no reinventar la lógica de acceso a
  cámara/subida. El documento firmado es de un menor — misma categoría de
  sensibilidad que las fotos de identificación de asistencia, debería
  vivir en Storage con reglas equivalentes, no en una colección nueva sin
  precedente de seguridad.
- **Modelo del "caso en curso"**: nueva colección Firestore, ej.
  `emergenciaCasos/{casoId}`, para que el documento firmado y la
  notificación a coordinación queden asociados al mismo caso. Si se
  decide NO persistir el texto completo de la conversación (ver pregunta
  5 abajo), el caso solo guarda metadatos (quién, cuándo, rama del
  protocolo, si se notificó coordinación, referencia a la foto) — no la
  transcripción palabra por palabra.

## 5. Preguntas para Julián — resolver al empezar la próxima sesión

1. ¿Proveedor del LLM? (Claude es la recomendación natural, dado que ya
   es la herramienta de desarrollo de este proyecto — pero implica un
   costo por uso que hay que presupuestar).
2. ¿Quién administra y paga la API key?
3. ¿Dónde vive el acceso al chat en la interfaz? Una emergencia real no
   espera a navegar tres menús — ¿un acceso directo desde el inicio,
   además del que va dentro de Gestión del Riesgo?
4. Los dos puntos abiertos de la sección 2 (número de Policía de Infancia
   y Adolescencia, y si el escenario de jornada terminada ya está en el
   Manual de Convivencia).
5. ¿Se guarda el historial completo de la conversación, o solo metadatos
   del caso (para no acumular texto sensible de crisis de menores sin
   necesidad clara)?
6. ¿Quién es "coordinación" exactamente en `notificar_coordinacion` —
   el coordinador de la jornada del docente en ese momento, ambos
   coordinadores, o algo más específico?
7. ¿Vale la pena que rectoría revise el system prompt final antes de
   activarlo, dado que es contenido que un docente seguirá al pie de la
   letra en una emergencia real con un menor?

## 6. Plan de tareas para la próxima sesión, en orden

1. Resolver las preguntas de la sección 5 con Julián (no programar nada
   antes de esto — varias decisiones cambian la arquitectura).
2. Instalar el SDK del proveedor elegido en la función correspondiente.
3. Escribir el system prompt final: estructura del prompt de Julián +
   el documento fuente transcrito arriba, con las anotaciones de fuente
   preservadas y los dos puntos abiertos resueltos o marcados con su
   placeholder acordado.
4. Cloud Function con el loop de tool-calling, la API key como secreto
   (`defineSecret`, con `invoker: 'public'` si aplica).
5. Implementar `notificar_coordinacion` sobre el sistema de
   notificaciones elegido.
6. Implementar `escanear_documento_firmado` reutilizando el patrón de
   cámara de asistencia, con sus propias reglas de Storage/Firestore.
7. Componente de chat en React (nuevo, ej. `AsistenteEmergencia.tsx`),
   con el flujo de un mensaje por turno que pide el prompt.
8. Reglas de Firestore/Storage para `emergenciaCasos` y el documento
   firmado.
9. Enlazar el acceso desde Gestión del Riesgo (y desde donde se decida en
   la pregunta 3).
10. Probar manualmente las dos ramas completas, con especial atención a
    que el triage SIEMPRE corte el flujo cuando corresponde — es la parte
    donde un error de implementación tiene más consecuencia.
