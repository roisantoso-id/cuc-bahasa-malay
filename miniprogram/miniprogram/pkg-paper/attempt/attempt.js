// 答题:逐题作答、自动保存(打字停 400ms 或离开输入框时保存)、题目目录、提交前确认
const { papers } = require('../../api/index')
const fmt = require('../../utils/format')

// 把答案转成接口要的形状;没作答返回 null(要删除)
function payload(q, a) {
  if (!a) return null
  if (q.type === 'SingleChoice') return a.selectedOptionId ? { selectedOptionId: a.selectedOptionId } : null
  if (q.type === 'TrueFalse') return typeof a.booleanAnswer === 'boolean' ? { booleanAnswer: a.booleanAnswer } : null
  if (q.type === 'FillBlank') return (a.textAnswer || '').trim() ? { textAnswer: a.textAnswer } : null
  const list = a.textAnswers || []
  return list.some(x => (x || '').trim()) ? { textAnswers: q.dictationBlanks.map((_, i) => list[i] || '') } : null
}

Page({
  data: { at: null, qs: [], qi: 0, answers: {}, states: {}, answered: 0, loading: true, error: false, dir: false, submitting: false },

  onLoad({ id }) { this.id = id; this.timers = {}; this.load() },
  onUnload() { Object.keys(this.timers).forEach(k => clearTimeout(this.timers[k])) },

  async load() {
    this.setData({ loading: true, error: false })
    try {
      const at = await papers.attempt(this.id)
      if (at.status === 'Submitted') { wx.redirectTo({ url: `/pkg-paper/result/result?id=${this.id}` }); return }
      const qs = at.questions.slice().sort((a, b) => a.sortOrder - b.sortOrder).map(q => ({ ...q, typeLabel: fmt.QTYPE[q.type] }))
      const answers = {}
      const states = {}
      qs.forEach(q => { answers[q.id] = q.savedAnswer || {}; states[q.id] = q.savedAnswer ? 'saved' : 'none' })
      wx.setNavigationBarTitle({ title: at.title })
      this.setData({ at, qs, answers, states, loading: false })
      this.count()
    } catch (e) {
      this.setData({ loading: false, error: true })
    }
  },

  count() {
    const { qs, answers } = this.data
    this.setData({ answered: qs.filter(q => payload(q, answers[q.id])).length })
  },

  onChange(e) {
    const q = this.data.qs[this.data.qi]
    this.setData({ [`answers.${q.id}`]: e.detail.answer, [`states.${q.id}`]: 'dirty' })
    this.count()
    clearTimeout(this.timers[q.id])
    if (e.detail.text) this.timers[q.id] = setTimeout(() => this.save(q), 400)
    else this.save(q)
  },

  onBlur() { const q = this.data.qs[this.data.qi]; if (this.data.states[q.id] === 'dirty') this.save(q) },

  async save(q) {
    clearTimeout(this.timers[q.id])
    const body = payload(q, this.data.answers[q.id])
    this.setData({ [`states.${q.id}`]: 'saving' })
    try {
      if (body) await papers.saveAnswer(this.id, q.id, body)
      else await papers.clearAnswer(this.id, q.id)
      this.setData({ [`states.${q.id}`]: body ? 'saved' : 'none' })
      return true
    } catch (e) {
      this.setData({ [`states.${q.id}`]: 'failed' })
      return false
    }
  },

  retry() { this.save(this.data.qs[this.data.qi]) },
  prev() { if (this.data.qi > 0) this.setData({ qi: this.data.qi - 1 }) },
  next() { if (this.data.qi < this.data.qs.length - 1) this.setData({ qi: this.data.qi + 1 }) },
  toggleDir() { this.setData({ dir: !this.data.dir }) },
  jump(e) { this.setData({ qi: Number(e.currentTarget.dataset.i), dir: false }) },

  submit() {
    const left = this.data.qs.length - this.data.answered
    wx.showModal({
      title: '确认提交试卷',
      content: left ? `还有 ${left} 题未作答，未作答题会按错误计分。确认现在提交吗？` : '提交后由系统自动判分。确认现在提交吗？',
      cancelText: '继续答题',
      confirmText: '确认提交',
      success: r => { if (r.confirm) this.doSubmit() }
    })
  },

  async doSubmit() {
    this.setData({ submitting: true })
    // 先把没保存的都保存掉;有失败的就跳到第一道失败的题
    const { qs, states } = this.data
    for (const q of qs) {
      if (states[q.id] === 'dirty' || states[q.id] === 'failed') {
        if (!(await this.save(q))) {
          this.setData({ submitting: false, qi: qs.indexOf(q) })
          wx.showToast({ title: '有答案保存失败，请重试保存后再提交', icon: 'none' })
          return
        }
      }
    }
    try {
      await papers.submit(this.id)
    } catch (e) {
      if (e.code !== 'PaperAttemptConcurrencyConflict') {
        this.setData({ submitting: false })
        wx.showToast({ title: e.message, icon: 'none' })
        return
      }
    }
    wx.redirectTo({ url: `/pkg-paper/result/result?id=${this.id}` })
  }
})
