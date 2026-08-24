"""
Optimiza las fotos de la brigada (kit de inmovilizacion) para que entren
en el precache de la PWA sin inflar el peso de la app.

Que hace:
  1. Lee las fotos originales desde una carpeta de entrada (por defecto
     'fotos-origen/', relativa a donde se ejecute el script).
  2. Corrige la rotacion segun los metadatos EXIF (las fotos de celular
     salen giradas si no se hace esto explicitamente).
  3. Redimensiona a un ancho maximo de 900 px, manteniendo la proporcion.
  4. Elimina TODOS los metadatos EXIF antes de guardar. Esto es
     importante y no es solo limpieza: las fotos de celular suelen llevar
     coordenadas GPS incrustadas, y esas coordenadas identifican la
     ubicacion exacta del colegio. Publicar la foto con ese EXIF intacto
     filtraria esa ubicacion sin que nadie lo note a simple vista.
  5. Guarda como JPEG calidad 80 en 'public/fotos-brigada/', con el mismo
     nombre pero en minusculas, sin espacios ni acentos.
  6. Al final imprime el peso de cada archivo, el peso total, y avisa si
     algun archivo pesa mas de 200 KB o si el total supera 1 MB: estas
     fotos entran al precache de la PWA (hoy pesa 3.4 MB en total), y cada
     KB de mas ahi es un KB que un celular debe descargar y guardar antes
     de poder usar la app sin señal.

Uso:
    python scripts/optimizar-fotos-brigada.py [carpeta-de-entrada]

Si no se pasa carpeta, usa 'fotos-origen/' por defecto.
"""

import sys
import unicodedata
from pathlib import Path

from PIL import Image, ImageOps

ANCHO_MAXIMO = 900
CALIDAD_JPEG = 80
LIMITE_ARCHIVO_BYTES = 200 * 1024  # 200 KB
LIMITE_TOTAL_BYTES = 1024 * 1024   # 1 MB

CARPETA_SALIDA = Path(__file__).resolve().parent.parent / "public" / "fotos-brigada"

EXTENSIONES_VALIDAS = {".jpg", ".jpeg", ".png", ".heic", ".webp"}


def normalizar_nombre(nombre: str) -> str:
    """Convierte el nombre de archivo a minusculas, sin acentos ni espacios."""
    base = Path(nombre).stem
    extension = ".jpg"  # todo se guarda como jpg, sin importar el original

    # Quita acentos (NFKD separa la letra de su tilde, y nos quedamos solo
    # con los caracteres ASCII).
    base_sin_acentos = unicodedata.normalize("NFKD", base)
    base_sin_acentos = base_sin_acentos.encode("ascii", "ignore").decode("ascii")

    base_normalizada = base_sin_acentos.lower()
    base_normalizada = base_normalizada.replace(" ", "_")
    # Deja solo letras, numeros, guion y guion bajo.
    base_normalizada = "".join(
        c for c in base_normalizada if c.isalnum() or c in ("-", "_")
    )

    return f"{base_normalizada}{extension}"


def formatear_kb(bytes_: int) -> str:
    return f"{bytes_ / 1024:.1f} KB"


def procesar_foto(ruta_origen: Path, ruta_destino: Path) -> int:
    """Procesa una foto y devuelve su peso final en bytes."""
    with Image.open(ruta_origen) as imagen:
        # Corrige la orientacion segun EXIF ANTES de perder el EXIF.
        imagen = ImageOps.exif_transpose(imagen)

        # Convierte a RGB por si viene en modo con transparencia (PNG, etc.),
        # porque JPEG no soporta canal alfa.
        if imagen.mode != "RGB":
            imagen = imagen.convert("RGB")

        # Redimensiona manteniendo proporcion si el ancho supera el maximo.
        if imagen.width > ANCHO_MAXIMO:
            alto_proporcional = round(imagen.height * (ANCHO_MAXIMO / imagen.width))
            imagen = imagen.resize((ANCHO_MAXIMO, alto_proporcional), Image.LANCZOS)

        # Guarda sin pasar el parametro exif: Pillow no copia metadatos que
        # no se le pasan explicitamente, asi que la imagen queda limpia de
        # GPS y demas datos identificables.
        imagen.save(ruta_destino, "JPEG", quality=CALIDAD_JPEG, optimize=True)

    return ruta_destino.stat().st_size


def main() -> None:
    carpeta_entrada = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("fotos-origen")

    if not carpeta_entrada.is_dir():
        print(f"ERROR: no existe la carpeta de entrada '{carpeta_entrada}'.")
        print("Crea la carpeta y pon ahi las fotos originales, o pasa la ruta correcta.")
        sys.exit(1)

    CARPETA_SALIDA.mkdir(parents=True, exist_ok=True)

    archivos = sorted(
        p for p in carpeta_entrada.iterdir()
        if p.is_file() and p.suffix.lower() in EXTENSIONES_VALIDAS
    )

    if not archivos:
        print(f"No se encontraron fotos ({', '.join(EXTENSIONES_VALIDAS)}) en '{carpeta_entrada}'.")
        sys.exit(0)

    print(f"Procesando {len(archivos)} foto(s) desde '{carpeta_entrada}'...\n")

    peso_total = 0
    archivos_pesados = []

    for archivo in archivos:
        nombre_final = normalizar_nombre(archivo.name)
        ruta_destino = CARPETA_SALIDA / nombre_final

        try:
            peso = procesar_foto(archivo, ruta_destino)
        except Exception as error:
            print(f"  ERROR procesando '{archivo.name}': {error}")
            continue

        peso_total += peso
        print(f"  {archivo.name} -> {nombre_final}  ({formatear_kb(peso)})")

        if peso > LIMITE_ARCHIVO_BYTES:
            archivos_pesados.append((nombre_final, peso))

    print(f"\nPeso total: {formatear_kb(peso_total)}")
    print(f"Guardadas en: {CARPETA_SALIDA}")

    if archivos_pesados:
        print("\n⚠️  AVISO: los siguientes archivos superan los 200 KB recomendados:")
        for nombre, peso in archivos_pesados:
            print(f"   - {nombre}: {formatear_kb(peso)}")
        print("   Estas fotos entran al precache de la PWA (hoy 3.4 MB en total).")
        print("   Considera bajar la calidad o el ancho maximo para estas.")

    if peso_total > LIMITE_TOTAL_BYTES:
        print(f"\n⚠️  AVISO: el total ({formatear_kb(peso_total)}) supera 1 MB.")
        print("   Esto aumenta bastante el peso del precache de la PWA.")
        print("   Revisa si todas las fotos son realmente necesarias.")


if __name__ == "__main__":
    main()
