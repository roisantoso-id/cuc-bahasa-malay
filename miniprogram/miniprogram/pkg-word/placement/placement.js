// 入门测评：测一测认识多少高频词，推荐从哪一档难度学起（服务端规则见 admin/placement.mjs）
//   intro（说明 + 五档难度）→ quiz（看词选义，4 个意思 + 不认识；每档 6 题，一档答对不到 4 个就停）→ result（推荐档、估算词汇量、每档答对几个）
//   每题不判对错、不给红绿反馈，免得越测越没信心；点了就进下一题
//   从首页自动进来的（第一次打开）可以「先跳过」；护照页「重新测评」进来的跳过就是返回
const vocab = require('../../api/vocab')
const sfx = require('../../utils/sfx')

const fmt = n => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',')

Page({
  data: { view: 'loading', error: '', levels: [], q: null, idx: 0, total: 0, picked: '', lvIdx: 0, res: null, busy: false, first: false },

  onLoad(o) {
    this.first = o.from === 'home'
    this.setData({ first: this.first })
    this.load()
  },
  async load() {
    this.setData({ view: 'loading' })
    try {
      const r = await vocab.placement()
      if (!r.questions.length) throw new Error('词库还没准备好，先去学吧')
      this.per = r.per; this.pass = r.pass
      this.qs = r.questions
      this.byLevel = r.levels.map(l => r.questions.filter(q => q.d === l.d))
      this.setData({ view: 'intro', levels: r.levels, total: r.questions.length })
    } catch (e) { this.setData({ view: 'error', error: e.message }) }
  },
  begin() {
    this.answers = []
    this.lv = 0; this.inLv = 0; this.okLv = 0
    sfx.play('tap')
    this.show()
  },
  show() {
    const list = this.byLevel[this.lv]
    const q = list[this.inLv]
    const levels = this.data.levels
    this.setData({ view: 'quiz', q, picked: '', idx: this.answers.length + 1, lvIdx: this.lv, lvLabel: levels[this.lv].label, lvNo: this.lv + 1, lvN: levels.length, lvQ: this.inLv + 1, lvTotal: list.length })
  },
  pick(e) {
    if (this.data.picked || this.data.busy) return
    const pick = e.currentTarget.dataset.o || ''
    const q = this.data.q
    this.setData({ picked: pick || '__none' })
    sfx.play('tick', 0.5)
    this.answers.push({ rank: q.rank, pick })
    if (pick && pick === q.answer) this.okLv++
    setTimeout(() => this.next(), 260)
  },
  next() {
    const list = this.byLevel[this.lv]
    this.inLv++
    if (this.inLv < list.length) return this.show()
    // 这一档做完：答对不到 pass 个，或者已经是最后一档，就交卷
    const passed = this.okLv >= this.pass
    if (!passed || this.lv >= this.byLevel.length - 1) return this.submit()
    this.lv++; this.inLv = 0; this.okLv = 0
    sfx.play('star', 0.6)
    this.show()
  },
  async submit() {
    this.setData({ view: 'loading', busy: true })
    try {
      const r = await vocab.placementSubmit(this.answers)
      getApp().globalData.dirty = true
      const lv = this.data.levels
      const res = {
        label: r.label, known: r.knownLabel, vocab: fmt(r.vocab), answered: this.answers.length,
        rows: lv.map(l => {
          const p = (r.per || []).find(x => x.d === l.d) || { asked: 0, correct: 0 }
          return { d: l.d, label: l.label, asked: p.asked, correct: p.correct, pct: Math.round(p.correct / this.per * 100), rec: l.d === r.level, done: l.d <= r.known }
        })
      }
      this.setData({ view: 'result', res, busy: false, cf: (this.data.cf || 0) + 1 })
      sfx.play('complete')
    } catch (e) { this.setData({ view: 'error', error: e.message, busy: false }) }
  },
  async skip() {
    if (!this.first) return this.back()
    try { await vocab.placementSkip(); getApp().globalData.dirty = true } catch (e) { /* 跳过失败下次再问 */ }
    this.back()
  },
  // 测完 / 跳过：回首页开始学
  go() { wx.switchTab({ url: '/pages/home/home' }) },
  back() { if (getCurrentPages().length > 1) wx.navigateBack(); else this.go() },
  again() { this.load() },
  // 做到一半想退出：问一声
  quit() {
    wx.showModal({ title: '退出测评？', content: '这次的答案不会保存，下次还能再测。', confirmText: '退出', cancelText: '继续测', success: r => { if (r.confirm) this.back() } })
  }
})
