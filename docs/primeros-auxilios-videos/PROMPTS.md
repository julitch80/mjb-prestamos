# Clips de primeros auxilios para Gemini (Veo): prompts y validacion

Fuente de contenido: `src/data/fichasAuxilios.ts` (guia Plena inclusion 2024, lectura facil; fichas 10-11 de la Cartilla de la Armada). Numero de emergencia: **123**.

Convencion: `(referencia externa: verificar con el validador)` marca todo dato medico que la ficha NO detalla. Nada de lo marcado contradice la ficha.

Flujo: Julian genera -> persona de salud valida con el checklist -> solo entonces se publica el clip en la app.

---

## 1. Ficha de estilo (copiar al inicio de CADA prompt)

```
STYLE: Flat 2D cartoon animation, simple clean shapes, soft pastel colors, clear bright even lighting. Setting: a simple Colombian school (plain classroom, patio with a basic concrete court, or hallway), minimal background detail. Characters: students wearing a generic plain school uniform (white polo shirt and navy pants/skirt, NO emblem or crest), and one adult teacher. Fixed camera or very minimal slow camera movement, medium shot, subject centered. ABSOLUTELY NO text, letters, numbers, logos, signs, captions or subtitles anywhere in the video (blank screens, blank phone display, blank whiteboard). No explicit blood or gore: injuries are only suggested with soft pale red patches. No spoken words or voices; only soft gentle ambient sound or silence. Calm, reassuring tone. Duration 8 seconds. Aspect ratio 9:16 vertical (alternative version: 16:9).
```

**Personajes fijos (describir SIEMPRE igual):**

- **Docente**: `Teacher: adult woman, about 40, medium brown skin, black hair tied in a low ponytail, round face, light green blouse, dark gray trousers, flat shoes, calm expression.`
- **Estudiante ayudante**: `Helper student: teenage boy, about 15, light brown skin, short black hair, white polo shirt and navy trousers, serious and calm face.`
- **Estudiante afectada**: `Affected student: teenage girl, about 15, tan skin, long dark brown braid, white polo shirt and navy skirt, black school shoes.`
- **Adulto afectado (solo clips RCP)**: `Affected person: adult man, about 35, medium skin, short black hair, white shirt and gray trousers.` (se usa un adulto para ser coherente con los 5 cm de la ficha).
- **Docente de brigada (solo VEN-1)**: `Brigade teacher: adult man, about 40, medium skin, short black hair, light blue polo shirt and gray trousers, calm expression.`

Cada prompt de abajo ya viene completo (ficha de estilo resumida + personajes + escena); si se prefiere, reemplazar la linea `STYLE:` por el bloque completo de arriba.

---

## 2. Clips

### Ficha 1: La regla PAS

#### PAS-1 Proteger
- **Ilustra** (ficha 1, paso 1): «Protegete a ti mismo o a ti misma... Protege a la victima de la emergencia. Alejala del peligro o eliminalo si puedes. Protege a otras personas para que no haya mas heridos.»
- **Prompt (EN):**
```
STYLE: Flat 2D cartoon animation, simple clean shapes, soft pastel colors, clear bright even lighting. Simple Colombian school hallway, minimal background. Fixed camera. NO text, letters, numbers, logos or subtitles anywhere. No blood. No spoken words, only soft ambient sound. Calm tone. 8 seconds, 9:16 vertical.
CHARACTERS: Teacher: adult woman, about 40, medium brown skin, black hair tied in a low ponytail, round face, light green blouse, dark gray trousers, flat shoes. Helper student: teenage boy, about 15, light brown skin, short black hair, white polo shirt and navy trousers. Affected student: teenage girl, about 15, tan skin, long dark brown braid, white polo shirt and navy skirt.
SCENE: In a school hallway, a girl sits on the floor next to a wet puddle and a fallen chair, looking uncomfortable. The teacher first looks around carefully to check the area is safe, then gently signals a group of students to step back away from the puddle, and moves the fallen chair out of the way. Only then she kneels beside the girl. Calm, orderly movement.
```
- **Debe verse:** la docente mira primero el entorno (se protege) -> aparta a otros estudiantes del peligro -> retira el peligro -> recien se acerca a la afectada. Peligro menor y claro (piso mojado, silla caida).
- **No debe aparecer:** docente corriendo hacia la victima sin mirar; estudiantes amontonados cerca del peligro; fuego, humo, violencia, sangre, senales con letras.
- **Pie (app):** «Protegete tu primero. Protege a la victima y a otras personas para que no haya mas heridos.»

#### PAS-2 Avisar
- **Ilustra** (ficha 1, paso 2): «Llama por telefono al numero 123... explica de forma clara que ha pasado y donde estas. Si no sabes la direccion exacta, explica que tienes cerca.»
- **Prompt (EN):**
```
STYLE: Flat 2D cartoon animation, simple clean shapes, soft pastel colors, clear bright even lighting. Simple Colombian school patio, minimal background. Fixed camera. NO text, letters, numbers, logos or subtitles anywhere; the phone screen is blank and plain with no digits. No blood. No spoken words, only soft ambient sound. 8 seconds, 9:16 vertical.
CHARACTERS: Teacher: adult woman, about 40, medium brown skin, black hair tied in a low ponytail, round face, light green blouse, dark gray trousers, flat shoes.
SCENE: The teacher stands calm in the school patio holding a smartphone to her ear with one hand. With the other hand she makes calm explanatory gestures: she points to a person sitting a few steps away, then points around her toward the school building and the basketball court as if describing where she is. She nods, listening. Relaxed but focused posture.
```
- **Debe verse:** celular al oido; gesto de explicar que paso (senala a la persona) y donde esta (senala alrededor); calma. Pantalla sin numeros.
- **No debe aparecer:** digitos o teclado legible; docente gritando o en panico; docente alejandose de la victima mientras llama.
- **Pie (app):** «Llama al 123. Explica de forma clara que ha pasado y donde estas. Si no sabes la direccion exacta, explica que tienes cerca.»

