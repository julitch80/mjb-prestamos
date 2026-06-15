# Manual de usuario — Sistema MJB Préstamos

**I.E. Manuel J. Betancur — Sistema de préstamo de recursos y gestión de horarios**

---

## 1. ¿Qué es?

Es la aplicación oficial del colegio para:

- **Solicitar la reserva** de aulas, espacios y equipos institucionales.
- **Consultar el horario** propio, el de otros docentes y el de los grupos.
- **Ver modificaciones** del horario del día por ausencia de profesores o eventos.
- **Ver avisos** publicados por la coordinación.

Funciona en **PC, tableta y celular**. Una vez instalada, también funciona **sin conexión** para consultar información ya cargada.

---

## 2. ¿Dónde está?

La aplicación vive en esta dirección:

```
https://julitch80.github.io/mjb-prestamos/
```

(es un enlace público — basta con abrirlo en cualquier navegador moderno)

---

## 3. Cómo instalarla en un computador

La aplicación es una **PWA** (Progressive Web App), lo que significa que se instala como cualquier programa pero pesa muy poco y se actualiza sola.

### Con Google Chrome o Microsoft Edge (recomendado)

1. Entra a `https://julitch80.github.io/mjb-prestamos/` desde el navegador.
2. Espera que cargue la pantalla de inicio (vas a ver el escudo del colegio).
3. **Mira la barra de direcciones** del navegador. Al lado derecho aparecerá un ícono pequeño con el dibujo de un monitor y una flecha hacia abajo (⬇️ o ⊕). Si pasas el cursor sobre él dirá **"Instalar MJB Préstamos"**.
4. Clic en ese ícono → botón **"Instalar"**.
5. La aplicación queda como un programa en tu escritorio y en el menú de inicio de Windows.

> Si no ves el ícono de instalación, abre el menú del navegador (⋮ en la esquina superior derecha) → busca **"Instalar MJB Préstamos…"** y clica ahí.

### Con Firefox o Safari

Estos navegadores no soportan tan bien la instalación de PWAs en escritorio. **Te recomendamos usar Chrome o Edge** para PC. La aplicación seguirá funcionando en Firefox/Safari, pero no se instala como programa: tendrás que entrar siempre desde el navegador.

---

## 4. Cómo instalarla en celular o tableta

### Android (Chrome)

1. Abre Chrome y entra a `https://julitch80.github.io/mjb-prestamos/`.
2. Espera que cargue.
3. Toca el menú **⋮** (esquina superior derecha) → **"Agregar a pantalla de inicio"** o **"Instalar aplicación"**.
4. Confirma con **"Instalar"**.
5. El ícono del colegio aparecerá entre tus aplicaciones.

### iPhone o iPad (Safari)

1. Abre Safari (no funciona con Chrome en iOS para esto) y entra a la dirección.
2. Toca el botón de **compartir** (cuadrado con flecha hacia arriba, abajo en el centro).
3. Desliza y elige **"Agregar a pantalla de inicio"**.
4. Confirma con **"Agregar"**.

---

## 5. Primera vez que entras: el inicio de sesión

Al abrir la aplicación verás:

- El escudo del colegio en el centro.
- El título **I.E. Manuel J. Betancur**.
- Un campo de búsqueda que dice **"¿Quién eres?"**.

### Pasos

1. **Escribe tu nombre o tu apellido** en el campo de búsqueda. No tienes que escribir el nombre completo: con dos o tres letras suele bastar.
2. Selecciona tu nombre cuando aparezca en la lista.
3. Aparecerá un campo para escribir tu **PIN** (clave numérica de 4 a 6 dígitos).
4. **Tu PIN inicial es `11111`** (cinco unos). En la primera entrada, cámbialo desde la sección **Configuración** por uno personal.
5. Toca **Ingresar**.

### Si olvidaste tu PIN

1. En la pantalla de inicio de sesión, después de seleccionar tu nombre, toca **"¿Olvidaste tu PIN?"**.
2. El sistema envía un **PIN temporal de 6 dígitos** a tu **correo institucional**.
3. Revisa tu bandeja de entrada en `iemanueljbetancur.edu.co`.
4. Vuelve a la aplicación y usa ese PIN temporal para entrar.
5. Cámbialo inmediatamente por uno permanente.

---

## 6. Recorrido por las secciones

Una vez dentro, en la parte superior verás la barra de navegación con las siguientes pestañas. Las que ves dependen de tu rol (docente, coordinador o rectora).

### Reservar (todos)

Aquí pides el préstamo de un aula, un espacio (como el auditorio) o un equipo (como el video beam).

