# Lote A — Navegación general (revisión UX, 25-oct-2026)

Alcance: encabezado y menú (`App.tsx`, `NavDropdown.tsx`), Inicio (`PanelInicio.tsx`), entrada
(`LoginScreen.tsx`), notificaciones (`BannerNotificaciones.tsx`, `MisNotificaciones.tsx`), Chat
(`Chat.tsx`) y tema claro/oscuro (`useTheme.ts`, `index.css`). Solo lectura del código; no se
probó en navegador. Los números de línea son de hoy.

## 1. Tareas frecuentes por rol y su recorrido actual

**Docente (celular)**
| Tarea | Recorrido hoy | Toques |
|---|---|---|
| Ver mi próxima clase | Entrar → Inicio ya la muestra en "Tu día" (`PanelInicio.tsx:224`) | 0 |
| Ver mi horario completo | Inicio → botón "Mi horario" del aviso, o menú → Horario → elegir modo docente | 2–4 |
| Reservar un aula | Menú (1) → Reservas (2) → elegir franja… | 2+ |
| Leer una notificación nueva | Banner arriba de todo → "✕ Listo" (descarta, no abre nada) | 1 |
| Ir a "Reservas" desde la campana | Campana del encabezado lleva a **Reservas**, no a notificaciones (`App.tsx:349`) | 1, destino equivocado |
| Escribir en el chat | Menú → Chat → canal → escribir (o caja rápida en Inicio, 0 pantallas extra) | 3 / 1 |
| Cambiar tema | Icono sol/luna (`App.tsx:385`) | 1 |

**Coordinador**: Inicio avisa "N modificaciones de horario" → "Ver panel" (2 toques). Para
cualquier módulo hay que abrir el menú (matriz de 3 columnas) y tocar: 2 toques.

**Rectora**: menú muestra "Asignación" e "Historial" como entradas sueltas; el menú de ella no
incluye Reservas. Entrar a "Mis notificaciones" exige abrir la matriz y encontrarla en el bloque de
consulta.

**Superusuario**: el menú le muestra los 4 bloques con hasta 24 destinos; no hay buscador.

## 2. Qué está bien (conservar)
- El escudo y el chip "Inicio" siempre devuelven al inicio (`App.tsx:285`, `316`): no se queda uno encerrado.
- El menú se reordena según uso real (`NavDropdown.tsx:132-157`): bien pensado para 24 destinos.
- Botón Atrás de Android vuelve a la sección anterior (`useHistorialDeVistas`).
- Inicio ya prioriza lo urgente primero ("Tu día" antes que accesos) y muestra la próxima clase sin tocar nada.
- Chat en celular alterna lista/conversación con flecha de regreso (`Chat.tsx:273`, `424`).

## 3. Hallazgos

### H1. La campana y el aviso "N notificaciones nuevas" llevan a Reservas
- **Qué estorba:** el docente con avisos pendientes toca la campana o "Ver" y aterriza en Reservas, donde no ve sus avisos; lee el banner y debe adivinar qué más hacer.
- **Dónde:** `App.tsx:349` (`setVistaActual('disponibilidad')`) y `PanelInicio.tsx:187`.
- **Principio:** Coincidencia con el mundo real / Visibilidad del estado: el botón no hace lo que promete.
- **Sugerencia:** que ambos lleven a una vista de "Avisos" (puede ser el banner ampliado o `Mis notificaciones`); además la campana debería verse para todos los roles, no solo docentes (`App.tsx:347`).
- **Beneficio:** alto · **Costo:** S

### H2. El banner de notificaciones solo permite "descartar", nunca abrir lo que dice
- **Qué estorba:** una aprobación, rechazo o cambio de reserva se lee y se borra; no hay botón "Ver reserva". Solo los avisos de horario traen "Ver mi día →" (`BannerNotificaciones.tsx:113`). Tampoco hay historial de avisos ya leídos: al tocar "Listo" se pierde.
- **Principio:** Control y libertad del usuario; Reconocer antes que recordar.
- **Sugerencia:** botón de acción por tipo (reserva → Mis reservas, intercambio → Reservas) y una lista "Avisos anteriores" con los últimos 20.
- **Beneficio:** alto · **Costo:** M

