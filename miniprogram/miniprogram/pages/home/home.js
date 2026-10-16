// 学习 tab:今日复习、开始 / 继续学习、打卡日历、今日回顾
const { wordStudy } = require('../../api/index')
const { requireLogin, toastError } = require('../../utils/ui')
const fmt = require('../../utils/format')

const HELLO = () => {
  const h = new Date().getHours()
  if (h < 11) return 'Selamat pagi!'
  if (h < 15) return 'Selamat tengah hari!'
  if (h < 19) return 'Selamat petang!'
  return 'Selamat malam!'
}

Page({
  data: { loading: true, error: false, hello: '', learning: null, review: null, hasActive: false, allDone: false, cal: null, year: 0, month: 0, today: [], todayTotal: 0 },

  onShow() {
    if (!requireLogin()) return
    const d = new Date()
    if (!this.data.year) this.setData({ year: d.getFullYear(), month: d.getMonth() + 1 })
    this.load()
  },

  onPullDownRefresh() {
    this.load().then(() => wx.stopPullDownRefresh())
  },

  async load() {
    this.setData({ hello: HELLO(), error: false })
    try {
      const [learning, review, today] = await Promise.all([wordStudy.learningOverview(), wordStudy.reviewOverview(), wordStudy.today(1, 5)])
      this.setData({
        loading: false, learning, review,
        hasActive: !!(learning.activeSession || review.activeSession),
        allDone: !learning.activeSession && !review.activeSession && !review.dueCount && !learning.hasMoreWords,
        today: today.items.map(x => ({ ...x, first: fmt.senses(x.senses)[0] })),
        todayTotal: today.totalCount
      })
      this.loadCal()
    } catch (e) {
      this.setData({ loading: false, error: true })
    }
  },

  async loadCal() {
    try {
      const cal = await wordStudy.checkIns(this.data.year, this.data.month)
      this.setData({ cal, calDates: cal.checkedInDates.map(x => x.studyDateUtc.slice(0, 10)) })
    } catch (e) {
      toastError(e, '打卡日历加载失败，请重试。')
    }
  },

  changeMonth(e) {
    let { year, month } = this.data
    month += e.detail.delta
    if (month < 1) { month = 12; year-- }
    if (month > 12) { month = 1; year++ }
    this.setData({ year, month })
    this.loadCal()
  },

  study() {
    wx.navigateTo({ url: '/pkg-word/study/study' })
  }
})
