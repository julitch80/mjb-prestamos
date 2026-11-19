// Empaqueta la extension en extension-master2000/dist/ (npm run build:extension)
import { build } from 'esbuild'
import { cpSync, existsSync, mkdirSync, rmSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const aqui = dirname(fileURLToPath(import.meta.url))
const dist = join(aqui, 'dist')
rmSync(dist, { recursive: true, force: true })
mkdirSync(dist, { recursive: true })
await build({
  entryPoints: [join(aqui, 'src', 'content.ts')],
  bundle: true,
  format: 'iife',
  target: 'chrome110',
  outfile: join(dist, 'content.js'),
  logLevel: 'info',
})
cpSync(join(aqui, 'manifest.json'), join(dist, 'manifest.json'))
if (!existsSync(join(aqui, 'icons'))) throw new Error('Faltan los iconos (node extension-master2000/make-icons.mjs)')
cpSync(join(aqui, 'icons'), join(dist, 'icons'), { recursive: true })
const m = JSON.parse(readFileSync(join(dist, 'manifest.json'), 'utf8'))
console.log(`Extension lista en ${dist} (manifest v${m.manifest_version}, ${m.name})`)
