"""Fase 0 revision visual: contraste WCAG, colores fijos y daltonismo.
Uso: py -3.12 -I scripts/revision-visual/contraste.py   (solo stdlib)
Lee src/index.css; no modifica nada."""
import re, os, itertools, collections
RAIZ = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
CSS = os.path.join(RAIZ, 'src', 'index.css')


def hex2rgb(h):
    h = h.lstrip('#')
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def compone(h, base):
    """#rrggbbaa sobre base (rgb) -> rgb."""
    h = h.lstrip('#')
    c = hex2rgb(h[:6])
    if len(h) == 8:
        a = int(h[6:], 16) / 255
        return tuple(round(c[i] * a + base[i] * (1 - a)) for i in range(3))
    return c


def lin(c):
    c /= 255
    return c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4


def lum(rgb):
    r, g, b = (lin(x) for x in rgb)
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def cr(a, b):
    la, lb = lum(a), lum(b)
    if la < lb:
        la, lb = lb, la
    return (la + 0.05) / (lb + 0.05)


def rgb2hex(c):
    return '#%02x%02x%02x' % tuple(c)


# ---- tokens ----
txt = open(CSS, encoding='utf-8').read()
m_dark = re.search(r'\.dark\s*\{(.*?)\n\s*\}', txt, re.S)
bloque_claro = re.search(r'@theme\s*\{(.*?)\n\}', txt, re.S).group(1)


def toks(b):
    return dict(re.findall(r'--color-([\w-]+):\s*(#[0-9a-fA-F]{6,8})', b))


CLARO = toks(bloque_claro)
OSC = dict(CLARO)
OSC.update(toks(m_dark.group(1)))
MODOS = {'claro': CLARO, 'oscuro': OSC}
FONDOS = ['app', 'card', 'elevated', 'hover']
TEXTOS = ['strong', 'soft', 'muted', 'accent', 'info', 'danger', 'success', 'warning', 'purple', 'teal']
GRADOS = ['grado-6', 'grado-7', 'grado-8', 'grado-9', 'grado-10', 'grado-11']
AULAS = {'Aula 1': '#60a5fa', 'Aula 2': '#34d399', 'Aula 3': '#fb923c', 'Aula 4': '#a78bfa', 'Aula 5': '#fbbf24',
         'Aula 6': '#f472b6', 'Aula 7': '#22d3ee', 'Aula 8': '#f87171', 'Aula 9': '#a3e635', 'Aula 10': '#fdba74',
         'Sala Info.': '#f1f5f9', 'Lab. Ciencias': '#ff4444'}
ROLES = {'Rectora': '#e8c84a', 'Coordinador': '#f08080', 'Docente': '#86efac'}


def fondo(modo, n):
    return compone(MODOS[modo][n], hex2rgb(MODOS[modo]['card']))


def veredicto(r, umbral=4.5):
    return 'PASA' if r >= umbral else 'FALLA'


print('== (a) TOKENS DE TEXTO sobre fondos (umbral 4.5) ==')
fallas = []
for modo in MODOS:
    for t in TEXTOS:
        fg = hex2rgb(MODOS[modo][t])
        for f in FONDOS:
            r = cr(fg, fondo(modo, f))
            if r < 4.5:
                fallas.append((r, modo, t, f, MODOS[modo][t]))
            print(f'{modo:7} {t:8} sobre {f:9} {r:5.2f} {veredicto(r)}')
print('-- pastillas (X-soft-fg sobre X-soft compuesto sobre card)')
for modo in MODOS:
    for k in ['accent', 'success', 'warning', 'danger', 'info', 'purple', 'teal']:
        bg = compone(MODOS[modo][k + '-soft'], hex2rgb(MODOS[modo]['card']))
        r = cr(hex2rgb(MODOS[modo][k + '-soft-fg']), bg)
        print(f'{modo:7} {k}-soft-fg sobre {k}-soft {r:5.2f} {veredicto(r)}')
print('-- accent-fg sobre accent (botones)')
for modo in MODOS:
    r = cr(hex2rgb(MODOS[modo]['accent-fg']), hex2rgb(MODOS[modo]['accent']))
    print(modo, f'{r:.2f}', veredicto(r))
print('-- bordes sobre card, umbral 3.0')
for modo in MODOS:
    for t in ['line', 'line-strong']:
        r = cr(hex2rgb(MODOS[modo][t]), fondo(modo, 'card'))
        print(modo, t, f'{r:.2f}', veredicto(r, 3))
print('PEORES (<4.5):')
for r, modo, t, f, h in sorted(fallas)[:12]:
    print(f'  {r:.2f} {modo} {t} {h} sobre {f}')

print('\n== (b) FIJOS aulas/grados/roles sobre card (4.5) ==')
for nombre, d in (('AULA', AULAS), ('ROL', ROLES)):
    for modo in MODOS:
        for k, h in d.items():
            r = cr(hex2rgb(h), fondo(modo, 'card'))
            print(f'{nombre:4} {modo:7} {k:14} {h} {r:5.2f} {veredicto(r)}')
for modo in MODOS:
    for g in GRADOS:
        r = cr(hex2rgb(MODOS[modo][g]), fondo(modo, 'card'))
        print(f'GRADO {modo:7} {g:9} {MODOS[modo][g]} {r:5.2f} {veredicto(r)}')

