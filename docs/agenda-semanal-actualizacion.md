# Agenda semanal — flujo de actualización

## Cómo funciona hoy

La agenda semanal institucional vive como datos estáticos en
`src/data/agendaSemanal.ts` (constante `AGENDA_ACTUAL`), consumida por
`src/components/AgendaSemanal.tsx`. No depende de Firebase ni del backend de
Apps Script — funciona igual en modo `pin` y en modo `google`.

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
