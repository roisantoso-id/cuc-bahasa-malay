// 首页 3D 旅程地图（小程序 WebGL，three.js r108 微信适配版）。
// 和官网 route3d.js 是同一套场景：真实海岸线压成的薄片地形、琥珀色路线、十个站牌、犀鸟站在当前站。
// 进入时镜头从半岛上空滑到当前站，犀鸟从第一站跳过来；之后只在拖动时重画，不常驻动画，省电。
// 首页用 require.async 异步加载本文件（在 pkg-word 分包里，主包不变大）。
const { createScopedThreejs } = require('./three')
const { STOPS, LAND } = require('./route-data')

const project = (lon, lat) => [(lon - 102.5) * 1.5, (4.2 - lat) * 1.5]
const C = { land: 0x2b6c69, landSide: 0x174a4e, near: 0x1d5156, nearSide: 0x143f44, route: 0xe9a75f, paper: 0xf7f2e8, future: 0x9fbcb7, done: 0xe9a75f, tower: 0xf3ebdc, hill: 0x3f8a6c }

// opts: { width, height, dpr, current: 当前站 1–10, stamped: [已盖章的站], open: [已上线的站] }
function start(canvas, opts) {
  const THREE = createScopedThreejs(canvas)
  const { width, height, dpr } = opts
  canvas.width = width * dpr
  canvas.height = height * dpr
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true })
  renderer.setPixelRatio(dpr)
  renderer.setSize(width, height)
  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(32, width / height, 0.1, 200)
  scene.add(new THREE.HemisphereLight(0xfdf3e1, 0x0b2b2f, 1.4))
  const sun = new THREE.DirectionalLight(0xfff0d8, 1.6)
  sun.position.set(-8, 14, 10)
  scene.add(sun)

  const DEPTH = 0.16
  const addLand = (ring, top, side, depth) => {
    const shape = new THREE.Shape(ring.map(([lo, la]) => { const [x, z] = project(lo, la); return new THREE.Vector2(x, -z) }))
    const g = new THREE.ExtrudeBufferGeometry(shape, { depth, bevelEnabled: false })
    g.rotateX(-Math.PI / 2)
    scene.add(new THREE.Mesh(g, [new THREE.MeshLambertMaterial({ color: top }), new THREE.MeshLambertMaterial({ color: side })]))
  }
  LAND.near.forEach(r => addLand(r, C.near, C.nearSide, DEPTH * 0.5))
  LAND.my.forEach(r => addLand(r, C.land, C.landSide, DEPTH))
  const at = (lon, lat, y = DEPTH) => { const [x, z] = project(lon, lat); return new THREE.Vector3(x, y, z) }

  // 地标：双子塔、金马伦的山、神山
  const towerMat = new THREE.MeshLambertMaterial({ color: C.tower })
  const kl = at(STOPS[0].lon, STOPS[0].lat)
  ;[-0.09, 0.09].forEach(dx => {
    const t = new THREE.Mesh(new THREE.CylinderBufferGeometry(0.045, 0.06, 0.9, 8), towerMat)
    t.position.set(kl.x + dx - 0.35, DEPTH + 0.45, kl.z - 0.25); scene.add(t)
  })
  const hillMat = new THREE.MeshLambertMaterial({ color: C.hill, flatShading: true })
  const hill = (s, r, h, dx, dz) => { const m = new THREE.Mesh(new THREE.ConeBufferGeometry(r, h, 7), hillMat); const p = at(s.lon, s.lat, DEPTH + h / 2); m.position.set(p.x + dx, p.y, p.z + dz); scene.add(m) }
  hill(STOPS[4], 0.32, 0.5, 0.35, -0.2); hill(STOPS[4], 0.26, 0.38, 0.65, 0.1)
  hill(STOPS[9], 0.5, 1.0, 0.6, 0.55)

  // 路线：已走过的部分实心琥珀色，没走到的是虚线
  const Y = DEPTH + 0.12
  const pts = []
  STOPS.forEach((s, i) => {
    const p = at(s.lon, s.lat, Y)
    pts.push(p)
    if (i === 7) {
      const q = at(STOPS[8].lon, STOPS[8].lat, Y)
      ;[0.25, 0.5, 0.75].forEach(t => pts.push(new THREE.Vector3().lerpVectors(p, q, t).setY(Y + Math.sin(t * Math.PI) * 1.6)))
    }
  })
  const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal')
  const samples = curve.getSpacedPoints(1000)
  const stopU = STOPS.map(s => {
    const p = at(s.lon, s.lat, Y)
    let best = 0, bd = Infinity
    samples.forEach((q, i) => { const d = q.distanceToSquared(p); if (d < bd) { bd = d; best = i } })
    return best / 1000
  })
  const cur = Math.min(10, Math.max(1, opts.current || 1))
  const SEG = 500, RAD = 8
  const tube = new THREE.Mesh(new THREE.TubeBufferGeometry(curve, SEG, 0.055, RAD, false), new THREE.MeshLambertMaterial({ color: C.route, emissive: 0x6b3a0c, emissiveIntensity: 0.35 }))
  scene.add(tube)
  const ghost = new THREE.Line(new THREE.BufferGeometry().setFromPoints(samples), new THREE.LineDashedMaterial({ color: C.paper, dashSize: 0.08, gapSize: 0.12, transparent: true, opacity: 0.35 }))
  ghost.computeLineDistances()
  scene.add(ghost)

  // 站牌：盖过章的琥珀色，当前站白色，没上线的灰色
  const stamped = new Set(opts.stamped || []), open = new Set(opts.open || [])
  STOPS.forEach((s, i) => {
    const n = i + 1, p = at(s.lon, s.lat)
    const color = n === cur ? 0xffffff : stamped.has(n) || n < cur ? C.done : open.has(n) ? C.paper : C.future
    const ring = new THREE.Mesh(new THREE.TorusBufferGeometry(0.2, 0.025, 8, 32), new THREE.MeshLambertMaterial({ color: n <= cur || stamped.has(n) ? C.route : C.future }))
    ring.rotation.x = -Math.PI / 2; ring.position.set(p.x, DEPTH + 0.02, p.z); scene.add(ring)
    if (n === cur) return // 当前站站着犀鸟
    const post = new THREE.Mesh(new THREE.CylinderBufferGeometry(0.012, 0.012, 0.42, 6), new THREE.MeshLambertMaterial({ color: C.paper }))
    post.position.set(p.x, DEPTH + 0.21, p.z); scene.add(post)
    const head = new THREE.Mesh(new THREE.SphereBufferGeometry(0.075, 16, 12), new THREE.MeshLambertMaterial({ color }))
    head.position.set(p.x, DEPTH + 0.46, p.z); scene.add(head)
  })

  // 犀鸟
  const BIRD_H = 0.95
  const birdMat = new THREE.SpriteMaterial({ transparent: true, alphaTest: 0.05 })
  const bird = new THREE.Sprite(birdMat)
  bird.center.set(0.5, 0)
  bird.scale.set(BIRD_H * 200 / 297, BIRD_H, 1)
  bird.visible = false
  scene.add(bird)
  new THREE.TextureLoader().load('/pkg-word/three/bird.png', tex => { birdMat.map = tex; birdMat.needsUpdate = true; bird.visible = true; kick() })
  const standAt = n => at(STOPS[n - 1].lon, STOPS[n - 1].lat, DEPTH + 0.06)

  // 动画：镜头从当前站的上一段滑过来，路线画到当前站，犀鸟从上一站跳过来
  const from = Math.max(1, cur - 1)
  let t0 = 0, pan = 0, dead = false, raf = 0
  const INTRO = 1600
  const look = new THREE.Vector3()
  const ease = t => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2
  function frame(now) {
    raf = 0
    if (dead) return
    if (!t0) t0 = now
    const k = Math.min(1, (now - t0) / INTRO), e = ease(k)
    const u = stopU[from - 1] + (stopU[cur - 1] - stopU[from - 1]) * e
    tube.geometry.setDrawRange(0, Math.max(1, Math.floor(u * SEG)) * RAD * 6)
    curve.getPointAt(Math.min(u, 1), look)
    look.y = DEPTH
    look.x += pan
    camera.position.set(look.x - 2, look.y + 11 - e * 1.5, look.z + 9)
    camera.lookAt(look.x, look.y, look.z - 0.6)
    // 犀鸟在后半段跳过去
    const hk = Math.min(1, Math.max(0, (k - 0.45) / 0.55))
    const a = standAt(from), b = standAt(cur)
    bird.position.lerpVectors(a, b, ease(hk))
    bird.position.y += Math.sin(hk * Math.PI) * (from === cur ? 0.35 : 0.9)
    renderer.render(scene, camera)
    if (k < 1) raf = canvas.requestAnimationFrame(frame)
  }
  const kick = () => { if (!raf && !dead) raf = canvas.requestAnimationFrame(frame) }
  kick()

  return {
    // 左右拖动：沿东西方向看看别的站（限制在马来西亚范围内）
    drag(dxPx) { pan = Math.max(-6, Math.min(16, pan - dxPx / width * 6)); kick() },
    destroy() { dead = true; if (raf) canvas.cancelAnimationFrame(raf); renderer.dispose() }
  }
}

module.exports = { start }
