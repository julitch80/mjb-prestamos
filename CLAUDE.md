# MJB Préstamos — Sistema de Préstamo de Recursos

## Permisos del proyecto

El creador del proyecto (Julián David Medina Tamayo) otorga autorización general para todas las operaciones de desarrollo en este repositorio. No es necesario pedir confirmación para:
- Instalar, actualizar o eliminar paquetes npm
- Crear, editar o eliminar archivos del proyecto
- Hacer commits y push a la rama master
- Ejecutar builds, tests y scripts del proyecto
- Leer y modificar cualquier archivo de configuración

Sí se debe consultar antes de: cambiar configuraciones de GitHub (Pages, Actions permisos de repo), acceder a servicios externos con credenciales reales (Sentry DSN, Google Cloud), o realizar cualquier acción que afecte datos de producción en Google Sheets.

## Contexto del proyecto

Sistema web para la **I.E. Manuel J. Betancur** (San Antonio de Prado, Medellín, Colombia). Gestiona préstamo de aulas y recursos, horarios de docentes y grupos, edición temporal de horarios por ausencias, y comunicación institucional. Es usado por la rectora, dos coordinadores y ~30 docentes.

**Creador:** Julián David Medina Tamayo — profesor de física, docente del colegio, estudiante de doctorado en Educación (UNADE).

**Estado:** En desarrollo activo. Funcional en producción con varias funcionalidades incompletas que se documentan abajo.

---

## Stack técnico

| Capa | Tecnología |
|------|-----------|
| Frontend | React 18 + TypeScript + Tailwind CSS |
| Estado | Zustand |
| Build | Vite |
| Deploy | GitHub Pages (build automático) |
| Backend | Google Apps Script |
| Base de datos | Google Sheets |
| Auth | PIN por usuario (almacenado en Sheets) |

### Migración pendiente: de HTML único a build automático

Actualmente la app se empaqueta en un solo archivo `prestamo_mjb.html` que se sube manualmente a GitHub. **Se debe migrar** a un flujo con GitHub Actions que haga build automático al hacer `git push`. Esto elimina el paso manual de copiar/pegar HTML.

---

## URLs y recursos

| Recurso | URL |
|---------|-----|
| App en producción | `https://julitch80.github.io/mjb-prestamos/prestamo_mjb.html` |
| Repositorio GitHub | `github.com/julitch80/mjb-prestamos` (usuario: julitch80) |
| Apps Script backend | `https://script.google.com/macros/s/AKfycbyIxTCPm0PvibDjbqYYv6gYgJtc6MqL-2NVzdEaRLsMO2nAasseQgDO0UUixkeX4X4zZA/exec` |
| Google Sheets ID | `1fg73CZ0mdM6lQD7TXXxxxi3zbCyT4RbVJxg4KjagTsg` |

---

## Arquitectura de archivos

```
prestamo-mjb/
├── src/
│   ├── App.tsx                          # Navegación principal, header, theme toggle, routing
│   ├── components/
│   │   ├── LoginScreen.tsx              # Login con escudo MJB, PIN, recuperación
│   │   ├── DisponibilidadGrid.tsx       # Cuadrícula de disponibilidad de aulas
│   │   ├── PanelConfirmacion.tsx        # Formulario de reserva (propósito, equipos)
│   │   ├── PanelAdmin.tsx              # Panel coordinadores (pendientes, hoy, historial, config)
│   │   ├── PanelRectora.tsx            # Panel rectora (asignación directa + historial)
│   │   ├── PopupRectora.tsx            # Popup compacto de asignación directa
│   │   ├── VistaHorario.tsx            # Horario del J — tres modos: aulas, docente, grupo
│   │   ├── EditorHorario.tsx           # Editor temporal de horario (drag & drop) ⚠ INCOMPLETO
│   │   ├── AsistenteAusencia.tsx       # Asistente de ausencia docente ⚠ INCOMPLETO
│   │   ├── BannerNotificaciones.tsx    # Banner de notificaciones para docentes
│   │   └── MiHistorial.tsx             # Historial de reservas del usuario
│   ├── data/
│   │   ├── store.ts                    # Zustand store (estado global, notificaciones, vistaActual)
│   │   ├── api.ts                      # Comunicación con Apps Script (JSONP fallback para CORS)
│   │   ├── horarioBase.ts              # 600 entradas de horario base (300 mañana + 300 tarde)
│   │   └── maestros.ts                 # Usuarios, recursos, bloques, propósitos
│   └── hooks/
│       ├── useDevice.ts                # Detección mobile/desktop
│       └── useTheme.ts                 # Tema oscuro/claro
├── public/
│   └── mjb_icon.png                    # Escudo MJB (fondo transparente, procesado con flood-fill)
├── package.json
├── vite.config.ts
├── tsconfig.json
└── CLAUDE.md                           # Este archivo
```

