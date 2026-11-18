// 十站 3D 路线：马来半岛 + 东马的低多边形地形，一条琥珀色路线从吉隆坡走到亚庇。
// 滚动推进：路线逐段画出来，镜头跟着走，经过的站变亮，当前站最亮。不自己转、不闪。
// 只在需要时渲染（滚动或镜头还在缓动时），离开视口就停。
import * as THREE from './vendor/three.module.min.js'
import { LAND, project, BUG_URL } from './route-data.js'

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
  const nearMats = [new THREE.MeshLambertMaterial({ color: 0x1d5156 }), new THREE.MeshLambertMaterial({ color: 0x143f44 })]
  const addLand = (ring, mats, depth) => {
    const shape = new THREE.Shape(ring.map(([lo, la]) => { const [x, z] = project(lo, la); return new THREE.Vector2(x, -z) }))
    const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false })
    g.rotateX(-Math.PI / 2)
    scene.add(new THREE.Mesh(g, mats))
  }
  LAND.near.forEach(r => addLand(r, nearMats, DEPTH * 0.5))   // 周边国家：矮一点、暗一点
  LAND.my.forEach(r => addLand(r, landMats, DEPTH))
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

  // 犀鸟：站在当前站上，换站时跳过去（抛物线），只在换站时动
  const BIRD_H = 0.95
  const birdTex = new THREE.TextureLoader().load('/img/bird/hero.webp', () => kick())
  birdTex.colorSpace = THREE.SRGBColorSpace
  const bird = new THREE.Sprite(new THREE.SpriteMaterial({ map: birdTex, transparent: true, alphaTest: 0.05 }))
  bird.scale.set(BIRD_H * 593 / 880, BIRD_H, 1)
  bird.center.set(0.5, 0)
  scene.add(bird)
  const standAt = n => markers[n - 1].g.position.clone().setY(DEPTH + 0.06)
  let hopFrom = standAt(1), hopTo = hopFrom.clone(), hopT = 1, hopStart = 0

  // 每站一只小虫：还没到的站有虫，到了站犀鸟低头一啄，虫就没了；往回滚，前面的虫又回来
  const bugTex = new THREE.TextureLoader().load(BUG_URL, () => kick())
  bugTex.colorSpace = THREE.SRGBColorSpace
  const BUG_W = 0.3, BUG_H = BUG_W * 48 / 64
  const bugs = markers.map(m => {
    const b = new THREE.Sprite(new THREE.SpriteMaterial({ map: bugTex, transparent: true, alphaTest: 0.05 }))
    b.center.set(0.5, 0)
    b.position.copy(m.g.position).add(new THREE.Vector3(-0.3, 0.02, 0.06))
    b.scale.set(BUG_W, BUG_H, 1)
    scene.add(b)
    return { b, s: 1 }
  })
  let peckT = 1, peckStart = 0, peckPending = true, eaten = 0   // eaten = 当前站的虫已经被吃掉
  const PECK_MS = 520
  const bugTarget = i => { const n = i + 1; return n > active ? 1 : n < active ? 0 : (eaten === n ? 0 : 1) }
  const HOP_MS = 650
  bird.position.copy(hopFrom)

  let target = 0, cur = 0, active = 1, raf = 0, visible = true, w = 0, h = 0
  const tmp = new THREE.Vector3(), look = new THREE.Vector3(), camPos = new THREE.Vector3()

  // 连续进度 p（0–1）→ 路线画到哪里：每站占一段滚动，前 60% 从上一站走过来，后 40% 停在这一站
  const N = stops.length
  const band = p => { const q = Math.min(N - 1e-6, Math.max(0, p * N)); const n = Math.floor(q) + 1; return [n, q - (n - 1)] }
  const ease = t => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2
  const uOf = p => {
    const [n, local] = band(p)
    return n === 1 ? stopU[0] : stopU[n - 2] + (stopU[n - 1] - stopU[n - 2]) * ease(Math.min(1, local / 0.6))
  }
  const stopOf = p => { const [n, local] = band(p); return n === 1 || local >= 0.6 ? n : n - 1 }
  const hopTo_ = n => {
    if (n === active) return
    hopFrom = bird.position.clone(); hopTo = standAt(n)
    hopT = 0; hopStart = performance.now()
    if (Math.abs(n - active) > 1) hopFrom = hopTo.clone()   // 一次跨好几站就直接落过去
    peckPending = true; peckT = 1; bird.material.rotation = 0
    active = n
  }

  function frame() {
    raf = 0
    cur += (target - cur) * 0.09
    if (Math.abs(target - cur) < 1e-4) cur = target
    hopTo_(stopOf(cur))   // 路线走到哪一站，犀鸟就跳到哪一站
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
      const k = on ? 0.001 : done ? 1.15 : 1
      m.head.scale.setScalar(m.head.scale.x + (k - m.head.scale.x) * 0.2)
      m.ring.material.color.setHex(on || done ? C.route : C.future)
    })
    if (hopT < 1) {
      hopT = Math.min(1, (performance.now() - hopStart) / HOP_MS)
      const e = hopT < 0.5 ? 2 * hopT * hopT : 1 - Math.pow(-2 * hopT + 2, 2) / 2
      bird.position.lerpVectors(hopFrom, hopTo, e)
      bird.position.y += Math.sin(hopT * Math.PI) * (0.6 + hopFrom.distanceTo(hopTo) * 0.18)
      const sq = 1 - Math.sin(hopT * Math.PI) * 0.08   // 起跳落地时微微压扁
      bird.scale.set(BIRD_H * 593 / 880 / sq, BIRD_H * sq, 1)
    }
    // 落地后啄虫：身子往前（左）一低再抬起来，低到一半时虫被吃掉
    if (hopT >= 1 && peckPending) { peckPending = false; peckT = 0; peckStart = performance.now() }
    if (peckT < 1) {
      peckT = Math.min(1, (performance.now() - peckStart) / PECK_MS)
      const k = Math.sin(peckT * Math.PI)
      bird.material.rotation = k * 0.55
      bird.position.copy(hopTo).add(new THREE.Vector3(-0.08 * k, 0, 0))
      if (peckT > 0.5) eaten = active
    }
    bugs.forEach((x, i) => {
      const t = bugTarget(i)
      x.s += (t - x.s) * (t ? 0.15 : 0.35)
      if (Math.abs(t - x.s) < 0.01) x.s = t
      x.b.scale.set(BUG_W * x.s, BUG_H * x.s, 1)
      x.b.visible = x.s > 0.01
    })
    renderer.render(scene, camera)

    labels.forEach((el, i) => {
      const n = i + 1
      if (n !== active) { el.style.display = 'none'; return }
      tmp.copy(markers[i].g.position); tmp.y += BIRD_H + 0.25
      tmp.project(camera)
      if (tmp.z > 1 || Math.abs(tmp.x) > 1.05 || Math.abs(tmp.y) > 1.05) { el.style.display = 'none'; return }
      el.style.display = ''
      el.className = n === active ? 'on' : ''
      el.style.transform = `translate(${((tmp.x + 1) / 2 * w).toFixed(1)}px,${((1 - tmp.y) / 2 * h).toFixed(1)}px) translate(-50%,-130%)`
    })

    const settling = hopT < 1 || peckT < 1 || peckPending || bugs.some((x, i) => x.s !== bugTarget(i)) || cur !== target || markers.some((m, i) => Math.abs(m.head.scale.x - (i + 1 === active ? 0.001 : i + 1 < active ? 1.15 : 1)) > 0.005)
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
      setActive() { kick() }   // 站点由滚动进度决定（frame 里），这里只触发重画
    })
  })
}
