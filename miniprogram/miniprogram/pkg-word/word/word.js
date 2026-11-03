// 单词详情:全部义项和例句、发音、收藏、熟练度
const vocab = require('../../api/vocab')
const audio = require('../../utils/vocab-audio')

const LABEL = b => (b < 0 ? '还没学' : b >= 6 ? '已掌握' : b >= 3 ? '熟悉' : '在学')
Page({
  data: { view: 'loading', w: null },
  async onLoad(q) {
    try {
      const w = await vocab.word(Number(q.rank))
      this.setData({ view: 'ok', w, label: LABEL(w.box), dots: [1, 2, 3, 4, 5, 6].map(n => w.box >= n) })
      audio.play(w.audio)
    } catch (e) { this.setData({ view: 'error', error: e.message }) }
  },
  onUnload() { audio.stop() },
  async fav() {
    const on = !this.data.w.fav
    this.setData({ 'w.fav': on })
    try { await vocab.fav(this.data.w.rank, on); getApp().globalData.dirty = true } catch (e) { this.setData({ 'w.fav': !on }) }
  },
  copy() { wx.setClipboardData({ data: this.data.w.ms }) }
})
