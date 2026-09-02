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
      py -3 scripts/generar-iconos.py arte.png --aro       (verde a sangre + aro rojo)
      py -3 scripts/generar-iconos.py baldosa.png --baldosa (arte ya disenado entero)
"""
import sys, os
from PIL import Image, ImageDraw, ImageFilter

DESTINO = 'public/icons'
# Se sube al cambiar el dibujo. Los nombres viajan al manifiesto y al HTML:
# renombrar es la unica forma segura de que nadie sirva el icono anterior.
V = 'v3'
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


# Colores institucionales, tomados del icono que eligio Julian.
VERDE = (21, 138, 76, 255)
ROJO = (206, 33, 51, 255)


def componer_con_aro(arte, lado, margen_arte=0.22):
    """Icono a sangre: verde hasta el borde y aro rojo POR DENTRO.

    Julian eligio conservar los tres colores institucionales, pero el marco
    rojo no puede ir pegado al borde: ahi es lo primero que se come el
    recorte del lanzador, y en uno circular desaparece entero por los lados.
    Metido hacia adentro, dentro de la zona segura, sobrevive a cualquier
    forma y ademas se lee mejor en pequeno.

    El fondo va a SANGRE a proposito: las esquinas redondeadas las pone el
    sistema. Pintarlas dentro de la imagen es lo que producia esquinas con
    doble corte.
    """
    lienzo = Image.new('RGBA', (lado, lado), VERDE)
    dib = ImageDraw.Draw(lienzo)
    # El aro se apoya justo dentro del 80% central que Android promete no
    # recortar. El grosor escala con el lado para que no se afine al reducir.
    inset = int(lado * 0.115)
    grosor = max(2, int(lado * 0.035))
    radio = int(lado * 0.22)
    dib.rounded_rectangle(
        [inset, inset, lado - inset - 1, lado - inset - 1],
        radius=radio, outline=ROJO, width=grosor,
    )
    # El arte, centrado y por dentro del aro.
    util = int(lado * (1 - 2 * margen_arte))
    copia = arte.copy()
    copia.thumbnail((util, util), Image.LANCZOS)
    lienzo.paste(copia, ((lado - copia.width) // 2, (lado - copia.height) // 2), copia)
    return lienzo


def desde_baldosa(baldosa, lado, encoge=1.0):
    """Icono a partir de una baldosa ya disenada (fondo + marco + figura).

    Con `encoge` < 1 la baldosa se reduce y alrededor va un degradado
    SINTETICO construido interpolando los cuatro colores de esquina de la
    propia baldosa. Es el tercer intento y el unico limpio: rellenar con una
    copia desenfocada dejaba ver un cuadro dentro de otro, y estirar la fila
    del borde producia bandas. Un degradado calculado no tiene costura
    posible, porque no copia nada.

    Por que hace falta encoger: un lanzador circular recorta un circulo de
    diametro 80% del icono. Las ESQUINAS de un marco cuadrado puesto al 12%
    del borde caen fuera de ese circulo, y el marco se veria cortado en las
    cuatro. Encogiendo el conjunto, entra entero.
    """
    if encoge >= 1.0:
        return baldosa.resize((lado, lado), Image.LANCZOS).convert('RGBA')

    rgb = baldosa.convert('RGB')
    b = rgb.width - 1
    esquinas = Image.new('RGB', (2, 2))
    esquinas.putpixel((0, 0), rgb.getpixel((0, 0)))
    esquinas.putpixel((1, 0), rgb.getpixel((b, 0)))
    esquinas.putpixel((0, 1), rgb.getpixel((0, b)))
    esquinas.putpixel((1, 1), rgb.getpixel((b, b)))
    lienzo = esquinas.resize((lado, lado), Image.BICUBIC).convert('RGBA')

    util = int(lado * encoge)
    off = (lado - util) // 2
    frente = baldosa.resize((util, util), Image.LANCZOS).convert('RGBA')

    # La baldosa se funde en el degradado por los bordes en vez de pegarse con
    # canto duro: si no, se adivina el contorno del cuadrado interior. El
    # fundido solo come el 8% exterior, que es fondo liso; el marco rojo esta
    # al 12% hacia adentro y no lo toca.
    difuminado = max(1, int(util * 0.08))
    mascara = Image.new('L', (util, util), 0)
    ImageDraw.Draw(mascara).rectangle(
        [difuminado, difuminado, util - difuminado - 1, util - difuminado - 1], fill=255)
    mascara = mascara.filter(ImageFilter.GaussianBlur(radius=difuminado * 0.7))

    lienzo.paste(frente, (off, off), mascara)
    return lienzo


# Degradado diagonal del icono, muestreado del arte que aprobo Julian:
# verde abajo-izquierda, aguamarina en medio, azul solo arriba-derecha.
GRAD = [(0.0, (18, 126, 72)), (0.68, (42, 158, 140)), (1.0, (54, 132, 181))]
ROJO_MARCO = (196, 34, 47, 255)


def fondo_degradado(lado):
    """Degradado diagonal calculado, no copiado.

    Se genera en vez de reescalar el JPEG original por dos razones: no arrastra
    los artefactos de compresion, y permite componer el icono a cualquier
    proporcion sin que el marco quede donde lo puso el generador de imagenes.
    """
    im = Image.new('RGB', (lado, lado))
    px = im.load()
    for y in range(lado):
        for x in range(lado):
            # Posicion sobre la diagonal inferior-izquierda -> superior-derecha.
            t = (x / (lado - 1) + (1 - y / (lado - 1))) / 2
            for i in range(len(GRAD) - 1):
                t0, c0 = GRAD[i]
                t1, c1 = GRAD[i + 1]
                if t <= t1 or i == len(GRAD) - 2:
                    k = 0.0 if t1 == t0 else max(0.0, min(1.0, (t - t0) / (t1 - t0)))
                    px[x, y] = tuple(int(c0[j] + (c1[j] - c0[j]) * k) for j in range(3))
                    break
    return im.convert('RGBA')


def componer_icono(flor, lado, inset=0.18, alto_flor=0.52, marco=True, radio=0.145):
    """Arma el icono: ROJO A SANGRE + interior con degradado + flor de lis.

    La idea es de Julian y es la correcta: el rojo no es un marco dibujado
    dentro del icono, es el FONDO, y llega hasta el canto. Asi, recorte lo que
    recorte el lanzador —circulo, cuadrado redondeado, gota— el filo siempre
    es rojo y el corte no se nota. Antes el marco era una linea pintada a
    cierta distancia del borde, y cualquier mascara delataba que habia una
    forma por debajo siendo recortada.

    `inset` es cuanto entra el rojo desde el borde antes de empezar el
    degradado; o sea, el grosor visible del marco.
    """
    lienzo = Image.new('RGBA', (lado, lado), ROJO_MARCO)
    if marco:
        borde = int(lado * inset)
        mascara = Image.new('L', (lado, lado), 0)
        ImageDraw.Draw(mascara).rounded_rectangle(
            [borde, borde, lado - borde - 1, lado - borde - 1],
            radius=int(lado * radio), fill=255,
        )
        lienzo.paste(fondo_degradado(lado), (0, 0), mascara)
    else:
        # A 16 px un marco es un pixel suelto que solo ensucia.
        lienzo = fondo_degradado(lado)

    alto = int(lado * alto_flor)
    ancho = max(1, int(flor.width * alto / flor.height))
    f = flor.resize((ancho, alto), Image.LANCZOS)
    lienzo.paste(f, ((lado - ancho) // 2, (lado - alto) // 2), f)
    return lienzo


def main():
    if len(sys.argv) < 2:
        print('Falta la imagen fuente. Ej: py -3 scripts/generar-iconos.py public/mjb_hd.png')
        return 1
    origen = sys.argv[1]
    componer = '--componer' in sys.argv
    baldosa = '--baldosa' in sys.argv
    aro = '--aro' in sys.argv
    im = Image.open(origen).convert('RGBA')
    print('fuente: %s  %sx%s%s' % (origen, im.width, im.height, '  (modo aro)' if aro else ''))
    os.makedirs(DESTINO, exist_ok=True)

    if componer:
        # `origen` es la flor de lis aislada, con transparencia.
        for lado in (192, 512):
            componer_icono(im, lado).save('%s/icon-%d-%s.png' % (DESTINO, lado, V))
            # El maskable mete el marco al 11%: un lanzador circular recorta un
            # circulo del 80% del icono, y un marco pegado al borde perderia
            # las cuatro esquinas. El degradado sigue llegando a sangre, asi
            # que no se ve ningun anillo suelto alrededor.
            # El maskable mete mas rojo (18%) por geometria, no por gusto: un
            # lanzador circular recorta un circulo de radio 0.40 del centro, y
            # para que ese circulo caiga TODO sobre rojo, la esquina mas lejana
            # del interior redondeado tiene que quedar dentro de el:
            #
            #     distancia = raiz(2) * (0.5 - inset - radio) + radio <= 0.40
            #
            # Con radio 0.145: inset 0.16 da 0.4208 y 0.17 da 0.4066 — en ambos
            # ASOMA el degradado por las diagonales y el recorte vuelve a
            # notarse. 0.18 da 0.3925 y entra. Si algun dia se cambia el
            # redondeo, hay que rehacer esta cuenta: al bajarlo de 0.20 a 0.145
            # el 16% que antes valia dejo de valer, sin que nada fallara.
            componer_icono(im, lado).save(
                '%s/icon-maskable-%d-%s.png' % (DESTINO, lado, V))
        componer_icono(im, 180).save('%s/apple-touch-icon-%s.png' % (DESTINO, V))
        for lado in (16, 32, 48):
            # A 16 px el marco es un pixel y solo ensucia: solo flor y fondo.
            componer_icono(im, lado, alto_flor=0.80, marco=False).save(
                '%s/favicon-%d-%s.png' % (DESTINO, lado, V))
        for f in sorted(os.listdir(DESTINO)):
            print('  %-26s %dx%d  %d KB' % (
                f, Image.open('%s/%s' % (DESTINO, f)).size[0],
                Image.open('%s/%s' % (DESTINO, f)).size[1],
                os.path.getsize('%s/%s' % (DESTINO, f)) // 1024))
        return 0

    if baldosa:
        # El arte ya trae fondo, marco y figura: aqui solo se escala.
        for lado in (192, 512):
            desde_baldosa(im, lado).save('%s/icon-%d-%s.png' % (DESTINO, lado, V))
            desde_baldosa(im, lado, encoge=0.78).save(
                '%s/icon-maskable-%d-%s.png' % (DESTINO, lado, V))
        desde_baldosa(im, 180).save('%s/apple-touch-icon-%s.png' % (DESTINO, V))
        for lado in (16, 32, 48):
            desde_baldosa(im, lado).save('%s/favicon-%d-%s.png' % (DESTINO, lado, V))
        for f in sorted(os.listdir(DESTINO)):
            ruta = '%s/%s' % (DESTINO, f)
            if not f.endswith('.png') or f.startswith('fuente'):
                continue
            print('  %-26s %s  %d KB' % (f, '%dx%d' % Image.open(ruta).size, os.path.getsize(ruta) // 1024))
        return 0

    if aro:
        # `origen` debe ser SOLO el arte (la flor de lis) con fondo
        # transparente: el verde y el aro los pone este script. Si se le pasa
        # la baldosa entera se duplicarian el fondo y el marco.
        for lado in (192, 512):
            componer_con_aro(im, lado).save('%s/icon-%d-%s.png' % (DESTINO, lado, V))
            componer_con_aro(im, lado, margen_arte=0.28).save(
                '%s/icon-maskable-%d-%s.png' % (DESTINO, lado, V))
        componer_con_aro(im, 180).save('%s/apple-touch-icon-%s.png' % (DESTINO, V))
        for lado in (16, 32, 48):
            # En 16 px un aro de 1 px se convierte en suciedad: a esos tamanos
            # solo el arte sobre el verde, sin marco.
            cuadrar(im, lado, VERDE, margen=0.12).save('%s/favicon-%d-%s.png' % (DESTINO, lado, V))
        for f in sorted(os.listdir(DESTINO)):
            ruta = '%s/%s' % (DESTINO, f)
            print('  %-26s %s  %d KB' % (f, '%dx%d' % Image.open(ruta).size, os.path.getsize(ruta) // 1024))
        return 0

    # 'any': sin margen y con transparencia. El sistema lo pinta tal cual.
    for lado in (192, 512):
        cuadrar(im, lado).save('%s/icon-%d-%s.png' % (DESTINO, lado, V))
    # 'maskable': con zona segura y fondo solido, para que el recorte del
    # lanzador se vea intencionado y no un accidente.
    for lado in (192, 512):
        cuadrar(im, lado, FONDO_MASKABLE, margen=0.10).save(
            '%s/icon-maskable-%d-%s.png' % (DESTINO, lado, V))
    # Favicon y iOS: cuadrados y con fondo, que a 16 px la transparencia se
    # confunde con el color de la pestana.
    cuadrar(im, 180, FONDO_MASKABLE, margen=0.06).save('%s/apple-touch-icon-%s.png' % (DESTINO, V))
    for lado in (16, 32, 48):
        cuadrar(im, lado, FONDO_MASKABLE, margen=0.04).save('%s/favicon-%d-%s.png' % (DESTINO, lado, V))

    for f in sorted(os.listdir(DESTINO)):
        ruta = '%s/%s' % (DESTINO, f)
        print('  %-26s %s  %d KB' % (f, '%dx%d' % Image.open(ruta).size, os.path.getsize(ruta) // 1024))
    return 0


if __name__ == '__main__':
    sys.exit(main())