#### PAS-3 Socorrer
- **Ilustra** (ficha 1, paso 3): «Manten la calma y tranquiliza tambien a la victima. Dile que la ayuda esta de camino. No la muevas ni la cambies de sitio.»
- **Prompt (EN):**
```
STYLE: Flat 2D cartoon animation, simple clean shapes, soft pastel colors, clear bright even lighting. Simple Colombian school classroom, minimal background. Fixed camera. NO text, letters, numbers, logos or subtitles anywhere. No blood. No spoken words, only soft ambient sound. 8 seconds, 9:16 vertical.
CHARACTERS: Teacher: adult woman, about 40, medium brown skin, black hair tied in a low ponytail, round face, light green blouse, dark gray trousers, flat shoes. Affected student: teenage girl, about 15, tan skin, long dark brown braid, white polo shirt and navy skirt.
SCENE: The girl sits on the floor against a wall, looking scared. The teacher kneels at her side at eye level, places a hand gently on the girl's shoulder and speaks softly (mouth moves, no audible words). The girl's expression slowly relaxes. The teacher keeps the girl in the same place and does not lift or move her.
```
- **Debe verse:** docente arrodillada a la altura de la ninia; contacto suave en el hombro; expresion que pasa de miedo a calma; la ninia permanece donde esta.
- **No debe aparecer:** levantar, arrastrar o mover a la afectada; docente de pie mirando desde arriba; globos de dialogo con texto.
- **Pie (app):** «Manten la calma y tranquilizala: dile que la ayuda esta de camino. No la muevas ni la cambies de sitio.»

### Ficha 2: Revisar a la victima

#### REV-1 Comprobar si esta consciente
- **Ilustra** (ficha 2, paso 1): «Hablale cerca del oido. Preguntale "¿Me oyes?" o "¿Estas bien?"... Si no responde, pellizcale... Si no reacciona, sigue con el paso 2: comprobar la respiracion.»
- **Prompt (EN):**
```
STYLE: Flat 2D cartoon animation, simple clean shapes, soft pastel colors, clear bright even lighting. Simple Colombian school classroom floor, minimal background. Fixed camera. NO text, letters, numbers, logos or subtitles anywhere. No blood. No spoken words, only soft ambient sound. 8 seconds, 9:16 vertical.
CHARACTERS: Teacher: adult woman, about 40, medium brown skin, black hair tied in a low ponytail, round face, light green blouse, dark gray trousers, flat shoes. Affected student: teenage girl, about 15, tan skin, long dark brown braid, white polo shirt and navy skirt.
SCENE: The girl lies on her back on the floor with eyes closed, not moving. The teacher kneels beside her, leans close to her ear and speaks (mouth moves, no audible words) with a questioning expression. No reaction. Then the teacher gently pinches the girl's forearm with two fingers. Still no reaction; the teacher's face turns serious and her gaze moves to the girl's chest.
```
- **Debe verse:** hablar cerca del oido -> sin respuesta -> pellizco suave en el antebrazo -> sin reaccion -> la mirada pasa al pecho (siguiente paso: respiracion).
- **No debe aparecer:** sacudir con fuerza, golpear la cara, levantar a la persona; pellizco brusco; globos de dialogo con texto.
- **Pie (app):** «Hablale cerca del oido: "¿Me oyes?". Si no responde, pellizcale. Si no reacciona, comprueba la respiracion.»

#### REV-2 Comprobar la respiracion
- **Ilustra** (ficha 2, paso 2): «Mira si su pecho se mueve con la respiracion. Escucha si su boca o nariz toman y echan aire. Pon la mano sobre su pecho.»
- **Prompt (EN):**
```
STYLE: Flat 2D cartoon animation, simple clean shapes, soft pastel colors, clear bright even lighting. Simple Colombian school classroom floor, minimal background. Fixed side-view camera. NO text, letters, numbers, logos or subtitles anywhere. No blood. No spoken words, only soft ambient sound. 8 seconds, 9:16 vertical.
CHARACTERS: Teacher: adult woman, about 40, medium brown skin, black hair tied in a low ponytail, round face, light green blouse, dark gray trousers, flat shoes. Affected student: teenage girl, about 15, tan skin, long dark brown braid, white polo shirt and navy skirt.
SCENE: The girl lies on her back, eyes closed. The teacher kneels beside her and leans down so her ear is close to the girl's mouth and nose while her eyes look along the girl's chest. Then she rests one flat hand gently on the girl's chest. The girl's chest rises and falls slowly and visibly. The teacher looks attentive.
```
- **Debe verse:** ojos de la docente hacia el pecho + oido cerca de boca/nariz (mirar y escuchar) -> mano plana sobre el pecho. Pecho que sube y baja suavemente (ilustra la senal que se busca).
- **No debe aparecer:** mover la cabeza o el cuello de la persona; maniobras no incluidas en la ficha; cronometro o numeros.
- **Pie (app):** «Mira si su pecho se mueve, escucha si toma y echa aire y pon la mano sobre su pecho. Si respira: posicion lateral. Si no respira: reanimacion.»

