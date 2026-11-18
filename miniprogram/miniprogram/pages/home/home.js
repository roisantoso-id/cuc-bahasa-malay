const setTab = require('../../utils/tab')
// 今日：一个数字、一个按钮。圆环是今天的进度，犀鸟站在旁边陪着
const vocab = require('../../api/vocab')
const audio = require('../../utils/vocab-audio')
const { ensureStudent } = require('../../utils/student')
const { draw } = require('../../utils/canvas')

const bj = () => new Date(Date.now() + 8 * 3600e3)
const greet = () => { const h = bj().getUTCHours(); return h < 5 ? '夜深了' : h < 11 ? '早上好' : h < 14 ? '中午好' : h < 18 ? '下午好' : '晚上好' }
const dateText = () => { const d = bj(); return `${d.getUTCMonth() + 1}月${d.getUTCDate()}日` }
// 今日一词：按日期定一个，同一天不变
const dayIndex = n => Math.floor(bj().getTime() / 86400e3) % Math.max(1, n)

Page({
  data: { view: 'loading', h: null, error: '', greet: '', date: '', todo: 0, mins: 0, pct: 0, wod: null },
  onShow() {
    setTab(this, 0)
    if (getApp().globalData.dirty || !this.data.h) this.load()
  },
  onUnload() { audio.stop() },
  async onPullDownRefresh() { await this.load(); wx.stopPullDownRefresh() },
  async load() {
    try {
      const st = await ensureStudent()
      if (!st) return
      const h = await vocab.home()
      getApp().globalData.dirty = false
      const t = h.today
      const todo = t.due + t.newLeft
      const done = t.learned + t.reviewed
      const pct = done + todo ? Math.min(1, done / (done + todo)) : 1
      const cur = h.levels.find(l => l.level === h.level)
      this.setData({
        view: 'ok', h, cur, todo, pct,
        mins: Math.max(1, Math.round(todo * 0.25)),
        greet: greet(), date: dateText(),
        left: cur ? cur.total - cur.learned : 0
      }, () => { this.ring(); this.wordOfDay(h.level) })
    } catch (e) {
      this.setData({ view: 'error', error: e.message })
    }
  },
  ring() {
    const { pct } = this.data
    draw(this, '#ring', (ctx, w, hh) => {
      const cx = w / 2, cy = hh / 2, r = Math.min(w, hh) / 2 - 8
      ctx.lineWidth = 8
      ctx.lineCap = 'round'
      ctx.strokeStyle = 'rgba(243,234,214,0.12)'
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke()
      if (pct > 0) {
        ctx.strokeStyle = '#e9b961'
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
  more() { wx.navigateTo({ url: `/pkg-word/learn/learn?mode=new&level=${this.data.h.level}` }) },
  onShareAppMessage() { return { title: '一起背马来语 5000 高频词', path: '/pages/home/home' } }
})
