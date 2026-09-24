# PLAN técnico — Notificaciones en el celular

Deriva de PRD.md (aprobado 24-sep-2026). Explicado por consecuencias.

## Piezas
1. **Firebase Cloud Messaging (FCM)** — el servicio de Google que entrega la notificación
   al celular aunque la app esté cerrada. Gratis. Requiere una «llave web» (VAPID) que
   Julián genera una vez en la consola de Firebase.
2. **Service worker actual de la app** (el que ya la deja funcionar sin señal) aprende a
   recibir y mostrar notificaciones y a poner el punto/número en el ícono. No se crea un
   segundo service worker: dos se estorban.
3. **Codebase nuevo `notificaciones`** (functions-notificaciones/), aislado como
   `calendario`: si falla, no toca préstamos ni asistencia. Contiene:
   - `enviarPush` (interna): recibe destinatarios + tipo + texto, mira las preferencias y
     el silencio nocturno, y envía o encola.
   - disparador de **chat** (mensaje nuevo en `channels/*/messages`) → calcula quién puede
     ver el canal (misma lógica que las reglas: general, rol, segmento, directo, grupo),
     excluye al autor.
   - endpoint para el **Apps Script** (avisos de coordinación/rectoría, horario, reservas,
     sugerencias): el Apps Script, al crear una notificación, llama a este endpoint con un
     secreto compartido. Así los avisos que ya existen también llegan al celular sin
     rehacerlos.
   - programada a las 5:30 a. m.: entrega lo que se encoló de noche.
   - limpieza: los tokens de celulares que ya no existen se borran solos.
4. **Datos en Firestore** (reglas: cada persona solo lee/escribe lo suyo):
   - `users/{correo}/dispositivos/{id}`: el token de cada celular/computador.
   - `users/{correo}` campo `preferenciasNotif`: los interruptores por tipo.
   - `pushPendientes`: la cola nocturna (solo servidor).
5. **Interfaz**: tarjeta «Activa las notificaciones» (explica para qué y advierte no
   hacerlo en equipos compartidos) y pantalla «Mis notificaciones» con los interruptores.
   Al abrir la app se borra el número del ícono.

## Identidad
Las notificaciones del Apps Script usan el id corto del docente (`doris`); los usuarios
de Firebase se identifican por correo. El cruce ya existe: `users/{correo}.slotId`.

## Lo que hace Julián (una vez)
- Consola de Firebase → Configuración del proyecto → Cloud Messaging → Configuración
  web → **Generar par de claves**, y pasar la clave pública (no es secreta).
- Redesplegar el Apps Script cuando se le agregue la llamada al endpoint.
- Guardar el secreto compartido en las Propiedades del script (se le pasan los pasos).

## Verificación global
Criterios A1–A6 del PRD, con el celular Android de Julián primero (chat) y luego un iPhone.

## Riesgos conocidos
- iPhone: solo con la app en pantalla de inicio e iOS 16.4+.
- Algunos Android (Xiaomi, Huawei) retrasan notificaciones por ahorro de batería: se
  documenta cómo excluir la app del ahorro.
- Canal «general»: cada mensaje llega a ~35 personas. Si resulta ruidoso, cada quien lo
  apaga en «Mis notificaciones».