### Ficha 3: Posicion lateral de seguridad

#### LAT-1 Preparar brazos y pierna
- **Ilustra** (ficha 3, «Los ocho pasos», pasos 1 a 5): «Arrodillate junto a la victima. Retira los objetos que puedan hacerle dano: gafas, llaves, movil. Dobla el brazo de la victima mas cercano a ti hacia arriba. Dobla su pierna mas alejada hacia ti. Dobla el otro brazo y pon su mano junto a su cabeza.»
- **Prompt (EN):**
```
STYLE: Flat 2D cartoon animation, simple clean shapes, soft pastel colors, clear bright even lighting. Simple Colombian school floor, minimal background. Fixed three-quarter high camera. NO text, letters, numbers, logos or subtitles anywhere. No blood. No spoken words, only soft ambient sound. 8 seconds, 9:16 vertical.
CHARACTERS: Teacher: adult woman, about 40, medium brown skin, black hair tied in a low ponytail, round face, light green blouse, dark gray trousers, flat shoes. Affected student: teenage girl, about 15, tan skin, long dark brown braid, white polo shirt and navy skirt.
SCENE: The girl lies on her back, eyes closed, unconscious but breathing. The teacher kneels at her side, removes the girl's glasses and sets them aside. Then she bends the girl's nearer arm up at the elbow, then bends the girl's far-side leg so the knee points up with the foot flat on the floor, then brings the girl's other arm so that her hand rests next to her head. Smooth, deliberate gestures.
```
- **Debe verse:** retirar objetos (gafas); brazo cercano doblado hacia arriba; pierna lejana flexionada con rodilla arriba; el otro brazo doblado con la mano junto a la cabeza (ficha). Docente siempre en el mismo lado.
- **No debe aparecer:** contexto de golpe fuerte en la espalda o accidente (la ficha lo excluye); miembros en angulos antinaturales; la ninia despierta o moviendose por su cuenta.
- **Pie (app):** «Retira objetos que puedan hacer dano. Dobla el brazo mas cercano hacia arriba, dobla la pierna mas alejada y pon la mano del otro brazo junto a su cabeza.»

#### LAT-2 Girar y dejar de lado
- **Ilustra** (ficha 3, pasos 6 a 8): «Cogele por la cadera y el hombro para girarlo despacio hacia ti. Manten la calma y llama al 123. Cambia a la persona de lado cada 20 minutos hasta que llegue la ayuda.»
- **Prompt (EN):**
```
STYLE: Flat 2D cartoon animation, simple clean shapes, soft pastel colors, clear bright even lighting. Simple Colombian school floor, minimal background. Fixed three-quarter camera. NO text, letters, numbers, logos or subtitles anywhere; phone screen blank. No blood. No spoken words, only soft ambient sound. 8 seconds, 9:16 vertical.
CHARACTERS: Teacher: adult woman, about 40, medium brown skin, black hair tied in a low ponytail, round face, light green blouse, dark gray trousers, flat shoes. Affected student: teenage girl, about 15, tan skin, long dark brown braid, white polo shirt and navy skirt.
SCENE: The girl lies on her back with the near arm bent up, far leg bent, other hand by her head. The teacher kneels at her side, holds the girl's far hip with one hand and her far shoulder with the other, and slowly rolls her toward herself onto her side until the girl rests stably with the top knee bent forward. The teacher glances at the girl's chest to see it moving, then takes a phone from her pocket (blank screen) and holds it to her ear.
```
- **Debe verse:** una mano en la cadera y otra en el hombro; giro lento hacia la docente; posicion final estable de lado con rodilla superior doblada al frente; cabeza ligeramente inclinada hacia atras para mantener la via aerea abierta (referencia externa: verificar con el validador); luego la docente llama.
- **No debe aparecer:** jalar de la ropa o de un brazo; giro brusco; girar la cabeza aparte del cuerpo.
- **Pie (app):** «Con una mano en la cadera y otra en el hombro, gira a la persona despacio hacia ti. Llama al 123 y cambia a la persona de lado cada 20 minutos.»

### Ficha 4: Reanimacion

#### RCP-1 Compresiones (reanimar los latidos)
- **Ilustra** (ficha 4, A): «Coloca a la victima tumbada hacia arriba. Ponte de rodillas junto a su pecho. Busca el punto que esta justo en el centro del pecho. Coloca tus manos entrelazadas... la zona mas dura de tu mano... Aprieta fuerte en ese punto 30 veces... unos 5 centimetros cada vez.»
- **Prompt (EN):**
```
STYLE: Flat 2D cartoon animation, simple clean shapes, soft pastel colors, clear bright even lighting. Simple Colombian school patio floor, minimal background. Fixed side-view camera. NO text, letters, numbers, logos or subtitles anywhere. No blood. No spoken words, only a soft steady rhythmic ambient beat. 8 seconds, 9:16 vertical.
CHARACTERS: Teacher: adult woman, about 40, medium brown skin, black hair tied in a low ponytail, round face, light green blouse, dark gray trousers, flat shoes. Affected person: adult man, about 35, medium skin, short black hair, white shirt and gray trousers.
SCENE: The man lies flat on his back on a firm floor, unconscious. The teacher kneels beside his chest. She places the heel of one hand on the center of his chest with her other hand on top, fingers interlocked and lifted off the chest. With straight locked elbows and shoulders directly above her hands she presses down rhythmically and quickly; the chest visibly sinks about 5 cm each time and fully rises back between presses. Steady fast rhythm, about two presses per second.
```
- **Debe verse:** persona de espaldas sobre superficie firme; docente de rodillas junto al pecho; talon de la mano (zona mas dura) en el centro del pecho; manos entrelazadas; codos rectos y hombros sobre las manos (referencia externa: verificar con el validador); hundimiento de unos 5 cm con recuperacion completa (ficha: 5 cm); ritmo rapido, unas 100-120 por minuto (referencia externa: verificar con el validador); manos sin cambiar de lugar.
- **No debe aparecer:** manos sobre el abdomen o la parte baja del esternon; codos doblados; presiones suaves o lentas; despegar las manos del pecho entre compresiones; sangre; contador numerico.
- **Pie (app):** «Manos entrelazadas en el centro del pecho. Aprieta fuerte 30 veces, hundiendo el pecho unos 5 centimetros cada vez.»

