# Clips de primeros auxilios para Gemini (Veo): prompts y validación

Fuente de contenido: `src/data/fichasAuxilios.ts` (guía Plena inclusión 2024, lectura fácil; fichas 10-11 de la Cartilla de la Armada). Número de emergencia: **123**.

Convención: `(referencia externa: verificar con el validador)` marca todo dato médico que la ficha NO detalla. Nada de lo marcado contradice la ficha.

Flujo: Julián genera -> persona de salud valida con el checklist -> solo entonces se publica el clip en la app.

---

## 0. Cómo usar estos prompts en Gemini

1. **Pega el bloque completo** del prompt (de `STYLE:` a `AVOID:`), sin recortar etiquetas. Cada bloque ya trae el estilo y los personajes; no hace falta añadir nada.
2. **Modo vertical 9:16**, 8 segundos, sin audio hablado.
3. **Genera 2 a 4 versiones** del mismo prompt y escoge la que mejor cumpla «Debe verse». Veo varía mucho: no aceptes la primera por bonita.
4. **Si ignora una acción** (ej.: sale solo la docente curando), recorta el prompt a la acción principal: deja `STYLE`, `CHARACTERS`, `SETTING`, `HAZARD/OBJECTS`, `CAMERA`, un `TIMELINE` de una sola línea y `END FRAME`. Luego aplica el ajuste de «Si sale mal».
5. **Qué falló con el primer PAS-1** (una docente poniendo una curita): escena abstracta («looks around», «signals»), peligro poco visible (un charco), demasiadas acciones para 8 s, plano medio que no mostraba el espacio y el modelo rellenó con el cliché de primeros auxilios. Por eso ahora: **una sola idea por clip**, peligro enorme y obvio, plano abierto cuando importa el espacio, acciones físicas con tiempos y una lista `AVOID` que prohíbe el cliché (curita, venda, botiquín).
6. Si el modelo sigue metiendo el cliché, repite la prohibición al final del prompt con otras palabras: `Never show any bandage, plaster or medical kit.`

---

## 1. Ficha de estilo y personajes fijos

**Bloque STYLE común** (idéntico al inicio de CADA prompt; lo único que cambia entre clips es el lugar, que va en `SETTING`):

```
STYLE: Flat 2D cartoon animation, simple clean shapes, soft pastel colors, bright even lighting. Exaggerated cartoon body language so the intention reads without any words. Simple Colombian school, minimal background detail. Fixed camera, no camera movement. No spoken words, only soft ambient sound. Calm, reassuring tone. 8 seconds, 9:16 vertical.
```

Se permiten líneas de movimiento y flechas SIN letras cuando ayudan a leer la intención.

**Personajes fijos (describir SIEMPRE igual):**

- **Docente**: `Teacher: adult woman, about 40, medium brown skin, black hair tied in a low ponytail, round face, light green blouse, dark gray trousers, flat shoes, calm expression.`
- **Estudiante ayudante**: `Helper student: teenage boy, about 15, light brown skin, short black hair, white polo shirt and navy trousers, serious calm face.`
- **Estudiante afectada**: `Affected student: teenage girl, about 15, tan skin, long dark brown braid, white polo shirt and navy skirt, black school shoes.`
- **Adulto afectado (solo clips RCP)**: `Affected person: adult man, about 35, medium skin, short black hair, white shirt and gray trousers.` (se usa un adulto para ser coherente con los 5 cm de la ficha).
- **Docente de brigada (solo VEN-1)**: `Brigade teacher: adult man, about 40, medium skin, short black hair, light blue polo shirt and gray trousers, calm expression.`
- **Jugadores de fondo (solo PAS-1a)**: `Players: six teenage students in the same plain white polo shirts and navy shorts.`

Uniforme genérico: polo blanco y pantalón/falda azul marino, SIN escudo ni emblema.

---

## 2. Clips

Estructura de cada prompt: STYLE · CHARACTERS · SETTING · HAZARD/OBJECTS · CAMERA · TIMELINE · END FRAME · AVOID.

### Ficha 1: La regla PAS

#### PAS-1a Proteger: detener el peligro y apartar a los demás
- **Ilustra** (ficha 1, paso 1): «Protégete a ti mismo o a ti misma... Protege a la víctima de la emergencia... Protege a otras personas para que no haya más heridos.»
- **Prompt (EN):**
```
STYLE: Flat 2D cartoon animation, simple clean shapes, soft pastel colors, bright even lighting. Exaggerated cartoon body language so the intention reads without any words. Simple Colombian school, minimal background detail. Fixed camera, no camera movement. No spoken words, only soft ambient sound. Calm, reassuring tone. 8 seconds, 9:16 vertical.
CHARACTERS: Teacher: adult woman, about 40, medium brown skin, black hair tied in a low ponytail, round face, light green blouse, dark gray trousers, flat shoes, calm expression. Affected student: teenage girl, about 15, tan skin, long dark brown braid, white polo shirt and navy skirt, black school shoes. Players: six teenage students in plain white polo shirts and navy shorts. Total on screen: 8 people.
SETTING: A wide concrete school patio with a basic soccer court. Left foreground: the affected student sits on the ground holding her ankle, in the middle of the playing area. Right side: six players in the middle of a soccer match. Back of the court: open empty space and a plain wall.
HAZARD/OBJECTS: A soccer game is in full play and a ball is flying through the air toward the sitting girl. Soft motion lines behind the ball.
CAMERA: Wide full shot from a fixed, slightly high angle, because the distance between the girl, the players and the teacher is the whole message.
TIMELINE:
[0-2 s] The teacher walks in from the left edge, stops short, and turns her head sharply toward the flying ball and the players, eyes wide.
[2-5 s] She raises both arms high with open palms facing the players, in a big "stop" gesture. The players freeze, the ball bounces and rolls to a stop. Then she extends one arm and points far toward the back of the court; the six players walk backward toward the back of the court.
[5-8 s] The teacher crouches down next to the girl, placing her own body between the girl and the now-empty court, one arm out sideways like a shield.
END FRAME: Teacher crouched between the affected student and the empty court, arm out as a shield, the six players small and far away at the back, the ball still on the ground.
AVOID: band-aid, bandage, first-aid kit, treating the ankle, touching the ankle, a crowd around the girl, players running toward the girl, text, letters, numbers, logos, subtitles, blood, any extra people besides those listed.
```
- **Debe verse:**
  - Partido en curso con balón en el aire cerca de la afectada, que está en la zona de juego.
  - Docente levanta ambos brazos con palmas abiertas y los jugadores se detienen.
  - Docente señala al fondo y los jugadores retroceden.
  - Docente agachada entre la afectada y la cancha, ya vacía.
- **No debe aparecer:** curita, venda, botiquín; docente tocando o curando el tobillo; jugadores amontonados alrededor de la niña; más personas de las indicadas; letras o números.
- **Pie (app):** «Protégete tú primero. Detén el peligro y aleja a los demás para que no haya más heridos.»
- **Si sale mal:**
  - Se ve solo la docente y la niña: agrega `The six players must be clearly visible on the right at the start and must walk backward in the second half.`
  - Aparece una curita: agrega `The teacher never touches the girl and holds nothing in her hands.`

#### PAS-1b Proteger: alejar a la víctima del peligro (solo porque hay peligro)
- **Ilustra** (ficha 1, paso 1): «Aléjala del peligro o elimínalo si puedes.» La ficha PAS-3 dice «no la muevas»: esta es la excepción, y solo porque hay peligro. La víctima camina por sí misma; la docente solo la guía.
- **Prompt (EN):**
```
STYLE: Flat 2D cartoon animation, simple clean shapes, soft pastel colors, bright even lighting. Exaggerated cartoon body language so the intention reads without any words. Simple Colombian school, minimal background detail. Fixed camera, no camera movement. No spoken words, only soft ambient sound. Calm, reassuring tone. 8 seconds, 9:16 vertical.
CHARACTERS: Teacher: adult woman, about 40, medium brown skin, black hair tied in a low ponytail, round face, light green blouse, dark gray trousers, flat shoes, calm expression. Affected student: teenage girl, about 15, tan skin, long dark brown braid, white polo shirt and navy skirt, black school shoes. Total on screen: 2 people.
SETTING: A long school hallway seen from the side. Left half: a broken window frame with large sharp glass pieces scattered across the floor and sparkling, plus a short stretch of yellow tape-free open floor. Right half: a clear, clean, open floor area with a plain bench against the wall. The affected student starts standing on the left, right next to the broken glass, looking dazed and hurt-faced.
HAZARD/OBJECTS: Big, obvious, jagged glass shards on the floor and in the window frame, drawn clearly with white sparkle lines.
CAMERA: Wide full side view of the whole hallway, so the path from the glass to the clear zone is visible.
TIMELINE:
[0-2 s] The teacher enters from the right, stops, and points with one straight arm at the glass, then waves her other hand toward the clear area on the right.
[2-5 s] The teacher steps to the girl's side, puts a hand lightly on the girl's upper arm, and guides her; the girl walks on her own feet, step by step, away from the glass toward the right, avoiding the shards.
[5-8 s] They arrive at the clear zone by the bench. The girl sits on the bench by herself; the teacher stays standing beside her, one arm extended back pointing to the glass far behind them.
END FRAME: Girl seated on the bench in the clear zone, teacher beside her, the glass visibly far behind on the left.
AVOID: carrying or lifting the girl, dragging her, the girl lying down, band-aid, bandage, first-aid kit, treating any wound, blood, text, letters, numbers, logos, subtitles, any extra people besides the two listed.
```
- **Debe verse:**
  - Vidrios rotos grandes y obvios en el piso, a la izquierda.
  - La niña camina con sus propios pies, guiada por la mano de la docente en el brazo.
  - Llegan a una zona limpia y despejada; el vidrio queda lejos al fondo.
- **No debe aparecer:** cargar, arrastrar o levantar a la niña; niña acostada; curar heridas; sangre; curita, venda o botiquín.
- **Pie (app):** «Aleja a la víctima del peligro solo si el peligro sigue ahí (aquí, vidrios). Si puede caminar, que camine ella misma. Si no hay peligro, no la muevas.»
- **Si sale mal:**
  - La docente carga a la niña: agrega `The girl always walks by herself; the teacher never lifts or carries her.`
  - El peligro no se nota: agrega `Make the broken glass huge, bright white and clearly visible on the floor.`

