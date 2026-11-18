// 十站 3D 路线：马来半岛 + 东马的低多边形地形，一条琥珀色路线从吉隆坡走到亚庇。
// 滚动推进：路线逐段画出来，镜头跟着走，经过的站变亮，当前站最亮。不自己转、不闪。
// 只在需要时渲染（滚动或镜头还在缓动时），离开视口就停。
import * as THREE from './vendor/three.module.min.js'
import { LAND, project } from './route-data.js'

const C = { land: 0x2b6c69, landSide: 0x174a4e, route: 0xe9a75f, paper: 0xf7f2e8, future: 0x9fbcb7, tower: 0xf3ebdc, hill: 0x3f8a6c }

export function init(box, stops) {
  const canvas = box.querySelector('canvas'), labelsEl = box.querySelector('.r3-labels')
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'low-power' })
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(30, 16 / 10, 0.1, 200)

  scene.add(new THREE.HemisphereLight(0xfdf3e1, 0x0b2b2f, 1.5))
  const sun = new THREE.DirectionalLight(0xfff0d8, 1.8)
  sun.position.set(-8, 14, 10)
  scene.add(sun)

  // 地形：海岸线挤出成薄片
  const DEPTH = 0.16
  const landMats = [new THREE.MeshLambertMaterial({ color: C.land }), new THREE.MeshLambertMaterial({ color: C.landSide })]
  for (const ring of Object.values(LAND)) {
    const shape = new THREE.Shape(ring.map(([lo, la]) => { const [x, z] = project(lo, la); return new THREE.Vector2(x, -z) }))
    const g = new THREE.ExtrudeGeometry(shape, { depth: DEPTH, bevelEnabled: false })
    g.rotateX(-Math.PI / 2)
    scene.add(new THREE.Mesh(g, landMats))
  }
  const at = (lo, la, y = DEPTH) => { const [x, z] = project(lo, la); return new THREE.Vector3(x, y, z) }

  // 几个克制的地标：吉隆坡双子塔、金马伦的山、亚庇的神山
  const towerMat = new THREE.MeshLambertMaterial({ color: C.tower })
  const kl = at(stops[0].lon, stops[0].lat)
  for (const dx of [-0.09, 0.09]) {
    const t = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.06, 0.9, 8), towerMat)
    t.position.set(kl.x + dx - 0.35, DEPTH + 0.45, kl.z - 0.25); scene.add(t)
    const s = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.22, 6), towerMat)
    s.position.set(kl.x + dx - 0.35, DEPTH + 1.0, kl.z - 0.25); scene.add(s)
  }
  const hillMat = new THREE.MeshLambertMaterial({ color: C.hill, flatShading: true })
  const hill = (lo, la, r, h, dx = 0, dz = 0) => { const m = new THREE.Mesh(new THREE.ConeGeometry(r, h, 7), hillMat); const p = at(lo, la, DEPTH + h / 2); m.position.set(p.x + dx, p.y, p.z + dz); scene.add(m) }
  const cam = stops[4]
  hill(cam.lon, cam.lat, 0.32, 0.5, 0.35, -0.2); hill(cam.lon, cam.lat, 0.26, 0.38, 0.65, 0.1); hill(cam.lon, cam.lat, 0.22, 0.3, 0.2, 0.3)
  const kk = stops[9]
  hill(kk.lon, kk.lat, 0.5, 1.0, 0.6, 0.55)

  // 路线：经过十站的平滑曲线，跨海那一段抬高成弧线
  const Y = DEPTH + 0.12
  const pts = []
  stops.forEach((s, i) => {
    const p = at(s.lon, s.lat, Y)
    pts.push(p)
    if (i === 7) { // 哥打巴鲁 → 古晋，飞过南中国海
      const q = at(stops[8].lon, stops[8].lat, Y)
      for (const t of [0.25, 0.5, 0.75]) pts.push(new THREE.Vector3().lerpVectors(p, q, t).setY(Y + Math.sin(t * Math.PI) * 1.6))
    }
  })
  const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal')
  const SEG = 800, RAD = 8
  const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, SEG, 0.055, RAD, false), new THREE.MeshLambertMaterial({ color: C.route, emissive: 0x6b3a0c, emissiveIntensity: 0.35 }))
  scene.add(tube)
  const ghost = new THREE.Line(new THREE.BufferGeometry().setFromPoints(curve.getSpacedPoints(600)), new THREE.LineDashedMaterial({ color: C.paper, dashSize: 0.08, gapSize: 0.12, transparent: true, opacity: 0.35 }))
  ghost.computeLineDistances()
  scene.add(ghost)

  // 每站在曲线上的位置（弧长比例）
  const samples = curve.getSpacedPoints(2000)
  const stopU = stops.map(s => {
    const p = at(s.lon, s.lat, Y)
    let best = 0, bd = Infinity
    samples.forEach((q, i) => { const d = q.distanceToSquared(p); if (d < bd) { bd = d; best = i } })
    return best / 2000
  })

  // 站点：地上一圈印章 + 立着的小圆牌
  const markers = stops.map(s => {
    const g = new THREE.Group()
    const p = at(s.lon, s.lat)
    g.position.set(p.x, DEPTH, p.z)
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.025, 8, 40), new THREE.MeshLambertMaterial({ color: C.route }))
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.02
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.42, 6), new THREE.MeshLambertMaterial({ color: C.paper }))
    post.position.y = 0.21
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.075, 20, 14), new THREE.MeshLambertMaterial({ color: C.future }))
    head.position.y = 0.46
    g.add(ring, post, head)
    scene.add(g)
    return { g, ring, head }
  })

  // HTML 标签（清楚、可缩放）：只显示当前站，相邻站离得太近会叠在一起
  const labels = stops.map(s => { const el = document.createElement('span'); el.textContent = `${s.n} ${s.zh}`; labelsEl.appendChild(el); return el })

  let target = 0, cur = 0, active = 1, raf = 0, visible = true, w = 0, h = 0
  const tmp = new THREE.Vector3(), look = new THREE.Vector3(), camPos = new THREE.Vector3()

  // 连续进度 p（0–1）→ 路线画到哪里：每站占一段，站的中间正好走到这一站
  const uOf = p => {
    const q = Math.min(stops.length - 1, Math.max(0, p * stops.length - 0.5))
    const i = Math.floor(q), f = q - i
    return i >= stops.length - 1 ? stopU[i] : stopU[i] + (stopU[i + 1] - stopU[i]) * f
  }

  function frame() {
    raf = 0
    cur += (target - cur) * 0.09
    if (Math.abs(target - cur) < 1e-4) cur = target
    const u = Math.max(0.002, uOf(cur))
    tube.geometry.setDrawRange(0, Math.floor(u * SEG) * RAD * 6)

    curve.getPointAt(Math.min(u, 1), look)
    look.y = DEPTH
    const sway = Math.sin(cur * Math.PI) * 1.2
    camPos.set(look.x - 2 + sway, look.y + 13, look.z + 9.5)
    camera.position.copy(camPos)
    camera.lookAt(look.x, look.y, look.z - 0.6)

    markers.forEach((m, i) => {
      const n = i + 1, on = n === active, done = n < active
      m.head.material.color.setHex(on ? 0xffffff : done ? C.route : C.future)
      const k = on ? 1.6 : done ? 1.15 : 1
      m.head.scale.setScalar(m.head.scale.x + (k - m.head.scale.x) * 0.2)
      m.ring.material.color.setHex(on || done ? C.route : C.future)
    })
    renderer.render(scene, camera)

    labels.forEach((el, i) => {
      const n = i + 1
      if (n !== active) { el.style.display = 'none'; return }
      tmp.copy(markers[i].g.position); tmp.y += 0.55
      tmp.project(camera)
      if (tmp.z > 1 || Math.abs(tmp.x) > 1.05 || Math.abs(tmp.y) > 1.05) { el.style.display = 'none'; return }
      el.style.display = ''
      el.className = n === active ? 'on' : ''
      el.style.transform = `translate(${((tmp.x + 1) / 2 * w).toFixed(1)}px,${((1 - tmp.y) / 2 * h).toFixed(1)}px) translate(-50%,-130%)`
    })

    const settling = cur !== target || markers.some((m, i) => Math.abs(m.head.scale.x - (i + 1 === active ? 1.6 : i + 1 < active ? 1.15 : 1)) > 0.005)
    if (settling && visible) raf = requestAnimationFrame(frame)
  }
  const kick = () => { if (!raf && visible) raf = requestAnimationFrame(frame) }

  const resize = () => {
    w = box.clientWidth; h = box.clientHeight
    if (!w || !h) return
    renderer.setSize(w, h, false)
    camera.aspect = w / h
    camera.updateProjectionMatrix()
    kick()
  }
  new ResizeObserver(resize).observe(box)
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; kick() }).observe(box)
  canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); box.hidden = true; box.parentElement.classList.remove('has3d') })

  return new Promise(resolve => {
    box.hidden = false   // 先让它有尺寸
    resize()
    cur = target
    frame()
    resolve({
      setProgress(p) { target = p; kick() },
      setActive(n) { active = n; kick() }
    })
  })
}
