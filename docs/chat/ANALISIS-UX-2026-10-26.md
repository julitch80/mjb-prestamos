# Chat interno: análisis de usabilidad frente a WhatsApp y Telegram
Fecha: 2026-10-26. Solo lectura del código; no se tocó nada.

## 1. Qué tiene hoy el chat (con ubicación en el código)
- Canales: general, por rol, por segmento, mensajes directos y grupos (`src/data/chat.ts:24-27`, `crearGrupo` :373, `abrirDm` :338).
- Burbujas: propias a la derecha (`Chat.tsx:791`), fecha y hora en cada mensaje (:882), «Leído por N de M» (:934-946).
- Responder citando (:843), reenviar (:828, `ModalReenviar` :1281), editar y borrar (`chat.ts:323,331`).
- Reacciones con 6 emojis (`chat.ts:111`), mensaje fijado por canal (`Chat.tsx:448`).
- Adjuntos hasta 10 MB y notas de voz en MP3 (`Chat.tsx:24-25,179-243`).
- Lista de chats: nombre, último mensaje y un punto de «no leído» (:384-410). Búsqueda solo de personas para abrir un directo (:308).
- Aviso push con la app cerrada (`functions-notificaciones/src/index.ts:51`).
- Resumen en Inicio: lista de canales con puntito y escritura rápida (`PanelInicio.tsx:550-640`).
- Colores con tokens que sirven en claro y oscuro (`index.css`).
- Tipografía: `Inter, system-ui…` (`index.css:132`). Ya es una buena fuente.
- Tamaños: casi todo el chat usa `text-xs` (12 px) y `text-sm` (14 px), unas 70 veces (por ejemplo :333, :407, :616). No hay ajuste de tamaño en ninguna parte.
- Avatar: no existe. Tampoco foto de perfil guardada: no se usa `photoURL` en ningún lado y el documento `users/{correo}` no tiene campo de foto (`firestore.rules:154-170`).

## 2. Comparación con WhatsApp y Telegram
Valor para ~35 docentes; costo S = horas, M = 1-2 días, L = una semana o más.

| Elemento | Estado | Valor | Costo |
|---|---|---|---|
| Avatar redondo en lista y mensajes | Falta | Muy alto | S-M |
| Hora del último mensaje en la lista | Falta (solo preview) | Alto | S |
| Contador de no leídos (número) | Parcial (solo punto) | Alto | S |
| Chats fijados arriba | Falta (solo mensaje fijado) | Medio | M |
| Orden por actividad reciente | Por verificar | Alto | S |
| Propias a la derecha, hora | Tiene | - | - |
| ✓✓ de leído | Parcial (texto «Leído por N») | Medio | S |
| Respuesta citada | Tiene | - | - |
| Reacciones | Tiene (6 emojis) | - | - |
| Agrupar mensajes seguidos del mismo autor | Falta | Alto | S |
| Separadores «Hoy / Ayer / fecha» | Falta (fecha repetida en cada burbuja) | Alto | S |
| Selector de emojis al escribir | Falta (solo reaccionar) | Medio | S |
| Adjuntos y notas de voz | Tiene | - | - |
| «Escribiendo…» y presencia | Falta | Bajo | M |
| Buscar dentro de los mensajes | Falta | Medio | M |
| Silenciar un chat | Falta | Alto (evita abandonarlo) | M |
| Notificaciones push | Tiene | - | - |
| Tamaño de letra configurable | Falta | Muy alto | S |
| Tamaño base 15-17 px, interlineado | Falta (12-14 px) | Muy alto | S |
| Modo claro y oscuro | Tiene | - | - |
| Fondo del chat | Falta | Bajo | S |

