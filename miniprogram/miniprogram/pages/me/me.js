// 护照:学生资料 + 10 站印章 + 学习统计(连续天数、近 30 天柱状、熟练度分布)+ 设置
const vocab = require('../../api/vocab')
const { ensureStudent } = require('../../utils/student')

const TRACK = { zero: '零基础', some: '会说一些' }
const GOALS = [10, 20, 30, 50]
const BOX_LABEL = ['生疏', '刚学', '有印象', '熟悉', '很熟', '快掌握', '已掌握']

Page({
  data: { view: 'loading', student: null, s: null, goals: GOALS },
  onShow() { this.load() },
  async onPullDownRefresh() { await this.load(); wx.stopPullDownRefresh() },
  async load() {
    try {
      const student = await ensureStudent()
      if (!student) return
      const [s, h] = await Promise.all([vocab.stats(), vocab.home()])
      const max = Math.max(1, ...s.days.map(d => d.new + d.review))
      const days = s.days.map(d => ({ ...d, hNew: d.new / max * 100, hRev: d.review / max * 100, label: d.day.slice(8) }))
      const total = s.boxes.reduce((a, b) => a + b, 0) || 1
      const boxes = s.boxes.map((n, i) => ({ n, label: BOX_LABEL[i], pct: n / total * 100 }))
      this.setData({ view: 'ok', student: h.student, track: TRACK[h.student.track] || '', s, days, boxes, total: h.total, stamps: s.levels.filter(l => l.stamped).length })
    } catch (e) { this.setData({ view: 'error', error: e.message }) }
  },
  goal() {
    wx.showActionSheet({
      itemList: GOALS.map(n => `每天 ${n} 个新词`),
      success: async r => {
        try {
          await vocab.settings(GOALS[r.tapIndex])
          getApp().globalData.dirty = true
          this.setData({ 'student.dailyNew': GOALS[r.tapIndex] })
          wx.showToast({ title: '已修改', icon: 'success' })
        } catch (e) { wx.showToast({ title: e.message, icon: 'none' }) }
      }
    })
  },
  go(e) { wx.navigateTo({ url: e.currentTarget.dataset.url }) },
  privacy() { wx.setClipboardData({ data: 'https://www.bahasa.cn/privacy/', success: () => wx.showToast({ title: '隐私说明链接已复制', icon: 'none' }) }) }
})
