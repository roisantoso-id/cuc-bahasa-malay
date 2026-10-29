// 我的:学习资料、学习统计、关于老师、反馈
const vocab = require('../../api/vocab')
const { ensureStudent } = require('../../utils/student')

const TRACK = { zero: '零基础', heritage: '会说一些' }

Page({
  data: { student: null, ov: null, track: '' },
  async onShow() {
    try {
      const student = await ensureStudent()
      if (!student) return
      const ov = await vocab.overview()
      this.setData({ student, ov, track: TRACK[student.track] || '' })
    } catch (e) {
      wx.showToast({ title: '加载失败，请重试', icon: 'none' })
    }
  },
  go(e) { wx.navigateTo({ url: e.currentTarget.dataset.url }) },
  privacy() { wx.setClipboardData({ data: 'https://www.bahasa.cn/privacy/', success: () => wx.showToast({ title: '隐私说明链接已复制', icon: 'none' }) }) }
})