---

## Jornadas y grados

| Jornada | Grados | Horario |
|---------|--------|---------|
| Mañana | 9°(1-3), 10°(1-4), 11°(1-3) | B1:06:00–06:55, B2:06:55–07:50, recreo 20min, B3:08:10–09:05, B4:09:05–10:00, recreo 10min, B5:10:10–11:05, B6:11:05–12:00 |
| Tarde | 6°(1-3), 7°(1-3), 8°(1-4) | B1:12:15–13:10, B2:13:10–14:05, recreo 20min, B3:14:25–15:20, B4:15:20–16:15, recreo 10min, B5:16:25–17:20, B6:17:20–18:15 |

### Notación de grados

- Mañana usa punto: `9.1`, `10.2`, `11.3`
- Tarde usa ordinal: `6º1`, `7º2`, `8º3`
- Esta diferencia se usa para distinguir jornadas programáticamente: `grado.includes('º')` = tarde

### Directores de grupo (mañana)

| Grupo | Director | Nombre completo |
|-------|----------|-----------------|
| 11°1 | Johana | Leidy Johana Cano Ruiz |
| 11°2 | Julián | Julián David Medina Tamayo |
| 11°3 | Claudia | Claudia Patricia Henao Bermúdez |
| 10°1 | Carlos | Carlos Cárdenas |
| 10°2 | Beatriz | Beatriz Elena Montoya Valdés |
| 10°3 | Ledis | Ledis Laura Quintana Seguanes |
| 10°4 | Adolfo | Adolfo León Arango Arroyave |
| 9°1 | Gloria A. | Gloria Estella Álvarez López |
| 9°2 | Marta | Marta Úsuga |
| 9°3 | Uriel | José Uriel López Arias |

Directores de grupo de la tarde: **NO DISPONIBLES AÚN** — pendiente de obtener del usuario.

### Aulas tarde ↔ grupos

| Aula | Grupo |
|------|-------|
| A1 | 7°1 |
| A2 | 7°2 |
| A3 | 7°3 |
| A4 | 8°4 |
| A5 | 8°3 |
| A6 | 8°2 |
| A7 | 8°1 |
| A8 | 6°1 |
| A9 | 6°2 |
| A10 | 6°3 |

### Docentes mixtos (trabajan en ambas jornadas)

| Docente | Días en TARDE | Días en MAÑANA |
|---------|--------------|----------------|
| Marta Úsuga | martes, jueves | lunes, miércoles, viernes |
| Mónica Tatiana Córdoba Zapata (`monica_c`) | lunes, miércoles | martes, jueves, viernes |
| Juan C. (Blandón/Yoguis) | miércoles | lunes, martes, jueves, viernes |
| Edgar | todos | solo martes B6 (CI) |

> Nota: hay **dos Mónicas** y son personas distintas: **Mónica Tatiana Córdoba Zapata** (`monica_c`, mixta mañana+tarde) y **Mónica Rave** (`monica_rave`, solo tarde). No confundir.

### Centros de Interés (CI)

Hay CI en ambas jornadas, en franjas distintas e independientes:

- **Mañana:** martes **B6** (6.ª hora).
- **Tarde:** martes **B1** (1.ª hora).

Reglas de visualización (centralizadas en `maestros.ts`: `esCIBloque`, `esCIDocente`, `DOCENTES_CI_MANANA`, `DOCENTES_CI_TARDE`, `BLOQUE_CI`):

