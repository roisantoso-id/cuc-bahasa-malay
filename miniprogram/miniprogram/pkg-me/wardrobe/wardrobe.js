// 我的犀鸟：已解锁的服装可以直接换上（当头像），没解锁的灰着、写明怎么获得；下面是徽章墙
const vocab = require('../../api/vocab')
const lvOf = require('../../utils/level')
const sfx = require('../../utils/sfx')

Page({
  data: { view: 'loading', error: '', costumes: [], badges: [], mascot: '', curImg: '', curTitle: '', costumeN: 0, badgeN: 0, lv: { level: 1, pct: 0 }, pv: null, pvOn: false },
  onLoad() { this.load() },
  async load() {
    try {
      const [r, st] = await Promise.all([vocab.achievements(), vocab.stats().catch(() => null)])
      const costumes = r.items.filter(x => x.type === 'costume').map(x => ({ ...x, short: x.title.replace(/^([^A-Za-z]*[\u4e00-\u9fff][^A-Za-z]*?)\s+[A-Za-z].*$/, '$1'), how: (x.desc.match(/第 \d+ 站/) || [''])[0] + ' · ' + x.desc.replace(/^第 \d+ 站|通关解锁$/g, '') })), badges = r.items.filter(x => x.type === 'badge')
      const cur = costumes.find(x => x.key === r.mascot)
      this.setData({ view: 'ok', costumes, badges, mascot: r.mascot, curImg: r.mascotImg, curTitle: cur ? cur.title : '', costumeN: costumes.filter(x => x.unlocked).length, badgeN: badges.filter(x => x.unlocked).length, lv: lvOf(st && st.levels) })
      if (r.fresh && r.fresh.length) vocab.achievementsSeen().catch(() => {})
    } catch (e) { this.setData({ view: 'error', error: e.message }) }
  },
  open(e) {
    const { g, i } = e.currentTarget.dataset
    this.setData({ pv: this.data[g][i], pvOn: false })
    setTimeout(() => this.setData({ pvOn: true }), 20)
  },
  close() { this.setData({ pvOn: false }); setTimeout(() => this.setData({ pv: null }), 220) },
  noop() {},
  wear(e) { this.pick(e).then(() => this.close()) },
  async pick(e) {
    const k = e.currentTarget.dataset.k
    if (k === this.data.mascot) return
    try {
      const r = await vocab.setMascot(k)
      const cur = this.data.costumes.find(x => x.key === k)
      this.setData({ mascot: r.mascot, curImg: r.mascotImg, curTitle: cur ? cur.title : '' })
      getApp().globalData.dirty = true
      sfx.play('unlock')
      wx.showToast({ title: '换好了', icon: 'success' })
    } catch (err) { wx.showToast({ title: err.message, icon: 'none' }) }
  }
})