#### RCP-2 Dos respiraciones (recuperar la respiracion)
- **Ilustra** (ficha 4, B): «Abre su boca: pon una de tus manos en su frente y la otra en su barbilla. Tapa su nariz con tus dedos. Respira hondo. Pon tu boca y pegala a la de la victima... 2 veces... Comprueba que su pecho se mueve.»
- **Prompt (EN):**
```
STYLE: Flat 2D cartoon animation, simple clean shapes, soft pastel colors, clear bright even lighting. Simple Colombian school patio floor, minimal background. Fixed side-view camera. NO text, letters, numbers, logos or subtitles anywhere. No blood. No spoken words, only soft ambient sound. Neutral clinical cartoon tone. 8 seconds, 9:16 vertical.
CHARACTERS: Teacher: adult woman, about 40, medium brown skin, black hair tied in a low ponytail, round face, light green blouse, dark gray trousers, flat shoes. Affected person: adult man, about 35, medium skin, short black hair, white shirt and gray trousers.
SCENE: The man lies flat on his back, unconscious. The teacher kneels beside his head. She places one hand on his forehead and the other hand under his chin, gently tilting his head back so his mouth opens. With thumb and index finger of the forehead hand she pinches his nose closed. She takes a deep breath, seals her mouth over his mouth, and gives two separate breaths; after each breath his chest visibly rises and then falls as she lifts her head to breathe in again.
```
- **Debe verse:** una mano en la frente y otra en la barbilla; nariz tapada con los dedos; boca sellada sobre boca; dos soplos (ficha), de aproximadamente 1 s cada uno (referencia externa: verificar con el validador); el pecho sube con cada soplo (ficha: «comprueba que su pecho se mueve»); la docente suelta para tomar aire.
- **No debe aparecer:** soplar sin tapar la nariz; abdomen que se infla; mas de 2 soplos; flexionar el cuello hacia adelante; escena intima o ambigua (mantener tono clinico).
- **Pie (app):** «Una mano en la frente y otra en la barbilla, tapa su nariz, pega tu boca a la suya y sopla 2 veces. Comprueba que su pecho se mueve.»

#### RCP-3 Ciclo 30 + 2 hasta que llegue la ayuda
- **Ilustra** (ficha 4, C y aviso inicial): «Dos respiraciones y 30 apretones, y vuelta a empezar. Repite el ejercicio hasta que la persona respire o llegue la ayuda.» y «Antes de nada: llama al 123.» (ver punto V2 sobre el orden del ciclo)
- **Prompt (EN):**
```
STYLE: Flat 2D cartoon animation, simple clean shapes, soft pastel colors, clear bright even lighting. Simple Colombian school patio floor, minimal background. Fixed side-view camera. NO text, letters, numbers, logos or subtitles anywhere; phone screen blank. No blood. No spoken words, only soft ambient sound. 8 seconds, 9:16 vertical.
CHARACTERS: Teacher: adult woman, about 40, medium brown skin, black hair tied in a low ponytail, round face, light green blouse, dark gray trousers, flat shoes. Helper student: teenage boy, about 15, light brown skin, short black hair, white polo shirt and navy trousers. Affected person: adult man, about 35, medium skin, short black hair, white shirt and gray trousers.
SCENE: One continuous shot, fast cycle: the teacher does a short burst of chest compressions at the center of the man's chest (straight arms, interlocked hands), then moves to his head, tilts his head back, pinches his nose and gives two breaths (chest rises), then goes straight back to compressions. In the background the helper student stands with a phone to his ear (blank screen), and at the end points toward the school gate as if guiding arriving help. The cycle clearly repeats once.
```
- **Debe verse:** compresiones -> 2 respiraciones -> volver a comprimir (ciclo 30:2; referencia externa: verificar con el validador); sin pausas largas; un ayudante llamando y guiando a la ayuda (coherente con «antes de nada: llama al 123»); el ciclo se repite.
- **No debe aparecer:** detenerse a conversar; buscar pulso en el cuello; desfibrilador (la ficha no lo menciona: no inventarlo); numeros o cronometros.
- **Pie (app):** «Dos respiraciones y 30 apretones, y vuelta a empezar, hasta que la persona respire o llegue la ayuda. Antes de nada: llama al 123.»

### Ficha 5: Atragantamiento