### H3. El banner solo existe para docentes y empuja el contenido
- **Qué estorba:** coordinadores y rectora reciben notificaciones (tipos "rectoría", "coordinador") pero el banner solo se monta para `rol === 'docente'` (`App.tsx:418`). Con varios avisos ocupa hasta 16 rem (`max-h-64`, línea 87) encima de todo, en pantalla de celular casi un tercio.
- **Principio:** Consistencia; Diseño minimalista.
- **Sugerencia:** mostrar una sola línea ("3 avisos nuevos ›") que despliegue la lista; mismo comportamiento para todos los roles.
- **Beneficio:** medio · **Costo:** S–M

### H4. Botones pequeños en el encabezado y en el chat
- **Qué estorba:** en el encabezado, tema y cerrar sesión miden `p-2` con icono de 16 px = 32 px (`App.tsx:387`, `407`), menos de los 44 px recomendados; el botón de salir queda pegado al de tema y a "Manual", con riesgo de cerrar sesión sin querer. En el chat, "responder / reenviar / editar / borrar" son enlaces de texto de 10 px, a 8 px unos de otros (`Chat.tsx:880-923`); "borrar" sin confirmación visible junto a "editar".
- **Principio:** Prevención de errores; legibilidad móvil (texto mínimo 12 px).
- **Sugerencia:** pedir confirmación al cerrar sesión (o moverlo a un menú de perfil); en el chat, agrupar acciones en un menú "⋯" por mensaje con objetivos de 44 px y confirmar "borrar".
- **Beneficio:** alto · **Costo:** M

### H5. Tipografía por debajo de 12 px en lo esencial
- **Qué estorba:** las etiquetas del menú en matriz son de 11 px (`NavDropdown.tsx:112`), igual que las baldosas de Inicio (`PanelInicio.tsx:455`); las insignias de contador son de 10 px (`NavDropdown.tsx:70`, `114`). "Manual de convivencia" y "Gestión del Riesgo" se parten en tres líneas en una columna de ~100 px.
- **Principio:** Visibilidad / Estética; criterio móvil ≥ 12 px.
- **Sugerencia:** subir a 12–13 px y acortar etiquetas del menú ("Manual", "Riesgo") conservando el nombre completo en el `title`; el `title` no se ve en celular, así que la descripción nunca aparece allí.
- **Beneficio:** medio · **Costo:** S

### H6. Dos puertas distintas a lo mismo en Inicio
- **Qué estorba:** Inicio ofrece las baldosas "¿Qué deseas hacer?" (carrusel horizontal de ~10–20 iconos, `PanelInicio.tsx:359-374`) **y** el menú del encabezado, con orden y agrupación distintos. En celular las baldosas exigen deslizar de lado para descubrir lo que no cabe, y no hay indicio de que haya más (las flechas están ocultas en pantallas táctiles, `PanelInicio.tsx:713`).
- **Principio:** Consistencia; Reconocer antes que recordar.
- **Sugerencia:** en Inicio, mostrar la misma matriz del menú (mismos bloques, mismo orden por uso) en vez del carrusel, o limitar el carrusel a los 6 más usados con un "Ver todo".
- **Beneficio:** alto · **Costo:** M

### H7. "Tu día" también es un carrusel horizontal con avisos decisivos ocultos
- **Qué estorba:** cada banner mide 270 px de ancho; en un celular de 360 px se ve uno y un borde del siguiente. Los avisos urgentes (cambio de horario hoy, casos sin seguimiento) pueden quedar fuera de vista si hay varios por delante; el orden es correcto pero no hay contador "1 de 5".
- **Dónde:** `PanelInicio.tsx:348-357`, `BannerAviso` línea 404.
- **Principio:** Visibilidad del estado.
- **Sugerencia:** apilar vertical los 3 más urgentes (ancho completo) y colapsar el resto en "Ver N más"; o al menos añadir puntos indicadores.
- **Beneficio:** medio · **Costo:** S–M