- **Vista por grupo / por aulas:** la franja de CI aplica a **todos** los grupos de la jornada (sin aula asignada). Se muestra ★CI dorado.
- **Vista por docente:** ★CI solo para los docentes que **efectivamente supervisan** CI. NO todos lo tienen.
  - Mañana: se derivan del horario base (entradas martes B6 con grado que incluye `CI`). NO tienen CI: Gloria A., Johana, Claudia, Mónica C., Marta.
  - Tarde (`DOCENTES_CI_TARDE`): Marina Zapata, Carolina, Fredy García, Mónica Rave, Marta, Juan Pablo, Edgar, Harol, Felipe, Luis Ángel, Luis Javier.
- **Edgar** es el único con CI en ambas jornadas: martes B6 (su única hora de mañana) y martes B1 (tarde). El CI tiene prioridad sobre la marca "T" de jornada tarde en su celda de mañana.

---

## Usuarios del sistema

### Directivos

| ID | Nombre | Rol | Jornada | Correo | PIN |
|----|--------|-----|---------|--------|-----|
| rectora | Nancy Adriana Herrera López | rectora | ambas | mjb@iemanueljbetancur.edu.co | 11111 |
| coord_manana | Janneth Astrid Ocampo Carvajal | coordinador | mañana | janneth.ocampo@iemanueljbetancur.edu.co | 11111 |
| coord_tarde | Juan Diego Salazar Rendón | coordinador | tarde | juan.salazar@iemanueljbetancur.edu.co | 11111 |

### Correos para banners web

Los banners generados por el asistente de ausencia se envían a:
- Coordinador de la jornada
- juancarlosbv@iemanueljbetancur.edu.co (Juan Carlos Blandón)
- uriel.lopez@iemanueljbetancur.edu.co (Uriel López)

---

## Roles y permisos

### Rectora
- Ve ambas jornadas en el horario
- Asigna espacios directamente con popup compacto (sin aprobación)
- Puede desplazar docentes con motivo predefinido
- NO ve pendientes, NO ve pestaña "Hoy"
- Solo ve: Panel de asignación + Historial propio
- Motivos predefinidos: Necesidad institucional, Visita externa, Reunión administrativa, Evento cultural, Requerimiento Secretaría Educación, Otro

### Coordinadores
- Ven ambas jornadas en el horario (lectura)
- Solo pueden EDITAR la jornada propia
- Janneth: edita solo mañana, ve tarde en lectura
- Juan Diego: edita solo tarde, ve mañana en lectura
- Ven pestañas: Pendientes, Hoy, Historial, Horario del J, Configuración
- El Horario del J abre por defecto en la jornada del coordinador
- Botones "Editar día" y "Ausencia" solo visibles cuando están en su jornada

### Docentes
- Solo ven su jornada
- Solicitan reservas (requieren aprobación del coordinador)
- Ven notificaciones de cambios de horario
- Consultan su horario individual

---

## Funcionalidades implementadas

### ✅ Login con escudo MJB
- Escudo transparente (fondo negro eliminado via flood-fill) embebido como base64
- Campo de búsqueda de usuario + PIN
- Enlace "¿Olvidaste tu PIN?" → envía PIN temporal 6 dígitos al correo

### ✅ Disponibilidad de recursos
- Cuadrícula día/semana con celdas de color por estado
- Verde=libre, Rojo=ocupado, Gris=clase regular, Azul=propio

### ✅ Horario del J — tres modos
- **Por aulas:** selector Mañana/Tarde, tabla con bloques horarios correctos por jornada. Paleta de docentes filtrada por jornada seleccionada
- **Por docente:** selector con pastilla de color. Vista día (banners Opción B agrupados por bloques institucionales) y semana (tabla con Aula·Grado, colores por aula y grado). Días de tarde resaltados en dorado para docentes mixtos
- **Por grupo:** selector con Director·Grupo para mañana. Vista día (banners) y semana (tabla con Prof·Aula). CI en dorado martes B6. Encabezado con nombre completo del director al entrar

### ✅ Sistema de notificaciones
- Banner expandible al inicio de sesión del docente
- 6 tipos: rectoría, coordinador, intercambio, aprobada, rechazada, cancelada
- Marcar leídas individualmente o todas

### ✅ Panel de coordinadores
- Pestañas: Pendientes, Hoy, Historial, Horario, Configuración
- Aprobar/rechazar solicitudes
- Selector de tema oscuro/claro en Configuración

### ✅ Panel de la rectora
- Asignación directa con popup compacto
- Historial propio
- Sin pestañas de Pendientes ni Hoy

