// 入门测评：测一测认识多少高频词，推荐从哪一档难度学起（服务端规则见 admin/placement.mjs）
//   版面照 design/placement-v1（banana 效果图 + Gemini 审查）：犀鸟拿地图站在五块石阶下 → 扒在词卡上陪考 → 跳起来庆祝
//   intro（石阶 + 犀鸟）→ quiz（看词选义，4 个意思 + 不认识；每档 6 题，一档答对不到 4 个就停）→ result（推荐档、估算词汇量、台阶）
//   每题不判对错、不打勾（免得像「答对了」），选中后停一下再滑到下一题
//   打开方式：?src=home 第一次自动进来（可跳过）；?src=learn 背完觉得太简单进来；其它（护照、首页）主动重测
//   已经有推荐档（≥ 2）的，默认从当前档测起（下面的档算已会，更快），可以改成从入门重测
const vocab = require('../../api/vocab')
const sfx = require('../../utils/sfx')

const fmt = n => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
// 开始页场景图 img/scene-intro.webp（banana 画的，750×1004）里五块石板顶面的中心（百分比，design/placement-v1/scene.py 自动找的；最远那块偏灰没找到，手量）
//   从下往上：入门 → 高级。档位名叠在石板上
const STONES = [{ x: 76.8, y: 80 }, { x: 28.8, y: 43 }, { x: 72.8, y: 30 }, { x: 31.9, y: 19 }, { x: 71.3, y: 11 }]
const SCENE_W = 750, SCENE_H = 1004
const vibrate = () => { try { wx.vibrateShort({ type: 'light' }) } catch (e) {} }

