# -*- coding: utf-8 -*-
"""Genera los iconos de la aplicacion instalada a partir de la flor de lis.

SOLO afecta al icono de instalacion: lanzador de Android, iOS, escritorio y
pestana del navegador. El escudo de dentro de la aplicacion es otro archivo
(public/mjb_escudo.png) y no se toca.

Uso:  py -3 scripts/generar-iconos.py arte/flor-de-lis.png

Por que se compone aqui y no se reescala una imagen ya hecha:
  - El rojo tiene que llegar A SANGRE, hasta el canto. Asi, recorte lo que
    recorte el lanzador —circulo, cuadrado redondeado, gota— el filo siempre
    es rojo y el corte no se nota. Un marco pintado a cierta distancia del
    borde delata que hay una forma debajo siendo recortada.
  - Componerlo permite mover el grosor del rojo y el tamano de la flor sin
    volver a pedirle nada a un generador de imagenes.
"""
import os
import sys
from PIL import Image, ImageDraw

DESTINO = 'public/icons'
V = 'v3'

# CADA ICONO SE ESCRIBE DOS VECES: con sufijo de version y sin el. No es
# descuido, es una reparacion.
#
# El service worker PRECACHEA manifest.webmanifest. Al renombrar los iconos y
# borrar los antiguos, los telefonos que ya tenian la aplicacion siguieron
# leyendo el manifiesto viejo desde su cache, con URLs que pasaron a dar 404.
# Chrome no encontraba ni un icono valido, declaraba la aplicacion NO
# instalable, y ofrecia solo "crear acceso directo" con un cuadrito gris.
#
# Mientras pueda quedar un manifiesto viejo cacheado en algun telefono, sus
# URLs tienen que seguir respondiendo. Publicar el dibujo nuevo bajo los dos
# nombres repara a quien esta atascado y de paso le entrega el icono nuevo.

# Degradado diagonal, muestreado del arte que aprobo Julian: verde abajo a la
# izquierda, aguamarina en medio, azul solo arriba a la derecha.
GRAD = [(0.0, (18, 126, 72)), (0.68, (42, 158, 140)), (1.0, (54, 132, 181))]
ROJO = (196, 34, 47, 255)

# Geometria UNICA para 'any' y 'maskable'. Antes eran distintas y el icono se
# veia de dos maneras segun que variante eligiera cada lanzador.
#
# El 18% de rojo no es gusto, es geometria: un lanzador circular recorta un
# circulo de radio 0.40 del centro, y para que ese circulo caiga entero sobre
# rojo, la esquina mas lejana del interior redondeado debe quedar dentro:
#
#     raiz(2) * (0.5 - INSET - RADIO) + RADIO <= 0.40
#
# Con RADIO 0.145: 0.16 da 0.4208 y 0.17 da 0.4066 — en ambos ASOMA el
# degradado por las diagonales. 0.18 da 0.3925 y entra. Si se cambia el
# redondeo hay que rehacer la cuenta: al bajarlo de 0.20 a 0.145 el 16% que
# antes valia dejo de valer, sin que nada fallara ni avisara.
INSET = 0.18
RADIO = 0.145
ALTO_FLOR = 0.52


def guardar(im, nombre_versionado):
    """Escribe el icono con sufijo de version y tambien sin el (ver arriba)."""
    im.save('%s/%s' % (DESTINO, nombre_versionado))
    im.save('%s/%s' % (DESTINO, nombre_versionado.replace('-%s.png' % V, '.png')))


def fondo_degradado(lado):
    """Degradado diagonal calculado, no copiado de ningun JPEG."""
    im = Image.new('RGB', (lado, lado))
    px = im.load()
    for y in range(lado):
        for x in range(lado):
            t = (x / max(1, lado - 1) + (1 - y / max(1, lado - 1))) / 2
            for i in range(len(GRAD) - 1):
                t0, c0 = GRAD[i]
                t1, c1 = GRAD[i + 1]
                if t <= t1 or i == len(GRAD) - 2:
                    k = 0.0 if t1 == t0 else max(0.0, min(1.0, (t - t0) / (t1 - t0)))
                    px[x, y] = tuple(int(c0[j] + (c1[j] - c0[j]) * k) for j in range(3))
                    break
    return im.convert('RGBA')


def componer(flor, lado, marco=True, alto_flor=ALTO_FLOR):
    """Rojo a sangre + interior con degradado + flor de lis centrada."""
    if marco:
        lienzo = Image.new('RGBA', (lado, lado), ROJO)
        borde = int(lado * INSET)
        mascara = Image.new('L', (lado, lado), 0)
        ImageDraw.Draw(mascara).rounded_rectangle(
            [borde, borde, lado - borde - 1, lado - borde - 1],
            radius=int(lado * RADIO), fill=255,
        )
        lienzo.paste(fondo_degradado(lado), (0, 0), mascara)
    else:
        # A 16 px el marco es un pixel suelto que solo ensucia.
        lienzo = fondo_degradado(lado)

    alto = int(lado * alto_flor)
    ancho = max(1, int(flor.width * alto / flor.height))
    f = flor.resize((ancho, alto), Image.LANCZOS)
    lienzo.paste(f, ((lado - ancho) // 2, (lado - alto) // 2), f)
    return lienzo


def main():
    if len(sys.argv) < 2:
        print('Falta el arte. Ej: py -3 scripts/generar-iconos.py arte/flor-de-lis.png')
        return 1
    flor = Image.open(sys.argv[1]).convert('RGBA')
    print('arte: %s  %dx%d' % (sys.argv[1], flor.width, flor.height))
    os.makedirs(DESTINO, exist_ok=True)

    for lado in (192, 512):
        icono = componer(flor, lado)
        guardar(icono, 'icon-%d-%s.png' % (lado, V))
        # 'any' y 'maskable' son el MISMO dibujo: misma geometria, y asi se ve
        # igual elija el lanzador la variante que elija.
        guardar(icono, 'icon-maskable-%d-%s.png' % (lado, V))
    guardar(componer(flor, 180), 'apple-touch-icon-%s.png' % V)
    for lado in (16, 32, 48):
        guardar(componer(flor, lado, marco=False, alto_flor=0.80),
                'favicon-%d-%s.png' % (lado, V))

    for f in sorted(os.listdir(DESTINO)):
        ruta = '%s/%s' % (DESTINO, f)
        print('  %-26s %dx%d  %d KB' % (
            f, Image.open(ruta).size[0], Image.open(ruta).size[1],
            os.path.getsize(ruta) // 1024))
    return 0


if __name__ == '__main__':
    sys.exit(main())