### H8. Inicio abre con varias tarjetas fijas antes de lo útil
- **Qué estorba:** antes de "Tu día" pueden salir "Activa las notificaciones" (tarjeta grande con texto largo, `PanelInicio.tsx:514`) y `TarjetaDatosSede`. El docente que entra a ver su próxima clase debe pasar por encima. "Ahora no" se recuerda para siempre en `localStorage` sin forma de volver a verla excepto por el menú.
- **Principio:** Diseño minimalista; reducir carga.
- **Sugerencia:** mover "Tu día" arriba de las tarjetas de configuración, y reducir la tarjeta de notificaciones a una línea con botón.
- **Beneficio:** medio · **Costo:** S

### H9. "Activar avisos" en el encabezado y tarjeta en Inicio compiten con "Mis notificaciones"
- **Qué estorba:** tres sitios distintos activan notificaciones: el botón del encabezado (`App.tsx:359`, usa permisos de navegador), la tarjeta de Inicio y la pantalla `MisNotificaciones` (estas dos usan push de Firebase). Son sistemas diferentes con nombres casi iguales; un docente puede activar el equivocado y creer que ya está listo.
- **Principio:** Consistencia; Prevención de errores.
- **Sugerencia:** unificar en un solo flujo (el push) y retirar el botón del encabezado.
- **Beneficio:** medio · **Costo:** S

### H10. "Mis notificaciones" mezcla ajustes con herramientas técnicas
- **Qué estorba:** un docente que solo quiere apagar los avisos del chat se encuentra con "Probar aviso local", "SW: … alcance … token …" y la "Respuesta del servidor" en JSON crudo (`MisNotificaciones.tsx:203-232`). Los dos botones de prueba están en la misma fila con `ml-2`, que se rompe en pantallas angostas. Las casillas se guardan al tocar sin confirmación visible (solo se bloquean mientras guarda).
- **Principio:** Diseño minimalista; Ayuda a reconocer y recuperarse de errores.
- **Sugerencia:** dejar una sola tarjeta "Este dispositivo" + las casillas arriba; mover los datos técnicos a un bloque plegable "Diagnóstico" (visible solo a superusuario o con toque largo). Cambiar casillas por interruptores de 44 px y mostrar "Guardado".
- **Beneficio:** medio · **Costo:** S

### H11. Chat: altura y estados vacíos
- **Qué estorba:** el contenedor del chat usa `md:h-[70vh]` pero en celular no tiene altura fija (`Chat.tsx:268`): con teclado abierto y 100vh de móvil, el campo de escribir puede quedar tapado o la conversación empujar la página entera. La pantalla vacía muestra un recuadro "Diagnóstico" con correo y errores técnicos a cualquier usuario (`Chat.tsx:367-380`). La flecha de regreso es un icono sin texto de 16 px (línea 434-439).
- **Principio:** Estética y diseño minimalista; Ayuda con errores; objetivos táctiles.
- **Sugerencia:** usar `100dvh` menos el encabezado en celular; el diagnóstico solo a superusuario; botón Atrás de 44 px con la palabra "Chats".
- **Beneficio:** medio · **Costo:** M

### H12. Tema claro: login y campos de texto ignoran los tokens
- **Qué estorba:** `ui/input.tsx:11` define `text-white`, `border-white/15`, `bg-white/8` fijos: sobre tarjeta clara, el texto sale blanco e ilegible (hoy solo se usa en rutas casi muertas: recuperación de PIN, otros formularios que lo importen). El escudo del login usa `mixBlendMode: 'lighten'` (`LoginScreen.tsx:213`), que en fondo claro lo deja lavado o invisible. El login no tiene botón de tema; arranca siempre oscuro (`store.ts:125`, `temaOscuro: true`) sin respetar la preferencia del teléfono, aunque `index.css:116` declara `color-scheme: light dark`.
- **Principio:** Consistencia; estética.
- **Sugerencia:** pasar `Input` a los tokens (`bg-elevated`, `text-strong`, `border-line`); quitar el `lighten` o aplicarlo solo con `.dark`; elegir el tema inicial con `prefers-color-scheme`; poner un toggle pequeño en el login.
- **Beneficio:** medio · **Costo:** S

