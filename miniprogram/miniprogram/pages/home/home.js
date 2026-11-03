// 旅程首页:今日车票(到期复习 + 今天的新词)+ 10 站路线(每站 500 词)
const vocab = require('../../api/vocab')
const { ensureStudent } = require('../../utils/student')

const greet = () => { const h = (new Date().getUTCHours() + 8) % 24; return h < 11 ? 'Selamat pagi' : h < 15 ? 'Selamat tengah hari' : h < 19 ? 'Selamat petang' : 'Selamat malam' }

Page({
  data: { view: 'loading', h: null, greet: '', error: '' },
  onShow() {
    if (getApp().globalData.dirty || !this.data.h) this.load()
  },
  async onPullDownRefresh() { await this.load(); wx.stopPullDownRefresh() },
  async load() {
    try {
      const st = await ensureStudent()
      if (!st) return
      const h = await vocab.home()
      getApp().globalData.dirty = false
      const cur = h.levels.find(l => l.level === h.level)
      h.levels.forEach(l => { l.pct = l.total ? Math.round(l.learned / l.total * 100) : 0; l.cur = l.level === h.level })
      this.setData({ view: 'ok', h, cur, greet: greet(), todo: h.today.due + h.today.newLeft })
    } catch (e) {
      this.setData({ view: 'error', error: e.message })
    }
  },
  go(e) { wx.navigateTo({ url: e.currentTarget.dataset.url }) },
  start() { wx.navigateTo({ url: '/pkg-word/learn/learn?mode=today' }) },
  more() { wx.navigateTo({ url: `/pkg-word/learn/learn?mode=new&level=${this.data.h.level}` }) },
  stop(e) {
    const l = e.currentTarget.dataset.l
    if (!l.open) { wx.showToast({ title: '这一站的词表还在整理', icon: 'none' }); return }
    wx.navigateTo({ url: `/pkg-word/stop/stop?level=${l.level}` })
  },
  onShareAppMessage() { return { title: '一起背马来语 5000 高频词', path: '/pages/home/home' } }
})
