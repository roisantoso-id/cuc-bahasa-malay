// 图鉴：按天的词云。每天学过的词（按第一次学的日期）飘在一片夜空里，越熟越大越亮；点词看详情。
const setTab = require('../../utils/tab')
const vocab = require('../../api/vocab')
const audio = require('../../utils/vocab-audio')

const MAX = 60 // 一朵词云最多放这么多词，再多就挤了
const md = d => `${Number(d.slice(5, 7))}.${Number(d.slice(8, 10))}`
const cn = d => `${Number(d.slice(5, 7))}月${Number(d.slice(8, 10))}日`
const level = box => (box >= 6 ? 4 : box >= 4 ? 3 : box >= 2 ? 2 : box >= 1 ? 1 : 0) // 0 刚学 … 4 记牢

// 螺旋摆放：从中间往外找空位，估算字宽避免重叠，放不下就跳过
function layout(words, W, H) {
  const placed = [], out = []
  const sorted = words.slice().sort((a, b) => b.box - a.box || a.rank - b.rank)
  sorted.forEach((w, i) => {
    const b = level(w.box)
    const fs = Math.round((i < 3 ? 22 : 14) + b * 3)
    const ww = w.ms.length * fs * 0.56 + 10, hh = fs * 1.35
    for (let t = 0; t < 900; t++) {
      const a = t * 0.32, r = 2.2 * a
      const x = W / 2 + Math.cos(a) * r * 1.5 - ww / 2, y = H / 2 + Math.sin(a) * r - hh / 2
      if (x < 6 || y < 6 || x + ww > W - 6 || y + hh > H - 6) continue
      if (placed.some(p => x < p.x + p.w && x + ww > p.x && y < p.y + p.h && y + hh > p.y)) continue
      placed.push({ x, y, w: ww, h: hh })
      out.push({ k: w.rank, rank: w.rank, ms: w.ms, audio: w.audio || '', b, fs, x: Math.round(x), y: Math.round(y), d: out.length * 45, dur: (3 + (w.rank % 5) * 0.6).toFixed(1) })
      return
    }
  })
  return out
}

Page({
  data: { view: 'loading', error: '', days: [], sel: 0, cur: null, cloud: [], cloudH: 420, W: 0, learned: 0, more: false, shownN: 0, intoView: '', skyPlay: 0, formed: false },
  onShow() {
    setTab(this, 1)
    if (getApp().globalData.dirty || !this.data.days.length) this.load()
  },
  async load() {
    try {
      const { days } = await vocab.days()
      const all = days.flatMap(d => d.words)
      const list = days.map((d, i) => ({ key: d.day, label: `第 ${i + 1} 天`, short: md(d.day), date: cn(d.day), words: d.words }))
      if (list.length > 1) list.unshift({ key: 'all', label: '全部', short: `${list.length} 天`, date: `最近 ${list.length} 天`, words: all.slice(-MAX * 4) })
      const sel = list.length - 1 // 默认看最近一天
      const info = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync()
      this.W = info.windowWidth - 32
      this.setData({ view: 'ok', days: list, learned: all.length, W: this.W, cloudH: Math.round(Math.min(460, Math.max(320, info.windowHeight * 0.48))) })
      this.show(sel)
    } catch (e) {
      this.setData({ view: 'error', error: e.message })
    }
  },
  show(i) {
    const cur = this.data.days[i]
    if (!cur) return
    const words = cur.words.slice(-MAX * 2)
    // 星星拼完字以后文字才淡入，所以每个词的出场间隔缩短
    const cloud = layout(words, this.W, this.data.cloudH).slice(0, MAX).map(c => ({ ...c, d: Math.round(c.d / 4) }))
    this.setData({ sel: i, cur, cloud: [], formed: false, intoView: 'd' + Math.max(0, i - 1) })
    // 先清空再放：星星重新旋转、重新拼字（star-cloud 拼好后触发 formed）
    setTimeout(() => this.setData({ cloud, more: cur.words.length > cloud.length, shownN: cloud.length, skyPlay: this.data.skyPlay + 1 }), 30)
  },
  formed() { this.setData({ formed: true }) },
  pick(e) { this.show(e.currentTarget.dataset.i) },
  noop() {},
  // 点词：弹窗从这个词的位置放大出来；释义、例句、收藏状态从接口取
  async open(e) {
    const { r, x, y } = e.currentTarget.dataset
    const w = this.data.cloud.find(c => c.rank === r) || {}
    const info = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync()
    // 弹窗居中，宽约 86vw；把缩放原点放在词的位置（换算成弹窗内坐标）
    const popW = info.windowWidth * 0.86, popLeft = (info.windowWidth - popW) / 2
    this.setData({ pop: { rank: r, ms: w.ms || '' }, popOn: false, popOx: Math.round(16 + x - popLeft), popOy: Math.round(y - info.windowHeight * 0.18) })
    setTimeout(() => this.setData({ popOn: true }), 20)
    if (w.audio) audio.play(w.audio)   // 点词就读出来
    try {
      const d = await vocab.word(r)
      if (!w.audio && d.audio && this.data.pop && this.data.pop.rank === r) audio.play(d.audio)
      if (this.data.pop && this.data.pop.rank === r) this.setData({ pop: { rank: r, ms: d.ms, root: d.root, audio: d.audio, fav: d.fav, senses: (d.senses || []).slice(0, 3) } })
    } catch (err) { wx.showToast({ title: err.message, icon: 'none' }) }
  },
  close() {
    if (!this.data.pop) return
    this.setData({ popOn: false })
    audio.stop()
    setTimeout(() => this.setData({ pop: null }), 260)
  },
  async fav() {
    const p = this.data.pop
    if (!p) return
    const on = !p.fav
    this.setData({ 'pop.fav': on })
    if (on) { this.setData({ favFx: (this.data.favFx || 0) + 1, favPop: true }); setTimeout(() => this.setData({ favPop: false }), 400) }
    try { await vocab.fav(p.rank, on); getApp().globalData.dirty = true } catch (err) { this.setData({ 'pop.fav': !on }); wx.showToast({ title: err.message, icon: 'none' }) }
  }
})
