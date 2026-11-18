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

  const setActive = n => {
    if (n === active) return
    active = n
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
