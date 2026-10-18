// 官网构建:复制 site/ → dist/,注入顶栏 / 页脚 / 配置,css/js 加内容版本号,生成 sitemap。零依赖。
// node scripts/build.mjs
// 占位符:<!--NAV--> <!--FOOT--> {{SITE_X}}(content/site.json 的 x 字段)
//        <!--IF_SITE_X-->…<!--/IF_SITE_X-->(有值保留,无值整段删)
//        <!--IFNOT_SITE_X-->…<!--/IFNOT_SITE_X-->(无值才保留)
import { createHash } from 'node:crypto'
import { cpSync, existsSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SRC = join(ROOT, 'site')
const OUT = join(ROOT, 'dist')
const SITE = JSON.parse(readFileSync(join(ROOT, 'content/site.json'), 'utf8'))
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
const val = k => SITE[k.toLowerCase()] ?? ''

// 导航唯一来源。页面清单见 docs/页面清单.md,加页面两边一起改。
const NAV = [
  { href: '/courses/', t: '学什么' },
  { href: '/about/', t: '关于我们' },
]
const CTA = ['/#open', '打开小程序']

const renderNav = path => `<header class="nav" id="nav"><div class="wrap">
  <a class="brand" href="/"><img src="/img/avatar.jpg" alt="" width="36" height="36">${esc(SITE.brand)}</a>
  <nav aria-label="主导航"><ul class="links" id="links">${NAV.map(i => `<li><a href="${i.href}"${path.startsWith(i.href) ? ' aria-current="page"' : ''}>${esc(i.t)}</a></li>`).join('')}</ul></nav>
  <div class="nav-cta"><a class="btn btn-main nav-main" href="${CTA[0]}"><span class="t">${esc(CTA[1])}</span></a>
  <button class="menu-btn" id="menuBtn" type="button" aria-expanded="false" aria-controls="links">菜单</button></div>
</div></header>`

const renderFoot = () => `<footer class="foot"><div class="wrap">
  <div class="fnav">
    <div><h4>学习</h4><ul><li><a href="/#open">打开小程序</a></li><li><a href="/courses/">学什么</a></li></ul></div>
    <div><h4>关于</h4><ul><li><a href="/about/">关于我们</a></li><li><a href="/privacy/">隐私政策</a></li></ul></div>
  </div>
  <p class="muted">课程主持：张静灵（中国传媒大学马来语专业教师）</p>
  <p class="muted">技术支持：<a href="https://jobtalentai.com/zh/team/" target="_blank" rel="noopener">Santoso · JobTalent AI</a></p>
  <p class="muted">© ${new Date().getFullYear()} ${esc(SITE.operator || SITE.brand)}${SITE.icp ? ` · <a href="https://beian.miit.gov.cn/" target="_blank" rel="noopener">${esc(SITE.icp)}</a>` : ''}</p>
</div></footer>`

rmSync(OUT, { recursive: true, force: true })
cpSync(SRC, OUT, { recursive: true })
const walk = d => readdirSync(d).flatMap(f => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : [p] })
const hashes = new Map()
const ver = url => {
  if (!hashes.has(url)) { const f = join(OUT, url); hashes.set(url, existsSync(f) ? createHash('sha1').update(readFileSync(f)).digest('hex').slice(0, 10) : null) }
  return hashes.get(url)
}

const errors = []
const pages = []
for (const f of walk(OUT).filter(f => f.endsWith('.html'))) {
  const path = '/' + f.slice(OUT.length + 1).replace(/index\.html$/, '')
  let h = readFileSync(f, 'utf8')
  h = h.replace('<!--NAV-->', renderNav(path)).replace('<!--FOOT-->', renderFoot())
  for (let prev; prev !== h;) {   // 条件块可以嵌套,替换到不再变化为止
    prev = h
    h = h.replace(/<!--IF_SITE_(\w+)-->([\s\S]*?)<!--\/IF_SITE_\1-->\n?/g, (m, k, inner) => (val(k) ? inner : ''))
    h = h.replace(/<!--IFNOT_SITE_(\w+)-->([\s\S]*?)<!--\/IFNOT_SITE_\1-->\n?/g, (m, k, inner) => (val(k) ? '' : inner))
  }
  h = h.replace(/\{\{SITE_(\w+)\}\}/g, (m, k) => esc(val(k)))
  h = h.replace(/((?:href|src)=")(\/[\w/.-]+\.(?:css|m?js))(")/g, (m, a, url, z) => (ver(url) ? `${a}${url}?v=${ver(url)}${z}` : m))
  for (const left of h.match(/<!--(NAV|FOOT|IF_|IFNOT_|\/IF)[^>]*-->|\{\{[A-Z_]+\}\}/g) || []) errors.push(`${path}: 残留 ${left}`)
  writeFileSync(f, h)
  if (!/name="robots" content="noindex"/.test(h)) pages.push(path)
}
if (errors.length) { console.error(errors.join('\n')); process.exit(1) }

// sitemap / robots:没配网址就不生成 sitemap
const base = SITE.site_url.replace(/\/$/, '')
if (base) {
  writeFileSync(join(OUT, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${pages.sort().map(p => `  <url><loc>${base}${p}</loc><lastmod>${SITE.updated}</lastmod></url>`).join('\n')}\n</urlset>\n`)
}
writeFileSync(join(OUT, 'robots.txt'), `User-agent: *\nAllow: /\n${base ? `Sitemap: ${base}/sitemap.xml\n` : ''}`)
console.log(`OK → dist/(${pages.length} 页)`)