#### PAS-2 Avisar
- **Ilustra** (ficha 1, paso 2): «Llama por teléfono al número 123... explica de forma clara qué ha pasado y dónde estás. Si no sabes la dirección exacta, explica qué tienes cerca.»
- **Prompt (EN):**
```
STYLE: Flat 2D cartoon animation, simple clean shapes, soft pastel colors, bright even lighting. Exaggerated cartoon body language so the intention reads without any words. Simple Colombian school, minimal background detail. Fixed camera, no camera movement. No spoken words, only soft ambient sound. Calm, reassuring tone. 8 seconds, 9:16 vertical.
CHARACTERS: Teacher: adult woman, about 40, medium brown skin, black hair tied in a low ponytail, round face, light green blouse, dark gray trousers, flat shoes, calm expression. Affected student: teenage girl, about 15, tan skin, long dark brown braid, white polo shirt and navy skirt, sitting on the ground. Total on screen: 2 people.
SETTING: A school patio. Left: the affected student sits on the ground, small in the frame, a few steps from the teacher. Center: the teacher stands. Right and background: a plain school building with a basketball hoop.
HAZARD/OBJECTS: A smartphone with a completely blank dark screen (no digits, no keypad, no icons).
CAMERA: Medium-wide shot at eye level, so both the phone call and the surrounding place (building, hoop) are visible.
TIMELINE:
[0-2 s] The teacher takes the smartphone out of her pocket and raises it to her ear with one hand, standing calm and upright.
[2-5 s] With her free hand she points at the sitting girl, then makes a wide sweeping gesture toward the school building behind her, as if describing the place; her head turns following her hand.
[5-8 s] She points at the basketball hoop, then nods slowly while listening, phone still at her ear.
END FRAME: Teacher standing calm with the phone at her ear, one arm pointing toward the building, the girl sitting a few steps away.
AVOID: any digits, keypad or readable screen, shouting or panic, the teacher walking away from the girl, treating the girl, band-aid, bandage, first-aid kit, text, letters, numbers, logos, subtitles, blood, any extra people besides the two listed.
```
- **Debe verse:**
  - Celular al oído, pantalla sin números.
  - Señala a la persona (qué pasó) y luego el edificio y la cancha (dónde está).
  - Calma; asiente escuchando; sigue cerca de la niña.
- **No debe aparecer:** dígitos o teclado legible; docente gritando o en pánico; docente alejándose de la niña; curación.
- **Pie (app):** «Llama al 123. Explica de forma clara qué ha pasado y dónde estás. Si no sabes la dirección exacta, explica qué tienes cerca.»
- **Si sale mal:**
  - Pantalla con números: agrega `The phone is seen only from behind or from the side; its screen never faces the camera.`
  - Solo se ve la llamada: agrega `The building and the basketball hoop must be clearly visible behind her and she points at both.`

#### PAS-3 Socorrer: calmar y no mover
- **Ilustra** (ficha 1, paso 3): «Mantén la calma y tranquiliza también a la víctima. Dile que la ayuda está de camino. No la muevas ni la cambies de sitio.»
- **Prompt (EN):**
```
STYLE: Flat 2D cartoon animation, simple clean shapes, soft pastel colors, bright even lighting. Exaggerated cartoon body language so the intention reads without any words. Simple Colombian school, minimal background detail. Fixed camera, no camera movement. No spoken words, only soft ambient sound. Calm, reassuring tone. 8 seconds, 9:16 vertical.
CHARACTERS: Teacher: adult woman, about 40, medium brown skin, black hair tied in a low ponytail, round face, light green blouse, dark gray trousers, flat shoes, calm expression. Affected student: teenage girl, about 15, tan skin, long dark brown braid, white polo shirt and navy skirt. Total on screen: 2 people.
SETTING: A plain classroom with a blank wall. The girl sits on the floor with her back against the wall, in the center-left of the frame. Empty floor around them.
HAZARD/OBJECTS: None. No hazards in the scene.
CAMERA: Medium shot at the girl's eye level, so the faces and the teacher's hand on the shoulder are clearly visible.
TIMELINE:
[0-2 s] The girl sits against the wall with wide eyes, hands clasped, frightened. The teacher walks in and kneels in front of her, at her eye level.
[2-5 s] The teacher places one hand gently on the girl's shoulder and with the other makes a slow, downward "calm down" palm gesture, nodding and smiling softly.
[5-8 s] The girl's frightened face relaxes into a small relieved smile and her shoulders drop. The teacher stays beside her, hand on her shoulder, and does not lift or move her.
END FRAME: Teacher kneeling close to the girl, hand on her shoulder, the girl sitting calm against the wall exactly where she started.
AVOID: lifting, pulling or moving the girl, the teacher standing over her, dialogue bubbles or text, band-aid, bandage, first-aid kit, blood, letters, numbers, logos, subtitles, any extra people besides the two listed.
```
- **Debe verse:**
  - Docente arrodillada a la altura de los ojos de la niña.
  - Mano suave en el hombro y gesto de calma con la otra mano.
  - Expresión de la niña pasa de miedo a calma.
  - La niña termina en el mismo lugar donde empezó.
- **No debe aparecer:** levantar, arrastrar o mover a la niña; docente de pie mirando desde arriba; globos de diálogo con texto; curación.
- **Pie (app):** «Mantén la calma y tranquilízala: dile que la ayuda está de camino. No la muevas ni la cambies de sitio.»
- **Si sale mal:**
  - La docente la ayuda a levantarse: agrega `The girl stays seated against the wall for the entire clip.`
  - Aparece curación: agrega `The teacher's hands only touch the girl's shoulder; no objects in her hands.`

### Ficha 2: Revisar a la víctima

#### REV-1a Comprobar si está consciente: hablarle al oído
- **Ilustra** (ficha 2, paso 1): «Háblale cerca del oído. Pregúntale "¿Me oyes?" o "¿Estás bien?"...»
- **Prompt (EN):**
```
STYLE: Flat 2D cartoon animation, simple clean shapes, soft pastel colors, bright even lighting. Exaggerated cartoon body language so the intention reads without any words. Simple Colombian school, minimal background detail. Fixed camera, no camera movement. No spoken words, only soft ambient sound. Calm, reassuring tone. 8 seconds, 9:16 vertical.
CHARACTERS: Teacher: adult woman, about 40, medium brown skin, black hair tied in a low ponytail, round face, light green blouse, dark gray trousers, flat shoes, calm expression. Affected student: teenage girl, about 15, tan skin, long dark brown braid, white polo shirt and navy skirt. Total on screen: 2 people.
SETTING: A plain classroom floor. The girl lies on her back in the center, eyes closed, arms relaxed at her sides. Empty floor and a blank wall behind.
HAZARD/OBJECTS: None. No objects.
CAMERA: Close-up at a high three-quarter angle on the heads and shoulders of both, because the ear and the mouth position are the whole message.
TIMELINE:
[0-2 s] The teacher kneels beside the girl's head and leans toward the girl's ear, one hand cupped near her own mouth.
[2-5 s] Her mouth moves clearly and her eyebrows rise in a questioning expression, twice; the girl does not react at all.
[5-8 s] The teacher pulls back slightly, eyebrows lowered, a worried but calm face; the girl is still unresponsive.
END FRAME: Teacher kneeling at the girl's head, worried and serious, the girl still lying motionless with eyes closed.
AVOID: shaking or slapping the girl, lifting her, pinching (that is the next clip), dialogue bubbles or text, band-aid, bandage, first-aid kit, blood, letters, numbers, logos, subtitles, any extra people besides the two listed.
```
- **Debe verse:**
  - Docente con la cara junto al oído de la niña, boca en movimiento, cejas de pregunta.
  - La niña no reacciona.
  - La docente termina preocupada pero serena.
- **No debe aparecer:** sacudir, golpear la cara, levantar a la persona; globos de diálogo con texto.
- **Pie (app):** «Háblale cerca del oído: "¿Me oyes?" o "¿Estás bien?". Si no responde, pellízcale.»
- **Si sale mal:**
  - La niña reacciona o abre los ojos: agrega `The girl's eyes stay closed and her body does not move at all.`
  - Se ve el cuerpo completo y no el oído: agrega `Extreme close framing on the teacher's face next to the girl's ear.`

#### REV-1b Comprobar si está consciente: pellizco y pasar a la respiración
- **Ilustra** (ficha 2, paso 1): «Si no responde, pellízcale... Si no reacciona, sigue con el paso 2: comprobar la respiración.»
- **Prompt (EN):**
```
STYLE: Flat 2D cartoon animation, simple clean shapes, soft pastel colors, bright even lighting. Exaggerated cartoon body language so the intention reads without any words. Simple Colombian school, minimal background detail. Fixed camera, no camera movement. No spoken words, only soft ambient sound. Calm, reassuring tone. 8 seconds, 9:16 vertical.
CHARACTERS: Teacher: adult woman, about 40, medium brown skin, black hair tied in a low ponytail, round face, light green blouse, dark gray trousers, flat shoes, calm expression. Affected student: teenage girl, about 15, tan skin, long dark brown braid, white polo shirt and navy skirt. Total on screen: 2 people.
SETTING: A plain classroom floor. The girl lies on her back, eyes closed, her forearm resting on the floor next to the teacher. Blank wall behind.
HAZARD/OBJECTS: None.
CAMERA: Close-up of the girl's forearm and the teacher's hand, then the shot stays so the teacher's gaze toward the chest stays visible; because hand position and the small pinch are the message.
TIMELINE:
[0-2 s] The teacher, kneeling beside the girl, gently takes the skin of the girl's forearm between thumb and index finger.
[2-5 s] She gives a soft, gentle pinch; the girl's hand and arm do not move and her face does not change. The teacher watches the girl's face.
[5-8 s] The teacher's face turns serious, she lifts her head and slowly lowers her gaze to the girl's chest.
END FRAME: Teacher kneeling, serious, eyes fixed on the girl's chest; the girl motionless.
AVOID: hard pinching, shaking, slapping, lifting the girl, text, letters, numbers, logos, subtitles, band-aid, bandage, first-aid kit, blood, any extra people besides the two listed.
```
- **Debe verse:**
  - Pellizco suave en el antebrazo con dos dedos.
  - La niña no reacciona.
  - La mirada de la docente baja al pecho (pasa a la respiración).
