// 所有接口请求都走这里:带令牌、401 自动刷新一次、统一错误格式。
const config = require('../config')
const session = require('./session')
const mock = require('./mock/index')

class ApiError extends Error {
  constructor(status, code, message, fieldErrors) {
    super(message)
    this.status = status
    this.code = code
    this.fieldErrors = fieldErrors || {}
  }
}

// 后端有三种错误格式:ProblemDetails / 限流 {code,message,retryAfter} / 令牌失效时空 body
function toError(res) {
  const d = res.data || {}
  if (res.statusCode === 429) return new ApiError(429, 'TooManyRequests', d.message || '请求过于频繁，请稍后再试')
  if (res.statusCode === 401 && !d.errorCode) return new ApiError(401, 'Unauthorized', '登录已过期，请重新登录')
  return new ApiError(res.statusCode, d.errorCode || 'Unknown', d.detail || d.title || '请求失败，请稍后重试', d.errors)
}

function send({ method, path, data, token, cookie }) {
  if (config.useMock) return mock.handle(method, path, data)
  const header = { 'Content-Type': 'application/json' }
  if (token) header.Authorization = `Bearer ${token}`
  if (cookie) header.Cookie = cookie
  return new Promise((resolve, reject) => {
    wx.request({
      url: config.apiBase + path,
      method,
      data,
      header,
      timeout: 15000,
      success: resolve,
      fail: err => reject(new ApiError(0, 'Network', '网络连接失败，请检查网络后重试'))
    })
  })
}

let refreshing = null

// 用刷新令牌换新的访问令牌;同一时间只发一个刷新请求
function refresh() {
  if (refreshing) return refreshing
  const { refreshToken } = session.get()
  if (!refreshToken) return Promise.reject(new ApiError(401, 'Unauthorized', '请先登录'))
  refreshing = send({ method: 'POST', path: '/auth/refresh', cookie: `tiny-lang.refresh=${refreshToken}` })
    .then(res => {
      if (res.statusCode !== 200) throw toError(res)
      session.save({ token: res.data.token, refreshToken: session.pickRefreshToken(res) || refreshToken, user: res.data.user })
      return res.data.token
    })
    .finally(() => { refreshing = null })
  return refreshing
}

function goLogin() {
  session.clear()
  const pages = getCurrentPages()
  const cur = pages[pages.length - 1]
  if (cur && cur.route !== 'pages/login/login') wx.navigateTo({ url: '/pages/login/login' })
}

async function request(method, path, data, opts = {}) {
  const auth = opts.auth !== false
  let res = await send({ method, path, data, token: auth ? session.get().token : '' })
  if (res.statusCode === 401 && auth) {
    try {
      res = await send({ method, path, data, token: await refresh() })
    } catch (e) {
      goLogin()
      throw e
    }
  }
  if (res.statusCode >= 200 && res.statusCode < 300) return opts.raw ? res : res.data
  if (res.statusCode === 401 && auth) goLogin()
  throw toError(res)
}

// 拼查询串,跳过空值
function qs(params = {}) {
  const parts = Object.keys(params)
    .filter(k => params[k] !== undefined && params[k] !== null && params[k] !== '')
    .map(k => `${encodeURIComponent(k)}=${encodeURIComponent(params[k])}`)
  return parts.length ? `?${parts.join('&')}` : ''
}

module.exports = {
  ApiError,
  qs,
  get: (path, opts) => request('GET', path, undefined, opts),
  post: (path, data, opts) => request('POST', path, data, opts),
  put: (path, data, opts) => request('PUT', path, data, opts),
  del: (path, data, opts) => request('DELETE', path, data, opts)
}
