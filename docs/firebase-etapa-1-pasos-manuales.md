# Firebase — Etapa 1: pasos manuales (Fase 0)

Estos cimientos quedan instalados en el repo pero **inactivos**. La app actual con login por PIN
sigue funcionando exactamente igual hasta que se complete esta configuración y se active
explícitamente (`VITE_AUTH_MODE=google` y variables `VITE_FIREBASE_*` en `.env`).

## Pasos en consola

1. Crear proyecto en [console.firebase.google.com](https://console.firebase.google.com) (id sugerido:
   `mjb-prestamos`) y registrar una app web dentro del proyecto. Copiar el objeto `firebaseConfig`
   resultante a un archivo `.env` en la raíz (usar `.env.example` como plantilla).
2. Activar el plan **Blaze** (pago por uso) y configurar una alerta de presupuesto de **USD 5/mes**.
3. Crear **Firestore** en modo producción, región `us-central1`.
4. En **Authentication**, habilitar el proveedor **Google**. En *Authorized domains* añadir
   `julitch80.github.io` (`localhost` ya viene incluido por defecto).
5. Hacer el *upgrade* a **Firebase Authentication with Identity Platform** (necesario para poder usar
   *blocking functions* en la Etapa 2).
6. Instalar herramientas locales:
   ```
   npm i -g firebase-tools
   firebase login
   cd functions && npm install
   ```
   (el `npm install` dentro de `functions/` se hace una sola vez, de forma manual).
7. Ajustar `.firebaserc` con el project id real si difiere de `mjb-prestamos`.
8. Compartir la hoja de cálculo de MJB Préstamos como **Editor** con la cuenta de servicio de Compute
   (`PROJECT_NUMBER-compute@developer.gserviceaccount.com`) — se usará en la Etapa 5.
9. Desplegar:
   ```
   firebase deploy --only firestore:rules,firestore:indexes
   firebase deploy --only functions
   ```
   **Checkpoint:** la función callable `ping` debe responder `{ ok: true, ts: ... }`.

## Nota importante

Ninguno de estos pasos afecta la app en producción. El login por PIN actual permanece intacto;
`src/lib/firebase.ts` no se importa desde ningún componente todavía y se auto-desactiva
(`firebaseConfigurado = false`) si no hay variables de entorno `VITE_FIREBASE_*` configuradas.