- **No debe aparecer:** pellizco brusco; sacudir; golpear; levantar a la persona.
- **Pie (app):** «Si no responde, pellízcale. Si no reacciona, comprueba la respiración.»
- **Si sale mal:**
  - La niña se mueve: agrega `The girl is completely limp and motionless the entire time.`
  - El pellizco parece fuerte: agrega `Very gentle small pinch with two fingers, no force.`

#### REV-2 Comprobar la respiración
- **Ilustra** (ficha 2, paso 2): «Mira si su pecho se mueve con la respiración. Escucha si su boca o nariz toman y echan aire. Pon la mano sobre su pecho.»
- **Prompt (EN):**
```
STYLE: Flat 2D cartoon animation, simple clean shapes, soft pastel colors, bright even lighting. Exaggerated cartoon body language so the intention reads without any words. Simple Colombian school, minimal background detail. Fixed camera, no camera movement. No spoken words, only soft ambient sound. Calm, reassuring tone. 8 seconds, 9:16 vertical.
CHARACTERS: Teacher: adult woman, about 40, medium brown skin, black hair tied in a low ponytail, round face, light green blouse, dark gray trousers, flat shoes, calm expression. Affected student: teenage girl, about 15, tan skin, long dark brown braid, white polo shirt and navy skirt. Total on screen: 2 people.
SETTING: A plain classroom floor, blank wall behind. The girl lies on her back, eyes closed, in the center. The teacher kneels at her side.
HAZARD/OBJECTS: None. Soft curved "air" lines (no letters) flow gently in and out of the girl's nose to show breathing.
CAMERA: Fixed side view at floor level, because the rise and fall of the chest and the ear-to-mouth position must be seen from the side.
TIMELINE:
[0-2 s] The teacher bends over the girl and brings her ear close to the girl's mouth and nose while her eyes look down along the girl's chest.
[2-5 s] She stays still, listening and watching; the girl's chest rises and falls slowly and visibly, twice, with soft air lines at the nose.
[5-8 s] The teacher sits up a little and rests one flat hand on the center of the girl's chest, which rises and falls under her hand. She nods slightly, reassured.
END FRAME: Teacher kneeling with one flat hand on the girl's chest, the chest slightly raised, the girl motionless with eyes closed.
AVOID: moving the girl's head or neck, any stopwatch, clock or numbers, pressing on the chest, lifting the girl, text, letters, logos, subtitles, band-aid, bandage, first-aid kit, blood, any extra people besides the two listed.
```
- **Debe verse:**
  - Ojos de la docente hacia el pecho y oído cerca de boca y nariz (mirar y escuchar).
  - Pecho que sube y baja con claridad.
  - Mano plana sobre el pecho, sin presionar.
- **No debe aparecer:** mover la cabeza o el cuello; cronómetro o números; presionar el pecho; maniobras no incluidas en la ficha.
- **Pie (app):** «Mira si su pecho se mueve, escucha si toma y echa aire y pon la mano sobre su pecho. Si respira: posición lateral. Si no respira: reanimación.»
- **Si sale mal:**
  - El pecho no se mueve: agrega `The girl's chest rises and falls in a large, exaggerated, clearly visible way.`
  - La docente presiona: agrega `Her hand rests lightly and flat, with no pressing.`

### Ficha 3: Posición lateral de seguridad

#### LAT-1a Preparar: retirar objetos y doblar el brazo cercano
- **Ilustra** (ficha 3, «Los ocho pasos», pasos 1 a 3): «Arrodíllate junto a la víctima. Retira los objetos que puedan hacerle daño: gafas, llaves, móvil. Dobla el brazo de la víctima más cercano a ti hacia arriba.»
- **Prompt (EN):**
```
STYLE: Flat 2D cartoon animation, simple clean shapes, soft pastel colors, bright even lighting. Exaggerated cartoon body language so the intention reads without any words. Simple Colombian school, minimal background detail. Fixed camera, no camera movement. No spoken words, only soft ambient sound. Calm, reassuring tone. 8 seconds, 9:16 vertical.
CHARACTERS: Teacher: adult woman, about 40, medium brown skin, black hair tied in a low ponytail, round face, light green blouse, dark gray trousers, flat shoes, calm expression. Affected student: teenage girl, about 15, tan skin, long dark brown braid, white polo shirt and navy skirt, wearing round glasses. Total on screen: 2 people.
SETTING: A plain classroom floor, blank wall behind. The girl lies on her back in the center, eyes closed, arms along her sides. The teacher kneels on the girl's right side, which is the side nearest the camera.
HAZARD/OBJECTS: The girl's glasses on her face and a set of keys in her skirt pocket area visible on the floor beside her.
CAMERA: Fixed high three-quarter view from the teacher's side, because the position of the arms and the objects removed must be seen.
TIMELINE:
[0-2 s] The teacher kneels at the girl's side, gently takes the glasses from the girl's face and places them on the floor a short distance away, with the keys beside them.
[2-5 s] She takes the girl's nearer wrist and bends that arm so the forearm points up at a right angle at the elbow, the palm facing the ceiling, next to the girl's shoulder.
[5-8 s] She checks the girl's face, still unconscious and breathing, and stays kneeling with her hands resting on her own knees.
END FRAME: Girl lying on her back with the near arm bent up at the elbow, glasses and keys set aside on the floor, teacher kneeling beside her.
AVOID: lifting or rolling the girl, the girl waking up or moving on her own, any impact or accident context, text, letters, numbers, logos, subtitles, band-aid, bandage, first-aid kit, blood, any extra people besides the two listed.
```
- **Debe verse:**
  - Retirar gafas y llaves y dejarlas a un lado.
  - Brazo cercano doblado hacia arriba en ángulo recto.
  - Docente siempre en el mismo lado y la niña sin moverse sola.
- **No debe aparecer:** contexto de golpe fuerte en la espalda o accidente (la ficha lo excluye); miembros en ángulos antinaturales; la niña despierta.
- **Pie (app):** «Retira los objetos que puedan hacerle daño (gafas, llaves, móvil) y dobla el brazo más cercano hacia arriba.»
- **Si sale mal:**
  - Cambia de lado la docente: agrega `The teacher stays on the girl's right side, the side closest to the camera, the entire clip.`
  - El brazo sale raro: agrega `The arm bends only at the elbow at a clean right angle, hand open next to the shoulder.`

#### LAT-1b Preparar: pierna lejana y otro brazo
- **Ilustra** (ficha 3, pasos 4 y 5): «Dobla su pierna más alejada hacia ti. Dobla el otro brazo de la víctima y pon su mano junto a su cabeza.»
- **Prompt (EN):**
```
STYLE: Flat 2D cartoon animation, simple clean shapes, soft pastel colors, bright even lighting. Exaggerated cartoon body language so the intention reads without any words. Simple Colombian school, minimal background detail. Fixed camera, no camera movement. No spoken words, only soft ambient sound. Calm, reassuring tone. 8 seconds, 9:16 vertical.
CHARACTERS: Teacher: adult woman, about 40, medium brown skin, black hair tied in a low ponytail, round face, light green blouse, dark gray trousers, flat shoes, calm expression. Affected student: teenage girl, about 15, tan skin, long dark brown braid, white polo shirt and navy skirt. Total on screen: 2 people.
SETTING: A plain classroom floor, blank wall behind. The girl lies on her back, eyes closed; her near-side arm is already bent up at the elbow. The teacher kneels at her near side.
HAZARD/OBJECTS: None.
CAMERA: Fixed high three-quarter view from the teacher's side, because the leg and the far arm positions must be seen clearly.
TIMELINE:
[0-2 s] The teacher reaches across and holds the girl's far knee, bending the leg so the knee points up and the foot stays flat on the floor.
[2-5 s] She reaches across the girl's chest, takes the far hand and places it against the girl's cheek or beside her head, palm facing down.
[5-8 s] She sits back on her heels, hands on her own knees, looking at the girl's prepared position.
END FRAME: Girl on her back with near arm bent up, far knee raised with foot flat, far hand beside her head, teacher kneeling beside her.
AVOID: rolling the girl yet, lifting her, the girl moving on her own, any impact or accident context, text, letters, numbers, logos, subtitles, band-aid, bandage, first-aid kit, blood, any extra people besides the two listed.
```
- **Debe verse:**
  - Pierna lejana flexionada con rodilla arriba y pie apoyado.
  - El otro brazo doblado con la mano junto a la cabeza.
  - La niña todavía boca arriba (el giro es el clip siguiente).
- **No debe aparecer:** girar a la niña; miembros en ángulos antinaturales; la niña moviéndose sola.
- **Pie (app):** «Dobla su pierna más alejada hacia ti. Dobla el otro brazo y pon su mano junto a su cabeza.»
- **Si sale mal:**
  - Ya la gira: agrega `The girl stays flat on her back in this clip; she is not rolled yet.`
  - Rodilla mal doblada: agrega `The far knee points straight up, the foot flat on the floor.`

