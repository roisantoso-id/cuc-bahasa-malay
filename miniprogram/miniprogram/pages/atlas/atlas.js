// 图鉴：按天的词云。每天学过的词（按第一次学的日期）飘在一片夜空里，越熟越大越亮；点词看详情。
const setTab = require('../../utils/tab')
const vocab = require('../../api/vocab')

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
      out.push({ k: w.rank, rank: w.rank, ms: w.ms, b, fs, x: Math.round(x), y: Math.round(y), d: out.length * 45, dur: (3 + (w.rank % 5) * 0.6).toFixed(1) })
      return
    }
  })
  return out
}

Page({
  data: { view: 'loading', error: '', days: [], sel: 0, cur: null, cloud: [], cloudH: 420, learned: 0, more: false, shownN: 0, intoView: '' },
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
      this.setData({ view: 'ok', days: list, learned: all.length, cloudH: Math.round(Math.min(460, Math.max(320, info.windowHeight * 0.48))) })
      this.show(sel)
    } catch (e) {
      this.setData({ view: 'error', error: e.message })
    }
  },
  show(i) {
    const cur = this.data.days[i]
    if (!cur) return
    const words = cur.words.slice(-MAX * 2)
    const cloud = layout(words, this.W, this.data.cloudH).slice(0, MAX)
    this.setData({ sel: i, cur, cloud: [], intoView: 'd' + Math.max(0, i - 1) })
    // 先清空再放，词云每次都重新弹出来
    setTimeout(() => this.setData({ cloud, more: cur.words.length > cloud.length, shownN: cloud.length }), 30)
  },
  pick(e) { this.show(e.currentTarget.dataset.i) },
  open(e) { wx.navigateTo({ url: `/pkg-word/word/word?rank=${e.currentTarget.dataset.r}` }) }
})
