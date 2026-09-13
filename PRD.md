# PRD — Editor de acompañamientos
*Fuente de verdad del QUÉ. En lenguaje de usuario: Julián debe poder juzgar cada línea.*
*Fecha: 2026-09-13 · Estado: APROBADO*

## Problema y para quién

Los acompañamientos de los descansos (qué profesor cuida cada zona cada día) están
escritos a mano dentro de la aplicación. Coordinación no los puede cambiar: cualquier
ajuste exige que alguien modifique el programa y lo vuelva a publicar. Tampoco hay forma
de ver si la carga está repartida con justicia, ni de evitar que a un profesor le toque
acompañamiento justo el día en que dicta más clases.

Lo usan los **dos coordinadores**, cada uno sobre su jornada. Lo ven —sin editar— los
profesores, la rectora y el superusuario.

## Qué hace

1. **Botón «Editar» en la pestaña Acompañamiento del Horario.** Solo lo ve el coordinador,
   y solo cuando está mirando **su** jornada. Al tocarlo aparece un menú con cuatro
   opciones: *Zonas*, *Carga por profesor*, *Generar alternativas* y *Editar a mano*.

2. **Zonas.** El coordinador puede:
   - **agregar** una zona, con su nombre y **cuántos profesores la cubren por día**
     (1 por defecto; una zona grande puede pedir 2 o más);
   - **cambiar** cuántos profesores cubren una zona existente;
   - **quitar** una zona. Sus asignaciones quedan libres.
   Nada de esto afecta a los profesores hasta que se publica.

3. **Carga por profesor.** Una lista con **todos los profesores de la jornada** y, para
   cada uno: cuántos acompañamientos tiene en la semana, en qué días y zonas, y cuántas
   clases dicta cada uno de esos días. Los profesores **mixtos** aparecen marcados, con
   su meta a la mitad. Los que tienen **cero** acompañamientos también aparecen. Un
   acompañamiento puesto en un día de 5 o 6 clases se marca en ámbar.

4. **Generar alternativas.** La aplicación propone **dos o tres distribuciones completas**
   de la semana. Cada propuesta rehace todo **excepto lo que tiene candado** y cumple las
   reglas de reparto (abajo). De cada una muestra, para poder elegir:
   - la diferencia de carga entre el profesor con más y el de menos acompañamientos;
   - cuántos profesores cambian frente a la distribución de hoy;
   - cuántos acompañamientos caen en un día cargado, si alguno.
   Al elegir una, se abre en el editor manual para retocarla y publicarla.

5. **Editar a mano.** Una matriz con las **zonas en filas y los días en columnas**, igual
   al editor de horario. Al lado, una **bandeja con los profesores** de la jornada, cada
   uno con su contador de acompañamientos de la semana. El coordinador:
   - **arrastra** un profesor a una casilla para asignarlo; su contador se actualiza;
   - lo **quita** de una casilla;
   - pone o quita el **candado** de una asignación.
   Al pasar un profesor sobre un día, la aplicación muestra cuántas clases tiene ese día.

6. **Publicar.** El coordinador elige **desde qué fecha rige** la nueva distribución (hoy o
   una fecha futura). Antes de confirmar, una **vista previa** muestra a qué profesores les
   llegará el aviso y qué dirá cada uno; desde ahí confirma o vuelve a editar. A partir de
   esa fecha, en toda la aplicación:
   - la pestaña Acompañamiento muestra la nueva distribución;
   - el horario del día de cada profesor muestra su nuevo acompañamiento en el descanso;
   - la tarjeta de Inicio «Hoy te toca acompañamiento» usa la nueva distribución.
   Si la fecha es futura, hasta ese día sigue rigiendo la anterior, y la pestaña avisa
   «Cambia desde el lunes 21 de septiembre».

7. **Aviso a los profesores.** Al publicar, cada profesor **cuyo acompañamiento cambió**
   recibe un aviso en la aplicación y un correo con lo que tenía y lo que le queda, y
   desde qué fecha. Quien no tuvo cambios no recibe nada.

