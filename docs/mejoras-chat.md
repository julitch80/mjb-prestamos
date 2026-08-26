# Chat institucional — mejoras pendientes

Análisis hecho el 2026-08-26 a petición de Julián. **Nada de esto está construido.**
Se deja escrito para retomarlo cuando el chat empiece a usarse de verdad: la decisión
fue esperar a tener problemas observados en vez de suponerlos.

---

## Punto de partida: qué hay hoy

- Canales de cinco tipos: `general`, `rol`, `segmento`, `grupo`, `directo`.
- Mensajes con: `authorEmail`, `authorName`, `text`, `createdAt`, `deleted`, `adjunto`.
- Adjuntos de imagen, audio y archivo (hasta 10 MB), en `chat/{channelId}/` de Storage.
- Editar y borrar el mensaje propio; el superusuario puede ocultar cualquiera.
- Estado de lectura por usuario y canal (`users/{email}/readStates/{channelId}`).
- Resumen del último mensaje por canal, que escribe la función `onMessageCreated`.

### La restricción que gobierna cualquier cambio

Las reglas del chat tienen una **lista blanca estricta** de campos
(`firestore.rules`, regla de `create` en `messages`):

```
hasOnly(['authorEmail','authorName','text','createdAt','deleted','adjunto'])
```

Un mensaje con cualquier campo extra **se rechaza**. Toda mejora que añada datos al
mensaje exige tocar esa lista y desplegar reglas. Ventaja: el chat es del repo de MJB,
no del de asistencia, así que no hay que coordinar con la otra sesión.

⚠️ Al tocar esas reglas, respetar las guardas `!esSuplantacion()` (ver la cabecera de
`firestore.rules`).

---

## A. Que lo importante no se pierda

### A1. Mensajes fijados
Clavar arriba del canal el enlace a la agenda, el protocolo de emergencia o una fecha
de entrega. Hoy una circular queda sepultada bajo cuarenta mensajes en dos horas.
**Esfuerzo: pequeño.** Un campo en el canal (no en el mensaje) con el id fijado.

### A2. Buscar en el chat
Encontrar "qué dijo la coordinadora sobre la salida pedagógica".
**Aviso honesto:** Firestore no hace búsqueda de texto. Sería sobre lo ya cargado en el
cliente, no sobre todo el historial. Útil igual, pero no se debe prometer más.
**Esfuerzo: medio.**

### A3. Canal de avisos, sin respuestas
Solo publican coordinación y rectoría; nadie contesta. Separa "esto hay que leerlo" de
la conversación. Los tipos de canal ya existen, sería una variante.
**Esfuerzo: pequeño.**

---

## B. Saber si llegó

### B1. "Leído por 18 de 32" ← la de mejor relación valor/esfuerzo
**Los datos YA existen**: `readStates` por usuario y canal. Falta casi solo mostrarlo.
Para una circular institucional, saber quién no la ha abierto cambia la gestión.
**Esfuerzo: pequeño.** Empezar por aquí.

### B2. Menciones `@nombre` con notificación
El hook `useNotificacionesSistema` ya existe. Dirigir la atención a una persona sin que
los otros treinta sientan que les hablan.
**Esfuerzo: medio** (hay que resolver el autocompletado y el aviso).

---

## C. Convivencia digital (específico de un colegio)

### C1. Programar el envío
Se escribe a las 11 de la noche y sale a las 7 de la mañana. No es un lujo: el chat
institucional que suena de madrugada es una queja recurrente en cualquier claustro.
**Esfuerzo: medio** — necesita una función programada.

### C2. Reacciones (👍 ✅)
Parece frívolo y no lo es: evita treinta mensajes de "enterado" que entierran el
original. Acuse de recibo sin ruido.
**Esfuerzo: pequeño-medio.** Igual que los votos de una encuesta, conviene un documento
por persona (`reacciones/{correo}`) y no un campo del mensaje, para que dos personas
reaccionando a la vez no se pisen.

### C3. Silenciar y archivar canales
Control de ruido básico. **Esfuerzo: pequeño.**

