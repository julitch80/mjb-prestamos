# Calendario académico 2026 — PRD

## Qué hace
La pestaña **Académico** tiene dos botones: **Calendario** (por defecto) y **Asignación** (la pantalla de siempre, sin cambios). El calendario muestra las fechas del documento oficial «Calendario académico 2026 versión 2» y avisa a los docentes antes de las fechas que les exigen algo.

- Encabezado: «Tercer periodo · semana N de 14 · faltan X días lectivos».
- Búsqueda siempre visible (sin importar tildes ni mayúsculas) y filtros por categoría.
- **Próximo**: los 6 siguientes con cuenta regresiva («en 12 días»); lo de esta semana va resaltado.
- **Lo que falta**: agrupado por mes, con una sección plegada «Ya pasó (n)». Lo «por definir» o «no se realiza» queda al final.
- **Mes**: cuadrícula con puntos de color; tocar un día lista sus eventos.
- Eventos de **Grado 11** llevan la etiqueta «Grado 11»; un docente solo los ve si dicta en 11 (coordinación y rectoría los ven todos).

## Quién puede qué
| Rol | Ve | Edita |
|---|---|---|
| Docente | Calendario y avisos | No |
| Coordinador / Rectora | Calendario y avisos (coordinador) | Sí |
| Superusuario | Edita si llega a la pestaña (hoy la pestaña no está en su menú) | Sí |

Editar = cambiar fechas, marcar «por definir» o «no se realiza», cambiar título/nota, agregar o borrar eventos. Siempre con **motivo obligatorio**. Un evento cuyas fechas cambiaron en los últimos 10 días muestra la insignia «Cambió» con la fecha anterior tachada. «Ver registro de cambios» lista quién, cuándo, qué y por qué.

## Avisos a docentes
Los eventos marcados «avisar a docentes» (cierres de sistema, planes de apoyo, informes, alertas académicas, comisiones, reuniones de padres, diario de campo, entregas a coordinación) generan un aviso arriba de la app a **7, 2 y 0 días** (3–7 d → escalón 7; 1–2 d → escalón 2; el mismo día → 0). Se calculan en el celular, sin servidor. Se descartan por evento y escalón (queda guardado en el navegador). Solo docentes y coordinadores. Es un aviso dentro de la app, **no** una notificación push.

## Dónde viven los datos
- Respaldo: `src/data/calendarioAcademico/semilla2026.ts` (transcrito del documento).
- Real: Firestore `calendarioAcademico/2026` (`eventos`, `actualizado`, `porCorreo`) y `calendarioAcademico/2026/cambios` (registro que solo se agrega). Si el documento no existe se muestra la semilla; el primer guardado de un coordinador escribe el calendario completo. Sin Firebase (modo PIN) es solo lectura.
- Reglas: lee cualquier usuario activo; escriben coordinador, rectora y superusuario; nadie borra el documento; en suplantación todo es solo lectura.

## Cómo se interpretó el documento (año 2026)
- Periodos: P1 26-ene→1-may; P2 4-may→21-ago; P3 **24-ago**→4-dic (el documento también dice 23-ago, que es domingo; queda en la nota). Grado 11, P3: 24-ago→20-nov.
- Recesos de estudiantes: los días de la semana del documento no corresponden a 2026, así que se usaron rangos: Semana Santa 30-mar→3-abr; mitad de año 22-jun→10-jul; octubre 5→9-oct (el 12 es festivo, regresan el 13); fin de año desde el 7-dic. La nota de cada uno conserva el texto original.
- Semanas lectivas: no se cuentan las semanas de receso. El 16-oct es la **semana 7 de 14**; el 19-oct empieza la 8 (coincide con la Agenda). Los días lectivos restantes excluyen fines de semana, recesos y festivos (los de `tareas/calendario.ts`).
- Tabla grande: un evento por celda y periodo. «Apertura del sistema: Permanente» se omite. P3 y Grado 11 tienen **dos** ventanas de planes de apoyo (la segunda con horario especial). P3: cierre del sistema = cierre final, 4-dic.
- «Noviembre» (evaluación docentes 1278) = 1→30 nov; «Enero 2027» (autoevaluación institucional) = 1→31 ene 2027; «Semana de educación vial» queda **por definir**; «Foro corregimental» **no se realiza**.
- Desarrollo institucional 1: 12→23 ene (rango tal como está en el documento).
- No se incluyen los festivos de Colombia (los trae Tareas).
- Duda abierta: las comisiones de grado 11 caen el 28-nov, que es **sábado**; se dejó como dice el documento.

## Criterios de aceptación
1. Pestaña «Académico» abre en Calendario; «Asignación» muestra la pantalla anterior intacta.
2. Con fecha 16-oct-2026: «Tercer periodo · semana 7 de 14 · faltan 34 días lectivos».
3. Buscar «antioquenidad» (con o sin tilde) encuentra el evento del 28-ago.
4. Funciona a 375 px de ancho, en tema claro y oscuro.
5. Un docente no ve botones de edición; un coordinador edita con motivo y el cambio aparece en el registro.
6. El 21-oct un docente ve el aviso de las alertas académicas (a 7 días); el 28-oct, el aviso «hoy».
7. Las reglas de Firestore rechazan escrituras de docentes, de usuarios inactivos y en suplantación.
