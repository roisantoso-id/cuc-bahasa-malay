// 图鉴星空：漫天星星绕着中心旋转，然后一颗颗飞过去，拼成今天学过的单词。拼好后触发 formed，页面再把可点的文字叠上来。
// Three.js 用微信官方适配版（pkg-word/lib/three.js），require.async 按需加载，不进主包。
// 不支持 WebGL 或加载失败：直接触发 formed，页面照常显示文字词云。
//
// 做法（threejs-particles skill）：
// - 一个 THREE.Points，固定容量的 Float32Array（位置 / 大小 / 亮度 / 颜色），每帧只改数组，不新建对象。
// - 目标点：离屏 2D canvas 按页面词云同样的位置和字号把单词画出来，读像素取点，每个点就是一颗星的落点。
// - 加法混合、不做深度测试，透明点不用排序；点的大小有上限，手机上不卡。
const MAX_TARGET = 1400   // 拼字用的星星上限
const EXTRA = 420         // 不拼字、一直在背景里慢慢转的星星
const SWIRL = 1300        // 先旋转多久（毫秒）
const FLY = 1300          // 飞向单词用多久（每颗另有随机延迟）
const SPREAD = 500        // 起飞延迟的随机范围

const ease = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)
// 固定种子：同一组词每次进来星星的起点一样，方便比对和截图
function rng(seed) { let s = seed >>> 0 || 1; return () => ((s = (Math.imul(1664525, s) + 1013904223) >>> 0) / 4294967296) }

// 词的熟练度 b 0–4 对应颜色：越熟越接近金色
const TINT = [[0.95, 0.92, 0.84], [0.95, 0.92, 0.84], [0.98, 0.94, 0.86], [0.99, 0.9, 0.7], [0.91, 0.73, 0.38]]
// 白天版（纸色底）：叠加混合在浅底上看不见，改成正常混合的墨点，越熟越深，熟词用琥珀
const TINT_DAY = [[0.45, 0.5, 0.47], [0.33, 0.38, 0.35], [0.2, 0.26, 0.23], [0.12, 0.35, 0.26], [0.77, 0.43, 0.11]]
const isDay = () => require('../../utils/theme').isDay()

