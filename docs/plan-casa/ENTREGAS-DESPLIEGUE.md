# Entregas — orden de despliegue

Lo publica la sesión principal con la autorización de Julián. Ver ENTREGAS-PRD.md.

## Antes (verificación local)

```
npx tsc -b
npm run build
cd functions-plancasa && npx tsc && npx vitest run && cd ..
npx vitest run --testTimeout=60000        # 1 fallo conocido: horarios/revision.test.ts
npm run test:reglas                        # requiere Java 21+ (en este PC hay una versión anterior)
```

## Orden

1. **Reglas** (Firestore y Storage, archivos compartidos con asistencia — desplegar SOLO desde este repo):
   ```
   npx firebase deploy --only firestore:rules,storage
   ```
2. **Funciones** (nunca sin acotar):
   ```
   npx firebase deploy --only functions:plancasa
   ```
   Crea `planCasaSubirEntrega` y `planCasaVerEntrega` (invoker público; la autorización se comprueba dentro).
3. **App**: `git push` a `master` (build automático).
4. **Volver a publicar** cada plan activo (botón «Publicar» / QR del panel) para que la copia
   pública traiga `guiaId` y aparezca el botón «Entregar».

## Consola (Julián)

- **Nada de IAM ni CORS**: el diseño no usa URL firmadas (los archivos pasan por las funciones). No hace falta el rol «Creador de tokens de cuenta de servicio» ni `gsutil cors set`.
- **Bucket**: se usa el bucket por defecto `mjb-prestamos.firebasestorage.app` (el mismo de `firebase.json`). La cuenta de servicio de Functions ya tiene acceso por defecto; si al primer envío el log dice `403 storage.objects.create`, darle «Administrador de objetos de Storage» a la cuenta `…-compute@developer.gserviceaccount.com` sobre ese bucket.
- **Índice**: el conteo diario usa un rango sobre `creadoEn` y la búsqueda del plan usa `tokenPublico ==`: ambos son índices de un solo campo (automáticos). Si el log pide un índice, seguir el enlace del error.
- **Borrado anual (opcional, antes del 31-dic)**: en Cloud Storage → bucket → Ciclo de vida, regla «Borrar» con prefijo `planesCasa/` y condición de fecha de creación anterior al 1-ene del año siguiente; o pedir la tarea programada descrita en el PRD.

## Prueba en producción (después de desplegar)

1. Abrir la agenda de un plan de prueba desde el celular, «Tomar foto» → Enviar → ver «✓ Entregado el …».
2. Como docente de la guía: Seguimiento → ver la entrega → «Abrir».
3. Como docente ajeno a esa guía: «Abrir» debe negar.
4. Revisar el log: `npx firebase functions:log --only planCasaSubirEntrega`.
