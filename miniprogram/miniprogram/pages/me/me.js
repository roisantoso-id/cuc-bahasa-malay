const setTab = require('../../utils/tab')
// 护照：顶部我的犀鸟（换装、徽章），下面只放学习数据；设置、关于、客服都在右上角「···」里（pkg-me/more）
const vocab = require('../../api/vocab')
const { ensureStudent } = require('../../utils/student')
const lvOf = require('../../utils/level')

const TRACK = { zero: '零基础', some: '会说一些' }

Page({
  data: { view: 'loading', student: null, s: null, mascotImg: '', myBadges: [], costumeN: 0, badgeN: 0 },
  onShow() {
    setTab(this, 3); this.load() },
  async onPullDownRefresh() { await this.load(); wx.stopPullDownRefresh() },
  async load() {
    try {
      const student = await ensureStudent()
      if (!student) return
      const [s, h, mem, ach] = await Promise.all([vocab.stats(), vocab.home(), vocab.memory().catch(() => null), vocab.achievements().catch(() => null)])
      // 近 30 天热力格：按当天新学 + 复习的量分四档
      const peak = Math.max(1, ...s.days.map(d => d.new + d.review))
      const heat = s.days.map(d => { const v = d.new + d.review; return { day: d.day, lv: v === 0 ? 0 : v / peak > 0.66 ? 3 : v / peak > 0.33 ? 2 : 1 } })
      let memory = null, next7 = []
      if (mem) {
        const base = Math.max(1, mem.strong + mem.ok + mem.weak) // 条只按学过的词算比例；没见过的单独写数字（不然学得少时整条几乎是空的）
        memory = { ...mem, pStrong: mem.strong / base * 100, pOk: mem.ok / base * 100, pWeak: mem.weak / base * 100 }
        const peak7 = Math.max(1, ...mem.next7.map(d => d.n))
        const WK = ['日', '一', '二', '三', '四', '五', '六']
        next7 = mem.next7.map((d, i) => ({ n: d.n, h: Math.max(6, d.n / peak7 * 100), label: i === 0 ? '今天' : WK[new Date(d.day + 'T00:00:00Z').getUTCDay()], today: i === 0 }))
        const top = mem.next7.reduce((m, d, i) => (d.n > m.n ? { n: d.n, i } : m), { n: -1, i: 0 }).i
        memory.peakLabel = peak7 > 1 && top > 0 ? '最多：' + next7[top].label : peak7 > 1 ? '今天最多' : ''
      }
      this.setData({ view: 'ok', student: h.student, track: TRACK[h.student.track] || '', s, heat, memory, next7, total: h.total, stamps: s.levels.filter(l => l.stamped).length, ...this.achData(ach), lv: this.lvData(s.levels), goal: this.goalData(ach, s.levels) })
    } catch (e) { this.setData({ view: 'error', error: e.message }) }
  },
  lvData(levels) { const v = lvOf(levels); const l = (levels || []).find(x => x.level === v.level); return { ...v, name: l ? (l.city || l.name || '') : '' } },
  // 下一个目标：当前这一站学完能解锁的服装（都解锁了就指向下一枚还没拿的徽章）
  goalData(ach, levels) {
    if (!ach) return null
    const v = lvOf(levels), l = (levels || []).find(x => x.level === v.level)
    const cs = ach.items.filter(x => x.type === 'costume' && x.level === v.level && !x.unlocked)
    if (cs.length && l) {
      const left = Math.max(0, l.total - l.learned)
      return { imgs: cs.map(x => x.img), title: `学完${l.city || ''}站，解锁 ${cs.length} 套新衣服`, sub: `还差 ${left} 个词 · ${cs.map(x => x.title.replace(/\s+[A-Za-z].*$/, '')).join('、')}` }
    }
    const b = ach.items.find(x => x.type === 'badge' && !x.unlocked)
    return b ? { imgs: [b.img], title: '下一枚徽章：' + b.title, sub: b.desc } : null
  },
  achData(ach) {
    if (!ach) return {}
    const got = ach.items.filter(x => x.unlocked)
    return { mascotImg: ach.mascotImg || '', costumeN: got.filter(x => x.type === 'costume').length, badgeN: got.filter(x => x.type === 'badge').length, myBadges: got.filter(x => x.type === 'badge').slice(-8) }
  },
  go(e) { wx.navigateTo({ url: e.currentTarget.dataset.url }) },
})
