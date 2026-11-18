// 我的犀鸟：服装格子（解锁了能换上）+ 三条徽章里程碑轨道；点任何一件弹窗看来历，不同状态不同动效和音效
const vocab = require('../../api/vocab')
const lvOf = require('../../utils/level')
const sfx = require('../../utils/sfx')

Page({
  data: { view: 'loading', error: '', costumes: [], badges: [], mascot: '', curImg: '', curTitle: '', costumeN: 0, badgeN: 0, lv: { level: 1, pct: 0 }, tracks: [], pv: null, pvOn: false, pvI: 0, pvN: 0, pvGoal: null, pvPill: '', pvMood: '', pvTick: 0, pvBurst: 0, cf: 0 },
  onLoad() { this.load() },
  async load() {
    try {
      const [r, st] = await Promise.all([vocab.achievements(), vocab.stats().catch(() => null)])
      const costumes = r.items.filter(x => x.type === 'costume').map(x => ({ ...x, latin: (x.title.match(/\s([A-Za-z][A-Za-z ]+)$/) || [, ''])[1], short: x.title.replace(/^([^A-Za-z]*[\u4e00-\u9fff][^A-Za-z]*?)\s+[A-Za-z].*$/, '$1'), how: (x.desc.match(/第 \d+ 站/) || [''])[0] + ' · ' + x.desc.replace(/^第 \d+ 站|通关解锁$/g, '') })), badges = r.items.filter(x => x.type === 'badge')
      const cur = costumes.find(x => x.key === r.mascot)
      this.setData({ view: 'ok', costumes, badges, mascot: r.mascot, curImg: r.mascotImg, curTitle: cur ? cur.title : '', costumeN: costumes.filter(x => x.unlocked).length, badgeN: badges.filter(x => x.unlocked).length, lv: lvOf(st && st.levels), tracks: this.buildTracks(badges, r.prog || {}) })
      this.prog = r.prog || {}
      this.levels = (st && st.levels) || []
      if (r.fresh && r.fresh.length) vocab.achievementsSeen().catch(() => {})
    } catch (e) { this.setData({ view: 'error', error: e.message }) }
  },
  open(e) {
    const { g, i } = e.currentTarget.dataset
    this.g = g
    this.show(i, true)
    this.setData({ pvOn: false })
    setTimeout(() => this.setData({ pvOn: true }), 20)
  },
  // 三条轨道：数字型（打卡天数、词数）按门槛连线显示进度；对战荣誉没有连续数值，只标下一枚
  buildTracks(badges, prog) {
    const at = k => badges.findIndex(b => b.key === k)
    const num = (name, unit, ks, val, lab) => {
      const nodes = ks.map((n, j) => ({ i: at(lab + n), label: n + (unit === '天' ? '天' : ''), n }))
      const got = nodes.filter(x => badges[x.i] && badges[x.i].unlocked).length
      nodes.forEach((x, j) => { x.img = badges[x.i].img; x.state = j < got ? 'got' : j === got ? 'next' : '' })
      const prev = got ? ks[got - 1] : 0, nxt = ks[got]
      const frac = nxt ? Math.max(0, Math.min(1, (val - prev) / (nxt - prev))) : 1
      const pct = got >= ks.length ? 100 : got === 0 ? 0 : ((got - 1) + frac) / (ks.length - 1) * 100
      const note = got >= ks.length ? '全部拿到了' : (unit === '天' ? `最长连续 ${val} 天 · 再 ${nxt - val} 天拿下一枚` : `已学 ${val} 词 · 离 ${nxt} 还差 ${nxt - val}`)
      return { name, nodes, pct, note, hot: val > 0 }
    }
    const battle = ['first-pk', 'pk-3', 'arena-top10', 'school-1'].map((k, j) => ({ i: at('badge-battle-' + k), label: ['初次 PK', '三连胜', '擂台前十', '学校第一'][j] }))
    const bGot = battle.filter(x => badges[x.i] && badges[x.i].unlocked).length
    let marked = false
    battle.forEach(x => { const u = badges[x.i].unlocked; x.img = badges[x.i].img; x.state = u ? 'got' : (!marked ? (marked = true, 'next') : '') })
    const nextB = battle.find(x => x.state === 'next')
    return [
      num('连续打卡', '天', [3, 7, 30, 100], prog.streak || 0, 'badge-streak-'),
      num('学会的词', '词', [100, 500, 1000, 3000, 5000], prog.words || 0, 'badge-words-'),
      { name: '对战荣誉', free: true, nodes: battle, note: nextB ? '下一枚：' + badges[nextB.i].desc : '全部拿到了', hot: bGot > 0 }
    ]
  },
  // 弹窗内容：口号、目标进度、动效和音效都按「服装 / 徽章 × 有没有解锁」来定
  show(i, first) {
    const list = this.data[this.g], pv = list[i]
    let pvGoal = null
    if (pv.type === 'costume' && !pv.unlocked) {
      const n = pv.level || Number((pv.desc.match(/第 (\d+) 站/) || [])[1])
      const l = (this.levels || []).find(x => x.level === n)
      if (l) pvGoal = { level: n, open: l.open, pct: l.total ? Math.round(l.learned / l.total * 100) : 0, left: `${pv.how} · 已学 ${l.learned}`, right: `共 ${l.total} 词` }
    } else if (pv.type === 'badge' && !pv.unlocked) {
      const m = pv.key.match(/^badge-(streak|words)-(\d+)$/)
      if (m) { const need = Number(m[2]), have = (m[1] === 'streak' ? this.prog.streak : this.prog.words) || 0; pvGoal = { pct: Math.min(100, Math.round(have / need * 100)), left: m[1] === 'streak' ? `最长连续 ${have} 天` : `已学 ${have} 词`, right: m[1] === 'streak' ? `目标 ${need} 天` : `目标 ${need} 词` } }
    }
    const worn = pv.type === 'costume' && pv.key === this.data.mascot
    const pvMood = pv.unlocked ? (pv.type === 'badge' ? 'badge' : 'win') : ''
    const pvPill = pv.unlocked ? (pv.type === 'badge' ? 'Syabas! 真棒' : worn ? 'Cantik! 正穿着' : 'Tahniah! 已解锁') : (pvGoal && pvGoal.pct >= 60 ? 'Sikit lagi! 就差一点' : 'Jom! 冲一下')
    this.setData({ pv, pvI: i, pvN: list.length, pvGoal, pvMood, pvPill, pvTick: this.data.pvTick + 1 })
    if (pv.unlocked && pv.type === 'badge') { this.setData({ pvBurst: this.data.pvBurst + 1 }); sfx.play('star') }
    else if (pv.unlocked) { if (first) this.setData({ cf: this.data.cf + 1 }); sfx.play(first ? 'unlock' : 'correct') }
    else sfx.play('tap')
  },
  step(e) { const i = this.data.pvI + Number(e.currentTarget.dataset.d); if (i >= 0 && i < this.data.pvN) this.show(i) },
  goLearn() { const n = this.data.pvGoal.level; this.close(); wx.navigateTo({ url: `/pkg-word/learn/learn?mode=new&level=${n}` }) },
  close() { this.setData({ pvOn: false }); setTimeout(() => this.setData({ pv: null }), 220) },
  noop() {},
  wear(e) { this.pick(e).then(() => this.close()) },
  async pick(e) {
    const k = e.currentTarget.dataset.k
    if (k === this.data.mascot) return
    try {
      const r = await vocab.setMascot(k)
      const cur = this.data.costumes.find(x => x.key === k)
      this.setData({ mascot: r.mascot, curImg: r.mascotImg, curTitle: cur ? cur.title : '' })
      getApp().globalData.dirty = true
      sfx.play('unlock')
      wx.showToast({ title: '换好了', icon: 'success' })
    } catch (err) { wx.showToast({ title: err.message, icon: 'none' }) }
  }
})
