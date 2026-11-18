const setTab = require('../../utils/tab')
// 图鉴：整片星图（每个已上架的词一颗星，学过的点亮）+ 一站 500 词的点阵 + 词卡列表
const vocab = require('../../api/vocab')
const { ensureStudent } = require('../../utils/student')
const { draw } = require('../../utils/canvas')

const CHUNK = 60
const POS_TABS = ['全部', '名词', '动词', '形容词', '副词', '功能词']
const posOf = p => { p = String(p || ''); return p.includes('名') ? '名词' : p.includes('动') ? '动词' : p.includes('形') ? '形容词' : p.includes('副') ? '副词' : '功能词' }
const pad = n => (n < 10 ? '0' + n : '' + n)

// 固定种子的随机数：每次画出来都是同一片星系
const rng = seed => () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }

Page({
  data: { view: 'loading', error: '', h: null, sel: 0, levels: [], posTabs: POS_TABS, pos: '全部', stop: null, counts: { done: 0, learn: 0, none: 0 }, pct: { done: 0, learn: 0 }, cards: [], shown: 0, hasMore: false, loadingStop: false },
  onShow() {
    setTab(this, 1)
    if (getApp().globalData.dirty || !this.data.h) this.load()
  },
  async onPullDownRefresh() { await this.load(); wx.stopPullDownRefresh() },
  async load() {
    try {
      const st = await ensureStudent()
      if (!st) return
      const h = await vocab.home()
      getApp().globalData.dirty = false
      const levels = h.levels.map(l => ({ level: l.level, no: pad(l.level), state: l.stamped ? 'full' : l.level === h.level ? 'half' : 'out', open: l.open }))
      const sel = this.data.sel && levels.some(l => l.level === this.data.sel && l.open) ? this.data.sel : (h.levels.some(l => l.level === h.level && l.open) ? h.level : ((h.levels.find(l => l.open) || {}).level || 1))
      this.setData({ view: 'ok', h, levels, sel }, () => { this.galaxy(); this.loadStop(sel) })
    } catch (e) {
      this.setData({ view: 'error', error: e.message })
    }
  },
  galaxy() {
    const { learned, words } = this.data.h.total
    const N = Math.max(words, 1)
    draw(this, '#galaxy', (ctx, w, hh) => {
      const rand = rng(20261118)
      const cx = w / 2, cy = hh / 2, R = Math.min(w * 0.46, hh * 0.9 / 1.0)
      const order = Array.from({ length: N }, (_, i) => i)
      for (let i = N - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); const t = order[i]; order[i] = order[j]; order[j] = t }
      const lit = new Uint8Array(N)
      for (let i = 0; i < Math.min(learned, N); i++) lit[order[i]] = 1
      const dim = [], on = []
      for (let i = 0; i < N; i++) {
        const t = Math.pow(rand(), 0.75)
        const arm = i % 2 ? Math.PI : 0
        const th = arm + t * 5.2 + (rand() - 0.5) * (0.5 + 0.9 * (1 - t))
        const r = t * R * 0.95 + (rand() - 0.5) * 8
        const p = { x: cx + Math.cos(th) * r * 1.0, y: cy + Math.sin(th) * r * 0.58, s: 0.8 + rand() * 0.9 }
        ;(lit[i] ? on : dim).push(p)
      }
      ctx.fillStyle = 'rgba(243,234,214,0.26)'
      dim.forEach(p => { ctx.fillRect(p.x, p.y, p.s, p.s) })
      ctx.fillStyle = '#e9b961'
      on.forEach(p => { ctx.beginPath(); ctx.arc(p.x, p.y, p.s * 0.9 + 0.4, 0, Math.PI * 2); ctx.fill() })
    })
  },
  pick(e) {
    const l = e.currentTarget.dataset.l
    const it = this.data.levels.find(x => x.level === l)
    if (!it || !it.open) { wx.showToast({ title: '这一站的词表还在整理', icon: 'none' }); return }
    if (l === this.data.sel) return
    this.setData({ sel: l, pos: '全部' })
    this.loadStop(l)
  },
  async loadStop(level) {
    this.setData({ loadingStop: true })
    try {
      const { stop, words } = await vocab.stop(level)
      if (level !== this.data.sel) return
      this.words = words.map(w => ({ ...w, posT: posOf(w.pos), st: w.box < 0 ? 'none' : w.box >= 6 ? 'done' : 'learn' }))
      const counts = { done: 0, learn: 0, none: 0 }
      this.words.forEach(w => counts[w.st]++)
      const all = Math.max(1, this.words.length)
      const pct = { done: Math.round(counts.done / all * 1000) / 10, learn: Math.round(counts.learn / all * 1000) / 10 }
      this.setData({ stop, counts, pct, loadingStop: false, lo: (level - 1) * 500 + 1, hi: level * 500 })
      this.dotMatrix()
      this.applyPos()
    } catch (e) {
      this.setData({ loadingStop: false })
      wx.showToast({ title: e.message, icon: 'none' })
    }
  },
  dotMatrix() {
    if (true) return   // 500 点阵已经换成进度条（页面上没有 #matrix 了），保留代码备用
    const ws = this.words
    draw(this, '#matrix', (ctx, w, hh) => {
      const cols = 25, rows = 20, px = w / cols, py = hh / rows, r = Math.min(px, py) * 0.34
      const col = { done: '#e9b961', learn: '#8fc0a0', none: 'rgba(243,234,214,0.16)' }
      for (let i = 0; i < cols * rows; i++) {
        const wd = ws[i]
        ctx.fillStyle = wd ? col[wd.st] : 'rgba(243,234,214,0.06)'
        ctx.beginPath(); ctx.arc((i % cols + 0.5) * px, (Math.floor(i / cols) + 0.5) * py, r, 0, Math.PI * 2); ctx.fill()
      }
    })
  },
  setPos(e) { this.setData({ pos: e.currentTarget.dataset.p }); this.applyPos() },
  applyPos() {
    const p = this.data.pos
    this.filtered = p === '全部' ? this.words : this.words.filter(w => w.posT === p)
    this.shownN = Math.min(CHUNK, this.filtered.length)
    this.setData({ cards: this.filtered.slice(0, this.shownN), hasMore: this.filtered.length > this.shownN })
  },
  more() {
    this.shownN = Math.min(this.shownN + CHUNK, this.filtered.length)
    this.setData({ cards: this.filtered.slice(0, this.shownN), hasMore: this.filtered.length > this.shownN })
  },
  open(e) { wx.navigateTo({ url: `/pkg-word/word/word?rank=${e.currentTarget.dataset.r}` }) },
  onShareAppMessage() { return { title: '一起背马来语 5000 高频词', path: '/pages/home/home' } }
})