#### LAT-2 Girar despacio hacia ti
- **Ilustra** (ficha 3, paso 6): «Cógele por la cadera y el hombro para girarlo despacio hacia ti.» (Los pasos 7 y 8, llamar al 123 y cambiar de lado cada 20 minutos, van en el pie y en PAS-2.)
- **Prompt (EN):**
```
STYLE: Flat 2D cartoon animation, simple clean shapes, soft pastel colors, bright even lighting. Exaggerated cartoon body language so the intention reads without any words. Simple Colombian school, minimal background detail. Fixed camera, no camera movement. No spoken words, only soft ambient sound. Calm, reassuring tone. 8 seconds, 9:16 vertical.
CHARACTERS: Teacher: adult woman, about 40, medium brown skin, black hair tied in a low ponytail, round face, light green blouse, dark gray trousers, flat shoes, calm expression. Affected student: teenage girl, about 15, tan skin, long dark brown braid, white polo shirt and navy skirt. Total on screen: 2 people.
SETTING: A plain classroom floor, blank wall behind. The girl lies on her back, eyes closed, with near arm bent up, far knee raised, far hand beside her head. The teacher kneels at her near side.
HAZARD/OBJECTS: None.
CAMERA: Fixed high three-quarter view, because the hand positions on the hip and shoulder and the slow roll must be seen.
TIMELINE:
[0-2 s] The teacher places one hand on the girl's far hip and the other hand on her far shoulder; her arms are clearly visible.
[2-5 s] She slowly and smoothly rolls the girl toward herself, the girl's body turning as one piece onto her side.
[5-8 s] The girl rests stable on her side with the top knee bent forward and the top hand under her cheek. The teacher releases and checks the girl's chest, which rises and falls.
END FRAME: Girl resting steadily on her side, top knee bent forward, teacher kneeling beside her with hands off the girl.
AVOID: jerking the roll, pulling by clothes or by one arm, turning the head separately, rolling away from the teacher, text, letters, numbers, logos, subtitles, band-aid, bandage, first-aid kit, blood, any extra people besides the two listed.
```
- **Debe verse:**
  - Una mano en la cadera y otra en el hombro.
  - Giro lento hacia la docente.
  - Posición final estable de lado con rodilla superior doblada al frente.
  - Cabeza ligeramente inclinada hacia atrás para mantener la vía aérea abierta (referencia externa: verificar con el validador).
- **No debe aparecer:** jalar de la ropa o de un brazo; giro brusco; girar la cabeza aparte del cuerpo.
- **Pie (app):** «Con una mano en la cadera y otra en el hombro, gira a la persona despacio hacia ti. Llama al 123 y cambia a la persona de lado cada 20 minutos.»
- **Si sale mal:**
  - Gira hacia el lado contrario: agrega `The girl rolls toward the teacher, never away from her.`
  - Giro brusco: agrega `Very slow smooth roll across the full five seconds.`

### Ficha 4: Reanimación

#### RCP-1 Compresiones (reanimar los latidos)
- **Ilustra** (ficha 4, A): «Coloca a la víctima tumbada hacia arriba. Ponte de rodillas junto a su pecho. Busca el punto que está justo en el centro del pecho. Coloca tus manos entrelazadas... la zona más dura de tu mano... Aprieta fuerte en ese punto 30 veces... unos 5 centímetros cada vez.»
- **Prompt (EN):**
```
STYLE: Flat 2D cartoon animation, simple clean shapes, soft pastel colors, bright even lighting. Exaggerated cartoon body language so the intention reads without any words. Simple Colombian school, minimal background detail. Fixed camera, no camera movement. No spoken words, only a soft steady rhythmic ambient beat. Calm, reassuring tone. 8 seconds, 9:16 vertical.
CHARACTERS: Teacher: adult woman, about 40, medium brown skin, black hair tied in a low ponytail, round face, light green blouse, dark gray trousers, flat shoes, calm expression. Affected person: adult man, about 35, medium skin, short black hair, white shirt and gray trousers. Total on screen: 2 people.
SETTING: A school patio floor of plain concrete, blank wall behind. The man lies flat on his back in the center, unconscious. The teacher kneels at his side, next to his chest.
HAZARD/OBJECTS: None. A soft pulsing circle (no letters) at the center of his chest to mark the spot.
CAMERA: Fixed side view at floor level, because the straight arms, the depth of the press and the full recovery of the chest must be seen.
TIMELINE:
[0-2 s] The teacher kneels, points with one finger at the center of the man's chest, then places the heel of one hand on that spot and the other hand on top with fingers interlocked and lifted.
[2-5 s] With straight locked elbows and shoulders directly above her hands, she presses down fast and rhythmically; the chest sinks about five centimeters and rises fully each time, about two presses per second.
[5-8 s] She keeps the same fast rhythm without changing hand position, arms straight, eyes on the chest.
END FRAME: Teacher mid-compression with straight arms, interlocked hands at the center of the chest, shoulders directly above, the man lying flat.
AVOID: hands on the stomach or low on the breastbone, bent elbows, slow or gentle pressing, lifting the hands off the chest between presses, any counter or number, text, letters, logos, subtitles, band-aid, bandage, first-aid kit, blood, any extra people besides the two listed.
```
- **Debe verse:**
  - Persona de espaldas sobre superficie firme y docente de rodillas junto al pecho.
  - Talón de la mano en el centro del pecho, manos entrelazadas.
  - Codos rectos y hombros sobre las manos (referencia externa: verificar con el validador).
  - Pecho se hunde unos 5 cm y se recupera por completo.
  - Ritmo rápido de unas 100-120 por minuto (referencia externa: verificar con el validador); manos sin cambiar de lugar.
- **No debe aparecer:** manos sobre el abdomen o la parte baja del esternón; codos doblados; presiones suaves o lentas; despegar las manos; sangre; contador numérico.
- **Pie (app):** «Manos entrelazadas en el centro del pecho. Aprieta fuerte 30 veces, hundiendo el pecho unos 5 centímetros cada vez.»
- **Si sale mal:**
  - Codos doblados: agrega `Her elbows are fully straight and locked, forming a vertical line from shoulders to hands.`
  - Manos mal puestas: agrega `Both hands stay on the exact center of the chest, between the nipples, the whole clip.`

#### RCP-2 Dos respiraciones (recuperar la respiración)
- **Ilustra** (ficha 4, B): «Abre su boca: pon una de tus manos en su frente y la otra en su barbilla. Tapa su nariz con tus dedos. Respira hondo. Pon tu boca y pégala a la de la víctima... 2 veces... Comprueba que su pecho se mueve.»
- **Prompt (EN):**
```
STYLE: Flat 2D cartoon animation, simple clean shapes, soft pastel colors, bright even lighting. Exaggerated cartoon body language so the intention reads without any words. Simple Colombian school, minimal background detail. Fixed camera, no camera movement. No spoken words, only soft ambient sound. Neutral, clinical cartoon tone. 8 seconds, 9:16 vertical.
CHARACTERS: Teacher: adult woman, about 40, medium brown skin, black hair tied in a low ponytail, round face, light green blouse, dark gray trousers, flat shoes, calm expression. Affected person: adult man, about 35, medium skin, short black hair, white shirt and gray trousers. Total on screen: 2 people.
SETTING: A school patio floor of plain concrete, blank wall behind. The man lies flat on his back, unconscious. The teacher kneels beside his head.
HAZARD/OBJECTS: None.
CAMERA: Fixed side view at floor level, because the head tilt, the nose pinch and the chest rising must be seen.
TIMELINE:
[0-2 s] The teacher places one hand on his forehead and the other under his chin, tilting his head gently back so his mouth opens.
[2-5 s] With the thumb and index finger of the forehead hand she pinches his nose closed, takes a deep breath, seals her mouth over his mouth and gives the first breath; his chest rises visibly, then falls as she lifts her head.
[5-8 s] She inhales again, seals again and gives the second breath; the chest rises again and falls.
END FRAME: Teacher kneeling at his head, hand on forehead and fingers pinching the nose, the man's chest slightly raised after the second breath.
AVOID: blowing without pinching the nose, the stomach inflating, more than two breaths, bending the neck forward, a romantic or ambiguous look, any counter or number, text, letters, logos, subtitles, band-aid, bandage, first-aid kit, blood, any extra people besides the two listed.
```
- **Debe verse:**
  - Una mano en la frente y otra en la barbilla; nariz tapada con los dedos.
  - Boca sellada sobre boca; dos soplos, de aproximadamente 1 s cada uno (referencia externa: verificar con el validador).
  - El pecho sube con cada soplo y la docente suelta para tomar aire.
- **No debe aparecer:** soplar sin tapar la nariz; abdomen que se infla; más de 2 soplos; flexionar el cuello hacia adelante; escena íntima o ambigua (mantener tono clínico).
- **Pie (app):** «Una mano en la frente y otra en la barbilla, tapa su nariz, pega tu boca a la suya y sopla 2 veces. Comprueba que su pecho se mueve.»
- **Si sale mal:**
  - Más de dos soplos: agrega `Exactly two breaths, no more.`
  - Tono íntimo: agrega `Clinical, neutral, educational look; faces drawn simply and seen from the side.`

#### RCP-3a Ciclo 30 + 2: volver a empezar
- **Ilustra** (ficha 4, C): «Dos respiraciones y 30 apretones, y vuelta a empezar. Repite el ejercicio hasta que la persona respire o llegue la ayuda.» (ver punto V2 sobre el orden del ciclo)
- **Prompt (EN):**
```
STYLE: Flat 2D cartoon animation, simple clean shapes, soft pastel colors, bright even lighting. Exaggerated cartoon body language so the intention reads without any words. Simple Colombian school, minimal background detail. Fixed camera, no camera movement. No spoken words, only a soft steady rhythmic ambient beat. Calm, reassuring tone. 8 seconds, 9:16 vertical.
CHARACTERS: Teacher: adult woman, about 40, medium brown skin, black hair tied in a low ponytail, round face, light green blouse, dark gray trousers, flat shoes, calm expression. Affected person: adult man, about 35, medium skin, short black hair, white shirt and gray trousers. Total on screen: 2 people.
SETTING: A school patio floor of plain concrete, blank wall behind. The man lies flat on his back in the center. The teacher kneels at his side.
HAZARD/OBJECTS: None.
CAMERA: Fixed wide side view at floor level, so both the chest area and the head area are in the frame and the teacher can be seen moving between them.
TIMELINE:
[0-3 s] The teacher does a quick burst of chest compressions at the center of his chest, straight arms, interlocked hands.
[3-5 s] She shifts to his head, tilts it back, pinches his nose and gives two quick breaths; his chest rises each time.
[5-8 s] She moves straight back to his chest and starts the compressions again, same position and same fast rhythm.
END FRAME: Teacher mid-compression again at the center of his chest, straight arms, the man lying flat.
AVOID: long pauses, stopping to talk, feeling the neck for a pulse, a defibrillator, any counter or number, text, letters, logos, subtitles, band-aid, bandage, first-aid kit, blood, any extra people besides the two listed.
```
- **Debe verse:**
  - Compresiones, luego 2 respiraciones, luego volver a comprimir (ciclo 30:2; referencia externa: verificar con el validador).
  - Sin pausas largas; el ciclo se ve repetirse.
