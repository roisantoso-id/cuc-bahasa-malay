// 静态十站路线图（SVG）：没有 3D 的时候（手机、低性能、减少动效、WebGL 不可用、没开 JS）显示它。
// 数据和 3D 场景共用 site/js/route-data.js。build.mjs 把它替换进页面里的 <!--ROUTE_SVG-->。
import { STOPS, LAND, project } from '../site/js/route-data.js'

const S = 50, PAD = 44
const pts = [...LAND.peninsula, ...LAND.borneo, ...STOPS.map(s => [s.lon, s.lat])].map(([lo, la]) => project(lo, la))
const minX = Math.min(...pts.map(p => p[0])), maxX = Math.max(...pts.map(p => p[0]))
const minY = Math.min(...pts.map(p => p[1])), maxY = Math.max(...pts.map(p => p[1]))
const W = Math.round((maxX - minX) * S + PAD * 2), H = Math.round((maxY - minY) * S + PAD * 2)
const xy = (lo, la) => { const [x, y] = project(lo, la); return [+((x - minX) * S + PAD).toFixed(1), +((y - minY) * S + PAD).toFixed(1)] }
const poly = ring => 'M' + ring.map(([lo, la]) => xy(lo, la).join(' ')).join('L') + 'Z'

// 经过各站的平滑曲线（Catmull-Rom 转三次贝塞尔）；跨海那一段（8→9）单独画成弧线
const P = STOPS.map(s => xy(s.lon, s.lat))
function smooth(points) {
  let d = `M${points[0].join(' ')}`
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] || points[i], p1 = points[i], p2 = points[i + 1], p3 = points[i + 2] || p2
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6], c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6]
    d += `C${c1.map(v => v.toFixed(1)).join(' ')} ${c2.map(v => v.toFixed(1)).join(' ')} ${p2.join(' ')}`
  }
  return d
}
const land = smooth(P.slice(0, 8)), east = smooth(P.slice(8))
const [a, b] = [P[7], P[8]]
const sea = `M${a.join(' ')}Q${((a[0] + b[0]) / 2).toFixed(1)} ${(Math.min(a[1], b[1]) - 150).toFixed(1)} ${b.join(' ')}`

export function routeSvg() {
  const stops = STOPS.map((s, i) => {
    const [x, y] = P[i]
    const below = [2, 5, 9].includes(s.n) // 标签放下方，避免和相邻站挤在一起
    const ty = below ? y + 40 : y - 26
    return `<g class="rs${s.open ? '' : ' off'}" data-n="${s.n}"><circle cx="${x}" cy="${y}" r="15"/><text class="rs-n" x="${x}" y="${y}" dy=".35em">${s.n}</text><text class="rs-l" x="${x}" y="${ty}">${s.zh}</text></g>`
  }).join('')
  return `<svg class="route-svg" viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="routeSvgT">
<title id="routeSvgT">十站学习路线图：从吉隆坡出发，经马六甲、怡保、槟城、金马伦、关丹、瓜拉登嘉楼、哥打巴鲁，跨海到古晋，终点亚庇</title>
<path class="land" d="${poly(LAND.peninsula)}"/><path class="land" d="${poly(LAND.borneo)}"/>
<path class="rt" d="${land}"/><path class="rt rt-sea" d="${sea}"/><path class="rt" d="${east}"/>
${stops}
</svg>`
}
