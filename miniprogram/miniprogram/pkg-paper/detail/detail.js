// 试卷详情:考试说明 + 开始测试(有没交卷的作答会接着做)
const { papers } = require('../../api/index')
const fmt = require('../../utils/format')

Page({
  data: { p: null, loading: true, error: '', busy: false },
  onLoad({ id }) { this.id = id; this.load() },
  async load() {
    this.setData({ loading: true, error: '' })
    try {
      const p = await papers.detail(this.id)
      this.setData({ p: { ...p, date: fmt.date(p.publishedAt) }, loading: false })
    } catch (e) {
      this.setData({ loading: false, error: e.status === 404 ? 'notfound' : 'error' })
    }
  },
  async start() {
    this.setData({ busy: true })
    try {
      const at = await papers.start(this.id)
      wx.navigateTo({ url: `/pkg-paper/attempt/attempt?id=${at.id}` })
    } catch (e) {
      wx.showToast({ title: e.message, icon: 'none' })
    } finally {
      this.setData({ busy: false })
    }
  },
  back() { wx.navigateBack() }
})