- **No debe aparecer:** detenerse a conversar; buscar pulso en el cuello; desfibrilador (la ficha no lo menciona: no inventarlo); números o cronómetros.
- **Pie (app):** «Dos respiraciones y 30 apretones, y vuelta a empezar, hasta que la persona respire o llegue la ayuda.»
- **Si sale mal:**
  - Solo salen compresiones: agrega `The middle part must clearly show the two mouth-to-mouth breaths at his head before she returns to the chest.`
  - Aparece un ayudante: agrega `No one else in the scene; only the teacher and the man.`

#### RCP-3b Antes de nada: alguien llama al 123
- **Ilustra** (ficha 4, aviso inicial): «Antes de nada: llama al 123. Después haz la reanimación hasta que la persona se mueva o abra los ojos, o hasta que llegue la ayuda.»
- **Prompt (EN):**
```
STYLE: Flat 2D cartoon animation, simple clean shapes, soft pastel colors, bright even lighting. Exaggerated cartoon body language so the intention reads without any words. Simple Colombian school, minimal background detail. Fixed camera, no camera movement. No spoken words, only soft ambient sound. Calm, reassuring tone. 8 seconds, 9:16 vertical.
CHARACTERS: Teacher: adult woman, about 40, medium brown skin, black hair tied in a low ponytail, round face, light green blouse, dark gray trousers, flat shoes, calm expression. Helper student: teenage boy, about 15, light brown skin, short black hair, white polo shirt and navy trousers, serious calm face. Affected person: adult man, about 35, medium skin, short black hair, white shirt and gray trousers. Total on screen: 3 people.
SETTING: A school patio. Center: the man lies on his back, unconscious, with the teacher kneeling at his chest. Right background: a school gate, open and plain.
HAZARD/OBJECTS: A smartphone with a blank dark screen (no digits, no keypad).
CAMERA: Wide full shot from a fixed, slightly high angle, because both the compressions in the foreground and the helper with the phone in the background must be visible.
TIMELINE:
[0-2 s] The teacher kneels, looks up and points firmly at the helper with one arm; the helper takes the phone out of his pocket.
[2-5 s] The helper raises the phone to his ear and stands a few steps away, looking at the teacher; meanwhile the teacher places her hands at the center of the man's chest and starts compressions.
[5-8 s] The helper points toward the school gate and walks a few steps toward it, as if guiding the arriving help; the teacher keeps compressing.
END FRAME: Helper at the gate side pointing outward with the phone at his ear, the teacher compressing the man's chest in the foreground.
AVOID: the helper doing the compressions, the teacher leaving the man, any visible digits or keypad, panic or shouting, text, letters, logos, subtitles, band-aid, bandage, first-aid kit, blood, any extra people besides the three listed.
```
- **Debe verse:**
  - La docente indica al ayudante que llame; él lleva el celular al oído (pantalla sin números).
  - La docente comienza las compresiones.
  - El ayudante señala la puerta para guiar a la ayuda.
- **No debe aparecer:** docente que se va a llamar dejando solo al hombre; dígitos legibles; pánico; terceras personas.
- **Pie (app):** «Antes de nada: llama al 123. Pide a alguien que llame y guíe a la ayuda mientras tú empiezas la reanimación.»
- **Si sale mal:**
  - El ayudante no sale: agrega `The helper student must be clearly visible on the right side of the frame during the whole clip.`
  - La pantalla muestra números: agrega `The phone screen is never visible to the camera.`

### Ficha 5: Atragantamiento

#### ATR-1 Puede toser: animar a toser
- **Ilustra** (ficha 5): «Si NO respira bien, pero puede toser: anima a la persona a toser hasta que eche la comida... No le des golpes en la espalda.»
- **Prompt (EN):**
```
STYLE: Flat 2D cartoon animation, simple clean shapes, soft pastel colors, bright even lighting. Exaggerated cartoon body language so the intention reads without any words. Simple Colombian school, minimal background detail. Fixed camera, no camera movement. No spoken words, only soft ambient sound. Calm, reassuring tone. 8 seconds, 9:16 vertical.
CHARACTERS: Teacher: adult woman, about 40, medium brown skin, black hair tied in a low ponytail, round face, light green blouse, dark gray trousers, flat shoes, calm expression. Affected student: teenage girl, about 15, tan skin, long dark brown braid, white polo shirt and navy skirt. Total on screen: 2 people.
SETTING: A school cafeteria. The girl stands next to a plain table with a plain plate and a blank paper napkin on it, center-left. The teacher stands at her right side, both hands visible in front of her own chest.
HAZARD/OBJECTS: A small piece of food stuck in the girl's throat (shown only by a small bump drawn at her throat). The napkin on the table.
CAMERA: Medium shot at eye level, because the girl's coughing and the teacher's hands staying away from her back must be seen.
TIMELINE:
[0-2 s] The girl suddenly puts a hand to her throat and leans slightly forward with wide eyes.
[2-5 s] She coughs hard, again and again, with small cartoon cough puffs (no letters). The teacher stands beside her, nods and makes a calm "go ahead, cough" open-hand gesture, hands never touching her back.
[5-8 s] The girl coughs out the small piece of food, which lands on the napkin; she breathes deeply and smiles with relief while the teacher nods.
END FRAME: Girl standing upright and breathing freely with a relieved smile, the food piece on the napkin, the teacher beside her with both hands visible.
AVOID: slapping or patting the girl's back, giving her water, putting fingers in her mouth, hugging her from behind, text, letters, numbers, logos, subtitles, band-aid, bandage, first-aid kit, blood, any extra people besides the two listed.
```
- **Debe verse:**
  - Niña que tose con fuerza.
  - Docente a su lado, tranquila, animando, con las manos lejos de la espalda.
  - Sale un trozo pequeño de comida y la niña respira aliviada.
- **No debe aparecer:** palmadas en la espalda; darle agua; meter los dedos en la boca; abrazarla por detrás.
- **Pie (app):** «Si puede toser: anímala a toser hasta que eche la comida. No le des golpes en la espalda.»
- **Si sale mal:**
  - La docente toca la espalda: agrega `The teacher's hands stay in front of her own chest or open in the air; they never touch the girl.`
  - No se ve la comida: agrega `A small round food piece flies out and lands clearly on the napkin.`

#### ATR-2 No respira ni puede toser: apretar debajo del pecho
- **Ilustra** (ficha 5): «Si NO respira nada, ni puede toser: intenta sacar la comida de su boca con tus manos. Intenta sacar la comida apretando debajo de su pecho.»
- **Prompt (EN):**
```
STYLE: Flat 2D cartoon animation, simple clean shapes, soft pastel colors, bright even lighting. Exaggerated cartoon body language so the intention reads without any words. Simple Colombian school, minimal background detail. Fixed camera, no camera movement. No spoken words, only soft ambient sound. Calm, reassuring tone. 8 seconds, 9:16 vertical.
CHARACTERS: Teacher: adult woman, about 40, medium brown skin, black hair tied in a low ponytail, round face, light green blouse, dark gray trousers, flat shoes, calm expression. Affected student: teenage girl, about 15, tan skin, long dark brown braid, white polo shirt and navy skirt. Total on screen: 2 people.
SETTING: A school cafeteria, blank wall behind. The girl stands in the center, facing left. The teacher is behind her.
HAZARD/OBJECTS: A small piece of food stuck in the girl's throat (a small bump drawn at her throat).
CAMERA: Fixed side view, because the fist position below the breastbone and the inward-upward push must be seen.
TIMELINE:
[0-2 s] The girl stands with both hands clutching her throat, mouth open, eyes wide, unable to cough or speak. The teacher runs in and stands behind her.
[2-5 s] The teacher wraps both arms around the girl's waist, closes one fist with the thumb side against the girl's upper belly above the navel and well below the breastbone, and covers the fist with her other hand.
[5-8 s] She pulls sharply inward and upward in quick thrusts, twice; a small piece of food pops out of the girl's mouth and the girl gasps and breathes.
END FRAME: Girl breathing freely with a hand on her chest, teacher still holding her gently from behind, the food piece on the floor.
AVOID: the fist on the breastbone or ribs, squeezing the neck, back blows, fingers sweeping the mouth, violence, text, letters, numbers, logos, subtitles, band-aid, bandage, first-aid kit, blood, any extra people besides the two listed.
```
- **Debe verse:**
  - Persona de pie con manos en la garganta (no puede toser ni hablar).
  - Docente detrás, brazos alrededor de la cintura; puño con el lado del pulgar contra el abdomen alto, sobre el ombligo y bien debajo del esternón.
  - Empuje rápido hacia adentro y arriba (referencia externa: verificar con el validador; la ficha solo dice «apretando debajo de su pecho»).
  - Sale la comida y la niña respira.
- **No debe aparecer:** puño sobre el esternón o las costillas; apretar el cuello; golpes en la espalda en este clip (la ficha no los incluye; ver punto V1); dedos barriendo la boca; violencia excesiva.
- **Pie (app):** «Si no respira nada ni puede toser: intenta sacar la comida de su boca con tus manos o apretando debajo de su pecho. Llama al 123.»
- **Si sale mal:**
  - Puño muy arriba: agrega `The fist sits low on the belly, just above the navel, far below the ribs.`
  - Se ve una paliza: agrega `Gentle cartoon style; the teacher's movement is controlled and calm, not violent.`

### Ficha 6: Convulsiones

