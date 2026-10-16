// 错题本:待掌握 / 已掌握;重做一题,做对就移到已掌握
const { papers } = require('../../api/index')
const fmt = require('../../utils/format')

Page({
  data: { status: 'Pending', items: [], loading: true, error: false, redo: null, answer: {}, fb: null, busy: false },
  onLoad() { this.load() },

  setStatus(e) { this.setData({ status: e.currentTarget.dataset.s }); this.load() },

  async load() {
    this.setData({ loading: true, error: false })
    try {
      const r = await papers.wrongList(this.data.status, 1, 50)
      this.setData({ items: r.items.map(x => ({ ...x, typeLabel: fmt.QTYPE[x.type] })), loading: false })
    } catch (e) {
      this.setData({ loading: false, error: true })
    }
  },

  async open(e) {
    try {
      const d = await papers.wrongDetail(e.currentTarget.dataset.id)
      this.setData({ redo: d, answer: {}, fb: null })
    } catch (err) {
      wx.showToast({ title: err.message, icon: 'none' })
    }
  },
  close() { this.setData({ redo: null }); this.load() },
  onChange(e) { this.setData({ answer: e.detail.answer }) },

  async submit() {
    const { redo, answer } = this.data
    if (!Object.keys(answer).length) { wx.showToast({ title: '请先作答', icon: 'none' }); return }
    this.setData({ busy: true })
    try {
      const r = await papers.redo(redo.id, answer)
      const right = r.type === 'SingleChoice' ? (redo.options.find(o => o.id === r.correctOptionId) || {}).text
        : r.type === 'TrueFalse' ? (r.correctBoolean ? '正确' : '错误')
        : r.type === 'FillBlank' ? (r.acceptedAnswers || []).join('、')
        : (r.dictationAnswers || []).map(a => (Array.isArray(a) ? a[0] : a)).join(' / ')
      this.setData({ fb: { ok: r.isCorrect, explanation: r.explanation, right } })
    } catch (e) {
      wx.showToast({ title: e.message, icon: 'none' })
    } finally {
      this.setData({ busy: false })
    }
  }
})
