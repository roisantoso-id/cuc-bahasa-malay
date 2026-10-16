// 阅读 tab:文章 / 视频切换,搜索 + 分类 + 分页加载
const { content } = require('../../api/index')
const { requireLogin } = require('../../utils/ui')
const fmt = require('../../utils/format')

const KIND = {
  article: { list: content.articles, cats: content.articleCategories },
  video: { list: content.videos, cats: content.videoCategories }
}

Page({
  data: { kind: 'article', keyword: '', categoryId: '', cats: [], items: [], page: 1, totalPages: 1, total: 0, loading: true, error: false },

  onShow() {
    if (!requireLogin()) return
    if (!this.loaded) { this.loaded = true; this.reload() }
  },
  onPullDownRefresh() { this.reload().then(() => wx.stopPullDownRefresh()) },
  onReachBottom() { if (this.data.page < this.data.totalPages) this.fetch(this.data.page + 1) },

  setKind(e) {
    const kind = e.currentTarget.dataset.kind
    if (kind === this.data.kind) return
    this.setData({ kind, categoryId: '', keyword: '' })
    this.reload()
  },
  setCat(e) { this.setData({ categoryId: e.currentTarget.dataset.id }); this.fetch(1) },
  onKeyword(e) { this.setData({ keyword: e.detail.value }) },
  search() { this.fetch(1) },
  clear() { this.setData({ keyword: '', categoryId: '' }); this.fetch(1) },

  async reload() {
    try {
      const cats = await KIND[this.data.kind].cats()
      this.setData({ cats: cats.items })
    } catch (e) { /* 分类拿不到不影响列表 */ }
    return this.fetch(1)
  },

  async fetch(page) {
    const { kind, keyword, categoryId } = this.data
    this.setData({ loading: page === 1, error: false })
    try {
      const res = await KIND[kind].list({ page, keyword, categoryId })
      const items = res.items.map(x => ({ ...x, date: fmt.date(x.publishedAt), dur: x.durationSeconds ? fmt.duration(x.durationSeconds) : '' }))
      this.setData({ items: page === 1 ? items : this.data.items.concat(items), page, totalPages: res.totalPages, total: res.totalCount, loading: false })
    } catch (e) {
      this.setData({ loading: false, error: true })
    }
  },

  open(e) {
    const { id } = e.currentTarget.dataset
    wx.navigateTo({ url: this.data.kind === 'article' ? `/pkg-read/article/article?id=${id}` : `/pkg-read/video/video?id=${id}` })
  }
})
