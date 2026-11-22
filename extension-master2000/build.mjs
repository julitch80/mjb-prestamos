// Empaqueta la extension en extension-master2000/dist/ (npm run build:extension)
import { build } from 'esbuild'
import { cpSync, existsSync, mkdirSync, rmSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const aqui = dirname(fileURLToPath(import.meta.url))
const dist = join(aqui, 'dist')
rmSync(dist, { recursive: true, force: true })
mkdirSync(dist, { recursive: true })
for (const [entrada, salida] of [['content.ts', 'content.js'], ['background.ts', 'background.js']]) {
  await build({
    entryPoints: [join(aqui, 'src', entrada)],
    bundle: true,
    format: 'iife',
    target: 'chrome110',
    outfile: join(dist, salida),
    logLevel: 'info',
  })
}
// El manifest de dist/ se arma desde manifest.json. Si existe clave-publica.txt (clave pública del panel de la
// tienda, una sola línea base64), se inyecta como "key": así una copia descomprimida tiene el MISMO ID que la
// de la tienda (jefcakofmibkmfhdkgiehbjebkoifpoc). Sin ese archivo, el manifest queda sin "key".
const manifest = JSON.parse(readFileSync(join(aqui, 'manifest.json'), 'utf8'))
const archivoClave = join(aqui, 'clave-publica.txt')
if (existsSync(archivoClave)) {
  const clave = readFileSync(archivoClave, 'utf8').replace(/-----[A-Z ]+-----/g, '').replace(/\s+/g, '')
  if (clave) manifest.key = clave
}
writeFileSync(join(dist, 'manifest.json'), JSON.stringify(manifest, null, 2))
if (manifest.oauth2?.client_id?.startsWith('PENDIENTE')) console.warn('AVISO: oauth2.client_id en manifest.json sigue como PENDIENTE_CLIENT_ID: reemplácelo (ver docs/extension-master2000/V2-PASOS-JULIAN.md).')
if (!existsSync(join(aqui, 'icons'))) throw new Error('Faltan los iconos (node extension-master2000/make-icons.mjs)')
cpSync(join(aqui, 'icons'), join(dist, 'icons'), { recursive: true })
const m = JSON.parse(readFileSync(join(dist, 'manifest.json'), 'utf8'))
console.log(`Extension lista en ${dist} (manifest v${m.manifest_version}, ${m.name})`)
