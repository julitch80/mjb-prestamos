# Entregas desde la agenda pública — PRD

Plan Académico Especial (nombre interno `planCasa`). Aprobado por Julián el 28-oct-2026.
Debe quedar listo y probado antes del 3-nov-2026.

## Qué resuelve

Hoy el estudiante ve su agenda por QR pero entrega por WhatsApp y el docente marca a mano
«entregado». Con esto, el estudiante o su familia **sube la evidencia desde la misma agenda**,
el docente **la ve en su seguimiento** y la app **marca el paso como entregado** sola.

## Decisiones (de Julián)

| Tema | Decisión |
|---|---|
| Tipos | Fotos (jpg, png, heic, webp), audios (mp3, m4a, ogg, webm, wav) y PDF. |
| Videos | No se suben: el estudiante pega un enlace (Drive o YouTube). |
| Fotos | Se reducen en el celular a ~1600 px y JPEG antes de enviar. |
| Tope | 10 MB por archivo; máximo 20 envíos por día por plan (día de Colombia). |
| Retención | Hasta el fin del año lectivo: cada entrega guarda `borrarDespuesDe` = 31-dic 23:59 (Colombia). El borrado automático queda como tarea (ver abajo). |
| Varios envíos | Se guardan todos; el docente ve el más reciente arriba con la fecha de cada uno. |
| Privacidad | Solo abren los archivos: los docentes de **esa guía**, el equipo UAI/orientación (`planCasaConfig/equipo`), coordinación, rectora y superusuario. Nunca URL pública permanente. |

## Cómo funciona (diseño final)

1. **Subir** — callable pública `planCasaSubirEntrega` (sin login: el token del QR es el secreto).
   El archivo viaja en base64 dentro de la llamada (10 MB ≈ 13,4 MB; el límite de Functions v2
   es 32 MB). **Se descartó la URL firmada de subida**: exigiría CORS del bucket y permisos IAM de
   firma, y no hace falta con este tamaño.
   La función valida: token → plan (y que no esté cerrado) → que el paso exista en la guía
   **aprobada** → tipo y tamaño → tope diario. Luego:
   - guarda el archivo en Storage `planesCasa/{planId}/entregas/{guiaId}/{pasoId}/{ms}-{nombre}`;
   - escribe `planesCasa/{planId}/entregas/{id}` (guiaId, pasoId, tipo, ruta, nombre, tamaño, creadoEn, borrarDespuesDe);
   - pone el seguimiento del paso en `entregado` (si ya estaba `revisado`, **lo deja revisado**) y guarda `entregadoEn`;
   - actualiza `entregadoEn` del paso en la copia pública, para el «✓ Entregado el …».
2. **Ver** — callable `planCasaVerEntrega` (con login): verifica el rol y **devuelve el archivo en
   base64**; el navegador lo abre como `blob:` local y lo descarta a los 5 minutos. Tampoco hay
   URL firmada: no hay enlace que se pueda reenviar, ni permiso IAM que configurar.
3. **Reglas** — Firestore: `entregas` la leen equipo, coordinación, rectora, superusuario y los
   docentes del plan (solo metadatos); **nadie la escribe** desde el cliente. Storage:
   `planesCasa/**` sin lectura ni escritura por cliente (todo pasa por las funciones).

## Pantallas

- **Agenda pública**, en cada paso: «Entregar» (elige foto, audio o PDF), «Tomar foto» (abre la
  cámara) y «Pegar enlace (video)». Muestra vista previa, «Enviando…», el resultado y los errores
  (muy grande, tipo no permitido, sin conexión, tope diario). Después: «✓ Entregado el …» y
  «Enviar otra versión».
- **Seguimiento del docente** (PlanCasaDocente): bajo cada paso, la lista de entregas (la última
  marcada), con fecha, tamaño y botón «Abrir». Los botones Pendiente/Entregado/Revisado y la
  observación siguen igual.
- **Tablero del equipo** (PanelPlanCasa): en cada guía, «Ver entregas (n)» agrupadas por paso con estado y observación.

## Cambios en el contrato (`src/data/planCasa/tipos.ts`)

Solo campos **opcionales** y tipos **nuevos**; nada existente cambió:
- `SeguimientoPaso.entregadoEn?` (lo escribe el servidor).
- `PlanPublico.pasos[].guiaId?` y `.entregadoEn?` — copias publicadas antes no los traen y la
  agenda oculta el botón hasta que se **vuelva a publicar** el plan.
- Nuevos: `SUB_ENTREGAS`, `TipoEntrega`, `EntregaPlan`, `EntradaSubirEntrega`, `SalidaSubirEntrega`, `EntradaVerEntrega`, `SalidaVerEntrega`.

Lógica pura compartida (cliente y servidor): `src/data/planCasa/entregas.ts`, con tests en `entregas.test.ts`.

## Criterios de aceptación

1. Desde un celular, en la agenda de un plan publicado, una foto se sube y aparece «✓ Entregado el …» sin recargar.
2. Al recargar la agenda, el «✓ Entregado» sigue ahí.
3. El docente de la guía ve la entrega bajo el paso, con fecha, y «Abrir» la muestra; el paso quedó en «Entregado».
4. Si el docente ya lo había marcado «Revisado», una entrega nueva aparece en la lista y el estado sigue «Revisado».
5. Un PDF de más de 10 MB, un video o un .exe se rechazan con un mensaje claro; un video sugiere pegar el enlace.
6. El envío 21 del día responde «Ya se enviaron 20 archivos hoy…».
7. Un docente que no es de esa guía no puede abrir el archivo (la función responde «No tiene permiso»).
8. Sin conexión, la agenda dice «Sin conexión a internet…» y no pierde el archivo elegido.
9. Un plan cerrado no recibe entregas.

## Pendiente documentado

- **Borrado al fin del año lectivo**: tarea programada (o regla de ciclo de vida del bucket por
  prefijo `planesCasa/` con fecha fija) que borre archivos y registros con `borrarDespuesDe` vencido.
- Las copias públicas anteriores necesitan **«Publicar» otra vez** para traer `guiaId` (sin eso no hay botón).
- La lectura de metadatos (`entregas`) es por plan, no por guía: un docente del plan ve el nombre y la fecha de entregas de otra guía, pero **no puede abrir el archivo** (eso sí se verifica por guía).
- `planCasaVerEntrega` reutiliza `llamante()`: niega durante una suplantación y a usuarios en solo lectura.
