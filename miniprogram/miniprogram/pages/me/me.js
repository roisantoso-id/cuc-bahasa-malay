const store = require('../../utils/store')

const TRACKS = { zero: '零基础', heritage: '会说一些' }

Page({
  data: { stats: {}, trackName: '' },
  onShow() {
    this.setData({ stats: store.stats(), trackName: TRACKS[store.getTrack()] || '未选择' })
  },
  changeTrack() {
    wx.navigateTo({ url: '/pages/welcome/welcome' })
  }
})
