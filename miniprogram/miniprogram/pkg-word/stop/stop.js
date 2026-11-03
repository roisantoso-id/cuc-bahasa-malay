// 一站(500 词)的词表:颜色表示熟练度,点词看详情
const vocab = require('../../api/vocab')

const STATE = b => (b < 0 ? 'none' : b >= 6 ? 'done' : b >= 3 ? 'good' : 'learn')
Page({
  data: { view: 'loading', stop: null, words: [], filter: 'all', counts: {} },
  onLoad(q) { this.level = Number(q.level) || 1; this.load() },
  onShow() { if (this.loaded && getApp().globalData.dirty) this.load() },
  async load() {
    try {
      const { stop, words } = await vocab.stop(this.level)
      this.all = words.map(w => ({ ...w, st: STATE(w.box) }))
      const counts = { all: words.length, none: 0, learn: 0, good: 0, done: 0 }
      this.all.forEach(w => counts[w.st]++)
      wx.setNavigationBarTitle({ title: `第 ${stop.level} 站 · ${stop.city}` })
      this.loaded = true
      this.setData({ view: 'ok', stop, counts })
      this.apply()
    } catch (e) { this.setData({ view: 'error', error: e.message }) }
  },
  setFilter(e) { this.setData({ filter: e.currentTarget.dataset.f }); this.apply() },
  apply() { const f = this.data.filter; this.setData({ words: f === 'all' ? this.all : this.all.filter(w => w.st === f) }) },
  learn() { wx.navigateTo({ url: `/pkg-word/learn/learn?mode=new&level=${this.level}` }) },
  open(e) { wx.navigateTo({ url: `/pkg-word/word/word?rank=${e.currentTarget.dataset.r}` }) }
})
