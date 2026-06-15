# Tarea para el encargado de la web institucional

**Para:** Profesor Manolo Burguera
**De:** Julián David Medina Tamayo (creador del Sistema MJB Préstamos)
**Asunto:** Agregar enlace al menú principal de la página del colegio
**Tiempo estimado:** 10 – 15 minutos
**Fecha:** 14 de junio de 2026

---

## Contexto

La I.E. Manuel J. Betancur ya cuenta con un **Sistema de Préstamo de Recursos** que actualmente funciona en producción y que también gestiona modificaciones temporales del horario y jornadas acortadas por actos cívicos o reuniones.

Cuando un coordinador hace un cambio en el horario o acorta la jornada, el sistema **publica automáticamente un aviso** en una página alojada en Google Sites bajo el dominio del colegio:

> **`https://sites.google.com/iemanueljbetancur.edu.co/horarios`**

Esa página ya está activa, alimentada por el sistema y disponible al público. Solo falta **enlazarla desde la web institucional** para que la comunidad escolar (estudiantes, docentes y familias) sepa que existe.

---

## Lo que se necesita hacer

**Agregar un enlace nuevo al menú principal** del sitio `iemanueljbetancur.edu.co` que apunte al Google Site anterior.

### Texto sugerido para el enlace

| Opción | Texto del enlace |
|---|---|
| Recomendada | **Horarios y avisos** |
| Alternativa 1 | Avisos del día |
| Alternativa 2 | Modificaciones de horario |

### Ubicación sugerida dentro del menú

Cualquiera de estas tres opciones funciona; elige la que mejor encaje con la estructura del menú actual:

1. **Como entrada propia** en el menú principal, al mismo nivel que "Inicio", "Transparencia", "Atención y Servicios a la Ciudadanía", etc.
2. **Dentro del submenú "G. Académica"** — encaja bien temáticamente.
3. **Dentro del submenú "G. Comunidad"** — útil si se quiere visibilidad para padres y estudiantes.

### Destino del enlace

```
https://sites.google.com/iemanueljbetancur.edu.co/horarios
```

Importante: el enlace debe abrir en **una ventana nueva** (en HTML, `target="_blank"`). Esto se hace marcando la casilla "Abrir en pestaña nueva" si la plataforma te lo ofrece, o agregando `target="_blank"` al `<a>` si editas HTML directamente.

---

## Cómo hacerlo (depende del editor que usa el colegio)

### Si entras desde el panel de administración de Master2000

1. Inicia sesión en la plataforma Master2000 con la cuenta administrativa del colegio.
2. Busca la sección de **gestión del menú** o **menús personalizados**.
3. Agrega una nueva entrada con:
   - **Etiqueta**: `Horarios y avisos`
   - **URL**: `https://sites.google.com/iemanueljbetancur.edu.co/horarios`
   - **Abrir en pestaña nueva**: sí
4. Guarda y verifica en la página pública del colegio que el enlace aparezca y funcione.

### Si editas el HTML/PHP del template directamente

Busca el archivo de plantilla del menú (probablemente `header.php`, `nav.php` o similar) y agrega una línea como:

```html
<li>
  <a href="https://sites.google.com/iemanueljbetancur.edu.co/horarios" target="_blank">
    Horarios y avisos
  </a>
</li>
```

Donde encajen las demás entradas del menú.

---

## Cómo verificar que quedó bien

1. Abre `iemanueljbetancur.edu.co` en un navegador.
2. Localiza el nuevo enlace en el menú.
3. Haz clic. Debe abrirse `https://sites.google.com/iemanueljbetancur.edu.co/horarios` en una pestaña nueva.
4. En esa página verás un bloque titulado "Avisos del día" con el contenido más reciente publicado por la coordinación.

---

## ¿Por qué importa?

Hoy la comunidad escolar **no tiene una vía oficial** para enterarse de cambios en el horario del día (cuando falta un docente, cuando hay acto cívico, cuando la jornada se acorta, etc.). Los mensajes informales por WhatsApp llegan tarde o se pierden.

Con este enlace activado:

- **Padres y familias** pueden consultar antes de mandar a sus hijos al colegio si la jornada cambia.
- **Estudiantes** y **docentes** tienen una fuente oficial siempre actualizada.
- **El colegio** unifica todas las comunicaciones de horario en un solo canal público.

El contenido se actualiza **en tiempo real** desde el sistema interno, sin que nadie tenga que copiar y pegar nada manualmente. La página queda siempre al día.

---

## ¿Dudas?

Para cualquier consulta técnica sobre el enlace o cómo se ve la página de avisos, contactar a Julián David Medina Tamayo.

Gracias por tu colaboración.
