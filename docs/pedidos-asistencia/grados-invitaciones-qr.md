# Pedido para la sesión de asistencia — Grados: invitaciones con QR y aforo (24-nov-2026)

De: Julián. Esta sesión (mjb-prestamos) no toca `src/asistencia/**`; se construye en
`D:\Proyectos\asitencia` y se integra según `docs/integracion-asistencia.md`.

## Objetivo
Controlar el ingreso a la ceremonia de grados de 11.° (11.1, 11.2, 11.3): cada estudiante
tiene 2 invitados; nadie entra con invitación falsa o reutilizada; se conoce el aforo en vivo.

## Qué ya existe y se reutiliza
- `students/{id}.fotoPath` (fotos de todos los de 11.°) y `Avatar`/`fotos.ts`.
- `EscanerQr.tsx` (BarcodeDetector + jsqr, con `pausado` para encadenar lecturas).
- La tarjeta de verificación con foto que ya se usa al pasar lista por QR.

## Decisión clave: QR de invitación DISTINTO al del carné
No reutilizar `qrToken` del carné: el carné circula y cualquiera con una foto de él
«tendría» la invitación. Crear un token aleatorio nuevo (≥128 bits) por estudiante:
`grados/{evento}/invitaciones/{token}` → `{studentId, cupos: 2, usados: 0, ingresos: [...]}`.
El QR solo lleva el token (o una URL con el token), nunca nombre ni datos.

## Funciones
1. **Botón «Grados»** en el panel → abre directamente el lector (cámara dentro de la app).
2. **Al leer:** foto grande + nombre + grupo + cupos restantes.
   - Botones **«Entra 1»** / **«Entran 2»** (solo los que queden).
   - Si `usados >= cupos`: foto + mensaje en ROJO «Ya ingresaron los dos invitados»
     (+ hora y quién registró los ingresos anteriores).
   - Token desconocido: rojo «Invitación no válida».
3. **El descuento se hace en transacción de Firestore** (o callable): dos celulares en dos
   puertas no pueden gastar el mismo cupo dos veces.
4. **Deshacer** el último ingreso (error del portero). Ampliar cupo > 2 solo coordinación,
   con motivo, queda en registro.
5. **Búsqueda manual por nombre** si el QR no lee (papel dañado) — mismo control de cupos.
6. **Pestaña «Aforo»:** contador en vivo (suma de ingresos por QR + manuales).
   - Ingreso manual con número y categoría (docentes, invitados especiales, otros) y quién lo registró.
   - Capacidad configurable; color verde / amarillo ≥80 % / rojo ≥100 %.
   - (Por confirmar con Julián) botón «Salió 1» para distinguir «adentro» de «ingresados».
7. **Invitaciones:** PDF imprimible por grupo, una invitación por estudiante con 2 cupos,
   QR + nombre del estudiante. Botón para regenerar el token de un estudiante (invalida el anterior).
8. **Permisos:** solo usuarios marcados como portería/coordinación pueden leer y registrar.
   Cada ingreso guarda `{cantidad, por, en, dispositivo}`.

## Datos y privacidad
Fotos de menores (Ley 1581): la foto solo se muestra a quien escanea autorizado; nada en
el QR. Ver el registro de ingresos tras el evento y archivarlo.

## Pendientes de decisión de Julián
- Fecha de la ceremonia y capacidad del sitio.
- ¿Graduandos cuentan en el aforo (suma manual o lectura de carné)?
- ¿Registrar salidas o solo entradas?
- ¿Invitación impresa, por correo, o ambas?

## Hecho cuando
- Leer una invitación de prueba muestra la foto correcta; «Entran 2» y nueva lectura → rojo.
- Dos celulares leyendo la misma invitación a la vez no superan 2 ingresos.
- El aforo suma QR + manuales y cambia de color al acercarse a la capacidad.
- Ensayo real en el sitio el día anterior con 3 invitaciones de prueba (no de estudiantes reales).

## Entrega a mjb-prestamos
Bloque de `firestore.rules` y cualquier función nueva (codebase `asistencia`) se entregan
para que mjb-prestamos los despliegue; no desplegar reglas desde asistencia.
