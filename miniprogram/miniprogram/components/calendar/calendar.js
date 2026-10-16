// 打卡月历:周一开头,打过卡的日子高亮
Component({
  properties: {
    year: Number,
    month: Number, // 1–12
    dates: { type: Array, value: [] } // ['2026-10-16', ...]
  },
  observers: {
    'year, month, dates': function (year, month, dates) {
      if (!year || !month) return
      const first = new Date(year, month - 1, 1)
      const lead = (first.getDay() + 6) % 7 // 周一 = 0
      const days = new Date(year, month, 0).getDate()
      const set = new Set(dates)
      const t = new Date()
      const today = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`
      const cells = []
      for (let i = 0; i < lead; i++) cells.push({ key: `b${i}` })
      for (let d = 1; d <= days; d++) {
        const key = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`
        cells.push({ key, d, on: set.has(key), today: key === today })
      }
      this.setData({ cells })
    }
  },
  data: { cells: [], week: ['一', '二', '三', '四', '五', '六', '日'] },
  methods: {
    prev() { this.triggerEvent('change', { delta: -1 }) },
    next() { this.triggerEvent('change', { delta: 1 }) }
  }
})
