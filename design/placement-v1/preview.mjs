// 入门测评三屏的浏览器预览：把小程序真实的 WXSS（app.wxss + placement.wxss + 主题变量）换算成 CSS（1rpx = 0.5px），
// 配上和 placement.wxml 同结构的示例 HTML，夜晚 / 白天各一排。node design/placement-v1/preview.mjs → preview.html
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
const here = dirname(fileURLToPath(import.meta.url))
const MP = join(here, '../../miniprogram/miniprogram')
const VH = 7.24 // 375×724 的内容区（去掉导航栏）
const units = css => css
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/(-?\d*\.?\d+)rpx/g, (_, n) => +(n / 2).toFixed(2) + 'px')
  .replace(/(-?\d*\.?\d+)vh/g, (_, n) => +(n * VH).toFixed(1) + 'px')
  .replace(/env\(safe-area-inset-bottom\)/g, '0px')
  .replace(/(^|[\s,}])image(\s*[{,.:])/g, '$1img$2')
const app = units(readFileSync(join(MP, 'app.wxss'), 'utf8')).replace(/(^|\n)page\s*\{/, '$1.phone {')
const pt = units(readFileSync(join(MP, 'pkg-word/placement/placement.wxss'), 'utf8')) + units(readFileSync(join(MP, 'components/say-btn/say-btn.wxss'), 'utf8'))
const theme = readFileSync(join(MP, 'utils/theme.js'), 'utf8')
const DAY = Object.fromEntries([...theme.matchAll(/'(--[\w-]+)':\s*'([^']+)'/g)].map(m => [m[1], m[2]]))
const dayVars = Object.entries(DAY).map(([k, v]) => `${k}:${v}`).join(';')
// 图片直接内嵌（内置浏览器把本地页面当静态快照打开，相对路径的图读不到）
const IMGDIR = join(MP, 'pkg-word/placement/img/')
const img = n => 'data:image/webp;base64,' + readFileSync(IMGDIR + n).toString('base64')

const STONES = [{ x: 74, y: 84 }, { x: 28, y: 63 }, { x: 70, y: 43 }, { x: 30, y: 24 }, { x: 66, y: 6 }]
const LV = ['入门', '初级', '中级', '中高级', '高级']
const intro = () => `<div class="pt">
  <div class="pt-h">找到你的起点</div><div class="pt-sub">测测你认识多少马来语高频词 · 最多 30 题</div>
  <div class="pt-scene"><div class="pt-trail"></div>${LV.map((l, i) => `<div class="pt-stone ${i === 0 ? 'start' : ''} ${i >= 3 ? 'far' : ''}" style="left:${STONES[i].x}%;top:${STONES[i].y}%;animation-delay:${i * 60}ms">${l}${i === 0 ? '<div class="pt-stone-tip">起点</div>' : ''}</div>`).join('')}</div>
  <div class="pt-guide"><img class="pt-bird-map" src="${img('bird-map.webp')}"><div class="pt-bubble">看词选意思，不会就点<span class="pt-nw">「不认识」</span>· 约 3 分钟</div></div>
  <div class="pt-foot"><button class="btn btn-main btn-block pt-cta">开始测评<span class="btn-arr">→</span></button><div class="pt-link">先跳过，从入门学起</div></div>
</div>`
const quiz = () => `<div class="pt">
  <div class="pt-top"><div class="pt-x">×</div><div class="pt-bar"><div class="pt-bar-in" style="width:26%"><div class="pt-bar-star"></div></div></div><span class="pt-no">8 / 30</span></div>
  <div class="pt-chip">第 2 档 · 初级 · 2/6</div>
  <div class="pt-q"><div class="pt-stage"><img class="pt-bird-peek" src="${img('bird-peek.webp')}">
    <div class="pt-card in"><div class="pt-word"><span class="ms pt-w" style="font-size:42px">makanan</span><div class="pt-say"><div class="say say-md tone-ivory"><div class="cone"></div><div class="wave"></div></div></div></div>
      <div class="pt-opts">${['食物', '学校', '衣服', '天气'].map((o, i) => `<div class="pt-opt ${i === 0 ? 'on' : 'dim'}"><span class="pt-l">${'ABCD'[i]}</span><span class="pt-ot">${o}</span></div>`).join('')}</div></div></div>
  <div class="pt-none">不认识</div><div class="pt-hint">选你最确定的；不会就选「不认识」，别猜</div></div>
</div>`
const result = () => `<div class="pt">
  <div class="pt-res"><img class="pt-bird-jump" src="${img('bird-jump.webp')}"><div class="pt-badge">推荐难度 · 中级</div><div class="pt-num">1,000</div><div class="pt-num-u">估算你认识的高频词 · 答了 18 题</div></div>
  <div class="pt-steps grow">${LV.map((l, i) => `<div class="pt-step ${i < 2 ? 'done' : ''} ${i === 2 ? 'rec' : ''}">${i === 2 ? '<div class="pt-flag">从这里学</div>' : ''}<div class="pt-col" style="height:${(56 + i * 34) / 2}px">${i < 2 ? '<span class="pt-col-ck">✓</span>' : ''}</div><div class="pt-step-t">${l}</div><div class="pt-step-s">${['6/6', '5/6', '1/6', '', ''][i]}</div></div>`).join('')}</div>
  <div class="pt-note">「初级」及以下答对的词记为学过，15 天后复习一次确认；答错和不认识的词会最先推给你。学得顺会自动升一档。</div>
  <div class="pt-foot"><button class="btn btn-main btn-block pt-cta">从「中级」开始学<span class="btn-arr">→</span></button><div class="pt-link">再测一次</div></div>
</div>`
const phone = (title, body, day) => `<div class="frame"><div class="nav ${day ? 'd' : ''}">${title}</div><div class="phone ${day ? 'day' : ''}" style="${day ? dayVars : ''}">${body}</div></div>`
const row = day => `<div class="row">${phone('入门测评', intro(), day)}${phone('入门测评', quiz(), day)}${phone('入门测评', result(), day)}</div>`

writeFileSync(join(here, 'preview.html'), `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>入门测评预览</title><style>
body{margin:0;padding:24px;background:#e9e6df;font-family:-apple-system,"PingFang SC","Microsoft YaHei",sans-serif}
.row{display:flex;gap:28px;margin-bottom:28px;flex-wrap:wrap}
.frame{width:375px;border-radius:28px;overflow:hidden;box-shadow:0 20px 50px rgba(0,0,0,.25)}
.nav{height:44px;line-height:44px;text-align:center;font-size:16px;font-weight:600;background:#0a1f22;color:#f3ead6}.nav.d{background:#f4eee1;color:#000}
.phone{height:724px;overflow:hidden;background:var(--night);color:var(--ink);font-size:15px;line-height:1.5;position:relative}
.phone *{box-sizing:border-box}
button{border:0;font:inherit;cursor:pointer}
${app}
${pt}
</style></head><body>${row(false)}${row(true)}</body></html>`)
console.log('preview.html')
