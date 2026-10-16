// 测试 tab:试卷列表、分类筛选、错题本入口
const { papers } = require('../../api/index')
const { requireLogin } = require('../../utils/ui')

Page({
  data: { keyword: '', categoryId: '', cats: [], items: [], page: 1, totalPages: 1, total: 0, loading: true, error: false, wrongCount: 0 },

  onShow() {
    if (!requireLogin()) return
    if (!this.loaded) { this.loaded = true; this.reload() }
    papers.wrongList('Pending', 1, 1).then(r => this.setData({ wrongCount: r.totalCount })).catch(() => {})
  },
  onPullDownRefresh() { this.reload().then(() => wx.stopPullDownRefresh()) },
  onReachBottom() { if (this.data.page < this.data.totalPages) this.fetch(this.data.page + 1) },

  setCat(e) { this.setData({ categoryId: e.currentTarget.dataset.id }); this.fetch(1) },
  onKeyword(e) { this.setData({ keyword: e.detail.value }) },
  search() { this.fetch(1) },
  clear() { this.setData({ keyword: '', categoryId: '' }); this.fetch(1) },

  async reload() {
    papers.categories().then(r => this.setData({ cats: r.items })).catch(() => {})
    return this.fetch(1)
  },

  async fetch(page) {
    const { keyword, categoryId } = this.data
    this.setData({ loading: page === 1, error: false })
    try {
      const res = await papers.list({ page, keyword, categoryId })
      this.setData({ items: page === 1 ? res.items : this.data.items.concat(res.items), page, totalPages: res.totalPages, total: res.totalCount, loading: false })
    } catch (e) {
      this.setData({ loading: false, error: true })
    }
  },

  open(e) { wx.navigateTo({ url: `/pkg-paper/detail/detail?id=${e.currentTarget.dataset.id}` }) },
  openWrong() { wx.navigateTo({ url: '/pkg-paper/wrong/wrong' }) }
})
