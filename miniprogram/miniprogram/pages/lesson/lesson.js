const store = require('../../utils/store')

const shuffle = arr => arr.map(v => [Math.random(), v]).sort((a, b) => a[0] - b[0]).map(x => x[1])

// 用本课生词自动出题:一半看马来语选中文,一半看中文选马来语
function makeQuiz(words) {
  return shuffle(words).slice(0, 6).map((w, i) => {
    const toZh = i % 2 === 0
    const others = shuffle(words.filter(x => x.ms !== w.ms)).slice(0, 3)
    const options = shuffle([w, ...others]).map(x => (toZh ? x.zh : x.ms))
    return { prompt: toZh ? w.ms : w.zh, promptMs: toZh, answer: toZh ? w.zh : w.ms, options }
  })
}

Page({
  data: { lesson: null, tab: 0, quiz: [], qi: 0, picked: '', correct: 0, finished: false, score: 0 },
  onLoad({ id }) {
    const lesson = store.findLesson(id)
    if (!lesson) {
      wx.showToast({ title: '找不到这一课', icon: 'none' })
      return
    }
    wx.setNavigationBarTitle({ title: lesson.zh })
    this.setData({ lesson, quiz: makeQuiz(lesson.words) })
  },
  onUnload() {
    if (this.audio) this.audio.destroy()
  },
  setTab(e) {
    this.setData({ tab: Number(e.currentTarget.dataset.tab) })
  },
  play(e) {
    const src = e.currentTarget.dataset.audio
    if (!src) return
    if (!this.audio) this.audio = wx.createInnerAudioContext()
    this.audio.stop()
    this.audio.src = src
    this.audio.play()
  },
  pick(e) {
    if (this.data.picked) return
    const picked = e.currentTarget.dataset.opt
    const q = this.data.quiz[this.data.qi]
    this.setData({ picked, correct: this.data.correct + (picked === q.answer ? 1 : 0) })
  },
  nextQ() {
    const qi = this.data.qi + 1
    if (qi < this.data.quiz.length) {
      this.setData({ qi, picked: '' })
      return
    }
    const score = Math.round((this.data.correct / this.data.quiz.length) * 100)
    store.finishLesson(this.data.lesson.id, score)
    this.setData({ finished: true, score })
  },
  retry() {
    this.setData({ quiz: makeQuiz(this.data.lesson.words), qi: 0, picked: '', correct: 0, finished: false })
  },
  back() {
    wx.navigateBack()
  }
})