#### ATR-1 Puede toser: animar a toser
- **Ilustra** (ficha 5): «Si NO respira bien, pero puede toser: anima a la persona a toser hasta que eche la comida... No le des golpes en la espalda.»
- **Prompt (EN):**
```
STYLE: Flat 2D cartoon animation, simple clean shapes, soft pastel colors, clear bright even lighting. Simple Colombian school cafeteria table, minimal background. Fixed camera. NO text, letters, numbers, logos or subtitles anywhere. No blood. No spoken words, only soft ambient sound. 8 seconds, 9:16 vertical.
CHARACTERS: Teacher: adult woman, about 40, medium brown skin, black hair tied in a low ponytail, round face, light green blouse, dark gray trousers, flat shoes. Affected student: teenage girl, about 15, tan skin, long dark brown braid, white polo shirt and navy skirt.
SCENE: At a cafeteria table the girl suddenly puts a hand to her throat and coughs hard, leaning slightly forward. The teacher stands beside her with her hands visible near her own chest, encouraging her with a calm nod and an open gesture toward coughing; she does NOT touch the girl's back. The girl keeps coughing until a small piece of food is expelled onto a napkin. The girl breathes, relieved.
```
- **Debe verse:** persona que tose con fuerza; docente a su lado, tranquila, animando; manos de la docente lejos de la espalda; expulsion de un trozo pequeno de comida; alivio.
- **No debe aparecer:** palmadas en la espalda; darle agua; meter los dedos en la boca; abrazarla por detras.
- **Pie (app):** «Si puede toser: animala a toser hasta que eche la comida. No le des golpes en la espalda.»

#### ATR-2 No respira ni puede toser: apretar debajo del pecho
- **Ilustra** (ficha 5): «Si NO respira nada, ni puede toser: intenta sacar la comida de su boca con tus manos. Intenta sacar la comida apretando debajo de su pecho.»
- **Prompt (EN):**
```
STYLE: Flat 2D cartoon animation, simple clean shapes, soft pastel colors, clear bright even lighting. Simple Colombian school cafeteria, minimal background. Fixed side-view camera. NO text, letters, numbers, logos or subtitles anywhere. No blood. No spoken words, only soft ambient sound. 8 seconds, 9:16 vertical.
CHARACTERS: Teacher: adult woman, about 40, medium brown skin, black hair tied in a low ponytail, round face, light green blouse, dark gray trousers, flat shoes. Affected student: teenage girl, about 15, tan skin, long dark brown braid, white polo shirt and navy skirt.
SCENE: The girl stands with both hands clutching her throat, mouth open, unable to cough or speak. The teacher stands behind her, wraps both arms around the girl's waist, makes a fist with one hand and places the thumb side of the fist on the girl's upper abdomen just above the navel and well below the breastbone, covers the fist with her other hand, and pulls sharply inward and upward in quick thrusts. A small piece of food pops out of the girl's mouth. The girl gasps and breathes.
```
- **Debe verse:** persona de pie con manos en la garganta (no puede toser ni hablar); docente detras con los brazos alrededor de la cintura; puno con el lado del pulgar contra el abdomen alto, por encima del ombligo y bien por debajo del esternon; empuje rapido hacia adentro y arriba (referencia externa: verificar con el validador; la ficha solo dice «apretando debajo de su pecho»); sale el objeto; respiracion restablecida.
- **No debe aparecer:** puno sobre el esternon o las costillas; apretar el cuello; golpes en la espalda en este clip (la ficha no los incluye; ver punto V1); dedos barriendo la boca; violencia excesiva.
- **Pie (app):** «Si no respira nada ni puede toser: intenta sacar la comida de su boca con tus manos o apretando debajo de su pecho. Llama al 123.»

### Ficha 6: Convulsiones

#### CON-1 Que hacer durante la convulsion
- **Ilustra** (ficha 6): «Tumba a la persona. Quita las cosas que se le puedan caer encima... No la sujetes. No le des agua ni comida. No la dejes sola.»
- **Prompt (EN):**
```
STYLE: Flat 2D cartoon animation, simple clean shapes, soft pastel colors, clear bright even lighting. Simple Colombian school classroom, minimal background. Fixed camera, slightly high angle. NO text, letters, numbers, logos or subtitles anywhere. No blood. No spoken words, only soft ambient sound. 8 seconds, 9:16 vertical.
CHARACTERS: Teacher: adult woman, about 40, medium brown skin, black hair tied in a low ponytail, round face, light green blouse, dark gray trousers, flat shoes. Helper student: teenage boy, about 15, light brown skin, short black hair, white polo shirt and navy trousers. Affected student: teenage girl, about 15, tan skin, long dark brown braid, white polo shirt and navy skirt.
SCENE: The girl lies on the classroom floor, her body making gentle stylized shaking movements (not violent or frightening). The teacher kneels beside her, calmly moves a chair and a backpack away so nothing can fall on or hurt the girl, and keeps her hands open and not holding the girl down. She stays right beside her the whole time. The helper student stands back at a distance, calm.
```
- **Debe verse:** persona tumbada en el suelo; movimientos estilizados y suaves; docente retira objetos cercanos; manos abiertas, sin sujetar; no la deja sola; sin comida, bebida ni objetos en la boca.
- **No debe aparecer:** sujetar brazos o piernas; objeto en la boca; dar agua; docente que se va; espuma, ojos en blanco o dramatismo excesivo; companeros asustados gritando.
- **Pie (app):** «Tumba a la persona y quita lo que pueda caerle encima. No la sujetes, no le des agua ni comida y no la dejes sola.»

