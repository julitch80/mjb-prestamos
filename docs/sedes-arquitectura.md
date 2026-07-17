# Arquitectura multi-sede (Fase A)

## Objetivo

Preparar la app para absorber, en el futuro, las dos sedes de primaria (Gustavo
Rojas Pinilla y La Finquita) sin romper la Sede Central (bachillerato), que es
la única funcional hoy. Fase A es solo cimientos: modelo de datos, direcciona-
miento y un placeholder visual. No implementa la dinámica real de primaria.

## Modelo

`src/data/maestros.ts`:

- `SedeId = 'central' | 'gustavo_rojas' | 'la_finquita'`
- `Sede { id, nombre, nivel: 'bachillerato' | 'primaria', jornadas, configurada }`
  — `configurada: true` solo en `central`. Las otras dos están marcadas
  `false` hasta que se defina y cargue su dinámica.
- `Usuario.sede?: SedeId` — opcional; si falta se asume `'central'`. Ninguna
  entrada existente de `USUARIOS` fue tocada (todas son de central por
  default).
- `AUTORIDAD_SEDE: Record<SedeId, string[]>` — ids de coordinadores con
  permiso de edición en cada sede, además de rectora y superusuario (que
  siempre pueden). Hoy:
  - `central`: `coord_manana`, `coord_tarde` (como siempre)
  - `gustavo_rojas`: `coord_manana` — **pendiente de confirmar** si es
    Janneth (`coord_manana`) o "Yaneth Ocampo", persona distinta.
  - `la_finquita`: `coord_tarde` — **pendiente de confirmar** si Juan Diego
    realmente cubre esta sede además de tarde en central.
- `puedeEditarEnSede(userId, rol, sede)` — true para rectora/superusuario
  siempre; para coordinador solo si aparece en `AUTORIDAD_SEDE[sede]`.
- `sedeDeUsuario(userId)` — busca en `USUARIOS` y devuelve su `sede` (default
  `'central'`).
- `esDirectivo(rol)` — true para `rectora`, `coordinador`, `superusuario`.

## Direccionamiento

Store (`src/data/store.ts`): `sedeActual: SedeId` (default `'central'`,
persistido). `setUsuario` decide automáticamente:

- **Docente** (`!esDirectivo(rol)`): `sedeActual = sedeDeUsuario(userId)`.
  Nunca ve selector — su sede queda fija según el usuario.
- **Directivo** (rectora, coordinador, superusuario): `sedeActual` no se
  toca en `setUsuario`; elige con la interfaz.

Interfaz para directivos (`src/components/SelectorSede.tsx`, montado desde
`App.tsx`):

1. `SelectorSedeMenu` — overlay de pantalla completa que aparece una sola vez
   por sesión de navegador (`sessionStorage['mjb-sede-elegida']`), justo tras
   el login, con las 3 sedes como tarjetas.
2. `SelectorSedePastilla` — pastilla compacta en el header (junto a la
   pastilla de usuario) con dropdown, para cambiar de sede en cualquier
   momento sin recargar.

En modo Google (Etapa 2+ de Firebase), `src/data/plantilla.ts` propaga el
campo `sede` del doc de Firestore hacia la entrada parcheada de `USUARIOS`
(si el docente tiene `slotId`), y `src/data/authStore.ts` usa `perfil.sede`
como respaldo cuando el usuario no tiene `slotId` (docente nuevo sin puesto
en el horario).

## Central intacta

`App.tsx` renderiza el switch de vistas exactamente igual que antes cuando la
sede activa está `configurada: true` (hoy, siempre que `sedeActual ===
'central'`). La condición de gating se evalúa antes del switch y solo cambia
el comportamiento para sedes `configurada: false`.

## Qué falta por definir

- Dinámica real de primaria: jornadas, grados, aulas, directores de grupo,
  bloques horarios — probablemente distintos a bachillerato.
- Confirmar nombres/autoridad en `AUTORIDAD_SEDE` (ver TODO en el código).
- Decidir si primaria comparte el mismo Google Sheet/Apps Script backend o
  necesita uno propio.

## Cómo se activa una sede

1. Recolectar y modelar los datos reales de la sede (usuarios, recursos,
   horario base, bloques, jornadas).
2. Cambiar `configurada: true` en su entrada de `SEDES`.
3. Adaptar los componentes de horario/reservas para que lean datos por sede
   en vez de asumir los de `central` (hoy el switch de `App.tsx` no filtra
   por sede dentro de cada vista — eso es trabajo de una fase posterior).