print('\n== (c) COLORES FIJOS DE TEXTO en src ==')
PAL = 'slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose'
pats = {
    'text-white/black': re.compile(r'\btext-(?:white|black)\b'),
    'text-paleta-NNN': re.compile(r'\btext-(?:' + PAL + r')-\d{2,3}\b'),
    'text-[#hex]': re.compile(r'\btext-\[#[0-9a-fA-F]{3,8}\]'),
    "color:'#hex'": re.compile(r"""\bcolor\s*:\s*['"]#[0-9a-fA-F]{3,8}['"]"""),
    'color: #hex (css)': re.compile(r'(?<![-\w])color\s*:\s*#[0-9a-fA-F]{3,8}'),
}
por_arch = collections.defaultdict(collections.Counter)
for d, _, fs in os.walk(os.path.join(RAIZ, 'src')):
    for f in fs:
        if not f.endswith(('.ts', '.tsx', '.css')):
            continue
        p = os.path.join(d, f)
        s = open(p, encoding='utf-8', errors='ignore').read()
        for n, rx in pats.items():
            c = len(rx.findall(s))
            if c:
                por_arch[os.path.relpath(p, RAIZ).replace('\\', '/')][n] += c
tot = collections.Counter()
for a, c in por_arch.items():
    tot.update(c)
print('TOTAL', dict(tot), sum(tot.values()))
for a, c in sorted(por_arch.items(), key=lambda x: -sum(x[1].values()))[:20]:
    print(f'{sum(c.values()):4} {a} {dict(c)}')
print('archivos con fijos:', len(por_arch))

print('\n== (d) DALTONISMO (Machado 2009, severidad 1.0; deltaE CIE76 < 15 = confunde) ==')
MAT = {
    'protanopia': [[0.152286, 1.052583, -0.204868], [0.114503, 0.786281, 0.099216], [-0.003882, -0.048116, 1.051998]],
    'deuteranopia': [[0.367322, 0.860646, -0.227968], [0.280085, 0.672501, 0.047413], [-0.011820, 0.042940, 0.968881]],
    'tritanopia': [[1.255528, -0.076749, -0.178779], [-0.078411, 0.930809, 0.147602], [0.004733, 0.691367, 0.303900]],
}


def sim(rgb, m):
    l = [lin(x) for x in rgb]
    o = [min(1, max(0, sum(m[i][j] * l[j] for j in range(3)))) for i in range(3)]
    return tuple(round(255 * (12.92 * v if v <= 0.0031308 else 1.055 * v ** (1 / 2.4) - 0.055)) for v in o)


def lab(rgb):
    r, g, b = (lin(x) for x in rgb)
    X = (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047
    Y = 0.2126 * r + 0.7152 * g + 0.0722 * b
    Z = (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883
    f = lambda t: t ** (1 / 3) if t > 0.008856 else 7.787 * t + 16 / 116
    return (116 * f(Y) - 16, 500 * (f(X) - f(Y)), 200 * (f(Y) - f(Z)))


def de(a, b):
    return sum((x - y) ** 2 for x, y in zip(lab(a), lab(b))) ** 0.5


def revisa(titulo, items):
    print(f'-- {titulo}')
    malas = []
    for (na, ca), (nb, cb) in itertools.combinations(items.items(), 2):
        dn = de(ca, cb)
        for k, m in MAT.items():
            d = de(sim(ca, m), sim(cb, m))
            if d < 15:
                malas.append((d, k, na, nb, dn))
    malas.sort()
    print(f'   {len(malas)} casos de confusion (pareja x tipo)')
    for d, k, na, nb, dn in malas[:14]:
        print(f'   dE={d:4.1f} {k:12} {na} <> {nb} (normal {dn:.0f})')
    return malas


for modo in MODOS:
    T = MODOS[modo]
    revisa(f'SEMANTICOS {modo}', {n: hex2rgb(T[n]) for n in ['success', 'danger', 'warning', 'info', 'accent', 'purple', 'teal']})
    revisa(f'GRADOS {modo}', {g: hex2rgb(T[g]) for g in GRADOS})
    revisa(f'DISPONIBILIDAD {modo} (libre/ocupado/clase/propio)',
           {'libre': hex2rgb(T['success']), 'ocupado': hex2rgb(T['danger']), 'clase': hex2rgb(T['muted']), 'propio': hex2rgb(T['accent'])})
revisa('AULAS (fijas, ambos modos)', {k: hex2rgb(v) for k, v in AULAS.items()})


print('== (e) VERIFICACION POST-CAMBIO: aulas/roles en modo claro (src/data/coloresTema.ts) ==')
ts = open(os.path.join(RAIZ, 'src', 'data', 'coloresTema.ts'), encoding='utf-8').read()
claro = dict(re.findall(r"'([^']+)': '(#[0-9a-f]{6})'", ts)) | dict(re.findall(r"(\w+): '(#[0-9a-f]{6})'", ts))
peor = 99
for k, h in claro.items():
    for f in ('card', 'elevated'):
        r = cr(hex2rgb(h), fondo('claro', f)); peor = min(peor, r)
        if r < 4.5: print('  FALLA', k, h, f, round(r, 2))
print(f'  {len(claro)} colores claro, peor contraste {peor:.2f}', 'OK' if peor >= 4.5 else 'FALLA')
