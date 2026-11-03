// JomBelajar 背单词服务(Node 22+,PostgreSQL,唯一依赖 pg)
//   线上:docker compose 起(见仓库根目录 docker-compose.yml),配置从环境变量读
//   本机:DATABASE_URL=postgres://… node admin/server.mjs(也可以写进 ADMIN_ENV 指定的文件)
// 一个进程同时提供:
//   /api/app/*    小程序接口(微信登录换 openid,token 放在 Authorization 头)
//   /api/admin/*  后台接口(管理员账号 + 会话 cookie)
//   其余路径      后台网页(public/)
// 单词音频在腾讯云 COS,这里只存文件名,拼上 AUDIO_BASE 返回给小程序和后台。
// 演示模式只在 DEMO=1 时打开(本机开发用):小程序不校验微信登录,后台账号 admin / admin123
// 正式环境没配 APPID 时小程序登录直接报错,没配 ADMIN_PASSWORD_HASH 时后台登录不上,不会退回演示模式
import { createServer } from 'node:http'
import { readFileSync, writeFileSync, existsSync, mkdirSync, statSync } from 'node:fs'
import { join, dirname, extname, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'
import { randomBytes, scryptSync, timingSafeEqual, createHmac } from 'node:crypto'
import pg from 'pg'

const HERE = dirname(fileURLToPath(import.meta.url))
const PUBLIC = join(HERE, 'public')

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
const DEMO = ENV.DEMO === '1'
const PORT = Number(ENV.ADMIN_PORT || 4200)
const HOST = ENV.ADMIN_HOST || '127.0.0.1'
const PUBLIC_HOST = ENV.PUBLIC_HOST || `${HOST}:${PORT}`
const DATA = ENV.DATA_DIR || join(HERE, 'data') // 老师照片
const AUDIO_BASE = (ENV.AUDIO_BASE || (DEMO ? `http://${PUBLIC_HOST}/demo-audio/` : '')).replace(/\/?$/, '/')
const ADMIN_USER = ENV.ADMIN_USER || 'admin'
// 演示模式默认密码 admin123;正式环境必须在 env 里配 ADMIN_PASSWORD_HASH(node admin/scripts/hash-password.mjs 生成)
const ADMIN_HASH = ENV.ADMIN_PASSWORD_HASH || (DEMO ? hashPassword('admin123', 'demo-salt') : '')
if (!DEMO && (!ENV.ADMIN_PASSWORD_HASH || !ENV.APPID || !ENV.APPSECRET)) console.warn('⚠ 还没配 APPID / APPSECRET / ADMIN_PASSWORD_HASH:小程序登录和后台登录暂时不可用')
if (!ENV.DATABASE_URL) { console.error('缺 DATABASE_URL'); process.exit(1) }

export function hashPassword(pw, salt = randomBytes(16).toString('hex')) {
  return `scrypt:${salt}:${scryptSync(pw, salt, 32).toString('hex')}`
}
function checkPassword(pw, stored) {
  const [, salt, hex] = String(stored).split(':')
  if (!salt || !hex) return false
  const a = scryptSync(String(pw), salt, 32), b = Buffer.from(hex, 'hex')
  return a.length === b.length && timingSafeEqual(a, b)
}

// ---------------- 旅程:10 站,每站 500 词 ----------------
const STOPS = [
  { level: 1, city: '吉隆坡', ms: 'Kuala Lumpur', note: '双子塔下出发' },
  { level: 2, city: '马六甲', ms: 'Melaka', note: '老街和娘惹糕' },
  { level: 3, city: '怡保', ms: 'Ipoh', note: '白咖啡的家乡' },
  { level: 4, city: '槟城', ms: 'Pulau Pinang', note: '壁画巷和炒粿条' },
  { level: 5, city: '金马伦', ms: 'Cameron Highlands', note: '茶园山路' },
  { level: 6, city: '关丹', ms: 'Kuantan', note: '东海岸的海风' },
  { level: 7, city: '瓜拉登嘉楼', ms: 'Kuala Terengganu', note: '水上清真寺' },
  { level: 8, city: '哥打巴鲁', ms: 'Kota Bharu', note: '风筝和夜市' },
  { level: 9, city: '古晋', ms: 'Kuching', note: '犀鸟之乡' },
  { level: 10, city: '亚庇', ms: 'Kota Kinabalu', note: '神山脚下的终点' }
]

// ---------------- 数据库 ----------------
// 布尔值都用 0/1 整数存,日期(北京时间)用 'YYYY-MM-DD' 文本,时间用 ISO 文本;senses 是 JSON 文本
mkdirSync(join(DATA, 'uploads'), { recursive: true })
pg.types.setTypeParser(20, v => Number(v)) // COUNT / SUM 返回的 bigint 转成数字
const pool = new pg.Pool({ connectionString: ENV.DATABASE_URL, max: 10 })
const SCHEMA = `
CREATE TABLE IF NOT EXISTS meta (k TEXT PRIMARY KEY, v TEXT);
CREATE TABLE IF NOT EXISTS words (rank INTEGER PRIMARY KEY, ms TEXT NOT NULL, root TEXT DEFAULT '', level INTEGER NOT NULL, senses TEXT DEFAULT '[]', audio TEXT DEFAULT '', status TEXT DEFAULT 'pending', edited INTEGER DEFAULT 0, updated_at TEXT);
CREATE INDEX IF NOT EXISTS words_level ON words(level, status);
CREATE TABLE IF NOT EXISTS students (id SERIAL PRIMARY KEY, openid TEXT UNIQUE NOT NULL, name TEXT, school TEXT, class_name TEXT, track TEXT, phone TEXT, daily_new INTEGER DEFAULT 20, created_at TEXT, last_active_at TEXT);
CREATE TABLE IF NOT EXISTS progress (student_id INTEGER NOT NULL, rank INTEGER NOT NULL, box INTEGER DEFAULT 0, due TEXT, wrong INTEGER DEFAULT 0, seen INTEGER DEFAULT 0, fav INTEGER DEFAULT 0, first_at TEXT, last_day TEXT, last_at TEXT, PRIMARY KEY (student_id, rank));
CREATE INDEX IF NOT EXISTS progress_due ON progress(student_id, due);
CREATE TABLE IF NOT EXISTS daily (student_id INTEGER NOT NULL, day TEXT NOT NULL, new_cnt INTEGER DEFAULT 0, review_cnt INTEGER DEFAULT 0, right_cnt INTEGER DEFAULT 0, PRIMARY KEY (student_id, day));
CREATE TABLE IF NOT EXISTS teachers (id SERIAL PRIMARY KEY, name TEXT, title TEXT, role TEXT, bio TEXT, photo TEXT, sort INTEGER DEFAULT 0);
`
// SQL 里写 ?,这里换成 $1 $2 …
const pgSql = sql => { let n = 0; return sql.replace(/\?/g, () => '$' + ++n) }
const helpers = c => ({
  all: async (sql, ...a) => (await c.query(pgSql(sql), a)).rows,
  one: async (sql, ...a) => (await c.query(pgSql(sql), a)).rows[0],
  run: (sql, ...a) => c.query(pgSql(sql), a)
})
const { all, one, run } = helpers(pool)
async function tx(fn) {
  const c = await pool.connect()
  try { await c.query('BEGIN'); const r = await fn(helpers(c)); await c.query('COMMIT'); return r } catch (e) { await c.query('ROLLBACK'); throw e } finally { c.release() }
}
let TOKEN_KEY = '' // 小程序 token 的签名密钥:第一次启动随机生成,存在 meta 表里

const str = (v, max = 500) => String(v ?? '').trim().slice(0, max)
const cleanSense = s => { const o = { pos: str(s.pos, 20), zh: str(s.zh, 200), exMs: str(s.exMs, 400), exZh: str(s.exZh, 400) }; if (s.check) o.check = true; return o }

// 导入词库(content/vocab5000/words.json 的格式)。后台改过的词(edited=1)默认不覆盖
async function importWords(list, { overwriteEdited = false } = {}) {
  const now = new Date().toISOString()
  let changed = 0
  await tx(async c => {
    for (const w of list) {
      const rank = Number(w.rank)
      if (!Number.isInteger(rank) || rank < 1 || rank > 20000 || !w.ms) continue
      const senses = (Array.isArray(w.senses) ? w.senses : []).map(cleanSense).filter(s => s.zh)
      const status = w.status === 'approved' && senses.some(s => !s.check) ? 'approved' : 'pending'
      const r = await c.run(`INSERT INTO words (rank, ms, root, level, senses, audio, status, edited, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)
        ON CONFLICT (rank) DO UPDATE SET ms = excluded.ms, root = excluded.root, level = excluded.level, senses = excluded.senses, audio = excluded.audio, status = excluded.status, edited = 0, updated_at = excluded.updated_at
        WHERE words.edited = 0 OR ?::int = 1`, rank, str(w.ms, 80), str(w.root, 80), Number(w.level) || Math.ceil(rank / 500), JSON.stringify(senses), str(w.audio, 200), status, now, overwriteEdited ? 1 : 0)
      changed += r.rowCount
    }
  })
  return { total: list.length, changed }
}

async function init() {
  for (let i = 0; ; i++) { // 数据库容器可能还没起来,等一会儿
    try { await pool.query('SELECT 1'); break } catch (e) { if (i >= 30) throw e; await new Promise(r => setTimeout(r, 1000)) }
  }
  await pool.query(SCHEMA)
  const k = await one('SELECT v FROM meta WHERE k = ?', 'token_key')
  TOKEN_KEY = k ? k.v : randomBytes(32).toString('hex')
  if (!k) await run('INSERT INTO meta (k, v) VALUES (?, ?) ON CONFLICT (k) DO NOTHING', 'token_key', TOKEN_KEY)
  if (!(await one('SELECT 1 FROM words LIMIT 1'))) {
    const seed = [join(HERE, '../content/vocab5000/words.json'), join(HERE, 'words.json')].find(existsSync)
    if (seed) console.log('首次启动,导入词库:', await importWords(JSON.parse(readFileSync(seed, 'utf8'))))
  }
  if (!(await one('SELECT 1 FROM teachers LIMIT 1'))) {
    const ins = 'INSERT INTO teachers (name, title, role, bio, photo, sort) VALUES (?, ?, ?, ?, ?, ?)'
    await run(ins, '张静灵', '副教授 · 中国传媒大学马来语专业教师', '课程主持', '长期从事马来语教学与马来世界文化研究。出版专著《同源异流》、马来文专著 Warisan Kebudayaan Minangkabau，译著《马来西亚诗选》；参与编撰《马来语报刊选读》《新经典马来文学史教程》《马来语写作教程》。', '', 1)
    await run(ins, '杨启航', '中国传媒大学马来语专业本科生', '团队成员', '获国家留学基金管理委员会资助赴马来西亚理科大学交流学习，曾受邀参加马来西亚国家广播电视台《早安马来西亚》直播访谈。', '', 2)
  }
}

// ---------------- 背词规则 ----------------
// 盒子法:box 0–5 学习中,6 已掌握。新词:认识进 2、模糊进 1、不认识进 0;
// 复习:认识升一格,模糊不升,不认识回 0。下次复习隔几天按盒子取
const INTERVALS = [1, 1, 2, 4, 7, 15, 30]
const day = (offset = 0) => new Date(Date.now() + 8 * 3600e3 + offset * 86400e3).toISOString().slice(0, 10) // 北京时间日期
const REVIEW_MAX = 60

function wordOut(w, p) {
  const senses = JSON.parse(w.senses || '[]').filter(s => !s.check)
  return { rank: w.rank, ms: w.ms, root: w.root, level: w.level, senses, audio: w.audio ? AUDIO_BASE + w.audio : '', box: p && p.box != null ? p.box : -1, fav: !!(p && p.fav), wrong: (p && p.wrong) || 0 }
}
async function streakOf(sid) {
  const days = new Set((await all('SELECT day FROM daily WHERE student_id = ? AND (new_cnt + review_cnt) > 0 AND day >= ?', sid, day(-400))).map(r => r.day))
  const start = days.has(day()) ? 0 : -1 // 今天还没学,不算断
  let n = 0
  while (days.has(day(start - n))) n++
  return { streak: n, checkedToday: days.has(day()) }
}
async function levelsOf(sid) {
  const rows = await all(`SELECT w.level, COUNT(*) total, COUNT(*) FILTER (WHERE p.seen > 0) learned, COUNT(*) FILTER (WHERE p.box = 6) mastered
    FROM words w LEFT JOIN progress p ON p.rank = w.rank AND p.student_id = ? WHERE w.status = 'approved' GROUP BY w.level`, sid)
  const by = Object.fromEntries(rows.map(r => [r.level, r]))
  return STOPS.map(s => {
    const r = by[s.level] || {}
    const total = Number(r.total || 0), learned = Number(r.learned || 0)
    return { ...s, total, learned, mastered: Number(r.mastered || 0), open: total > 0, stamped: total > 0 && learned >= total }
  })
}
function currentLevel(levels) { const l = levels.find(l => l.open && !l.stamped); return l ? l.level : (levels.filter(l => l.open).pop() || levels[0]).level }

async function home(st) {
  const sid = st.id, today = day()
  const levels = await levelsOf(sid)
  const d = await one('SELECT * FROM daily WHERE student_id = ? AND day = ?', sid, today) || { new_cnt: 0, review_cnt: 0 }
  const due = (await one('SELECT COUNT(*) n FROM progress WHERE student_id = ? AND seen > 0 AND box < 6 AND due <= ?', sid, today)).n
  const tot = await one('SELECT COUNT(*) FILTER (WHERE seen > 0) learned, COUNT(*) FILTER (WHERE box = 6) mastered, COALESCE(SUM(fav), 0) fav, COUNT(*) FILTER (WHERE wrong > 0 AND box < 6) wrong FROM progress WHERE student_id = ?', sid)
  return {
    student: studentOut(st), levels, level: currentLevel(levels),
    today: { goal: st.daily_new, learned: d.new_cnt, reviewed: d.review_cnt, newLeft: Math.max(st.daily_new - d.new_cnt, 0), due: Number(due) },
    total: { learned: Number(tot.learned || 0), mastered: Number(tot.mastered || 0), fav: Number(tot.fav || 0), wrong: Number(tot.wrong || 0), words: levels.reduce((n, l) => n + l.total, 0) },
    ...(await streakOf(sid))
  }
}

const COLS = 'w.*, p.box, p.fav, p.wrong'
// 开一组:mode = today(到期复习 + 今天剩下的新词)/ review / new(level 指定一站,10 个)/ wrong(错词重练)/ fav(收藏)
async function start(st, b) {
  const sid = st.id, today = day()
  const mode = ['today', 'review', 'new', 'wrong', 'fav'].includes(b.mode) ? b.mode : 'today'
  let review = [], fresh = []
  if (mode === 'today' || mode === 'review') review = await all(`SELECT ${COLS} FROM progress p JOIN words w ON w.rank = p.rank WHERE p.student_id = ? AND p.seen > 0 AND p.box < 6 AND p.due <= ? AND w.status = 'approved' ORDER BY p.due, p.box LIMIT ?`, sid, today, REVIEW_MAX)
  if (mode === 'wrong') review = await all(`SELECT ${COLS} FROM progress p JOIN words w ON w.rank = p.rank WHERE p.student_id = ? AND p.wrong > 0 AND p.box < 6 AND w.status = 'approved' ORDER BY p.wrong DESC, p.last_at LIMIT 20`, sid)
  if (mode === 'fav') review = await all(`SELECT ${COLS} FROM progress p JOIN words w ON w.rank = p.rank WHERE p.student_id = ? AND p.fav = 1 AND w.status = 'approved' ORDER BY p.last_at LIMIT 20`, sid)
  if (mode === 'today' || mode === 'new') {
    const d = await one('SELECT new_cnt FROM daily WHERE student_id = ? AND day = ?', sid, today)
    const left = mode === 'new' ? 10 : Math.max(st.daily_new - (d ? d.new_cnt : 0), 0)
    const level = mode === 'new' ? Number(b.level) || 1 : currentLevel(await levelsOf(sid))
    if (left) fresh = await all(`SELECT ${COLS} FROM words w LEFT JOIN progress p ON p.rank = w.rank AND p.student_id = ? WHERE (p.rank IS NULL OR p.seen = 0) AND w.status = 'approved' AND w.level ${mode === 'new' ? '=' : '>='} ? ORDER BY w.rank LIMIT ?`, sid, level, left)
  }
  const items = [...review.map(w => ({ ...wordOut(w, w), kind: 'review' })), ...fresh.map(w => ({ ...wordOut(w, w), kind: 'new' }))]
  // 出题用的干扰项:同一站的其他词
  const levels = [...new Set(items.map(i => i.level))]
  const pool = levels.length ? await all(`SELECT rank, ms, senses FROM words WHERE status = 'approved' AND level IN (${levels.map(() => '?').join(',')}) ORDER BY random() LIMIT 80`, ...levels) : []
  return { mode, items, pool: pool.map(w => ({ rank: w.rank, ms: w.ms, zh: (JSON.parse(w.senses).find(s => !s.check) || {}).zh || '' })) }
}

async function grade(st, b) {
  const sid = st.id, today = day(), rank = Number(b.rank)
  if (!await one(`SELECT 1 FROM words WHERE rank = ? AND status = 'approved'`, rank)) throw Object.assign(new Error('没有这个词'), { code: 404 })
  const result = ['know', 'vague', 'forgot', 'mastered'].includes(b.result) ? b.result : 'vague'
  const p = await one('SELECT * FROM progress WHERE student_id = ? AND rank = ?', sid, rank)
  const isNew = !p || !p.seen
  let box = p ? p.box : 0
  if (result === 'mastered') box = 6
  else if (result === 'know') box = isNew ? 2 : Math.min(box + 1, 6)
  else if (result === 'vague') box = isNew ? 1 : Math.max(box, 1)
  else box = 0
  const due = box >= 6 ? '9999-12-31' : day(INTERVALS[box])
  const wrong = ((p && p.wrong) || 0) + (result === 'forgot' ? 1 : 0)
  const reviewCounted = !isNew && p.last_day !== today // 同一天同一个词只算一次复习
  const now = new Date().toISOString()
  await tx(async c => {
    await c.run(`INSERT INTO progress (student_id, rank, box, due, wrong, seen, first_at, last_day, last_at) VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?)
      ON CONFLICT (student_id, rank) DO UPDATE SET box = excluded.box, due = excluded.due, wrong = excluded.wrong, seen = progress.seen + 1,
        first_at = CASE WHEN progress.seen = 0 THEN excluded.first_at ELSE progress.first_at END, last_day = excluded.last_day, last_at = excluded.last_at`, sid, rank, box, due, wrong, today, today, now)
    await c.run(`INSERT INTO daily (student_id, day, new_cnt, review_cnt, right_cnt) VALUES (?, ?, ?, ?, ?)
      ON CONFLICT (student_id, day) DO UPDATE SET new_cnt = daily.new_cnt + excluded.new_cnt, review_cnt = daily.review_cnt + excluded.review_cnt, right_cnt = daily.right_cnt + excluded.right_cnt`,
      sid, today, isNew ? 1 : 0, reviewCounted ? 1 : 0, result === 'know' || result === 'mastered' ? 1 : 0)
    await c.run('UPDATE students SET last_active_at = ? WHERE id = ?', now, sid)
  })
  return { ok: true, box, due }
}

async function book(st, type, page) {
  const where = { fav: 'p.fav = 1', wrong: 'p.wrong > 0 AND p.box < 6', mastered: 'p.box = 6', learning: 'p.seen > 0 AND p.box < 6' }[type]
  if (!where) throw Object.assign(new Error('未知单词本'), { code: 400 })
  const n = (await one(`SELECT COUNT(*) n FROM progress p JOIN words w ON w.rank = p.rank WHERE p.student_id = ? AND w.status = 'approved' AND ${where}`, st.id)).n
  const rows = await all(`SELECT ${COLS} FROM progress p JOIN words w ON w.rank = p.rank WHERE p.student_id = ? AND w.status = 'approved' AND ${where} ORDER BY ${type === 'wrong' ? 'p.wrong DESC,' : ''} p.last_at DESC LIMIT 50 OFFSET ?`, st.id, Math.max(page, 0) * 50)
  return { total: Number(n), words: rows.map(w => brief(wordOut(w, w))) }
}
const brief = o => ({ rank: o.rank, ms: o.ms, zh: o.senses.map(s => s.zh).join('；'), box: o.box, fav: o.fav, wrong: o.wrong, audio: o.audio })

async function stats(st) {
  const sid = st.id
  const rows = await all('SELECT day, new_cnt, review_cnt FROM daily WHERE student_id = ? AND day >= ? ORDER BY day', sid, day(-29))
  const by = Object.fromEntries(rows.map(r => [r.day, r]))
  const days = Array.from({ length: 30 }, (_, i) => { const d = day(i - 29); const r = by[d] || {}; return { day: d, new: r.new_cnt || 0, review: r.review_cnt || 0 } })
  const boxes = Array(7).fill(0)
  for (const r of await all('SELECT box, COUNT(*) n FROM progress WHERE student_id = ? AND seen > 0 GROUP BY box', sid)) boxes[r.box] = r.n
  const studyDays = (await one('SELECT COUNT(*) n FROM daily WHERE student_id = ? AND (new_cnt + review_cnt) > 0', sid)).n
  return { days, boxes, studyDays, levels: await levelsOf(sid), ...(await streakOf(sid)) }
}

const studentOut = s => s ? { name: s.name, school: s.school, className: s.class_name, track: s.track, phone: s.phone, dailyNew: s.daily_new, createdAt: s.created_at } : null

// ---------------- 小程序登录 ----------------
function signToken(openid) {
  const payload = Buffer.from(JSON.stringify({ o: openid, e: Date.now() + 30 * 86400e3 })).toString('base64url')
  return `${payload}.${createHmac('sha256', TOKEN_KEY).update(payload).digest('base64url')}`
}
function readToken(req) {
  const [payload, sig] = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '').split('.')
  if (!payload || !sig) return null
  const want = createHmac('sha256', TOKEN_KEY).update(payload).digest('base64url')
  if (want.length !== sig.length || !timingSafeEqual(Buffer.from(want), Buffer.from(sig))) return null
  try { const d = JSON.parse(Buffer.from(payload, 'base64url').toString()); return d.e > Date.now() ? d.o : null } catch { return null }
}
async function code2openid(code) {
  if (DEMO) return 'demo-' + (String(code || '').replace(/[^\w-]/g, '').slice(0, 40) || 'dev')
  if (!ENV.APPID || !ENV.APPSECRET) throw Object.assign(new Error('服务器还没配置小程序 AppID'), { code: 503 })
  const u = `https://api.weixin.qq.com/sns/jscode2session?appid=${ENV.APPID}&secret=${ENV.APPSECRET}&js_code=${encodeURIComponent(String(code || ''))}&grant_type=authorization_code`
  const d = await (await fetch(u)).json()
  if (!d.openid) throw Object.assign(new Error('微信登录失败,请重试'), { code: 401 })
  return d.openid
}

