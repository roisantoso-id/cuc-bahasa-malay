// 查词:输入马来语查词和词根,输入中文查释义(只查已上架的 5000 高频词)
const vocab = require('../../api/vocab')

Page({
  data: { q: '', list: [], searched: false },
  input(e) {
    const q = e.detail.value
    this.setData({ q })
    clearTimeout(this.t)
    this.t = setTimeout(() => this.search(q), 300)
  },
  async search(q) {
    if (!q.trim()) { this.setData({ list: [], searched: false }); return }
    try {
      const list = await vocab.search(q.trim())
      if (q === this.data.q) this.setData({ list, searched: true })
    } catch (e) { wx.showToast({ title: e.message, icon: 'none' }) }
  },
  open(e) { wx.navigateTo({ url: `/pkg-word/word/word?rank=${e.currentTarget.dataset.r}` }) }
})
