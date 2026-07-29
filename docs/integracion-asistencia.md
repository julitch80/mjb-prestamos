# Integración del módulo de Asistencia en MJB Préstamos

Documento de contrato para el equipo (o la sesión) que desarrolla el módulo de
asistencia en un repositorio aparte. Define qué se entrega, qué está prohibido y
cómo se enchufa, para que la absorción en la app principal sea un pegado
mecánico y no una reescritura.

**Regla que ordena todo lo demás:** el módulo de asistencia es un **componente
de MJB Préstamos**, no una aplicación. Se desarrolla aparte por comodidad, pero
su destino es vivir dentro de `src/` de este repositorio, como una sección más
del menú. Todo lo que se escriba asumiendo que es una app independiente (su
propio login, su propio header, su propio tema, su propio router) hay que
tirarlo a la basura en la integración.

---

## 1. Reparto de responsabilidades

| Asunto | Dueño | Nota |
|---|---|---|
| `firestore.rules` | **mjb-prestamos** | Un solo archivo por proyecto. Asistencia entrega su bloque; NO despliega. |
| `storage.rules` | **mjb-prestamos** | Igual que arriba. |
| Índices de Firestore | **mjb-prestamos** | Asistencia entrega los que necesite declarados. |
| Cloud Functions | Compartido, **acotado por codebase** | Préstamos = `default`. Asistencia = `asistencia`. |
| Autenticación y usuarios | **mjb-prestamos** | Asistencia no crea usuarios ni toca `users/`. |
| Interfaz del módulo | **asistencia** | Con las restricciones de la sección 4. |
| Modelo de datos de asistencia | **asistencia** | Documentado según sección 5. |

### Comandos prohibidos desde el repositorio de asistencia

```
firebase deploy --only firestore:rules
firebase deploy --only storage:rules
firebase deploy --only functions
```

Los tres son destructivos. Firestore admite **un solo archivo de reglas por
proyecto**: el despliegue reemplaza, no fusiona. Y `--only functions` sin acotar
borra las funciones de los demás codebases — incluidas `beforecreated` y
`beforesignedin`, que son las que restringen el acceso al dominio
institucional. Borrarlas no tumba la app: **la deja abierta a cualquier cuenta
de Google.**

El único despliegue permitido desde asistencia:

```
firebase deploy --only functions:asistencia
```

---

## 2. Datos del proyecto Firebase

Mismo proyecto que la app principal: `mjb-prestamos`. La configuración web
(`apiKey`, `authDomain`, etc.) es pública y va en el bundle; no es un secreto.
Se obtiene en la consola: ⚙ Configuración del proyecto → General → Tus apps →
Configuración del SDK.

El `serviceAccountKey.json` **no se usa nunca en código de aplicación**. Salta
todas las reglas. Solo para scripts de siembra puntuales, y se borra después.

---

## 3. Contratos de datos que hay que respetar

Estos no son detalles de estilo: si se ignoran, el módulo no cruza con nada.

**La identidad es el correo en minúsculas, no el UID de Firebase Auth.**
Los documentos de usuario están indexados por correo:
`users/julian.medina@iemanueljbetancur.edu.co`. Cualquier código que asuma UIDs
no encontrará nada.

**Puesto ≠ persona.** Los horarios, la asignación académica y los directores de
grupo referencian *puestos* internos estables (`julian`, `carlos`, `johana`),
no personas. Quién ocupa un puesto hoy se resuelve por
`users/{email}.slotId`. Si asistencia cruza con horarios, tiene que pasar por
esa indirección; si referencia correos directamente, se rompe el día que un
docente sea reemplazado.

**`active: false` es la baja lógica.** No se borran usuarios. Las reglas exigen
`active == true`. Un módulo que ignore ese campo le pasará lista a docentes
retirados.

**Sede y jornada están en el documento del usuario.** Campos `sede`
(`central` | `gustavo_rodas` | `la_finquita`) y `jornada`
(`manana` | `tarde` | `ambas`).

