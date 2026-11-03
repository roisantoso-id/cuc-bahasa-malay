// 把启航的 5000 个单词音频传到腾讯云 COS(零依赖)
//   COS_SECRET_ID=… COS_SECRET_KEY=… COS_BUCKET=jombelajar-1250000000 COS_REGION=ap-jakarta \
//   node admin/scripts/upload-audio-cos.mjs <音频目录> [COS 里的前缀,默认 vocab5000/]
// 在自己的终端里运行,密钥不要写进仓库。已经传过的(大小一样)会跳过,可以反复运行。
// 也可以不用这个脚本:在 COS 控制台把整个文件夹拖进 vocab5000/ 目录,效果一样。
// 存储桶权限设「公有读私有写」,然后把 AUDIO_BASE 设成 https://<桶名>.cos.<地域>.myqcloud.com/vocab5000/
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { createHmac, createHash } from 'node:crypto'

const { COS_SECRET_ID: SID, COS_SECRET_KEY: SKEY, COS_BUCKET: BUCKET, COS_REGION: REGION } = process.env
const [dir, prefix = 'vocab5000/'] = process.argv.slice(2)
if (!SID || !SKEY || !BUCKET || !REGION || !dir) { console.error('用法见文件开头的注释'); process.exit(1) }
const HOST = `${BUCKET}.cos.${REGION}.myqcloud.com`

// COS XML API 签名(https://cloud.tencent.com/document/product/436/7778)
const hmac = (k, s) => createHmac('sha1', k).update(s).digest('hex')
const sha1 = s => createHash('sha1').update(s).digest('hex')
function auth(method, path) {
  const now = Math.floor(Date.now() / 1000), keyTime = `${now - 60};${now + 600}`
  const httpString = `${method.toLowerCase()}\n${path}\n\nhost=${HOST.toLowerCase()}\n`
  const sign = hmac(hmac(SKEY, keyTime), `sha1\n${keyTime}\n${sha1(httpString)}\n`)
  return `q-sign-algorithm=sha1&q-ak=${SID}&q-sign-time=${keyTime}&q-key-time=${keyTime}&q-header-list=host&q-url-param-list=&q-signature=${sign}`
}
async function cos(method, key, body) {
  const path = '/' + key
  return fetch(`https://${HOST}${path.split('/').map(encodeURIComponent).join('/')}`, {
    method, body,
    headers: { authorization: auth(method, path), ...(body ? { 'content-type': 'audio/mpeg', 'cache-control': 'public, max-age=31536000' } : {}) }
  })
}

const files = readdirSync(dir).filter(f => f.endsWith('.mp3')).sort()
console.log(`${files.length} 个音频 → https://${HOST}/${prefix}`)
let up = 0, skip = 0, bad = 0
const queue = files.slice()
async function worker() {
  for (let f; (f = queue.shift());) {
    const key = prefix + f, size = statSync(join(dir, f)).size
    const head = await cos('HEAD', key)
    if (head.ok && Number(head.headers.get('content-length')) === size) { skip++; continue }
    const r = await cos('PUT', key, readFileSync(join(dir, f)))
    if (r.ok) up++; else { bad++; console.error('失败', f, r.status, (await r.text()).slice(0, 200)) }
    if ((up + skip + bad) % 200 === 0) console.log(`  ${up + skip + bad}/${files.length}`)
  }
}
await Promise.all(Array.from({ length: 8 }, worker))
console.log(`完成:上传 ${up},跳过 ${skip},失败 ${bad}`)
process.exit(bad ? 1 : 0)
