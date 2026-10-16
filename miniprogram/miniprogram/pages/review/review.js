const store = require('../../utils/store')

Page({
  data: { queue: [], shown: false, total: 0, doneCount: 0 },
  onLoad() {
    const queue = store.dueWords()
    this.setData({ queue, total: queue.length })
  },
  reveal() {
    this.setData({ shown: true })
  },
  grade(e) {
    const g = Number(e.currentTarget.dataset.g)
    const [cur, ...rest] = this.data.queue
    store.gradeWord(cur.ms, g)
    // 忘了的词放到队尾,本轮再见一次
    const queue = g === 0 ? [...rest, cur] : rest
    this.setData({ queue, shown: false, doneCount: this.data.doneCount + (g === 0 ? 0 : 1) })
  },
  back() {
    wx.navigateBack()
  }
})