// ---------------- 通用 ----------------
const sessions = new Map() // 后台会话:token → { user, exp }
const fails = new Map()    // ip → [时间戳]
const SESSION_MS = 12 * 3600e3
const ip = req => (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim()
function cookie(req, name) { const m = new RegExp(`(?:^|;\\s*)${name}=([^;]+)`).exec(req.headers.cookie || ''); return m ? m[1] : '' }
function session(req) { const s = sessions.get(cookie(req, 'jb_admin')); return s && s.exp > Date.now() ? s : null }
function tooMany(addr) { const t = (fails.get(addr) || []).filter(x => x > Date.now() - 10 * 60e3); fails.set(addr, t); return t.length >= 5 }
const send = (res, code, data, headers = {}) => { res.writeHead(code, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers }); res.end(JSON.stringify(data)) }
const fail = (res, code, msg) => send(res, code, { error: msg })
async function body(req, limit = 4096) {
  const chunks = []; let n = 0
  for await (const c of req) { n += c.length; if (n > limit) throw Object.assign(new Error('内容太大'), { code: 413 }); chunks.push(c) }
  const s = Buffer.concat(chunks).toString('utf8')
  return s ? JSON.parse(s) : {}
}
// CSV 单元格:防公式注入(= + - @ 开头的加单引号)
const csvCell = v => { let s = String(v ?? ''); if (/^[=+\-@]/.test(s)) s = "'" + s; return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s }

