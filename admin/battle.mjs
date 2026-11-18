// 对战与排行：好友 PK、学校 / 班级周榜、每周擂台。由 server.mjs 引入：
//   const battle = createBattle({ all, one, run, day, AUDIO_BASE, openLevels })
//   建表：battle.SCHEMA；小程序接口：await battle.handle(st, p, req, url, body) 返回数据，不是自己的路径返回 undefined
// 规则：
//   - 题目在服务器生成并保存，发给小程序时去掉答案；交卷后服务器判分，不信任客户端的对错。
//   - 题型：看词选义、看义选词、听音选词，每题 4 个选项，干扰项取同一站的词。
//   - 好友 PK：发起人先答，再分享给别人；同一题目每人只算第一次；7 天过期。
//   - 擂台：每周一（北京时间）一套 20 题，取前三站的词；每人每周最多开始 3 次（点开始就算一次，这时才发题），算最好成绩。
//   - 周榜：本周学习分 = 新学 ×2 + 复习 ×1 + 答对 ×1（来自 daily 表），按个人 / 同校 / 同班排；学校榜按全校总分排。
import { randomBytes, createHash } from 'node:crypto'

export function createBattle({ all, one, run, day, AUDIO_BASE, openLevels }) {
  const SCHEMA = [
    `CREATE TABLE IF NOT EXISTS pk (id VARCHAR(16) PRIMARY KEY, creator INT NOT NULL, level INT NOT NULL, questions MEDIUMTEXT NOT NULL, created_at VARCHAR(32), expires_at BIGINT NOT NULL, INDEX pk_creator (creator)) DEFAULT CHARSET = utf8mb4`,
    `CREATE TABLE IF NOT EXISTS pk_entry (pk_id VARCHAR(16) NOT NULL, student_id INT NOT NULL, score INT NOT NULL, correct INT NOT NULL, ms INT NOT NULL, answers TEXT, created_at VARCHAR(32), PRIMARY KEY (pk_id, student_id), INDEX pk_entry_student (student_id)) DEFAULT CHARSET = utf8mb4`,
    `CREATE TABLE IF NOT EXISTS arena (week VARCHAR(10) PRIMARY KEY, questions MEDIUMTEXT NOT NULL, created_at VARCHAR(32)) DEFAULT CHARSET = utf8mb4`,
    `CREATE TABLE IF NOT EXISTS arena_try (week VARCHAR(10) NOT NULL, student_id INT NOT NULL, n INT NOT NULL DEFAULT 0, PRIMARY KEY (week, student_id)) DEFAULT CHARSET = utf8mb4`,
    `CREATE TABLE IF NOT EXISTS arena_entry (week VARCHAR(10) NOT NULL, student_id INT NOT NULL, score INT NOT NULL, correct INT NOT NULL, ms INT NOT NULL, tries INT NOT NULL DEFAULT 1, created_at VARCHAR(32), updated_at VARCHAR(32), PRIMARY KEY (week, student_id), INDEX arena_rank (week, score)) DEFAULT CHARSET = utf8mb4`
  ]
  const PK_N = 10, ARENA_N = 20, ARENA_TRIES = 3, PK_DAYS = 7

  // 北京时间本周一的日期
  const weekStart = () => {
    const d = new Date(Date.now() + 8 * 3600e3)
    const dow = (d.getUTCDay() + 6) % 7 // 周一 = 0
    return new Date(d.getTime() - dow * 86400e3).toISOString().slice(0, 10)
  }
  const shuffle = (a, rnd = Math.random) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]] } return a }
  // 可复现的随机数（擂台每周同一套题）
  const seeded = seed => { let h = createHash('sha256').update(seed).digest().readUInt32LE(0); return () => { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; return ((h >>> 0) % 1e9) / 1e9 } }
  const zhOf = w => (JSON.parse(w.senses || '[]').find(s => !s.check) || {}).zh || ''

  async function makeQuestions(levels, n, rnd = Math.random) {
    if (!levels.length) throw Object.assign(new Error('还没有可以出题的站'), { code: 400 })
    const pool = (await all(`SELECT rank, ms, senses, audio, level FROM words WHERE status = 'approved' AND level IN (${levels.map(() => '?').join(',')}) ORDER BY rank`, ...levels))
      .map(w => ({ rank: w.rank, ms: w.ms, zh: zhOf(w), audio: w.audio, level: w.level })).filter(w => w.zh)
    if (pool.length < n + 3) throw Object.assign(new Error('这一站的词还不够出题'), { code: 400 })
    const picks = shuffle([...pool], rnd).slice(0, n)
    const types = ['ms2zh', 'zh2ms', 'audio2ms']
    return picks.map((w, i) => {
      const type = types[i % 3] === 'audio2ms' && !w.audio ? 'ms2zh' : types[i % 3]
      const others = shuffle(pool.filter(o => o.rank !== w.rank && o.zh !== w.zh && o.ms !== w.ms), rnd).slice(0, 3)
      const opts = shuffle([w, ...others], rnd)
      return {
        type, rank: w.rank,
        prompt: type === 'ms2zh' ? w.ms : type === 'zh2ms' ? w.zh : '',
        audio: w.audio ? AUDIO_BASE + w.audio : '',
        options: opts.map(o => (type === 'ms2zh' ? o.zh : o.ms)),
        answer: opts.indexOf(w)
      }
    })
  }
  const publicQ = qs => qs.map(({ answer, ...q }) => q)
  const judge = (qs, answers, ms) => {
    const a = Array.isArray(answers) ? answers.slice(0, qs.length).map(x => (Number.isInteger(x) ? x : -1)) : []
    const right = qs.map((q, i) => a[i] === q.answer)
    const correct = right.filter(Boolean).length
    const t = Math.min(Math.max(Number(ms) || 0, 3000), 30 * 60e3)
    // 答对一题 100 分；全部做完再按平均用时加速度分（每题 10 秒内最多 +20）
    const speed = Math.max(0, Math.round((10e3 - t / qs.length) / 500))
    return { answers: a, right, correct, ms: Math.round(t), score: correct * 100 + (correct ? speed * correct : 0) }
  }
  const nameOf = s => (s.name || '').trim() || `同学${String(s.id).padStart(4, '0').slice(-4)}`
  // aid：头像编号（小程序按它从几只犀鸟里选一只，同一个人永远一样）；以后有真头像再加 avatar 字段
  const who = s => ({ name: nameOf(s), school: s.school || '', className: s.class_name || '', aid: s.id || 0 })

  // ---------- 好友 PK ----------
  async function pkCreate(st, b) {
    const open = openLevels()
    const level = open.includes(Number(b.level)) ? Number(b.level) : open[0]
    const qs = await makeQuestions([level], PK_N)
    const id = randomBytes(6).toString('base64url')
    await run('INSERT INTO pk (id, creator, level, questions, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?)', id, st.id, level, JSON.stringify(qs), new Date().toISOString(), Date.now() + PK_DAYS * 86400e3)
    return { id }
  }
  async function pkGet(st, id) {
    const pk = await one('SELECT * FROM pk WHERE id = ?', id)
    if (!pk) throw Object.assign(new Error('这场 PK 不存在'), { code: 404 })
    const qs = JSON.parse(pk.questions)
    const creator = await one('SELECT id, name, school, class_name FROM students WHERE id = ?', pk.creator)
    const rows = await all('SELECT e.*, s.id sid, s.name, s.school, s.class_name FROM pk_entry e JOIN students s ON s.id = e.student_id WHERE e.pk_id = ? ORDER BY e.score DESC, e.ms ASC', id)
    const mine = rows.find(r => r.student_id === st.id)
    return {
      id, level: pk.level, expired: pk.expires_at < Date.now(), mine: !!mine, isCreator: pk.creator === st.id,
      creator: creator ? who(creator) : null,
      // 没答过才发题（不带答案）；答过的发带答案的复盘
      questions: mine ? null : publicQ(qs),
      review: mine ? qs.map((q, i) => ({ ...q, picked: JSON.parse(mine.answers || '[]')[i] })) : null,
      ranking: rows.map((r, i) => ({ place: i + 1, ...who({ id: r.sid, name: r.name, school: r.school, class_name: r.class_name }), score: r.score, correct: r.correct, ms: r.ms, me: r.student_id === st.id }))
    }
  }
  async function pkSubmit(st, id, b) {
    const pk = await one('SELECT * FROM pk WHERE id = ?', id)
    if (!pk) throw Object.assign(new Error('这场 PK 不存在'), { code: 404 })
    if (pk.expires_at < Date.now()) throw Object.assign(new Error('这场 PK 已经过期了'), { code: 400 })
    const r = judge(JSON.parse(pk.questions), b.answers, b.ms)
    await run('INSERT IGNORE INTO pk_entry (pk_id, student_id, score, correct, ms, answers, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)', id, st.id, r.score, r.correct, r.ms, JSON.stringify(r.answers), new Date().toISOString())
    return pkGet(st, id)
  }
  async function pkMine(st) {
    const rows = await all(`SELECT p.id, p.level, p.created_at, p.creator, e.score, e.correct,
      (SELECT COUNT(*) FROM pk_entry x WHERE x.pk_id = p.id) players
      FROM pk_entry e JOIN pk p ON p.id = e.pk_id WHERE e.student_id = ? ORDER BY e.created_at DESC LIMIT 20`, st.id)
    return rows.map(r => ({ id: r.id, level: r.level, createdAt: r.created_at, isCreator: r.creator === st.id, score: r.score, correct: r.correct, players: r.players }))
  }

  // ---------- 每周擂台 ----------
  async function arenaQuestions(week) {
    const row = await one('SELECT questions FROM arena WHERE week = ?', week)
    if (row) return JSON.parse(row.questions)
    const levels = openLevels().filter(l => l <= 3)
    const qs = await makeQuestions(levels.length ? levels : openLevels().slice(0, 1), ARENA_N, seeded('arena-' + week))
    await run('INSERT IGNORE INTO arena (week, questions, created_at) VALUES (?, ?, ?)', week, JSON.stringify(qs), new Date().toISOString())
    return JSON.parse((await one('SELECT questions FROM arena WHERE week = ?', week)).questions)
  }
  // 开始一次 = 用掉一次机会，这时才发题（只看题不答也算一次，免得先偷看再来打）
  const startedOf = async (week, sid) => ((await one('SELECT n FROM arena_try WHERE week = ? AND student_id = ?', week, sid)) || { n: 0 }).n
  async function arenaGet(st) {
    const week = weekStart()
    const qs = await arenaQuestions(week)
    const mine = await one('SELECT score, correct, ms, tries FROM arena_entry WHERE week = ? AND student_id = ?', week, st.id)
    const players = (await one('SELECT COUNT(*) n FROM arena_entry WHERE week = ?', week)).n
    const started = await startedOf(week, st.id)
    return { week, total: qs.length, triesLeft: Math.max(0, ARENA_TRIES - started), best: mine || null, players, questions: null }
  }
  async function arenaStart(st) {
    const week = weekStart()
    const qs = await arenaQuestions(week)
    if (await startedOf(week, st.id) >= ARENA_TRIES) throw Object.assign(new Error('本周 3 次机会已经用完'), { code: 400 })
    await run('INSERT INTO arena_try (week, student_id, n) VALUES (?, ?, 1) ON DUPLICATE KEY UPDATE n = n + 1', week, st.id)
    return { week, total: qs.length, triesLeft: ARENA_TRIES - await startedOf(week, st.id), questions: publicQ(qs) }
  }
  async function arenaSubmit(st, b) {
    const week = weekStart()
    const qs = await arenaQuestions(week)
    const mine = await one('SELECT * FROM arena_entry WHERE week = ? AND student_id = ?', week, st.id)
    const started = await startedOf(week, st.id)
    if (started <= (mine ? mine.tries : 0)) throw Object.assign(new Error('请先点「开始」再交卷'), { code: 400 })
    const r = judge(qs, b.answers, b.ms), now = new Date().toISOString()
    if (!mine) await run('INSERT INTO arena_entry (week, student_id, score, correct, ms, tries, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 1, ?, ?)', week, st.id, r.score, r.correct, r.ms, now, now)
    else if (r.score > mine.score || (r.score === mine.score && r.ms < mine.ms)) await run('UPDATE arena_entry SET score = ?, correct = ?, ms = ?, tries = tries + 1, updated_at = ? WHERE week = ? AND student_id = ?', r.score, r.correct, r.ms, now, week, st.id)
    else await run('UPDATE arena_entry SET tries = tries + 1, updated_at = ? WHERE week = ? AND student_id = ?', now, week, st.id)
    const best = await one('SELECT score, correct, ms, tries FROM arena_entry WHERE week = ? AND student_id = ?', week, st.id)
    const place = (await one('SELECT COUNT(*) n FROM arena_entry WHERE week = ? AND (score > ? OR (score = ? AND ms < ?))', week, best.score, best.score, best.ms)).n + 1
    // 还有机会时只告诉对错，不给正确答案（同一套题，不然下一次就能满分）；三次用完才公布答案
    const done = started >= ARENA_TRIES
    const review = qs.map((q, i) => (done ? { ...q, picked: r.answers[i], right: r.right[i] } : { ...publicQ([q])[0], picked: r.answers[i], right: r.right[i] }))
    return { last: { score: r.score, correct: r.correct, ms: r.ms }, best, place, triesLeft: Math.max(0, ARENA_TRIES - started), review }
  }
  async function arenaRank(st, scope) {
    const week = weekStart()
    const cond = scope === 'school' && st.school ? 'AND s.school = ?' : ''
    const rows = await all(`SELECT e.score, e.correct, e.ms, s.id, s.name, s.school, s.class_name FROM arena_entry e JOIN students s ON s.id = e.student_id
      WHERE e.week = ? ${cond} ORDER BY e.score DESC, e.ms ASC LIMIT 50`, week, ...(cond ? [st.school] : []))
    return { week, scope: cond ? 'school' : 'all', list: rows.map((r, i) => ({ place: i + 1, ...who(r), score: r.score, correct: r.correct, ms: r.ms, me: r.id === st.id })) }
  }

  // ---------- 周榜 ----------
  const POINTS = 'SUM(d.new_cnt * 2 + d.review_cnt + d.right_cnt)'
  async function rank(st, scope) {
    const from = weekStart()
    let cond = '', args = []
    if (scope === 'school') { if (!st.school) return { week: from, scope, needProfile: true, list: [] }; cond = 'AND s.school = ?'; args = [st.school] }
    if (scope === 'class') { if (!st.school || !st.class_name) return { week: from, scope, needProfile: true, list: [] }; cond = 'AND s.school = ? AND s.class_name = ?'; args = [st.school, st.class_name] }
    const rows = await all(`SELECT s.id, s.name, s.school, s.class_name, ${POINTS} pts, SUM(d.new_cnt) learned FROM daily d JOIN students s ON s.id = d.student_id
      WHERE d.day >= ? ${cond} GROUP BY s.id, s.name, s.school, s.class_name HAVING pts > 0 ORDER BY pts DESC, learned DESC LIMIT 50`, from, ...args)
    const list = rows.map((r, i) => ({ place: i + 1, ...who(r), points: Number(r.pts), learned: Number(r.learned), me: r.id === st.id }))
    let me = list.find(x => x.me) || null
    if (!me) {
      const my = await one(`SELECT ${POINTS} pts FROM daily d WHERE d.student_id = ? AND d.day >= ?`, st.id, from)
      me = { ...who(st), points: Number((my && my.pts) || 0), place: null, me: true }
    }
    return { week: from, scope: scope === 'school' || scope === 'class' ? scope : 'all', list, me }
  }
  async function schools(st) {
    const from = weekStart()
    const rows = await all(`SELECT s.school, ${POINTS} pts, COUNT(DISTINCT s.id) members FROM daily d JOIN students s ON s.id = d.student_id
      WHERE d.day >= ? AND s.school <> '' GROUP BY s.school HAVING pts > 0 ORDER BY pts DESC LIMIT 30`, from)
    return { week: from, list: rows.map((r, i) => ({ place: i + 1, school: r.school, points: Number(r.pts), members: Number(r.members), mine: r.school === st.school })) }
  }

  // 小程序接口路由：/api/app/pk…、/api/app/arena…、/api/app/rank…
  async function handle(st, p, req, url, body) {
    if (p === '/api/app/pk' && req.method === 'POST') return pkCreate(st, await body(req))
    if (p === '/api/app/pk/mine') return pkMine(st)
    const m = /^\/api\/app\/pk\/([\w-]{4,16})(\/submit)?$/.exec(p)
    if (m && !m[2] && req.method === 'GET') return pkGet(st, m[1])
    if (m && m[2] && req.method === 'POST') return pkSubmit(st, m[1], await body(req))
    if (p === '/api/app/arena' && req.method === 'GET') return arenaGet(st)
    if (p === '/api/app/arena/start' && req.method === 'POST') return arenaStart(st)
    if (p === '/api/app/arena/submit' && req.method === 'POST') return arenaSubmit(st, await body(req))
    if (p === '/api/app/arena/rank') return arenaRank(st, url.searchParams.get('scope'))
    if (p === '/api/app/rank') return rank(st, url.searchParams.get('scope'))
    if (p === '/api/app/rank/schools') return schools(st)
    return undefined
  }
  return { SCHEMA, handle, weekStart }
}