#### CON-2 Al terminar: posicion lateral
- **Ilustra** (ficha 6): «Cuando no convulsione, colocala en Posicion Lateral de Seguridad.»
- **Prompt (EN):**
```
STYLE: Flat 2D cartoon animation, simple clean shapes, soft pastel colors, clear bright even lighting. Simple Colombian school classroom, minimal background. Fixed three-quarter camera. NO text, letters, numbers, logos or subtitles anywhere. No blood. No spoken words, only soft ambient sound. 8 seconds, 9:16 vertical.
CHARACTERS: Teacher: adult woman, about 40, medium brown skin, black hair tied in a low ponytail, round face, light green blouse, dark gray trousers, flat shoes. Affected student: teenage girl, about 15, tan skin, long dark brown braid, white polo shirt and navy skirt.
SCENE: The girl's body stops shaking and lies still on her back, breathing softly. Only then the teacher gently bends the girl's near arm and far knee and rolls her onto her side into a stable recovery position, top knee bent forward. The teacher stays beside her with a calming hand on her shoulder.
```
- **Debe verse:** los movimientos cesan antes de tocarla; luego giro suave a posicion lateral estable (igual que LAT-1/LAT-2); la docente se queda con ella.
- **No debe aparecer:** mover a la persona mientras aun convulsiona; sentarla o levantarla; irse.
- **Pie (app):** «Cuando no convulsione, colocala en Posicion Lateral de Seguridad y quedate con ella.»

### Ficha 7: Heridas

#### HER-1 Si sangra: apretar, lavar, tapar
- **Ilustra** (ficha 7, «Si la victima sangra»): «Aprieta la herida con una gasa limpia. Lava la herida con agua y jabon. Tapa la herida con otra gasa limpia.» Y «No eches alcohol.»
- **Prompt (EN):**
```
STYLE: Flat 2D cartoon animation, simple clean shapes, soft pastel colors, clear bright even lighting. Simple Colombian school classroom desk near a sink, minimal background. Fixed medium-close camera. NO text, letters, numbers, logos or subtitles anywhere (any first-aid kit has no markings). No blood. No spoken words, only soft ambient sound. 8 seconds, 9:16 vertical.
CHARACTERS: Teacher: adult woman, about 40, medium brown skin, black hair tied in a low ponytail, round face, light green blouse, dark gray trousers, flat shoes. Affected student: teenage girl, about 15, tan skin, long dark brown braid, white polo shirt and navy skirt.
SCENE: The girl sits on a chair holding out her forearm which shows a small cut suggested only by a soft pale red patch. The teacher, wearing clean disposable gloves, first presses a clean white gauze pad firmly on the wound. Then she gently washes the area under a small stream of water with soap. Then she covers the wound with a second clean white gauze pad and holds it in place. The girl looks calm.
```
- **Debe verse:** herida solo sugerida con mancha suave; gasa limpia presionando; lavado con agua y jabon; segunda gasa limpia cubriendo; guantes desechables (referencia externa: verificar con el validador).
- **No debe aparecer:** alcohol, agua oxigenada, polvos o remedios caseros; tocar la herida con las manos sin guantes; sangre explicita; botiquin con letras o cruz con texto.
- **Pie (app):** «Aprieta la herida con una gasa limpia, lavala con agua y jabon y tapala con otra gasa limpia. No eches alcohol.»

### Ficha 8: Golpes

#### GOL-1 Hielo y no mover
- **Ilustra** (ficha 8): «Poner hielo en la parte del cuerpo donde se ha dado el golpe. No mover la parte del cuerpo donde se ha dado el golpe.»
- **Prompt (EN):**
```
STYLE: Flat 2D cartoon animation, simple clean shapes, soft pastel colors, clear bright even lighting. Simple Colombian school patio bench, minimal background. Fixed camera. NO text, letters, numbers, logos or subtitles anywhere. No blood. No spoken words, only soft ambient sound. 8 seconds, 9:16 vertical.
CHARACTERS: Teacher: adult woman, about 40, medium brown skin, black hair tied in a low ponytail, round face, light green blouse, dark gray trousers, flat shoes. Affected student: teenage girl, about 15, tan skin, long dark brown braid, white polo shirt and navy skirt.
SCENE: The girl sits on a bench with her knee slightly bruised (a soft purple patch) after a fall. The teacher brings an ice pack wrapped in a cloth and places it gently on the knee, holding it there. The girl's leg stays still and supported; the teacher signals with a calm open palm "stay still" (no words). The girl nods.
```
- **Debe verse:** bolsa de hielo envuelta en tela sobre la zona golpeada (la ficha 10 pide envolverlo; ver V6); la parte del cuerpo queda quieta; la docente indica que no la mueva.
- **No debe aparecer:** masajes; mover o flexionar la rodilla; hielo directo sobre la piel; la victima caminando.
- **Pie (app):** «Pon hielo en la parte del cuerpo donde se dio el golpe. No muevas esa parte del cuerpo.»

### Ficha 10: Golpes en huesos y articulaciones

