// 背单词首页:今日进度 + 生活场景
const vocab = require('../../api/vocab')
const { ensureStudent } = require('../../utils/student')

const GOAL = 10 // 每天新学目标
const COVERS = { 'c-welcome': 'welcome', 'c-pass': 'pass', 'c-cheer': 'cheer', 'c-loading': 'loading', 'c-study': 'study', 'c-checkin': 'checkin', 'c-fail': 'fail' }
const HELLO = () => { const h = new Date().getHours(); return h < 11 ? 'Selamat pagi' : h < 15 ? 'Selamat tengah hari' : h < 19 ? 'Selamat petang' : 'Selamat malam' }

Page({
  data: { loading: true, error: false, student: null, ov: null, ring: 0, hello: '', next: null },

  async onShow() { this.load() },
  onPullDownRefresh() { this.load().then(() => wx.stopPullDownRefresh()) },

  async load() {
    try {
      const student = await ensureStudent()
      if (!student) return
      const ov = await vocab.overview()
      ov.scenes = ov.scenes.map(s => ({ ...s, img: COVERS[s.cover] ? `/assets/${COVERS[s.cover]}.jpg` : s.cover, pct: s.total ? Math.round((s.learned / s.total) * 100) : 0 }))
      const next = ov.scenes.find(s => s.learned < s.total) || null
      this.setData({ loading: false, error: false, student, ov, hello: HELLO(), ring: Math.min(100, Math.round((ov.learnedToday / GOAL) * 100)), goal: GOAL, next })
    } catch (e) {
      this.setData({ loading: false, error: true })
    }
  },

  review() { wx.navigateTo({ url: '/pkg-word/learn/learn?review=1' }) },
  cont() { if (this.data.next) wx.navigateTo({ url: `/pkg-word/learn/learn?scene=${this.data.next._id}` }) },
  open(e) { wx.navigateTo({ url: `/pkg-word/scene/scene?id=${e.currentTarget.dataset.id}` }) },
  about() { wx.navigateTo({ url: '/pkg-me/about/about' }) }
})
