# V2 — Pasos de consola para Julián (no hay que programar)

La extensión V2 ya está construida. Para que funcione con la cuenta institucional faltan estos pasos en consolas. Al final, avise a Claude con el `client_id` y la clave pública para dejar la versión lista.

ID de la extensión en la tienda: `jefcakofmibkmfhdkgiehbjebkoifpoc`
Proyecto de Firebase / Google Cloud: `mjb-prestamos`

## 1. Clave pública de la tienda (para que la copia descomprimida tenga el mismo ID)
1. Abra el panel de desarrolladores de la Chrome Web Store, entre a la extensión «MJB → Máster 2000».
2. Menú de la izquierda: **Paquete** (Package). Busque «Clave pública» / «View public key».
3. Copie el texto de la clave (una línea larga; con o sin las líneas «BEGIN/END PUBLIC KEY» sirve).
4. Péguelo en un archivo nuevo `extension-master2000/clave-publica.txt` (en la carpeta del proyecto). El `build` la agrega sola al manifest como `"key"`.
   (Si la extensión se instala solo desde la tienda, este paso es para probar copias descomprimidas.)

## 2. ID de cliente OAuth tipo «Extensión de Chrome»
1. Entre a https://console.cloud.google.com con la cuenta dueña del proyecto y elija el proyecto **mjb-prestamos**.
2. Menú **APIs y servicios → Credenciales**.
3. **Crear credenciales → ID de cliente de OAuth**.
4. Tipo de aplicación: **Extensión de Chrome**.
5. Nombre: por ejemplo «Extensión MJB Máster 2000».
6. **ID del elemento**: `jefcakofmibkmfhdkgiehbjebkoifpoc`. Crear.
7. Copie el **ID de cliente** (termina en `.apps.googleusercontent.com`).
8. Envíeselo a Claude (o reemplácelo usted en `extension-master2000/manifest.json`, campo `oauth2.client_id`, donde hoy dice `PENDIENTE_CLIENT_ID.apps.googleusercontent.com`). Luego `npm run pack:extension` y subir el .zip a la tienda.

## 3. Restricción de la API key web
1. En la misma consola: **APIs y servicios → Credenciales**, abra la **clave de API** que usa la app web de MJB (la «Browser key» de Firebase).
2. Mire **Restricciones de la aplicación**.
   - Si dice **Ninguna**: no hay nada que hacer.
   - Si dice **Sitios web (referentes HTTP)**: añada el referente `chrome-extension://jefcakofmibkmfhdkgiehbjebkoifpoc/*` y guarde.
3. En **Restricciones de API**, si está limitada a ciertas APIs, confirme que está incluida **Identity Toolkit API** (la extensión inicia sesión con ella).
   (Los cambios tardan unos minutos en aplicarse.)
   Nota: una petición hecha desde el service worker de una extensión lleva como origen `chrome-extension://<id>`; si el inicio de sesión falla con «API key not valid / referer blocked», es este paso.

## 4. Pantalla de consentimiento OAuth
1. **APIs y servicios → Pantalla de consentimiento de OAuth**.
2. Tipo de usuario: **Interno** (solo cuentas del dominio iemanueljbetancur.edu.co). Así no hace falta verificación de Google.
3. Los alcances `openid`, `email` y `profile` son básicos y no requieren más configuración.
4. Guardar.

## Comprobación final (con Claude)
Con Chrome abierto con su cuenta institucional, abrir el Máster, pulsar **Cargar**: debe verse la vista previa de 11.2 sin elegir ningún archivo y los 15 ya subidos como «igual».
Si Chrome pide permiso o falla el inicio de sesión, cópiele el mensaje a Claude.
