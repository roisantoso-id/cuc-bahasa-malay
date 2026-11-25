// 图鉴：按天的词云。每天学过的词（按第一次学的日期）飘在一片夜空里，越熟越大越亮；点词看详情。
// 白天（旅行手账）换一套排版：十站 = 十段词频，选一站看这一站的词表（/level），可按词性筛，点词进详情。白天不加载、不画星空。
const setTab = require('../../utils/tab')
const vocab = require('../../api/vocab')
const audio = require('../../utils/vocab-audio')

const MAX = 60 // 一朵词云最多放这么多词，再多就挤了
const md = d => `${Number(d.slice(5, 7))}.${Number(d.slice(8, 10))}`
const cn = d => `${Number(d.slice(5, 7))}月${Number(d.slice(8, 10))}日`
const level = box => (box >= 6 ? 4 : box >= 4 ? 3 : box >= 2 ? 2 : box >= 1 ? 1 : 0) // 0 刚学 … 4 记牢

// ---- 白天词表 ----
const PAGE = 60 // 词表一次放这么多行，滑到底再加
const pad = (n, k) => String(n).padStart(k, '0')
const dots = b => (b < 0 ? 0 : b >= 6 ? 3 : b >= 3 ? 2 : 1) // 没学 / 学习中 / 熟悉 / 记牢（和单站词表同一分法）
// 词性归类：库里是「名词」「被动动词」「名词/形容词」「名」这类写法，按第一个词性归到五类
const POS = [{ k: 'all', t: '全部词性' }, { k: 'n', t: '名词' }, { k: 'v', t: '动词' }, { k: 'a', t: '形容词' }, { k: 'd', t: '副词' }, { k: 'f', t: '功能词' }]
function posOf(raw) {
  const p = String(raw || '').split('/')[0]
  if (!p) return { k: '', c: '' }
  if (p.indexOf('名') >= 0) return { k: 'n', c: '名' }
  if (p.indexOf('助') >= 0) return { k: 'f', c: '助' }
  if (p.indexOf('动') >= 0) return { k: 'v', c: '动' }
  if (p[0] === '形') return { k: 'a', c: '形' }
  if (p[0] === '副') return { k: 'd', c: '副' }
  if (/^(介|连|代|数|量|系|疑问|否定|语气|感叹)/.test(p)) return { k: 'f', c: p[0] }
  return { k: '', c: p[0] } // 短语等：只在「全部词性」里
}

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
  data: { view: 'loading', error: '', days: [], sel: 0, cur: null, cloud: [], cloudH: 420, W: 0, learned: 0, more: false, shownN: 0, intoView: '', skyPlay: 0, formed: false,
    dA: null, bands: [], band: 0, bandCap: '', posTabs: [], posSel: 'all', rows: [], rowsMore: false, rowsN: 0, listBusy: false },
  // 换了白天 / 夜晚：白天那套没加载过就加载；回到夜晚时星空组件是新建的，按当前这一天重新排版、重放
  //（另一套在学习记录变了以后没刷新过的，也重新加载）
  onTheme(th) {
    const stale = this.staleOther
    this.staleOther = false
    if (th.day) { if (stale || !this.data.dA) this.loadDay(); else this.setData({ view: 'ok' }); return }
    if (stale || !this.data.days.length) return this.loadNight()
    this.setData({ view: 'ok' })
    this.show(this.data.sel)
  },
  onShow() {
    setTab(this, 1)
    const dirty = getApp().globalData.dirty
    if (dirty) this.staleOther = true
    if (this.data.th.day) { if (dirty || !this.data.dA) this.loadDay() } else if (dirty || !this.data.days.length) this.loadNight()
  },
  load() { return this.data.th.day ? this.loadDay() : this.loadNight() },
  onPullDownRefresh() { Promise.resolve(this.load()).then(() => wx.stopPullDownRefresh()) },
  onReachBottom() { if (this.data.th.day) this.moreRows() },

  // ---- 白天：十站柱子 + 词表 ----
  async loadDay() {
    if (this.dayBusy) return
    this.dayBusy = true
    if (!this.data.dA) this.setData({ view: 'loading' })
    try {
      const h = await vocab.home()
      const bands = (h.levels || []).map(l => ({
        level: l.level, no: pad(l.level, 2), city: l.city, total: l.total, learned: l.learned, open: l.open, stamped: l.stamped,
        pct: l.total ? Math.round(l.learned / l.total * 100) : 0
      }))
      const keep = this.data.band && bands.some(b => b.level === this.data.band && b.open)
      const band = keep ? this.data.band : h.level
      this.setData({ view: 'ok', dA: { words: h.total.words, learned: h.total.learned }, bands })
      await this.loadBand(band)
    } catch (e) {
      if (!this.data.dA) this.setData({ view: 'error', error: e.message })
      else wx.showToast({ title: e.message, icon: 'none' })
    }
    this.dayBusy = false
  },
  async loadBand(level) {
    const b = this.data.bands.find(x => x.level === level)
    if (!b) return
    this.setData({ band: level, bandCap: this.cap(b), listBusy: true })
    try {
      const { words } = await vocab.stop(level)
      if (this.data.band !== level) return
      this.all = words.map(w => {
        const p = posOf(w.pos)
        return { rank: w.rank, no: pad(w.rank, 4), ms: w.ms, zh: w.zh, pk: p.k, pc: p.c, lv: dots(w.box) }
      })
      const has = {}
      this.all.forEach(w => { has[w.pk] = 1 })
      const posTabs = POS.filter(t => t.k === 'all' || has[t.k])
      const posSel = posTabs.some(t => t.k === this.data.posSel) ? this.data.posSel : 'all'
      if (this.all.length) this.setData({ bandCap: this.cap(b, this.all[0].rank, this.all[this.all.length - 1].rank) })
      this.setData({ posTabs, posSel, listBusy: false })
      this.filter()
    } catch (e) {
      this.setData({ listBusy: false })
      wx.showToast({ title: e.message, icon: 'none' })
    }
  },
  // 「01 吉隆坡 · 最常用的 500 词 · 已学 37」；词频范围等词表回来再补上
  cap(b, lo, hi) {
    const range = b.level === 1 ? `最常用的 ${b.total} 词` : lo ? `常用第 ${lo}–${hi} 词` : `${b.total} 词`
    const st = !b.open ? '还没开放' : b.stamped ? '已学完' : b.learned ? `已学 ${b.learned}` : '还没开始'
    return { head: `${b.no} ${b.city}`, rest: ` · ${range} · ${st}` }
  },
  filter() {
    const k = this.data.posSel
    this.list = k === 'all' ? this.all : this.all.filter(w => w.pk === k)
    const rows = this.list.slice(0, PAGE)
    this.setData({ rows, rowsN: rows.length, rowsMore: this.list.length > rows.length })
  },
  moreRows() {
    if (!this.list || !this.data.rowsMore) return
    const n = this.data.rowsN, add = this.list.slice(n, n + PAGE), up = {}
    add.forEach((w, i) => { up[`rows[${n + i}]`] = w })
    up.rowsN = n + add.length
    up.rowsMore = this.list.length > n + add.length
    this.setData(up)
  },
  pickBand(e) {
    const b = this.data.bands[e.currentTarget.dataset.i]
    if (!b) return
    if (!b.open) return wx.showToast({ title: '这一站的词还没上架', icon: 'none' })
    if (b.level !== this.data.band) this.loadBand(b.level)
  },
  pickPos(e) {
    const k = e.currentTarget.dataset.k
    if (k === this.data.posSel) return
    this.setData({ posSel: k })
    this.filter()
  },
  goSearch() { wx.navigateTo({ url: '/pkg-word/search/search' }) },
  openWord(e) { wx.navigateTo({ url: `/pkg-word/word/word?rank=${e.currentTarget.dataset.r}` }) },

  // ---- 夜晚：按天的星空词云 ----
  async loadNight() {
    if (this.nightBusy) return
    this.nightBusy = true
    if (!this.data.days.length) this.setData({ view: 'loading' })
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
    this.nightBusy = false
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
