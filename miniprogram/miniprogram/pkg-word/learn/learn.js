// 背词流程
//   新词:词卡(先回忆 → 看释义)→ 认识 / 模糊 / 不认识;每 5 个新词来一轮小测(只练习,不记分)
//   复习:先出题(看词选义 / 听音选词 / 看义选词 / 拼写,按熟练度换题型),答对算认识,答错看卡片后算不认识
//   不认识的词本组隔几张再出现一次
//   结束:给这一站盖章(今天第一次学完还算打卡)
const vocab = require('../../api/vocab')
const audio = require('../../utils/vocab-audio')

const QUIZ_EVERY = 5
const shuffle = a => a.map(v => [Math.random(), v]).sort((x, y) => x[0] - y[0]).map(x => x[1])
const zhOf = w => (w.senses[0] || {}).zh || ''
const norm = s => String(s || '').toLowerCase().replace(/[^a-z]/g, '')
const TITLES = { today: '今日车票', review: '复习', new: '新词', wrong: '错词重练', fav: '收藏重练' }
const today = () => new Date(Date.now() + 8 * 3600e3).toISOString().slice(5, 10).replace('-', '.')

Page({
  data: { view: 'loading', card: null, flipped: false, idx: 0, total: 0, quiz: null, picked: '', typed: '', stats: { know: 0, vague: 0, forgot: 0, mastered: 0 }, busy: false, date: today() },

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
      this.levelSeen = items[items.length - 1].level
      this.setData({ total: items.length })
      this.next()
    } catch (e) {
      this.setData({ view: 'error', error: e.message })
    }
  },
  onUnload() { audio.stop(); if (this.data.idx) getApp().globalData.dirty = true },

  next() {
    if (this.recent.length >= QUIZ_EVERY) return this.practice()
    const card = this.queue.shift()
    if (!card) return this.finish()
    const idx = this.data.total - this.queue.length
    // 复习词先考;新词、重来的词直接看卡片
    if (card.kind === 'review' && !card.again) return this.setData({ view: 'quiz', quiz: this.makeQuiz(card, true), picked: '', typed: '', card, idx, flipped: false, wrongShown: false })
    this.setData({ view: 'card', card, flipped: false, idx, wrongShown: false })
    audio.play(card.audio)
  },

  flip() { if (!this.data.flipped) this.setData({ flipped: true }) },
  play() { audio.play(this.data.card.audio) },

  async fav() {
    const card = this.data.card, on = !card.fav
    this.setData({ 'card.fav': on })
    vocab.fav(card.rank, on).catch(() => this.setData({ 'card.fav': !on }))
  },

  async grade(e) { return this.record(e.currentTarget.dataset.r) },
  async record(result) {
    if (this.data.busy) return
    const card = this.data.card
    this.setData({ busy: true, [`stats.${result}`]: this.data.stats[result] + 1 })
    try { await vocab.grade(card.rank, result) } catch (err) { wx.showToast({ title: '没保存上：' + err.message, icon: 'none' }) }
    if (result === 'forgot' && !this.retried.has(card.rank)) {
      this.retried.add(card.rank)
      this.queue.splice(Math.min(3, this.queue.length), 0, { ...card, again: true })
      this.setData({ total: this.data.total + 1 })
    }
    if (card.kind === 'new' && !card.again && result !== 'mastered') this.recent.push(card)
    this.setData({ busy: false })
    this.next()
  },

  // 题型:熟练度低先认(看词选义 / 听音选词),高了要会写(看义选词 / 拼写)
  makeQuiz(w, graded) {
    const box = Math.max(w.box, 0)
    const types = box >= 3 ? ['spell', 'zh2ms', 'listen'] : box >= 1 ? ['ms2zh', 'listen', 'zh2ms'] : ['ms2zh', 'listen']
    const type = types[(w.rank + this.data.idx) % types.length]
    const others = shuffle(this.pool.filter(x => x.rank !== w.rank && x.zh && norm(x.ms) !== norm(w.ms))).slice(0, 3)
    const toZh = type === 'ms2zh' || type === 'listen'
    const answer = toZh ? zhOf(w) : w.ms
    const options = shuffle([{ rank: w.rank, ms: w.ms, zh: zhOf(w) }, ...others]).map(x => (toZh ? x.zh : x.ms))
    if (type === 'listen') setTimeout(() => audio.play(w.audio), 200)
    return { type, graded, word: w, answer, options, prompt: type === 'ms2zh' ? w.ms : type === 'listen' ? '' : zhOf(w), hint: type === 'spell' ? w.ms[0] + '…' : '' }
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
    if (quiz.type !== 'listen') audio.play(quiz.word.audio)
    setTimeout(() => {
      if (!quiz.graded) return this.nextPractice()
      if (ok) return this.record('know')
      // 答错:翻开卡片看一眼,再记不认识 / 模糊
      this.setData({ view: 'card', card: quiz.word, flipped: true, wrongShown: true })
    }, ok ? 650 : 1200)
  },

  // 每 5 个新词:一轮练习
  practice() {
    this.practiceQueue = shuffle(this.recent.splice(0, QUIZ_EVERY)).map(w => this.makeQuiz({ ...w, box: 1 }, false))
    this.nextPractice()
  },
  nextPractice() {
    const quiz = this.practiceQueue && this.practiceQueue.shift()
    if (!quiz) return this.next()
    this.setData({ view: 'quiz', quiz, picked: '', typed: '' })
  },

  async finish() {
    this.setData({ view: 'done' })
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
