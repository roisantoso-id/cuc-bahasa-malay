// 把小程序真实的 WXSS（app.wxss + 各页面 + 组件）换算成浏览器 CSS（1rpx = 0.5px），
// 和手写的示例数据拼成 index.html。改了小程序样式后重跑：node build.mjs && NODE_PATH=…/node_modules node shot.cjs
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
const here = dirname(fileURLToPath(import.meta.url))
const MP = join(here, '../../miniprogram/miniprogram')
const A = '../../miniprogram/miniprogram/assets'
const VH = 7.24, VW = 3.75

const read = f => readFileSync(join(MP, f), 'utf8')
const units = css => css
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/@import[^;]+;/g, '')
  .replace(/(-?\d*\.?\d+)rpx/g, (_, n) => +(n / 2).toFixed(2) + 'px')
  .replace(/(-?\d*\.?\d+)vh/g, (_, n) => +(n * VH).toFixed(1) + 'px')
  .replace(/(\s)image(\s*[{,.])/g, '$1img$2')
  .replace(/(-?\d*\.?\d+)vw/g, (_, n) => +(n * VW).toFixed(1) + 'px')
// 给每条规则加上作用域，模拟「页面样式只管自己那一页」
function scope(css, sc) {
  let out = '', i = 0
  while (i < css.length) {
    const open = css.indexOf('{', i)
    if (open < 0) break
    let depth = 1, j = open + 1
    while (j < css.length && depth) { if (css[j] === '{') depth++; else if (css[j] === '}') depth--; j++ }
    const head = css.slice(i, open).trim(), body = css.slice(open + 1, j - 1)
    if (head.startsWith('@keyframes')) out += `${head}{${body}}\n`
    else if (head.startsWith('@media')) out += `${head}{${scope(body, sc)}}\n`
    else out += head.split(',').map(s => { s = s.trim(); return s === 'page' ? sc : s.startsWith(':host') ? sc + s.slice(5) : `${sc} ${s}` }).join(',') + `{${body}}\n`
    i = j
  }
  return out
}
const css = [
  scope(units(read('app.wxss')), '.scr'),
  ...[['home', 'pages/home/home'], ['atlas', 'pages/atlas/atlas'], ['battle', 'pages/battle/battle'], ['me', 'pages/me/me'], ['learn', 'pkg-word/learn/learn'], ['rank', 'pkg-battle/rank/rank']]
    .map(([k, f]) => scope(units(read(f + '.wxss')), `.scr.p-${k}`)),
  scope(units(read('components/say-btn/say-btn.wxss')), '.scr .c-say'),
  scope(units(read('components/hb-empty/hb-empty.wxss')), '.scr .c-empty'),
  scope(units(read('components/fx-burst/fx-burst.wxss')), '.scr .c-burst'),
  scope(units(read('custom-tab-bar/index.wxss')).replace(/\.bar\b/g, '.tb-bar'), '.scr .c-tab')
].join('\n')

// ---------- 小零件 ----------
const say = (size = 'md', tone = '') => `<span class="c-say"><span class="say say-${size} ${tone ? 'tone-' + tone : ''}"><span class="cone"></span><span class="wave"></span></span></span>`
const tab = on => `<div class="c-tab"><div class="tb-bar">${[['今日', 'today', 'checkin'], ['图鉴', 'atlas', 'study'], ['对战', 'battle', 'pass'], ['护照', 'passport', 'cheer']].map(([t, ic, bird], i) =>
  `<div class="it ${i === on ? 'on' : ''}"><div class="ic">${i === on ? `<img class="bird" src="${A}/${bird}.jpg">` : `<img class="svg" src="${A}/tab/${ic}.svg">`}</div><span class="t">${t}</span></div>`).join('')}</div></div>`
const phone = (id, title, cap, page, body, { tabOn = -1, h = 812 } = {}) => `
<figure class="pw" id="${id}">
  <div class="phone" style="height:${h}px">
    <div class="sb"><span>9:41</span><i><u></u><b></b></i></div>
    <div class="nav">${title}</div><div class="capsule"></div>
    <div class="scr p-${page}">${body}${tabOn >= 0 ? tab(tabOn) : ''}</div>
  </div>
  <figcaption>${cap}</figcaption>
</figure>`
const rk = (p, av, n, sub, s, x, me) => `<div class="rk ${me ? 'me' : ''}"><span class="rk-p ${p < 4 ? 'top' : ''}">${p}</span><img class="rk-av" src="${A}/${av}.jpg"><div class="rk-main"><div class="rk-n">${n}${me ? '（我）' : ''}</div><div class="rk-sub">${sub}</div></div><div class="rk-r"><div class="rk-s">${s}</div><div class="rk-x">${x}</div></div></div>`

// ---------- 各屏（结构照抄 WXML，数据是示例）----------
const home = `
<div class="wrap">
  <div class="hm-date">11月18日 · 连续第 12 天</div>
  <div class="h1">晚上好，阿澄。</div>
  <div class="hm-hero">
    <div class="hm-ring-box">
      <svg class="hm-ring" viewBox="0 0 192 192"><circle cx="96" cy="96" r="88" fill="none" stroke="rgba(243,234,214,.12)" stroke-width="8"/><circle cx="96" cy="96" r="88" fill="none" stroke="#e9b961" stroke-width="8" stroke-linecap="round" stroke-dasharray="553" stroke-dashoffset="400" transform="rotate(-90 96 96)"/></svg>
      <div class="hm-ring-in"><div class="hm-big">58</div><div class="hm-lab">今天要见的词</div></div>
    </div>
    <img class="hm-bird" src="${A}/bird-hero.png" style="object-fit:contain">
  </div>
  <div class="stats">
    <div class="stat"><div class="stat-n">38</div><div class="stat-l">先温故</div></div>
    <div class="stat"><div class="stat-n">20</div><div class="stat-l">再知新</div></div>
    <div class="stat"><div class="stat-n">15<span class="stat-u"> 分钟</span></div><div class="stat-l">大约</div></div>
  </div>
  <div class="hm-cta"><button class="btn btn-main btn-block">开始今天的航程<span class="btn-arr">→</span></button></div>
  <div class="list hm-list">
    <div class="item"><div class="hm-dots"></div><div class="item-main"><div>已点亮 <span class="hm-star">684</span> 颗星</div><div class="muted small">马六甲还有 316 颗没亮</div></div><span class="arrow">›</span></div>
    <div class="item"><div class="hm-say"><div class="hm-cone"></div><div class="hm-wave"></div></div><div class="item-main"><div class="hm-w1"><span class="ms hm-wms">minum</span><span>喝；饮用</span></div><div class="muted small one">今日一词 · Jangan lupa minum air.</div></div></div>
  </div>
</div>`

const birds = on => `
<div class="ln-actions"><div class="ln-birds">
  <div class="ln-bd"><img src="${A}/fail.jpg"><div class="ln-bd-t">← 不认识</div><div class="ln-gh">1 天后</div></div>
  <div class="ln-bd"><img src="${A}/loading.jpg"><div class="ln-bd-t">↑ 模糊</div><div class="ln-gh">1 天后</div></div>
  <div class="ln-bd ${on ? 'on' : ''}"><img src="${A}/cheer.jpg" style="animation:none"><div class="ln-bd-t">认识 →</div><div class="ln-gh">2 天后</div></div>
</div><div class="btn-text">太简单了，设为已掌握</div></div>`
const card = `
<div class="ln-page">
  <div class="ln-top"><div class="bar"><div class="bar-in" style="width:12%"></div></div><div class="ln-top-r"><span class="no">7 / 58</span><span>新词</span></div></div>
  <div class="ln-card flipped"><div class="ln-card-in"><div class="ln-w">belajar</div></div><div class="ln-say">${say('md', 'ivory')}</div></div>
  <div class="ln-below">
    <div class="ln-meta"><div class="ln-meta-t one"><span class="no">№ 650</span> · T2 · 动词 · 初次见面</div><div class="ln-fav-wrap"><div class="ln-fav"><img class="ln-fav-i" src="${A}/fx/star-line.svg">收藏</div></div></div>
    <div class="ln-sn"><div class="ln-mean"><span class="pos">动词</span>学习；求学</div><div class="example"><div class="ln-ex-ms">Mereka <span class="ln-hit">belajar</span> bahasa Melayu.</div><div class="muted small">他们学习马来语。</div></div></div>
    <div class="ln-sn"><div class="ln-mean"><span class="pos">动词</span>受教；学到教训</div><div class="example"><div class="ln-ex-ms">Kita <span class="ln-hit">belajar</span> daripada kesilapan.</div><div class="muted small">我们从错误中学习。</div></div></div>
    <div class="ln-root">词根 <span class="serif ln-root-w">ajar</span></div>
  </div>
  ${birds(false)}
</div>`
const front = `
<div class="ln-page">
  <div class="ln-top"><div class="bar"><div class="bar-in" style="width:12%"></div></div><div class="ln-top-r"><span class="no">7 / 58</span><span>新词</span></div></div>
  <div class="ln-card"><div class="ln-card-in"><div class="ln-w">belajar</div><div class="ln-card-hint">点卡片翻看释义</div></div><div class="ln-say">${say('md', 'ivory')}</div></div>
  <div class="ln-grow"></div>
  <div class="ln-actions"><button class="btn btn-main btn-block">看释义</button></div>
</div>`
const quiz = `
<div class="ln-page">
  <div class="ln-top"><div class="bar"><div class="bar-in" style="width:30%"></div></div><div class="ln-top-r"><span class="no">3 / 10</span><span>小练习</span></div></div>
  <div class="ln-quiz">
    <div class="ln-q-k">听音选义</div>
    <div class="ln-q-listen"><div class="ln-q-ring"><span style="transform:scale(1.6);display:inline-flex">${say('lg', 'big')}</span></div><div class="muted small">没听清就再点一下</div></div>
    <div class="ln-opts">
      <div class="opt wrong">吃；用餐</div><div class="opt right">喝；饮用</div><div class="opt dim">去；离开</div><div class="opt dim">学习；求学</div>
    </div>
  </div>
  <div class="ln-fb"><div class="item-main"><div class="ms ln-fb-w one">minum</div><div class="ln-fb-l">已放进错词本，明天再考一次</div></div><button class="btn btn-main ln-fb-b">继续</button></div>
</div>`

const DAYS = [['全部', '6 天'], ['第 1 天', '11.13'], ['第 2 天', '11.14'], ['第 3 天', '11.15'], ['第 4 天', '11.16'], ['第 5 天', '11.17'], ['第 6 天', '11.18']]
const atlasBody = pop => `
<div class="at-page">
  <div class="wrap at-head"><div><span class="num-xl">684</span><span class="at-u"> 个词已点亮</span></div><div class="muted small">第 6 天 · 11月18日 · 34 个词</div></div>
  <div class="at-days" style="overflow:hidden"><div class="at-days-in" style="transform:translateX(-150px)">${DAYS.map(([t, d], i) => `<div class="at-dy ${i === 6 ? 'on' : ''}"><div class="at-dy-t">${t}</div><div class="at-dy-d">${d}</div></div>`).join('')}</div></div>
  <div class="at-cloud" data-cloud style="height:347px"></div>
  <div class="at-hint">越大越亮的词记得越牢 · 点词看释义</div>
  ${pop ? `<div class="at-mask on"><div class="sheet at-pop on">
    <div class="at-pop-h"><div class="at-pop-ms">kedai</div>${say('md', 'ivory')}</div>
    <div class="at-pop-root">词根 kedai</div>
    <div class="at-pop-body">
      <div class="at-pop-s"><div class="at-pop-zh"><span class="at-pop-pos">名词</span>商店；店铺</div><div class="at-pop-ex"><div class="at-pop-exm">Saya pergi ke kedai buku.</div><div class="at-pop-exz">我去书店。</div></div></div>
      <div class="at-pop-s"><div class="at-pop-zh"><span class="at-pop-pos">名词</span>小吃店；茶室</div><div class="at-pop-ex"><div class="at-pop-exm">Kami minum di kedai kopi.</div><div class="at-pop-exz">我们在咖啡店喝东西。</div></div></div>
    </div>
    <div class="at-pop-f"><div class="at-fav-wrap"><div class="at-fav on"><img class="at-fav-i" src="${A}/fx/star-amber.svg">已收藏</div></div><div class="at-pop-x">收起</div></div>
  </div></div>` : ''}
</div>`

const battle = `
<div class="wrap">
  <div class="bt-hero">
    <div class="bt-hero-l"><div class="muted small">每周擂台 · 第 47 周 · 距结束</div><div class="bt-cd"><span class="num-xl">4</span><span class="bt-u"> 天 </span><span class="num-xl">12</span><span class="bt-u"> 小时</span></div><div class="muted small">20 题，取三次里最高的一次</div><div class="muted small">本周还剩 2 次机会</div></div>
    <img class="bt-bird" src="${A}/bird-welcome.png" style="object-fit:contain">
  </div>
  <div class="bt-acts"><button class="btn btn-main bt-a1">进入擂台</button><button class="btn btn-ghost bt-a2">发起好友 PK</button></div>
  <div class="bt-sel">好友 PK 考 第2站，10 题<span class="bt-sel-x">换一站 ›</span></div>
  <div class="sec"><span class="sec-t">周榜</span><div class="sec-x bt-more">完整榜单 ›</div></div>
  <div class="tabs"><div class="tab on">全站</div><div class="tab">本校</div><div class="tab">本班</div><div class="tab">学校榜</div></div>
  <div class="rk me"><img class="rk-av" src="${A}/avatar.jpg"><div class="rk-main"><div class="rk-n">阿澄</div><div class="rk-sub">本周第 23 名 · 差 20 分追上 小麦</div></div><div class="rk-r"><span class="rk-s">1640</span><span class="rk-x"> 分</span></div></div>
  <div class="bt-podium">
    ${[[2, 'study', 'Hafiz', 1880], [1, 'cheer', '椰子糖', 1960], [3, 'pass', '南洋的风', 1820]].map(([p, av, n, s]) => `<div class="bt-pd bt-p${p}"><div class="bt-pd-k">${p}</div><img class="bt-pd-av" src="${A}/${av}.jpg"><div class="bt-pd-n">${n}</div><div class="bt-pd-s">${s} 分</div></div>`).join('')}
  </div>
  <div class="bt-board">
    <div class="rk-gap">···</div>
    ${[[21, 'welcome', 'Aina', '北京外国语大学', 1680], [22, 'checkin', '小麦', '中国传媒大学', 1660], [23, 'avatar', '阿澄（我）', '中国传媒大学', 1640], [24, 'study', '榴莲不臭', '广东外语外贸大学', 1620]].map(([p, av, n, sub, s]) => `<div class="rk"><span class="rk-p">${p}</span><img class="rk-av" src="${A}/${av}.jpg"><div class="rk-main"><div class="rk-n">${n}</div><div class="rk-sub">${sub}</div></div><span class="rk-s">${s}</span></div>`).join('')}
  </div>
  <div class="sec"><span class="sec-t">最近的 PK</span></div>
  <div class="list">
    <div class="item"><div class="item-main"><div>第2站 · 我发起</div><div class="muted small">11月17日 · 3 人参加 · 答对 8/10</div></div><div class="rk-r"><span class="rk-s">812</span><span class="rk-x"> 分</span></div><span class="arrow">›</span></div>
    <div class="item"><div class="item-main"><div>第1站 · 应战</div><div class="muted small">11月15日 · 2 人参加 · 答对 6/10</div></div><div class="rk-r"><span class="rk-s">604</span><span class="rk-x"> 分</span></div><span class="arrow">›</span></div>
  </div>
</div><div class="tab-pad"></div>`

const N7 = [[38, '今天'], [52, '四'], [27, '五'], [31, '六'], [19, '日'], [44, '一'], [23, '二']]
const HEAT = '0123210321032110223301230312112332'.slice(0, 30).split('')
const me = `
<div class="wrap">
  <div class="me-who"><img class="me-av" src="${A}/avatar.jpg"><div class="item-main"><div class="h1 one">阿澄</div><div class="muted small one">中国传媒大学 · 马来语 2 班 · 已盖 1 个章</div></div><div class="btn btn-ghost btn-sm">修改资料</div></div>
  <div class="sec"><span class="sec-t">记得多牢</span><span class="sec-x">已开放 3000 词</span></div>
  <div class="me-stack"><div class="me-sg me-c1" style="width:13.7%"></div><div class="me-sg me-c2" style="width:5.6%"></div><div class="me-sg me-c3" style="width:3.5%"></div></div>
  <div class="me-legend">${[[412, '牢固', 1], [168, '熟悉', 2], [104, '快忘了', 3], [2316, '没见过', 4]].map(([n, l, c]) => `<div class="me-lg"><div class="num">${n}</div><div class="me-lg-l"><span class="me-d me-c${c}"></span>${l}</div></div>`).join('')}</div>
  <div class="sec"><span class="sec-t">未来 7 天要复习</span><span class="sec-x">最多：四</span></div>
  <div class="me-bars">${N7.map(([n, l], i) => `<div class="me-bc"><div class="me-bn">${n}</div><div class="me-bt"><div class="me-bf ${i ? '' : 'today'}" style="height:${Math.round(n / 52 * 100)}%"></div></div><div class="me-bl ${i ? '' : 'today'}">${l}</div></div>`).join('')}</div>
  <div class="sec"><span class="sec-t">最近 30 天</span><span class="sec-x">连续 12 天 · 共学 24 天</span></div>
  <div class="me-heat">${HEAT.map(l => `<div class="me-hc l${l}"></div>`).join('')}</div>
  <div class="list me-links">
    ${[['错词本', '31 个'], ['收藏', '18 个'], ['每天新词', '20 个'], ['关于老师', ''], ['意见反馈 / 单词报错', ''], ['联系客服', ''], ['隐私说明', '']].map(([t, x]) => `<div class="item"><div class="item-main">${t}</div>${x ? `<span class="item-x">${x}</span>` : ''}<span class="arrow">›</span></div>`).join('')}
  </div>
  <div class="muted small center me-foot">JomBelajar · 张静灵老师主持编写</div>
</div><div class="tab-pad"></div>`

const rank = `
<div class="wrap rp-wrap">
  <div class="tabs"><div class="tab on">全站</div><div class="tab">本校</div><div class="tab">本班</div><div class="tab">学校榜</div></div>
  <div class="muted small rp-rule">本周（11月16日 起）· 新学 2 分 · 复习 1 分 · 答对 1 分</div>
  ${rk(1, 'cheer', '椰子糖', '北京外国语大学 马来语 1 班', 1960, '新学 240')}
  ${rk(2, 'study', 'Hafiz', '云南民族大学', 1880, '新学 210')}
  ${rk(3, 'pass', '南洋的风', '广西民族大学 2024 级', 1820, '新学 230')}
  ${rk(4, 'welcome', 'Aina', '北京外国语大学', 1790, '新学 180')}
  ${rk(5, 'avatar', '阿澄', '中国传媒大学 马来语 2 班', 1640, '新学 160', true)}
  ${rk(6, 'checkin', '小麦', '中国传媒大学 马来语 2 班', 1620, '新学 150')}
  ${rk(7, 'study', '榴莲不臭', '广东外语外贸大学', 1580, '新学 170')}
</div>
<div class="c-empty" style="border-top:1px solid rgba(243,234,214,.12);margin-top:16px"><div class="empty"><img class="img" src="${A}/empty.jpg"><div class="t">还不知道你在哪个班</div><div class="d">完善资料，填上学校和班级就能看。（空状态长这样）</div><div class="act"><button class="btn btn-main">完善资料</button></div></div></div>`

// ---------- 设计系统那一块 ----------
const sys = `
<div class="scr sys">
  <div class="sys-col">
    <div class="sys-h">字号 · 5 级</div>
    <div class="sys-row"><span class="num-xl">58</span><span class="sys-k">display 88 · Georgia · 大数字</span></div>
    <div class="sys-row"><span class="ms" style="font-size:44px;font-weight:700">belajar</span><span class="sys-k">display 88 · Georgia 斜体 · 马来语词</span></div>
    <div class="sys-row"><span class="h1">晚上好，阿澄。</span><span class="sys-k">title 44 · 宋体 · 页面标题</span></div>
    <div class="sys-row"><span class="num">1640</span><span class="sys-k">title 44 · Georgia · 中号数字</span></div>
    <div class="sys-row"><span class="sec-t">记得多牢</span><span class="sys-k">section 32 · 宋体 · 小节标题</span></div>
    <div class="sys-row"><span>已点亮 684 颗星</span><span class="sys-k">body 30 · 苹方 · 正文</span></div>
    <div class="sys-row"><span class="muted small">马六甲还有 316 颗没亮</span><span class="sys-k">caption 24 · 说明</span></div>
  </div>
  <div class="sys-col">
    <div class="sys-h">颜色 · 角色</div>
    <div class="sys-sw">
      ${[['#0a1f22', '夜 · 页面底', 1], ['#14353a', '面板 · 少用', 1], ['#f3ead6', '象牙 · 字 / 词卡 / 主按钮', 0], ['#e9b961', '星光 · 每屏一处', 0], ['#8fc0a0', '对', 0], ['#e8836a', '错', 0]].map(([c, t, d]) => `<div class="sys-c" style="background:${c};color:${d ? '#f3ead6' : '#0a1f22'}"><b>${c}</b>${t}</div>`).join('')}
    </div>
    <div class="sys-h" style="margin-top:24px">间距 8 / 16 / 24 / 32 / 48 · 圆角 16 / 32 / 胶囊 · 细线</div>
    <div class="sys-sp">${[8, 16, 24, 32, 48].map(n => `<i style="width:${n / 2}px"></i><em>${n}</em>`).join('')}<u style="border-radius:8px"></u><em>16</em><u style="border-radius:16px"></u><em>32</em><u style="border-radius:99px"></u><em>胶囊</em></div>
    <div class="sys-h" style="margin-top:24px">标签 · 切换 · 进度</div>
    <div class="row" style="flex-wrap:wrap"><span class="tag">动词</span><span class="tag amber">初次见面</span><span class="tag coral">错 3 次</span><span class="chip on">零基础</span><span class="chip">会说一些</span></div>
    <div class="tabs" style="margin-top:12px"><div class="tab on">全部<span class="tab-n">500</span></div><div class="tab">没学<span class="tab-n">316</span></div><div class="tab">在学<span class="tab-n">92</span></div><div class="tab">熟悉<span class="tab-n">60</span></div><div class="tab">掌握<span class="tab-n">32</span></div></div>
    <div class="bar" style="margin-top:16px"><div class="bar-in" style="width:38%"></div></div>
  </div>
  <div class="sys-col">
    <div class="sys-h">按钮 · 宽度跟着字走</div>
    <div class="row" style="flex-wrap:wrap;row-gap:12px"><button class="btn btn-main">进入擂台</button><button class="btn btn-ghost">发起好友 PK</button></div>
    <div class="row" style="margin-top:12px"><button class="btn btn-main btn-sm">重练这些词</button><button class="btn btn-ghost btn-sm">修改资料</button><button class="btn btn-danger btn-sm">删除记录</button><span class="btn-text">文字按钮</span></div>
    <div style="margin-top:12px"><button class="btn btn-main btn-block">开始今天的航程<span class="btn-arr">→</span></button></div>
    <div class="sys-k" style="margin-top:6px">撑满一行只给这一屏唯一的主操作</div>
    <div class="sys-h" style="margin-top:24px">列表行 · 排行行 · 一排数字</div>
    <div class="list"><div class="item"><div class="item-main">错词本</div><span class="item-x">31 个</span><span class="arrow">›</span></div></div>
    ${rk(2, 'study', 'Hafiz', '云南民族大学', 1880, '新学 210')}
    <div style="padding:0 16px">${rk(5, 'avatar', '阿澄', '中国传媒大学', 1640, '新学 160', true)}</div>
    <div class="stats" style="border-top:0"><div class="stat"><div class="stat-n">38</div><div class="stat-l">先温故</div></div><div class="stat"><div class="stat-n">20</div><div class="stat-l">再知新</div></div><div class="stat"><div class="stat-n">15<span class="stat-u"> 分钟</span></div><div class="stat-l">大约</div></div></div>
  </div>
</div>`

const html = `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>马来语高频词 · 小程序统一视觉 v3（词光夜航）</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
html{background:#e9e4da}
body{font-family:-apple-system,"PingFang SC","Hiragino Sans GB","Microsoft YaHei",sans-serif;color:#1c2420;line-height:1.6;font-size:15px;overflow-x:hidden}
.doc{max-width:1700px;margin:0 auto;padding:40px 32px 80px}
.doc h1{font-family:"Songti SC","STSong",serif;font-size:34px;line-height:1.25}
.doc>p{max-width:820px;color:#47524c;margin-top:10px}
.doc h2{font-family:"Songti SC","STSong",serif;font-size:24px;margin:48px 0 16px;padding-top:28px;border-top:2px solid #1c2420}
.phones{display:flex;flex-wrap:wrap;gap:40px 34px;align-items:flex-start}
.pw{width:375px}
.pw figcaption{font-size:14px;color:#47524c;margin-top:14px;line-height:1.5}
.pw figcaption b{color:#1c2420}
.phone{position:relative;width:375px;border-radius:46px;overflow:hidden;background:#0a1f22;color:#f3ead6;box-shadow:0 0 0 9px #15181a,0 0 0 10.5px #3a3f42,0 34px 60px -24px rgba(20,24,26,.55)}
.sb{position:absolute;left:0;right:0;top:0;height:44px;display:flex;align-items:center;justify-content:space-between;padding:12px 30px 0;font-weight:600;font-size:15px;z-index:5}
.sb i{display:flex;gap:5px;align-items:center}
.sb i b{display:block;width:22px;height:11px;border-radius:3px;border:1.5px solid currentColor;opacity:.9}
.sb i u{display:block;width:15px;height:10px;background:currentColor;clip-path:polygon(0 100%,100% 0,100% 100%)}
.nav{position:absolute;left:0;right:0;top:44px;height:44px;line-height:44px;padding-left:16px;font-weight:600;font-size:17px}
.capsule{position:absolute;right:7px;top:50px;width:87px;height:32px;border-radius:16px;border:.5px solid rgba(255,255,255,.25);background:rgba(0,0,0,.2)}
.scr{position:absolute;left:0;right:0;top:88px;bottom:0;overflow:hidden;transform:translateZ(0)}
.scr *{box-sizing:border-box}
.scr img{display:inline-block;vertical-align:top;object-fit:cover}
/* 模拟微信基础库 v2 的 button 默认样式，用来验证我们的按钮规则能压住它 */
.scr button{appearance:none;border:0;font-family:inherit;cursor:pointer}
.scr button:not([size=mini]){display:block;width:184px;margin-left:auto;margin-right:auto;padding:8px 24px;font-size:17px;font-weight:500;line-height:1.41;border-radius:4px;min-height:40px;background:#f2f2f2;color:#06ae56}
.scr .c-tab .tb-bar{position:absolute}
.scr .ln-below,.scr .at-pop-body{overflow:auto}
.scr.sys{position:static;transform:none;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:40px;padding:32px;border-radius:24px}
.sys-h{font-size:12px;color:rgba(243,234,214,.64);margin-bottom:12px;letter-spacing:.04em}
.sys-row{display:flex;align-items:baseline;justify-content:space-between;gap:16px;padding:8px 0;border-bottom:1px solid rgba(243,234,214,.12)}
.sys-k{font-size:12px;color:rgba(243,234,214,.5);text-align:right;flex:none}
.sys-sw{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}
.sys-c{height:72px;border-radius:8px;padding:8px;font-size:12px;line-height:1.35;display:flex;flex-direction:column;justify-content:flex-end;border:1px solid rgba(243,234,214,.12)}
.sys-c b{font-family:ui-monospace,Menlo,monospace;font-weight:400}
.sys-sp{display:flex;align-items:center;gap:6px;flex-wrap:wrap}
.sys-sp i{display:block;height:24px;background:#e9b961}
.sys-sp em{font-style:normal;font-size:12px;color:rgba(243,234,214,.64);margin-right:10px}
.sys-sp u{display:block;width:48px;height:32px;border:1px solid rgba(243,234,214,.24)}
@media(max-width:1100px){.scr.sys{grid-template-columns:1fr}.doc{padding:24px 16px 60px}}
@media(max-width:440px){.phones{zoom:.82}}
/* ====== 以下由小程序 WXSS 自动换算（1rpx = 0.5px）====== */
${css}
</style></head><body><div class="doc">
<h1>马来语高频词 · 小程序统一视觉 v3</h1>
<p>方向 B「词光夜航」落到全站：一套字号、间距、圆角、颜色和按钮。下面每一屏的样式都是从小程序里真实的 WXSS 换算出来的（不是另画的图），数据是示例。</p>
<h2>设计系统</h2>
${sys}
<h2>关键页面</h2>
<div class="phones">
${phone('home', '今日', '<b>今日</b>：一个数字、一个撑满的主按钮。星光只给圆环进度。下面两行是列表行，不是卡片。', 'home', home, { tabOn: 0 })}
${phone('front', '今日车票', '<b>词卡正面</b>：只有词和发音，一个主按钮。', 'learn', front)}
${phone('card', '今日车票', '<b>词卡翻开</b>：一行说明代替一排标签；三只犀鸟打分，没有边框；也可以左右上滑。', 'learn', card)}
${phone('quiz', '今日车票', '<b>小测答错</b>：不批评，只标出对的是哪个；底部面板告诉你什么时候再考。', 'learn', quiz)}
${phone('atlas', '图鉴', '<b>图鉴</b>：按天切换是一行（可左右滑），词云是这一屏唯一的面板。', 'atlas', atlasBody(false), { tabOn: 1 })}
${phone('pop', '图鉴', '<b>点词弹层</b>：象牙色弹层，从词的位置放大出来；收藏会炸星星。', 'atlas', atlasBody(true), { tabOn: 1 })}
${phone('battle', '对战', '<b>对战</b>：倒计时 + 两个按钮；周榜带头像，星光色那一行永远是「我」。', 'battle', battle, { tabOn: 2, h: 1260 })}
${phone('me', '护照', '<b>护照</b>：记得多牢、接下来复习多少、最近有没有坚持；下面是设置行。', 'me', me, { tabOn: 3, h: 1140 })}
${phone('rank', '完整榜单', '<b>完整榜单 + 空状态</b>：分包里的排行行和对战页是同一个零件。', 'rank', rank, { h: 1010 })}
</div></div>
<script>
// 词云：和 pages/atlas/atlas.js 同一个螺旋摆放
const WORDS='belajar kedai minum makan pergi rumah buku air jalan kawan sekolah guru besar kecil baru lama cantik hari malam pagi kerja main tidur duduk lihat dengar cakap tulis baca beli jual masuk keluar datang'.split(' ').map((ms,i)=>({ms,rank:600+i,box:[6,6,4,4,4,2,2,2,2,2,1,1,1,1,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0][i]}))
const level=b=>b>=6?4:b>=4?3:b>=2?2:b>=1?1:0
function layout(words,W,H){const placed=[],out=[];words.slice().sort((a,b)=>b.box-a.box||a.rank-b.rank).forEach((w,i)=>{const b=level(w.box),fs=Math.round((i<3?22:14)+b*3),ww=w.ms.length*fs*.56+10,hh=fs*1.35;for(let t=0;t<900;t++){const a=t*.32,r=2.2*a,x=W/2+Math.cos(a)*r*1.5-ww/2,y=H/2+Math.sin(a)*r-hh/2;if(x<6||y<6||x+ww>W-6||y+hh>H-6)continue;if(placed.some(p=>x<p.x+p.w&&x+ww>p.x&&y<p.y+p.h&&y+hh>p.y))continue;placed.push({x,y,w:ww,h:hh});out.push({ms:w.ms,b,fs,x:Math.round(x),y:Math.round(y)});return}});return out}
document.querySelectorAll('[data-cloud]').forEach(el=>{el.innerHTML=layout(WORDS,343,347).map(c=>'<div class="at-w b'+c.b+'" style="left:'+c.x+'px;top:'+c.y+'px;font-size:'+c.fs+'px;animation:none;opacity:1">'+c.ms+'</div>').join('')})
</script></body></html>`
writeFileSync(join(here, 'index.html'), html)
console.log('index.html', (html.length / 1024).toFixed(0) + 'KB')
