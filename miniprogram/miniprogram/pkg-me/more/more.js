// 设置与关于：外观（跟随手机 / 白天 / 夜晚）、每天新词（页内直接点，不弹系统菜单）、音效开关、修改资料，加上老师、客服、反馈、隐私
const vocab = require('../../api/vocab')
const sfx = require('../../utils/sfx')
const theme = require('../../utils/theme')

Page({
  data: { goals: [10, 20, 30, 50], dailyNew: 0, sfxOn: !sfx.off(), themes: [{ v: 'auto', t: '跟随手机' }, { v: 'day', t: '白天' }, { v: 'night', t: '夜晚' }], themeMode: theme.mode() },
  async onShow() {
    this.setData({ sfxOn: !sfx.off() })
    try { const h = await vocab.home(); this.setData({ dailyNew: h.student.dailyNew }) } catch (e) {}
  },
  async setGoal(e) {
    const n = e.currentTarget.dataset.n
    if (n === this.data.dailyNew) return
    const old = this.data.dailyNew
    this.setData({ dailyNew: n })
    try {
      await vocab.settings(n)
      getApp().globalData.dirty = true
      sfx.play('tap')
    } catch (err) { this.setData({ dailyNew: old }); wx.showToast({ title: err.message, icon: 'none' }) }
  },
  setTheme(e) {
    const v = e.currentTarget.dataset.v
    if (v === this.data.themeMode) return
    theme.set(v)
    this.setData({ themeMode: v })
    sfx.play('tap')
  },
  toggleSfx(e) { sfx.setOff(!e.detail.value); this.setData({ sfxOn: e.detail.value }); if (e.detail.value) sfx.play('correct') },
  go(e) { wx.navigateTo({ url: e.currentTarget.dataset.url }) }
})
