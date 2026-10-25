# Revisión visual, lotes A y E: navegación e institucional (26-oct-2026)

Alcance: App.tsx, NavDropdown, IconosNeon, PanelInicio, LoginScreen, notificaciones, Chat (lote A);
GestionRiesgo, TableroCasos, simulacros, datos de la sede, panel de usuarios, sugerencias (lote E).
Método: lectura de código y conteo con grep. No se midió contraste real (eso es la Fase 0); donde
digo "probable" o "estimado" falta esa medida. Parámetros del PLAN: 2, 4 y 5.
Rutas relativas a `src/` (components/ = src/components/).

## Lo que ya está bien
- Estados de caso y Activo/Inactivo usan tokens semánticos y además llevan texto:
  components/TableroCasos.tsx:52-55 ("Abierto", "En seguimiento", "Cerrado") y
  components/PanelSuperusuario.tsx:714-718 ("Activo"/"Inactivo"). Cumplen el parámetro 2.
- Botones de ícono del chat con `aria-label`: components/Chat.tsx:510, 551, 568, 575, 593, 601, 888, 897, 924, 961.
- Zonas táctiles de 44 px en la barra superior (App.tsx:384, 407, 411).
- Cerrar sesión pide confirmación con texto "¿Salir?" (App.tsx:408).
- La insignia de conteo del menú lleva número (components/NavDropdown.tsx:70, 137).

## Tabla de íconos (components/IconosNeon.tsx:315-331 y lucide en App.tsx)
| Ícono | Dónde | Significa | Observación |
|---|---|---|---|
| IconoReservar (cian) | menú "disponibilidad" | reservar espacio | OK |
| IconoPanel (bandejas) | "admin" | panel del coordinador | Las bandejas no dicen "coordinación"; se entiende por la etiqueta |
| IconoRectoria (frontón) | "rectora" | rectoría | OK |
| IconoAsistentes (robot) | "asistentes" | asistentes de IA | El nombre se parece a "asistencia" |
| IconoAsistencia (planilla con checks) | "asistencia" | tomar asistencia | OK |
| IconoUsuarios (dos personas) | "admin_users" | gestión de usuarios | OK |
| IconoSugerencias (bombilla) | "sugerencias" | ideas | OK |
| IconoCampana | menú "notificaciones" (IconosNeon:330) y banner "Tu día" (PanelInicio.tsx:183, 485) | avisos | Misma campana para dos cosas distintas |
| lucide Bell (App.tsx:354) | encabezado, docente con avisos | notificaciones | Tercer dibujo de campana |
| lucide BellRing (App.tsx:367) | "Activar avisos" | permiso de push | Casi igual a Bell; solo el texto los distingue |
| lucide BookOpen (App.tsx:379) | "Manual" | manual de uso | OK, pero el texto se oculta bajo `sm:` |
| lucide Sun/Moon (App.tsx:392) | tema | muestra el tema ACTUAL | Ambiguo: ¿voy a claro o estoy en claro? |
| lucide LogOut (App.tsx:415) | salir | cerrar sesión | OK |
| IconoGenerico (reloj, IconosNeon:300) | cualquier id sin entrada | "reloj" | Un ítem nuevo sin ícono mostraría un reloj, que sugiere horario |

## Hallazgos

