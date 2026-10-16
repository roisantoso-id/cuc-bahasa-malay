// 登录、注册、找回密码、退出。接口说明见 docs/JomBelajar功能清单.md。
const http = require('./request')
const session = require('./session')

async function login(email, password) {
  const res = await http.post('/auth/login', { email, password }, { auth: false, raw: true })
  session.save({ token: res.data.token, refreshToken: session.pickRefreshToken(res), user: res.data.user })
  return res.data.user
}

// 微信登录:后端还没有这个接口(需要新增 POST /auth/wechat,见 docs/JomBelajar功能清单.md 第六节)
async function wechatLogin() {
  const { code } = await new Promise((resolve, reject) => wx.login({ success: resolve, fail: reject }))
  const res = await http.post('/auth/wechat', { code }, { auth: false, raw: true })
  session.save({ token: res.data.token, refreshToken: res.data.refreshToken || session.pickRefreshToken(res), user: res.data.user })
  return res.data.user
}

async function logout() {
  try {
    await http.post('/auth/logout')
  } finally {
    session.clear()
  }
}

module.exports = {
  login,
  wechatLogin,
  logout,
  isLoggedIn: () => !!session.get().token,
  sendRegisterCode: email => http.post('/auth/register-token', { email }, { auth: false }),
  register: (email, password, verificationCode) => http.post('/auth/register', { email, password, verificationCode }, { auth: false }),
  sendForgotCode: email => http.post('/auth/forgot-password-token', { email }, { auth: false }),
  forgotPassword: (email, newPassword, verificationCode) => http.put('/auth/forgot-password', { email, newPassword, verificationCode }, { auth: false }),
  sendResetPasswordCode: () => http.post('/auth/reset-password-token'),
  sendChangeEmailCode: newEmail => http.post('/auth/change-email-token', { newEmail }),
  sendDeleteAccountCode: () => http.post('/auth/delete-account-token')
}