// ---------------- 小程序接口 ----------------
const appHits = new Map() // openid → [时间戳],每分钟最多 120 次
async function appApi(req, res, p, url) {
  if (p === '/api/app/login' && req.method === 'POST') {
    const b = await body(req)
    const openid = await code2openid(b.code)
    return send(res, 200, { token: signToken(openid), student: studentOut(await one('SELECT * FROM students WHERE openid = ?', openid)) })
  }
  const openid = readToken(req)
  if (!openid) return fail(res, 401, '请重新登录')
  const hits = (appHits.get(openid) || []).filter(t => t > Date.now() - 60e3); hits.push(Date.now()); appHits.set(openid, hits)
  if (hits.length > 120) return fail(res, 429, '操作太快了,歇一下')

  if (p === '/api/app/register' && req.method === 'POST') {
    const b = await body(req)
    const name = str(b.name, 30), school = str(b.school, 60), className = str(b.className, 40), phone = str(b.phone, 20).replace(/[\s-]/g, '')
    if (!name) return fail(res, 400, '请填写姓名或昵称')
    if (!school) return fail(res, 400, '请填写学校')
    if (!/^1\d{10}$|^\+?\d{8,15}$/.test(phone)) return fail(res, 400, '手机号格式不对')
    if (!b.agree) return fail(res, 400, '请先阅读并同意隐私保护指引')
    const now = new Date().toISOString()
    await run(`INSERT INTO students (openid, name, school, class_name, track, phone, created_at, last_active_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT (openid) DO UPDATE SET name = excluded.name, school = excluded.school, class_name = excluded.class_name, track = excluded.track, phone = excluded.phone`,
      openid, name, school, className, ['some', 'heritage'].includes(b.track) ? 'some' : 'zero', phone, now, now)
    return send(res, 200, { ok: true, student: studentOut(await one('SELECT * FROM students WHERE openid = ?', openid)) })
  }
  if (p === '/api/app/teachers') return send(res, 200, await all('SELECT name, title, role, bio, photo FROM teachers ORDER BY sort, id'))

  const st = await one('SELECT * FROM students WHERE openid = ?', openid)
  if (!st) return fail(res, 403, '请先注册')
  if (p === '/api/app/home') return send(res, 200, await home(st))
  if (p === '/api/app/start' && req.method === 'POST') return send(res, 200, await start(st, await body(req)))
  if (p === '/api/app/grade' && req.method === 'POST') return send(res, 200, await grade(st, await body(req)))
  if (p === '/api/app/fav' && req.method === 'POST') {
    const b = await body(req), rank = Number(b.rank)
    if (!await one(`SELECT 1 FROM words WHERE rank = ? AND status = 'approved'`, rank)) return fail(res, 404, '没有这个词')
    // 没学过的词也能收藏:建一条 seen = 0 的记录,不算已学
    await run(`INSERT INTO progress (student_id, rank, box, due, fav, last_at) VALUES (?, ?, 0, ?, ?, ?) ON CONFLICT (student_id, rank) DO UPDATE SET fav = excluded.fav`, st.id, rank, day(), b.on ? 1 : 0, new Date().toISOString())
    return send(res, 200, { ok: true })
  }
  if (p === '/api/app/level') {
    const level = Number(url.searchParams.get('level')) || 1
    const rows = await all(`SELECT ${COLS} FROM words w LEFT JOIN progress p ON p.rank = w.rank AND p.student_id = ? WHERE w.level = ? AND w.status = 'approved' ORDER BY w.rank`, st.id, level)
    return send(res, 200, { stop: (await levelsOf(st.id)).find(l => l.level === level), words: rows.map(w => { const o = wordOut(w, w); return { rank: o.rank, ms: o.ms, zh: (o.senses[0] || {}).zh || '', box: o.box, fav: o.fav } }) })
  }
  if (p === '/api/app/word') {
    const w = await one(`SELECT ${COLS} FROM words w LEFT JOIN progress p ON p.rank = w.rank AND p.student_id = ? WHERE w.rank = ? AND w.status = 'approved'`, st.id, Number(url.searchParams.get('rank')))
    return w ? send(res, 200, wordOut(w, w)) : fail(res, 404, '没有这个词')
  }
  if (p === '/api/app/search') {
    const k = str(url.searchParams.get('q'), 40).toLowerCase().replace(/[%_]/g, '')
    if (!k) return send(res, 200, [])
    const like = `%${k}%`
    // 输入中文查释义,输入字母查马来语和词根
    const cond = /[\u4e00-\u9fff]/.test(k) ? `EXISTS (SELECT 1 FROM json_array_elements(w.senses::json) j WHERE j.value->>'zh' LIKE ? AND j.value->>'check' IS NULL)` : `(lower(w.ms) LIKE ? OR lower(w.root) LIKE ?)`
    const rows = await all(`SELECT ${COLS} FROM words w LEFT JOIN progress p ON p.rank = w.rank AND p.student_id = ? WHERE w.status = 'approved' AND ${cond}
      ORDER BY (lower(w.ms) = ?) DESC, (lower(w.ms) LIKE ?) DESC, w.rank LIMIT 30`, st.id, ...(cond.includes('root') ? [like, like] : [like]), k, k + '%')
    return send(res, 200, rows.map(w => brief(wordOut(w, w))))
  }
  if (p === '/api/app/book') return send(res, 200, await book(st, url.searchParams.get('type'), Number(url.searchParams.get('page')) || 0))
  if (p === '/api/app/stats') return send(res, 200, await stats(st))
  if (p === '/api/app/settings' && req.method === 'POST') {
    const b = await body(req)
    const n = [10, 20, 30, 50].includes(Number(b.dailyNew)) ? Number(b.dailyNew) : 20
    await run('UPDATE students SET daily_new = ? WHERE id = ?', n, st.id)
    return send(res, 200, { ok: true, dailyNew: n })
  }
  return fail(res, 404, '接口不存在')
}

