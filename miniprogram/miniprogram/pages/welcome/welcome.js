const store = require('../../utils/store')

Page({
  choose(e) {
    store.setTrack(e.currentTarget.dataset.track)
    wx.switchTab({ url: '/pages/index/index' })
  }
})
