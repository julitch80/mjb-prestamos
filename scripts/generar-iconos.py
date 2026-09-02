# -*- coding: utf-8 -*-
"""Genera todos los iconos de la PWA a partir de UNA imagen fuente.

Por que existe este script y no se recortan a mano:
  - Android usa iconos "maskable": recorta el icono a la forma que use el
    lanzador (circulo, cuadrado redondeado, gota). Da por hecho que lo
    importante cabe en el 80% central. Un escudo a sangre, sin margen, sale
    aplastado y con los bordes cortados — que es justo lo que se veia.
  - El favicon del navegador tiene que ser CUADRADO. Una imagen 453x528 no lo
    es, y Chrome la descarta y pinta la primera letra del titulo. Esa era la
    "m" del computador.
  - El manifiesto declaraba 192x192 y 512x512 apuntando al mismo archivo de
    699x796. Mentir en `sizes` hace que el navegador elija mal.

Uso:  py -3 scripts/generar-iconos.py public/mjb_hd.png
"""
import sys, os
from PIL import Image

DESTINO = 'public/icons'
# Fondo del icono enmascarado. Blanco y no el gris casi negro del tema: el
# escudo es a color y esta pensado para fondo claro; sobre negro pierde
# contorno en los lanzadores que recortan en circulo.
FONDO_MASKABLE = (255, 255, 255, 255)


def cuadrar(im, lado, fondo=None, margen=0.0):
    """Encaja `im` centrada en un lienzo cuadrado de `lado` px.

    `margen` es la fraccion de lado que queda libre a cada lado. Para los
    iconos enmascarados va en 0.10 (10% por lado = el contenido ocupa el 80%
    central, la zona segura que Android promete no recortar).
    """
    util = int(lado * (1 - 2 * margen))
    copia = im.copy()
    copia.thumbnail((util, util), Image.LANCZOS)
    lienzo = Image.new('RGBA', (lado, lado), fondo if fondo else (0, 0, 0, 0))
    lienzo.paste(copia, ((lado - copia.width) // 2, (lado - copia.height) // 2), copia)
    return lienzo


def main():
    if len(sys.argv) < 2:
        print('Falta la imagen fuente. Ej: py -3 scripts/generar-iconos.py public/mjb_hd.png')
        return 1
    origen = sys.argv[1]
    im = Image.open(origen).convert('RGBA')
    print('fuente: %s  %sx%s' % (origen, im.width, im.height))
    os.makedirs(DESTINO, exist_ok=True)

    # 'any': sin margen y con transparencia. El sistema lo pinta tal cual.
    for lado in (192, 512):
        cuadrar(im, lado).save('%s/icon-%d.png' % (DESTINO, lado))
    # 'maskable': con zona segura y fondo solido, para que el recorte del
    # lanzador se vea intencionado y no un accidente.
    for lado in (192, 512):
        cuadrar(im, lado, FONDO_MASKABLE, margen=0.10).save(
            '%s/icon-maskable-%d.png' % (DESTINO, lado))
    # Favicon y iOS: cuadrados y con fondo, que a 16 px la transparencia se
    # confunde con el color de la pestana.
    cuadrar(im, 180, FONDO_MASKABLE, margen=0.06).save('%s/apple-touch-icon.png' % DESTINO)
    for lado in (16, 32, 48):
        cuadrar(im, lado, FONDO_MASKABLE, margen=0.04).save('%s/favicon-%d.png' % (DESTINO, lado))

    for f in sorted(os.listdir(DESTINO)):
        ruta = '%s/%s' % (DESTINO, f)
        print('  %-26s %s  %d KB' % (f, '%dx%d' % Image.open(ruta).size, os.path.getsize(ruta) // 1024))
    return 0


if __name__ == '__main__':
    sys.exit(main())
