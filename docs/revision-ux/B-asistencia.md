# Lote B — Asistencia, Alerta académica, Permanencia, Eventos, Llegadas tarde

Revisión de solo lectura (25-oct-2026) sobre `src/asistencia/**`. Celular primero.
Valoración general: el módulo está muy cuidado en lo fino (la alerta del docente, el aviso de
sincronización, la tarjeta «lista que toca ahora»). Los problemas son de **tamaño de los
botones, orden de las pantallas de coordinación y exceso de pestañas**, no de lógica.

## 1. Tareas frecuentes y su recorrido actual

**Docente: llamar lista (varias veces al día)**
1. Entra a Asistencia, ve la tarjeta «lista que toca ahora» (`TarjetaClaseAhora.tsx`) y toca «Pasar lista»: 2 toques hasta la planilla (muy bien).
2. En la planilla toca la casilla de cada estudiante, se abre un menú de marcas (`Planilla.tsx:683`), elige, se cierra: **2 toques por estudiante**.
3. Atajo existente: menú «⋯» de la columna, «Solo las vacías», «Todos a Presente» (`Planilla.tsx:523, 960-1000`), escondido tras un icono de 1 carácter.
4. Alternativa: «Pasar lista con QR» (`Planilla.tsx:398`).

**Docente: alerta académica (una vez por periodo)**
Mis grupos, grupo, pestaña «Alerta académica» (3 pantallas); toca estudiante, ⚠️/✓ (pasa solo al siguiente); «Entregar» al final de la lista (`AlertaAcademica.tsx:347`). Flujo corto y bien pensado.

**Director de grupo: reporte**
Mis grupos, grupo, fila de hasta 6 pastillas (Asistencia, Alerta, Reporte de alerta, Resultado CI, Dirección de grupo, Fotos), «Reporte de alerta» (`index.tsx:1375-1455`). 3 toques.

**Coordinación: seguir la alerta de la semana**
Asistencia, pestaña «Alerta académica» (1 de hasta 9), «Gestión», pasar «1. Abrir convocatoria» y «2. Convocatoria elegida», llegar a «3. Avance por grupo» (`AlertaCoordinacion.tsx:352, 384, 498`), tocar un grupo. Lo que se consulta a diario queda en tercer lugar.

**Coordinación: imprimir citaciones/planillas**
Dentro del bloque «2. Convocatoria elegida» (botones `descargarTodo`, `AlertaCoordinacion.tsx:~488`); hay que saber que está ahí.

**Coordinación: llegadas tarde en la puerta**
Pestaña «Llegadas tarde», elegir «Hall» o «Llega a coordinación», buscar por apellido o escanear, registrar (`LlegadasTarde.tsx:382-470`). Pantalla pensada para la puerta, con buscador enfocado. Bien.

## 2. Hallazgos

### H1. Casillas de la planilla de 36 px de alto
- **Dónde:** `Planilla.tsx:~560` (`h-9 w-14` = 36 px); candado y «⋯» de cada columna sin tamaño mínimo (`:510-527`); botón de color `h-9` (`:346`).
- **Principio:** objetivos táctiles ≥ 44 px; prevención de errores (marcar al vecino).
- **Sugerencia:** casilla de 44 px mínimo; candado y «⋯» con zona pulsable de 44×44 aunque el dibujo sea pequeño. La fila ya mide 44 por el avatar (`tamano={44}`), así que casi no cambia el alto de la tabla.
- **Beneficio:** alto · **Costo:** S

### H2. Muchos botones por debajo de 44 px en todo el módulo
- **Dónde:** `min-h-[36px]` en pastillas de pestañas (`index.tsx:2296`) y de grupo (`:1383` y siguientes), selector Mañana/Tarde (`AlertaCoordinacion.tsx:~337`), `EntregaAlerta.tsx:359`; `DireccionGrupo.tsx` (17 apariciones), `index.tsx` (13). Sin altura mínima: «Mosaico de fotos», «Pasar lista con QR», «+ Sesión de hoy» (`py-1.5`, ~32 px, `Planilla.tsx:389-408`); «Ajustar alertas» (`LlegadasTarde.tsx:390`); «+ Crear evento» (`Eventos.tsx:105`).
- **Principio:** accesibilidad móvil y consistencia (el propio módulo ya usa 44 px en «Entregar» y 52 px en las filas de alerta).
- **Sugerencia:** una sola clase de botón con mínimo 44 px; las pastillas pueden verse compactas con relleno invisible.
- **Beneficio:** alto · **Costo:** M (muchos archivos, cambio mecánico)

