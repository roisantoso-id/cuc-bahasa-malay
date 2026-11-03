// 单词发音:音频在腾讯云 COS(服务端返回完整地址)
let ctx = null
function play(src) {
  if (!src) { wx.showToast({ title: '这个词还没有录音', icon: 'none' }); return }
  if (!ctx) {
    ctx = wx.createInnerAudioContext({ useWebAudioImplement: false })
    ctx.obeyMuteSwitch = false
    ctx.onError(() => wx.showToast({ title: '音频播放失败', icon: 'none' }))
  }
  ctx.stop()
  ctx.src = src
  ctx.play()
}
const stop = () => ctx && ctx.stop()
module.exports = { play, stop }
