// 每周擂台：规则、我的最好成绩、开始按钮（没机会了就不能点）、本周擂台排名（全站 / 本校）
const vocab = require('../../api/vocab')
const { fmtMs, fmtWeek } = require('../util')

Page({
  data: { view: 'loading', error: '', a: null, week: '', bestTime: '', scope: 'all', rankView: 'loading', list: [], noSchool: false },

  onShow() { this.load() },
  async onPullDownRefresh() { await this.load(); wx.stopPullDownRefresh() },

  async load() {
    try {
      const a = await vocab.arena()
      this.setData({ view: 'ok', a, week: fmtWeek(a.week), bestTime: a.best ? fmtMs(a.best.ms) : '' })
    } catch (e) {
      if (this.data.view !== 'ok') { this.setData({ view: 'error', error: e.message }); return }
      wx.showToast({ title: e.message, icon: 'none' })
    }
    this.loadRank()
  },
  async loadRank() {
    const scope = this.data.scope
    this.seq = (this.seq || 0) + 1
    const seq = this.seq
    if (!this.data.list.length) this.setData({ rankView: 'loading' })
    try {
      const r = await vocab.arenaRank(scope)
      if (seq !== this.seq) return
      // 没填学校时服务器退回全站榜，这里提示去完善资料
      const noSchool = scope === 'school' && r.scope !== 'school'
      const list = noSchool ? [] : (r.list || []).map(x => ({ ...x, time: fmtMs(x.ms) }))
      this.setData({ rankView: 'ok', list, noSchool })
    } catch (e) {
      if (seq === this.seq) this.setData({ rankView: 'error', rankError: e.message })
    }
  },
  pickScope(e) {
    const scope = e.currentTarget.dataset.k
    if (scope === this.data.scope) return
    this.setData({ scope, list: [], rankView: 'loading' })
    this.loadRank()
  },
  play() {
    if (!this.data.a || !this.data.a.triesLeft) return
    wx.showModal({
      title: '开始打擂台', content: `点开始就用掉一次机会（本周还剩 ${this.data.a.triesLeft} 次），中途退出也算。`, confirmText: '开始',
      success: r => { if (r.confirm) wx.redirectTo({ url: '/pkg-battle/play/play?kind=arena' }) }
    })
  },
  profile() { wx.navigateTo({ url: '/pages/register/register' }) }
})
