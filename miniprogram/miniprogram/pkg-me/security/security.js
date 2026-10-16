// 账户安全:修改邮箱、重置密码、删除账号,都要邮箱验证码
const { user, auth } = require('../../api/index')

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

Page({
  data: { email: '', tab: 'email', newEmail: '', code: '', pwd: '', pwd2: '', wait: 0, busy: false, error: '' },
  async onLoad() {
    try { this.setData({ email: (await user.me()).email }) } catch (e) { /* 不影响操作 */ }
  },
  onUnload() { clearInterval(this.timer) },
  setTab(e) { this.setData({ tab: e.currentTarget.dataset.t, code: '', error: '' }) },
  input(e) { this.setData({ [e.currentTarget.dataset.k]: e.detail.value.trim(), error: '' }) },

  async sendCode() {
    const { tab, newEmail, email, wait } = this.data
    if (wait) return
    try {
      if (tab === 'email') {
        if (!EMAIL.test(newEmail)) { this.setData({ error: '请输入有效的邮箱地址。' }); return }
        if (newEmail === email) { this.setData({ error: '新邮箱不能与当前邮箱相同。' }); return }
        await auth.sendChangeEmailCode(newEmail)
      } else if (tab === 'password') await auth.sendResetPasswordCode()
      else await auth.sendDeleteAccountCode()
      wx.showToast({ title: '验证码已发送，请检查邮箱。', icon: 'none' })
      this.setData({ wait: 60 })
      this.timer = setInterval(() => { const w = this.data.wait - 1; this.setData({ wait: w }); if (w <= 0) clearInterval(this.timer) }, 1000)
    } catch (e) {
      this.setData({ error: e.message })
    }
  },

  async submit() {
    const { tab, newEmail, code, pwd, pwd2 } = this.data
    if (!/^\d{6}$/.test(code)) { this.setData({ error: '验证码必须是 6 位数字。' }); return }
    if (tab === 'password' && pwd.length < 8) { this.setData({ error: '密码至少需要 8 个字符。' }); return }
    if (tab === 'password' && pwd !== pwd2) { this.setData({ error: '两次输入的密码不一致。' }); return }
    if (tab === 'delete') {
      const r = await new Promise(resolve => wx.showModal({ title: '永久删除账号', content: '删除后账号资料将被匿名化，所有设备会立即退出，且无法自行恢复。', confirmText: '永久删除', confirmColor: '#ff6b5a', success: resolve }))
      if (!r.confirm) return
    }
    this.setData({ busy: true, error: '' })
    try {
      if (tab === 'email') await user.changeEmail(newEmail, code)
      else if (tab === 'password') await user.resetPassword(pwd, code)
      else await user.deleteAccount(code)
      // 三种操作成功后都要重新登录
      await auth.logout().catch(() => {})
      wx.showToast({ title: tab === 'delete' ? '账号已删除' : '修改成功，请重新登录。', icon: 'none' })
      setTimeout(() => wx.reLaunch({ url: '/pages/login/login' }), 900)
    } catch (e) {
      this.setData({ error: e.message })
    } finally {
      this.setData({ busy: false })
    }
  }
})
