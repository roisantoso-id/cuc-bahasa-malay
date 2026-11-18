// 隐私说明 + 删除我的资料（调 /api/app/delete-me）+ 客服
const vocab = require('../../api/vocab')

Page({
  data: { busy: false },
  del() {
    wx.showModal({
      title: '删除资料和学习记录', content: '会删除你的昵称、学校、手机号和全部学习记录、对战成绩，删除后无法恢复。', confirmText: '删除', confirmColor: '#e0614f',
      success: async r => {
        if (!r.confirm) return
        this.setData({ busy: true })
        try {
          await vocab.deleteMe()
          getApp().globalData.dirty = true
          wx.showToast({ title: '已删除', icon: 'success' })
          setTimeout(() => wx.reLaunch({ url: '/pages/home/home' }), 800)
        } catch (e) { wx.showToast({ title: e.message, icon: 'none' }) }
        this.setData({ busy: false })
      }
    })
  }
})