#### CON-1 Qué hacer durante la convulsión
- **Ilustra** (ficha 6): «Tumba a la persona. Quita las cosas que se le puedan caer encima... No la sujetes. No le des agua ni comida. No la dejes sola.»
- **Prompt (EN):**
```
STYLE: Flat 2D cartoon animation, simple clean shapes, soft pastel colors, bright even lighting. Exaggerated cartoon body language so the intention reads without any words. Simple Colombian school, minimal background detail. Fixed camera, no camera movement. No spoken words, only soft ambient sound. Calm, reassuring tone. 8 seconds, 9:16 vertical.
CHARACTERS: Teacher: adult woman, about 40, medium brown skin, black hair tied in a low ponytail, round face, light green blouse, dark gray trousers, flat shoes, calm expression. Affected student: teenage girl, about 15, tan skin, long dark brown braid, white polo shirt and navy skirt. Helper student: teenage boy, about 15, light brown skin, short black hair, white polo shirt and navy trousers, serious calm face. Total on screen: 3 people.
SETTING: A plain classroom. Center: the girl lies on the floor on her back. Left of her: a chair and a backpack right next to her head. Right background: the helper student standing back near the wall.
HAZARD/OBJECTS: A chair and a backpack placed close to the girl, as things that could fall on or hurt her.
CAMERA: Wide shot from a fixed, slightly high angle, because the objects being moved away and the space around the girl must be seen.
TIMELINE:
[0-2 s] The girl lies on the floor making gentle stylized shaking movements (soft, not violent). The teacher kneels at her side, hands open and visibly NOT holding her down.
[2-5 s] The teacher picks up the chair and carries it far to the left, then the backpack, clearing the floor around the girl; then she returns to kneel beside her.
[5-8 s] The teacher stays right beside the girl, hands open and hovering with palms up, never holding her; the helper stays back by the wall, calm.
END FRAME: Clear floor around the girl, teacher kneeling beside her with open hands off the girl, chair and backpack far away, helper at the wall.
AVOID: holding the girl's arms or legs, anything in her mouth, giving water or food, the teacher leaving, foam, rolled-back eyes, scared or screaming classmates, text, letters, numbers, logos, subtitles, band-aid, bandage, first-aid kit, blood, any extra people besides the three listed.
```
- **Debe verse:**
  - Niña en el suelo con movimientos estilizados y suaves.
  - Docente retira silla y mochila lejos.
  - Manos abiertas, sin sujetar; la docente no la deja sola.
- **No debe aparecer:** sujetar brazos o piernas; objeto en la boca; dar agua; docente que se va; espuma, ojos en blanco; compañeros gritando.
- **Pie (app):** «Tumba a la persona y quita lo que pueda caerle encima. No la sujetes, no le des agua ni comida y no la dejes sola.»
- **Si sale mal:**
  - La docente la sujeta: agrega `The teacher's hands never touch the girl; they stay open beside her.`
  - Se ve violento: agrega `Very small, soft, slow trembling, calm cartoon style.`

#### CON-2 Al terminar: posición lateral
- **Ilustra** (ficha 6): «Cuando no convulsione, colócala en Posición Lateral de Seguridad.»
- **Prompt (EN):**
```
STYLE: Flat 2D cartoon animation, simple clean shapes, soft pastel colors, bright even lighting. Exaggerated cartoon body language so the intention reads without any words. Simple Colombian school, minimal background detail. Fixed camera, no camera movement. No spoken words, only soft ambient sound. Calm, reassuring tone. 8 seconds, 9:16 vertical.
CHARACTERS: Teacher: adult woman, about 40, medium brown skin, black hair tied in a low ponytail, round face, light green blouse, dark gray trousers, flat shoes, calm expression. Affected student: teenage girl, about 15, tan skin, long dark brown braid, white polo shirt and navy skirt. Total on screen: 2 people.
SETTING: A plain classroom floor, blank wall behind and a clear floor. The girl lies on her back, the teacher kneeling at her near side.
HAZARD/OBJECTS: None.
CAMERA: Fixed high three-quarter view, because it must be clear the shaking stops BEFORE the teacher moves her.
TIMELINE:
[0-2 s] The girl's gentle shaking slows down and stops; she lies completely still on her back, breathing softly. The teacher waits with her hands off the girl.
[2-5 s] Only now the teacher gently bends the girl's near arm and far knee and then, one hand on the hip and one on the shoulder, begins to roll her slowly toward herself.
[5-8 s] The girl rests stably on her side, top knee bent forward. The teacher places a calm hand on her shoulder and stays beside her.
END FRAME: Girl resting still on her side in the stable position, teacher kneeling beside her with a hand on her shoulder.
AVOID: moving her while she still shakes, sitting her up or lifting her, the teacher leaving, text, letters, numbers, logos, subtitles, band-aid, bandage, first-aid kit, blood, any extra people besides the two listed.
```
- **Debe verse:**
  - Los movimientos cesan antes de que la docente la toque.
  - Giro suave a posición lateral estable (igual que LAT-1/LAT-2).
  - La docente se queda con ella.
- **No debe aparecer:** mover a la persona mientras aún convulsiona; sentarla o levantarla; irse.
- **Pie (app):** «Cuando no convulsione, colócala en Posición Lateral de Seguridad y quédate con ella.»
- **Si sale mal:**
  - La mueve antes de que pare: agrega `The teacher keeps her hands off the girl for the first two seconds, until the shaking has completely stopped.`
  - Posición inestable: agrega `The girl ends fully on her side with the top knee bent forward.`

### Ficha 7: Heridas

#### HER-1a Si sangra: apretar con una gasa limpia
- **Ilustra** (ficha 7, «Si la víctima sangra»): «Aprieta la herida con una gasa limpia.» Y «No eches alcohol.»
- **Prompt (EN):**
```
STYLE: Flat 2D cartoon animation, simple clean shapes, soft pastel colors, bright even lighting. Exaggerated cartoon body language so the intention reads without any words. Simple Colombian school, minimal background detail. Fixed camera, no camera movement. No spoken words, only soft ambient sound. Calm, reassuring tone. 8 seconds, 9:16 vertical.
CHARACTERS: Teacher: adult woman, about 40, medium brown skin, black hair tied in a low ponytail, round face, light green blouse, dark gray trousers, flat shoes, calm expression, wearing clean disposable gloves. Affected student: teenage girl, about 15, tan skin, long dark brown braid, white polo shirt and navy skirt. Total on screen: 2 people.
SETTING: A plain classroom, a desk at the center. The girl sits on a chair beside the desk and rests her bare forearm on the desk, palm up. The teacher sits on the other side.
HAZARD/OBJECTS: A small cut on the forearm suggested only by a soft pale red patch (no blood drops). A clean white gauze pad on the desk. No bottles of any kind.
CAMERA: Close-up from slightly above of the forearm and the teacher's hands, because the firm pressure of the gauze on the wound is the message.
TIMELINE:
[0-2 s] The teacher picks up the clean white gauze pad from the desk with her gloved hand.
[2-5 s] She places the gauze directly over the pale red patch and presses down firmly with her palm.
[5-8 s] She keeps pressing steadily, without lifting, while the girl looks calm.
END FRAME: Gloved hand pressing a white gauze pad firmly on the girl's forearm, the girl calm.
AVOID: alcohol, hydrogen peroxide or any bottle, powders, ointment, home remedies, bare hands on the wound, a decorative band-aid or adhesive strip, explicit blood, a first-aid kit with a cross or text, text, letters, numbers, logos, subtitles, any extra people besides the two listed.
```
- **Debe verse:**
  - Herida solo sugerida con mancha suave.
  - Gasa blanca limpia presionando con firmeza.
  - Guantes desechables (referencia externa: verificar con el validador).
- **No debe aparecer:** alcohol, agua oxigenada, polvos o remedios caseros; manos sin guantes sobre la herida; sangre explícita; botiquín con letras o cruz.
- **Pie (app):** «Si sangra, aprieta la herida con una gasa limpia. No eches alcohol.»
- **Si sale mal:**
  - Sale una curita: agrega `Use only a square white gauze pad pressed by hand, never an adhesive strip.`
  - Sangre fuerte: agrega `Only a soft pale pink patch, no drops, no red liquid.`

#### HER-1b Si sangra: lavar con agua y jabón y tapar
- **Ilustra** (ficha 7): «Lava la herida con agua y jabón. Tapa la herida con otra gasa limpia.» (Orden de la ficha; ver V7.)
- **Prompt (EN):**
```
STYLE: Flat 2D cartoon animation, simple clean shapes, soft pastel colors, bright even lighting. Exaggerated cartoon body language so the intention reads without any words. Simple Colombian school, minimal background detail. Fixed camera, no camera movement. No spoken words, only soft ambient sound. Calm, reassuring tone. 8 seconds, 9:16 vertical.
CHARACTERS: Teacher: adult woman, about 40, medium brown skin, black hair tied in a low ponytail, round face, light green blouse, dark gray trousers, flat shoes, calm expression, wearing clean disposable gloves. Affected student: teenage girl, about 15, tan skin, long dark brown braid, white polo shirt and navy skirt. Total on screen: 2 people.
SETTING: A plain school sink on the right with a simple faucet and a plain bar of soap. The girl stands at the sink holding her forearm out; the teacher stands beside her. On a small counter on the left: a clean white gauze pad.
HAZARD/OBJECTS: A small cut suggested only by a soft pale pink patch. A faucet with a gentle stream of water, a soap bar, a clean white gauze pad.
CAMERA: Medium shot at eye level from the front, because the washing and the covering must be seen in sequence.
TIMELINE:
[0-3 s] The teacher guides the girl's forearm under the gentle stream of water and rubs a little soap around the small patch, with cartoon bubbles (no letters).
[3-5 s] She rinses the soap off and gently pats the area dry with her gloved hand.
[5-8 s] She picks up the clean white gauze pad from the counter and lays it over the wound, holding it in place with her palm. The girl smiles calmly.
END FRAME: Teacher's gloved hand holding a white gauze pad over the girl's forearm, the girl calm at the sink.
AVOID: alcohol, hydrogen peroxide or any bottle, powders, ointment, home remedies, a decorative band-aid or adhesive strip, bare hands on the wound, explicit blood, text, letters, numbers, logos, subtitles, any extra people besides the two listed.
```
- **Debe verse:**
  - Lavado con agua y jabón, con burbujas.
  - Segunda gasa limpia cubriendo la herida.
  - Guantes desechables (referencia externa: verificar con el validador).
