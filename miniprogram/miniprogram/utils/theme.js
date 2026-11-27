// 白天 / 夜晚两套颜色（2026-11-24）
//   夜晚 =「词光夜航」（深色，app.wxss 里 page {} 的默认值）
//   白天 =「旅行手账」（米白纸色底、深绿墨字、琥珀点缀，来自 design/mp-v2 方向 A）
// 学生在「设置与关于」里选：跟随手机（默认）/ 白天 / 夜晚，存在本机。
// 用法：app.js 包了一层 Page()，每页 data.th = { day, style, front, bg }；
//   每页 wxml 第一行 <page-meta page-style="{{th.style}}" … />；导航栏颜色用 wx.setNavigationBarColor（navigation-bar 组件会清掉标题）
//   page-style 把下面这些变量写到 page 上，盖掉 app.wxss 的夜晚默认值；组件和自定义底栏会继承。
const KEY = 'theme'

// 只列白天要改的变量；夜晚用 app.wxss 默认值（style 为空）
const DAY = {
  '--night': '#f4eee1',
  '--panel': '#fffdf8',
  '--panel2': '#efe6d3',
  '--ivory': '#fffdf8',
  '--star': '#c46d1c',
  '--ok': '#1f5a43',
  '--bad': '#b4472f',
  '--ink': '#1c2420',
  '--ink2': '#47524c',
  '--ink3': '#7d847e',
  '--hair': 'rgba(28,36,32,.1)',
  '--hair2': 'rgba(28,36,32,.2)',
  '--dark-ink': '#1c2420',
  '--dark-ink2': 'rgba(28,36,32,.62)',
  '--dark-hair': 'rgba(28,36,32,.14)',
  '--leaf': '#1f5a43',
  '--star-d': '#8a4a0f',
  '--bad-d': '#9a3a25',
  '--star-l': '#f5e2c7',
  '--ok-l': '#e3ece4',
  '--bad-l': 'rgba(180,71,47,.1)',
  // 两套都有、意思一样的角色（夜晚值见 app.wxss）
  '--strong': '#1c2420',          // 强调的字和描边
  '--raise': '#fffdf8',           // 浮起来的面：词卡、弹层、头像底
  '--raise-sh': '0 0 0 3rpx #1c2420, 8rpx 10rpx 0 #e6dcc6',   // 手账感：墨线框 + 错开的纸影
  '--btn': '#1f5a43',             // 主按钮、选中的胶囊
  '--on-btn': '#fffdf8',
  '--on-star': '#fffdf8',
  '--sheet': '#fffdf8',           // 底部弹层、预览弹窗
  '--scrim': 'rgba(28,36,32,.42)',
  '--wash': 'rgba(28,36,32,.05)', // 很淡的底（悬停、小圆按钮）
  '--inset': 'rgba(28,36,32,.05)',
  '--glow': 'transparent',
  '--star-line': 'rgba(196,109,28,.4)',
  '--heat1': 'rgba(31,90,67,.25)',
  '--heat2': 'rgba(31,90,67,.55)',
  '--fb-ok': '#e3ece4',
  '--fb-bad': '#f6e1da',
  '--tag-blue': '#2f6f95',
  '--tag-blue-l': 'rgba(47,111,149,.1)',
  '--bar': '#fffdf8',
  '--ms-style': 'normal',          // 马来语单词：白天手账用正体（夜晚斜体）
  '--ms-bold': '400'               // 大号单词字重：白天常规（夜晚 700）
}
const DAY_STYLE = Object.keys(DAY).map(k => `${k}:${DAY[k]}`).join(';')
const NIGHT_BG = '#0a1f22', DAY_BG = '#f4eee1'

let version = 0
const mode = () => { try { return wx.getStorageSync(KEY) || 'auto' } catch (e) { return 'auto' } }
let sys = 'dark'
try { sys = (wx.getAppBaseInfo ? wx.getAppBaseInfo() : wx.getSystemInfoSync()).theme || 'dark' } catch (e) {}
const isDay = () => { const m = mode(); return m === 'day' || (m === 'auto' && sys === 'light') }

function data() {
  const day = isDay()
  return { day, style: day ? DAY_STYLE : '', front: day ? '#000000' : '#ffffff', bg: day ? DAY_BG : NIGHT_BG }
}
// 换主题：存起来，刷新当前页和底栏；别的页面 onShow 时自己对版本号刷新
function set(m) {
  try { wx.setStorageSync(KEY, m) } catch (e) {}
  version++
  refreshCurrent()
}
function refreshCurrent() {
  const ps = getCurrentPages()
  const p = ps[ps.length - 1]
  if (p) apply(p)
}
function apply(page) {
  page._thv = version
  const th = data()
  page.setData({ th })
  wx.setNavigationBarColor({ frontColor: th.front, backgroundColor: th.bg, fail() {} })
  wx.setBackgroundColor && wx.setBackgroundColor({ backgroundColor: th.bg, backgroundColorTop: th.bg, backgroundColorBottom: th.bg })
  wx.setBackgroundTextStyle && wx.setBackgroundTextStyle({ textStyle: th.day ? 'dark' : 'light' })
  // 首页标题：白天叫「旅程」（手账稿），夜晚还是「今日」
  if (page.route === 'pages/home/home') wx.setNavigationBarTitle({ title: th.day ? '旅程' : '今日' })
  const bar = typeof page.getTabBar === 'function' && page.getTabBar()
  if (bar) bar.setData({ th })
  // 画在 canvas 上的东西（首页进度环、图鉴星空）要重画：页面写 onTheme() 就会被叫到
  const was = page._thDay
  page._thDay = th.day
  if (was !== undefined && was !== th.day && page.onTheme) page.onTheme(th)
}
// 手机切深浅色：只有「跟随手机」时跟着变
if (wx.onThemeChange) wx.onThemeChange(r => { sys = r.theme; version++; if (mode() === 'auto') refreshCurrent() })

// 包一层 Page()：每页带 th，onLoad / onShow 时对上当前主题
function wrapPage() {
  const raw = Page
  Page = function (o) {
    o.data = Object.assign({ th: data() }, o.data)
    const load = o.onLoad, show = o.onShow
    o.onLoad = function (q) { this._thv = version; return load && load.call(this, q) }
    // 每次 onShow 都对一下导航栏颜色（app.json 的颜色跟随手机，学生手动选了另一套时要盖掉）
    o.onShow = function () { apply(this); return show && show.call(this) }
    return raw(o)
  }
}

module.exports = { mode, set, data, isDay, wrapPage, DAY }
