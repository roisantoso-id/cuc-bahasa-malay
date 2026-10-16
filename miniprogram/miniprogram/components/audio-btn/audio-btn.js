// 发音按钮:点了才去取音频地址(5 分钟过期)
const audio = require('../../utils/audio')

Component({
  properties: {
    audioId: String,
    label: { type: String, value: '' }
  },
  methods: {
    tap() {
      audio.play(this.data.audioId)
    }
  }
})
