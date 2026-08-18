# Gestor de casos y seguimiento — especificación

Decidido con Julián el 2026-08-18. Cubre contención emocional y remisiones al
seguro estudiantil bajo un mismo mecanismo de caso + seguimiento.

Decisiones tomadas por Julián:
- Se arranca por el arreglo de seguridad (Lote 1), antes que la funcionalidad.
- La alerta de 8 días va **en la app Y por correo**.
- La pestaña se llama **"Casos"**.

---

## 0. Contexto de seguridad (motivo del Lote 1)

Hoy `listarInformesContencion` y `listarRemisionesSeguro` responden a cualquiera
que llame la URL `/exec`, **sin autenticación**. Se comprobó con `curl` y devolvió
los informes completos: nombre del estudiante, documento, teléfono y descripción
del caso. Son datos de salud mental de menores, y la URL `/exec` es pública (está
en el bundle JS que sirve GitHub Pages).

El backend ya tiene `verifyFirebaseIdToken_()`, que valida un idToken de Firebase
contra Identity Toolkit y exige dominio `@iemanueljbetancur.edu.co`. Solo no se
está usando en estas acciones. El frontend ya tiene el helper `conIdToken()` en
`src/data/api.ts`.

Filtrar en el frontend NO es suficiente: el dato ya salió del servidor.

---

## 1. Modelo de datos (Google Sheets, mismo backend Apps Script)

Los seguimientos viven junto a los informes, no en Firestore: partir un caso
entre dos backends sería peor de mantener, y la escala (decenas de casos al año)
no justifica la migración.

### Hoja nueva: `SeguimientosCasos`

```
id · casoId · casoTipo · fecha · autorId · autorNombre · texto · decision · proximaFecha · timestamp
```

- `casoTipo`: `'contencion' | 'seguro'`
- `decision`: `'programar' | 'cerrar'`
- `proximaFecha`: solo si `decision === 'programar'`

### Columnas nuevas en `InformesContencion` y `RemisionesSeguro`

```
estado · proximaRevision · cerradoPor · cerradoEn
```

- `estado`: `'abierto' | 'en_seguimiento' | 'cerrado'` (por defecto `'abierto'`)

⚠️ Al agregarlas hay que usar `asegurarEncabezados_` **y** armar la fila leyendo
el orden REAL de encabezados de la hoja (`sheet.getRange(1,1,1,getLastColumn())`),
nunca el orden de la constante en el código. Esto ya causó una fila corrupta en
producción: `asegurarEncabezados_` añade las columnas al final de la hoja física,
mientras la constante las tiene intercaladas, y `appendRow` llena por posición.

⚠️ La columna `grado` debe escribirse forzando texto plano con
`forzarColumnaTexto_`, porque Sheets convierte `"11.2"` en la fecha 11 de febrero.

---

## 2. Máquina de estados

```
abierto → en_seguimiento → cerrado
   ↑____________________________|   (reabrible)
```

- **abierto**: recién creado, sin seguimientos.
- **en_seguimiento**: tiene al menos un seguimiento y no se ha cerrado.
- **cerrado**: cerrado con nota final obligatoria.

---

## 3. Visibilidad — se aplica en el BACKEND, no solo en pantalla

| Quién | Ve |
|---|---|
| Coordinador | Casos de su jornada |
| Psicoorientador | Todos |
| Director de grupo | Casos de los grupos que dirige |
| Rectora | Todos (solo lectura) |
| Docente | Solo los que él mismo generó |

El backend identifica a quien pregunta por el **correo que devuelve
`verifyFirebaseIdToken_`**, nunca por un parámetro que mande el cliente.

Para resolver el rol desde Apps Script (que no puede leer Firestore):
- Coordinadores, rectora y psicoorientador: comparar contra `CONFIG.COORD_MANANA`,
  `CONFIG.COORD_TARDE`, `CONFIG.RECTORA`, `CONFIG.PSICOORIENTADOR`.
- Directores de grupo: nueva constante `DIRECTORES_CORREO` en el backend, mapa
  `grado → correo`, derivada de `DIRECTORES_MANANA`/`DIRECTORES_TARDE` +
  el campo `correo` de `USUARIOS` en `src/data/maestros.ts`.
- Cualquier otro correo institucional: docente — solo sus propios casos.

---

## 4. Alerta de 8 días — en la app y por correo

`diasSinSeguimiento = hoy − (fecha del último seguimiento ?? fecha de creación)`

- ≥ 8 días y estado ≠ `cerrado` → alerta ámbar
- ≥ 15 días → alerta roja

**En la app**: pastilla en la tarjeta del caso + contador tipo badge en el menú.
Se calcula en el frontend, sin infraestructura extra.