## 3. Avatares
Se hacen en capas, de menor a mayor costo:
1. Por defecto: círculo con las iniciales (dos letras) y un color estable. El color sale de calcular un número a partir del correo y elegir uno de ~12 colores de una paleta que cumpla contraste en claro y oscuro. Así cada persona tiene siempre el mismo color, sin guardar nada. Los grupos y canales usan un círculo con ícono y su propio color.
2. Foto de Google: al iniciar sesión, Firebase entrega `photoURL` de la cuenta institucional. Hoy no se guarda. Hay que copiarla una vez a `users/{correo}.fotoUrl`. Las reglas actuales de `users/` solo dejan al superusuario cambiar campos, así que hace falta una regla nueva: cada usuario solo puede escribir su propio `fotoUrl` y `avatarColor`.
3. Foto propia opcional: el docente sube una imagen desde su perfil, se recorta cuadrada y se reduce a ~256 px antes de subirla. Va a Storage en `avatares/{correo}` (regla: solo escribe el dueño, leen los usuarios activos del colegio). Botón «volver a iniciales» para quitarla.
4. Qué es personalizable: foto o iniciales, y el color elegido entre la paleta.

Privacidad:
- La foto solo la ven usuarios activos de la institución (misma regla que `users/`), nunca enlace público.
- Es opcional; por defecto no se publica la foto de Google hasta que la persona lo acepte («Usar mi foto de Google»).
- Los docentes no deben subir fotos de estudiantes; avisarlo al subir.
- Para los mensajes ya enviados, el avatar se busca por el correo del autor, así no hay que reescribirlos.
- Las sesiones de suplantación del superusuario son de solo lectura, así que no pueden cambiar fotos.

## 4. Tamaño de letra
- 4 niveles: Normal (16 px), Grande (18 px), Muy grande (20 px) y, si se quiere, Gigante (22 px).
- Se guarda por usuario en `users/{correo}.tamanoLetra` y también en el navegador para que aplique al instante.
- Implementación: un solo valor `--chat-fs` en la raíz, y el chat pasa de `text-xs/text-sm` a tamaños en `rem` que dependen de él. Cambia el chat entero con una variable, sin tocar cada línea por separado.
- Control: un selector de 3-4 botones «A A A» dentro del chat (engranaje en la cabecera), y la misma opción en Configuración.
- Opcional para toda la app: fijar el `font-size` del `html` según el nivel. Todo lo que use `rem` (Tailwind) escala solo; lo que esté en `px` fijo no escalará y habría que revisarlo. Recomiendo empezar solo con el chat y extender después.
- Además, subir la base: hoy se lee a 12-14 px; el mínimo debería ser 15 px en el celular con interlineado de 1.4.

## 5. Tipo de letra
Hoy usa Inter con respaldo del sistema (`index.css:132`). Conviene conservarla: es muy legible en pantalla. Opciones:
- Mantener Inter (recomendado como defecto): ya está y se ve limpia.
- Atkinson Hyperlegible: la diseñó el Braille Institute para baja visión; distingue letras que se confunden (I, l, 1, O, 0). Muy buena para quienes se quejan de ver pequeño.
- Fuente del sistema (Roboto en Android): más liviana y nítida en el celular.
Propuesta: añadir en el mismo selector del tamaño un interruptor «Letra de fácil lectura» que cambie a Atkinson. Quien no lo necesite no nota nada. Costo S; requiere incluir el archivo de la fuente en la app o cargarlo desde Google Fonts (sin tener la fuente alojada aparte).

## 6. Propuesta por etapas
Etapa 1 (mayor valor, menor costo; ~2 días):
1. Tamaño de letra de 3 niveles y base de 15-16 px en el chat, guardado por usuario.
2. Avatares con iniciales y color estable en lista, cabecera, mensajes y resumen de Inicio.
3. Hora y contador numérico de no leídos en la lista de chats.
4. Separadores «Hoy / Ayer» y agrupar mensajes consecutivos (el nombre y avatar solo en el primero).

Etapa 2 (~2-3 días): foto de Google guardada con consentimiento y foto propia opcional; interruptor Atkinson; ✓✓ en vez de «Leído por N»; selector de emojis al escribir; silenciar chats.

Etapa 3: chats fijados, búsqueda dentro de mensajes, «escribiendo…», fondo del chat, y extender el tamaño de letra a toda la app.

Antes de empezar: confirmar con Julián si la foto de Google puede usarse por defecto o solo con permiso.
