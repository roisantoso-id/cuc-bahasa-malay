// 单词学习设置:每组新词数 1–100、每组复习数 1–200、目标记忆保持率 70–97%
const { user } = require('../../api/index')

Page({
  data: { s: null, retention: 90, busy: false },
  async onLoad() {
    try {
      const s = await user.getStudySettings()
      this.setData({ s, retention: Math.round(s.desiredRetention * 100) })
    } catch (e) {
      wx.showToast({ title: e.message, icon: 'none' })
    }
  },
  onStudy(e) { this.setData({ 's.dailyWordStudyCount': e.detail.value }) },
  onReview(e) { this.setData({ 's.dailyWordReviewCount': e.detail.value }) },
  onRetention(e) { this.setData({ retention: e.detail.value }) },
  async save() {
    this.setData({ busy: true })
    try {
      await user.saveStudySettings({ ...this.data.s, desiredRetention: this.data.retention / 100 })
      wx.showToast({ title: '设置已保存', icon: 'success' })
    } catch (e) {
      wx.showToast({ title: e.message, icon: 'none' })
    } finally {
      this.setData({ busy: false })
    }
  }
})
