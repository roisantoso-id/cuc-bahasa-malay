const store = require('../../utils/store')

Page({
  data: { next: null, due: 0, stats: {} },
  onShow() {
    const track = store.getTrack()
    if (!track) {
      wx.navigateTo({ url: '/pages/welcome/welcome' })
      return
    }
    this.setData({ next: store.nextLesson(track), due: store.dueWords().length, stats: store.stats() })
  },
  openLesson() {
    wx.navigateTo({ url: `/pages/lesson/lesson?id=${this.data.next.id}` })
  },
  openReview() {
    wx.navigateTo({ url: '/pages/review/review' })
  }
})
