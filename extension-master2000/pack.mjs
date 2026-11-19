// npm run pack:extension -> build + zip de dist/ en paquete/mjb-master2000-<version>.zip
import { execFileSync } from 'node:child_process'
import { readdirSync, readFileSync, writeFileSync, mkdirSync, statSync } from 'node:fs'
import { dirname, join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { zipSync } from 'fflate'

const aqui = dirname(fileURLToPath(import.meta.url))
execFileSync(process.execPath, [join(aqui, 'build.mjs')], { stdio: 'inherit' })
const dist = join(aqui, 'dist')
const files = {}
const walk = (d) => { for (const n of readdirSync(d)) { const p = join(d, n); statSync(p).isDirectory() ? walk(p) : (files[relative(dist, p).split(sep).join('/')] = new Uint8Array(readFileSync(p))) } }
walk(dist)
const version = JSON.parse(readFileSync(join(dist, 'manifest.json'), 'utf8')).version
mkdirSync(join(aqui, 'paquete'), { recursive: true })
const out = join(aqui, 'paquete', `mjb-master2000-${version}.zip`)
writeFileSync(out, zipSync(files, { level: 9 }))
console.log(`Paquete: ${out}\nEntradas: ${Object.keys(files).join(', ')}`)
