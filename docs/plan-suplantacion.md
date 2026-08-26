# Suplantación real de solo lectura — especificación

Acordado con Julián el 2026-08-25. Sustituye la simulación actual, que engaña a la
interfaz pero no al servidor.

## 1. El problema

`simularUsuario` (`src/data/store.ts`) solo cambia estado local de Zustand. El token
de Firebase no se toca, así que Firestore sigue evaluando `request.auth.token.email`
= el correo del superusuario. Y las reglas excluyen al superusuario de leer asistencia
a propósito (`firestore.rules`: *"su clave es transferible, así que sus actos no serían
atribuibles a una persona física"*).

Resultado: la interfaz se disfraza de docente, el servidor niega los datos, y las
planillas salen vacías. Funciona como se diseñó y aun así es inservible.

## 2. La solución

Una Cloud Function emite un **token personalizado** de Firebase para el usuario
objetivo. El navegador inicia sesión con ese token, y a partir de ahí el servidor
también lo ve como esa persona. Las reglas se evalúan igual que para ella: se ve
exactamente lo que ella ve, ni más ni menos.

La atribución se preserva con una marca dentro del token y una regla que **niega toda
escritura** mientras esa marca esté presente. Se suplanta para mirar, nunca para actuar.

## 3. Lo que NO cambia

Ninguna de las capacidades actuales del superusuario se toca. Inventario levantado del
código el 2026-08-25:

- **Firestore (15):** crear/editar usuarios y roles; leer `auditLogs`; leer/escribir
  `config`; crear y editar canales de chat y ocultar mensajes; crear y editar fichas de
  estudiantes; crear y editar matrículas; periodos; catálogo; `asistenciaConfig`
  completo; leer llegadas tarde, contactos con familias, historiales y revisiones de
  importación; administrar programas.
- **Storage (2):** subir y leer `/asistencia/imports/`; leer el histórico de fotos.
- **Functions (2 exclusivas):** `importStudents`, `eliminarEvento`.
- **Interfaz:** el panel de superusuario y sus entradas en 6 puntos de la app.

Al salir de la suplantación se vuelve a ser superusuario con todo intacto. No hay nada
que reconstruir.

**Contrapartida aceptada por Julián:** mientras se suplanta NO se puede subir fotos ni
importar estudiantes. Es el punto, no un defecto: conservar los poderes propios sería
seguir viendo lo de uno con otra máscara.

## 4. Diseño

### 4.1 Cloud Function `suplantar` (codebase `default`)

```
suplantar({ correo }) -> { token }
```

Cerrojos, en este orden y todos obligatorios:

1. `request.auth` presente.
2. El llamante existe en `users/`, está `active` y tiene `role == 'superusuario'`.
   Se lee de Firestore con el Admin SDK, nunca de un claim del cliente.
3. **El llamante NO puede venir ya suplantando.** Si su token trae `suplantadoPor`,
   se rechaza. Sin esto, la suplantación sería encadenable y la marca se podría lavar.
4. El correo objetivo es del dominio `@iemanueljbetancur.edu.co`, existe en `users/`
   y está `active`.
5. El objetivo NO es superusuario (no se suplanta a un par: no aporta y amplía el daño
   de un error).

Emite `createCustomToken(uidObjetivo, { suplantadoPor: <correo del superusuario> })`.

⚠️ **Verificar durante la implementación, no asumir:** si las funciones bloqueantes
`beforesignedin`/`beforecreated` se ejecutan al entrar con token personalizado. Si no
lo hacen, hay que replicar aquí la validación de dominio institucional.

Cada emisión se registra en `auditLogs` con Admin SDK (las reglas ya prohíben que
escriba el cliente): quién suplantó a quién y cuándo.

`invoker: 'public'` explícito en las opciones del `onCall`. Sin eso Cloud Run deja el
servicio en "Requiere autenticación" y el navegador recibe un `internal` opaco — ya
pasó con `replaceTeacher`, `crearEstudianteManual`, `eliminarEvento` y
`borrarSesionesDeCruce`.

### 4.2 Reglas de Firestore

Un helper y su uso en TODAS las escrituras:

```
function esSuplantacion() {
  return request.auth != null
    && 'suplantadoPor' in request.auth.token;
}
```

La forma más segura de aplicarlo es en la raíz: que ninguna regla de escritura pase si
`esSuplantacion()`. Como Firestore no permite un `deny` global, se añade
`&& !esSuplantacion()` a cada `allow write/create/update/delete`.

**Las lecturas no se tocan.**

### 4.3 Storage

Mismo criterio: negar escritura cuando el token traiga la marca.

### 4.4 Cliente

- Botón "Ver como…" en el panel de superusuario, con buscador de usuario.
- Al elegir: llamar `suplantar`, `signInWithCustomToken`, recargar.
- **Barra fija y muy visible** en toda la app mientras dure, con el nombre de quien se
  está viendo y un botón de salir siempre accesible. La actual es un aviso dentro de una
  pantalla; ésta no puede perderse de vista.
- Salir: `signOut` + volver a entrar con Google.
- **Retirar `simularUsuario`, `identidadReal`, `entrarModoDocente` y
  `volverModoSuperusuario`** del store, y el aviso viejo. Dejar los dos mecanismos
  conviviendo es lo que trajo el problema.

## 5. Lotes

| Lote | Archivos | Criterio de hecho |
|---|---|---|
| 1. Función | `functions/src/index.ts` | Rechaza a quien no es superusuario; rechaza suplantación encadenada; registra en `auditLogs` |
| 2. Reglas | `firestore.rules`, `storage.rules` | Con la marca en el token, toda escritura se niega; las lecturas siguen igual |
| 3. Cliente | `PanelSuperusuario.tsx`, `App.tsx`, `store.ts`, `lib/auth.ts` | Se entra y se sale; la barra no se pierde de vista; el mecanismo viejo ya no existe |

El Lote 1 va primero y define el contrato. El 2 se despliega ANTES que el 3: si el
cliente supiera suplantar antes de que las reglas nieguen la escritura, habría una
ventana en la que se podría escribir suplantando.

## 6. Riesgo asumido

Es la capacidad más peligrosa de la aplicación: un error aquí es que cualquiera sea
cualquiera. Por eso los cinco cerrojos, la auditoría y el bloqueo total de escritura.
Antes de dar por bueno el Lote 1 hay que probar con `curl` que un docente cualquiera
recibe `permission-denied` al llamar `suplantar`.