- Verás una **cuadrícula semanal** con los espacios disponibles.
- Cada casilla tiene un color:
  - **Verde** → libre, puedes reservar.
  - **Gris** → ya hay clase regular en ese momento.
  - **Rojo** → reservado por otro docente.
  - **Azul** → es una reserva tuya.
  - **Dorado con ★** → reservado por la rectora.
- Haz **clic en una casilla verde** para crear una solicitud.
- Llena el formulario emergente: **propósito** y, si necesitas, **equipos adicionales**.
- Toca **Solicitar**.
- Tu coordinador recibirá una notificación para aprobar o rechazar.

### Mis reservas (todos)

Aquí ves el historial de todo lo que has solicitado, con su estado:

- **Pendiente** — esperando aprobación del coordinador.
- **Aprobada** — el día indicado, recoge las llaves en coordinación.
- **Rechazada** — se muestra el motivo.
- **Cancelada** — la cancelaste tú.
- **En uso / Devuelta** — el coordinador registró la entrega y devolución.

### Panel (solo coordinadores)

Tu centro de control. Tiene cuatro pestañas:

- **Pendientes** — solicitudes que están esperando tu decisión. Las apruebas o rechazas con un toque.
- **Hoy** — qué hay reservado hoy (para entregar llaves y registrar devolución).
- **Historial** — todas las reservas pasadas, con filtros.
- **Configuración** — donde cambias tu PIN y otras preferencias.

### Asignación (solo rectora)

Permite asignar espacios directamente, sin pasar por el proceso de solicitud-aprobación, para necesidades institucionales puntuales.

### Horario (todos)

Tres modos de ver el horario del colegio:

- **Por docente** — pones el nombre de un profesor y ves sus clases en la semana.
- **Por grupo** — pones el código del grupo (ej: `10.3` o `7º2`) y ves toda su semana con qué profesor y en qué aula.
- **Por aulas** — ves qué pasa en cada aula a lo largo de la semana.

Cada modo tiene dos vistas: **Semana completa** y **Día específico**.

Si eres coordinador, en tu propia jornada aparecen también dos botones extra:

- **✎ Editar** — para hacer modificaciones temporales por ausencia de docentes.
- **⏱ Acortar** — para acortar la jornada en caso de acto cívico o reunión.

### Si hay algún cambio publicado

En la parte superior del Horario aparecen **banners** anunciando:

- **Modificaciones de horario próximas** (en azul).
- **Jornadas acortadas próximas** (en ámbar).

Haz clic en cualquiera para ver el detalle del día afectado.

---

## 7. Cambiar entre modo claro y modo oscuro

En la esquina superior derecha de la app, junto a tu nombre, aparece:

- 🌙 (luna) si estás en modo oscuro → tócalo para pasar a claro.
- ☀ (sol) si estás en modo claro → tócalo para pasar a oscuro.

La preferencia queda guardada para tu próxima sesión.

---

## 8. Cerrar sesión

En la esquina superior derecha, junto al ícono de tema, hay un ícono de **flecha saliendo de una puerta** (📤). Tócalo para cerrar tu sesión.

Después tendrás que volver a buscar tu nombre y poner tu PIN para entrar de nuevo.

---

## 9. Recomendaciones

- **Cambia tu PIN inicial** (`11111`) por uno personal en cuanto entres por primera vez.
- **Instala la aplicación** en tu celular y en el PC del aula para tener acceso rápido.
- **Revisa la sección Horario** al inicio del día por si hay modificaciones publicadas.
- **No compartas tu PIN** con nadie. Cada usuario debe usar el suyo.
- **Las solicitudes de aulas** requieren aprobación del coordinador — pídelas con anticipación.

---

## 10. Si algo no funciona

| Problema | Qué hacer |
|---|---|
| La aplicación no carga | Verifica tu conexión a internet. Si tiene mucho tiempo abierta, ciérrala y vuelve a abrir. |
| No recibo el PIN temporal | Revisa tu carpeta de spam. Si no llega en 5 minutos, contacta a Julián. |
| Mi nombre no aparece en la búsqueda | Probablemente el correo institucional no está registrado en el sistema. Avisa a coordinación. |
| La aplicación se ve diferente / con errores | Cierra la app, ábrela de nuevo. Si persiste, reinstálala. |
| Otras dudas | Contactar a Julián David Medina Tamayo. |

---

**Sistema MJB Préstamos** — Versión 2026
Creador: **Julián David Medina Tamayo**, docente del área de física, I.E. Manuel J. Betancur
