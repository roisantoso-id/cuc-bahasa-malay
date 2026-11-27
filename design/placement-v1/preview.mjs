// 入门测评三屏的浏览器预览：把小程序真实的 WXSS（app.wxss + placement.wxss + say-btn）换算成 CSS（1rpx = 0.5px），
// 配上和 placement.wxml 同结构的示例 HTML。测评页固定夜航场景，所以只出一排。node design/placement-v1/preview.mjs → preview.html
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
const here = dirname(fileURLToPath(import.meta.url))
const MP = join(here, '../../miniprogram/miniprogram')
const VH = 8.44 // iPhone 12/13：375×844，自定义导航，整屏都是页面
const units = css => css
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/(-?\d*\.?\d+)rpx/g, (_, n) => +(n / 2).toFixed(2) + 'px')
  .replace(/(-?\d*\.?\d+)vh/g, (_, n) => +(n * VH).toFixed(1) + 'px')
  .replace(/(-?\d*\.?\d+)vw/g, (_, n) => +(n * 3.75).toFixed(1) + 'px')
  .replace(/env\(safe-area-inset-bottom\)/g, '34px')
  .replace(/(^|[\s,}])image(\s*[{,.:])/g, '$1img$2')
const app = units(readFileSync(join(MP, 'app.wxss'), 'utf8')).replace(/(^|\n)page\s*\{/, '$1.phone {')
const pt = units(readFileSync(join(MP, 'pkg-word/placement/placement.wxss'), 'utf8')) + units(readFileSync(join(MP, 'components/say-btn/say-btn.wxss'), 'utf8'))
const js = readFileSync(join(MP, 'pkg-word/placement/placement.js'), 'utf8')
const STONES = JSON.parse(js.match(/const STONES = (\[.*\])/)[1].replace(/(\w+):/g, '"$1":'))
// 图片直接内嵌（内置浏览器把本地页面当静态快照打开，相对路径的图读不到）
const IMGDIR = join(MP, 'pkg-word/placement/img/')
const img = n => 'data:image/webp;base64,' + readFileSync(IMGDIR + n).toString('base64')
const navTop = 47, navH = 32 // px：状态栏 47 + 胶囊 32

const LV = ['入门', '初级', '中级', '中高级', '高级']
const shell = body => `<div class="pt"><img class="pt-bg" src="${img('bg-stars.webp')}" style="position:absolute;object-fit:cover">
  <div class="pt-nav" style="top:${navTop}px;height:${navH}px;position:absolute"><div class="pt-back">‹</div><span class="pt-nav-t">入门测评</span><div class="capsule"></div></div>
  <div class="pt-body" style="padding-top:${navTop + navH + 4}px">${body}</div></div>`
const sceneH = 502, sceneW = Math.round(sceneH * 750 / 1004)
const intro = () => shell(`
  <div class="pt-h">找到你的起点</div><div class="pt-sub">测测你认识多少马来语高频词 · 最多 30 题</div>
  <div class="pt-scene-wrap"><div class="pt-scene" style="width:${sceneW}px;height:${sceneH}px;font-size:15px"><img class="pt-scene-img" src="${img('scene.webp')}">
    ${LV.map((l, i) => `<div class="pt-stone ${i === 0 ? 'start' : ''} ${i >= 3 ? 'far' : ''}" style="left:${STONES[i].x}%;top:${STONES[i].y}%">${i === 0 ? '<div class="pt-stone-tip">起点</div>' : ''}${l}</div>`).join('')}
    <img class="pt-bird-map" src="${img('bird-map.webp')}"><div class="pt-bubble">看词选意思，不会就点<span class="pt-nw">「不认识」</span>，约 3 分钟</div></div></div>
  <div class="pt-foot"><button class="btn btn-main btn-block pt-cta">开始测评<span class="btn-arr">→</span></button><div class="pt-link">先跳过，从入门学起</div></div>`)
const quiz = () => shell(`
  <div class="pt-top"><div class="pt-bar"><div class="pt-bar-in" style="width:26%"><div class="pt-bar-star"></div></div></div><span class="pt-no">8 / 30</span></div>
  <div class="pt-chip">第 2 档 · 初级 · 2/6</div>
  <div class="pt-q"><div class="pt-stage"><img class="pt-bird-peek" src="${img('bird-peek.webp')}">
    <div class="pt-card in"><div class="pt-word"><span class="ms pt-w" style="font-size:42px">makanan</span><div class="pt-say"><div class="say say-md tone-ivory"><div class="cone"></div><div class="wave"></div></div></div></div>
      <div class="pt-opts">${['食物', '学校', '衣服', '天气'].map((o, i) => `<div class="pt-opt ${i === 0 ? 'on' : ''}"><span class="pt-l">${'ABCD'[i]}</span><span class="pt-ot">${o}</span></div>`).join('')}</div></div></div>
  <div class="pt-none">不认识</div><div class="pt-hint">选你最确定的；不会就选「不认识」，别猜</div></div>`)
const result = () => shell(`
  <div class="pt-res"><img class="pt-bird-jump" src="${img('bird-jump.webp')}"><div class="pt-badge">推荐难度 · 中级</div><div class="pt-num">1,000</div><div class="pt-num-u">估算你认识的高频词 · 答了 18 题</div></div>
  <div class="pt-steps grow">${LV.map((l, i) => `<div class="pt-step ${i < 2 ? 'done' : ''} ${i === 2 ? 'rec' : ''}">${i === 2 ? '<div class="pt-flag">从这里学</div>' : ''}<div class="pt-col" style="height:${(56 + i * 34) / 2}px">${i < 2 ? '<span class="pt-col-ck">✓</span>' : ''}</div><div class="pt-step-t">${l}</div><div class="pt-step-s">${['6/6', '5/6', '1/6', '', ''][i]}</div></div>`).join('')}</div>
  <div class="pt-note">「初级」及以下答对的词记为学过，15 天后复习一次确认；答错和不认识的词会最先推给你。学得顺会自动升一档。</div>
  <div class="pt-foot"><button class="btn btn-main btn-block pt-cta">从「中级」开始学<span class="btn-arr">→</span></button><div class="pt-link">再测一次</div></div>`)
const phone = body => `<div class="frame"><div class="phone">${body}</div></div>`

writeFileSync(join(here, 'preview.html'), `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>入门测评预览</title><style>
body{margin:0;padding:24px;background:#e9e6df;font-family:-apple-system,"PingFang SC","Microsoft YaHei",sans-serif}
.row{display:flex;gap:28px;flex-wrap:wrap}
.frame{width:375px;height:844px;border-radius:40px;overflow:hidden;box-shadow:0 20px 50px rgba(0,0,0,.3)}
.phone{height:844px;overflow:hidden;position:relative;font-size:15px;line-height:1.5}
.phone *{box-sizing:border-box}
.capsule{position:absolute;right:7px;top:0;width:87px;height:32px;border-radius:16px;border:1px solid rgba(255,255,255,.3);background:rgba(0,0,0,.25)}
button{border:0;font:inherit;cursor:pointer}
${app}
${pt}
.pt{height:844px;min-height:0}.pt-bg{width:375px;height:844px}.pt-body{min-height:844px}
</style></head><body><div class="row">${phone(intro())}${phone(quiz())}${phone(result())}</div></body></html>`)
console.log('preview.html', sceneW, sceneH)
