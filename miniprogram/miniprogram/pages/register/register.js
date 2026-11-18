// 学生注册 / 修改资料
const vocab = require('../../api/vocab')

Page({
  data: { form: { name: '', school: '', className: '', track: 'zero', phone: '' }, agree: false, busy: false, error: '', edit: false },
  async onLoad(q) {
    // 现在只用来完善 / 修改资料（打开小程序已自动登录），全部选填
    const me = await vocab.login().catch(() => null)
    const s = (me && me.student) || {}
    const filled = !!(s.name || s.school || s.phone)
    this.setData({ edit: true, agree: filled, form: { name: s.name || '', school: s.school || '', className: s.className || '', track: s.track || 'zero', phone: s.phone || '' } })
    wx.setNavigationBarTitle({ title: filled ? '修改资料' : '完善资料' })
  },
  input(e) { this.setData({ [`form.${e.currentTarget.dataset.k}`]: e.detail.value, error: '' }) },
  setTrack(e) { this.setData({ 'form.track': e.currentTarget.dataset.v }) },
  toggleAgree() { this.setData({ agree: !this.data.agree, error: '' }) },
  privacy() { wx.setClipboardData({ data: 'https://www.bahasa.cn/privacy/', success: () => wx.showToast({ title: '隐私说明链接已复制', icon: 'none' }) }) },
  async submit() {
    this.setData({ busy: true, error: '' })
    try {
      await vocab.register({ ...this.data.form, agree: this.data.agree })
      getApp().globalData.dirty = true
      wx.showToast({ title: '已保存', icon: 'success' })
      setTimeout(() => wx.navigateBack(), 600)
    } catch (e) {
      this.setData({ error: e.message })
    } finally {
      this.setData({ busy: false })
    }
  }
})
