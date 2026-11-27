// 背词流程
//   新词:词卡(先回忆 → 看释义)→ 认识 / 模糊 / 不认识;每 5 个新词来一轮小测(只练习,不记分)
//   复习:先出题(看词选义 / 听音选词 / 看义选词 / 拼写,按熟练度换题型),答对算认识,答错看卡片后算不认识
//   不认识的词本组隔几张再出现一次
//   结束:给这一站盖章(今天第一次学完还算打卡)
const vocab = require('../../api/vocab')
const audio = require('../../utils/vocab-audio')
const sfx = require('../../utils/sfx')

const QUIZ_EVERY = 5
const shuffle = a => a.map(v => [Math.random(), v]).sort((x, y) => x[0] - y[0]).map(x => x[1])
const zhOf = w => (w.senses[0] || {}).zh || ''
const norm = s => String(s || '').toLowerCase().replace(/[^a-z]/g, '')
// 例句补全：在例句里找到和这个词完全一样的那个词，挖成空。找不到（例句里是变形，比如 menulis）就不出这种题
const clozeOf = w => {
  for (const s of w.senses || []) {
    if (!s.exMs) continue
    const parts = s.exMs.split(/(\s+)/)
    const i = parts.findIndex(t => norm(t) === norm(w.ms))
    if (i < 0) continue
    const t = parts[i], pre = (t.match(/^[^A-Za-z]+/) || [''])[0], suf = (t.match(/[^A-Za-z]+$/) || [''])[0]   // 标点留在空格外面
    return { before: parts.slice(0, i).join('') + pre, after: suf + parts.slice(i + 1).join(''), zh: s.exZh || '' }
  }
  return null
}
const INTERVALS = [1, 1, 2, 4, 7, 15, 30]   // 和服务端 grade() 同一套
const dayText = n => `${n} 天后`
// 三个按钮各自的「下次什么时候再见」
const hintsOf = c => {
  const isNew = c.kind === 'new'
  const box = Math.max(c.box || 0, 0)
  const know = isNew ? 2 : Math.min(box + 1, 6)
  return { forgot: dayText(INTERVALS[0]), vague: dayText(INTERVALS[isNew ? 1 : Math.max(box, 1)]), know: know >= 6 ? '已掌握' : dayText(INTERVALS[know]) }
}
const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
// 例句里把这个词标出来
const marks = (ex, ms) => {
  if (!ex) return []
  const m = new RegExp('(' + esc(ms) + ')', 'i').exec(ex)
  if (!m) return [{ t: ex }]
  return [{ t: ex.slice(0, m.index) }, { t: m[1], hit: 1 }, { t: ex.slice(m.index + m[1].length) }].filter(x => x.t)
}
const prep = c => ({ ...c, hints: hintsOf(c), first: c.kind === 'new' && !c.again, senses: (c.senses || []).map(s => ({ ...s, parts: marks(s.exMs, c.ms) })) })
const TITLES = { today: '今日车票', review: '复习', new: '新词', more: '新词', wrong: '错词重练', fav: '收藏重练' }
// 白天版小测顶上的小格子：每格一题，y 对 n 错 v 模糊；超过 30 格太密，改用细进度条（list 为 null）
const pipsOf = (marks, n, cur) => ({ n, cur, list: n <= 30 ? Array.from({ length: n }, (_, i) => marks[i] || '') : null })
const today = () => new Date(Date.now() + 8 * 3600e3).toISOString().slice(5, 10).replace('-', '.')

