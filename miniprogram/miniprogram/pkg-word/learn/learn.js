// 背词流程:词卡(先回忆 → 看答案 → 认识 / 模糊 / 不认识)→ 每 5 个词一轮小测 → 结束页
const vocab = require('../../api/vocab')
const audio = require('../../utils/vocab-audio')

const QUIZ_EVERY = 5
const shuffle = a => a.map(v => [Math.random(), v]).sort((x, y) => x[0] - y[0]).map(x => x[1])

Page({
  data: { view: 'loading', card: null, flipped: false, idx: 0, total: 0, quiz: null, picked: '', stats: { know: 0, vague: 0, forgot: 0, mastered: 0 }, busy: false },

  async onLoad(q) {
    this.scene = q.scene || ''
    this.reviewOnly = q.review === '1'
    try {
      const { items } = await vocab.start(this.scene, this.reviewOnly)
      if (!items.length) { this.setData({ view: 'empty' }); return }
      this.queue = items.slice()
      this.pool = items.slice()          // 出小测选项用
      this.recent = []                   // 最近学的,用来出小测
      this.retried = new Set()           // 不认识的词本组再出现一次
      this.setData({ total: items.length })
      this.next()
    } catch (e) {
      this.setData({ view: 'error', error: e.message })
    }
  },
  onUnload() { audio.stop() },

  next() {
    if (this.recent.length >= QUIZ_EVERY) return this.makeQuiz()
    const card = this.queue.shift()
    if (!card) return this.setData({ view: 'done' })
    this.setData({ view: 'card', card, flipped: false, idx: this.data.total - this.queue.length })
    if (card.audio) audio.play(card.audio)
  },

  flip() { this.setData({ flipped: true }) },
  play() { audio.play(this.data.card.audio) },

  async grade(e) {
    if (this.data.busy) return
    const result = e.currentTarget.dataset.r
    const card = this.data.card
    this.setData({ busy: true, [`stats.${result}`]: this.data.stats[result] + 1 })
    try {
      await vocab.grade(card._id, card.sceneId, result)
    } catch (err) {
      wx.showToast({ title: '保存失败，稍后会重试', icon: 'none' })
    }
    if (result === 'forgot' && !this.retried.has(card._id)) {
      this.retried.add(card._id)
      this.queue.splice(Math.min(3, this.queue.length), 0, card) // 隔几张再出现一次
    }
    if (result !== 'mastered') this.recent.push(card)
    this.setData({ busy: false })
    this.next()
  },

  // 小测:轮流「看词选义」和「看义选词」,只做练习不记分
  makeQuiz() {
    const items = this.recent.splice(0, QUIZ_EVERY)
    this.quizQueue = items.map((w, i) => {
      const toZh = i % 2 === 0
      const others = shuffle(this.pool.filter(x => x._id !== w._id)).slice(0, 3)
      return { prompt: toZh ? w.ms : w.zh, askMs: toZh, answer: toZh ? w.zh : w.ms, options: shuffle([w, ...others]).map(x => (toZh ? x.zh : x.ms)), audio: w.audio }
    })
    this.nextQuiz()
  },
  nextQuiz() {
    const quiz = this.quizQueue.shift()
    if (!quiz) return this.next()
    this.setData({ view: 'quiz', quiz, picked: '' })
  },
  pick(e) {
    if (this.data.picked) return
    const picked = e.currentTarget.dataset.o
    this.setData({ picked })
    setTimeout(() => this.nextQuiz(), picked === this.data.quiz.answer ? 600 : 1300)
  },

  again() { wx.redirectTo({ url: `/pkg-word/learn/learn?scene=${this.scene}${this.reviewOnly ? '&review=1' : ''}` }) },
  back() { wx.navigateBack() }
})
