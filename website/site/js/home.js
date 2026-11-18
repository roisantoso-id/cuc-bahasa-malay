// 首页交互：学习方法五步演示、十站路线（列表 / 静态图 / 3D）。
// 3D 只在 <html class="can3d"> 时（宽屏、有 WebGL、没开减少动效，判断在 index.html 的 head 里）
// 滚动到路线附近才加载；加载失败就一直用静态路线图。
import { STOPS } from './route-data.js'

const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches

/* ---------- 学习方法：五步，进入视口后自动轮播，用户一点就停 ---------- */
const method = document.querySelector('[data-steps]')
if (method) {
  const tabs = [...method.querySelectorAll('[role=tab]')]
  const panels = tabs.map(t => document.getElementById(t.getAttribute('aria-controls')))
  const MS = 4500
  method.style.setProperty('--step-ms', MS + 'ms')
  let cur = 0, timer = null, auto = !reduce, inView = false
  const show = (i, focus) => {
    cur = (i + tabs.length) % tabs.length
    tabs.forEach((t, k) => { const on = k === cur; t.setAttribute('aria-selected', on); t.tabIndex = on ? 0 : -1; panels[k].classList.toggle('on', on) })
    if (focus) tabs[cur].focus()
  }
  const stop = () => { auto = false; clearInterval(timer); method.classList.add('paused') }
  const run = () => { clearInterval(timer); if (auto && inView) timer = setInterval(() => show(cur + 1), MS) }
  tabs.forEach((t, i) => t.addEventListener('click', () => { stop(); show(i) }))
  method.querySelector('[role=tablist]').addEventListener('keydown', e => {
    const k = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key]
    if (k) { e.preventDefault(); stop(); show(cur + k, true) }
    if (e.key === 'Home') { e.preventDefault(); stop(); show(0, true) }
    if (e.key === 'End') { e.preventDefault(); stop(); show(tabs.length - 1, true) }
  })
  method.addEventListener('focusin', stop)
  if (reduce) method.classList.add('paused')
  new IntersectionObserver(([e]) => { inView = e.isIntersecting; if (inView && auto) show(cur); run() }, { threshold: 0.4 }).observe(method)
}

/* ---------- 十站路线 ---------- */
const sec = document.getElementById('route')
if (sec) {
  const can3d = document.documentElement.classList.contains('can3d')
  const buttons = [...sec.querySelectorAll('.stop-list button')]
  const svgStops = [...sec.querySelectorAll('.route-svg .rs')]
  const detail = document.getElementById('stopDetail')
  let active = 0, r3 = null

  // 静态路线图上的犀鸟：站在当前站上，换站时跳过去
  const svg = sec.querySelector('.route-svg'), staticBox = sec.querySelector('.route-static')
  let rbird = null, birdAt = null
  if (svg && staticBox) {
    rbird = Object.assign(document.createElement('img'), { src: '/img/bird/hero.webp', alt: '', className: 'rbird', width: 593, height: 880 })
    rbird.setAttribute('aria-hidden', 'true')
    staticBox.appendChild(rbird)
  }
  const vb = svg ? svg.viewBox.baseVal : null
  const posOf = n => { const c = svgStops[n - 1].querySelector('circle'); return [c.cx.baseVal.value / vb.width * 100, c.cy.baseVal.value / vb.height * 100] }
  const hopStatic = n => {
    if (!rbird) return
    const [x, y] = posOf(n)
    const to = { left: x + '%', top: y + '%' }
    if (birdAt && !reduce && Math.abs(n - birdAt.n) <= 2) {
      const [fx, fy] = birdAt.xy
      rbird.animate([
        { left: fx + '%', top: fy + '%' },
        { left: (fx + x) / 2 + '%', top: Math.min(fy, y) - 14 + '%', offset: 0.5 },
        to
      ], { duration: 600, easing: 'ease-in-out' })
    }
    Object.assign(rbird.style, to)
    birdAt = { n, xy: [x, y] }
  }

  const setActive = n => {
    if (n === active) return
    active = n
    hopStatic(n)
    const s = STOPS[n - 1]
    buttons.forEach(b => b.setAttribute('aria-current', String(+b.dataset.n === n)))
    svgStops.forEach(g => g.classList.toggle('on', +g.dataset.n === n))
    detail.innerHTML = `<b>第 ${s.n} 站 · ${s.zh}</b> ${s.ms} · 第 ${s.from}–${s.to} 个词 · ${s.note} · ${s.open ? '已上线' : '整理中'}`
    if (r3) r3.setActive(n)
  }
  setActive(1)

  // 能放 3D 时，这一节很高、内容吸顶，滚动进度决定走到哪一站
  const progress = () => {
    const r = sec.getBoundingClientRect(), span = r.height - innerHeight
    return span > 0 ? Math.min(1, Math.max(0, -r.top / span)) : 0
  }
  const goTo = n => {
    if (!can3d) return setActive(n)
    const span = sec.offsetHeight - innerHeight
    scrollTo({ top: sec.getBoundingClientRect().top + scrollY + span * (n - 0.5) / STOPS.length, behavior: 'smooth' })
  }
  buttons.forEach(b => b.addEventListener('click', () => goTo(+b.dataset.n)))
  svgStops.forEach(g => g.addEventListener('click', () => goTo(+g.dataset.n)))

  if (can3d) {
    let ticking = false
    const onScroll = () => {
      if (ticking) return
      ticking = true
      requestAnimationFrame(() => {
        ticking = false
        const p = progress()
        setActive(Math.min(STOPS.length, Math.floor(p * STOPS.length) + 1))
        if (r3) r3.setProgress(p)
      })
    }
    addEventListener('scroll', onScroll, { passive: true })
    onScroll()

    // 滚到附近再加载 3D（three.js 约 170KB gzip），首屏不受影响
    const box = document.getElementById('route3d'), loading = document.getElementById('routeLoading')
    let started = false
    const load = () => {
      if (started) return
      started = true
      io.disconnect()
      loading.hidden = false
      import('./route3d.js')
        .then(m => m.init(box, STOPS))
        .then(api => {
          r3 = api
          r3.setActive(active); r3.setProgress(progress())
          box.hidden = false; box.classList.add('ready'); box.parentElement.classList.add('has3d')
          loading.hidden = true
        })
        .catch(err => { console.warn('3D 路线没加载成功，用静态路线图', err); loading.hidden = true })
    }
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) load() }, { rootMargin: '600px 0px' })
    io.observe(sec)
    // 首屏加载完、浏览器空闲时也预先加载，滚到路线时不用等
    addEventListener('load', () => setTimeout(() => (window.requestIdleCallback || setTimeout)(load), 2500))
  }
}

