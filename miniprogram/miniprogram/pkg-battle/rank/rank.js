// 本周排行：全站 / 本校 / 本班（个人学习分），学校榜（全校总分）
const vocab = require('../../api/vocab')
const { fmtWeek } = require('../util')

const TABS = [{ k: 'all', t: '全站' }, { k: 'school', t: '本校' }, { k: 'class', t: '本班' }, { k: 'schools', t: '学校榜' }]

Page({
  data: { tabs: TABS, tab: 'all', view: 'loading', error: '', week: '', list: [], me: null, needProfile: false },

  onLoad(o) { if (TABS.some(t => t.k === o.tab)) this.setData({ tab: o.tab }) },
  // 从「完善资料」回来要刷新
  onShow() { this.load() },
  async onPullDownRefresh() { await this.load(); wx.stopPullDownRefresh() },
  pick(e) {
    const k = e.currentTarget.dataset.k
    if (k === this.data.tab) return
    this.setData({ tab: k, view: 'loading', list: [] })
    this.load()
  },

  async load() {
    const tab = this.data.tab
    this.seq = (this.seq || 0) + 1
    const seq = this.seq
    try {
      const r = tab === 'schools' ? await vocab.schools() : await vocab.rank(tab)
      if (seq !== this.seq) return // 已经切到别的榜
      const me = r.me && !r.me.place ? r.me : null // 不在榜上时单独显示我的分
      this.setData({ view: 'ok', week: fmtWeek(r.week), list: r.list || [], me, needProfile: !!r.needProfile })
    } catch (e) {
      if (seq === this.seq) this.setData({ view: 'error', error: e.message })
    }
  },
  profile() { wx.navigateTo({ url: '/pages/register/register' }) }
})
