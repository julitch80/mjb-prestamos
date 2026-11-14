# Pedido para la sesión de Asistencia: códigos de centros de interés solo en serie 600

Fecha: 2026-11-14. Pedido por Julián. Para publicar sigue haciendo falta su «publica».

## Hallazgo
- Se hizo la primera subida real de la optativa de 11.2 al Máster con la extensión nueva
  (`extension-master2000/`).
- Julián comprobó que **el Máster solo acepta códigos de la serie 600** en la optativa (C.I).
  Rechaza los 7xx y los 8xx.
- Esto **revierte la regla del 2026-11-09** («Alto → primer dígito 7, Superior → 8»), que hoy aplica
  `codigoDeNivel` en `src/asistencia/domain/valoracion.ts`.

## Regla nueva (Julián, 2026-11-14)
- Cada estudiante puede llevar **varios códigos**, pero **todos de la serie 600**: el código base de
  `INDICADORES_CI`.
- El código **no depende** de la valoración. El nivel va solo en «Val» (2 Básico · 3 Alto · 4 Superior).

## Lo que se pide
1. Que la valoración del líder, el Excel del director (`hojaResultadoCentros`) y cualquier otra
   exportación entreguen **siempre el código base 6xx**.
2. **Valoraciones ya guardadas con 7xx/8xx (Julián, 2026-11-14):** los líderes NO deben volver a
   valorar nada. Se conserva el mismo indicador y el mismo nivel, y solo se convierte el código con
   `600 + (código % 100)` (702 → 602, 880 → 680). Puede hacerse al exportar o migrando los datos,
   pero ninguna exportación puede salir con 7xx/8xx. Desde ya, la extensión hace esta misma
   conversión por su cuenta.
3. Interfaz de valorar: quitar la triple muestra 6xx/7xx/8xx (`ValoracionCentro.tsx` ~líneas 780-782)
   y mostrar un solo código.
4. Actualizar el comentario de `indicadores-ci.ts` y las notas del Excel («Los indicadores van en
   COD1 a COD3»).
5. Pruebas, y la entrega con los hashes de los archivos.

## Contexto
La extensión toma los códigos tal cual del Excel de Centros de interés. Mientras tanto se le agrega
un candado: los estudiantes con códigos que no sean de la serie 600 se marcan en rojo y no se suben.