#### FRA-1 Esguince: hielo, vendaje no apretado, elevar
- **Ilustra** (ficha 10, «Primeros auxilios de un esguince»): «Aplicar hielo... envolviendo el hielo en un pedazo de tela y evitando aplicarlo directamente sobre la piel... un vendaje firme pero no apretado... Mantener elevada la articulacion inflamada por encima del nivel del corazon... Dejar en reposo.»
- **Prompt (EN):**
```
STYLE: Flat 2D cartoon animation, simple clean shapes, soft pastel colors, clear bright even lighting. Simple Colombian school classroom corner, minimal background. Fixed side-view camera. NO text, letters, numbers, logos or subtitles anywhere. No blood. No spoken words, only soft ambient sound. 8 seconds, 9:16 vertical.
CHARACTERS: Teacher: adult woman, about 40, medium brown skin, black hair tied in a low ponytail, round face, light green blouse, dark gray trousers, flat shoes. Affected student: teenage girl, about 15, tan skin, long dark brown braid, white polo shirt and navy skirt.
SCENE: The girl lies reclining on a bench with her ankle slightly swollen (soft rounded shape and pale purple patch). The teacher wraps ice cubes in a piece of cloth and holds it on the ankle (never directly on skin), then wraps a firm but loose elastic bandage around the ankle and foot leaving the toes uncovered, then rests the girl's foot up on a stack of backpacks and a cushion so the ankle is raised higher than the girl's heart level. The girl rests quietly.
```
- **Debe verse:** hielo envuelto en tela; vendaje firme pero no apretado con los dedos del pie visibles; pie elevado por encima del nivel del corazon (persona recostada); reposo.
- **No debe aparecer:** hielo directo sobre la piel; vendaje muy apretado o que cubra los dedos; masaje o pomadas; intentar acomodar el hueso; la persona caminando; pastillas (la ficha las omitio a proposito).
- **Pie (app):** «Hielo envuelto en tela (no directo sobre la piel), vendaje firme pero no apretado, articulacion elevada por encima del corazon y en reposo.»

### Ficha 11: Vendajes e inmovilizacion (solo brigada)

#### VEN-1 Cabestrillo improvisado
- **Ilustra** (ficha 11, «Cabestrillo improvisado»): «Se coloca el brazo sobre el pecho, con la mano hacia el hombro contrario a la lesion (o... con la mano mas alta que el codo). Se compone con lo que se tenga a la mano: panoleta, cinturon, corbata o camisa.»
- **Prompt (EN):**
```
STYLE: Flat 2D cartoon animation, simple clean shapes, soft pastel colors, clear bright even lighting. Simple Colombian school classroom, minimal background. Fixed front camera. NO text, letters, numbers, logos or subtitles anywhere. No blood. No spoken words, only soft ambient sound. 8 seconds, 9:16 vertical.
CHARACTERS: Brigade teacher: adult man, about 40, medium skin, short black hair, light blue polo shirt and gray trousers, calm expression. Affected student: teenage girl, about 15, tan skin, long dark brown braid, white polo shirt and navy skirt.
SCENE: The girl sits holding her injured forearm against her chest, hand toward the opposite shoulder, wincing slightly. The brigade teacher takes a large plain triangular cloth (a scarf), slides it under her forearm like a hammock and ties the two ends at the side of her neck, so the forearm rests across her chest with the hand slightly higher than the elbow. The fingers remain visible and uncovered. The girl nods, relieved.
```
- **Debe verse:** antebrazo sobre el pecho; mano hacia el hombro contrario o mano mas alta que el codo (ficha); tela triangular tipo hamaca bajo el antebrazo con nudo al costado del cuello (referencia externa: verificar con el validador); dedos visibles.
- **No debe aparecer:** nudo sobre la nuca o columna; nudo muy apretado; mano mas baja que el codo; intento de acomodar el hueso.
- **Pie (app):** «Brazo sobre el pecho, mano hacia el hombro contrario (o mano mas alta que el codo). Se arma con lo que haya a la mano: panoleta, cinturon, corbata o camisa. Solo brigada.»

---

## 3. Resumen de clips por ficha

| Ficha | Clips | Cantidad |
|---|---|---|
| 1 La regla PAS | PAS-1, PAS-2, PAS-3 | 3 |
| 2 Revisar a la victima | REV-1, REV-2 | 2 |
| 3 Posicion lateral | LAT-1, LAT-2 | 2 |
| 4 Reanimacion | RCP-1, RCP-2, RCP-3 | 3 |
| 5 Atragantamiento | ATR-1, ATR-2 | 2 |
| 6 Convulsiones | CON-1, CON-2 | 2 |
| 7 Heridas | HER-1 | 1 |
| 8 Golpes | GOL-1 | 1 |
| 9 Que son los primeros auxilios | sin clip (texto para leer con calma) | 0 |
| 10 Huesos y articulaciones | FRA-1 | 1 |
| 11 Vendajes (brigada) | VEN-1 | 1 |
| **Total** | | **18** |

---

## 4. Puntos a consultar con el validador