// ---------------- 后台接口 ----------------
async function adminApi(req, res, p, url) {
  if (p === '/api/admin/login' && req.method === 'POST') {
    const addr = ip(req)
    if (tooMany(addr)) return fail(res, 429, '登录失败次数太多，请 10 分钟后再试')
    const b = await body(req)
    if (!ADMIN_HASH || b.user !== ADMIN_USER || !checkPassword(b.password, ADMIN_HASH)) { fails.get(addr).push(Date.now()); return fail(res, 401, '账号或密码不对') }
    const token = randomBytes(32).toString('hex')
    sessions.set(token, { user: ADMIN_USER, exp: Date.now() + SESSION_MS })
    const secure = req.headers['x-forwarded-proto'] === 'https' ? '; Secure' : ''
    return send(res, 200, { ok: true }, { 'set-cookie': `jb_admin=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${SESSION_MS / 1000}${secure}` })
  }
  const s = session(req)
  if (!s) return fail(res, 401, '请先登录')
  if (p === '/api/admin/logout') { sessions.delete(cookie(req, 'jb_admin')); return send(res, 200, { ok: true }, { 'set-cookie': 'jb_admin=; Path=/; Max-Age=0' }) }
  if (p === '/api/admin/me') return send(res, 200, { user: s.user, demo: DEMO, audioBase: AUDIO_BASE, stops: STOPS })

  if (p === '/api/admin/overview') {
    const today = day()
    return send(res, 200, {
      words: await all('SELECT level, status, COUNT(*) n FROM words GROUP BY level, status'),
      check: (await one(`SELECT COUNT(*) n FROM words WHERE senses LIKE '%"check":true%'`)).n,
      students: (await one('SELECT COUNT(*) n FROM students')).n,
      activeToday: (await one('SELECT COUNT(DISTINCT student_id) n FROM daily WHERE day = ?', today)).n,
      active7: (await one('SELECT COUNT(DISTINCT student_id) n FROM daily WHERE day >= ?', day(-6))).n,
      learnedToday: (await one('SELECT COALESCE(SUM(new_cnt), 0) n FROM daily WHERE day = ?', today)).n,
      reviewedToday: (await one('SELECT COALESCE(SUM(review_cnt), 0) n FROM daily WHERE day = ?', today)).n
    })
  }

  if (p === '/api/admin/words' && req.method === 'GET') {
    const level = Number(url.searchParams.get('level')) || 0, status = url.searchParams.get('status') || '', k = str(url.searchParams.get('q'), 40).toLowerCase().replace(/[%_]/g, '')
    const page = Math.max(Number(url.searchParams.get('page')) || 0, 0)
    const conds = [], args = []
    if (level) { conds.push('level = ?'); args.push(level) }
    if (['approved', 'pending'].includes(status)) { conds.push('status = ?'); args.push(status) }
    if (status === 'check') conds.push(`senses LIKE '%"check":true%'`)
    if (k) { const l = `%${k}%`; conds.push('(lower(ms) LIKE ? OR lower(root) LIKE ? OR senses LIKE ? OR rank = ?)'); args.push(l, l, l, Number(k) || -1) }
    const where = conds.length ? 'WHERE ' + conds.join(' AND ') : ''
    const total = (await one(`SELECT COUNT(*) n FROM words ${where}`, ...args)).n
    const rows = await all(`SELECT * FROM words ${where} ORDER BY rank LIMIT 100 OFFSET ?`, ...args, page * 100)
    return send(res, 200, { total, page, words: rows.map(w => ({ ...w, senses: JSON.parse(w.senses || '[]'), audioUrl: w.audio ? AUDIO_BASE + w.audio : '' })) })
  }
  const wm = /^\/api\/admin\/words\/(\d+)$/.exec(p)
  if (wm && req.method === 'PUT') {
    const b = await body(req, 64 * 1024), rank = Number(wm[1])
    const w = await one('SELECT * FROM words WHERE rank = ?', rank)
    if (!w) return fail(res, 404, '没有这个词')
    const senses = Array.isArray(b.senses) ? b.senses.map(cleanSense).filter(s => s.zh) : JSON.parse(w.senses)
    const ms = b.ms !== undefined ? str(b.ms, 80) : w.ms
    if (!ms) return fail(res, 400, '马来语不能为空')
    const status = b.status !== undefined ? (b.status === 'approved' ? 'approved' : 'pending') : w.status
    if (status === 'approved' && !senses.some(s => !s.check)) return fail(res, 400, '至少要有一条审过的释义才能上架')
    await run('UPDATE words SET ms = ?, root = ?, senses = ?, status = ?, edited = 1, updated_at = ? WHERE rank = ?', ms, b.root !== undefined ? str(b.root, 80) : w.root, JSON.stringify(senses), status, new Date().toISOString(), rank)
    return send(res, 200, { ok: true })
  }
  if (p === '/api/admin/words/import' && req.method === 'POST') {
    const b = await body(req, 8 * 1024 * 1024)
    if (!Array.isArray(b.words)) return fail(res, 400, '格式不对:要 build.py 生成的 words.json')
    return send(res, 200, await importWords(b.words, { overwriteEdited: !!b.overwriteEdited }))
  }

  if (p === '/api/admin/students' || p === '/api/admin/students.csv') {
    const rows = await all(`SELECT s.*, (SELECT COUNT(*) FROM progress p WHERE p.student_id = s.id AND p.seen > 0) learned, (SELECT COUNT(*) FROM progress p WHERE p.student_id = s.id AND p.box = 6) mastered,
      (SELECT COUNT(*) FROM daily d WHERE d.student_id = s.id AND (d.new_cnt + d.review_cnt) > 0) days FROM students s ORDER BY s.last_active_at DESC`)
    if (p.endsWith('.csv')) {
      const head = ['姓名', '学校', '班级', '起点', '手机号', '已学', '已掌握', '学习天数', '注册时间', '最近活跃']
      const lines = rows.map(r => [r.name, r.school, r.class_name, r.track === 'some' ? '会说一些' : '零基础', r.phone, r.learned, r.mastered, r.days, r.created_at, r.last_active_at].map(csvCell).join(','))
      res.writeHead(200, { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': `attachment; filename="students-${day()}.csv"`, 'cache-control': 'no-store' })
      return res.end('﻿' + [head.join(','), ...lines].join('\n'))
    }
    return send(res, 200, rows.map(r => ({ id: r.id, name: r.name, school: r.school, className: r.class_name, track: r.track, phone: r.phone, learned: r.learned, mastered: r.mastered, days: r.days, createdAt: r.created_at, lastActiveAt: r.last_active_at })))
  }

  if (p === '/api/admin/teachers' && req.method === 'GET') return send(res, 200, await all('SELECT * FROM teachers ORDER BY sort, id'))
  const tm = /^\/api\/admin\/teachers(?:\/(\d+))?$/.exec(p)
  if (tm && (req.method === 'POST' || req.method === 'PUT')) {
    const b = await body(req, 8 * 1024 * 1024)
    const d = { name: str(b.name, 30), title: str(b.title, 100), role: str(b.role, 30), bio: str(b.bio, 1000), photo: str(b.photo, 300), sort: Number(b.sort) || 0 }
    if (!d.name) return fail(res, 400, '请填写姓名')
    if (b.photoData) d.photo = savePhoto(b.photoData)
    if (tm[1]) await run('UPDATE teachers SET name = ?, title = ?, role = ?, bio = ?, photo = ?, sort = ? WHERE id = ?', d.name, d.title, d.role, d.bio, d.photo, d.sort, Number(tm[1]))
    else await run('INSERT INTO teachers (name, title, role, bio, photo, sort) VALUES (?, ?, ?, ?, ?, ?)', d.name, d.title, d.role, d.bio, d.photo, d.sort)
    return send(res, 200, { ok: true })
  }
  if (tm && tm[1] && req.method === 'DELETE') { await run('DELETE FROM teachers WHERE id = ?', Number(tm[1])); return send(res, 200, { ok: true }) }
  return fail(res, 404, '接口不存在')
}

function savePhoto(dataUrl) {
  const m = /^data:image\/(jpeg|png|webp);base64,(.+)$/.exec(String(dataUrl))
  if (!m) throw Object.assign(new Error('只支持 jpg / png / webp 图片'), { code: 400 })
  const buf = Buffer.from(m[2], 'base64')
  if (buf.length > 5 * 1024 * 1024) throw Object.assign(new Error('图片不能超过 5MB'), { code: 400 })
  const name = `t-${randomBytes(6).toString('hex')}.${m[1] === 'jpeg' ? 'jpg' : m[1]}`
  writeFileSync(join(DATA, 'uploads', name), buf)
  return `/uploads/${name}`
}

// ---------------- 静态文件 ----------------
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.mp3': 'audio/mpeg' }
function file(res, path, cache = 'no-cache') {
  if (!existsSync(path) || !statSync(path).isFile()) return false
  res.writeHead(200, { 'content-type': TYPES[extname(path).toLowerCase()] || 'application/octet-stream', 'cache-control': cache })
  res.end(readFileSync(path))
  return true
}
const safe = s => normalize(decodeURIComponent(s)).replace(/^(\.\.[/\\])+/, '').replace(/^[/\\]+/, '')

const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x')
  const p = url.pathname
  res.setHeader('x-content-type-options', 'nosniff')
  res.setHeader('referrer-policy', 'no-referrer')
  try {
    if (p.startsWith('/api/app/')) return await appApi(req, res, p, url)
    if (p.startsWith('/api/admin/')) return await adminApi(req, res, p, url)
    if (p.startsWith('/api/')) return fail(res, 404, '接口不存在')
    res.setHeader('x-frame-options', 'DENY')
    // 老师照片(小程序也读,公开)
    if (p.startsWith('/uploads/') && file(res, join(DATA, 'uploads', safe(p.slice(9))), 'public, max-age=86400')) return
    // 演示模式:音频从本机目录读(DEMO_AUDIO_DIR 指向解压后的启航音频包),正式环境走 COS
    if (DEMO && p.startsWith('/demo-audio/') && ENV.DEMO_AUDIO_DIR && file(res, join(ENV.DEMO_AUDIO_DIR, safe(p.slice(12))), 'public, max-age=86400')) return
    if (file(res, join(PUBLIC, p === '/' ? 'index.html' : safe(p)))) return
    file(res, join(PUBLIC, 'index.html'))
  } catch (e) {
    const code = e instanceof SyntaxError ? 400 : (Number.isInteger(e.code) ? e.code : 500)
    if (code === 500) console.error(e)
    if (!res.headersSent) fail(res, code, e instanceof SyntaxError ? '请求格式不对' : (code === 500 ? '服务器出错' : e.message))
  }
})
await init()
server.listen(PORT, HOST, () => {
  console.log(`JomBelajar 背单词服务:http://${HOST}:${PORT}`)
  if (DEMO) console.warn('⚠ 演示模式(DEMO=1):小程序登录不校验,后台 admin / admin123。不要这样上线。')
})
