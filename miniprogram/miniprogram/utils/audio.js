// 播放后端音频:地址 5 分钟过期,每次播放前现取。全局只用一个播放器。
const { content } = require('../api/index')

let ctx = null

async function play(audioResourceId) {
  if (!audioResourceId) return
  try {
    const { url } = await content.audioPlayback(audioResourceId)
    if (!url) {
      wx.showToast({ title: '演示数据没有录音', icon: 'none' })
      return
    }
    if (!ctx) ctx = wx.createInnerAudioContext({ useWebAudioImplement: false })
    ctx.stop()
    ctx.src = url
    ctx.play()
  } catch (e) {
    wx.showToast({ title: e.code === 'AudioNotReady' ? '音频暂时不可用，请稍后再试。' : '音频播放失败，请重试。', icon: 'none' })
  }
}

function stop() {
  if (ctx) ctx.stop()
}

module.exports = { play, stop }
