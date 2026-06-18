# Publicar “MJB Préstamos” en la página del colegio

**Para:** quien administra la página web institucional
**De:** Julián D. Medina (creador de la aplicación)
**Asunto:** Enlazar/incrustar la app de préstamos y horarios en la página

---

## Mensaje (puedes reenviar esto tal cual)

> Hola, te comparto la aplicación **MJB Préstamos** (préstamo de aulas/recursos, horarios y acompañamientos) para que quede accesible desde la página del colegio.
>
> La aplicación ya está publicada y funcionando en esta dirección:
>
> **https://julitch80.github.io/mjb-prestamos/**
>
> Lo ideal es agregar un **botón o enlace** que la abra (ver Opción A). Si prefieres mostrarla incrustada dentro de una página, también se puede (Opción B), aunque algunas funciones (inicio de sesión guardado, notificaciones) trabajan mejor cuando se abre en su propia pestaña.
>
> Cualquier duda, quedo atento. Gracias.

---

## Opción A — Botón / enlace (recomendada)

Es la forma más estable: abre la app en su propia pestaña, con todas las funciones.

**Enlace directo:**

```
https://julitch80.github.io/mjb-prestamos/
```

**Código de botón (HTML)** — pégalo donde se permita insertar código:

```html
<a href="https://julitch80.github.io/mjb-prestamos/"
   target="_blank" rel="noopener"
   style="display:inline-block; padding:14px 28px; background:#2563eb; color:#fff;
          font-family:Arial,sans-serif; font-size:16px; font-weight:bold;
          text-decoration:none; border-radius:12px;">
  Abrir MJB Préstamos
</a>
```

### Si la página es Google Sites
1. Abre el sitio en modo edición.
2. Coloca el cursor donde quieras el botón.
3. Menú **Insertar → Botón**.
4. En **Nombre** escribe: `MJB Préstamos`.
5. En **Vínculo** pega: `https://julitch80.github.io/mjb-prestamos/`
6. Publica el sitio (botón **Publicar**, arriba a la derecha).

---

## Opción B — Incrustar dentro de la página (iframe)

Muestra la app embebida. Úsala solo si prefieres que se vea dentro de la página.
> Nota: dentro de un iframe, el inicio de sesión y las notificaciones pueden
> comportarse de forma limitada. Para uso pleno, recomienda a los usuarios el
> botón de la Opción A.

**Código para pegar:**

```html
<iframe
  src="https://julitch80.github.io/mjb-prestamos/"
  title="MJB Préstamos"
  style="width:100%; height:820px; border:0; border-radius:12px;"
  loading="lazy"
  allow="clipboard-write">
</iframe>
```

### Si la página es Google Sites
1. Abre el sitio en modo edición.
2. Menú **Insertar → Insertar código** (Embed / “Insertar código”).
3. Pega el código del iframe de arriba.
4. Ajusta el tamaño del recuadro si hace falta.
5. **Publicar** el sitio.

> Alternativa en Google Sites: **Insertar → Insertar → Por URL** y pega
> `https://julitch80.github.io/mjb-prestamos/` (según la versión del sitio,
> puede mostrarlo como tarjeta o incrustado).

---

## Datos de referencia

| Dato | Valor |
|------|-------|
| Dirección de la app | https://julitch80.github.io/mjb-prestamos/ |
| Funciona en | Computador y celular (navegador) |
| Instalable como app | Sí (Chrome → “Agregar a pantalla de inicio”) |
| Actualizaciones | Automáticas (no requiere reinstalar) |

Si la página institucional usa otro sistema (WordPress, etc.) y necesitas el
código adaptado, avísame y lo ajusto.
