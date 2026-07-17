# Seed de usuarios en Firestore (Etapa 2 — auth Google)

Este script (`seed-users.mjs`) prepara la colección `users` de Firestore
para que las Cloud Functions `beforecreated` / `beforesignedin`
(`functions/src/index.ts`) puedan autorizar el login con Google Workspace
institucional. Sin un documento `users/{email}` con `active: true`, el
login queda bloqueado.

## 1. Preparar el CSV

Crea un archivo `docentes.csv` (en la raíz del repo, o donde prefieras) con
las columnas `email,displayName,role` y, opcionalmente, `slotId`, `sede` y
`jornada`:

```csv
email,displayName,role,slotId,sede,jornada
julian.medina@iemanueljbetancur.edu.co,Julián David Medina Tamayo,superusuario,julian,central,manana
janneth.ocampo@iemanueljbetancur.edu.co,Janneth Astrid Ocampo Carvajal,coordinador,,central,manana
juan.salazar@iemanueljbetancur.edu.co,Juan Diego Salazar Rendón,coordinador,,central,tarde
mjb@iemanueljbetancur.edu.co,Nancy Adriana Herrera López,rectora,,central,ambas
johana.cano@iemanueljbetancur.edu.co,Leidy Johana Cano Ruiz,docente,johana,central,manana
```

Roles sugeridos: `superusuario` (Julián), `rectora`, `coordinador`, `docente`.

`docentes.csv` está en `.gitignore` — nunca se sube al repositorio.

### ¿Qué es `slotId`?

Es el id interno del docente dentro de la app (el mismo `id` que usa cada
entrada de `USUARIOS` en `src/data/maestros.ts`, por ejemplo `julian`,
`carlos`, `monica_c`). Es lo que conecta la cuenta de Firestore con un
**puesto** en el horario: aulas, direcciones de grupo, acompañamientos y
reservas apuntan al `slotId`, no a la persona. Por eso, cuando alguien
reemplaza a un docente (Etapa 5, ver `docs/firebase-reemplazo-docente.md`),
basta con mover el `slotId` de una cuenta a otra desde el panel de
superusuario y todo el horario refleja el cambio al instante — sin editar
código.

Deja `slotId` vacío para: la rectora, los coordinadores, o cualquier
docente que aún no tenga puesto asignado en el horario (por ejemplo un
docente completamente nuevo, ver nota en `docs/firebase-reemplazo-docente.md`).

### ¿Qué es `sede`?

Fase A (arquitectura multi-sede): indica a qué sede pertenece el usuario.
Valores válidos: `central` (Sede Central, bachillerato — la única activa hoy),
`gustavo_rojas` (Gustavo Rojas Pinilla, primaria) o `la_finquita` (La
Finquita, primaria). Si se omite, se asume `central`. Ver
`docs/sedes-arquitectura.md` para el modelo completo.

### ¿Qué es `jornada`?

Jornada del usuario: `manana`, `tarde` o `ambas`. Se usa para la
segmentación automática de canales del chat interno (canales `segmento`,
ver más abajo): un docente queda suscrito automáticamente al canal de su
sede y al de su sede+jornada. Si se omite, se asume `manana`.

### Tabla de mapeo — id interno (`slotId`) ↔ correo institucional

Generada a partir de `src/data/maestros.ts` (`USUARIOS`), incluye
directivos y todos los docentes con correo registrado:

