// 彩纸：fire 每加 1 就从上方撒一次（约 1.8 秒），颜色取品牌色；只在撒的时候跑动画
const COLORS = ['#e9b961', '#8fc0a0', '#f3ead6', '#e8a08f', '#9cc9e6', '#f2b874']
Component({
  properties: { fire: { type: Number, value: 0 }, count: { type: Number, value: 90 } },
  observers: { fire(n) { if (n) this.burst() } },
  methods: {
    burst() {
      this.createSelectorQuery().select('#cf').fields({ node: true, size: true }).exec(res => {
        const r = res && res[0]
        if (!r || !r.node) return
        const canvas = r.node, dpr = (wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync()).pixelRatio || 2
        canvas.width = r.width * dpr; canvas.height = r.height * dpr
        const ctx = canvas.getContext('2d'); ctx.scale(dpr, dpr)
        const W = r.width, H = r.height
        const ps = Array.from({ length: this.data.count }, () => ({
          x: W * (0.15 + Math.random() * 0.7), y: -20 - Math.random() * H * 0.25,
          vx: (Math.random() - 0.5) * 3.2, vy: 2 + Math.random() * 3.5, g: 0.06 + Math.random() * 0.05,
          w: 6 + Math.random() * 6, h: 3 + Math.random() * 4, a: Math.random() * 6.28, va: (Math.random() - 0.5) * 0.3,
          c: COLORS[(Math.random() * COLORS.length) | 0], round: Math.random() < 0.3
        }))
        const t0 = Date.now(), DUR = 1900
        const step = () => {
          const k = (Date.now() - t0) / DUR
          ctx.clearRect(0, 0, W, H)
          if (k >= 1) return
          ctx.globalAlpha = k > 0.75 ? (1 - k) / 0.25 : 1
          for (const p of ps) {
            p.vy += p.g; p.vx *= 0.99; p.x += p.vx; p.y += p.vy; p.a += p.va
            ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.a); ctx.fillStyle = p.c
            if (p.round) { ctx.beginPath(); ctx.arc(0, 0, p.h, 0, 6.28); ctx.fill() } else ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h * Math.abs(Math.cos(p.a * 1.7)) + 1)
            ctx.restore()
          }
          canvas.requestAnimationFrame(step)
        }
        canvas.requestAnimationFrame(step)
      })
    }
  }
})
