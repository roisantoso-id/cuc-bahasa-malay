// 自定义底栏（app.json tabBar.custom = true）。每个 tab 页 onShow 时调 setTab(this, i) 标出当前项
Component({
  data: {
    selected: 0, hop: false,
    list: [
      { path: '/pages/home/home', text: '今日', icon: 'today' },
      { path: '/pages/atlas/atlas', text: '图鉴', icon: 'atlas' },
      { path: '/pages/battle/battle', text: '对战', icon: 'battle' },
      { path: '/pages/me/me', text: '护照', icon: 'passport' }
    ]
  },
  methods: {
    go(e) {
      const i = e.currentTarget.dataset.i
      if (i === this.data.selected) return
      wx.vibrateShort && wx.vibrateShort({ type: 'light' })
      wx.switchTab({ url: this.data.list[i].path })
    },
    mark(i) {
      if (this.data.selected === i) return
      this.setData({ selected: i, hop: true })
      setTimeout(() => this.setData({ hop: false }), 520)
    }
  }
})
