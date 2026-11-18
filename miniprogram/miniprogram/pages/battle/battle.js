// 对战首页：好友 PK（选一站发起）、每周擂台、本周排行入口、我的 PK
const vocab = require('../../api/vocab')

const day = iso => (iso ? `${Number(iso.slice(5, 7))}月${Number(iso.slice(8, 10))}日` : '')

Page({
  data: { view: 'loading', error: '', levels: [], level: 0, arena: null, me: null, pks: [], busy: false },
  onShow() { this.load() },
  async onPullDownRefresh() { await this.load(); wx.stopPullDownRefresh() },
  async load() {
    if (this.loading) return
    this.loading = true
    try {
      const [h, arena, rank, mine] = await Promise.all([
        vocab.home(),
        vocab.arena().catch(() => null),
        vocab.rank('all').catch(() => null),
        vocab.pkMine().catch(() => [])
      ])
      const levels = (h.levels || []).filter(l => l.open).map(l => ({ level: l.level, city: l.city }))
      let level = this.data.level
      if (!levels.some(l => l.level === level)) level = levels.some(l => l.level === h.level) ? h.level : (levels[0] ? levels[0].level : 0)
      const pks = (Array.isArray(mine) ? mine : (mine && mine.list) || []).map(p => ({ ...p, date: day(p.createdAt) }))
      this.setData({ view: 'ok', levels, level, arena, me: rank && rank.me, pks })
    } catch (e) {
      if (this.data.view !== 'ok') this.setData({ view: 'error', error: e.message })
      else wx.showToast({ title: e.message, icon: 'none' })
    }
    this.loading = false
  },
  pickLevel(e) { this.setData({ level: e.currentTarget.dataset.l }) },
  async create() {
    if (this.data.busy || !this.data.level) return
    this.setData({ busy: true })
    try {
      const { id } = await vocab.pkCreate(this.data.level)
      wx.navigateTo({ url: `/pkg-battle/play/play?kind=pk&id=${id}` })
    } catch (e) {
      wx.showToast({ title: e.message, icon: 'none' })
    }
    this.setData({ busy: false })
  },
  arena() { wx.navigateTo({ url: '/pkg-battle/arena/arena' }) },
  rank() { wx.navigateTo({ url: '/pkg-battle/rank/rank' }) },
  open(e) { wx.navigateTo({ url: `/pkg-battle/pk/pk?id=${e.currentTarget.dataset.id}` }) },
  onShareAppMessage() { return { title: '一起背马来语单词，来比一比', path: '/pages/home/home' } }
})
