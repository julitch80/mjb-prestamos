# Seed de usuarios en Firestore (Etapa 2 — auth Google)

Este script (`seed-users.mjs`) prepara la colección `users` de Firestore
para que las Cloud Functions `beforecreated` / `beforesignedin`
(`functions/src/index.ts`) puedan autorizar el login con Google Workspace
institucional. Sin un documento `users/{email}` con `active: true`, el
login queda bloqueado.

## 1. Preparar el CSV

Crea un archivo `docentes.csv` (en la raíz del repo, o donde prefieras) con
las columnas `email,displayName,role`:

```csv
email,displayName,role
julian.medina@iemanueljbetancur.edu.co,Julián David Medina Tamayo,superusuario
janneth.ocampo@iemanueljbetancur.edu.co,Janneth Astrid Ocampo Carvajal,coordinador
juan.salazar@iemanueljbetancur.edu.co,Juan Diego Salazar Rendón,coordinador
mjb@iemanueljbetancur.edu.co,Nancy Adriana Herrera López,rectora
johana.cano@iemanueljbetancur.edu.co,Leidy Johana Cano Ruiz,docente
```

Roles sugeridos: `superusuario` (Julián), `rectora`, `coordinador`, `docente`.

`docentes.csv` está en `.gitignore` — nunca se sube al repositorio.

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

## Notas

- Volver a correr el script con el mismo CSV es seguro (usa `merge: true`,
  no duplica ni borra usuarios existentes).
- Para desactivar a alguien sin borrar su cuenta de Auth, edita manualmente
  `users/{email}` en la consola de Firestore y pon `active: false`.
