# Fotos de la brigada — kit de inmovilización

Guía sin tecnicismos de qué falta, dónde ponerlo y cómo agregarlo a la app.

## 1. Qué fotos hacen falta

El colegio ya tiene el kit inmovilizador de cartonplast (5 piezas). Falta
que la brigada tome una foto por cada pieza, aplicándola, para que quede
como referencia visual en la ficha 11 (Vendajes e inmovilización — solo
brigada):

1. Pierna
2. Tobillo
3. Brazo
4. Muñeca
5. Cuello

**Muy importante — que NO salgan caras de estudiantes.** En la foto deben
verse las manos del brigadista y el material (la pieza puesta), no la cara
de la persona a la que se le está practicando. Si el kit se prueba sobre
un compañero, encuadra la foto para que la cara quede fuera, o pídele que
mire hacia otro lado.

## 2. Dónde dejar las fotos

Pon las fotos originales (las que salen directo del celular, sin editar)
en una carpeta llamada `fotos-origen` dentro de la carpeta del proyecto
(`mjb-prestamos/fotos-origen/`). Si esa carpeta no existe, créala.

No hace falta que les cambies el nombre ni que las edites — eso lo hace el
script del siguiente paso.

## 3. Cómo correr el script que las deja listas

El script las redimensiona, las orienta bien y les borra la ubicación GPS
oculta que llevan las fotos de celular (importante: esa ubicación
identificaría dónde queda el colegio si alguien la mirara).

Abre una terminal en la carpeta del proyecto y ejecuta:

```
python scripts/optimizar-fotos-brigada.py
```

Eso lee todo lo que haya en `fotos-origen/` y deja las fotos ya listas en
`public/fotos-brigada/`, con nombres simples (minúsculas, sin tildes ni
espacios — por ejemplo `pierna.jpg`, `cuello.jpg`).

Al terminar, el script te dice cuánto pesa cada foto y el total. Si algo
sale con una advertencia (⚠️) de que pesa más de lo recomendado, avísame y
lo ajustamos — esas fotos quedan guardadas en el celular para que la app
funcione sin señal, así que no conviene que pesen mucho.

Si quieres usar otra carpeta de origen en vez de `fotos-origen/`, pásala
como argumento:

```
python scripts/optimizar-fotos-brigada.py otra-carpeta
```

## 4. Cómo agregar la foto a la ficha (esto lo hago yo, pero por si quieres verlo)

Una vez la foto ya está en `public/fotos-brigada/` con su nombre final
(ejemplo: `pierna.jpg`), se agrega un bloque nuevo dentro de la ficha 11,
en el archivo `src/data/fichasAuxilios.ts`. Es un objeto como este, que se
suma a la lista de `bloques` de esa ficha:

```ts
{
  tipo: 'foto',
  foto: 'pierna.jpg',
  pie: 'Brigadista aplicando la pieza de pierna del kit de inmovilización.',
},
```

- `foto`: el nombre exacto del archivo que dejó el script en
  `public/fotos-brigada/`.
- `pie`: el texto que aparece debajo de la imagen (también se usa como
  descripción para lectores de pantalla).

Se repite un bloque de estos por cada pieza fotografiada. Cuando tengas
las fotos listas, dímelo y yo agrego los bloques — no hace falta que
edites el archivo tú mismo.
