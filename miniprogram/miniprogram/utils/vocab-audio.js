// 单词发音：音频在腾讯云 COS（服务端返回完整地址）。全局一个播放器。
// 直接播放地址失败时（个别机型、网络），先下载到本地临时文件再播；同一个词的本地文件记住，下次直接用。
let ctx = null, cur = '', retried = false
const local = {} // 远程地址 → 本地临时文件

function player() {
  if (ctx) return ctx
  if (wx.setInnerAudioOption) wx.setInnerAudioOption({ obeyMuteSwitch: false, mixWithOther: true })
  ctx = wx.createInnerAudioContext({ useWebAudioImplement: false })
  ctx.onError(err => {
    if (!retried && cur && !local[cur]) { retried = true; return viaDownload(cur) }
    console.warn('发音播放失败', cur, err)
    wx.showToast({ title: `发音播放失败（${err.errCode || err.errMsg || '未知'}）`, icon: 'none' })
  })
  return ctx
}
function viaDownload(src) {
  wx.downloadFile({
    url: src,
    success: r => {
      if (r.statusCode !== 200) return wx.showToast({ title: `发音下载失败（${r.statusCode}）`, icon: 'none' })
      local[src] = r.tempFilePath
      if (cur === src) { ctx.src = r.tempFilePath; ctx.play() }
    },
    fail: e => { console.warn('发音下载失败', src, e); wx.showToast({ title: '发音下载失败，检查一下网络', icon: 'none' }) }
  })
}
function play(src) {
  if (!src) { wx.showToast({ title: '这个词还没有录音', icon: 'none' }); return }
  const p = player()
  cur = src; retried = false
  p.stop()
  p.src = local[src] || src
  p.play()
}
const stop = () => ctx && ctx.stop()
module.exports = { play, stop }
