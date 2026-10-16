// 一组单词学习:选组 → 记忆(打分)→ 小结 → 拼写(可跳过)→ 完成。新学和复习共用。
const { wordStudy, user } = require('../../api/index')
const fmt = require('../../utils/format')
const audio = require('../../utils/audio')

const RATINGS = ['Again', 'Hard', 'Good', 'Easy']

Page({
  data: { view: 'loading', mode: '', s: null, item: null, revealed: false, ratings: [], answer: '', outcome: null, busy: false, pct: 0 },

  onLoad() { this.choose() },
  onUnload() { audio.stop() },

  // 选组:进行中的组优先,其次到期复习,最后新词
  async choose() {
    this.setData({ view: 'loading' })
    try {
      const [learning, review] = await Promise.all([wordStudy.learningOverview(), wordStudy.reviewOverview()])
      const actives = [['review', review.activeSession], ['learning', learning.activeSession]].filter(x => x[1])
      actives.sort((a, b) => String(b[1].startedAt).localeCompare(String(a[1].startedAt)))
      let mode, s
      if (actives.length) [mode, s] = actives[0]
      else if (review.dueCount) { mode = 'review'; s = await wordStudy.start('review') }
      else if (learning.hasMoreWords) { mode = 'learning'; s = await wordStudy.start('learning') }
      else { this.setData({ view: 'empty' }); return }
      this.setData({ mode })
      this.apply(s)
    } catch (e) {
      if (e.status === 409) { this.setData({ view: 'empty' }); return }
      this.setData({ view: 'error' })
    }
  },

  apply(s) {
    const item = s.currentItem
    let view = 'mem'
    if (s.status === 'Completed') view = 'done'
    else if (s.phase === 'Summary') view = 'summary'
    else if (s.phase === 'Spelling') view = 'spell'
    else if (!item) view = 'nocard'
    const valid = s.actualCount - s.excludedCount - s.skippedCount
    const passed = s.phase === 'Spelling' ? s.spellingPassedCount : s.memorizationPassedCount
    const data = { s, view, revealed: false, answer: '', outcome: null, pct: valid ? Math.round((passed / valid) * 100) : 0, passed, valid }
    if (item) {
      const m = item.memorization || {}
      data.item = { ...item, senses: fmt.senses((m.senses || (item.spelling && item.spelling.senses)) || []) }
      const pv = m.ratingPreviews || []
      data.ratings = RATINGS.map(r => ({ key: r, label: fmt.RATING[r], hint: fmt.interval((pv.find(p => p.rating === r) || {}).intervalSeconds) }))
    }
    this.setData(data)
    wx.setNavigationBarTitle({ title: this.data.mode === 'review' ? '单词复习' : '学习新词' })
  },

  // 命令失败:提示并重新同步当前状态
  async run(fn, failMsg = '学习进度保存失败，已重新同步当前状态。') {
    if (this.data.busy) return null
    this.setData({ busy: true })
    try {
      return await fn()
    } catch (e) {
      wx.showToast({ title: failMsg, icon: 'none' })
      try { this.apply(await wordStudy.get(this.data.mode, this.data.s.id)) } catch (_) { this.setData({ view: 'error' }) }
      return null
    } finally {
      this.setData({ busy: false })
    }
  },

  reveal() { this.setData({ revealed: true }) },
  playWord() { audio.play(this.data.item.memorization && this.data.item.memorization.audioResourceId) },

  async rate(e) {
    const { mode, s, item } = this.data
    const res = await this.run(() => wordStudy.rate(mode, s.id, item, e.currentTarget.dataset.r))
    if (res) this.apply(res.session)
  },

  exclude() {
    wx.showModal({
      title: '停止复习这个单词？',
      content: '确认后，这个单词将从复习队列移除，可以在「我的 › 已停止复习的词」里恢复。',
      confirmText: '确认停止',
      success: async r => {
        if (!r.confirm) return
        const res = await this.run(() => wordStudy.exclude(this.data.s.id, this.data.item))
        if (res) this.apply(res.session)
      }
    })
  },

  async toggleFav() {
    const { item } = this.data
    try {
      if (item.isFavorite) await user.removeFavorite(item.wordId)
      else await user.addFavorite(item.wordId)
      this.setData({ 'item.isFavorite': !item.isFavorite })
    } catch (e) {
      wx.showToast({ title: e.message, icon: 'none' })
    }
  },

  async summary(e) {
    const skip = e.currentTarget.dataset.skip === '1'
    const s = await this.run(() => wordStudy.summary(this.data.mode, this.data.s.id, skip))
    if (s) this.apply(s)
  },

  onAnswer(e) { this.setData({ answer: e.detail.value }) },

  async spell() {
    const { mode, s, item, answer } = this.data
    const skip = !answer.trim()
    const res = await this.run(() => wordStudy.spell(mode, s.id, item, answer.trim(), skip), '拼写结果保存失败，已重新同步当前状态。')
    if (!res) return
    this.pending = res.session
    this.setData({ outcome: skip ? { result: 'Skipped' } : res.spellingOutcome, last: res.session.status === 'Completed' })
  },

  next() {
    if (this.pending) this.apply(this.pending)
    this.pending = null
  },

  async refresh() {
    const s = await this.run(() => wordStudy.get(this.data.mode, this.data.s.id))
    if (s) this.apply(s)
  },

  again() { this.choose() },
  back() { wx.navigateBack() }
})
