// 单词难度 + 入门测评 + 按难度推新词（2026-11-27）
//   难度：每个词 1–5（入门 / 初级 / 中级 / 中高级 / 高级）。默认按词频自动定（见 AUTO_DIFF_SQL），老师在后台可以逐个或批量改
//   测评：每个难度抽 6 个已上架的词，看词选义（4 个中文选项 + 「不认识」）。从入门考起，一档答对不到 4 个就停
//         通过的最高一档 = 已经会的；推荐从下一档学起。答对的词直接算学过（15 天后复习一次确认），答错的词排到新词最前面
//   自己去测：学的时候觉得太简单，可以从当前档测起（from = 当前档），下面的档默认已会，只测这一档往上，更快
//   推词：先推测评答错的词，再按「难度从推荐档往上、同档按词频」推；每 5 个新词里夹 1 个更低档还没学的词查漏
//   自动调档：推荐档里连续学 30 个新词，认识 ≥ 85% 升一档，≤ 40% 降一档
export const DIFFS = [
  { d: 1, label: '入门', note: '最常用的 500 词' },
  { d: 2, label: '初级', note: '日常对话够用' },
  { d: 3, label: '中级', note: '能读简单文章' },
  { d: 4, label: '中高级', note: '新闻和课文' },
  { d: 5, label: '高级', note: '书面语和专业词' }
]
export const MAX_DIFF = DIFFS.length
export const diffLabel = d => (DIFFS.find(x => x.d === Number(d)) || {}).label || ''
// 自动难度：按词频序号分档（词表一共 5000 词；现在上架的是前 2957 个）
export const autoDiff = rank => rank <= 500 ? 1 : rank <= 1000 ? 2 : rank <= 1800 ? 3 : rank <= 2800 ? 4 : 5
export const AUTO_DIFF_SQL = 'CASE WHEN rank <= 500 THEN 1 WHEN rank <= 1000 THEN 2 WHEN rank <= 1800 THEN 3 WHEN rank <= 2800 THEN 4 ELSE 5 END'

const PER = 6        // 每档几题
const PASS = 4       // 一档答对几个算通过
const GAP_EVERY = 5  // 每几个新词夹一个查漏词
const ADJUST_AFTER = 30
const shuffle = a => a.map(v => [Math.random(), v]).sort((x, y) => x[0] - y[0]).map(x => x[1])
const zhOf = senses => ((typeof senses === 'string' ? JSON.parse(senses || '[]') : senses || []).find(s => !s.check) || {}).zh || ''

