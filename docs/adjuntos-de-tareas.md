# Adjuntos y descripción en las tareas

Agregado el 5 de agosto de 2026.

## Qué se agregó

- **Descripción** (máx. 500 caracteres): indicaciones breves para el estudiante.
- **Archivo adjunto** (máx. 10 MB): guías, talleres, plantillas.
- Ambos se ven en la **agenda pública del grupo**, la que se abre con el código QR.

## La decisión sobre visibilidad

La agenda del grupo **no pide contraseña**: se resuelve antes del login, porque los
estudiantes y las familias no tienen cuenta institucional. Por lo tanto:

> El enlace de descarga de un adjunto queda accesible para cualquiera que lo tenga.

Esto es deliberado y aprobado por Julián el 5 de agosto de 2026. No hay alternativa
real: exigir autenticación dejaría el archivo fuera del alcance de su destinatario.

La mitigación **no es técnica sino informativa**: la pantalla de subida muestra la
advertencia de forma permanente y visible, para que nadie publique ahí algo con datos
personales de estudiantes creyendo que es un espacio cerrado.

## Lo que las reglas NO pueden controlar

Las tareas viven en **Google Sheets**, y las reglas de Cloud Storage solo pueden
consultar Firestore. No hay forma de verificar en el servidor que quien sube un archivo
sea el dueño de esa tarea: lo máximo exigible es que sea un usuario institucional.

Se evaluó espejar las tareas a Firestore solo para poder afinar esto y **se descartó**:
cada espejo es otra fuente que se desincroniza en silencio, como ocurrió con el mapa de
directores y las fotos de asistencia.

---

## ⚠ Pendiente de configurar — limpieza de fin de año lectivo

Los adjuntos van bajo el prefijo `tareas/`, **separado de `chat/`**, así que la regla de
borrado a los 90 días del chat NO les aplica. Hoy no se borran nunca.

La política acordada es **conservarlos hasta el fin del año lectivo**. Eso se configura
como regla de ciclo de vida del bucket, en la consola de Google Cloud — no es código:

1. Consola de Google Cloud → Cloud Storage → bucket `mjb-prestamos-chat`
2. Pestaña **Lifecycle** → *Add a rule*
3. Acción: **Delete object**
4. Condición: **Age** = `300` días, y **Object name prefix** = `tareas/`

300 días aproxima un año lectivo (≈febrero a noviembre). Las reglas de ciclo de vida son
por antigüedad, no por fecha de calendario, así que no existe un "31 de noviembre" exacto.

Mientras esta regla no se configure, los archivos se acumulan indefinidamente. No es
urgente —el volumen es bajo— pero conviene hacerlo antes de que pase un año.

## Despliegue del backend

Las columnas `descripcion`, `adjuntoUrl` y `adjuntoNombre` se agregaron **al final** de
`TAREAS_HEADERS`, y `crearTarea` llama a `asegurarEncabezados_`, así que la hoja se
actualiza sola y las filas viejas siguen leyéndose. **Requiere redesplegar el Apps
Script** para que el cambio tome efecto.