**Por correo**: función `revisarCasosVencidos()` en el backend, pensada para un
activador temporal diario de Apps Script (Activadores → añadir → diario). Recorre
casos no cerrados con ≥ 8 días sin seguimiento y envía un correo por caso a
coordinación de la jornada + psicoorientador + director de grupo. Debe llevar
control de no repetir el aviso el mismo día (columna `avisadoEn`, mismo patrón
que ya usa la hoja `Sugerencias`).

⚠️ El activador lo instala Julián a mano una vez desde el editor de Apps Script.

---

## 5. Vistas

### Pestaña "Casos"

Un solo componente `<TableroCasos />` renderizado en dos lugares:
- Pestaña nueva **"Casos"** dentro de Gestión del Riesgo (ya está en el menú de todos).
- Dentro de la pestaña "Informes" que coordinación ya conoce en `PanelAdmin`.

Una sola implementación; no se duplica pantalla.

**Lista**: chips de filtro por tipo (Todos / Contención / Seguro) y por estado
(Abiertos / En seguimiento / Cerrados). Cada tarjeta muestra estudiante, grado,
fecha, tipo, pastilla de estado, días sin seguimiento y quién lo generó.

**Detalle**: datos del caso + línea de tiempo de seguimientos + botón
"Agregar seguimiento".

### Formulario de seguimiento

- `textarea` + botón 🎤 Dictar, reutilizando el hook `useDictado` que ya existe.
- Radio: "Programar próximo seguimiento" (con selector de fecha) | "Cerrar el caso".
- Al cerrar, la nota es obligatoria.

### Tokens de diseño

Usar los tokens semánticos del proyecto (`bg-card`, `bg-elevated`, `border-line`,
`text-strong/soft/muted`, y los pares `-soft`/`-soft-fg` de `danger`, `warning`,
`success`, `info`). **Nunca** construir clases con template strings
(`` `bg-${x}-soft` ``): Tailwind solo detecta nombres de clase literales y esas
clases desaparecen del CSS compilado. Usar objetos de búsqueda con clases completas.

---

## 6. Lotes

| Lote | Archivos | Criterio de hecho |
|---|---|---|
| **1. Seguridad + backend** | `docs/backend-Code.gs`, `src/data/api.ts` | `curl` sin token → `no-autorizado`; con token, filtra por rol |
| **2. Tablero de casos** | `TableroCasos.tsx` (nuevo), `GestionRiesgo.tsx`, `PanelAdmin.tsx`, `maestros.ts` | Cada rol ve solo lo suyo; `npm run build` limpio |
| **3. Seguimientos + alertas** | `SeguimientoCaso.tsx` (nuevo), `App.tsx`, `PanelInicio.tsx` | Dictado funciona; cerrar/programar cambia estado; badge cuenta vencidos |

Orden real: **Lote 1 → Lote 3 → Lote 2**. El 3 va antes que el 2 porque el
tablero (Lote 2) importa el formulario de seguimiento (Lote 3); al revés, el
Lote 2 no podría compilar solo y se quedaría sin criterio de hecho verificable.

## 7. Contrato entre Lote 3 y Lote 2

El Lote 3 crea `src/components/SeguimientoCaso.tsx` exportando EXACTAMENTE esto,
y el Lote 2 lo consume sin modificarlo:

```tsx
export interface CasoResumen {
  id: string;
  tipo: 'contencion' | 'seguro';
  estudianteNombre: string;
  grado: string;
  fecha: string;                 // fecha de creación del caso
  estado: 'abierto' | 'en_seguimiento' | 'cerrado';
  proximaRevision?: string;
  ultimoSeguimiento?: string;    // fecha del último seguimiento, si hay
}

/** Formulario: nota (escrita o dictada) + decisión cerrar/programar. */
export function SeguimientoCaso(props: {
  caso: CasoResumen;
  onGuardado: () => void;
  onCancelar: () => void;
}): React.ReactElement;

/** Días desde el último seguimiento (o desde la creación si no hay ninguno). */
export function diasSinSeguimiento(caso: CasoResumen): number;

/** Nivel de alerta: 'ninguna' | 'ambar' (>=8 días) | 'roja' (>=15 días).
 *  Un caso cerrado siempre devuelve 'ninguna'. */
export function nivelAlerta(caso: CasoResumen): 'ninguna' | 'ambar' | 'roja';
```

`diasSinSeguimiento` y `nivelAlerta` son las que usa el badge del menú (Lote 3)
y también las tarjetas del tablero (Lote 2): una sola definición de la regla de
8/15 días, para que no se dupliquen ni se desincronicen.

**Psicoorientador**: NO se crea un rol nuevo. Se usa la constante
`PSICOORIENTADORES = ['alexander']` en `maestros.ts`, mismo patrón que
`DIRECTORES_MANANA` y `LIDERES_GESTION_RIESGO`. Cambiarle el rol a Alexander
(hoy `docente`) le quitaría Reservas, Tareas y Horario, obligaría a tocar
`ROL_COLOR`, `esDirectivo()` y la lista blanca de `firestore.rules:73`.
