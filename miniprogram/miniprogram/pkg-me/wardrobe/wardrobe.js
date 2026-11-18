// 我的犀鸟：已解锁的服装可以直接换上（当头像），没解锁的灰着、写明怎么获得；下面是徽章墙
const vocab = require('../../api/vocab')

Page({
  data: { view: 'loading', error: '', costumes: [], badges: [], mascot: '', curImg: '', curTitle: '', costumeN: 0, badgeN: 0 },
  onLoad() { this.load() },
  async load() {
    try {
      const r = await vocab.achievements()
      const costumes = r.items.filter(x => x.type === 'costume'), badges = r.items.filter(x => x.type === 'badge')
      const cur = costumes.find(x => x.key === r.mascot)
      this.setData({ view: 'ok', costumes, badges, mascot: r.mascot, curImg: r.mascotImg, curTitle: cur ? cur.title : '', costumeN: costumes.filter(x => x.unlocked).length, badgeN: badges.filter(x => x.unlocked).length })
      if (r.fresh && r.fresh.length) vocab.achievementsSeen().catch(() => {})
    } catch (e) { this.setData({ view: 'error', error: e.message }) }
  },
  async pick(e) {
    const { k, u, d } = e.currentTarget.dataset
    if (k && !u) return wx.showToast({ title: d, icon: 'none' })
    if (k === this.data.mascot) return
    try {
      const r = await vocab.setMascot(k)
      const cur = this.data.costumes.find(x => x.key === k)
      this.setData({ mascot: r.mascot, curImg: r.mascotImg, curTitle: cur ? cur.title : '' })
      getApp().globalData.dirty = true
      wx.showToast({ title: '换好了', icon: 'success' })
    } catch (err) { wx.showToast({ title: err.message, icon: 'none' }) }
  },
  badge(e) {
    const { t, d, u } = e.currentTarget.dataset
    wx.showToast({ title: u ? `已获得：${t}` : `${d}可获得`, icon: 'none' })
  }
})
