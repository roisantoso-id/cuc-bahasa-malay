// 发音按钮:src 是完整音频地址(COS)
const audio = require('../../utils/vocab-audio')
Component({
  properties: { src: String, size: { type: String, value: 'md' } },
  methods: { tap() { audio.play(this.data.src) } }
})
