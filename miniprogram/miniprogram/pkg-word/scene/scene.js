// 场景详情:词表预览 + 开始学习
const vocab = require('../../api/vocab')
const audio = require('../../utils/vocab-audio')

Page({
  data: { loading: true, error: '', scene: null, words: [], draft: false, left: 0 },
  onLoad({ id }) { this.id = id },
  onShow() { this.load() },
  onUnload() { audio.stop() },
  async load() {
    try {
      const r = await vocab.sceneWords(this.id)
      wx.setNavigationBarTitle({ title: r.scene.name })
      this.setData({ loading: false, scene: r.scene, words: r.words, draft: r.draft, left: r.words.filter(w => !w.learned).length })
    } catch (e) {
      this.setData({ loading: false, error: e.message })
    }
  },
  play(e) { audio.play(e.currentTarget.dataset.a) },
  start() { wx.navigateTo({ url: `/pkg-word/learn/learn?scene=${this.id}` }) }
})