/* ---------- 首次进入：犀鸟从上面跳下来，带着看各章节 ----------
   只在第一次打开网站时出现（localStorage 记一下）；点 × 或看到页尾就结束。
   到十站路线那一节它会躲开，换路线图上的犀鸟带路。减少动效时不跳，只出现和换话。 */
const GUIDE_KEY = 'jb_guide_seen'
const seen = (() => { try { return localStorage.getItem(GUIDE_KEY) } catch (e) { return '1' } })()
if (!seen && !location.hash) {
  try { localStorage.setItem(GUIDE_KEY, '1') } catch (e) {}
  const LINES = [
    ['top', '嗨，我是犀鸟。跟着我往下看看'],
    ['how', '每个词，都按这五步来'],
    ['route', null],
    ['content', '一个词条里有这些'],
    ['team', '这些是做课的人'],
    ['who', '看看适不适合你'],
    ['faq', '有疑问，先看这里'],
    ['open', '最后，在微信里打开小程序就能学']
  ]
  const g = document.createElement('div')
  g.className = 'guide'
  g.innerHTML = '<p class="guide-say" aria-hidden="true"></p><img src="/img/bird/hero.webp" alt="" width="593" height="880"><button type="button" class="guide-x" aria-label="关闭犀鸟向导">×</button>'
  document.body.appendChild(g)
  const say = g.querySelector('.guide-say'), img = g.querySelector('img')
  const hop = () => { if (!reduce) img.animate([{ transform: 'translateY(0) scale(1,1)' }, { transform: 'translateY(-36px) scale(.96,1.04)', offset: .45 }, { transform: 'translateY(0) scale(1.06,.94)', offset: .85 }, { transform: 'translateY(0) scale(1,1)' }], { duration: 560, easing: 'ease-out' }) }
  let cur = '', talkT = 0
  const show = id => {
    if (id === cur) return
    cur = id
    const line = (LINES.find(l => l[0] === id) || [])[1]
    g.classList.toggle('away', !line)
    if (!line) return
    say.textContent = line
    g.classList.add('talk')
    clearTimeout(talkT); talkT = setTimeout(() => g.classList.remove('talk'), 3500)  // 话只说一会儿，免得一直挡字
    hop()
    if (id === 'open') setTimeout(end, 6000)
  }
  const end = () => { g.classList.add('bye'); setTimeout(() => g.remove(), 600) }
  g.querySelector('.guide-x').addEventListener('click', end)
  // 先从屏幕上方跳下来
  g.classList.add('drop')
  setTimeout(() => { g.classList.remove('drop'); show('top') }, reduce ? 0 : 900)
  const ids = LINES.map(l => l[0]).filter(id => id !== 'top')
  const io = new IntersectionObserver(es => {
    const vis = es.filter(e => e.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0]
    if (vis && !g.classList.contains('drop')) show(vis.target.id)
  }, { rootMargin: '-35% 0px -45% 0px' })
  ids.forEach(id => { const el = document.getElementById(id); if (el) io.observe(el) })
  addEventListener('scroll', () => { if (scrollY < innerHeight * 0.3 && !g.classList.contains('drop')) show('top') }, { passive: true })
}
