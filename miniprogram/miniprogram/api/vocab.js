// 背单词接口:调腾讯云上的背单词服务(admin/server.mjs 的 /api/app/*)。页面只调这里。
// 登录:wx.login 拿 code → 服务端换 openid → 返回 token,存在本地;token 失效自动重新登录一次。
const config = require('../config')

const TOKEN_KEY = 'vocab_token'
let me = null // { student }

function request(path, { method = 'GET', data, auth = true } = {}) {
  return new Promise((resolve, reject) => {
    wx.request({
      url: config.vocabApi.replace(/\/$/, '') + '/api/app' + path,
      method, data,
      timeout: 15000,
      header: auth ? { authorization: 'Bearer ' + (wx.getStorageSync(TOKEN_KEY) || '') } : {},
      success: r => (r.statusCode === 200 ? resolve(r.data) : reject(Object.assign(new Error((r.data && r.data.error) || `出错了(${r.statusCode})`), { status: r.statusCode }))),
      fail: () => reject(new Error('网络连不上，请稍后再试'))
    })
  })
}

async function login(force) {
  if (me && !force) return me
  const { code } = await new Promise((ok, no) => wx.login({ success: ok, fail: () => no(new Error('微信登录失败')) }))
  const r = await request('/login', { method: 'POST', data: { code }, auth: false })
  wx.setStorageSync(TOKEN_KEY, r.token)
  me = { student: r.student }
  return me
}

// 401 重新登录再试一次
async function call(path, opts) {
  if (!wx.getStorageSync(TOKEN_KEY)) await login(true)
  try { return await request(path, opts) } catch (e) {
    if (e.status !== 401) throw e
    await login(true)
    return request(path, opts)
  }
}
const post = (path, data) => call(path, { method: 'POST', data })
const qs = o => Object.keys(o).map(k => `${k}=${encodeURIComponent(o[k])}`).join('&')

module.exports = {
  login,
  async register(form) { const r = await post('/register', form); me = { ...(me || {}), student: r.student }; return r.student },
  home: () => call('/home'),
  start: (mode, level) => post('/start', { mode, level }),
  grade: (rank, result) => post('/grade', { rank, result }),
  fav: (rank, on) => post('/fav', { rank, on }),
  stop: level => call('/level?' + qs({ level })),
  word: rank => call('/word?' + qs({ rank })),
  search: q => call('/search?' + qs({ q })),
  book: (type, page = 0) => call('/book?' + qs({ type, page })),
  stats: () => call('/stats'),
  settings: dailyNew => post('/settings', { dailyNew }),
  teachers: () => call('/teachers'),
  // 后台上传的照片是 /uploads/… 相对地址
  fileUrl: p => (p && p[0] === '/' && !p.startsWith('/pkg-') ? config.vocabApi.replace(/\/$/, '') + p : p || '')
}
