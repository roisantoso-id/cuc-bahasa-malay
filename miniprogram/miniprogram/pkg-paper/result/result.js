// 测试结果:分数、是否通过、逐题对错和解析
const { papers } = require('../../api/index')
const fmt = require('../../utils/format')

const join = (list, sep) => (list && list.length ? list.join(sep) : '')

function userAnswer(q) {
  if (!q.isAnswered) return '未作答'
  if (q.type === 'SingleChoice') return (q.options.find(o => o.id === q.selectedOptionId) || {}).text || '未作答'
  if (q.type === 'TrueFalse') return q.booleanAnswer ? '正确' : '错误'
  if (q.type === 'FillBlank') return q.textAnswer || '未作答'
  return join(q.textAnswers, ' / ') || '未作答'
}

function rightAnswer(q) {
  if (q.type === 'SingleChoice') return (q.options.find(o => o.id === q.correctOptionId) || {}).text || ''
  if (q.type === 'TrueFalse') return q.correctBoolean ? '正确' : '错误'
  if (q.type === 'FillBlank') return join(q.acceptedAnswers, '、')
  return join((q.dictationAnswers || []).map(a => (Array.isArray(a) ? a[0] : a)), ' / ')
}

Page({
  data: { r: null, loading: true, error: false, busy: false },
  onLoad({ id }) { this.id = id; this.load() },
  async load() {
    this.setData({ loading: true, error: false })
    try {
      const r = await papers.result(this.id)
      r.questions = r.questions.sort((a, b) => a.sortOrder - b.sortOrder).map(q => ({ ...q, typeLabel: fmt.QTYPE[q.type], mine: userAnswer(q), right: rightAnswer(q) }))
      r.date = fmt.date(r.submittedAt)
      this.setData({ r, loading: false })
    } catch (e) {
      this.setData({ loading: false, error: true })
    }
  },
  backDetail() { wx.redirectTo({ url: `/pkg-paper/detail/detail?id=${this.data.r.paperId}` }) },
  async again() {
    this.setData({ busy: true })
    try {
      const at = await papers.start(this.data.r.paperId)
      wx.redirectTo({ url: `/pkg-paper/attempt/attempt?id=${at.id}` })
    } catch (e) {
      wx.showToast({ title: e.message, icon: 'none' })
      this.setData({ busy: false })
    }
  }
})