### ✅ Popup de la rectora
- Se activa al hacer clic en cualquier bloque desde Disponibilidad
- Muestra espacio/fecha/bloque prellenados
- Selector de motivo predefinido
- Aviso de conflicto si el espacio está ocupado
- Notifica al docente afectado

### ✅ Tema oscuro/claro
- Toggle 🌙/☀️ en el header
- Persiste en localStorage

### ✅ Botón de cierre de sesión
- La pastillita con casita 🏠 junto a "I.E. Manuel J. Betancur" cierra sesión y regresa al login

### ✅ Recuperación de PIN
- Enlace en login, envía PIN temporal 6 dígitos al correo institucional

### ✅ CORS resuelto
- JSONP fallback en api.ts para funcionar desde GitHub Pages

---

## Funcionalidades INCOMPLETAS — requieren trabajo

### ⚠ Editor de horario temporal (EditorHorario.tsx) — REDISEÑO NECESARIO

**Estado actual:** Tiene flujo de 3 pasos (cuántos docentes → declarar ausencias → editor de cajoncitos). Los cajoncitos son arrastrables con barra de espera. PERO:

**Problemas por resolver:**
1. La tabla del paso 3 muestra TODAS las aulas — debe mostrar SOLO los grupos afectados por las ausencias declaradas
2. Los bloques del docente ausente se resaltan en rojo intenso — deben ser más tenues/apagados: fondo muy sutil, letra roja pero borde discreto, sensación de "desactivado"
3. Los bloques del ausente se pueden mover a la barra de espera pero NO deben exigir reubicación para poder guardar (el profesor no está, esos bloques simplemente se eliminan)
4. Colores de docentes de tarde ya están incluidos

### ⚠ Asistente de ausencia avanzado (AsistenteAusencia.tsx) — INCOMPLETO

**Estado actual:** Existe el componente con flujo de 4 pasos y generación de banners HTML/WhatsApp. PERO:

**Lo que falta implementar:**
1. Propuestas inteligentes de reorganización:
   - Opción A: Entrada tarde (si huecos al inicio)
   - Opción B: Salida temprana (si huecos al final)
   - Opción C: Correr horario automáticamente (reorganizar bloques)
   - Opción D: Reorganizar manualmente (ir al editor de cajoncitos)
   - Opción E: Apoyo pedagógico (PTA, Psicoorientador, UAI, Otro)
2. Integración con el editor: cuando el coordinador elige "reorganizar manualmente", debe abrir el editor con SOLO los grupos afectados visibles
3. Generación de banner HTML y texto WhatsApp con el horario modificado
4. Envío de correo automático a coordinador + Blandón + Uriel López

### ⚠ Tema claro — MAL IMPLEMENTADO

El modo claro existe pero los elementos no se adaptan correctamente. Muchos títulos y botones no se ven porque están diseñados para fondo oscuro. Requiere una ambientación gráfica completa pensada para tema claro — no es un simple cambio de fondo.

---

## Colores por aula (color del TEXTO)

| Aula | Color | Hex |
|------|-------|-----|
| Aula 1 | Azul cielo | `#60a5fa` |
| Aula 2 | Verde menta | `#34d399` |
| Aula 3 | Naranja | `#fb923c` |
| Aula 4 | Violeta | `#a78bfa` |
| Aula 5 | Amarillo | `#fbbf24` |
| Aula 6 | Rosa | `#f472b6` |
| Aula 7 | Cian | `#22d3ee` |
| Aula 8 | Rojo coral | `#f87171` |
| Aula 9 | Verde lima | `#a3e635` |
| Aula 10 | Durazno | `#fdba74` |
| Sala Info. | Blanco | `#f1f5f9` |
| Lab. Ciencias | Rojo carmesí | `#ff4444` |

## Colores por grado (color del TEXTO)

| Grado | Color | Hex |
|-------|-------|-----|
| Noveno (9.x) | Azul lavanda | `#c4b5fd` |
| Décimo (10.x) | Dorado | `#fde68a` |
| Once (11.x) | Verde esmeralda | `#6ee7b7` |
| Sexto (6º) | Rosa claro | `#fca5a5` |
| Séptimo (7º) | Celeste | `#93c5fd` |
| Octavo (8º) | Naranja suave | `#fed7aa` |