8. **Historial.** Queda la lista de publicaciones: desde qué fecha rigió cada una, quién la
   publicó y cómo quedaba la distribución. Se puede consultar.

## Reglas de reparto

Aplican a las alternativas automáticas. En el editor manual, las marcadas como
**bloqueo** impiden soltar o publicar; las marcadas como **aviso** se señalan en ámbar
y dejan publicar.

| Regla | Alternativas | Editor manual |
|---|---|---|
| Un profesor no puede estar en **dos zonas el mismo día**. | Nunca lo proponen | Bloqueo |
| Un profesor solo cubre acompañamientos de **su jornada**, y un **mixto** solo los días que le corresponden a esa jornada (Marta Úsuga, por ejemplo, cubre la tarde solo martes y jueves). **Dar un Centro de Interés en la otra jornada no hace a nadie parte de ella:** Edgar es de la tarde, y su Centro de Interés del martes en la mañana no lo pone en los acompañamientos de la mañana. | Nunca lo proponen | Bloqueo |
| **Profesores mixtos:** su meta es la mitad de acompañamientos que un profesor de una sola jornada, en cada jornada. | Lo cumplen | Aviso si se pasa |
| **Carga académica:** el acompañamiento va en los días en que el profesor tiene **menos clases**. Un día con 5 o 6 clases se evita. | Eligen el día más liviano; solo usan un día de 5-6 clases si no hay otra forma de cubrir todo, y lo dicen | Aviso |
| **Carga equitativa:** entre el profesor con más y el de menos acompañamientos hay como máximo 1 de diferencia (contando a los mixtos a la mitad). | Lo cumplen; si no es posible, lo dicen | Aviso |
| **Rotar zonas:** un profesor con varios acompañamientos en la semana no repite la misma zona. | Lo procuran | Sin aviso |
| **Candado:** una asignación con candado no se mueve. | La respetan | Solo se mueve quitando el candado |
| **Todo cubierto:** cada zona tiene, cada día, los profesores que pide. | Lo cumplen; si no es posible, dicen qué casillas faltan | Bloqueo para publicar |

**Arrancan con candado:** Doris Castrillón en Restaurante el lunes y el viernes, y
Margarita Montoya en Restaurante el miércoles y el jueves.

## Qué NO hace (fuera de alcance)

- **Los momentos de la tarde** (portería al inicio, restaurante en el almuerzo, evacuación
  al final) no se editan aquí: siguen como están.
- **Descanso 1 y descanso 2 por separado:** cada asignación cubre los dos descansos del
  día, como hoy.
- **Cambios de un solo día**, por ejemplo cuando falta quien acompaña: eso sigue siendo del
  editor de horario por ausencia. Aquí solo se cambia la distribución que rige semana a
  semana.
- **Volver a una distribución anterior con un botón:** el historial se consulta, no se
  restaura. Para volver atrás se edita y se publica de nuevo.
- **Editar la jornada del otro coordinador**, ni editar desde la rectoría o el
  superusuario: ellos solo consultan.
- **El borrador no viaja entre equipos:** mientras no se publica, lo que el coordinador va
  armando vive en el navegador donde lo está haciendo. Si empieza en el computador y
  sigue en el celular, no lo encuentra.

## Datos

- **Punto de partida:** la distribución que está hoy en la aplicación —6 zonas por jornada,
  60 asignaciones— se carga como la **primera publicación**, vigente desde el día en que se
  active esta función. Nadie ve un cambio ese día.
- **Horario de clases de cada profesor:** de ahí se sabe cuántas clases tiene cada día. Es
  el horario vigente que ya usa la aplicación.
- **Jornada de cada profesor y días de los mixtos:** de la lista de profesores que ya tiene
  la aplicación. El Centro de Interés no cuenta para definir la jornada.
- **Profesores de la jornada y sus correos:** del plantel que ya tiene la aplicación.
- **Las publicaciones** se guardan en la base de datos del colegio. **Son irremplazables:**
  el historial no se puede reconstruir si se pierde.