export function createPlacement({ all, one, run, tx, day, openLevels, audioUrl }) {
  const open = () => (openLevels().length ? openLevels() : [0])

  // 每档有多少可学的词（只算开放站里已上架的）
  async function sizes() {
    const rows = await all(`SELECT difficulty d, COUNT(*) n FROM words WHERE status = 'approved' AND level IN (?) GROUP BY difficulty`, open())
    const by = Object.fromEntries(rows.map(r => [Number(r.d), Number(r.n)]))
    return DIFFS.map(x => ({ ...x, n: by[x.d] || 0 }))
  }

  // 出一套题：每档 PER 题，干扰项是同一档别的词的中文意思。from：从第几档测起（下面的档算已会）
  async function questions(st, from = 1) {
    const all_ = (await sizes()).filter(x => x.n >= PER)
    const top = all_.length ? all_[all_.length - 1].d : 1
    const start = Math.min(Math.max(1, Number(from) || 1), top)
    const levels = all_.filter(x => x.d >= start)
    const qs = []
    for (const lv of levels) {
      const words = await all(`SELECT rank, ms, senses, audio FROM words WHERE status = 'approved' AND level IN (?) AND difficulty = ? ORDER BY RAND() LIMIT ?`, open(), lv.d, PER)
      const pool = [...new Set((await all(`SELECT senses FROM words WHERE status = 'approved' AND difficulty = ? ORDER BY RAND() LIMIT 60`, lv.d)).map(r => zhOf(r.senses)).filter(Boolean))]
      for (const w of shuffle(words)) {
        const zh = zhOf(w.senses)
        if (!zh) continue
        const wrong = shuffle(pool.filter(z => z !== zh)).slice(0, 3)
        if (wrong.length < 3) continue
        // answer 给小程序判断「这一档答对几个、要不要停」；成绩以服务端交卷时重新判的为准
        qs.push({ rank: w.rank, d: lv.d, ms: w.ms, audio: audioUrl(w.audio), options: shuffle([zh, ...wrong]), answer: zh })
      }
    }
    return { per: PER, pass: PASS, from: start, current: (st && st.diff_level) || 0, currentLabel: diffLabel(st && st.diff_level), all: all_.map(({ d, label, note }) => ({ d, label, note })), levels: levels.map(({ d, label, note }) => ({ d, label, note })), questions: qs }
  }

  // 交卷。answers: [{ rank, pick }]，pick 是选的中文（''= 不认识）。skip = 先不测，从入门学起
  async function submit(st, b) {
    const now = new Date().toISOString(), today = day()
    if (b.skip) {
      await run('UPDATE students SET diff_level = GREATEST(diff_level, 1), placed_at = ?, placement = ?, lv_new = 0, lv_know = 0 WHERE id = ?', now, JSON.stringify({ skipped: true, at: now }), st.id)
      return { skipped: true, level: Math.max(st.diff_level || 0, 1), label: diffLabel(Math.max(st.diff_level || 0, 1)) }
    }
    const seen = new Set()
    const answers = (Array.isArray(b.answers) ? b.answers : []).slice(0, PER * MAX_DIFF)
      .map(a => ({ rank: Number(a && a.rank), pick: String((a && a.pick) || '').slice(0, 200) }))
      .filter(a => Number.isInteger(a.rank) && !seen.has(a.rank) && seen.add(a.rank))
    if (!answers.length) throw Object.assign(new Error('还没有答题'), { code: 400 })
    const words = await all(`SELECT rank, difficulty, senses FROM words WHERE status = 'approved' AND rank IN (?)`, answers.map(a => a.rank))
    const by = Object.fromEntries(words.map(w => [w.rank, w]))
    const graded = answers.filter(a => by[a.rank]).map(a => ({ rank: a.rank, d: Number(by[a.rank].difficulty), ok: !!a.pick && a.pick === zhOf(by[a.rank].senses) }))

    const lv = await sizes()
    const testable = lv.filter(x => x.n >= PER)
    const top = testable.length ? testable[testable.length - 1].d : 1
    const from = Math.min(Math.max(1, Number(b.from) || 1), top)
    // from 以下的档没测，算已会（skipped: true）
    const per = testable.map(x => {
      const mine = graded.filter(g => g.d === x.d)
      return x.d < from
        ? { d: x.d, label: x.label, asked: 0, correct: PER, size: x.n, skipped: true }
        : { d: x.d, label: x.label, asked: mine.length, correct: mine.filter(g => g.ok).length, size: x.n }
    })
    // 从最低档往上，连续通过的最高一档 = 已经会的
    let known = 0
    for (const p of per) { if (p.skipped || p.correct >= PASS) known = p.d; else break }
    const level = Math.max(1, Math.min(known + 1, top))
    // 估算词汇量：每档答对比例 × 这一档的词数（没答到的档按 0 算，跳过的低档按全会）
    const vocab = Math.round(per.reduce((n, p) => n + (p.correct / PER) * p.size, 0) / 10) * 10
    const result = { at: now, from, level, known, vocab, prev: st.diff_level || 0, per: per.map(({ d, label, asked, correct, skipped }) => ({ d, label, asked, correct, ...(skipped ? { skipped: true } : {}) })) }

    await tx(async c => {
      for (const g of graded) {
        if (g.ok && g.d <= known) {
          // 已经会的档里答对的词：直接算学过，15 天后复习一次确认（以前学过的不动）
          await c.run(`INSERT INTO progress (student_id, rank, box, due, seen, first_at, last_day, last_at) VALUES (?, ?, 4, ?, 1, ?, ?, ?)
            ON DUPLICATE KEY UPDATE box = IF(seen > 0, box, 4), due = IF(seen > 0, due, VALUES(due)), first_at = IF(seen > 0, first_at, VALUES(first_at)),
              last_day = IF(seen > 0, last_day, VALUES(last_day)), last_at = IF(seen > 0, last_at, VALUES(last_at)), seen = IF(seen > 0, seen, 1)`,
            st.id, g.rank, day(15), now, today, now)
        } else if (!g.ok) {
          // 答错 / 不认识：标成「测评漏掉的」，新词里先推
          await c.run(`INSERT INTO progress (student_id, rank, box, due, miss, last_at) VALUES (?, ?, 0, ?, 1, ?)
            ON DUPLICATE KEY UPDATE miss = IF(seen > 0, miss, 1)`, st.id, g.rank, today, now)
        }
      }
      await c.run('UPDATE students SET diff_level = ?, placed_at = ?, placement = ?, lv_new = 0, lv_know = 0 WHERE id = ?', level, now, JSON.stringify(result), st.id)
    })
    return { ...result, label: diffLabel(level), knownLabel: diffLabel(known), prevLabel: diffLabel(st.diff_level) }
  }

  // 推新词（测过的学生用；没测过的还走原来按站的顺序）
  async function pickNew(st, n, COLS) {
    if (n <= 0) return []
    const L = Math.max(1, st.diff_level || 1)
    const base = `FROM words w LEFT JOIN progress p ON p.rank = w.rank AND p.student_id = ? WHERE (p.rank IS NULL OR p.seen = 0) AND w.status = 'approved' AND w.level IN (?)`
    const miss = await all(`SELECT ${COLS} ${base} AND p.miss = 1 ORDER BY w.difficulty, w.rank LIMIT ?`, st.id, open(), n)
    let left = n - miss.length
    const gapN = L > 1 ? Math.floor(left / GAP_EVERY) : 0
    const main = left > 0 ? await all(`SELECT ${COLS} ${base} AND w.difficulty >= ? AND (p.miss IS NULL OR p.miss = 0) ORDER BY w.difficulty, w.rank LIMIT ?`, st.id, open(), L, left - gapN) : []
    left -= main.length
    const gap = left > 0 && L > 1 ? await all(`SELECT ${COLS} ${base} AND w.difficulty < ? AND (p.miss IS NULL OR p.miss = 0) ORDER BY w.rank LIMIT ?`, st.id, open(), L, left) : []
    // 查漏词均匀夹在中间：每 GAP_EVERY - 1 个推荐词后放一个
    const mixed = []
    let gi = 0
    main.forEach((w, i) => { mixed.push(w); if ((i + 1) % (GAP_EVERY - 1) === 0 && gi < gap.length) mixed.push(gap[gi++]) })
    return [...miss, ...mixed, ...gap.slice(gi)]
  }

  // 首页的「当前站」：下一个推荐词所在的站
  async function focusLevel(st) {
    const L = Math.max(1, st.diff_level || 1)
    const r = await one(`SELECT w.level FROM words w LEFT JOIN progress p ON p.rank = w.rank AND p.student_id = ? WHERE (p.rank IS NULL OR p.seen = 0) AND w.status = 'approved' AND w.level IN (?) AND w.difficulty >= ? ORDER BY w.difficulty, w.rank LIMIT 1`, st.id, open(), L)
    return r ? r.level : 0
  }

  // 学新词时记一笔；推荐档里攒够 ADJUST_AFTER 个就看看要不要升降一档。返回 { from, to, up } 或 null
  async function adjust(st, wordDiff, result) {
    const L = st.diff_level || 0
    if (!L || wordDiff < L) return null
    const know = result === 'know' || result === 'mastered' ? 1 : 0
    const nNew = (st.lv_new || 0) + 1, nKnow = (st.lv_know || 0) + know
    st.lv_new = nNew; st.lv_know = nKnow
    if (nNew < ADJUST_AFTER) { await run('UPDATE students SET lv_new = ?, lv_know = ? WHERE id = ?', nNew, nKnow, st.id); return null }
    const rate = nKnow / nNew
    const top = Math.max(1, ...(await sizes()).filter(x => x.n > 0).map(x => x.d))
    const to = rate >= 0.85 && L < top ? L + 1 : rate <= 0.4 && L > 1 ? L - 1 : L
    await run('UPDATE students SET diff_level = ?, lv_new = 0, lv_know = 0 WHERE id = ?', to, st.id)
    st.diff_level = to; st.lv_new = 0; st.lv_know = 0
    return to === L ? null : { from: L, to, up: to > L, label: diffLabel(to) }
  }

  const summary = st => {
    let p = null
    try { p = JSON.parse(st.placement || 'null') } catch (e) {}
    return { done: !!st.placed_at, level: st.diff_level || 0, label: diffLabel(st.diff_level), skipped: !!(p && p.skipped), vocab: p && p.vocab != null ? p.vocab : null, at: st.placed_at || '' }
  }

  return { questions, submit, pickNew, focusLevel, adjust, summary, sizes }
}