## Colores por rol (pastilla del usuario)

| Rol | Fondo | Texto |
|-----|-------|-------|
| Rectora | Dorado semitransparente | `#e8c84a` |
| Coordinador | Rojo semitransparente | `#f08080` |
| Docente | Verde semitransparente | `#86efac` |

---

## Reglas de diseño

### Contraste
- Texto inactivo de botones: `rgba(255,255,255,0.5)` — blanco semitransparente
- Texto activo: blanco puro
- Los botones deben ser legibles ANTES de hacer hover o seleccionarlos
- Efecto hover en menú de navegación: ilumina al pasar el cursor

### Formato de vistas
- Vista por día del docente: banners Opción B (agrupados por bloques institucionales)
- Vista por semana del docente: tabla compacta con Aula·Grado
- Vista por día del grupo: banners con Profesor + Aula
- Vista por semana del grupo: tabla con Prof·Aula

### Principio general
- No repetir el nombre del docente dentro de su propio horario
- No repetir el nombre del grupo dentro del horario del grupo
- Los colores de texto diferencian aulas y grados, no el fondo de las celdas

---

## Bugs conocidos resueltos

| Bug | Causa | Solución |
|-----|-------|----------|
| Reset automático cada 2 min | `setInterval(sincronizarConBackend, 120000)` | Se eliminó el setInterval del HTML compilado |
| Coordinadores no guardaban sesión | `saveUserId` solo guardaba docentes | Ahora guarda todos los roles |
| Vista se resetea al cambiar de sección | `vista` era estado local de App | Movido a Zustand store (`vistaActual`) |
| Juan Diego veía horario de mañana | `jornadaAulas` iniciaba en 'manana' para todos | Default basado en jornada del usuario |
| Bloques libres miércoles tarde | Juan C. excluido de PROFS_TARDE para miércoles | Detección por notación de grado (`º` = tarde) |

---

## Aulas fijas mañana (confirmadas)

| Docente | Aula |
|---------|------|
| Ledis | Aula 1 |
| Marta | Aula 2 |
| Johana | Aula 3 |
| Gloria A. | Aula 4 |
| Beatriz | Aula 5 |
| Claudia | Aula 6 |
| Doris | Aula 7 |
| Carlos | Aula 8 |
| Margarita | Aula 9 |
| Uriel | Aula 10 |
| Julián | Lab. Ciencias |
| Yoguis (Juan Carlos Blandón) | Sala Informática |

Docentes rotativos mañana (aulas variables por día/bloque):
- **Mónica Tatiana Córdoba** (`monica_c`): Mar B1-B2→Lab.Ciencias; Jue B3-B4→Aula6, B5-B6→Aula2; Vie B1-B2→Aula6, B3-B4→Aula3, B5-B6→Aula9
- **Jorge Iván Acevedo Tabares** (`jorge`): Lun B3-B5→Aula7; Mar B2-B3,B5-B6→Aula2; Mie B1-B2→Aula2, B3-B4→Aula5, B5-B6→Aula10; Jue B1-B4→Aula2; Vie B1-B4→Aula5
- **Adolfo León Arango Arroyave** (`adolfo`): siempre en el Patio (Educación Física). No tiene salón. Patio NO aparece en la cuadrícula de reservas.

Nota: 'MARGARA' en código (`margara`) = Margarita María Montoya Olaya. 'LILIANA' en el docx original = Carlos Cárdenas (id: `carlos`) — docente diferente a Yoguis (Juan Carlos Blandón Vargas).

---

## Datos pendientes por obtener del usuario

1. Directores de grupo — jornada tarde (nombres)
2. Horario media técnica — Felipe Piedrahita, Valentina Jaramillo (Versión 3)

---

## Convenciones de código

- Idioma del código: inglés (nombres de variables y funciones)
- Idioma de la interfaz: español
- Idioma de comentarios: español
- Componentes: funcionales con hooks
- Estado: Zustand — NO usar useState para estado que necesite persistir entre re-renders de App
- Los componentes helper (CeldaDocente, CeldaGrupo, etc.) NO deben contener estado ni overlay — esos van en el componente padre
- Build: `npx vite build` → empaquetar CSS + JS en un solo HTML
- Bundling: usar Node.js (no Python — timeout issues con archivos grandes)
