// 单词发音:audio 可以是云存储 fileID、https 地址或包内路径
const vocab = require('../api/vocab')

let ctx = null
async function play(audio) {
  if (!audio) { wx.showToast({ title: '这个词还没有录音', icon: 'none' }); return }
  try {
    const src = await vocab.fileUrl(audio)
    if (!ctx) ctx = wx.createInnerAudioContext()
    ctx.stop()
    ctx.src = src
    ctx.play()
  } catch (e) {
    wx.showToast({ title: '音频播放失败', icon: 'none' })
  }
}
const stop = () => ctx && ctx.stop()
module.exports = { play, stop }