### H3. Demasiadas pestañas de primer nivel y mezcladas
- **Dónde:** `SECCIONES` en `index.tsx:2203-2270`: Planillas, Llegadas tarde, Tercera hora, Permanencia, Evasiones, Alerta académica, Eventos, Centros de interés, Restaurante (hasta 9, en 3 filas en el celular). Mezclan trabajo diario del docente, vigilancia de coordinación y programas.
- **Principio:** reconocer mejor que recordar; minimalismo; agrupar por tarea.
- **Sugerencia:** tres grupos: «Pasar lista» (Planillas, Eventos, Centros de interés, Restaurante), «Puerta y seguimiento» (Llegadas, Tercera hora, Evasiones, Permanencia) y «Alerta académica». O «Planillas» como inicio y un botón «Más» para lo de coordinación.
- **Beneficio:** alto · **Costo:** M

### H4. Alerta de coordinación: lo diario está al final
- **Dónde:** `AlertaCoordinacion.tsx:352-498`. Orden: abrir convocatoria, configurar/cerrar/imprimir, Avance por grupo, Seguimiento. Para ver quién va atrasado hay que desplazarse por dos bloques largos.
- **Principio:** visibilidad del estado; lo frecuente primero.
- **Sugerencia:** arriba una franja de estado («7 de 30 grupos entregaron · cierra el vie 30») y el Avance por grupo enseguida; abrir/configurar/imprimir plegado en «Administrar la convocatoria».
- **Beneficio:** alto · **Costo:** M

### H5. «Entregar» al final de una lista larga, sin ancla
- **Dónde:** `AlertaAcademica.tsx:344-354`. En modo «toque» el docente recorre 30-45 estudiantes y luego debe bajar al botón; si no baja, queda «Sin entregar» (`:270`) y el director no distingue.
- **Principio:** prevención de errores; visibilidad del estado.
- **Sugerencia:** barra fija abajo: «Marcados 12 de 32 · Entregar». Sirve también de confirmación de avance mientras se marca.
- **Beneficio:** alto · **Costo:** S

### H6. Marcar «Presente» cuesta lo mismo que marcar una falta
- **Dónde:** `Planilla.tsx:559-575` (toda casilla abre menú) y `:960-1000` (atajo escondido en «⋯»). Lo normal es que casi todos estén presentes.
- **Principio:** eficiencia de uso; la acción común debe ser la más corta.
- **Sugerencia:** al crear «+ Sesión de hoy» ofrecer un botón visible «Todos presentes» y luego tocar solo a los ausentes (1 toque por ausente). Es lo que ya se hizo con el modo «toque» de la alerta (`AlertaAcademica.tsx:30-45`).
- **Beneficio:** alto · **Costo:** S/M (`onLlenarColumna` ya existe)

### H7. Casilla «sin registrar» frente a ausencia: se distingue poco
- **Dónde:** `Planilla.tsx:578` (`·` con `opacity-70`); la explicación es un texto `text-xs` al pie (`:600-605`).
- **Principio:** visibilidad; riesgo de olvidar estudiantes.
- **Sugerencia:** contador junto a la columna del día («3 sin registrar») y aviso suave al salir con casillas vacías.
- **Beneficio:** medio · **Costo:** S

### H8. Acciones de la clase escondidas tras «⋯» y un candado
- **Dónde:** `Planilla.tsx:510-530`. Llenar, corregir, eliminar y cerrar sesión viven en dos iconos diminutos dentro del encabezado de cada columna (texto de 0,65 rem, ~10 px).
- **Principio:** reconocer mejor que recordar.
- **Sugerencia:** para la sesión de hoy, una barra visible sobre la tabla: «Todos presentes · Cerrar clase · Más…».
- **Beneficio:** medio · **Costo:** M

### H9. Textos de 10 px y encabezados de 0,65 rem
- **Dónde:** `Planilla.tsx:498-503` (`text-[0.65rem]`, `0.6rem`); mucho `text-xs` (12 px) para información importante: leyenda de marcas (`:363-380`), estados «N por citar» y «caso especial» (`AlertaCoordinacion.tsx:~512-518`).
- **Principio:** legibilidad en celular.
- **Sugerencia:** mínimo 12 px real para todo dato; `text-xs` solo para ayudas, no para estados.
- **Beneficio:** medio · **Costo:** S

