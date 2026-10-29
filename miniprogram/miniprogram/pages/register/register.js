// 学生注册 / 修改资料
const vocab = require('../../api/vocab')

Page({
  data: { form: { name: '', school: '', className: '', track: 'zero', phone: '' }, agree: false, busy: false, error: '', edit: false },
  async onLoad(q) {
    const me = await vocab.login().catch(() => null)
    if (me && me.student) {
      const s = me.student
      this.setData({ edit: true, agree: true, form: { name: s.name, school: s.school, className: s.className, track: s.track, phone: s.phone } })
      wx.setNavigationBarTitle({ title: '修改资料' })
    }
  },
  input(e) { this.setData({ [`form.${e.currentTarget.dataset.k}`]: e.detail.value, error: '' }) },
  setTrack(e) { this.setData({ 'form.track': e.currentTarget.dataset.v }) },
  toggleAgree() { this.setData({ agree: !this.data.agree, error: '' }) },
  privacy() { wx.setClipboardData({ data: 'https://www.bahasa.cn/privacy/', success: () => wx.showToast({ title: '隐私说明链接已复制', icon: 'none' }) }) },
  async submit() {
    this.setData({ busy: true, error: '' })
    try {
      await vocab.register({ ...this.data.form, agree: this.data.agree })
      wx.showToast({ title: this.data.edit ? '已保存' : '注册成功', icon: 'success' })
      setTimeout(() => (this.data.edit ? wx.navigateBack() : wx.switchTab({ url: '/pages/home/home' })), 600)
    } catch (e) {
      this.setData({ error: e.message })
    } finally {
      this.setData({ busy: false })
    }
  }
})