Page({
  data: { view: 'loading', error: '', busy: false, src: '', stones: [], from: 1, current: 0, currentLabel: '', q: null, idx: 0, total: 0, picked: '', slide: '', res: null, num: '0', grow: false, cf: 0 },

  onLoad(o) {
    this.src = o.src || ''
    this.setData({ src: this.src, ...this.layout() })
    this.load(0)
  },
  // 不管手机是白天还是夜晚，测评页都是「夜航」场景（像游戏里的一段旅程）：状态栏白字、深色底
  onShow() {
    wx.setNavigationBarColor({ frontColor: '#ffffff', backgroundColor: '#0a1f22', fail() {} })
    wx.setBackgroundColor && wx.setBackgroundColor({ backgroundColor: '#0a1f22', backgroundColorTop: '#0a1f22', backgroundColorBottom: '#0a1f22' })
  },
  // 自定义顶栏：返回键和微信胶囊对齐；开始页的场景图按剩下的高度缩放，矮屏也放得下
  layout() {
    let wi = {}, mb = null
    try { wi = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync() } catch (e) {}
    try { mb = wx.getMenuButtonBoundingClientRect() } catch (e) {}
    const k = 750 / (wi.windowWidth || 375)
    const top = mb && mb.top ? mb.top : (wi.statusBarHeight || 20) + 4, h = mb && mb.height ? mb.height : 32
    const inset = wi.safeArea ? Math.max(0, (wi.screenHeight || 0) - wi.safeArea.bottom) : 0
    const navTop = Math.round(top * k), navH = Math.round(h * k), head = Math.round((top + h + 8) * k)
    // 开始页：标题约 150rpx，底部按钮区约 230rpx + 底部留白；场景在中间剩下的高度里居中，最高 1004rpx
    const avail = (wi.windowHeight || 667) * k - head - 150 - 230 - 24 - inset * k
    const sh = Math.max(620, Math.min(SCENE_H, Math.round(avail)))
    return { navTop, navH, head, sceneH: sh, sceneW: Math.round(sh * SCENE_W / SCENE_H), fs: Math.round(30 * sh / SCENE_H) }
  },
  onUnload() { clearInterval(this.numTimer); clearTimeout(this.nextTimer) },

  // from = 0：自动决定（有推荐档就从当前档测起）
  async load(from) {
    this.setData({ view: 'loading' })
    try {
      let r = await vocab.placement(from || 1)
      if (!from && r.current >= 2 && this.src !== 'home') r = await vocab.placement(r.current)
      if (!r.questions.length) throw new Error('词库还没准备好，先去学吧')
      this.per = r.per; this.pass = r.pass; this.from = r.from
      this.qs = r.questions
      this.byLevel = r.levels.map(l => r.questions.filter(q => q.d === l.d))
      this.levels = r.levels
      const stones = r.all.map((l, i) => ({ ...l, ...STONES[i], done: l.d < r.from, start: l.d === r.from, far: i >= 3 && l.d > r.from, delay: 200 + i * 90 }))
      this.setData({ view: 'intro', stones, total: r.questions.length, from: r.from, current: r.current, currentLabel: r.currentLabel, fromLabel: (r.all.find(l => l.d === r.from) || {}).label || '' })
    } catch (e) { this.setData({ view: 'error', error: e.message }) }
  },
  fromStart() { this.load(1) },

  begin() {
    this.answers = []
    this.lv = 0; this.inLv = 0; this.okLv = 0
    sfx.play('tap')
    this.show('in')
  },
  show(slide) {
    const list = this.byLevel[this.lv]
    const l = this.levels[this.lv]
    this.setData({ view: 'quiz', q: list[this.inLv], picked: '', slide, idx: this.answers.length + 1, lvLabel: l.label, lvNo: l.d, lvQ: this.inLv + 1, lvTotal: list.length, nod: this.inLv === 0 && this.lv > 0 })
  },
  pick(e) {
    if (this.data.picked || this.data.busy) return
    const pick = e.currentTarget.dataset.o || ''
    const q = this.data.q
    vibrate()
    sfx.play('tick', 0.5)
    this.setData({ picked: pick || '__none' })
    this.answers.push({ rank: q.rank, pick })
    if (pick && pick === q.answer) this.okLv++
    // 停一下让人看清选了哪个，再滑走（Gemini：200ms 停顿 + 180ms 滑出 + 220ms 滑入）
    this.nextTimer = setTimeout(() => { this.setData({ slide: 'out' }); this.nextTimer = setTimeout(() => this.next(), 180) }, 220)
  },
  next() {
    const list = this.byLevel[this.lv]
    this.inLv++
    if (this.inLv < list.length) return this.show('in')
    // 这一档做完：答对不到 pass 个，或者已经是最后一档，就交卷
    if (this.okLv < this.pass || this.lv >= this.byLevel.length - 1) return this.submit()
    this.lv++; this.inLv = 0; this.okLv = 0
    sfx.play('star', 0.6)
    this.show('in')
  },
  async submit() {
    this.setData({ view: 'loading', busy: true })
    try {
      const r = await vocab.placementSubmit(this.answers, this.from)
      getApp().globalData.dirty = true
      const steps = (r.per || []).map((p, i) => ({
        d: p.d, label: p.label, h: 56 + i * 34, delay: 200 + i * 70,
        rec: p.d === r.level, done: p.d <= r.known, skipped: !!p.skipped,
        sub: p.skipped ? '已会' : p.asked ? `${p.correct}/${p.asked}` : ''
      }))
      const up = r.prev && r.level > r.prev, down = r.prev && r.level < r.prev
      const res = {
        label: r.label, answered: this.answers.length, steps,
        head: up ? `升到「${r.label}」了` : down ? `先回到「${r.label}」打牢` : `从「${r.label}」开始学`,
        note: (r.known ? `「${r.knownLabel}」及以下答对的词记为学过，15 天后复习一次确认；` : '') + '答错和不认识的词会最先推给你。学得顺会自动升一档。'
      }
      this.setData({ view: 'result', res, busy: false, num: '0', grow: false })
      sfx.play('complete')
      setTimeout(() => this.setData({ grow: true, cf: this.data.cf + 1 }), 60)
      this.countUp(r.vocab)
    } catch (e) { this.setData({ view: 'error', error: e.message, busy: false }) }
  },
  // 数字 600ms 滚上去，末段减速
  countUp(to) {
    clearInterval(this.numTimer)
    const t0 = Date.now(), D = 600
    this.numTimer = setInterval(() => {
      const k = Math.min(1, (Date.now() - t0) / D)
      const v = Math.round(to * (1 - Math.pow(1 - k, 3)) / 10) * 10
      this.setData({ num: fmt(k >= 1 ? to : v) })
      if (k >= 1) clearInterval(this.numTimer)
    }, 40)
  },
  async skip() {
    if (this.src !== 'home') return this.back()
    try { await vocab.placementSkip(); getApp().globalData.dirty = true } catch (e) { /* 跳过失败下次再问 */ }
    this.back()
  },
  go() { wx.switchTab({ url: '/pages/home/home' }) },
  back() { if (getCurrentPages().length > 1) wx.navigateBack(); else this.go() },
  again() { this.load(0) },
  quit() {
    wx.showModal({ title: '退出测评？', content: '这次的答案不会保存，下次还能再测。', confirmText: '退出', cancelText: '继续测', success: r => { if (r.confirm) this.back() } })
  }
})