- **No debe aparecer:** alcohol, agua oxigenada, polvos o remedios caseros; sangre explícita; curita adhesiva; manos sin guantes.
- **Pie (app):** «Lava la herida con agua y jabón y tápala con otra gasa limpia. Esperar a la ayuda del 123 es lo mejor.»
- **Si sale mal:**
  - Aparece un vendaje: agrega `Only a plain white gauze pad held by hand; never tape, never an elastic bandage.`
  - No hay lavado: agrega `The first half of the clip is only washing the forearm under the faucet with soap bubbles.`

### Ficha 8: Golpes

#### GOL-1 Hielo y no mover
- **Ilustra** (ficha 8): «Poner hielo en la parte del cuerpo donde se ha dado el golpe. No mover la parte del cuerpo donde se ha dado el golpe.»
- **Prompt (EN):**
```
STYLE: Flat 2D cartoon animation, simple clean shapes, soft pastel colors, bright even lighting. Exaggerated cartoon body language so the intention reads without any words. Simple Colombian school, minimal background detail. Fixed camera, no camera movement. No spoken words, only soft ambient sound. Calm, reassuring tone. 8 seconds, 9:16 vertical.
CHARACTERS: Teacher: adult woman, about 40, medium brown skin, black hair tied in a low ponytail, round face, light green blouse, dark gray trousers, flat shoes, calm expression. Affected student: teenage girl, about 15, tan skin, long dark brown braid, white polo shirt and navy skirt. Total on screen: 2 people.
SETTING: A school patio with a plain bench at the center. The girl sits on the bench with her leg straight, resting on the bench, the knee showing a soft purple bruise patch. The teacher kneels beside the bench.
HAZARD/OBJECTS: An ice pack wrapped in a plain cloth, held by the teacher.
CAMERA: Medium shot from the side at knee height, because the position of the ice and the stillness of the leg must be seen.
TIMELINE:
[0-2 s] The teacher kneels, holding the cloth-wrapped ice pack, and looks at the girl's purple knee.
[2-5 s] She places the wrapped ice pack gently on the knee and holds it there; the girl winces slightly and then relaxes.
[5-8 s] The teacher raises an open palm toward the girl's leg in a calm "stay still" gesture; the girl nods and keeps the leg perfectly still.
END FRAME: Wrapped ice pack held on the purple knee, the leg still and supported, the teacher's other palm open, the girl nodding.
AVOID: massaging, bending or moving the knee, ice directly on bare skin, the girl walking, band-aid, bandage, first-aid kit, blood, text, letters, numbers, logos, subtitles, any extra people besides the two listed.
```
- **Debe verse:**
  - Bolsa de hielo envuelta en tela sobre la zona golpeada (la ficha 10 pide envolverlo; ver V6).
  - La pierna queda quieta.
  - La docente indica que no la mueva.
- **No debe aparecer:** masajes; mover o flexionar la rodilla; hielo directo sobre la piel; la víctima caminando.
- **Pie (app):** «Pon hielo en la parte del cuerpo donde se dio el golpe. No muevas esa parte del cuerpo.»
- **Si sale mal:**
  - La niña camina: agrega `The girl stays seated on the bench with her leg resting straight for the whole clip.`
  - Hielo suelto: agrega `The ice is always inside a folded cloth and never touches bare skin.`

### Ficha 10: Golpes en huesos y articulaciones

#### FRA-1a Esguince: hielo envuelto en tela
- **Ilustra** (ficha 10, «Primeros auxilios de un esguince»): «Aplicar hielo inmediatamente para reducir la inflamación, envolviendo el hielo en un pedazo de tela y evitando aplicarlo directamente sobre la piel.»
- **Prompt (EN):**
```
STYLE: Flat 2D cartoon animation, simple clean shapes, soft pastel colors, bright even lighting. Exaggerated cartoon body language so the intention reads without any words. Simple Colombian school, minimal background detail. Fixed camera, no camera movement. No spoken words, only soft ambient sound. Calm, reassuring tone. 8 seconds, 9:16 vertical.
CHARACTERS: Teacher: adult woman, about 40, medium brown skin, black hair tied in a low ponytail, round face, light green blouse, dark gray trousers, flat shoes, calm expression. Affected student: teenage girl, about 15, tan skin, long dark brown braid, white polo shirt and navy skirt. Total on screen: 2 people.
SETTING: A classroom corner with a plain bench. The girl sits on the bench with her shoeless foot resting on it, the ankle drawn slightly swollen with a rounded shape and a pale purple patch.
HAZARD/OBJECTS: A few ice cubes in a bowl and a plain cloth on the bench.
CAMERA: Close-up at ankle level from the side, because wrapping the ice in the cloth before placing it is the message.
TIMELINE:
[0-2 s] The teacher places three ice cubes in the center of a plain cloth.
[2-5 s] She folds the cloth around the ice into a small wrapped bundle.
[5-8 s] She gently places the cloth-wrapped ice on the swollen ankle and holds it there; the girl looks relieved.
END FRAME: Cloth-wrapped ice held on the swollen ankle, no ice touching bare skin.
AVOID: ice directly on skin, massage, pomade, pills, trying to set the bone, the girl walking, band-aid, first-aid kit, blood, text, letters, numbers, logos, subtitles, any extra people besides the two listed.
```
- **Debe verse:**
  - Hielo metido y envuelto en la tela antes de ponerlo.
  - Bulto envuelto sobre el tobillo hinchado.
  - La niña quieta, sin caminar.
- **No debe aparecer:** hielo directo sobre la piel; masaje o pomadas; intentar acomodar el hueso; pastillas (la ficha las omitió a propósito).
- **Pie (app):** «Hielo envuelto en un pedazo de tela, nunca directo sobre la piel.»
- **Si sale mal:**
  - Hielo desnudo: agrega `Show the ice being wrapped inside the cloth before it touches the ankle.`
  - Sale un vendaje: agrega `No bandage in this clip, only ice in a cloth.`

#### FRA-1b Esguince: vendaje no apretado y pie elevado
- **Ilustra** (ficha 10): «Colocar un vendaje firme pero no apretado... Mantener elevada la articulación inflamada por encima del nivel del corazón... Dejar en reposo.»
- **Prompt (EN):**
```
STYLE: Flat 2D cartoon animation, simple clean shapes, soft pastel colors, bright even lighting. Exaggerated cartoon body language so the intention reads without any words. Simple Colombian school, minimal background detail. Fixed camera, no camera movement. No spoken words, only soft ambient sound. Calm, reassuring tone. 8 seconds, 9:16 vertical.
CHARACTERS: Teacher: adult woman, about 40, medium brown skin, black hair tied in a low ponytail, round face, light green blouse, dark gray trousers, flat shoes, calm expression. Affected student: teenage girl, about 15, tan skin, long dark brown braid, white polo shirt and navy skirt. Total on screen: 2 people.
SETTING: A classroom corner. The girl reclines on a bench with her back against the wall, her swollen ankle bare. A stack of three backpacks with a cushion on top stands at the end of the bench.
HAZARD/OBJECTS: A plain beige elastic bandage roll, the stack of backpacks and cushion.
CAMERA: Fixed side view at bench level, because the bandage with free toes and the foot raised above the girl's heart must be seen.
TIMELINE:
[0-3 s] The teacher wraps the elastic bandage around the ankle and foot in a firm but loose figure, leaving all the toes uncovered and visible.
[3-6 s] She lifts the girl's foot gently and rests it on the cushion over the backpacks, higher than the girl's chest.
[6-8 s] The girl rests quietly with the foot raised; the teacher steps back and nods.
END FRAME: Bandaged ankle with visible toes, resting raised on the cushion above the girl's chest level, the girl reclined and resting.
AVOID: a very tight bandage, covering the toes, massage, pomade, trying to set the bone, the girl walking, pills, explicit blood, text, letters, numbers, logos, subtitles, any extra people besides the two listed.
```
- **Debe verse:**
  - Vendaje firme pero no apretado, con los dedos del pie visibles.
  - Pie elevado por encima del nivel del corazón (persona recostada).
  - Reposo.
- **No debe aparecer:** vendaje muy apretado o que cubra los dedos; masaje o pomadas; intentar acomodar el hueso; la persona caminando; pastillas.
- **Pie (app):** «Vendaje firme pero no apretado, articulación elevada por encima del corazón y en reposo varios días.»
- **Si sale mal:**
  - Dedos tapados: agrega `All five toes remain visible and uncovered.`
  - Pie bajo: agrega `The foot rests higher than the girl's chest, clearly visible above her heart level.`

### Ficha 11: Vendajes e inmovilización (solo brigada)

#### VEN-1 Cabestrillo improvisado
- **Ilustra** (ficha 11, «Cabestrillo improvisado»): «Se coloca el brazo sobre el pecho, con la mano hacia el hombro contrario a la lesión (o... con la mano más alta que el codo). Se compone con lo que se tenga a la mano: pañoleta, cinturón, corbata o camisa.»
- **Prompt (EN):**
```
STYLE: Flat 2D cartoon animation, simple clean shapes, soft pastel colors, bright even lighting. Exaggerated cartoon body language so the intention reads without any words. Simple Colombian school, minimal background detail. Fixed camera, no camera movement. No spoken words, only soft ambient sound. Calm, reassuring tone. 8 seconds, 9:16 vertical.
CHARACTERS: Brigade teacher: adult man, about 40, medium skin, short black hair, light blue polo shirt and gray trousers, calm expression. Affected student: teenage girl, about 15, tan skin, long dark brown braid, white polo shirt and navy skirt. Total on screen: 2 people.
SETTING: A plain classroom, blank wall behind. The girl sits on a chair facing the camera in the center, holding her injured forearm against her chest, hand toward the opposite shoulder. The brigade teacher stands at her injured side.
HAZARD/OBJECTS: A large plain triangular cloth (like a scarf), unfolded in his hands.
CAMERA: Fixed front view at chest height, because the cloth under the forearm, the knot at the side of the neck and the visible fingers must be seen.
TIMELINE:
[0-2 s] The girl winces, supporting her forearm against her chest; the brigade teacher shows the large triangular cloth.
[2-5 s] He slides the cloth under her forearm like a hammock and brings the two ends up on both sides toward her neck.
[5-8 s] He ties the two ends in a knot at the side of her neck; the forearm rests across her chest with the hand slightly higher than the elbow, all fingers visible. The girl nods, relieved.
END FRAME: Girl with her forearm resting in the cloth sling across the chest, knot at the side of the neck, fingers visible, brigade teacher beside her.
AVOID: the knot on the back of the neck or spine, a tight knot, the hand lower than the elbow, setting the bone, text, letters, numbers, logos, subtitles, band-aid, first-aid kit, blood, any extra people besides the two listed.
```
- **Debe verse:**
  - Antebrazo sobre el pecho, mano hacia el hombro contrario o mano más alta que el codo (ficha).
  - Tela triangular tipo hamaca bajo el antebrazo, con nudo al costado del cuello (referencia externa: verificar con el validador).
  - Dedos visibles.
