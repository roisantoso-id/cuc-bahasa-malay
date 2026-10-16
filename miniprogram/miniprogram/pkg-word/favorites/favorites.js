// 收藏本:收藏的单词,点开看全部释义,可取消收藏
const { user } = require('../../api/index')
const fmt = require('../../utils/format')

Page({
  data: { items: [], loading: true, error: false, open: '' },
  onLoad() { this.load() },
  async load() {
    this.setData({ loading: true, error: false })
    try {
      const r = await user.favorites(1, 100)
      this.setData({ items: r.items.map(x => ({ ...x, senses: fmt.senses(x.senses) })), loading: false })
    } catch (e) {
      this.setData({ loading: false, error: true })
    }
  },
  toggle(e) { const id = e.currentTarget.dataset.id; this.setData({ open: this.data.open === id ? '' : id }) },
  async remove(e) {
    const id = e.currentTarget.dataset.id
    try {
      await user.removeFavorite(id)
      this.setData({ items: this.data.items.filter(x => x.wordId !== id) })
    } catch (err) {
      wx.showToast({ title: err.message, icon: 'none' })
    }
  }
})
