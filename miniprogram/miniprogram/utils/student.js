// 学生身份:微信登录(云函数 login),没注册就去注册页
const vocab = require('../api/vocab')

async function ensureStudent() {
  const me = await vocab.login()
  if (!me.student) {
    wx.navigateTo({ url: '/pages/register/register' })
    return null
  }
  return me.student
}
module.exports = { ensureStudent }
