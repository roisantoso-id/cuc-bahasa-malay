// 已停止复习的词:可以恢复,恢复后 1 天后重新到期
const { user } = require('../../api/index')
const fmt = require('../../utils/format')

Page({
  data: { items: [], loading: true, error: false },
  onLoad() { this.load() },
  async load() {
    this.setData({ loading: true, error: false })
    try {
      const r = await user.exclusions(1, 100)
      this.setData({ items: r.items.map(x => ({ ...x, first: fmt.senses(x.senses)[0] })), loading: false })
    } catch (e) {
      this.setData({ loading: false, error: true })
    }
  },
  restore(e) {
    const id = e.currentTarget.dataset.id
    wx.showModal({
      title: '恢复复习？',
      content: '恢复后将在 1 天后重新到期。',
      confirmText: '确认恢复',
      success: async r => {
        if (!r.confirm) return
        try {
          await user.restoreExclusion(id)
          this.setData({ items: this.data.items.filter(x => x.wordId !== id) })
        } catch (err) {
          wx.showToast({ title: err.message, icon: 'none' })
        }
      }
    })
  }
})
