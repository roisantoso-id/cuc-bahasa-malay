const store = require('../../utils/store')

Page({
  data: { courses: [], done: {} },
  onShow() {
    const track = store.getTrack()
    if (!track) {
      wx.navigateTo({ url: '/pages/welcome/welcome' })
      return
    }
    this.setData({ courses: store.coursesFor(track), done: store.getDone() })
  },
  open(e) {
    wx.navigateTo({ url: `/pages/lesson/lesson?id=${e.currentTarget.dataset.id}` })
  }
})
