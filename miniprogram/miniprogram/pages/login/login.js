// 登录 / 注册 / 忘记密码。现在用邮箱;后端支持微信登录后打开 config.wechatLogin。
const { auth } = require('../../api/index')
const config = require('../../config')

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

Page({
  data: { mode: 'login', email: '', password: '', password2: '', code: '', wait: 0, busy: false, error: '', notice: '', wechat: config.wechatLogin, mock: config.useMock },

  onUnload() { clearInterval(this.timer) },

  setMode(e) { this.setData({ mode: e.currentTarget.dataset.mode, error: '', notice: '' }) },
  input(e) { this.setData({ [e.currentTarget.dataset.k]: e.detail.value.trim(), error: '' }) },

  validate(needCode) {
    const { email, password, password2, code, mode } = this.data
    if (!email) return '请输入邮箱。'
    if (!EMAIL.test(email)) return '请输入有效的邮箱地址。'
    if (needCode && !code) return '请输入验证码。'
    if (needCode && !/^\d{6}$/.test(code)) return '验证码必须是 6 位数字。'
    if (password.length < 8) return '密码至少需要 8 个字符。'
    if (mode !== 'login' && password !== password2) return '两次输入的密码不一致。'
    return ''
  },

  async sendCode() {
    const { email, mode, wait } = this.data
    if (wait) return
    if (!EMAIL.test(email)) { this.setData({ error: '请输入有效的邮箱地址。' }); return }
    try {
      if (mode === 'register') await auth.sendRegisterCode(email)
      else await auth.sendForgotCode(email)
      this.setData({ notice: mode === 'register' ? '验证码已发送，请检查邮箱。' : '若该邮箱已注册，验证码将发送至该邮箱。', wait: 60 })
      this.timer = setInterval(() => {
        const w = this.data.wait - 1
        this.setData({ wait: w })
        if (w <= 0) clearInterval(this.timer)
      }, 1000)
    } catch (e) {
      this.setData({ error: e.message })
    }
  },

  async wechatLogin() {
    this.setData({ busy: true, error: '' })
    try {
      await auth.wechatLogin()
      wx.switchTab({ url: '/pages/home/home' })
    } catch (e) {
      this.setData({ error: e.message || '微信登录失败，请稍后重试。' })
    } finally {
      this.setData({ busy: false })
    }
  },

  async submit() {
    const { mode, email, password, code } = this.data
    const err = this.validate(mode !== 'login')
    if (err) { this.setData({ error: err }); return }
    this.setData({ busy: true, error: '' })
    try {
      if (mode === 'login') {
        await auth.login(email, password)
        wx.switchTab({ url: '/pages/home/home' })
        return
      }
      if (mode === 'register') await auth.register(email, password, code)
      else await auth.forgotPassword(email, password, code)
      this.setData({ mode: 'login', code: '', password2: '', notice: mode === 'register' ? '注册成功，请使用新账户登录。' : '密码已重置，请使用新密码登录。' })
    } catch (e) {
      this.setData({ error: e.message || '登录失败，请稍后重试。' })
    } finally {
      this.setData({ busy: false })
    }
  }
})