| slotId | Nombre | Correo |
|---|---|---|
| rectora | Nancy Adriana Herrera López | mjb@iemanueljbetancur.edu.co |
| coord_manana | Janneth Astrid Ocampo Carvajal | janneth.ocampo@iemanueljbetancur.edu.co |
| coord_tarde | Juan Diego Salazar Rendón | juan.salazar@iemanueljbetancur.edu.co |
| johana | Leidy Johana Cano Ruiz | johana.cano@iemanueljbetancur.edu.co |
| beatriz | Beatriz Elena Montoya Valdés | beatriz.montoya@iemanueljbetancur.edu.co |
| adolfo | Adolfo León Arango Arroyave | adolfo.arango@iemanueljbetancur.edu.co |
| gloria_a | Gloria Estella Álvarez López | gloria.alvarez@iemanueljbetancur.edu.co |
| doris | Doris Castrillón Álvarez | doris.castrillon@iemanueljbetancur.edu.co |
| marta | Marta Úsuga | martha.usuga@iemanueljbetancur.edu.co |
| julian | Julián David Medina Tamayo | julian.medina@iemanueljbetancur.edu.co |
| carlos | Carlos Cárdenas | carlos.cardenas@iemanueljbetancur.edu.co |
| yoguis | Juan Carlos Blandón Vargas | juancarlosbv@iemanueljbetancur.edu.co |
| jorge | Jorge Iván Acevedo Tabares | jorge.acevedo@iemanueljbetancur.edu.co |
| ledis | Ledis Laura Quintana Seguanes | ledis.quintana@iemanueljbetancur.edu.co |
| uriel | José Uriel López Arias | uriel.lopez@iemanueljbetancur.edu.co |
| claudia | Claudia Patricia Henao Bermúdez | claudia.henao@iemanueljbetancur.edu.co |
| margara | Margarita María Montoya Olaya | margarita.montoya@iemanueljbetancur.edu.co |
| monica_c | Mónica Tatiana Córdoba Zapata | monica.cordoba@iemanueljbetancur.edu.co |
| edgar | Edgar Alexis Pérez Jaramillo | edgar.perez@iemanueljbetancur.edu.co |
| carolina | Carolina Medina | carolina.medina@iemanueljbetancur.edu.co |
| monica_rave | Mónica Alexandra Rave Velásquez | monica.rave@iemanueljbetancur.edu.co |
| fredy_g | Fredy Gutiérrez | fredy.gutierrez@iemanueljbetancur.edu.co |
| fredy_garcia | John Fredy García Arrubla | john.garcia@iemanueljbetancur.edu.co |
| luis_javier | Luis Javier Rojas | luisjavierrojas@gmail.com |
| marina | Luz Marina Zapata Vásquez | luz.zapata@iemanueljbetancur.edu.co |
| luis_angel | Luis Ángel Quiceno | luis.quiceno@iemanueljbetancur.edu.co |
| juan_pablo | Juan Pablo Bettin Tapia | juan.bettin@iemanueljbetancur.edu.co |
| hugo | Hugo Armando Yepes Franco | hugo.yepes@iemanueljbetancur.edu.co |
| felipe | Felipe Piedrahita Nieto | felipe.piedrahita@iemanueljbetancur.edu.co |
| valentina | Valentina Jaramillo López | valentina.jaramillo@iemanueljbetancur.edu.co |
| yanet | Yanet María Moscote Marulanda | yanet.moscote@iemanueljbetancur.edu.co |
| harol | Harol Gómez | harol.gomez@iemanueljbetancur.edu.co |
| yuri | Yuri Catalina Gómez Gómez | yuri.gomez@iemanueljbetancur.edu.co |
| alexander | Jhon Alexander Sánchez Giraldo | alexander.sanchez@iemanueljbetancur.edu.co |

> Nota: si `src/data/maestros.ts` cambia (nuevos docentes, correos
> corregidos), esta tabla debe regenerarse manualmente a partir del
> arreglo `USUARIOS`.

## 2. Colocar la clave de servicio

1. Consola Firebase → ⚙ Configuración del proyecto → Cuentas de servicio →
   "Generar nueva clave privada".
2. Guarda el archivo descargado como `serviceAccountKey.json` en la raíz
   del repo (junto a `package.json`).
3. `serviceAccountKey.json` está en `.gitignore` — nunca se sube.

## 3. Ejecutar

```bash
node scripts/seed-users.mjs docentes.csv
```

El script sube los usuarios en lotes (batch) a `users/{email}` con
`active: true` y muestra en consola cada correo procesado.

## 4. Borrar la clave

Cuando termines, **borra `serviceAccountKey.json`** de tu máquina. No debe
quedar en el disco de forma permanente ni mucho menos subirse a git.

## Seed de canales del chat (Etapa 4 + segmentos/grupos)

Para crear los canales base del chat interno usa el mismo
`serviceAccountKey.json` y ejecuta:

```bash
node scripts/seed-channels.mjs
```

Crea (idempotente, `merge: true`):
- `channels/general` — "Sala de profesores", tipo `general` (todos).
- `channels/coordinacion` y `channels/directivos` — tipo `rol`
  (`allowedRoles: ['coordinador','rectora']` en `directivos`).
- 9 canales `segmento` (`seg__central`, `seg__central__manana`,
  `seg__central__tarde`, y los equivalentes para `gustavo_rojas` y
  `la_finquita`): membresía automática por `sede`/`jornada` del usuario, sin
  necesidad de agregar miembros manualmente. Los directivos
  (coordinador/rectora/superusuario) acceden a los 9.

Es seguro volver a correrlo (usa `merge: true`, no duplica ni borra). Los
canales directos (DM) y los canales de tipo `grupo` (creados desde el chat
por coordinadores, rectora o superusuario) no necesitan este script — se
crean desde la propia app.

## Notas

- Volver a correr el script con el mismo CSV es seguro (usa `merge: true`,
  no duplica ni borra usuarios existentes).
- Para desactivar a alguien sin borrar su cuenta de Auth, edita manualmente
  `users/{email}` en la consola de Firestore y pon `active: false`.
