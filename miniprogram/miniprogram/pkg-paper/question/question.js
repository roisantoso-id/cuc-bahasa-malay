// 一道题的作答区:单选 / 判断 / 填空 / 听写。答案改动时触发 change { answer, text }(text = 是否是打字类,需要防抖保存)
Component({
  properties: {
    q: Object,
    answer: { type: Object, value: {} },
    disabled: Boolean
  },
  methods: {
    pick(e) {
      if (this.data.disabled) return
      this.triggerEvent('change', { answer: { selectedOptionId: e.currentTarget.dataset.id }, text: false })
    },
    judge(e) {
      if (this.data.disabled) return
      this.triggerEvent('change', { answer: { booleanAnswer: e.currentTarget.dataset.v === '1' }, text: false })
    },
    fill(e) {
      this.triggerEvent('change', { answer: { textAnswer: e.detail.value }, text: true })
    },
    blank(e) {
      const i = Number(e.currentTarget.dataset.i)
      const list = (this.data.answer.textAnswers || this.data.q.dictationBlanks.map(() => '')).slice()
      list[i] = e.detail.value
      this.triggerEvent('change', { answer: { textAnswers: list }, text: true })
    },
    blur() { this.triggerEvent('blur') }
  }
})
