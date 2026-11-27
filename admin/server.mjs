// JomBelajar 背单词服务(Node 22+,MySQL 5.7/8.0,唯一依赖 mysql2)
//   线上:docker compose 起(见仓库根目录 docker-compose.yml),配置从环境变量读
//   本机:DATABASE_URL=mysql://用户:密码@主机:3306/库名 node admin/server.mjs(也可以写进 ADMIN_ENV 指定的文件)
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
import mysql from 'mysql2/promise'
import { makeAdminApi } from './admin-api.mjs'
import { createBattle } from './battle.mjs'
import { createAchievements } from './achievements.mjs'
import { alikeSource } from './alike.mjs'
import { createTts } from './tts.mjs'
import { createPlacement, AUTO_DIFF_SQL, DIFFS } from './placement.mjs'

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
// 后台 AI 生成的发音存在本机 /uploads/tts/，要拼成完整地址给小程序（小程序在 api 域名下读）
const API_ORIGIN = (ENV.API_ORIGIN || (DEMO ? `http://${PUBLIC_HOST}` : 'https://api.bahasa.cn')).replace(/\/$/, '')
// 库里的 audio：启航原声只存文件名（拼 COS 的 AUDIO_BASE）；AI 生成的存 /uploads/tts/…（拼 API_ORIGIN）
const audioUrl = a => !a ? '' : /^https?:\/\//.test(a) ? a : a.startsWith('/uploads/') ? API_ORIGIN + a : AUDIO_BASE + a
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
// 默认的 10 站:第一次启动写进 courses 表,之后在后台「课程」里改
const DEFAULT_STOPS = [
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
// decimalNumbers:SUM() 返回数字而不是字符串;dateStrings:不让驱动把文本日期转成 Date
const pool = mysql.createPool({ uri: ENV.DATABASE_URL, connectionLimit: 10, charset: 'utf8mb4', decimalNumbers: true, dateStrings: true, supportBigNumbers: true })
// 建表一条一条执行(MySQL 不支持一次多条,也不支持 CREATE INDEX IF NOT EXISTS,索引写进建表语句)
const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS meta (k VARCHAR(64) PRIMARY KEY, v TEXT) DEFAULT CHARSET = utf8mb4`,
  `CREATE TABLE IF NOT EXISTS words (\`rank\` INT PRIMARY KEY, ms VARCHAR(120) NOT NULL, root VARCHAR(120) NOT NULL DEFAULT '', level INT NOT NULL, senses MEDIUMTEXT, audio VARCHAR(255) NOT NULL DEFAULT '', status VARCHAR(16) NOT NULL DEFAULT 'pending', edited TINYINT NOT NULL DEFAULT 0, updated_at VARCHAR(32), INDEX words_level (level, status)) DEFAULT CHARSET = utf8mb4`,
  `CREATE TABLE IF NOT EXISTS students (id INT AUTO_INCREMENT PRIMARY KEY, openid VARCHAR(64) NOT NULL UNIQUE, name VARCHAR(60), school VARCHAR(120), class_name VARCHAR(80), track VARCHAR(16), phone VARCHAR(32), daily_new INT NOT NULL DEFAULT 20, created_at VARCHAR(32), last_active_at VARCHAR(32)) DEFAULT CHARSET = utf8mb4`,
  `CREATE TABLE IF NOT EXISTS progress (student_id INT NOT NULL, \`rank\` INT NOT NULL, box INT NOT NULL DEFAULT 0, due VARCHAR(10), wrong INT NOT NULL DEFAULT 0, seen INT NOT NULL DEFAULT 0, fav TINYINT NOT NULL DEFAULT 0, first_at VARCHAR(32), last_day VARCHAR(10), last_at VARCHAR(32), PRIMARY KEY (student_id, \`rank\`), INDEX progress_due (student_id, due)) DEFAULT CHARSET = utf8mb4`,
  `CREATE TABLE IF NOT EXISTS daily (student_id INT NOT NULL, day VARCHAR(10) NOT NULL, new_cnt INT NOT NULL DEFAULT 0, review_cnt INT NOT NULL DEFAULT 0, right_cnt INT NOT NULL DEFAULT 0, PRIMARY KEY (student_id, day)) DEFAULT CHARSET = utf8mb4`,
  `CREATE TABLE IF NOT EXISTS teachers (id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(60), title VARCHAR(200), role VARCHAR(60), bio TEXT, photo VARCHAR(300), sort INT NOT NULL DEFAULT 0) DEFAULT CHARSET = utf8mb4`,
  // 课程 = 旅程的 10 站;published = 0 时小程序里不出现,也不发这一站的新词
  `CREATE TABLE IF NOT EXISTS courses (level INT PRIMARY KEY, city VARCHAR(40) NOT NULL, ms VARCHAR(60) NOT NULL DEFAULT '', note VARCHAR(120) NOT NULL DEFAULT '', intro TEXT, published TINYINT NOT NULL DEFAULT 1, updated_at VARCHAR(32)) DEFAULT CHARSET = utf8mb4`,
  // 后台账号、角色(permissions 是 JSON 数组,超级管理员是 ["*"])、登录会话(只存 token 的 sha256)、操作日志
  `CREATE TABLE IF NOT EXISTS admin_roles (id INT AUTO_INCREMENT PRIMARY KEY, code VARCHAR(32) NOT NULL UNIQUE, name VARCHAR(40) NOT NULL, description VARCHAR(200) NOT NULL DEFAULT '', permissions TEXT, builtin TINYINT NOT NULL DEFAULT 0, created_at VARCHAR(32)) DEFAULT CHARSET = utf8mb4`,
  `CREATE TABLE IF NOT EXISTS admin_users (id INT AUTO_INCREMENT PRIMARY KEY, username VARCHAR(40) NOT NULL UNIQUE, name VARCHAR(40) NOT NULL DEFAULT '', password_hash VARCHAR(200) NOT NULL, role_id INT, status VARCHAR(16) NOT NULL DEFAULT 'active', must_change TINYINT NOT NULL DEFAULT 0, last_login_at VARCHAR(32), last_login_ip VARCHAR(64), created_at VARCHAR(32), updated_at VARCHAR(32)) DEFAULT CHARSET = utf8mb4`,
  `CREATE TABLE IF NOT EXISTS admin_sessions (token_hash CHAR(64) PRIMARY KEY, user_id INT NOT NULL, created_at VARCHAR(32), expires_at BIGINT NOT NULL, ip VARCHAR(64), ua VARCHAR(200), INDEX admin_sessions_user (user_id)) DEFAULT CHARSET = utf8mb4`,
  `CREATE TABLE IF NOT EXISTS audit_log (id BIGINT AUTO_INCREMENT PRIMARY KEY, at VARCHAR(32) NOT NULL, user_id INT, username VARCHAR(40) NOT NULL DEFAULT '', action VARCHAR(40) NOT NULL, target VARCHAR(120) NOT NULL DEFAULT '', detail TEXT, ip VARCHAR(64), INDEX audit_at (at)) DEFAULT CHARSET = utf8mb4`
]
// 旧表加列:MySQL 5.7 没有 ADD COLUMN IF NOT EXISTS,先查 information_schema
const COLUMNS = [
  ['students', 'status', `VARCHAR(16) NOT NULL DEFAULT 'active'`],
  ['students', 'note', `VARCHAR(500) NOT NULL DEFAULT ''`],
  ['words', 'topic', `VARCHAR(32) NOT NULL DEFAULT ''`],
  ['words', 'extra', 'MEDIUMTEXT'], // 例句、搭配、同义 / 反义、提示、配图(词光要用的字段),JSON
  ['students', 'mascot', `VARCHAR(64) NOT NULL DEFAULT ''`], // 学生选的犀鸟形象（achievements.mjs），当头像用
  // 单词难度和入门测评（placement.mjs）
  ['words', 'difficulty', 'TINYINT NOT NULL DEFAULT 0'], // 1–5；0 = 还没定，启动和导入后按词频自动补
  ['progress', 'miss', 'TINYINT NOT NULL DEFAULT 0'], // 测评里答错的词（还没学），新词里先推
  ['students', 'diff_level', 'TINYINT NOT NULL DEFAULT 0'], // 推荐从哪一档难度学；0 = 还没测
  ['students', 'placed_at', 'VARCHAR(32)'],
  ['students', 'placement', 'TEXT'], // 最近一次测评结果 JSON
  ['students', 'lv_new', 'INT NOT NULL DEFAULT 0'], // 自动调档：推荐档里学了几个新词
  ['students', 'lv_know', 'INT NOT NULL DEFAULT 0'] //          其中认识几个
]
// rank 在 MySQL 8 是保留字:SQL 里没带表名前缀的 rank 自动加反引号(w.rank / p.rank 这种不用)
const mySql = sql => sql.replace(/(?<![.\w`])rank\b/g, '`rank`')
const helpers = c => ({
  all: async (sql, ...a) => (await c.query(mySql(sql), a))[0],
  one: async (sql, ...a) => (await c.query(mySql(sql), a))[0][0],
  run: async (sql, ...a) => (await c.query(mySql(sql), a))[0]
})
const { all, one, run } = helpers(pool)
async function tx(fn) {
  const c = await pool.getConnection()
  try { await c.beginTransaction(); const r = await fn(helpers(c)); await c.commit(); return r } catch (e) { await c.rollback(); throw e } finally { c.release() }
}
let STOPS = DEFAULT_STOPS.map(s => ({ ...s, published: true })) // 启动后从 courses 表读
async function reloadStops() { STOPS = (await all('SELECT level, city, ms, note, intro, published FROM courses ORDER BY level')).map(c => ({ ...c, intro: c.intro || '', published: !!c.published })) }
const openLevels = () => STOPS.filter(s => s.published).map(s => s.level)
// 听起来像的干扰项（alike.mjs）：全部已审核的词，内存里缓存 10 分钟
const alikeOf = alikeSource(async () => (await all(`SELECT rank, ms, senses FROM words WHERE status = 'approved'`)).map(w => ({ rank: w.rank, ms: w.ms, zh: (JSON.parse(w.senses || '[]').find(s => !s.check) || {}).zh || '' })))
const battle = createBattle({ all, one, run, day: (o = 0) => day(o), AUDIO_BASE, audioUrl, openLevels, alikeOf, avatarOf: s => ach.imgOf(s.mascot) })
const ach = createAchievements({ all, one, run, day: (o = 0) => day(o), levelsOf: sid => levelsOf(sid), weekStart: () => battle.weekStart() }) // 成就与犀鸟形象（achievements.mjs） // 好友 PK、周榜、每周擂台（battle.mjs）
const placement = createPlacement({ all, one, run, tx, day: (o = 0) => day(o), openLevels, audioUrl })
const fillDifficulty = () => run(`UPDATE words SET difficulty = ${AUTO_DIFF_SQL} WHERE difficulty = 0`)
let TOKEN_KEY = '' // 小程序 token 的签名密钥:第一次启动随机生成,存在 meta 表里

const str = (v, max = 500) => String(v ?? '').trim().slice(0, max)
const cleanSense = s => { const o = { pos: str(s.pos, 20), zh: str(s.zh, 200), exMs: str(s.exMs, 400), exZh: str(s.exZh, 400) }; const en = str(s.en, 200); if (en) o.en = en; if (s.check) o.check = true; return o }

// 导入词库(content/vocab5000/words.json 的格式)。后台改过的词(edited=1)默认不覆盖
async function importWords(list, { overwriteEdited = false } = {}) {
  const now = new Date().toISOString()
  let changed = 0
  // 后台改过的词(edited = 1)不覆盖,除非勾了「覆盖已改过的」
  const keep = overwriteEdited ? new Set() : new Set((await all('SELECT rank FROM words WHERE edited = 1')).map(r => r.rank))
  await tx(async c => {
    for (const w of list) {
      const rank = Number(w.rank)
      if (!Number.isInteger(rank) || rank < 1 || rank > 20000 || !w.ms || keep.has(rank)) continue
      const senses = (Array.isArray(w.senses) ? w.senses : []).map(cleanSense).filter(s => s.zh)
      const status = w.status === 'approved' && senses.some(s => !s.check) ? 'approved' : 'pending'
      const r = await c.run(`INSERT INTO words (rank, ms, root, level, senses, audio, status, edited, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)
        ON DUPLICATE KEY UPDATE ms = VALUES(ms), root = VALUES(root), level = VALUES(level), senses = VALUES(senses), audio = VALUES(audio), status = VALUES(status), edited = 0, updated_at = VALUES(updated_at)`,
        rank, str(w.ms, 80), str(w.root, 80), Number(w.level) || Math.ceil(rank / 500), JSON.stringify(senses), str(w.audio, 200), status, now)
      if (r.affectedRows) changed++
    }
  })
  await fillDifficulty()
  return { total: list.length, changed }
}

async function init() {
  for (let i = 0; ; i++) { // 数据库容器可能还没起来,等一会儿
    try { await pool.query('SELECT 1'); break } catch (e) { if (i >= 30) throw e; await new Promise(r => setTimeout(r, 1000)) }
  }
  for (const q of [...SCHEMA, ...battle.SCHEMA, ...ach.SCHEMA]) await pool.query(q)
  for (const [t, c, def] of COLUMNS) {
    if (!(await one('SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?', t, c))) await pool.query(`ALTER TABLE ${t} ADD COLUMN ${c} ${def}`)
  }
  for (const s of DEFAULT_STOPS) await run('INSERT IGNORE INTO courses (level, city, ms, note, intro, published, updated_at) VALUES (?, ?, ?, ?, ?, 1, ?)', s.level, s.city, s.ms, s.note, '', new Date().toISOString())
  await reloadStops()
  await admin.bootstrap({ ADMIN_USER, ADMIN_HASH })
  const k = await one('SELECT v FROM meta WHERE k = ?', 'token_key')
  TOKEN_KEY = k ? k.v : randomBytes(32).toString('hex')
  if (!k) await run('INSERT IGNORE INTO meta (k, v) VALUES (?, ?)', 'token_key', TOKEN_KEY)
  if (!(await one('SELECT 1 FROM words LIMIT 1'))) {
    const seed = [join(HERE, '../content/vocab5000/words.json'), join(HERE, 'words.json')].find(existsSync)
    if (seed) console.log('首次启动,导入词库:', await importWords(JSON.parse(readFileSync(seed, 'utf8'))))
  }
  await fillDifficulty()
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
  return { rank: w.rank, ms: w.ms, root: w.root, level: w.level, diff: w.difficulty || 0, senses, audio: audioUrl(w.audio), box: p && p.box != null ? p.box : -1, fav: !!(p && p.fav), wrong: (p && p.wrong) || 0 }
}
async function streakOf(sid) {
  const days = new Set((await all('SELECT day FROM daily WHERE student_id = ? AND (new_cnt + review_cnt) > 0 AND day >= ?', sid, day(-400))).map(r => r.day))
  const start = days.has(day()) ? 0 : -1 // 今天还没学,不算断
  let n = 0
  while (days.has(day(start - n))) n++
  return { streak: n, checkedToday: days.has(day()) }
}
async function levelsOf(sid, all_ = false) {
  const rows = await all(`SELECT w.level, COUNT(*) total, MIN(w.rank) first, MAX(w.rank) last, SUM(CASE WHEN p.seen > 0 THEN 1 ELSE 0 END) learned, SUM(CASE WHEN p.box = 6 THEN 1 ELSE 0 END) mastered
    FROM words w LEFT JOIN progress p ON p.rank = w.rank AND p.student_id = ? WHERE w.status = 'approved' GROUP BY w.level`, sid)
  const by = Object.fromEntries(rows.map(r => [r.level, r]))
  return STOPS.filter(s => all_ || s.published).map(s => {
    const r = by[s.level] || {}
    const total = Number(r.total || 0), learned = Number(r.learned || 0)
    return { ...s, total, learned, mastered: Number(r.mastered || 0), first: Number(r.first || 0), last: Number(r.last || 0), open: total > 0, stamped: total > 0 && learned >= total }
  })
}
function currentLevel(levels) { const l = levels.find(l => l.open && !l.stamped); return l ? l.level : ((levels.filter(l => l.open).pop() || levels[0]) || { level: 1 }).level }

async function home(st) {
  const sid = st.id, today = day()
  const levels = await levelsOf(sid)
  // 测过的学生：当前站 = 下一个推荐词所在的站
  const focus = st.diff_level ? await placement.focusLevel(st) : 0
  const d = await one('SELECT * FROM daily WHERE student_id = ? AND day = ?', sid, today) || { new_cnt: 0, review_cnt: 0 }
  const due = (await one('SELECT COUNT(*) n FROM progress WHERE student_id = ? AND seen > 0 AND box < 6 AND due <= ?', sid, today)).n
  const tot = await one('SELECT SUM(CASE WHEN seen > 0 THEN 1 ELSE 0 END) learned, SUM(CASE WHEN box = 6 THEN 1 ELSE 0 END) mastered, COALESCE(SUM(fav), 0) fav, SUM(CASE WHEN wrong > 0 AND box < 6 THEN 1 ELSE 0 END) wrong FROM progress WHERE student_id = ?', sid)
  return {
    student: studentOut(st), levels, level: focus || currentLevel(levels),
    placement: placement.summary(st), diffs: DIFFS,
    today: { goal: st.daily_new, learned: d.new_cnt, reviewed: d.review_cnt, newLeft: Math.max(st.daily_new - d.new_cnt, 0), due: Number(due) },
    total: { learned: Number(tot.learned || 0), mastered: Number(tot.mastered || 0), fav: Number(tot.fav || 0), wrong: Number(tot.wrong || 0), words: levels.reduce((n, l) => n + l.total, 0) },
    ...(await streakOf(sid))
  }
}

const COLS = 'w.*, p.box, p.fav, p.wrong'
// 开一组:mode = today(到期复习 + 今天剩下的新词)/ review / new(level 指定一站,10 个)/ more(再推 10 个新词)/ wrong(错词重练)/ fav(收藏)
// 测过的学生(diff_level > 0)today / more 的新词按难度推(placement.pickNew),没测过的照旧按站
async function start(st, b) {
  const sid = st.id, today = day()
  const mode = ['today', 'review', 'new', 'more', 'wrong', 'fav'].includes(b.mode) ? b.mode : 'today'
  let review = [], fresh = []
  if (mode === 'today' || mode === 'review') review = await all(`SELECT ${COLS} FROM progress p JOIN words w ON w.rank = p.rank WHERE p.student_id = ? AND p.seen > 0 AND p.box < 6 AND p.due <= ? AND w.status = 'approved' ORDER BY p.due, p.box LIMIT ?`, sid, today, REVIEW_MAX)
  if (mode === 'wrong') review = await all(`SELECT ${COLS} FROM progress p JOIN words w ON w.rank = p.rank WHERE p.student_id = ? AND p.wrong > 0 AND p.box < 6 AND w.status = 'approved' ORDER BY p.wrong DESC, p.last_at LIMIT 20`, sid)
  if (mode === 'fav') review = await all(`SELECT ${COLS} FROM progress p JOIN words w ON w.rank = p.rank WHERE p.student_id = ? AND p.fav = 1 AND w.status = 'approved' ORDER BY p.last_at LIMIT 20`, sid)
  if (mode === 'today' || mode === 'new' || mode === 'more') {
    const d = await one('SELECT new_cnt FROM daily WHERE student_id = ? AND day = ?', sid, today)
    const left = mode === 'new' || mode === 'more' ? 10 : Math.max(st.daily_new - (d ? d.new_cnt : 0), 0)
    const level = mode === 'new' ? Number(b.level) || 1 : currentLevel(await levelsOf(sid))
    if (left && mode !== 'new' && st.diff_level) fresh = await placement.pickNew(st, left, COLS)
    else if (left) fresh = await all(`SELECT ${COLS} FROM words w LEFT JOIN progress p ON p.rank = w.rank AND p.student_id = ? WHERE (p.rank IS NULL OR p.seen = 0) AND w.status = 'approved' AND w.level ${mode === 'new' ? '=' : '>='} ? AND w.level IN (?) ORDER BY w.rank LIMIT ?`, sid, level, openLevels().length ? openLevels() : [0], left)
  }
  const items = [...review.map(w => ({ ...wordOut(w, w), kind: 'review' })), ...fresh.map(w => ({ ...wordOut(w, w), kind: 'new' }))]
  // 出题用的干扰项:同一站的其他词
  const levels = [...new Set(items.map(i => i.level))]
  const pool = levels.length ? await all(`SELECT rank, ms, senses FROM words WHERE status = 'approved' AND level IN (${levels.map(() => '?').join(',')}) ORDER BY RAND() LIMIT 80`, ...levels) : []
  // 每个词带三个听起来像的词，听音选词 / 看义选词用它们当干扰项
  const pick = await alikeOf()
  for (const it of items) it.alike = pick({ rank: it.rank, ms: it.ms, zh: (it.senses[0] || {}).zh || '' }).map(o => ({ rank: o.rank, ms: o.ms, zh: o.zh }))
  return { mode, items, pool: pool.map(w => ({ rank: w.rank, ms: w.ms, zh: (JSON.parse(w.senses).find(s => !s.check) || {}).zh || '' })) }
}

async function grade(st, b) {
  const sid = st.id, today = day(), rank = Number(b.rank)
  const wd = await one(`SELECT difficulty FROM words WHERE rank = ? AND status = 'approved'`, rank)
  if (!wd) throw Object.assign(new Error('没有这个词'), { code: 404 })
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
      ON DUPLICATE KEY UPDATE first_at = CASE WHEN seen = 0 THEN VALUES(first_at) ELSE first_at END, seen = seen + 1,
        box = VALUES(box), due = VALUES(due), wrong = VALUES(wrong), last_day = VALUES(last_day), last_at = VALUES(last_at)`, sid, rank, box, due, wrong, today, today, now)
    await c.run(`INSERT INTO daily (student_id, day, new_cnt, review_cnt, right_cnt) VALUES (?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE new_cnt = new_cnt + VALUES(new_cnt), review_cnt = review_cnt + VALUES(review_cnt), right_cnt = right_cnt + VALUES(right_cnt)`,
      sid, today, isNew ? 1 : 0, reviewCounted ? 1 : 0, result === 'know' || result === 'mastered' ? 1 : 0)
    await c.run('UPDATE students SET last_active_at = ? WHERE id = ?', now, sid)
  })
  // 测过的学生学新词：攒够一批看看要不要升降一档（levelChange 给小程序提示）
  const levelChange = isNew ? await placement.adjust(st, Number(wd.difficulty) || 0, result) : null
  return { ok: true, box, due, levelChange }
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

const studentOut = s => s ? { avatar: ach.imgOf(s.mascot), mascot: s.mascot || '', name: s.name, school: s.school, className: s.class_name, track: s.track, phone: s.phone, dailyNew: s.daily_new, createdAt: s.created_at } : null

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
// 微信内容安全：学生填的昵称、学校、班级会出现在排行榜和 PK 里给别人看，提交前过一遍 msgSecCheck（2.0，资料场景）。
// access_token 缓存到快过期；微信接口出错时不放行（宁可让学生稍后再试，也不展示没检查过的内容）
let wxToken = { v: '', exp: 0 }
async function accessToken() {
  if (wxToken.v && wxToken.exp > Date.now()) return wxToken.v
  const d = await (await fetch(`https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${ENV.APPID}&secret=${ENV.APPSECRET}`)).json()
  if (!d.access_token) throw Object.assign(new Error('内容检查暂时不可用，请稍后再试'), { code: 503 })
  wxToken = { v: d.access_token, exp: Date.now() + (d.expires_in - 300) * 1000 }
  return wxToken.v
}
async function textSafe(openid, content) {
  if (DEMO || !content) return true
  for (let i = 0; i < 2; i++) {
    const d = await (await fetch(`https://api.weixin.qq.com/wxa/msg_sec_check?access_token=${await accessToken()}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ content, version: 2, scene: 1, openid }) })).json()
    if (d.errcode === 40001 || d.errcode === 42001) { wxToken = { v: '', exp: 0 }; continue } // token 失效，换一个再试
    if (d.errcode) throw Object.assign(new Error('内容检查暂时不可用，请稍后再试'), { code: 503 })
    return d.result && d.result.suggest === 'pass'
  }
  throw Object.assign(new Error('内容检查暂时不可用，请稍后再试'), { code: 503 })
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
const ip = req => (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim()
function cookie(req, name) { const m = new RegExp(`(?:^|;\\s*)${name}=([^;]+)`).exec(req.headers.cookie || ''); return m ? m[1] : '' }
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
    // 打开就能学：第一次登录自动建学生，姓名、学校这些以后在「我的」里选填
    const now = new Date().toISOString()
    await run(`INSERT IGNORE INTO students (openid, name, school, class_name, track, phone, created_at, last_active_at) VALUES (?, '', '', '', 'zero', '', ?, ?)`, openid, now, now)
    return send(res, 200, { token: signToken(openid), student: studentOut(await one('SELECT * FROM students WHERE openid = ?', openid)) })
  }
  const openid = readToken(req)
  if (!openid) return fail(res, 401, '请重新登录')
  const hits = (appHits.get(openid) || []).filter(t => t > Date.now() - 60e3); hits.push(Date.now()); appHits.set(openid, hits)
  if (hits.length > 120) return fail(res, 429, '操作太快了,歇一下')

  if (p === '/api/app/register' && req.method === 'POST') {
    const b = await body(req)
    const name = str(b.name, 30), school = str(b.school, 60), className = str(b.className, 40), phone = str(b.phone, 20).replace(/[\s-]/g, '')
    // 资料全部选填；填了手机号才校验格式。只要填了任何个人资料，就要先同意隐私说明
    if (phone && !/^1\d{10}$|^\+?\d{8,15}$/.test(phone)) return fail(res, 400, '手机号格式不对')
    if ((name || school || className || phone) && !b.agree) return fail(res, 400, '请先阅读并同意隐私说明')
    if (!(await textSafe(openid, [name, school, className].filter(Boolean).join(' ')))) return fail(res, 400, '昵称、学校或班级里有不合适的内容，请修改后再保存')
    const now = new Date().toISOString()
    await run(`INSERT INTO students (openid, name, school, class_name, track, phone, created_at, last_active_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE name = VALUES(name), school = VALUES(school), class_name = VALUES(class_name), track = VALUES(track), phone = VALUES(phone)`,
      openid, name, school, className, ['some', 'heritage'].includes(b.track) ? 'some' : 'zero', phone, now, now)
    return send(res, 200, { ok: true, student: studentOut(await one('SELECT * FROM students WHERE openid = ?', openid)) })
  }
  // 删除我的资料和学习记录（隐私说明页里的按钮）：立即删除，不可恢复
  if (p === '/api/app/delete-me' && req.method === 'POST') {
    const me = await one('SELECT id FROM students WHERE openid = ?', openid)
    if (me) for (const t of ['progress', 'daily', 'pk_entry', 'arena_entry', 'arena_try', 'achievements', 'students']) await run(`DELETE FROM ${t} WHERE ${t === 'students' ? 'id' : 'student_id'} = ?`, me.id)
    return send(res, 200, { ok: true })
  }
  if (p === '/api/app/teachers') return send(res, 200, await all('SELECT name, title, role, bio, photo FROM teachers ORDER BY sort, id'))

  const st = await one('SELECT * FROM students WHERE openid = ?', openid)
  if (!st) return fail(res, 403, '请先注册')
  if (st.status === 'disabled') return fail(res, 403, '账号已停用,请联系老师')
  const ar = await ach.handle(st, p, req, body)
  if (ar !== undefined) return send(res, 200, ar)
  const br = await battle.handle(st, p, req, url, body)
  if (br !== undefined) return send(res, 200, br)
  if (p === '/api/app/home') return send(res, 200, await home(st))
  // 入门测评：GET 出题，POST 交卷（或 { skip: true } 先不测）
  if (p === '/api/app/placement' && req.method === 'GET') return send(res, 200, await placement.questions(st, url.searchParams.get('from')))
  if (p === '/api/app/placement' && req.method === 'POST') return send(res, 200, await placement.submit(st, await body(req)))
  if (p === '/api/app/start' && req.method === 'POST') return send(res, 200, await start(st, await body(req)))
  if (p === '/api/app/grade' && req.method === 'POST') return send(res, 200, await grade(st, await body(req)))
  if (p === '/api/app/fav' && req.method === 'POST') {
    const b = await body(req), rank = Number(b.rank)
    if (!await one(`SELECT 1 FROM words WHERE rank = ? AND status = 'approved'`, rank)) return fail(res, 404, '没有这个词')
    // 没学过的词也能收藏:建一条 seen = 0 的记录,不算已学
    await run(`INSERT INTO progress (student_id, rank, box, due, fav, last_at) VALUES (?, ?, 0, ?, ?, ?) ON DUPLICATE KEY UPDATE fav = VALUES(fav)`, st.id, rank, day(), b.on ? 1 : 0, new Date().toISOString())
    return send(res, 200, { ok: true })
  }
  if (p === '/api/app/level') {
    const level = Number(url.searchParams.get('level')) || 1
    const rows = await all(`SELECT ${COLS} FROM words w LEFT JOIN progress p ON p.rank = w.rank AND p.student_id = ? WHERE w.level = ? AND w.status = 'approved' ORDER BY w.rank`, st.id, level)
    return send(res, 200, { stop: (await levelsOf(st.id)).find(l => l.level === level), words: rows.map(w => { const o = wordOut(w, w); return { rank: o.rank, ms: o.ms, zh: (o.senses[0] || {}).zh || '', pos: (o.senses[0] || {}).pos || '', diff: o.diff, box: o.box, fav: o.fav, audio: o.audio } }) })
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
    // 中文先粗查 senses 文本,再在这里只留「审过的释义里含这个词」的(不依赖 MySQL 8 的 JSON_TABLE)
    const zh = /[\u4e00-\u9fff]/.test(k)
    const cond = zh ? `w.senses LIKE ?` : `(lower(w.ms) LIKE ? OR lower(w.root) LIKE ?)`
    const rows = await all(`SELECT ${COLS} FROM words w LEFT JOIN progress p ON p.rank = w.rank AND p.student_id = ? WHERE w.status = 'approved' AND ${cond}
      ORDER BY (lower(w.ms) = ?) DESC, (lower(w.ms) LIKE ?) DESC, w.rank LIMIT ?`, st.id, ...(zh ? [like] : [like, like]), k, k + '%', zh ? 200 : 30)
    const out = rows.map(w => wordOut(w, w)).filter(o => !zh || o.senses.some(s => s.zh.toLowerCase().includes(k))).slice(0, 30)
    return send(res, 200, out.map(brief))
  }
  if (p === '/api/app/book') return send(res, 200, await book(st, url.searchParams.get('type'), Number(url.searchParams.get('page')) || 0))
  if (p === '/api/app/stats') return send(res, 200, await stats(st))
  // 记得多牢 + 未来 7 天复习量（护照页）：牢固 = 已掌握或盒子 ≥ 4；熟悉 = 盒子 1–3；快忘了 = 盒子 0 或已到期；没见过 = 已上架但没学过
  // 按天的词云（图鉴）：每个词按第一次学的日期（北京时间）分组，最近 60 天，每天最多 200 个
  if (p === '/api/app/days') {
    const rows = await all(`SELECT p.rank, p.first_at, p.box, w.ms, w.senses, w.audio FROM progress p JOIN words w ON w.rank = p.rank
      WHERE p.student_id = ? AND p.seen > 0 AND p.first_at IS NOT NULL AND p.first_at >= ? ORDER BY p.first_at`, st.id, new Date(Date.now() - 61 * 86400e3).toISOString())
    const byDay = new Map()
    for (const r of rows) {
      const d = new Date(new Date(r.first_at).getTime() + 8 * 3600e3).toISOString().slice(0, 10)
      if (!byDay.has(d)) byDay.set(d, [])
      const list = byDay.get(d)
      if (list.length < 200) list.push({ rank: r.rank, ms: r.ms, zh: (JSON.parse(r.senses || '[]').find(x => !x.check) || {}).zh || '', box: r.box, audio: audioUrl(r.audio) })
    }
    return send(res, 200, { days: [...byDay.entries()].map(([day, words]) => ({ day, words })) })
  }
  if (p === '/api/app/memory') {
    const today = day()
    const b = await one(`SELECT SUM(CASE WHEN seen > 0 AND box >= 4 THEN 1 ELSE 0 END) strong, SUM(CASE WHEN seen > 0 AND box BETWEEN 1 AND 3 AND due > ? THEN 1 ELSE 0 END) ok,
      SUM(CASE WHEN seen > 0 AND box < 4 AND (box = 0 OR due <= ?) THEN 1 ELSE 0 END) weak, SUM(CASE WHEN seen > 0 THEN 1 ELSE 0 END) seen FROM progress WHERE student_id = ?`, today, today, st.id)
    const words = (await one(`SELECT COUNT(*) n FROM words WHERE status = 'approved'`)).n
    const rows = await all(`SELECT due, COUNT(*) n FROM progress WHERE student_id = ? AND seen > 0 AND box < 6 AND due <= ? GROUP BY due`, st.id, day(6))
    const by = Object.fromEntries(rows.map(r => [r.due, r.n]))
    const overdue = rows.filter(r => r.due < today).reduce((n, r) => n + r.n, 0)
    const next7 = Array.from({ length: 7 }, (_, i) => ({ day: day(i), n: (by[day(i)] || 0) + (i === 0 ? overdue : 0) }))
    return send(res, 200, { strong: b.strong || 0, ok: b.ok || 0, weak: b.weak || 0, unseen: Math.max(0, words - (b.seen || 0)), words, next7 })
  }
  if (p === '/api/app/settings' && req.method === 'POST') {
    const b = await body(req)
    const n = [10, 20, 30, 50].includes(Number(b.dailyNew)) ? Number(b.dailyNew) : 20
    await run('UPDATE students SET daily_new = ? WHERE id = ?', n, st.id)
    return send(res, 200, { ok: true, dailyNew: n })
  }
  return fail(res, 404, '接口不存在')
}

// ---------------- 后台接口(admin-api.mjs) ----------------
const admin = makeAdminApi({ all, one, run, tx, body, send, fail, str, ip, cookie, day, csvCell, importWords, cleanSense, savePhoto: d => savePhoto(d), levelsOf, streakOf, reloadStops, hashPassword, checkPassword, AUDIO_BASE, audioUrl, tts: createTts({ key: ENV.AZURE_TTS_KEY, region: ENV.AZURE_TTS_REGION || 'eastus', dir: join(DATA, 'uploads') }), DEMO })

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
    if (p.startsWith('/api/admin/')) return await admin.handle(req, res, p, url)
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
