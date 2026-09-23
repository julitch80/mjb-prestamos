# Calendario de tareas — pasos en las consolas de Google (los hace Julián)

Son tres partes. Solo la segunda se hace con `admin.asistencia@iemanueljbetancur.edu.co`.
Ninguna crea archivos de claves ni contraseñas.

## Parte 1 — Google Cloud, proyecto `mjb-prestamos` (con tu cuenta de siempre)

1. **Activar dos APIs.** Abre cada enlace y pulsa **Habilitar**:
   - https://console.cloud.google.com/apis/library/calendar-json.googleapis.com?project=mjb-prestamos
   - https://console.cloud.google.com/apis/library/iamcredentials.googleapis.com?project=mjb-prestamos
2. **Crear la identidad de la función.**
   https://console.cloud.google.com/iam-admin/serviceaccounts/create?project=mjb-prestamos
   - Nombre: `calendario-tareas` (el id queda `calendario-tareas@mjb-prestamos.iam.gserviceaccount.com`).
   - **Crear y continuar.** En «Otorga a esta cuenta de servicio acceso al proyecto», agrega el
     rol **Usuario de Cloud Datastore** (para leer las fichas y guardar el estado).
   - **Listo.**
3. **Que pueda firmar su propio acceso (sin archivo de clave).**
   - En la lista de cuentas de servicio, abre `calendario-tareas` → pestaña **Permisos** (o
     «Principales con acceso») → **Otorgar acceso**.
   - Principal: `calendario-tareas@mjb-prestamos.iam.gserviceaccount.com`
   - Rol: **Creador de tokens de cuenta de servicio**. Guardar.
4. **Copiar el ID de cliente.** En la pestaña **Detalles** de `calendario-tareas`, copia el
   **ID único** (un número largo, de unos 21 dígitos). Se usa en la Parte 2.

## Parte 2 — Consola de administración de Workspace (con admin.asistencia@)

1. https://admin.google.com → **Seguridad → Acceso y control de datos → Controles de API**.
2. **Administrar la delegación de todo el dominio → Agregar nuevo.**
3. ID de cliente: el número de la Parte 1, paso 4.
4. Permisos de OAuth (uno solo, copiarlo exacto):
   `https://www.googleapis.com/auth/calendar.app.created`
5. **Autorizar.** (Puede tardar unos minutos, a veces hasta una hora, en tomar efecto.)

Ese alcance solo permite crear calendarios y manejar los que la aplicación creó. No da
acceso al calendario principal ni a ningún otro calendario de los estudiantes.

## Parte 3 — Avísale a Claude

Con las Partes 1 y 2 listas, Claude despliega la función (`--only functions:calendario`) y
te pasa el documento de configuración para arrancar en modo simulación con 10.1.