- **No debe aparecer:** nudo sobre la nuca o columna; nudo muy apretado; mano más baja que el codo; intento de acomodar el hueso.
- **Pie (app):** «Brazo sobre el pecho, mano hacia el hombro contrario (o mano más alta que el codo). Se arma con lo que haya a la mano: pañoleta, cinturón, corbata o camisa. Solo brigada.»
- **Si sale mal:**
  - Nudo en la nuca: agrega `The knot is clearly at the side of her neck, visible from the front.`
  - Dedos tapados: agrega `The fingertips stick out of the cloth, clearly visible.`

---

## 3. Resumen de clips por ficha

| Ficha | Clips | Cantidad |
|---|---|---|
| 1 La regla PAS | PAS-1a, PAS-1b, PAS-2, PAS-3 | 4 |
| 2 Revisar a la víctima | REV-1a, REV-1b, REV-2 | 3 |
| 3 Posición lateral | LAT-1a, LAT-1b, LAT-2 | 3 |
| 4 Reanimación | RCP-1, RCP-2, RCP-3a, RCP-3b | 4 |
| 5 Atragantamiento | ATR-1, ATR-2 | 2 |
| 6 Convulsiones | CON-1, CON-2 | 2 |
| 7 Heridas | HER-1a, HER-1b | 2 |
| 8 Golpes | GOL-1 | 1 |
| 9 Qué son los primeros auxilios | sin clip (texto para leer con calma) | 0 |
| 10 Huesos y articulaciones | FRA-1a, FRA-1b | 2 |
| 11 Vendajes (brigada) | VEN-1 | 1 |
| **Total** | | **24** |

Clips divididos (antes 18, ahora 24): PAS-1 (proteger el entorno / alejar a la víctima), REV-1 (voz / pellizco), LAT-1 (objetos y brazo / pierna y otro brazo), RCP-3 (ciclo / alguien llama), HER-1 (apretar / lavar y tapar), FRA-1 (hielo / vendaje y elevación).

---

## 4. Puntos a consultar con el validador

- **V1 Atragantamiento (ficha 5):** la ficha dice que NO se den golpes en la espalda si la persona puede toser, y para quien no respira ni tose dice «apretando debajo de su pecho». Muchas guías vigentes indican, cuando la tos es inefectiva, 5 golpes en la espalda (entre los omóplatos) seguidos de compresiones abdominales (con técnica adaptada en embarazadas, personas con obesidad y niños pequeños). Los clips siguen la ficha. Decidir si se agrega esa secuencia a la ficha y al clip. Ya lo señala `NOTAS_REVISION`. Tampoco dice qué hacer si la persona queda inconsciente (iniciar reanimación).
- **V2 Orden del ciclo de reanimación (ficha 4):** los pasos van A) 30 compresiones, B) 2 respiraciones, pero el ciclo se enuncia empezando por «dos respiraciones». Las guías vigentes inician con compresiones (30:2). RCP-3a muestra compresiones primero. Ya lo señala `NOTAS_REVISION`.
- **V3 Profundidad y frecuencia según edad:** la ficha dice «unos 5 centímetros» (adulto) y no da frecuencia (referencia externa: 100-120 por minuto). En menores las guías hablan de aproximadamente un tercio del grosor del tórax. Los clips usan un adulto afectado. Confirmar si hace falta un clip aparte para estudiantes.
- **V4 Respiraciones de rescate:** la ficha pide 2 respiraciones boca a boca. Las guías vigentes admiten RCP solo con compresiones para quien no está entrenado o no tiene barrera de protección. Decidir el criterio institucional; los clips siguen la ficha (sin barrera).
- **V5 Posición lateral:** la ficha dice cambiar de lado cada 20 minutos (otras guías hablan de 30). No detalla la inclinación final de la cabeza (LAT-2 usa referencia externa). Verificar. Además, la ficha excluye el uso tras golpe fuerte en la espalda sin dar alternativa; conviene un aviso visible junto a LAT-1a/LAT-1b/LAT-2 en la app.
- **V6 Hielo directo vs envuelto:** la ficha 8 dice «poner hielo» sin envolver; la ficha 10 pide envolverlo en tela. Los clips lo envuelven siempre. Unificar la redacción de la ficha 8.
- **V7 Heridas:** la ficha manda apretar con gasa, lavar con agua y jabón y tapar, y a la vez dice «no toques la herida». Para sangrado importante, las guías indican presión directa continua sin levantar la gasa y lavar solo cuando se controle. HER-1a y HER-1b siguen el orden de la ficha; validar si aplica solo a heridas pequeñas.
- **V8 Convulsiones:** la ficha dice «unos 5 minutos» de duración y marca llamar al 123 en general. Guías vigentes: llamar si dura más de 5 minutos, si es la primera vez, si hay lesión o si no recupera la consciencia. Es un tema de texto, no del clip.
- **V9 Consciencia:** la ficha usa el pellizco; algunas guías prefieren tocar o sacudir suavemente los hombros. Confirmar si REV-1b debe mostrar el pellizco (lo que hace ahora) o el toque en los hombros.
- **V10 Mover a la víctima:** PAS-3 dice «no la muevas ni la cambies de sitio» y PAS-1b muestra alejarla del peligro. La ficha 1 dice ambas cosas («aléjala del peligro»); el clip PAS-1b deja claro que solo se mueve si hay peligro y que la víctima camina sola. Confirmar con el validador que esa lectura es la adecuada (y qué hacer si NO puede caminar).

---

## 5. Checklist de validación (persona de salud)

Responder Sí/No por cada clip, con el pie de texto visible debajo. Si alguna respuesta es «No», anotar en observaciones y no publicar.

1. El clip ilustra lo que dice el pie de texto, sin agregar ni contradecir pasos.
2. La secuencia de acciones está en el orden correcto.
3. La posición de manos y del cuerpo es médicamente correcta (ver «Debe verse»).
4. No aparece ninguno de los errores de «No debe aparecer».
5. No hay texto, letras, números ni logos visibles.
6. No hay sangre explícita ni imágenes que asusten a un menor.
7. Docente y estudiantes son coherentes con los demás clips.
8. El ritmo es adecuado (se entiende cada paso).
9. No sugiere sustituir la llamada al 123 ni la atención médica.
10. Los puntos V1-V10 relacionados con el clip están resueltos.

Veredicto por clip: Aprobado / Aprobado con cambios / Rechazado.

---

## 6. Tabla de seguimiento

| Clip | Generado (fecha) | Versión elegida | Validado (sí/no, fecha) | Validador | Observaciones |
|---|---|---|---|---|---|
| PAS-1a | | | | | |
| PAS-1b | | | | | |
| PAS-2 | | | | | |
| PAS-3 | | | | | |
| REV-1a | | | | | |
| REV-1b | | | | | |
| REV-2 | | | | | |
| LAT-1a | | | | | |
| LAT-1b | | | | | |
| LAT-2 | | | | | |
| RCP-1 | | | | | |
| RCP-2 | | | | | |
| RCP-3a | | | | | |
| RCP-3b | | | | | |
| ATR-1 | | | | | |
| ATR-2 | | | | | |
| CON-1 | | | | | |
| CON-2 | | | | | |
| HER-1a | | | | | |
| HER-1b | | | | | |
| GOL-1 | | | | | |
| FRA-1a | | | | | |
| FRA-1b | | | | | |
| VEN-1 | | | | | |

---

## 7. Consejos de generación

- **Regenerar varias veces** (mínimo 3 o 4 intentos por clip) y elegir el que mejor cumpla «Debe verse». Veo varía mucho: no aceptar el primero.
- **Si salen letras, números o logos:** agregar al final del prompt `Absolutely no text of any kind; all signs, phone screens, boards and boxes are blank and plain.` y quitar del escenario lo que suele llevar letras (carteles, botiquín con cruz, tablero, dorsales). Si persiste, reencuadrar o regenerar.
- **Si se cuela el cliché de la curita o el botiquín:** repetir en `AVOID` y al final: `Never show any bandage, plaster or medical kit.` (salvo en HER-1a/HER-1b y FRA-1b, donde la gasa o el vendaje sí corresponden).
- **Consistencia de personajes:** pegar SIEMPRE las mismas descripciones de docente, ayudante y afectada (sección 1), sin cambiar ropa ni peinado. Si Veo admite imagen de referencia, generar primero una imagen de cada personaje y reutilizarla en todos los clips.
- **Posiciones delicadas** (RCP-1, ATR-2, LAT-1a/1b): si las manos o la postura salen mal, simplificar la escena (una sola docente, fondo liso) y describir el gesto en una frase corta; rechazar aunque se vea bonito.
- **Número exacto de personajes:** cada prompt dice cuántas personas salen; si aparecen de más, repetir `No extra people besides those listed.`
- **Formato:** generar en 9:16; si hace falta, una segunda versión 16:9 con el mismo prompt cambiando solo la relación de aspecto. 8 segundos; sin voz.
- **Exportar** en MP4. **Nombre de archivo = código del clip**, solo ASCII: `RCP-1.mp4`, `PAS-1a.mp4`, `RCP-1_16x9.mp4`. Guardar los intentos descartados en una carpeta aparte (`descartados/`).
- **Antes de publicar:** completar la tabla de seguimiento y obtener el visto bueno del validador clip por clip.
