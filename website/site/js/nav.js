// 顶栏开合(配合 scripts/build.mjs 生成的 <header id="nav">)
// 手机:Menu 展开整张清单,点链接收起;桌面:一级按钮点击展开(悬停 / 聚焦由 CSS 展开);Esc、点外面收起
const nav = document.getElementById('nav'), links = document.getElementById('links'), btn = document.getElementById('menuBtn')
if (nav && links && btn) {
  const LABEL = { open: '关闭', closed: '菜单' }
  const setMenu = open => { links.classList.toggle('open', open); btn.setAttribute('aria-expanded', String(open)); btn.textContent = open ? LABEL.open : LABEL.closed }
  const closeGroups = except => nav.querySelectorAll('.grp.open').forEach(g => { if (g !== except) { g.classList.remove('open'); g.querySelector('.grp-btn')?.setAttribute('aria-expanded', 'false') } })
  btn.addEventListener('click', () => setMenu(!links.classList.contains('open')))
  nav.querySelectorAll('.grp-btn').forEach(b => b.addEventListener('click', () => {
    const g = b.closest('.grp'), open = !g.classList.contains('open')
    closeGroups(g); g.classList.toggle('open', open); b.setAttribute('aria-expanded', String(open))
  }))
  links.addEventListener('click', e => { if (e.target.closest('a')) { setMenu(false); closeGroups() } })
  document.addEventListener('click', e => { if (!e.target.closest('.grp')) closeGroups() })
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return
    const g = nav.querySelector('.grp.open')
    if (g) { closeGroups(); g.querySelector('.grp-btn')?.focus() } else if (links.classList.contains('open')) { setMenu(false); btn.focus() }
  })
  matchMedia('(min-width: 1081px)').addEventListener('change', e => { if (e.matches) setMenu(false) })
}

// 滚动出现动效:元素进入视口时加 .in;不支持或减少动效时直接显示
document.documentElement.classList.add('js')
const revealEls = document.querySelectorAll('.reveal')
if (!('IntersectionObserver' in window) || matchMedia('(prefers-reduced-motion: reduce)').matches) {
  revealEls.forEach(el => el.classList.add('in'))
} else {
  const io = new IntersectionObserver(entries => entries.forEach(e => {
    if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target) }
  }), { threshold: 0.18 })
  revealEls.forEach(el => io.observe(el))
}