- **V1 Atragantamiento (ficha 5):** la ficha dice que NO se den golpes en la espalda si la persona puede toser, y para quien no respira ni tose dice «apretando debajo de su pecho». Muchas guias vigentes indican, cuando la tos es inefectiva, 5 golpes en la espalda (entre los omoplatos) seguidos de compresiones abdominales (con tecnica adaptada en embarazadas, personas con obesidad y ninos pequenos). Los clips siguen la ficha. Decidir si se agrega esa secuencia a la ficha y al clip. Ya lo senala `NOTAS_REVISION`. Tampoco dice que hacer si la persona queda inconsciente (iniciar reanimacion).
- **V2 Orden del ciclo de reanimacion (ficha 4):** los pasos van A) 30 compresiones, B) 2 respiraciones, pero el ciclo se enuncia empezando por «dos respiraciones». Las guias vigentes inician con compresiones (30:2). RCP-3 muestra compresiones primero. Ya lo senala `NOTAS_REVISION`.
- **V3 Profundidad y frecuencia segun edad:** la ficha dice «unos 5 centimetros» (adulto) y no da frecuencia (referencia externa: 100-120 por minuto). En menores las guias hablan de aproximadamente un tercio del grosor del torax. Los clips usan un adulto afectado. Confirmar si hace falta un clip aparte para estudiantes.
- **V4 Respiraciones de rescate:** la ficha pide 2 respiraciones boca a boca. Las guias vigentes admiten RCP solo con compresiones para quien no esta entrenado o no tiene barrera de proteccion. Decidir el criterio institucional; los clips siguen la ficha (sin barrera).
- **V5 Posicion lateral:** la ficha dice cambiar de lado cada 20 minutos (otras guias hablan de 30). No detalla la inclinacion final de la cabeza (LAT-2 usa referencia externa). Verificar. Ademas, la ficha excluye el uso tras golpe fuerte en la espalda sin dar alternativa; conviene un aviso visible junto a LAT-1/LAT-2 en la app.
- **V6 Hielo directo vs envuelto:** la ficha 8 dice «poner hielo» sin envolver; la ficha 10 pide envolverlo en tela. Los clips lo envuelven siempre. Unificar la redaccion de la ficha 8.
- **V7 Heridas:** la ficha manda apretar con gasa, lavar con agua y jabon y tapar, y a la vez dice «no toques la herida». Para sangrado importante, las guias indican presion directa continua sin levantar la gasa y lavar solo cuando se controle. HER-1 sigue el orden de la ficha; validar si aplica solo a heridas pequenas.
- **V8 Convulsiones:** la ficha dice «unas 5 minutos» de duracion y marca llamar al 123 en general. Guias vigentes: llamar si dura mas de 5 minutos, si es la primera vez, si hay lesion o si no recupera la consciencia. Es un tema de texto, no del clip.
- **V9 Consciencia:** la ficha usa el pellizco; algunas guias prefieren tocar o sacudir suavemente los hombros. Confirmar si REV-1 debe mostrar el pellizco (lo que hace ahora) o el toque en los hombros.

---

## 5. Checklist de validacion (persona de salud)

Responder Si/No por cada clip, con el pie de texto visible debajo. Si alguna respuesta es «No», anotar en observaciones y no publicar.

1. El clip ilustra lo que dice el pie de texto, sin agregar ni contradecir pasos.
2. La secuencia de acciones esta en el orden correcto.
3. La posicion de manos y del cuerpo es medicamente correcta (ver «Debe verse»).
4. No aparece ninguno de los errores de «No debe aparecer».
5. No hay texto, letras, numeros ni logos visibles.
6. No hay sangre explicita ni imagenes que asusten a un menor.
7. Docente y estudiantes son coherentes con los demas clips.
8. El ritmo es adecuado (se entiende cada paso).
9. No sugiere sustituir la llamada al 123 ni la atencion medica.
10. Los puntos V1-V9 relacionados con el clip estan resueltos.

Veredicto por clip: Aprobado / Aprobado con cambios / Rechazado.

---

## 6. Tabla de seguimiento

| Clip | Generado (fecha) | Version elegida | Validado (si/no, fecha) | Validador | Observaciones |
|---|---|---|---|---|---|
| PAS-1 | | | | | |
| PAS-2 | | | | | |
| PAS-3 | | | | | |
| REV-1 | | | | | |
| REV-2 | | | | | |
| LAT-1 | | | | | |
| LAT-2 | | | | | |
| RCP-1 | | | | | |
| RCP-2 | | | | | |
| RCP-3 | | | | | |
| ATR-1 | | | | | |
| ATR-2 | | | | | |
| CON-1 | | | | | |
| CON-2 | | | | | |
| HER-1 | | | | | |
| GOL-1 | | | | | |
| FRA-1 | | | | | |
| VEN-1 | | | | | |

---

## 7. Consejos de generacion

- **Regenerar varias veces** (minimo 3 o 4 intentos por clip) y elegir el que mejor cumpla «Debe verse». Veo varia mucho: no aceptar el primero.
- **Si salen letras, numeros o logos:** agregar al final del prompt `Absolutely no text of any kind; all signs, phone screens, boards and boxes are blank and plain.` y quitar del escenario lo que suele llevar letras (carteles, botiquin con cruz, tablero, dorsales). Si persiste, reencuadrar o regenerar.
- **Consistencia de personajes:** pegar SIEMPRE las mismas descripciones de docente, ayudante y afectada (seccion 1), sin cambiar ropa ni peinado. Si Veo admite imagen de referencia, generar primero una imagen de cada personaje y reutilizarla en todos los clips.
- **Posiciones delicadas** (RCP-1, ATR-2, LAT-1): si las manos o la postura salen mal, simplificar la escena (una sola docente, fondo liso) y describir el gesto en una frase corta; rechazar aunque se vea bonito.
- **Formato:** generar en 9:16; si hace falta, una segunda version 16:9 con el mismo prompt cambiando solo la relacion de aspecto. 8 segundos; sin voz.
- **Exportar** en MP4. **Nombre de archivo = codigo del clip**, solo ASCII: `RCP-1.mp4`, `RCP-1_16x9.mp4`. Guardar los intentos descartados en una carpeta aparte (`descartados/`).
- **Antes de publicar:** completar la tabla de seguimiento y obtener el visto bueno del validador clip por clip.