### H13. Login: único botón, sin ayuda cuando falla
- **Qué estorba:** si Google falla o la cuenta no está autorizada, solo sale `err.message` crudo (`LoginScreen.tsx:46`, en rojo de 12 px). No se dice "usa tu correo @iemanueljbetancur.edu.co". "📲 ¿Cómo instalar la app?" tiene el mismo peso que el botón principal. Sin enlace a soporte/sugerencia.
- **Principio:** Ayuda a reconocer, diagnosticar y recuperarse de errores.
- **Sugerencia:** mensajes por causa (correo no institucional, ventana cerrada, red caída) con instrucción de qué hacer; "¿Problemas para entrar?" con el correo del administrador.
- **Beneficio:** medio · **Costo:** S

### H14. Menú: sin buscador, y el nombre de la sección en el botón se trunca
- **Qué estorba:** el botón del menú comparte fila con escudo, chip "Inicio", sede, pastilla, campana, avisos, manual, tema y salir (`App.tsx:281-412`). En 360 px el nombre actual (`truncate`, `NavDropdown.tsx:68`) queda como "Ge…" y no se ve dónde estoy. La matriz de 3 columnas con 22 rem tiene 24 destinos para el superusuario y ninguna búsqueda; el chip "Inicio" (solo icono en <640 px) repite el escudo.
- **Principio:** Visibilidad del estado del sistema; Eficiencia de uso.
- **Sugerencia:** mostrar el título de la sección en una segunda línea del encabezado, o mover Manual/tema/salir al menú del perfil; añadir un campo "Buscar sección" al principio de la matriz solo para roles con más de 12 destinos.
- **Beneficio:** medio · **Costo:** M

### H15. Contadores del menú no siempre reflejan lo que hay dentro
- **Qué estorba:** el número rojo del botón cerrado y de "Reservas" cuenta notificaciones sin leer (`NavDropdown.tsx:69`, `97`), pero para docente esas notificaciones no se leen en Reservas sino en el banner (H1); el mismo número aparece en dos sitios sin que ninguno lo resuelva. Las insignias de 10 px son poco legibles.
- **Principio:** Visibilidad / Coincidencia con el mundo real.
- **Sugerencia:** el badge debe llevar a donde se resuelve (ver H1/H2) y mostrarse una sola vez.
- **Beneficio:** bajo · **Costo:** S

### H16. Otros menores
- Pie "💡 Enviar sugerencia" (`App.tsx:476`) es texto de 12 px sin área táctil de 44 px; para los docentes es la única vía de reclamo y queda al final de páginas largas.
- Transición `AnimatePresence mode="wait"` con 0.2 s + 0.2 s (`App.tsx:426-432`) retrasa cada cambio de sección ~400 ms en teléfonos modestos; sentir de lentitud.
- Emojis en el banner (`BannerNotificaciones.tsx:11-19`) mezclados con iconos neón del resto de la app: inconsistente.
- `overflow-x-hidden` en `<main>` (`App.tsx:425`) oculta en lugar de resolver cualquier desbordamiento: un error de ancho en otro módulo no se verá, pero queda cortado.
- **Beneficio:** bajo · **Costo:** S (cada uno)

## 4. Top 5 (beneficio ÷ costo)

1. **H1 — Campana y "Ver" llevan a Reservas en vez de a los avisos** (alto / S): error visible todos los días, arreglo de dos líneas.
2. **H12 — Tema claro: `Input` fijo en blanco, escudo con `lighten`, tema inicial según el teléfono** (medio / S): hace usable el modo claro desde el primer toque.
3. **H5 + H4 (botones de 32 px y textos de 10–11 px)** (alto / S–M): subir tamaños en menú, encabezado y acciones del chat; confirmar "cerrar sesión" y "borrar".
4. **H2 — Avisos que se puedan abrir y que dejen historial** (alto / M): convierte el banner de "descartar y olvidar" en un camino al trámite.
5. **H6 — Inicio con la misma matriz que el menú en lugar del carrusel de baldosas** (alto / M): una sola forma de moverse, sin deslizar de lado en el celular.

Mención: H8 (poner "Tu día" arriba de las tarjetas de configuración) y H10 (esconder datos técnicos de `Mis notificaciones`) son de costo S y mejoran la primera impresión del docente.
