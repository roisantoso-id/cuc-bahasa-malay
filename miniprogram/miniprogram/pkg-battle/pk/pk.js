// 好友 PK：没答过 → 看谁发起的、接受挑战；答过 → 排名 + 我的复盘 + 邀请同学
// 从分享卡片冷启动也能直接打开：vocab.pk 里会自动微信登录。
const vocab = require('../../api/vocab')
const sfx = require('../../utils/sfx')
const { fmtMs, review } = require('../util')

Page({
  data: { view: 'loading', error: '', pk: null, my: null, ranking: [], list: [] },

  onLoad(o) {
    this.id = o.id || ''
    if (!this.id) this.setData({ view: 'error', error: '链接里没有 PK 编号' })
  },
  onShow() { if (this.id) this.load() },
  async onPullDownRefresh() { await this.load(); wx.stopPullDownRefresh() },

  async load() {
    if (this.loading) return
    this.loading = true
    try {
      const pk = await vocab.pk(this.id)
      const ranking = (pk.ranking || []).map(r => ({ ...r, time: fmtMs(r.ms) }))
      const my = ranking.find(r => r.me) || null
      const view = pk.mine ? 'done' : pk.expired ? 'expired' : 'invite'
      this.setData({ view, pk, my, ranking, list: review(pk.review) })
      // 刚答完回到结果页时放一次：第一名（且不止一个人）是胜利音效 + 彩纸，否则完成音效
      if (view === 'done' && !this.celebrated) {
        this.celebrated = true
        const win = my && my.place === 1 && ranking.length >= 2
        sfx.play(win ? 'win' : 'complete')
        if (win) setTimeout(() => this.setData({ cfFire: (this.data.cfFire || 0) + 1 }), 150)
      }
      wx.setNavigationBarTitle({ title: view === 'done' ? 'PK 结果' : '好友 PK' })
    } catch (e) {
      if (this.data.view !== 'done' && this.data.view !== 'invite') this.setData({ view: 'error', error: e.message })
      else wx.showToast({ title: e.message, icon: 'none' })
    }
    this.loading = false
  },

  play() { wx.redirectTo({ url: `/pkg-battle/play/play?kind=pk&id=${this.id}` }) },
  home() { wx.switchTab({ url: '/pages/battle/battle' }) },

  onShareAppMessage() {
    const pk = this.data.pk || {}
    const name = (pk.creator && pk.creator.name) || (this.data.my && this.data.my.name) || '同学'
    return {
      title: `「${name}」邀请你马来语单词 PK，第${pk.level || 1}站，10 题`,
      path: `/pkg-battle/pk/pk?id=${this.id}`
    }
  }
})
