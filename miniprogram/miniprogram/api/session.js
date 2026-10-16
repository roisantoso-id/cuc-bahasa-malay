// 登录状态:访问令牌(15 分钟)和刷新令牌(7 天)存在本地。
const KEY = 'session'

function get() {
  return wx.getStorageSync(KEY) || {}
}

function save(patch) {
  const s = Object.assign(get(), patch)
  wx.setStorageSync(KEY, s)
  return s
}

function clear() {
  wx.removeStorageSync(KEY)
}

// 后端只通过 httpOnly cookie 下发刷新令牌:从响应头 Set-Cookie 里取出 tiny-lang.refresh
function pickRefreshToken(res) {
  const list = []
  if (res.cookies) list.push(...res.cookies)
  const h = res.header || {}
  const raw = h['Set-Cookie'] || h['set-cookie']
  if (raw) list.push(...(Array.isArray(raw) ? raw : String(raw).split(/,(?=\s*[\w.-]+=)/)))
  for (const c of list) {
    const m = /tiny-lang\.refresh=([^;]+)/.exec(c)
    if (m) return m[1]
  }
  return ''
}

module.exports = { get, save, clear, pickRefreshToken }
