# Agenda semanal — flujo de actualización

## Cómo funciona hoy

La agenda semanal institucional vive como datos estáticos en
`src/data/agendaSemanal.ts` (constante `AGENDA_ACTUAL`), consumida por
`src/components/AgendaSemanal.tsx`. No depende de Firebase ni del backend de
Apps Script — funciona igual en modo `pin` y en modo `google`.

## La ruta acordada: la carpeta `Agenda/`

Julián deja el PDF de la semana en **`Agenda/`**, en la raíz del repositorio. Sin
renombrar nada: el nombre que traiga el archivo sirve.

Claude toma **el archivo más reciente de esa carpeta**, lo transcribe a
`AGENDA_ACTUAL` y publica. No hace falta adjuntarlo al chat ni avisar de dónde
está; basta con decir "actualiza la agenda".

**Los PDF no se versionan.** `Agenda/` está en `.gitignore` a propósito: el
repositorio es público y las agendas traen nombres de estudiantes, grupos y
actividades internas. Lo que se publica es la transcripción, no el original.

### Cómo se lee el PDF

El entorno no tiene `poppler`, así que el visor de PDF de Claude no funciona.
La vía que sí funciona es extraer el texto con `pdfplumber`, que ya está
instalado:

```python
import pdfplumber
with pdfplumber.open('Agenda/<archivo>.pdf') as pdf:
    for pg in pdf.pages:
        print(pg.extract_text())
```

El pie de página institucional se repite en todas las páginas y conviene
filtrarlo. La agenda institucional suele ocupar las tres primeras; lo que sigue
es la agenda de profesionales, que va aparte.

## Flujo semanal

1. Cada viernes, Julián recibe o genera el PDF oficial "AGENDA DE LA SEMANA
   n" del Equipo Técnico Institucional.
2. Adjunta el PDF (o un enlace/captura) a Claude.
3. Claude transcribe fielmente el contenido a la constante `AGENDA_ACTUAL` en
   `src/data/agendaSemanal.ts` — respetando los datos exactos del documento
   (horas, actividades, asistentes, lugares, responsables, festivos y
   notas), sin inventar ni completar información faltante.
4. Julián revisa el diff y hace commit + push a `master`.
5. GitHub Actions dispara el build automático y despliega a GitHub Pages.
6. La app en producción se auto-actualiza; los usuarios con la PWA instalada
   la reciben en su próxima carga (el service worker refresca el bundle).

## Notas

- Si una semana no tiene agenda nueva (ej. vacaciones), se puede dejar
  `AGENDA_ACTUAL` de la última semana publicada — el componente no oculta
  agendas "vencidas" automáticamente; es responsabilidad de quien actualiza
  mantenerla al día.
- Posible evolución futura: cargar la agenda desde una hoja de Google
  Sheets (como el resto del backend) para que Julián pueda editarla sin
  pasar por un commit. Requeriría un endpoint de lectura en Apps Script y
  cambiar `AgendaSemanal.tsx` para hacer fetch en vez de importar el
  módulo estático. No implementado todavía.