Page({
  data: { dx: 0, dy: 0, drag: false, hint: '', fly: '', view: 'loading', card: null, flipped: false, idx: 0, total: 0, quiz: null, picked: '', typed: '', stats: { know: 0, vague: 0, forgot: 0, mastered: 0 }, busy: false, date: today() },

  async onLoad(q) {
    this.mode = q.mode || 'today'
    this.level = Number(q.level) || 0
    wx.setNavigationBarTitle({ title: TITLES[this.mode] || '背单词' })
    try {
      const { items, pool } = await vocab.start(this.mode, this.level)
      if (!items.length) { this.setData({ view: 'empty' }); return }
      this.queue = items.slice()
      this.pool = pool.length >= 4 ? pool : items.map(w => ({ rank: w.rank, ms: w.ms, zh: zhOf(w) }))
      this.recent = []
      this.retried = new Set()
      this.marks = []
      this.levelSeen = items[items.length - 1].level
      this.setData({ total: items.length })
      this.next()
    } catch (e) {
      this.setData({ view: 'error', error: e.message })
    }
  },
  onUnload() { clearTimeout(this.timer); audio.stop(); if (this.data.idx) getApp().globalData.dirty = true },

  next() {
    if (this.recent.length >= QUIZ_EVERY) return this.practice()
    const card = this.queue.shift()
    if (!card) return this.finish()
    const idx = this.data.total - this.queue.length
    // 复习词先考;新词、重来的词直接看卡片
    if (card.kind === 'review' && !card.again) return this.setData({ view: 'quiz', quiz: this.makeQuiz(card, true), qp: pipsOf(this.marks, this.data.total, idx - 1), picked: '', typed: '', card: prep(card), idx, flipped: false, wrongShown: false })
    this.setData({ view: 'card', card: prep(card), flipped: false, idx, wrongShown: false })
    audio.play(card.audio)
  },

  flip() { if (!this.data.flipped && !this.moved) this.setData({ flipped: true }) },

  // ---- 手势：左滑不认识、右滑认识、上滑模糊（翻开以后才算打分；没翻开时滑一下就是翻开）----
  tStart(e) {
    if (this.data.busy || this.data.fly) return
    const t = e.touches[0]
    this.sx = t.clientX; this.sy = t.clientY; this.moved = false
    this.setData({ drag: true })
  },
  tMove(e) {
    if (this.sx == null || this.data.fly) return
    const t = e.touches[0], dx = t.clientX - this.sx, dy = t.clientY - this.sy
    if (Math.abs(dx) + Math.abs(dy) > 8) this.moved = true
    const now = Date.now()
    if (now - (this.lastMove || 0) < 16) return   // 每帧最多更新一次
    this.lastMove = now
    const hint = !this.data.flipped ? '' : dx > 50 ? 'know' : dx < -50 ? 'forgot' : dy < -50 && Math.abs(dx) < 60 ? 'vague' : ''
    this.setData({ dx, dy, hint })
  },
  tEnd() {
    if (this.sx == null) return
    const { dx, dy, flipped } = this.data
    this.sx = null
    const r = dx > 100 ? 'know' : dx < -100 ? 'forgot' : dy < -90 && Math.abs(dx) < 80 ? 'vague' : ''
    if (!r || !flipped) {
      this.setData({ dx: 0, dy: 0, drag: false, hint: '' })
      if (r && !flipped) this.setData({ flipped: true })
      setTimeout(() => { this.moved = false }, 50)
      return
    }
    wx.vibrateShort && wx.vibrateShort({ type: 'light' })
    this.setData({ drag: false, fly: r, hint: r })
    setTimeout(() => {
      this.setData({ fly: '', dx: 0, dy: 0, hint: '' })
      this.moved = false
      this.record(r)
    }, 280)
  },
  play() { audio.play(this.data.card.audio) },

  async fav() {
    const card = this.data.card, on = !card.fav
    this.setData({ 'card.fav': on })
    if (on) {   // 收藏时炸一圈小星星，按钮弹一下
      sfx.play('star')
      this.setData({ favFx: (this.data.favFx || 0) + 1, favPop: true })
      wx.vibrateShort && wx.vibrateShort({ type: 'light' })
      setTimeout(() => this.setData({ favPop: false }), 400)
    }
    vocab.fav(card.rank, on).catch(() => this.setData({ 'card.fav': !on }))
  },

  async grade(e) { return this.record(e.currentTarget.dataset.r) },
  async record(result, silent) {
    if (!silent) sfx.play(result === 'forgot' ? 'swipe-forgot' : result === 'vague' ? 'swipe-vague' : 'swipe-know')
    if (this.data.busy) return
    const card = this.data.card
    this.setData({ busy: true, [`stats.${result}`]: this.data.stats[result] + 1 })
    try {
      const r = await vocab.grade(card.rank, result)
      // 推荐档里认识得多 / 太难，服务端自动升降一档
      if (r && r.levelChange) { getApp().globalData.dirty = true; wx.showToast({ title: r.levelChange.up ? `学得很顺，升到「${r.levelChange.label}」` : `先降到「${r.levelChange.label}」打牢基础`, icon: 'none', duration: 2500 }) }
    } catch (err) { wx.showToast({ title: '没保存上：' + err.message, icon: 'none' }) }
    if (result === 'forgot' && !this.retried.has(card.rank)) {
      this.retried.add(card.rank)
      this.queue.splice(Math.min(3, this.queue.length), 0, { ...card, again: true })
      this.setData({ total: this.data.total + 1 })
    }
    if (card.kind === 'new' && !card.again && result !== 'mastered') this.recent.push(card)
    this.marks[this.data.idx - 1] = result === 'forgot' ? 'n' : result === 'vague' ? 'v' : 'y'
    this.setData({ busy: false })
    this.next()
  },

  // 题型:熟练度低先认(看词选义 / 听音选词),高了要会写(看义选词 / 拼写)
  makeQuiz(w, graded) {
    const box = Math.max(w.box, 0)
    const types = box >= 3 ? ['spell', 'cloze', 'zh2ms', 'listen'] : box >= 1 ? ['ms2zh', 'listen', 'cloze', 'zh2ms'] : ['ms2zh', 'listen']
    let type = types[(w.rank + this.data.idx) % types.length]
    const cloze = type === 'cloze' ? clozeOf(w) : null
    if (type === 'cloze' && !cloze) type = 'zh2ms'   // 例句里找不到原词就换成看义选词
    // 听音选词 / 看义选词：干扰项用服务端挑好的「听起来像的词」（w.alike），不然马来语词差太多，一听就排除
    //   看词选义、选词填空还是同一站随便抽（选词填空要看句子意思，太像反而不公平）
    const alike = (w.alike || []).filter(x => norm(x.ms) !== norm(w.ms))
    const others = (type === 'listen' || type === 'zh2ms') && alike.length >= 3 ? alike.slice(0, 3)
      : shuffle(this.pool.filter(x => x.rank !== w.rank && x.zh && norm(x.ms) !== norm(w.ms))).slice(0, 3)
    const toZh = type === 'ms2zh'   // 其余题型都选马来语词
    const answer = toZh ? zhOf(w) : w.ms
    const options = shuffle([{ rank: w.rank, ms: w.ms, zh: zhOf(w) }, ...others]).map(x => (toZh ? x.zh : x.ms))
    if (type === 'listen') setTimeout(() => audio.play(w.audio), 200)
    return { type, graded, word: w, answer, options, prompt: type === 'ms2zh' ? w.ms : type === 'listen' ? '' : zhOf(w), hint: type === 'spell' ? w.ms[0] + '…' : '', cloze, zh: zhOf(w) }
  },
  replay() { audio.play(this.data.quiz.word.audio) },
  pick(e) {
    if (this.data.picked) return
    const picked = e.currentTarget.dataset.o
    this.setData({ picked })
    this.after(picked === this.data.quiz.answer)
  },
  typing(e) { this.setData({ typed: e.detail.value }) },
  checkSpell() {
    if (this.data.picked || !this.data.typed.trim()) return
    const ok = norm(this.data.typed) === norm(this.data.quiz.word.ms)
    this.setData({ picked: ok ? this.data.quiz.answer : this.data.typed })
    this.after(ok)
  },
  dontKnow() { if (!this.data.picked) { this.setData({ picked: '__skip' }); this.after(false) } },
  after(ok) {
    const quiz = this.data.quiz
    if (!quiz.graded && this.pq) this.pq.marks.push(ok ? 'y' : 'n')
    // 连对：答对 +1，答错清零；连对 3 题以上出「连对 ×N」并换成上行琶音
    this.combo = ok ? (this.combo || 0) + 1 : 0
    if (ok && this.combo >= 3) { sfx.play('combo'); this.setData({ combo: this.combo, comboPop: true }); setTimeout(() => this.setData({ comboPop: false }), 450) }
    else { sfx.play(ok ? 'correct' : 'wrong'); if (!ok) this.setData({ combo: 0 }) }
    if (quiz.type !== 'listen') audio.play(quiz.word.audio)
    const h = hintsOf(quiz.word)
    this.setData({ fbLine: !quiz.graded ? '小练习，不记分' : ok ? `答对了，${h.know}再见` : `已放进错词本，${h.forgot}再考一次`, fbOk: ok })
    this.pending = () => {
      if (!quiz.graded) return this.nextPractice()
      if (ok) return this.record('know', true)
      // 答错:翻开卡片看一眼,再记不认识 / 模糊
      this.setData({ view: 'card', card: prep(quiz.word), flipped: true, wrongShown: true })
    }
    this.timer = setTimeout(() => this.cont(), ok ? 650 : 1200)
  },
  // 点「继续」不用等自动跳转
  cont() {
    if (!this.pending) return
    clearTimeout(this.timer)
    const go = this.pending
    this.pending = null
    go()
  },

  // 每 5 个新词:一轮练习
  practice() {
    this.practiceQueue = shuffle(this.recent.splice(0, QUIZ_EVERY)).map(w => this.makeQuiz({ ...w, box: 1 }, false))
    this.pq = { n: this.practiceQueue.length, marks: [] }
    this.nextPractice()
  },
  nextPractice() {
    const quiz = this.practiceQueue && this.practiceQueue.shift()
    if (!quiz) return this.next()
    this.setData({ view: 'quiz', quiz, qp: pipsOf(this.pq.marks, this.pq.n, this.pq.n - this.practiceQueue.length - 1), picked: '', typed: '' })
  },

  async finish() {
    // 结算：铜锣 + 彩纸 + 经验值从 0 滚上去
    const st = this.data.stats
    const xp = st.know * 10 + st.mastered * 10 + st.vague * 5 + st.forgot * 2
    this.setData({ view: 'done', xp: 0, xpTo: xp })
    sfx.play('complete')
    setTimeout(() => this.setData({ cfFire: (this.data.cfFire || 0) + 1 }), 150)
    const t0 = Date.now()
    const tick = () => { const k = Math.min(1, (Date.now() - t0) / 1100); this.setData({ xp: Math.round(xp * (1 - Math.pow(1 - k, 3))) }); if (k < 1) this.xpT = setTimeout(tick, 33) }
    this.xpT = setTimeout(tick, 400)
    try {
      const h = await vocab.home()
      getApp().globalData.dirty = true
      const stop = h.levels.find(l => l.level === this.levelSeen) || h.levels[0]
      this.setData({ stop, streak: h.streak, left: h.today.due + h.today.newLeft })
    } catch (e) { /* 结束页不依赖这些数据 */ }
  },
  again() { wx.redirectTo({ url: `/pkg-word/learn/learn?mode=${this.data.left ? 'today' : 'new'}&level=${(this.data.stop && this.data.stop.level) || 1}` }) },
  back() { wx.navigateBack() }
})