**Los grados distinguen jornada por notación.** Mañana usa punto (`9.1`, `10.2`,
`11.3`); tarde usa ordinal (`6º1`, `7º2`, `8º3`). La app detecta jornada con
`grado.includes('º')`. Respetarlo o el módulo mostrará grupos de la jornada
equivocada.

**Los bloques horarios difieren por jornada.** Seis bloques en cada una, con
horas distintas, más dos recreos. Están en `src/data/maestros.ts` como
`BLOQUES_MANANA` y `BLOQUES_TARDE`. No redefinirlos.

**El horario base son 600 entradas** en `src/data/horarioBase.ts`, con forma
`{ dia, bloque, jornada, docente, grado, aula }`. Es la fuente para saber quién
debería estar dónde. Ojo: puede estar modificado temporalmente para un día
concreto (ausencias) — ver `src/data/horarioModificado.ts`.

---

## 4. Restricciones técnicas del código

Lo que sigue es lo que hace que el pegado sea mecánico.

**Prohibido:**

- `initializeApp()` propio. Se importa de `src/lib/firebase.ts`, que ya exporta
  `app`, `auth`, `db`, `functions`, `firebaseConfigurado` y `esperarAuth()`.
- Router (react-router o similar). La app navega con un campo del store, no con
  URLs. Ver sección 6.
- Otra librería de estado. El estado global es **Zustand**, en
  `src/data/store.ts`. El estado local de un componente sí puede ser `useState`.
- Otro sistema de color. Ver sección 5.
- Header, login, selector de tema o de sede propios. Ya existen y son globales.
- Dependencias npm nuevas sin avisar antes. Cada una hay que justificarla.

**Obligatorio:**

- **Esperar a que Firebase resuelva la sesión antes de leer Firestore.** Al
  recargar, el store persistido conoce al usuario cientos de milisegundos antes
  de que `auth.currentUser` exista; toda lectura disparada en ese hueco falla en
  silencio. Usar `await esperarAuth()` de `src/lib/firebase.ts`. Este error ya
  dejó el chat vacío una vez.
- Nombres de archivo y carpeta en **ASCII** (sin acentos ni ñ).
- **Identificadores en inglés, interfaz en español, comentarios en español.**
- Componentes funcionales con hooks.
- Todo el módulo autocontenido en **una sola carpeta**: `src/asistencia/`, con
  un único componente raíz exportado por defecto que no reciba props
  obligatorias. Ese es el punto de pegado.

---

## 5. Sistema visual

No hay colores literales en el código de interfaz. Se usan tokens semánticos
que ya resuelven modo claro y oscuro. Están definidos en `src/index.css` y se
consumen como clases de Tailwind (`bg-card`, `text-muted`, `border-line`…):

**Superficies:** `app`, `card`, `elevated`, `hover`
**Texto:** `strong`, `soft`, `muted`
**Bordes:** `line`, `line-strong`
**Semánticos**, cada uno con variantes `-soft` y `-soft-fg`:
`accent`, `info`, `success`, `warning`, `danger`, `purple`

Ejemplo de tarjeta correcta:

```tsx
<div className="rounded-xl border border-line bg-card p-3">
  <p className="text-sm text-strong">Título</p>
  <p className="text-xs text-muted mt-0.5">Detalle</p>
</div>
```

Un `bg-gray-800` o un `text-white` sueltos son un defecto: se ven mal en modo
claro. El modo claro de la app ya está pensado con estos tokens.

Los iconos son SVG de línea propios, en `src/components/IconosNeon.tsx`
(viewBox 24×24, trazo 1.5, `currentColor`). Si el módulo necesita iconos
nuevos, se agregan ahí con el mismo trazo. No traer una librería de iconos.

---

## 6. Cómo se enchufa (los cuatro puntos de pegado)

La integración final toca exactamente cuatro sitios. Conviene que el módulo se
escriba sabiendo esto:

