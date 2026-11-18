// 答题（好友 PK 和每周擂台共用）
//   ?kind=pk&id=…  答完交卷，跳到 PK 结果页
//   ?kind=arena    答完交卷，在本页显示成绩和复盘
// 对错由服务器判，答题时不显示对错：点一个选项就锁住，停 0.4 秒进下一题。
const vocab = require('../../api/vocab')
const sfx = require('../../utils/sfx')
const audio = require('../../utils/vocab-audio')
const { fmtMs, KIND, review } = require('../util')

const NEXT_DELAY = 400

Page({
  data: { view: 'loading', error: '', kind: 'pk', i: 0, total: 0, q: null, picked: -1, time: '0.0', result: null, list: [] },

  onLoad(o) {
    this.kind = o.kind === 'arena' ? 'arena' : 'pk'
    this.id = o.id || ''
    this.setData({ kind: this.kind })
    wx.setNavigationBarTitle({ title: this.kind === 'arena' ? '每周擂台' : '好友 PK' })
    this.load()
  },
  onUnload() { this.stopClock(); clearTimeout(this.nextTimer); audio.stop() },

  async load() {
    this.setData({ view: 'loading', error: '' })
    try {
      let qs
      if (this.kind === 'pk') {
        const r = await vocab.pk(this.id)
        // 答过了或已过期：去结果页
        if (!r.questions || r.expired) return wx.redirectTo({ url: `/pkg-battle/pk/pk?id=${this.id}` })
        qs = r.questions
      } else {
        // 点开始才发题，这一下就用掉一次机会
        const r = await vocab.arenaStart().catch(e => { wx.showToast({ title: e.message, icon: 'none' }); return null })
        if (!r || !r.questions) return wx.redirectTo({ url: '/pkg-battle/arena/arena' })
        qs = r.questions
      }
      if (!qs.length) throw new Error('这套题是空的')
      this.qs = qs
      this.answers = qs.map(() => -1)
      this.setData({ total: qs.length })
      this.start = Date.now()
      this.startClock()
      this.show(0)
    } catch (e) {
      this.setData({ view: 'error', error: e.message })
    }
  },

  startClock() {
    this.stopClock()
    this.clock = setInterval(() => this.setData({ time: ((Date.now() - this.start) / 1000).toFixed(1) }), 100)
  },
  stopClock() { if (this.clock) { clearInterval(this.clock); this.clock = null } },

  show(i) {
    const q = this.qs[i]
    this.locked = false
    this.setData({ view: 'play', i, q: { ...q, kind: KIND[q.type] || '' }, picked: -1 })
    if (q.type === 'audio2ms') setTimeout(() => audio.play(q.audio), 200)
  },
  replay() { audio.play(this.data.q.audio) },
  pick(e) {
    if (this.locked) return
    this.locked = true
    sfx.play('tap')   // 对战里不当场揭晓对错，只给一声轻响
    const k = Number(e.currentTarget.dataset.k)
    this.answers[this.data.i] = k
    this.setData({ picked: k })
    this.nextTimer = setTimeout(() => {
      const n = this.data.i + 1
      if (n < this.qs.length) this.show(n)
      else this.submit()
    }, NEXT_DELAY)
  },

  async submit() {
    if (!this.ms) { this.ms = Date.now() - this.start; this.stopClock() }
    audio.stop()
    this.setData({ view: 'submitting', time: (this.ms / 1000).toFixed(1) })
    try {
      if (this.kind === 'pk') {
        await vocab.pkSubmit(this.id, this.answers, this.ms)
        getApp().globalData.dirty = true
        return wx.redirectTo({ url: `/pkg-battle/pk/pk?id=${this.id}` })
      }
      const r = await vocab.arenaSubmit(this.answers, this.ms)
      getApp().globalData.dirty = true
      const top = r.place && r.place <= 10
      sfx.play(top ? 'win' : 'complete')
      setTimeout(() => this.setData({ cfFire: (this.data.cfFire || 0) + 1 }), 150)
      this.setData({
        view: 'result',
        result: { ...r, lastTime: fmtMs(r.last.ms), total: this.qs.length },
        list: review(r.review)
      })
      wx.setNavigationBarTitle({ title: '擂台成绩' })
    } catch (e) {
      // 交卷失败：答案还在，可以再交一次
      this.setData({ view: 'submitError', error: e.message })
    }
  },

  again() { wx.redirectTo({ url: '/pkg-battle/play/play?kind=arena' }) },
  toArena() { wx.redirectTo({ url: '/pkg-battle/arena/arena' }) },
  back() { wx.navigateBack({ fail: () => wx.switchTab({ url: '/pages/battle/battle' }) }) }
})