### H1. Colores neón fijos que en modo claro pierden contraste
- Qué: cada sección tiene un hex fijo (#fde047 amarillo, #a3e635 lima, #fdba74 durazno, #fbbf24 dorado, #22d3ee cian...) como trazo del ícono.
- Dónde: IconosNeon.tsx:315-335; repetidos a mano en PanelInicio.tsx:182-298 (11 hex) y PanelSugerencias.tsx:140; NavDropdown.tsx:31, 67, 133 los aplica por `style`.
- Parámetros: 1, 4, 5. Un amarillo claro sobre blanco queda cerca de 1,4:1 (estimado; confirmar en Fase 0): el ícono pierde su único portador de significado.
- Sugerencia: dos valores por sección (`--neon-tareas` claro/oscuro) leídos con `var()`, y un solo origen: que PanelInicio use `neonDe(id).color` en vez de repetir hex.
- Beneficio/costo: alto / medio.

### H2. Botones solo-ícono del encabezado sin nombre accesible
- Qué: "Manual" y "Activar avisos" ocultan su texto bajo `sm` (App.tsx:368, 380) y queda solo el ícono; la campana de avisos (:354) y la de activar avisos (:367) se parecen. Tema (:389) y Salir (:415) usan solo `title`, que no aparece en pantalla táctil.
- Parámetro: 4. Solo el logo tiene `aria-label` (App.tsx:291); 5 botones del encabezado no.
- Sugerencia: `aria-label` en Notificaciones, Activar avisos, Manual, Tema y Salir; mostrar "Avisos" también en celular.
- Beneficio/costo: alto / bajo.

### H3. Punto rojo de notificación: solo color y 6 px
- Qué: `<span w-1.5 h-1.5 bg-danger rounded-full>` indica "hay algo nuevo" solo con rojo.
- Dónde: App.tsx:355.
- Parámetros: 2 y 3 (rojo/verde en daltonismo).
- Sugerencia: reusar la insignia con número del menú (NavDropdown.tsx:70) y `aria-label="N notificaciones sin leer"`.
- Beneficio/costo: medio / bajo.

### H4. Ícono de tema muestra el estado, no la acción
- Qué: `temaOscuro ? <Moon/> : <Sun/>` y solo `title="Cambiar tema"` (App.tsx:389-392).
- Parámetro: 4.
- Sugerencia: `aria-label` dinámico ("Cambiar a modo claro") y mostrar el ícono del destino.
- Beneficio/costo: medio / bajo.

### H5. Dos campanas para cosas distintas
- Qué: IconoCampana sirve para "Notificaciones" (IconosNeon.tsx:330) y para el banner "Tu día" (PanelInicio.tsx:183, 485); en el encabezado hay además Bell y BellRing de lucide.
- Parámetro: 4 (mismo ícono = lo mismo).
- Sugerencia: campana solo para notificaciones; para "Tu día" usar IconoDespejado o IconoReloj (IconosNeon.tsx:142, 158). Unificar Bell con IconoCampana.
- Beneficio/costo: medio / bajo.

### H6. `text-white` fijo sobre `bg-danger`
- Qué: components/GestionRiesgo.tsx:750, 946, 1269; NavDropdown.tsx:70, 137 (insignias).
- Parámetro: 5 y modo claro. El fondo es token, así que probablemente resiste, pero hay que confirmar que `--danger` en claro dé ≥ 4,5:1 con blanco.
- Sugerencia: token `text-on-danger` en los 5 sitios; medir en Fase 0.
- Beneficio/costo: medio / bajo.

### H7. Letra fuera de escala: 192 usos de 9 a 11 px
- Qué: `text-[9px]`, `[10px]`, `[11px]` en toda la app. Chat.tsx tiene 21 (:370, 455, 500, 537, 808), GestionRiesgo.tsx 20 (:71, :198, :303), PanelSugerencias 3, FichaSede 3, BannerNotificaciones 2.
- Parámetro: 5. Los chips de 9 px de TableroCasos.tsx:417 y :426 llevan justo el estado y la alerta.
- Sugerencia: mínimo 12 px (`text-xs`) para todo lo que lleve significado; 10-11 px solo para metadatos. Empezar por los chips de estado y alerta.
- Beneficio/costo: alto / medio (cambio mecánico; revisar desbordes).

### H8. Alerta ámbar/roja de casos depende del color
- Qué: ESTILO_ALERTA distingue "ambar" y "roja" solo con clases de color (components/TableroCasos.tsx:57-60). Falta confirmar que el chip de la línea 426 escribe la palabra. Ámbar y rojo se confunden en protanopía/deuteranopía.
- Parámetros: 2 y 3.
- Sugerencia: forma + texto: "▲ Alerta ámbar" y "● Alerta roja" (o triángulo vs. octágono).
- Beneficio/costo: alto / bajo (casos de convivencia, decisión sensible).

### H9. Mensajes ok/error del panel de usuarios: solo color
- Qué: el recuadro de resultado cambia entre `bg-success-soft` y `bg-danger-soft`; la diferencia visual es solo el color (components/PanelSuperusuario.tsx:573-582; mismo patrón en :751-752 y :871).
- Parámetro: 2. (Activo/Inactivo, :714-718, sí lleva texto.)
- Sugerencia: anteponer ✓ / ✕ (lucide CheckCircle2 / XCircle).
- Beneficio/costo: medio / bajo.

### H10. Emoji como ícono en simulacros
- Qué: "🚨 Simulacros" (components/simulacros/VistaSimulacros.tsx:83). El resto de la app usa SVG de línea.
- Parámetros: 4 y 5. El emoji cambia de dibujo según el sistema, no hereda el tema, y la sirena sugiere emergencia real y no ejercicio.
- Sugerencia: IconoRiesgo de IconosNeon con el texto "Simulacros".
- Beneficio/costo: bajo / bajo.

### H11. El rojo coral del menú "Riesgo" compite con el rojo de error
- Qué: `#f87171` para Riesgo (IconosNeon.tsx:323, PanelInicio.tsx:197) es casi el tono de `danger`; un destino de navegación parece alarma permanente.
- Parámetros: 2 y 5.
- Sugerencia: reservar el rojo para error/peligro real; ícono de Riesgo en tono distinto.
- Beneficio/costo: medio / bajo.

### H12. Chat: íconos de acción sin tooltip
- Qué: responder, reenviar, fijar, reaccionar, grabar, adjuntar tienen `aria-label` (Chat.tsx:510-961) pero ninguno tiene `title` (0 `title=` en el archivo): sin tooltip en escritorio. "Fijar"/"Soltar fijado" (:924) es el mismo botón con dos significados.
- Parámetro: 4.
- Sugerencia: `title` igual al aria-label; en el menú del mensaje mostrar ícono + texto.
- Beneficio/costo: medio / bajo.

### H13. Login y notificaciones (verificación parcial)
- LoginScreen.tsx y MisNotificaciones.tsx: sin colores fijos ni `text-white`; 0 `aria-label` en ambos. No verifiqué que los campos tengan `<label>` ni que el error de PIN lleve texto además de borde rojo.
- BannerNotificaciones.tsx:125 tiene `title` y `aria-label`. Los 6 tipos (rectoría, coordinador, intercambio, aprobada, rechazada, cancelada) deben distinguirse también por ícono; no lo confirmé.

### H14. Íconos institucionales
- IconosNeon.tsx:196-258 (policía, niñez, salud mental, salud, bomberos, institucional, convivencia, evaluación) se leen bien por forma, pero "escudo con estrella" (:196) puede confundirse con "seguridad" o "insignia". Deben ir siempre con nombre y número (123, 141...). Confirmar que ninguno aparece sin texto.
- Beneficio/costo: bajo / bajo.

### H15. Fallback de ícono = reloj gris
- IconosNeon.tsx:300-305 y 334-336: un id sin entrada muestra un reloj en `#94a3b8` (sobre blanco, estimado ≈ 2,6:1).
- Sugerencia: ícono neutro y una prueba que falle si falta la entrada de algún id del menú.
- Beneficio/costo: bajo / bajo.

## Pendiente de verificar (no concluyo sin datos)
- Contraste real de los 17 hex de NEON_NAV contra fondo claro y oscuro (Fase 0).
- TableroCasos.tsx:426: confirmar que el chip de alerta escribe el texto.
- Datos de la sede (components/sedeDatos/), simulacros y manual de convivencia: por grep tienen 0 colores fijos y 0 `aria-label`; no leí sus estados línea a línea. Botones de micrófono (GrabadorVoz) probablemente sin etiqueta visible.

## Top 5 (por beneficio/costo)
1. H2: `aria-label` y etiqueta corta en los botones del encabezado (App.tsx:352-415).
2. H8: alerta ámbar/roja con forma y texto, no solo color (TableroCasos.tsx:57-60, 426).
3. H1: hex neón a tokens claro/oscuro con un solo origen (IconosNeon.tsx:315-335, PanelInicio.tsx:182-298).
4. H7: mínimo 12 px en chips de estado y alerta; 192 usos de 9-11 px (TableroCasos.tsx:417-426, Chat.tsx).
5. H3 y H9: punto de notificación con número y mensajes ok/error con ✓/✕ (App.tsx:355, PanelSuperusuario.tsx:573-582).
