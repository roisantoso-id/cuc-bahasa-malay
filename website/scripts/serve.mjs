// 本地预览 dist/:node scripts/serve.mjs [端口]
import { createServer } from 'node:http'
import { existsSync, readFileSync, statSync } from 'node:fs'
import { dirname, extname, join, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'

const DIST = join(dirname(fileURLToPath(import.meta.url)), '../dist')
const PORT = Number(process.argv[2] || 4173)
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.xml': 'application/xml', '.txt': 'text/plain' }

createServer((req, res) => {
  let p = join(DIST, normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)))
  if (!p.startsWith(DIST)) { res.writeHead(403).end(); return }
  if (existsSync(p) && statSync(p).isDirectory()) p = join(p, 'index.html')
  const found = existsSync(p)
  const file = found ? p : join(DIST, '404.html')
  res.writeHead(found ? 200 : 404, { 'content-type': TYPES[extname(file)] || 'application/octet-stream' })
  res.end(readFileSync(file))
}).listen(PORT, () => console.log(`http://localhost:${PORT}`))
