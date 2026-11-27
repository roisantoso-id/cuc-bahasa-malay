const setTab = require('../../utils/tab')
// 今日：一个数字、一个按钮。圆环是今天的进度，犀鸟站在旁边陪着
const vocab = require('../../api/vocab')
const audio = require('../../utils/vocab-audio')
const sfx = require('../../utils/sfx')
const { ensureStudent } = require('../../utils/student')
const { draw } = require('../../utils/canvas')
const theme = require('../../utils/theme')

const bj = () => new Date(Date.now() + 8 * 3600e3)
const greet = () => { const h = bj().getUTCHours(); return h < 5 ? '夜深了' : h < 11 ? '早上好' : h < 14 ? '中午好' : h < 18 ? '下午好' : '晚上好' }
const dateText = () => { const d = bj(); return `${d.getUTCMonth() + 1}月${d.getUTCDate()}日` }
// 今日一词：按日期定一个，同一天不变
const dayIndex = n => Math.floor(bj().getTime() / 86400e3) % Math.max(1, n)
const WD = '日一二三四五六'
const pad2 = n => (n < 10 ? '0' : '') + n
// 白天车票 / 路线用：第几站的词序范围（服务端 levels 带 first / last；没有就不显示）
const rangeOf = l => (l && l.first && l.last ? `№ ${l.first}–${l.last}` : '')