---

## D. De WhatsApp (analizado el 2026-08-26, aplazado)

### D1. Responder citando
Campo `respondeA` con una **copia** del original (id, autor y un extracto), no solo el
id. Es como lo hace WhatsApp y por buena razón: guardando solo el id, para pintar la
cita hay que ir a buscar el original, que puede estar borrado o fuera de lo cargado.
**Esfuerzo: pequeño.** La más rentable de las tres.

### D2. Reenviar
Crear un mensaje nuevo en otro canal con una marca `reenviadoDe`.
**El matiz no es técnico:** reenviar saca contenido de su contexto, y en un colegio
mover algo de un mensaje directo a un canal general puede exponer información sobre un
estudiante o un compañero. Marcarlo como "reenviado" es lo mínimo.
**Esfuerzo: pequeño-medio.**

### D3. Encuestas
No es un campo, es un subsistema: pregunta y opciones en el mensaje, votos en una
subcolección con **un documento por votante** (`votos/{correo}`). Esa forma importa: con
los votos como campo del mensaje, dos personas votando a la vez se pisan. El recuento lo
hace el cliente sumando; con treinta docentes no hace falta función en el servidor.
**Esfuerzo: grande, mayor que D1 y D2 juntas.**

**Alternativa a considerar antes de construirlo:** si el uso es para decisiones formales
—votar algo del consejo, recoger disponibilidad— un formulario de Google lo hace mejor:
permite anonimato y exporta a hoja de cálculo. La encuesta en el chat sirve para lo
rápido e informal ("¿el martes o el jueves?"). Si el caso real es el primero, construir
esto sería trabajo desperdiciado.

---

## E. Institucional y legal

### E1. Exportar una conversación
Para un caso de convivencia, un PDF con fecha y participantes es evidencia. Encaja con
lo que ya se hace en los informes de contención emocional.
**Esfuerzo: medio.**

---

## F. Lo que NO conviene construir

- **Videollamadas.** El colegio ya tiene Meet. Mucho trabajo para competir con algo que
  funciona.
- **Cifrado extremo a extremo.** Suena responsable, pero rompería la búsqueda y la
  moderación, y estos datos son institucionales, no privados entre particulares.
- **Estados o historias.** No resuelven ningún problema del colegio.

---

## G. Dos asuntos abiertos que no dependen de estas mejoras

### G1. ⚠️ Los adjuntos los puede leer cualquier usuario institucional
`storage.rules`: `match /chat/{channelId}/{fileName}` tiene `allow read: if
isInstitutional()`. No comprueba pertenencia al canal. Si en un mensaje directo se
comparte la foto de un documento o algo sobre un estudiante, la protección real hoy es
que nadie adivine la URL.

No es urgente mientras el chat no se use en serio. **Sí lo sería el día que empiece**, y
es mejor arreglarlo antes de que haya contenido sensible dentro. El reenvío (D2) lo
haría más fácil de explotar, así que conviene resolverlo antes o junto con esa mejora.

### G2. Retención: los mensajes no caducan y los adjuntos sí
Los adjuntos se borran a los 90 días por ciclo de vida del bucket; **el texto se queda
para siempre**. Esa asimetría no la decidió nadie, salió así. En un chat donde se habla
de estudiantes menores, cuánto tiempo se conserva el texto es una decisión
institucional, no técnica: conviene consultarlo con rectoría.

---

## Orden sugerido para la primera mejora

| Lote | Contenido | Por qué en ese orden |
|---|---|---|
| 1 | B1 "leído por" + A1 fijados | Los datos de B1 ya existen; ambas son pequeñas y resuelven lo que más duele |
| 2 | D1 responder + D2 reenviar | Comparten el mismo cambio de reglas: se despliega una sola vez |
| 3 | A3 canal de avisos + C2 reacciones | Bajan el ruido, que es el segundo problema de todo chat institucional |
| 4 | El resto, según lo que el uso real demuestre | — |

G1 conviene resolverlo antes del lote 2.
