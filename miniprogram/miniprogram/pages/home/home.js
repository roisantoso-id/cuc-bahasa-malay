// 旅程首页:今日车票(到期复习 + 今天的新词)+ 10 站路线(每站 500 词)
const vocab = require('../../api/vocab')
const { ensureStudent } = require('../../utils/student')

// 低端安卓（benchmarkLevel 低）不开 3D；iOS 返回 -1，照常开
const can3d = () => {
  try {
    const d = wx.getDeviceInfo ? wx.getDeviceInfo() : wx.getSystemInfoSync()
    return !(typeof d.benchmarkLevel === 'number' && d.benchmarkLevel >= 0 && d.benchmarkLevel < 15)
  } catch (e) { return true }
}
const greet = () => { const h = (new Date().getUTCHours() + 8) % 24; return h < 11 ? 'Selamat pagi' : h < 15 ? 'Selamat tengah hari' : h < 19 ? 'Selamat petang' : 'Selamat malam' }

Page({
  data: { view: 'loading', h: null, greet: '', error: '', show3d: false },
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
      this.setData({ view: 'ok', h, cur, greet: greet(), todo: h.today.due + h.today.newLeft, show3d: can3d() }, () => this.map3d(h))
    } catch (e) {
      this.setData({ view: 'error', error: e.message })
    }
  },
  // 3D 地图：three.js 在 pkg-word 分包里，异步加载；失败或机器太弱就显示插画
  map3d(h) {
    if (!this.data.show3d) return
    const key = h.level + ':' + h.levels.filter(l => l.stamped).length
    if (this.map && this.mapKey === key) return
    this.mapKey = key
    require.async('../../pkg-word/three/journey.js').then(m => {
      wx.createSelectorQuery().select('#map3d').fields({ node: true, size: true }).exec(res => {
        const r = res && res[0]
        if (!r || !r.node) return this.setData({ show3d: false })
        if (this.map) this.map.destroy()
        try {
          this.map = m.start(r.node, { width: r.width, height: r.height, dpr: Math.min(2, wx.getWindowInfo ? wx.getWindowInfo().pixelRatio : 2), current: h.level, stamped: h.levels.filter(l => l.stamped).map(l => l.level), open: h.levels.filter(l => l.open).map(l => l.level) })
        } catch (e) { console.warn('3D 地图启动失败', e); this.setData({ show3d: false }) }
      })
    }).catch(e => { console.warn('3D 地图加载失败', e); this.setData({ show3d: false }) })
  },
  touch(e) {
    const x = e.touches[0].clientX
    if (e.type === 'touchmove' && this.map && this.lastX != null) this.map.drag(x - this.lastX)
    this.lastX = x
  },
  battle() { wx.switchTab({ url: '/pages/battle/battle' }) },
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