- **El borrador** vive en el navegador del coordinador hasta que publica.

## Casos límite y errores

- **Quitar una zona que tiene profesores asignados:** pide confirmación y dice cuántas
  asignaciones se liberan.
- **Agregar una zona:** aparece con sus casillas vacías, y Publicar queda bloqueado hasta
  llenarlas.
- **No alcanzan los profesores** para cubrir todo sin romper una regla: las alternativas
  dicen qué casillas no pudieron llenar y por qué, en vez de proponer algo imposible sin
  avisar.
- **Un candado que ya no cumple una regla** (por ejemplo, el profesor dejó de estar en la
  jornada ese día porque cambió su horario): la casilla se marca con el motivo.
- **Un profesor que ya no está en el colegio** y figura en la distribución vigente: se
  marca, y cuenta como casilla vacía al publicar.
- **Fecha de vigencia en el pasado:** no se permite.
- **Publicar sin conexión** o si falla el guardado: no se publica nada, el borrador se
  conserva y se dice qué pasó.
- **El correo falla** para algunos profesores: la publicación queda hecha, los avisos en la
  aplicación salen igual y se informa a cuántos no les llegó el correo.
- **El mismo coordinador publica dos veces** (por ejemplo, desde dos equipos): rige la
  última publicación, y las dos quedan en el historial.

## Criterios de aceptación

- [ ] Entrando como **docente**, la pestaña Acompañamiento se ve como hoy y **no hay botón «Editar»**.
- [ ] Entrando como **coordinadora de la mañana**, aparece «Editar» en la mañana y **no** en la tarde.
- [ ] Antes de publicar nada, la pestaña muestra **exactamente la distribución de hoy** (las 60 asignaciones).
- [ ] Al **agregar** una zona «Cancha» con 2 profesores por día, aparece su fila con 10 casillas vacías y **Publicar no se activa**.
- [ ] Al **quitar** una zona con profesores, pide confirmación y esos profesores quedan con un acompañamiento menos en su contador.
- [ ] En **Carga por profesor** aparecen todos los profesores de la jornada, incluidos los que tienen cero, y la suma de todos los contadores es igual al total de casillas.
- [ ] **Generar alternativas** entrega 2 o 3 propuestas, y en **ninguna**: Doris o Margarita cambian de lugar; un profesor está en dos zonas el mismo día; un profesor queda un día que no está en la jornada.
- [ ] En las alternativas, un profesor con **6 clases el miércoles no queda el miércoles**, salvo que la propuesta lo diga expresamente.
- [ ] En el editor manual, **arrastrar** un profesor a una casilla lo asigna y su contador sube en uno.
- [ ] Intentar soltar a un profesor en un **día que no está en la jornada** no lo deja y dice por qué.
- [ ] Una asignación **con candado** no se puede arrastrar hasta quitarle el candado.
- [ ] Al **publicar desde el lunes 21**, la pestaña sigue mostrando la distribución anterior hasta el viernes 18, avisa del cambio, y desde el lunes 21 muestra la nueva.
- [ ] El profesor **cuyo acompañamiento cambió** recibe el aviso en la aplicación y el correo con lo que tenía y lo que le queda; **uno que no cambió no recibe nada**.
- [ ] El día que empieza a regir, la tarjeta de Inicio **«Hoy te toca acompañamiento»** y el horario del día del profesor muestran la nueva zona.
- [ ] El **historial** muestra la publicación con su fecha de vigencia, quién la publicó y la distribución completa.

---
### Calificación (autocontrol de Claude antes de presentar)
- [x] Sin huecos: ningún "por definir", "TBD", "pendiente" ni placeholder.
- [x] Cada función tiene usuario y resultado visible.
- [x] El fuera-de-alcance existe y es concreto.
- [x] Todos los criterios de aceptación son observables (no técnicos internos).
- [x] Los casos de error están cubiertos.
