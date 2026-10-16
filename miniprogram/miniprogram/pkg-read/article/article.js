// 文章详情:HTML 正文 + 朗读播放条
const { content } = require('../../api/index')
const fmt = require('../../utils/format')

// rich-text 不认外部样式,给图片和段落补上行内样式
const prepare = html => String(html || '')
  .replace(/<img /g, '<img style="max-width:100%;height:auto;border-radius:12px;" ')
  .replace(/<p>/g, '<p style="margin:0 0 12px;">')
  .replace(/<h2>/g, '<h2 style="font-size:20px;margin:20px 0 8px;">')

Page({
  data: { a: null, html: '', loading: true, error: '', playing: false, pos: 0, dur: 0, posText: '0:00', durText: '0:00' },

  onLoad({ id }) { this.id = id; this.load() },
  onUnload() { if (this.ctx) this.ctx.destroy() },

  async load() {
    this.setData({ loading: true, error: '' })
    try {
      const a = await content.article(this.id)
      wx.setNavigationBarTitle({ title: a.title })
      this.setData({ a: { ...a, date: fmt.date(a.publishedAt), updated: fmt.date(a.updatedAt) }, html: prepare(a.contentHtml), loading: false })
    } catch (e) {
      this.setData({ loading: false, error: e.status === 404 ? 'notfound' : 'error' })
    }
  },

  // 朗读:第一次播放时才取地址;地址 5 分钟过期,出错时重取
  async ensure() {
    if (this.ctx && this.src && Date.now() - this.srcAt < 4 * 60 * 1000) return true
    const { url, durationSeconds } = await content.audioPlayback(this.data.a.readingAudioResourceId)
    if (!url) { wx.showToast({ title: '演示数据没有录音', icon: 'none' }); return false }
    if (!this.ctx) {
      this.ctx = wx.createInnerAudioContext()
      this.ctx.onTimeUpdate(() => this.setData({ pos: this.ctx.currentTime, dur: this.ctx.duration || this.data.dur, posText: fmt.duration(this.ctx.currentTime), durText: fmt.duration(this.ctx.duration || this.data.dur) }))
      this.ctx.onEnded(() => this.setData({ playing: false }))
      this.ctx.onError(() => { this.src = ''; this.setData({ playing: false }); wx.showToast({ title: '音频播放失败，请重试。', icon: 'none' }) })
    }
    const at = this.ctx.currentTime
    this.src = url
    this.srcAt = Date.now()
    this.ctx.src = url
    if (at) this.ctx.seek(at)
    this.setData({ dur: durationSeconds, durText: fmt.duration(durationSeconds) })
    return true
  },

  async toggle() {
    if (this.data.playing) { this.ctx.pause(); this.setData({ playing: false }); return }
    try {
      if (!(await this.ensure())) return
      this.ctx.play()
      this.setData({ playing: true })
    } catch (e) {
      wx.showToast({ title: e.code === 'AudioNotReady' ? '音频暂时不可用，请稍后再试。' : '音频播放失败，请重试。', icon: 'none' })
    }
  },

  seek(e) { if (this.ctx) this.ctx.seek(e.detail.value) },
  back() { wx.navigateBack() }
})