Page({
  data: { view: 'loading', h: null, error: '', greet: '', date: '', todo: 0, mins: 0, pct: 0, wod: null },
  onShow() {
    setTab(this, 0)
    if (getApp().globalData.dirty || !this.data.h) this.load()
  },
  onUnload() { audio.stop() },
  noop() {},
  // ---- 解锁新成就弹窗 ----
  async checkUnlock() {
    try {
      const r = await vocab.achievements()
      if (!r.fresh || !r.fresh.length) return
      this.fresh = r.fresh
      this.showUnlock()
      vocab.achievementsSeen().catch(() => {})
    } catch (e) { /* 成就检查失败不影响首页 */ }
  },
  showUnlock() {
    const u = this.fresh.shift()
    if (!u) return this.setData({ unlock: null })
    this.setData({ unlock: u, ulMore: this.fresh.length })
    sfx.play('unlock')
    setTimeout(() => this.setData({ ulFx: (this.data.ulFx || 0) + 1 }), 120)
  },
  ulNext() { this.showUnlock() },
  async ulWear() {
    try { await vocab.setMascot(this.data.unlock.key); getApp().globalData.dirty = true; wx.showToast({ title: '换好了', icon: 'success' }) } catch (e) { wx.showToast({ title: e.message, icon: 'none' }) }
    this.showUnlock()
  },
  async onPullDownRefresh() { await this.load(); wx.stopPullDownRefresh() },
  async load() {
    try {
      const st = await ensureStudent()
      if (!st) return
      const h = await vocab.home()
      getApp().globalData.dirty = false
      this.loadId = (this.loadId || 0) + 1
      const t = h.today
      const todo = t.due + t.newLeft
      const done = t.learned + t.reviewed
      const pct = done + todo ? Math.min(1, done / (done + todo)) : 1
      const cur = h.levels.find(l => l.level === h.level)
      this.setData({
        view: 'ok', h, cur, todo, pct,
        mins: Math.max(1, Math.round(todo * 0.25)),
        greet: greet(), date: dateText(),
        left: cur ? cur.total - cur.learned : 0,
        wkday: '星期' + WD[bj().getUTCDay()],
        route: this.routeOf(h)
      }, () => { this.ring(); this.wordOfDay(h.level); if (!this.askPlacement(h)) this.checkUnlock(); if (this.data.th && this.data.th.day) this.dayExtras() })
    } catch (e) {
      this.setData({ view: 'error', error: e.message })
    }
  },
  // 每个人第一次进来先做入门测评（可以跳过；跳过也记下，不再自动弹）。一次打开只问一次
  askPlacement(h) {
    const g = getApp().globalData
    if (!h.placement || h.placement.done || g.placementAsked) return false
    g.placementAsked = true
    wx.navigateTo({ url: '/pkg-word/placement/placement?from=home' })
    return true
  },
  placement() { wx.navigateTo({ url: '/pkg-word/placement/placement' }) },
  // 换了白天 / 夜晚：进度环重画；换到白天补上车票词序和这一周
  onTheme(th) { this.ring(); if (th && th.day && this.data.h && this.extrasFor !== this.loadId) this.dayExtras() },
  // ---- 白天「旅行手账」用 ----
  // 路线：上一站（已走过）、当前站、下一站，最多 3 行
  routeOf(h) {
    const ls = h.levels || []
    const i = Math.max(0, ls.findIndex(l => l.level === h.level))
    const from = Math.max(0, Math.min(i - 1, ls.length - 3))
    return ls.slice(from, from + 3).map(l => ({
      level: l.level, no: pad2(l.level), city: l.city, range: rangeOf(l),
      cur: l.level === h.level, stamped: l.stamped, open: l.open,
      learned: l.learned, total: l.total,
      pct: l.total ? Math.round(l.learned / l.total * 100) : 0
    }))
  },
  // 车票上的「词序」：今天的新词就是当前站里还没学过的前 newLeft 个；这一周：最近 7 天学没学
  async dayExtras() {
    const h = this.data.h
    if (!h) return
    const id = this.extrasFor = this.loadId
    const [lv, st] = await Promise.all([vocab.stop(h.level).catch(() => null), vocab.stats().catch(() => null)])
    if (this.loadId !== id) return
    const up = {}
    if (lv && lv.words && lv.words.length) {
      const n = h.today.newLeft
      const fresh = lv.words.filter(w => w.box < 0)
      up.seq = !n || !fresh.length ? '' : fresh.length >= n ? `№ ${fresh[0].rank}–${fresh[n - 1].rank}` : `№ ${fresh[0].rank} 起`
      // 当前站没带 first / last 时用词表补上
      const ri = this.data.route.findIndex(r => r.cur)
      if (ri >= 0 && !this.data.route[ri].range) up[`route[${ri}].range`] = `№ ${lv.words[0].rank}–${lv.words[lv.words.length - 1].rank}`
    }
    if (st && st.days && st.days.length) {
      const last = st.days.slice(-7)
      up.week = last.map((d, k) => {
        const now = k === last.length - 1
        const wd = new Date(d.day + 'T00:00:00Z').getUTCDay()
        return { k: d.day, lab: now ? '今天' : WD[wd], on: d.new + d.review > 0, now }
      })
    }
    this.setData(up)
  },
  stop(e) { wx.navigateTo({ url: `/pkg-word/stop/stop?level=${e.currentTarget.dataset.level}` }) },
  ring() {
    const { pct } = this.data
    draw(this, '#ring', (ctx, w, hh) => {
      const cx = w / 2, cy = hh / 2, r = Math.min(w, hh) / 2 - 8
      ctx.lineWidth = 8
      ctx.lineCap = 'round'
      const day = theme.isDay()
      ctx.strokeStyle = day ? 'rgba(28,36,32,0.1)' : 'rgba(243,234,214,0.12)'
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke()
      if (pct > 0) {
        ctx.strokeStyle = day ? '#c46d1c' : '#e9b961'
        ctx.beginPath(); ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.max(0.02, pct)); ctx.stroke()
      }
    })
  },
  async wordOfDay(level) {
    if (this.wodLevel === level && this.data.wod) return
    try {
      const { words } = await vocab.stop(level)
      if (!words.length) return
      const w = words[dayIndex(words.length)]
      this.wodLevel = level
      this.setData({ wod: { rank: w.rank, ms: w.ms, zh: w.zh, pos: w.pos, audio: w.audio, ex: '' } })
      try {
        const d = await vocab.word(w.rank)
        const s = (d.senses || []).find(x => x.exMs)
        if (s) this.setData({ 'wod.ex': s.exMs })
      } catch (e) { /* 例句是锦上添花 */ }
    } catch (e) { /* 今日一词失败就不显示 */ }
  },
  playWod() { const w = this.data.wod; if (w) audio.play(w.audio) },
  atlas() { wx.switchTab({ url: '/pages/atlas/atlas' }) },
  start() { wx.navigateTo({ url: '/pkg-word/learn/learn?mode=today' }) },
  // 测过的按推荐难度再推 10 个；没测过的照旧学当前站
  more() { const h = this.data.h; wx.navigateTo({ url: h.placement && h.placement.level ? '/pkg-word/learn/learn?mode=more' : `/pkg-word/learn/learn?mode=new&level=${h.level}` }) },
  onShareAppMessage() { return { title: '一起背马来语 5000 高频词', path: '/pages/home/home' } }
})
