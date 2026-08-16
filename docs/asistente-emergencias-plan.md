# Asistente de emergencias — plan de implementación

Estado: **análisis hecho, sin código escrito todavía.** Julián trajo un prompt
para un asistente conversacional de emergencias dentro de Gestión del
Riesgo, junto con el documento fuente (`protocolo_emergencias_MJB v2.docx`,
en `D:\Descargas\`, no versionado). No alcanzó el presupuesto de tokens de
la sesión para programarlo — este documento deja todo listo para que la
próxima sesión empiece a ejecutar directamente, sin tener que re-analizar
nada.

**Modelo objetivo del asistente en ejecución: Claude Opus 5**
(`claude-opus-5`), confirmado por Julián. Eso resuelve la pregunta 1 de la
sección 5. Nota de costo: Opus es el nivel más caro, pero este asistente se
usa en emergencias reales —unas pocas veces al mes, con conversaciones
cortas—, así que el gasto es marginal y no justifica bajar de modelo en algo
donde la calidad de la respuesta importa tanto.

**Segunda pasada de análisis (Opus 5):** el repaso crítico del prompt contra
el documento fuente encontró siete defectos concretos que la primera pasada
no vio. Están en la sección 3.1 y **hay que corregirlos antes de
implementar** — dos de ellos harían que el asistente falle justo en el
momento que importa.

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
- Quién paga la API (el modelo ya está decidido: Opus 5).

## 3.1 Fallos concretos del prompt — corregir ANTES de implementar

Ninguno es un matiz de estilo. Los dos primeros harían que el asistente se
comporte mal justo en el momento crítico.

**1. ⛔ El triage tiene una pregunta con la polaridad invertida.**
El prompt manda preguntar cuatro cosas: *«si el estudiante está consciente,
si está convulsionando, si perdió la consciencia por un golpe, o si el
docente no tiene claridad»*, y luego ordena: *«Si CUALQUIERA es afirmativa:
llama al 123»*. Pero **«¿está consciente?» es la única cuya respuesta
afirmativa es tranquilizadora**; en las otras tres, «sí» significa
gravedad. Leído al pie de la letra, un docente que responde «sí, está
consciente» dispara la llamada al 123. El documento fuente lista **tres**
señales, no cuatro (Convulsión · Pérdida de consciencia por un golpe · No
tienes claridad). Arreglo: eliminar la cuarta pregunta, o reformularla como
*«¿está inconsciente?»* para que todas compartan polaridad.

**2. ⛔ La rama emocional pide el ámbito y después no lo usa.**
El paso 1 hace ubicar si la situación viene de dentro o fuera del colegio.
Los pasos 2 a 7 **nunca se ramifican según esa respuesta** — el dato se
pide y se descarta. Y con eso se pierde media sección 4.2 del documento:
*«Dentro del colegio → además del apoyo emocional, debe procederse
internamente: evaluar si hay personas implicadas (por ejemplo, un posible
caso de acoso escolar)»*. Es decir, **la ruta de acoso escolar desaparece
del asistente**. El paso 7 del prompt («informar a la familia») es en
realidad la rama de *fuera del colegio* aplicada a todos los casos. Arreglo:
ramificar de verdad después del paso 1, con la vía interna para el caso de
dentro del colegio.

**3. El prompt no cubre la sección 5 del documento (gestión posterior).**
El documento define el flujo completo como *1. Triage › 2. Atención básica ›
3. En paralelo › 4. Traslado › 5. Gestión posterior*. El prompt llega hasta
el 4. Queda fuera: constancia de retiro (formato institucional de salida),
informe administrativo post-accidente firmado por un directivo —con tiempo,
modo y lugar, como antecedente ante una eventual acción judicial— y el
seguimiento del caso en los días siguientes. Decidir si el asistente cubre
esto o si es explícitamente otro momento/otra herramienta.

**4. «El documento correspondiente» del paso 5c es ambiguo.**
El documento menciona cuatro papeles distintos: formato de remisión del
Fondo de Protección Escolar, constancia de estudios, formato institucional
de salida de estudiantes, e informe administrativo post-accidente. El
prompt manda *«hacer firmar el documento correspondiente»* sin decir cuál.
Además hay un desfase: el prompt sitúa la firma al llegar el acudiente
(paso 5), mientras el documento pone la constancia de retiro en la sección
5 (gestión posterior). `escanear_documento_firmado` necesita saber qué está
escaneando para poder etiquetarlo en el caso.

**5. La Línea Naranja no tiene número en la aplicación.**
El prompt manda llamarla «de inmediato», pero ni el documento fuente ni el
directorio COPASST que se añadió hoy a Gestión del Riesgo
(`src/data/emergencias.ts`) la traen con ese nombre. Lo más cercano en el
directorio es *Línea Código Dorado / Centro Integral de Familia
(Psicología)* y *Prevención del Suicidio (018000113113)*. Hay que confirmar
con rectoría si «Línea Naranja» es una de esas o es otra línea distinta, y
—una vez confirmada— **enlazar el asistente al directorio ya existente** en
vez de repetir números sueltos dentro del prompt: la nueva pestaña de
números de emergencia es la fuente única, y así no se desincronizan.

**6. El paso 0 no contempla «ambas» ni «no sé».**
Pregunta si es primeros auxilios o contención emocional y espera una de las
dos. Un estudiante que se desmaya y además está en crisis, o un docente que
no sabe clasificar lo que ve, no tienen camino. Dado que el triage manda,
lo prudente es que «no sé» entre por la rama de primeros auxilios — cuyo
propio triage ya contempla *«no tienes claridad sobre qué tan grave es»* y
resuelve con el 123.

**7. Detalle añadido que no está en la fuente.**
El prompt dice llamar a la Línea Naranja *«desde el celular del colegio»*;
el documento solo dice llamar. Es un añadido razonable de Julián, pero
choca con la regla que el propio prompt se impone («no agregues contexto que
no esté explícitamente en el documento fuente»). Conviene decidirlo
conscientemente: o se incorpora al documento institucional, o se quita del
prompt.

## 3.2 Cómo organizar la corrección — tres lotes según quién desbloquea

El criterio no es la gravedad del fallo, sino **quién puede resolverlo**.
Los del lote 3 tienen tiempo de espera (dependen de terceros); los del 1 y
2, no. Si se mandan las preguntas del lote 3 *primero* y se trabajan los
otros dos mientras llega la respuesta, nada queda bloqueado esperando.

**Lote 1 — Julián decide solo, sin consultar a nadie. Son ediciones del
prompt, cuestión de minutos.**
- Fallo 1 (polaridad del triage): quitar la cuarta pregunta o
  reformularla como «¿está inconsciente?». El documento fuente lista tres
  señales; la cuarta sobra.
- Fallo 6 (paso 0 sin «ambas» ni «no sé»): decidir que «no sé» entra por
  primeros auxilios, cuyo triage ya resuelve la falta de claridad con el
  123.
- Fallo 7 («desde el celular del colegio»): dejarlo o quitarlo.

**Lote 2 — Requiere que Julián decida el alcance del asistente.**
- Fallo 2 (ramificar por ámbito): la rama de *fuera del colegio* ya está
  resuelta en el documento. La de *dentro* dice solo «evaluar si hay
  personas implicadas (por ejemplo, acoso escolar)», que es delgado para
  guiar a un docente paso a paso — hay que decidir si el asistente
  simplemente deriva al Comité Escolar de Convivencia o si detalla la
  ruta, y en ese caso hace falta el texto de convivencia.
- Fallo 3 (sección 5, gestión posterior): ¿el asistente acompaña también
  el después, o cierra cuando el estudiante ya va camino a atención?
- Pregunta 11 (notificar a coordinación en la rama emocional cuando el
  origen es dentro del colegio).

**Lote 3 — Requiere confirmación institucional. Mandar todo junto, en una
sola consulta, y seguir trabajando mientras responden.**
- Fallo 5: qué es exactamente la «Línea Naranja» y su número.
- Fallo 4: qué documento firma el acudiente.
- Número/sede de la Policía de Infancia y Adolescencia de San Antonio de
  Prado (pendiente del propio documento).
- Si el escenario de jornada terminada sin contactar ya está en el Manual
  de Convivencia (pendiente del propio documento).
- Revisión del system prompt final por rectoría (pregunta 7).

**Por qué esto no bloquea la publicación:** el lote 3 se puede publicar con
los huecos marcados a la vista («[pendiente de confirmar con rectoría]»)
siempre que el módulo esté rotulado como beta — ver sección 7. Un dato
faltante y señalado es honesto; un dato inventado para rellenar, no.

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

**RESUELTAS por Julián (16 de agosto de 2026):**

- ~~1. ¿Proveedor del LLM?~~ → **Claude Opus 5 (`claude-opus-5`).**
- ~~3. ¿Dónde vive el acceso?~~ → **Acceso directo en Inicio + pestaña
  dentro de Gestión del Riesgo.** En una urgencia nadie navega tres menús.
- ~~5. ¿Historial?~~ → **Solo metadatos del caso**, no la transcripción.
  Se guarda quién, cuándo, qué rama, si se notificó a coordinación y la
  referencia al documento escaneado. No se acumulan relatos de crisis de
  menores en la base.
- ~~6. ¿Quién es "coordinación"?~~ → **El coordinador de la jornada del
  docente** (Janneth en la mañana, Juan Diego en la tarde). Ya está en
  `maestros.ts` como `coord_manana` / `coord_tarde`.
- ~~Fallo 3 / alcance de la gestión posterior~~ → **Sí, pero como cierre
  aparte.** El flujo de urgencia termina cuando el estudiante ya está
  atendido; después el asistente ofrece retomar el caso para la constancia
  de retiro, el informe administrativo y el seguimiento. Son momentos
  distintos y mezclarlos alargaría el flujo agudo.

**Pendientes:**

2. ¿Quién administra y paga la API key? **BLOQUEANTE** — no hay ninguna
   API key de Anthropic en el proyecto (verificado en `.env.local`,
   `package.json` y ambos codebases de functions). Sin esto no se puede
   construir nada del LLM. Hay que crearla en `console.anthropic.com`,
   fondearla, y guardarla como secreto (`defineSecret`), nunca en el
   cliente.
4. Los dos puntos abiertos de la sección 2 (número de Policía de Infancia
   y Adolescencia, y si el escenario de jornada terminada ya está en el
   Manual de Convivencia).
7. ¿Vale la pena que rectoría revise el system prompt final antes de
   activarlo, dado que es contenido que un docente seguirá al pie de la
   letra en una emergencia real con un menor?

**Nuevas, de los fallos de la sección 3.1:**

8. ¿«Línea Naranja» es alguna de las que ya están en el directorio COPASST
   (Línea Código Dorado, Prevención del Suicidio) o es otra distinta? Sin
   esto el asistente manda a llamar a un número que la app no tiene.
9. ¿Qué documento firma el acudiente exactamente, y por tanto qué captura
   `escanear_documento_firmado`?
10. ¿El asistente cubre también la gestión posterior (sección 5 del
    protocolo: constancia de retiro, informe administrativo, seguimiento),
    o eso es otro momento y otra herramienta?
11. En la rama emocional con origen *dentro del colegio*, ¿debe
    notificarse a coordinación? El documento pide «proceder internamente»
    (posible acoso escolar), pero el prompt restringe
    `notificar_coordinacion` a la rama de primeros auxilios. Confirmar si
    esa restricción es deliberada.

## 6. Plan de tareas para la próxima sesión, en orden

1. Resolver las preguntas de la sección 5 con Julián (no programar nada
   antes de esto — varias decisiones cambian la arquitectura).
2. **Corregir los siete fallos de la sección 3.1 en el prompt**, empezando
   por los dos marcados con ⛔ (polaridad del triage y ramificación por
   ámbito en la rama emocional). Este paso va antes de escribir código:
   el prompt corregido *es* la especificación.
3. Instalar `@anthropic-ai/sdk` en la función correspondiente.
4. Escribir el system prompt final: estructura del prompt de Julián (ya
   corregida) + el documento fuente transcrito arriba, con las
   anotaciones de fuente preservadas y los puntos abiertos resueltos o
   marcados con su placeholder acordado.
5. Cloud Function con el loop de tool-calling contra Opus 5
   (`claude-opus-5`), la API key como secreto (`defineSecret`, con
   `invoker: 'public'` si aplica).
6. Implementar `notificar_coordinacion` sobre el sistema de
   notificaciones elegido.
7. Implementar `escanear_documento_firmado` reutilizando el patrón de
   cámara de asistencia, con sus propias reglas de Storage/Firestore.
8. Componente de chat en React (nuevo, ej. `AsistenteEmergencia.tsx`),
   con el flujo de un mensaje por turno que pide el prompt.
9. Reglas de Firestore/Storage para `emergenciaCasos` y el documento
   firmado.
10. Enlazar el acceso desde Gestión del Riesgo (y desde donde se decida en
    la pregunta 3), y enlazar la mención de líneas telefónicas del
    asistente al directorio de `src/data/emergencias.ts` en vez de
    repetir números dentro del prompt.
11. Probar manualmente las dos ramas completas. Casos que **no** pueden
    fallar: (a) el triage corta el flujo siempre que corresponde;
    (b) responder «sí, está consciente» **no** dispara el 123 — la
    regresión del fallo 1; (c) la rama emocional con origen dentro del
    colegio ofrece la vía interna de acoso escolar — la regresión del
    fallo 2; (d) una señal de triage reportada a mitad de cualquier rama
    interrumpe y vuelve al 123.
12. Aplicar la marca de beta de la sección 7 antes de que lo vea el primer
    docente.

## 7. Marca de BETA — requisito de Julián

**Por qué.** Cuando esto se socialice va a tener correcciones, y el tema es
delicado: un docente no debe asumir que lo que le dice la pantalla ya es
doctrina institucional aprobada. Y hay una razón de fondo más fuerte que la
madurez del software: **el propio documento fuente no es homogéneo**.
Distingue tres niveles —protocolo institucional escrito, práctica docente
documentada, y marco legal general sin verificar contra el MJB— y buena
parte del contenido (todo el triage, la atención básica, la ramificación
emocional) es de los dos últimos. Rotularlo como institucional sería
afirmar más de lo que el documento sostiene.

**Alcance: solo el asistente, no todo Gestión del Riesgo.** Las brigadas
salen de la Resolución Rectoral N.º 33 y los números del volante oficial
del COPASST: eso sí es institucional y marcarlo como beta diluiría la
señal. La beta va únicamente en la pestaña del asistente.

**Cómo se ve:**
1. **En la pastilla**, antes de entrar: `🚑 Asistente de emergencia` con
   una insignia `BETA` pequeña al lado (mismo patrón visual que la píldora
   «Próximamente» que ya existe en `Asistentes.tsx`, reutilizar tokens
   `bg-warning-soft` / `text-warning`).
2. **Un aviso al abrir**, corto y arriba del todo, no enterrado al final.

**El texto importa más de lo normal.** Un aviso que siembre duda puede
hacer dudar al docente en el peor momento; el objetivo es lo contrario:
recordarle quién manda de verdad, que es exactamente lo que ya dice el
protocolo («la decisión ya no es tuya, es de ellos»). Propuesta:

> ⚠️ **En pruebas.** Esta guía puede cambiar. En una urgencia manda el
> **123**; en salud mental, la **Línea Naranja**. Si algo aquí no cuadra
> con lo que estás viendo, hazle caso a la línea, no a la aplicación.

Eso es honesto sin inducir parálisis: no dice «puede estar mal, ten
cuidado», dice «la autoridad está en otra parte». La redacción final
conviene que la revise rectoría junto con el system prompt (pregunta 7).

**Cómo se recogen las correcciones.** No hace falta un canal nuevo: la app
ya tiene «💡 Enviar sugerencia» con su pantalla de clasificación
(`crearSugerencia` / `getSugerencias` / `actualizarSugerencia`). Basta con
un enlace desde el asistente que la abra prellenada con el contexto (rama
en curso, fecha), para que reportar un problema cueste un toque y no haya
que acordarse después.

**Cuándo se le quita la beta** — sin criterio de salida, «beta» se queda
para siempre y deja de significar nada. Propuesta de criterios:
- Lote 3 de la sección 3.2 resuelto (sin placeholders visibles).
- System prompt revisado y aprobado por rectoría.
- Un puñado de usos reales revisados con los docentes que lo usaron, sin
  hallazgos nuevos de contenido.
- Los dos fallos críticos con su regresión probada (paso 11).