### H10. Cabecera de planilla sobrecargada
- **Dónde:** `Planilla.tsx:330-410`: título, selector de color, contador, leyenda de marcas con desplazamiento lateral (`overflow-x-auto`, `:373`), «Mosaico», «Pasar lista con QR», «+ Sesión de hoy». A 375 px ocupa 3-4 filas antes de la primera casilla.
- **Principio:** minimalismo; sin desplazamiento horizontal.
- **Sugerencia:** acción principal arriba y grande; mosaico, color y leyenda en un menú «Más» o icono de información.
- **Beneficio:** medio · **Costo:** M

### H11. Pastillas del grupo con ayudas pensadas para cursor
- **Dónde:** `index.tsx:1369-1455`. Cada pastilla va envuelta en `Ayuda` (texto explicativo); en el celular no hay cursor. «Resultado CI» y «Dirección de grupo» no dicen qué contienen.
- **Principio:** ayuda y documentación.
- **Sugerencia:** comprobar que `Ayuda.tsx` funcione con toque; si no, un subtítulo bajo la pastilla activa. Ordenar por frecuencia.
- **Beneficio:** medio · **Costo:** S

### H12. Diálogos del navegador para confirmar
- **Dónde:** `window.confirm` en `index.tsx:836`, `DireccionGrupo.tsx:323`, `LlegadasTarde.tsx:343` (los `prompt` ya se reemplazaron).
- **Principio:** consistencia; el diálogo nativo no respeta el tema y en algunos celulares se bloquea.
- **Sugerencia:** usar la ventana de confirmación propia que ya usa el módulo (`Planilla.tsx:996`).
- **Beneficio:** bajo · **Costo:** S

### H13. Panorama/Análisis sin versión «lectura rápida»
- **Dónde:** `PanoramaAlerta.tsx:155-224`, `AnalisisAlerta.tsx:164-219`: cuatro o cinco secciones de gráficos; la rectora y coordinación suelen querer 3 cifras.
- **Principio:** visibilidad del estado.
- **Sugerencia:** tres tarjetas de cifra grande arriba (entregadas, en alerta, por citar) y los gráficos plegados debajo.
- **Beneficio:** medio · **Costo:** M

### H14. Tres estilos de selector en la misma pantalla
- **Dónde:** `AlertaCoordinacion.tsx:305-320` (segmento 40 px), `:337-346` (pastillas 36 px), `index.tsx:2296` (pastillas 36 px).
- **Principio:** consistencia y estándares.
- **Sugerencia:** un solo componente (segmentado, 44 px) para vistas y jornada.
- **Beneficio:** bajo · **Costo:** S

### H15. Permanencia y Eventos: explicaciones fijas y alertas poco destacadas
- **Dónde:** `CasosPermanencia.tsx:284-292` (párrafo bajo cada título; «seguimiento vencido» dentro del título), `Eventos.tsx:103-114`.
- **Principio:** minimalismo; el estado crítico debe destacar.
- **Sugerencia:** los vencidos como tarjeta roja arriba; la explicación tras un «?» plegable.
- **Beneficio:** bajo · **Costo:** S

## 3. Lo que ya funciona bien (no tocar)
- «Lista que toca ahora» con recálculo cada 30 s (`TarjetaClaseAhora.tsx`).
- Indicador de sincronización visible arriba (`index.tsx:2320`).
- Alerta del docente: recuadro que pasa solo al siguiente o modo toque, con preferencia recordada (`AlertaAcademica.tsx:30-45`).
- Llegadas tarde: buscador con autofoco y escáner al lado (`LlegadasTarde.tsx:455-470`).
- «Entregar» de 44 px y filas de 52 px en la alerta.

## 4. Top 5 por beneficio ÷ costo
1. **H1 (S, alto)** Casillas, candado y «⋯» de la planilla a 44 px.
2. **H5 (S, alto)** Barra fija «Marcados N de M · Entregar» en la alerta del docente.
3. **H6 (S/M, alto)** Botón visible «Todos presentes» al abrir la sesión del día; luego solo los ausentes.
4. **H4 (M, alto)** Alerta de coordinación: avance por grupo primero; abrir/configurar/imprimir plegado.
5. **H3 (M, alto)** Reducir las 9 pestañas del módulo a 3 grupos de tarea (después, H2: todo botón a 44 px).