1. **`src/data/store.ts`** — agregar `'asistencia'` al tipo `VistaActual`.
2. **`src/App.tsx`** — agregar una entrada a `NAV_ITEMS` con `id`, `label`,
   `descripcion` y los `roles` que pueden verla.
3. **`src/App.tsx`** — una rama de render:
   `{vistaActual === 'asistencia' && <Asistencia />}`.
4. **`src/components/IconosNeon.tsx`** — icono y color de acento para la sección
   en el mapa `NEON_NAV`, para que aparezca en el panel de inicio.

La navegación se hace con `setVistaActual('asistencia')` desde el store, nunca
con URLs.

---

## 7. Lo que hay que entregar

1. **Carpeta `src/asistencia/`** autocontenida, con el componente raíz.
2. **Bloque de reglas de Firestore**, en un archivo aparte, con solo los
   `match` del módulo. Sin `rules_version`, sin `service cloud.firestore`, sin
   redefinir los helpers (`callerEmail`, `isInstitutional`, `callerDoc`,
   `isActiveUser`, `isSuper`) — se reusan los existentes. **No pegarlo después
   de la regla `match /{document=**}`**: esa niega todo lo no declarado y va
   siempre al final; un bloque colocado detrás queda muerto sin dar error.
3. **Índices compuestos** que necesiten las consultas, declarados.
4. **Documento del modelo de datos**: colecciones, campos, tipos, qué rol lee y
   qué rol escribe cada uno.
5. **Funciones** (si hay) en su propio codebase `asistencia`.
6. **Lista de dependencias npm nuevas**, si hay, con justificación.

### Nota sobre el costo de los helpers

`callerDoc()` hace un `get()` a `users/{email}`, y **eso es una lectura
facturable cada vez que se evalúa una regla**. En operaciones por lotes sobre
muchos documentos (pasar lista de un grupo completo, por ejemplo) se multiplica.
Conviene diseñar las escrituras de asistencia como pocos documentos grandes —
por ejemplo, un documento por grupo/fecha/bloque con el listado dentro — en vez
de un documento por estudiante y hora. Esto es una decisión de modelado que hay
que tomar temprano, no al final.

---

## 8. Dos advertencias sobre el dominio, no sobre el código

**La taxonomía de asistencia no se puede inventar.** Las categorías (ausencia
justificada, excusa médica, calamidad doméstica, permiso institucional, llegada
tarde, evasión de clase, retiro autorizado…) tienen definiciones institucionales
y consecuencias distintas en el colegio. Hay que **pedírselas a Julián** y
modelarlas explícitamente, no deducirlas. Un módulo con las categorías
equivocadas genera reportes que no sirven para nada oficial.

**Es un registro sobre menores de edad.** La asistencia estudiantil es un dato
personal de menores, con implicaciones legales en Colombia distintas a las de
los datos de docentes que maneja el resto de la app. Antes de definir el
modelo hay que decidir con Julián: quién puede ver el histórico de un
estudiante, cuánto tiempo se conserva, si se exporta y a dónde. Estas
decisiones se toman antes de escribir las reglas, porque las reglas las
implementan.

---

## 9. Lista de verificación antes de entregar

- [ ] `npm run build` pasa sin errores ni advertencias nuevas.
- [ ] No hay `initializeApp` en el módulo.
- [ ] No hay colores literales; todo con tokens.
- [ ] Se ve bien en modo claro **y** oscuro.
- [ ] Se ve bien en 375 px de ancho sin desbordar la pantalla. Las tablas
      anchas llevan su propio `overflow-x-auto` interno.
- [ ] Toda lectura de Firestore espera `esperarAuth()`.
- [ ] Ninguna consulta asume UIDs; todo va por correo en minúsculas.
- [ ] El bloque de reglas no redefine helpers ni va después del catch-all.
- [ ] Nombres de archivo en ASCII.
- [ ] No se ejecutó ningún `firebase deploy` de reglas ni de functions sin
      acotar el codebase.
