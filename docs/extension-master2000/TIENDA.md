# Ficha de Chrome Web Store (copiar y pegar)

## Nombre
MJB → Máster 2000 · Centros de interés

## Resumen corto (máx. 132)
Lleva las valoraciones de centros de interés exportadas de MJB a la hoja optativa de la planilla del Máster 2000, con vista previa.

## Descripción detallada
Extensión de uso interno de la I.E. Manuel J. Betancur (San Antonio de Prado, Medellín).

Si eres docente de centros de interés, ya valoras a tus estudiantes en MJB. Esta extensión te evita copiar esas notas una por una en el Máster 2000.

Cómo funciona:
1. Entra al Máster 2000 con tu sesión de siempre y abre el panel académico docente.
2. Aparece el botón de la extensión. Selecciona el Excel de valoraciones que exportaste de MJB.
3. La extensión descarga tu planilla, cruza a los estudiantes por matrícula y te muestra una vista previa: qué cambia, qué solo está en el Máster y qué solo está en MJB. Las diferencias se marcan para que decidas.
4. Solo cuando confirmas, sube a la hoja optativa de tu planilla. Nada se envía sin tu clic.

Privacidad: todo ocurre en tu navegador y con tu propia sesión del Máster 2000. No se guarda nada, no se envía a servidores de MJB ni a terceros.

Disponible solo para cuentas del dominio iemanueljbetancur.edu.co.

## Categoría
Educación (alternativa: Productividad)

## Propósito único (single purpose)
Pasar las valoraciones de centros de interés del archivo Excel exportado de MJB a la hoja optativa de la planilla del docente en el Máster 2000.

## Justificación de permisos
- Permiso de host `https://*.master2000.net/*`: necesario para descargar la planilla del docente y volver a subirla con las valoraciones, usando la sesión que el propio docente ya tiene abierta. La extensión no pide ningún otro permiso (sin `storage`, `tabs`, `cookies` ni acceso a otros sitios).
- Script de contenido: se inyecta solo en `https://*.master2000.net/academicodocente/panel.php*` para mostrar el botón y la vista previa.
- Código remoto: no se usa. Todo el código va empaquetado en la extensión.

## Prácticas de datos (pestaña «Privacidad»)
- Tipo de dato que maneja: información educativa de estudiantes (nombres, matrícula, valoraciones). Marcar «Información personal identificable» / «Contenido del usuario» solo si el formulario lo exige para este caso.
- Uso: exclusivamente la función única descrita. Se procesa solo en memoria local del navegador del docente.
- No se transmite a terceros ni a servidores de MJB. No se venden ni transfieren datos. No se usan para publicidad, ni para evaluar solvencia ni para fines ajenos al propósito único.
- Marcar las tres certificaciones de cumplimiento de la política de datos de usuario.
- URL de la política de privacidad: https://julitch80.github.io/mjb-prestamos/privacidad-extension-master2000.html
- ¿Usa código remoto? No.

## Visibilidad
Privada → publicar solo para los usuarios del grupo/dominio `iemanueljbetancur.edu.co` (requiere que la cuenta de desarrollador pertenezca a ese Google Workspace o agregar el dominio en «Distribución»).

## Paquete
`npm run pack:extension` genera `extension-master2000/paquete/mjb-master2000-1.0.0.zip`. Súbelo en la pestaña «Paquete».

## Imágenes requeridas
- Ícono de la tienda 128x128: ya empaquetado (`extension-master2000/icons/icon-128.png`).
- Capturas: 1 obligatoria, hasta 5. Tamaño 1280x800 (o 640x400), PNG o JPEG, sin transparencia.
- Opcional: mosaico promocional pequeño 440x280.

### Cómo tomar las capturas (Julián)
1. Instala el paquete sin empaquetar (`extension-master2000/dist`) en chrome://extensions con «Modo desarrollador».
2. Abre el panel del Máster y carga un Excel de prueba (sin datos reales de estudiantes: usa nombres inventados o difumina).
3. Captura 1: el botón de la extensión en el panel. Captura 2: la vista previa con los contadores y diferencias.
4. Ajusta la ventana a 1280x800 (F12 → modo dispositivo → «Responsive» 1280x800) y captura con Ctrl+Mayús+P → «Capture screenshot».
5. Verifica que no se vean nombres, matrículas ni notas reales.

## Capturas listas
`docs/extension-master2000/capturas/` — `solo.png` (botón en el panel), `vista.png` (vista previa) y `cambios.png` (detalle de cambios). 1280x800, con matrículas y nombres **inventados** (panel del Máster simulado).

## Pasos de publicación (Julián, con la cuenta de desarrollador ya creada)
1. chrome.google.com/webstore/devconsole → **Nuevo elemento** → subir `extension-master2000/paquete/mjb-master2000-1.0.0.zip`.
2. Pestaña **Ficha de la tienda**: copiar nombre, resumen, descripción y categoría de arriba; subir el ícono 128 y las 3 capturas.
3. Pestaña **Privacidad**: propósito único, justificación de permisos, prácticas de datos y la URL de la política (publicada por Claude antes).
4. Pestaña **Distribución**: visibilidad **Privada** → «Solo usuarios de iemanueljbetancur.edu.co».
5. **Enviar para revisión**. Google tarda de horas a pocos días.
6. Cuando esté aprobada, copiar el **ID de la extensión** (32 letras) y pasárselo a Claude.

## Instalación obligatoria para los docentes (admin.google.com)
1. Dispositivos → Chrome → **Apps y extensiones** → **Usuarios y navegadores**.
2. Elegir la unidad organizativa de los docentes (o un grupo de prueba con solo Julián primero).
3. Botón **+** → «Agregar desde Chrome Web Store» → pestaña del dominio → elegir la extensión.
4. Política de instalación: **Instalación forzada**. Guardar.
5. Se instala sola en el Chrome de cada docente que inicie sesión con su cuenta institucional (puede tardar hasta un día; acelera reiniciando Chrome).
