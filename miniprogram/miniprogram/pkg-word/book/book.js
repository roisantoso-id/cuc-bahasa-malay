// 单词本:收藏 / 错词 / 学习中 / 已掌握,收藏和错词可以直接重练
const vocab = require('../../api/vocab')

const TABS = [{ k: 'wrong', t: '错词' }, { k: 'fav', t: '收藏' }, { k: 'learning', t: '学习中' }, { k: 'mastered', t: '已掌握' }]
Page({
  data: { tabs: TABS, type: 'wrong', words: [], total: 0, view: 'loading' },
  onLoad(q) { this.setData({ type: q.type || 'wrong' }); this.load(true) },
  onShow() { if (this.loaded && getApp().globalData.dirty) this.load(true) },
  tab(e) { this.setData({ type: e.currentTarget.dataset.k }); this.load(true) },
  async load(reset) {
    if (this.busy) return
    this.busy = true
    const page = reset ? 0 : this.page + 1
    try {
      const { total, words } = await vocab.book(this.data.type, page)
      this.page = page
      this.loaded = true
      this.setData({ view: 'ok', total, words: reset ? words : this.data.words.concat(words) })
    } catch (e) { this.setData({ view: 'error', error: e.message }) }
    this.busy = false
  },
  onReachBottom() { if (this.data.words.length < this.data.total) this.load(false) },
  async toggleFav(e) {
    const i = e.currentTarget.dataset.i, { rank, fav } = this.data.words[i]
    this.setData({ [`words[${i}].fav`]: !fav })
    try { await vocab.fav(rank, !fav); getApp().globalData.dirty = true } catch (err) { this.setData({ [`words[${i}].fav`]: fav }) }
  },
  open(e) { wx.navigateTo({ url: `/pkg-word/word/word?rank=${e.currentTarget.dataset.r}` }) },
  practice() { wx.navigateTo({ url: `/pkg-word/learn/learn?mode=${this.data.type}` }) }
})
