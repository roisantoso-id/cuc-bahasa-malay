// JomBelajar 背单词后台(零依赖,Node 20+)
//   node admin/server.mjs              配置读 /etc/jombelajar-admin.env(或环境变量 ADMIN_ENV 指定的文件)
//   没配 APPID → 演示模式:数据存 admin/data/demo.json,登录 admin / admin123
// 云开发模式通过微信服务端接口读写云数据库、上传云存储(AppSecret 只在服务器上)
import { createServer } from 'node:http'
import { readFileSync, writeFileSync, existsSync, mkdirSync, statSync } from 'node:fs'
import { join, dirname, extname, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'

const HERE = dirname(fileURLToPath(import.meta.url))
const PUBLIC = join(HERE, 'public')
const DATA = join(HERE, 'data')

// ---------------- 配置 ----------------
function loadEnv(file) {
  if (!existsSync(file)) return {}
  const out = {}
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line)
    if (m && !line.trim().startsWith('#')) out[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
  return out
}
const ENV = { ...loadEnv(process.env.ADMIN_ENV || '/etc/jombelajar-admin.env'), ...process.env }
const DEMO = !ENV.APPID
const PORT = Number(ENV.ADMIN_PORT || 4200)
const HOST = ENV.ADMIN_HOST || '127.0.0.1'
const ADMIN_USER = ENV.ADMIN_USER || 'admin'
// 演示模式默认密码 admin123;正式环境必须在 env 里配 ADMIN_PASSWORD_HASH(node admin/scripts/hash-password.mjs 生成)
const ADMIN_HASH = ENV.ADMIN_PASSWORD_HASH || (DEMO ? hashPassword('admin123', 'demo-salt') : '')
if (!DEMO && !ENV.ADMIN_PASSWORD_HASH) { console.error('缺 ADMIN_PASSWORD_HASH,拒绝启动'); process.exit(1) }

export function hashPassword(pw, salt = randomBytes(16).toString('hex')) {
  return `scrypt:${salt}:${scryptSync(pw, salt, 32).toString('hex')}`
}
function checkPassword(pw, stored) {
  const [, salt, hex] = String(stored).split(':')
  if (!salt || !hex) return false
  const a = scryptSync(String(pw), salt, 32), b = Buffer.from(hex, 'hex')
  return a.length === b.length && timingSafeEqual(a, b)
}

const COLLECTIONS = ['scenes', 'words', 'teachers', 'students', 'progress']
const EDITABLE = ['scenes', 'words', 'teachers']

// ---------------- 演示存储 ----------------
class DemoStore {
  constructor() {
    this.file = join(DATA, 'demo.json')
    mkdirSync(join(DATA, 'uploads'), { recursive: true })
    if (!existsSync(this.file)) writeFileSync(this.file, JSON.stringify(seedDemo(), null, 1))
    this.db = JSON.parse(readFileSync(this.file, 'utf8'))
  }
  save() { writeFileSync(this.file, JSON.stringify(this.db, null, 1)) }
  async list(col) { return (this.db[col] || []).slice() }
  async add(col, doc) { const d = { _id: `${col}-${randomBytes(5).toString('hex')}`, ...doc }; (this.db[col] ||= []).push(d); this.save(); return d._id }
  async update(col, id, patch) { const d = (this.db[col] || []).find(x => x._id === id); if (!d) throw new Error('记录不存在'); Object.assign(d, patch); this.save() }
  async remove(col, id) { this.db[col] = (this.db[col] || []).filter(x => x._id !== id); this.save() }
  async upload(path, buf) { const name = path.replace(/[^\w.-]/g, '_'); writeFileSync(join(DATA, 'uploads', name), buf); return `/uploads/${name}` }
  async urls(ids) { return Object.fromEntries(ids.map(id => [id, id])) }
}

function seedDemo() {
  const seedFile = join(HERE, '../content/words-seed.json')
  const seed = existsSync(seedFile) ? JSON.parse(readFileSync(seedFile, 'utf8')) : { scenes: [], words: [] }
  const now = new Date().toISOString()
  return {
    scenes: seed.scenes,
    // 种子录音在 content/audio/<id>.mp3,演示模式直接用
    words: (seed.words || []).map(w => ({ ...w, audio: w.audio || (existsSync(join(HERE, '../content/audio', `${w._id}.mp3`)) ? `/seed-audio/${w._id}.mp3` : '') })),
    teachers: [
      { _id: 't-zhang', name: '张静灵', title: '副教授 · 中国传媒大学马来语专业教师', role: '课程主持', bio: '长期从事马来语教学与马来世界文化研究。出版专著《同源异流》、马来文专著 Warisan Kebudayaan Minangkabau，译著《马来西亚诗选》；参与编撰《马来语报刊选读》《新经典马来文学史教程》《马来语写作教程》。', photo: '', order: 1 },
      { _id: 't-yang', name: '杨启航', title: '中国传媒大学马来语专业本科生', role: '团队成员', bio: '获国家留学基金管理委员会资助赴马来西亚理科大学交流学习，曾受邀参加马来西亚国家广播电视台《早安马来西亚》直播访谈。', photo: '', order: 2 }
    ],
    students: [
      { _id: 's-demo1', _openid: 'demo-1', name: '演示学生 A', school: '演示大学', className: '马来语 1 班', track: 'zero', phone: '13800000001', createdAt: now, lastActiveAt: now },
      { _id: 's-demo2', _openid: 'demo-2', name: '演示学生 B', school: '演示大学', className: '马来语 2 班', track: 'heritage', phone: '13800000002', createdAt: now, lastActiveAt: now }
    ],
    progress: (seed.words || []).slice(0, 7).map((w, i) => ({ _id: `p-${i}`, _openid: 'demo-1', wordId: w._id, sceneId: w.sceneId, box: 1, due: now.slice(0, 10) }))
  }
}

// ---------------- 云开发存储(微信服务端接口) ----------------
class CloudStore {
  constructor() { this.token = null; this.exp = 0 }
  async accessToken() {
    if (this.token && Date.now() < this.exp) return this.token
    const r = await fetch('https://api.weixin.qq.com/cgi-bin/stable_token', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ grant_type: 'client_credential', appid: ENV.APPID, secret: ENV.APPSECRET }) })
    const d = await r.json()
    if (!d.access_token) throw new Error(`获取 access_token 失败:${d.errcode} ${d.errmsg}`)
    this.token = d.access_token
    this.exp = Date.now() + (d.expires_in - 300) * 1000
    return this.token
  }
  async api(path, body) {
    const t = await this.accessToken()
    const r = await fetch(`https://api.weixin.qq.com/tcb/${path}?access_token=${t}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ env: ENV.CLOUD_ENV, ...body }) })
    const d = await r.json()
    if (d.errcode) throw new Error(`云开发接口 ${path} 出错:${d.errcode} ${d.errmsg}`)
    return d
  }
  async list(col) {
    const out = []
    for (let skip = 0; ; skip += 1000) {
      const d = await this.api('databasequery', { query: `db.collection(${JSON.stringify(col)}).skip(${skip}).limit(1000).get()` })
      const rows = (d.data || []).map(s => normalizeDates(JSON.parse(s)))
      out.push(...rows)
      if (rows.length < 1000) return out
    }
  }
  async add(col, doc) {
    const d = await this.api('databaseadd', { query: `db.collection(${JSON.stringify(col)}).add({data:${JSON.stringify([doc])}})` })
    return (d.id_list || [])[0]
  }
  async update(col, id, patch) {
    const { _id, ...rest } = patch
    await this.api('databaseupdate', { query: `db.collection(${JSON.stringify(col)}).doc(${JSON.stringify(id)}).update({data:${JSON.stringify(rest)}})` })
  }
  async remove(col, id) {
    await this.api('databasedelete', { query: `db.collection(${JSON.stringify(col)}).doc(${JSON.stringify(id)}).remove()` })
  }
  async upload(path, buf, contentType = 'application/octet-stream') {
    const d = await this.api('uploadfile', { path })
    const form = new FormData()
    form.append('key', path)
    form.append('Signature', d.authorization)
    form.append('x-cos-security-token', d.token)
    form.append('x-cos-meta-fileid', d.cos_file_id)
    form.append('file', new Blob([buf], { type: contentType }), path.split('/').pop())
    const r = await fetch(d.url, { method: 'POST', body: form })
    if (r.status >= 300) throw new Error(`上传云存储失败:HTTP ${r.status}`)
    return d.file_id
  }
  async urls(ids) {
    const list = ids.filter(id => /^cloud:\/\//.test(id))
    const out = Object.fromEntries(ids.map(id => [id, id]))
    if (!list.length) return out
    const d = await this.api('batchdownloadfile', { file_list: list.map(fileid => ({ fileid, max_age: 7200 })) })
    for (const f of d.file_list || []) if (f.download_url) out[f.fileid] = f.download_url
    return out
  }
}
// 云数据库返回的日期是 {"$date": 毫秒};统一转成 ISO 字符串
function normalizeDates(v) {
  if (Array.isArray(v)) return v.map(normalizeDates)
  if (v && typeof v === 'object') {
    if ('$date' in v && Object.keys(v).length === 1) return new Date(v.$date).toISOString()
    return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, normalizeDates(x)]))
  }
  return v
}

const store = DEMO ? new DemoStore() : new CloudStore()

// ---------------- 会话与限流 ----------------
const sessions = new Map() // token → { user, exp }
const fails = new Map()    // ip → [时间戳]
const SESSION_MS = 12 * 3600e3
const ip = req => (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim()
function cookie(req, name) { const m = new RegExp(`(?:^|;\\s*)${name}=([^;]+)`).exec(req.headers.cookie || ''); return m ? m[1] : '' }
function session(req) { const s = sessions.get(cookie(req, 'jb_admin')); return s && s.exp > Date.now() ? s : null }
function tooMany(addr) { const t = (fails.get(addr) || []).filter(x => x > Date.now() - 10 * 60e3); fails.set(addr, t); return t.length >= 5 }

// ---------------- 工具 ----------------
const send = (res, code, data, headers = {}) => { res.writeHead(code, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers }); res.end(JSON.stringify(data)) }
const fail = (res, code, msg) => send(res, code, { error: msg })
async function body(req, limit = 12 * 1024 * 1024) {
  const chunks = []; let n = 0
  for await (const c of req) { n += c.length; if (n > limit) throw new Error('内容太大'); chunks.push(c) }
  const s = Buffer.concat(chunks).toString('utf8')
  return s ? JSON.parse(s) : {}
}
const str = (v, max = 500) => String(v ?? '').trim().slice(0, max)
const POS = ['名', '动', '形', '副', '代', '数', '介', '连', '叹', '短语', '方位', '其他']

// 各集合可写的字段(白名单,防止随便写入)
function clean(col, d) {
  if (col === 'scenes') return { name: str(d.name, 30), name_ms: str(d.name_ms, 60), cover: str(d.cover, 300), order: Number(d.order) || 0, published: !!d.published }
  if (col === 'words') return { ms: str(d.ms, 80), zh: str(d.zh, 120), pos: POS.includes(d.pos) ? d.pos : '其他', example_ms: str(d.example_ms, 300), example_zh: str(d.example_zh, 300), audio: str(d.audio, 300), sceneId: str(d.sceneId, 80), order: Number(d.order) || 0, status: d.status === 'approved' ? 'approved' : 'draft' }
  if (col === 'teachers') return { name: str(d.name, 30), title: str(d.title, 100), role: str(d.role, 30), bio: str(d.bio, 1000), photo: str(d.photo, 300), order: Number(d.order) || 0 }
}
function required(col, d) {
  if (col === 'scenes' && !d.name) return '请填写场景名称'
  if (col === 'words' && (!d.ms || !d.zh)) return '马来语和中文释义都要填'
  if (col === 'words' && !d.sceneId) return '请选择场景'
  if (col === 'teachers' && !d.name) return '请填写姓名'
  return ''
}

// 粘贴的 CSV / TSV 解析(支持引号)
function parseTable(text) {
  const rows = []
  const lines = String(text).replace(/\r/g, '').split('\n').filter(l => l.trim())
  const sep = lines[0] && lines[0].includes('\t') ? '\t' : ','
  for (const line of lines) {
    const cells = []; let cur = '', q = false
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (q) { if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++ } else if (ch === '"') q = false; else cur += ch }
      else if (ch === '"') q = true
      else if (ch === sep) { cells.push(cur); cur = '' }
      else cur += ch
    }
    cells.push(cur)
    rows.push(cells.map(c => c.trim()))
  }
  return rows
}

// Azure 马来语发音
async function tts(text) {
  if (!ENV.AZURE_TTS_KEY) throw new Error('服务器没有配置 AZURE_TTS_KEY,不能生成发音')
  const region = ENV.AZURE_TTS_REGION || 'eastus'
  const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const ssml = `<speak version="1.0" xml:lang="ms-MY"><voice name="ms-MY-YasminNeural"><prosody rate="-8%">${esc(text)}</prosody></voice></speak>`
  const r = await fetch(`https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`, { method: 'POST', headers: { 'Ocp-Apim-Subscription-Key': ENV.AZURE_TTS_KEY, 'Content-Type': 'application/ssml+xml', 'X-Microsoft-OutputFormat': 'audio-24khz-48kbitrate-mono-mp3', 'User-Agent': 'jombelajar-admin' }, body: ssml })
  if (!r.ok) throw new Error(`生成发音失败:HTTP ${r.status}`)
  return Buffer.from(await r.arrayBuffer())
}
async function ttsWord(w) {
  const buf = await tts(w.ms)
  const fileID = await store.upload(`audio/words/${w._id}.mp3`, buf, 'audio/mpeg')
  await store.update('words', w._id, { audio: fileID })
  return fileID
}

// ---------------- 路由 ----------------
async function api(req, res, url) {
  const p = url.pathname
  if (p === '/api/login' && req.method === 'POST') {
    const addr = ip(req)
    if (tooMany(addr)) return fail(res, 429, '登录失败次数太多，请 10 分钟后再试')
    const b = await body(req)
    if (b.user !== ADMIN_USER || !checkPassword(b.password, ADMIN_HASH)) { fails.get(addr).push(Date.now()); return fail(res, 401, '账号或密码不对') }
    const token = randomBytes(32).toString('hex')
    sessions.set(token, { user: ADMIN_USER, exp: Date.now() + SESSION_MS })
    const secure = req.headers['x-forwarded-proto'] === 'https' ? '; Secure' : ''
    return send(res, 200, { ok: true }, { 'set-cookie': `jb_admin=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${SESSION_MS / 1000}${secure}` })
  }
  if (p === '/api/mode') return send(res, 200, { demo: DEMO })
  if (p === '/api/logout' && req.method === 'POST') { sessions.delete(cookie(req, 'jb_admin')); return send(res, 200, { ok: true }, { 'set-cookie': 'jb_admin=; Path=/; Max-Age=0' }) }

  const me = session(req)
  if (!me) return fail(res, 401, '请先登录')
  if (p === '/api/me') return send(res, 200, { user: me.user, demo: DEMO, tts: !!ENV.AZURE_TTS_KEY })

  // 学生(只读)+ 学习进度
  if (p === '/api/students' || p === '/api/students.csv') {
    const [students, progress] = await Promise.all([store.list('students'), store.list('progress')])
    const learned = {}
    for (const r of progress) learned[r._openid] = (learned[r._openid] || 0) + 1
    const rows = students.map(s => ({ ...s, learned: learned[s._openid] || 0 })).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
    if (p === '/api/students') return send(res, 200, rows)
    const head = ['姓名', '学校', '班级', '基础', '手机号', '已学词数', '注册时间', '最近活跃']
    const q = v => `"${String(v ?? '').replace(/"/g, '""')}"`
    const csv = '﻿' + [head, ...rows.map(s => [s.name, s.school, s.className, s.track === 'heritage' ? '会说一些' : '零基础', s.phone, s.learned, s.createdAt, s.lastActiveAt])].map(r => r.map(q).join(',')).join('\r\n')
    res.writeHead(200, { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': `attachment; filename="students-${new Date().toISOString().slice(0, 10)}.csv"` })
    return res.end(csv)
  }

  // 批量导入单词:先 dryRun 预览,再正式写入
  if (p === '/api/words/import' && req.method === 'POST') {
    const b = await body(req)
    const scenes = await store.list('scenes')
    const byName = Object.fromEntries(scenes.flatMap(s => [[s.name, s._id], [s._id, s._id]]))
    const rows = parseTable(b.text || '')
    if (rows[0] && /^(ms|马来语)$/i.test(rows[0][0])) rows.shift() // 有表头就跳过
    const existing = await store.list('words')
    const key = w => `${w.sceneId}|${w.ms.toLowerCase()}`
    const seen = new Set(existing.map(key))
    const preview = rows.map((r, i) => {
      const [ms, zh, pos, example_ms, example_zh, scene] = r
      const sceneId = byName[scene] || b.defaultScene || ''
      const w = clean('words', { ms, zh, pos, example_ms, example_zh, sceneId, status: 'draft', order: 1000 + i })
      let error = required('words', w)
      if (!error && seen.has(key(w))) error = '这个场景里已经有这个词'
      if (!error) seen.add(key(w))
      return { line: i + 1, ...w, sceneName: (scenes.find(s => s._id === sceneId) || {}).name || scene || '', error }
    })
    if (b.dryRun) return send(res, 200, { preview })
    let added = 0
    for (const w of preview.filter(x => !x.error)) { const { line, error, sceneName, ...doc } = w; await store.add('words', doc); added++ }
    return send(res, 200, { added, skipped: preview.length - added })
  }

  // 生成发音:单个 / 批量(没有录音的)
  let m
  if ((m = /^\/api\/words\/([^/]+)\/tts$/.exec(p)) && req.method === 'POST') {
    const w = (await store.list('words')).find(x => x._id === decodeURIComponent(m[1]))
    if (!w) return fail(res, 404, '单词不存在')
    return send(res, 200, { audio: await ttsWord(w) })
  }
  if (p === '/api/words/tts-batch' && req.method === 'POST') {
    const b = await body(req)
    const list = (await store.list('words')).filter(w => (!b.sceneId || w.sceneId === b.sceneId) && (b.all || !w.audio)).slice(0, 50)
    let done = 0; const errors = []
    for (const w of list) { try { await ttsWord(w); done++ } catch (e) { errors.push(`${w.ms}:${e.message}`) } }
    return send(res, 200, { done, errors })
  }

  // 上传图片(老师照片 / 场景封面):base64
  if (p === '/api/upload' && req.method === 'POST') {
    const b = await body(req)
    const ext = (extname(b.name || '').toLowerCase() || '.jpg').replace(/[^.\w]/g, '')
    if (!['.jpg', '.jpeg', '.png', '.webp'].includes(ext)) return fail(res, 400, '只支持 jpg / png / webp 图片')
    const buf = Buffer.from(String(b.data || '').replace(/^data:[^,]+,/, ''), 'base64')
    if (buf.length > 5 * 1024 * 1024) return fail(res, 400, '图片不能超过 5MB')
    const fileID = await store.upload(`images/${b.folder === 'scenes' ? 'scenes' : 'teachers'}/${Date.now()}-${randomBytes(3).toString('hex')}${ext}`, buf, ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg')
    return send(res, 200, { fileID })
  }
  if (p === '/api/files/urls' && req.method === 'POST') {
    const b = await body(req)
    return send(res, 200, await store.urls((b.ids || []).filter(Boolean).slice(0, 50)))
  }

  // 场景 / 单词 / 老师 增删改查
  if ((m = /^\/api\/(scenes|words|teachers)(?:\/([^/]+))?$/.exec(p))) {
    const col = m[1], id = m[2] && decodeURIComponent(m[2])
    if (req.method === 'GET' && !id) {
      const rows = await store.list(col)
      return send(res, 200, rows.sort((a, b) => (a.sceneId || '').localeCompare(b.sceneId || '') || (a.order || 0) - (b.order || 0)))
    }
    if (req.method === 'POST' && !id) {
      const d = clean(col, await body(req))
      const err = required(col, d)
      if (err) return fail(res, 400, err)
      return send(res, 200, { _id: await store.add(col, d) })
    }
    if (req.method === 'PUT' && id) {
      const b = await body(req)
      // 只改传进来的字段(例如只切换审核状态)
      const full = clean(col, b)
      const patch = Object.fromEntries(Object.entries(full).filter(([k]) => k in b))
      if (b.partial !== true) { const err = required(col, full); if (err) return fail(res, 400, err) }
      await store.update(col, id, patch)
      return send(res, 200, { ok: true })
    }
    if (req.method === 'DELETE' && id) { await store.remove(col, id); return send(res, 200, { ok: true }) }
  }
  return fail(res, 404, '接口不存在')
}

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.mp3': 'audio/mpeg' }
function file(res, path) {
  if (!existsSync(path) || !statSync(path).isFile()) return false
  res.writeHead(200, { 'content-type': TYPES[extname(path).toLowerCase()] || 'application/octet-stream', 'cache-control': 'no-cache' })
  res.end(readFileSync(path))
  return true
}

createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x')
  res.setHeader('x-frame-options', 'DENY')
  res.setHeader('x-content-type-options', 'nosniff')
  res.setHeader('referrer-policy', 'no-referrer')
  try {
    if (url.pathname.startsWith('/api/')) return await api(req, res, url)
    // 演示模式的上传文件 / 种子录音(只读)
    if (DEMO && url.pathname.startsWith('/uploads/')) { if (session(req) && file(res, join(DATA, 'uploads', normalize(url.pathname.slice(9)).replace(/^(\.\.[/\\])+/, '')))) return }
    if (DEMO && url.pathname.startsWith('/seed-audio/')) { if (session(req) && file(res, join(HERE, '../content/audio', url.pathname.slice(12).replace(/[^\w.-]/g, '')))) return }
    const p = normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, '')
    if (file(res, join(PUBLIC, p === '/' ? 'index.html' : p))) return
    file(res, join(PUBLIC, 'index.html'))
  } catch (e) {
    console.error(e)
    if (!res.headersSent) fail(res, 500, e.message || '服务器出错')
  }
}).listen(PORT, HOST, () => {
  console.log(`JomBelajar 后台:http://${HOST}:${PORT}`)
  if (DEMO) console.warn('⚠ 演示模式(没有配置 APPID):数据存在 admin/data/demo.json,登录 admin / admin123。不要这样上线。')
})
