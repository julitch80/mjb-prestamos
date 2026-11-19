// Genera icons/icon-{16,32,48,128}.png sin dependencias (PNG a mano con zlib).
import { deflateSync } from 'node:zlib'
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const aqui = dirname(fileURLToPath(import.meta.url))
const crcT = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0 })
const crc = (b) => { let c = 0xffffffff; for (const x of b) c = crcT[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0 }
const chunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]) }

const inRR = (x, y, r) => { // cuadrado redondeado unidad
  const dx = Math.max(r - x, x - (1 - r), 0), dy = Math.max(r - y, y - (1 - r), 0)
  return x >= 0 && x <= 1 && y >= 0 && y <= 1 && dx * dx + dy * dy <= r * r
}
const inTri = (x, y) => x >= 0.40 && x <= 0.55 && Math.abs(y - 0.5) <= 0.17 * (0.55 - x) / 0.15
function blanco(x, y) { // true = pixel blanco del dibujo
  if (x >= 0.12 && x <= 0.42 && Math.abs(y - 0.5) <= 0.05) return true // flecha: cuerpo
  if (inTri(x, y)) return true // flecha: punta
  if (x >= 0.60 && x <= 0.90 && y >= 0.20 && y <= 0.80) { // planilla
    const lin = [0.38, 0.56].some((v) => Math.abs(y - v) < 0.02) || Math.abs(x - 0.75) < 0.02 || y < 0.28 && false
    return !lin
  }
  return false
}
function png(n) {
  const S = 4, raw = Buffer.alloc((n * 4 + 1) * n)
  for (let j = 0; j < n; j++) {
    raw[j * (n * 4 + 1)] = 0
    for (let i = 0; i < n; i++) {
      let a = 0, w = 0
      for (let sj = 0; sj < S; sj++) for (let si = 0; si < S; si++) {
        const x = (i + (si + 0.5) / S) / n, y = (j + (sj + 0.5) / S) / n
        if (inRR(x, y, 0.22)) { a++; if (blanco(x, y)) w++ }
      }
      const o = j * (n * 4 + 1) + 1 + i * 4, t = S * S
      const f = a ? w / a : 0 // mezcla verde -> blanco
      raw[o] = Math.round(0x15 + (255 - 0x15) * f); raw[o + 1] = Math.round(0x80 + (255 - 0x80) * f); raw[o + 2] = Math.round(0x3d + (255 - 0x3d) * f)
      raw[o + 3] = Math.round(255 * a / t)
    }
  }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(n, 0); ihdr.writeUInt32BE(n, 4); ihdr[8] = 8; ihdr[9] = 6
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))])
}
mkdirSync(join(aqui, 'icons'), { recursive: true })
for (const n of [16, 32, 48, 128]) writeFileSync(join(aqui, 'icons', `icon-${n}.png`), png(n))
console.log('Iconos generados')
