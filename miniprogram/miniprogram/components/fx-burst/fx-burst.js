// 小清新粒子：四角星、五角星、圆点、花瓣（assets/fx/*.svg，琥珀 / 薄荷 / 象牙 / 天蓝 / 浅珊瑚）
// 用法：<view style="position:relative">…<fx-burst fire="{{n}}" /></view>，n 每加 1 炸一次
const FX = ['sparkle-amber', 'sparkle-ivory', 'star-amber', 'star-mint', 'dot-mint', 'dot-sky', 'petal-coral', 'petal-mint'].map(n => `/assets/fx/${n}.svg`)
let seq = 0
Component({
  properties: { fire: { type: Number, value: 0 }, count: { type: Number, value: 12 } },
  data: { parts: [] },
  observers: {
    fire(n) {
      if (!n) return
      const c = this.data.count
      const parts = Array.from({ length: c }, (_, i) => {
        const a = (i / c) * Math.PI * 2 + (Math.random() - 0.5) * 0.5
        const dist = 30 + Math.random() * 38
        return { id: ++seq, src: FX[(i + Math.floor(Math.random() * 3)) % FX.length], s: Math.round(9 + Math.random() * 9), x: Math.round(Math.cos(a) * dist), y: Math.round(Math.sin(a) * dist - 6), r: Math.round((Math.random() - 0.5) * 200), d: Math.round(Math.random() * 70) }
      })
      this.setData({ parts })
      clearTimeout(this.t)
      this.t = setTimeout(() => this.setData({ parts: [] }), 1000)
    }
  },
  detached() { clearTimeout(this.t) }
})
