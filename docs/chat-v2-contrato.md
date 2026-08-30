# Chat V2 — contrato de datos

Escrito el 2026-08-30 como pieza previa al reparto de tareas. **Este archivo manda.**
Los agentes que construyen reglas, capa de datos e interfaz trabajan en paralelo contra
él; si alguien necesita cambiar una forma de aquí, se cambia AQUÍ primero y se avisa,
nunca en su rincón. Alcance V2 = lotes 1–3 de `mejoras-chat.md` más G1.

| Sigla | Qué es |
|---|---|
| B1 | "Leído por 18 de 32" |
| A1 | Mensajes fijados |
| A3 | Canal de avisos (sin respuestas) |
| C2 | Reacciones |
| D1 | Responder citando |
| D2 | Reenviar |
| G1 | Los adjuntos ya no los lee cualquiera |

---

## Corrección de diseño en B1 — leer antes de construir

`mejoras-chat.md` dice que los datos de B1 ya existen y falta mostrarlos. **Es falso.**
`users/{email}/readStates/{channelId}` tiene `allow read: if callerEmail() == email`:
cada persona lee solo los suyos. Nadie puede contar lectores. Y esa regla está bien
como está — abrirla dejaría ver a un tercero cuándo abriste cada canal del colegio.

Por eso B1 no se hace sobre `readStates`, sino sobre un acuse **dentro del canal**:

    channels/{channelId}/lecturas/{correo}   ->  { hasta: timestamp }

Vive en el canal, así que solo lo ven quienes ya tienen acceso a ese canal, y solo
revela lectura de ESE canal. `readStates` se queda como está, para los no-leídos.

`hasta` es la fecha del último mensaje visto. Un mensaje se cuenta leído por alguien si
`lecturas/{correo}.hasta >= mensaje.createdAt`. Un documento por persona y no un campo
en el mensaje: con treinta docentes abriendo a la vez, un campo compartido se pisa.

**No prometer más de lo que es.** Con canales de tipo `general`, `rol` y `segmento` no
hay lista de miembros, así que el denominador ("de 32") no sale del canal: hay que
contar los usuarios activos que encajan con ese canal. En `directo` y `grupo` sí sale
de `members`. Si el denominador no se puede calcular con certeza, se muestra solo el
numerador ("leído por 18") y no un porcentaje inventado.

---

## Formas de datos

### Mensaje — dos campos nuevos

La lista blanca de la regla `create` pasa a ser exactamente:

    ['authorEmail','authorName','text','createdAt','deleted','adjunto','respondeA','reenviadoDe']

**D1 — `respondeA`** (opcional). Copia, no referencia:

    respondeA: { id: string, autorNombre: string, extracto: string }   // extracto <= 120 chars

Se guarda copia y no solo el id a propósito: con el id habría que ir a buscar el
original para pintar la cita, y puede estar borrado o fuera de los 50 mensajes cargados.
Así WhatsApp, y por la misma razón. El `id` se conserva para poder saltar al original
cuando sí está a la vista.

**D2 — `reenviadoDe`** (opcional):

    reenviadoDe: { canalNombre: string, autorNombre: string }

Nombres, no ids: es una etiqueta para el lector, no un enlace. Reenviar saca contenido
de su contexto, y en un colegio mover algo de un directo a un canal general puede
exponer a un estudiante o a un compañero. La marca visible es el mínimo.

Ambos son inmutables: la regla `update` sigue admitiendo solo
`['text','editedAt','deleted']`, así que nadie reescribe una cita después.

### Canal — dos campos nuevos

**A1 — `fijado`** (opcional, o `null` para soltar):

    fijado: { messageId, text, autorNombre, fijadoPor, fijadoEn }   // text <= 200 chars

En el canal y no en el mensaje: es propiedad del canal, y así pintarlo no exige buscar
el mensaje entre los cargados. Puede fijar quien tenga rol `coordinador`, `rectora` o
`superusuario`; en `directo` y `grupo`, cualquier miembro.

**A3 — `soloLectura`** (opcional, bool). Si es `true`, solo publican `coordinador`,
`rectora` y `superusuario`. Es una variante de los tipos existentes, no un tipo nuevo.

### C2 — Reacciones

    channels/{c}/messages/{m}/reacciones/{correo}  ->  { emoji: string, en: timestamp }

Un documento por persona, por la misma razón que las lecturas. El recuento lo suma el
cliente; con treinta docentes no hace falta función en el servidor. Emoji de una lista
cerrada y corta: 👍 ✅ ❤️ 😄 🎉 👀. Cerrada a propósito — un selector completo invita a
convertir el canal institucional en otra cosa, y además hay que poder validarlo en las
reglas.

Cada quien escribe y borra SOLO su documento (`{correo} == callerEmail()`).

---

## G1 — los adjuntos, cerrados al canal

Hoy `storage.rules` tiene, para `chat/{channelId}/{fileName}`, `allow read: if
isInstitutional()`: no comprueba pertenencia al canal. La protección real es que nadie
adivine la URL. Mientras el chat no se usaba daba igual; V2 trae el reenvío, que lo
hace más fácil de explotar, así que se cierra **antes** y no después.

Las reglas de Storage pueden consultar Firestore con
`firestore.get(/databases/(default)/documents/channels/$(channelId))`. La lectura del
adjunto pasa a exigir acceso al canal, con la misma lógica que `canAccessChannel`.

Ojo con dos cosas al hacerlo:
- Los adjuntos ya subidos siguen donde están; esto cambia quién puede leerlos, no los
  mueve. No hay migración.
- `firestore.get` en reglas de Storage se cobra como lectura. Es una por descarga de
  adjunto, no por mensaje. Asumible.

---

## Lo que NO se toca

- Las guardas `!esSuplantacion()` de toda regla de escritura. **Van también en las
  reglas nuevas** (lecturas, reacciones, fijar). Una sesión suplantada es de solo
  lectura por diseño: nadie debe poder reaccionar ni fijar en nombre de otro. Contar
  las guardas antes y después de tocar el archivo.
- `readStates`, que sigue sirviendo a los no-leídos.
- La identidad del chat: SIEMPRE `auth.currentUser.email` en minúsculas, nunca el
  `userId` del store.
- `src/asistencia/`, que se sincroniza desde el otro repositorio.
