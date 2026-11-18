// 界面音效（assets/sfx/*.mp3，用 ~/.claude/skills/app-motion/scripts/make-sounds.mjs 合成的「马来风」音效）
// 每个音效一个播放器，第一次用时创建，之后复用；和单词发音（utils/vocab-audio.js）互不打断。
// 「护照 → 音效」可以关掉（本地存 sfx_off）。
const ctxs = {}
const off = () => { try { return !!wx.getStorageSync('sfx_off') } catch (e) { return false } }
function play(name, volume = 0.8) {
  if (off()) return
  let c = ctxs[name]
  if (!c) {
    c = ctxs[name] = wx.createInnerAudioContext({ useWebAudioImplement: true })
    c.src = `/assets/sfx/${name}.mp3`
    c.onError(() => {})
  }
  c.volume = volume
  c.stop()
  c.seek(0)
  c.play()
}
const setOff = v => { try { wx.setStorageSync('sfx_off', v ? 1 : 0) } catch (e) {} }
module.exports = { play, off, setOff }
