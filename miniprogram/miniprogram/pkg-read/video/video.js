// 视频详情:播放 HLS(m3u8),从上次位置继续,定时上报进度
const { content } = require('../../api/index')
const fmt = require('../../utils/format')

Page({
  data: { v: null, play: null, loading: true, error: '' },

  onLoad({ id }) { this.id = id; this.last = 0; this.lastAt = 0; this.load() },
  onHide() { this.report(true) },
  onUnload() { this.report(true) },

  async load() {
    this.setData({ loading: true, error: '' })
    try {
      const [v, play] = await Promise.all([content.video(this.id), content.videoPlayback(this.id)])
      wx.setNavigationBarTitle({ title: v.title })
      this.pos = play.positionSeconds || 0
      this.last = this.pos
      this.setData({ v: { ...v, date: fmt.date(v.publishedAt), dur: fmt.duration(v.durationSeconds) }, play, loading: false })
    } catch (e) {
      this.setData({ loading: false, error: e.status === 404 ? 'notfound' : 'error' })
    }
  },

  onTime(e) {
    this.pos = e.detail.currentTime
    this.report(false)
  },

  // 每 15 秒最多报一次,且位置变化不少于 5 秒;暂停、结束、离开时强制报
  report(force) {
    if (!this.data.v || this.pos === undefined) return
    const moved = Math.abs(this.pos - this.last) >= 5
    if (!force && (!moved || Date.now() - this.lastAt < 15000)) return
    if (force && Math.abs(this.pos - this.last) < 1) return
    this.last = this.pos
    this.lastAt = Date.now()
    content.saveVideoProgress(this.id, Math.min(this.pos, this.data.v.durationSeconds)).catch(() => {})
  },

  onPause() { this.report(true) },
  onEnded() { this.pos = this.data.v.durationSeconds; this.report(true) },
  onError() { this.setData({ error: 'play' }) },
  back() { wx.navigateBack() }
})
