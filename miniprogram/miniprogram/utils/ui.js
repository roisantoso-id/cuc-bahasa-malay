// 页面通用:错误提示、登录检查。
const { auth } = require('../api/index')

function toastError(e, fallback = '加载失败，请重试。') {
  wx.showToast({ title: (e && e.message) || fallback, icon: 'none', duration: 2500 })
}

// tab 页 onShow 里调用:没登录就去登录页
function requireLogin() {
  if (auth.isLoggedIn()) return true
  wx.navigateTo({ url: '/pages/login/login' })
  return false
}

module.exports = { toastError, requireLogin }