Component({
  properties: {
    words: { type: Array, value: [] },   // [{ ms, x, y, fs, b }]，坐标和字号与页面词云一致（px）
    width: { type: Number, value: 0 },
    height: { type: Number, value: 0 },
    play: { type: Number, value: 0 }      // 每次加 1 就重放一遍
  },
  observers: {
    'play, width, height': function (play) { if (play && this.data.width && this.data.height) this.start() }
  },
  lifetimes: {
    detached() { this.dispose() }
  },
  pageLifetimes: {
    hide() { this.paused = true },
    show() { if (this.paused) { this.paused = false; this.loop() } }
  },
  methods: {
    done() { if (!this.formedSent) { this.formedSent = true; this.triggerEvent('formed') } },

    async start() {
      this.formedSent = false
      try {
        if (!this.THREE) {
          const mod = await require.async('../../pkg-word/lib/three.js')
          const canvas = await new Promise((ok, bad) => this.createSelectorQuery().select('#sky').node().exec(r => (r && r[0] && r[0].node ? ok(r[0].node) : bad(new Error('no canvas')))))
          this.canvas = canvas
          this.THREE = mod.createScopedThreejs(canvas)
        }
        this.build()
        this.t0 = 0
        this.paused = false
        this.loop()
      } catch (e) {
        console.warn('star-cloud: 用文字词云代替', e)
        this.done()
      }
    },

    // 按页面词云的摆放，把单词画到离屏 canvas，再取亮的像素当落点
    targets(W, H) {
      const words = this.data.words || []
      if (!words.length || !wx.createOffscreenCanvas) return []
      const oc = wx.createOffscreenCanvas({ type: '2d', width: Math.ceil(W), height: Math.ceil(H) })
      const g = oc.getContext('2d')
      g.clearRect(0, 0, W, H)
      g.textBaseline = 'top'
      const owner = new Uint8Array(Math.ceil(W) * Math.ceil(H))
      words.forEach((w, i) => {
        g.font = `italic ${w.b >= 4 ? 700 : 400} ${w.fs}px Georgia, "Times New Roman", serif`
        g.fillStyle = '#fff'
        // 页面文字有 padding 2px 4px、行高 1.2，这里对齐到同一位置
        g.fillText(w.ms, w.x + 4, w.y + 2 + w.fs * 0.1)
        const tw = Math.ceil(g.measureText(w.ms).width) + 8, th = Math.ceil(w.fs * 1.3)
        for (let y = Math.max(0, w.y); y < Math.min(H, w.y + th); y++) for (let x = Math.max(0, w.x); x < Math.min(W, w.x + tw); x++) owner[y * Math.ceil(W) + x] = i + 1
      })
      const img = g.getImageData(0, 0, Math.ceil(W), Math.ceil(H)).data
      const pts = []
      const step = 2
      for (let y = 0; y < H; y += step) for (let x = 0; x < W; x += step) {
        const k = y * Math.ceil(W) + x
        if (img[k * 4 + 3] > 140) pts.push([x, y, (owner[k] || 1) - 1])
      }
      // 太多就均匀抽一部分，保证每个词都有星星
      if (pts.length <= MAX_TARGET) return pts
      const r = rng(pts.length), out = []
      const keep = MAX_TARGET / pts.length
      for (const p of pts) if (r() < keep) out.push(p)
      return out
    },

    build() {
      const THREE = this.THREE, canvas = this.canvas
      const W = this.data.width, H = this.data.height
      const info = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync()
      const dpr = Math.min(2, info.pixelRatio || 2)
      this.disposeScene()
      canvas.width = Math.round(W * dpr)
      canvas.height = Math.round(H * dpr)
      if (!this.renderer) {
        this.renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false })
        this.renderer.setClearColor(0x000000, 0)
      }
      this.renderer.setPixelRatio(1)
      this.renderer.setSize(canvas.width, canvas.height, false)
      // 正交相机，单位就是页面 px，y 朝下，和词云坐标一致
      this.camera = new THREE.OrthographicCamera(0, W, 0, H, -10, 10)
      this.scene = new THREE.Scene()

      const tg = this.targets(W, H)
      const words = this.data.words || []
      const n = tg.length + EXTRA
      const r = rng(1 + words.length * 7919 + tg.length)
      const cx = W / 2, cy = H / 2, R = Math.hypot(W, H) * 0.62
      // 每颗星：起点用极坐标（螺旋臂上），终点是字上的点；背景星没有终点
      const s = this.stars = {
        n, nt: tg.length,
        ang: new Float32Array(n), rad: new Float32Array(n), spin: new Float32Array(n),
        tx: new Float32Array(n), ty: new Float32Array(n), delay: new Float32Array(n), tw: new Float32Array(n)
      }
      const T = isDay() ? TINT_DAY : TINT
      const pos = new Float32Array(n * 3), size = new Float32Array(n), alpha = new Float32Array(n), color = new Float32Array(n * 3)
      for (let i = 0; i < n; i++) {
        const arm = i % 3
        const rr = Math.pow(r(), 0.7) * R
        s.rad[i] = rr
        s.ang[i] = arm * (Math.PI * 2 / 3) + rr / R * 4.2 + (r() - 0.5) * 0.9
        s.spin[i] = (0.35 + r() * 0.5) * (1.2 - rr / R * 0.6) // 里圈转得快
        s.tw[i] = r() * Math.PI * 2
        let c = T[1], sz = 1.6 + r() * 2.2
        if (i < tg.length) {
          const [x, y, wi] = tg[i]
          s.tx[i] = x; s.ty[i] = y
          s.delay[i] = r() * SPREAD + (x / W) * 260 // 从左往右陆续落下
          const b = (words[wi] && words[wi].b) || 0
          c = T[b]
          sz = 2.4 + b * 0.35 + r() * 0.8
        } else {
          s.tx[i] = -1
          c = r() < 0.15 ? T[4] : T[1]
        }
        size[i] = sz
        alpha[i] = i < tg.length ? 0.95 : 0.35 + r() * 0.45
        color.set(c, i * 3)
      }
      const geo = new THREE.BufferGeometry()
      this.aPos = new THREE.BufferAttribute(pos, 3)
      this.aAlpha = new THREE.BufferAttribute(alpha, 1)
      this.aSize = new THREE.BufferAttribute(size, 1)
      geo.addAttribute('position', this.aPos)
      geo.addAttribute('size', this.aSize)
      geo.addAttribute('alpha', this.aAlpha)
      geo.addAttribute('color', new THREE.BufferAttribute(color, 3))
      this.baseSize = size.slice()
      this.baseAlpha = alpha.slice()
      const mat = new THREE.ShaderMaterial({
        uniforms: { dpr: { value: dpr } },
        vertexShader: [
          'attribute float size; attribute float alpha; attribute vec3 color;',
          'varying float vA; varying vec3 vC; uniform float dpr;',
          'void main() { vA = alpha; vC = color;',
          '  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);',
          '  gl_PointSize = min(size * dpr * 2.6, 48.0); }'
        ].join('\n'),
        fragmentShader: [
          'precision mediump float; varying float vA; varying vec3 vC;',
          'void main() { float d = length(gl_PointCoord - 0.5);',
          '  float core = smoothstep(0.18, 0.0, d); float halo = smoothstep(0.5, 0.0, d) * 0.45;',
          '  float a = (core + halo) * vA; if (a < 0.01) discard;',
          '  gl_FragColor = vec4(vC * (0.7 + core * 0.6), a); }'
        ].join('\n'),
        transparent: true, depthTest: false, depthWrite: false, blending: isDay() ? THREE.NormalBlending : THREE.AdditiveBlending
      })
      this.points = new THREE.Points(geo, mat)
      this.points.frustumCulled = false
      this.scene.add(this.points)
      this.cx = cx; this.cy = cy
    },

    loop() {
      if (this.looping || !this.renderer || !this.stars) return
      this.looping = true
      const tick = now => {
        if (this.paused || !this.renderer || !this.stars) { this.looping = false; return }
        if (!this.t0) this.t0 = now
        // 拼好字以后只剩轻轻闪烁，隔帧画一次就够，省电
        this.n = (this.n || 0) + 1
        if (!this.formedSent || this.n % 3 === 0) this.frame(now - this.t0)
        this.raf = this.canvas.requestAnimationFrame(tick)
      }
      this.raf = this.canvas.requestAnimationFrame(tick)
    },

    frame(t) {
      const s = this.stars, p = this.aPos.array, a = this.aAlpha.array, z = this.aSize.array
      const cx = this.cx, cy = this.cy, sec = t / 1000
      const settle = t > SWIRL + FLY + SPREAD + 300
      for (let i = 0; i < s.n; i++) {
        // 螺旋位置：一直在转，越往后越慢
        const ang = s.ang[i] + s.spin[i] * (sec < 3 ? sec : 3 + (sec - 3) * 0.12)
        let x = cx + Math.cos(ang) * s.rad[i] * 1.15
        let y = cy + Math.sin(ang) * s.rad[i] * 0.72
        const tw = 0.75 + 0.25 * Math.sin(sec * 2.2 + s.tw[i])
        if (s.tx[i] >= 0) {
          const k = Math.min(1, Math.max(0, (t - SWIRL - s.delay[i]) / FLY))
          const e = ease(k)
          // 起飞时先往外荡一点再收回来，像被吸过去
          const swing = Math.sin(k * Math.PI) * 18
          x = x + (s.tx[i] - x) * e + Math.cos(ang + 1.57) * swing
          y = y + (s.ty[i] - y) * e + Math.sin(ang + 1.57) * swing
          z[i] = this.baseSize[i] * (1 + (1 - e) * 0.4) * (k >= 1 ? 0.9 + 0.1 * tw : 1)
          a[i] = this.baseAlpha[i] * (k >= 1 ? 0.85 + 0.15 * tw : 1)
        } else {
          // 背景星：拼字开始后慢慢暗下去，留一点在背后闪
          const dim = t < SWIRL ? 1 : Math.max(0.35, 1 - (t - SWIRL) / 1800)
          a[i] = this.baseAlpha[i] * dim * tw
        }
        p[i * 3] = x; p[i * 3 + 1] = y
      }
      this.aPos.needsUpdate = true; this.aAlpha.needsUpdate = true; this.aSize.needsUpdate = true
      this.renderer.render(this.scene, this.camera)
      if (settle) this.done()
    },

    disposeScene() {
      if (this.points) { this.points.geometry.dispose(); this.points.material.dispose(); this.points = null }
      this.scene = null; this.stars = null
    },
    dispose() {
      this.paused = true
      if (this.raf && this.canvas) this.canvas.cancelAnimationFrame(this.raf)
      this.disposeScene()
      if (this.renderer) { this.renderer.dispose(); this.renderer = null }
    }
  }
})
