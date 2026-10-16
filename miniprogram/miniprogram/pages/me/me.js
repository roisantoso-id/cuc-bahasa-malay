// 我的:资料、学习统计、收藏本、停止复习的词、错题本、设置、账户安全、退出
const { user, wordStudy, auth } = require('../../api/index')
const { requireLogin, toastError } = require('../../utils/ui')

Page({
  data: { me: null, learning: null, streak: 0 },

  onShow() {
    if (!requireLogin()) return
    Promise.all([user.me(), wordStudy.learningOverview(), wordStudy.checkIns(new Date().getFullYear(), new Date().getMonth() + 1)])
      .then(([me, learning, cal]) => this.setData({ me, learning, streak: cal.currentStreak }))
      .catch(e => toastError(e))
  },

  go(e) { wx.navigateTo({ url: e.currentTarget.dataset.url }) },

  logout() {
    wx.showModal({
      title: '退出登录',
      content: '确定要退出当前账号吗？',
      success: async r => {
        if (!r.confirm) return
        await auth.logout().catch(() => {})
        wx.showToast({ title: '已安全退出登录。', icon: 'none' })
        wx.navigateTo({ url: '/pages/login/login' })
      }
    })
  }
})
