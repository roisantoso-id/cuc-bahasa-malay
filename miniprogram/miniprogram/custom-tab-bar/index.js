// 自定义底栏（app.json tabBar.custom = true）。每个 tab 页 onShow 时调 setTab(this, i) 标出当前项。
// 选中项显示该 tab 专属姿势的犀鸟：今日打卡、图鉴读书、对战举奖杯、护照欢呼；切换时安静换图，不做跳动
Component({
  data: {
    selected: 0,
    list: [
      { path: '/pages/home/home', text: '今日', icon: 'today', bird: 'checkin' },
      { path: '/pages/atlas/atlas', text: '图鉴', icon: 'atlas', bird: 'study' },
      { path: '/pages/battle/battle', text: '对战', icon: 'battle', bird: 'pass' },
      { path: '/pages/me/me', text: '护照', icon: 'passport', bird: 'cheer' }
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
      this.setData({ selected: i })
    }
  }
})
